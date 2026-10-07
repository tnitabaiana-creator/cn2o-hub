/* Arquivo autenticado da calculadora. Estado e documentos são versionados juntos no servidor. */
(function (root) {
  'use strict';
  const MAX_PDF = 5 * 1024 * 1024, MAX_TOTAL = 15 * 1024 * 1024;
  function copiar(v) { return JSON.parse(JSON.stringify(v, function (k, x) { return typeof x === 'bigint' ? String(x) : x; })); }
  function tituloPadrao(s) {
    const nomes = s.modo === 'doacao' ? [...(s.doa.doadores || []), ...(s.doa.donatarios || [])].map(x => x.nome) : (s.inv || []).slice(0, s.modo === 'cumulativo' ? 2 : 1).map(x => x.nome);
    return ((s.modo === 'doacao' ? 'Doação' : s.modo === 'cumulativo' ? 'Inventário cumulativo' : 'Inventário') + ' — ' + (nomes.filter(Boolean).join(' e ') || 'novo atendimento')).slice(0, 160);
  }
  function criar(op) {
    let atual = null, sujo = false, ocupado = false, revisao = 0, geracao = 0, contexto = 0, pendente = null, aviso = '', conflito = false;
    const sessao = () => { const s = op.sessao(); return (s.login || '') + '|' + (s.token || ''); };
    const ticket = () => ({ sessao: sessao(), geracao, revisao, contexto, identificacao: copiar(op.identificacao()) });
    const valido = t => t.sessao === sessao() && t.geracao === geracao && !!op.sessao().token;
    const notificar = () => { if (op.mudou) op.mudou(); };
    function marcar() { revisao++; sujo = true; if (!ocupado && !pendente && !conflito) aviso = ''; notificar(); }
    function reset() { atual = null; sujo = false; ocupado = false; revisao++; geracao++; pendente = null; aviso = ''; conflito = false; notificar(); }
    function seguro() { if (ocupado || pendente) { aviso = 'Conclua ou confira o salvamento pendente antes de trocar de trabalho.'; notificar(); return false; } return !sujo || op.confirmar('Há alterações não salvas. Deseja descartá-las e continuar?'); }
    async function enviar(p) {
      const t = ticket(); ocupado = true; aviso = 'Salvando dados e documentos…'; notificar();
      try {
        const r = await op.api('/hub/itcmd/trabalhos', { corpo: p.corpo, semRedirecionar: true });
        if (!valido(t)) throw { cancelado: true };
        if (!atual || atual.id !== r.id) contexto++;
        atual = { ...r, versoes: [{ versao: r.versao, criado_em: r.atualizado_em, documentos: r.documentos || [] }, ...((atual && atual.id === r.id && atual.versoes) || []).filter(v => v.versao !== r.versao)] };
        sujo = revisao !== p.revisao; pendente = null; conflito = false;
        aviso = '✓ Versão ' + r.versao + ' salva no Hub.' + (sujo ? ' Há novas alterações ainda não salvas.' : '');
        return r;
      } catch (e) {
        if (!valido(t)) throw { cancelado: true };
        if (e.status === 409) { pendente = null; conflito = true; aviso = 'Este trabalho mudou no servidor. Seu formulário foi preservado. Salve uma cópia ou reabra a versão atual para comparar.'; }
        else if (e.status && e.status < 500) { pendente = null; aviso = e.erro || e.message || 'Não foi possível salvar este trabalho.'; if (e.status === 401 && op.expirada) op.expirada(); }
        else { pendente = p; aviso = 'Não foi possível confirmar o salvamento. Use “Confirmar salvamento” para repetir a mesma operação sem duplicar a versão.'; }
        throw e;
      } finally { if (valido(t)) { ocupado = false; notificar(); } }
    }
    async function salvar(documentos = [], estado, comoCopia = false, origem) {
      if (!op.sessao().token) throw new Error('Entre no Hub para salvar o trabalho.');
      if (ocupado) throw new Error('Aguarde o salvamento em andamento.');
      if (pendente) throw new Error('Confirme primeiro o salvamento pendente.');
      if (conflito && !comoCopia) throw new Error('Salve uma cópia ou reabra a versão atual antes de continuar.');
      if (origem && (!valido(origem) || origem.contexto !== contexto)) throw new Error('O trabalho aberto mudou durante a preparação do PDF. Gere ou anexe o documento novamente neste trabalho.');
      const s = copiar(estado || op.estado());
      const meta = origem ? origem.identificacao : op.identificacao();
      const corpo = { id: !comoCopia && atual ? atual.id : op.uuid(), titulo: String(meta.titulo || tituloPadrao(s)).trim().slice(0, 160), protocolo: String(meta.protocolo || '').trim().slice(0, 40),
        estado: s, versao_base: !comoCopia && atual ? atual.versao : 0, operacao_id: op.uuid(), documentos: copiar(documentos) };
      return enviar({ corpo, revisao: origem ? origem.revisao : revisao });
    }
    async function abrir(id, versao) {
      if (!seguro()) return false;
      const t = ticket(); ocupado = true; aviso = 'Abrindo trabalho…'; notificar();
      try {
        const r = await op.api('/hub/itcmd/trabalhos/' + encodeURIComponent(id), { semRedirecionar: true });
        const historico = versao && +versao !== +r.versao;
        const dados = historico ? await op.api('/hub/itcmd/trabalhos/' + encodeURIComponent(id) + '/versoes/' + encodeURIComponent(versao), { semRedirecionar: true }) : r;
        if (!valido(t)) return false;
        if (revisao !== t.revisao) { aviso = 'Você alterou o formulário durante a abertura. Seus dados foram mantidos; abra o trabalho novamente quando estiver pronto.'; return false; }
        if (!dados || !dados.estado || !['inventario','cumulativo','doacao'].includes(dados.estado.modo)) throw new Error('O trabalho salvo tem um formato de dados incompatível.');
        op.aplicar(copiar(dados.estado)); atual = r; pendente = null; conflito = false; sujo = !!historico; revisao++; contexto++;
        op.identificar({ titulo: r.titulo, protocolo: r.protocolo || '' });
        aviso = historico ? 'Dados da versão ' + versao + ' restaurados para edição. Ao salvar, será criada uma nova versão; as anteriores permanecem no histórico.' : 'Versão ' + r.versao + ' aberta. PDFs arquivados mantêm os valores e a aparência da geração original.';
        return true;
      } catch (e) { if (valido(t)) { aviso = e.erro || e.message || 'Não foi possível abrir o trabalho.'; if (e.status === 401 && op.expirada) op.expirada(); } return false; }
      finally { if (valido(t)) { ocupado = false; notificar(); } }
    }
    function novo(estado) {
      if (!seguro()) return false;
      reset(); op.aplicar(estado || op.novo()); op.identificar({ titulo: '', protocolo: '' });
      if (estado) marcar(); return true;
    }
    return { salvar, abrir, novo, reset, marcar, seguro, valido, validoContexto: t => valido(t) && t.contexto === contexto,
      mesmaRevisao: t => valido(t) && t.contexto === contexto && t.revisao === revisao,
      ticket, repetir: () => pendente ? enviar(pendente) : Promise.resolve(null),
      get atual() { return atual; }, get sujo() { return sujo; }, get ocupado() { return ocupado; }, get pendente() { return !!pendente; }, get aviso() { return aviso; }, get conflito() { return conflito; } };
  }
  async function pdfParaDocumento(blob, tipo, nome) {
    if (!blob || !blob.size || blob.size > MAX_PDF) throw new Error('Cada PDF deve ter até 5 MB.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (String.fromCharCode.apply(null, bytes.subarray(0, 5)) !== '%PDF-') throw new Error('Escolha um arquivo PDF válido.');
    let binario = ''; for (let i = 0; i < bytes.length; i += 8192) binario += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return { tipo, nome, mime: 'application/pdf', base64: btoa(binario) };
  }
  function pdfOrcamento(PDF, dados) {
    const pdf = new PDF({ pagina: 'A4' }); let y = 18;
    const equivalentes = { '−': '-', '→': '->', '←': '<-', '≤': '<=', '≥': '>=', '≠': '!=', '≈': 'aproximadamente' };
    const textoPdf = texto => String(texto || '').replace(/[−→←≤≥≠≈]/g, c => !PDF.paraWinAnsi || PDF.paraWinAnsi(c)[0] === 63 ? equivalentes[c] : c);
    function pagina() { pdf.novaPagina(); y = 18; }
    function escrever(texto, forte = false, tam = 10) {
      pdf.fonte(forte, tam).corTexto('#202a3a');
      for (const linha of pdf.quebrar(textoPdf(texto), 178, forte, tam)) { if (y > 275) pagina(); pdf.fonte(forte, tam).texto(16, y, linha); y += tam * 1.4 / (72 / 25.4); }
      y += 1.5;
    }
    escrever('CN2O · ORÇAMENTO DO ATO', true, 15);
    escrever('Cartório de Notas do 2º Ofício de Itabaiana/SE', false, 10);
    escrever(dados.titulo, true, 12); escrever(dados.referencia);
    if (dados.protocolo) escrever('Protocolo / referência: ' + dados.protocolo);
    y += 3;
    const linhas = Array.isArray(dados.linhas) ? dados.linhas : [];
    if (linhas.length) {
      if (dados.ajusteMulta) escrever(dados.ajusteMulta, true, 9);
      escrever('ORÇAMENTO DO ATO', true, 11);
      function cabecalhoTabela() {
        pdf.retangulo(16, y - 4, 178, 8, { preencher: '#F2EEF0', borda: false });
        pdf.fonte(true, 9).texto(18, y + 1, 'ITEM').texto(155, y + 1, 'VALOR', { alinhar: 'dir', larguraMm: 37 }); y += 10;
      }
      cabecalhoTabela();
      linhas.forEach(l => {
        const forte = !!(l.total || l.subtotal), tam = l.total ? 11 : 10;
        const item = pdf.quebrar(textoPdf(l.rotulo), 132, forte, tam), altura = Math.max(8, item.length * 5 + 4);
        if (y + altura > 275) { pagina(); cabecalhoTabela(); }
        if (forte) pdf.retangulo(16, y - 4, 178, altura, { preencher: l.total ? '#F2EEF0' : '#F7F7F7', borda: false });
        pdf.fonte(forte, tam).corTexto('#202a3a');
        item.forEach((t, i) => pdf.texto(18, y + i * 5, t));
        pdf.texto(155, y, textoPdf(l.valor), { alinhar: 'dir', larguraMm: 37 });
        y += altura; pdf.linha(16, y - 4, 194, y - 4, { cor: '#D9D9D9', espessura: 0.15 });
      });
      y += 5; escrever(dados.assinatura || 'Valores estimados, sujeitos à conferência documental e fiscal.', false, 9);
      if (dados.quem) escrever('Elaborado por ' + dados.quem + '.', false, 9);
      pagina();
    }
    escrever(linhas.length ? 'ANEXO · MEMÓRIA DE CÁLCULO' : 'ORÇAMENTO E MEMÓRIA DE CÁLCULO', true, 11);
    String(dados.resumo || '').split('\n').forEach(l => escrever(l, /^Total estimado|^Subtotal/.test(l), 10));
    y += 3; if (y > 250) pagina(); escrever('PREMISSAS E CONFERÊNCIA', true, 11);
    (dados.premissas || []).forEach((l, i) => escrever((i + 1) + '. ' + l));
    escrever(dados.assinatura || 'Valores estimados, sujeitos à conferência documental e fiscal.');
    if (dados.quem) escrever('Elaborado por ' + dados.quem + '.');
    const total = pdf.totalPaginas();
    for (let i = 0; i < total; i++) { pdf.atual = i; pdf.fonte(false, 8).corTexto('#666666').texto(16, 287, 'CN2O · Orçamento arquivado · página ' + (i + 1) + ' de ' + total); }
    return pdf.blob();
  }
  function montar(op) {
    const host = op.host, esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
    const q = s => host.querySelector(s); const urls = new Set(); let buscaSeq = 0, docSeq = 0;
    host.innerHTML = '<section class="itc-arquivo cartao nao-imprimir"><div class="itc-arq-topo"><div><h2>Trabalhos salvos</h2><p class="notinha">Dados para continuar depois e PDFs para reabrir exatamente como foram gerados. Acesso pela sua conta e pelo Tabelião.</p></div><button type="button" class="btn" data-arq-novo>Novo cálculo</button></div><div class="itc-arq-ident"><label>Título / atendimento<input data-arq-titulo maxlength="160" placeholder="O nome do ato e das partes será usado se ficar vazio"></label><label>Protocolo / referência<input data-arq-protocolo maxlength="40" placeholder="Opcional"></label></div><div class="acoes"><button type="button" class="btn primario" data-arq-salvar>Salvar trabalho</button><button type="button" class="btn" data-arq-copia>Salvar como cópia</button><button type="button" class="btn" data-arq-guia>Anexar guia PDF</button><input data-arq-pdf type="file" accept="application/pdf,.pdf" hidden><button type="button" class="btn" data-arq-repetir hidden>Confirmar salvamento</button></div><p class="itc-arq-status" role="status" data-arq-status>Novo cálculo · ainda não salvo.</p><p class="notinha">A guia anexada deve ser o PDF emitido pelo órgão competente. O Hub guarda a cópia; não emite nem altera o DAE.</p><div data-arq-historico></div><div class="itc-arq-grupos" role="group" aria-label="Arquivos por operação"><button type="button" class="btn" data-arq-grupo="inventario" aria-pressed="false">Inventários salvos</button><button type="button" class="btn" data-arq-grupo="doacao" aria-pressed="false">Doações salvas</button></div><details data-arq-lista><summary>Pesquisar e reabrir trabalhos</summary><div class="itc-arq-busca"><input data-arq-busca placeholder="Buscar por título ou protocolo" aria-label="Buscar trabalhos salvos"><button type="button" class="btn" data-arq-pesquisar>Pesquisar</button></div><div data-arq-resultados></div><div class="acoes"><button type="button" class="btn mini" data-arq-anterior disabled>Anterior</button><span data-arq-pagina></span><button type="button" class="btn mini" data-arq-proxima disabled>Próxima</button></div></details></section>';
    let pagina = 1, total = 0, porPagina = 25, grupo = 'inventario';
    const opcoes = { ...op, identificacao: () => ({ titulo: q('[data-arq-titulo]').value, protocolo: q('[data-arq-protocolo]').value }), identificar: m => { q('[data-arq-titulo]').value = m.titulo || ''; q('[data-arq-protocolo]').value = m.protocolo || ''; },
      confirmar: op.confirmar || (m => root.confirm(m)), uuid: () => root.crypto.randomUUID(), mudou: pintar };
    const modelo = criar(opcoes);
    function erro(e) { if (!e || e.cancelado) return; q('[data-arq-status]').textContent = (modelo.pendente || modelo.conflito ? modelo.aviso : '') || e.erro || e.message || 'Não foi possível concluir.'; }
    function pintar() {
      q('[data-arq-status]').textContent = modelo.aviso || (modelo.sujo ? 'Alterações não salvas. Clique em Salvar trabalho.' : modelo.atual ? 'Versão ' + modelo.atual.versao + ' salva.' : 'Novo cálculo · ainda não salvo.');
      q('[data-arq-repetir]').hidden = !modelo.pendente;
      host.querySelectorAll('[data-arq-salvar],[data-arq-copia],[data-arq-guia],[data-arq-novo],[data-arq-repetir]').forEach(b => { b.disabled = modelo.ocupado; });
      const a = modelo.atual;
      q('[data-arq-historico]').innerHTML = a ? '<details class="itc-arq-historico" open><summary>Histórico deste trabalho · versão atual ' + a.versao + '</summary>' + (a.versoes || [{ versao: a.versao, documentos: a.documentos || [] }]).slice().sort((x,y) => y.versao-x.versao).map(v => '<div class="itc-arq-versao"><div><strong>Versão ' + esc(v.versao) + '</strong> <span>' + esc(v.criado_em ? new Date(v.criado_em).toLocaleString('pt-BR') : '') + '</span><button type="button" class="btn mini" data-arq-restaurar="' + esc(v.versao) + '">Restaurar dados para editar</button></div><div class="itc-arq-documentos">' + ((v.documentos || []).length ? v.documentos.map(d => '<button type="button" class="btn mini" data-arq-doc="' + esc(d.id) + '" data-arq-nome="' + esc(d.nome) + '">PDF · ' + esc(d.nome) + '</button>').join('') : '<span class="notinha">Dados salvos; nenhum PDF gerado nesta versão.</span>') + '</div></div>').join('') + '</details>' : '';
    }
    async function pesquisar(n = 1) {
      const seq = ++buscaSeq, t = modelo.ticket(), termo = q('[data-arq-busca]').value.trim();
      q('[data-arq-resultados]').textContent = 'Carregando…';
      try {
        const r = await op.api('/hub/itcmd/trabalhos?grupo=' + grupo + '&busca=' + encodeURIComponent(termo) + '&pagina=' + n, { semRedirecionar: true });
        if (seq !== buscaSeq || !modelo.valido(t)) return;
        pagina = r.pagina || n; total = r.total || 0; porPagina = r.por_pagina || 25;
        q('[data-arq-resultados]').innerHTML = (r.itens || []).length ? r.itens.map(a => '<button type="button" class="itc-arq-item" data-arq-abrir="' + esc(a.id) + '"><b>' + esc(a.titulo) + '</b><span>' + esc(a.modo === 'cumulativo' ? 'Inventário cumulativo' : a.modo === 'doacao' ? 'Doação' : 'Inventário') + ' · ' + esc(a.protocolo || 'Sem protocolo') + ' · versão ' + esc(a.versao) + ' · ' + esc(a.atualizado_em ? new Date(a.atualizado_em).toLocaleString('pt-BR') : '') + '</span></button>').join('') : '<p class="notinha">Nenhum trabalho encontrado.</p>';
        q('[data-arq-pagina]').textContent = 'Página ' + pagina + ' · ' + total + ' trabalho(s)'; q('[data-arq-anterior]').disabled = pagina <= 1; q('[data-arq-proxima]').disabled = pagina * porPagina >= total;
      } catch (e) { if (seq === buscaSeq && modelo.valido(t)) { q('[data-arq-resultados]').textContent = e.erro || 'Não foi possível carregar os trabalhos.'; if (e.status === 401 && op.expirada) op.expirada(); } }
    }
    async function abrirPdf(id, nome) {
      const seq = ++docSeq, t = modelo.ticket(); q('[data-arq-status]').textContent = 'Carregando PDF arquivado…';
      try {
        const r = await (op.fetch || fetch)(op.endpoint() + '/hub/itcmd/documentos/' + encodeURIComponent(id), { headers: { 'X-Auth-Token': op.sessao().token }, cache: 'no-store' });
        if (!r.ok) throw { status: r.status, erro: 'Não foi possível abrir este PDF.' };
        const blob = await r.blob(); if (!modelo.validoContexto(t) || seq !== docSeq) return;
        if (!blob.type.includes('application/pdf')) throw new Error('O servidor não devolveu um PDF.');
        oferecerPdf(blob, nome); q('[data-arq-status]').textContent = 'PDF original recuperado do arquivo. Use o botão para abrir, baixar ou imprimir.';
      } catch (e) { if (modelo.validoContexto(t) && seq === docSeq) { q('[data-arq-status]').textContent = e.erro || e.message || 'Falha ao abrir PDF.'; if (e.status === 401 && op.expirada) op.expirada(); } }
    }
    function oferecerPdf(blob, nome) {
      const url = URL.createObjectURL(blob); urls.add(url);
      let caixa = q('[data-arq-download]'); if (!caixa) { caixa = document.createElement('div'); caixa.dataset.arqDownload = ''; caixa.className = 'itc-arq-download'; host.appendChild(caixa); }
      const linha = document.createElement('div');
      const abrir = document.createElement('a'); abrir.href = url; abrir.target = '_blank'; abrir.rel = 'noopener'; abrir.textContent = 'Abrir / imprimir ' + nome; abrir.className = 'btn mini';
      const baixar = document.createElement('a'); baixar.href = url; baixar.download = nome; baixar.textContent = 'Baixar PDF'; baixar.className = 'btn mini';
      linha.append(abrir, baixar); caixa.appendChild(linha); caixa.scrollIntoView({ block: 'nearest' }); return url;
    }
    function limparLinks() { urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); const cx = q('[data-arq-download]'); if (cx) cx.remove(); }
    const executar = p => Promise.resolve(p).catch(erro);
    host.addEventListener('input', e => { if (e.target.matches('[data-arq-titulo],[data-arq-protocolo]')) modelo.marcar(); });
    host.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.arqGrupo) {
        grupo = b.dataset.arqGrupo; pagina = 1;
        host.querySelectorAll('[data-arq-grupo]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.arqGrupo === grupo)));
        q('[data-arq-lista] summary').textContent = grupo === 'doacao' ? 'Doações salvas' : 'Inventários salvos';
        const jaAberto = q('[data-arq-lista]').open; q('[data-arq-lista]').open = true;
        if (jaAberto) executar(pesquisar());
      }
      if (b.hasAttribute('data-arq-salvar')) executar(modelo.salvar());
      if (b.hasAttribute('data-arq-copia')) executar(modelo.salvar([], undefined, true));
      if (b.hasAttribute('data-arq-repetir')) executar(modelo.repetir());
      if (b.hasAttribute('data-arq-novo') && modelo.novo()) limparLinks();
      if (b.hasAttribute('data-arq-pesquisar')) executar(pesquisar());
      if (b.hasAttribute('data-arq-anterior')) executar(pesquisar(pagina - 1));
      if (b.hasAttribute('data-arq-proxima')) executar(pesquisar(pagina + 1));
      if (b.dataset.arqAbrir) executar(modelo.abrir(b.dataset.arqAbrir).then(ok => { if (ok) limparLinks(); }));
      if (b.dataset.arqRestaurar && modelo.atual) executar(modelo.abrir(modelo.atual.id, +b.dataset.arqRestaurar).then(ok => { if (ok) limparLinks(); }));
      if (b.dataset.arqDoc) executar(abrirPdf(b.dataset.arqDoc, b.dataset.arqNome));
      if (b.hasAttribute('data-arq-guia')) q('[data-arq-pdf]').click();
    });
    q('[data-arq-busca]').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); executar(pesquisar()); } });
    q('[data-arq-lista]').addEventListener('toggle', () => { if (q('[data-arq-lista]').open) executar(pesquisar()); });
    q('[data-arq-pdf]').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return; const t = modelo.ticket(), s = copiar(op.estado()); e.target.value = '';
      try { const d = await pdfParaDocumento(file, 'guia_itcmd', file.name); if (!modelo.valido(t)) return; await modelo.salvar([d], s, false, t); }
      catch (ex) { erro(ex); }
    });
    function reset() { buscaSeq++; docSeq++; modelo.reset(); limparLinks(); opcoes.identificar({}); q('[data-arq-resultados]').replaceChildren(); q('[data-arq-lista]').open = false; }
    window.addEventListener('beforeunload', e => { if (modelo.sujo || modelo.ocupado || modelo.pendente) { e.preventDefault(); e.returnValue = ''; } });
    return { modelo, pesquisar, reset, marcar: modelo.marcar, novo: s => { const ok = modelo.novo(s); if (ok) limparLinks(); return ok; },
      salvar: (...args) => modelo.salvar(...args), oferecerPdf, identificacao: opcoes.identificacao,
      guardarDocumentos: async (docs, estado) => { if (docs.length > 4 || docs.reduce((n,d) => n + d.blob.size,0) > MAX_TOTAL) throw new Error('Máximo de 4 PDFs e 15 MB por versão.'); const t = modelo.ticket(); const arqs = await Promise.all(docs.map(d => pdfParaDocumento(d.blob, d.tipo, d.nome))); if (!modelo.valido(t)) throw { cancelado: true }; return modelo.salvar(arqs, estado, false, t); } };
  }
  const API = { criar, montar, copiar, tituloPadrao, pdfParaDocumento, pdfOrcamento };
  if (typeof module === 'object' && module.exports) module.exports = API; else root.ITCMDArquivo = API;
})(typeof window === 'object' ? window : globalThis);

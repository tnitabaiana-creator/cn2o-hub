(function (root) {
  'use strict';
  const ROTA = '/hub/livro-caixa';
  const MAX_ANEXO = 10 * 1024 * 1024;
  const TIPOS = { pdf: 'application/pdf', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv' };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dinheiro = v => v == null || !Number.isFinite(v) ? 'Aguardando dados' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  function centavos(texto) {
    const s = String(texto || '').trim();
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s)) throw new Error('Informe o total em reais, por exemplo 12.345,67.');
    const p = s.replace(/\./g, '').split(',');
    const n = Number(p[0]) * 100 + Number((p[1] || '').padEnd(2, '0'));
    if (!Number.isSafeInteger(n) || n < 0 || n > 100000000000) throw new Error('Total de despesas inválido.');
    return n;
  }
  function validarArquivo(file) {
    if (!file) return null;
    const ext = String(file.name || '').split('.').pop().toLowerCase();
    if (!TIPOS[ext] || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_ANEXO) throw new Error('Anexe um PDF, XLS, XLSX ou CSV de até 10 MB.');
    return { nome: file.name, tipo: TIPOS[ext] };
  }
  function mesAtual() {
    const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
    return partes.find(p => p.type === 'year').value + '-' + partes.find(p => p.type === 'month').value;
  }
  const vazio = mes => ({ mes, receita: { status: 'ausente', bruto: null, repasses: null, receita_liquida: null }, despesas: { revisao: 0, total: null, fonte: null, anexo: null }, projecao: { saldo: null, ir_projetado: null, liquido_projetado: null } });
  function linhas(m) {
    return [
      ['Receita bruta — Extra Digital', m.receita.bruto],
      ['FERD e repasses — 29,5694%', m.receita.repasses],
      ['Receita líquida do cartório', m.receita.receita_liquida],
      ['Despesas confirmadas do livro-caixa', m.despesas.total],
      ['Saldo antes do IR projetado', m.projecao.saldo],
      ['IR projetado — 27,5% do saldo positivo', m.projecao.ir_projetado],
      ['Resultado líquido projetado', m.projecao.liquido_projetado]
    ];
  }
  function relatorio(m) {
    const rows = linhas(m).map(([r, v], i) => '<tr' + (i === 6 ? ' class="total"' : '') + '><th>' + esc(r) + '</th><td>' + esc(dinheiro(v)) + '</td></tr>').join('');
    return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Livro-caixa do tabelião · ' + esc(m.mes) + '</title><style>body{font:14px/1.6 Arial,sans-serif;color:#202a3a;max-width:850px;margin:40px auto;padding:24px}h1{color:#631325;font-size:26px}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:13px 10px;border-bottom:1px solid #e4ded2;text-align:left}td{text-align:right;white-space:nowrap}tr:nth-child(even){background:#f8f5f1}.total{background:#631325!important;color:white;font-weight:bold}p{color:#59616d}@media print{body{margin:0;padding:0}@page{size:A4;margin:18mm}}</style><h1>Livro-caixa do tabelião</h1><p>Cartório de Notas do 2º Ofício de Itabaiana/SE · ' + esc(m.mes) + '</p><table>' + rows + '</table><p>Receita: ' + esc(m.receita.fonte || 'Fonte financeira ainda não disponível') + '</p><p>Despesas: ' + esc(m.despesas.fonte || 'Livro-caixa ainda não informado') + '. Revisão ' + esc(m.despesas.revisao) + '.</p><p>Anexo: ' + esc(m.despesas.anexo ? m.despesas.anexo.nome : 'Não informado') + '</p><p>Projeção gerencial com base nos valores mensais informados. A receita líquida já desconta FERD e repasses uma única vez. Despesas e IR são apurados somente nesta página; não integram a produtividade por colaborador.</p></html>';
  }
  const celula = value => '"' + String(value == null ? '' : value).replace(/^[\s]*[=+@-]/, s => "'" + s).replace(/"/g, '""') + '"';
  function csv(m) {
    return '\uFEFF' + [['Mês', 'Etapa', 'Valor (R$)'], ...linhas(m).map(([r, v]) => [m.mes, r, v == null ? '' : v.toFixed(2).replace('.', ',')])].map(r => r.map(celula).join(';')).join('\r\n');
  }
  function montar(op) {
    if (!op || !op.host || typeof op.api !== 'function' || typeof op.sessao !== 'function') throw new Error('Livro-caixa não configurado.');
    const doc = op.host.ownerDocument, win = op.window || root, host = op.host;
    const dono = () => { const s = op.sessao(); return s && s.login === 'cesar.bravo' && s.token ? s.login + ':' + s.token : null; };
    const identidade = dono();
    let vivo = true, alterado = false, ocupado = false, bloqueado = false, registros = [], selecionado = mesAtual(), arquivo = null, geracao = 0;
    const urls = new Set();
    const atual = () => registros.find(m => m.mes === selecionado) || vazio(selecionado);
    const autorizado = () => vivo && identidade && dono() === identidade;
    async function requisitar(caminho, opcoes) {
      if (!autorizado()) throw { cancelado: true };
      try {
        // A API global não pode encerrar outra sessão por uma resposta atrasada.
        return await op.api(caminho, { ...(opcoes || {}), semRedirecionar: true });
      } catch (e) {
        if (e && e.status === 401 && autorizado() && op.expirada) op.expirada();
        throw e;
      }
    }
    function situacao(texto, erro) { const s = host.querySelector('[data-status]'); if (s) { s.textContent = texto; s.classList.toggle('erro', !!erro); } }
    function baixar(blob, nome) {
      if (!autorizado()) return;
      const url = win.URL.createObjectURL(blob), a = doc.createElement('a'); urls.add(url);
      a.href = url; a.download = nome; doc.body.appendChild(a); a.click(); a.remove();
      win.setTimeout(() => { win.URL.revokeObjectURL(url); urls.delete(url); }, 1000);
    }
    async function carregar(manterMes) {
      if (!autorizado()) { host.replaceChildren(); return; }
      const id = ++geracao; ocupado = true; desenhar(); situacao('Carregando os dados do mês…');
      try {
        const r = await requisitar(ROTA);
        if (id !== geracao || !autorizado()) return;
        if (!r || !Array.isArray(r.meses)) throw new Error('Resposta do livro-caixa inválida.');
        registros = r.meses;
        if (!manterMes && registros.length && !registros.some(m => m.mes === selecionado)) selecionado = registros.map(m => m.mes).sort().pop();
        alterado = false; bloqueado = false; arquivo = null; ocupado = false; desenhar(); return true;
      } catch (e) { if (id === geracao && autorizado()) { ocupado = false; desenhar(); situacao((e && (e.erro || e.message)) || 'Não foi possível carregar o livro-caixa.', true); } return false; }
    }
    function desenhar() {
      if (!autorizado()) { host.replaceChildren(); return; }
      const m = atual(), disponivel = m.receita.status === 'disponivel';
      host.innerHTML = '<section class="livro-caixa"><div class="lc-barra"><label>Mês<input data-mes type="month" value="' + esc(selecionado) + '"></label><button type="button" data-reabrir>Atualizar dados</button><button type="button" data-relatorio>Baixar relatório</button><button type="button" data-csv>Baixar CSV</button></div>' +
        '<p class="lc-intro">A receita vem da Pesquisa de Produtividade do Extra Digital, já descontados 29,5694% de FERD e repasses. Informe aqui as despesas do seu livro-caixa mensal para apurar o resultado projetado.</p>' +
        '<p data-status role="status" aria-live="polite"></p><div class="lc-indicadores"><article><span>Receita líquida do cartório</span><strong>' + esc(dinheiro(m.receita.receita_liquida)) + '</strong></article><article><span>Despesas do livro-caixa</span><strong>' + esc(dinheiro(m.despesas.total)) + '</strong></article><article class="lc-destaque"><span>Resultado líquido projetado</span><strong>' + esc(dinheiro(m.projecao.liquido_projetado)) + '</strong></article></div>' +
        (!disponivel ? '<p class="lc-pendente">Não há receita financeira importada para este mês. A projeção ficará pendente até a receita estar disponível.</p>' : '') +
        '<form data-form><h3>Livro-caixa do mês</h3><p>Confirme o total de despesas do seu livro-caixa. Não inclua novamente FERD, repasses ou o IR do titular; eles já têm etapas próprias nesta apuração.</p><div class="lc-campos"><label>Total de despesas (R$)<input data-total inputmode="decimal" autocomplete="off" required placeholder="0,00" value="' + (m.despesas.total == null ? '' : esc(m.despesas.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))) + '"></label><label>Referência do livro-caixa<input data-fonte maxlength="1000" required placeholder="Ex.: livro-caixa de setembro/2026, revisado" value="' + esc(m.despesas.fonte || '') + '"></label></div>' +
        '<label class="lc-anexo">Anexar livro-caixa (opcional)<input data-arquivo type="file" accept=".pdf,.xls,.xlsx,.csv"><small>PDF, XLS, XLSX ou CSV · até 10 MB. O anexo fica guardado para conferência; confirme o total no campo acima.</small></label>' +
        (m.despesas.anexo ? '<p>Anexo atual: <button type="button" class="lc-link" data-baixar-anexo>' + esc(m.despesas.anexo.nome) + '</button></p>' : '') +
        '<div class="lc-barra"><button class="lc-primario" type="submit" data-salvar>Salvar despesas confirmadas</button><button type="button" data-historico>Consultar histórico</button></div><small>Revisão ' + esc(m.despesas.revisao) + (m.despesas.atualizado_em ? ' · última atualização ' + esc(new Date(m.despesas.atualizado_em).toLocaleString('pt-BR')) : '') + '</small></form>' +
        '<section><h3>Composição do resultado</h3><div class="lc-tabela"><table><thead><tr><th>Etapa</th><th>Valor</th></tr></thead><tbody>' + linhas(m).map(([r, v], i) => '<tr' + (i === 6 ? ' class="lc-total"' : '') + '><th scope="row">' + esc(r) + '</th><td>' + esc(dinheiro(v)) + '</td></tr>').join('') + '</tbody></table></div><p class="lc-nota">IR projetado de 27,5% somente sobre saldo positivo após as despesas. Sem livro-caixa confirmado, a projeção permanece pendente. Apuração gerencial separada dos relatórios de produtividade.</p></section><section data-historico-painel></section></section>';
      host.querySelectorAll('input,button').forEach(e => { e.disabled = ocupado; });
      if (bloqueado) host.querySelector('[data-salvar]').disabled = true;
      host.querySelector('[data-mes]').addEventListener('change', function () { if (alterado) { this.value = selecionado; situacao('Salve as alterações ou use Atualizar dados para descartá-las antes de trocar o mês.', true); return; } if (/^\d{4}-(0[1-9]|1[0-2])$/.test(this.value)) { selecionado = this.value; arquivo = null; desenhar(); } });
      host.querySelector('[data-reabrir]').addEventListener('click', () => { if (!alterado || win.confirm('Descartar os campos ainda não salvos e reabrir os dados do servidor?')) carregar(true); });
      host.querySelector('[data-total]').addEventListener('input', () => { alterado = true; });
      host.querySelector('[data-fonte]').addEventListener('input', () => { alterado = true; });
      host.querySelector('[data-arquivo]').addEventListener('change', function () { try { arquivo = this.files[0] || null; validarArquivo(arquivo); alterado = true; situacao(arquivo ? 'Anexo selecionado. Confirme o total e salve.' : ''); } catch (e) { arquivo = null; this.value = ''; situacao(e.message, true); } });
      host.querySelector('[data-form]').addEventListener('submit', salvar);
      host.querySelector('[data-relatorio]').addEventListener('click', () => baixar(new win.Blob([relatorio(m)], { type: 'text/html;charset=utf-8' }), 'livro-caixa-' + m.mes + '.html'));
      host.querySelector('[data-csv]').addEventListener('click', () => baixar(new win.Blob([csv(m)], { type: 'text/csv;charset=utf-8' }), 'livro-caixa-' + m.mes + '.csv'));
      host.querySelector('[data-historico]').addEventListener('click', historico);
      const b = host.querySelector('[data-baixar-anexo]'); if (b) b.addEventListener('click', () => baixarAnexo(m.despesas.anexo));
    }
    function lerArquivo(f) {
      const meta = validarArquivo(f); if (!meta) return Promise.resolve(undefined);
      return new Promise((resolve, reject) => { const leitor = new win.FileReader(); leitor.onerror = () => reject(new Error('Não foi possível ler o anexo.')); leitor.onload = () => resolve({ ...meta, base64: String(leitor.result).split(',')[1] }); leitor.readAsDataURL(f); });
    }
    async function salvar(ev) {
      ev.preventDefault(); if (ocupado || bloqueado || !autorizado()) return;
      const m = atual(), id = ++geracao; let enviado = false;
      try {
        const total = centavos(host.querySelector('[data-total]').value), fonte = host.querySelector('[data-fonte]').value.trim();
        if (!fonte) throw new Error('Identifique o livro-caixa usado para confirmar as despesas.');
        ocupado = true; host.querySelectorAll('input,button').forEach(e => { e.disabled = true; }); situacao('Salvando a apuração do mês…');
        const corpo = { revisao_base: m.despesas.revisao, total_despesas_centavos: total, fonte }, anexo = await lerArquivo(arquivo);
        if (!autorizado() || id !== geracao) return;
        if (anexo) corpo.anexo = anexo;
        enviado = true; const salvo = await requisitar(ROTA + '/meses/' + m.mes, { corpo });
        if (!autorizado() || id !== geracao) return;
        if (!salvo || salvo.mes !== m.mes || !salvo.despesas || salvo.despesas.revisao !== m.despesas.revisao + 1 || !salvo.receita || !salvo.projecao) throw new Error('A resposta do salvamento não pôde ser conferida. Use Atualizar dados antes de repetir.');
        registros = registros.filter(x => x.mes !== m.mes).concat(salvo);
        alterado = false; arquivo = null; ocupado = false;
        if (await carregar(true)) situacao('Despesas salvas e projeção atualizada.');
        else if (autorizado()) situacao('Despesas salvas, mas a leitura da projeção falhou. Use Atualizar dados para conferir o resultado.', true);
      } catch (e) {
        if (id !== geracao || !autorizado()) return;
        ocupado = false; bloqueado = !!(enviado && (!e || !e.status || e.status === 409 || e.status >= 500));
        host.querySelectorAll('input,button').forEach(n => { n.disabled = false; }); if (bloqueado) host.querySelector('[data-salvar]').disabled = true;
        situacao(e && e.status === 409 ? 'O mês mudou em outra sessão. Use Atualizar dados para conferir a revisão atual antes de salvar.' : (e && (e.erro || e.message)) || 'Salvamento não confirmado. Confira a versão atual antes de repetir.', true);
      }
    }
    async function historico() {
      const mes = selecionado;
      try { const r = await requisitar(ROTA + '/meses/' + mes + '/historico'); if (!autorizado() || mes !== selecionado) return;
        const lista = r && r.versoes;
        if (!Array.isArray(lista)) throw new Error('Histórico indisponível.');
        const painel = host.querySelector('[data-historico-painel]');
        painel.innerHTML = '<h3>Histórico das despesas · ' + esc(mes) + '</h3>' + (lista.length ? '<ul>' + lista.map((v, i) => { const x = v.despesas; return '<li>Revisão ' + esc(x.revisao) + ' · ' + esc(dinheiro(x.total)) + ' · ' + esc(x.fonte || '') + ' · ' + esc(x.atualizado_em ? new Date(x.atualizado_em).toLocaleString('pt-BR') : '') + (x.anexo ? ' · <button type="button" class="lc-link" data-anexo-historico="' + i + '">' + esc(x.anexo.nome) + '</button>' : '') + '</li>'; }).join('') + '</ul>' : '<p>Nenhuma revisão salva para este mês.</p>');
        painel.querySelectorAll('[data-anexo-historico]').forEach(b => b.addEventListener('click', () => baixarAnexo(lista[Number(b.dataset.anexoHistorico)].despesas.anexo)));
      } catch (e) { if (autorizado()) situacao((e && (e.erro || e.message)) || 'Não foi possível consultar o histórico.', true); }
    }
    async function baixarAnexo(anexo) {
      const s = op.sessao(); if (!autorizado()) return;
      try { const r = await win.fetch(op.endpoint + ROTA + '/anexos/' + encodeURIComponent(anexo.id), { headers: { 'X-Auth-Token': s.token }, cache: 'no-store' });
        if (!autorizado()) return;
        if (r.status === 401) { if (op.expirada) op.expirada(); return; }
        if (!r.ok) throw new Error('Não foi possível baixar o anexo.'); const b = await r.blob(); if (autorizado()) baixar(b, anexo.nome);
      } catch (e) { if (autorizado()) situacao(e.message, true); }
    }
    const monitor = win.setInterval(() => { if (vivo && !autorizado()) destruir(); }, 1000);
    function destruir() { vivo = false; ++geracao; registros = []; arquivo = null; win.clearInterval(monitor); urls.forEach(u => win.URL.revokeObjectURL(u)); urls.clear(); host.replaceChildren(); }
    carregar(false);
    return { destruir, podeSair: () => !ocupado && !alterado };
  }
  const exp = { montar, centavos, validarArquivo, relatorio, csv, linhas, MAX_ANEXO };
  if (typeof module !== 'undefined' && module.exports) module.exports = exp;
  else root.LivroCaixa = exp;
})(typeof window !== 'undefined' ? window : globalThis);

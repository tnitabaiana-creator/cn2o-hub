/* Prazos operacionais do Trello. A carteira atual e as conclusões históricas têm cortes distintos. */
(function (root) {
  'use strict';
  const ROTA = '/hub/relatorios/prazos/semanal', FUSO = 'America/Sao_Paulo';
  const instancias = new Set();
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const inteiro = x => Number.isSafeInteger(x) && x >= 0;
  const instante = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(x) && Number.isFinite(Date.parse(x));
  const diaValido = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x + 'T12:00:00Z')) && new Date(x + 'T12:00:00Z').toISOString().slice(0,10) === x;
  function somar(d, n) { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0,10); }
  function segunda(d) { return diaValido(d) ? somar(d, -((new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7)) : ''; }
  function diaLocal(x) { const p = {}; new Intl.DateTimeFormat('en-CA', { timeZone:FUSO, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date(x)).forEach(v => { p[v.type] = v.value; }); return p.year + '-' + p.month + '-' + p.day; }
  const hoje = () => diaLocal(new Date());
  const data = x => diaValido(x) ? x.slice(8) + '/' + x.slice(5,7) + '/' + x.slice(0,4) : '—';
  const dataHora = x => instante(x) ? new Intl.DateTimeFormat('pt-BR', { timeZone:FUSO, dateStyle:'short', timeStyle:'short' }).format(new Date(x)) : '—';
  const numero = x => x == null ? '—' : Number(x).toLocaleString('pt-BR', { maximumFractionDigits:2 });
  function urlTrello(x) { try { const u = new URL(x); return u.protocol === 'https:' && u.hostname === 'trello.com' && /^\/c\/[A-Za-z0-9]+(?:\/[^\s]*)?$/.test(u.pathname) && !u.username && !u.password ? u.href : ''; } catch (_) { return ''; } }
  function validar(r, ref) {
    if (!r || typeof r.versao !== 'string' || !instante(r.corte_em) || !r.semana || !diaValido(r.semana.inicio) ||
        segunda(r.semana.inicio) !== r.semana.inicio || r.semana.fim !== somar(r.semana.inicio, 6) || (ref && segunda(ref) !== r.semana.inicio) ||
        !r.resumo || ['vencidos','a_vencer','concluidos','sem_responsavel'].some(k => !inteiro(r.resumo[k])) ||
        !Array.isArray(r.responsaveis) || !Array.isArray(r.por_responsavel) || !Array.isArray(r.tipos) ||
        r.tipos.some(x => typeof x !== 'string') || !r.filtros ||
        !r.criterios || ['fila','conclusoes','responsavel'].some(k => typeof r.criterios[k] !== 'string') ||
        !r.cobertura || r.cobertura.reconstrucao_historica !== false || typeof r.cobertura.criterio !== 'string' ||
        typeof r.cobertura.observacao !== 'string' || !inteiro(r.cobertura.pendencias_sincronizacao) ||
        ['concluidos_no_prazo','concluidos_atrasados'].some(k => !inteiro(r.resumo[k])) ||
        r.resumo.concluidos_no_prazo + r.resumo.concluidos_atrasados !== r.resumo.concluidos) throw Error('Resposta de prazos inválida.');
    const ids = new Set();
    r.responsaveis.forEach(p => {
      if (!p || (p.login !== null && (typeof p.login !== 'string' || !p.login)) || typeof p.nome !== 'string' || ids.has(p.login)) throw Error('Responsável inválido.');
      ids.add(p.login);
    });
    r.por_responsavel.forEach(p => {
      if (!p || (p.login !== null && typeof p.login !== 'string') || typeof p.nome !== 'string' ||
          ['vencidos','a_vencer','concluidos'].some(k => !inteiro(p[k]))) throw Error('Resumo por responsável inválido.');
    });
    ['fila','conclusoes'].forEach(nome => {
      const p = r[nome], vistos = new Set();
      if (!p || !Array.isArray(p.itens) || !inteiro(p.total) || !inteiro(p.pagina) || p.pagina < 1 ||
          !inteiro(p.paginas) || !inteiro(p.limite) || p.limite < 1 || p.limite > 100 ||
          p.itens.length > p.limite || p.itens.length > p.total) throw Error('Paginação inválida.');
      p.itens.forEach(x => {
        if (!x || typeof x.card_id !== 'string' || !x.card_id || vistos.has(x.card_id) || typeof x.ato !== 'string' ||
            (x.responsavel !== null && typeof x.responsavel !== 'string') || (x.responsavel_nome != null && typeof x.responsavel_nome !== 'string') ||
            !instante(x.inicio) || !instante(x.vencimento) || typeof x.sincronizacao_pendente !== 'boolean' ||
            (x.confirmado_em !== null && !instante(x.confirmado_em)) ||
            !['vencido','a_vencer','concluido'].includes(x.situacao)) throw Error('Prazo inválido.');
        if (nome === 'conclusoes') {
          if (x.situacao !== 'concluido' || !instante(x.concluido_em) || ![true,false].includes(x.no_prazo) ||
              Date.parse(x.concluido_em) < Date.parse(x.inicio) || Date.parse(x.concluido_em) > Date.parse(r.corte_em) ||
              diaLocal(x.concluido_em) < r.semana.inicio || diaLocal(x.concluido_em) > r.semana.fim) throw Error('Conclusão fora do período.');
        } else if (x.situacao === 'concluido' || (x.situacao === 'vencido' ? Date.parse(x.vencimento) >= Date.parse(r.corte_em) :
          Date.parse(x.vencimento) < Date.parse(r.corte_em) || diaLocal(x.vencimento) < r.semana.inicio || diaLocal(x.vencimento) > r.semana.fim)) throw Error('Situação incompatível com o corte.');
        ['atraso_horas_uteis','atraso_horas_corridas'].forEach(k => { if (x[k] != null && (!Number.isFinite(x[k]) || x[k] < 0)) throw Error('Tempo inválido.'); });
        vistos.add(x.card_id);
      });
    });
    return r;
  }
  function consulta(e) {
    const p = new URLSearchParams({ ref:e.ref, situacao:e.situacao || 'todos', pagina_fila:String(e.pagina_fila || 1), pagina_conclusoes:String(e.pagina_conclusoes || 1), limite:'50' });
    if (e.responsavel) p.set('responsavel', e.responsavel);
    if (e.tipo) p.set('tipo', e.tipo);
    return p.toString();
  }
  function opcao(v, nome, atual) { return '<option value="' + esc(v) + '"' + (v === atual ? ' selected' : '') + '>' + esc(nome) + '</option>'; }
  function paginacao(p, nome) {
    if (!p.total) return '';
    return '<div class="gpr-paginacao"><span>' + numero(p.total) + ' atos · página ' + p.pagina + ' de ' + Math.max(1,p.paginas) + '</span><button type="button" data-gpr-pagina="' + nome + '" data-passos="-1"' + (p.pagina <= 1 ? ' disabled' : '') + '>Anterior</button><button type="button" data-gpr-pagina="' + nome + '" data-passos="1"' + (p.pagina >= p.paginas ? ' disabled' : '') + '>Próxima</button></div>';
  }
  function tabela(p, conclusoes) {
    if (!p.itens.length) return '<p class="gpr-vazio">Nenhum ato encontrado para este recorte.</p>';
    return '<p class="gpr-deslize">Deslize a tabela para ver todas as colunas.</p><div class="gpr-tabela" role="region" tabindex="0" aria-label="' + (conclusoes ? 'Conclusões da semana' : 'Atos em andamento') + '"><table><thead><tr><th>Protocolo e ato</th><th>Responsável</th><th>Início</th><th>Vencimento</th><th>' + (conclusoes ? 'Conclusão' : 'Situação atual') + '</th><th>Atraso</th></tr></thead><tbody>' + p.itens.map(x => {
      const u = urlTrello(x.trello_url);
      const texto = x.situacao === 'concluido' ? (x.no_prazo ? 'Concluído no prazo' : 'Concluído com atraso') : x.situacao === 'vencido' ? 'Vencido' : 'A vencer';
      return '<tr><td>' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' : '') + '<strong>' + esc(x.protocolo == null ? 'Sem protocolo' : 'Protocolo ' + x.protocolo) + '</strong>' + (u ? ' ↗</a>' : '') + '<small>' + esc(x.ato) + '</small></td><td>' + esc(x.responsavel_nome || x.responsavel || 'Sem responsável') + '</td><td>' + dataHora(x.inicio) + '</td><td>' + dataHora(x.vencimento) + '</td><td>' + (conclusoes ? dataHora(x.concluido_em) + '<br>' : '') + '<span class="gpr-status ' + (x.situacao === 'vencido' || x.no_prazo === false ? 'gpr-vencido' : 'gpr-regular') + '">' + texto + '</span>' + (x.sincronizacao_pendente ? '<small class="gpr-pendente">Atualização pendente</small>' : '') + '</td><td class="gpr-num">' + numero(x.atraso_horas_uteis) + ' h úteis<small>' + numero(x.atraso_horas_corridas) + ' h corridas</small></td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function renderizar(e) {
    const r = e.dados;
    const pessoas = (r ? r.responsaveis : e.responsaveis || []).filter(p => p.login !== null).slice();
    if (e.responsavel && e.responsavel !== 'sem_responsavel' && !pessoas.some(p => p.login === e.responsavel)) pessoas.push({ login:e.responsavel, nome:e.nome_responsavel || e.responsavel });
    const tipos = (r ? r.tipos : e.tipos || []).slice();
    if (e.tipo && !tipos.includes(e.tipo)) tipos.push(e.tipo);
    let h = '<div class="gpr-painel"><div class="gpr-filtros"><label>Semana de referência<input type="date" data-gpr-filtro="ref" value="' + esc(e.ref) + '"></label><div class="gpr-navegar"><button type="button" data-gpr-acao="anterior">← Semana anterior</button><button type="button" data-gpr-acao="atual">Semana atual</button><button type="button" data-gpr-acao="seguinte" aria-label="Próxima semana">→</button></div><button type="button" class="gpr-primario" data-gpr-acao="atualizar">Atualizar</button></div>';
    h += '<div class="gpr-filtros gpr-filtros-detalhes"><label>Escrevente responsável<select data-gpr-filtro="responsavel">' + opcao('','Todos',e.responsavel) + opcao('sem_responsavel','Sem responsável',e.responsavel) + pessoas.map(p => opcao(p.login,p.nome,e.responsavel)).join('') + '</select></label><label>Tipo de ato<select data-gpr-filtro="tipo">' + opcao('','Todos os tipos',e.tipo) + tipos.map(t => opcao(t,t,e.tipo)).join('') + '</select></label><label>Situação<select data-gpr-filtro="situacao">' + [['todos','Todos'],['vencidos','Vencidos'],['a_vencer','A vencer'],['concluidos','Concluídos']].map(x => opcao(x[0],x[1],e.situacao)).join('') + '</select></label></div>';
    if (e.carregando) return h + '<p class="gpr-vazio" role="status">Consultando prazos e conclusões…</p></div>';
    if (e.erro) return h + '<p class="gpr-aviso" role="alert">' + esc(e.erro) + ' Use Atualizar para tentar novamente.</p></div>';
    if (!r) return h + '</div>';
    h += '<div class="gpr-periodo"><div><h3>' + data(r.semana.inicio) + ' a ' + data(r.semana.fim) + '</h3><p>Posição consultada em ' + dataHora(r.corte_em) + ' · Brasília</p></div><button type="button" data-gpr-acao="csv"' + (e.exportando ? ' disabled' : '') + '>' + (e.exportando ? 'Preparando CSV…' : 'Baixar CSV') + '</button></div>';
    h += '<p class="gpr-contexto"><strong>Carteira atual:</strong> vencidos ainda abertos, inclusive de semanas anteriores, e atos a vencer na semana selecionada. Uma semana passada não reconstitui a carteira daquela época.</p>';
    h += '<p class="gpr-nota">' + esc(r.cobertura.criterio) + '</p>';
    if (r.cobertura.pendencias_sincronizacao) h += '<p class="gpr-aviso" role="status"><strong>' + numero(r.cobertura.pendencias_sincronizacao) + ' ato(s) com atualização pendente na carteira consultada.</strong> Este aviso abrange todos os responsáveis e tipos. A posição pode diferir do Trello; confira os cartões sinalizados.</p>';
    if (r.cobertura.estado === 'sem_registros_observados') h += '<p class="gpr-aviso">Não há relógios ou conclusões registrados para este recorte. Isso não comprova ausência de trabalho no setor.</p>';
    if (e.exportacaoErro) h += '<p class="gpr-aviso" role="alert">' + esc(e.exportacaoErro) + '</p>';
    h += '<div class="gpr-indicadores">' + [
      ['Vencidos em aberto',r.resumo.vencidos,'Acumulados até a posição atual','gpr-atencao'],
      ['A vencer na semana',r.resumo.a_vencer,'Ainda abertos e dentro do prazo',''],
      ['Concluídos na semana',r.resumo.concluidos,'Encerramentos comprovados no Trello',''],
      ['Sem responsável',r.resumo.sem_responsavel,'Demandam conferência da atribuição','']
    ].map(x => '<article class="' + x[3] + '"><h4>' + x[0] + '</h4><strong>' + numero(x[1]) + '</strong><p>' + x[2] + '</p></article>').join('') + '</div>';
    h += '<p class="gpr-nota">Os indicadores respeitam os filtros de responsável e tipo. O filtro de situação seleciona as tabelas abaixo.</p>';
    h += '<section class="gpr-secao"><h3>Por escrevente responsável</h3><div class="gpr-tabela" role="region" tabindex="0" aria-label="Prazos por responsável"><table><thead><tr><th>Responsável</th><th class="gpr-num">Vencidos em aberto</th><th class="gpr-num">A vencer na semana</th><th class="gpr-num">Concluídos na semana</th></tr></thead><tbody>' + r.por_responsavel.map(p => '<tr><th scope="row">' + esc(p.nome || p.login || 'Sem responsável') + '</th><td class="gpr-num">' + numero(p.vencidos) + '</td><td class="gpr-num">' + numero(p.a_vencer) + '</td><td class="gpr-num">' + numero(p.concluidos) + '</td></tr>').join('') + '</tbody></table></div>' + (!r.por_responsavel.length ? '<p class="gpr-vazio">Nenhum responsável com atos neste recorte.</p>' : '') + '</section>';
    if (e.situacao !== 'concluidos') h += '<section class="gpr-secao"><h3>Atos em andamento agora</h3><p>Ordem de vencimento. Abra o protocolo para consultar o cartão original.</p>' + tabela(r.fila,false) + paginacao(r.fila,'fila') + '</section>';
    if (e.situacao === 'todos' || e.situacao === 'concluidos') h += '<section class="gpr-secao"><h3>Conclusões da semana selecionada</h3><p>' + numero(r.resumo.concluidos_no_prazo) + ' no prazo · ' + numero(r.resumo.concluidos_atrasados) + ' com atraso. Resultado histórico na conclusão; um cartão reaberto pode também constar na fila atual.</p>' + tabela(r.conclusoes,true) + paginacao(r.conclusoes,'conclusoes') + '</section>';
    h += '<details class="gpr-metodo"><summary>Critério e limites da consulta</summary><p>Responsável operacional pelo acompanhamento no Trello. Essa atribuição é distinta do campo “Criado por” usado na produtividade oficial do Extra Digital.</p><p>O prazo do ato parte do Cadastro Extradigital. O prazo setorial de 8 horas, iniciado em Em Digitalização, permanece no relatório de Protocolo e Cadastro.</p><p>' + esc(r.criterios.fila) + '</p><p>' + esc(r.criterios.conclusoes) + '</p><p>' + esc(r.criterios.responsavel) + '</p><p>' + esc(r.cobertura.observacao) + '</p><p>Ausência de amostra não demonstra cumprimento de 100%.</p></details></div>';
    return h;
  }
  function montar(op) {
    const host = op.host, win = op.window || root, original = op.sessao() || {}, token = original.token, login = original.login;
    let vivo = true, geracao = 0, monitor;
    const urls = new Set(), e = { ref:segunda(op.ref || hoje()), responsavel:'', tipo:'', situacao:'todos', pagina_fila:1, pagina_conclusoes:1, dados:null };
    const permitido = () => { const s = op.sessao(); return !!(s && s.admin && token && login && s.token === token && s.login === login); };
    function pintar() { if (vivo && permitido()) host.innerHTML = renderizar(e); }
    function destruir() { if (!vivo) return; vivo = false; geracao++; win.clearInterval(monitor); host.removeEventListener('change', mudar); host.removeEventListener('click', clicar); urls.forEach(u => win.URL.revokeObjectURL(u)); urls.clear(); host.innerHTML = ''; instancias.delete(controle); }
    async function carregar(alteracoes) {
      if (!vivo || !permitido()) { destruir(); return; }
      Object.assign(e, alteracoes || {}); const g = ++geracao, ref = e.ref;
      e.dados = null; e.erro = null; e.exportacaoErro = null; e.carregando = true; e.exportando = false; pintar();
      try { const r = await op.api(ROTA + '?' + consulta(e)); if (!vivo || g !== geracao) return; if (!permitido()) { destruir(); return; } e.dados = validar(r,ref); e.responsaveis = r.responsaveis; e.tipos = r.tipos; const p = r.responsaveis.find(x => x.login === e.responsavel); if (p) e.nome_responsavel = p.nome; }
      catch (err) { if (!vivo || g !== geracao) return; if (!permitido()) { destruir(); return; } if (err && [401,403].includes(err.status)) { destruir(); if (op.expirada) op.expirada(); return; } e.erro = err && err.status === 404 ? 'A consulta de prazos ainda não está disponível no servidor.' : 'Não foi possível confirmar os prazos. Nenhuma ausência foi considerada como zero.'; }
      finally { if (vivo && g === geracao) { e.carregando = false; pintar(); } }
    }
    function mudar(ev) {
      const chave = ev.target && ev.target.getAttribute('data-gpr-filtro');
      if (!['ref','responsavel','tipo','situacao'].includes(chave)) return;
      let v = ev.target.value; if (chave === 'ref') { if (!diaValido(v)) return; v = segunda(v); }
      if (chave === 'responsavel') e.nome_responsavel = (e.responsaveis || []).find(p => p.login === v)?.nome || v;
      carregar({ [chave]:v, pagina_fila:1, pagina_conclusoes:1 });
    }
    async function exportar() {
      if (!e.dados || e.carregando || e.exportando) return;
      const g = geracao; e.exportando = true; e.exportacaoErro = null; pintar();
      try {
        const resposta = await op.api(ROTA + '.csv?formato=json&' + consulta(e));
        if (!vivo || g !== geracao) return; if (!permitido()) { destruir(); return; }
        if (!resposta || typeof resposta.csv !== 'string' || !resposta.csv) throw Error('CSV inválido');
        const a = host.ownerDocument.createElement('a'), u = win.URL.createObjectURL(new win.Blob([resposta.csv], { type:'text/csv;charset=utf-8' }));
        urls.add(u); a.href = u; a.download = 'prazos-atos-' + e.ref + '.csv'; a.click();
        win.setTimeout(() => { if (urls.delete(u)) win.URL.revokeObjectURL(u); },1000);
      } catch (err) {
        if (!vivo || g !== geracao) return;
        if (!permitido() || err && [401,403].includes(err.status)) { destruir(); if (op.expirada) op.expirada(); return; }
        e.exportacaoErro = 'Não foi possível gerar o CSV completo. Tente novamente.';
      } finally { if (vivo && g === geracao) { e.exportando = false; pintar(); } }
    }
    function clicar(ev) {
      const b = ev.target && ev.target.closest('button'); if (!b || !vivo || !permitido() || b.disabled) return;
      const a = b.getAttribute('data-gpr-acao'), pagina = b.getAttribute('data-gpr-pagina');
      if (pagina && e.dados) { const k = 'pagina_' + pagina, p = e.dados[pagina]; if (p) carregar({ [k]:p.pagina + Number(b.getAttribute('data-passos')) }); }
      else if (a === 'csv') exportar();
      else if (a === 'atualizar') carregar();
      else if (['anterior','atual','seguinte'].includes(a)) carregar({ ref:a === 'atual' ? segunda(hoje()) : somar(e.ref,a === 'anterior' ? -7 : 7), pagina_fila:1, pagina_conclusoes:1 });
    }
    const controle = { destruir, recarregar:carregar };
    instancias.add(controle);
    if (!permitido()) { destruir(); return controle; }
    host.addEventListener('change',mudar); host.addEventListener('click',clicar);
    monitor = win.setInterval(() => { if (!permitido() || host.isConnected === false) destruir(); },1000);
    carregar(); return controle;
  }
  const api = { montar, validar, renderizar, consulta, segunda, limparSessao:() => [...instancias].forEach(x => x.destruir()) };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.GestaoPrazos = api;
})(typeof window !== 'undefined' ? window : globalThis);

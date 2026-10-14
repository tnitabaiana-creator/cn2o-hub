/* Produtividade operacional do setor: eventos Trello, sem receita ou contagem CTN. */
(function (root) {
  'use strict';
  const ROTA = '/hub/relatorios/protocolo-cadastro/semanal';
  const FUSO = 'America/Sao_Paulo';
  const instancias = new Set();
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inteiro = v => Number.isSafeInteger(v) && v >= 0;
  const numero = v => v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const horas = v => v === null || v === undefined ? '—' : numero(v) + ' h';
  function diaValido(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v; }
  function somarDias(v, n) { const d = new Date(v + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function segunda(v) { return diaValido(v) ? somarDias(v, -((new Date(v + 'T12:00:00Z').getUTCDay() + 6) % 7)) : ''; }
  function diaLocal(instante) { const p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instante ? new Date(instante) : new Date()).forEach(x => { p[x.type] = x.value; }); return p.year + '-' + p.month + '-' + p.day; }
  function hoje() { return diaLocal(); }
  const dataBr = v => diaValido(v) ? v.slice(8) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4) : '—';
  const feriadoValido = v => diaValido(v) || typeof v === 'string' && /^\d{2}-\d{2}$/.test(v) && diaValido('2000-' + v);
  const feriadoBr = v => diaValido(v) ? dataBr(v) : v.slice(3) + '/' + v.slice(0, 2) + ' (anual)';
  const instanteValido = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
  function dataHora(v) { return instanteValido(v) ? new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)) : '—'; }
  function urlTrello(v) { try { const u = new URL(v); return u.protocol === 'https:' && u.hostname === 'trello.com' && /^\/c\/[A-Za-z0-9]+(?:\/[^\s]*)?$/.test(u.pathname) && !u.username && !u.password ? u.href : ''; } catch (_) { return ''; } }
  function validar(r, referencia) {
    const p = r && r.periodo, c = r && r.criterio, s = r && r.resumo, cov = r && r.cobertura;
    if (!p || !diaValido(p.inicio) || segunda(p.inicio) !== p.inicio || p.fim !== somarDias(p.inicio, 6) ||
        (referencia && segunda(referencia) !== p.inicio) || !instanteValido(p.corte) || typeof p.parcial !== 'boolean' ||
        !c || c.fuso !== FUSO || typeof c.expediente !== 'string' || !Number.isFinite(c.meta_horas_uteis) || c.meta_horas_uteis <= 0 ||
        !['inicio', 'fim', 'etapa_intermediaria'].every(k => typeof c[k] === 'string' && c[k].length > 0 && c[k].length < 200) ||
        !Array.isArray(c.feriados_extra) || c.feriados_extra.some(d => !feriadoValido(d)) || !s || !cov || typeof cov.confirmada !== 'boolean' || !inteiro(cov.eventos) ||
        !['primeiro_evento', 'ultimo_evento', 'ultimo_recebido'].every(k => cov[k] === null || instanteValido(cov[k])) ||
        !Array.isArray(r.avisos) || r.avisos.some(a => typeof a !== 'string') || !Array.isArray(r.dias) || r.dias.length !== 7 || !Array.isArray(r.ciclos)) throw new Error('Resposta do relatório inválida.');
    const contagens = ['entradas', 'retornos_digitalizacao', 'entradas_movimentos_total', 'protocolos_entrada_unicos', 'concluidos', 'ciclos_concluidos', 'retrabalhos', 'em_andamento', 'vencidos', 'no_prazo', 'fora_prazo', 'sem_tempo', 'pendencias'];
    if (contagens.some(k => s[k] !== null && !inteiro(s[k])) || ['media_horas_uteis', 'mediana_horas_uteis'].some(k => s[k] !== null && (!Number.isFinite(s[k]) || s[k] < 0))) throw new Error('Indicadores inválidos.');
    if (s.pendencias_historicas !== undefined && s.pendencias_historicas !== null && !inteiro(s.pendencias_historicas)) throw new Error('Pendências históricas inválidas.');
    if (s.protocolos_entrada_unicos !== null && s.entradas !== null && s.protocolos_entrada_unicos > s.entradas || s.concluidos !== null && s.ciclos_concluidos !== null && s.concluidos > s.ciclos_concluidos) throw new Error('Contagens de cartões divergentes.');
    if (['no_prazo', 'fora_prazo', 'sem_tempo', 'ciclos_concluidos'].every(k => s[k] !== null) && s.no_prazo + s.fora_prazo + s.sem_tempo !== s.ciclos_concluidos) throw new Error('Contagem de prazos divergente.');
    if (['entradas', 'retornos_digitalizacao', 'entradas_movimentos_total'].every(k => s[k] !== null) && s.entradas + s.retornos_digitalizacao !== s.entradas_movimentos_total) throw new Error('Contagem de entradas divergente.');
    r.dias.forEach((d, i) => { if (!d || d.data !== somarDias(p.inicio, i) || typeof d.dia_util !== 'boolean' || ['entradas', 'retornos_digitalizacao', 'entradas_movimentos_total', 'concluidos', 'ciclos_concluidos'].some(k => !inteiro(d[k])) || d.entradas + d.retornos_digitalizacao !== d.entradas_movimentos_total) throw new Error('Distribuição diária inválida.'); });
    ['entradas', 'retornos_digitalizacao', 'entradas_movimentos_total', 'ciclos_concluidos'].forEach(k => { if (s[k] !== null && r.dias.reduce((n, d) => n + d[k], 0) !== s[k]) throw new Error('Distribuição diária divergente.'); });
    const ids = new Set();
    r.ciclos.forEach(x => {
      if (!x || typeof x.id !== 'string' || !x.id || ids.has(x.id) || typeof x.card_id !== 'string' || typeof x.titulo !== 'string' ||
          !['concluido', 'em_andamento', 'pendente', 'interrompido'].includes(x.status) || typeof x.retrabalho !== 'boolean' || !inteiro(x.retornos) ||
          ![true, false, null].includes(x.no_prazo) || (x.horas_uteis !== null && (!Number.isFinite(x.horas_uteis) || x.horas_uteis < 0)) ||
          ['entrou_digitalizacao_em', 'saiu_cadastro_em', 'entrou_gerar_minuta_em'].some(k => x[k] !== null && !instanteValido(x[k]))) throw new Error('Ciclo operacional inválido.');
      if (x.entrou_digitalizacao_em && x.entrou_gerar_minuta_em && Date.parse(x.entrou_gerar_minuta_em) < Date.parse(x.entrou_digitalizacao_em)) throw new Error('Cronologia do ciclo inválida.');
      if (x.fora_fluxo_em !== undefined && x.fora_fluxo_em !== null && !instanteValido(x.fora_fluxo_em)) throw new Error('Saída de fluxo inválida.');
      ids.add(x.id);
    });
    return r;
  }
  function renderizar(estado) {
    const ref = estado.semana || segunda(hoje());
    let h = '<div class="gp-painel"><div class="gp-filtros"><label>Semana de referência<input type="date" data-gp-semana value="' + esc(ref) + '"></label>' +
      '<button type="button" data-gp-acao="anterior" aria-label="Semana anterior">← Anterior</button><button type="button" data-gp-acao="atual">Semana atual</button><button type="button" data-gp-acao="seguinte">Próxima →</button>' +
      '<button class="gp-primario" type="button" data-gp-acao="atualizar">Atualizar dados</button></div>';
    if (estado.carregando) return h + '<p class="gp-mensagem" role="status">Consultando os movimentos da semana…</p></div>';
    if (estado.erro) return h + '<p class="gp-aviso" role="alert">' + esc(estado.erro) + ' Use Atualizar dados para tentar novamente.</p></div>';
    const r = estado.dados;
    if (!r) return h + '<p class="gp-mensagem">Selecione uma semana para consultar.</p></div>';
    const s = r.resumo, base = r.cobertura.confirmada || r.cobertura.eventos > 0, diaCorte = diaLocal(r.periodo.corte);
    const val = k => base ? s[k] : null;
    h += '<div class="gp-periodo"><div><h3>' + dataBr(r.periodo.inicio) + ' a ' + dataBr(r.periodo.fim) + '</h3><p>' +
      (r.periodo.parcial ? 'Semana em andamento · resultado parcial' : 'Período encerrado') + '</p></div><span class="gp-selo">' + (r.cobertura.confirmada ? 'Histórico conferido' : 'Cobertura em conferência') + '</span></div>';
    h += '<p class="gp-fluxo"><strong>Início:</strong> ' + esc(r.criterio.inicio) + ' <span aria-hidden="true">→</span> ' + esc(r.criterio.etapa_intermediaria) + ' <span aria-hidden="true">→</span> <strong>Entrega:</strong> ' + esc(r.criterio.fim) + ' · Tabelião</p>';
    const cards = [
      ['Protocolos concluídos', numero(val('concluidos')), 'Cartões únicos entregues à geração de minutas', 'gp-destaque'],
      ['Entradas em Digitalização', numero(val('entradas')), numero(val('protocolos_entrada_unicos')) + ' protocolos distintos; retornos internos separados', ''],
      ['Em andamento', numero(val('em_andamento')), 'No corte do período, inclusive de semanas anteriores', ''],
      ['Prazo excedido', numero(val('vencidos')), 'Em andamento além de ' + horas(r.criterio.meta_horas_uteis) + ' úteis', '']
    ];
    h += '<div class="gp-indicadores">' + cards.map(x => '<article class="gp-indicador ' + x[3] + '"><h4>' + x[0] + '</h4><strong>' + x[1] + '</strong><p>' + x[2] + '</p></article>').join('') + '</div>';
    h += '<div class="gp-tempos"><div><span>Média dos ciclos concluídos</span><strong>' + horas(val('media_horas_uteis')) + '</strong></div><div><span>Mediana</span><strong>' + horas(val('mediana_horas_uteis')) + '</strong></div><div><span>Ciclos no prazo</span><strong>' + numero(val('no_prazo')) + '</strong></div><div><span>Fora do prazo</span><strong>' + numero(val('fora_prazo')) + '</strong></div><div><span>Sem tempo apurável</span><strong>' + numero(val('sem_tempo')) + '</strong></div></div>';
    if (!r.cobertura.confirmada || r.avisos.length) h += '<div class="gp-aviso"><strong>' + (!base ? 'Sem histórico suficiente para apurar a semana.' : 'Leitura dos eventos disponíveis.') + '</strong>' + (!r.cobertura.confirmada ? '<p>A cobertura histórica ainda não está confirmada; ausências de movimentos não comprovam ausência de trabalho.</p>' : '') + (r.avisos.length ? '<ul>' + r.avisos.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>' : '') + '</div>';
    h += '<section class="gp-secao"><h3>Movimento por dia</h3><p>Entradas registram o recebimento da pasta física para um novo ciclo. Entregas registram a chegada à geração de minutas.</p><p class="gp-deslize">Deslize a tabela para ver todas as colunas.</p><div class="gp-tabela" tabindex="0" role="region" aria-label="Movimento por dia"><table><thead><tr><th>Dia</th><th class="gp-num">Entradas</th><th class="gp-num">Retornos internos</th><th class="gp-num">Protocolos entregues</th><th class="gp-num">Ciclos concluídos</th></tr></thead><tbody>' +
      r.dias.map(d => { const futuro = d.data > diaCorte, conhecido = base && !futuro; return '<tr' + (!d.dia_util || futuro ? ' class="gp-dia-nao-util"' : '') + '><th scope="row">' + new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' }).format(new Date(d.data + 'T12:00:00Z')) + ' · ' + dataBr(d.data) + (futuro ? '<small>Ainda não iniciado</small>' : !d.dia_util ? '<small>Dia não útil</small>' : '') + '</th><td class="gp-num">' + numero(conhecido ? d.entradas : null) + '</td><td class="gp-num">' + numero(conhecido ? d.retornos_digitalizacao : null) + '</td><td class="gp-num">' + numero(conhecido ? d.concluidos : null) + '</td><td class="gp-num">' + numero(conhecido ? d.ciclos_concluidos : null) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="gp-nota">Retornos à Digitalização durante o mesmo ciclo não reiniciam o prazo. Um protocolo pode ter mais de um ciclo ou entrega em dias diferentes. O total semanal de protocolos conta cada cartão uma única vez.</p></section>';
    h += '<section class="gp-secao"><div class="gp-cab-secao"><div><h3>Protocolos e prazos</h3><p>' + numero(val('ciclos_concluidos')) + ' ciclos concluídos · ' + numero(val('retrabalhos')) + ' retrabalhos · ' + numero(val('pendencias')) + ' pendências de apuração</p></div><button type="button" data-gp-acao="csv"' + (!base ? ' disabled' : '') + '>Baixar CSV</button></div>';
    if (s.pendencias_historicas > 0) h += '<p class="gp-nota">' + numero(s.pendencias_historicas) + ' ciclos antigos fora do setor têm a entrega em Gerar Minuta sem comprovação. Essas pendências históricas não compõem o estoque em andamento nem os vencidos.</p>';
    h += r.ciclos.length ? '<p class="gp-deslize">Deslize a tabela para ver todas as colunas.</p><div class="gp-tabela" tabindex="0" role="region" aria-label="Protocolos e prazos"><table class="gp-detalhes"><thead><tr><th>Protocolo</th><th>Entrada · Digitalização</th><th>Saída · Cadastro</th><th>Entrega · Gerar Minuta</th><th class="gp-num">Horas úteis</th><th>Situação</th></tr></thead><tbody>' + r.ciclos.map(x => {
      const url = urlTrello(x.url), titulo = '<strong>' + esc(x.protocolo || 'Sem nº de protocolo') + '</strong><small>' + esc(x.titulo) + '</small>';
      const situacao = x.status === 'concluido' ? x.no_prazo === true ? 'Concluído no prazo' : x.no_prazo === false ? 'Concluído fora do prazo' : 'Concluído · prazo pendente' : x.status === 'em_andamento' ? x.no_prazo === false ? 'Em andamento · prazo excedido' : 'Em andamento' : x.status === 'interrompido' ? 'Ciclo interrompido' : 'Conferência pendente';
      return '<tr><td>' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + titulo + '</a>' : titulo) + (x.retrabalho ? '<span class="gp-etiqueta">Retrabalho</span>' : '') + (x.retornos ? '<small>' + numero(x.retornos) + ' retorno(s) entre etapas</small>' : '') + '</td><td>' + dataHora(x.entrou_digitalizacao_em) + '</td><td>' + dataHora(x.saiu_cadastro_em) + (x.cadastro_confirmado === false ? '<small>Passagem pelo Cadastro não registrada</small>' : '') + '</td><td>' + dataHora(x.entrou_gerar_minuta_em) + '</td><td class="gp-num">' + horas(x.horas_uteis) + '</td><td><span class="gp-status' + (x.no_prazo === false ? ' gp-status-alerta' : '') + '">' + situacao + '</span>' + (x.fora_fluxo_em ? '<small>Saída do fluxo: ' + dataHora(x.fora_fluxo_em) + '</small>' : '') + (x.motivo ? '<small>' + esc(x.motivo) + '</small>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="gp-mensagem">Nenhum ciclo observado neste período.</p>';
    h += '</section><details class="gp-metodo"><summary>Critério, calendário e cobertura</summary><p>Prazo: <strong>' + horas(r.criterio.meta_horas_uteis) + ' úteis</strong>. Expediente: ' + esc(r.criterio.expediente) + ' · ' + esc(r.criterio.fuso) + '. Fins de semana e feriados configurados não consomem o prazo.</p><p>Feriados adicionais: ' + (r.criterio.feriados_extra.length ? r.criterio.feriados_extra.map(feriadoBr).join(', ') : 'nenhum informado') + '.</p><p>Com Digitalização e entrega comprovadas, o tempo é calculado mesmo sem passagem registrada pelo Cadastro; essa ausência fica sinalizada separadamente.</p><p>Posição do relatório: ' + dataHora(r.periodo.corte) + '. Último evento: ' + dataHora(r.cobertura.ultimo_evento) + '. Último recebimento: ' + dataHora(r.cobertura.ultimo_recebido) + '.</p><p>' + numero(r.cobertura.eventos) + ' eventos disponíveis. Tempos sem marcos suficientes permanecem pendentes. Fonte: histórico de movimentos do Trello.</p></details></div>';
    return h;
  }
  function csv(r) {
    const linhas = [['Relatório', 'Protocolo e Cadastro'], ['Semana', r.periodo.inicio, r.periodo.fim], ['Corte', r.periodo.corte], ['Fuso', r.criterio.fuso], ['Cobertura confirmada', r.cobertura.confirmada ? 'Sim' : 'Não'],
      ['Protocolo', 'Cartão', 'Ciclo', 'Entrada Digitalização', 'Saída Cadastro', 'Entrada Gerar Minuta', 'Horas úteis', 'Situação', 'No prazo', 'Retrabalho', 'Retornos', 'Passagem Cadastro comprovada', 'Saída do fluxo', 'Pendência', 'Trello']];
    r.ciclos.forEach(x => linhas.push([x.protocolo, x.titulo, x.id, x.entrou_digitalizacao_em, x.saiu_cadastro_em, x.entrou_gerar_minuta_em, x.horas_uteis, x.status, x.no_prazo === null ? '' : x.no_prazo ? 'Sim' : 'Não', x.retrabalho ? 'Sim' : 'Não', x.retornos, x.cadastro_confirmado === true ? 'Sim' : x.cadastro_confirmado === false ? 'Não' : '', x.fora_fluxo_em, x.motivo, urlTrello(x.url)]));
    return '\uFEFF' + linhas.map(l => l.map(v => { let s = String(v == null ? '' : v); if (/^[\s]*[=+@\-]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }).join(';')).join('\r\n');
  }
  function montar(op) {
    if (!op || !op.host || typeof op.api !== 'function' || typeof op.sessao !== 'function') throw new Error('Relatório não configurado.');
    const win = op.window || root, host = op.host, inicial = op.sessao() || {}, dono = { token: inicial.token, login: inicial.login };
    let vivo = true, geracao = 0, monitor = null;
    const urls = new Set(), estado = { semana: segunda(op.semana || hoje()), dados: null, carregando: false, erro: '' };
    const permitido = () => { const s = op.sessao() || {}; return s.admin === true && !!s.token && !!s.login && s.token === dono.token && s.login === dono.login; };
    function destruir() { if (!vivo) return; vivo = false; ++geracao; estado.dados = null; host.innerHTML = ''; host.removeEventListener('change', selecionar); host.removeEventListener('click', clicar); if (monitor !== null) win.clearInterval(monitor); urls.forEach(u => win.URL.revokeObjectURL(u)); urls.clear(); instancias.delete(controle); }
    function pintar() { if (vivo && permitido()) host.innerHTML = renderizar(estado); }
    async function carregar(semana) {
      if (!vivo || !permitido()) { destruir(); return; }
      const ref = segunda(semana || estado.semana); if (!ref) return;
      estado.semana = ref; estado.dados = null; estado.carregando = true; estado.erro = ''; const g = ++geracao; pintar();
      try { const r = await op.api(ROTA + '?semana=' + encodeURIComponent(ref)); if (!vivo || g !== geracao) return; if (!permitido()) { destruir(); return; } estado.dados = validar(r, ref); }
      catch (e) { if (!vivo || g !== geracao) return; if (!permitido()) { destruir(); return; } if (e && (e.status === 401 || e.status === 403)) { destruir(); if (op.expirada) op.expirada(); return; } estado.erro = e && e.status === 404 ? 'Este relatório ainda não está disponível no servidor.' : 'Não foi possível confirmar os dados do relatório.'; }
      finally { if (vivo && g === geracao) { estado.carregando = false; pintar(); } }
    }
    function selecionar(e) { if (e.target && e.target.hasAttribute('data-gp-semana') && diaValido(e.target.value)) carregar(e.target.value); }
    function clicar(e) {
      const b = e.target && e.target.closest('button[data-gp-acao]'); if (!b || !vivo || !permitido()) return;
      const acao = b.getAttribute('data-gp-acao');
      if (acao === 'anterior' || acao === 'seguinte') carregar(somarDias(estado.semana, acao === 'anterior' ? -7 : 7));
      else if (acao === 'atual') carregar(hoje());
      else if (acao === 'atualizar') carregar();
      else if (acao === 'csv' && estado.dados && !estado.carregando) {
        const a = host.ownerDocument.createElement('a'), u = win.URL.createObjectURL(new win.Blob([csv(estado.dados)], { type: 'text/csv;charset=utf-8' })); urls.add(u);
        a.href = u; a.download = 'protocolo-cadastro-' + estado.dados.periodo.inicio + '.csv'; a.click();
        win.setTimeout(() => { if (urls.delete(u)) win.URL.revokeObjectURL(u); }, 1000);
      }
    }
    const controle = { destruir, recarregar: carregar };
    instancias.add(controle);
    if (!permitido()) { destruir(); return controle; }
    host.addEventListener('change', selecionar); host.addEventListener('click', clicar);
    monitor = win.setInterval(() => { if (!permitido() || host.isConnected === false) destruir(); }, 1000);
    carregar(); return controle;
  }
  const api = { montar, validar, renderizar, csv, segunda, limparSessao: () => [...instancias].forEach(i => i.destruir()) };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GestaoProtocolo = api;
})(typeof window !== 'undefined' ? window : globalThis);

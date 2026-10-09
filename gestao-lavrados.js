/* Leitura da fonte oficial. Nunca altera lançamentos financeiros ou scores do Trello. */
(function (root) {
  'use strict';
  const ROTA = '/hub/atos-lavrados/meses';
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const instancias = new Set();
  const esc = valor => String(valor == null ? '' : valor).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mesValido = valor => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(valor || ''));
  const inteiro = valor => Number.isSafeInteger(valor) && valor >= 0;
  const numero = valor => Number(valor).toLocaleString('pt-BR');
  function diaValido(dia) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dia || ''))) return false;
    const d = new Date(dia + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dia;
  }
  function diaDoCorte(valor) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(valor) || Number.isNaN(Date.parse(valor))) return '';
    const partes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(valor));
    const p = {}; partes.forEach(x => { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  }
  function horaDoCorte(m) { return new Date(m.corte_em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  function nomeMes(mes) { return mesValido(mes) ? MESES[Number(mes.slice(5)) - 1] + ' de ' + mes.slice(0, 4) : 'Mês não informado'; }
  function ultimoDia(mes) { return mes + '-' + String(new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5)), 0)).getUTCDate()).padStart(2, '0'); }
  function diaBr(dia) { return String(dia).slice(8, 10) + '/' + String(dia).slice(5, 7) + '/' + String(dia).slice(0, 4); }
  function validarResposta(resposta) {
    if (!resposta || !Array.isArray(resposta.meses)) throw new Error('Fonte oficial inválida.');
    const vistos = new Set();
    return resposta.meses.map(function (m) {
      if (!m || !mesValido(m.mes) || vistos.has(m.mes) || !diaValido(m.ate) ||
          m.ate < m.mes + '-01' || m.ate > ultimoDia(m.mes) || !inteiro(m.total_observado) ||
          !inteiro(m.com_vinculo) || !inteiro(m.sem_vinculo) || m.com_vinculo + m.sem_vinculo !== m.total_observado ||
          typeof m.cobertura_completa !== 'boolean' ||
          typeof m.dia_final_completo !== 'boolean' || diaDoCorte(m.corte_em) !== m.ate ||
          (m.com_pendencia_identificacao != null && (!inteiro(m.com_pendencia_identificacao) || m.com_pendencia_identificacao > m.total_observado)) ||
          (m.cobertura_completa ? !m.dia_final_completo || m.ate !== ultimoDia(m.mes) || !inteiro(m.total_oficial) || m.total_oficial !== m.total_observado : m.total_oficial !== null)) {
        throw new Error('Cobertura da fonte oficial inválida.');
      }
      vistos.add(m.mes);
      return { mes: m.mes, ate: m.ate, total_oficial: m.total_oficial, total_observado: m.total_observado,
        cobertura_completa: m.cobertura_completa, com_vinculo: m.com_vinculo, sem_vinculo: m.sem_vinculo,
        corte_em: m.corte_em, dia_final_completo: m.dia_final_completo,
        com_pendencia_identificacao: m.com_pendencia_identificacao || 0,
        importado_em: typeof m.importado_em === 'string' ? m.importado_em : '', revisao: m.revisao };
    }).sort((a, b) => a.mes.localeCompare(b.mes));
  }
  function situacao(m) {
    if (!m) return { classe: 'pendente', numero: '—', rotulo: 'Mês não conciliado', cobertura: 'Aguardando base oficial deste mês.' };
    if (!m.cobertura_completa) return { classe: 'parcial', numero: numero(m.total_observado), rotulo: 'Conferência parcial', cobertura: 'De ' + diaBr(m.mes + '-01') + ' a ' + diaBr(m.ate) + (m.dia_final_completo ? '.' : ', até ' + horaDoCorte(m) + ' (horário de Brasília). Dia final parcial.') + ' Não representa o mês completo.' };
    return { classe: 'completa', numero: numero(m.total_oficial), rotulo: 'Extração mensal completa', cobertura: 'De ' + diaBr(m.mes + '-01') + ' a ' + diaBr(m.ate) + '.' };
  }
  function renderizar(estado) {
    const lista = estado.dados || [], chaves = [...new Set((estado.meses || []).concat(lista.map(m => m.mes)).filter(mesValido))].sort();
    const atual = estado.semAssociacao ? '' : estado.mes || chaves[chaves.length - 1] || '';
    const m = lista.find(x => x.mes === atual), s = situacao(m);
    let html = '<section class="lavrados-oficiais" aria-label="Escrituras lavradas no Extra Digital"><div class="lavrados-cab"><div><p class="lavrados-origem">Extra Digital · fonte oficial</p><h3>Escrituras lavradas</h3></div>';
    if (estado.seletor && chaves.length) html += '<label>Mês<select data-lav-mes>' + (estado.semAssociacao ? '<option value="" selected>Escolha um mês oficial</option>' : '') + chaves.slice().reverse().map(ch => '<option value="' + ch + '"' + (ch === atual ? ' selected' : '') + '>' + esc(nomeMes(ch)) + '</option>').join('') + '</select></label>';
    html += '</div><p class="lavrados-criterio">Atos únicos da família Escritura com situação Registrado(a), no mês da data Minuta/Lavratura. Procurações e testamentos não integram esta contagem. Lançamentos financeiros, senhas e cartões do Trello têm contagens próprias.</p>';
    if (estado.carregando) return html + '<p role="status">Consultando a fonte oficial…</p></section>';
    if (estado.erro) return html + '<p class="lavrados-erro" role="status">A fonte oficial está indisponível. Nenhum total foi presumido.</p><button type="button" data-lav-retry>Tentar novamente</button></section>';
    html += '<div class="lavrados-destaque"><strong>' + s.numero + '</strong><div><h4>' + esc(estado.semAssociacao ? 'Período financeiro não identificado' : atual ? nomeMes(atual) : 'Nenhum mês conciliado') + '</h4><span class="lavrados-selo lavrados-selo--' + s.classe + '">' + (estado.semAssociacao ? 'Sem associação de período' : s.rotulo) + '</span><p>' + (estado.semAssociacao ? 'O nome informado no financeiro não identifica um mês. Escolha um mês oficial para consulta independente.' : s.cobertura) + '</p></div></div>';
    if (m) html += '<p class="lavrados-vinculos">' + numero(m.com_vinculo) + ' com vínculo confirmado ao Hub · ' + numero(m.sem_vinculo) + ' sem vínculo confirmado. Vínculo não identifica autoria; não há atribuição automática ao criador do registro.</p>' +
      (m.com_pendencia_identificacao ? '<p class="lavrados-vinculos">' + numero(m.com_pendencia_identificacao) + ' registro(s) com identificação a conferir, incluído(s) na contagem da fonte.</p>' : '') +
      (m.importado_em && !Number.isNaN(Date.parse(m.importado_em)) ? '<p class="lavrados-atualizado">Base importada em ' + esc(new Date(m.importado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })) + '. Retrato da importação; não é atualização em tempo real.</p>' : '');
    if (chaves.length) html += '<details class="lavrados-historico"><summary>Conferência de todos os meses</summary><div class="lavrados-rolagem"><table><caption>Contagem oficial e cobertura por mês</caption><thead><tr><th scope="col">Mês</th><th scope="col">Escrituras lavradas</th><th scope="col">Conferência</th><th scope="col">Período coberto</th></tr></thead><tbody>' + chaves.map(ch => {
      const item = lista.find(x => x.mes === ch), st = situacao(item);
      return '<tr' + (ch === atual ? ' class="lavrados-mes-atual"' : '') + '><th scope="row">' + esc(nomeMes(ch)) + '</th><td>' + st.numero + (item && !item.cobertura_completa ? ' no período' : '') + '</td><td>' + st.rotulo + '</td><td>' + (item ? diaBr(ch + '-01') + ' a ' + diaBr(item.ate) + (item.dia_final_completo ? '' : '<br><small>Até ' + horaDoCorte(item) + ' · Brasília · dia parcial</small>') : '—') + '</td></tr>';
    }).join('') + '</tbody></table></div></details>';
    return html + '</section>';
  }
  function resumoExportacao(snapshot) {
    const s = snapshot || { status: 'indisponivel', mes: '' }, m = s.dados;
    const linhas = [['Fonte oficial', 'Extra Digital · família Escritura · Registrado(a) · data Minuta/Lavratura'], ['Mês de referência', nomeMes(s.mes)]];
    if (!m) {
      linhas.push(['Escrituras lavradas', 'Não disponível'], ['Cobertura', s.status === 'ausente' ? 'Mês não conciliado: sem base oficial importada.' : s.status === 'carregando' ? 'Consulta ainda não concluída no momento da exportação.' : 'Fonte oficial indisponível no momento da exportação.']);
    } else {
      const st = situacao(m);
      linhas.push(['Escrituras lavradas', String(m.cobertura_completa ? m.total_oficial : m.total_observado) + (m.cobertura_completa ? '' : ' no período conferido')],
        ['Cobertura', st.rotulo + '. ' + st.cobertura], ['Corte da extração', diaBr(m.ate) + ' às ' + horaDoCorte(m) + ' (horário de Brasília)'],
        ['Vínculos confirmados ao Hub', String(m.com_vinculo)], ['Sem vínculo confirmado ao Hub', String(m.sem_vinculo)], ['Identificação a conferir', String(m.com_pendencia_identificacao || 0)]);
      if (m.importado_em && !Number.isNaN(Date.parse(m.importado_em))) linhas.push(['Base importada em', new Date(m.importado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })]);
    }
    linhas.push(['Unidades distintas', 'A contagem oficial não altera os lançamentos financeiros, a receita ou os pesos históricos do Trello. Sem atribuição automática de autoria.']);
    return linhas;
  }
  function montar(op) {
    if (!op || !op.host || typeof op.api !== 'function' || typeof op.sessao !== 'function') throw new Error('Configuração da fonte oficial incompleta.');
    const win = op.window || root, host = op.host;
    const inicial = op.sessao() || {}, dono = { token: inicial.token, login: inicial.login, admin: inicial.admin };
    const estado = { dados: [], meses: (op.meses || []).filter(mesValido), mes: mesValido(op.mes) ? op.mes : '', seletor: op.seletor !== false, carregando: false, erro: false };
    let vivo = true, geracao = 0, monitor = null;
    function permitido() { const s = op.sessao() || {}; return !!s.token && !!s.login && s.admin === true && s.token === dono.token && s.login === dono.login && s.admin === dono.admin; }
    function destruir() {
      if (!vivo) return;
      vivo = false; geracao++; estado.dados = []; host.innerHTML = '';
      host.removeEventListener('change', selecionar); host.removeEventListener('click', clicar);
      if (monitor !== null) win.clearInterval(monitor);
      instancias.delete(controle);
    }
    function pintar() { if (vivo && permitido()) host.innerHTML = renderizar(estado); }
    async function carregar() {
      if (!vivo) return;
      if (!permitido()) { destruir(); return; }
      const g = ++geracao; estado.carregando = true; estado.erro = false; pintar();
      try {
        const resposta = await op.api(ROTA);
        if (!vivo || g !== geracao) return;
        if (!permitido()) { destruir(); return; }
        estado.dados = validarResposta(resposta);
        if (!estado.mes && estado.dados.length) estado.mes = estado.dados[estado.dados.length - 1].mes;
      } catch (e) {
        if (!vivo || g !== geracao) return;
        if (!permitido()) { destruir(); return; }
        estado.dados = []; estado.erro = true;
        if (e && (e.status === 401 || e.status === 403)) { destruir(); if (op.expirada) op.expirada(); return; }
      } finally {
        if (vivo && g === geracao) { estado.carregando = false; pintar(); }
      }
    }
    function selecionar(ev) { if (ev.target && ev.target.hasAttribute('data-lav-mes') && mesValido(ev.target.value)) { estado.mes = ev.target.value; estado.semAssociacao = false; pintar(); } }
    function clicar(ev) { if (ev.target && ev.target.closest && ev.target.closest('[data-lav-retry]')) carregar(); }
    const controle = { destruir, recarregar: carregar,
      snapshot: function (mes) {
        if (!vivo || !permitido()) return null;
        if (!mesValido(mes) || estado.semAssociacao || mes !== estado.mes) return { mes: mesValido(mes) ? mes : '', status: 'indisponivel', dados: null };
        const m = !estado.carregando && !estado.erro ? estado.dados.find(x => x.mes === mes) : null;
        return { mes: mes, status: estado.carregando ? 'carregando' : estado.erro ? 'indisponivel' : m ? 'conferido' : 'ausente', dados: m ? JSON.parse(JSON.stringify(m)) : null };
      },
      selecionar: function (mes, meses) { if (mes === null) { estado.mes = ''; estado.semAssociacao = true; } else if (mesValido(mes)) { estado.mes = mes; estado.semAssociacao = false; } if (meses) estado.meses = meses.filter(mesValido); pintar(); }
    };
    instancias.add(controle); host.addEventListener('change', selecionar); host.addEventListener('click', clicar);
    monitor = win.setInterval(function () { if (!permitido() || host.isConnected === false) destruir(); }, 500);
    carregar();
    return controle;
  }
  const api = { montar, validarResposta, renderizar, situacao, resumoExportacao, limparSessao: function () { [...instancias].forEach(i => i.destruir()); } };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GestaoLavrados = api;
})(typeof window !== 'undefined' ? window : globalThis);

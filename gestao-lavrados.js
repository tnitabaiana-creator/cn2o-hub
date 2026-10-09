/* Leitura da fonte oficial. Nunca altera lançamentos financeiros ou scores do Trello. */
(function (root) {
  'use strict';
  const ROTA = '/hub/atos-lavrados/meses';
  const ROTA_RESUMO = '/hub/atos-lavrados/resumo';
  const ROTA_SEMANA = '/hub/atos-lavrados/semana';
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const instancias = new Set();
  const esc = valor => String(valor == null ? '' : valor).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mesValido = valor => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(valor || ''));
  const inteiro = valor => Number.isSafeInteger(valor) && valor >= 0;
  const METODOS = ['direta', 'auditoria_concordante', 'trello_divergencia'];
  function validarMetodos(valor, total, legadoDireto) {
    if (valor == null && legadoDireto) return { direta: total, auditoria_concordante: 0, trello_divergencia: 0 };
    if (!valor || typeof valor !== 'object' || Array.isArray(valor) ||
        Object.keys(valor).some(k => !METODOS.includes(k)) || METODOS.some(k => !inteiro(valor[k])) ||
        METODOS.reduce((s, k) => s + valor[k], 0) !== total) throw new Error('Métodos de atribuição inválidos.');
    return Object.fromEntries(METODOS.map(k => [k, valor[k]]));
  }
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
  function somarDias(dia, quantidade) { const d = new Date(dia + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + quantidade); return d.toISOString().slice(0, 10); }
  function validarResumo(resposta, periodo) {
    const r = resposta, c = r && r.classificacao, a = r && r.autoria;
    if (!r || !diaValido(r.inicio) || !diaValido(r.fim) || r.inicio > r.fim || r.fim > somarDias(r.inicio, 31) ||
        (periodo && (r.inicio !== periodo.inicio || r.fim !== periodo.fim)) ||
        !inteiro(r.total_observado) || !inteiro(r.com_vinculo) || !inteiro(r.sem_vinculo) ||
        r.com_vinculo + r.sem_vinculo !== r.total_observado || typeof r.cobertura_completa !== 'boolean' ||
        !inteiro(r.com_pendencia_identificacao) || r.com_pendencia_identificacao > r.total_observado ||
        (r.cobertura_completa ? r.total_oficial !== r.total_observado : r.total_oficial !== null) ||
        !Array.isArray(r.tipos) || !c || c.versao !== 'extra-digital-tipos-v1' ||
        !Array.isArray(c.campos) || c.campos.join('|') !== 'Sub-tipo|Finalidade' ||
        !inteiro(c.nao_classificados) || !inteiro(c.divergentes) || c.divergentes > c.nao_classificados ||
        !a || !inteiro(a.sem_autoria_confirmada) || !inteiro(a.com_autoria_confirmada) ||
        a.com_autoria_confirmada + a.sem_autoria_confirmada !== r.total_observado ||
        a.status !== (a.com_autoria_confirmada === 0 ? 'pendente' : a.sem_autoria_confirmada ? 'parcial' : 'confirmada') ||
        a.cobertura_completa !== (r.cobertura_completa && a.sem_autoria_confirmada === 0) ||
        !Array.isArray(r.colaboradores)) throw new Error('Resumo oficial inválido.');
    const vistos = new Set();
    const tipos = r.tipos.map(t => {
      if (!t || typeof t.codigo !== 'string' || !/^[a-z0-9_]{1,60}$/.test(t.codigo) || vistos.has(t.codigo) ||
          typeof t.nome !== 'string' || !t.nome.trim() || t.nome.length > 120 || !inteiro(t.total_observado) ||
          (r.cobertura_completa ? t.total_oficial !== t.total_observado : t.total_oficial !== null)) throw new Error('Distribuição por tipo inválida.');
      vistos.add(t.codigo);
      return { codigo: t.codigo, nome: t.nome, total_observado: t.total_observado, total_oficial: t.total_oficial };
    });
    if (tipos.reduce((s, t) => s + t.total_observado, 0) !== r.total_observado ||
        ((tipos.find(t => t.codigo === 'nao_classificado') || {}).total_observado || 0) !== c.nao_classificados) throw new Error('Distribuição divergente do total.');
    const pessoas = new Set();
    const colaboradores = r.colaboradores.map(p => {
      if (!p || typeof p.id !== 'string' || !p.id || p.id.length > 160 || pessoas.has(p.id) ||
          typeof p.nome !== 'string' || !p.nome.trim() || p.nome.length > 200 || !['Extra Digital', 'Extra Digital + Trello'].includes(p.fonte) ||
          !Array.isArray(p.marcos) || !p.marcos.length || new Set(p.marcos).size !== p.marcos.length ||
          p.marcos.some(m => !['lavratura', 'registro', 'atribuicao_gerencial'].includes(m)) || !inteiro(p.total_observado) ||
          (a.cobertura_completa ? p.total_oficial !== p.total_observado : p.total_oficial !== null)) throw new Error('Atribuição de autoria inválida.');
      const metodos = validarMetodos(p.metodos, p.total_observado, p.fonte === 'Extra Digital' && !p.marcos.includes('atribuicao_gerencial'));
      const gerencial = metodos.auditoria_concordante + metodos.trello_divergencia;
      if ((gerencial > 0) !== p.marcos.includes('atribuicao_gerencial') ||
          (metodos.direta > 0) !== p.marcos.some(m => ['lavratura', 'registro'].includes(m)) ||
          p.fonte !== (gerencial ? 'Extra Digital + Trello' : 'Extra Digital')) throw new Error('Fonte incompatível com o método de atribuição.');
      pessoas.add(p.id);
      return { id: p.id, nome: p.nome, fonte: p.fonte, marcos: p.marcos.slice(), metodos, total_observado: p.total_observado, total_oficial: p.total_oficial };
    });
    if (colaboradores.reduce((s, p) => s + p.total_observado, 0) !== a.com_autoria_confirmada) throw new Error('Autoria divergente do total.');
    const metodos = validarMetodos(a.metodos, a.com_autoria_confirmada, colaboradores.every(p => p.metodos.direta === p.total_observado));
    if (METODOS.some(k => colaboradores.reduce((s, p) => s + p.metodos[k], 0) !== metodos[k])) throw new Error('Métodos divergentes do total atribuído.');
    const meses = validarResposta({ meses: r.meses });
    if ((!meses.length && r.total_observado) || meses.some(m => m.mes < r.inicio.slice(0, 7) || m.mes > r.fim.slice(0, 7))) throw new Error('Bases fora do período.');
    // Cobertura de um período não é a cobertura do mês inteiro, mas exige todas as datas consultadas.
    if (r.cobertura_completa) {
      for (let dia = r.inicio; dia <= r.fim; dia = somarDias(dia, 1)) {
        const m = meses.find(x => x.mes === dia.slice(0, 7));
        if (!m || dia > m.ate || (dia === m.ate && !m.dia_final_completo)) throw new Error('Período sem cobertura completa.');
      }
    }
    return { inicio: r.inicio, fim: r.fim, total_observado: r.total_observado, total_oficial: r.total_oficial,
      cobertura_completa: r.cobertura_completa, com_vinculo: r.com_vinculo, sem_vinculo: r.sem_vinculo,
      com_pendencia_identificacao: r.com_pendencia_identificacao, meses, tipos,
      classificacao: { versao: c.versao, nao_classificados: c.nao_classificados, divergentes: c.divergentes },
      colaboradores, autoria: { status: a.status, sem_autoria_confirmada: a.sem_autoria_confirmada,
        com_autoria_confirmada: a.com_autoria_confirmada, cobertura_completa: a.cobertura_completa, metodos } };
  }
  function validarSemana(r, referencia) {
    if (!r || r.fuso !== 'America/Sao_Paulo' || !diaValido(r.referencia) || (referencia && r.referencia !== referencia) ||
        !diaValido(r.inicio) || new Date(r.inicio + 'T12:00:00Z').getUTCDay() !== 1 ||
        r.fim !== somarDias(r.inicio, 6) || r.referencia < r.inicio || r.referencia > r.fim) throw new Error('Semana oficial inválida.');
    return { ...validarResumo(r), referencia: r.referencia };
  }
  function validarResposta(resposta) {
    if (!resposta || !Array.isArray(resposta.meses)) throw new Error('Fonte oficial inválida.');
    const vistos = new Set();
    return resposta.meses.map(function (m) {
      const diaCorte = m && diaDoCorte(m.corte_em);
      if (!m || !mesValido(m.mes) || vistos.has(m.mes) || !diaValido(m.ate) ||
          m.ate < m.mes + '-01' || m.ate > ultimoDia(m.mes) || !inteiro(m.total_observado) ||
          !inteiro(m.com_vinculo) || !inteiro(m.sem_vinculo) || m.com_vinculo + m.sem_vinculo !== m.total_observado ||
          typeof m.cobertura_completa !== 'boolean' ||
          typeof m.dia_final_completo !== 'boolean' || !diaCorte || (m.dia_final_completo ? diaCorte <= m.ate : diaCorte !== m.ate) ||
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
  function distribuicao(r) {
    let html = '<div class="lavrados-distribuicao"><h4>Por tipo de escritura</h4><p>Classificação dos campos Sub-tipo e Finalidade do Extra Digital. Quantidades do período consultado; não são pesos ou lançamentos financeiros.</p>';
    if (r.tipos.length) html += '<div class="lavrados-tipos">' + r.tipos.map(t => '<div class="lavrados-tipo"><span>' + esc(t.nome) + (t.codigo === 'nao_classificado' ? '<small>Classificação não confirmada pela fonte</small>' : '') + '</span><strong>' + numero(t.total_observado) + '</strong></div>').join('') + '</div>';
    else html += '<p>Nenhum tipo disponível no período coberto pela extração.</p>';
    if (r.classificacao.divergentes) html += '<p class="lavrados-pendencia">' + numero(r.classificacao.divergentes) + ' registro(s) com classificação divergente na fonte, mantido(s) na contagem e sem classificação presumida.</p>';
    html += '<div class="lavrados-autoria"><h4>Por escrevente responsável</h4><p>' + (r.autoria.cobertura_completa ? 'Atribuições conferidas para todo o período.' : r.autoria.com_autoria_confirmada ? 'Atribuições conferidas até esta extração. O agrupamento ainda não representa um fechamento individual.' : 'A extração ainda não permite atribuir as escrituras aos responsáveis.') + ' Prioridade para a evidência direta de registro/lavratura. Quando ela falta, o último escrevente da auditoria é comparado ao responsável do cartão Trello; na divergência, prevalece o Trello, conforme critério do titular.</p>';
    if (r.colaboradores.length) html += '<div class="lavrados-tipos">' + r.colaboradores.map(p => {
      const m = p.metodos, explicacoes = [];
      if (m.direta) explicacoes.push('Evidência: ' + p.marcos.filter(x => x !== 'atribuicao_gerencial').map(esc).join(' e ') + ' · Extra Digital · ' + numero(m.direta));
      if (m.auditoria_concordante) explicacoes.push('Critério gerencial · auditoria e Trello concordantes · ' + numero(m.auditoria_concordante));
      if (m.trello_divergencia) explicacoes.push('Critério gerencial · Trello prevalece na divergência · ' + numero(m.trello_divergencia));
      return '<div class="lavrados-tipo"><span>' + esc(p.nome) + '<small>' + explicacoes.join('<br>') + '</small></span><strong>' + numero(p.total_observado) + '</strong></div>';
    }).join('') + '</div>';
    if (r.autoria.sem_autoria_confirmada) html += '<div class="lavrados-tipo lavrados-sem-autoria"><span>Responsável não identificado<small>Pendência de atribuição; não representa produtividade zero.</small></span><strong>' + numero(r.autoria.sem_autoria_confirmada) + '</strong></div>';
    else if (!r.colaboradores.length) html += '<p>Sem atos atribuídos no período coberto pela extração.</p>';
    html += '</div></div>';
    return html;
  }
  function renderizarSemana(estado) {
    const sem = estado.semana || {}, r = sem.dados;
    let html = '<div class="lavrados-semana-controles"><label>Data de referência<input type="date" data-lav-referencia value="' + esc(sem.referencia || '') + '"></label><div><button type="button" data-lav-anterior' + (!sem.referencia ? ' disabled' : '') + '>Semana anterior</button><button type="button" data-lav-atual>Semana atual</button></div></div><p class="lavrados-criterio">Semana civil de segunda a domingo. O corte de sexta-feira é uma atualização parcial; atos posteriores aparecem após uma nova extração. Esta consulta não muda o mês financeiro.</p>';
    if (sem.carregando) return html + '<p role="status">Consultando a semana na fonte oficial…</p>';
    if (sem.erro) return html + '<p class="lavrados-erro" role="status">A consulta semanal está indisponível. O resumo mensal permanece independente.</p><button type="button" data-lav-semana-retry>Tentar novamente</button>';
    if (!r) return html + '<p role="status">Selecione uma semana para consulta.</p>';
    const semBase = !r.meses.length;
    html += '<div class="lavrados-destaque"><strong>' + (semBase ? '—' : numero(r.cobertura_completa ? r.total_oficial : r.total_observado)) + '</strong><div><h4>' + diaBr(r.inicio) + ' a ' + diaBr(r.fim) + '</h4><span class="lavrados-selo lavrados-selo--' + (r.cobertura_completa ? 'completa' : 'parcial') + '">' + (r.cobertura_completa ? 'Extração semanal completa' : 'Semana com cobertura parcial') + '</span><p>' + (semBase ? 'Sem base importada para esta semana. Nenhum total foi presumido.' : r.cobertura_completa ? 'Contagem oficial de todo o período.' : 'Contagem observada até os cortes abaixo. Não representa a semana encerrada.') + '</p></div></div>';
    if (r.meses.length) html += '<div class="lavrados-cortes"><h4>Cortes das bases consultadas</h4><ul>' + r.meses.map(m => '<li><strong>' + esc(nomeMes(m.mes)) + ':</strong> cobertura até ' + diaBr(m.ate) + (m.dia_final_completo ? ' · dia final completo' : ' · dia final parcial') + '<br>Extração em ' + diaBr(diaDoCorte(m.corte_em)) + ' às ' + horaDoCorte(m) + ' · Brasília</li>').join('') + '</ul><p>A cobertura da semana é avaliada dentro dessas bases, separadamente da cobertura de cada mês.</p></div>';
    html += '<p class="lavrados-vinculos">' + numero(r.com_vinculo) + ' com vínculo confirmado ao Hub · ' + numero(r.sem_vinculo) + ' sem vínculo confirmado. Vínculo não identifica autoria.</p>';
    if (r.com_pendencia_identificacao) html += '<p class="lavrados-vinculos">' + numero(r.com_pendencia_identificacao) + ' registro(s) com identificação a conferir, incluído(s) na contagem da fonte.</p>';
    return html + distribuicao(r) + '<p class="lavrados-atualizado">Retrato das bases importadas. Não é uma consulta em tempo real ao Extra Digital.</p>';
  }
  function renderizar(estado) {
    const lista = estado.dados || [], chaves = [...new Set((estado.meses || []).concat(lista.map(m => m.mes)).filter(mesValido))].sort();
    const atual = estado.semAssociacao ? '' : estado.mes || chaves[chaves.length - 1] || '';
    const m = lista.find(x => x.mes === atual), s = situacao(m);
    let html = '<section class="lavrados-oficiais" aria-label="Escrituras lavradas no Extra Digital"><div class="lavrados-cab"><div><p class="lavrados-origem">Extra Digital · fonte oficial</p><h3>Escrituras lavradas</h3></div>';
    if (estado.visao !== 'semana' && estado.seletor && chaves.length) html += '<label>Mês<select data-lav-mes>' + (estado.semAssociacao ? '<option value="" selected>Escolha um mês oficial</option>' : '') + chaves.slice().reverse().map(ch => '<option value="' + ch + '"' + (ch === atual ? ' selected' : '') + '>' + esc(nomeMes(ch)) + '</option>').join('') + '</select></label>';
    html += '</div><p class="lavrados-criterio">Atos únicos da família Escritura com situação Registrado(a), pela data Minuta/Lavratura. Procurações e testamentos não integram esta contagem. Lançamentos financeiros, senhas e cartões do Trello têm contagens próprias.</p>';
    html += '<div class="lavrados-visoes" role="group" aria-label="Período da consulta oficial"><button type="button" data-lav-visao="mes" aria-pressed="' + (estado.visao !== 'semana') + '">Mês selecionado</button><button type="button" data-lav-visao="semana" aria-pressed="' + (estado.visao === 'semana') + '">Por semana</button></div>';
    if (estado.visao === 'semana') return html + renderizarSemana(estado) + '</section>';
    if (estado.carregando) return html + '<p role="status">Consultando a fonte oficial…</p></section>';
    if (estado.erro) return html + '<p class="lavrados-erro" role="status">A fonte oficial está indisponível. Nenhum total foi presumido.</p><button type="button" data-lav-retry>Tentar novamente</button></section>';
    html += '<div class="lavrados-destaque"><strong>' + s.numero + '</strong><div><h4>' + esc(estado.semAssociacao ? 'Período financeiro não identificado' : atual ? nomeMes(atual) : 'Nenhum mês conciliado') + '</h4><span class="lavrados-selo lavrados-selo--' + s.classe + '">' + (estado.semAssociacao ? 'Sem associação de período' : s.rotulo) + '</span><p>' + (estado.semAssociacao ? 'O nome informado no financeiro não identifica um mês. Escolha um mês oficial para consulta independente.' : s.cobertura) + '</p></div></div>';
    if (m) html += '<p class="lavrados-vinculos">' + numero(m.com_vinculo) + ' com vínculo confirmado ao Hub · ' + numero(m.sem_vinculo) + ' sem vínculo confirmado. Vínculo não identifica autoria; não há atribuição automática ao criador do registro.</p>' +
      (m.com_pendencia_identificacao ? '<p class="lavrados-vinculos">' + numero(m.com_pendencia_identificacao) + ' registro(s) com identificação a conferir, incluído(s) na contagem da fonte.</p>' : '') +
      '<p class="lavrados-atualizado">Extração em ' + diaBr(diaDoCorte(m.corte_em)) + ' às ' + horaDoCorte(m) + ' (horário de Brasília).</p>' +
      (m.importado_em && !Number.isNaN(Date.parse(m.importado_em)) ? '<p class="lavrados-atualizado">Base importada em ' + esc(new Date(m.importado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })) + '. Retrato da importação; não é atualização em tempo real.</p>' : '');
    const detalhe = estado.detalhe || {};
    if (m && detalhe.carregando) html += '<p role="status">Consultando tipos e autoria deste mês…</p>';
    else if (m && detalhe.erro) html += '<p class="lavrados-erro">A distribuição deste mês não está disponível. O total acima mantém sua própria fonte.</p><button type="button" data-lav-detalhe-retry>Consultar distribuição novamente</button>';
    else if (m && detalhe.mes === atual && detalhe.dados) html += distribuicao(detalhe.dados);
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
        ['Cobertura', st.rotulo + '. ' + st.cobertura], ['Corte da extração', diaBr(diaDoCorte(m.corte_em)) + ' às ' + horaDoCorte(m) + ' (horário de Brasília)'],
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
    const estado = { dados: [], meses: (op.meses || []).filter(mesValido), mes: mesValido(op.mes) ? op.mes : '', seletor: op.seletor !== false, carregando: false, erro: false,
      visao: 'mes', detalhe: {}, semana: {} };
    let vivo = true, geracao = 0, geracaoDetalhe = 0, geracaoSemana = 0, monitor = null, mesRecebido = op.mes;
    function permitido() { const s = op.sessao() || {}; return !!s.token && !!s.login && s.admin === true && s.token === dono.token && s.login === dono.login && s.admin === dono.admin; }
    function destruir() {
      if (!vivo) return;
      vivo = false; geracao++; geracaoDetalhe++; geracaoSemana++; estado.dados = []; estado.detalhe = {}; estado.semana = {}; host.innerHTML = '';
      host.removeEventListener('change', selecionar); host.removeEventListener('click', clicar);
      if (monitor !== null) win.clearInterval(monitor);
      instancias.delete(controle);
    }
    function pintar() { if (vivo && permitido()) host.innerHTML = renderizar(estado); }
    async function carregar() {
      if (!vivo) return;
      if (!permitido()) { destruir(); return; }
      const g = ++geracao; geracaoDetalhe++; estado.detalhe = {}; estado.carregando = true; estado.erro = false; pintar();
      try {
        const resposta = await op.api(ROTA);
        if (!vivo || g !== geracao) return;
        if (!permitido()) { destruir(); return; }
        estado.dados = validarResposta(resposta);
        if (!estado.mes && estado.dados.length) estado.mes = estado.dados[estado.dados.length - 1].mes;
        carregarDetalhe();
      } catch (e) {
        if (!vivo || g !== geracao) return;
        if (!permitido()) { destruir(); return; }
        estado.dados = []; estado.erro = true;
        if (e && (e.status === 401 || e.status === 403)) { destruir(); if (op.expirada) op.expirada(); return; }
      } finally {
        if (vivo && g === geracao) { estado.carregando = false; pintar(); }
      }
    }
    async function carregarDetalhe() {
      const g = ++geracaoDetalhe, mes = estado.mes, fonte = estado.dados.find(x => x.mes === mes);
      estado.detalhe = {};
      if (!vivo || !permitido() || estado.semAssociacao || !fonte) { pintar(); return; }
      estado.detalhe = { mes, carregando: true }; pintar();
      try {
        const r = await op.api(ROTA_RESUMO + '?inicio=' + mes + '-01&fim=' + ultimoDia(mes));
        if (!vivo || g !== geracaoDetalhe) return;
        if (!permitido()) { destruir(); return; }
        const dados = validarResumo(r, { inicio: mes + '-01', fim: ultimoDia(mes) });
        const meta = dados.meses.find(x => x.mes === mes);
        if (!meta || meta.corte_em !== fonte.corte_em || meta.revisao !== fonte.revisao ||
            ['total_observado', 'total_oficial', 'cobertura_completa', 'com_vinculo', 'sem_vinculo', 'com_pendencia_identificacao'].some(k => dados[k] !== fonte[k])) throw new Error('As bases do mês mudaram; recarregue a consulta.');
        estado.detalhe = { mes, dados };
      } catch (e) {
        if (!vivo || g !== geracaoDetalhe) return;
        if (!permitido()) { destruir(); return; }
        if (e && (e.status === 401 || e.status === 403)) { destruir(); if (op.expirada) op.expirada(); return; }
        estado.detalhe = { mes, erro: true };
      } finally { if (vivo && g === geracaoDetalhe) pintar(); }
    }
    async function carregarSemana(referencia) {
      if (!vivo) return;
      if (!permitido()) { destruir(); return; }
      const ref = diaValido(referencia) ? referencia : '', g = ++geracaoSemana;
      estado.semana = { referencia: ref, carregando: true }; pintar();
      try {
        const r = await op.api(ROTA_SEMANA + (ref ? '?referencia=' + ref : ''));
        if (!vivo || g !== geracaoSemana) return;
        if (!permitido()) { destruir(); return; }
        const dados = validarSemana(r, ref);
        estado.semana = { referencia: dados.referencia, dados };
      } catch (e) {
        if (!vivo || g !== geracaoSemana) return;
        if (!permitido()) { destruir(); return; }
        if (e && (e.status === 401 || e.status === 403)) { destruir(); if (op.expirada) op.expirada(); return; }
        estado.semana = { referencia: ref, erro: true };
      } finally { if (vivo && g === geracaoSemana) pintar(); }
    }
    function selecionar(ev) {
      if (!ev.target) return;
      if (ev.target.hasAttribute('data-lav-mes') && mesValido(ev.target.value)) { estado.mes = ev.target.value; estado.semAssociacao = false; carregarDetalhe(); pintar(); }
      else if (ev.target.hasAttribute('data-lav-referencia') && diaValido(ev.target.value)) carregarSemana(ev.target.value);
    }
    function clicar(ev) {
      if (!ev.target || !ev.target.closest) return;
      const botao = ev.target.closest('button');
      if (!botao || !botao.hasAttribute) return;
      if (botao.hasAttribute('data-lav-visao')) {
        estado.visao = botao.getAttribute('data-lav-visao') === 'semana' ? 'semana' : 'mes';
        if (estado.visao === 'semana' && !estado.semana.dados && !estado.semana.carregando) carregarSemana(estado.semana.referencia);
        pintar();
      } else if (botao.hasAttribute('data-lav-retry')) carregar();
      else if (botao.hasAttribute('data-lav-detalhe-retry')) carregar();
      else if (botao.hasAttribute('data-lav-semana-retry')) carregarSemana(estado.semana.referencia);
      else if (botao.hasAttribute('data-lav-atual')) carregarSemana();
      else if (botao.hasAttribute('data-lav-anterior') && diaValido(estado.semana.referencia)) carregarSemana(somarDias(estado.semana.referencia, -7));
    }
    const controle = { destruir, recarregar: carregar,
      snapshot: function (mes) {
        if (!vivo || !permitido()) return null;
        if (!mesValido(mes) || estado.semAssociacao || mes !== estado.mes) return { mes: mesValido(mes) ? mes : '', status: 'indisponivel', dados: null };
        const m = !estado.carregando && !estado.erro ? estado.dados.find(x => x.mes === mes) : null;
        return { mes: mes, status: estado.carregando ? 'carregando' : estado.erro ? 'indisponivel' : m ? 'conferido' : 'ausente', dados: m ? JSON.parse(JSON.stringify(m)) : null };
      },
      selecionar: function (mes, meses) {
        // A ponte financeira também emite o período em cliques que não o alteram.
        const mudou = (mes === null || mesValido(mes)) && mes !== mesRecebido;
        if (mudou) {
          mesRecebido = mes; estado.visao = 'mes';
          if (mes === null) { estado.mes = ''; estado.semAssociacao = true; }
          else { estado.mes = mes; estado.semAssociacao = false; }
          carregarDetalhe();
        }
        if (meses) estado.meses = meses.filter(mesValido); pintar();
      }
    };
    instancias.add(controle); host.addEventListener('change', selecionar); host.addEventListener('click', clicar);
    monitor = win.setInterval(function () { if (!permitido() || host.isConnected === false) destruir(); }, 500);
    carregar();
    return controle;
  }
  const api = { montar, validarResposta, validarResumo, validarSemana, renderizar, situacao, resumoExportacao, limparSessao: function () { [...instancias].forEach(i => i.destruir()); } };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GestaoLavrados = api;
})(typeof window !== 'undefined' ? window : globalThis);

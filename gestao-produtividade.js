/* Relatório privado: dados apenas na sessão; documento executado em origem opaca. */
(function (root) {
  'use strict';
  const ROTA = '/hub/gestao/produtividade-escrituras';
  const CHAVE = 'CN2O_MONTHS_V2';
  const LIMITE = 2 * 1024 * 1024;
  const SANDBOX = 'allow-scripts allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox';
  // Apenas adaptação de largura; tabelas mantêm suas colunas e rolam dentro do painel.
  const RESPONSIVO = '<style id="cn2o-produtividade-responsivo">@media(max-width:600px){' +
    'html,body{max-width:100%}.wrap{padding-left:16px;padding-right:16px;min-width:0}' +
    '.wrap.head-in{padding:28px 16px}.wrap.monthbar-in{padding:12px 16px}.monthbar{position:static}' +
    '.head-in>div,.head-actions,.mb-grp,.comp-box,.grid-3>div,.kpi,.anrow>div,.perfil,.cx-box{min-width:0;max-width:100%}' +
    '.head-in h1{font-size:26px;line-height:1.17;overflow-wrap:anywhere}.eyebrow{letter-spacing:.13em;font-size:10px;overflow-wrap:anywhere}' +
    '.head-actions{gap:8px}.head-actions button{max-width:100%;white-space:normal}' +
    '.mb-grp{width:100%;flex-wrap:wrap;gap:8px}.tabs,.subtabs{max-width:100%;overflow-x:auto}.tabs{width:100%}' +
    '.comp-box{width:100%}.comp-select{min-width:0;max-width:100%;flex:1}.badge-mode{max-width:100%;overflow-wrap:anywhere}' +
    '.grid-3,.an3 .anrow,.anrow,.cards{grid-template-columns:minmax(0,1fr)}.kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}' +
    '.kpi{padding:12px 10px}.kpi .val{font-size:19px;overflow-wrap:anywhere}.kpi .lbl,.kpi .det{overflow-wrap:anywhere}' +
    '.panel{min-width:0;max-width:100%;padding:14px}.panel.tight{padding:0;overflow-x:auto}.cx{flex-direction:column}' +
    '.cx-box+.cx-box{border-left:0;border-top:1px dashed var(--line)}.cx-box,.perfil{padding:18px}' +
    '.fn{grid-template-columns:minmax(0,1fr) auto;gap:8px}.fn-t{grid-column:1;grid-row:1}.fn-v{grid-column:2;grid-row:1;font-size:14px}.fn-b{grid-column:1/-1;grid-row:2}' +
    '.tools{max-width:100%;flex-wrap:wrap}.sec-head h2{min-width:0;overflow-wrap:anywhere}.tblock-head h2{font-size:24px}' +
    '.filtro{min-width:0}.filtro input,.filtro select{min-width:0!important;max-width:100%}.filtro input{width:100%}' +
    '.obs{padding:24px 18px}.anrow{padding:16px}.modal-bg{padding:12px}.modal-head,.modal-body{padding:18px}' +
    '.modal-head{gap:12px}.modal-head h3{min-width:0;font-size:18px}.modal-actions,.manage-item{flex-wrap:wrap;gap:10px}' +
    '.toast{left:12px;right:12px;bottom:12px;max-width:calc(100% - 24px);padding:12px}.toast svg{flex-shrink:0}' +
    'footer{overflow-wrap:anywhere}.btn-primary svg,.btn-download svg{flex-shrink:0}' +
    '}</style>';
  function jsonSeguro(valor) {
    return JSON.stringify(valor).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  }
  function validarMeses(valor) {
    if (valor === null) return null;
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Formato de meses inválido.');
    const texto = JSON.stringify(valor);
    if (texto.length > LIMITE) throw new Error('Os meses ultrapassam o limite de armazenamento.');
    const copia = JSON.parse(texto);
    function conferir(obj, nivel) {
      if (nivel > 20) throw new Error('Estrutura dos meses inválida.');
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach(function (k) {
        if (k === '__proto__' || k === 'prototype' || k === 'constructor') throw new Error('Estrutura dos meses inválida.');
        conferir(obj[k], nivel + 1);
      });
    }
    conferir(copia, 0);
    return copia;
  }
  function adaptador(config) {
    // Esta função é serializada para o iframe. Não referencia a sessão do Hub.
    'use strict';
    var chave = 'CN2O_MONTHS_V2';
    var atual = config.meses === null ? null : JSON.stringify(config.meses);
    function avisar() {
      parent.postMessage({ tipo: 'cn2o-produtividade-estado', canal: config.canal, chave: chave, valor: atual }, '*');
    }
    function informarPeriodo() {
      if (typeof M === 'undefined' || typeof CUR === 'undefined') return;
      var nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      function periodo(m) {
        var mes = m && nomes.indexOf(String(m.nome || '').toLowerCase());
        return m && mes >= 0 && /^\d{4}$/.test(String(m.ano)) ? m.ano + '-' + String(mes + 1).padStart(2, '0') : '';
      }
      var mes = periodo(M[CUR]);
      parent.postMessage({ tipo: 'cn2o-produtividade-periodo', canal: config.canal, mes: mes || null, meses: Object.keys(M).map(function (k) { return periodo(M[k]); }).filter(Boolean) }, '*');
    }
    function depoisDoControle() { if (typeof setTimeout === 'function') setTimeout(informarPeriodo, 0); }
    document.addEventListener('DOMContentLoaded', informarPeriodo);
    document.addEventListener('change', depoisDoControle);
    var memoria = {
      getItem: function (k) { return k === chave ? atual : null; },
      setItem: function (k, valor) {
        if (k !== chave) return;
        valor = String(valor);
        if (valor === atual) return;
        atual = valor; avisar();
      },
      removeItem: function (k) { if (k === chave) throw new Error('Use a opção Restaurar padrões do relatório para restaurar os meses.'); },
      clear: function () { this.removeItem(chave); },
      key: function (i) { return i === 0 && atual !== null ? chave : null; }
    };
    Object.defineProperty(memoria, 'length', { get: function () { return atual === null ? 0 : 1; } });
    Object.defineProperty(window, 'localStorage', { value: memoria, configurable: false });
    document.addEventListener('click', function (ev) {
      depoisDoControle();
      var botao = ev.target && ev.target.closest && ev.target.closest('button');
      if (botao && (botao.id === 'btnDownloadHtml' || botao.id === 'btnManageDownloadHtml')) {
        var ponte = document.getElementById('cn2o-produtividade-ponte');
        // O HTML exportado deve reabrir os meses atuais, nunca a cópia inicial da sessão.
        if (ponte) {
          var copia = { meses: atual === null ? null : JSON.parse(atual), canal: config.canal };
          var seguro = JSON.stringify(copia).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
          ponte.textContent = '(' + adaptador.toString() + ')(' + seguro + ');';
        }
      }
      var link = ev.target && ev.target.closest && ev.target.closest('a[href]');
      if (!link) return;
      var href = link.getAttribute('href') || '';
      if (href.indexOf('blob:') === 0 && link.hasAttribute('download')) return;
      if (href.charAt(0) === '#') return;
      try {
        var url = new URL(href);
        if (url.protocol !== 'https:' || url.hostname !== 'trello.com') { ev.preventDefault(); return; }
        link.target = '_blank'; link.rel = 'noopener noreferrer';
      } catch (_) { ev.preventDefault(); }
    }, true);
  }
  // Executada depois do script original. Esclarece o cruzamento sem recalcular o histórico.
  function esclarecerHistorico() {
    if (document.body && !document.getElementById('cn2o-aviso-exportacao-oficial')) {
      var aviso = document.createElement('p'); aviso.id = 'cn2o-aviso-exportacao-oficial';
      aviso.style.cssText = 'padding:14px 20px;margin:0;background:#631325;color:#fff;font:13px/1.6 sans-serif';
      aviso.textContent = 'Documento histórico: financeiro, cartões e senhas. A contagem oficial de escrituras lavradas está disponível na seção Gestão do Hub. A exportação deste HTML não incorpora a fonte oficial nem transforma cartões arquivados em escrituras lavradas.';
      document.body.insertBefore(aviso, document.body.firstChild);
    }
    function indicar(p) {
      var tabela = document.getElementById('tblFusao');
      if (!tabela || typeof M === 'undefined' || typeof CUR === 'undefined') return;
      var financeiro = M[CUR], fluxo = typeof PER_LBL !== 'undefined' && PER_LBL[p] ? PER_LBL[p] : 'período do histórico';
      var mes = financeiro ? financeiro.nome + '/' + financeiro.ano : 'período não informado';
      var nota = document.getElementById('cn2o-periodos-historicos');
      if (!nota) {
        nota = document.createElement('p'); nota.id = 'cn2o-periodos-historicos';
        nota.style.cssText = 'padding:12px 16px;margin:0;border-left:3px solid #631325;background:#f6eef0;color:#202a3a;font-size:13px;line-height:1.6';
        tabela.parentNode.insertBefore(nota, tabela);
      }
      nota.textContent = 'Fontes e períodos independentes: financeiro de ' + mes + '; cartões arquivados de ' + fluxo + '; senhas de setembro/2026. Os seletores não representam um único período. Este quadro histórico não é a contagem oficial de escrituras lavradas.';
      var th = tabela.querySelectorAll('thead th');
      if (th[2]) th[2].textContent = 'Lançamentos financeiros (' + mes + ')';
      if (th[3]) th[3].textContent = 'Cartões arquivados (' + fluxo + ')';
    }
    if (typeof tFusao === 'function') {
      var anterior = tFusao;
      tFusao = function (p) { anterior(p); indicar(p); };
      indicar(typeof TPER !== 'undefined' ? TPER : '');
    }
  }
  function prepararDocumento(html, meses, canal) {
    if (typeof html !== 'string' || !html.trim() || html.length > 4 * LIMITE) throw new Error('O relatório recebido está inválido.');
    const config = { meses: validarMeses(meses), canal: canal };
    const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";
    const preambulo = '<meta http-equiv="Content-Security-Policy" content="' + csp + '">' +
      '<meta name="referrer" content="no-referrer">' +
      '<script id="cn2o-produtividade-ponte">(' + adaptador.toString() + ')(' + jsonSeguro(config) + ');<\/script>';
    // Fontes locais de fallback mantêm o relatório independente de serviços externos.
    html = html.replace(/<link\b[^>]*>/gi, function (tag) { return /(?:https?:)?\/\//i.test(tag) ? '' : tag; });
    html = html.replace(/<base\b[^>]*>/gi, '');
    // A exportação pode conter a adaptação de uma sessão anterior: não duplicá-la.
    html = html.replace(/<script id="cn2o-historico-periodos">[\s\S]*?<\/script>/gi, '');
    const historico = /const\s+TRELLO_DATA\s*=/.test(html) ? '<script id="cn2o-historico-periodos">(' + esclarecerHistorico.toString() + ')();<\/script>' : '';
    if (/<head\b[^>]*>/i.test(html)) {
      html = html.replace(/<head\b[^>]*>/i, function (tag) { return tag + preambulo; });
      html = /<\/head\s*>/i.test(html) ? html.replace(/<\/head\s*>/i, RESPONSIVO + '</head>') : html + RESPONSIVO;
    } else html = '<!doctype html><html><head>' + preambulo + RESPONSIVO + '</head><body>' + html + '</body></html>';
    return /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, historico + '</body>') : html + historico;
  }
  function montar(op) {
    if (!op || !op.host || typeof op.api !== 'function' || typeof op.sessao !== 'function') throw new Error('Configuração do relatório incompleta.');
    const win = op.window || root, doc = op.document || op.host.ownerDocument || root.document;
    const host = op.host;
    let vivo = true, geracao = 0, frame = null, canal = '', revisao = null, dono = null;
    let pendente, ultimoSalvo = null, salvando = false, conflito = false, erroSalvar = false;
    let monitor = null, oficiais = null;
    const painel = doc.createElement('section'); painel.className = 'gestao-produtividade';
    const topo = doc.createElement('div'); topo.className = 'gestao-produtividade__topo';
    const titulo = doc.createElement('h3'); titulo.textContent = 'Produção oficial e histórico';
    const periodo = doc.createElement('p'); periodo.textContent = 'Confira as escrituras lavradas por mês na fonte oficial Extra Digital.';
    const aviso = doc.createElement('p'); aviso.className = 'gestao-produtividade__nota';
    aviso.textContent = 'O documento histórico conserva cartões, pesos de complexidade, dados financeiros e senhas de seus períodos originais. Cartões arquivados não substituem a contagem oficial de escrituras lavradas.';
    const status = doc.createElement('p'); status.className = 'gestao-produtividade__status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const tentar = doc.createElement('button'); tentar.type = 'button'; tentar.className = 'gestao-produtividade__tentar'; tentar.textContent = 'Tentar novamente'; tentar.hidden = true;
    const area = doc.createElement('div'); area.className = 'gestao-produtividade__area';
    const oficiaisHost = doc.createElement('div'); oficiaisHost.className = 'gestao-produtividade__oficiais';
    const historicoTitulo = doc.createElement('h3'); historicoTitulo.textContent = 'Documento histórico · financeiro, Trello e balcão';
    const historicoNota = doc.createElement('p'); historicoNota.className = 'gestao-produtividade__nota';
    historicoNota.textContent = 'Critérios originais do relatório. Os totais e rankings de cartões abaixo são históricos; consulte acima a conferência de escrituras lavradas. Não há conversão automática dos scores por cartão em pesos por ato.';
    topo.append(titulo, periodo, aviso, status, tentar); painel.append(topo, oficiaisHost, historicoTitulo, historicoNota, area); host.replaceChildren(painel);
    function sessao() { const s = op.sessao() || {}; return { token: s.token || '', login: s.login || '', admin: s.admin === true }; }
    function igual(a, b) { return a && b && a.token === b.token && a.login === b.login && a.admin === b.admin; }
    function permitido() { const s = sessao(); return !!s.token && !!s.login && s.admin; }
    function atual(g) { return vivo && g === geracao && permitido() && igual(dono, sessao()); }
    function ocupado() { return vivo && (salvando || pendente !== undefined); }
    function antesDeSair(ev) {
      if (atual(geracao) && ocupado()) { ev.preventDefault(); ev.returnValue = ''; }
    }
    function mostrar(texto, erro, retry) {
      if (!vivo) return;
      status.textContent = texto; status.classList.toggle('gestao-produtividade__status--erro', !!erro);
      tentar.hidden = !retry; tentar.textContent = conflito ? 'Reabrir versão salva' : 'Tentar novamente';
    }
    function apagarFrame() {
      if (frame) { frame.srcdoc = ''; frame.remove(); frame = null; }
      area.replaceChildren(); canal = '';
    }
    function destruir() {
      if (!vivo) return;
      vivo = false; geracao++; pendente = undefined; ultimoSalvo = null; dono = null; revisao = null;
      win.removeEventListener('message', receber);
      win.removeEventListener('beforeunload', antesDeSair);
      if (monitor !== null) win.clearInterval(monitor);
      if (oficiais) oficiais.destruir(); oficiais = null;
      apagarFrame(); painel.remove();
    }
    function expirar() { destruir(); if (op.expirada) op.expirada(); }
    function conferirSessao() { if (vivo && dono && (!permitido() || !igual(dono, sessao()))) expirar(); }
    function novoCanal() {
      const crypto = op.crypto || win.crypto;
      if (!crypto || !crypto.getRandomValues) throw new Error('Não foi possível iniciar o relatório com segurança.');
      return Array.from(crypto.getRandomValues(new Uint32Array(4)), function (v) { return v.toString(16).padStart(8, '0'); }).join('');
    }
    function statusHttp(e) { return Number(e && (e.status || e.statusCode || (e.response && e.response.status))); }
    async function carregar() {
      if (!vivo) return;
      if (!permitido()) { mostrar('Entre com uma conta autorizada para consultar este relatório.', true, false); return; }
      const fonteOficial = op.lavrados || root.GestaoLavrados;
      if (!oficiais && fonteOficial) oficiais = fonteOficial.montar({ host: oficiaisHost, api: op.api, sessao: op.sessao, expirada: op.expirada, window: win });
      const g = ++geracao; dono = sessao(); apagarFrame(); pendente = undefined; ultimoSalvo = null;
      revisao = null; salvando = false; conflito = false; erroSalvar = false;
      mostrar('Carregando relatório…', false, false);
      try {
        const resposta = await op.api(ROTA);
        if (!atual(g)) { conferirSessao(); return; }
        if (!resposta || !Number.isSafeInteger(resposta.revisao) || resposta.revisao < 1) throw new Error('Resposta do relatório inválida.');
        const meses = validarMeses(resposta.meses == null ? null : resposta.meses);
        canal = novoCanal();
        const documento = prepararDocumento(resposta.html, meses, canal);
        revisao = resposta.revisao; ultimoSalvo = JSON.stringify(meses);
        frame = doc.createElement('iframe'); frame.className = 'gestao-produtividade__frame'; frame.title = 'Relatório de produtividade de escrituras';
        frame.setAttribute('sandbox', SANDBOX); frame.setAttribute('referrerpolicy', 'no-referrer'); frame.srcdoc = documento;
        area.append(frame);
        mostrar('Relatório pronto. Alterações nos meses financeiros serão salvas no Hub.', false, false);
      } catch (e) {
        if (!atual(g)) { conferirSessao(); return; }
        if (statusHttp(e) === 401 || statusHttp(e) === 403) { expirar(); return; }
        mostrar('Não foi possível carregar o relatório. Tente novamente.', true, true);
      }
    }
    async function salvar() {
      if (!vivo || salvando || conflito || pendente === undefined || !atual(geracao)) return;
      const g = geracao, enviando = pendente;
      pendente = undefined; salvando = true; erroSalvar = false;
      mostrar('Salvando alterações dos meses financeiros…', false, false);
      try {
        const resposta = await op.api(ROTA + '/estado', { metodo: 'POST', corpo: { meses: JSON.parse(enviando), revisao: revisao } });
        if (!atual(g)) { conferirSessao(); return; }
        if (!resposta || !Number.isSafeInteger(resposta.revisao) || resposta.revisao <= revisao) throw new Error('Confirmação de salvamento inválida.');
        revisao = resposta.revisao; ultimoSalvo = enviando;
        if (pendente === ultimoSalvo) pendente = undefined;
        mostrar('Meses financeiros salvos no Hub.', false, false);
      } catch (e) {
        if (!atual(g)) { conferirSessao(); return; }
        if (pendente === undefined) pendente = enviando;
        if (statusHttp(e) === 401 || statusHttp(e) === 403) { expirar(); return; }
        conflito = statusHttp(e) === 409 || e.codigo === 'REVISAO_DESATUALIZADA'; erroSalvar = true;
        mostrar(conflito ? 'Há uma versão mais recente no Hub. Suas alterações permanecem neste relatório; exporte-as antes de reabrir a versão salva.' : 'Não foi possível salvar os meses financeiros. Suas alterações permanecem neste relatório. Tente novamente.', true, true);
      } finally {
        if (atual(g)) { salvando = false; if (!erroSalvar && pendente !== undefined) salvar(); }
      }
    }
    function receber(ev) {
      if (!vivo) return;
      if (!atual(geracao)) { conferirSessao(); return; }
      const msg = ev.data;
      if (!frame || ev.source !== frame.contentWindow || ev.origin !== 'null' || !msg || msg.canal !== canal) return;
      if (msg.tipo === 'cn2o-produtividade-periodo') {
        const formato = /^\d{4}-(0[1-9]|1[0-2])$/;
        if (oficiais && (msg.mes === null || formato.test(msg.mes || '')) && Array.isArray(msg.meses) && msg.meses.length <= 120 && msg.meses.every(m => typeof m === 'string' && formato.test(m))) oficiais.selecionar(msg.mes, msg.meses);
        return;
      }
      if (msg.tipo !== 'cn2o-produtividade-estado' || msg.chave !== CHAVE) return;
      try {
        if (msg.valor !== null && (typeof msg.valor !== 'string' || msg.valor.length > LIMITE)) throw new Error('Estado inválido.');
        const dados = validarMeses(msg.valor === null ? null : JSON.parse(msg.valor));
        if (dados === null) throw new Error('Use Restaurar padrões para restaurar os meses.');
        const serializado = JSON.stringify(dados);
        if (!salvando && serializado === ultimoSalvo) { pendente = undefined; return; }
        pendente = serializado;
        if (!conflito && !erroSalvar) salvar();
      } catch (_) { mostrar('Os meses recebidos não puderam ser salvos. Confira o arquivo importado.', true, false); }
    }
    tentar.addEventListener('click', function () {
      if (conflito) {
        if (win.confirm('Reabrir a versão salva no Hub? Alterações ainda não salvas neste relatório serão descartadas. Exporte-as antes, se necessário.')) carregar();
      } else if (erroSalvar && pendente !== undefined) { erroSalvar = false; salvar(); }
      else carregar();
    });
    win.addEventListener('message', receber);
    win.addEventListener('beforeunload', antesDeSair);
    monitor = win.setInterval(conferirSessao, 500);
    carregar();
    return { destruir: destruir, recarregar: carregar, ocupado: ocupado, podeSair: function () { return !ocupado(); } };
  }
  const api = { montar: montar, prepararDocumento: prepararDocumento, validarMeses: validarMeses, SANDBOX: SANDBOX };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GestaoProdutividade = api;
})(typeof window !== 'undefined' ? window : globalThis);

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const P = require('../gestao-produtividade.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const defer = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const html = '<!doctype html><html><head><title>Relatório</title><script>window.original=true;</script></head><body>Teste</body></html>';
const resposta = (extra = {}) => ({ html, meses: null, revisao: 1, ...extra });
const dados = n => ({ mes: { ano: '2026', total: n } });
function ambiente(apiExtra, extra = {}) {
  class El {
    constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.handlers = {}; this.classList = { toggle() {} }; if (tag === 'iframe') this.contentWindow = {}; }
    setAttribute(k, v) { this.attributes[k] = v; }
    append(...els) { els.forEach(el => { el.parent = this; this.children.push(el); }); }
    replaceChildren(...els) { this.children.forEach(el => { el.parent = null; }); this.children = []; this.append(...els); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(el => el !== this); this.parent = null; }
    addEventListener(k, fn) { this.handlers[k] = fn; }
    click() { if (this.handlers.click) this.handlers.click(); }
  }
  const doc = { createElement: tag => new El(tag) }, host = new El('div'); host.ownerDocument = doc;
  const session = { login: 'gestor', token: 'token-privado', admin: true }, events = {}, calls = [];
  let interval = null, expired = 0;
  const win = {
    crypto: { getRandomValues: arr => arr.fill(23) },
    addEventListener: (k, fn) => { events[k] = fn; }, removeEventListener: k => { delete events[k]; },
    setInterval: fn => { interval = fn; return 1; }, clearInterval: () => { interval = null; }, confirm: () => true
  };
  const op = { host, document: doc, window: win, sessao: () => session,
    api: async (path, config) => { calls.push({ path, config }); return apiExtra ? apiExtra(path, config) : resposta(); },
    expirada: () => expired++, ...extra };
  const controle = P.montar(op);
  const find = tag => { const walk = el => el.tagName === tag ? el : el.children.map(walk).find(Boolean); return walk(host); };
  const message = (value, patch = {}) => {
    const f = find('iframe');
    const canal = f.srcdoc.match(/"canal":"([^"]+)"/)[1];
    const e = { source: f.contentWindow, origin: 'null', data: { tipo: 'cn2o-produtividade-estado', chave: 'CN2O_MONTHS_V2', canal, valor: JSON.stringify(value) }, ...patch };
    if (events.message) events.message(e);
  };
  return { host, session, calls, controle, message, find, events, win, expired: () => expired, monitor: () => interval && interval() };
}
test('srcdoc isola rede, usa memória e não permite encerrar o script por dado importado', () => {
  const doc = P.prepararDocumento(html, { mes: { nome: '</script><script>roubar()</script>' } }, 'canal');
  assert.match(doc, /connect-src 'none'/); assert.match(doc, /base-uri 'none'/);
  assert.equal((doc.match(/<script\b/g) || []).length, 2);
  assert.match(doc, /\\u003c\/script>/);
  assert.ok(doc.indexOf('cn2o-produtividade-ponte') < doc.indexOf('window.original'));
  assert.doesNotMatch(P.SANDBOX, /allow-same-origin/);
  assert.match(P.SANDBOX, /allow-downloads/);
});
test('adaptador não grava na carga, deduplica mensagens e exporta o estado mais recente', () => {
  const doc = P.prepararDocumento(html, dados(1), 'aleatorio'), events = {}, enviados = [], ponte = {};
  const contexto = { parent: { postMessage: m => enviados.push(m) }, document: { addEventListener: (k, fn) => { events[k] = fn; }, getElementById: () => ponte }, URL };
  contexto.window = contexto;
  vm.runInNewContext(doc.match(/<script id="cn2o-produtividade-ponte">([\s\S]*?)<\/script>/)[1], contexto);
  assert.equal(enviados.length, 0); assert.equal(contexto.localStorage.getItem('outra-chave'), null);
  contexto.localStorage.setItem('CN2O_MONTHS_V2', JSON.stringify(dados(1))); assert.equal(enviados.length, 0);
  contexto.localStorage.setItem('CN2O_MONTHS_V2', JSON.stringify(dados(2))); assert.equal(enviados.length, 1);
  assert.throws(() => contexto.localStorage.removeItem('CN2O_MONTHS_V2'), /Restaurar/);
  events.click({ target: { closest: sel => sel === 'button' ? { id: 'btnDownloadHtml' } : null } });
  assert.match(ponte.textContent, /"total":2/);
});
test('fontes remotas são removidas e estruturas perigosas recusadas', () => {
  const result = P.prepararDocumento('<head><link href="https://fonts.googleapis.com/x"><base href="https://externo/"></head>', null, 'x');
  assert.doesNotMatch(result, /fonts\.googleapis|<base\b/);
  assert.throws(() => P.validarMeses(JSON.parse('{"__proto__":{}}')), /Estrutura/);
  assert.throws(() => P.validarMeses([]), /Formato/);
});
test('adaptação mobile vem após os estilos originais e mantém tabelas com rolagem própria', () => {
  const base = '<html><head><style>.fn{grid-template-columns:220px 1fr 170px}</style></head><body>teste</body></html>';
  const result = P.prepararDocumento(base, null, 'x');
  assert.ok(result.indexOf('cn2o-produtividade-responsivo') > result.indexOf('220px 1fr 170px'));
  assert.match(result, /@media\(max-width:600px\)/);
  assert.match(result, /\.panel\.tight\{padding:0;overflow-x:auto\}/);
  assert.doesNotMatch(result, /overflow-x:hidden/);
  assert.match(result, /<body>teste<\/body>/);
});
test('não consulta API sem administração autorizada', async () => {
  const a = ambiente(null, { sessao: () => ({ token: 'x', login: 'x', admin: false }) });
  await tick(); assert.equal(a.calls.length, 0); assert.equal(a.find('iframe'), undefined); a.controle.destruir();
});
test('carga não grava e não transmite token ou login ao documento', async () => {
  const a = ambiente(); await tick(); const f = a.find('iframe');
  assert.ok(f); assert.doesNotMatch(f.srcdoc, /token-privado|"login"/); assert.equal(a.calls.length, 1);
  assert.equal(f.attributes.sandbox, P.SANDBOX); a.controle.destruir();
});
test('logout durante GET descarta HTML e limpa listener', async () => {
  const d = defer(), a = ambiente(() => d.promise); a.session.token = ''; d.resolve(resposta()); await tick();
  assert.equal(a.find('iframe'), undefined); assert.equal(a.host.children.length, 0); assert.equal(a.events.message, undefined); assert.equal(a.expired(), 1);
});
test('destruir durante carga evita ressuscitar documento, e monitor detecta troca de pessoa', async () => {
  const d = defer(), a = ambiente(() => d.promise); a.controle.destruir(); d.resolve(resposta()); await tick(); assert.equal(a.host.children.length, 0);
  const b = ambiente(); await tick(); const f = b.find('iframe'); b.session.login = 'outra'; b.monitor(); assert.equal(f.srcdoc, ''); assert.equal(b.host.children.length, 0);
});
test('mensagens de outra janela, origem, chave ou canal não salvam', async () => {
  const a = ambiente(); await tick();
  a.message(dados(1), { source: {} }); a.message(dados(1), { origin: 'https://hub.exemplo' });
  a.message(dados(1), { data: { tipo: 'cn2o-produtividade-estado', canal: 'outro', chave: 'CN2O_MONTHS_V2', valor: '{}' } });
  await tick(); assert.equal(a.calls.length, 1); a.controle.destruir();
});
test('salva serialmente e usa a revisão confirmada sem perder a última edição', async () => {
  const saves = [], a = ambiente((path, config) => { if (!config) return resposta(); const d = defer(); saves.push({ ...d, config }); return d.promise; });
  await tick(); a.message(dados(1)); a.message(dados(2)); a.message(dados(3));
  assert.equal(saves.length, 1); assert.equal(saves[0].config.corpo.revisao, 1);
  saves[0].resolve({ revisao: 2 }); await tick(); assert.equal(saves.length, 2);
  assert.equal(saves[1].config.corpo.revisao, 2); assert.deepEqual(saves[1].config.corpo.meses, dados(3));
  saves[1].resolve({ revisao: 3 }); await tick(); a.message(dados(3)); assert.equal(saves.length, 2); a.controle.destruir();
});
test('falha de rede preserva alterações e retry reenvia a mais recente', async () => {
  let n = 0; const a = ambiente((path, config) => { if (!config) return resposta(); if (++n === 1) throw new Error('rede'); return { revisao: 2 }; });
  await tick(); a.message(dados(1)); await tick(); a.message(dados(2)); await tick(); assert.equal(n, 1);
  a.find('button').click(); await tick(); assert.equal(n, 2); assert.deepEqual(a.calls[2].config.corpo.meses, dados(2)); a.controle.destruir();
});
test('409 interrompe salvamentos até reabrir, sem sobrescrever versão nova', async () => {
  let n = 0; const a = ambiente((path, config) => { if (!config) return resposta(); n++; throw Object.assign(new Error('conflito'), { status: 409 }); });
  await tick(); a.message(dados(1)); await tick(); a.message(dados(2)); await tick(); assert.equal(n, 1);
  assert.equal(a.find('button').textContent, 'Reabrir versão salva');
  a.win.confirm = () => false; a.find('button').click(); await tick(); assert.equal(a.calls.length, 2);
  a.win.confirm = () => true; a.find('button').click(); await tick(); assert.equal(a.calls.length, 3); assert.equal(n, 1); a.controle.destruir();
});
test('logout durante POST impede gravação da fila e remove relatório privado', async () => {
  const d = defer(); const a = ambiente((path, config) => config ? d.promise : resposta());
  await tick(); a.message(dados(1)); a.message(dados(2)); a.session.token = ''; d.resolve({ revisao: 2 }); await tick();
  assert.equal(a.calls.length, 2); assert.equal(a.host.children.length, 0);
});
test('impede sair com alteração em trânsito ou pendente e libera ao salvar; logout limpa a proteção', async () => {
  const d = defer(), a = ambiente((path, config) => config ? d.promise : resposta());
  await tick(); assert.equal(a.controle.podeSair(), true);
  a.message(dados(1)); assert.equal(a.controle.ocupado(), true); assert.equal(a.controle.podeSair(), false);
  let impedido = false; const ev = { preventDefault() { impedido = true; } };
  a.events.beforeunload(ev); assert.equal(impedido, true); assert.equal(ev.returnValue, '');
  d.resolve({ revisao: 2 }); await tick(); assert.equal(a.controle.podeSair(), true);
  impedido = false; a.events.beforeunload(ev); assert.equal(impedido, false);
  a.controle.destruir(); assert.equal(a.events.beforeunload, undefined); assert.equal(a.controle.ocupado(), false);
});
test('estado pendente após falha mantém proteção de navegação', async () => {
  const a = ambiente((path, config) => { if (config) throw new Error('rede'); return resposta(); });
  await tick(); a.message(dados(1)); await tick(); assert.equal(a.controle.podeSair(), false); a.controle.destruir();
});
test('erro de carregamento permite nova tentativa sem HTML residual', async () => {
  let n = 0; const a = ambiente(() => { if (++n === 1) throw new Error('rede'); return resposta(); });
  await tick(); assert.equal(a.find('iframe'), undefined); assert.equal(a.find('button').hidden, false);
  a.find('button').click(); await tick(); assert.ok(a.find('iframe')); a.controle.destruir();
});

'use strict';
// Runs the actual inline navigation/filter handlers in a Node VM.
// The small DOM fixture models only APIs those handlers use; no server or browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
function between(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'Real source segment must exist: ' + start);
  return html.slice(a, b);
}
const configCode = between('const CONFIG = {', '// Se o hub for aberto dentro');
const navCode = between('const PAGINAS = [', 'const TAGS_OK =');
const leafHandlers = between("el('cardProtocolo').addEventListener", "el('cardClausulas').addEventListener");
const backHandlers = between("document.querySelectorAll('[data-voltar]').forEach", 'montarFerramenta({');
const filterCode = between('function filtrarHub(txt)', 'preencherData();');

class Element {
  constructor(tag, attrs = {}, parent = null) {
    this.tag = tag; this.attrs = attrs; this.id = attrs.id || ''; this.parent = parent;
    this.children = []; this.events = {}; this.dataset = {}; this.hidden = 'hidden' in attrs;
    for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) this.dataset[key.slice(5)] = value;
    const classes = new Set((attrs.class || '').split(/\s+/));
    this.classList = { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name),
      toggle: (name, force) => { const add = force === undefined ? !classes.has(name) : force; if (add) classes.add(name); else classes.delete(name); return add; } };
  }
  get textContent() { return this.overrideText === undefined ? this.children.map(x => typeof x === 'string' ? x : x.textContent).join('') : this.overrideText; }
  set textContent(text) { this.overrideText = String(text); }
  descendants() { return this.children.flatMap(x => typeof x === 'string' ? [] : [x, ...x.descendants()]); }
  querySelectorAll(selector) {
    if (selector === '[data-voltar]') return this.descendants().filter(x => 'data-voltar' in x.attrs);
    if (selector === '[data-gestao-rel]') return this.descendants().filter(x => 'data-gestao-rel' in x.attrs);
    if (selector === '.carregando') return this.descendants().filter(x => x.className === 'carregando');
    if (selector === '[aria-label]') return this.descendants().filter(x => 'aria-label' in x.attrs);
    if (selector === '.card-acao') return this.descendants().filter(x => x.classList.contains('card-acao'));
    if (selector === 'input, textarea') return this.descendants().filter(x => ['input', 'textarea'].includes(x.tag));
    if (selector === '#segModo button[aria-pressed="true"]') return this.descendants().filter(x => x.tag === 'button' && x.attrs['aria-pressed'] === 'true');
    return this.descendants().filter(x => x.tag === selector);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getAttribute(name) { return this.attrs[name] || null; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  appendChild(node) { node.parent = this; this.children.push(node); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
  addEventListener(name, fn) { (this.events[name] ||= []).push(fn); }
  click() { for (const fn of this.events.click || []) fn({ target: this }); }
  focus() { this.focused = true; }
}
function dom() {
  const root = new Element('root'), stack = [root], ids = new Map(), duplicates = [];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  for (const [token] of markup.matchAll(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g)) {
    if (token.startsWith('<!--')) continue;
    const close = token.match(/^<\/([\w-]+)/);
    if (close) { for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === close[1].toLowerCase()) { stack.length = i; break; } continue; }
    const open = token.match(/^<([\w-]+)([\s\S]*?)\/?\s*>$/);
    if (!open) { stack.at(-1).children.push(token); continue; }
    const attrs = {};
    for (const m of open[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
    const element = new Element(open[1].toLowerCase(), attrs, stack.at(-1));
    stack.at(-1).children.push(element);
    if (element.id) { if (ids.has(element.id)) duplicates.push(element.id); ids.set(element.id, element); }
    if (!voidTags.has(element.tag) && !token.endsWith('/>')) stack.push(element);
  }
  return { root, ids, duplicates };
}
function harness(login = 'colaborador.teste', admin = false) {
  const d = dom(), winEvents = {}, messages = [], openings = [], acervoCalls = [];
  const el = id => { assert.ok(d.ids.has(id), 'Actual HTML element is required: ' + id); return d.ids.get(id); };
  const homeCards = () => el('secFerramentas').descendants().filter(x => x.classList.contains('card'));
  const usefulLinks = () => el('linksUteis').descendants().filter(x => x.classList.contains('link-item'));
  const document = {
    createElement: tag => new Element(tag), getElementById: el,
    querySelectorAll(selector) {
      if (selector === '[data-voltar]' || selector === '[data-gestao-rel]') return d.root.querySelectorAll(selector);
      if (selector === '#secFerramentas .card, #linksUteis .link-item') return [...homeCards(), ...usefulLinks()];
      throw new Error('Unsupported selector in real code: ' + selector);
    }
  };
  const location = { hash: '', pathname: '/', search: '', replace(url) { this.replaced = url; } };
  const entries = [{ state: { rota: '' }, url: '/' }]; let cursor = 0;
  const history = { pushState(state, _unused, url) { entries.splice(++cursor); entries.push({ state, url }); location.hash = url.includes('#') ? url.slice(url.indexOf('#')) : ''; } };
  const window = { scrollTo() {}, addEventListener(name, fn) { (winEvents[name] ||= []).push(fn); } };
  const ctx = vm.createContext({ document, window, location, history, el, SESSAO: { login, admin },
    registrarAbertura: route => openings.push(route), marcarNav() {}, toast: text => messages.push(text),
    acervoAoAbrir: value => acervoCalls.push(value), setTimeout: fn => { fn(); return 0; } });
  vm.runInContext(configCode + navCode + leafHandlers + backHandlers + filterCode + '\naplicarLinks();', ctx);
  el('app').hidden = false;
  const run = code => vm.runInContext(code, ctx);
  run("mostrarPagina('paginaHub', true)");
  function travel(delta) {
    const next = cursor + delta; assert.ok(next >= 0 && next < entries.length);
    cursor = next; const entry = entries[cursor]; location.hash = entry.url.includes('#') ? entry.url.slice(entry.url.indexOf('#')) : '';
    for (const fn of winEvents.popstate || []) fn({ state: entry.state });
  }
  return { ...d, el, run, location, messages, openings, acervoCalls, homeCards, usefulLinks,
    page: () => run('paginaAtual()'), back: () => el(run('paginaAtual()')).querySelector('[data-voltar]').click(),
    backText: () => el(run('paginaAtual()')).querySelector('[data-voltar]').textContent,
    browserBack: () => travel(-1), browserForward: () => travel(1), historySize: () => entries.length };
}

test('static HTML has unique IDs; home drops three cards and both groups retain original leaf IDs', () => {
  const h = harness(); assert.deepEqual(h.duplicates, []);
  assert.equal(h.homeCards().length, 7, '10 original top-level cards minus 5 leaves plus 2 groups');
  assert.deepEqual(h.homeCards().map(x => x.id), ['cardProtocolo','cardCalculadoras','cardIA','cardClausulas','cardConsultas','cardItbi','cardDespesas']);
  const leaves = id => h.el(id).descendants().filter(x => x.classList.contains('card')).map(x => x.id);
  assert.deepEqual(leaves('paginaConsultas'), ['cardConsulta','cardAcervo','cardPastas']);
  assert.deepEqual(leaves('paginaCalculadoras'), ['cardCalculadora','cardItcmd']);
});

for (const [group, parent, card, leaf, route, backText] of [
  ['cardConsultas','paginaConsultas','cardConsulta','paginaConsulta','consulta','← Voltar às consultas'],
  ['cardConsultas','paginaConsultas','cardAcervo','paginaAcervo','acervo','← Voltar às consultas'],
  ['cardConsultas','paginaConsultas','cardPastas','paginaEmbutida','pastas','← Voltar às consultas'],
  ['cardCalculadoras','paginaCalculadoras','cardCalculadora','paginaEmbutida','calculadora','← Voltar às calculadoras'],
  ['cardCalculadoras','paginaCalculadoras','cardItcmd','paginaItcmd','itcmd','← Voltar às calculadoras'],
]) test('click, leaf and contextual back: ' + route, () => {
  const h = harness(); h.el(group).click(); assert.equal(h.page(), parent); assert.ok(h.el(parent).querySelector('h2').focused);
  h.el(card).click(); assert.equal(h.page(), leaf); assert.equal(h.location.hash, '#' + route); assert.equal(h.backText(), backText);
  h.back(); assert.equal(h.page(), parent); assert.equal(h.backText(), '← Voltar ao hub'); h.back(); assert.equal(h.page(), 'paginaHub');
});

for (const [route, page, parent] of [
  ['consultas','paginaConsultas','paginaHub'], ['calculadoras','paginaCalculadoras','paginaHub'],
  ['consulta','paginaConsulta','paginaConsultas'], ['acervo','paginaAcervo','paginaConsultas'],
  ['acervo=antigo1','paginaAcervo','paginaConsultas'], ['acervo=cn2o','paginaAcervo','paginaConsultas'],
  ['pastas','paginaEmbutida','paginaConsultas'], ['calculadora','paginaEmbutida','paginaCalculadoras'],
  ['itcmd','paginaItcmd','paginaCalculadoras'], ['protocolo','paginaEmbutida','paginaHub'], ['agenda','paginaEmbutida','paginaHub'],
]) test('existing and new deep link: #' + route, () => {
  const h = harness(); h.location.hash = '#' + route; const length = h.historySize(); h.run('abrirPorEndereco()');
  assert.equal(h.page(), page); assert.equal(h.historySize(), length); h.back(); assert.equal(h.page(), parent);
  if (route.startsWith('acervo=')) assert.equal(h.acervoCalls[0], route.slice(7));
});

test('browser back and forward recover group context without adding history entries', () => {
  const h = harness(); h.el('cardConsultas').click(); h.el('cardConsulta').click(); const length = h.historySize();
  h.browserBack(); assert.equal(h.page(), 'paginaConsultas'); h.browserForward(); assert.equal(h.page(), 'paginaConsulta');
  assert.equal(h.historySize(), length); assert.equal(h.backText(), '← Voltar às consultas'); h.back(); assert.equal(h.page(), 'paginaConsultas');
});

test('switching embedded leaves changes return group and reuses the iframe', () => {
  const h = harness(); h.run("abrirRota('pastas')"); assert.equal(h.backText(), '← Voltar às consultas');
  h.run("abrirRota('calculadora')"); assert.equal(h.backText(), '← Voltar às calculadoras');
  h.run("abrirRota('pastas')"); assert.equal(h.backText(), '← Voltar às consultas');
  assert.equal(h.el('molduraEmbutida').children.filter(x => x.tag === 'iframe').length, 2);
});

for (const [card, route, page] of [['cardExtrator','extrator','paginaExtrator'],['cardAnalisador','analista','paginaAnalisador'],['cardRedator','redator','paginaRedator']]) {
  test('legacy IA grouping and direct link remain distinct: ' + route, () => {
    const h = harness(); h.el('cardIA').click(); h.el(card).click(); assert.equal(h.page(), page); assert.equal(h.backText(), '← Voltar aos assistentes');
    h.back(); assert.equal(h.page(), 'paginaIA'); h.back(); assert.equal(h.page(), 'paginaHub');
    h.run('abrirRota(' + JSON.stringify(route) + ')'); assert.equal(h.backText(), '← Voltar ao hub'); h.back(); assert.equal(h.page(), 'paginaHub');
  });
}

test('legacy unpublished minute generator still rejects non-admin and allows admin', () => {
  const h = harness(); h.run("abrirRota('minutas')"); assert.equal(h.page(), 'paginaHub'); assert.ok(h.messages.some(x => x.includes('em breve')));
  const admin = harness('cesar.bravo', true); admin.el('cardIA').click(); admin.el('cardMinutas').click(); assert.equal(admin.page(), 'paginaMinutas'); admin.back(); assert.equal(admin.page(), 'paginaIA');
});

test('search finds moved leaf text through parent cards and resets without exposing expenses', () => {
  const h = harness();
  for (const [query, card] of [['T-Consulta','cardConsultas'],['Ficheiro de Pastas','cardConsultas'],['digitalizado','cardConsultas'],['ITCMD','cardCalculadoras'],['Emdagro','cardCalculadoras'],['emolumentos','cardCalculadoras']]) {
    h.run('filtrarHub(' + JSON.stringify(query) + ')'); assert.equal(h.el(card).hidden, false, query); assert.equal(h.el('cardDespesas').hidden, true);
  }
  h.run("filtrarHub('termo-ausente-xyz')"); assert.ok(h.homeCards().every(x => x.hidden));
  h.run("filtrarHub('')"); assert.equal(h.homeCards().filter(x => !x.hidden).length, 6); assert.equal(h.el('cardDespesas').hidden, true);
  assert.ok(h.usefulLinks().every(x => !x.hidden));
});

test('expenses route and search keep existing two-user restriction', () => {
  const h = harness(); h.run("abrirRota('despesas')"); assert.equal(h.page(), 'paginaHub'); assert.ok(h.messages.some(x => x.includes('Acesso exclusivo')));
  h.run("filtrarHub('despesas')"); assert.equal(h.el('cardDespesas').hidden, true);
  for (const login of ['cesar.bravo', 'jonas.aragao']) {
    const allowed = harness(login); allowed.run("filtrarHub('despesas')"); assert.equal(allowed.el('cardDespesas').hidden, false);
    allowed.run("abrirRota('despesas')"); assert.equal(allowed.page(), 'paginaEmbutida'); assert.equal(allowed.backText(), '← Voltar ao hub');
  }
});

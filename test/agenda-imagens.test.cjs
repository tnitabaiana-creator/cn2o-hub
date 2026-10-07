'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const A = require('../agenda-imagens.js');
const dia = '2026-10-07';
const meta = n => ({ mime: 'image/png', bytes: 100, versao: 'v' + n });
const adiar = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const esvaziar = () => new Promise(resolve => setImmediate(resolve));
function botao() { return { listeners: {}, addEventListener(t, fn) { this.listeners[t] = fn; }, click() { if (this.listeners.click) this.listeners.click({}); } }; }
function ambiente(extra = {}) {
  const session = { login: 'pessoa.a', token: 'token-a' }, revoked = [], calls = [], boxes = [];
  let serial = 0;
  const doc = { querySelectorAll: () => boxes, querySelector: () => null };
  const op = { document: doc, URL: { createObjectURL: () => 'blob:' + ++serial, revokeObjectURL: s => revoked.push(s) },
    getSession: () => session, getEndpoint: () => 'https://backend.exemplo',
    preparar: async () => ({ mime: 'image/png', base64: 'aQ==' }),
    request: async (url, opts) => { calls.push({ url, opts }); return { imagem: opts.corpo.imagem ? meta(calls.length) : null }; },
    fetch: async (url, opts) => { calls.push({ url, opts }); return { ok: true, blob: async () => new Blob(['print'], { type: 'image/png' }) }; }, ...extra };
  const api = A.criar(op);
  function box(k = dia + '|7') {
    const b = { dataset: { maImagem: k }, elems: {}, replaceChildren() { this.innerHTML = ''; },
      set innerHTML(s) { this.html = s; this.elems = {}; }, get innerHTML() { return this.html; },
      querySelector(sel) {
        if (sel === '[data-img-remover]' && !this.html.includes('data-img-remover')) return null;
        if (sel === '[data-img-ampliar]' && !this.html.includes('data-img-ampliar')) return null;
        if (sel === '[data-img-recarregar]' && !this.html.includes('data-img-recarregar')) return null;
        if (!this.elems[sel]) this.elems[sel] = { ...botao(), querySelector: () => ({}) };
        return this.elems[sel];
      } };
    boxes.push(b); return b;
  }
  return { api, session, revoked, calls, doc, op, boxes, box };
}
test('aceita prints PNG/JPEG/WebP e rejeita SVG, vazios e originais maiores que 20 MB', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) assert.doesNotThrow(() => A.validarArquivo({ type, size: 256 }));
  assert.throws(() => A.validarArquivo({ type: 'image/svg+xml', size: 10 }), /PNG/);
  assert.throws(() => A.validarArquivo({ type: 'image/png', size: 0 }), /20 MB/);
  assert.throws(() => A.validarArquivo({ type: 'image/png', size: A.MAX_ORIGINAL + 1 }), /20 MB/);
});
test('redimensiona proporcionalmente sem ampliar prints pequenos', () => {
  assert.deepEqual(A.dimensoes(3840, 2160), { largura: 2560, altura: 1440 });
  assert.deepEqual(A.dimensoes(400, 200), { largura: 400, altura: 200 });
  assert.deepEqual(A.dimensoes(600, 3600), { largura: 427, altura: 2560 });
  assert.throws(() => A.dimensoes(0, 2));
});
test('metadados de imagem sem texto sobrevivem ao período e ausência posterior remove', () => {
  const { api } = ambiente();
  api.receberPeriodo(dia, dia, [{ dia, faixa: 7, texto: '', imagem: meta(1) }], api.capturar());
  assert.equal(api.tem(dia, 7), true); assert.deepEqual(api.chaves(), [dia + '|7']);
  api.receberPeriodo(dia, dia, [], api.capturar()); assert.equal(api.tem(dia, 7), false);
});
test('período que começou antes do upload não apaga imagem recém-salva', async () => {
  const { api } = ambiente(); const antigo = api.capturar();
  await api.salvar(dia, 7, {}); api.receberPeriodo(dia, dia, [], antigo);
  assert.equal(api.tem(dia, 7), true);
});
test('período antigo não ressuscita imagem removida', async () => {
  const { api } = ambiente();
  api.receberPeriodo(dia, dia, [{ dia, faixa: 7, imagem: meta(1) }], api.capturar());
  const antigo = api.capturar(); await api.salvar(dia, 7, null);
  api.receberPeriodo(dia, dia, [{ dia, faixa: 7, imagem: meta(1) }], antigo);
  assert.equal(api.tem(dia, 7), false);
});
test('upload usa rota separada e nunca inclui ou apaga texto', async () => {
  const { api, calls } = ambiente(); await api.salvar(dia, 7, {});
  assert.equal(calls[0].url, '/hub/agenda/imagem');
  assert.deepEqual(calls[0].opts.corpo, { dia, faixa: 7, imagem: { mime: 'image/png', base64: 'aQ==' } });
  assert.equal(calls[0].opts.semRedirecionar, true);
});
test('bloqueia upload concorrente da mesma célula e permite outras', async () => {
  const wait = adiar(); let n = 0;
  const { api } = ambiente({ request: async () => { n++; await wait.promise; return { imagem: meta(n) }; } });
  const a = api.salvar(dia, 7, {}); await esvaziar();
  assert.equal(api.ocupado(), true); const b = api.salvar(dia, 7, {}), c = api.salvar(dia, 8, {});
  await esvaziar(); assert.equal(n, 2); wait.resolve(); await Promise.all([a, b, c]);
  assert.equal(api.ocupado(), false);
});
test('logout durante preparação impede envio e período antigo é descartado', async () => {
  const wait = adiar(); const { api, calls } = ambiente({ preparar: () => wait.promise });
  const ticket = api.capturar(), save = api.salvar(dia, 7, {});
  api.reset(); wait.resolve({ mime: 'image/png', base64: 'aQ==' }); await save;
  assert.equal(calls.length, 0); api.receberPeriodo(dia, dia, [{ dia, faixa: 7, imagem: meta(1) }], ticket);
  assert.deepEqual(api.chaves(), []);
});
test('resposta de upload após troca de pessoa não entra na sessão nova', async () => {
  const wait = adiar(); const { api, session } = ambiente({ request: () => wait.promise });
  const save = api.salvar(dia, 7, {}); await esvaziar(); session.login = 'pessoa.b'; session.token = 'token-b';
  api.capturar(); wait.resolve({ imagem: meta(1) }); await save; assert.deepEqual(api.chaves(), []);
});
test('prévia usa X-Auth-Token, no-store e blob local revogado no logout', async () => {
  const { api, calls, box, revoked } = ambiente(); box();
  api.receberPeriodo(dia, dia, [{ dia, faixa: 7, imagem: meta(1) }], api.capturar()); await esvaziar();
  assert.equal(calls.length, 1); assert.equal(calls[0].opts.headers['X-Auth-Token'], 'token-a');
  assert.equal(calls[0].opts.cache, 'no-store'); assert.equal(calls[0].url.includes('token'), false);
  api.reset(); assert.deepEqual(revoked, ['blob:1']); assert.equal(calls[0].opts.signal.aborted, false);
});
test('resposta binária tardia após logout não cria blob', async () => {
  const wait = adiar(); const { api, box, revoked, calls } = ambiente({ fetch: async (url, opts) => { calls.push({ url, opts }); await wait.promise; return { ok: true, blob: async () => new Blob(['print'], { type: 'image/png' }) }; } });
  box(); api.receberPeriodo(dia, dia, [{ dia, faixa: 7, imagem: meta(1) }], api.capturar());
  api.reset(); assert.equal(calls[0].opts.signal.aborted, true); wait.resolve(); await esvaziar(); assert.deepEqual(revoked, []);
});
test('trocar imagem revoga URL anterior e baixa a nova versão', async () => {
  const { api, box, revoked, calls } = ambiente(); box();
  api.receberPeriodo(dia, dia, [{ dia, faixa: 7, imagem: meta(1) }], api.capturar()); await esvaziar();
  api.receberPeriodo(dia, dia, [{ dia, faixa: 7, imagem: meta(2) }], api.capturar()); await esvaziar();
  assert.deepEqual(revoked, ['blob:1']); assert.equal(calls.length, 2);
});
test('erro de download antigo não contamina imagem substituída nem encerra sessão', async () => {
  const old = adiar(), newer = adiar(); let n = 0, expired = 0;
  const { api, box } = ambiente({ fetch: () => (++n === 1 ? old.promise : newer.promise), onExpired: () => expired++ }); const b = box();
  api.receberPeriodo(dia, dia, [{ dia, faixa: 7, imagem: meta(1) }], api.capturar());
  api.receberPeriodo(dia, dia, [{ dia, faixa: 7, imagem: meta(2) }], api.capturar());
  old.resolve({ ok: false, status: 401 }); await esvaziar();
  assert.equal(expired, 0); assert.doesNotMatch(b.html, /Não foi possível/);
  newer.resolve({ ok: true, blob: async () => new Blob(['print'], { type: 'image/png' }) }); await esvaziar();
  assert.match(b.html, /<img/); assert.equal(n, 2);
});
test('prévia rejeita MIME impróprio e não cria URL', async () => {
  const { api, box, revoked } = ambiente({ fetch: async () => ({ ok: true, blob: async () => new Blob(['<svg/>'], { type: 'image/svg+xml' }) }) }); const b = box();
  api.receberPeriodo(dia, dia, [{ dia, faixa: 7, imagem: meta(1) }], api.capturar()); await esvaziar();
  assert.match(b.html, /não é válida/); api.reset(); assert.deepEqual(revoked, []);
});
test('colagem de texto não é interceptada; print dispara upload da célula', async () => {
  const { api, calls } = ambiente(); const ta = { ...botao(), dataset: { maDia: dia, maFaixa: '7' } };
  api.ligar({ querySelectorAll: () => [ta] }); let prevented = 0;
  ta.listeners.paste({ clipboardData: { items: [{ kind: 'string', type: 'text/plain' }] }, preventDefault() { prevented++; } });
  assert.equal(prevented, 0); assert.equal(calls.length, 0);
  ta.listeners.paste({ clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => ({}) }] }, preventDefault() { prevented++; } });
  await esvaziar(); assert.equal(prevented, 1); assert.equal(calls.length, 1); assert.equal(calls[0].opts.corpo.faixa, 7);
});
test('colagem por cima de imagem requer confirmação e recusa preserva a existente', async () => {
  const { api, calls } = ambiente({ confirm: () => false });
  api.receberPeriodo(dia, dia, [{ dia, faixa: 7, imagem: meta(1) }], api.capturar());
  const ta = { ...botao(), dataset: { maDia: dia, maFaixa: '7' } }; api.ligar({ querySelectorAll: () => [ta] });
  ta.listeners.paste({ clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => ({}) }] }, preventDefault() {} });
  await esvaziar(); assert.equal(calls.length, 0); assert.equal(api.tem(dia, 7), true);
});
test('erro de upload preserva imagem anterior e libera nova tentativa', async () => {
  const { api } = ambiente({ request: async () => { throw new Error('Offline'); } });
  api.receberPeriodo(dia, dia, [{ dia, faixa: 7, imagem: meta(1) }], api.capturar());
  await api.salvar(dia, 7, {}); assert.equal(api.tem(dia, 7), true); assert.equal(api.ocupado(), false);
});
test('scripts inline do Hub permanecem sintaticamente válidos', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8'); let n = 0;
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) { if (m[1].trim()) { new vm.Script(m[1]); n++; } }
  assert.ok(n >= 2);
});
test('integração com resumo e Próximos inclui prints sem texto', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const trecho = html.slice(html.indexOf('const MA_FAIXAS ='), html.indexOf('const NT_ESPERA_MS ='));
  const env = { AgendaImagens: A, SESSAO: { token: 'a', login: 'a' }, CONFIG: { endpoint: '/api' },
    document: { querySelectorAll: () => [], querySelector: () => null }, window: { addEventListener() {} },
    URL, fetch: async () => {}, api: async () => ({}), esc: s => s, sessaoExpirada() {}, el: () => null,
    dd: n => String(n).padStart(2, '0'), setTimeout, clearTimeout, Date, Set, Map };
  env.AgendaImagens = { criar: op => A.criar({ ...op, document: env.document }) };
  vm.createContext(env); vm.runInContext(trecho, env);
  vm.runInContext(`MA_IMAGENS.receberPeriodo('${dia}', '${dia}', [{dia:'${dia}', faixa:7, imagem:{versao:'1'}}], MA_IMAGENS.capturar())`, env);
  assert.equal(vm.runInContext(`maItensDoDia('${dia}')[0].texto`, env), 'Print anexado');
  assert.equal(vm.runInContext(`maProximos('2026-10-06','2026-12-06',null)[0].itens[0].texto`, env), 'Print anexado');
  vm.runInContext(`MA.itens['${dia}|7'] = 'Conferir pagamento'`, env);
  assert.equal(vm.runInContext(`maItensDoDia('${dia}')[0].texto`, env), 'Conferir pagamento · Print anexado');
});
test('GET antigo com 401 não encerra a nova sessão nem marca a semana como carregada', async () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const trecho = html.slice(html.indexOf('const MA_FAIXAS ='), html.indexOf('const NT_ESPERA_MS ='));
  const wait = adiar(); let expired = 0, opts;
  const env = { SESSAO: { token: 'a', login: 'a' }, CONFIG: { endpoint: '/api' },
    document: { querySelectorAll: () => [], querySelector: () => null }, window: { addEventListener() {} },
    URL, fetch: async () => {}, api: async (url, op) => { opts = op; return wait.promise; }, esc: s => s, sessaoExpirada: () => expired++, el: () => null,
    dd: n => String(n).padStart(2, '0'), setTimeout, clearTimeout, Date, Set, Map };
  env.AgendaImagens = { criar: op => A.criar({ ...op, document: env.document }) };
  vm.createContext(env); vm.runInContext(trecho, env);
  const request = vm.runInContext("maCarregarSemana(new Date(2026,9,5),true)", env);
  assert.equal(opts.semRedirecionar, true);
  env.SESSAO.token = 'b'; env.SESSAO.login = 'b'; vm.runInContext('maReiniciarEstado()', env);
  wait.reject({ status: 401 }); await request;
  assert.equal(expired, 0); assert.equal(vm.runInContext('Object.keys(MA.semanas).length', env), 0);
});
function preparador(codificar, falhar) {
  const canvas = { width: 0, height: 0, getContext() { return { drawImage() {}, fillRect() {} }; },
    toBlob(callback, tipo, qualidade) { callback(codificar(tipo, qualidade)); } };
  const ctx = { module: { exports: {} }, document: { createElement: () => canvas },
    createImageBitmap: async () => { if (falhar) throw new Error('The source image could not be decoded.'); return { width: 3840, height: 2160, close() {} }; },
    FileReader: class { readAsDataURL(blob) { this.result = 'data:' + blob.type + ';base64,cHJpbnQ='; this.onload(); } } };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '../agenda-imagens.js'), 'utf8'), ctx);
  return { api: ctx.module.exports, canvas };
}
test('preparação preserva PNG pequeno e limita dimensões do print largo', async () => {
  const kinds = []; const p = preparador(tipo => { kinds.push(tipo); return { size: 500, type: tipo }; });
  const result = await p.api.preparar({ size: 900, type: 'image/png' });
  assert.deepEqual(kinds, ['image/png']); assert.equal(result.mime, 'image/png'); assert.equal(result.base64, 'cHJpbnQ=');
  assert.equal(p.canvas.width, 2560); assert.equal(p.canvas.height, 1440);
});
test('preparação comprime PNG acima de 1 MB até WebP caber', async () => {
  const qualities = []; const p = preparador((tipo, qualidade) => { qualities.push([tipo, qualidade]); return { type: tipo, size: tipo === 'image/png' || qualidade > 0.85 ? A.MAX_BYTES + 1 : A.MAX_BYTES }; });
  const result = await p.api.preparar({ size: 900, type: 'image/png' });
  assert.equal(result.mime, 'image/webp'); assert.deepEqual(qualities, [['image/png', undefined], ['image/webp', .92], ['image/webp', .85]]);
});
test('imagem impossível de reduzir dá orientação de recorte; corrompida dá mensagem em português', async () => {
  const p = preparador(tipo => ({ type: tipo, size: A.MAX_BYTES + 1 }));
  await assert.rejects(p.api.preparar({ type: 'image/png', size: 100 }), /Recorte/);
  const invalid = preparador(() => null, true);
  await assert.rejects(invalid.api.preparar({ type: 'image/png', size: 100 }), /Não foi possível abrir esta imagem/);
});

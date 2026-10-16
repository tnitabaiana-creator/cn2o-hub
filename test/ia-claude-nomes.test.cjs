// v1.49 — a IA do Hub passou do Gemini para a Claude: o nome do modelo na assinatura da resposta.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const ini = html.indexOf('function nomeModelo(m) {');
const fim = html.indexOf('function pintarIA()', ini);
const ctx = vm.createContext({});
vm.runInContext(html.slice(ini, fim), ctx);

test('modelos Claude aparecem com nome legível', () => {
  assert.equal(ctx.nomeModelo('claude-opus-5-5'), 'Claude Opus 5.5');
  assert.equal(ctx.nomeModelo('claude-sonnet-5-5'), 'Claude Sonnet 5.5');
  assert.equal(ctx.nomeModelo('claude-haiku-5-5'), 'Claude Haiku 5.5');
});

test('histórico do Gemini continua legível', () => {
  assert.equal(ctx.nomeModelo('gemini-3.8-flash'), 'Gemini 3.8 Flash');
  assert.equal(ctx.nomeModelo('gemini-pro-latest'), 'Gemini Pro (vigente)');
  assert.equal(ctx.nomeModelo(''), '');
});

test('a tela não fala mais em Gemini como a IA vigente', () => {
  assert.match(html, /FERRAMENTAS DE IA \(Claude/);
  assert.doesNotMatch(html, /tabela de preços do modelo \(Gemini\)/);
});

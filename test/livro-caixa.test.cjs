'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../livro-caixa.js');
const mes = { mes: '2026-09', receita: { bruto: 100000, repasses: 29569.4, receita_liquida: 70430.6, fonte: 'Extra Digital' }, despesas: { revisao: 1, total: 20000, fonte: 'Livro-caixa confirmado', anexo: { nome: 'setembro.pdf' } }, projecao: { saldo: 50430.6, ir_projetado: 13868.42, liquido_projetado: 36562.18 } };
test('valores confirmados em reais são convertidos em centavos sem ambiguidade', () => {
  assert.equal(L.centavos('12.345,67'), 1234567);
  assert.equal(L.centavos('20000'), 2000000);
  assert.equal(L.centavos('0'), 0);
  assert.equal(L.centavos(' 1,2 '), 120);
  ['', '-1,00', '12.34', '1,001', '1e3', 'Infinity', '1 234,00'].forEach(v => assert.throws(() => L.centavos(v)));
});
test('anexos exigem formato permitido, conteúdo e limite de 10 MiB', () => {
  assert.equal(L.validarArquivo({ name: 'livro.XLSX', size: 80 }).tipo, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(L.validarArquivo(null), null);
  [{ name: 'a.html', size: 50 }, { name: 'a.pdf', size: 0 }, { name: 'a.csv', size: L.MAX_ANEXO + 1 }].forEach(v => assert.throws(() => L.validarArquivo(v)));
});
test('relatório usa valores conferidos do servidor e escapa fonte/anexo, sem baixar recursos externos', () => {
  const r = L.relatorio({ ...mes, despesas: { ...mes.despesas, fonte: '<img src=x onerror=alert(1)>', anexo: { nome: '<script>.pdf' } } });
  assert.match(r, /70\.430,60/); assert.match(r, /36\.562,18/);
  assert.match(r, /&lt;img/); assert.doesNotMatch(r, /<script|<img|<iframe|<link/);
  assert.match(r, /Despesas confirmadas do livro-caixa/);
});
test('sem livro-caixa, exportação mantém a projeção pendente e não inventa zero', () => {
  const r = { ...mes, despesas: { total: null, fonte: null, revisao: 0 }, projecao: { saldo: null, ir_projetado: null, liquido_projetado: null } };
  assert.equal(L.linhas(r)[6][1], null);
  assert.match(L.relatorio(r), /Aguardando dados/);
  assert.match(L.csv(r), /"Resultado líquido projetado";""/);
  assert.match(L.csv(r), /"Receita líquida do cartório";"70430,60"/);
});
test('arquivo CSV preserva valores negativos como resultado, sem fórmula ativa', () => {
  const r = { ...mes, projecao: { saldo: -100, ir_projetado: 0, liquido_projetado: -100 } };
  assert.match(L.csv(r), /"IR projetado — 27,5% do saldo positivo";"0,00"/);
  assert.match(L.csv(r), /"'-100,00"/);
});

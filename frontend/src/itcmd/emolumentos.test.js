'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const M = require('./motor.js');
const root = path.resolve(__dirname, '../../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const baseline = execFileSync('git', ['show', 'HEAD:index.html'], { cwd: root, maxBuffer: 20 * 1024 * 1024 }).toString('utf8').replace(/\r\n/g, '\n');
function motorInline(h) { const end = h.indexOf('/* ============ Interface — Calculadora ITCMD/SE'); const start = h.lastIndexOf('/* ===', h.indexOf('Motor de cálculo — ITCMD/SE')); return h.slice(start, end).trim(); }
function apiInline(h) { const context = { module: { exports: {} } }; vm.runInNewContext(motorInline(h), context); return context.module.exports; }
const before = apiInline(baseline), actual = apiInline(html);
const opts = { ufp: 87.19, hoje: '2026-10-06' };
function falecido(extra = {}) { return { nome: 'Espólio de teste', obito: '2026-09-01', estadoCivil: 'casado', regime: 'parcial', conjuge: { nome: 'Meeira' }, filhosComuns: 'sim', descendentes: [{ uid: 'f1', nome: 'Filho A', condicao: 'vivo' }, { uid: 'f2', nome: 'Filho B', condicao: 'vivo' }], bens: [{ descricao: 'Imóvel comum', tipo: 'imovel_urbano', valor: 1000000, natureza: 'comum', fracao: 100 }], dividas: 0, ...extra }; }
const cenarios = [
  ['todo comum', falecido(), 500000, 500000],
  ['todo particular', falecido({ bens: [{ valor: 1000000, natureza: 'particular' }] }), 1000000, 0],
  ['misto', falecido({ bens: [{ valor: 600000, natureza: 'comum' }, { valor: 400000, natureza: 'particular' }] }), 700000, 300000],
  ['sem sobrevivente', falecido({ estadoCivil: 'solteiro' }), 1000000, 0],
  ['separação convencional', falecido({ regime: 'separacao_conv' }), 1000000, 0],
  ['universal com incomunicável', falecido({ regime: 'universal', bens: [{ valor: 600000, natureza: 'comum' }, { valor: 400000, incomunicavel: true }] }), 700000, 300000],
  ['casal titular de 50% com terceiro', falecido({ bens: [{ valor: 1000000, natureza: 'comum', fracao: 50 }] }), 250000, 250000],
  ['casal titular de 30% com terceiro', falecido({ bens: [{ valor: 1000000, natureza: 'comum', fracao: 30 }] }), 150000, 150000],
  ['fração particular do falecido já limitada a 50%', falecido({ bens: [{ valor: 1000000, natureza: 'particular', fracao: 50 }] }), 500000, 0],
  ['dívidas não criam dedução nos emolumentos', falecido({ dividas: 200000 }), 500000, 500000],
  ['sem valor', falecido({ bens: [{ valor: 0, natureza: 'comum' }] }), 0, 0],
  ['fração zero', falecido({ bens: [{ valor: 1000000, natureza: 'comum', fracao: 0 }] }), 0, 0],
  ['sem bens lançados', falecido({ bens: [] }), 0, 0],
];
for (const [nome, f, base, meacao] of cenarios) test(nome, () => {
  const inv = M.inventario(f, opts), e = M.emolumentosInventario(inv.pat, 3);
  assert.equal(e.base, base); assert.equal(e.meacaoExcluida, meacao);
  assert.equal(M.arred(e.base + e.meacaoExcluida), inv.pat.monteMor);
  assert.equal(JSON.stringify(inv), JSON.stringify(before.inventario(f, opts)), 'ITCMD, sucessão, meação e declarações sem alteração');
  assert.equal(JSON.stringify(e), JSON.stringify(actual.emolumentosInventario(actual.patrimonio(f), 3)), 'artefato servido segue o motor editável');
  if (!base) assert.equal(e.total, 0);
});
test('valor de emolumentos para R$ 1 milhão comum: faixa sobre R$ 500 mil', () => {
  const e = M.emolumentosInventario(M.patrimonio(falecido()), 3);
  assert.equal(e.emol, 5179.16); assert.equal(e.ferd, 1035.83); assert.equal(e.total, 6214.99);
  assert.ok(e.total < M.emolumentosEscritura(1000000, 3).total);
});
test('ato acessório, FERD e adicionais conservam as regras da tabela', () => {
  const e = M.emolumentosInventario(M.patrimonio(falecido()), 12, { acessorio: true });
  assert.equal(e.base, 500000); assert.equal(e.emol, 2589.58); assert.equal(e.ferd, 517.92); assert.equal(e.adicional, 9.54); assert.equal(e.total, 3117.04);
});
test('cumulativo: a meação da primeira sucessão integra a herança da segunda sem nova redução', () => {
  const second = falecido({ nome: 'Meeira', estadoCivil: 'solteiro', bens: [] });
  const c = M.cumulativo(falecido(), second, opts);
  assert.equal(M.emolumentosInventario(c.inv1.pat, 3).base, 500000);
  assert.equal(M.emolumentosInventario(c.inv2.pat, 2).base, 500000);
  assert.equal(M.emolumentosInventario(c.inv2.pat, 2).meacaoExcluida, 0);
  assert.equal(JSON.stringify(c), JSON.stringify(before.cumulativo(falecido(), second, opts)));
});
test('campos calculados fornecidos pela IA não sobrescrevem a base', () => {
  const f = falecido({ baseEmolumentos: 1000000, meacao: 0, heranca: 1000000 });
  assert.equal(M.emolumentosInventario(M.patrimonio(f), 3).base, 500000);
});
test('doação e tabela de faixas permanecem idênticas', () => {
  for (const valor of [0, 5999, 6000, 12999, 13000, 25000, 500000, 1000000, 1200000, 2000001]) {
    assert.equal(JSON.stringify(M.emolumentosEscritura(valor, 12)), JSON.stringify(before.emolumentosEscritura(valor, 12)));
  }
  const d = { doadores: [{ nome: 'Doador' }], donatarios: [{ nome: 'Donatário' }], bens: [{ valor: 1000000, fracao: 50, tipo: 'imovel_urbano' }] };
  assert.equal(JSON.stringify(M.doacao(d, opts)), JSON.stringify(before.doacao(d, opts)));
});
test('frontend servido inclui fontes corrigidas e todos os scripts continuam sintaticamente válidos', () => {
  for (const name of ['motor.js', 'ui.js']) assert.ok(html.includes(fs.readFileSync(path.join(__dirname, name), 'utf8').trim()), name);
  assert.doesNotMatch(html, /emolumentosEscritura\(inv\.pat\.monteMor/);
  assert.doesNotMatch(html, /inventário com bens pela faixa do valor de todos os bens/);
  for (const [, script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) new vm.Script(script);
});
test('tela de orçamento, barra de totais e PDF arquivado usam a herança como base', async () => {
  const ui = fs.readFileSync(path.join(__dirname, 'ui.js'), 'utf8');
  const code = ui.slice(ui.indexOf('  function orcamento()'), ui.indexOf('  function textoResumo()'));
  const elements = new Map(); const $ = s => { if (!elements.has(s)) elements.set(s, { innerHTML: '', textContent: '', dataset: {}, contains: () => false }); return elements.get(s); };
  const fmt = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const f = falecido(), inv = M.inventario(f, opts);
  const context = { M, $, document: { activeElement: null }, ORC_EDITAVEIS: [], ULT: { modo: 'inventario', inv }, S: { orc: {}, hoje: '2026-10-06', ufp: 87.19, emol: {}, inv: [f] }, fmt, fmtN: String, pct: String, esc: String, dataBR: String, parseMoeda: Number, marcar: () => '' };
  vm.runInNewContext(code + '\norcamento();', context);
  assert.match($('#orcLinhas').innerHTML, /herança bruta.*R\$ 1\.000\.000,00.*R\$ 500\.000,00.*R\$ 500\.000,00/s);
  assert.match($('#orcLinhas').innerHTML, /Nota 24/);
  assert.equal($('#bvEmol').textContent, 'R$ 6.214,99');
  // Executa a função real de copiar com as linhas produzidas pelo render real.
  const strip = s => s.replace(/<[^>]+>/g, '');
  const rows = [...$('#orcLinhas').innerHTML.matchAll(/<tr[^>]*><td[^>]*>([\s\S]*?)<\/td><td[^>]*>([\s\S]*?)<\/td><\/tr>/g)].map(([, a, b]) => {
    const detail = a.match(/<div class="notinha">([\s\S]*?)<\/div>/);
    return { children: [{ childNodes: [{ textContent: a.split('<')[0] }], querySelector: sel => sel === '.notinha' && detail ? { textContent: strip(detail[1]) } : null }, { textContent: strip(b), querySelector: () => null }] };
  });
  context.$$ = () => rows;
  vm.runInNewContext(ui.slice(ui.indexOf('  function textoResumo()'), ui.indexOf('  /* ---------- Eventos ---------- */')) + '\nthis.resumo = textoResumo();', context);
  assert.match(context.resumo, /base dos emolumentos \(herança bruta\): R\$ 1\.000\.000,00 − meação excluída R\$ 500\.000,00 = R\$ 500\.000,00/);
  assert.match(context.resumo, /R\$ 6\.214,99/);
  // O fluxo real arquiva o PDF com o estado antes de oferecê-lo para impressão.
  const eventos = []; let arquivado;
  context.window = { ITCMDArquivo: require('../../../itcmd-arquivo.js') };
  context.capturarEstado = () => context.S; context.gerarOrcamentoPdf = () => new Blob([context.resumo]); context.toast = () => {};
  context.ARQUIVO = { modelo: {}, guardarDocumentos: async docs => { eventos.push('salvar'); arquivado = docs[0]; }, oferecerPdf: () => eventos.push('oferecer') };
  const start = ui.indexOf('  async function imprimirOrcamento()'), end = ui.indexOf("  $('#btCopiar')", start);
  await vm.runInNewContext(ui.slice(start, end) + '\nimprimirOrcamento();', context);
  assert.deepEqual(eventos, ['salvar', 'oferecer']);
  assert.equal(arquivado.tipo, 'orcamento');
  assert.match(await arquivado.blob.text(), /base dos emolumentos \(herança bruta\): R\$ 1\.000\.000,00 − meação excluída R\$ 500\.000,00 = R\$ 500\.000,00/);
  assert.match(await arquivado.blob.text(), /R\$ 6\.214,99/);
});

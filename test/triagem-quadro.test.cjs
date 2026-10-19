// v1.51 — quadro "Triagem de esforço" na aba de consumo do Tabelião.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const ini = html.indexOf('const NOMES_TRIAGEM =');
const fim = html.indexOf('function pintarTriagem(caixa)', ini);
const ctx = vm.createContext({ esc: s => String(s).replace(/</g, '&lt;') });
vm.runInContext(html.slice(ini, fim) + '\nthis.htmlTriagem = htmlTriagem;', ctx);

test('sem casos: avisa e mostra o modo', () => {
  const h = ctx.htmlTriagem({ modo: 'sombra', dias: 14, ferramentas: [] });
  assert.match(h, /modo sombra/);
  assert.match(h, /Nenhum caso registrado nos últimos 14 dias/);
});

test('tabela por ferramenta, totais e economia já descontada a triagem', () => {
  const h = ctx.htmlTriagem({ modo: 'sombra', dias: 14, ferramentas: [
    { ferramenta: 'minuta', casos: 10, por_regra: 6, por_haiku: 4, falhas: 0, nota_media: 41, sugeriu_menos: 7, custo_real: '4.0000', custo_estimado: '2.5000', custo_triagem: '0.0040' },
    { ferramenta: 'qualificacao', casos: 5, por_regra: 5, por_haiku: 0, falhas: 0, nota_media: 12, sugeriu_menos: 2, custo_real: '0.3000', custo_estimado: '0.2000', custo_triagem: '0' }
  ] });
  assert.match(h, /Gerador de Minuta/);
  assert.match(h, /Extrator \(qualificação\)/);
  assert.match(h, /6 \/ 4 \/ 0/);
  assert.match(h, /US\$ 4,300/);              // custo real total
  assert.match(h, /US\$ 2,700/);              // com a triagem
  assert.match(h, /Economia possível: <b>US\$ 1,596<\/b>/);
});

test('o quadro entra na aba de consumo', () => {
  assert.match(html, /id="triagemQuadro"/);
  assert.match(html, /api\('\/hub\/ia\/triagem\?dias=14'\)/);
});

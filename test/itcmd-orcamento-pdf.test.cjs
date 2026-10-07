'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const R = require('../itcmd-orcamento-pdf.js'), D = require('../itcmd-orcamento-dados.js'), F = require('./fixtures/itcmd-orcamento.cjs');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const mark = html.indexOf('  function PDFMini(op)'), start = html.lastIndexOf('(function (raiz)', mark), end = html.indexOf("})(typeof window !== 'undefined' ? window : this);", mark) + "})(typeof window !== 'undefined' ? window : this);".length;
assert.ok(start > 0 && end > start);
const ctx = { window: {}, Uint8Array, Blob, atob }; vm.runInNewContext(html.slice(start, end), ctx);
const PDF = ctx.window.PDFMini;
// JPEG real já usado pelo PDFMini, apenas para testes de codificação, sem compor a arte publicada.
const logo = { base64: html.match(/var BRASAO = '([^']+)'/)[1], largura: 892, altura: 364 };
function dados(make = F.inventario, versao = 'discriminado') {
  const f = make(); return D.montar({ estado: f.s, resultado: f.ult, logo, versao, identificacao: { titulo: 'Atendimento fictício', protocolo: 'AT10VFP' }, referencia: 'Referência: 07/10/2026',
    linhas: [{ rotulo: 'ITCMD', valor: 'R$ 4.321,09' }, { rotulo: 'Emolumentos', valor: 'R$ 6.214,99' }, { rotulo: 'Subtotal', valor: 'R$ 10.536,08', subtotal: true }, { rotulo: 'Certidões e diligências', valor: 'R$ 510,50' }, { rotulo: 'Total estimado do ato', valor: 'R$ 11.046,58', total: true }] });
}
function render(d) {
  let instancia;
  class ConferirPDF extends PDF {
    constructor(op) { super(op); instancia = this; this.textos = []; this.logos = []; }
    texto(x, y, t, op = {}) {
      const largura = this.larguraTexto(String(t)), caixa = op.larguraMm || 0;
      const inicio = op.alinhar === 'dir' ? x + caixa - largura : op.alinhar === 'centro' ? x + (caixa - largura) / 2 : x;
      this.textos.push({ pagina: this.atual, t: String(t), x: inicio, fim: inicio + largura, y, tamanho: this.tamanho, negrito: this.negrito });
      return super.texto(x, y, t, op);
    }
    imagemJpeg(b, x, y, w, h) { this.logos.push({ pagina: this.atual, x, y, w, h }); return super.imagemJpeg(b, x, y, w, h); }
  }
  const blob = R.gerar(ConferirPDF, d); return { blob, pdf: instancia };
}
test('resumido é uma página com logo, referência, título central e total, sem anexos ou frases removidas', async () => {
  const d = dados(F.cumulativo, 'resumido'); d.ajusteMulta = 'MULTA DESCONSIDERADA'; d.premissas = ['Premissas e conferências']; d.assinatura = 'César Bravo assinatura'; d.resumo = 'Texto antigo de doação de imóveis';
  const { blob, pdf } = render(d), textos = pdf.textos.map(t => t.t).join('\n');
  assert.equal(pdf.totalPaginas(), 1); assert.equal(pdf.logos.length, 1); assert.equal(pdf.logos[0].w, 57); assert.match(textos, /AT10VFP/); assert.match(textos, /11\.046,58/);
  assert.doesNotMatch(textos, /MULTA DESCONSIDERADA|Premissas|assinatura|César Bravo|Texto antigo|DISCRIMINAÇÃO DO ORÇAMENTO|Herdeiro/);
  const titulo = pdf.textos.find(t => t.t === 'ORÇAMENTO DO INVENTÁRIO CUMULATIVO'); assert.ok(titulo.negrito); assert.equal(titulo.tamanho, 16); assert.ok(Math.abs((titulo.x + titulo.fim) / 2 - 105) < .01);
  const raw = Buffer.from(await blob.arrayBuffer()).toString('latin1'); assert.match(raw, /^%PDF-/); assert.match(raw, /\/Subtype \/Image/); assert.match(raw, /\/DCTDecode/);
});
test('discriminado conserva todas as sucessões, nomes, frações e valores e termina no total', () => {
  const d = dados(F.cumulativo), { pdf } = render(d), textos = pdf.textos.map(t => t.t), normal = textos.join(' ').replace(/\s+/g, ' ');
  assert.ok(pdf.totalPaginas() >= 3); assert.equal(pdf.logos.length, pdf.totalPaginas());
  for (const s of d.sucessoes) { assert.ok(textos.includes(s.titulo)); for (const h of s.herdeiros) { assert.ok(normal.includes(h.nome)); assert.ok(textos.includes(h.quinhao)); assert.ok(textos.includes(h.imposto)); } }
  assert.match(normal, /1\/14 · 7,1429%/); assert.match(normal, /parcela inventariada/);
  const conteudo = pdf.textos.filter(t => t.y < 284); assert.equal(conteudo.at(-1).t, 'R$ 11.046,58'); assert.equal(conteudo.at(-2).t, 'Total estimado do ato');
  assert.doesNotMatch(normal, /PREMISSAS|CONFERÊNCIA|Multa desconsiderada|Imposto principal mantido|Assinatura/);
});
test('todos os textos ficam dentro da folha e antes do rodapé, mesmo com colunas estreitas e nomes longos', () => {
  for (const make of [F.inventario, F.cumulativo, F.misto, F.partilhaReal, F.doacao]) {
    const { pdf } = render(dados(make));
    for (const t of pdf.textos) {
      assert.ok(t.x >= 15.9 && t.fim <= 194.1, `${make.name}: texto fora da margem: ${JSON.stringify(t)}`);
      assert.ok(t.y >= 44 && (t.y <= 278 || t.y === 289), `${make.name}: texto invade cabeçalho/rodapé: ${JSON.stringify(t)}`);
    }
  }
});
test('tabela extensa repete cabeçalho e não corta linha de milhares de caracteres', () => {
  const d = dados(), longa = Array.from({ length: 190 }, (_, i) => 'Nome' + i).join(' '); d.sucessoes[0].herdeiros[1].nome = longa;
  const { pdf } = render(d), normal = pdf.textos.map(t => t.t).join(' ');
  assert.ok(pdf.totalPaginas() > 3); assert.match(normal, /Nome0 /); assert.match(normal, /Nome189/);
  assert.ok(pdf.textos.filter(t => t.t === 'BENEFICIÁRIO').length > 1);
  for (const t of pdf.textos) assert.ok(t.y <= 278 || t.y === 289, JSON.stringify(t));
});
test('multas positivas continuam identificadas, enquanto anulação manual não cria coluna vazia', () => {
  const d = dados(); d.sucessoes[0].herdeiros[1].multa = 'R$ 500,00'; d.sucessoes[0].totalMulta = 'R$ 500,00';
  const com = render(d).pdf.textos.map(t => t.t); assert.ok(com.includes('MULTA')); assert.ok(com.includes('R$ 500,00'));
  const sem = render(dados()).pdf.textos.map(t => t.t); assert.ok(!sem.includes('MULTA'));
});
test('base tributável diferente do quinhão é explicitada inclusive na isenção total', () => {
  for (const base of ['R$ 100.000,00', 'R$ 0,00']) {
    const d = dados(); d.sucessoes[0].herdeiros[1].baseTributavel = base;
    const { pdf } = render(d), textos = pdf.textos.map(t => t.t).join(' ');
    assert.equal((textos.match(/Base tributável:/g) || []).length, 1); assert.ok(textos.includes('Base tributável: ' + base));
    assert.ok(textos.includes(d.sucessoes[0].herdeiros[1].imposto), 'a apresentação não recalcula o imposto');
  }
  assert.doesNotMatch(render(dados()).pdf.textos.map(t => t.t).join(' '), /Base tributável:/, 'base igual ao quinhão não duplica informação');
});
test('última despesa acompanha o total da tabela ao mudar de página', () => {
  for (let n = 1; n <= 50; n++) {
    const d = dados(F.inventario, 'resumido');
    d.linhas = Array.from({ length: n }, (_, i) => ({ rotulo: 'Despesa ' + (i + 1), valor: 'R$ 123,45' })).concat({ rotulo: 'Total estimado do ato', valor: 'R$ 6.172,50', total: true });
    const { pdf } = render(d), ultimo = pdf.textos.find(t => t.t === 'Despesa ' + n), total = pdf.textos.find(t => t.t === 'Total estimado do ato');
    assert.equal(total.pagina, ultimo.pagina, `total isolado com ${n} despesas`);
  }
});
test('total de ITCMD acompanha o último beneficiário da tabela', () => {
  for (let n = 1; n <= 30; n++) {
    const d = dados(), s = d.sucessoes[0], h = s.herdeiros[1]; s.bens = [];
    s.herdeiros = Array.from({ length: n }, (_, i) => ({ ...h, nome: 'Beneficiário ' + (i + 1) }));
    const { pdf } = render(d), ultimo = pdf.textos.find(t => t.t === 'Beneficiário ' + n), total = pdf.textos.find(t => t.t === 'Total ITCMD');
    assert.equal(total.pagina, ultimo.pagina, `total isolado com ${n} beneficiários`);
  }
});
test('quatro indicadores usam a mesma faixa e a doação não duplica fração ausente', () => {
  const { pdf } = render(dados()), indicadores = ['MONTE-MOR', 'MEAÇÃO', 'HERANÇA', 'ITCMD'].map(rotulo => pdf.textos.find(t => t.pagina === 1 && t.t === rotulo && t.y < 100));
  assert.ok(indicadores.every(Boolean)); assert.equal(new Set(indicadores.map(t => t.y)).size, 1);
  const doacao = render(dados(F.doacao)).pdf.textos.map(t => t.t); assert.ok(doacao.includes('-')); assert.ok(!doacao.includes('- · -'));
});
test('dados incompletos não permitem gerar orçamento sem identidade visual', () => {
  assert.throws(() => R.gerar(PDF, { versao: 'resumido' }), /logo oficial/);
  assert.throws(() => R.gerar(PDF, { versao: 'antigo', logo }), /resumido ou discriminado/);
});

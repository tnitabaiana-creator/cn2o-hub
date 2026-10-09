'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const code = html.slice(html.indexOf('const PROD_FAIXAS ='), html.lastIndexOf('</script>'));
function mes(chave = '2026-09', anterior = false) {
  const total = anterior ? 500 : 1000, liquido = anterior ? 352.15 : 704.31;
  const dados = { total, atos: 10, diasUteis: 20, mediana: 100,
    pessoas: [{ id: 'mesa.teste', nome: 'Mesa Teste', total: 250, atos: 1, mediana: 250, max: 250, dias: 1 }, { id: 'balcao.teste', nome: 'Balcão Teste', total: total - 250, atos: 9, mediana: 50, max: 150, dias: 2 }],
    pgto: [{ forma: 'PIX', qtd: 10, total }], faixas: [{ faixa: 'R$ 200–1 mil', qtd: 10, total }],
    serie: { dias: ['2026-09-01', '2026-09-02'], total: [250, total - 250], porPessoa: { 'mesa.teste': [250, 0], 'balcao.teste': [0, total - 250] } } };
  const dados_liquidos = structuredClone(dados);
  Object.assign(dados_liquidos, { total: liquido, mediana: 70.43, base_receita: 'liquida_apos_repasses', versao_financeira: 'receita-liquida-2026-10-v1' });
  dados_liquidos.pessoas.forEach((p, i) => Object.assign(p, { total_bruto: p.total, total: i ? liquido - 176.08 : 176.08, mediana: i ? 35.22 : 176.08, max: i ? 105.65 : 176.08 }));
  dados_liquidos.pgto[0].total = dados_liquidos.faixas[0].total = liquido;
  dados_liquidos.serie.total = [176.08, liquido - 176.08]; dados_liquidos.serie.porPessoa = { 'mesa.teste': [176.08, 0], 'balcao.teste': [0, liquido - 176.08] };
  return { chave, ano: +chave.slice(0, 4), mes: +chave.slice(5), dados, dados_liquidos,
    financeiro: { bruto: total, repasses: total - liquido, receita_liquida: liquido, percentual_repasses: 29.5694, notas: [] } };
}
function ambiente(meses = [mes('2026-08', true), mes()]) {
  const elements = new Map(), graphs = [], textos = [], blobs = [], chamadas = [];
  const el = id => { if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', value: '200', disabled: false, dataset: {}, style: {}, addEventListener() {}, querySelectorAll: () => [] }); return elements.get(id); };
  class PDF {
    constructor() { this.larguraMm = 210; this.alturaMm = 297; }
    fonte() { return this; } corTexto() { return this; } retangulo() { return this; } linha() { return this; } novaPagina() { textos.push('NOVA PÁGINA'); return this; }
    texto(x, y, s) { textos.push(s); return this; } quebrar(t) { return [t]; } blob() { return new Blob(['pdf']); }
  }
  const ctx = vm.createContext({ Blob, PDFMini: PDF, console, Date, Math, Number, WeakMap,
    window: {}, SESSAO: { token: 'fixture', admin: true }, ED: { aba: 'relatorios', rel: { visao: 'produtividade' } }, LAVRADOS_RELATORIOS: new Map(),
    el, esc: String, toast: x => chamadas.push(['toast', x]), atdN: String, dd: n => String(n).padStart(2, '0'), primeiraMaiuscula: s => s,
    MESES: ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'], ATD_MES_CURTO: ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'],
    ATD_COR: { v: 'vinho', m18: 'cinza' }, ATD_DSEM: ['dom','seg','ter','qua','qui','sex','sab'],
    atdDeIso: x => new Date(x + 'T12:00:00'), relDia: x => x, quandoCurto: x => x, agoraCurto: () => '09/10/2026',
    api: async (...args) => { chamadas.push(args); return { config: { corte: 300 }, analise: { resumo: 'Análise líquida' } }; },
    atdColunas: (...args) => graphs.push(args), atdLinha: (...args) => graphs.push(args), atdVazio() {},
    document: { body: { appendChild() {} }, createElement: () => ({ click() {}, remove() {} }) },
    URL: { createObjectURL: b => { blobs.push(b); return 'blob:fixture'; }, revokeObjectURL() {} }, setTimeout() {}, meses
  });
  vm.runInContext(code, ctx);
  vm.runInContext("PROD.dados={meses,config:{corte:200},tabeliaes:[]}; PROD.cur='2026-09'; PROD.comp='auto'; prodBarras=(...args)=>atdColunas(...args)", ctx);
  return { el, ctx, graphs, textos, blobs, chamadas, run: s => vm.runInContext(s, ctx) };
}
test('decorador líquido estável não altera brutos nem aplica repasse duas vezes', () => {
  const origem = mes(), antes = JSON.stringify(origem), a = ambiente([origem]);
  assert.equal(a.run('prodMes(PROD.cur) === prodMeses()[0]'), true);
  assert.equal(a.run('prodMes(PROD.cur).dados.total'), 704.31);
  assert.equal(a.run('prodCascataValores(prodMes(PROD.cur)).liq'), 704.31);
  assert.equal(JSON.stringify(origem), antes);
});
test('comparação automática e explícita usam meses líquidos e rejeitam o próprio mês', () => {
  const a = ambiente(); assert.equal(a.run('prodComparado(prodMes(PROD.cur)).chave'), '2026-08');
  assert.equal(a.run('prodComparado(prodMes(PROD.cur)).dados.total'), 352.15);
  a.run("PROD.comp='2026-09'"); assert.equal(a.run('prodComparado(prodMes(PROD.cur))'), null);
});
test('perfil considera bruto e todas as métricas por usuário consideram líquido', () => {
  const a = ambiente(), p = a.run('prodPessoas(prodMes(PROD.cur))[0]');
  assert.equal(p.perfil, 'mesa'); assert.equal(p.total_bruto, 250); assert.equal(p.total, 176.08);
  assert.equal(p.ticket, 176.08); assert.equal(p.mediana, 176.08); assert.equal(p.max, 176.08); assert.equal(p.porDia, 8.804); assert.equal(p.atos, 1);
  assert.equal(a.run("prodPerfil({id:'zero',atos:1,total:500,total_bruto:0})"), 'balcao');
});
test('ausência ou conciliação financeira inválida não volta silenciosamente para bruto', () => {
  for (const transformar of [m => { delete m.dados_liquidos; }, m => { m.financeiro.receita_liquida = 700; }, m => { m.financeiro.repasses = 1; }, m => { m.financeiro.percentual_repasses = 20; }, m => { delete m.dados_liquidos.pessoas[0].total_bruto; }]) {
    const m = mes(); transformar(m); const a = ambiente([m]); assert.equal(a.run('prodMes(PROD.cur).dados'), null);
    a.run('prodCsv();prodPdf()'); assert.equal(a.blobs.length, 0);
  }
});
test('topo tem apenas quatro indicadores, sem ticket ou melhor dia', () => {
  const a = ambiente(); a.run('prodLivro(prodMes(PROD.cur),prodComparado(prodMes(PROD.cur)),prodPessoas(prodMes(PROD.cur)))');
  const s = a.el('prodLivro').innerHTML; assert.equal((s.match(/<strong/g)||[]).length, 4);
  assert.match(s, /Receita líquida do cartório/); assert.match(s, /704,31/); assert.match(s, /Variação \/ mês/); assert.doesNotMatch(s, /Ticket|Melhor dia|Faturamento bruto/);
});
test('gráficos, histórico, pagamento, faixas e comparações usam a mesma projeção líquida', () => {
  const a = ambiente(); a.run('prodGraficos(prodMes(PROD.cur),prodComparado(prodMes(PROD.cur)),prodPessoas(prodMes(PROD.cur)));prodMesAMes(prodMes(PROD.cur))');
  const g = id => a.graphs.find(x => x[0] === id);
  assert.equal(g('prodGFat')[1].reduce((n,x)=>n+x.v,0), 704.31);
  assert.equal(g('prodGPg')[1][0].x.total, 704.31); assert.equal(g('prodGFaixa')[2][0], 704.31);
  assert.equal(g('prodGDia')[2][0].v.reduce((a,b)=>a+b,0), 704.31);
  assert.ok(Math.abs(g('prodGVar')[1].reduce((n,x)=>n+x.v,0) - 352.16) < 1e-9);
  assert.deepEqual(Array.from(g('prodGMeses')[2]), [352.15,704.31]); assert.match(a.el('prodTabMeses').innerHTML, /prod-atual/);
});
test('CSV exporta valores líquidos, marcador de base e conciliação separada', async () => {
  const a = ambiente(); a.run('prodCsv()'); const s = await a.blobs[0].text();
  assert.match(s, /Usuário financeiro;Perfil;Lançamentos/); assert.match(s, /Receita líquida/); assert.match(s, /Base de receita/); assert.match(s, /liquida_apos_repasses/);
  assert.match(s, /176,08/); assert.match(s, /Receita bruta;1000/); assert.match(s, /Repasses \(29,5694%\);295,69/); assert.match(s, /Receita líquida do cartório;704,31/);
});
test('PDF não contém KPI ticket nem cascata IR e usa líquido em tabelas e conciliação', () => {
  const a = ambiente(); a.run('prodPdf()');
  const inicio = a.textos.slice(0,a.textos.findIndex(x => x === 'Escrituras lavradas · fonte oficial')).join('\n');
  assert.match(inicio, /RECEITA LÍQUIDA DO CARTÓRIO/); assert.match(inicio, /704,31/); assert.doesNotMatch(inicio, /TICKET/i);
  const todo = a.textos.join('\n'); assert.match(todo, /176,08/); assert.match(todo, /29,5694%/); assert.match(todo, /70,4306%/); assert.doesNotMatch(todo, /IR estimado|Disponível estimado|Do bruto ao disponível|Faturamento/);
});
test('importação bruta permanece intacta e exportação líquida é recusada, inclusive acentos/espaços', () => {
  const a = ambiente(); const linhas = [['Usuário','Valor'],['mesa.teste','250,00'],['balcao.teste','750,00']]; a.ctx.linhas = linhas;
  assert.equal(a.run("prodInterpretar(linhas,'original.csv','csv',{}).dados.total"),1000);
  for (const marca of ['liquida_apos_repasses','LÍQUIDA após repasses',' líquida_apos_repasses ']) {
    a.ctx.linhas = [['Usuário','Valor',' BÁSE de RECEITA '],['teste',704.31,marca]];
    assert.throws(() => a.run("prodInterpretar(linhas,'exportado.csv','csv',{})"), /segundo desconto/);
  }
});
test('salvar perfil envia apenas o corte e reanálise persiste no mês canônico', async () => {
  const a = ambiente(); a.run('prodRender=()=>{};prodIa=()=>{};prodSalvarCfg();prodAnalisar(prodMes(PROD.cur))');
  await new Promise(r=>setImmediate(r));
  assert.deepEqual(JSON.parse(JSON.stringify(a.chamadas[0][1].corpo)),{corte:200});
  assert.equal(a.run('prodMesesOriginais()[1].analise.resumo'),'Análise líquida'); assert.equal(a.run('prodMes(PROD.cur).analise_status'),'atual');
});

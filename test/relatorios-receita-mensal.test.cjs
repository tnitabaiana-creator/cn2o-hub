'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const inicio = html.indexOf('const REL_ROT_ENVIAR =');
const codigo = html.slice(inicio, html.indexOf('/* ============================================================\r\n   v1.39 — ATENDIMENTOS DO BALCÃO', inicio));
const json = x => JSON.parse(JSON.stringify(x));
function pendente() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function fonte(inicio, fim, meses, status = 'disponivel') {
  return { escopo: 'competencias_mensais', base_individual: 'usuario_financeiro', periodo_relatorio: { inicio, fim },
    competencias: meses.map((mes, i) => ({ mes, status, receita_liquida: status === 'disponivel' ? 704.31 * (i + 1) : null,
      receita_liquida_centavos: status === 'disponivel' ? 70431 * (i + 1) : null,
      lancamentos: status === 'disponivel' ? 100 : null, dias_uteis: status === 'disponivel' ? 20 : null,
      media_dia_util: status === 'disponivel' ? 35.22 : null, fonte: 'Pesquisa de Produtividade', importado_em: null })),
    receita_por_autor: { status: 'pendente_vinculo_financeiro_por_ato', colaboradores: [], total_atribuido: null } };
}
const setembro = () => fonte('2026-09-01', '2026-09-30', ['2026-09']);
const outubro = () => fonte('2026-10-01', '2026-10-31', ['2026-10']);
function ambiente() {
  const elementos = new Map(), chamadas = [], downloads = [];
  let expiracoes = 0;
  const el = id => {
    if (!elementos.has(id)) elementos.set(id, { id, innerHTML: '', textContent: '', value: '', dataset: {}, disabled: false,
      isConnected: true, hidden: false, handlers: {}, frame: { srcdoc: '' }, classList: { add() {}, remove() {} },
      addEventListener(tipo, fn) { this.handlers[tipo] = fn; }, querySelector() { return this.frame; } });
    return elementos.get(id);
  };
  const c = vm.createContext({ console, Date, Map, Set, Number, encodeURIComponent,
    SESSAO: { token: 'sessao-fixture', login: 'titular.fixture', admin: true },
    ED: { aba: 'relatorios', rel: { visao: 'escreventes', tipo: 'mensal', ref: '2026-10-01' } },
    CONFIG: { endpoint: 'https://exemplo.invalid' }, store: { get: () => '' }, el,
    esc: x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    MESES: ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'],
    dd: n => String(n).padStart(2, '0'), primeiraMaiuscula: s => s[0].toUpperCase() + s.slice(1), quandoCurto: s => s,
    api: url => { const p = pendente(); chamadas.push({ url, ...p }); return p.promise; },
    fetch: (url, options) => { const p = pendente(); downloads.push({ url, options, ...p }); return p.promise; },
    sessaoExpirada: () => expiracoes++, setTimeout() {}, window: {},
    relChave: () => '<nav>Escreventes</nav>', relLigarChave() {}, diaISO: d => d.toISOString().slice(0, 10)
  });
  vm.runInContext(codigo, c);
  return { c, el, chamadas, downloads, expiracoes: () => expiracoes };
}

test('competência mensal é o mês anterior; semana em virada mantém duas competências separadas', () => {
  const { c } = ambiente();
  assert.deepEqual(json(c.relCompetenciasReceita('mensal', '2026-10-01')), { inicio: '2026-09-01', fim: '2026-09-30', meses: ['2026-09'] });
  assert.deepEqual(json(c.relCompetenciasReceita('semanal', '2026-11-02')), { inicio: '2026-10-26', fim: '2026-11-01', meses: ['2026-10', '2026-11'] });
  assert.deepEqual(json(c.relCompetenciasReceita('semanal', '2027-01-04')), { inicio: '2026-12-28', fim: '2027-01-03', meses: ['2026-12', '2027-01'] });
  assert.equal(c.relCompetenciasReceita('mensal', '2026-02-30'), null);
});

test('cartão exibe receita canônica sem novo desconto, média mensal e limitação de autoria', () => {
  const { c } = ambiente(), r = setembro();
  r.competencias[0].fonte = '<img src=x onerror=fixture()>';
  const s = c.relReceitaHtml('mensal', '2026-10-01', r, false);
  assert.match(s, /Receita líquida do cartório/); assert.match(s, /704,31/); assert.match(s, /35,22/);
  assert.match(s, /Setembro de 2026/); assert.match(s, /todos os atos/); assert.match(s, /70,4306%/);
  assert.match(s, /vínculo financeiro por ato/); assert.match(s, /não comprova autoria/);
  assert.doesNotMatch(s, /<img|496,06|IR estimado|despesas/i); assert.match(s, /&lt;img/);
});

test('semana cruzada exibe os dois valores mensais e não soma nem rateia como receita semanal', () => {
  const { c } = ambiente();
  const s = c.relReceitaHtml('semanal', '2026-11-02', fonte('2026-10-26', '2026-11-01', ['2026-10', '2026-11']), false);
  assert.equal((s.match(/<strong>/g) || []).length, 2);
  assert.match(s, /704,31/); assert.match(s, /1\.408,62/); assert.doesNotMatch(s, /2\.112,93/);
  assert.match(s, /Outubro de 2026/); assert.match(s, /Novembro de 2026/);
  assert.match(s, /não representam receita semanal/); assert.match(s, /nem comprovam mês fechado/);
});

test('ausente, indisponível e resposta inválida não viram zero; zero documentado é exibido', () => {
  const { c } = ambiente();
  for (const status of ['ausente', 'indisponivel']) {
    const s = c.relReceitaHtml('mensal', '2026-10-01', fonte('2026-09-01', '2026-09-30', ['2026-09'], status), false);
    assert.match(s, /Indisponível/); assert.doesNotMatch(s, /0,00/);
  }
  const r = setembro(); r.competencias[0].receita_liquida = 0; r.competencias[0].receita_liquida_centavos = 0; r.competencias[0].media_dia_util = 0;
  assert.match(c.relReceitaHtml('mensal', '2026-10-01', r, false), /0,00/);
  for (const mudar of [r => { r.competencias[0].receita_liquida_centavos++; }, r => { r.periodo_relatorio.inicio = '2026-08-01'; },
    r => { r.competencias[0].mes = '2026-08'; }, r => { r.competencias.push(r.competencias[0]); }, r => { r.competencias[0].receita_liquida = null; }]) {
    const x = setembro(); mudar(x); const s = c.relReceitaHtml('mensal', '2026-10-01', x, false);
    assert.match(s, /Indisponível/); assert.doesNotMatch(s, /704,31/);
  }
});

test('página coloca receita antes do quadro Trello e atualiza ao mudar o período', async () => {
  const a = ambiente(), painel = { innerHTML: '' };
  vm.runInContext("relCarregarSituacao=()=>{};relCarregarEnvios=()=>{};relLavradosMensal=()=>{};relPeriodos=()=>[{ref:'2026-11-01',rotulo:'Outubro'},{ref:'2026-10-01',rotulo:'Setembro'}]", a.c);
  a.c.pintarAbaRelatorios(painel);
  assert(painel.innerHTML.indexOf('id="edRelReceita"') < painel.innerHTML.indexOf('id="edRelSituacao"'));
  assert.equal(a.chamadas[0].url, '/hub/relatorios/receita-mensal?tipo=mensal&ref=2026-10-01');
  a.el('edRelPrevia').innerHTML = 'prévia antiga';
  const periodo = a.el('edRelPeriodo'); periodo.value = '2026-11-01'; periodo.handlers.change.call(periodo);
  assert.equal(a.el('edRelPrevia').innerHTML, '');
  assert.equal(a.chamadas[1].url, '/hub/relatorios/receita-mensal?tipo=mensal&ref=2026-11-01');
  a.chamadas[0].resolve({ receita_mensal: setembro() }); a.chamadas[1].resolve({ receita_mensal: outubro() });
  await new Promise(r => setImmediate(r)); assert.match(a.el('edRelReceita').innerHTML, /Outubro de 2026/);
});

test('resposta anterior não sobrescreve competência atual mesmo chegando depois', async () => {
  const a = ambiente(), anterior = a.c.relCarregarReceita();
  a.c.ED.rel.ref = '2026-11-01'; const atual = a.c.relCarregarReceita();
  a.chamadas[1].resolve({ receita_mensal: outubro() }); await atual;
  a.chamadas[0].resolve({ receita_mensal: setembro() }); await anterior;
  assert.match(a.el('edRelReceita').innerHTML, /Outubro de 2026/); assert.doesNotMatch(a.el('edRelReceita').innerHTML, /Setembro de 2026/);
});

test('nova consulta da mesma competência invalida erro e resposta anteriores', async () => {
  const a = ambiente(), antiga = a.c.relCarregarReceita(), nova = a.c.relCarregarReceita();
  a.chamadas[1].resolve({ receita_mensal: setembro() }); await nova;
  a.chamadas[0].reject(new Error('consulta antiga')); await antiga;
  assert.match(a.el('edRelReceita').innerHTML, /704,31/); assert.doesNotMatch(a.el('edRelReceita').innerHTML, /Indisponível/);
});

test('troca de sessão, perda de acesso, saída da aba ou troca do host impede resposta tardia', async () => {
  for (const mudar of [a => { a.c.SESSAO.token = 'nova-sessao'; }, a => { a.c.SESSAO.login = 'outra.fixture'; },
    a => { a.c.SESSAO.admin = false; }, a => { a.c.ED.rel.visao = 'produtividade'; }, a => { a.c.ED.aba = 'outra'; },
    a => { a.el('edRelReceita').isConnected = false; }, a => { a.c.ED.rel = { ...a.c.ED.rel }; }]) {
    const a = ambiente(), p = a.c.relCarregarReceita(); mudar(a); a.el('edRelReceita').innerHTML = 'estado novo';
    a.chamadas[0].resolve({ receita_mensal: setembro() }); await p; assert.equal(a.el('edRelReceita').innerHTML, 'estado novo');
  }
});

test('falha atual retira o carregamento e informa indisponibilidade sem valor financeiro', async () => {
  const a = ambiente(), p = a.c.relCarregarReceita(); a.chamadas[0].reject(new Error('offline')); await p;
  assert.match(a.el('edRelReceita').innerHTML, /Indisponível/); assert.doesNotMatch(a.el('edRelReceita').innerHTML, /Carregando|0,00/);
});

test('prévia pendente não reaparece após mudança de período ou sessão', async () => {
  for (const mudar of [a => { a.c.ED.rel.ref = '2026-11-01'; }, a => { a.c.SESSAO.token = 'nova-sessao'; }]) {
    const a = ambiente(), p = a.c.relVerPrevia(); mudar(a); a.el('edRelPrevia').innerHTML = 'estado novo';
    a.downloads[0].resolve({ ok: true, text: async () => '<p>prévia anterior</p>' }); await p;
    assert.equal(a.el('edRelPrevia').innerHTML, 'estado novo'); assert.equal(a.el('edRelPrevia').frame.srcdoc, '');
  }
});

test('401 da sessão anterior na prévia não expira nova sessão; 401 atual ainda expira', async () => {
  for (const trocar of [false, true]) {
    const a = ambiente(), p = a.c.relVerPrevia(); if (trocar) a.c.SESSAO.token = 'nova-sessao';
    a.downloads[0].resolve({ ok: false, status: 401, text: async () => '{"erro":"expirada"}' }); await p;
    assert.equal(a.expiracoes(), trocar ? 0 : 1);
  }
});

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

function resumoOficial() {
  const metodos = { direta: 1, auditoria_concordante: 2, trello_divergencia: 3, movimentacao_arquivo_trello: 4, ultimo_escrevente_antes_arquivo_trello: 5 };
  return { inicio: '2026-09-01', fim: '2026-09-30', total_observado: 223, total_oficial: 223, cobertura_completa: true,
    com_vinculo: 20, sem_vinculo: 203, com_pendencia_identificacao: 0,
    meses: [{ mes: '2026-09', ate: '2026-09-30', corte_em: '2026-10-09T15:00:00Z', dia_final_completo: true,
      total_observado: 223, total_oficial: 223, cobertura_completa: true, com_vinculo: 20, sem_vinculo: 203,
      com_pendencia_identificacao: 0, revisao: 1, importado_em: '2026-10-09T18:00:00Z' }],
    tipos: [{ codigo: 'compra_venda', nome: 'Compra e venda', total_observado: 223, total_oficial: 223 }],
    classificacao: { versao: 'extra-digital-tipos-v1', campos: ['Sub-tipo', 'Finalidade'], nao_classificados: 0, divergentes: 0 },
    colaboradores: [{ id: 'pessoa-fixture', nome: 'Pessoa fictícia', fonte: 'Extra Digital + Trello', marcos: ['lavratura', 'atribuicao_gerencial'],
      total_observado: 15, total_oficial: null, metodos: { ...metodos }, com_cartao_trello: 14 }],
    autoria: { status: 'parcial', sem_autoria_confirmada: 208, com_autoria_confirmada: 15, cobertura_completa: false, metodos, com_cartao_trello: 14 } };
}
function dadosOficiais(a, resumo = resumoOficial(), receita = setembro(), tipo = 'mensal', ref = '2026-10-01') {
  const periodo = a.c.relCompetenciasReceita(tipo, ref);
  return { tipo, ref, periodo, resumo: a.c.window.GestaoLavrados.validarResumo(resumo, periodo), receita };
}
function lerCsv(texto) {
  const linhas = [], linha = []; let atual = '', aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]; if (i === 0 && c === '\uFEFF') continue;
    if (c === '"') { if (aspas && texto[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas; }
    else if (!aspas && c === ';') { linha.push(atual); atual = ''; }
    else if (!aspas && c === '\r' && texto[i + 1] === '\n') { linha.push(atual); linhas.push(linha.splice(0)); atual = ''; i++; }
    else atual += c;
  }
  const cabecalho = linhas.shift(); return linhas.map(l => Object.fromEntries(cabecalho.map((c, i) => [c, l[i]])));
}

function ambiente() {
  const elementos = new Map(), chamadas = [], downloads = [], blobs = [], links = [], avisos = [];
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
    api: (url, options) => { const p = pendente(), token = c.SESSAO.token, login = c.SESSAO.login; chamadas.push({ url, options, ...p }); return p.promise.catch(e => { if (e && e.status === 401 && c.SESSAO.token === token && c.SESSAO.login === login) expiracoes++; throw e; }); },
    fetch: (url, options) => { const p = pendente(); downloads.push({ url, options, ...p }); return p.promise; },
    sessaoExpirada: () => expiracoes++, setTimeout() {}, window: { GestaoLavrados: require('../gestao-lavrados.js') },
    Blob, URL: { createObjectURL: b => { blobs.push(b); return 'blob:fixture'; }, revokeObjectURL() {} },
    document: { body: { appendChild() {} }, createElement: () => ({ click() { links.push(this); }, remove() {} }) }, toast: (...args) => avisos.push(args),
    relChave: () => '<nav>Escreventes</nav>', relLigarChave() {}, diaISO: d => d.toISOString().slice(0, 10)
  });
  vm.runInContext(codigo, c);
  return { c, el, chamadas, downloads, blobs, links, avisos, expiracoes: () => expiracoes };
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
    a.chamadas[0].resolve(resumoOficial()); a.chamadas[1].resolve({ receita_mensal: setembro() }); await p;
    assert.equal(a.el('edRelPrevia').innerHTML, 'estado novo'); assert.equal(a.el('edRelPrevia').frame.srcdoc, '');
  }
});

test('401 da sessão anterior na prévia não expira nova sessão; 401 atual ainda expira', async () => {
  for (const trocar of [false, true]) {
    const a = ambiente(), p = a.c.relVerPrevia(); if (trocar) a.c.SESSAO.token = 'nova-sessao';
    a.chamadas[0].reject({ status: 401, erro: 'expirada' }); a.chamadas[1].resolve({ receita_mensal: setembro() }); await p;
    assert.equal(a.expiracoes(), trocar ? 0 : 1);
  }
});

test('situação distingue cartões históricos dos atos oficiais e preserva zero documentado', () => {
  const a = ambiente();
  for (const [conclusoes, esperado] of [[0, '0'], [1234, '1.234']]) {
    a.c.ED.rel.status = { rastreio: { conclusoes, sem_tipo: 2, webhook_assinado: true }, email: { configurado: true } };
    a.c.relPintarSituacao();
    const s = a.el('edRelSituacao').innerHTML;
    assert(s.includes('<span>Cartões arquivados · histórico</span><b>' + esperado + '</b>'));
    assert(s.includes('cartão(ões) arquivado(s) sem o tipo'));
    assert(!s.includes('ato(s) concluído(s)'));
    assert.doesNotMatch(s, /Atos concluídos|Indisponível/);
  }
});

test('contagem histórica ausente ou inválida fica indisponível sem inventar zero', () => {
  const a = ambiente();
  for (const rastreio of [undefined, {}, ...[undefined, null, '', '0', '3', false, NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1].map(conclusoes => ({ conclusoes }))]) {
    a.c.ED.rel.status = { rastreio, email: { configurado: true } };
    a.c.relPintarSituacao();
    const s = a.el('edRelSituacao').innerHTML;
    assert(s.includes('<span>Cartões arquivados · histórico</span><b>Indisponível</b>'));
    assert(!s.includes('<b>0</b>'));
    assert.doesNotMatch(s, /Atos concluídos/);
  }
});

test('prévia e CSV oficiais consultam CTN e receita mensal, sem usar histórico nem enviar e-mail', async () => {
  const a = ambiente(), p = a.c.relVerPrevia();
  assert.deepEqual(a.chamadas.map(x => x.url), ['/hub/atos-lavrados/resumo?inicio=2026-09-01&fim=2026-09-30', '/hub/relatorios/receita-mensal?tipo=mensal&ref=2026-10-01']);
  assert.equal(a.downloads.length, 0);
  a.chamadas[0].resolve(resumoOficial()); a.chamadas[1].resolve({ receita_mensal: setembro() }); await p;
  const previa = a.el('edRelPrevia').frame.srcdoc;
  assert.match(previa, /Total oficial: 223/); assert.match(previa, /Responsável não identificado: 208/);
  assert.match(previa, /data Minuta\/Lavratura/); assert.match(previa, /último escrevente individual/);
  assert.match(previa, /conta é genérica ou de colaborador não escrevente/); assert.match(previa, /Conta desconhecida permanece pendente/);
  assert.match(previa, /704,31/); assert.match(previa, /Usuário do lançamento financeiro não comprova autoria/);
  assert.match(a.el('edRelPrevia').innerHTML, /sandbox=""/);
  assert.doesNotMatch(previa, /<script|src=|form action|IR estimado|despesas/);
  const csv = a.c.relBaixarCsv();
  a.chamadas[2].resolve(resumoOficial()); a.chamadas[3].resolve({ receita_mensal: setembro() }); await csv;
  assert.equal(a.blobs.length, 1); assert.equal(a.links.length, 1);
  assert.equal(a.links[0].download, 'escrituras-oficiais-mensal-2026-09-01-a-2026-09-30.csv');
  const rows = lerCsv(await a.blobs[0].text()), total = rows.find(r => r.secao === 'escrituras'), pessoa = rows.find(r => r.secao === 'responsavel');
  assert.equal(total.quantidade_oficial, '223'); assert.equal(pessoa.quantidade_observada, '15'); assert.equal(pessoa.quantidade_oficial, '');
  assert.equal(pessoa.receita_liquida_brl, ''); assert.equal(pessoa.ultimo_escrevente_antes_arquivo_trello, '5'); assert.equal(pessoa.com_cartao_trello, '14');
  assert.equal(rows.find(r => r.secao === 'receita_mensal_cartorio').receita_liquida_brl, '704,31');
  assert.equal(rows.find(r => r.secao === 'receita_por_autor').receita_liquida_brl, '');
  assert(a.chamadas.every(x => !x.url.includes('/enviar') && !x.options));
});

test('exportação oficial preserva cinco métodos, corte real, dados originais e neutraliza células de fórmula', () => {
  for (const nome of ['=HYPERLINK("x";"y")', '+1+1', '-1+1', '@SUM(1)', '\t=1', '\n=1', '  =1', 'Pessoa; "fictícia"\nsegunda linha']) {
    const a = ambiente(), resumo = resumoOficial(); resumo.colaboradores[0].nome = nome; resumo.tipos[0].nome = '<img src=x onerror=fixture()>';
    const antes = JSON.stringify(resumo), dados = dadosOficiais(a, resumo), html = a.c.relOficialHtml(dados), csv = a.c.relOficialCsv(dados), rows = lerCsv(csv);
    assert.equal(JSON.stringify(resumo), antes);
    assert.match(html, /2026-10-09T15:00:00Z/); assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img|<script/);
    assert.equal(rows.find(r => r.secao === 'cobertura').corte_em, '2026-10-09T15:00:00Z');
    const pessoa = rows.find(r => r.secao === 'responsavel');
    assert.equal(pessoa.direta, '1'); assert.equal(pessoa.auditoria_concordante, '2'); assert.equal(pessoa.trello_divergencia, '3');
    assert.equal(pessoa.movimentacao_arquivo_trello, '4'); assert.equal(pessoa.ultimo_escrevente_antes_arquivo_trello, '5');
    assert.equal(pessoa.descricao, nome.startsWith('Pessoa') ? nome : "'" + nome);
    assert.match(csv, /Minuta\/Lavratura/); assert.match(csv, /Não comprova clique manual/);
  }
});

test('prévia e CSV incluem Criado Por gerencial sem alterar receita mensal nem atribuir receita individual', () => {
  const a = ambiente(), resumo = resumoOficial(), originalReceita = JSON.stringify(setembro());
  const metodos = { direta: 0, auditoria_concordante: 0, trello_divergencia: 0, movimentacao_arquivo_trello: 0, ultimo_escrevente_antes_arquivo_trello: 0, criado_por_extra: 15 };
  Object.assign(resumo.colaboradores[0], { fonte: 'Extra Digital', marcos: ['atribuicao_gerencial'], metodos: { ...metodos }, com_cartao_trello: 0 });
  Object.assign(resumo.autoria, { metodos, com_cartao_trello: 0 });
  const original = JSON.stringify(resumo), dados = dadosOficiais(a, resumo), html = a.c.relOficialHtml(dados), rows = lerCsv(a.c.relOficialCsv(dados));
  assert.match(html, /Criado Por — Extra Digital: 15/); assert.match(html, /usuário criador registrado no Extra Digital/);
  assert.match(html, /não é comprovação de quem executou fisicamente a lavratura/); assert.match(html, /não são convertidas automaticamente/);
  assert.match(html, /Total oficial: 223/); assert.match(html, /Responsável não identificado: 208/);
  const pessoa = rows.find(r => r.secao === 'responsavel'), total = rows.find(r => r.secao === 'escrituras');
  assert.equal(pessoa.criado_por_extra, '15'); assert.equal(total.criado_por_extra, '15'); assert.equal(total.quantidade_oficial, '223');
  assert.equal(pessoa.fonte, 'Extra Digital'); assert.equal(pessoa.quantidade_oficial, ''); assert.equal(pessoa.receita_liquida_brl, '');
  assert.equal(pessoa.ultimo_escrevente_antes_arquivo_trello, '0'); assert.equal(pessoa.com_cartao_trello, '0');
  assert.equal(rows.find(r => r.secao === 'criterio_metodo' && r.id === 'criado_por_extra').descricao, 'Criado Por — Extra Digital');
  assert.equal(rows.find(r => r.secao === 'receita_mensal_cartorio').receita_liquida_brl, '704,31');
  assert.equal(rows.find(r => r.secao === 'receita_por_autor').status, 'pendente_vinculo_financeiro_por_ato');
  assert.equal(JSON.stringify(resumo), original); assert.equal(JSON.stringify(setembro()), originalReceita);
});

test('base ausente e receita indisponível não exportam zeros; zero coberto continua documentado', () => {
  const a = ambiente(), resumo = resumoOficial();
  resumo.total_observado = 0; resumo.total_oficial = null; resumo.cobertura_completa = false; resumo.com_vinculo = resumo.sem_vinculo = 0;
  resumo.meses = []; resumo.tipos = []; resumo.colaboradores = [];
  resumo.autoria = { status: 'pendente', com_autoria_confirmada: 0, sem_autoria_confirmada: 0, cobertura_completa: false };
  const dados = dadosOficiais(a, resumo, null), rows = lerCsv(a.c.relOficialCsv(dados)), html = a.c.relOficialHtml(dados);
  assert.match(html, /Total oficial: Indisponível/); assert.match(html, /Base oficial ausente/);
  assert.equal(rows.find(r => r.secao === 'escrituras').quantidade_observada, '');
  assert.equal(rows.find(r => r.secao === 'escrituras').quantidade_oficial, '');
  assert.equal(rows.find(r => r.secao === 'receita_mensal_cartorio').receita_liquida_brl, '');
  assert.equal(rows.find(r => r.secao === 'receita_mensal_cartorio').status, 'indisponivel');
  const r = resumoOficial(); r.total_observado = r.total_oficial = r.com_vinculo = r.sem_vinculo = 0; r.tipos = []; r.colaboradores = [];
  r.meses[0].total_observado = r.meses[0].total_oficial = r.meses[0].com_vinculo = r.meses[0].sem_vinculo = 0;
  r.autoria = { status: 'pendente', com_autoria_confirmada: 0, sem_autoria_confirmada: 0, cobertura_completa: true };
  assert.match(a.c.relOficialHtml(dadosOficiais(a, r)), /Total oficial: 0/);
  assert.equal(lerCsv(a.c.relOficialCsv(dadosOficiais(a, r))).find(x => x.secao === 'escrituras').quantidade_oficial, '0');
});

test('cobertura parcial mantém observado sem inventar oficial; semana separa competências financeiras', () => {
  const a = ambiente(), r = resumoOficial();
  r.total_oficial = null; r.cobertura_completa = false; r.tipos[0].total_oficial = null;
  Object.assign(r.meses[0], { total_oficial: null, cobertura_completa: false, ate: '2026-09-15', corte_em: '2026-09-15T15:00:00Z', dia_final_completo: false });
  let dados = dadosOficiais(a, r), rows = lerCsv(a.c.relOficialCsv(dados));
  assert.match(a.c.relOficialHtml(dados), /Cobertura parcial/); assert.equal(rows.find(x => x.secao === 'escrituras').quantidade_oficial, '');
  assert.equal(rows.find(x => x.secao === 'escrituras').quantidade_observada, '223');
  const semana = resumoOficial(); semana.inicio = '2026-09-28'; semana.fim = '2026-10-04'; semana.cobertura_completa = false;
  semana.total_oficial = null; semana.tipos[0].total_oficial = null;
  dados = dadosOficiais(a, semana, fonte('2026-09-28', '2026-10-04', ['2026-09', '2026-10']), 'semanal', '2026-10-05');
  rows = lerCsv(a.c.relOficialCsv(dados));
  const fin = rows.filter(x => x.secao === 'receita_mensal_cartorio');
  assert.deepEqual(fin.map(x => [x.competencia, x.receita_liquida_brl]), [['2026-09','704,31'], ['2026-10','1408,62']]);
  assert.match(a.c.relOficialHtml(dados), /não representam receita semanal/); assert.doesNotMatch(a.c.relOficialHtml(dados), /2\.112,93/);
});

test('falha ou contrato oficial inválido bloqueia prévia/CSV e não recorre ao histórico', async () => {
  for (const csv of [false, true]) for (const invalido of [false, true]) {
    const a = ambiente(), p = csv ? a.c.relBaixarCsv() : a.c.relVerPrevia();
    if (invalido) { const r = resumoOficial(); r.inicio = '2026-08-01'; a.chamadas[0].resolve(r); }
    else a.chamadas[0].reject({ status: 404, erro: 'fonte oficial indisponível' });
    a.chamadas[1].resolve({ receita_mensal: setembro() }); await p;
    assert.equal(a.blobs.length, 0); assert.equal(a.downloads.length, 0); assert.equal(a.el('edRelPrevia').frame.srcdoc, '');
    if (!csv) assert.match(a.el('edRelPrevia').innerHTML, /indisponível/);
  }
  const a = ambiente(), p = a.c.relVerPrevia(); a.chamadas[0].resolve(resumoOficial()); a.chamadas[1].reject({ status: 500 }); await p;
  assert.match(a.el('edRelPrevia').frame.srcdoc, /Total oficial: 223/);
  assert.match(a.el('edRelPrevia').frame.srcdoc, /Receita líquida do cartório<\/span><strong>Indisponível/);
});

test('prévia e CSV tardios são descartados após sessão, competência, perfil, aba ou host mudarem', async () => {
  const mudancas = [a => { a.c.SESSAO.token = 'nova'; }, a => { a.c.SESSAO.login = 'outra'; }, a => { a.c.SESSAO.admin = false; },
    a => { a.c.ED.rel.ref = '2026-11-01'; }, a => { a.c.ED.rel.tipo = 'semanal'; }, a => { a.c.ED.rel.visao = 'produtividade'; },
    a => { a.c.ED.aba = 'outra'; }, a => { a.el('edRelPrevia').isConnected = false; }, a => { a.c.ED.rel = { ...a.c.ED.rel }; }];
  for (const csv of [false, true]) for (const mudar of mudancas) {
    const a = ambiente(), p = csv ? a.c.relBaixarCsv() : a.c.relVerPrevia(); mudar(a);
    a.el('edRelPrevia').innerHTML = 'novo estado'; a.chamadas[0].resolve(resumoOficial()); a.chamadas[1].resolve({ receita_mensal: setembro() }); await p;
    assert.equal(a.el('edRelPrevia').innerHTML, 'novo estado'); assert.equal(a.el('edRelPrevia').frame.srcdoc, ''); assert.equal(a.blobs.length, 0);
  }
});

test('nova consulta do mesmo período supera anterior, inclusive CSV e ida e volta de competência', async () => {
  for (const csv of [false, true]) {
    const a = ambiente(), executar = () => csv ? a.c.relBaixarCsv() : a.c.relVerPrevia(), antiga = executar(), nova = executar();
    a.chamadas[2].resolve(resumoOficial()); a.chamadas[3].resolve({ receita_mensal: setembro() }); await nova;
    a.chamadas[0].resolve(resumoOficial()); a.chamadas[1].resolve({ receita_mensal: setembro() }); await antiga;
    assert.equal(a.blobs.length, csv ? 1 : 0);
    const posterior = executar();
    vm.runInContext('relLavradosMensal=()=>{}; relCarregarReceita=()=>{}', a.c);
    a.c.ED.rel.ref = '2026-11-01'; a.c.relAtualizarPeriodo(); a.c.ED.rel.ref = '2026-10-01'; a.c.relAtualizarPeriodo();
    a.chamadas[4].resolve(resumoOficial()); a.chamadas[5].resolve({ receita_mensal: setembro() }); await posterior;
    assert.equal(a.el('edRelPrevia').innerHTML, ''); assert.equal(a.blobs.length, csv ? 1 : 0);
  }
});

test('histórico continua em endpoint separado e botões oficiais não disparam envios', async () => {
  const a = ambiente(), p = a.c.relGerarSaida('html', true);
  assert.match(a.downloads[0].url, /\/hub\/relatorios\/previa\?tipo=mensal&ref=2026-10-01$/);
  a.downloads[0].resolve({ ok: true, text: async () => '<p>fixture histórico</p>' }); await p;
  assert.equal(a.chamadas.length, 0); assert.match(a.el('edRelHistoricoPrevia').innerHTML, /Histórico Trello/);
  assert.equal(a.el('edRelPrevia').frame.srcdoc, '');
  const painel = { innerHTML: '' }; vm.runInContext('relCarregarSituacao=()=>{};relCarregarEnvios=()=>{};relLavradosMensal=()=>{}', a.c);
  a.c.pintarAbaRelatorios(painel);
  const inicio = painel.innerHTML.indexOf('<details class="rel-suporte"><summary>Histórico');
  assert(inicio > painel.innerHTML.indexOf('id="edRelCsv"'));
  assert(painel.innerHTML.indexOf('id="edRelEnviar"') > inicio);
  assert(painel.innerHTML.indexOf('O envio automático') > inicio);
  assert.equal(a.el('edRelEnviar').handlers.click, a.c.relEnviar);
});

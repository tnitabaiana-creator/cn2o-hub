'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const P = require('../gestao-produtividade.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const defer = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const html = '<!doctype html><html><head><title>Relatório</title><script>window.original=true;</script></head><body>Teste</body></html>';
const resposta = (extra = {}) => ({ html, meses: null, revisao: 1, ...extra });
const dados = n => ({ mes: { ano: '2026', total: n } });
function ambiente(apiExtra, extra = {}) {
  class El {
    constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.handlers = {}; this.classList = { toggle() {} }; if (tag === 'iframe') this.contentWindow = {}; }
    setAttribute(k, v) { this.attributes[k] = v; }
    append(...els) { els.forEach(el => { el.parent = this; this.children.push(el); }); }
    replaceChildren(...els) { this.children.forEach(el => { el.parent = null; }); this.children = []; this.append(...els); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(el => el !== this); this.parent = null; }
    addEventListener(k, fn) { this.handlers[k] = fn; }
    click() { if (this.handlers.click) this.handlers.click(); }
  }
  const doc = { createElement: tag => new El(tag) }, host = new El('div'); host.ownerDocument = doc;
  const session = { login: 'gestor', token: 'token-privado', admin: true }, events = {}, calls = [];
  let interval = null, expired = 0;
  const win = {
    crypto: { getRandomValues: arr => arr.fill(23) },
    addEventListener: (k, fn) => { events[k] = fn; }, removeEventListener: k => { delete events[k]; },
    setInterval: fn => { interval = fn; return 1; }, clearInterval: () => { interval = null; }, confirm: () => true
  };
  const op = { host, document: doc, window: win, sessao: () => session, financeiroCanonico: false,
    api: async (path, config) => { calls.push({ path, config }); return apiExtra ? apiExtra(path, config) : resposta(); },
    expirada: () => expired++, ...extra };
  const controle = P.montar(op);
  const find = tag => { const walk = el => el.tagName === tag ? el : el.children.map(walk).find(Boolean); return walk(host); };
  const message = (value, patch = {}) => {
    const f = find('iframe');
    const canal = f.srcdoc.match(/"canal":"([^"]+)"/)[1];
    const e = { source: f.contentWindow, origin: 'null', data: { tipo: 'cn2o-produtividade-estado', chave: 'CN2O_MONTHS_V2', canal, valor: JSON.stringify(value) }, ...patch };
    if (events.message) events.message(e);
  };
  return { host, session, calls, controle, message, find, events, win, expired: () => expired, monitor: () => interval && interval() };
}
test('srcdoc isola rede, usa memória e não permite encerrar o script por dado importado', () => {
  const doc = P.prepararDocumento(html, { mes: { nome: '</script><script>roubar()</script>' } }, 'canal');
  assert.match(doc, /connect-src 'none'/); assert.match(doc, /base-uri 'none'/);
  assert.equal((doc.match(/<script\b/g) || []).length, 2);
  assert.match(doc, /\\u003c\/script>/);
  assert.ok(doc.indexOf('cn2o-produtividade-ponte') < doc.indexOf('window.original'));
  assert.doesNotMatch(P.SANDBOX, /allow-same-origin/);
  assert.match(P.SANDBOX, /allow-downloads/);
});
test('adaptador não grava na carga, deduplica mensagens e exporta o estado mais recente', () => {
  const doc = P.prepararDocumento(html, dados(1), 'aleatorio'), events = {}, enviados = [], ponte = {};
  const contexto = { parent: { postMessage: m => enviados.push(m) }, document: { addEventListener: (k, fn) => { events[k] = fn; }, getElementById: () => ponte }, URL };
  contexto.window = contexto;
  vm.runInNewContext(doc.match(/<script id="cn2o-produtividade-ponte">([\s\S]*?)<\/script>/)[1], contexto);
  assert.equal(enviados.length, 0); assert.equal(contexto.localStorage.getItem('outra-chave'), null);
  contexto.localStorage.setItem('CN2O_MONTHS_V2', JSON.stringify(dados(1))); assert.equal(enviados.length, 0);
  contexto.localStorage.setItem('CN2O_MONTHS_V2', JSON.stringify(dados(2))); assert.equal(enviados.length, 1);
  assert.throws(() => contexto.localStorage.removeItem('CN2O_MONTHS_V2'), /Restaurar/);
  events.click({ target: { closest: sel => sel === 'button' ? { id: 'btnDownloadHtml' } : null } });
  assert.match(ponte.textContent, /"total":2/);
});
test('fontes remotas são removidas e estruturas perigosas recusadas', () => {
  const result = P.prepararDocumento('<head><link href="https://fonts.googleapis.com/x"><base href="https://externo/"></head>', null, 'x');
  assert.doesNotMatch(result, /fonts\.googleapis|<base\b/);
  assert.throws(() => P.validarMeses(JSON.parse('{"__proto__":{}}')), /Estrutura/);
  assert.throws(() => P.validarMeses([]), /Formato/);
});
test('adaptação mobile vem após os estilos originais e mantém tabelas com rolagem própria', () => {
  const base = '<html><head><style>.fn{grid-template-columns:220px 1fr 170px}</style></head><body>teste</body></html>';
  const result = P.prepararDocumento(base, null, 'x');
  assert.ok(result.indexOf('cn2o-produtividade-responsivo') > result.indexOf('220px 1fr 170px'));
  assert.match(result, /@media\(max-width:600px\)/);
  assert.match(result, /\.panel\.tight\{padding:0;overflow-x:auto\}/);
  assert.doesNotMatch(result, /overflow-x:hidden/);
  assert.match(result, /<body>teste<\/body>/);
});
test('não consulta API sem administração autorizada', async () => {
  const a = ambiente(null, { sessao: () => ({ token: 'x', login: 'x', admin: false }) });
  await tick(); assert.equal(a.calls.length, 0); assert.equal(a.find('iframe'), undefined); a.controle.destruir();
});
test('carga não grava e não transmite token ou login ao documento', async () => {
  const a = ambiente(); await tick(); const f = a.find('iframe');
  assert.ok(f); assert.doesNotMatch(f.srcdoc, /token-privado|"login"/); assert.equal(a.calls.length, 1);
  assert.equal(f.attributes.sandbox, P.SANDBOX); a.controle.destruir();
});
test('logout durante GET descarta HTML e limpa listener', async () => {
  const d = defer(), a = ambiente(() => d.promise); a.session.token = ''; d.resolve(resposta()); await tick();
  assert.equal(a.find('iframe'), undefined); assert.equal(a.host.children.length, 0); assert.equal(a.events.message, undefined); assert.equal(a.expired(), 1);
});
test('destruir durante carga evita ressuscitar documento, e monitor detecta troca de pessoa', async () => {
  const d = defer(), a = ambiente(() => d.promise); a.controle.destruir(); d.resolve(resposta()); await tick(); assert.equal(a.host.children.length, 0);
  const b = ambiente(); await tick(); const f = b.find('iframe'); b.session.login = 'outra'; b.monitor(); assert.equal(f.srcdoc, ''); assert.equal(b.host.children.length, 0);
});
test('mensagens de outra janela, origem, chave ou canal não salvam', async () => {
  const a = ambiente(); await tick();
  a.message(dados(1), { source: {} }); a.message(dados(1), { origin: 'https://hub.exemplo' });
  a.message(dados(1), { data: { tipo: 'cn2o-produtividade-estado', canal: 'outro', chave: 'CN2O_MONTHS_V2', valor: '{}' } });
  await tick(); assert.equal(a.calls.length, 1); a.controle.destruir();
});
test('salva serialmente e usa a revisão confirmada sem perder a última edição', async () => {
  const saves = [], a = ambiente((path, config) => { if (!config) return resposta(); const d = defer(); saves.push({ ...d, config }); return d.promise; });
  await tick(); a.message(dados(1)); a.message(dados(2)); a.message(dados(3));
  assert.equal(saves.length, 1); assert.equal(saves[0].config.corpo.revisao, 1);
  saves[0].resolve({ revisao: 2 }); await tick(); assert.equal(saves.length, 2);
  assert.equal(saves[1].config.corpo.revisao, 2); assert.deepEqual(saves[1].config.corpo.meses, dados(3));
  saves[1].resolve({ revisao: 3 }); await tick(); a.message(dados(3)); assert.equal(saves.length, 2); a.controle.destruir();
});
test('falha de rede preserva alterações e retry reenvia a mais recente', async () => {
  let n = 0; const a = ambiente((path, config) => { if (!config) return resposta(); if (++n === 1) throw new Error('rede'); return { revisao: 2 }; });
  await tick(); a.message(dados(1)); await tick(); a.message(dados(2)); await tick(); assert.equal(n, 1);
  a.find('button').click(); await tick(); assert.equal(n, 2); assert.deepEqual(a.calls[2].config.corpo.meses, dados(2)); a.controle.destruir();
});
test('409 interrompe salvamentos até reabrir, sem sobrescrever versão nova', async () => {
  let n = 0; const a = ambiente((path, config) => { if (!config) return resposta(); n++; throw Object.assign(new Error('conflito'), { status: 409 }); });
  await tick(); a.message(dados(1)); await tick(); a.message(dados(2)); await tick(); assert.equal(n, 1);
  assert.equal(a.find('button').textContent, 'Reabrir versão salva');
  a.win.confirm = () => false; a.find('button').click(); await tick(); assert.equal(a.calls.length, 2);
  a.win.confirm = () => true; a.find('button').click(); await tick(); assert.equal(a.calls.length, 3); assert.equal(n, 1); a.controle.destruir();
});
test('logout durante POST impede gravação da fila e remove relatório privado', async () => {
  const d = defer(); const a = ambiente((path, config) => config ? d.promise : resposta());
  await tick(); a.message(dados(1)); a.message(dados(2)); a.session.token = ''; d.resolve({ revisao: 2 }); await tick();
  assert.equal(a.calls.length, 2); assert.equal(a.host.children.length, 0);
});
test('impede sair com alteração em trânsito ou pendente e libera ao salvar; logout limpa a proteção', async () => {
  const d = defer(), a = ambiente((path, config) => config ? d.promise : resposta());
  await tick(); assert.equal(a.controle.podeSair(), true);
  a.message(dados(1)); assert.equal(a.controle.ocupado(), true); assert.equal(a.controle.podeSair(), false);
  let impedido = false; const ev = { preventDefault() { impedido = true; } };
  a.events.beforeunload(ev); assert.equal(impedido, true); assert.equal(ev.returnValue, '');
  d.resolve({ revisao: 2 }); await tick(); assert.equal(a.controle.podeSair(), true);
  impedido = false; a.events.beforeunload(ev); assert.equal(impedido, false);
  a.controle.destruir(); assert.equal(a.events.beforeunload, undefined); assert.equal(a.controle.ocupado(), false);
});
test('estado pendente após falha mantém proteção de navegação', async () => {
  const a = ambiente((path, config) => { if (config) throw new Error('rede'); return resposta(); });
  await tick(); a.message(dados(1)); await tick(); assert.equal(a.controle.podeSair(), false); a.controle.destruir();
});
test('erro de carregamento permite nova tentativa sem HTML residual', async () => {
  let n = 0; const a = ambiente(() => { if (++n === 1) throw new Error('rede'); return resposta(); });
  await tick(); assert.equal(a.find('iframe'), undefined); assert.equal(a.find('button').hidden, false);
  a.find('button').click(); await tick(); assert.ok(a.find('iframe')); a.controle.destruir();
});

test('ponte comunica apenas o mês financeiro e os meses disponíveis, sem dados pessoais', () => {
  const doc = P.prepararDocumento(html, null, 'canal'), events = {}, enviados = [];
  const ctx = { parent: { postMessage: m => enviados.push(m) }, document: { addEventListener: (k, fn) => { events[k] = fn; } }, URL,
    M: { junho: { nome: 'Junho', ano: '2026', users: [{ nome: 'PESSOA-PRIVADA' }], total: 9000 }, setembro: { nome: 'Setembro', ano: '2026' } }, CUR: 'junho' };
  ctx.window = ctx;
  vm.runInNewContext(doc.match(/<script id="cn2o-produtividade-ponte">([\s\S]*?)<\/script>/)[1], ctx);
  events.DOMContentLoaded();
  assert.equal(enviados.length, 1); assert.equal(enviados[0].tipo, 'cn2o-produtividade-periodo'); assert.equal(enviados[0].mes, '2026-06');
  assert.deepEqual(Array.from(enviados[0].meses), ['2026-06', '2026-09']);
  assert.doesNotMatch(JSON.stringify(enviados), /PESSOA-PRIVADA|9000/);
  ctx.M.parcial = { nome: 'Setembro parcial', ano: '2026' }; ctx.CUR = 'parcial';
  events.DOMContentLoaded(); assert.equal(enviados[1].mes, null, 'nome livre deve desfazer a associação anterior');
});

test('painel oficial acompanha mês do iframe somente por canal e origem válidos; destruição limpa ambos', async () => {
  const selecoes = [], mounts = []; let destruido = 0;
  const a = ambiente(null, { lavrados: { montar: op => { mounts.push(op); return { selecionar: (...args) => selecoes.push(args), destruir: () => destruido++ }; } } });
  await tick(); assert.equal(mounts.length, 1);
  const f = a.find('iframe'), canal = f.srcdoc.match(/"canal":"([^"]+)"/)[1];
  const data = { tipo: 'cn2o-produtividade-periodo', canal, mes: '2026-06', meses: ['2026-06', '2026-09'] };
  a.events.message({ source: {}, origin: 'null', data });
  a.events.message({ source: f.contentWindow, origin: 'https://outro', data });
  a.events.message({ source: f.contentWindow, origin: 'null', data: { ...data, mes: '2026-99' } });
  assert.equal(selecoes.length, 0);
  a.events.message({ source: f.contentWindow, origin: 'null', data });
  assert.deepEqual(selecoes, [['2026-06', ['2026-06', '2026-09']]]);
  assert.equal(a.calls.length, 1, 'selecionar mês não grava o relatório');
  a.controle.destruir(); assert.equal(destruido, 1);
});

test('adaptação V3 identifica períodos financeiros e de cartões sem mudar scores ou totais', () => {
  const base = '<html><head></head><body><script>const TRELLO_DATA = {};</script></body></html>';
  const source = P.prepararDocumento(base, null, 'canal');
  const match = source.match(/<script id="cn2o-historico-periodos">([\s\S]*?)<\/script>/);
  assert.match(source, /A exportação deste HTML não incorpora a fonte oficial/);
  assert.ok(match); assert.equal((P.prepararDocumento(source, null, 'outro').match(/id="cn2o-historico-periodos"/g) || []).length, 1);
  const heads = Array.from({ length: 4 }, () => ({})); let nota = null, chamadas = 0;
  const table = { parentNode: { insertBefore: node => { nota = node; } }, querySelectorAll: () => heads };
  const M = { junho: { nome: 'Junho', ano: '2026', total: 100, atos: 15 } }, TRELLO_DATA = { score: 3.4, finalizados: 7 };
  const ctx = { M, TRELLO_DATA, CUR: 'junho', TPER: 'set', PER_LBL: { set: 'Setembro/2026', out: 'Outubro/2026 (01–07)' }, tFusao: () => chamadas++,
    document: { getElementById: id => id === 'tblFusao' ? table : nota, createElement: () => ({ style: {} }) } };
  vm.runInNewContext(match[1], ctx);
  assert.match(nota.textContent, /financeiro de Junho\/2026; cartões arquivados de Setembro\/2026/);
  assert.match(heads[2].textContent, /Lançamentos financeiros/); assert.match(heads[3].textContent, /Cartões arquivados/);
  ctx.tFusao('out'); assert.equal(chamadas, 1); assert.match(nota.textContent, /Outubro\/2026/);
  assert.deepEqual(M, { junho: { nome: 'Junho', ano: '2026', total: 100, atos: 15 } }); assert.deepEqual(TRELLO_DATA, { score: 3.4, finalizados: 7 });
});

// Contrato sintético, sem dados privados. Os centavos já vêm projetados do servidor.
function financeiroFixture(mes = 9) {
  const mm = String(mes).padStart(2,'0');
  const pessoa = { id:'operador.teste', nome:'Operador fictício', atos:10, total:1000, mediana:50, max:500, dias:2 };
  const bruto = {v:1,total:1000,atos:10,diasUteis:20,mediana:50,pessoas:[pessoa],pgto:[{forma:'PIX',qtd:10,total:1000}],faixas:[{faixa:'R$ 5–12',qtd:10,total:1000}],serie:{dias:[`2026-${mm}-01`,`2026-${mm}-02`],total:[400,600],porPessoa:{'operador.teste':[400,600]}}};
  const liquido = JSON.parse(JSON.stringify(bruto)); Object.assign(liquido,{total:704.31,mediana:35.22,base_receita:'liquida_apos_repasses',versao_financeira:'receita-liquida-2026-10-v1'});
  Object.assign(liquido.pessoas[0],{total:704.31,total_bruto:1000,mediana:35.22,max:352.15});
  liquido.pgto[0].total=liquido.faixas[0].total=704.31; liquido.serie.total=[281.72,422.59]; liquido.serie.porPessoa['operador.teste']=[281.72,422.59];
  return {ano:2026,mes,dados:bruto,dados_liquidos:liquido,financeiro:{bruto:1000,repasses:295.69,receita_liquida:704.31,percentual_repasses:29.5694,criterio:'Após repasses, antes de despesas e IR.',versao:'receita-liquida-2026-10-v1',centavos:{bruto:100000,repasses:29569,receita_liquida:70431},notas:[]}};
}
const v3 = '<!doctype html><html><head></head><body><script>\n/* --- INICIO_BASE_DATA --- */\nconst BASE_DATA = {antigo:220805.63};\n/* --- FIM_BASE_DATA --- */\nlet CUR = "setembro";\nrefreshSelectors();\nrender();\n</script></body></html>';

test('projeção canônica usa valores líquidos do servidor uma única vez e preserva bruto original', () => {
  const api={meses:[financeiroFixture()]}, anterior=JSON.stringify(api), p=P.projetarFinanceiro(api), m=p.meses['2026-09'];
  assert.equal(JSON.stringify(api),anterior); assert.equal(m.total,704.31); assert.equal(m.atos,10); assert.equal(m.ticket,70.43); assert.equal(m.mediaDiaria,35.22);
  assert.equal(m.users[0].total,704.31); assert.equal(m.users[0].total_bruto,1000); assert.equal(m.users[0].max,352.15);
  assert.equal(m.pgto[0].total,704.31); assert.equal(m.faixas[0].total,704.31); assert.equal(m.faixas[0].faixa,'R$ 5–12');
  assert.deepEqual(m.serieDiaria,[281.72,422.59]); assert.deepEqual(m.porUsuarioDia['Operador fictício'],[281.72,422.59]);
  assert.equal(p.canonicos[0].dados.total,1000); assert.equal(p.canonicos[0].dados_liquidos.total,704.31);
  m.users[0].total=0; assert.equal(api.meses[0].dados_liquidos.pessoas[0].total,704.31);
});

test('contrato financeiro inválido, duplicado e série em outra competência são rejeitados', () => {
  assert.throws(()=>P.projetarFinanceiro({meses:[]}),/indisponível/);
  const x=financeiroFixture(); assert.throws(()=>P.projetarFinanceiro({meses:[x,x]}),/repetida/);
  x.dados_liquidos.versao_financeira='bruto'; assert.throws(()=>P.projetarFinanceiro({meses:[x]}),/Contrato/);
  const y=financeiroFixture(); y.dados_liquidos.serie.dias[0]='2026-08-01'; assert.throws(()=>P.projetarFinanceiro({meses:[y]}),/Série/);
});

test('grupo por pessoa incompleto preserva total e valores da fonte com alerta, sem residual inventado', () => {
  const row=financeiroFixture(); row.dados.pessoas[0].atos=row.dados_liquidos.pessoas[0].atos=9;
  row.dados.pessoas[0].total=900; row.dados_liquidos.pessoas[0].total=633.88; row.dados_liquidos.pessoas[0].total_bruto=900;
  row.financeiro.notas=[{grupo:'pessoas',codigo:'GRUPO_NAO_RECONCILIADO',mensagem:'Grupo incompleto na fonte.'}];
  const original=JSON.stringify(row),p=P.projetarFinanceiro({meses:[row]}),m=p.meses['2026-09'];
  assert.equal(m.total,704.31); assert.equal(m.atos,10); assert.equal(m.users.length,1); assert.equal(m.users[0].total,633.88); assert.equal(m.users[0].atos,9);
  assert.ok(m.financeiro.notas.some(n=>n.codigo==='QUANTIDADES_NAO_RECONCILIADAS')); assert.ok(m.financeiro.notas.some(n=>n.codigo==='PESSOAS_NAO_RECONCILIADAS'));
  assert.equal(JSON.stringify(row),original); assert.equal(p.canonicos[0].financeiro.notas.length,1);
});

test('srcdoc financeiro remove base antiga apenas da cópia e leva snapshot bruto e líquido versionado', () => {
  const p=P.projetarFinanceiro({meses:[financeiroFixture()]}), d=P.prepararDocumento(v3,{antigo:220805.63},'canal',p);
  assert.doesNotMatch(d,/220805\.63/); assert.match(v3,/220805\.63/); assert.match(d,/"canonicos":/); assert.match(d,/"total":1000/); assert.match(d,/"total":704\.31/);
  assert.match(d,/receita-liquida-2026-10-v1/); assert.match(d,/connect-src 'none'/); assert.doesNotMatch(P.SANDBOX,/allow-same-origin/);
  const repetido=P.prepararDocumento(d,null,'novo',p);
  assert.equal((repetido.match(/id="cn2o-produtividade-ponte"/g)||[]).length,1); assert.equal((repetido.match(/\/\* CN2O_FINANCEIRO_VIEW_INICIO \*\//g)||[]).length,1);
  assert.throws(()=>P.prepararDocumento(html,null,'x',p),/Estrutura V3/);
});

test('financeiro é consultado pelo pai autenticado e mensagens de estado líquido nunca provocam POST', async () => {
  const a=ambiente(path=>path==='/hub/relatorios/produtividade'?{meses:[financeiroFixture()]}:resposta({html:v3}),{financeiroCanonico:true});
  await tick(); const f=a.find('iframe'); assert.ok(f); assert.equal(a.calls.length,2); assert.doesNotMatch(f.srcdoc,/token-privado/);
  assert.deepEqual(a.calls.map(c=>c.path),['/hub/gestao/produtividade-escrituras','/hub/relatorios/produtividade']);
  a.message({setembro:{total:704.31}}); await tick(); assert.equal(a.calls.length,2); assert.equal(a.controle.ocupado(),false); a.controle.destruir();
});

test('falha da fonte financeira fecha V3 sem recorrer ao histórico; retry recarrega as duas fontes', async () => {
  let falha=true;
  const a=ambiente(path=>{if(path==='/hub/relatorios/produtividade'){if(falha)throw new Error('indisponível');return {meses:[financeiroFixture()]};}return resposta({html:v3});},{financeiroCanonico:true});
  await tick(); assert.equal(a.find('iframe'),undefined); assert.equal(a.find('button').hidden,false);
  falha=false; a.find('button').click(); await tick(); assert.ok(a.find('iframe')); assert.equal(a.calls.length,4); a.controle.destruir();
});

test('logout durante a segunda consulta privada impede criar iframe financeiro', async () => {
  const d=defer(),a=ambiente(path=>path==='/hub/relatorios/produtividade'?d.promise:resposta({html:v3}),{financeiroCanonico:true});
  a.session.token=''; d.resolve({meses:[financeiroFixture()]}); await tick(); assert.equal(a.find('iframe'),undefined); assert.equal(a.expired(),1);
});

function runtimeFinanceiro(documento) {
  const elements=new Map(), downloads=[], blobs=[], events={}, enviados=[];
  const element=(id)=>{if(!elements.has(id)){const classes=new Set();elements.set(id,{id,innerHTML:'',textContent:'',style:{},value:'',options:[],children:[],dataset:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,b)=>b?classes.add(x):classes.delete(x)},appendChild(x){this.children.push(x);this.options.push(x);},insertBefore(){},querySelectorAll:()=>[],click(){if(this.download)downloads.push(this);},setAttribute(){}});}return elements.get(id);};
  const document={getElementById:element,createElement:tag=>element('new'+elements.size+tag),querySelectorAll:()=>[],querySelector:()=>null,addEventListener:(k,f)=>events[k]=f,createTreeWalker:()=>({nextNode:()=>null}),head:{appendChild(){}},body:{insertBefore(){}},documentElement:{outerHTML:documento}};
  const ctx={document,URL:{createObjectURL:b=>{blobs.push(b);return 'blob:'+blobs.length;},revokeObjectURL(){}},Blob,parent:{postMessage:m=>enviados.push(m)},setTimeout:()=>0,clearTimeout(){},console:{log(){},error(){}},Chart:function(el,config){this.config=config;this.destroy=()=>{};}};
  ctx.Chart.defaults={font:{},plugins:{}};
  ctx.window=ctx; vm.createContext(ctx);
  // Execute the actual original dashboard script, but stub canvas/Chart and browser layout.
  const scripts=Array.from(documento.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)).map(x=>x[1]);
  scripts.filter(s=>s.includes('Object.defineProperty(window, \'localStorage\'')).forEach(s=>vm.runInContext(s,ctx));
  const main=scripts.find(s=>s.includes('/* --- INICIO_BASE_DATA --- */'));
  if(main.includes('function refreshSelectors()'))vm.runInContext(main,ctx);
  else {
    Object.assign(ctx,{M:{},CUR:'setembro',COMP_TARGET:'none',persistMonths(){},handleFile(){},processCsvText(){},renderManageModal(){},cascata(){},caixa(){},getComparator:()=>null,kpis(){},observacoes(){},analise(){},mkChart(){},render(){},fmtBRL:n=>'R$ '+n.toFixed(2),num:String,pct:n=>n.toFixed(1)+'%',showToast(){},downloadDashboardHtml(){}});
    vm.runInContext(main.match(/\/\* CN2O_FINANCEIRO_VIEW_INICIO \*\/([\s\S]*?)\/\* CN2O_FINANCEIRO_VIEW_FIM \*\//)[1],ctx);
    vm.runInContext('kpis(M[CUR],null);observacoes(M[CUR]);',ctx);
  }
  return {ctx,element,events,enviados,downloads,blobs,run:s=>vm.runInContext(s,ctx)};
}

test('runtime da projeção exibe quatro KPIs, bloqueia edição e exporta CSV líquido identificado', async () => {
  const d=P.prepararDocumento(v3,null,'canal',P.projetarFinanceiro({meses:[financeiroFixture()]})),r=runtimeFinanceiro(d);
  assert.equal((r.element('kpis').innerHTML.match(/class="lbl"/g)||[]).length,4);
  assert.match(r.element('kpis').innerHTML,/Receita líquida/); assert.doesNotMatch(r.element('kpis').innerHTML,/>Ticket médio<|>FERD<|>IR</);
  ['btnOpenImport','btnOpenManage','btnResetDefaults','btnConfirmImport'].forEach(id=>assert.equal(r.element(id).disabled,true));
  r.ctx.localStorage.setItem('CN2O_MONTHS_V2','{"bruto":704.31}'); assert.equal(r.enviados.length,0);
  r.element('btnCsv').onclick(); const csv=await r.blobs[0].text(); assert.match(csv,/liquida_apos_repasses/); assert.match(csv,/704,31/); assert.doesNotMatch(csv,/"1000"/);
  r.element('btnDownloadHtml').onclick(); const exportado=await r.blobs[1].text(); assert.match(exportado,/"total":1000/); assert.match(exportado,/"total":704\.31/); assert.doesNotMatch(exportado,/220805\.63/);
  const reaberto=runtimeFinanceiro(exportado); assert.equal(reaberto.run('M[CUR].total'),704.31); assert.equal(reaberto.run('M[CUR].users[0].total'),704.31);
  assert.match(r.element('obsList').innerHTML,/valor bruto do lançamento/); assert.match(r.element('obsList').innerHTML,/Livro Caixa/);
});

test('KPI mensal inclui todos os atos e análise não atribui receita financeira por autoria', () => {
  const row=financeiroFixture(); row.dados.pessoas[0].nome=row.dados_liquidos.pessoas[0].nome='César Bravo';
  row.financeiro.base_individual='usuario_financeiro';
  row.financeiro.receita_por_autor={status:'pendente_vinculo_financeiro_por_ato',colaboradores:[],total_atribuido:null};
  const original=JSON.stringify(row),r=runtimeFinanceiro(P.prepararDocumento(v3,null,'canal',P.projetarFinanceiro({meses:[row]})));
  assert.match(r.element('kpis').innerHTML,/Receita líquida do cartório/);
  assert.match(r.element('kpis').innerHTML,/Setembro\/2026 · todos os atos da fonte mensal/);
  assert.match(r.element('kpis').innerHTML,/704\.31/);
  r.run('analise(M[CUR],null)');
  assert.match(r.element('analise').innerHTML,/Operador do lançamento financeiro/);
  assert.match(r.element('analise').innerHTML,/pendente de vínculo entre o lançamento e o ato/);
  assert.doesNotMatch(r.element('analise').innerHTML,/Atuação direta|entrega .*receita|receita gerada/);
  assert.equal(JSON.stringify(row),original);
});

// Opt-in private integration input remains outside git: SOURCE_V3=<original HTML> node --test ...
test('HTML V3 real renderiza todos os meses sintéticos e reabre exportação sem reaplicar repasses', {skip:!process.env.SOURCE_V3}, async () => {
  const fs=require('node:fs'),crypto=require('node:crypto'),source=fs.readFileSync(process.env.SOURCE_V3,'utf8'),hash=crypto.createHash('sha256').update(source).digest('hex');
  const projection=P.projetarFinanceiro({meses:[financeiroFixture(8),financeiroFixture(9)]});
  const d=P.prepararDocumento(source,null,'canal',projection),r=runtimeFinanceiro(d);
  assert.equal(r.run('M[CUR].total'),704.31); assert.equal(r.run('Object.keys(M).length'),2);
  assert.equal((r.element('kpis').innerHTML.match(/class="lbl"/g)||[]).length,4);
  r.run("setCurMonth('2026-08'); COMP_TARGET='auto'; render();"); assert.equal(r.run('getComparator(M[CUR])'),null);
  r.run("setCurMonth('2026-09'); COMP_TARGET='auto'; render();"); assert.equal(r.run('getComparator(M[CUR]).mes.total'),704.31);
  assert.equal(r.run("CHARTS.chFaixa.config.data.datasets[0].data[0]"),704.31); assert.equal(r.run("CHARTS.chFaixa.config.data.datasets[0].label"),'Receita líquida');
  const historico=r.run('JSON.stringify(TRELLO_DATA)');
  r.run('M[CUR].users[0].nome=ESC_FULL[ESC[0]]; M[CUR].users[0].total=123456789.99; render();');
  assert.match(r.element('tblFusao').innerHTML,/Receita por autor/);
  assert.match(r.element('tblFusao').innerHTML,/Pendente de vínculo/);
  assert.doesNotMatch(r.element('tblFusao').innerHTML,/R\$|123\.456\.789|123456789/,'igualdade de nome não transfere receita financeira ao autor');
  assert.equal(r.run('JSON.stringify(TRELLO_DATA)'),historico,'scores, cartões e senhas não são recalculados');
  r.run('M[CUR].users[0].total=704.31;');
  r.element('btnDownloadHtml').onclick(); const exported=await r.blobs.at(-1).text(),second=runtimeFinanceiro(exported);
  assert.equal(second.run('M[CUR].total'),704.31); assert.equal(second.run('M[CUR].users[0].max'),352.15);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(process.env.SOURCE_V3,'utf8')).digest('hex'),hash);
});

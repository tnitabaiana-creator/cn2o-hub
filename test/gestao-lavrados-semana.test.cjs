'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../gestao-lavrados.js');

const tick = () => new Promise(resolve => setImmediate(resolve));
const defer = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const MES = '/hub/atos-lavrados/meses';
const RESUMO = '/hub/atos-lavrados/resumo';
const SEMANA = '/hub/atos-lavrados/semana';

function mes(extra = {}) {
  return { mes: '2026-09', ate: '2026-09-30', corte_em: '2026-10-01T03:00:00Z', dia_final_completo: true,
    total_observado: 100, total_oficial: 100, cobertura_completa: true, com_vinculo: 60, sem_vinculo: 40,
    com_pendencia_identificacao: 0, revisao: 1, importado_em: '2026-10-01T12:00:00Z', ...extra };
}
function outubro(extra = {}) {
  return mes({ mes: '2026-10', ate: '2026-10-09', corte_em: '2026-10-09T20:23:00Z', dia_final_completo: false,
    total_observado: 40, total_oficial: null, cobertura_completa: false, com_vinculo: 10, sem_vinculo: 30, ...extra });
}
function classificacao(nao = 20, divergentes = 2, subtipo = 70, finalidade = 10) {
  return { versao: 'extra-digital-tipos-v1', campos: ['Sub-tipo', 'Finalidade'], nao_classificados: nao,
    divergentes, por_subtipo: subtipo, por_finalidade: finalidade };
}
function autoria(sem, com = 0, cobertura = false) {
  return { status: com === 0 ? 'pendente' : sem ? 'parcial' : 'confirmada', sem_autoria_confirmada: sem,
    com_autoria_confirmada: com, cobertura_completa: cobertura, criterio: 'Depende de confirmação documental.' };
}
function colaborador(extra = {}) {
  return { id: 'pessoa-teste-1', nome: 'Pessoa fictícia 1', fonte: 'Extra Digital', marcos: ['lavratura'],
    total_observado: 3, total_oficial: null, ...extra };
}
function resumo(extra = {}) {
  return { criterio: 'Extra Digital: família Escritura, Registrado(a), data Minuta/Lavratura',
    inicio: '2026-09-01', fim: '2026-09-30', total_observado: 100, total_oficial: 100, cobertura_completa: true,
    com_vinculo: 60, sem_vinculo: 40, com_pendencia_identificacao: 0, meses: [mes()],
    tipos: [{ codigo: 'compra_venda', nome: 'Compra e venda', total_observado: 80, total_oficial: 80 },
      { codigo: 'nao_classificado', nome: 'Não classificado', total_observado: 20, total_oficial: 20 }],
    classificacao: classificacao(), colaboradores: [],
    autoria: autoria(100), ...extra };
}
function semana(extra = {}) {
  return resumo({ inicio: '2026-10-05', fim: '2026-10-11', referencia: '2026-10-09', fuso: 'America/Sao_Paulo',
    total_observado: 7, total_oficial: null, cobertura_completa: false, com_vinculo: 4, sem_vinculo: 3,
    com_pendencia_identificacao: 1, meses: [outubro()],
    tipos: [{ codigo: 'compra_venda', nome: 'Compra e venda', total_observado: 5, total_oficial: null },
      { codigo: 'nao_classificado', nome: 'Não classificado', total_observado: 2, total_oficial: null }],
    classificacao: classificacao(2, 1, 4, 1),
    autoria: autoria(7), ...extra });
}
function completa(r) {
  return { ...r, cobertura_completa: true, total_oficial: r.total_observado,
    autoria: { ...r.autoria, cobertura_completa: r.autoria.sem_autoria_confirmada === 0 },
    tipos: r.tipos.map(t => ({ ...t, total_oficial: t.total_observado })) };
}
function vazio(extra = {}) {
  return semana({ total_observado: 0, total_oficial: null, cobertura_completa: false, com_vinculo: 0,
    sem_vinculo: 0, com_pendencia_identificacao: 0, meses: [], tipos: [], classificacao: classificacao(0, 0, 0, 0),
    autoria: autoria(0), ...extra });
}
function ambiente(t, api, extra = {}) {
  const listeners = {}, chamadas = [], session = { token: 'token-ficticio', login: 'gestor-teste', admin: true };
  let monitor, expirou = 0;
  const host = { innerHTML: '', isConnected: true, addEventListener: (e, f) => { listeners[e] = f; }, removeEventListener: e => { delete listeners[e]; } };
  const win = { setInterval: f => { monitor = f; return 1; }, clearInterval: () => { monitor = null; } };
  const padrao = p => p === MES ? { meses: [mes()] } : p.startsWith(RESUMO) ? resumo() : semana();
  const controle = L.montar({ host, window: win, mes: '2026-09', sessao: () => session, expirada: () => expirou++,
    api: async (p, config) => { chamadas.push({ p, config }); return api ? api(p, padrao) : padrao(p); }, ...extra });
  t.after(() => controle.destruir());
  function click(atributo, valor = '') {
    const botao = { hasAttribute: n => n === atributo, getAttribute: n => n === atributo ? valor : null };
    listeners.click({ target: { closest: seletor => seletor === 'button' ? botao : null } });
  }
  function change(atributo, valor) { listeners.change({ target: { hasAttribute: n => n === atributo, value: valor } }); }
  return { host, controle, chamadas, session, listeners, click, change, monitor: () => monitor && monitor(), expirou: () => expirou };
}

test('resumo exige datas reais, intervalo solicitado e contagens inteiras coerentes', () => {
  assert.equal(L.validarResumo(resumo(), { inicio: '2026-09-01', fim: '2026-09-30' }).total_oficial, 100);
  const invalidos = [resumo({ inicio: '2026-02-30' }), resumo({ fim: '2026-08-31' }), resumo({ fim: '2026-10-03' }),
    resumo({ total_observado: 100.5 }), resumo({ com_vinculo: -1 }), resumo({ sem_vinculo: 41 }),
    resumo({ com_pendencia_identificacao: 101 }), resumo({ total_oficial: null })];
  for (const r of invalidos) assert.throws(() => L.validarResumo(r));
  assert.throws(() => L.validarResumo(resumo(), { inicio: '2026-10-01', fim: '2026-10-31' }));
});

test('semana civil valida segunda a domingo, referência exata e fuso de Brasília', () => {
  assert.equal(L.validarSemana(semana(), '2026-10-09').referencia, '2026-10-09');
  assert.equal(L.validarSemana(semana({ referencia: '2026-10-11' })).fim, '2026-10-11');
  assert.equal(L.validarSemana(vazio({ inicio: '2026-10-12', fim: '2026-10-18', referencia: '2026-10-12' })).inicio, '2026-10-12');
  assert.equal(L.validarSemana(vazio({ inicio: '2026-12-28', fim: '2027-01-03', referencia: '2027-01-01' })).fim, '2027-01-03');
  for (const r of [semana({ fuso: 'UTC' }), semana({ inicio: '2026-10-04', fim: '2026-10-10' }),
    semana({ fim: '2026-10-12' }), semana({ referencia: '2026-10-12' }), semana({ referencia: '2026-02-30' })]) assert.throws(() => L.validarSemana(r));
  assert.throws(() => L.validarSemana(semana(), '2026-10-08'));
});

test('semana entre meses pode ser completa com mês parcial e não usa os totais mensais como semana', () => {
  const r = completa(semana({ inicio: '2026-09-28', fim: '2026-10-04', referencia: '2026-10-02', meses: [mes(), outubro()] }));
  const s = L.validarSemana(r);
  assert.equal(s.total_oficial, 7); assert.equal(s.meses[1].cobertura_completa, false);
  assert.equal(s.meses.reduce((n, m) => n + m.total_observado, 0), 140);
  assert.throws(() => L.validarSemana({ ...r, meses: [mes()] }), /cobertura/);
  const parcialNoDomingo = outubro({ ate: '2026-10-04', corte_em: '2026-10-04T20:23:00Z' });
  assert.throws(() => L.validarSemana({ ...r, meses: [mes(), parcialNoDomingo] }), /cobertura/);
  assert.throws(() => L.validarSemana({ ...r, meses: [mes(), { ...parcialNoDomingo, dia_final_completo: true, corte_em: '2026-10-05T02:59:59Z' }] }));
  assert.doesNotThrow(() => L.validarSemana({ ...r, meses: [mes(), { ...parcialNoDomingo, dia_final_completo: true, corte_em: '2026-10-05T03:00:00Z' }] }));
});

test('corte de extração posterior mantém sua própria data na semana e na exportação mensal', () => {
  const base = mes({ corte_em: '2026-10-09T15:30:00Z' });
  const r = completa(semana({ inicio: '2026-09-21', fim: '2026-09-27', referencia: '2026-09-25', meses: [base] }));
  const html = L.renderizar({ visao: 'semana', semana: { dados: L.validarSemana(r) } });
  assert.match(html, /09\/10\/2026 às 12:30:00/);
  assert.doesNotMatch(html, /30\/09\/2026 às 12:30:00/);
  const linhas = L.resumoExportacao({ mes: '2026-09', status: 'conferido', dados: L.validarResposta({ meses: [base] })[0] });
  assert.match(linhas.find(x => x[0] === 'Corte da extração')[1], /09\/10\/2026 às 12:30:00/);
  assert.match(linhas.find(x => x[0] === 'Cobertura')[1], /30\/09\/2026/);
});

test('corte UTC é conferido pela data em Brasília e apresentado como dia parcial', () => {
  const r = semana();
  assert.throws(() => L.validarSemana({ ...r, meses: [outubro({ corte_em: '2026-10-09T02:59:59Z' })] }));
  const html = L.renderizar({ visao: 'semana', semana: { dados: L.validarSemana(r), referencia: r.referencia } });
  assert.match(html, /09\/10\/2026 às 17:23:00/); assert.match(html, /dia final parcial/);
  assert.match(html, /Não representa a semana encerrada/); assert.doesNotMatch(html, /Extração semanal completa/);
});

test('ausência de base semanal não vira zero oficial e zero só é oficial com cobertura', () => {
  const r = vazio(), html = L.renderizar({ visao: 'semana', semana: { dados: L.validarSemana(r), referencia: r.referencia } });
  assert.match(html, /<strong>—<\/strong>/); assert.match(html, /Sem base importada/);
  assert.doesNotMatch(html, /<strong>0<\/strong>/);
  assert.throws(() => L.validarSemana(completa(r)), /cobertura/);
  const zero = completa(vazio({ inicio: '2026-09-21', fim: '2026-09-27', referencia: '2026-09-25', meses: [mes()] }));
  assert.match(L.renderizar({ visao: 'semana', semana: { dados: L.validarSemana(zero) } }), /<strong>0<\/strong>/);
});

test('tipos conservam a soma, códigos únicos, não classificados e oficial nulo na parcial', () => {
  const r = semana();
  assert.equal(L.validarResumo(r).tipos.reduce((n, t) => n + t.total_observado, 0), 7);
  const invalidos = [
    { ...r, tipos: r.tipos.slice(0, 1) },
    { ...r, tipos: [r.tipos[0], { ...r.tipos[1], codigo: r.tipos[0].codigo }] },
    { ...r, tipos: [{ ...r.tipos[0], total_observado: 5.5 }, r.tipos[1]] },
    { ...r, tipos: [{ ...r.tipos[0], total_oficial: 5 }, r.tipos[1]] },
    { ...r, tipos: [{ ...r.tipos[0], codigo: '<script>' }, r.tipos[1]] },
    { ...r, classificacao: { ...r.classificacao, nao_classificados: 1 } },
    { ...r, classificacao: { ...r.classificacao, divergentes: 8 } },
    { ...r, classificacao: { ...r.classificacao, versao: 'desconhecida' } }
  ];
  for (const valor of invalidos) assert.throws(() => L.validarResumo(valor));
  const completo = resumo(); completo.tipos[0].total_oficial = 79;
  assert.throws(() => L.validarResumo(completo));
});

test('nomes de tipos são escapados, divergências permanecem contadas e extras pessoais são descartados', () => {
  const r = semana({ cliente: 'CLIENTE-FICTICIO', criador: 'CADASTRADOR-FICTICIO' });
  r.tipos[0].nome = '<img src=x onerror=alert(1)>'; r.tipos[0].cliente = 'CLIENTE-FICTICIO';
  const antes = JSON.stringify(r), dados = L.validarSemana(r);
  const html = L.renderizar({ visao: 'semana', semana: { dados } });
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/); assert.doesNotMatch(html, /<img/);
  assert.match(html, /Não classificado/); assert.match(html, /1 registro\(s\) com classificação divergente/);
  assert.match(html, /<strong>7<\/strong>/); assert.match(html, /Responsável não identificado/);
  assert.match(html, /não representa produtividade zero/);
  assert.doesNotMatch(JSON.stringify(dados), /CLIENTE-FICTICIO|CADASTRADOR-FICTICIO/);
  assert.equal(JSON.stringify(r), antes);
});

test('autoria parcial mostra apenas evidências confirmadas e mantém responsáveis não identificados', () => {
  const r = semana({ colaboradores: [colaborador({ nome: '<b>Pessoa fictícia</b>', cliente: 'CLIENTE-EXTRA', criador: 'CRIADOR-EXTRA' })], autoria: autoria(4, 3) });
  const antes = JSON.stringify(r), dados = L.validarSemana(r), html = L.renderizar({ visao: 'semana', semana: { dados } });
  assert.equal(dados.autoria.status, 'parcial'); assert.equal(dados.autoria.cobertura_completa, false);
  assert.equal(dados.colaboradores[0].total_oficial, null);
  assert.match(html, /&lt;b&gt;Pessoa fictícia&lt;\/b&gt;/); assert.doesNotMatch(html, /<b>Pessoa/);
  assert.match(html, /Evidência: lavratura/); assert.match(html, /Responsável não identificado/);
  assert.doesNotMatch(JSON.stringify(dados), /CLIENTE-EXTRA|CRIADOR-EXTRA/);
  assert.equal(JSON.stringify(r), antes);
});

test('autoria só possui total oficial se período e atribuições estiverem completos', () => {
  const parcial = semana({ colaboradores: [colaborador({ total_observado: 7 })], autoria: autoria(0, 7) });
  assert.equal(L.validarSemana(parcial).autoria.status, 'confirmada');
  assert.equal(L.validarSemana(parcial).autoria.cobertura_completa, false);
  assert.throws(() => L.validarSemana({ ...parcial, colaboradores: [colaborador({ total_observado: 7, total_oficial: 7 })] }));
  const completo = resumo({ colaboradores: [colaborador({ total_observado: 100, total_oficial: 100, marcos: ['lavratura', 'registro'] })], autoria: autoria(0, 100, true) });
  const dados = L.validarResumo(completo);
  assert.equal(dados.colaboradores[0].total_oficial, 100); assert.equal(dados.autoria.cobertura_completa, true);
  assert.doesNotMatch(L.renderizar({ visao: 'semana', semana: { dados } }), /Responsável não identificado/);
});

test('autoria rejeita soma divergente, IDs duplicados, cadastro e fontes sem evidência Extra Digital', () => {
  const r = semana({ colaboradores: [colaborador()], autoria: autoria(4, 3) });
  const invalidos = [
    { ...r, autoria: autoria(3, 3) },
    { ...r, autoria: { ...r.autoria, status: 'confirmada' } },
    { ...r, autoria: { ...r.autoria, cobertura_completa: true } },
    { ...r, colaboradores: [colaborador({ total_observado: 2 })] },
    { ...r, colaboradores: [colaborador({ total_observado: 1 }), colaborador({ total_observado: 2 })] },
    { ...r, colaboradores: [colaborador({ fonte: 'Trello' })] },
    { ...r, colaboradores: [colaborador({ marcos: ['cadastro'] })] },
    { ...r, colaboradores: [colaborador({ marcos: ['lavratura', 'lavratura'] })] },
    { ...r, colaboradores: [colaborador({ marcos: [] })] }
  ];
  for (const valor of invalidos) assert.throws(() => L.validarSemana(valor));
});

test('identificador e nome de autoria aceitam os limites de 160 e 200 caracteres do backend', () => {
  const pessoa = colaborador({ id: 'i'.repeat(160), nome: 'N'.repeat(200) });
  const r = semana({ colaboradores: [pessoa], autoria: autoria(4, 3) });
  assert.equal(L.validarSemana(r).colaboradores[0].id.length, 160);
  assert.equal(L.validarSemana(r).colaboradores[0].nome.length, 200);
  assert.throws(() => L.validarSemana({ ...r, colaboradores: [{ ...pessoa, id: 'i'.repeat(161) }] }));
  assert.throws(() => L.validarSemana({ ...r, colaboradores: [{ ...pessoa, nome: 'N'.repeat(201) }] }));
});

test('atribuição gerencial diferencia concordância e prevalência Trello sem mudar o total de escrituras', () => {
  const metodos = { direta: 1, auditoria_concordante: 2, trello_divergencia: 3 };
  const r = semana({ colaboradores: [colaborador({ total_observado: 6, fonte: 'Extra Digital + Trello', marcos: ['registro', 'atribuicao_gerencial'], metodos,
    evidencia: { referencia: 'REFERENCIA-PRIVADA-NAO-EXIBIR' } })], autoria: { ...autoria(1, 6), metodos } });
  const antes = JSON.stringify(r), dados = L.validarSemana(r), html = L.renderizar({ visao: 'semana', semana: { dados } });
  assert.equal(dados.total_observado, 7); assert.equal(dados.autoria.sem_autoria_confirmada, 1);
  assert.deepEqual(dados.autoria.metodos, metodos); assert.deepEqual(dados.colaboradores[0].metodos, metodos);
  assert.match(html, /Evidência: registro · Extra Digital · 1/);
  assert.match(html, /auditoria e Trello concordantes · 2/);
  assert.match(html, /Trello prevalece na divergência · 3/);
  assert.match(html, /Responsável não identificado/); assert.doesNotMatch(html, /REFERENCIA-PRIVADA/);
  assert.equal(JSON.stringify(r), antes);
});

test('atribuição gerencial exige método conciliado, marco próprio e fonte correspondente', () => {
  const metodos = { direta: 0, auditoria_concordante: 1, trello_divergencia: 2 };
  const p = colaborador({ fonte: 'Extra Digital + Trello', marcos: ['atribuicao_gerencial'], metodos });
  const r = semana({ colaboradores: [p], autoria: { ...autoria(4, 3), metodos } });
  assert.equal(L.validarSemana(r).colaboradores[0].metodos.direta, 0);
  for (const mudanca of [
    { fonte: 'Extra Digital' }, { metodos: undefined }, { marcos: ['registro'] },
    { marcos: ['registro', 'atribuicao_gerencial'] },
    { metodos: { ...metodos, trello_divergencia: -1 } },
    { metodos: { ...metodos, trello_divergencia: 3 } }
  ]) assert.throws(() => L.validarSemana({ ...r, colaboradores: [{ ...p, ...mudanca }] }));
  assert.throws(() => L.validarSemana({ ...r, autoria: { ...r.autoria, metodos: undefined } }));
  assert.throws(() => L.validarSemana({ ...r, autoria: { ...r.autoria, metodos: { direta: 1, auditoria_concordante: 1, trello_divergencia: 1 } } }));
});

test('consulta de tipos do mês ocorre após a base mensal e sem verbos de escrita', async t => {
  const mensal = defer();
  const a = ambiente(t, (p, padrao) => p === MES ? mensal.promise : padrao(p));
  assert.deepEqual(a.chamadas.map(x => x.p), [MES]);
  mensal.resolve({ meses: [mes()] }); await tick();
  assert.deepEqual(a.chamadas.map(x => x.p), [MES, RESUMO + '?inicio=2026-09-01&fim=2026-09-30']);
  assert.ok(a.chamadas.every(x => x.config === undefined));
  assert.match(a.host.innerHTML, /Por tipo de escritura/);
  a.controle.selecionar('2026-08', ['2026-08', '2026-09']); await tick();
  assert.equal(a.chamadas.length, 2); assert.match(a.host.innerHTML, /Mês não conciliado/);
});

test('semana atual é resolvida pelo servidor e a navegação respeita a referência retornada', async t => {
  const a = ambiente(t); await tick();
  a.click('data-lav-visao', 'semana'); await tick();
  assert.equal(a.chamadas.at(-1).p, SEMANA);
  assert.match(a.host.innerHTML, /value="2026-10-09"/);
  a.click('data-lav-anterior'); await tick();
  assert.equal(a.chamadas.at(-1).p, SEMANA + '?referencia=2026-10-02');
  a.click('data-lav-atual'); await tick(); assert.equal(a.chamadas.at(-1).p, SEMANA);
});

test('resposta semanal superada não repõe período antigo e snapshot permanece mensal', async t => {
  const antiga = defer(), nova = defer(); let consulta = 0;
  const a = ambiente(t, (p, padrao) => p.startsWith(SEMANA) ? (++consulta === 1 ? antiga.promise : nova.promise) : padrao(p));
  await tick(); a.click('data-lav-visao', 'semana');
  a.change('data-lav-referencia', '2026-10-16');
  assert.equal(a.controle.snapshot('2026-09').dados.total_oficial, 100);
  nova.resolve(vazio({ inicio: '2026-10-12', fim: '2026-10-18', referencia: '2026-10-16' })); await tick();
  assert.match(a.host.innerHTML, /12\/10\/2026 a 18\/10\/2026/);
  antiga.resolve(semana()); await tick();
  assert.match(a.host.innerHTML, /12\/10\/2026 a 18\/10\/2026/); assert.doesNotMatch(a.host.innerHTML, /05\/10\/2026 a 11\/10\/2026/);
  const snapshot = a.controle.snapshot('2026-09'); assert.equal(snapshot.dados.total_oficial, 100);
  snapshot.dados.total_oficial = 999; assert.equal(a.controle.snapshot('2026-09').dados.total_oficial, 100);
});

test('resposta semanal pendente não força visão semanal após voltar ao mês', async t => {
  const pendente = defer(), a = ambiente(t, (p, padrao) => p.startsWith(SEMANA) ? pendente.promise : padrao(p));
  await tick(); a.click('data-lav-visao', 'semana'); a.click('data-lav-visao', 'mes');
  pendente.resolve(semana()); await tick();
  assert.match(a.host.innerHTML, /data-lav-visao="mes" aria-pressed="true"/);
  assert.match(a.host.innerHTML, /<strong>100<\/strong>/); assert.doesNotMatch(a.host.innerHTML, /05\/10\/2026 a 11\/10\/2026/);
});

test('ponte repetida e atualização da lista de meses preservam semana sem nova consulta', async t => {
  const a = ambiente(t); await tick(); a.click('data-lav-visao', 'semana'); await tick();
  const antes = a.chamadas.length;
  a.controle.selecionar('2026-09', ['2026-09']);
  a.controle.selecionar('2026-09', ['2026-08', '2026-09']); await tick();
  assert.equal(a.chamadas.length, antes);
  assert.match(a.host.innerHTML, /data-lav-visao="semana" aria-pressed="true"/);
  assert.match(a.host.innerHTML, /value="2026-10-09"/);
  a.controle.selecionar('2026-08', ['2026-08', '2026-09']);
  assert.match(a.host.innerHTML, /data-lav-visao="mes" aria-pressed="true"/);
  assert.match(a.host.innerHTML, /Agosto de 2026/); assert.match(a.host.innerHTML, /Mês não conciliado/);
});

test('ponte com null repetido também preserva consulta semanal independente', async t => {
  const a = ambiente(t); await tick(); a.controle.selecionar(null, ['2026-09']);
  a.click('data-lav-visao', 'semana'); await tick(); const antes = a.chamadas.length;
  a.controle.selecionar(null, ['2026-09']);
  assert.equal(a.chamadas.length, antes); assert.match(a.host.innerHTML, /data-lav-visao="semana" aria-pressed="true"/);
  assert.equal(a.controle.snapshot('2026-09').dados, null);
});

test('404 semanal não apaga o mensal; nova tentativa reutiliza a referência solicitada', async t => {
  let falhar = true;
  const a = ambiente(t, (p, padrao) => {
    if (p.startsWith(SEMANA) && falhar) throw { status: 404 };
    return padrao(p);
  });
  await tick(); a.click('data-lav-visao', 'semana'); await tick();
  a.change('data-lav-referencia', '2026-10-09'); await tick();
  assert.match(a.host.innerHTML, /consulta semanal está indisponível/); assert.equal(a.expirou(), 0);
  assert.equal(a.controle.snapshot('2026-09').dados.total_oficial, 100);
  falhar = false; a.click('data-lav-semana-retry'); await tick();
  assert.equal(a.chamadas.at(-1).p, SEMANA + '?referencia=2026-10-09'); assert.match(a.host.innerHTML, /<strong>7<\/strong>/);
  a.click('data-lav-visao', 'mes'); assert.match(a.host.innerHTML, /<strong>100<\/strong>/);
});

test('mudança de revisão entre mensal e detalhe não mistura bases nem altera o snapshot', async t => {
  const a = ambiente(t, (p, padrao) => p.startsWith(RESUMO) ? resumo({ meses: [mes({ revisao: 2 })] }) : padrao(p));
  await tick(); assert.match(a.host.innerHTML, /distribuição deste mês não está disponível/);
  assert.doesNotMatch(a.host.innerHTML, /Por tipo de escritura/);
  assert.equal(a.controle.snapshot('2026-09').dados.revisao, 1);
  assert.equal(a.controle.snapshot('2026-09').dados.total_oficial, 100);
});

test('resposta tardia de detalhe mensal não entra no novo mês selecionado', async t => {
  const pendente = defer();
  const a = ambiente(t, (p, padrao) => p.startsWith(RESUMO) ? pendente.promise : padrao(p));
  await tick(); a.controle.selecionar('2026-08', ['2026-08', '2026-09']);
  pendente.resolve(resumo()); await tick();
  assert.match(a.host.innerHTML, /Agosto de 2026/); assert.doesNotMatch(a.host.innerHTML, /Por tipo de escritura/);
  assert.equal(a.controle.snapshot('2026-08').status, 'ausente');
});

test('logout com semana e detalhe pendentes limpa DOM, listeners e snapshots', async t => {
  const detalhe = defer(), semanal = defer();
  const a = ambiente(t, (p, padrao) => p.startsWith(SEMANA) ? semanal.promise : p.startsWith(RESUMO) ? detalhe.promise : padrao(p));
  await tick(); a.click('data-lav-visao', 'semana'); a.session.token = '';
  semanal.resolve(semana()); detalhe.resolve(resumo()); await tick();
  assert.equal(a.host.innerHTML, ''); assert.equal(a.listeners.click, undefined);
  assert.equal(a.listeners.change, undefined); assert.equal(a.controle.snapshot('2026-09'), null);
});

test('401 e 403 na consulta semanal encerram a instância e notificam expiração uma vez', async t => {
  for (const status of [401, 403]) {
    const a = ambiente(t, (p, padrao) => { if (p.startsWith(SEMANA)) throw { status }; return padrao(p); });
    await tick(); a.click('data-lav-visao', 'semana'); await tick();
    assert.equal(a.expirou(), 1); assert.equal(a.host.innerHTML, ''); assert.equal(a.controle.snapshot('2026-09'), null);
  }
});

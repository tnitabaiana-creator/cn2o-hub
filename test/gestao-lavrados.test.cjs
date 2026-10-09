'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const L = require('../gestao-lavrados.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const defer = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const mes = (extra = {}) => ({ mes: '2026-09', ate: '2026-09-30', corte_em: '2026-10-01T02:59:59Z', dia_final_completo: true, revisao: 1, total_oficial: 223, total_observado: 223, cobertura_completa: true, com_vinculo: 130, sem_vinculo: 93, importado_em: '2026-10-09T14:00:00Z', ...extra });
function ambiente(api, extra = {}) {
  const listeners = {}, chamadas = [], session = { token: 'privado', login: 'gestor', admin: true };
  let monitor, expirou = 0;
  const host = { innerHTML: '', isConnected: true, addEventListener: (e, f) => { listeners[e] = f; }, removeEventListener: e => { delete listeners[e]; } };
  const win = { setInterval: f => { monitor = f; return 1; }, clearInterval: () => { monitor = null; } };
  const controle = L.montar({ host, window: win, api: async p => { chamadas.push(p); return api ? api(p) : { meses: [mes()] }; }, sessao: () => session, expirada: () => expirou++, ...extra });
  return { host, controle, session, chamadas, listeners, monitor: () => monitor && monitor(), expirou: () => expirou };
}
test('fonte oficial diferencia completo, parcial e mês ausente, sem transformar ausência em zero', () => {
  const parcial = mes({ mes: '2026-10', ate: '2026-10-09', corte_em: '2026-10-09T20:23:00Z', dia_final_completo: false, total_oficial: null, total_observado: 92, com_vinculo: 12, sem_vinculo: 80, cobertura_completa: false });
  const dados = L.validarResposta({ meses: [mes(), parcial] });
  const html = L.renderizar({ dados, meses: ['2026-08', '2026-09', '2026-10'], mes: '2026-08' });
  assert.match(html, /<strong>—<\/strong>/); assert.match(html, /Mês não conciliado/);
  assert.match(html, /223/); assert.match(html, /92 no período/); assert.match(html, /09\/10\/2026/);
  const hp = L.renderizar({ dados, mes: '2026-10' });
  assert.match(hp, /Conferência parcial/); assert.match(hp, /Não representa o mês completo/);
  assert.match(hp, /17:23:00 \(horário de Brasília\)/); assert.match(hp, /Dia final parcial/);
  const vazio = L.renderizar({ dados: [] }); assert.match(vazio, /Nenhum mês conciliado/); assert.doesNotMatch(vazio, /<strong>0<\/strong>/);
});
test('zero oficial é exibido somente com cobertura real, e contrato não aceita inconsistências', () => {
  const zero = mes({ total_oficial: 0, total_observado: 0, com_vinculo: 0, sem_vinculo: 0 });
  assert.match(L.renderizar({ dados: L.validarResposta({ meses: [zero] }), mes: '2026-09' }), /<strong>0<\/strong>/);
  for (const dado of [mes({ ate: '2026-09-09' }), mes({ total_oficial: 999 }), mes({ com_vinculo: 131 }), mes({ total_oficial: null }), mes({ mes: '2026-13' }), mes({ total_oficial: '223' }), mes({ mes: '2026-02', ate: '2026-02-30', total_oficial: null, cobertura_completa: false }), mes({ com_pendencia_identificacao: -1 })]) assert.throws(() => L.validarResposta({ meses: [dado] }));
  assert.throws(() => L.validarResposta({ meses: [mes(), mes()] }));
  assert.throws(() => L.validarResposta({}));
  assert.throws(() => L.validarResposta({ meses: [mes({ dia_final_completo: false })] }));
  assert.throws(() => L.validarResposta({ meses: [mes({ corte_em: '2026-09-30T02:59:59Z' })] }), 'UTC da véspera não equivale ao fim do dia local');
});
test('pendência de identificação aparece sem excluir registro da extração nem criar autoria', () => {
  const dados = L.validarResposta({ meses: [mes({ com_pendencia_identificacao: 1 })] });
  const html = L.renderizar({ dados, mes: '2026-09' });
  assert.match(html, /1 registro\(s\) com identificação a conferir/); assert.match(html, /<strong>223<\/strong>/);
  assert.match(html, /Extração mensal completa/); assert.doesNotMatch(html, /Mês conciliado/);
  assert.match(html, /Escrituras lavradas/); assert.match(html, /Procurações e testamentos não integram/);
});
test('não exibe criador como autor nem dados extras recebidos, e não modifica o payload', () => {
  const dados = { meses: [mes({ criador: 'DADO-PRIVADO-CRIADOR', responsavel: 'DADO-PRIVADO-RESPONSAVEL' })] }, antes = JSON.stringify(dados);
  const html = L.renderizar({ dados: L.validarResposta(dados), mes: '2026-09' });
  assert.doesNotMatch(html, /DADO-PRIVADO/); assert.match(html, /Vínculo não identifica autoria/);
  assert.equal(JSON.stringify(dados), antes);
});
test('consulta é somente GET lógico e seleção do mês financeiro ausente permanece explícita', async () => {
  const a = ambiente(null, { mes: '2026-06', meses: ['2026-06', '2026-09'], seletor: false });
  await tick(); assert.deepEqual(a.chamadas, ['/hub/atos-lavrados/meses']);
  assert.match(a.host.innerHTML, /Junho de 2026/); assert.match(a.host.innerHTML, /Mês não conciliado/);
  assert.doesNotMatch(a.host.innerHTML, /<select/);
  a.controle.selecionar('2026-09'); assert.match(a.host.innerHTML, /<strong>223<\/strong>/);
  assert.equal(a.chamadas.length, 1); a.controle.destruir();
});
test('exportação usa snapshot do mês e da sessão atuais, com corte e sem zero inventado', async () => {
  const a = ambiente(null, { mes: '2026-09' });
  assert.match(JSON.stringify(L.resumoExportacao(a.controle.snapshot('2026-09'))), /Consulta ainda não concluída/);
  await tick(); const copia = a.controle.snapshot('2026-09');
  assert.equal(copia.dados.total_oficial, 223); copia.dados.total_oficial = 999;
  const linhas = L.resumoExportacao(a.controle.snapshot('2026-09'));
  assert.deepEqual(linhas.find(x => x[0] === 'Escrituras lavradas'), ['Escrituras lavradas', '223']);
  assert.match(JSON.stringify(linhas), /30\/09\/2026 às 23:59:59/);
  assert.match(JSON.stringify(L.resumoExportacao(a.controle.snapshot('2026-08'))), /Não disponível/);
  a.session.login = 'outra'; assert.equal(a.controle.snapshot('2026-09'), null); a.controle.destruir();
});
test('não consulta sem perfil autorizado', async () => {
  const a = ambiente(null, { sessao: () => ({ token: 't', login: 'u', admin: false }) });
  await tick(); assert.equal(a.chamadas.length, 0); assert.equal(a.host.innerHTML, '');
});
test('período financeiro desconhecido retira associação anterior em vez de manter outro mês', async () => {
  const a = ambiente(null, { mes: '2026-09', seletor: true }); await tick();
  a.controle.selecionar(null, ['2026-09']);
  assert.match(a.host.innerHTML, /Período financeiro não identificado/); assert.match(a.host.innerHTML, /<strong>—<\/strong>/);
  assert.match(a.host.innerHTML, /Escolha um mês oficial/);
  a.listeners.change({ target: { hasAttribute: () => true, value: '2026-09' } });
  assert.match(a.host.innerHTML, /<strong>223<\/strong>/); assert.doesNotMatch(a.host.innerHTML, /Período financeiro não identificado/);
  a.controle.destruir();
});
test('resposta tardia após logout é descartada', async () => {
  const d = defer(), a = ambiente(() => d.promise); a.session.token = '';
  d.resolve({ meses: [mes()] }); await tick(); assert.equal(a.host.innerHTML, ''); assert.equal(a.listeners.change, undefined);
});
test('troca de usuário ou remoção do painel limpa dados e listeners', async () => {
  const a = ambiente(); await tick(); a.session.login = 'outro'; a.monitor(); assert.equal(a.host.innerHTML, '');
  const b = ambiente(); await tick(); b.host.isConnected = false; b.monitor(); assert.equal(b.host.innerHTML, '');
});
test('falha de rede não preserva um total antigo como se ainda fosse a consulta atual', async () => {
  let falhar = false; const a = ambiente(() => { if (falhar) throw new Error('rede'); return { meses: [mes()] }; });
  await tick(); falhar = true; await a.controle.recarregar();
  assert.match(a.host.innerHTML, /fonte oficial está indisponível/); assert.doesNotMatch(a.host.innerHTML, /223/);
  falhar = false; a.listeners.click({ target: { closest: () => ({}) } }); await tick();
  assert.match(a.host.innerHTML, /<strong>223<\/strong>/); a.controle.destruir();
});
test('resposta de requisição superada não repõe dados antigos', async () => {
  const ds = [defer(), defer()]; let i = 0; const a = ambiente(() => ds[i++].promise);
  const segunda = a.controle.recarregar(); ds[1].resolve({ meses: [] }); await segunda;
  ds[0].resolve({ meses: [mes()] }); await tick(); assert.doesNotMatch(a.host.innerHTML, /223/); a.controle.destruir();
});
test('401/403 limpam dados oficiais e notificam expiração; limpeza global encerra instâncias', async () => {
  const a = ambiente(() => { throw { status: 403 }; }); await tick(); assert.equal(a.expirou(), 1); assert.equal(a.host.innerHTML, '');
  const b = ambiente(), c = ambiente(); await tick(); L.limparSessao(); assert.equal(b.host.innerHTML, ''); assert.equal(c.host.innerHTML, '');
});
test('frontend mantém denominadores financeiros e acrescenta fonte oficial em painel separado', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('function prodPessoas(m)'), end = html.indexOf('/* ---------- a tela ---------- */', start);
  const payload = { dados: { total: 1000, atos: 10, diasUteis: 20, pessoas: [{ id: 'A', total: 600, atos: 6 }, { id: 'B', total: 400, atos: 4 }] } };
  const antes = JSON.stringify(payload), ctx = vm.createContext({ prodNome: p => p.id, prodPerfil: () => 'mesa', payload, total_oficial: 3 });
  vm.runInContext(html.slice(start, end), ctx);
  const p = vm.runInContext('prodPessoas(payload)', ctx);
  assert.equal(p[0].ticket, 100); assert.equal(p[0].shareA, 60); assert.equal(p[0].indice, 1); assert.equal(p[0].atosDia, 0.3);
  assert.equal(JSON.stringify(payload), antes);
  assert.match(html, /id="prodLavrados"/); assert.match(html, /id="edRelLavrados"/);
  assert.match(html, /montarLavradosRelatorio\('prodLavrados', PROD\.cur/);
  assert.match(html, /GestaoLavrados\.limparSessao\(\)/);
  assert.equal((html.match(/const resumoOficial = prodResumoLavradosExportacao\(m.chave\)/g) || []).length, 2, 'CSV e PDF usam o mesmo snapshot oficial');
});
test('prévia mensal usa o mês anterior à referência do relatório, inclusive virada de ano', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('function relLavradosMensal()'), end = html.indexOf('function relEstado()', start);
  const chamadas = [], host = {}, estado = { tipo: 'mensal', ref: '2027-01-01' };
  const ctx = vm.createContext({ relEstado: () => estado, el: () => host, dd: n => String(n).padStart(2, '0'), montarLavradosRelatorio: (...a) => chamadas.push(a) });
  vm.runInContext(html.slice(start, end), ctx); vm.runInContext('relLavradosMensal()', ctx);
  assert.deepEqual(chamadas[0], ['edRelLavrados', '2026-12']); assert.equal(host.hidden, false);
  estado.tipo = 'semanal'; vm.runInContext('relLavradosMensal()', ctx); assert.deepEqual(chamadas[1], ['edRelLavrados', '']); assert.equal(host.hidden, true);
});

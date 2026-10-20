'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../gestao-prazos.js'), fixture = require('./fixtures/prazos-semanal.cjs');
const tick = () => new Promise(r => setImmediate(r));
function ambiente(t, api, extra = {}) {
  const listeners = {}, chamadas = [], sessoes = {token:'token-ficticio',login:'gestor',admin:true};
  let monitor, expiradas = 0;
  const host = { innerHTML:'',isConnected:true,addEventListener:(k,f) => {listeners[k]=f;},removeEventListener:k => {delete listeners[k];} };
  const window = {setInterval:f => {monitor=f;return 1;},clearInterval:() => {monitor=null;},URL:{revokeObjectURL(){}}};
  const controle = P.montar({host,window,ref:'2026-10-13',sessao:() => sessoes,expirada:() => expiradas++,api:async p => {chamadas.push(p);return api ? api(p) : fixture();},...extra});
  t.after(() => controle.destruir());
  return {host,listeners,chamadas,sessoes,controle,monitor:() => monitor && monitor(),expiradas:() => expiradas};
}
test('semana civil normalizada e limites de datas', () => {
  assert.equal(P.segunda('2027-01-01'),'2026-12-28'); assert.equal(P.segunda('2026-02-30'),'');
  assert.doesNotThrow(() => P.validar(fixture(),'2026-10-13'));
  assert.throws(() => P.validar(fixture(),'2026-10-19'));
});
test('vencidos antigos atuais não somem ao consultar semana passada; conclusão fica separada', () => {
  const r = P.validar(fixture()), h = P.renderizar({ref:'2026-10-12',situacao:'todos',dados:r});
  assert.match(h,/Vencidos em aberto/); assert.match(h,/semanas anteriores/); assert.match(h,/não reconstitui/);
  assert.match(h,/Conclusões da semana selecionada/); assert.match(h,/reaberto pode também/);
  assert.match(h,/20\/10\/2026,? 12:00/); assert.match(h,/atualização pendente/); assert.match(h,/Criado por/);
  assert.match(h,/9001/); assert.match(h,/9002/);
});
test('sem responsável é grupo explícito e apenas uma opção de filtro', () => {
  const r = fixture(); assert.doesNotThrow(() => P.validar(r));
  const h = P.renderizar({ref:'2026-10-12',situacao:'todos',responsavel:'sem_responsavel',dados:r});
  assert.equal((h.match(/value="sem_responsavel"/g)||[]).length,1); assert.match(h,/value="sem_responsavel" selected/);
});
test('contrato impede datas incoerentes, duplicidade, total de conclusão e paginação inválidos', () => {
  for (const mudar of [
    r => {r.fila.itens[0].situacao='a_vencer';},
    r => {r.fila.itens.push({...r.fila.itens[0]});r.fila.total++;},
    r => {r.conclusoes.itens[0].concluido_em='2026-10-20T12:00:00Z';},
    r => {r.resumo.concluidos_no_prazo++;},
    r => {r.fila.limite=1000;},
    r => {r.cobertura=null;}
  ]) {const r=fixture();mudar(r);assert.throws(() => P.validar(r));}
});
test('filtro a vencer usa semana e corte atual; vencimento no futuro fora da semana é rejeitado', () => {
  const r=fixture(); r.semana={inicio:'2026-10-19',fim:'2026-10-25'};
  r.fila.itens[0].situacao='a_vencer';r.fila.itens[0].vencimento='2026-10-24T02:59:59Z';
  r.conclusoes.itens=[];r.conclusoes.total=0;
  assert.doesNotThrow(()=>P.validar(r));
  r.fila.itens[0].vencimento='2026-10-27T02:59:59Z';assert.throws(()=>P.validar(r));
});
test('texto é escapado e URL de cartão exige origem Trello verdadeira', () => {
  const r=fixture();r.fila.itens[0].ato='<img src=x onerror=alert(1)>';
  r.fila.itens[0].trello_url='https://trello.com.evil/c/falso';r.cobertura.observacao='<script>mal</script>';
  const h=P.renderizar({ref:'2026-10-12',situacao:'todos',dados:r});
  assert.doesNotMatch(h,/<img|<script|href="https:\/\/trello.com.evil/);assert.match(h,/&lt;img/);
});
test('filtros permanecem visíveis durante atualização e quando opção deixa de constar no período', () => {
  const e={ref:'2026-10-12',situacao:'todos',responsavel:'ficcao.outra',nome_responsavel:'Escrevente Outra',tipo:'Inventário',carregando:true};
  assert.match(P.renderizar(e),/value="ficcao.outra" selected>Escrevente Outra/);
  e.carregando=false;e.dados=fixture();assert.match(P.renderizar(e),/value="Inventário" selected/);
  assert.match(P.renderizar(e),/value="ficcao.outra" selected/);
});
test('consulta normaliza semana e resposta fora de ordem não retorna dado antigo', async t => {
  const resolvers=[];const a=ambiente(t,()=>new Promise(resolve=>resolvers.push(resolve)));
  assert.match(a.chamadas[0],/ref=2026-10-12/);
  const p=a.controle.recarregar();resolvers[1](fixture());await p;
  const old=fixture();old.fila.itens[0].ato='RESPOSTA ANTIGA';resolvers[0](old);await tick();
  assert.doesNotMatch(a.host.innerHTML,/RESPOSTA ANTIGA/);
});
test('troca de conta, logout e não administrador limpam dados privados', async t => {
  const a=ambiente(t);await tick();a.sessoes.login='outra';a.monitor();assert.equal(a.host.innerHTML,'');
  const b=ambiente(t,null,{sessao:()=>({admin:false})});await tick();assert.deepEqual(b.chamadas,[]);
  const c=ambiente(t);await tick();c.sessoes.admin=false;c.monitor();assert.equal(c.host.innerHTML,'');assert.deepEqual(Object.keys(c.listeners),[]);
});
test('falha não se apresenta como zero; 401/403 limpa sessão da visualização', async t => {
  const a=ambiente(t,async()=>{throw Error('network');});await tick();
  assert.match(a.host.innerHTML,/Não foi possível confirmar/);assert.doesNotMatch(a.host.innerHTML,/gpr-indicadores/);
  for(const status of [401,403]){const b=ambiente(t,async()=>{throw {status};});await tick();assert.equal(b.host.innerHTML,'');assert.equal(b.expiradas(),1);}
});
test('CSV pede todos os filtrados no endpoint autenticado, sem expor token na URL', async t => {
  const a=ambiente(t);await tick();
  a.listeners.click({target:{closest:()=>({disabled:false,getAttribute:k=>k==='data-gpr-acao'?'csv':null})}});
  await tick();assert.match(a.chamadas[1],/semanal\.csv\?formato=json&ref=2026-10-12/);
  assert.doesNotMatch(a.chamadas[1],/token-ficticio/);
});

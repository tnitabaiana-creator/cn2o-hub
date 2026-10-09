'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const inicio=html.indexOf('function api(caminho, opcoes) {');
const codigo=html.slice(inicio,html.indexOf('/* ============================================================',inicio));
function ambiente(){
 let liberar,expiracoes=0;
 const SESSAO={token:'token-ficticio-antigo',login:'titular.fixture'};
 const c=vm.createContext({SESSAO,CONFIG:{endpoint:'https://exemplo.invalid'},fetch:()=>new Promise(resolve=>{liberar=resolve;}),sessaoExpirada:()=>expiracoes++,semConexao:()=>{}});
 vm.runInContext(codigo,c);
 return {SESSAO,solicitar:()=>vm.runInContext("api('/hub/relatorios/produtividade')",c),liberar:()=>liberar({status:401,ok:false,text:async()=>'{"erro":"expirada"}'}),expiracoes:()=>expiracoes};
}
test('resposta 401 antiga não encerra a nova sessão autenticada',async()=>{
 const a=ambiente(),p=a.solicitar();a.SESSAO.token='token-ficticio-novo';a.liberar();await assert.rejects(p,e=>e.status===401);assert.equal(a.expiracoes(),0);
});
test('resposta 401 da sessão atual ainda encerra essa sessão',async()=>{
 const a=ambiente(),p=a.solicitar();a.liberar();await assert.rejects(p,e=>e.status===401);assert.equal(a.expiracoes(),1);
});

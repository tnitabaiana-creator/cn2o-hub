const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const regras=require('../protocolo-curadoria.js');
const codigo=fs.readFileSync(path.join(__dirname,'../curadoria.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../curadoria.html'),'utf8');
const copia=v=>JSON.parse(JSON.stringify(v));
const fonte=()=>({schema_version:'cn2o.eprotocolo.v1',protocolo:{numero:999001,ato:'CV-Urbano',card_id:'ficticio'},revisao:{sha256:'a'.repeat(64),autor:'teste',data:'2026-10-06T15:00:00Z'},dados:{preco:'1.000,00',triagem:{preco:'1.000,00',pag_momento:'Já pago integralmente (data anterior)',pag_ant_forma:'Dinheiro em espécie (moeda manual)'},pagamentos:[{valor_centavos:100000,forma:'especie',data:'',status:'realizado',pagador:'',beneficiario:'',comprovante_referencia:''}]},curadoria:{versao:1,estado:'sem_comprovante',confirmado:true,observacao:'Conferência sintética',divergencias:[],autor:'teste',data:'2026-10-06T15:00:00Z'}});
function preparar(respostas=[]){
  const elementos=new Map(),requisicoes=[];
  const novo=()=>({value:'',checked:false,disabled:false,textContent:'',children:[],classList:{add(){},remove(){},toggle(){}},addEventListener(){},replaceChildren(){this.children=[];},appendChild(x){this.children.push(x);},querySelectorAll(){return [];}});
  const el=id=>{if(!elementos.has(id))elementos.set(id,novo());return elementos.get(id);};
  const radios=['compativeis','sem_comprovante','nao_conferidos','divergentes'].map(v=>({...novo(),value:v}));
  const contexto=vm.createContext({CN2OCuradoria:regras,criarFormularioCuradoria:()=>({renderPagamentos(){},renderDivergencias(){}}),document:{getElementById:el,querySelectorAll:()=>radios,querySelector:()=>radios.find(r=>r.checked),createElement:novo},sessionStorage:{getItem:k=>k==='cn2o_token'?'sessao-ficticia':''},URLSearchParams,location:{search:''},fetch:async(url,opcoes)=>{requisicoes.push({url,opcoes});const resposta=respostas.shift();if(resposta instanceof Error)throw resposta;if(typeof resposta==='function')return resposta();return {ok:(resposta?.status||200)<400,status:resposta?.status||200,json:async()=>resposta?.body||{}};}});
  vm.runInContext(codigo+'\nthis.ui={S,hidratarFonte,renderDossie,corpoRevisao,salvar,consultarAtual,adotarVersao,sincronizar,textoSincronizacao};',contexto);
  return {ui:contexto.ui,el,radios,requisicoes,respostas};
}
test('Página usa os mesmos módulos de regra e de formulário que o e-Protocolo',()=>{
  const criacao=fs.readFileSync(path.join(__dirname,'../protocolo.html'),'utf8');
  for(const script of ['protocolo-curadoria.js','protocolo-curadoria-form.js']){assert.ok(html.includes('src="'+script+'"'));assert.ok(criacao.includes('src="'+script+'"'));}
  new vm.Script(codigo);
});
test('Carregamento preserva valor e exige nova confirmação mesmo quando fonte anterior estava confirmada',()=>{
  const {ui,el}=preparar();ui.hidratarFonte(fonte());assert.equal(el('curadoriaConfirmado').checked,false);assert.equal(ui.S.pagamentos[0].valor,'1.000,00');assert.equal(ui.S.pagamentos[0].valor_centavos,undefined);assert.equal(el('salvarCuradoria').disabled,true);
});
test('Edição do valor não reutiliza centavos antigos da revisão carregada',()=>{
  const {ui,el,radios}=preparar();ui.hidratarFonte(fonte());ui.S.pagamentos[0].valor='900,00';radios.forEach(r=>r.checked=r.value==='nao_conferidos');ui.renderDossie();el('curadoriaConfirmado').checked=true;
  assert.equal(ui.corpoRevisao().pagamentos[0].valor_centavos,90000);
});
test('Revisão envia só curadoria parcelas e hash, sem adulterar autoria e dados originais',async()=>{
  const nova=fonte();nova.revisao.sha256='b'.repeat(64);
  const {ui,el,requisicoes}=preparar([{body:{fonte:nova,sincronizacao:{estado:'sincronizado'}}}]);ui.hidratarFonte(fonte());el('curadoriaConfirmado').checked=true;await ui.salvar();
  const q=requisicoes[0];assert.equal(q.opcoes.method,'POST');assert.match(q.url,/\/hub\/protocolos\/999001\/curadoria$/);assert.equal(q.opcoes.headers['X-Auth-Token'],'sessao-ficticia');
  const payload=JSON.parse(q.opcoes.body);assert.deepEqual(Object.keys(payload).sort(),['curadoria','expected_sha256','pagamentos']);assert.equal(payload.expected_sha256,'a'.repeat(64));assert.equal(payload.curadoria.autor,undefined);assert.equal(payload.curadoria.data,undefined);assert.equal(ui.S.fonte.revisao.sha256,'b'.repeat(64));assert.match(el('mensagem').textContent,/sincronizada no Trello/);
});
test('409 conserva rascunho e hash original até comparação e adoção expressa',async()=>{
  const nova=fonte();nova.revisao.sha256='c'.repeat(64);nova.curadoria.observacao='Outra escrevente revisou';
  const {ui,el,requisicoes}=preparar([{status:409,body:{erro:'Mudou'}},{body:{fonte:nova}}]);ui.hidratarFonte(fonte());el('curadoriaObservacao').value='Meu rascunho';ui.renderDossie();el('curadoriaConfirmado').checked=true;
  await ui.salvar();assert.equal(ui.S.bloqueio,true);assert.equal(el('curadoriaObservacao').value,'Meu rascunho');assert.equal(el('curadoriaConfirmado').checked,false);
  await ui.salvar();assert.equal(requisicoes.length,1);
  await ui.consultarAtual();assert.equal(ui.S.fonte.revisao.sha256,'a'.repeat(64));assert.equal(el('curadoriaObservacao').value,'Meu rascunho');
  ui.adotarVersao();assert.equal(ui.S.fonte.revisao.sha256,'c'.repeat(64));assert.equal(el('curadoriaObservacao').value,'Meu rascunho');assert.equal(el('curadoriaConfirmado').checked,false);assert.equal(el('salvarCuradoria').disabled,true);
});
test('Falha de rede e 502 bloqueiam reenvio até consulta sem apagar edição',async()=>{
  for(const resposta of [new Error('Resposta perdida'),{status:502,body:{erro:'Proxy'}}]){
    const {ui,el,requisicoes}=preparar([resposta]);ui.hidratarFonte(fonte());el('curadoriaConfirmado').checked=true;await ui.salvar();await ui.salvar();assert.equal(ui.S.bloqueio,true);assert.equal(requisicoes.length,1);assert.match(el('mensagem').textContent,/servidor pode já ter salvo/);assert.equal(el('curadoriaObservacao').value,'Conferência sintética');
  }
});
test('Salvar duas vezes durante requisição em curso faz um único POST',async()=>{
  let terminar;const pendente=new Promise(r=>{terminar=r;});const {ui,el,requisicoes}=preparar([()=>pendente]);ui.hidratarFonte(fonte());el('curadoriaConfirmado').checked=true;
  const primeira=ui.salvar();await ui.salvar();assert.equal(requisicoes.length,1);terminar({ok:true,status:200,json:async()=>({fonte:fonte(),sincronizacao:{estado:'pendente'}})});await primeira;
});
test('Trello pendente não é exibido como sincronizado',async()=>{
  const {ui,el}=preparar([{body:{fonte:fonte(),sincronizacao:{estado:'pendente'}}}]);ui.hidratarFonte(fonte());el('curadoriaConfirmado').checked=true;await ui.salvar();assert.match(el('mensagem').textContent,/salva no Hub/);assert.match(el('mensagem').textContent,/permanece pendente/);assert.doesNotMatch(el('mensagem').textContent,/e sincronizada/);
});
test('Retry de sincronização não reenvia curadoria nem parcelas',async()=>{
  const {ui,requisicoes}=preparar([{body:{sincronizacao:{estado:'sincronizado'}}}]);ui.hidratarFonte(fonte());await ui.sincronizar();assert.match(requisicoes[0].url,/sincronizar-fonte$/);assert.deepEqual(JSON.parse(requisicoes[0].opcoes.body),{expected_sha256:'a'.repeat(64)});
});
test('Fonte inválida não substitui a revisão já carregada',()=>{const {ui}=preparar();ui.hidratarFonte(fonte());assert.throws(()=>ui.hidratarFonte({}));assert.equal(ui.S.fonte.revisao.sha256,'a'.repeat(64));});

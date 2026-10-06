const test = require('node:test');
const assert = require('node:assert/strict');
const { criar } = require('../protocolo-minuta.js');
const source = (numero = '9001', ato = 'UE') => ({ fonte: { schema_version: 'cn2o.eprotocolo.v1', protocolo: { numero, ato }, revisao: { sha256: 'a'.repeat(64) }, dados: { preco: 'informação nunca enviada de volta pelo cliente' }, curadoria: { estado: 'compativel' } } });
test('sem escolha não gera; ausência de protocolo precisa ser explícita', () => {
 const s=criar({api:async()=>source()}); assert.ok(s.validar('UE')); assert.throws(()=>s.payload('UE'));
 s.semProtocolo(true); assert.equal(s.validar('UE'),null); assert.deepEqual(s.payload('UE'),{protocolo_ausente:true,ato_minuta:'UE'});
 s.semProtocolo(false); assert.ok(s.validar('UE'));
});
test('carrega da API autenticada e remete somente número, revisão e ato', async()=>{
 let route; const s=criar({api:async p=>{route=p;return source();}}); s.mudarNumero('9001'); await s.carregar();
 assert.equal(route,'/hub/protocolos/9001/fonte'); assert.equal(s.validar('UE'),null);
 assert.deepEqual(s.payload('UE'),{protocolo:'9001',protocolo_revisao:'a'.repeat(64),ato_minuta:'UE'});
});
test('rejeita número diferente, hash inválido e versão desconhecida', async()=>{
 for(const response of [source('9002'),{fonte:{...source().fonte,revisao:{sha256:'invalido'}}},{fonte:{...source().fonte,schema_version:'outro'}}]){
  const s=criar({api:async()=>response}); s.mudarNumero('9001'); await s.carregar(); assert.ok(s.validar('UE'));
 }
});
test('falha de consulta não equivale a protocolo sem informação', async()=>{
 const s=criar({api:async()=>{throw {status:404,erro:'Protocolo não encontrado'};}});s.mudarNumero('9001');await s.carregar();assert.ok(s.validar('UE'));assert.throws(()=>s.payload('UE'));
});
test('mudança do número invalida imediatamente a fonte anterior', async()=>{
 const s=criar({api:async()=>source()});s.mudarNumero('9001');await s.carregar();s.mudarNumero('9002');assert.ok(s.validar('UE'));
});
test('resposta atrasada não restaura revisão de outro atendimento', async()=>{
 let finish;const s=criar({api:()=>new Promise(resolve=>{finish=resolve;})});s.mudarNumero('9001');const pending=s.carregar();s.mudarNumero('9002');finish(source());await pending;assert.ok(s.validar('UE'));
});
test('opção sem protocolo durante consulta não é sobrescrita pela resposta', async()=>{
 let finish;const s=criar({api:()=>new Promise(resolve=>{finish=resolve;})});s.mudarNumero('9001');const pending=s.carregar();s.semProtocolo(true);finish(source());await pending;assert.equal(s.payload('UE').protocolo_ausente,true);
});
test('tipo incompatível é rejeitado e alias DUE corresponde à dissolução', async()=>{
 const s=criar({api:async()=>source('9001','DUE')});s.mudarNumero('9001');await s.carregar();assert.ok(s.validar('UE'));assert.equal(s.validar('DISS_UE'),null);
});
test('vínculo fica estável durante geração e é limpo na próxima', async()=>{
 const s=criar({api:async()=>source()});s.mudarNumero('9001');await s.carregar();s.travar(true);s.semProtocolo(true);s.mudarNumero('9002');s.limpar();assert.equal(s.payload('UE').protocolo,'9001');s.travar(false);s.limpar();assert.ok(s.validar('UE'));
});
test('número malformado não dispara API', async()=>{
 let calls=0;const s=criar({api:async()=>{calls++;return source();}});for(const n of ['0','abc','12/2026','-1','9001<script>']){s.mudarNumero(n);await s.carregar();}assert.equal(calls,0);
});
test('configuração real congela a revisão antes da leitura assíncrona dos anexos e Limpar não trava a fonte',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const start=html.indexOf("  montarFerramenta({\r\n    ferramenta: 'minuta'");
 assert.ok(start>=0);const end=html.indexOf('  // Limpar: além da saída',start);assert.ok(end>start);
 let cfg,ocupada=true,travada=false;const stub=()=>{};
 const context={montarFerramenta:x=>{cfg=x;},entrevistaTexto:stub,validar:stub,processarMinuta:stub,esconderDecisao:stub,
  ATO:'UE',extraFonteEmCurso:null,tituloBase:()=> 'Título fictício',FERRAMENTAS:{paginaMinutas:{ocupada:()=>ocupada}},
  fonteProtocolo:{payload:ato=>({ato_minuta:ato,protocolo:'9001',protocolo_revisao:'a'.repeat(64)}),travar:x=>{travada=x;}}};
 vm.runInNewContext(html.slice(start,end),context);cfg.aoIniciar();assert.equal(travada,true);
 context.ATO='DIV';assert.equal(cfg.corpoExtra().ato_minuta,'UE');cfg.aoTerminar();assert.equal(travada,false);
 ocupada=false;cfg.aoIniciar();assert.equal(travada,false);assert.equal(cfg.corpoExtra(),null);
});
test('conferência separada usa somente texto e avisa quando a revisão histórica ficou antiga',()=>{
 const {mostrarConferencia}=require('../protocolo-minuta.js');
 function element(){return{children:[],appendChild(e){this.children.push(e);},set innerHTML(_){throw new Error('HTML não permitido');}};}
 const nodes={minFonteConferencia:element(),minFonteConferenciaLinhas:element(),minFonteConferenciaResumo:element()};
 const doc={getElementById:id=>nodes[id],createElement:element};
 mostrarConferencia(doc,{fonte_protocolo:{numero:9001},fonte_desatualizada:true,conferencia_fonte:[{campo:'/dados/triagem/pag_ant_forma',decisao:'documento',cobertura:'aplicado',motivo:'<script>não executar</script>',documento:{nome:'fictício.pdf',pagina:1,trecho:'Pagamento por depósito'},trecho_minuta:'O preço foi pago por depósito.'}]});
 assert.equal(nodes.minFonteConferencia.open,true);assert.match(nodes.minFonteConferenciaResumo.textContent,/versão anterior/);assert.match(nodes.minFonteConferenciaLinhas.children[0].children[1].textContent,/<script>/);
 mostrarConferencia(doc,null);assert.equal(nodes.minFonteConferencia.hidden,true);
});

test('texto guardado alterado não reapresenta matriz anterior como conferência válida',()=>{
 const {mostrarConferencia}=require('../protocolo-minuta.js');
 const nodes={};const element=()=>({children:[],appendChild(e){this.children.push(e);},classList:{add(){}}});
 const doc={getElementById:id=>nodes[id]||(nodes[id]=element()),createElement:element};
 mostrarConferencia(doc,{fonte_protocolo:{numero:9001},fonte_conferencia_estado:'texto_editado_requer_conferencia',conferencia_fonte:[{campo:'/dados/preco',decisao:'protocolo',cobertura:'aplicado',trecho_minuta:'Trecho da versão anterior'}]});
 assert.match(nodes.minFonteConferenciaResumo.textContent,/não valida este texto/);assert.equal(nodes.minFonteConferencia.open,true);assert.equal(nodes.minFonteConferenciaLinhas.children.length,0);
});

test('abrir histórico elimina botão Google Doc e saída da geração anterior antes da resposta',()=>{
 const {prepararHistorico}=require('../protocolo-minuta.js');const nodes={};
 const doc={getElementById:id=>nodes[id]||(nodes[id]={hidden:false,textContent:'texto anterior',classList:{add(){}}})};
 prepararHistorico(doc);for(const id of ['btnCopiarMin','minDocCriar','minDocBox','minutaLinkBox','minFonteConferencia'])assert.equal(nodes[id].hidden,true);
 assert.equal(nodes.saidaMinuta.textContent,'Carregando a minuta guardada…');
});

test('reabertura descarta resposta histórica atrasada e transmite estado de texto editado',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const a=html.indexOf("  if (rota && rota.indexOf('minuta=') === 0) {");const b=html.indexOf("  if (rota === 'protocolo'",a);assert.ok(a>=0&&b>a);
 const aguardando=[],nodes={};let ultimaConferencia;
 const ctx={MINUTA_EXIBICAO_VERSAO:0,MINUTA_COPIAVEL:'antiga',MINUTA_ESTADO:'',MINUTA_ESTADO_COD:'',FERRAMENTAS:{paginaMinutas:{ocupada:()=>false}},document:{},toast(){},mostrarPagina(){},mostrarDocMinuta(){},quandoCurto:()=>'',processarMinuta:t=>t,
 CN2OFonteMinuta:{prepararHistorico(){},mostrarConferencia(_,r){ultimaConferencia=r;}},el:id=>nodes[id]||(nodes[id]={classList:{add(){},remove(){}}}),api:()=>new Promise(resolve=>aguardando.push(resolve))};
 vm.runInNewContext('this.abrir=function(rota,semHistorico){'+html.slice(a,b)+'}',ctx);
 ctx.abrir('minuta=A');ctx.abrir('minuta=B');aguardando[1]({texto:'Minuta B',fonte_conferencia_estado:'texto_editado_requer_conferencia',fonte_snapshot:{protocolo:{numero:9002}}});await new Promise(r=>setImmediate(r));
 aguardando[0]({texto:'Minuta A'});await new Promise(r=>setImmediate(r));
 assert.equal(nodes.saidaMinuta.textContent,'Minuta B');assert.equal(ultimaConferencia.fonte_conferencia_estado,'texto_editado_requer_conferencia');assert.equal(ctx.MINUTA_COPIAVEL,'');
});

test('título do histórico usa nomes e ato congelados antes da geração',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const a=html.indexOf('  function tituloDaMinuta('),b=html.indexOf('  // v1.30',a);const ctx={MINUTA_ESTADO_COD:'PRELIMINAR',tituloBase:()=> 'DIV — nomes alterados'};
 vm.runInNewContext(html.slice(a,b)+'\nthis.titulo=tituloDaMinuta;',ctx);
 assert.equal(ctx.titulo('UE — nomes originais'),'UE — nomes originais · PRELIMINAR');
 assert.match(html,/tituloDaMinuta\(extraFonteEmCurso && extraFonteEmCurso\.titulo_base\)/);
 assert.match(html,/if \(versaoParaGuardar !== MINUTA_EXIBICAO_VERSAO\) return;/);
});

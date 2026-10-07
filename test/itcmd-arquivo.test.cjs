'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const A = require('../itcmd-arquivo.js'), M = require('../frontend/src/itcmd/motor.js');
const estado = () => ({ modo: 'inventario', inv: [{ nome: 'Fulano', partilhaReal: { taxaFr: new M.Fr(1, 3) } }, { nome: 'Beltrana' }], orc: { certidoes: '30,00' }, desconsiderarMulta: false });
const adiar = () => { let resolve,reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };
function criar(extra={}) {
  let s=estado(), meta={titulo:'',protocolo:''}, count=0; const calls=[], session={token:'a',login:'a'};
  const op={sessao:()=>session,estado:()=>s,aplicar:x=>{s=x;},novo:estado,identificacao:()=>meta,identificar:x=>{meta=x;},uuid:()=> 'uuid-'+(++count),confirmar:()=>true,
    api:async(url,opts)=>{calls.push({url,opts});return {...opts.corpo,versao:opts.corpo.versao_base+1,documentos:[]};},...extra};
  const model=A.criar(op);return {model,op,calls,session,get s(){return s;},set s(v){s=v;},set meta(v){meta=v;}};
}
test('estado JSON conserva fração exata e título inclui falecidos ou doadores/donatários',()=>{
  const s=A.copiar(estado()); assert.equal(new M.Fr(s.inv[0].partilhaReal.taxaFr.n,s.inv[0].partilhaReal.taxaFr.d).txt(),'1/3');
  assert.equal(A.tituloPadrao(s),'Inventário — Fulano'); s.modo='cumulativo'; assert.match(A.tituloPadrao(s),/Fulano e Beltrana/);
  assert.match(A.tituloPadrao({modo:'doacao',doa:{doadores:[{nome:'Doadora'}],donatarios:[{nome:'Donatário'}]}}),/Doadora e Donatário/);
});
test('salvar congela o estado e envia CAS inicial e operação idempotente',async()=>{
  const a=criar(); a.model.marcar(); await a.model.salvar(); const body=a.calls[0].opts.corpo;
  assert.equal(body.versao_base,0); assert.ok(body.operacao_id); assert.equal(body.titulo,'Inventário — Fulano'); assert.equal(a.model.sujo,false);
  a.s.inv[0].nome='Alterado'; assert.equal(body.estado.inv[0].nome,'Fulano');
  await a.model.salvar(); assert.equal(a.calls[1].opts.corpo.versao_base,1); assert.equal(a.calls[1].opts.corpo.id,body.id);
});
test('edição durante upload continua marcada não salva',async()=>{
  const w=adiar(), a=criar({api:()=>w.promise});a.model.marcar();const p=a.model.salvar();a.s.inv[0].nome='Outro';a.model.marcar();w.resolve({id:'a',versao:1,documentos:[]});await p;assert.equal(a.model.sujo,true);
});
test('snapshot anterior ao preparo do PDF não apaga aviso de edição posterior',async()=>{
  const a=criar();a.model.marcar();const t=a.model.ticket(),s=A.copiar(a.s);a.s.inv[0].nome='Editado durante preparo';a.model.marcar();await a.model.salvar([],s,false,t);assert.equal(a.model.sujo,true);assert.equal(a.calls[0].opts.corpo.estado.inv[0].nome,'Fulano');
});
test('troca de trabalho invalida snapshot preparado e download anterior',async()=>{
  const a=criar({api:async()=>({id:'b',versao:3,titulo:'B',estado:estado(),documentos:[]})});const t=a.model.ticket();await a.model.abrir('b');assert.equal(a.model.validoContexto(t),false);await assert.rejects(a.model.salvar([],estado(),false,t),/trabalho aberto mudou/);
});
test('resposta de abrir não sobrescreve digitação ocorrida durante a consulta',async()=>{
  const w=adiar(),a=criar({api:()=>w.promise});const p=a.model.abrir('b');a.s.inv[0].nome='Meu rascunho';a.model.marcar();w.resolve({id:'b',versao:1,estado:estado()});assert.equal(await p,false);assert.equal(a.s.inv[0].nome,'Meu rascunho');
});
test('guard real da importação IA descarta resposta após edição, troca de trabalho ou cancelamento',async()=>{
  const ui=fs.readFileSync(path.join(__dirname,'../frontend/src/itcmd/ui.js'),'utf8');const start=ui.indexOf('      const origemArquivo ='),end=ui.indexOf('      const t0 = Date.now();',start);assert.ok(start>0&&end>start);
  const a=criar({api:async()=>({id:'b',versao:1,estado:estado()})}),ctrl=new AbortController();
  const guard=vm.runInNewContext(ui.slice(start,end)+'\nconferirOrigem;', {ARQUIVO:{modelo:a.model},ctrl});
  assert.doesNotThrow(guard);a.model.marcar();assert.throws(guard,e=>e.cancelado&&e.contextoMudou);
  const outro=vm.runInNewContext(ui.slice(start,end)+'\nconferirOrigem;', {ARQUIVO:{modelo:a.model},ctrl});
  await a.model.abrir('b');assert.throws(outro,e=>e.contextoMudou);assert.equal(a.s.inv[0].nome,'Fulano');
  const cancelado=vm.runInNewContext(ui.slice(start,end)+'\nconferirOrigem;', {ARQUIVO:{modelo:a.model},ctrl});ctrl.abort();assert.throws(cancelado,e=>e.cancelado);
});
test('restaurar versão antiga cria nova revisão sobre a versão atual, preservando anteriores',async()=>{
  const a=criar();a.op.api=async(url,opts)=>{a.calls.push({url,opts});if(opts.corpo)return {...opts.corpo,versao:5};if(url.includes('/versoes/'))return {estado:{...estado(),hoje:'2020-01-01'},versao:1};return {id:'a',versao:4,titulo:'A',estado:estado(),versoes:[{versao:1}]};};
  await a.model.abrir('a',1);assert.equal(a.s.hoje,'2020-01-01');assert.equal(a.model.sujo,true);await a.model.salvar();assert.equal(a.calls.at(-1).opts.corpo.versao_base,4);
});
test('409 preserva dados e exige cópia ou reabertura',async()=>{
  const a=criar({api:async()=>{throw {status:409};}});a.model.marcar();await assert.rejects(a.model.salvar());assert.equal(a.model.conflito,true);assert.equal(a.s.inv[0].nome,'Fulano');await assert.rejects(a.model.salvar(),/cópia/);
  a.op.api=async(url,opts)=>({...opts.corpo,versao:1});await a.model.salvar([],undefined,true);assert.equal(a.model.conflito,false);
});
test('falha ambígua repete exatamente a mesma operação, mesmo após nova edição',async()=>{
  let n=0;const calls=[];const a=criar({api:async(url,opts)=>{calls.push(A.copiar(opts.corpo));if(++n===1)throw new Error('Rede');return {...opts.corpo,versao:1};}});
  a.model.marcar();await assert.rejects(a.model.salvar());assert.equal(a.model.pendente,true);a.s.inv[0].nome='Novo';a.model.marcar();await a.model.repetir();assert.deepEqual(calls[0],calls[1]);assert.equal(a.model.sujo,true);
});
test('logout durante salvamento ignora resposta antiga e não repõe dados',async()=>{
  const w=adiar(),a=criar({api:()=>w.promise});const p=a.model.salvar();a.model.reset();a.session.token='b';w.resolve({id:'a',versao:1});await assert.rejects(p);assert.equal(a.model.atual,null);assert.equal(a.model.ocupado,false);
});
test('anexo PDF é validado e codificado sem HTML ou mudança de bytes',async()=>{
  const bytes='%PDF-1.4\ntexto\n%%EOF';const d=await A.pdfParaDocumento(new Blob([bytes]),'guia_itcmd','guia.pdf');assert.equal(Buffer.from(d.base64,'base64').toString(),bytes);assert.equal(d.mime,'application/pdf');
  await assert.rejects(A.pdfParaDocumento(new Blob(['<html>']), 'guia_itcmd','x.pdf'),/PDF válido/);
  await assert.rejects(A.pdfParaDocumento(new Blob([new Uint8Array(5*1024*1024+1)]),'guia_itcmd','x.pdf'),/5 MB/);
});
test('migrar remove honorários, mantém ajuste manual e reidrata Fr da cessão',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'../frontend/src/itcmd/ui.js'),'utf8');const start=ui.indexOf('  function migrar(r)'),end=ui.indexOf("  $('#btRestaurar')",start);
  const base=()=>({...estado(),emol:{},doa:{doadores:[],donatarios:[],bens:[]}});const ctx={M,estadoInicial:base,novoFalecido:()=>({conjuge:{},ascendentes:{},descendentes:[],colaterais:[],bens:[]}),novaDecl:()=>({inventariante:{},responsavel:{}}),novaPartilhaReal:()=>({}),novaDoacao:()=>({}),uid:()=> 'u',r:{...A.copiar(estado()),orc:{honorarios:'100000,00',certidoes:'10'},desconsiderarMulta:true,motivoMulta:'Conferido'}};
  const result=vm.runInNewContext(ui.slice(start,end)+'\nmigrar(r)',ctx);assert.equal(result.orc.honorarios,undefined);assert.equal(result.orc.certidoes,'10');assert.equal(result.inv[0].partilhaReal.taxaFr.txt(),'1/3');assert.equal(result.desconsiderarMulta,true);assert.equal(result.motivoMulta,'Conferido');
});
test('UI não salva dados no localStorage e inclui dois arquivos e ajustes solicitados',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'../frontend/src/itcmd/ui.js'),'utf8'),mod=fs.readFileSync(path.join(__dirname,'../itcmd-arquivo.js'),'utf8');
  assert.doesNotMatch(ui,/localStorage\.setItem/);assert.doesNotMatch(ui,/\['honorarios'/);assert.match(ui,/desconsiderarMulta: S\.desconsiderarMulta === true/);assert.match(mod,/Inventários salvos/);assert.match(mod,/Doações salvas/);assert.match(mod,/\?grupo=/);
});
test('a impressão delega ao renderer novo e rejeita documento sem versão ou logo',()=>{
  assert.throws(()=>A.pdfOrcamento(function(){},{}),/resumido ou discriminado/);
  assert.throws(()=>A.pdfOrcamento(function(){},{versao:'resumido'}),/logo oficial/);
});

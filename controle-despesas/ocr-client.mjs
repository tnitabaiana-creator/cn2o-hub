import { extractFields, combineDocuments, FIELD_NAMES } from './extract-fields.mjs';
import { cloud } from './cloud-client.mjs';
import { automaticRead } from './automatic-reading.mjs';
const app=window.ArquivoApp;
const $=id=>document.getElementById(id);
const fieldIds={supplier:'supplier',taxId:'tax-id',description:'description',amount:'amount',paidDate:'paid-date'};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let workerPromise,pdfModule,activeDocument=null,applied={},configuration=null;
const chosenDocs=()=>[...document.querySelectorAll('input[name=document-id]:checked')].map(i=>app.getDocuments().find(d=>d.id===i.value)).filter(Boolean);
function status(text){$('ocr-status').textContent=text;}
async function worker(){
  if(!workerPromise){
    workerPromise=(async()=>{
      if(!window.Tesseract)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='./vendor/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('Não foi possível carregar o leitor local. Use a pasta completa no servidor ou no Netlify.'));document.head.append(script);});
      return window.Tesseract.createWorker('por',1,{workerPath:new URL('./vendor/worker.min.js',import.meta.url).href,corePath:new URL('./vendor/tesseract-core',import.meta.url).href,langPath:new URL('./vendor/lang',import.meta.url).href,logger:m=>{if(m.status==='recognizing text')status('Reconhecendo texto… '+Math.round((m.progress||0)*100)+'%');},errorHandler:()=>{status('O leitor encontrou uma falha. O arquivo continua guardado.');}});
    })().catch(error=>{workerPromise=null;throw error;});
  }
  return workerPromise;
}
async function pdfReader(){
  if(!pdfModule){pdfModule=await import('./vendor/pdf.mjs');pdfModule.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;}
  return pdfModule;
}
function canvasJPEG(canvas){
  let data=canvas.toDataURL('image/jpeg',.9);
  if(data.length>3400000)data=canvas.toDataURL('image/jpeg',.68);
  if(data.length>3400000)throw new Error('Página muito grande para o serviço. Reduza a resolução ou use a leitura local.');
  return data.split(',')[1];
}
async function recognize(canvas){
  return automaticRead({
    primaryEnabled:configuration?.enabled!==false,
    primary:async()=>{
    const response=await cloud.request('ocr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:canvasJPEG(canvas)}),signal:AbortSignal.timeout(90000)});
    const result=await response.json();
    return {text:result.text,confidence:Number.isFinite(result.confidence)?result.confidence*100:null,method:'google-vision'};
    },
    onFallback:()=>status('Conferindo a imagem com uma leitura alternativa automática…'),
    secondary:async()=>{
      const reader=await worker();const result=await reader.recognize(canvas);
      return {text:result.data.text||'',confidence:result.data.confidence,method:'tesseract-local'};
    }
  });
}
function pdfText(items){
  const rows=[];
  for(const item of items){if(!item.str?.trim())continue;const y=item.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<3);if(!row){row={y,items:[]};rows.push(row);}row.items.push(item);}
  return rows.sort((a,b)=>b.y-a.y).map(row=>row.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' ')).join('\n');
}
async function imageCanvas(blob){
  const image=await createImageBitmap(blob);
  try{const scale=Math.min(1,2500/Math.max(image.width,image.height),Math.sqrt(5000000/(image.width*image.height)));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);return canvas;}finally{image.close();}
}
async function readDocument(doc,onPage){
  if(doc.type!=='application/pdf'){
    const canvas=await imageCanvas(doc.blob);
    try{const result=await recognize(canvas);await onPage({...result,page:1});return 1;}finally{canvas.width=canvas.height=1;}
  }
  const pdfjs=await pdfReader();
  const loading=pdfjs.getDocument({data:new Uint8Array(await doc.blob.arrayBuffer()),isEvalSupported:false,useSystemFonts:true,cMapUrl:new URL('./vendor/cmaps/',import.meta.url).href,cMapPacked:true,standardFontDataUrl:new URL('./vendor/standard_fonts/',import.meta.url).href,wasmUrl:new URL('./vendor/wasm/',import.meta.url).href});
  let pdf;
  try{
    pdf=await loading.promise;activeDocument.pageCount=pdf.numPages;
    for(let n=1;n<=pdf.numPages;n++){
      status(`Lendo ${doc.name} · página ${n} de ${pdf.numPages}…`);
      const page=await pdf.getPage(n),content=await page.getTextContent(),text=pdfText(content.items);
      const operators=await page.getOperatorList();
      const imageOperators=[pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject,pdfjs.OPS.paintImageMaskXObject,pdfjs.OPS.paintImageXObjectRepeat,pdfjs.OPS.paintImageMaskXObjectRepeat].filter(Number.isInteger);
      const hasImages=operators.fnArray.some(fn=>imageOperators.includes(fn));
      if(!hasImages&&text.replace(/\s/g,'').length>=30){await onPage({page:n,text,confidence:null,method:'texto-pdf'});page.cleanup();continue;}
      const base=page.getViewport({scale:1}),scale=Math.min(2.5,2200/Math.max(base.width,base.height),Math.sqrt(5000000/(base.width*base.height))),viewport=page.getViewport({scale});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      try{await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;const result=await recognize(canvas);await onPage({...result,page:n});}finally{canvas.width=canvas.height=1;page.cleanup();}
    }
    return pdf.numPages;
  }finally{if(pdf)await pdf.destroy();else await loading.destroy();}
}
export async function processDoc(doc,{openForm=false}={}){
  if(activeDocument)return app.say('Aguarde a leitura em andamento.');
  const engine='automatic';
  if(location.protocol==='file:'){app.say('Para executar a leitura, abra a pasta completa por localhost ou Netlify.');return;}
  const previous=doc.ocr;
  activeDocument={id:doc.id,pageCount:doc.type==='application/pdf'?null:1};
  let persistError=false,started=false;
  try{
    await configurationReady;
    if(configuration?.accessError)throw configuration.accessError;
    if(!doc.blob)await cloud.original(doc);
    doc.ocr={status:'processing',engine,startedAt:new Date().toISOString(),pages:[],fields:{},warnings:[]};
    started=true;
    await app.saveDocument(doc);status('Preparando a leitura de '+doc.name+'…');
    const pages=[];
    const total=await readDocument(doc,async page=>{
      pages.push(page);doc.ocr.pages=[...pages];doc.ocr.pageCount=activeDocument.pageCount;
      await app.saveDocument(doc);
    });
    const result=extractFields(pages,{kind:doc.kind});
    doc.ocr={...doc.ocr,...result,status:pages.some(p=>p.text.trim())?'complete':'empty',pageCount:total,finishedAt:new Date().toISOString()};
    const low=pages.filter(p=>p.confidence!==null&&p.confidence<50);
    if(low.length)doc.ocr.warnings.push({message:'A leitura teve baixa confiança em '+low.length+' página(s). Confira o original.'});
    if(previous)doc.ocr.previousRead={finishedAt:previous.finishedAt,engine:previous.engine};
    await app.saveDocument(doc);
    status(`Leitura concluída: ${Object.keys(result.fields).length} campo(s) identificado(s) · ${total} página(s).`);
    if(openForm)app.openForDocument(doc);
  }catch(error){
    if(workerPromise){try{await (await workerPromise).terminate();}catch{}workerPromise=null;}
    if(!started){status(error.message);app.say(error.message);return;}
    const result=extractFields(doc.ocr.pages||[],{kind:doc.kind});
    doc.ocr={...doc.ocr,...result,status:doc.ocr.pages.length?'partial':'error',error:String(error.message||'Falha de leitura.'),pageCount:activeDocument.pageCount,finishedAt:new Date().toISOString()};
    try{await app.saveDocument(doc);}catch{persistError=true;}
    status(persistError?'Falha ao salvar o resultado da leitura. Guarde o original.':doc.ocr.error);
    app.say('Leitura não concluída. O arquivo permanece pendente para reprocessamento.');
    if(openForm)app.openForDocument(doc);
  }finally{activeDocument=null;app.render();if($('entry-dialog').open)showEvidence();}
}
function markFields(){
  for(const [key,id] of Object.entries(fieldIds)){
    const hint=$('source-'+key);
    if(hint)hint.textContent=applied[key]?'Extraído de '+applied[key].documentName+' · página '+applied[key].source.page:'';
  }
}
function applyEmpty(){
  const docs=chosenDocs(),result=combineDocuments(docs);let count=0;
  for(const conflict of result.conflicts)if(applied[conflict.field]){$(fieldIds[conflict.field]).value='';delete applied[conflict.field];$('reviewed').checked=false;}
  for(const [key,item] of Object.entries(result.fields)){
    const input=$(fieldIds[key]);if(input.value.trim())continue;
    input.value=item.value;applied[key]=item;count++;
  }
  if(count)$('reviewed').checked=false;
  markFields();showEvidence();return count;
}
function showEvidence(){
  const docs=chosenDocs();
  const result=combineDocuments(docs);
  const read=docs.filter(d=>d.ocr);
  if(!read.length){$('ocr-evidence').innerHTML='<p class="muted">Vincule um documento e use a leitura automática para preencher os campos disponíveis.</p>';return;}
  const warnings=[...result.conflicts,...read.flatMap(d=>d.ocr.warnings||[])];
  const facts=Object.entries(result.fields).map(([key,item])=>'<li><strong>'+esc(FIELD_NAMES[key])+':</strong> '+esc(item.value)+'<small>'+esc(item.documentName)+' · página '+item.source.page+' · “'+esc(item.source.quote)+'”</small></li>').join('');
  const pending=Object.keys(FIELD_NAMES).filter(k=>!result.fields[k]).map(k=>FIELD_NAMES[k]);
  $('ocr-evidence').innerHTML='<strong>Dados identificados nos documentos</strong><ul class="ocr-facts">'+facts+'</ul>'+(pending.length?'<p class="hint">Sem informação única: '+esc(pending.join(', '))+'. Preencha manualmente.</p>':'')+(warnings.length?'<ul class="ocr-warnings">'+[...new Set(warnings.map(w=>w.message))].map(text=>'<li>'+esc(text)+'</li>').join('')+'</ul>':'')+read.filter(d=>['error','partial','processing','interrupted','empty'].includes(d.ocr.status)).map(d=>'<p class="hint">'+esc(d.name)+': '+esc(statusLabel(d.ocr))+(d.ocr.error?' · '+esc(d.ocr.error):'')+'</p>').join('')+'<button type="button" class="btn" id="fill-empty">Preencher campos vazios</button>';
  $('fill-empty').onclick=()=>{const count=applyEmpty();app.say(count?count+' campo(s) preenchido(s). Confira os dados.':'Nenhum campo vazio com informação única. Os dados manuais foram preservados.');};
}
export function prefill({existing=false,sources={}}={}){
  applied=Object.fromEntries(Object.entries(sources).filter(([,item])=>item.documentId&&item.source));if(!existing)applyEmpty();else{markFields();showEvidence();}
  $('history-note').textContent='Os campos extraídos têm arquivo e página de origem. Confira a leitura e complete as informações ausentes. A leitura não confirma o pagamento nem a dedutibilidade.';
}
export function collectSources(){
  const result={};for(const [key,id] of Object.entries(fieldIds)){
    const source=applied[key],value=$(id).value;
    if(source&&(key==='amount'?Number(source.value)===Number(value):source.value===value))result[key]=source;
    else if(value)result[key]={value,method:'manual'};
  }return result;
}
export function statusLabel(ocr){return ({processing:'Leitura em andamento',complete:'Dados prontos para conferir',empty:'Nenhum texto identificado',partial:'Leitura parcial — conferir',error:'Falha de leitura',interrupted:'Leitura interrompida'})[ocr?.status]||'Ainda não lido';}
export function viewText(doc){
  $('ocr-text-title').textContent='Leitura de '+doc.name;
  $('ocr-text-meta').textContent=statusLabel(doc.ocr)+' · '+(doc.ocr?.pages?.length||0)+' página(s) lida(s) de '+(doc.ocr?.pageCount||'?');
  $('ocr-text').textContent=(doc.ocr?.pages||[]).map(p=>'PÁGINA '+p.page+' · '+(p.method==='texto-pdf'?'Texto do documento':'Leitura automática')+'\n'+p.text).join('\n\n')||'Nenhum texto disponível. Execute a leitura automática.';
  $('ocr-text-dialog').showModal();
}
async function loadConfig(){
  try{const response=await cloud.request('ocr-config');configuration=await response.json();}
  catch(error){configuration=[401,403].includes(error.status)?{accessError:error}:{enabled:true};}
}
$('entry-form').addEventListener('input',event=>{const key=Object.keys(fieldIds).find(k=>fieldIds[k]===event.target.id);if(key&&applied[key]){delete applied[key];markFields();}});
$('entry-form').addEventListener('change',event=>{if(event.target.name==='document-id'){$('reviewed').checked=false;for(const [key,item] of Object.entries(applied)){if(!item.documentId)continue;const selected=chosenDocs();if(!selected.some(d=>d.id===item.documentId)){$(fieldIds[key]).value='';delete applied[key];}}applyEmpty();}});
window.ArquivoOCR={processDoc,prefill,collectSources,statusLabel,viewText,isBusy:()=>!!activeDocument};
app.render();
const configurationReady=loadConfig();

import {cloud} from './cloud-client.mjs';
const hex=bytes=>[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
export function checkManifest(input){
 if(input?.format!=='cn2o-expenses-1'||!Array.isArray(input.documents)||!Array.isArray(input.entries)||input.documents.length>2000||input.entries.length>2000)throw new Error('Arquivo de importação inválido.');
 const hashes=new Set();
 for(const d of input.documents){if(!/^[a-f0-9]{64}$/.test(d.hash)||typeof d.name!=='string'||d.name.length>499||!/^\d{4}-(0[1-9]|1[0-2])$/.test(d.period)||hashes.has(d.hash))throw new Error('Documento inválido ou repetido no arquivo de importação.');hashes.add(d.hash);}
 const ids=new Set();
 for(const e of input.entries){if(!/^[a-f0-9-]{36}$/.test(e.id)||ids.has(e.id)||!Array.isArray(e.documentHashes)||!e.documentHashes.length||e.documentHashes.some(h=>!hashes.has(h))||e.reviewed!==false)throw new Error('Lançamento inválido ou sem comprovante no arquivo de importação.');ids.add(e.id);}
 return input;
}
export async function importBatch(input,files,{progress=()=>{},refresh=()=>cloud.refresh(),put=(name,record)=>cloud.put(name,record)}={}){
 const manifest=checkManifest(input),state=await refresh(),knownDocs=new Map(state.documents.map(d=>[d.hash,d])),knownEntries=new Map(state.entries.map(e=>[e.id,e]));
 const byName=new Map();for(const f of files){const a=byName.get(f.name)||[];a.push(f);byName.set(f.name,a);}
 const result={documentsAdded:0,documentsReused:0,entriesAdded:0,entriesReused:0,failures:[]};
 // Verify the complete selection before the first write.
 const selected=new Map();
 for(const d of manifest.documents){if(knownDocs.has(d.hash))continue;let found;
  for(const f of byName.get(d.name)||[]){if(f.size!==d.size)continue;const hash=hex(await crypto.subtle.digest('SHA-256',await f.arrayBuffer()));if(hash===d.hash){found=f;break;}}
  if(!found)throw new Error('Selecione o original correspondente a '+d.name+'. Nenhum registro foi importado nesta tentativa.');
  selected.set(d.hash,found);
 }
 let next=0,processed=0;
 await Promise.all(Array.from({length:3},async()=>{for(;;){const d=manifest.documents[next++];if(!d)break;
  progress('Recebendo comprovantes: '+(++processed)+' de '+manifest.documents.length+' · '+d.name);
  try{
   if(knownDocs.has(d.hash)){result.documentsReused++;continue;}
   const file=selected.get(d.hash),record={id:crypto.randomUUID(),hash:d.hash,name:d.name,period:d.period,kind:d.kind||'Comprovante de pagamento',size:d.size,type:'application/pdf',blob:file};
   try{await put('documents',record);}catch(e){if(e.code==='DOCUMENT_EXISTS'){const data=await refresh();const existing=data.documents.find(x=>x.hash===d.hash);if(!existing)throw e;knownDocs.set(d.hash,existing);result.documentsReused++;continue;}throw e;}
   knownDocs.set(d.hash,record);result.documentsAdded++;
   if(d.ocr){record.ocr=d.ocr;try{await put('documents',record);}catch(e){result.failures.push({document:d.name,stage:'leitura',error:e.message});}}
  }catch(e){result.failures.push({document:d.name,stage:'documento',error:e.message});}
 }}));
 for(const [i,e] of manifest.entries.entries()){
  progress('Salvando lançamentos: '+(i+1)+' de '+manifest.entries.length);
  try{
   if(knownEntries.has(e.id)){result.entriesReused++;continue;}
   const docIds=e.documentHashes.map(h=>knownDocs.get(h)?.id);if(docIds.some(id=>!id))throw new Error('Um dos originais ainda não foi recebido.');
   const record={...e,docIds,version:0,demo:false};delete record.documentHashes;
   // Replace source placeholders with actual document IDs, preserving the evidence.
   record.fieldSources=Object.fromEntries(Object.entries(record.fieldSources||{}).map(([key,source])=>{const s={...source,documentId:knownDocs.get(source.documentHash)?.id};delete s.documentHash;return [key,s];}));
   await put('entries',record);knownEntries.set(e.id,record);result.entriesAdded++;
  }catch(error){result.failures.push({entry:e.id,description:e.description,stage:'lançamento',error:error.message});}
 }
 return result;
}
export function mountBatchImport({refresh,onComplete}){
 const manifestInput=document.getElementById('batch-manifest'),filesInput=document.getElementById('batch-files'),button=document.getElementById('batch-run'),status=document.getElementById('batch-status'),download=document.getElementById('batch-result');
 let manifest=null,busy=false;
 const ready=()=>{button.disabled=busy||!manifest||(!filesInput.files.length&&manifest.documents.length>0);};
 manifestInput.onchange=async()=>{try{manifest=checkManifest(JSON.parse(await manifestInput.files[0].text()));status.textContent=manifest.documents.length+' comprovante(s) · '+manifest.entries.length+' lançamento(s) preparados. Selecione os PDFs originais.';}catch(e){manifest=null;status.textContent=e.message;}ready();};
 filesInput.onchange=()=>{status.textContent=filesInput.files.length+' arquivo(s) selecionado(s).';ready();};
 button.onclick=async()=>{if(busy)return;busy=true;manifestInput.disabled=true;filesInput.disabled=true;ready();try{const result=await importBatch(manifest,[...filesInput.files],{refresh,progress:text=>status.textContent=text});
  status.textContent=result.documentsAdded+' comprovante(s) novo(s), '+result.documentsReused+' existente(s) · '+result.entriesAdded+' lançamento(s) novo(s), '+result.entriesReused+' existente(s) · '+result.failures.length+' falha(s).';
  if(download.href)URL.revokeObjectURL(download.href);download.href=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));download.download='resultado-importacao.json';download.hidden=false;await onComplete();
 }catch(e){status.textContent=e.message;}finally{busy=false;manifestInput.disabled=false;filesInput.disabled=false;ready();}};
}

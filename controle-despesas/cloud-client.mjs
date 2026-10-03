import { startAuth, showAccess, hubHeaders, ENDPOINT } from './auth-client.mjs';
const size=1024*1024;
let user=null;
async function request(path,options={}){
  const response=await fetch(ENDPOINT+'/hub/despesas/'+path,{...options,headers:{...hubHeaders(),...options.headers}});
  if(!response.ok){let result;try{result=await response.json();}catch{}throw Object.assign(new Error(result?.error||'O servidor não confirmou a operação.'),{status:response.status});}
  return response;
}
const json=(path,body)=>request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
export const cloud={
  request,
  json,
  get user(){return user;},
  async start(){const state=await startAuth();if(state.local)return {local:true};user=state.user;if(!user){showAccess();return {authenticated:false};}const data=await this.refresh();return {authenticated:true,...data};},
  async refresh(){const data=await (await request('data')).json();user=data.user;return data;},
  async put(name,record){
    if(name==='entries'){const result=await json('data',record);record.version=result.version;return;}
    if(record.version){const result=await json('documents?action=ocr&id='+record.id,{ocr:record.ocr,version:record.version});record.version=result.version;return;}
    const reserved=await json('documents?action=reserve',record);
    if(reserved.duplicate)throw Object.assign(new Error('Documento já recebido.'),{code:'DOCUMENT_EXISTS',documentId:reserved.id});
    record.id=reserved.id;
    for(let n=0;n<Math.ceil(record.blob.size/size);n++){
      document.getElementById('upload-progress').textContent='Enviando '+record.name+' · parte '+(n+1)+' de '+Math.ceil(record.blob.size/size)+'…';
      await request('documents?action=chunk&id='+record.id+'&chunk='+n,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:record.blob.slice(n*size,(n+1)*size)});
    }
    const result=await json('documents?action=finish&id='+record.id,{});record.version=result.version;record.person=user.login;
  },
  async original(doc){
    if(doc.blob)return doc.blob;
    const parts=[];for(let n=0;n<Math.ceil(doc.size/size);n++)parts.push(await (await request('documents?action=chunk&id='+doc.id+'&chunk='+n)).arrayBuffer());
    const blob=new Blob(parts,{type:doc.type});
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');
    if(hash!==doc.hash)throw new Error('O original recebido não passou na conferência de integridade.');
    doc.blob=blob;return blob;
  }
};

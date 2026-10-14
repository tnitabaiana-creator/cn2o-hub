'use strict';
(()=>{
const base='https://cn2o-hub-backend-production.up.railway.app', el=id=>document.getElementById(id);
const token=sessionStorage.getItem('cn2o_token') || '';
let admin=false, revisao, listaAlertas=[], config;
const no=(tag,t)=>{const n=document.createElement(tag);if(t!==undefined)n.textContent=t;return n;};
const aviso=t=>{el('aviso').textContent=t;};
async function api(p,b){const r=await fetch(base+p,{method:b===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Auth-Token':token},body:b===undefined?undefined:JSON.stringify(b)});const j=await r.json();if(!r.ok)throw new Error(j.erro || 'Falha na operação.');return j;}
const ctl=(p,b)=>api('/hub/controle-sucessorio'+p,b);
function botao(t,fn){const b=no('button',t);b.type='button';b.addEventListener('click',()=>Promise.resolve(fn()).catch(e=>aviso(e.message)));return b;}
async function documento(a){const r=await fetch(base+'/hub/controle-sucessorio/documentos/'+a.id,{headers:{'X-Auth-Token':token}});if(!r.ok)throw new Error('Não foi possível abrir o documento.');const url=URL.createObjectURL(await r.blob()),link=no('a');link.href=url;link.download=a.nome;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function documentos(id,box){box.replaceChildren();for(const a of await ctl('/alertas/'+id+'/documentos'))box.append(botao(a.nome,()=>documento(a)),no('small','SHA-256: '+a.sha256));}
async function atualizar(){
 const dados=await ctl('/revisoes');const box=el('pedidos');box.replaceChildren();
 if(!dados.length)box.append(no('p','Nenhum pedido de análise registrado.'));
 for(const a of dados){const linha=no('div');linha.append(no('p',(a.sucessao?.autores || []).map(x=>x.nome).join(' / ')+' · '+a.estado+' · '+a.solicitante+(a.protocolo?' · Protocolo '+a.protocolo:'')),botao('Abrir análise',()=>abrir(a.id)));box.append(linha);}
 if(admin){listaAlertas=await ctl('/alertas');el('alertas').replaceChildren();for(const a of listaAlertas)el('alertas').append(botao(a.dados.nome+' · '+(a.ativo?'ativo':'inativo'),()=>editar(a)));}
}
async function abrir(id){
 revisao=await ctl('/revisoes/'+id);el('analise').hidden=false;el('detalhe').replaceChildren(no('p','Estado: '+revisao.estado+' · Solicitante: '+revisao.solicitante),no('p','Observação do escrevente: '+(revisao.conferencia.observacao || 'Não informada.')));
 el('payload').textContent=JSON.stringify(revisao.payload,null,2);
 for(const m of revisao.correspondencias){const s=no('section');s.append(no('h3',m.dados.nome),no('p','Relato recebido: '+m.dados.relato),no('p','Interessados a conferir: '+(m.dados.interessados || []).join('; ')));for(const [t,k] of [['Consta nos documentos','documentado'],['Conferir','pendencias']]){s.append(no('strong',t));const ul=no('ul');for(const x of m.dados[k])ul.append(no('li',x));s.append(ul);}s.append(no('p','Orientação: '+m.dados.orientacao),no('p','Solução jurídica prévia: '+(m.dados.solucao_previa || 'Não registrada.')));const docs=no('div');s.append(docs);await documentos(m.id,docs);el('detalhe').append(s);}
 el('decisao').hidden=!admin || !!revisao.protocolo;el('estado').value=['pendente','liberado','homonimo','obstado'].includes(revisao.estado)?revisao.estado:'pendente';el('fundamento').value=revisao.fundamento || '';el('checklist').replaceChildren();
 for(const [k,t] of Object.entries(config.checklist)){const l=no('label'),i=no('input');i.type='checkbox';i.dataset.item=k;i.checked=!!revisao.conferencia.checklist?.[k];l.append(i,document.createTextNode(' '+t));el('checklist').append(l);}
 el('historico').textContent=admin?JSON.stringify(await ctl('/historico/'+id),null,2):'Histórico completo disponível ao tabelião.';
 el('analise').scrollIntoView({behavior:'smooth'});
}
function editar(a){
 el('formAlerta').reset();el('alertaId').value=a?.id || '';el('baseRevisao').value=a?.revisao || '';el('ativo').checked=a?a.ativo:true;
 if(a)for(const [k,v] of Object.entries(a.dados)){if(el(k))el(k).value=Array.isArray(v)?v.join('\n'):v;}
 el('documentos').replaceChildren();if(a)return documentos(a.id,el('documentos'));
}
el('formAlerta').addEventListener('submit',async e=>{e.preventDefault();try{const b={};for(const k of ['nome','cpf','categoria','relato','fonte_relato','data_recebimento','orientacao','solucao_previa'])b[k]=el(k).value;for(const k of ['variantes','documentado','pendencias','interessados'])b[k]=el(k).value.split('\n').map(x=>x.trim()).filter(Boolean);if(el('alertaId').value){b.id=el('alertaId').value;b.base_revisao=Number(el('baseRevisao').value);}b.ativo=el('ativo').checked;const a=await ctl('/alertas',b);await editar(a);await atualizar();aviso('Alerta salvo.');}catch(x){aviso(x.message);}});
el('anexar').addEventListener('click',async()=>{try{const id=el('alertaId').value,f=el('arquivo').files[0];if(!id || !f)throw new Error('Salve o alerta e escolha o PDF.');if(f.size>8*1024*1024)throw new Error('O PDF deve ter até 8 MB.');const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(f);});await ctl('/alertas/'+id+'/documentos',{nome:f.name,base64});await atualizar();await editar(listaAlertas.find(a=>a.id===id));aviso('Documento anexado e hash registrado.');}catch(e){aviso(e.message);}});
el('decidir').addEventListener('click',async()=>{const b=el('decidir');b.disabled=true;try{const checklist={};el('checklist').querySelectorAll('input').forEach(i=>checklist[i.dataset.item]=i.checked);await ctl('/revisoes/'+revisao.id+'/decidir',{estado:el('estado').value,base_estado:revisao.estado,base_decidido_em:revisao.decidido_em,fundamento:el('fundamento').value,checklist});await abrir(revisao.id);await atualizar();aviso('Decisão registrada. A liberação vale apenas para os dados conferidos, por até sete dias e para um único protocolo.');}catch(e){aviso(e.message);}finally{b.disabled=false;}});
el('atualizar').addEventListener('click',()=>atualizar().catch(e=>aviso(e.message)));el('novo').addEventListener('click',()=>editar());
(async()=>{if(!token)throw new Error('Entre no Hub para acessar o controle.');const eu=await api('/hub/eu');admin=eu.admin;config=await ctl('/status');el('cadastros').hidden=!admin;await atualizar();})().catch(e=>aviso(e.message));
})();

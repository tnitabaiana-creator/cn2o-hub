import {cloud} from './cloud-client.mjs';
import {WORKSPACE} from './workspace.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountRouting({documents,entries,refresh,say}){
  const target=WORKSPACE.id==='cn2o'?'bravo':'cn2o',targetName=target==='bravo'?'Bravo Patrimonial':'Cartório CN2O';
  const section=document.createElement('div');section.className='panel';section.innerHTML='<h3>Conferir destinação</h3><p>Confira a tomadora ou destinatária no original. O e-mail de recebimento e o pagador, isoladamente, não determinam a contabilidade.</p><div class="actions"><button class="btn" id="routing-check">Conferir todo o acervo</button><button class="btn" id="routing-download" disabled>Baixar conferência completa (JSON)</button></div><p id="routing-status"></p><div id="routing-results"></div>';
  document.getElementById('documents').append(section);
  const dialog=document.createElement('dialog');dialog.id='routing-dialog';dialog.innerHTML='<form id="routing-form"><div class="form-body"><h2>Destinar a '+targetName+'</h2><p id="routing-name"></p><p>O original e o histórico serão preservados. Um lançamento transferido ficará pendente de revisão contábil no destino.</p><label for="routing-reason">Titularidade comprovada e motivo</label><textarea id="routing-reason" required minlength="10" maxlength="2000"></textarea><fieldset id="routing-segregated" hidden><legend>PDF histórico com despesas de mais de uma entidade</legend><label><input type="checkbox" id="routing-use-destination">Manter o PDF misto na origem e usar comprovantes segregados já arquivados no destino</label><div id="routing-destination-docs"></div></fieldset><p id="routing-error" role="alert"></p></div><div class="form-foot"><button class="btn" type="button" id="routing-cancel">Cancelar</button><button class="btn primary" id="routing-submit" type="submit">Transferir para '+targetName+'</button></div></form>';
  document.body.append(dialog);
  const $=id=>document.getElementById(id);let audit=null,selected=null;
  async function open(kind,id){
    const record=(kind==='document'?documents():entries()).find(x=>x.id===id);
    if(!record)return say('Atualize o painel antes de transferir.');
    selected={kind,id,version:record.version};$('routing-name').textContent=record.name||record.supplier+' · '+record.description;
    $('routing-reason').value='';$('routing-error').textContent='';$('routing-use-destination').checked=false;$('routing-destination-docs').innerHTML='';$('routing-segregated').hidden=kind!=='entry';dialog.showModal();
    if(kind==='entry'){try{const docs=await cloud.destinationDocuments(target);$('routing-destination-docs').innerHTML=docs.map(d=>'<label><input type="checkbox" name="destination-document" value="'+d.id+'">'+esc(d.name)+'</label>').join('')||'<p>Arquive primeiro os comprovantes segregados no controle de destino.</p>';}catch(error){$('routing-error').textContent=error.message;}}
  }
  document.addEventListener('click',e=>{
    const doc=e.target.closest('[data-route-document]');if(doc)open('document',doc.dataset.routeDocument);
    const entry=e.target.closest('[data-route-entry]');if(entry)open('entry',entry.dataset.routeEntry);
  });
  $('routing-cancel').onclick=()=>dialog.close();
  $('routing-form').onsubmit=async e=>{
    e.preventDefault();$('routing-submit').disabled=true;$('routing-error').textContent='';
    try{
      const replacementDocumentIds=$('routing-use-destination').checked?[...dialog.querySelectorAll('input[name=destination-document]:checked')].map(e=>e.value):undefined;
      const result=await cloud.json('routing',{...selected,target,reason:$('routing-reason').value,...(replacementDocumentIds?{replacementDocumentIds}:{})});
      if(!result.saved||result.target!==target)throw new Error('O destino não confirmou a transferência.');
      await refresh();dialog.close();say('Transferência confirmada para '+targetName+'. Confira o destino.');
      if(audit)await check();
    }catch(error){$('routing-error').textContent=error.message;}
    finally{$('routing-submit').disabled=false;}
  };
  async function check(){
    $('routing-check').disabled=true;
    try{
      audit=await(await cloud.request('routing')).json();if(audit.workspace!==WORKSPACE.id)throw new Error('Controle de origem não confirmado.');
      const candidates=audit.documents.filter(d=>!d.routing?.destination&&d.signals.length);
      $('routing-status').textContent=audit.documentCount+' documento(s) e '+audit.entryCount+' lançamento(s) conferidos em todos os períodos · '+candidates.length+' documento(s) com indícios de Bravo. Indício exige conferência do papel da empresa no original.';
      $('routing-results').innerHTML=candidates.map(d=>'<p><strong>'+esc(d.name)+'</strong><br>'+esc(d.signals.join(' · '))+' · '+d.linkedEntryIds.length+' lançamento(s) ativo(s)'+(cloud.user?.login==='cesar.bravo'&&!d.linkedEntryIds.length?' <button class="btn" data-route-document="'+d.id+'">Destinar a '+targetName+'</button>':'')+'</p>').join('');
      $('routing-download').disabled=false;
    }catch(error){$('routing-status').textContent=error.message;}
    finally{$('routing-check').disabled=false;}
  }
  $('routing-check').onclick=check;
  $('routing-download').onclick=()=>{
    if(!audit)return;const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(audit,null,2)],{type:'application/json'}));
    a.href=url;a.download=WORKSPACE.filePrefix+'-conferencia-destinacao.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  };
  return {check};
}

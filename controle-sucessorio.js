'use strict';
// Registro de alertas fica no servidor autenticado; nenhum caso pessoal no site público.
window.CN2OSucessao = (()=>{
  let cfg, resultado, pendentePayload, revisao, timer, consultaSeq=0;
  const el=id=>document.getElementById(id);
  const abrangido=()=>['INV','CDH'].includes(cfg.getAto());
  const node=(tag,texto)=>{const n=document.createElement(tag);if(texto!==undefined)n.textContent=texto;return n;};
  async function api(path,body){
    const r=await fetch(cfg.endpoint+'/hub/controle-sucessorio'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Auth-Token':cfg.token},body:body===undefined?undefined:JSON.stringify(body)});
    const j=await r.json();if(!r.ok)throw new Error(j.erro || 'Controle indisponível.');return j;
  }
  function dados(){
    const modalidade=cfg.getAto()==='CDH'?'cessao':el('sucessaoModalidade').value;
    return {modalidade,autores:(modalidade==='cumulativo'?el('sucessaoAutores').value:el('sucessaoAutor').value).split('\n').map(x=>x.trim()).filter(Boolean).map(nome=>({nome,cpf:''}))};
  }
  function mensagem(texto){el('sucessaoResultado').replaceChildren(node('p',texto));}
  function mostrar(r){
    resultado=r;const box=el('sucessaoResultado');box.replaceChildren();
    el('sucessaoEncaminhar').hidden=true;
    el('sucessaoConferencia').hidden=!r.correspondencias.length;
    if(!r.correspondencias.length){box.append(node('p','Consulta concluída: nenhum alerta corresponde aos nomes informados. A conferência documental do ato continua necessária.'));return;}
    box.append(node('h3','⚑ Atenção — controle interno sucessório'));
    box.append(node('p','Informação recebida para conferência. Verifique se a documentação está completa e contempla os interessados do alerta. Havendo ausência, dúvida ou inconsistência, procure o tabelião antes de protocolar ou gerar boleto. A correspondência de nome pode envolver homônimo.'));
    for(const m of r.correspondencias){
      const d=m.dados, item=node('article');item.className='sucessao-caso';
      item.append(node('h4',d.nome+' · '+m.tipo.replace(/_/g,' ')),node('p','Relato recebido: '+d.relato));
      if(d.interessados?.length)item.append(node('p','Interessados a conferir na documentação: '+d.interessados.join('; ')));
      const detalhes=node('details');detalhes.append(node('summary','Documentos apresentados e pontos de conferência'));
      for(const [titulo,lista] of [['Consta na documentação',d.documentado],['Conferir',d.pendencias]]){
        detalhes.append(node('strong',titulo));const ul=node('ul');for(const t of lista)ul.append(node('li',t));detalhes.append(ul);
      }
      detalhes.append(node('p','Orientação interna: '+d.orientacao));if(d.solucao_previa)detalhes.append(node('p','Solução jurídica prévia: '+d.solucao_previa));
      const doc=node('button','Consultar documentos apresentados');doc.type='button';doc.addEventListener('click',async()=>{
        doc.disabled=true;try{const docs=await api('/alertas/'+encodeURIComponent(m.id)+'/documentos');for(const a of docs){const b=node('button',a.nome);b.type='button';b.addEventListener('click',()=>baixar(a));detalhes.append(b);}if(!docs.length)detalhes.append(node('p','Nenhum documento anexado.'));}catch(e){detalhes.append(node('p',e.message));}finally{doc.disabled=false;}
      });detalhes.append(doc);item.append(detalhes);box.append(item);
    }
    box.append(node('p','Registre a conferência abaixo. Se houver pendência, finalize o formulário e clique em Protocolizar para encaminhar ao tabelião, sem reservar número.'));
  }
  async function baixar(a){
    try{const r=await fetch(cfg.endpoint+'/hub/controle-sucessorio/documentos/'+encodeURIComponent(a.id),{headers:{'X-Auth-Token':cfg.token}});if(!r.ok)throw new Error('Não foi possível abrir o documento.');const u=URL.createObjectURL(await r.blob()),link=node('a');link.href=u;link.download=a.nome;link.click();setTimeout(()=>URL.revokeObjectURL(u),60000);}catch(e){alert(e.message);}
  }
  async function consultar(){
    if(!abrangido())return;const seq=++consultaSeq;
    try{const r=await api('/consultar',{ato:cfg.getAto(),sucessao:dados()});if(seq===consultaSeq)mostrar(r);}catch(e){if(seq===consultaSeq)mensagem(e.message);}
  }
  function atualizar(){
    consultaSeq++;pendentePayload=null;revisao=null;resultado=null;el('sucessaoEncaminhar').hidden=true;
    el('blSucessao').classList.toggle('oculto',!abrangido());
    el('sucessaoModalidadeBox').hidden=cfg.getAto()==='CDH';
    const cumulativo=cfg.getAto()==='INV' && el('sucessaoModalidade').value==='cumulativo';
    el('sucessaoAutorBox').hidden=cumulativo;el('sucessaoAutoresBox').hidden=!cumulativo;el('sucessaoConferido').checked=false;
    if(abrangido()){mensagem('Informe todos os autores da herança. No cumulativo, use uma linha por falecido.');clearTimeout(timer);timer=setTimeout(consultar,450);}
  }
  async function verificar(payload){
    if(!abrangido())return true;
    try{
      const r=await api('/consultar',payload);mostrar(r);
      if(!r.correspondencias.length)return true;
      const lista=await api('/revisoes');const a=lista.find(a=>a.fingerprint===r.fingerprint && !a.protocolo);
      let vencida=false;
      if(a){revisao=await api('/revisoes/'+encodeURIComponent(a.id));vencida=['conferido','liberado','homonimo'].includes(revisao.estado)&&Date.now()-new Date(revisao.decidido_em).getTime()>7*86400000;if(['conferido','liberado','homonimo'].includes(revisao.estado)&&!vencida)return true;
        el('sucessaoResultado').append(node('p','Análise '+a.id+' · '+a.estado+(revisao.fundamento?' · '+revisao.fundamento:'')));
      }
      if((!a || vencida) && el('sucessaoConferido').checked){await api('/conferir',{payload,conferencia:{documentacao_completa:true,interessados_contemplados:true,sem_divergencia:true,referencias:el('sucessaoObservacao').value}});return true;}
      pendentePayload=JSON.parse(JSON.stringify(payload));el('sucessaoEncaminhar').hidden=!!a && !vencida;
      if(vencida)el('sucessaoResultado').append(node('p','A liberação venceu. Encaminhe novamente para análise do tabelião.'));
      if(a)el('sucessaoResultado').append(node('p','Aguarde a decisão. Após a liberação, clique novamente em Protocolizar com os mesmos dados.'));
      el('blSucessao').scrollIntoView({behavior:'smooth',block:'start'});return false;
    }catch(e){mensagem(e.message+' O pedido aguarda a consulta ao controle interno.');el('blSucessao').scrollIntoView({behavior:'smooth',block:'start'});return false;}
  }
  function iniciar(config){
    cfg=config;
    el('sucessaoPainel').addEventListener('click',()=>{
      const dialog=node('dialog'),fechar=node('button','Fechar e voltar ao formulário'),frame=node('iframe');
      dialog.style.cssText='width:95vw;max-width:1200px;height:90vh;border:1px solid #789;border-radius:10px';
      frame.src='controle-sucessorio.html';frame.title='Controle interno sucessório';frame.style.cssText='width:100%;height:82vh;border:0';
      fechar.type='button';fechar.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>dialog.remove());dialog.append(fechar,frame);document.body.append(dialog);dialog.showModal();
    });
    document.querySelector('main').addEventListener('input',e=>{if(!e.target.closest('#sucessaoConferencia')){pendentePayload=null;el('sucessaoEncaminhar').hidden=true;}});
    document.querySelectorAll('#chipsAto .chip').forEach(c=>c.addEventListener('click',atualizar));
    for(const id of ['sucessaoAutor','sucessaoAutores','sucessaoModalidade'])el(id).addEventListener('input',()=>{cfg.alterado();atualizar();});
    el('sucessaoConsultar').addEventListener('click',consultar);
    el('sucessaoEncaminhar').addEventListener('click',async()=>{
      if(!pendentePayload)return;
      const b=el('sucessaoEncaminhar');b.disabled=true;
      try{revisao=await api('/revisoes',{payload:pendentePayload,observacao:el('sucessaoObservacao').value});mensagem('Pedido salvo para análise do tabelião: '+revisao.id+'. Nenhum protocolo ou boleto foi gerado. Após a decisão, clique novamente em Protocolizar com os mesmos dados.');b.hidden=true;}
      catch(e){mensagem(e.message);}finally{b.disabled=false;}
    });
    atualizar();
  }
  return {iniciar,dados,verificar,atualizar};
})();

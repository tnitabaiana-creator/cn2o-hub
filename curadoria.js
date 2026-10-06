'use strict';
const ENDPOINT_CURADORIA='https://cn2o-hub-backend-production.up.railway.app';
const el=id=>document.getElementById(id);
const sessaoChave=k=>{try{return sessionStorage.getItem(k)||'';}catch(_){return '';}};
const TOKEN_CURADORIA=sessaoChave('cn2o_token');
const S={fonte:null,novaFonte:null,pagamentos:[],divergencias:[],fingerprint:null,enviando:false,bloqueio:false};
const formularioCuradoria=criarFormularioCuradoria({estado:S,obterElemento:el,atualizar:renderDossie});
const renderPagamentos=()=>formularioCuradoria.renderPagamentos();
const renderDivergencias=()=>formularioCuradoria.renderDivergencias();
function mensagem(texto){el('mensagem').textContent=texto;el('mensagem').classList.toggle('oculto',!texto);}
function lerCuradoria(){
  const estado=document.querySelector('[name="curadoriaEstado"]:checked')?.value||'';
  return {versao:1,estado,confirmado:el('curadoriaConfirmado').checked,observacao:el('curadoriaObservacao').value.trim(),
    divergencias:estado==='divergentes'?S.divergencias.map(d=>({fato:(d.fato||'').trim(),documento:(d.documento||'').trim(),descricao:(d.descricao||'').trim()})):[]};
}
function mostrarDados(fonte){
  el('protocoloTitulo').textContent='Protocolo '+fonte.protocolo.numero+' · '+fonte.protocolo.ato;
  el('fonteRevisao').textContent='Revisão '+fonte.revisao.sha256.slice(0,12)+' · autoria registrada: '+(fonte.revisao.autor||'não disponível')+' · '+(fonte.revisao.data?new Date(fonte.revisao.data).toLocaleString('pt-BR'):'data não disponível');
  const dados=fonte.dados||{},triagem=dados.triagem||{};
  el('precoOriginal').textContent=String(dados.preco||triagem.preco||'Não informado');
  el('pagamentoOriginal').textContent=Object.keys(triagem).filter(k=>/^pag_/.test(k)).map(k=>k+': '+String(triagem[k])).join('\n')||'Sem declaração estruturada de pagamento no protocolo.';
  el('dadosOriginais').textContent=JSON.stringify(dados,null,2);
  el('curadoriaPagamentos').classList.toggle('oculto',!CN2OCuradoria.atosPagamento.includes(fonte.protocolo.ato)&&!S.pagamentos.length);
}
function hidratarFonte(fonte){
  if(fonte?.schema_version!=='cn2o.eprotocolo.v1'||!fonte.protocolo?.numero||!/^([a-f0-9]{64})$/.test(fonte.revisao?.sha256||''))throw new Error('A resposta não contém uma fonte de protocolo reconhecida.');
  S.fonte=fonte;S.novaFonte=null;S.bloqueio=false;S.fingerprint=null;
  S.pagamentos=(fonte.dados.pagamentos||[]).map(p=>({...p,valor:(p.valor_centavos/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}));
  // O valor digitado governa a edição; nunca conservar centavos antigos por cima dele.
  S.pagamentos.forEach(p=>{delete p.valor_centavos;});
  const c=fonte.curadoria||{};S.divergencias=(c.divergencias||[]).map(d=>({...d}));
  document.querySelectorAll('[name="curadoriaEstado"]').forEach(r=>{r.checked=r.value===c.estado;});
  el('curadoriaObservacao').value=c.observacao||'';el('curadoriaConfirmado').checked=false;
  el('divergenciasBox').classList.toggle('oculto',c.estado!=='divergentes');
  el('comparacao').classList.add('oculto');el('consultarAtual').classList.add('oculto');
  el('edicao').classList.remove('oculto');
  renderPagamentos();renderDivergencias();mostrarDados(fonte);renderDossie();
}
function renderDossie(){
  if(!S.fonte)return {ok:false};
  const c=lerCuradoria(),fingerprint=JSON.stringify({curadoria:{...c,confirmado:undefined},pagamentos:S.pagamentos});
  if(S.fingerprint!==null&&fingerprint!==S.fingerprint){el('curadoriaConfirmado').checked=false;c.confirmado=false;}
  S.fingerprint=fingerprint;
  const resultado=CN2OCuradoria.avaliar({ato:S.fonte.protocolo.ato,triagem:{...S.fonte.dados.triagem,preco:S.fonte.dados.triagem?.preco||S.fonte.dados.preco},pagamentos:S.pagamentos,curadoria:c});
  const lista=el('curadoriaAlertas');lista.replaceChildren();resultado.alertas.forEach(t=>{const p=document.createElement('p');p.className='aviso';p.textContent=t;lista.appendChild(p);});
  const erros=el('curadoriaErros');erros.replaceChildren();erros.classList.toggle('oculto',resultado.ok);
  if(resultado.erros.length){const ul=document.createElement('ul');resultado.erros.forEach(t=>{const li=document.createElement('li');li.textContent=t;ul.appendChild(li);});erros.appendChild(ul);}
  el('pagamentosResumo').textContent=resultado.soma_centavos===null?'Sem soma de parcelas informada.':'Soma das parcelas: '+(resultado.soma_centavos/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+'. Não equivale a quitação.';
  el('salvarCuradoria').disabled=!resultado.ok||S.enviando||S.bloqueio;
  el('blCuradoria').querySelectorAll('input,select,textarea,button').forEach(campo=>{campo.disabled=S.enviando;});
  el('carregarFonte').disabled=S.enviando;el('numeroProtocolo').disabled=S.enviando;
  return resultado;
}
/* CURADORIA_API_INICIO — testes usam a mesma função com rede simulada */
async function requisicaoFonte(caminho,corpo){
  const r=await fetch(ENDPOINT_CURADORIA+caminho,{method:corpo===undefined?'GET':'POST',headers:{'X-Auth-Token':TOKEN_CURADORIA,...(corpo===undefined?{}:{'Content-Type':'application/json'})},...(corpo===undefined?{}:{body:JSON.stringify(corpo)})});
  let j={};try{j=await r.json();}catch(_){}
  if(!r.ok){const e=new Error(j.erro||(r.status===401?'Sua sessão expirou. Entre novamente pelo Hub.':'Não foi possível concluir a solicitação.'));e.status=r.status;e.motivo=j.motivo;throw e;}
  return j;
}
function textoSincronizacao(s){
  if(s?.estado==='sincronizado')return 'Conferência salva no Hub e sincronizada no Trello.';
  if(s?.estado==='sem_cartao')return 'Conferência salva no Hub. Este protocolo ainda não possui cartão vinculado.';
  if(s?.estado==='versao_superada')return 'Conferência salva, mas uma revisão posterior já existe. Consulte a versão atual antes de continuar.';
  return 'Conferência salva no Hub. A sincronização com o Trello permanece pendente; a cópia externa ainda não está confirmada.';
}
function corpoRevisao(){return {expected_sha256:S.fonte.revisao.sha256,curadoria:lerCuradoria(),pagamentos:CN2OCuradoria.normalizarPagamentos(S.pagamentos)};}
function resumoComparacao(fonte){
  const rotulos={compativeis:'Conferidos, sem divergência identificada',sem_comprovante:'Pagamento declarado sem comprovante',nao_conferidos:'Conferência pendente ou parcial',divergentes:'Divergência identificada',triagem:'Triagem',preco:'Preço / valor declarado',pag_ant_forma:'Forma do pagamento anterior',pag_ato_forma:'Forma do pagamento no ato',pag_m_antes_forma:'Forma da parte já paga',pag_m_ato_forma:'Forma da parte prevista',pag_momento:'Momento do pagamento',pag_ant_data:'Data do pagamento anterior',pag_m_antes_data:'Data da parte já paga',pag_local:'Local do pagamento',pagamentos:'Parcelas',valor_centavos:'Valor',forma:'Forma',forma_detalhe:'Detalhe da forma',status:'Situação',data:'Data',pagador:'Pagador',beneficiario:'Beneficiário',comprovante_referencia:'Comprovante',parte_envolvida:'Parte envolvida',apresentante:'Apresentante',assinatura_enotariado:'Assinatura pelo e-Notariado',dossie:'Dossiê',recebidos:'Recebidos',pendentes:'Pendentes',observacoes_nao_documentadas:'Observações não documentadas'};
  const c=fonte.curadoria||{},linhas=['Protocolo '+fonte.protocolo.numero+' · '+fonte.protocolo.ato,'Revisão '+fonte.revisao.sha256.slice(0,12),'Autoria: '+(fonte.revisao.autor||'não registrada'),'Data: '+(fonte.revisao.data?new Date(fonte.revisao.data).toLocaleString('pt-BR'):'não registrada'),'','CONFERÊNCIA',rotulos[c.estado]||'Não informada','Observações: '+(c.observacao||'nenhuma')];
  (c.divergencias||[]).forEach((d,i)=>linhas.push('Divergência '+(i+1)+': '+d.fato,'Documento: '+d.documento,'Descrição: '+d.descricao));
  linhas.push('','LANÇAMENTOS DO PROTOCOLO');
  function percorrer(valor,caminho=[],chave=''){
    if(valor&&typeof valor==='object'&&Object.keys(valor).length){Object.entries(valor).forEach(([k,v])=>percorrer(v,[...caminho,Array.isArray(valor)?String(Number(k)+1):(rotulos[k]||k.replace(/_/g,' '))],k));return;}
    const exibido=chave==='valor_centavos'&&Number.isSafeInteger(valor)?(valor/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):typeof valor==='boolean'?(valor?'Sim':'Não'):valor===null||valor===''?'Não informado':Array.isArray(valor)?'Nenhum':String(valor);
    linhas.push(caminho.join(' › ')+': '+exibido);
  }
  percorrer(fonte.dados);return linhas.join('\n');
}
/* CURADORIA_API_FIM */
async function carregar(){
  if(S.enviando)return;
  const n=el('numeroProtocolo').value.trim();
  if(!/^[1-9]\d{0,9}$/.test(n)){mensagem('Informe o número inteiro do protocolo.');return;}
  // Preserva o rascunho na tela em caso de falha; só troca após fonte recebida e válida.
  S.enviando=true;el('carregarFonte').disabled=true;mensagem('Carregando a fonte do protocolo…');
  try{const j=await requisicaoFonte('/hub/protocolos/'+n+'/fonte');hidratarFonte(j.fonte);mensagem('Versão carregada. Revise a conferência e confirme novamente para salvar.');el('sincronizarFonte').classList.add('oculto');}
  catch(e){mensagem(e.message);}
  finally{S.enviando=false;el('carregarFonte').disabled=false;renderDossie();}
}
async function salvar(){
  if(S.enviando||S.bloqueio||!renderDossie().ok)return;
  const corpo=corpoRevisao();S.enviando=true;renderDossie();mensagem('Salvando a conferência…');
  try{
    const j=await requisicaoFonte('/hub/protocolos/'+S.fonte.protocolo.numero+'/curadoria',corpo);
    hidratarFonte(j.fonte);mensagem(textoSincronizacao(j.sincronizacao));
    el('sincronizarFonte').classList.toggle('oculto',j.sincronizacao?.estado!=='pendente');
    if(j.sincronizacao?.estado==='versao_superada'){S.bloqueio=true;el('consultarAtual').classList.remove('oculto');}
  }catch(e){
    if(e.status===409||!e.status||e.status>=500){
      S.bloqueio=true;el('curadoriaConfirmado').checked=false;el('consultarAtual').classList.remove('oculto');
      mensagem(e.status===409?'A fonte mudou desde sua leitura. Sua edição foi mantida. Consulte e compare a versão atual antes de confirmar novamente.':'Não foi possível confirmar a gravação. Sua edição foi mantida, e o servidor pode já ter salvo a revisão. Consulte a versão atual antes de reenviar.');
    }else mensagem(e.message);
  }finally{S.enviando=false;renderDossie();}
}
async function consultarAtual(){
  if(S.enviando||!S.fonte)return;S.enviando=true;el('consultarAtual').disabled=true;
  try{
    const j=await requisicaoFonte('/hub/protocolos/'+S.fonte.protocolo.numero+'/fonte');S.novaFonte=j.fonte;
    el('comparacaoAnterior').textContent=resumoComparacao(S.fonte);
    el('comparacaoAtual').textContent=resumoComparacao(j.fonte);
    el('comparacao').classList.remove('oculto');mensagem('Compare as duas versões. Os campos que você estava editando permanecem abaixo. A adoção da nova versão exige nova confirmação.');
  }catch(e){mensagem(e.message);}finally{S.enviando=false;el('consultarAtual').disabled=false;renderDossie();}
}
function adotarVersao(){
  if(!S.novaFonte||S.enviando)return;
  S.fonte=S.novaFonte;S.novaFonte=null;S.bloqueio=false;S.fingerprint=null;
  el('curadoriaConfirmado').checked=false;el('comparacao').classList.add('oculto');el('consultarAtual').classList.add('oculto');
  mostrarDados(S.fonte);renderDossie();mensagem('Nova versão adotada, mantendo sua edição. Revise os campos e confirme a conferência antes de salvar.');
}
async function sincronizar(){
  if(S.enviando||!S.fonte||S.bloqueio)return;S.enviando=true;el('sincronizarFonte').disabled=true;
  try{const j=await requisicaoFonte('/hub/protocolos/'+S.fonte.protocolo.numero+'/sincronizar-fonte',{expected_sha256:S.fonte.revisao.sha256});mensagem(textoSincronizacao(j.sincronizacao));el('sincronizarFonte').classList.toggle('oculto',j.sincronizacao?.estado!=='pendente');}
  catch(e){mensagem(e.message);if(e.status===409){S.bloqueio=true;el('consultarAtual').classList.remove('oculto');}}
  finally{S.enviando=false;el('sincronizarFonte').disabled=false;renderDossie();}
}
document.querySelectorAll('[name="curadoriaEstado"]').forEach(r=>r.addEventListener('change',()=>{const divergente=r.checked&&r.value==='divergentes';el('divergenciasBox').classList.toggle('oculto',!divergente);if(divergente&&!S.divergencias.length){S.divergencias.push({});renderDivergencias();}renderDossie();}));
el('adicionarPagamento').addEventListener('click',()=>{S.pagamentos.push({});renderPagamentos();renderDossie();});
el('adicionarDivergencia').addEventListener('click',()=>{S.divergencias.push({});renderDivergencias();renderDossie();});
el('curadoriaObservacao').addEventListener('input',renderDossie);el('curadoriaConfirmado').addEventListener('change',renderDossie);
el('carregarFonte').addEventListener('click',carregar);el('salvarCuradoria').addEventListener('click',salvar);
el('consultarAtual').addEventListener('click',consultarAtual);el('adotarVersao').addEventListener('click',adotarVersao);el('sincronizarFonte').addEventListener('click',sincronizar);
el('sessaoInfo').textContent=sessaoChave('cn2o_nome')?'Sessão: '+sessaoChave('cn2o_nome'):'Entre pelo Hub para consultar e revisar protocolos.';
if(!TOKEN_CURADORIA&&ENDPOINT_CURADORIA){el('carregarFonte').disabled=true;mensagem('Sessão não disponível. Abra esta página pelo e-Protocolo após entrar no Hub.');}
else {const inicial=new URLSearchParams(location.search).get('protocolo');if(inicial){el('numeroProtocolo').value=inicial;carregar();}}

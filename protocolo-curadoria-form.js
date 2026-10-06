/* Formulário comum da criação e da revisão. Não lê documentos nem chama APIs. */
function criarFormularioCuradoria({estado,obterElemento,atualizar}){
const S=estado,el=obterElemento,renderDossie=atualizar;
function campoCuradoria(rotulo,tipo,valor,aoAlterar,opcoes){
  const label=document.createElement('label'); label.textContent=rotulo;
  const campo=document.createElement(tipo==='select'?'select':tipo==='textarea'?'textarea':'input');
  if(tipo==='select') (opcoes||[]).forEach(([value,text])=>{const op=document.createElement('option');op.value=value;op.textContent=text;campo.appendChild(op);});
  else if(tipo==='textarea'){campo.rows=2;campo.maxLength=1500;}
  else {campo.type=tipo;campo.maxLength=rotulo.startsWith('Fato')?400:rotulo.startsWith('Referência')?500:300;if(rotulo.startsWith('Valor'))campo.inputMode='decimal';}
  campo.value=valor||''; campo.addEventListener(tipo==='select'||tipo==='date'?'change':'input',()=>{aoAlterar(campo.value);renderDossie();});
  label.appendChild(campo); return label;
}
function renderPagamentos(){
  const box=el('pagamentosLista');box.replaceChildren();
  S.pagamentos.forEach((p,i)=>{
    const item=document.createElement('div');item.className='curadoria-item';
    const titulo=document.createElement('h3');titulo.textContent='Parcela '+(i+1);item.appendChild(titulo);
    const grid=document.createElement('div');grid.className='grade';
    const add=(key,label,type,options)=>grid.appendChild(campoCuradoria(label,type,p[key],v=>{p[key]=v;},options));
    add('valor','Valor da parcela (R$)','text');
    add('forma','Forma de pagamento','select',[['','Selecione'],['especie','Dinheiro em espécie'],['pix','PIX'],['transferencia','Transferência bancária'],['deposito','Depósito bancário'],['cheque','Cheque'],['outro','Outra forma (descrever)']]);
    add('status','Situação do pagamento','select',[['','Selecione'],['realizado','Declarado como realizado'],['previsto','Previsto / ainda não realizado']]);
    add('data','Data informada (se conhecida)','date');
    add('pagador','Pagador (se identificado)','text');add('beneficiario','Beneficiário (se identificado)','text');
    add('comprovante_referencia','Referência do comprovante (arquivo/página)','text');add('forma_detalhe','Detalhe da outra forma de pagamento','text');
    item.appendChild(grid);
    const remover=document.createElement('button');remover.type='button';remover.className='curadoria-btn';remover.textContent='Remover parcela '+(i+1);
    remover.addEventListener('click',()=>{S.pagamentos.splice(i,1);renderPagamentos();renderDossie();});item.appendChild(remover);box.appendChild(item);
  });
}
function renderDivergencias(){
  const box=el('divergenciasLista');box.replaceChildren();
  S.divergencias.forEach((d,i)=>{
    const item=document.createElement('div');item.className='curadoria-item';
    const titulo=document.createElement('h3');titulo.textContent='Divergência '+(i+1);item.appendChild(titulo);
    const grid=document.createElement('div');grid.className='grade';
    grid.appendChild(campoCuradoria('Fato ou campo em conflito','text',d.fato,v=>{d.fato=v;}));
    grid.appendChild(campoCuradoria('Documento ou fonte (arquivo/página/data)','text',d.documento,v=>{d.documento=v;}));item.appendChild(grid);
    item.appendChild(campoCuradoria('O que diverge e a qual fato/negócio o documento se refere','textarea',d.descricao,v=>{d.descricao=v;}));
    const remover=document.createElement('button');remover.type='button';remover.className='curadoria-btn';remover.style.marginTop='10px';remover.textContent='Remover divergência '+(i+1);
    remover.addEventListener('click',()=>{S.divergencias.splice(i,1);renderDivergencias();renderDossie();});item.appendChild(remover);box.appendChild(item);
  });
}
return {renderPagamentos,renderDivergencias};
}

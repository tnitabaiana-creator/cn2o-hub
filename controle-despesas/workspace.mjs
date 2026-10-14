export function resolveWorkspace(search='') {
  const id=new URLSearchParams(search).get('workspace')||'cn2o';
  if(!['cn2o','bravo'].includes(id))throw new Error('Controle de despesas inválido. Abra o controle pelo Hub.');
  return Object.freeze(id==='bravo'
    ? {id,name:'Bravo Patrimonial',route:'despesas-bravo',api:'/hub/despesas-bravo/',filePrefix:'bravo-despesas',database:'arquivo-bravo-prototipo-v1'}
    : {id,name:'Cartório CN2O',route:'despesas',api:'/hub/despesas/',filePrefix:'cn2o-despesas',database:'arquivo-cartorio-prototipo-v1'});
}
export const WORKSPACE=resolveWorkspace(globalThis.location?.search||'');
export function applyWorkspace(document) {
  document.documentElement.dataset.workspace=WORKSPACE.id;
  const banner=document.createElement('p');banner.className='storage-notice';banner.id='workspace-identity';
  banner.textContent=WORKSPACE.id==='bravo'
    ? 'Bravo Patrimonial · CNPJ 62.564.260/0001-47 · Acervo e contabilidade separados do cartório.'
    : 'Cartório CN2O · Despesas da Bravo devem ser destinadas ao controle próprio.';
  document.querySelector('h1').insertAdjacentElement('afterend',banner);
  const link=document.createElement('a');link.href='../#'+(WORKSPACE.id==='bravo'?'despesas':'despesas-bravo');link.target='_top';
  link.textContent=WORKSPACE.id==='bravo'?'Abrir despesas do cartório':'Abrir despesas da Bravo';
  banner.append(' ',link);
  if(WORKSPACE.id!=='bravo')return;
  document.title='Controle de Despesas · Bravo Patrimonial';
  const replacements=new Map([
    ['Assistente do cartório','Assistente da Bravo'],['Cartório','Bravo Patrimonial'],
    ['Controle de Despesas','Controle de Despesas da Bravo'],
    ['CN2O · Controle de Despesas','Bravo Patrimonial · Controle de Despesas'],
    ['Descrição e finalidade no cartório','Descrição e finalidade na Bravo'],
    ['Energia do cartório','Energia da empresa'],['Aluguel do imóvel do cartório','Aluguel do imóvel da empresa'],
    ['Dedutível no Livro Caixa','Dedutível na contabilidade da Bravo'],['Não dedutível no Livro Caixa','Não dedutível na contabilidade da Bravo'],
    ['Tratamento fiscal proposto','Tratamento contábil proposto'],
    ['Classificação fiscal revisada por pessoa responsável','Classificação contábil revisada por pessoa responsável'],
    ['Valor elegível, antes do limite mensal','Valor conferido pela contabilidade'],
    ['Não há lançamento automático no Carnê-Leão.','A escrituração da Bravo depende da validação da contabilidade.']
  ]);
  const walker=document.createTreeWalker(document.body,4);let n;
  while((n=walker.nextNode())){
    if(n.parentElement.closest('script,style,#workspace-identity'))continue;
    const text=n.nodeValue.trim();if(replacements.has(text))n.nodeValue=n.nodeValue.replace(text,replacements.get(text));
  }
  const access=document.querySelector('#access-dialog a');if(access)access.href='../#despesas-bravo';
}

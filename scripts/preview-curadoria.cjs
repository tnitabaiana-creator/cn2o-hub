// Prévia descartável: serve apenas HTML local, sem autenticação, API ou documentos reais.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const src=path.join(__dirname,'../protocolo.html');
const fixtures=`
<style>.previa-curadoria{position:sticky;top:0;z-index:45;background:#202a3a;color:white;padding:12px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.previa-curadoria button{font:inherit;border:0;border-radius:5px;padding:7px 10px;cursor:pointer}</style>
<div class="previa-curadoria"><b>SIMULAÇÃO LOCAL · dados fictícios · sem envio</b><button id="fixtureEspecie">Exemplo: espécie</button><button id="fixtureDivergencia">Exemplo: divergência</button><button id="fixtureInventario">Exemplo: inventário pendente</button></div>`;
const app=`<script>
function exemploCuradoria(tipo){
  const ato=tipo==='inventario'?'INV':'CV-Urbano';
  document.querySelector('[data-ato="'+ato+'"]').click();
  document.getElementById('veuCheck').classList.remove('aberto');
  document.getElementById('apresNome').value='Pessoa de teste';document.getElementById('apresTel').value='00000000000';document.getElementById('parteNome').value='Interessado fictício';
  S.enot={t:'Não',a:'Não'};S.respostas={preco:'R$ 1.000,00',t_tipo:'Pessoa física',a_tipo:'Pessoa física',pag_momento:'Já pago integralmente (data anterior)',pag_ant_forma:'Dinheiro em espécie (moeda manual)'};
  if(tipo==='inventario')S.respostas={};
  S.pagamentos=tipo==='inventario'?[]:[{valor:'1.000,00',forma:'especie',status:'realizado',data:'2026-10-01',pagador:'Pessoa sintética A',beneficiario:'Pessoa sintética B',comprovante_referencia:''}];
  if(tipo==='divergencia'){S.divergencias=[{fato:'Forma de pagamento da parcela única',documento:'Comprovante fictício de PIX, página 1',descricao:'Declaração de espécie contrasta com PIX de mesmo valor, partes e negócio. Identificação documental ainda requer conferência humana.'}];document.querySelector('[name="curadoriaEstado"][value="divergentes"]').checked=true;document.getElementById('divergenciasBox').classList.remove('oculto');}
  renderPerguntas();renderEnot();renderPagamentos();renderDivergencias();renderDossie();document.getElementById('blCuradoria').scrollIntoView();
}
document.getElementById('fixtureEspecie').onclick=()=>exemploCuradoria('especie');
document.getElementById('fixtureDivergencia').onclick=()=>exemploCuradoria('divergencia');
document.getElementById('fixtureInventario').onclick=()=>exemploCuradoria('inventario');
</script>`;
const fixturePath=path.join(__dirname,'../../cn2o-hub-backend/test/fixtures/protocolo-fonte-v1.json');
let fonteMock=JSON.parse(fs.readFileSync(fixturePath,'utf8')).fonte;
let syncPendente=false,perderResposta=false;
const revisaoMock=()=>{fonteMock.revisao.sha256=crypto.createHash('sha256').update(JSON.stringify(fonteMock)+Date.now()).digest('hex');fonteMock.revisao.autor='teste.local';fonteMock.revisao.data=new Date().toISOString();};
http.createServer(async(req,res)=>{
  const caminho=new URL(req.url,'http://127.0.0.1').pathname;
  const json=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
  if(req.method==='POST'&&caminho.startsWith('/_fixture/')){
    if(caminho.endsWith('/concorrencia')){fonteMock.curadoria.observacao='Revisão concorrente fictícia';revisaoMock();}
    if(caminho.endsWith('/pendente'))syncPendente=true;
    if(caminho.endsWith('/resposta-perdida'))perderResposta=true;
    return json(200,{simulacao:true});
  }
  if(caminho==='/api/hub/protocolos/999001/fonte'&&req.method==='GET')return json(200,{fonte:fonteMock});
  if(caminho.startsWith('/api/hub/protocolos/999001/')&&req.method==='POST'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const corpo=JSON.parse(Buffer.concat(chunks).toString());
    if(corpo.expected_sha256!==fonteMock.revisao.sha256)return json(409,{erro:'Fonte alterada na simulação.',motivo:'FONTE_DESATUALIZADA'});
    if(caminho.endsWith('/curadoria')){fonteMock.curadoria={...corpo.curadoria,autor:'teste.local',data:new Date().toISOString()};fonteMock.dados.pagamentos=corpo.pagamentos;revisaoMock();}
    if(perderResposta){perderResposta=false;return json(502,{erro:'Resposta perdida após gravação simulada.'});}
    return json(200,{fonte:fonteMock,sincronizacao:{estado:syncPendente?'pendente':'sincronizado'}});
  }
  if(req.method!=='GET'){res.writeHead(404);return res.end('Local preview only');}
  if(['/protocolo-curadoria.js','/protocolo-curadoria-form.js','/curadoria.js'].includes(caminho)){
    let js=fs.readFileSync(path.join(__dirname,'..',caminho.slice(1)),'utf8');
    if(caminho==='/curadoria.js')js=js.replace("const ENDPOINT_CURADORIA='https://cn2o-hub-backend-production.up.railway.app';","const ENDPOINT_CURADORIA='/api';").replace("const TOKEN_CURADORIA=sessaoChave('cn2o_token');","const TOKEN_CURADORIA='teste-local-sem-acesso-externo';");
    res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(js);
  }
  if(caminho==='/curadoria.html'){
    const controles='<div class="previa-curadoria"><b>SIMULAÇÃO LOCAL · protocolo 999001 · sem envio externo</b><button onclick="fetch(\'/\x5ffixture/concorrencia\',{method:\'POST\'})">Simular revisão concorrente</button><button onclick="fetch(\'/\x5ffixture/pendente\',{method:\'POST\'})">Simular Trello pendente</button><button onclick="fetch(\'/\x5ffixture/resposta-perdida\',{method:\'POST\'})">Simular resposta perdida</button></div>';
    let html=fs.readFileSync(path.join(__dirname,'../curadoria.html'),'utf8').replace('<body>','<body>'+fixtures.split('<div class="previa-curadoria">')[0]+controles);
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'none'; form-action 'none'; frame-src 'none'"});return res.end(html);
  }
  if(!['/','/protocolo.html'].includes(caminho)){res.writeHead(404);return res.end('Local preview only');}
  let html=fs.readFileSync(src,'utf8').replace("const ENDPOINT_RAILWAY='https://cn2o-hub-backend-production.up.railway.app';","const ENDPOINT_RAILWAY='';");
  html=html.replace('<body>','<body>'+fixtures).replace('</body>',app+'</body>');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'none'; img-src 'self' data:; form-action 'none'; frame-src 'none'"});res.end(html);
}).listen(8767,'127.0.0.1',()=>console.log('Prévia sintética: http://127.0.0.1:8767 (somente conexões locais; sem produção)'));

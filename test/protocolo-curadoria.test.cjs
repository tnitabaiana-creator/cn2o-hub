const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../protocolo.html'),'utf8');
const regras=fs.readFileSync(path.join(__dirname,'../protocolo-curadoria.js'),'utf8');
const contexto=vm.createContext({});vm.runInContext(regras+'\nthis.api=CN2OCuradoria;',contexto);
const api=contexto.api;
const conferencia=(estado='compativeis')=>({versao:1,estado,confirmado:true,observacao:'',divergencias:[]});
const parcela=(extra={})=>({valor:'1.000,00',forma:'pix',status:'realizado',data:'2026-10-01',pagador:'Pessoa sintética A',beneficiario:'Pessoa sintética B',comprovante_referencia:'comprovante fictício, página 1',...extra});
const avaliar=(extra={})=>api.avaliar({ato:'CV-Urbano',triagem:{preco:'R$ 1.000,00'},pagamentos:[parcela()],curadoria:conferencia(),...extra});

test('Todos os scripts de produção têm sintaxe válida',()=>{for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);});
test('Valor em reais preserva centavos sem arredondamento nem truncamento silencioso',()=>{
  assert.equal(api.centavos('R$ 1.000,05'),100005);assert.equal(api.centavos('10,1'),1010);assert.equal(api.centavos('1000'),100000);
  for(const bad of ['', '0','-1','10,123','1.2.3','dez',Number.MAX_SAFE_INTEGER+1])assert.equal(api.centavos(bad),null);
});
test('Nenhum estado ou confirmação é marcado no HTML',()=>{
  const elementos=html.match(/<input[^>]+(?:name="curadoriaEstado"|id="curadoriaConfirmado")[^>]*>/g);
  assert.equal(elementos.length,5);assert.ok(elementos.every(t=>!/\bchecked\b/.test(t)));
});
test('A ausência de estado e confirmação bloqueia o cadastro',()=>{const r=avaliar({curadoria:{}});assert.equal(r.ok,false);assert.equal(r.erros.length,2);});
test('Conferência expressamente pendente permite protocolar sem fingir verificação',()=>{
  assert.equal(avaliar({pagamentos:[],curadoria:conferencia('nao_conferidos')}).ok,true);
});
test('Espécie sem comprovante permite protocolo e exibe advertência sobre o mesmo pagamento',()=>{
  const r=avaliar({pagamentos:[parcela({forma:'especie',comprovante_referencia:''})],curadoria:conferencia('sem_comprovante')});
  assert.equal(r.ok,true);assert.ok(r.alertas.some(t=>t.includes('mesmo pagamento')));
});
test('Declaração sem comprovante não equivale a quitação ou comprovante inferido',()=>{
  const r=avaliar({pagamentos:[parcela({comprovante_referencia:''})],curadoria:conferencia('sem_comprovante')});
  assert.equal(r.ok,true);assert.ok(r.alertas.some(t=>t.includes('não demonstra sua realização')));
});
test('Divergência exige registro de fato documento e explicação',()=>{
  assert.equal(avaliar({curadoria:conferencia('divergentes')}).ok,false);
  assert.equal(avaliar({curadoria:{...conferencia('divergentes'),divergencias:[{fato:'Pagamento',documento:'comprovante sintético',descricao:''}]}}).ok,false);
  assert.equal(avaliar({curadoria:{...conferencia('divergentes'),divergencias:[{fato:'Pagamento',documento:'comprovante sintético',descricao:'Declaração em espécie e comprovante de PIX relativos à parcela 1.'}]}}).ok,true);
});
test('Toda divergência adicional deve estar completa',()=>{assert.equal(avaliar({curadoria:{...conferencia('divergentes'),divergencias:[{fato:'Preço',documento:'Contrato',descricao:'Diferença declarada'},{}]}}).ok,false);});
test('Parcela incompleta não é aceita silenciosamente',()=>{assert.equal(avaliar({pagamentos:[{}]}).ok,false);});
test('Datas e pessoas ausentes ficam advertidas, sem presunção de identidade',()=>{
  const r=avaliar({pagamentos:[parcela({data:'',pagador:'',beneficiario:''})],curadoria:conferencia('nao_conferidos')});assert.equal(r.ok,true);assert.ok(r.alertas.some(t=>t.includes('não serão presumidos')));
});
test('Data inexistente no calendário é rejeitada',()=>{assert.equal(avaliar({pagamentos:[parcela({data:'2026-02-30'})]}).ok,false);});
test('PIX depósito e transferência são formas distintas no payload',()=>{
  const linhas=api.normalizarPagamentos(['pix','deposito','transferencia'].map(forma=>parcela({forma})));
  assert.deepEqual(Array.from(linhas,p=>p.forma),['pix','deposito','transferencia']);assert.ok(linhas.every(p=>p.valor_centavos===100000));
});
test('Outra forma exige descrição',()=>{
  assert.equal(avaliar({pagamentos:[parcela({forma:'outro'})]}).ok,false);
  assert.equal(avaliar({pagamentos:[parcela({forma:'outro',forma_detalhe:'Financiamento declarado'})]}).ok,true);
});
test('Soma usa centavos e distingue preço de parcelas',()=>{
  const r=avaliar({triagem:{preco:'0,30'},pagamentos:[parcela({valor:'0,10'}),parcela({valor:'0,20'})]});assert.equal(r.ok,true);assert.equal(r.soma_centavos,30);
});
test('Soma divergente não admite declaração de compatibilidade ou mera falta de recibo',()=>{
  for(const estado of ['compativeis','sem_comprovante'])assert.equal(avaliar({triagem:{preco:'2.000,00'},curadoria:conferencia(estado)}).ok,false);
  assert.equal(avaliar({triagem:{preco:'2.000,00'},curadoria:conferencia('nao_conferidos')}).ok,true);
});
test('Espécie no legado e PIX na mesma fase não passam como compatíveis',()=>{
  const triagem={preco:'1.000,00',pag_momento:'Já pago integralmente (data anterior)',pag_ant_forma:'Dinheiro em espécie (moeda manual)'};
  assert.equal(avaliar({triagem}).ok,false);assert.equal(avaliar({triagem,curadoria:conferencia('nao_conferidos')}).ok,true);
});
test('Pagamento misto em fases diferentes não cria falso conflito de espécie e banco',()=>{
  const triagem={preco:'1.000,00',pag_momento:'Misto — parte já paga, parte no ato',pag_m_antes_forma:'Dinheiro em espécie (moeda manual)',pag_m_ato_forma:'Transferência / PIX'};
  const pagamentos=[parcela({valor:'500,00',forma:'especie'}),parcela({valor:'500,00',forma:'pix',status:'previsto'})];assert.equal(avaliar({triagem,pagamentos}).ok,true);
});
test('Previsto versus totalmente realizado exige pendência de conciliação',()=>{
  assert.equal(avaliar({triagem:{preco:'1.000,00',pag_momento:'Já pago integralmente (data anterior)',pag_ant_forma:'Transferência / depósito / PIX'},pagamentos:[parcela({status:'previsto'})]}).ok,false);
});
test('Inventário doação testamento certidão também passam pela curadoria geral, sem preço presumido',()=>{
  for(const ato of ['INV','DOA','TEST','CERT','PER','DIV','DUE','UE','RERRAT','ATA-U','ATA-W/A']){
    assert.equal(avaliar({ato,triagem:{preco:'999.000,00'},pagamentos:[],curadoria:conferencia('nao_conferidos')}).ok,true);
    assert.equal(avaliar({ato,pagamentos:[],curadoria:{}}).ok,false);
  }
});
test('Payload preserva triagem original e não recebe autoria manipulável da curadoria',()=>{
  assert.match(html,/triagem:S\.respostas,\s*curadoria: lerCuradoria\(\),\s*pagamentos: CN2OCuradoria\.normalizarPagamentos\(S\.pagamentos\)/);
  const ler=html.split('function lerCuradoria(){')[1].split('const formularioCuradoria')[0];assert.doesNotMatch(ler,/autor|escrevente|Date\(/);
});
test('Confirmação se invalida por dados alterados, inclui documentos e evita base64 no fingerprint',()=>{
  const codigo=html.split('function atualizarCuradoria(){')[1].split("document.querySelectorAll('[name=\"curadoriaEstado\"]')")[0];
  assert.match(codigo,/fingerprint!==S\.curadoriaFingerprint/);assert.match(codigo,/el\('curadoriaConfirmado'\)\.checked=false/);assert.match(codigo,/dossie:S\.dossie/);assert.doesNotMatch(codigo,/base64/);
});
test('Curadoria geral é reiniciada na troca de ato',()=>{assert.match(html,/S\.ato=c\.dataset\.ato; S\.respostas=\{\}; S\.dossie=\{\};\s*resetCuradoria\(\)/);});
test('Protocolizar revalida antes de qualquer upload ou envio',()=>{
  const handler=html.split("el('btnProt').addEventListener('click',async ()=>{")[1];assert.ok(handler.indexOf('if(!conferencia.ok || S.enviando)')<handler.indexOf('fetch('));
});
test('Falha não promete inexistência de registro já persistido',()=>{assert.doesNotMatch(html,/Nada foi criado\. Tente novamente/);assert.match(html,/pedido pode ter sido registrado antes da falha/);});

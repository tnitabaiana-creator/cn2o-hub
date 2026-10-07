// v1.47 — Protocolizar sempre clicável: o clique mostra o que falta (CV-Urbano, CV-Rural e demais atos).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../protocolo.html'), 'utf8').replace(/\r\n/g, '\n');

test('o botão nasce clicável e só trava durante o envio', () => {
  assert.match(html, /<button class="btn-prot" id="btnProt">Protocolizar<\/button>/);
  assert.match(html, /el\('btnProt'\)\.disabled = !!S\.enviando;/);
  assert.doesNotMatch(html, /el\('btnProt'\)\.disabled=!\(/);   // a regra antiga que deixava o botão cinza sem explicar
});

test('o clique confere as pendências antes de qualquer envio', () => {
  const h = html.split("el('btnProt').addEventListener('click',async ()=>{")[1];
  assert.ok(h.indexOf('pendenciasProtocolo()') < h.indexOf('fetch('));
  assert.ok(h.indexOf('mostrarPendencias(falta); return;') < h.indexOf('fetch('));
});

// executa a função real com um formulário simulado
const fonte = html.slice(html.indexOf('function pendenciasProtocolo('), html.indexOf('function irParaPendencia('));
function rodar({ ato = 'CV-Urbano', campos = {}, respostas = {}, enot = {}, curadoria = { ok: true, erros: [] }, desfeita = false } = {}) {
  const ident = [
    { id: 't_tipo', ident: 't', titulo: 'Vendedor(es) — pessoa física, jurídica ou múltiplos?' },
    { id: 'a_tipo', ident: 'a', titulo: 'Comprador(es) — pessoa física, jurídica ou múltiplos?' },
    { id: 'preco', tipo: 'moeda', obrigatorio: true, titulo: 'Preço ajustado (valor declarado pelas partes)' }
  ];
  const ctx = vm.createContext({
    S: { ato, qual: {}, qtest: {}, respostas, enot, extras: {}, curadoriaDesfeita: desfeita },
    el: id => ({ value: campos[id] || '' }),
    PAPEIS: { 'CV-Urbano': { t: 'Vendedor(es)', a: 'Comprador(es)', parte: 'Comprador(a)' }, 'CV-Rural': { t: 'Vendedor(es)', a: 'Comprador(es)', parte: 'Comprador(a)' } },
    IDENT_T: ['CV-Urbano', 'CV-Rural'], IDENT_A: ['CV-Urbano', 'CV-Rural'],
    perguntasDoAto: () => ident, visivel: () => true,
    papeisEnot: () => ({ t: 'Vendedor(es)', a: 'Comprador(es)' }),
    formatarMoeda: v => (/\d/.test(v) ? v : null), certFiliacaoOk: () => true,
    atualizarCuradoria: () => curadoria
  });
  vm.runInContext(fonte + '\nthis.r = pendenciasProtocolo();', ctx);
  return ctx.r;
}
const completo = { campos: { apresNome: 'MARIA', apresTel: '79999990000', parteNome: 'JOAO' }, respostas: { t_tipo: 'Pessoa física', a_tipo: 'Pessoa física', preco: 'R$ 150.000,00' }, enot: { t: 'Não', a: 'Não' } };

test('CV-Rural vazio: lista cada coisa que falta, com o campo de destino', () => {
  const r = rodar({ ato: 'CV-Rural' });
  const msgs = r.map(x => x.msg).join('\n');
  assert.match(msgs, /nome do apresentante/);
  assert.match(msgs, /telefone \(WhatsApp\) do apresentante/);
  assert.match(msgs, /comprador\(a\)/);
  assert.match(msgs, /Vendedor\(es\) — pessoa física, jurídica ou múltiplos/);
  assert.match(msgs, /e-Notariado/);
  assert.match(msgs, /valor válido em "Preço ajustado/);
  assert.deepEqual(r.find(x => /Comprador\(es\) — pessoa/.test(x.msg)).alvo, 'identA');
  assert.equal(r.find(x => /Preço/.test(x.msg)).alvo, 'q_preco');
});

test('tudo preenchido e conferência ok: nada falta', () => {
  assert.equal(rodar(completo).length, 0);
});

test('confirmação desfeita por alteração posterior: avisa em vez de só travar', () => {
  const r = rodar(Object.assign({}, completo, { desfeita: true, curadoria: { ok: false, erros: ['Confirme expressamente a situação registrada antes de protocolizar.'] } }));
  assert.equal(r.length, 1);
  assert.match(r[0].msg, /desmarcada porque você alterou dados depois de confirmar/);
  assert.equal(r[0].alvo, 'curadoriaConfirmacao');
});

test('parcelas que não fecham o preço: diz quanto somam, quanto é o preço e o que fazer', () => {
  const r = rodar(Object.assign({}, completo, { curadoria: { ok: false, soma_centavos: 3000000, preco_centavos: 15000000,
    erros: ['A diferença entre preço e parcelas precisa ser registrada como conferência pendente ou divergência.'] } }));
  assert.match(r[0].msg, /somam R\$\s30\.000,00 e o preço é R\$\s150\.000,00/);
  assert.match(r[0].msg, /Conferência pendente ou parcial/);
});

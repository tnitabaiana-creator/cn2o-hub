// v1.50 — ditado por voz: junção do texto falado, pontuação por voz, suporte e cabeçalho do microfone.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const ini = html.indexOf('function ditadoSuportado(win) {');
const fim = html.indexOf('// ---- ditado: sessão e botão (DOM)', ini);
const ctx = vm.createContext({});
vm.runInContext(html.slice(ini, fim), ctx);
const { juntarDitado, pontuarDitado, ditadoSuportado } = ctx;

test('o ditado entra no fim do texto, sem apagar o que já estava escrito', () => {
  assert.equal(juntarDitado('', 'falta o ccir'), 'Falta o ccir');
  assert.equal(juntarDitado('Falta o CCIR', 'e a certidão'), 'Falta o CCIR e a certidão');
  assert.equal(juntarDitado('Linha um\n', 'segunda linha'), 'Linha um\nSegunda linha');
  assert.equal(juntarDitado('Pronto.', 'agora outra'), 'Pronto. Agora outra');
  assert.equal(juntarDitado('Texto', ''), 'Texto');
});

test('pontuação falada vira sinal, com espaços certos', () => {
  assert.equal(pontuarDitado('falta o ccir vírgula a certidão ponto'), 'falta o ccir, a certidão.');
  assert.equal(pontuarDitado('prezados dois pontos'), 'prezados:');
  assert.equal(pontuarDitado('pode vir segunda ponto de interrogação'), 'pode vir segunda?');
  assert.equal(pontuarDitado('itens ponto e vírgula prazos'), 'itens; prazos');
  assert.equal(pontuarDitado('bom dia nova linha segue o pedido'), 'bom dia\nsegue o pedido');
  assert.equal(pontuarDitado('fim novo parágrafo atenciosamente'), 'fim\n\natenciosamente');
});

test('"ponto" que faz parte da frase não vira sinal', () => {
  assert.equal(pontuarDitado('fica no ponto de ônibus'), 'fica no ponto de ônibus');
  assert.equal(pontuarDitado('ponto e linha'), 'ponto e linha');
});

test('maiúscula no começo da frase, depois de ponto e de quebra de linha', () => {
  assert.equal(juntarDitado('', 'bom dia ponto segue o pedido nova linha obrigado'), 'Bom dia. Segue o pedido\nObrigado');
  assert.equal(juntarDitado('Prezado,', 'ana'), 'Prezado, ana');   // depois de vírgula, não
});

test('suporte: só com reconhecimento de voz do navegador', () => {
  assert.equal(ditadoSuportado({ webkitSpeechRecognition: function () {} }), true);
  assert.equal(ditadoSuportado({ SpeechRecognition: function () {} }), true);
  assert.equal(ditadoSuportado({}), false);
});

test('Redator: microfone no "O que precisa ser dito" e no ajuste; não no texto colado', () => {
  assert.match(html, /<textarea id="redContexto"[^>]*data-ditado/);
  assert.match(html, /<input type="text" id="redAjuste"[^>]*data-ditado/);
  assert.doesNotMatch(html, /<textarea id="redRecebido"[^>]*data-ditado/);
  assert.match(html, /ligarDitado\(document\)/);
});

test('netlify.toml libera o microfone só para o próprio site; câmera e localização seguem bloqueadas', () => {
  const toml = fs.readFileSync(path.join(__dirname, '../netlify.toml'), 'utf8');
  assert.match(toml, /Permissions-Policy = "camera=\(\), microphone=\(self\), geolocation=\(\), payment=\(\), usb=\(\)"/);
  assert.doesNotMatch(toml, /microphone=\(\)/);
});

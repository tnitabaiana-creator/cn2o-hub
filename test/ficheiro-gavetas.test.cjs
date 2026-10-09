// v1.48 — Ficheiro de Pastas: 50 pastas por gaveta, em ordem, nas gavetas G2, G3, G4, G7, G8 e G9.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../ficheiro-pastas.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const trecho = script.slice(script.indexOf('const GAVETAS_COM_PASTAS'), script.indexOf('function aviso('));
const ctx = vm.createContext({ S: { dados: null } });
vm.runInContext(trecho + '\nthis.f = { ondeFica, infoGaveta, textoOnde, pastasDaGaveta, GAVETAS_COM_PASTAS, POR_GAVETA };', ctx);
const F = ctx.f;

test('o script da página tem sintaxe válida', () => { new vm.Script(script); });

test('distribuição: 001–050 na G2 … 251–300 na G9, posição contada da frente', () => {
  const casos = [['001', 'G2', 1], ['050', 'G2', 50], ['051', 'G3', 1], ['073', 'G3', 23], ['100', 'G3', 50], ['101', 'G4', 1],
    ['150', 'G4', 50], ['151', 'G7', 1], ['200', 'G7', 50], ['201', 'G8', 1], ['251', 'G9', 1], ['300', 'G9', 50]];
  for (const [p, g, pos] of casos) {
    const o = F.ondeFica(p);
    assert.equal(o.gaveta, g, 'pasta ' + p);
    assert.equal(o.posicao, pos, 'pasta ' + p);
  }
  assert.equal(F.ondeFica('301'), null);     // acima de 300: ainda sem gaveta definida
  assert.equal(F.ondeFica('000'), null);
});

test('onde fica cada gaveta no arquivo (módulo e altura)', () => {
  assert.equal(F.textoOnde('G2'), 'Módulo da esquerda · 2ª gaveta de cima para baixo');
  assert.equal(F.textoOnde('G7'), 'Módulo da direita · 2ª gaveta de cima para baixo');
  assert.equal(F.textoOnde('G9'), 'Módulo da direita · 4ª gaveta de cima para baixo');
});

test('as pastas e protocolos vêm do servidor como estão: a gaveta só recorta a lista', () => {
  const pastas = Array.from({ length: 300 }, (_, i) => ({ pasta: String(i + 1).padStart(3, '0'), protocolo: i % 2 ? String(1000 + i) : null }));
  ctx.S.dados = { pastas };
  const g8 = F.pastasDaGaveta('G8');
  assert.equal(g8.length, 50);
  assert.equal(g8[0].pasta, '201');
  assert.equal(g8[49].pasta, '250');
  assert.equal(g8[1].protocolo, pastas[201].protocolo);
  assert.equal(F.pastasDaGaveta('G1').length, 0);   // G1, G5, G6 e G10 não guardam pastas do ficheiro
  assert.equal(F.pastasDaGaveta('G10').length, 0);
});

test('a página não muda nada no servidor além do que já fazia (mesmas rotas)', () => {
  const rotas = [...script.matchAll(/api\('([^'?]+)/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(rotas)], ['/', '/carga-inicial', '/conferencia', '/protocolo/'].sort());
});

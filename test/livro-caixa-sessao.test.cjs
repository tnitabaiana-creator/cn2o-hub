'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const L = require('../livro-caixa.js');
const codigo = fs.readFileSync(path.join(__dirname, '../livro-caixa.js'), 'utf8');
function trecho(inicio, fim) {
  const a = codigo.indexOf(inicio), b = codigo.indexOf(fim, a);
  assert.ok(a >= 0 && b > a, 'função real do Livro-caixa disponível para o cenário');
  return codigo.slice(a, b);
}
const baixarAnexo = trecho('    async function baixarAnexo(', '    const monitor');
const carregar = trecho('    async function carregar(', '    function desenhar(');
const salvar = trecho('    async function salvar(', '    async function historico(');
function downloadContexto() {
  let liberar, ativo = true, expiracoes = 0, downloads = 0;
  const ctx = vm.createContext({
    ROTA: '/hub/livro-caixa',
    op: { sessao: () => ({ token: 'sessao-ficticia' }), endpoint: 'https://exemplo.invalid', expirada: () => { expiracoes++; } },
    autorizado: () => ativo,
    win: { fetch: () => new Promise(resolve => { liberar = resolve; }) },
    situacao: () => {}, baixar: () => { downloads++; }, encodeURIComponent
  });
  vm.runInContext(baixarAnexo, ctx);
  return { iniciar: () => vm.runInContext("baixarAnexo({id:'ficticio',nome:'livro.pdf'})", ctx),
    trocarSessao: () => { ativo = false; }, resposta: value => liberar(value),
    expiracoes: () => expiracoes, downloads: () => downloads };
}
test('401 tardio de download não encerra sessão nova nem dispara download', async () => {
  const a = downloadContexto(), pendente = a.iniciar();
  a.trocarSessao(); a.resposta({ status: 401 }); await pendente;
  assert.equal(a.expiracoes(), 0); assert.equal(a.downloads(), 0);
});
test('401 de download da sessão ainda corrente encerra essa sessão', async () => {
  const a = downloadContexto(), pendente = a.iniciar();
  a.resposta({ status: 401 }); await pendente;
  assert.equal(a.expiracoes(), 1); assert.equal(a.downloads(), 0);
});
const mes = (revisao, total) => ({ mes: '2026-10', receita: { status: 'disponivel', receita_liquida: 704.31 },
  despesas: { revisao, total, fonte: 'Livro fictício conferido' },
  projecao: { saldo: 704.31 - total, ir_projetado: 138.69, liquido_projetado: 365.62 } });
function salvamentoContexto(respostaPost) {
  const elementos = { '[data-total]': { value: '200,00' }, '[data-fonte]': { value: 'Livro fictício conferido' }, '[data-salvar]': { disabled: false } };
  const avisos = [], requests = [];
  const ctx = vm.createContext({
    ROTA: '/hub/livro-caixa', geracao: 0, ocupado: false, bloqueado: false, alterado: true, arquivo: null,
    registros: [mes(1, 100)], selecionado: '2026-10', autorizado: () => true, centavos: L.centavos,
    host: { querySelector: k => elementos[k], querySelectorAll: () => Object.values(elementos) },
    lerArquivo: async () => undefined, situacao: texto => avisos.push(texto),
    op: { api: async (rota, op) => { requests.push({ rota, corpo: op?.corpo }); if (op?.corpo) return respostaPost; throw { status: 503, erro: 'GET indisponível' }; } }
  });
  vm.runInContext('function atual(){return registros[0]} function desenhar(){host.querySelector("[data-salvar]").disabled=ocupado||bloqueado;}', ctx);
  vm.runInContext(carregar + salvar, ctx);
  return { ctx, avisos, requests, elementos, iniciar: () => vm.runInContext('salvar({preventDefault(){}})', ctx) };
}
test('POST confirmado seguido de GET indisponível mantém revisão e resultado salvos', async () => {
  const confirmado = mes(2, 200), a = salvamentoContexto(confirmado);
  await a.iniciar();
  assert.equal(a.requests[0].corpo.revisao_base, 1);
  assert.equal(a.requests[0].corpo.total_despesas_centavos, 20000);
  assert.equal(a.ctx.registros[0], confirmado);
  assert.equal(a.ctx.registros[0].despesas.revisao, 2);
  assert.equal(a.ctx.registros[0].projecao.liquido_projetado, 365.62);
  assert.equal(a.ctx.alterado, false);
  assert.match(a.avisos.at(-1), /Despesas salvas, mas a leitura/);
});
test('resposta de POST com mês ou revisão incorretos bloqueia repetição e conserva versão conhecida', async () => {
  for (const resposta of [{ ...mes(2, 200), mes: '2026-11' }, mes(1, 200), { mes: '2026-10', despesas: { revisao: 2 } }]) {
    const a = salvamentoContexto(resposta);
    await a.iniciar();
    assert.equal(a.ctx.registros[0].despesas.revisao, 1);
    assert.equal(a.ctx.registros[0].despesas.total, 100);
    assert.equal(a.ctx.bloqueado, true);
    assert.equal(a.elementos['[data-salvar]'].disabled, true);
    await a.iniciar(); assert.equal(a.requests.length, 1);
  }
});

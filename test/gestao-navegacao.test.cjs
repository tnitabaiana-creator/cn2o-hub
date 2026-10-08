'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function trecho(a, b) {
  const i = html.indexOf(a), j = html.indexOf(b, i + a.length);
  assert.ok(i >= 0 && j > i, 'Trecho original do Hub deve existir: ' + a);
  return html.slice(i, j);
}
function ambiente(admin = true) {
  const chamadas = [], paginas = [], sessoes = { admin, token: 'token-ficticio', login: 'fixture.gestao' };
  const contexto = vm.createContext({
    SESSAO: sessoes, window: { GestaoProdutividade: { montar(op) { chamadas.push(['montar', op]); return { podeSair: () => true, destruir() { chamadas.push(['destruir']); } }; } } },
    el: id => ({ id }), api() {}, sessaoExpirada() {},
    toast: aviso => chamadas.push(['aviso', aviso]),
    mostrarPagina: (...args) => paginas.push(args), abrirEditorMural: (...args) => chamadas.push(['editor', ...args])
  });
  vm.runInContext(trecho('let GESTAO_PRODUTIVIDADE = null;', "let VOLTAR_PARA = '';"), contexto);
  return { chamadas, paginas, sessoes, run: code => vm.runInContext(code, contexto) };
}

test('Gestão lista os três relatórios existentes e escrituras sem duplicar o antigo menu', () => {
  const menu = html.match(/<button[^>]*id="navRelatorios"[^>]*>[\s\S]*?<\/button>/)[0];
  assert.match(menu, /data-nav="gestao"/); assert.match(menu, /hidden/); assert.match(menu, />Gestão<\/button>/);
  const lista = trecho('<ul class="gestao-lista"', '</ul>');
  assert.deepEqual([...lista.matchAll(/data-gestao-rel="([^"]+)"/g)].map(x => x[1]), ['escreventes', 'atendimentos', 'produtividade']);
  assert.equal((lista.match(/<li>/g) || []).length, 4);
  assert.match(lista, /id="gestaoEscrituras"/);
  assert.doesNotMatch(lista, /Versão 3 Produtividade|<iframe|srcdoc/);
});

test('usuário sem perfil de gestão não monta o relatório nem abre os painéis', () => {
  const a = ambiente(false);
  a.run('abrirGestao(true); abrirProdutividadeEscrituras(true); abrirRelatorioGestao("escreventes")');
  assert.deepEqual(a.paginas, [['paginaHub', true], ['paginaHub', true]]);
  assert.deepEqual(a.chamadas, []);
});

test('abertura e reabertura de escrituras destrói a instância anterior e usa sessão atual', () => {
  const a = ambiente();
  a.run('abrirProdutividadeEscrituras(false)');
  const op = a.chamadas[0][1];
  assert.equal(op.host.id, 'gestaoProdutividadeHost'); assert.equal(op.sessao(), a.sessoes);
  a.run('abrirProdutividadeEscrituras(true)');
  assert.deepEqual(a.chamadas.map(x => x[0]), ['montar', 'destruir', 'montar']);
  assert.deepEqual(a.paginas, [['paginaGestaoEscrituras', false, 'gestao-escrituras'], ['paginaGestaoEscrituras', true, 'gestao-escrituras']]);
  a.run('destruirGestaoProdutividade(); destruirGestaoProdutividade()');
  assert.deepEqual(a.chamadas.map(x => x[0]), ['montar', 'destruir', 'montar', 'destruir']);
});

test('cada item legado seleciona explicitamente a visão correta e ignora desconhecidos', () => {
  const a = ambiente();
  ['escreventes', 'atendimentos', 'produtividade', 'desconhecido'].forEach(x => a.run('abrirRelatorioGestao(' + JSON.stringify(x) + ')'));
  assert.deepEqual(a.chamadas, [['editor', 'relatorios', 'escreventes'], ['editor', 'relatorios', 'atendimentos'], ['editor', 'relatorios', 'produtividade']]);
});

test('reabertura preserva a instância com alterações ainda não salvas', () => {
  const a = ambiente();
  a.run('abrirProdutividadeEscrituras(false); GESTAO_PRODUTIVIDADE.podeSair = () => false; abrirProdutividadeEscrituras(true)');
  assert.deepEqual(a.chamadas.map(x => x[0]), ['montar', 'aviso']);
  assert.match(a.chamadas[1][1], /ainda não foram salvos/);
  assert.equal(a.paginas.length, 1);
});

test('painel de gestão reaproveita relatórios sem oferecer publicação do mural', () => {
  const ctx = vm.createContext({ ED: { gestao: true }, cabecalhoSub: (a, b) => '<header>' + a + '|' + b + '</header>' });
  vm.runInContext(trecho('function htmlEditorMural()', 'function marcarSujo('), ctx);
  const saida = vm.runInContext('htmlEditorMural()', ctx);
  assert.match(saida, /Gestão · Relatórios/); assert.match(saida, /id="edPainel"/);
  assert.doesNotMatch(saida, /edPublicar|Publicar mural|ed-abas|Editar o mural/);
});

test('sair e navegar para outra área limpam o documento privado e o atalho preserva restrição', () => {
  assert.match(trecho('function limparSessao()', 'function lerSessao('), /destruirGestaoProdutividade\(\)/);
  const navegar = trecho('function mostrarPagina(', '/* abre uma ferramenta');
  assert.match(navegar, /id !== 'paginaGestaoEscrituras'\) destruirGestaoProdutividade\(\)/);
  assert.match(navegar, /!SESSAO\.admin/);
  const rota = trecho('function abrirRota(', "if (rota === 'despesas')");
  assert.match(rota, /rota === 'gestao' \|\| rota === 'relatorios'/);
  assert.match(rota, /rota === 'gestao-escrituras'/);
  assert.match(html, /'gestao-escrituras': 'paginaGestao'/);
});

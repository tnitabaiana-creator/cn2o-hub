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
    SESSAO: sessoes, CONFIG: { endpoint: 'http://localhost' }, window: { GestaoProdutividade: { montar(op) { chamadas.push(['montar', op]); return { podeSair: () => true, destruir() { chamadas.push(['destruir']); } }; } }, LivroCaixa: { montar(op) { chamadas.push(['livro', op]); return { podeSair: () => true, destruir() { chamadas.push(['destruirLivro']); } }; } } },
    el: id => ({ id }), api() {}, sessaoExpirada() {},
    toast: aviso => chamadas.push(['aviso', aviso]),
    mostrarPagina: (...args) => paginas.push(args), abrirEditorMural: (...args) => chamadas.push(['editor', ...args])
  });
  vm.runInContext(trecho('let GESTAO_PRODUTIVIDADE = null;', "let VOLTAR_PARA = '';"), contexto);
  return { chamadas, paginas, sessoes, run: code => vm.runInContext(code, contexto) };
}

test('Gestão lista os relatórios e acrescenta livro-caixa inicialmente oculto', () => {
  const menu = html.match(/<button[^>]*id="navRelatorios"[^>]*>[\s\S]*?<\/button>/)[0];
  assert.match(menu, /data-nav="gestao"/); assert.match(menu, /hidden/); assert.match(menu, />Gestão<\/button>/);
  const lista = trecho('<ul class="gestao-lista"', '</ul>');
  assert.deepEqual([...lista.matchAll(/data-gestao-rel="([^"]+)"/g)].map(x => x[1]), ['escreventes', 'atendimentos', 'produtividade']);
  assert.equal((lista.match(/<li\b/g) || []).length, 5);
  assert.match(lista, /id="gestaoEscrituras"/);
  assert.match(lista, /<li id="gestaoLivroCaixaItem" hidden>/);
  assert.doesNotMatch(lista, /Versão 3 Produtividade|<iframe|srcdoc/);
});

test('livro-caixa só monta para César e recebe sessão, endpoint e expiração', () => {
  const a = ambiente(); a.run('abrirLivroCaixa(false)');
  assert.equal(a.chamadas.length, 0); assert.deepEqual(a.paginas, [['paginaHub', false]]);
  a.sessoes.login = 'cesar.bravo'; a.run('abrirLivroCaixa(false)');
  const op = a.chamadas[0][1]; assert.equal(op.host.id, 'livroCaixaHost'); assert.equal(op.sessao(), a.sessoes); assert.equal(op.endpoint, 'http://localhost'); assert.equal(typeof op.expirada, 'function');
  assert.deepEqual(a.paginas[1], ['paginaLivroCaixa', false, 'livro-caixa']);
  a.run('abrirLivroCaixa(true); destruirLivroCaixa(); destruirLivroCaixa()');
  assert.deepEqual(a.chamadas.map(x=>x[0]), ['livro','destruirLivro','livro','destruirLivro']);
});

test('reabertura do livro preserva alterações pendentes', () => {
  const a = ambiente(); a.sessoes.login = 'cesar.bravo';
  a.run('abrirLivroCaixa(false); LIVRO_CAIXA.podeSair=()=>false; abrirLivroCaixa(true)');
  assert.deepEqual(a.chamadas.map(x=>x[0]), ['livro','aviso']); assert.equal(a.paginas.length, 1);
});

test('guard de navegação impede desmontagem e evita montar outro módulo sobre livro pendente', () => {
  const chamadas = [], el = () => ({ hidden:false, classList: { contains:()=>false,toggle(){} }, querySelector:()=>null });
  const ctx = vm.createContext({ SESSAO: { admin:true,login:'cesar.bravo' }, CONFIG:{endpoint:'http://localhost'}, el,
    PAGINAS:[], GRUPO_POR_ROTA:{}, ROTA_DO_GRUPO:{}, voltarPelaIA:()=>false, pintarVoltar(){}, registrarAbertura(){}, marcarNav(){},
    toast:x=>chamadas.push(x), window:{scrollTo(){},GestaoProdutividade:{montar(){ throw new Error('Não deve montar'); }}}, api(){}, sessaoExpirada(){} });
  vm.runInContext(trecho('let GESTAO_PRODUTIVIDADE = null;', "let VOLTAR_PARA = '';") + "let VOLTAR_PARA='';" + trecho('function mostrarPagina(', '/* abre uma ferramenta'),ctx);
  vm.runInContext('LIVRO_CAIXA={podeSair:()=>false,destruir(){throw new Error("não desmontar");}}',ctx);
  assert.equal(vm.runInContext("mostrarPagina('paginaHub',true)",ctx),false);
  vm.runInContext('abrirProdutividadeEscrituras(true)',ctx); assert.equal(chamadas.length,2);
  vm.runInContext("SESSAO.login='outro';LIVRO_CAIXA={destruir(){}};mostrarPagina('paginaLivroCaixa',true)",ctx);
  assert.equal(vm.runInContext('LIVRO_CAIXA',ctx),null,'Troca de conta limpa o livro mesmo com saída pendente');
});

test('livro tem rota, vínculo de retorno e limpeza no logout', () => {
  assert.match(trecho('function limparSessao()', 'function lerSessao('), /destruirLivroCaixa\(\)/);
  assert.match(trecho('function abrirRota(', "if (rota === 'despesas')"), /rota === 'livro-caixa'/);
  assert.match(html, /'livro-caixa': 'paginaGestao'/);
  assert.match(html, /el\('gestaoLivroCaixaItem'\)\.hidden = !podeLivroCaixa\(\)/);
  assert.match(html, /<script src="livro-caixa.js"><\/script>/);
});

test('logout e fechamento da aba consultam alterações pendentes do livro', () => {
  const avisos = [], handlers = {}, ctx = vm.createContext({ LIVRO_CAIXA: { podeSair:()=>false },
    toast:x=>avisos.push(x), window:{addEventListener:(n,f)=>{handlers[n]=f;}}, MA_IMAGENS:{ocupado:()=>false} });
  vm.runInContext(trecho('function sair() {', "let LOGIN_DA_TELA = ''"),ctx);
  vm.runInContext('sair()',ctx); assert.equal(avisos.length,1,'Retorna antes de apagar sessão ou recarregar');
  vm.runInContext(trecho("window.addEventListener('beforeunload', function (e) {", '/* ============================================================'),ctx);
  let preveniu=false;const evento={preventDefault(){preveniu=true;}};handlers.beforeunload(evento);
  assert.equal(preveniu,true);assert.equal(evento.returnValue,'');
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

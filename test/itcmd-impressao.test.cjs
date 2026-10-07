'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const A = require('../itcmd-arquivo.js');
const fonte = fs.readFileSync(path.join(__dirname, '../frontend/src/itcmd/ui.js'), 'utf8');
const inicio = fonte.indexOf('  async function imprimirOrcamento('), fim = fonte.indexOf("  $('#btCopiar')", inicio);
assert.ok(inicio > 0 && fim > inicio);
function adiar() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { resolve, reject, promise }; }
function ambiente() {
  const logo = adiar(), botoes = new Map([['#btImprimir', { textContent: 'Orçamento resumido', disabled: false }], ['#btImprimirDiscriminado', { textContent: 'Orçamento discriminado', disabled: false }]]);
  const estado = { modo: 'inventario', inv: [{ nome: 'Fulana fictícia' }], hoje: '2026-10-07' }, sessao = { login: 'qa', token: 'token-ficticio' };
  const eventos = [], avisos = []; let arquivos = [], recebido;
  const modelo = A.criar({ sessao: () => sessao, estado: () => estado, identificacao: () => ({ titulo: '', protocolo: 'AT10VFP' }), mudou: () => {} });
  const context = { impressaoEmAndamento: false, SESSAO: sessao, ULT: {}, PDFMini: function () {},
    $: id => botoes.get(id), capturarEstado: () => A.copiar(estado), obterDadosOrcamento: versao => ({ versao, identificacao: estado.inv[0].nome }), carregarLogoOrcamento: () => logo.promise,
    toast: text => avisos.push(text), window: { ITCMDArquivo: { ...A, pdfOrcamento: (PDF, dados) => { eventos.push('gerar'); recebido = A.copiar(dados); return new Blob(['%PDF-1.4\n%%EOF']); } } },
    ARQUIVO: { modelo, guardarDocumentos: async (docs, snapshot, origem) => { eventos.push('salvar'); arquivos.push({ docs, snapshot, origem }); }, oferecerPdf: () => eventos.push('oferecer') } };
  const imprimir = vm.runInNewContext(fonte.slice(inicio, fim) + '\nimprimirOrcamento;', context);
  return { imprimir, logo, botoes, estado, sessao, modelo, eventos, arquivos, avisos, context, get dados() { return recebido; } };
}
for (const versao of ['resumido', 'discriminado']) test('impressão ' + versao + ' arquiva tipo orçamento com snapshot e nome distinto antes de oferecer', async () => {
  const a = ambiente(), p = a.imprimir(versao); assert.ok([...a.botoes.values()].every(b => b.disabled));
  a.logo.resolve({ base64: 'jpeg-ficticio', largura: 892, altura: 364 }); await p;
  assert.deepEqual(a.eventos, ['gerar', 'salvar', 'oferecer']); assert.equal(a.dados.versao, versao); assert.equal(a.dados.identificacao, 'Fulana fictícia');
  const x = a.arquivos[0]; assert.equal(x.docs[0].tipo, 'orcamento'); assert.match(x.docs[0].nome, new RegExp('-' + (versao === 'resumido' ? 'Resumido' : 'Discriminado') + '-'));
  assert.equal(x.snapshot.inv[0].nome, 'Fulana fictícia'); assert.ok(a.modelo.validoContexto(x.origem));
  assert.ok([...a.botoes.values()].every(b => !b.disabled)); assert.equal(a.botoes.get('#btImprimir').textContent, 'Orçamento resumido'); assert.equal(a.botoes.get('#btImprimirDiscriminado').textContent, 'Orçamento discriminado');
});
test('digitação durante preparo da logo impede PDF e não salva valores divergentes', async () => {
  const a = ambiente(), p = a.imprimir('discriminado'); a.estado.inv[0].nome = 'Outro atendimento'; a.modelo.marcar(); a.logo.resolve({}); await p;
  assert.deepEqual(a.eventos, []); assert.match(a.avisos.join(' '), /dados foram alterados/); assert.equal(a.estado.inv[0].nome, 'Outro atendimento');
});
test('logout ou troca de trabalho enquanto logo carrega descarta impressão anterior', async () => {
  for (const trocar of [a => { a.sessao.token = ''; }, a => a.modelo.reset()]) {
    const a = ambiente(), p = a.imprimir(); trocar(a); a.logo.resolve({}); await p; assert.deepEqual(a.eventos, []); assert.ok([...a.botoes.values()].every(b => !b.disabled));
  }
});
test('segundo clique durante geração não cria outro PDF nem outra versão', async () => {
  const a = ambiente(), p = a.imprimir(); await a.imprimir('discriminado'); a.logo.resolve({}); await p; assert.equal(a.arquivos.length, 1); assert.equal(a.dados.versao, 'resumido');
});
test('erro da logo e erro no arquivo nunca oferecem PDF como se estivesse salvo', async () => {
  const a = ambiente(), p = a.imprimir(); a.logo.reject(new Error('Falha de logo')); await p; assert.deepEqual(a.eventos, []); assert.match(a.avisos.join(' '), /Falha de logo/);
  const b = ambiente(); b.context.ARQUIVO.guardarDocumentos = async () => { b.eventos.push('salvar'); throw new Error('Falha de armazenamento'); };
  const q = b.imprimir(); b.logo.resolve({}); await q; assert.deepEqual(b.eventos, ['gerar', 'salvar']); assert.match(b.avisos.join(' '), /Falha de armazenamento/);
});
test('sem sessão, impressão não prepara nem arquiva dados', async () => {
  const a = ambiente(); a.sessao.token = ''; await a.imprimir(); assert.deepEqual(a.eventos, []); assert.match(a.avisos.join(' '), /Entre no Hub/);
});

function guardDoArquivo() {
  const codigo = fs.readFileSync(path.join(__dirname, '../itcmd-arquivo.js'), 'utf8');
  const f = codigo.match(/guardarDocumentos: (async[\s\S]+?return modelo\.salvar\(arqs, estado, false, t\); \}) \};/); assert.ok(f, 'função real do arquivo encontrada');
  const espera = adiar(), a = ambiente(); let gravacoes = 0, convertido = 0;
  const modelo = { ...a.modelo, salvar: async () => { gravacoes++; } };
  const guardar = vm.runInNewContext('(' + f[1] + ')', { MAX_TOTAL: 15 * 1024 * 1024, modelo, pdfParaDocumento: async () => { convertido++; return espera.promise; } });
  return { ...a, guardar, espera, get gravacoes() { return gravacoes; }, get convertido() { return convertido; } };
}
test('arquivo recusa ticket vencido antes de converter PDF e antes de criar versão', async () => {
  const a = guardDoArquivo(), t = a.modelo.ticket(); a.modelo.marcar();
  await assert.rejects(a.guardar([{ blob: { size: 10 } }], a.estado, t), /dados foram alterados/); assert.equal(a.gravacoes, 0); assert.equal(a.convertido, 0);
});
test('arquivo recusa edição ocorrida durante conversão do PDF em base64', async () => {
  const a = guardDoArquivo(), t = a.modelo.ticket(), p = a.guardar([{ blob: { size: 10 } }], a.estado, t);
  a.modelo.marcar(); a.espera.resolve({ base64: 'pdf' }); await assert.rejects(p, /dados foram alterados/); assert.equal(a.gravacoes, 0);
});
test('arquivo recusa logout durante conversão mas permite fluxo de declaração sem ticket estrito', async () => {
  const a = guardDoArquivo(), t = a.modelo.ticket(), p = a.guardar([{ blob: { size: 10 } }], a.estado, t);
  a.sessao.token = ''; a.espera.resolve({ base64: 'pdf' }); await assert.rejects(p, e => e.cancelado === true); assert.equal(a.gravacoes, 0);
  const b = guardDoArquivo(), q = b.guardar([{ blob: { size: 10 } }], b.estado); b.modelo.marcar(); b.espera.resolve({ base64: 'pdf' }); await q; assert.equal(b.gravacoes, 1);
});

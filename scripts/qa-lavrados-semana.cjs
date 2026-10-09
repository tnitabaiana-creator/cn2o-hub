'use strict';
// QA local com dados sintéticos, contexto novo e rede limitada ao servidor efêmero.
// Uso: PLAYWRIGHT_MODULE=<caminho> EDGE_PATH=<caminho> QA_OUT=<diretório> node scripts/qa-lavrados-semana.cjs
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const F = path.resolve(__dirname, '..'), OUT = process.env.QA_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'cn2o-semana-'));
const mes = (m, fim, n, completo) => ({ mes: m, ate: fim, corte_em: '2026-10-09T17:00:00-03:00', dia_final_completo: completo, revisao: 1, total_oficial: completo ? n : null, total_observado: n, cobertura_completa: completo, com_vinculo: 0, sem_vinculo: n, com_pendencia_identificacao: 0, importado_em: '2026-10-09T20:05:00Z' });
const meses = [mes('2026-09', '2026-09-30', 120, true), mes('2026-10', '2026-10-09', 30, false)];
function resumo(inicio, fim, n, completo, bases) {
  const atribuida = n === 12 ? 4 : 0;
  return { inicio, fim, total_observado: n, total_oficial: completo ? n : null, cobertura_completa: completo, com_vinculo: 0, sem_vinculo: n, com_pendencia_identificacao: 0, meses: bases,
    tipos: [{ codigo: 'compra_venda', nome: 'Compra e venda', total_observado: n - 6, total_oficial: completo ? n - 6 : null }, { codigo: 'inventario', nome: 'Inventário e partilha', total_observado: 5, total_oficial: completo ? 5 : null }, { codigo: 'nao_classificado', nome: 'Não classificado', total_observado: 1, total_oficial: completo ? 1 : null }],
    classificacao: { versao: 'extra-digital-tipos-v1', campos: ['Sub-tipo', 'Finalidade'], nao_classificados: 1, divergentes: 1, por_subtipo: n - 1, por_finalidade: 0 }, colaboradores: atribuida ? [{ id: 'fixture-a', nome: 'Colaborador de teste', fonte: 'Extra Digital', marcos: ['lavratura'], total_observado: atribuida, total_oficial: null }] : [], autoria: { status: atribuida ? 'parcial' : 'pendente', sem_autoria_confirmada: n - atribuida, com_autoria_confirmada: atribuida, cobertura_completa: false } };
}
let browser, origem, falhaSemana = false;
const servidor = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  if (u.pathname === '/hub/atos-lavrados/meses') return json({ meses });
  if (u.pathname === '/hub/atos-lavrados/resumo') return json(resumo('2026-09-01', '2026-09-30', 120, true, [meses[0]]));
  if (u.pathname === '/hub/atos-lavrados/semana') {
    if (falhaSemana) return json({ erro: 'falha sintética' }, 503);
    const anterior = u.searchParams.get('referencia') === '2026-10-02';
    return json({ ...resumo(anterior ? '2026-09-28' : '2026-10-05', anterior ? '2026-10-04' : '2026-10-11', anterior ? 20 : 12, anterior, anterior ? meses : [meses[1]]), referencia: anterior ? '2026-10-02' : '2026-10-09', fuso: 'America/Sao_Paulo' });
  }
  if (['/gestao-lavrados.js', '/gestao-lavrados.css'].includes(u.pathname)) { res.setHeader('Content-Type', u.pathname.endsWith('.js') ? 'text/javascript' : 'text/css'); return res.end(fs.readFileSync(path.join(F, u.pathname.slice(1)))); }
  if (u.pathname !== '/') { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA local — escrituras lavradas</title><link rel="stylesheet" href="/gestao-lavrados.css"><style>body{margin:0;background:#f5f2ef;font-family:Arial,sans-serif;color:#202a3a}main{max-width:980px;margin:24px auto;padding:0 16px;box-sizing:border-box}h1{font-size:24px}.contexto{font-size:13px;color:#626b78}</style><main><h1>Gestão · prévia local</h1><p class="contexto">Dados sintéticos de teste · financeiro selecionado: setembro de 2026</p><div id="oficial"></div></main><script src="/gestao-lavrados.js"></script><script>window.sessao={token:'local-fixture',login:'fixture',admin:true};window.controle=GestaoLavrados.montar({host:document.getElementById('oficial'),mes:'2026-09',seletor:false,sessao:()=>window.sessao,api:async p=>{const r=await fetch(p);if(!r.ok){const e=new Error('falha');e.status=r.status;throw e;}return r.json();}});</script></html>`);
});
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise(r => servidor.listen(0, '127.0.0.1', r)); origem = 'http://127.0.0.1:' + servidor.address().port;
  browser = await chromium.launch({ headless: true, ...(process.env.EDGE_PATH ? { executablePath: process.env.EDGE_PATH } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } }), page = await ctx.newPage(), erros = [], bloqueadas = [];
  await ctx.route('**/*', rota => { if (new URL(rota.request().url()).origin === origem) return rota.continue(); bloqueadas.push(rota.request().url()); return rota.abort(); });
  page.on('pageerror', e => erros.push(e.message));
  await page.goto(origem); await page.locator('.lavrados-distribuicao').waitFor();
  assert.equal(await page.locator('.lavrados-destaque>strong').textContent(), '120');
  await page.locator('[data-lav-visao="semana"]').click(); await page.locator('.lavrados-cortes').waitFor();
  assert.match(await page.locator('#oficial').textContent(), /05\/10\/2026 a 11\/10\/2026/);
  assert.match(await page.locator('#oficial').textContent(), /dia final parcial/);
  assert.match(await page.locator('#oficial').textContent(), /Extração em 09\/10\/2026 às 17:00:00 · Brasília/);
  assert.equal(await page.locator('.lavrados-destaque>strong').textContent(), '12');
  assert.match(await page.locator('.lavrados-autoria').textContent(), /Colaborador de teste/);
  assert.equal(await page.locator('.lavrados-sem-autoria strong').textContent(), '8');
  assert.equal((await page.evaluate(() => controle.snapshot('2026-09'))).dados.total_oficial, 120);
  await page.evaluate(() => controle.selecionar('2026-09', ['2026-09', '2026-10']));
  assert.equal(await page.locator('[data-lav-visao="semana"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#oficial').screenshot({ path: path.join(OUT, 'semana-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  const largura = await page.evaluate(() => ({ conteudo: document.documentElement.scrollWidth, tela: innerWidth })); assert.ok(largura.conteudo <= largura.tela);
  await page.locator('#oficial').screenshot({ path: path.join(OUT, 'semana-mobile.png') });
  await page.locator('[data-lav-anterior]').click(); await page.waitForFunction(() => document.querySelector('.lavrados-destaque>strong')?.textContent === '20');
  assert.match(await page.locator('#oficial').textContent(), /Extração semanal completa/);
  assert.equal(await page.locator('.lavrados-cortes li').count(), 2);
  falhaSemana = true; await page.locator('[data-lav-atual]').click(); await page.locator('[data-lav-semana-retry]').waitFor();
  await page.locator('[data-lav-visao="mes"]').click(); assert.equal(await page.locator('.lavrados-destaque>strong').textContent(), '120');
  falhaSemana = false; await page.locator('[data-lav-visao="semana"]').click(); await page.locator('.lavrados-cortes').waitFor();
  await page.evaluate(() => { sessao.token = ''; }); await page.waitForFunction(() => !document.querySelector('.lavrados-oficiais'));
  assert.deepEqual(erros, []); assert.deepEqual(bloqueadas, []);
  const evidencia = { mensalPreservado: 120, semanaParcial: 12, semanaAnteriorCompleta: 20, cortesEntreMeses: 2, tiposSemInferencia: true, autoriaPendente: true, falhaSemanalIsolada: true, ponteRepetidaPreservaSemana: true, logoutLimpo: true, largura, erros, redeExterna: bloqueadas.length };
  fs.writeFileSync(path.join(OUT, 'verificacao.json'), JSON.stringify(evidencia, null, 2)); console.log(JSON.stringify({ out: OUT, ...evidencia }));
})().catch(e => { console.error(e.stack); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); servidor.close(); });

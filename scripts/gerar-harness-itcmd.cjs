// Página local para QA da UI real, sem login, endpoints ou dados de produção.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'frontend/src/itcmd');
const out = path.resolve(process.argv[2] || path.join(root, '../validacao-calculadora/itcmd-local.html'));
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const page = read(path.join(root, 'index.html'));
const css = page.match(/<style>([\s\S]*?)<\/style>/)[1];
const motor = read(path.join(src, 'motor.js')), ui = read(path.join(src, 'ui.js'));
if (!page.includes(motor.trim()) || !page.includes(ui.trim())) throw new Error('Fontes e artefato divergem');
const fixture = `
const baseTeste = JSON.parse(JSON.stringify(window.ITCMD_UI.estado));
function usarCenario(tipo) {
  const s = JSON.parse(JSON.stringify(baseTeste));
  s.hoje = '2026-10-06'; s.ufp = 87.19; s.ufpManual = false; s.modo = tipo === 'cumulativo' ? 'cumulativo' : 'inventario';
  s.orc = { honorarios: '', certidoes: '', registro: '', outros: '' }; s.emol = { inv2Acessorio: false };
  const bem = (valor, natureza = 'comum', fracao = 100) => ({ descricao: 'Bem de teste (' + natureza + ')', tipo: 'imovel_urbano', valor, natureza, fracao });
  s.inv[0] = { ...s.inv[0], nome: 'Espólio de teste', obito: '2026-09-01', estadoCivil: 'casado', regime: 'parcial', conjuge: { nome: 'Meeira de teste' }, dividas: 0, bens: [bem(1000000)],
    descendentes: [{ uid: 'f1', nome: 'Filho de teste A', condicao: 'vivo', representantes: [] }, { uid: 'f2', nome: 'Filho de teste B', condicao: 'vivo', representantes: [] }], ascendentes: {}, colaterais: [] };
  if (tipo === 'misto') s.inv[0].bens = [bem(600000), bem(400000, 'particular')];
  if (tipo === 'particular') s.inv[0].bens = [bem(1000000, 'particular')];
  if (tipo === 'fracao') s.inv[0].bens = [bem(1000000, 'particular', 50)];
  if (tipo === 'dividas') s.inv[0].dividas = 200000;
  if (tipo === 'zero') s.inv[0].bens = [bem(0)];
  s.inv[1] = { ...s.inv[1], nome: 'Meeira de teste', obito: '2026-10-01', estadoCivil: 'solteiro', conjuge: { nome: '' }, bens: [], dividas: 0, descendentes: s.inv[0].descendentes, ascendentes: {}, colaterais: [] };
  window.ITCMD_UI.estado = s;
  document.getElementById('fixtureInfo').textContent = 'Cenário: ' + tipo;
}
document.getElementById('cenarioQA').addEventListener('change', e => usarCenario(e.target.value));
usarCenario('comum');
`;
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none';"><title>QA local — emolumentos sem meação</title><style>${css}\nbody{display:block;margin:0;background:#f6f5f2}.qa{padding:16px;margin:0 auto;max-width:1200px;font-family:Arial,sans-serif}.qa label{font-weight:bold}.qa select{padding:8px;margin:8px}#itcmdRaiz{max-width:1200px;margin:0 auto;padding:16px}#btExtrairItcmd,#btDeclaracao{display:none}</style></head><body><div class="qa"><h1>Validação local da calculadora</h1><p>Dados fictícios. Sem conexão com produção. O orçamento, a impressão e a cópia usam o código real do Hub.</p><label for="cenarioQA">Cenário</label><select id="cenarioQA"><option value="comum">Comum: 1 milhão → base 500 mil</option><option value="misto">Misto: 600 mil comuns + 400 mil particulares → base 700 mil</option><option value="particular">Particular: 1 milhão → base 1 milhão</option><option value="fracao">Fração particular 50% → base 500 mil</option><option value="dividas">Comum com dívida: base emolumentos 500 mil; herança líquida 400 mil</option><option value="cumulativo">Cumulativo: base 500 mil em cada sucessão</option><option value="zero">Sem valores: emolumentos pendentes</option></select><p id="fixtureInfo"></p></div><div id="itcmdRaiz">${read(path.join(src, 'corpo.html'))}</div><script>${motor}\n${ui}\n${fixture}</script></body></html>`;
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html);
console.log(out);

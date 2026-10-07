'use strict';
// Dados inteiramente fictícios para conferir orçamento, sem consultas de produção.
const M = require('../../frontend/src/itcmd/motor.js');
const opts = { ufp: 87.19, hoje: '2026-10-07', desconsiderarMulta: true };
const copia = x => JSON.parse(JSON.stringify(x));
function pessoa(uid, nome, extra = {}) { return { uid, nome, condicao: 'vivo', representantes: [], ...extra }; }
function falecido(extra = {}) {
  return { nome: 'Espólio fictício de Antônio das Palmeiras', obito: '2020-02-01', estadoCivil: 'casado', regime: 'parcial', conjuge: { nome: 'Beatriz das Palmeiras' }, filhosComuns: 'sim',
    descendentes: [pessoa('h1', 'Alice das Palmeiras'), pessoa('h2', 'Bruno das Palmeiras')],
    bens: [{ descricao: 'Imóvel urbano de teste', matricula: 'TESTE-100', tipo: 'imovel_urbano', valor: 1000000, natureza: 'comum', fracao: 100 }],
    multaAtraso: true, dividas: 0, partilhaReal: { ativa: false, reais: {}, natureza: 'nao_onerosa' }, ...extra };
}
function state(modo, inv, doa) { return { modo, inv: inv || [], doa: doa || {}, emol: { inv2Acessorio: false }, orc: { certidoes: '200,00', registro: '300,00', outros: '10,50' }, ufp: opts.ufp, hoje: opts.hoje, desconsiderarMulta: true }; }
function calcular(s) {
  if (s.modo === 'doacao') return { modo: s.modo, d: M.doacao(s.doa, opts) };
  const anexar = (inv, f) => { inv.real = M.partilhaReal(inv, f.partilhaReal); if (inv.real.ativa && inv.real.totalExcedente > 0 && inv.real.natureza !== 'onerosa') inv.exced = M.itcmdExcedente(inv, inv.real, opts); };
  if (s.modo === 'cumulativo') { const c = M.cumulativo(s.inv[0], s.inv[1], opts); anexar(c.inv1, s.inv[0]); anexar(c.inv2, s.inv[1]); return { modo: s.modo, c }; }
  const inv = M.inventario(s.inv[0], opts); anexar(inv, s.inv[0]); return { modo: s.modo, inv };
}
function inventario() { const s = state('inventario', [falecido()]); return { s, ult: calcular(s) }; }
function cumulativo() {
  const herdeiros = Array.from({ length: 6 }, (_, i) => pessoa('l' + i, 'Herdeiro de teste ' + (i + 1) + ' com sobrenome extenso das Palmeiras de Albuquerque'));
  herdeiros.push(pessoa('pm', 'Filho pré-morto de teste', { condicao: 'premorto', representantes: [pessoa('n1', 'Neta fictícia A das Palmeiras de Albuquerque'), pessoa('n2', 'Neto fictício B das Palmeiras de Albuquerque')] }));
  const f1 = falecido({ descendentes: herdeiros, bens: [{ descricao: 'Rua fictícia das Palmeiras, números 101 e 103, Centro, Itabaiana/SE (duas unidades físicas não desmembradas; bem destinado exclusivamente ao teste de quebra de linhas do orçamento)', matricula: 'TESTE-25732', tipo: 'imovel_urbano', valor: 990000, natureza: 'comum', fracao: 100 }] });
  const f2 = falecido({ nome: 'Beatriz das Palmeiras', estadoCivil: 'solteiro', conjuge: {}, descendentes: copia(herdeiros), bens: [] });
  const s = state('cumulativo', [f1, f2]); return { s, ult: calcular(s) };
}
function misto() {
  const s = state('inventario', [falecido({ bens: [{ descricao: 'Imóvel comum em condomínio com terceiro', tipo: 'imovel_urbano', valor: 1000000, natureza: 'comum', fracao: 50 }, { descricao: 'Bem particular do espólio', tipo: 'imovel_urbano', valor: 300000, natureza: 'particular', fracao: 100 }] })]);
  return { s, ult: calcular(s) };
}
function partilhaReal() {
  const f = falecido(); const inv = M.inventario(f, opts); const cessao = M.aplicarCessao(inv, { beneficiarioId: 'h1', taxa: new M.Fr(1, 2) });
  f.partilhaReal = { ativa: true, natureza: 'nao_onerosa', reais: cessao.reais, taxaFr: cessao.taxa };
  const s = state('inventario', [f]); return { s, ult: calcular(s) };
}
function doacao() {
  const doa = { doadores: [{ nome: 'Doadora fictícia das Palmeiras' }], donatarios: [{ uid: 'd1', nome: 'Donatária fictícia Alice', doacoesAnteriores: 0, impostoAnterior: 0 }, { uid: 'd2', nome: 'Donatário fictício Bruno', doacoesAnteriores: 0, impostoAnterior: 0 }],
    bens: [{ descricao: 'Apartamento de teste', tipo: 'imovel_urbano', valor: 600000, fracao: 100, destino: 'todos' }, { descricao: 'Numerário de teste destinado a Alice', tipo: 'dinheiro', valor: 100000, fracao: 100, destino: 'd1' }], reservaUsufruto: false };
  const s = state('doacao', [], doa); return { s, ult: calcular(s) };
}
module.exports = { M, opts, falecido, calcular, inventario, cumulativo, misto, partilhaReal, doacao };

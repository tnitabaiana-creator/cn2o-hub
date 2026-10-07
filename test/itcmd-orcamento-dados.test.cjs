'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const D = require('../itcmd-orcamento-dados.js');
const F = require('./fixtures/itcmd-orcamento.cjs');
const moeda = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function montar(fixture, versao = 'discriminado') {
  return D.montar({ estado: fixture.s, resultado: fixture.ult, versao, identificacao: { titulo: 'Atendimento fictício', protocolo: 'AT10VFP' }, referencia: '07/10/2026',
    linhas: [{ rotulo: 'Certidões e diligências', valor: 'R$ 200,00' }, { rotulo: 'Total estimado do ato', valor: 'R$ 510,50', total: true }] });
}
test('resumido preserva custos e referência, mas não incorpora dados do anexo ou notas antigas', () => {
  const f = F.cumulativo(); f.s.motivoMulta = 'MOTIVO INTERNO QUE NÃO DEVE SER IMPRESSO';
  const dados = montar(f, 'resumido');
  assert.equal(dados.versao, 'resumido'); assert.equal(dados.protocolo, 'AT10VFP'); assert.equal(dados.titulo, 'Orçamento do inventário cumulativo');
  assert.deepEqual(dados.sucessoes, []); assert.equal(dados.linhas.at(-1).valor, 'R$ 510,50');
  assert.doesNotMatch(JSON.stringify(dados), /MOTIVO INTERNO|premissas|ajusteMulta|assinatura|honorarios/);
});
test('inventário inclui todos os herdeiros e separa a meação sem ITCMD', () => {
  const f = F.inventario(), d = montar(f).sucessoes[0], inv = f.ult.inv;
  assert.equal(d.herdeiros.length, inv.itc.linhas.length + 1);
  const meeira = d.herdeiros[0]; assert.equal(meeira.meacao, true); assert.equal(meeira.imposto, 'R$ 0,00'); assert.equal(meeira.quinhao, 'R$ 500.000,00');
  inv.itc.linhas.forEach((h, i) => {
    const l = d.herdeiros[i + 1]; assert.equal(l.nome, h.nome); assert.equal(l.quinhao, moeda(h.quinhao)); assert.equal(l.imposto, moeda(h.imposto)); assert.equal(l.total, moeda(h.imposto + h.multa));
    assert.equal(l.fracao, '1/2 da herança'); assert.equal(l.percentual, '50,0000% da herança'); assert.equal(l.multa, '');
  });
  assert.equal(d.totalImposto, moeda(inv.itc.total)); assert.equal(d.totalMulta, '');
});
test('cumulativo lista duas sucessões e os dois netos por representação sem repetir pré-morto como beneficiário', () => {
  const f = F.cumulativo(), dados = montar(f); assert.equal(dados.sucessoes.length, 2);
  dados.sucessoes.forEach((s, i) => {
    const orig = i ? f.ult.c.inv2 : f.ult.c.inv1;
    assert.equal(s.nome, orig.falecido.nome); assert.equal(s.titulo, (i + 1) + 'ª sucessão');
    const herdeiros = s.herdeiros.filter(h => !h.meacao); assert.equal(herdeiros.length, 8);
    assert.equal(herdeiros.filter(h => /Neta fictícia|Neto fictício/.test(h.nome)).length, 2);
    assert.ok(herdeiros.every(h => !/Filho pré-morto de teste/.test(h.nome)));
    for (const neto of herdeiros.filter(h => /Neta fictícia|Neto fictício/.test(h.nome))) { assert.match(neto.fracao, /^1\/14 /); assert.match(neto.percentual, /^7,1429% /); assert.match(neto.papel, /representação/); }
    assert.equal(s.totalImposto, moeda(orig.itc.total));
  });
});
test('frações por bem mantêm a base da parcela inventariada no segundo óbito', () => {
  const f = F.cumulativo(), s = montar(f).sucessoes[1], bem = s.bens[0];
  assert.match(bem.complemento, /R\$ 495\.000,00.*50,0000% de R\$ 990\.000,00/);
  assert.match(bem.complemento, /frações abaixo sobre a parcela inventariada/);
  const herdeiro = bem.linhas[0]; assert.equal(herdeiro.fracao, '1/7'); assert.equal(herdeiro.percentual, '14,2857%'); assert.equal(herdeiro.valor, 'R$ 70.714,29');
  const neto = bem.linhas.find(l => /Neta fictícia/.test(l.quem)); assert.equal(neto.fracao, '1/14'); assert.equal(neto.valor, 'R$ 35.357,14');
});
test('patrimônio misto não confunde fração dos bens particulares com fração dos comuns', () => {
  const f = F.misto(), d = montar(f).sucessoes[0];
  const alice = d.herdeiros.find(l => l.nome === 'Alice das Palmeiras');
  assert.equal(alice.fracao, '1/3 particulares\n1/2 comuns'); assert.equal(alice.percentual, '33,3333% particulares\n50,0000% comuns');
  assert.equal(alice.quinhao, 'R$ 225.000,00');
  assert.match(d.bens[0].complemento, /50,0000% de R\$ 1\.000\.000,00/);
  assert.equal(d.bens[0].linhas.find(l => l.quem === 'Alice das Palmeiras').fracao, '1/4');
  assert.equal(d.bens[0].linhas.find(l => l.quem === 'Alice das Palmeiras').valor, 'R$ 125.000,00');
});
test('partilha acordada traz quinhões reais e excedentes sem alterar imposto causa mortis', () => {
  const f = F.partilhaReal(), d = montar(f).sucessoes[0];
  assert.equal(d.partilhaReal.totalLegal, d.partilhaReal.totalReal); assert.equal(d.partilhaReal.totalExcedente, 'R$ 125.000,00');
  assert.equal(d.partilhaReal.linhas.find(l => l.nome === 'Alice das Palmeiras').real, 'R$ 375.000,00');
  assert.equal(d.herdeiros.find(l => l.nome === 'Alice das Palmeiras').quinhao, 'R$ 250.000,00');
  assert.equal(d.excedentes.linhas.length, 1); assert.equal(d.excedentes.linhas[0].base, 'R$ 125.000,00'); assert.equal(d.excedentes.total, moeda(f.ult.inv.exced.total));
});
test('doação discrimina donatários e valores individualizados respeitando destinatário do bem', () => {
  const f = F.doacao(), d = montar(f); assert.equal(d.titulo, 'Orçamento da doação');
  const s = d.sucessoes[0]; assert.equal(s.titulo, 'Doação'); assert.equal(s.herdeiros.length, 2);
  assert.equal(s.herdeiros[0].quinhao, 'R$ 400.000,00'); assert.equal(s.herdeiros[1].quinhao, 'R$ 300.000,00');
  f.ult.d.linhas.forEach((l, i) => assert.equal(s.herdeiros[i].imposto, moeda(l.imposto)));
});
test('alíquota composta distingue quotas e móveis sem apresentar faixa geral como taxa única', () => {
  const f = F.inventario(); f.s.inv[0].estadoCivil = 'solteiro';
  f.s.inv[0].bens = [{ descricao: 'Quotas fictícias', tipo: 'quotas', valor: 600000, natureza: 'particular', fracao: 100 }, { descricao: 'Imóvel fictício', tipo: 'imovel_urbano', valor: 600000, natureza: 'particular', fracao: 100 }];
  f.ult = F.calcular(f.s); const l = montar(f).sucessoes[0].herdeiros[0];
  assert.match(l.aliquota, /% geral\n2% quotas/); assert.equal(l.imposto, moeda(f.ult.inv.itc.linhas[0].imposto));
  const doa = F.doacao(); assert.match(montar(doa).sucessoes[0].herdeiros[0].aliquota, /% imóveis\n2% móveis/);
  f.s.inv[0].aliquotaManual = '6'; f.ult = F.calcular(f.s); assert.equal(montar(f).sucessoes[0].herdeiros[0].aliquota, '6,00%');
});
test('projeção de impressão não altera estado, cálculo ou frações usados para salvar', () => {
  for (const make of [F.inventario, F.cumulativo, F.misto, F.partilhaReal, F.doacao]) {
    const f = make(), antes = JSON.stringify(f); montar(f); montar(f, 'resumido'); assert.equal(JSON.stringify(f), antes);
  }
  assert.throws(() => D.montar({}), /Confira os dados/); assert.throws(() => montar(F.inventario(), 'qualquer'), /resumido ou discriminado/);
});
module.exports = { montar };

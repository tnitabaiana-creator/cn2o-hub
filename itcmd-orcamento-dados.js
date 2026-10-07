/* Projeção para os PDFs: usa exclusivamente o resultado do motor da calculadora. */
(function (root) {
  'use strict';
  const moeda = v => 'R$ ' + (Math.round((+v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const numero = (v, casas = 4) => (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const aliquota = l => {
    if (l.situacao !== 'tributado') return l.situacao || '—';
    // O motor expõe a faixa geral em aliq, mas pode compor o imposto de mais
    // de uma espécie de bem. Não apresente essa faixa como taxa única.
    const manual = /alíquota informada manualmente/.test(l.detalhe || '');
    if (!manual && l.parteQuotas > 0) {
      const taxaQuotas = /([\d.,]+)% sobre quotas/.exec(l.detalhe || '');
      if (taxaQuotas) return (l.baseTrib > l.parteQuotas ? numero(l.aliq * 100, 2) + '% geral\n' : '') + taxaQuotas[1] + '% quotas';
    }
    if (!manual && l.imoveis > 0 && l.moveis > 0) {
      const taxaMoveis = /([\d.,]+)% sobre bens móveis/.exec(l.detalhe || '');
      return taxaMoveis ? numero(l.aliq * 100, 2) + '% imóveis\n' + taxaMoveis[1] + '% móveis' : 'Composta';
    }
    return numero(l.aliq * 100, 2) + '%';
  };
  const texto = v => String(v == null ? '' : v);
  function fracaoHerdeiro(inv, linha) {
    const partes = [];
    if (inv.pat.herancaPart > 0 && inv.pat.herancaComum > 0 && linha.frPart.txt() !== linha.frComum.txt()) {
      if (!linha.frPart.zero()) partes.push({ fr: linha.frPart, base: 'particulares' });
      if (!linha.frComum.zero()) partes.push({ fr: linha.frComum, base: 'comuns' });
    } else partes.push({ fr: inv.pat.herancaPart > 0 ? linha.frPart : linha.frComum, base: 'da herança' });
    return {
      fracao: partes.map(p => p.fr.txt() + ' ' + p.base).join('\n'),
      percentual: partes.map(p => p.fr.pct(4) + ' ' + p.base).join('\n')
    };
  }
  function sucessao(inv, indice) {
    const p = inv.pat, it = inv.itc;
    const dados = {
      titulo: (indice + 1) + 'ª sucessão', nome: texto(inv.falecido.nome || 'Falecido(a)'),
      indicadores: [
        { rotulo: 'Monte-mor', valor: moeda(p.monteMor) },
        ...(p.dividas ? [{ rotulo: 'Dívidas', valor: moeda(p.dividas) }] : []),
        ...(p.meacao > 0 ? [{ rotulo: 'Meação', valor: moeda(p.meacao) }] : []),
        { rotulo: 'Herança', valor: moeda(p.heranca) },
        { rotulo: it.multaCabivel ? 'ITCMD e multa' : 'ITCMD', valor: moeda(it.totalGeral) }
      ],
      herdeiros: it.linhas.map(l => ({
        nome: texto(l.nome), papel: texto(l.papel), ...fracaoHerdeiro(inv, l),
        quinhao: moeda(l.quinhao), aliquota: aliquota(l), imposto: moeda(l.imposto), baseTributavel: moeda(l.baseTrib),
        multa: it.multaCabivel ? moeda(l.multa) : '', total: moeda(l.imposto + l.multa)
      })),
      bens: (inv.partilha || []).map(p => ({
        descricao: texto(p.bem.descricao),
        complemento: moeda(p.bem.valor) + (p.bem.fracao !== 100 ? ' (' + numero(p.bem.fracao) + '% de ' + moeda(p.bem.valorBem) + ')' : '') + ' · ' + (p.bem.comum ? 'bem comum' : 'bem particular') + (p.bem.fracao !== 100 ? ' · frações abaixo sobre a parcela inventariada' : '') + (inv.pat.dividas > 0 ? ' · valores brutos antes das dívidas' : ''),
        linhas: p.linhas.map(l => ({ quem: texto(l.quem), papel: texto(l.papel), fracao: l.fr.txt(), percentual: l.fr.pct(4), valor: moeda(l.valor) }))
      })),
      totalImposto: moeda(it.total), totalMulta: it.multaCabivel ? moeda(it.totalMulta) : '', totalGeral: moeda(it.totalGeral)
    };
    if (p.meacao > 0 && p.rg.temConjuge) dados.herdeiros.unshift({
      nome: texto(inv.falecido.conjuge.nome || 'Meeiro(a)'), papel: 'Meação — não integra a herança',
      fracao: p.rg.meacaoSobre === 'todos' ? '1/2 dos bens' : '1/2 dos comuns',
      percentual: p.rg.meacaoSobre === 'todos' ? '50,0000% dos bens' : '50,0000% dos comuns',
      quinhao: moeda(p.meacao), aliquota: 'não incide', imposto: moeda(0), multa: '', total: moeda(0), meacao: true
    });
    if (inv.real && inv.real.ativa) dados.partilhaReal = {
      linhas: inv.real.rows.map(l => ({ nome: texto(l.nome), papel: texto(l.papel), legal: moeda(l.legal), real: moeda(l.real), cede: moeda(l.cede), excedente: moeda(l.excedente),
        fracao: l.realFr ? l.realFr.txt() : '', percentual: l.realFr ? l.realFr.pct(4) : '' })),
      totalLegal: moeda(inv.real.totalLegal), totalReal: moeda(inv.real.totalReal), totalCede: moeda(inv.real.totalCede), totalExcedente: moeda(inv.real.totalExcedente)
    };
    if (inv.exced) dados.excedentes = {
      linhas: inv.exced.porBeneficiario.map(l => ({ nome: texto(l.nome), base: moeda(l.base), aliquota: aliquota(l), imposto: moeda(l.imposto) })), total: moeda(inv.exced.total)
    };
    return dados;
  }
  function doacao(d, estado) {
    return {
      titulo: 'Doação', nome: (estado.doa.doadores || []).map(p => p.nome).filter(Boolean).join(' e '),
      indicadores: [{ rotulo: 'Valor doado', valor: moeda(d.valorTotal) }, { rotulo: 'Donatários', valor: String(d.linhas.length) }, { rotulo: 'ITCMD', valor: moeda(d.total) }],
      herdeiros: d.linhas.map(l => ({ nome: texto(l.nome), papel: texto(l.papel), fracao: '—', percentual: '—', quinhao: moeda(l.quinhao), aliquota: aliquota(l), imposto: moeda(l.imposto), multa: '', total: moeda(l.imposto) })),
      bens: [], totalImposto: moeda(d.total), totalMulta: '', totalGeral: moeda(d.total)
    };
  }
  function montar(op) {
    const { estado, resultado } = op;
    if (!estado || !resultado) throw new Error('Confira os dados antes de gerar o orçamento.');
    const versao = op.versao || 'resumido';
    if (!['resumido', 'discriminado'].includes(versao)) throw new Error('Escolha orçamento resumido ou discriminado.');
    const identificacao = op.identificacao || {};
    const padrao = resultado.modo === 'doacao' ? (estado.doa.doadores || []).map(p => p.nome).filter(Boolean).join(' e ') : (estado.inv || []).slice(0, resultado.modo === 'cumulativo' ? 2 : 1).map(p => p.nome).filter(Boolean).join(' e ');
    return {
      versao, logo: op.logo || null,
      titulo: resultado.modo === 'doacao' ? 'Orçamento da doação' : resultado.modo === 'cumulativo' ? 'Orçamento do inventário cumulativo' : 'Orçamento do inventário',
      identificacao: texto(identificacao.titulo || padrao), protocolo: texto(identificacao.protocolo), referencia: texto(op.referencia),
      linhas: (op.linhas || []).map(l => ({ rotulo: texto(l.rotulo), valor: texto(l.valor), subtotal: !!l.subtotal, total: !!l.total })),
      sucessoes: versao === 'resumido' ? [] : resultado.modo === 'doacao' ? [doacao(resultado.d, estado)] : (resultado.modo === 'cumulativo' ? [resultado.c.inv1, resultado.c.inv2] : [resultado.inv]).map(sucessao)
    };
  }
  const api = { montar };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.ITCMDOrcamentoDados = api;
})(typeof window === 'object' ? window : globalThis);

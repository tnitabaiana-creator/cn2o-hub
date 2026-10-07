/* ============================================================
   Motor de cálculo — ITCMD/SE (inventário, inventário cumulativo, doação)
   Base legal: Lei estadual nº 7.724/2013 (redação vigente, Lei 9.297/2023 e
   Lei 9.774/2025), Decreto 29.994/2015 (RITCMD) e Código Civil (arts. 1.784 a 1.856).
   Emolumentos: Tabela TJSE 2026 (Lei 8.639/2019 atualizada), lida do sistema de
   guias do TJSE em 25/09/2026, item "Escritura de Inventário - Com Bens" /
   "Escritura com conteúdo financeiro, com base no valor declarado".
   Sem dependências. Frações exatas para a partilha ideal.
   ============================================================ */
(function (raiz) {
  'use strict';

  /* ---------- Frações exatas ---------- */
  function mdc(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
  class Fr {
    constructor(n, d = 1) {
      if (d === 0) throw new Error('denominador zero');
      if (d < 0) { n = -n; d = -d; }
      const g = mdc(n, d); this.n = n / g; this.d = d / g;
    }
    static de(x) { return x instanceof Fr ? x : new Fr(x, 1); }
    mais(o) { o = Fr.de(o); return new Fr(this.n * o.d + o.n * this.d, this.d * o.d); }
    menos(o) { o = Fr.de(o); return new Fr(this.n * o.d - o.n * this.d, this.d * o.d); }
    vezes(o) { o = Fr.de(o); return new Fr(this.n * o.n, this.d * o.d); }
    div(o) { o = Fr.de(o); return new Fr(this.n * o.d, this.d * o.n); }
    max(o) { o = Fr.de(o); return this.num() >= o.num() ? this : o; }
    zero() { return this.n === 0; }
    num() { return this.n / this.d; }
    txt() { return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`; }
    pct(c = 4) { return (this.num() * 100).toFixed(c).replace('.', ',') + '%'; }
  }
  const ZERO = new Fr(0), UM = new Fr(1), MEIO = new Fr(1, 2);

  /* ---------- Parâmetros legais (vigentes) ---------- */
  const LEGAL = {
    ufpPadrao: { valor: 86.25, mes: 'setembro/2026', fonte: 'Portaria SEFAZ nº 296/2026' },
    ufpProximo: { valor: 87.19, mes: 'outubro/2026', vigencia: '2026-10-01', fonte: 'Portaria SEFAZ nº 311/2026' },
    isencaoUfp: 500,             // art. 8º, IV — por beneficiário
    isencaoUnicoImovelUfp: 2600, // art. 8º, VI — único imóvel do espólio
    faixasCausaMortis: [        // art. 14, I — sobre o valor do quinhão (não escalonado)
      { ate: 2417, aliq: 0.03 }, { ate: 12086, aliq: 0.06 }, { ate: Infinity, aliq: 0.08 }
    ],
    aliqQuotasCausaMortis: 0.02, // art. 14, I-A
    faixasDoacaoImoveis: [      // art. 14, II
      { ate: 6900, aliq: 0.02 }, { ate: 12086, aliq: 0.04 }, { ate: 27248, aliq: 0.06 }, { ate: Infinity, aliq: 0.08 }
    ],
    aliqDoacaoMoveis: 0.02,      // art. 14, III-A
    multaAberturaTardia: 0.20,   // art. 27, I — inventário não requerido em 120 dias (art. 18-B, II)
    prazoAberturaDias: 120,
    baseDireitoReal: 0.5         // art. 13 — instituição de direitos reais (usufruto etc.)
  };

  /* ---------- Emolumentos TJSE 2026 (Tabelionato de Notas) ---------- */
  const EMOL = {
    ano: 2026,
    ferd: 0.20,                       // FERD = 20% do emolumento da faixa
    adicionalPessoa: 4.77,            // por herdeiro/outorgante/outorgado a partir do 11º
    inventarioSemBens: 249.06,
    atoAcessorio: 0.5,                // ato acessório = metade da faixa
    faixa(valor) {                    // Escritura com valor declarado — ato principal
      const v = Math.max(0, +valor || 0);
      if (v < 6000) return 303.09;
      if (v < 13000) return 513.01;
      if (v <= 25000) return 708.46;
      if (v <= 1085000) return arred(708.46 + 47.06 * Math.ceil((v - 25000) / 5000));
      if (v <= 1200000) return arred(10685.18 + 18.70 * Math.ceil((v - 1085000) / 5000));
      if (v <= 2000000) return arred(11115.28 + 18.70 * Math.ceil((v - 1200000) / 100000));
      return 11264.88;
    }
  };
  function arred(x) { return Math.round(x * 100) / 100; }

  /* ---------- Utilidades ---------- */
  function diasEntre(a, b) { return Math.floor((b - a) / 86400000); }
  function ufpVigente(dataISO) {
    const d = dataISO ? new Date(dataISO + 'T12:00:00') : new Date();
    return d >= new Date(LEGAL.ufpProximo.vigencia + 'T00:00:00') ? LEGAL.ufpProximo : LEGAL.ufpPadrao;
  }

  /* ---------- Regime de bens → meação e concorrência ----------
     Retorna { meacaoSobre: 'comuns'|'todos'|'nenhum', concorreDesc: 'nada'|'particulares'|'tudo' }
     art. 1.829, I, CC; STJ REsp 1.368.123 (parcial: só bens particulares);
     STJ REsp 1.382.170 (separação convencional: concorre); Súmula 377/STF. */
  function regras(f) {
    const temConjuge = !!(f.conjuge && f.conjuge.nome !== undefined && f.estadoCivil !== 'solteiro');
    const r = { temConjuge, meacaoSobre: 'nenhum', concorreDesc: 'nada', concorreAsc: temConjuge, herdaSozinho: temConjuge };
    if (!temConjuge) return r;
    const c = f.conjuge || {};
    const afastado = !!c.separadoFato; // art. 1.830 — separado de fato há mais de 2 anos / judicialmente
    switch (f.regime) {
      case 'universal': r.meacaoSobre = 'todos'; r.concorreDesc = 'nada'; break;
      case 'parcial': r.meacaoSobre = 'comuns'; r.concorreDesc = 'particulares'; break;
      case 'aquestos': r.meacaoSobre = 'comuns'; r.concorreDesc = 'tudo'; break;
      case 'separacao_conv': r.meacaoSobre = 'nenhum'; r.concorreDesc = 'tudo'; break;
      case 'separacao_obrig': r.meacaoSobre = c.sumula377 ? 'comuns' : 'nenhum'; r.concorreDesc = 'nada'; break;
      default: r.meacaoSobre = 'comuns'; r.concorreDesc = 'particulares';
    }
    if (afastado) { r.concorreDesc = 'nada'; r.concorreAsc = false; r.herdaSozinho = false; }
    return r;
  }

  /* ---------- Patrimônio: meação e herança ---------- */
  function patrimonio(f) {
    const rg = regras(f);
    const bens = (f.bens || []).map((b, i) => {
      const fracao = (b.fracao === '' || b.fracao == null) ? 100 : +b.fracao;
      const valor = arred((+b.valor || 0) * (fracao / 100));
      let comum;
      if (rg.meacaoSobre === 'todos') comum = !b.incomunicavel;
      else if (rg.meacaoSobre === 'comuns') comum = b.natureza !== 'particular';
      else comum = false;
      return { i, origem: b.origem, descricao: b.descricao || `Bem ${i + 1}`, tipo: b.tipo || 'imovel_urbano', valorBem: +b.valor || 0, fracao, valor, comum,
               matricula: b.matricula || '', inscricao: b.inscricao || '',   // v1.43 (M2): seguem para a Declaração, inclusive nos bens herdados do cumulativo
               meacaoFr: comum ? MEIO : ZERO, herancaFr: comum ? MEIO : UM };
    });
    const totalComum = arred(bens.filter(b => b.comum).reduce((s, b) => s + b.valor, 0));
    const totalParticular = arred(bens.filter(b => !b.comum).reduce((s, b) => s + b.valor, 0));
    const monteMor = arred(totalComum + totalParticular);
    const dividas = arred(+f.dividas || 0);
    // Dívidas abatem primeiro o patrimônio comum (o meeiro suporta metade), depois os particulares.
    const divComum = Math.min(dividas, totalComum);
    const divPart = Math.min(Math.max(0, dividas - divComum), totalParticular);
    const comumLiq = arred(totalComum - divComum);
    const partLiq = arred(totalParticular - divPart);
    const meacao = rg.temConjuge ? arred(comumLiq / 2) : 0;
    const herancaComum = arred(comumLiq - meacao);   // metade dos comuns (ou tudo, sem cônjuge)
    const herancaPart = partLiq;
    const heranca = arred(herancaComum + herancaPart);
    return { rg, bens, totalComum, totalParticular, monteMor, dividas, comumLiq, partLiq, meacao, herancaComum, herancaPart, heranca };
  }

  /* ---------- Sucessão legítima: quinhões em frações da herança ----------
     Devolve lista de beneficiários: { id, nome, papel, viaRepresentacao, fr (fração da herança total),
     frPart, frComum (frações sobre as parcelas particular e comum, quando o cônjuge concorre só sobre particulares) } */
  function sucessaoBruta(f, pat) {
    const rg = pat.rg;
    const avisos = [];
    const temNome = x => (x && (x.nome || '').trim() !== '');
    const desc = (f.descendentes || []).filter(d => temNome(d) || (d.condicao === 'premorto' && (d.representantes || []).some(temNome)));
    const todosRenunciam = desc.length > 0 && desc.every(d => d.condicao === 'renuncia');
    if (todosRenunciam) avisos.push('Todos os filhos renunciaram: se tiverem filhos, estes herdam por cabeça (art. 1.811 CC) — cadastre os netos como herdeiros vivos. Sem netos, a herança passa à classe seguinte.');
    // Estirpes válidas: filho vivo (não renunciante) ou premorto com representantes
    const estirpes = [];
    desc.forEach((d, i) => {
      if (d.condicao === 'renuncia') { avisos.push(`${d.nome || 'Herdeiro ' + (i + 1)}: renúncia pura e simples — não incide ITCMD (art. 7º, II); a parte acresce aos demais da classe (art. 1.810 CC).`); return; }
      if (d.condicao === 'premorto') {
        const reps = (d.representantes || []).filter(r => (r.nome || '').trim() !== '');
        if (!reps.length) { avisos.push(`${d.nome || 'Herdeiro ' + (i + 1)}: premorto sem representantes informados — estirpe desconsiderada.`); return; }
        estirpes.push({ cabeca: d, reps });
        return;
      }
      estirpes.push({ cabeca: d, reps: null });
    });

    const benef = [];
    const conj = f.conjuge || {};
    if (rg.temConjuge && !(conj.nome || '').trim()) avisos.push('Estado civil "casado/união estável" sem o nome do sobrevivente: informe o nome ou mude o estado civil, senão a meação/concorrência fica atribuída a "Cônjuge sobrevivente".');
    const nomeConj = conj.nome || (f.estadoCivil === 'uniao' ? 'Companheiro(a) sobrevivente' : 'Cônjuge sobrevivente');
    const papelConj = f.estadoCivil === 'uniao' ? 'companheiro(a)' : 'cônjuge';

    if (estirpes.length) {
      // ---- Classe I: descendentes (+ cônjuge concorrente, art. 1.829, I) ----
      const n = estirpes.length;
      let qConj = ZERO;                    // quota do cônjuge sobre a base em que concorre
      let base = rg.concorreDesc;          // 'nada' | 'particulares' | 'tudo'
      if (base === 'particulares' && pat.herancaPart <= 0) { base = 'nada'; if (rg.temConjuge && !conj.separadoFato) avisos.push('Comunhão parcial sem bens particulares: o cônjuge/companheiro só tem meação; não concorre com os descendentes (art. 1.829, I, CC; REsp 1.368.123/STJ).'); }
      if (base !== 'nada') {
        qConj = new Fr(1, n + 1);
        if (f.filhosComuns === 'sim') qConj = qConj.max(new Fr(1, 4)); // art. 1.832 — reserva da quarta parte
        else if (f.filhosComuns === 'nao') avisos.push('Filiação híbrida ou exclusiva do falecido: sem reserva da quarta parte ao cônjuge (art. 1.832 CC; REsp 1.617.650/STJ).');
      }
      // Frações sobre a herança total, separando parcela particular e comum
      const hp = pat.herancaPart, hc = pat.herancaComum, h = pat.heranca;
      const pesoPart = h > 0 ? hp / h : 0, pesoComum = h > 0 ? hc / h : 0;
      // parte dos descendentes em cada parcela
      const descPart = base === 'nada' ? UM : UM.menos(qConj);          // sobre particulares
      const descComum = base === 'tudo' ? UM.menos(qConj) : UM;         // sobre comuns
      const conjPart = base === 'nada' ? ZERO : qConj;
      const conjComum = base === 'tudo' ? qConj : ZERO;
      if (!conjPart.zero() || !conjComum.zero()) {
        benef.push({ id: 'conj', nome: nomeConj, papel: papelConj + ' (concorrente)', frPart: conjPart, frComum: conjComum, valor: arred(conjPart.num() * hp + conjComum.num() * hc) });
      }
      estirpes.forEach((e, k) => {
        const ePart = descPart.div(n), eComum = descComum.div(n);
        if (e.reps) {
          const m = e.reps.length;
          e.reps.forEach((r, j) => benef.push({ id: r.uid || `d${k}r${j}`, nome: r.nome, papel: `neto(a) — por representação de ${e.cabeca.nome || 'herdeiro premorto'}`, viaRepresentacao: true, frPart: ePart.div(m), frComum: eComum.div(m), valor: arred(ePart.num() / m * hp + eComum.num() / m * hc) }));
        } else {
          benef.push({ id: e.cabeca.uid || `d${k}`, nome: e.cabeca.nome || `Herdeiro ${k + 1}`, papel: e.cabeca.papel || 'filho(a)', frPart: ePart, frComum: eComum, valor: arred(ePart.num() * hp + eComum.num() * hc) });
        }
      });
      void pesoPart; void pesoComum;
      return { classe: 'descendentes', benef, avisos, qConj, base };
    }

    // ---- Classe II: ascendentes (+ cônjuge, art. 1.837) ----
    const asc = f.ascendentes || {};
    const paiVivo = !!asc.paiVivo, maeViva = !!asc.maeViva;
    const avosP = paiVivo ? 0 : (+asc.avosPaternos || 0), avosM = maeViva ? 0 : (+asc.avosMaternos || 0);
    const temAsc = paiVivo || maeViva || avosP > 0 || avosM > 0;
    if (temAsc) {
      let qConj = ZERO;
      if (rg.concorreAsc) qConj = (paiVivo && maeViva) ? new Fr(1, 3) : MEIO;
      const resto = UM.menos(qConj);
      if (!qConj.zero()) benef.push({ id: 'conj', nome: nomeConj, papel: papelConj + ' (concorrente com ascendentes)', frPart: qConj, frComum: qConj, valor: arred(qConj.num() * pat.heranca) });
      const add = (id, nome, papel, fr) => benef.push({ id, nome, papel, frPart: fr, frComum: fr, valor: arred(fr.num() * pat.heranca) });
      if (paiVivo && maeViva) { add('pai', asc.pai || 'Pai', 'pai', resto.div(2)); add('mae', asc.mae || 'Mãe', 'mãe', resto.div(2)); }
      else if (paiVivo || maeViva) {
        // art. 1.836, §1º: o mais próximo exclui o mais remoto — o genitor vivo herda a parte toda dos ascendentes
        if (paiVivo) add('pai', asc.pai || 'Pai', 'pai', resto); else add('mae', asc.mae || 'Mãe', 'mãe', resto);
      } else {
        // avós: metade por linha quando as duas linhas existem (art. 1.836, §2º)
        const linhas = (avosP > 0 ? 1 : 0) + (avosM > 0 ? 1 : 0);
        const porLinha = resto.div(linhas);
        for (let i = 0; i < avosP; i++) add(`avP${i}`, (asc.nomesAvosPaternos || [])[i] || `Avô/avó paterno(a) ${i + 1}`, 'ascendente de 2º grau (linha paterna)', porLinha.div(avosP));
        for (let i = 0; i < avosM; i++) add(`avM${i}`, (asc.nomesAvosMaternos || [])[i] || `Avô/avó materno(a) ${i + 1}`, 'ascendente de 2º grau (linha materna)', porLinha.div(avosM));
      }
      return { classe: 'ascendentes', benef, avisos, qConj };
    }

    // ---- Classe III: cônjuge sozinho ----
    if (rg.temConjuge && rg.herdaSozinho) {
      benef.push({ id: 'conj', nome: nomeConj, papel: papelConj + ' (herdeiro único — art. 1.829, III)', frPart: UM, frComum: UM, valor: pat.heranca });
      return { classe: 'conjuge', benef, avisos };
    }

    // ---- Classe IV: colaterais até o 4º grau ----
    const col = (f.colaterais || []).filter(c => (c.nome || '').trim() !== '');
    const irmaos = col.filter(c => c.grau === 'irmao');
    const validos = irmaos.filter(c => c.condicao !== 'renuncia' && !(c.condicao === 'premorto' && !(c.representantes || []).some(r => (r.nome || '').trim())));
    const algumIrmaoVivo = validos.some(c => c.condicao !== 'premorto');
    if (validos.length && !algumIrmaoVivo) {
      // art. 1.843, §1º: só sobrinhos → por cabeça; §2º: filhos de bilaterais herdam o dobro dos de unilaterais
      const cabecas = [];
      validos.forEach((c, k) => (c.representantes || []).filter(r => (r.nome || '').trim()).forEach((r, j) => cabecas.push({ id: r.uid || `c${k}r${j}`, nome: r.nome, peso: c.tipo === 'unilateral' ? 1 : 2, de: c.nome })));
      const soma = cabecas.reduce((a, b) => a + b.peso, 0);
      cabecas.forEach(x => { const fr = new Fr(x.peso, soma); benef.push({ id: x.id, nome: x.nome, papel: `sobrinho(a) — por cabeça (art. 1.843, §1º), filho(a) de ${x.de}`, frPart: fr, frComum: fr, valor: arred(fr.num() * pat.heranca) }); });
      avisos.push('Sem irmãos vivos, os sobrinhos herdam por cabeça (art. 1.843, §1º CC)' + (cabecas.some(x => x.peso === 1) && cabecas.some(x => x.peso === 2) ? '; filhos de irmãos bilaterais recebem o dobro dos filhos de unilaterais (§2º).' : '.'));
      return { classe: 'colaterais', benef, avisos };
    }
    if (validos.length) {
      // art. 1.841: bilateral = 2 partes; unilateral = 1 parte. Sobrinhos representam (art. 1.840).
      const pesos = validos.map(c => c.tipo === 'unilateral' ? 1 : 2);
      const soma = pesos.reduce((a, b) => a + b, 0);
      validos.forEach((c, k) => {
        const fr = new Fr(pesos[k], soma);
        if (c.condicao === 'premorto') {
          const reps = (c.representantes || []).filter(r => (r.nome || '').trim());
          reps.forEach((r, j) => benef.push({ id: r.uid || `c${k}r${j}`, nome: r.nome, papel: `sobrinho(a) — por representação de ${c.nome}`, viaRepresentacao: true, frPart: fr.div(reps.length), frComum: fr.div(reps.length), valor: arred(fr.num() / reps.length * pat.heranca) }));
        } else benef.push({ id: c.uid || `c${k}`, nome: c.nome, papel: c.tipo === 'unilateral' ? 'irmão(ã) unilateral' : 'irmão(ã) bilateral', frPart: fr, frComum: fr, valor: arred(fr.num() * pat.heranca) });
      });
      if (irmaos.some(c => c.tipo === 'unilateral') && irmaos.some(c => c.tipo !== 'unilateral')) avisos.push('Irmãos bilaterais herdam o dobro dos unilaterais (art. 1.841 CC).');
      return { classe: 'colaterais', benef, avisos };
    }
    // art. 1.843, caput: sem irmãos, sobrinhos; sem sobrinhos, tios; art. 1.840: 3º grau exclui o 4º
    for (const [grau, papel] of [['sobrinho', 'sobrinho(a) (por cabeça)'], ['tio', 'tio(a)'], ['primo', 'colateral de 4º grau']]) {
      const outros = col.filter(c => c.grau === grau && c.condicao !== 'renuncia');
      if (!outros.length) continue;
      outros.forEach((c, k) => benef.push({ id: c.uid || `o${k}`, nome: c.nome, papel, frPart: new Fr(1, outros.length), frComum: new Fr(1, outros.length), valor: arred(pat.heranca / outros.length) }));
      const excluidos = col.filter(c => c.grau !== 'irmao' && c.grau !== grau && c.condicao !== 'renuncia');
      avisos.push(`Colaterais: herdam os de grau mais próximo, por cabeça (arts. 1.840 e 1.843 CC)${excluidos.length ? ` — excluídos: ${excluidos.map(c => c.nome).join(', ')}` : ''}.`);
      return { classe: 'colaterais', benef, avisos };
    }
    avisos.push('Nenhum herdeiro informado: herança jacente/vacante (arts. 1.819 a 1.823 CC) — não incide ITCMD em favor do Município (art. 6º, I).');
    return { classe: 'vacante', benef, avisos };
  }

  // v1.43 — fechamento de centavos: os quinhões arredondados um a um podem somar alguns
  // centavos a menos (ou a mais) do que a herança (ex.: 6 × 71.357,14 + 2 × 35.678,57 = 499.499,98
  // para 499.500,00). A SEFAZ confere a soma da coluna "Quinhão Legal" com o monte partível, então
  // os centavos residuais vão para os quinhões de maior resto (método dos maiores restos), sem
  // mexer nas frações. As frações exatas continuam sendo a verdade; o valor em reais é apresentação.
  function sucessao(f, pat) {
    const r = sucessaoBruta(f, pat);
    const benef = r.benef || [];
    if (benef.length) {
      const hp = pat.herancaPart, hc = pat.herancaComum;
      const exatos = benef.map(b => b.frPart.num() * hp + b.frComum.num() * hc);
      const somaFr = exatos.reduce((s, v) => s + v, 0);
      if (Math.abs(somaFr - pat.heranca) < 0.005) {
        let residuo = Math.round((pat.heranca - benef.reduce((s, b) => s + b.valor, 0)) * 100);
        if (residuo !== 0 && Math.abs(residuo) <= benef.length) {
          const ordem = benef.map((b, i) => ({ i, resto: exatos[i] * 100 - Math.floor(exatos[i] * 100) })).sort((a, b) => (residuo > 0 ? b.resto - a.resto : a.resto - b.resto) || (b.i - a.i)); // empate: os últimos quinhões absorvem o centavo (como na conta da SEFAZ)
          for (let k = 0; residuo !== 0 && k < ordem.length; k++) {
            const b = benef[ordem[k].i]; const passo = residuo > 0 ? 1 : -1;
            b.valor = arred(b.valor + passo / 100); b.ajusteCentavos = (b.ajusteCentavos || 0) + passo; residuo -= passo;
          }
        }
      }
    }
    return r;
  }

  /* ---------- ITCMD causa mortis por beneficiário ---------- */
  function faixa(faixas, ufps) { for (const fx of faixas) if (ufps <= fx.ate) return fx.aliq; return faixas[faixas.length - 1].aliq; }

  function itcmdCausaMortis(f, pat, suc, opts) {
    const ufp = +opts.ufp || LEGAL.ufpPadrao.valor;
    const hoje = opts.hoje ? new Date(opts.hoje + 'T12:00:00') : new Date();
    const obito = f.obito ? new Date(f.obito + 'T12:00:00') : null;
    const dias = obito ? diasEntre(obito, hoje) : null;
    const multaCabivel = dias !== null && dias > LEGAL.prazoAberturaDias && f.multaAtraso !== false && opts.desconsiderarMulta !== true;
    // valor efetivamente recebido por beneficiário em cada bem (usa as frações da partilha)
    const parcela = (b, filtro) => pat.bens.filter(filtro).reduce((s, bm) => s + bm.valor * (bm.comum ? bm.herancaFr.vezes(b.frComum) : bm.herancaFr.vezes(b.frPart)).num(), 0);
    const imoveis = pat.bens.filter(b => b.tipo === 'imovel_urbano' || b.tipo === 'imovel_rural');
    const unicoImovelOk = f.isencaoUnicoImovel && imoveis.length === 1 && imoveis[0].valor / ufp <= LEGAL.isencaoUnicoImovelUfp;
    const avisosItc = [];
    if (f.isencaoUnicoImovel && !unicoImovelOk) avisosItc.push(imoveis.length !== 1 ? `Isenção do art. 8º, VI exige que o imóvel seja o único bem imóvel do espólio (há ${imoveis.length}).` : `Isenção do art. 8º, VI exige imóvel de até ${LEGAL.isencaoUnicoImovelUfp} UFP/SE (${fmtBRL(LEGAL.isencaoUnicoImovelUfp * ufp)}); o imóvel vale ${fmtBRL(imoveis[0].valor)}.`);
    let total = 0, totalMulta = 0;
    const linhas = suc.benef.map(b => {
      const quinhao = b.valor;
      const ufps = quinhao / ufp;
      const isentoVI = !!(unicoImovelOk && f.isentosVI && f.isentosVI[b.id]);
      const parteQuotas = arred(Math.min(quinhao, parcela(b, x => x.tipo === 'quotas')));
      const parteImovel = arred(Math.min(quinhao, parcela(b, x => x.tipo === 'imovel_urbano' || x.tipo === 'imovel_rural')));
      let situacao, aliq = 0, imposto = 0, detalhe = '';
      if (quinhao <= 0) { situacao = 'sem valor'; }
      else if (ufps <= LEGAL.isencaoUfp) { situacao = 'isento'; detalhe = `≤ ${LEGAL.isencaoUfp} UFP/SE (art. 8º, IV)`; }
      else {
        const baseTrib = isentoVI ? arred(quinhao - parteImovel) : quinhao; // art. 8º, VI alcança só o imóvel
        if (isentoVI && baseTrib <= 0) { situacao = 'isento'; detalhe = 'art. 8º, VI — único imóvel (depende de reconhecimento prévio pela SEFAZ, Decreto art. 9º)'; }
        else if (isentoVI && baseTrib / ufp <= LEGAL.isencaoUfp) { situacao = 'isento'; detalhe = `imóvel isento (art. 8º, VI) e o restante ≤ ${LEGAL.isencaoUfp} UFP (art. 8º, IV)`; }
        else {
          situacao = 'tributado';
          if (f.aliquotaManual != null && f.aliquotaManual !== '') { aliq = (+f.aliquotaManual) / 100; imposto = arred(baseTrib * aliq); detalhe = 'alíquota informada manualmente' + (isentoVI ? ' sobre o que excede o imóvel isento' : ''); }
          else {
            const aliqGeral = faixa(LEGAL.faixasCausaMortis, isentoVI ? baseTrib / ufp : ufps); // faixa aferida pelo quinhão total (ou pelo que resta, se o imóvel é isento)
            const quotas = Math.min(parteQuotas, baseTrib), geral = arred(baseTrib - quotas);
            imposto = arred(geral * aliqGeral + quotas * LEGAL.aliqQuotasCausaMortis);
            aliq = aliqGeral;
            detalhe = quotas > 0 ? `${(aliqGeral * 100).toFixed(0)}% sobre ${fmtBRL(geral)} + 2% sobre quotas ${fmtBRL(quotas)}` : `faixa ${fmtFaixa(ufps)} → ${(aliqGeral * 100).toFixed(0)}% sobre o quinhão${isentoVI ? ' (menos o imóvel isento)' : ''}`;
          }
        }
      }
      const multa = multaCabivel ? arred(imposto * LEGAL.multaAberturaTardia) : 0;
      total += imposto; totalMulta += multa;
      return { ...b, quinhao, ufps: arred(ufps), situacao, aliq, imposto, multa, detalhe, parteQuotas, parteImovel, baseTrib: situacao === 'tributado' ? (isentoVI ? arred(quinhao - parteImovel) : quinhao) : 0 };
    });
    return { ufp, dias, multaCabivel, linhas, total: arred(total), totalMulta: arred(totalMulta), totalGeral: arred(total + totalMulta), avisos: avisosItc, unicoImovelOk };
  }
  function fmtBRL(v) { return 'R$ ' + (Math.round((+v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtFaixa(ufps) {
    if (ufps <= 2417) return '500–2.417 UFP';
    if (ufps <= 12086) return '2.417–12.086 UFP';
    return '> 12.086 UFP';
  }

  /* ---------- Emolumentos ---------- */
  /* ---------- v1.43 — Partilha acordada (real) × legal: excedente de meação/quinhão ----------
     Manual SEFAZ Causa Mortis, item 8: uma linha por meeiro/herdeiro com o quinhão REAL (o que a
     pessoa recebe na partilha acordada), o quinhão LEGAL (Código Civil) e o EXCEDENTE (real − legal,
     quando positivo). O excedente decorrente de transmissão não onerosa (cessão gratuita, partilha
     desigual) é doação: recolhe-se o ITCMD "inter vivos" e preenche-se a DECLARAÇÃO INTER VIVOS I
     (nota do item 8; Lei 7.724/2013, art. 2º §2º e art. 4º V e §§1º–2º). O imposto causa mortis
     continua sendo apurado sobre o quinhão LEGAL de cada herdeiro (item 10). */
  function linhasPartilha(inv) {
    const pat = inv.pat, f = inv.falecido;
    const linhas = [];
    if (pat.rg.temConjuge && pat.meacao > 0) linhas.push({ id: 'meacao', nome: (f.conjuge && f.conjuge.nome) || 'Meeiro(a)', papel: 'meação', legal: pat.meacao, fr: null, meacao: true });
    inv.suc.benef.forEach(b => linhas.push({ id: b.id, nome: b.nome, papel: b.papel, legal: b.valor, frPart: b.frPart, frComum: b.frComum, meacao: false }));
    return linhas;
  }
  // pr = { ativa, natureza: 'nao_onerosa'|'onerosa', reais: { id: valor em R$ } }
  function partilhaReal(inv, pr) {
    const base = linhasPartilha(inv);
    const ativa = !!(pr && pr.ativa);
    const reais = (pr && pr.reais) || {};
    const rows = base.map(l => {
      const real = ativa && reais[l.id] != null && reais[l.id] !== '' ? arred(+reais[l.id] || 0) : l.legal;
      return { ...l, real, excedente: arred(Math.max(real - l.legal, 0)), cede: arred(Math.max(l.legal - real, 0)) };
    });
    const totalLegal = arred(rows.reduce((s, r) => s + r.legal, 0));
    const totalReal = arred(rows.reduce((s, r) => s + r.real, 0));
    const totalExcedente = arred(rows.reduce((s, r) => s + r.excedente, 0));
    const totalCede = arred(rows.reduce((s, r) => s + r.cede, 0));
    const diferenca = arred(totalReal - totalLegal);
    const beneficiarios = rows.filter(r => r.excedente > 0), cedentes = rows.filter(r => r.cede > 0);
    const avisos = [];
    if (ativa && Math.abs(diferenca) >= 0.01) avisos.push(`A partilha acordada não fecha: a soma dos quinhões reais (${fmtBRL(totalReal)}) difere do total legal (${fmtBRL(totalLegal)}) em ${fmtBRL(diferenca)}. Ajuste os valores até a diferença ser zero.`);
    if (ativa && totalExcedente > 0 && pr.natureza !== 'onerosa') avisos.push(`Excedente de ${fmtBRL(totalExcedente)} em favor de ${beneficiarios.map(b => b.nome).join(', ')} por transmissão não onerosa: recolher o ITCMD "inter vivos" e apresentar a DECLARAÇÃO INTER VIVOS I (Manual Causa Mortis, item 8, nota; relação documental, item 33). O imposto causa mortis continua sobre os quinhões legais.`);
    if (ativa && totalExcedente > 0 && pr.natureza === 'onerosa') avisos.push(`Excedente de ${fmtBRL(totalExcedente)} por cessão ONEROSA: não incide ITCMD doação; sobre imóveis incide ITBI municipal (apresentar a escritura de cessão e a guia de ITBI — relação documental, item 30). Fora do cálculo desta ferramenta.`);
    // taxa uniforme de cessão (quando todos os cedentes cedem a mesma fração do próprio quinhão)
    let taxaUniforme = null;
    if (cedentes.length) {
      const taxas = cedentes.map(c => c.cede / c.legal);
      if (Math.max(...taxas) - Math.min(...taxas) < 0.0005) taxaUniforme = taxas[0];
    }
    // frações exatas (quando a cessão foi aplicada por fração exata e a fração de cada herdeiro é
    // uma só sobre a herança): cedeFr = fr × taxa; o beneficiário recebe a soma; realFr = fr ∓ …
    const taxaFr = pr && pr.taxaFr instanceof Fr ? pr.taxaFr : null;
    // frações "exatas" só valem enquanto a aritmética em inteiros é segura (denominadores grandes estouram 2^53):
    // cada fração é conferida contra o valor em ponto flutuante; divergindo, sai só o valor em reais
    const frSegura = (x, esperado) => x && Number.isSafeInteger(x.n) && Number.isSafeInteger(x.d) && Math.abs(x.num() - esperado) < 1e-9;
    if (taxaFr && taxaUniforme != null && ativa && frSegura(taxaFr, taxaFr.n / taxaFr.d)) {
      const frDe = r => r.meacao ? null : ((inv.pat.herancaPart > 0 && inv.pat.herancaComum > 0 && r.frPart.txt() !== r.frComum.txt()) ? null : (inv.pat.herancaPart > 0 ? r.frPart : r.frComum));
      let ok = true, somaCede = ZERO;
      let somaEsp = 0;
      rows.forEach(r => { const fr = frDe(r); if (r.cede > 0) { if (!fr) { ok = false; return; } const esp = fr.num() * taxaFr.num(); r.cedeFr = fr.vezes(taxaFr); r.realFr = fr.menos(r.cedeFr); somaCede = somaCede.mais(r.cedeFr); somaEsp += esp; if (!frSegura(r.cedeFr, esp) || !frSegura(r.realFr, fr.num() - esp) || !frSegura(somaCede, somaEsp)) ok = false; } });
      if (!ok) rows.forEach(r => { delete r.cedeFr; delete r.realFr; });   // denominadores grandes demais para fração exata: fica só o valor em reais
      if (ok && beneficiarios.length === 1) { const b = beneficiarios[0]; const fr = frDe(b); if (fr) { b.excedenteFr = somaCede; b.realFr = fr.mais(somaCede); if (!frSegura(b.realFr, fr.num() + somaEsp)) { delete b.excedenteFr; delete b.realFr; } } }
      else if (ok) beneficiarios.forEach(b => { b.excedenteFr = null; });
      rows.forEach(r => { if (!r.cede && !r.excedente && !r.meacao) { const fr = frDe(r); if (fr) r.realFr = fr; } });
    }
    return { ativa, natureza: (pr && pr.natureza) || 'nao_onerosa', rows, totalLegal, totalReal, totalExcedente, totalCede, diferenca, beneficiarios, cedentes, taxaUniforme, taxaFr, avisos };
  }
  // Cessão gratuita em favor de um beneficiário: cada cedente transfere a mesma fração (taxa) do
  // próprio quinhão legal. taxa = Fr (fração exata, ex.: 1570/2997) ou número (0.5238…). Se em vez
  // da taxa vier "alvo" (R$ que o beneficiário deve ficar ao fim), a taxa é deduzida.
  // Devolve { reais: {id: R$}, taxa: Fr|null, taxaNum } com centavos fechando (resíduo no beneficiário).
  function aplicarCessao(inv, { beneficiarioId, taxa, alvo, incluirMeacao = false, cedentesIds = null }) {
    const rows = linhasPartilha(inv);
    const benef = rows.find(r => r.id === beneficiarioId);
    if (!benef) throw new Error('beneficiário não encontrado');
    const cedentes = rows.filter(r => r.id !== beneficiarioId && r.legal > 0 && (incluirMeacao || !r.meacao) && (!cedentesIds || cedentesIds.includes(r.id)));
    const somaCed = cedentes.reduce((s, r) => s + r.legal, 0);
    let taxaNum, taxaFr = null;
    if (taxa instanceof Fr) { taxaFr = taxa; taxaNum = taxa.num(); }
    else if (taxa != null && taxa !== '') taxaNum = +taxa;
    else if (alvo != null && somaCed > 0) {
      const t = (arred(+alvo) - benef.legal) / somaCed;
      if (t < -1e-9) throw new Error(`o valor-alvo (${fmtBRL(+alvo)}) é menor que o quinhão legal do beneficiário (${fmtBRL(benef.legal)})`);
      if (t > 1 + 1e-9) throw new Error(`o valor-alvo (${fmtBRL(+alvo)}) passa do que os cedentes têm (${fmtBRL(arred(benef.legal + somaCed))})`);
      taxaNum = Math.max(0, Math.min(1, t));
    }
    else throw new Error('informe a taxa ou o valor-alvo');
    if (!(taxaNum >= 0 && taxaNum <= 1)) throw new Error('taxa fora de 0–100%');
    const reais = {};
    let cedidoCents = 0;
    // a cessão é calculada sobre o quinhão legal EXATO (fração × herança), não sobre o valor já
    // arredondado — é o que fecha com a conferência em frações (ex.: 499.500/7 × 1570/2997 = 37.380,95)
    const hp = inv.pat.herancaPart, hc = inv.pat.herancaComum;
    cedentes.forEach(c => { const legalCents = Math.round(c.legal * 100); const exato = c.meacao ? c.legal : (c.frPart.num() * hp + c.frComum.num() * hc); const cede = taxaNum >= 1 ? legalCents : Math.min(legalCents, Math.round(exato * 100 * taxaNum)); cedidoCents += cede; reais[c.id] = (legalCents - cede) / 100; });
    // valor-alvo: o beneficiário fica EXATAMENTE no alvo; a diferença de centavos (arredondamento por cedente) vai para o maior cedente
    if (alvo != null && taxa == null && cedentes.length) {
      const querCents = Math.round(arred(+alvo) * 100) - Math.round(benef.legal * 100); const sobra = querCents - cedidoCents;
      if (sobra !== 0 && Math.abs(sobra) <= cedentes.length + 1) { const maior = cedentes.reduce((a, b) => (b.legal > a.legal ? b : a)); const novo = Math.round(reais[maior.id] * 100) - sobra; if (novo >= 0) { reais[maior.id] = novo / 100; cedidoCents += sobra; } }
    }
    rows.forEach(r => { if (!(r.id in reais)) reais[r.id] = r.legal; });
    reais[beneficiarioId] = (Math.round(benef.legal * 100) + cedidoCents) / 100;
    return { reais, taxa: taxaFr, taxaNum, cedidoTotal: cedidoCents / 100 };
  }
  // ITCMD "inter vivos" sobre o excedente de cada beneficiário: o excesso é tratado como uma
  // doação ao beneficiário, com a composição do espólio (imóvel × móvel) rateada, na data do
  // ato (a lei vincula o excesso extrajudicial à escritura — art. 4º, V). Não fraciona por cedente
  // para presumir isenção (o beneficiário é um só). A isenção do art. 8º, IV é aferida no total.
  function itcmdExcedente(inv, real, opts = {}) {
    const pat = inv.pat;
    const porBenef = real.beneficiarios.map(b => {
      const tipos = {};
      pat.bens.forEach(x => { tipos[x.tipo] = (tipos[x.tipo] || 0) + x.valor; });
      const totalBens = Object.values(tipos).reduce((s, v) => s + v, 0) || 1;
      const bens = Object.keys(tipos).map(t => ({ descricao: `excedente — parcela em ${t}`, tipo: t, valor: arred(b.excedente * tipos[t] / totalBens), fracao: 100, destino: 'todos' }));
      const d = doacao({ doadores: real.cedentes.map(c => ({ nome: c.nome })), donatarios: [{ uid: 'x', nome: b.nome, doacoesAnteriores: 0, impostoAnterior: 0 }], bens, reservaUsufruto: false, baseNuaPropriedade: '100', aliquotaManual: opts.aliquotaManual || '' }, { ufp: opts.ufp, hoje: opts.hoje });
      const l = d.linhas[0] || { imposto: 0, aliq: 0, situacao: 'sem valor', detalhe: '', ufps: 0, imoveis: 0, moveis: 0 };
      return { id: b.id, nome: b.nome, base: b.excedente, imposto: l.imposto, aliq: l.aliq, situacao: l.situacao, detalhe: l.detalhe, ufps: l.ufps, imoveis: l.imoveis, moveis: l.moveis, d };
    });
    return { porBeneficiario: porBenef, total: arred(porBenef.reduce((s, x) => s + x.imposto, 0)) };
  }

  function emolumentosEscritura(baseValor, qtdPessoas, opts = {}) {
    const acess = !!opts.acessorio;
    let emol = EMOL.faixa(baseValor);
    if (acess) emol = arred(emol * EMOL.atoAcessorio);
    const adicional = arred(Math.max(0, (qtdPessoas || 0) - 10) * EMOL.adicionalPessoa);
    const ferd = arred(emol * EMOL.ferd);
    return { base: baseValor, emol, adicional, ferd, total: arred(emol + adicional + ferd), acessorio: acess };
  }

  /* Inventário: a meação não integra a base de emolumentos (Lei SE 8.639/2019,
     Anexo I, Nota 24, incluída pela Lei 9.840/2025). Usa o patrimônio já calculado,
     nunca um valor de base sugerido pela IA. A fração de condomínio já foi aplicada
     por patrimonio(); não se divide novamente a herança nem os bens particulares.
     A Nota 24 exclui a meação: preserva-se a base bruta, sem introduzir dedução de
     dívidas. O monte partível líquido e o ITCMD continuam com suas regras próprias. */
  function emolumentosInventario(pat, qtdPessoas, opts = {}) {
    const patrimonioBruto = arred(Math.max(0, +pat.monteMor || 0));
    const meacaoExcluida = arred(Math.max(0, +pat.totalComum || 0) / 2);
    const base = arred(Math.max(0, patrimonioBruto - meacaoExcluida));
    // Sem valor transmitido, não estimar automaticamente uma escritura com bens.
    // Inventário negativo/sem bens exige enquadramento próprio, fora deste fluxo.
    const e = base > 0 ? emolumentosEscritura(base, qtdPessoas, opts) :
      { base: 0, emol: 0, adicional: 0, ferd: 0, total: 0, acessorio: !!opts.acessorio };
    return { ...e, patrimonioBruto, meacaoExcluida, semBase: base <= 0,
      fundamento: 'Lei SE 8.639/2019, Anexo I, Nota 24 (Lei 9.840/2025)' };
  }

  /* ---------- Inventário completo (um falecido) ---------- */
  function inventario(f, opts = {}) {
    const pat = patrimonio(f);
    const suc = sucessao(f, pat);
    const itc = itcmdCausaMortis(f, pat, suc, opts);
    // partilha ideal por bem: meação + quinhões (frações do bem)
    const partilha = pat.bens.map(b => {
      const linhas = [];
      if (!b.meacaoFr.zero() && pat.rg.temConjuge) linhas.push({ quem: (f.conjuge && f.conjuge.nome) || 'Meeiro(a)', papel: 'meação', fr: b.meacaoFr, valor: arred(b.valor * b.meacaoFr.num()) });
      suc.benef.forEach(h => {
        const fr = b.comum ? b.herancaFr.vezes(h.frComum) : b.herancaFr.vezes(h.frPart);
        if (!fr.zero()) linhas.push({ quem: h.nome, papel: h.papel, fr, valor: arred(b.valor * fr.num()) });
      });
      return { bem: b, linhas };
    });
    return { falecido: f, pat, suc, itc, partilha };
  }

  /* ---------- Inventário cumulativo (2º falecido = cônjuge/companheiro do 1º) ---------- */
  function cumulativo(f1, f2, opts = {}) {
    const inv1 = inventario(f1, opts);
    // O 2º falecido leva: sua meação no 1º + seu quinhão como herdeiro do 1º + bens próprios dele.
    const conjId = 'conj';
    const quinhaoConj = inv1.suc.benef.find(b => b.id === conjId);
    const bensHerdados = inv1.pat.bens.map(b => {
      let fr = b.meacaoFr; // meação
      if (quinhaoConj) fr = fr.mais(b.comum ? b.herancaFr.vezes(quinhaoConj.frComum) : b.herancaFr.vezes(quinhaoConj.frPart));
      return { descricao: `${b.descricao} (fração ${fr.txt()} — meação${quinhaoConj ? ' + quinhão' : ''} no inventário de ${f1.nome || '1º falecido'})`, tipo: b.tipo, valor: b.valorBem, fracao: fr.num() * 100 * (b.fracao / 100), fracaoFr: fr, natureza: 'particular', origem: 'inv1', matricula: b.matricula || '', inscricao: b.inscricao || '' };
    }).filter(b => b.fracao > 0);
    const f2c = { ...f2, bens: [...bensHerdados, ...(f2.bens || [])] };
    const inv2 = inventario(f2c, opts);
    return { inv1, inv2 };
  }

  /* ---------- Doação ---------- */
  function doacao(d, opts = {}) {
    const ufp = +opts.ufp || LEGAL.ufpPadrao.valor;
    const todosDon = (d.donatarios || []).map((x, i) => ({ ...x, id: x.uid || String(i) }));
    const donatarios = todosDon.filter(x => (x.nome || '').trim());
    const bens = (d.bens || []).map((b, i) => { const fracao = (b.fracao === '' || b.fracao == null) ? 100 : +b.fracao; return { ...b, i, valor: arred((+b.valor || 0) * (fracao / 100)) }; });
    const avisos = [];
    const baseUsufruto = d.reservaUsufruto ? (d.baseNuaPropriedade === '50' ? LEGAL.baseDireitoReal : 1) : 1;
    if (d.reservaUsufruto) avisos.push(baseUsufruto === 1 ? 'Doação com reserva de usufruto: imposto só sobre a doação (art. 2º, §5º), calculado sobre o valor integral dos bens. A extinção futura do usufruto não é tributada (art. 7º, III).' : 'Doação com reserva de usufruto: base reduzida a 50% (nua-propriedade) em todos os bens doados, por analogia ao art. 13 — confirmar entendimento da SEFAZ/SE.');
    const semDestino = bens.filter(b => b.destino && b.destino !== 'todos' && !donatarios.some(x => x.id === String(b.destino)));
    if (semDestino.length) avisos.push(`Bem sem donatário válido (foi rateado entre todos): ${semDestino.map(b => b.descricao || 'Bem ' + (b.i + 1)).join(', ')}.`);
    const linhas = donatarios.map(dn => {
      let imoveis = 0, moveis = 0;
      bens.forEach(b => {
        const especifico = b.destino && b.destino !== 'todos' && donatarios.some(x => x.id === String(b.destino));
        const parte = !especifico ? b.valor / (donatarios.length || 1) : (String(b.destino) === dn.id ? b.valor : 0);
        if (b.tipo === 'imovel_urbano' || b.tipo === 'imovel_rural') imoveis += parte; else moveis += parte;
      });
      imoveis = arred(imoveis * baseUsufruto); moveis = arred(moveis * baseUsufruto);
      const anteriores = arred(+dn.doacoesAnteriores || 0), impostoAnterior = arred(+dn.impostoAnterior || 0);
      const quinhao = arred(imoveis + moveis);
      const acumulado = arred(quinhao + anteriores);
      const ufps = acumulado / ufp;
      let situacao, imposto = 0, detalhe = '', aliq = 0;
      if (quinhao <= 0) situacao = 'sem valor';
      else if (ufps <= LEGAL.isencaoUfp) { situacao = 'isento'; detalhe = `≤ ${LEGAL.isencaoUfp} UFP/SE no exercício (art. 8º, IV e §1º)`; }
      else {
        situacao = 'tributado';
        if (d.aliquotaManual != null && d.aliquotaManual !== '') { aliq = +d.aliquotaManual / 100; imposto = arred(quinhao * aliq); detalhe = 'alíquota informada manualmente'; }
        else if (anteriores > 0) {
          // art. 10, §7º: doações sucessivas em 12 meses — recalcula sobre o acumulado e deduz o imposto já recolhido
          const propIm = quinhao > 0 ? imoveis / quinhao : 0;
          const aliqIm = faixa(LEGAL.faixasDoacaoImoveis, ufps);
          const impostoAcum = arred(acumulado * propIm * aliqIm + acumulado * (1 - propIm) * LEGAL.aliqDoacaoMoveis);
          imposto = Math.max(0, arred(impostoAcum - impostoAnterior));
          aliq = imoveis > 0 ? aliqIm : LEGAL.aliqDoacaoMoveis;
          detalhe = `art. 10, §7º: ${(aliq * 100).toFixed(0)}% sobre o acumulado ${fmtBRL(acumulado)} = ${fmtBRL(impostoAcum)} − ${fmtBRL(impostoAnterior)} já recolhido`;
        } else {
          const aliqIm = faixa(LEGAL.faixasDoacaoImoveis, ufps);
          imposto = arred(imoveis * aliqIm + moveis * LEGAL.aliqDoacaoMoveis);
          aliq = imoveis > 0 ? aliqIm : LEGAL.aliqDoacaoMoveis;
          detalhe = (imoveis > 0 ? `${(aliqIm * 100).toFixed(0)}% sobre imóveis ${fmtBRL(imoveis)}` : '') + (moveis > 0 ? `${imoveis > 0 ? ' + ' : ''}2% sobre bens móveis ${fmtBRL(moveis)}` : '');
        }
      }
      return { id: dn.id, nome: dn.nome, papel: 'donatário(a)', quinhao, imoveis, moveis, anteriores, impostoAnterior, ufps: arred(ufps), situacao, aliq, imposto, multa: 0, detalhe };
    });
    const total = arred(linhas.reduce((s, l) => s + l.imposto, 0));
    const valorTotal = arred(bens.reduce((s, b) => s + b.valor, 0));
    return { ufp, linhas, total, totalMulta: 0, totalGeral: total, valorTotal, avisos, bens };
  }

  const API = { Fr, LEGAL, EMOL, arred, ufpVigente, regras, patrimonio, sucessao, itcmdCausaMortis, emolumentosEscritura, emolumentosInventario, inventario, cumulativo, doacao, faixa, linhasPartilha, partilhaReal, aplicarCessao, itcmdExcedente };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else raiz.ITCMD = API;
})(typeof window !== 'undefined' ? window : globalThis);

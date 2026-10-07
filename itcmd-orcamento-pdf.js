/* Impressão do orçamento. Somente apresenta os valores do motor, sem recalcular tributos. */
(function (root) {
  'use strict';
  const C = { vinho: '#631325', marinho: '#202A3A', suave: '#F5F0F1', alterna: '#F8F7F5', linha: '#DDD7D2', cinza: '#646D7A', branco: '#FFFFFF' };
  const texto = v => String(v == null ? '' : v).replace(/[−–—]/g, '-').replace(/→/g, '->').replace(/←/g, '<-').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=').replace(/≈/g, 'aproximadamente').replace(/\u00a0/g, ' ');
  function gerar(PDF, dados) {
    if (!dados || !['resumido', 'discriminado'].includes(dados.versao)) throw new Error('Escolha orçamento resumido ou discriminado.');
    if (!dados.logo || !dados.logo.base64 || !(dados.logo.largura > 0) || !(dados.logo.altura > 0)) throw new Error('A logo oficial não foi carregada. Tente gerar o orçamento novamente.');
    const pdf = new PDF({ pagina: 'A4' }), X = 16, W = 178, FIM = 277;
    const detalhado = dados.versao === 'discriminado', corpo = detalhado ? 9.2 : 10.7;
    let y = 44;
    const linhaMm = tam => tam * 0.352778 * 1.28;
    const quebrar = (t, largura, tam, forte) => pdf.quebrar(texto(t), largura, !!forte, tam);
    function tx(t, x, base, tam, forte, cor, op) {
      pdf.fonte(!!forte, tam).corTexto(cor || C.marinho).texto(x, base, texto(t), op);
    }
    function cabecalho() {
      const largura = 57, altura = largura * dados.logo.altura / dados.logo.largura;
      pdf.imagemJpeg(dados.logo.base64, (210 - largura) / 2, 9, largura, altura);
      pdf.linha(X, 37, X + W, 37, { cor: C.linha, espessura: 0.2 });
      pdf.linha(94, 37, 116, 37, { cor: C.vinho, espessura: 0.65 });
      y = 44;
    }
    function pagina() { pdf.novaPagina(); cabecalho(); }
    function espaco(h) { if (y + h > FIM) pagina(); }
    function paragrafo(t, op = {}) {
      const tam = op.tam || corpo, lh = linhaMm(tam), largura = op.largura || W;
      const ls = quebrar(t, largura, tam, op.forte);
      for (const l of ls) {
        espaco(lh + 1);
        tx(l, op.x || X, y + tam * 0.352778, tam, op.forte, op.cor, op.centro ? { alinhar: 'centro', larguraMm: W } : undefined);
        y += lh;
      }
      y += op.depois == null ? 2 : op.depois;
    }
    function titulo(t, pequeno) {
      const ls = quebrar(t, W, pequeno ? 11 : 13, true);
      espaco(ls.length * 6 + 13);
      paragrafo(t, { tam: pequeno ? 11 : 13, forte: true, cor: C.vinho, depois: 3 });
    }
    // Cada célula é quebrada antes da paginação. Linhas extensas continuam na
    // página seguinte com cabeçalho repetido, sem cortar nomes ou descrições.
    function tabela(colunas, linhas, op = {}) {
      const tam = op.tam || corpo, lh = linhaMm(tam), padding = op.compacta ? 2.1 : 3;
      const topo = () => {
        espaco(17);
        const ls = colunas.map(c => quebrar(c.titulo, c.largura - 6, 8.1, true));
        const h = Math.max(...ls.map(a => a.length), 1) * linhaMm(8.1) + 5;
        pdf.retangulo(X, y, W, h, { preencher: C.vinho, borda: false });
        let x = X;
        colunas.forEach((c, i) => {
          ls[i].forEach((l, k) => tx(l, x + 3, y + 3 + 8.1 * .352778 + k * linhaMm(8.1), 8.1, true, C.branco, c.direita ? { alinhar: 'dir', larguraMm: c.largura - 6 } : undefined));
          x += c.largura;
        });
        y += h;
      };
      topo();
      (linhas || []).forEach((row, ri) => {
        const valores = Array.isArray(row) ? row : row.valores;
        const total = !!row.total, subtotal = !!row.subtotal, forte = total || subtotal;
        const rtam = total ? tam + .4 : tam, rlh = linhaMm(rtam);
        const cells = colunas.map((c, i) => quebrar(valores[i], c.largura - 6, rtam, forte));
        let offset = 0, n = Math.max(...cells.map(a => a.length), 1);
        while (offset < n) {
          const proxima = (linhas || [])[ri + 1];
          const proximaValores = proxima && proxima.valores;
          const alturaTotal = proximaValores && (proxima.total || proxima.subtotal)
            ? Math.max(...colunas.map((c, i) => quebrar(proximaValores[i], c.largura - 6, tam + (proxima.total ? .4 : 0), true).length), 1) * linhaMm(tam + (proxima.total ? .4 : 0)) + padding * 2 : 0;
          // Mantenha o fechamento junto da última linha sempre que couberem
          // numa folha, em vez de levar só o subtotal para a página seguinte.
          const desejado = (n - offset) * rlh + padding * 2 + alturaTotal;
          if (desejado > FIM - y && y > 64) { pagina(); topo(); }
          const qtd = Math.max(1, Math.min(n - offset, Math.floor((FIM - y - padding * 2) / rlh)));
          const altura = qtd * rlh + padding * 2;
          const fundo = total ? C.marinho : subtotal ? C.suave : ri % 2 ? C.alterna : C.branco;
          pdf.retangulo(X, y, W, altura, { preencher: fundo, borda: false });
          let x = X;
          colunas.forEach((c, ci) => {
            cells[ci].slice(offset, offset + qtd).forEach((l, li) => tx(l, x + 3, y + padding + rtam * .352778 + li * rlh, rtam, forte, total ? C.branco : C.marinho, c.direita ? { alinhar: 'dir', larguraMm: c.largura - 6 } : undefined));
            x += c.largura;
          });
          y += altura;
          pdf.linha(X, y, X + W, y, { cor: C.linha, espessura: .16 });
          offset += qtd;
          if (offset < n) { pagina(); topo(); }
        }
      });
      y += 5;
    }
    function indicadores(itens) {
      const lista = (itens || []).filter(i => i && i.valor !== undefined);
      const porFaixa = lista.length === 4 ? 4 : 3;
      for (let ini = 0; ini < lista.length; ini += porFaixa) {
        const grupo = lista.slice(ini, ini + porFaixa), largura = (W - (grupo.length - 1) * 3) / grupo.length;
        const prep = grupo.map(i => ({ rot: quebrar(i.rotulo, largura - 6, 7.8, true), valor: quebrar(i.valor, largura - 6, 10.6, true) }));
        const h = Math.max(...prep.map(p => p.rot.length * 3.6 + p.valor.length * 4.7)) + 6;
        espaco(h + 8);
        grupo.forEach((i, k) => {
          const x = X + k * (largura + 3), p = prep[k];
          pdf.retangulo(x, y, largura, h, { preencher: C.alterna, borda: false });
          p.rot.forEach((l, n) => tx(l.toUpperCase(), x + 3, y + 5 + n * 3.6, 7.8, true, C.cinza));
          p.valor.forEach((l, n) => tx(l, x + 3, y + 5 + p.rot.length * 3.6 + n * 4.7, 10.6, true, C.marinho));
        });
        y += h + 3;
      }
      y += 2;
    }
    function totalFinal(rotulo, valor) {
      const ls = quebrar(rotulo, 122, 11, true), vs = quebrar(valor, 43, 12.5, true);
      const h = Math.max(ls.length * 5, vs.length * 5.5) + 9;
      espaco(h + 2);
      pdf.retangulo(X, y, W, h, { preencher: C.marinho, borda: false });
      ls.forEach((l, n) => tx(l, X + 4, y + 7 + n * 5, 11, true, C.branco));
      vs.forEach((l, n) => tx(l, X + W - 47, y + 7 + n * 5.5, 12.5, true, C.branco, { alinhar: 'dir', larguraMm: 43 }));
      y += h + 2;
    }
    cabecalho();
    paragrafo((dados.titulo || 'Orçamento do ato').toUpperCase(), { tam: 16, forte: true, centro: true, depois: 2 });
    paragrafo(detalhado ? 'DISCRIMINADO' : 'RESUMIDO', { tam: 8.5, forte: true, cor: C.vinho, centro: true, depois: 5 });
    if (dados.identificacao) paragrafo(dados.identificacao, { tam: 9, centro: true, depois: 2 });
    if (dados.protocolo) paragrafo('Referência: ' + dados.protocolo, { tam: 8.8, centro: true, cor: C.cinza, depois: 2 });
    if (dados.referencia) paragrafo(dados.referencia, { tam: 8.3, centro: true, cor: C.cinza, depois: 5 });
    const linhas = Array.isArray(dados.linhas) ? dados.linhas : [];
    tabela([{ titulo: 'DESPESA', largura: 136 }, { titulo: 'VALOR', largura: 42, direita: true }],
      linhas.map(l => ({ valores: [l.rotulo, l.valor], total: !!l.total, subtotal: !!l.subtotal })), { tam: detalhado ? 9.8 : 10.7 });
    if (detalhado) {
      const sucessoes = Array.isArray(dados.sucessoes) ? dados.sucessoes : [];
      sucessoes.forEach((s, si) => {
        pagina();
        paragrafo('DISCRIMINAÇÃO DO ORÇAMENTO', { tam: 8, forte: true, cor: C.cinza, depois: 2 });
        titulo(s.titulo || 'Sucessão ' + (si + 1));
        if (s.nome) paragrafo(s.nome, { tam: 9.5, depois: 4 });
        indicadores(s.indicadores);
        titulo('Quinhões e ITCMD por beneficiário', true);
        const hs = s.herdeiros || [];
        const temMulta = hs.some(h => h.multa && !/^R\$\s*0,00$/.test(String(h.multa).trim()) && String(h.multa) !== '0');
        const cols = temMulta ? [
          { titulo: 'BENEFICIÁRIO', largura: 51 }, { titulo: 'FRAÇÃO / %', largura: 31 }, { titulo: 'QUINHÃO', largura: 27, direita: true },
          { titulo: 'ALÍQUOTA', largura: 18, direita: true }, { titulo: 'ITCMD', largura: 26, direita: true }, { titulo: 'MULTA', largura: 25, direita: true }
        ] : [
          { titulo: 'BENEFICIÁRIO', largura: 61 }, { titulo: 'FRAÇÃO / %', largura: 33 }, { titulo: 'QUINHÃO', largura: 30, direita: true },
          { titulo: 'ALÍQUOTA', largura: 23, direita: true }, { titulo: 'ITCMD', largura: 31, direita: true }
        ];
        const linhasH = hs.map(h => {
          const fracoes = texto(h.fracao).split('\n'), percentuais = texto(h.percentual).split('\n');
          const fr = fracoes.map((f, i) => {
            const a = f.match(/^(\S+)\s*(.*)$/), b = (percentuais[i] || '').match(/^(\S+)\s*(.*)$/);
            if (f === '-' && percentuais[i] === '-') return '-';
            return a && b && a[2] === b[2] ? a[1] + ' · ' + b[1] + (a[2] ? '\n' + a[2] : '') : [f, percentuais[i]].filter(Boolean).join('\n');
          }).join('\n');
          const nome = [h.nome, h.papel].filter(Boolean).join('\n');
          const quinhao = h.baseTributavel && h.baseTributavel !== h.quinhao
            ? h.quinhao + '\nBase tributável:\n' + h.baseTributavel : h.quinhao;
          return [nome, fr, quinhao, h.aliquota, h.imposto].concat(temMulta ? [h.multa] : []);
        });
        if (s.totalImposto) linhasH.push({ valores: ['Total ITCMD', '', '', '', s.totalImposto].concat(temMulta ? [s.totalMulta || 'R$ 0,00'] : []), subtotal: true });
        tabela(cols, linhasH, { tam: 8.8, compacta: true });
        (s.bens || []).forEach((b, bi) => {
          const desc = texto(b.descricao || 'Bem ' + (bi + 1)), ls = quebrar(desc, W - 8, 9, true);
          espaco(Math.min(200, ls.length * linhaMm(9) + 40));
          titulo('Partilha ideal por bem · ' + String(bi + 1).padStart(2, '0'), true);
          paragrafo(desc, { tam: 9, forte: true, depois: 2 });
          if (b.complemento) paragrafo(b.complemento, { tam: 8.1, cor: C.cinza, depois: 4 });
          tabela([
            { titulo: 'QUEM RECEBE', largura: 87 }, { titulo: 'FRAÇÃO', largura: 25, direita: true },
            { titulo: '%', largura: 26, direita: true }, { titulo: 'VALOR', largura: 40, direita: true }
          ], (b.linhas || []).map(l => [[l.quem, l.papel === 'meação' ? 'Meação' : ''].filter(Boolean).join('\n'), l.fracao, l.percentual, l.valor]), { tam: 8.8, compacta: true });
        });
        if (s.partilhaReal && (s.partilhaReal.linhas || []).length) {
          titulo('Partilha acordada e quinhão legal', true);
          const r = s.partilhaReal;
          tabela([
            { titulo: 'BENEFICIÁRIO', largura: 62 }, { titulo: 'LEGAL', largura: 29, direita: true }, { titulo: 'REAL', largura: 29, direita: true },
            { titulo: 'CEDE', largura: 29, direita: true }, { titulo: 'EXCEDENTE', largura: 29, direita: true }
          ], r.linhas.map(l => [l.nome, l.legal, l.real, l.cede, l.excedente]), { tam: 8.5, compacta: true });
        }
        if (s.excedentes && (s.excedentes.linhas || []).length) {
          titulo('ITCMD sobre os excedentes', true);
          const e = s.excedentes;
          tabela([{ titulo: 'BENEFICIÁRIO', largura: 88 }, { titulo: 'BASE', largura: 33, direita: true }, { titulo: 'ALÍQUOTA', largura: 24, direita: true }, { titulo: 'ITCMD', largura: 33, direita: true }],
            e.linhas.map(l => [l.nome, l.base, l.aliquota, l.imposto]).concat(e.total ? [{ valores: ['Total ITCMD sobre excedentes', '', '', e.total], subtotal: true }] : []), { tam: 8.8, compacta: true });
        }
      });
      const total = [...linhas].reverse().find(l => l.total);
      if (total) { y += 3; totalFinal('Total estimado do ato', total.valor); }
    }
    const paginas = pdf.totalPaginas();
    for (let i = 0; i < paginas; i++) {
      pdf.atual = i;
      pdf.linha(X, 284, X + W, 284, { cor: C.linha, espessura: .15 });
      tx('Hub CN2O · Orçamento ' + (detalhado ? 'discriminado' : 'resumido'), X, 289, 7.5, false, C.cinza);
      tx((i + 1) + ' / ' + paginas, 166, 289, 7.5, false, C.cinza, { alinhar: 'dir', larguraMm: 28 });
    }
    return pdf.blob();
  }
  const api = { gerar };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.ITCMDOrcamentoPDF = api;
})(typeof window === 'object' ? window : globalThis);

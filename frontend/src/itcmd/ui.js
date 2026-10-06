/* ============ Interface — Calculadora ITCMD/SE (Hub CN2O) ============ */
(function () {
  'use strict';
  const M = window.ITCMD;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = v => 'R$ ' + (Math.round((+v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtN = (v, c = 2) => (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
  const pct = v => (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
  const parseMoeda = s => { if (typeof s === 'number') return s; s = String(s || '').trim(); if (!s) return 0; if (/,\d{1,2}$/.test(s) || (s.includes(',') && !s.includes('.'))) s = s.replace(/\./g, '').replace(',', '.'); else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); const n = parseFloat(s.replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; };
  const hojeISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dataBR = iso => iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '—';
  const TIPOS = [['imovel_urbano', 'Imóvel urbano'], ['imovel_rural', 'Imóvel rural'], ['veiculo', 'Veículo'], ['quotas', 'Quotas de sociedade'], ['dinheiro', 'Dinheiro / aplicações'], ['outros', 'Outros bens móveis']];
  const REGIMES = [['parcial', 'Comunhão parcial de bens'], ['universal', 'Comunhão universal de bens'], ['separacao_conv', 'Separação convencional de bens'], ['separacao_obrig', 'Separação obrigatória (legal) de bens'], ['aquestos', 'Participação final nos aquestos']];

  /* ---------- Estado ---------- */
  const uid = () => 'u' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const pessoa = (o = {}) => ({ uid: uid(), ...o });
  const novoFalecido = (n = '', estadoCivil = 'solteiro') => ({ nome: n, obito: '', estadoCivil, regime: 'parcial', conjuge: { nome: '', separadoFato: false, sumula377: false }, filhosComuns: 'sim',
    descendentes: [pessoa({ nome: '', condicao: 'vivo', representantes: [] })], ascendentes: { paiVivo: false, pai: '', maeViva: false, mae: '', avosPaternos: 0, avosMaternos: 0 },
    colaterais: [], bens: [{ descricao: '', tipo: 'imovel_urbano', valor: 0, natureza: 'comum', fracao: 100 }], dividas: 0, multaAtraso: true, aliquotaManual: '', isencaoUnicoImovel: false, isentosVI: {}, decl: novaDecl(), partilhaReal: novaPartilhaReal() });
  // v1.43 — partilha acordada (real) quando difere da legal: excedente de meação/quinhão (cessão gratuita)
  const novaPartilhaReal = () => ({ ativa: false, natureza: 'nao_onerosa', reais: {}, beneficiario: '', taxaTxt: '', alvoTxt: '', taxaFr: null, atalhoVivo: false, atalho: null, erroAtalho: '', cedentes: {}, incluirMeacao: false, cpfs: {} });
  // v1.43 — dados complementares da Declaração do ITCMD (SEFAZ): o que a calculadora não precisa para calcular, mas o formulário pede
  const novaDecl = () => ({ cpf: '', estadoCivilObito: '', dataCasamento: '', tipo: 'extrajudicial', sobrepartilha: false, dataAbertura: '', processo: '', vara: '', dataDistribuicao: '', dataHomologacao: '', dataTransito: '', inventariante: { nome: '', cpf: '', endereco: '', contato: '' }, cessao: 'auto', renuncia: 'auto', responsavel: { nome: '', cpf: '' }, local: 'Itabaiana/SE', dividasDescricao: '' });
  const novaDoacao = () => ({ doadores: [{ nome: '' }], data: hojeISO(), reservaUsufruto: false, baseNuaPropriedade: '100', usufrutoAcessorio: true, donatarios: [pessoa({ nome: '', doacoesAnteriores: 0, impostoAnterior: 0 })], bens: [{ descricao: '', tipo: 'imovel_urbano', valor: 0, fracao: 100, destino: 'todos' }], aliquotaManual: '' });
  let S = estadoInicial();
  function estadoInicial() {
    const u = M.ufpVigente(hojeISO());
    return { modo: 'inventario', ufp: u.valor, ufpManual: false, hoje: hojeISO(), inv: [novoFalecido(), novoFalecido('', 'solteiro')], doa: novaDoacao(), emol: { inv2Acessorio: false }, orc: { honorarios: '', certidoes: '', registro: '', outros: '' } };
  }
  function exemplo() {
    const s = estadoInicial();
    s.modo = 'cumulativo';
    s.inv[0] = { ...novoFalecido('José da Silva'), obito: '2019-04-12', estadoCivil: 'casado', regime: 'parcial', conjuge: { nome: 'Maria da Silva', separadoFato: false, sumula377: false }, filhosComuns: 'sim',
      descendentes: [pessoa({ nome: 'Ana da Silva', condicao: 'vivo', representantes: [] }), pessoa({ nome: 'Carlos da Silva', condicao: 'vivo', representantes: [] }), pessoa({ nome: 'Pedro da Silva', condicao: 'premorto', representantes: [pessoa({ nome: 'Lucas da Silva (neto)' }), pessoa({ nome: 'Júlia da Silva (neta)' })] })],
      bens: [{ descricao: 'Casa na Rua Quintino Bocaiúva, 120 — matrícula 12.345', tipo: 'imovel_urbano', valor: 380000, natureza: 'comum', fracao: 100 }, { descricao: 'Sítio Boa Vista, 12 ha — matrícula 9.876', tipo: 'imovel_rural', valor: 260000, natureza: 'particular', fracao: 100 }, { descricao: 'Fiat Strada 2018', tipo: 'veiculo', valor: 62000, natureza: 'comum', fracao: 100 }], dividas: 0 };
    s.inv[1] = { ...novoFalecido('Maria da Silva'), obito: '2026-02-03', estadoCivil: 'solteiro', regime: 'parcial', conjuge: { nome: '', separadoFato: false, sumula377: false },
      descendentes: [pessoa({ nome: 'Ana da Silva', condicao: 'vivo', representantes: [] }), pessoa({ nome: 'Carlos da Silva', condicao: 'vivo', representantes: [] }), pessoa({ nome: 'Pedro da Silva', condicao: 'premorto', representantes: [pessoa({ nome: 'Lucas da Silva (neto)' }), pessoa({ nome: 'Júlia da Silva (neta)' })] })],
      bens: [{ descricao: 'Saldo em poupança Banese', tipo: 'dinheiro', valor: 18500, natureza: 'particular', fracao: 100 }] };
    s.doa = { ...novaDoacao(), doadores: [{ nome: 'Antônio Pereira' }, { nome: 'Rita Pereira' }], reservaUsufruto: true, donatarios: [pessoa({ nome: 'Bruno Pereira', doacoesAnteriores: 0, impostoAnterior: 0 }), pessoa({ nome: 'Carla Pereira', doacoesAnteriores: 0, impostoAnterior: 0 })],
      bens: [{ descricao: 'Apartamento na Av. Ivo de Carvalho — matrícula 4.321', tipo: 'imovel_urbano', valor: 420000, fracao: 100, destino: 'todos' }] };
    return s;
  }

  /* ---------- Acesso por caminho ---------- */
  function get(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function set(obj, path, val) { const ks = path.split('.'); let o = obj; for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = val; }

  /* ---------- Blocos de formulário ---------- */
  const campo = (path, rotulo, tipo, extra = {}) => {
    const id = 'c_' + path.replace(/\W/g, '_');
    const v = get(S, path);
    let ctl;
    if (tipo === 'select') ctl = `<select id="${id}" data-path="${path}" data-tipo="select" ${extra.estrutural ? 'data-estrutural="1"' : ''}>${extra.opcoes.map(([k, t]) => `<option value="${k}" ${String(v) === String(k) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    else if (tipo === 'moeda') ctl = `<input type="text" id="${id}" class="moeda" inputmode="decimal" data-path="${path}" data-tipo="moeda" value="${v ? fmtN(v) : ''}" placeholder="0,00">`;
    else if (tipo === 'numero') ctl = `<input type="number" id="${id}" data-path="${path}" data-tipo="numero" value="${esc(v ?? '')}" ${extra.attrs || ''} ${extra.estrutural ? 'data-estrutural="1"' : ''}>`;
    else if (tipo === 'data') ctl = `<input type="date" id="${id}" data-path="${path}" data-tipo="texto" value="${esc(v || '')}">`;
    else ctl = `<input type="text" id="${id}" data-path="${path}" data-tipo="texto" value="${esc(v || '')}" placeholder="${esc(extra.ph || '')}" ${extra.estrutural ? 'data-estrutural="1"' : ''}>`;
    // v1.42 — campo vindo do dossiê ("do dossiê") e valor de bem ainda por lançar ("lançar o valor")
    const marca = S.origem && S.origem.paths && S.origem.paths[path] ? ' importado' : '';
    return `<div class="campo ${extra.classe || ''}${marca}${extra.pendente ? ' pendente' : ''}"><label for="${id}">${rotulo}${extra.dica ? ` <span class="dica">${extra.dica}</span>` : ''}</label>${ctl}</div>`;
  };
  // v1.42 — extras do campo "Valor (R$)" de um bem: referência achada nos documentos e o
  // realce "lançar o valor" enquanto o valor declarado não foi digitado.
  const extrasValor = bm => ({ dica: bm.valorRef ? `ref. ${fmt(bm.valorRef)}${bm.valorRefFonte ? ' (' + esc(bm.valorRefFonte) + ')' : ''} — lance o valor declarado` : '', pendente: !!(S.origem && bm.doDossie && !(+bm.valor)) });
  const marcaDe = path => (S.origem && S.origem.paths && S.origem.paths[path]) ? ' importado' : '';
  const marcar = (path, texto, estrutural = true) => { const id = 'c_' + path.replace(/\W/g, '_'); return `<label class="marcar${marcaDe(path)}" for="${id}"><input type="checkbox" id="${id}" data-path="${path}" data-tipo="bool" ${estrutural ? 'data-estrutural="1"' : ''} ${get(S, path) ? 'checked' : ''}><span>${texto}</span></label>`; };
  const opcoes = (path, lista) => `<div class="opcoes${marcaDe(path)}" role="group">${lista.map(([k, t]) => `<button type="button" data-opcao="${path}" data-valor="${k}" aria-pressed="${String(get(S, path)) === String(k)}">${esc(t)}</button>`).join('')}</div>`;

  function blocoRepresentantes(base, lista, deQuem) {
    return `<div class="sub"><div class="rotulo">Filhos de ${esc(deQuem || 'quem já faleceu')} <span class="dica">— herdam no lugar dele(a), por estirpe; cada um é um contribuinte do ITCMD</span></div>
      ${lista.map((r, j) => `<div class="linha" style="grid-template-columns:minmax(0,1fr) auto">${campo(`${base}.${j}.nome`, `Neto(a) ${j + 1}`, 'texto', { ph: 'Nome completo' })}<button type="button" class="btn mini remover" data-acao="remover" data-lista="${base}" data-i="${j}" aria-label="Remover representante">✕</button></div>`).join('')}
      <div><button type="button" class="btn mini suave" data-acao="adicionar" data-lista="${base}" data-modelo="rep">+ Neto(a)</button></div></div>`;
  }
  const REGIME_EXPLICA = {
    parcial: 'Comunhão parcial: o(a) sobrevivente tem <b>meação</b> (metade) nos bens comuns do casal e <b>herda junto com os filhos só nos bens particulares</b> do(a) falecido(a). Sem bens particulares, fica só com a meação.',
    universal: 'Comunhão universal: todos os bens são do casal — o(a) sobrevivente fica com a <b>meação</b> (metade) e <b>não herda</b> junto com os filhos.',
    separacao_conv: 'Separação convencional (pacto): <b>não há meação</b>; o(a) sobrevivente <b>herda junto com os filhos</b> sobre toda a herança.',
    separacao_obrig: 'Separação obrigatória (art. 1.641 CC): <b>não há meação</b> (salvo Súmula 377, abaixo) e o(a) sobrevivente <b>não herda</b> junto com os filhos.',
    aquestos: 'Participação final nos aquestos: <b>meação</b> nos bens adquiridos na constância e o(a) sobrevivente <b>herda junto com os filhos</b>.'
  };
  const temNomeP = x => (x && (x.nome || '').trim() !== '');

  function blocoFalecido(k, titulo) {
    const b = `inv.${k}`, f = S.inv[k];
    const temConj = f.estadoCivil !== 'solteiro';
    const rg = M.regras(f);
    const temDesc = f.descendentes.some(d => temNomeP(d) || (d.condicao === 'premorto' && (d.representantes || []).some(temNomeP)));
    const a = f.ascendentes;
    const temAsc = !!(a.paiVivo || a.maeViva || (+a.avosPaternos) || (+a.avosMaternos));
    const cumul2 = S.modo === 'cumulativo' && k === 1;
    let h = `<section class="cartao" aria-labelledby="tf${k}"><h2 id="tf${k}"><span class="num">${cumul2 ? 3 : 2}</span>${titulo}</h2>`;
    if (cumul2) h += `<p class="lead">Normalmente é quem sobreviveu ao 1º falecido. A meação e o quinhão que recebeu no 1º inventário entram automaticamente no patrimônio dele(a); abaixo, lance só os bens próprios que tinha além disso.</p>`;
    else h += `<p class="lead">Preencha na ordem: quem faleceu → se deixou viúvo(a) ou companheiro(a) → quem são os herdeiros → os bens. O cálculo segue o Código Civil (arts. 1.829 a 1.844).</p>`;

    // ---- A. Falecido ----
    h += `<h3>A · Quem faleceu</h3><div class="grade">${campo(`${b}.nome`, 'Nome do(a) falecido(a)', 'texto', { ph: 'Nome completo', classe: 'larga' })}${campo(`${b}.obito`, 'Data do óbito', 'data')}</div>`;

    // ---- B. Viúvo(a) / meeiro(a) ----
    h += `<h3>B · Deixou viúvo(a) ou companheiro(a)?</h3>`;
    h += opcoes(`${b}.estadoCivil`, [['solteiro', 'Não (solteiro, viúvo ou divorciado)'], ['casado', 'Sim — era casado(a)'], ['uniao', 'Sim — vivia em união estável']]);
    if (temConj) {
      h += `<div class="grade" style="margin-top:12px">${campo(`${b}.conjuge.nome`, f.estadoCivil === 'uniao' ? 'Nome do(a) companheiro(a) sobrevivente' : 'Nome do(a) viúvo(a)', 'texto', { ph: 'Nome completo' })}${campo(`${b}.regime`, 'Regime de bens', 'select', { opcoes: REGIMES, estrutural: true })}</div>`;
      h += `<div class="aviso ok" style="margin-top:10px">${REGIME_EXPLICA[f.regime] || REGIME_EXPLICA.parcial}${rg.concorreDesc === 'nada' && rg.meacaoSobre !== 'nenhum' ? ' <b>Não precisa cadastrar o(a) viúvo(a) como herdeiro(a)</b>: a meação é calculada sozinha.' : ''}${rg.concorreDesc !== 'nada' ? ' <b>Não cadastre o(a) viúvo(a) na lista de filhos</b>: a parte dele(a) na herança é calculada sozinha.' : ''}</div>`;
      h += `<div class="grade" style="margin-top:10px"><div class="campo">${marcar(`${b}.conjuge.separadoFato`, 'Estavam separados de fato há mais de 2 anos (ou judicialmente): mantém a meação, mas não herda (art. 1.830 CC)')}</div>`;
      if (f.regime === 'separacao_obrig') h += `<div class="campo">${marcar(`${b}.conjuge.sumula377`, 'Aplicar a Súmula 377/STF: os bens adquiridos na constância (marcados como "do casal") têm meação')}</div>`;
      h += `</div>`;
      if (rg.concorreDesc !== 'nada' && temDesc) h += `<div class="campo" style="margin-top:10px"><span class="rotulo">Todos os filhos são filhos do(a) sobrevivente também? <span class="dica">define a reserva de 1/4 (art. 1.832 CC)</span></span>${opcoes(`${b}.filhosComuns`, [['sim', 'Sim, todos são do casal'], ['nao', 'Não (há filhos só do(a) falecido(a))']])}</div>`;
    }

    // ---- C. Herdeiros ----
    h += `<h3>C · Quem herda</h3>`;
    h += `<p class="notinha">Cadastre os <b>filhos</b> do(a) falecido(a). Se algum filho já tinha morrido antes, marque "já falecido(a)" e cadastre os filhos dele(a) — os netos herdam no lugar. Não inclua aqui o(a) viúvo(a).</p><div class="lista" style="margin-top:8px">`;
    f.descendentes.forEach((d, i) => {
      h += `<div class="item"><div class="linha">${campo(`${b}.descendentes.${i}.nome`, `Filho(a) ${i + 1}`, 'texto', { ph: 'Nome completo', classe: 'larga-mobile' })}
        ${campo(`${b}.descendentes.${i}.condicao`, 'Este filho(a) está…', 'select', { opcoes: [['vivo', 'Vivo(a)'], ['premorto', 'Já falecido(a) — os filhos dele(a) herdam no lugar'], ['renuncia', 'Renunciou à herança']], estrutural: true })}
        <button type="button" class="btn mini remover" data-acao="remover" data-lista="${b}.descendentes" data-i="${i}" aria-label="Remover filho(a)">✕</button></div>`;
      if (d.condicao === 'premorto') h += blocoRepresentantes(`${b}.descendentes.${i}.representantes`, d.representantes || [], d.nome);
      h += `</div>`;
    });
    h += `</div><div class="acoes"><button type="button" class="btn suave" data-acao="adicionar" data-lista="${b}.descendentes" data-modelo="desc">+ Filho(a)</button></div>`;

    // Ascendentes: só aparecem quando não há filhos/netos (é quando herdam)
    if (!temDesc) {
      h += `<div class="aviso" style="margin-top:12px"><b>Sem filhos nem netos?</b> Então herdam os pais (ou os avós)${temConj && rg.concorreAsc ? ', junto com o(a) sobrevivente' : ''}. Marque quem está vivo:</div>
      <div class="grade" style="margin-top:10px"><div class="campo">${marcar(`${b}.ascendentes.paiVivo`, 'Pai vivo')}</div>${a.paiVivo ? campo(`${b}.ascendentes.pai`, 'Nome do pai', 'texto') : ''}<div class="campo">${marcar(`${b}.ascendentes.maeViva`, 'Mãe viva')}</div>${a.maeViva ? campo(`${b}.ascendentes.mae`, 'Nome da mãe', 'texto') : ''}</div>
      ${(!a.paiVivo && !a.maeViva) ? `<div class="grade" style="margin-top:10px">${campo(`${b}.ascendentes.avosPaternos`, 'Avós paternos vivos', 'numero', { attrs: 'min="0" max="2"', dica: '(0 a 2)' })}${campo(`${b}.ascendentes.avosMaternos`, 'Avós maternos vivos', 'numero', { attrs: 'min="0" max="2"', dica: '(0 a 2)' })}</div>` : '<p class="notinha" style="margin-top:8px">Com pai ou mãe vivo, os avós não herdam (art. 1.836, §1º CC).</p>'}`;
      // Colaterais: só sem descendentes, ascendentes e sobrevivente que herde
      if (!temAsc && !(temConj && rg.herdaSozinho)) {
        h += `<div class="aviso" style="margin-top:12px"><b>Sem filhos, pais nem viúvo(a) que herde?</b> Então herdam os irmãos (e sobrinhos no lugar dos irmãos falecidos); sem irmãos, os sobrinhos; sem sobrinhos, os tios.</div><div class="lista" style="margin-top:10px">`;
        f.colaterais.forEach((c, i) => {
          h += `<div class="item"><div class="linha colateral">${campo(`${b}.colaterais.${i}.nome`, `Colateral ${i + 1}`, 'texto', { ph: 'Nome completo' })}
            ${campo(`${b}.colaterais.${i}.grau`, 'Parentesco', 'select', { opcoes: [['irmao', 'Irmão/irmã'], ['sobrinho', 'Sobrinho(a) (sem irmãos vivos)'], ['tio', 'Tio(a)'], ['primo', 'Primo(a) / 4º grau']], estrutural: true })}
            ${c.grau === 'irmao' ? campo(`${b}.colaterais.${i}.tipo`, 'Vínculo', 'select', { opcoes: [['bilateral', 'Mesmo pai e mãe'], ['unilateral', 'Só pai ou só mãe em comum']] }) : '<div></div>'}
            <button type="button" class="btn mini remover" data-acao="remover" data-lista="${b}.colaterais" data-i="${i}" aria-label="Remover colateral">✕</button></div>
            ${c.grau === 'irmao' ? `<div class="linha" style="grid-template-columns:minmax(0,1fr)">${campo(`${b}.colaterais.${i}.condicao`, 'Este irmão(ã) está…', 'select', { opcoes: [['vivo', 'Vivo(a)'], ['premorto', 'Já falecido(a) — os filhos dele(a) herdam no lugar'], ['renuncia', 'Renunciou à herança']], estrutural: true })}</div>${c.condicao === 'premorto' ? blocoRepresentantes(`${b}.colaterais.${i}.representantes`, c.representantes || [], c.nome) : ''}` : ''}</div>`;
        });
        h += `</div><div class="acoes"><button type="button" class="btn suave mini" data-acao="adicionar" data-lista="${b}.colaterais" data-modelo="col">+ Irmão(ã) / sobrinho(a) / tio(a)</button></div>`;
      }
    }

    // ---- D. Bens ----
    h += `<h3>${cumul2 ? 'D · Bens próprios do 2º falecido (além do que recebeu no 1º inventário)' : 'D · Bens deixados'}</h3>`;
    const mostraNat = temConj && (rg.meacaoSobre === 'comuns');
    h += `<p class="notinha">Valor = base de cálculo (valor venal/avaliação, nunca inferior ao do ITBI/IPTU, ITR ou IPVA — art. 10, §4º).${mostraNat ? ' Em cada bem, diga se era <b>do casal</b> (comprado na constância) ou <b>só do(a) falecido(a)</b> (anterior ao casamento, herdado ou doado).' : ''} Informe o valor do bem inteiro; "Fração" é a parcela do casal (bem comum) ou do(a) falecido(a) (bem particular) em condomínio com terceiros. <b>Não desconte a meação no valor nem na fração dos bens comuns:</b> a ferramenta a exclui automaticamente, uma única vez.</p><div class="lista" style="margin-top:8px">`;
    f.bens.forEach((bm, i) => {
      h += `<div class="item"><div class="linha bem">${campo(`${b}.bens.${i}.descricao`, `Bem ${i + 1}`, 'texto', { ph: 'Descrição, matrícula…', classe: 'larga-mobile' })}
        ${campo(`${b}.bens.${i}.tipo`, 'Tipo', 'select', { opcoes: TIPOS })}${campo(`${b}.bens.${i}.valor`, 'Valor (R$)', 'moeda', extrasValor(bm))}
        ${mostraNat ? campo(`${b}.bens.${i}.natureza`, 'De quem era', 'select', { opcoes: [['comum', 'Do casal (comum)'], ['particular', 'Só do(a) falecido(a) (particular)']] }) : (temConj && rg.meacaoSobre === 'todos' ? `<div class="campo"><span class="rotulo">&nbsp;</span>${marcar(`${b}.bens.${i}.incomunicavel`, 'Incomunicável (cláusula)', false)}</div>` : '<div></div>')}
        ${campo(`${b}.bens.${i}.fracao`, 'Fração (%)', 'numero', { attrs: 'min="0" max="100" step="0.01"' })}
        <button type="button" class="btn mini remover" data-acao="remover" data-lista="${b}.bens" data-i="${i}" aria-label="Remover bem">✕</button></div></div>`;
    });
    h += `</div><div class="acoes"><button type="button" class="btn suave" data-acao="adicionar" data-lista="${b}.bens" data-modelo="bem">+ Bem</button></div>`;
    h += blocoPartilhaReal(k);
    h += blocoDeclaracao(k);
    h += `<details style="margin-top:12px"><summary>Opções: dívidas, alíquota manual, multa e isenção do único imóvel</summary>`;
    h += `<div class="grade" style="margin-top:12px">${campo(`${b}.dividas`, 'Dívidas do espólio (R$)', 'moeda', { dica: 'abatem antes da meação' })}${campo(`${b}.aliquotaManual`, 'Alíquota manual (%)', 'numero', { attrs: 'min="0" max="10" step="0.5"', dica: 'deixe vazio para usar a lei vigente' })}</div>`;
    h += `<div class="grade" style="margin-top:10px"><div class="campo">${marcar(`${b}.multaAtraso`, 'Aplicar multa de 20% se o inventário não foi requerido em 120 dias do óbito (art. 27, I)', false)}</div>
      <div class="campo">${marcar(`${b}.isencaoUnicoImovel`, 'Único imóvel do espólio até 2.600 UFP: habilitar isenção do art. 8º, VI por sucessor (sem outro imóvel e renda ≤ 3 salários mínimos)')}</div></div>`;
    if (f.isencaoUnicoImovel) {
      const inv = M.inventario(f, { ufp: S.ufp, hoje: S.hoje });
      h += `<div class="aviso">Marque os sucessores que atendem aos requisitos (reconhecimento depende de pedido prévio à SEFAZ — Decreto, art. 9º):<div class="opcoes" style="margin-top:6px">${inv.suc.benef.map(x => marcar(`${b}.isentosVI.${x.id}`, esc(x.nome), false)).join('')}</div></div>`;
    }
    h += `</details></section>`;
    return h;
  }

  // v1.43 — F · partilha acordada diferente da legal (excedente de meação/quinhão, cessão gratuita)
  function invDe(k) { try { return M.inventario(S.inv[k], { ufp: S.ufp, hoje: S.hoje }); } catch (e) { return null; } }
  // "1570/2997" → fração exata (até 7 dígitos); "52,3857", "52.3857", "100" → PERCENTUAL do quinhão (0–100; "1" = 1%)
  function lerTaxa(txt) {
    const t = String(txt || '').trim().replace(/%$/, '').replace(/\s+/g, '');
    if (!t) return null;
    const m = /^(\d{1,7})\/(\d{1,7})$/.exec(t);
    if (m) { if (+m[2] === 0) throw new Error('fração com denominador zero'); if (+m[1] > +m[2]) throw new Error('a fração cedida não pode passar de 1 (o quinhão inteiro)'); return new M.Fr(+m[1], +m[2]); }
    if (/\//.test(t)) throw new Error('fração inválida — use numerador/denominador com até 7 dígitos (ex.: 1570/2997)');
    const n = parseFloat(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
    if (isNaN(n)) throw new Error('percentual inválido');
    if (n < 0 || n > 100) throw new Error('o percentual cedido vai de 0 a 100');
    return n / 100;
  }
  // o cônjuge sobrevivente aparece no bloco F como UMA pessoa ("conjuge"): recebe pelo quinhão de herdeiro (linha "conj")
  // quando concorre, senão pela meação (linha "meacao")
  function benefResolvido(inv, pr) {
    if (!pr || !pr.beneficiario) return '';
    const linhas = M.linhasPartilha(inv);
    if (pr.beneficiario !== 'conjuge') return linhas.some(l => l.id === pr.beneficiario) ? pr.beneficiario : '';
    return linhas.some(l => l.id === 'conj') ? 'conj' : (linhas.some(l => l.id === 'meacao') ? 'meacao' : '');
  }
  function cedentesDe(inv, pr, benef) {
    const ced = pr.cedentes || {};
    return M.linhasPartilha(inv).filter(l => l.id !== benef && !(pr.beneficiario === 'conjuge' && (l.id === 'conj' || l.id === 'meacao')) && ced[l.id] !== false).map(l => l.id);
  }
  function blocoPartilhaReal(k) {
    const b = `inv.${k}`, f = S.inv[k], pr = f.partilhaReal || novaPartilhaReal();
    const inv = invDe(k); if (!inv) return '';
    const linhas = M.linhasPartilha(inv);
    if (!linhas.length) return '';
    let h = `<details class="bloco-real" data-k="${k}" style="margin-top:12px" ${pr.ativa ? 'open' : ''}><summary>F · Partilha acordada diferente da legal? (cessão gratuita entre herdeiros, excedente de meação ou de quinhão)</summary>`;
    h += `<p class="notinha" style="margin-top:6px">Por padrão a partilha segue as frações legais (quinhão real = quinhão legal). Se os herdeiros acordaram outra divisão — um deles fica com mais, os demais cedem parte do próprio quinhão —, informe aqui o que cada um <b>recebe de fato</b>. O ITCMD causa mortis continua sobre o quinhão legal; a diferença a maior (excedente) é transmissão entre vivos: <b>ITCMD doação + Declaração Inter Vivos I</b> (Manual SEFAZ, item 8).</p>`;
    h += `<div class="campo" style="margin-top:8px">${marcar(`${b}.partilhaReal.ativa`, 'A partilha acordada é diferente da legal (há excedente de meação/quinhão)')}</div>`;
    if (pr.ativa) {
      h += `<div class="campo" style="margin-top:8px"><span class="rotulo">Natureza do excedente</span>${opcoes(`${b}.partilhaReal.natureza`, [['nao_onerosa', 'Não onerosa (cessão gratuita / partilha desigual sem torna)'], ['onerosa', 'Onerosa (com torna/pagamento — ITBI, fora do ITCMD)']])}</div>`;
      // no cumulativo, o cônjuge do 1º falecido é o 2º falecido: não cede nem recebe (L3)
      const conjVivo = f.estadoCivil !== 'solteiro' && (f.conjuge.nome || '').trim() && !(S.modo === 'cumulativo' && k === 0);
      const herd = linhas.filter(l => !l.meacao && l.id !== 'conj');
      const opcoesBenef = [['', '— escolha —'], ...(conjVivo ? [['conjuge', `${f.conjuge.nome} — cônjuge/meeiro(a)`]] : []), ...herd.map(l => [l.id, l.nome])];
      h += `<div class="aviso ok" style="margin-top:10px"><b>Atalho — cessão gratuita em favor de um herdeiro ou do(a) meeiro(a):</b> escolha quem fica com mais e diga quanto os demais cedem do próprio quinhão (fração exata, ex.: <code>1570/2997</code>, ou percentual, ex.: <code>52,3857</code> = 52,3857%) <i>ou</i> o valor que o beneficiário deve ficar nesta sucessão; depois clique em <b>Aplicar</b>. Ajuste à mão, se precisar.</div>`;
      h += `<div class="grade" style="margin-top:8px">${campo(`${b}.partilhaReal.beneficiario`, 'Beneficiário (quem recebe o excedente)', 'select', { opcoes: opcoesBenef })}${campo(`${b}.partilhaReal.taxaTxt`, '% ou fração do quinhão que cada um cede', 'texto', { ph: '52,3857 ou 1570/2997' })}${campo(`${b}.partilhaReal.alvoTxt`, 'ou valor-alvo do beneficiário (R$)', 'texto', { ph: '0,00' })}</div>`;
      const benef = benefResolvido(inv, pr);
      const outros = linhas.filter(l => l.id !== benef && !l.meacao && !(pr.beneficiario === 'conjuge' && l.id === 'conj') && !(S.modo === 'cumulativo' && k === 0 && l.id === 'conj'));
      if (!pr.cedentes) pr.cedentes = {}; outros.forEach(l => { pr.cedentes[l.id] = pr.cedentes[l.id] !== false; });   // explícito: marcado = cede
      if (S.modo === 'cumulativo' && k === 0) pr.cedentes.conj = false;
      if (pr.beneficiario && outros.length) h += `<div class="campo" style="margin-top:8px"><span class="rotulo">Quem cede <span class="dica">desmarque quem NÃO cede nada</span></span><div class="marcas">${outros.map(l => marcar(`${b}.partilhaReal.cedentes.${l.id}`, esc(l.nome), true)).join('')}</div></div>`;
      const temMeacao = linhas.some(l => l.meacao) && pr.beneficiario !== 'conjuge' && conjVivo;
      h += `<div class="grade" style="margin-top:8px"><div class="campo">${temMeacao ? marcar(`${b}.partilhaReal.incluirMeacao`, 'O(a) meeiro(a) também cede a mesma fração da meação', false) : ''}</div><div class="campo" style="align-self:end"><button type="button" class="btn" data-acao="aplicar-cessao" data-k="${k}">Aplicar a cessão aos quinhões</button></div></div>`;
      if (pr.erroAtalho) h += `<div class="aviso erro">Não deu para aplicar a cessão: <b>${esc(pr.erroAtalho)}</b> — corrija o atalho ou lance os quinhões reais à mão.</div>`;
      if (pr.atalhoVivo && !pr.erroAtalho) h += `<p class="notinha" style="margin-top:6px">Atalho ativo: os quinhões reais são refeitos pela fração/percentual aplicado sempre que os valores mudarem. Editar um quinhão real à mão desliga o atalho.</p>`;
      const real = M.partilhaReal(inv, pr);
      h += `<div class="tabela-wrap" style="margin-top:12px"><table><thead><tr><th>Meeiro(a) / herdeiro(a)</th><th class="n">Quinhão legal</th><th class="n">Quinhão real (recebe)</th><th class="n">Cede</th><th class="n">Excedente</th></tr></thead><tbody>`;
      real.rows.forEach(r => {
        h += `<tr><td>${esc(r.nome)}<div class="notinha">${esc(r.papel)}</div></td><td class="n">${fmt(r.legal)}</td><td class="n" style="min-width:150px"><input type="text" class="moeda" inputmode="decimal" data-path="${b}.partilhaReal.reais.${r.id}" data-tipo="moeda" data-estrutural="1" value="${fmtN(r.real)}" aria-label="Quinhão real de ${esc(r.nome)}"></td><td class="n">${r.cede ? fmt(r.cede) : '—'}</td><td class="n">${r.excedente ? '<b>' + fmt(r.excedente) + '</b>' : '—'}</td></tr>`;
      });
      h += `<tr class="total"><td>Total</td><td class="n">${fmt(real.totalLegal)}</td><td class="n">${fmt(real.totalReal)}</td><td class="n">${fmt(real.totalCede)}</td><td class="n">${fmt(real.totalExcedente)}</td></tr></tbody></table></div>`;
      if (Math.abs(real.diferenca) >= 0.01) h += `<div class="aviso erro">A soma dos quinhões reais difere do total legal em <b>${fmt(real.diferenca)}</b> — a partilha precisa fechar.</div>`;
      else if (real.totalExcedente > 0) h += `<div class="aviso">Excedente de <b>${fmt(real.totalExcedente)}</b> para ${real.beneficiarios.map(x => esc(x.nome)).join(', ')}${real.taxaUniforme != null ? ` — cada cedente transfere ${pr.taxaFr ? '<b>' + esc(pr.taxaFr.txt()) + '</b> (' + (real.taxaUniforme * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4 }) + '%)' : (real.taxaUniforme * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4 }) + '%'} do próprio quinhão` : ''}. ${pr.natureza === 'onerosa' ? 'Cessão onerosa: ITBI sobre imóveis, fora desta ferramenta.' : 'O ITCMD "inter vivos" sobre o excedente entra no resultado e no orçamento; a Declaração Inter Vivos I sai junto com a causa mortis.'}</div>`;
      else h += `<p class="notinha" style="margin-top:8px">Sem excedente: os quinhões reais são iguais aos legais.</p>`;
    }
    h += `</details>`;
    return h;
  }
  // v1.43 — E · dados que só a Declaração do ITCMD (SEFAZ) pede
  const declTemDado = d => !!(d.cpf || d.dataCasamento || d.dataAbertura || d.processo || (d.inventariante && (d.inventariante.nome || d.inventariante.cpf)) || (d.responsavel && d.responsavel.nome) || !['nao', 'auto'].includes(d.cessao) || d.tipo === 'judicial');
  function blocoDeclaracao(k) {
    const b = `inv.${k}`, f = S.inv[k], d = f.decl || novaDecl();
    const temConj = f.estadoCivil !== 'solteiro';
    const temRenuncia = f.descendentes.concat(f.colaterais || []).some(x => x.condicao === 'renuncia' && (x.nome || '').trim());
    const aberto = declTemDado(d) || (S.origem && S.origem.paths && Object.keys(S.origem.paths).some(p => p.startsWith(`${b}.decl.`)));
    let h = `<details class="bloco-decl" data-k="${k}" style="margin-top:12px" ${aberto ? 'open' : ''}><summary>E · Dados para a Declaração do ITCMD (SEFAZ) — preencha quando a documentação já foi apresentada</summary>`;
    h += `<p class="notinha" style="margin-top:6px">O que a calculadora já sabe (falecido, óbito, regime, herdeiros, bens, cálculo) entra sozinho no formulário. Aqui vão só os campos que o formulário pede a mais; o que ficar em branco sai em branco no PDF, para o advogado completar.</p>`;
    h += `<div class="grade">${campo(`${b}.decl.cpf`, 'CPF do(a) falecido(a)', 'texto', { ph: '000.000.000-00' })}${temConj ? campo(`${b}.decl.dataCasamento`, f.estadoCivil === 'uniao' ? 'Início da união estável' : 'Data do casamento', 'data') : campo(`${b}.decl.estadoCivilObito`, 'Estado civil no óbito (quadro 3.1)', 'select', { opcoes: [['', '— informe —'], ['solteiro', 'Solteiro(a)'], ['viuvo', 'Viúvo(a)'], ['divorciado', 'Divorciado(a)'], ['separado', 'Separado(a)']] })}</div>`;
    h += `<div class="campo" style="margin-top:10px"><span class="rotulo">Tipo de inventário</span>${opcoes(`${b}.decl.tipo`, [['extrajudicial', 'Extrajudicial (escritura pública)'], ['judicial', 'Judicial']])}</div>`;
    h += `<div class="grade" style="margin-top:8px"><div class="campo">${marcar(`${b}.decl.sobrepartilha`, 'É sobrepartilha (bens que ficaram de fora do inventário anterior)', false)}</div>${d.tipo === 'judicial' ? campo(`${b}.decl.dataDistribuicao`, 'Data de distribuição', 'data') : campo(`${b}.decl.dataAbertura`, 'Data de abertura do inventário', 'data', { dica: 'data da escritura de abertura/nomeação de inventariante — não é a do óbito nem a do requerimento' })}</div>`;
    if (d.tipo === 'judicial') h += `<div class="grade" style="margin-top:8px">${campo(`${b}.decl.processo`, 'Processo nº', 'texto')}${campo(`${b}.decl.vara`, 'Vara / Comarca', 'texto')}${campo(`${b}.decl.dataHomologacao`, 'Homologação da partilha', 'data')}${campo(`${b}.decl.dataTransito`, 'Trânsito em julgado', 'data')}</div>`;
    h += `<h3 style="margin-top:14px">Inventariante</h3><div class="grade">${campo(`${b}.decl.inventariante.nome`, 'Nome', 'texto', { ph: 'Nome completo', classe: 'larga' })}${campo(`${b}.decl.inventariante.cpf`, 'CPF', 'texto', { ph: '000.000.000-00' })}</div>`;
    h += `<div class="grade" style="margin-top:8px">${campo(`${b}.decl.inventariante.endereco`, 'Endereço completo', 'texto', { classe: 'larga' })}${campo(`${b}.decl.inventariante.contato`, 'Telefone / e-mail', 'texto')}</div>`;
    h += `<div class="grade" style="margin-top:10px"><div class="campo"><span class="rotulo">Cessão de direitos hereditários</span>${opcoes(`${b}.decl.cessao`, [['auto', 'Conforme a partilha acordada (F)'], ['nao', 'Não há'], ['onerosa', 'Onerosa'], ['nao_onerosa', 'Não onerosa']])}</div>`;
    h += `<div class="campo"><span class="rotulo">Renúncia abdicativa ${temRenuncia ? '<span class="dica">há renunciante cadastrado em C</span>' : ''}</span>${opcoes(`${b}.decl.renuncia`, [['auto', temRenuncia ? (d.tipo === 'judicial' ? 'Conforme o cadastro (por termo judicial)' : 'Conforme o cadastro (por escritura pública)') : 'Conforme o cadastro (não há)'], ['escritura', 'Por escritura pública'], ['termo', 'Por termo judicial'], ['nao', 'Não há']])}</div></div>`;
    if (+f.dividas > 0) h += `<div class="grade" style="margin-top:8px">${campo(`${b}.decl.dividasDescricao`, 'Descrição das dívidas do espólio', 'texto', { ph: 'ex.: financiamento Banese, contrato nº…', classe: 'larga' })}</div>`;
    if (f.bens.some(x => x.tipo === 'imovel_urbano' || x.tipo === 'imovel_rural' || (x.descricao || '').trim())) {
      h += `<h3 style="margin-top:14px">Bens — matrícula e inscrição (quadro 4 do formulário)</h3><div class="lista">`;
      f.bens.forEach((bm, i) => { if (!(bm.descricao || '').trim() && !bm.matricula) return; h += `<div class="item"><div class="linha bem-decl"><div class="campo"><span class="rotulo">Bem ${i + 1}</span><div class="notinha">${esc(bm.descricao || '(sem descrição)')}</div></div>${campo(`${b}.bens.${i}.matricula`, 'Matrícula (imóvel)', 'texto', { ph: 'nº e CRI' })}${campo(`${b}.bens.${i}.inscricao`, 'Inscrição municipal / INCRA', 'texto')}</div></div>`; });
      h += `</div>`;
    }
    { const inv = invDe(k); const linhas = inv ? M.linhasPartilha(inv) : []; if (linhas.length) h += `<h3 style="margin-top:14px">CPF do(a) meeiro(a) e dos herdeiros <span class="dica">quadro 8 e Inter Vivos I</span></h3><div class="grade">${linhas.map(l => campo(`${b}.partilhaReal.cpfs.${l.id}`, esc(l.nome), 'texto', { ph: '000.000.000-00' })).join('')}</div>`; }
    h += `<h3 style="margin-top:14px">Responsável pela declaração</h3><p class="notinha">Quem assina o quadro 11. Em branco, sai o(a) inventariante.</p><div class="grade">${campo(`${b}.decl.responsavel.nome`, 'Nome completo', 'texto', { classe: 'larga' })}${campo(`${b}.decl.responsavel.cpf`, 'CPF', 'texto', { ph: '000.000.000-00' })}</div>`;
    h += `<div class="grade" style="margin-top:8px">${campo(`${b}.decl.local`, 'Local (quadro 11)', 'texto')}</div>`;
    h += `</details>`;
    return h;
  }
  function blocoDoacao() {
    const d = S.doa;
    let h = `<section class="cartao" aria-labelledby="td"><h2 id="td"><span class="num">2</span>Doação</h2><p class="lead">Cada donatário é um fato gerador (art. 5º): isenção e alíquota são aferidas por donatário, somando as doações do mesmo exercício.</p>`;
    h += `<h3>Doador(es)</h3><div class="lista">${d.doadores.map((x, i) => `<div class="item"><div class="linha" style="grid-template-columns:minmax(0,1fr) auto">${campo(`doa.doadores.${i}.nome`, `Doador ${i + 1}`, 'texto', { ph: 'Nome completo' })}<button type="button" class="btn mini remover" data-acao="remover" data-lista="doa.doadores" data-i="${i}" aria-label="Remover doador">✕</button></div></div>`).join('')}</div>
      <div class="acoes"><button type="button" class="btn suave mini" data-acao="adicionar" data-lista="doa.doadores" data-modelo="doador">+ Doador (ex.: casal)</button></div>`;
    h += `<div class="grade" style="margin-top:12px">${campo('doa.data', 'Data prevista da escritura', 'data')}${campo('doa.aliquotaManual', 'Alíquota manual (%)', 'numero', { attrs: 'min="0" max="10" step="0.5"', dica: 'vazio = lei vigente' })}</div>`;
    h += `<div class="grade" style="margin-top:10px"><div class="campo">${marcar('doa.reservaUsufruto', 'Doação com reserva de usufruto em favor do(s) doador(es)')}</div>${d.reservaUsufruto ? campo('doa.baseNuaPropriedade', 'Base de cálculo da nua-propriedade', 'select', { opcoes: [['100', '100% do valor do bem (art. 2º, §5º)'], ['50', '50% do valor (art. 13, por analogia)']] }) : ''}</div>`;
    if (d.reservaUsufruto) h += `<div class="campo" style="margin-top:8px">${marcar('doa.usufrutoAcessorio', 'Emolumentos: cobrar a reserva de usufruto como ato acessório (metade da faixa)', false)}</div>`;
    h += `<h3>Donatários</h3><div class="lista">${d.donatarios.map((x, i) => `<div class="item"><div class="linha donatario">${campo(`doa.donatarios.${i}.nome`, `Donatário ${i + 1}`, 'texto', { ph: 'Nome completo' })}${campo(`doa.donatarios.${i}.doacoesAnteriores`, 'Doações anteriores no ano (R$)', 'moeda', { dica: 'do mesmo doador (art. 8º, §1º)' })}${campo(`doa.donatarios.${i}.impostoAnterior`, 'ITCMD já recolhido nelas (R$)', 'moeda', { dica: 'art. 10, §7º' })}<button type="button" class="btn mini remover" data-acao="remover" data-lista="doa.donatarios" data-i="${i}" aria-label="Remover donatário">✕</button></div></div>`).join('')}</div>
      <div class="acoes"><button type="button" class="btn suave" data-acao="adicionar" data-lista="doa.donatarios" data-modelo="donatario">+ Donatário</button></div>`;
    const dest = [['todos', 'Todos os donatários, em partes iguais'], ...d.donatarios.map((x, i) => [x.uid, x.nome || `Donatário ${i + 1}`])];
    d.bens.forEach(bm => { if (bm.destino && bm.destino !== 'todos' && !d.donatarios.some(x => x.uid === bm.destino)) bm.destino = 'todos'; });
    h += `<h3>Bens doados</h3><div class="lista">${d.bens.map((bm, i) => `<div class="item"><div class="linha bem bem-doacao">${campo(`doa.bens.${i}.descricao`, `Bem ${i + 1}`, 'texto', { ph: 'Descrição, matrícula…', classe: 'larga-mobile' })}${campo(`doa.bens.${i}.tipo`, 'Tipo', 'select', { opcoes: TIPOS })}${campo(`doa.bens.${i}.valor`, 'Valor (R$)', 'moeda', extrasValor(bm))}${campo(`doa.bens.${i}.destino`, 'Para quem', 'select', { opcoes: dest })}${campo(`doa.bens.${i}.fracao`, 'Fração (%)', 'numero', { attrs: 'min="0" max="100" step="0.01"' })}<button type="button" class="btn mini remover" data-acao="remover" data-lista="doa.bens" data-i="${i}" aria-label="Remover bem">✕</button></div></div>`).join('')}</div>
      <div class="acoes"><button type="button" class="btn suave" data-acao="adicionar" data-lista="doa.bens" data-modelo="bemDoa">+ Bem</button></div>`;
    h += `</section>`;
    return h;
  }

  let ABERTOS = {};   // details E/F que a escrevente abriu/fechou (por classe|k); zerado ao importar, carregar exemplo ou limpar
  document.addEventListener('toggle', e => { const d = e.target; if (d && d.matches && d.matches('details.bloco-real, details.bloco-decl') && document.activeElement && d.contains(document.activeElement)) ABERTOS[d.className + '|' + (d.dataset.k || '')] = d.open; }, true);
  function renderForm() {
    const fi = $('#formInventarios'), fd = $('#formDoacao');
    $$('#segModo button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modo === S.modo)));
    if (S.modo === 'doacao') { fi.classList.add('oculto'); fi.innerHTML = ''; fd.classList.remove('oculto'); fd.innerHTML = blocoDoacao(); }
    else {
      fd.classList.add('oculto'); fd.innerHTML = ''; fi.classList.remove('oculto');
      fi.innerHTML = blocoFalecido(0, S.modo === 'cumulativo' ? '1º falecido e sua sucessão' : 'Falecido(a) e sucessão') + (S.modo === 'cumulativo' ? blocoFalecido(1, '2º falecido (inventário cumulativo)') : '');
    }
    $('#ufp').value = fmtN(S.ufp); $('#hoje').value = S.hoje;
    atualizarSelo();
    renderImportacao();
    // os blocos E e F (details) mantêm o estado aberto/fechado que a escrevente escolheu, mesmo com o formulário refeito
    $$('details.bloco-real, details.bloco-decl', fi).forEach(d => { const c = d.className + '|' + (d.dataset.k || ''); if (c in ABERTOS) d.open = ABERTOS[c]; });
  }
  function ufpDoCalculo() { return (S.modo === 'doacao' && !S.ufpManual && S.doa.data) ? M.ufpVigente(S.doa.data).valor : S.ufp; }
  function atualizarSelo() {
    const u = M.ufpVigente(S.hoje);
    $('#ufpDica').textContent = S.ufpManual ? 'valor informado manualmente' : `vigente em ${u.mes} (${u.fonte})`;
    $('#seloUfp').textContent = S.ufpManual ? `UFP/SE ${fmt(S.ufp)} · manual` : `UFP/SE ${fmt(S.ufp)} · ${u.mes}`;
  }

  /* ---------- Resultado ---------- */
  function tabelaHerdeiros(inv, tituloExtra) {
    const it = inv.itc;
    let h = `<div class="tabela-wrap"><table><thead><tr><th>Beneficiário</th><th>Título</th><th class="n">Fração</th><th class="n">Quinhão</th><th class="n">UFP</th><th>Situação</th><th class="n">ITCMD</th>${it.multaCabivel ? '<th class="n">Multa 20%</th>' : ''}</tr></thead><tbody>`;
    if (inv.pat.rg.temConjuge && inv.pat.meacao > 0) h += `<tr class="sub"><td>${esc(inv.falecido.conjuge.nome || 'Meeiro(a)')}</td><td>meação (não é herança)</td><td class="n fracao">${inv.pat.rg.meacaoSobre === 'todos' ? '1/2' : '1/2 dos comuns'}</td><td class="n">${fmt(inv.pat.meacao)}</td><td class="n">—</td><td><span class="pill sem">não incide</span></td><td class="n">—</td>${it.multaCabivel ? '<td class="n">—</td>' : ''}</tr>`;
    it.linhas.forEach(l => {
      let fr;
      if (inv.pat.herancaPart > 0 && inv.pat.herancaComum > 0 && l.frPart.txt() !== l.frComum.txt()) fr = [l.frPart.zero() ? '' : `${l.frPart.txt()} <span class="dica">da herança nos bens particulares</span>`, l.frComum.zero() ? '' : `${l.frComum.txt()} <span class="dica">da herança nos bens comuns</span>`].filter(Boolean).join('<br>');
      else fr = `${(inv.pat.herancaPart > 0 ? l.frPart : l.frComum).txt()} <span class="dica">da herança</span>`;
      h += `<tr><td>${esc(l.nome)}</td><td>${esc(l.papel)}</td><td class="n fracao" style="white-space:nowrap">${fr}</td><td class="n">${fmt(l.quinhao)}</td><td class="n">${fmtN(l.ufps, 1)}</td><td><span class="pill ${l.situacao === 'isento' ? 'isento' : l.situacao === 'tributado' ? 'tributado' : 'sem'}">${l.situacao === 'tributado' ? pct(l.aliq) : l.situacao}</span><div class="notinha">${esc(l.detalhe)}</div></td><td class="n">${fmt(l.imposto)}</td>${it.multaCabivel ? `<td class="n">${fmt(l.multa)}</td>` : ''}</tr>`;
    });
    h += `<tr class="total"><td colspan="3">Total ITCMD${tituloExtra || ''}</td><td class="n">${fmt(it.linhas.reduce((s, l) => s + l.quinhao, 0))}</td><td></td><td></td><td class="n">${fmt(it.total)}</td>${it.multaCabivel ? `<td class="n">${fmt(it.totalMulta)}</td>` : ''}</tr></tbody></table></div>`;
    return h;
  }
  function tabelaPartilha(inv) {
    let h = `<div class="tabela-wrap"><table><thead><tr><th>Bem</th><th>Quem recebe</th><th class="n">Fração do bem</th><th class="n">%</th><th class="n">Valor</th></tr></thead><tbody>`;
    inv.partilha.forEach(p => {
      p.linhas.forEach((l, j) => { h += `<tr>${j === 0 ? `<td rowspan="${p.linhas.length}"><b>${esc(p.bem.descricao)}</b><div class="notinha">${fmt(p.bem.valor)}${p.bem.fracao !== 100 ? ` (${fmtN(p.bem.fracao, 4)}% de ${fmt(p.bem.valorBem)})` : ''} · ${p.bem.comum ? 'comum' : 'particular'}</div></td>` : ''}<td>${esc(l.quem)}<div class="notinha">${esc(l.papel)}</div></td><td class="n fracao">${l.fr.txt()}</td><td class="n">${l.fr.pct(4)}</td><td class="n">${fmt(l.valor)}</td></tr>`; });
    });
    h += `</tbody></table></div>`;
    return h;
  }
  function resumoInventario(inv, rotulo) {
    const p = inv.pat, it = inv.itc;
    let h = `<h3>${esc(rotulo)}</h3><div class="kpis"><div class="kpi"><div class="r">Monte-mor</div><div class="v">${fmt(p.monteMor)}</div></div>${p.dividas ? `<div class="kpi"><div class="r">Dívidas</div><div class="v">− ${fmt(p.dividas)}</div></div>` : ''}${p.rg.temConjuge ? `<div class="kpi"><div class="r">Meação</div><div class="v">${fmt(p.meacao)}</div></div>` : ''}<div class="kpi"><div class="r">Herança (monte partível)</div><div class="v">${fmt(p.heranca)}</div></div><div class="kpi destaque"><div class="r">ITCMD${it.multaCabivel ? ' + multa' : ''}</div><div class="v">${fmt(it.totalGeral)}</div></div></div>`;
    if (it.dias !== null) h += `<p class="notinha">Óbito em ${dataBR(inv.falecido.obito)} — ${it.dias} dias até a data de referência.${it.multaCabivel ? ' Prazo de 120 dias ultrapassado: multa de 20% do imposto (art. 27, I), salvo se o inventário já foi requerido no prazo.' : it.dias > 120 ? ' Multa desativada.' : ''}</p>`;
    const avs = [...inv.suc.avisos, ...(inv.itc.avisos || [])];
    const graves = avs.filter(a => /sem o nome/.test(a)), demais = avs.filter(a => !/sem o nome/.test(a));
    if (graves.length) h += `<div class="aviso erro"><ul>${graves.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`;
    if (demais.length) h += `<div class="aviso"><ul>${demais.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`;
    if (inv.falecido.obito && inv.falecido.obito < '2024-01-01' && !inv.falecido.aliquotaManual) h += `<div class="aviso">Óbito anterior a 2024: a alíquota é a vigente na data do fato gerador. Esta versão aplica a tabela atual; confira na SEFAZ/SE e, se for o caso, informe a alíquota manual.</div>`;
    h += tabelaHerdeiros(inv);
    if (inv.real && inv.real.ativa) {
      const re = inv.real;
      h += `<h3>Partilha acordada × legal (quadro 8 da Declaração)</h3><div class="tabela-wrap"><table><thead><tr><th>Meeiro(a) / herdeiro(a)</th><th class="n">Quinhão legal</th><th class="n">Quinhão real</th><th class="n">Cede</th><th class="n">Excedente</th></tr></thead><tbody>`;
      re.rows.forEach(r => { h += `<tr><td>${esc(r.nome)}<div class="notinha">${esc(r.papel)}</div></td><td class="n">${fmt(r.legal)}</td><td class="n">${fmt(r.real)}</td><td class="n">${r.cede ? fmt(r.cede) : '—'}</td><td class="n">${r.excedente ? '<b>' + fmt(r.excedente) + '</b>' : '—'}</td></tr>`; });
      h += `<tr class="total"><td>Total</td><td class="n">${fmt(re.totalLegal)}</td><td class="n">${fmt(re.totalReal)}</td><td class="n">${fmt(re.totalCede)}</td><td class="n">${fmt(re.totalExcedente)}</td></tr></tbody></table></div>`;
      if (re.avisos.length) h += `<div class="aviso${Math.abs(re.diferenca) >= 0.01 ? ' erro' : ''}"><ul>${re.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`;
      if (inv.exced) {
        h += `<h3>ITCMD "inter vivos" sobre o excedente (Declaração Inter Vivos I)</h3><div class="tabela-wrap"><table><thead><tr><th>Beneficiário</th><th class="n">Base (excedente)</th><th class="n">UFP</th><th>Situação</th><th class="n">ITCMD doação</th></tr></thead><tbody>`;
        inv.exced.porBeneficiario.forEach(x => { h += `<tr><td>${esc(x.nome)}</td><td class="n">${fmt(x.base)}</td><td class="n">${fmtN(x.ufps, 1)}</td><td><span class="pill ${x.situacao === 'isento' ? 'isento' : x.situacao === 'tributado' ? 'tributado' : 'sem'}">${x.situacao === 'tributado' ? pct(x.aliq) : x.situacao}</span><div class="notinha">${esc(x.detalhe)}</div></td><td class="n">${fmt(x.imposto)}</td></tr>`; });
        h += `<tr class="total"><td colspan="4">Total ITCMD inter vivos</td><td class="n">${fmt(inv.exced.total)}</td></tr></tbody></table></div><p class="notinha">Base = excedente do beneficiário, com a composição do espólio (imóvel × móvel) rateada; alíquota da doação (art. 14, II e III-A) na data de referência. A SEFAZ apura a base pelo valor venal na data do ato (art. 10); a isenção do art. 8º, IV é aferida no total recebido pelo beneficiário, sem fracionar por cedente.</p>`;
      }
    }
    h += `<h3>Partilha ideal por bem (para a declaração)</h3>${p.dividas ? '<p class="notinha">Frações e valores brutos dos bens, antes do abatimento das dívidas.</p>' : ''}` + tabelaPartilha(inv);
    return h;
  }

  let ULT = null; // último cálculo (para o orçamento e a cópia)
  // v1.43 — partilha acordada e ITCMD do excedente anexados ao resultado de cada inventário
  // o atalho da cessão (fração/percentual/alvo) fica "vivo" enquanto a escrevente não mexe à mão nos
  // quinhões reais: cada recálculo (valores dos bens lançados depois da importação, UFP, dívidas) refaz
  // os reais a partir da fração exata — os centavos e as frações continuam fechando.
  function reaplicarAtalho(inv, pr) {
    if (!pr || !pr.ativa || !pr.atalhoVivo || !pr.beneficiario || !inv) return;
    if (!(inv.pat && inv.pat.heranca > 0)) { pr.reais = {}; pr.erroAtalho = ''; return; }   // sem valores ainda: nada a aplicar, sem erro
    aplicarAtalho(inv, pr);
  }
  function anexarReal(inv, f) {
    reaplicarAtalho(inv, f.partilhaReal);
    inv.real = M.partilhaReal(inv, f.partilhaReal || {});
    inv.exced = (inv.real.ativa && inv.real.totalExcedente > 0 && inv.real.natureza !== 'onerosa' && Math.abs(inv.real.diferenca) < 0.01) ? M.itcmdExcedente(inv, inv.real, { ufp: S.ufp, hoje: S.hoje }) : null;
  }
  function calcular() {
    const opts = { ufp: S.ufp, hoje: S.hoje };
    atualizarSelo();
    const rc = $('#resCorpo'); let h = '';
    try {
      if (S.modo === 'doacao') {
        const d = M.doacao(S.doa, { ufp: ufpDoCalculo(), hoje: S.doa.data || S.hoje });
        ULT = { modo: 'doacao', d };
        if (!S.ufpManual && S.doa.data && M.ufpVigente(S.doa.data).valor !== S.ufp) h += `<div class="aviso">Escritura prevista para ${dataBR(S.doa.data)}: usada a UFP/SE de ${M.ufpVigente(S.doa.data).mes} (${fmt(d.ufp)}).</div>`;
        h += `<div class="kpis"><div class="kpi"><div class="r">Valor doado</div><div class="v">${fmt(d.valorTotal)}</div></div><div class="kpi"><div class="r">Donatários</div><div class="v">${d.linhas.length}</div></div><div class="kpi destaque"><div class="r">ITCMD</div><div class="v">${fmt(d.total)}</div></div></div>`;
        if (d.avisos.length) h += `<div class="aviso"><ul>${d.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`;
        h += `<div class="tabela-wrap"><table><thead><tr><th>Donatário</th><th class="n">Imóveis</th><th class="n">Móveis</th><th class="n">Base (+ anteriores)</th><th class="n">UFP</th><th>Situação</th><th class="n">ITCMD</th></tr></thead><tbody>`;
        d.linhas.forEach(l => { h += `<tr><td>${esc(l.nome)}</td><td class="n">${fmt(l.imoveis)}</td><td class="n">${fmt(l.moveis)}</td><td class="n">${fmt(l.quinhao + l.anteriores)}</td><td class="n">${fmtN(l.ufps, 1)}</td><td><span class="pill ${l.situacao === 'isento' ? 'isento' : l.situacao === 'tributado' ? 'tributado' : 'sem'}">${l.situacao === 'tributado' ? pct(l.aliq) : l.situacao}</span><div class="notinha">${esc(l.detalhe)}</div></td><td class="n">${fmt(l.imposto)}</td></tr>`; });
        h += `<tr class="total"><td colspan="6">Total ITCMD</td><td class="n">${fmt(d.total)}</td></tr></tbody></table></div>`;
      } else if (S.modo === 'cumulativo') {
        const c = M.cumulativo(S.inv[0], S.inv[1], opts);
        anexarReal(c.inv1, S.inv[0]); anexarReal(c.inv2, S.inv[1]);
        ULT = { modo: 'cumulativo', c };
        h += resumoInventario(c.inv1, `1ª declaração — ${S.inv[0].nome || '1º falecido'}`);
        h += `<div class="aviso ok">O 2º falecido leva para o próprio inventário: meação ${fmt(c.inv1.pat.meacao)}${c.inv1.suc.benef.find(b => b.id === 'conj') ? ` + quinhão ${fmt(c.inv1.suc.benef.find(b => b.id === 'conj').valor)}` : ''} = ${fmt(c.inv2.pat.bens.filter(b => b.origem === 'inv1').reduce((s, b) => s + b.valor, 0))} (já lançado como bens particulares do 2º inventário).</div>`;
        h += resumoInventario(c.inv2, `2ª declaração — ${S.inv[1].nome || '2º falecido'}`);
      } else {
        const inv = M.inventario(S.inv[0], opts);
        anexarReal(inv, S.inv[0]);
        ULT = { modo: 'inventario', inv };
        h += resumoInventario(inv, S.inv[0].nome ? `Espólio de ${S.inv[0].nome}` : 'Espólio');
      }
    } catch (e) { h = `<div class="aviso erro">Não foi possível calcular: ${esc(e.message)}</div>`; ULT = null; console.error(e); }
    rc.innerHTML = h;
    orcamento();
    renderImportacao();   // v1.42: a contagem "valor(es) a lançar" acompanha a digitação
  }

  const ORC_EDITAVEIS = [['honorarios', 'Honorários advocatícios', 'a combinar com o cliente'], ['certidoes', 'Certidões e diligências', 'RI, negativas, avaliações'], ['registro', 'Registro/averbação no RI', 'tabela do Registro de Imóveis'], ['outros', 'Outros custos', '']];
  function montarOrcamentoFixo() { // campos editáveis são criados uma única vez (não perdem o foco nem o valor)
    const oc = $('#orcCorpo');
    oc.innerHTML = `<p class="notinha" id="orcTitulo"></p><div class="tabela-wrap"><table><thead><tr><th>Item</th><th class="n">Valor</th></tr></thead><tbody id="orcLinhas"></tbody><tbody id="orcEditaveis">${ORC_EDITAVEIS.map(([k, r, d]) => `<tr><td><label for="orc_${k}">${r}</label>${d ? `<div class="notinha">${d}</div>` : ''}</td><td class="n" style="min-width:150px"><input type="text" id="orc_${k}" class="moeda" inputmode="decimal" data-path="orc.${k}" data-tipo="moedatexto" placeholder="0,00" aria-label="${r}"></td></tr>`).join('')}</tbody><tbody><tr class="total grande"><td>Total estimado do ato</td><td class="n" id="orcTotal">—</td></tr></tbody></table></div><div id="orcOpcoes" class="nao-imprimir"></div>`;
  }
  function orcamento() {
    if (!$('#orcLinhas')) montarOrcamentoFixo();
    ORC_EDITAVEIS.forEach(([k]) => { const el = $('#orc_' + k); if (el && document.activeElement !== el) el.value = S.orc[k] || ''; });
    if (!ULT) { $('#orcLinhas').innerHTML = '<tr><td colspan="2" class="notinha">Preencha os dados para montar o orçamento.</td></tr>'; $('#orcTotal').textContent = '—'; return; }
    const linhas = []; // {rotulo, detalhe, valor}
    let titulo = '';
    if (ULT.modo === 'doacao') {
      const d = ULT.d; titulo = 'Escritura pública de doação';
      linhas.push({ rotulo: 'ITCMD — doação', detalhe: `${d.linhas.length} donatário(s)`, valor: d.total });
      const e = M.emolumentosEscritura(d.valorTotal, S.doa.doadores.length + S.doa.donatarios.length);
      linhas.push({ rotulo: 'Emolumentos da escritura', detalhe: `faixa ${fmt(d.valorTotal)} → ${fmt(e.emol)}${e.adicional ? ` + ${fmt(e.adicional)} adicionais` : ''} + FERD 20% ${fmt(e.ferd)}`, valor: e.total });
      if (S.doa.reservaUsufruto && S.doa.usufrutoAcessorio) { const ea = M.emolumentosEscritura(d.valorTotal, 0, { acessorio: true }); linhas.push({ rotulo: 'Reserva de usufruto (ato acessório)', detalhe: `metade da faixa ${fmt(ea.emol)} + FERD ${fmt(ea.ferd)}`, valor: ea.total }); }
    } else {
      const invs = ULT.modo === 'cumulativo' ? [ULT.c.inv1, ULT.c.inv2] : [ULT.inv];
      titulo = ULT.modo === 'cumulativo' ? 'Escritura pública de inventário cumulativo e partilha' : 'Escritura pública de inventário e partilha';
      invs.forEach((inv, k) => {
        const nome = inv.falecido.nome || (k ? '2º falecido' : 'falecido');
        linhas.push({ rotulo: `ITCMD causa mortis — ${nome}`, detalhe: `${inv.itc.linhas.filter(l => l.situacao === 'tributado').length} quinhão(ões) tributado(s), ${inv.itc.linhas.filter(l => l.situacao === 'isento').length} isento(s)`, valor: inv.itc.total });
        if (inv.itc.multaCabivel && inv.itc.totalMulta) linhas.push({ rotulo: `Multa 20% (art. 27, I) — ${nome}`, detalhe: 'inventário fora do prazo de 120 dias', valor: inv.itc.totalMulta });
        if (inv.exced && inv.exced.total > 0) linhas.push({ rotulo: `ITCMD doação — excedente de quinhão (Inter Vivos I) — ${nome}`, detalhe: inv.exced.porBeneficiario.map(x => `${x.nome}: ${fmt(x.base)}`).join('; '), valor: inv.exced.total });
      });
      invs.forEach((inv, k) => {
        const pessoas = inv.itc.linhas.length + (inv.pat.rg.temConjuge && inv.pat.meacao > 0 ? 1 : 0) + (inv.falecido.descendentes || []).filter(x => x.condicao === 'renuncia' && (x.nome || '').trim()).length;
        const acess = k === 1 && S.emol.inv2Acessorio;
        const e = M.emolumentosInventario(inv.pat, pessoas, { acessorio: acess });
        linhas.push({ rotulo: `Emolumentos — inventário de ${inv.falecido.nome || (k ? '2º falecido' : 'falecido')}${acess ? ' (ato acessório)' : ''}`, detalhe: e.semBase ? 'Sem valor de herança informado: emolumentos pendentes de apuração; inventário sem bens exige enquadramento próprio.' : `base dos emolumentos (herança bruta): ${fmt(e.patrimonioBruto)} − meação excluída ${fmt(e.meacaoExcluida)} = ${fmt(e.base)}${inv.pat.dividas > 0 ? '; sem abatimento de dívidas nesta base' : ''} → ${fmt(e.emol)}${e.adicional ? ` + ${fmt(e.adicional)} (${pessoas} pessoas)` : ''} + FERD 20% ${fmt(e.ferd)} · ${e.fundamento}`, valor: e.total });
      });
    }
    const fixos = linhas.reduce((s, l) => s + l.valor, 0);
    const edSoma = ORC_EDITAVEIS.reduce((s, [k]) => s + parseMoeda(S.orc[k]), 0);
    $('#orcTitulo').innerHTML = `<b>${esc(titulo)}</b>${ULT.modo !== 'doacao' ? ` · ${[...new Set((ULT.modo === 'cumulativo' ? [ULT.c.inv1, ULT.c.inv2] : [ULT.inv]).map(i => i.falecido.nome).filter(Boolean))].map(esc).join(' e ')}` : ''}`;
    let h = '';
    linhas.forEach(l => { h += `<tr><td>${esc(l.rotulo)}<div class="notinha">${esc(l.detalhe)}</div></td><td class="n">${fmt(l.valor)}</td></tr>`; });
    h += `<tr class="sub"><td>Subtotal — imposto e emolumentos</td><td class="n"><b id="orcSubtotal">${fmt(fixos)}</b></td></tr>`;
    $('#orcLinhas').innerHTML = h;
    $('#orcTotal').textContent = fmt(fixos + edSoma);
    const op = ULT.modo === 'cumulativo' ? `<div style="margin-top:8px">${marcar('emol.inv2Acessorio', 'Cobrar o 2º inventário como ato acessório (metade da faixa)', false)}</div>` : '';
    const opEl = $('#orcOpcoes'); if (opEl.dataset.modo !== ULT.modo || (op && !opEl.contains(document.activeElement) && opEl.innerHTML !== op)) { opEl.innerHTML = op; opEl.dataset.modo = ULT.modo; }
    const itcmdTot = linhas.filter(l => /^ITCMD|^Multa/.test(l.rotulo)).reduce((s, l) => s + l.valor, 0), emolTot = linhas.filter(l => /^Emolumentos|^Reserva/.test(l.rotulo)).reduce((s, l) => s + l.valor, 0);
    $('#bvItcmd').textContent = fmt(itcmdTot); $('#bvEmol').textContent = fmt(emolTot); $('#bvTotal').textContent = fmt(fixos + edSoma);
    $('#orcData').textContent = `Referência: ${dataBR(S.hoje)} · UFP/SE ${fmt(ULT.modo === 'doacao' ? ULT.d.ufp : S.ufp)}`;
  }

  function textoResumo() {
    if (!ULT) return '';
    const L = [];
    L.push(`ORÇAMENTO — ${ULT.modo === 'doacao' ? 'ESCRITURA DE DOAÇÃO' : ULT.modo === 'cumulativo' ? 'INVENTÁRIO CUMULATIVO' : 'INVENTÁRIO E PARTILHA'}`);
    L.push(`Cartório de Notas do 2º Ofício de Itabaiana/SE · referência ${dataBR(S.hoje)} · UFP/SE ${fmt(ULT.modo === 'doacao' ? ULT.d.ufp : S.ufp)}`); L.push('');
    const bloco = (inv, t) => { L.push(t); L.push(`Monte-mor ${fmt(inv.pat.monteMor)}${inv.pat.dividas ? ` − dívidas ${fmt(inv.pat.dividas)}` : ''}${inv.pat.rg.temConjuge ? ` − meação ${fmt(inv.pat.meacao)}` : ''} = herança ${fmt(inv.pat.heranca)}`); inv.itc.linhas.forEach(l => L.push(`  • ${l.nome} (${l.papel}): quinhão ${fmt(l.quinhao)} = ${fmtN(l.ufps, 1)} UFP → ${l.situacao === 'tributado' ? pct(l.aliq) + ' = ' + fmt(l.imposto) : l.situacao}${l.multa ? ` + multa ${fmt(l.multa)}` : ''}`)); L.push(`  ITCMD: ${fmt(inv.itc.totalGeral)}`); if (inv.exced) L.push(`  Excedente de quinhão (Inter Vivos I): ${inv.exced.porBeneficiario.map(x => x.nome + ' ' + fmt(x.base)).join('; ')} → ITCMD doação ${fmt(inv.exced.total)}`); L.push(''); };
    if (ULT.modo === 'doacao') { L.push('Donatários:'); ULT.d.linhas.forEach(l => L.push(`  • ${l.nome}: base ${fmt(l.quinhao)} (${fmtN(l.ufps, 1)} UFP) → ${l.situacao === 'tributado' ? pct(l.aliq) + ' = ' + fmt(l.imposto) : l.situacao}`)); L.push(`  ITCMD: ${fmt(ULT.d.total)}`); L.push(''); }
    else if (ULT.modo === 'cumulativo') { bloco(ULT.c.inv1, `1ª declaração — ${S.inv[0].nome}`); bloco(ULT.c.inv2, `2ª declaração — ${S.inv[1].nome}`); }
    else bloco(ULT.inv, `Espólio de ${S.inv[0].nome}`);
    $$('#orcCorpo tbody tr').forEach(tr => { const td = tr.children; if (td.length < 2) return; const rot = td[0].querySelector('label') ? td[0].querySelector('label').textContent : td[0].childNodes[0].textContent; const inp = td[1].querySelector('input'); L.push(`${rot.trim()}: ${inp ? fmt(parseMoeda(inp.value)) : td[1].textContent.trim()}`); const detalhe = td[0].querySelector('.notinha'); if (detalhe && /^Emolumentos/.test(rot.trim())) L.push(`  ${detalhe.textContent.trim()}`); });
    return L.join('\n');
  }

  /* ---------- Eventos ---------- */
  function aplicarEntrada(el) {
    const p = el.dataset.path, t = el.dataset.tipo; if (!p) return;
    let v;
    if (t === 'bool') v = el.checked; else if (t === 'moeda') v = parseMoeda(el.value); else if (t === 'numero') v = el.value === '' ? '' : +el.value; else v = el.value;
    if (t === 'moedatexto') v = el.value;
    set(S, p, v);
    if (/\.partilhaReal\.reais\./.test(p)) { const pr = get(S, p.replace(/\.reais\..*$/, '')); if (pr) { pr.taxaFr = null; pr.atalhoVivo = false; pr.erroAtalho = ''; } }
    if (/\.partilhaReal\.ativa$/.test(p) && get(S, p) === false) { const pr = get(S, p.replace(/\.ativa$/, '')); if (pr) { pr.atalhoVivo = false; pr.atalho = null; pr.reais = {}; pr.taxaFr = null; pr.erroAtalho = ''; } }
    if (S.origem && S.origem.paths && S.origem.paths[p]) { delete S.origem.paths[p]; const c = el.closest('.campo, label.marcar'); if (c) c.classList.remove('importado'); }
    if (t === 'moeda' && /\.bens\.\d+\.valor$/.test(p)) { const c = el.closest('.campo'); if (c) c.classList.toggle('pendente', !v && !!(S.origem && (get(S, p.replace(/\.valor$/, '')) || {}).doDossie)); }
    if (p === 'ufp') { if (!v) { set(S, p, M.ufpVigente(S.hoje).valor); S.ufpManual = false; } else S.ufpManual = Math.abs(v - M.ufpVigente(S.hoje).valor) > 0.001; }
  }
  // Dentro do Hub, a ferramenta vive em #itcmdRaiz: os ouvintes ficam presos a ela para não
  // reagir a botões de outras páginas (o Guia de ITBI também usa data-modo).
  const RAIZ = document.getElementById('itcmdRaiz') || document;
  RAIZ.addEventListener('input', e => {
    const el = e.target; if (!el.dataset || !el.dataset.path) return;
    if (el.dataset.estrutural) return; // trata no change
    aplicarEntrada(el); agendar();
  });
  RAIZ.addEventListener('change', e => {
    const el = e.target; if (!el.dataset || !el.dataset.path) return;
    aplicarEntrada(el);
    { const det = el.closest('details.bloco-real, details.bloco-decl'); if (det) ABERTOS[det.className + '|' + (det.dataset.k || '')] = true; }   // mexeu dentro do bloco: ele fica aberto após o redesenho
    if (el.dataset.tipo === 'moeda') el.value = get(S, el.dataset.path) ? fmtN(get(S, el.dataset.path)) : '';
    if (el.dataset.path === 'hoje' || el.dataset.path === 'doa.data') { if (el.dataset.path === 'hoje' && !S.ufpManual) { S.ufp = M.ufpVigente(S.hoje).valor; } renderForm(); }
    if (el.dataset.estrutural) renderForm();
    calcular(); if (el.dataset.estrutural) refrescarBlocosReais(); salvarAuto();
  });
  RAIZ.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'btVerOrcamento') { const o = $('#orcamento'); if (o) { const bv = $('#barraViva'); o.style.scrollMarginTop = ((bv ? bv.offsetHeight : 0) + 12) + 'px'; o.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return; }
    if (b.dataset.modo && ['inventario', 'cumulativo', 'doacao'].includes(b.dataset.modo)) { S.modo = b.dataset.modo; renderForm(); calcular(); salvarAuto(); return; }
    if (b.dataset.opcao) { set(S, b.dataset.opcao, b.dataset.valor); if (S.origem && S.origem.paths) delete S.origem.paths[b.dataset.opcao]; renderForm(); calcular(); refrescarBlocosReais(); salvarAuto(); return; }
    if (b.dataset.acao === 'adicionar') {
      const lista = get(S, b.dataset.lista) || []; const m = b.dataset.modelo;
      const novo = m === 'desc' ? pessoa({ nome: '', condicao: 'vivo', representantes: [] }) : m === 'rep' ? pessoa({ nome: '' }) : m === 'col' ? pessoa({ nome: '', grau: 'irmao', tipo: 'bilateral', condicao: 'vivo', representantes: [] }) : m === 'bem' ? { descricao: '', tipo: 'imovel_urbano', valor: 0, natureza: 'comum', fracao: 100 } : m === 'bemDoa' ? { descricao: '', tipo: 'imovel_urbano', valor: 0, fracao: 100, destino: 'todos' } : m === 'donatario' ? pessoa({ nome: '', doacoesAnteriores: 0, impostoAnterior: 0 }) : { nome: '' };
      lista.push(novo); set(S, b.dataset.lista, lista); renderForm(); calcular(); salvarAuto();
      const foco = $(`[data-path="${b.dataset.lista}.${lista.length - 1}.${m === 'bem' || m === 'bemDoa' ? 'descricao' : 'nome'}"]`); if (foco) foco.focus();
      return;
    }
    if (b.dataset.acao === 'aplicar-cessao') { aplicarCessaoUI(+b.dataset.k); return; }
    if (b.dataset.acao === 'remover') { const lista = get(S, b.dataset.lista); lista.splice(+b.dataset.i, 1); renderForm(); calcular(); refrescarBlocosReais(); salvarAuto(); return; }
  });
  // v1.43 — aplica o atalho da cessão (bloco F) aos quinhões reais; usado pelo botão e pela importação do dossiê
  function aplicarCessaoUI(k, silencioso) {
    const f = S.inv[k], pr = f.partilhaReal, inv = invDe(k);
    if (!inv || !pr) return false;
    if (!pr.beneficiario) { if (!silencioso) toast('Escolha o beneficiário'); return false; }
    pr.atalho = { taxaTxt: String(pr.taxaTxt || ''), alvoTxt: String(pr.alvoTxt || '') };   // o que vale é o que foi APLICADO, não o que está sendo digitado (M7)
    pr.ativa = true; pr.atalhoVivo = true; pr.erroAtalho = '';
    const ok = aplicarAtalho(inv, pr);
    renderForm(); calcular(); salvarAuto();
    if (!silencioso) toast(ok ? 'Cessão aplicada — confira os quinhões reais' : 'Não deu para aplicar: ' + pr.erroAtalho);
    return ok;
  }
  // aplica o atalho salvo (pr.atalho) a um inventário calculado; devolve true/false e guarda o motivo em pr.erroAtalho
  function aplicarAtalho(inv, pr) {
    try {
      const at = pr.atalho || { taxaTxt: pr.taxaTxt, alvoTxt: pr.alvoTxt };
      if (!(inv.pat && inv.pat.heranca > 0)) { pr.erroAtalho = 'lance os valores dos bens'; return false; }
      const benef = benefResolvido(inv, pr);
      if (!benef) { pr.erroAtalho = pr.beneficiario === 'conjuge' ? 'o(a) cônjuge não tem meação nem quinhão nesta sucessão' : 'o beneficiário da cessão não está mais na partilha — escolha outro'; return false; }
      const taxa = lerTaxa(at.taxaTxt); let alvo = null;
      if (taxa == null) { if (String(at.alvoTxt || '').trim()) alvo = parseMoeda(at.alvoTxt); else throw new Error('informe a fração/percentual ou o valor-alvo'); }
      const r = M.aplicarCessao(inv, { beneficiarioId: benef, taxa, alvo, incluirMeacao: !!pr.incluirMeacao && pr.beneficiario !== 'conjuge', cedentesIds: cedentesDe(inv, pr, benef) });
      pr.reais = r.reais; pr.taxaFr = r.taxa; pr.erroAtalho = '';
      return true;
    } catch (e) { pr.erroAtalho = e.message || String(e); return false; }
  }
  // o bloco F mostra os quinhões em R$: quando os valores dos bens (ou dívidas/UFP) mudam fora dele, refaz só esse bloco
  function refrescarBlocosReais() {
    $$('.bloco-real', RAIZ).forEach(det => {
      if (det.contains(document.activeElement)) return;
      const k = +det.dataset.k; if (!(k >= 0) || !S.inv[k]) return;
      const aberto = det.open; const tmp = document.createElement('div'); tmp.innerHTML = blocoPartilhaReal(k);
      const novo = tmp.firstElementChild; if (!novo) return; novo.open = aberto; det.replaceWith(novo);
    });
  }
  let timer = null;
  function agendar() { clearTimeout(timer); timer = setTimeout(() => { calcular(); refrescarBlocosReais(); salvarAuto(); }, 250); }

  $('#btExemplo').addEventListener('click', () => { S = exemplo(); ABERTOS = {}; renderForm(); calcular(); salvarAuto(); toast('Exemplo carregado'); });
  $('#btLimpar').addEventListener('click', () => { S = estadoInicial(); ABERTOS = {}; renderForm(); calcular(); try { localStorage.removeItem('itcmd-rascunho'); } catch (e) { } toast('Formulário limpo'); });
  $('#btSalvar').addEventListener('click', () => { salvarAuto(true); });
  $('#btImprimir').addEventListener('click', imprimirOrcamento);
  function imprimirOrcamento() {
    if (!ULT) return;
    let quem = ''; try { quem = (typeof SESSAO !== 'undefined' && SESSAO && SESSAO.nome) ? String(SESSAO.nome) : ''; } catch (e) { }
    const css = `body{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:12.5pt;margin:18mm 16mm;line-height:1.35}
      h1{font-size:18pt;margin:0 0 2px}h2{font-size:14pt;margin:18px 0 6px;border-bottom:1.5pt solid #631325;padding-bottom:3px}h3{font-size:12.5pt;margin:14px 0 4px;color:#631325}
      .cab{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2pt solid #631325;padding-bottom:6px;margin-bottom:10px}.cab small{color:#333}
      table{border-collapse:collapse;width:100%;font-size:11pt;margin-top:4px}th,td{border-bottom:.6pt solid #999;padding:4px 6px;text-align:left;vertical-align:top}th{font-size:9.5pt;text-transform:uppercase;letter-spacing:.04em;background:#f2eee6}
      td.n,th.n{text-align:right;white-space:nowrap}tr.total td{font-weight:bold;border-top:1.5pt solid #333}tr.grande td{font-size:14pt}.notinha{font-size:10pt;color:#333}.dica{font-size:9.5pt;color:#333}
      .pill{border:.6pt solid #666;border-radius:8px;padding:0 6px;font-size:10pt}.kpis{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}.kpi{border:.8pt solid #999;border-radius:6px;padding:6px 10px;min-width:140px}.kpi .r{font-size:9.5pt;text-transform:uppercase}.kpi .v{font-weight:bold;font-size:13pt}
      .aviso{border-left:3pt solid #b98a3e;padding:4px 8px;margin:6px 0;font-size:10.5pt}.aviso ul{margin:0;padding-left:16px}.fracao{font-weight:bold}.assinatura{margin-top:22px;font-size:10pt;color:#333;border-top:.6pt dashed #999;padding-top:8px}
      .nao-imprimir,button,input{display:none}details{display:block}summary{font-weight:bold;margin-top:14px}ol,ul{font-size:10.5pt}@page{size:A4;margin:12mm}`;
    // valores digitados no orçamento entram como texto (os inputs não imprimem)
    const orc = $('#orcCorpo').cloneNode(true);
    orc.querySelectorAll('input').forEach(i => { const s = document.createElement('span'); s.textContent = i.value ? fmt(parseMoeda(i.value)) : 'R$ 0,00'; i.replaceWith(s); });
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Orçamento — ${esc($('#orcTitulo') ? $('#orcTitulo').textContent : 'ITCMD')}</title><style>${css}</style></head><body>
      <div class="cab"><div><h1>Cartório de Notas do 2º Ofício de Itabaiana/SE</h1><div>Orçamento de custos do ato — ITCMD, emolumentos e despesas</div></div><small>${esc($('#orcData').textContent)}</small></div>
      <h2>Orçamento do ato</h2>${orc.innerHTML}
      <p class="assinatura">${esc($('#orcamento .assinatura').textContent)}${quem ? '<br>Elaborado por ' + esc(quem) + '.' : ''}</p>
      <h2>Memória de cálculo</h2>${$('#resCorpo').innerHTML}
      <details open><summary>Premissas e base legal</summary>${$('#premissas ol').outerHTML}</details>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast('O navegador bloqueou a janela de impressão — libere pop-ups para o Hub.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
    w.focus(); setTimeout(() => { try { w.print(); } catch (e) { } }, 350);
  }
  $('#btCopiar').addEventListener('click', () => {
    const t = textoResumo();
    const ok = () => toast('Resumo copiado');
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Selecione e copie manualmente'); } document.body.removeChild(ta); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok).catch(fallback); else fallback();
  });
  function migrar(r) {
    const base = estadoInicial(); const s = { ...base, ...r, orc: { ...base.orc, ...(r.orc || {}) }, emol: { ...base.emol, ...(r.emol || {}) } };
    s.inv = [0, 1].map(k => { const f = { ...novoFalecido('', 'solteiro'), ...((r.inv || [])[k] || {}) }; f.conjuge = { nome: '', separadoFato: false, sumula377: false, ...(f.conjuge || {}) }; f.ascendentes = { ...base.inv[0].ascendentes, ...(f.ascendentes || {}) }; const d0 = novaDecl(); f.decl = { ...d0, ...(f.decl || {}), inventariante: { ...d0.inventariante, ...((f.decl || {}).inventariante || {}) }, responsavel: { ...d0.responsavel, ...((f.decl || {}).responsavel || {}) } }; ['descendentes', 'colaterais', 'bens'].forEach(c => { if (!Array.isArray(f[c])) f[c] = []; }); f.descendentes.concat(f.colaterais).forEach(x => { if (!x.uid) x.uid = uid(); if (!Array.isArray(x.representantes)) x.representantes = []; x.representantes.forEach(y => { if (!y.uid) y.uid = uid(); }); }); if (!f.isentosVI) f.isentosVI = {}; f.partilhaReal = { ...novaPartilhaReal(), ...(f.partilhaReal || {}) }; if (!f.partilhaReal.reais) f.partilhaReal.reais = {}; if (!f.partilhaReal.cpfs) f.partilhaReal.cpfs = {}; if (f.partilhaReal.taxaFr && !(f.partilhaReal.taxaFr instanceof M.Fr)) f.partilhaReal.taxaFr = f.partilhaReal.taxaFr.n != null ? new M.Fr(f.partilhaReal.taxaFr.n, f.partilhaReal.taxaFr.d) : null; return f; });
    s.doa = { ...novaDoacao(), ...(r.doa || {}) }; ['doadores', 'donatarios', 'bens'].forEach(c => { if (!Array.isArray(s.doa[c])) s.doa[c] = []; }); s.doa.donatarios.forEach(x => { if (!x.uid) x.uid = uid(); });
    return s;
  }
  $('#btRestaurar').addEventListener('click', () => { try { const r = JSON.parse(localStorage.getItem('itcmd-rascunho')); if (r && r.S) { S = migrar(r.S); renderForm(); calcular(); toast('Rascunho restaurado'); } } catch (e) { toast('Rascunho ilegível'); } $('#barraRascunho').classList.add('oculto'); });
  $('#btDescartar').addEventListener('click', () => { try { localStorage.removeItem('itcmd-rascunho'); } catch (e) { } $('#barraRascunho').classList.add('oculto'); });
  function salvarAuto(avisar) { try { localStorage.setItem('itcmd-rascunho', JSON.stringify({ S, em: Date.now() })); if (avisar) toast('Rascunho salvo neste navegador'); } catch (e) { if (avisar) toast('Não foi possível salvar aqui'); } }
  let toastTimer = null;
  function toast(m) { if (typeof window.toast === 'function') { try { window.toast(m); return; } catch (e) { } } const t = $('#itcToast'); if (!t) return; t.textContent = m; t.classList.add('ativo'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('ativo'), 2200); }

  /* ---------- v1.42 — Importação do dossiê (PDF → campos) ----------
     Dentro do Hub existem api(), criarAnexos(), blobParaBase64(), mensagemErroIA() e
     htmlProgresso() (app.js, mesmo <script>). A zona de anexos só nasce quando eles
     existem; fora do Hub (piloto/artefato) fica a nota do corpo.html. O servidor devolve
     um objeto de FORMA FIXA (hub.js: normalizarDossieItcmd) — aqui ele vira o estado S,
     com S.origem guardando quais caminhos vieram do dossiê (marca "do dossiê") e os
     avisos. O VALOR DECLARADO dos bens fica 0 e ganha o realce "lançar o valor"; a
     referência achada nos documentos aparece como dica ao lado. */
  const brParaISO = t => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(t || '').trim()); if (!m) return ''; const dt = new Date(+m[3], +m[2] - 1, +m[1]); if (dt.getFullYear() !== +m[3] || dt.getMonth() !== +m[2] - 1 || dt.getDate() !== +m[1]) return ''; return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; };
  const normNome = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
  function estadoDoDossie(d) {
    const s = estadoInicial(); const paths = {}; const avisos = []; const resumo = [];
    const mk = (p, fonte) => { paths[p] = fonte || 'dossiê'; };
    const nomeOk = x => x && (x.nome || '').trim();
    const bemDo = (b, extra) => { const nat = b.natureza || ''; const fr = parseFloat(b.fracao_do_falecido != null ? b.fracao_do_falecido : b.fracao); const desc = b.descricao + (b.matricula && !b.descricao.toLowerCase().includes(b.matricula.toLowerCase()) ? ` — matrícula ${b.matricula}` : '');
      return { descricao: desc.slice(0, 300), tipo: b.tipo || 'imovel_urbano', valor: 0, natureza: nat || 'comum', fracao: fr > 0 && fr <= 100 ? fr : 100, valorRef: Math.max(0, +b.valor_referencia || 0), valorRefFonte: b.fonte_valor || '', matricula: b.matricula || '', inscricao: b.inscricao_municipal_incra || '', doDossie: true, ...(extra || {}) }; };
    const marcarBem = (base, i, b) => { ['descricao', 'fracao'].forEach(k => mk(`${base}.${i}.${k}`)); if (b.tipo) mk(`${base}.${i}.tipo`); else avisos.push(`Bem "${b.descricao}": tipo não identificado — ficou "imóvel urbano"; confira.`); if (b.matricula) mk(`${base}.${i}.matricula`); if (b.inscricao_municipal_incra) mk(`${base}.${i}.inscricao`); };
    if (d.operacao === 'doacao' || (!d.falecidos.length && (d.doacao.doadores.length || d.doacao.donatarios.length))) {
      s.modo = 'doacao';
      const doa = s.doa;
      doa.doadores = d.doacao.doadores.length ? d.doacao.doadores.map(x => ({ nome: x.nome })) : [{ nome: '' }];
      doa.doadores.forEach((x, i) => { if (x.nome) mk(`doa.doadores.${i}.nome`); });
      doa.donatarios = d.doacao.donatarios.length ? d.doacao.donatarios.map(x => pessoa({ nome: x.nome, doacoesAnteriores: +x.doacoes_anteriores_no_ano || 0, impostoAnterior: +x.itcmd_recolhido_anteriores || 0 })) : [pessoa({ nome: '', doacoesAnteriores: 0, impostoAnterior: 0 })];
      doa.donatarios.forEach((x, i) => { if (x.nome) mk(`doa.donatarios.${i}.nome`); if (x.doacoesAnteriores) { mk(`doa.donatarios.${i}.doacoesAnteriores`); avisos.push(`${x.nome}: doações anteriores no exercício lançadas (${fmt(x.doacoesAnteriores)}) — confira a guia/declaração.`); } if (x.impostoAnterior) mk(`doa.donatarios.${i}.impostoAnterior`); });
      doa.reservaUsufruto = d.doacao.reserva_usufruto === true;
      if (d.doacao.reserva_usufruto === null) avisos.push('Não ficou claro se há reserva de usufruto — ficou desmarcado; confira o requerimento.');
      if (d.doacao.data_prevista && brParaISO(d.doacao.data_prevista)) { doa.data = brParaISO(d.doacao.data_prevista); mk('doa.data'); }
      doa.bens = d.doacao.bens.length ? d.doacao.bens.map(b => { let destino = 'todos'; if (b.destino && b.destino !== 'todos') { const alvo = doa.donatarios.find(x => x.nome.trim().toLowerCase() === b.destino.trim().toLowerCase()); if (alvo) destino = alvo.uid; else avisos.push(`Bem "${b.descricao}": o requerimento destina a "${b.destino}", que não está entre os donatários — ficou "todos, em partes iguais". Confira.`); } return bemDo(b, { destino }); }) : [{ descricao: '', tipo: 'imovel_urbano', valor: 0, fracao: 100, destino: 'todos' }];
      doa.bens.forEach((b, i) => { if (b.descricao) { marcarBem('doa.bens', i, d.doacao.bens[i] || {}); mk(`doa.bens.${i}.destino`); } });
      resumo.push(`Doação — ${doa.doadores.filter(nomeOk).length} doador(es), ${doa.donatarios.filter(nomeOk).length} donatário(s), ${doa.bens.filter(x => x.descricao).length} bem(ns)${doa.reservaUsufruto ? ', com reserva de usufruto' : ''}`);
      if (!doa.donatarios.some(nomeOk)) avisos.push('Nenhum donatário identificado no dossiê — cadastre à mão.');
    } else {
      if (!d.falecidos.length) { avisos.push('Nenhum falecido identificado no dossiê: confira se o requerimento e a certidão de óbito foram anexados.'); }
      s.modo = d.falecidos.length >= 2 ? 'cumulativo' : 'inventario';
      if (d.operacao === 'cumulativo' && d.falecidos.length < 2) avisos.push('O requerimento fala em inventário cumulativo, mas só um falecido foi identificado — confira a certidão de óbito do outro.');
      const fals = d.falecidos.slice(0, 2);
      if (fals.length === 2) {
        const o0 = brParaISO(fals[0].data_obito), o1 = brParaISO(fals[1].data_obito);
        if (o0 && o1 && o1 < o0) { fals.reverse(); avisos.push('Os falecidos vieram fora da ordem cronológica — reordenados (1º óbito primeiro).'); }
        // G1: um bem nos dois falecidos é o MESMO bem — no 2º inventário ele já entra pela meação/quinhão
        const numMat = x => String(x.matricula || '').replace(/\D/g, ''), descN = x => normNome(x.descricao);
        const mats1 = new Set(fals[0].bens.map(numMat).filter(Boolean)), descs1 = new Set(fals[0].bens.map(descN).filter(Boolean));
        fals[1].bens = fals[1].bens.filter(x => { if ((numMat(x) && mats1.has(numMat(x))) || (descN(x) && descs1.has(descN(x)))) { avisos.push(`Bem "${x.descricao}" constava nos dois falecidos — retirado do 2º inventário: a meação e o quinhão do 2º falecido nesse bem já entram sozinhos. Lance no 2º só bens próprios adquiridos depois.`); return false; } return true; });
      }
      fals.forEach((fd, k) => {
        const b = `inv.${k}`; const f = novoFalecido('', 'solteiro');
        if (fd.nome) { f.nome = fd.nome; mk(`${b}.nome`); }
        const obito = brParaISO(fd.data_obito); if (obito) { f.obito = obito; mk(`${b}.obito`); } else avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: data do óbito não identificada — lance à mão.`);
        const ec = fd.estado_civil_no_obito, c = fd.conjuge;
        const casadoNoPapel = (ec === 'casado' || ec === 'uniao_estavel' || ec === 'separado') && c.sobrevivente !== false;
        const planoB = !ec && c.nome && c.sobrevivente === true;   // estado civil não veio, mas o cônjuge veio vivo
        if (casadoNoPapel || planoB) {
          f.estadoCivil = ec === 'uniao_estavel' ? 'uniao' : 'casado'; mk(`${b}.estadoCivil`);
          if (planoB) avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: estado civil no óbito não identificado, mas consta cônjuge sobrevivente ${c.nome} — tratado como casado(a); confira a certidão de óbito.`);
          if (ec === 'separado') { f.conjuge.separadoFato = true; mk(`${b}.conjuge.separadoFato`); avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: consta "separado(a)" — mantido(a) ${c.nome || 'o(a) cônjuge'} como meeiro(a) sem herdar (art. 1.830 CC); se a partilha já foi feita na separação, troque para "Não".`); }
          if (c.nome) { f.conjuge.nome = c.nome; mk(`${b}.conjuge.nome`); }
          if (c.regime) { f.regime = c.regime; mk(`${b}.regime`); } else avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: regime de bens não identificado${c.regime_como_consta ? ` ("${c.regime_como_consta}")` : ''} — ficou comunhão parcial; confira na certidão de casamento.`);
          if (c.separado_de_fato === true) { f.conjuge.separadoFato = true; mk(`${b}.conjuge.separadoFato`); }
          if (c.sumula_377 === true && f.regime === 'separacao_obrig') { f.conjuge.sumula377 = true; mk(`${b}.conjuge.sumula377`); avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: os documentos citam a Súmula 377/STF — caixa "Aplicar a Súmula 377" marcada (meação nos bens adquiridos na constância); confira.`); }
          if (c.sobrevivente === null) avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: não ficou claro se o(a) cônjuge/companheiro(a) ${c.nome ? c.nome + ' ' : ''}sobreviveu — confira.`);
        } else {
          f.estadoCivil = 'solteiro'; if (ec) mk(`${b}.estadoCivil`);
          if (ec === 'separado' && c.sobrevivente === false) avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: separado(a) e o(a) cônjuge já falecido(a) — sem meação.`);
          if (!ec) avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: estado civil no óbito não identificado — ficou "sem viúvo(a)"; confira a certidão de óbito.`);
          if ((ec === 'casado' || ec === 'uniao_estavel') && c.sobrevivente === false) avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: o(a) cônjuge ${c.nome || ''} já havia falecido — tratado como sem viúvo(a).`);
        }
        const conjNorm = normNome(c.nome);
        const filhos = fd.filhos.filter(h => nomeOk(h) || (h.representantes || []).some(nomeOk)).filter(h => {
          if (conjNorm && normNome(h.nome) === conjNorm) { avisos.push(`${h.nome} é o(a) cônjuge sobrevivente e veio também como filho(a) — retirado(a) da lista de filhos (a meação e a concorrência são calculadas sozinhas).`); return false; }
          return true;
        });
        if (filhos.length) {
          f.descendentes = filhos.map(h => pessoa({ nome: h.nome || (avisos.push('Um filho pré-morto veio sem nome (só os netos) — cadastrado como "(filho pré-morto sem nome)"; complete.'), '(filho pré-morto sem nome)'), condicao: (h.situacao === 'falecido' || !h.nome) ? 'premorto' : h.situacao === 'renunciou' ? 'renuncia' : 'vivo', representantes: (h.representantes || []).filter(nomeOk).map(r => pessoa({ nome: r.nome })) }));
          f.descendentes.forEach((x, i) => { mk(`${b}.descendentes.${i}.nome`); mk(`${b}.descendentes.${i}.condicao`); x.representantes.forEach((r, j) => mk(`${b}.descendentes.${i}.representantes.${j}.nome`)); if (x.condicao === 'premorto' && !x.representantes.length) avisos.push(`${x.nome} consta como já falecido(a), mas nenhum filho dele(a) foi identificado — cadastre os netos ou remova.`); });
          if (filhos.some(h => h.filho_do_conjuge_sobrevivente === false)) { f.filhosComuns = 'nao'; mk(`${b}.filhosComuns`); }
          else if (f.estadoCivil !== 'solteiro' && M.regras(f).concorreDesc !== 'nada' && filhos.some(h => h.filho_do_conjuge_sobrevivente !== true)) avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: não ficou claro se todos os filhos são também do(a) sobrevivente — ficou "Sim" (reserva de 1/4, art. 1.832); confira as certidões de nascimento.`);
          else if (f.estadoCivil !== 'solteiro' && filhos.every(h => h.filho_do_conjuge_sobrevivente === true)) mk(`${b}.filhosComuns`);
        } else {
          const a = fd.ascendentes;
          if (a.pai.vivo === true) { f.ascendentes.paiVivo = true; f.ascendentes.pai = a.pai.nome; mk(`${b}.ascendentes.paiVivo`); if (a.pai.nome) mk(`${b}.ascendentes.pai`); }
          if (a.mae.vivo === true) { f.ascendentes.maeViva = true; f.ascendentes.mae = a.mae.nome; mk(`${b}.ascendentes.maeViva`); if (a.mae.nome) mk(`${b}.ascendentes.mae`); }
          if (a.avos_paternos_vivos != null) { f.ascendentes.avosPaternos = a.avos_paternos_vivos; mk(`${b}.ascendentes.avosPaternos`); }
          if (a.avos_maternos_vivos != null) { f.ascendentes.avosMaternos = a.avos_maternos_vivos; mk(`${b}.ascendentes.avosMaternos`); }
          const cols = fd.colaterais.filter(nomeOk);
          if (cols.length) {
            f.colaterais = cols.map(c2 => pessoa({ nome: c2.nome, grau: c2.parentesco || 'irmao', tipo: c2.vinculo || 'bilateral', condicao: c2.situacao === 'falecido' ? 'premorto' : c2.situacao === 'renunciou' ? 'renuncia' : 'vivo', representantes: (c2.representantes || []).filter(nomeOk).map(r => pessoa({ nome: r.nome })) }));
            f.colaterais.forEach((x, i) => { ['nome', 'grau', 'tipo', 'condicao'].forEach(k2 => mk(`${b}.colaterais.${i}.${k2}`)); x.representantes.forEach((r, j) => mk(`${b}.colaterais.${i}.representantes.${j}.nome`)); });
          }
          if (!f.ascendentes.paiVivo && !f.ascendentes.maeViva && !cols.length) avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: nenhum herdeiro identificado no dossiê — cadastre à mão.`);
        }
        if (fd.bens.length) {
          f.bens = fd.bens.map(bm => bemDo(bm));
          f.bens.forEach((bm, i) => { marcarBem(`${b}.bens`, i, fd.bens[i] || {}); if ((fd.bens[i] || {}).natureza) mk(`${b}.bens.${i}.natureza`); });
          fd.bens.forEach(bm => { if (!bm.natureza && f.estadoCivil !== 'solteiro') avisos.push(`Bem "${bm.descricao}": não ficou claro se era do casal ou só do(a) falecido(a) — ficou "do casal"; confira pela data de aquisição.`); });
        } else avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: nenhum bem identificado — cadastre à mão.`);
        if (+fd.dividas > 0) { f.dividas = +fd.dividas; mk(`${b}.dividas`); }
        const req = brParaISO(fd.inventario_requerido_em);
        if (req && obito && diasEntre(obito, req) <= 120 && diasEntre(obito, req) >= 0) { f.multaAtraso = false; mk(`${b}.multaAtraso`); avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: inventário requerido em ${dataBR(req)}, dentro dos 120 dias do óbito — multa de 20% desligada.`); }
        // v1.43 — dados da Declaração do ITCMD (SEFAZ)
        const dc = f.decl = novaDecl();
        if (fd.cpf) { if (/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(String(fd.cpf).trim())) { dc.cpf = fd.cpf; mk(`${b}.decl.cpf`); } else avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: CPF veio como "${fd.cpf}" (formato inválido) — não foi lançado.`); }
        if (f.estadoCivil === 'solteiro' && ['solteiro', 'viuvo', 'divorciado', 'separado'].includes(ec)) { dc.estadoCivilObito = ec; mk(`${b}.decl.estadoCivilObito`); }
        else if (f.estadoCivil === 'solteiro' && c.sobrevivente === false && (ec === 'casado' || ec === 'uniao_estavel')) { dc.estadoCivilObito = 'viuvo'; mk(`${b}.decl.estadoCivilObito`); }
        if (f.estadoCivil !== 'solteiro' && brParaISO(c.data_casamento)) { dc.dataCasamento = brParaISO(c.data_casamento); mk(`${b}.decl.dataCasamento`); }
        // R14 (Manual SEFAZ, item 2): a "data de abertura" do extrajudicial é a da ESCRITURA de abertura/nomeação — não vem do óbito nem do requerimento; fica para a escrevente
        if (req) avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: a data de abertura do inventário (quadro 2 da declaração) é a da escritura de abertura/nomeação de inventariante — não foi preenchida com a data do requerimento (${dataBR(req)}).`);
        const rq = d.requerimento || {};
        if (rq.tipo_inventario === 'judicial') { dc.tipo = 'judicial'; mk(`${b}.decl.tipo`); if (rq.processo) { dc.processo = rq.processo; mk(`${b}.decl.processo`); } if (rq.vara_comarca) { dc.vara = rq.vara_comarca; mk(`${b}.decl.vara`); } }
        const ivt = d.inventariante || {};
        if (ivt.nome) { dc.inventariante = { nome: ivt.nome, cpf: /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(String(ivt.cpf || '').trim()) ? ivt.cpf : '', endereco: ivt.endereco || '', contato: ivt.telefone_email || '' }; if (ivt.cpf && !dc.inventariante.cpf) avisos.push(`Inventariante: CPF veio como "${ivt.cpf}" (formato inválido) — não foi lançado.`); ['nome', 'cpf', 'endereco', 'contato'].forEach(k2 => { if (dc.inventariante[k2]) mk(`${b}.decl.inventariante.${k2}`); }); }
        else avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: inventariante não identificado no requerimento — preencha em "E · Declaração ITCMD" quando for gerar o formulário.`);
        // v1.43 — CPF do cônjuge e dos herdeiros (quadro 8 / Inter Vivos I)
        const pr = f.partilhaReal = novaPartilhaReal();
        const cpfOk = v => /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(String(v || '').trim());
        const porNome = {};   // nome normalizado → id da linha da partilha
        if (c.nome && f.estadoCivil !== 'solteiro') { porNome[normNome(c.nome)] = 'conjuge'; if (cpfOk(c.cpf)) { pr.cpfs.conj = c.cpf; pr.cpfs.meacao = c.cpf; mk(`${b}.partilhaReal.cpfs.conj`); mk(`${b}.partilhaReal.cpfs.meacao`); } }
        const ligar = (lista, pessoas) => lista.forEach((h, i) => { const x = pessoas[i]; if (!x) return; if (normNome(h.nome)) porNome[normNome(h.nome)] = x.uid; if (cpfOk(h.cpf)) { pr.cpfs[x.uid] = h.cpf; mk(`${b}.partilhaReal.cpfs.${x.uid}`); }
          (h.representantes || []).filter(nomeOk).forEach((r, j) => { const y = (x.representantes || [])[j]; if (!y) return; porNome[normNome(r.nome)] = y.uid; if (cpfOk(r.cpf)) { pr.cpfs[y.uid] = r.cpf; mk(`${b}.partilhaReal.cpfs.${y.uid}`); } }); });
        if (filhos.length) ligar(filhos, f.descendentes); else ligar(fd.colaterais.filter(nomeOk), f.colaterais);
        // v1.43 — partilha acordada diferente da legal (cessão gratuita/onerosa entre herdeiros → bloco F)
        const pt = fd.partilha || {}; const cess = (pt.cessoes || []).filter(x => x.cedente && x.beneficiario);
        if (cess.length) {
          const idDe = n => porNome[normNome(n)] || '';
          const benefs = [...new Set(cess.map(x => idDe(x.beneficiario)))];
          const semId = cess.filter(x => !idDe(x.cedente) || !idDe(x.beneficiario)).map(x => `${x.cedente} → ${x.beneficiario}`);
          const fracs = [...new Set(cess.map(x => String(x.fracao_do_quinhao || '').replace(/\s+/g, '')))];
          const nat = cess.find(x => x.natureza) ? cess.find(x => x.natureza).natureza : '';
          pr.ativa = true; mk(`${b}.partilhaReal.ativa`);
          pr.natureza = nat === 'onerosa' ? 'onerosa' : 'nao_onerosa'; if (nat) mk(`${b}.partilhaReal.natureza`); else avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: o requerimento não diz se a cessão é gratuita ou onerosa — ficou "não onerosa" (ITCMD doação); confira.`);
          if (benefs.length === 1 && benefs[0] && !semId.length && fracs.length === 1 && fracs[0]) {
            let taxaOk = true; try { lerTaxa(fracs[0]); } catch (e) { taxaOk = false; avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: a fração/percentual da cessão veio como "${fracs[0]}" e não pôde ser lida (${e.message}) — corrija no bloco F.`); }
            pr.beneficiario = benefs[0]; pr.taxaTxt = fracs[0]; mk(`${b}.partilhaReal.beneficiario`); mk(`${b}.partilhaReal.taxaTxt`);
            const cedIds = cess.map(x => idDe(x.cedente));
            if (cedIds.includes('conjuge')) { pr.incluirMeacao = true; mk(`${b}.partilhaReal.incluirMeacao`); }
            Object.values(porNome).forEach(id => { if (id !== pr.beneficiario && id !== 'conjuge' && !cedIds.includes(id)) pr.cedentes[id] = false; });
            if (!cedIds.includes('conjuge') && porNome[normNome(c.nome)] === 'conjuge') pr.cedentes.conj = false;
            if (taxaOk) { pr.atalho = { taxaTxt: fracs[0], alvoTxt: '' }; pr.atalhoVivo = true; }
            avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: partilha acordada diferente da legal — ${cess.length} cedente(s) transfere(m) ${fracs[0]}${/\//.test(fracs[0]) ? '' : '%'} do próprio quinhão a ${cess[0].beneficiario} (${pr.natureza === 'onerosa' ? 'cessão onerosa' : 'transmissão não onerosa'}). Bloco F preenchido${taxaOk ? '; a cessão é aplicada assim que os valores dos bens forem lançados — confira os quinhões reais' : ''}${pt.fonte || cess[0].fonte ? ' (fonte: ' + (cess[0].fonte || pt.fonte) + ')' : ''}.`);
          } else {
            if (benefs.length === 1 && benefs[0]) { pr.beneficiario = benefs[0]; mk(`${b}.partilhaReal.beneficiario`); }
            avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: o requerimento traz partilha desigual (${cess.map(x => `${x.cedente} cede ${x.fracao_do_quinhao || '?'} a ${x.beneficiario}`).join('; ')}${pt.descricao ? ' — ' + pt.descricao : ''})${semId.length ? ' — não reconheci: ' + semId.join(', ') : ''}${fracs.length > 1 ? ' — frações diferentes por cedente' : ''}. Bloco F aberto: lance os quinhões reais à mão.`);
          }
        } else if (pt.desigual === true) { pr.ativa = true; mk(`${b}.partilhaReal.ativa`); avisos.push(`${fd.nome || 'Falecido ' + (k + 1)}: o requerimento indica partilha diferente da legal${pt.descricao ? ' (' + pt.descricao + ')' : ''}, mas sem as frações — lance os quinhões reais no bloco F.`); }
        s.inv[k] = f;
        resumo.push(`${k === 0 && fals.length > 1 ? '1º falecido: ' : fals.length > 1 ? '2º falecido: ' : 'Falecido(a): '}${f.nome || '(sem nome)'}${f.obito ? ' — óbito em ' + dataBR(f.obito) : ''}${f.estadoCivil !== 'solteiro' ? ` — ${f.estadoCivil === 'uniao' ? 'companheiro(a)' : 'viúvo(a)'} ${f.conjuge.nome || '(sem nome)'}, ${(REGIMES.find(r => r[0] === f.regime) || ['', f.regime])[1].toLowerCase()}` : ' — sem viúvo(a)'} — ${f.descendentes.filter(nomeOk).length} filho(s)${f.descendentes.some(x => x.condicao === 'premorto') ? ' (com representação)' : ''}${f.descendentes.some(x => x.condicao === 'renuncia') ? ' (com renúncia)' : ''} — ${f.bens.filter(x => x.descricao).length} bem(ns)`);
      });
    }
    return { s, paths, avisos, resumo };
  }
  let ANTES_IMPORTACAO = null;
  function importarDossie(dados, meta) {
    const r = estadoDoDossie(dados);
    ANTES_IMPORTACAO = JSON.parse(JSON.stringify(S));
    S = r.s; ABERTOS = {};
    S.origem = { modo: S.modo, paths: r.paths, avisos: r.avisos, alertasModelo: dados.alertas || [], alertasServidor: (meta && meta.alertas) || [], resumo: r.resumo, requerimento: dados.requerimento || {}, advogado: dados.advogado || {}, meta: { modelo: meta && meta.modelo, ms: meta && meta.ms, custo: meta && meta.custo_usd, arquivos: meta && meta.arquivos, quando: new Date().toISOString() } };
    renderForm(); calcular(); salvarAuto();
    const alvo = $('#itcmdImportado'); if (alvo) { const bv = $('#barraViva'); alvo.style.scrollMarginTop = ((bv ? bv.offsetHeight : 0) + 12) + 'px'; alvo.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    toast('Dossiê importado — confira os campos e lance os valores');
  }
  function valoresPendentes() {
    const lista = S.modo === 'doacao' ? [S.doa.bens] : (S.modo === 'cumulativo' ? [S.inv[0].bens, S.inv[1].bens] : [S.inv[0].bens]);
    return lista.reduce((n, bs) => n + bs.filter(b => b.doDossie && !(+b.valor)).length, 0);
  }
  function renderImportacao() {
    const p = $('#itcmdImportado'); if (!p) return;
    if (!S.origem) { p.classList.add('oculto'); p.innerHTML = ''; return; }
    const o = S.origem; const pend = valoresPendentes();
    if (o.modo && o.modo !== S.modo) {
      const nomeModo = { inventario: 'inventário', cumulativo: 'inventário cumulativo', doacao: 'doação' }[o.modo] || o.modo;
      p.innerHTML = `<h3>Dados importados do dossiê</h3><p class="notinha">Os dados importados são de um <b>${nomeModo}</b> — volte a esse modo (quadro 1) para vê-los. <button type="button" class="btn mini" id="btVoltarModoImportado">Voltar para ${esc(nomeModo)}</button></p>`;
      p.classList.remove('oculto'); return;
    }
    const li = xs => xs.map(a => `<li>${esc(typeof a === 'string' ? a : (a && (a.texto || a.mensagem || a.tipo)) || JSON.stringify(a))}</li>`).join('');
    let h = `<h3>✓ Dados importados do dossiê</h3>`;
    if (o.requerimento && o.requerimento.resumo) h += `<p class="notinha"><b>Requerimento${o.requerimento.data ? ' de ' + esc(o.requerimento.data) : ''}${o.advogado && o.advogado.nome ? ' — ' + esc(o.advogado.nome) + (o.advogado.oab ? ', ' + (/^oab/i.test(o.advogado.oab) ? '' : 'OAB ') + esc(o.advogado.oab) : '') : ''}:</b> ${esc(o.requerimento.resumo)}</p>`;
    h += `<div class="chips">${o.resumo.map(x => `<span class="chip">${esc(x)}</span>`).join('')}<span class="chip">${pend ? pend + ' valor(es) a lançar' : 'valores lançados'}</span></div>`;
    if (o.avisos.length) h += `<p><b>Conferir na tela</b></p><ul>${li(o.avisos)}</ul>`;
    if (o.alertasModelo.length) h += `<p><b>Apontamentos do leitor</b></p><ul>${li(o.alertasModelo)}</ul>`;
    if (o.alertasServidor.length) h += `<p><b>Avisos do servidor</b></p><ul>${li(o.alertasServidor)}</ul>`;
    h += `<div class="acoes"><button type="button" class="btn primario" id="btLancarValores">${pend ? 'Lançar os valores →' : 'Ver a sucessão →'}</button><button type="button" class="btn" id="btDesfazerImportacao">Desfazer importação</button></div>`;
    h += `<p class="meta">Os campos marcados "do dossiê" vieram da leitura dos documentos; o que você digitar por cima vale. Só o valor declarado de cada bem é lançado à mão.${o.meta && o.meta.modelo ? ` Leitura por ${esc(String(o.meta.modelo))}${o.meta.ms ? ' em ' + Math.round(o.meta.ms / 1000) + ' s' : ''}.` : ''}</p>`;
    p.innerHTML = h; p.classList.remove('oculto');
  }
  RAIZ.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'btVoltarModoImportado') { if (S.origem && S.origem.modo) { S.modo = S.origem.modo; renderForm(); calcular(); salvarAuto(); } return; }
    if (b.id === 'btLancarValores') { const alvo = $('.campo.pendente input') || $('#formInventarios input, #formDoacao input'); if (alvo) { alvo.scrollIntoView({ behavior: 'smooth', block: 'center' }); alvo.focus(); } return; }
    if (b.id === 'btDesfazerImportacao') { if (ANTES_IMPORTACAO) { S = migrar(ANTES_IMPORTACAO); ANTES_IMPORTACAO = null; } else { S = estadoInicial(); } renderForm(); calcular(); salvarAuto(); toast('Importação desfeita — os campos voltaram ao que eram'); return; }
  });
  function montarImportacao() {
    const miolo = $('#itcmdImportarMiolo'); if (!miolo) return;
    const dentroDoHub = typeof api === 'function' && typeof criarAnexos === 'function' && typeof blobParaBase64 === 'function';
    if (!dentroDoHub) return;
    miolo.innerHTML = `<div class="importar-zona zona-anexos" data-anexos="itcmd">
        <div class="anexo-drop"><input type="file" accept="image/*,application/pdf" multiple hidden><button class="btn-fantasma" data-anexar type="button">Adicionar PDF ou foto</button><span class="anexo-dica">arraste aqui o requerimento e os documentos (até 12 arquivos, 13 MB somados)</span></div>
        <ul class="anexo-lista"></ul><p class="cont-anexos"></p><p class="aviso" data-aviso-anexo hidden></p>
        <textarea id="itcmdObs" placeholder="Observações (opcional) — ex.: o herdeiro Pedro renunciou; o regime é comunhão universal conforme pacto"></textarea>
      </div>
      <div class="acoes"><button type="button" class="btn primario" id="btExtrairDossie">Extrair dados do dossiê</button><span class="notinha">Os documentos vão ao servidor do cartório só para esta leitura e não ficam gravados. Custa alguns centavos de IA por leitura.</span></div>
      <div id="itcmdImportarStatus"></div>`;
    const zona = miolo.querySelector('.zona-anexos');
    const anexos = criarAnexos(zona);
    const status = $('#itcmdImportarStatus'), btn = $('#btExtrairDossie');
    let ctrl = null, relogio = null;
    btn.addEventListener('click', () => {
      if (ctrl) { ctrl.abort(); return; }
      const arqs = anexos.itens();
      if (!arqs.length) { status.innerHTML = ''; toast('Anexe o requerimento e os documentos do dossiê'); return; }
      if (typeof IA_STATUS !== 'undefined' && IA_STATUS && IA_STATUS.configurada === false) { status.innerHTML = '<div class="aviso erro">A IA ainda não foi ligada no servidor — avise o Tabelião.</div>'; return; }
      ctrl = new AbortController(); btn.textContent = 'Interromper';
      const t0 = Date.now();
      const pintar = () => { const seg = Math.round((Date.now() - t0) / 1000); status.innerHTML = typeof htmlProgresso === 'function' ? htmlProgresso(`Lendo ${arqs.length} arquivo(s) do dossiê…`, seg) : `<div class="importar-progresso"><b>Lendo o dossiê…</b>${seg} s — a IA está trabalhando; costuma levar até um minuto.</div>`; };
      pintar(); relogio = setInterval(pintar, 1000);
      const obs = ($('#itcmdObs').value || '').trim().slice(0, 4000);
      Promise.all(arqs.map(a => blobParaBase64(a.blob).then(b64 => ({ nome: a.nome, mime: a.mime, base64: b64 })))).then(arquivos => {
        const corpo = { arquivos }; if (obs) corpo.texto = obs;
        return api('/hub/ia/itcmd', { corpo, sinal: ctrl.signal });
      }).then(r => {
        clearInterval(relogio); status.innerHTML = '';
        if (!r || !r.dados) throw { status: 502, erro: 'resposta sem dados' };
        importarDossie(r.dados, { modelo: r.modelo, ms: r.ms, custo_usd: r.custo_usd, alertas: r.alertas, arquivos: arqs.map(a => a.nome) });
      }).catch(e => {
        clearInterval(relogio);
        const msg = (e && e.status === 502 && e.dados && e.dados.motivo === 'json') ? 'O modelo não devolveu dados estruturados — tente de novo. Os campos não foram alterados.' : (typeof mensagemErroIA === 'function' ? mensagemErroIA(e) : (e && e.erro) || 'falha na leitura');
        status.innerHTML = (e && e.cancelado) ? '<p class="notinha">Leitura interrompida.</p>' : `<div class="aviso erro importar-erro">${esc(msg)}</div>`;
      }).then(() => { ctrl = null; btn.textContent = 'Extrair dados do dossiê'; });
    });
  }
  montarImportacao();

  /* ---------- v1.43 — Declaração do ITCMD (SEFAZ) ---------- */
  function invsAtuais() { if (!ULT || ULT.modo === 'doacao') return []; return ULT.modo === 'cumulativo' ? [ULT.c.inv1, ULT.c.inv2] : [ULT.inv]; }
  function gerarDeclaracao(ignorarPendencias) {
    const aviso = $('#declAviso'), link = $('#declBaixar');
    if (!aviso) return;
    const mostrar = h => { aviso.innerHTML = h; aviso.classList.remove('oculto'); };
    if (!window.ITCMD_DECL || typeof PDFMini !== 'function') { mostrar('<div class="aviso">A geração do PDF funciona dentro do Hub CN2O.</div>'); return; }
    if (!ULT || ULT.modo === 'doacao') { mostrar('<div class="aviso">A declaração "causa mortis" vale para inventário e inventário cumulativo. Para doação, a SEFAZ usa a declaração "inter vivos" — ainda não está nesta versão.</div>'); return; }
    if (valoresPendentes()) { mostrar('<div class="aviso erro">Há bens sem o valor declarado — lance os valores antes de gerar a declaração.</div>'); const alvo = $('.campo.pendente input'); if (alvo) alvo.focus(); return; }
    const invs = invsAtuais();
    let quem = ''; try { quem = (typeof SESSAO !== 'undefined' && SESSAO && SESSAO.nome) ? String(SESSAO.nome) : ''; } catch (e) { }
    const temExced = invs.some(inv => inv.exced);
    const comErro = invs.map((inv, i) => ({ inv, pr: (ULT.modo === 'cumulativo' ? S.inv[i] : S.inv[0]).partilhaReal })).filter(x => x.pr && x.pr.ativa && x.pr.atalhoVivo && x.pr.erroAtalho);
    if (comErro.length) { mostrar(`<div class="aviso erro">A cessão do bloco F de ${esc(comErro.map(x => x.inv.falecido.nome || 'falecido').join(' e '))} não pôde ser aplicada (${esc(comErro[0].pr.erroAtalho)}) — corrija antes de gerar.</div>`); return; }
    const invsBloq = invs.filter(inv => inv.real && inv.real.ativa && Math.abs(inv.real.diferenca) >= 0.01);
    if (invsBloq.length) { mostrar(`<div class="aviso erro">A partilha acordada de ${esc(invsBloq.map(i => i.falecido.nome || 'falecido').join(' e '))} não fecha (bloco F): ajuste os quinhões reais até a diferença ser zero antes de gerar.</div>`); return; }
    const pend = invs.map((inv, k) => ({ k, nome: inv.falecido.nome || (k ? '2º falecido' : 'falecido'), itens: window.ITCMD_DECL.pendencias(window.ITCMD_DECL.dadosDeclaracao(S, inv, { quem })) })).filter(x => x.itens.length);
    if (temExced) invs.forEach(inv => { if (!inv.exced) return; inv.real.beneficiarios.forEach(b => { const it = window.ITCMD_DECL.pendenciasIV(window.ITCMD_DECL.dadosInterVivos(S, inv, b, { quem })); if (it.length) pend.push({ k: -1, nome: `Inter Vivos I — ${b.nome}`, itens: it }); }); });
    if (pend.length && !ignorarPendencias) {
      mostrar(`<div class="aviso decl-pendencias"><b>Campos que sairão em branco no formulário</b> (o advogado pode completar à mão):${pend.map(x => `<div style="margin-top:6px"><b>${esc(x.nome)}</b><ul>${x.itens.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}<div class="acoes"><button type="button" class="btn primario" id="btDeclMesmoAssim">Gerar assim mesmo</button><button type="button" class="btn" id="btDeclVoltar">Voltar e completar</button></div></div>`);
      return;
    }
    try {
      const r = window.ITCMD_DECL.gerarPdf(S, invs, { quem });
      const nome = 'Declaracao-ITCMD-' + (invs.map(i => (i.falecido.nome || 'falecido').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')).join('-e-')).slice(0, 80) + '-' + S.hoje + '.pdf';
      const url = URL.createObjectURL(r.blob);
      if (link.dataset.url) { try { URL.revokeObjectURL(link.dataset.url); } catch (e) { } }
      link.href = url; link.download = nome; link.dataset.url = url; link.classList.remove('oculto');
      window.ITCMD_ULTIMO_PDF = r.bytes; window.ITCMD_ULTIMA_DECL = r.dados;
      const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
      let extra = '';
      const iv = temExced ? window.ITCMD_DECL.gerarInterVivos(S, invs, { quem }) : null;
      if (iv) {
        const nomeIV = 'Declaracao-ITCMD-InterVivosI-' + iv.dados.map(D => D.donatario.nome.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')).join('-').slice(0, 60) + '-' + S.hoje + '.pdf';
        const urlIV = URL.createObjectURL(iv.blob);
        const linkIV = $('#declBaixarIV'); if (linkIV) { if (linkIV.dataset.url) { try { URL.revokeObjectURL(linkIV.dataset.url); } catch (e) { } } linkIV.href = urlIV; linkIV.download = nomeIV; linkIV.dataset.url = urlIV; linkIV.classList.remove('oculto'); }
        window.ITCMD_ULTIMO_PDF_IV = iv.bytes; window.ITCMD_ULTIMA_DECL_IV = iv.dados;
        setTimeout(() => { const a2 = document.createElement('a'); a2.href = urlIV; a2.download = nomeIV; document.body.appendChild(a2); a2.click(); a2.remove(); }, 600);
        extra = ` <b>E mais:</b> a <b>Declaração Inter Vivos I</b> do excedente (${iv.dados.length} declaração(ões), ${iv.paginas} página(s)): <b>${esc(nomeIV)}</b> — quadro 6 com a estimativa da Calculadora; o DAE é emitido por donatário.`;
      } else { const linkIV = $('#declBaixarIV'); if (linkIV) linkIV.classList.add('oculto'); }
      mostrar(`<div class="aviso ok">✓ Declaração gerada: <b>${esc(nome)}</b> — ${r.paginas} página(s)${invs.length > 1 ? ', uma declaração por falecido' : ''}. Confira o PDF antes de enviar ao advogado.${pend.length ? ' Campos em branco: ' + pend.map(x => x.itens.length).reduce((s, n) => s + n, 0) + '.' : ''}${extra}</div>`);
      try { if (typeof registrar === 'function') registrar('pdf', 'itcmd', 'declaracao'); } catch (e) { }
      toast('Declaração do ITCMD gerada');
    } catch (e) { console.error(e); mostrar(`<div class="aviso erro">Não foi possível gerar o PDF: ${esc(e.message)}</div>`); }
  }
  RAIZ.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'btDeclaracao') { gerarDeclaracao(false); return; }
    if (b.id === 'btDeclMesmoAssim') { gerarDeclaracao(true); return; }
    if (b.id === 'btDeclVoltar') { $('#declAviso').classList.add('oculto'); const det = $('.bloco-decl'); if (det) { det.open = true; det.scrollIntoView({ behavior: 'smooth', block: 'start' }); const i = det.querySelector('input'); if (i) i.focus(); } return; }
  });

  /* ---------- Início ---------- */
  if (/claude\.ai|claudeusercontent|anthropic/.test(location.hostname)) $('#btImprimir').classList.add('oculto');
  let rascunho = null; try { rascunho = JSON.parse(localStorage.getItem('itcmd-rascunho')); } catch (e) { }
  if (rascunho && rascunho.S) { S = exemplo(); $('#barraRascunho').classList.remove('oculto'); } else S = exemplo();
  renderForm(); calcular();
  window.ITCMD_UI = { get estado() { return S; }, set estado(v) { S = v; renderForm(); calcular(); }, calcular, textoResumo, get ultimo() { return ULT; } };
})();

/* Imagens privadas da Minha Agenda. Nenhum binário ou URL autenticada é persistido no navegador. */
(function (root) {
  'use strict';
  const TIPOS = ['image/png', 'image/jpeg', 'image/webp'];
  const MAX_ORIGINAL = 20 * 1024 * 1024, MAX_BYTES = 1024 * 1024, MAX_LADO = 2560;
  function validarArquivo(file) {
    if (!file || TIPOS.indexOf(file.type) < 0) throw new Error('Escolha um print ou imagem PNG, JPG ou WebP.');
    if (!file.size || file.size > MAX_ORIGINAL) throw new Error('A imagem original deve ter até 20 MB.');
  }
  function dimensoes(w, h) {
    if (!(w > 0 && h > 0) || !Number.isFinite(w * h)) throw new Error('Não foi possível ler esta imagem.');
    const escala = Math.min(1, MAX_LADO / Math.max(w, h));
    return { largura: Math.max(1, Math.round(w * escala)), altura: Math.max(1, Math.round(h * escala)) };
  }
  function comoDataURL(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result)); };
      reader.onerror = function () { reject(new Error('Não foi possível ler esta imagem.')); };
      reader.readAsDataURL(blob);
    });
  }
  async function preparar(file) {
    validarArquivo(file);
    let origem, temporaria;
    try {
      if (typeof createImageBitmap === 'function') {
        try { origem = await createImageBitmap(file); }
        catch (e) { throw new Error('Não foi possível abrir esta imagem. Cole novamente ou escolha um arquivo PNG, JPG ou WebP.'); }
      }
      else {
        temporaria = URL.createObjectURL(file);
        origem = await new Promise(function (resolve, reject) {
          const img = new Image();
          img.onload = function () { resolve(img); };
          img.onerror = function () { reject(new Error('Não foi possível abrir esta imagem.')); };
          img.src = temporaria;
        });
      }
      const d = dimensoes(origem.width, origem.height);
      const canvas = document.createElement('canvas');
      canvas.width = d.largura; canvas.height = d.altura;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Seu navegador não conseguiu preparar a imagem.');
      ctx.drawImage(origem, 0, 0, d.largura, d.altura);
      const codificar = function (tipo, qualidade) {
        return new Promise(function (resolve) { canvas.toBlob(resolve, tipo, qualidade); });
      };
      // PNG conserva as letras dos prints; só comprime com perdas se exceder 1 MB.
      let blob = await codificar('image/png');
      if (!blob || blob.size > MAX_BYTES) {
        blob = null;
        for (const qualidade of [0.92, 0.85, 0.76, 0.66]) {
          const candidato = await codificar('image/webp', qualidade);
          if (candidato && candidato.size <= MAX_BYTES) { blob = candidato; break; }
        }
      }
      if (!blob || blob.size > MAX_BYTES) {
        // Safari antigo pode devolver PNG ao pedir WebP. O fundo branco preserva transparências.
        ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (const qualidade of [0.9, 0.8, 0.7, 0.6]) {
          const candidato = await codificar('image/jpeg', qualidade);
          if (candidato && candidato.size <= MAX_BYTES) { blob = candidato; break; }
        }
      }
      if (!blob || blob.size > MAX_BYTES) throw new Error('Este print tem muitos detalhes para 1 MB. Recorte a parte importante e tente de novo.');
      const dados = await comoDataURL(blob);
      return { base64: dados.slice(dados.indexOf(',') + 1), mime: blob.type };
    } finally {
      if (origem && origem.close) origem.close();
      if (temporaria) URL.revokeObjectURL(temporaria);
    }
  }
  function criar(op) {
    const doc = op.document || document, urls = op.URL || URL, buscar = op.fetch || fetch;
    const estados = new Map(), revisoes = new Map(), requisicoes = new Set();
    let sequencia = 0, geracao = 0, dialogo = null, dono = null;
    const escape = op.escape || function (s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]; }); };
    const chave = function (dia, faixa) { return dia + '|' + faixa; };
    const sessao = function () { const s = op.getSession(); return (s.login || '') + '|' + (s.token || ''); };
    function capturar() { conferirDono(); return { geracao: geracao, sessao: sessao(), sequencia: sequencia }; }
    function atual(ticket) { return ticket.geracao === geracao && ticket.sessao === sessao() && !!op.getSession().token; }
    function conferirDono() {
      const agora = sessao();
      if (dono !== null && dono !== agora) reset();
      dono = agora;
    }
    function obter(k) { if (!estados.has(k)) estados.set(k, { meta: null, url: null, busy: false, erro: '', mensagem: '', carregando: null }); return estados.get(k); }
    function liberar(s) { if (s.url) urls.revokeObjectURL(s.url); s.url = null; }
    function fechar() {
      if (!dialogo) return;
      const anterior = dialogo._foco;
      if (dialogo.open && dialogo.close) dialogo.close();
      dialogo.remove(); dialogo = null;
      if (anterior && anterior.isConnected && anterior.focus) anterior.focus({ preventScroll: true });
    }
    function reset() {
      geracao++; sequencia++;
      requisicoes.forEach(function (c) { c.abort(); }); requisicoes.clear();
      estados.forEach(liberar); estados.clear(); revisoes.clear(); fechar(); dono = null;
      doc.querySelectorAll('[data-ma-imagem]').forEach(function (box) { box.replaceChildren(); });
    }
    function alterarMeta(k, meta) {
      const s = obter(k);
      if ((s.meta && s.meta.versao) !== (meta && meta.versao)) { liberar(s); s.carregando = null; if (dialogo && dialogo.dataset.chave === k) fechar(); }
      s.meta = meta || null;
    }
    function receberPeriodo(de, ate, itens, ticket) {
      if (!atual(ticket)) return;
      const novas = new Map((itens || []).map(function (i) { return [chave(i.dia, i.faixa), i.imagem || null]; }));
      const todas = new Set([...estados.keys(), ...novas.keys()]);
      todas.forEach(function (k) {
        const dia = k.split('|')[0], s = obter(k);
        if (dia < de || dia > ate || s.busy || (revisoes.get(k) || 0) > ticket.sequencia) return;
        alterarMeta(k, novas.get(k) || null);
      });
      pintar();
    }
    function tem(dia, faixa) { const s = estados.get(chave(dia, faixa)); return !!(s && s.meta); }
    function chaves() { return Array.from(estados.keys()).filter(function (k) { return !!estados.get(k).meta; }); }
    function ocupado() { return Array.from(estados.values()).some(function (s) { return s.busy; }); }
    function avisar() { pintar(); if (op.onChange) op.onChange(); }
    async function carregar(k) {
      const s = obter(k);
      if (!s.meta || s.url || s.carregando || s.erro || s.busy) return;
      const ticket = capturar(), versao = s.meta.versao, id = {}, control = new AbortController();
      s.carregando = id; requisicoes.add(control);
      const p = k.split('|');
      try {
        const r = await buscar(op.getEndpoint() + '/hub/agenda/imagem?dia=' + encodeURIComponent(p[0]) + '&faixa=' + encodeURIComponent(p[1]), {
          headers: { 'X-Auth-Token': op.getSession().token }, cache: 'no-store', signal: control.signal
        });
        if (!r.ok) throw { status: r.status, erro: 'Não foi possível carregar o print.' };
        const blob = await r.blob();
        if (!atual(ticket) || s.carregando !== id || !s.meta || s.meta.versao !== versao) return;
        if (TIPOS.indexOf(blob.type) < 0 || blob.size > MAX_BYTES) throw new Error('A imagem recebida não é válida.');
        s.url = urls.createObjectURL(blob);
      } catch (e) {
        if (!atual(ticket) || s.carregando !== id || !s.meta || s.meta.versao !== versao || e.name === 'AbortError') return;
        s.erro = e.erro || e.message || 'Não foi possível carregar o print.';
        if (e.status === 401 && op.onExpired) op.onExpired();
      } finally {
        requisicoes.delete(control);
        if (s.carregando === id) { s.carregando = null; if (atual(ticket)) pintar(); }
      }
    }
    async function salvar(dia, faixa, arquivo) {
      const ticket = capturar(), k = chave(dia, faixa), s = obter(k);
      if (!op.getSession().token || s.busy) return;
      const control = new AbortController(); requisicoes.add(control);
      s.busy = true; s.erro = ''; s.mensagem = arquivo ? 'Preparando print…' : 'Removendo imagem…';
      revisoes.set(k, ++sequencia); avisar();
      try {
        const imagem = arquivo ? await (op.preparar || preparar)(arquivo) : null;
        if (!atual(ticket)) return;
        s.mensagem = arquivo ? 'Salvando print… aguarde.' : 'Removendo imagem…'; avisar();
        const r = await op.request('/hub/agenda/imagem', { corpo: { dia: dia, faixa: faixa, imagem: imagem }, sinal: control.signal, semRedirecionar: true });
        if (!atual(ticket)) return;
        alterarMeta(k, r && r.imagem);
        s.mensagem = arquivo ? '✓ Print salvo' : 'Imagem removida';
      } catch (e) {
        if (!atual(ticket) || e.name === 'AbortError' || e.cancelado) return;
        s.erro = e.erro || e.message || 'Não foi possível salvar. Anexe ou cole o print novamente.';
        s.mensagem = '';
        if (e.status === 401 && op.onExpired) op.onExpired();
      } finally {
        requisicoes.delete(control);
        if (atual(ticket)) { s.busy = false; revisoes.set(k, ++sequencia); avisar(); }
      }
    }
    function html(dia, faixa) { return '<div class="ma-imagem" data-ma-imagem="' + escape(chave(dia, faixa)) + '"></div>'; }
    function ampliar(k) {
      const s = obter(k); if (!s.url) return;
      fechar();
      dialogo = doc.createElement('dialog'); dialogo.className = 'ma-imagem-dialogo'; dialogo.dataset.chave = k;
      dialogo.setAttribute('aria-label', 'Print da agenda'); dialogo._foco = doc.activeElement;
      dialogo.innerHTML = '<div class="ma-imagem-dialogo-cab"><strong>Print da agenda</strong><div class="ma-imagem-dialogo-acoes"><button type="button" class="ma-img-btn" data-img-zoom aria-pressed="false">Tamanho original</button><button type="button" class="ma-img-btn" data-img-fechar>Fechar ✕</button></div></div><div class="ma-imagem-ampliada"><img alt="Print anexado à anotação"></div>';
      dialogo.querySelector('img').src = s.url;
      dialogo.querySelector('[data-img-zoom]').addEventListener('click', function (e) {
        const original = dialogo.classList.toggle('tamanho-original');
        e.currentTarget.textContent = original ? 'Ajustar à tela' : 'Tamanho original';
        e.currentTarget.setAttribute('aria-pressed', original ? 'true' : 'false');
      });
      dialogo.querySelector('[data-img-fechar]').addEventListener('click', fechar);
      dialogo.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); } });
      dialogo.addEventListener('cancel', function (e) { e.preventDefault(); fechar(); });
      dialogo.addEventListener('click', function (e) { if (e.target === dialogo) fechar(); });
      doc.body.appendChild(dialogo); dialogo.showModal();
    }
    function pintar() {
      doc.querySelectorAll('[data-ma-imagem]').forEach(function (box) {
        const k = box.dataset.maImagem, p = k.split('|'), s = obter(k), desativado = s.busy ? ' disabled' : '';
        // O DOM do campo de texto fica intacto, inclusive seleção, foco e rascunho.
        box.innerHTML = '<div class="ma-imagem-acoes"><button type="button" class="ma-img-btn" data-img-anexar' + desativado + '><span aria-hidden="true">▧</span> ' + (s.meta ? 'Trocar print' : 'Anexar print') + '</button>' +
          (s.meta ? '<button type="button" class="ma-img-btn ma-img-remover" data-img-remover' + desativado + '>Remover</button>' : '') +
          '<input type="file" accept="image/png,image/jpeg,image/webp" data-img-arquivo hidden></div>' +
          (s.meta ? '<button type="button" class="ma-imagem-previa" data-img-ampliar aria-label="Ampliar print desta anotação"' + (!s.url ? ' disabled' : '') + '>' +
            (s.url ? '<img alt="Print anexado"><span>Ampliar print ↗</span>' : '<span>' + (s.erro ? 'Prévia indisponível' : 'Carregando print…') + '</span>') + '</button>' : '') +
          '<p class="ma-imagem-status' + (s.erro ? ' erro' : '') + '" role="status">' + escape(s.erro || s.mensagem) + '</p>' +
          (s.erro && s.meta && !s.url ? '<button type="button" class="ma-img-btn" data-img-recarregar>Recarregar print</button>' : '');
        const input = box.querySelector('[data-img-arquivo]');
        box.querySelector('[data-img-anexar]').addEventListener('click', function () { input.click(); });
        input.addEventListener('change', function () { const file = input.files && input.files[0]; if (file) salvar(p[0], +p[1], file); });
        const remover = box.querySelector('[data-img-remover]');
        if (remover) remover.addEventListener('click', function () { salvar(p[0], +p[1], null); });
        const preview = box.querySelector('[data-img-ampliar]');
        if (preview) { preview.addEventListener('click', function () { ampliar(k); }); const img = preview.querySelector('img'); if (img) img.src = s.url; }
        const recarregar = box.querySelector('[data-img-recarregar]');
        if (recarregar) recarregar.addEventListener('click', function () { s.erro = ''; carregar(k); pintar(); });
        if (s.meta && !s.url && !s.carregando && !s.erro && !s.busy) carregar(k);
      });
    }
    function ligar(box) {
      box.querySelectorAll('.ma-campo').forEach(function (ta) {
        if (ta.dataset.maPasteLigado) return; ta.dataset.maPasteLigado = 'sim';
        ta.addEventListener('paste', function (e) {
          const itens = Array.from((e.clipboardData && e.clipboardData.items) || []);
          const item = itens.find(function (i) { return i.kind === 'file' && /^image\//.test(i.type); });
          if (!item) return; // Colagem de texto continua a funcionar normalmente.
          const file = item.getAsFile(); if (!file) return;
          e.preventDefault();
          const dia = ta.dataset.maDia, faixa = +ta.dataset.maFaixa;
          if (tem(dia, faixa) && !(op.confirm || root.confirm)('Substituir o print que já está nesta anotação?')) return;
          salvar(dia, faixa, file);
        });
      });
      pintar();
    }
    return { html: html, ligar: ligar, pintar: pintar, capturar: capturar, atual: atual, receberPeriodo: receberPeriodo, tem: tem, chaves: chaves, ocupado: ocupado, salvar: salvar, reset: reset, fechar: fechar };
  }
  const publicacao = { criar: criar, preparar: preparar, validarArquivo: validarArquivo, dimensoes: dimensoes, MAX_BYTES: MAX_BYTES, MAX_ORIGINAL: MAX_ORIGINAL, MAX_LADO: MAX_LADO };
  if (typeof module === 'object' && module.exports) module.exports = publicacao;
  else root.AgendaImagens = publicacao;
})(typeof window === 'object' ? window : globalThis);

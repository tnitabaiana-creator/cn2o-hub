/* Vínculo da geração interna à revisão do e-Protocolo. Sem fatos vindos do cliente. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CN2OFonteMinuta = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function atoBase(value) {
    const a = String(value || '').toUpperCase().replace(/\s+/g, '_');
    return a === 'DUE' || a === 'UE-DIS' ? 'DISS_UE' : a.startsWith('PROC') ? 'PROC' : a;
  }
  function criar(options) {
    let numero = '', fonte = null, ausente = false, carregando = false, seq = 0, travado = false;
    const avisar = options.avisar || function () {};
    function mudarNumero(value) {
      if (travado) return;
      numero = String(value || '').trim(); fonte = null; ausente = false; carregando = false; seq++;
      avisar('Informe o número e clique em Carregar protocolo.');
    }
    function semProtocolo(value) {
      if (travado) return;
      ausente = !!value; fonte = null; carregando = false; seq++;
      if (ausente) numero = '';
      avisar(ausente ? 'Atendimento sem protocolo: a geração usará a entrevista e os documentos, com essa ausência registrada.' : 'Carregue o protocolo deste atendimento.');
    }
    async function carregar() {
      if (travado) return;
      if (!/^[1-9]\d{0,9}$/.test(numero)) { avisar('Informe um número de protocolo válido.', true); return; }
      const atual = ++seq, pedido = numero; fonte = null; carregando = true; ausente = false;
      avisar('Carregando os dados confirmados no atendimento…');
      try {
        const response = await options.api('/hub/protocolos/' + encodeURIComponent(pedido) + '/fonte');
        if (atual !== seq) return;
        const f = response && response.fonte;
        if (!f || f.schema_version !== 'cn2o.eprotocolo.v1' || String(f.protocolo && f.protocolo.numero) !== pedido || !/^[a-f0-9]{64}$/.test(f.revisao && f.revisao.sha256 || '')) throw new Error('Não foi possível validar a revisão recebida. Recarregue o protocolo.');
        fonte = f;
        const estado = f.curadoria && f.curadoria.estado;
        const pendente = !estado || ['nao_conferidos', 'divergentes', 'nao_conferido', 'divergente'].includes(estado);
        avisar('Protocolo ' + pedido + ' carregado · ato ' + String(f.protocolo.ato || 'não informado') + (pendente ? '. Há conferência documental pendente; o gerador registrará as divergências.' : '. Os dados serão confrontados com os documentos deste atendimento.'));
      } catch (e) {
        if (atual !== seq) return;
        fonte = null; avisar((e && (e.erro || e.message)) || 'Não foi possível carregar o protocolo. Tente novamente.', true);
      } finally { if (atual === seq) carregando = false; }
    }
    function validar(ato) {
      if (carregando) return 'Aguarde o carregamento do protocolo.';
      if (ausente) return null;
      if (!fonte) return 'Carregue o e-Protocolo ou indique expressamente que o atendimento ainda não tem protocolo.';
      if (atoBase(fonte.protocolo.ato) !== atoBase(ato)) return 'O ato do protocolo não corresponde ao ato escolhido. Confira o protocolo e o tipo de escritura.';
      return null;
    }
    function payload(ato) {
      const erro = validar(ato); if (erro) throw new Error(erro);
      return ausente ? { protocolo_ausente: true, ato_minuta: ato } : { protocolo: String(fonte.protocolo.numero), protocolo_revisao: fonte.revisao.sha256, ato_minuta: ato };
    }
    function limpar() { if (travado) return; numero = ''; fonte = null; ausente = false; carregando = false; seq++; avisar('Carregue o protocolo para usar os dados do atendimento.'); }
    return { mudarNumero, semProtocolo, carregar, validar, payload, limpar, travar: value => { travado = !!value; } };
  }
  function ligar(doc, api) {
    const numero = doc.getElementById('minFonteNumero'), carregar = doc.getElementById('minFonteCarregar'), ausente = doc.getElementById('minFonteAusente'), status = doc.getElementById('minFonteStatus');
    const state = criar({ api, avisar: function (texto, erro) { status.textContent = texto; status.classList.toggle('erro', !!erro); } });
    numero.addEventListener('input', function () { ausente.checked = false; state.mudarNumero(numero.value); });
    ausente.addEventListener('change', function () { state.semProtocolo(ausente.checked); if (ausente.checked) numero.value = ''; });
    carregar.addEventListener('click', async function () { carregar.disabled = true; try { await state.carregar(); } finally { carregar.disabled = false; } });
    return Object.assign({}, state, {
      travar: function (valor) { state.travar(valor); numero.disabled = carregar.disabled = ausente.disabled = !!valor; },
      limpar: function () { state.limpar(); numero.value = ''; ausente.checked = false; }
    });
  }
  function rotuloCampo(campo) {
    const partes = String(campo || '').replace(/^\/dados\//, '').replace(/^triagem\//, '').split('/');
    const nomes = { preco:'Preço', pag_momento:'Momento do pagamento', pag_ant_forma:'Forma do pagamento anterior', pag_ant_data:'Data do pagamento anterior', pag_ato_forma:'Forma do pagamento no ato', pag_m_antes_forma:'Forma da parcela anterior', pag_m_antes_data:'Data da parcela anterior', pag_m_ato_forma:'Forma do saldo no ato', valor_centavos:'Valor', beneficiario:'Beneficiário', comprovante_referencia:'Comprovante indicado', data:'Data', status:'Situação', forma:'Forma', pagador:'Pagador', observacoes:'Observações', estado_civil:'Estado civil', nome:'Nome', ato:'Ato' };
    if (partes[0] === 'pagamentos' && /^\d+$/.test(partes[1] || '')) return 'Parcela ' + (Number(partes[1]) + 1) + ' · ' + (nomes[partes[2]] || partes[2].replace(/_/g, ' '));
    return partes.map(p => nomes[p] || p.replace(/~1/g,'/').replace(/~0/g,'~').replace(/_/g,' ')).join(' · ');
  }
  function mostrarConferencia(doc, resultado) {
    const box = doc.getElementById('minFonteConferencia'), lista = doc.getElementById('minFonteConferenciaLinhas'), resumo = doc.getElementById('minFonteConferenciaResumo');
    lista.textContent = ''; box.hidden = !resultado;
    if (!resultado) return;
    const rows = Array.isArray(resultado.conferencia_fonte) ? resultado.conferencia_fonte : [];
    const fonte = resultado.fonte_protocolo;
    if (!fonte) { resumo.textContent = 'Geração sem e-Protocolo vinculado. Confira os dados da entrevista e dos documentos.'; return; }
    if (resultado.fonte_conferencia_estado === 'texto_editado_requer_conferencia') {
      box.open = true;
      resumo.textContent = 'Protocolo ' + fonte.numero + ': o texto guardado foi alterado após a geração. A conferência anterior não valida este texto; faça nova conferência antes de utilizá-lo.';
      return; // Não atribuir ao texto editado aplicações ou trechos de outra versão.
    }
    const pendentes = rows.filter(r => r.cobertura === 'pendente').length;
    const documentos = rows.filter(r => r.decisao === 'documento').length;
    resumo.textContent = 'Protocolo ' + fonte.numero + ' · ' + rows.length + ' informações acompanhadas · ' + documentos + ' decisão(ões) com prevalência documental · ' + pendentes + ' pendência(s). A vinculação do documento ao fato exige conferência humana.';
    box.open = pendentes > 0 || resultado.fonte_status === 'requer_conferencia' || resultado.fonte_desatualizada === true;
    if (resultado.fonte_desatualizada === true) resumo.textContent = 'Atenção: o protocolo foi atualizado depois desta geração. Esta conferência se refere à versão anterior. ' + resumo.textContent;
    rows.forEach(function (r) {
      const li = doc.createElement('li'), titulo = doc.createElement('strong'), motivo = doc.createElement('p');
      titulo.textContent = rotuloCampo(r.campo) + ' — ' + (r.decisao === 'documento' ? 'documento prevaleceu' : r.cobertura === 'pendente' ? 'pendente' : r.cobertura === 'nao_aplicavel' ? 'não aplicável' : 'protocolo utilizado');
      motivo.textContent = String(r.motivo || 'Sem justificativa registrada.');
      li.appendChild(titulo); li.appendChild(motivo);
      if (r.documento) { const prova = doc.createElement('p'); prova.textContent = 'Documento: ' + String(r.documento.nome || r.documento.id || '') + ' · página ' + String(r.documento.pagina || '') + '. ' + String(r.documento.trecho || ''); li.appendChild(prova); }
      if (r.trecho_minuta) { const aplicado = doc.createElement('p'); aplicado.textContent = 'Trecho da escritura: ' + String(r.trecho_minuta); li.appendChild(aplicado); }
      lista.appendChild(li);
    });
  }
  function prepararHistorico(doc) {
    ['btnCopiarMin','minDocCriar','minDocBox','minDocErro','minDecisao','minPendencias','minDevolvida','minPreliminarFaixa','minutaLinkBox'].forEach(function (id) { const e=doc.getElementById(id); if(e) e.hidden=true; });
    const saida=doc.getElementById('saidaMinuta');saida.classList.add('vazia');saida.textContent='Carregando a minuta guardada…';
    doc.getElementById('metaMin').textContent='';
    mostrarConferencia(doc,null);
  }
  return { criar, ligar, atoBase, mostrarConferencia, rotuloCampo, prepararHistorico };
});

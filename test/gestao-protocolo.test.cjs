'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../gestao-protocolo.js');
const tick = () => new Promise(r => setImmediate(r));
const clone = v => JSON.parse(JSON.stringify(v));
function fixture() {
  return {
    periodo: { inicio: '2026-10-05', fim: '2026-10-11', corte: '2026-10-09T20:15:00Z', parcial: true },
    criterio: { inicio: 'Em Digitalização', fim: 'Gerar Minuta', etapa_intermediaria: 'Cadastro Extradigital', meta_horas_uteis: 8, fuso: 'America/Sao_Paulo', expediente: '08:00–12:00, 13:00–17:00', feriados_extra: [] },
    resumo: { entradas: 3, retornos_digitalizacao: 1, entradas_movimentos_total: 4, protocolos_entrada_unicos: 2, concluidos: 1, ciclos_concluidos: 2, retrabalhos: 1, em_andamento: 1, vencidos: 1, media_horas_uteis: 9, mediana_horas_uteis: 9, no_prazo: 1, fora_prazo: 1, sem_tempo: 0, pendencias: 0 },
    dias: Array.from({ length: 7 }, (_, i) => ({ data: '2026-10-' + String(i + 5).padStart(2, '0'), dia_util: i < 5, entradas: i === 0 ? 2 : i === 2 ? 1 : 0, retornos_digitalizacao: i === 0 ? 1 : 0, entradas_movimentos_total: i === 0 ? 3 : i === 2 ? 1 : 0, concluidos: i === 1 || i === 3 ? 1 : 0, ciclos_concluidos: i === 1 || i === 3 ? 1 : 0 })),
    ciclos: [{ id: 'ciclo-a', card_id: 'card-a', protocolo: '9999', titulo: 'Protocolo fictício', url: 'https://trello.com/c/abcd1234', entrou_digitalizacao_em: '2026-10-05T11:00:00Z', saiu_cadastro_em: '2026-10-06T12:00:00Z', entrou_gerar_minuta_em: '2026-10-06T12:00:00Z', horas_uteis: 9, status: 'concluido', no_prazo: false, retrabalho: false, retornos: 0, motivo: null }],
    cobertura: { primeiro_evento: '2026-10-05T11:00:00Z', ultimo_evento: '2026-10-09T19:30:00Z', ultimo_recebido: '2026-10-09T20:00:00Z', eventos: 8, confirmada: false }, avisos: ['Histórico ainda em conferência.']
  };
}
function ambiente(t, api, opt = {}) {
  const listeners = {}, chamadas = [], sessao = { token: 'ficticio', login: 'gestor', admin: true }; let monitor, expiradas = 0;
  const host = { innerHTML: '', isConnected: true, addEventListener: (k, f) => { listeners[k] = f; }, removeEventListener: k => { delete listeners[k]; } };
  const window = { setInterval: f => { monitor = f; return 1; }, clearInterval: () => { monitor = null; }, URL: { revokeObjectURL() {} } };
  const controle = P.montar({ host, window, semana: '2026-10-09', sessao: () => sessao, expirada: () => expiradas++, api: async p => { chamadas.push(p); return api ? api(p) : fixture(); }, ...opt });
  t.after(() => controle.destruir());
  return { host, sessao, controle, chamadas, listeners, monitor: () => monitor && monitor(), expiradas: () => expiradas };
}
test('semana normaliza segunda a domingo inclusive virada de ano e rejeita data inválida', () => {
  assert.equal(P.segunda('2027-01-01'), '2026-12-28'); assert.equal(P.segunda('2026-02-30'), '');
  assert.equal(P.validar(fixture(), '2026-10-09').periodo.inicio, '2026-10-05');
  assert.throws(() => P.validar(fixture(), '2026-10-12'));
  const r = fixture(); r.periodo.fim = '2026-10-12'; assert.throws(() => P.validar(r));
});
test('contagens diárias conciliam entradas e ciclos, mas não somam protocolos únicos da semana', () => {
  assert.doesNotThrow(() => P.validar(fixture()));
  const r = fixture(); r.dias[0].entradas = 1; assert.throws(() => P.validar(r));
  const s = fixture(); s.dias[1].ciclos_concluidos = 2; assert.throws(() => P.validar(s), /divergente/);
  const x = fixture(); x.resumo.protocolos_entrada_unicos = 10; assert.throws(() => P.validar(x));
});
test('nulidades persistem desconhecidas; horários e ciclos inconsistentes são rejeitados', () => {
  const r = fixture(); r.resumo.media_horas_uteis = null; r.resumo.mediana_horas_uteis = null; r.ciclos[0].horas_uteis = null; r.ciclos[0].no_prazo = null;
  assert.equal(P.validar(r).resumo.media_horas_uteis, null);
  for (const mudar of [x => { x.criterio.fuso = 'UTC'; }, x => { x.periodo.corte = 'ontem'; }, x => { x.ciclos.push(clone(x.ciclos[0])); }, x => { x.ciclos[0].entrou_gerar_minuta_em = '2026-10-04T12:00:00Z'; }, x => { x.resumo.media_horas_uteis = -1; }]) { const x = fixture(); mudar(x); assert.throws(() => P.validar(x)); }
});
test('renderização distingue cartões, ciclos, retrabalho, calendário e corte Brasília', () => {
  const html = P.renderizar({ semana: '2026-10-05', dados: P.validar(fixture()) });
  assert.match(html, /Protocolos concluídos/); assert.match(html, /Cartões únicos/); assert.match(html, /2 ciclos concluídos/); assert.match(html, /1 retrabalhos/);
  assert.match(html, /resultado parcial/); assert.match(html, /09\/10\/2026,? 17:15/); assert.match(html, /8 h úteis/); assert.match(html, /08:00–12:00, 13:00–17:00/);
  assert.match(html, /mesmo|cada cartão uma única vez/); assert.doesNotMatch(html, /Receita líquida|CTN/);
});
test('sem cobertura e sem eventos exibe ausência de base e nunca produtividade zero confirmada', () => {
  const r = fixture(); Object.keys(r.resumo).forEach(k => { r.resumo[k] = ['media_horas_uteis', 'mediana_horas_uteis'].includes(k) ? null : 0; });
  r.dias.forEach(d => { d.entradas = d.retornos_digitalizacao = d.entradas_movimentos_total = d.concluidos = d.ciclos_concluidos = 0; }); r.ciclos = []; r.cobertura.eventos = 0;
  const html = P.renderizar({ dados: P.validar(r) });
  assert.match(html, /Sem histórico suficiente/); assert.match(html, /<strong>—<\/strong>/); assert.doesNotMatch(html, /<strong>0<\/strong>/); assert.match(html, /data-gp-acao="csv" disabled/);
});
test('texto Trello é escapado e links só aceitam origem e caminho de cartão', () => {
  const r = fixture(); r.ciclos[0].titulo = '<img src=x onerror=alert(1)>'; r.ciclos[0].url = 'https://trello.com.evil/c/a'; r.avisos = ['<script>test</script>'];
  let html = P.renderizar({ dados: P.validar(r) }); assert.doesNotMatch(html, /<img|<script|href="https:\/\/trello.com.evil/); assert.match(html, /&lt;img/);
  r.ciclos[0].url = 'https://trello.com/c/abcd1234'; html = P.renderizar({ dados: r }); assert.match(html, /rel="noopener noreferrer"/);
});
test('CSV preserva corte e horário ISO e neutraliza fórmulas em campos Trello', () => {
  const r = fixture(); r.ciclos[0].titulo = '=IMPORTXML("x")'; r.ciclos[0].protocolo = '+1';
  const out = P.csv(r); assert.match(out, /'\+1/); assert.match(out, /'=IMPORTXML/); assert.match(out, /2026-10-09T20:15:00Z/); assert.match(out, /2026-10-05T11:00:00Z/);
});
test('Cadastro ausente avisa sem eliminar entrega nem tempo entre marcos comprovados', () => {
  const r = fixture(); r.ciclos[0].cadastro_confirmado = false; r.ciclos[0].saiu_cadastro_em = null;
  const html = P.renderizar({ dados: P.validar(r) });
  assert.match(html, /Passagem pelo Cadastro não registrada/); assert.match(html, /Concluído fora do prazo/); assert.match(html, /9 h/);
  assert.match(html, /tempo é calculado mesmo sem passagem registrada pelo Cadastro/);
});
test('calendário aceita feriado anual MM-DD e data específica, sem aceitar datas inexistentes', () => {
  const r = fixture(); r.criterio.feriados_extra = ['06-24', '2026-12-24'];
  const html = P.renderizar({ dados: P.validar(r) }); assert.match(html, /24\/06 \(anual\)/); assert.match(html, /24\/12\/2026/);
  r.criterio.feriados_extra = ['02-30']; assert.throws(() => P.validar(r));
});
test('consulta usa endpoint privado por semana normalizada e recarrega sem dados antigos', async t => {
  const a = ambiente(t); await tick(); assert.deepEqual(a.chamadas, ['/hub/relatorios/protocolo-cadastro/semanal?semana=2026-10-05']); assert.match(a.host.innerHTML, /Protocolo fictício/);
  a.controle.recarregar(); assert.doesNotMatch(a.host.innerHTML, /Protocolo fictício/); await tick(); assert.match(a.host.innerHTML, /Protocolo fictício/);
});
test('troca de sessão durante leitura e resposta fora de ordem não repõem dados privados', async t => {
  const pendentes = []; const a = ambiente(t, () => new Promise(resolve => pendentes.push(resolve)));
  const p = a.controle.recarregar('2026-10-05'); pendentes[1](fixture()); await p; assert.match(a.host.innerHTML, /Protocolo fictício/);
  const r = fixture(); r.ciclos[0].titulo = 'RESPOSTA ANTIGA'; pendentes[0](r); await tick(); assert.doesNotMatch(a.host.innerHTML, /RESPOSTA ANTIGA/);
  const leitura = a.controle.recarregar(); a.sessao.token = 'outra'; pendentes[2](fixture()); await leitura; assert.equal(a.host.innerHTML, '');
});
test('sem autorização não consulta e logout desmonta dados e listeners', async t => {
  const a = ambiente(t, null, { sessao: () => ({ admin: false }) }); await tick(); assert.deepEqual(a.chamadas, []); assert.equal(a.host.innerHTML, '');
  const b = ambiente(t); await tick(); b.sessao.admin = false; b.monitor(); assert.equal(b.host.innerHTML, ''); assert.deepEqual(Object.keys(b.listeners), []);
});
test('erro de rede não vira zero; 401/403 limpa e solicita renovação da sessão', async t => {
  for (const status of [401, 403]) { const a = ambiente(t, async () => { throw { status }; }); await tick(); assert.equal(a.host.innerHTML, ''); assert.equal(a.expiradas(), 1); }
  const b = ambiente(t, async () => { throw new Error('network'); }); await tick(); assert.match(b.host.innerHTML, /Não foi possível confirmar/); assert.doesNotMatch(b.host.innerHTML, /Protocolos concluídos/);
});

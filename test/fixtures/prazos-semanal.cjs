'use strict';
// Pessoas, cartões e protocolos inteiramente fictícios. Sem dados de produção.
module.exports = function fixture() {
  const item = { card_id:'ficticio-a', protocolo:9001, ato:'CV-Urbano', responsavel:'ficcao.alfa', responsavel_nome:'Escrevente Alfa',
    inicio:'2026-10-01T12:00:00Z', vencimento:'2026-10-10T02:59:59Z', situacao:'vencido',
    trello_url:'https://trello.com/c/FICTICIO1', confirmado_em:'2026-10-20T14:58:00Z', sincronizacao_pendente:false,
    atraso_horas_uteis:48, atraso_horas_corridas:252 };
  const fim = { ...item, card_id:'ficticio-b', protocolo:9002, responsavel:null, responsavel_nome:'Sem responsável',
    vencimento:'2026-10-16T02:59:59Z', situacao:'concluido', concluido_em:'2026-10-16T15:00:00Z',
    no_prazo:false, atraso_horas_uteis:3, atraso_horas_corridas:12, sincronizacao_pendente:true };
  const page = itens => ({ itens,total:itens.length,pagina:1,paginas:itens.length ? 1 : 0,limite:50 });
  return { versao:'prazos-semanal-v1', corte_em:'2026-10-20T15:00:00Z',
    semana:{inicio:'2026-10-12',fim:'2026-10-18'}, filtros:{responsavel:null,tipo:null,situacao:'todos'},
    resumo:{vencidos:1,a_vencer:0,concluidos:1,sem_responsavel:1,concluidos_no_prazo:0,concluidos_atrasados:1},
    por_responsavel:[{login:'ficcao.alfa',nome:'Escrevente Alfa',vencidos:1,a_vencer:0,concluidos:0},{login:null,nome:'Sem responsável',vencidos:0,a_vencer:0,concluidos:1}],
    responsaveis:[{login:'ficcao.alfa',nome:'Escrevente Alfa'},{login:null,nome:'Sem responsável'}],tipos:['CV-Urbano'],
    fila:page([item]),conclusoes:page([fim]),
    criterios:{fila:'Vencidos acumulados e atos a vencer na semana, na posição atual.',conclusoes:'Primeiro encerramento comprovado por cartão; data do evento Trello.',responsavel:'Responsabilidade operacional registrada no acompanhamento do ato.'},
    cobertura:{reconstrucao_historica:false,criterio:'Somente relógios já registrados; ausência de amostra não comprova cumprimento.',confirmacao_desatualizada_apos_minutos:30,pendencias_sincronizacao:1,observacao:'Atos reabertos podem figurar na fila atual e nas conclusões históricas.'} };
};

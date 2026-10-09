# Gestão do Hub

A entrada lateral antes chamada Relatórios agora se chama Gestão. Permanece exclusiva do Tabelião, conforme a autorização do servidor. A lista dá acesso a Relatórios das escreventes, Atendimentos do balcão, Produtividade financeira e Relatório de produtividade de escrituras.

Os três relatórios existentes reutilizam suas consultas, períodos e ações. Sua abertura por Gestão não apresenta os controles de edição/publicação do mural. O acesso pela aba de relatórios do editor continua disponível. As rotas `#gestao` e `#gestao-escrituras` permitem voltar, avançar e reabrir; `#relatorios` abre Gestão.

## Contagem oficial de escrituras lavradas

O componente `gestao-lavrados.js` consulta `GET /hub/atos-lavrados/meses`, exclusivo de administrador. A unidade é o ato único da família Escritura com situação Registrado(a), excluídas procurações e testamentos, na data Minuta/Lavratura do Extra Digital. Mês completo usa `total_oficial`; cobertura parcial mostra `total_observado`, a data de corte e, quando `dia_final_completo` é falso, a hora de `corte_em` em America/Sao_Paulo; ausência de base aparece como mês não conciliado, nunca como zero. O painel informa quando a base foi importada e não promete atualização em tempo real.

A consulta aparece na produtividade financeira, na prévia mensal das escreventes e acima do documento V3. Os totais financeiros continuam sendo lançamentos da Pesquisa de Produtividade: receita, ticket, participação, faixa de valores e classificação mesa/balcão mantêm seus denominadores e valores. O NextQS continua contando senhas. Pendências de identificação são exibidas sem excluir o registro da contagem da fonte. Extração mensal completa não significa que todos os atos já tenham vínculo com o Hub. Vínculo confirmado entre ato e Hub não identifica autoria; não há ranking oficial por pessoa nem atribuição automática ao criador no Extra Digital.

No V3, o mês financeiro selecionado é comunicado ao painel oficial por mensagem validada com origem, janela e canal da sessão. A tabela de fusão explicita separadamente o mês financeiro, o período de cartões e a base de senhas. Isso evita interpretar seletores independentes como um único período. A adaptação é aplicada à visualização; não substitui o documento privado armazenado.

## Documento histórico incorporado

O HTML versão 3 recebido em 08/10/2026 é um relatório consolidado, com gráficos, filtros e exportações. Os dados de escrituras compreendem setembro e os primeiros sete dias de outubro de 2026. A base de senhas cobre setembro; o próprio documento informa os períodos financeiros e a cobertura parcial. Esta integração não acrescenta sincronização Trello/NextQS nem recalcula os scores originais.

Regras originais do documento histórico: atribuição à última área da escrevente antes do arquivamento, conclusão pela movimentação para o Arquivo Geral e tempos medidos desde a entrada na área ou desde o protocolo. Esses cartões e prazos não substituem os lavrados oficiais apresentados acima. A produção ponderada e as análises já vêm calculadas no documento; os pesos completos não estão implementados no HTML recebido. Não inventar uma fórmula nem duplicar scores por cartão para acomodar múltiplos atos.

## Dados privados e isolamento

O arquivo original contém dados operacionais e não integra os assets ou repositórios publicados. O backend armazena os bytes originais em PostgreSQL com SHA-256, revisão e histórico. A importação administrativa usa `scripts/importar-produtividade.js` no backend; o upload de HTML não está exposto por HTTP.

`GET /hub/gestao/produtividade-escrituras` requer sessão de administrador e retorna JSON com o documento e estado financeiro. O iframe recebe o conteúdo sem token, em origem opaca (sandbox sem allow-same-origin), com conexões externas bloqueadas. Fontes externas são substituídas pelos fallbacks locais; gráficos e regras são preservados. Links Trello abrem por ação do usuário com noopener/noreferrer.

O adaptador de armazenamento mantém a interface original de meses financeiros, mas envia alterações por mensagem validada à página do Hub. `POST /hub/gestao/produtividade-escrituras/estado` salva com revisão e histórico. Conflitos 409 preservam a edição em tela para exportação e não sobrescrevem outra revisão. Uma resposta tardia não repõe dados após logout ou troca de usuário. Sair da conta remove a visualização e seus dados da página.

O relatório de escrituras é consultivo: importações financeiras não atualizam a base de cartões. O importador CSV e suas regras existentes foram preservados, inclusive suas limitações de formato. Para substituir a base de escrituras é necessária nova importação administrativa do documento original, conservando o anterior no histórico.

## Verificação e reversão

Testes cobrem permissão, revisão concorrente, preservação do original, sandbox, mensagens de outra origem, salvamento, retorno entre páginas e logout. A fonte oficial tem verificações de mês completo/parcial/ausente, zero comprovado, payload inválido, troca de sessão, resposta tardia, falha de rede e preservação dos denominadores financeiros. Prévia local usa dados de teste e não envia relatórios por e-mail nem aciona Trello ou IA.

Publicar primeiro o backend, importar e verificar o hash do relatório, depois publicar o frontend. Para reverter a interface, usar revert do commit sem excluir tabelas ou históricos. Nenhuma variável ou rotina de setup do Trello é necessária.

# Gestão do Hub

A entrada lateral antes chamada Relatórios agora se chama Gestão. Permanece exclusiva do Tabelião, conforme a autorização do servidor. A lista dá acesso a Relatórios das escreventes, Atendimentos do balcão, Produtividade financeira e Relatório de produtividade de escrituras.

Os três relatórios existentes reutilizam suas consultas, períodos e ações. Sua abertura por Gestão não apresenta os controles de edição/publicação do mural. O acesso pela aba de relatórios do editor continua disponível. As rotas `#gestao` e `#gestao-escrituras` permitem voltar, avançar e reabrir; `#relatorios` abre Gestão.

## Contagem oficial de escrituras lavradas

O componente `gestao-lavrados.js` consulta `GET /hub/atos-lavrados/meses`, exclusivo de administrador. A unidade é o ato único da família Escritura com situação Registrado(a), excluídas procurações e testamentos, na data Minuta/Lavratura do Extra Digital. Mês completo usa `total_oficial`; cobertura parcial mostra `total_observado`. O último dia coberto (`ate`) é distinto do instante real da extração (`corte_em`, exibido em America/Sao_Paulo). Dia final completo exige fotografia em dia posterior; dia final parcial tem corte no próprio dia. Ausência de base aparece como mês não conciliado, nunca como zero. O painel informa quando a base foi importada e não promete atualização em tempo real.

A consulta aparece na produtividade financeira, na prévia mensal das escreventes e acima do documento V3. Os totais financeiros continuam sendo lançamentos da Pesquisa de Produtividade: receita, ticket, participação, faixa de valores e classificação mesa/balcão mantêm seus denominadores e valores. O NextQS continua contando senhas. Pendências de identificação são exibidas sem excluir o registro da contagem da fonte. Extração mensal completa não significa que todos os atos já tenham vínculo com o Hub. Vínculo confirmado entre ato e Hub não identifica autoria; não há atribuição automática ao criador no Extra Digital.

### Semana, tipos e escrevente responsável

A opção **Por semana** consulta `GET /hub/atos-lavrados/semana`, inicialmente sem referência para usar a data corrente de Brasília definida pelo servidor. A referência pode ser alterada pelo campo de data ou pelos botões Semana anterior e Semana atual. A semana civil vai de segunda a domingo. Uma extração na sexta-feira às 17h permanece parcial; atos posteriores, inclusive do fim de semana, entram somente após nova importação. O painel preserva e apresenta os cortes de cada base mensal, inclusive nas semanas entre dois meses. Essa interface, por si só, não instala nem confirma uma automação.

A distribuição mensal consulta `GET /hub/atos-lavrados/resumo?inicio=YYYY-MM-01&fim=YYYY-MM-DD`; deve corresponder ao total, à revisão e ao corte do mês já exibido. Divergências temporárias pedem nova consulta, sem substituir o total mensal. A API semanal fornece diretamente sua própria distribuição. Os tipos são classificados no backend pelos campos Sub-tipo e Finalidade, com versão de regra; o frontend não infere categorias. Tipos sem classificação e divergências permanecem visíveis e incluídos na soma.

O agrupamento individual mostra somente o escrevente responsável pelo registro/lavratura com evidência explícita no Extra Digital. Cada colaborador recebido tem identidade, nome, marcos de evidência e contagem; a soma com **Responsável não identificado** deve coincidir com o total observado. A pendência não representa produtividade zero. Uma atribuição individual só é considerada completa quando todo o período e todas as autorias estão conferidos. Criador do cadastro, usuário do protocolo e vínculo com o Hub não substituem essa evidência.

Estado, falhas e requisições semanais são independentes do mensal. Mudar a semana não altera o mês financeiro nem os snapshots usados por PDF/CSV financeiros; essas exportações continuam mensais. Repetições da ponte V3 sem mudança real do mês não fecham a visão semanal. Nenhum nome, registro real ou documento privado é incluído nos assets ou testes.

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

`scripts/qa-lavrados-semana.cjs` verifica visualmente o componente em desktop e 390px usando apenas fixtures sintéticas, servidor localhost efêmero e navegador sem perfil do usuário. Configure `PLAYWRIGHT_MODULE`, opcionalmente `EDGE_PATH`, e `QA_OUT` para imagens e evidências fora dos assets publicados. A rede externa fica bloqueada.

Publicar primeiro o backend, importar e verificar o hash do relatório, depois publicar o frontend. Para reverter a interface, usar revert do commit sem excluir tabelas ou históricos. Nenhuma variável ou rotina de setup do Trello é necessária.

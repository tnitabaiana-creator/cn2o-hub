# Gestão do Hub

A entrada lateral antes chamada Relatórios agora se chama Gestão. Permanece exclusiva do Tabelião, conforme a autorização do servidor. A lista dá acesso a Relatórios das escreventes, Atendimentos do balcão, Produtividade financeira e Relatório de produtividade de escrituras.

Os três relatórios existentes reutilizam suas consultas, períodos e ações. Sua abertura por Gestão não apresenta os controles de edição/publicação do mural. O acesso pela aba de relatórios do editor continua disponível. As rotas `#gestao` e `#gestao-escrituras` permitem voltar, avançar e reabrir; `#relatorios` abre Gestão.

## Relatório incorporado

O HTML versão 3 recebido em 08/10/2026 é um relatório consolidado, com gráficos, filtros e exportações. Os dados de escrituras compreendem setembro e os primeiros sete dias de outubro de 2026. A base de senhas cobre setembro; o próprio documento informa os períodos financeiros e a cobertura parcial. Esta integração não acrescenta sincronização Trello/NextQS nem recalcula os scores originais.

Regras apresentadas pelo relatório: atribuição à última área da escrevente antes do arquivamento, conclusão pela movimentação para o Arquivo Geral e tempos medidos desde a entrada na área ou desde o protocolo. A produção ponderada e as análises já vêm calculadas no documento; os pesos completos não estão implementados no HTML recebido. Não inventar uma fórmula ao atualizar a integração.

## Dados privados e isolamento

O arquivo original contém dados operacionais e não integra os assets ou repositórios publicados. O backend armazena os bytes originais em PostgreSQL com SHA-256, revisão e histórico. A importação administrativa usa `scripts/importar-produtividade.js` no backend; o upload de HTML não está exposto por HTTP.

`GET /hub/gestao/produtividade-escrituras` requer sessão de administrador e retorna JSON com o documento e estado financeiro. O iframe recebe o conteúdo sem token, em origem opaca (sandbox sem allow-same-origin), com conexões externas bloqueadas. Fontes externas são substituídas pelos fallbacks locais; gráficos e regras são preservados. Links Trello abrem por ação do usuário com noopener/noreferrer.

O adaptador de armazenamento mantém a interface original de meses financeiros, mas envia alterações por mensagem validada à página do Hub. `POST /hub/gestao/produtividade-escrituras/estado` salva com revisão e histórico. Conflitos 409 preservam a edição em tela para exportação e não sobrescrevem outra revisão. Uma resposta tardia não repõe dados após logout ou troca de usuário. Sair da conta remove a visualização e seus dados da página.

O relatório de escrituras é consultivo: importações financeiras não atualizam a base de cartões. O importador CSV e suas regras existentes foram preservados, inclusive suas limitações de formato. Para substituir a base de escrituras é necessária nova importação administrativa do documento original, conservando o anterior no histórico.

## Verificação e reversão

Testes cobrem permissão, revisão concorrente, preservação do original, sandbox, mensagens de outra origem, salvamento, retorno entre páginas e logout. Prévia local usa banco separado e não envia relatórios por e-mail nem aciona Trello ou IA.

Publicar primeiro o backend, importar e verificar o hash do relatório, depois publicar o frontend. Para reverter a interface, usar revert do commit sem excluir tabelas ou históricos. Nenhuma variável ou rotina de setup do Trello é necessária.

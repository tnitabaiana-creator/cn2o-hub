# Controle de Despesas — v1.46

Extensão isolada do módulo de despesas no Hub existente, de 03/10/2026.
Preserva o login, o build, o backend PostgreSQL e a identidade visual do Hub.

## Importação de histórico

Em Documentos, abrir Importar histórico de despesas. Selecionar o manifesto
JSON `cn2o-expenses-1` com documentos e lançamentos, depois todos os PDFs
originais. Antes de gravar, o módulo verifica nomes, tamanhos e SHA256.
Uma seleção incompleta interrompe o lote antes da primeira escrita.
O recebimento usa as rotas autenticadas existentes, partes de 1 MiB e
conferência integral do original, com limite de 50 MiB por arquivo.

O manifesto contém hashes documentais, identificadores estáveis dos registros,
campos com evidência e classificação preparatória. A importação resolve os
hashes para os IDs reais dos documentos e conserva as fontes dos campos.
Suporta vários pagamentos por PDF e vários comprovantes por lançamento.
Uma nova tentativa reutiliza documentos/lançamentos existentes; não sobrescreve
conferência humana. O resultado informa inclusões, reutilizações e falhas.
Os originais e registros entram na fila durável Google já existente.

## Pagamento desconhecido e natureza da despesa

Sem data comprovada, registrar pré-lançamento com mês de referência, data em
branco e pagamento/revisão fiscal não confirmados. Agendamento não é pagamento.
Planilhas e relatórios incluem esses registros no mês de referência, com
pendência explícita. Total registrado inclui valores ainda não conferidos;
somente deduções revisadas satisfazendo os requisitos entram no valor elegível.

Fornecedor não identificado não é identidade suficiente para impedir dois
comprovantes distintos de igual valor. A migração aditiva mantém a proteção
de duplicidade quando fornecedor e data estão identificados; não elimina
registros. Havendo possível duplicação financeira, reconciliar antes da revisão.

Anulação é reversível e exige motivo, preservando valor, documentos e histórico.
Registros anulados não entram em totais, relatórios ou abas operacionais do
Google Sheets. O filtro Registros anulados permite consulta e restauração.
Ao reunir comprovantes de uma mesma despesa, manter um lançamento ativo,
vincular todos os originais e identificar o registro principal no motivo.

O catálogo inclui água, limpeza, manutenção, sistemas, internet, telefonia,
contabilidade, postagem, transporte, alimentação, vigilância, garantias,
publicidade, associações, previdência, publicações, locação e benfeitorias.
Classificação é proposta revisável, separada de pagamento e documentação.

## Validação e proteção do acervo

Conferidos: pré-lançamentos e bloqueio de aprovação sem data, intervalo mensal
e exportação de pendências, preflight integral, retomada sem sobrescrita,
vínculos e fontes, falha parcial, duplicidade concorrente e revisão não automática.
Integração HTTP/PostgreSQL: autenticação de César/Jonas, integridade, concorrência,
histórico e migração de duplicidade. Integração Google: conta esperada, OAuth,
fila persistente, retentativa, links clicáveis, moeda numérica e gerações concorrentes.

Credenciais, manifestos reais, resultados de curadoria, originais e capturas
com informações financeiras ficam fora dos repositórios e dos pacotes de fontes.
Para recuperação, reverter código; preservar tabelas, fila, credenciais e acervo.

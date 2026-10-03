# Controle de Despesas — v1.45.1

Atualização de 03/10/2026 sobre o Hub v1.43, preservando o módulo isolado,
login individual e a identidade visual existente.

Em Fechamento, escolher datas do pagamento e natureza. CSV do período contém
lançamentos detalhados; CSV por natureza consolida totais. Relatórios do período
ou por natureza incluem conferências, classificação e documentos pendentes,
com salvamento HTML ou impressão para PDF. CSV usa UTF-8 com BOM, ponto e
vírgula e vírgula decimal; texto é protegido contra execução como fórmula.

Google Drive e Sheets usam OAuth no servidor, restrito à conta indicada na
configuração. Credenciais, tokens e comprovantes não integram as fontes.
Os originais são copiados de forma privada por ano/mês de recebimento.
As abas Lançamentos, Documentos e Resumo por natureza são atualizadas a partir
do banco do Hub; editar os registros no Hub. Links dos originais são clicáveis.
Somente lançamentos salvos entram na base contábil; anexos sem lançamento
aparecem como pendências nos relatórios e na aba Documentos.

A migração Google é aditiva e idempotente. Fila persistente, verificação SHA256,
identificação remota e gerações de tarefas preservam retentativas e edições
simultâneas. Falhas Google não apagam os originais nem impedem o controle no Hub.
O trabalhador retoma automaticamente a cada 20 segundos. O botão Sincronizar
agora permite antecipar a atualização. A interface exibe a conta, pendências,
última sincronização e eventuais erros.

Validação: 95 testes de backend aprovados, uma integração antiga dependente
de TEST_DATABASE_URL não executada; 14 testes de reenvio/exportação aprovados.
Integração HTTP/Postgres e Google com OAuth, falha/retentativa, deduplicação,
hyperlinks e edição concorrente aprovadas. Em produção, conferidos status
sem pendências, pasta privada e arquivo XLSX exportado do Google Sheets.

Publicação operacional:
- Frontend: 8e8da8b8adaac090a5f4cbeda21666be0e1da66a
- Backend: 8ab4025fa009c25707332bef7b09158544150764

Para retorno à versão anterior, reverter commits de código sem apagar tabelas,
fila, credenciais ou documentos. Não remover dados como medida de recuperação.

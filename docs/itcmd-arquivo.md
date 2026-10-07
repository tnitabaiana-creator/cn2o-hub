# Trabalhos salvos na calculadora ITCMD

Em Calculadoras > Calculadora ITCMD, os botões Inventários salvos e Doações salvas abrem a pesquisa. Inventários cumulativos ficam no primeiro grupo e recebem identificação própria.

Use Salvar trabalho para guardar os dados e Salvar como cópia para criar outro atendimento. Cada alteração salva gera uma versão. O histórico permite restaurar os dados para editar ou baixar o PDF original sem recalcular. A geração de orçamento e de declarações guarda o PDF junto dos dados usados. Anexar guia PDF conserva uma guia externa, sem emitir ou alterar o DAE.

Os registros ficam no PostgreSQL do Hub e podem ser retomados em outro computador após login, pelo autor ou pelo Tabelião. O antigo rascunho do navegador pode ser importado explicitamente; confira sua origem antes de salvar.

## Ajustes financeiros

- Honorários advocatícios foram retirados. Permanecem ITCMD, emolumentos, certidões e diligências, registro/averbação no RI e outros custos.
- Dados antigos reabertos descartam o campo de honorários antes de gerar novos cálculos. PDFs anteriores mantêm seu conteúdo.
- Desconsiderar multa (ajuste manual) zera somente a multa de inventário, inclusive em cálculos cumulativos. A opção e o motivo ficam salvos no trabalho; a frase explicativa não é impressa no orçamento. Desmarcar restaura a aplicação da regra conforme os demais dados.
- O ajuste manual não declara revogação da norma. A regra legal não foi removida sem confirmação do ato normativo.

## Duas opções de orçamento

- **Orçamento resumido:** quadro de custos e total estimado, com fonte maior para leitura rápida.
- **Orçamento discriminado:** o mesmo quadro, seguido de cada sucessão, beneficiários, frações e percentuais, quinhões, alíquotas e ITCMD individual. A meação aparece separada da herança. Os bens têm descrição própria e tabela de distribuição. Havendo partilha acordada ou excedentes, esses quadros também são incluídos.

Os dois PDFs usam a logo oficial e as cores do cartório. O título é centralizado, a identificação do atendimento é discreta e a referência vem do trabalho aberto. Não há assinatura adicional, frase de multa desconsiderada ou bloco de premissas no PDF. O discriminado termina no total estimado; o número de páginas depende dos dados, sem limite que corte beneficiários ou bens.

Escolha uma das duas opções para salvar e abrir o PDF. Os nomes distinguem Resumido e Discriminado no histórico. Cada impressão usa os dados capturados antes da preparação; editar esses dados durante o carregamento exige gerar novamente. PDFs anteriores permanecem disponíveis no formato em que foram arquivados.

`itcmd-orcamento-dados.js` projeta o resultado do motor; `itcmd-orcamento-pdf.js` cuida apenas da apresentação. Não há novo cálculo tributário na camada de impressão. A base tributável é mostrada quando difere do quinhão; alíquotas compostas são identificadas por espécie de bem. Cabeçalhos de tabela se repetem quando há mudança de página.

## Verificação técnica

O motor editável e o inline devem permanecer iguais. Os testes cobrem a preservação do principal, a opção reversível de multa, inventário cumulativo, doação, migração de frações e exclusão de honorários legados.

O arquivo exige sessão, aplica controle de versão e repete pedidos incertos sem duplicar a gravação. PDFs: até 5 MiB por arquivo e 15 MiB por gravação; estado: até 1 MiB. A validação HTTP/PostgreSQL está no backend. A validação de navegador foi executada contra banco local isolado e documentos fictícios, incluindo geração, retomada após recarregar, guia anexada, restauração e SHA-256 idêntico na reimpressão.

Em 07/10/2026: 179 testes de frontend, arquivo, impressão e regressões de cálculo aprovados; 171 verificações do motor histórico aprovadas. No teste de navegador, dez PDFs das duas versões foram gerados e arquivados em PostgreSQL local isolado; o documento resumido continuou idêntico após arquivar o discriminado. As vinte páginas resultantes foram conferidas visualmente. A validação anterior do backend aprovou 171 testes gerais (uma integração legada ignorada por configuração) e 23 testes HTTP/PostgreSQL separados. Uma leitura IA tardia não pode substituir dados de outro trabalho nem edições feitas após o início da leitura.

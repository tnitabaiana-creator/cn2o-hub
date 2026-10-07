# Trabalhos salvos na calculadora ITCMD

Em Calculadoras > Calculadora ITCMD, os botões Inventários salvos e Doações salvas abrem a pesquisa. Inventários cumulativos ficam no primeiro grupo e recebem identificação própria.

Use Salvar trabalho para guardar os dados e Salvar como cópia para criar outro atendimento. Cada alteração salva gera uma versão. O histórico permite restaurar os dados para editar ou baixar o PDF original sem recalcular. A geração de orçamento e de declarações guarda o PDF junto dos dados usados. Anexar guia PDF conserva uma guia externa, sem emitir ou alterar o DAE.

Os registros ficam no PostgreSQL do Hub e podem ser retomados em outro computador após login, pelo autor ou pelo Tabelião. O antigo rascunho do navegador pode ser importado explicitamente; confira sua origem antes de salvar.

## Ajustes financeiros

- Honorários advocatícios foram retirados. Permanecem ITCMD, emolumentos, certidões e diligências, registro/averbação no RI e outros custos.
- Dados antigos reabertos descartam o campo de honorários antes de gerar novos cálculos. PDFs anteriores mantêm seu conteúdo.
- Desconsiderar multa (ajuste manual) zera somente a multa de inventário, inclusive em cálculos cumulativos. A opção e o motivo ficam salvos; o orçamento informa a escolha. Desmarcar restaura a aplicação da regra conforme os demais dados.
- O ajuste manual não declara revogação da norma. A regra legal não foi removida sem confirmação do ato normativo.

## Verificação técnica

O motor editável e o inline devem permanecer iguais. Os testes cobrem a preservação do principal, a opção reversível de multa, inventário cumulativo, doação, migração de frações e exclusão de honorários legados.

O arquivo exige sessão, aplica controle de versão e repete pedidos incertos sem duplicar a gravação. PDFs: até 5 MiB por arquivo e 15 MiB por gravação; estado: até 1 MiB. A validação HTTP/PostgreSQL está no backend. A validação de navegador foi executada contra banco local isolado e documentos fictícios, incluindo geração, retomada após recarregar, guia anexada, restauração e SHA-256 idêntico na reimpressão.

Em 07/10/2026: 151 testes de frontend, arquivo e regressões de cálculo aprovados; 171 verificações do motor histórico aprovadas. Backend: 171 testes gerais aprovados (uma integração legada ignorada por configuração) e 23 testes HTTP/PostgreSQL separados aprovados. PDF e interface conferidos visualmente em desktop e tela estreita, com total e custos na primeira página e memória de cálculo em anexo. Uma leitura IA tardia não pode substituir dados de outro trabalho nem edições feitas após o início da leitura.

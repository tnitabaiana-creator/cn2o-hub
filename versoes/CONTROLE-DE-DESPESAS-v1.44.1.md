# Controle de Despesas — integração CN2O

Base: pacote oficial v1.43. Implementação de 03/10/2026.

Correção v1.44.1 (03/10/2026): leitura sempre automática, sem seleção de serviço.
Usa o serviço do servidor e recupera automaticamente pela leitura local se houver
indisponibilidade, limite ou texto vazio/baixa confiança. Sessão expirada e acesso
proibido continuam explícitos. Ao reenviar um arquivo, recupera o original e abre
seus dados; leituras incompletas são refeitas. Não cria outro documento nem outra
despesa, e preserva os dados manuais de lançamentos vinculados.

## Operação

No Hub, abrir Ferramentas → Controle de Despesas (cartão dourado).
São permitidos exclusivamente `cesar.bravo` e `jonas.aragao`, com a sessão
individual já existente. As APIs repetem essa conferência em toda requisição.
Não há cadastro de e-mail, login Google ou alteração de senha pelo módulo.

Enviar PDF, JPEG, PNG ou WebP, até 20 MB. O módulo grava o original, confere
assinatura e SHA256 e evita arquivos repetidos. A leitura sugere fornecedor,
CPF/CNPJ, descrição, valor e data do pagamento quando identificados no documento.
Cada campo pode mostrar documento, página e trecho de origem. Divergências e
dados ausentes permanecem pendentes. Emissão e vencimento não são usados como
pagamento. A classificação fiscal e as conferências são revisáveis.

Salvar o lançamento para incluí-lo na base. O botão Atualizar e a sincronização
periódica recuperam alterações da outra pessoa. Edição sobre versão antiga é
recusada com aviso, evitando sobrescrita silenciosa. Alterações ficam no histórico.
Fechamento gera relatório imprimível e CSV para abrir no Excel e enviar à contadora.
Dedutíveis revisadas são apresentadas antes da aplicação do limite fiscal; receitas,
conciliação com extratos, cálculo do imposto e envio ao Carnê-Leão não são automáticos.

## Implementação e publicação

- Frontend permanece no Netlify, com o build Python original e módulo isolado
  em `frontend/src/despesas/`, copiado para `controle-despesas/`.
- Backend permanece Express/PostgreSQL na Railway. Montagem adicional
  `/hub/despesas`; login, arquitetura e ferramentas anteriores preservados.
- PostgreSQL: tabelas `despesas_documents`, `despesas_parts`, `despesas_entries`,
  `despesas_audit`, `despesas_ocr_usage`. Criadas atomicamente no primeiro acesso
  autorizado, com trava de migração. Originais binários privados em partes de 1 MB.
- OCR Google: reutiliza `GCP_VISION_KEY` no servidor, sem retornar a chave ao navegador.
  `DESPESAS_OCR_MONTHLY_LIMIT` opcional, padrão 500 páginas por mês.
  A recuperação local usa Tesseract em português e PDF.js. Dependências são fixadas e
  verificadas por SHA512/SHA256 na publicação; nenhum CDN de OCR é usado em operação.
- Somente a rota do módulo permite execução WASM; demais políticas CSP permanecem.
- Fonte e comprovantes são separados. Nenhum documento financeiro real foi usado
  nos testes nem incluído nesta distribuição de fontes.

Build: `python frontend/build.py`. Publicar o conteúdo de `frontend/dist/` no
repositório do site. O Netlify executa `build-despesas-assets.py` para preparar
as bibliotecas de OCR. O backend recebe somente os arquivos da pasta `backend/`.

## Verificação e retorno à versão anterior

Testes HTTP confirmam 401 sem sessão, 403 para outra conta (inclusive outro admin),
acesso dos dois usuários, e ausência de chave nas respostas. Integração testada com
PostgreSQL embarcado: envio/retentativa/integridade, deduplicação, compartilhamento,
OCR, conflitos de versão, histórico e validação de lançamento.
Regressões do backend: 94 aprovadas, uma integração antiga dependente de Postgres
descartável não executada. Motor ITCMD: 171 aprovadas; arquivos do motor, UI e
declaração preservados byte a byte. Pacote-base e Hub publicado correspondem,
normalizando somente finais de linha Windows.

Se a nova rota afetar o Hub, reverter os commits de publicação. A migração não
altera as tabelas anteriores e não apaga despesas; conservar essas tabelas para
recuperação. Não remover dados para resolver uma falha de implantação.

Antes de usar documentos definitivos, o responsável pela hospedagem deve verificar
a retenção e a recuperação do banco que também guarda os originais deste módulo.

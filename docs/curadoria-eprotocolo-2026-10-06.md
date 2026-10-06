# Curadoria do e-Protocolo e revisão posterior

Implementação local de 6 de outubro de 2026. Não representa publicação ou alteração de protocolos reais.

## Criação

`protocolo.html` acrescenta conferência explícita a todos os atos, incluindo inventário, testamento e certidão. O checklist de recebimento continua separado da conferência do conteúdo. Nenhum estado de conferência ou confirmação é pré-marcado na criação.

Estados: documentos compatíveis; pagamento declarado sem comprovante; conferência pendente/parcial; divergência identificada. A ausência de comprovante de espécie permite protocolo com a pendência declarada. Divergência exige fato, referência documental e explicação. A interface não lê documentos, não valida a relação de um comprovante com um negócio nem presume quitação.

Uma confirmação muda para não confirmada ao alterar campos relevantes do pedido, documentos recebidos, pagamentos ou a própria conferência. O servidor registra autoria e data pela sessão; esses campos não são fornecidos pela tela.

Nos atos com possível pagamento há parcelas opcionais, sem remover as respostas antigas. Cada parcela discrimina valor em centavos, forma (espécie, PIX, transferência, depósito, cheque ou outra), situação realizada/prevista, data quando conhecida, pagador, beneficiário e referência do comprovante. Ausências são advertidas. Soma divergente do preço ou oposição entre parcelas e respostas antigas exige pendência ou divergência, em vez de classificação como compatível.

## Revisão posterior

`curadoria.html?protocolo=NUMERO` consulta `GET /hub/protocolos/:numero/fonte`. Links disponíveis no cabeçalho do e-Protocolo e no recibo após criação. Usa a sessão existente; os dados do protocolo ficam somente para leitura. O responsável revisa curadoria e parcelas, com nova confirmação obrigatória.

Grava em `POST /hub/protocolos/:numero/curadoria`, enviando apenas `expected_sha256`, `curadoria` e `pagamentos`. Autoria/hora e autorização são de responsabilidade do servidor. O hash evita sobrescrever uma revisão concorrente. Não há edição dos demais campos originais nesta tela.

Em 409 ou falha de rede/5xx, o rascunho permanece e o reenvio fica bloqueado até consultar a versão atual. A comparação mostra versão anterior e atual; o botão explícito de adotar a nova versão mantém a edição humana e exige reconfirmação. Não se faz reenvio automático. Os controles ficam desabilitados enquanto há gravação em andamento.

Salvar no Hub e sincronizar Trello são resultados distintos. A interface exibe sincronizado, pendente, sem cartão ou revisão superada conforme o servidor. O retry de sincronização envia somente a revisão a `/hub/protocolos/:numero/sincronizar-fonte`, sem repetir a alteração da curadoria.

## Arquivos compartilhados e implantação

Publicar juntos: `protocolo.html`, `curadoria.html`, `curadoria.js`, `protocolo-curadoria.js` e `protocolo-curadoria-form.js`. O primeiro JS contém regras puras usadas pela criação e revisão; o segundo contém os mesmos controles de parcelas e divergências. A API do backend deve estar disponível antes de expor a página de revisão.

O formulário de revisão não migra automaticamente protocolos, não corrige silenciosamente campos antigos, não elimina contraposições e não libera minutas retidas. O pedido documentado pode ser registrado com pendência explícita. A documentação pertinente ao mesmo fato e negócio prevalece em conflito; vínculo ou leitura incerta requer curadoria humana.

## Verificação

`node --test test/protocolo-curadoria.test.cjs test/curadoria-revisao.test.cjs`

35 testes locais aprovados: cenários gerais em todos os atos, centavos, calendário, ausência de comprovante, divergências completas, soma, fases de pagamento, payload sem autoria cliente, confirmação invalidada, concorrência 409, rede/502, clique duplo e retry exclusivo da sincronização. Os testes da revisão executam o controlador real com DOM e rede simulados.

`node scripts/preview-curadoria.cjs` inicia prévia em `http://127.0.0.1:8767/`. A revisão sintética está em `/curadoria.html?protocolo=999001`. Usa exclusivamente um fixture de teste do backend, API em memória e bloqueio de conexões externas por CSP. O script é de desenvolvimento, não deve ser hospedado como servidor de produção.

Validação pelo navegador: criação de pagamento em espécie sem comprovante; alteração de valor invalidando a confirmação; divergência com explicação obrigatória; inventário com conferência pendente; payload de simulação; revisão concorrente mantendo rascunho; Trello pendente sem falso sucesso; resposta perdida após gravação simulada. Nenhuma chamada à produção ou uso de dados pessoais reais.

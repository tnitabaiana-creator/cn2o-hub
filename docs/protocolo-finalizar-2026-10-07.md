# e-Protocolo · Protocolizar sempre clicável (v1.47 — 07/10/2026)

## O problema (CV-Urbano e CV-Rural)

As escreventes não conseguiam finalizar protocolos de compra e venda. O botão **Protocolizar**
ficava cinza (desabilitado) sem dizer o que faltava. Testado passo a passo, os bloqueios eram:

1. **Confirmação da conferência desfeita em silêncio (todos os atos).** Depois de marcar
   "Confirmo" na etapa 5, qualquer alteração no pedido — inclusive ticar um documento da pasta
   física ou escrever uma observação — desmarcava a confirmação sem aviso, e o botão voltava a
   ficar cinza. A regra de reconfirmar é proposital (a confirmação vale para os dados como estão);
   o defeito era não avisar.
2. **Parcelas que não fecham o preço (CV-Urbano, CV-Rural, CDP e CDH).** Ao lançar só parte do
   pagamento (ex.: a entrada) com a conferência marcada como "sem divergência", a regra exige
   registrar a diferença como pendência ou divergência. A exigência só aparecia escondida na etapa 5.
3. **Respostas obrigatórias fora da vista**: pessoa física/jurídica/múltiplos de vendedor e
   comprador (na identificação), e-Notariado de cada lado e o preço ajustado.

## O que mudou

- O botão **Protocolizar fica sempre clicável** (só trava durante o envio). Embaixo dele aparece
  "Faltam N itens" ou "Tudo pronto para protocolizar".
- Ao clicar com pendência, abre a lista **"Falta pouco para protocolizar"**, em linguagem de balcão;
  cada item leva direto ao campo, que fica destacado. Nada é enviado enquanto houver pendência.
- Quando a confirmação da etapa 5 é desfeita por uma alteração, aparece o aviso no próprio campo e
  o item correspondente na lista.
- Para parcelas que não fecham o preço, a lista mostra quanto somam as parcelas, qual é o preço e
  as duas saídas: lançar as parcelas que faltam ou escolher "Conferência pendente ou parcial".
- As regras de validação **não mudaram**: os mesmos critérios que deixavam o botão cinza agora
  aparecem um a um (`pendenciasProtocolo()` em protocolo.html).

## Testes

`test/protocolo-pendencias.test.cjs` (6 testes): botão clicável, verificação antes de qualquer
envio, lista completa num CV-Rural vazio, nada a fazer quando está tudo certo, aviso da confirmação
desfeita e mensagem das parcelas com os valores.

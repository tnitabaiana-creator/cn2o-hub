# Emolumentos do inventário: exclusão da meação

Correção preparada em 06/10/2026 sobre o frontend `88e1ebba` e o backend `731574f`. Não publicada por esta alteração local.

## Problema e resultado

A calculadora já separava corretamente meação e herança no motor sucessório e no ITCMD, mas a montagem do orçamento passava `inv.pat.monteMor` para a faixa de emolumentos. Com isso, a meação voltava a compor a base da escritura.

A função `emolumentosInventario(pat, pessoas, opções)` calcula a base a partir do patrimônio já apurado: valor bruto inventariado menos a meação bruta. A referência é a [Lei SE 8.639/2019, Anexo I, Nota 24, incluída pela Lei 9.840/2025](https://www.tjse.jus.br/portal/arquivos/documentos/publicacoes/legislacao/lo8639-2019.pdf), página 17 do PDF consolidado.

| Situação fictícia | Base dos emolumentos |
|---|---:|
| R$ 1 milhão em bens comuns sujeitos à meação | R$ 500 mil |
| R$ 1 milhão em bens particulares | R$ 1 milhão |
| R$ 600 mil comuns + R$ 400 mil particulares | R$ 700 mil |
| R$ 1 milhão comum, casal titular de 30% | R$ 150 mil |
| R$ 1 milhão particular, falecido titular de 50% | R$ 500 mil |
| Cumulativo, bem comum de R$ 1 milhão, sem outros bens/quinhões | R$ 500 mil em cada sucessão |

Pela tabela que já existia no sistema, R$ 1 milhão comum com até 10 pessoas passava a R$ 11.862,19 de emolumentos + FERD. Com a base corrigida de R$ 500 mil, resulta R$ 6.214,99. Esses valores exemplificam a tabela existente; esta alteração não atualiza suas faixas.

## Caminhos corrigidos

- Motor determinístico: exclui a meação uma vez, depois da fração de condomínio já aplicada. Não aceita base pronta devolvida pela IA.
- Inventário simples e cumulativo: apuração separada em cada sucessão. A meação herdada do primeiro inventário entra como patrimônio próprio no segundo e não sofre uma segunda redução automática.
- Orçamento e barra de totais: usam a mesma função. A memória mostra valor bruto, meação excluída, base e fundamento.
- Resumo copiado: inclui a memória da base. A impressão usa as mesmas linhas do orçamento e as premissas corrigidas.
- Importação por IA: o backend continua somente transcrevendo dados; o prompt foi reforçado para não reduzir previamente valores/frações pela meação nem fornecer base de cobrança. Valores declarados continuam dependentes de preenchimento pela escrevente.
- Rascunhos: ao serem restaurados, o orçamento é recalculado pelo motor atual a partir dos dados; não há uso de total antigo armazenado.

## Limites preservados

Esta correção exclui a meação da base **bruta** dos emolumentos. Não introduz desconto de dívidas nessa base. O monte partível líquido e o ITCMD continuam com as regras existentes, podendo apresentar valor diferente em casos com dívidas. Não foram alteradas alíquotas, isenções, regras sucessórias, FERD, adicionais, tabela de faixas ou doação.

Quando não há valor positivo informado, a linha não estima uma escritura com bens: informa que os emolumentos estão pendentes. Isso não significa gratuidade nem enquadra automaticamente um inventário negativo/sem bens.

O campo de fração existente representa a parcela do casal em bens comuns ou do falecido nos particulares, em condomínio com terceiros. A tela e o prompt esclarecem que os comuns não devem ser lançados com meação já descontada. O programa não consegue inferir de um número isolado se uma pessoa reduziu previamente o valor por conta própria; a origem e a natureza do valor precisam ser conferidas.

## Verificação e manutenção

Os fragmentos editáveis foram recuperados do pacote de referência e comparados com o `index.html` do clone atual antes da alteração. Eles coincidiam exatamente. O patch no artefato foi limitado ao motor, à interface e às premissas de ITCMD, preservando as outras funcionalidades, inclusive Ficheiro. Não se executou a compilação global das fontes antigas.

Executar na raiz `cn2o-hub`:

```powershell
node --test frontend/src/itcmd/emolumentos.test.js
node frontend/src/itcmd/teste-motor.js
node scripts/verificar-itcmd.cjs
git -c core.whitespace=cr-at-eol diff --check
```

Resultado desta rodada: **20 testes novos aprovados**, **171 verificações legadas aprovadas**, fontes motor/UI/corpo coincidentes com o artefato servido, scripts inline sintaticamente válidos. Os testes novos comparam ITCMD/sucessão contra o motor do HEAD anterior, exercitam o render real do orçamento e executam as funções reais de resumo e impressão com DOM mínimo controlado, sem conexão de produção.

Para conferência visual local:

```powershell
node scripts/gerar-harness-itcmd.cjs
```

O arquivo resultante fica em `../validacao-calculadora/itcmd-local.html`. Contém o motor e a interface reais com cenários fictícios selecionáveis. A política `connect-src 'none'` impede conexões externas. Essa página de QA não substitui o Hub e não deve ser publicada como sua home.

Os fontes em `frontend/src/itcmd/` são os fragmentos deste módulo, não um conjunto completo para reconstruir todo o site. `scripts/verificar-itcmd.cjs` detecta divergência entre eles e o artefato. Alterações futuras devem sincronizar esses fragmentos com o trecho correspondente de `index.html`, preservando os módulos atuais.

No backend, o único arquivo alterado por esta correção é `prompt-itcmd.txt`. O servidor lê esse prompt ao iniciar; sua atualização em produção requer a publicação/reinicialização normal do backend. Nenhum dado de produção foi alterado.

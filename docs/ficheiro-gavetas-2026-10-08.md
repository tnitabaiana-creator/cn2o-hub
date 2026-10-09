# Ficheiro de Pastas · o arquivo de aço com gavetas (v1.48 — 08/10/2026)

Mudança **só visual e de organização** da página `ficheiro-pastas.html` (quadro 10 do Hub).
O servidor não muda: cada pasta continua com o mesmo protocolo, o giro circular e a ligação
com o Trello seguem como estavam.

## Como fica

- O arquivo das estantes, desenhado como no modelo `arquivo-pastas-cn2o_3.svg`: dois módulos,
  G1 a G5 (esquerda, de cima para baixo) e G6 a G10 (direita).
- As 300 pastas ficam **50 por gaveta, em ordem**, nas gavetas com pastas:

  | Gaveta | Pastas    | Onde                                  |
  |--------|-----------|---------------------------------------|
  | G2     | 001 – 050 | módulo da esquerda, 2ª de cima        |
  | G3     | 051 – 100 | módulo da esquerda, 3ª de cima        |
  | G4     | 101 – 150 | módulo da esquerda, 4ª de cima        |
  | G7     | 151 – 200 | módulo da direita, 2ª de cima         |
  | G8     | 201 – 250 | módulo da direita, 3ª de cima         |
  | G9     | 251 – 300 | módulo da direita, 4ª de cima         |

  G1, G5, G6 e G10 aparecem como "sem pastas".
- Cada gaveta mostra na frente a faixa de pastas e quantas estão ocupadas. Passar o mouse puxa a
  gaveta; clicar abre a **janela da gaveta**: as 50 pastas como pastas suspensas, da frente para o
  fundo (fileiras de 10), ocupadas em vinho com o número do protocolo, livres em manila e a última
  entregue com contorno azul. Clicar numa pasta mostra protocolo e posição ("23ª a partir da
  frente"). Botões Anterior/Próxima passam de gaveta; Esc fecha.
- A busca por protocolo ou pasta diz a gaveta e a posição, destaca a gaveta no arquivo e tem o
  botão "Abrir a gaveta", que abre a janela com a pasta destacada.
- Na prévia e na lista da carga inicial (Tabelião), entra a coluna **Gaveta**, para o
  remanejamento físico.
- Se o Tabelião ampliar o ficheiro além de 300, as pastas a mais aparecem numa nota como "ainda
  sem gaveta definida" — a gaveta delas é uma decisão a tomar.

## Testes

`test/ficheiro-gavetas.test.cjs` (5): sintaxe, distribuição das 300 pastas, posição de cada
gaveta, recorte da lista sem alterar pasta/protocolo e as mesmas rotas do servidor de antes.

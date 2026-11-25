# TESSELLA — Documento de Design

*Uchihadam Production*

> Uma ilha de luz. Nove linguagens. Nenhuma palavra.

---

## 1. Visão

**Tessella** é um jogo de puzzles em primeira pessoa, em 3D, num mundo aberto e silencioso: uma ilha antiga
onde todas as mensagens foram escritas em **luz**. Espalhados pela ilha estão painéis de pedra — as *tesselas* —
cada um com uma grade de ladrilhos que podem estar **acesos** ou **apagados**. Glifos gravados nos ladrilhos
dizem o que a luz precisa formar. Ninguém explica nada. Você descobre as regras olhando, tentando, errando
e percebendo.

O jogo é uma homenagem ao *jeito* de ensinar do The Witness — ensinar sem palavras, por sequências de
painéis, com erros que mostram o que quebrou — mas com mecânica, mundo, regras, arte e música 100% originais.

### Pilares

1. **Ensinar sem palavras.** Cada regra é apresentada num painel tão simples que só existe um jeito de
   entender. O painel seguinte testa uma hipótese errada que o jogador provavelmente fez. O erro pisca em
   vermelho exatamente no glifo que foi violado.
2. **Uma linguagem só, nove dialetos.** Toda regra fala da mesma coisa: ladrilhos acesos/apagados e
   *regiões* (grupos de ladrilhos iguais encostados). Por isso todas podem ser combinadas no mesmo painel.
3. **O momento "ahá".** Todo painel avançado é construído em volta de UMA percepção nova (ex.: "a escuridão
   também é uma região", "os faróis se enxergam", "a sombra pode ser a gêmea da luz").
4. **O mundo é o puzzle.** As regras aparecem também na paisagem: arrozais que se enchem, lírios que abrem,
   blocos de pedra que sobem. Quem aprende a linguagem começa a ver painéis escondidos no próprio mundo.
5. **Beleza e calma.** Mundo pintado com luz quente, vento na grama, mar, música generativa que muda com o
   lugar e cresce conforme a ilha desperta.

---

## 2. A mecânica base

### O painel (tessela)

- Grade de ladrilhos. Cada ladrilho está **aceso** (brilha na cor da área) ou **apagado** (pedra escura).
- **Clique** num painel para se aproximar dele; o cursor aparece. **Clique** num ladrilho para alternar;
  **arraste** para pintar vários de uma vez.
- O **Selo** (o disco de pedra abaixo da grade) confirma a resposta. Tecla de atalho: Espaço/Enter.
  - Certo: a luz varre o painel, o cabo no chão se acende e leva energia ao próximo painel / porta.
  - Errado: os glifos (ou ladrilhos) que quebraram a regra **piscam em vermelho**. Nada é apagado: você corrige.
- **Rebites** (pino de metal no ladrilho): ladrilho travado, aceso ou apagado. Não muda.
- **Buracos**: não existe ladrilho ali. Quebram regiões e linhas.
- **Bordas luminosas**: entre um ladrilho aceso e um apagado (e na borda externa de um aceso) sempre aparece
  uma linha de luz fina. Isso mostra as *regiões* sem precisar de palavras — e prepara o jogador para todas
  as regras.
- Desfazer: `Z` / clique direito para sair. `R` limpa o painel.

### Região

Grupo máximo de ladrilhos **do mesmo estado** ligados pelos lados (não pela diagonal). Buracos e a borda do
painel separam regiões. **Regiões apagadas também são regiões** — essa é a primeira grande revelação do jogo,
e ela reaparece em quase todas as áreas.

### Placas-alvo (prólogo)

No prólogo, uma placa de pedra ao lado do painel mostra o desenho exato que a luz deve formar. Depois a placa
some: o desenho está **no mundo** (a sombra de uma janela, pedras na praia). Por fim, a placa mostra **só as
bordas** do desenho — o jogador precisa deduzir o preenchimento a partir das linhas de luz.

### Sequências e cabos

Painéis de uma estação se ligam por cabos de luz embutidos no chão. Um painel só liga quando o anterior é
resolvido. Isso garante a ordem didática dentro de cada estação. Estações diferentes de uma área podem ser
feitas em qualquer ordem depois da primeira.

---

## 3. Estrutura e progressão (como o usuário pediu)

| # | Área | Linguagem | Abertura |
|---|------|-----------|----------|
| 0 | **O Despertar** (prólogo) | interface, placas-alvo | início |
| — | **O Pátio das Nove Luzes** (hub) | — | após o prólogo |
| 1 | O Bosque Outonal | **Afinidade** (gemas) | desde o início |
| 2 | Os Terraços | **Medida** (números) | desde o início |
| 3 | A Pedreira | **Forma** (moldes) | desde o início |
| 4 | O Jardim de Sebes | **Contorno** (lados) | desde o início |
| 5 | O Templo das Areias | **Mosaico** (janelas 3×3) | desde o início |
| 6 | Os Penhascos dos Faróis | **Farol** (visão em linha) | desde o início |
| 7 | O Vale dos Moinhos | **Trama** (fios nas bordas) | desde o início |
| 8 | O Lago Espelhado | **Gêmeos** (formas iguais) | desde o início |
| 9 | **A Cidadela** | todas, **sem tutorial** | desde o início |
| 10 | **A Caverna Ressonante** | **Eco** (a 9ª linguagem) | ao acender **7 totens** |
| 11 | **A Torre do Céu** | tudo + reviravoltas finais | ao completar **a Cidadela** |

- **Nove áreas abertas desde o início**: as oito áreas de ensino (1–8) + a Cidadela (9).
- Cada área de ensino tem um **Totem** no seu coração. Quando *todos* os painéis da área são resolvidos, o
  totem acende e dispara um feixe de luz no céu, visível de qualquer lugar da ilha.
- **7 totens acesos** → os feixes convergem na porta selada da montanha → abre a **Caverna Ressonante**
  (área 10), que ensina a nona linguagem, **Eco**.
- A **Cidadela** (9) está aberta desde o começo, mas não ensina nada: só combina as nove linguagens nos
  puzzles mais difíceis da ilha. O jogador vê glifos que ainda não entende — e isso o puxa para as outras áreas.
- **Cidadela completa** → uma escada de luz se forma até o topo da montanha → **A Torre do Céu** (11), a
  área final, com reviravoltas novas (painéis-tambor em que as bordas se encontram, painéis-espelho) e o final.
- **O tempo do dia acompanha o progresso**: começa no amanhecer; cada totem avança o sol; a Cidadela
  completa traz o pôr do sol; a Torre do Céu acontece no crepúsculo, com estrelas e aurora; o final é o
  nascer de um novo dia.

### Contagem de puzzles

| Área | Painéis |
|------|---------|
| Prólogo | 8 |
| 8 áreas de ensino × 45 | 360 |
| Cidadela | 40 |
| Caverna Ressonante | 30 |
| Torre do Céu | 24 |
| Cofre Oculto | 1 |
| **Total de painéis** | **463** |
| Constelações secretas | 150 |
| **Total de puzzles** | **613** |

Cada área de ensino tem 5 estações: **Introdução (7)** que ensina sem palavras, **Prática (12)** e
**Provação (12)** em sequências de 4 painéis (cada sequência explora uma percepção nova, do simples ao
difícil), **Maestria (8)** que combina as percepções e **Coração (6)**, as obras-primas da área.

### Onde ver o progresso

1. **O Salão das Tesselas** (no hub): um salão circular com um vitral por área. Cada vitral é um mosaico com
   um ladrilho por painel daquela área; o ladrilho acende quando o painel é resolvido. No centro, um contador
   grande e um vitral misterioso dos Segredos do Mundo.
2. **Diário** (menu de pausa): lista de áreas com barra de progresso, painéis resolvidos/faltando, totem,
   segredos, e o **mapa** da ilha com viagem rápida para as pedras-guia visitadas.
3. **Totens** no mundo: os feixes no céu mostram quais áreas já foram completadas.

---

## 4. As nove linguagens

Cada linguagem tem um glifo com silhueta e cor próprias, para que painéis mistos sejam legíveis de relance.

### 4.1 Afinidade — gemas (Bosque Outonal)

**Regra:** gemas da mesma cor ficam na **mesma região**; gemas de cores diferentes ficam em **regiões
diferentes**.

**Glifo:** gema lapidada (âmbar, azul, carmim, jade, marfim, violeta).

**Sequência de ensino (Introdução)**
1. `@a @b` — tudo começa apagado: as duas gemas estão juntas. Erro pisca nas duas. Acender uma separa. *(separar)*
2. `@a L @a` — o rebite do meio está aceso; as pontas apagadas ficam isoladas. Acender as duas pontas une. *(unir)*
3. Duas linhas: âmbar em cima, azul embaixo → uma família na luz, a outra na sombra. *(luz e sombra hospedam famílias)*
4. Âmbar à esquerda, azul à direita, carmim no meio → duas famílias acesas separadas por uma parede de sombra
   onde mora a terceira. *(famílias do mesmo estado precisam de um fosso)*
5. Âmbares cercando um azul → a família pode abraçar outra. *(cercar)*
6. Rebites decidem o estado de uma família (`L@a`, `D@b`). *(um rebite colore a família inteira)*
7. Portão: 4×4 combinando tudo.

**Percepções para as estações seguintes:** fossos; corredores longos; uma gema sozinha da sua cor (precisa de
um bolso só dela); o fundo escuro como uma família gigante; impossibilidade de cruzamento (duas famílias
"diagonais" não podem ser ambas ligadas — uma delas precisa contornar pela borda); buracos como rochas no riacho.

**Segredo do mundo:** um círculo de tocos de árvore com lanternas coloridas; acender lanternas faz as folhas
das árvores brilharem.

### 4.2 Medida — números (Os Terraços)

**Regra:** a região que contém o número tem exatamente **N** ladrilhos.

**Sequência de ensino**
1. `m1 . .` — tudo apagado = região de 3. Isolar o ladrilho. *(o número conta a região)*
2. `m2 . . .` — região de 2.
3. Dois `3` em cantos opostos de 2×3 → duas regiões de 3.
4. `m1` no centro, `m8` num canto apagado → o centro aceso e o anel escuro de 8. *(**a escuridão também é uma região**)*
5. Números diferentes encostados → precisam estar em estados diferentes. *(vizinhos com números diferentes)*
6. Dois números iguais podem dividir a mesma região. *(compartilhar)*
7. Portão: 4×4.

**Percepções:** "1" isola o ladrilho; números grandes no fundo escuro; regiões do mesmo estado não podem
encostar (senão viram uma só); contar o que sobra.

**Segredo do mundo:** arrozais 4×4 com marcos de pedra numerados; clicar enche/esvazia de água.

### 4.3 Forma — moldes (A Pedreira)

**Regra:** a região que contém o molde tem **exatamente aquela forma**, na mesma orientação. Molde com anel
em volta = qualquer rotação/espelhamento.

**Sequência de ensino**
1. Dominó em 1×3.
2. "L" em 2×2.
3. "T" que só cabe numa orientação — o T de cabeça para baixo falha. *(orientação importa)*
4. Molde num ladrilho apagado → esculpir a forma na escuridão. *(moldes escuros)*
5. Dois moldes que se encaixam como peças.
6. O molde com anel: buracos impedem a orientação desenhada; só girando cabe. *(o anel libera a rotação)*
7. Portão.

**Percepções:** pentominós; a região que sobra também tem forma; encaixe por exclusão.

**Segredo do mundo:** blocos de pedra no fundo da pedreira que sobem e descem.

### 4.4 Contorno — lados (O Jardim de Sebes)

**Regra:** exatamente **N** dos 4 lados do ladrilho são bordas (vizinho em estado diferente). **Fora do painel
e buracos contam como apagado.**

**Glifo:** quadradinho com N tracinhos.

**Sequência de ensino**
1. `c4` num painel de 1 ladrilho → acender (4 bordas brilham).
2. `c4 .` → aceso, e o vizinho precisa ficar apagado.
3. `. c2 .` → duas soluções (tudo aceso, ou pontas acesas e meio apagado). *(o próprio estado importa)*
4. `c0` ao lado de um rebite aceso → zero bordas = igual a todos os vizinhos. *(zero)*
5. `c3` nos cantos → canto apagado no máximo tem 2 → tem de estar aceso. *(a borda do painel é escura)*
6. Cadeias de dedução 4×4.
7. Portão.

**Percepções:** 4 = ilha isolada; 0 ao lado de 4 é impossível; 3 em canto; propagação em cadeia como sebes.

**Segredo do mundo:** cubos de sebe que crescem/encolhem num canteiro 4×4.

### 4.5 Mosaico — janelas 3×3 (O Templo das Areias)

**Regra:** a janela 3×3 centrada no glifo (incluindo ele mesmo) tem exatamente **N** ladrilhos acesos.

**Sequência de ensino**
1. `x1` num ladrilho só → acender. *(conta a si mesmo)*
2. `x3` no meio de 1×3 → tudo aceso.
3. `x9` no centro de 3×3 → tudo aceso (um momento bonito).
4. `x4` no canto: a janela é cortada pela borda → 2×2. *(janelas de borda são menores)*
5. Zeros apagam janelas inteiras.
6. Subtração: duas janelas vizinhas diferem em uma coluna.
7. Portão.

**Percepções:** sobreposição; a resposta forma desenhos (sol, olho, escaravelho) — ornamentos do templo.

**Segredo do mundo:** o piso do pátio do templo, 5×5.

### 4.6 Farol — visão em linha (Os Penhascos dos Faróis)

**Regra:** o farol está sempre aceso e enxerga **N** ladrilhos acesos nas 4 direções retas até encontrar
escuridão, buraco ou borda, contando ele mesmo. **Num painel com faróis, toda luz precisa ser vista por algum
farol.**

**Sequência de ensino**
1. `b3 . .` → acender os dois.
2. `b2 . .` → só o do meio; acender o último faz o farol ver 3.
3. `b3 . L` → o rebite aceso precisa ser visto → acender o meio. *(toda luz precisa de uma fonte)*
4. `b5` no centro de 3×3 → a cruz. Cantos ficam escuros.
5. Dois faróis, cada um com seu feixe.
6. `b3 . b3` → os faróis **se enxergam**. *(faróis também são luz)*
7. Portão.

**Percepções:** rochas (buracos) bloqueiam; feixes que se cruzam contam para dois faróis; um farol "1" apaga
os quatro vizinhos.

**Segredo do mundo:** rochas no mar formando uma grade 5×5 com os dois faróis reais da costa.

### 4.7 Trama — fios (O Vale dos Moinhos)

**Regra:** os fios na borda de cada linha/coluna mostram, em ordem, o comprimento de cada sequência de
ladrilhos acesos. Fios separados = sequências separadas por pelo menos um ladrilho apagado. Um anel vazio =
linha sem luz.

**Sequência de ensino**
1. 1×3 com um fio de 3 → acender tudo.
2. 1×3 com fio 1 e colunas `1|0|0` → só o primeiro.
3. 2×2 resolvido por cruzamento de linhas e colunas.
4. 3×3 em cruz.
5. 4×4 com `1 1` → espaço obrigatório entre sequências.
6. 5×5: o desenho de um moinho.
7. Portão: uma chave.

**Percepções:** as soluções são **desenhos** do vale (folha, barco, peixe, pássaro, casa); buracos (fios
partidos) quebram sequências; o desenho do Coração mostra onde está o segredo do vale.

**Segredo do mundo:** fileiras de lavanda 6×6 com postes de fios.

### 4.8 Gêmeos — formas iguais (O Lago Espelhado)

**Regra:** os dois ladrilhos com o mesmo símbolo ficam em **regiões diferentes** com **a mesma forma**
(só translação). Símbolo espelhado num deles = as regiões são imagens espelhadas.

**Sequência de ensino**
1. `tm . . tm` → duas regiões separadas e iguais.
2. Um "L" travado por rebites; copiar o L em volta da outra lua.
3. A gêmea escura: a região apagada precisa copiar a acesa. *(a sombra pode ser gêmea da luz)*
4. Lua e lua espelhada → formas espelhadas.
5. Dois pares ao mesmo tempo.
6. A forma de um lado é forçada por buracos; do outro lado, ela precisa ser reconstruída.
7. Portão.

**Percepções:** o que sobra também é forma; gêmeos de estados diferentes podem encostar; espelhos.

**Segredo do mundo:** vitórias-régias em dois lagos espelhados.

### 4.9 Eco — ressonância (A Caverna Ressonante, área 10)

**Regra:** marcas em volta de um ladrilho mostram quais outros ladrilhos **viram junto** quando ele é
pressionado (vizinhos, diagonais, linha inteira, coluna inteira). Ladrilhos **mudos** (anel apagado) não
podem ser pressionados — só mudam por eco.

**Sequência de ensino** (com placas de cristal mostrando o alvo)
1. 1×3 com ecos laterais → apertar o do meio acende tudo. *(eco)*
2. Alvo `010` → apertar os três. *(apertar duas vezes desfaz; a ordem não importa)*
3. Ladrilho mudo no meio → só os vizinhos o alcançam.
4. Ecos diagonais.
5. 3×3 em cruz (todos os ladrilhos com eco em cruz).
6. Ecos de linha/coluna.
7. Portão.

Depois: eco combinado com linguagens já conhecidas (sem placa) — a resposta precisa obedecer às regras e
ainda ser alcançável com os ecos.

---

## 5. Áreas especiais

### A Cidadela (área 9) — sem tutorial

Uma fortaleza de pedra escura e bronze numa ilhota ao norte, ligada por uma ponte longa. Visível desde o
começo, imponente. Quatro alas:

- **Portão (4):** duas linguagens por painel (Afinidade+Medida, Contorno+Mosaico, Forma+Gêmeos, Trama+Farol).
- **Pátio (6):** duas linguagens com interação profunda.
- **Salões (8):** três linguagens.
- **Coroa (6):** três ou quatro linguagens, incluindo Eco — os mais difíceis da ilha.

Exemplos de interações geniais:
- Medida + Afinidade: as gemas precisam estar numa região de tamanho N → o "caminho" entre elas tem comprimento contado.
- Contorno 4 + Afinidade: ladrilho isolado = região própria → uma gema ali precisa ser a única da sua cor.
- Farol + Gêmeos: a cruz de luz de um farol é uma forma, e a gêmea dela precisa existir em outro lugar.
- Trama + Mosaico: duas fontes de informação sobre o mesmo desenho.
- Forma + Medida: dois moldes e um número no fundo escuro que conta o que sobra.

### A Caverna Ressonante (área 10)

Dentro da montanha central. Cristais ciano e violeta, um lago subterrâneo, sons que ecoam. Cada ladrilho
pressionado toca uma nota; ecos viram arpejos.

### A Torre do Céu (área 11) — o final

No topo da montanha, no crepúsculo. Plataformas de pedra flutuando, estrelas, aurora.
- **Subida (6):** combinações crescentes.
- **Tambores (4):** painéis cilíndricos — a borda esquerda encosta na direita. Regiões dão a volta.
- **Espelhos (3):** apertar um ladrilho também aperta o seu reflexo.
- **Ápice (3):** o grande final. O último painel usa as nove linguagens.
Ao resolver o último: todos os totens disparam juntos, a aurora toma o céu, o sol nasce, créditos.

---

## 6. As Constelações (a camada secreta)

O jogo nunca ensina isto. Pela ilha existem **150 constelações**, e nenhuma está "na cara". Cada uma é
um **desenho de verdade** (uma baleia, uma coruja, um moinho, um cisne, uma âncora…, cada um diferente) e
é **o próprio cenário que o desenha**: cada traço da figura é uma raiz que corre pelo chão, um galho caído,
um cipó que atravessa a copa de uma árvore, uma rachadura ou uma hera numa parede ou numa rocha, um
pedaço de calçada — e, no máximo, uma pequena nuvem que parece nuvem de verdade. Não existe ponto falso
nem linha falsa: com a figura apagada, o que se vê é só paisagem. Raízes, cipós e rachaduras iguais
aparecem pela ilha inteira sem desenhar nada, então nada denuncia quais são especiais.

**Os pedaços estão a distâncias muito diferentes (de 3 a 60 metros) e só se juntam no desenho de um único
lugar, olhando numa única direção** — como uma anamorfose. De qualquer outro ponto são pedaços soltos de
cenário. Quem para exatamente ali (meio passo de tolerância) e olha do jeito certo vê a figura, ainda
apagada; é preciso **ficar parado olhando por uns seis segundos**, sem virar a cabeça, para ela acender:
uma luz percorre os traços um depois do outro, o mundo em volta escurece um pouco, os nós (os pontos do
puzzle) aparecem onde os traços se encontram e surge uma pequena esfera de luz, que serve para confirmar
a resposta. A figura só faz sentido daquele ponto, e é de lá que ela é resolvida.

Os 150 lugares de observação ficam espalhados pela ilha inteira (pelo menos ~12 m um do outro, nunca
grudados), sempre num lugar onde dá para andar, longe de portas e de qualquer coisa que se mexa. Eles são
calculados uma vez por uma ferramenta (`scripts/place-constellations.cjs`) e guardados junto com o jogo
(`src/data/constellation-places.json`, com uma assinatura da ilha); se a ilha mudar, o jogo percebe e
recalcula sozinho em segundo plano.

São puzzles em **rede**, não em grade: os vizinhos são quem está ligado por um fio. As linguagens dos
painéis (Afinidade, Medida, Contorno, Mosaico, Eco) ganham comportamentos novos nessa geometria (ciclos
ímpares, pontes, estrelas com muitos fios), e existe uma linguagem que só aparece aqui: **um nó no fio**
quer as duas pontas iguais, **um fio cortado** quer as pontas diferentes.

A porta redonda do **Observatório**, ao lado do Pátio, tem um anel de 150 luzes, uma por constelação
resolvida. Com **100**, ela se abre: lá dentro está **a Tessela Oculta**, o puzzle mais difícil do jogo
(9×9, oito linguagens). Resolvê-la leva ao **final secreto**.

## 6b. Os dois finais

- **Um Novo Dia** (Torre do Céu): a coroa acende, os feixes de todos os totens convergem, uma onda de luz
  passa pela ilha enquanto a noite vira amanhecer; os créditos sobem sobre a ilha viva.
- **Firmamento** (secreto): noite profunda, todas as constelações da ilha brilham, a luz delas sobe e
  desenha o emblema no céu, com um décimo ladrilho que nunca apareceu antes. Créditos próprios.

---

## 7. O mapa da ilha

Ilha quase circular (~720 m), mar ao redor. Norte = −Z.

```
                          [Cidadela] (ilhota, ponte)
                 [Trama]                 [Forma]
        [Afinidade]        ▲ Montanha / Torre do Céu       [Medida]
                           (Caverna Ressonante dentro)
     [Gêmeos]              [Pátio das Nove Luzes]                 [Farol] (costa leste)
        [Contorno]                                        [Mosaico]
                           [O Despertar] (praia sul)
```

Caminhos de pedra ligam o Pátio a todas as áreas e formam um anel em volta da montanha. Cada área tem uma
**pedra-guia** (viagem rápida pelo mapa depois de visitada).

---

## 8. Interface e gamificação

- **Abertura:** logo **Uchihadam Production** → logo **TESSELLA** (nove ladrilhos que se acendem com notas) →
  menu principal sobre a ilha ao vivo.
- **Menu:** Continuar, Novo jogo, Carregar, Opções, Créditos.
- **Save:** salvamento automático a cada painel resolvido e periodicamente; 3 espaços de save; salvar
  manualmente; exportar/importar arquivo de save (backup).
- **Opções:** sensibilidade, inverter Y, campo de visão, volumes (geral, música, efeitos, ambiente),
  qualidade gráfica, idioma (Português/English), balanço da câmera.
- **Diário:** progresso por área, mapa, viagem rápida, conquistas.
- **Conquistas:** primeira luz, cada totem, 7 totens, cada área completa, segredos, final, etc.
- **HUD mínimo:** um ponto no centro que vira um anel quando há algo para interagir. Nenhum texto de tutorial.

## 9. Música e som

- Música generativa (Web Audio) com tema próprio por área — escala, timbres e andamento diferentes — com
  transições suaves ao caminhar entre áreas. O tema do Pátio ganha camadas a cada totem aceso.
- Ambiente: vento, mar, pássaros, riacho, insetos, gotas na caverna.
- Efeitos: ladrilhos com notas afinadas na escala da área, selo, acerto, erro, cabos, portas, totens, passos
  por superfície.

## 10. Direção de arte

Formas limpas, luz quente, sombras suaves, névoa atmosférica, bloom nos ladrilhos acesos, vegetação com vento.
Cada área tem uma paleta própria:

| Área | Paleta |
|------|--------|
| Despertar | areia rosada, mar turquesa, luz de vela |
| Pátio | pedra clara, grama, ouro |
| Bosque Outonal | âmbar, carmim, dourado |
| Terraços | verde-limão, água, névoa |
| Pedreira | mármore branco, ocre |
| Jardim de Sebes | esmeralda, cascalho branco, rosas |
| Templo das Areias | areia dourada, turquesa |
| Penhascos | rocha cinza, mar azul, faróis brancos |
| Vale dos Moinhos | lavanda, trigo dourado |
| Lago Espelhado | rosa de cerejeira, água prateada |
| Cidadela | ardósia, bronze, ciprestes |
| Caverna | ciano, violeta, escuridão |
| Torre do Céu | crepúsculo, estrelas, aurora |

## 11. Técnico

- Three.js + TypeScript + Vite. Build gera **um único `index.html`** que roda offline com duplo clique.
- Regras dos puzzles: `src/puzzle/rules.ts` (fonte única de verdade para jogo, testes e gerador).
- Formato compacto de puzzle: `src/puzzle/board.ts`.
- Conteúdo: `src/data/puzzles/*.ts`. Todo painel é verificado por um solucionador (`npm run verify:puzzles`).

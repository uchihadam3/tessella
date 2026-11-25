# As Constelações — a camada secreta de Tessella

> Nenhum lugar do jogo ensina isto. Quem descobrir, descobre 150 puzzles a mais — e 150 desenhos no céu da ilha.

## A ideia

Espalhadas pela ilha existem **redes de estrelas**: objetos que parecem decoração, ligados por **fios finos de luz**.
Vistas do lugar certo, as estrelas e os fios formam um **desenho** — como as constelações do céu: um cisne, uma âncora,
uma raposa, um farol. Cada desenho é diferente e combina com o lugar (conchas e gaivotas na praia, folhas e corujas no
bosque, escaravelhos e esfinges no templo das areias…). Cada objeto é uma *estrela* que acende e apaga com um clique.
Cada rede tem um **sino** num ponto que significa algo no desenho (o olho de um bicho, o centro de uma roda, a luz de uma
lanterna): tocar o sino confere a constelação. Se estiver certa, os fios brilham para sempre e o Diário guarda o nome do
desenho; se estiver errada, as estrelas e os fios culpados piscam em vermelho.

Não é uma grade: **vizinhas são as estrelas ligadas por um fio**. As linguagens que o jogador aprendeu nos painéis
ganham outra geometria — e isso muda tudo:

| Regra | Na rede |
|---|---|
| Sem glifos | todas as estrelas acesas |
| Afinidade (gemas) | gemas da mesma cor na mesma região; cores diferentes em regiões diferentes (região = estrelas do mesmo estado ligadas por fios) |
| Medida (número no anel) | a região da estrela tem exatamente N estrelas |
| Contorno (tracinhos) | exatamente N dos fios da estrela levam a uma estrela de estado diferente |
| Mosaico (número na janela) | exatamente N estrelas acesas entre a própria estrela e suas vizinhas |
| **Fios marcados** (linguagem exclusiva) | **nó** no fio = pontas iguais; **fio cortado** = pontas diferentes |
| Eco | apertar uma estrela vira também todas as vizinhas |
| Estaca | estrela fixa (não muda) |

### Como a descoberta acontece

1. No Despertar, as cinco estrelas de uma **gaivota** brilham sobre a praia. Quem mira nelas vê o cursor virar anel —
   como num painel. Clicar acende. Tocar o sino com tudo aceso faz a primeira constelação cantar.
2. A segunda, um **veleiro**, tem eco (apertar uma vira as vizinhas) — só se descobre apertando.
3. A **concha** e o **guarda-sol** ensinam sozinhos a linguagem secreta dos fios: o erro pisca *no fio*.
4. A partir da primeira solução, um vitral escondido no Salão das Tesselas acende e mostra `1 / 150`.
5. Com 100 constelações, abre-se o Cofre Oculto.

### Desenhos legíveis

Cada desenho foi feito à mão (`tools/lib/constellation-art.ts`) e passa por regras de leitura, conferidas em código
(`tools/lib/drawing-rules.ts`, `tools/art-check.ts` e os testes), com W = o lado maior do desenho:

- 4 a 16 estrelas, uma figura só; fios nunca se cruzam;
- estrelas a pelo menos 0,11·W umas das outras e a 0,06·W de qualquer fio que não seja delas; nenhum fio menor que 0,10·W;
- o ângulo entre dois fios numa estrela é de pelo menos 20°;
- o sino fica dentro da figura, a pelo menos 0,10·W de toda estrela e todo fio;
- nenhum par de desenhos é quase igual (sobreposição das linhas, também espelhada).

A folha de contato com todos os desenhos e seus nomes: `npx tsx tools/render-constellations.ts` →
`screenshots/constellation-drawings.png`.

### Uma percepção por constelação

O desenho é fixo; o puzzle nasce **em cima dele**, de uma ideia que só existe em rede e que o próprio desenho oferece
(a estrela que liga a cauda ao corpo, o cubo de uma roda, as pontas soltas de uma folha, o anel ímpar de um rosto…).
A nota de cada uma no catálogo nomeia essa ideia. As famílias de percepções:

| Percepção | Ideia |
|---|---|
| A ponte | uma estrela (ponto de corte) é a única passagem entre duas partes: famílias ou regiões que precisam se encontrar passam por ela |
| O número não cabe | a Medida é maior que um lado inteiro da ponte: a região é obrigada a atravessar |
| O cubo | a estrela com mais fios encosta em todo mundo: só uma família pode ter o estado dela |
| Amigo único / o dissidente | Contorno 1 ou N−1 num cubo: exatamente um vizinho é igual (ou diferente) |
| A janela inteira | o Mosaico de um cubo conta a vizinhança toda; comparado com uma vizinha, sobra pouco |
| Janelas quase iguais | duas estrelas ligadas veem quase as mesmas vizinhas: subtraia |
| Folhas | o Mosaico de uma folha só vê ela e o pai: resolva das pontas para dentro |
| Árvore de medidas | numa árvore cada fronteira corta de vez; as Medidas se encaixam como galhos |
| Laço ímpar | num anel ímpar, luz e sombra não alternam o caminho todo: em algum ponto dois vizinhos concordam |
| Paridade do laço | todo laço tem um número par de fios cortados: o elo sem marca se revela contando |
| Corrente de nós | estrelas amarradas por nós são uma região só; a Medida diz onde ela termina |
| Triângulos | todo triângulo tem 0 ou 2 fronteiras, nunca 1 ou 3 |
| A soma par | a soma de todos os Contornos é o dobro dos fios cortados: sempre par |
| A gema solitária | uma cor única no lugar mais movimentado precisa de um mundo só dela |
| Eco na árvore / no anel / no desenho | uma folha só mexe nela e no pai; acender tudo pede os toques certos |
| Eco alcançável | as regras admitem duas respostas, mas apertando estrelas só se chega a uma |

Os desenhos mais simples de cada lugar são o aquecimento; os mais ricos, as **vitrines**, com mais camadas de raciocínio.

### Garantias

- Toda constelação tem **uma única solução** (para regras simétricas — sem mosaico nem estaca — a solução invertida
  também vale e é aceita) e pode ser resolvida **só com raciocínio**, sem chute: o gerador simula um jogador cuidadoso
  (deduções locais + hipóteses com contradição) e descarta o que exigir tentativa e erro. A dificuldade vem da
  profundidade do raciocínio, não do tamanho.
- Nas constelações com eco, a solução é alcançável apertando estrelas a partir do estado inicial.

## Catálogo

| id | desenho | lugar | estrelas | fios | regras | dificuldade | nota |
|---|---|---|---|---|---|---|---|
| prologue.c01 | **Gaivota** (Gull) | O Despertar | 5 | 4 | Acender tudo | 1 | Descoberta: as cinco estrelas da gaivota ligadas por fios. Sem nenhum glifo, a constelação só quer todas as estrelas acesas — e o sino canta. |
| prologue.c02 | **Veleiro** (Sailboat) | O Despertar | 7 | 8 | Eco, Acender tudo | 2 | Eco: apertar uma estrela vira também as vizinhas. Acender o veleiro inteiro pede só 3 toques bem escolhidos. |
| prologue.c03 | **Concha** (Scallop shell) | O Despertar | 6 | 8 | Fios (nó/corte) | 2 | A linguagem secreta: o fio cortado quer pontas diferentes, o nó quer pontas iguais. Ninguém explica — quando erra, quem pisca é o fio. |
| prologue.c04 | **Guarda-sol** (Beach umbrella) | O Despertar | 5 | 6 | Fios (nó/corte), Estaca | 3 | O guarda-sol fincado na areia: a estaca acesa decide o resto. Cada triângulo tem um número par de cortes — o fio sem marca se revela contando. |
| hub.c01 | **Ampulheta** (Hourglass) | Pátio das Nove Luzes | 8 | 10 | Medida, Fios (nó/corte) | 3 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 4 diz que ela termina ali; todo fio que sai dela é um corte. |
| hub.c02 | **Coração** (Heart) | Pátio das Nove Luzes | 10 | 10 | Medida, Fios (nó/corte) | 4 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 4 diz que ela termina ali; todo fio que sai dela é um corte. |
| hub.c03 | **Lanterna** (Lantern) | Pátio das Nove Luzes | 9 | 12 | Medida | 5 | O número não cabe de um lado só: a região de 5 tem de atravessar a ponte. |
| hub.c04 | **Balança** (Scales) | Pátio das Nove Luzes | 10 | 11 | Afinidade, Medida | 5 | A ponte: as duas gemas violeta estão em lados opostos e só se encontram atravessando a estrela do meio — ela é da família. |
| hub.c05 | **Espiral** (Spiral) | Pátio das Nove Luzes | 11 | 10 | Contorno, Medida | 7 | Numa árvore cada fronteira separa de vez: as medidas se encaixam como galhos, das folhas para o tronco. |
| hub.c06 | **Vela** (Candle) | Pátio das Nove Luzes | 11 | 12 | Medida, Contorno | 7 | Laço ímpar: luz e sombra não conseguem alternar o anel inteiro — em algum ponto dois vizinhos precisam concordar. |
| hub.c07 | **Árvore** (Tree) | Pátio das Nove Luzes | 12 | 11 | Contorno, Medida | 7 | O dissidente: dos 4 vizinhos do cubo, só um é diferente — descubra qual. |
| hub.c08 | **Mão** (Hand) | Pátio das Nove Luzes | 12 | 12 | Contorno, Medida | 8 | Amigo único: dos 3 fios do cubo, só um leva a alguém do mesmo estado — descubra qual. |
| hub.c09 | **Estrela** (Star) | Pátio das Nove Luzes | 10 | 15 | Contorno, Medida | 10 | Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si. |
| hub.c10 | **Infinito** (Infinity) | Pátio das Nove Luzes | 11 | 12 | Contorno, Medida | 10 | O número não cabe de um lado só: a região de 9 tem de atravessar a ponte. |
| kinship.c01 | **Cabeça de raposa** (Fox head) | Bosque Outonal | 8 | 10 | Afinidade | 2 | Afinidade em rede: cada família precisa de um caminho só dela, e famílias diferentes não podem se tocar no mesmo estado. |
| kinship.c02 | **Pena** (Feather) | Bosque Outonal | 8 | 10 | Afinidade | 2 | Afinidade em rede: cada família precisa de um caminho só dela, e famílias diferentes não podem se tocar no mesmo estado. |
| kinship.c03 | **Cogumelo** (Mushroom) | Bosque Outonal | 9 | 10 | Medida, Afinidade | 3 | A gema solitária: a âmbar é única e está no lugar mais movimentado — ela precisa de um mundo só dela, cercado pelo estado oposto. |
| kinship.c04 | **Cesto de colheita** (Harvest basket) | Bosque Outonal | 9 | 11 | Medida, Afinidade, Fios (nó/corte) | 3 | O cubo encosta em todo mundo: gemas de cores diferentes ao redor dele não podem ter o estado dele — senão se juntariam pelo centro. |
| kinship.c05 | **Coruja** (Owl) | Bosque Outonal | 10 | 11 | Afinidade, Medida | 4 | A gema solitária: a azuis é única e está no lugar mais movimentado — ela precisa de um mundo só dela, cercado pelo estado oposto. |
| kinship.c06 | **Folha de carvalho** (Oak leaf) | Bosque Outonal | 11 | 12 | Afinidade, Medida | 4 | A gema solitária: a carmim é única e está no lugar mais movimentado — ela precisa de um mundo só dela, cercado pelo estado oposto. |
| kinship.c07 | **Bolota** (Acorn) | Bosque Outonal | 11 | 12 | Medida, Afinidade | 5 | Laço ímpar de gemas: cores vizinhas diferentes precisam alternar luz e sombra, mas num anel ímpar a alternância não fecha — as duas gemas âmbar lado a lado dividem o estado. |
| kinship.c08 | **Abóbora** (Pumpkin) | Bosque Outonal | 11 | 13 | Afinidade, Medida | 5 | O cubo encosta em todo mundo: gemas de cores diferentes ao redor dele não podem ter o estado dele — senão se juntariam pelo centro. |
| kinship.c09 | **Pinha** (Pinecone) | Bosque Outonal | 11 | 13 | Medida, Afinidade | 5 | A gema solitária: a jade é única e está no lugar mais movimentado — ela precisa de um mundo só dela, cercado pelo estado oposto. |
| kinship.c10 | **Ouriço** (Hedgehog) | Bosque Outonal | 12 | 12 | Medida | 6 | Afinidade em rede: cada família precisa de um caminho só dela, e famílias diferentes não podem se tocar no mesmo estado. |
| kinship.c11 | **Esquilo** (Squirrel) | Bosque Outonal | 12 | 13 | Afinidade, Medida | 6 | Laço ímpar de gemas: cores vizinhas diferentes precisam alternar luz e sombra, mas num anel ímpar a alternância não fecha — as duas gemas âmbar lado a lado dividem o estado. |
| kinship.c12 | **Folha de bordo** (Maple leaf) | Bosque Outonal | 13 | 14 | Medida, Afinidade | 7 | O cubo encosta em todo mundo: gemas de cores diferentes ao redor dele não podem ter o estado dele — senão se juntariam pelo centro. |
| kinship.c13 | **Maçã** (Apple) | Bosque Outonal | 13 | 14 | Afinidade, Medida | 7 | A ponte: as duas gemas azuis estão em lados opostos e só se encontram atravessando a estrela do meio — ela é da família. |
| kinship.c14 | **Cabeça de urso** (Bear head) | Bosque Outonal | 14 | 17 | Afinidade, Medida | 9 | A ponte: as duas gemas violeta estão em lados opostos e só se encontram atravessando a estrela do meio — ela é da família. |
| kinship.c15 | **Cervo** (Deer) | Bosque Outonal | 15 | 17 | Afinidade, Medida | 9 | A ponte: as duas gemas jade estão em lados opostos e só se encontram atravessando a estrela do meio — ela é da família. |
| measure.c01 | **Chapéu de palha** (Straw hat) | Terraços | 6 | 9 | Medida | 1 | Medida em rede: a região conta as estrelas ligadas por fios, não as vizinhas no chão — conte pelos fios. |
| measure.c02 | **Monte Fuji** (Snowy mountain) | Terraços | 9 | 10 | Medida | 2 | Medida em rede: a região conta as estrelas ligadas por fios, não as vizinhas no chão — conte pelos fios. |
| measure.c03 | **Grou** (Crane) | Terraços | 10 | 12 | Medida, Fios (nó/corte) | 3 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 5 diz que ela termina ali; todo fio que sai dela é um corte. |
| measure.c04 | **Sapo** (Frog) | Terraços | 11 | 12 | Medida, Fios (nó/corte) | 3 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 4 diz que ela termina ali; todo fio que sai dela é um corte. |
| measure.c05 | **Bule** (Teapot) | Terraços | 11 | 14 | Medida, Fios (nó/corte) | 4 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 3 diz que ela termina ali; todo fio que sai dela é um corte. |
| measure.c06 | **Bambu** (Bamboo) | Terraços | 12 | 11 | Medida, Contorno | 4 | Numa árvore cada fronteira separa de vez: as medidas se encaixam como galhos, das folhas para o tronco. |
| measure.c07 | **Torii** (Torii gate) | Terraços | 12 | 13 | Medida, Fios (nó/corte) | 5 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 4 diz que ela termina ali; todo fio que sai dela é um corte. |
| measure.c08 | **Tigela com hashis** (Rice bowl) | Terraços | 12 | 13 | Medida, Fios (nó/corte) | 5 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 3 diz que ela termina ali; todo fio que sai dela é um corte. |
| measure.c09 | **Carpa** (Koi carp) | Terraços | 12 | 14 | Medida | 5 | O número não cabe de um lado só: a região de 4 tem de atravessar a ponte. |
| measure.c10 | **Espiga de arroz** (Rice stalk) | Terraços | 14 | 13 | Medida, Contorno | 6 | O número não cabe de um lado só: a região de 6 tem de atravessar a ponte. |
| measure.c11 | **Terraços** (Rice terraces) | Terraços | 13 | 16 | Medida, Fios (nó/corte) | 6 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 4 diz que ela termina ali; todo fio que sai dela é um corte. |
| measure.c12 | **Pagode** (Pagoda) | Terraços | 14 | 17 | Medida | 7 | Medida em rede: a região conta as estrelas ligadas por fios, não as vizinhas no chão — conte pelos fios. |
| measure.c13 | **Lanterna de papel** (Paper lantern) | Terraços | 14 | 16 | Medida, Fios (nó/corte) | 7 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 3 diz que ela termina ali; todo fio que sai dela é um corte. |
| measure.c14 | **Libélula** (Dragonfly) | Terraços | 16 | 19 | Medida | 9 | O número não cabe de um lado só: a região de 7 tem de atravessar a ponte. |
| measure.c15 | **Bonsai** (Bonsai) | Terraços | 16 | 19 | Medida | 9 | O número não cabe de um lado só: a região de 4 tem de atravessar a ponte. |
| mold.c01 | **Pirâmide** (Pyramid) | Pedreira | 7 | 10 | Medida | 2 | Medida em rede: a região conta as estrelas ligadas por fios, não as vizinhas no chão — conte pelos fios. |
| mold.c02 | **Martelo** (Hammer) | Pedreira | 8 | 9 | Medida, Contorno | 2 | O dissidente: dos 3 vizinhos do cubo, só um é diferente — descubra qual. |
| mold.c03 | **Cinzel** (Chisel) | Pedreira | 8 | 9 | Medida, Fios (nó/corte) | 3 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 4 diz que ela termina ali; todo fio que sai dela é um corte. |
| mold.c04 | **Picareta** (Pickaxe) | Pedreira | 9 | 9 | Contorno, Medida | 4 | Amigo único: dos 3 fios do cubo, só um leva a alguém do mesmo estado — descubra qual. |
| mold.c05 | **Bigorna** (Anvil) | Pedreira | 9 | 9 | Medida, Fios (nó/corte) | 4 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 4 diz que ela termina ali; todo fio que sai dela é um corte. |
| mold.c06 | **Pá** (Shovel) | Pedreira | 9 | 10 | Medida | 5 | O número não cabe de um lado só: a região de 6 tem de atravessar a ponte. |
| mold.c07 | **Dólmen** (Dolmen) | Pedreira | 10 | 13 | Medida, Contorno | 5 | O dissidente: dos 3 vizinhos do cubo, só um é diferente — descubra qual. |
| mold.c08 | **Serra** (Hand saw) | Pedreira | 11 | 12 | Medida, Fios (nó/corte) | 5 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 4 diz que ela termina ali; todo fio que sai dela é um corte. |
| mold.c09 | **Carrinho de mão** (Wheelbarrow) | Pedreira | 12 | 13 | Medida | 6 | O número não cabe de um lado só: a região de 7 tem de atravessar a ponte. |
| mold.c10 | **Guindaste** (Tower crane) | Pedreira | 14 | 16 | Medida | 6 | O número não cabe de um lado só: a região de 9 tem de atravessar a ponte. |
| mold.c11 | **Coluna** (Column) | Pedreira | 12 | 14 | Medida, Fios (nó/corte) | 7 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 4 diz que ela termina ali; todo fio que sai dela é um corte. |
| mold.c12 | **Vagonete** (Mine cart) | Pedreira | 14 | 17 | Medida, Contorno | 9 | Amigo único: dos 4 fios do cubo, só um leva a alguém do mesmo estado — descubra qual. |
| mold.c13 | **Arco de pedra** (Stone arch) | Pedreira | 14 | 19 | Contorno, Medida | 9 | O dissidente: dos 3 vizinhos do cubo, só um é diferente — descubra qual. |
| contour.c01 | **Casinha de passarinho** (Birdhouse) | Jardim de Sebes | 9 | 10 | Contorno | 2 | Contorno em rede: cada estrela conta só os seus próprios fios — as pontas decidem umas às outras. |
| contour.c02 | **Colmeia** (Beehive) | Jardim de Sebes | 9 | 12 | Medida, Contorno | 3 | Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si. |
| contour.c03 | **Tulipa** (Tulip) | Jardim de Sebes | 11 | 11 | Contorno | 3 | Amigo único: dos 3 fios do cubo, só um leva a alguém do mesmo estado — descubra qual. |
| contour.c04 | **Regador** (Watering can) | Jardim de Sebes | 10 | 12 | Contorno, Medida | 3 | Laço ímpar: luz e sombra não conseguem alternar o anel inteiro — em algum ponto dois vizinhos precisam concordar. |
| contour.c05 | **Pavão** (Peacock) | Jardim de Sebes | 10 | 12 | Contorno, Medida | 4 | Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si. |
| contour.c06 | **Rosa** (Rose) | Jardim de Sebes | 12 | 14 | Medida, Contorno | 5 | Laço ímpar: luz e sombra não conseguem alternar o anel inteiro — em algum ponto dois vizinhos precisam concordar. |
| contour.c07 | **Passarinho** (Songbird) | Jardim de Sebes | 11 | 12 | Contorno, Medida | 5 | Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si. |
| contour.c08 | **Margarida** (Daisy) | Jardim de Sebes | 12 | 18 | Contorno, Medida | 6 | Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si. |
| contour.c09 | **Caracol** (Snail) | Jardim de Sebes | 13 | 14 | Contorno, Medida | 6 | Contorno em rede: cada estrela conta só os seus próprios fios — as pontas decidem umas às outras. |
| contour.c10 | **Chafariz** (Fountain) | Jardim de Sebes | 14 | 18 | Medida, Contorno | 7 | Contorno em rede: cada estrela conta só os seus próprios fios — as pontas decidem umas às outras. |
| contour.c11 | **Borboleta** (Butterfly) | Jardim de Sebes | 14 | 17 | Contorno, Medida | 8 | Contorno em rede: cada estrela conta só os seus próprios fios — as pontas decidem umas às outras. |
| contour.c12 | **Joaninha** (Ladybug) | Jardim de Sebes | 12 | 14 | Contorno, Medida | 8 | Laço ímpar: luz e sombra não conseguem alternar o anel inteiro — em algum ponto dois vizinhos precisam concordar. |
| contour.c13 | **Abelha** (Bee) | Jardim de Sebes | 13 | 18 | Medida, Contorno, Fios (nó/corte) | 9 | Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si. |
| mosaic.c01 | **Obelisco** (Obelisk) | Templo das Areias | 9 | 11 | Mosaico | 2 | Mosaico em rede: a janela de cada estrela é ela mais as vizinhas pelos fios — comece pelas janelas pequenas. |
| mosaic.c02 | **Papiro** (Papyrus) | Templo das Areias | 10 | 12 | Mosaico, Contorno, Estaca | 3 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| mosaic.c03 | **Palmeira** (Palm tree) | Templo das Areias | 13 | 12 | Mosaico, Contorno, Fios (nó/corte) | 3 | Uma folha só enxerga a si mesma e o pai: comece pelas pontas e caminhe para dentro. |
| mosaic.c04 | **Camelo** (Camel) | Templo das Areias | 13 | 13 | Mosaico | 3 | Uma folha só enxerga a si mesma e o pai: comece pelas pontas e caminhe para dentro. |
| mosaic.c05 | **Íbis** (Ibis) | Templo das Areias | 11 | 11 | Mosaico, Contorno | 3 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| mosaic.c06 | **Ankh** (Ankh) | Templo das Areias | 11 | 11 | Mosaico, Contorno | 4 | Uma folha só enxerga a si mesma e o pai: comece pelas pontas e caminhe para dentro. |
| mosaic.c07 | **Olho de Hórus** (Eye of Horus) | Templo das Areias | 13 | 13 | Contorno, Mosaico | 4 | Uma folha só enxerga a si mesma e o pai: comece pelas pontas e caminhe para dentro. |
| mosaic.c08 | **Lótus** (Lotus) | Templo das Areias | 11 | 13 | Mosaico, Contorno | 4 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| mosaic.c09 | **Naja** (Cobra) | Templo das Areias | 12 | 12 | Mosaico, Contorno, Fios (nó/corte) | 4 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| mosaic.c10 | **Gato sentado** (Sitting cat) | Templo das Areias | 14 | 14 | Mosaico, Contorno, Fios (nó/corte) | 5 | Mosaico em rede: a janela de cada estrela é ela mais as vizinhas pelos fios — comece pelas janelas pequenas. |
| mosaic.c11 | **Ânfora** (Amphora) | Templo das Areias | 11 | 13 | Mosaico, Contorno, Fios (nó/corte) | 5 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| mosaic.c12 | **Esfinge** (Sphinx) | Templo das Areias | 12 | 14 | Mosaico | 5 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| mosaic.c13 | **Escorpião** (Scorpion) | Templo das Areias | 16 | 16 | Mosaico, Contorno, Fios (nó/corte) | 5 | Mosaico em rede: a janela de cada estrela é ela mais as vizinhas pelos fios — comece pelas janelas pequenas. |
| mosaic.c14 | **Escaravelho** (Scarab) | Templo das Areias | 15 | 17 | Mosaico, Contorno | 6 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| mosaic.c15 | **Lamparina** (Oil lamp) | Templo das Areias | 12 | 15 | Mosaico, Contorno | 6 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| beacon.c01 | **Tridente** (Trident) | Penhascos dos Faróis | 8 | 8 | Contorno, Mosaico | 2 | Mosaico em rede: a janela de cada estrela é ela mais as vizinhas pelos fios — comece pelas janelas pequenas. |
| beacon.c02 | **Âncora** (Anchor) | Penhascos dos Faróis | 14 | 14 | Contorno, Mosaico, Fios (nó/corte) | 3 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| beacon.c03 | **Navio** (Schooner) | Penhascos dos Faróis | 10 | 12 | Mosaico, Contorno | 3 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| beacon.c04 | **Baleia** (Whale) | Penhascos dos Faróis | 12 | 13 | Contorno, Mosaico | 4 | O dissidente: dos 4 vizinhos do cubo, só um é diferente — descubra qual. |
| beacon.c05 | **Cavalo-marinho** (Seahorse) | Penhascos dos Faróis | 13 | 14 | Mosaico, Contorno, Fios (nó/corte) | 4 | Amigo único: dos 4 fios do cubo, só um leva a alguém do mesmo estado — descubra qual. |
| beacon.c06 | **Chave** (Key) | Penhascos dos Faróis | 12 | 13 | Mosaico, Contorno | 4 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| beacon.c07 | **Polvo** (Octopus) | Penhascos dos Faróis | 13 | 13 | Contorno, Mosaico | 4 | Uma folha só enxerga a si mesma e o pai: comece pelas pontas e caminhe para dentro. |
| beacon.c08 | **Golfinho** (Dolphin) | Penhascos dos Faróis | 13 | 15 | Contorno, Mosaico, Fios (nó/corte) | 4 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| beacon.c09 | **Caranguejo** (Crab) | Penhascos dos Faróis | 16 | 16 | Contorno, Mosaico, Fios (nó/corte) | 5 | O dissidente: dos 3 vizinhos do cubo, só um é diferente — descubra qual. |
| beacon.c10 | **Boia salva-vidas** (Life ring) | Penhascos dos Faróis | 16 | 20 | Contorno, Mosaico | 6 | Amigo único: dos 3 fios do cubo, só um leva a alguém do mesmo estado — descubra qual. |
| beacon.c11 | **Rosa dos ventos** (Compass rose) | Penhascos dos Faróis | 16 | 16 | Mosaico, Contorno, Fios (nó/corte) | 6 | Mosaico em rede: a janela de cada estrela é ela mais as vizinhas pelos fios — comece pelas janelas pequenas. |
| beacon.c12 | **Farol** (Lighthouse) | Penhascos dos Faróis | 13 | 16 | Mosaico, Contorno, Fios (nó/corte) | 6 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| beacon.c13 | **Leme** (Ship wheel) | Penhascos dos Faróis | 16 | 20 | Contorno, Mosaico | 7 | Amigo único: dos 3 fios do cubo, só um leva a alguém do mesmo estado — descubra qual. |
| weave.c01 | **Pipa** (Kite) | Vale dos Moinhos | 8 | 11 | Fios (nó/corte) | 1 | A linguagem secreta dos fios: o nó quer pontas iguais, o corte quer pontas diferentes — siga a corrente. |
| weave.c02 | **Novelo** (Ball of yarn) | Vale dos Moinhos | 10 | 12 | Fios (nó/corte) | 1 | A linguagem secreta dos fios: o nó quer pontas iguais, o corte quer pontas diferentes — siga a corrente. |
| weave.c03 | **Fuso** (Drop spindle) | Vale dos Moinhos | 11 | 12 | Medida, Contorno, Fios (nó/corte) | 3 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 5 diz que ela termina ali; todo fio que sai dela é um corte. |
| weave.c04 | **Tesoura** (Scissors) | Vale dos Moinhos | 11 | 12 | Medida, Contorno, Fios (nó/corte) | 3 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| weave.c05 | **Coelho** (Rabbit) | Vale dos Moinhos | 11 | 13 | Contorno, Medida, Fios (nó/corte) | 4 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 3 diz que ela termina ali; todo fio que sai dela é um corte. |
| weave.c06 | **Celeiro** (Barn) | Vale dos Moinhos | 11 | 14 | Medida, Fios (nó/corte) | 4 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 3 diz que ela termina ali; todo fio que sai dela é um corte. |
| weave.c07 | **Roca** (Spinning wheel) | Vale dos Moinhos | 13 | 14 | Medida, Contorno, Fios (nó/corte) | 5 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| weave.c08 | **Poço** (Water well) | Vale dos Moinhos | 13 | 17 | Medida, Fios (nó/corte) | 5 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 5 diz que ela termina ali; todo fio que sai dela é um corte. |
| weave.c09 | **Moinho** (Windmill) | Vale dos Moinhos | 14 | 15 | Contorno, Medida, Fios (nó/corte) | 5 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| weave.c10 | **Carretel** (Spool of thread) | Vale dos Moinhos | 14 | 16 | Medida, Fios (nó/corte) | 6 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| weave.c11 | **Galo** (Rooster) | Vale dos Moinhos | 15 | 15 | Contorno, Medida, Fios (nó/corte) | 7 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 3 diz que ela termina ali; todo fio que sai dela é um corte. |
| weave.c12 | **Ovelha** (Sheep) | Vale dos Moinhos | 15 | 16 | Medida | 7 | A linguagem secreta dos fios: o nó quer pontas iguais, o corte quer pontas diferentes — siga a corrente. |
| weave.c13 | **Teia de aranha** (Spider web) | Vale dos Moinhos | 15 | 25 | Medida, Fios (nó/corte) | 8 | A linguagem secreta dos fios: o nó quer pontas iguais, o corte quer pontas diferentes — siga a corrente. |
| weave.c14 | **Ferradura** (Horseshoe) | Vale dos Moinhos | 14 | 16 | Medida, Fios (nó/corte) | 9 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 5 diz que ela termina ali; todo fio que sai dela é um corte. |
| weave.c15 | **Espantalho** (Scarecrow) | Vale dos Moinhos | 15 | 17 | Contorno, Medida, Fios (nó/corte) | 9 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| twins.c01 | **Lua crescente** (Crescent moon) | Lago Espelhado | 9 | 9 | Eco, Acender tudo | 2 | Anel de eco: cada toque vira três estrelas; o anel inteiro decide quantos toques cabem. |
| twins.c02 | **Barco de papel** (Paper boat) | Lago Espelhado | 8 | 10 | Eco, Acender tudo | 2 | Eco: cada toque vira a estrela e suas vizinhas — acender o desenho inteiro pede exatamente 7 toques certos. |
| twins.c03 | **Espelho de mão** (Hand mirror) | Lago Espelhado | 10 | 11 | Mosaico, Contorno, Eco | 3 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| twins.c04 | **Salgueiro** (Weeping willow) | Lago Espelhado | 11 | 10 | Contorno, Mosaico, Eco | 3 | Duas etapas: primeiro descubra o desenho pelas regras; depois persiga-o com ecos, das folhas para dentro. |
| twins.c05 | **Canoa** (Canoe) | Lago Espelhado | 10 | 12 | Contorno, Mosaico, Eco | 3 | Duas etapas: as regras decidem o desenho; o eco decide como chegar nele — cada toque mexe numa vizinhança inteira. |
| twins.c06 | **Garça** (Heron) | Lago Espelhado | 11 | 11 | Mosaico, Contorno, Eco | 4 | Duas etapas: as regras decidem o desenho; o eco decide como chegar nele — cada toque mexe numa vizinhança inteira. |
| twins.c07 | **Cisne** (Swan) | Lago Espelhado | 11 | 12 | Medida, Mosaico, Contorno, Eco | 4 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| twins.c08 | **Flamingo** (Flamingo) | Lago Espelhado | 11 | 12 | Contorno, Mosaico, Eco | 4 | Duas etapas: as regras decidem o desenho; o eco decide como chegar nele — cada toque mexe numa vizinhança inteira. |
| twins.c09 | **Pato** (Duck) | Lago Espelhado | 13 | 15 | Medida, Mosaico, Contorno, Eco | 4 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| twins.c10 | **Peixes gêmeos** (Twin fish) | Lago Espelhado | 13 | 16 | Mosaico, Medida, Eco | 6 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| twins.c11 | **Tartaruga** (Turtle) | Lago Espelhado | 14 | 14 | Medida, Contorno, Eco | 6 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| twins.c12 | **Ponte** (Moon bridge) | Lago Espelhado | 13 | 16 | Mosaico, Medida, Contorno, Eco | 6 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| twins.c13 | **Ninfeia** (Water lily) | Lago Espelhado | 15 | 16 | Medida, Contorno, Eco | 6 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| twins.c14 | **Os Gêmeos** (The Twins) | Lago Espelhado | 15 | 16 | Contorno, Medida, Mosaico, Eco | 8 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| twins.c15 | **Nuvem de chuva** (Rain cloud) | Lago Espelhado | 16 | 16 | Mosaico, Medida, Eco | 9 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| citadel.c01 | **Estandarte** (Banner) | Cidadela | 7 | 7 | Medida, Contorno, Fios (nó/corte) | 3 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| citadel.c02 | **Escudo** (Shield) | Cidadela | 8 | 9 | Medida, Fios (nó/corte) | 3 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 5 diz que ela termina ali; todo fio que sai dela é um corte. |
| citadel.c03 | **Coroa** (Crown) | Cidadela | 9 | 10 | Afinidade, Mosaico | 4 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| citadel.c04 | **Arco e flecha** (Bow and arrow) | Cidadela | 9 | 10 | Contorno, Afinidade | 4 | O dissidente: dos 5 vizinhos do cubo, só um é diferente — descubra qual. |
| citadel.c05 | **Trono** (Throne) | Cidadela | 9 | 10 | Afinidade | 5 | A gema solitária: a violeta é única e está no lugar mais movimentado — ela precisa de um mundo só dela, cercado pelo estado oposto. |
| citadel.c06 | **Machado de guerra** (Battle axe) | Cidadela | 10 | 11 | Medida, Afinidade, Fios (nó/corte) | 5 | Laço ímpar de gemas: cores vizinhas diferentes precisam alternar luz e sombra, mas num anel ímpar a alternância não fecha — as duas gemas carmim lado a lado dividem o estado. |
| citadel.c07 | **Espada** (Sword) | Cidadela | 10 | 12 | Medida, Fios (nó/corte) | 6 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 5 diz que ela termina ali; todo fio que sai dela é um corte. |
| citadel.c08 | **Cálice** (Chalice) | Cidadela | 11 | 11 | Afinidade, Medida, Fios (nó/corte) | 7 | O cubo encosta em todo mundo: gemas de cores diferentes ao redor dele não podem ter o estado dele — senão se juntariam pelo centro. |
| citadel.c09 | **Elmo** (Helmet) | Cidadela | 11 | 13 | Contorno, Medida | 8 | O número não cabe de um lado só: a região de 5 tem de atravessar a ponte. |
| citadel.c10 | **Cabeça de cavalo** (Horse head) | Cidadela | 12 | 12 | Medida, Fios (nó/corte) | 8 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 5 diz que ela termina ali; todo fio que sai dela é um corte. |
| citadel.c11 | **Flor-de-lis** (Fleur-de-lis) | Cidadela | 15 | 17 | Medida | 10 | O número não cabe de um lado só: a região de 5 tem de atravessar a ponte. |
| citadel.c12 | **Torre** (Castle tower) | Cidadela | 13 | 14 | Afinidade, Medida | 10 | Laço ímpar de gemas: cores vizinhas diferentes precisam alternar luz e sombra, mas num anel ímpar a alternância não fecha — as duas gemas âmbar lado a lado dividem o estado. |
| echo.c01 | **Diapasão** (Tuning fork) | Caverna Ressonante | 6 | 5 | Contorno, Mosaico, Eco | 3 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| echo.c02 | **Tocha** (Torch) | Caverna Ressonante | 8 | 9 | Mosaico, Eco | 4 | Duas etapas: as regras decidem o desenho; o eco decide como chegar nele — cada toque mexe numa vizinhança inteira. |
| echo.c03 | **Harpa** (Harp) | Caverna Ressonante | 9 | 12 | Medida, Mosaico, Contorno, Eco | 4 | Duas etapas: as regras decidem o desenho; o eco decide como chegar nele — cada toque mexe numa vizinhança inteira. |
| echo.c04 | **Gota d'água** (Water drop) | Caverna Ressonante | 10 | 11 | Mosaico, Contorno, Eco | 5 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| echo.c05 | **Tambor** (Drum) | Caverna Ressonante | 9 | 14 | Medida, Eco | 6 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| echo.c06 | **Sino** (Bell) | Caverna Ressonante | 11 | 12 | Medida, Eco | 6 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| echo.c07 | **Cristal** (Crystal) | Caverna Ressonante | 12 | 14 | Contorno, Mosaico, Medida, Eco | 7 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| echo.c08 | **Estalactites** (Stalactites) | Caverna Ressonante | 12 | 15 | Medida, Contorno, Eco | 7 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| echo.c09 | **Morcego** (Bat) | Caverna Ressonante | 14 | 14 | Mosaico, Medida, Fios (nó/corte), Eco | 10 | Duas etapas: as regras decidem o desenho; o eco decide como chegar nele — cada toque mexe numa vizinhança inteira. |
| echo.c10 | **Flauta de Pã** (Pan flute) | Caverna Ressonante | 15 | 22 | Medida, Mosaico, Eco | 10 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |

# As Constelações — a camada secreta de Tessella

> Nenhum lugar do jogo ensina isto. Quem descobrir, descobre 150 puzzles a mais.

## A ideia

Espalhadas pela ilha existem **redes de estrelas**: lanternas, conchas, pedras, vitórias-régias, cristais, braseiros —
objetos que parecem decoração, ligados por **fios finos de luz**. Cada objeto é uma *estrela* que acende e apaga
com um clique. Cada rede tem um **sino**: tocar o sino confere a constelação. Se estiver certa, os fios brilham para sempre
e o Salão das Tesselas ganha uma luz; se estiver errada, as estrelas e os fios culpados piscam em vermelho.

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

1. No Despertar, três conchas na praia têm fios brilhando entre elas. Quem mira nelas vê o cursor virar anel —
   como num painel. Clicar acende. Tocar o sino com tudo aceso faz a primeira constelação cantar.
2. A segunda tem eco (apertar uma vira as vizinhas) — só se descobre apertando.
3. A terceira e a quarta ensinam sozinhas a linguagem secreta dos fios: o erro pisca *no fio*.
4. A partir da primeira solução, um vitral escondido no Salão das Tesselas acende e mostra `1 / 150`.
5. Com 100 constelações, abre-se o Cofre Oculto.

### Uma percepção por constelação

Toda constelação não trivial nasce de **uma ideia que só existe em rede** (nunca numa grade). A nota de cada uma
no catálogo nomeia essa ideia. As famílias de percepções:

| Percepção | Ideia |
|---|---|
| A ponte | uma estrela (ponto de corte) é a única passagem entre duas partes: famílias ou regiões que precisam se encontrar passam por ela |
| O número não cabe | a Medida é maior que um lado inteiro da ponte: a região é obrigada a atravessar |
| O cubo | a estrela com muitos fios encosta em todo mundo: só uma família pode ter o estado dela |
| Amigo único / o dissidente | Contorno 1 ou N−1 num cubo: exatamente um vizinho é igual (ou diferente) |
| A janela inteira | o Mosaico de um cubo conta a vizinhança toda; comparado com uma vizinha, sobra pouco |
| Janelas quase iguais | dois centros veem as mesmas estrelas, menos as próprias: subtraia |
| Folhas | o Mosaico de uma folha só vê ela e o pai: resolva das pontas para dentro |
| Árvore de medidas | numa árvore cada fronteira corta de vez; as Medidas se encaixam como galhos |
| Laço ímpar | num anel ímpar, luz e sombra não alternam o caminho todo: em algum ponto dois vizinhos concordam |
| Paridade do laço | todo laço tem um número par de fios cortados: o elo sem marca se revela contando |
| Corrente de nós | estrelas amarradas por nós são uma região só; a Medida diz onde ela termina |
| Famílias entrelaçadas | cores que se cruzam no anel só se resolvem se uma passa por dentro (pelo cubo) e a outra por fora |
| Triângulos | todo triângulo tem 0 ou 2 fronteiras, nunca 1 ou 3 |
| A soma par | a soma de todos os Contornos é o dobro dos fios cortados: sempre par |
| A gema solitária | uma cor única no lugar mais movimentado precisa de um mundo só dela |
| Eco na árvore / no anel | uma folha só mexe nela e no pai; num anel cada toque vira três estrelas |
| Eco alcançável | as regras admitem duas respostas, mas apertando estrelas só se chega a uma |

As últimas constelações de cada lugar são **vitrines**: desenhos (pássaro, peixe, chave, borboleta, flor, lanterna,
coroa, crescente…) cuja forma carrega a percepção, com mais camadas de raciocínio.

### Garantias

- Todas as redes são planas (fios nunca se cruzam), com estrelas a ≥ 1,6 m umas das outras, dentro de um raio de 7 m;
  o sino fica fora da rede, a até 8,6 m do centro, de preferência do lado +z (sul).
- Toda constelação tem **uma única solução** (para regras simétricas — sem mosaico nem estaca — a solução invertida
  também vale e é aceita) e pode ser resolvida **só com raciocínio**, sem chute: o gerador simula um jogador cuidadoso
  (deduções locais + hipóteses com contradição) e descarta o que exigir tentativa e erro. A dificuldade vem da
  profundidade do raciocínio, não do tamanho: candidatas difíceis só por serem grandes são descartadas.
- Nas constelações com eco, a solução é alcançável apertando estrelas a partir do estado inicial.

## Catálogo

| id | lugar | estrelas | fios | regras | dificuldade | nota |
|---|---|---|---|---|---|---|
| prologue.c01 | O Despertar | 3 | 2 | Acender tudo | 1 | Descoberta: três conchas ligadas por fios. Sem nenhum glifo, a constelação só quer todas as estrelas acesas — e o sino canta. |
| prologue.c02 | O Despertar | 4 | 3 | Eco, Acender tudo | 2 | Eco: apertar uma estrela vira também as vizinhas. Acender as quatro = apertar só as duas pontas. |
| prologue.c03 | O Despertar | 3 | 2 | Fios (nó/corte) | 2 | A linguagem secreta: o fio cortado quer pontas diferentes, o nó quer pontas iguais. Ninguém explica — quando erra, quem pisca é o fio. |
| prologue.c04 | O Despertar | 4 | 4 | Fios (nó/corte), Estaca | 3 | Um laço de quatro com dois cortes e dois nós: cortes em número par fecham o laço. A estaca acesa decide o resto. |
| hub.c01 | Pátio das Nove Luzes | 9 | 12 | Mosaico, Contorno | 3 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| hub.c02 | Pátio das Nove Luzes | 7 | 8 | Medida, Afinidade | 4 | A ponte: as duas gemas violeta estão em lados opostos e só se encontram atravessando a estrela do meio — ela é da família. |
| hub.c03 | Pátio das Nove Luzes | 7 | 9 | Mosaico, Contorno | 4 | Janelas quase iguais: os dois centros enxergam as mesmas estrelas, menos as suas próprias — subtraia uma janela da outra. |
| hub.c04 | Pátio das Nove Luzes | 9 | 9 | Contorno, Mosaico, Medida | 4 | Laço ímpar: luz e sombra não conseguem alternar o anel inteiro — em algum ponto dois vizinhos precisam concordar. |
| hub.c05 | Pátio das Nove Luzes | 11 | 17 | Medida, Fios (nó/corte) | 6 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 4 diz que ela termina ali; todo fio que sai dela é um corte. |
| hub.c06 | Pátio das Nove Luzes | 9 | 10 | Medida, Fios (nó/corte) | 6 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| hub.c07 | Pátio das Nove Luzes | 11 | 12 | Afinidade, Medida | 7 | A gema solitária: a azuis é única e está no lugar mais movimentado — ela precisa de um mundo só dela, cercado pelo estado oposto. |
| hub.c08 | Pátio das Nove Luzes | 10 | 18 | Afinidade, Medida | 7 | Famílias entrelaçadas: as gemas âmbar e marfim se cruzam no anel — uma família passa por dentro, pelo cubo, e a outra precisa dar a volta por fora, no estado oposto. |
| hub.c09 | Pátio das Nove Luzes | 9 | 13 | Contorno, Medida, Fios (nó/corte) | 9 | Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si. |
| hub.c10 | Pátio das Nove Luzes | 11 | 11 | Medida, Afinidade | 9 | A ponte: as duas gemas azuis estão em lados opostos e só se encontram atravessando a estrela do meio — ela é da família. |
| kinship.c01 | Bosque Outonal | 4 | 3 | Afinidade | 2 | Aquecimento: a linguagem do lugar, agora em rede. |
| kinship.c02 | Bosque Outonal | 4 | 4 | Afinidade | 2 | Aquecimento: a linguagem do lugar, agora em rede. |
| kinship.c03 | Bosque Outonal | 8 | 14 | Afinidade | 3 | O cubo encosta em todo mundo: gemas de cores diferentes ao redor dele não podem ter o estado dele — senão se juntariam pelo centro. |
| kinship.c04 | Bosque Outonal | 7 | 8 | Afinidade | 4 | A ponte: as duas gemas jade estão em lados opostos e só se encontram atravessando a estrela do meio — ela é da família. |
| kinship.c05 | Bosque Outonal | 9 | 9 | Afinidade | 4 | Laço ímpar de gemas: cores vizinhas diferentes precisam alternar luz e sombra, mas num anel ímpar a alternância não fecha — as duas gemas violeta lado a lado dividem o estado. |
| kinship.c06 | Bosque Outonal | 9 | 9 | Afinidade, Medida | 4 | Laço ímpar de gemas: cores vizinhas diferentes precisam alternar luz e sombra, mas num anel ímpar a alternância não fecha — as duas gemas carmim lado a lado dividem o estado. |
| kinship.c07 | Bosque Outonal | 12 | 14 | Medida, Afinidade | 5 | A ponte: as duas gemas carmim estão em lados opostos e só se encontram atravessando a estrela do meio — ela é da família. |
| kinship.c08 | Bosque Outonal | 10 | 18 | Afinidade | 5 | Famílias entrelaçadas: as gemas violeta e azuis se cruzam no anel — uma família passa por dentro, pelo cubo, e a outra precisa dar a volta por fora, no estado oposto. |
| kinship.c09 | Bosque Outonal | 11 | 12 | Afinidade | 5 | A gema solitária: a jade é única e está no lugar mais movimentado — ela precisa de um mundo só dela, cercado pelo estado oposto. |
| kinship.c10 | Bosque Outonal | 9 | 16 | Medida, Afinidade | 5 | O cubo encosta em todo mundo: gemas de cores diferentes ao redor dele não podem ter o estado dele — senão se juntariam pelo centro. |
| kinship.c11 | Bosque Outonal | 12 | 16 | Afinidade | 6 | A gema solitária: a violeta é única e está no lugar mais movimentado — ela precisa de um mundo só dela, cercado pelo estado oposto. |
| kinship.c12 | Bosque Outonal | 11 | 20 | Afinidade, Medida | 7 | Famílias entrelaçadas: as gemas jade e marfim se cruzam no anel — uma família passa por dentro, pelo cubo, e a outra precisa dar a volta por fora, no estado oposto. |
| kinship.c13 | Bosque Outonal | 11 | 13 | Medida, Afinidade | 7 | A ponte: as duas gemas marfim estão em lados opostos e só se encontram atravessando a estrela do meio — ela é da família. |
| kinship.c14 | Bosque Outonal | 12 | 22 | Afinidade, Medida | 7 | Famílias entrelaçadas: as gemas violeta e âmbar se cruzam no anel — uma família passa por dentro, pelo cubo, e a outra precisa dar a volta por fora, no estado oposto. |
| kinship.c15 | Bosque Outonal | 11 | 11 | Afinidade, Medida | 9 | A ponte: as duas gemas azuis estão em lados opostos e só se encontram atravessando a estrela do meio — ela é da família. |
| measure.c01 | Terraços | 4 | 3 | Medida | 1 | Aquecimento: a linguagem do lugar, agora em rede. |
| measure.c02 | Terraços | 5 | 4 | Medida | 2 | Aquecimento: a linguagem do lugar, agora em rede. |
| measure.c03 | Terraços | 7 | 6 | Medida | 3 | Numa árvore cada fronteira separa de vez: as medidas se encaixam como galhos, das folhas para o tronco. |
| measure.c04 | Terraços | 9 | 10 | Medida, Fios (nó/corte) | 4 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 4 diz que ela termina ali; todo fio que sai dela é um corte. |
| measure.c05 | Terraços | 9 | 10 | Medida | 4 | O número não cabe de um lado só: a região de 5 tem de atravessar a ponte. |
| measure.c06 | Terraços | 8 | 7 | Medida | 4 | Numa árvore cada fronteira separa de vez: as medidas se encaixam como galhos, das folhas para o tronco. |
| measure.c07 | Terraços | 10 | 12 | Medida, Contorno | 5 | O número não cabe de um lado só: a região de 6 tem de atravessar a ponte. |
| measure.c08 | Terraços | 11 | 17 | Medida, Fios (nó/corte) | 6 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 5 diz que ela termina ali; todo fio que sai dela é um corte. |
| measure.c09 | Terraços | 13 | 12 | Medida, Contorno | 6 | Numa árvore cada fronteira separa de vez: as medidas se encaixam como galhos, das folhas para o tronco. |
| measure.c10 | Terraços | 11 | 12 | Medida | 6 | O número não cabe de um lado só: a região de 7 tem de atravessar a ponte. |
| measure.c11 | Terraços | 14 | 16 | Medida, Fios (nó/corte) | 6 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 4 diz que ela termina ali; todo fio que sai dela é um corte. |
| measure.c12 | Terraços | 11 | 10 | Medida, Contorno | 6 | Numa árvore cada fronteira separa de vez: as medidas se encaixam como galhos, das folhas para o tronco. |
| measure.c13 | Terraços | 12 | 14 | Medida | 7 | O número não cabe de um lado só: a região de 8 tem de atravessar a ponte. |
| measure.c14 | Terraços | 9 | 14 | Contorno, Medida, Fios (nó/corte) | 7 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 4 diz que ela termina ali; todo fio que sai dela é um corte. |
| measure.c15 | Terraços | 11 | 11 | Medida | 9 | O número não cabe de um lado só: a região de 7 tem de atravessar a ponte. |
| mold.c01 | Pedreira | 4 | 4 | Medida | 1 | Aquecimento: a linguagem do lugar, agora em rede. |
| mold.c02 | Pedreira | 8 | 14 | Contorno, Medida | 2 | Amigo único: dos 7 fios do cubo, só um leva a alguém do mesmo estado — descubra qual. |
| mold.c03 | Pedreira | 9 | 10 | Contorno | 3 | A soma de todos os contornos é sempre par (cada fio cortado conta duas vezes) — a estrela sem número se descobre contando. |
| mold.c04 | Pedreira | 9 | 10 | Medida, Contorno, Fios (nó/corte) | 3 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 5 diz que ela termina ali; todo fio que sai dela é um corte. |
| mold.c05 | Pedreira | 9 | 10 | Medida | 4 | O número não cabe de um lado só: a região de 6 tem de atravessar a ponte. |
| mold.c06 | Pedreira | 11 | 17 | Contorno | 4 | A soma de todos os contornos é sempre par (cada fio cortado conta duas vezes) — a estrela sem número se descobre contando. |
| mold.c07 | Pedreira | 11 | 17 | Contorno, Medida | 4 | Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si. |
| mold.c08 | Pedreira | 9 | 8 | Medida | 5 | Numa árvore cada fronteira separa de vez: as medidas se encaixam como galhos, das folhas para o tronco. |
| mold.c09 | Pedreira | 11 | 12 | Contorno, Medida | 5 | O dissidente: dos 5 vizinhos do cubo, só um é diferente — descubra qual. |
| mold.c10 | Pedreira | 12 | 13 | Medida, Contorno, Fios (nó/corte) | 6 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 4 diz que ela termina ali; todo fio que sai dela é um corte. |
| mold.c11 | Pedreira | 13 | 21 | Contorno, Medida | 7 | Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si. |
| mold.c12 | Pedreira | 8 | 12 | Medida, Contorno | 7 | Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si. |
| mold.c13 | Pedreira | 11 | 11 | Medida | 9 | O número não cabe de um lado só: a região de 5 tem de atravessar a ponte. |
| contour.c01 | Jardim de Sebes | 5 | 4 | Contorno | 1 | Aquecimento: a linguagem do lugar, agora em rede. |
| contour.c02 | Jardim de Sebes | 6 | 6 | Contorno | 2 | Laço ímpar: luz e sombra não conseguem alternar o anel inteiro — em algum ponto dois vizinhos precisam concordar. |
| contour.c03 | Jardim de Sebes | 7 | 12 | Contorno | 3 | Amigo único: dos 6 fios do cubo, só um leva a alguém do mesmo estado — descubra qual. |
| contour.c04 | Jardim de Sebes | 8 | 10 | Contorno | 3 | Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si. |
| contour.c05 | Jardim de Sebes | 8 | 8 | Contorno, Medida | 4 | Laço ímpar: luz e sombra não conseguem alternar o anel inteiro — em algum ponto dois vizinhos precisam concordar. |
| contour.c06 | Jardim de Sebes | 12 | 19 | Contorno | 4 | A soma de todos os contornos é sempre par (cada fio cortado conta duas vezes) — a estrela sem número se descobre contando. |
| contour.c07 | Jardim de Sebes | 8 | 14 | Contorno | 4 | A soma de todos os contornos é sempre par (cada fio cortado conta duas vezes) — a estrela sem número se descobre contando. |
| contour.c08 | Jardim de Sebes | 11 | 11 | Contorno, Medida | 5 | Laço ímpar: luz e sombra não conseguem alternar o anel inteiro — em algum ponto dois vizinhos precisam concordar. |
| contour.c09 | Jardim de Sebes | 11 | 18 | Contorno | 5 | Amigo único: dos 8 fios do cubo, só um leva a alguém do mesmo estado — descubra qual. |
| contour.c10 | Jardim de Sebes | 11 | 17 | Medida, Contorno | 5 | Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si. |
| contour.c11 | Jardim de Sebes | 11 | 12 | Contorno, Medida, Fios (nó/corte) | 6 | Amigo único: dos 5 fios do cubo, só um leva a alguém do mesmo estado — descubra qual. |
| contour.c12 | Jardim de Sebes | 9 | 14 | Medida, Contorno, Fios (nó/corte) | 8 | Amigo único: dos 6 fios do cubo, só um leva a alguém do mesmo estado — descubra qual. |
| contour.c13 | Jardim de Sebes | 9 | 13 | Contorno, Medida | 8 | Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si. |
| mosaic.c01 | Templo das Areias | 5 | 4 | Mosaico, Estaca | 2 | Aquecimento: a linguagem do lugar, agora em rede. |
| mosaic.c02 | Templo das Areias | 7 | 6 | Mosaico | 2 | Uma folha só enxerga a si mesma e o pai: comece pelas pontas e caminhe para dentro. |
| mosaic.c03 | Templo das Areias | 6 | 8 | Mosaico | 2 | Janelas quase iguais: os dois centros enxergam as mesmas estrelas, menos as suas próprias — subtraia uma janela da outra. |
| mosaic.c04 | Templo das Areias | 7 | 10 | Mosaico | 2 | Janelas quase iguais: os dois centros enxergam as mesmas estrelas, menos as suas próprias — subtraia uma janela da outra. |
| mosaic.c05 | Templo das Areias | 8 | 7 | Mosaico | 2 | Uma folha só enxerga a si mesma e o pai: comece pelas pontas e caminhe para dentro. |
| mosaic.c06 | Templo das Areias | 7 | 12 | Mosaico | 3 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| mosaic.c07 | Templo das Areias | 12 | 11 | Contorno, Mosaico | 4 | Uma folha só enxerga a si mesma e o pai: comece pelas pontas e caminhe para dentro. |
| mosaic.c08 | Templo das Areias | 13 | 12 | Mosaico | 4 | Uma folha só enxerga a si mesma e o pai: comece pelas pontas e caminhe para dentro. |
| mosaic.c09 | Templo das Areias | 10 | 15 | Mosaico | 4 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| mosaic.c10 | Templo das Areias | 14 | 13 | Contorno, Mosaico | 5 | Uma folha só enxerga a si mesma e o pai: comece pelas pontas e caminhe para dentro. |
| mosaic.c11 | Templo das Areias | 9 | 14 | Contorno, Mosaico | 5 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| mosaic.c12 | Templo das Areias | 9 | 14 | Mosaico, Contorno | 6 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| mosaic.c13 | Templo das Areias | 13 | 19 | Mosaico, Contorno | 7 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| mosaic.c14 | Templo das Areias | 9 | 13 | Mosaico, Contorno | 7 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| mosaic.c15 | Templo das Areias | 9 | 14 | Mosaico, Contorno | 7 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| beacon.c01 | Penhascos dos Faróis | 4 | 3 | Mosaico, Contorno | 2 | Aquecimento: a linguagem do lugar, agora em rede. |
| beacon.c02 | Penhascos dos Faróis | 7 | 6 | Contorno, Mosaico | 2 | Uma folha só enxerga a si mesma e o pai: comece pelas pontas e caminhe para dentro. |
| beacon.c03 | Penhascos dos Faróis | 7 | 8 | Mosaico, Fios (nó/corte) | 2 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| beacon.c04 | Penhascos dos Faróis | 9 | 8 | Contorno, Mosaico | 2 | Uma folha só enxerga a si mesma e o pai: comece pelas pontas e caminhe para dentro. |
| beacon.c05 | Penhascos dos Faróis | 7 | 12 | Contorno, Mosaico, Estaca | 3 | Amigo único: dos 6 fios do cubo, só um leva a alguém do mesmo estado — descubra qual. |
| beacon.c06 | Penhascos dos Faróis | 9 | 10 | Mosaico, Contorno, Fios (nó/corte) | 3 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| beacon.c07 | Penhascos dos Faróis | 7 | 10 | Mosaico, Contorno | 4 | Janelas quase iguais: os dois centros enxergam as mesmas estrelas, menos as suas próprias — subtraia uma janela da outra. |
| beacon.c08 | Penhascos dos Faróis | 8 | 14 | Mosaico, Contorno | 4 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| beacon.c09 | Penhascos dos Faróis | 14 | 13 | Mosaico, Contorno | 4 | Uma folha só enxerga a si mesma e o pai: comece pelas pontas e caminhe para dentro. |
| beacon.c10 | Penhascos dos Faróis | 10 | 16 | Contorno, Mosaico | 5 | O dissidente: dos 7 vizinhos do cubo, só um é diferente — descubra qual. |
| beacon.c11 | Penhascos dos Faróis | 11 | 18 | Mosaico, Contorno | 6 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| beacon.c12 | Penhascos dos Faróis | 9 | 14 | Contorno, Mosaico | 6 | A janela do cubo é a vizinhança inteira: compare-a com a janela de uma vizinha — o que sobra está nas estrelas que só uma delas vê. |
| beacon.c13 | Penhascos dos Faróis | 9 | 13 | Contorno | 6 | Amigo único: dos 6 fios do cubo, só um leva a alguém do mesmo estado — descubra qual. |
| weave.c01 | Vale dos Moinhos | 4 | 3 | Fios (nó/corte) | 1 | Aquecimento: a linguagem do lugar, agora em rede. |
| weave.c02 | Vale dos Moinhos | 4 | 4 | Fios (nó/corte) | 1 | Aquecimento: a linguagem do lugar, agora em rede. |
| weave.c03 | Vale dos Moinhos | 6 | 7 | Medida, Fios (nó/corte) | 3 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| weave.c04 | Vale dos Moinhos | 9 | 9 | Medida, Fios (nó/corte) | 3 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 5 diz que ela termina ali; todo fio que sai dela é um corte. |
| weave.c05 | Vale dos Moinhos | 9 | 14 | Medida, Fios (nó/corte) | 4 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 5 diz que ela termina ali; todo fio que sai dela é um corte. |
| weave.c06 | Vale dos Moinhos | 10 | 11 | Medida, Fios (nó/corte) | 4 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| weave.c07 | Vale dos Moinhos | 8 | 9 | Medida, Fios (nó/corte) | 4 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| weave.c08 | Vale dos Moinhos | 10 | 11 | Medida, Fios (nó/corte) | 5 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| weave.c09 | Vale dos Moinhos | 11 | 12 | Medida, Fios (nó/corte) | 5 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| weave.c10 | Vale dos Moinhos | 11 | 13 | Medida, Contorno, Fios (nó/corte) | 5 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 5 diz que ela termina ali; todo fio que sai dela é um corte. |
| weave.c11 | Vale dos Moinhos | 11 | 12 | Medida, Fios (nó/corte) | 6 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| weave.c12 | Vale dos Moinhos | 13 | 16 | Medida, Fios (nó/corte) | 6 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 5 diz que ela termina ali; todo fio que sai dela é um corte. |
| weave.c13 | Vale dos Moinhos | 15 | 23 | Medida, Fios (nó/corte) | 7 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 3 diz que ela termina ali; todo fio que sai dela é um corte. |
| weave.c14 | Vale dos Moinhos | 11 | 13 | Medida, Fios (nó/corte) | 7 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| weave.c15 | Vale dos Moinhos | 11 | 11 | Contorno, Medida, Fios (nó/corte) | 9 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 4 diz que ela termina ali; todo fio que sai dela é um corte. |
| twins.c01 | Lago Espelhado | 4 | 3 | Eco, Acender tudo | 1 | Eco na árvore: cada folha só mexe nela e no pai — resolva de fora para dentro. |
| twins.c02 | Lago Espelhado | 4 | 4 | Eco, Acender tudo | 2 | Anel de eco: cada toque vira três estrelas; como o anel não é múltiplo de três, só existe um jeito de acender tudo. |
| twins.c03 | Lago Espelhado | 6 | 5 | Eco, Acender tudo | 2 | Eco na árvore: cada folha só mexe nela e no pai — resolva de fora para dentro. |
| twins.c04 | Lago Espelhado | 7 | 7 | Eco, Acender tudo | 2 | Anel de eco: cada toque vira três estrelas; como o anel não é múltiplo de três, só existe um jeito de acender tudo. |
| twins.c05 | Lago Espelhado | 8 | 8 | Eco, Acender tudo | 3 | Anel de eco: cada toque vira três estrelas; como o anel não é múltiplo de três, só existe um jeito de acender tudo. |
| twins.c06 | Lago Espelhado | 9 | 8 | Contorno, Mosaico, Eco | 3 | Duas etapas: primeiro descubra o desenho pelas regras; depois persiga-o com ecos, das folhas para dentro. |
| twins.c07 | Lago Espelhado | 6 | 6 | Mosaico, Contorno, Eco | 4 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| twins.c08 | Lago Espelhado | 7 | 7 | Mosaico, Contorno, Eco | 4 | Duas etapas: as regras decidem o desenho; o eco decide como chegar nele — cada toque mexe numa vizinhança inteira. |
| twins.c09 | Lago Espelhado | 9 | 9 | Mosaico, Medida, Eco | 5 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| twins.c10 | Lago Espelhado | 11 | 10 | Medida, Mosaico, Eco | 5 | Duas etapas: primeiro descubra o desenho pelas regras; depois persiga-o com ecos, das folhas para dentro. |
| twins.c11 | Lago Espelhado | 8 | 14 | Contorno, Mosaico, Eco | 6 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| twins.c12 | Lago Espelhado | 9 | 9 | Medida, Contorno, Eco | 6 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| twins.c13 | Lago Espelhado | 10 | 12 | Medida, Eco | 6 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| twins.c14 | Lago Espelhado | 10 | 13 | Mosaico, Contorno, Eco | 7 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| twins.c15 | Lago Espelhado | 8 | 12 | Mosaico, Medida, Eco | 8 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| citadel.c01 | Cidadela | 11 | 11 | Contorno, Afinidade | 3 | Laço ímpar: luz e sombra não conseguem alternar o anel inteiro — em algum ponto dois vizinhos precisam concordar. |
| citadel.c02 | Cidadela | 9 | 16 | Medida, Afinidade | 3 | O cubo encosta em todo mundo: gemas de cores diferentes ao redor dele não podem ter o estado dele — senão se juntariam pelo centro. |
| citadel.c03 | Cidadela | 10 | 11 | Afinidade, Fios (nó/corte) | 3 | Paridade do laço: todo laço tem um número par de cortes — conte os cortes ao redor e o elo sem marca se revela. |
| citadel.c04 | Cidadela | 13 | 15 | Medida, Fios (nó/corte) | 4 | O número não cabe de um lado só: a região de 9 tem de atravessar a ponte. |
| citadel.c05 | Cidadela | 10 | 18 | Afinidade | 5 | Famílias entrelaçadas: as gemas violeta e jade se cruzam no anel — uma família passa por dentro, pelo cubo, e a outra precisa dar a volta por fora, no estado oposto. |
| citadel.c06 | Cidadela | 8 | 11 | Mosaico, Contorno, Fios (nó/corte) | 5 | Janelas quase iguais: os dois centros enxergam as mesmas estrelas, menos as suas próprias — subtraia uma janela da outra. |
| citadel.c07 | Cidadela | 14 | 23 | Contorno, Mosaico | 6 | Em todo triângulo há 0 ou 2 fronteiras, nunca 1 ou 3: se a ponta tem uma só, as outras duas brigam entre si. |
| citadel.c08 | Cidadela | 8 | 8 | Afinidade, Medida | 6 | Laço ímpar de gemas: cores vizinhas diferentes precisam alternar luz e sombra, mas num anel ímpar a alternância não fecha — as duas gemas marfim lado a lado dividem o estado. |
| citadel.c09 | Cidadela | 11 | 12 | Afinidade | 8 | A gema solitária: a azuis é única e está no lugar mais movimentado — ela precisa de um mundo só dela, cercado pelo estado oposto. |
| citadel.c10 | Cidadela | 13 | 19 | Contorno, Medida, Fios (nó/corte) | 8 | Corrente de nós: as estrelas amarradas formam uma região só — e a medida 3 diz que ela termina ali; todo fio que sai dela é um corte. |
| citadel.c11 | Cidadela | 11 | 20 | Afinidade, Medida | 8 | Famílias entrelaçadas: as gemas carmim e marfim se cruzam no anel — uma família passa por dentro, pelo cubo, e a outra precisa dar a volta por fora, no estado oposto. |
| citadel.c12 | Cidadela | 11 | 11 | Afinidade, Medida | 10 | A ponte: as duas gemas marfim estão em lados opostos e só se encontram atravessando a estrela do meio — ela é da família. |
| echo.c01 | Caverna Ressonante | 9 | 8 | Eco, Acender tudo | 2 | Eco na árvore: cada folha só mexe nela e no pai — resolva de fora para dentro. |
| echo.c02 | Caverna Ressonante | 7 | 7 | Eco, Acender tudo | 2 | Anel de eco: cada toque vira três estrelas; como o anel não é múltiplo de três, só existe um jeito de acender tudo. |
| echo.c03 | Caverna Ressonante | 10 | 11 | Mosaico, Contorno, Eco | 4 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| echo.c04 | Caverna Ressonante | 6 | 6 | Mosaico, Contorno, Eco | 4 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| echo.c05 | Caverna Ressonante | 11 | 14 | Mosaico, Contorno, Medida, Eco | 6 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| echo.c06 | Caverna Ressonante | 11 | 11 | Mosaico, Medida, Eco | 6 | Duas etapas: as regras decidem o desenho; o eco decide como chegar nele — cada toque mexe numa vizinhança inteira. |
| echo.c07 | Caverna Ressonante | 10 | 12 | Mosaico, Medida, Eco | 7 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| echo.c08 | Caverna Ressonante | 13 | 17 | Medida, Mosaico, Afinidade, Eco | 7 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| echo.c09 | Caverna Ressonante | 11 | 11 | Medida, Contorno, Eco | 9 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |
| echo.c10 | Caverna Ressonante | 10 | 13 | Contorno, Medida, Fios (nó/corte), Eco | 10 | Duas respostas parecem certas, mas o eco só alcança uma: nem todo desenho de luz pode ser feito apertando estrelas aqui. |

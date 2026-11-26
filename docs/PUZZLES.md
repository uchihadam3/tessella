# Catálogo de puzzles

Gerado por `npm run verify:puzzles`. Cada linha: id, tamanho, linguagens, soluções, dificuldade (1–10) e a percepção ("ahá") que o painel ensina.

## Como os puzzles foram feitos

- **Introduções** (7 por área), o prólogo e a Caverna: feitos à mão, uma ideia nova por painel.
- **Prática / Provação / Maestria**: sequências de 4 painéis, cada sequência explorando UMA percepção, do simples ao difícil. Cada candidato é gerado, minimizado e só é aceito se um *solucionador humano simulado* (`insightPath` em `src/puzzle/solver.ts`) consegue resolvê-lo sem chute: deduções básicas até travar, então UMA percepção nomeada (ex.: "a região só tem uma saída", "duas janelas vizinhas", "só um farol alcança aquela luz", "o gargalo entre as gemas"), e de novo deduções básicas. A nota de cada painel diz quais percepções o caminho realmente usa.
- **Coração**: as obras-primas da área — os candidatos com mais percepções distintas e as maiores cascatas.
- **Cidadela / Torre**: combinações; cada painel é escolhido pela interação entre linguagens no caminho de solução.
- **Afinidade e Gêmeos** aceitam várias soluções (qualquer uma vale), mas o núcleo é forçado: a cor de cada família / o encaixe de cada cópia.
- `soluções`: `1` = única; `1~` = única a menos de trocar luz e sombra (regras cegas à cor); `2`/`3+` = várias.

## Calibração da dificuldade

- A dificuldade (1–10) é **medida**: é o número de percepções que o caminho de `insightPath` usa (`tools/relabel.ts`): 0 = só ler a regra (1, ou 2 quando a leitura sozinha não fecha o painel), 1 → 3, 2 → 4, 3 → 5, 4–5 → 6, 6–7 → 7, 8–10 → 8, 11–14 → 9, 15+ → 10, limitada pela faixa do lugar (introdução 1–4, prática 2–6, provação 3–8, maestria 5–9, coração 6–10; Cidadela, Eco e Torre têm faixas próprias; o Cofre é 10).
- Toda introdução e todo painel que abre uma sequência de prática usam no máximo 2 percepções (provação: 3; maestria: 6); nenhum painel de rótulo 7+ se resolve com 1 percepção só (`tools/calibrate.ts`).
- As sequências e os grupos finais estão em ordem de esforço medido; o último painel da Torre e o Cofre são os picos.
- Limite do modelo: o Eco (toques que se somam, como "lights out") é tratado como dedução básica, então placas de eco puras medem 0 percepções.

## O Despertar (8)

### cave

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| prologue.cave.1 | 1×1 | Placa | 1 | 1 | Primeira luz: clicar no ladrilho acende; o selo confirma. |
| prologue.cave.2 | 3×1 | Placa | 1 | 1 | Só o que a placa mostra: acender demais também é errar. |
| prologue.cave.3 | 3×2 | Placa | 1 | 1 | Rebites não mudam — e fazem parte do desenho. |
| prologue.cave.4 | 3×3 | Placa | 1 | 1 | Buracos não têm ladrilho: o desenho contorna o vazio. |
| prologue.cave.5 | 3×3 | Placa | 1 | 1 | Não há placa: a luz que entra pela janela desenha a resposta no chão. |

### shore

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| prologue.shore.1 | 4×4 | Placa | 1 | 1 | O círculo de pedras de pé na praia é o desenho. |

### gate

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| prologue.gate.1 | 3×3 | Placa | 1 | 1 | A placa mostra só as bordas: a luz preenche o que a linha cerca. |
| prologue.gate.2 | 4×4 | Placa | 1 | 1 | Bordas por dentro e por fora: um anel, não um bloco. |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## O Pátio das Nove Luzes (1)

### vault

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| hub.vault | 9×9 | Medida + Afinidade + Gêmeos + Contorno + Mosaico + Forma + Farol + Trama | 1 | 10 | O Cofre Escondido — as oito linguagens dos ladrilhos (Farol, Forma, Mosaico, Medida, Afinidade, Gêmeos, Contorno e Trama) num só painel 9×9, solução única, resolvível sem nenhum chute — e quem só lê as regras decide apenas um quarto dele. A resposta desenha um portal simétrico: duas torres finas, a chama ao centro e as muralhas descendo até o chão. Percepções, em ordem: (1) só um farol alcança a primeira luz; (2) a barra de quatro, que gira, não cabe na luz — esculpida na sombra, ela destrava treze ladrilhos de uma vez; (3) o quatro do canto só tem uma saída; (4) outro farol solitário, e então dois gargalos entre as gemas; (5) as luas gêmeas: a cópia só cabe de um jeito, do outro lado; (6) um último farol solitário e mais dois gargalos fecham o portal. Onze percepções de cinco tipos. |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## O Bosque Outonal — Afinidade (58)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| kinship.intro.1 | 2×1 | Afinidade | 1~ | 1 | Cores diferentes não podem dividir a mesma região: separar. |
| kinship.intro.2 | 3×1 | Afinidade | 1~ | 1 | Duas âmbar juntas e uma azul: a azul fica do outro lado (luz e sombra). |
| kinship.intro.3 | 3×1 | Afinidade | 1~ | 1 | A azul tem companhia; a âmbar fica do outro lado. |
| kinship.intro.4 | 4×1 | Afinidade | 1~ | 1 | O meio une as âmbar; a azul fica de fora. |
| kinship.intro.5 | 4×1 | Afinidade | 1~ | 1 | Do outro lado: o meio une as âmbar. |
| kinship.intro.6 | 3×1 | Afinidade | 1 | 3 | Cores iguais precisam estar juntas: unir pela luz. |
| kinship.intro.7 | 3×1 | Afinidade | 1 | 1 | O rebite acende a âmbar: a família inteira vem para a luz, pelo meio. |
| kinship.intro.8 | 4×1 | Afinidade | 1 | 1 | O rebite escuro une as âmbar na sombra; a azul vai para a luz. |
| kinship.intro.9 | 4×1 | Afinidade | 1 | 1 | A azul presa na sombra: as âmbar vão juntas para a luz. |
| kinship.intro.10 | 2×2 | Afinidade | 1~ | 1 | Cada fileira é uma família: uma na luz, outra na sombra. |
| kinship.intro.11 | 2×2 | Afinidade | 1~ | 1 | Cada coluna é uma família. |
| kinship.intro.12 | 2×2 | Afinidade | 1~ | 1 | As âmbar se unem dando a volta pelo canto livre. |
| kinship.intro.13 | 3×2 | Afinidade | 1 | 1 | A azul está no caminho: as âmbar se unem pela fileira acesa de baixo. |
| kinship.intro.14 | 3×2 | Afinidade | 1~ | 4 | Uma família na luz, a outra na sombra. |
| kinship.intro.15 | 3×2 | Afinidade | 1 | 1 | O buraco não deixa passar: as âmbar se unem por baixo. |
| kinship.intro.16 | 3×1 | Afinidade | 1~ | 1 | Três cores: as pontas acesas são regiões diferentes, porque não se tocam. |
| kinship.intro.17 | 5×1 | Afinidade | 1 | 1 | A âmbar se une pela luz; entre ela e a azul abre-se um fosso de sombra. |
| kinship.intro.18 | 3×3 | Afinidade | 1 | 4 | Duas famílias acesas não podem se tocar: entre elas abre-se um fosso de sombra — e é ali que mora a terceira. |
| kinship.intro.19 | 3×3 | Afinidade | 1 | 4 | Uma corrente: o rebite acende a âmbar; a carmim encosta nela e vira sombra; a azul encosta na carmim e só pode ser luz — e o meio vira fosso. |
| kinship.intro.20 | 4×4 | Afinidade | 3+ | 3 | Portão: o rebite apaga a azul, e suas gemas só se unem pela base; a âmbar, encostada nela, vira luz — e a carmim, encostada na âmbar, sombra. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| kinship.practice.1 | 5×5 | Afinidade | 3+~ | 4 | seq A1/4 — quem é luz e quem é sombra. Três famílias e uma rocha. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.2 | 5×5 | Afinidade | 3+~ | 4 | seq A2/4 — quem é luz e quem é sombra. Três famílias e uma rocha. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.3 | 5×5 | Afinidade | 3+~ | 5 | seq A3/4 — quem é luz e quem é sombra. Três famílias e uma rocha. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.4 | 5×5 | Afinidade | 3+~ | 6 | seq A4/4 — quem é luz e quem é sombra. Três famílias e duas rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas; (um "e se?" no caminho). |
| kinship.practice.5 | 5×5 | Afinidade | 3+~ | 3 | seq B1/4 — o gargalo entre as gemas. Três famílias. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.6 | 5×5 | Afinidade | 3+~ | 3 | seq B2/4 — o gargalo entre as gemas. Três famílias. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.7 | 5×5 | Afinidade | 3+~ | 6 | seq B3/4 — o gargalo entre as gemas. Três famílias e quatro rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.8 | 5×5 | Afinidade | 3+~ | 6 | seq B4/4 — o gargalo entre as gemas. Quatro famílias e uma rocha. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.9 | 5×5 | Afinidade | 3+~ | 3 | seq C1/4 — duas famílias na mesma luz precisam de um fosso. Três famílias. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.10 | 5×5 | Afinidade | 3+~ | 3 | seq C2/4 — duas famílias na mesma luz precisam de um fosso. Três famílias e três rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.11 | 5×5 | Afinidade | 3+~ | 4 | seq C3/4 — duas famílias na mesma luz precisam de um fosso. Três famílias e cinco rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.12 | 5×5 | Afinidade | 3+~ | 6 | seq C4/4 — duas famílias na mesma luz precisam de um fosso. Quatro famílias e duas rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| kinship.trial.1 | 5×5 | Afinidade | 3+ | 4 | seq D1/4 — decidir a cor de cinco famílias. Quatro famílias e uma rocha. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; (um "e se?" no caminho). |
| kinship.trial.2 | 6×6 | Afinidade | 3+~ | 6 | seq D2/4 — decidir a cor de cinco famílias. Quatro famílias e três rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.3 | 6×6 | Afinidade | 3+ | 7 | seq D3/4 — decidir a cor de cinco famílias. Quatro famílias e cinco rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.4 | 6×6 | Afinidade | 3+ | 8 | seq D4/4 — decidir a cor de cinco famílias. Quatro famílias. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.5 | 6×6 | Afinidade | 3+ | 4 | seq E1/4 — gargalos em cadeia. Quatro famílias e duas rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.6 | 6×6 | Afinidade | 3+~ | 5 | seq E2/4 — gargalos em cadeia. Cinco famílias e quatro rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.7 | 6×6 | Afinidade | 3+~ | 7 | seq E3/4 — gargalos em cadeia. Cinco famílias e duas rochas. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |
| kinship.trial.8 | 6×6 | Afinidade | 3+~ | 7 | seq E4/4 — gargalos em cadeia. Quatro famílias e duas rochas. Ahá: um gargalo: o único caminho que liga as gemas; (5 "e se?" no caminho). |
| kinship.trial.9 | 6×6 | Afinidade | 3+ | 3 | seq F1/4 — o rebite decide a família. Cinco famílias e quatro rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.10 | 6×6 | Afinidade | 3+ | 4 | seq F2/4 — o rebite decide a família. Quatro famílias e cinco rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.11 | 6×6 | Afinidade | 3+ | 6 | seq F3/4 — o rebite decide a família. Quatro famílias e duas rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.12 | 6×6 | Afinidade | 3+ | 8 | seq F4/4 — o rebite decide a família. Quatro famílias e quatro rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |

### mastery

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| kinship.mastery.1 | 7×6 | Afinidade | 3+ | 5 | seq G1/4 — cor e caminho ao mesmo tempo. Cinco famílias e três rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.mastery.2 | 7×6 | Afinidade | 3+ | 5 | seq G2/4 — cor e caminho ao mesmo tempo. Cinco famílias e três rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.mastery.3 | 7×6 | Afinidade | 3+~ | 7 | seq G3/4 — cor e caminho ao mesmo tempo. Cinco famílias e quatro rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas; (4 "e se?" no caminho). |
| kinship.mastery.4 | 7×6 | Afinidade | 3+~ | 9 | seq G4/4 — cor e caminho ao mesmo tempo. Seis famílias e uma rocha. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas; (um "e se?" no caminho). |
| kinship.mastery.5 | 7×7 | Afinidade | 3+ | 7 | seq H1/4 — seis famílias num bosque apertado. Seis famílias e três rochas. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; (2 "e se?" no caminho). |
| kinship.mastery.6 | 7×7 | Afinidade | 3+~ | 7 | seq H2/4 — seis famílias num bosque apertado. Seis famílias e quatro rochas. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |
| kinship.mastery.7 | 7×7 | Afinidade | 3+~ | 8 | seq H3/4 — seis famílias num bosque apertado. Seis famílias e quatro rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.mastery.8 | 7×7 | Afinidade | 3+~ | 9 | seq H4/4 — seis famílias num bosque apertado. Seis famílias e seis rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| kinship.heart.1 | 7×7 | Afinidade | 3+ | 6 | Obra-prima 1/6. Cinco famílias e cinco rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.heart.2 | 7×7 | Afinidade | 3+~ | 6 | Obra-prima 2/6. Cinco famílias e três rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas; (3 "e se?" no caminho). |
| kinship.heart.3 | 7×7 | Afinidade | 3+ | 6 | Obra-prima 3/6. Cinco famílias e duas rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.heart.4 | 7×7 | Afinidade | 3+ | 7 | Obra-prima 4/6. Cinco famílias e três rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.heart.5 | 7×7 | Afinidade | 3+ | 7 | Obra-prima 5/6. Cinco famílias e quatro rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.heart.6 | 7×7 | Afinidade | 3+~ | 8 | Obra-prima 6/6. Cinco famílias e uma rocha. Ahá: um gargalo: o único caminho que liga as gemas; (um "e se?" no caminho). |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## Os Terraços — Medida (58)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| measure.intro.1 | 2×1 | Medida | 1~ | 1 | O número conta os ladrilhos da sua região: 1 é estar sozinho. |
| measure.intro.2 | 3×1 | Medida | 1~ | 3 | Uma região de dois — e o terceiro do outro lado. |
| measure.intro.3 | 3×1 | Medida | 1~ | 1 | Um sozinho, e um par ao lado. |
| measure.intro.4 | 4×1 | Medida | 1~ | 1 | Três juntos; o quarto do outro lado. |
| measure.intro.5 | 3×1 | Medida | 1~ | 1 | Dois sozinhos: o meio fica do outro lado para separá-los. |
| measure.intro.6 | 4×1 | Medida | 1~ | 1 | Duas regiões de dois, lado a lado: uma na luz, outra na sombra. |
| measure.intro.7 | 4×1 | Medida | 1 | 1 | Três acesos juntos; o quarto, apagado, fecha a conta. |
| measure.intro.8 | 3×1 | Medida | 1 | 1 | O rebite escuro mede a sombra: dois apagados, o terceiro aceso. |
| measure.intro.9 | 4×1 | Medida | 1 | 1 | O 1 se isola com a sombra; o 2 forma um par aceso do outro lado. |
| measure.intro.10 | 2×2 | Medida | 1~ | 1 | No quadrado: três em L, e o canto sozinho. |
| measure.intro.11 | 2×2 | Medida | 1~ | 1 | Na diagonal os ladrilhos não se tocam. |
| measure.intro.12 | 3×2 | Medida | 1 | 1 | Dois pares em pé, separados pelo meio apagado. |
| measure.intro.13 | 3×2 | Medida | 1~ | 1 | Cinco juntos; o canto sozinho. |
| measure.intro.14 | 3×2 | Medida | 1 | 1 | O buraco separa como a sombra: dois pares em pé. |
| measure.intro.15 | 3×2 | Medida | 1~ | 1 | Três dobram o canto; o um fica do outro lado do buraco. |
| measure.intro.16 | 3×2 | Medida | 3+~ | 2 | Duas regiões de três dividem o painel. |
| measure.intro.17 | 3×3 | Medida | 1~ | 4 | O centro sozinho... e o anel ao redor também é uma região: a escuridão conta. |
| measure.intro.18 | 3×2 | Medida | 2 | 2 | O número pode morar num ladrilho apagado: ele mede a sombra. |
| measure.intro.19 | 3×3 | Medida | 1~ | 3 | Números iguais podem dividir a região; o 7 ao lado mede todo o resto, do outro lado da luz. |
| measure.intro.20 | 4×4 | Medida | 1~ | 4 | Portão: o fundo mede doze; a pedra de um e a ilha de três se recortam nele — e o que sobra é exatamente o pedido. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| measure.practice.1 | 4×4 | Medida | 1~ | 4 | seq A1/4 — a região incompleta só tem uma saída. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali. |
| measure.practice.2 | 5×5 | Medida | 1~ | 6 | seq A2/4 — a região incompleta só tem uma saída. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (2 "e se?" no caminho). |
| measure.practice.3 | 5×5 | Medida | 1~ | 6 | seq A3/4 — a região incompleta só tem uma saída. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (um "e se?" no caminho). |
| measure.practice.4 | 5×5 | Medida | 1~ | 6 | seq A4/4 — a região incompleta só tem uma saída. O 7 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (2 "e se?" no caminho). |
| measure.practice.5 | 4×4 | Medida | 1~ | 4 | seq B1/4 — a escuridão também é uma região — e o número a mede. O 8 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz. |
| measure.practice.6 | 5×5 | Medida | 1~ | 5 | seq B2/4 — a escuridão também é uma região — e o número a mede. O 10 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (um "e se?" no caminho). |
| measure.practice.7 | 5×5 | Medida | 1~ | 6 | seq B3/4 — a escuridão também é uma região — e o número a mede. O 11 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (um "e se?" no caminho). |
| measure.practice.8 | 5×5 | Medida | 1~ | 6 | seq B4/4 — a escuridão também é uma região — e o número a mede. O 7 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro. |
| measure.practice.9 | 4×4 | Medida | 1~ | 4 | seq C1/4 — o espaço que sobra é exatamente o pedido. O 9 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz. |
| measure.practice.10 | 5×5 | Medida | 1~ | 5 | seq C2/4 — o espaço que sobra é exatamente o pedido. O 7 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (um "e se?" no caminho). |
| measure.practice.11 | 5×5 | Medida | 1~ | 6 | seq C3/4 — o espaço que sobra é exatamente o pedido. O 9 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (2 "e se?" no caminho). |
| measure.practice.12 | 5×5 | Medida | 1~ | 6 | seq C4/4 — o espaço que sobra é exatamente o pedido. O 10 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (2 "e se?" no caminho). |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| measure.trial.1 | 4×4 | Medida | 1~ | 5 | seq D1/4 — um número que não cabe na luz mora na sombra. Há números morando na sombra. Ahá: um número que não cabe de um lado da luz só pode estar do outro; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; e por fim: uma região que ainda precisa crescer tem uma só saída — ela passa por ali. |
| measure.trial.2 | 6×6 | Medida | 1~ | 8 | seq D2/4 — um número que não cabe na luz mora na sombra. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; (4 "e se?" no caminho). |
| measure.trial.3 | 6×6 | Medida | 1~ | 8 | seq D3/4 — um número que não cabe na luz mora na sombra. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; (4 "e se?" no caminho). |
| measure.trial.4 | 6×6 | Medida | 1~ | 8 | seq D4/4 — um número que não cabe na luz mora na sombra. Há números morando na sombra. Ahá: um número que não cabe de um lado da luz só pode estar do outro; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (4 "e se?" no caminho). |
| measure.trial.5 | 5×5 | Medida | 1~ | 5 | seq E1/4 — o fundo escuro inteiro em um só número. O 11 mora na sombra: ele mede a escuridão. Ahá: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; depois: um número que não cabe de um lado da luz só pode estar do outro; (um "e se?" no caminho). |
| measure.trial.6 | 6×6 | Medida | 1~ | 7 | seq E2/4 — o fundo escuro inteiro em um só número. O 14 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; (4 "e se?" no caminho). |
| measure.trial.7 | 6×6 | Medida | 1~ | 8 | seq E3/4 — o fundo escuro inteiro em um só número. O 10 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (um "e se?" no caminho). |
| measure.trial.8 | 6×6 | Medida | 1~ | 8 | seq E4/4 — o fundo escuro inteiro em um só número. O 12 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (2 "e se?" no caminho). |
| measure.trial.9 | 5×5 | Medida | 1~ | 5 | seq F1/4 — "e se?": imagine a região maior. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (2 "e se?" no caminho). |
| measure.trial.10 | 6×6 | Medida | 1~ | 7 | seq F2/4 — "e se?": imagine a região maior. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (3 "e se?" no caminho). |
| measure.trial.11 | 6×6 | Medida | 1~ | 8 | seq F3/4 — "e se?": imagine a região maior. O 7 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; (4 "e se?" no caminho). |
| measure.trial.12 | 6×6 | Medida | 1~ | 8 | seq F4/4 — "e se?": imagine a região maior. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (4 "e se?" no caminho). |

### mastery

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| measure.mastery.1 | 6×6 | Medida | 1~ | 7 | seq G1/4 — saídas e espaços exatos encadeados. O 11 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (2 "e se?" no caminho). |
| measure.mastery.2 | 7×7 | Medida | 1~ | 9 | seq G2/4 — saídas e espaços exatos encadeados. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (5 "e se?" no caminho). |
| measure.mastery.3 | 7×7 | Medida | 1~ | 9 | seq G3/4 — saídas e espaços exatos encadeados. O 13 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (7 "e se?" no caminho). |
| measure.mastery.4 | 7×7 | Medida | 1~ | 9 | seq G4/4 — saídas e espaços exatos encadeados. O 14 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (7 "e se?" no caminho). |
| measure.mastery.5 | 6×6 | Medida | 1~ | 6 | seq H1/4 — tudo junto: luz, sombra e números que não cabem. Há números morando na sombra. Ahá: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (3 "e se?" no caminho). |
| measure.mastery.6 | 7×7 | Medida | 1~ | 8 | seq H2/4 — tudo junto: luz, sombra e números que não cabem. O 15 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (4 "e se?" no caminho). |
| measure.mastery.7 | 7×7 | Medida | 1~ | 9 | seq H3/4 — tudo junto: luz, sombra e números que não cabem. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (5 "e se?" no caminho). |
| measure.mastery.8 | 7×7 | Medida | 1~ | 9 | seq H4/4 — tudo junto: luz, sombra e números que não cabem. O 8 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (7 "e se?" no caminho). |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| measure.heart.1 | 7×7 | Medida | 1~ | 10 | Obra-prima 1/6. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (7 "e se?" no caminho). |
| measure.heart.2 | 7×7 | Medida | 1~ | 10 | Obra-prima 2/6. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; e por fim: um número que não cabe de um lado da luz só pode estar do outro; (3 "e se?" no caminho). |
| measure.heart.3 | 7×7 | Medida | 1~ | 10 | Obra-prima 3/6. O 12 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (8 "e se?" no caminho). |
| measure.heart.4 | 7×7 | Medida | 1~ | 10 | Obra-prima 4/6. O 12 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (8 "e se?" no caminho). |
| measure.heart.5 | 7×7 | Medida | 1~ | 10 | Obra-prima 5/6. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (7 "e se?" no caminho). |
| measure.heart.6 | 7×7 | Medida | 1~ | 10 | Obra-prima 6/6. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (7 "e se?" no caminho). |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## A Pedreira — Forma (58)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mold.intro.1 | 2×1 | Forma | 1~ | 1 | A forma é um quadradinho só: o vizinho fica do outro lado. |
| mold.intro.2 | 3×1 | Forma | 1~ | 3 | A região do molde tem a forma desenhada: um dominó. |
| mold.intro.3 | 4×1 | Forma | 1~ | 1 | Dois moldes iguais: dois dominós, um na luz, outro na sombra. |
| mold.intro.4 | 4×1 | Forma | 1~ | 1 | Uma barra de três: o quarto ladrilho não faz parte dela. |
| mold.intro.5 | 2×2 | Forma | 1~ | 1 | Em pé: o dominó desenhado na vertical. |
| mold.intro.6 | 3×2 | Forma | 1~ | 1 | O dominó em pé no meio; os lados do outro lado. |
| mold.intro.7 | 2×2 | Forma | 1~ | 3 | Um L de três. |
| mold.intro.8 | 2×2 | Forma | 1~ | 1 | O mesmo L, virado de outro jeito: a forma desenhada manda. |
| mold.intro.9 | 3×2 | Forma | 1~ | 3 | A orientação importa: o T de cabeça para baixo não serve. |
| mold.intro.10 | 2×2 | Forma | 1~ | 1 | Dois quadradinhos sozinhos, em cantos opostos. |
| mold.intro.11 | 3×2 | Forma | 1~ | 1 | Um quadrado de quatro; a coluna que sobra fica do outro lado. |
| mold.intro.12 | 4×1 | Forma | 1 | 1 | Entre rebites acesos, o molde de um fica na sombra — e o vizinho acende para deixá-lo sozinho. |
| mold.intro.13 | 3×3 | Forma | 1 | 4 | Os rebites acesos não deixam o quadrado ser luz: o molde se esculpe na sombra. |
| mold.intro.14 | 3×2 | Forma | 1 | 1 | O buraco separa: cada dominó em pé do seu lado. |
| mold.intro.15 | 3×2 | Forma | 1~ | 1 | O gancho dobra junto ao buraco. |
| mold.intro.16 | 3×2 | Forma | 1~ | 1 | Duas formas diferentes dividem o painel. |
| mold.intro.17 | 3×3 | Forma | 1~ | 3 | Duas peças que se encaixam: uma na luz, outra na sombra. |
| mold.intro.18 | 2×2 | Forma | 1 | 1 | O anel em volta deixa girar: o dominó deitado cabe em pé. |
| mold.intro.19 | 3×3 | Forma | 2~ | 3 | O anel em volta do molde deixa girar: a forma desenhada não cabe, a girada sim. |
| mold.intro.20 | 4×4 | Forma | 1~ | 4 | Portão: a barra só deita no topo; o T, preso na beira, só cabe de um jeito — e a pedra sozinha fica cercada por ele. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mold.practice.1 | 4×4 | Forma | 1~ | 4 | seq A1/4 — só existe um encaixe. Três moldes esculpidos na sombra. Ahá: o molde incompleto só tem uma saída; depois: só existe um encaixe para o molde. |
| mold.practice.2 | 5×5 | Forma | 1~ | 6 | seq A2/4 — só existe um encaixe. Quatro moldes esculpidos na sombra. Ahá: o molde incompleto só tem uma saída; depois: só existe um encaixe para o molde; (um "e se?" no caminho). |
| mold.practice.3 | 5×5 | Forma | 1~ | 6 | seq A3/4 — só existe um encaixe. Dois moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde. |
| mold.practice.4 | 5×5 | Forma | 1~ | 6 | seq A4/4 — só existe um encaixe. Dois moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); (um "e se?" no caminho). |
| mold.practice.5 | 5×5 | Forma | 1~ | 4 | seq B1/4 — a forma esculpida na sombra. Três moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: o molde incompleto só tem uma saída. |
| mold.practice.6 | 5×5 | Forma | 1~ | 6 | seq B2/4 — a forma esculpida na sombra. Seis moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída. |
| mold.practice.7 | 5×5 | Forma | 1~ | 6 | seq B3/4 — a forma esculpida na sombra. Quatro moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: o molde incompleto só tem uma saída; (2 "e se?" no caminho). |
| mold.practice.8 | 5×5 | Forma | 1~ | 6 | seq B4/4 — a forma esculpida na sombra. Cinco moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: o molde incompleto só tem uma saída; e por fim: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário). |
| mold.practice.9 | 4×4 | Forma | 1~ | 4 | seq C1/4 — a peça incompleta só tem uma saída. Quatro moldes esculpidos na sombra. Ahá: o molde incompleto só tem uma saída; depois: só existe um encaixe para o molde. |
| mold.practice.10 | 5×5 | Forma | 1~ | 6 | seq C2/4 — a peça incompleta só tem uma saída. Cinco moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: o molde incompleto só tem uma saída; e por fim: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário). |
| mold.practice.11 | 5×5 | Forma | 1~ | 6 | seq C3/4 — a peça incompleta só tem uma saída. Seis moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: o molde incompleto só tem uma saída; e por fim: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário). |
| mold.practice.12 | 5×5 | Forma | 1~ | 6 | seq C4/4 — a peça incompleta só tem uma saída. Três moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída; (um "e se?" no caminho). |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mold.trial.1 | 6×5 | Forma | 1~ | 5 | seq D1/4 — o anel deixa girar — mas só um giro cabe. Um molde que gira. Ahá: o molde incompleto só tem uma saída; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde. |
| mold.trial.2 | 6×5 | Forma | 1~ | 6 | seq D2/4 — o anel deixa girar — mas só um giro cabe. Um molde que gira e quatro moldes esculpidos na sombra. Ahá: o molde incompleto só tem uma saída; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde. |
| mold.trial.3 | 6×5 | Forma | 1~ | 8 | seq D3/4 — o anel deixa girar — mas só um giro cabe. Três moldes que giram e quatro moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: o molde incompleto só tem uma saída; e por fim: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); (2 "e se?" no caminho). |
| mold.trial.4 | 6×5 | Forma | 1~ | 8 | seq D4/4 — o anel deixa girar — mas só um giro cabe. Um molde que gira e cinco moldes esculpidos na sombra. Ahá: o molde incompleto só tem uma saída; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde. |
| mold.trial.5 | 6×5 | Forma | 1~ | 5 | seq E1/4 — na luz o molde não cabe. Seis moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário). |
| mold.trial.6 | 6×5 | Forma | 1~ | 6 | seq E2/4 — na luz o molde não cabe. Três moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída. |
| mold.trial.7 | 6×5 | Forma | 1~ | 7 | seq E3/4 — na luz o molde não cabe. Um molde que gira e um molde esculpido na sombra. Ahá: só existe um encaixe para o molde; depois: o molde incompleto só tem uma saída; e por fim: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); (um "e se?" no caminho). |
| mold.trial.8 | 6×5 | Forma | 1~ | 8 | seq E4/4 — na luz o molde não cabe. Dois moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída. |
| mold.trial.9 | 5×5 | Forma | 1~ | 5 | seq F1/4 — um encaixe decide o outro. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário). |
| mold.trial.10 | 6×6 | Forma | 1~ | 6 | seq F2/4 — um encaixe decide o outro. Um molde que gira e sete moldes esculpidos na sombra. Ahá: o molde incompleto só tem uma saída; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde; (um "e se?" no caminho). |
| mold.trial.11 | 6×6 | Forma | 1~ | 8 | seq F3/4 — um encaixe decide o outro. Três moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); (2 "e se?" no caminho). |
| mold.trial.12 | 6×6 | Forma | 1~ | 8 | seq F4/4 — um encaixe decide o outro. Um molde que gira e um molde esculpido na sombra. Ahá: só existe um encaixe para o molde; depois: o molde incompleto só tem uma saída; (3 "e se?" no caminho). |

### mastery

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mold.mastery.1 | 6×6 | Forma | 1~ | 6 | seq G1/4 — pentominós que giram, na luz e na sombra. Três moldes que giram e seis moldes esculpidos na sombra. Ahá: o molde incompleto só tem uma saída; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde. |
| mold.mastery.2 | 6×6 | Forma | 1~ | 7 | seq G2/4 — pentominós que giram, na luz e na sombra. Um molde que gira e oito moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída; (um "e se?" no caminho). |
| mold.mastery.3 | 6×6 | Forma | 1~ | 8 | seq G3/4 — pentominós que giram, na luz e na sombra. Um molde que gira e seis moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída; (3 "e se?" no caminho). |
| mold.mastery.4 | 6×6 | Forma | 1~ | 8 | seq G4/4 — pentominós que giram, na luz e na sombra. Um molde que gira e três moldes esculpidos na sombra. Ahá: o molde incompleto só tem uma saída; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde; (um "e se?" no caminho). |
| mold.mastery.5 | 7×6 | Forma | 1~ | 6 | seq H1/4 — a pedreira inteira: encaixe por exclusão. Um molde que gira e nove moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: o molde incompleto só tem uma saída. |
| mold.mastery.6 | 7×6 | Forma | 1~ | 6 | seq H2/4 — a pedreira inteira: encaixe por exclusão. Cinco moldes esculpidos na sombra. Ahá: o molde incompleto só tem uma saída; depois: só existe um encaixe para o molde; e por fim: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário). |
| mold.mastery.7 | 7×6 | Forma | 1~ | 8 | seq H3/4 — a pedreira inteira: encaixe por exclusão. Um molde que gira e um molde esculpido na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída; (2 "e se?" no caminho). |
| mold.mastery.8 | 7×6 | Forma | 1~ | 9 | seq H4/4 — a pedreira inteira: encaixe por exclusão. Dois moldes que giram e um molde esculpido na sombra. Ahá: só existe um encaixe para o molde; depois: o molde incompleto só tem uma saída; (6 "e se?" no caminho). |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mold.heart.1 | 7×7 | Forma | 1~ | 8 | Obra-prima 1/6. Oito moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída; (2 "e se?" no caminho). |
| mold.heart.2 | 7×7 | Forma | 1~ | 8 | Obra-prima 2/6. Um molde que gira e quatro moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída; (2 "e se?" no caminho). |
| mold.heart.3 | 7×7 | Forma | 1~ | 9 | Obra-prima 3/6. Um molde que gira. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída; (2 "e se?" no caminho). |
| mold.heart.4 | 7×7 | Forma | 1~ | 9 | Obra-prima 4/6. Um molde que gira e cinco moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída; (2 "e se?" no caminho). |
| mold.heart.5 | 7×7 | Forma | 1~ | 10 | Obra-prima 5/6. Três moldes que giram e seis moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: o molde incompleto só tem uma saída; e por fim: só existe um encaixe para o molde; (2 "e se?" no caminho). |
| mold.heart.6 | 7×7 | Forma | 1~ | 10 | Obra-prima 6/6. Quatro moldes que giram e sete moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: o molde incompleto só tem uma saída; e por fim: só existe um encaixe para o molde; (3 "e se?" no caminho). |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## O Jardim de Sebes — Contorno (58)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| contour.intro.1 | 1×1 | Contorno | 1 | 1 | Quatro lados brilhando: acender o ladrilho sozinho. |
| contour.intro.2 | 2×1 | Contorno | 1 | 1 | Para manter os quatro lados, o vizinho precisa ficar escuro. |
| contour.intro.3 | 2×1 | Contorno | 1 | 1 | Três lados: acesos os dois — o lado entre eles não é borda. |
| contour.intro.4 | 2×1 | Contorno | 1 | 1 | Três lados: os dois acesos, do outro lado também. |
| contour.intro.5 | 2×1 | Contorno | 1 | 1 | Um lado só: o ladrilho apagado, com um vizinho aceso. |
| contour.intro.6 | 3×1 | Contorno | 1 | 1 | Duas ilhas acesas, separadas por um escuro. |
| contour.intro.7 | 3×1 | Contorno | 1 | 1 | As pontas com três lados: tudo aceso. |
| contour.intro.8 | 3×1 | Contorno | 1 | 1 | No meio de três acesos, só sobram dois lados de borda. |
| contour.intro.9 | 3×1 | Contorno | 2 | 2 | Conta-se a borda de luz, não a luz: o próprio ladrilho pode estar apagado. |
| contour.intro.10 | 3×1 | Contorno | 1 | 1 | Aceso, com o rebite aceso de um lado e o escuro do outro. |
| contour.intro.11 | 3×1 | Contorno | 1 | 1 | Entre o rebite escuro e o vizinho apagado: uma ilha de luz. |
| contour.intro.12 | 3×1 | Contorno | 1 | 1 | O buraco conta como escuro: duas ilhas. |
| contour.intro.13 | 2×2 | Contorno | 1 | 1 | Duas ilhas em cantos opostos. |
| contour.intro.14 | 2×2 | Contorno | 1 | 1 | Os de cima acesos; os de baixo apagados. |
| contour.intro.15 | 2×2 | Contorno | 1 | 1 | A coluna da esquerda pede luz no painel todo. |
| contour.intro.16 | 2×2 | Contorno | 1 | 1 | Cada canto com dois lados para fora: todos acesos. |
| contour.intro.17 | 3×3 | Contorno | 1 | 1 | Zero bordas: igual a todos os vizinhos — a luz do rebite se espalha em cruz. |
| contour.intro.18 | 3×3 | Contorno | 1 | 1 | Fora do painel é escuro: um canto com 3 só pode estar aceso. |
| contour.intro.19 | 4×4 | Contorno | 1 | 1 | Uma corrente: os zeros copiam os vizinhos e cada dedução acende a próxima. |
| contour.intro.20 | 4×4 | Contorno | 1 | 1 | Portão: o 4 é uma ilha, o zero no canto é sombra, os 3 se apoiam na borda. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| contour.practice.1 | 5×5 | Contorno | 1 | 3 | seq A1/4 — o zero copia todos os vizinhos. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.2 | 5×5 | Contorno | 1 | 3 | seq A2/4 — o zero copia todos os vizinhos. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.3 | 5×5 | Contorno | 1 | 3 | seq A3/4 — o zero copia todos os vizinhos. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.4 | 5×5 | Contorno | 1 | 4 | seq A4/4 — o zero copia todos os vizinhos. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.5 | 5×5 | Contorno | 1 | 3 | seq B1/4 — o quatro é uma ilha. Uma ilha de quatro lados. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.6 | 5×5 | Contorno | 1 | 4 | seq B2/4 — o quatro é uma ilha. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.7 | 5×5 | Contorno | 1 | 3 | seq B3/4 — o quatro é uma ilha. Uma ilha de quatro lados. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.8 | 5×5 | Contorno | 1 | 4 | seq B4/4 — o quatro é uma ilha. Uma ilha de quatro lados. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.9 | 5×5 | Contorno | 1 | 3 | seq C1/4 — fora do painel é escuro. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.10 | 5×5 | Contorno | 1 | 4 | seq C2/4 — fora do painel é escuro. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.11 | 5×5 | Contorno | 1 | 3 | seq C3/4 — fora do painel é escuro. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.12 | 5×5 | Contorno | 1 | 4 | seq C4/4 — fora do painel é escuro. Uma ilha de quatro lados. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| contour.trial.1 | 6×6 | Contorno | 1 | 4 | seq D1/4 — "e se?" de um passo. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.2 | 6×6 | Contorno | 1 | 4 | seq D2/4 — "e se?" de um passo. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.3 | 6×6 | Contorno | 1 | 4 | seq D3/4 — "e se?" de um passo. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.4 | 6×6 | Contorno | 1 | 5 | seq D4/4 — "e se?" de um passo. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.5 | 6×6 | Contorno | 1 | 3 | seq E1/4 — pistas esparsas: cada borda conta. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.6 | 6×6 | Contorno | 1 | 3 | seq E2/4 — pistas esparsas: cada borda conta. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.7 | 6×6 | Contorno | 1 | 5 | seq E3/4 — pistas esparsas: cada borda conta. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.8 | 6×6 | Contorno | 1 | 4 | seq E4/4 — pistas esparsas: cada borda conta. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.9 | 6×6 | Contorno | 1 | 4 | seq F1/4 — rochas contam como escuro. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.10 | 6×6 | Contorno | 1 | 4 | seq F2/4 — rochas contam como escuro. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.11 | 6×6 | Contorno | 1 | 5 | seq F3/4 — rochas contam como escuro. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.12 | 6×6 | Contorno | 1 | 6 | seq F4/4 — rochas contam como escuro. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |

### mastery

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| contour.mastery.1 | 7×7 | Contorno | 1 | 5 | seq G1/4 — correntes longas de deduções. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.mastery.2 | 7×7 | Contorno | 1 | 5 | seq G2/4 — correntes longas de deduções. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.mastery.3 | 7×7 | Contorno | 1 | 6 | seq G3/4 — correntes longas de deduções. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.mastery.4 | 7×7 | Contorno | 1 | 7 | seq G4/4 — correntes longas de deduções. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.mastery.5 | 8×7 | Contorno | 1 | 5 | seq H1/4 — o jardim inteiro com poucas placas. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.mastery.6 | 8×7 | Contorno | 1 | 6 | seq H2/4 — o jardim inteiro com poucas placas. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.mastery.7 | 8×7 | Contorno | 1 | 6 | seq H3/4 — o jardim inteiro com poucas placas. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.mastery.8 | 8×7 | Contorno | 1 | 6 | seq H4/4 — o jardim inteiro com poucas placas. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| contour.heart.1 | 8×8 | Contorno | 1 | 7 | Obra-prima 1/6. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.heart.2 | 8×8 | Contorno | 1 | 6 | Obra-prima 2/6. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.heart.3 | 8×8 | Contorno | 1 | 6 | Obra-prima 3/6. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.heart.4 | 8×8 | Contorno | 1 | 6 | Obra-prima 4/6. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.heart.5 | 8×8 | Contorno | 1 | 6 | Obra-prima 5/6. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.heart.6 | 8×8 | Contorno | 1 | 6 | Obra-prima 6/6. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## O Templo das Areias — Mosaico (34)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mosaic.intro.1 | 1×1 | Mosaico | 1 | 1 | Só ele mesmo. |
| mosaic.intro.2 | 2×1 | Mosaico | 1 | 1 | Ele e o vizinho. |
| mosaic.intro.3 | 2×1 | Mosaico | 1 | 1 | O vizinho do outro lado. |
| mosaic.intro.4 | 3×1 | Mosaico | 1 | 1 | Os dois lados. |
| mosaic.intro.5 | 2×1 | Mosaico | 1 | 1 | O rebite aceso conta. |
| mosaic.intro.6 | 3×1 | Mosaico | 1 | 1 | O rebite longe não conta. |
| mosaic.intro.7 | 3×1 | Mosaico | 1 | 1 | O rebite escuro não acende. |
| mosaic.intro.8 | 3×1 | Mosaico | 1 | 1 | Duas janelas lado a lado. |
| mosaic.intro.9 | 4×1 | Mosaico | 1 | 1 | O vizinho é dos dois. |
| mosaic.intro.10 | 4×1 | Mosaico | 1 | 1 | Uma janela inteira acesa ao lado de outra. |
| mosaic.intro.11 | 3×1 | Mosaico | 1 | 1 | Zero: a janela inteira apagada. |
| mosaic.intro.12 | 2×2 | Mosaico | 1 | 1 | Também em cima e embaixo: no canto, quatro. |
| mosaic.intro.13 | 2×2 | Mosaico | 1 | 1 | No canto, com um rebite escuro. |
| mosaic.intro.14 | 3×2 | Mosaico | 1 | 1 | Na borda, seis. |
| mosaic.intro.15 | 3×2 | Mosaico | 1 | 1 | Duas janelas que se cruzam. |
| mosaic.intro.16 | 3×3 | Mosaico | 1 | 1 | Nove: a janela inteira acende. |
| mosaic.intro.17 | 3×3 | Mosaico | 1 | 1 | Nas bordas a janela é cortada: no canto ela tem só quatro ladrilhos. |
| mosaic.intro.18 | 4×4 | Mosaico | 1 | 1 | Zero apaga a janela inteira; o que sobra para os vizinhos fica contado. |
| mosaic.intro.19 | 5×3 | Mosaico | 1 | 1 | Janelas vizinhas dividem colunas: o 3 só pode estar na coluna que o zero não vê. |
| mosaic.intro.20 | 4×4 | Mosaico | 1 | 3 | Portão: janelas quase cheias e um 1 solitário no canto. |

### light

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mosaic.light.1 | 3×3 | Placa | 1 | 1 | Pérgola: a treliça deixa passar o sol; os quadrados de luz no chão são o desenho. |
| mosaic.light.2 | 4×4 | Placa | 1 | 1 | Pérgola maior: a faixa de luz atravessa o chão na diagonal. |
| mosaic.light.3 | 4×4 | Mosaico + Placa | 1 | 3 | A areia cobriu um canto do chão: o que a luz não mostra, as janelas contam. |
| mosaic.light.4 | 5×5 | Mosaico + Placa | 1 | 4 | Uma flor de luz com o miolo de baixo enterrado: quatro janelas desenterram o resto. |

### tower

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mosaic.tower.1 | 3×3 | Placa | 1 | 1 | Do alto da torre: as lajes vitrificadas na areia são o desenho. |
| mosaic.tower.2 | 4×4 | Placa | 1 | 2 | Um toldo esconde um canto das lajes visto do alto: é preciso descer e olhar por baixo. |
| mosaic.tower.3 | 5×5 | Mosaico + Placa | 1 | 4 | Uma duna engoliu as lajes do canto: as janelas do painel completam o desenho. |

### roof

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mosaic.roof.1 | 3×3 | Mosaico | 1 | 3 | O painel está em branco: os números estão incrustados no chão do pátio, lá embaixo. |
| mosaic.roof.2 | 4×4 | Mosaico | 1 | 4 | Quatro por quatro, lido do teto. |
| mosaic.roof.3 | 6×5 | Mosaico | 1 | 5 | Seis por cinco, lido do teto: uma janela de zero no canto abre a conta. |
| mosaic.roof.4 | 7×6 | Mosaico | 1 | 7 | O maior tabuleiro do pátio: as janelas só se resolvem umas pelas outras, em cadeia. |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mosaic.heart.1 | 8×8 | Mosaico | 1 | 8 | Coração do templo: um ornamento 8×8 sem atalhos. |
| mosaic.heart.2 | 8×8 | Mosaico | 1 | 9 | Coração do templo: janelas de um e de zero espalhadas — cada vazio tem que ser provado. |
| mosaic.heart.3 | 9×9 | Mosaico | 1 | 9 | Coração do templo: o grande ornamento 9×9. |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## Os Penhascos dos Faróis — Farol (58)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| beacon.intro.1 | 2×1 | Farol | 1 | 1 | Dois: o farol e mais uma luz ao lado. |
| beacon.intro.2 | 3×1 | Farol | 1 | 1 | Dois: a luz do fim faria o farol ver três. |
| beacon.intro.3 | 3×1 | Farol | 1 | 1 | O farol enxerga em linha: três luzes, ele incluído. |
| beacon.intro.4 | 3×1 | Farol | 1 | 1 | O farol enxerga para os dois lados. |
| beacon.intro.5 | 4×1 | Farol | 1 | 1 | Quatro: a fileira inteira. |
| beacon.intro.6 | 4×1 | Farol | 1 | 1 | Quatro, olhando para os dois lados. |
| beacon.intro.7 | 3×1 | Farol | 1 | 1 | O escuro interrompe o feixe: a luz vai para o outro lado. |
| beacon.intro.8 | 4×1 | Farol | 1 | 1 | O escuro corta o feixe: três sem ele. |
| beacon.intro.9 | 4×1 | Farol | 1 | 1 | Dois faróis: o de um fica sozinho. |
| beacon.intro.10 | 3×1 | Farol | 1 | 1 | Faróis também são luz: um enxerga o outro. |
| beacon.intro.11 | 3×1 | Farol | 1 | 1 | Toda luz precisa ser vista por um farol: o rebite exige o caminho aceso. |
| beacon.intro.12 | 3×1 | Farol | 1 | 1 | O rebite precisa ser visto: o caminho até ele acende. |
| beacon.intro.13 | 1×3 | Farol | 1 | 1 | Também para cima e para baixo. |
| beacon.intro.14 | 2×2 | Farol | 1 | 1 | No quadrado: para o lado e para baixo. |
| beacon.intro.15 | 2×2 | Farol | 1 | 1 | Do outro canto. |
| beacon.intro.16 | 3×2 | Farol | 1 | 1 | Um farol que se vê sozinho no canto. |
| beacon.intro.17 | 4×1 | Farol | 1 | 1 | A rocha corta o feixe: depois dela fica escuro. |
| beacon.intro.18 | 3×3 | Farol | 1 | 1 | O farol enxerga nas quatro direções retas: a cruz. Os cantos ficam no escuro. |
| beacon.intro.19 | 3×3 | Farol | 1 | 1 | Uma rocha bloqueia o feixe. |
| beacon.intro.20 | 4×4 | Farol | 1 | 1 | Portão: dois faróis dividem a costa; os feixes se cruzam e contam para os dois. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| beacon.practice.1 | 5×5 | Farol | 1 | 2 | seq A1/4 — toda luz precisa de uma fonte. Três faróis e três rochas. . |
| beacon.practice.2 | 5×5 | Farol | 1 | 2 | seq A2/4 — toda luz precisa de uma fonte. Faróis que se enxergam. . |
| beacon.practice.3 | 5×5 | Farol | 1 | 2 | seq A3/4 — toda luz precisa de uma fonte. Faróis que se enxergam. . |
| beacon.practice.4 | 5×5 | Farol | 1 | 3 | seq A4/4 — toda luz precisa de uma fonte. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.5 | 5×5 | Farol | 1 | 3 | seq B1/4 — faróis que se enxergam. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.6 | 5×5 | Farol | 1 | 3 | seq B2/4 — faróis que se enxergam. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.7 | 5×5 | Farol | 1 | 3 | seq B3/4 — faróis que se enxergam. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.8 | 5×5 | Farol | 1 | 4 | seq B4/4 — faróis que se enxergam. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.9 | 5×5 | Farol | 1 | 3 | seq C1/4 — as rochas cortam o feixe. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.10 | 5×5 | Farol | 1 | 3 | seq C2/4 — as rochas cortam o feixe. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.11 | 5×5 | Farol | 1 | 3 | seq C3/4 — as rochas cortam o feixe. Três faróis e quatro rochas. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.12 | 5×5 | Farol | 1 | 4 | seq C4/4 — as rochas cortam o feixe. Três faróis e três rochas. Ahá: imagine uma luz ali — algum farol veria demais. |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| beacon.trial.1 | 6×6 | Farol | 1 | 3 | seq D1/4 — só um farol alcança aquela luz. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende. |
| beacon.trial.2 | 6×6 | Farol | 1 | 3 | seq D2/4 — só um farol alcança aquela luz. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende. |
| beacon.trial.3 | 6×6 | Farol | 1 | 3 | seq D3/4 — só um farol alcança aquela luz. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende. |
| beacon.trial.4 | 6×6 | Farol | 1 | 4 | seq D4/4 — só um farol alcança aquela luz. Quatro faróis e seis rochas. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (um "e se?" no caminho). |
| beacon.trial.5 | 6×6 | Farol | 1 | 3 | seq E1/4 — feixes que se cruzam contam para os dois. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.trial.6 | 6×6 | Farol | 1 | 3 | seq E2/4 — feixes que se cruzam contam para os dois. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.trial.7 | 6×6 | Farol | 1 | 3 | seq E3/4 — feixes que se cruzam contam para os dois. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende. |
| beacon.trial.8 | 6×6 | Farol | 1 | 4 | seq E4/4 — feixes que se cruzam contam para os dois. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.trial.9 | 6×6 | Farol | 1 | 3 | seq F1/4 — "e se?": um farol veria demais. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.trial.10 | 6×6 | Farol | 1 | 3 | seq F2/4 — "e se?": um farol veria demais. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.trial.11 | 6×6 | Farol | 1 | 3 | seq F3/4 — "e se?": um farol veria demais. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.trial.12 | 6×6 | Farol | 1 | 4 | seq F4/4 — "e se?": um farol veria demais. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |

### mastery

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| beacon.mastery.1 | 7×7 | Farol | 1 | 5 | seq G1/4 — a costa inteira: fontes, cruzamentos e rochas. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.mastery.2 | 7×7 | Farol | 1 | 5 | seq G2/4 — a costa inteira: fontes, cruzamentos e rochas. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.mastery.3 | 7×7 | Farol | 1 | 5 | seq G3/4 — a costa inteira: fontes, cruzamentos e rochas. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.mastery.4 | 7×7 | Farol | 1 | 7 | seq G4/4 — a costa inteira: fontes, cruzamentos e rochas. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.mastery.5 | 7×7 | Farol | 1 | 5 | seq H1/4 — faróis que dependem uns dos outros. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.mastery.6 | 7×7 | Farol | 1 | 5 | seq H2/4 — faróis que dependem uns dos outros. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.mastery.7 | 7×7 | Farol | 1 | 5 | seq H3/4 — faróis que dependem uns dos outros. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.mastery.8 | 7×7 | Farol | 1 | 6 | seq H4/4 — faróis que dependem uns dos outros. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| beacon.heart.1 | 7×7 | Farol | 1 | 6 | Obra-prima 1/6. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (3 "e se?" no caminho). |
| beacon.heart.2 | 7×7 | Farol | 1 | 6 | Obra-prima 2/6. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (4 "e se?" no caminho). |
| beacon.heart.3 | 7×7 | Farol | 1 | 7 | Obra-prima 3/6. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (5 "e se?" no caminho). |
| beacon.heart.4 | 7×7 | Farol | 1 | 7 | Obra-prima 4/6. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (5 "e se?" no caminho). |
| beacon.heart.5 | 7×7 | Farol | 1 | 7 | Obra-prima 5/6. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (5 "e se?" no caminho). |
| beacon.heart.6 | 7×7 | Farol | 1 | 8 | Obra-prima 6/6. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (8 "e se?" no caminho). |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## O Vale dos Moinhos — Trama (58)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| weave.intro.1 | 1×1 | Trama | 1 | 1 | Um fio de um: acender. |
| weave.intro.2 | 2×1 | Trama | 1 | 1 | Um fio de dois: os dois acesos. |
| weave.intro.3 | 2×1 | Trama | 1 | 1 | Um fio só, na coluna que pede um. |
| weave.intro.4 | 3×1 | Trama | 1 | 1 | Um fio de três: três ladrilhos acesos seguidos. |
| weave.intro.5 | 3×1 | Trama | 1 | 1 | Um fio de dois — e uma coluna vazia. |
| weave.intro.6 | 3×1 | Trama | 1 | 1 | As colunas também têm fios: o anel vazio é coluna sem luz. |
| weave.intro.7 | 3×1 | Trama | 1 | 1 | Dois fios de um: o meio separa. |
| weave.intro.8 | 4×1 | Trama | 1 | 1 | Dois fios de um: entre eles, escuro. |
| weave.intro.9 | 3×1 | Trama | 1 | 1 | O buraco corta o fio. |
| weave.intro.10 | 2×2 | Trama | 1 | 1 | Zero: uma linha sem fio nenhum. |
| weave.intro.11 | 2×2 | Trama | 1 | 1 | Uma coluna cheia, a outra vazia. |
| weave.intro.12 | 2×2 | Trama | 1 | 1 | Linhas e colunas se cruzam. |
| weave.intro.13 | 3×2 | Trama | 1 | 1 | Uma barra e um pé no meio. |
| weave.intro.14 | 3×3 | Trama | 1 | 1 | Uma cruz tecida. |
| weave.intro.15 | 3×2 | Trama | 1 | 1 | Uma linha sem número: ela se lê pelas colunas. |
| weave.intro.16 | 3×3 | Trama | 1 | 1 | Em cada coluna, dois fios separados pelo meio escuro. |
| weave.intro.17 | 3×3 | Trama | 1 | 1 | Buracos no tear: um H. |
| weave.intro.18 | 4×4 | Trama | 1 | 2 | Dois fios separados: entre eles sempre há pelo menos um ladrilho escuro. |
| weave.intro.19 | 5×5 | Trama | 1 | 1 | O desenho é o moinho do vale: as pás em X sobre a torre. |
| weave.intro.20 | 5×5 | Trama | 1 | 1 | Portão: uma chave. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| weave.practice.1 | 6×6 | Trama | 1 | 2 | seq A1/4 — a sequência mais longa de uma linha cobre o meio dela. Uma folha com sua nervura. |
| weave.practice.2 | 7×6 | Trama | 1 | 2 | seq A2/4 — a sequência mais longa de uma linha cobre o meio dela. Um cogumelo à sombra do moinho. |
| weave.practice.3 | 7×7 | Trama | 1 | 2 | seq A3/4 — a sequência mais longa de uma linha cobre o meio dela. Um barco à vela no lago. |
| weave.practice.4 | 7×7 | Trama | 1 | 3 | seq A4/4 — a sequência mais longa de uma linha cobre o meio dela. A âncora do barqueiro. |
| weave.practice.5 | 8×6 | Trama | 1 | 2 | seq B1/4 — sequências separadas: sempre um escuro entre elas. Um peixe no riacho. |
| weave.practice.6 | 7×7 | Trama | 1 | 2 | seq B2/4 — sequências separadas: sempre um escuro entre elas. Uma borboleta sobre a lavanda. |
| weave.practice.7 | 8×8 | Trama | 1 | 2 | seq B3/4 — sequências separadas: sempre um escuro entre elas. Um pássaro em voo. |
| weave.practice.8 | 8×8 | Trama | 1 | 2 | seq B4/4 — sequências separadas: sempre um escuro entre elas. A casa do moleiro. |
| weave.practice.9 | 6×6 | Trama | 1 | 2 | seq C1/4 — tapeçarias simétricas. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. . |
| weave.practice.10 | 6×6 | Trama | 1 | 2 | seq C2/4 — tapeçarias simétricas. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. . |
| weave.practice.11 | 6×6 | Trama | 1 | 2 | seq C3/4 — tapeçarias simétricas. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. . |
| weave.practice.12 | 6×6 | Trama | 1 | 2 | seq C4/4 — tapeçarias simétricas. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. . |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| weave.trial.1 | 7×7 | Trama | 1 | 3 | seq D1/4 — fios partidos: a sequência não atravessa o buraco. Fios partidos: o sino do vale; uma linha ficou sem fio: ela se lê pelas que a cruzam; Ahá: um "e se?" — imagine a sequência ali: o fio cruzado não fecharia. |
| weave.trial.2 | 7×7 | Trama | 1 | 3 | seq D2/4 — fios partidos: a sequência não atravessa o buraco. Fios partidos: uma flor de lavanda; Ahá: um "e se?" — imagine a sequência ali: o fio cruzado não fecharia. |
| weave.trial.3 | 8×6 | Trama | 1 | 3 | seq D3/4 — fios partidos: a sequência não atravessa o buraco. Fios partidos: a tartaruga do lago; duas linhas ficaram sem fio: elas se leem pelas que as cruzam; Ahá: um "e se?" — imagine a sequência ali: o fio cruzado não fecharia. |
| weave.trial.4 | 6×8 | Trama | 1 | 4 | seq D4/4 — fios partidos: a sequência não atravessa o buraco. Fios partidos: o farol visto do vale; três linhas ficaram sem fio: elas se leem pelas que as cruzam; Ahá: dois "e se?" — imagine a sequência ali: o fio cruzado não fecharia. |
| weave.trial.5 | 9×9 | Trama | 1 | 3 | seq E1/4 — fios partidos em desenhos maiores. Fios partidos: o caracol da horta, com a casa nas costas; Ahá: um "e se?" — imagine a sequência ali: o fio cruzado não fecharia. |
| weave.trial.6 | 8×8 | Trama | 1 | 3 | seq E2/4 — fios partidos em desenhos maiores. Fios partidos: a árvore do moinho; Ahá: um "e se?" — imagine a sequência ali: o fio cruzado não fecharia. |
| weave.trial.7 | 8×8 | Trama | 1 | 3 | seq E3/4 — fios partidos em desenhos maiores. Fios partidos: as torres da Cidadela ao longe; duas linhas ficaram sem fio: elas se leem pelas que as cruzam; Ahá: um "e se?" — imagine a sequência ali: o fio cruzado não fecharia. |
| weave.trial.8 | 8×8 | Trama | 1 | 3 | seq E4/4 — fios partidos em desenhos maiores. Fios partidos: a coruja do celeiro; uma linha ficou sem fio: ela se lê pelas que a cruzam; Ahá: um "e se?" — imagine a sequência ali: o fio cruzado não fecharia. |
| weave.trial.9 | 8×8 | Trama | 1 | 3 | seq F1/4 — "e se?": a sequência ali não fecharia. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.trial.10 | 8×8 | Trama | 1 | 3 | seq F2/4 — "e se?": a sequência ali não fecharia. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.trial.11 | 8×8 | Trama | 1 | 3 | seq F3/4 — "e se?": a sequência ali não fecharia. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.trial.12 | 8×8 | Trama | 1 | 6 | seq F4/4 — "e se?": a sequência ali não fecharia. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. Ahá: imagine a sequência ali — o fio não fecharia. |

### mastery

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| weave.mastery.1 | 9×9 | Trama | 1 | 5 | seq G1/4 — tapeçarias partidas. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.mastery.2 | 9×9 | Trama | 1 | 5 | seq G2/4 — tapeçarias partidas. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.mastery.3 | 9×9 | Trama | 1 | 5 | seq G3/4 — tapeçarias partidas. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.mastery.4 | 9×9 | Trama | 1 | 6 | seq G4/4 — tapeçarias partidas. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.mastery.5 | 10×10 | Trama | 1 | 5 | seq H1/4 — o grande tear: deduções cruzadas. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.mastery.6 | 10×10 | Trama | 1 | 5 | seq H2/4 — o grande tear: deduções cruzadas. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.mastery.7 | 10×10 | Trama | 1 | 5 | seq H3/4 — o grande tear: deduções cruzadas. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.mastery.8 | 10×10 | Trama | 1 | 6 | seq H4/4 — o grande tear: deduções cruzadas. As colunas se espelham: se a resposta é única, o desenho também é simétrico — o que vale de um lado vale do outro. Ahá: imagine a sequência ali — o fio não fecharia. |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| weave.heart.1 | 10×10 | Trama | 1 | 6 | Obra-prima 1/6. O grande pinheiro do vale; uma linha ficou sem fio: ela se lê pelas que a cruzam; Ahá: três "e se?" — imagine a sequência ali: o fio cruzado não fecharia. |
| weave.heart.2 | 10×10 | Trama | 1 | 6 | Obra-prima 2/6. O mapa da ilha — com o lago no meio; duas linhas ficaram sem fio: elas se leem pelas que as cruzam; Ahá: três "e se?" — imagine a sequência ali: o fio cruzado não fecharia. |
| weave.heart.3 | 9×9 | Trama | 1 | 6 | Obra-prima 3/6. O sol sobre o vale; três linhas ficaram sem fio: elas se leem pelas que as cruzam; Ahá: três "e se?" — imagine a sequência ali: o fio cruzado não fecharia. |
| weave.heart.4 | 10×10 | Trama | 1 | 6 | Obra-prima 4/6. O grande moinho; uma linha ficou sem fio: ela se lê pelas que a cruzam; Ahá: três "e se?" — imagine a sequência ali: o fio cruzado não fecharia. |
| weave.heart.5 | 10×10 | Trama | 1 | 6 | Obra-prima 5/6. O emblema dos nove ladrilhos; duas linhas ficaram sem fio: elas se leem pelas que as cruzam; Ahá: quatro "e se?" — imagine a sequência ali: o fio cruzado não fecharia. |
| weave.heart.6 | 10×10 | Trama | 1 | 7 | Obra-prima 6/6. A raposa do bosque, orelhas em pé; uma linha ficou sem fio: ela se lê pelas que a cruzam; Ahá: seis "e se?" — imagine a sequência ali: o fio cruzado não fecharia. |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## O Lago Espelhado — Gêmeos (58)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| twins.intro.1 | 2×1 | Gêmeos | 1~ | 1 | Duas gêmeas sozinhas: uma acesa, outra apagada. |
| twins.intro.2 | 3×1 | Gêmeos | 1~ | 1 | Duas gêmeas de um, separadas pelo meio. |
| twins.intro.3 | 4×1 | Gêmeos | 3+~ | 4 | Duas regiões separadas com a mesma forma. |
| twins.intro.4 | 4×1 | Gêmeos | 1 | 1 | Sozinha deste lado, sozinha do outro. |
| twins.intro.5 | 6×1 | Gêmeos | 1 | 1 | Copiar o dominó do outro lado da água. |
| twins.intro.6 | 8×1 | Gêmeos | 1 | 1 | Copiar a barra de três do outro lado da água. |
| twins.intro.7 | 5×2 | Gêmeos | 1 | 1 | A gêmea pode estar na outra ponta da forma. |
| twins.intro.8 | 3×3 | Gêmeos | 1 | 1 | O dominó em pé, copiado em pé. |
| twins.intro.9 | 3×3 | Gêmeos | 1 | 1 | A barra em pé, copiada em pé. |
| twins.intro.10 | 4×3 | Gêmeos | 1 | 1 | O canto copiado no quadrado. |
| twins.intro.11 | 5×2 | Gêmeos | 2 | 3 | Copiar o L do outro lado. |
| twins.intro.12 | 5×2 | Gêmeos | 1 | 3 | A sombra pode ser gêmea da luz. |
| twins.intro.13 | 6×2 | Gêmeos | 2 | 1 | Um símbolo novo, a mesma regra: copiar o L. |
| twins.intro.14 | 3×4 | Gêmeos | 2 | 1 | Dois pares diferentes, cada um com a sua forma. |
| twins.intro.15 | 5×2 | Gêmeos | 2 | 3 | Símbolo espelhado: a forma refletida. |
| twins.intro.16 | 5×2 | Gêmeos | 1 | 1 | Espelhada: o L do outro lado vira ao contrário. |
| twins.intro.17 | 5×3 | Gêmeos | 2 | 4 | Dois pares: as cópias precisam se encaixar do outro lado da água. |
| twins.intro.18 | 4×3 | Gêmeos | 1 | 1 | O canto copiado, com a gêmea no outro canto. |
| twins.intro.19 | 3×2 | Gêmeos | 1 | 4 | A gêmea pode ser a sobra: a sombra de baixo copia a luz de cima. |
| twins.intro.20 | 6×4 | Gêmeos | 2 | 4 | Portão: um par direto e um par espelhado atravessam o lago — o espelho vira o L do avesso. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| twins.practice.1 | 7×4 | Gêmeos | 3+ | 4 | seq A1/4 — a cópia só cabe num lugar. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.practice.2 | 7×4 | Gêmeos | 3+ | 4 | seq A2/4 — a cópia só cabe num lugar. Dois pares atravessam o lago. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra. |
| twins.practice.3 | 7×4 | Gêmeos | 3+ | 5 | seq A3/4 — a cópia só cabe num lugar. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.practice.4 | 7×4 | Gêmeos | 3+ | 6 | seq A4/4 — a cópia só cabe num lugar. Dois pares atravessam o lago. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra. |
| twins.practice.5 | 7×4 | Gêmeos | 3+ | 4 | seq B1/4 — a luz pode copiar a sombra. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.practice.6 | 7×4 | Gêmeos | 3+ | 4 | seq B2/4 — a luz pode copiar a sombra. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.practice.7 | 7×4 | Gêmeos | 3+ | 5 | seq B3/4 — a luz pode copiar a sombra. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.practice.8 | 7×4 | Gêmeos | 3+ | 6 | seq B4/4 — a luz pode copiar a sombra. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.practice.9 | 7×4 | Gêmeos | 3+ | 4 | seq C1/4 — o espelho inverte a forma. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.practice.10 | 7×4 | Gêmeos | 3+ | 5 | seq C2/4 — o espelho inverte a forma. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.practice.11 | 7×4 | Gêmeos | 3+ | 5 | seq C3/4 — o espelho inverte a forma. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.practice.12 | 7×4 | Gêmeos | 2 | 6 | seq C4/4 — o espelho inverte a forma. Um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma. |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| twins.trial.1 | 8×5 | Gêmeos | 3+ | 5 | seq D1/4 — três cópias que precisam caber juntas. Três pares atravessam o lago. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra. |
| twins.trial.2 | 8×5 | Gêmeos | 3+ | 5 | seq D2/4 — três cópias que precisam caber juntas. Três pares atravessam o lago. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra. |
| twins.trial.3 | 8×5 | Gêmeos | 3+ | 6 | seq D3/4 — três cópias que precisam caber juntas. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.trial.4 | 8×5 | Gêmeos | 3+ | 7 | seq D4/4 — três cópias que precisam caber juntas. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.trial.5 | 8×5 | Gêmeos | 3+ | 3 | seq E1/4 — o modelo incompleto: a forma também se deduz. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; a luz pode copiar a sombra. |
| twins.trial.6 | 8×5 | Gêmeos | 3+ | 3 | seq E2/4 — o modelo incompleto: a forma também se deduz. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; a luz pode copiar a sombra. |
| twins.trial.7 | 8×5 | Gêmeos | 3+ | 3 | seq E3/4 — o modelo incompleto: a forma também se deduz. Dois pares atravessam o lago. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados. |
| twins.trial.8 | 8×5 | Gêmeos | 3+ | 6 | seq E4/4 — o modelo incompleto: a forma também se deduz. Dois pares atravessam o lago. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados. |
| twins.trial.9 | 8×5 | Gêmeos | 3+ | 5 | seq F1/4 — espelhos e sombras atravessando o lago. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.trial.10 | 8×5 | Gêmeos | 3+ | 5 | seq F2/4 — espelhos e sombras atravessando o lago. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.trial.11 | 8×5 | Gêmeos | 3+ | 6 | seq F3/4 — espelhos e sombras atravessando o lago. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.trial.12 | 8×5 | Gêmeos | 3+ | 6 | seq F4/4 — espelhos e sombras atravessando o lago. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |

### mastery

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| twins.mastery.1 | 9×6 | Gêmeos | 3+ | 5 | seq G1/4 — modelos incompletos e espelhados. Um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma. |
| twins.mastery.2 | 9×6 | Gêmeos | 3+ | 5 | seq G2/4 — modelos incompletos e espelhados. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.mastery.3 | 9×6 | Gêmeos | 3+ | 6 | seq G3/4 — modelos incompletos e espelhados. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.mastery.4 | 9×6 | Gêmeos | 3+ | 7 | seq G4/4 — modelos incompletos e espelhados. Um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma. |
| twins.mastery.5 | 10×6 | Gêmeos | 3+ | 6 | seq H1/4 — o lago inteiro: quatro pares. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.mastery.6 | 10×6 | Gêmeos | 3+ | 6 | seq H2/4 — o lago inteiro: quatro pares. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.mastery.7 | 10×6 | Gêmeos | 3+ | 7 | seq H3/4 — o lago inteiro: quatro pares. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.mastery.8 | 10×6 | Gêmeos | 3+ | 8 | seq H4/4 — o lago inteiro: quatro pares. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| twins.heart.1 | 10×6 | Gêmeos | 3+ | 7 | Obra-prima 1/6. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.heart.2 | 10×6 | Gêmeos | 3+ | 7 | Obra-prima 2/6. Um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma. |
| twins.heart.3 | 10×6 | Gêmeos | 3+ | 7 | Obra-prima 3/6. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.heart.4 | 10×6 | Gêmeos | 3+ | 7 | Obra-prima 4/6. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.heart.5 | 10×6 | Gêmeos | 3+ | 8 | Obra-prima 5/6. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; a luz pode copiar a sombra. |
| twins.heart.6 | 10×6 | Gêmeos | 3+ | 9 | Obra-prima 6/6. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## A Cidadela — Todas as linguagens (40)

### gate

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| citadel.gate.1 | 5×5 | Mosaico + Contorno | 1 | 4 | Sem tutorial — Mosaico + Contorno: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| citadel.gate.2 | 5×5 | Contorno + Afinidade | 1 | 4 | Sem tutorial — Contorno + Afinidade: o que uma linguagem decide, a outra aproveita. Ahá: um gargalo: o único caminho que liga as gemas; (3 "e se?" no caminho). |
| citadel.gate.3 | 5×5 | Farol + Trama | 1 | 4 | Sem tutorial — Farol + Trama: o que uma linguagem decide, a outra aproveita. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (um "e se?" no caminho). |
| citadel.gate.4 | 5×5 | Medida + Forma | 1~ | 6 | Sem tutorial — Medida + Forma: o que uma linguagem decide, a outra aproveita. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde. |
| citadel.gate.5 | 5×5 | Medida + Afinidade | 1~ | 7 | Sem tutorial — Medida + Afinidade: o que uma linguagem decide, a outra aproveita. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (2 "e se?" no caminho). |
| citadel.gate.6 | 5×5 | Forma + Gêmeos | 1~ | 7 | Sem tutorial — Forma + Gêmeos: o que uma linguagem decide, a outra aproveita. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída. |

### court

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| citadel.court.1 | 6×6 | Forma + Trama | 1 | 5 | Sem tutorial — Forma + Trama: o que uma linguagem decide, a outra aproveita. Ahá: o molde incompleto só tem uma saída. |
| citadel.court.2 | 6×6 | Mosaico + Farol | 1 | 5 | Sem tutorial — Mosaico + Farol: o que uma linguagem decide, a outra aproveita. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (2 "e se?" no caminho). |
| citadel.court.3 | 6×6 | Farol + Medida | 1 | 6 | Sem tutorial — Farol + Medida: o que uma linguagem decide, a outra aproveita. Ahá: só um farol alcança aquela luz — o caminho até ela acende; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (2 "e se?" no caminho). |
| citadel.court.4 | 6×6 | Afinidade + Trama | 1 | 6 | Sem tutorial — Afinidade + Trama: o que uma linguagem decide, a outra aproveita. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| citadel.court.5 | 6×6 | Contorno + Gêmeos | 1 | 6 | Sem tutorial — Contorno + Gêmeos: o que uma linguagem decide, a outra aproveita. Ahá: a cópia só cabe num lugar; (4 "e se?" no caminho). |
| citadel.court.6 | 6×6 | Contorno + Medida | 1 | 8 | Sem tutorial — Contorno + Medida: o que uma linguagem decide, a outra aproveita. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (3 "e se?" no caminho). |
| citadel.court.7 | 6×6 | Medida + Gêmeos | 1~ | 8 | Sem tutorial — Medida + Gêmeos: o que uma linguagem decide, a outra aproveita. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: a cópia só cabe num lugar; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (3 "e se?" no caminho). |
| citadel.court.8 | 6×6 | Mosaico + Afinidade | 1 | 9 | Sem tutorial — Mosaico + Afinidade: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: um gargalo: o único caminho que liga as gemas; (3 "e se?" no caminho). |
| citadel.court.9 | 6×6 | Forma + Mosaico | 1 | 9 | Sem tutorial — Forma + Mosaico: o que uma linguagem decide, a outra aproveita. Ahá: o molde incompleto só tem uma saída; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (4 "e se?" no caminho). |
| citadel.court.10 | 6×6 | Afinidade + Forma | 1~ | 9 | Sem tutorial — Afinidade + Forma: o que uma linguagem decide, a outra aproveita. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas; e por fim: o molde incompleto só tem uma saída. |

### halls

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| citadel.halls.1 | 7×6 | Contorno + Forma + Trama | 1 | 6 | Sem tutorial — Contorno + Forma + Trama: o que uma linguagem decide, a outra aproveita. Ahá: só existe um encaixe para o molde. |
| citadel.halls.2 | 7×7 | Medida + Mosaico + Trama | 1 | 6 | Sem tutorial — Medida + Mosaico + Trama: o que uma linguagem decide, a outra aproveita. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali. |
| citadel.halls.3 | 7×7 | Afinidade + Farol + Forma | 1 | 6 | Sem tutorial — Afinidade + Farol + Forma: o que uma linguagem decide, a outra aproveita. Ahá: só um farol alcança aquela luz — o caminho até ela acende; depois: um gargalo: o único caminho que liga as gemas; e por fim: só existe um encaixe para o molde. |
| citadel.halls.4 | 6×6 | Farol + Contorno + Trama | 1 | 6 | Sem tutorial — Farol + Contorno + Trama: o que uma linguagem decide, a outra aproveita. Ahá: imagine o ladrilho do outro jeito — uma pista quebraria na hora. |
| citadel.halls.5 | 7×6 | Afinidade + Medida + Farol | 1 | 6 | Sem tutorial — Afinidade + Medida + Farol: o que uma linguagem decide, a outra aproveita. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas; e por fim: só um farol alcança aquela luz — o caminho até ela acende; (2 "e se?" no caminho). |
| citadel.halls.6 | 7×7 | Farol + Contorno + Mosaico | 1 | 7 | Sem tutorial — Farol + Contorno + Mosaico: o que uma linguagem decide, a outra aproveita. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (4 "e se?" no caminho). |
| citadel.halls.7 | 6×6 | Medida + Mosaico + Gêmeos | 1 | 7 | Sem tutorial — Medida + Mosaico + Gêmeos: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; e por fim: a cópia só cabe num lugar; (2 "e se?" no caminho). |
| citadel.halls.8 | 7×7 | Afinidade + Gêmeos + Trama | 1 | 8 | Sem tutorial — Afinidade + Gêmeos + Trama: o que uma linguagem decide, a outra aproveita. Ahá: um gargalo: o único caminho que liga as gemas; depois: a cópia só cabe num lugar. |
| citadel.halls.9 | 6×6 | Contorno + Afinidade + Medida | 1 | 8 | Sem tutorial — Contorno + Afinidade + Medida: o que uma linguagem decide, a outra aproveita. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (6 "e se?" no caminho). |
| citadel.halls.10 | 7×7 | Medida + Mosaico + Contorno | 1 | 8 | Sem tutorial — Medida + Mosaico + Contorno: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (6 "e se?" no caminho). |
| citadel.halls.11 | 7×6 | Afinidade + Contorno + Mosaico | 1 | 8 | Sem tutorial — Afinidade + Contorno + Mosaico: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: um gargalo: o único caminho que liga as gemas; (5 "e se?" no caminho). |
| citadel.halls.12 | 6×6 | Forma + Mosaico + Afinidade | 1 | 8 | Sem tutorial — Forma + Mosaico + Afinidade: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: um gargalo: o único caminho que liga as gemas; (um "e se?" no caminho). |
| citadel.halls.13 | 7×7 | Contorno + Gêmeos + Forma | 1 | 9 | Sem tutorial — Contorno + Gêmeos + Forma: o que uma linguagem decide, a outra aproveita. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída; (4 "e se?" no caminho). |
| citadel.halls.14 | 7×7 | Medida + Afinidade + Gêmeos | 1~ | 10 | Sem tutorial — Medida + Afinidade + Gêmeos: o que uma linguagem decide, a outra aproveita. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um gargalo: o único caminho que liga as gemas; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (3 "e se?" no caminho). |

### crown

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| citadel.crown.1 | 7×7 | Afinidade + Farol + Medida + Mosaico + Eco | 1 | 7 | Sem tutorial — Afinidade + Farol + Medida + Mosaico + Eco: o que uma linguagem decide, a outra aproveita. Ahá: só um farol alcança aquela luz — o caminho até ela acende; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: um gargalo: o único caminho que liga as gemas. |
| citadel.crown.2 | 7×7 | Forma + Afinidade + Contorno + Trama + Eco | 1 | 7 | Sem tutorial — Forma + Afinidade + Contorno + Trama + Eco: o que uma linguagem decide, a outra aproveita. Ahá: um gargalo: o único caminho que liga as gemas; (um "e se?" no caminho). |
| citadel.crown.3 | 6×6 | Afinidade + Mosaico + Eco | 1 | 7 | Sem tutorial — Afinidade + Mosaico + Eco: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: um gargalo: o único caminho que liga as gemas; (um "e se?" no caminho). |
| citadel.crown.4 | 7×6 | Contorno + Mosaico + Medida + Eco | 1 | 7 | Sem tutorial — Contorno + Mosaico + Medida + Eco: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (4 "e se?" no caminho). |
| citadel.crown.5 | 7×6 | Medida + Afinidade + Contorno + Eco | 1 | 7 | Sem tutorial — Medida + Afinidade + Contorno + Eco: o que uma linguagem decide, a outra aproveita. Ahá: um gargalo: o único caminho que liga as gemas; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (3 "e se?" no caminho). |
| citadel.crown.6 | 7×7 | Afinidade + Contorno + Farol + Eco | 1 | 7 | Sem tutorial — Afinidade + Contorno + Farol + Eco: o que uma linguagem decide, a outra aproveita. Ahá: só um farol alcança aquela luz — o caminho até ela acende; depois: um gargalo: o único caminho que liga as gemas; (5 "e se?" no caminho). |
| citadel.crown.7 | 7×7 | Afinidade + Medida + Trama + Eco | 1 | 7 | Sem tutorial — Afinidade + Medida + Trama + Eco: o que uma linguagem decide, a outra aproveita. Ahá: um gargalo: o único caminho que liga as gemas; (6 "e se?" no caminho). |
| citadel.crown.8 | 7×6 | Forma + Afinidade + Contorno + Eco | 1 | 8 | Sem tutorial — Forma + Afinidade + Contorno + Eco: o que uma linguagem decide, a outra aproveita. Ahá: um gargalo: o único caminho que liga as gemas; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída; (um "e se?" no caminho). |
| citadel.crown.9 | 7×7 | Forma + Medida + Afinidade + Gêmeos + Eco | 1 | 8 | Sem tutorial — Forma + Medida + Afinidade + Gêmeos + Eco: o que uma linguagem decide, a outra aproveita. Ahá: o molde incompleto só tem uma saída; depois: um gargalo: o único caminho que liga as gemas; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (um "e se?" no caminho). |
| citadel.crown.10 | 7×7 | Mosaico + Gêmeos + Medida + Eco | 1 | 9 | Sem tutorial — Mosaico + Gêmeos + Medida + Eco: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: a cópia só cabe num lugar; e por fim: um número que não cabe de um lado da luz só pode estar do outro; (5 "e se?" no caminho). |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## A Caverna Ressonante — Eco (30)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| echo.intro.1 | 3×1 | Placa + Eco | 1 | 1 | Tocar um cristal faz os vizinhos marcados ressoarem junto: o do meio acende os três. |
| echo.intro.2 | 3×1 | Placa + Eco | 1 | 1 | Tocar de novo desfaz; a ordem não importa: os três toques deixam só o meio. |
| echo.intro.3 | 3×1 | Placa + Eco | 1 | 1 | O cristal mudo não aceita toque: só os vizinhos o alcançam — e duas ressonâncias se anulam. |
| echo.intro.4 | 3×3 | Placa + Eco | 1 | 1 | Marcas diagonais: o eco salta para os cantos. |
| echo.intro.5 | 3×3 | Placa + Eco | 1 | 1 | Todos ressoam em cruz: acender tudo exige pensar em que toques se somam. |
| echo.intro.6 | 3×3 | Placa + Eco | 1 | 1 | Marcas longas: um toque vira a linha inteira, outro a coluna inteira. |
| echo.intro.7 | 3×3 | Placa + Eco | 1 | 1 | Portão: o centro mudo só acende pelos vizinhos verticais — conte quantas vezes ele ressoa. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| echo.practice.1 | 4×4 | Placa + Eco | 1 | 2 | seq A1/3 — toques que se somam. Ahá: tocar duas vezes desfaz e a ordem não importa — cada cristal é tocado zero ou uma vez. |
| echo.practice.2 | 4×4 | Placa + Eco | 1 | 2 | seq A2/3 — toques que se somam. Ahá: tocar duas vezes desfaz e a ordem não importa — cada cristal é tocado zero ou uma vez. |
| echo.practice.3 | 4×4 | Placa + Eco | 1 | 2 | seq A3/3 — toques que se somam. Ahá: tocar duas vezes desfaz e a ordem não importa — cada cristal é tocado zero ou uma vez. |
| echo.practice.4 | 4×4 | Placa + Eco | 1 | 2 | seq B1/3 — cristais mudos. Ahá: o cristal mudo só muda pela soma das ressonâncias dos vizinhos. |
| echo.practice.5 | 4×4 | Placa + Eco | 1 | 2 | seq B2/3 — cristais mudos. Ahá: o cristal mudo só muda pela soma das ressonâncias dos vizinhos. |
| echo.practice.6 | 4×4 | Placa + Eco | 1 | 2 | seq B3/3 — cristais mudos. Ahá: os cristais mudos só mudam pela soma das ressonâncias dos vizinhos. |
| echo.practice.7 | 5×5 | Placa + Eco | 1 | 2 | seq C1/3 — ecos longos de linha e coluna. Ahá: um toque vira a linha inteira — comece pelas linhas que só um cristal alcança. |
| echo.practice.8 | 5×5 | Placa + Eco | 1 | 2 | seq C2/3 — ecos longos de linha e coluna. Ahá: um toque vira a linha inteira — comece pelas linhas que só um cristal alcança. |
| echo.practice.9 | 5×5 | Placa + Eco | 1 | 2 | seq C3/3 — ecos longos de linha e coluna. Ahá: um toque vira a linha inteira — comece pelas linhas que só um cristal alcança. |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| echo.trial.1 | 6×5 | Medida + Eco | 1 | 5 | seq D1/3 — eco + Medida: o tamanho pedido tem de ser alcançável. Eco + Medida. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz. |
| echo.trial.2 | 5×5 | Medida + Eco | 1 | 6 | seq D2/3 — eco + Medida: o tamanho pedido tem de ser alcançável. Eco + Medida. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (um "e se?" no caminho). |
| echo.trial.3 | 5×5 | Medida + Eco | 1 | 8 | seq D3/3 — eco + Medida: o tamanho pedido tem de ser alcançável. Eco + Medida. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (4 "e se?" no caminho). |
| echo.trial.4 | 5×5 | Contorno + Eco | 1 | 4 | seq E1/3 — eco + Contorno: bordas que os ecos conseguem desenhar. Eco + Contorno. Ahá: imagine o ladrilho do outro jeito — uma pista quebraria na hora. |
| echo.trial.5 | 5×5 | Contorno + Eco | 1 | 4 | seq E2/3 — eco + Contorno: bordas que os ecos conseguem desenhar. Eco + Contorno. Ahá: imagine o ladrilho do outro jeito — uma pista quebraria na hora. |
| echo.trial.6 | 6×5 | Contorno + Eco | 1 | 4 | seq E3/3 — eco + Contorno: bordas que os ecos conseguem desenhar. Eco + Contorno. Ahá: imagine o ladrilho do outro jeito — uma pista quebraria na hora. |
| echo.trial.7 | 5×5 | Mosaico + Eco | 1 | 6 | seq F1/3 — eco + Mosaico: janelas alcançáveis. Eco + Mosaico. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (3 "e se?" no caminho). |
| echo.trial.8 | 5×5 | Mosaico + Eco | 1 | 7 | seq F2/3 — eco + Mosaico: janelas alcançáveis. Eco + Mosaico. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (4 "e se?" no caminho). |
| echo.trial.9 | 6×5 | Mosaico + Eco | 1 | 8 | seq F3/3 — eco + Mosaico: janelas alcançáveis. Eco + Mosaico. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (4 "e se?" no caminho). |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| echo.heart.1 | 7×7 | Afinidade + Contorno + Trama + Eco | 1 | 6 | Obra-prima 1/5. Eco + Afinidade + Contorno + Trama: a resposta precisa obedecer às regras e ser alcançável pelos ecos. Ahá: um gargalo: o único caminho que liga as gemas; (2 "e se?" no caminho). |
| echo.heart.2 | 6×6 | Contorno + Afinidade + Eco | 1 | 6 | Obra-prima 2/5. Eco + Afinidade + Contorno: a resposta precisa obedecer às regras e ser alcançável pelos ecos. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas; (um "e se?" no caminho). |
| echo.heart.3 | 6×6 | Mosaico + Contorno + Eco | 1 | 7 | Obra-prima 3/5. Eco + Contorno + Mosaico: a resposta precisa obedecer às regras e ser alcançável pelos ecos. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (5 "e se?" no caminho). |
| echo.heart.4 | 6×6 | Forma + Medida + Eco | 1 | 8 | Obra-prima 4/5. Eco + Medida + Forma: a resposta precisa obedecer às regras e ser alcançável pelos ecos. Ahá: um número que não cabe de um lado da luz só pode estar do outro; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (4 "e se?" no caminho). |
| echo.heart.5 | 7×6 | Mosaico + Medida + Eco | 1 | 9 | Obra-prima 5/5. Eco + Mosaico + Medida: a resposta precisa obedecer às regras e ser alcançável pelos ecos. Ahá: um número que não cabe de um lado da luz só pode estar do outro; depois: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; e por fim: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (6 "e se?" no caminho). |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## A Torre do Céu — Tudo (24)

### ascent

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| spire.ascent.1 | 7×7 | Forma + Medida + Trama | 1 | 6 | Forma + Medida + Trama: tudo o que a ilha ensinou, junto. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde. |
| spire.ascent.2 | 6×6 | Gêmeos + Trama | 1 | 6 | Gêmeos + Trama: tudo o que a ilha ensinou, junto. Ahá: a cópia só cabe num lugar; (2 "e se?" no caminho). |
| spire.ascent.3 | 7×7 | Forma + Farol + Mosaico | 1 | 6 | Forma + Farol + Mosaico: tudo o que a ilha ensinou, junto. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde. |
| spire.ascent.4 | 6×6 | Contorno + Farol | 1 | 7 | Contorno + Farol: tudo o que a ilha ensinou, junto. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (6 "e se?" no caminho). |
| spire.ascent.5 | 7×7 | Contorno + Gêmeos + Afinidade | 1 | 8 | Contorno + Gêmeos + Afinidade: tudo o que a ilha ensinou, junto. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: a cópia só cabe num lugar. |
| spire.ascent.6 | 7×7 | Afinidade + Contorno + Medida | 1 | 8 | Afinidade + Contorno + Medida: tudo o que a ilha ensinou, junto. Ahá: um gargalo: o único caminho que liga as gemas; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (5 "e se?" no caminho). |
| spire.ascent.7 | 6×6 | Medida + Afinidade | 1~ | 8 | Medida + Afinidade: tudo o que a ilha ensinou, junto. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (um "e se?" no caminho). |
| spire.ascent.8 | 6×6 | Mosaico + Forma | 1 | 8 | Mosaico + Forma: tudo o que a ilha ensinou, junto. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; e por fim: o molde incompleto só tem uma saída; (4 "e se?" no caminho). |

### drums

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| spire.drums.1 | 6×4 | Afinidade + Medida + Tambor | 1~ | 6 | Tambor: a borda esquerda encosta na direita — Afinidade + Medida dando a volta. Ahá: um gargalo: o único caminho que liga as gemas; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz. |
| spire.drums.2 | 8×5 | Contorno + Forma + Tambor | 1 | 7 | Tambor: a borda esquerda encosta na direita — Contorno + Forma dando a volta. Ahá: o molde incompleto só tem uma saída; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde; (2 "e se?" no caminho). |
| spire.drums.3 | 8×5 | Afinidade + Mosaico + Tambor | 1 | 7 | Tambor: a borda esquerda encosta na direita — Afinidade + Mosaico dando a volta. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: um gargalo: o único caminho que liga as gemas. |
| spire.drums.4 | 7×5 | Contorno + Tambor | 1 | 8 | Tambor: a borda esquerda encosta na direita — Contorno dando a volta. Ahá: imagine o ladrilho do outro jeito — uma pista quebraria na hora. |
| spire.drums.5 | 7×5 | Medida + Tambor | 1~ | 9 | Tambor: a borda esquerda encosta na direita — Medida dando a volta. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (6 "e se?" no caminho). |
| spire.drums.6 | 8×6 | Afinidade + Medida + Contorno + Tambor | 1 | 9 | Tambor: a borda esquerda encosta na direita — Afinidade + Medida + Contorno dando a volta. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (8 "e se?" no caminho). |

### mirrors

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| spire.mirrors.1 | 7×7 | Afinidade + Medida + Trama + Espelho | 1 | 6 | Espelho (vertical): cada toque acende também o reflexo, então a resposta é simétrica — Afinidade + Medida + Trama. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas; (um "e se?" no caminho). |
| spire.mirrors.2 | 7×7 | Medida + Afinidade + Mosaico + Espelho | 1 | 6 | Espelho (horizontal): cada toque acende também o reflexo, então a resposta é simétrica — Medida + Afinidade + Mosaico. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: um gargalo: o único caminho que liga as gemas; e por fim: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (2 "e se?" no caminho). |
| spire.mirrors.3 | 6×6 | Mosaico + Afinidade + Espelho | 1 | 7 | Espelho (horizontal): cada toque acende também o reflexo, então a resposta é simétrica — Mosaico + Afinidade. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (um "e se?" no caminho). |
| spire.mirrors.4 | 6×6 | Contorno + Forma + Espelho | 1 | 7 | Espelho (rotação): cada toque acende também o reflexo, então a resposta é simétrica — Contorno + Forma. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída; (2 "e se?" no caminho). |
| spire.mirrors.5 | 7×7 | Forma + Mosaico + Contorno + Espelho | 1 | 7 | Espelho (rotação): cada toque acende também o reflexo, então a resposta é simétrica — Forma + Mosaico + Contorno. Ahá: o molde incompleto só tem uma saída; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde; (4 "e se?" no caminho). |
| spire.mirrors.6 | 6×6 | Contorno + Medida + Espelho | 1 | 8 | Espelho (vertical): cada toque acende também o reflexo, então a resposta é simétrica — Contorno + Medida. Ahá: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (7 "e se?" no caminho). |

### apex

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| spire.apex.1 | 8×8 | Afinidade + Forma + Medida + Contorno + Trama | 1 | 8 | Afinidade + Forma + Medida + Contorno + Trama: tudo o que a ilha ensinou, junto. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (5 "e se?" no caminho). |
| spire.apex.2 | 9×9 | Afinidade + Farol + Mosaico + Contorno + Forma + Gêmeos + Medida + Trama | 1 | 8 | As oito linguagens de uma só vez (Afinidade + Farol + Mosaico + Contorno + Forma + Gêmeos + Medida + Trama). Ahá: só um farol alcança aquela luz — o caminho até ela acende; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde. |
| spire.apex.3 | 8×8 | Gêmeos + Forma + Afinidade + Farol + Contorno + Mosaico | 1 | 9 | Gêmeos + Forma + Afinidade + Farol + Contorno + Mosaico: tudo o que a ilha ensinou, junto. Ahá: um gargalo: o único caminho que liga as gemas; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só um farol alcança aquela luz — o caminho até ela acende; (6 "e se?" no caminho). |
| spire.apex.4 | 7×7 | Afinidade + Contorno + Medida + Mosaico | 1 | 9 | O último painel da Torre — Afinidade + Contorno + Medida + Mosaico: tudo o que a ilha ensinou, junto. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: um gargalo: o único caminho que liga as gemas; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (8 "e se?" no caminho). |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

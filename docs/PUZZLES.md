# Catálogo de puzzles

Gerado por `npm run verify:puzzles`. Cada linha: id, tamanho, linguagens, soluções, dificuldade (1–10) e a percepção ("ahá") que o painel ensina.

## Como os puzzles foram feitos

- **Introduções** (7 por área), o prólogo e a Caverna: feitos à mão, uma ideia nova por painel.
- **Prática / Provação / Maestria**: sequências de 4 painéis, cada sequência explorando UMA percepção, do simples ao difícil. Cada candidato é gerado, minimizado e só é aceito se um *solucionador humano simulado* (`insightPath` em `src/puzzle/solver.ts`) consegue resolvê-lo sem chute: deduções básicas até travar, então UMA percepção nomeada (ex.: "a região só tem uma saída", "duas janelas vizinhas", "só um farol alcança aquela luz", "o gargalo entre as gemas"), e de novo deduções básicas. A nota de cada painel diz quais percepções o caminho realmente usa.
- **Coração**: as obras-primas da área — os candidatos com mais percepções distintas e as maiores cascatas.
- **Cidadela / Torre**: combinações; cada painel é escolhido pela interação entre linguagens no caminho de solução.
- **Afinidade e Gêmeos** aceitam várias soluções (qualquer uma vale), mas o núcleo é forçado: a cor de cada família / o encaixe de cada cópia.
- `soluções`: `1` = única; `1~` = única a menos de trocar luz e sombra (regras cegas à cor); `2`/`3+` = várias.

## O Despertar (8)

### cave

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| prologue.cave.1 | 1×1 | Placa | 1 | 1 | Primeira luz: clicar no ladrilho acende; o selo confirma. |
| prologue.cave.2 | 3×1 | Placa | 1 | 1 | Só o que a placa mostra: acender demais também é errar. |
| prologue.cave.3 | 3×2 | Placa | 1 | 1 | Rebites não mudam — e fazem parte do desenho. |
| prologue.cave.4 | 3×3 | Placa | 1 | 1 | Buracos não têm ladrilho: o desenho contorna o vazio. |
| prologue.cave.5 | 3×3 | Placa | 1 | 2 | Não há placa: a luz que entra pela janela desenha a resposta no chão. |

### shore

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| prologue.shore.1 | 4×4 | Placa | 1 | 2 | O círculo de pedras de pé na praia é o desenho. |

### gate

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| prologue.gate.1 | 3×3 | Placa | 1 | 2 | A placa mostra só as bordas: a luz preenche o que a linha cerca. |
| prologue.gate.2 | 4×4 | Placa | 1 | 3 | Bordas por dentro e por fora: um anel, não um bloco. |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## O Pátio das Nove Luzes (1)

### vault

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| hub.vault | 9×9 | Farol + Forma + Mosaico + Medida + Afinidade + Gêmeos + Contorno + Trama | 1 | 10 | O Cofre Escondido — as oito linguagens da ilha (Farol, Forma, Mosaico, Medida, Afinidade, Gêmeos, Contorno e Trama) num só painel 9×9, solução única, resolvível sem nenhum chute. A resposta desenha um monumento simétrico: dois faróis nos cantos de cima e uma tocha no centro. Percepções, em ordem: (1) os fios da Trama e a conta dos sete faróis acendem as primeiras luzes — mas quase nada se decide só com isso; (2) a barra de três da Forma, lá no canto, só encaixa de um jeito, e esse encaixe destrava de uma vez quase trinta ladrilhos; (3) as famílias de gemas só conseguem se unir por gargalos — quatro cortes, um puxando o outro; (4) por fim, as luas gêmeas: a cópia só cabe de um lado, e a última sombra fecha a simetria. |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## O Bosque Outonal — Afinidade (45)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| kinship.intro.1 | 2×1 | Afinidade | 1~ | 1 | Cores diferentes não podem dividir a mesma região: separar. |
| kinship.intro.2 | 3×1 | Afinidade | 1 | 1 | Cores iguais precisam estar juntas: unir pela luz. |
| kinship.intro.3 | 3×2 | Afinidade | 1~ | 2 | Uma família na luz, a outra na sombra. |
| kinship.intro.4 | 3×3 | Afinidade | 3+~ | 2 | Uma família pode abraçar outra pelos cantos. |
| kinship.intro.5 | 3×3 | Afinidade | 1~ | 3 | Duas famílias no mesmo estado precisam de um fosso — onde mora a terceira. |
| kinship.intro.6 | 4×3 | Afinidade | 1 | 3 | O rebite acende a âmbar; a carmim vira sombra; então a azul só pode ser luz — e o meio, um fosso. |
| kinship.intro.7 | 4×4 | Afinidade | 3+ | 4 | Portão: três famílias, um rebite escuro decide quem é sombra. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| kinship.practice.1 | 5×5 | Afinidade | 3+~ | 3 | seq A1/4 — quem é luz e quem é sombra. Três famílias e duas rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.2 | 5×5 | Afinidade | 3+~ | 4 | seq A2/4 — quem é luz e quem é sombra. Três famílias. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.3 | 5×5 | Afinidade | 3+~ | 4 | seq A3/4 — quem é luz e quem é sombra. Três famílias. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.4 | 5×5 | Afinidade | 3+~ | 5 | seq A4/4 — quem é luz e quem é sombra. Três famílias e duas rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.5 | 5×5 | Afinidade | 3+~ | 3 | seq B1/4 — o gargalo entre as gemas. Três famílias e uma rocha. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.6 | 5×5 | Afinidade | 3+~ | 4 | seq B2/4 — o gargalo entre as gemas. Quatro famílias e duas rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.7 | 5×5 | Afinidade | 3+~ | 4 | seq B3/4 — o gargalo entre as gemas. Três famílias e quatro rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.8 | 5×5 | Afinidade | 3+~ | 5 | seq B4/4 — o gargalo entre as gemas. Três famílias e duas rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.9 | 5×5 | Afinidade | 3+~ | 3 | seq C1/4 — duas famílias na mesma luz precisam de um fosso. Três famílias e uma rocha. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.10 | 5×5 | Afinidade | 3+~ | 4 | seq C2/4 — duas famílias na mesma luz precisam de um fosso. Três famílias. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.11 | 5×5 | Afinidade | 3+~ | 4 | seq C3/4 — duas famílias na mesma luz precisam de um fosso. Três famílias e cinco rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.practice.12 | 5×5 | Afinidade | 3+~ | 5 | seq C4/4 — duas famílias na mesma luz precisam de um fosso. Três famílias e três rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| kinship.trial.1 | 6×6 | Afinidade | 3+ | 5 | seq D1/4 — decidir a cor de cinco famílias. Cinco famílias e três rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.2 | 6×6 | Afinidade | 3+ | 6 | seq D2/4 — decidir a cor de cinco famílias. Cinco famílias e duas rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.3 | 6×6 | Afinidade | 3+ | 6 | seq D3/4 — decidir a cor de cinco famílias. Quatro famílias e quatro rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.4 | 6×6 | Afinidade | 3+ | 7 | seq D4/4 — decidir a cor de cinco famílias. Quatro famílias e cinco rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.5 | 6×6 | Afinidade | 3+ | 5 | seq E1/4 — gargalos em cadeia. Quatro famílias e duas rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.6 | 6×6 | Afinidade | 3+~ | 6 | seq E2/4 — gargalos em cadeia. Quatro famílias e três rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.7 | 6×6 | Afinidade | 3+ | 6 | seq E3/4 — gargalos em cadeia. Quatro famílias e quatro rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.8 | 6×6 | Afinidade | 3+ | 7 | seq E4/4 — gargalos em cadeia. Cinco famílias e duas rochas. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |
| kinship.trial.9 | 6×6 | Afinidade | 3+ | 5 | seq F1/4 — o rebite decide a família. Quatro famílias e cinco rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.10 | 6×6 | Afinidade | 3+ | 6 | seq F2/4 — o rebite decide a família. Quatro famílias e cinco rochas. Ahá: um gargalo: o único caminho que liga as gemas. |
| kinship.trial.11 | 6×6 | Afinidade | 3+ | 6 | seq F3/4 — o rebite decide a família. Cinco famílias e uma rocha. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |
| kinship.trial.12 | 6×6 | Afinidade | 3+ | 7 | seq F4/4 — o rebite decide a família. Quatro famílias e duas rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |

### mastery

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| kinship.mastery.1 | 7×6 | Afinidade | 3+ | 7 | seq G1/4 — cor e caminho ao mesmo tempo. Cinco famílias e três rochas. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |
| kinship.mastery.2 | 7×6 | Afinidade | 3+~ | 7 | seq G2/4 — cor e caminho ao mesmo tempo. Cinco famílias e duas rochas. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.mastery.3 | 7×6 | Afinidade | 3+~ | 8 | seq G3/4 — cor e caminho ao mesmo tempo. Seis famílias. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| kinship.mastery.4 | 7×6 | Afinidade | 3+ | 8 | seq G4/4 — cor e caminho ao mesmo tempo. Seis famílias e cinco rochas. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |
| kinship.mastery.5 | 7×7 | Afinidade | 3+ | 7 | seq H1/4 — seis famílias num bosque apertado. Seis famílias e sete rochas. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |
| kinship.mastery.6 | 7×7 | Afinidade | 3+~ | 7 | seq H2/4 — seis famílias num bosque apertado. Seis famílias e duas rochas. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |
| kinship.mastery.7 | 7×7 | Afinidade | 3+ | 8 | seq H3/4 — seis famílias num bosque apertado. Seis famílias e uma rocha. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |
| kinship.mastery.8 | 7×7 | Afinidade | 3+ | 8 | seq H4/4 — seis famílias num bosque apertado. Seis famílias e quatro rochas. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| kinship.heart.1 | 7×7 | Afinidade | 3+~ | 8 | Obra-prima 1/6. Cinco famílias e uma rocha. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |
| kinship.heart.2 | 7×7 | Afinidade | 3+~ | 8 | Obra-prima 2/6. Cinco famílias e três rochas. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |
| kinship.heart.3 | 7×7 | Afinidade | 3+ | 9 | Obra-prima 3/6. Cinco famílias e três rochas. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |
| kinship.heart.4 | 7×7 | Afinidade | 3+~ | 9 | Obra-prima 4/6. Seis famílias e duas rochas. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |
| kinship.heart.5 | 7×7 | Afinidade | 3+ | 10 | Obra-prima 5/6. Cinco famílias e duas rochas. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |
| kinship.heart.6 | 7×7 | Afinidade | 3+ | 10 | Obra-prima 6/6. Cinco famílias e quatro rochas. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro. |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## Os Terraços — Medida (45)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| measure.intro.1 | 2×1 | Medida | 1~ | 1 | O número conta os ladrilhos da sua região: 1 é estar sozinho. |
| measure.intro.2 | 3×1 | Medida | 1~ | 1 | Uma região de dois — e o terceiro do outro lado. |
| measure.intro.3 | 3×2 | Medida | 3+~ | 2 | Duas regiões de três dividem o painel. |
| measure.intro.4 | 3×3 | Medida | 1~ | 2 | O centro sozinho... e o anel ao redor também é uma região: a escuridão conta. |
| measure.intro.5 | 3×2 | Medida | 2 | 3 | O número pode morar num ladrilho apagado: ele mede a sombra. |
| measure.intro.6 | 3×3 | Medida | 1~ | 3 | Números iguais podem dividir a região; o 7 ao lado mede todo o resto, do outro lado da luz. |
| measure.intro.7 | 4×4 | Medida | 1~ | 4 | Portão: o fundo escuro mede dez; as ilhas de um e de três se recortam nele. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| measure.practice.1 | 5×5 | Medida | 1~ | 3 | seq A1/4 — a região incompleta só tem uma saída. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (um "e se?" no caminho). |
| measure.practice.2 | 5×5 | Medida | 1~ | 4 | seq A2/4 — a região incompleta só tem uma saída. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (2 "e se?" no caminho). |
| measure.practice.3 | 5×5 | Medida | 1~ | 4 | seq A3/4 — a região incompleta só tem uma saída. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (2 "e se?" no caminho). |
| measure.practice.4 | 5×5 | Medida | 1~ | 5 | seq A4/4 — a região incompleta só tem uma saída. O 7 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (2 "e se?" no caminho). |
| measure.practice.5 | 5×5 | Medida | 1~ | 3 | seq B1/4 — a escuridão também é uma região — e o número a mede. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (um "e se?" no caminho). |
| measure.practice.6 | 5×5 | Medida | 1~ | 4 | seq B2/4 — a escuridão também é uma região — e o número a mede. O 11 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (2 "e se?" no caminho). |
| measure.practice.7 | 5×5 | Medida | 1~ | 4 | seq B3/4 — a escuridão também é uma região — e o número a mede. O 7 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (um "e se?" no caminho). |
| measure.practice.8 | 5×5 | Medida | 1~ | 5 | seq B4/4 — a escuridão também é uma região — e o número a mede. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (2 "e se?" no caminho). |
| measure.practice.9 | 5×5 | Medida | 1~ | 3 | seq C1/4 — o espaço que sobra é exatamente o pedido. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (um "e se?" no caminho). |
| measure.practice.10 | 5×5 | Medida | 1~ | 4 | seq C2/4 — o espaço que sobra é exatamente o pedido. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (um "e se?" no caminho). |
| measure.practice.11 | 5×5 | Medida | 1~ | 4 | seq C3/4 — o espaço que sobra é exatamente o pedido. O 8 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; e por fim: um número que não cabe de um lado da luz só pode estar do outro. |
| measure.practice.12 | 5×5 | Medida | 1~ | 5 | seq C4/4 — o espaço que sobra é exatamente o pedido. O 8 mora na sombra: ele mede a escuridão. Ahá: um número que não cabe de um lado da luz só pode estar do outro; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (2 "e se?" no caminho). |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| measure.trial.1 | 6×6 | Medida | 1~ | 5 | seq D1/4 — um número que não cabe na luz mora na sombra. O 12 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz. |
| measure.trial.2 | 6×6 | Medida | 1~ | 6 | seq D2/4 — um número que não cabe na luz mora na sombra. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; (4 "e se?" no caminho). |
| measure.trial.3 | 6×6 | Medida | 1~ | 6 | seq D3/4 — um número que não cabe na luz mora na sombra. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (2 "e se?" no caminho). |
| measure.trial.4 | 6×6 | Medida | 1~ | 7 | seq D4/4 — um número que não cabe na luz mora na sombra. Há números morando na sombra. Ahá: um número que não cabe de um lado da luz só pode estar do outro; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (4 "e se?" no caminho). |
| measure.trial.5 | 6×6 | Medida | 1~ | 5 | seq E1/4 — o fundo escuro inteiro em um só número. O 16 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (3 "e se?" no caminho). |
| measure.trial.6 | 6×6 | Medida | 1~ | 6 | seq E2/4 — o fundo escuro inteiro em um só número. O 14 mora na sombra: ele mede a escuridão. Ahá: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (3 "e se?" no caminho). |
| measure.trial.7 | 6×6 | Medida | 1~ | 6 | seq E3/4 — o fundo escuro inteiro em um só número. O 15 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (4 "e se?" no caminho). |
| measure.trial.8 | 6×6 | Medida | 1~ | 7 | seq E4/4 — o fundo escuro inteiro em um só número. O 13 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (4 "e se?" no caminho). |
| measure.trial.9 | 6×6 | Medida | 1~ | 5 | seq F1/4 — "e se?": imagine a região maior. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (4 "e se?" no caminho). |
| measure.trial.10 | 6×6 | Medida | 1~ | 6 | seq F2/4 — "e se?": imagine a região maior. O 7 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (3 "e se?" no caminho). |
| measure.trial.11 | 6×6 | Medida | 1~ | 6 | seq F3/4 — "e se?": imagine a região maior. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; (3 "e se?" no caminho). |
| measure.trial.12 | 6×6 | Medida | 1~ | 7 | seq F4/4 — "e se?": imagine a região maior. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; e por fim: um número que não cabe de um lado da luz só pode estar do outro; (3 "e se?" no caminho). |

### mastery

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| measure.mastery.1 | 7×7 | Medida | 1~ | 7 | seq G1/4 — saídas e espaços exatos encadeados. O 9 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (5 "e se?" no caminho). |
| measure.mastery.2 | 7×7 | Medida | 1~ | 7 | seq G2/4 — saídas e espaços exatos encadeados. O 10 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (8 "e se?" no caminho). |
| measure.mastery.3 | 7×7 | Medida | 1~ | 8 | seq G3/4 — saídas e espaços exatos encadeados. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (7 "e se?" no caminho). |
| measure.mastery.4 | 7×7 | Medida | 1~ | 8 | seq G4/4 — saídas e espaços exatos encadeados. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; e por fim: um número que não cabe de um lado da luz só pode estar do outro; (7 "e se?" no caminho). |
| measure.mastery.5 | 7×7 | Medida | 1~ | 7 | seq H1/4 — tudo junto: luz, sombra e números que não cabem. O 15 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (4 "e se?" no caminho). |
| measure.mastery.6 | 7×7 | Medida | 1~ | 7 | seq H2/4 — tudo junto: luz, sombra e números que não cabem. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (5 "e se?" no caminho). |
| measure.mastery.7 | 7×7 | Medida | 1~ | 8 | seq H3/4 — tudo junto: luz, sombra e números que não cabem. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; (8 "e se?" no caminho). |
| measure.mastery.8 | 7×7 | Medida | 1~ | 8 | seq H4/4 — tudo junto: luz, sombra e números que não cabem. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; e por fim: um número que não cabe de um lado da luz só pode estar do outro; (6 "e se?" no caminho). |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| measure.heart.1 | 7×7 | Medida | 1~ | 8 | Obra-prima 1/6. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (8 "e se?" no caminho). |
| measure.heart.2 | 7×7 | Medida | 1~ | 8 | Obra-prima 2/6. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (8 "e se?" no caminho). |
| measure.heart.3 | 7×7 | Medida | 1~ | 9 | Obra-prima 3/6. O 8 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (4 "e se?" no caminho). |
| measure.heart.4 | 7×7 | Medida | 1~ | 9 | Obra-prima 4/6. O 11 mora na sombra: ele mede a escuridão. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (6 "e se?" no caminho). |
| measure.heart.5 | 7×7 | Medida | 1~ | 10 | Obra-prima 5/6. Há números morando na sombra. Ahá: um número que não cabe de um lado da luz só pode estar do outro; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (8 "e se?" no caminho). |
| measure.heart.6 | 7×7 | Medida | 1~ | 10 | Obra-prima 6/6. Há números morando na sombra. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; e por fim: um número que não cabe de um lado da luz só pode estar do outro; (6 "e se?" no caminho). |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## A Pedreira — Forma (45)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mold.intro.1 | 3×1 | Forma | 1~ | 1 | A região do molde tem a forma desenhada: um dominó. |
| mold.intro.2 | 2×2 | Forma | 1~ | 1 | Um L de três. |
| mold.intro.3 | 3×2 | Forma | 1~ | 2 | A orientação importa: o T de cabeça para baixo não serve. |
| mold.intro.4 | 3×3 | Forma | 1 | 3 | Os rebites acesos não deixam o quadrado ser luz: o molde se esculpe na sombra. |
| mold.intro.5 | 3×3 | Forma | 1~ | 3 | Duas peças que se encaixam: uma na luz, outra na sombra. |
| mold.intro.6 | 3×3 | Forma | 2~ | 3 | O anel em volta do molde deixa girar: a forma desenhada não cabe, a girada sim. |
| mold.intro.7 | 4×4 | Forma | 1~ | 4 | Portão: a barra, o T e uma pedra sozinha dividem a pedreira — o resto é sombra. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mold.practice.1 | 5×5 | Forma | 1~ | 3 | seq A1/4 — só existe um encaixe. Um molde esculpido na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde. |
| mold.practice.2 | 5×5 | Forma | 1~ | 4 | seq A2/4 — só existe um encaixe. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário). |
| mold.practice.3 | 5×5 | Forma | 1~ | 4 | seq A3/4 — só existe um encaixe. Quatro moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída. |
| mold.practice.4 | 5×5 | Forma | 1~ | 5 | seq A4/4 — só existe um encaixe. Três moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: o molde incompleto só tem uma saída; e por fim: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário). |
| mold.practice.5 | 5×5 | Forma | 1~ | 3 | seq B1/4 — a forma esculpida na sombra. Quatro moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde. |
| mold.practice.6 | 5×5 | Forma | 1~ | 4 | seq B2/4 — a forma esculpida na sombra. Três moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída; (um "e se?" no caminho). |
| mold.practice.7 | 5×5 | Forma | 1~ | 4 | seq B3/4 — a forma esculpida na sombra. Seis moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída. |
| mold.practice.8 | 5×5 | Forma | 1~ | 5 | seq B4/4 — a forma esculpida na sombra. Quatro moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída; (um "e se?" no caminho). |
| mold.practice.9 | 5×5 | Forma | 1~ | 3 | seq C1/4 — a peça incompleta só tem uma saída. Cinco moldes esculpidos na sombra. Ahá: o molde incompleto só tem uma saída; depois: só existe um encaixe para o molde. |
| mold.practice.10 | 5×5 | Forma | 1~ | 4 | seq C2/4 — a peça incompleta só tem uma saída. Dois moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: o molde incompleto só tem uma saída; e por fim: só existe um encaixe para o molde. |
| mold.practice.11 | 5×5 | Forma | 1~ | 4 | seq C3/4 — a peça incompleta só tem uma saída. Um molde esculpido na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída. |
| mold.practice.12 | 5×5 | Forma | 1~ | 5 | seq C4/4 — a peça incompleta só tem uma saída. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída. |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mold.trial.1 | 6×5 | Forma | 1~ | 5 | seq D1/4 — o anel deixa girar — mas só um giro cabe. Um molde que gira. Ahá: o molde incompleto só tem uma saída; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde. |
| mold.trial.2 | 6×5 | Forma | 1~ | 6 | seq D2/4 — o anel deixa girar — mas só um giro cabe. Dois moldes que giram e três moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída. |
| mold.trial.3 | 6×5 | Forma | 1~ | 6 | seq D3/4 — o anel deixa girar — mas só um giro cabe. Dois moldes que giram e seis moldes esculpidos na sombra. Ahá: o molde incompleto só tem uma saída; depois: só existe um encaixe para o molde; e por fim: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); (um "e se?" no caminho). |
| mold.trial.4 | 6×5 | Forma | 1~ | 7 | seq D4/4 — o anel deixa girar — mas só um giro cabe. Um molde que gira e um molde esculpido na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída. |
| mold.trial.5 | 6×5 | Forma | 1~ | 5 | seq E1/4 — na luz o molde não cabe. Seis moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário). |
| mold.trial.6 | 6×5 | Forma | 1~ | 6 | seq E2/4 — na luz o molde não cabe. Um molde que gira e dois moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: o molde incompleto só tem uma saída; e por fim: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário). |
| mold.trial.7 | 6×5 | Forma | 1~ | 6 | seq E3/4 — na luz o molde não cabe. Um molde que gira e seis moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída; (um "e se?" no caminho). |
| mold.trial.8 | 6×5 | Forma | 1~ | 7 | seq E4/4 — na luz o molde não cabe. Dois moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída. |
| mold.trial.9 | 6×6 | Forma | 1~ | 5 | seq F1/4 — um encaixe decide o outro. Um molde que gira e seis moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída. |
| mold.trial.10 | 6×6 | Forma | 1~ | 6 | seq F2/4 — um encaixe decide o outro. Um molde que gira e cinco moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: o molde incompleto só tem uma saída; e por fim: só existe um encaixe para o molde. |
| mold.trial.11 | 6×6 | Forma | 1~ | 6 | seq F3/4 — um encaixe decide o outro. Um molde que gira e quatro moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída. |
| mold.trial.12 | 6×6 | Forma | 1~ | 7 | seq F4/4 — um encaixe decide o outro. Dois moldes que giram e três moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: o molde incompleto só tem uma saída; e por fim: só existe um encaixe para o molde. |

### mastery

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mold.mastery.1 | 6×6 | Forma | 1~ | 7 | seq G1/4 — pentominós que giram, na luz e na sombra. Um molde que gira e oito moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário). |
| mold.mastery.2 | 6×6 | Forma | 1~ | 7 | seq G2/4 — pentominós que giram, na luz e na sombra. Dois moldes que giram e quatro moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída. |
| mold.mastery.3 | 6×6 | Forma | 1~ | 8 | seq G3/4 — pentominós que giram, na luz e na sombra. Um molde que gira e um molde esculpido na sombra. Ahá: só existe um encaixe para o molde; depois: o molde incompleto só tem uma saída; e por fim: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário). |
| mold.mastery.4 | 6×6 | Forma | 1~ | 8 | seq G4/4 — pentominós que giram, na luz e na sombra. Quatro moldes que giram e seis moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída; (um "e se?" no caminho). |
| mold.mastery.5 | 7×6 | Forma | 1~ | 7 | seq H1/4 — a pedreira inteira: encaixe por exclusão. Um molde que gira e nove moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: o molde incompleto só tem uma saída. |
| mold.mastery.6 | 7×6 | Forma | 1~ | 7 | seq H2/4 — a pedreira inteira: encaixe por exclusão. Nove moldes esculpidos na sombra. Ahá: o molde incompleto só tem uma saída; depois: só existe um encaixe para o molde; e por fim: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário). |
| mold.mastery.7 | 7×6 | Forma | 1~ | 8 | seq H3/4 — a pedreira inteira: encaixe por exclusão. Três moldes que giram e três moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída. |
| mold.mastery.8 | 7×6 | Forma | 1~ | 8 | seq H4/4 — a pedreira inteira: encaixe por exclusão. Cinco moldes que giram e cinco moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída; (2 "e se?" no caminho). |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mold.heart.1 | 7×7 | Forma | 1~ | 8 | Obra-prima 1/6. Dois moldes que giram e nove moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída. |
| mold.heart.2 | 7×7 | Forma | 1~ | 8 | Obra-prima 2/6. Quatro moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída. |
| mold.heart.3 | 7×7 | Forma | 1~ | 9 | Obra-prima 3/6. Três moldes que giram e oito moldes esculpidos na sombra. Ahá: o molde incompleto só tem uma saída; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde; (2 "e se?" no caminho). |
| mold.heart.4 | 7×7 | Forma | 1~ | 9 | Obra-prima 4/6. Um molde que gira e cinco moldes esculpidos na sombra. Ahá: só existe um encaixe para o molde; depois: o molde incompleto só tem uma saída; e por fim: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário). |
| mold.heart.5 | 7×7 | Forma | 1~ | 10 | Obra-prima 5/6. Dois moldes que giram e seis moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: o molde incompleto só tem uma saída; e por fim: só existe um encaixe para o molde. |
| mold.heart.6 | 7×7 | Forma | 1~ | 10 | Obra-prima 6/6. Um molde que gira e quatro moldes esculpidos na sombra. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: o molde incompleto só tem uma saída; e por fim: só existe um encaixe para o molde. |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## O Jardim de Sebes — Contorno (45)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| contour.intro.1 | 1×1 | Contorno | 1 | 1 | Quatro lados brilhando: acender o ladrilho sozinho. |
| contour.intro.2 | 2×1 | Contorno | 1 | 1 | Para manter os quatro lados, o vizinho precisa ficar escuro. |
| contour.intro.3 | 3×1 | Contorno | 2 | 2 | Conta-se a borda de luz, não a luz: o próprio ladrilho pode estar apagado. |
| contour.intro.4 | 3×3 | Contorno | 1 | 2 | Zero bordas: igual a todos os vizinhos — a luz do rebite se espalha em cruz. |
| contour.intro.5 | 3×3 | Contorno | 1 | 3 | Fora do painel é escuro: um canto com 3 só pode estar aceso. |
| contour.intro.6 | 4×4 | Contorno | 1 | 4 | Uma corrente: os zeros copiam os vizinhos e cada dedução acende a próxima. |
| contour.intro.7 | 4×4 | Contorno | 1 | 4 | Portão: o 4 é uma ilha, o zero no canto é sombra, os 3 se apoiam na borda. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| contour.practice.1 | 5×5 | Contorno | 1 | 3 | seq A1/4 — o zero copia todos os vizinhos. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.2 | 5×5 | Contorno | 1 | 4 | seq A2/4 — o zero copia todos os vizinhos. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.3 | 5×5 | Contorno | 1 | 4 | seq A3/4 — o zero copia todos os vizinhos. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.4 | 5×5 | Contorno | 1 | 5 | seq A4/4 — o zero copia todos os vizinhos. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.5 | 5×5 | Contorno | 1 | 3 | seq B1/4 — o quatro é uma ilha. Uma ilha de quatro lados. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.6 | 5×5 | Contorno | 1 | 4 | seq B2/4 — o quatro é uma ilha. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.7 | 5×5 | Contorno | 1 | 4 | seq B3/4 — o quatro é uma ilha. Uma ilha de quatro lados. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.8 | 5×5 | Contorno | 1 | 5 | seq B4/4 — o quatro é uma ilha. Uma ilha de quatro lados. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.9 | 5×5 | Contorno | 1 | 3 | seq C1/4 — fora do painel é escuro. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.10 | 5×5 | Contorno | 1 | 4 | seq C2/4 — fora do painel é escuro. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.11 | 5×5 | Contorno | 1 | 4 | seq C3/4 — fora do painel é escuro. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.practice.12 | 5×5 | Contorno | 1 | 5 | seq C4/4 — fora do painel é escuro. Uma ilha de quatro lados. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| contour.trial.1 | 6×6 | Contorno | 1 | 5 | seq D1/4 — "e se?" de um passo. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.2 | 6×6 | Contorno | 1 | 6 | seq D2/4 — "e se?" de um passo. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.3 | 6×6 | Contorno | 1 | 6 | seq D3/4 — "e se?" de um passo. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.4 | 6×6 | Contorno | 1 | 7 | seq D4/4 — "e se?" de um passo. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.5 | 6×6 | Contorno | 1 | 5 | seq E1/4 — pistas esparsas: cada borda conta. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.6 | 6×6 | Contorno | 1 | 6 | seq E2/4 — pistas esparsas: cada borda conta. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.7 | 6×6 | Contorno | 1 | 6 | seq E3/4 — pistas esparsas: cada borda conta. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.8 | 6×6 | Contorno | 1 | 7 | seq E4/4 — pistas esparsas: cada borda conta. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.9 | 6×6 | Contorno | 1 | 5 | seq F1/4 — rochas contam como escuro. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.10 | 6×6 | Contorno | 1 | 6 | seq F2/4 — rochas contam como escuro. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.11 | 6×6 | Contorno | 1 | 6 | seq F3/4 — rochas contam como escuro. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.trial.12 | 6×6 | Contorno | 1 | 7 | seq F4/4 — rochas contam como escuro. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |

### mastery

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| contour.mastery.1 | 7×7 | Contorno | 1 | 7 | seq G1/4 — correntes longas de deduções. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.mastery.2 | 7×7 | Contorno | 1 | 7 | seq G2/4 — correntes longas de deduções. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.mastery.3 | 7×7 | Contorno | 1 | 8 | seq G3/4 — correntes longas de deduções. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.mastery.4 | 7×7 | Contorno | 1 | 8 | seq G4/4 — correntes longas de deduções. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.mastery.5 | 8×7 | Contorno | 1 | 7 | seq H1/4 — o jardim inteiro com poucas placas. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.mastery.6 | 8×7 | Contorno | 1 | 7 | seq H2/4 — o jardim inteiro com poucas placas. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.mastery.7 | 8×7 | Contorno | 1 | 8 | seq H3/4 — o jardim inteiro com poucas placas. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.mastery.8 | 8×7 | Contorno | 1 | 8 | seq H4/4 — o jardim inteiro com poucas placas. Uma ilha de quatro lados e zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| contour.heart.1 | 8×8 | Contorno | 1 | 8 | Obra-prima 1/6. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.heart.2 | 8×8 | Contorno | 1 | 8 | Obra-prima 2/6. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.heart.3 | 8×8 | Contorno | 1 | 9 | Obra-prima 3/6. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.heart.4 | 8×8 | Contorno | 1 | 9 | Obra-prima 4/6. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.heart.5 | 8×8 | Contorno | 1 | 10 | Obra-prima 5/6. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |
| contour.heart.6 | 8×8 | Contorno | 1 | 10 | Obra-prima 6/6. Zeros que copiam os vizinhos. Ahá: imagine o ladrilho aceso — a pista vizinha ganharia bordas demais. |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## O Templo das Areias — Mosaico (45)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mosaic.intro.1 | 1×1 | Mosaico | 1 | 1 | O número conta a si mesmo. |
| mosaic.intro.2 | 3×1 | Mosaico | 1 | 1 | A janela alcança os vizinhos. |
| mosaic.intro.3 | 3×3 | Mosaico | 1 | 1 | Nove: a janela inteira acende. |
| mosaic.intro.4 | 3×3 | Mosaico | 1 | 3 | Nas bordas a janela é cortada: no canto ela tem só quatro ladrilhos. |
| mosaic.intro.5 | 4×4 | Mosaico | 1 | 3 | Zero apaga a janela inteira; o que sobra para os vizinhos fica contado. |
| mosaic.intro.6 | 5×3 | Mosaico | 1 | 3 | Janelas vizinhas dividem colunas: o 3 só pode estar na coluna que o zero não vê. |
| mosaic.intro.7 | 4×4 | Mosaico | 1 | 4 | Portão: janelas quase cheias e um 1 solitário no canto. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mosaic.practice.1 | 5×5 | Mosaico | 1 | 3 | seq A1/4 — janelas de canto e de borda são menores. Um ornamento 5×5 com 7 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.practice.2 | 5×5 | Mosaico | 1 | 4 | seq A2/4 — janelas de canto e de borda são menores. Um ornamento 5×5 com 7 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.practice.3 | 5×5 | Mosaico | 1 | 4 | seq A3/4 — janelas de canto e de borda são menores. Um ornamento 5×5 com 7 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.practice.4 | 5×5 | Mosaico | 1 | 5 | seq A4/4 — janelas de canto e de borda são menores. Um ornamento 5×5 com 8 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (um "e se?" no caminho). |
| mosaic.practice.5 | 6×5 | Mosaico | 1 | 3 | seq B1/4 — zeros apagam, cheios acendem. Um ornamento 6×5 com 8 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.practice.6 | 6×5 | Mosaico | 1 | 4 | seq B2/4 — zeros apagam, cheios acendem. Um ornamento 6×5 com 8 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.practice.7 | 6×5 | Mosaico | 1 | 4 | seq B3/4 — zeros apagam, cheios acendem. Um ornamento 6×5 com 13 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.practice.8 | 6×5 | Mosaico | 1 | 5 | seq B4/4 — zeros apagam, cheios acendem. Um ornamento 6×5 com 8 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.practice.9 | 6×5 | Mosaico | 1 | 3 | seq C1/4 — duas janelas vizinhas: a diferença é uma faixa. Um ornamento 6×5 com 10 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.practice.10 | 6×5 | Mosaico | 1 | 4 | seq C2/4 — duas janelas vizinhas: a diferença é uma faixa. Um ornamento 6×5 com 8 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.practice.11 | 6×5 | Mosaico | 1 | 4 | seq C3/4 — duas janelas vizinhas: a diferença é uma faixa. Um ornamento 6×5 com 12 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.practice.12 | 6×5 | Mosaico | 1 | 5 | seq C4/4 — duas janelas vizinhas: a diferença é uma faixa. Um ornamento 6×5 com 13 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mosaic.trial.1 | 7×6 | Mosaico | 1 | 5 | seq D1/4 — subtrações em cadeia. Um ornamento 7×6 com 12 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.trial.2 | 7×6 | Mosaico | 1 | 6 | seq D2/4 — subtrações em cadeia. Um ornamento 7×6 com 10 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.trial.3 | 7×6 | Mosaico | 1 | 6 | seq D3/4 — subtrações em cadeia. Um ornamento 7×6 com 15 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.trial.4 | 7×6 | Mosaico | 1 | 7 | seq D4/4 — subtrações em cadeia. Um ornamento 7×6 com 15 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.trial.5 | 7×7 | Mosaico | 1 | 5 | seq E1/4 — o ornamento simétrico. Um ornamento 7×7 com 18 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.trial.6 | 7×7 | Mosaico | 1 | 6 | seq E2/4 — o ornamento simétrico. Um ornamento 7×7 com 16 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.trial.7 | 7×7 | Mosaico | 1 | 6 | seq E3/4 — o ornamento simétrico. Um ornamento 7×7 com 18 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.trial.8 | 7×7 | Mosaico | 1 | 7 | seq E4/4 — o ornamento simétrico. Um ornamento 7×7 com 19 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (4 "e se?" no caminho). |
| mosaic.trial.9 | 7×7 | Mosaico | 1 | 5 | seq F1/4 — "e se?": uma janela passaria da conta. Um ornamento 7×7 com 14 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (um "e se?" no caminho). |
| mosaic.trial.10 | 7×7 | Mosaico | 1 | 6 | seq F2/4 — "e se?": uma janela passaria da conta. Um ornamento 7×7 com 16 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (um "e se?" no caminho). |
| mosaic.trial.11 | 7×7 | Mosaico | 1 | 6 | seq F3/4 — "e se?": uma janela passaria da conta. Um ornamento 7×7 com 16 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (3 "e se?" no caminho). |
| mosaic.trial.12 | 7×7 | Mosaico | 1 | 7 | seq F4/4 — "e se?": uma janela passaria da conta. Um ornamento 7×7 com 17 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (4 "e se?" no caminho). |

### mastery

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mosaic.mastery.1 | 8×8 | Mosaico | 1 | 7 | seq G1/4 — a rosácea girada. Um ornamento 8×8 com 21 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.mastery.2 | 8×8 | Mosaico | 1 | 7 | seq G2/4 — a rosácea girada. Um ornamento 8×8 com 22 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.mastery.3 | 8×8 | Mosaico | 1 | 8 | seq G3/4 — a rosácea girada. Um ornamento 8×8 com 22 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.mastery.4 | 8×8 | Mosaico | 1 | 8 | seq G4/4 — a rosácea girada. Um ornamento 8×8 com 23 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (6 "e se?" no caminho). |
| mosaic.mastery.5 | 9×9 | Mosaico | 1 | 7 | seq H1/4 — o grande piso do templo. Um ornamento 9×9 com 25 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.mastery.6 | 9×9 | Mosaico | 1 | 7 | seq H2/4 — o grande piso do templo. Um ornamento 9×9 com 27 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.mastery.7 | 9×9 | Mosaico | 1 | 8 | seq H3/4 — o grande piso do templo. Um ornamento 9×9 com 26 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.mastery.8 | 9×9 | Mosaico | 1 | 8 | seq H4/4 — o grande piso do templo. Um ornamento 9×9 com 27 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (6 "e se?" no caminho). |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| mosaic.heart.1 | 8×8 | Mosaico | 1 | 8 | Obra-prima 1/6. Um ornamento 8×8 com 23 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (2 "e se?" no caminho). |
| mosaic.heart.2 | 8×8 | Mosaico | 1 | 8 | Obra-prima 2/6. Um ornamento 8×8 com 21 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.heart.3 | 8×8 | Mosaico | 1 | 9 | Obra-prima 3/6. Um ornamento 8×8 com 23 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.heart.4 | 8×8 | Mosaico | 1 | 9 | Obra-prima 4/6. Um ornamento 8×8 com 23 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.heart.5 | 8×8 | Mosaico | 1 | 10 | Obra-prima 5/6. Um ornamento 8×8 com 23 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| mosaic.heart.6 | 8×8 | Mosaico | 1 | 10 | Obra-prima 6/6. Um ornamento 8×8 com 22 janelas. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (6 "e se?" no caminho). |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## Os Penhascos dos Faróis — Farol (45)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| beacon.intro.1 | 3×1 | Farol | 1 | 1 | O farol enxerga em linha: três luzes, ele incluído. |
| beacon.intro.2 | 3×1 | Farol | 1 | 1 | Dois: a luz do fim faria o farol ver três. |
| beacon.intro.3 | 3×1 | Farol | 1 | 2 | Toda luz precisa ser vista por um farol: o rebite exige o caminho aceso. |
| beacon.intro.4 | 3×3 | Farol | 1 | 2 | O farol enxerga nas quatro direções retas: a cruz. Os cantos ficam no escuro. |
| beacon.intro.5 | 3×3 | Farol | 1 | 2 | Uma rocha bloqueia o feixe. |
| beacon.intro.6 | 3×1 | Farol | 1 | 2 | Faróis também são luz: um enxerga o outro. |
| beacon.intro.7 | 4×4 | Farol | 1 | 4 | Portão: dois faróis dividem a costa; os feixes se cruzam e contam para os dois. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| beacon.practice.1 | 5×5 | Farol | 1 | 3 | seq A1/4 — toda luz precisa de uma fonte. Três faróis e três rochas. . |
| beacon.practice.2 | 5×5 | Farol | 1 | 4 | seq A2/4 — toda luz precisa de uma fonte. Três faróis e três rochas. . |
| beacon.practice.3 | 5×5 | Farol | 1 | 4 | seq A3/4 — toda luz precisa de uma fonte. Dois faróis e três rochas. . |
| beacon.practice.4 | 5×5 | Farol | 1 | 5 | seq A4/4 — toda luz precisa de uma fonte. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.5 | 5×5 | Farol | 1 | 3 | seq B1/4 — faróis que se enxergam. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.6 | 5×5 | Farol | 1 | 4 | seq B2/4 — faróis que se enxergam. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.7 | 5×5 | Farol | 1 | 4 | seq B3/4 — faróis que se enxergam. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.8 | 5×5 | Farol | 1 | 5 | seq B4/4 — faróis que se enxergam. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.9 | 5×5 | Farol | 1 | 3 | seq C1/4 — as rochas cortam o feixe. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.10 | 5×5 | Farol | 1 | 4 | seq C2/4 — as rochas cortam o feixe. Dois faróis e quatro rochas. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.11 | 5×5 | Farol | 1 | 4 | seq C3/4 — as rochas cortam o feixe. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.practice.12 | 5×5 | Farol | 1 | 5 | seq C4/4 — as rochas cortam o feixe. Três faróis e três rochas. Ahá: imagine uma luz ali — algum farol veria demais. |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| beacon.trial.1 | 6×6 | Farol | 1 | 5 | seq D1/4 — só um farol alcança aquela luz. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende. |
| beacon.trial.2 | 6×6 | Farol | 1 | 6 | seq D2/4 — só um farol alcança aquela luz. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende. |
| beacon.trial.3 | 6×6 | Farol | 1 | 6 | seq D3/4 — só um farol alcança aquela luz. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende. |
| beacon.trial.4 | 6×6 | Farol | 1 | 7 | seq D4/4 — só um farol alcança aquela luz. Quatro faróis e seis rochas. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (um "e se?" no caminho). |
| beacon.trial.5 | 6×6 | Farol | 1 | 5 | seq E1/4 — feixes que se cruzam contam para os dois. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.trial.6 | 6×6 | Farol | 1 | 6 | seq E2/4 — feixes que se cruzam contam para os dois. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.trial.7 | 6×6 | Farol | 1 | 6 | seq E3/4 — feixes que se cruzam contam para os dois. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende. |
| beacon.trial.8 | 6×6 | Farol | 1 | 7 | seq E4/4 — feixes que se cruzam contam para os dois. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende. |
| beacon.trial.9 | 6×6 | Farol | 1 | 5 | seq F1/4 — "e se?": um farol veria demais. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.trial.10 | 6×6 | Farol | 1 | 6 | seq F2/4 — "e se?": um farol veria demais. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.trial.11 | 6×6 | Farol | 1 | 6 | seq F3/4 — "e se?": um farol veria demais. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.trial.12 | 6×6 | Farol | 1 | 7 | seq F4/4 — "e se?": um farol veria demais. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (um "e se?" no caminho). |

### mastery

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| beacon.mastery.1 | 7×7 | Farol | 1 | 7 | seq G1/4 — a costa inteira: fontes, cruzamentos e rochas. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.mastery.2 | 7×7 | Farol | 1 | 7 | seq G2/4 — a costa inteira: fontes, cruzamentos e rochas. Quatro faróis e três rochas. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.mastery.3 | 7×7 | Farol | 1 | 8 | seq G3/4 — a costa inteira: fontes, cruzamentos e rochas. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.mastery.4 | 7×7 | Farol | 1 | 8 | seq G4/4 — a costa inteira: fontes, cruzamentos e rochas. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (um "e se?" no caminho). |
| beacon.mastery.5 | 7×7 | Farol | 1 | 7 | seq H1/4 — faróis que dependem uns dos outros. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.mastery.6 | 7×7 | Farol | 1 | 7 | seq H2/4 — faróis que dependem uns dos outros. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.mastery.7 | 7×7 | Farol | 1 | 8 | seq H3/4 — faróis que dependem uns dos outros. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende. |
| beacon.mastery.8 | 7×7 | Farol | 1 | 8 | seq H4/4 — faróis que dependem uns dos outros. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| beacon.heart.1 | 7×7 | Farol | 1 | 8 | Obra-prima 1/6. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.heart.2 | 7×7 | Farol | 1 | 8 | Obra-prima 2/6. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.heart.3 | 7×7 | Farol | 1 | 9 | Obra-prima 3/6. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.heart.4 | 7×7 | Farol | 1 | 9 | Obra-prima 4/6. Faróis que se enxergam. Ahá: imagine uma luz ali — algum farol veria demais. |
| beacon.heart.5 | 7×7 | Farol | 1 | 10 | Obra-prima 5/6. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende. |
| beacon.heart.6 | 7×7 | Farol | 1 | 10 | Obra-prima 6/6. Faróis que se enxergam. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (4 "e se?" no caminho). |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## O Vale dos Moinhos — Trama (45)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| weave.intro.1 | 3×1 | Trama | 1 | 1 | Um fio de três: três ladrilhos acesos seguidos. |
| weave.intro.2 | 3×1 | Trama | 1 | 1 | As colunas também têm fios: o anel vazio é coluna sem luz. |
| weave.intro.3 | 2×2 | Trama | 1 | 1 | Linhas e colunas se cruzam. |
| weave.intro.4 | 3×3 | Trama | 1 | 2 | Uma cruz tecida. |
| weave.intro.5 | 4×4 | Trama | 1 | 3 | Dois fios separados: entre eles sempre há pelo menos um ladrilho escuro. |
| weave.intro.6 | 5×5 | Trama | 1 | 3 | O desenho é o moinho do vale: as pás em X sobre a torre. |
| weave.intro.7 | 5×5 | Trama | 1 | 4 | Portão: uma chave. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| weave.practice.1 | 6×6 | Trama | 1 | 3 | seq A1/4 — a sequência mais longa de uma linha cobre o meio dela. Uma folha com sua nervura. |
| weave.practice.2 | 7×6 | Trama | 1 | 4 | seq A2/4 — a sequência mais longa de uma linha cobre o meio dela. Um cogumelo à sombra do moinho. |
| weave.practice.3 | 7×7 | Trama | 1 | 4 | seq A3/4 — a sequência mais longa de uma linha cobre o meio dela. Um barco à vela no lago. |
| weave.practice.4 | 7×7 | Trama | 1 | 5 | seq A4/4 — a sequência mais longa de uma linha cobre o meio dela. A âncora do barqueiro. |
| weave.practice.5 | 8×6 | Trama | 1 | 3 | seq B1/4 — sequências separadas: sempre um escuro entre elas. Um peixe no riacho. |
| weave.practice.6 | 7×7 | Trama | 1 | 4 | seq B2/4 — sequências separadas: sempre um escuro entre elas. Uma borboleta sobre a lavanda. |
| weave.practice.7 | 8×8 | Trama | 1 | 4 | seq B3/4 — sequências separadas: sempre um escuro entre elas. Um pássaro em voo. |
| weave.practice.8 | 8×8 | Trama | 1 | 5 | seq B4/4 — sequências separadas: sempre um escuro entre elas. A casa do moleiro. |
| weave.practice.9 | 6×6 | Trama | 1 | 3 | seq C1/4 — tapeçarias simétricas. . |
| weave.practice.10 | 6×6 | Trama | 1 | 4 | seq C2/4 — tapeçarias simétricas. . |
| weave.practice.11 | 6×6 | Trama | 1 | 4 | seq C3/4 — tapeçarias simétricas. . |
| weave.practice.12 | 6×6 | Trama | 1 | 5 | seq C4/4 — tapeçarias simétricas. . |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| weave.trial.1 | 7×7 | Trama | 1 | 5 | seq D1/4 — fios partidos: a sequência não atravessa o buraco. Fios partidos: o sino do vale. |
| weave.trial.2 | 6×8 | Trama | 1 | 6 | seq D2/4 — fios partidos: a sequência não atravessa o buraco. Fios partidos: o farol visto do vale. |
| weave.trial.3 | 7×7 | Trama | 1 | 6 | seq D3/4 — fios partidos: a sequência não atravessa o buraco. Fios partidos: uma flor de lavanda. |
| weave.trial.4 | 8×6 | Trama | 1 | 7 | seq D4/4 — fios partidos: a sequência não atravessa o buraco. Fios partidos: a tartaruga do lago. |
| weave.trial.5 | 8×6 | Trama | 1 | 5 | seq E1/4 — fios partidos em desenhos maiores. Fios partidos: uma coroa — lembrança da Cidadela. |
| weave.trial.6 | 8×8 | Trama | 1 | 6 | seq E2/4 — fios partidos em desenhos maiores. Fios partidos: a árvore do moinho. |
| weave.trial.7 | 8×8 | Trama | 1 | 6 | seq E3/4 — fios partidos em desenhos maiores. Fios partidos: a coruja do celeiro. |
| weave.trial.8 | 8×8 | Trama | 1 | 7 | seq E4/4 — fios partidos em desenhos maiores. Fios partidos: as torres da Cidadela ao longe. |
| weave.trial.9 | 8×8 | Trama | 1 | 5 | seq F1/4 — "e se?": a sequência ali não fecharia. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.trial.10 | 8×8 | Trama | 1 | 6 | seq F2/4 — "e se?": a sequência ali não fecharia. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.trial.11 | 8×8 | Trama | 1 | 6 | seq F3/4 — "e se?": a sequência ali não fecharia. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.trial.12 | 8×8 | Trama | 1 | 7 | seq F4/4 — "e se?": a sequência ali não fecharia. Ahá: imagine a sequência ali — o fio não fecharia. |

### mastery

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| weave.mastery.1 | 9×9 | Trama | 1 | 7 | seq G1/4 — tapeçarias partidas. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.mastery.2 | 9×9 | Trama | 1 | 7 | seq G2/4 — tapeçarias partidas. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.mastery.3 | 9×9 | Trama | 1 | 8 | seq G3/4 — tapeçarias partidas. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.mastery.4 | 9×9 | Trama | 1 | 8 | seq G4/4 — tapeçarias partidas. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.mastery.5 | 10×10 | Trama | 1 | 7 | seq H1/4 — o grande tear: deduções cruzadas. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.mastery.6 | 10×10 | Trama | 1 | 7 | seq H2/4 — o grande tear: deduções cruzadas. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.mastery.7 | 10×10 | Trama | 1 | 8 | seq H3/4 — o grande tear: deduções cruzadas. Ahá: imagine a sequência ali — o fio não fecharia. |
| weave.mastery.8 | 10×10 | Trama | 1 | 8 | seq H4/4 — o grande tear: deduções cruzadas. Ahá: imagine a sequência ali — o fio não fecharia. |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| weave.heart.1 | 9×9 | Trama | 1 | 8 | Obra-prima 1/6. O sol sobre o vale. Ahá: cruzar linhas e colunas até o desenho aparecer. |
| weave.heart.2 | 10×10 | Trama | 1 | 8 | Obra-prima 2/6. O grande pinheiro do vale. Ahá: cruzar linhas e colunas até o desenho aparecer. |
| weave.heart.3 | 10×10 | Trama | 1 | 9 | Obra-prima 3/6. O navio que trouxe os construtores. Ahá: cruzar linhas e colunas até o desenho aparecer. |
| weave.heart.4 | 10×10 | Trama | 1 | 9 | Obra-prima 4/6. O grande moinho. Ahá: cruzar linhas e colunas até o desenho aparecer. |
| weave.heart.5 | 10×10 | Trama | 1 | 10 | Obra-prima 5/6. O mapa da ilha — com o lago no meio. Ahá: cruzar linhas e colunas até o desenho aparecer. |
| weave.heart.6 | 10×10 | Trama | 1 | 10 | Obra-prima 6/6. O emblema dos nove ladrilhos. Ahá: cruzar linhas e colunas até o desenho aparecer. |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## O Lago Espelhado — Gêmeos (45)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| twins.intro.1 | 4×1 | Gêmeos | 3+~ | 1 | Duas regiões separadas com a mesma forma. |
| twins.intro.2 | 5×2 | Gêmeos | 2 | 2 | Copiar o L do outro lado. |
| twins.intro.3 | 5×2 | Gêmeos | 1 | 2 | A sombra pode ser gêmea da luz. |
| twins.intro.4 | 5×2 | Gêmeos | 2 | 3 | Símbolo espelhado: a forma refletida. |
| twins.intro.5 | 5×3 | Gêmeos | 2 | 3 | Dois pares: as cópias precisam se encaixar do outro lado da água. |
| twins.intro.6 | 3×2 | Gêmeos | 1 | 3 | A gêmea pode ser a sobra: a sombra de baixo copia a luz de cima. |
| twins.intro.7 | 5×4 | Gêmeos | 2 | 4 | Portão: um par direto e um par espelhado atravessam o lago. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| twins.practice.1 | 7×4 | Gêmeos | 3+ | 3 | seq A1/4 — a cópia só cabe num lugar. Dois pares atravessam o lago. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra. |
| twins.practice.2 | 7×4 | Gêmeos | 3+ | 4 | seq A2/4 — a cópia só cabe num lugar. Dois pares atravessam o lago. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra. |
| twins.practice.3 | 7×4 | Gêmeos | 3+ | 4 | seq A3/4 — a cópia só cabe num lugar. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.practice.4 | 7×4 | Gêmeos | 3+ | 5 | seq A4/4 — a cópia só cabe num lugar. Dois pares atravessam o lago. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra. |
| twins.practice.5 | 7×4 | Gêmeos | 3+ | 3 | seq B1/4 — a luz pode copiar a sombra. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.practice.6 | 7×4 | Gêmeos | 3+ | 4 | seq B2/4 — a luz pode copiar a sombra. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.practice.7 | 7×4 | Gêmeos | 3+ | 4 | seq B3/4 — a luz pode copiar a sombra. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.practice.8 | 7×4 | Gêmeos | 3+ | 5 | seq B4/4 — a luz pode copiar a sombra. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.practice.9 | 7×4 | Gêmeos | 3+ | 3 | seq C1/4 — o espelho inverte a forma. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.practice.10 | 7×4 | Gêmeos | 2 | 4 | seq C2/4 — o espelho inverte a forma. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.practice.11 | 7×4 | Gêmeos | 3+ | 4 | seq C3/4 — o espelho inverte a forma. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.practice.12 | 7×4 | Gêmeos | 3+ | 5 | seq C4/4 — o espelho inverte a forma. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| twins.trial.1 | 8×5 | Gêmeos | 3+ | 5 | seq D1/4 — três cópias que precisam caber juntas. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.trial.2 | 8×5 | Gêmeos | 3+ | 6 | seq D2/4 — três cópias que precisam caber juntas. Três pares atravessam o lago. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra. |
| twins.trial.3 | 8×5 | Gêmeos | 3+ | 6 | seq D3/4 — três cópias que precisam caber juntas. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.trial.4 | 8×5 | Gêmeos | 3+ | 7 | seq D4/4 — três cópias que precisam caber juntas. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; a luz pode copiar a sombra. |
| twins.trial.5 | 8×5 | Gêmeos | 3+ | 5 | seq E1/4 — o modelo incompleto: a forma também se deduz. Dois pares atravessam o lago. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados. |
| twins.trial.6 | 8×5 | Gêmeos | 3+ | 6 | seq E2/4 — o modelo incompleto: a forma também se deduz. Dois pares atravessam o lago. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados. |
| twins.trial.7 | 8×5 | Gêmeos | 3+ | 6 | seq E3/4 — o modelo incompleto: a forma também se deduz. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; a luz pode copiar a sombra. |
| twins.trial.8 | 8×5 | Gêmeos | 3+ | 7 | seq E4/4 — o modelo incompleto: a forma também se deduz. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; a luz pode copiar a sombra. |
| twins.trial.9 | 8×5 | Gêmeos | 3+ | 5 | seq F1/4 — espelhos e sombras atravessando o lago. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.trial.10 | 8×5 | Gêmeos | 3+ | 6 | seq F2/4 — espelhos e sombras atravessando o lago. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.trial.11 | 8×5 | Gêmeos | 3+ | 6 | seq F3/4 — espelhos e sombras atravessando o lago. Um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma. |
| twins.trial.12 | 8×5 | Gêmeos | 3+ | 7 | seq F4/4 — espelhos e sombras atravessando o lago. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |

### mastery

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| twins.mastery.1 | 9×6 | Gêmeos | 3+ | 7 | seq G1/4 — modelos incompletos e espelhados. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.mastery.2 | 9×6 | Gêmeos | 3+ | 7 | seq G2/4 — modelos incompletos e espelhados. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.mastery.3 | 9×6 | Gêmeos | 3+ | 8 | seq G3/4 — modelos incompletos e espelhados. Um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma. |
| twins.mastery.4 | 9×6 | Gêmeos | 3+ | 8 | seq G4/4 — modelos incompletos e espelhados. Um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma. |
| twins.mastery.5 | 10×6 | Gêmeos | 3+ | 7 | seq H1/4 — o lago inteiro: quatro pares. Quatro pares atravessam o lago. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados. |
| twins.mastery.6 | 10×6 | Gêmeos | 3+ | 7 | seq H2/4 — o lago inteiro: quatro pares. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.mastery.7 | 10×6 | Gêmeos | 3+ | 8 | seq H3/4 — o lago inteiro: quatro pares. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.mastery.8 | 10×6 | Gêmeos | 3+ | 8 | seq H4/4 — o lago inteiro: quatro pares. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| twins.heart.1 | 10×6 | Gêmeos | 3+ | 8 | Obra-prima 1/6. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.heart.2 | 10×6 | Gêmeos | 3+ | 8 | Obra-prima 2/6. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.heart.3 | 10×6 | Gêmeos | 3+ | 9 | Obra-prima 3/6. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.heart.4 | 10×6 | Gêmeos | 3+ | 9 | Obra-prima 4/6. Três pares atravessam o lago. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados. |
| twins.heart.5 | 10×6 | Gêmeos | 3+ | 10 | Obra-prima 5/6. A luz copia a sombra e um par espelhado. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; o símbolo espelhado inverte a forma; a luz pode copiar a sombra. |
| twins.heart.6 | 10×6 | Gêmeos | 3+ | 10 | Obra-prima 6/6. A luz copia a sombra. Ahá: a cópia só cabe num lugar — e o encaixe de uma decide o espaço da outra; o modelo não está todo travado: a forma também se deduz pelos dois lados; a luz pode copiar a sombra. |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## A Cidadela — Todas as linguagens (40)

### gate

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| citadel.gate.1 | 5×5 | Mosaico + Contorno | 1 | 6 | Sem tutorial — Mosaico + Contorno: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga. |
| citadel.gate.2 | 5×5 | Farol + Trama | 1 | 6 | Sem tutorial — Farol + Trama: o que uma linguagem decide, a outra aproveita. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (um "e se?" no caminho). |
| citadel.gate.3 | 5×5 | Contorno + Afinidade | 1 | 6 | Sem tutorial — Contorno + Afinidade: o que uma linguagem decide, a outra aproveita. Ahá: um gargalo: o único caminho que liga as gemas; (3 "e se?" no caminho). |
| citadel.gate.4 | 5×5 | Forma + Gêmeos | 1~ | 7 | Sem tutorial — Forma + Gêmeos: o que uma linguagem decide, a outra aproveita. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída. |
| citadel.gate.5 | 5×5 | Medida + Forma | 1~ | 7 | Sem tutorial — Medida + Forma: o que uma linguagem decide, a outra aproveita. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde. |
| citadel.gate.6 | 5×5 | Medida + Afinidade | 1~ | 7 | Sem tutorial — Medida + Afinidade: o que uma linguagem decide, a outra aproveita. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (2 "e se?" no caminho). |

### court

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| citadel.court.1 | 6×6 | Forma + Trama | 1 | 7 | Sem tutorial — Forma + Trama: o que uma linguagem decide, a outra aproveita. Ahá: o molde incompleto só tem uma saída. |
| citadel.court.2 | 6×6 | Mosaico + Farol | 1 | 7 | Sem tutorial — Mosaico + Farol: o que uma linguagem decide, a outra aproveita. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (2 "e se?" no caminho). |
| citadel.court.3 | 6×6 | Farol + Medida | 1 | 7 | Sem tutorial — Farol + Medida: o que uma linguagem decide, a outra aproveita. Ahá: só um farol alcança aquela luz — o caminho até ela acende; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (2 "e se?" no caminho). |
| citadel.court.4 | 6×6 | Contorno + Gêmeos | 1 | 7 | Sem tutorial — Contorno + Gêmeos: o que uma linguagem decide, a outra aproveita. Ahá: a cópia só cabe num lugar; (4 "e se?" no caminho). |
| citadel.court.5 | 6×6 | Afinidade + Trama | 1 | 7 | Sem tutorial — Afinidade + Trama: o que uma linguagem decide, a outra aproveita. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas. |
| citadel.court.6 | 6×6 | Mosaico + Afinidade | 1 | 8 | Sem tutorial — Mosaico + Afinidade: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: um gargalo: o único caminho que liga as gemas; (3 "e se?" no caminho). |
| citadel.court.7 | 6×6 | Contorno + Medida | 1 | 8 | Sem tutorial — Contorno + Medida: o que uma linguagem decide, a outra aproveita. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (3 "e se?" no caminho). |
| citadel.court.8 | 6×6 | Medida + Gêmeos | 1~ | 8 | Sem tutorial — Medida + Gêmeos: o que uma linguagem decide, a outra aproveita. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: a cópia só cabe num lugar; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (3 "e se?" no caminho). |
| citadel.court.9 | 6×6 | Forma + Mosaico | 1 | 8 | Sem tutorial — Forma + Mosaico: o que uma linguagem decide, a outra aproveita. Ahá: o molde incompleto só tem uma saída; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (4 "e se?" no caminho). |
| citadel.court.10 | 6×6 | Afinidade + Forma | 1~ | 8 | Sem tutorial — Afinidade + Forma: o que uma linguagem decide, a outra aproveita. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas; e por fim: o molde incompleto só tem uma saída. |

### halls

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| citadel.halls.1 | 6×6 | Farol + Contorno + Trama | 1 | 8 | Sem tutorial — Farol + Contorno + Trama: o que uma linguagem decide, a outra aproveita. Ahá: imagine o ladrilho do outro jeito — uma pista quebraria na hora. |
| citadel.halls.2 | 7×6 | Contorno + Forma + Trama | 1 | 8 | Sem tutorial — Contorno + Forma + Trama: o que uma linguagem decide, a outra aproveita. Ahá: só existe um encaixe para o molde. |
| citadel.halls.3 | 7×7 | Medida + Mosaico + Trama | 1 | 8 | Sem tutorial — Medida + Mosaico + Trama: o que uma linguagem decide, a outra aproveita. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali. |
| citadel.halls.4 | 7×7 | Farol + Contorno + Mosaico | 1 | 8 | Sem tutorial — Farol + Contorno + Mosaico: o que uma linguagem decide, a outra aproveita. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (4 "e se?" no caminho). |
| citadel.halls.5 | 7×7 | Afinidade + Gêmeos + Trama | 1 | 8 | Sem tutorial — Afinidade + Gêmeos + Trama: o que uma linguagem decide, a outra aproveita. Ahá: um gargalo: o único caminho que liga as gemas; depois: a cópia só cabe num lugar. |
| citadel.halls.6 | 7×7 | Medida + Mosaico + Contorno | 1 | 8 | Sem tutorial — Medida + Mosaico + Contorno: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (6 "e se?" no caminho). |
| citadel.halls.7 | 7×7 | Afinidade + Farol + Forma | 1 | 8 | Sem tutorial — Afinidade + Farol + Forma: o que uma linguagem decide, a outra aproveita. Ahá: só um farol alcança aquela luz — o caminho até ela acende; depois: um gargalo: o único caminho que liga as gemas; e por fim: só existe um encaixe para o molde. |
| citadel.halls.8 | 7×6 | Afinidade + Contorno + Mosaico | 1 | 9 | Sem tutorial — Afinidade + Contorno + Mosaico: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: um gargalo: o único caminho que liga as gemas; (5 "e se?" no caminho). |
| citadel.halls.9 | 6×6 | Medida + Mosaico + Gêmeos | 1 | 9 | Sem tutorial — Medida + Mosaico + Gêmeos: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; e por fim: a cópia só cabe num lugar; (2 "e se?" no caminho). |
| citadel.halls.10 | 7×6 | Afinidade + Medida + Farol | 1 | 9 | Sem tutorial — Afinidade + Medida + Farol: o que uma linguagem decide, a outra aproveita. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas; e por fim: só um farol alcança aquela luz — o caminho até ela acende; (2 "e se?" no caminho). |
| citadel.halls.11 | 6×6 | Contorno + Afinidade + Medida | 1 | 9 | Sem tutorial — Contorno + Afinidade + Medida: o que uma linguagem decide, a outra aproveita. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (6 "e se?" no caminho). |
| citadel.halls.12 | 7×7 | Contorno + Gêmeos + Forma | 1 | 9 | Sem tutorial — Contorno + Gêmeos + Forma: o que uma linguagem decide, a outra aproveita. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída; (4 "e se?" no caminho). |
| citadel.halls.13 | 7×7 | Medida + Afinidade + Gêmeos | 1~ | 9 | Sem tutorial — Medida + Afinidade + Gêmeos: o que uma linguagem decide, a outra aproveita. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um gargalo: o único caminho que liga as gemas; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (3 "e se?" no caminho). |
| citadel.halls.14 | 6×6 | Forma + Mosaico + Afinidade | 1 | 9 | Sem tutorial — Forma + Mosaico + Afinidade: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: um gargalo: o único caminho que liga as gemas; (um "e se?" no caminho). |

### crown

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| citadel.crown.1 | 7×7 | Forma + Afinidade + Contorno + Trama + Eco | 1 | 9 | Sem tutorial — Forma + Afinidade + Contorno + Trama + Eco: o que uma linguagem decide, a outra aproveita. Ahá: um gargalo: o único caminho que liga as gemas; (um "e se?" no caminho). |
| citadel.crown.2 | 7×7 | Afinidade + Medida + Trama + Eco | 1 | 9 | Sem tutorial — Afinidade + Medida + Trama + Eco: o que uma linguagem decide, a outra aproveita. Ahá: um gargalo: o único caminho que liga as gemas; (6 "e se?" no caminho). |
| citadel.crown.3 | 7×7 | Afinidade + Farol + Contorno + Eco | 1 | 9 | Sem tutorial — Afinidade + Farol + Contorno + Eco: o que uma linguagem decide, a outra aproveita. Ahá: só um farol alcança aquela luz — o caminho até ela acende; depois: um gargalo: o único caminho que liga as gemas. |
| citadel.crown.4 | 7×6 | Contorno + Mosaico + Medida + Eco | 1 | 9 | Sem tutorial — Contorno + Mosaico + Medida + Eco: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (4 "e se?" no caminho). |
| citadel.crown.5 | 7×7 | Afinidade + Farol + Medida + Mosaico + Eco | 1 | 9 | Sem tutorial — Afinidade + Farol + Medida + Mosaico + Eco: o que uma linguagem decide, a outra aproveita. Ahá: só um farol alcança aquela luz — o caminho até ela acende; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: um gargalo: o único caminho que liga as gemas. |
| citadel.crown.6 | 7×6 | Medida + Afinidade + Contorno + Eco | 1 | 10 | Sem tutorial — Medida + Afinidade + Contorno + Eco: o que uma linguagem decide, a outra aproveita. Ahá: um gargalo: o único caminho que liga as gemas; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (3 "e se?" no caminho). |
| citadel.crown.7 | 6×6 | Afinidade + Mosaico + Eco | 1 | 10 | Sem tutorial — Afinidade + Mosaico + Eco: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: um gargalo: o único caminho que liga as gemas; (um "e se?" no caminho). |
| citadel.crown.8 | 7×6 | Forma + Afinidade + Contorno + Eco | 1 | 10 | Sem tutorial — Forma + Afinidade + Contorno + Eco: o que uma linguagem decide, a outra aproveita. Ahá: um gargalo: o único caminho que liga as gemas; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: o molde incompleto só tem uma saída; (um "e se?" no caminho). |
| citadel.crown.9 | 7×7 | Mosaico + Gêmeos + Medida + Eco | 1 | 10 | Sem tutorial — Mosaico + Gêmeos + Medida + Eco: o que uma linguagem decide, a outra aproveita. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: a cópia só cabe num lugar; e por fim: um número que não cabe de um lado da luz só pode estar do outro; (5 "e se?" no caminho). |
| citadel.crown.10 | 7×7 | Forma + Medida + Afinidade + Gêmeos + Eco | 1 | 10 | Sem tutorial — Forma + Medida + Afinidade + Gêmeos + Eco: o que uma linguagem decide, a outra aproveita. Ahá: o molde incompleto só tem uma saída; depois: um gargalo: o único caminho que liga as gemas; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (um "e se?" no caminho). |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## A Caverna Ressonante — Eco (30)

### intro

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| echo.intro.1 | 3×1 | Placa + Eco | 1 | 2 | Tocar um cristal faz os vizinhos marcados ressoarem junto: o do meio acende os três. |
| echo.intro.2 | 3×1 | Placa + Eco | 1 | 3 | Tocar de novo desfaz; a ordem não importa: os três toques deixam só o meio. |
| echo.intro.3 | 3×1 | Placa + Eco | 1 | 3 | O cristal mudo não aceita toque: só os vizinhos o alcançam — e duas ressonâncias se anulam. |
| echo.intro.4 | 3×3 | Placa + Eco | 1 | 3 | Marcas diagonais: o eco salta para os cantos. |
| echo.intro.5 | 3×3 | Placa + Eco | 1 | 5 | Todos ressoam em cruz: acender tudo exige pensar em que toques se somam. |
| echo.intro.6 | 3×3 | Placa + Eco | 1 | 4 | Marcas longas: um toque vira a linha inteira, outro a coluna inteira. |
| echo.intro.7 | 3×3 | Placa + Eco | 1 | 5 | Portão: o centro mudo só acende pelos vizinhos verticais — conte quantas vezes ele ressoa. |

### practice

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| echo.practice.1 | 4×4 | Placa + Eco | 1 | 5 | seq A1/3 — toques que se somam. Ahá: tocar duas vezes desfaz e a ordem não importa — cada cristal é tocado zero ou uma vez. |
| echo.practice.2 | 4×4 | Placa + Eco | 1 | 5 | seq A2/3 — toques que se somam. Ahá: tocar duas vezes desfaz e a ordem não importa — cada cristal é tocado zero ou uma vez. |
| echo.practice.3 | 4×4 | Placa + Eco | 1 | 5 | seq A3/3 — toques que se somam. Ahá: tocar duas vezes desfaz e a ordem não importa — cada cristal é tocado zero ou uma vez. |
| echo.practice.4 | 4×4 | Placa + Eco | 1 | 5 | seq B1/3 — cristais mudos. Ahá: o cristal mudo só mudam pela soma das ressonâncias dos vizinhos. |
| echo.practice.5 | 4×4 | Placa + Eco | 1 | 6 | seq B2/3 — cristais mudos. Ahá: o cristal mudo só mudam pela soma das ressonâncias dos vizinhos. |
| echo.practice.6 | 4×4 | Placa + Eco | 1 | 6 | seq B3/3 — cristais mudos. Ahá: os cristais mudos só mudam pela soma das ressonâncias dos vizinhos. |
| echo.practice.7 | 5×5 | Placa + Eco | 1 | 6 | seq C1/3 — ecos longos de linha e coluna. Ahá: um toque vira a linha inteira — comece pelas linhas que só um cristal alcança. |
| echo.practice.8 | 5×5 | Placa + Eco | 1 | 6 | seq C2/3 — ecos longos de linha e coluna. Ahá: um toque vira a linha inteira — comece pelas linhas que só um cristal alcança. |
| echo.practice.9 | 5×5 | Placa + Eco | 1 | 6 | seq C3/3 — ecos longos de linha e coluna. Ahá: um toque vira a linha inteira — comece pelas linhas que só um cristal alcança. |

### trial

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| echo.trial.1 | 5×5 | Medida + Eco | 1 | 7 | seq D1/3 — eco + Medida: o tamanho pedido tem de ser alcançável. Eco + Medida. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (4 "e se?" no caminho). |
| echo.trial.2 | 5×5 | Medida + Eco | 1 | 7 | seq D2/3 — eco + Medida: o tamanho pedido tem de ser alcançável. Eco + Medida. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (um "e se?" no caminho). |
| echo.trial.3 | 6×5 | Medida + Eco | 1 | 7 | seq D3/3 — eco + Medida: o tamanho pedido tem de ser alcançável. Eco + Medida. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz. |
| echo.trial.4 | 5×5 | Contorno + Eco | 1 | 7 | seq E1/3 — eco + Contorno: bordas que os ecos conseguem desenhar. Eco + Contorno. Ahá: imagine o ladrilho do outro jeito — uma pista quebraria na hora. |
| echo.trial.5 | 5×5 | Contorno + Eco | 1 | 8 | seq E2/3 — eco + Contorno: bordas que os ecos conseguem desenhar. Eco + Contorno. Ahá: imagine o ladrilho do outro jeito — uma pista quebraria na hora. |
| echo.trial.6 | 6×5 | Contorno + Eco | 1 | 8 | seq E3/3 — eco + Contorno: bordas que os ecos conseguem desenhar. Eco + Contorno. Ahá: imagine o ladrilho do outro jeito — uma pista quebraria na hora. |
| echo.trial.7 | 5×5 | Mosaico + Eco | 1 | 8 | seq F1/3 — eco + Mosaico: janelas alcançáveis. Eco + Mosaico. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (4 "e se?" no caminho). |
| echo.trial.8 | 5×5 | Mosaico + Eco | 1 | 8 | seq F2/3 — eco + Mosaico: janelas alcançáveis. Eco + Mosaico. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (3 "e se?" no caminho). |
| echo.trial.9 | 6×5 | Mosaico + Eco | 1 | 8 | seq F3/3 — eco + Mosaico: janelas alcançáveis. Eco + Mosaico. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (4 "e se?" no caminho). |

### heart

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| echo.heart.1 | 6×6 | Mosaico + Contorno + Eco | 1 | 9 | Obra-prima 1/5. Eco + Contorno + Mosaico: a resposta precisa obedecer às regras e ser alcançável pelos ecos. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (5 "e se?" no caminho). |
| echo.heart.2 | 6×6 | Forma + Medida + Eco | 1 | 9 | Obra-prima 2/5. Eco + Medida + Forma: a resposta precisa obedecer às regras e ser alcançável pelos ecos. Ahá: um número que não cabe de um lado da luz só pode estar do outro; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (4 "e se?" no caminho). |
| echo.heart.3 | 6×6 | Contorno + Afinidade + Eco | 1 | 10 | Obra-prima 3/5. Eco + Afinidade + Contorno: a resposta precisa obedecer às regras e ser alcançável pelos ecos. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas; (um "e se?" no caminho). |
| echo.heart.4 | 7×6 | Mosaico + Medida + Eco | 1 | 10 | Obra-prima 4/5. Eco + Mosaico + Medida: a resposta precisa obedecer às regras e ser alcançável pelos ecos. Ahá: um número que não cabe de um lado da luz só pode estar do outro; depois: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; e por fim: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (6 "e se?" no caminho). |
| echo.heart.5 | 7×7 | Afinidade + Contorno + Trama + Eco | 1 | 10 | Obra-prima 5/5. Eco + Afinidade + Contorno + Trama: a resposta precisa obedecer às regras e ser alcançável pelos ecos. Ahá: um gargalo: o único caminho que liga as gemas; (2 "e se?" no caminho). |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

## A Torre do Céu — Tudo (24)

### ascent

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| spire.ascent.1 | 6×6 | Gêmeos + Trama | 1 | 8 | Gêmeos + Trama: tudo o que a ilha ensinou, junto. Ahá: a cópia só cabe num lugar; (2 "e se?" no caminho). |
| spire.ascent.2 | 6×6 | Contorno + Farol | 1 | 8 | Contorno + Farol: tudo o que a ilha ensinou, junto. Ahá: só um farol alcança aquela luz — o caminho até ela acende; (6 "e se?" no caminho). |
| spire.ascent.3 | 7×7 | Forma + Medida + Trama | 1 | 8 | Forma + Medida + Trama: tudo o que a ilha ensinou, junto. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde. |
| spire.ascent.4 | 7×7 | Forma + Farol + Mosaico | 1 | 8 | Forma + Farol + Mosaico: tudo o que a ilha ensinou, junto. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde. |
| spire.ascent.5 | 7×7 | Contorno + Gêmeos + Afinidade | 1 | 9 | Contorno + Gêmeos + Afinidade: tudo o que a ilha ensinou, junto. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: a cópia só cabe num lugar. |
| spire.ascent.6 | 7×7 | Afinidade + Contorno + Medida | 1 | 9 | Afinidade + Contorno + Medida: tudo o que a ilha ensinou, junto. Ahá: um gargalo: o único caminho que liga as gemas; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (5 "e se?" no caminho). |
| spire.ascent.7 | 6×6 | Medida + Afinidade | 1~ | 9 | Medida + Afinidade: tudo o que a ilha ensinou, junto. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (um "e se?" no caminho). |
| spire.ascent.8 | 6×6 | Mosaico + Forma | 1 | 9 | Mosaico + Forma: tudo o que a ilha ensinou, junto. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; e por fim: o molde incompleto só tem uma saída; (4 "e se?" no caminho). |

### drums

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| spire.drums.1 | 6×4 | Afinidade + Medida + Tambor | 1~ | 8 | Tambor: a borda esquerda encosta na direita — Afinidade + Medida dando a volta. Ahá: um gargalo: o único caminho que liga as gemas; depois: um número que não cabe de um lado da luz só pode estar do outro; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz. |
| spire.drums.2 | 7×5 | Medida + Tambor | 1~ | 8 | Tambor: a borda esquerda encosta na direita — Medida dando a volta. Ahá: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; depois: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (6 "e se?" no caminho). |
| spire.drums.3 | 7×5 | Contorno + Tambor | 1 | 8 | Tambor: a borda esquerda encosta na direita — Contorno dando a volta. Ahá: imagine o ladrilho do outro jeito — uma pista quebraria na hora. |
| spire.drums.4 | 8×5 | Contorno + Forma + Tambor | 1 | 9 | Tambor: a borda esquerda encosta na direita — Contorno + Forma dando a volta. Ahá: o molde incompleto só tem uma saída; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde; (2 "e se?" no caminho). |
| spire.drums.5 | 8×5 | Afinidade + Mosaico + Tambor | 1 | 9 | Tambor: a borda esquerda encosta na direita — Afinidade + Mosaico dando a volta. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: um gargalo: o único caminho que liga as gemas. |
| spire.drums.6 | 8×6 | Afinidade + Medida + Contorno + Tambor | 1 | 9 | Tambor: a borda esquerda encosta na direita — Afinidade + Medida + Contorno dando a volta. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (8 "e se?" no caminho). |

### mirrors

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| spire.mirrors.1 | 6×6 | Contorno + Medida + Espelho | 1 | 8 | Espelho (vertical): cada toque acende também o reflexo, então a resposta é simétrica — Contorno + Medida. Ahá: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (7 "e se?" no caminho). |
| spire.mirrors.2 | 6×6 | Mosaico + Afinidade + Espelho | 1 | 8 | Espelho (horizontal): cada toque acende também o reflexo, então a resposta é simétrica — Mosaico + Afinidade. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma família que não consegue se unir de um lado da luz tem de estar do outro; e por fim: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; (um "e se?" no caminho). |
| spire.mirrors.3 | 6×6 | Contorno + Forma + Espelho | 1 | 8 | Espelho (rotação): cada toque acende também o reflexo, então a resposta é simétrica — Contorno + Forma. Ahá: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); depois: só existe um encaixe para o molde; e por fim: o molde incompleto só tem uma saída; (2 "e se?" no caminho). |
| spire.mirrors.4 | 7×7 | Forma + Mosaico + Contorno + Espelho | 1 | 9 | Espelho (rotação): cada toque acende também o reflexo, então a resposta é simétrica — Forma + Mosaico + Contorno. Ahá: o molde incompleto só tem uma saída; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só existe um encaixe para o molde; (4 "e se?" no caminho). |
| spire.mirrors.5 | 7×7 | Afinidade + Medida + Trama + Espelho | 1 | 9 | Espelho (vertical): cada toque acende também o reflexo, então a resposta é simétrica — Afinidade + Medida + Trama. Ahá: uma família que não consegue se unir de um lado da luz tem de estar do outro; depois: um gargalo: o único caminho que liga as gemas; (um "e se?" no caminho). |
| spire.mirrors.6 | 7×7 | Medida + Afinidade + Mosaico + Espelho | 1 | 9 | Espelho (horizontal): cada toque acende também o reflexo, então a resposta é simétrica — Medida + Afinidade + Mosaico. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: um gargalo: o único caminho que liga as gemas; e por fim: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (2 "e se?" no caminho). |

### apex

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|
| spire.apex.1 | 7×7 | Afinidade + Contorno + Medida + Mosaico | 1 | 9 | Afinidade + Contorno + Medida + Mosaico: tudo o que a ilha ensinou, junto. Ahá: duas janelas vizinhas: a diferença mora na faixa que só uma delas enxerga; depois: um gargalo: o único caminho que liga as gemas; e por fim: o espaço que sobra é exatamente o tamanho pedido: tudo nele é da mesma luz; (8 "e se?" no caminho). |
| spire.apex.2 | 8×8 | Gêmeos + Forma + Afinidade + Farol + Contorno + Mosaico | 1 | 9 | Gêmeos + Forma + Afinidade + Farol + Contorno + Mosaico: tudo o que a ilha ensinou, junto. Ahá: um gargalo: o único caminho que liga as gemas; depois: na luz o molde não cabe — ele é esculpido na sombra (ou o contrário); e por fim: só um farol alcança aquela luz — o caminho até ela acende; (6 "e se?" no caminho). |
| spire.apex.3 | 8×8 | Afinidade + Forma + Medida + Contorno + Trama | 1 | 10 | Afinidade + Forma + Medida + Contorno + Trama: tudo o que a ilha ensinou, junto. Ahá: um gargalo: o único caminho que liga as gemas; depois: uma região que ainda precisa crescer tem uma só saída — ela passa por ali; (5 "e se?" no caminho). |
| spire.apex.4 | 9×9 | Afinidade + Mosaico + Farol + Gêmeos + Medida + Contorno + Forma + Trama + Eco | 1 | 10 | O último painel da Torre: as nove linguagens de uma só vez. Ahá: um gargalo: o único caminho que liga as gemas; depois: só um farol alcança aquela luz — o caminho até ela acende; e por fim: só existe um encaixe para o molde. |

### secret

| id | tamanho | linguagens | soluções | dif. | percepção |
|---|---|---|---|---|---|

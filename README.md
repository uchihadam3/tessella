# TESSELLA

**Uma ilha de luz. Nove linguagens. Nenhuma palavra.**

*Uma produção Uchihadam Production.*

Tessella é um jogo de puzzles em primeira pessoa, em 3D, numa ilha silenciosa onde todas as mensagens
foram escritas em luz. Painéis de pedra (as *tesselas*) têm grades de ladrilhos que acendem e apagam;
glifos gravados dizem o que a luz precisa formar. Ninguém explica nada: você aprende cada regra olhando,
tentando e errando. Quando erra, o glifo que quebrou a regra pisca em vermelho.

## Jogar

**Instalar (computador, Android e iPhone):** abra **https://uchihadam3.github.io/tessella/** e escolha
**Instalar o jogo** no menu. No Chrome e no Edge (computador ou Android) aparece o pedido de instalação; no
iPhone e no iPad, pelo Safari, toque em Compartilhar e depois em *Adicionar à Tela de Início*. Instalado, o
TESSELLA abre em tela cheia como um app, funciona sem internet e **se atualiza sozinho**: cada envio para
`main` publica uma versão nova e o jogo instalado a baixa na próxima vez que for aberto com internet. O
progresso nunca se perde numa atualização.

**Offline, sem instalar nada:** baixe o arquivo [`jogar/TESSELLA.html`](jogar/TESSELLA.html) e abra com
dois cliques (Chrome, Edge ou Firefox recentes). O jogo inteiro está nesse único arquivo: código,
música, sons, fontes e imagens.

**Publicação:** o GitHub Pages precisa estar ligado uma vez (Settings → Pages → Source: *GitHub Actions*).
Depois disso, cada envio para `main` testa, gera e publica o jogo automaticamente.

Para jogar a partir do código:

```bash
npm install
```

```bash
npm run dev
```

Depois abra o endereço que aparecer (normalmente `http://localhost:5173`).

### Controles

| Ação | Teclado e mouse | Celular e tablet |
|------|-----------------|------------------|
| Andar | WASD ou setas (Shift corre) | arrastar no lado esquerdo (até o fim corre) |
| Olhar | mouse | arrastar no lado direito |
| Usar um painel | clique quando o ponto vira um anel | tocar no painel |
| Acender/apagar ladrilhos | clique (arraste para pintar vários) | tocar ou arrastar |
| Confirmar | Espaço, Enter ou clicar no Selo | tocar no Selo |
| Desfazer / limpar | Z / R | ↺ / ⟲ (aparecem só dentro do painel) |
| Sair do painel | clique direito, Esc ou Q | ✕ ou tocar fora do painel |
| Diário / mapa / pausa | Tab / M / Esc | emblema no canto da tela |

No celular a tela fica limpa: não há botões enquanto você explora, só um emblema discreto no canto para o
menu. A qualidade gráfica e a resolução se ajustam sozinhas ao aparelho.

O jogo salva sozinho a cada painel resolvido e a cada meio minuto. Há 3 espaços de save e salvamento
manual no menu de pausa. Em **Carregar → Exportar save**, o progresso vira um código de texto (para copiar
e guardar) ou um arquivo `.json`. Em **Importar save**, basta colar o código ou escolher o arquivo. Assim dá
para levar o progresso de um navegador para outro, ou da versão online para o arquivo offline.

## A ilha

| # | Área | Linguagem | Como abre |
|---|------|-----------|-----------|
| 0 | O Despertar (prólogo) | placas de referência | início |
| — | O Pátio das Nove Luzes | Salão das Tesselas (progresso de tudo) | após o prólogo |
| 1 | O Bosque Outonal | Afinidade (gemas) | aberta |
| 2 | Os Terraços | Medida (números) | aberta |
| 3 | A Pedreira | Forma (moldes) | aberta |
| 4 | O Jardim de Sebes | Contorno (lados) | aberta |
| 5 | O Templo das Areias | Mosaico (janelas 3×3) | aberta |
| 6 | Os Penhascos dos Faróis | Farol (visão em linha) | aberta |
| 7 | O Vale dos Moinhos | Trama (fios) | aberta |
| 8 | O Lago Espelhado | Gêmeos (formas iguais) | aberta |
| 9 | A Cidadela | todas as linguagens, sem tutorial | aberta |
| 10 | A Caverna Ressonante | Eco (a nona linguagem) | 7 totens acesos |
| 11 | A Torre do Céu | o final | Cidadela completa |

Cada área de ensino começa ensinando a sua linguagem sem palavras e depois traz sequências cada vez
mais difíceis. Quando todos os painéis de uma área são resolvidos, o **totem** dela acende e dispara um
feixe de luz no céu. O dia avança junto com o seu progresso: começa no amanhecer e chega ao crepúsculo.

### Números

- **463 painéis**: prólogo 8, cada área de ensino 45 (7 de ensino + 38 em sequências de dificuldade
  crescente), Cidadela 40, Caverna 30, Torre do Céu 24, e o Cofre Oculto.
- **150 constelações secretas** escondidas na paisagem, que o jogo nunca ensina.
- **Dois finais**: o final da Torre do Céu e um final secreto.

Todo painel é verificado automaticamente: tem solução e a solução é única onde deve ser. Nos de solução
única, um "solucionador humano" confirma que dá para resolver por raciocínio, sem chute. Um verificador de
acessibilidade confere que todo painel e toda constelação podem ser alcançados e usados.

## Desenvolvimento

```bash
npm run build
```

Gera `dist/index.html`, um arquivo único que roda offline.

```bash
npm test
```

```bash
npm run verify:puzzles
```

- `src/puzzle/rules.ts`: as regras das linguagens, fonte única de verdade.
- `src/data/puzzles/`: todos os painéis, no formato compacto descrito em `src/puzzle/board.ts`.
- `src/data/constellations.ts`: a camada secreta.
- `src/world/`: terreno, céu, água, vegetação e as áreas da ilha.
- `src/audio/`: música generativa e sons, 100% sintetizados com Web Audio.
- `docs/DESIGN.md`, `docs/PUZZLES.md` e `docs/CONSTELLATIONS.md`: design, catálogo de puzzles e notas.

Feito com Three.js, Web Audio e TypeScript.

---

© 2026 Uchihadam Production. Inspirado pelo jeito de ensinar sem palavras de *The Witness* (Thekla, Inc.);
mundo, regras, puzzles, arte e música são originais.

# Hell's Castle

Roguelike de dark fantasy com cartas, grid e linha do tempo. Projeto pessoal, para um jogador, em pixel art 2D, feito em C# para a Unity.

**Estado atual:** protótipo das regras de combate, jogável no navegador (com sala em pixel art, animações e som) e no terminal, coberto por testes. A parte visual na Unity ainda não existe.

## Regras do combate (protótipo)

- **Sem turnos.** Cada ação tem efeito imediato e depois avança o relógio pelo seu custo em tiques. A cada tique, a contagem de todos os inimigos cai 1; quem chega a zero age e anuncia a próxima ação.
- **Nunca recuar.** O jogador anda só para frente ou para os lados (1 tique por casa). Inimigos se movem livremente.
- **Ataques anunciados.** O inimigo marca as casas que vai atingir, e a marca não acompanha o jogador. Sair da casa evita o dano; bloquear mantém a posição.
- **Por um fio.** Sair de uma casa marcada ou bloquear com a contagem em 1 faz a próxima carta custar 1 tique a menos (mínimo 1).
- **Cadeia.** Conta as cartas jogadas desde a última ação de um inimigo. Andar não soma nem quebra.
- **Guardar.** Ação básica fora do deck, sempre disponível: 2 tiques, bloqueia 2.
- **Bloqueio.** Acumula e é consumido inteiro pelo próximo ataque que acertar.
- **Fim da sala.** A porta só abre com todos os inimigos mortos.
- **Mão de 4 cartas**, com dois modos em teste:
  - *Recompor:* cartas jogadas não são repostas; Recompor (2 tiques) completa a mão.
  - *Compra automática:* a cada carta jogada, outra entra na hora.

### Sala de teste

Grid de 5 colunas por 7 fileiras, 20 de vida, deck de 8 cartas.

| Carta | Tiques | Alcance | Efeito |
|---|---|---|---|
| Golpe (×2) | 1 | Casa vizinha (inclusive atrás) | 3 de dano |
| Aparar (×2) | 1 | Você | Bloqueia 4 do próximo ataque |
| Estocada | 2 | Linha de 2 casas à frente | 4 de dano em cada |
| Varredura | 2 | Arco de 3 casas à frente | 2 de dano em cada; com cadeia 2+, 4 |
| Golpe Pesado | 3 | Casa vizinha | 8 de dano; com cadeia 2+, empurra 1 casa |
| Passo Sombrio | 1 | Você | Move até 2 casas, para frente ou para os lados |

| Inimigo | Vida | Comportamento |
|---|---|---|
| Carniçal | 6 | Alterna Avançar (até 2 casas, 2 tiques) e Mordida na casa onde você está (2 tiques, 3 de dano). Só morde se estiver vizinho. |
| Arqueiro de Ossos | 5 | A cada 4 tiques, flecha de 5 de dano na coluna inteira onde você está; no disparo seguinte, na fileira inteira (alterna). Depois se afasta 1 casa, sem nunca ficar atrás de você. |
| Sineiro | 10 | Imóvel, na última fileira. A cada 6 tiques, Badalada de 4 de dano na sala toda, menos nas casas vizinhas a ele. |

Os números são ponto de partida para balancear.

## Estrutura

```
Assets/Scripts/Core/   Regras do jogo em C# puro (sem UnityEngine). É o que a Unity compila.
dotnet/                Projetos .NET que usam a mesma fonte, fora do editor:
  HellsCastle.Core/        compila Assets/Scripts/Core
  HellsCastle.Core.Tests/  testes automáticos (xUnit)
  HellsCastle.Console/     protótipo jogável no terminal
  HellsCastle.Web/         protótipo jogável no navegador (Blazor WebAssembly)
.github/workflows/     publicação da versão de navegador no GitHub Pages
```

As regras ficam separadas da parte visual: dá para testar e balancear o combate sem abrir a Unity.

## Versão de navegador (GitHub Pages)

A cada push na `main`, o workflow `Publicar versão web` roda os testes, compila `dotnet/HellsCastle.Web` e publica o resultado no GitHub Pages. O endereço fica em `https://<usuário>.github.io/<repositório>/`.

Para ativar, uma única vez: no repositório, **Settings > Pages > Build and deployment > Source: GitHub Actions**. Em contas gratuitas, o GitHub Pages só funciona em repositório público.

A sala tem três vistas, escolhidas no topo da tela: 3D em primeira pessoa, 3D por trás do protagonista e 2D de cima. Nas vistas 3D, a de cima fica no canto como minimapa. A cena 3D é desenhada por `wwwroot/js/game3d.js` com three.js, em resolução interna baixa e sem suavização, com os personagens como sprites em pixel art voltados para a câmera. Sem WebGL, o jogo usa só a vista de cima.

A vista de cima é desenhada em canvas por `wwwroot/js/game.js` (sprites, animações, partículas, iluminação e som sintetizado), que também guarda o estado exibido e as animações usados pela cena 3D. As regras continuam no C#: a cada ação, a página envia ao desenho um retrato do estado e a lista de eventos (`Combat.Events`) para animar. A arte fica em `wwwroot/js/sprites.js`, como grades de 16×16 caracteres com uma paleta; para trocar um sprite, basta editar a grade.

Na tela: toque numa casa vizinha destacada para andar; toque numa carta e depois na casa destacada para jogá-la. As casas podem ser tocadas tanto na cena 3D quanto no minimapa. No teclado: `W` `A` `D` andam, `1` a `4` escolhem a carta, `G` guarda, `R` recompõe, `Esc` cancela. O botão de modo de mão no topo reinicia o combate com a mesma semente no outro modo.

Para rodar localmente (requer o .NET SDK 10):

```
dotnet run --project dotnet/HellsCastle.Web
```

Créditos: a fonte é a [Jersey 15](https://github.com/scfried/soft-type-jersey), sob a SIL Open Font License 1.1 (texto em `dotnet/HellsCastle.Web/wwwroot/fonts/Jersey15-OFL.txt`). A cena 3D usa a biblioteca [three.js](https://threejs.org/) r170, sob licença MIT (texto em `dotnet/HellsCastle.Web/wwwroot/js/three.LICENSE.txt`). Os sprites, as texturas e os sons são originais deste projeto.

## Como rodar no terminal

Requer o [.NET SDK 10](https://dotnet.microsoft.com/download). No PowerShell ou CMD, na pasta do repositório:

```
dotnet run --project dotnet/HellsCastle.Console
```

Opções: `--mao recompor` ou `--mao auto` escolhe o modo de mão; `--semente N` repete a mesma ordem de cartas.

```
dotnet run --project dotnet/HellsCastle.Console -- --mao auto --semente 7
```

Comandos durante o combate:

| Comando | Ação |
|---|---|
| `w` `a` `d` | Anda para frente, esquerda, direita |
| `2` | Joga a carta 2 da mão |
| `1 w` | Joga a carta 1 na direção indicada (`w` frente, `a` esquerda, `d` direita, `s` trás) |
| `3 wd` | Passo Sombrio com caminho de até 2 passos |
| `r` | Recompor |
| `g` | Guardar |
| `q` | Sair |

No mapa, `@` é você e o número ao lado de cada casa mostra em quantos tiques ela será atingida.

## Como rodar os testes

```
dotnet test dotnet/HellsCastle.sln
```

## Como abrir na Unity

O repositório ainda não tem `ProjectSettings/` nem `Packages/`; eles são criados pelo editor.

1. No Unity Hub, use **Add > Add project from disk** e escolha a pasta do repositório.
2. Escolha a versão do editor (Unity 2021.3 LTS ou mais nova) e abra.
3. Faça commit das pastas `ProjectSettings/` e `Packages/` e dos arquivos `.meta` que a Unity criar em `Assets/`.

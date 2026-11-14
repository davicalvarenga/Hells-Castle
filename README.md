# Hell's Castle: Expediente Sombrio

Protótipo 100% jogável no navegador (inspirado em **Vampire Crawlers**), com estética **2.5D Pixel Art em Primeira Pessoa** e tema **"Walter Mitty Corporativo + Dark Fantasy"**.

Você interpreta um funcionário comum que, para sobreviver ao tédio e estresse do escritório, alucina todo o ambiente como uma masmorra sombria cheia de goblins estagiários, harpias fofoqueiras e o temível **Lich das Planilhas**.

## Jogar no GitHub Pages

O protótipo estático fica na pasta `/docs` e é publicado automaticamente pelo workflow [.github/workflows/pages.yml](.github/workflows/pages.yml):

`https://davicalvarenga.github.io/Hells-Castle/`

Para abrir localmente, basta servir a pasta `/docs` (por exemplo com `python -m http.server 8080 --directory docs`) ou abrir `docs/index.html` diretamente no navegador.

## Mecânicas

- **Exploração em Grid 2.5D:** Use `WASD` / `Setas` ou os botões grandes na interface inferior para andar pelas baias, copa, sala de reunião e ala da diretoria, com minimapa 2D em tempo real no canto da tela.
- **Status Corporativos:**
  - **Sanidade (HP):** 60/60 inicial.
  - **Cafeína (Mana):** 3/3 inicial, regenera todo turno.
  - **Horas Extras (XP):** Barra no topo da tela; ao encher, abre o modal de **Level Up (1 de 3 recompensas)**.
  - **VR (Vale-Refeição):** Ouro obtido em baús, combates e bônus de *Overkill*.
- **Combate Deckbuilder Turbo:**
  - **Mordida de Ferro** *(Grampeador Pesado)* — Custo 1 — 15 de dano em 1 alvo.
  - **Poção de Fogo Líquido** *(Café Pelando)* — Custo 1 — 10 de dano em TODOS os inimigos.
  - **Chicote de Dados** *(Cabo de Rede Cat6)* — Custo 2 — 12 de dano em TODOS + 50% de chance de Knockback em cada inimigo.
  - **Escudo Burocrático** *(Responder 'Por E-mail')* — Custo 1 — +8 de Escudo + Knockback em 1 inimigo.
  - **Combo (`x1`, `x2`, `x3`...)**: cada carta jogada no mesmo turno dá +25% de dano à próxima (teto de 2.5x).
  - **Knockback justo:** quem perde o turno atordoado fica `[IMUNE 1t]` no turno seguinte; chefes são imunes. O Escudo expira no início de cada turno do jogador.
- **Encontros e Patrulha:** o combate começa à distância (inimigo a 1–2 tiles na linha de visão, com alerta `!`); a cada 2 passos os encontros próximos avançam 1 casa na sua direção (visível no minimapa) e, se encostarem pelo lado ou por trás, causam uma **EMBOSCADA** (4 de dano antes do Turno 1).
- **Economia:** Máquina de Café com Café Expresso (25 VR), Relíquias (45 VR) e Aliados (65 VR, máximo de 2 ativos).
  - **Jogar Tudo (`Espaço`)** e **Encerrar Turno (`Enter`)**, além de números flutuantes, flash de impacto, banner **OVERKILL!**, partículas de XP voadoras e áudio retrô via Web Audio API (com botão de Mute).

## Créditos

- Fonte pixelada [Jersey 15](https://github.com/scfried/soft-type-jersey) (SIL Open Font License 1.1 em `docs/fonts/Jersey15-OFL.txt`).
- Renderização 3D via [three.js](https://threejs.org/) r170 (MIT License em `docs/js/three.LICENSE.txt`).
- Sprites em pixel art, texturas e efeitos sonoros gerados proceduralmente via Canvas 2D e Web Audio API.

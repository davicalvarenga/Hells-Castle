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
  - **Chicote de Dados** *(Cabo de Rede Cat6)* — Custo 2 — 12 de dano em TODOS + Knockback (atordoa).
  - **Escudo Burocrático** *(Responder 'Por E-mail')* — Custo 1 — +8 de Escudo + Knockback em 1 inimigo.
  - **Combo Multiplicador (`x1`, `x2`, `x3`...)**: cada carta jogada no mesmo turno aumenta o dano da próxima carta.
  - **Jogar Tudo (`Espaço`)** e **Encerrar Turno (`Enter`)**, além de números flutuantes, flash de impacto, banner **OVERKILL!**, partículas de XP voadoras e áudio retrô via Web Audio API (com botão de Mute).

## Créditos

- Fonte pixelada [Jersey 15](https://github.com/scfried/soft-type-jersey) (SIL Open Font License 1.1 em `docs/fonts/Jersey15-OFL.txt`).
- Renderização 3D via [three.js](https://threejs.org/) r170 (MIT License em `docs/js/three.LICENSE.txt`).
- Sprites em pixel art, texturas e efeitos sonoros gerados proceduralmente via Canvas 2D e Web Audio API.

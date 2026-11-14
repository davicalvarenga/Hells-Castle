# Hell's Castle: Expediente Sombrio

Protótipo 100% jogável no navegador (inspirado em **Vampire Crawlers**), com estética **2.5D Pixel Art em Primeira Pessoa** e tema **"Walter Mitty Corporativo + Dark Fantasy"**.

Você interpreta Valter Motta, um analista comum que, entre uma tarefa e outra, devaneia: a impressora vira uma praia ao crepúsculo, o corredor vira uma cidade gótica, a sala de reunião vira um pico nevado — até o relógio de ponto marcar 18:00.

## Jogar no GitHub Pages

O protótipo estático fica na pasta `/docs` e é publicado automaticamente pelo workflow [.github/workflows/pages.yml](.github/workflows/pages.yml):

`https://davicalvarenga.github.io/Hells-Castle/`

Para abrir localmente, basta servir a pasta `/docs` (por exemplo com `python -m http.server 8080 --directory docs`) ou abrir `docs/index.html` diretamente no navegador.

## Campanha: "Entre Uma Reunião e Outra"

Valter Motta enfrenta sozinho cinco devaneios ao longo de um dia de trabalho. Cada fase é um bioma 3D próprio, aberto por um card narrativo com o gatilho real do escritório:

| Fase | Relógio | Bioma | Chefe |
| --- | --- | --- | --- |
| 1 | 08:17 | Praia do Crepúsculo | Devorador das Marés (coloca "Folha Presa" na mão) |
| 2 | 11:30 | Cidade Gótica Amaldiçoada | Mensageiro do Sino Veloz (ataca 2x por turno) |
| 3 | 14:45 | Pico Nevado | Estrategista do Véu Branco (Escudo de Cristal todo turno) |
| 4 | 17:15 | Dungeon do Arquivo | Guardiã das Catacumbas (invoca; entrega a "Foto no Parque") |
| 5 | 17:55 | O Abismo Estrelado | O Senhor das Horas (drena Cafeína se não for bloqueado) |

## Mecânicas

- **Exploração em Grid 2.5D:** `WASD` / `Setas` / `Q` `E` ou os botões na tela, com minimapa em tempo real. Mapas 9x9 abertos, sem corredores estreitos.
- **Encontros e Patrulha:** o combate começa à distância (inimigo a 1–2 tiles na linha de visão, com alerta `!`); a cada 2 passos os encontros próximos avançam 1 casa e, se encostarem pelo lado ou por trás, causam uma **EMBOSCADA** (4 de dano antes do Turno 1).
- **Status:** Sanidade (HP, teto 75), Cafeína (3 por turno; 4 com o Cálice Duplo, 5 só com relíquia rara), Horas Extras (XP) e VR.
- **Combate por cartas:** Combo de +25% por carta jogada no turno (teto 2.5x), Knockback com imunidade de 1 turno após o atordoamento, Escudo que expira no início do turno do jogador, **Jogar Tudo** (`Espaço`) e **Fim do Turno** (`Enter`).
- **Ponto de Pausa (fogueira de cada bioma):** gaste VR para recuperar Sanidade (25), remover 1 carta do baralho (30, 1 vez por fase) ou comprar 1 Relíquia de Evolução (45, 1 por fase).
- **Fila única de modais:** level ups, pausas, eventos e cards narrativos nunca abrem ao mesmo tempo; o jogo só volta ao fluxo quando a fila zera.
- **Celular:** layout dedicado em retrato (`100dvh`, sem scroll), com cartas e botões dimensionados para toque.
- **Modo Planilha:** tecla `P` ou o botão no canto superior direito.

## Créditos

- Fonte pixelada [Jersey 15](https://github.com/scfried/soft-type-jersey) (SIL Open Font License 1.1 em `docs/fonts/Jersey15-OFL.txt`).
- Renderização 3D via [three.js](https://threejs.org/) r170 (MIT License em `docs/js/three.LICENSE.txt`).
- Sprites em pixel art, texturas e efeitos sonoros gerados proceduralmente via Canvas 2D e Web Audio API.

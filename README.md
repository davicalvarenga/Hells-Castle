# Hell's Castle: Expediente Sombrio

Protótipo 100% jogável no navegador (inspirado em **Vampire Crawlers**), com estética **2.5D Pixel Art em Primeira Pessoa** e tema **"Walter Mitty Corporativo + Dark Fantasy"**.

Você interpreta Valter Motta, um analista comum que, entre uma tarefa e outra, devaneia: a impressora vira uma praia ao crepúsculo, o corredor vira uma cidade gótica, a sala de reunião vira um pico nevado — até o relógio de ponto marcar 18:00.

## Jogar no GitHub Pages

O protótipo estático fica na pasta `/docs` e é publicado automaticamente pelo workflow [.github/workflows/pages.yml](.github/workflows/pages.yml):

`https://davicalvarenga.github.io/Hells-Castle/`

Para abrir localmente, basta servir a pasta `/docs` (por exemplo com `python -m http.server 8080 --directory docs`) ou abrir `docs/index.html` diretamente no navegador.

## Campanha: "Entre Uma Reunião e Outra"

Valter Motta enfrenta sozinho cinco devaneios ao longo de um dia de trabalho. Cada Bioma 3D é aberto por um card narrativo com o gatilho real do escritório e dividido em **3 Partes** (15 setores no total), com o Relógio de Ponto avançando de 08:17 até 18:00:

| Bioma | Parte 1/3 (Entrada) | Parte 2/3 (Coração) | Parte 3/3 (Domínio do Chefe) | Chefe |
| --- | --- | --- | --- | --- |
| Praia do Crepúsculo | 08:17 Arrebentação | 09:05 Maré Crescente | 09:50 Covil das Marés | Devorador das Marés (coloca "Folha Presa" na mão) |
| Cidade Gótica Amaldiçoada | 10:40 Ruelas Encharcadas | 11:30 Praça do Sino | 12:15 Torre do Mensageiro | Mensageiro do Sino Veloz (ataca 2x por turno) |
| Pico Nevado | 13:20 Trilha Gelada | 14:05 Desfiladeiro Branco | 14:45 Cume do Véu | Estrategista do Véu Branco (Escudo de Cristal todo turno) |
| Dungeon do Arquivo | 15:30 Arquivo Morto | 16:10 Catacumbas do RH | 16:50 Cripta da Guardiã | Guardiã das Catacumbas (invoca; entrega a "Foto no Parque") |
| O Abismo Estrelado | 17:15 Beira do Vazio | 17:35 Mar de Estrelas | 17:55 Trono das Horas | O Senhor das Horas (drena Cafeína se não for bloqueado) |

- **Parte 1/3 (Entrada):** mapa procedural com 3 encontros comuns, 1 Baú, 1 Evento `?` e o Portal `E` na sala mais distante do início.
- **Parte 2/3 (Coração):** 3 encontros mais fortes, 1 Elite (com baú de recompensa), 1 Ponto de Pausa `M`, 1 evento especial (Poço, Baú de Prata ou Oferenda) e o Portal `E`.
- **Parte 3/3 (Domínio do Chefe):** mapa menor (9x9) com 1 ou 2 guardas, o Ponto de Pausa final e a arena do Chefe `B`. Só derrotá-lo dá a Carta Assinatura e libera a saída para o próximo Bioma.
- Entre as Partes a transição é rápida: um aviso de 1 linha no topo (sem card), +15 de Sanidade de respiro, a neblina fica mais densa e a luz mais baixa a cada Parte. A HUD mostra `PRAIA · PARTE 2/3` e o nome do setor.
- No Abismo, as Partes 1 e 2 trazem **Ecos** reforçados de inimigos dos devaneios anteriores; a Parte 3 é só o Senhor das Horas.

## Continuar Expediente (run salva)

A run em andamento é salva automaticamente no navegador (`localStorage`, chave `hc_active_run_v1`) ao terminar um combate, ao fechar a fogueira ou qualquer modal e ao trocar de Parte ou Bioma. Na Recepção aparece **CONTINUAR EXPEDIENTE**, com Bioma, Parte, Nível e Sanidade salvos. **NOVO EXPEDIENTE** pede um segundo toque antes de sobrescrever a run salva. A run salva é apagada ao vencer às 18:00, ao sofrer Burnout ou ao usar **DESISTIR** (no Manual `?`, com confirmação). O Tutorial e a Hora Extra Infinita não gravam run.

## Mecânicas

- **Exploração em Grid 2.5D:** `WASD` / `Setas` / `Q` `E` ou os botões na tela, com minimapa em tempo real. Mapas 9x9 abertos, sem corredores estreitos.
- **Encontros e Patrulha:** o combate começa à distância (inimigo a 1–2 tiles na linha de visão, com alerta `!`); a cada 2 passos os encontros próximos avançam 1 casa e, se encostarem pelo lado ou por trás, causam uma **EMBOSCADA** (4 de dano antes do Turno 1).
- **Status:** Sanidade (HP, teto 75), Cafeína (3 por turno; 4 com o Cálice Duplo, 5 só com relíquia rara), Horas Extras (XP) e VR.
- **Combate por cartas:** Combo de +25% por carta jogada no turno (teto 2.5x), Knockback com imunidade de 1 turno após o atordoamento, Escudo que expira no início do turno do jogador, **Jogar Tudo** (`Espaço`) e **Fim do Turno** (`Enter`).
- **Ponto de Pausa (fogueira de cada bioma):** gaste VR para recuperar Sanidade (25), remover 1 carta do baralho (30, 1 vez por fase) ou comprar 1 Relíquia de Evolução (45, 1 por fase).
- **Fila única de modais:** level ups, pausas, eventos e cards narrativos nunca abrem ao mesmo tempo; o jogo só volta ao fluxo quando a fila zera.
- **Celular:** layout dedicado em retrato (`100dvh`, sem scroll), com cartas e botões dimensionados para toque.
- **Modo Planilha:** tecla `P` ou o botão no canto superior direito.

## Combo e Evolução na HUD

- **Escada de combo:** cada carta encadeada custa exatamente 1 a mais que a anterior (0 → 1 → 2 → 3). **Wild** sempre comba e, depois dela, a próxima pode custar **0 ou 1** (Wild → 1 → 2 funciona).
- **Destaque na mão:** toda carta que continua a cadeia ganha borda dourada pulsante e o selo **COMBO xN!** antes do clique; no início da cadeia, Wild e custo 0 mostram **▶ INICIA**. Os números que crescem com o combo (projéteis, dano, escudo...) aparecem em dourado na descrição.
- **Evolução (estilo Vampire Survivors):** cartas que evoluem mostram o selo **EVO** com o que falta (Relíquia e/ou Nível MÁX); com tudo pronto, brilham **PRONTA P/ EVOLUIR!** (ou **PRONTA P/ FUSÃO!**).
- **Ilustrações:** as Fases 2 a 5 abrem com uma ilustração 16:9 animada (Ken Burns + partículas) e a vitória das 18:00 mostra a volta para casa (`docs/assets/intro/transicao_*.png` e `epilogo_18h.png`), com fundo de reserva se alguma imagem faltar.

## Polimento e Rejogabilidade

- **Prévia de mira:** passe o mouse (ou segure o toque) numa carta de ataque: as colunas atingidas acendem no chão em perspectiva, a barra de vida mostra o dano previsto e **LETAL!** pulsa sobre quem morre com o dano garantido (sem críticos). Mira aleatória mostra só os alvos possíveis.
- **Música procedural:** a exploração fica só com o ambiente; o combate ganha uma batida chiptune discreta e os chefes um tema mais rápido. Respeita o Mudo, o abafamento da cutscene e o 1º clique.
- **Falas dos chefes:** ao cruzar 66% e 33% de vida, cada chefe solta uma linha que mistura o devaneio com o escritório.
- **Segredos:** estilhaçar 3 cartas numa mesma run atrai **O Trapaceiro do Subconsciente** (Gema Lendária + 50 VR); vencer o Senhor das Horas carregando a Foto no Parque revela o final **18:00 — A Decisão**, salvo como conquista.
- **Níveis de Pressão:** depois da 1ª vitória, a Recepção libera os níveis 1 a 5 (cada vitória libera o próximo), cumulativos: +15% de HP inimigo; 1 carta-lixo no baralho; chefes com +15% de ATK e +4 de Escudo; fogueira 25% mais cara e cura 25% menor. Em troca, +20% a +100% de crédito persistente.

## Arsenal, Gemas e Eventos de Mapa

- **Custo X:** *Explosão Total* gasta toda a Cafeína e multiplica o dano por X (X também é o degrau dela na escada de combo).
- **Wild puras:** *Asas do Devaneio* (custo 4; a próxima carta custa 1 a menos), *Amuleto do Elo* (+1 Combo extra), *Pulseira de Contas* (projéteis) e *Parmégide* (Escudo x Combo).
- **Tomos de Mana:** *Despertar* (0→1), *Vigília* (1→2) e *Madrugada* (2→3) devolvem `custo + 1` de Cafeína; a *Canção da Cafeteira* cria uma *Cafeína Pura* temporária (0 Wild, +3 Cafeína, Destroy).
- **Pickups de baú:** 50% de chance de 1 carta `0 Wild [Destroy]` de uso único, sempre à mão até ser usada: *Ampulheta Parada* (congela a linha de frente), *Rosário* (30 de dano na frente), *Saco de Moedas* (+25 VR) e *Coraçãozinho* (+5 Sanidade). O **Jogar Tudo** só gasta sozinho as moedas e a cura.
- **Mecânicas únicas:** *Selo do Eclipse → Prisma do Eclipse* (barateia a cada descarte e apaga inimigos comuns), *Anel de Trovões* (dispara de novo no fim do turno), *Orvalho Ardente → Lago de Brasas* (Burn persistente na coluna) e a fusão *Lâmina do Devaneio (MÁX) + Sopro de Brasas (MÁX) → Gládio da Aurora*.
- **Gemas avançadas (25 no total, com raridade e exclusões):** Eco, Cópia, Ímã, Bombardeio, Dizimar, Quebra-Combo, Troca, Ataque de Armadura, Yin Yang, Pós-Vida, Inquebrável e À Prova de Fogo.
- **Rachadura:** carta comum usada mais de 5 vezes no mesmo combate fica **Rachada**; usada além do limite de novo, tem 25% de chance de estilhaçar e sair do baralho. *Inquebrável*, *À Prova de Fogo* ou **Reparar Rachaduras** na fogueira (20 VR) resolvem.
- **Eventos de mapa:** **Baú de Prata** (pede 2 cartas de tipos específicos; dá Gema Épica/Lendária ou Arcana extra), **Mesa de Oferenda** (sacrifique 1 carta por +1 Slot de Gema em outra, ou por 20 VR) e **Poço dos Desejos** (Gema rara ou Arcana extra, uso único).

## Primeira Visita: Intro, Tutorial e Manual

- **Cutscene "08h17 — Da Planilha à Praia":** 5 ilustrações em pixel art (`docs/assets/intro/cena1.png` a `cena5.png`) num palco 16:9 com animação por cena (Ken Burns, tremor, zoom com vinheta, transmutação de cor e pan), partículas em canvas por cima e texto digitado. O som do escritório fica abafado na cena "O Desligamento" antes de entrar o mar (só após o 1º clique e respeitando o Mudo). Se uma imagem falhar, a cena usa um fundo de reserva. Abre sozinha na 1ª visita (`introSeen` no `localStorage`), tem **Pular** sempre visível e pode ser revista pelo botão **Rever Intro** da Recepção. No fim, escolha **Tutorial Guiado (Recomendado)** ou **Ir Direto para o Expediente**.
- **Tutorial guiado:** mini-praia roteirizada em 4 passos (exploração e aggro; 5 colunas e combo 0→1; Escudo, Knockback, Freeze e retaguarda; Level Up, baú, gema e Arcana). O elemento a usar pisca com borda dourada, mas nada fica travado. Sair ou concluir volta à Recepção sem tocar no save da meta.
- **Dicas de 1ª vez:** Burn, Wild, Custo X, Return, Retain, Destroy, cartas-lixo, rachadura, fogueira, Baú de Prata, Poço e Overkill aparecem uma única vez num cartão que não bloqueia o jogo.
- **Manual do Expediente (`?`):** 5 abas (História, Combo, Atributos, Inimigos, Progressão) geradas a partir dos dados do jogo. Abre pelo botão `?` do topo ou pela Recepção; `Esc` fecha. Com o Manual aberto, o combate fica pausado.
- Para testes automatizados, `?skipintro=1` na URL não abre a cutscene (sem marcá-la como vista).

## Recepção: Meta-Progressão entre Partidas

Tudo é salvo no navegador (`localStorage`, chave `hc_meta_v1`). Se o armazenamento estiver bloqueado ou corrompido, o jogo começa do zero sem erro.

- **Fundo de Reserva:** ao fim de cada run (vitória ou derrota) todo o VR ganho, inclusive o Overkill dos chefes e o que foi gasto na fogueira, vira crédito persistente (CR).
- **Almoxarifado:** 15 PowerUps permanentes (Might, Sanidade Máx., Armadura, Área, Quantidade, Crescimento, Ganância, Sorte, Recuperação, Cafeína, Re-rolar, Pular, Banir, Revival e Maldição). Custo `(rank + 1) × base + floor(20 × 1,1^total comprado)`; reembolso total e grátis.
- **Grafia / Encadernação:** até 3 slots de gema permanentes (+1 por carta), que já valem desde o início da run.
- **Curadoria:** cada gema alterna entre normal, favorita (peso 2x, até 3) e selada (nunca aparece, até 5). Grátis.
- **Colegas:** Valter Motta desde o início; **Vivi da Arte** (Wild/Combo, +20% Area), **Seu Jorge do TI** (Tomos/Escudo, +15% Desarme) e **Cláudia do Financeiro** (Crítico, Sanidade 50, +20% Luck, +20% Greed, +15 VR) se contratam com CR ou chegam a cada vitória.
- **Carta de Crawler:** cada colega começa com o próprio crachá no baralho. Jogado, o retrato fica ativo por 3 turnos (Duration prolonga) e dispara a passiva sempre que você joga uma carta do tipo dele.
- **Hora Extra Infinita:** liberada ao vencer o Senhor das Horas pela primeira vez. Ondas contínuas no Abismo Estrelado (Elite a cada 3, chefe a cada 5), cada uma mais forte, com HP, ATK e Curse subindo a cada turno. O recorde de ondas fica salvo.

## Cartas de Bioma (5 arquétipos)

O baralho é seu a run inteira: ao passar de Fase você **mantém todas as cartas** conquistadas antes. Cada Bioma acrescenta 3 cartas exclusivas ao pool de recompensas **enquanto você está nele** (Level Up e Baús, sempre com a opção de recusar), e o Chefe de cada Fase entrega 1 **Carta Assinatura** garantida, que você também pode recusar.

| Bioma | Arquétipo | Cartas (Assinatura em negrito) |
| --- | --- | --- |
| Praia do Crepúsculo | Burn & Return | Maré Alta, Ressaca, **Concha do Eco** |
| Cidade Gótica | Desarme & Crítico | Bala de Prata, Manto do Caçador, **Sino do Vigia** |
| Pico Nevado | Gelo, Retain & Escudo ofensivo | Estilhaço Glacial, Bastião de Cristal, **Nevasca Eterna** |
| Dungeon do Arquivo | Destroy, Scavenge & Custo X | Incinerar Arquivo, Pacto das Catacumbas, **Grimório Proibido** |
| Abismo Estrelado | Combo infinito & custo dinâmico | Ponteiro Invertido, Espelho Cósmico, Paradoxo das 18h |

- **Fusões novas** (as duas cartas no Nível MÁX, oferecidas no Level Up): Maré Alta + Concha do Eco → **Tsunami Escaldante**; Bala de Prata + Sino do Vigia → **Execução Lunar**; Estilhaço Glacial + Bastião de Cristal → **Glaciar Absoluto**. O Nível MÁX dessas cartas aparece em qualquer Fase para quem já as tem.
- **Nova Carta Descoberta!:** na primeira vez que uma carta entra no seu baralho, um modal mostra a carta ampliada, o selo do Bioma, a mira nas 5 colunas, o papel tático, uma dica de combo e as keywords. **Entendi!** (ou Enter/Esc) fecha e a fila de modais continua. Cada carta só é explicada uma vez (salvo em `hc_ui_v1`); o Tutorial guiado não mostra esse modal.
- **Bestiário de Cartas:** na Coleção (aba Cartas) e no Manual `?` (aba Cartas), com filtros Todas, Base, Praia, Cidade, Neve, Dungeon, Abismo e Evoluções. Cartas ainda não obtidas aparecem como `???` com a dica do Bioma/Chefe; tocar numa carta descoberta abre a ficha completa, com a receita de evolução/fusão.

## Coleção & Metas ("Carimbos do RH")

Na Recepção, **COLEÇÃO & METAS** abre um painel com rolagem só interna:

- **Metas:** 24 conquistas salvas no `localStorage`, cada uma pagando uma única vez de +40 a +150 CR. Entre elas: Primeiro Ponto, Mestre da Escadinha (Combo x5+), Ultramatança (100+ de Overkill num chefe), Minimalista (vencer sem usar a Fogueira), Alquimista (2+ evoluções/fusões na run), Colegas de Turno (vencer com Vivi, Seu Jorge e Cláudia), Caçador de Segredos (Trapaceiro + Final Secreto), Sob Pressão (vencer nas Pressões 3 e 5) e Infinito (onda 5+ na Hora Extra), mais as dos arquétipos de bioma: Piromaníaco (50+ de Burn numa luta), Caçador Implacável (3 desarmes no turno), Fortaleza Viva (35+ de dano de Escudo no turno), Queima de Arquivo (4+ cartas com Destroy numa luta), Mestre do Paradoxo (Combo x7) e Viajante de Mundos (vencer usando cartas de 3+ biomas). Metas cumpridas durante a run aparecem num aviso discreto no topo, sem pausar o jogo.
- **Coleção / Bestiário:** cartas (com evoluções e fusões), gemas, Arcanas, inimigos e chefes já vistos. O que ainda não apareceu fica como silhueta `???` com uma dica de onde encontrar.

## Backup do Save

**BACKUP DO SAVE** (Recepção) gera um código `HCSAVE1.<Base64>.<checksum>` com todo o progresso (meta, metas, coleção e preferências) e tenta copiá-lo para a área de transferência. Para restaurar, cole o código e clique em **IMPORTAR**: o código é validado (prefixo, Base64, checksum e conteúdo) e só substitui o save atual depois de **SUBSTITUIR SAVE ATUAL**. Códigos inválidos mostram o motivo e não alteram nada.

## Publicar no Itch.io

Todos os caminhos em `docs/` são relativos, então a pasta funciona em qualquer subpasta ou iframe. Para gerar o `.zip` do upload (tipo **HTML**, com `index.html` na raiz do arquivo):

Linux/macOS (Bash):

```bash
cd docs && zip -r ../hells-castle-itch.zip . -x "404.html" && cd ..
```

Windows (PowerShell):

```powershell
Compress-Archive -Path docs\* -DestinationPath hells-castle-itch.zip -Force
```

No Itch.io, marque **This file will be played in the browser** e defina o tamanho do embed (ex.: 1280x800, com a opção de tela cheia).

## Testes

```bash
node --test
```

```bash
npm i --no-save playwright-core
```

```bash
node tools/hc-e2e.mjs
```

```bash
node tools/hc-proc.mjs
```

```bash
node tools/hc-bot.mjs --runs 8 --policy good
```

```bash
node tools/hc-bot.mjs --runs 6 --policy good --char vivi
```

```bash
node tools/hc-bot.mjs --runs 8 --policy good --pressure 1
```

`node --test` cobre as regras puras e o gerador de mapas; os scripts em `tools/` usam o Chrome instalado (via `playwright-core`) para os testes de ponta a ponta em desktop e mobile e para o bot que joga runs completas.

## Créditos

- Fonte pixelada [Jersey 15](https://github.com/scfried/soft-type-jersey) (SIL Open Font License 1.1 em `docs/fonts/Jersey15-OFL.txt`).
- Renderização 3D via [three.js](https://threejs.org/) r170 (MIT License em `docs/js/three.LICENSE.txt`).
- Sprites em pixel art, texturas e efeitos sonoros gerados proceduralmente via Canvas 2D e Web Audio API.

// Dados da campanha "Entre Uma Reunião e Outra": Valter Motta sozinho por 5 biomas de devaneio.
(function () {
    'use strict';

    const PROTAGONIST = {
        name: 'Valter Motta',
        title: 'Sir Valter'
    };

    // Valter enfrenta os devaneios sozinho (sem aliados contratáveis).
    const CHARACTERS = [
        {
            id: 'valter',
            name: 'Valter Motta',
            role: 'Analista',
            title: 'Sir Valter',
            dept: 'Relatórios & Planilhas',
            badgeCode: 'HC-0402',
            icon: 'hero_valter',
            maxHp: 60,
            turn1Shield: 4,
            desc: 'Sozinho contra os próprios devaneios: começa cada combate com +4 de Escudo (Sanidade 60).'
        }
    ];

    // Relógio de ponto: o dia inteiro até a saída.
    const FLOOR_CLOCKS = {
        1: '08:17',
        2: '11:30',
        3: '14:45',
        4: '17:15',
        5: '17:55',
        victory: '18:00'
    };

    const REALITY_FLASH_QUIPS = [
        'Valter... está na sala? Foco na reunião!',
        'Motta? Está olhando para a parede de novo?',
        'A luz fluorescente pisca... por um segundo, é só o escritório.',
        'Alguém chama seu nome lá longe, do outro lado da baia.',
        'O teclado continua ali. O devaneio também.'
    ];

    // ---------- ECONOMIA & REGRAS DE BALANCEAMENTO ----------
    const BALANCE = {
        comboStep: 0.25,       // +25% de dano por nível de combo acima de x1
        comboMaxMult: 2.5,     // teto do multiplicador de combo
        areaStunChance: 0.5,   // chance de Knockback por inimigo em cartas de área
        maxHpCap: 75,          // teto de Sanidade Máxima
        maxManaCap: 5,         // Cafeína máx.: 4 com Cálice Duplo, 5 só com relíquia rara
        ambushDamage: 4,       // dano da EMBOSCADA antes do Turno 1
        aggroRange: 2,         // tiles de linha de visão que iniciam o combate
        patrolRadius: 4,       // raio (tiles) em que os encontros perseguem o jogador
        patrolEverySteps: 2,   // encontros andam 1 casa a cada N passos do jogador
        xpFirstLevel: 68,      // XP do 1º nível (+35% sobre os 50 anteriores)
        xpGrowth: 1.45,
        overkillVr: 1,
        overkillXp: 6,
        minDeckSize: 5,
        rest: { healPrice: 25, healAmount: 20, removePrice: 30, relicPrice: 45 }
    };

    function getComboMult(combo) {
        return Math.min(BALANCE.comboMaxMult, 1 + BALANCE.comboStep * (Math.max(1, combo) - 1));
    }

    // Cartas: fantasia épica de Valter, com micro-referência ao escritório no subtítulo (origin).
    const CARDS = {
        mordida_ferro: {
            id: 'mordida_ferro',
            name: 'Lâmina do Devaneio',
            origin: 'Abridor de Cartas',
            cost: 1, type: 'atk', target: 'single',
            damage: 15, shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'c_sword', sfx: 'stapler',
            desc: 'Causa {DMG} de dano em 1 alvo.'
        },
        pocao_fogo: {
            id: 'pocao_fogo',
            name: 'Sopro de Brasas',
            origin: 'Café Pelando',
            cost: 1, type: 'atk', target: 'all',
            damage: 10, shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'c_flask', sfx: 'coffee',
            desc: 'Causa {DMG} de dano em TODOS os inimigos.'
        },
        chicote_dados: {
            id: 'chicote_dados',
            name: 'Chicote Relâmpago',
            origin: 'Cabo de Rede',
            cost: 2, type: 'ctrl', target: 'all',
            damage: 12, shield: 0, heal: 0, manaGain: 0, knockback: true,
            icon: 'c_bolt', sfx: 'whip',
            desc: 'Causa {DMG} em TODOS + 50% de chance de Knockback em cada um.'
        },
        escudo_burocratico: {
            id: 'escudo_burocratico',
            name: 'Égide do Viajante',
            origin: 'Pasta de Arquivo',
            cost: 1, type: 'def', target: 'single',
            damage: 0, shield: 8, heal: 0, manaGain: 0, knockback: true,
            icon: 'c_aegis', sfx: 'shield',
            desc: 'Ganha 8 de Escudo + Knockback em 1 inimigo.'
        },
        demissao_silenciosa: {
            id: 'demissao_silenciosa',
            name: 'Passo das Sombras',
            origin: 'Saída à Francesa',
            cost: 1, type: 'atk', target: 'single',
            damage: 22, shield: 6, heal: 0, manaGain: 0, knockback: false,
            icon: 'c_shadow', sfx: 'stapler',
            desc: 'Causa {DMG} de dano em 1 alvo e ganha 6 de Escudo.'
        },
        tempestade_cc: {
            id: 'tempestade_cc',
            name: 'Tempestade de Corvos',
            origin: 'Cópia para Todos',
            cost: 2, type: 'ctrl', target: 'all',
            damage: 18, shield: 0, heal: 0, manaGain: 0, knockback: true,
            icon: 'c_crows', sfx: 'whip',
            desc: 'Causa {DMG} em TODOS + 50% de chance de Knockback em cada um.'
        },
        atestado_arcano: {
            id: 'atestado_arcano',
            name: 'Bênção do Curandeiro',
            origin: 'Atestado Médico',
            cost: 0, type: 'def', target: 'self',
            damage: 0, shield: 8, heal: 12, manaGain: 1, knockback: false,
            icon: 'c_bless', sfx: 'shield',
            desc: 'Cura 12 Sanidade, +8 Escudo e +1 Cafeína.'
        },
        // ---------- CARTAS EVOLUÍDAS ----------
        vulcao_expresso: {
            id: 'vulcao_expresso',
            name: 'Erupção Solar',
            origin: 'Garrafa Térmica',
            cost: 1, type: 'atk', target: 'all',
            damage: 18, ignoreShield: true, evolved: true,
            shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'c_sun', sfx: 'coffee',
            desc: 'EVOLUÍDA: {DMG} de dano em TODOS (ignora escudo).'
        },
        mandibula_ferro: {
            id: 'mandibula_ferro',
            name: 'Dança das Lâminas',
            origin: 'Grampeador Industrial',
            cost: 1, type: 'atk', target: 'single',
            damage: 8, hits: 3, evolved: true,
            shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'c_blades', sfx: 'stapler',
            desc: 'EVOLUÍDA: {DMG} de dano 3x seguidas no alvo.'
        },
        muralha_juridica: {
            id: 'muralha_juridica',
            name: 'Muralha do Guardião',
            origin: 'Cópia Oculta',
            cost: 1, type: 'def', target: 'all',
            damage: 0, shield: 18, evolved: true,
            heal: 0, manaGain: 0, knockback: true, knockbackChance: 0.6,
            icon: 'c_wall', sfx: 'shield',
            desc: 'EVOLUÍDA: +18 de Escudo e 60% de chance de atordoar cada inimigo.'
        },
        // ---------- CARTA-LIXO DO DEVORADOR DAS MARÉS ----------
        folha_presa: {
            id: 'folha_presa',
            name: 'Folha Presa',
            origin: 'Atolamento de Papel',
            cost: 1, type: 'curse', target: 'self',
            damage: 0, shield: 0, heal: 0, manaGain: 0, knockback: false,
            purgeOnPlay: true,
            icon: 'ata', sfx: 'card',
            desc: 'Inútil. Pague 1 Cafeína para descartar.'
        }
    };

    const STARTING_DECK = [
        'mordida_ferro',
        'mordida_ferro',
        'pocao_fogo',
        'pocao_fogo',
        'chicote_dados',
        'chicote_dados',
        'escudo_burocratico',
        'escudo_burocratico'
    ];

    const EVOLUTIONS = [
        {
            passiveId: 'rel_garrafa',
            title: 'Frasco Solar',
            origin: 'Garrafa Térmica',
            icon: 'thermos',
            fromCard: 'pocao_fogo',
            toCard: 'vulcao_expresso',
            desc: 'Evolui Sopro de Brasas -> Erupção Solar (18 de dano em TODOS, ignora escudo).'
        },
        {
            passiveId: 'rel_grampos',
            title: 'Pedra de Amolar',
            origin: 'Caixa de Grampos',
            icon: 'staple_box',
            fromCard: 'mordida_ferro',
            toCard: 'mandibula_ferro',
            desc: 'Evolui Lâmina do Devaneio -> Dança das Lâminas (8 de dano 3x seguidas).'
        },
        {
            passiveId: 'rel_cco',
            title: 'Selo do Guardião',
            origin: 'Cópia Oculta',
            icon: 'cco_shield',
            fromCard: 'escudo_burocratico',
            toCard: 'muralha_juridica',
            desc: 'Evolui Égide do Viajante -> Muralha do Guardião (+18 Escudo, 60% de atordoar cada inimigo).'
        }
    ];

    // Relíquias especiais (não evoluem cartas).
    const SPECIAL_RELICS = {
        foto_parque: {
            id: 'foto_parque',
            title: 'Foto no Parque',
            icon: 'r_photo',
            desc: '+15% de dano e +5 de Sanidade no início de cada combate.'
        },
        bilhete_cinema: {
            id: 'bilhete_cinema',
            title: 'Bilhete de Cinema',
            icon: 'r_ticket',
            desc: 'Relíquia de memória: +10% de dano.'
        },
        chave_bicicleta: {
            id: 'chave_bicicleta',
            title: 'Chave da Bicicleta',
            icon: 'r_key',
            desc: 'Relíquia de memória rara: +1 Cafeína máxima (teto 5).'
        }
    };

    // attackStyle: 'lunge' (investida), 'paper' (folha arremessada), 'wave' (onda) ou 'orb' (projétil de energia).
    function enemy(kind, name, origin, hp, atk, xp, vr, extra) {
        return Object.assign({
            kind: kind, name: name, origin: origin,
            hp: hp, atk: atk, xp: xp, vr: vr,
            immuneKnockback: false, attackStyle: 'lunge', quip: ''
        }, extra || {});
    }

    const ENEMIES = {
        // ---- Fase 1: Praia do Crepúsculo ----
        crab: enemy('crab', 'Caranguejo de Tinta', 'Cartucho Vazando', 32, 4, 14, 4,
            { enemyShield: 6, quip: '"Clac-clac... substitua o cartucho ciano!"' }),
        gull: enemy('gull', 'Gaivota Ladrã', 'Folha Voando', 26, 5, 14, 4,
            { quip: '"Minha folha! Minha! MINHA!"' }),
        specter: enemy('specter', 'Espectro da Maré', 'Fila de Impressão', 28, 4, 15, 4,
            { buffAllies: 2, attackStyle: 'wave', quip: '"A fila de impressão nunca acaba..."' }),
        kraken: enemy('kraken', 'Devorador das Marés', 'A Impressora Faminta — Chefe', 115, 9, 50, 16,
            { isBoss: true, immuneKnockback: true, curseCard: 'folha_presa', attackStyle: 'paper',
              quip: '"PAPEL. PRESO. NA. BANDEJA. DOIS."' }),

        // ---- Fase 2: Cidade Gótica Amaldiçoada ----
        hunter: enemy('hunter', 'Caçador Frenético', 'Mensagem Urgente', 50, 8, 18, 5,
            { quip: '"Viu minha mensagem? Viu? VIU?"' }),
        crow: enemy('crow', 'Corvo dos Sinos', 'Notificação', 44, 6, 18, 5,
            { buffAllies: 2, attackStyle: 'wave', quip: '"Plim! Plim! Plim!"' }),
        herald: enemy('herald', 'Arauto da Vigília', 'Lembrete Agendado', 58, 7, 19, 5,
            { enemyShield: 10, attackStyle: 'orb', quip: '"Lembrete: você tem 14 pendências."' }),
        mensageiro: enemy('mensageiro', 'Mensageiro do Sino Veloz', 'O Corredor Sem Fim — Chefe', 150, 6, 65, 20,
            { isBoss: true, immuneKnockback: false, attacksPerTurn: 2, attackStyle: 'lunge',
              quip: '"Uma coisa de cada vez? Nesta cidade, nunca."' }),

        // ---- Fase 3: Pico Nevado & Fortaleza de Gelo ----
        wolf: enemy('wolf', 'Lobo da Nevasca', 'Prazo Apertado', 68, 10, 22, 6,
            { quip: '"Auuu... para ontem!"' }),
        serpent: enemy('serpent', 'Serpente de Cristal', 'Gráfico em Queda', 62, 9, 22, 6,
            { enemyShield: 12, attackStyle: 'orb', quip: '"Ssssegundo o gráfico, estamos atrasssados."' }),
        sentinel: enemy('sentinel', 'Sentinela Congelado', 'Pauta Travada', 85, 8, 24, 6,
            { enemyShield: 16, quip: '"Este item fica para a próxima reunião."' }),
        estrategista: enemy('estrategista', 'Estrategista do Véu Branco', 'A Reunião Gelada — Chefe', 185, 12, 80, 24,
            { isBoss: true, immuneKnockback: true, shieldPerTurn: 18, attackStyle: 'orb',
              quip: '"Tudo é prioridade máxima. Tudo."' }),

        // ---- Fase 4: Dungeon Subterrânea ----
        skeleton: enemy('skeleton', 'Esqueleto do Arquivo', 'Pasta de 1998', 85, 11, 26, 7,
            { quip: '"Protocolo... em três vias..."' }),
        mimic: enemy('mimic', 'Mímico de Gaveta', 'Gaveta Emperrada', 95, 13, 27, 7,
            { quip: '"NHAC! Faltou o carimbo!"' }),
        gargoyle: enemy('gargoyle', 'Gárgula de Pedra', 'Arquivo Morto', 110, 10, 28, 7,
            { enemyShield: 18, attackStyle: 'orb', quip: '"Nada sai daqui. Nada."' }),
        guardia: enemy('guardia', 'Guardiã das Catacumbas', 'O Arquivo Sem Fim — Chefe', 230, 14, 95, 28,
            { isBoss: true, immuneKnockback: true, summonKind: 'skeleton', summonEvery: 3, attackStyle: 'orb',
              dropRelic: 'foto_parque', quip: '"Você guardou tudo... menos o que importava."' }),

        // ---- Fase 5: O Abismo Estrelado ----
        horas: enemy('horas', 'O Senhor das Horas', 'O Relógio de Ponto — Chefe Final', 300, 16, 0, 0,
            { isBoss: true, immuneKnockback: true, drainMana: 1, attackStyle: 'orb',
              quip: '"Tic. Tac. O seu tempo é meu."' })
    };

    // Máximo de inimigos vivos simultâneos (limite da formação e das invocações).
    const MAX_ENEMIES_IN_COMBAT = 4;

    function getEnemyStats(kind) {
        return ENEMIES[kind] || null;
    }

    const LEVEL_UP_REWARDS = [
        {
            id: 'fones_anti_ruido',
            kind: 'passiva',
            title: 'Elmo do Silêncio',
            origin: 'Fones Anti-Ruído',
            icon: 'headphones',
            desc: 'Passiva: +20% de dano em TODAS as cartas pelo resto do dia.',
            apply: function (state) {
                state.damageMult += 0.2;
                state.passives.push({ label: 'Elmo do Silêncio (+20% Dano)', icon: 'headphones' });
            }
        },
        {
            id: 'expresso_duplo',
            kind: 'passiva',
            title: 'Cálice Duplo',
            origin: 'Expresso Duplo',
            icon: 'espresso',
            once: true,
            desc: 'ÚNICO: +1 Cafeína máxima (4 por turno) e cura 15 de Sanidade.',
            apply: function (state) {
                state.maxMana = Math.min(BALANCE.maxManaCap, state.maxMana + 1);
                state.mana += 1;
                state.hp = Math.min(state.maxHp, state.hp + 15);
                state.passives.push({ label: 'Cálice Duplo (+1 Cafeína)', icon: 'espresso' });
            }
        },
        {
            id: 'add_demissao_silenciosa',
            kind: 'carta',
            title: 'Passo das Sombras',
            origin: 'Saída à Francesa',
            icon: 'c_shadow',
            desc: 'Adiciona ao deck: Custo 1 — 22 de dano em 1 alvo + 6 de Escudo.',
            apply: function (state) {
                state.deck.push('demissao_silenciosa');
                state.discardPile.push('demissao_silenciosa');
            }
        },
        {
            id: 'add_tempestade_cc',
            kind: 'carta',
            title: 'Tempestade de Corvos',
            origin: 'Cópia para Todos',
            icon: 'c_crows',
            desc: 'Adiciona ao deck: Custo 2 — 18 de dano em TODOS + 50% de Knockback.',
            apply: function (state) {
                state.deck.push('tempestade_cc');
                state.discardPile.push('tempestade_cc');
            }
        },
        {
            id: 'add_atestado_arcano',
            kind: 'carta',
            title: 'Bênção do Curandeiro',
            origin: 'Atestado Médico',
            icon: 'c_bless',
            desc: 'Adiciona ao deck: Custo 0 — Cura 12 Sanidade, +8 Escudo e +1 Cafeína.',
            apply: function (state) {
                state.deck.push('atestado_arcano');
                state.discardPile.push('atestado_arcano');
            }
        },
        {
            id: 'reajuste_vr',
            kind: 'passiva',
            title: 'Bolsa de Moedas',
            origin: 'Reajuste de VR',
            icon: 'vr_boost',
            desc: '+5 Sanidade Máxima (teto 75), cura 15 e +10 VR.',
            apply: function (state) {
                state.maxHp = Math.min(BALANCE.maxHpCap, state.maxHp + 5);
                state.hp = Math.min(state.maxHp, state.hp + 15);
                state.vr += 10;
                state.passives.push({ label: 'Bolsa de Moedas (+5 Sanidade Máx)', icon: 'vr_boost' });
            }
        }
    ];

    EVOLUTIONS.forEach(ev => {
        LEVEL_UP_REWARDS.push({
            id: ev.passiveId,
            kind: 'reliquia',
            title: ev.title,
            origin: ev.origin,
            icon: ev.icon,
            once: true,
            desc: 'Relíquia de Evolução: ' + ev.desc,
            apply: function (state) {
                if (!state.relics.includes(ev.passiveId)) {
                    state.relics.push(ev.passiveId);
                    state.passives.push({ label: ev.title + ' (Evolução)', icon: ev.icon });
                }
            }
        });
    });

    // Eventos (?) genéricos dos devaneios.
    const CORRIDOR_EVENTS = [
        {
            id: 'garrafa_mar',
            title: 'Uma garrafa trazida pelo vento',
            desc: 'Dentro dela, um bilhete com a sua própria letra: "respira".',
            choices: [
                {
                    label: 'Ler com calma',
                    hint: 'Cura +14 Sanidade',
                    effect: function (state) {
                        state.hp = Math.min(state.maxHp, state.hp + 14);
                        return 'Você respira fundo. +14 Sanidade.';
                    }
                },
                {
                    label: 'Guardar a garrafa e seguir',
                    hint: '+8 VR e +8 Horas Extras',
                    effect: function (state, helpers) {
                        state.vr += 8;
                        helpers.addXp(8);
                        return 'Vai que serve para alguma coisa. +8 VR e +8 XP.';
                    }
                }
            ]
        },
        {
            id: 'vulto_esquina',
            title: 'Um vulto acena da esquina',
            desc: 'Ele segura algo brilhante e some na neblina quando você se aproxima.',
            choices: [
                {
                    label: 'Seguir o vulto',
                    hint: '55%: +14 VR | 45%: emboscada',
                    effect: function (state, helpers) {
                        if (Math.random() < 0.55) {
                            state.vr += 14;
                            return 'Ele deixou cair uma bolsa de moedas. +14 VR.';
                        }
                        helpers.triggerAmbush('Era uma isca! Algo salta das sombras!');
                        return null;
                    }
                },
                {
                    label: 'Ignorar e descansar um instante',
                    hint: 'Cura +8 Sanidade sem riscos',
                    effect: function (state) {
                        state.hp = Math.min(state.maxHp, state.hp + 8);
                        return 'Nem todo chamado precisa de resposta. +8 Sanidade.';
                    }
                }
            ]
        },
        {
            id: 'altar_gelo',
            title: 'Um altar coberto de gelo',
            desc: 'Há uma inscrição quase apagada: "o que é urgente raramente é importante".',
            choices: [
                {
                    label: 'Quebrar o gelo com as mãos',
                    hint: '-6 Sanidade, +12 VR e +12 Horas Extras',
                    effect: function (state, helpers) {
                        state.hp = Math.max(1, state.hp - 6);
                        state.vr += 12;
                        helpers.addXp(12);
                        return 'Dedos dormentes, bolso cheio. -6 Sanidade, +12 VR e +12 XP.';
                    }
                },
                {
                    label: 'Apenas ler e seguir',
                    hint: 'Cura +10 Sanidade',
                    effect: function (state) {
                        state.hp = Math.min(state.maxHp, state.hp + 10);
                        return 'A frase fica na cabeça. +10 Sanidade.';
                    }
                }
            ]
        }
    ];

    // Evento especial da Fase 4.
    const EVENT_COISAS_ESQUECIDAS = {
        id: 'coisas_esquecidas',
        title: 'As Coisas Esquecidas',
        desc: 'Uma gaveta entreaberta guarda o que você deixou para depois: um bilhete de cinema, a chave de uma bicicleta. Para levar algo, é preciso largar um peso.',
        choices: [
            {
                label: 'Largar 1 carta pesada (custo 2)',
                hint: 'Remove 1 carta de custo 2 do baralho e ganha o Bilhete de Cinema (+10% de dano)',
                effect: function (state, helpers) {
                    if (helpers.removeHeavyCards(1) < 1) {
                        state.hp = Math.min(state.maxHp, state.hp + 8);
                        return 'Você não carrega nenhum peso para largar. A gaveta se fecha. +8 Sanidade.';
                    }
                    helpers.grantRelic('bilhete_cinema');
                    return 'Você lembra do filme que nunca foi ver. Bilhete de Cinema: +10% de dano.';
                }
            },
            {
                label: 'Largar 2 cartas pesadas (custo 2)',
                hint: 'Remove 2 cartas de custo 2 e ganha a Chave da Bicicleta (+1 Cafeína máxima)',
                effect: function (state, helpers) {
                    if (helpers.countHeavyCards() < 2) {
                        state.hp = Math.min(state.maxHp, state.hp + 8);
                        return 'Você não tem dois pesos para largar. A gaveta se fecha. +8 Sanidade.';
                    }
                    helpers.removeHeavyCards(2);
                    helpers.grantRelic('chave_bicicleta');
                    return 'O vento no rosto, ladeira abaixo. Chave da Bicicleta: +1 Cafeína máxima.';
                }
            },
            {
                label: 'Fechar a gaveta com cuidado',
                hint: 'Cura +10 Sanidade',
                effect: function (state) {
                    state.hp = Math.min(state.maxHp, state.hp + 10);
                    return 'Ainda não é hora. +10 Sanidade.';
                }
            }
        ]
    };

    // 5 Fases / Biomas. Mapas 9x9 abertos (arenas), sem corredores de 1 tile:
    // '#' = obstáculo/borda | '.' = chão | 'S' = início | '1'..'3' = encontros | 'B' = Chefe
    // 'C' = Baú | 'M' = Ponto de Pausa | '?' = Evento | 'E' = Saída
    const FLOORS = [
        {
            floor: 1,
            biome: 'beach',
            name: 'Praia do Crepúsculo',
            bossName: 'Devorador das Marés',
            restName: 'Fogueira na Areia',
            restDesc: 'O fogo estala baixinho enquanto a maré sobe e desce.',
            bumpMsg: 'A maré escura não deixa passar.',
            exitHint: 'A passagem entre as pedras se abriu!',
            conclusion: 'Eu preciso de uma pausa.',
            trigger: {
                time: '08:17',
                title: 'A Impressora Faminta',
                lines: [
                    'A impressora do corredor engasga, treme e começa a cuspir folhas em branco.',
                    'Uma, dez, cem. Elas cobrem o carpete como espuma.',
                    'Valter pisca — e o carpete já é areia, e o zumbido é o mar.'
                ]
            },
            layout: [
                '#########',
                '#C.....E#',
                '#...B.?.#',
                '##......#',
                '#...3...#',
                '#1.....2#',
                '#.......#',
                '#M..S#.C#',
                '#########'
            ],
            encounters: {
                '1': { zone: 'Arrebentação Oeste', intro: 'Um Caranguejo de Tinta e uma Gaivota Ladrã disputam uma folha!', enemies: ['crab', 'gull'] },
                '2': { zone: 'Poças do Leste', intro: 'A maré traz um Espectro e uma Gaivota!', enemies: ['gull', 'specter'] },
                '3': { zone: 'Banco de Areia', intro: 'Três criaturas da maré cercam o banco de areia!', enemies: ['crab', 'specter', 'gull'] },
                'B': { zone: 'Olho da Maré', intro: 'CHEFE: O DEVORADOR DAS MARÉS emerge cuspindo Folhas Presas!', isBoss: true, enemies: ['gull', 'kraken', 'crab'] }
            }
        },
        {
            floor: 2,
            biome: 'city',
            name: 'Cidade Gótica Amaldiçoada',
            bossName: 'Mensageiro do Sino Veloz',
            restName: 'Lampião do Abrigo',
            restDesc: 'Uma luz âmbar segura a neblina do lado de fora.',
            bumpMsg: 'Grades de ferro e casas trancadas fecham a rua.',
            exitHint: 'O portão da cidade se abriu!',
            conclusion: 'Preciso terminar uma tarefa antes de começar outra.',
            trigger: {
                time: '11:30',
                title: 'O Corredor Sem Fim',
                lines: [
                    'O celular vibra. O computador apita. Alguém chama no corredor.',
                    'A cada passo o corredor estica, e cada notificação soa como um sino.',
                    'As lâmpadas viram lampiões. Há uma lua pálida onde ficava o teto.'
                ]
            },
            layout: [
                '#########',
                '#E.....C#',
                '#.?.B...#',
                '#.....###',
                '#...3...#',
                '#1.....2#',
                '#.......#',
                '#C.#S..M#',
                '#########'
            ],
            encounters: {
                '1': { zone: 'Beco dos Sinos', intro: 'Um Caçador Frenético e um Corvo dos Sinos avançam pela rua!', enemies: ['hunter', 'crow'] },
                '2': { zone: 'Praça da Vigília', intro: 'O Arauto da Vigília lê sua lista de pendências!', enemies: ['herald', 'hunter', 'crow'] },
                '3': { zone: 'Cruzamento Central', intro: 'Dois Caçadores escoltam um Arauto no cruzamento!', enemies: ['hunter', 'herald', 'hunter'] },
                'B': { zone: 'Torre do Sino', intro: 'CHEFE: O MENSAGEIRO DO SINO VELOZ ataca duas vezes por turno — use Escudo e Knockback!', isBoss: true, enemies: ['crow', 'mensageiro', 'hunter'] }
            }
        },
        {
            floor: 3,
            biome: 'snow',
            name: 'Pico Nevado',
            bossName: 'Estrategista do Véu Branco',
            restName: 'Abrigo da Nevasca',
            restDesc: 'Uma fogueira pequena, protegida do vento por um muro de gelo.',
            bumpMsg: 'Um paredão de gelo bloqueia o caminho.',
            exitHint: 'A fortaleza de gelo rachou e abriu passagem!',
            conclusion: 'Se tudo é urgente, nada é prioridade.',
            trigger: {
                time: '14:45',
                title: 'A Reunião Gelada',
                lines: [
                    'O ar-condicionado da sala de reunião está no máximo.',
                    'Na tela, um gráfico atrás do outro, um prazo atrás do outro.',
                    'O sopro frio vira vento, a mesa vira neve, e os slides, uma muralha de gelo.'
                ]
            },
            layout: [
                '#########',
                '#C.....E#',
                '#...B...#',
                '##.....##',
                '#...3...#',
                '#2.....1#',
                '#.....?.#',
                '#C..S..M#',
                '#########'
            ],
            encounters: {
                '1': { zone: 'Encosta Leste', intro: 'Uma matilha da nevasca e uma Serpente de Cristal descem a encosta!', enemies: ['wolf', 'serpent', 'wolf'] },
                '2': { zone: 'Passo Oeste', intro: 'Um Sentinela Congelado guarda o passo com uma Serpente!', enemies: ['sentinel', 'serpent'] },
                '3': { zone: 'Pátio da Fortaleza', intro: 'A guarda completa da fortaleza fecha o pátio!', enemies: ['wolf', 'sentinel', 'serpent', 'wolf'] },
                'B': { zone: 'Sala do Véu Branco', intro: 'CHEFE: A ESTRATEGISTA DO VÉU BRANCO ergue um Escudo de Cristal a cada turno!', isBoss: true, enemies: ['serpent', 'estrategista', 'sentinel'] }
            }
        },
        {
            floor: 4,
            biome: 'dungeon',
            name: 'Dungeon do Arquivo',
            bossName: 'Guardiã das Catacumbas',
            restName: 'Braseiro da Cripta',
            restDesc: 'Brasas antigas ainda aquecem as pedras cobertas de musgo.',
            bumpMsg: 'Pedra fria e musgo. Não há passagem.',
            exitHint: 'A grade enferrujada da saída se ergueu!',
            conclusion: 'Algumas coisas eu guardei tempo demais. Outras, de menos.',
            specialEvent: EVENT_COISAS_ESQUECIDAS,
            trigger: {
                time: '17:15',
                title: 'O Arquivo Morto',
                lines: [
                    'Falta só buscar uma pasta no arquivo morto do subsolo.',
                    'As gavetas se multiplicam, corredor após corredor, cada vez mais antigas.',
                    'A lanterna do celular vira tocha. As estantes, paredes de pedra.'
                ]
            },
            layout: [
                '#########',
                '#E.....C#',
                '#...B...#',
                '###...###',
                '#...3...#',
                '#1.....2#',
                '#.?.....#',
                '#M.#S..C#',
                '#########'
            ],
            encounters: {
                '1': { zone: 'Galeria das Pastas', intro: 'Esqueletos do Arquivo e um Mímico de Gaveta despertam!', enemies: ['skeleton', 'mimic', 'skeleton'] },
                '2': { zone: 'Cripta Leste', intro: 'Uma Gárgula de Pedra desce do pilar com sua escolta!', enemies: ['gargoyle', 'skeleton', 'mimic'] },
                '3': { zone: 'Salão das Gavetas', intro: 'O salão inteiro range: quatro guardiões do arquivo!', enemies: ['skeleton', 'gargoyle', 'mimic', 'skeleton'] },
                'B': { zone: 'Câmara das Catacumbas', intro: 'CHEFE: A GUARDIÃ DAS CATACUMBAS convoca Esqueletos do Arquivo!', isBoss: true, enemies: ['skeleton', 'guardia', 'gargoyle'] }
            }
        },
        {
            floor: 5,
            biome: 'abyss',
            name: 'O Abismo Estrelado',
            bossName: 'O Senhor das Horas',
            restName: '',
            restDesc: '',
            bumpMsg: 'Além dos ladrilhos só existe o vazio.',
            exitHint: '',
            conclusion: 'Amanhã eu volto. Mas hoje, o dia é meu.',
            trigger: {
                time: '17:55',
                title: 'O Relógio de Ponto',
                lines: [
                    'O escritório está vazio. Só o relógio de ponto ainda faz barulho.',
                    'Os ponteiros hesitam... e começam a girar para trás.',
                    'O chão some. Sobram ladrilhos de luz, estrelas e um colosso de engrenagens.'
                ]
            },
            layout: [
                '#########',
                '###...###',
                '##..B..##',
                '##.....##',
                '##.....##',
                '###...###',
                '###...###',
                '###.S.###',
                '#########'
            ],
            encounters: {
                'B': { zone: 'Centro do Abismo', intro: 'CHEFE FINAL: O SENHOR DAS HORAS! Bloqueie os golpes ou ele drena sua Cafeína!', isBoss: true, enemies: ['horas'] }
            }
        }
    ];

    // Emboscadas de evento usam inimigos do próprio bioma.
    const AMBUSH_BY_FLOOR = {
        1: ['gull', 'crab'],
        2: ['hunter', 'crow'],
        3: ['wolf', 'serpent'],
        4: ['skeleton', 'mimic'],
        5: []
    };

    const CHEST_LOOT = [
        { title: 'Baú Trazido pela Maré', text: '+15 Sanidade, +8 VR e +12 Horas Extras.', hp: 15, vr: 8, xp: 12 },
        { title: 'Arca Esquecida', text: '+12 Sanidade, +12 VR e +10 Horas Extras.', hp: 12, vr: 12, xp: 10 },
        { title: 'Cofre de Provisões', text: '+18 Sanidade, +10 VR e +14 Horas Extras.', hp: 18, vr: 10, xp: 14 }
    ];

    const EPILOGUE = {
        calmTitle: 'O ponteiro parou.',
        calmLines: [
            'O colosso se desfaz em engrenagens que caem devagar, como folhas.',
            'O Devorador, o Mensageiro, a Estrategista e a Guardiã se afastam e abrem caminho.',
            'No fim dos ladrilhos de luz, há apenas um relógio de ponto.'
        ],
        button: 'BATER O PONTO',
        endTitle: '18:00',
        endLines: [
            'O sol do fim de tarde entra de lado pela janela do escritório.',
            'Valter desliga o monitor, pega a mochila e desce pela escada.',
            '"Amanhã eu volto. Mas hoje, o dia é meu."'
        ]
    };

    // ---------- VALIDAÇÃO ESTRITA DOS MAPAS ----------
    function isWalkableTile(layout, x, y) {
        return y >= 0 && y < layout.length && x >= 0 && x < layout[y].length && layout[y][x] !== '#';
    }

    // Mapa retangular e murado, um único início, símbolos definidos, tudo alcançável e SEM
    // corredores de 1 tile: todo tile caminhável tem vizinho livre nos dois eixos
    // (garante espaço lateral para a horda ficar no chão aberto, longe das paredes).
    function validateFloors() {
        const problems = [];
        FLOORS.forEach(fl => {
            const L = fl.layout;
            const tag = 'Fase ' + fl.floor + ': ';
            const cols = L[0].length;
            let start = null;
            L.forEach((row, y) => {
                if (row.length !== cols) problems.push(tag + 'linha ' + y + ' com largura diferente');
                for (let x = 0; x < row.length; x++) {
                    const ch = row[x];
                    const edge = y === 0 || y === L.length - 1 || x === 0 || x === row.length - 1;
                    if (edge && ch !== '#') problems.push(tag + 'borda aberta em ' + x + ',' + y);
                    if (ch === 'S') {
                        if (start) problems.push(tag + 'mais de um início');
                        start = { x: x, y: y };
                    }
                    if (!'#.SCM?E'.includes(ch) && !fl.encounters[ch]) {
                        problems.push(tag + 'símbolo sem encontro definido "' + ch + '" em ' + x + ',' + y);
                    }
                    if (ch !== '#') {
                        const horiz = isWalkableTile(L, x - 1, y) || isWalkableTile(L, x + 1, y);
                        const vert = isWalkableTile(L, x, y - 1) || isWalkableTile(L, x, y + 1);
                        if (!horiz || !vert) problems.push(tag + 'corredor estreito/beco em ' + x + ',' + y);
                    }
                }
            });
            if (!start) {
                problems.push(tag + 'sem tile de início');
                return;
            }
            const seen = new Set([start.x + ',' + start.y]);
            const queue = [start];
            while (queue.length > 0) {
                const c = queue.shift();
                [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(d => {
                    const x = c.x + d[0];
                    const y = c.y + d[1];
                    if (!isWalkableTile(L, x, y) || seen.has(x + ',' + y)) return;
                    seen.add(x + ',' + y);
                    queue.push({ x: x, y: y });
                });
            }
            L.forEach((row, y) => {
                for (let x = 0; x < row.length; x++) {
                    if (row[x] !== '#' && row[x] !== '.' && !seen.has(x + ',' + y)) {
                        problems.push(tag + '"' + row[x] + '" inalcançável em ' + x + ',' + y);
                    }
                }
            });
            // Arena 3x3 ao redor de cada encontro: sem obstáculos internos; chefes e hordas de
            // 4 inimigos exigem o 3x3 inteiro livre (longe também da borda do mapa).
            L.forEach((row, y) => {
                for (let x = 0; x < row.length; x++) {
                    const enc = fl.encounters[row[x]];
                    if (!enc) continue;
                    const strict = enc.isBoss || enc.enemies.length >= 4;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const ax = x + dx;
                            const ay = y + dy;
                            const border = ay <= 0 || ay >= L.length - 1 || ax <= 0 || ax >= cols - 1;
                            if (isWalkableTile(L, ax, ay)) continue;
                            if (strict || !border) problems.push(tag + 'arena do encontro "' + row[x] + '" bloqueada em ' + ax + ',' + ay);
                        }
                    }
                }
            });
            Object.keys(fl.encounters).forEach(ch => {
                if (!L.some(row => row.includes(ch))) problems.push(tag + 'encontro "' + ch + '" sem tile no mapa');
                const list = fl.encounters[ch].enemies;
                if (list.length > MAX_ENEMIES_IN_COMBAT) problems.push(tag + 'encontro "' + ch + '" com inimigos demais');
                list.forEach(kind => {
                    if (!ENEMIES[kind]) problems.push(tag + 'inimigo desconhecido "' + kind + '"');
                });
            });
        });
        return problems;
    }

    validateFloors().forEach(msg => console.error('[Hells Castle] Mapa inválido — ' + msg));

    function getFloorConfig(floorNum) {
        return FLOORS[(floorNum || 1) - 1] || FLOORS[0];
    }

    window.GameData = {
        PROTAGONIST: PROTAGONIST,
        CHARACTERS: CHARACTERS,
        FLOOR_CLOCKS: FLOOR_CLOCKS,
        REALITY_FLASH_QUIPS: REALITY_FLASH_QUIPS,
        CARDS: CARDS,
        STARTING_DECK: STARTING_DECK,
        EVOLUTIONS: EVOLUTIONS,
        SPECIAL_RELICS: SPECIAL_RELICS,
        ENEMIES: ENEMIES,
        BALANCE: BALANCE,
        MAX_ENEMIES_IN_COMBAT: MAX_ENEMIES_IN_COMBAT,
        getEnemyStats: getEnemyStats,
        isWalkableTile: isWalkableTile,
        validateFloors: validateFloors,
        getComboMult: getComboMult,
        LEVEL_UP_REWARDS: LEVEL_UP_REWARDS,
        FLOORS: FLOORS,
        CORRIDOR_EVENTS: CORRIDOR_EVENTS,
        AMBUSH_BY_FLOOR: AMBUSH_BY_FLOOR,
        CHEST_LOOT: CHEST_LOOT,
        EPILOGUE: EPILOGUE,
        getFloorConfig: getFloorConfig
    };
})();

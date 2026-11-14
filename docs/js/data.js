// Dados de cartas, evoluções, aliados, inimigos, chefes, 3 andares e eventos aleatórios.
(function () {
    'use strict';

    const PROTAGONIST = {
        name: 'Valter Motta',
        title: 'Sir Valter'
    };

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
            allyId: null,
            extraCard: null,
            desc: 'Equilibrado: começa com +4 de Escudo no 1º turno de cada combate (Sanidade 60).'
        },
        {
            id: 'vivi',
            name: 'Vivi da Arte',
            role: 'Designer',
            title: 'Lady Vivi',
            dept: 'Criação & Layout',
            badgeCode: 'HC-0718',
            icon: 'ally_vivi',
            maxHp: 48,
            turn1Shield: 0,
            allyId: 'ally_vivi',
            extraCard: null,
            desc: 'Combo sobe +2 níveis por carta (+50% de dano) em vez de +1 (Sanidade máx. 48).'
        },
        {
            id: 'jorge',
            name: 'Seu Jorge',
            role: 'TI',
            title: 'Dom Jorge',
            dept: 'Infraestrutura & Cabos',
            badgeCode: 'HC-0101',
            icon: 'ally_jorge',
            maxHp: 60,
            turn1Shield: 0,
            allyId: 'ally_jorge',
            extraCard: 'chicote_dados',
            desc: '+5 de Escudo automático todo turno e começa com 1 "Chicote de Dados" extra (Sanidade 60).'
        },
        {
            id: 'claudia',
            name: 'Cláudia',
            role: 'Financeiro',
            title: 'Dama Cláudia',
            dept: 'Auditoria & VR',
            badgeCode: 'HC-0990',
            icon: 'ally_claudia',
            maxHp: 52,
            turn1Shield: 0,
            allyId: 'ally_claudia',
            extraCard: null,
            desc: '+50% de VR ganho e +3 de dano base em todas as cartas (Sanidade máx. 52).'
        }
    ];

    const FLOOR_CLOCKS = {
        1: '17:15',
        2: '17:30',
        3: '17:45',
        victory: '18:00!'
    };

    const REALITY_FLASH_QUIPS = [
        'Valter... está na sala? Foco na reunião!',
        'Foco no resultado! Onde está o Relatório #25?',
        'Lembre-se do Relatório #25 antes das 18:00...',
        'A luz fluorescente pisca... volte para sua planilha!',
        'Motta? Está olhando para a parede de novo?'
    ];

    const CARDS = {
        mordida_ferro: {
            id: 'mordida_ferro',
            name: 'Mordida de Ferro',
            origin: 'Grampeador Pesado',
            cost: 1,
            type: 'atk',
            target: 'single',
            damage: 15,
            shield: 0,
            heal: 0,
            manaGain: 0,
            knockback: false,
            icon: 'stapler',
            sfx: 'stapler',
            desc: 'Causa {DMG} de dano em 1 alvo.'
        },
        pocao_fogo: {
            id: 'pocao_fogo',
            name: 'Poção de Fogo Líquido',
            origin: 'Café Pelando',
            cost: 1,
            type: 'atk',
            target: 'all',
            damage: 10,
            shield: 0,
            heal: 0,
            manaGain: 0,
            knockback: false,
            icon: 'coffee',
            sfx: 'coffee',
            desc: 'Causa {DMG} de dano em TODOS os inimigos.'
        },
        chicote_dados: {
            id: 'chicote_dados',
            name: 'Chicote de Dados',
            origin: 'Cabo de Rede Cat6',
            cost: 2,
            type: 'ctrl',
            target: 'all',
            damage: 12,
            shield: 0,
            heal: 0,
            manaGain: 0,
            knockback: true,
            icon: 'whip',
            sfx: 'whip',
            desc: 'Causa {DMG} em TODOS + 50% de chance de Knockback em cada um.'
        },
        escudo_burocratico: {
            id: 'escudo_burocratico',
            name: 'Escudo Burocrático',
            origin: "Responder 'Por E-mail'",
            cost: 1,
            type: 'def',
            target: 'single',
            damage: 0,
            shield: 8,
            heal: 0,
            manaGain: 0,
            knockback: true,
            icon: 'shield',
            sfx: 'shield',
            desc: 'Ganha 8 de Escudo + Knockback em 1 inimigo.'
        },
        demissao_silenciosa: {
            id: 'demissao_silenciosa',
            name: 'Demissão Silenciosa',
            origin: 'Modo Pouco Esforço',
            cost: 1,
            type: 'atk',
            target: 'single',
            damage: 22,
            shield: 6,
            heal: 0,
            manaGain: 0,
            knockback: false,
            icon: 'quiet',
            sfx: 'stapler',
            desc: 'Causa {DMG} de dano em 1 alvo e ganha 6 de Escudo.'
        },
        tempestade_cc: {
            id: 'tempestade_cc',
            name: 'Tempestade de CC',
            origin: 'Copiar a Diretoria',
            cost: 2,
            type: 'ctrl',
            target: 'all',
            damage: 18,
            shield: 0,
            heal: 0,
            manaGain: 0,
            knockback: true,
            icon: 'cc',
            sfx: 'whip',
            desc: 'Causa {DMG} em TODOS + 50% de chance de Knockback em cada um.'
        },
        atestado_arcano: {
            id: 'atestado_arcano',
            name: 'Atestado Arcano',
            origin: 'Pergaminho Médico',
            cost: 0,
            type: 'def',
            target: 'self',
            damage: 0,
            shield: 8,
            heal: 12,
            manaGain: 1,
            knockback: false,
            icon: 'medical',
            sfx: 'shield',
            desc: 'Cura 12 Sanidade, +8 Escudo e +1 Cafeína.'
        },
        // ---------- CARTAS EVOLUÍDAS ----------
        vulcao_expresso: {
            id: 'vulcao_expresso',
            name: 'Vulcão de Expresso',
            origin: 'Garrafa Térmica Arcana',
            cost: 1,
            type: 'atk',
            target: 'all',
            damage: 22,
            ignoreShield: true,
            evolved: true,
            shield: 0,
            heal: 0,
            manaGain: 0,
            knockback: false,
            icon: 'vulcao',
            sfx: 'coffee',
            desc: 'EVOLUÍDA: {DMG} de dano em TODOS (ignora escudo).'
        },
        mandibula_ferro: {
            id: 'mandibula_ferro',
            name: 'Mandíbula de Ferro',
            origin: 'Grampeador Industrial',
            cost: 1,
            type: 'atk',
            target: 'single',
            damage: 10,
            hits: 3,
            evolved: true,
            shield: 0,
            heal: 0,
            manaGain: 0,
            knockback: false,
            icon: 'mandibula',
            sfx: 'stapler',
            desc: 'EVOLUÍDA: {DMG} de dano 3x seguidas (sobe Combo por golpe!).'
        },
        muralha_juridica: {
            id: 'muralha_juridica',
            name: 'Muralha Jurídica',
            origin: 'Cópia Oculta (CCO)',
            cost: 1,
            type: 'def',
            target: 'all',
            damage: 0,
            shield: 18,
            evolved: true,
            heal: 0,
            manaGain: 0,
            knockback: true,
            knockbackChance: 0.6,
            icon: 'muralha',
            sfx: 'shield',
            desc: 'EVOLUÍDA: +18 de Escudo e 60% de chance de atordoar cada inimigo.'
        },
        // ---------- MALDIÇÃO DO RH ----------
        ata_reuniao: {
            id: 'ata_reuniao',
            name: 'Ata de Reunião',
            origin: 'Burocracia da Carmem',
            cost: 2,
            type: 'curse',
            target: 'self',
            damage: 0,
            shield: 0,
            heal: 0,
            manaGain: 0,
            knockback: false,
            purgeOnPlay: true,
            icon: 'ata',
            sfx: 'card',
            desc: 'Inútil. Pague 2 Cafeína para arquivar e remover da mão.'
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
            title: 'Garrafa Térmica',
            origin: 'Relíquia da Copa',
            icon: 'thermos',
            fromCard: 'pocao_fogo',
            toCard: 'vulcao_expresso',
            desc: 'Evolui Poção de Fogo Líquido -> Vulcão de Expresso (22 dano em TODOS + ignora escudo).'
        },
        {
            passiveId: 'rel_grampos',
            title: 'Caixa de Grampos',
            origin: 'Arsenal 26/6',
            icon: 'staple_box',
            fromCard: 'mordida_ferro',
            toCard: 'mandibula_ferro',
            desc: 'Evolui Mordida de Ferro -> Mandíbula de Ferro (10 de dano 3x seguidas!).'
        },
        {
            passiveId: 'rel_cco',
            title: 'Cópia Oculta (CCO)',
            origin: 'Blindagem por E-mail',
            icon: 'cco_shield',
            fromCard: 'escudo_burocratico',
            toCard: 'muralha_juridica',
            desc: 'Evolui Escudo Burocrático -> Muralha Jurídica (+18 Escudo e 60% de chance de atordoar cada inimigo).'
        }
    ];

    const ALLIES = [
        {
            id: 'ally_jorge',
            name: 'Seu Jorge do TI',
            role: 'Guardião do Firewall',
            cost: 65,
            icon: 'ally_jorge',
            desc: '+5 de Escudo automático no início de todo turno.'
        },
        {
            id: 'ally_vivi',
            name: 'Vivi da Arte',
            role: 'Maga do Layout',
            cost: 65,
            icon: 'ally_vivi',
            desc: 'O Combo sobe +2 níveis por carta (+50% de dano) em vez de +1.'
        },
        {
            id: 'ally_claudia',
            name: 'Cláudia do Financeiro',
            role: 'Alquimista do VR',
            cost: 65,
            icon: 'ally_claudia',
            desc: '+50% de VR ganho e +3 de dano extra em todas as cartas.'
        }
    ];

    // Atributos base = Andar 1. "tiers" sobrescreve HP/ATK (e extras) nos Andares 2 e 3.
    // attackStyle: 'lunge' (investida), 'paper' (projétil de planilha) ou 'wave' (onda sônica).
    const ENEMIES = {
        goblin: {
            kind: 'goblin',
            name: 'Goblin Perguntador',
            origin: 'Estagiário Perdido',
            hp: 25,
            atk: 4,
            xp: 35,
            vr: 9,
            immuneKnockback: false,
            attackStyle: 'lunge',
            scale: 1.0,
            tiers: { 2: { hp: 55, atk: 7 }, 3: { hp: 85, atk: 10 } },
            quip: '"Ei, Valter, você tem 5 minutinhos?"'
        },
        slime: {
            kind: 'slime',
            name: 'Limo da Geladeira',
            origin: 'Marmita de 2024',
            hp: 30,
            atk: 5,
            xp: 40,
            vr: 12,
            immuneKnockback: false,
            attackStyle: 'lunge',
            scale: 1.02,
            tiers: { 2: { hp: 65, atk: 8 }, 3: { hp: 95, atk: 11 } },
            quip: '"Glub... esquecido no fundo da copa desde janeiro!"'
        },
        cultist: {
            kind: 'cultist',
            name: 'Cultista do Mindset',
            origin: 'Coach Corporativo',
            hp: 28,
            atk: 4,
            xp: 45,
            vr: 13,
            immuneKnockback: false,
            buffAllies: 2,
            attackStyle: 'wave',
            scale: 1.04,
            tiers: { 2: { hp: 60, atk: 7, buffAllies: 3 }, 3: { hp: 90, atk: 10, buffAllies: 3 } },
            quip: '"Trabalhe enquanto eles dormem!"'
        },
        gorgon: {
            kind: 'gorgon',
            name: 'Górgona da Bandeja 2',
            origin: 'Impressora Possuída',
            hp: 40,
            atk: 6,
            xp: 52,
            vr: 17,
            immuneKnockback: false,
            enemyShield: 8,
            attackStyle: 'paper',
            scale: 1.08,
            tiers: { 2: { hp: 80, atk: 10, enemyShield: 12 }, 3: { hp: 120, atk: 15, enemyShield: 16 } },
            quip: '"PC LOAD LETTER! Cuspo folhas cortantes!"'
        },
        harpy: {
            kind: 'harpy',
            name: 'Harpia do Corredor',
            origin: 'Colega Fofoqueiro',
            hp: 35,
            atk: 6,
            xp: 45,
            vr: 15,
            immuneKnockback: false,
            attackStyle: 'lunge',
            scale: 1.06,
            tiers: { 2: { hp: 70, atk: 9 }, 3: { hp: 105, atk: 13 } },
            quip: '"Fiquei sabendo que vai ter reestruturação..."'
        },
        lich: {
            kind: 'lich',
            name: 'Lich das Planilhas',
            origin: 'Gerente - Chefe Andar 1',
            hp: 110,
            atk: 10,
            xp: 100,
            vr: 40,
            immuneKnockback: true,
            isBoss: true,
            attackStyle: 'paper',
            scale: 1.2,
            quip: '"Preciso dessa PROCV pra ontem!"'
        },
        carmem: {
            kind: 'carmem',
            name: 'Dona Carmem do RH',
            origin: 'Inquisidora do Feedback - Andar 2',
            hp: 165,
            atk: 13,
            xp: 140,
            vr: 50,
            immuneKnockback: true,
            curseCard: 'ata_reuniao',
            isBoss: true,
            attackStyle: 'paper',
            scale: 1.22,
            quip: '"Assine já esta Ata de Reunião!"'
        },
        valdemar: {
            kind: 'valdemar',
            name: 'Lorde Valdemar, O CEO',
            origin: 'Soberano do C-Level - Chefe Final',
            hp: 260,
            atk: 16,
            xp: 220,
            vr: 95,
            immuneKnockback: true,
            doubleIfUnshielded: true,
            summonKind: 'goblin',
            summonEvery: 3,
            isBoss: true,
            attackStyle: 'paper',
            scale: 1.26,
            quip: '"Sem escudo? Receba corte de verba em DOBRO!"'
        }
    };

    // Máximo de inimigos vivos simultâneos (limite para invocações do CEO).
    const MAX_ENEMIES_IN_COMBAT = 4;

    function getEnemyStats(kind, floorNum) {
        const tpl = ENEMIES[kind];
        if (!tpl) return null;
        const tier = (tpl.tiers && tpl.tiers[floorNum]) || null;
        return tier ? Object.assign({}, tpl, tier) : tpl;
    }

    // ---------- ECONOMIA & REGRAS DE BALANCEAMENTO ----------
    const BALANCE = {
        comboStep: 0.25,       // +25% de dano por nível de combo acima de x1
        comboMaxMult: 2.5,     // teto do multiplicador de combo
        areaStunChance: 0.5,   // chance de Knockback por inimigo em cartas de área
        maxHpCap: 75,          // teto de Sanidade Máxima
        maxAllies: 2,          // aliados ativos por run
        ambushDamage: 4,       // dano da EMBOSCADA antes do Turno 1
        aggroRange: 2,         // tiles de linha de visão que iniciam o combate
        patrolRadius: 4,       // raio (tiles) em que os encontros perseguem o jogador
        patrolEverySteps: 2,   // encontros andam 1 casa a cada N passos do jogador
        overkillVr: 6,
        overkillXp: 15,
        shop: { coffeePrice: 25, coffeeHeal: 20, relicPrice: 45, tonicPrice: 30, cardPrice: 35 }
    };

    function getComboMult(combo) {
        return Math.min(BALANCE.comboMaxMult, 1 + BALANCE.comboStep * (Math.max(1, combo) - 1));
    }

    const LEVEL_UP_REWARDS = [
        {
            id: 'fones_anti_ruido',
            kind: 'passiva',
            title: 'Fones Anti-Ruído',
            origin: 'Isolamento Acústico',
            icon: 'headphones',
            desc: 'Passiva: +20% de dano em TODAS as cartas pelo resto do expediente.',
            apply: function (state) {
                state.damageMult += 0.2;
                state.passives.push({ label: 'Fones Anti-Ruído (+20% Dano)', icon: 'headphones' });
            }
        },
        {
            id: 'expresso_duplo',
            kind: 'passiva',
            title: 'Expresso Duplo',
            origin: 'Cafeteira Italiana',
            icon: 'espresso',
            desc: '+1 Cafeína máxima por turno e cura 15 de Sanidade imediatamente.',
            apply: function (state) {
                state.maxMana += 1;
                state.mana += 1;
                state.hp = Math.min(state.maxHp, state.hp + 15);
                state.passives.push({ label: 'Expresso Duplo (+1 Cafeína)', icon: 'espresso' });
            }
        },
        {
            id: 'add_demissao_silenciosa',
            kind: 'carta',
            title: 'Demissão Silenciosa',
            origin: 'Modo Pouco Esforço',
            icon: 'quiet',
            desc: 'Adiciona ao deck: Custo 1 — 22 de dano em 1 alvo + 6 de Escudo.',
            apply: function (state) {
                state.deck.push('demissao_silenciosa');
                state.discardPile.push('demissao_silenciosa');
            }
        },
        {
            id: 'add_tempestade_cc',
            kind: 'carta',
            title: 'Tempestade de CC',
            origin: 'Copiar a Diretoria',
            icon: 'cc',
            desc: 'Adiciona ao deck: Custo 2 — 18 de dano em TODOS + 50% de Knockback.',
            apply: function (state) {
                state.deck.push('tempestade_cc');
                state.discardPile.push('tempestade_cc');
            }
        },
        {
            id: 'add_atestado_arcano',
            kind: 'carta',
            title: 'Atestado Arcano',
            origin: 'Pergaminho Médico',
            icon: 'medical',
            desc: 'Adiciona ao deck: Custo 0 — Cura 12 Sanidade, +8 Escudo e +1 Cafeína.',
            apply: function (state) {
                state.deck.push('atestado_arcano');
                state.discardPile.push('atestado_arcano');
            }
        },
        {
            id: 'reajuste_vr',
            kind: 'passiva',
            title: 'Reajuste de VR',
            origin: 'Acordo Coletivo',
            icon: 'vr_boost',
            desc: '+5 Sanidade Máxima (teto 75), cura 15 e +25 VR no bolso.',
            apply: function (state) {
                state.maxHp = Math.min(BALANCE.maxHpCap, state.maxHp + 5);
                state.hp = Math.min(state.maxHp, state.hp + 15);
                state.vr += 25;
                state.passives.push({ label: 'Reajuste de VR (+5 HP Máx)', icon: 'vr_boost' });
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

    // 3 Andares da Torre Corporativa:
    // '#' = parede | '.' = corredor | 'S' = início | '1','2','3' = encontros
    // 'B' = Chefe do Andar | 'C' = Baú | 'M' = Máquina de Café (Loja) | '?' = Evento | 'E' = Elevador
    const FLOORS = [
        {
            floor: 1,
            name: 'Catacumbas das Baias',
            bossName: 'Lich das Planilhas',
            exitHint: 'Elevador destrancado! Suba para o Andar 2 (Pântano da Copa).',
            layout: [
                '#############',
                '#C..4...E..C#',
                '#.#...#.#.###',
                '#..?..B..5..#',
                '###.#.###.#.#',
                '#M..3.#...#.#',
                '#.###.#.###.#',
                '#..2..#..?..#',
                '#.###.###.#.#',
                '#..1......#C#',
                '#####.###.#.#',
                '#..?..S.....#',
                '#############'
            ],
            encounters: {
                '1': {
                    zone: 'Ala Oeste das Baias',
                    intro: 'Dois estagiários perdidos bloqueiam o corredor lateral com dúvidas urgentes!',
                    enemies: ['goblin', 'goblin']
                },
                '2': {
                    zone: 'Sala dos Coaches',
                    intro: 'Um Cultista do Mindset discursa enquanto um Limo avança!',
                    enemies: ['slime', 'cultist']
                },
                '3': {
                    zone: 'Corredor da TI',
                    intro: 'Uma Górgona da Bandeja 2 imprime lâminas diante de um Goblin!',
                    enemies: ['goblin', 'gorgon']
                },
                '4': {
                    zone: 'Arquivo Morto',
                    intro: 'Uma Harpia fofoqueira e dois Goblins vigiam o cofre do arquivo!',
                    enemies: ['goblin', 'harpy', 'goblin']
                },
                '5': {
                    zone: 'Ala Leste de Reuniões',
                    intro: 'Um Cultista, uma Harpia e um Limo preparam uma dinâmica de grupo forçada!',
                    enemies: ['slime', 'cultist', 'harpy']
                },
                'B': {
                    zone: 'Sala da Gerência',
                    intro: 'CHEFE DO ANDAR 1: O LICH DAS PLANILHAS ergue seu Excel arcano!',
                    isBoss: true,
                    enemies: ['goblin', 'lich', 'cultist']
                }
            }
        },
        {
            floor: 2,
            name: 'Pântano da Copa',
            bossName: 'Dona Carmem do RH',
            exitHint: 'Elevador destrancado! Suba para a Cobertura do C-Level (Andar Final).',
            layout: [
                '#############',
                '#C..4...E..C#',
                '#.#.###.#.###',
                '#.#..B..#..5#',
                '#.###.#.###.#',
                '#..?..#..3..#',
                '#.###.#.###.#',
                '#..2..M..?..#',
                '#.#.###.###.#',
                '#.#..1....#C#',
                '#.#.###.#.#.#',
                '#.....S.....#',
                '#############'
            ],
            encounters: {
                '1': {
                    zone: 'Pia das Marmitas',
                    intro: 'Duas marmitas esquecidas de 2024 ganharam consciência e um Goblin veio junto!',
                    enemies: ['slime', 'goblin', 'slime']
                },
                '2': {
                    zone: 'Corredor do Micro-ondas',
                    intro: 'Um Cultista do Mindset motiva uma Górgona da Bandeja 2 e um Limo!',
                    enemies: ['slime', 'cultist', 'gorgon']
                },
                '3': {
                    zone: 'Ala Leste do Feedback',
                    intro: 'Fofocas e impressoras cercam a passagem do RH!',
                    enemies: ['harpy', 'slime', 'gorgon']
                },
                '4': {
                    zone: 'Despensa Tóxica',
                    intro: 'Um Limo gigante, uma Harpia e um Goblin protegem o estoque da copa!',
                    enemies: ['slime', 'harpy', 'goblin']
                },
                '5': {
                    zone: 'Sala de Dinâmica',
                    intro: 'Dois Cultistas do Mindset alinham os chakras de uma Harpia e um Goblin!',
                    enemies: ['goblin', 'cultist', 'harpy', 'cultist']
                },
                'B': {
                    zone: 'Inquisição do RH',
                    intro: 'CHEFE DO ANDAR 2: DONA CARMEM DO RH traz Atas de Reunião amaldiçoadas!',
                    isBoss: true,
                    enemies: ['cultist', 'carmem', 'harpy']
                }
            }
        },
        {
            floor: 3,
            name: 'Cobertura do C-Level',
            bossName: 'Lorde Valdemar, O CEO',
            exitHint: 'Cobertura dominada!',
            layout: [
                '#############',
                '#C....E....C#',
                '#.###.#.###.#',
                '#..4..B..5..#',
                '#.#.###.###.#',
                '#.#..?..3..M#',
                '#.###.#.###.#',
                '#..2..#..?..#',
                '#.###.#.###.#',
                '#C....#..1..#',
                '#.###.#.###.#',
                '#.....S.....#',
                '#############'
            ],
            encounters: {
                '1': {
                    zone: 'Ala Leste Executiva',
                    intro: 'Seguranças burocráticos de elite do C-Level bloqueiam o tapete dourado!',
                    enemies: ['harpy', 'cultist', 'gorgon']
                },
                '2': {
                    zone: 'Galeria dos Acionistas',
                    intro: 'Cultistas e Harpias preparam o relatório trimestral!',
                    enemies: ['cultist', 'harpy', 'gorgon']
                },
                '3': {
                    zone: 'Ante-sala da Copa VIP',
                    intro: 'Górgonas de elite e um Limo guardam a máquina de café executiva!',
                    enemies: ['gorgon', 'slime', 'gorgon']
                },
                '4': {
                    zone: 'Guarda Oeste da Presidência',
                    intro: 'A guarda de elite protege o flanco esquerdo do CEO!',
                    enemies: ['goblin', 'harpy', 'cultist', 'slime']
                },
                '5': {
                    zone: 'Guarda Leste da Presidência',
                    intro: 'Última barreira no flanco direito: Górgonas de elite em formação!',
                    enemies: ['gorgon', 'cultist', 'harpy', 'gorgon']
                },
                'B': {
                    zone: 'Trono do CEO',
                    intro: 'CHEFE FINAL: LORDE VALDEMAR, O CEO! Sem Escudo o dano é em DOBRO e ele invoca Estagiários!',
                    isBoss: true,
                    enemies: ['cultist', 'valdemar', 'gorgon']
                }
            }
        }
    ];

    const CORRIDOR_EVENTS = [
        {
            id: 'gerente_corredor',
            title: 'Você avista seu gerente no corredor',
            desc: 'Ele vem carregando uma pilha de relatórios urgentes e olha direto na sua direção.',
            choices: [
                {
                    label: 'Fingir que está numa call importantíssima',
                    hint: 'Ganhe +20 VR e +15 Horas Extras (50% chance de -6 Sanidade se ele perceber)',
                    effect: function (state, helpers) {
                        state.vr += helpers.scaleVr(20);
                        helpers.addXp(15);
                        if (Math.random() < 0.5) {
                            state.hp = Math.max(1, state.hp - 6);
                            return 'Ele desconfiou do seu fone desligado! -6 Sanidade, +20 VR e +15 XP.';
                        }
                        return 'Blefe perfeito de Sir Valter! Ele seguiu reto. +20 VR e +15 XP.';
                    }
                },
                {
                    label: 'Assumir o BO e responder na hora',
                    hint: 'Causa combate surpresa, mas rende +25 VR extra se vencer',
                    effect: function (state, helpers) {
                        state.vr += helpers.scaleVr(25);
                        helpers.triggerAmbush(['goblin', 'cultist'], 'Seu gerente jogou um estagiário e um coach em cima de você! (+25 VR)');
                        return null;
                    }
                }
            ]
        },
        {
            id: 'geladeira_copa',
            title: 'Geladeira Misteriosa da Copa',
            desc: 'Há um pote sem etiqueta brilhando em verde neon ao lado de um energético lacrado.',
            choices: [
                {
                    label: 'Beber o energético lacrado com fé',
                    hint: 'Cura +18 Sanidade e +10 Horas Extras',
                    effect: function (state, helpers) {
                        state.hp = Math.min(state.maxHp, state.hp + 18);
                        helpers.addXp(10);
                        return 'Cafeína pura! +18 Sanidade e +10 Horas Extras.';
                    }
                },
                {
                    label: 'Investigar a marmita brilhante de 2024',
                    hint: '+35 VR escondidos atrás do pote OU emboscada do Limo',
                    effect: function (state, helpers) {
                        if (Math.random() < 0.55) {
                            const gained = helpers.scaleVr(35);
                            state.vr += gained;
                            return 'Você achou vale-refeição caído atrás da bandeja! +' + gained + ' VR.';
                        }
                        helpers.triggerAmbush(['slime'], 'A marmita criou pernas! Um Limo da Geladeira atacou!');
                        return null;
                    }
                }
            ]
        },
        {
            id: 'impressora_travada',
            title: 'Impressora Travada na Bandeja 2',
            desc: 'A luz vermelha pisca freneticamente enquanto solta fumaça e folhetos amassados.',
            choices: [
                {
                    label: 'Abrir a tampa e consertar como herói do TI',
                    hint: '-8 Sanidade pelo estresse, mas adiciona "Demissão Silenciosa" ou +30 VR',
                    effect: function (state, helpers) {
                        state.hp = Math.max(1, state.hp - 8);
                        const gained = helpers.scaleVr(30);
                        state.vr += gained;
                        state.deck.push('demissao_silenciosa');
                        state.discardPile.push('demissao_silenciosa');
                        return 'Papel desatolado! -8 Sanidade, +' + gained + ' VR e ganhou carta Demissão Silenciosa!';
                    }
                },
                {
                    label: 'Colar post-it "EM MANUTENÇÃO" e sair de fininho',
                    hint: 'Cura +8 Sanidade sem riscos',
                    effect: function (state) {
                        state.hp = Math.min(state.maxHp, state.hp + 8);
                        return 'Problema terceirizado com sucesso! +8 Sanidade.';
                    }
                }
            ]
        },
        {
            id: 'licitacao_cafe',
            title: 'Carrinho de Lanches Clandestino',
            desc: 'Um colega do departamento ao lado oferece um combo duvidoso de coxinha e e-mail pronto.',
            choices: [
                {
                    label: 'Pagar 15 VR pelo combo completo',
                    hint: 'Gasta 15 VR, cura +22 Sanidade e ganha +25 XP',
                    effect: function (state, helpers) {
                        if (state.vr < 15) {
                            state.hp = Math.min(state.maxHp, state.hp + 6);
                            return 'Sem VR suficiente, você ganhou só um copo de água (+6 Sanidade).';
                        }
                        state.vr -= 15;
                        state.hp = Math.min(state.maxHp, state.hp + 22);
                        helpers.addXp(25);
                        return 'Coxinha revigorante! +22 Sanidade e +25 Horas Extras.';
                    }
                },
                {
                    label: 'Negociar desconto agressivo',
                    hint: 'Ganha +20 VR ou enfrenta uma Harpia fofoqueira',
                    effect: function (state, helpers) {
                        if (Math.random() < 0.6) {
                            const gained = helpers.scaleVr(20);
                            state.vr += gained;
                            return 'Você vendeu seus boletos antigos! +' + gained + ' VR.';
                        }
                        helpers.triggerAmbush(['harpy'], 'O preço gerou fofoca no corredor! Uma Harpia surgiu!');
                        return null;
                    }
                }
            ]
        }
    ];

    const CHEST_LOOT = [
        {
            title: 'Cafeteira Escondida',
            text: 'Cápsulas extras e biscoitos! +15 Sanidade, +25 VR e +25 Horas Extras.',
            hp: 15,
            vr: 25,
            xp: 25
        },
        {
            title: 'Gaveta de Benefícios',
            text: 'Tickets de Vale-Refeição esquecidos! +12 Sanidade, +40 VR e +20 Horas Extras.',
            hp: 12,
            vr: 40,
            xp: 20
        },
        {
            title: 'Armário de Suprimentos',
            text: 'Resmas de papel e energético gelado! +18 Sanidade, +30 VR e +30 Horas Extras.',
            hp: 18,
            vr: 30,
            xp: 30
        }
    ];

    // Validação estrita do grid: mapa retangular e murado, um único início, todo símbolo de
    // encontro definido e todo tile especial (encontro, baú, evento, loja, elevador) em piso
    // caminhável alcançável a partir do início. Retorna a lista de problemas (vazia = ok).
    function isWalkableTile(layout, x, y) {
        return y >= 0 && y < layout.length && x >= 0 && x < layout[y].length && layout[y][x] !== '#';
    }

    function validateFloors() {
        const problems = [];
        FLOORS.forEach(fl => {
            const L = fl.layout;
            const tag = 'Andar ' + fl.floor + ': ';
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
            Object.keys(fl.encounters).forEach(ch => {
                if (!L.some(row => row.includes(ch))) problems.push(tag + 'encontro "' + ch + '" sem tile no mapa');
                fl.encounters[ch].enemies.forEach(kind => {
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

    function getZoneName(x, y, floorNum) {
        const fl = getFloorConfig(floorNum);
        return 'Andar ' + fl.floor + ': ' + fl.name;
    }

    window.GameData = {
        PROTAGONIST: PROTAGONIST,
        CHARACTERS: CHARACTERS,
        FLOOR_CLOCKS: FLOOR_CLOCKS,
        REALITY_FLASH_QUIPS: REALITY_FLASH_QUIPS,
        CARDS: CARDS,
        STARTING_DECK: STARTING_DECK,
        EVOLUTIONS: EVOLUTIONS,
        ALLIES: ALLIES,
        ENEMIES: ENEMIES,
        BALANCE: BALANCE,
        MAX_ENEMIES_IN_COMBAT: MAX_ENEMIES_IN_COMBAT,
        getEnemyStats: getEnemyStats,
        isWalkableTile: isWalkableTile,
        validateFloors: validateFloors,
        getComboMult: getComboMult,
        LEVEL_UP_REWARDS: LEVEL_UP_REWARDS,
        FLOORS: FLOORS,
        MAP_LAYOUT: FLOORS[0].layout,
        ENCOUNTERS: FLOORS[0].encounters,
        CORRIDOR_EVENTS: CORRIDOR_EVENTS,
        CHEST_LOOT: CHEST_LOOT,
        getFloorConfig: getFloorConfig,
        getZoneName: getZoneName
    };
})();

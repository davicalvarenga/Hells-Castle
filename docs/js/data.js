// Dados de cartas, inimigos, recompensas de Level Up e mapa do escritório-masmorra.
(function () {
    'use strict';

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
            desc: 'Causa {DMG} em TODOS + Knockback (atordoa 1 turno).'
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
            desc: 'Causa {DMG} em TODOS + Knockback.'
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

    const ENEMIES = {
        goblin: {
            kind: 'goblin',
            name: 'Goblin Perguntador',
            origin: 'Estagiário Perdido',
            hp: 25,
            atk: 4,
            xp: 35,
            vr: 15,
            immuneKnockback: false,
            scale: 1.0,
            quip: '"Ei, você tem 5 minutinhos?"'
        },
        harpy: {
            kind: 'harpy',
            name: 'Harpia do Corredor',
            origin: 'Colega Fofoqueiro',
            hp: 35,
            atk: 6,
            xp: 45,
            vr: 25,
            immuneKnockback: false,
            scale: 1.08,
            quip: '"Fiquei sabendo que vai ter reestruturação..."'
        },
        lich: {
            kind: 'lich',
            name: 'Lich das Planilhas',
            origin: 'Gerente - Chefe Final',
            hp: 90,
            atk: 10,
            xp: 120,
            vr: 100,
            immuneKnockback: true,
            scale: 1.22,
            quip: '"Preciso desse relatório pra ontem. Sem hora extra!"'
        }
    };

    const LEVEL_UP_REWARDS = [
        {
            id: 'fones_anti_ruido',
            kind: 'passiva',
            title: 'Fones Anti-Ruído',
            origin: 'Isolamento Acústico',
            icon: 'headphones',
            desc: 'Passiva: +20% de dano em TODAS as cartas de ataque pelo resto do expediente.',
            apply: function (state) {
                state.damageMult += 0.2;
                state.passives.push('Fones Anti-Ruído (+20% Dano)');
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
                state.passives.push('Expresso Duplo (+1 Cafeína)');
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
            desc: 'Adiciona ao deck: Custo 2 — 18 de dano em TODOS + Knockback.',
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
            desc: '+15 Sanidade Máxima (cura 15) e +50 VR no bolso.',
            apply: function (state) {
                state.maxHp += 15;
                state.hp = Math.min(state.maxHp, state.hp + 15);
                state.vr += 50;
                state.passives.push('Reajuste de VR (+15 Sanidade Máx)');
            }
        }
    ];

    // Mapa 13x13 do Escritório-Masmorra:
    // '#' = parede (baia sombria)
    // '.' = piso caminhável
    // 'S' = início (Catraca de Entrada), olhando para Norte (-Y)
    // '1' = Encontro 1: Corredor das Baias (2x Goblin Perguntador)
    // '2' = Encontro 2: Copa Amaldiçoada (1x Goblin + 1x Harpia)
    // '3' = Encontro 3: Sala de Reunião (2x Harpia + 1x Goblin)
    // 'B' = Encontro 4: Sala da Diretoria (Lich das Planilhas + 1x Goblin + 1x Harpia)
    // 'C' = Baú / Máquina de Café Arcana
    // 'E' = Saída (Portal das 18h / Elevador)
    const MAP_LAYOUT = [
        '#############',
        '#.....E.....#',
        '#.###...###.#',
        '#C#...B...#C#',
        '#.#.......#.#',
        '#...#.3.#...#',
        '#.###...###.#',
        '#..C..2..C..#',
        '#.###...###.#',
        '#.....1.....#',
        '#.###...###.#',
        '#.....S.....#',
        '#############'
    ];

    const ENCOUNTERS = {
        '1': {
            zone: 'Corredor das Baias',
            intro: 'Dois estagiários perdidos bloqueiam a passagem com dúvidas urgentes!',
            enemies: ['goblin', 'goblin']
        },
        '2': {
            zone: 'Copa Amaldiçoada',
            intro: 'Na copa sem café, um fofoqueiro e um estagiário te encurralam!',
            enemies: ['goblin', 'harpy']
        },
        '3': {
            zone: 'Sala de Reunião',
            intro: 'Uma "call de alinhamento" surpresa! Duas Harpias e um Goblin cercam a mesa.',
            enemies: ['harpy', 'goblin', 'harpy']
        },
        'B': {
            zone: 'Sala da Diretoria',
            intro: 'O LICH DAS PLANILHAS ergue seu Excel arcano! Derrote o Gerente para bater o ponto!',
            isBoss: true,
            enemies: ['goblin', 'lich', 'harpy']
        }
    };

    const CHEST_LOOT = [
        {
            title: 'Cafeteira Escondida',
            text: 'Você encontrou cápsulas extras e um pacote de biscoitos! +15 Sanidade, +25 VR e +25 Horas Extras.',
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

    function getZoneName(x, y) {
        if (y <= 3) return 'Ala da Diretoria';
        if (y <= 5) return 'Sala de Reunião';
        if (y <= 7) return 'Copa Amaldiçoada';
        if (y <= 9) return 'Corredor das Baias';
        return 'Recepção das Catracas';
    }

    window.GameData = {
        CARDS: CARDS,
        STARTING_DECK: STARTING_DECK,
        ENEMIES: ENEMIES,
        LEVEL_UP_REWARDS: LEVEL_UP_REWARDS,
        MAP_LAYOUT: MAP_LAYOUT,
        ENCOUNTERS: ENCOUNTERS,
        CHEST_LOOT: CHEST_LOOT,
        getZoneName: getZoneName
    };
})();

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
            maxHp: 50,
            turn1Shield: 4,
            desc: 'Sozinho contra os próprios devaneios: Sanidade 50, Mana 3, 4 cartas por turno e +4 Escudo no Turno 1.'
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

    // ---------- ECONOMIA & REGRAS DE BALANCEAMENTO (Vampire Crawlers v1.6.1a) ----------
    const XP_TABLE = [18, 36, 63, 100, 145, 200, 260, 335, 415, 505, 610, 740];

    const BALANCE = {
        baseHealth: 50,
        baseMana: 3,
        dealCount: 4,
        maxCardLevel: 2,
        maxHpCap: 85,          // teto de Sanidade Máxima
        maxManaCap: 5,         // Cafeína máx.
        ambushDamage: 4,       // dano da EMBOSCADA antes do Turno 1
        aggroRange: 2,         // tiles de linha de visão que iniciam o combate
        patrolRadius: 4,       // raio (tiles) em que os encontros perseguem o jogador
        patrolEverySteps: 2,   // encontros andam 1 casa a cada N passos do jogador
        xpFirstLevel: XP_TABLE[0],
        overkillVr: 2,
        overkillXp: 6,
        maxHandSize: 6,
        combatAmountCap: 3,        // teto de +Amount vindo de cartas suporte por combate
        areaSplashRatio: 0.2,      // splash = dmg * (Area/100) * 0.2 nas outras colunas ocupadas
        critExplosionRatio: 0.5,   // fração do dano crítico que explode em col-1 e col+1
        bouncyDecay: 0.5,          // a chance de pierce extra cai pela metade a cada quique
        bossPhaseThresholds: [0.66, 0.33],
        manaBombBase: 4,
        manaBombStep: 3,           // a Bomba de Mana cresce a cada explosão no mesmo combate
        extraBreathShield: 12,
        extraBreathMana: 1,
        minDeckSize: 5,
        gemLeaderBonus: 0.2,       // Líder na mão: +20% de dano (não acumula)
        gemDrainHeal: 1,
        gemStealVr: 3,
        gemDiscardVr: 8,           // VR ao recusar uma gema
        gemRewardChance: 0.2,      // chance (x Luck) de uma opção do Level Up virar gema
        freezeBossAtkRatio: 0.5,   // quem resiste a desarme (chefes) só perde metade do ataque
        freezeDamageMult: 1.5,     // golpe em inimigo com gelo: ceil(dano * 1.5), consome 1 stack
        durationFrostStep: 50,     // a cada 50% de Duration, +1 stack de gelo aplicado
        eliteHpMult: 1.8,
        eliteAtkMult: 1.25,
        eliteXpMult: 2,
        eliteVrBonus: 12,
        eliteKbResist: 50,
        eliteHexEvery: 3,          // Elite troca 1 ataque a cada N turnos por Aumentar Curse
        curseStep: 10,             // % por intenção de Curse
        curseCap: 50,
        revivalMax: 3,
        arcanaComboCarryCap: 4,    // Elo da Corrente: combo máximo carregado entre turnos
        arcanaShieldCarryCap: 40,  // Escudo Soberbo
        arcanaManaCarry: 4,        // Mente Afiada
        rest: { healPrice: 25, healAmount: 20, removePrices: [30, 50, 70], relicPrice: 45, breathPrice: 45, gemPrice: 40 }
    };

    function getXpForLevel(level) {
        const idx = Math.max(0, (level || 1) - 1);
        if (idx < XP_TABLE.length) return XP_TABLE[idx];
        return XP_TABLE[XP_TABLE.length - 1] + (idx - XP_TABLE.length + 1) * 130;
    }

    // costMod: modificador temporário da carta na mão (carta-lixo Confusão).
    function getEffectiveCost(card, costMod) {
        if (!card) return 0;
        return Math.max(0, (card.cost || 0) + (costMod || 0));
    }

    function isWildCard(card) {
        return !!card && (card.isWild || card.type === 'wild');
    }

    // reverse: a carta anterior tinha a gema Combo Reverso, então descer 1 no custo também comba.
    function canCardCombo(card, lastComboCost, costMod, reverse) {
        if (!card || card.type === 'curse') return false;
        if (lastComboCost === null || lastComboCost === undefined) return false;
        if (isWildCard(card)) return true;
        const cost = getEffectiveCost(card, costMod);
        return cost - 1 === lastComboCost || (!!reverse && cost + 1 === lastComboCost);
    }

    // Custo que a carta jogada registra na cadeia. Wild registra -1: a escada recomeça no custo 0.
    function getComboCostAfter(card, costMod) {
        return isWildCard(card) ? -1 : getEffectiveCost(card, costMod);
    }

    function getComboMult(comboCount) {
        return Math.max(0, comboCount || 0) + 1;
    }

    // ---------- GEMAS (CardGemsModel) ----------
    // needsDamage: só encaixa em carta que causa dano. incompatibleWith vale nos dois sentidos.
    const GEMS = {
        mana_minus: { id: 'mana_minus', name: 'Mana -1', glyph: '-1', color: '#4fc3f7', tags: ['custo'],
            incompatibleWith: ['mana_plus'], desc: 'Custo -1: encaixa a carta um degrau abaixo na escada de combo.' },
        mana_plus: { id: 'mana_plus', name: 'Mana +1', glyph: '+1', color: '#7986cb', tags: ['custo'],
            incompatibleWith: ['mana_minus'], desc: 'Custo +1: encaixa a carta um degrau acima na escada de combo.' },
        wild: { id: 'wild', name: 'Coringa', glyph: 'W', color: '#ffd147', tags: ['combo'],
            incompatibleWith: ['reverse', 'mana_minus', 'mana_plus'], desc: 'A carta vira Wild: sempre comba.' },
        ret: { id: 'ret', name: 'Retornar', glyph: 'R', color: '#81c784', tags: ['mão'],
            incompatibleWith: ['retain'], desc: 'Return: volta para a mão 1x ao ser jogada.' },
        retain: { id: 'retain', name: 'Reter', glyph: 'T', color: '#a5d6a7', tags: ['mão'],
            incompatibleWith: ['ret'], desc: 'Retain: permanece na mão no fim do turno.' },
        swift: { id: 'swift', name: 'Compra Rápida', glyph: 'S', color: '#80deea', tags: ['mão'],
            incompatibleWith: [], desc: 'Swift: vem garantida na mão inicial de cada combate.' },
        double: { id: 'double', name: 'Dano Duplo', glyph: '2x', color: '#ef5350', tags: ['dano'], needsDamage: true,
            incompatibleWith: [], desc: 'Dobra o dano da carta.' },
        drain: { id: 'drain', name: 'Drenagem', glyph: 'D', color: '#f48fb1', tags: ['abate'], needsDamage: true,
            incompatibleWith: ['steal'], desc: 'Ao matar com esta carta: +1 Sanidade.' },
        steal: { id: 'steal', name: 'Saque', glyph: '$', color: '#ffb74d', tags: ['abate'], needsDamage: true,
            incompatibleWith: ['drain'], desc: 'Ao matar com esta carta: +3 VR.' },
        reverse: { id: 'reverse', name: 'Combo Reverso', glyph: '\u00b1', color: '#ba68c8', tags: ['combo'],
            incompatibleWith: ['wild'], desc: 'A próxima carta comba subindo +1 OU descendo -1 no custo.' },
        leader: { id: 'leader', name: 'Líder', glyph: 'L', color: '#fff176', tags: ['mão'],
            incompatibleWith: [], desc: 'Enquanto está na mão: +20% de dano nos ataques (não acumula).' },
        freeze: { id: 'freeze', name: 'Paralisia', glyph: 'F', color: '#b3e5fc', tags: ['controle'], needsDamage: true,
            incompatibleWith: [], desc: 'Aplica 1 Gelo: congelado não ataca (chefes: -50% ATK) e o próximo golpe causa 1.5x.' },
        evolve: { id: 'evolve', name: 'Gema de Evolução', glyph: '\u2605', color: '#ffffff', tags: ['evolução'], instant: true,
            incompatibleWith: [], desc: 'Evolui na hora uma carta que tenha evolução, sem relíquia nem nível.' }
    };

    // Slots visíveis: 1 a 3 conforme o custo (evoluídas sempre 3). Cartas-lixo não têm slot.
    function getCardGemSlots(card) {
        if (!card || card.type === 'curse') return 0;
        if (card.evolved) return 3;
        return Math.min(3, 1 + (card.cost || 0));
    }

    function canSocketGem(card, currentGems, gemId) {
        const gem = GEMS[gemId];
        const gems = currentGems || [];
        if (!gem || !card || card.type === 'curse') return false;
        if (gem.instant) return !!card.evolvesTo && !card.evolved;
        if (gems.length >= getCardGemSlots(card) || gems.includes(gemId)) return false;
        if (gems.some(g => gem.incompatibleWith.includes(g) || GEMS[g].incompatibleWith.includes(gemId))) return false;
        if (gem.needsDamage && !(card.damage > 0)) return false;
        // Gema que não mudaria nada na carta não encaixa.
        if (gemId === 'mana_minus') return (card.cost || 0) >= 1 && !isWildCard(card);
        if (gemId === 'mana_plus' || gemId === 'reverse' || gemId === 'wild') return !isWildCard(card);
        if (gemId === 'ret') return !card.returnTimes && !card.destroy;
        if (gemId === 'retain') return !card.retain && !card.destroy;
        return true;
    }

    // "Carta efetiva": a definição base com as gemas aplicadas. Todo o combate lê a carta por aqui.
    function applyGems(card, gems) {
        if (!card || !gems || gems.length === 0) return card;
        const has = id => gems.includes(id);
        const out = Object.assign({}, card, { gems: gems });
        if (has('mana_minus')) out.cost = Math.max(0, (card.cost || 0) - 1);
        if (has('mana_plus')) out.cost = (card.cost || 0) + 1;
        if (has('wild')) out.isWild = true;
        if (has('ret')) out.returnTimes = 1;
        if (has('retain')) out.retain = true;
        if (has('double')) out.damage = (card.damage || 0) * 2;
        return out;
    }

    function cardHasGem(card, gemId) {
        return !!(card && card.gems && card.gems.includes(gemId));
    }

    // ---------- ARCANAS ("Estados de Espírito" da run) ----------
    const ARCANAS = {
        elo_corrente: { id: 'elo_corrente', name: 'Elo da Corrente', icon: 'c_wild',
            desc: 'O Combo não zera entre turnos: a 1ª carta do turno continua a cadeia.' },
        escudo_soberbo: { id: 'escudo_soberbo', name: 'Escudo Soberbo', icon: 'c_aegis',
            desc: 'O Escudo que sobrar persiste para o próximo turno.' },
        golpe_escudo: { id: 'golpe_escudo', name: 'Golpe de Escudo', icon: 'c_wall',
            desc: 'Ao jogar carta que dá Escudo, causa o Escudo atual como dano na fila da frente.' },
        mente_afiada: { id: 'mente_afiada', name: 'Mente Afiada', icon: 'c_bless',
            desc: 'Até 4 de Cafeína não gasta passam para o próximo turno.' },
        fluxo_combo: { id: 'fluxo_combo', name: 'Fluxo e Combo', icon: 'c_crows',
            desc: 'Ao descartar cartas no fim do turno: 50% de +1 Combo inicial. Se falhar, a próxima é garantida.' }
    };

    // ---------- MIRA NAS 5 COLUNAS (WeaponTargeting) ----------
    // Próxima coluna de um padrão sequencial: LeftRight (0->4) ou RightLeft (4->0), com volta ao início.
    function nextTargetColumn(targeting, occupiedCols, lastCol) {
        if (!occupiedCols || occupiedCols.length === 0) return null;
        const sorted = occupiedCols.slice().sort((a, b) => a - b);
        if (targeting === 'RightLeft') {
            const before = sorted.filter(c => lastCol === null || lastCol === undefined || c < lastCol);
            return before.length > 0 ? before[before.length - 1] : sorted[sorted.length - 1];
        }
        const after = sorted.filter(c => lastCol === null || lastCol === undefined || c > lastCol);
        return after.length > 0 ? after[0] : sorted[0];
    }

    // Random: saco sem repetição. Só repete coluna depois que todas as ocupadas saíram do saco.
    function drawColumnFromBag(bag, occupiedCols, rng) {
        if (!occupiedCols || occupiedCols.length === 0) return null;
        let pool = bag.filter(c => occupiedCols.includes(c));
        if (pool.length === 0) pool = occupiedCols.slice();
        const pick = pool[Math.floor((rng || Math.random)() * pool.length)];
        bag.length = 0;
        pool.forEach(c => { if (c !== pick) bag.push(c); });
        return pick;
    }

    // Knockback (Desarme): kb * (1 - resistance/100) > rand()
    function rollKnockback(knockbackChance, resistance, roll) {
        return knockbackChance * (1 - (resistance || 0) / 100) > roll;
    }

    // Fase do chefe pelo HP: 1 (100%), 2 (<= 66%), 3 (<= 33%).
    function getBossPhase(hp, maxHp) {
        const pct = maxHp > 0 ? hp / maxHp : 0;
        return 1 + BALANCE.bossPhaseThresholds.filter(limit => pct <= limit).length;
    }

    // Cartas: fantasia épica de Valter, com micro-referência ao escritório no subtítulo (origin).
    const CARDS = {
        golpe_furtivo: {
            id: 'golpe_furtivo',
            name: 'Adaga do Crepúsculo',
            origin: 'Estilete do Almoxarifado',
            cost: 0, type: 'atk', target: 'single',
            targeting: 'LeftRight', priority: 'Attacking',
            damage: 5, baseAmount: 1, amountScalesWithCombo: true,
            critChance: 0.10, critMult: 1.5, returnTimes: 1,
            shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'c_dagger', sfx: 'stapler',
            desc: 'Return (1x). {HITS} adaga(s) de {DMG} dano, Esq→Dir em Atacantes. Crit 10% (1.5x).'
        },
        moeda_destino: {
            id: 'moeda_destino',
            name: 'Runa do Acaso',
            origin: 'Moeda do Café',
            cost: 0, type: 'wild', isWild: true, target: 'single',
            targeting: 'Random', pierceType: 'MultiHitSwitchTarget', bouncy: 0.35,
            damage: 5, baseAmount: 1, amountScalesWithCombo: true,
            shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'c_wild', sfx: 'card',
            desc: 'Wild: sempre comba e reinicia a escada no custo 0. {HITS} runa(s) de {DMG} em coluna aleatória; 35% de quicar.'
        },
        atestado_arcano: {
            id: 'atestado_arcano',
            name: 'Bênção do Curandeiro',
            origin: 'Atestado Médico',
            cost: 0, type: 'wild', isWild: true, target: 'self',
            damage: 0, shield: 5, heal: 6, manaGain: 1, scalesWithCombo: true,
            knockback: false,
            icon: 'c_bless', sfx: 'shield',
            desc: 'Wild: sempre comba e reinicia a escada no custo 0. Cura {HEAL} HP, +{SHIELD} Escudo (xCombo) e +1 Cafeína.'
        },
        mordida_ferro: {
            id: 'mordida_ferro',
            name: 'Lâmina do Devaneio',
            origin: 'Abridor de Cartas',
            cost: 1, type: 'atk', target: 'single',
            targeting: 'Target', pierce: 1, pierceType: 'OncePerEnemy',
            damage: 8, baseAmount: 1, amountScalesWithCombo: true,
            critChance: 0.10, critMult: 1.5,
            evolvesTo: 'mandibula_ferro',
            shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'c_sword', sfx: 'stapler',
            desc: 'Golpeia o alvo {HITS}x por {DMG} dano e perfura 1 inimigo atrás dele. Crit 10% (1.5x).'
        },
        pocao_fogo: {
            id: 'pocao_fogo',
            name: 'Sopro de Brasas',
            origin: 'Café Pelando',
            cost: 1, type: 'atk', target: 'all', targeting: 'FrontRow',
            damage: 7, baseAmount: 1, damageScalesWithCombo: true, damageScalesWithAmount: true,
            burn: 3, evolvesTo: 'vulcao_expresso',
            shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'c_flask', sfx: 'coffee',
            desc: 'Onda: {DMG} dano na fila da frente (escala c/ Combo e Amount) + {BURN} Burn por coluna.'
        },
        escudo_burocratico: {
            id: 'escudo_burocratico',
            name: 'Égide do Viajante',
            origin: 'Pasta de Arquivo',
            cost: 1, type: 'def', target: 'single',
            targeting: 'Target', priority: 'Attacking',
            damage: 0, shield: 7, scalesWithCombo: true, retain: true,
            knockback: true, knockbackChance: 0.65,
            evolvesTo: 'muralha_juridica',
            heal: 0, manaGain: 0,
            icon: 'c_aegis', sfx: 'shield',
            desc: 'Retain. +{SHIELD} Escudo (xCombo) e 65% Knockback (Desarme) em 1 atacante.'
        },
        demissao_silenciosa: {
            id: 'demissao_silenciosa',
            name: 'Passo das Sombras',
            origin: 'Saída à Francesa',
            cost: 1, type: 'atk', target: 'single',
            targeting: 'RightLeft', priority: 'Attacking',
            damage: 8, baseAmount: 1, amountScalesWithCombo: true,
            shield: 4, scalesWithCombo: true, returnTimes: 1,
            critChance: 0.15, critMult: 1.5, critExplosion: true,
            heal: 0, manaGain: 0, knockback: false,
            icon: 'c_shadow', sfx: 'stapler',
            desc: 'Return (1x). {HITS} golpe(s) de {DMG}, Dir→Esq em Atacantes + {SHIELD} Escudo. Crit 15% explode nos vizinhos.'
        },
        chicote_dados: {
            id: 'chicote_dados',
            name: 'Chicote Relâmpago',
            origin: 'Cabo de Rede',
            cost: 2, type: 'ctrl', target: 'all', targeting: 'FrontRow',
            damage: 8, baseAmount: 1, damageScalesWithCombo: true, damageScalesWithAmount: true,
            knockback: true, knockbackChance: 0.50,
            shield: 0, heal: 0, manaGain: 0,
            icon: 'c_bolt', sfx: 'whip',
            desc: 'Onda: {DMG} na fila da frente (escala c/ Combo e Amount) + 50% Knockback (Desarme).'
        },
        tempestade_cc: {
            id: 'tempestade_cc',
            name: 'Tempestade de Corvos',
            origin: 'Cópia para Todos',
            cost: 2, type: 'ctrl', target: 'single',
            targeting: 'Random', priority: 'Attacking', pierce: 1, pierceType: 'MultiHit',
            damage: 4, baseAmount: 2, amountScalesWithCombo: true,
            knockback: true, knockbackChance: 0.45,
            shield: 0, heal: 0, manaGain: 0,
            icon: 'c_crows', sfx: 'whip',
            desc: 'Revoada: {HITS} corvos em Atacantes aleatórios, cada um bica 2x por {DMG} + 45% Knockback (Desarme).'
        },
        // ---------- CARTAS SUPORTE (pontes de combo; buffs valem só no combate atual) ----------
        grito_guerra: {
            id: 'grito_guerra',
            name: 'Grito de Guerra',
            origin: 'Café Requentado',
            cost: 0, type: 'sup', target: 'self',
            buffMight: 10, scalesWithCombo: true,
            damage: 0, shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'coffee', sfx: 'shield',
            desc: 'Suporte: +{MIGHT}% Might (xCombo) até o fim do combate.'
        },
        vislumbre: {
            id: 'vislumbre',
            name: 'Vislumbre',
            origin: 'Post-it Esquecido',
            cost: 1, type: 'sup', target: 'self',
            draw: 1, scalesWithCombo: true,
            damage: 0, shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'cc', sfx: 'card',
            desc: 'Suporte: compra {DRAW} carta(s) (xCombo).'
        },
        eco_mare: {
            id: 'eco_mare',
            name: 'Eco da Maré',
            origin: 'Responder a Todos',
            cost: 1, type: 'sup', target: 'self',
            buffArea: 10, scalesWithCombo: true,
            damage: 0, shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'p_area', sfx: 'shield',
            desc: 'Suporte: +{AREA}% Area (xCombo) até o fim do combate.'
        },
        aljava_improvisada: {
            id: 'aljava_improvisada',
            name: 'Aljava Improvisada',
            origin: 'Clipes Soltos',
            cost: 1, type: 'sup', target: 'self',
            buffAmount: 1,
            damage: 0, shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'p_amount', sfx: 'shield',
            desc: 'Suporte: +1 Amount até o fim do combate (máx. +3).'
        },
        banquete_andarilho: {
            id: 'banquete_andarilho',
            name: 'Banquete do Andarilho',
            origin: 'Marmita de Casa',
            cost: 1, type: 'sup', target: 'self',
            destroy: true, permMaxHp: 3,
            damage: 0, shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'c_chalice', sfx: 'shield',
            desc: 'Destroy: +3 HP Máx permanente. A carta sai do baralho para sempre.'
        },
        pergaminho_aprendiz: {
            id: 'pergaminho_aprendiz',
            name: 'Pergaminho do Aprendiz',
            origin: 'Curso Online',
            cost: 0, type: 'sup', target: 'self',
            destroy: true, permGrowth: 15,
            damage: 0, shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'p_growth', sfx: 'shield',
            desc: 'Destroy: +15% Growth permanente. A carta sai do baralho para sempre.'
        },
        julgamento_final: {
            id: 'julgamento_final',
            name: 'Cometa do Abismo',
            origin: 'Fechamento Mensal',
            cost: 3, type: 'atk', target: 'all', targeting: 'FrontRow',
            damage: 13, baseAmount: 1, damageScalesWithCombo: true, damageScalesWithAmount: true,
            burn: 5, burnAllColumns: true, knockback: true, knockbackChance: 0.75,
            shield: 0, heal: 0, manaGain: 0,
            icon: 'c_comet', sfx: 'coffee',
            desc: 'Cataclismo: {DMG} dano na fila da frente + {BURN} Burn nas 5 colunas + 75% Desarme.'
        },
        lanca_geada: {
            id: 'lanca_geada',
            name: 'Lança de Geada',
            origin: 'Ar-Condicionado no 16',
            cost: 1, type: 'ctrl', target: 'single', targeting: 'LeftRight', priority: 'Attacking',
            damage: 5, baseAmount: 1, amountScalesWithCombo: true, freeze: 1,
            shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'c_bolt', sfx: 'whip',
            desc: '{HITS} estilhaço(s) de {DMG} dano em Atacantes. Cada acerto aplica 1 Gelo (próximo golpe 1.5x).'
        },
        tiramisu_recomeco: {
            id: 'tiramisu_recomeco',
            name: 'Tiramisù do Recomeço',
            origin: 'Sobremesa da Copa',
            cost: 1, type: 'sup', target: 'self',
            destroy: true, permRevival: 1,
            damage: 0, shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'c_chalice', sfx: 'shield',
            desc: 'Destroy: +1 carga de Revival (máx. 3). A carta sai do baralho para sempre.'
        },
        // ---------- CARTAS EVOLUÍDAS ----------
        vulcao_expresso: {
            id: 'vulcao_expresso',
            name: 'Erupção Solar',
            origin: 'Garrafa Térmica',
            cost: 1, type: 'atk', target: 'all',
            targeting: 'FrontRow', pierce: 1, pierceType: 'OncePerEnemy',
            damage: 12, baseAmount: 1, damageScalesWithCombo: true, damageScalesWithAmount: true,
            burn: 5, ignoreShield: true, evolved: true,
            shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'c_sun', sfx: 'coffee',
            desc: 'EVOLUÍDA: {DMG} dano na frente e na retaguarda (ignora escudo, escala Combo/Amount) + {BURN} Burn.'
        },
        mandibula_ferro: {
            id: 'mandibula_ferro',
            name: 'Dança das Lâminas',
            origin: 'Grampeador Industrial',
            cost: 1, type: 'atk', target: 'single',
            targeting: 'Target', pierce: 1, pierceType: 'OncePerEnemy',
            damage: 8, baseAmount: 2, amountScalesWithCombo: true,
            critChance: 0.20, critMult: 1.5, critExplosion: true, evolved: true,
            shield: 0, heal: 0, manaGain: 0, knockback: false,
            icon: 'c_blades', sfx: 'stapler',
            desc: 'EVOLUÍDA: {HITS} cortes de {DMG} no alvo, perfurando 1 atrás. Crit 20% explode nos vizinhos.'
        },
        muralha_juridica: {
            id: 'muralha_juridica',
            name: 'Muralha do Guardião',
            origin: 'Cópia Oculta',
            cost: 1, type: 'def', target: 'all', targeting: 'FrontRow',
            damage: 0, shield: 14, scalesWithCombo: true, retain: true, evolved: true,
            heal: 0, manaGain: 0, knockback: true, knockbackChance: 0.75,
            icon: 'c_wall', sfx: 'shield',
            desc: 'EVOLUÍDA: Retain. +{SHIELD} Escudo (xCombo) e 75% Desarme em TODOS.'
        },
        // ---------- CARTAS-LIXO DOS CHEFES (temporárias: vão ao topo da compra e somem após o combate) ----------
        folha_presa: {
            id: 'folha_presa',
            name: 'Folha Presa',
            origin: 'Atolamento de Papel',
            cost: 1, type: 'curse', target: 'self',
            damage: 0, shield: 0, heal: 0, manaGain: 0, knockback: false,
            destroy: true, draw: 1,
            icon: 'ata', sfx: 'card',
            desc: 'Lixo. Pague 1 Cafeína: descarta da luta e compra 1 carta.'
        },
        confusao: {
            id: 'confusao',
            name: 'Confusão',
            origin: 'Reunião Sem Pauta',
            cost: 0, type: 'curse', target: 'self',
            damage: 0, shield: 0, heal: 0, manaGain: 0, knockback: false,
            destroy: true, scrambleCosts: 2,
            icon: 'event_q', sfx: 'card',
            desc: 'Lixo. Ao ser comprada, embaralha os custos da mão em ±2 neste turno. Jogue para queimar.'
        },
        bomba_mana: {
            id: 'bomba_mana',
            name: 'Bomba de Mana',
            origin: 'Planilha Corrompida',
            cost: 2, type: 'curse', target: 'self',
            damage: 0, shield: 0, heal: 0, manaGain: 0, knockback: false,
            destroy: true, endTurnBomb: true,
            icon: 'vulcao', sfx: 'card',
            desc: 'Lixo. Se ficar na mão no fim do turno, explode: {BOMB} de dano (cresce a cada explosão). Jogue para desarmar.'
        }
    };

    const STARTING_DECK = [
        'grito_guerra',
        'vislumbre',
        'golpe_furtivo',
        'moeda_destino',
        'mordida_ferro',
        'mordida_ferro',
        'pocao_fogo',
        'escudo_burocratico',
        'chicote_dados',
        'chicote_dados'
    ];

    const EVOLUTIONS = [
        {
            passiveId: 'rel_garrafa',
            title: 'Frasco Solar',
            origin: 'Garrafa Térmica',
            icon: 'thermos',
            fromCard: 'pocao_fogo',
            toCard: 'vulcao_expresso',
            desc: 'Evolui Sopro de Brasas (Nv.MÁX) -> Erupção Solar.'
        },
        {
            passiveId: 'rel_grampos',
            title: 'Pedra de Amolar',
            origin: 'Caixa de Grampos',
            icon: 'staple_box',
            fromCard: 'mordida_ferro',
            toCard: 'mandibula_ferro',
            desc: 'Evolui Lâmina do Devaneio (Nv.MÁX) -> Dança das Lâminas.'
        },
        {
            passiveId: 'rel_cco',
            title: 'Selo do Guardião',
            origin: 'Cópia Oculta',
            icon: 'cco_shield',
            fromCard: 'escudo_burocratico',
            toCard: 'muralha_juridica',
            desc: 'Evolui Égide do Viajante (Nv.MÁX) -> Muralha do Guardião.'
        }
    ];

    // Relíquias especiais (não evoluem cartas).
    const SPECIAL_RELICS = {
        foto_parque: {
            id: 'foto_parque',
            title: 'Foto no Parque',
            icon: 'r_photo',
            desc: '+15% Might e +5 Sanidade no início de cada combate.'
        },
        bilhete_cinema: {
            id: 'bilhete_cinema',
            title: 'Bilhete de Cinema',
            icon: 'r_ticket',
            desc: 'Relíquia de memória: +10% Might.'
        },
        chave_bicicleta: {
            id: 'chave_bicicleta',
            title: 'Chave da Bicicleta',
            icon: 'r_key',
            desc: 'Relíquia de memória rara: +1 Cafeína máxima (teto 5).'
        }
    };

    // attackStyle: 'lunge' (investida), 'paper' (folha arremessada), 'wave' (onda) ou 'orb' (projétil de energia).
    // kbResist: resistência a Knockback (0..100; 100 = imune).
    // armorEvery/armorGain: a cada N turnos o inimigo ganha Escudo em vez de atacar (EnemyActionArmor).
    // curseCard/curseEvery: carta-lixo posta no topo da compra do jogador a cada N ataques.
    // phases (chefes): efeitos ao cruzar 66% e 33% do HP — armor (Escudo imediato), atk (+ATK),
    //   junk (carta-lixo imediata) e set (campos do inimigo sobrescritos dali em diante).
    function enemy(kind, name, origin, hp, atk, xp, vr, extra) {
        return Object.assign({
            kind: kind, name: name, origin: origin,
            hp: hp, atk: atk, xp: xp, vr: vr,
            kbResist: 0, attackStyle: 'lunge', quip: ''
        }, extra || {});
    }

    const ENEMIES = {
        // ---- Fase 1: Praia do Crepúsculo ----
        crab: enemy('crab', 'Caranguejo de Tinta', 'Cartucho Vazando', 25, 4, 7, 4,
            { enemyShield: 4, armorEvery: 3, armorGain: 5, quip: '"Clac-clac... substitua o cartucho ciano!"' }),
        gull: enemy('gull', 'Gaivota Ladrã', 'Folha Voando', 21, 5, 7, 4,
            { quip: '"Minha folha! Minha! MINHA!"' }),
        specter: enemy('specter', 'Espectro da Maré', 'Fila de Impressão', 23, 4, 8, 4,
            { buffAllies: 2, attackStyle: 'wave', quip: '"A fila de impressão nunca acaba..."' }),
        kraken: enemy('kraken', 'Devorador das Marés', 'A Impressora Faminta — Chefe', 100, 8, 25, 16,
            { isBoss: true, kbResist: 100, curseCard: 'folha_presa', curseEvery: 2, attackStyle: 'paper',
              phases: {
                  2: { label: 'Bandeja Travada', armor: 8, junk: 'folha_presa' },
                  3: { label: 'Atolamento Total', atk: 2, set: { curseEvery: 1 } }
              },
              quip: '"PAPEL. PRESO. NA. BANDEJA. DOIS."' }),

        siren: enemy('siren', 'Sereia do Raso', 'Toque de Chamada', 26, 4, 8, 4,
            { sprite: 'specter', shieldPerTurn: 3, attackStyle: 'wave', quip: '"Sua ligação é muito importante para nós..."' }),
        // ---- Fase 2: Cidade Gótica Amaldiçoada ----
        hunter: enemy('hunter', 'Caçador Frenético', 'Mensagem Urgente', 39, 7, 10, 5,
            { quip: '"Viu minha mensagem? Viu? VIU?"' }),
        crow: enemy('crow', 'Corvo dos Sinos', 'Notificação', 36, 6, 10, 5,
            { buffAllies: 2, attackStyle: 'wave', quip: '"Plim! Plim! Plim!"' }),
        herald: enemy('herald', 'Arauto da Vigília', 'Lembrete Agendado', 46, 6, 11, 5,
            { enemyShield: 8, attackStyle: 'orb', quip: '"Lembrete: você tem 14 pendências."' }),
        mensageiro: enemy('mensageiro', 'Mensageiro do Sino Veloz', 'O Corredor Sem Fim — Chefe', 135, 6, 35, 20,
            { isBoss: true, kbResist: 40, attacksPerTurn: 2, attackStyle: 'lunge',
              phases: {
                  2: { label: 'Sino Dobrado', armor: 10, junk: 'confusao', set: { curseCard: 'confusao', curseEvery: 3 } },
                  3: { label: 'Urgência Máxima', atk: 2, set: { kbResist: 70 } }
              },
              quip: '"Uma coisa de cada vez? Nesta cidade, nunca."' }),

        lamplighter: enemy('lamplighter', 'Acendedor de Lampiões', 'Aviso de Hora Extra', 42, 7, 11, 5,
            { sprite: 'herald', kbResist: 30, attackStyle: 'orb', quip: '"Só mais uma coisinha antes de você sair."' }),
        // ---- Fase 3: Pico Nevado & Fortaleza de Gelo ----
        wolf: enemy('wolf', 'Lobo da Nevasca', 'Prazo Apertado', 52, 8, 14, 6,
            { quip: '"Auuu... para ontem!"' }),
        serpent: enemy('serpent', 'Serpente de Cristal', 'Gráfico em Queda', 46, 7, 14, 6,
            { enemyShield: 10, attackStyle: 'orb', quip: '"Ssssegundo o gráfico, estamos atrasssados."' }),
        sentinel: enemy('sentinel', 'Sentinela Congelado', 'Pauta Travada', 64, 7, 15, 6,
            { enemyShield: 14, kbResist: 50, armorEvery: 3, armorGain: 10, quip: '"Este item fica para a próxima reunião."' }),
        estrategista: enemy('estrategista', 'Estrategista do Véu Branco', 'A Reunião Gelada — Chefe', 149, 10, 45, 24,
            { isBoss: true, hexEvery: 4, kbResist: 100, shieldPerTurn: 12, attackStyle: 'orb',
              phases: {
                  2: { label: 'Pauta Extra', junk: 'confusao', set: { shieldPerTurn: 16 } },
                  3: { label: 'Prioridade Máxima', atk: 3, junk: 'bomba_mana' }
              },
              quip: '"Tudo é prioridade máxima. Tudo."' }),

        yeti: enemy('yeti', 'Yeti do Desfiladeiro', 'Planilha Congelada', 74, 9, 16, 6,
            { sprite: 'sentinel', armorEvery: 4, armorGain: 10, quip: '"Carregando... não responde."' }),
        // ---- Fase 4: Dungeon Subterrânea ----
        skeleton: enemy('skeleton', 'Esqueleto do Arquivo', 'Pasta de 1998', 64, 10, 18, 7,
            { quip: '"Protocolo... em três vias..."' }),
        mimic: enemy('mimic', 'Mímico de Gaveta', 'Gaveta Emperrada', 71, 11, 19, 7,
            { kbResist: 25, quip: '"NHAC! Faltou o carimbo!"' }),
        gargoyle: enemy('gargoyle', 'Gárgula de Pedra', 'Arquivo Morto', 82, 9, 20, 7,
            { enemyShield: 16, kbResist: 50, armorEvery: 3, armorGain: 12, attackStyle: 'orb', quip: '"Nada sai daqui. Nada."' }),
        guardia: enemy('guardia', 'Guardiã das Catacumbas', 'O Arquivo Sem Fim — Chefe', 188, 12, 60, 28,
            { isBoss: true, hexEvery: 4, kbResist: 100, summonKind: 'skeleton', summonEvery: 3, attackStyle: 'orb',
              phases: {
                  2: { label: 'Gavetas Abertas', armor: 15, set: { summonEvery: 2 } },
                  3: { label: 'Arquivo Morto', atk: 3, junk: 'bomba_mana' }
              },
              dropRelic: 'foto_parque', quip: '"Você guardou tudo... menos o que importava."' }),

        wraith: enemy('wraith', 'Aparição do Corredor', 'Chamado Reaberto', 70, 12, 20, 7,
            { sprite: 'skeleton', buffAllies: 2, attackStyle: 'wave', quip: '"Este chamado foi reaberto pela 4ª vez."' }),
        // ---- Fase 5: O Abismo Estrelado ----
        horas: enemy('horas', 'O Senhor das Horas', 'O Relógio de Ponto — Chefe Final', 250, 14, 0, 0,
            { isBoss: true, hexEvery: 4, kbResist: 100, drainMana: 1, attackStyle: 'orb',
              phases: {
                  2: { label: 'Hora Extra', armor: 20, junk: 'bomba_mana', set: { curseCard: 'bomba_mana', curseEvery: 3 } },
                  3: { label: 'Última Badalada', atk: 4, junk: 'confusao', set: { armorEvery: 3, armorGain: 18 } }
              },
              quip: '"Tic. Tac. O seu tempo é meu."' })
    };

    // Máximo de inimigos vivos simultâneos (5 colunas x Frente + Retaguarda).
    const MAX_ENEMIES_IN_COMBAT = 10;

    function getEnemyStats(kind) {
        return ENEMIES[kind] || null;
    }

    // Pool explícito por fase: comuns (do mais fraco ao mais forte) e chefe.
    const BIOME_ENEMIES = {
        1: { common: ['gull', 'crab', 'specter', 'siren'], boss: 'kraken' },
        2: { common: ['crow', 'hunter', 'herald', 'lamplighter'], boss: 'mensageiro' },
        3: { common: ['serpent', 'wolf', 'sentinel', 'yeti'], boss: 'estrategista' },
        4: { common: ['skeleton', 'mimic', 'gargoyle', 'wraith'], boss: 'guardia' },
        5: { common: [], boss: 'horas' }
    };
    Object.keys(BIOME_ENEMIES).forEach(floor => {
        const pool = BIOME_ENEMIES[floor];
        pool.common.concat(pool.boss).forEach(kind => { ENEMIES[kind].floor = Number(floor); });
    });

    function getEnemyPool(floorNum) {
        return BIOME_ENEMIES[floorNum] || BIOME_ENEMIES[1];
    }

    // Curse da run (%): escala HP/dano inimigo e o XP ganho.
    function scaleByCurse(value, cursePct) {
        return Math.round(value * (1 + Math.max(0, cursePct || 0) / 100));
    }

    // Gelo: o próximo golpe que acerta causa ceil(dano * mult) e consome 1 stack.
    function applyFrostToDamage(damage, frostStacks) {
        if (!(frostStacks > 0) || damage <= 0) return { damage: damage, frost: frostStacks || 0 };
        return { damage: Math.ceil(damage * BALANCE.freezeDamageMult), frost: frostStacks - 1 };
    }

    // Duration (%): prolonga efeitos temporários. Burn aplicado cresce na proporção; gelo ganha +1 stack a cada 50%.
    function withDuration(amount, durationPct) {
        return Math.round(amount * (1 + Math.max(0, durationPct || 0) / 100));
    }

    function frostStacksToApply(baseStacks, durationPct) {
        return baseStacks + Math.floor(Math.max(0, durationPct || 0) / BALANCE.durationFrostStep);
    }

    // Revival: a 0 de Sanidade, 1 carga revive com HP cheio.
    function consumeRevival(hp, maxHp, charges) {
        if (hp > 0 || !(charges > 0)) return { revived: false, hp: hp, charges: charges || 0 };
        return { revived: true, hp: maxHp, charges: charges - 1 };
    }

    function cardReward(cardId, desc) {
        const card = CARDS[cardId];
        return {
            id: 'add_' + cardId,
            kind: 'carta',
            title: card.name,
            origin: card.origin,
            icon: card.icon,
            desc: desc,
            apply: function (state) {
                state.deck.push(cardId);
            }
        };
    }

    const LEVEL_UP_REWARDS = [
        {
            id: 'garrafa_agua',
            kind: 'passiva',
            title: 'Cantil do Andarilho',
            origin: 'Garrafa de Água',
            icon: 'thermos',
            desc: 'Passiva: +3 Recovery (cura ao vencer cada encontro).',
            apply: function (state) {
                state.stats.Recovery += 3;
                state.passives.push({ label: 'Cantil do Andarilho (+3 Recovery)', icon: 'thermos' });
            }
        },
        {
            id: 'ventilador_mesa',
            kind: 'passiva',
            title: 'Sopro do Inverno',
            origin: 'Ventilador de Mesa',
            icon: 'p_area',
            desc: 'Passiva: +20% Freeze (chance de cada golpe aplicar 1 Gelo) e +25% Duration.',
            apply: function (state) {
                state.stats.Freeze += 20;
                state.stats.Duration += 25;
                state.passives.push({ label: 'Sopro do Inverno (+20% Freeze, +25% Duration)', icon: 'p_area' });
            }
        },
        {
            id: 'segunda_chance',
            kind: 'passiva',
            once: true,
            rare: true,
            title: 'Segunda Chance',
            origin: 'Banco de Horas',
            icon: 'p_luck',
            desc: 'Rara: +1 carga de Revival (revive com Sanidade cheia ao chegar a 0).',
            apply: function (state) {
                state.revival = Math.min(BALANCE.revivalMax, (state.revival || 0) + 1);
                state.passives.push({ label: 'Segunda Chance (+1 Revival)', icon: 'p_luck' });
            }
        },
        {
            id: 'pacto_serao',
            kind: 'passiva',
            title: 'Pacto do Serão',
            origin: 'Hora Extra Voluntária',
            icon: 'vr_boost',
            desc: 'Risco: +15% Curse (inimigos mais fortes, mais XP) e +25% Growth.',
            apply: function (state) {
                state.curse = Math.min(BALANCE.curseCap, (state.curse || 0) + 15);
                state.stats.Growth += 25;
                state.passives.push({ label: 'Pacto do Serão (+15% Curse, +25% Growth)', icon: 'vr_boost' });
            }
        },
        cardReward('lanca_geada', 'Nova carta (custo 1): estilhaços que aplicam Gelo. Congelado não ataca e leva 1.5x.'),
        cardReward('tiramisu_recomeco', 'Nova carta (custo 1, Destroy): +1 carga de Revival.'),
        {
            id: 'fones_anti_ruido',
            kind: 'passiva',
            title: 'Elmo do Silêncio',
            origin: 'Fones Anti-Ruído',
            icon: 'headphones',
            desc: 'Passiva: +20% Might (multiplica todo dano causado).',
            apply: function (state) {
                state.stats.Might += 20;
                state.passives.push({ label: 'Elmo do Silêncio (+20% Might)', icon: 'headphones' });
            }
        },
        {
            id: 'aljava_grampos',
            kind: 'passiva',
            title: 'Aljava de Ferro',
            origin: 'Cartucho Duplo',
            icon: 'p_amount',
            desc: 'Passiva: +1 Amount (projétil extra ou +100% em cartas de onda).',
            apply: function (state) {
                state.stats.Amount += 1;
                state.passives.push({ label: 'Aljava de Ferro (+1 Amount)', icon: 'p_amount' });
            }
        },
        {
            id: 'lente_prismatica',
            kind: 'passiva',
            title: 'Prisma da Maré',
            origin: 'Lupa de Revisão',
            icon: 'p_area',
            desc: 'Passiva: +30% Area (acertos causam splash nas outras colunas ocupadas).',
            apply: function (state) {
                state.stats.Area += 30;
                state.passives.push({ label: 'Prisma da Maré (+30% Area)', icon: 'p_area' });
            }
        },
        {
            id: 'trevo_ponto',
            kind: 'passiva',
            title: 'Moeda de Prata',
            origin: 'Vale-Brinde',
            icon: 'p_luck',
            desc: 'Passiva: +30% Luck (mais Crit, Knockback e 4ª opção no Level Up).',
            apply: function (state) {
                state.stats.Luck += 30;
                state.passives.push({ label: 'Moeda de Prata (+30% Luck)', icon: 'p_luck' });
            }
        },
        {
            id: 'manual_horas',
            kind: 'passiva',
            title: 'Tomo do Crepúsculo',
            origin: 'Banco de Horas',
            icon: 'p_growth',
            desc: 'Passiva: +25% Growth (multiplica todo XP ganho).',
            apply: function (state) {
                state.stats.Growth += 25;
                state.passives.push({ label: 'Tomo do Crepúsculo (+25% Growth)', icon: 'p_growth' });
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
            id: 'reajuste_vr',
            kind: 'passiva',
            title: 'Bolsa de Moedas',
            origin: 'Reajuste de VR',
            icon: 'vr_boost',
            desc: '+5 Sanidade Máxima (teto 85), cura 12 e +10 VR.',
            apply: function (state) {
                state.maxHp = Math.min(BALANCE.maxHpCap, state.maxHp + 5);
                state.hp = Math.min(state.maxHp, state.hp + 12);
                state.vr += 10;
                state.passives.push({ label: 'Bolsa de Moedas (+5 HP Máx)', icon: 'vr_boost' });
            }
        },
        {
            id: 'up_mordida_ferro',
            kind: 'carta',
            title: 'Lâmina do Devaneio (MÁX)',
            origin: 'Afiar Lâmina',
            icon: 'c_sword',
            once: true,
            desc: 'Eleva Lâmina do Devaneio ao Nível Máximo (pronta p/ Evolução) + 1 cópia.',
            apply: function (state) {
                state.cardLevels.mordida_ferro = BALANCE.maxCardLevel;
                state.deck.push('mordida_ferro');
                state.discardPile.push('mordida_ferro');
            }
        },
        {
            id: 'up_pocao_fogo',
            kind: 'carta',
            title: 'Sopro de Brasas (MÁX)',
            origin: 'Destilar Brasas',
            icon: 'c_flask',
            once: true,
            desc: 'Eleva Sopro de Brasas ao Nível Máximo (pronta p/ Evolução) + 1 cópia.',
            apply: function (state) {
                state.cardLevels.pocao_fogo = BALANCE.maxCardLevel;
                state.deck.push('pocao_fogo');
                state.discardPile.push('pocao_fogo');
            }
        },
        {
            id: 'up_escudo_burocratico',
            kind: 'carta',
            title: 'Égide do Viajante (MÁX)',
            origin: 'Reforçar Arquivo',
            icon: 'c_aegis',
            once: true,
            desc: 'Eleva Égide do Viajante ao Nível Máximo (pronta p/ Evolução) + 1 cópia.',
            apply: function (state) {
                state.cardLevels.escudo_burocratico = BALANCE.maxCardLevel;
                state.deck.push('escudo_burocratico');
                state.discardPile.push('escudo_burocratico');
            }
        },
        cardReward('golpe_furtivo', 'Carta Custo 0 (Return): adagas de 5 dano Esq→Dir em Atacantes (qtd. escala Combo) + Crit 10%.'),
        cardReward('demissao_silenciosa', 'Carta Custo 1 (Return): golpes de 8 dano Dir→Esq + 4 Escudo. Crit 15% explode nos vizinhos.'),
        cardReward('tempestade_cc', 'Carta Custo 2: 2+ corvos aleatórios que bicam 2x por 4 dano + 45% Knockback.'),
        cardReward('atestado_arcano', 'Carta Wild (Custo 0): sempre comba! Cura 6 HP, +5 Escudo e +1 Cafeína.'),
        cardReward('julgamento_final', 'Carta Custo 3: 13 dano na frente (escala Combo/Amount) + 5 Burn + 75% Desarme.'),
        cardReward('eco_mare', 'Suporte Custo 1: +10% Area (xCombo) até o fim do combate.'),
        cardReward('aljava_improvisada', 'Suporte Custo 1: +1 Amount até o fim do combate (máx. +3).'),
        cardReward('banquete_andarilho', 'Suporte Custo 1 (Destroy): +3 HP Máx permanente, uso único.'),
        cardReward('pergaminho_aprendiz', 'Suporte Custo 0 (Destroy): +15% Growth permanente, uso único.')
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
                '1': {
                    zone: 'Arrebentação Oeste',
                    intro: 'Um Caranguejo de Tinta e uma Gaivota avançam, com reforço na retaguarda!',
                    enemies: ['crab', 'gull', 'crab'],
                    formation: [
                        { kind: 'crab', col: 1, row: 0 },
                        { kind: 'gull', col: 3, row: 0 },
                        { kind: 'crab', col: 1, row: 1 }
                    ]
                },
                '2': {
                    zone: 'Poças do Leste',
                    intro: 'A maré traz um Espectro e uma Gaivota com cobertura atrás!',
                    enemies: ['gull', 'specter', 'gull'],
                    formation: [
                        { kind: 'gull', col: 1, row: 0 },
                        { kind: 'specter', col: 3, row: 0 },
                        { kind: 'gull', col: 3, row: 1 }
                    ]
                },
                '3': {
                    zone: 'Banco de Areia',
                    intro: 'Criaturas da maré se alinham em colunas de frente e retaguarda!',
                    enemies: ['crab', 'specter', 'gull', 'crab', 'gull'],
                    formation: [
                        { kind: 'crab', col: 0, row: 0 },
                        { kind: 'specter', col: 2, row: 0 },
                        { kind: 'gull', col: 4, row: 0 },
                        { kind: 'crab', col: 0, row: 1 },
                        { kind: 'gull', col: 2, row: 1 }
                    ]
                },
                'B': {
                    zone: 'Olho da Maré',
                    intro: 'CHEFE: O DEVORADOR DAS MARÉS emerge cuspindo Folhas Presas!',
                    isBoss: true,
                    enemies: ['gull', 'kraken', 'crab', 'specter', 'crab'],
                    formation: [
                        { kind: 'gull', col: 1, row: 0 },
                        { kind: 'kraken', col: 2, row: 0 },
                        { kind: 'crab', col: 3, row: 0 },
                        { kind: 'specter', col: 1, row: 1 },
                        { kind: 'crab', col: 3, row: 1 }
                    ]
                }
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
                '1': {
                    zone: 'Beco dos Sinos',
                    intro: 'Um Caçador Frenético e um Corvo avançam, com outro Caçador na retaguarda!',
                    enemies: ['hunter', 'crow', 'hunter'],
                    formation: [
                        { kind: 'hunter', col: 1, row: 0 },
                        { kind: 'crow', col: 3, row: 0 },
                        { kind: 'hunter', col: 1, row: 1 }
                    ]
                },
                '2': {
                    zone: 'Praça da Vigília',
                    intro: 'O Arauto da Vigília lê sua lista de pendências na praça!',
                    enemies: ['herald', 'hunter', 'crow'],
                    formation: [
                        { kind: 'herald', col: 1, row: 0 },
                        { kind: 'hunter', col: 3, row: 0 },
                        { kind: 'crow', col: 3, row: 1 }
                    ]
                },
                '3': {
                    zone: 'Cruzamento Central',
                    intro: 'Vanguarda e retaguarda cercam o cruzamento sob os sinos!',
                    enemies: ['hunter', 'herald', 'crow', 'hunter', 'crow'],
                    formation: [
                        { kind: 'hunter', col: 0, row: 0 },
                        { kind: 'herald', col: 2, row: 0 },
                        { kind: 'crow', col: 4, row: 0 },
                        { kind: 'hunter', col: 2, row: 1 },
                        { kind: 'crow', col: 4, row: 1 }
                    ]
                },
                'B': {
                    zone: 'Torre do Sino',
                    intro: 'CHEFE: O MENSAGEIRO DO SINO VELOZ ataca duas vezes — use Escudo e Knockback!',
                    isBoss: true,
                    enemies: ['crow', 'mensageiro', 'hunter', 'herald'],
                    formation: [
                        { kind: 'crow', col: 1, row: 0 },
                        { kind: 'mensageiro', col: 2, row: 0 },
                        { kind: 'hunter', col: 3, row: 0 },
                        { kind: 'herald', col: 2, row: 1 }
                    ]
                }
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
                '1': {
                    zone: 'Encosta Leste',
                    intro: 'Uma matilha da nevasca e uma Serpente descem a encosta!',
                    enemies: ['wolf', 'serpent', 'wolf'],
                    formation: [
                        { kind: 'wolf', col: 1, row: 0 },
                        { kind: 'serpent', col: 3, row: 0 },
                        { kind: 'wolf', col: 1, row: 1 }
                    ]
                },
                '2': {
                    zone: 'Passo Oeste',
                    intro: 'Um Sentinela Congelado guarda o passo com reforços atrás!',
                    enemies: ['sentinel', 'serpent', 'wolf'],
                    formation: [
                        { kind: 'sentinel', col: 1, row: 0 },
                        { kind: 'serpent', col: 3, row: 0 },
                        { kind: 'wolf', col: 3, row: 1 }
                    ]
                },
                '3': {
                    zone: 'Pátio da Fortaleza',
                    intro: 'A guarda completa da fortaleza fecha as 5 colunas do pátio!',
                    enemies: ['wolf', 'sentinel', 'serpent', 'wolf', 'serpent'],
                    formation: [
                        { kind: 'wolf', col: 0, row: 0 },
                        { kind: 'sentinel', col: 2, row: 0 },
                        { kind: 'serpent', col: 4, row: 0 },
                        { kind: 'wolf', col: 0, row: 1 },
                        { kind: 'serpent', col: 4, row: 1 }
                    ]
                },
                'B': {
                    zone: 'Sala do Véu Branco',
                    intro: 'CHEFE: A ESTRATEGISTA DO VÉU BRANCO ergue um Escudo de Cristal a cada turno!',
                    isBoss: true,
                    enemies: ['serpent', 'estrategista', 'sentinel', 'wolf', 'serpent'],
                    formation: [
                        { kind: 'serpent', col: 1, row: 0 },
                        { kind: 'estrategista', col: 2, row: 0 },
                        { kind: 'sentinel', col: 3, row: 0 },
                        { kind: 'wolf', col: 1, row: 1 },
                        { kind: 'serpent', col: 3, row: 1 }
                    ]
                }
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
                '1': {
                    zone: 'Galeria das Pastas',
                    intro: 'Esqueletos do Arquivo e um Mímico de Gaveta despertam!',
                    enemies: ['skeleton', 'mimic', 'skeleton'],
                    formation: [
                        { kind: 'skeleton', col: 1, row: 0 },
                        { kind: 'mimic', col: 3, row: 0 },
                        { kind: 'skeleton', col: 1, row: 1 }
                    ]
                },
                '2': {
                    zone: 'Cripta Leste',
                    intro: 'Uma Gárgula de Pedra desce do pilar com sua escolta!',
                    enemies: ['gargoyle', 'skeleton', 'mimic'],
                    formation: [
                        { kind: 'gargoyle', col: 1, row: 0 },
                        { kind: 'skeleton', col: 3, row: 0 },
                        { kind: 'mimic', col: 3, row: 1 }
                    ]
                },
                '3': {
                    zone: 'Salão das Gavetas',
                    intro: 'O salão inteiro range: vanguarda e retaguarda das catacumbas!',
                    enemies: ['skeleton', 'gargoyle', 'mimic', 'skeleton', 'mimic'],
                    formation: [
                        { kind: 'skeleton', col: 0, row: 0 },
                        { kind: 'gargoyle', col: 2, row: 0 },
                        { kind: 'mimic', col: 4, row: 0 },
                        { kind: 'skeleton', col: 0, row: 1 },
                        { kind: 'mimic', col: 2, row: 1 }
                    ]
                },
                'B': {
                    zone: 'Câmara das Catacumbas',
                    intro: 'CHEFE: A GUARDIÃ DAS CATACUMBAS convoca Esqueletos do Arquivo!',
                    isBoss: true,
                    enemies: ['skeleton', 'guardia', 'gargoyle', 'mimic'],
                    formation: [
                        { kind: 'skeleton', col: 1, row: 0 },
                        { kind: 'guardia', col: 2, row: 0 },
                        { kind: 'gargoyle', col: 3, row: 0 },
                        { kind: 'mimic', col: 2, row: 1 }
                    ]
                }
            }
        },
        {
            floor: 5,
            biome: 'abyss',
            name: 'O Abismo Estrelado',
            bossName: 'O Senhor das Horas',
            restName: 'Último Fôlego',
            restDesc: 'Entre as estrelas, um fio de brasa ainda lembra o calor de casa.',
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
                '###.M.###',
                '###.S.###',
                '#########'
            ],
            encounters: {
                'B': {
                    zone: 'Centro do Abismo',
                    intro: 'CHEFE FINAL: O SENHOR DAS HORAS! Bloqueie os golpes ou ele drena sua Cafeína!',
                    isBoss: true,
                    enemies: ['horas'],
                    formation: [{ kind: 'horas', col: 2, row: 0 }]
                }
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
                const enc = fl.encounters[ch];
                const list = enc.enemies;
                if (list.length > MAX_ENEMIES_IN_COMBAT) problems.push(tag + 'encontro "' + ch + '" com inimigos demais');
                list.forEach(kind => {
                    if (!ENEMIES[kind]) problems.push(tag + 'inimigo desconhecido "' + kind + '"');
                });
                if (enc.formation) {
                    enc.formation.forEach(slot => {
                        if (!ENEMIES[slot.kind]) problems.push(tag + 'formação com inimigo inválido "' + slot.kind + '"');
                        if (slot.col < 0 || slot.col > 4) problems.push(tag + 'formação fora das 5 colunas em "' + ch + '"');
                    });
                }
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
        XP_TABLE: XP_TABLE,
        CARDS: CARDS,
        STARTING_DECK: STARTING_DECK,
        EVOLUTIONS: EVOLUTIONS,
        SPECIAL_RELICS: SPECIAL_RELICS,
        ENEMIES: ENEMIES,
        BALANCE: BALANCE,
        MAX_ENEMIES_IN_COMBAT: MAX_ENEMIES_IN_COMBAT,
        getEnemyStats: getEnemyStats,
        getEnemyPool: getEnemyPool,
        scaleByCurse: scaleByCurse,
        applyFrostToDamage: applyFrostToDamage,
        withDuration: withDuration,
        frostStacksToApply: frostStacksToApply,
        consumeRevival: consumeRevival,
        getXpForLevel: getXpForLevel,
        getEffectiveCost: getEffectiveCost,
        isWildCard: isWildCard,
        canCardCombo: canCardCombo,
        getComboCostAfter: getComboCostAfter,
        nextTargetColumn: nextTargetColumn,
        drawColumnFromBag: drawColumnFromBag,
        rollKnockback: rollKnockback,
        getBossPhase: getBossPhase,
        GEMS: GEMS,
        ARCANAS: ARCANAS,
        getCardGemSlots: getCardGemSlots,
        canSocketGem: canSocketGem,
        applyGems: applyGems,
        cardHasGem: cardHasGem,
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

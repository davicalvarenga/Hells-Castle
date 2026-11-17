// Regras puras do combate web (docs/js/data.js). Rodar: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sandbox = { window: {}, console };
vm.runInNewContext(readFileSync(new URL('../docs/js/data.js', import.meta.url), 'utf8'), sandbox);
const D = sandbox.window.GameData;

test('mapas continuam válidos', () => {
    assert.deepEqual([...D.validateFloors()], []);
});

test('combo: sequência estrita +1; depois de um Wild a próxima pode custar 0 ou 1', () => {
    const cost = n => ({ cost: n, type: 'atk' });
    const wild = { cost: 0, type: 'wild', isWild: true };
    assert.equal(D.canCardCombo(cost(1), null), false, '1ª carta só define a cadeia');
    assert.equal(D.canCardCombo(cost(1), 0), true);
    assert.equal(D.canCardCombo(cost(2), 0), false);
    assert.equal(D.canCardCombo(cost(0), 0), false);
    assert.equal(D.canCardCombo(wild, 2), true);
    assert.equal(D.getComboCostAfter(wild), -1);
    assert.equal(D.canCardCombo(cost(0), D.getComboCostAfter(wild)), true);
    assert.equal(D.canCardCombo(cost(1), D.getComboCostAfter(wild)), true, 'Wild -> 1');
    assert.equal(D.canCardCombo(cost(2), D.getComboCostAfter(wild)), false, 'Wild -> 2 pula degrau');
    assert.equal(D.canCardCombo(cost(2), 1), true, 'Wild -> 1 -> 2 segue a escada');
    assert.deepEqual([...D.nextComboCosts(D.WILD_STEP, false)], [0, 1]);
    assert.deepEqual([...D.nextComboCosts(2, true)], [3, 1]);
    assert.deepEqual([...D.nextComboCosts(null, false)], []);
    assert.equal(D.canCardCombo(cost(1), 0, 1), false, 'Confusão +1 vira custo 2');
    assert.equal(D.canCardCombo({ cost: 1, type: 'curse' }, 0), false);
    assert.equal(D.getComboMult(2), 3);
});

test('mira: LeftRight e RightLeft percorrem as colunas ocupadas e dão a volta', () => {
    const cols = [1, 3, 4];
    assert.equal(D.nextTargetColumn('LeftRight', cols, null), 1);
    assert.equal(D.nextTargetColumn('LeftRight', cols, 1), 3);
    assert.equal(D.nextTargetColumn('LeftRight', cols, 4), 1);
    assert.equal(D.nextTargetColumn('RightLeft', cols, null), 4);
    assert.equal(D.nextTargetColumn('RightLeft', cols, 3), 1);
    assert.equal(D.nextTargetColumn('RightLeft', cols, 1), 4);
    assert.equal(D.nextTargetColumn('LeftRight', [], null), null);
});

test('mira: Random é um saco sem repetição', () => {
    const bag = [];
    const cols = [0, 2, 4];
    const firstRound = [1, 2, 3].map(() => D.drawColumnFromBag(bag, cols));
    assert.deepEqual(firstRound.slice().sort(), cols);
    assert.ok(cols.includes(D.drawColumnFromBag(bag, cols)), 'reabastece ao esvaziar');
});

test('knockback: kb * (1 - resist/100) > rand()', () => {
    assert.equal(D.rollKnockback(0.6, 0, 0.59), true);
    assert.equal(D.rollKnockback(0.6, 50, 0.31), false);
    assert.equal(D.rollKnockback(0.6, 50, 0.29), true);
    assert.equal(D.rollKnockback(0.98, 100, 0), false);
});

test('chefes: 3 fases de HP e dados consistentes', () => {
    assert.equal(D.getBossPhase(100, 100), 1);
    assert.equal(D.getBossPhase(66, 100), 2);
    assert.equal(D.getBossPhase(33, 100), 3);
    Object.values(D.ENEMIES).filter(e => e.isBoss).forEach(boss => {
        [2, 3].forEach(n => {
            const ph = boss.phases[n];
            assert.ok(ph && ph.label, boss.kind + ' fase ' + n);
            if (ph.junk) assert.ok(D.CARDS[ph.junk], ph.junk);
        });
    });
});

test('ilustrações: fases 2 a 5 e epílogo apontam para PNGs existentes', async () => {
    const { existsSync } = await import('node:fs');
    const arts = D.FLOORS.filter(fl => fl.floor >= 2).map(fl => fl.art).concat(D.EPILOGUE.art);
    assert.equal(arts.length, 5);
    arts.forEach(a => assert.ok(a && existsSync(new URL('../docs/' + a, import.meta.url)), String(a)));
    assert.equal(D.FLOORS[0].art, undefined, 'a Fase 1 já é apresentada pela cutscene');
});

test('baralho inicial e recompensas só referenciam cartas existentes', () => {
    D.STARTING_DECK.forEach(id => assert.ok(D.CARDS[id], id));
    D.LEVEL_UP_REWARDS.filter(r => r.id.startsWith('add_')).forEach(r => assert.ok(D.CARDS[r.id.slice(4)], r.id));
});

test('gemas: slots de 1 a 3 e nenhum em carta-lixo', () => {
    assert.equal(D.getCardGemSlots(D.CARDS.golpe_furtivo), 1);
    assert.equal(D.getCardGemSlots(D.CARDS.mordida_ferro), 2);
    assert.equal(D.getCardGemSlots(D.CARDS.julgamento_final), 3);
    assert.equal(D.getCardGemSlots(D.CARDS.mandibula_ferro), 3);
    assert.equal(D.getCardGemSlots(D.CARDS.folha_presa), 0);
});

test('gemas: compatibilidade, repetição, slot cheio e gema inútil', () => {
    const blade = D.CARDS.mordida_ferro;       // custo 1, 2 slots, causa dano
    const shield = D.CARDS.escudo_burocratico; // sem dano, já tem Retain
    assert.ok(D.canSocketGem(blade, [], 'mana_minus'));
    assert.ok(!D.canSocketGem(blade, ['mana_minus'], 'mana_plus'), 'Mana -1 x Mana +1');
    assert.ok(!D.canSocketGem(blade, ['mana_minus'], 'mana_minus'), 'não repete');
    assert.ok(!D.canSocketGem(blade, ['wild'], 'reverse'), 'Coringa x Combo Reverso');
    assert.ok(!D.canSocketGem(blade, ['ret'], 'retain'), 'Retornar x Reter');
    assert.ok(!D.canSocketGem(blade, ['swift', 'leader'], 'double'), 'slots cheios');
    assert.ok(!D.canSocketGem(shield, [], 'double'), 'Dano Duplo exige dano');
    assert.ok(!D.canSocketGem(shield, [], 'retain'), 'já tem Retain');
    assert.ok(!D.canSocketGem(D.CARDS.golpe_furtivo, [], 'mana_minus'), 'custo 0 não desce');
    assert.ok(!D.canSocketGem(D.CARDS.moeda_destino, [], 'wild'), 'já é Wild');
    assert.ok(!D.canSocketGem(D.CARDS.folha_presa, [], 'swift'), 'lixo não recebe gema');
    assert.ok(D.canSocketGem(blade, ['swift', 'leader'], 'evolve'), 'evolução não ocupa slot');
    assert.ok(!D.canSocketGem(D.CARDS.mandibula_ferro, [], 'evolve'), 'evoluída não evolui de novo');
    Object.values(D.GEMS).forEach(g => g.incompatibleWith.forEach(other => assert.ok(D.GEMS[other], g.id + ' -> ' + other)));
});

test('gemas: carta efetiva muda custo, Wild, Return, Retain e dano sem tocar na base', () => {
    const base = D.CARDS.mordida_ferro;
    assert.equal(D.applyGems(base, []), base);
    assert.equal(D.applyGems(base, ['mana_minus']).cost, 0);
    assert.equal(D.applyGems(base, ['mana_plus']).cost, 2);
    assert.equal(D.applyGems(base, ['double']).damage, base.damage * 2);
    assert.ok(D.isWildCard(D.applyGems(base, ['wild'])));
    assert.equal(D.applyGems(base, ['ret']).returnTimes, 1);
    assert.ok(D.applyGems(base, ['retain']).retain);
    assert.ok(D.cardHasGem(D.applyGems(base, ['freeze']), 'freeze'));
    assert.equal(base.cost, 1);
    // custo de gema soma com o modificador da Confusão
    assert.equal(D.getEffectiveCost(D.applyGems(base, ['mana_plus']), 2), 4);
    assert.equal(D.getEffectiveCost(D.applyGems(base, ['mana_minus']), -2), 0);
});

test('combo reverso: a próxima carta comba subindo ou descendo 1', () => {
    const c0 = D.CARDS.golpe_furtivo;
    const c1 = D.CARDS.mordida_ferro;
    const c3 = D.CARDS.julgamento_final;
    assert.ok(!D.canCardCombo(c0, 1, 0, false), 'sem a gema, descer quebra');
    assert.ok(D.canCardCombo(c0, 1, 0, true), 'desce 1');
    assert.ok(D.canCardCombo(c1, 0, 0, true), 'subir continua valendo');
    assert.ok(!D.canCardCombo(c3, 1, 0, true), 'pular 2 não comba');
    assert.ok(!D.canCardCombo(D.CARDS.folha_presa, 2, 0, true), 'lixo nunca comba');
});

test('arcanas: as 5 existem com ícone e descrição', () => {
    assert.deepEqual(Object.keys(D.ARCANAS).sort(),
        ['elo_corrente', 'escudo_soberbo', 'fluxo_combo', 'golpe_escudo', 'mente_afiada']);
    Object.values(D.ARCANAS).forEach(a => assert.ok(a.name && a.desc && a.icon, a.id));
});

test('gelo: próximo golpe causa ceil(1.5x) e consome 1 stack', () => {
    assert.deepEqual({ ...D.applyFrostToDamage(5, 2) }, { damage: 8, frost: 1 });
    assert.deepEqual({ ...D.applyFrostToDamage(5, 0) }, { damage: 5, frost: 0 });
    assert.equal(D.frostStacksToApply(1, 0), 1);
    assert.equal(D.frostStacksToApply(1, 100), 3);
    assert.equal(D.withDuration(4, 25), 5);
});

test('curse: escala em % e não reduz com valor negativo', () => {
    assert.equal(D.scaleByCurse(100, 20), 120);
    assert.equal(D.scaleByCurse(7, 0), 7);
    assert.equal(D.scaleByCurse(7, -30), 7);
});

test('revival: só revive a 0 de Sanidade e com carga', () => {
    assert.deepEqual({ ...D.consumeRevival(0, 50, 2) }, { revived: true, hp: 50, charges: 1 });
    assert.equal(D.consumeRevival(0, 50, 0).revived, false);
    assert.equal(D.consumeRevival(3, 50, 2).revived, false);
});

test('pool por bioma: todo inimigo tem fase e sprite existente', () => {
    for (let floor = 1; floor <= 5; floor++) {
        const pool = D.getEnemyPool(floor);
        assert.ok(D.ENEMIES[pool.boss].isBoss, 'chefe da fase ' + floor);
        pool.common.forEach(kind => {
            const e = D.ENEMIES[kind];
            // Etapa 9: o Abismo usa "Ecos" de outras Fases (a Fase de origem no Bestiário não muda).
            if (pool.echoes) assert.ok(e.floor >= 2 && e.floor <= 4, kind + ' eco de fase anterior');
            else assert.equal(e.floor, floor, kind);
            assert.ok(!e.isBoss, kind);
            if (e.sprite) assert.ok(D.ENEMIES[e.sprite], kind + ' reaproveita sprite ' + e.sprite);
        });
    }
    Object.keys(D.ENEMIES).forEach(kind => assert.ok(D.ENEMIES[kind].floor, kind + ' sem fase'));
});

// ---------- Etapa 4: arsenal completo, gemas avançadas, rachadura e eventos de mapa ----------
const NEW_GEMS = ['eco', 'copia', 'ima', 'bombardeio', 'demi', 'discharge', 'switch', 'spike', 'yinyang', 'afterlife', 'uncrackable', 'preserve'];

test('gemas avançadas: as 12 existem, com raridade, glifo e exclusões válidas', () => {
    NEW_GEMS.forEach(id => {
        const g = D.GEMS[id];
        assert.ok(g && g.name && g.desc && g.glyph && g.color, id);
        assert.ok(g.tags.length > 0, id + ' sem tag');
    });
    assert.equal(Object.keys(D.GEMS).length, 25);
    Object.values(D.GEMS).forEach(g => {
        assert.ok(D.GEM_RARITY_WEIGHT[g.rarity] > 0, g.id + ' sem raridade');
        assert.ok(D.GEM_RARITY_LABEL[g.rarity], g.id);
        g.incompatibleWith.forEach(other => assert.ok(D.GEMS[other], g.id + ' -> ' + other));
    });
    ['epica', 'lendaria'].forEach(r => assert.ok(Object.values(D.GEMS).some(g => g.rarity === r), 'falta gema ' + r));
});

test('gemas avançadas: compatibilidade e encaixes que não fariam nada', () => {
    const blade = D.CARDS.mordida_ferro;   // comum, causa dano
    const war = D.CARDS.grito_guerra;      // suporte sem dano
    const egide = D.CARDS.escudo_burocratico; // Retain nativo
    assert.ok(!D.canSocketGem(blade, ['eco'], 'copia'), 'Eco x Cópia');
    assert.ok(!D.canSocketGem(blade, ['ret'], 'copia'), 'Retornar x Cópia');
    assert.ok(!D.canSocketGem(blade, ['copia'], 'ima'), 'Cópia x Ímã');
    assert.ok(!D.canSocketGem(blade, ['double'], 'discharge'), 'Dano Duplo x Quebra-Combo');
    assert.ok(!D.canSocketGem(blade, ['spike'], 'demi'), 'Ataque de Armadura x Dizimar');
    assert.ok(!D.canSocketGem(blade, ['switch'], 'yinyang'), 'Troca x Yin Yang');
    assert.ok(!D.canSocketGem(blade, ['retain'], 'afterlife'), 'Reter x Pós-Vida');
    assert.ok(!D.canSocketGem(blade, ['uncrackable'], 'preserve'), 'Inquebrável x À Prova de Fogo');
    ['bombardeio', 'demi', 'discharge', 'spike'].forEach(g => {
        assert.ok(D.canSocketGem(blade, [], g), g + ' cabe em carta de dano');
        assert.ok(!D.canSocketGem(war, [], g), g + ' exige dano');
    });
    ['eco', 'switch', 'yinyang'].forEach(g => assert.ok(D.canSocketGem(war, [], g), g + ' cabe em suporte'));
    assert.ok(!D.canSocketGem(egide, [], 'afterlife'), 'carta com Retain nunca é descartada');
    assert.ok(!D.canSocketGem(D.CARDS.banquete_andarilho, [], 'copia'), 'Destroy de uso único não copia');
    assert.ok(!D.canSocketGem(D.CARDS.banquete_andarilho, [], 'preserve'), 'bônus permanente não vira infinito');
    assert.ok(D.canSocketGem(D.CARDS.selo_eclipse, [], 'preserve'), 'Destroy da luta pode ser preservado');
    assert.ok(D.canSocketGem(blade, [], 'uncrackable') && D.canSocketGem(blade, [], 'preserve'));
    assert.ok(!D.canSocketGem(D.CARDS.mandibula_ferro, [], 'uncrackable'), 'evoluída não racha');
    assert.ok(!D.canSocketGem(D.CARDS.moeda_destino, [], 'uncrackable'), 'Wild não racha');
    assert.ok(!D.canSocketGem(D.CARDS.explosao_total, [], 'mana_plus'), 'Custo X ignora Mana +1');
    assert.ok(!D.canSocketGem(D.CARDS.explosao_total, [], 'afterlife'), 'Custo X não tem Pós-Vida');
});

test('slots: +1 da Mesa de Oferenda com teto e nenhum em pickup/carta gerada', () => {
    assert.equal(D.getCardGemSlots(D.CARDS.golpe_furtivo, 1), 2);
    assert.equal(D.getCardGemSlots(D.CARDS.julgamento_final, 1), 4);
    assert.equal(D.getCardGemSlots(D.CARDS.julgamento_final, 5), D.BALANCE.maxGemSlots);
    assert.equal(D.getCardGemSlots(D.CARDS.explosao_total), 2);
    assert.equal(D.getCardGemSlots(D.CARDS.e_sino, 1), 0);
    assert.equal(D.getCardGemSlots(D.CARDS.cafeina_pura), 0);
    const dagger = D.CARDS.golpe_furtivo;
    assert.ok(!D.canSocketGem(dagger, ['swift'], 'leader'), '1 slot cheio');
    assert.ok(D.canSocketGem(dagger, ['swift'], 'leader', 1), 'slot extra libera a 2ª gema');
});

test('sorteio de gema: ponderado pela raridade e estável nas bordas', () => {
    const ids = ['swift', 'mana_minus', 'double', 'afterlife']; // pesos 4, 3, 2, 1
    assert.equal(D.pickGemByRarity(ids, 0), 'swift');
    assert.equal(D.pickGemByRarity(ids, 0.39), 'swift');
    assert.equal(D.pickGemByRarity(ids, 0.41), 'mana_minus');
    assert.equal(D.pickGemByRarity(ids, 0.75), 'double');
    assert.equal(D.pickGemByRarity(ids, 0.95), 'afterlife');
    assert.equal(D.pickGemByRarity(ids, 1), 'afterlife');
    assert.equal(D.pickGemByRarity([], 0.5), null);
});

test('rachadura: só carta comum; racha após o limite e estilhaça em 25%', () => {
    const blade = D.CARDS.mordida_ferro;
    const limit = D.BALANCE.crackAfterUses;
    assert.ok(D.isBreakableCard(blade));
    [D.CARDS.moeda_destino, D.CARDS.mandibula_ferro, D.CARDS.gladio_aurora, D.CARDS.banquete_andarilho,
        D.CARDS.folha_presa, D.CARDS.e_sino, D.CARDS.cafeina_pura].forEach(c => assert.ok(!D.isBreakableCard(c), c.id));
    assert.ok(!D.isBreakableCard(D.applyGems(blade, ['uncrackable'])), 'Inquebrável');
    assert.ok(D.isBreakableCard(D.applyGems(blade, ['preserve'])), 'À Prova de Fogo ainda racha');
    assert.deepEqual({ ...D.rollCrack(limit, false, 0) }, { cracked: false, shattered: false });
    assert.deepEqual({ ...D.rollCrack(limit + 1, false, 0) }, { cracked: true, shattered: false }, 'o uso que racha não estilhaça');
    assert.deepEqual({ ...D.rollCrack(limit + 1, true, 0.24) }, { cracked: true, shattered: true });
    assert.deepEqual({ ...D.rollCrack(limit + 1, true, 0.25) }, { cracked: true, shattered: false });
    assert.deepEqual({ ...D.rollCrack(limit + 1, true, 0, true) }, { cracked: true, shattered: false }, 'À Prova de Fogo');
    assert.deepEqual({ ...D.rollCrack(2, true, 0) }, { cracked: true, shattered: false }, 'Rachada dentro do limite é segura');
});

test('Quebra-Combo, Dizimar e Custo X: fórmulas', () => {
    assert.equal(D.getDischargeMult(0), 1);
    assert.equal(D.getDischargeMult(3), 2.5);
    assert.equal(D.getDemiDamage(100, false), 10);
    assert.equal(D.getDemiDamage(100, true), 5);
    assert.equal(D.getDemiDamage(3, false), 1);
    assert.equal(D.getDemiDamage(0, false), 0);
    const x = D.CARDS.explosao_total;
    assert.equal(D.getEffectiveCost(x, D.getXCostMod(x, 5)), 5, 'custo efetivo = toda a Cafeína');
    assert.ok(D.canCardCombo(x, 1, D.getXCostMod(x, 2)), 'X = 2 comba depois de custo 1');
    assert.ok(!D.canCardCombo(x, 1, D.getXCostMod(x, 3)), 'X = 3 pula degrau');
    assert.equal(D.getXCostMod(D.CARDS.mordida_ferro, 5), 0);
});

test('cartas novas: Custo X, Wilds, Tomos, pickups e mecânicas únicas coerentes', () => {
    ['w_asas', 'w_amuleto', 'w_pulseira', 'w_broquel'].forEach(id => assert.ok(D.isWildCard(D.CARDS[id]), id));
    assert.equal(D.CARDS.w_asas.cost, 4);
    assert.equal(D.CARDS.w_asas.costDiscount, 1);
    [['tomo_1', 0], ['tomo_2', 1], ['tomo_3', 2]].forEach(([id, cost]) => {
        assert.equal(D.CARDS[id].cost, cost, id);
        assert.equal(D.CARDS[id].manaGain, cost + 1, id + ': ganho líquido +1');
    });
    const pure = D.CARDS[D.CARDS.cancao_mana.genCard];
    assert.ok(pure.tempOnly && pure.destroy && D.isWildCard(pure) && pure.cost === 0 && pure.manaGain === 3);
    assert.equal(D.PICKUP_CARDS.length, 4);
    D.PICKUP_CARDS.forEach(id => {
        const c = D.CARDS[id];
        assert.ok(c.consumable && c.destroy && c.retain && D.isWildCard(c) && c.cost === 0, id);
        assert.ok(D.isOneShotCard(c), id);
    });
    assert.equal(D.CARDS.e_saco_moedas.vrGain, 25);
    assert.equal(D.CARDS.e_coracao.heal, 5);
    assert.ok(D.CARDS.selo_eclipse.erase && D.CARDS.selo_eclipse.discardDiscount > 0);
    assert.ok(D.CARDS.anel_trovoes.endTurnRepeat);
    assert.ok(D.CARDS.orvalho_ardente.burnPersist > 0 && D.CARDS.lago_brasas.burnPersist > D.CARDS.orvalho_ardente.burnPersist);
    Object.values(D.CARDS).forEach(c => {
        assert.ok(c.name && c.origin && c.icon && c.desc && c.sfx, c.id);
        if (c.evolvesTo) assert.ok(D.CARDS[c.evolvesTo] && D.CARDS[c.evolvesTo].evolved, c.id + ' -> ' + c.evolvesTo);
        if (c.genCard) assert.ok(D.CARDS[c.genCard], c.id);
    });
});

test('evoluções e fusão: cartas existem e toda evolução tem como chegar ao Nível MÁX', () => {
    D.EVOLUTIONS.forEach(ev => {
        assert.equal(D.CARDS[ev.fromCard].evolvesTo, ev.toCard, ev.passiveId);
        assert.ok(D.LEVEL_UP_REWARDS.some(r => r.id === 'up_' + ev.fromCard), 'sem up_' + ev.fromCard);
        const relic = D.LEVEL_UP_REWARDS.find(r => r.id === ev.passiveId);
        assert.equal(relic.requiresCard, ev.requiresOwned ? ev.fromCard : undefined, ev.passiveId);
    });
    // 1 fusão original + 3 dos arquétipos de bioma (Etapa 8).
    assert.equal(D.FUSIONS.length, 4);
    D.FUSIONS.forEach(f => {
        assert.equal(f.cards.length, 2);
        f.cards.forEach(id => assert.ok(D.LEVEL_UP_REWARDS.some(r => r.id === 'up_' + id), 'fusão precisa de up_' + id));
        assert.ok(D.CARDS[f.toCard].fused && D.CARDS[f.toCard].evolved);
    });
    D.LEVEL_UP_REWARDS.filter(r => r.requiresCard).forEach(r => assert.ok(D.CARDS[r.requiresCard], r.id));
});

test('eventos de mapa: tiles especiais e pares do Baú de Prata', () => {
    assert.deepEqual(Object.keys(D.SPECIAL_TILES).sort(), ['O', 'P', 'W']);
    D.SILVER_CHEST_PAIRS.forEach(pair => {
        assert.equal(pair.length, 2);
        assert.notEqual(pair[0], pair[1]);
        pair.forEach(type => {
            assert.ok(D.CARD_TYPE_LABELS[type], type);
            assert.ok(D.STARTING_DECK.some(id => D.CARDS[id].type === type), 'baralho inicial sem ' + type);
        });
    });
});

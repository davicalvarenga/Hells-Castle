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

test('combo: sequência estrita +1 e Wild reinicia a escada em 0', () => {
    const cost = n => ({ cost: n, type: 'atk' });
    const wild = { cost: 0, type: 'wild', isWild: true };
    assert.equal(D.canCardCombo(cost(1), null), false, '1ª carta só define a cadeia');
    assert.equal(D.canCardCombo(cost(1), 0), true);
    assert.equal(D.canCardCombo(cost(2), 0), false);
    assert.equal(D.canCardCombo(cost(0), 0), false);
    assert.equal(D.canCardCombo(wild, 2), true);
    assert.equal(D.getComboCostAfter(wild), -1);
    assert.equal(D.canCardCombo(cost(0), D.getComboCostAfter(wild)), true);
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

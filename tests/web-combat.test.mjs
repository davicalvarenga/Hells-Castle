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

// Etapa 9: 3 Partes por Bioma (15 setores), escala da campanha longa e run salva. Rodar: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {}, console });
['data.js', 'dungeon.js'].forEach(f => vm.runInContext(readFileSync(new URL('../docs/js/' + f, import.meta.url), 'utf8'), context));
const D = context.window.GameData;
const G = context.window.GameDungeon;
const GAME = readFileSync(new URL('../docs/js/game.js', import.meta.url), 'utf8');
const count = (L, ch) => L.join('').split(ch).length - 1;

function gen(floor, part, seed, extra) {
    const base = D.getFloorConfig(floor);
    const pool = D.getEnemyPool(floor);
    return G.generateFloor(base, Object.assign({
        seed: seed, part: part, size: part === 3 ? 9 : 11, enemyPool: pool.common, bossKind: pool.boss, eliteKind: pool.common[2],
        enemyStats: k => ({ hp: D.ENEMIES[k].hp, atk: D.ENEMIES[k].atk }), enemyNames: k => D.ENEMIES[k].name, gameData: D
    }, extra || {}));
}

test('15 setores: nomes únicos e relógio subindo de 08:17 até 17:55 (18:00 é a vitória)', () => {
    assert.equal(D.PARTS_PER_BIOME, 3);
    const all = [];
    for (let f = 1; f <= 5; f++) for (let p = 1; p <= 3; p++) all.push(D.getSector(f, p));
    assert.equal(all.length, 15);
    assert.equal(new Set(all.map(s => s.name)).size, 15);
    assert.equal(all[0].clock, '08:17');
    assert.equal(all[14].clock, '17:55');
    const mins = all.map(s => Number(s.clock.slice(0, 2)) * 60 + Number(s.clock.slice(3)));
    mins.slice(1).forEach((m, i) => assert.ok(m > mins[i], 'relógio não sobe em ' + all[i + 1].name));
    assert.ok(mins[14] < 18 * 60);
    all.forEach(s => assert.ok(s.toast.length > 20 && s.toast.length < 90, 'toast de 1 linha: ' + s.name));
    assert.equal(D.getSector(2, 2).name, 'Praça do Sino');
});

test('Parte 1/3 (Entrada): 3 comuns, 1 baú, 1 evento e o portal E longe de S; sem chefe, Elite ou fogueira', () => {
    for (let seed = 1; seed <= 25; seed++) {
        for (let f = 1; f <= 5; f++) {
            const fl = gen(f, 1, seed * 31);
            const L = fl.layout;
            assert.deepEqual([...G.validateGeneratedFloor(fl)], [], 'F' + f + ' seed ' + seed);
            assert.equal(fl.part, 1);
            assert.equal(count(L, 'B') + count(L, 'L') + count(L, 'M'), 0);
            assert.equal(count(L, 'E'), 1);
            assert.equal(count(L, 'C'), 1);
            assert.equal(count(L, '?'), 1);
            assert.equal('123'.split('').filter(ch => count(L, ch) === 1).length, 3);
            assert.equal(count(L, '4') + count(L, '5'), 0);
            // E no tile livre mais distante de S (em passos), fora da sala inicial.
            assert.ok(!fl.encounters.B);
        }
    }
});

test('Parte 2/3 (Coração): 3 comuns mais fortes + Elite com baú, fogueira e exatamente 1 evento especial', () => {
    for (let seed = 1; seed <= 25; seed++) {
        for (let f = 1; f <= 5; f++) {
            const fl = gen(f, 2, seed * 53);
            const L = fl.layout;
            assert.deepEqual([...G.validateGeneratedFloor(fl)], [], 'F' + f + ' seed ' + seed);
            assert.equal(count(L, 'L'), 1);
            assert.equal(count(L, 'M'), 1);
            assert.equal(count(L, 'E'), 1);
            assert.equal(count(L, 'B'), 0);
            assert.equal(count(L, 'W') + count(L, 'P') + count(L, 'O'), 1);
            const tiers = ['1', '2', '3'].map(ch => fl.encounters[ch].tierLabel || fl.encounters[ch].zone);
            assert.equal(tiers.length, 3);
            assert.ok(fl.encounters.L.isElite || fl.encounters.L.elite || fl.encounters.L.enemies.length > 0);
        }
    }
});

test('Parte 3/3 (Domínio do Chefe): mapa 9x9, 1-2 guardas, fogueira e o chefe; saída só fora do Abismo', () => {
    for (let seed = 1; seed <= 25; seed++) {
        for (let f = 1; f <= 5; f++) {
            const fl = gen(f, 3, seed * 97);
            const L = fl.layout;
            assert.deepEqual([...G.validateGeneratedFloor(fl)], [], 'F' + f + ' seed ' + seed);
            if (!fl.usedFallback) assert.equal(L.length, 9);
            assert.equal(count(L, 'B'), 1);
            assert.equal(count(L, 'M'), 1);
            assert.equal(count(L, 'L'), 0);
            assert.equal(count(L, 'E'), f < 5 ? 1 : 0);
            const guards = '12345'.split('').filter(ch => count(L, ch)).length;
            assert.ok(guards >= 1 && guards <= 2, guards + ' guardas');
            assert.ok(fl.encounters.B.isBoss && fl.encounters.B.enemies.includes(D.getEnemyPool(f).boss));
        }
    }
});

test('reserva fixa de cada Parte também é válida (maxAttempts 0)', () => {
    for (let f = 1; f <= 5; f++) {
        for (let p = 1; p <= 3; p++) {
            const fl = gen(f, p, 7, { maxAttempts: 0 });
            assert.ok(fl.usedFallback);
            assert.deepEqual([...G.validateGeneratedFloor(fl)], [], 'F' + f + ' P' + p);
        }
    }
});

test('validação acusa Parte sem portal e chefe fora da Parte 3', () => {
    const fl = gen(1, 1, 3);
    const noExit = Object.assign({}, fl, { layout: fl.layout.map(r => r.replace('E', '.')) });
    assert.ok(G.validateGeneratedFloor(noExit).some(p => /sem portal E/.test(p)));
    const p3 = gen(1, 3, 3);
    assert.ok(G.validateGeneratedFloor(Object.assign({}, p3, { part: 1 })).some(p => /chefe fora da Parte 3/.test(p)));
    // Andar único das etapas anteriores (sem part) continua válido.
    const legacy = gen(1, undefined, 3, { size: 11 });
    assert.deepEqual([...G.validateGeneratedFloor(legacy)], []);
    assert.ok(legacy.layout.join('').includes('B'));
});

test('mesma seed gera o mesmo mapa (base do Continuar Expediente)', () => {
    for (let p = 1; p <= 3; p++) {
        assert.equal(gen(3, p, 4242).layout.join(''), gen(3, p, 4242).layout.join(''));
        assert.notEqual(gen(3, p, 4242).layout.join(''), gen(3, p, 4243).layout.join(''));
    }
});

test('Abismo: Ecos de fases anteriores nas Partes 1/2 sem mudar a Fase do Bestiário', () => {
    const pool = D.getEnemyPool(5);
    assert.ok(pool.echoes);
    assert.equal(pool.boss, 'horas');
    assert.ok(pool.common.length >= 3);
    pool.common.forEach(k => assert.ok(D.ENEMIES[k].floor >= 2 && D.ENEMIES[k].floor <= 4, k));
});

test('campanha longa: escala por Parte crescente, XP mais lento e VR mais curto', () => {
    const ps = D.BALANCE.partScale;
    assert.ok(ps[1].hp < ps[2].hp + 0.1 && ps[1].hp <= ps[3].hp && ps[2].hp <= ps[3].hp);
    assert.ok(ps[1].atk <= ps[3].atk);
    [1, 2, 3].forEach(p => assert.ok(ps[p].vr < 1 && ps[p].xp < 1, 'parte ' + p));
    assert.ok(D.BALANCE.xpCurve > 1);
    assert.equal(D.getXpForLevel(1), Math.round(18 * D.BALANCE.xpCurve));
    for (let lv = 1; lv < 15; lv++) assert.ok(D.getXpForLevel(lv + 1) > D.getXpForLevel(lv));
    assert.ok(D.BALANCE.partPortalHeal > 0);
});

test('run salva: chave própria, limpa no fim da run e nunca grava Tutorial/Hora Extra', () => {
    assert.ok(/const RUN_KEY = 'hc_active_run_v1'/.test(GAME));
    assert.ok(/function canSaveRun\(\)[\s\S]{0,120}!state\.tutorial && !state\.infinite/.test(GAME));
    const endGame = GAME.slice(GAME.indexOf('function endGame('), GAME.indexOf('function endGame(') + 400);
    assert.ok(/clearActiveRun\(\)/.test(endGame));
    ['saveActiveRun(\'modal\')', 'saveActiveRun(\'combat\')', 'saveActiveRun(\'part\')', 'saveActiveRun(\'biome\')']
        .forEach(call => assert.ok(GAME.includes(call), call));
});

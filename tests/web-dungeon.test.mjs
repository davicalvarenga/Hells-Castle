// Gerador procedural de andares (docs/js/dungeon.js). Rodar: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {}, console });
vm.runInContext(readFileSync(new URL('../docs/js/data.js', import.meta.url), 'utf8'), context);
vm.runInContext(readFileSync(new URL('../docs/js/dungeon.js', import.meta.url), 'utf8'), context);
const D = context.window.GameData;
const G = context.window.GameDungeon;

const SEEDS_PER_BIOME = 300;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// O gerador nunca pode usar Math.random: durante a geração ele passa a lançar erro.
function withoutMathRandom(fn) {
    const original = vm.runInContext('Math.random', context);
    vm.runInContext('Math.random = () => { throw new Error("Math.random usado na geração"); }', context);
    try {
        return fn();
    } finally {
        context.__originalRandom = original;
        vm.runInContext('Math.random = __originalRandom; delete globalThis.__originalRandom;', context);
    }
}

const generate = (base, seed, extra) => withoutMathRandom(() => G.generateFloor(base, Object.assign({ seed: seed, gameData: D }, extra)));
const isFinalFloor = base => Object.keys(base.encounters).every(ch => ch === 'B');
const count = (layout, ch) => layout.join('').split(ch).length - 1;

function bfs(layout, start, passable) {
    const dist = new Map([[start.x + ',' + start.y, 0]]);
    const queue = [start];
    while (queue.length) {
        const cur = queue.shift();
        for (const [dx, dy] of DIRS) {
            const x = cur.x + dx;
            const y = cur.y + dy;
            const key = x + ',' + y;
            if (dist.has(key) || !layout[y] || !layout[y][x] || !passable(layout[y][x], x, y)) continue;
            dist.set(key, dist.get(cur.x + ',' + cur.y) + 1);
            queue.push({ x, y });
        }
    }
    return dist;
}

// Checagens independentes do validador do módulo (não reaproveita o código testado).
function checkFloorShape(fl, base) {
    const L = fl.layout;
    const tag = base.biome + ' seed ' + fl.seed + ':\n' + L.join('\n') + '\n';
    assert.equal(L.length, 11, tag + 'altura');
    L.forEach((row, y) => {
        assert.equal(row.length, 11, tag + 'largura');
        for (let x = 0; x < 11; x++) {
            if (x === 0 || y === 0 || x === 10 || y === 10) assert.equal(row[x], '#', tag + 'borda');
        }
    });

    const encounterTiles = [];
    L.forEach((row, y) => [...row].forEach((ch, x) => {
        if (fl.encounters[ch]) encounterTiles.push({ ch, x, y });
    }));
    const start = fl.poi.start;
    assert.equal(L[start.y][start.x], 'S', tag + 'poi.start');

    encounterTiles.forEach(e => {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx || dy) assert.equal(L[e.y + dy][e.x + dx], '.', tag + 'arena 3x3 de "' + e.ch + '"');
            }
        }
        // S fora da linha de visão (mesma linha/coluna, até 2 tiles, sem parede no meio)
        const sameLine = e.x === start.x || e.y === start.y;
        const gap = Math.abs(e.x - start.x) + Math.abs(e.y - start.y);
        if (sameLine && gap <= 2) {
            const mid = L[(e.y + start.y) / 2] && L[(e.y + start.y) / 2][(e.x + start.x) / 2];
            assert.ok(gap === 2 && mid === '#', tag + 'S à vista de "' + e.ch + '"');
        }
    });

    const dist = bfs(L, start, ch => ch !== '#');
    const bossDist = dist.get(fl.poi.boss.x + ',' + fl.poi.boss.y);
    encounterTiles.filter(e => e.ch !== 'B').forEach(e => {
        assert.ok(dist.get(e.x + ',' + e.y) < bossDist, tag + 'chefe deve ser o encontro mais distante de S');
    });
}

function checkCounts(fl, base) {
    const L = fl.layout;
    const tag = base.biome + ' seed ' + fl.seed + ':\n' + L.join('\n') + '\n';
    const commons = ['1', '2', '3', '4', '5'].filter(ch => count(L, ch) === 1).length;
    assert.equal(count(L, 'S'), 1, tag + 'S');
    assert.equal(count(L, 'B'), 1, tag + 'B');
    assert.equal(count(L, 'M'), base.restName ? 1 : 0, tag + 'M');
    assert.equal(count(L, 'E'), base.layout.some(r => r.includes('E')) ? 1 : 0, tag + 'E');
    // Tiles especiais: no máximo 1 de cada, até 2 por andar, e nenhum na fase final.
    const specials = ['P', 'O', 'W'].map(ch => count(L, ch));
    specials.forEach(n => assert.ok(n <= 1, tag + 'tile especial repetido'));
    assert.ok(specials.reduce((a, b) => a + b, 0) <= (isFinalFloor(base) ? 0 : 2), tag + 'tiles especiais demais');
    assert.equal(fl.poi.specials.length, specials.reduce((a, b) => a + b, 0), tag + 'poi.specials');
    if (isFinalFloor(base)) {
        assert.equal(commons, 0, tag + 'fase final sem comuns');
        assert.equal(count(L, 'L'), 0, tag + 'fase final sem Elite');
        assert.equal(count(L, 'C'), 1, tag + 'fase final com 1 baú');
        assert.ok(count(L, '?') <= 1, tag + 'fase final com até 1 evento');
        return;
    }
    assert.ok(commons >= 4 && commons <= 5, tag + 'comuns 4..5');
    assert.equal(count(L, 'L'), 1, tag + 'Elite');
    assert.ok(fl.encounters.L.isElite, tag + 'L.isElite');
    assert.ok(count(L, '?') >= 1 && count(L, '?') <= 2, tag + '? 1..2');
    assert.ok(count(L, 'C') >= 2 && count(L, 'C') <= 3, tag + 'C 1..2 + baú da Elite');
    const chest = fl.poi.eliteChest;
    assert.equal(L[chest.y][chest.x], 'C', tag + 'baú da Elite');
    // O caminho até o baú passa pela sala da Elite (ou ele fica na própria sala dela).
    if (fl.poi.rooms) {
        const roomOf = p => fl.poi.rooms.find(r => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
        const eliteRoom = roomOf(fl.poi.elite);
        if (roomOf(chest) !== eliteRoom) {
            const reach = bfs(L, fl.poi.start, (ch, x, y) => ch !== '#' && roomOf({ x, y }) !== eliteRoom);
            assert.ok(!reach.has(chest.x + ',' + chest.y), tag + 'baú da Elite alcançável sem passar pela Elite');
        }
    }
}

test('rng e seeds são determinísticos', () => {
    const a = G.createRng(42);
    const b = G.createRng(42);
    const seqA = [a(), a(), a()];
    assert.deepEqual(seqA, [b(), b(), b()]);
    seqA.forEach(v => assert.ok(v >= 0 && v < 1));
    assert.equal(G.floorSeed(123, 2), G.floorSeed(123, 2));
    assert.notEqual(G.floorSeed(123, 2), G.floorSeed(123, 3));
    const seed = G.randomSeed();
    assert.ok(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32);
});

test('determinismo: mesma seed gera o mesmo andar; seeds diferentes, andares diferentes', () => {
    const base = D.FLOORS[0];
    const snapshot = fl => JSON.stringify({ layout: fl.layout, encounters: fl.encounters });
    assert.equal(snapshot(generate(base, 777)), snapshot(generate(base, 777)));
    assert.notDeepEqual(generate(base, 1).layout, generate(base, 2).layout);
    const layouts = new Set();
    for (let seed = 0; seed < 50; seed++) layouts.add(generate(base, seed).layout.join('\n'));
    assert.ok(layouts.size >= 40, 'layouts distintos em 50 seeds: ' + layouts.size);
});

test('não muta o andar base e preserva os campos narrativos', () => {
    D.FLOORS.forEach(base => {
        const before = JSON.stringify(base);
        const fl = generate(base, 99);
        assert.equal(JSON.stringify(base), before);
        ['floor', 'biome', 'name', 'restName', 'restDesc', 'bumpMsg', 'exitHint', 'conclusion', 'trigger', 'specialEvent']
            .forEach(field => assert.equal(fl[field], base[field], field));
        assert.equal(fl.seed, 99);
        assert.notEqual(fl.layout, base.layout);
    });
});

test('5 biomas x 300 seeds: andares válidos, POIs nas contagens pedidas e tempo de geração', t => {
    let fallbacks = 0;
    let slowest = 0;
    let totalMs = 0;
    D.FLOORS.forEach(base => {
        for (let seed = 0; seed < SEEDS_PER_BIOME; seed++) {
            const t0 = performance.now();
            const fl = generate(base, seed);
            const ms = performance.now() - t0;
            totalMs += ms;
            slowest = Math.max(slowest, ms);
            if (fl.usedFallback) fallbacks++;
            assert.deepEqual([...G.validateGeneratedFloor(fl)], [], base.biome + ' seed ' + seed + '\n' + fl.layout.join('\n'));
            checkFloorShape(fl, base);
            checkCounts(fl, base);
            if (fl.poi.rooms) assert.ok(fl.poi.rooms.length >= 3, 'salas suficientes para ramificar');
        }
    });
    const total = D.FLOORS.length * SEEDS_PER_BIOME;
    t.diagnostic('fallback: ' + fallbacks + '/' + total + ' | média ' + (totalMs / total).toFixed(2) + ' ms | pior ' + slowest.toFixed(2) + ' ms');
    assert.ok(totalMs / total < 50, 'geração média abaixo de 50 ms');
});

test('tiles especiais: Poço, Mesa de Oferenda e Baú de Prata (raro) aparecem e nunca fecham a passagem', () => {
    const seen = { P: 0, O: 0, W: 0 };
    let floors = 0;
    let withSpecial = 0;
    D.FLOORS.filter(base => !isFinalFloor(base)).forEach(base => {
        for (let seed = 0; seed < 200; seed++) {
            const fl = generate(base, seed);
            floors++;
            if (fl.poi.specials.length > 0) withSpecial++;
            fl.poi.specials.forEach(sp => {
                seen[sp.ch]++;
                assert.equal(fl.layout[sp.y][sp.x], sp.ch);
                // Sem pisar em nenhum POI opcional, o resto do andar continua alcançável.
                const reach = bfs(fl.layout, fl.poi.start, ch => ch !== '#' && !'?CPOW'.includes(ch));
                fl.layout.forEach((row, y) => [...row].forEach((ch, x) => {
                    if (ch !== '#' && !'?CPOW'.includes(ch)) assert.ok(reach.has(x + ',' + y), base.biome + ' seed ' + seed + ': ' + ch + ' preso');
                }));
            });
        }
    });
    assert.ok(withSpecial / floors > 0.95, 'andares com tile especial: ' + withSpecial + '/' + floors);
    assert.ok(seen.W > 0 && seen.O > 0 && seen.P > 0, JSON.stringify(seen));
    assert.ok(seen.P < seen.W && seen.P < seen.O, 'Baú de Prata deve ser o mais raro: ' + JSON.stringify(seen));
});

test('layout de reserva é válido em todos os biomas', () => {
    D.FLOORS.forEach(base => {
        const fl = generate(base, 5, { maxAttempts: 0 });
        assert.ok(fl.usedFallback);
        assert.deepEqual([...G.validateGeneratedFloor(fl)], [], base.biome + '\n' + fl.layout.join('\n'));
        checkFloorShape(fl, base);
        checkCounts(fl, base);
    });
});

test('validador acusa mapas quebrados', () => {
    const fl = generate(D.FLOORS[0], 3);
    const broken = Object.assign({}, fl, { layout: fl.layout.map((row, y) => (y === 0 ? '.' + row.slice(1) : row)) });
    assert.ok(G.validateGeneratedFloor(broken).some(p => p.includes('borda')));
    const b = fl.poi.boss;
    const crowded = fl.layout.map((row, y) => (y === b.y ? row.slice(0, b.x + 1) + '#' + row.slice(b.x + 2) : row));
    assert.ok(G.validateGeneratedFloor(Object.assign({}, fl, { layout: crowded })).some(p => p.includes('arena')));
});

// ---------- rollEncounter ----------
const STATS = { fraco: { hp: 10, atk: 1 }, medio: { hp: 20, atk: 2 }, forte: { hp: 50, atk: 3 } };
const POOL = ['forte', 'fraco', 'medio'];

function assertFormationIntegrity(enc) {
    const cells = new Set(enc.formation.map(s => s.col + ',' + s.row));
    assert.equal(cells.size, enc.formation.length, 'células duplicadas');
    assert.ok(enc.formation.length >= 1 && enc.formation.length <= D.MAX_ENEMIES_IN_COMBAT);
    assert.deepEqual(enc.enemies, enc.formation.map(s => s.kind));
    enc.formation.forEach(s => {
        assert.ok(s.col >= 0 && s.col <= 4);
        if (s.row > 0) assert.ok(cells.has(s.col + ',' + (s.row - 1)), 'retaguarda sem frente na coluna ' + s.col);
    });
}

test('rollEncounter: papéis Lower/Baseline/Higher seguem a força (hp * atk)', () => {
    const rng = G.createRng(1);
    for (let i = 0; i < 50; i++) {
        const enc = withoutMathRandom(() => G.rollEncounter({ id: 'papeis', rows: ['L.B.H'] }, { rng, enemyPool: POOL, enemyStats: STATS }));
        const at = col => (enc.formation.find(s => s.col === col) || {}).kind;
        assert.equal(at(2), 'medio');
        assert.deepEqual([at(0), at(4)].sort(), ['forte', 'fraco']);
        assert.equal(enc.formation.length, 3);
    }
});

test('rollEncounter: integridade das colunas, limite de 10 e exatamente 1 elite', () => {
    const rng = G.createRng(7);
    const broken = { id: 'quebrado', rows: ['L....', '.H.H.', 'BBBBB'] };
    const overflow = { id: 'lotado', rows: ['LLLLL', 'BBBBB', 'HHHHH'] };
    const templates = G.ENCOUNTER_TEMPLATES.concat([broken, overflow]);
    for (let i = 0; i < 400; i++) {
        const elite = i % 3 === 0;
        const enc = G.rollEncounter(templates[i % templates.length], {
            rng, enemyPool: POOL, enemyStats: STATS, tier: 1 + (i % 3), elite, eliteKind: elite ? 'forte' : undefined
        });
        assertFormationIntegrity(enc);
        const elites = enc.formation.filter(s => s.elite);
        assert.equal(elites.length, elite ? 1 : 0);
        assert.equal(enc.isElite, elite);
        if (elite) assert.equal(elites[0].kind, 'forte');
    }
    // Sem template: sorteia pelo tier; a Elite vem com escolta menor (só ela é o Higher).
    for (let i = 0; i < 100; i++) {
        const enc = G.rollEncounter(null, { rng, enemyPool: POOL, enemyStats: STATS, elite: true });
        assertFormationIntegrity(enc);
        assert.equal(enc.formation.filter(s => s.elite).length, 1);
        assert.equal(enc.formation.filter(s => s.kind === 'forte').length, 1);
    }
});

test('rollEncounter: templates variados e muitas formações distintas', () => {
    assert.ok(G.ENCOUNTER_TEMPLATES.length >= 10);
    const sizes = G.ENCOUNTER_TEMPLATES.map(t => t.rows.join('').replace(/\./g, '').length);
    assert.equal(Math.min(...sizes), 2);
    assert.equal(Math.max(...sizes), 8);
    assert.ok(G.ENCOUNTER_TEMPLATES.some(t => t.rows.length === 1) && G.ENCOUNTER_TEMPLATES.some(t => t.rows.length > 1));
    [1, 2, 3].forEach(tier => assert.ok(G.ENCOUNTER_TEMPLATES.some(t => t.tier === tier)));

    const rng = G.createRng(2024);
    const pool = ['crab', 'gull', 'specter'];
    const stats = { crab: D.ENEMIES.crab, gull: D.ENEMIES.gull, specter: D.ENEMIES.specter };
    const names = { crab: D.ENEMIES.crab.name, gull: D.ENEMIES.gull.name, specter: D.ENEMIES.specter.name };
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
        const enc = G.rollEncounter(null, { rng, enemyPool: pool, enemyStats: stats, enemyNames: names, tier: 1 + (i % 3) });
        assertFormationIntegrity(enc);
        assert.ok(enc.intro.length > 0 && enc.zone.length > 0);
        seen.add(JSON.stringify(enc.formation));
    }
    assert.ok(seen.size >= 15, 'formações distintas: ' + seen.size);
});

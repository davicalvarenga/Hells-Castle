// Hell's Castle — geração procedural PURA e determinística dos andares.
// Sem DOM, sem Math.random (exceto randomSeed) e sem estado global: tudo deriva da seed.
// Saída compatível com GameData.FLOORS[n] (layout + encounters), mais seed/poi para depuração.
(function () {
    'use strict';

    const SIGHT_RANGE = 2;          // igual a BALANCE.aggroRange: S não pode começar à vista de um encontro
    const DEFAULT_MAX_ENEMIES = 10; // igual a MAX_ENEMIES_IN_COMBAT
    const MAX_ATTEMPTS = 80;        // tentativas com seed derivada antes do layout de reserva
    const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    // Tiles especiais: P = Baú de Prata (raro), O = Mesa de Oferenda, W = Poço dos Desejos.
    const SPECIAL_CHARS = 'POW';
    const POI_CHARS = '#.SCM?E' + SPECIAL_CHARS;
    // POIs que pedem uma decisão do jogador nunca podem ser a única passagem.
    const isOptionalPoi = ch => ch === '?' || ch === 'C' || SPECIAL_CHARS.includes(ch);

    // ---------- RNG ----------
    // mulberry32: rápido, 32 bits de estado e reprodutível em qualquer navegador.
    function createRng(seed) {
        let state = seed >>> 0;
        return function rng() {
            state = (state + 0x6D2B79F5) >>> 0;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Único ponto do módulo que usa Math.random/Date: a seed de uma run nova.
    function randomSeed() {
        return ((Math.random() * 4294967296) ^ Date.now()) >>> 0;
    }

    // Finalizador do murmur3: seeds vizinhas geram seeds derivadas bem diferentes.
    function mixSeed(a, b) {
        let h = (a >>> 0) ^ Math.imul(((b >>> 0) + 0x9E3779B9) >>> 0, 0x85EBCA6B);
        h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B);
        h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
        return (h ^ (h >>> 16)) >>> 0;
    }

    function floorSeed(runSeed, floorNum) {
        return mixSeed(runSeed, floorNum);
    }

    const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
    const pick = (rng, list) => list[Math.floor(rng() * list.length)];
    const unique = list => Array.from(new Set(list));

    function shuffle(rng, list) {
        const out = list.slice();
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            const tmp = out[i];
            out[i] = out[j];
            out[j] = tmp;
        }
        return out;
    }

    function weightedPick(rng, options) {
        const total = options.reduce((sum, o) => sum + o.weight, 0);
        let roll = rng() * total;
        for (const o of options) {
            roll -= o.weight;
            if (roll < 0) return o;
        }
        return options[options.length - 1];
    }

    // ---------- ENCONTROS ----------
    // Papéis por célula: L = Lower (mais fraco do pool), B = Baseline (meio), H = Higher (mais forte),
    // '.' = vazio. rows[0] é a linha de frente; cada linha tem as 5 colunas do combate.
    const ENCOUNTER_TEMPLATES = [
        { id: 'dupla', tier: 1, rows: ['.L.B.'] },
        { id: 'sentinelas', tier: 1, rows: ['L...L'] },
        { id: 'trio_aberto', tier: 1, rows: ['L.B.L'] },
        { id: 'par_com_apoio', tier: 1, rows: ['.B.L.', '.L...'] },
        { id: 'escolta', tier: 2, rows: ['.LHL.'] },
        { id: 'pinca', tier: 2, rows: ['B...B', 'L...L'] },
        { id: 'linha_mista', tier: 2, rows: ['LBHBL'] },
        { id: 'muralha', tier: 2, rows: ['.BBB.', '.L.L.'] },
        { id: 'coluna_dupla', tier: 2, rows: ['.B.B.', '.B.B.', '.L.L.'] },
        { id: 'guarda_pesada', tier: 3, rows: ['.HBH.', '.LLL.'] },
        { id: 'vanguarda', tier: 3, rows: ['HB.BH', 'L...L'] },
        { id: 'torre', tier: 3, rows: ['.BHB.', '.L.L.', '.L.L.'] },
        { id: 'falange', tier: 3, rows: ['BBHBB', '.L.L.'] },
        { id: 'cerco', tier: 3, rows: ['LBHBL', 'L.L.L'] }
    ];
    const TIER_LABELS = ['Patrulha', 'Emboscada', 'Cerco'];

    const templateSize = t => t.rows.join('').replace(/\./g, '').length;

    // Ordena o pool do mais fraco ao mais forte (hp * atk); empate mantém a ordem recebida.
    function strengthOrder(pool, stats) {
        const power = kind => (stats && stats[kind] ? stats[kind].hp * stats[kind].atk : 0);
        return pool
            .map((kind, index) => ({ kind: kind, index: index }))
            .sort((a, b) => power(a.kind) - power(b.kind) || a.index - b.index)
            .map(entry => entry.kind);
    }

    function rollEncounter(template, opts) {
        const rng = opts.rng;
        const pool = unique(opts.enemyPool || []);
        if (pool.length === 0) throw new Error('rollEncounter: enemyPool vazio');
        const maxEnemies = opts.maxEnemies || DEFAULT_MAX_ENEMIES;
        const tier = Math.max(1, Math.min(3, opts.tier || 1));
        if (!template) {
            const fits = ENCOUNTER_TEMPLATES.filter(t => (opts.elite ? t.tier >= 2 && templateSize(t) <= 5 : t.tier === tier));
            template = pick(rng, fits);
        }

        const sorted = strengthOrder(pool, opts.enemyStats);
        const lower = sorted[0];
        const higher = sorted[sorted.length - 1];
        const middle = sorted.length > 2 ? sorted.slice(1, -1) : [lower];
        const mirror = rng() < 0.5;

        let cells = [];
        template.rows.forEach((row, r) => {
            for (let c = 0; c < 5; c++) {
                const role = row[c];
                if (!role || role === '.') continue;
                const kind = role === 'L' ? lower : role === 'H' ? higher : pick(rng, middle);
                cells.push({ role: role, kind: kind, col: mirror ? 4 - c : c, row: r });
            }
        });

        // Variação: com 2+ Baselines, um deles pode virar outro inimigo do pool.
        const baselines = cells.filter(c => c.role === 'B');
        if (baselines.length >= 2 && pool.length > 1 && rng() < 0.4) {
            const cell = pick(rng, baselines);
            cell.kind = pick(rng, pool.filter(k => k !== cell.kind));
        }

        // Frente primeiro e no máximo maxEnemies, antes de escolher a Elite (para ela nunca ser cortada).
        cells.sort((a, b) => a.row - b.row || a.col - b.col);
        cells = cells.slice(0, maxEnemies);

        let eliteCell = null;
        if (opts.elite) {
            const byPriority = (a, b) => a.row - b.row || Math.abs(a.col - 2) - Math.abs(b.col - 2);
            eliteCell = cells.filter(c => c.role === 'H').sort(byPriority)[0] || cells.slice().sort(byPriority)[0];
            eliteCell.kind = opts.eliteKind || higher;
            // Escolta menor: nenhum outro inimigo do tipo mais forte (nem do tipo da Elite).
            cells.forEach(c => {
                if (c !== eliteCell && (c.kind === higher || c.kind === eliteCell.kind)) c.kind = pick(rng, middle);
            });
        }

        // Integridade: colunas compactadas (nenhuma retaguarda sem alguém na frente).
        const columns = [[], [], [], [], []];
        cells.forEach(c => columns[c.col].push(c));
        columns.forEach(list => list.forEach((c, i) => { c.row = i; }));
        cells.sort((a, b) => a.row - b.row || a.col - b.col);

        const formation = cells.map(c => {
            const slot = { kind: c.kind, col: c.col, row: c.row };
            if (c === eliteCell) slot.elite = true;
            return slot;
        });
        const texts = encounterTexts(formation, opts, tier, sorted);
        return {
            zone: texts.zone,
            intro: texts.intro,
            enemies: formation.map(s => s.kind),
            formation: formation,
            isElite: !!opts.elite,
            templateId: template.id || null,
            tier: tier
        };
    }

    function encounterTexts(formation, opts, tier, sorted) {
        const name = kind => (opts.enemyNames && opts.enemyNames[kind]) || kind;
        const leader = formation.find(s => s.elite)
            || formation.slice().sort((a, b) => sorted.indexOf(b.kind) - sorted.indexOf(a.kind))[0];
        if (opts.elite) {
            return { zone: opts.zone || 'Covil da Elite', intro: 'ELITE: ' + name(leader.kind) + ' lidera a escolta!' };
        }
        const label = TIER_LABELS[tier - 1];
        const intro = formation.length > 1
            ? label + ': ' + name(leader.kind) + ' e escolta!'
            : label + ': ' + name(leader.kind) + '!';
        return { zone: opts.zone || label, intro: intro };
    }

    // ---------- VALIDAÇÃO ----------
    function bfs(layout, start, passable) {
        const n = layout.length;
        const dist = new Array(n * n).fill(-1);
        dist[start.y * n + start.x] = 0;
        const queue = [start];
        for (let qi = 0; qi < queue.length; qi++) {
            const cur = queue[qi];
            const d = dist[cur.y * n + cur.x];
            for (const dir of DIRS) {
                const x = cur.x + dir[0];
                const y = cur.y + dir[1];
                if (y < 0 || y >= n || x < 0 || x >= n) continue;
                const k = y * n + x;
                if (dist[k] >= 0 || !passable(layout[y][x], x, y)) continue;
                dist[k] = d + 1;
                queue.push({ x: x, y: y });
            }
        }
        return dist;
    }

    // Linha de visão do jogo: mesma linha/coluna, até SIGHT_RANGE tiles, sem parede no meio.
    function inSight(layout, a, b) {
        if (a.x !== b.x && a.y !== b.y) return false;
        const steps = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        if (steps > SIGHT_RANGE) return false;
        const dx = Math.sign(b.x - a.x);
        const dy = Math.sign(b.y - a.y);
        for (let i = 1; i < steps; i++) {
            if (layout[a.y + dy * i][a.x + dx * i] === '#') return false;
        }
        return true;
    }

    const isEncounterChar = ch => ch === 'B' || ch === 'L' || (ch >= '1' && ch <= '5');

    function checkEncounter(ch, enc, maxEnemies) {
        const tag = 'encontro "' + ch + '": ';
        const out = [];
        const formation = enc.formation || [];
        if (formation.length === 0) out.push(tag + 'sem formação');
        if (formation.length > maxEnemies) out.push(tag + 'mais de ' + maxEnemies + ' inimigos');
        if (!enc.enemies || enc.enemies.length !== formation.length) out.push(tag + 'enemies e formation divergem');
        const cells = new Set();
        formation.forEach(s => {
            if (!(s.col >= 0 && s.col <= 4)) out.push(tag + 'coluna fora de 0..4');
            const key = s.col + ',' + s.row;
            if (cells.has(key)) out.push(tag + 'duas unidades na célula ' + key);
            cells.add(key);
        });
        formation.forEach(s => {
            if (s.row > 0 && !cells.has(s.col + ',' + (s.row - 1))) out.push(tag + 'retaguarda sem frente na coluna ' + s.col);
        });
        if (ch === 'B' && !enc.isBoss) out.push(tag + 'chefe sem isBoss');
        if (ch === 'L' && (!enc.isElite || formation.filter(s => s.elite).length !== 1)) {
            out.push(tag + 'Elite precisa de isElite e exatamente 1 inimigo elite');
        }
        return out;
    }

    // Lista de problemas (vazia = ok). Só lê layout/encounters: serve para qualquer andar gerado.
    function validateGeneratedFloor(floor, maxEnemies) {
        const L = floor && floor.layout;
        if (!Array.isArray(L) || L.length < 5) return ['layout ausente ou pequeno demais'];
        const n = L.length;
        const encounters = floor.encounters || {};
        const problems = [];
        const tiles = {};
        for (let y = 0; y < n; y++) {
            if (L[y].length !== n) {
                problems.push('linha ' + y + ' não tem ' + n + ' colunas');
                continue;
            }
            for (let x = 0; x < n; x++) {
                const ch = L[y][x];
                const edge = x === 0 || y === 0 || x === n - 1 || y === n - 1;
                if (edge && ch !== '#') problems.push('borda aberta em ' + x + ',' + y);
                if (ch !== '#' && ch !== '.') (tiles[ch] = tiles[ch] || []).push({ x: x, y: y });
                if (!POI_CHARS.includes(ch) && !encounters[ch]) problems.push('símbolo sem encontro "' + ch + '" em ' + x + ',' + y);
            }
        }
        if (problems.length) return problems;
        if (!tiles.S || tiles.S.length !== 1) return problems.concat('precisa de exatamente um S');
        // Etapa 9: Partes 1/3 e 2/3 terminam num portal E (sem chefe); a Parte 3/3 (ou o andar único) tem o chefe B.
        const part = floor.part || 0;
        const needsBoss = !part || part === 3;
        if (needsBoss && !encounters.B) problems.push('sem encontro de chefe B');
        if (!needsBoss && encounters.B) problems.push('chefe fora da Parte 3');
        if (!needsBoss && !(tiles.E && tiles.E.length === 1)) problems.push('Parte ' + part + ' sem portal E');
        if (tiles.E && tiles.E.length > 1) problems.push('mais de uma saída');
        SPECIAL_CHARS.split('').forEach(ch => {
            if (tiles[ch] && tiles[ch].length > 1) problems.push('mais de um tile especial "' + ch + '"');
        });
        Object.keys(encounters).forEach(ch => {
            const count = (tiles[ch] || []).length;
            if (count !== 1) problems.push('encontro "' + ch + '" aparece ' + count + ' vezes no mapa');
            checkEncounter(ch, encounters[ch], maxEnemies || DEFAULT_MAX_ENEMIES).forEach(p => problems.push(p));
        });
        if (problems.length) return problems;

        const start = tiles.S[0];
        const dist = bfs(L, start, ch => ch !== '#');
        const freePath = bfs(L, start, ch => ch !== '#' && !isOptionalPoi(ch));
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
                const ch = L[y][x];
                if (ch === '#') continue;
                // (a) tudo alcançável a partir de S (inclui todos os POIs)
                if (dist[y * n + x] < 0) problems.push('"' + ch + '" inalcançável em ' + x + ',' + y);
                // (e) ?, C e os tiles especiais nunca são a única passagem
                else if (!isOptionalPoi(ch) && freePath[y * n + x] < 0) problems.push('"' + ch + '" em ' + x + ',' + y + ' só é alcançável pisando em ?/C/especial');
            }
        }

        const encounterTiles = Object.keys(encounters).map(ch => ({ ch: ch, x: tiles[ch][0].x, y: tiles[ch][0].y }));
        encounterTiles.forEach(e => {
            // (b)+(d) arena 3x3 de chão livre: nem parede nem outro POI (M, E, baús...)
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const ch = L[e.y + dy][e.x + dx];
                    if (ch !== '.') problems.push('arena do encontro "' + e.ch + '" ocupada por "' + ch + '" em ' + (e.x + dx) + ',' + (e.y + dy));
                }
            }
            // (c) a run não começa em combate
            if (inSight(L, start, e)) problems.push('S na linha de visão do encontro "' + e.ch + '"');
        });

        // Objetivo do mapa: o chefe (B) ou, nas Partes 1/2, o portal (E). Nenhum encontro fica além dele.
        const boss = tiles.B ? tiles.B[0] : null;
        const goal = boss || tiles.E[0];
        const goalDist = dist[goal.y * n + goal.x];
        encounterTiles.forEach(e => {
            if (e.ch !== 'B' && dist[e.y * n + e.x] >= goalDist) {
                problems.push('encontro "' + e.ch + '" tão longe de S quanto ' + (boss ? 'o chefe' : 'o portal'));
            }
        });
        if (boss && tiles.E && Math.abs(tiles.E[0].x - boss.x) + Math.abs(tiles.E[0].y - boss.y) > 3) problems.push('saída longe do chefe');
        return problems;
    }

    // ---------- GERAÇÃO DO MAPA ----------
    // Densidade = fração do chão das salas que vira pilar; estilo = onde o pilar pode ficar.
    // any: qualquer tile livre | grid: só em x e y ímpares (colunata alinhada)
    // wall: encostado numa parede | corner: em canto (2+ paredes ortogonais).
    // As arenas 3x3 nunca recebem pilar, então salas de 3 tiles quase não têm.
    const BIOME_STYLES = {
        beach: { density: 0.10, pillars: 'any' },     // rochas espalhadas na areia
        city: { density: 0.12, pillars: 'grid' },     // postes e colunas alinhados
        snow: { density: 0.10, pillars: 'wall' },     // blocos de gelo nas paredes
        dungeon: { density: 0.15, pillars: 'corner' },// pilares nos cantos da cripta
        abyss: { density: 0.05, pillars: 'any' }      // poucos ladrilhos faltando
    };
    const DEFAULT_STYLE = { density: 0.08, pillars: 'any' };

    // Peso do tamanho de cada parte no corte do BSP: 3 e 5 comportam arenas 3x3; 2 vira nicho.
    const PART_WEIGHT = { 2: 1, 3: 4, 4: 1, 5: 4 };

    // BSP: o interior vira salas retangulares separadas por paredes de 1 tile.
    function splitRect(rng, rect, out) {
        const canSplitW = rect.w >= 5; // 2 + parede + 2
        const canSplitH = rect.h >= 5;
        const mustSplit = rect.w >= 7 || rect.h >= 7;
        if ((!canSplitW && !canSplitH) || (!mustSplit && rng() < 0.75)) {
            out.push(rect);
            return;
        }
        const vertical = canSplitW && (!canSplitH || rect.w > rect.h || (rect.w === rect.h && rng() < 0.5));
        const len = vertical ? rect.w : rect.h;
        const options = [];
        for (let a = 2; a <= len - 3; a++) {
            options.push({ a: a, weight: (PART_WEIGHT[a] || 1) * (PART_WEIGHT[len - 1 - a] || 1) });
        }
        const a = weightedPick(rng, options).a;
        if (vertical) {
            splitRect(rng, { x: rect.x, y: rect.y, w: a, h: rect.h }, out);
            splitRect(rng, { x: rect.x + a + 1, y: rect.y, w: rect.w - a - 1, h: rect.h }, out);
        } else {
            splitRect(rng, { x: rect.x, y: rect.y, w: rect.w, h: a }, out);
            splitRect(rng, { x: rect.x, y: rect.y + a + 1, w: rect.w, h: rect.h - a - 1 }, out);
        }
    }

    // Passagens possíveis entre salas vizinhas (separadas por exatamente uma parede).
    function findPassages(rooms) {
        const passages = [];
        rooms.forEach((a, i) => {
            rooms.forEach((b, j) => {
                if (j <= i) return;
                const cells = [];
                if (a.x + a.w + 1 === b.x || b.x + b.w + 1 === a.x) {
                    const wallX = a.x + a.w + 1 === b.x ? a.x + a.w : b.x + b.w;
                    for (let y = Math.max(a.y, b.y); y <= Math.min(a.y + a.h, b.y + b.h) - 1; y++) cells.push({ x: wallX, y: y });
                } else if (a.y + a.h + 1 === b.y || b.y + b.h + 1 === a.y) {
                    const wallY = a.y + a.h + 1 === b.y ? a.y + a.h : b.y + b.h;
                    for (let x = Math.max(a.x, b.x); x <= Math.min(a.x + a.w, b.x + b.w) - 1; x++) cells.push({ x: x, y: wallY });
                }
                if (cells.length) passages.push({ a: i, b: j, cells: cells });
            });
        });
        return passages;
    }

    // Salas + passagens: árvore geradora aleatória e 1-2 passagens extras (loops).
    // Retorna null se a topologia sair linear (sem loop nem bifurcação).
    function carveMap(rng, size) {
        const grid = Array.from({ length: size }, () => Array(size).fill('#'));
        const roomOf = Array.from({ length: size }, () => Array(size).fill(-1));
        const rooms = [];
        splitRect(rng, { x: 1, y: 1, w: size - 2, h: size - 2 }, rooms);
        rooms.forEach((r, id) => {
            r.id = id;
            for (let y = r.y; y < r.y + r.h; y++) {
                for (let x = r.x; x < r.x + r.w; x++) {
                    grid[y][x] = '.';
                    roomOf[y][x] = id;
                }
            }
        });

        const parent = rooms.map((r, i) => i);
        const root = i => (parent[i] === i ? i : (parent[i] = root(parent[i])));
        const degree = rooms.map(() => 0);
        const doors = [];
        const extra = [];
        let loops = 0;
        const open = p => {
            const cell = pick(rng, p.cells);
            grid[cell.y][cell.x] = '.';
            doors.push({ a: p.a, b: p.b, x: cell.x, y: cell.y });
            degree[p.a]++;
            degree[p.b]++;
        };
        shuffle(rng, findPassages(rooms)).forEach(p => {
            if (root(p.a) !== root(p.b)) {
                parent[root(p.a)] = root(p.b);
                open(p);
            } else {
                extra.push(p);
            }
        });
        const extraCount = Math.min(extra.length, randInt(rng, 1, 2));
        for (let i = 0; i < extraCount; i++) {
            open(extra[i]);
            loops++;
        }
        if (rooms.length < 3 || (loops === 0 && Math.max.apply(null, degree) < 3)) return null;
        return { grid: grid, roomOf: roomOf, rooms: rooms, doors: doors };
    }

    // Loops do grafo de salas que sobraram (portas abertas - árvore), depois de criar o beco da Elite.
    function openLoops(map) {
        return map.doors.filter(d => map.grid[d.y][d.x] === '.').length - (map.rooms.length - 1);
    }

    // Posiciona S, B(+E), Elite(+baú guardado), encontros comuns, M, ? e C. null = tentar de novo.
    function placeContent(rng, map, ctx) {
        const grid = map.grid;
        const roomOf = map.roomOf;
        const n = grid.length;
        const usage = map.rooms.map(() => 0);
        const arena = new Set(); // tiles cobertos pelas arenas 3x3 (com o centro)
        const key = p => p.y * n + p.x;
        const roomAt = p => roomOf[p.y][p.x];
        const allTiles = [];
        for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) allTiles.push({ x: x, y: y });
        const freeRoomTiles = () => allTiles.filter(p => grid[p.y][p.x] === '.' && roomAt(p) >= 0 && !arena.has(key(p)));
        const put = (p, ch) => {
            grid[p.y][p.x] = ch;
            if (roomAt(p) >= 0) usage[roomAt(p)]++;
        };
        const arenaOf = p => {
            const out = [];
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push({ x: p.x + dx, y: p.y + dy });
            return out;
        };
        const leastUsed = list => {
            const ordered = shuffle(rng, list);
            return ordered.sort((a, b) => usage[roomAt(a)] - usage[roomAt(b)]);
        };

        // S num dos dois menores cômodos (nicho), longe das arenas grandes.
        const bySize = map.rooms.slice().sort((a, b) => a.w * a.h - b.w * b.h);
        const startRoom = pick(rng, bySize.slice(0, 2));
        const start = pick(rng, allTiles.filter(p => roomAt(p) === startRoom.id));
        put(start, 'S');
        let dist = bfs(grid, start, ch => ch !== '#');
        const distOf = p => dist[key(p)];

        const canHost = p => roomAt(p) >= 0 && !arena.has(key(p)) && !inSight(grid, start, p)
            && arenaOf(p).every(q => grid[q.y][q.x] === '.');
        const placeEncounter = (p, ch) => {
            put(p, ch);
            arenaOf(p).forEach(q => arena.add(key(q)));
        };

        // Chefe: arena mais distante de S (em passos de BFS); saída 2 tiles atrás, na mesma sala.
        const bossCandidates = shuffle(rng, allTiles.filter(p => canHost(p) && roomAt(p) !== startRoom.id))
            .sort((a, b) => distOf(b) - distOf(a));
        let boss = null;
        let exit = null;
        // Partes 1/2: o portal E fica no tile livre mais distante de S (fora da sala inicial); não há chefe.
        // 'boss' passa a ser só o objetivo do mapa (referência de distância e do beco da Elite).
        if (!ctx.hasBoss) {
            const far = shuffle(rng, allTiles.filter(p => grid[p.y][p.x] === '.' && roomAt(p) >= 0 && roomAt(p) !== startRoom.id))
                .sort((a, b) => distOf(b) - distOf(a))[0];
            if (!far) return null;
            put(far, 'E');
            boss = far;
        }
        for (const p of (ctx.hasBoss ? bossCandidates : [])) {
            if (ctx.hasExit) {
                const spots = DIRS.map(d => ({ x: p.x + 2 * d[0], y: p.y + 2 * d[1] }))
                    .filter(q => q.x > 0 && q.y > 0 && q.x < n - 1 && q.y < n - 1 && grid[q.y][q.x] === '.' && roomAt(q) === roomAt(p))
                    .sort((a, b) => distOf(b) - distOf(a));
                if (!spots.length) continue;
                exit = spots[0];
            }
            boss = p;
            break;
        }
        if (!boss) return null;
        if (ctx.hasBoss) {
            placeEncounter(boss, 'B');
            if (exit) put(exit, 'E');
        }
        let bossDist = distOf(boss);
        const refreshDist = () => {
            dist = bfs(grid, start, ch => ch !== '#');
            bossDist = distOf(boss);
        };

        let elite = null;
        let eliteChest = null;
        if (ctx.hasElite) {
            // Baú do beco: tiles que só se alcançam atravessando a sala da Elite (e o chefe não fica atrás dela).
            const chestBehind = p => {
                const room = roomAt(p);
                const blocked = bfs(grid, start, (ch, x, y) => ch !== '#' && roomOf[y][x] !== room);
                const behind = allTiles.filter(q => blocked[key(q)] < 0 && grid[q.y][q.x] === '.'
                    && roomAt(q) >= 0 && roomAt(q) !== room && !arena.has(key(q)));
                if (!behind.length || blocked[key(boss)] < 0) return null;
                return behind.sort((a, b) => distOf(b) - distOf(a))[0];
            };
            // Cria o beco: uma sala vizinha da Elite perde as outras portas, se o mapa seguir
            // todo conectado e ainda ramificado. Retorna as portas fechadas (para desfazer) ou null.
            const openDoors = () => map.doors.filter(d => grid[d.y][d.x] === '.');
            const branched = doors => {
                const degree = map.rooms.map(() => 0);
                doors.forEach(d => { degree[d.a]++; degree[d.b]++; });
                return doors.length >= map.rooms.length || Math.max.apply(null, degree) >= 3;
            };
            const connected = () => {
                const reach = bfs(grid, start, ch => ch !== '#');
                return allTiles.every(p => grid[p.y][p.x] === '#' || reach[key(p)] >= 0);
            };
            const closeIntoBeco = room => {
                for (const door of openDoors().filter(d => d.a === room || d.b === room)) {
                    const other = door.a === room ? door.b : door.a;
                    if (other === startRoom.id || other === roomAt(boss)) continue;
                    const toClose = openDoors().filter(d => d !== door && (d.a === other || d.b === other));
                    if (!toClose.length) continue;
                    toClose.forEach(d => { grid[d.y][d.x] = '#'; });
                    if (connected() && branched(openDoors())) return toClose;
                    toClose.forEach(d => { grid[d.y][d.x] = '.'; });
                }
                return null;
            };

            const candidates = shuffle(rng, allTiles.filter(p => canHost(p) && distOf(p) < bossDist
                && roomAt(p) !== startRoom.id && roomAt(p) !== roomAt(boss)));
            // 1º um beco que já exista; 2º um beco criado fechando portas.
            for (const p of candidates) {
                eliteChest = chestBehind(p);
                if (eliteChest) {
                    elite = p;
                    break;
                }
            }
            for (let i = 0; !elite && i < candidates.length; i++) {
                const p = candidates[i];
                const closed = closeIntoBeco(roomAt(p));
                if (!closed) continue;
                refreshDist();
                eliteChest = chestBehind(p);
                if (eliteChest && distOf(p) < bossDist) {
                    elite = p;
                } else {
                    closed.forEach(d => { grid[d.y][d.x] = '.'; });
                    refreshDist();
                }
            }
            // 3º reserva: o baú fica na própria sala da Elite, do lado oposto à entrada.
            for (let i = 0; !elite && i < candidates.length; i++) {
                const p = candidates[i];
                const own = new Set(arenaOf(p).map(key));
                const spots = allTiles.filter(q => roomAt(q) === roomAt(p) && grid[q.y][q.x] === '.'
                    && !own.has(key(q)) && !arena.has(key(q)) && distOf(q) > distOf(p));
                if (spots.length) {
                    elite = p;
                    eliteChest = spots.sort((a, b) => distOf(b) - distOf(a))[0];
                }
            }
            if (!elite) return null;
            placeEncounter(elite, 'L');
            put(eliteChest, 'C');
        }

        // Comuns (ou guardas da Parte 3): espalhados pelas salas menos usadas; numerados por distância de S.
        if (ctx.commons[1] > 0) {
            const target = randInt(rng, ctx.commons[0], ctx.commons[1]);
            const commons = [];
            for (let i = 0; i < target; i++) {
                const options = allTiles.filter(p => canHost(p) && distOf(p) < bossDist);
                if (!options.length) break;
                const p = leastUsed(options)[0];
                placeEncounter(p, 'X');
                commons.push(p);
            }
            if (commons.length < ctx.commons[0]) return null;
            commons.sort((a, b) => distOf(a) - distOf(b)).forEach((p, i) => { grid[p.y][p.x] = String(i + 1); });
        }

        if (ctx.hasRest) {
            const options = freeRoomTiles();
            if (!options.length) return null;
            put(leastUsed(options)[0], 'M');
        }

        // ? e C nunca podem ser a única passagem: testa cada candidato com BFS.
        const passableWithout = ch => ch !== '#' && !isOptionalPoi(ch);
        const keepsPassage = () => {
            const reach = bfs(grid, start, passableWithout);
            return allTiles.every(p => !passableWithout(grid[p.y][p.x]) || reach[key(p)] >= 0);
        };
        const placeBlocking = (ch, count) => {
            for (let i = 0; i < count; i++) {
                const options = leastUsed(freeRoomTiles()).slice(0, 12);
                const ok = options.find(p => {
                    put(p, ch);
                    if (keepsPassage()) return true;
                    grid[p.y][p.x] = '.';
                    usage[roomAt(p)]--;
                    return false;
                });
                if (!ok) return false;
            }
            return true;
        };
        const events = randInt(rng, ctx.events[0], ctx.events[1]);
        const chests = randInt(rng, ctx.chests[0], ctx.chests[1]);
        if (!placeBlocking('?', events) || !placeBlocking('C', chests)) return null;

        // Tiles especiais, sem repetir o tipo; o Baú de Prata pesa menos no sorteio.
        // Andar único: 1 ou 2 opcionais (nunca na fase final). Parte 2/3: exatamente 1, obrigatório.
        if (ctx.part === 2) {
            const ch = pick(rng, ['W', 'W', 'W', 'O', 'O', 'O', 'P', 'P']);
            if (!placeBlocking(ch, 1)) return null;
        } else if (!ctx.part && !ctx.isFinal) {
            const wanted = rng() < 0.4 ? 2 : 1;
            unique(shuffle(rng, ['W', 'W', 'W', 'O', 'O', 'O', 'P', 'P'])).slice(0, wanted)
                .forEach(ch => placeBlocking(ch, 1));
        }

        return { arena: arena, eliteChest: eliteChest };
    }

    // Pilares internos conforme o bioma; cada um só fica se o andar continuar válido.
    function addPillars(rng, map, arena, style, isValid) {
        const grid = map.grid;
        const n = grid.length;
        const wallsAround = p => DIRS.filter(d => grid[p.y + d[1]][p.x + d[0]] === '#').length;
        const fits = {
            any: () => true,
            grid: p => p.x % 2 === 1 && p.y % 2 === 1,
            wall: p => wallsAround(p) >= 1,
            corner: p => wallsAround(p) >= 2
        }[style.pillars];
        const candidates = [];
        let roomFloor = 0;
        for (let y = 1; y < n - 1; y++) {
            for (let x = 1; x < n - 1; x++) {
                if (map.roomOf[y][x] < 0) continue;
                roomFloor++;
                if (grid[y][x] === '.' && !arena.has(y * n + x)) candidates.push({ x: x, y: y });
            }
        }
        const target = Math.round(roomFloor * style.density);
        let placed = 0;
        for (const p of shuffle(rng, candidates)) {
            if (placed >= target) break;
            if (!fits(p)) continue;
            grid[p.y][p.x] = '#';
            if (isValid()) placed++;
            else grid[p.y][p.x] = '.';
        }
        return placed;
    }

    // Layout de reserva 11x11 (gerado com a seed 344 e congelado), sempre válido.
    // 'c' = baú guardado pela Elite: a sala de baixo à esquerda só abre para a sala de L.
    const FALLBACK_LAYOUT = [
        '###########',
        '#.....#...#',
        '#.B.E.#.1.#',
        '#.....#...#',
        '#.4.3...#C#',
        '#.....#..S#',
        '#####.###.#',
        '#.?.......#',
        '#M..#.L.2.#',
        '#c..#.....#',
        '###########'
    ];
    const FALLBACK_ELITE_CHEST = { x: 1, y: 9 };

    // Reserva das Partes: mesmo mapa 11x11, só com o conteúdo de cada Parte.
    const FALLBACK_PART_KEEP = {
        1: { '1': '1', '2': '2', '3': '3', E: 'E', '?': '?', C: 'C' },
        2: { '1': '1', '2': '2', '3': '3', L: 'L', c: 'C', M: 'M', E: 'E', '?': 'W' },
        3: { '1': '1', '2': '2', B: 'B', M: 'M', E: 'E' }
    };

    function buildFallbackLayout(ctx) {
        if (ctx.part) {
            const keep = FALLBACK_PART_KEEP[ctx.part];
            return FALLBACK_LAYOUT.map(row => row.replace(/[^#.S]/g, ch => {
                if (ch === 'E' && ctx.part === 3 && !ctx.hasExit) return '.';
                return keep[ch] || '.';
            }));
        }
        return FALLBACK_LAYOUT.map(row => row.replace(/[1-5LcME]/g, ch => {
            if (ctx.isFinal && (isEncounterChar(ch) || ch === 'c')) return '.'; // B nem entra no regex
            if (ch === 'c') return 'C';
            if (ch === 'M' && !ctx.hasRest) return '.';
            if (ch === 'E' && !ctx.hasExit) return '.';
            return ch;
        }));
    }

    function buildContext(baseFloor, opts) {
        const gameData = opts.gameData || null;
        const enemies = (gameData && gameData.ENEMIES) || {};
        const mapEnemies = fn => Object.keys(enemies).reduce((acc, kind) => {
            acc[kind] = fn(enemies[kind]);
            return acc;
        }, {});
        const baseEncounters = baseFloor.encounters || {};
        const baseKinds = Object.keys(baseEncounters)
            .filter(ch => !baseEncounters[ch].isBoss)
            .reduce((acc, ch) => acc.concat(baseEncounters[ch].enemies || []), []);
        const pool = unique(opts.enemyPool || baseKinds);
        const stats = opts.enemyStats || mapEnemies(e => ({ hp: e.hp, atk: e.atk }));
        const sorted = strengthOrder(pool, stats);
        const part = [1, 2, 3].includes(opts.part) ? opts.part : 0;
        const isFinal = pool.length === 0 || Object.keys(baseEncounters).every(ch => ch === 'B');
        const baseExit = (baseFloor.layout || []).some(row => row.includes('E'));
        // Conteúdo de cada Parte (Etapa 9); part 0 = andar único das etapas anteriores.
        const PARTS = {
            1: { commons: [3, 3], events: [1, 1], chests: [1, 1], hasElite: false, hasBoss: false, hasRest: false, hasExit: true },
            2: { commons: [3, 3], events: [0, 0], chests: [0, 0], hasElite: true, hasBoss: false, hasRest: true, hasExit: true },
            3: { commons: [1, 2], events: [0, 0], chests: [0, 0], hasElite: false, hasBoss: true, hasRest: true, hasExit: baseExit }
        };
        const layoutCfg = PARTS[part] || {
            commons: isFinal ? [0, 0] : [4, 5],
            events: isFinal ? [0, 1] : [1, 2],
            chests: isFinal ? [1, 1] : [1, 2],
            hasElite: !isFinal, hasBoss: true, hasRest: !!baseFloor.restName, hasExit: baseExit
        };
        return Object.assign({
            part: part,
            pool: pool,
            stats: stats,
            names: opts.enemyNames || mapEnemies(e => e.name),
            maxEnemies: (gameData && gameData.MAX_ENEMIES_IN_COMBAT) || DEFAULT_MAX_ENEMIES,
            isFinal: isFinal,
            eliteKind: opts.eliteKind || sorted[sorted.length - 1],
            bossKind: opts.bossKind || null,
            baseBoss: baseEncounters.B || null
        }, layoutCfg);
    }

    // Força dos comuns por Parte: a Entrada começa leve, o Coração aperta e os guardas do Chefe são os mais fortes.
    const PART_TIERS = { 1: [1, 1, 2], 2: [2, 2, 3], 3: [2, 3] };

    function buildEncounters(rng, layout, ctx) {
        const encounters = {};
        const chars = layout.join('');
        const commons = ['1', '2', '3', '4', '5'].filter(ch => chars.includes(ch));
        const common = { rng: rng, enemyPool: ctx.pool, enemyStats: ctx.stats, enemyNames: ctx.names, maxEnemies: ctx.maxEnemies };
        // Os chars já vêm ordenados por distância de S: os mais perto são tier 1.
        commons.forEach((ch, i) => {
            const tiers = PART_TIERS[ctx.part];
            const tier = tiers ? tiers[Math.min(i, tiers.length - 1)] : Math.min(3, 1 + Math.floor(i * 3 / commons.length));
            encounters[ch] = rollEncounter(null, Object.assign({ tier: tier }, common));
        });
        if (chars.includes('L')) {
            encounters.L = rollEncounter(null, Object.assign({ tier: 3, elite: true, eliteKind: ctx.eliteKind }, common));
        }
        if (!chars.includes('B')) {
            // Partes 1/2: sem chefe neste mapa.
        } else if (ctx.baseBoss) {
            encounters.B = JSON.parse(JSON.stringify(ctx.baseBoss));
        } else {
            const kind = ctx.bossKind || ctx.eliteKind;
            const name = (ctx.names && ctx.names[kind]) || kind;
            encounters.B = {
                zone: 'Covil do Chefe', intro: 'CHEFE: ' + name + '!', isBoss: true,
                enemies: [kind], formation: [{ kind: kind, col: 2, row: 0 }]
            };
        }
        return encounters;
    }

    function collectPoi(layout, extra) {
        const poi = {
            start: null, boss: null, elite: null, rest: null, exit: null,
            chests: [], events: [], specials: [], encounters: [],
            eliteChest: extra.eliteChest, rooms: extra.rooms, loops: extra.loops
        };
        layout.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                const ch = row[x];
                const p = { x: x, y: y };
                if (ch === 'S') poi.start = p;
                else if (ch === 'M') poi.rest = p;
                else if (ch === 'E') poi.exit = p;
                else if (ch === 'C') poi.chests.push(p);
                else if (ch === '?') poi.events.push(p);
                else if (SPECIAL_CHARS.includes(ch)) poi.specials.push({ ch: ch, x: x, y: y });
                if (isEncounterChar(ch)) {
                    poi.encounters.push({ ch: ch, x: x, y: y });
                    if (ch === 'B') poi.boss = p;
                    if (ch === 'L') poi.elite = p;
                }
            }
        });
        poi.encounters.sort((a, b) => (a.ch < b.ch ? -1 : 1));
        return poi;
    }

    // Gera um andar novo a partir da entrada de FLOORS do bioma. Não muta baseFloor.
    // opts: { seed, size = 11, enemyPool, bossKind, eliteKind, enemyStats, enemyNames, gameData,
    //         maxAttempts (só para testes: 0 força o layout de reserva) }
    function generateFloor(baseFloor, opts) {
        opts = opts || {};
        const seed = (opts.seed === undefined ? 1 : opts.seed) >>> 0;
        const size = opts.size || 11;
        const maxAttempts = opts.maxAttempts === undefined ? MAX_ATTEMPTS : opts.maxAttempts;
        const ctx = buildContext(baseFloor, opts);
        const style = BIOME_STYLES[baseFloor.biome] || DEFAULT_STYLE;
        const finish = (layout, encounters, extra) => Object.assign({}, baseFloor, {
            part: ctx.part || undefined,
            layout: layout,
            encounters: encounters,
            seed: seed,
            poi: collectPoi(layout, extra),
            usedFallback: !!extra.usedFallback,
            attempts: extra.attempts
        });

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const rng = createRng(mixSeed(seed, attempt));
            const map = carveMap(rng, size);
            if (!map) continue;
            const placed = placeContent(rng, map, ctx);
            if (!placed) continue;
            const encounters = buildEncounters(createRng(mixSeed(seed, 0x5EED + attempt)), map.grid.map(r => r.join('')), ctx);
            const asFloor = () => ({ layout: map.grid.map(r => r.join('')), encounters: encounters, part: ctx.part });
            if (validateGeneratedFloor(asFloor(), ctx.maxEnemies).length) continue;
            addPillars(rng, map, placed.arena, style, () => validateGeneratedFloor(asFloor(), ctx.maxEnemies).length === 0);
            const rooms = map.rooms.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h }));
            return finish(asFloor().layout, encounters, { eliteChest: placed.eliteChest, rooms: rooms, loops: openLoops(map), attempts: attempt + 1 });
        }

        // shortcut: a reserva é fixa em 11x11; com outro opts.size ela ignora o tamanho pedido.
        const layout = buildFallbackLayout(ctx);
        return finish(layout, buildEncounters(createRng(mixSeed(seed, 0xFA11)), layout, ctx), {
            eliteChest: ctx.hasElite ? FALLBACK_ELITE_CHEST : null, rooms: null, loops: 1,
            usedFallback: true, attempts: maxAttempts
        });
    }

    window.GameDungeon = {
        createRng: createRng,
        randomSeed: randomSeed,
        floorSeed: floorSeed,
        generateFloor: generateFloor,
        validateGeneratedFloor: validateGeneratedFloor,
        rollEncounter: rollEncounter,
        ENCOUNTER_TEMPLATES: ENCOUNTER_TEMPLATES,
        BIOME_STYLES: BIOME_STYLES,
        FALLBACK_LAYOUT: FALLBACK_LAYOUT,
        SPECIAL_CHARS: SPECIAL_CHARS
    };
})();

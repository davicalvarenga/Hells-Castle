// Bot de calibração do Hell's Castle: joga runs completas no navegador headless via window.__hcDebug.
// Requer: npm i --no-save playwright-core (usa o Chrome instalado).
// Uso: node tools/hc-bot.mjs [--runs 8] [--policy good|bad] [--speed 30] [--head] [--source worktree|head]
//   good = Jogar Tudo (combo ordenado) + usa a fogueira; bad = cartas em ordem ruim, sem fogueira.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const REPO = process.env.HC_REPO || fileURLToPath(new URL('..', import.meta.url));
const arg = (name, def) => {
    const i = process.argv.indexOf('--' + name);
    return i < 0 ? def : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true);
};
const RUNS = Number(arg('runs', 8));
const POLICY = String(arg('policy', 'good'));
const SPEED = Number(arg('speed', 30));
const SOURCE = String(arg('source', 'worktree'));
const VERBOSE = !!arg('verbose', false);

const HOOK = '\nwindow.__hcDebug = { get state() { return state; }, get activeModal() { return activeModal; }, ' +
    'playCard, playAllCards, endTurn, moveRelative, turnPlayer, sortCardsByCombo, isUsefulCard };\n';
const withHook = src => src.includes('__hcDebug') ? src
    : src.replace(/\n\s*openTitleModal\(\);\s*\n\}\)\(\);/, HOOK + 'openTitleModal();\n})();');
const head = f => execSync('git show HEAD:docs/js/' + f, { cwd: REPO, maxBuffer: 1 << 26 }).toString('utf8');
// --tune '{"hp":[1,1,1,1,1],"atk":[1,1,1,1,1],"bossHp":[1,1,1,1,1],"bossAtk":[1,1,1,1,1],"xp":1}' testa escalas sem editar data.js
const TUNE = arg('tune', '');
const tuneCode = TUNE ? `;(function () {
    const T = ${TUNE}; const D = window.GameData; const kinds = Object.keys(D.ENEMIES);
    kinds.forEach((k, i) => {
        const e = D.ENEMIES[k]; const f = Math.min(4, Math.floor(i / 4));
        const hp = (e.isBoss ? T.bossHp : T.hp) || []; const atk = (e.isBoss ? T.bossAtk : T.atk) || [];
        e.hp = Math.round(e.hp * (hp[f] || 1)); e.atk = Math.max(1, Math.round(e.atk * (atk[f] || 1)));
    });
    if (T.xp) { const orig = D.getXpForLevel; D.getXpForLevel = lv => Math.round(orig(lv) * T.xp); D.BALANCE.xpFirstLevel = D.getXpForLevel(1); }
})();` : '';
const overrides0 = SOURCE === 'head'
    ? { 'js/game.js': () => withHook(head('game.js')), 'js/data.js': () => head('data.js') }
    : { 'js/game.js': withHook };
const overrides = { ...overrides0, 'js/data.js': src => (overrides0['js/data.js'] ? overrides0['js/data.js'](src) : src) + tuneCode };

// Acelera a lógica (later/setTimeout) sem mexer no código do jogo.
function speedUp(speed) {
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (fn, ms, ...rest) => nativeSetTimeout(fn, (ms || 0) / speed, ...rest);
}

// Um passo de decisão do bot, executado dentro da página.
function botStep(policy) {
    const h = window.__hcDebug;
    const D = window.GameData;
    if (!h || !h.state) return { wait: true };
    const s = h.state;
    const mem = window.__bot || (window.__bot = { rested: {}, floors: {}, bossStart: {}, turns: 0, stuck: 0, lastKey: '' });
    const el = id => document.getElementById(id);
    const vis = id => { const e = el(id); return !!e && !e.classList.contains('hidden'); };
    const good = policy === 'good';
    const snapshot = () => ({ seed: h.seed, map: (h.getFloor ? h.getFloor().layout.join('') : ''), arcana: s.arcana, level: s.level, hp: s.hp, maxHp: s.maxHp, vr: s.vr, deck: s.deck.length, kills: s.kills });

    if (vis('end-modal')) {
        return { done: true, victory: !!s.finalVictory, floor: s.floor, final: snapshot(), floors: mem.floors,
            bossStart: mem.bossStart, turns: mem.turns, overkills: s.overkills };
    }
    if (vis('title-modal')) { el('btn-start-daydream').click(); return { act: 'start' }; }
    if (vis('spreadsheet-modal')) { el('btn-close-spreadsheet').click(); return { act: 'closeSheet' }; }
    if (vis('epilogue-overlay')) { el('btn-punch-clock').click(); return { act: 'punch' }; }
    if (!mem.floors[s.floor]) mem.floors[s.floor] = snapshot();

    if (vis('arcana-modal')) {
        const picks = Array.from(document.querySelectorAll('#arcana-modal .arcana-choice'));
        if (picks.length === 0) return { wait: true };
        picks[Math.floor(Math.random() * picks.length)].click();
        return { act: 'arcana' };
    }
    if (vis('gem-modal')) {
        const target = document.querySelector('#gem-modal .gem-target-card:not([disabled])');
        (target || el('btn-gem-discard')).click();
        return { act: 'gem' };
    }
    if (vis('levelup-modal')) {
        const cards = Array.from(document.querySelectorAll('#reward-grid .reward-card'));
        if (cards.length === 0) return { wait: true };
        const evo = cards.find(c => c.classList.contains('evo-choice'));
        const pick = evo || (good ? cards[0] : cards[Math.floor(Math.random() * cards.length)]);
        pick.click();
        return { act: 'levelup' };
    }
    if (vis('rest-modal')) {
        const items = Array.from(document.querySelectorAll('#rest-items-grid .shop-item-card'));
        const byTitle = t => items.find(b => !b.disabled && b.querySelector('.shop-item-title').textContent.indexOf(t) === 0);
        if (good) {
            const heal = byTitle('Descansar');
            if (heal && s.hp <= s.maxHp - 12) { heal.click(); return { act: 'heal' }; }
            const gem = byTitle('Gema Bruta');
            if (gem) { gem.click(); return { act: 'buyGem' }; }
            const breath = byTitle('Fôlego Extra');
            if (breath) { breath.click(); return { act: 'breath' }; }
            const back = byTitle('Voltar');
            if (back) { back.click(); return { act: 'back' }; }
        }
        mem.rested[s.floor] = true;
        el('btn-rest-close').click();
        return { act: 'closeRest' };
    }
    if (vis('event-modal')) {
        const btn = document.querySelector('#event-choices .event-choice-btn:not([disabled])');
        if (btn) { btn.click(); return { act: 'event' }; }
        return { wait: true };
    }
    if (vis('narrative-modal')) { el('btn-narrative-continue').click(); return { act: 'narrative' }; }

    if (s.mode === 'combat') {
        if (s.busy || s.autoPlaying) return { wait: true };
        const enc = s.encounters.find(e => e.id === s.currentEncounterId);
        if (enc && enc.isBoss && !mem.bossStart[s.floor]) mem.bossStart[s.floor] = snapshot();
        const playable = s.hand.map((id, i) => i).filter(i => h.isUsefulCard(s.hand[i], i));
        if (playable.length > 0) {
            if (good) {
                h.playAllCards();
            } else {
                // Jogador descuidado: carta mais cara primeiro, sem montar sequência.
                const cost = i => (D.CARDS[s.hand[i]].cost || 0);
                playable.sort((a, b) => cost(b) - cost(a));
                h.playCard(playable[0]);
            }
            return { act: 'play' };
        }
        mem.turns += 1;
        h.endTurn();
        return { act: 'endTurn' };
    }

    if (s.mode !== 'explore' || s.busy || h.activeModal) return { wait: true };

    // ---------- Exploração: BFS até o próximo objetivo ----------
    const fl = h.getFloor ? h.getFloor() : D.getFloorConfig(s.floor);
    const L = fl.layout;
    const DX = [0, 1, 0, -1];
    const DY = [-1, 0, 1, 0];
    const alive = s.encounters.filter(e => e.alive);
    const encAt = (x, y) => alive.find(e => e.x === x && e.y === y);
    const tiles = ch => {
        const out = [];
        for (let y = 0; y < L.length; y++) for (let x = 0; x < L[y].length; x++) if (L[y][x] === ch) out.push({ x, y });
        return out;
    };
    const uncleared = ch => tiles(ch).filter(t => !s.clearedTiles.has(t.x + ',' + t.y));
    const boss = alive.find(e => e.isBoss);
    const minions = alive.filter(e => !e.isBoss);

    let goals = [];
    const hurt = good && s.hp <= s.maxHp * 0.55 && s.vr >= D.BALANCE.rest.healPrice && tiles('M').length && fl.restName;
    if (hurt) goals = tiles('M');
    else if (uncleared('C').length) goals = uncleared('C');
    else if (minions.length) goals = minions.map(e => ({ x: e.x, y: e.y }));
    else if (uncleared('?').length) goals = uncleared('?');
    else if (good && boss && !mem.rested[s.floor] && tiles('M').length && fl.restName) goals = tiles('M');
    else if (boss) goals = [{ x: boss.x, y: boss.y }];
    else if (s.bossDefeated) goals = tiles('E');
    if (goals.length === 0) return { wait: true, idle: true };

    const start = s.player.x + ',' + s.player.y;
    let prev;
    // BFS até o objetivo; inimigos (e a fogueira, quando não é o destino) contam como parede.
    const search = (targets, avoidRest) => {
        prev = new Map([[start, null]]);
        const queue = [[s.player.x, s.player.y]];
        while (queue.length) {
            const [cx, cy] = queue.shift();
            for (let d = 0; d < 4; d++) {
                const x = cx + DX[d];
                const y = cy + DY[d];
                const key = x + ',' + y;
                if (prev.has(key) || !D.isWalkableTile(L, x, y)) continue;
                const goal = targets.some(g => g.x === x && g.y === y);
                if (!goal && (encAt(x, y) || (avoidRest && L[y][x] === 'M'))) continue;
                prev.set(key, cx + ',' + cy);
                if (goal) return key;
                queue.push([x, y]);
            }
        }
        return null;
    };
    const wantsRest = L[goals[0].y][goals[0].x] === 'M';
    // Caminho bloqueado (baú atrás do Elite, fogueira numa porta): cruza a fogueira ou luta com quem bloqueia.
    const found = search(goals, !wantsRest) || search(goals, false) ||
        search(alive.map(e => ({ x: e.x, y: e.y })), false);
    if (!found) {
        // Sem caminho livre (ex.: fogueira no corredor): tenta de novo permitindo pisar na fogueira.
        mem.stuck += 1;
        if (mem.stuck > 40) return { dump: JSON.stringify({ L: L, p: s.player, goals: goals, alive: alive.map(e => [e.x, e.y, e.isBoss]), cleared: Array.from(s.clearedTiles), bd: s.bossDefeated }), done: true, stuck: true, floor: s.floor, final: snapshot(), floors: mem.floors, bossStart: mem.bossStart, turns: mem.turns };
        h.turnPlayer(1);
        return { act: 'spin' };
    }
    let node = found;
    while (prev.get(node) !== start) node = prev.get(node);
    const [nx, ny] = node.split(',').map(Number);
    const want = DX.findIndex((dx, d) => s.player.x + dx === nx && s.player.y + DY[d] === ny);
    if (want !== s.player.dir) {
        const delta = (want - s.player.dir + 4) % 4;
        h.turnPlayer(delta === 3 ? -1 : 1);
        return { act: 'turn' };
    }
    h.moveRelative(1, 0);
    return { act: 'move' };
}

async function runOne(browser, baseUrl, idx) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    // O bot roda sem WebGL (mais rápido); o aviso do three.js sobre isso é esperado.
    page.on('console', m => { if (m.type() === 'error' && !/WebGL/.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    await page.addInitScript(speedUp, SPEED);
    await page.goto(baseUrl, { timeout: 120000 });
    const started = Date.now();
    let result = null;
    let lastAct = '';
    while (!result && Date.now() - started < Number(arg('timeout', 240000))) {
        const r = await page.evaluate(botStep, POLICY);
        if (r.done) result = r;
        else {
            if (VERBOSE && r.act && r.act !== lastAct) { lastAct = r.act; process.stdout.write(idx + ':' + r.act + ' '); }
            await page.waitForTimeout(r.wait ? 12 : 6);
        }
    }
    if (!result) {
        result = { done: true, timeout: true, ...(await page.evaluate(() => {
            const s = window.__hcDebug.state;
            return { floor: s.floor, mode: s.mode, busy: s.busy, final: { level: s.level, hp: s.hp, maxHp: s.maxHp, vr: s.vr },
                dump: JSON.stringify({ hand: s.hand, mods: s.handCostMods, mana: s.mana, auto: s.autoPlaying, last: s.lastComboCost,
                    useful: s.hand.map((id, i) => window.__hcDebug.isUsefulCard(id, i)), order: window.__hcDebug.sortCardsByCombo(),
                    enemies: s.enemies.map(e => [e.kind, e.hp, e.col, e.row, e.overkill, e.intent]), draw: s.drawPile.length, disc: s.discardPile.length }) };
        })) };
    }
    result.errors = errors;
    await page.close();
    return result;
}

const srv = await serve(REPO + '/docs', overrides);
const browser = await chromium.launch({
    channel: 'chrome',
    headless: !arg('head', false),
    args: ['--mute-audio', '--disable-3d-apis', '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
});
const results = await Promise.all(Array.from({ length: RUNS }, (_, i) => runOne(browser, srv.url, i)));
await browser.close();
srv.close();

const wins = results.filter(r => r.victory).length;
console.log('\n=== policy=' + POLICY + ' runs=' + RUNS + ' source=' + SOURCE + ' ===');
results.forEach((r, i) => {
    const f = r.final || {};
    const floors = Object.entries(r.floors || {}).map(([n, v]) => 'F' + n + ':L' + v.level + ' hp' + v.hp + '/' + v.maxHp).join(' ');
    const bosses = Object.entries(r.bossStart || {}).map(([n, v]) => 'B' + n + ':L' + v.level + ' hp' + v.hp).join(' ');
    console.log('#' + i + ' ' + (r.victory ? 'WIN ' : r.timeout ? 'TIMEOUT(' + r.mode + ',busy=' + r.busy + ') ' : r.stuck ? 'STUCK ' : 'LOSS') +
        ' fase ' + r.floor + ' ' + (f.arcana || '-') + ' | L' + f.level + ' hp ' + f.hp + '/' + f.maxHp + ' vr ' + f.vr + ' turnos ' + r.turns +
        ' | ' + floors + ' | ' + bosses + (r.dump ? ' | ' + r.dump : '') + (r.errors.length ? ' | ERROS: ' + r.errors.slice(0, 2).join(' / ') : ''));
});
const avg = key => (results.reduce((a, r) => a + ((r.final || {})[key] || 0), 0) / results.length).toFixed(1);
const byFloor = {};
results.filter(r => !r.victory).forEach(r => { byFloor[r.floor] = (byFloor[r.floor] || 0) + 1; });
console.log('VITÓRIAS ' + wins + '/' + RUNS + ' | nível médio final ' + avg('level') + ' | derrotas por fase ' + JSON.stringify(byFloor) +
    ' | erros de console ' + results.reduce((a, r) => a + r.errors.length, 0));

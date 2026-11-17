// Etapa 3: runs seguidas geram mapas/hordas diferentes, seed reproduz, e telas de exploração, Elite e epílogo.
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { serve, CHROME_ARGS } from './serve.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
// Requer: npm i --no-save playwright-core. Uso: node tools/hc-proc.mjs (grava capturas proc-*.png na pasta atual)

const REPO = process.env.HC_REPO || fileURLToPath(new URL('..', import.meta.url));
const srv = await serve(REPO + '/docs');
// Intro vista e cartas já explicadas: este teste cobre mapas, não o modal de descoberta.
const dataCtx = vm.createContext({ window: {}, console });
vm.runInContext(fs.readFileSync(REPO + '/docs/js/data.js', 'utf8'), dataCtx);
const UI_SEEN = JSON.stringify({ introSeen: true, discoveredCardTutorials: Object.keys(dataCtx.window.GameData.CARDS) });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: CHROME_ARGS });
let failed = 0;
const check = (name, ok, detail) => {
    if (!ok) failed++;
    console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? ' ' + JSON.stringify(detail) : ''));
};
const fingerprint = page => page.evaluate(() => {
    const h = window.__hcDebug;
    const fl = h.getFloor();
    return {
        seed: h.seed,
        map: fl.layout.join('\n'),
        hordes: JSON.stringify(Object.keys(fl.encounters).sort().map(k => [k, fl.encounters[k].formation])),
        problems: window.GameDungeon.validateGeneratedFloor(fl)
    };
});
const start = async (page, query) => {
    await page.goto(srv.url + (query || ''));
    await page.click('#btn-start-daydream');
    await page.waitForTimeout(300);
    await page.click('#btn-narrative-continue');
    await page.waitForTimeout(400);
    await page.locator('#arcana-modal .arcana-choice').first().click();
    await page.waitForTimeout(500);
};

for (const [vp, size] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport: size });
    const errors = [];
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    // Testes fora do onboarding: a cutscene de 1ª visita já conta como vista.
    await page.addInitScript(ui => localStorage.setItem('hc_ui_v1', ui), UI_SEEN);

    await start(page);
    const a = await fingerprint(page);
    await page.screenshot({ path: 'proc-' + vp + '-explore.png' });
    // Segunda run na mesma página (botão reiniciar) e terceira em página nova
    await page.evaluate(() => window.__hcDebug.restart());
    await page.waitForTimeout(300);
    await page.click('#btn-start-daydream');
    await page.waitForTimeout(300);
    await page.click('#btn-narrative-continue');
    await page.waitForTimeout(400);
    await page.locator('#arcana-modal .arcana-choice').first().click();
    await page.waitForTimeout(500);
    const b = await fingerprint(page);
    check(vp + ' runs seguidas: seed, mapa e hordas diferentes', a.seed !== b.seed && a.map !== b.map && a.hordes !== b.hordes, { a: a.seed, b: b.seed });
    check(vp + ' mapas gerados válidos', a.problems.length === 0 && b.problems.length === 0, a.problems.concat(b.problems));
    console.log(a.map + '\n\n' + b.map);

    await start(page, '?seed=4242');
    const c = await fingerprint(page);
    await start(page, '?seed=4242');
    const d = await fingerprint(page);
    check(vp + ' ?seed= reproduz mapa e hordas', c.seed === 4242 && c.map === d.map && c.hordes === d.hordes, { seed: c.seed });

    // Etapa 4: tile especial (P = Baú de Prata, O = Mesa de Oferenda, W = Poço) pisado de verdade no mapa gerado.
    const special = await page.evaluate(() => {
        const h = window.__hcDebug;
        const s = h.state;
        const fl = h.getFloor();
        const sp = fl.poi.specials[0];
        if (!sp) return null;
        s.encounters.forEach(e => { e.alive = false; }); // sem aggro no caminho; o Elite continua na lista
        const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        for (let d = 0; d < 4; d++) {
            const x = sp.x - DIRS[d][0];
            const y = sp.y - DIRS[d][1];
            if (fl.layout[y][x] !== '.') continue;
            s.player.x = x;
            s.player.y = y;
            // A câmera gira em passos relativos: vira o jogador até encarar o tile (no mínimo ida e volta, para sincronizar).
            const turns = (d - s.player.dir + 4) % 4;
            if (turns === 0) { h.turnPlayer(1); h.turnPlayer(-1); }
            for (let i = 0; i < turns; i++) h.turnPlayer(1);
            return { ch: sp.ch, key: sp.x + ',' + sp.y, count: fl.poi.specials.length };
        }
        return { ch: sp.ch, blocked: true };
    });
    check(vp + ' andar gerado tem tile especial acessível', !!special && !special.blocked, special);
    if (special && !special.blocked) {
        await page.waitForTimeout(1300);
        await page.screenshot({ path: 'proc-' + vp + '-special.png' });
        await page.evaluate(() => window.__hcDebug.moveRelative(1, 0));
        await page.waitForTimeout(600);
        const opened = await page.evaluate(() => {
            const m = window.__hcDebug.activeModal;
            return { type: m && m.type, kind: m && m.event && m.event.id };
        });
        const expected = { P: 'bau_prata', O: 'mesa_oferenda' }[special.ch];
        check(vp + ' pisar no tile ' + special.ch + ' abre o evento certo', expected
            ? opened.type === 'event' && opened.kind === expected
            : opened.type === 'gem' || opened.type === 'arcana', opened);
        await page.evaluate(() => {
            const pick = sel => { const list = document.querySelectorAll(sel); return list[list.length - 1]; };
            const b = pick('#event-modal:not(.hidden) .event-choice-btn') || pick('#arcana-modal:not(.hidden) .arcana-choice') ||
                document.querySelector('#gem-modal:not(.hidden) #btn-gem-discard');
            if (b) b.click();
        });
        await page.waitForTimeout(500);
        check(vp + ' tile ' + special.ch + ': Poço some ao usar; baú/mesa recusados continuam no mapa', await page.evaluate(([k, ch]) =>
            window.__hcDebug.state.clearedTiles.has(k) === (ch === 'W') && window.__hcDebug.state.mode === 'explore', [special.key, special.ch]));
    }

    // Combate Elite
    await page.evaluate(() => {
        const h = window.__hcDebug;
        h.state.stats.Recovery = 3;
        h.state.stats.Freeze = 100;
        h.state.curse = 20;
        const eliteEnc = h.state.encounters.find(e => e.isElite);
        h.startEncounter(eliteEnc.id, eliteEnc.enc);
    });
    await page.waitForTimeout(900);
    const elite = await page.evaluate(() => window.__hcDebug.state.enemies.filter(e => e.elite).length);
    check(vp + ' encontro Elite tem exatamente 1 elite', elite === 1, elite);
    await page.evaluate(() => { const h = window.__hcDebug; const o = h.sortCardsByCombo(); if (o.length) h.playCard(o[0]); });
    await page.waitForTimeout(900);
    await page.screenshot({ path: 'proc-' + vp + '-elite.png' });

    // Recovery + recompensa do Elite ao vencer; fila de modais esvazia
    const hp0 = await page.evaluate(() => { const s = window.__hcDebug.state; s.hp = 20; s.enemies.forEach(e => { e.hp = 0; }); s.hand = []; window.__hcDebug.endTurn(); return 20; });
    await page.waitForFunction(() => window.__hcDebug.state.mode !== 'combat', null, { timeout: 20000 });
    await page.waitForTimeout(600);
    check(vp + ' Recovery cura ao vencer', await page.evaluate(h => window.__hcDebug.state.hp > h, hp0));
    const gemOpen = await page.evaluate(() => !document.getElementById('gem-modal').classList.contains('hidden') ||
        !document.getElementById('levelup-modal').classList.contains('hidden'));
    check(vp + ' Elite abre recompensa pela fila', gemOpen);
    for (let i = 0; i < 30; i++) {
        const open = await page.evaluate(() => Array.from(document.querySelectorAll('.modal-overlay')).filter(m => !m.classList.contains('hidden')).map(m => m.id));
        if (open.length === 0) break;
        if (open.length > 1) check(vp + ' fila: nunca dois modais', false, open);
        await page.evaluate(() => {
            const b = document.querySelector('#levelup-modal:not(.hidden) .reward-card, #gem-modal:not(.hidden) #btn-gem-discard, #narrative-modal:not(.hidden) #btn-narrative-continue');
            if (b) b.click();
        });
        await page.waitForTimeout(350);
    }

    // Revival: dano letal com 1 carga
    await page.evaluate(() => {
        const h = window.__hcDebug;
        const s = h.state;
        h.startEncounter(null, h.getFloor().encounters['1']);
        s.revival = 1;
        s.hp = 1;
        s.shield = 0;
        s.enemies.forEach(e => { e.atk = 3; });
        s.hand = [];
        h.endTurn();
    });
    await page.waitForFunction(() => !window.__hcDebug.state.busy, null, { timeout: 30000 });
    const rev = await page.evaluate(() => { const s = window.__hcDebug.state; return { mode: s.mode, hp: s.hp, charges: s.revival }; });
    check(vp + ' Revival revive e consome carga', rev.mode === 'combat' && rev.hp > 0 && rev.charges === 0, rev);

    // Epílogo pelo fluxo real: vence o chefe final
    await page.evaluate(() => {
        const h = window.__hcDebug;
        const s = h.state;
        s.enemies.forEach(e => { e.hp = 0; });
        s.hand = [];
        h.endTurn();
    });
    await page.waitForFunction(() => window.__hcDebug.state.mode !== 'combat', null, { timeout: 20000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
        const h = window.__hcDebug;
        h.state.floor = 5;
        h.startEncounter(null, window.GameData.getFloorConfig(5).encounters['B']);
        h.state.enemies.forEach(e => { e.hp = 0; e.killedOnce = true; });
        h.state.bossDefeated = true;
        h.state.hand = [];
        h.endTurn();
    });
    await page.waitForFunction(() => !document.getElementById('epilogue-overlay').classList.contains('hidden'), null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4200);
    const epi = await page.evaluate(() => !document.getElementById('epilogue-overlay').classList.contains('hidden'));
    check(vp + ' epílogo abre no mapa gerado', epi);
    await page.screenshot({ path: 'proc-' + vp + '-epilogue.png' });
    const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, w: innerWidth, h: innerHeight }));
    check(vp + ' layout sem overflow', ov.sw <= ov.w && ov.sh <= ov.h, ov);
    check(vp + ' console: 0 erros/avisos', errors.length === 0, errors.slice(0, 4));
    await page.close();
}
await browser.close();
srv.close();
console.log(failed === 0 ? 'TUDO OK' : 'FALHAS: ' + failed);

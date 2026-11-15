// Testes headless da Etapa 2: combo, gemas, arcanas, overkill, fila de modais e erros de console.
// Requer: npm i --no-save playwright-core (usa o Chrome instalado). Uso: node tools/hc-e2e.mjs
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { serve, CHROME_ARGS } from './serve.mjs';

const REPO = process.env.HC_REPO || fileURLToPath(new URL('..', import.meta.url));
const srv = await serve(REPO + '/docs');
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: CHROME_ARGS });
let failed = 0;
const check = (vp, name, ok, detail) => {
    if (!ok) failed++;
    console.log((ok ? 'ok   ' : 'FAIL ') + vp + ' ' + name + (detail ? ' ' + JSON.stringify(detail) : ''));
};
const CLOSE_ANY = '#levelup-modal:not(.hidden) .reward-card, #gem-modal:not(.hidden) #btn-gem-discard, ' +
    '#narrative-modal:not(.hidden) #btn-narrative-continue';

for (const [vp, size] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport: size });
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    await page.goto(srv.url);
    const openModals = () => page.evaluate(() => Array.from(document.querySelectorAll('.modal-overlay'))
        .filter(m => !m.classList.contains('hidden')).map(m => m.id));
    const only = async id => JSON.stringify(await openModals()) === JSON.stringify([id]);
    const wait = ms => page.waitForTimeout(ms);
    const st = fn => page.evaluate(fn);
    // Combate controlado: inimigos gordos e inofensivos, mão definida, Cafeína sobrando.
    const arena = (hand, opts) => page.evaluate(([cards, o]) => {
        const h = window.__hcDebug;
        const s = h.state;
        if (s.mode !== 'combat') h.startEncounter(null, window.GameData.getFloorConfig(1).encounters['1']);
        s.enemies.forEach(e => {
            if (!o.keepHp) { e.hp = 9999; e.maxHp = 9999; }
            e.atk = 0;
            e.shield = 0;
        });
        s.hand = cards.slice();
        s.handReturnCounts = cards.map(() => 0);
        s.handCostMods = cards.map(() => 0);
        s.mana = 20;
        s.comboCount = 0;
        s.lastComboCost = null;
        s.combo = 1;
        s.comboChain = [];
        s.comboReverse = false;
        s.comboCarry = 0;
        s.busy = false;
    }, [hand, opts || {}]);
    const idle = () => page.waitForFunction(() => !window.__hcDebug.state.busy, null, { timeout: 30000 });
    const play = async id => {
        await page.evaluate(card => { const h = window.__hcDebug; h.playCard(h.state.hand.indexOf(card)); }, id);
        await idle();
        return st(() => window.__hcDebug.state.comboCount + 1);
    };
    const turn = async () => {
        await st(() => window.__hcDebug.endTurn());
        await idle();
        await wait(200);
    };
    const drainModals = async label => {
        for (let i = 0; i < 40 && (await openModals()).length > 0; i++) {
            const open = await openModals();
            if (open.length !== 1) check(vp, 'fila: nunca dois modais (' + label + ')', false, open);
            await page.evaluate(sel => { const b = document.querySelector(sel); if (b) b.click(); }, CLOSE_ANY);
            await wait(350);
        }
    };

    // --- Fila única: narrativa -> arcana, nunca dois modais ---
    await page.click('#btn-start-daydream');
    await wait(300);
    check(vp, 'fila: só a narrativa aberta', await only('narrative-modal'), await openModals());
    await page.click('#btn-narrative-continue');
    await wait(400);
    check(vp, 'fila: arcana abre depois da narrativa', await only('arcana-modal'), await openModals());
    check(vp, 'arcana: 3 opções', await page.locator('#arcana-modal .arcana-choice').count() === 3);
    await page.locator('#arcana-modal .arcana-choice').first().click();
    await wait(400);
    check(vp, 'arcana: escolhida e fila vazia', (await openModals()).length === 0 &&
        await st(() => !!window.__hcDebug.state.arcana && window.__hcDebug.state.mode === 'explore'));

    // --- Gemas: modais enfileirados abrem um por vez; encaixe e recusa ---
    await st(() => { const h = window.__hcDebug; h.grantGem('double'); h.grantGem('mana_minus'); h.grantGem('steal'); });
    await wait(300);
    check(vp, 'gema: um modal por vez', await only('gem-modal'), await openModals());
    const before = await st(() => JSON.stringify(window.__hcDebug.state.cardGems));
    await page.locator('#gem-modal .gem-target-card:not([disabled])').first().click();
    await wait(400);
    check(vp, 'gema: encaixada em slot', await page.evaluate(b => JSON.stringify(window.__hcDebug.state.cardGems) !== b, before));
    check(vp, 'gema: próximo da fila abre', await only('gem-modal'), await openModals());
    await page.locator('#gem-modal .gem-target-card:not([disabled])').first().click();
    await wait(400);
    const vr0 = await st(() => window.__hcDebug.state.vr);
    await page.click('#btn-gem-discard');
    await wait(500);
    check(vp, 'gema: recusar dá VR e a fila esvazia', (await openModals()).length === 0 &&
        await page.evaluate(v => window.__hcDebug.state.vr > v && window.__hcDebug.state.mode === 'explore', vr0));
    const rules = await st(() => {
        const h = window.__hcDebug;
        h.state.cardGems = {};
        const full = ['double', 'drain', 'freeze', 'leader'].map(g => h.socketGem('chicote_dados', g));
        return {
            minus: h.socketGem('mordida_ferro', 'mana_minus'),
            plusBlocked: !h.socketGem('mordida_ferro', 'mana_plus'),
            dupBlocked: !h.socketGem('mordida_ferro', 'mana_minus'),
            uselessBlocked: !h.socketGem('grito_guerra', 'double'),
            slots: full
        };
    });
    check(vp, 'gema: incompatível, repetida, inútil e slot cheio são barrados',
        rules.minus && rules.plusBlocked && rules.dupBlocked && rules.uselessBlocked && rules.slots.filter(Boolean).length === 3, rules);

    // --- Combo 0 -> 1 -> 2 -> 3 + Wild ---
    await st(() => { const h = window.__hcDebug; h.state.cardGems = {}; h.setArcana('escudo_soberbo'); });
    const ladder = ['grito_guerra', 'eco_mare', 'chicote_dados', 'julgamento_final', 'moeda_destino', 'golpe_furtivo'];
    await arena(ladder);
    const seq = [];
    for (const id of ladder) seq.push(await play(id));
    check(vp, 'combo: 0->1->2->3, Wild e custo 0 sobem até 6x', JSON.stringify(seq) === '[1,2,3,4,5,6]', seq);
    check(vp, 'combo: mini-pilha visível', await st(() => {
        const c = document.getElementById('combo-chain');
        return !!c && c.children.length > 0;
    }));
    await wait(300);
    await page.screenshot({ path: 'e2e-' + vp + '-combat.png' });
    await arena(['grito_guerra', 'chicote_dados']);
    await play('grito_guerra');
    check(vp, 'combo: pular custo quebra a cadeia', await play('chicote_dados') === 1);

    // --- Gemas em combate ---
    await st(() => { const h = window.__hcDebug; h.state.cardGems = {}; h.socketGem('chicote_dados', 'mana_minus'); });
    await arena(['grito_guerra', 'chicote_dados']);
    await play('grito_guerra');
    check(vp, 'gema Mana -1: custo 2 vira 1 e comba após custo 0', await play('chicote_dados') === 2);
    await st(() => { const h = window.__hcDebug; h.state.cardGems = {}; h.socketGem('chicote_dados', 'reverse'); });
    await arena(['chicote_dados', 'mordida_ferro']);
    await play('chicote_dados');
    check(vp, 'gema Combo Reverso: próxima pode descer -1', await play('mordida_ferro') === 2);
    const totalHp = () => st(() => window.__hcDebug.state.enemies.reduce((a, e) => a + e.hp, 0));
    const damageWith = async gem => {
        await page.evaluate(g => {
            const h = window.__hcDebug;
            h.state.cardGems = {};
            if (g) h.socketGem('mordida_ferro', g);
            h.state.stats.Luck = -100; // sem crítico: o dano fica determinístico
        }, gem);
        await arena(['mordida_ferro']);
        const hp0 = await totalHp();
        await play('mordida_ferro');
        return hp0 - await totalHp();
    };
    const base = await damageWith(null);
    const doubled = await damageWith('double');
    check(vp, 'gema Dano Duplo: dobra o dano', base > 0 && doubled === base * 2, { base, doubled });
    await st(() => { window.__hcDebug.state.stats.Luck = 0; window.__hcDebug.state.cardGems = {}; });

    // --- Arcanas: efeito entre turnos ---
    await st(() => window.__hcDebug.setArcana('escudo_soberbo'));
    await arena([]);
    await st(() => { window.__hcDebug.state.shield = 9; });
    await turn();
    check(vp, 'arcana Escudo Soberbo: escudo persiste', await st(() => window.__hcDebug.state.shield) === 9);
    await st(() => window.__hcDebug.setArcana('mente_afiada'));
    await arena([]);
    await st(() => { window.__hcDebug.state.mana = 2; });
    await turn();
    check(vp, 'arcana Mente Afiada: Cafeína sobrando soma', await st(() => {
        const s = window.__hcDebug.state;
        return s.mana === s.maxMana + 2;
    }), await st(() => window.__hcDebug.state.mana));
    await st(() => window.__hcDebug.setArcana('elo_corrente'));
    await arena(['grito_guerra', 'eco_mare']);
    await play('grito_guerra');
    await play('eco_mare');
    await turn();
    check(vp, 'arcana Elo da Corrente: combo não zera', await st(() => window.__hcDebug.state.comboCount) === 1);
    await st(() => window.__hcDebug.setArcana('golpe_escudo'));
    await arena(['escudo_burocratico']);
    const frontHp = () => st(() => window.__hcDebug.state.enemies.filter(e => e.row === 0).reduce((a, e) => a + e.hp, 0));
    const hpA = await frontHp();
    await play('escudo_burocratico');
    check(vp, 'arcana Golpe de Escudo: escudo vira dano na frente', await frontHp() < hpA);
    await st(() => window.__hcDebug.setArcana('fluxo_combo'));
    await arena(['grito_guerra', 'eco_mare']);
    await st(() => { window.__hcDebug.state.fluxoPity = true; });
    await turn();
    const fluxo = await st(() => { const s = window.__hcDebug.state; return { count: s.comboCount, carry: s.comboCarry, pity: s.fluxoPity }; });
    check(vp, 'arcana Fluxo e Combo: tentativa garantida dá +1 Combo', fluxo.count >= 1 || fluxo.carry >= 1, fluxo);

    // --- Overkill em chefe, fim de combate e fila sem travar ---
    await st(() => {
        const h = window.__hcDebug;
        h.setArcana('escudo_soberbo');
        h.state.enemies.forEach(e => { e.hp = 0; });
        h.state.hand = [];
        h.endTurn();
    });
    await page.waitForFunction(() => window.__hcDebug.state.mode !== 'combat', null, { timeout: 20000 });
    await wait(400);
    await drainModals('pós-combate');
    await st(() => window.__hcDebug.startEncounter(null, window.GameData.getFloorConfig(1).encounters['B']));
    await st(() => window.__hcDebug.state.enemies.forEach(e => {
        e.atk = 0;
        if (e.isBoss) { e.hp = 5; e.shield = 0; }
    }));
    await arena(['julgamento_final', 'chicote_dados'], { keepHp: true });
    const vrB = await st(() => window.__hcDebug.state.vr);
    await play('julgamento_final');
    const ok1 = await st(() => {
        const s = window.__hcDebug.state;
        return { mode: s.mode, active: s.bossOverkillActive, boss: s.enemies.some(e => e.isBoss && e.overkill) };
    });
    check(vp, 'overkill: chefe morto fica em OVERKILL no turno', ok1.mode === 'combat' && ok1.active && ok1.boss, ok1);
    await play('chicote_dados');
    check(vp, 'overkill: dano extra vira VR', await page.evaluate(v => window.__hcDebug.state.vr > v, vrB));
    await st(() => {
        const h = window.__hcDebug;
        h.state.enemies.forEach(e => { if (!e.isBoss) e.hp = 0; });
        if (h.state.mode === 'combat') h.endTurn();
    });
    await page.waitForFunction(() => window.__hcDebug.state.mode !== 'combat', null, { timeout: 20000 });
    await wait(400);
    await drainModals('pós-chefe');
    check(vp, 'fila: esvazia e volta à exploração', (await openModals()).length === 0 &&
        await st(() => window.__hcDebug.state.mode === 'explore' && !window.__hcDebug.state.busy));
    const ov = await st(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, w: innerWidth, h: innerHeight }));
    check(vp, 'layout: sem overflow', ov.sw <= ov.w && ov.sh <= ov.h, ov);
    check(vp, 'console: 0 erros', errors.length === 0, errors.slice(0, 4));
    await page.close();
}
await browser.close();
srv.close();
console.log(failed === 0 ? 'TUDO OK' : 'FALHAS: ' + failed);
process.exit(failed ? 1 : 0);

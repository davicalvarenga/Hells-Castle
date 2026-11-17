// Testes headless: combo, gemas, arcanas, overkill, fila de modais e erros de console (Etapa 2) +
// arsenal completo, gemas avançadas, rachadura e eventos de mapa (Etapa 4).
// Requer: npm i --no-save playwright-core (usa o Chrome instalado). Uso: node tools/hc-e2e.mjs
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { serve, CHROME_ARGS } from './serve.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

const REPO = process.env.HC_REPO || fileURLToPath(new URL('..', import.meta.url));
const srv = await serve(REPO + '/docs');
// Páginas antigas: intro vista e todas as cartas já explicadas (a Etapa 8 testa a descoberta numa página própria).
const dataCtx = vm.createContext({ window: {}, console });
vm.runInContext(fs.readFileSync(path.join(REPO, 'docs/js/data.js'), 'utf8'), dataCtx);
const UI_SEEN = JSON.stringify({ introSeen: true, discoveredCardTutorials: Object.keys(dataCtx.window.GameData.CARDS) });
// Itch.io: mesma pasta docs/ servida numa subpasta (jogo/) e embutida num iframe (host.html).
const subRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-itch-'));
fs.symlinkSync(path.resolve(REPO, 'docs'), path.join(subRoot, 'jogo'), 'dir');
fs.writeFileSync(path.join(subRoot, 'host.html'), '<!doctype html><meta charset="utf-8"><title>host</title><link rel="icon" href="data:,">' +
    '<body style="margin:0"><iframe src="jogo/index.html" style="border:0;width:100vw;height:100vh"></iframe></body>');
const subSrv = await serve(subRoot);
// Com run salva em andamento, "Novo Expediente" pede um 2º toque de confirmação (Etapa 9).
const startDay = async pg => {
    await pg.click('#btn-start-daydream');
    if (await pg.evaluate(() => document.getElementById('btn-start-daydream').classList.contains('confirming'))) await pg.click('#btn-start-daydream');
};
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: CHROME_ARGS });
let failed = 0;
const check = (vp, name, ok, detail) => {
    if (!ok) failed++;
    console.log((ok ? 'ok   ' : 'FAIL ') + vp + ' ' + name + (detail ? ' ' + JSON.stringify(detail) : ''));
};
const CLOSE_ANY = '#levelup-modal:not(.hidden) .reward-card, #gem-modal:not(.hidden) #btn-gem-discard, ' +
    '#narrative-modal:not(.hidden) #btn-narrative-continue, #discovery-modal:not(.hidden) #btn-discovery-ok';

for (const [vp, size] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport: size });
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    // Testes fora do onboarding: a cutscene de 1ª visita já conta como vista.
    await page.addInitScript(ui => localStorage.setItem('hc_ui_v1', ui), UI_SEEN);
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
            if (!o.keepHp) { e.hp = o.hp || 9999; e.maxHp = o.hp || 9999; }
            e.atk = 0;
            e.shield = 0;
            e.frost = 0;
        });
        s.hand = cards.slice();
        s.handReturnCounts = cards.map(() => 0);
        s.handCostMods = cards.map(() => 0);
        s.handTemp = cards.map(() => false);
        s.shield = 0;
        s.combatBuff = { Might: 0, Area: 0, Amount: 0 };
        s.columnBurn = [0, 0, 0, 0, 0];
        s.columnBurnFloor = [0, 0, 0, 0, 0];
        s.cardUses = {};
        s.comboPile = [];
        s.nextCostDiscount = 0;
        s.endTurnEchoes = [];
        s.turnLastFx = null;
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
    await startDay(page);
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

    // --- HUD do combo: selo dourado em TODA carta que continua a cadeia, ganho do combo em dourado ---
    const seals = () => st(() => (window.__hcDebug.render(), window.__hcDebug.state.hand).map((id, i) => {
        const b = document.querySelectorAll('#hand-grid .card-btn')[i];
        const seal = b.querySelector('.combo-seal');
        return { id, seal: seal ? seal.textContent : '', start: !!(seal && seal.classList.contains('start')), next: b.classList.contains('combo-next'),
            gold: Array.from(b.querySelectorAll('.card-desc .combo-val')).map(x => x.textContent) };
    }));
    await arena(['moeda_destino', 'golpe_furtivo', 'mordida_ferro', 'chicote_dados']);
    const sStart = await seals();
    check(vp, 'combo HUD: no início da cadeia, Wild e custo 0 mostram "▶ INICIA" (sem x2)',
        sStart.filter(c => c.start).map(c => c.id).join() === 'moeda_destino,golpe_furtivo' && sStart.every(c => !c.next), sStart);
    await play('moeda_destino');
    const sWild = await seals();
    const byId = (list, id) => list.find(c => c.id === id);
    check(vp, 'combo HUD: depois do Wild, custo 0 E custo 1 ganham borda pulsante e "COMBO x2!"; custo 2 não',
        byId(sWild, 'golpe_furtivo').seal === 'COMBO x2!' && byId(sWild, 'golpe_furtivo').next &&
        byId(sWild, 'mordida_ferro').seal === 'COMBO x2!' && byId(sWild, 'mordida_ferro').next &&
        byId(sWild, 'chicote_dados').seal === '' && !byId(sWild, 'chicote_dados').next, sWild);
    check(vp, 'combo HUD: o ganho do combo aparece em dourado na descrição (2 adagas, não 1)',
        JSON.stringify(byId(sWild, 'golpe_furtivo').gold) === '["2"]' && byId(sWild, 'mordida_ferro').gold.includes('2'), sWild);
    check(vp, 'combo: Wild -> 1 continua a cadeia (x2)', await play('mordida_ferro') === 2);
    const sAfter = await seals();
    check(vp, 'combo HUD: Wild -> 1 -> 2 destaca o Chicote com "COMBO x3!"', byId(sAfter, 'chicote_dados').seal === 'COMBO x3!' &&
        await st(() => document.getElementById('combo-bonus').textContent === 'PRÓX: C2 ou WILD'), sAfter);
    check(vp, 'combo: Wild -> 1 -> 2 chega a x3', await play('chicote_dados') === 3);
    await arena(['moeda_destino', 'chicote_dados']);
    await play('moeda_destino');
    check(vp, 'combo: Wild -> 2 ainda quebra (pula degrau)', await play('chicote_dados') === 1);
    check(vp, 'combo HUD: rótulo do próximo custo depois de um Wild', await st(() => {
        const h = window.__hcDebug;
        h.state.lastComboCost = window.GameData.WILD_STEP;
        h.render();
        return document.getElementById('combo-bonus').textContent === 'PRÓX: C0/C1 ou WILD';
    }));

    // --- Evolução estilo Vampire Survivors: o que falta, e "PRONTA P/ EVOLUIR!" ---
    const evoBadge = () => st(() => {
        const s = window.__hcDebug.state;
        const b = document.querySelectorAll('#hand-grid .card-btn')[s.hand.indexOf('mordida_ferro')];
        const e = b.querySelector('.evo-badge');
        return { text: e ? e.textContent : '', ready: !!(e && e.classList.contains('ready')), glow: b.classList.contains('evo-ready'), title: e ? e.title : '' };
    });
    const evoSave = await st(() => JSON.stringify({ r: window.__hcDebug.state.relics, l: window.__hcDebug.state.cardLevels }));
    await st(() => { const s = window.__hcDebug.state; s.relics = []; s.cardLevels = {}; });
    await arena(['mordida_ferro', 'golpe_furtivo']);
    await st(() => window.__hcDebug.render());
    const evo0 = await evoBadge();
    await st(() => { const s = window.__hcDebug.state; s.relics = ['rel_grampos']; window.__hcDebug.render(); });
    const evo1 = await evoBadge();
    await st(() => { const s = window.__hcDebug.state; s.cardLevels.mordida_ferro = 2; window.__hcDebug.render(); });
    const evo2 = await evoBadge();
    check(vp, 'evolução: selo mostra Relíquia e Nível faltando, depois só o Nível, e brilha PRONTA P/ EVOLUIR!',
        evo0.text === 'EVO: falta Pedra de Amolar + Nv.MÁX' && !evo0.ready && /Dança das Lâminas/.test(evo0.title) &&
        evo1.text === 'EVO: falta Nv.MÁX' && evo2.text === 'PRONTA P/ EVOLUIR!' && evo2.ready && evo2.glow, { evo0, evo1, evo2 });
    check(vp, 'evolução: carta sem evolução não tem selo', await st(() => {
        const s = window.__hcDebug.state;
        return !document.querySelectorAll('#hand-grid .card-btn')[s.hand.indexOf('golpe_furtivo')].querySelector('.evo-badge');
    }));
    await page.evaluate(v => { const o = JSON.parse(v); window.__hcDebug.state.relics = o.r; window.__hcDebug.state.cardLevels = o.l; }, evoSave);

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

    // ================= ETAPA 4: ARSENAL, GEMAS AVANÇADAS E RACHADURA =================
    const hc = (fn, arg) => page.evaluate(fn, arg);
    const snap = () => st(() => {
        const s = window.__hcDebug.state;
        return { mana: s.mana, shield: s.shield, hp: s.hp, maxHp: s.maxHp, vr: s.vr, hand: s.hand.slice(), temp: s.handTemp.slice(),
            draw: s.drawPile.slice(), discard: s.discardPile.slice(), pile: s.comboPile.slice(), destroyed: s.destroyedPile.slice(),
            deck: s.deck.slice(), combo: s.comboCount, kills: s.kills, cracked: Object.keys(s.crackedCards), burn: s.columnBurn.slice(),
            floor: s.columnBurnFloor.slice(), discount: Object.assign({}, s.discardDiscount), next: s.nextCostDiscount };
    });
    // Turno rápido: os inimigos só avançam (sem animação de ataque).
    const fastTurn = async () => {
        await st(() => {
            const h = window.__hcDebug;
            h.state.enemies.forEach(e => { e.intent = null; e.hasIntent = false; });
            h.endTurn();
        });
        await idle();
        await wait(200);
    };
    const gem = (card, gemId) => hc(([c, g]) => {
        const h = window.__hcDebug;
        h.state.cardGems = {};
        h.state.yinYang = {};
        return g ? h.socketGem(c, g) : true;
    }, [card, gemId]);
    const count = (list, id) => list.filter(c => c === id).length;
    await st(() => {
        const h = window.__hcDebug;
        h.state.cardGems = {};
        h.state.crackedCards = {};
        h.state.stats.Luck = -100; // sem crítico nem espalhamento: dano determinístico
        h.setArcana('mente_afiada');
    });

    // --- Custo X ---
    await arena(['explosao_total']);
    await st(() => { window.__hcDebug.state.mana = 4; });
    let hp0 = await totalHp();
    await play('explosao_total');
    const xDmg = hp0 - await totalHp();
    check(vp, 'Custo X: gasta toda a Cafeína e causa 7 x X em cada frente', (await snap()).mana === 0 && xDmg === 7 * 4 * 2, { xDmg });
    await arena(['tomo_1', 'explosao_total']);
    await st(() => { window.__hcDebug.state.mana = 0; });
    await play('tomo_1');
    check(vp, 'Custo X: X = 1 comba depois de uma carta de custo 0', await play('explosao_total') === 2);
    check(vp, 'Custo X: sem Cafeína a carta não sai', await st(() => {
        const h = window.__hcDebug;
        h.state.hand = ['explosao_total'];
        h.state.mana = 0;
        return h.playCard(0) === false && !h.isUsefulCard('explosao_total', 0);
    }));

    // --- Tomos de Mana e Canção ---
    await arena(['tomo_1', 'tomo_2', 'tomo_3']);
    await st(() => { window.__hcDebug.state.mana = 0; });
    const tomes = [await play('tomo_1'), await play('tomo_2'), await play('tomo_3')];
    check(vp, 'Tomos: 0->1->2 sobem o combo e cada um rende +1 de Cafeína',
        JSON.stringify(tomes) === '[1,2,3]' && (await snap()).mana === 3, { tomes, mana: (await snap()).mana });
    await arena(['cancao_mana']);
    await st(() => { window.__hcDebug.state.mana = 2; });
    await play('cancao_mana');
    const song = await snap();
    await play('cafeina_pura');
    const pure = await snap();
    check(vp, 'Canção: cria Cafeína Pura (0 Wild, +3 Cafeína, Destroy)', JSON.stringify(song.hand) === '["cafeina_pura"]' &&
        pure.mana === 3 && pure.combo === 1 && pure.destroyed.includes('cafeina_pura') &&
        !pure.pile.concat(pure.discard, pure.draw, pure.deck).includes('cafeina_pura'), { song: song.hand, mana: pure.mana });
    await arena(['cancao_mana']);
    await play('cancao_mana');
    await fastTurn();
    const gone = await snap();
    check(vp, 'Canção: Cafeína Pura não usada some no fim do turno',
        !gone.hand.concat(gone.discard, gone.draw).includes('cafeina_pura'));

    // --- Wild puras ---
    await arena(['grito_guerra', 'w_amuleto']);
    await play('grito_guerra');
    check(vp, 'Wild Amuleto: comba e sobe +1 Combo extra', await play('w_amuleto') === 3);
    await arena(['w_asas', 'chicote_dados']);
    await st(() => { window.__hcDebug.state.mana = 6; });
    await play('w_asas');
    const wings = { mana: (await snap()).mana, label: await st(() => document.querySelector('#hand-grid .card-cost').textContent) };
    await play('chicote_dados');
    const afterWings = await snap();
    check(vp, 'Wild Asas: custa 4 e a próxima carta custa 1 a menos',
        wings.mana === 2 && wings.label === '1' && afterWings.mana === 1 && afterWings.next === 0, wings);
    await arena(['w_broquel']);
    await play('w_broquel');
    check(vp, 'Wild Parmégide: +6 Escudo', (await snap()).shield === 6);
    await arena(['w_pulseira']);
    hp0 = await totalHp();
    await play('w_pulseira');
    check(vp, 'Wild Pulseira: 2 projéteis de 4 dano', hp0 - await totalHp() === 8);

    // --- Pickups de baú ---
    await st(() => {
        const h = window.__hcDebug;
        ['e_saco_moedas', 'e_coracao', 'e_ampulheta', 'e_sino'].forEach(id => h.grantPickup(id));
    });
    await arena(['e_saco_moedas', 'e_coracao', 'e_ampulheta', 'e_sino']);
    await st(() => { const s = window.__hcDebug.state; s.hp = s.maxHp - 10; });
    check(vp, 'pickups: Jogar Tudo gasta moedas/cura, mas guarda os de combate para o jogador', await st(() => {
        const h = window.__hcDebug;
        const useful = id => h.isUsefulCard(id, h.state.hand.indexOf(id));
        return useful('e_saco_moedas') && useful('e_coracao') && !useful('e_ampulheta') && !useful('e_sino');
    }));
    const pk0 = await snap();
    await play('e_saco_moedas');
    await play('e_coracao');
    const pk1 = await snap();
    check(vp, 'pickups: Saco de Moedas +25 VR e Coraçãozinho +5 Sanidade', pk1.vr === pk0.vr + 25 && pk1.hp === pk0.hp + 5);
    await play('e_ampulheta');
    check(vp, 'pickup Ampulheta: congela toda a linha de frente', await st(() =>
        window.__hcDebug.state.enemies.filter(e => e.row === 0 && e.hp > 0).every(e => e.frost >= 2)));
    await st(() => window.__hcDebug.state.enemies.forEach(e => { e.frost = 0; }));
    hp0 = await totalHp();
    await play('e_sino');
    check(vp, 'pickup Rosário: 30 de dano em cada inimigo da frente', hp0 - await totalHp() === 60);
    check(vp, 'pickups: uso único, saem do baralho da run', !(await snap()).deck.some(id => id.indexOf('e_') === 0));

    // --- Mecânicas únicas: LOOP e Burn persistente ---
    await arena(['anel_trovoes']);
    hp0 = await totalHp();
    await play('anel_trovoes');
    const loopFirst = hp0 - await totalHp();
    await fastTurn();
    check(vp, 'Anel de Trovões: dispara de novo no fim do turno', loopFirst === 12 && hp0 - await totalHp() === 24,
        { loopFirst, total: hp0 - await totalHp() });
    await arena(['orvalho_ardente']);
    await play('orvalho_ardente');
    const dewCol = await st(() => { const s = window.__hcDebug.state; return s.enemies.find(e => e.uid === s.targetUid).col; });
    const dew0 = await snap();
    for (let i = 0; i < 3; i++) await fastTurn();
    const dew1 = await snap();
    check(vp, 'Orvalho Ardente: Burn persistente não cai abaixo de 2',
        dew0.burn[dewCol] === 3 && dew0.floor[dewCol] === 2 && dew1.burn[dewCol] === 2, { before: dew0.burn, after: dew1.burn });

    // --- Gemas avançadas ---
    const baseDmg = await damageWith(null);
    await gem('mordida_ferro', 'eco');
    await arena(['escudo_burocratico', 'mordida_ferro']);
    await play('escudo_burocratico');
    await play('mordida_ferro');
    check(vp, 'gema Eco: repete o efeito da carta anterior do turno', (await snap()).shield === 14, (await snap()).shield);

    await gem('mordida_ferro', 'copia');
    await arena(['mordida_ferro']);
    await play('mordida_ferro');
    const cp1 = await snap();
    await play('mordida_ferro');
    const cp2 = await snap();
    check(vp, 'gema Cópia: cria 1 cópia temporária [Destroy] que não se copia de novo',
        JSON.stringify(cp1.hand) === '["mordida_ferro"]' && cp1.temp[0] === true && cp2.hand.length === 0 &&
        count(cp2.pile, 'mordida_ferro') === 1 && cp2.destroyed.includes('mordida_ferro'), { hand: cp1.hand, after: cp2.hand });

    await gem('chicote_dados', 'ima');
    await arena(['chicote_dados']);
    await st(() => { window.__hcDebug.state.drawPile = ['grito_guerra', 'chicote_dados', 'eco_mare']; });
    await play('chicote_dados');
    const im = await snap();
    check(vp, 'gema Ímã: puxa outra cópia da mesma carta do baralho',
        JSON.stringify(im.hand) === '["chicote_dados"]' && !im.draw.includes('chicote_dados'), im.hand);

    const bombDmg = await damageWith('bombardeio');
    check(vp, 'gema Bombardeio: explosão extra de 60% do dano', bombDmg === baseDmg + 5, { baseDmg, bombDmg });

    await gem('mordida_ferro', 'demi');
    await arena(['mordida_ferro'], { hp: 100 });
    hp0 = await totalHp();
    await play('mordida_ferro');
    check(vp, 'gema Dizimar: 10% da vida atual do 1º alvo', hp0 - await totalHp() === baseDmg + 10, hp0 - await totalHp());

    await gem('mordida_ferro', 'discharge');
    await arena(['tomo_1', 'mordida_ferro']);
    await play('tomo_1');
    hp0 = await totalHp();
    const dischargeMult = await play('mordida_ferro');
    check(vp, 'gema Quebra-Combo: consome o Combo e multiplica o dano', hp0 - await totalHp() === baseDmg * 3 && dischargeMult === 1,
        { dmg: hp0 - await totalHp(), dischargeMult });

    await gem('mordida_ferro', 'switch');
    await arena(['mordida_ferro', 'bomba_mana']);
    await st(() => { window.__hcDebug.state.drawPile = ['grito_guerra']; });
    await play('mordida_ferro');
    const sw = await snap();
    check(vp, 'gema Troca: descarta 1 (lixo primeiro) e compra 1',
        JSON.stringify(sw.hand) === '["grito_guerra"]' && sw.discard.includes('bomba_mana'), sw.hand);

    await gem('mordida_ferro', 'spike');
    await arena(['mordida_ferro']);
    await st(() => { window.__hcDebug.state.shield = 10; });
    hp0 = await totalHp();
    await play('mordida_ferro');
    check(vp, 'gema Ataque de Armadura: soma o Escudo ao 1º acerto', hp0 - await totalHp() === baseDmg + 20, hp0 - await totalHp());

    await gem('grito_guerra', 'yinyang');
    await arena(['grito_guerra']);
    await st(() => { window.__hcDebug.state.mana = 5; });
    await play('grito_guerra');
    const yin = (await snap()).mana;
    await arena(['grito_guerra']);
    await st(() => { window.__hcDebug.state.drawPile = ['eco_mare']; });
    await play('grito_guerra');
    check(vp, 'gema Yin Yang: alterna +1 Cafeína e Comprar 1', yin === 6 && JSON.stringify((await snap()).hand) === '["eco_mare"]', yin);

    await gem('mordida_ferro', 'afterlife');
    await arena(['mordida_ferro']);
    hp0 = await totalHp();
    await fastTurn();
    check(vp, 'gema Pós-Vida: dispara os efeitos ao ser descartada no fim do turno', hp0 - await totalHp() === baseDmg, hp0 - await totalHp());

    // --- Rachadura, Inquebrável e À Prova de Fogo ---
    const forceRoll = v => hc(val => {
        if (val === null) { Math.random = window.__realRandom; return; }
        window.__realRandom = window.__realRandom || Math.random;
        Math.random = () => val;
    }, v);
    await gem('mordida_ferro', null);
    await arena(['mordida_ferro', 'mordida_ferro']);
    await st(() => { const s = window.__hcDebug.state; s.crackedCards = {}; s.cardUses = { mordida_ferro: 5 }; });
    const copies0 = count((await snap()).deck, 'mordida_ferro');
    await play('mordida_ferro');
    const crack = await snap();
    check(vp, 'rachadura: o 6º uso no combate racha a carta (sem estilhaçar)', crack.cracked.includes('mordida_ferro') &&
        count(crack.deck, 'mordida_ferro') === copies0 &&
        await st(() => !!document.querySelector('#hand-grid .card-btn.cracked .kw-crack')));
    await forceRoll(0.01);
    await play('mordida_ferro');
    await forceRoll(null);
    check(vp, 'rachadura: Rachada usada demais estilhaça e sai do baralho', count((await snap()).deck, 'mordida_ferro') === copies0 - 1);
    await gem('chicote_dados', 'uncrackable');
    await arena(['chicote_dados']);
    await st(() => { const s = window.__hcDebug.state; s.crackedCards = {}; s.cardUses = { chicote_dados: 9 }; });
    await play('chicote_dados');
    check(vp, 'gema Inquebrável: a carta nunca racha', !(await snap()).cracked.includes('chicote_dados'));
    await gem('chicote_dados', 'preserve');
    await arena(['chicote_dados']);
    await st(() => { const s = window.__hcDebug.state; s.crackedCards = { chicote_dados: true }; s.cardUses = { chicote_dados: 9 }; });
    const whips0 = count((await snap()).deck, 'chicote_dados');
    await forceRoll(0.01);
    await play('chicote_dados');
    await forceRoll(null);
    check(vp, 'gema À Prova de Fogo: Rachada não estilhaça', count((await snap()).deck, 'chicote_dados') === whips0);

    // --- Mão com tudo junto (captura) ---
    await st(() => {
        const h = window.__hcDebug;
        h.state.cardGems = {};
        h.state.crackedCards = { chicote_dados: true };
        h.socketGem('chicote_dados', 'eco');
        h.grantPickup('e_sino');
    });
    await arena(['explosao_total', 'chicote_dados', 'cancao_mana', 'e_sino', 'anel_trovoes']);
    await st(() => { window.__hcDebug.state.mana = 5; });
    await play('cancao_mana');
    await wait(300);
    await page.screenshot({ path: 'e2e-' + vp + '-arsenal.png' });
    const handUi = await st(() => ({
        x: Array.from(document.querySelectorAll('#hand-grid .card-cost')).some(c => c.textContent === 'X'),
        cracked: !!document.querySelector('#hand-grid .card-btn.cracked'),
        temp: !!document.querySelector('#hand-grid .card-btn.temp'),
        pickup: Array.from(document.querySelectorAll('#hand-grid .kw-temp')).some(p => p.textContent === 'PICKUP')
    }));
    check(vp, 'mão: custo X, Rachada, Temporária e Pickup sinalizados', handUi.x && handUi.cracked && handUi.temp && handUi.pickup, handUi);
    await st(() => {
        const s = window.__hcDebug.state;
        s.cardGems = {};
        s.crackedCards = {};
        s.deck = s.deck.filter(id => id !== 'e_sino');
    });

    // --- Carta de Crawler (retrato com Duration que dispara a passiva do colega) ---
    await arena(['crawler_valter', 'mordida_ferro', 'grito_guerra']);
    await play('crawler_valter');
    const cr0 = await st(() => JSON.parse(JSON.stringify(window.__hcDebug.state.crawler)));
    const portrait = await st(() => !document.getElementById('crawler-portrait').classList.contains('hidden'));
    await play('mordida_ferro');
    const crShield = (await snap()).shield;
    await play('grito_guerra');
    check(vp, 'Crawler: crachá ativo por 3 turnos, retrato visível e Ataque dispara +3 Escudo (Suporte não)',
        cr0 && cr0.charId === 'valter' && cr0.turns === 3 && portrait && crShield === 3 && (await snap()).shield === 3, { cr0, crShield });
    check(vp, 'Crawler: Jogar Tudo não repete o crachá enquanto ativo', await st(() => {
        const h = window.__hcDebug;
        h.state.hand = ['crawler_valter'];
        h.state.handTemp = [false];
        return !h.isUsefulCard('crawler_valter', 0);
    }));
    await fastTurn();
    await fastTurn();
    const crMid = await st(() => window.__hcDebug.state.crawler && window.__hcDebug.state.crawler.turns);
    await fastTurn();
    check(vp, 'Crawler: Duration conta os turnos e o retrato sai de cena', crMid === 1 &&
        await st(() => window.__hcDebug.state.crawler === null && document.getElementById('crawler-portrait').classList.contains('hidden')), { crMid });

    // --- Selo do Eclipse (por último: apaga inimigos do combate de teste) ---
    await st(() => { window.__hcDebug.state.deck.push('selo_eclipse'); });
    await arena(['selo_eclipse']);
    await st(() => { const s = window.__hcDebug.state; s.mana = 0; s.discardDiscount = {}; });
    await fastTurn();
    const seal0 = await snap();
    await arena(['selo_eclipse']);
    const sealLabel = await st(() => document.querySelector('#hand-grid .card-cost').textContent);
    check(vp, 'Selo do Eclipse: Jogar Tudo não apaga XP sozinho', await st(() => !window.__hcDebug.isUsefulCard('selo_eclipse', 0)));
    await play('selo_eclipse');
    const seal1 = await snap();
    const survivors = await st(() => window.__hcDebug.state.enemies.filter(e => e.hp > 0).map(e => e.hp));
    check(vp, 'Selo do Eclipse: custo cai 1 a cada descarte', seal0.discount.selo_eclipse === 1 && sealLabel === '3', { sealLabel });
    check(vp, 'Selo do Eclipse: apaga os comuns da frente e fere quem sobra (Destroy só na luta)',
        seal1.kills === seal0.kills + 2 && JSON.stringify(survivors) === '[9981]' &&
        seal1.destroyed.includes('selo_eclipse') && seal1.deck.includes('selo_eclipse'), { survivors, kills: seal1.kills - seal0.kills });
    await st(() => { window.__hcDebug.state.stats.Luck = 0; });

    // ================= ETAPA 6: PRÉVIA DE MIRA, LETAL!, MÚSICA, FALAS E O TRAPACEIRO =================
    // Formação do encontro 1 da Fase 1: frente nas colunas 1 e 3, retaguarda na coluna 1.
    const prev = (hand, setup) => page.evaluate(([cards, fn]) => {
        const h = window.__hcDebug;
        const s = h.state;
        if (fn) new Function('s', fn)(s);
        h.render();
        return cards.map(id => {
            const p = h.previewFor(s.hand.indexOf(id));
            const byUid = uid => s.enemies.find(e => e.uid === uid);
            return { id, cols: p.cols.slice().sort(), who: p.uids.map(u => byUid(u).col + ':' + byUid(u).row), random: p.random,
                dmg: p.uids.map(u => p.dmg[u]), lethal: p.uids.filter(u => p.lethal[u]).map(u => byUid(u).col + ':' + byUid(u).row) };
        });
    }, [hand, setup || '']);
    await st(() => { window.__hcDebug.state.stats.Luck = -100; window.__hcDebug.state.cardGems = {}; });
    await arena(['golpe_furtivo', 'demissao_silenciosa', 'chicote_dados', 'moeda_destino', 'mordida_ferro']);
    const [pLR, pRL, pFR, pRnd, pPierce] = await prev(['golpe_furtivo', 'demissao_silenciosa', 'chicote_dados', 'moeda_destino', 'mordida_ferro'],
        "s.enemies.forEach(e => { e.hasIntent = e.row === 0; }); s.targetUid = s.enemies.find(e => e.col === 1 && e.row === 0).uid;");
    check(vp, 'mira: LeftRight (Atacantes) visa a coluna mais à esquerda', JSON.stringify(pLR.who) === '["1:0"]' && pLR.dmg[0] === 5, pLR);
    check(vp, 'mira: RightLeft visa a coluna mais à direita', JSON.stringify(pRL.who) === '["3:0"]', pRL);
    check(vp, 'mira: FrontRow atinge toda a linha de frente', JSON.stringify(pFR.cols) === '[1,3]' && pFR.who.length === 2 && pFR.dmg.every(d => d === 8), pFR);
    check(vp, 'mira: Random só lista alvos possíveis (sem dano garantido nem LETAL!)', pRnd.random && pRnd.who.length === 2 &&
        pRnd.dmg.every(d => d === 0) && pRnd.lethal.length === 0, pRnd);
    check(vp, 'mira: Pierce inclui o inimigo atrás na mesma coluna', JSON.stringify(pPierce.who.slice().sort()) === '["1:0","1:1"]', pPierce);
    const [pPrio] = await prev(['golpe_furtivo'], "s.enemies.forEach(e => { e.hasIntent = e.row === 0 && e.col === 3; });");
    check(vp, 'mira: Priority Attacking pula quem não ataca', JSON.stringify(pPrio.who) === '["3:0"]', pPrio);
    const [pLethal, pShield] = await prev(['chicote_dados', 'golpe_furtivo'],
        "s.enemies.forEach(e => { e.hasIntent = e.row === 0; }); const c1 = s.enemies.find(e => e.col === 1 && e.row === 0); c1.hp = 8; " +
        "const c3 = s.enemies.find(e => e.col === 3); c3.hp = 9; c3.shield = 2;");
    check(vp, 'LETAL!: dano garantido >= HP marca o inimigo; escudo entra na conta', JSON.stringify(pLethal.lethal) === '["1:0"]' &&
        pLethal.dmg.includes(6), pLethal);
    // Hover real: o renderer desenha as colunas no chão e o selo LETAL!
    await page.hover('#hand-grid .card-btn:nth-child(3)');
    await wait(250);
    const drawn = await st(() => window.GameRenderer.getPreviewDraw());
    check(vp, 'mira: ao passar o mouse, colunas no chão + dano previsto + LETAL! desenhados', drawn && JSON.stringify(drawn.cols) === '[1,3]' &&
        drawn.lethal.length === 1 && Object.values(drawn.dmg).length === 2, drawn);
    await page.screenshot({ path: 'e2e-' + vp + '-mira-letal.png' });
    await page.mouse.move(5, 5);
    await wait(150);
    check(vp, 'mira: tirar o mouse limpa a prévia', await st(() => window.GameRenderer.getPreviewDraw() === null));
    // Celular: toque segurado mostra a prévia sem jogar; toque curto joga.
    const touch = await st(async () => {
        const h = window.__hcDebug;
        const btn = document.querySelectorAll('#hand-grid .card-btn')[2];
        const handBefore = h.state.hand.length;
        btn.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
        await new Promise(r => setTimeout(r, 450));
        btn.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true }));
        btn.click();
        await new Promise(r => setTimeout(r, 120));
        return { kept: h.state.hand.length === handBefore, preview: !!window.GameRenderer.getPreviewDraw() };
    });
    check(vp, 'mira (toque): segurar mostra a prévia e não joga a carta', touch.kept && touch.preview, touch);
    await st(() => { window.__hcDebug.state.stats.Luck = 0; });

    // --- Música dinâmica: combate x chefe; respeita o Mudo ---
    const music = () => st(() => window.GameAudio.getMusic());
    const mCombat = await music();
    await st(() => window.__hcDebug.startEncounter(null, window.GameData.getFloorConfig(1).encounters['B']));
    const mBoss = await music();
    await page.click('#btn-mute');
    const mMuted = await music();
    await page.click('#btn-mute');
    const mBack = await music();
    check(vp, 'música: batida de combate, tema de chefe, e o Mudo para tudo (e volta)', mCombat.wanted === 'combat' && mCombat.playing === 'combat' &&
        mBoss.playing === 'boss' && mMuted.playing === null && mMuted.wanted === 'boss' && mBack.playing === 'boss', { mCombat, mBoss, mMuted, mBack });

    // --- Fala do chefe na virada de fase (66%) ---
    await arena(['julgamento_final'], { keepHp: true });
    await st(() => {
        const boss = window.__hcDebug.state.enemies.find(e => e.isBoss);
        boss.hp = Math.round(boss.maxHp * 0.67);
        boss.phase = 1;
        boss.shield = 0;
    });
    await play('julgamento_final');
    await wait(200);
    const bubble = await st(() => {
        const b = document.querySelector('.boss-bubble');
        return b ? { text: b.textContent, boss: b.dataset.boss, phase: window.__hcDebug.state.enemies.find(e => e.isBoss).phase,
            expected: window.GameData.ENEMIES.kraken.phases[2].quote } : null;
    });
    check(vp, 'chefe: balão de 1 linha na virada para a fase 2', bubble && bubble.boss === 'kraken' && bubble.phase === 2 &&
        bubble.text === bubble.expected, bubble);

    // --- Segredo: 3 cartas estilhaçadas atraem o Trapaceiro; derrotá-lo dá Gema Lendária + 50 VR ---
    const tr0 = await st(() => {
        const h = window.__hcDebug;
        const s = h.state;
        s.shatters = 2;
        s.tricksterSeen = false;
        h.noteShatter();
        return { pending: s.tricksterPending, sprite: window.GameSprites.hasSheet('trickster') };
    });
    await st(() => window.__hcDebug.startEncounter(null, window.GameData.getFloorConfig(1).encounters['1']));
    const trick = await st(() => {
        const s = window.__hcDebug.state;
        const t = s.enemies.find(e => e.kind === 'trickster');
        return t ? { name: t.name, row: t.row, col: t.col, pending: s.tricksterPending } : null;
    });
    check(vp, 'Trapaceiro: a 3ª carta estilhaçada dispara a invasão no encontro seguinte (sprite 32x32 próprio)',
        tr0.pending && tr0.sprite && trick && trick.name === 'O Trapaceiro do Subconsciente' && trick.row === 0 && !trick.pending, { tr0, trick });
    await page.screenshot({ path: 'e2e-' + vp + '-trapaceiro.png' });
    const vrT = await st(() => window.__hcDebug.state.vr);
    await arena(['chicote_dados'], { keepHp: true });
    await st(() => window.__hcDebug.state.enemies.forEach(e => { if (e.kind === 'trickster') e.hp = 1; else { e.hp = 9999; e.maxHp = 9999; } }));
    await play('chicote_dados');
    const trDone = await page.evaluate(v => ({ defeated: window.__hcDebug.state.tricksterDefeated, vr: window.__hcDebug.state.vr - v }), vrT);
    await st(() => { const h = window.__hcDebug; h.state.enemies.forEach(e => { e.hp = 0; }); h.state.hand = []; h.endTurn(); });
    await page.waitForFunction(() => window.__hcDebug.activeModal && window.__hcDebug.activeModal.type === 'gem', null, { timeout: 20000 }).catch(() => {});
    const trGem = await st(() => { const m = window.__hcDebug.activeModal; return m && m.type === 'gem' ? window.GameData.GEMS[m.gemId].rarity : null; });
    check(vp, 'Trapaceiro: derrotado dá +50 VR e Gema Lendária', trDone.defeated && trDone.vr >= 50 && trGem === 'lendaria', { trDone, trGem });
    await drainModals('pós-trapaceiro');

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

    // ================= ETAPA 4: FOGUEIRA, FUSÃO E EVENTOS DE MAPA (exploração) =================
    const clickIn = (sel, nth) => hc(([q, n]) => {
        const list = Array.from(document.querySelectorAll(q));
        const b = list[n < 0 ? list.length + n : n];
        if (b) b.click();
        return !!b;
    }, [sel, nth || 0]);
    const modalKind = id => st(() => {
        const m = window.__hcDebug.activeModal;
        const gemId = m && m.type === 'gem' ? m.gemId : null;
        return { type: m && m.type, kind: m && m.kind, rarity: gemId ? window.GameData.GEMS[gemId].rarity : null };
    });
    // Fecha a recompensa (gema ou arcana) que estiver aberta.
    const takeReward = async () => {
        const open = await openModals();
        if (open[0] === 'arcana-modal') await clickIn('#arcana-modal .arcana-choice');
        else if (open[0] === 'gem-modal') await clickIn('#gem-modal .gem-target-card:not([disabled]), #btn-gem-discard');
        await wait(400);
    };

    // --- Fogueira: reparar rachaduras ---
    await st(() => { const h = window.__hcDebug; h.state.crackedCards = { chicote_dados: true }; h.state.vr = 200; h.openRest(); });
    await wait(400);
    await hc(() => Array.from(document.querySelectorAll('#rest-items-grid .shop-item-card'))
        .find(b => b.querySelector('.shop-item-title').textContent.indexOf('Reparar') === 0).click());
    await wait(300);
    check(vp, 'fogueira: Reparar Rachaduras conserta por VR', await st(() => {
        const s = window.__hcDebug.state;
        return Object.keys(s.crackedCards).length === 0 && s.vr === 200 - window.GameData.BALANCE.rest.repairPrice;
    }));
    await page.click('#btn-rest-close');
    await wait(300);

    // --- Fusão dupla (2 cartas no Nível MÁX) ---
    await st(() => {
        const h = window.__hcDebug;
        const s = h.state;
        ['mordida_ferro', 'pocao_fogo'].forEach(id => { s.cardLevels[id] = 2; if (!s.deck.includes(id)) s.deck.push(id); });
        s.relics = [];
        h.gainXp(s.xpNext);
    });
    await wait(500);
    const fusionOffered = await st(() => {
        const b = document.querySelector('#levelup-modal .reward-card.evo-choice');
        return !!b && b.querySelector('.reward-kind').textContent === 'FUSÃO PRONTA';
    });
    const beforeFusion = await snap();
    await clickIn('#levelup-modal .reward-card.evo-choice');
    await wait(500);
    await drainModals('pós-fusão');
    const afterFusion = await snap();
    check(vp, 'fusão: 2 cartas MÁX viram a carta suprema', fusionOffered && afterFusion.deck.includes('gladio_aurora') &&
        count(afterFusion.deck, 'mordida_ferro') === count(beforeFusion.deck, 'mordida_ferro') - 1 &&
        count(afterFusion.deck, 'pocao_fogo') === count(beforeFusion.deck, 'pocao_fogo') - 1, { fusionOffered });

    // --- Poço dos Desejos ---
    await st(() => window.__hcDebug.openSpecial('W'));
    await wait(450);
    const well = await modalKind();
    check(vp, 'Poço dos Desejos: sorteia gema rara (ou melhor) ou Arcana', (await openModals()).length === 1 &&
        (well.type === 'arcana' || (well.type === 'gem' && ['rara', 'epica', 'lendaria'].includes(well.rarity))), well);
    await takeReward();

    // --- Baú de Prata ---
    await st(() => { const h = window.__hcDebug; h.state.silverReq.debug_P = ['atk', 'def']; h.openSpecial('P'); });
    await wait(450);
    const silverOpen = await only('event-modal') && await st(() => document.getElementById('event-modal').dataset.kind === 'bau_prata');
    await page.screenshot({ path: 'e2e-' + vp + '-bau-prata.png' });
    const deckBeforeSilver = (await snap()).deck.length;
    await clickIn('#event-choices .event-choice-btn');
    await wait(450);
    const typesOf = () => st(() => Array.from(document.querySelectorAll('#gem-modal .gem-target-card'))
        .map(b => window.GameData.CARDS[b.dataset.card].type));
    const step1 = { kind: (await modalKind()).kind, types: await typesOf() };
    await page.screenshot({ path: 'e2e-' + vp + '-oferenda.png' });
    await clickIn('#gem-modal .gem-target-card');
    await wait(450);
    const step2 = { kind: (await modalKind()).kind, types: await typesOf() };
    const midDeck = (await snap()).deck.length;
    await clickIn('#gem-modal .gem-target-card');
    await wait(450);
    const silverReward = await modalKind();
    check(vp, 'Baú de Prata: pede 1 carta de cada tipo e só consome ao final', silverOpen && step1.kind === 'sacrifice' &&
        step1.types.length > 0 && step1.types.every(t => t === 'atk') && step2.types.length > 0 && step2.types.every(t => t === 'def') &&
        midDeck === deckBeforeSilver && (await snap()).deck.length === deckBeforeSilver - 2, { step1, step2 });
    check(vp, 'Baú de Prata: dá Gema Épica/Lendária ou Arcana extra', (await openModals()).length === 1 &&
        (silverReward.type === 'arcana' || (silverReward.type === 'gem' && ['epica', 'lendaria'].includes(silverReward.rarity))), silverReward);
    await takeReward();

    // --- Mesa de Oferenda ---
    await st(() => window.__hcDebug.openSpecial('O'));
    await wait(450);
    const deckBeforeAltar = (await snap()).deck.length;
    await clickIn('#event-choices .event-choice-btn', 0);
    await wait(450);
    await clickIn('#gem-modal .gem-target-card');
    await wait(450);
    const slotStep = await modalKind();
    const slotTarget = await st(() => document.querySelector('#gem-modal .gem-target-card').dataset.card);
    await clickIn('#gem-modal .gem-target-card');
    await wait(450);
    check(vp, 'Mesa de Oferenda: sacrifica 1 carta e outra ganha +1 Slot de Gema', slotStep.kind === 'slot' &&
        (await snap()).deck.length === deckBeforeAltar - 1 &&
        await hc(id => window.__hcDebug.state.extraGemSlots[id] === 1, slotTarget) && (await openModals()).length === 0, { slotTarget });
    await st(() => window.__hcDebug.openSpecial('O', 'debug_O2'));
    await wait(450);
    const vrBeforeAltar = (await snap()).vr;
    await clickIn('#event-choices .event-choice-btn', 1);
    await wait(450);
    await clickIn('#gem-modal .gem-target-card');
    await wait(450);
    check(vp, 'Mesa de Oferenda: troca 1 carta por VR', (await snap()).vr === vrBeforeAltar + 20 &&
        (await snap()).deck.length === deckBeforeAltar - 2);
    // Baralho no tamanho mínimo: as oferendas ficam desabilitadas.
    await st(() => { const s = window.__hcDebug.state; s.deck = s.deck.slice(0, window.GameData.BALANCE.minDeckSize); window.__hcDebug.openSpecial('O', 'debug_O3'); });
    await wait(450);
    check(vp, 'Mesa de Oferenda: baralho mínimo bloqueia o sacrifício', await st(() => {
        const btns = Array.from(document.querySelectorAll('#event-choices .event-choice-btn'));
        return btns.length === 3 && btns[0].disabled && btns[1].disabled && !btns[2].disabled;
    }));
    await clickIn('#event-choices .event-choice-btn', -1);
    await wait(450);
    await st(() => {
        const h = window.__hcDebug;
        h.state.deck = window.GameData.STARTING_DECK.slice();
        h.openSpecial('O', 'debug_O4');
    });
    await wait(450);
    await clickIn('#event-choices .event-choice-btn', 0);
    await wait(450);
    await page.click('#btn-gem-discard');
    await wait(450);
    check(vp, 'Mesa de Oferenda: desistir não consome nada e a fila esvazia', (await snap()).deck.length === 10 &&
        (await openModals()).length === 0 && await st(() => window.__hcDebug.state.mode === 'explore'));

    // --- Arcana extra soma às da run ---
    check(vp, 'arcana extra: soma em vez de trocar', await st(() => {
        const h = window.__hcDebug;
        const before = h.state.arcanas.length;
        const free = Object.keys(window.GameData.ARCANAS).find(id => !h.state.arcanas.includes(id));
        return !free || (h.addArcana(free) && h.state.arcanas.length === before + 1 && !h.addArcana(free));
    }));

    // --- Pickup fica à mão desde o Turno 1, além das cartas compradas ---
    await st(() => window.__hcDebug.grantPickup('e_ampulheta'));
    await st(() => window.__hcDebug.startEncounter(null, window.GameData.getFloorConfig(1).encounters['B']));
    check(vp, 'pickup: vem à mão no início do combate sem ocupar a compra', await st(() => {
        const s = window.__hcDebug.state;
        return s.hand.includes('e_ampulheta') && s.hand.length === 5 && !s.drawPile.includes('e_ampulheta');
    }));
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

    // ================= META-PROGRESSÃO: RECEPÇÃO, LOCALSTORAGE, COLEGAS E HORA EXTRA =================
    // Página nova = contexto novo = localStorage vazio. Recarregar a página prova a persistência.
    const mp = await browser.newPage({ viewport: size });
    const merr = [];
    mp.on('console', m => { if (m.type() === 'error') merr.push(m.text()); });
    mp.on('pageerror', e => merr.push('PAGEERROR ' + e.message));
    // Testes fora do onboarding: a cutscene de 1ª visita já conta como vista.
    await mp.addInitScript(ui => localStorage.setItem('hc_ui_v1', ui), UI_SEEN);
    await mp.goto(srv.url);
    await mp.waitForTimeout(400);
    const mq = (fn, arg) => mp.evaluate(fn, arg);
    const metaNow = () => mq(() => JSON.parse(JSON.stringify(window.__hcDebug.meta)));
    const stored = () => mq(() => JSON.parse(localStorage.getItem('hc_meta_v1') || 'null'));
    const mOpen = () => mq(() => Array.from(document.querySelectorAll('.modal-overlay')).filter(m => !m.classList.contains('hidden')).map(m => m.id));
    const fits = () => mq(() => {
        const d = document.documentElement;
        const box = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden) .modal-box')).pop();
        return d.scrollHeight <= innerHeight && d.scrollWidth <= innerWidth && (!box || box.scrollHeight <= box.clientHeight + 1);
    });
    const tile = name => mq(n => {
        const b = Array.from(document.querySelectorAll('#reception-grid .rc-tile')).find(t => t.querySelector('.rc-name').textContent === n);
        if (b && !b.disabled) b.click();
        return !!b && !b.disabled;
    }, name);
    const beginRun = async () => {
        await startDay(mp);
        await mp.waitForTimeout(300);
        await mp.click('#btn-narrative-continue');
        await mp.waitForTimeout(400);
        await mp.locator('#arcana-modal .arcana-choice').first().click();
        await mp.waitForTimeout(500);
    };
    const backToTitle = async () => {
        await mp.click('#btn-play-again');
        await mp.waitForTimeout(400);
    };
    const drainMp = async () => {
        for (let i = 0; i < 30 && (await mOpen()).length > 0; i++) {
            await mq(sel => { const b = document.querySelector(sel); if (b) b.click(); }, CLOSE_ANY);
            await mp.waitForTimeout(350);
        }
    };

    const m0 = await metaNow();
    check(vp, 'meta: começa sem créditos, só com Valter e sem Hora Extra', m0.credits === 0 &&
        JSON.stringify(m0.unlockedChars) === '["valter"]' && !m0.infiniteUnlocked &&
        await mq(() => document.getElementById('btn-infinite-toggle').classList.contains('hidden')));
    check(vp, 'Recepção: tela inicial sem overflow', await fits());
    await mp.screenshot({ path: 'e2e-' + vp + '-recepcao.png' });

    // Fim de run: TODO o VR ganho (inclusive o gasto na fogueira) vira Fundo de Reserva no localStorage.
    await beginRun();
    await mq(() => { const s = window.__hcDebug.state; s.vr = 300; s.vrSpent = 200; window.__hcDebug.endGame(false); });
    await mp.waitForTimeout(300);
    const afterLoss = await stored();
    check(vp, 'meta: derrota converte 500 VR ganhos em 500 CR salvos', afterLoss && afterLoss.credits === 500 && afterLoss.stats.runs === 1 &&
        await mq(() => document.getElementById('end-meta').textContent.indexOf('+500 CR') === 0), afterLoss && afterLoss.credits);
    await backToTitle();
    check(vp, 'meta: tela inicial mostra o Fundo de Reserva', await mq(() => document.getElementById('meta-credits').textContent === '500'));

    // Almoxarifado: compra, persiste após recarregar e reembolsa grátis.
    await mp.click('#btn-open-almox');
    await mp.waitForTimeout(300);
    check(vp, 'Almoxarifado: 15 PowerUps sem overflow', await mq(() => document.querySelectorAll('#reception-grid .rc-tile').length === 15) && await fits());
    const mightCost = await mq(() => window.GameMeta.nextPowerupCost(window.__hcDebug.meta, 'Might'));
    await tile('Might');
    await mp.waitForTimeout(200);
    await mp.reload();
    await mp.waitForTimeout(500);
    const reloaded = await metaNow();
    check(vp, 'Almoxarifado: rank comprado sobrevive ao recarregar a página', reloaded.powerups.Might === 1 &&
        reloaded.credits === 500 - mightCost && await mq(() => window.__hcDebug.state.stats.Might === 10), { mightCost, credits: reloaded.credits });
    await mp.click('#btn-open-almox');
    await mp.waitForTimeout(300);
    await mp.click('#btn-reception-reset');
    await mp.waitForTimeout(200);
    check(vp, 'Almoxarifado: reembolso devolve tudo', (await stored()).credits === 500 && !(await stored()).powerups.Might);
    await mp.click('#btn-reception-close');

    // Vitória: libera a Hora Extra Infinita e o próximo colega (Vivi).
    await beginRun();
    await mq(() => { window.__hcDebug.state.vr = 100; window.__hcDebug.endGame(true); });
    await mp.waitForTimeout(300);
    const afterWin = await stored();
    check(vp, 'meta: vitória libera Hora Extra Infinita e a Vivi', afterWin.infiniteUnlocked && afterWin.unlockedChars.includes('vivi') &&
        afterWin.credits === 600 + await mq(g => Object.keys(g).reduce((n, id) => n + window.GameMeta.GOAL_BY_ID[id].reward, 0), afterWin.goals) &&
        afterWin.goals.primeiro_ponto === true && await mq(() => /HORA EXTRA INFINITA/.test(document.getElementById('end-meta').textContent)));
    await backToTitle();

    // Contratar o Seu Jorge com créditos e escolher o crachá.
    await mq(() => {
        const h = window.__hcDebug;
        h.meta.credits = 2000;
        window.GameMeta.save(localStorage, h.meta);
        h.reloadMeta();
    });
    await mp.click('.crew-card[data-char="jorge"]');
    await mp.waitForTimeout(200);
    await mp.click('#btn-hire-char');
    await mp.waitForTimeout(200);
    const hired = await stored();
    check(vp, 'colegas: contratar o Jorge cobra 600 CR, seleciona e salva', hired.unlockedChars.includes('jorge') &&
        hired.selectedChar === 'jorge' && hired.credits === 1400 &&
        await mq(() => document.querySelector('.crew-card[data-char="jorge"]').classList.contains('selected')));

    // Grafia: slot permanente na Lâmina; Curadoria: sela o Dano Duplo.
    await mp.click('#btn-open-forge');
    await mp.waitForTimeout(300);
    check(vp, 'Grafia: sem overflow', await fits());
    await tile('Lâmina do Devaneio');
    await mp.click('#btn-reception-close');
    await mp.click('#btn-open-curation');
    await mp.waitForTimeout(300);
    check(vp, 'Curadoria: 25 gemas sem overflow', await mq(() => document.querySelectorAll('#reception-grid .rc-tile').length === 25) && await fits());
    await tile('Dano Duplo');
    await tile('Dano Duplo');
    await mp.waitForTimeout(200);
    await mp.screenshot({ path: 'e2e-' + vp + '-curadoria.png' });
    await mp.click('#btn-reception-close');
    const curated = await stored();
    check(vp, 'Grafia e Curadoria: salvas no localStorage', curated.forge.mordida_ferro === 1 && curated.sealedGems.includes('double') &&
        curated.credits === 1400 - 150);

    // Run com o Jorge: baralho, passiva, crachá, slot da Grafia e gema selada fora do sorteio.
    await beginRun();
    const run = await mq(() => {
        const h = window.__hcDebug;
        const s = h.state;
        const rolls = Array.from({ length: 300 }, () => h.randomGemId());
        return { hero: s.heroId, crawler: s.deck.includes('crawler_jorge'), tomo: s.deck.includes('tomo_1'), maxHp: s.maxHp,
            kb: s.kbBonus, slot: s.extraGemSlots.mordida_ferro, doubled: rolls.filter(g => g === 'double').length,
            hud: document.getElementById('stat-hero').textContent };
    });
    check(vp, 'run: Jorge com baralho de Tomos, crachá, +15% Desarme e Sanidade 58', run.hero === 'jorge' && run.crawler && run.tomo &&
        run.maxHp === 58 && run.kb === 0.15 && run.hud === 'MESTRE JORGE', run);
    check(vp, 'run: slot da Grafia ativo e gema selada nunca sorteada', run.slot === 1 && run.doubled === 0, run);
    await mq(() => window.__hcDebug.endGame(false));
    await mp.waitForTimeout(300);
    await backToTitle();

    // Hora Extra Infinita: ondas contínuas, escalamento por onda e por turno, recorde salvo.
    await mp.click('#btn-infinite-toggle');
    await mp.waitForTimeout(200);
    check(vp, 'Hora Extra: alternador liga e salva', (await stored()).infiniteMode === true &&
        await mq(() => document.getElementById('btn-start-daydream').textContent === 'BATER PONTO DA HORA EXTRA'));
    await beginRun();
    await mp.waitForFunction(() => window.__hcDebug.state.mode === 'combat', null, { timeout: 20000 });
    const w1 = await mq(() => {
        const s = window.__hcDebug.state;
        return { wave: s.infinite.wave, floor: s.floor, enc: s.encounters.length, hud: document.getElementById('stat-floor').textContent,
            n: s.enemies.length, clock: document.getElementById('clock-time').textContent };
    });
    check(vp, 'Hora Extra: a onda 1 começa sozinha no Abismo, sem chefe no mapa', w1.wave === 1 && w1.floor === 5 && w1.enc === 0 &&
        w1.hud === 'ONDA 1' && w1.n > 0 && w1.clock === '18:00+', w1);
    await mp.waitForTimeout(500);
    await mp.screenshot({ path: 'e2e-' + vp + '-hora-extra.png' });
    await mq(() => { const h = window.__hcDebug; h.state.enemies.forEach(e => { e.hp = 0; }); h.state.hand = []; h.endTurn(); });
    await mp.waitForFunction(() => window.__hcDebug.state.mode !== 'combat', null, { timeout: 20000 });
    for (let i = 0; i < 40; i++) {
        await drainMp();
        if (await mq(() => window.__hcDebug.state.mode === 'combat')) break;
        await mp.waitForTimeout(250);
    }
    const w2 = await mq(() => {
        const s = window.__hcDebug.state;
        const D = window.GameData;
        return { wave: s.infinite.wave, mode: s.mode, scaled: s.enemies.every(e => e.maxHp > D.ENEMIES[e.kind].hp) };
    });
    check(vp, 'Hora Extra: a onda 2 vem sozinha e mais forte', w2.wave === 2 && w2.mode === 'combat' && w2.scaled, w2);
    const g0 = await mq(() => ({ curse: window.__hcDebug.state.curse, hp: window.__hcDebug.state.enemies.map(e => e.maxHp) }));
    await mq(() => { const h = window.__hcDebug; h.state.enemies.forEach(e => { e.intent = null; e.hasIntent = false; }); h.state.hand = []; h.endTurn(); });
    await mp.waitForFunction(() => !window.__hcDebug.state.busy, null, { timeout: 20000 });
    const g1 = await mq(() => ({ curse: window.__hcDebug.state.curse, hp: window.__hcDebug.state.enemies.map(e => e.maxHp) }));
    check(vp, 'Hora Extra: a cada turno a Curse sobe e os inimigos crescem',
        g1.curse === g0.curse + 3 && g1.hp.every((v, i) => v > g0.hp[i]), { g0, g1 });
    await mq(() => {
        const h = window.__hcDebug;
        const s = h.state;
        s.hp = 1; s.shield = 0; s.revival = 0; s.hand = [];
        s.enemies.forEach(e => { e.atk = 99; e.frost = 0; e.disarmed = false; e.stunned = false; });
        h.endTurn();
    });
    await mp.waitForFunction(() => !document.getElementById('end-modal').classList.contains('hidden'), null, { timeout: 30000 });
    const endInf = await mq(() => document.getElementById('end-title').textContent);
    check(vp, 'Hora Extra: derrota encerra e salva o recorde de ondas', endInf === 'HORA EXTRA ENCERRADA' &&
        (await stored()).stats.bestWave === 1, { endInf, best: (await stored()).stats.bestWave });

    // Armazenamento corrompido: volta ao padrão sem erro.
    await mq(() => localStorage.setItem('hc_meta_v1', '{quebrado'));
    await mp.reload();
    await mp.waitForTimeout(500);
    check(vp, 'meta: localStorage corrompido volta ao padrão sem erro', (await metaNow()).credits === 0);
    check(vp, 'meta: console sem erros', merr.length === 0, merr.slice(0, 4));
    await mp.close();

    // ================= ETAPA 6: NÍVEIS DE PRESSÃO E FINAL SECRETO =================
    const pp = await browser.newPage({ viewport: size });
    const perr = [];
    pp.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') perr.push(m.type() + ': ' + m.text()); });
    pp.on('pageerror', e => perr.push('PAGEERROR ' + e.message));
    await pp.addInitScript(ui => localStorage.setItem('hc_ui_v1', ui), UI_SEEN);
    await pp.goto(srv.url);
    await pp.waitForTimeout(400);
    const pq = (fn, arg) => pp.evaluate(fn, arg);
    const pStored = () => pq(() => JSON.parse(localStorage.getItem('hc_meta_v1') || 'null'));
    const pFits = () => pq(() => {
        const d = document.documentElement;
        const box = document.querySelector('#title-modal .modal-box');
        const start = document.getElementById('btn-start-daydream').getBoundingClientRect();
        return d.scrollHeight <= innerHeight && d.scrollWidth <= innerWidth && box.scrollHeight <= box.clientHeight + 1 && start.bottom <= innerHeight;
    });
    const pRun = async () => {
        await startDay(pp);
        await pp.waitForTimeout(300);
        await pp.click('#btn-narrative-continue');
        await pp.waitForTimeout(400);
        await pp.locator('#arcana-modal .arcana-choice').first().click();
        await pp.waitForTimeout(400);
    };
    check(vp, 'Pressão: seletor escondido antes da 1ª vitória', await pq(() => document.getElementById('pressure-row').classList.contains('hidden')));
    await pRun();
    await pq(() => window.__hcDebug.endGame(true));
    await pp.waitForTimeout(300);
    check(vp, 'Pressão: a 1ª vitória libera o Nível 1', (await pStored()).pressureUnlocked === 1);
    await pp.click('#btn-play-again');
    await pp.waitForTimeout(400);
    const pressRow = await pq(() => Array.from(document.querySelectorAll('#pressure-buttons .pressure-btn')).map(b => b.disabled ? 'x' : b.classList.contains('active') ? 'A' : 'o').join(''));
    check(vp, 'Pressão: Recepção mostra 0..5 (só 0 e 1 liberados) sem overflow', pressRow === 'Aoxxxx' && await pFits(), pressRow);
    await pp.click('.pressure-btn[data-level="1"]');
    await pp.waitForTimeout(200);
    check(vp, 'Pressão: escolher o Nível 1 salva no localStorage', (await pStored()).pressure === 1 &&
        await pq(() => /Segunda-feira Braba/.test(document.getElementById('pressure-desc').textContent)));
    await pRun();
    const press1 = await pq(() => {
        const h = window.__hcDebug;
        h.startEncounter(null, window.GameData.getFloorConfig(1).encounters['1']);
        const crab = h.state.enemies.find(e => e.kind === 'crab');
        // Etapa 9: a base já vem com a escala da Parte 1/3 (Entrada); a Pressão soma +15% por cima.
        const D = window.GameData;
        return { hp: crab.maxHp, base: Math.round(D.ENEMIES.crab.hp * D.BALANCE.partScale[h.state.part].hp), junk: h.state.deck.includes('folha_presa'), pressure: h.state.pressure };
    });
    check(vp, 'Pressão 1: inimigos +15% de HP, sem carta-lixo', press1.pressure === 1 && press1.hp === Math.round(press1.base * 1.15) && !press1.junk, press1);
    const credits0 = (await pStored()).credits;
    await pq(() => { const s = window.__hcDebug.state; s.vr = 100; s.vrSpent = 0; s.startVr = 0; window.__hcDebug.endGame(false); });
    await pp.waitForTimeout(300);
    check(vp, 'Pressão 1: crédito persistente +20% (100 VR -> 120 CR)', (await pStored()).credits === credits0 + 120 &&
        await pq(() => /Pressão 1: \+20% de crédito/.test(document.getElementById('end-meta').textContent)));
    await pp.click('#btn-play-again');
    await pp.waitForTimeout(300);
    await pq(() => {
        const h = window.__hcDebug;
        h.meta.pressureUnlocked = 5;
        h.meta.pressure = 5;
        window.GameMeta.save(localStorage, h.meta);
        h.reloadMeta();
    });
    check(vp, 'Pressão 5: seletor completo cabe na tela', await pFits());
    await pp.screenshot({ path: 'e2e-' + vp + '-pressao.png' });
    await pRun();
    const press5 = await pq(() => {
        const h = window.__hcDebug;
        const D = window.GameData;
        h.startEncounter(null, D.getFloorConfig(1).encounters['B']);
        const boss = h.state.enemies.find(e => e.isBoss);
        return { junk: h.state.deck.filter(id => id === 'folha_presa').length, atk: boss.atk, baseAtk: D.ENEMIES.kraken.atk,
            shield: boss.shield, baseShield: D.ENEMIES.kraken.enemyShield || 0, hp: boss.maxHp, baseHp: D.ENEMIES.kraken.hp };
    });
    check(vp, 'Pressão 5: carta-lixo no baralho; chefe com +15% HP e ATK e +4 de Escudo', press5.junk === 1 &&
        press5.atk === Math.round(press5.baseAtk * 1.15) && press5.shield === press5.baseShield + 4 && press5.hp === Math.round(press5.baseHp * 1.15), press5);
    await pq(() => {
        const h = window.__hcDebug;
        h.state.enemies.forEach(e => { e.hp = 0; });
        h.state.hand = [];
        h.endTurn();
    });
    await pp.waitForFunction(() => window.__hcDebug.state.mode !== 'combat', null, { timeout: 20000 });
    for (let i = 0; i < 20 && await pq(() => !!window.__hcDebug.activeModal); i++) {
        await pq(() => { const b = document.querySelector('#levelup-modal:not(.hidden) .reward-card, #gem-modal:not(.hidden) #btn-gem-discard, #narrative-modal:not(.hidden) #btn-narrative-continue'); if (b) b.click(); });
        await pp.waitForTimeout(350);
    }
    await pq(() => { window.__hcDebug.state.vr = 500; window.__hcDebug.state.hp = 10; window.__hcDebug.openRest(); });
    await pp.waitForTimeout(400);
    const restP = await pq(() => {
        const card = Array.from(document.querySelectorAll('#rest-items-grid .shop-item-card')).find(b => b.querySelector('.shop-item-title').textContent === 'Descansar');
        return { price: card.querySelector('.shop-item-price').textContent, desc: card.querySelector('.shop-item-desc').textContent };
    });
    check(vp, 'Pressão 4+: fogueira 25% mais cara e cura 25% menor', restP.price === Math.ceil(30 * 1.25) + ' VR' && /\+15 de Sanidade/.test(restP.desc), restP);
    await pp.click('#btn-rest-close');
    await pp.waitForTimeout(300);

    // Final secreto: vencer o Senhor das Horas carregando a Foto no Parque.
    await pq(() => {
        const s = window.__hcDebug.state;
        s.specialRelics.push('foto_parque');
        s.vr = 100; s.vrSpent = 0; s.startVr = 0;
        window.__hcDebug.endGame(true);
    });
    await pp.waitForTimeout(400);
    const secretP = await pq(() => ({
        title: document.getElementById('end-title').textContent,
        text: document.getElementById('end-desc').textContent,
        meta: document.getElementById('end-meta').textContent,
        saved: JSON.parse(localStorage.getItem('hc_meta_v1')).achievements
    }));
    check(vp, 'Final Secreto: "18:00 — A DECISÃO" com o pedido de férias, registrado no save', secretP.title === '18:00 — A DECISÃO' &&
        secretP.text.includes('O mundo lá fora ainda está esperando.') && /férias/.test(secretP.text) && secretP.saved.secretEnding === true &&
        /FINAL SECRETO/.test(secretP.meta) && /Pressão 5: \+100% de crédito/.test(secretP.meta), secretP);
    await pp.screenshot({ path: 'e2e-' + vp + '-final-secreto.png' });
    check(vp, 'Pressão/segredos: 0 overflow e 0 erros', await pq(() => document.documentElement.scrollHeight <= innerHeight) && perr.length === 0, perr.slice(0, 4));
    await pp.close();

    // ================= ONBOARDING: CUTSCENE, TUTORIAL GUIADO, MANUAL "?" E DICAS =================
    // Página nova sem nenhuma flag: é a 1ª visita de verdade.
    const op = await browser.newPage({ viewport: size });
    const oerr = [];
    op.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') oerr.push(m.type() + ': ' + m.text()); });
    op.on('pageerror', e => oerr.push('PAGEERROR ' + e.message));
    await op.goto(srv.url);
    await op.waitForTimeout(500);
    const oq = (fn, arg) => op.evaluate(fn, arg);
    const ow = ms => op.waitForTimeout(ms);
    const noOverflow = () => oq(() => {
        const d = document.documentElement;
        return d.scrollHeight <= innerHeight && d.scrollWidth <= innerWidth;
    });
    const introNow = () => oq(() => window.__hcDebug.intro);
    const stage = () => oq(() => document.getElementById('tutorial-coach').dataset.stage);
    const spotIds = () => oq(() => Array.from(document.querySelectorAll('.tut-spot')).map(el => el.id ||
        (el.dataset.card || (el.closest('#hand-grid') ? 'hand:' + window.__hcDebug.state.hand[Array.from(el.parentNode.children).indexOf(el)] : el.className))));

    // --- Cutscene: 5 ilustrações reais (PNG) num palco 16:9 animado, com partículas por cima ---
    const SCENE_ANIMS = ['anim-kenburns', 'anim-shake', 'anim-zoom', 'anim-transmute', 'anim-pan'];
    const sceneInfo = () => oq(() => {
        const stage = document.getElementById('intro-stage');
        const img = document.getElementById('intro-img');
        const c = document.getElementById('intro-particles');
        const r = stage.getBoundingClientRect();
        // Lê uma cópia (1 leitura por canvas temporário): o jogo nunca faz readback do overlay.
        const copy = document.createElement('canvas');
        copy.width = c.width;
        copy.height = c.height;
        const cg = copy.getContext('2d', { willReadFrequently: true });
        cg.drawImage(c, 0, 0);
        const px = cg.getImageData(0, 0, copy.width, copy.height).data;
        let lit = 0;
        for (let i = 3; i < px.length; i += 4 * 13) if (px[i] > 0) lit++;
        return {
            scene: window.__hcDebug.intro.scene,
            cls: stage.className,
            src: img.getAttribute('src'),
            loaded: img.complete && img.naturalWidth > 0,
            failed: stage.classList.contains('img-failed'),
            pixelated: getComputedStyle(img).imageRendering === 'pixelated',
            clip: getComputedStyle(stage).overflow === 'hidden',
            ratio: Math.round(r.width / r.height * 100) / 100,
            inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth,
            particles: lit,
            step: document.getElementById('intro-step').textContent,
            title: document.getElementById('intro-title').textContent,
            bubble: document.getElementById('intro-bubble').classList.contains('hidden') ? '' : document.getElementById('intro-bubble').textContent,
            muffled: window.GameAudio.isMuffled()
        };
    });
    const waitImg = () => op.waitForFunction(() => {
        const img = document.getElementById('intro-img');
        return img.complete && img.naturalWidth > 0;
    }, null, { timeout: 15000 }).catch(() => {});
    const i0 = await introNow();
    check(vp, 'intro: abre sozinha na 1ª visita', i0.open && i0.scene === 0, i0);
    await ow(300);
    const typing = await oq(() => document.getElementById('intro-text').textContent.length);
    await op.click('#btn-intro-next');
    const full = await oq(() => document.getElementById('intro-text').textContent);
    check(vp, 'intro: texto digitado aos poucos e completado no 1º clique', typing > 0 && typing < full.length &&
        full.indexOf('Horizonte Serviços') > 0, { typing });
    const seen = [];
    for (let n = 0; n < 5; n++) {
        if (n > 0) {
            // completa o texto da cena anterior (se ainda digitando) e passa para a próxima
            for (let k = 0; k < 3 && await oq(m => window.__hcDebug.intro.scene !== m, n); k++) await op.click('#btn-intro-next');
        }
        await waitImg();
        await ow(n === 3 ? 1900 : 700);            // cena 4: o balão entra depois de 1,4 s
        const info = await sceneInfo();
        seen.push(info);
        check(vp, 'intro cena ' + (n + 1) + '/5: PNG carregado, pixelado, palco 16:9 com animação e partículas, sem overflow',
            info.scene === n && info.step === (n + 1) + '/5' && info.src === 'assets/intro/cena' + (n + 1) + '.png' && info.loaded && !info.failed &&
            info.pixelated && info.clip && Math.abs(info.ratio - 1.78) <= 0.02 && info.inView && info.cls.includes('scene-' + (n + 1)) &&
            info.cls.includes(SCENE_ANIMS[n]) && info.particles > 0 && await noOverflow(), info);
        if (n === 1 || n === 3) await op.screenshot({ path: 'e2e-' + vp + '-intro-cena' + (n + 1) + '.png' });
    }
    check(vp, 'intro: títulos das 5 cenas', JSON.stringify(seen.map(x => x.title)) ===
        JSON.stringify(['A Rotina', 'O Sufoco', 'O Desligamento', 'A Transmutação', 'A Praia do Crepúsculo']), seen.map(x => x.title));
    check(vp, 'intro: som do escritório abafado só na Cena 3 (Desligamento); mar volta aberto nas 4 e 5',
        JSON.stringify(seen.map(x => x.muffled)) === '[false,false,true,false,false]', seen.map(x => x.muffled));
    check(vp, 'intro: balão "Ei, Motta" só na Cena 4', seen[3].bubble === 'Ei, Motta... tá me ouvindo?' &&
        seen.filter(x => x.bubble).length === 1, seen.map(x => x.bubble));
    const preloaded = await oq(() => window.GameIntro.images.map(img => img.complete && img.naturalWidth > 0));
    check(vp, 'intro: as 5 imagens pré-carregadas (complete && naturalWidth > 0)', preloaded.length === 5 && preloaded.every(Boolean), preloaded);
    check(vp, 'intro: Pular sempre visível', await oq(() => {
        const b = document.getElementById('btn-intro-skip').getBoundingClientRect();
        return b.width > 0 && b.bottom <= innerHeight;
    }));
    // Concluir: completa o texto (se ainda estiver digitando) e abre a escolha final.
    for (let k = 0; k < 3 && await oq(() => document.getElementById('intro-choice').classList.contains('hidden')); k++) {
        await op.click('#btn-intro-next');
        await ow(150);
    }
    const choice = await oq(() => ({
        visible: !document.getElementById('intro-choice').classList.contains('hidden'),
        scene: window.__hcDebug.intro.scene,
        saved: JSON.parse(localStorage.getItem('hc_ui_v1') || '{}').introSeen === true,
        tut: document.getElementById('btn-intro-tutorial').textContent
    }));
    check(vp, 'intro: Concluir na cena 5 oferece Tutorial (Recomendado) ou Ir Direto; introSeen salvo',
        choice.visible && choice.scene === 4 && choice.saved && /RECOMENDADO/.test(choice.tut) && await noOverflow(), choice);

    // --- Tutorial guiado: Passo 1 ao 4 ---
    await op.click('#btn-intro-tutorial');
    await ow(600);
    check(vp, 'tutorial: começa com card e cartão-guia, intro fechada', await oq(() => {
        const s = window.__hcDebug.state;
        return !!s.tutorial && !window.__hcDebug.intro.open && !document.getElementById('tutorial-coach').classList.contains('hidden') &&
            document.getElementById('narrative-tag').textContent.indexOf('TUTORIAL') === 0;
    }));
    await ow(300);
    check(vp, 'tutorial: spotlight no botão de continuar', (await spotIds()).includes('btn-narrative-continue'));
    await op.click('#btn-narrative-continue');
    await ow(600);
    const p1 = { stage: await stage(), spots: await spotIds() };
    check(vp, 'Passo 1: movimento e minimapa destacados', p1.stage === 'explore1' && p1.spots.includes('btn-move-fwd') &&
        p1.spots.includes('minimap-canvas') && await noOverflow(), p1);
    await op.screenshot({ path: 'e2e-' + vp + '-tutorial-1.png' });
    await op.keyboard.press('ArrowUp');
    await op.waitForFunction(() => window.__hcDebug.state.mode === 'combat', null, { timeout: 10000 });
    await ow(600);
    const p2a = { stage: await stage(), spots: await spotIds(), aggro: await oq(() => window.__hcDebug.state.currentEncDef.tutorialStep) };
    check(vp, 'Passo 1: um passo à frente e o aggro por linha de visão inicia o combate', p2a.aggro === 2, p2a);
    check(vp, 'Passo 2: destaca a carta de custo 0', p2a.stage === 'combo' && JSON.stringify(p2a.spots) === '["hand:golpe_furtivo"]', p2a);
    await op.click('#hand-grid .card-btn.tut-spot');
    await op.waitForFunction(() => !window.__hcDebug.state.busy, null, { timeout: 10000 });
    await ow(400);
    const p2b = await spotIds();
    check(vp, 'Passo 2: depois destaca a de custo 1', JSON.stringify(p2b) === '["hand:mordida_ferro"]', p2b);
    await op.click('#hand-grid .card-btn.tut-spot');
    await op.waitForFunction(() => !window.__hcDebug.state.busy, null, { timeout: 10000 });
    await ow(400);
    const p2c = { combo: await oq(() => window.__hcDebug.state.comboCount), spots: await spotIds() };
    check(vp, 'Passo 2: escada 0 → 1 vira x2 e destaca mini-pilha + Jogar Tudo', p2c.combo === 1 &&
        p2c.spots.includes('combo-chain') && (p2c.spots.includes('btn-play-all') || p2c.spots.includes('btn-end-turn')), p2c);
    await op.screenshot({ path: 'e2e-' + vp + '-tutorial-2.png' });
    const finishCombat = async () => {
        for (let i = 0; i < 80; i++) {
            const c = await oq(() => {
                const s = window.__hcDebug.state;
                return { mode: s.mode, busy: s.busy || s.autoPlaying, pa: !document.getElementById('btn-play-all').disabled };
            });
            if (c.mode !== 'combat') return true;
            if (c.busy) { await ow(200); continue; }
            await op.click(c.pa ? '#btn-play-all' : '#btn-end-turn');
            await ow(400);
        }
        return false;
    };
    check(vp, 'Passo 2: Jogar Tudo / Fim do Turno encerram a luta', await finishCombat());
    await op.waitForFunction(() => window.__hcDebug.state.mode === 'explore' && !window.__hcDebug.state.busy, null, { timeout: 10000 });
    await ow(500);
    check(vp, 'Passo 3: guia até o próximo grupo', await stage() === 'explore2');
    const walkTo = async (tx, ty) => {
        for (let i = 0; i < 120; i++) {
            const r = await op.evaluate(([x0, y0]) => {
                const h = window.__hcDebug;
                const s = h.state;
                const D = window.GameData;
                if (s.mode !== 'explore' || h.activeModal) return s.mode;
                if (s.busy) return 'busy';
                const L = h.getFloor().layout;
                const DX = [0, 1, 0, -1];
                const DY = [-1, 0, 1, 0];
                const start = s.player.x + ',' + s.player.y;
                if (start === x0 + ',' + y0) return 'arrived';
                const prev = new Map([[start, null]]);
                const q = [[s.player.x, s.player.y]];
                let found = null;
                while (q.length && !found) {
                    const [cx, cy] = q.shift();
                    for (let d = 0; d < 4; d++) {
                        const x = cx + DX[d];
                        const y = cy + DY[d];
                        const k = x + ',' + y;
                        if (prev.has(k) || !D.isWalkableTile(L, x, y)) continue;
                        prev.set(k, cx + ',' + cy);
                        if (x === x0 && y === y0) { found = k; break; }
                        q.push([x, y]);
                    }
                }
                if (!found) return 'nopath';
                let node = found;
                while (prev.get(node) !== start) node = prev.get(node);
                const [nx, ny] = node.split(',').map(Number);
                const want = DX.findIndex((dx, d) => s.player.x + dx === nx && s.player.y + DY[d] === ny);
                if (want !== s.player.dir) {
                    const delta = (want - s.player.dir + 4) % 4;
                    h.turnPlayer(delta === 3 ? -1 : 1);
                    return 'turn';
                }
                h.moveRelative(1, 0);
                return 'move';
            }, [tx, ty]);
            if (r === 'combat' || r === 'modal' || r === 'arrived' || r === 'nopath') return r;
            await ow(r === 'busy' ? 200 : 90);
        }
        return 'timeout';
    };
    const enc2 = await oq(() => { const e = window.__hcDebug.state.encounters.find(x => x.alive); return [e.x, e.y]; });
    const walked = await walkTo(enc2[0], enc2[1]);
    await op.waitForFunction(() => window.__hcDebug.state.mode === 'combat' && !window.__hcDebug.state.busy, null, { timeout: 10000 });
    await ow(500);
    const p3a = { walked, stage: await stage(), spots: await spotIds(), enemies: await oq(() => window.__hcDebug.state.enemies.map(e => [e.kind, e.col, e.row, e.hasIntent])) };
    check(vp, 'Passo 3: 2 na frente com ATK + 1 na retaguarda; destaca a Égide (Escudo + Knockback)',
        p3a.walked === 'combat' && p3a.stage === 'defense' && JSON.stringify(p3a.spots) === '["hand:escudo_burocratico"]' &&
        p3a.enemies.filter(e => e[2] === 0 && e[3]).length === 2 && p3a.enemies.some(e => e[2] === 1), p3a);
    await op.click('#hand-grid .card-btn.tut-spot');
    await op.waitForFunction(() => !window.__hcDebug.state.busy, null, { timeout: 10000 });
    await ow(400);
    const p3b = { shield: await oq(() => window.__hcDebug.state.shield), spots: await spotIds() };
    check(vp, 'Passo 3: Escudo ganho e destaque passa para a Lança de Geada (Freeze)', p3b.shield > 0 &&
        JSON.stringify(p3b.spots) === '["hand:lanca_geada"]', p3b);
    await op.click('#hand-grid .card-btn.tut-spot');
    await op.waitForFunction(() => !window.__hcDebug.state.busy, null, { timeout: 10000 });
    await ow(400);
    const p3c = { frozen: await oq(() => window.__hcDebug.state.enemies.some(e => e.frost > 0)), spots: await spotIds() };
    check(vp, 'Passo 3: Gelo aplicado e destaque no Chicote (frente)', p3c.frozen && JSON.stringify(p3c.spots) === '["hand:chicote_dados"]', p3c);
    await op.click('#hand-grid .card-btn.tut-spot');
    await op.waitForFunction(() => !window.__hcDebug.state.busy, null, { timeout: 10000 });
    await ow(500);
    const p3d = await oq(() => {
        const s = window.__hcDebug.state;
        return { specter: s.enemies.filter(e => e.kind === 'specter').map(e => [e.row, e.hp > 0]), title: document.getElementById('coach-title').textContent };
    });
    check(vp, 'Passo 3: morto o da frente, a retaguarda avança', JSON.stringify(p3d.specter) === '[[0,true]]' &&
        p3d.title === 'A retaguarda avançou!', p3d);
    await op.screenshot({ path: 'e2e-' + vp + '-tutorial-3.png' });
    check(vp, 'Passo 3: luta encerrada', await finishCombat());

    // --- Passo 4: Level Up, baú, gema e Arcana ---
    await op.waitForFunction(() => !document.getElementById('levelup-modal').classList.contains('hidden'), null, { timeout: 15000 });
    await ow(500);
    const p4a = { stage: await stage(), spots: await spotIds() };
    check(vp, 'Passo 4: Level Up destaca Re-rolar, Pular e Banir', p4a.stage === 'levelup' &&
        ['btn-lvl-reroll', 'btn-lvl-skip', 'btn-lvl-banish'].every(id => p4a.spots.includes(id)) && await noOverflow(), p4a);
    await op.screenshot({ path: 'e2e-' + vp + '-tutorial-4.png' });
    const rr = await oq(() => window.__hcDebug.state.rerollsLeft);
    await op.click('#btn-lvl-reroll');
    await ow(200);
    check(vp, 'Passo 4: Re-rolar gasta 1 uso', await oq(r => window.__hcDebug.state.rerollsLeft === r - 1, rr));
    await op.click('#reward-grid .reward-card');
    await ow(600);
    for (let i = 0; i < 10 && (await oq(() => window.__hcDebug.activeModal && window.__hcDebug.activeModal.type)); i++) {
        await oq(() => { const b = document.querySelector('#gem-modal:not(.hidden) .gem-target-card, #levelup-modal:not(.hidden) .reward-card'); if (b) b.click(); });
        await ow(500);
    }
    check(vp, 'Passo 4: guia até o baú', await stage() === 'chest');
    const chest = await oq(() => {
        const L = window.__hcDebug.getFloor().layout;
        for (let y = 0; y < L.length; y++) { const x = L[y].indexOf('C'); if (x >= 0) return [x, y]; }
        return null;
    });
    await walkTo(chest[0], chest[1]);
    await op.waitForFunction(() => !document.getElementById('gem-modal').classList.contains('hidden'), null, { timeout: 10000 });
    await ow(500);
    const p4b = { stage: await stage(), spot: await oq(() => !!document.querySelector('#gem-targets .gem-target-card.tut-spot')) };
    check(vp, 'Passo 4: baú abre a gema com destaque na carta-alvo', p4b.stage === 'gem' && p4b.spot, p4b);
    await op.click('#gem-targets .gem-target-card.tut-spot');
    await op.waitForFunction(() => !document.getElementById('arcana-modal').classList.contains('hidden'), null, { timeout: 10000 });
    await ow(500);
    check(vp, 'Passo 4: gema encaixada e Arcana destacada', await oq(() => Object.keys(window.__hcDebug.state.cardGems).length > 0) &&
        await stage() === 'arcana' && (await spotIds()).includes('arcana-choices'));
    await op.click('#arcana-modal .arcana-choice');
    await op.waitForFunction(() => document.getElementById('narrative-tag').textContent === 'TUTORIAL CONCLUÍDO' &&
        !document.getElementById('narrative-modal').classList.contains('hidden'), null, { timeout: 10000 });
    await op.click('#btn-narrative-continue');
    await ow(600);
    const done = await oq(() => ({
        title: !document.getElementById('title-modal').classList.contains('hidden'),
        tut: !!window.__hcDebug.state.tutorial,
        coach: document.getElementById('tutorial-coach').classList.contains('hidden'),
        spots: document.querySelectorAll('.tut-spot').length,
        ui: JSON.parse(localStorage.getItem('hc_ui_v1') || '{}'),
        meta: localStorage.getItem('hc_meta_v1'),
        deck: window.__hcDebug.state.deck.length,
        level: window.__hcDebug.state.level
    }));
    check(vp, 'tutorial: concluído volta limpo à Recepção e só carimba a meta do tutorial', done.title && !done.tut && done.coach &&
        done.spots === 0 && done.ui.tutorialDone === true &&
        // Única escrita permitida: o carimbo "Estagiário Promovido" (+40 CR); nada de run, colegas ou descobertas.
        (() => { const m = JSON.parse(done.meta); return JSON.stringify(m.goals) === '{"estagiario":true}' && m.credits === 40 && m.stats.runs === 0 &&
            Object.values(m.seen).every(a => a.length === 0); })() && done.level === 1 && done.deck > 7, done);

    // --- Rever Intro (reprise) e Sair do Tutorial ---
    await op.reload();
    await ow(600);
    check(vp, 'intro: não reabre depois de vista', !(await introNow()).open);
    await op.click('#btn-replay-intro');
    await ow(300);
    const replay = await oq(() => ({ open: window.__hcDebug.intro.open, direct: document.getElementById('btn-intro-direct').textContent }));
    await op.keyboard.press('Escape');
    await ow(200);
    replay.afterEsc = await oq(() => ({ scene: window.__hcDebug.intro.scene,
        choice: !document.getElementById('intro-choice').classList.contains('hidden') }));
    await op.click('#btn-intro-direct');
    await ow(300);
    check(vp, 'intro: Rever Intro abre; Esc pula para a escolha na cena 5; "Voltar à Recepção" não inicia a run',
        replay.open && replay.direct === 'VOLTAR À RECEPÇÃO' && replay.afterEsc.scene === 4 && replay.afterEsc.choice &&
        await oq(() => !window.__hcDebug.intro.open && !document.getElementById('title-modal').classList.contains('hidden')), replay);
    await op.click('#btn-open-tutorial');
    await ow(500);
    const inTut = await oq(() => !!window.__hcDebug.state.tutorial);
    await op.click('#btn-tutorial-exit');
    await ow(400);
    check(vp, 'tutorial: Sair do Tutorial volta à Recepção', inTut && await oq(() => !window.__hcDebug.state.tutorial &&
        !document.getElementById('title-modal').classList.contains('hidden') && document.getElementById('tutorial-coach').classList.contains('hidden')));

    // --- Manual do Expediente: 5 abas, rolagem só dentro do conteúdo ---
    await op.click('#btn-title-codex');
    await ow(300);
    const tabs = await oq(() => Array.from(document.querySelectorAll('#codex-tabs .codex-tab')).map(b => b.dataset.tab));
    const tabInfo = [];
    for (const id of tabs) {
        await op.click('.codex-tab[data-tab="' + id + '"]');
        await ow(120);
        tabInfo.push(await oq(t => {
            const c = document.getElementById('codex-content');
            const box = document.querySelector('.codex-box').getBoundingClientRect();
            return { tab: c.dataset.tab === t, active: document.querySelector('.codex-tab.active').dataset.tab === t, chars: c.textContent.length,
                scrolls: c.scrollHeight > c.clientHeight, inView: box.top >= 0 && box.bottom <= innerHeight };
        }, id));
    }
    check(vp, 'Manual: 6 abas navegáveis (com o Bestiário de Cartas), todas com conteúdo, dentro da tela', tabs.length === 6 &&
        tabInfo.every(t => t.tab && t.active && t.chars > 400 && t.inView) && await noOverflow(), tabInfo);
    check(vp, 'Manual: rolagem interna no conteúdo quando o texto é longo', tabInfo.some(t => t.scrolls));
    const codexText = await oq(() => {
        const D = window.GameData;
        return ['Might', 'Amount', 'Area', 'Luck', 'Growth', 'Recovery', 'Revival', 'Curse', 'Knockback', 'Freeze', 'Burn', 'Return', 'Retain', 'Destroy', 'Custo X',
            'Overkill', 'Retaguarda', 'Almoxarifado', 'Grafia', 'Curadoria', 'Hora Extra', D.FLOORS[4].bossName]
            .filter(term => !window.GameCodex.build(D, window.GameMeta).some(t => t.html.toLowerCase().includes(term.toLowerCase())));
    });
    check(vp, 'Manual: cobre atributos, keywords, inimigos, chefes e Recepção', codexText.length === 0, codexText);
    await op.screenshot({ path: 'e2e-' + vp + '-manual.png' });
    await op.keyboard.press('Escape');
    await ow(200);
    check(vp, 'Manual: Esc fecha', await oq(() => !window.__hcDebug.codexOpen && document.getElementById('codex-modal').classList.contains('hidden')));

    // --- Dicas de 1ª vez: aparecem 1x, não bloqueiam e ficam salvas ---
    await startDay(op);
    await ow(300);
    await op.click('#btn-narrative-continue');
    await ow(400);
    await op.locator('#arcana-modal .arcana-choice').first().click();
    await ow(400);
    await op.click('#btn-codex');
    await ow(200);
    check(vp, 'Manual: botão ? do topo abre durante a run e pausa a exploração', await oq(() => window.__hcDebug.codexOpen));
    await op.keyboard.press('Escape');
    await oq(() => {
        const h = window.__hcDebug;
        h.startEncounter(null, window.GameData.getFloorConfig(1).encounters['1']);
        h.state.hand = ['moeda_destino', 'mordida_ferro'];
        h.state.handTemp = [false, false];
        h.state.handReturnCounts = [0, 0];
        h.state.handCostMods = [0, 0];
        h.render();
    });
    await ow(300);
    const tip = await oq(() => {
        const card = document.getElementById('tip-card');
        return { visible: !card.classList.contains('hidden'), id: card.dataset.tip, pe: getComputedStyle(card).pointerEvents,
            saved: JSON.parse(localStorage.getItem('hc_ui_v1')).tips, modals: Array.from(document.querySelectorAll('.modal-overlay')).filter(m => !m.classList.contains('hidden')).length };
    });
    // A mão inicial real do encontro já pode ter trazido outra palavra-chave: as dicas saem uma por vez, em fila.
    check(vp, 'dica: Wild entra na fila de dicas (1 cartão por vez, sem bloquear nem abrir modal)', tip.visible && tip.id === tip.saved[0] &&
        tip.pe === 'none' && tip.saved.includes('wild') && tip.modals === 0, tip);
    const again = await oq(() => {
        window.__hcDebug.showTip('wild');
        window.__hcDebug.showTip('burn');
        return JSON.parse(localStorage.getItem('hc_ui_v1')).tips;
    });
    check(vp, 'dica: a mesma dica não repete', again.filter(t => t === 'wild').length === 1 && again.includes('burn'), again);
    check(vp, 'onboarding: 0 overflow e 0 erros/avisos no console', await noOverflow() && oerr.length === 0, oerr.slice(0, 4));
    await op.close();

    // --- Ilustrações 16:9 nas transições das Fases 2 a 5 e no epílogo das 18:00 ---
    const ap = await browser.newPage({ viewport: size });
    const aerr = [];
    ap.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') aerr.push(m.type() + ': ' + m.text()); });
    ap.on('pageerror', e => aerr.push('PAGEERROR ' + e.message));
    await ap.addInitScript(ui => localStorage.setItem('hc_ui_v1', ui), UI_SEEN);
    await ap.goto(srv.url);
    await ap.waitForTimeout(400);
    const aq = (fn, arg) => ap.evaluate(fn, arg);
    const artInfo = id => aq(stageId => {
        const stage = document.getElementById(stageId);
        const img = stage.querySelector('img');
        const c = stage.querySelector('canvas');
        const copy = document.createElement('canvas');
        copy.width = c.width;
        copy.height = c.height;
        const cg = copy.getContext('2d', { willReadFrequently: true });
        cg.drawImage(c, 0, 0);
        const px = cg.getImageData(0, 0, copy.width, copy.height).data;
        let lit = 0;
        for (let i = 3; i < px.length; i += 4 * 13) if (px[i] > 0) lit++;
        const r = stage.getBoundingClientRect();
        const box = stage.closest('.modal-box');
        const d = document.documentElement;
        return {
            visible: !stage.closest('.hidden'), src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0,
            failed: stage.classList.contains('img-failed'), pixelated: getComputedStyle(img).imageRendering === 'pixelated',
            anim: getComputedStyle(img).animationName, ratio: Math.round(r.width / r.height * 100) / 100, particles: lit,
            fits: d.scrollHeight <= innerHeight && d.scrollWidth <= innerWidth && box.scrollHeight <= box.clientHeight + 1 && r.bottom <= innerHeight
        };
    }, id);
    await startDay(ap);
    await ap.waitForTimeout(300);
    check(vp, 'arte: a Fase 1 (já apresentada pela cutscene) não repete ilustração', (await artInfo('narrative-art')).visible === false);
    await ap.click('#btn-narrative-continue');
    await ap.waitForTimeout(400);
    await ap.locator('#arcana-modal .arcana-choice').first().click();
    await ap.waitForTimeout(400);
    const ARTS = { 2: 'transicao_cidade', 3: 'transicao_neve', 4: 'transicao_dungeon', 5: 'transicao_abismo' };
    for (const n of [2, 3, 4, 5]) {
        await aq(f => window.__hcDebug.showFloorTrigger(f), n);
        await ap.waitForFunction(() => {
            const img = document.querySelector('#narrative-art img');
            return !document.getElementById('narrative-modal').classList.contains('hidden') && img.complete && img.naturalWidth > 0;
        }, null, { timeout: 15000 }).catch(() => {});
        await ap.waitForTimeout(600);
        const info = await artInfo('narrative-art');
        check(vp, 'arte: Fase ' + n + ' entra com a ilustração 16:9 (Ken Burns + partículas, pixelada, sem scroll)',
            info.visible && info.src === 'assets/intro/' + ARTS[n] + '.png' && info.loaded && !info.failed && info.pixelated &&
            info.anim === 'art-kenburns' && Math.abs(info.ratio - 1.78) <= 0.02 && info.particles > 0 && info.fits, info);
        if (n === 2) await ap.screenshot({ path: 'e2e-' + vp + '-arte-fase2.png' });
        await ap.click('#btn-narrative-continue');
        await ap.waitForTimeout(400);
    }
    await aq(() => window.__hcDebug.endGame(true));
    await ap.waitForFunction(() => {
        const img = document.querySelector('#end-art img');
        return img.complete && img.naturalWidth > 0;
    }, null, { timeout: 15000 }).catch(() => {});
    await ap.waitForTimeout(600);
    const fin = await artInfo('end-art');
    check(vp, 'arte: vitória das 18:00 mostra o epílogo ilustrado sem scroll', fin.visible && fin.src === 'assets/intro/epilogo_18h.png' &&
        fin.loaded && fin.pixelated && fin.particles > 0 && fin.fits, fin);
    await ap.screenshot({ path: 'e2e-' + vp + '-arte-18h.png' });
    await ap.click('#btn-play-again');
    await ap.waitForTimeout(400);
    await startDay(ap);
    await ap.waitForTimeout(300);
    await ap.click('#btn-narrative-continue');
    await ap.waitForTimeout(400);
    await ap.locator('#arcana-modal .arcana-choice').first().click();
    await ap.waitForTimeout(300);
    await aq(() => window.__hcDebug.endGame(false));
    await ap.waitForTimeout(300);
    check(vp, 'arte: derrota (Burnout) não usa a ilustração das 18:00', (await artInfo('end-art')).visible === false);
    check(vp, 'arte: 0 erros/avisos no console', aerr.length === 0, aerr.slice(0, 4));
    await ap.close();

    // --- Cutscene com uma ilustração que falha: degradê de reserva, sem travar e sem erro de script ---
    const fp = await browser.newPage({ viewport: size });
    const ferr = [];
    fp.on('pageerror', e => ferr.push('PAGEERROR ' + e.message));
    await fp.route('**/assets/intro/cena3.png', route => route.abort());
    await fp.route('**/assets/intro/transicao_dungeon.png', route => route.abort());
    await fp.goto(srv.url);
    await fp.waitForTimeout(500);
    for (let k = 0; k < 8 && await fp.evaluate(() => window.__hcDebug.intro.scene !== 2); k++) await fp.click('#btn-intro-next');
    await fp.waitForTimeout(700);
    const broken = await fp.evaluate(() => ({
        scene: window.__hcDebug.intro.scene,
        failed: document.getElementById('intro-stage').classList.contains('img-failed'),
        bg: getComputedStyle(document.getElementById('intro-stage')).backgroundImage,
        status: window.GameIntro.getStatus()
    }));
    await fp.click('#btn-intro-skip');
    await fp.waitForTimeout(300);
    const skipped = await fp.evaluate(() => ({ scene: window.__hcDebug.intro.scene, failed: document.getElementById('intro-stage').classList.contains('img-failed'),
        choice: !document.getElementById('intro-choice').classList.contains('hidden') }));
    check(vp, 'intro: imagem que falha usa o fundo de reserva; Pular segue para a cena 5 normalmente',
        broken.scene === 2 && broken.failed && /gradient/.test(broken.bg) && broken.status[2] === 'failed' &&
        skipped.scene === 4 && !skipped.failed && skipped.choice && ferr.length === 0, { broken, skipped, ferr });
    // Ilustração de transição que falha: card abre com o degradê do bioma e o jogo segue.
    await fp.click('#btn-intro-direct');
    await fp.waitForTimeout(400);
    await fp.click('#btn-narrative-continue');
    await fp.waitForTimeout(400);
    await fp.locator('#arcana-modal .arcana-choice').first().click();
    await fp.waitForTimeout(300);
    await fp.evaluate(() => window.__hcDebug.showFloorTrigger(4));
    await fp.waitForTimeout(1200);
    const brokenArt = await fp.evaluate(() => {
        const stage = document.getElementById('narrative-art');
        return { visible: !stage.closest('.hidden'), failed: stage.classList.contains('img-failed'), bg: getComputedStyle(stage).backgroundImage };
    });
    await fp.click('#btn-narrative-continue');
    await fp.waitForTimeout(400);
    check(vp, 'arte: transição sem imagem usa o degradê do bioma e o card fecha normalmente', brokenArt.visible && brokenArt.failed &&
        /gradient/.test(brokenArt.bg) && await fp.evaluate(() => window.__hcDebug.state.mode === 'explore') && ferr.length === 0, { brokenArt, ferr });
    await fp.close();

    // ================= ETAPA 7: METAS ("CARIMBOS DO RH"), COLEÇÃO, BACKUP DO SAVE E CAMINHOS RELATIVOS =================
    const gp = await browser.newPage({ viewport: size });
    const gerr = [];
    gp.on('console', m => { if (m.type() === 'error') gerr.push(m.text()); });
    gp.on('pageerror', e => gerr.push('PAGEERROR ' + e.message));
    await gp.addInitScript(ui => { if (!localStorage.getItem('hc_ui_v1')) localStorage.setItem('hc_ui_v1', ui); }, UI_SEEN);
    await gp.goto(srv.url);
    await gp.waitForTimeout(400);
    const gq = (fn, arg) => gp.evaluate(fn, arg);
    const gOpen = () => gq(() => Array.from(document.querySelectorAll('.modal-overlay')).filter(m => !m.classList.contains('hidden')).map(m => m.id));
    const gFits = () => gq(() => {
        const d = document.documentElement;
        const box = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden) .modal-box')).pop();
        return d.scrollHeight <= innerHeight && d.scrollWidth <= innerWidth && (!box || (box.scrollHeight <= box.clientHeight + 1 &&
            box.getBoundingClientRect().bottom <= innerHeight + 1));
    });
    const gStored = () => gq(() => localStorage.getItem('hc_meta_v1'));
    check(vp, 'Etapa7: Recepção com [COLEÇÃO & METAS][BACKUP DO SAVE] sem overflow',
        await gq(() => !!document.getElementById('btn-open-collection').offsetParent && !!document.getElementById('btn-open-backup').offsetParent) && await gFits());

    // --- Coleção: 4 abas, todas as metas pendentes, tudo bloqueado como silhueta ??? com dica ---
    await gp.click('#btn-open-collection');
    await gp.waitForTimeout(250);
    const col0 = await gq(() => ({
        tabs: Array.from(document.querySelectorAll('#collection-tabs .codex-tab')).map(b => b.textContent),
        goals: document.querySelectorAll('#collection-content .col-tile.goal').length,
        done: document.querySelectorAll('#collection-content .col-tile.goal.done').length,
        progress: document.getElementById('collection-progress').textContent
    }));
    const goalTotal = await gq(() => window.GameMeta.GOALS.length);
    check(vp, 'Coleção: abre na aba Metas com ' + goalTotal + ' carimbos pendentes', col0.tabs.length === 4 && goalTotal === 24 && col0.goals === goalTotal &&
        col0.done === 0 && new RegExp('Metas 0/' + goalTotal).test(col0.progress), col0);
    check(vp, 'Coleção: só rolagem interna (sem overflow da página nem da caixa)', await gFits());
    const colTabs = {};
    for (const tab of ['cartas', 'gemas', 'bestiario']) {
        await gq(t => document.querySelector('#collection-tabs [data-tab="' + t + '"]').click(), tab);
        await gp.waitForTimeout(120);
        colTabs[tab] = await gq(() => {
            const c = document.getElementById('collection-content');
            const locked = Array.from(c.querySelectorAll('.col-tile.locked'));
            return { total: c.querySelectorAll('.col-tile').length, locked: locked.length,
                q: locked.every(t => t.querySelector('b').textContent === '???' && t.querySelector('small').textContent.length > 5),
                inner: c.scrollHeight > c.clientHeight ? getComputedStyle(c).overflowY : 'fits' };
        });
        check(vp, 'Coleção: aba ' + tab + ' começa toda em silhueta ??? com dica', colTabs[tab].total > 0 && colTabs[tab].locked === colTabs[tab].total &&
            colTabs[tab].q && /auto|scroll|fits/.test(colTabs[tab].inner) && await gFits(), colTabs[tab]);
    }
    await gp.keyboard.press('Escape');
    await gp.waitForTimeout(150);
    check(vp, 'Coleção: Esc fecha', await gq(() => document.getElementById('collection-modal').classList.contains('hidden')));

    // --- Run: descobertas entram na Coleção; metas pagam crédito com toast discreto no topo ---
    await startDay(gp);
    await gp.waitForTimeout(300);
    await gp.click('#btn-narrative-continue');
    await gp.waitForTimeout(400);
    await gp.locator('#arcana-modal .arcana-choice').first().click();
    await gp.waitForTimeout(500);
    const seen1 = await gq(() => JSON.parse(localStorage.getItem('hc_meta_v1') || '{}').seen || {});
    check(vp, 'Coleção: baralho inicial e Arcanas oferecidas ficam registrados no save', (seen1.cards || []).includes('mordida_ferro') &&
        (seen1.arcanas || []).length >= 1, seen1);
    const credBefore = await gq(() => window.__hcDebug.meta.credits);
    // Mestre da Escadinha: carta jogada com Combo x5 (4 cartas já encadeadas).
    await gq(() => {
        const h = window.__hcDebug;
        const s = h.state;
        h.startEncounter(null, window.GameData.getFloorConfig(1).encounters['1']);
        s.enemies.forEach(e => { e.hp = 9999; e.maxHp = 9999; e.atk = 0; });
        s.hand = ['mordida_ferro'];
        s.handReturnCounts = [0];
        s.handCostMods = [0];
        s.handTemp = [false];
        s.mana = 20;
        s.comboCarry = false;
        s.comboReverse = false;
        s.comboCount = 3;
        s.lastComboCost = 0;
        s.busy = false;
        h.playCard(0);
    });
    await gp.waitForFunction(() => !window.__hcDebug.state.busy, null, { timeout: 30000 });
    await gp.waitForTimeout(150);
    const toast = await gq(() => {
        const t = document.getElementById('goal-toast');
        const r = t.getBoundingClientRect();
        return { visible: !t.classList.contains('hidden'), goal: t.dataset.goal, text: t.textContent, top: r.top, pe: getComputedStyle(t).pointerEvents,
            inView: r.left >= 0 && r.right <= innerWidth };
    });
    const afterGoal = await gq(() => ({ credits: window.__hcDebug.meta.credits, stored: JSON.parse(localStorage.getItem('hc_meta_v1')) }));
    check(vp, 'Metas: Combo x5 carimba "Mestre da Escadinha" (+40 CR salvo) com toast no topo que não bloqueia cliques',
        toast.visible && toast.goal === 'escadinha' && /META CONCLUÍDA/.test(toast.text) && /\+40 CR/.test(toast.text) && toast.top <= 20 &&
        toast.pe === 'none' && toast.inView && afterGoal.credits === credBefore + 40 && afterGoal.stored.goals.escadinha === true &&
        afterGoal.stored.credits === credBefore + 40, { toast, credBefore, credits: afterGoal.credits });
    check(vp, 'Metas: toast não entra na fila de modais', JSON.stringify(await gOpen()) === '[]');
    check(vp, 'Metas: a mesma meta não paga duas vezes', await gq(() => window.__hcDebug.goal('escadinha')) === 0);
    // Abates: 100º inimigo derrotado na run.
    await gq(() => {
        const h = window.__hcDebug;
        const s = h.state;
        s.enemies.forEach(e => { e.hp = 1; e.shield = 0; });
        s.kills = 99;
        s.hand = ['mordida_ferro'];
        s.handReturnCounts = [0];
        s.handCostMods = [0];
        s.handTemp = [false];
        s.mana = 20;
        s.busy = false;
        h.playCard(0);
    });
    await gp.waitForFunction(() => !window.__hcDebug.state.busy, null, { timeout: 30000 });
    check(vp, 'Metas: 100 abates carimba "Hora de Pico"/abates', await gq(() => window.__hcDebug.meta.goals.abates === true));
    // Fim da run com vitória sem fogueira: Minimalista + Primeiro Ponto (meta de save) no mesmo fechamento.
    await gq(() => { window.__hcDebug.state.vrSpent = 0; window.__hcDebug.endGame(true); });
    await gp.waitForTimeout(500);
    const endG = await gq(() => ({ goals: Object.keys(JSON.parse(localStorage.getItem('hc_meta_v1')).goals),
        notes: document.getElementById('end-modal') ? document.getElementById('end-modal').textContent : '' }));
    check(vp, 'Metas: vitória sem Fogueira carimba Minimalista e Primeiro Ponto',
        ['primeiro_ponto', 'minimalista', 'escadinha', 'abates'].every(g => endG.goals.includes(g)) && /meta\(s\) conclu/.test(endG.notes), endG.goals);
    for (let i = 0; i < 20 && (await gOpen()).length > 0; i++) {
        await gq(() => { const b = ['#btn-narrative-continue', '#btn-play-again'].map(q => document.querySelector(q)).find(x => x && x.offsetParent); if (b) b.click(); });
        await gp.waitForTimeout(350);
    }
    await gp.waitForTimeout(300);
    await gp.click('#btn-open-collection');
    await gp.waitForTimeout(250);
    const col1 = await gq(() => ({ done: document.querySelectorAll('#collection-content .col-tile.goal.done').length,
        stamped: document.querySelector('#collection-content [data-goal="escadinha"] em').textContent,
        progress: document.getElementById('collection-progress').textContent }));
    await gq(() => document.querySelector('#collection-tabs [data-tab="cartas"]').click());
    await gp.waitForTimeout(120);
    const col1c = await gq(() => {
        const t = Array.from(document.querySelectorAll('#collection-content .col-tile')).find(x => x.querySelector('b').textContent === window.GameData.CARDS.mordida_ferro.name);
        return { unlocked: !!t && !t.classList.contains('locked'), locked: document.querySelectorAll('#collection-content .col-tile.locked').length };
    });
    await gq(() => document.querySelector('#collection-tabs [data-tab="bestiario"]').click());
    await gp.waitForTimeout(120);
    const col1b = await gq(() => document.querySelectorAll('#collection-content .col-tile:not(.locked)').length);
    check(vp, 'Coleção: metas carimbadas, carta e inimigos vistos saem da silhueta', col1.done >= 4 && /CARIMBADA/.test(col1.stamped) &&
        col1c.unlocked && col1c.locked > 0 && col1b >= 1 && await gFits(), { col1, col1c, col1b });
    await gp.screenshot({ path: 'e2e-' + vp + '-colecao.png' });
    await gp.click('#btn-collection-close');
    await gp.waitForTimeout(150);

    // --- Backup do Save: exportar, importar inválido (nada muda) e válido (só após confirmar) ---
    await gp.click('#btn-open-backup');
    await gp.waitForTimeout(200);
    check(vp, 'Backup: modal cabe na tela', await gFits());
    await gp.click('#btn-backup-export');
    await gp.waitForTimeout(300);
    const exp = await gq(() => {
        const code = document.getElementById('backup-text').value;
        const dec = window.GameMeta.decodeBackup(code, {});
        return { prefix: code.slice(0, 8), ok: dec.ok, same: dec.ok && JSON.stringify(dec.meta.goals) === JSON.stringify(window.__hcDebug.meta.goals) &&
            dec.meta.credits === window.__hcDebug.meta.credits && dec.ui.introSeen === true, status: document.getElementById('backup-status').textContent };
    });
    check(vp, 'Backup: Exportar gera HCSAVE1 (Base64 + checksum) com meta e metas completas', exp.prefix === 'HCSAVE1.' && exp.ok && exp.same &&
        /copiado|copie/i.test(exp.status), exp);
    const goodCode = await gq(() => document.getElementById('backup-text').value);
    const bkBefore = await gStored();
    const bkBeforeUi = await gq(() => localStorage.getItem('hc_ui_v1'));
    const tamper = goodCode.slice(0, -1) + (goodCode.slice(-1) === '0' ? '1' : '0');
    const mid = goodCode.split('.');
    const flipped = mid[0] + '.' + mid[1].slice(0, 20) + (mid[1][20] === 'A' ? 'B' : 'A') + mid[1].slice(21) + '.' + mid[2];
    for (const [label, bad] of [['lixo', 'isso nao e um save'], ['prefixo errado', 'XXSAVE1.' + mid[1] + '.' + mid[2]], ['checksum adulterado', tamper],
        ['conteúdo adulterado', flipped], ['Base64 inválido', 'HCSAVE1.@@@###.deadbeef'], ['vazio', '   ']]) {
        await gp.fill('#backup-text', bad);
        await gp.click('#btn-backup-import');
        await gp.waitForTimeout(120);
        const r = await gq(() => ({ status: document.getElementById('backup-status').textContent, cls: document.getElementById('backup-status').className,
            confirm: !document.getElementById('btn-backup-confirm').classList.contains('hidden') }));
        check(vp, 'Backup: rejeita ' + label + ' com mensagem clara e save intacto', /error/.test(r.cls) && /não foi alterado/.test(r.status) &&
            !r.confirm && await gStored() === bkBefore && await gq(() => localStorage.getItem('hc_ui_v1')) === bkBeforeUi, r);
    }
    // Save diferente (outro computador): 4321 CR, Hora Extra e tutorial feitos.
    const otherCode = await gq(() => {
        const M = window.GameMeta;
        const other = M.defaults();
        other.credits = 4321;
        other.goals = { colegas: true, infinito: true };
        other.unlockedChars = ['valter', 'vivi'];
        return M.encodeBackup(other, { introSeen: true, tutorialDone: true, tips: [] });
    });
    await gp.fill('#backup-text', otherCode);
    await gp.click('#btn-backup-import');
    await gp.waitForTimeout(150);
    const pending = await gq(() => ({ status: document.getElementById('backup-status').textContent,
        confirm: !document.getElementById('btn-backup-confirm').classList.contains('hidden') }));
    check(vp, 'Backup: importar válido só valida e pede confirmação (save ainda intacto)', pending.confirm && /4321 CR/.test(pending.status) &&
        await gStored() === bkBefore, pending);
    await gp.click('#btn-backup-confirm');
    await gp.waitForTimeout(200);
    const applied = await gq(() => ({ mem: window.__hcDebug.meta.credits, stored: JSON.parse(localStorage.getItem('hc_meta_v1')).credits,
        goals: Object.keys(window.__hcDebug.meta.goals).sort().join(','), ui: window.__hcDebug.ui.tutorialDone,
        status: document.getElementById('backup-status').textContent }));
    check(vp, 'Backup: confirmar substitui meta + metas + UI', applied.mem === 4321 && applied.stored === 4321 && applied.goals === 'colegas,infinito' &&
        applied.ui === true && /sucesso/.test(applied.status), applied);
    await gp.click('#btn-backup-close');
    await gp.reload();
    await gp.waitForTimeout(500);
    check(vp, 'Backup: save importado sobrevive ao recarregar', await gq(() => window.__hcDebug.meta.credits === 4321 &&
        window.__hcDebug.meta.unlockedChars.includes('vivi')));
    // Save corrompido no localStorage: carrega padrão sem erro (sanitize), Coleção abre.
    await gq(() => localStorage.setItem('hc_meta_v1', '{"goals":{"hack":true,"escadinha":"sim"},"seen":{"cards":["nao_existe",5]}}'));
    await gp.reload();
    await gp.waitForTimeout(500);
    check(vp, 'Save corrompido: metas/coleção desconhecidas são descartadas', await gq(() => JSON.stringify(window.__hcDebug.meta.goals) === '{}' &&
        window.__hcDebug.meta.seen.cards.length === 0));
    if (vp === 'mobile') {
        await gp.setViewportSize({ width: 375, height: 667 });
        await gp.waitForTimeout(300);
        check(vp, 'Recepção 375x667: sem overflow com a nova linha', await gFits());
        await gp.click('#btn-open-collection');
        await gp.waitForTimeout(200);
        check(vp, 'Coleção 375x667: sem overflow', await gFits());
        await gp.click('#btn-collection-close');
    }
    check(vp, 'Etapa7: 0 erros no console', gerr.length === 0, gerr.slice(0, 4));
    await gp.close();

    // --- Caminhos relativos (Itch.io): jogo numa subpasta e dentro de iframe, sem nenhuma requisição falha ---
    for (const [label, url, inFrame] of [['subpasta', subSrv.url + 'jogo/', false], ['iframe', subSrv.url + 'host.html', true]]) {
        const rp = await browser.newPage({ viewport: size });
        const bad = [];
        const rerr = [];
        rp.on('requestfailed', r => bad.push('FAIL ' + r.url()));
        rp.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
        rp.on('pageerror', e => rerr.push('PAGEERROR ' + e.message));
        rp.on('console', m => { if (m.type() === 'error') rerr.push(m.text()); });
        const outside = [];
        rp.on('request', r => { const u = r.url(); if (u.startsWith(subSrv.url) && !u.startsWith(subSrv.url + 'jogo/') && !u.endsWith('host.html')) outside.push(u); });
        await rp.goto(url);
        await rp.waitForTimeout(1200);
        const frame = inFrame ? rp.frames().find(f => f.url().includes('/jogo/')) : rp.mainFrame();
        const ok = !!frame && await frame.evaluate(() => !!window.__hcDebug && document.fonts.status === 'loaded' &&
            !!document.querySelector('link[rel=stylesheet]').sheet);
        // Avança a cutscene (carrega as ilustrações por caminho relativo) e entra na Recepção.
        if (frame) {
            for (let k = 0; k < 6; k++) { await frame.evaluate(() => { const b = document.getElementById('btn-intro-next'); if (b && b.offsetParent) b.click(); }); await rp.waitForTimeout(250); }
        }
        const imgs = frame ? await frame.evaluate(() => window.GameIntro.getStatus()) : null;
        check(vp, 'Itch.io: jogo em ' + label + ' carrega CSS/fontes/scripts/imagens sem 404 e sem sair da pasta', ok && bad.length === 0 &&
            outside.length === 0 && rerr.length === 0 && Array.isArray(imgs) && imgs.slice(0, 3).every(x => x === 'loaded'), { bad, outside, rerr, imgs });
        await rp.close();
    }
    // ================= ETAPA 8: CARTAS DE BIOMA, NOVA CARTA DESCOBERTA E BESTIÁRIO DE CARTAS =================
    // Página nova com save limpo: nenhuma carta foi "descoberta" ainda (o modal de descoberta aparece de verdade).
    const np = await browser.newPage({ viewport: size });
    const nerr = [];
    np.on('console', m => { if (m.type() === 'error') nerr.push(m.text()); });
    np.on('pageerror', e => nerr.push('PAGEERROR ' + e.message));
    await np.addInitScript(() => { if (!localStorage.getItem('hc_ui_v1')) localStorage.setItem('hc_ui_v1', JSON.stringify({ introSeen: true })); });
    await np.goto(srv.url);
    await np.waitForTimeout(400);
    const nq = (fn, arg) => np.evaluate(fn, arg);
    const nOpen = () => nq(() => Array.from(document.querySelectorAll('.modal-overlay')).filter(m => !m.classList.contains('hidden')).map(m => m.id));
    const nFits = () => nq(() => {
        const d = document.documentElement;
        const box = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden) .modal-box')).pop();
        return d.scrollHeight <= innerHeight && d.scrollWidth <= innerWidth &&
            (!box || (box.getBoundingClientRect().bottom <= innerHeight + 1 && box.getBoundingClientRect().top >= -1));
    });
    await startDay(np);
    await np.waitForTimeout(300);
    await np.click('#btn-narrative-continue');
    await np.waitForTimeout(400);
    await np.locator('#arcana-modal .arcana-choice').first().click();
    await np.waitForTimeout(500);

    // --- Pool por Bioma: na Fase 1 só as exclusivas da Praia (a Assinatura não entra no pool) ---
    const pool1 = await nq(() => window.__hcDebug.levelUpPoolIds());
    check(vp, 'Bioma 1: Maré Alta e Ressaca no pool; Assinatura e cartas de outros biomas fora',
        pool1.includes('add_mare_alta') && pool1.includes('add_ressaca') && !pool1.includes('add_concha_eco') &&
        !pool1.some(id => ['add_bala_prata', 'add_manto_cacador', 'add_estilhaco_glacial', 'add_incinerar_arquivo', 'add_paradoxo_18h'].includes(id)), pool1.filter(id => /add_/.test(id)));

    // --- Fila única: Level Up -> NOVA CARTA DESCOBERTA! -> Gema, sem travar ---
    await nq(() => {
        const h = window.__hcDebug;
        h.forceLevelUp(['add_ressaca', 'add_mare_alta', 'garrafa_agua']);
        h.enqueueModal({ type: 'levelup' });
        h.enqueueModal({ type: 'gem', gemId: 'double' });
    });
    await np.waitForTimeout(400);
    const q0 = { open: await nOpen(), queue: await nq(() => window.__hcDebug.modalQueue) };
    await np.click('#reward-grid .reward-card[data-reward="add_mare_alta"]');
    await np.waitForTimeout(400);
    const disc = await nq(() => {
        const m = document.getElementById('discovery-modal');
        return {
            active: window.__hcDebug.activeModalType, card: m.dataset.card, queue: window.__hcDebug.modalQueue,
            title: document.getElementById('discovery-title').textContent,
            cells: m.querySelectorAll('.pat-row .pat-cell').length, hits: m.querySelectorAll('.pat-cell.hit').length,
            seal: m.querySelector('.cs-seal').textContent, keys: Array.from(m.querySelectorAll('.cs-keys dt')).map(d => d.textContent),
            tip: (m.querySelector('.cs-block:nth-of-type(3) p') || {}).textContent || '', focus: document.activeElement && document.activeElement.id,
            saved: JSON.parse(localStorage.getItem('hc_ui_v1')).discoveredCardTutorials
        };
    });
    check(vp, 'Descoberta: Level Up abre "NOVA CARTA DESCOBERTA!" antes da Gema (fila única)', q0.open.length === 1 && q0.open[0] === 'levelup-modal' &&
        disc.active === 'discovery' && disc.card === 'mare_alta' && JSON.stringify(disc.queue) === '["gem"]' &&
        JSON.stringify(await nOpen()) === '["discovery-modal"]', { q0, disc });
    check(vp, 'Descoberta: carta ampliada, selo do Bioma, mira 0..4, dica de combo, keywords e foco no Entendi!',
        /NOVA CARTA DESCOBERTA/.test(disc.title) && disc.cells === 5 && disc.hits === 3 && /PRAIA/.test(disc.seal) &&
        disc.keys.includes('Burn') && disc.keys.includes('Pierce') && /Ressaca/.test(disc.tip) && disc.focus === 'btn-discovery-ok' &&
        disc.saved.includes('mare_alta'), disc);
    check(vp, 'Descoberta: modal cabe na tela (rolagem só interna)', await nFits());
    await np.screenshot({ path: 'e2e-' + vp + '-descoberta.png' });
    await np.keyboard.press('Enter');
    await np.waitForTimeout(350);
    const afterDisc = { active: await nq(() => window.__hcDebug.activeModalType), open: await nOpen() };
    check(vp, 'Descoberta: Enter fecha limpo e a fila segue para a Gema', afterDisc.active === 'gem' && JSON.stringify(afterDisc.open) === '["gem-modal"]', afterDisc);
    await np.click('#btn-gem-discard');
    await np.waitForTimeout(400);
    check(vp, 'Descoberta: fila zera e o jogo volta à exploração', await nq(() => window.__hcDebug.state.mode === 'explore' &&
        window.__hcDebug.activeModalType === null && window.__hcDebug.modalQueue.length === 0) && (await nOpen()).length === 0);
    // Mesma carta de novo (outra cópia): nada de modal repetido. Esc também fecha.
    await nq(() => {
        const h = window.__hcDebug;
        h.forceLevelUp(['add_mare_alta', 'add_ressaca', 'garrafa_agua']);
        h.enqueueModal({ type: 'levelup' });
    });
    await np.waitForTimeout(350);
    await np.click('#reward-grid .reward-card[data-reward="add_mare_alta"]');
    await np.waitForTimeout(400);
    check(vp, 'Descoberta: não repete para carta já explicada', await nq(() => window.__hcDebug.activeModalType === null &&
        window.__hcDebug.state.deck.filter(id => id === 'mare_alta').length === 2));
    await nq(() => {
        const h = window.__hcDebug;
        h.forceLevelUp(['add_ressaca', 'garrafa_agua', 'reajuste_vr']);
        h.enqueueModal({ type: 'levelup' });
    });
    await np.waitForTimeout(350);
    await np.click('#reward-grid .reward-card[data-reward="add_ressaca"]');
    await np.waitForTimeout(400);
    const escOpen = await nq(() => window.__hcDebug.activeModalType);
    await np.keyboard.press('Escape');
    await np.waitForTimeout(350);
    check(vp, 'Descoberta: Esc também fecha e retoma o jogo', escOpen === 'discovery' && await nq(() => window.__hcDebug.activeModalType === null &&
        window.__hcDebug.state.mode === 'explore'), escOpen);

    // --- Baú: carta do Bioma com opção de RECUSAR (deck intacto) ---
    const deckBeforeChest = await nq(() => window.__hcDebug.state.deck.slice());
    await nq(() => {
        const rnd = Math.random;
        Math.random = () => 0.01;
        try { window.__hcDebug.grantChestLoot(); } finally { Math.random = rnd; }
        window.__hcDebug.processModals();
            });
    await np.waitForTimeout(400);
    const chestSeq = [];
    for (let i = 0; i < 12 && (await nOpen()).length > 0; i++) {
        const st8 = await nq(() => ({ t: window.__hcDebug.activeModalType, kind: document.getElementById('gem-modal').dataset.kind,
            cards: Array.from(document.querySelectorAll('#gem-targets .gem-target-card')).map(b => b.dataset.card) }));
        chestSeq.push(st8.t + (st8.t === 'pick' ? ':' + st8.kind + ':' + st8.cards.join('+') : ''));
        if (st8.t === 'discovery') await np.click('#btn-discovery-ok');
        else await np.click('#btn-gem-discard');
        await np.waitForTimeout(350);
    }
    const deckAfterChest = await nq(() => window.__hcDebug.state.deck.slice());
    check(vp, 'Baú: oferece carta exclusiva do Bioma e RECUSAR mantém o baralho', chestSeq.some(x => /^pick:biome:/.test(x) &&
        x.split(':')[2].split('+').every(id => ['mare_alta', 'ressaca'].includes(id))) &&
        deckAfterChest.filter(id => !['e_ampulheta', 'e_sino', 'e_saco_moedas', 'e_coracao'].includes(id)).length === deckBeforeChest.length, chestSeq);

    // --- Chefe do Bioma: Carta Assinatura garantida (1x por Fase) -> descoberta ---
    await nq(() => {
        const h = window.__hcDebug;
        const s = h.state;
        h.startEncounter(null, window.GameData.getFloorConfig(1).encounters['1']);
        s.enemies.forEach(e => { e.hp = 0; });
        s.bossDefeated = true;
        h.finishEncounter();
    });
    await np.waitForTimeout(1600);
    const sig = await nq(() => ({ t: window.__hcDebug.activeModalType, kind: document.getElementById('gem-modal').dataset.kind,
        cards: Array.from(document.querySelectorAll('#gem-targets .gem-target-card')).map(b => b.dataset.card),
        title: document.getElementById('gem-title').textContent, decline: document.getElementById('btn-gem-discard').textContent }));
    check(vp, 'Chefe: Carta Assinatura da Praia (Concha do Eco) garantida com RECUSAR', sig.t === 'pick' && sig.kind === 'signature' &&
        JSON.stringify(sig.cards) === '["concha_eco"]' && /ASSINATURA/.test(sig.title) && /RECUSAR/.test(sig.decline), sig);
    await np.click('#gem-targets .gem-target-card');
    await np.waitForTimeout(400);
    const sigDisc = await nq(() => ({ t: window.__hcDebug.activeModalType, card: document.getElementById('discovery-modal').dataset.card,
        seal: document.querySelector('#discovery-modal .cs-seal').textContent, recipe: document.getElementById('discovery-modal').textContent }));
    check(vp, 'Chefe: Assinatura aceita abre a descoberta com selo ASSINATURA e receita de fusão', sigDisc.t === 'discovery' && sigDisc.card === 'concha_eco' &&
        /ASSINATURA/.test(sigDisc.seal) && /Tsunami Escaldante/.test(sigDisc.recipe), sigDisc);
    await np.click('#btn-discovery-ok');
    await np.waitForTimeout(400);
    await nq(() => {
        const h = window.__hcDebug;
        h.startEncounter(null, window.GameData.getFloorConfig(1).encounters['1']);
        h.state.enemies.forEach(e => { e.hp = 0; });
        h.state.bossDefeated = true;
        h.finishEncounter();
    });
    await np.waitForTimeout(1600);
    check(vp, 'Chefe: Assinatura não se repete na mesma Fase', await nq(() => window.__hcDebug.activeModalType === null));

    // --- Troca de Bioma: baralho preservado integralmente; o pool muda para a Cidade ---
    const deckF1 = await nq(() => window.__hcDebug.state.deck.slice().sort().join(','));
    await nq(() => window.__hcDebug.loadFloor(2));
    await np.waitForTimeout(600);
    const f2 = await nq(() => ({ floor: window.__hcDebug.state.floor, deck: window.__hcDebug.state.deck.slice().sort().join(','),
        pool: window.__hcDebug.levelUpPoolIds() }));
    check(vp, 'Troca de Bioma: todas as cartas da Fase 1 continuam no baralho', f2.floor === 2 && f2.deck === deckF1 &&
        ['mare_alta', 'ressaca', 'concha_eco'].every(id => f2.deck.includes(id)), { deckF1, deck: f2.deck });
    check(vp, 'Bioma 2: pool troca para Bala de Prata/Manto; Nível MÁX da Praia segue para quem tem a carta',
        f2.pool.includes('add_bala_prata') && f2.pool.includes('add_manto_cacador') && !f2.pool.includes('add_mare_alta') &&
        f2.pool.includes('up_mare_alta') && f2.pool.includes('up_concha_eco'), f2.pool.filter(id => /add_|up_/.test(id)));

    // --- Metas da Etapa 8 com jogadas reais ---
    const arena8 = (hand, setup) => nq(([cards, su]) => {
        const h = window.__hcDebug;
        const s = h.state;
        h.startEncounter(null, window.GameData.getFloorConfig(1).encounters['1']);
        s.enemies.forEach(e => { e.hp = 999; e.maxHp = 999; e.atk = 1; e.hasIntent = true; e.kbResist = 0; e.frost = 0; e.shield = 0; });
        s.hand = cards.slice();
        s.handReturnCounts = cards.map(() => 0);
        s.handCostMods = cards.map(() => 0);
        s.handTemp = cards.map(() => false);
        s.mana = 20;
        s.busy = false;
        // allFront: todos os inimigos na linha de frente, um por coluna.
        if (su && su.allFront) s.enemies.forEach((e, i) => { e.row = 0; e.col = i % 5; });
        Object.assign(s, su || {});
        delete s.allFront;
    }, [hand, setup]);
    const play8 = async (id, rnd) => {
        await nq(([cid, r]) => {
            const h = window.__hcDebug;
            if (r !== undefined) { window.__rnd = Math.random; Math.random = () => r; }
            h.playCard(h.state.hand.indexOf(cid));
        }, [id, rnd]);
        await np.waitForFunction(() => !window.__hcDebug.state.busy, null, { timeout: 30000 });
        await nq(() => { if (window.__rnd) { Math.random = window.__rnd; window.__rnd = null; } });
    };
    const goals8 = () => nq(() => window.__hcDebug.meta.goals);
    await arena8(['ressaca'], { columnBurn: [40, 40, 40, 40, 40] });
    await play8('ressaca');
    check(vp, 'Metas: Piromaníaco (50+ de Burn numa luta) via Ressaca', (await goals8()).piromaniaco === true &&
        await nq(() => window.__hcDebug.state.fightBurnDmg >= 50));
    await arena8(['chicote_dados'], { kbBonus: 1, allFront: true });
    await play8('chicote_dados', 0);
    check(vp, 'Metas: Caçador Implacável (3 desarmes no turno)', (await goals8()).cacador_implacavel === true, await nq(() => window.__hcDebug.state.turnDisarms));
    await arena8(['bastiao_cristal'], { shield: 30 });
    await play8('bastiao_cristal');
    check(vp, 'Metas: Fortaleza Viva (35+ de dano de Escudo) via Bastião de Cristal', (await goals8()).fortaleza_viva === true,
        await nq(() => window.__hcDebug.state.turnShieldDmg));
    await arena8(['incinerar_arquivo', 'folha_presa', 'folha_presa', 'confusao', 'bomba_mana', 'cafeina_pura'], { handTemp: [false, false, false, false, false, true] });
    await play8('incinerar_arquivo');
    await play8('cafeina_pura');
    await play8('folha_presa');
    await play8('folha_presa');
    check(vp, 'Metas: Queima de Arquivo (4+ Destroy numa luta) com Incinerar Arquivo', (await goals8()).queima_arquivo === true,
        await nq(() => window.__hcDebug.state.fightDestroys));
    await arena8(['mordida_ferro'], { comboCount: 5, lastComboCost: 0, comboCarry: false, comboReverse: false });
    await play8('mordida_ferro');
    check(vp, 'Metas: Mestre do Paradoxo (Combo x7)', (await goals8()).mestre_paradoxo === true);
    await arena8(['paradoxo_18h', 'ponteiro_invertido'], {});
    const costs = await nq(() => {
        const h = window.__hcDebug;
        const s = h.state;
        const at = id => h.getHandCost(s.hand.indexOf(id));
        const out = [at('paradoxo_18h')];
        s.lastComboCost = 1;
        [0, 1, 2, 3, 6].forEach(c => { s.comboCount = c; out.push(at('paradoxo_18h')); });
        return out;
    });
    check(vp, 'Paradoxo das 18h: custo 4 sem cadeia; x2 -> 2, x3 -> 1, x4+ -> 0', JSON.stringify(costs) === '[4,3,2,1,0,0]', costs);
    // Viajante de Mundos: cartas de 3 biomas jogadas + vitória.
    await nq(() => { window.__hcDebug.state.biomesPlayed = [1, 2]; });
    await arena8(['nevasca_eterna'], {});
    await play8('nevasca_eterna');
    await nq(() => window.__hcDebug.endGame(true));
    await np.waitForTimeout(500);
    check(vp, 'Metas: Viajante de Mundos (vitória com cartas de 3 biomas)', await nq(() =>
        JSON.parse(localStorage.getItem('hc_meta_v1')).goals.viajante_mundos === true));
    for (let i = 0; i < 20 && (await nOpen()).length > 0; i++) {
        await nq(() => { const b = ['#btn-narrative-continue', '#btn-play-again'].map(q => document.querySelector(q)).find(x => x && x.offsetParent); if (b) b.click(); });
        await np.waitForTimeout(350);
    }
    await np.waitForTimeout(300);

    // --- Bestiário de Cartas na Coleção: filtros, silhuetas com dica e ficha ---
    await np.click('#btn-open-collection');
    await np.waitForTimeout(250);
    await nq(() => document.querySelector('#collection-tabs [data-tab="cartas"]').click());
    await np.waitForTimeout(150);
    const chips = await nq(() => Array.from(document.querySelectorAll('#collection-content .bf-chip')).map(b => b.textContent));
    check(vp, 'Bestiário: filtros Todas/Base/Praia/Cidade/Neve/Dungeon/Abismo/Evoluções',
        JSON.stringify(chips) === '["Todas","Base","Praia","Cidade","Neve","Dungeon","Abismo","Evoluções"]', chips);
    const byFilter = {};
    for (const f of ['praia', 'cidade', 'evolucoes']) {
        await nq(fl => document.querySelector('#collection-content .bf-chip[data-filter="' + fl + '"]').click(), f);
        await np.waitForTimeout(120);
        byFilter[f] = await nq(() => Array.from(document.querySelectorAll('#collection-content .card-tile')).map(t => ({
            card: t.dataset.card, locked: t.classList.contains('locked'), name: t.querySelector('b').textContent, hint: t.querySelector('small').textContent })));
    }
    const lockedBala = byFilter.cidade.find(t => t.card === 'bala_prata');
    const lockedSino = byFilter.cidade.find(t => t.card === 'sino_vigia');
    check(vp, 'Bestiário: Praia descoberta; Cidade em silhueta ??? com dica do Bioma/Chefe',
        byFilter.praia.length === 3 && byFilter.praia.every(t => !t.locked) &&
        lockedBala && lockedBala.locked && lockedBala.name === '???' && /Cidade Gótica/.test(lockedBala.hint) &&
        lockedSino && /Assinatura: derrote Mensageiro/.test(lockedSino.hint) &&
        ['tsunami_escaldante', 'execucao_lunar', 'glaciar_absoluto'].every(id => byFilter.evolucoes.some(t => t.card === id)), { byFilter });
    await nq(() => document.querySelector('#collection-content .bf-chip[data-filter="praia"]').click());
    await np.waitForTimeout(120);
    await np.click('#collection-content .card-tile[data-card="mare_alta"]');
    await np.waitForTimeout(200);
    const sheet = await nq(() => {
        const c = document.getElementById('collection-content');
        return { sheet: c.dataset.sheet, cells: c.querySelectorAll('.pat-cell').length, text: c.textContent };
    });
    check(vp, 'Bestiário: tocar numa carta descoberta abre a ficha (mira, papel, combo e receita)', sheet.sheet === 'mare_alta' && sheet.cells === 5 &&
        /Papel tático/i.test(sheet.text) && /Dica de combo/i.test(sheet.text) && /Funde com Concha do Eco/.test(sheet.text) && await nFits(), sheet.sheet);
    await np.screenshot({ path: 'e2e-' + vp + '-bestiario.png' });
    await np.click('#collection-content .sheet-back');
    await np.waitForTimeout(150);
    check(vp, 'Bestiário: VOLTAR retorna à lista no mesmo filtro', await nq(() => document.getElementById('collection-content').dataset.filter === 'praia' &&
        !!document.querySelector('#collection-content .card-tile')));
    await np.click('#btn-collection-close');
    await np.waitForTimeout(150);
    // Manual "?": aba Cartas com o mesmo Bestiário.
    await np.click('#btn-title-codex');
    await np.waitForTimeout(250);
    await np.click('.codex-tab[data-tab="cartas"]');
    await np.waitForTimeout(150);
    const codexCards = await nq(() => ({ chips: document.querySelectorAll('#codex-content .bf-chip').length,
        tiles: document.querySelectorAll('#codex-content .card-tile').length, unlocked: document.querySelectorAll('#codex-content .card-tile:not(.locked)').length }));
    await np.click('#codex-content .card-tile[data-card="ressaca"]');
    await np.waitForTimeout(150);
    check(vp, 'Manual "?": aba Cartas com filtros e ficha da carta', codexCards.chips === 8 && codexCards.tiles > 60 && codexCards.unlocked > 5 &&
        await nq(() => !!document.querySelector('#codex-content .card-sheet[data-card="ressaca"]')) && await nFits(), codexCards);
    await np.keyboard.press('Escape');
    await np.waitForTimeout(150);
    check(vp, 'Etapa8: 0 erros no console e 0 overflow', nerr.length === 0 && await nFits(), nerr.slice(0, 4));
    await np.close();
    // ================= ETAPA 9: 3 PARTES POR BIOMA, PORTAIS E, AUTO-SAVE E CONTINUAR EXPEDIENTE =================
    const sp = await browser.newPage({ viewport: size });
    const serr = [];
    sp.on('console', m => { if (m.type() === 'error') serr.push(m.text()); });
    sp.on('pageerror', e => serr.push('PAGEERROR ' + e.message));
    await sp.addInitScript(ui => { if (!localStorage.getItem('hc_ui_v1')) localStorage.setItem('hc_ui_v1', ui); }, UI_SEEN);
    await sp.goto(srv.url);
    await sp.waitForTimeout(400);
    const sq = (fn, arg) => sp.evaluate(fn, arg);
    const sOpen = () => sq(() => Array.from(document.querySelectorAll('.modal-overlay')).filter(m => !m.classList.contains('hidden')).map(m => m.id));
    const sFits = () => sq(() => {
        const d = document.documentElement;
        const box = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden) .modal-box')).pop();
        return d.scrollHeight <= innerHeight && d.scrollWidth <= innerWidth && (!box || box.getBoundingClientRect().bottom <= innerHeight + 1);
    });
    const hud9 = () => sq(() => {
        const h = window.__hcDebug;
        const L = h.getFloor().layout;
        return {
            floor: document.getElementById('stat-floor').textContent, sector: document.getElementById('stat-sector').textContent,
            clock: document.getElementById('clock-time').textContent, part: h.state.part, biome: h.state.floor, size: L.length,
            B: L.join('').includes('B'), E: L.join('').includes('E'), atm: h.getAtmosphere(), mode: h.state.mode,
            toast: document.getElementById('sector-toast').classList.contains('hidden') ? '' : document.getElementById('sector-toast').textContent,
            saved: (JSON.parse(localStorage.getItem('hc_active_run_v1') || 'null') || {}).summary || null
        };
    });
    // Anda até um tile de verdade: desliga o aggro, para ao lado dele, encara e dá 1 passo.
    const stepOnto = ch => sq(c => {
        const h = window.__hcDebug;
        const s = h.state;
        const L = h.getFloor().layout;
        let t = null;
        L.forEach((row, y) => { const x = row.indexOf(c); if (x >= 0) t = { x, y }; });
        if (!t) return false;
        s.encounters.forEach(e => { e.alive = false; });
        const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        for (let d = 0; d < 4; d++) {
            const x = t.x - DIRS[d][0];
            const y = t.y - DIRS[d][1];
            if (!L[y] || L[y][x] !== '.') continue;
            s.player.x = x;
            s.player.y = y;
            const turns = (d - s.player.dir + 4) % 4;
            if (turns === 0) { h.turnPlayer(1); h.turnPlayer(-1); }
            for (let i = 0; i < turns; i++) h.turnPlayer(1);
            return true;
        }
        return false;
    }, ch);
    const walk = async () => {
        await sp.waitForTimeout(400);
        await sq(() => window.__hcDebug.moveRelative(1, 0));
        await sp.waitForTimeout(700);
    };

    check(vp, 'Etapa9: Recepção sem run salva mostra só o início normal', await sq(() =>
        document.getElementById('continue-row').classList.contains('hidden') && /BATER PONTO/.test(document.getElementById('btn-start-daydream').textContent)));
    await startDay(sp);
    await sp.waitForTimeout(300);
    await sp.click('#btn-narrative-continue');
    await sp.waitForTimeout(400);
    await sp.locator('#arcana-modal .arcana-choice').first().click();
    await sp.waitForTimeout(600);
    const q1 = await hud9();
    check(vp, 'Parte 1/3: HUD "PRAIA · PARTE 1/3 — ARREBENTAÇÃO", 08:17, portal E e sem chefe', q1.floor === 'PRAIA · PARTE 1/3' &&
        q1.sector === 'ARREBENTAÇÃO' && q1.clock === '08:17' && q1.E && !q1.B && q1.size === 11, q1);
    check(vp, 'Auto-save: run gravada ao fechar os modais iniciais', !!q1.saved && q1.saved.floor === 1 && q1.saved.part === 1, q1.saved);
    const deckP1 = await sq(() => window.__hcDebug.state.deck.join(','));
    check(vp, 'Portal: chega ao E da Parte 1', await stepOnto('E'));
    await walk();
    const q2 = await hud9();
    const p2open = await sOpen();
    check(vp, 'Portal 1->2: transição rápida (toast de 1 linha, sem card narrativo nem modal)', q2.part === 2 && q2.floor === 'PRAIA · PARTE 2/3' &&
        q2.sector === 'MARÉ CRESCENTE' && q2.clock === '09:05' && /MARÉ CRESCENTE/.test(q2.toast) && p2open.length === 0 && q2.mode === 'explore', { q2, p2open });
    check(vp, 'Parte 2/3: Elite, Ponto de Pausa e evento especial no mapa', await sq(() => {
        const L = window.__hcDebug.getFloor().layout.join('');
        return L.includes('L') && L.includes('M') && /[WPO]/.test(L) && !L.includes('B');
    }));
    check(vp, 'Auto-save: troca de Parte grava Parte 2', q2.saved && q2.saved.part === 2, q2.saved);
    await sp.screenshot({ path: 'e2e-' + vp + '-parte2.png' });
    check(vp, 'Portal: chega ao E da Parte 2', await stepOnto('E'));
    await walk();
    const q3 = await hud9();
    check(vp, 'Portal 2->3: Domínio do Chefe (mapa 9x9, chefe B, 09:50) e baralho intacto', q3.part === 3 && q3.floor === 'PRAIA · PARTE 3/3' &&
        q3.sector === 'COVIL DAS MARÉS' && q3.clock === '09:50' && q3.B && q3.size === 9 &&
        await sq(() => window.__hcDebug.state.deck.join(',')) === deckP1, q3);
    check(vp, 'Atmosfera: neblina mais densa e luz mais baixa a cada Parte', q1.atm.part === 1 && q2.atm.part === 2 && q3.atm.part === 3 &&
        q1.atm.fog[2] > q2.atm.fog[2] && q2.atm.fog[2] > q3.atm.fog[2] && q1.atm.ambient > q3.atm.ambient, [q1.atm, q2.atm, q3.atm]);
    check(vp, 'HUD da Parte cabe na tela (0 overflow)', await sFits() && await sq(() =>
        document.querySelector('.vp-top-lv').getBoundingClientRect().right <= document.querySelector('.vp-top-stats').getBoundingClientRect().left + 1));
    await sp.screenshot({ path: 'e2e-' + vp + '-parte3.png' });

    // --- Auto-save + recarregar a página + CONTINUAR EXPEDIENTE ---
    const before9 = await sq(() => {
        const s = window.__hcDebug.state;
        s.hp = Math.max(1, s.hp - 7);
        s.vr += 33;
        window.__hcDebug.saveActiveRun('teste');
        return { deck: s.deck.join(','), hp: s.hp, vr: s.vr, lv: s.level, x: s.player.x, y: s.player.y, seed: s.runSeed,
            enc: s.encounters.map(e => e.id + ':' + e.alive).join(','), cleared: Array.from(s.clearedTiles).sort().join(';') };
    });
    await sp.reload();
    await sp.waitForTimeout(700);
    const title9 = await sq(() => ({ cont: !document.getElementById('continue-row').classList.contains('hidden'),
        info: document.getElementById('continue-info').textContent, start: document.getElementById('btn-start-daydream').textContent }));
    check(vp, 'Recepção: CONTINUAR EXPEDIENTE com Bioma, Parte, Nível e Sanidade + NOVO EXPEDIENTE', title9.cont &&
        title9.info.includes('PRAIA 3/3') && title9.info.includes('Covil das Marés') && title9.info.includes('LV ' + before9.lv) &&
        title9.info.includes(before9.hp + '/') && title9.start === 'NOVO EXPEDIENTE', title9);
    check(vp, 'Recepção com run salva cabe na tela', await sFits());
    await sp.screenshot({ path: 'e2e-' + vp + '-continuar.png' });
    await sp.click('#btn-continue-run');
    await sp.waitForTimeout(800);
    const after9 = await sq(() => {
        const s = window.__hcDebug.state;
        return { deck: s.deck.join(','), hp: s.hp, vr: s.vr, lv: s.level, x: s.player.x, y: s.player.y, seed: s.runSeed,
            enc: s.encounters.map(e => e.id + ':' + e.alive).join(','), cleared: Array.from(s.clearedTiles).sort().join(';'),
            part: s.part, mode: s.mode, title: !document.getElementById('title-modal').classList.contains('hidden'),
            hud: document.getElementById('stat-floor').textContent };
    });
    check(vp, 'Continuar: restaura a run exata (baralho, Sanidade, VR, posição, encontros, Parte 3/3)', after9.deck === before9.deck &&
        after9.hp === before9.hp && after9.vr === before9.vr && after9.x === before9.x && after9.y === before9.y && after9.seed === before9.seed &&
        after9.enc === before9.enc && after9.cleared === before9.cleared && after9.part === 3 && after9.mode === 'explore' && !after9.title &&
        after9.hud === 'PRAIA · PARTE 3/3', { before9, after9 });

    // --- Chefe da Parte 3 -> card narrativo só ao entrar no novo Bioma (Parte 1/3) ---
    await sq(() => {
        const h = window.__hcDebug;
        const bossEnc = h.state.encounters.find(e => e.isBoss);
        h.startEncounter(bossEnc.id, bossEnc.enc);
        h.state.enemies.forEach(e => { e.hp = 0; });
        h.state.bossDefeated = true;
        h.finishEncounter();
    });
    await sp.waitForTimeout(1600);
    for (let i = 0; i < 6 && (await sOpen()).length > 0; i++) {
        await sq(() => { const b = ['#btn-discovery-ok', '#btn-gem-discard'].map(q => document.querySelector(q)).find(x => x && x.offsetParent); if (b) b.click(); });
        await sp.waitForTimeout(400);
    }
    check(vp, 'Chefe: saída E da Parte 3 leva ao próximo Bioma', await stepOnto('E'));
    await walk();
    const cards9 = [];
    for (let i = 0; i < 6 && (await sOpen()).includes('narrative-modal'); i++) {
        cards9.push(await sq(() => document.getElementById('narrative-tag').textContent));
        await sp.click('#btn-narrative-continue');
        await sp.waitForTimeout(500);
    }
    const bio2 = await hud9();
    check(vp, 'Novo Bioma: card ilustrado + Cidade Parte 1/3 (10:40) e save do Bioma novo', cards9.length >= 2 && bio2.biome === 2 && bio2.part === 1 &&
        bio2.floor === 'CIDADE · PARTE 1/3' && bio2.clock === '10:40' && bio2.saved && bio2.saved.floor === 2 && bio2.saved.part === 1, { cards9, bio2 });

    // --- NOVO EXPEDIENTE pede confirmação antes de sobrescrever ---
    await sp.reload();
    await sp.waitForTimeout(700);
    await sp.click('#btn-start-daydream');
    await sp.waitForTimeout(200);
    const armed9 = await sq(() => ({ confirming: document.getElementById('btn-start-daydream').classList.contains('confirming'),
        text: document.getElementById('btn-start-daydream').textContent, title: !document.getElementById('title-modal').classList.contains('hidden'),
        saved: !!localStorage.getItem('hc_active_run_v1') }));
    check(vp, 'Novo Expediente: 1º toque só pede confirmação (run salva intacta)', armed9.confirming && /SOBRESCREVER/.test(armed9.text) && armed9.title && armed9.saved, armed9);
    await sp.click('#btn-start-daydream');
    await sp.waitForTimeout(400);
    await sp.click('#btn-narrative-continue');
    await sp.waitForTimeout(400);
    await sp.locator('#arcana-modal .arcana-choice').first().click();
    await sp.waitForTimeout(600);
    check(vp, 'Novo Expediente: 2º toque começa do zero e a nova run passa a ser a salva', await sq(() => {
        const sv = JSON.parse(localStorage.getItem('hc_active_run_v1') || 'null');
        return window.__hcDebug.state.floor === 1 && window.__hcDebug.state.part === 1 && sv && sv.summary.floor === 1 && sv.summary.part === 1;
    }));

    // --- DESISTIR (Manual "?") encerra como Burnout e limpa o save ---
    await sp.click('#btn-codex');
    await sp.waitForTimeout(250);
    const abandonVis = await sq(() => !document.getElementById('btn-abandon-run').classList.contains('hidden'));
    await sp.click('#btn-abandon-run');
    await sp.waitForTimeout(150);
    const stillSaved = await sq(() => !!localStorage.getItem('hc_active_run_v1') && document.getElementById('btn-abandon-run').classList.contains('confirming'));
    await sp.click('#btn-abandon-run');
    await sp.waitForTimeout(600);
    check(vp, 'Desistir: pede confirmação, encerra a run e apaga o save', abandonVis && stillSaved && await sq(() =>
        !localStorage.getItem('hc_active_run_v1') && !document.getElementById('end-modal').classList.contains('hidden')));
    await sp.click('#btn-play-again');
    await sp.waitForTimeout(500);
    check(vp, 'Depois do Burnout a Recepção não oferece Continuar', await sq(() => document.getElementById('continue-row').classList.contains('hidden')));

    // --- Vitória às 18:00 limpa o save; o Tutorial nunca grava ---
    await startDay(sp);
    await sp.waitForTimeout(300);
    await sp.click('#btn-narrative-continue');
    await sp.waitForTimeout(400);
    await sp.locator('#arcana-modal .arcana-choice').first().click();
    await sp.waitForTimeout(600);
    const hadSave = await sq(() => !!localStorage.getItem('hc_active_run_v1'));
    await sq(() => window.__hcDebug.endGame(true));
    await sp.waitForTimeout(500);
    check(vp, 'Vitória limpa a run salva', hadSave && await sq(() => !localStorage.getItem('hc_active_run_v1')));
    for (let i = 0; i < 20 && (await sOpen()).length > 0; i++) {
        await sq(() => { const b = ['#btn-narrative-continue', '#btn-play-again'].map(q => document.querySelector(q)).find(x => x && x.offsetParent); if (b) b.click(); });
        await sp.waitForTimeout(350);
    }
    await sp.waitForTimeout(300);
    await sq(() => window.__hcDebug.startTutorial());
    await sp.waitForTimeout(600);
    check(vp, 'Tutorial nunca grava run ativa', await sq(() => window.__hcDebug.saveActiveRun('teste') === false && !localStorage.getItem('hc_active_run_v1')));
    // Save corrompido: a Recepção ignora sem erro.
    await sq(() => localStorage.setItem('hc_active_run_v1', '{"v":1,"state":{"floor":99,"deck":["nao_existe"]}}'));
    await sp.reload();
    await sp.waitForTimeout(600);
    check(vp, 'Save de run corrompido é ignorado sem erro', await sq(() => document.getElementById('continue-row').classList.contains('hidden')));
    if (vp === 'mobile') {
        await sq(() => localStorage.removeItem('hc_active_run_v1'));
        await startDay(sp);
        await sp.waitForTimeout(300);
        await sp.click('#btn-narrative-continue');
        await sp.waitForTimeout(400);
        await sp.locator('#arcana-modal .arcana-choice').first().click();
        await sp.waitForTimeout(600);
        await sp.setViewportSize({ width: 375, height: 667 });
        await sp.reload();
        await sp.waitForTimeout(700);
        check(vp, 'Recepção 375x667 com CONTINUAR EXPEDIENTE: sem overflow', await sq(() =>
            !document.getElementById('continue-row').classList.contains('hidden')) && await sFits());
    }
    check(vp, 'Etapa9: 0 erros no console', serr.length === 0, serr.slice(0, 4));
    await sp.close();
}
await browser.close();
srv.close();
subSrv.close();
fs.rmSync(subRoot, { recursive: true, force: true });
console.log(failed === 0 ? 'TUDO OK' : 'FALHAS: ' + failed);
process.exit(failed ? 1 : 0);

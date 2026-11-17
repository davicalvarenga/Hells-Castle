// Testes headless: combo, gemas, arcanas, overkill, fila de modais e erros de console (Etapa 2) +
// arsenal completo, gemas avançadas, rachadura e eventos de mapa (Etapa 4).
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
        await mp.click('#btn-start-daydream');
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
        afterWin.credits === 600 && await mq(() => /HORA EXTRA INFINITA/.test(document.getElementById('end-meta').textContent)));
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
}
await browser.close();
srv.close();
console.log(failed === 0 ? 'TUDO OK' : 'FALHAS: ' + failed);
process.exit(failed ? 1 : 0);

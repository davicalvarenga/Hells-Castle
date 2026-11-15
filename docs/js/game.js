// Lógica principal: Valter Motta sozinho por 5 biomas de devaneio, fila única de modais,
// Ponto de Pausa, cards narrativos, patrulha/aggro, combate por cartas e epílogo.
(function () {
    'use strict';

    const D = window.GameData;
    const R = window.GameRenderer;
    const S = window.GameSprites;
    const A = window.GameAudio;
    const B = D.BALANCE;

    const DIR_DX = [0, 1, 0, -1];
    const DIR_DY = [-1, 0, 1, 0];

    const $ = id => document.getElementById(id);
    const els = {
        xpTrack: $('xp-track'),
        xpFill: $('xp-fill'),
        statHero: $('stat-hero'),
        statLv: $('stat-lv'),
        statFloor: $('stat-floor'),
        statKills: $('stat-kills'),
        statVr: $('stat-vr'),
        statMight: $('stat-might'),
        statAmount: $('stat-amount'),
        statArea: $('stat-area'),
        statLuck: $('stat-luck'),
        statGrowth: $('stat-growth'),
        statExtra: $('stat-extra'),
        clockTime: $('clock-time'),
        hpText: $('hp-text'),
        shieldBadge: $('shield-badge'),
        shieldVal: $('shield-val'),
        manaText: $('mana-text'),
        manaSub: $('mana-sub'),
        passivesStrip: $('passives-strip'),
        btnBossKey: $('btn-boss-key'),
        btnMute: $('btn-mute'),
        iconSoundOn: $('icon-sound-on'),
        iconSoundOff: $('icon-sound-off'),
        btnRestart: $('btn-restart'),
        viewport: $('viewport'),
        glCanvas: $('gl-canvas'),
        hudCanvas: $('hud-canvas'),
        miniCanvas: $('minimap-canvas'),
        comboBadge: $('combo-badge'),
        comboNum: $('combo-num'),
        comboBonus: $('combo-bonus'),
        comboChain: $('combo-chain'),
        comboChainCards: $('combo-chain-cards'),
        pileCounts: $('pile-counts'),
        overkillBanner: $('overkill-banner'),
        evolutionBanner: $('evolution-banner'),
        ambushBanner: $('ambush-banner'),
        logText: $('log-text'),
        explorePanel: $('explore-panel'),
        combatPanel: $('combat-panel'),
        handGrid: $('hand-grid'),
        btnTurnLeft: $('btn-turn-left'),
        btnMoveFwd: $('btn-move-fwd'),
        btnTurnRight: $('btn-turn-right'),
        btnStrafeLeft: $('btn-strafe-left'),
        btnMoveBack: $('btn-move-back'),
        btnStrafeRight: $('btn-strafe-right'),
        btnPlayAll: $('btn-play-all'),
        btnEndTurn: $('btn-end-turn'),
        xpParticlesLayer: $('xp-particles-layer'),
        titleModal: $('title-modal'),
        badgeSelectGrid: $('badge-select-grid'),
        btnStartDaydream: $('btn-start-daydream'),
        spreadsheetModal: $('spreadsheet-modal'),
        btnCloseSpreadsheet: $('btn-close-spreadsheet'),
        levelupModal: $('levelup-modal'),
        levelupCount: $('levelup-count'),
        levelupSubtitle: $('levelup-subtitle'),
        rewardGrid: $('reward-grid'),
        btnLvlReroll: $('btn-lvl-reroll'),
        btnLvlSkip: $('btn-lvl-skip'),
        btnLvlBanish: $('btn-lvl-banish'),
        gemModal: $('gem-modal'),
        gemTitle: $('gem-title'),
        gemDesc: $('gem-desc'),
        gemTargets: $('gem-targets'),
        btnGemDiscard: $('btn-gem-discard'),
        arcanaModal: $('arcana-modal'),
        arcanaChoices: $('arcana-choices'),
        restModal: $('rest-modal'),
        restTitle: $('rest-title'),
        restDesc: $('rest-desc'),
        restVrVal: $('rest-vr-val'),
        restItemsGrid: $('rest-items-grid'),
        btnRestClose: $('btn-rest-close'),
        eventModal: $('event-modal'),
        eventTitle: $('event-title'),
        eventDesc: $('event-desc'),
        eventChoices: $('event-choices'),
        narrativeModal: $('narrative-modal'),
        narrativeTag: $('narrative-tag'),
        narrativeTitle: $('narrative-title'),
        narrativeLines: $('narrative-lines'),
        btnNarrativeContinue: $('btn-narrative-continue'),
        epilogueOverlay: $('epilogue-overlay'),
        epilogueTitle: $('epilogue-title'),
        epilogueLines: $('epilogue-lines'),
        btnPunchClock: $('btn-punch-clock'),
        endModal: $('end-modal'),
        endBox: $('end-box'),
        endTitle: $('end-title'),
        endDesc: $('end-desc'),
        endStats: $('end-stats'),
        btnPlayAgain: $('btn-play-again')
    };

    let state = null;
    let bossKeyOpen = false;
    let uidCounter = 1;
    let chestIndex = 0;
    let eventIndex = 0;
    let logHideTimer = null;
    let realityTimer = null;
    let realityQuipIdx = 0;

    // ---------- FILA ÚNICA DE MODAIS ----------
    // Nunca há dois modais abertos: tudo (level up, pausa, evento, narrativa, epílogo) entra
    // em modalQueue e processModalQueue() só abre o próximo quando activeModal === null.
    let modalQueue = [];
    let activeModal = null;
    let modalActionLocked = false;

    function shuffle(arr) {
        const copy = arr.slice();
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
        }
        return copy;
    }

    // Seed da run: ?seed=N vale para a primeira run da página (reproduzível); reiniciar sorteia outra.
    let urlSeedUsed = false;
    function pickRunSeed() {
        const fromUrl = urlSeedUsed ? 0 : Number(new URLSearchParams(window.location.search).get('seed'));
        urlSeedUsed = true;
        if (fromUrl > 0) return Math.floor(fromUrl);
        return window.GameDungeon ? window.GameDungeon.randomSeed() : Math.floor(Math.random() * 1e9);
    }

    // Andar procedural (DungeonGenerator). Sem gerador ou com geração inválida, vale o layout base.
    function generateRunFloor(run, floorNum) {
        const base = D.getFloorConfig(floorNum);
        const G = window.GameDungeon;
        if (!G || !base) return base;
        const pool = D.getEnemyPool(base.floor);
        const baseSeed = G.floorSeed(run.runSeed, base.floor);
        for (let attempt = 0; attempt < 6; attempt++) {
            try {
                const fl = G.generateFloor(base, {
                    seed: baseSeed + attempt,
                    size: 11,
                    enemyPool: pool.common,
                    bossKind: pool.boss,
                    eliteKind: pool.common[2],
                    enemyStats: kind => ({ hp: D.ENEMIES[kind].hp, atk: D.ENEMIES[kind].atk }),
                    enemyNames: kind => D.ENEMIES[kind].name
                });
                if (fl && G.validateGeneratedFloor(fl).length === 0) return fl;
            } catch (err) {
                console.warn('Gerador de mapa falhou (tentativa ' + attempt + '):', err);
            }
        }
        return base;
    }

    function runFloor(run, floorNum) {
        if (!run.floors[floorNum]) run.floors[floorNum] = generateRunFloor(run, floorNum);
        return run.floors[floorNum];
    }

    function currentFloor() {
        return runFloor(state, state.floor);
    }

    function isTitleOpen() {
        return !!(els.titleModal && !els.titleModal.classList.contains('hidden'));
    }

    // Agenda uma etapa; é descartada se o jogo foi reiniciado nesse meio tempo.
    function later(ms, fn) {
        const owner = state;
        setTimeout(() => {
            if (state !== owner) return;
            fn();
        }, ms);
    }

    // Encontros são entidades móveis no mapa (patrulha), em vez de tiles fixos.
    function buildEncounters(fl) {
        const list = [];
        for (let y = 0; y < fl.layout.length; y++) {
            for (let x = 0; x < fl.layout[y].length; x++) {
                const enc = fl.encounters[fl.layout[y][x]];
                if (!enc) continue;
                // Nunca nasce em parede/fora do mapa nem empilhado com outro encontro
                if (!D.isWalkableTile(fl.layout, x, y) || list.some(e => e.x === x && e.y === y)) continue;
                list.push({
                    id: 'enc_' + fl.floor + '_' + fl.layout[y][x],
                    x: x,
                    y: y,
                    enc: enc,
                    isBoss: !!enc.isBoss,
                    isElite: !!enc.isElite,
                    alive: true
                });
            }
        }
        return list;
    }

    function encounterAt(x, y) {
        return state.encounters.find(e => e.alive && e.x === x && e.y === y) || null;
    }

    // Mapas gerados podem pôr o início colado numa parede: o jogador nasce olhando o corredor mais longo.
    function openestDir(layout, x, y) {
        const run = d => {
            let n = 0;
            while (D.isWalkableTile(layout, x + DIR_DX[d] * (n + 1), y + DIR_DY[d] * (n + 1))) n++;
            return n;
        };
        return [0, 1, 3, 2].reduce((best, d) => (run(d) > run(best) ? d : best), 0);
    }

    function findStartPos(layout) {
        for (let y = 0; y < layout.length; y++) {
            const x = layout[y].indexOf('S');
            if (x >= 0) return { x: x, y: y, dir: openestDir(layout, x, y) };
        }
        return { x: 4, y: 7 };
    }

    function createInitialState() {
        const run = { runSeed: pickRunSeed(), floors: {} };
        const fl = runFloor(run, 1);
        const start = findStartPos(fl.layout);
        const hero = D.CHARACTERS[0];
        uidCounter = 1;
        chestIndex = 0;
        eventIndex = 0;
        const s = {
            mode: 'explore',
            busy: false,
            autoPlaying: false,
            heroName: hero.name,
            heroTitle: hero.title,
            turn1Shield: hero.turn1Shield || 0,
            floor: 1,
            runSeed: run.runSeed,
            floors: run.floors,
            curse: 0,
            revival: 0,
            player: { x: start.x, y: start.y, dir: start.dir || 0 },
            hp: hero.maxHp,
            maxHp: hero.maxHp,
            mana: B.baseMana,
            maxMana: B.baseMana,
            dealCount: B.dealCount,
            manaDrain: 0,
            shield: 0,
            xp: 0,
            xpNext: D.getXpForLevel(1),
            level: 1,
            vr: 0,
            combo: 1,
            comboCount: 0,
            lastComboCost: null,
            stats: { Might: 0, Amount: 0, Area: 0, Luck: 0, Growth: 0, Freeze: 0, Recovery: 0, Duration: 0 },
            healPerCombat: 0,
            relics: [],
            specialRelics: [],
            takenRewards: [],
            banishedIds: [],
            rerollsLeft: 3,
            skipsLeft: 5,
            banishesLeft: 2,
            banishMode: false,
            restUsed: {},
            passives: [{ label: 'Crachá: ' + hero.name + ' (' + hero.role + ')', icon: hero.icon }],
            cardLevels: {},
            evolvedCards: {},
            deck: D.STARTING_DECK.slice(),
            drawPile: [],
            hand: [],
            handReturnCounts: [],
            handCostMods: [],
            comboPile: [],
            comboChain: [],
            combatBuff: { Might: 0, Area: 0, Amount: 0 },
            manaBombTicks: 0,
            extraBreath: false,
            // shortcut: gemas por cardId (cópias compartilham); migrar para instâncias de carta se cópias precisarem divergir
            cardGems: {},
            arcana: null,
            comboReverse: false,   // a última carta jogada tinha Combo Reverso
            comboCarry: false,     // a 1ª carta do turno continua a cadeia (Elo da Corrente / Fluxo e Combo)
            fluxoPity: false,
            discardPile: [],
            destroyedPile: [],
            enemies: [],
            columnBurn: [0, 0, 0, 0, 0],
            targetUid: null,
            currentEncounterId: null,
            encounters: buildEncounters(fl),
            steps: 0,
            bossDefeated: false,
            bossOverkillActive: false,
            finalVictory: false,
            kills: 0,
            overkills: 0,
            pendingLevelUps: 0,
            exploredTiles: new Set(),
            clearedTiles: new Set()
        };
        revealAround(s, start.x, start.y, fl.layout);
        return s;
    }

    function revealAround(s, px, py, layout) {
        const map = layout || runFloor(s, s.floor).layout;
        for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
                const nx = px + dx;
                const ny = py + dy;
                if (ny >= 0 && ny < map.length && nx >= 0 && nx < map[0].length) {
                    s.exploredTiles.add(nx + ',' + ny);
                }
            }
        }
    }

    function loadFloor(floorNum) {
        const fl = runFloor(state, floorNum);
        const start = findStartPos(fl.layout);
        state.floor = fl.floor;
        state.player.x = start.x;
        state.player.y = start.y;
        state.player.dir = start.dir || 0;
        state.bossDefeated = false;
        state.exploredTiles = new Set();
        state.clearedTiles = new Set();
        state.encounters = buildEncounters(fl);
        state.steps = 0;
        revealAround(state, start.x, start.y, fl.layout);

        R.setHoveredCard(null);
        R.buildMap(fl.layout, state);
        R.syncState(state);
        A.play('levelup');
        A.setAmbience(fl.biome);
        document.body.classList.remove('daydream-transition');
        void document.body.offsetWidth;
        document.body.classList.add('daydream-transition');
        setTimeout(() => document.body.classList.remove('daydream-transition'), 720);
        setLog('Fase ' + fl.floor + '/' + D.FLOORS.length + ': ' + fl.name + ' — Chefe: ' + fl.bossName + '!');
        renderAll();
    }

    function setLog(msg) {
        els.logText.textContent = msg;
        els.logText.classList.remove('toast-hidden');
        if (logHideTimer) clearTimeout(logHideTimer);
        logHideTimer = setTimeout(() => {
            els.logText.classList.add('toast-hidden');
        }, 3400);
    }

    function triggerRealityFlash(customMsg) {
        els.viewport.classList.remove('reality-flash');
        void els.viewport.offsetWidth;
        els.viewport.classList.add('reality-flash');
        if (realityTimer) clearTimeout(realityTimer);
        realityTimer = setTimeout(() => {
            els.viewport.classList.remove('reality-flash');
        }, 200);
        R.triggerScreenFlash('#d8f6ff', 0.42, 0.18);
        const quips = D.REALITY_FLASH_QUIPS || [];
        setLog(customMsg || quips[(realityQuipIdx++) % quips.length]);
    }

    function spawnFloatingText(screenX, screenY, text, extraClass) {
        const vpRect = els.viewport.getBoundingClientRect();
        const div = document.createElement('div');
        div.className = 'float-dmg' + (extraClass ? ' ' + extraClass : '');
        div.textContent = text;
        div.style.left = (screenX - vpRect.left) + 'px';
        div.style.top = (screenY - vpRect.top) + 'px';
        els.viewport.appendChild(div);
        setTimeout(() => div.remove(), 860);
    }

    function showBanner(el, text) {
        if (text) el.textContent = text;
        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');
    }

    function triggerOverkillBanner() {
        showBanner(els.overkillBanner);
        A.play('overkill');
        R.triggerShake(0.09, 0.3);
        R.triggerScreenFlash('#f3c552', 0.28, 0.25);
    }

    function triggerGoldBanner(text) {
        showBanner(els.evolutionBanner, text);
        A.play('levelup');
        R.triggerShake(0.07, 0.25);
        R.triggerScreenFlash('#ffd147', 0.3, 0.28);
    }

    function pulseHeart() {
        const heartEl = els.hpText.parentElement;
        if (!heartEl) return;
        heartEl.classList.remove('hit-pulse');
        void heartEl.offsetWidth;
        heartEl.classList.add('hit-pulse');
    }

    function viewportPoint(fx, fy) {
        const r = els.viewport.getBoundingClientRect();
        return { x: r.left + r.width * fx, y: r.top + r.height * fy };
    }

    function getLuckMultiplier() {
        return 1 + (((state && state.stats && state.stats.Luck) || 0) / 100);
    }

    function getCardLevel(cardId) {
        return (state && state.cardLevels && state.cardLevels[cardId]) || 1;
    }

    // Carta efetiva = definição base + gemas encaixadas. O combate nunca lê D.CARDS direto.
    function cardOf(cardId) {
        return D.applyGems(D.CARDS[cardId], state && state.cardGems[cardId]);
    }

    // Stat efetivo = permanente (state.stats) + buff de cartas suporte do combate atual.
    function getStat(name) {
        if (!state) return 0;
        return ((state.stats && state.stats[name]) || 0) + ((state.combatBuff && state.combatBuff[name]) || 0);
    }

    function getManaBombDamage() {
        return B.manaBombBase + B.manaBombStep * ((state && state.manaBombTicks) || 0);
    }

    // inHand: a própria carta ainda está na mão (prévia), então o Líder dela mesma não conta.
    function getCardPreviewValues(card, comboMult, inHand) {
        const mult = Math.max(1, comboMult || 1);
        const leaders = (state && state.mode === 'combat')
            ? state.hand.filter(id => D.cardHasGem(cardOf(id), 'leader')).length : 0;
        const leaderOn = leaders > (inHand && D.cardHasGem(card, 'leader') ? 1 : 0);
        const mightMult = (1 + (getStat('Might') / 100)) * (leaderOn ? 1 + B.gemLeaderBonus : 1);
        const statAmt = getStat('Amount');
        const supportMult = card.scalesWithCombo ? mult : 1;

        let hits = card.baseAmount || card.hits || (card.damage > 0 ? 1 : 0);
        if (card.amountScalesWithCombo) {
            hits = hits * mult + statAmt;
        }

        let dmg = card.damage || 0;
        if (dmg > 0) {
            if (card.damageScalesWithCombo) dmg *= mult;
            if (card.damageScalesWithAmount) dmg *= (1 + statAmt);
            dmg = Math.max(1, Math.round(dmg * mightMult));
        }

        let shield = card.shield || 0;
        if (shield > 0 && card.scalesWithCombo) {
            shield = Math.round(shield * mult);
        }

        let heal = card.heal || 0;
        if (heal > 0 && card.scalesWithCombo) {
            heal = Math.round(heal * mult);
        }

        return {
            hits: hits,
            damage: dmg,
            shield: shield,
            heal: heal,
            burn: card.burn || 0,
            might: (card.buffMight || 0) * supportMult,
            area: (card.buffArea || 0) * supportMult,
            draw: (card.draw || 0) * supportMult
        };
    }

    function formatCardDesc(card, preview) {
        const pv = preview || getCardPreviewValues(card, 1);
        return (card.desc || '')
            .replace(/\{HITS\}/g, String(pv.hits))
            .replace(/\{DMG\}/g, String(pv.damage))
            .replace(/\{SHIELD\}/g, String(pv.shield))
            .replace(/\{HEAL\}/g, String(pv.heal))
            .replace(/\{BURN\}/g, String(pv.burn))
            .replace(/\{MIGHT\}/g, String(pv.might))
            .replace(/\{AREA\}/g, String(pv.area))
            .replace(/\{DRAW\}/g, String(pv.draw))
            .replace(/\{BOMB\}/g, String(getManaBombDamage()));
    }

    function hasCardInCollection(cardId) {
        if (!state) return false;
        return state.deck.includes(cardId) ||
            state.hand.includes(cardId) ||
            state.drawPile.includes(cardId) ||
            state.discardPile.includes(cardId);
    }

    function isEvolutionReady(ev) {
        return state.relics.includes(ev.passiveId) &&
            getCardLevel(ev.fromCard) >= B.maxCardLevel &&
            hasCardInCollection(ev.fromCard) &&
            !state.evolvedCards[ev.toCard];
    }

    function applyEvolution(ev) {
        [state.deck, state.drawPile, state.hand, state.discardPile].forEach(pile => {
            for (let i = 0; i < pile.length; i++) {
                if (pile[i] === ev.fromCard) pile[i] = ev.toCard;
            }
        });
        state.evolvedCards[ev.toCard] = true;
        const evolved = D.CARDS[ev.toCard];
        // As gemas acompanham a carta; o que deixou de fazer sentido na evoluída é descartado.
        const carried = [];
        (state.cardGems[ev.fromCard] || []).forEach(g => { if (D.canSocketGem(evolved, carried, g)) carried.push(g); });
        delete state.cardGems[ev.fromCard];
        if (carried.length > 0) state.cardGems[ev.toCard] = carried;
        triggerGoldBanner('EVOLUÇÃO! ' + evolved.name.toUpperCase());
        setLog('Carta evoluída: ' + evolved.name + '!');
        return evolved;
    }

    // Verifica se alguma carta atingiu condição de evolução (Nv.MÁX + Relíquia).
    // allowImmediate=true evolui na hora (usado ao abrir Baú); caso contrário avisa que aparecerá no próximo Baú/Level Up.
    function checkAndTriggerEvolutions(allowImmediate) {
        const ready = D.EVOLUTIONS.filter(isEvolutionReady);
        if (ready.length === 0) return [];
        if (!allowImmediate) {
            const names = ready.map(ev => D.CARDS[ev.toCard].name).join(', ');
            setLog('Evolução pronta (' + names + ')! Disponível no próximo Baú ou Level Up.');
            return ready;
        }
        const evolvedNames = ready.map(ev => applyEvolution(ev).name);
        triggerGoldBanner('BAÚ EVOLUIU: ' + evolvedNames.join(' & ').toUpperCase());
        return ready;
    }

    function grantRelic(id) {
        const relic = D.SPECIAL_RELICS[id];
        if (!relic || state.specialRelics.includes(id)) return;
        state.specialRelics.push(id);
        state.passives.push({ label: relic.title + ' — ' + relic.desc, icon: relic.icon });
        if (id === 'foto_parque') {
            state.stats.Might += 15;
            state.healPerCombat += 5;
        } else if (id === 'bilhete_cinema') {
            state.stats.Might += 10;
        } else if (id === 'chave_bicicleta') {
            state.maxMana = Math.min(B.maxManaCap, state.maxMana + 1);
            state.mana = Math.min(state.maxMana, state.mana + 1);
        }
        triggerGoldBanner('RELÍQUIA: ' + relic.title.toUpperCase());
    }

    // ---------- ORBES DE XP / VR ----------
    function spawnOrbs(fromX, fromY, targetEl, className, count, onArrive) {
        const rect = targetEl.getBoundingClientRect();
        const targetX = rect.left + rect.width * 0.5;
        const targetY = rect.top + rect.height * 0.5;
        for (let i = 0; i < count; i++) {
            const orb = document.createElement('div');
            orb.className = className;
            const startX = fromX + (Math.random() - 0.5) * 44;
            const startY = fromY + (Math.random() - 0.5) * 44;
            const ctrlX = (startX + targetX) / 2 + (Math.random() - 0.5) * 140;
            const ctrlY = Math.min(startY, targetY) - 60 - Math.random() * 60;
            const dur = 460 + i * 35;
            const startTime = performance.now() + i * 28;
            orb.style.left = startX + 'px';
            orb.style.top = startY + 'px';
            els.xpParticlesLayer.appendChild(orb);
            const tick = (now) => {
                if (now < startTime) {
                    requestAnimationFrame(tick);
                    return;
                }
                const p = Math.min(1, (now - startTime) / dur);
                const inv = 1 - p;
                orb.style.left = (inv * inv * startX + 2 * inv * p * ctrlX + p * p * targetX) + 'px';
                orb.style.top = (inv * inv * startY + 2 * inv * p * ctrlY + p * p * targetY) + 'px';
                if (p < 1) {
                    requestAnimationFrame(tick);
                } else {
                    orb.remove();
                    if (onArrive) onArrive(i);
                }
            };
            requestAnimationFrame(tick);
        }
    }

    function spawnXpParticles(fromX, fromY, totalXp) {
        if (totalXp <= 0) return;
        const count = Math.min(10, Math.max(3, Math.round(totalXp / 6)));
        const xpPerOrb = Math.floor(totalXp / count);
        const remainder = totalXp - xpPerOrb * count;
        const owner = state;
        spawnOrbs(fromX, fromY, els.xpTrack, 'xp-orb', count, i => {
            if (state !== owner) return;
            gainXp(xpPerOrb + (i < remainder ? 1 : 0));
        });
    }

    // Moedas de VR voando até o contador. O valor já foi creditado; é só feedback.
    function spawnVrParticles(fromX, fromY, totalVr) {
        if (totalVr <= 0) return;
        const vrBox = els.statVr.parentElement;
        spawnOrbs(fromX, fromY, els.statVr, 'xp-orb vr-orb', Math.min(6, Math.max(2, Math.round(totalVr / 3))), () => {
            vrBox.classList.remove('vr-pulse');
            void vrBox.offsetWidth;
            vrBox.classList.add('vr-pulse');
        });
    }

    // Ganho de XP: o loop só sobe o nível e conta pendingLevelUps; cada nível vira UM item
    // {type:'levelup'} na fila. Nenhum modal é aberto dentro do loop.
    function gainXp(amount) {
        if (state.mode === 'gameover' || amount <= 0) return;
        const effectiveXp = Math.max(1, D.scaleByCurse(Math.round((1 + ((state.stats && state.stats.Growth) || 0) / 100) * amount), state.curse));
        state.xp += effectiveXp;
        A.play('xpTick');
        els.xpTrack.classList.remove('pulse');
        void els.xpTrack.offsetWidth;
        els.xpTrack.classList.add('pulse');

        let gained = 0;
        while (state.xp >= state.xpNext) {
            state.xp -= state.xpNext;
            state.level += 1;
            state.xpNext = D.getXpForLevel(state.level);
            state.pendingLevelUps += 1;
            gained += 1;
        }
        for (let i = 0; i < gained; i++) {
            modalQueue.push({ type: 'levelup' });
        }
        renderHud();
        if (gained > 0) processModalQueue();
    }

    // ---------- FILA DE MODAIS ----------
    function enqueueModal(item) {
        modalQueue.push(item);
        processModalQueue();
    }

    // Modais só abrem na exploração e fora de transições (alerta de aggro, fim de combate...).
    function canOpenModalNow() {
        return (state.mode === 'explore' || state.mode === 'modal') && !state.busy && !isTitleOpen();
    }

    function processModalQueue() {
        if (!state || activeModal !== null) return;
        if (state.mode === 'gameover') {
            modalQueue.length = 0;
            return;
        }
        if (modalQueue.length === 0) {
            onModalQueueIdle();
            return;
        }
        if (!canOpenModalNow()) return;

        activeModal = modalQueue.shift();
        modalActionLocked = false;
        state.mode = 'modal';
        R.setHoveredCard(null);
        renderAll();
        const openers = {
            levelup: openLevelUpModal,
            rest: openRestModal,
            event: openEventModal,
            narrative: openNarrativeModal,
            gem: openGemModal,
            arcana: openArcanaModal,
            epilogue: openEpilogue
        };
        openers[activeModal.type](activeModal);
    }

    // Fila zerada e nenhum modal aberto: só agora o jogo é liberado e o fluxo é retomado.
    function onModalQueueIdle() {
        if (state.mode !== 'modal') return;
        state.mode = 'explore';
        state.busy = false;
        state.autoPlaying = false;
        R.syncState(state);
        renderAll();
    }

    // Fecha o modal atual, dá um respiro curto e abre o próximo da fila (se houver).
    function closeActiveModal(afterClose) {
        const item = activeModal;
        if (!item) return;
        [els.levelupModal, els.restModal, els.eventModal, els.narrativeModal, els.gemModal, els.arcanaModal].forEach(m => m.classList.add('hidden'));
        activeModal = null;
        if (afterClose) afterClose(item);
        later(80, processModalQueue);
    }

    // Lock contra duplo clique/toque nas ações de modal.
    function guardModalAction(fn) {
        return function () {
            if (modalActionLocked || activeModal === null) return;
            modalActionLocked = true;
            A.unlock();
            fn();
        };
    }

    function resetModalSystem() {
        modalQueue = [];
        activeModal = null;
        modalActionLocked = false;
        [els.levelupModal, els.restModal, els.eventModal, els.narrativeModal, els.gemModal, els.arcanaModal, els.endModal].forEach(m => m.classList.add('hidden'));
        els.epilogueOverlay.classList.add('hidden');
    }

    function getEligibleLevelUpPool() {
        return D.LEVEL_UP_REWARDS.filter(rw => {
            if (state.banishedIds && state.banishedIds.includes(rw.id)) return false;
            if (rw.once && (state.takenRewards.includes(rw.id) || state.relics.includes(rw.id))) return false;
            if (rw.id && rw.id.indexOf('up_') === 0 && getCardLevel(rw.id.slice(3)) >= B.maxCardLevel) return false;
            if (rw.rare && Math.random() > 0.35) return false;
            return true;
        });
    }

    function buildEvolutionChoice(ev) {
        const toCard = D.CARDS[ev.toCard];
        const fromCard = D.CARDS[ev.fromCard];
        return {
            id: 'evo_' + ev.toCard,
            kind: 'evolucao',
            title: toCard.name,
            origin: 'Evolução de ' + fromCard.name,
            icon: toCard.icon,
            noBanish: true,
            desc: formatCardDesc(toCard, getCardPreviewValues(toCard, 1)),
            apply: function () {
                applyEvolution(ev);
            }
        };
    }

    function buildLevelUpChoices() {
        const fourthChance = 0.025 * getLuckMultiplier();
        const slotCount = Math.random() < fourthChance ? 4 : 3;
        const choices = D.EVOLUTIONS.filter(isEvolutionReady).map(buildEvolutionChoice);
        const pool = shuffle(getEligibleLevelUpPool());
        for (let i = 0; i < pool.length && choices.length < slotCount; i++) {
            const candidate = pool[i];
            if (!choices.some(c => c.id === candidate.id)) {
                choices.push(candidate);
            }
        }
        if (choices.length === 0) {
            choices.push({
                id: 'fallback_treino',
                kind: 'passiva',
                title: 'Fôlego da Vigília',
                origin: 'Treino de Reserva',
                icon: 'vr_boost',
                noBanish: true,
                desc: '+10% Might, cura 10 de Sanidade e +8 VR.',
                apply: function () {
                    state.stats.Might += 10;
                    state.hp = Math.min(state.maxHp, state.hp + 10);
                    state.vr += 8;
                }
            });
        }
        const picked = choices.slice(0, slotCount);
        // Recompensa rara: a última opção (nunca uma evolução) vira uma gema.
        const last = picked.length - 1;
        if (last > 0 && picked[last].kind !== 'evolucao' && Math.random() < B.gemRewardChance * getLuckMultiplier()) {
            const gem = D.GEMS[randomGemId()];
            picked[last] = {
                id: 'gem_' + gem.id,
                kind: 'gema',
                title: gem.name,
                origin: 'Gema para encaixar',
                icon: 'vr_boost',
                noBanish: true,
                desc: gem.desc,
                apply: function () { modalQueue.push({ type: 'gem', gemId: gem.id }); }
            };
        }
        return picked;
    }

    // ---------- GEMAS ----------
    function socketGem(cardId, gemId) {
        const card = D.CARDS[cardId];
        if (!state.deck.includes(cardId) || !D.canSocketGem(card, state.cardGems[cardId], gemId)) return false;
        if (D.GEMS[gemId].instant) {
            applyEvolution(D.EVOLUTIONS.find(ev => ev.fromCard === cardId));
            return true;
        }
        state.cardGems[cardId] = (state.cardGems[cardId] || []).concat(gemId);
        return true;
    }

    function gemTargets(gemId) {
        return state.deck.filter((id, i) => state.deck.indexOf(id) === i && D.canSocketGem(D.CARDS[id], state.cardGems[id], gemId));
    }

    // Sorteia entre as gemas que cabem em alguma carta do baralho atual.
    function randomGemId() {
        const usable = Object.keys(D.GEMS).filter(gemId => gemTargets(gemId).length > 0);
        return usable.length > 0 ? usable[Math.floor(Math.random() * usable.length)] : 'swift';
    }

    function grantGem(gemId) {
        enqueueModal({ type: 'gem', gemId: gemId || randomGemId() });
    }

    function gemSlotsHtml(cardId) {
        const base = D.CARDS[cardId];
        const gems = state.cardGems[cardId] || [];
        let html = '';
        for (let i = 0; i < D.getCardGemSlots(base); i++) {
            const gem = D.GEMS[gems[i]];
            html += gem
                ? '<span class="gem-slot filled" style="--gem:' + gem.color + '" title="' + gem.name + ': ' + gem.desc + '">' + gem.glyph + '</span>'
                : '<span class="gem-slot" title="Slot de gema vazio"></span>';
        }
        return html ? '<span class="gem-slots">' + html + '</span>' : '';
    }

    function openGemModal(item) {
        const gem = D.GEMS[item.gemId];
        A.play('chest');
        els.gemTitle.innerHTML = '<span class="gem-slot filled big" style="--gem:' + gem.color + '">' + gem.glyph + '</span> ' + gem.name;
        els.gemTargets.innerHTML = '';
        const targets = gemTargets(gem.id);
        els.gemDesc.textContent = gem.desc + (targets.length > 0
            ? ' Escolha a carta que recebe a gema:'
            : ' Nenhuma carta do baralho pode receber esta gema.');
        targets.forEach(cardId => {
            const card = cardOf(cardId);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'shop-item-card gem-target-card';
            btn.dataset.card = cardId;
            btn.innerHTML =
                '<img src="' + S.getIconUrl(card.icon) + '" alt="" />' +
                '<div class="shop-item-title">' + card.name + '</div>' +
                '<div class="shop-item-desc">' + formatCardDesc(card, getCardPreviewValues(card, 1)) + '</div>' +
                gemSlotsHtml(cardId);
            btn.addEventListener('click', guardModalAction(() => {
                socketGem(cardId, gem.id);
                A.play('levelup');
                setLog(gem.name + ' encaixada em ' + D.CARDS[cardId].name + '!');
                closeActiveModal();
            }));
            els.gemTargets.appendChild(btn);
        });
        els.btnGemDiscard.textContent = 'RECUSAR (+' + B.gemDiscardVr + ' VR)';
        els.gemModal.classList.remove('hidden');
    }

    // ---------- ARCANAS ----------
    function setArcana(id) {
        const arcana = D.ARCANAS[id];
        if (!arcana) return false;
        state.passives = state.passives.filter(p => !p.arcana);
        state.arcana = id;
        state.passives.push({ label: 'Arcana: ' + arcana.name + ' — ' + arcana.desc, icon: arcana.icon, arcana: true });
        renderHud();
        return true;
    }

    function openArcanaModal() {
        A.play('levelup');
        els.arcanaChoices.innerHTML = '';
        shuffle(Object.keys(D.ARCANAS)).slice(0, 3).forEach(id => {
            const arcana = D.ARCANAS[id];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'reward-card arcana-choice';
            btn.dataset.arcana = id;
            btn.innerHTML =
                '<span class="reward-kind">Estado de Espírito</span>' +
                '<img src="' + S.getIconUrl(arcana.icon) + '" alt="" />' +
                '<div class="reward-title">' + arcana.name + '</div>' +
                '<div class="reward-desc">' + arcana.desc + '</div>';
            btn.addEventListener('click', guardModalAction(() => {
                setArcana(id);
                A.play('card');
                setLog('Estado de Espírito: ' + arcana.name + '.');
                closeActiveModal();
            }));
            els.arcanaChoices.appendChild(btn);
        });
        els.arcanaModal.classList.remove('hidden');
    }

    function renderLevelUpModal() {
        if (!activeModal || activeModal.type !== 'levelup') return;
        const choices = activeModal.choices || [];
        els.rewardGrid.innerHTML = '';
        els.rewardGrid.classList.toggle('four-choices', choices.length >= 4);
        els.rewardGrid.classList.toggle('banish-active', !!state.banishMode);

        if (els.levelupCount) {
            els.levelupCount.textContent = state.pendingLevelUps > 1
                ? 'Nível ' + (state.level - state.pendingLevelUps + 1) + ' — restam ' + state.pendingLevelUps + ' escolhas'
                : 'Nível ' + state.level;
        }
        if (els.levelupSubtitle) {
            els.levelupSubtitle.textContent = state.banishMode
                ? 'BANIR: clique em 1 carta/passiva abaixo para removê-la desta run.'
                : choices.length >= 4
                    ? 'Luck ativou a 4ª opção! Escolha 1 melhoria para levar adiante:'
                    : 'Escolha 1 melhoria para levar adiante:';
        }

        const skipXp = Math.max(2, Math.round(state.xpNext * 0.20));
        if (els.btnLvlReroll) {
            els.btnLvlReroll.textContent = 'Re-rolar (' + state.rerollsLeft + ')';
            els.btnLvlReroll.disabled = state.rerollsLeft <= 0 || modalActionLocked;
        }
        if (els.btnLvlSkip) {
            els.btnLvlSkip.textContent = 'Pular (+' + skipXp + ' XP • ' + state.skipsLeft + ')';
            els.btnLvlSkip.disabled = state.skipsLeft <= 0 || modalActionLocked;
        }
        if (els.btnLvlBanish) {
            els.btnLvlBanish.textContent = state.banishMode ? 'Cancelar Banir' : 'Banir (' + state.banishesLeft + ')';
            els.btnLvlBanish.classList.toggle('active', !!state.banishMode);
            els.btnLvlBanish.disabled = (!state.banishMode && state.banishesLeft <= 0) || modalActionLocked;
        }

        choices.forEach((rw, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'reward-card' + (rw.kind === 'evolucao' ? ' evo-choice' : '');
            const kindLabel = rw.kind === 'carta'
                ? 'Nova Carta'
                : rw.kind === 'reliquia'
                    ? 'Relíquia de Evolução'
                    : rw.kind === 'evolucao'
                        ? 'EVOLUÇÃO PRONTA'
                        : rw.kind === 'gema'
                            ? 'Gema Rara'
                            : 'Passiva';
            btn.innerHTML =
                '<span class="reward-kind">' + kindLabel + '</span>' +
                '<img src="' + S.getIconUrl(rw.icon) + '" alt="" />' +
                '<div class="reward-title">' + rw.title + '</div>' +
                '<div class="reward-origin">(' + rw.origin + ')</div>' +
                '<div class="reward-desc">' + rw.desc + '</div>';

            btn.addEventListener('click', () => {
                if (modalActionLocked || !activeModal || activeModal.type !== 'levelup') return;
                A.unlock();
                if (state.banishMode) {
                    if (rw.noBanish) {
                        state.banishMode = false;
                        setLog('Evoluções não podem ser banidas!');
                        renderLevelUpModal();
                        return;
                    }
                    if (!state.banishedIds.includes(rw.id)) state.banishedIds.push(rw.id);
                    state.banishesLeft = Math.max(0, state.banishesLeft - 1);
                    state.banishMode = false;
                    A.play('card');
                    setLog('Banido desta run: ' + rw.title + '.');
                    const usedIds = choices.map(c => c.id);
                    const replacements = shuffle(getEligibleLevelUpPool().filter(c => !usedIds.includes(c.id)));
                    if (replacements.length > 0) {
                        choices[idx] = replacements[0];
                    } else {
                        choices.splice(idx, 1);
                    }
                    if (choices.length === 0) {
                        modalActionLocked = true;
                        state.pendingLevelUps = Math.max(0, state.pendingLevelUps - 1);
                        renderHud();
                        closeActiveModal();
                    } else {
                        renderLevelUpModal();
                    }
                    return;
                }

                modalActionLocked = true;
                A.play('card');
                rw.apply(state);
                if (rw.once && !state.takenRewards.includes(rw.id)) state.takenRewards.push(rw.id);
                state.pendingLevelUps = Math.max(0, state.pendingLevelUps - 1);
                state.banishMode = false;
                checkAndTriggerEvolutions(false);
                setLog('Recompensa escolhida: ' + rw.title + '!');
                renderHud();
                closeActiveModal();
            });
            els.rewardGrid.appendChild(btn);
        });
    }

    // ---------- MODAL: LEVEL UP ----------
    function openLevelUpModal() {
        A.play('levelup');
        state.banishMode = false;
        activeModal.choices = buildLevelUpChoices();
        renderLevelUpModal();
        els.levelupModal.classList.remove('hidden');
    }

    // ---------- MODAL: PONTO DE PAUSA / FOGUEIRA ----------
    function restFlags() {
        if (!state.restUsed[state.floor]) state.restUsed[state.floor] = { removed: 0, relic: false };
        return state.restUsed[state.floor];
    }

    function openRestModal(item) {
        A.play('chest');
        item.view = 'main';
        renderRestModal();
        els.restModal.classList.remove('hidden');
    }

    function addRestItem(opts) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shop-item-card';
        btn.disabled = !!opts.disabled;
        btn.innerHTML =
            '<img src="' + S.getIconUrl(opts.icon) + '" alt="" />' +
            '<div class="shop-item-title">' + opts.title + '</div>' +
            '<div class="shop-item-desc">' + opts.desc + '</div>' +
            '<span class="shop-item-price">' + opts.priceText + '</span>';
        btn.addEventListener('click', () => {
            if (modalActionLocked || !activeModal || activeModal.type !== 'rest') return;
            modalActionLocked = true;
            A.unlock();
            opts.onPick();
            renderHud();
            // Comprar gema fecha a fogueira para abrir o modal de encaixe (ela reabre em seguida).
            if (activeModal && activeModal.type === 'rest') renderRestModal();
            setTimeout(() => { modalActionLocked = false; }, 160);
        });
        els.restItemsGrid.appendChild(btn);
    }

    function renderRestModal() {
        const fl = currentFloor();
        const rest = B.rest;
        const flags = restFlags();
        const removePrice = rest.removePrices[flags.removed];
        els.restTitle.textContent = fl.restName.toUpperCase();
        els.restVrVal.textContent = String(state.vr);
        els.restItemsGrid.innerHTML = '';

        if (activeModal.view === 'remove') {
            els.restDesc.textContent = 'Escolha 1 carta para deixar para trás (' + removePrice + ' VR):';
            const counts = {};
            state.deck.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
            Object.keys(counts).forEach(id => {
                const card = cardOf(id);
                addRestItem({
                    title: card.name + (counts[id] > 1 ? ' x' + counts[id] : ''),
                    desc: formatCardDesc(card, getCardPreviewValues(card, 1)),
                    icon: card.icon,
                    priceText: 'REMOVER',
                    onPick: () => {
                        state.vr -= removePrice;
                        state.deck.splice(state.deck.indexOf(id), 1);
                        flags.removed++;
                        activeModal.view = 'main';
                        A.play('card');
                        setLog(card.name + ' ficou para trás. Baralho mais leve.');
                    }
                });
            });
            addRestItem({
                title: 'Voltar',
                desc: 'Manter o baralho como está.',
                icon: 'campfire',
                priceText: 'CANCELAR',
                onPick: () => { activeModal.view = 'main'; }
            });
            return;
        }

        els.restDesc.textContent = fl.restDesc + ' Valter pode gastar VR para se recompor:';

        const needHeal = state.hp < state.maxHp;
        addRestItem({
            title: 'Descansar',
            desc: 'Recupera +' + rest.healAmount + ' de Sanidade.',
            icon: 'campfire',
            disabled: state.vr < rest.healPrice || !needHeal,
            priceText: needHeal ? rest.healPrice + ' VR' : 'SANIDADE CHEIA',
            onPick: () => {
                state.vr -= rest.healPrice;
                state.hp = Math.min(state.maxHp, state.hp + rest.healAmount);
                A.play('chest');
                setLog('Um momento de calma. +' + rest.healAmount + ' Sanidade.');
            }
        });

        const canRemove = state.deck.length > B.minDeckSize;
        const removeSoldOut = flags.removed >= rest.removePrices.length;
        addRestItem({
            title: 'Deixar um Peso',
            desc: 'Remove 1 carta fraca/lixo do baralho (até ' + rest.removePrices.length + ' por fase, preço crescente).',
            icon: 'ata',
            disabled: removeSoldOut || !canRemove || state.vr < removePrice,
            priceText: removeSoldOut ? 'ESGOTADO' : !canRemove ? 'BARALHO MÍNIMO' : removePrice + ' VR',
            onPick: () => { activeModal.view = 'remove'; A.play('card'); }
        });

        addRestItem({
            title: 'Gema Bruta',
            desc: 'Uma gema aleatória para encaixar numa carta (1 por fase).',
            icon: 'vr_boost',
            disabled: !!flags.gem || state.vr < rest.gemPrice,
            priceText: flags.gem ? 'JÁ COMPRADA' : rest.gemPrice + ' VR',
            onPick: () => {
                state.vr -= rest.gemPrice;
                flags.gem = true;
                modalQueue.push({ type: 'gem', gemId: randomGemId() }, { type: 'rest' });
                closeActiveModal();
            }
        });

        addRestItem({
            title: 'Fôlego Extra',
            desc: '+12 Escudo e +1 Cafeína no 1º turno do próximo combate.',
            icon: 'shield',
            disabled: !!state.extraBreath || state.vr < rest.breathPrice,
            priceText: state.extraBreath ? 'JÁ PREPARADO' : rest.breathPrice + ' VR',
            onPick: () => {
                state.vr -= rest.breathPrice;
                state.extraBreath = true;
                state.passives.push({ label: 'Fôlego Extra (próximo combate)', icon: 'shield' });
                A.play('shield');
                setLog('Valter respira fundo. Escudo e Cafeína extras no próximo combate.');
            }
        });

        const relic = D.EVOLUTIONS.find(ev => !state.relics.includes(ev.passiveId));
        if (relic) {
            addRestItem({
                title: relic.title,
                desc: 'Relíquia de Evolução (1 por fase): ' + relic.desc,
                icon: relic.icon,
                disabled: flags.relic || state.vr < rest.relicPrice,
                priceText: flags.relic ? 'JÁ COMPRADA' : rest.relicPrice + ' VR',
                onPick: () => {
                    state.vr -= rest.relicPrice;
                    state.relics.push(relic.passiveId);
                    state.passives.push({ label: relic.title + ' (Evolução)', icon: relic.icon });
                    flags.relic = true;
                    checkAndTriggerEvolutions(false);
                }
            });
        } else {
            addRestItem({
                title: 'Relíquias Esgotadas',
                desc: 'Todas as Relíquias de Evolução já estão com você.',
                icon: 'thermos',
                disabled: true,
                priceText: 'COMPLETO',
                onPick: () => {}
            });
        }
    }

    // ---------- MODAL: EVENTOS (?) ----------
    function countHeavyCards() {
        return state.deck.filter(id => D.CARDS[id].cost >= 2).length;
    }

    function removeHeavyCards(n) {
        let removed = 0;
        while (removed < n && state.deck.length > B.minDeckSize) {
            const idx = state.deck.findIndex(id => D.CARDS[id].cost >= 2);
            if (idx < 0) break;
            state.deck.splice(idx, 1);
            removed++;
        }
        return removed;
    }

    function openEventModal(item) {
        A.play('encounter');
        const ev = item.event;
        els.eventTitle.textContent = ev.title;
        els.eventDesc.textContent = ev.desc;
        els.eventChoices.innerHTML = '';

        let ambushIntro = null;
        const helpers = {
            addXp: function (amt) { gainXp(amt); },
            triggerAmbush: function (intro) { ambushIntro = intro; },
            countHeavyCards: countHeavyCards,
            removeHeavyCards: removeHeavyCards,
            grantRelic: grantRelic
        };

        ev.choices.forEach(ch => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'event-choice-btn';
            btn.innerHTML = '<span>' + ch.label + '</span><span class="event-choice-hint">' + ch.hint + '</span>';
            btn.addEventListener('click', guardModalAction(() => {
                A.play('card');
                const hpBefore = state.hp;
                const vrBefore = state.vr;
                const msg = ch.effect(state, helpers);
                if (state.vr > vrBefore) {
                    const p = viewportPoint(0.5, 0.5);
                    spawnVrParticles(p.x, p.y, state.vr - vrBefore);
                }
                renderHud();
                closeActiveModal(() => {
                    const enemies = D.AMBUSH_BY_FLOOR[state.floor] || [];
                    if (ambushIntro && enemies.length > 0) {
                        // a emboscada vira combate; a fila continua depois dele
                        state.mode = 'explore';
                        startEncounter(null, { zone: 'Emboscada', intro: ambushIntro, enemies: enemies });
                        return;
                    }
                    if (state.hp < hpBefore) triggerRealityFlash(msg);
                    else if (msg) setLog(msg);
                });
            }));
            els.eventChoices.appendChild(btn);
        });

        els.eventModal.classList.remove('hidden');
    }

    // ---------- MODAL: CARD NARRATIVO ----------
    function openNarrativeModal(item) {
        els.narrativeTag.textContent = item.tag;
        els.narrativeTitle.textContent = item.title;
        els.narrativeLines.innerHTML = '';
        item.lines.forEach(line => {
            const p = document.createElement('p');
            p.textContent = line;
            els.narrativeLines.appendChild(p);
        });
        els.btnNarrativeContinue.textContent = item.button || 'Continuar';
        els.narrativeModal.className = 'modal-overlay narrative-overlay biome-' + (item.biome || 'office');
    }

    function triggerCard(fl, onClose) {
        return {
            type: 'narrative',
            biome: fl.biome,
            tag: 'FASE ' + fl.floor + ' · ' + fl.trigger.time + ' — ' + fl.name.toUpperCase(),
            title: fl.trigger.title,
            lines: fl.trigger.lines,
            onClose: onClose
        };
    }

    // Saída da fase: frase de conclusão -> gatilho do próximo devaneio -> carrega o bioma.
    function requestNextFloor() {
        const fl = currentFloor();
        const next = runFloor(state, state.floor + 1);
        enqueueModal({
            type: 'narrative',
            biome: 'office',
            tag: 'DE VOLTA AO ESCRITÓRIO',
            title: '"' + fl.conclusion + '"',
            lines: [fl.name + ' se desfaz como fumaça.', 'Valter respira fundo, olha o relógio e volta ao trabalho. Por enquanto.']
        });
        enqueueModal(triggerCard(next, () => loadFloor(next.floor)));
    }

    // ---------- EPÍLOGO ----------
    function openEpilogue() {
        const ep = D.EPILOGUE;
        state.player.x = 4;
        state.player.y = 5;
        state.player.dir = 0;
        // As coordenadas do leque valem para a arena base 9x9 da fase final, não para o mapa gerado.
        state.encounters = [];
        R.buildMap(D.getFloorConfig(D.FLOORS.length).layout, state);
        R.syncState(state);
        R.settleCamera();
        R.showEpilogue({
            bosses: [
                // Leque aberto: cada chefe ocupa uma faixa de ângulo própria, sem se sobrepor
                { kind: 'kraken', x: 2.3, y: 2.8 },
                { kind: 'mensageiro', x: 5.7, y: 2.8 },
                { kind: 'estrategista', x: 3.1, y: 1.7 },
                { kind: 'guardia', x: 4.9, y: 1.7 }
            ],
            clock: { x: 4, y: 1 }
        });
        els.epilogueTitle.textContent = ep.calmTitle;
        els.epilogueLines.innerHTML = '';
        ep.calmLines.forEach(line => {
            const p = document.createElement('p');
            p.textContent = line;
            els.epilogueLines.appendChild(p);
        });
        els.btnPunchClock.textContent = ep.button;
        els.epilogueOverlay.classList.remove('hidden');
        setLog('O Abismo se acalma.');
    }

    // ---------- EXPLORAÇÃO ----------
    function canExplore() {
        return !bossKeyOpen && !isTitleOpen() && state.mode === 'explore' && !state.busy && activeModal === null;
    }

    function moveRelative(forwardStep, strafeStep) {
        if (!canExplore()) return;
        A.unlock();
        const fl = currentFloor();
        const layout = fl.layout;
        const dir = state.player.dir;
        const rightDir = (dir + 1) % 4;
        const nx = state.player.x + DIR_DX[dir] * forwardStep + DIR_DX[rightDir] * strafeStep;
        const ny = state.player.y + DIR_DY[dir] * forwardStep + DIR_DY[rightDir] * strafeStep;

        if (!D.isWalkableTile(layout, nx, ny)) {
            A.play('hit');
            R.triggerShake(0.03, 0.12);
            setLog(fl.bumpMsg);
            return;
        }

        // O jogador nunca pisa no tile de um inimigo: o combate começa à distância.
        const blocker = encounterAt(nx, ny);
        if (blocker) {
            beginAggro(blocker, dirTo(nx - state.player.x, ny - state.player.y), false);
            return;
        }

        const tile = layout[ny][nx];
        state.player.x = nx;
        state.player.y = ny;
        state.steps += 1;
        revealAround(state, nx, ny, layout);
        A.play('step');
        R.triggerStepBob();

        const key = nx + ',' + ny;
        if (tile === 'C' && !state.clearedTiles.has(key)) {
            collectChest(key);
        }

        // 1) Linha de visão do jogador; 2) a cada N passos, os encontros próximos avançam.
        let contact = findAggroContact();
        if (!contact && state.steps % B.patrolEverySteps === 0) {
            contact = patrolEncounters();
        }

        R.syncState(state);
        renderAll();

        if (contact) {
            beginAggro(contact.enc, contact.dir, contact.ambush);
            return;
        }
        handleTileEvent(nx, ny, tile);
        processModalQueue();
    }

    function turnPlayer(deltaDir) {
        if (!canExplore()) return;
        A.unlock();
        state.player.dir = (state.player.dir + deltaDir + 4) % 4;
        A.play('turn');
        R.turnCamera(deltaDir);
        R.syncState(state);
        const contact = findAggroContact();
        if (contact) beginAggro(contact.enc, contact.dir, false);
    }

    function dirTo(dx, dy) {
        if (dy < 0) return 0;
        if (dx > 0) return 1;
        if (dy > 0) return 2;
        return 3;
    }

    // Linha de visão: raycast tile a tile, só nas 4 direções cardeais (mesma linha/coluna).
    // O raio para na primeira parede: nunca enxerga através de paredes nem por quinas.
    function findAggroContact() {
        const layout = currentFloor().layout;
        const order = [0, 1, 3, 2].map(off => (state.player.dir + off) % 4);
        for (const d of order) {
            for (let dist = 1; dist <= B.aggroRange; dist++) {
                const x = state.player.x + DIR_DX[d] * dist;
                const y = state.player.y + DIR_DY[d] * dist;
                if (!D.isWalkableTile(layout, x, y)) break;
                const enc = encounterAt(x, y);
                if (enc) return { enc: enc, dir: d, ambush: false };
            }
        }
        return null;
    }

    function canEncounterStand(x, y, self) {
        const layout = currentFloor().layout;
        if (!D.isWalkableTile(layout, x, y)) return false;
        const ch = layout[y][x];
        if (ch === 'M' || ch === 'E') return false;
        if ((ch === 'C' || ch === '?') && !state.clearedTiles.has(x + ',' + y)) return false;
        const other = encounterAt(x, y);
        return !other || other === self;
    }

    // Próximo passo do menor caminho (BFS) do encontro até o jogador; null se não houver caminho.
    function nextStepToward(enc) {
        const px = state.player.x;
        const py = state.player.y;
        const startKey = enc.x + ',' + enc.y;
        const prev = new Map([[startKey, null]]);
        const queue = [[enc.x, enc.y, 0]];
        while (queue.length > 0) {
            const cur = queue.shift();
            if (cur[2] >= 10) continue;
            for (let d = 0; d < 4; d++) {
                const x = cur[0] + DIR_DX[d];
                const y = cur[1] + DIR_DY[d];
                const key = x + ',' + y;
                if (prev.has(key)) continue;
                const isGoal = x === px && y === py;
                if (!isGoal && !canEncounterStand(x, y, enc)) continue;
                prev.set(key, cur[0] + ',' + cur[1]);
                if (isGoal) {
                    let node = key;
                    while (prev.get(node) !== startKey) node = prev.get(node);
                    const parts = node.split(',');
                    return { x: Number(parts[0]), y: Number(parts[1]) };
                }
                queue.push([x, y, cur[2] + 1]);
            }
        }
        return null;
    }

    // Encontros (exceto chefes, que guardam suas arenas) dentro do raio avançam 1 casa livre.
    // Retorna o contato gerado (emboscada tem prioridade) ou null.
    function patrolEncounters() {
        const moved = [];
        state.encounters.forEach(enc => {
            if (!enc.alive || enc.isBoss || enc.isElite) return;
            const dist = Math.abs(enc.x - state.player.x) + Math.abs(enc.y - state.player.y);
            if (dist > B.patrolRadius || dist <= 1) return;
            const step = nextStepToward(enc);
            if (!step || (step.x === state.player.x && step.y === state.player.y)) return;
            // Só anda 1 casa cardeal para um tile livre validado
            if (Math.abs(step.x - enc.x) + Math.abs(step.y - enc.y) !== 1 || !canEncounterStand(step.x, step.y, enc)) return;
            enc.x = step.x;
            enc.y = step.y;
            moved.push(enc);
        });

        let normal = null;
        for (const enc of moved) {
            const dx = enc.x - state.player.x;
            const dy = enc.y - state.player.y;
            if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
            const d = dirTo(dx, dy);
            if (d !== state.player.dir) return { enc: enc, dir: d, ambush: true };
            normal = normal || { enc: enc, dir: d, ambush: false };
        }
        return normal || findAggroContact();
    }

    // Alerta "!" + som, câmera gira suavemente para encarar o inimigo e o combate começa.
    function beginAggro(enc, dir, ambush) {
        state.busy = true;
        R.setHoveredCard(null);
        let delta = (dir - state.player.dir + 4) % 4;
        if (delta === 3) delta = -1;
        state.player.dir = dir;
        if (delta !== 0) R.turnCamera(delta, true);
        R.syncState(state);
        R.showEncounterAlert(enc.id, 0.75);
        A.play('alert');

        if (ambush) {
            showBanner(els.ambushBanner);
            setLog('EMBOSCADA! O inimigo encostou sem você estar olhando!');
        } else {
            setLog('Você foi avistado! ' + enc.enc.zone + '.');
        }
        renderAll();

        later(ambush ? 900 : 720, () => {
            state.busy = false;
            if (state.mode !== 'explore') return;
            startEncounter(enc.id, enc.enc, { ambush: ambush });
        });
    }

    function collectChest(key) {
        state.clearedTiles.add(key);
        grantChestLoot();
    }

    function grantChestLoot() {
        const loot = D.CHEST_LOOT[chestIndex % D.CHEST_LOOT.length];
        chestIndex++;
        state.hp = Math.min(state.maxHp, state.hp + loot.hp);
        state.vr += loot.vr;
        A.play('chest');
        setLog(loot.title + ': ' + loot.text);
        // A gema do baú espera na fila: abre ao fim do passo (ou depois do combate, se houver aggro).
        modalQueue.push({ type: 'gem', gemId: randomGemId() });
        const evolved = checkAndTriggerEvolutions(true);
        const p = viewportPoint(0.5, 0.48);
        spawnFloatingText(p.x, p.y - 12, '+' + loot.hp + ' Sanidade', 'heal');
        if (evolved.length > 0) {
            A.play('levelup');
            spawnFloatingText(p.x, p.y - 34, 'EVOLUÇÃO!', 'combo');
        }
        spawnXpParticles(p.x, p.y, loot.xp);
        spawnVrParticles(p.x, p.y + 8, loot.vr);
    }

    function handleTileEvent(x, y, tile) {
        const key = x + ',' + y;
        const fl = currentFloor();

        if (tile === 'M' && fl.restName) {
            enqueueModal({ type: 'rest' });
            return;
        }
        if (tile === '?' && !state.clearedTiles.has(key)) {
            state.clearedTiles.add(key);
            let ev = fl.specialEvent;
            if (!ev || state.specialEventSeen === fl.floor) {
                ev = D.CORRIDOR_EVENTS[eventIndex % D.CORRIDOR_EVENTS.length];
                eventIndex++;
            } else {
                state.specialEventSeen = fl.floor;
            }
            enqueueModal({ type: 'event', event: ev });
            return;
        }
        if (tile === 'E') {
            if (state.bossDefeated) {
                requestNextFloor();
            } else {
                setLog('Saída bloqueada! Derrote ' + fl.bossName + ' primeiro!');
                A.play('immune');
            }
        }
    }

    // ---------- COMBATE (5 COLUNAS: FRENTE VS. RETAGUARDA) ----------
    function makeEnemy(kind, summoned, col, row, elite) {
        const tpl = D.getEnemyStats(kind);
        const e = {
            uid: 'e_' + (uidCounter++),
            kind: tpl.kind,
            name: tpl.name,
            origin: tpl.origin,
            hp: tpl.hp,
            maxHp: tpl.hp,
            shield: tpl.enemyShield || 0,
            atk: tpl.atk,
            xp: tpl.xp,
            vr: tpl.vr,
            col: typeof col === 'number' ? Math.max(0, Math.min(4, col)) : 2,
            row: typeof row === 'number' ? Math.max(0, row) : 0,
            intent: null,
            hasIntent: false,
            disarmed: false,
            overkill: false,
            killedOnce: false,
            phase: 1,
            kbResist: tpl.kbResist || 0,
            armorEvery: tpl.armorEvery || 0,
            armorGain: tpl.armorGain || 0,
            buffAllies: tpl.buffAllies || 0,
            curseCard: tpl.curseCard || null,
            curseEvery: tpl.curseEvery || 1,
            attacksPerTurn: tpl.attacksPerTurn || 1,
            shieldPerTurn: tpl.shieldPerTurn || 0,
            drainMana: tpl.drainMana || 0,
            dropRelic: tpl.dropRelic || null,
            summonKind: tpl.summonKind || null,
            summonEvery: tpl.summonEvery || 0,
            attackStyle: tpl.attackStyle || 'lunge',
            isBoss: !!tpl.isBoss,
            summoned: !!summoned,
            turns: 0,
            stunned: false,
            stunImmune: 0,
            frost: 0,
            hexEvery: tpl.hexEvery || 0,
            elite: !!elite
        };
        if (e.elite) {
            e.name = 'Elite: ' + e.name;
            e.hp = Math.round(e.hp * B.eliteHpMult);
            e.atk = Math.round(e.atk * B.eliteAtkMult);
            e.xp = Math.round(e.xp * B.eliteXpMult);
            e.vr += B.eliteVrBonus;
            e.kbResist = Math.max(e.kbResist, B.eliteKbResist);
            e.hexEvery = B.eliteHexEvery;
        }
        // Curse da run: quem nasce agora já vem com HP e dano escalados.
        e.hp = D.scaleByCurse(e.hp, state.curse);
        e.maxHp = e.hp;
        e.atk = D.scaleByCurse(e.atk, state.curse);
        return e;
    }

    // Gelo cancela o ataque de inimigos comuns; quem resiste a desarme (chefes) só ataca mais fraco.
    function frostBlocksAttack(e) {
        return e.frost > 0 && !(e.isBoss || e.kbResist >= 100);
    }

    function raiseCurse(amount) {
        const before = state.curse;
        state.curse = Math.min(B.curseCap, state.curse + amount);
        if (state.curse === before) return;
        // Inimigos já em campo só ganham dano; o HP escalado vale para os próximos encontros.
        const ratio = (100 + state.curse) / (100 + before);
        state.enemies.forEach(e => { if (e.hp > 0) e.atk = Math.round(e.atk * ratio); });
    }

    // Revival: a 0 de Sanidade, 1 carga revive com HP cheio. Retorna true se reviveu.
    function tryRevive() {
        const r = D.consumeRevival(state.hp, state.maxHp, state.revival);
        if (!r.revived) return false;
        state.hp = r.hp;
        state.revival = r.charges;
        A.play('levelup');
        showBanner(els.evolutionBanner, 'REVIVAL!');
        R.triggerScreenFlash('#8dffb0', 0.45, 0.5);
        const p = viewportPoint(0.5, 0.6);
        spawnFloatingText(p.x, p.y, 'REVIVEU! Sanidade cheia (' + state.revival + ' carga(s) restante(s))', 'heal');
        setLog('Revival! Valter se levanta com a Sanidade cheia.');
        renderHud();
        return true;
    }

    function normalizeColumns() {
        const buckets = [[], [], [], [], []];
        state.enemies.forEach(e => {
            if (e.hp > 0 || e.overkill) {
                const c = Math.max(0, Math.min(4, typeof e.col === 'number' ? e.col : 2));
                e.col = c;
                buckets[c].push(e);
            }
        });
        buckets.forEach(list => {
            list.sort((a, b) => (a.row || 0) - (b.row || 0));
            list.forEach((e, idx) => { e.row = idx; });
        });
    }

    function getFrontEnemies(includeOverkill) {
        normalizeColumns();
        return state.enemies
            .filter(e => e.row === 0 && (e.hp > 0 || (includeOverkill && e.overkill)))
            .sort((a, b) => a.col - b.col);
    }

    function getFrontEnemyAtCol(col, includeOverkill) {
        return getFrontEnemies(includeOverkill).find(e => e.col === col) || null;
    }

    function refreshFrontIntents(isNewTurn) {
        normalizeColumns();
        state.enemies.forEach(e => {
            if (e.hp <= 0) {
                e.intent = null;
            } else if (isNewTurn) {
                // Só a frente de cada coluna decide: armadura a cada armorEvery turnos, Aumentar Curse a cada
                // hexEvery (Elites e chefes avançados, até o teto), senão ataque.
                e.disarmed = false;
                // O gelo que não foi consumido por um golpe derrete 1 stack por turno.
                if (e.frost > 0) e.frost -= 1;
                const armorTurn = e.armorEvery > 0 && (e.turns + 1) % e.armorEvery === 0;
                const hexTurn = e.hexEvery > 0 && (e.turns + 1) % e.hexEvery === 0 && state.curse < B.curseCap;
                e.intent = (e.row !== 0 || e.stunned) ? null : (armorTurn ? 'armor' : (hexTurn ? 'curse' : 'attack'));
            }
            e.hasIntent = e.intent === 'attack' && !e.disarmed && !frostBlocksAttack(e);
        });
    }

    // Carta-lixo temporária: entra no topo da compra e nunca em state.deck (some após o combate).
    function addJunkCard(cardId, enemy) {
        state.drawPile.push(cardId);
        const pos = getEnemyTargetPos(enemy);
        spawnFloatingText(pos.x, pos.y - 30, '+' + D.CARDS[cardId].name + ' no topo da compra!', 'buff');
    }

    // Chefes mudam de fase ao cruzar 66% e 33% do HP (sem travar o dano no limiar).
    function advanceBossPhase(enemy) {
        const phases = D.getEnemyStats(enemy.kind).phases || {};
        const target = D.getBossPhase(enemy.hp, enemy.maxHp);
        while (enemy.phase < target) {
            enemy.phase += 1;
            const ph = phases[enemy.phase];
            if (!ph) continue;
            if (ph.armor) enemy.shield += ph.armor;
            if (ph.atk) enemy.atk += ph.atk;
            if (ph.set) Object.assign(enemy, ph.set);
            if (ph.junk) addJunkCard(ph.junk, enemy);
            const pos = getEnemyTargetPos(enemy);
            R.triggerEnemyBuffAnim(enemy.uid, 'gold');
            R.triggerShake(0.08, 0.3);
            A.play('buff');
            spawnFloatingText(pos.x, pos.y - 48, 'FASE ' + enemy.phase + ': ' + ph.label + '!', 'buff');
            setLog(enemy.name + ' entra na FASE ' + enemy.phase + ': ' + ph.label + '!');
        }
    }

    function getEnemyTargetPos(enemy) {
        if (!enemy) return viewportPoint(0.5, 0.45);
        return R.getEnemyScreenPos(enemy.uid);
    }

    function startEncounter(encId, enc, opts) {
        const ambush = !!(opts && opts.ambush);
        // A horda se forma no tile à frente: garante que o jogador encare um tile livre.
        const layout = currentFloor().layout;
        const facesFree = d => D.isWalkableTile(layout, state.player.x + DIR_DX[d], state.player.y + DIR_DY[d]);
        if (!facesFree(state.player.dir)) {
            const delta = [1, -1, 2].find(dl => facesFree((state.player.dir + dl + 4) % 4));
            if (delta !== undefined) {
                state.player.dir = (state.player.dir + delta + 4) % 4;
                R.turnCamera(delta, true);
            }
        }
        state.mode = 'combat';
        state.busy = false;
        state.currentEncounterId = encId;
        state.mana = state.maxMana;
        state.manaDrain = 0;
        state.shield = state.turn1Shield || 0;
        state.comboCount = 0;
        state.lastComboCost = null;
        state.combo = 1;
        state.comboChain = [];
        state.comboReverse = false;
        state.comboCarry = false;
        state.comboPile = [];
        state.combatBuff = { Might: 0, Area: 0, Amount: 0 };
        state.manaBombTicks = 0;
        state.bossOverkillActive = false;
        state.columnBurn = [0, 0, 0, 0, 0];
        state.pendingDrop = null;

        if (state.extraBreath) {
            // Fôlego Extra comprado na fogueira: vale só para o 1º turno deste combate.
            state.extraBreath = false;
            state.shield += B.extraBreathShield;
            state.mana += B.extraBreathMana;
            state.passives = state.passives.filter(p => !p.label || p.label.indexOf('Fôlego Extra') !== 0);
        }

        const formation = Array.isArray(enc.formation) && enc.formation.length > 0
            ? enc.formation
            : enc.enemies.map((kind, i) => ({ kind: kind, col: [2, 1, 3, 0, 4][i % 5], row: Math.floor(i / 5) }));
        // Encontro Elite sem slot marcado: o primeiro da formação vira o Elite.
        const eliteFallback = !!enc.isElite && !formation.some(slot => slot.elite);
        state.enemies = formation.slice(0, D.MAX_ENEMIES_IN_COMBAT)
            .map((slot, i) => makeEnemy(slot.kind, false, slot.col, slot.row, slot.elite || (eliteFallback && i === 0)));

        refreshFrontIntents(true);
        const fronts = getFrontEnemies(false);
        state.targetUid = (fronts[0] || state.enemies[0]).uid;

        // Compra Rápida (Swift): vai para o topo da compra e sai na mão inicial.
        const shuffled = shuffle(state.deck);
        const isSwift = id => D.cardHasGem(cardOf(id), 'swift');
        state.drawPile = shuffled.filter(id => !isSwift(id)).concat(shuffled.filter(isSwift));
        state.discardPile = [];
        state.destroyedPile = [];
        state.hand = [];
        state.handReturnCounts = [];
        state.handCostMods = [];
        drawCards(state.dealCount || B.dealCount);

        A.play('encounter');
        R.triggerShake(0.05, 0.22);
        setLog(enc.intro);

        if (state.healPerCombat > 0 && state.hp < state.maxHp) {
            state.hp = Math.min(state.maxHp, state.hp + state.healPerCombat);
            const p = viewportPoint(0.5, 0.7);
            spawnFloatingText(p.x, p.y, '+' + state.healPerCombat + ' Sanidade (Foto no Parque)', 'heal');
        }

        if (ambush) {
            // Emboscada: dano direto na Sanidade antes do Turno 1 (não mata sozinho)
            const dmg = Math.min(B.ambushDamage, state.hp - 1);
            if (dmg > 0) {
                state.hp -= dmg;
                const p = viewportPoint(0.5, 0.6);
                spawnFloatingText(p.x, p.y, '-' + dmg, 'player-hit big-hit');
                A.play('hurt');
                R.triggerShake(0.09, 0.28);
                R.triggerEdgeFlash('216,40,30', 0.85, 0.5);
                pulseHeart();
            }
            setLog('EMBOSCADA! -' + dmg + ' de Sanidade antes do Turno 1!');
        }

        R.syncState(state);
        R.settleCamera();
        renderAll();
    }

    // hand, handReturnCounts e handCostMods são arrays paralelos: só mexa neles por aqui.
    function pushToHand(cardId, returnCount) {
        state.hand.push(cardId);
        state.handReturnCounts.push(returnCount || 0);
        state.handCostMods.push(0);
    }

    function getHandCost(handIndex) {
        return D.getEffectiveCost(cardOf(state.hand[handIndex]), state.handCostMods[handIndex]);
    }

    // Compra -> Mão; com a compra vazia, o Descarte é reembaralhado (a ComboPile do turno fica de fora).
    function drawCards(count) {
        let scramble = 0;
        for (let i = 0; i < count && state.hand.length < B.maxHandSize; i++) {
            if (state.drawPile.length === 0) {
                if (state.discardPile.length === 0) break;
                state.drawPile = shuffle(state.discardPile);
                state.discardPile = [];
            }
            const cardId = state.drawPile.pop();
            pushToHand(cardId, 0);
            scramble = Math.max(scramble, D.CARDS[cardId].scrambleCosts || 0);
        }
        if (scramble > 0) {
            // Confusão: custos da mão variam em ±N até o fim do turno (as cartas-lixo não mudam).
            state.hand.forEach((id, idx) => {
                if (D.CARDS[id].type !== 'curse') {
                    state.handCostMods[idx] = Math.floor(Math.random() * (scramble * 2 + 1)) - scramble;
                }
            });
            const p = viewportPoint(0.5, 0.62);
            spawnFloatingText(p.x, p.y, 'CONFUSÃO! Custos embaralhados', 'buff');
        }
    }

    function getTargetEnemy() {
        const fronts = getFrontEnemies(true);
        const pool = fronts.length > 0 ? fronts : state.enemies.filter(e => e.hp > 0 || e.overkill);
        if (pool.length === 0) return null;
        let tgt = pool.find(e => e.uid === state.targetUid);
        if (!tgt) {
            // Prefere inimigo vivo na frente ao selecionar alvo padrão
            tgt = pool.find(e => e.hp > 0) || pool[0];
            state.targetUid = tgt.uid;
        }
        return tgt;
    }

    // Alvos do próximo acerto conforme o padrão de mira (WeaponTargeting) da carta.
    // aim = { lastCol, bag } guarda o cursor do padrão entre os acertos de uma mesma carta.
    function pickTargetsForCard(card, aim) {
        const fronts = getFrontEnemies(true);
        if (fronts.length === 0) return [];
        if (card.targeting === 'FrontRow') return fronts;

        // Priority = Attacking: pula quem não ataca neste turno até esgotar os atacantes.
        let pool = fronts;
        if (card.priority === 'Attacking') {
            const attackers = fronts.filter(e => e.hp > 0 && e.hasIntent);
            if (attackers.length > 0) pool = attackers;
        }

        if (!card.targeting || card.targeting === 'Target') {
            const current = getTargetEnemy();
            return [pool.includes(current) ? current : pool[0]];
        }
        const cols = pool.map(e => e.col);
        const col = card.targeting === 'Random'
            ? D.drawColumnFromBag(aim.bag, cols)
            : D.nextTargetColumn(card.targeting, cols, aim.lastCol);
        aim.lastCol = col;
        return [pool.find(e => e.col === col)];
    }

    // Pierce: para onde o acerto segue depois de atingir `enemy`.
    function nextPierceTarget(card, enemy, alreadyHit, aim) {
        const alive = e => e.hp > 0 || e.overkill;
        if (card.pierceType === 'MultiHitSwitchTarget' && card.targeting !== 'FrontRow') {
            return pickTargetsForCard(card, aim)[0] || null;
        }
        if (card.pierceType === 'MultiHit' && alive(enemy)) return enemy;
        // OncePerEnemy (e MultiHit com alvo morto): atravessa para quem está atrás na mesma coluna.
        return state.enemies
            .filter(e => e.col === enemy.col && alive(e) && !alreadyHit.includes(e.uid))
            .sort((a, b) => a.row - b.row)[0] || null;
    }

    // Um acerto completo em `target`: dano + knockback, seguido dos pierces (fixos e Bouncy).
    function resolveHit(card, pv, usedMult, target, aim, opts) {
        let overkill = false;
        let pierceLeft = card.pierce || 0;
        let bounceChance = (card.bouncy || 0) * getLuckMultiplier();
        const alreadyHit = [];
        let enemy = target;
        while (enemy) {
            alreadyHit.push(enemy.uid);
            if (pv.damage > 0 && applyDamageToEnemy(enemy, pv.damage, card, usedMult, opts).overkill) overkill = true;
            if (card.knockback && enemy.hp > 0) tryKnockback(enemy, card, getEnemyTargetPos(enemy));
            const frost = (D.cardHasGem(card, 'freeze') ? 1 : 0) + (card.freeze || 0) +
                (pv.damage > 0 && Math.random() * 100 < getStat('Freeze') ? 1 : 0);
            if (frost > 0) applyFrost(enemy, frost);

            if (pierceLeft > 0) pierceLeft -= 1;
            else if (bounceChance > 0 && Math.random() < bounceChance) bounceChance *= B.bouncyDecay;
            else break;
            enemy = nextPierceTarget(card, enemy, alreadyHit, aim);
        }
        return overkill;
    }

    // Paralisia: cancela o ataque do turno; quem é imune a desarme (chefes) só perde parte do ATK.
    // Freeze: stacks de gelo. Diferente do Desarme: além de segurar o ataque, o próximo golpe causa 1.5x.
    function applyFrost(enemy, baseStacks) {
        if (enemy.hp <= 0 || enemy.overkill) return;
        enemy.frost += D.frostStacksToApply(baseStacks, getStat('Duration'));
        const pos = getEnemyTargetPos(enemy);
        spawnFloatingText(pos.x, pos.y + 16, frostBlocksAttack(enemy) ? 'CONGELADO!' : 'GELADO! ATK -50%', 'shield');
        A.play('stun');
        refreshFrontIntents(false);
    }

    // Splash de Area nas frentes das OUTRAS colunas ocupadas: dmg * (Area/100) * 0.2 por acerto recebido.
    function applyAreaSplash(sourceCol, dmg, card, usedMult, times) {
        const areaPct = getStat('Area');
        if (areaPct <= 0 || dmg <= 0) return;
        const splash = Math.max(1, Math.round(dmg * (areaPct / 100) * B.areaSplashRatio)) * (times || 1);
        getFrontEnemies(true).forEach(front => {
            if (front.col !== sourceCol) applyDamageToEnemy(front, splash, card, usedMult, { isSplash: true });
        });
    }

    // O multiplicador já aparece no badge; o rótulo curto cabe na coluna direita sem cortar.
    function comboBonusLabel() {
        if (state.comboCarry) return 'PRÓX: QUALQUER';
        if (state.lastComboCost === null || state.lastComboCost === undefined) return 'INICIE A CADEIA';
        const down = state.comboReverse && state.lastComboCost >= 1 ? '/C' + (state.lastComboCost - 1) : '';
        return 'PRÓX: C' + (state.lastComboCost + 1) + down + ' ou WILD';
    }

    function applyDamageToEnemy(enemy, rawDmg, card, usedMult, opts) {
        if (!enemy || (enemy.hp <= 0 && !enemy.overkill)) return { overkill: false, dealt: 0 };
        const o = opts || {};
        const pos = getEnemyTargetPos(enemy);

        // Overkill ativo em Chefe: converte dano adicional diretamente em VR extra
        if (enemy.overkill) {
            const critRoll = (!o.isSplash && !o.isBurn && card && card.critChance > 0)
                ? Math.random() < (card.critChance * getLuckMultiplier())
                : false;
            const dmg = critRoll ? Math.round(rawDmg * (card.critMult || 1.5)) : rawDmg;
            const extraVr = Math.max(1, Math.ceil(dmg / 4));
            state.vr += extraVr;
            state.overkills += 1;
            R.triggerEnemyHitAnim(enemy.uid, true);
            R.triggerShake(0.055, 0.16);
            A.play('overkill');
            R.spawnBurst(pos.x, pos.y, ['#ffd147', '#fff2a8', '#ff6b4a'], 10, { speed: 150, life: 0.45, size: 5 });
            spawnFloatingText(pos.x, pos.y - 16, (critRoll ? 'CRIT ' : '') + 'OVERKILL +' + extraVr + ' VR', 'combo big-hit');
            spawnVrParticles(pos.x, pos.y + 8, extraVr);
            return { overkill: true, dealt: dmg };
        }

        let dmg = rawDmg;
        let isCrit = false;
        if (!o.isSplash && !o.isBurn && card && card.critChance > 0) {
            const effCrit = card.critChance * getLuckMultiplier();
            if (Math.random() < effCrit) {
                dmg = Math.round(dmg * (card.critMult || 1.5));
                isCrit = true;
            }
        }

        if (!o.isBurn && !o.isSplash && enemy.frost > 0) {
            const iced = D.applyFrostToDamage(dmg, enemy.frost);
            dmg = iced.damage;
            enemy.frost = iced.frost;
            spawnFloatingText(pos.x, pos.y - 34, 'GELO x' + B.freezeDamageMult, 'shield');
            refreshFrontIntents(false);
        }

        let remaining = dmg;
        if (!(card && card.ignoreShield) && !o.isBurn && enemy.shield > 0) {
            const blocked = Math.min(enemy.shield, remaining);
            enemy.shield -= blocked;
            remaining -= blocked;
            if (blocked > 0) spawnFloatingText(pos.x, pos.y - 24, 'Escudo -' + blocked, 'shield');
        }

        let overkill = false;
        if (remaining > 0) {
            const prevHp = enemy.hp;
            enemy.hp = Math.max(0, enemy.hp - remaining);
            R.triggerEnemyHitAnim(enemy.uid, isCrit || usedMult >= 2);
            R.triggerShake((isCrit || usedMult >= 2) ? 0.065 : 0.035, 0.16);

            if (isCrit) {
                R.spawnDamageNumber(pos.x, pos.y - 14, remaining, { crit: true });
                R.spawnBurst(pos.x, pos.y, ['#ffd147', '#fff2a8'], 10, { speed: 140, life: 0.4, size: 5 });
            } else if (o.isSplash) {
                spawnFloatingText(pos.x, pos.y - 6, 'Área -' + remaining, 'shield');
            } else if (o.isBurn) {
                spawnFloatingText(pos.x, pos.y - 12, 'Burn -' + remaining, 'player-hit');
            } else {
                R.spawnDamageNumber(pos.x, pos.y - 10, remaining, { crit: false });
            }

            if (enemy.hp === 0 && !enemy.killedOnce) {
                enemy.killedOnce = true;
                const excess = Math.max(0, remaining - prevHp);
                let bonusXp = 0;
                let bonusVr = 0;

                if (enemy.isBoss) {
                    // Chefe entra em estado OVERKILL pelo resto do turno atual para farmar VR extra
                    enemy.overkill = true;
                    enemy.hasIntent = false;
                    enemy.disarmed = false;
                    state.bossDefeated = true;
                    state.bossOverkillActive = true;
                    if (enemy.dropRelic) state.pendingDrop = enemy.dropRelic;
                    bonusVr = Math.max(2, Math.ceil(excess / 3));
                    overkill = true;
                    state.overkills += 1;
                    A.play('overkill');
                    spawnFloatingText(pos.x, pos.y - 30, 'OVERKILL! +' + bonusVr + ' VR', 'combo big-hit');
                } else if (excess >= 8 || (usedMult >= 2 && excess >= 4)) {
                    overkill = true;
                    state.overkills += 1;
                    bonusXp = B.overkillXp;
                    bonusVr = B.overkillVr;
                }

                // Gemas OnKill valem para o golpe direto da carta (não para splash nem Burn).
                if (!o.isSplash && !o.isBurn && D.cardHasGem(card, 'steal')) bonusVr += B.gemStealVr;
                if (!o.isSplash && !o.isBurn && D.cardHasGem(card, 'drain') && state.hp < state.maxHp) {
                    state.hp = Math.min(state.maxHp, state.hp + B.gemDrainHeal);
                    spawnFloatingText(pos.x, pos.y + 22, '+' + B.gemDrainHeal + ' Sanidade', 'heal');
                }

                state.kills += 1;
                const gainedVr = enemy.vr + bonusVr;
                state.vr += gainedVr;
                A.play('death');
                R.spawnBurst(pos.x, pos.y, ['#3cc8ff', '#b8f4ff', '#ffd147', '#fff2a8'], 16, { speed: 170, life: 0.55, size: 6 });
                // A chuva é só visual (cai e quica); os orbes abaixo voam até as barras e creditam XP/VR.
                R.spawnLootRain(pos.x, pos.y, {
                    gems: Math.min(8, 2 + Math.round(enemy.xp / 5)),
                    coins: Math.min(6, 1 + Math.round(gainedVr / 4))
                });
                spawnXpParticles(pos.x, pos.y, enemy.xp + bonusXp);
                spawnVrParticles(pos.x, pos.y + 12, gainedVr);

                if (!enemy.overkill) {
                    enemy.hasIntent = false;
                    normalizeColumns();
                }
            }
        }

        if (enemy.isBoss && enemy.hp > 0) advanceBossPhase(enemy);

        // Crit Explosion: parte do dano crítico atinge as frentes de col-1 e col+1.
        if (isCrit && card.critExplosion) {
            const blast = Math.max(1, Math.round(dmg * B.critExplosionRatio));
            [enemy.col - 1, enemy.col + 1].forEach(adjCol => {
                const adjFront = getFrontEnemyAtCol(adjCol, true);
                if (adjFront && adjFront.uid !== enemy.uid) {
                    applyDamageToEnemy(adjFront, blast, card, usedMult, { isSplash: true });
                }
            });
        }
        if (!o.isSplash && !o.isBurn && !o.noSplash) applyAreaSplash(enemy.col, dmg, card, usedMult, 1);

        return { overkill: overkill, dealt: dmg };
    }

    // Knockback (Desarme): compara knockbackChance * LuckMultiplier > rand(); se passar, CANCELA intenção de ataque.
    function tryKnockback(enemy, card, pos) {
        if (!enemy || enemy.hp <= 0 || enemy.overkill) return;
        if (enemy.kbResist >= 100) {
            A.play('immune');
            spawnFloatingText(pos.x, pos.y + 16, 'IMUNE!', 'player-hit');
            return;
        }
        if (enemy.disarmed || enemy.stunned) return;
        if (enemy.stunImmune > 0) {
            A.play('immune');
            spawnFloatingText(pos.x, pos.y + 16, 'IMUNE 1t!', 'shield');
            return;
        }
        if (!enemy.hasIntent) return;
        const baseChance = typeof card.knockbackChance === 'number' ? card.knockbackChance : 0.6;
        const chance = Math.min(0.98, baseChance * getLuckMultiplier());
        if (D.rollKnockback(chance, enemy.kbResist, Math.random())) {
            enemy.disarmed = true;
            enemy.hasIntent = false;
            A.play('stun');
            spawnFloatingText(pos.x, pos.y + 16, 'DESARMADO!', 'shield');
        } else {
            spawnFloatingText(pos.x, pos.y + 16, 'RESISTIU!', 'player-hit');
        }
    }

    function checkCombatEnd() {
        if (state.mode !== 'combat') return false;
        if (state.enemies.every(e => e.hp <= 0)) {
            if (state.bossOverkillActive && state.hand.some(isUsefulCard)) {
                setLog('CHEFE EM OVERKILL! Continue jogando cartas para converter dano em VR ou toque Fim do Turno.');
                renderCombatControls();
                return false;
            }
            state.bossOverkillActive = false;
            state.enemies.forEach(e => { e.overkill = false; });
            finishEncounter();
            return true;
        }
        return false;
    }

    function applyBurnForCard(card, singleTarget) {
        if (!card || !card.burn) return;
        const burnAmt = D.withDuration(card.burn, getStat('Duration'));
        if (card.burnAllColumns) {
            for (let c = 0; c < 5; c++) {
                state.columnBurn[c] += burnAmt;
            }
            const cp = R.getColumnScreenPos(2);
            spawnFloatingText(cp.x, cp.y - 34, '+' + burnAmt + ' BURN (5 Colunas)', 'player-hit');
            return;
        }
        if (card.targeting === 'FrontRow') {
            const cols = [];
            getFrontEnemies(true).forEach(e => {
                if (!cols.includes(e.col)) cols.push(e.col);
            });
            if (cols.length === 0) {
                for (let c = 0; c < 5; c++) cols.push(c);
            }
            cols.forEach(c => {
                state.columnBurn[c] += burnAmt;
                const cp = R.getColumnScreenPos(c);
                spawnFloatingText(cp.x, cp.y - 26, '+' + burnAmt + ' BURN', 'player-hit');
            });
            return;
        }
        if (singleTarget) {
            state.columnBurn[singleTarget.col] += burnAmt;
            const cp = R.getColumnScreenPos(singleTarget.col);
            spawnFloatingText(cp.x, cp.y - 26, '+' + burnAmt + ' BURN', 'player-hit');
        }
    }

    function playCard(handIndex) {
        if (state.mode !== 'combat' || state.busy) return false;
        const cardId = state.hand[handIndex];
        const card = cardOf(cardId);
        if (!card) return false;
        const costMod = state.handCostMods[handIndex] || 0;
        const effCost = D.getEffectiveCost(card, costMod);
        if (state.mana < effCost) return false;

        A.unlock();
        R.setHoveredCard(null);
        state.mana -= effCost;
        state.hand.splice(handIndex, 1);
        const returnCount = state.handReturnCounts.splice(handIndex, 1)[0] || 0;
        state.handCostMods.splice(handIndex, 1);

        // Regra estrita v1.6.1a: effectiveCost - 1 === lastComboCost OU Wild. Quebrar a sequência
        // reinicia a cadeia em 1x com a carta jogada; depois de um Wild a escada recomeça no custo 0.
        const chained = card.type !== 'curse' &&
            (state.comboCarry || D.canCardCombo(card, state.lastComboCost, costMod, state.comboReverse));
        state.comboCarry = false;
        state.comboReverse = D.cardHasGem(card, 'reverse');
        state.comboCount = chained ? state.comboCount + 1 : 0;
        state.comboChain = chained ? state.comboChain.concat(cardId) : [cardId];
        state.lastComboCost = D.getComboCostAfter(card, costMod);
        const usedMult = D.getComboMult(state.comboCount);
        state.combo = usedMult;
        const isWild = D.isWildCard(card);

        // Destino da carta jogada: Destroy / Return / ComboPile (vai ao Descarte no fim do turno)
        let returnedToHand = false;
        if (card.destroy) {
            state.destroyedPile.push(cardId);
            if (card.permMaxHp > 0 || card.permGrowth > 0 || card.permRevival > 0) {
                // Bônus permanente é de uso único: a carta sai do baralho da run, não só da luta.
                const deckIdx = state.deck.indexOf(cardId);
                if (deckIdx >= 0) state.deck.splice(deckIdx, 1);
                if (card.permMaxHp > 0) {
                    state.maxHp = Math.min(B.maxHpCap, state.maxHp + card.permMaxHp);
                    state.hp = Math.min(state.maxHp, state.hp + card.permMaxHp);
                }
                state.stats.Growth += card.permGrowth || 0;
                state.revival = Math.min(B.revivalMax, state.revival + (card.permRevival || 0));
                const p = viewportPoint(0.5, 0.56);
                spawnFloatingText(p.x, p.y, card.permRevival > 0 ? '+1 carga de Revival' : card.permMaxHp > 0
                    ? '+' + card.permMaxHp + ' HP Máx permanente'
                    : '+' + card.permGrowth + '% Growth permanente', 'combo');
            }
        } else if (card.returnTimes && returnCount < card.returnTimes && state.hand.length < B.maxHandSize) {
            pushToHand(cardId, returnCount + 1);
            returnedToHand = true;
        } else {
            state.comboPile.push(cardId);
        }

        const pv = getCardPreviewValues(card, usedMult);

        if (pv.shield > 0) {
            state.shield += pv.shield;
            const p = viewportPoint(0.5, 0.72);
            spawnFloatingText(p.x, p.y, '+' + pv.shield + ' Escudo', 'shield');
            if (state.arcana === 'golpe_escudo') {
                getFrontEnemies(true).forEach(front => applyDamageToEnemy(front, state.shield, null, usedMult, { noSplash: true }));
            }
        }
        if (pv.heal > 0) {
            state.hp = Math.min(state.maxHp, state.hp + pv.heal);
            const p = viewportPoint(0.5, 0.65);
            spawnFloatingText(p.x, p.y, '+' + pv.heal + ' Sanidade', 'heal');
        }
        if (card.manaGain > 0) {
            state.mana += card.manaGain;
            const p = viewportPoint(0.45, 0.6);
            spawnFloatingText(p.x, p.y, '+' + card.manaGain + ' Cafeína', 'combo');
        }

        // Cartas suporte: buffs valem só neste combate (state.combatBuff)
        const buffs = [];
        if (pv.might > 0) {
            state.combatBuff.Might += pv.might;
            buffs.push('+' + pv.might + '% Might');
        }
        if (pv.area > 0) {
            state.combatBuff.Area += pv.area;
            buffs.push('+' + pv.area + '% Area');
        }
        if (card.buffAmount > 0 && state.combatBuff.Amount < B.combatAmountCap) {
            state.combatBuff.Amount = Math.min(B.combatAmountCap, state.combatBuff.Amount + card.buffAmount);
            buffs.push('+' + card.buffAmount + ' Amount');
        }
        if (pv.draw > 0) {
            const before = state.hand.length;
            drawCards(pv.draw);
            buffs.push('Comprou ' + (state.hand.length - before));
        }
        if (buffs.length > 0) {
            const p = viewportPoint(0.5, 0.58);
            spawnFloatingText(p.x, p.y, buffs.join(' • '), 'combo');
        }

        let hitNum = 0;
        let anyOverkill = false;
        const finish = () => {
            if (anyOverkill) triggerOverkillBanner();
            let msg = card.name;
            if (hitNum > 1) msg += ': ' + hitNum + ' golpes!';
            if (usedMult > 1) msg += ' [COMBO ' + usedMult + 'x]';
            else if (isWild) msg += ' [WILD]';
            if (returnedToHand) msg += ' [RETURN]';
            if (card.destroy) msg += ' [DESTROY]';
            if (anyOverkill) msg += ' — OVERKILL!';
            setLog(msg);
            getTargetEnemy();
            R.syncState(state);
            renderAll(true);
            checkCombatEnd();
        };

        if (usedMult > 1) setTimeout(() => A.play('combo', usedMult), 60);
        if (!(pv.damage > 0 || card.knockback || card.burn > 0)) {
            A.play(card.sfx);
            finish();
            return true;
        }

        // Cada acerto escolhe o alvo pelo padrão de mira com o tabuleiro atual (inimigos morrem no meio).
        const totalHits = Math.max(1, pv.hits);
        const isWave = card.targeting === 'FrontRow';
        const aim = { lastCol: null, bag: [] };
        let burnApplied = false;
        const runHit = () => {
            if (state.mode !== 'combat') {
                state.busy = false;
                return;
            }
            const targets = pickTargetsForCard(card, aim);
            if (targets.length > 0) {
                if (!burnApplied && card.burn > 0) {
                    applyBurnForCard(card, targets[0]);
                    burnApplied = true;
                }
                A.play(card.sfx);
                // shortcut: projétil é só visual e o dano entra na hora; amarrar o dano ao onHit se a duração crescer
                if (pv.damage > 0) {
                    if (isWave) {
                        R.fireProjectile({ kind: 'wave', duration: 150 });
                    } else {
                        const kind = R.getProjectileKindForCard(card);
                        targets.forEach(target => R.fireProjectile({ kind: kind, toUid: target.uid, duration: 110 }));
                    }
                }
                targets.forEach(target => {
                    if (resolveHit(card, pv, usedMult, target, aim, { noSplash: isWave })) anyOverkill = true;
                });
                // Onda: cada frente recebe de uma vez o splash das outras colunas atingidas.
                if (isWave && targets.length > 1) applyAreaSplash(-1, pv.damage, card, usedMult, targets.length - 1);
                hitNum++;
            }
            if (targets.length === 0 || hitNum >= totalHits) {
                state.busy = false;
                finish();
                return;
            }
            R.syncState(state);
            renderAll();
            later(155, runHit);
        };
        state.busy = true;
        runHit();
        return true;
    }

    // handIndex é opcional: sem ele vale o custo base da carta (sem o modificador da Confusão).
    function isUsefulCard(id, handIndex) {
        const c = cardOf(id);
        if (!c) return false;
        const cost = typeof handIndex === 'number' ? getHandCost(handIndex) : D.getEffectiveCost(c);
        if (cost > state.mana) return false;
        // Lixo quebra a cadeia: o Jogar Tudo só gasta Cafeína para desarmar a Bomba de Mana.
        if (c.type === 'curse') return !!c.endTurnBomb && state.enemies.some(e => e.hp > 0);
        const hasTarget = state.enemies.some(e => e.hp > 0 || e.overkill);
        if (c.damage > 0 || c.knockback || c.burn > 0) return hasTarget;
        if (c.buffAmount > 0) return state.combatBuff.Amount < B.combatAmountCap;
        return c.shield > 0 || c.heal > 0 || c.manaGain > 0 || c.buffMight > 0 || c.buffArea > 0 ||
            c.draw > 0 || c.permMaxHp > 0 || c.permGrowth > 0 || (c.permRevival > 0 && state.revival < B.revivalMax);
    }

    // SortCardsByCombo: começa em targetCost = 0 (ou lastComboCost + 1) e avança +1. Sem carta do custo
    // exigido joga um Wild (que devolve o targetCost a 0); sem Wild, a de menor custo disponível.
    function sortCardsByCombo(indices, currentLastCost, availableMana) {
        const cardAt = idx => cardOf(state.hand[idx]);
        const remaining = (indices || state.hand.map((_, i) => i)).filter(idx => isUsefulCard(state.hand[idx], idx));
        const ordered = [];
        let simLastCost = currentLastCost !== undefined ? currentLastCost : state.lastComboCost;
        let simMana = availableMana !== undefined ? availableMana : state.mana;
        let simReverse = state.comboReverse;

        while (remaining.length > 0) {
            const feasible = remaining.filter(idx => getHandCost(idx) <= simMana);
            if (feasible.length === 0) break;

            const targetCost = (simLastCost === null || simLastCost === undefined) ? 0 : simLastCost + 1;
            const fits = cost => feasible.find(idx =>
                !D.isWildCard(cardAt(idx)) && cardAt(idx).type !== 'curse' && getHandCost(idx) === cost);
            let chosenIdx = fits(targetCost);
            // Combo Reverso na carta anterior: descer 1 também mantém a cadeia.
            if (chosenIdx === undefined && simReverse && targetCost >= 2) chosenIdx = fits(targetCost - 2);
            if (chosenIdx === undefined) chosenIdx = feasible.find(idx => D.isWildCard(cardAt(idx)));
            if (chosenIdx === undefined) {
                chosenIdx = feasible.slice().sort((a, b) => getHandCost(a) - getHandCost(b))[0];
            }

            ordered.push(chosenIdx);
            remaining.splice(remaining.indexOf(chosenIdx), 1);
            simMana = Math.max(0, simMana - getHandCost(chosenIdx) + (cardAt(chosenIdx).manaGain || 0));
            simLastCost = D.getComboCostAfter(cardAt(chosenIdx), state.handCostMods[chosenIdx]);
            simReverse = D.cardHasGem(cardAt(chosenIdx), 'reverse');
        }
        return ordered;
    }

    function playAllCards() {
        if (state.mode !== 'combat' || state.busy || state.autoPlaying) return;
        if (!state.hand.some(isUsefulCard)) {
            setLog('Sem Cafeína para cartas úteis. Toque em Fim do Turno!');
            return;
        }
        state.autoPlaying = true;
        renderCombatControls();
        let stepsPlayed = 0;

        const stepNext = () => {
            if (state.mode !== 'combat' || !state.autoPlaying) {
                state.autoPlaying = false;
                return;
            }
            if (bossKeyOpen || state.busy) {
                later(120, stepNext);
                return;
            }
            const hasActiveTargets = state.enemies.some(e => e.hp > 0 || e.overkill);
            const ordered = sortCardsByCombo();
            if (ordered.length === 0 || !hasActiveTargets || stepsPlayed >= 20) {
                state.autoPlaying = false;
                renderAll();
                return;
            }
            playCard(ordered[0]);
            stepsPlayed++;
            if (state.mode === 'combat' && state.enemies.some(e => e.hp > 0 || e.overkill)) {
                later(state.busy ? 620 : 240, stepNext);
            } else {
                state.autoPlaying = false;
                if (state.mode === 'combat') renderCombatControls();
            }
        };
        stepNext();
    }

    function startPlayerTurn() {
        // Mente Afiada: a Cafeína que sobrou (até o teto) soma à do novo turno.
        const keptMana = state.arcana === 'mente_afiada' ? Math.min(B.arcanaManaCarry, state.mana) : 0;
        state.mana = Math.max(1, state.maxMana - (state.manaDrain || 0)) + keptMana;
        const drained = state.manaDrain || 0;
        state.manaDrain = 0;
        // Elo da Corrente: o combo atravessa o turno (com teto) e a 1ª carta continua a cadeia.
        const keepCombo = state.arcana === 'elo_corrente' && state.comboCount > 0;
        state.comboCount = keepCombo ? Math.min(B.arcanaComboCarryCap, state.comboCount) : 0;
        state.comboCarry = keepCombo;
        state.comboReverse = false;
        state.lastComboCost = null;
        state.combo = D.getComboMult(state.comboCount);
        // O Escudo acumulado expira no início do turno do jogador (Escudo Soberbo o mantém, com teto).
        state.shield = state.arcana === 'escudo_soberbo' ? Math.min(B.arcanaShieldCarryCap, state.shield) : 0;

        // Cartas com Retain permanecem na mão; demais vão para o descarte.
        const retainedIds = state.hand.filter(cid => cardOf(cid).retain);
        state.hand.forEach(cid => {
            if (!cardOf(cid).retain) state.discardPile.push(cid);
        });
        // Fluxo e Combo: descartar cartas dá 50% de começar o turno já encadeado; falha garante a próxima.
        if (state.arcana === 'fluxo_combo' && state.hand.length > retainedIds.length) {
            state.comboCarry = state.fluxoPity || Math.random() < 0.5;
            state.fluxoPity = !state.comboCarry;
            if (state.comboCarry) {
                const p = viewportPoint(0.5, 0.5);
                spawnFloatingText(p.x, p.y, 'FLUXO! +1 Combo', 'combo');
            }
        }
        state.hand = [];
        state.handReturnCounts = [];
        state.handCostMods = [];
        retainedIds.forEach(cid => pushToHand(cid, 0));

        drawCards(state.dealCount || B.dealCount);
        refreshFrontIntents(true);
        getTargetEnemy();
        state.busy = false;
        A.play('card');
        setLog(drained > 0
            ? 'Novo turno! O Senhor das Horas drenou ' + drained + ' de Cafeína.'
            : retainedIds.length > 0
                ? 'Novo turno! Cartas Retain mantidas na mão e combo reiniciado.'
                : 'Novo turno! Escudo expirou, 4 cartas compradas e combo reiniciado.');
        R.syncState(state);
        renderAll();
    }

    // Habilidades de suporte antes do golpe. Retorna o tempo (ms) da animação de salto.
    function runEnemySupport(enemy) {
        let wait = 0;
        const pos = getEnemyTargetPos(enemy);

        if (enemy.buffAllies > 0) {
            R.triggerEnemyBuffAnim(enemy.uid, 'purple');
            A.play('buff');
            state.enemies.filter(e => e.hp > 0).forEach(ally => {
                ally.atk += enemy.buffAllies;
                const apos = getEnemyTargetPos(ally);
                spawnFloatingText(apos.x, apos.y - 30, '+' + enemy.buffAllies + ' ATK!', 'buff');
                R.spawnBurst(apos.x, apos.y, ['#c084fc', '#e9d5ff', '#ffd147'], 8, { upward: true, speed: 130, life: 0.5, size: 5 });
            });
            wait = 520;
        }

        if (enemy.curseCard && enemy.turns % enemy.curseEvery === 0) {
            addJunkCard(enemy.curseCard, enemy);
            R.triggerEnemyBuffAnim(enemy.uid, 'gold');
            A.play('buff');
            wait = 520;
        }

        if (enemy.shieldPerTurn > 0 && enemy.shield < enemy.shieldPerTurn) {
            enemy.shield = enemy.shieldPerTurn;
            R.triggerEnemyBuffAnim(enemy.uid, 'ice');
            A.play('shield');
            spawnFloatingText(pos.x, pos.y - 30, 'ESCUDO DE CRISTAL ' + enemy.shieldPerTurn + '!', 'shield');
            wait = 520;
        }

        if (enemy.summonKind && enemy.summonEvery > 0 && enemy.turns % enemy.summonEvery === 0) {
            if (state.enemies.filter(e => e.hp > 0).length < D.MAX_ENEMIES_IN_COMBAT) {
                state.enemies = state.enemies.filter(e => e.hp > 0);
                const counts = [0, 0, 0, 0, 0];
                state.enemies.forEach(e => { counts[Math.max(0, Math.min(4, e.col || 0))]++; });
                let bestCol = 2;
                [2, 1, 3, 0, 4].forEach(c => {
                    if (counts[c] < counts[bestCol]) bestCol = c;
                });
                state.enemies.push(makeEnemy(enemy.summonKind, true, bestCol, counts[bestCol]));
                normalizeColumns();
                R.triggerEnemyBuffAnim(enemy.uid, 'gold');
                A.play('buff');
                spawnFloatingText(pos.x, pos.y - 30, 'INVOCAÇÃO!', 'buff');
                R.syncState(state);
                wait = 620;
            }
        }
        return wait;
    }

    // Impacto do golpe no jogador (fim da investida / chegada do projétil).
    function resolveEnemyHit(enemy) {
        const c = viewportPoint(0.5, 0.6);
        let dmg = enemy.frost > 0 ? Math.ceil(enemy.atk * B.freezeBossAtkRatio) : enemy.atk;
        const absorbed = Math.min(state.shield, dmg);
        state.shield -= absorbed;
        dmg -= absorbed;

        let realityTriggered = false;
        if (dmg <= 0) {
            // Escudo absorveu 100%: som metálico, flash azul e "BLOQUEADO!"
            A.play('block');
            R.triggerScreenFlash('#2f7dff', 0.3, 0.26);
            R.triggerEdgeFlash('60,150,255', 0.75, 0.4);
            R.triggerShake(0.025, 0.12);
            spawnFloatingText(c.x, c.y, 'BLOQUEADO!', 'blocked');
        } else {
            if (absorbed > 0) {
                A.play('block');
                spawnFloatingText(c.x, c.y + 70, 'Bloqueou ' + absorbed, 'shield');
            }
            state.hp = Math.max(0, state.hp - dmg);
            A.play('hurt');
            R.triggerShake(dmg >= 12 ? 0.13 : 0.09, 0.3);
            R.triggerEdgeFlash('216,40,30', dmg >= 12 ? 1 : 0.85, 0.5);
            spawnFloatingText(c.x, c.y, '-' + dmg, 'player-hit big-hit');
            pulseHeart();
            if (enemy.drainMana > 0) {
                state.manaDrain = enemy.drainMana;
                spawnFloatingText(c.x, c.y - 70, '-' + enemy.drainMana + ' CAFEÍNA no próximo turno!', 'buff');
            }
            const lowSanity = state.hp > 0 && state.hp <= Math.ceil(state.maxHp * 0.3);
            if (dmg >= 14 || lowSanity) {
                realityTriggered = true;
                triggerRealityFlash();
            }
        }
        if (!realityTriggered) {
            setLog(enemy.name + ': ' + D.ENEMIES[enemy.kind].quip);
        }
        renderHud();
    }

    function endTurn() {
        if (state.mode !== 'combat' || state.busy || state.autoPlaying) return;
        A.unlock();
        R.setHoveredCard(null);
        state.busy = true;
        renderCombatControls();

        // Se o Chefe estava apenas em OVERKILL aguardando o fim do turno, encerra a luta agora.
        if (state.enemies.every(e => e.hp <= 0)) {
            state.bossOverkillActive = false;
            state.enemies.forEach(e => { e.overkill = false; });
            finishEncounter();
            return;
        }

        // Encerra estado OVERKILL se ainda restarem lacaios vivos ao fim do turno.
        state.bossOverkillActive = false;
        state.enemies.forEach(e => { e.overkill = false; });

        // A ComboPile do turno só agora segue para o Descarte (não é recomprada no mesmo turno).
        state.discardPile.push(...state.comboPile);
        state.comboPile = [];
        state.comboChain = [];

        // Bomba de Mana que ficou na mão explode (o Escudo absorve) e cresce para a próxima vez.
        state.hand.filter(id => D.CARDS[id].endTurnBomb).forEach(() => {
            const bombDmg = getManaBombDamage();
            state.manaBombTicks += 1;
            const absorbed = Math.min(state.shield, bombDmg);
            state.shield -= absorbed;
            state.hp = Math.max(0, state.hp - (bombDmg - absorbed));
            const p = viewportPoint(0.5, 0.6);
            spawnFloatingText(p.x, p.y, 'BOMBA DE MANA -' + (bombDmg - absorbed), 'player-hit big-hit');
            A.play('hurt');
            R.triggerShake(0.09, 0.28);
            pulseHeart();
        });
        if (state.hp <= 0 && !tryRevive()) {
            state.busy = false;
            endGame(false);
            return;
        }

        // Tick de Burn por Coluna (0..4) no fim do turno do jogador, antes dos inimigos agirem.
        let burnTicked = false;
        let anyBurnOverkill = false;
        for (let col = 0; col < 5; col++) {
            const stacks = state.columnBurn[col] || 0;
            if (stacks <= 0) continue;
            const front = getFrontEnemyAtCol(col, false);
            if (front && front.hp > 0) {
                burnTicked = true;
                if (applyDamageToEnemy(front, stacks, null, 1, { isBurn: true }).overkill) {
                    anyBurnOverkill = true;
                }
            }
            state.columnBurn[col] = Math.max(0, stacks - 1);
        }
        if (burnTicked) {
            A.play('hit');
            if (anyBurnOverkill) triggerOverkillBanner();
            R.syncState(state);
            renderAll();
        }
        if (state.enemies.every(e => e.hp <= 0)) {
            state.bossOverkillActive = false;
            state.enemies.forEach(e => { e.overkill = false; });
            later(burnTicked ? 350 : 0, finishEncounter);
            return;
        }

        const frontActors = getFrontEnemies(false);
        const timings = R.getAttackTimings();
        let idx = 0;

        const stillFighting = () => {
            if (state.mode === 'combat') return true;
            state.busy = false;
            return false;
        };

        const attackOnce = (enemy, remaining, done) => {
            if (!stillFighting()) return;
            // Antecipação (pisca + recuo) -> investida ou projétil -> impacto
            R.triggerEnemyAttackAnim(enemy.uid, enemy.attackStyle);
            A.play('windup');
            later(timings.anticipation, () => A.play(enemy.attackStyle === 'lunge' ? 'lunge' : 'projectile'));
            later(timings.impact, () => {
                if (!stillFighting()) return;
                resolveEnemyHit(enemy);
                if (state.hp <= 0 && !tryRevive()) {
                    state.busy = false;
                    endGame(false);
                    return;
                }
                if (remaining > 1) later(360, () => attackOnce(enemy, remaining - 1, done));
                else later(520, done);
            });
        };

        const nextEnemyAction = () => {
            if (!stillFighting()) return;
            if (bossKeyOpen) {
                later(150, nextEnemyAction);
                return;
            }
            if (idx >= frontActors.length) {
                startPlayerTurn();
                return;
            }
            const enemy = frontActors[idx++];
            if (!enemy || enemy.hp <= 0) {
                nextEnemyAction();
                return;
            }
            const pos = getEnemyTargetPos(enemy);

            if (enemy.disarmed) {
                enemy.disarmed = false;
                enemy.hasIntent = false;
                spawnFloatingText(pos.x, pos.y, 'DESARMADO!', 'shield');
                setLog(enemy.name + ' teve o ataque desarmado!');
                R.syncState(state);
                later(380, nextEnemyAction);
                return;
            }

            if (enemy.stunned) {
                enemy.stunned = false;
                enemy.hasIntent = false;
                enemy.stunImmune = 1;
                spawnFloatingText(pos.x, pos.y, 'ATORDOADO!', 'shield');
                setLog(enemy.name + ' perdeu o turno!');
                R.syncState(state);
                later(420, nextEnemyAction);
                return;
            }

            if (enemy.intent === 'attack' && frostBlocksAttack(enemy)) {
                spawnFloatingText(pos.x, pos.y, 'CONGELADO!', 'shield');
                setLog(enemy.name + ' está congelado e perde o ataque.');
                later(380, nextEnemyAction);
                return;
            }

            if (enemy.intent === 'curse') {
                // Troca o ataque do turno por Curse: inimigos mais fortes, mais XP.
                enemy.turns += 1;
                raiseCurse(B.curseStep);
                R.triggerEnemyBuffAnim(enemy.uid, 'purple');
                A.play('buff');
                spawnFloatingText(pos.x, pos.y - 30, 'CURSE +' + B.curseStep + '%!', 'buff');
                setLog(enemy.name + ' aumenta a Curse: inimigos mais fortes, mais XP.');
                R.syncState(state);
                renderHud();
                later(520, nextEnemyAction);
                return;
            }

            if (enemy.intent === 'armor') {
                // EnemyActionArmor: troca o ataque do turno por Escudo.
                enemy.turns += 1;
                enemy.shield += enemy.armorGain;
                R.triggerEnemyBuffAnim(enemy.uid, 'ice');
                A.play('shield');
                spawnFloatingText(pos.x, pos.y - 30, '+' + enemy.armorGain + ' ESCUDO!', 'shield');
                setLog(enemy.name + ' se protege em vez de atacar.');
                R.syncState(state);
                later(520, nextEnemyAction);
                return;
            }

            if (!enemy.hasIntent) {
                spawnFloatingText(pos.x, pos.y, 'AVANÇOU!', 'shield');
                later(260, nextEnemyAction);
                return;
            }

            enemy.stunImmune = 0;
            enemy.turns += 1;
            const supportWait = runEnemySupport(enemy);
            later(supportWait, () => attackOnce(enemy, enemy.attacksPerTurn, nextEnemyAction));
        };

        later(burnTicked ? 360 : 0, nextEnemyAction);
    }

    // Fim do combate: espera a animação de morte, volta à exploração e deixa a fila de modais
    // (level ups acumulados, pausa/evento do tile, epílogo) conduzir o que vem depois.
    function finishEncounter() {
        state.busy = true;
        state.autoPlaying = false;
        state.bossOverkillActive = false;
        R.setHoveredCard(null);
        const enc = state.encounters.find(e => e.id === state.currentEncounterId);
        if (enc) enc.alive = false;
        state.currentEncounterId = null;
        renderCombatControls();

        later(R.getAttackTimings().death + 260, () => {
            if (state.mode === 'gameover') return;
            state.mode = 'explore';
            state.enemies = [];
            state.columnBurn = [0, 0, 0, 0, 0];
            state.comboCount = 0;
            state.lastComboCost = null;
            state.combo = 1;
            state.comboChain = [];
            state.comboPile = [];
            state.combatBuff = { Might: 0, Area: 0, Amount: 0 };
            state.shield = 0;
            state.busy = false;
            state.autoPlaying = false;

            const fl = currentFloor();
            R.syncState(state);
            renderAll();

            if (state.pendingDrop) {
                grantRelic(state.pendingDrop);
                state.pendingDrop = null;
            }

            const recovery = getStat('Recovery');
            if (recovery > 0 && state.hp < state.maxHp) {
                state.hp = Math.min(state.maxHp, state.hp + recovery);
                const heart = els.hpText.getBoundingClientRect();
                spawnFloatingText(heart.left + heart.width / 2, heart.top, '+' + recovery, 'heal');
                pulseHeart();
                renderHud();
            }
            // Elite derrotado: recompensa garantida de baú (loot + gema pela fila única).
            if (enc && enc.isElite) grantChestLoot();

            if (state.bossDefeated && state.floor === D.FLOORS.length) {
                setLog('O Senhor das Horas parou.');
                modalQueue.push({ type: 'epilogue' });
            } else {
                setLog(state.bossDefeated
                    ? 'CHEFE DERROTADO! "' + fl.conclusion + '" — ' + fl.exitHint
                    : 'Devaneio dispersado! Continue explorando ' + fl.name + '.');
                // O combate pode ter interrompido o evento do tile onde o jogador está
                // (inclusive a saída, quando o chefe é enfrentado de cima dela).
                const tile = fl.layout[state.player.y][state.player.x];
                if (tile === 'M' || tile === '?' || tile === 'E') handleTileEvent(state.player.x, state.player.y, tile);
            }
            processModalQueue();
        });
    }

    function endGame(victory) {
        state.mode = 'gameover';
        A.stopAmbience();
        state.busy = false;
        state.autoPlaying = false;
        state.finalVictory = !!victory;
        R.setHoveredCard(null);
        modalQueue = [];
        activeModal = null;
        [els.levelupModal, els.restModal, els.eventModal, els.narrativeModal, els.gemModal, els.arcanaModal].forEach(m => m.classList.add('hidden'));
        els.epilogueOverlay.classList.add('hidden');

        els.endBox.classList.toggle('defeat', !victory);
        els.endBox.classList.toggle('sunset', !!victory);
        els.endDesc.innerHTML = '';
        const lines = victory
            ? D.EPILOGUE.endLines
            : ['A Sanidade de ' + state.heroName + ' zerou em ' + currentFloor().name + '.', 'O devaneio venceu desta vez. O expediente recomeça.'];
        lines.forEach(line => {
            const p = document.createElement('p');
            p.textContent = line;
            els.endDesc.appendChild(p);
        });
        if (victory) {
            A.play('victory');
            els.endTitle.textContent = D.EPILOGUE.endTitle + ' — PONTO BATIDO';
        } else {
            A.play('defeat');
            els.endTitle.textContent = 'BURNOUT...';
        }
        els.endStats.textContent =
            'Seed ' + state.runSeed + '  |  FASE ' + state.floor + '/' + D.FLOORS.length + '  |  LV ' + state.level +
            '  |  VR: ' + state.vr + '  |  Abates: ' + state.kills + '  |  Overkills: ' + state.overkills;
        els.btnPlayAgain.textContent = victory ? 'VIVER OUTRO DIA' : 'TENTAR DE NOVO';
        els.endModal.classList.remove('hidden');
        renderAll();
    }

    // ---------- RENDERIZAÇÃO DA UI ----------
    function renderHud() {
        const xpPct = Math.min(100, Math.round((state.xp / state.xpNext) * 100));
        els.xpFill.style.width = xpPct + '%';
        els.statHero.textContent = state.heroTitle.toUpperCase();
        els.statLv.textContent = String(state.level);
        els.statFloor.textContent = 'FASE ' + state.floor + '/' + D.FLOORS.length;
        els.statKills.textContent = String(state.kills);
        els.statVr.textContent = String(state.vr);
        els.clockTime.textContent = state.finalVictory ? D.FLOOR_CLOCKS.victory : (D.FLOOR_CLOCKS[state.floor] || '08:17');

        if (els.statMight) els.statMight.textContent = '+' + getStat('Might') + '%';
        if (els.statAmount) els.statAmount.textContent = '+' + getStat('Amount');
        if (els.statArea) els.statArea.textContent = '+' + getStat('Area') + '%';
        if (els.statLuck) els.statLuck.textContent = '+' + ((state.stats && state.stats.Luck) || 0) + '%';
        if (els.statGrowth) els.statGrowth.textContent = '+' + ((state.stats && state.stats.Growth) || 0) + '%';
        if (els.statExtra) {
            // Stats raros só ocupam espaço na HUD quando ativos.
            const extras = [
                ['FRZ', getStat('Freeze'), '%'], ['REC', getStat('Recovery'), ''], ['DUR', getStat('Duration'), '%'],
                ['REV', state.revival, ''], ['CURSE', state.curse, '%']
            ].filter(item => item[1] > 0);
            els.statExtra.innerHTML = extras.map(item => '<span>' + item[0] + ' <b>+' + item[1] + item[2] + '</b></span>').join('');
        }
        els.statFloor.title = 'Seed ' + state.runSeed;

        els.hpText.textContent = state.hp + '/' + state.maxHp;
        if (state.shield > 0) {
            els.shieldVal.textContent = String(state.shield);
            els.shieldBadge.classList.remove('hidden');
        } else {
            els.shieldBadge.classList.add('hidden');
        }

        els.manaText.textContent = String(state.mana);
        els.manaSub.textContent = state.mana + '/' + state.maxMana;

        els.passivesStrip.innerHTML = '';
        state.passives.forEach(p => {
            const box = document.createElement('div');
            box.className = 'passive-icon-box';
            box.title = p.label;
            box.innerHTML = '<img src="' + S.getIconUrl(p.icon) + '" alt="" />';
            els.passivesStrip.appendChild(box);
        });
    }

    function buildCardKeywordsHtml(card, idx) {
        const pills = [];
        const aimLabels = { LeftRight: 'ESQ→DIR', RightLeft: 'DIR→ESQ', FrontRow: 'FRENTE', Random: 'ALEAT.' };
        if (card.isWild || card.type === 'wild') pills.push('<span class="card-kw-pill kw-wild">WILD</span>');
        if (aimLabels[card.targeting]) pills.push('<span class="card-kw-pill kw-aim">' + aimLabels[card.targeting] + '</span>');
        if (card.pierce > 0 || card.bouncy > 0) pills.push('<span class="card-kw-pill kw-aim">PIERCE</span>');
        if (card.critChance > 0) pills.push('<span class="card-kw-pill kw-crit">CRIT</span>');
        if (card.knockback) pills.push('<span class="card-kw-pill kw-kb">DESARME</span>');
        if (card.burn > 0) pills.push('<span class="card-kw-pill kw-burn">BURN</span>');
        if (card.returnTimes > 0) {
            const rem = Math.max(0, card.returnTimes - ((state.handReturnCounts && state.handReturnCounts[idx]) || 0));
            if (rem > 0) pills.push('<span class="card-kw-pill kw-return">RET</span>');
        }
        if (card.retain) pills.push('<span class="card-kw-pill kw-retain">RETAIN</span>');
        if (card.destroy) pills.push('<span class="card-kw-pill kw-destroy">DESTROY</span>');
        return pills.length > 0 ? '<div class="card-kw-row">' + pills.slice(0, 3).join('') + '</div>' : '';
    }

    function renderCombatControls(popCombo) {
        const inCombat = state.mode === 'combat';
        els.explorePanel.classList.toggle('hidden', inCombat);
        els.combatPanel.classList.toggle('hidden', !inCombat);
        document.body.classList.toggle('in-combat', inCombat);

        els.comboChain.classList.toggle('hidden', !inCombat);
        if (!inCombat) {
            els.comboBadge.classList.add('hidden');
            R.setHoveredCard(null);
            return;
        }

        // Mini-pilha da cadeia: últimas cartas jogadas + o custo que mantém o combo.
        const hasChain = state.lastComboCost !== null && state.lastComboCost !== undefined;
        els.comboChainCards.innerHTML = state.comboChain.slice(-5).map(id =>
            '<span class="chain-card' + (D.isWildCard(cardOf(id)) ? ' wild' : '') + '">' +
            '<img src="' + S.getIconUrl(cardOf(id).icon) + '" alt="" /><b>' +
            (D.isWildCard(cardOf(id)) ? 'W' : cardOf(id).cost) + '</b></span>').join('') +
            '<span class="chain-next" title="Próximo custo que mantém o combo">' +
            (state.comboCarry ? '▸*' : hasChain ? '▸' + (state.lastComboCost + 1) : '▸?') + '</span>';
        els.pileCounts.textContent = 'COMPRA ' + state.drawPile.length + ' · DESC ' +
            (state.discardPile.length + state.comboPile.length);

        const currentMult = D.getComboMult(state.comboCount);
        els.comboBadge.classList.remove('hidden');
        els.comboNum.textContent = 'x' + currentMult;
        els.comboBonus.textContent = comboBonusLabel(currentMult);
        if (popCombo) {
            els.comboBadge.classList.remove('pop');
            void els.comboBadge.offsetWidth;
            els.comboBadge.classList.add('pop');
        }

        const locked = state.busy || state.autoPlaying;
        els.btnPlayAll.disabled = locked || !state.hand.some(isUsefulCard);
        els.btnEndTurn.disabled = locked;

        els.handGrid.innerHTML = '';
        els.handGrid.setAttribute('data-count', String(state.hand.length));
        state.hand.forEach((cardId, idx) => {
            const card = cardOf(cardId);
            const costMod = state.handCostMods[idx] || 0;
            const effCost = getHandCost(idx);
            const isWild = D.isWildCard(card);
            const willCombo = card.type !== 'curse' &&
                (state.comboCarry || D.canCardCombo(card, state.lastComboCost, costMod, state.comboReverse));
            const nextMult = willCombo ? (state.comboCount + 2) : 1;
            const pv = getCardPreviewValues(card, nextMult, true);
            const desc = formatCardDesc(card, pv);
            const lvl = getCardLevel(card.id);

            let powerTag = '';
            if (pv.damage > 0) powerTag = pv.hits > 1 ? pv.damage + 'x' + pv.hits : String(pv.damage);
            else if (pv.shield > 0) powerTag = '+' + pv.shield;
            else if (pv.heal > 0) powerTag = '+' + pv.heal + ' HP';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card-btn ' + card.type +
                (isWild ? ' wild' : '') +
                (card.evolved ? ' evolved' : '') +
                (willCombo ? ' combo-ready' : '');
            btn.disabled = locked || state.mana < effCost;
            btn.innerHTML =
                '<span class="card-cost' + (costMod > 0 ? ' cost-up' : costMod < 0 ? ' cost-down' : '') + '">' + effCost + '</span>' +
                (powerTag ? '<span class="card-power-tag">' + powerTag + '</span>' : '') +
                '<div class="card-banner"><span class="card-name">' + card.name +
                (lvl >= B.maxCardLevel && card.evolvesTo && !card.evolved ? ' ★MÁX' : '') +
                '</span></div>' +
                '<div class="card-art"><img src="' + S.getIconUrl(card.icon) + '" alt="" /></div>' +
                '<div class="card-textbox"><div class="card-origin">' + card.origin + '</div>' +
                buildCardKeywordsHtml(card, idx) +
                '<div class="card-desc">' + desc + '</div></div>' +
                gemSlotsHtml(cardId);
            btn.addEventListener('mouseenter', () => {
                if (btn.disabled || !(card.damage > 0 || card.knockback || card.burn > 0)) return;
                // Prévia da mira: o renderer marca os alvos do 1º acerto (saco Random não é previsível).
                const preview = card.targeting === 'Random'
                    ? getFrontEnemies(true)
                    : pickTargetsForCard(card, { lastCol: null, bag: [] });
                R.setHoveredCard(Object.assign({}, card, { previewUids: preview.map(e => e.uid) }));
            });
            btn.addEventListener('mouseleave', () => R.setHoveredCard(null));
            btn.addEventListener('click', () => playCard(idx));
            els.handGrid.appendChild(btn);
        });
    }

    function renderAll(popCombo) {
        renderHud();
        renderCombatControls(popCombo);
    }

    function renderBadge() {
        const hero = D.CHARACTERS[0];
        els.badgeSelectGrid.innerHTML =
            '<div class="badge-card selected solo">' +
            '<span class="badge-code">' + hero.badgeCode + ' &middot; ' + hero.dept + '</span>' +
            '<img src="' + S.getIconUrl(hero.icon) + '" alt="" />' +
            '<div class="badge-name">' + hero.name + '</div>' +
            '<div class="badge-role">' + hero.role + ' (' + hero.title + ')</div>' +
            '<div class="badge-desc">' + hero.desc + '</div>' +
            '</div>';
    }

    function initWorld() {
        state = createInitialState();
        const fl = currentFloor();
        R.setHoveredCard(null);
        R.buildMap(fl.layout, state);
        R.syncState(state);
        renderAll();
    }

    function openTitleModal() {
        bossKeyOpen = false;
        A.stopAmbience();
        els.spreadsheetModal.classList.add('hidden');
        resetModalSystem();
        initWorld();
        renderBadge();
        els.titleModal.classList.remove('hidden');
    }

    function confirmStartDaydream() {
        if (!isTitleOpen()) return;
        A.unlock();
        A.play('levelup');
        els.titleModal.classList.add('hidden');
        const fl = currentFloor();
        A.setAmbience(fl.biome);
        enqueueModal(triggerCard(fl, () => {
            document.body.classList.remove('daydream-transition');
            void document.body.offsetWidth;
            document.body.classList.add('daydream-transition');
            setTimeout(() => document.body.classList.remove('daydream-transition'), 720);
            setLog('Fase 1/' + D.FLOORS.length + ': ' + fl.name + ' — Chefe: ' + fl.bossName + '!');
        }));
        enqueueModal({ type: 'arcana' });
    }

    function toggleBossKey() {
        bossKeyOpen = !bossKeyOpen;
        els.spreadsheetModal.classList.toggle('hidden', !bossKeyOpen);
    }

    // ---------- EVENTOS DE ENTRADA ----------
    els.btnTurnLeft.addEventListener('click', () => turnPlayer(-1));
    els.btnMoveFwd.addEventListener('click', () => moveRelative(1, 0));
    els.btnTurnRight.addEventListener('click', () => turnPlayer(1));
    els.btnStrafeLeft.addEventListener('click', () => moveRelative(0, -1));
    els.btnMoveBack.addEventListener('click', () => moveRelative(-1, 0));
    els.btnStrafeRight.addEventListener('click', () => moveRelative(0, 1));

    els.btnPlayAll.addEventListener('click', playAllCards);
    els.btnEndTurn.addEventListener('click', endTurn);
    els.btnBossKey.addEventListener('click', toggleBossKey);
    els.btnCloseSpreadsheet.addEventListener('click', toggleBossKey);
    els.btnStartDaydream.addEventListener('click', confirmStartDaydream);

    if (els.btnLvlReroll) {
        els.btnLvlReroll.addEventListener('click', () => {
            if (!activeModal || activeModal.type !== 'levelup' || modalActionLocked || state.rerollsLeft <= 0) return;
            A.unlock();
            state.rerollsLeft -= 1;
            state.banishMode = false;
            A.play('card');
            activeModal.choices = buildLevelUpChoices();
            renderLevelUpModal();
            renderHud();
        });
    }
    if (els.btnLvlSkip) {
        els.btnLvlSkip.addEventListener('click', () => {
            if (!activeModal || activeModal.type !== 'levelup' || modalActionLocked || state.skipsLeft <= 0) return;
            modalActionLocked = true;
            A.unlock();
            A.play('xpTick');
            const skipXp = Math.max(2, Math.round(state.xpNext * 0.20));
            state.skipsLeft -= 1;
            state.pendingLevelUps = Math.max(0, state.pendingLevelUps - 1);
            state.banishMode = false;
            setLog('Level Up pulado! +' + skipXp + ' XP.');
            gainXp(skipXp);
            closeActiveModal();
        });
    }
    if (els.btnLvlBanish) {
        els.btnLvlBanish.addEventListener('click', () => {
            if (!activeModal || activeModal.type !== 'levelup' || modalActionLocked) return;
            if (!state.banishMode && state.banishesLeft <= 0) return;
            A.unlock();
            A.play('card');
            state.banishMode = !state.banishMode;
            renderLevelUpModal();
        });
    }

    els.btnGemDiscard.addEventListener('click', guardModalAction(() => {
        if (activeModal.type !== 'gem') {
            modalActionLocked = false;
            return;
        }
        state.vr += B.gemDiscardVr;
        A.play('card');
        setLog('Gema recusada: +' + B.gemDiscardVr + ' VR.');
        renderHud();
        closeActiveModal();
    }));

    els.btnRestClose.addEventListener('click', () => {
        if (!activeModal || activeModal.type !== 'rest') return;
        A.unlock();
        closeActiveModal();
    });

    els.btnNarrativeContinue.addEventListener('click', guardModalAction(() => {
        if (activeModal.type !== 'narrative') {
            modalActionLocked = false;
            return;
        }
        A.play('card');
        closeActiveModal(item => { if (item.onClose) item.onClose(); });
    }));

    els.btnPunchClock.addEventListener('click', guardModalAction(() => {
        if (activeModal.type !== 'epilogue') {
            modalActionLocked = false;
            return;
        }
        endGame(true);
    }));

    els.btnMute.addEventListener('click', () => {
        const isMuted = A.toggleMute();
        els.iconSoundOn.classList.toggle('hidden', isMuted);
        els.iconSoundOff.classList.toggle('hidden', !isMuted);
    });
    els.btnRestart.addEventListener('click', openTitleModal);
    els.btnPlayAgain.addEventListener('click', openTitleModal);

    window.addEventListener('keydown', ev => {
        if (ev.key === 'p' || ev.key === 'P') {
            ev.preventDefault();
            toggleBossKey();
            return;
        }
        if (bossKeyOpen) {
            if (ev.key === 'Escape') {
                ev.preventDefault();
                toggleBossKey();
            }
            return;
        }
        if (isTitleOpen() || !state || state.mode === 'gameover') return;

        if (activeModal !== null) {
            if (activeModal.type === 'rest' && ev.key === 'Escape') els.btnRestClose.click();
            if (activeModal.type === 'narrative' && (ev.key === 'Enter' || ev.key === ' ')) {
                ev.preventDefault();
                els.btnNarrativeContinue.click();
            }
            return;
        }

        if (state.mode === 'explore') {
            switch (ev.key) {
                case 'w': case 'W': case 'ArrowUp':
                    ev.preventDefault(); moveRelative(1, 0); break;
                case 's': case 'S': case 'ArrowDown':
                    ev.preventDefault(); moveRelative(-1, 0); break;
                case 'a': case 'A': case 'ArrowLeft':
                    ev.preventDefault(); turnPlayer(-1); break;
                case 'd': case 'D': case 'ArrowRight':
                    ev.preventDefault(); turnPlayer(1); break;
                case 'q': case 'Q':
                    ev.preventDefault(); moveRelative(0, -1); break;
                case 'e': case 'E':
                    ev.preventDefault(); moveRelative(0, 1); break;
            }
        } else if (state.mode === 'combat') {
            if (state.autoPlaying) return;
            if (ev.key >= '1' && ev.key <= '6') {
                ev.preventDefault();
                playCard(Number(ev.key) - 1);
            } else if (ev.key === ' ') {
                ev.preventDefault();
                playAllCards();
            } else if (ev.key === 'Enter') {
                ev.preventDefault();
                endTurn();
            } else if (ev.key === 'Tab') {
                ev.preventDefault();
                const fronts = getFrontEnemies(true);
                if (fronts.length > 1) {
                    const cur = fronts.findIndex(e => e.uid === state.targetUid);
                    state.targetUid = fronts[(cur + 1) % fronts.length].uid;
                    R.syncState(state);
                }
            }
        }
    });

    R.init({
        glCanvas: els.glCanvas,
        hudCanvas: els.hudCanvas,
        miniCanvas: els.miniCanvas,
        onSelectEnemy: uid => {
            if (state.mode !== 'combat') return;
            const clicked = state.enemies.find(e => e.uid === uid && (e.hp > 0 || e.overkill));
            if (!clicked) return;
            if (clicked.row > 0) {
                const frontInCol = getFrontEnemyAtCol(clicked.col, true);
                if (frontInCol) {
                    state.targetUid = frontInCol.uid;
                    setLog('Alvo ajustado para a linha de frente da coluna ' + (clicked.col + 1) + '!');
                }
            } else {
                state.targetUid = clicked.uid;
            }
            A.play('card');
            R.syncState(state);
        }
    });

    // Gancho de teste/bot (contrato usado pelos scripts de calibragem).
    window.__hcDebug = {
        get state() { return state; },
        get activeModal() { return activeModal; },
        get seed() { return state.runSeed; },
        getFloor: currentFloor,
        playCard: playCard,
        playAllCards: playAllCards,
        endTurn: endTurn,
        moveRelative: moveRelative,
        turnPlayer: turnPlayer,
        sortCardsByCombo: sortCardsByCombo,
        isUsefulCard: isUsefulCard,
        startEncounter: startEncounter,
        restart: openTitleModal,
        grantGem: grantGem,
        socketGem: socketGem,
        setArcana: setArcana
    };

    openTitleModal();
})();

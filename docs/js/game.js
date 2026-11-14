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

    function currentFloor() {
        return D.getFloorConfig(state.floor);
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
                    alive: true
                });
            }
        }
        return list;
    }

    function encounterAt(x, y) {
        return state.encounters.find(e => e.alive && e.x === x && e.y === y) || null;
    }

    function findStartPos(layout) {
        for (let y = 0; y < layout.length; y++) {
            const x = layout[y].indexOf('S');
            if (x >= 0) return { x: x, y: y };
        }
        return { x: 4, y: 7 };
    }

    function createInitialState() {
        const fl = D.getFloorConfig(1);
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
            player: { x: start.x, y: start.y, dir: 0 },
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
            stats: { Might: 0, Amount: 0, Area: 0, Luck: 0, Growth: 0 },
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
        const map = layout || D.getFloorConfig(s.floor).layout;
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
        const fl = D.getFloorConfig(floorNum);
        const start = findStartPos(fl.layout);
        state.floor = fl.floor;
        state.player.x = start.x;
        state.player.y = start.y;
        state.player.dir = 0;
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

    function getCardPreviewValues(card, comboMult) {
        const mult = Math.max(1, comboMult || 1);
        const stats = (state && state.stats) || { Might: 0, Amount: 0, Area: 0, Luck: 0, Growth: 0 };
        const mightMult = 1 + ((stats.Might || 0) / 100);
        const statAmt = stats.Amount || 0;

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
            burn: card.burn || 0
        };
    }

    function formatCardDesc(card, preview) {
        const pv = preview || getCardPreviewValues(card, 1);
        return (card.desc || '')
            .replace(/\{HITS\}/g, String(pv.hits))
            .replace(/\{DMG\}/g, String(pv.damage))
            .replace(/\{SHIELD\}/g, String(pv.shield))
            .replace(/\{HEAL\}/g, String(pv.heal))
            .replace(/\{BURN\}/g, String(pv.burn));
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
        const effectiveXp = Math.max(1, Math.round((1 + ((state.stats && state.stats.Growth) || 0) / 100) * amount));
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
        [els.levelupModal, els.restModal, els.eventModal, els.narrativeModal].forEach(m => m.classList.add('hidden'));
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
        [els.levelupModal, els.restModal, els.eventModal, els.narrativeModal, els.endModal].forEach(m => m.classList.add('hidden'));
        els.epilogueOverlay.classList.add('hidden');
    }

    function getEligibleLevelUpPool() {
        return D.LEVEL_UP_REWARDS.filter(rw => {
            if (state.banishedIds && state.banishedIds.includes(rw.id)) return false;
            if (rw.once && (state.takenRewards.includes(rw.id) || state.relics.includes(rw.id))) return false;
            if (rw.id && rw.id.indexOf('up_') === 0 && getCardLevel(rw.id.slice(3)) >= B.maxCardLevel) return false;
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
        return choices.slice(0, slotCount);
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
        if (!state.restUsed[state.floor]) state.restUsed[state.floor] = { remove: false, relic: false };
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
            renderRestModal();
            setTimeout(() => { modalActionLocked = false; }, 160);
        });
        els.restItemsGrid.appendChild(btn);
    }

    function renderRestModal() {
        const fl = currentFloor();
        const rest = B.rest;
        const flags = restFlags();
        els.restTitle.textContent = fl.restName.toUpperCase();
        els.restVrVal.textContent = String(state.vr);
        els.restItemsGrid.innerHTML = '';

        if (activeModal.view === 'remove') {
            els.restDesc.textContent = 'Escolha 1 carta para deixar para trás (' + rest.removePrice + ' VR):';
            const counts = {};
            state.deck.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
            Object.keys(counts).forEach(id => {
                const card = D.CARDS[id];
                addRestItem({
                    title: card.name + (counts[id] > 1 ? ' x' + counts[id] : ''),
                    desc: formatCardDesc(card, getCardPreviewValues(card, 1)),
                    icon: card.icon,
                    priceText: 'REMOVER',
                    onPick: () => {
                        state.vr -= rest.removePrice;
                        state.deck.splice(state.deck.indexOf(id), 1);
                        flags.remove = true;
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
        addRestItem({
            title: 'Deixar um Peso',
            desc: 'Remove 1 carta fraca/lixo do baralho (1 vez por fase).',
            icon: 'ata',
            disabled: flags.remove || !canRemove || state.vr < rest.removePrice,
            priceText: flags.remove ? 'JÁ USADO' : !canRemove ? 'BARALHO MÍNIMO' : rest.removePrice + ' VR',
            onPick: () => { activeModal.view = 'remove'; A.play('card'); }
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
        const next = D.getFloorConfig(state.floor + 1);
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
        R.syncState(state);
        R.settleCamera();
        R.showEpilogue({
            bosses: [
                { kind: 'kraken', x: 3, y: 3 },
                { kind: 'mensageiro', x: 5, y: 3 },
                { kind: 'estrategista', x: 2, y: 2 },
                { kind: 'guardia', x: 6, y: 2 }
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
            if (!enc.alive || enc.isBoss) return;
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
        const loot = D.CHEST_LOOT[chestIndex % D.CHEST_LOOT.length];
        chestIndex++;
        state.hp = Math.min(state.maxHp, state.hp + loot.hp);
        state.vr += loot.vr;
        A.play('chest');
        setLog(loot.title + ': ' + loot.text);
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
    function makeEnemy(kind, summoned, col, row) {
        const tpl = D.getEnemyStats(kind);
        return {
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
            hasIntent: false,
            disarmed: false,
            overkill: false,
            killedOnce: false,
            immuneKnockback: !!tpl.immuneKnockback,
            buffAllies: tpl.buffAllies || 0,
            curseCard: tpl.curseCard || null,
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
            stunImmune: 0
        };
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
                e.hasIntent = false;
                return;
            }
            if (isNewTurn) e.disarmed = false;
            e.hasIntent = e.row === 0 && !e.disarmed && !e.stunned && (e.atk > 0 || e.attacksPerTurn > 0);
        });
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
        state.bossOverkillActive = false;
        state.columnBurn = [0, 0, 0, 0, 0];
        state.pendingDrop = null;

        const formation = Array.isArray(enc.formation) && enc.formation.length > 0
            ? enc.formation
            : enc.enemies.map((kind, i) => ({ kind: kind, col: [2, 1, 3, 0, 4][i % 5], row: Math.floor(i / 5) }));
        state.enemies = formation.slice(0, D.MAX_ENEMIES_IN_COMBAT)
            .map(slot => makeEnemy(slot.kind, false, slot.col, slot.row));

        refreshFrontIntents(true);
        const fronts = getFrontEnemies(false);
        state.targetUid = (fronts[0] || state.enemies[0]).uid;

        state.drawPile = shuffle(state.deck);
        state.discardPile = [];
        state.destroyedPile = [];
        state.hand = [];
        state.handReturnCounts = [];
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

    function drawCards(count) {
        for (let i = 0; i < count; i++) {
            if (state.drawPile.length === 0) {
                if (state.discardPile.length === 0) break;
                state.drawPile = shuffle(state.discardPile);
                state.discardPile = [];
            }
            if (state.drawPile.length > 0) {
                state.hand.push(state.drawPile.pop());
                state.handReturnCounts.push(0);
            }
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

    function pickTargetForCard(card, hitIndex) {
        const fronts = getFrontEnemies(true);
        const pool = fronts.length > 0 ? fronts : state.enemies.filter(e => e.hp > 0 || e.overkill);
        if (pool.length === 0) return null;

        const attackers = pool.filter(e => e.hp > 0 && e.hasIntent && !e.disarmed && !e.stunned);
        if (card && card.target === 'all' && card.amountScalesWithCombo) {
            if (attackers.length > 0) return attackers[(hitIndex || 0) % attackers.length];
            const living = pool.filter(e => e.hp > 0);
            if (living.length > 0) return living[(hitIndex || 0) % living.length];
            return pool[(hitIndex || 0) % pool.length];
        }

        const current = getTargetEnemy();
        if (card && card.prioritizeAttackers) {
            if (current && current.hp > 0 && current.hasIntent && !current.disarmed && !current.stunned) {
                return current;
            }
            if (attackers.length > 0) return attackers[0];
        }
        return current;
    }

    function comboBonusLabel(mult) {
        const m = Math.max(1, mult || 1);
        const nextReq = (state && state.lastComboCost !== null && state.lastComboCost !== undefined)
            ? 'PRÓX: C' + (state.lastComboCost + 1) + ' ou WILD'
            : 'INICIE C/ C0 ou WILD';
        return 'COMBO ' + m + 'x • ' + nextReq;
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
                spawnFloatingText(pos.x, pos.y - 14, 'CRIT! -' + remaining, 'combo big-hit');
                R.spawnBurst(pos.x, pos.y, ['#ffd147', '#fff2a8'], 10, { speed: 140, life: 0.4, size: 5 });
            } else if (o.isSplash) {
                spawnFloatingText(pos.x, pos.y - 6, 'Área -' + remaining, 'shield');
            } else if (o.isBurn) {
                spawnFloatingText(pos.x, pos.y - 12, 'Burn -' + remaining, 'player-hit');
            } else {
                spawnFloatingText(pos.x, pos.y - 10, '-' + remaining, '');
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

                state.kills += 1;
                const gainedVr = enemy.vr + bonusVr;
                state.vr += gainedVr;
                A.play('death');
                R.spawnBurst(pos.x, pos.y, ['#3cc8ff', '#b8f4ff', '#ffd147', '#fff2a8'], 16, { speed: 170, life: 0.55, size: 6 });
                spawnXpParticles(pos.x, pos.y, enemy.xp + bonusXp);
                spawnVrParticles(pos.x, pos.y + 12, gainedVr);

                if (!enemy.overkill) {
                    enemy.hasIntent = false;
                    normalizeColumns();
                }
            }
        }

        // Splash de Area (%) nas colunas vizinhas (col - 1 e col + 1)
        const areaPct = (!o.isSplash && !o.isBurn && state.stats && state.stats.Area) ? state.stats.Area : 0;
        if (areaPct > 0 && dmg > 0) {
            const splashDmg = Math.max(1, Math.round(dmg * (areaPct / 100)));
            [enemy.col - 1, enemy.col + 1].forEach(adjCol => {
                if (adjCol < 0 || adjCol > 4) return;
                const adjFront = getFrontEnemyAtCol(adjCol, true);
                if (adjFront && adjFront.uid !== enemy.uid) {
                    applyDamageToEnemy(adjFront, splashDmg, card, usedMult, { isSplash: true });
                }
            });
        }

        return { overkill: overkill, dealt: dmg };
    }

    // Knockback (Desarme): compara knockbackChance * LuckMultiplier > rand(); se passar, CANCELA intenção de ataque.
    function tryKnockback(enemy, card, pos) {
        if (!enemy || enemy.hp <= 0 || enemy.overkill) return;
        if (enemy.immuneKnockback) {
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
        if (chance > Math.random()) {
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
        if (card.id === 'julgamento_final') {
            for (let c = 0; c < 5; c++) {
                state.columnBurn[c] += card.burn;
            }
            const cp = R.getColumnScreenPos(2);
            spawnFloatingText(cp.x, cp.y - 34, '+' + card.burn + ' BURN (5 Colunas)', 'player-hit');
            return;
        }
        if (card.target === 'all') {
            const cols = [];
            getFrontEnemies(true).forEach(e => {
                if (!cols.includes(e.col)) cols.push(e.col);
            });
            if (cols.length === 0) {
                for (let c = 0; c < 5; c++) cols.push(c);
            }
            cols.forEach(c => {
                state.columnBurn[c] += card.burn;
                const cp = R.getColumnScreenPos(c);
                spawnFloatingText(cp.x, cp.y - 26, '+' + card.burn + ' BURN', 'player-hit');
            });
            return;
        }
        if (singleTarget) {
            state.columnBurn[singleTarget.col] += card.burn;
            const cp = R.getColumnScreenPos(singleTarget.col);
            spawnFloatingText(cp.x, cp.y - 26, '+' + card.burn + ' BURN', 'player-hit');
        }
    }

    function playCard(handIndex) {
        if (state.mode !== 'combat' || state.busy) return false;
        const cardId = state.hand[handIndex];
        if (!cardId) return false;
        const card = D.CARDS[cardId];
        const effCost = D.getEffectiveCost(card);
        if (!card || state.mana < effCost) return false;

        A.unlock();
        R.setHoveredCard(null);
        state.mana -= effCost;
        state.hand.splice(handIndex, 1);
        const returnCount = state.handReturnCounts.splice(handIndex, 1)[0] || 0;

        if (card.purgeOnPlay) {
            state.destroyedPile.push(cardId);
            state.comboCount = 0;
            state.lastComboCost = null;
            state.combo = 1;
            A.play('card');
            setLog(card.name + ' queimada da luta!');
            R.syncState(state);
            renderAll();
            checkCombatEnd();
            return true;
        }

        // Regra estrita v1.6.1a: effectiveCost - 1 === lastComboCost OU Wild (custo 0, continua a cadeia)
        const chained = state.lastComboCost !== null && D.canCardCombo(card, state.lastComboCost);
        state.comboCount = chained ? state.comboCount + 1 : 0;
        const isWild = !!(card.isWild || card.type === 'wild');
        if (isWild) {
            if (state.lastComboCost === null) state.lastComboCost = 0;
        } else {
            state.lastComboCost = effCost;
        }
        const usedMult = D.getComboMult(state.comboCount);
        state.combo = usedMult;

        // Destino da carta jogada: Destroy / Return / Discard
        let returnedToHand = false;
        if (card.destroy) {
            state.destroyedPile.push(cardId);
            if (card.permMaxHp > 0) {
                state.maxHp = Math.min(B.maxHpCap, state.maxHp + card.permMaxHp);
                state.hp = Math.min(state.maxHp, state.hp + card.permMaxHp);
            }
            if (card.permGrowth > 0) {
                state.stats.Growth += card.permGrowth;
            }
            if (card.permMaxHp > 0 || card.permGrowth > 0) {
                const p = viewportPoint(0.5, 0.56);
                spawnFloatingText(p.x, p.y, '+' + (card.permMaxHp || 0) + ' HP Máx / +' + (card.permGrowth || 0) + '% Grw', 'combo');
                if (!state.passives.some(item => item.label && item.label.indexOf(card.name) === 0)) {
                    state.passives.push({
                        label: card.name + ': +' + (card.permMaxHp || 0) + ' HP Máx, +' + (card.permGrowth || 0) + '% Growth',
                        icon: card.icon
                    });
                }
            }
        } else if (card.returnTimes && returnCount < card.returnTimes && state.hand.length < 7) {
            state.hand.push(cardId);
            state.handReturnCounts.push(returnCount + 1);
            returnedToHand = true;
        } else {
            state.discardPile.push(cardId);
        }

        const pv = getCardPreviewValues(card, usedMult);

        if (pv.shield > 0) {
            state.shield += pv.shield;
            const p = viewportPoint(0.5, 0.72);
            spawnFloatingText(p.x, p.y, '+' + pv.shield + ' Escudo', 'shield');
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

        const totalHits = pv.hits > 0 ? pv.hits : 1;
        if (pv.damage > 0 && totalHits > 1) {
            state.busy = true;
            let hitNum = 0;
            let anyOverkill = false;
            let burnApplied = false;
            if (usedMult > 1) setTimeout(() => A.play('combo', usedMult), 60);

            const runHit = () => {
                if (state.mode !== 'combat') {
                    state.busy = false;
                    return;
                }
                const target = pickTargetForCard(card, hitNum);
                if (!target || hitNum >= totalHits) {
                    state.busy = false;
                    if (anyOverkill) triggerOverkillBanner();
                    let msg = card.name + ': ' + hitNum + ' golpes!' +
                        (usedMult > 1 ? ' [COMBO ' + usedMult + 'x]' : '');
                    if (returnedToHand) msg += ' [RETURN]';
                    if (card.destroy) msg += ' [DESTROY]';
                    setLog(msg);
                    getTargetEnemy();
                    R.syncState(state);
                    renderAll(true);
                    checkCombatEnd();
                    return;
                }
                if (!burnApplied && card.burn > 0) {
                    applyBurnForCard(card, target);
                    burnApplied = true;
                }
                A.play(card.sfx);
                if (applyDamageToEnemy(target, pv.damage, card, usedMult).overkill) anyOverkill = true;
                if (card.knockback && target.hp > 0) {
                    tryKnockback(target, card, getEnemyTargetPos(target));
                }
                hitNum++;
                R.syncState(state);
                renderAll();
                later(155, runHit);
            };
            runHit();
            return true;
        }

        A.play(card.sfx);
        if (usedMult > 1) setTimeout(() => A.play('combo', usedMult), 60);

        let targets = [];
        if (card.target === 'all') {
            targets = getFrontEnemies(true);
        } else if (card.target === 'single') {
            const t = pickTargetForCard(card, 0);
            if (t) targets = [t];
        }

        if (card.burn > 0) {
            applyBurnForCard(card, targets[0] || null);
        }

        let logMsg = card.name;
        if (usedMult > 1) logMsg += ' [COMBO ' + usedMult + 'x]';
        else if (isWild) logMsg += ' [WILD]';
        if (returnedToHand) logMsg += ' [RETURN]';
        if (card.destroy) logMsg += ' [DESTROY]';

        let overkillTriggered = false;
        targets.forEach(enemy => {
            const pos = getEnemyTargetPos(enemy);
            if (pv.damage > 0 && applyDamageToEnemy(enemy, pv.damage, card, usedMult).overkill) {
                overkillTriggered = true;
            }
            if (card.knockback && enemy.hp > 0) tryKnockback(enemy, card, pos);
        });

        if (overkillTriggered) {
            triggerOverkillBanner();
            logMsg += ' — OVERKILL!';
        }

        setLog(logMsg);
        getTargetEnemy();
        R.syncState(state);
        renderAll(true);
        checkCombatEnd();
        return true;
    }

    function isUsefulCard(id) {
        const c = D.CARDS[id];
        if (!c || c.purgeOnPlay) return false;
        if (D.getEffectiveCost(c) > state.mana) return false;
        const hasTarget = state.enemies.some(e => e.hp > 0 || e.overkill);
        if (c.damage > 0 || c.knockback || c.burn > 0) return hasTarget;
        return c.shield > 0 || c.heal > 0 || c.manaGain > 0 || c.destroy || c.permMaxHp > 0 || c.permGrowth > 0;
    }

    // Ordena os índices da mão começando em targetCost = 0 (ou lastComboCost + 1) e seguindo +1 / Wild.
    function sortCardsByCombo(indices, currentLastCost, availableMana) {
        const remaining = (indices || state.hand.map((_, i) => i)).filter(idx => isUsefulCard(state.hand[idx]));
        const ordered = [];
        let simLastCost = currentLastCost !== undefined ? currentLastCost : state.lastComboCost;
        let simMana = availableMana !== undefined ? availableMana : state.mana;

        while (remaining.length > 0) {
            const feasible = remaining.filter(idx => D.getEffectiveCost(D.CARDS[state.hand[idx]]) <= simMana);
            if (feasible.length === 0) break;

            const targetCost = (simLastCost === null || simLastCost === undefined) ? 0 : simLastCost + 1;

            let chosenIdx = feasible.find(idx => {
                const c = D.CARDS[state.hand[idx]];
                return !c.isWild && c.type !== 'wild' && D.getEffectiveCost(c) === targetCost;
            });

            if (chosenIdx === undefined) {
                chosenIdx = feasible.find(idx => {
                    const c = D.CARDS[state.hand[idx]];
                    return c.isWild || c.type === 'wild';
                });
            }

            if (chosenIdx === undefined) {
                feasible.sort((a, b) => D.getEffectiveCost(D.CARDS[state.hand[a]]) - D.getEffectiveCost(D.CARDS[state.hand[b]]));
                chosenIdx = feasible[0];
            }

            const chosenCard = D.CARDS[state.hand[chosenIdx]];
            ordered.push(chosenIdx);
            remaining.splice(remaining.indexOf(chosenIdx), 1);

            const effCost = D.getEffectiveCost(chosenCard);
            simMana = Math.max(0, simMana - effCost + (chosenCard.manaGain || 0));
            if (chosenCard.isWild || chosenCard.type === 'wild') {
                if (simLastCost === null || simLastCost === undefined) simLastCost = 0;
            } else {
                simLastCost = effCost;
            }
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

    function startPlayerTurn(pendingCurses) {
        state.mana = Math.max(1, state.maxMana - (state.manaDrain || 0));
        const drained = state.manaDrain || 0;
        state.manaDrain = 0;
        state.comboCount = 0;
        state.lastComboCost = null;
        state.combo = 1;
        // O Escudo acumulado expira no início do turno do jogador.
        state.shield = 0;

        // Cartas com Retain permanecem na mão; demais vão para o descarte.
        const retainedIds = [];
        const retainedReturns = [];
        for (let i = 0; i < state.hand.length; i++) {
            const cid = state.hand[i];
            const c = D.CARDS[cid];
            if (c && c.retain) {
                retainedIds.push(cid);
                retainedReturns.push(0);
            } else {
                state.discardPile.push(cid);
            }
        }
        state.hand = retainedIds;
        state.handReturnCounts = retainedReturns;

        drawCards(state.dealCount || B.dealCount);
        pendingCurses.forEach(curseId => {
            if (state.hand.length < 7) {
                state.hand.push(curseId);
                state.handReturnCounts.push(0);
            }
        });
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
    function runEnemySupport(enemy, pendingCurses) {
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

        if (enemy.curseCard) {
            pendingCurses.push(enemy.curseCard);
            R.triggerEnemyBuffAnim(enemy.uid, 'gold');
            A.play('buff');
            spawnFloatingText(pos.x, pos.y - 30, '+' + D.CARDS[enemy.curseCard].name + '!', 'buff');
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
        let dmg = enemy.atk;
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
        const pendingCurses = [];
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
                if (state.hp <= 0) {
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
                startPlayerTurn(pendingCurses);
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

            if (!enemy.hasIntent) {
                spawnFloatingText(pos.x, pos.y, 'AVANÇOU!', 'shield');
                later(260, nextEnemyAction);
                return;
            }

            enemy.stunImmune = 0;
            enemy.turns += 1;
            const supportWait = runEnemySupport(enemy, pendingCurses);
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

            if (state.bossDefeated && state.floor === D.FLOORS.length) {
                setLog('O Senhor das Horas parou.');
                modalQueue.push({ type: 'epilogue' });
            } else if (state.bossDefeated) {
                setLog('CHEFE DERROTADO! "' + fl.conclusion + '" — ' + fl.exitHint);
            } else {
                setLog('Devaneio dispersado! Continue explorando ' + fl.name + '.');
                // O combate pode ter interrompido o evento do tile onde o jogador está
                const tile = fl.layout[state.player.y][state.player.x];
                if (tile === 'M' || tile === '?') handleTileEvent(state.player.x, state.player.y, tile);
            }
            processModalQueue();
        });
    }

    function endGame(victory) {
        state.mode = 'gameover';
        state.busy = false;
        state.autoPlaying = false;
        state.finalVictory = !!victory;
        R.setHoveredCard(null);
        modalQueue = [];
        activeModal = null;
        [els.levelupModal, els.restModal, els.eventModal, els.narrativeModal].forEach(m => m.classList.add('hidden'));
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
            'FASE ' + state.floor + '/' + D.FLOORS.length + '  |  LV ' + state.level +
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

        if (els.statMight) els.statMight.textContent = '+' + ((state.stats && state.stats.Might) || 0) + '%';
        if (els.statAmount) els.statAmount.textContent = '+' + ((state.stats && state.stats.Amount) || 0);
        if (els.statArea) els.statArea.textContent = '+' + ((state.stats && state.stats.Area) || 0) + '%';
        if (els.statLuck) els.statLuck.textContent = '+' + ((state.stats && state.stats.Luck) || 0) + '%';
        if (els.statGrowth) els.statGrowth.textContent = '+' + ((state.stats && state.stats.Growth) || 0) + '%';

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
        if (card.isWild || card.type === 'wild') pills.push('<span class="card-kw-pill kw-wild">WILD</span>');
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

        if (!inCombat) {
            els.comboBadge.classList.add('hidden');
            R.setHoveredCard(null);
            return;
        }

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
            const card = D.CARDS[cardId];
            const effCost = D.getEffectiveCost(card);
            const isWild = !!(card.isWild || card.type === 'wild');
            const willCombo = !card.purgeOnPlay && state.lastComboCost !== null && D.canCardCombo(card, state.lastComboCost);
            const nextMult = willCombo ? (state.comboCount + 2) : 1;
            const pv = getCardPreviewValues(card, nextMult);
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
                '<span class="card-cost">' + effCost + '</span>' +
                (powerTag ? '<span class="card-power-tag">' + powerTag + '</span>' : '') +
                '<div class="card-banner"><span class="card-name">' + card.name +
                (lvl >= B.maxCardLevel && card.evolvesTo && !card.evolved ? ' ★MÁX' : '') +
                '</span></div>' +
                '<div class="card-art"><img src="' + S.getIconUrl(card.icon) + '" alt="" /></div>' +
                '<div class="card-textbox"><div class="card-origin">' + card.origin + '</div>' +
                buildCardKeywordsHtml(card, idx) +
                '<div class="card-desc">' + desc + '</div></div>';
            btn.addEventListener('mouseenter', () => {
                if (!btn.disabled && (card.damage > 0 || card.knockback || card.burn > 0)) R.setHoveredCard(card);
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
        enqueueModal(triggerCard(fl, () => {
            document.body.classList.remove('daydream-transition');
            void document.body.offsetWidth;
            document.body.classList.add('daydream-transition');
            setTimeout(() => document.body.classList.remove('daydream-transition'), 720);
            setLog('Fase 1/' + D.FLOORS.length + ': ' + fl.name + ' — Chefe: ' + fl.bossName + '!');
        }));
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

    openTitleModal();
})();

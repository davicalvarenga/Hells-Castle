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
        rewardGrid: $('reward-grid'),
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
            mana: 3,
            maxMana: 3,
            manaDrain: 0,
            shield: 0,
            xp: 0,
            xpNext: B.xpFirstLevel,
            level: 1,
            vr: 0,
            combo: 1,
            damageMult: 1,
            healPerCombat: 0,
            relics: [],
            specialRelics: [],
            takenRewards: [],
            restUsed: {},
            passives: [{ label: 'Crachá: ' + hero.name + ' (' + hero.role + ')', icon: hero.icon }],
            evolvedCards: {},
            deck: D.STARTING_DECK.slice(),
            drawPile: [],
            hand: [],
            discardPile: [],
            enemies: [],
            targetUid: null,
            currentEncounterId: null,
            encounters: buildEncounters(fl),
            steps: 0,
            bossDefeated: false,
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

    // Substitui cartas base pelas evoluídas quando a relíquia correspondente foi obtida.
    function checkAndTriggerEvolutions() {
        const evolvedNames = [];
        D.EVOLUTIONS.forEach(ev => {
            if (!state.relics.includes(ev.passiveId)) return;
            [state.deck, state.drawPile, state.hand, state.discardPile].forEach(pile => {
                for (let i = 0; i < pile.length; i++) {
                    if (pile[i] === ev.fromCard) pile[i] = ev.toCard;
                }
            });
            if (state.deck.includes(ev.toCard) && !state.evolvedCards[ev.toCard]) {
                state.evolvedCards[ev.toCard] = true;
                evolvedNames.push(D.CARDS[ev.toCard].name);
            }
        });
        if (evolvedNames.length > 0) {
            const label = evolvedNames.join(' & ');
            triggerGoldBanner('EVOLUÇÃO! ' + label.toUpperCase());
            setLog('Carta aprimorada: ' + label + '!');
        }
    }

    function grantRelic(id) {
        const relic = D.SPECIAL_RELICS[id];
        if (!relic || state.specialRelics.includes(id)) return;
        state.specialRelics.push(id);
        state.passives.push({ label: relic.title + ' — ' + relic.desc, icon: relic.icon });
        if (id === 'foto_parque') {
            state.damageMult += 0.15;
            state.healPerCombat += 5;
        } else if (id === 'bilhete_cinema') {
            state.damageMult += 0.1;
        } else if (id === 'chave_bicicleta') {
            state.maxMana = Math.min(B.maxManaCap, state.maxMana + 1);
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
        state.xp += amount;
        A.play('xpTick');
        els.xpTrack.classList.remove('pulse');
        void els.xpTrack.offsetWidth;
        els.xpTrack.classList.add('pulse');

        let gained = 0;
        while (state.xp >= state.xpNext) {
            state.xp -= state.xpNext;
            state.level += 1;
            state.xpNext = Math.round(state.xpNext * B.xpGrowth);
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

    // ---------- MODAL: LEVEL UP ----------
    function openLevelUpModal() {
        A.play('levelup');
        const pool = D.LEVEL_UP_REWARDS.filter(rw =>
            !(rw.once && (state.takenRewards.includes(rw.id) || state.relics.includes(rw.id))));
        const choices = shuffle(pool).slice(0, 3);
        els.rewardGrid.innerHTML = '';
        if (els.levelupCount) {
            els.levelupCount.textContent = state.pendingLevelUps > 1
                ? 'Nível ' + (state.level - state.pendingLevelUps + 1) + ' — restam ' + state.pendingLevelUps + ' escolhas'
                : 'Nível ' + state.level;
        }

        choices.forEach(rw => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'reward-card';
            const kindLabel = rw.kind === 'carta' ? 'Nova Carta' : rw.kind === 'reliquia' ? 'Relíquia de Evolução' : 'Passiva';
            btn.innerHTML =
                '<span class="reward-kind">' + kindLabel + '</span>' +
                '<img src="' + S.getIconUrl(rw.icon) + '" alt="" />' +
                '<div class="reward-title">' + rw.title + '</div>' +
                '<div class="reward-origin">(' + rw.origin + ')</div>' +
                '<div class="reward-desc">' + rw.desc + '</div>';
            btn.addEventListener('click', guardModalAction(() => {
                A.play('card');
                rw.apply(state);
                if (rw.once) state.takenRewards.push(rw.id);
                state.pendingLevelUps = Math.max(0, state.pendingLevelUps - 1);
                checkAndTriggerEvolutions();
                setLog('Recompensa escolhida: ' + rw.title + '!');
                renderHud();
                closeActiveModal();
            }));
            els.rewardGrid.appendChild(btn);
        });

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
                    desc: card.desc.replace('{DMG}', String(card.damage)),
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
                    checkAndTriggerEvolutions();
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
        const p = viewportPoint(0.5, 0.48);
        spawnFloatingText(p.x, p.y - 12, '+' + loot.hp + ' Sanidade', 'heal');
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

    // ---------- COMBATE ----------
    function makeEnemy(kind, summoned) {
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
        state.combo = 1;
        state.pendingDrop = null;
        state.enemies = enc.enemies.slice(0, D.MAX_ENEMIES_IN_COMBAT).map(kind => makeEnemy(kind, false));
        state.targetUid = state.enemies[0].uid;

        state.drawPile = shuffle(state.deck);
        state.discardPile = [];
        state.hand = [];
        drawCards(4);

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
            }
        }
    }

    function getTargetEnemy() {
        const alive = state.enemies.filter(e => e.hp > 0);
        if (alive.length === 0) return null;
        let tgt = alive.find(e => e.uid === state.targetUid);
        if (!tgt) {
            tgt = alive[0];
            state.targetUid = tgt.uid;
        }
        return tgt;
    }

    function computeCardDamage(card) {
        if (!card.damage) return 0;
        return Math.round(card.damage * state.damageMult * D.getComboMult(state.combo));
    }

    function comboBonusLabel(combo) {
        const mult = D.getComboMult(combo);
        return '+' + Math.round((mult - 1) * 100) + '%' + (mult >= B.comboMaxMult ? ' MAX' : '');
    }

    function applyDamageToEnemy(enemy, dmg, card, usedCombo) {
        if (!enemy || enemy.hp <= 0) return { overkill: false };
        const pos = R.getEnemyScreenPos(enemy.uid);
        let remaining = dmg;

        if (!card.ignoreShield && enemy.shield > 0) {
            const blocked = Math.min(enemy.shield, remaining);
            enemy.shield -= blocked;
            remaining -= blocked;
            if (blocked > 0) spawnFloatingText(pos.x, pos.y - 24, 'Escudo -' + blocked, 'shield');
        }

        let overkill = false;
        if (remaining > 0) {
            const prevHp = enemy.hp;
            enemy.hp = Math.max(0, enemy.hp - remaining);
            R.triggerEnemyHitAnim(enemy.uid, usedCombo >= 2);
            R.triggerShake(usedCombo >= 2 ? 0.065 : 0.035, 0.16);
            spawnFloatingText(pos.x, pos.y - 10, '-' + remaining, '');

            if (enemy.hp === 0) {
                const excess = remaining - prevHp;
                let bonusXp = 0;
                let bonusVr = 0;
                if (excess >= 8 || (usedCombo >= 2 && excess >= 4)) {
                    overkill = true;
                    state.overkills += 1;
                    bonusXp = B.overkillXp;
                    bonusVr = B.overkillVr;
                }
                state.kills += 1;
                const gainedVr = enemy.vr + bonusVr;
                state.vr += gainedVr;
                if (enemy.isBoss) {
                    state.bossDefeated = true;
                    if (enemy.dropRelic) state.pendingDrop = enemy.dropRelic;
                }
                // Morte: o sprite treme/dissolve (renderer) e solta XP (azul) + VR (dourado)
                A.play('death');
                R.spawnBurst(pos.x, pos.y, ['#3cc8ff', '#b8f4ff', '#ffd147', '#fff2a8'], 16, { speed: 170, life: 0.55, size: 6 });
                spawnXpParticles(pos.x, pos.y, enemy.xp + bonusXp);
                spawnVrParticles(pos.x, pos.y + 12, gainedVr);
            }
        }
        return { overkill: overkill };
    }

    // Knockback: quem tem imunidade (chefes, exceto o Mensageiro) resiste; quem acabou de se
    // recuperar fica [IMUNE 1t]; cartas em área têm chance por inimigo em vez de garantia.
    function tryKnockback(enemy, card, pos) {
        if (enemy.immuneKnockback) {
            A.play('immune');
            spawnFloatingText(pos.x, pos.y + 16, 'IMUNE!', 'player-hit');
            return;
        }
        if (enemy.stunned) return;
        if (enemy.stunImmune > 0) {
            A.play('immune');
            spawnFloatingText(pos.x, pos.y + 16, 'IMUNE 1t!', 'shield');
            return;
        }
        const chance = typeof card.knockbackChance === 'number'
            ? card.knockbackChance
            : (card.target === 'all' ? B.areaStunChance : 1);
        if (Math.random() < chance) {
            enemy.stunned = true;
            A.play('stun');
            spawnFloatingText(pos.x, pos.y + 16, 'KNOCKBACK!', 'shield');
        } else {
            spawnFloatingText(pos.x, pos.y + 16, 'RESISTIU!', 'player-hit');
        }
    }

    function checkCombatEnd() {
        if (state.mode === 'combat' && state.enemies.every(e => e.hp <= 0)) {
            finishEncounter();
            return true;
        }
        return false;
    }

    function playCard(handIndex) {
        if (state.mode !== 'combat' || state.busy) return false;
        const cardId = state.hand[handIndex];
        if (!cardId) return false;
        const card = D.CARDS[cardId];
        if (!card || state.mana < card.cost) return false;

        A.unlock();
        R.setHoveredCard(null);
        state.mana -= card.cost;
        state.hand.splice(handIndex, 1);

        if (card.purgeOnPlay) {
            A.play('card');
            setLog(card.name + ' descartada!');
            R.syncState(state);
            renderAll();
            return true;
        }

        state.discardPile.push(cardId);

        if (card.shield > 0) {
            state.shield += card.shield;
            const p = viewportPoint(0.5, 0.72);
            spawnFloatingText(p.x, p.y, '+' + card.shield + ' Escudo', 'shield');
        }
        if (card.heal > 0) {
            state.hp = Math.min(state.maxHp, state.hp + card.heal);
            const p = viewportPoint(0.5, 0.65);
            spawnFloatingText(p.x, p.y, '+' + card.heal + ' Sanidade', 'heal');
        }
        if (card.manaGain > 0) {
            state.mana += card.manaGain;
        }

        const usedCombo = state.combo;
        const dmg = computeCardDamage(card);
        const totalHits = card.hits || 1;

        if (totalHits > 1) {
            // Golpes múltiplos no mesmo alvo: todos usam o combo atual e a carta sobe o Combo 1 vez.
            state.busy = true;
            let hitNum = 0;
            let anyOverkill = false;
            const runHit = () => {
                if (state.mode !== 'combat') {
                    state.busy = false;
                    return;
                }
                const target = getTargetEnemy();
                if (!target || hitNum >= totalHits) {
                    state.busy = false;
                    state.combo += 1;
                    if (anyOverkill) triggerOverkillBanner();
                    setLog(card.name + ': ' + hitNum + ' golpes!' + (usedCombo > 1 ? ' [COMBO x' + usedCombo + ' ' + comboBonusLabel(usedCombo) + ']' : ''));
                    getTargetEnemy();
                    R.syncState(state);
                    renderAll(true);
                    checkCombatEnd();
                    return;
                }
                A.play(card.sfx);
                if (applyDamageToEnemy(target, dmg, card, usedCombo).overkill) anyOverkill = true;
                hitNum++;
                R.syncState(state);
                renderAll();
                later(165, runHit);
            };
            runHit();
            return true;
        }

        A.play(card.sfx);
        if (usedCombo > 1) setTimeout(() => A.play('combo', usedCombo), 60);

        let targets = [];
        if (card.target === 'single') {
            const t = getTargetEnemy();
            if (t) targets = [t];
        } else if (card.target === 'all') {
            targets = state.enemies.filter(e => e.hp > 0);
        }

        let logMsg = card.name;
        if (usedCombo > 1) logMsg += ' [COMBO x' + usedCombo + ' ' + comboBonusLabel(usedCombo) + ']';

        let overkillTriggered = false;
        targets.forEach(enemy => {
            const pos = R.getEnemyScreenPos(enemy.uid);
            if (dmg > 0 && applyDamageToEnemy(enemy, dmg, card, usedCombo).overkill) overkillTriggered = true;
            if (card.knockback && enemy.hp > 0) tryKnockback(enemy, card, pos);
        });

        if (overkillTriggered) {
            triggerOverkillBanner();
            logMsg += ' — OVERKILL! (+' + B.overkillXp + ' XP, +' + B.overkillVr + ' VR)';
        }

        state.combo += 1;
        setLog(logMsg);
        getTargetEnemy();
        R.syncState(state);
        renderAll(true);
        checkCombatEnd();
        return true;
    }

    function isUsefulCard(id) {
        const c = D.CARDS[id];
        return !c.purgeOnPlay && c.cost <= state.mana;
    }

    function playAllCards() {
        if (state.mode !== 'combat' || state.busy || state.autoPlaying) return;
        if (!state.hand.some(isUsefulCard)) {
            setLog('Sem Cafeína para cartas úteis. Toque em Fim do Turno!');
            return;
        }
        state.autoPlaying = true;
        renderCombatControls();

        const stepNext = () => {
            if (state.mode !== 'combat' || !state.autoPlaying) {
                state.autoPlaying = false;
                return;
            }
            if (bossKeyOpen || state.busy) {
                later(120, stepNext);
                return;
            }
            const idx = state.hand.findIndex(isUsefulCard);
            if (idx < 0 || state.enemies.every(e => e.hp <= 0)) {
                state.autoPlaying = false;
                renderAll();
                return;
            }
            playCard(idx);
            if (state.mode === 'combat' && state.enemies.some(e => e.hp > 0)) {
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
        state.combo = 1;
        // O Escudo acumulado expira no início do turno do jogador.
        state.shield = 0;
        while (state.hand.length > 0) {
            state.discardPile.push(state.hand.pop());
        }
        drawCards(4);
        pendingCurses.forEach(curseId => {
            if (state.hand.length < 5) state.hand.push(curseId);
        });
        state.busy = false;
        A.play('card');
        setLog(drained > 0
            ? 'Novo turno! O Senhor das Horas drenou ' + drained + ' de Cafeína.'
            : 'Novo turno! Escudo expirou, Cafeína recarregada e Combo reiniciado.');
        R.syncState(state);
        renderAll();
    }

    // Habilidades de suporte antes do golpe. Retorna o tempo (ms) da animação de salto.
    function runEnemySupport(enemy, pendingCurses) {
        let wait = 0;
        const pos = R.getEnemyScreenPos(enemy.uid);

        if (enemy.buffAllies > 0) {
            R.triggerEnemyBuffAnim(enemy.uid, 'purple');
            A.play('buff');
            state.enemies.filter(e => e.hp > 0).forEach(ally => {
                ally.atk += enemy.buffAllies;
                const apos = R.getEnemyScreenPos(ally.uid);
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
                state.enemies.push(makeEnemy(enemy.summonKind, true));
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

        const alive = state.enemies.filter(e => e.hp > 0);
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
            if (idx >= alive.length) {
                startPlayerTurn(pendingCurses);
                return;
            }
            const enemy = alive[idx++];
            const pos = R.getEnemyScreenPos(enemy.uid);

            if (enemy.stunned) {
                // Perde o turno, se recupera e fica imune a novo atordoamento por 1 turno
                enemy.stunned = false;
                enemy.stunImmune = 1;
                spawnFloatingText(pos.x, pos.y, 'ATORDOADO!', 'shield');
                setLog(enemy.name + ' perdeu o turno! Agora está [IMUNE 1t].');
                R.syncState(state);
                later(420, nextEnemyAction);
                return;
            }

            enemy.stunImmune = 0;
            enemy.turns += 1;
            const supportWait = runEnemySupport(enemy, pendingCurses);
            later(supportWait, () => attackOnce(enemy, enemy.attacksPerTurn, nextEnemyAction));
        };

        nextEnemyAction();
    }

    // Fim do combate: espera a animação de morte, volta à exploração e deixa a fila de modais
    // (level ups acumulados, pausa/evento do tile, epílogo) conduzir o que vem depois.
    function finishEncounter() {
        state.busy = true;
        state.autoPlaying = false;
        R.setHoveredCard(null);
        const enc = state.encounters.find(e => e.id === state.currentEncounterId);
        if (enc) enc.alive = false;
        state.currentEncounterId = null;
        renderCombatControls();

        later(R.getAttackTimings().death + 260, () => {
            if (state.mode === 'gameover') return;
            state.mode = 'explore';
            state.enemies = [];
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

        els.comboBadge.classList.remove('hidden');
        els.comboNum.textContent = 'x' + state.combo;
        els.comboBonus.textContent = comboBonusLabel(state.combo);
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
            const dmg = computeCardDamage(card);
            const desc = card.desc.replace('{DMG}', String(dmg));
            let powerTag = '';
            if (dmg > 0) powerTag = card.hits ? dmg + 'x' + card.hits : String(dmg);
            else if (card.shield > 0) powerTag = '+' + card.shield;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card-btn ' + card.type + (card.evolved ? ' evolved' : '');
            btn.disabled = locked || state.mana < card.cost;
            btn.innerHTML =
                '<span class="card-cost">' + card.cost + '</span>' +
                (powerTag ? '<span class="card-power-tag">' + powerTag + '</span>' : '') +
                '<div class="card-banner"><span class="card-name">' + card.name + '</span></div>' +
                '<div class="card-art"><img src="' + S.getIconUrl(card.icon) + '" alt="" /></div>' +
                '<div class="card-textbox"><div class="card-origin">' + card.origin + '</div>' +
                '<div class="card-desc">' + desc + '</div></div>';
            btn.addEventListener('mouseenter', () => {
                if (!btn.disabled && (card.damage > 0 || card.knockback)) R.setHoveredCard(card);
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
            if (ev.key >= '1' && ev.key <= '5') {
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
                const alive = state.enemies.filter(e => e.hp > 0);
                if (alive.length > 1) {
                    const cur = alive.findIndex(e => e.uid === state.targetUid);
                    state.targetUid = alive[(cur + 1) % alive.length].uid;
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
            state.targetUid = uid;
            A.play('card');
            R.syncState(state);
        }
    });

    openTitleModal();
})();

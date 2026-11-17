// Lógica principal: Valter Motta sozinho por 5 biomas de devaneio, fila única de modais,
// Ponto de Pausa, cards narrativos, patrulha/aggro, combate por cartas e epílogo.
(function () {
    'use strict';

    const D = window.GameData;
    const R = window.GameRenderer;
    const S = window.GameSprites;
    const A = window.GameAudio;
    const M = window.GameMeta;
    const B = D.BALANCE;

    // ---------- META-PROGRESSÃO (Recepção) ----------
    // localStorage pode estar bloqueado (aba privada, preview): sem ele a meta vive só nesta página.
    function metaStorage() {
        try {
            return window.localStorage;
        } catch (err) {
            return null;
        }
    }

    function loadMeta() {
        return M.load(metaStorage(), {
            gemIds: Object.keys(D.GEMS),
            cardIds: Object.keys(D.CARDS),
            charIds: D.CHARACTERS.map(c => c.id),
            arcanaIds: Object.keys(D.ARCANAS),
            enemyIds: Object.keys(D.ENEMIES)
        });
    }

    let meta = loadMeta();

    // Preferências de onboarding (introSeen, tutorialDone, dicas já vistas). Chave separada da meta.
    const UI_KEY = 'hc_ui_v1';
    function sanitizeUi(raw) {
        const out = { introSeen: false, tutorialDone: false, tips: [], discoveredCardTutorials: [] };
        if (raw && typeof raw === 'object') {
            out.introSeen = raw.introSeen === true;
            out.tutorialDone = raw.tutorialDone === true;
            out.tips = Array.isArray(raw.tips) ? Array.from(new Set(raw.tips.filter(id => D.FIRST_TIME_TIPS[id]))) : [];
            out.discoveredCardTutorials = Array.isArray(raw.discoveredCardTutorials)
                ? Array.from(new Set(raw.discoveredCardTutorials.filter(id => typeof id === 'string' && D.CARDS[id]))) : [];
        }
        return out;
    }

    function loadUi() {
        try {
            const st = metaStorage();
            return sanitizeUi(st ? JSON.parse(st.getItem(UI_KEY) || 'null') : null);
        } catch (err) {
            // JSON corrompido ou armazenamento bloqueado: começa do zero.
            return sanitizeUi(null);
        }
    }

    let ui = loadUi();

    function saveUi() {
        try {
            const st = metaStorage();
            if (st) st.setItem(UI_KEY, JSON.stringify(ui));
        } catch (err) {
            // Sem armazenamento: vale só nesta aba.
        }
    }
    function saveMeta() {
        return M.save(metaStorage(), meta);
    }

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
        badgeDetail: $('badge-detail'),
        metaCredits: $('meta-credits'),
        metaRecord: $('meta-record'),
        btnOpenAlmox: $('btn-open-almox'),
        btnOpenForge: $('btn-open-forge'),
        btnOpenCuration: $('btn-open-curation'),
        btnInfiniteToggle: $('btn-infinite-toggle'),
        pressureRow: $('pressure-row'),
        pressureButtons: $('pressure-buttons'),
        pressureDesc: $('pressure-desc'),
        receptionModal: $('reception-modal'),
        receptionTitle: $('reception-title'),
        receptionDesc: $('reception-desc'),
        receptionCredits: $('reception-credits'),
        receptionGrid: $('reception-grid'),
        btnReceptionReset: $('btn-reception-reset'),
        btnReceptionClose: $('btn-reception-close'),
        crawlerPortrait: $('crawler-portrait'),
        endMeta: $('end-meta'),
        btnCodex: $('btn-codex'),
        btnOpenCollection: $('btn-open-collection'),
        btnOpenBackup: $('btn-open-backup'),
        collectionModal: $('collection-modal'),
        collectionTabs: $('collection-tabs'),
        collectionContent: $('collection-content'),
        collectionProgress: $('collection-progress'),
        btnCollectionClose: $('btn-collection-close'),
        backupModal: $('backup-modal'),
        backupText: $('backup-text'),
        backupStatus: $('backup-status'),
        btnBackupExport: $('btn-backup-export'),
        btnBackupImport: $('btn-backup-import'),
        btnBackupConfirm: $('btn-backup-confirm'),
        btnBackupClose: $('btn-backup-close'),
        goalToast: $('goal-toast'),
        discoveryModal: $('discovery-modal'),
        discoveryBody: $('discovery-body'),
        btnDiscoveryOk: $('btn-discovery-ok'),
        btnTitleCodex: $('btn-title-codex'),
        btnReplayIntro: $('btn-replay-intro'),
        btnOpenTutorial: $('btn-open-tutorial'),
        introOverlay: $('intro-overlay'),
        introStage: $('intro-stage'),
        introImg: $('intro-img'),
        introParticles: $('intro-particles'),
        introBubble: $('intro-bubble'),
        introTag: $('intro-tag'),
        introStep: $('intro-step'),
        introTitle: $('intro-title'),
        introText: $('intro-text'),
        introActions: $('intro-actions'),
        introChoice: $('intro-choice'),
        btnIntroSkip: $('btn-intro-skip'),
        btnIntroNext: $('btn-intro-next'),
        btnIntroTutorial: $('btn-intro-tutorial'),
        btnIntroDirect: $('btn-intro-direct'),
        codexModal: $('codex-modal'),
        codexTabs: $('codex-tabs'),
        codexContent: $('codex-content'),
        btnCodexClose: $('btn-codex-close'),
        tutorialCoach: $('tutorial-coach'),
        coachStep: $('coach-step'),
        coachTitle: $('coach-title'),
        coachText: $('coach-text'),
        btnTutorialExit: $('btn-tutorial-exit'),
        tipCard: $('tip-card'),
        tipTitle: $('tip-title'),
        tipText: $('tip-text'),
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
        narrativeArt: $('narrative-art'),
        endArt: $('end-art'),
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
    let codexOpen = false;
    let introOpen = false;

    function isPaused() {
        return bossKeyOpen || codexOpen || introOpen || collectionOpen || backupOpen;
    }
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

    // opts.seed: reaproveita a seed (ao trocar de colega ou comprar PowerUp na Recepção o mapa não muda).
    function createInitialState(opts) {
        const o = opts || {};
        const run = { runSeed: o.seed || pickRunSeed(), floors: {} };
        const fl = runFloor(run, 1);
        const start = findStartPos(fl.layout);
        const hero = D.getCharacter(meta.selectedChar);
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
            stats: { Might: 0, Amount: 0, Area: 0, Luck: 0, Growth: 0, Freeze: 0, Recovery: 0, Duration: 0, Greed: 0 },
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
            handTemp: [],          // cópia/carta gerada: some ao ser jogada ou no fim do turno
            comboPile: [],
            comboChain: [],
            combatBuff: { Might: 0, Area: 0, Amount: 0 },
            manaBombTicks: 0,
            extraBreath: false,
            // shortcut: gemas por cardId (cópias compartilham); migrar para instâncias de carta se cópias precisarem divergir
            cardGems: {},
            arcana: null,          // 1ª arcana da run (as extras do Poço/Baú de Prata ficam em arcanas)
            arcanas: [],
            extraGemSlots: {},     // +slots por cardId (Mesa de Oferenda)
            crackedCards: {},      // cardId -> true (Rachada até ser reparada na fogueira)
            cardUses: {},          // usos de cada carta no combate atual
            yinYang: {},           // cardId -> próximo efeito da gema Yin Yang
            fusedCards: {},
            silverReq: {},         // tile -> par de tipos pedido pelo Baú de Prata
            nextCostDiscount: 0,   // Asas do Devaneio: desconto da próxima carta jogada
            discardDiscount: {},   // cardId -> desconto acumulado por descarte (Selo do Eclipse)
            endTurnEchoes: [],     // cartas LOOP que disparam de novo no fim do turno
            turnLastFx: null,      // efeito da última carta jogada no turno (gema Eco)
            columnBurnFloor: [0, 0, 0, 0, 0],
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
            clearedTiles: new Set(),
            crawler: null,         // retrato ativo da Carta de Crawler: { cardId, charId, turns }
            infinite: null         // Hora Extra Infinita: { wave }
        };
        applyHeroAndMeta(s, hero);
        revealAround(s, start.x, start.y, fl.layout);
        // Etapa 8: o baralho inicial nunca conta como "carta nova" para o modal de descoberta.
        s.discoveryBase = s.deck.slice();
        s.biomesPlayed = [];
        s.signatureFloors = [];
        resetTurnTrackers(s);
        s.fightBurnDmg = 0;
        s.fightDestroys = 0;
        return s;
    }

    // Colega escolhido + PowerUps do Almoxarifado + slots da Grafia entram na run aqui (uma vez, no início).
    // Rastreadores por turno (cartas de bioma e metas): Crit extra, Combo Reverso, desarmes e dano de Escudo.
    function resetTurnTrackers(s) {
        s.turnCrit = 0;
        s.turnReverse = false;
        s.turnDisarms = 0;
        s.turnShieldDmg = 0;
        s.turnLastPlayedId = null;
    }

    function isReverseActive() {
        return !!(state && (state.comboReverse || state.turnReverse));
    }

    function applyHeroAndMeta(s, hero) {
        const rank = id => M.rankOf(meta, id);
        s.heroId = hero.id;
        s.deck = (hero.deck || D.STARTING_DECK).slice();
        if (hero.crawlerCard) s.deck.push(hero.crawlerCard);
        Object.keys(hero.stats || {}).forEach(k => { s.stats[k] = (s.stats[k] || 0) + hero.stats[k]; });
        s.kbBonus = hero.kbBonus || 0;
        s.vr = hero.startVr || 0;
        s.startVr = s.vr;
        s.vrSpent = 0;
        s.stats.Might += 10 * rank('Might');
        s.stats.Area += 10 * rank('Area');
        s.stats.Amount += rank('Amount');
        s.stats.Growth += 15 * rank('Growth');
        s.stats.Greed += 20 * rank('Greed');
        s.stats.Luck += 15 * rank('Luck');
        s.stats.Recovery += rank('Recovery');
        s.maxHpCap = B.maxHpCap + 10 * rank('MaxHealth');
        s.maxHp = hero.maxHp + 10 * rank('MaxHealth');
        s.hp = s.maxHp;
        s.armor = rank('Armor');
        s.maxManaCap = B.maxManaCap + rank('Cooldown');
        s.maxMana = B.baseMana + rank('Cooldown');
        s.mana = s.maxMana;
        s.rerollsLeft += rank('Reroll');
        s.skipsLeft += rank('Skip');
        s.banishesLeft += rank('Banish');
        s.revival = Math.min(B.revivalMax, s.revival + rank('Revival'));
        s.curse = Math.min(B.curseCap, 15 * rank('Curse'));
        s.extraGemSlots = Object.assign({}, meta.forge);
        const bought = M.POWERUPS.filter(p => rank(p.id) > 0).map(p => p.name + ' ' + rank(p.id));
        if (bought.length > 0) s.passives.push({ label: 'Almoxarifado: ' + bought.join(', '), icon: 'vr_boost' });
        // Nível de Pressão (ascensão): cada nível acumula os modificadores dos anteriores.
        s.pressure = Math.min(meta.pressure || 0, meta.pressureUnlocked || 0);
        if (s.pressure >= 2) s.deck.push(D.PRESSURE_MODS.junkCard);
        if (s.pressure > 0) {
            const lv = D.PRESSURE_LEVELS[s.pressure];
            s.passives.push({ label: 'Pressão ' + s.pressure + ': ' + lv.name + ' (+' + Math.round(lv.creditBonus * 100) + '% CR)', icon: 'vr_boost' });
        }
        // Segredos da run: Trapaceiro (3 cartas estilhaçadas) e final secreto (Foto no Parque).
        s.shatters = 0;
        s.tricksterPending = false;
        s.tricksterSeen = false;
        s.tricksterDefeated = false;
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

    // Greed multiplica o VR ganho em combate, baús e pickups. Retorna o VR efetivamente creditado.
    function gainVr(amount) {
        const gained = Math.max(0, Math.round(amount * (1 + getStat('Greed') / 100)));
        state.vr += gained;
        if (vrEarnedThisRun() >= 500) goal('caixa_forte');
        return gained;
    }

    // ---------- METAS ("Carimbos do RH") E COLEÇÃO ----------
    // Meta de run: paga na hora (crédito persistente salvo) e avisa com um toast discreto no topo.
    // No tutorial só vale a meta do próprio tutorial.
    function goal(id) {
        if (!state || !M.GOAL_BY_ID[id] || meta.goals[id]) return 0;
        if (state.tutorial && id !== 'estagiario') return 0;
        const reward = M.awardGoal(meta, id);
        if (reward > 0) {
            saveMeta();
            showGoalToast(id, reward);
        }
        return reward;
    }

    // Metas deduzidas do save (vitórias, colegas, segredos, Pressão...): pagas ao fim da run e na Recepção.
    function settleMetaGoals() {
        const paid = M.evaluateMetaGoals(meta);
        if (paid.length > 0) {
            saveMeta();
            paid.forEach(p => showGoalToast(p.id, p.reward));
        }
        return paid;
    }

    const goalQueue = [];
    let goalTimer = null;

    function showGoalToast(id, reward) {
        goalQueue.push({ id: id, reward: reward });
        if (!goalTimer) nextGoalToast();
    }

    function nextGoalToast() {
        const item = goalQueue.shift();
        if (!item) {
            els.goalToast.classList.add('hidden');
            goalTimer = null;
            return;
        }
        const g = M.GOAL_BY_ID[item.id];
        els.goalToast.dataset.goal = item.id;
        els.goalToast.innerHTML = '<img src="' + S.getIconUrl(g.icon) + '" alt="" /><span><b>META CONCLUÍDA: ' + g.name +
            '</b><small>' + g.desc + '</small></span><em>+' + item.reward + ' CR</em>';
        els.goalToast.classList.remove('hidden');
        A.play('levelup');
        goalTimer = setTimeout(nextGoalToast, 4200);
    }

    // Descobertas da Coleção: marcadas na memória e gravadas nos pontos de salvamento da run.
    let seenDirty = false;
    function markSeen(kind, id) {
        if (!state || state.tutorial) return;
        if (M.markSeen(meta, kind, id)) seenDirty = true;
    }

    function flushSeen() {
        if (!seenDirty) return;
        seenDirty = false;
        saveMeta();
    }

    // Gasto rastreado: no fim da run, ganho total = VR atual + gasto - VR inicial do colega.
    function spendVr(amount) {
        state.vr -= amount;
        state.vrSpent = (state.vrSpent || 0) + amount;
    }

    function vrEarnedThisRun() {
        return Math.max(0, state.vr + (state.vrSpent || 0) - (state.startVr || 0));
    }

    function getManaBombDamage() {
        return B.manaBombBase + B.manaBombStep * ((state && state.manaBombTicks) || 0);
    }

    // inHand: a própria carta ainda está na mão (prévia), então o Líder dela mesma não conta.
    // xValue: Cafeína gasta numa carta de Custo X (na prévia, toda a Cafeína atual).
    function getCardPreviewValues(card, comboMult, inHand, xValue) {
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

        const x = card.xCost ? Math.max(0, typeof xValue === 'number' ? xValue : ((state && state.mana) || 0)) : 0;
        // Grimório Proibido: Custo X vira número de projéteis (X + bônus), não multiplicador de dano.
        if (card.xHitsBonus) hits = x + card.xHitsBonus;
        let dmg = card.damage || 0;
        // Scavenge: +N por carta no Descarte e na pilha de Destroy desta luta (com teto).
        if (card.scavenge > 0 && state && state.mode === 'combat') {
            const piles = (state.discardPile || []).length + (state.destroyedPile || []).length;
            dmg += card.scavenge * Math.min(card.scavengeCap || 99, piles);
        }
        if (dmg > 0) {
            if (card.damageScalesWithCombo) dmg *= mult;
            if (card.damageScalesWithAmount) dmg *= (1 + statAmt);
            if (card.xCost && !card.xHitsBonus) dmg *= x;
            dmg = dmg > 0 ? Math.max(1, Math.round(dmg * mightMult)) : 0;
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
            x: x,
            damage: dmg,
            shield: shield,
            heal: heal,
            burn: card.burn || 0,
            might: (card.buffMight || 0) * supportMult,
            area: (card.buffArea || 0) * supportMult,
            draw: (card.draw || 0) * supportMult
        };
    }

    // base (opcional): prévia sem o combo. Todo número que o combo aumentou sai em dourado (<b class="combo-val">).
    function formatCardDesc(card, preview, base) {
        const pv = preview || getCardPreviewValues(card, 1);
        const val = key => (base && base[key] !== pv[key]
            ? '<b class="combo-val">' + pv[key] + '</b>'
            : String(pv[key]));
        return (card.desc || '')
            .replace(/\{HITS\}/g, val('hits'))
            .replace(/\{X\}/g, String(pv.x || 0))
            .replace(/\{TURNS\}/g, String(state ? crawlerTurns() : B.crawlerTurns))
            .replace(/\{DMG\}/g, val('damage'))
            .replace(/\{SHIELD\}/g, val('shield'))
            .replace(/\{HEAL\}/g, val('heal'))
            .replace(/\{BURN\}/g, String(pv.burn))
            .replace(/\{MIGHT\}/g, val('might'))
            .replace(/\{AREA\}/g, val('area'))
            .replace(/\{DRAW\}/g, val('draw'))
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
        markSeen('cards', ev.toCard);
        state.evolutionsDone = (state.evolutionsDone || 0) + 1;
        if (state.evolutionsDone >= 2) goal('alquimista');
        const evolved = D.CARDS[ev.toCard];
        // As gemas acompanham a carta; o que deixou de fazer sentido na evoluída é descartado.
        const extraSlots = state.extraGemSlots[ev.fromCard] || 0;
        const carried = [];
        (state.cardGems[ev.fromCard] || []).forEach(g => { if (D.canSocketGem(evolved, carried, g, extraSlots)) carried.push(g); });
        delete state.cardGems[ev.fromCard];
        delete state.extraGemSlots[ev.fromCard];
        delete state.crackedCards[ev.fromCard];
        if (carried.length > 0) state.cardGems[ev.toCard] = carried;
        if (extraSlots > 0) state.extraGemSlots[ev.toCard] = extraSlots;
        triggerGoldBanner('EVOLUÇÃO! ' + evolved.name.toUpperCase());
        setLog('Carta evoluída: ' + evolved.name + '!');
        return evolved;
    }

    // Fusão dupla: as duas cartas no baralho e no Nível MÁX, uma única vez por run.
    function isFusionReady(fus) {
        return !state.fusedCards[fus.toCard] &&
            fus.cards.every(id => state.deck.includes(id) && getCardLevel(id) >= B.maxCardLevel);
    }

    // Consome 1 cópia de cada carta e entrega a carta suprema; as gemas compatíveis das duas a acompanham.
    function applyFusion(fus) {
        const fused = D.CARDS[fus.toCard];
        const carried = [];
        fus.cards.forEach(id => {
            (state.cardGems[id] || []).forEach(g => { if (D.canSocketGem(fused, carried, g)) carried.push(g); });
            removeCardFromDeck(id);
        });
        state.deck.push(fus.toCard);
        state.fusedCards[fus.toCard] = true;
        markSeen('cards', fus.toCard);
        state.evolutionsDone = (state.evolutionsDone || 0) + 1;
        if (state.evolutionsDone >= 2) goal('alquimista');
        if (carried.length > 0) state.cardGems[fus.toCard] = carried;
        triggerGoldBanner('FUSÃO! ' + fused.name.toUpperCase());
        setLog('Fusão concluída: ' + fused.name + '!');
        return fused;
    }

    // Tira 1 cópia do baralho da run; sem cópias restantes, o que era da carta (gemas, slots, rachadura) vai junto.
    function removeCardFromDeck(cardId) {
        const idx = state.deck.indexOf(cardId);
        if (idx < 0) return false;
        state.deck.splice(idx, 1);
        if (!state.deck.includes(cardId)) {
            delete state.cardGems[cardId];
            delete state.extraGemSlots[cardId];
            delete state.crackedCards[cardId];
        }
        return true;
    }

    // Verifica se alguma carta atingiu condição de evolução (Nv.MÁX + Relíquia).
    // allowImmediate=true evolui na hora (usado ao abrir Baú); caso contrário avisa que aparecerá no próximo Baú/Level Up.
    function checkAndTriggerEvolutions(allowImmediate) {
        const ready = D.EVOLUTIONS.filter(isEvolutionReady);
        if (ready.length === 0) {
            // A fusão nunca é automática: fica como opção "FUSÃO PRONTA" do próximo Level Up.
            const fusions = D.FUSIONS.filter(isFusionReady);
            if (fusions.length > 0 && !allowImmediate) {
                setLog('Fusão pronta (' + fusions.map(f => D.CARDS[f.toCard].name).join(', ') + ')! Disponível no próximo Level Up.');
            }
            return [];
        }
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
            state.maxMana = Math.min((state.maxManaCap || B.maxManaCap), state.maxMana + 1);
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

    // ---------- NOVA CARTA DESCOBERTA! (1ª vez que uma carta entra no baralho) ----------
    // Compara o baralho com o que a run já conhecia; cada carta inédita (fora do Tutorial base) vira um item
    // {type:'discovery'} logo no INÍCIO da fila, para aparecer antes da gema/evento seguinte. Salvo em hc_ui_v1.
    function detectNewCards() {
        if (!state || state.tutorial || !state.discoveryBase) return [];
        const fresh = [];
        state.deck.forEach(id => {
            if (state.discoveryBase.includes(id)) return;
            state.discoveryBase.push(id);
            const card = D.CARDS[id];
            if (!card || card.consumable || card.tempOnly || card.type === 'curse') return;
            if (ui.discoveredCardTutorials.includes(id)) return;
            ui.discoveredCardTutorials.push(id);
            markSeen('cards', id);
            fresh.push({ type: 'discovery', cardId: id });
        });
        if (fresh.length > 0) {
            saveUi();
            modalQueue.unshift.apply(modalQueue, fresh);
        }
        return fresh;
    }

    function openDiscoveryModal(item) {
        A.play('levelup');
        els.discoveryBody.innerHTML = cardSheetHtml(item.cardId, { discovery: true });
        els.discoveryModal.dataset.card = item.cardId;
        els.discoveryModal.classList.remove('hidden');
        els.btnDiscoveryOk.disabled = false;
        later(30, () => { if (activeModal === item) els.btnDiscoveryOk.focus({ preventScroll: true }); });
    }

    // Ficha completa de uma carta (modal de descoberta e Bestiário de Cartas).
    function cardSheetHtml(cardId, opts) {
        const o = opts || {};
        const card = D.CARDS[cardId];
        const biome = card.biome ? D.BIOMES[card.biome] : null;
        const pattern = D.getTargetPattern(card);
        const guide = D.getCardGuide(card);
        const keywords = D.getCardKeywords(card);
        const typeLabel = card.type === 'crawler' ? 'Crachá' : card.type === 'curse' ? 'Lixo' : (D.CARD_TYPE_LABELS[card.type] || card.type);
        const cost = card.xCost ? 'X' : card.comboCostCut ? card.cost + '↓' : String(card.cost);
        const seal = card.fused ? 'FUSÃO' : card.evolved ? 'EVOLUÇÃO' : biome ? (card.signature ? 'ASSINATURA · ' : '') + biome.label.toUpperCase() : 'BASE';
        const recipe = cardRecipeText(cardId);
        const cells = pattern.cells.map((c, i) => '<span class="pat-cell ' + (c.mark || 'none') + '" title="Coluna ' + i + '"><i>' + i + '</i><b>' +
            (c.order || (c.mark === 'hit' ? '●' : '')) + '</b></span>').join('');
        return '<div class="card-sheet' + (o.discovery ? ' is-discovery' : '') + '" data-card="' + cardId + '">' +
            '<div class="cs-card" style="--seal:' + (biome ? biome.color : card.evolved ? '#f5cb5c' : '#94a3b8') + '">' +
            '<span class="cs-cost">' + cost + '</span>' +
            '<img src="' + S.getIconUrl(card.icon) + '" alt="" />' +
            '<b class="cs-name">' + card.name + '</b>' +
            '<small class="cs-origin">' + card.origin + '</small>' +
            '<span class="cs-seal">' + seal + '</span>' +
            '<span class="cs-type">' + typeLabel + '</span></div>' +
            '<div class="cs-info">' +
            '<p class="cs-desc">' + formatCardDesc(card, getCardPreviewValues(card, 1)) + '</p>' +
            '<div class="cs-block"><h5>Mira nas 5 colunas</h5><div class="pat-row">' + cells + '</div><small>' + pattern.caption + '</small></div>' +
            '<div class="cs-block"><h5>Papel tático</h5><p>' + guide.role + '</p></div>' +
            '<div class="cs-block"><h5>Dica de combo</h5><p>' + guide.tip + '</p></div>' +
            (recipe ? '<div class="cs-block"><h5>Evolução / Fusão</h5><p>' + recipe + '</p></div>' : '') +
            (keywords.length > 0 ? '<div class="cs-block"><h5>Keywords</h5><dl class="cs-keys">' +
                keywords.map(k => '<dt>' + k.label + '</dt><dd>' + k.text + '</dd>').join('') + '</dl></div>' : '') +
            '</div></div>';
    }

    // Receita de evolução/fusão em que a carta participa (como origem ou resultado).
    function cardRecipeText(cardId) {
        const name = id => D.CARDS[id].name;
        const out = [];
        D.EVOLUTIONS.forEach(ev => {
            if (ev.fromCard === cardId) out.push('Nível MÁX + Relíquia ' + ev.title + ' → ' + name(ev.toCard) + '.');
            if (ev.toCard === cardId) out.push('Nasce de ' + name(ev.fromCard) + ' (Nível MÁX) + Relíquia ' + ev.title + '.');
        });
        D.FUSIONS.forEach(f => {
            if (f.cards.includes(cardId)) out.push('Funde com ' + f.cards.filter(id => id !== cardId).map(name).join(' + ') + ' (ambas no Nível MÁX) → ' + name(f.toCard) + '.');
            if (f.toCard === cardId) out.push('Fusão de ' + f.cards.map(name).join(' + ') + ', ambas no Nível MÁX.');
        });
        return out.join(' ');
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
        // Arcana extra enfileirada depois que a run já tem todas: vira uma gema rara (nunca um modal vazio).
        if (activeModal.type === 'arcana' && availableArcanas().length === 0) {
            activeModal = { type: 'gem', gemId: randomGemId(['rara', 'epica', 'lendaria']) };
        }
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
            pick: openPickModal,
            arcana: openArcanaModal,
            discovery: openDiscoveryModal,
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
        flushSeen();
        const item = activeModal;
        if (!item) return;
        [els.levelupModal, els.restModal, els.eventModal, els.narrativeModal, els.gemModal, els.arcanaModal, els.discoveryModal].forEach(m => m.classList.add('hidden'));
        activeModal = null;
        if (afterClose) afterClose(item);
        detectNewCards();
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
        [els.levelupModal, els.restModal, els.eventModal, els.narrativeModal, els.gemModal, els.arcanaModal, els.endModal, els.discoveryModal].forEach(m => m.classList.add('hidden'));
        els.epilogueOverlay.classList.add('hidden');
    }

    function getEligibleLevelUpPool() {
        return D.LEVEL_UP_REWARDS.filter(rw => {
            if (state.banishedIds && state.banishedIds.includes(rw.id)) return false;
            if (rw.once && (state.takenRewards.includes(rw.id) || state.relics.includes(rw.id))) return false;
            if (rw.id && rw.id.indexOf('up_') === 0 && getCardLevel(rw.id.slice(3)) >= B.maxCardLevel) return false;
            if (rw.requiresCard && !state.deck.includes(rw.requiresCard)) return false;
            // Cartas exclusivas: só no Bioma atual (nunca no Tutorial).
            if (rw.biome && (state.tutorial || rw.biome !== currentBiome())) return false;
            if (rw.rare && Math.random() > 0.35) return false;
            return true;
        });
    }

    function currentBiome() {
        return Math.max(1, Math.min(D.FLOORS.length, (state && state.floor) || 1));
    }

    // Baú: oferece até 2 cartas exclusivas do Bioma atual (pegar 1 ou recusar).
    function biomeCardPick() {
        const biome = D.BIOMES[currentBiome()];
        const options = shuffle(D.getBiomeCards(biome.id, biome.id === D.FLOORS.length)).slice(0, 2);
        return {
            type: 'pick', kind: 'biome',
            title: 'BAÚ: CARTA DA ' + biome.name.toUpperCase(),
            desc: 'Exclusiva deste Bioma (' + biome.archetype + '). Pegue 1 para o baralho ou recuse para manter o deck enxuto.',
            cards: options,
            declineLabel: 'RECUSAR',
            cardNote: () => 'Exclusiva: ' + biome.label,
            onPick: id => {
                state.deck.push(id);
                setLog('Nova carta no baralho: ' + D.CARDS[id].name + '!');
            }
        };
    }

    // Chefe do Bioma derrotado: Carta Assinatura garantida (pode recusar), uma vez por Fase.
    function signatureCardPick(floor) {
        const sigId = D.getSignatureCard(floor);
        if (!sigId) return null;
        const biome = D.BIOMES[floor];
        return {
            type: 'pick', kind: 'signature',
            title: 'CARTA ASSINATURA: ' + biome.name.toUpperCase(),
            desc: 'Prêmio do Chefe: ' + D.CARDS[sigId].name + ' (' + biome.archetype + '). Ela segue no baralho nas próximas Fases.',
            cards: [sigId],
            declineLabel: 'RECUSAR',
            cardNote: () => 'Assinatura',
            onPick: id => {
                state.deck.push(id);
                triggerGoldBanner('CARTA ASSINATURA: ' + D.CARDS[id].name.toUpperCase());
            }
        };
    }

    function buildFusionChoice(fus) {
        const toCard = D.CARDS[fus.toCard];
        return {
            id: fus.id,
            kind: 'fusao',
            title: toCard.name,
            origin: 'Fusão de ' + fus.cards.map(id => D.CARDS[id].name).join(' + '),
            icon: toCard.icon,
            noBanish: true,
            desc: formatCardDesc(toCard, getCardPreviewValues(toCard, 1)),
            apply: function () {
                applyFusion(fus);
            }
        };
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
        // Gancho de teste (__hcDebug.forceLevelUp): ofertas fixas para o próximo Level Up.
        if (state.forcedRewardIds) {
            const forced = state.forcedRewardIds.map(id => D.LEVEL_UP_REWARDS.find(r => r.id === id)).filter(Boolean);
            state.forcedRewardIds = null;
            if (forced.length > 0) return forced;
        }
        const fourthChance = 0.025 * getLuckMultiplier();
        const slotCount = Math.random() < fourthChance ? 4 : 3;
        const choices = D.EVOLUTIONS.filter(isEvolutionReady).map(buildEvolutionChoice)
            .concat(D.FUSIONS.filter(isFusionReady).map(buildFusionChoice));
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
        if (last > 0 && picked[last].kind !== 'evolucao' && picked[last].kind !== 'fusao' &&
            Math.random() < B.gemRewardChance * getLuckMultiplier()) {
            const gem = D.GEMS[randomGemId()];
            picked[last] = {
                id: 'gem_' + gem.id,
                kind: 'gema',
                title: gem.name,
                origin: 'Gema ' + D.GEM_RARITY_LABEL[gem.rarity] + ' para encaixar',
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
        if (!state.deck.includes(cardId) || !D.canSocketGem(card, state.cardGems[cardId], gemId, state.extraGemSlots[cardId])) return false;
        if (D.GEMS[gemId].instant) {
            applyEvolution(D.EVOLUTIONS.find(ev => ev.fromCard === cardId));
            return true;
        }
        state.cardGems[cardId] = (state.cardGems[cardId] || []).concat(gemId);
        state.gemsSocketed = (state.gemsSocketed || 0) + 1;
        if (state.gemsSocketed >= 10) goal('joalheiro');
        if (gemId === 'uncrackable') delete state.crackedCards[cardId];
        return true;
    }

    function gemTargets(gemId) {
        return state.deck.filter((id, i) => state.deck.indexOf(id) === i &&
            D.canSocketGem(D.CARDS[id], state.cardGems[id], gemId, state.extraGemSlots[id]));
    }

    // Sorteia (com peso por raridade) entre as gemas que cabem em alguma carta do baralho atual.
    // rarities: filtro opcional (Poço dos Desejos = rara+, Baú de Prata = épica/lendária).
    function randomGemId(rarities) {
        const usable = Object.keys(D.GEMS).filter(gemId => gemTargets(gemId).length > 0);
        const wanted = rarities ? usable.filter(gemId => rarities.includes(D.GEMS[gemId].rarity)) : usable;
        // Sem gema da raridade pedida que caiba no baralho, vale qualquer uma que caiba.
        const weight = id => M.gemWeightMult(meta, id);
        return D.pickGemByRarity(wanted.length > 0 ? wanted : usable, Math.random(), weight) ||
            D.pickGemByRarity(usable, Math.random(), weight) || 'swift';
    }

    function grantGem(gemId) {
        enqueueModal({ type: 'gem', gemId: gemId || randomGemId() });
    }

    function gemSlotsHtml(cardId) {
        const base = D.CARDS[cardId];
        const gems = state.cardGems[cardId] || [];
        let html = '';
        for (let i = 0; i < D.getCardGemSlots(base, state.extraGemSlots[cardId]); i++) {
            const gem = D.GEMS[gems[i]];
            html += gem
                ? '<span class="gem-slot filled" style="--gem:' + gem.color + '" title="' + gem.name + ': ' + gem.desc + '">' + gem.glyph + '</span>'
                : '<span class="gem-slot" title="Slot de gema vazio"></span>';
        }
        return html ? '<span class="gem-slots">' + html + '</span>' : '';
    }

    function openGemModal(item) {
        const gem = D.GEMS[item.gemId];
        markSeen('gems', gem.id);
        A.play('chest');
        els.gemModal.dataset.kind = 'gem';
        els.gemTitle.innerHTML = '<span class="gem-slot filled big" style="--gem:' + gem.color + '">' + gem.glyph + '</span> ' + gem.name +
            ' <span class="gem-rarity rarity-' + gem.rarity + '">' + D.GEM_RARITY_LABEL[gem.rarity] + '</span>';
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

    // ---------- SELETOR DE CARTA (sacrifícios e +1 slot): mesmo modal das gemas ----------
    // item: { kind, title, desc, cards: [cardId], cardNote(cardId), declineLabel, onPick(cardId), onDecline() }
    function openPickModal(item) {
        A.play('chest');
        els.gemModal.dataset.kind = item.kind || 'pick';
        els.gemTitle.textContent = item.title;
        els.gemDesc.textContent = item.desc;
        els.gemTargets.innerHTML = '';
        item.cards.forEach(cardId => {
            const card = cardOf(cardId);
            const copies = state.deck.filter(id => id === cardId).length;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'shop-item-card gem-target-card';
            btn.dataset.card = cardId;
            btn.innerHTML =
                '<img src="' + S.getIconUrl(card.icon) + '" alt="" />' +
                '<div class="shop-item-title">' + card.name + (copies > 1 ? ' x' + copies : '') + '</div>' +
                '<div class="shop-item-desc">' + formatCardDesc(card, getCardPreviewValues(card, 1)) + '</div>' +
                (item.cardNote ? '<span class="shop-item-price">' + item.cardNote(cardId) + '</span>' : '') +
                gemSlotsHtml(cardId);
            btn.addEventListener('click', guardModalAction(() => {
                A.play('card');
                item.onPick(cardId);
                renderHud();
                closeActiveModal();
            }));
            els.gemTargets.appendChild(btn);
        });
        els.btnGemDiscard.textContent = item.declineLabel || 'CANCELAR';
        els.gemModal.classList.remove('hidden');
    }

    // Cartas do baralho (sem repetir) que passam no filtro; pickups nunca entram em oferendas.
    function deckCardsWhere(filter) {
        return state.deck.filter((id, i) => state.deck.indexOf(id) === i && !D.CARDS[id].consumable && !D.CARDS[id].crawler && filter(id));
    }

    // ---------- ARCANAS ----------
    function hasArcana(id) {
        return !!state && state.arcanas.includes(id);
    }

    function availableArcanas() {
        return Object.keys(D.ARCANAS).filter(id => !state.arcanas.includes(id));
    }

    // Arcana extra (Poço dos Desejos / Baú de Prata): soma às que a run já tem.
    function addArcana(id) {
        const arcana = D.ARCANAS[id];
        if (!arcana || state.arcanas.includes(id)) return false;
        state.arcanas.push(id);
        if (!state.arcana) state.arcana = id;
        state.passives.push({ label: 'Arcana: ' + arcana.name + ' — ' + arcana.desc, icon: arcana.icon, arcana: true });
        renderHud();
        return true;
    }

    // Troca TODAS as arcanas por uma só (escolha inicial e gancho de teste).
    function setArcana(id) {
        if (!D.ARCANAS[id]) return false;
        state.passives = state.passives.filter(p => !p.arcana);
        state.arcanas = [];
        state.arcana = null;
        return addArcana(id);
    }

    function openArcanaModal() {
        A.play('levelup');
        els.arcanaChoices.innerHTML = '';
        shuffle(availableArcanas()).slice(0, 3).forEach(id => {
            const arcana = D.ARCANAS[id];
            markSeen('arcanas', id);
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
                addArcana(id);
                if (state.tutorial) {
                    state.tutorial.done = true;
                    modalQueue.push(tutorialDoneCard());
                }
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
            // Ofertas do Level Up também contam como descobertas (cartas, evoluções, gemas).
            const offered = rw.id && rw.id.replace(/^(add_|up_|evo_|gem_)/, '');
            if (rw.kind === 'carta' || rw.kind === 'evolucao') markSeen('cards', offered);
            if (rw.kind === 'gema') markSeen('gems', offered);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'reward-card' + (rw.kind === 'evolucao' || rw.kind === 'fusao' ? ' evo-choice' : '');
            btn.dataset.reward = rw.id;
            const kindLabel = rw.kind === 'carta'
                ? 'Nova Carta'
                : rw.kind === 'reliquia'
                    ? 'Relíquia de Evolução'
                    : rw.kind === 'evolucao'
                        ? 'EVOLUÇÃO PRONTA'
                        : rw.kind === 'fusao'
                        ? 'FUSÃO PRONTA'
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
                        setLog('Evoluções, fusões e gemas não podem ser banidas!');
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
        showTip('rest');
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
        const rest = D.restConfig(state.pressure);
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
                        spendVr(removePrice);
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
                spendVr(rest.healPrice);
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
                spendVr(rest.gemPrice);
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
                spendVr(rest.breathPrice);
                state.extraBreath = true;
                state.passives.push({ label: 'Fôlego Extra (próximo combate)', icon: 'shield' });
                A.play('shield');
                setLog('Valter respira fundo. Escudo e Cafeína extras no próximo combate.');
            }
        });

        const cracked = Object.keys(state.crackedCards).filter(id => state.deck.includes(id));
        addRestItem({
            title: 'Reparar Rachaduras',
            desc: cracked.length > 0
                ? 'Conserta ' + cracked.map(id => D.CARDS[id].name).join(', ') + '.'
                : 'Carta comum usada mais de ' + B.crackAfterUses + 'x no mesmo combate racha e pode estilhaçar.',
            icon: 'staple_box',
            disabled: cracked.length === 0 || state.vr < rest.repairPrice,
            priceText: cracked.length === 0 ? 'NADA RACHADO' : rest.repairPrice + ' VR',
            onPick: () => {
                spendVr(rest.repairPrice);
                state.crackedCards = {};
                A.play('shield');
                setLog('Cartas reparadas: nenhuma rachadura no baralho.');
            }
        });

        const relic = D.EVOLUTIONS.find(ev => !state.relics.includes(ev.passiveId) &&
            (!ev.requiresOwned || state.deck.includes(ev.fromCard)));
        if (relic) {
            addRestItem({
                title: relic.title,
                desc: 'Relíquia de Evolução (1 por fase): ' + relic.desc,
                icon: relic.icon,
                disabled: flags.relic || state.vr < rest.relicPrice,
                priceText: flags.relic ? 'JÁ COMPRADA' : rest.relicPrice + ' VR',
                onPick: () => {
                    spendVr(rest.relicPrice);
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
        els.eventModal.dataset.kind = ev.id || '';
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
            btn.disabled = !!ch.disabled;
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

    // ---------- EVENTOS DE MAPA: BAÚ DE PRATA (P), MESA DE OFERENDA (O) E POÇO DOS DESEJOS (W) ----------
    // Os sacrifícios usam o seletor de carta em etapas; nada é consumido antes da última escolha.
    function queueNext(item) {
        modalQueue.unshift(item);
    }

    // Arcana extra se ainda houver alguma fora da run; senão, uma gema da raridade pedida.
    function grantArcanaOrGem(gemChance, rarities) {
        if (availableArcanas().length > 0 && Math.random() >= gemChance) queueNext({ type: 'arcana' });
        else queueNext({ type: 'gem', gemId: randomGemId(rarities) });
    }

    function silverChestEvent(key) {
        if (!state.silverReq[key]) {
            state.silverReq[key] = D.SILVER_CHEST_PAIRS[Math.floor(Math.random() * D.SILVER_CHEST_PAIRS.length)];
        }
        const req = state.silverReq[key];
        const label = type => D.CARD_TYPE_LABELS[type];
        const ofType = type => deckCardsWhere(id => D.CARDS[id].type === type);
        const canPay = ofType(req[0]).length > 0 && ofType(req[1]).length > 0 && state.deck.length - 2 >= B.minDeckSize;
        const pickStep = (type, onPick) => ({
            type: 'pick',
            kind: 'sacrifice',
            title: 'BAÚ DE PRATA',
            desc: 'Escolha a carta de ' + label(type) + ' que fica na fechadura (ela sai do baralho):',
            cards: ofType(type),
            cardNote: () => 'OFERECER',
            declineLabel: 'DESISTIR',
            onPick: onPick,
            onDecline: () => setLog('Você recolhe as cartas. O Baú de Prata segue trancado.')
        });
        return {
            id: 'bau_prata',
            title: 'Baú de Prata',
            desc: 'Uma fechadura dupla, fria ao toque. Ela pede uma oferenda: 1 carta de ' + label(req[0]) + ' e 1 carta de ' + label(req[1]) + '.',
            choices: [
                {
                    label: 'Oferecer as 2 cartas',
                    hint: canPay
                        ? 'Sacrifica 1 ' + label(req[0]) + ' + 1 ' + label(req[1]) + ': Gema Épica/Lendária ou Arcana extra'
                        : 'Faltam cartas desses tipos (ou o baralho ficaria com menos de ' + B.minDeckSize + ')',
                    disabled: !canPay,
                    effect: function () {
                        queueNext(pickStep(req[0], first => {
                            queueNext(pickStep(req[1], second => {
                                removeCardFromDeck(first);
                                removeCardFromDeck(second);
                                state.clearedTiles.add(key);
                                R.syncState(state);
                                triggerGoldBanner('BAÚ DE PRATA ABERTO!');
                                setLog(D.CARDS[first].name + ' e ' + D.CARDS[second].name + ' ficam na fechadura. O baú se abre!');
                                grantArcanaOrGem(B.silverGemChance, ['epica', 'lendaria']);
                            }));
                        }));
                        return null;
                    }
                },
                {
                    label: 'Deixar para depois',
                    hint: 'O baú continua aqui',
                    effect: function () { return 'O Baú de Prata segue trancado, esperando a oferenda.'; }
                }
            ]
        };
    }

    function offeringEvent(key) {
        const sacrificable = () => deckCardsWhere(() => true);
        // Depois do sacrifício, quem pode ganhar +1 slot: outra carta (ou outra cópia) abaixo do teto de slots.
        const slotTargets = sacrificed => deckCardsWhere(id => {
            const base = D.getCardGemSlots(D.CARDS[id], state.extraGemSlots[id]);
            const stillThere = id !== sacrificed || state.deck.filter(c => c === id).length > 1;
            return stillThere && base > 0 && base < B.maxGemSlots;
        });
        const canSacrifice = state.deck.length - 1 >= B.minDeckSize && sacrificable().length > 0;
        const sacrificeStep = (desc, onPick) => ({
            type: 'pick',
            kind: 'sacrifice',
            title: 'MESA DE OFERENDA',
            desc: desc,
            cards: sacrificable(),
            cardNote: () => 'SACRIFICAR',
            declineLabel: 'DESISTIR',
            onPick: onPick,
            onDecline: () => setLog('Você recolhe a carta. A mesa continua à espera.')
        });
        return {
            id: 'mesa_oferenda',
            title: 'Mesa de Oferenda',
            desc: 'Uma mesa de pedra com um encaixe vazio em forma de losango. O que é deixado aqui abre espaço em outro lugar.',
            choices: [
                {
                    label: 'Sacrificar 1 carta por +1 Slot de Gema',
                    hint: canSacrifice ? 'Outra carta do baralho ganha 1 slot (máx. ' + B.maxGemSlots + ')' : 'Baralho no tamanho mínimo',
                    disabled: !canSacrifice,
                    effect: function () {
                        queueNext(sacrificeStep('Escolha a carta que fica na mesa (ela sai do baralho):', sacrificed => {
                            const targets = slotTargets(sacrificed);
                            if (targets.length === 0) {
                                setLog('Nenhuma outra carta pode receber um slot. Você recolhe a oferenda.');
                                return;
                            }
                            queueNext({
                                type: 'pick',
                                kind: 'slot',
                                title: 'MESA DE OFERENDA',
                                desc: D.CARDS[sacrificed].name + ' fica na mesa. Escolha a carta que ganha +1 Slot de Gema:',
                                cards: targets,
                                cardNote: () => '+1 SLOT',
                                declineLabel: 'DESISTIR',
                                onPick: target => {
                                    removeCardFromDeck(sacrificed);
                                    state.extraGemSlots[target] = (state.extraGemSlots[target] || 0) + 1;
                                    state.clearedTiles.add(key);
                                    R.syncState(state);
                                    A.play('levelup');
                                    setLog(D.CARDS[target].name + ' ganhou +1 Slot de Gema!');
                                },
                                onDecline: () => setLog('Você recolhe a carta. A mesa continua à espera.')
                            });
                        }));
                        return null;
                    }
                },
                {
                    label: 'Sacrificar 1 carta por +' + B.offeringVr + ' VR',
                    hint: canSacrifice ? 'Troca uma carta do baralho por VR' : 'Baralho no tamanho mínimo',
                    disabled: !canSacrifice,
                    effect: function () {
                        queueNext(sacrificeStep('Escolha a carta trocada por ' + B.offeringVr + ' VR (ela sai do baralho):', sacrificed => {
                            removeCardFromDeck(sacrificed);
                            state.vr += B.offeringVr;
                            state.clearedTiles.add(key);
                            R.syncState(state);
                            const pt = viewportPoint(0.5, 0.5);
                            spawnVrParticles(pt.x, pt.y, B.offeringVr);
                            setLog(D.CARDS[sacrificed].name + ' ficou na mesa. +' + B.offeringVr + ' VR.');
                        }));
                        return null;
                    }
                },
                {
                    label: 'Seguir em frente',
                    hint: 'A mesa continua aqui',
                    effect: function () { return 'Você deixa a mesa como está.'; }
                }
            ]
        };
    }

    // Poço dos Desejos: uso único e gratuito — Gema rara (ou melhor) ou uma Arcana extra.
    function useWishingWell(key) {
        state.clearedTiles.add(key);
        A.play('chest');
        triggerGoldBanner('POÇO DOS DESEJOS');
        setLog('Uma moeda cai no escuro. O Poço dos Desejos devolve um presente.');
        grantArcanaOrGem(B.wellGemChance, ['rara', 'epica', 'lendaria']);
        processModalQueue();
    }

    // Pickup de baú: carta temporária 0 Wild [Destroy] que fica à mão em todo combate até ser usada.
    function grantPickup(cardId) {
        const id = D.CARDS[cardId] && D.CARDS[cardId].consumable
            ? cardId : D.PICKUP_CARDS[Math.floor(Math.random() * D.PICKUP_CARDS.length)];
        markSeen('cards', id);
        state.deck.push(id);
        const pt = viewportPoint(0.5, 0.4);
        spawnFloatingText(pt.x, pt.y, 'PICKUP: ' + D.CARDS[id].name + '!', 'combo');
        return id;
    }

    // ---------- MODAL: CARD NARRATIVO ----------
    // ---------- ILUSTRAÇÃO 16:9 DOS CARDS (transição de fase e epílogo das 18:00) ----------
    // Imagem que falha não trava nada: o palco fica com o degradê de reserva do bioma.
    let artRaf = null;

    function showArt(stage, src, biome) {
        if (!stage) return false;
        stage.parentElement.classList.toggle('has-art', !!src);
        if (!src) {
            stage.classList.add('hidden');
            return false;
        }
        const img = stage.querySelector('img');
        stage.className = 'art-stage biome-' + biome;
        stage.dataset.kind = (window.GameIntro && window.GameIntro.BIOME_PARTICLES[biome]) || 'dust';
        stage.dataset.start = String(performance.now());
        img.onerror = () => stage.classList.add('img-failed');
        img.onload = () => stage.classList.remove('img-failed');
        if (img.getAttribute('src') !== src) img.src = src;
        else if (img.complete && img.naturalWidth === 0) stage.classList.add('img-failed');
        if (!artRaf) artRaf = requestAnimationFrame(artFrame);
        return true;
    }

    function artFrame(now) {
        let any = false;
        [els.narrativeArt, els.endArt].forEach(stage => {
            if (!stage || stage.closest('.hidden')) return;
            any = true;
            window.GameIntro.drawParticlesKind(stage.querySelector('canvas'), stage.dataset.kind, (now - Number(stage.dataset.start)) / 1000);
        });
        artRaf = any ? requestAnimationFrame(artFrame) : null;
    }

    function openNarrativeModal(item) {
        showArt(els.narrativeArt, item.art, item.biome);
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
            art: fl.art || null,
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
    // Final secreto: derrotar o Senhor das Horas carregando a Foto no Parque (relíquia da Fase 4).
    function hasSecretEnding() {
        return !!state && !state.infinite && state.specialRelics.includes(D.EPILOGUE.secretRelic);
    }

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
        (hasSecretEnding() ? ep.secretCalmLines : ep.calmLines).forEach(line => {
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
        return !isPaused() && !isTitleOpen() && state.mode === 'explore' && !state.busy && activeModal === null;
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
        if (ch === 'M' || ch === 'E' || ch === 'P' || ch === 'O' || ch === 'W') return false;
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
        if (state.tutorial) return null; // tutorial: encontros parados, o roteiro fica previsível
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
        gainVr(loot.vr);
        A.play('chest');
        setLog(loot.title + ': ' + loot.text);
        // A gema do baú espera na fila: abre ao fim do passo (ou depois do combate, se houver aggro).
        if (state.tutorial) {
            // Passo 4: gema certa para encaixar e, em seguida, a Arcana que fecha o treino.
            state.tutorial.chest = true;
            modalQueue.push({ type: 'gem', gemId: 'double' }, { type: 'arcana' });
        } else {
            modalQueue.push({ type: 'gem', gemId: randomGemId() });
            if (Math.random() < B.chestBiomeCardChance) modalQueue.push(biomeCardPick());
        }
        if (!state.tutorial && Math.random() < B.chestPickupChance) {
            const pickup = grantPickup();
            setLog(loot.title + ': ' + loot.text + ' Pickup: ' + D.CARDS[pickup].name + '!');
        }
        const evolved = checkAndTriggerEvolutions(true);
        detectNewCards();
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
        if ((tile === 'P' || tile === 'O' || tile === 'W') && !state.clearedTiles.has(key)) {
            showTip(tile === 'P' ? 'silver' : tile === 'W' ? 'well' : null);
            if (tile === 'W') useWishingWell(key);
            else enqueueModal({ type: 'event', event: tile === 'P' ? silverChestEvent(key) : offeringEvent(key) });
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
        markSeen('enemies', tpl.kind);
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
        // Hora Extra Infinita: cada onda nasce mais forte.
        if (state.infinite) {
            const w = Math.max(0, state.infinite.wave - 1);
            e.hp = Math.round(e.hp * (1 + B.infinite.waveHp * w));
            e.atk = Math.round(e.atk * (1 + B.infinite.waveAtk * w));
        }
        // Pressão 1+: +15% de HP; Pressão 3+: chefes com +15% de ATK e +4 de Escudo inicial.
        if (state.pressure >= 1) e.hp = Math.round(e.hp * (1 + D.PRESSURE_MODS.enemyHp));
        if (state.pressure >= 3 && e.isBoss) {
            e.atk = Math.round(e.atk * (1 + D.PRESSURE_MODS.bossAtk));
            e.shield += D.PRESSURE_MODS.bossShield;
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
        state.curse = Math.min(state.infinite ? B.infinite.curseCap : B.curseCap, state.curse + amount);
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
            if (ph.quote) showBossBubble(enemy, ph.quote);
            setLog(enemy.name + ' entra na FASE ' + enemy.phase + ': ' + ph.label + '!');
        }
    }

    // Balão rápido de 1 linha sobre o chefe na virada de fase (persona dark fantasy + eco do escritório).
    // Recompensa do segredo: Gema Lendária (pela fila única) + 50 VR fixos.
    function rewardTrickster(pos) {
        state.tricksterDefeated = true;
        state.vr += 50;
        modalQueue.push({ type: 'gem', gemId: randomGemId(['lendaria']) });
        triggerGoldBanner('SEGREDO: TRAPACEIRO DERROTADO!');
        spawnFloatingText(pos.x, pos.y - 40, '+50 VR + GEMA LENDÁRIA', 'combo big-hit');
        spawnVrParticles(pos.x, pos.y, 50);
    }

    function showBossBubble(enemy, text) {
        const pos = getEnemyTargetPos(enemy);
        const vp = els.viewport.getBoundingClientRect();
        const b = document.createElement('div');
        b.className = 'boss-bubble';
        b.dataset.boss = enemy.kind;
        b.textContent = text;
        b.style.left = Math.round(Math.max(90, Math.min(vp.width - 90, pos.x - vp.left))) + 'px';
        b.style.top = Math.round(Math.max(64, pos.y - vp.top - 90)) + 'px';
        els.viewport.appendChild(b);
        setTimeout(() => b.remove(), 2800);
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
        state.currentEncDef = enc;
        state.mana = state.maxMana;
        state.manaDrain = 0;
        state.shield = (state.turn1Shield || 0) + (state.armor || 0);
        state.crawler = null;
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
        state.columnBurnFloor = [0, 0, 0, 0, 0];
        state.bossOverkillDmg = 0;
        state.fightBurnDmg = 0;
        state.fightDestroys = 0;
        resetTurnTrackers(state);
        state.combatHurt = !!ambush;
        state.cardUses = {};
        state.discardDiscount = {};
        state.nextCostDiscount = 0;
        state.endTurnEchoes = [];
        state.turnLastFx = null;
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
        // Ajustes por slot (inimigos de treino do tutorial): valores fixos, sem escala de Curse.
        formation.slice(0, D.MAX_ENEMIES_IN_COMBAT).forEach((slot, i) => {
            const e = state.enemies[i];
            if (typeof slot.hp === 'number') { e.hp = slot.hp; e.maxHp = slot.hp; }
            if (typeof slot.atk === 'number') e.atk = slot.atk;
            if (typeof slot.shield === 'number') e.shield = slot.shield;
            if (typeof slot.xp === 'number') e.xp = slot.xp;
            if (slot.name) e.name = slot.name;
        });
        const invader = state.tricksterPending && !state.tutorial ? injectTrickster() : null;

        refreshFrontIntents(true);
        const fronts = getFrontEnemies(false);
        state.targetUid = (fronts[0] || state.enemies[0]).uid;

        // Compra Rápida (Swift): vai para o topo da compra e sai na mão inicial.
        // Pickups de baú não ocupam a compra: ficam à mão desde o Turno 1, além das cartas compradas.
        const shuffled = shuffle(state.deck.filter(id => !D.CARDS[id].consumable));
        const isSwift = id => D.cardHasGem(cardOf(id), 'swift');
        state.drawPile = shuffled.filter(id => !isSwift(id)).concat(shuffled.filter(isSwift));
        state.discardPile = [];
        state.destroyedPile = [];
        state.hand = [];
        state.handReturnCounts = [];
        state.handCostMods = [];
        state.handTemp = [];
        drawCards(state.dealCount || B.dealCount);
        state.deck.filter(id => D.CARDS[id].consumable).forEach(id => {
            if (state.hand.length < B.maxHandSize) pushToHand(id, 0);
            else state.drawPile.unshift(id);
        });
        // Tutorial: mão e compra roteirizadas para cada passo ensinar exatamente uma coisa.
        if (state.tutorial && enc.tutorialHand) {
            state.hand = [];
            state.handReturnCounts = [];
            state.handCostMods = [];
            state.handTemp = [];
            enc.tutorialHand.forEach(id => pushToHand(id, 0));
            state.drawPile = (enc.tutorialDraw || []).slice().reverse();
            state.discardPile = [];
        }
        if (state.tutorial && enc.tutorialMana) state.mana = enc.tutorialMana;

        A.play('encounter');
        if (invader) enc = Object.assign({}, enc, { intro: 'INVASÃO SECRETA: ' + invader.name + ' entrou no devaneio!' });
        // Trilha: tema de chefe se houver chefe na luta; senão, a batida de combate.
        A.setMusic(state.enemies.some(e => e.isBoss) ? 'boss' : 'combat');
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

    // hand, handReturnCounts, handCostMods e handTemp são arrays paralelos: só mexa neles por aqui.
    function pushToHand(cardId, returnCount, temp) {
        markSeen('cards', cardId);
        // handTemp pode estar mais curto se a mão foi montada por fora (testes): alinha antes de inserir.
        while (state.handTemp.length < state.hand.length) state.handTemp.push(false);
        state.hand.push(cardId);
        state.handReturnCounts.push(returnCount || 0);
        state.handCostMods.push(0);
        state.handTemp.push(!!temp);
    }

    function removeFromHand(handIndex) {
        const temp = isTempInHand(handIndex);
        const cardId = state.hand.splice(handIndex, 1)[0];
        const returnCount = state.handReturnCounts.splice(handIndex, 1)[0] || 0;
        state.handCostMods.splice(handIndex, 1);
        state.handTemp.splice(handIndex, 1);
        return { cardId: cardId, returnCount: returnCount, temp: temp };
    }

    // Cópia (gema) ou carta gerada: some ao ser jogada ou no fim do turno, nunca vai ao descarte.
    function isTempInHand(handIndex) {
        return !!state.handTemp[handIndex] || !!D.CARDS[state.hand[handIndex]].tempOnly;
    }

    // Carta que sai da mão sem ser jogada (fim do turno ou gema Troca). Quem tem discardDiscount barateia.
    function noteDiscard(cardId) {
        const discount = D.CARDS[cardId].discardDiscount || 0;
        if (discount > 0) state.discardDiscount[cardId] = (state.discardDiscount[cardId] || 0) + discount;
    }

    function discardFromHand(handIndex) {
        const removed = removeFromHand(handIndex);
        if (removed.temp) return;
        state.discardPile.push(removed.cardId);
        noteDiscard(removed.cardId);
    }

    // Modificador de custo da carta na mão: Confusão, descontos (Asas do Devaneio / descarte) e Custo X.
    // useNextDiscount=false ignora o desconto das Asas (simulação das cartas seguintes do Jogar Tudo).
    function getHandCostMod(handIndex, mana, useNextDiscount) {
        const cardId = state.hand[handIndex];
        const card = cardOf(cardId);
        if (card.xCost) return D.getXCostMod(card, typeof mana === 'number' ? mana : state.mana);
        return (state.handCostMods[handIndex] || 0) - (state.discardDiscount[cardId] || 0) - comboCostCut(card) -
            (useNextDiscount === false ? 0 : (state.nextCostDiscount || 0));
    }

    // Paradoxo das 18h: com a cadeia ativa custa 4 menos o Combo atual (x2 -> 2, x3 -> 1, x4+ -> 0).
    function comboCostCut(card) {
        if (!card || !card.comboCostCut || !state || state.mode !== 'combat') return 0;
        const chainActive = state.comboCarry || (state.lastComboCost !== null && state.lastComboCost !== undefined);
        return chainActive ? D.getComboMult(state.comboCount) : 0;
    }

    function getHandCost(handIndex, mana, useNextDiscount) {
        return D.getEffectiveCost(cardOf(state.hand[handIndex]), getHandCostMod(handIndex, mana, useNextDiscount));
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
        // Maré Alta: +Pierce se a coluna do alvo já está queimando.
        if (card.pierceVsBurning > 0 && target && (state.columnBurn[target.col] || 0) > 0) pierceLeft += card.pierceVsBurning;
        while (enemy) {
            alreadyHit.push(enemy.uid);
            let hitDmg = pv.damage;
            const pos = getEnemyTargetPos(enemy);
            // Sino do Vigia / Execução Lunar: 2x em quem está Desarmado ou Congelado.
            if (hitDmg > 0 && card.bonusVsControlled > 1 && (enemy.disarmed || enemy.frost > 0)) {
                hitDmg = Math.round(hitDmg * card.bonusVsControlled);
                spawnFloatingText(pos.x, pos.y - 40, 'PUNIÇÃO x' + card.bonusVsControlled, 'combo');
            }
            // Estilhaço Glacial: alvo que JÁ estava congelado estilhaça (dano extra + Escudo uma vez por jogada).
            if (card.shatterBonus > 0 && enemy.frost > 0 && enemy.hp > 0) {
                hitDmg += card.shatterBonus;
                spawnFloatingText(pos.x, pos.y - 40, 'ESTILHAÇOU! +' + card.shatterBonus, 'combo');
                if (opts && opts.play && !opts.play.shattered && card.shatterShield > 0) {
                    opts.play.shattered = true;
                    state.shield += card.shatterShield;
                    const p = viewportPoint(0.5, 0.72);
                    spawnFloatingText(p.x, p.y, '+' + card.shatterShield + ' Escudo', 'shield');
                }
            }
            if (hitDmg > 0 && applyDamageToEnemy(enemy, hitDmg, card, usedMult, opts).overkill) overkill = true;
            if (card.burnPerHit > 0) {
                const add = D.withDuration(card.burnPerHit, getStat('Duration'));
                state.columnBurn[enemy.col] = (state.columnBurn[enemy.col] || 0) + add;
                const cp = R.getColumnScreenPos(enemy.col);
                spawnFloatingText(cp.x, cp.y - 26, '+' + add + ' BURN', 'player-hit');
                showTip('burn');
            }
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
        if (state.enemies.filter(e => e.hp > 0 && e.frost > 0).length >= 3) goal('frio_calculista');
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
        return 'PRÓX: C' + D.nextComboCosts(state.lastComboCost, isReverseActive()).join('/C') + ' ou WILD';
    }

    // Chance de crítico da carta + bônus do turno (Manto do Caçador vale para qualquer carta de dano).
    function critChanceOf(card) {
        if (!card || !(card.damage > 0 || card.critChance > 0)) return 0;
        return (card.critChance || 0) + ((state && state.turnCrit) || 0);
    }

    function applyDamageToEnemy(enemy, rawDmg, card, usedMult, opts) {
        if (!enemy || (enemy.hp <= 0 && !enemy.overkill)) return { overkill: false, dealt: 0 };
        const o = opts || {};
        const pos = getEnemyTargetPos(enemy);

        // Overkill ativo em Chefe: converte dano adicional diretamente em VR extra
        if (enemy.overkill) {
            const critRoll = (!o.isSplash && !o.isBurn && critChanceOf(card) > 0)
                ? Math.random() < (critChanceOf(card) * getLuckMultiplier())
                : false;
            const dmg = critRoll ? Math.round(rawDmg * (card.critMult || 1.5)) : rawDmg;
            const extraVr = gainVr(Math.max(1, Math.ceil(dmg / 4)));
            noteBossOverkill(dmg);
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
        if (!o.isSplash && !o.isBurn && critChanceOf(card) > 0) {
            const effCrit = critChanceOf(card) * getLuckMultiplier();
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
                spawnFloatingText(pos.x, pos.y - 12, (o.label || 'Burn') + ' -' + remaining, 'player-hit');
                state.fightBurnDmg = (state.fightBurnDmg || 0) + Math.min(remaining, prevHp);
                if (state.fightBurnDmg >= 50) goal('piromaniaco');
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
                    showTip('overkill');
                    if (enemy.dropRelic) state.pendingDrop = enemy.dropRelic;
                    bonusVr = Math.max(2, Math.ceil(excess / 3));
                    noteBossOverkill(excess);
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
                if (state.kills >= 100) goal('abates');
                if (enemy.kind === 'trickster') rewardTrickster(pos);
                const gainedVr = gainVr(enemy.vr + bonusVr);
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
        const chance = Math.min(0.98, (baseChance + (state.kbBonus || 0)) * getLuckMultiplier());
        if (D.rollKnockback(chance, enemy.kbResist, Math.random())) {
            enemy.disarmed = true;
            enemy.hasIntent = false;
            A.play('stun');
            spawnFloatingText(pos.x, pos.y + 16, 'DESARMADO!', 'shield');
            state.turnDisarms = (state.turnDisarms || 0) + 1;
            if (state.turnDisarms >= 3) goal('cacador_implacavel');
            if (card.manaOnDisarm > 0) {
                state.mana += card.manaOnDisarm;
                spawnFloatingText(pos.x, pos.y + 30, '+' + card.manaOnDisarm + ' Cafeína', 'combo');
            }
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
        showTip('burn');
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
            // burnSpread: também as colunas vizinhas. burnPersist: piso do Burn da coluna até o fim da luta.
            const spread = card.burnSpread || 0;
            for (let c = Math.max(0, singleTarget.col - spread); c <= Math.min(4, singleTarget.col + spread); c++) {
                state.columnBurn[c] += burnAmt;
                if (card.burnPersist > 0) state.columnBurnFloor[c] = Math.max(state.columnBurnFloor[c] || 0, card.burnPersist);
                const cp = R.getColumnScreenPos(c);
                spawnFloatingText(cp.x, cp.y - 26, '+' + burnAmt + ' BURN' + (card.burnPersist > 0 ? ' (persistente)' : ''), 'player-hit');
            }
        }
    }

    // Rachadura: conta o uso da carta neste combate. Retorna true se ela estilhaçou (sai do baralho da run).
    function registerCardUse(cardId, card) {
        state.cardUses[cardId] = (state.cardUses[cardId] || 0) + 1;
        if (!D.isBreakableCard(card)) return false;
        const wasCracked = !!state.crackedCards[cardId];
        const roll = D.rollCrack(state.cardUses[cardId], wasCracked, Math.random(), D.cardHasGem(card, 'preserve'));
        const p = viewportPoint(0.5, 0.52);
        if (roll.cracked && !wasCracked) {
            state.crackedCards[cardId] = true;
            showTip('crack');
            A.play('immune');
            spawnFloatingText(p.x, p.y, card.name + ' RACHOU!', 'player-hit');
        }
        // O baralho nunca cai abaixo do mínimo por estilhaço.
        if (!roll.shattered || state.deck.length <= B.minDeckSize || !state.deck.includes(cardId)) return false;
        A.play('death');
        R.triggerShake(0.06, 0.22);
        spawnFloatingText(p.x, p.y, card.name + ' ESTILHAÇOU!', 'player-hit');
        noteShatter();
        if (state.shatters >= 3) goal('mao_pesada');
        return true;
    }

    // Segredo: a 3ª carta estilhaçada na run atrai o Trapaceiro para o encontro seguinte (1x por run).
    function noteShatter() {
        state.shatters = (state.shatters || 0) + 1;
        if (state.shatters >= 3 && !state.tricksterSeen && !state.tutorial) {
            state.tricksterSeen = true;
            state.tricksterPending = true;
            const p = viewportPoint(0.5, 0.4);
            spawnFloatingText(p.x, p.y, 'Algo ri no fundo da sua mente...', 'buff');
            setLog('Três cartas em pedaços... alguém achou graça. O próximo encontro não será como os outros.');
        }
    }

    // Invasão secreta: o Trapaceiro entra numa coluna livre da frente (ou atrás do centro) e escala com a fase.
    function injectTrickster() {
        state.tricksterPending = false;
        const usedFront = state.enemies.filter(e => e.row === 0).map(e => e.col);
        let col = [2, 1, 3, 0, 4].find(c => !usedFront.includes(c));
        let row = 0;
        if (col === undefined) {
            col = 2;
            row = 1 + Math.max(0, ...state.enemies.filter(e => e.col === 2).map(e => e.row));
        }
        if (state.enemies.length >= D.MAX_ENEMIES_IN_COMBAT) state.enemies.pop();
        const t = makeEnemy('trickster', false, col, row, false);
        const f = Math.max(0, (Number(state.floor) || 1) - 1);
        t.hp = Math.round(t.hp * (1 + 0.35 * f));
        t.maxHp = t.hp;
        t.atk = Math.round(t.atk * (1 + 0.2 * f));
        state.enemies.push(t);
        showBanner(els.ambushBanner, 'INVASÃO SECRETA!');
        A.play('alert');
        return t;
    }

    // Tira 1 cópia real da carta das pilhas do combate (quando a cópia jogada era temporária).
    function removeCopyFromPiles(cardId) {
        for (const pile of [state.comboPile, state.discardPile, state.drawPile]) {
            const idx = pile.indexOf(cardId);
            if (idx >= 0) {
                pile.splice(idx, 1);
                return;
            }
        }
        const handIdx = state.hand.findIndex((id, i) => id === cardId && !isTempInHand(i));
        if (handIdx >= 0) removeFromHand(handIdx);
    }

    // Gema Ímã: outra cópia da mesma carta vem da compra (ou do descarte) para a mão.
    function pullCopyToHand(cardId) {
        if (state.hand.length >= B.maxHandSize) return false;
        const pile = state.drawPile.includes(cardId) ? state.drawPile : state.discardPile;
        const idx = pile.lastIndexOf(cardId);
        if (idx < 0) return false;
        pile.splice(idx, 1);
        pushToHand(cardId, 0);
        return true;
    }

    // Gema Troca: descarta lixo (a Bomba primeiro) ou a carta mais cara que não dá para pagar. -1 = nada a descartar.
    function pickSwitchDiscard() {
        const indices = state.hand.map((_, i) => i);
        const junk = indices.filter(i => cardOf(state.hand[i]).type === 'curse')
            .sort((a, b) => (cardOf(state.hand[b]).endTurnBomb ? 1 : 0) - (cardOf(state.hand[a]).endTurnBomb ? 1 : 0));
        if (junk.length > 0) return junk[0];
        const unaffordable = indices.filter(i => !cardOf(state.hand[i]).xCost && getHandCost(i) > state.mana)
            .sort((a, b) => getHandCost(b) - getHandCost(a));
        return unaffordable.length > 0 ? unaffordable[0] : -1;
    }

    // Efeitos "ao jogar" das gemas de mão (Cópia, Ímã, Yin Yang, Troca).
    function applyOnPlayGems(cardId, card, canCopy) {
        const notes = [];
        if (canCopy && D.cardHasGem(card, 'copia') && state.hand.length < B.maxHandSize) {
            pushToHand(cardId, 0, true);
            notes.push('CÓPIA');
        }
        if (D.cardHasGem(card, 'ima') && pullCopyToHand(cardId)) notes.push('ÍMÃ');
        if (D.cardHasGem(card, 'yinyang')) {
            const drawTurn = !!state.yinYang[cardId];
            state.yinYang[cardId] = !drawTurn;
            if (drawTurn) {
                drawCards(1);
                notes.push('YANG: comprou 1');
            } else {
                state.mana += 1;
                notes.push('YIN: +1 Cafeína');
            }
        }
        if (D.cardHasGem(card, 'switch')) {
            const idx = pickSwitchDiscard();
            if (idx >= 0) discardFromHand(idx);
            drawCards(1);
            notes.push(idx >= 0 ? 'TROCA: descartou 1, comprou 1' : 'TROCA: comprou 1');
        }
        if (notes.length > 0) {
            const p = viewportPoint(0.5, 0.5);
            spawnFloatingText(p.x, p.y, notes.join(' • '), 'combo');
        }
    }

    // Apaga inimigos comuns (nem chefe nem Elite). Sem eraseRewards eles somem sem XP nem VR.
    function eraseEnemies(card) {
        const victims = state.enemies.filter(e => e.hp > 0 && !e.isBoss && !e.elite && (card.erase === 'all' || e.row === 0));
        victims.forEach(enemy => {
            const pos = getEnemyTargetPos(enemy);
            if (card.eraseRewards) {
                applyDamageToEnemy(enemy, enemy.hp, null, 1, { isBurn: true, label: 'Apagado' });
                return;
            }
            enemy.hp = 0;
            enemy.shield = 0;
            enemy.killedOnce = true;
            enemy.hasIntent = false;
            state.kills += 1;
            R.triggerEnemyHitAnim(enemy.uid, true);
            R.spawnBurst(pos.x, pos.y, ['#b288e0', '#ec6bff', '#241b2e'], 14, { speed: 160, life: 0.5, size: 6 });
            spawnFloatingText(pos.x, pos.y - 12, 'APAGADO!', 'buff');
        });
        if (victims.length > 0) {
            A.play('death');
            R.triggerScreenFlash('#b288e0', 0.3, 0.3);
            normalizeColumns();
            refreshFrontIntents(false);
            R.syncState(state);
        }
        return victims.length;
    }

    // Gema Bombardeio: explosão extra numa coluna aleatória; a Luck aumenta a chance de pegar as vizinhas.
    function fireBombardment(damage, usedMult) {
        const fronts = getFrontEnemies(true);
        if (fronts.length === 0) return false;
        const target = fronts[Math.floor(Math.random() * fronts.length)];
        const blast = Math.max(1, Math.round(damage * B.gemBombRatio));
        const pos = getEnemyTargetPos(target);
        R.fireProjectile({ kind: 'fire', toUid: target.uid, duration: 110 });
        A.play('hit');
        spawnFloatingText(pos.x, pos.y - 40, 'BOMBARDEIO!', 'combo');
        let overkill = applyDamageToEnemy(target, blast, null, usedMult, { noSplash: true }).overkill;
        [target.col - 1, target.col + 1].forEach(col => {
            const adj = getFrontEnemyAtCol(col, true);
            if (adj && adj.uid !== target.uid && Math.random() < B.gemBombSpread * getLuckMultiplier()) {
                if (applyDamageToEnemy(adj, blast, null, usedMult, { isSplash: true }).overkill) overkill = true;
            }
        });
        return overkill;
    }

    // Resolve os EFEITOS de uma carta (sem custo, combo nem destino): é o que as gemas Eco e Pós-Vida e o
    // LOOP do Anel de Trovões repetem. fx = { mult, x, dmgMult, gems }; done({ hits, overkill }) pode ser síncrono.
    function runCardEffect(card, fx, done) {
        const usedMult = fx.mult || 1;
        const pv = getCardPreviewValues(card, usedMult, false, fx.x || 0);
        if (fx.dmgMult > 1 && pv.damage > 0) pv.damage = Math.round(pv.damage * fx.dmgMult);

        if (pv.shield > 0) {
            state.shield += pv.shield;
            const p = viewportPoint(0.5, 0.72);
            spawnFloatingText(p.x, p.y, '+' + pv.shield + ' Escudo', 'shield');
            if (hasArcana('golpe_escudo')) {
                getFrontEnemies(true).forEach(front => noteShieldDamage(applyDamageToEnemy(front, state.shield, null, usedMult, { noSplash: true }).dealt));
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
        if (card.comboBonus > 0) {
            state.comboCount += card.comboBonus;
            state.combo = D.getComboMult(state.comboCount);
            buffs.push('+' + card.comboBonus + ' Combo');
        }
        if (card.costDiscount > 0) {
            state.nextCostDiscount = card.costDiscount;
            buffs.push('Próxima carta: custo -' + card.costDiscount);
        }
        if (card.genCard) {
            let made = 0;
            for (let i = 0; i < (card.genCount || 1) && state.hand.length < B.maxHandSize; i++) {
                pushToHand(card.genCard, 0, true);
                made++;
            }
            buffs.push(made > 0 ? '+' + made + ' ' + D.CARDS[card.genCard].name : 'Mão cheia!');
        }
        if (card.vrGain > 0) {
            const got = gainVr(card.vrGain);
            const p = viewportPoint(0.5, 0.5);
            spawnVrParticles(p.x, p.y, got);
            buffs.push('+' + got + ' VR');
        }
        if (buffs.length > 0) {
            const p = viewportPoint(0.5, 0.58);
            spawnFloatingText(p.x, p.y, buffs.join(' • '), 'combo');
        }
        if (card.freezeFront > 0) getFrontEnemies(false).forEach(front => applyFrost(front, card.freezeFront));
        if (card.erase) eraseEnemies(card);
        if (card.crawler) activateCrawler(card);
        const special = runSpecialEffects(card, fx, usedMult);

        if (!(pv.damage > 0 || card.knockback || card.burn > 0)) {
            A.play(card.sfx);
            done({ hits: special.hits, overkill: special.overkill });
            return;
        }

        // Ataque de Armadura soma o Escudo ao 1º acerto; Dizimar tira % da vida atual do 1º alvo.
        const spike = fx.gems && D.cardHasGem(card, 'spike') ? state.shield : 0;
        const demi = fx.gems && D.cardHasGem(card, 'demi');
        // Cada acerto escolhe o alvo pelo padrão de mira com o tabuleiro atual (inimigos morrem no meio).
        const totalHits = fx.forceHits || Math.max(1, pv.hits);
        const isWave = card.targeting === 'FrontRow';
        const playMemo = {};
        const aim = { lastCol: null, bag: [] };
        let burnApplied = false;
        let hitNum = 0;
        let anyOverkill = false;
        const end = () => {
            if (fx.gems && pv.damage > 0 && D.cardHasGem(card, 'bombardeio') && state.enemies.some(e => e.hp > 0 || e.overkill)) {
                later(150, () => {
                    if (state.mode !== 'combat') {
                        state.busy = false;
                        return;
                    }
                    if (fireBombardment(pv.damage, usedMult)) anyOverkill = true;
                    done({ hits: hitNum, overkill: anyOverkill });
                });
                return;
            }
            done({ hits: hitNum, overkill: anyOverkill });
        };
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
                let hitPv = pv;
                if (hitNum === 0) {
                    if (demi && targets[0].hp > 0) {
                        const cut = D.getDemiDamage(targets[0].hp, targets[0].isBoss);
                        const pos = getEnemyTargetPos(targets[0]);
                        spawnFloatingText(pos.x, pos.y - 44, 'DIZIMAR -' + cut, 'combo');
                        if (applyDamageToEnemy(targets[0], cut, null, usedMult, { noSplash: true }).overkill) anyOverkill = true;
                    }
                    if (spike > 0 && pv.damage > 0) {
                        hitPv = Object.assign({}, pv, { damage: pv.damage + spike });
                        noteShieldDamage(spike);
                        const p = viewportPoint(0.5, 0.66);
                        spawnFloatingText(p.x, p.y, 'ARMADURA +' + spike + ' de dano', 'shield');
                    }
                }
                targets.forEach(target => {
                    if (resolveHit(card, hitPv, usedMult, target, aim, { noSplash: isWave, play: playMemo })) anyOverkill = true;
                });
                // Onda: cada frente recebe de uma vez o splash das outras colunas atingidas.
                if (isWave && targets.length > 1) applyAreaSplash(-1, hitPv.damage, card, usedMult, targets.length - 1);
                hitNum++;
            }
            if (targets.length === 0 || hitNum >= totalHits) {
                end();
                return;
            }
            R.syncState(state);
            renderAll();
            later(155, runHit);
        };
        runHit();
    }

    // ---------- ETAPA 8: EFEITOS DAS CARTAS DE BIOMA ----------
    // Efeitos sem mira (antes dos acertos). Retorna { hits, overkill } do dano que eles mesmos causaram.
    function runSpecialEffects(card, fx, usedMult) {
        const out = { hits: 0, overkill: false };
        const note = (text, kind, fy) => {
            const p = viewportPoint(0.5, fy || 0.5);
            spawnFloatingText(p.x, p.y, text, kind || 'combo');
        };
        if (card.turnCrit > 0) {
            state.turnCrit = (state.turnCrit || 0) + card.turnCrit;
            note('+' + Math.round(card.turnCrit * 100) + '% Crit neste turno', 'combo', 0.54);
        }
        if (card.drawIfFrontControlled > 0 && getFrontEnemies(false).some(e => e.hp > 0 && (e.disarmed || e.frost > 0))) {
            drawCards(card.drawIfFrontControlled);
            note('Alvo controlado: +1 carta', 'combo', 0.6);
        }
        if (card.burnTickNow > 0) {
            for (let i = 0; i < card.burnTickNow; i++) {
                const res = tickColumnBurn('Ressaca');
                if (res.overkill) out.overkill = true;
            }
            if (card.drawIfBurning > 0 && getFrontEnemies(false).some(e => e.hp > 0 && (state.columnBurn[e.col] || 0) > 0)) {
                drawCards(card.drawIfBurning);
                note('Inimigo queimando: +1 carta', 'combo', 0.6);
            }
        }
        if (card.burnWorstCard) incinerateWorstCard();
        if (card.turnReverse) {
            state.turnReverse = true;
            note('COMBO REVERSO até o fim do turno', 'combo', 0.5);
        }
        if (card.handDiscount > 0) {
            let best = -1;
            state.hand.forEach((id, idx) => {
                const c = cardOf(id);
                if (c.xCost || c.type === 'curse' || getHandCost(idx) <= 0) return;
                if (best < 0 || getHandCost(idx) > getHandCost(best)) best = idx;
            });
            if (best >= 0) {
                state.handCostMods[best] = (state.handCostMods[best] || 0) - card.handDiscount;
                note(cardOf(state.hand[best]).name + ': custo -' + card.handDiscount, 'combo', 0.62);
            }
        }
        if (card.mirrorLast) {
            const src = fx.prevPlayedId && D.CARDS[fx.prevPlayedId];
            if (!src || src.mirrorLast) note('Nada para espelhar neste turno', 'buff', 0.58);
            else if (state.hand.length >= B.maxHandSize) note('Mão cheia!', 'buff', 0.58);
            else {
                pushToHand(src.id, 0, true);
                state.handCostMods[state.hand.length - 1] = -1;
                note('ESPELHO: ' + src.name + ' (custo -1, Destroy)', 'combo', 0.58);
            }
        }
        // Bastião de Cristal / Glaciar Absoluto: dano = Escudo total na linha de frente.
        if (card.damageFromShield && state.shield > 0) {
            const dmg = state.shield;
            const fronts = getFrontEnemies(true).filter(e => e.hp > 0 || e.overkill);
            if (fronts.length > 0) R.fireProjectile({ kind: 'wave', duration: 150 });
            fronts.forEach(front => {
                const res = applyDamageToEnemy(front, dmg, card, usedMult, { noSplash: true });
                if (res.overkill) out.overkill = true;
                noteShieldDamage(res.dealt);
            });
            if (fronts.length > 0) {
                out.hits = 1;
                note('MURALHA OFENSIVA: ' + dmg + ' de dano', 'combo big-hit', 0.46);
            }
        }
        return out;
    }

    // Fortaleza Viva: soma o dano baseado em Escudo causado neste turno.
    function noteShieldDamage(amount) {
        state.turnShieldDmg = (state.turnShieldDmg || 0) + Math.max(0, amount || 0);
        if (state.turnShieldDmg >= 35) goal('fortaleza_viva');
    }

    // Queima de Arquivo: cartas destruídas com Destroy nesta luta.
    function noteDestroyed(count) {
        state.fightDestroys = (state.fightDestroys || 0) + (count || 1);
        if (state.fightDestroys >= 4) goal('queima_arquivo');
    }

    // Incinerar Arquivo: queima a carta-lixo da mão; sem lixo, a mais fraca (menor custo e dano).
    function incinerateWorstCard() {
        const candidates = state.hand.map((id, idx) => ({ id: id, idx: idx, c: cardOf(id) }))
            .filter(x => !x.c.crawler && !x.c.consumable && !x.c.burnWorstCard);
        if (candidates.length === 0) {
            const p = viewportPoint(0.5, 0.56);
            spawnFloatingText(p.x, p.y, 'Nada para incinerar', 'buff');
            return false;
        }
        const weight = x => (x.c.type === 'curse' ? -100 : 0) + (x.c.xCost ? 2 : x.c.cost) * 10 + (x.c.damage || 0) + (x.c.shield || 0) / 2;
        const victim = candidates.sort((a, b) => weight(a) - weight(b))[0];
        const removed = removeFromHand(victim.idx);
        state.destroyedPile.push(removed.cardId);
        noteDestroyed(1);
        state.mana += 2;
        state.combatBuff.Might += 15;
        const p = viewportPoint(0.5, 0.56);
        spawnFloatingText(p.x, p.y, 'INCINEROU ' + D.CARDS[removed.cardId].name + ': +2 Cafeína, +15% Might', 'combo');
        A.play('death');
        return true;
    }

    // Um tick de Burn em todas as colunas (fim do turno ou Ressaca). Retorna { ticked, overkill }.
    function tickColumnBurn(label) {
        let ticked = false;
        let overkill = false;
        for (let col = 0; col < 5; col++) {
            const stacks = state.columnBurn[col] || 0;
            if (stacks <= 0) continue;
            const front = getFrontEnemyAtCol(col, false);
            if (front && front.hp > 0) {
                ticked = true;
                if (applyDamageToEnemy(front, stacks, null, 1, { isBurn: true, label: label }).overkill) overkill = true;
            }
            state.columnBurn[col] = Math.max(state.columnBurnFloor[col] || 0, stacks - 1);
        }
        return { ticked: ticked, overkill: overkill };
    }

    // ---------- CARTA DE CRAWLER ----------
    function crawlerTurns() {
        return D.withDuration(B.crawlerTurns, getStat('Duration'));
    }

    function activateCrawler(card) {
        state.crawler = { cardId: card.id, charId: card.crawler, turns: crawlerTurns(), triggers: 0 };
        const hero = D.getCharacter(card.crawler);
        const p = viewportPoint(0.5, 0.42);
        spawnFloatingText(p.x, p.y, 'CRACHÁ ATIVO: ' + hero.name + ' (' + state.crawler.turns + ' turnos)', 'combo');
        A.play('levelup');
    }

    // Toda carta jogada do tipo certo dispara a passiva do retrato ativo (Eco/LOOP/Pós-Vida não disparam).
    function triggerCrawler(card) {
        const cr = state.crawler;
        if (!cr || cr.turns <= 0 || card.crawler || card.type === 'curse') return;
        const def = D.CARDS[cr.cardId];
        const kind = D.isWildCard(card) ? 'wild' : card.type;
        if (!def.crawlerTrigger.includes(kind) && !def.crawlerTrigger.includes(card.type)) return;
        const fx = def.crawlerFx;
        const notes = [];
        if (fx.shield) {
            state.shield += fx.shield;
            notes.push('+' + fx.shield + ' Escudo');
        }
        if (fx.vr) notes.push('+' + gainVr(fx.vr) + ' VR');
        const fronts = getFrontEnemies(false);
        if (fx.damage && fronts.length > 0) {
            const target = fronts[Math.floor(Math.random() * fronts.length)];
            const dmg = Math.max(1, Math.round(fx.damage * (1 + getStat('Might') / 100)));
            R.fireProjectile({ kind: 'orb', toUid: target.uid, duration: 110 });
            applyDamageToEnemy(target, dmg, null, 1, {});
            notes.push('Pincelada ' + dmg);
        }
        if (fx.disarm) {
            const attackers = fronts.filter(e => e.hp > 0 && e.hasIntent);
            if (attackers.length > 0) {
                const target = attackers[Math.floor(Math.random() * attackers.length)];
                tryKnockback(target, { knockbackChance: fx.disarm }, getEnemyTargetPos(target));
            }
        }
        cr.triggers += 1;
        const p = viewportPoint(0.2, 0.34);
        spawnFloatingText(p.x, p.y, D.getCharacter(cr.charId).name.split(' ')[0] + ': ' + notes.join(' • '), 'combo');
        if (els.crawlerPortrait) {
            els.crawlerPortrait.classList.remove('fired');
            void els.crawlerPortrait.offsetWidth;
            els.crawlerPortrait.classList.add('fired');
        }
    }

    function playCard(handIndex) {
        if (state.mode !== 'combat' || state.busy) return false;
        const cardId = state.hand[handIndex];
        const card = cardOf(cardId);
        if (!card) return false;
        const costMod = getHandCostMod(handIndex);
        const effCost = D.getEffectiveCost(card, costMod);
        // Custo X precisa de pelo menos 1 de Cafeína (X = 0 não faria nada).
        if (state.mana < effCost || (card.xCost && effCost < 1)) return false;

        A.unlock();
        R.setHoveredCard(null);
        const xValue = card.xCost ? effCost : 0;
        const isTemp = isTempInHand(handIndex);
        state.mana -= effCost;
        state.nextCostDiscount = 0; // o desconto das Asas do Devaneio vale só para esta carta
        const returnCount = removeFromHand(handIndex).returnCount;

        // Regra estrita v1.6.1a: effectiveCost - 1 === lastComboCost OU Wild. Quebrar a sequência
        // reinicia a cadeia em 1x com a carta jogada; depois de um Wild a próxima pode custar 0 ou 1.
        const chained = card.type !== 'curse' &&
            (state.comboCarry || D.canCardCombo(card, state.lastComboCost, costMod, isReverseActive()));
        state.comboCarry = false;
        state.comboReverse = D.cardHasGem(card, 'reverse');
        state.comboCount = chained ? state.comboCount + 1 : 0;
        state.comboChain = chained ? state.comboChain.concat(cardId) : [cardId];
        state.lastComboCost = D.getComboCostAfter(card, costMod);
        const usedMult = D.getComboMult(state.comboCount);
        state.combo = usedMult;
        if (usedMult >= 5) goal('escadinha');
        if (usedMult >= 7) goal('mestre_paradoxo');
        // Viajante de Mundos: biomas das cartas exclusivas jogadas nesta run.
        if (card.biome && !state.tutorial) {
            state.biomesPlayed = state.biomesPlayed || [];
            if (!state.biomesPlayed.includes(card.biome)) state.biomesPlayed.push(card.biome);
        }
        const prevPlayedId = state.turnLastPlayedId;
        if (card.type !== 'curse' && !card.consumable) state.turnLastPlayedId = cardId;
        const isWild = D.isWildCard(card);

        // Quebra-Combo: o efeito sai no multiplicador atual + bônus pelo Combo consumido; a cadeia volta a 1x.
        let dmgMult = 1;
        if (D.cardHasGem(card, 'discharge') && state.comboCount > 0) {
            dmgMult = D.getDischargeMult(state.comboCount);
            const p = viewportPoint(0.5, 0.46);
            spawnFloatingText(p.x, p.y, 'QUEBRA-COMBO! Dano x' + dmgMult, 'combo big-hit');
            state.comboCount = 0;
            state.combo = 1;
            state.comboChain = [cardId];
        }

        const shattered = registerCardUse(cardId, card);

        // Destino da carta jogada: Estilhaço / Temporária / Destroy / Return / ComboPile (vai ao Descarte no fim do turno)
        let returnedToHand = false;
        const destroyed = card.destroy && !D.cardHasGem(card, 'preserve');
        if (shattered) {
            removeCardFromDeck(cardId);
            if (isTemp) removeCopyFromPiles(cardId);
            state.destroyedPile.push(cardId);
        } else if (isTemp) {
            state.destroyedPile.push(cardId);
            noteDestroyed(1);
        } else if (destroyed) {
            state.destroyedPile.push(cardId);
            noteDestroyed(1);
            if (D.isOneShotCard(card)) {
                // Uso único (bônus permanente ou pickup): a carta sai do baralho da run, não só da luta.
                removeCardFromDeck(cardId);
            }
            if (card.permMaxHp > 0 || card.permGrowth > 0 || card.permRevival > 0) {
                if (card.permMaxHp > 0) {
                    state.maxHp = Math.min((state.maxHpCap || B.maxHpCap), state.maxHp + card.permMaxHp);
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

        // Cópia: só na 1ª jogada da carta no turno (não na volta do Return nem na própria cópia).
        applyOnPlayGems(cardId, card, !isTemp && !shattered && returnCount === 0);
        if (card.endTurnRepeat) state.endTurnEchoes.push({ card: card, mult: usedMult });

        const prevFx = state.turnLastFx;
        if (card.type !== 'curse') state.turnLastFx = { card: card, mult: usedMult, x: xValue };

        let hitNum = 0;
        let anyOverkill = false;
        const finish = () => {
            if (anyOverkill) triggerOverkillBanner();
            let msg = card.name;
            if (hitNum > 1) msg += ': ' + hitNum + ' golpes!';
            if (usedMult > 1) msg += ' [COMBO ' + usedMult + 'x]';
            else if (isWild) msg += ' [WILD]';
            if (xValue > 0) msg += ' [X = ' + xValue + ']';
            if (returnedToHand) msg += ' [RETURN]';
            if (shattered) msg += ' [ESTILHAÇOU]';
            else if (destroyed || isTemp) msg += ' [DESTROY]';
            if (anyOverkill) msg += ' — OVERKILL!';
            setLog(msg);
            getTargetEnemy();
            R.syncState(state);
            renderAll(true);
            checkCombatEnd();
        };
        const conclude = () => {
            state.busy = false;
            finish();
        };

        if (usedMult > 1) setTimeout(() => A.play('combo', usedMult), 60);
        state.busy = true;
        triggerCrawler(card);
        runCardEffect(card, { mult: usedMult, x: xValue, dmgMult: dmgMult, gems: true, prevPlayedId: prevPlayedId }, res => {
            hitNum = res.hits;
            anyOverkill = res.overkill;
            // Eco: repete o efeito da carta anterior do turno (como ela saiu), sem custo nem combo.
            if (D.cardHasGem(card, 'eco') && prevFx && state.enemies.some(e => e.hp > 0 || e.overkill)) {
                const p = viewportPoint(0.5, 0.44);
                spawnFloatingText(p.x, p.y, 'ECO: ' + prevFx.card.name, 'combo');
                runCardEffect(prevFx.card, { mult: prevFx.mult, x: prevFx.x, dmgMult: 1, gems: false }, echo => {
                    if (echo.overkill) anyOverkill = true;
                    conclude();
                });
                return;
            }
            conclude();
        });
        return true;
    }

    // "Útil" = o Jogar Tudo jogaria agora. Decisões do jogador ficam de fora: pickups de combate (use quando
    // quiser) e o Selo do Eclipse enquanto houver inimigo comum para apagar (apagar custa o XP/VR deles).
    // handIndex é opcional: sem ele vale o custo base da carta (sem o modificador da Confusão).
    function isUsefulCard(id, handIndex) {
        const c = cardOf(id);
        if (!c) return false;
        if (c.consumable && !c.autoPlay) return false;
        if (c.erase && !c.eraseRewards && state.enemies.some(e => e.hp > 0 && !e.isBoss && !e.elite &&
            (c.erase === 'all' || e.row === 0))) return false;
        const cost = typeof handIndex === 'number' ? getHandCost(handIndex) : D.getEffectiveCost(c, D.getXCostMod(c, state.mana));
        if (cost > state.mana || (c.xCost && state.mana < 1)) return false;
        // Lixo quebra a cadeia: o Jogar Tudo só gasta Cafeína para desarmar a Bomba de Mana.
        if (c.type === 'curse') return !!c.endTurnBomb && state.enemies.some(e => e.hp > 0);
        const hasTarget = state.enemies.some(e => e.hp > 0 || e.overkill);
        if (c.crawler) return hasTarget && !(state.crawler && state.crawler.turns > 0);
        if (c.damage > 0 || c.knockback || c.burn > 0 || c.erase || c.freezeFront > 0) return hasTarget;
        if (c.buffAmount > 0) return state.combatBuff.Amount < B.combatAmountCap;
        // Cartas de bioma sem dano direto: só quando o efeito tem o que aproveitar.
        if (c.burnTickNow) return getFrontEnemies(false).some(e => e.hp > 0 && (state.columnBurn[e.col] || 0) > 0);
        if (c.burnWorstCard) return state.hand.some(hid => D.CARDS[hid].type === 'curse');
        if (c.turnReverse || c.handDiscount > 0) return state.hand.length > 1;
        if (c.mirrorLast) return !!state.turnLastPlayedId && state.hand.length <= B.maxHandSize;
        // Pickup de cura só vale com Sanidade faltando; desconto e +Combo só com outra carta para aproveitar.
        if (c.consumable && c.heal > 0) return state.hp <= state.maxHp - c.heal;
        if (c.costDiscount > 0 || c.comboBonus > 0) return state.hand.length > 1;
        if (c.genCard) return state.hand.length <= B.maxHandSize;
        return c.vrGain > 0 || c.shield > 0 || c.heal > 0 || c.manaGain > 0 || c.buffMight > 0 || c.buffArea > 0 ||
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
        let simReverse = isReverseActive();
        // Custo X e Quebra-Combo fecham a jogada: gastam tudo (Cafeína / Combo), então ficam por último.
        const isFinisher = idx => !!cardAt(idx).xCost || D.cardHasGem(cardAt(idx), 'discharge');

        while (remaining.length > 0) {
            // O desconto das Asas do Devaneio só vale para a próxima carta a sair da mão.
            const costOf = idx => getHandCost(idx, simMana, ordered.length === 0);
            const feasible = remaining.filter(idx => costOf(idx) <= simMana && !(cardAt(idx).xCost && simMana < 1));
            if (feasible.length === 0) break;
            const early = feasible.filter(idx => !isFinisher(idx));
            const pool = early.length > 0 ? early : feasible;

            const targetCost = (simLastCost === null || simLastCost === undefined) ? 0 : simLastCost + 1;
            const fits = cost => pool.find(idx =>
                !D.isWildCard(cardAt(idx)) && cardAt(idx).type !== 'curse' && costOf(idx) === cost);
            let chosenIdx = fits(targetCost);
            // Combo Reverso na carta anterior: descer 1 também mantém a cadeia.
            if (chosenIdx === undefined && simReverse && targetCost >= 2) chosenIdx = fits(targetCost - 2);
            // Depois de um Wild a escada também segue pelo custo 1 (Wild -> 1 -> 2).
            if (chosenIdx === undefined && simLastCost === D.WILD_STEP) chosenIdx = fits(1);
            if (chosenIdx === undefined) chosenIdx = pool.find(idx => D.isWildCard(cardAt(idx)));
            if (chosenIdx === undefined) {
                chosenIdx = pool.slice().sort((a, b) => costOf(a) - costOf(b))[0];
            }

            const chosenCost = costOf(chosenIdx);
            ordered.push(chosenIdx);
            remaining.splice(remaining.indexOf(chosenIdx), 1);
            simMana = Math.max(0, simMana - chosenCost + (cardAt(chosenIdx).manaGain || 0));
            simLastCost = D.isWildCard(cardAt(chosenIdx)) ? -1 : chosenCost;
            simReverse = D.cardHasGem(cardAt(chosenIdx), 'reverse') || !!state.turnReverse || !!cardAt(chosenIdx).turnReverse;
        }
        return ordered;
    }

    function playAllCards() {
        if (state.mode !== 'combat' || state.busy || state.autoPlaying) return;
        if (!state.hand.some(isUsefulCard)) {
            // Pickups de combate e o Selo do Eclipse ficam fora do Jogar Tudo: são decisão do jogador.
            const manual = state.hand.some((id, idx) => {
                const c = cardOf(id);
                return (c.consumable || c.erase) && getHandCost(idx) <= state.mana;
            });
            setLog(manual
                ? 'O Jogar Tudo não gasta pickups nem apaga inimigos: jogue essas cartas à mão ou toque em Fim do Turno.'
                : 'Sem Cafeína para cartas úteis. Toque em Fim do Turno!');
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
            if (isPaused() || state.busy) {
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
        const keptMana = hasArcana('mente_afiada') ? Math.min(B.arcanaManaCarry, state.mana) : 0;
        state.mana = Math.max(1, state.maxMana - (state.manaDrain || 0)) + keptMana;
        const drained = state.manaDrain || 0;
        state.manaDrain = 0;
        // Elo da Corrente: o combo atravessa o turno (com teto) e a 1ª carta continua a cadeia.
        const keepCombo = hasArcana('elo_corrente') && state.comboCount > 0;
        state.comboCount = keepCombo ? Math.min(B.arcanaComboCarryCap, state.comboCount) : 0;
        state.comboCarry = keepCombo;
        state.comboReverse = false;
        state.lastComboCost = null;
        state.combo = D.getComboMult(state.comboCount);
        // O Escudo acumulado expira no início do turno do jogador (Escudo Soberbo o mantém, com teto).
        state.shield = hasArcana('escudo_soberbo') ? Math.min(B.arcanaShieldCarryCap, state.shield) : 0;
        if (state.crawler && state.crawler.turns > 0) {
            state.crawler.turns -= 1;
            if (state.crawler.turns <= 0) {
                setLog('O crachá de ' + D.getCharacter(state.crawler.charId).name + ' saiu de cena.');
                state.crawler = null;
            }
        }
        if (state.infinite) {
            // Hora Extra: a cada turno os inimigos vivos crescem e a Curse sobe.
            const g = 1 + B.infinite.turnGrowth;
            state.enemies.forEach(e => {
                if (e.hp <= 0) return;
                const extra = Math.round(e.maxHp * B.infinite.turnGrowth);
                e.maxHp += extra;
                e.hp += extra;
                e.atk = Math.round(e.atk * g);
            });
            raiseCurse(B.infinite.cursePerTurn);
        }
        state.nextCostDiscount = 0;
        state.turnLastFx = null;
        resetTurnTrackers(state);

        // Cartas com Retain permanecem na mão; as temporárias somem (mesmo com Retain); as demais vão para o descarte.
        const retainedIds = state.hand.filter((cid, idx) => cardOf(cid).retain && !isTempInHand(idx));
        state.hand.forEach((cid, idx) => {
            if (cardOf(cid).retain || isTempInHand(idx)) return;
            state.discardPile.push(cid);
            noteDiscard(cid);
        });
        // Fluxo e Combo: descartar cartas dá 50% de começar o turno já encadeado; falha garante a próxima.
        if (hasArcana('fluxo_combo') && state.hand.length > retainedIds.length) {
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
        state.handTemp = [];
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
            state.combatHurt = true;
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

        runEndTurnEffects(resolveEndTurn);
    }

    // Antes de os inimigos agirem: cartas LOOP disparam de novo e as cartas com Pós-Vida que vão ser
    // descartadas soltam os próprios efeitos (em 1x) e já seguem para o descarte.
    function runEndTurnEffects(done) {
        const queue = state.endTurnEchoes.map(echo => ({ label: 'LOOP', card: echo.card, mult: echo.mult }));
        state.endTurnEchoes = [];
        for (let idx = state.hand.length - 1; idx >= 0; idx--) {
            const card = cardOf(state.hand[idx]);
            if (card.retain || isTempInHand(idx) || card.type === 'curse') continue;
            if (card.afterlifeShot) {
                queue.push({ label: 'PÓS-VIDA', card: card, mult: 1, forceHits: 1 });
                discardFromHand(idx);
                continue;
            }
            if (!D.cardHasGem(card, 'afterlife')) continue;
            queue.push({ label: 'PÓS-VIDA', card: card, mult: 1 });
            discardFromHand(idx);
        }
        let fired = 0;
        const next = () => {
            if (state.mode !== 'combat') {
                state.busy = false;
                return;
            }
            const item = queue.shift();
            if (!item || !state.enemies.some(e => e.hp > 0)) {
                later(fired > 0 ? 220 : 0, done);
                return;
            }
            fired++;
            const p = viewportPoint(0.5, 0.44);
            spawnFloatingText(p.x, p.y, item.label + ': ' + item.card.name, 'combo');
            runCardEffect(item.card, { mult: item.mult, x: 0, dmgMult: 1, gems: false, forceHits: item.forceHits }, res => {
                if (res.overkill) triggerOverkillBanner();
                R.syncState(state);
                renderAll();
                later(280, next);
            });
        };
        next();
    }

    function resolveEndTurn() {
        // LOOP/Pós-Vida podem ter encerrado a luta (ou deixado o Chefe em OVERKILL): não há mais turno inimigo.
        state.bossOverkillActive = false;
        state.enemies.forEach(e => { e.overkill = false; });
        if (state.enemies.every(e => e.hp <= 0)) {
            finishEncounter();
            return;
        }

        // Bomba de Mana que ficou na mão explode (o Escudo absorve) e cresce para a próxima vez.
        state.hand.filter(id => D.CARDS[id].endTurnBomb).forEach(() => {
            const bombDmg = getManaBombDamage();
            state.manaBombTicks += 1;
            const absorbed = Math.min(state.shield, bombDmg);
            state.shield -= absorbed;
            state.hp = Math.max(0, state.hp - (bombDmg - absorbed));
            if (bombDmg > absorbed) state.combatHurt = true;
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
        const burnTick = tickColumnBurn();
        const burnTicked = burnTick.ticked;
        const anyBurnOverkill = burnTick.overkill;
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
            if (isPaused()) {
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
    // Ultramatança: soma o Overkill causado ao chefe desta luta.
    function noteBossOverkill(amount) {
        state.bossOverkillDmg = (state.bossOverkillDmg || 0) + Math.max(0, amount || 0);
        if (state.bossOverkillDmg >= 100) goal('ultramatanca');
    }

    function finishEncounter() {
        A.setMusic(null);
        // Intocável: chefe vencido sem perder Sanidade nesta luta.
        if (state.currentEncDef && state.enemies.some(e => e.isBoss) && !state.combatHurt) goal('intocavel');
        flushSeen();
        if (state.tutorial && state.currentEncDef) {
            if (state.currentEncDef.tutorialStep === 2) state.tutorial.combat1 = true;
            if (state.currentEncDef.tutorialStep === 3) state.tutorial.combat2 = true;
        }
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
            if (state.bossDefeated && !state.infinite && !state.tutorial && !state.signatureFloors.includes(state.floor)) {
                state.signatureFloors.push(state.floor);
                const sig = signatureCardPick(state.floor);
                if (sig) modalQueue.push(sig);
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
            if ((enc && enc.isElite) || (!enc && state.infinite && state.currentEncDef && state.currentEncDef.isElite)) grantChestLoot();

            if (state.infinite) {
                const cleared = state.infinite.wave;
                state.infinite.wave += 1;
                state.bossDefeated = false;
                setLog('ONDA ' + cleared + ' VENCIDA! A próxima Hora Extra já vem aí...');
                processModalQueue();
                scheduleNextWave(B.infinite.firstBreatherMs);
                return;
            }
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
                if ('M?EPOW'.includes(tile)) handleTileEvent(state.player.x, state.player.y, tile);
            }
            processModalQueue();
        });
    }

    // ---------- HORA EXTRA INFINITA ----------
    function buildInfiniteWave(wave) {
        const G = window.GameDungeon;
        const cfg = B.infinite;
        const pool = D.getEnemyPool(((wave - 1) % 4) + 1);
        const stats = {};
        const names = {};
        pool.common.concat(pool.boss).forEach(kind => {
            stats[kind] = { hp: D.ENEMIES[kind].hp, atk: D.ENEMIES[kind].atk };
            names[kind] = D.ENEMIES[kind].name;
        });
        if (wave % cfg.bossEvery === 0) {
            const formation = [{ kind: pool.boss, col: 2, row: 0 }, { kind: pool.common[0], col: 1, row: 0 }, { kind: pool.common[1], col: 3, row: 0 }];
            return {
                zone: 'Hora Extra', isBoss: true, formation: formation, enemies: formation.map(f => f.kind),
                intro: 'ONDA ' + wave + ' — CHEFE: ' + names[pool.boss] + ' bate o ponto de novo!'
            };
        }
        const enc = G.rollEncounter(null, {
            rng: G.createRng((state.runSeed + wave * 7919) >>> 0),
            enemyPool: pool.common, enemyStats: stats, enemyNames: names, maxEnemies: D.MAX_ENEMIES_IN_COMBAT,
            tier: Math.min(3, 1 + Math.floor(wave / 2)),
            elite: wave % cfg.eliteEvery === 0,
            eliteKind: pool.common[2]
        });
        enc.zone = 'Hora Extra';
        enc.intro = 'ONDA ' + wave + ': ' + enc.intro;
        return enc;
    }

    // A próxima onda espera a fila de modais (level ups, gemas) e a fogueira fecharem.
    function scheduleNextWave(delay) {
        later(delay, () => {
            if (!state.infinite || state.mode === 'gameover') return;
            if (state.mode !== 'explore' || state.busy || activeModal !== null || modalQueue.length > 0 || isPaused()) {
                scheduleNextWave(400);
                return;
            }
            startEncounter(null, buildInfiniteWave(state.infinite.wave));
        });
    }

    // Hora Extra: Abismo Estrelado sem chefe no mapa; a fogueira e o baú continuam lá entre as ondas.
    function setupInfiniteRun() {
        state.infinite = { wave: 1 };
        state.floor = D.FLOORS.length;
        const fl = currentFloor();
        const start = findStartPos(fl.layout);
        state.player = { x: start.x, y: start.y, dir: start.dir || 0 };
        state.encounters = [];
        state.exploredTiles = new Set();
        revealAround(state, start.x, start.y, fl.layout);
        R.buildMap(fl.layout, state);
        R.syncState(state);
        R.settleCamera();
    }

    function endGame(victory) {
        A.setMusic(null);
        // Tutorial nunca grava meta nem histórico: perder o treino só volta para a Recepção.
        if (state.tutorial) {
            finishTutorial(false);
            return;
        }
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
        // Vitória da campanha (18:00): a volta para casa ao pôr do sol.
        showArt(els.endArt, victory && !state.infinite ? D.EPILOGUE.art : null, 'epilogue');
        els.endBox.classList.toggle('sunset', !!victory);
        els.endDesc.innerHTML = '';
        const wavesSurvived = state.infinite ? state.infinite.wave - 1 : 0;
        const lines = state.infinite
            ? [state.heroName + ' aguentou ' + wavesSurvived + ' onda(s) de Hora Extra.', 'Ninguém viu. Mas o Fundo de Reserva viu.']
            : victory
                ? (hasSecretEnding() ? D.EPILOGUE.secretEndLines : D.EPILOGUE.endLines)
                : ['A Sanidade de ' + state.heroName + ' zerou em ' + currentFloor().name + '.', 'O devaneio venceu desta vez. O expediente recomeça.'];
        lines.forEach(line => {
            const p = document.createElement('p');
            p.textContent = line;
            els.endDesc.appendChild(p);
        });
        if (victory) {
            A.play('victory');
            els.endTitle.textContent = hasSecretEnding() ? D.EPILOGUE.secretEndTitle : D.EPILOGUE.endTitle + ' — PONTO BATIDO';
        } else {
            A.play('defeat');
            els.endTitle.textContent = state.infinite ? 'HORA EXTRA ENCERRADA' : 'BURNOUT...';
        }
        els.endStats.textContent =
            'Seed ' + state.runSeed + '  |  ' + (state.infinite ? 'ONDAS ' + wavesSurvived : 'FASE ' + state.floor + '/' + D.FLOORS.length) +
            '  |  LV ' + state.level + '  |  VR: ' + state.vr + '  |  Abates: ' + state.kills + '  |  Overkills: ' + state.overkills;
        // Todo VR ganho na run (Overkill de chefe incluso, mesmo o já gasto) vira crédito persistente.
        const earned = vrEarnedThisRun();
        const result = M.recordRun(meta, {
            vrEarned: earned, victory: !!victory, infinite: !!state.infinite, wave: wavesSurvived, pressure: state.pressure || 0, char: state.heroId,
            secretEnding: !!victory && hasSecretEnding(), trickster: !!state.tricksterDefeated
        });
        // Minimalista: vitória sem gastar VR na fogueira (spendVr só é usado lá).
        if (victory && !state.infinite && !(state.vrSpent > 0)) goal('minimalista');
        if (victory && (state.biomesPlayed || []).length >= 3) goal('viajante_mundos');
        const paidGoals = settleMetaGoals();
        flushSeen();
        const saved = saveMeta();
        const notes = ['+' + result.credits + ' CR no Fundo de Reserva (total ' + meta.credits + ')'];
        if (paidGoals.length > 0) notes.push(paidGoals.length + ' meta(s) concluída(s)!');
        if (result.unlockedInfinite) notes.push('HORA EXTRA INFINITA desbloqueada!');
        if (result.unlockedChar) notes.push('Novo colega: ' + D.getCharacter(result.unlockedChar).name + '!');
        if (result.newBestWave) notes.push('Recorde: ' + wavesSurvived + ' ondas!');
        if (result.pressureBonus > 0) notes.push('Pressão ' + state.pressure + ': +' + Math.round(result.pressureBonus * 100) + '% de crédito');
        if (result.unlockedPressure) notes.push('Nível de Pressão ' + result.unlockedPressure + ' liberado!');
        if (result.newSecretEnding) notes.push('FINAL SECRETO registrado!');
        if (result.newTrickster) notes.push('Segredo: o Trapaceiro foi derrotado!');
        if (!saved) notes.push('(sem armazenamento: o progresso vale só nesta aba)');
        if (els.endMeta) els.endMeta.textContent = notes.join('  ·  ');
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
        els.statFloor.textContent = state.infinite ? 'ONDA ' + state.infinite.wave : 'FASE ' + state.floor + '/' + D.FLOORS.length;
        els.statKills.textContent = String(state.kills);
        els.statVr.textContent = String(state.vr);
        els.clockTime.textContent = state.infinite ? '18:00+' : state.finalVictory ? D.FLOOR_CLOCKS.victory : (D.FLOOR_CLOCKS[state.floor] || '08:17');

        if (els.statMight) els.statMight.textContent = '+' + getStat('Might') + '%';
        if (els.statAmount) els.statAmount.textContent = '+' + getStat('Amount');
        if (els.statArea) els.statArea.textContent = '+' + getStat('Area') + '%';
        if (els.statLuck) els.statLuck.textContent = '+' + ((state.stats && state.stats.Luck) || 0) + '%';
        if (els.statGrowth) els.statGrowth.textContent = '+' + ((state.stats && state.stats.Growth) || 0) + '%';
        if (els.statExtra) {
            // Stats raros só ocupam espaço na HUD quando ativos.
            const extras = [
                ['FRZ', getStat('Freeze'), '%'], ['REC', getStat('Recovery'), ''], ['DUR', getStat('Duration'), '%'],
                ['REV', state.revival, ''], ['GRD', getStat('Greed'), '%'], ['CURSE', state.curse, '%']
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
        // Avisos primeiro (só cabem 3 selos): rachadura, desgaste e carta temporária.
        const uses = state.cardUses[card.id] || 0;
        if (state.crackedCards[card.id]) pills.push('<span class="card-kw-pill kw-crack">RACHADA</span>');
        else if (D.isBreakableCard(card) && uses >= B.crackAfterUses - 1) {
            pills.push('<span class="card-kw-pill kw-crack">USO ' + uses + '/' + B.crackAfterUses + '</span>');
        }
        if (typeof idx === 'number' && isTempInHand(idx)) pills.push('<span class="card-kw-pill kw-temp">TEMP</span>');
        if (card.consumable) pills.push('<span class="card-kw-pill kw-temp">PICKUP</span>');
        if (card.xCost) pills.push('<span class="card-kw-pill kw-wild">CUSTO X</span>');
        if (card.endTurnRepeat) pills.push('<span class="card-kw-pill kw-return">LOOP</span>');
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

    function renderCrawlerPortrait(inCombat) {
        const el = els.crawlerPortrait;
        if (!el) return;
        const cr = state.crawler;
        el.classList.toggle('hidden', !inCombat || !cr || cr.turns <= 0);
        if (!inCombat || !cr || cr.turns <= 0) return;
        const hero = D.getCharacter(cr.charId);
        el.title = D.CARDS[cr.cardId].desc.replace('{TURNS}', String(cr.turns));
        el.innerHTML = '<img src="' + S.getIconUrl(hero.icon) + '" alt="" /><span class="cp-name">' + hero.name.split(' ')[0] +
            '</span><span class="cp-turns">' + cr.turns + 't</span>';
    }

    // Prévia de mira: quem os acertos da carta atingem (padrão LeftRight/RightLeft/FrontRow/Target, com
    // prioridade em Atacantes) e o dano GARANTIDO (sem crítico, splash ou quique). Random só lista os
    // alvos possíveis; LETAL! só quando o dano garantido mata.
    function buildTargetPreview(card, handIndex) {
        if (!card || state.hand[handIndex] === undefined) return { uids: [], cols: [], dmg: {}, lethal: {}, random: false, hits: 0 };
        const costMod = getHandCostMod(handIndex);
        const willCombo = card.type !== 'curse' &&
            (state.comboCarry || D.canCardCombo(card, state.lastComboCost, costMod, isReverseActive()));
        const mult = willCombo ? state.comboCount + 2 : 1;
        const pv = getCardPreviewValues(card, mult, true, card.xCost ? getHandCost(handIndex) : undefined);
        const out = { uids: [], cols: [], dmg: {}, lethal: {}, random: card.targeting === 'Random',
            pattern: card.targeting || 'Target', priority: card.priority === 'Attacking', perHit: pv.damage, hits: Math.max(1, pv.hits) };
        const add = (e, n) => {
            if (!out.uids.includes(e.uid)) out.uids.push(e.uid);
            if (!out.cols.includes(e.col)) out.cols.push(e.col);
            out.dmg[e.uid] = (out.dmg[e.uid] || 0) + n;
        };
        const fronts = getFrontEnemies(false);
        if (fronts.length === 0) return out;
        if (out.random) {
            let pool = fronts;
            if (out.priority) {
                const attackers = fronts.filter(e => e.hasIntent);
                if (attackers.length > 0) pool = attackers;
            }
            pool.forEach(e => add(e, pool.length === 1 ? pv.damage * out.hits : 0));
        } else {
            const aim = { lastCol: null, bag: [] };
            for (let h = 0; h < out.hits; h++) {
                pickTargetsForCard(card, aim).filter(t => t.hp > 0).forEach(t => {
                    add(t, pv.damage);
                    if (!(card.pierce > 0)) return;
                    if (card.pierceType === 'MultiHit') {
                        out.dmg[t.uid] += pv.damage * card.pierce;
                        return;
                    }
                    state.enemies.filter(e => e.col === t.col && e.hp > 0 && e.row > t.row)
                        .sort((a, b) => a.row - b.row).slice(0, card.pierce).forEach(e => add(e, pv.damage));
                });
            }
        }
        out.uids.forEach(uid => {
            const e = state.enemies.find(x => x.uid === uid);
            let d = out.dmg[uid];
            if (!e || !(d > 0)) return;
            if (e.frost > 0) d += Math.ceil(pv.damage * B.freezeDamageMult) - pv.damage; // 1º golpe no gelo
            if (!card.ignoreShield) d = Math.max(0, d - e.shield);
            out.dmg[uid] = d;
            out.lethal[uid] = e.hp > 0 && !e.overkill && d >= e.hp;
        });
        return out;
    }

    // Evolução estilo Vampire Survivors: o que falta (Relíquia e/ou Nível MÁX) ou "PRONTA P/ EVOLUIR!".
    // Fusão entra quando a evolução não está pronta e as duas cartas da fusão já estão no MÁX.
    function evolutionStatus(card) {
        if (!card || card.evolved || !card.evolvesTo) return null;
        const ev = D.EVOLUTIONS.find(e => e.fromCard === card.id);
        if (!ev || state.evolvedCards[ev.toCard]) return null;
        const into = D.CARDS[ev.toCard].name;
        if (isEvolutionReady(ev)) {
            return { ready: true, label: 'PRONTA P/ EVOLUIR!', title: 'Evolui em ' + into + ' no próximo baú ou Level Up.' };
        }
        const fus = D.FUSIONS.find(f => f.cards.includes(card.id) && !state.fusedCards[f.toCard]);
        if (fus && isFusionReady(fus)) {
            return { ready: true, label: 'PRONTA P/ FUSÃO!', title: 'Funde em ' + D.CARDS[fus.toCard].name + ' no próximo Level Up.' };
        }
        const missing = [];
        if (!state.relics.includes(ev.passiveId)) missing.push(ev.title);
        if (getCardLevel(ev.fromCard) < B.maxCardLevel) missing.push('Nv.MÁX');
        return { ready: false, label: 'EVO: falta ' + missing.join(' + '),
            title: 'Evolui em ' + into + '. Falta: ' + missing.join(' e ') + ' (Relíquia "' + ev.title + '").' };
    }

    function renderCombatControls(popCombo) {
        const inCombat = state.mode === 'combat';
        renderCrawlerPortrait(inCombat);
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
            (D.isWildCard(cardOf(id)) ? 'W' : cardOf(id).xCost ? 'X' : cardOf(id).cost) + '</b></span>').join('') +
            '<span class="chain-next" title="Próximo custo que mantém o combo">' +
            (state.comboCarry ? '▸*' : hasChain ? '▸' + D.nextComboCosts(state.lastComboCost, isReverseActive()).join('/') : '▸?') + '</span>';
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
            const costMod = getHandCostMod(idx);
            const effCost = getHandCost(idx);
            // Confusão e descontos pintam o custo; o Custo X mostra "X" (o valor atual vai na descrição).
            const costShift = card.xCost ? 0 : effCost - (card.cost || 0);
            const isWild = D.isWildCard(card);
            const willCombo = card.type !== 'curse' &&
                (state.comboCarry || D.canCardCombo(card, state.lastComboCost, costMod, isReverseActive()));
            const nextMult = willCombo ? (state.comboCount + 2) : 1;
            const pv = getCardPreviewValues(card, nextMult, true);
            const desc = formatCardDesc(card, pv, willCombo ? getCardPreviewValues(card, 1, true) : null);
            const lvl = getCardLevel(card.id);
            // Início de cadeia (nenhuma carta jogada no turno): custo 0 e Wild abrem a escada.
            const starter = !willCombo && card.type !== 'curse' && !state.comboCarry &&
                (state.lastComboCost === null || state.lastComboCost === undefined) && (isWild || effCost === 0);
            const seal = willCombo ? '<span class="combo-seal">COMBO x' + nextMult + '!</span>'
                : starter ? '<span class="combo-seal start">▶ INICIA</span>' : '';
            const evo = evolutionStatus(card);

            let powerTag = '';
            if (pv.damage > 0) powerTag = pv.hits > 1 ? pv.damage + 'x' + pv.hits : String(pv.damage);
            else if (pv.shield > 0) powerTag = '+' + pv.shield;
            else if (pv.heal > 0) powerTag = '+' + pv.heal + ' HP';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card-btn ' + card.type +
                (isWild ? ' wild' : '') +
                (card.evolved ? ' evolved' : '') +
                (state.crackedCards[cardId] ? ' cracked' : '') +
                (isTempInHand(idx) ? ' temp' : '') +
                (willCombo ? ' combo-ready combo-next' : '') +
                (evo && evo.ready ? ' evo-ready' : '');
            btn.disabled = locked || state.mana < effCost || (card.xCost && effCost < 1);
            btn.innerHTML =
                '<span class="card-cost' + (costShift > 0 ? ' cost-up' : costShift < 0 ? ' cost-down' : '') + '">' +
                (card.xCost ? 'X' : effCost) + '</span>' +
                (powerTag ? '<span class="card-power-tag">' + powerTag + '</span>' : '') +
                '<div class="card-banner"><span class="card-name">' + card.name +
                (lvl >= B.maxCardLevel && card.evolvesTo && !card.evolved ? ' ★MÁX' : '') +
                '</span></div>' +
                seal +
                '<div class="card-art"><img src="' + S.getIconUrl(card.icon) + '" alt="" />' +
                (evo ? '<span class="evo-badge' + (evo.ready ? ' ready' : '') + '" title="' + evo.title + '">' + evo.label + '</span>' : '') +
                '</div>' +
                '<div class="card-textbox"><div class="card-origin">' + card.origin + '</div>' +
                buildCardKeywordsHtml(card, idx) +
                '<div class="card-desc">' + desc + '</div></div>' +
                gemSlotsHtml(cardId);
            // Prévia da mira (colunas no chão, dano previsto e LETAL!): mouse em cima, ou toque segurado no celular.
            const showPreview = () => {
                // O botão pode ser de uma mão já trocada (mouse parado antes do redesenho): só vale a carta atual.
                if (state.mode !== 'combat' || state.hand[idx] !== cardId) return;
                if (btn.disabled || !(card.damage > 0 || card.knockback || card.burn > 0)) return;
                const preview = buildTargetPreview(card, idx);
                R.setHoveredCard(Object.assign({}, card, { previewUids: preview.uids, preview: preview }));
            };
            let holdTimer = null;
            let held = false;
            btn.addEventListener('mouseenter', showPreview);
            btn.addEventListener('mouseleave', () => R.setHoveredCard(null));
            btn.addEventListener('pointerdown', ev => {
                if (ev.pointerType !== 'touch') return;
                held = false;
                holdTimer = setTimeout(() => { held = true; showPreview(); }, 320);
            });
            ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => btn.addEventListener(type, () => clearTimeout(holdTimer)));
            btn.addEventListener('contextmenu', ev => ev.preventDefault());
            btn.addEventListener('click', () => {
                // Toque segurado só mostra a prévia; o toque curto continua jogando a carta.
                if (held) {
                    held = false;
                    return;
                }
                playCard(idx);
            });
            els.handGrid.appendChild(btn);
        });
        noteHandTips();
    }

    // Dica de 1ª vez para as palavras-chave que acabaram de aparecer na mão.
    function noteHandTips() {
        state.hand.forEach(id => {
            const c = cardOf(id);
            if (c.crawler) return;
            if (c.type === 'curse') showTip('junk');
            else if (D.isWildCard(c)) showTip('wild');
            if (c.xCost) showTip('xcost');
            if (c.returnTimes) showTip('ret');
            if (c.retain && !c.consumable) showTip('retain');
            if (c.destroy && !c.consumable && !c.tempOnly && c.type !== 'curse') showTip('destroy');
        });
    }

    function renderAll(popCombo) {
        renderHud();
        renderCombatControls(popCombo);
    }

    // ---------- RECEPÇÃO (tela inicial): colegas, Fundo de Reserva e os 3 setores ----------
    let previewChar = null;   // colega bloqueado clicado (só mostra o detalhe e o botão de contratar)

    function renderBadge() {
        els.metaCredits.textContent = String(meta.credits);
        els.metaRecord.textContent = 'Runs ' + meta.stats.runs + ' · Vitórias ' + meta.stats.wins +
            (meta.infiniteUnlocked ? ' · Recorde ' + meta.stats.bestWave + ' ondas' : '');
        const shown = previewChar || meta.selectedChar;
        els.badgeSelectGrid.innerHTML = '';
        D.CHARACTERS.forEach(hero => {
            const unlocked = M.isUnlocked(meta, hero.id);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'badge-card crew-card' + (hero.id === meta.selectedChar ? ' selected' : '') +
                (!unlocked ? ' locked' : '') + (hero.id === shown ? ' shown' : '');
            btn.dataset.char = hero.id;
            btn.innerHTML =
                '<img src="' + S.getIconUrl(hero.icon) + '" alt="" />' +
                '<div class="badge-name">' + hero.name + '</div>' +
                '<div class="badge-role">' + (unlocked ? hero.role : M.CHARACTER_PRICES[hero.id] + ' CR') + '</div>';
            btn.addEventListener('click', () => {
                A.unlock();
                A.play('card');
                if (unlocked) {
                    M.selectCharacter(meta, hero.id);
                    previewChar = null;
                    saveMeta();
                } else {
                    previewChar = hero.id;
                }
                renderBadge();
            });
            els.badgeSelectGrid.appendChild(btn);
        });

        const hero = D.getCharacter(shown);
        const unlocked = M.isUnlocked(meta, hero.id);
        const price = M.CHARACTER_PRICES[hero.id];
        els.badgeDetail.innerHTML =
            '<span class="badge-code">' + hero.badgeCode + ' &middot; ' + hero.dept + '</span>' +
            '<span class="badge-desc">' + hero.desc + '</span>' +
            (unlocked ? '' : '<button type="button" id="btn-hire-char" class="hire-btn"' + (meta.credits < price ? ' disabled' : '') +
                '>CONTRATAR (' + price + ' CR) ou vença uma run</button>');
        const hire = document.getElementById('btn-hire-char');
        if (hire) {
            hire.addEventListener('click', () => {
                if (!M.unlockCharacter(meta, hero.id)) return;
                settleMetaGoals();
                M.selectCharacter(meta, hero.id);
                previewChar = null;
                saveMeta();
                A.play('levelup');
                renderBadge();
            });
        }

        renderPressure();
        els.btnInfiniteToggle.classList.toggle('hidden', !meta.infiniteUnlocked);
        els.btnInfiniteToggle.classList.toggle('on', !!meta.infiniteMode);
        els.btnInfiniteToggle.textContent = 'HORA EXTRA INFINITA: ' + (meta.infiniteMode ? 'LIGADA' : 'DESLIGADA');
        els.btnStartDaydream.textContent = meta.infiniteMode ? 'BATER PONTO DA HORA EXTRA' : 'BATER PONTO E COMEÇAR O DIA';
    }

    // Seletor de Nível de Pressão: aparece depois da 1ª vitória; cada vitória no nível N libera o N+1.
    function renderPressure() {
        const row = els.pressureRow;
        row.classList.toggle('hidden', !(meta.pressureUnlocked > 0));
        if (!(meta.pressureUnlocked > 0)) return;
        els.pressureButtons.innerHTML = '';
        D.PRESSURE_LEVELS.forEach(lv => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'pressure-btn' + (lv.level === meta.pressure ? ' active' : '');
            b.dataset.level = String(lv.level);
            b.disabled = lv.level > meta.pressureUnlocked;
            b.title = lv.name + ': ' + lv.desc;
            b.textContent = String(lv.level);
            b.addEventListener('click', () => {
                if (!M.setPressure(meta, lv.level)) return;
                A.unlock();
                A.play('card');
                saveMeta();
                renderBadge();
            });
            els.pressureButtons.appendChild(b);
        });
        const cur = D.PRESSURE_LEVELS[meta.pressure];
        els.pressureDesc.textContent = cur.level === 0 ? cur.name + ': ' + cur.desc
            : cur.name + ': ' + (cur.level === 5 ? cur.desc : cur.desc + (cur.level > 1 ? ' (acumula)' : '')) +
              ' +' + Math.round(cur.creditBonus * 100) + '% CR';
    }

    // Os 3 setores usam o mesmo modal; cada um descreve o próprio conteúdo.
    let receptionTab = null;

    function receptionTile(opts) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rc-tile' + (opts.extraClass ? ' ' + opts.extraClass : '');
        btn.disabled = !!opts.disabled;
        btn.title = opts.title || '';
        btn.innerHTML = opts.head +
            '<span class="rc-name">' + opts.name + '</span>' +
            '<span class="rc-sub">' + opts.sub + '</span>' +
            '<span class="rc-price">' + opts.price + '</span>';
        btn.addEventListener('click', () => {
            A.unlock();
            if (!opts.onPick()) return;
            settleMetaGoals();
            saveMeta();
            renderReception();
            renderBadge();
        });
        els.receptionGrid.appendChild(btn);
    }

    function forgeCards() {
        const ids = [];
        D.CHARACTERS.filter(h => M.isUnlocked(meta, h.id)).forEach(h => {
            (h.deck || D.STARTING_DECK).forEach(id => { if (!ids.includes(id)) ids.push(id); });
        });
        Object.keys(meta.forge).forEach(id => { if (!ids.includes(id)) ids.push(id); });
        return ids.filter(id => D.getCardGemSlots(D.CARDS[id]) > 0);
    }

    function renderReception() {
        els.receptionCredits.textContent = String(meta.credits);
        els.receptionGrid.innerHTML = '';
        els.receptionGrid.className = 'reception-grid tab-' + receptionTab;
        if (receptionTab === 'almox') {
            els.receptionTitle.textContent = 'ALMOXARIFADO';
            els.receptionDesc.textContent = 'PowerUps permanentes para todas as runs. Reembolso total e grátis a qualquer momento.';
            M.POWERUPS.forEach(p => {
                const rank = M.rankOf(meta, p.id);
                const cost = M.nextPowerupCost(meta, p.id);
                receptionTile({
                    head: '<img src="' + S.getIconUrl(p.icon) + '" alt="" />',
                    name: p.name,
                    sub: rank + '/' + p.max,
                    price: cost === null ? 'MÁX' : cost + ' CR',
                    title: p.desc,
                    extraClass: rank > 0 ? 'owned' : '',
                    disabled: cost === null || meta.credits < cost,
                    onPick: () => M.buyPowerup(meta, p.id)
                });
            });
            els.btnReceptionReset.textContent = 'REEMBOLSAR (' + meta.spentOnPowerups + ' CR)';
            els.btnReceptionReset.disabled = meta.spentOnPowerups === 0;
        } else if (receptionTab === 'forge') {
            const next = M.nextForgeCost(meta);
            els.receptionTitle.textContent = 'GRAFIA / ENCADERNAÇÃO';
            els.receptionDesc.textContent = 'Slots de gema permanentes (+1 por carta, ' + M.forgeUsed(meta) + '/' + M.FORGE_MAX_SLOTS +
                ' usados). Próximo: ' + (next === null ? 'esgotado' : next + ' CR') + '.';
            forgeCards().forEach(id => {
                const card = D.CARDS[id];
                const extra = meta.forge[id] || 0;
                const can = M.canForge(meta, id);
                receptionTile({
                    head: '<img src="' + S.getIconUrl(card.icon) + '" alt="" />',
                    name: card.name,
                    sub: D.getCardGemSlots(card, extra) + ' slot(s)' + (extra ? ' ★' : ''),
                    price: extra ? 'ENCADERNADA' : next === null ? '—' : next + ' CR',
                    title: card.desc.replace(/\{[A-Z]+\}/g, '?'),
                    extraClass: extra ? 'owned' : '',
                    disabled: !can || meta.credits < next,
                    onPick: () => M.forgeSlot(meta, id)
                });
            });
            els.btnReceptionReset.textContent = 'REEMBOLSAR (' + meta.spentOnForge + ' CR)';
            els.btnReceptionReset.disabled = meta.spentOnForge === 0;
        } else {
            els.receptionTitle.textContent = 'CURADORIA';
            els.receptionDesc.textContent = 'Toque para alternar: normal → favorita (2x, até ' + M.CURATION_MAX_FAVORED +
                ') → selada (nunca aparece, até ' + M.CURATION_MAX_SEALED + '). Grátis.';
            Object.keys(D.GEMS).forEach(id => {
                const gem = D.GEMS[id];
                const cur = M.gemCuration(meta, id);
                receptionTile({
                    head: '<span class="gem-slot filled" style="--gem:' + gem.color + '">' + gem.glyph + '</span>',
                    name: gem.name,
                    sub: D.GEM_RARITY_LABEL[gem.rarity],
                    price: cur === 'sealed' ? 'SELADA' : cur === 'favored' ? 'FAVORITA' : 'NORMAL',
                    title: gem.desc,
                    extraClass: 'cur-' + cur,
                    onPick: () => { M.cycleGem(meta, id); return true; }
                });
            });
            els.btnReceptionReset.textContent = 'LIMPAR CURADORIA';
            els.btnReceptionReset.disabled = meta.sealedGems.length + meta.favoredGems.length === 0;
        }
    }

    function openReception(tab) {
        if (!isTitleOpen()) return;
        A.unlock();
        A.play('chest');
        receptionTab = tab;
        renderReception();
        els.receptionModal.classList.remove('hidden');
    }

    function closeReception() {
        els.receptionModal.classList.add('hidden');
        receptionTab = null;
        renderBadge();
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
        A.setMusic(null);
        stopTutorialCoach();
        clearTips();
        if (state) flushSeen();
        meta = loadMeta();
        settleMetaGoals();
        previewChar = null;
        if (els.receptionModal) els.receptionModal.classList.add('hidden');
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
        els.receptionModal.classList.add('hidden');
        // A run nasce com o colega e a meta atuais (comprados na Recepção), na mesma seed do mapa já mostrado.
        state = createInitialState({ seed: state.runSeed });
        state.deck.forEach(id => markSeen('cards', id));
        if (meta.infiniteUnlocked && meta.infiniteMode) {
            setupInfiniteRun();
            renderAll();
            A.setAmbience(currentFloor().biome);
            enqueueModal({
                type: 'narrative',
                biome: 'abyss',
                tag: '18:01 — HORA EXTRA INFINITA',
                title: 'O relógio de ponto não deixa sair',
                lines: [
                    'O Senhor das Horas caiu, mas alguém marcou "só mais uma reunião".',
                    'Eles voltam em ondas, cada vez mais fortes. Até onde a sua build aguenta?'
                ],
                onClose: () => scheduleNextWave(B.infinite.firstBreatherMs)
            });
            enqueueModal({ type: 'arcana' });
            return;
        }
        const firstFloor = currentFloor();
        R.buildMap(firstFloor.layout, state);
        R.syncState(state);
        renderAll();
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

    // ---------- CUTSCENE "08h17 — DA PLANILHA À PRAIA" ----------
    const I = window.GameIntro;
    const intro = { scene: 0, sceneStart: 0, typed: 0, typer: null, raf: null, first: false };
    // Política de autoplay: nada de Web Audio antes do 1º gesto (a cutscene abre sozinha na 1ª visita).
    let userGestured = false;
    const markGesture = () => {
        if (userGestured) return;
        userGestured = true;
        if (introOpen) {
            A.unlock();
            applyIntroAudio(I.SCENES[intro.scene], true);
        }
    };
    window.addEventListener('pointerdown', markGesture, true);
    window.addEventListener('keydown', markGesture, true);

    function introSound(name) {
        if (userGestured) A.play(name);
    }

    // Ambiente da cena + abafamento: na Cena 3 o escritório fica distante/submerso; na 4 entra o mar.
    // immediate: rampa curta (1º gesto no meio da cena). Só roda depois do 1º gesto; o Mudo silencia tudo.
    function applyIntroAudio(sc, immediate) {
        if (!userGestured) return;
        A.setAmbience(sc.ambience);
        A.setMuffle(!!sc.muffle, immediate ? 0.3 : sc.muffle ? 2.2 : 1.2);
    }

    let introSfxTimers = [];

    function clearIntroSfx() {
        introSfxTimers.forEach(clearTimeout);
        introSfxTimers = [];
    }
    function openIntro(first) {
        introOpen = true;
        intro.first = !!first;
        els.introOverlay.classList.remove('hidden');
        els.introActions.classList.remove('hidden');
        els.introChoice.classList.add('hidden');
        // Na reprise, "Ir Direto" só volta para a Recepção (a run começa pelo botão de lá).
        els.btnIntroDirect.textContent = intro.first ? 'IR DIRETO PARA O EXPEDIENTE' : 'VOLTAR À RECEPÇÃO';
        I.preload();
        showIntroScene(0);
        const frame = now => {
            if (!introOpen) return;
            I.drawParticles(els.introParticles, intro.scene, (now - intro.sceneStart) / 1000);
            intro.raf = requestAnimationFrame(frame);
        };
        intro.raf = requestAnimationFrame(frame);
    }

    function showIntroScene(i) {
        const sc = I.SCENES[i];
        intro.scene = i;
        intro.sceneStart = performance.now();
        intro.typed = 0;
        els.introTag.textContent = sc.tag;
        els.introStep.textContent = (i + 1) + '/' + I.SCENES.length;
        els.introTitle.textContent = sc.title;
        els.introText.textContent = '';
        els.btnIntroNext.textContent = i === I.SCENES.length - 1 ? 'CONCLUIR ▸' : 'AVANÇAR ▸';
        showIntroArt(i, sc);
        applyIntroAudio(sc, false);
        clearIntroSfx();
        sc.sfx.forEach(fx => {
            introSfxTimers.push(setTimeout(() => {
                if (introOpen && intro.scene === i) introSound(fx.name);
            }, fx.at));
        });
        if (intro.typer) clearInterval(intro.typer);
        // Digitação suave; um "tec" de teclado a cada 3 letras (silencioso com o Mudo ligado).
        intro.typer = setInterval(() => {
            intro.typed += 1;
            els.introText.textContent = sc.text.slice(0, intro.typed);
            if (intro.typed % 3 === 0) introSound('type');
            if (intro.typed >= sc.text.length) {
                clearInterval(intro.typer);
                intro.typer = null;
            }
        }, 24);
    }

    // Troca a ilustração e reinicia as animações CSS da cena. Imagem que falha não trava nada:
    // o palco mostra o degradê de reserva da cena e a cutscene segue.
    function showIntroArt(i, sc) {
        const stage = els.introStage;
        stage.className = 'intro-stage';
        void stage.offsetWidth;
        stage.className = 'intro-stage scene-' + (i + 1) + ' ' + sc.anim;
        if (I.getStatus()[i] === 'failed') stage.classList.add('img-failed');
        els.introImg.onerror = () => { if (intro.scene === i) stage.classList.add('img-failed'); };
        els.introImg.onload = () => { if (intro.scene === i) stage.classList.remove('img-failed'); };
        els.introImg.src = sc.image;
        els.introImg.dataset.scene = String(i + 1);
        const bubble = els.introBubble;
        bubble.classList.toggle('hidden', !sc.bubble);
        bubble.textContent = sc.bubble || '';
        I.drawParticles(els.introParticles, i, 0);
    }

    function introTypingDone() {
        return intro.typed >= I.SCENES[intro.scene].text.length;
    }

    // 1º clique completa o texto; o seguinte passa de cena; depois da última, as opções finais.
    function introNext() {
        if (!introOpen) return;
        introSound('card');
        if (!introTypingDone()) {
            if (intro.typer) clearInterval(intro.typer);
            intro.typer = null;
            intro.typed = I.SCENES[intro.scene].text.length;
            els.introText.textContent = I.SCENES[intro.scene].text;
            return;
        }
        if (intro.scene < I.SCENES.length - 1) showIntroScene(intro.scene + 1);
        else showIntroChoice();
    }

    function skipIntro() {
        if (!introOpen) return;
        introSound('card');
        if (intro.scene !== I.SCENES.length - 1) showIntroScene(I.SCENES.length - 1);
        if (intro.typer) clearInterval(intro.typer);
        intro.typer = null;
        intro.typed = I.SCENES[intro.scene].text.length;
        els.introText.textContent = I.SCENES[intro.scene].text;
        showIntroChoice();
    }

    function showIntroChoice() {
        els.introActions.classList.add('hidden');
        els.introChoice.classList.remove('hidden');
        ui.introSeen = true;
        saveUi();
    }

    function closeIntro() {
        introOpen = false;
        if (intro.typer) clearInterval(intro.typer);
        intro.typer = null;
        if (intro.raf) cancelAnimationFrame(intro.raf);
        intro.raf = null;
        clearIntroSfx();
        els.introOverlay.classList.add('hidden');
        if (userGestured) {
            A.setMuffle(false, 0.05);
            A.stopAmbience();
        }
        ui.introSeen = true;
        saveUi();
    }

    // ---------- COLEÇÃO & METAS (Recepção) ----------
    const COLLECTION_TABS = [
        { id: 'metas', label: 'Metas' },
        { id: 'cartas', label: 'Cartas' },
        { id: 'gemas', label: 'Gemas & Arcanas' },
        { id: 'bestiario', label: 'Bestiário' }
    ];
    let collectionOpen = false;

    // Dica curta de onde encontrar cada coisa ainda não descoberta.
    function cardHint(card) {
        if (card.biome && !card.evolved) {
            const b = D.BIOMES[card.biome];
            const boss = Object.values(D.ENEMIES).find(e => e.isBoss && e.floor === card.biome);
            return card.signature && card.biome < D.FLOORS.length
                ? 'Assinatura: derrote ' + (boss ? boss.name : 'o Chefe') + ' (' + b.name + ').'
                : 'Exclusiva da ' + b.name + ' (Fase ' + b.id + '): Level Up e Baús.';
        }
        const ev = D.EVOLUTIONS.find(e => e.toCard === card.id);
        if (ev) return 'Evolua ' + D.CARDS[ev.fromCard].name + ' com ' + ev.title + '.';
        const fus = D.FUSIONS.find(f => f.toCard === card.id);
        if (fus) return 'Funda ' + fus.cards.map(id => D.CARDS[id].name).join(' + ') + ' no Nível MÁX.';
        if (card.consumable) return 'Às vezes vem nos baús.';
        if (card.crawler) return 'Crachá de ' + D.getCharacter(card.crawler).name + '.';
        if (card.type === 'curse') return 'Chefes enfiam no seu baralho.';
        if (card.tempOnly) return 'Gerada pela Canção da Cafeteira.';
        return 'Level Up e recompensas.';
    }

    function enemyHint(e) {
        if (e.secret) return 'Segredo: dizem que aparece quando cartas demais se quebram.';
        if (e.isBoss) return 'Chefe da Fase ' + e.floor + '.';
        return 'Aparece na Fase ' + e.floor + '.';
    }

    function collectionTile(seen, icon, name, sub, extra) {
        return '<div class="col-tile' + (seen ? '' : ' locked') + (extra || '') + '">' +
            '<img src="' + S.getIconUrl(icon) + '" alt="" />' +
            '<b>' + (seen ? name : '???') + '</b><small>' + sub + '</small></div>';
    }

    function collectionCounts() {
        const total = Object.keys(D.CARDS).length + Object.keys(D.GEMS).length + Object.keys(D.ARCANAS).length + Object.keys(D.ENEMIES).length;
        const seen = M.SEEN_KINDS.reduce((n, k) => n + meta.seen[k].length, 0);
        return { goals: Object.keys(meta.goals).length, goalsTotal: M.GOALS.length, seen: seen, total: total };
    }

    function renderCollectionTab(id) {
        const box = els.collectionContent;
        Array.from(els.collectionTabs.children).forEach(b => b.classList.toggle('active', b.dataset.tab === id));
        box.dataset.tab = id;
        const seen = meta.seen;
        let html = '';
        if (id === 'metas') {
            html = M.GOALS.map(g => {
                const done = !!meta.goals[g.id];
                return '<div class="col-tile goal' + (done ? ' done' : '') + '" data-goal="' + g.id + '">' +
                    '<img src="' + S.getIconUrl(g.icon) + '" alt="" />' +
                    '<b>' + g.name + '</b><small>' + g.desc + '</small>' +
                    '<em>' + (done ? '✔ CARIMBADA' : '+' + g.reward + ' CR') + '</em></div>';
            }).join('');
        } else if (id === 'cartas') {
            renderCardBestiary(box, 'todas');
            box.scrollTop = 0;
            return;
        } else if (id === 'gemas') {
            html = '<h4>Gemas</h4>' + Object.keys(D.GEMS).map(gid => {
                const g = D.GEMS[gid];
                const ok = seen.gems.includes(gid);
                return '<div class="col-tile' + (ok ? '' : ' locked') + '"><span class="gem-slot filled" style="--gem:' + (ok ? g.color : '#3b3348') + '">' +
                    (ok ? g.glyph : '?') + '</span><b>' + (ok ? g.name : '???') + '</b><small>' +
                    (ok ? D.GEM_RARITY_LABEL[g.rarity] : 'Gema ' + D.GEM_RARITY_LABEL[g.rarity] + ': baús, Level Up e Fogueira.') + '</small></div>';
            }).join('') + '<h4>Arcanas</h4>' + Object.keys(D.ARCANAS).map(aid => {
                const a = D.ARCANAS[aid];
                const ok = seen.arcanas.includes(aid);
                return collectionTile(ok, a.icon, a.name, ok ? a.desc : 'Início da run, Poço dos Desejos ou Baú de Prata.');
            }).join('');
        } else {
            const kinds = Object.keys(D.ENEMIES);
            const tile = k => {
                const e = D.ENEMIES[k];
                const ok = seen.enemies.includes(k);
                return collectionTile(ok, e.sprite || k, e.name, ok ? e.origin : enemyHint(e), e.isBoss ? ' boss' : e.secret ? ' secret' : '');
            };
            html = '<h4>Chefes</h4>' + kinds.filter(k => D.ENEMIES[k].isBoss).map(tile).join('') +
                '<h4>Inimigos</h4>' + kinds.filter(k => !D.ENEMIES[k].isBoss && !D.ENEMIES[k].secret).map(tile).join('') +
                '<h4>Segredos</h4>' + kinds.filter(k => D.ENEMIES[k].secret).map(tile).join('');
        }
        box.innerHTML = '<div class="col-grid">' + html + '</div>';
        box.scrollTop = 0;
    }

    function openCollection(tab) {
        A.unlock();
        A.play('card');
        const c = collectionCounts();
        els.collectionProgress.textContent = 'Metas ' + c.goals + '/' + c.goalsTotal + ' · Coleção ' + c.seen + '/' + c.total;
        els.collectionTabs.innerHTML = '';
        COLLECTION_TABS.forEach(t => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'codex-tab';
            b.dataset.tab = t.id;
            b.textContent = t.label;
            b.addEventListener('click', () => { A.play('card'); renderCollectionTab(t.id); });
            els.collectionTabs.appendChild(b);
        });
        collectionOpen = true;
        els.collectionModal.classList.remove('hidden');
        renderCollectionTab(tab || 'metas');
    }

    function closeCollection() {
        collectionOpen = false;
        els.collectionModal.classList.add('hidden');
    }

    // Bestiário de Cartas: filtros por origem, silhuetas ??? com dica e ficha ao tocar numa carta descoberta.
    const CARD_FILTERS = [
        { id: 'todas', label: 'Todas', test: () => true },
        { id: 'base', label: 'Base', test: c => !c.biome && !c.evolved },
        { id: 'praia', label: 'Praia', test: c => c.biome === 1 && !c.evolved },
        { id: 'cidade', label: 'Cidade', test: c => c.biome === 2 && !c.evolved },
        { id: 'neve', label: 'Neve', test: c => c.biome === 3 && !c.evolved },
        { id: 'dungeon', label: 'Dungeon', test: c => c.biome === 4 && !c.evolved },
        { id: 'abismo', label: 'Abismo', test: c => c.biome === 5 && !c.evolved },
        { id: 'evolucoes', label: 'Evoluções', test: c => !!c.evolved }
    ];

    function renderCardBestiary(box, filterId) {
        const filter = CARD_FILTERS.find(f => f.id === filterId) || CARD_FILTERS[0];
        const seenCards = meta.seen.cards;
        const ids = Object.keys(D.CARDS).filter(cid => filter.test(D.CARDS[cid]));
        const found = ids.filter(cid => seenCards.includes(cid)).length;
        const chips = CARD_FILTERS.map(f => '<button type="button" class="bf-chip' + (f.id === filter.id ? ' active' : '') + '" data-filter="' + f.id + '">' +
            f.label + '</button>').join('');
        const tiles = ids.map(cid => {
            const c = D.CARDS[cid];
            const ok = seenCards.includes(cid);
            const sub = ok ? (c.evolved ? (c.fused ? 'Fusão' : 'Evolução') : (c.biome ? D.BIOMES[c.biome].label + ' · ' : '') + 'Custo ' + (c.xCost ? 'X' : c.cost)) : cardHint(c);
            return '<button type="button" class="col-tile card-tile' + (ok ? '' : ' locked') + '" data-card="' + cid + '"' + (ok ? '' : ' disabled') +
                (c.biome ? ' style="--seal:' + D.BIOMES[c.biome].color + '"' : '') + '>' +
                '<img src="' + S.getIconUrl(c.icon) + '" alt="" /><b>' + (ok ? c.name : '???') + '</b><small>' + sub + '</small></button>';
        }).join('');
        box.innerHTML = '<div class="bestiary-filters" role="group" aria-label="Filtrar cartas">' + chips + '</div>' +
            '<div class="bestiary-count">' + found + '/' + ids.length + ' descobertas</div>' +
            '<div class="col-grid">' + tiles + '</div>';
        box.dataset.filter = filter.id;
        box.querySelectorAll('.bf-chip').forEach(b => b.addEventListener('click', () => {
            A.play('card');
            renderCardBestiary(box, b.dataset.filter);
            box.scrollTop = 0;
        }));
        box.querySelectorAll('.card-tile:not(.locked)').forEach(b => b.addEventListener('click', () => {
            A.play('card');
            box.innerHTML = '<button type="button" class="bevel-btn sheet-back">← VOLTAR</button>' + cardSheetHtml(b.dataset.card);
            box.dataset.sheet = b.dataset.card;
            box.scrollTop = 0;
            box.querySelector('.sheet-back').addEventListener('click', () => {
                A.play('card');
                delete box.dataset.sheet;
                renderCardBestiary(box, filter.id);
            });
        }));
        delete box.dataset.sheet;
    }

    // ---------- BACKUP DO SAVE ----------
    let backupOpen = false;
    let pendingImport = null;

    function backupMessage(text, kind) {
        els.backupStatus.textContent = text;
        els.backupStatus.className = 'backup-status ' + (kind || '');
    }

    function openBackup() {
        A.unlock();
        A.play('card');
        backupOpen = true;
        pendingImport = null;
        els.backupText.value = '';
        els.btnBackupConfirm.classList.add('hidden');
        backupMessage('Exporte para guardar seu progresso ou cole um código para importar.', '');
        els.backupModal.classList.remove('hidden');
    }

    function closeBackup() {
        backupOpen = false;
        pendingImport = null;
        els.backupModal.classList.add('hidden');
    }

    function exportBackup() {
        flushSeen();
        const code = M.encodeBackup(meta, ui);
        els.backupText.value = code;
        els.backupText.select();
        pendingImport = null;
        els.btnBackupConfirm.classList.add('hidden');
        const done = ok => backupMessage(ok ? 'Código copiado! Guarde-o num lugar seguro.' : 'Código gerado: selecione e copie (Ctrl+C).', 'ok');
        try {
            navigator.clipboard.writeText(code).then(() => done(true), () => done(false));
        } catch (err) {
            done(false);
        }
        return code;
    }

    // 1º passo: só valida e mostra o que tem no backup. Nada muda até "Substituir save atual".
    function validateImport() {
        const res = M.decodeBackup(els.backupText.value, {
            gemIds: Object.keys(D.GEMS), cardIds: Object.keys(D.CARDS), charIds: D.CHARACTERS.map(c => c.id),
            arcanaIds: Object.keys(D.ARCANAS), enemyIds: Object.keys(D.ENEMIES)
        });
        els.btnBackupConfirm.classList.toggle('hidden', !res.ok);
        if (!res.ok) {
            pendingImport = null;
            backupMessage(res.error + ' Seu save atual não foi alterado.', 'error');
            A.play('immune');
            return res;
        }
        pendingImport = res;
        backupMessage('Backup válido: ' + res.meta.credits + ' CR, ' + Object.keys(res.meta.goals).length + ' meta(s), ' +
            res.meta.stats.wins + ' vitória(s). Confirme para SUBSTITUIR o save atual.', 'ok');
        return res;
    }

    function applyImport() {
        if (!pendingImport) return false;
        const st = metaStorage();
        if (!M.save(st, pendingImport.meta)) {
            backupMessage('Não foi possível gravar (armazenamento bloqueado). Nada foi alterado.', 'error');
            return false;
        }
        ui = sanitizeUi(pendingImport.ui);
        saveUi();
        meta = loadMeta();
        pendingImport = null;
        els.btnBackupConfirm.classList.add('hidden');
        backupMessage('Save importado com sucesso!', 'ok');
        A.play('levelup');
        renderBadge();
        return true;
    }

    // ---------- MANUAL DO EXPEDIENTE (Códice "?") ----------
    let codexTabs = null;

    function openCodex(tabIndex) {
        if (introOpen) return;
        A.unlock();
        A.play('card');
        if (!codexTabs) codexTabs = window.GameCodex.build(D, M);
        els.codexTabs.innerHTML = '';
        codexTabs.forEach((tab, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'codex-tab';
            btn.dataset.tab = tab.id;
            btn.setAttribute('role', 'tab');
            btn.title = tab.title;
            btn.textContent = tab.label;
            btn.addEventListener('click', () => {
                A.play('card');
                selectCodexTab(i);
            });
            els.codexTabs.appendChild(btn);
        });
        codexOpen = true;
        R.setHoveredCard(null);
        els.codexModal.classList.remove('hidden');
        selectCodexTab(tabIndex || 0);
    }

    function selectCodexTab(i) {
        const tab = codexTabs[i];
        Array.from(els.codexTabs.children).forEach((b, j) => {
            b.classList.toggle('active', j === i);
            b.setAttribute('aria-selected', j === i ? 'true' : 'false');
        });
        els.codexContent.dataset.tab = tab.id;
        if (tab.id === 'cartas') {
            // Bestiário interativo: o mesmo da Coleção (filtros + ficha), acessível no meio da run.
            const wrap = document.createElement('div');
            els.codexContent.innerHTML = '<h3>' + tab.title + '</h3>';
            els.codexContent.appendChild(wrap);
            renderCardBestiary(wrap, 'todas');
            els.codexContent.scrollTop = 0;
            return;
        }
        els.codexContent.innerHTML = '<h3>' + tab.title + '</h3>' + tab.html;
        els.codexContent.scrollTop = 0;
    }

    function closeCodex() {
        codexOpen = false;
        els.codexModal.classList.add('hidden');
    }

    // ---------- DICAS DE 1ª VEZ (toast que não bloqueia nada nem entra na fila de modais) ----------
    const tipQueue = [];
    let tipTimer = null;

    function showTip(id) {
        if (!id || !state || state.tutorial || !D.FIRST_TIME_TIPS[id] || ui.tips.includes(id)) return;
        ui.tips.push(id);
        saveUi();
        tipQueue.push(id);
        if (!tipTimer) nextTip();
    }

    function nextTip() {
        const id = tipQueue.shift();
        if (!id) {
            els.tipCard.classList.add('hidden');
            tipTimer = null;
            return;
        }
        const tip = D.FIRST_TIME_TIPS[id];
        els.tipCard.dataset.tip = id;
        els.tipTitle.textContent = tip.title;
        els.tipText.textContent = tip.text;
        els.tipCard.classList.remove('hidden');
        tipTimer = setTimeout(nextTip, 6500);
    }

    function clearTips() {
        tipQueue.length = 0;
        if (tipTimer) clearTimeout(tipTimer);
        tipTimer = null;
        els.tipCard.classList.add('hidden');
    }

    // ---------- TUTORIAL GUIADO (mini-praia roteirizada, fora do save) ----------
    let coachTimer = null;
    let spotted = [];

    function startTutorial() {
        if (introOpen) closeIntro();
        closeCodex();
        els.titleModal.classList.add('hidden');
        els.receptionModal.classList.add('hidden');
        resetModalSystem();
        clearTips();
        state = createInitialState({ seed: state.runSeed });
        state.tutorial = { combat1: false, combat2: false, chest: false, done: false };
        state.pressure = 0;
        state.deck = D.TUTORIAL_DECK.slice();
        state.floors[1] = D.TUTORIAL_FLOOR;
        const fl = currentFloor();
        const start = findStartPos(fl.layout);
        state.player = { x: start.x, y: start.y, dir: start.dir || 0 };
        state.encounters = buildEncounters(fl);
        state.exploredTiles = new Set();
        revealAround(state, start.x, start.y, fl.layout);
        R.buildMap(fl.layout, state);
        R.syncState(state);
        R.settleCamera();
        renderAll();
        A.unlock();
        A.setAmbience('beach');
        els.tutorialCoach.classList.remove('hidden');
        if (coachTimer) clearInterval(coachTimer);
        coachTimer = setInterval(updateTutorial, 200);
        enqueueModal({
            type: 'narrative',
            biome: 'beach',
            tag: 'TUTORIAL GUIADO · 4 PASSOS',
            title: 'Treinamento na Praia',
            lines: [
                'Uma praia de treino, sem chefe e sem risco para o seu progresso.',
                'Siga o cartão azul no topo: o elemento que você precisa usar fica com a borda dourada pulsando.'
            ],
            button: 'COMEÇAR O TREINO'
        });
        updateTutorial();
    }

    function tutorialDoneCard() {
        return {
            type: 'narrative',
            biome: 'beach',
            tag: 'TUTORIAL CONCLUÍDO',
            title: 'Pronto para bater o ponto',
            lines: [
                'Exploração, combo, defesa, Level Up, gemas e Arcanas: está tudo no Manual (botão ?) para consultar quando quiser.',
                'Agora é o expediente de verdade. Boa sorte, Valter.'
            ],
            button: 'VOLTAR À RECEPÇÃO',
            onClose: () => finishTutorial(true)
        };
    }

    function stopTutorialCoach() {
        if (coachTimer) clearInterval(coachTimer);
        coachTimer = null;
        setSpots([]);
        if (els.tutorialCoach) els.tutorialCoach.classList.add('hidden');
    }

    function finishTutorial(completed) {
        stopTutorialCoach();
        if (completed) {
            ui.tutorialDone = true;
            saveUi();
            goal('estagiario');
        }
        openTitleModal();
    }

    function setSpots(list) {
        const next = list.filter(Boolean);
        spotted.forEach(el => { if (!next.includes(el)) el.classList.remove('tut-spot'); });
        next.forEach(el => el.classList.add('tut-spot'));
        spotted = next;
    }

    function tutorialStage() {
        const t = state.tutorial;
        const m = activeModal && activeModal.type;
        if (m === 'narrative') return 'narrative';
        if (m === 'levelup' || m === 'gem' || m === 'arcana') return m;
        if (m) return 'wait';
        if (state.mode === 'combat') return state.currentEncDef && state.currentEncDef.tutorialStep === 2 ? 'combo' : 'defense';
        if (!t.combat1) return 'explore1';
        if (!t.combat2) return 'explore2';
        if (state.pendingLevelUps > 0 || modalQueue.length > 0) return 'wait';
        if (!t.chest) return 'chest';
        return 'wait';
    }

    // Passo atual: texto do cartão + elementos com spotlight. Nunca trava o jogador: tudo continua clicável.
    function tutorialGuide(stage) {
        const handBtn = pred => {
            const idx = state.hand.findIndex((id, i) => pred(cardOf(id), i));
            return idx >= 0 ? els.handGrid.children[idx] : null;
        };
        const plain = (c, i) => c.type !== 'curse' && !D.isWildCard(c);
        const move = [els.btnMoveFwd, els.miniCanvas];
        if (stage === 'narrative') return { step: 0, title: 'Leia e continue', text: 'Toque no botão destacado para seguir.', spots: [els.btnNarrativeContinue] };
        if (stage === 'explore1') {
            return { step: 1, title: 'Exploração & Aggro', spots: move,
                text: 'Ande com ↑/W ou o botão destacado (Q/E andam de lado, A/D giram). O minimapa mostra o que você já viu. ' +
                    'Um inimigo a até 2 casas na sua linha de visão inicia o combate: avance até o Boneco de Treino.' };
        }
        if (stage === 'combo') {
            const zero = handBtn((c, i) => plain(c) && getHandCost(i) === 0);
            const one = handBtn((c, i) => plain(c) && getHandCost(i) === 1);
            if (state.lastComboCost === null && zero) {
                return { step: 2, title: '5 Colunas & Combo +1', spots: [zero],
                    text: 'Os inimigos ocupam 5 colunas; só a linha de frente ataca e apanha. Comece pela carta de custo 0 destacada: ela abre a escada de combo.' };
            }
            if (state.lastComboCost === 0 && one) {
                return { step: 2, title: 'Escada 0 → 1', spots: [one],
                    text: 'Agora a carta de custo 1: 0 → 1 continua a escada e o Combo sobe para x2 (o número na chama).' };
            }
            const playAll = !els.btnPlayAll.disabled;
            return { step: 2, title: 'Mini-pilha & Jogar Tudo', spots: [els.comboChain, playAll ? els.btnPlayAll : els.btnEndTurn],
                text: 'A mini-pilha à direita guarda a cadeia do turno e mostra o próximo custo (▸). ' +
                    (playAll ? 'JOGAR TUDO joga o resto na melhor ordem de combo.' : 'Sem cartas úteis: toque em FIM DO TURNO.') };
        }
        if (stage === 'defense') {
            const has = id => handBtn(c => c.id === id);
            const advanced = state.enemies.some(e => e.kind === 'specter' && e.row === 0 && e.hp > 0);
            if (has('escudo_burocratico')) {
                return { step: 3, title: 'Escudo & Knockback', spots: [has('escudo_burocratico')],
                    text: 'Os dois da frente mostram ATK: vão atacar no fim do turno. A Égide dá Escudo (absorve dano) e 65% de KNOCKBACK: o inimigo DESARMADO perde o ataque.' };
            }
            if (has('lanca_geada')) {
                return { step: 3, title: 'Freeze (Gelo)', spots: [has('lanca_geada')],
                    text: 'A Lança de Geada aplica GELO: congelado não ataca, e o próximo golpe nele causa 1.5x.' };
            }
            if (has('chicote_dados') && state.mana >= 2 && !advanced) {
                return { step: 3, title: 'Frente & Retaguarda', spots: [has('chicote_dados')],
                    text: 'O Chicote acerta toda a linha de frente. Derrube o Caranguejo e veja a RETAGUARDA avançar para a frente na mesma coluna.' };
            }
            const playAll = !els.btnPlayAll.disabled;
            return { step: 3, title: advanced ? 'A retaguarda avançou!' : 'Termine a luta', spots: [playAll ? els.btnPlayAll : els.btnEndTurn],
                text: (advanced ? 'Morto o da frente, quem estava atrás assumiu a coluna e agora pode atacar. ' : '') +
                    (playAll ? 'Use JOGAR TUDO para gastar o resto da mão.' : 'Toque em FIM DO TURNO: os inimigos agem e você compra uma mão nova.') };
        }
        if (stage === 'explore2') {
            return { step: 3, title: 'Próximo grupo', spots: move,
                text: 'Vá até o grupo no canto de cima, à esquerda (siga o minimapa). Ao chegar a 2 casas na linha de visão, o combate começa.' };
        }
        if (stage === 'levelup') {
            return { step: 4, title: 'Level Up', spots: [els.btnLvlReroll, els.btnLvlSkip, els.btnLvlBanish],
                text: 'Escolha 1 melhoria. RE-ROLAR troca as opções, PULAR dá +20% do XP do nível e BANIR tira uma opção desta run.' };
        }
        if (stage === 'chest') {
            return { step: 4, title: 'Baú & Gemas', spots: move, text: 'Abra o baú dourado no canto de cima, à direita: baús dão Sanidade, VR, XP e uma gema.' };
        }
        if (stage === 'gem') {
            return { step: 4, title: 'Encaixe a gema', spots: [els.gemTargets.querySelector('.gem-target-card:not([disabled])')],
                text: 'Cada carta tem slots (losangos). Toque numa carta destacada para encaixar a gema: o bônus vale até o fim da run.' };
        }
        if (stage === 'arcana') {
            return { step: 4, title: 'Arcana', spots: [els.arcanaChoices],
                text: 'Arcanas (Estados de Espírito) mudam as regras da run inteira. Escolha uma para fechar o treino.' };
        }
        return null;
    }

    function updateTutorial() {
        if (!state || !state.tutorial) {
            stopTutorialCoach();
            return;
        }
        // Com o Manual aberto, o cartão do tutorial sai da frente (o Manual tem prioridade na tela).
        els.tutorialCoach.classList.toggle('hidden', codexOpen);
        const guide = tutorialGuide(tutorialStage());
        if (!guide) {
            setSpots([]);
            return;
        }
        els.coachStep.textContent = guide.step > 0 ? 'PASSO ' + guide.step + '/4' : 'TUTORIAL';
        els.coachTitle.textContent = guide.title;
        els.coachText.textContent = guide.text;
        els.tutorialCoach.dataset.stage = tutorialStage();
        setSpots(guide.spots);
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
    els.btnCodex.addEventListener('click', () => openCodex(0));
    els.btnTitleCodex.addEventListener('click', () => openCodex(0));
    els.btnCodexClose.addEventListener('click', closeCodex);
    els.btnOpenCollection.addEventListener('click', () => openCollection('metas'));
    els.btnCollectionClose.addEventListener('click', closeCollection);
    els.btnOpenBackup.addEventListener('click', openBackup);
    els.btnBackupClose.addEventListener('click', closeBackup);
    els.btnBackupExport.addEventListener('click', exportBackup);
    els.btnBackupImport.addEventListener('click', validateImport);
    els.btnBackupConfirm.addEventListener('click', applyImport);
    els.btnReplayIntro.addEventListener('click', () => { A.unlock(); openIntro(false); });
    els.btnOpenTutorial.addEventListener('click', () => { A.unlock(); A.play('levelup'); startTutorial(); });
    els.btnTutorialExit.addEventListener('click', () => { A.play('card'); finishTutorial(false); });
    els.btnIntroNext.addEventListener('click', introNext);
    els.btnIntroSkip.addEventListener('click', skipIntro);
    els.btnIntroTutorial.addEventListener('click', () => { closeIntro(); A.play('levelup'); startTutorial(); });
    els.btnIntroDirect.addEventListener('click', () => {
        const first = intro.first;
        closeIntro();
        if (first) confirmStartDaydream();
    });
    els.btnOpenAlmox.addEventListener('click', () => openReception('almox'));
    els.btnOpenForge.addEventListener('click', () => openReception('forge'));
    els.btnOpenCuration.addEventListener('click', () => openReception('curation'));
    els.btnReceptionClose.addEventListener('click', closeReception);
    els.btnReceptionReset.addEventListener('click', () => {
        A.unlock();
        if (receptionTab === 'almox') M.refundPowerups(meta);
        else if (receptionTab === 'forge') M.refundForge(meta);
        else {
            meta.sealedGems = [];
            meta.favoredGems = [];
        }
        A.play('card');
        saveMeta();
        renderReception();
        renderBadge();
    });
    els.btnInfiniteToggle.addEventListener('click', () => {
        if (!meta.infiniteUnlocked) return;
        A.unlock();
        A.play('card');
        meta.infiniteMode = !meta.infiniteMode;
        saveMeta();
        renderBadge();
    });

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
        if (activeModal.type === 'pick') {
            A.play('card');
            closeActiveModal(item => { if (item.onDecline) item.onDecline(); });
            return;
        }
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

    els.btnDiscoveryOk.addEventListener('click', guardModalAction(() => {
        if (activeModal.type !== 'discovery') {
            modalActionLocked = false;
            return;
        }
        A.play('card');
        els.btnDiscoveryOk.disabled = true;
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
        if (introOpen) {
            if (ev.key === 'Escape') {
                ev.preventDefault();
                skipIntro();
            } else if ((ev.key === 'Enter' || ev.key === ' ' || ev.key === 'ArrowRight') && !els.introActions.classList.contains('hidden')) {
                ev.preventDefault();
                introNext();
            }
            return;
        }
        if (codexOpen || collectionOpen || backupOpen) {
            if (ev.key === 'Escape') {
                ev.preventDefault();
                if (codexOpen) closeCodex();
                else if (collectionOpen) closeCollection();
                else closeBackup();
            }
            return;
        }
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
        if (receptionTab && ev.key === 'Escape') {
            closeReception();
            return;
        }
        if (isTitleOpen() || !state || state.mode === 'gameover') return;

        if (activeModal !== null) {
            if (activeModal.type === 'discovery' && (ev.key === 'Enter' || ev.key === 'Escape' || ev.key === ' ')) {
                ev.preventDefault();
                els.btnDiscoveryOk.click();
                return;
            }
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
        setArcana: setArcana,
        addArcana: addArcana,
        grantPickup: grantPickup,
        randomGemId: randomGemId,
        gainXp: gainXp,
        get meta() { return meta; },
        get ui() { return ui; },
        goal: goal,
        openCollection: openCollection,
        detectNewCards: detectNewCards,
        get modalQueue() { return modalQueue.map(m => m.type); },
        get activeModalType() { return activeModal ? activeModal.type : null; },
        loadFloor: loadFloor,
        grantChestLoot: grantChestLoot,
        finishEncounter: finishEncounter,
        enqueueModal: enqueueModal,
        biomeCardPick: biomeCardPick,
        cardSheetHtml: cardSheetHtml,
        getHandCost: getHandCost,
        levelUpPoolIds: () => getEligibleLevelUpPool().map(rw => rw.id),
        forceLevelUp: ids => { state.forcedRewardIds = ids.slice(); },
        processModals: () => processModalQueue(),
        get intro() { return { open: introOpen, scene: intro.scene, typed: intro.typed }; },
        get codexOpen() { return codexOpen; },
        openIntro: openIntro,
        startTutorial: startTutorial,
        render: () => renderAll(),
        previewFor: idx => buildTargetPreview(cardOf(state.hand[idx]), idx),
        noteShatter: noteShatter,
        showFloorTrigger: n => enqueueModal(triggerCard(runFloor(state, n))),
        showTip: showTip,
        reloadMeta: () => { meta = loadMeta(); renderBadge(); return meta; },
        openReception: openReception,
        endGame: endGame,
        vrEarned: vrEarnedThisRun,
        openRest: () => enqueueModal({ type: 'rest' }),
        // Abre o evento de um tile especial ('P', 'O' ou 'W') sem precisar andar até ele.
        openSpecial: (tile, key) => {
            const k = key || 'debug_' + tile;
            if (tile === 'W') useWishingWell(k);
            else enqueueModal({ type: 'event', event: tile === 'P' ? silverChestEvent(k) : offeringEvent(k) });
        }
    };

    openTitleModal();
    if (!ui.introSeen && !new URLSearchParams(window.location.search).has('skipintro')) openIntro(true);
})();

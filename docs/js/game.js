// Lógica principal de Sir Valter Motta: 3 andares, Loja da Copa, Aliados, Evolução de Cartas e Eventos.
(function () {
    'use strict';

    const D = window.GameData;
    const R = window.GameRenderer;
    const S = window.GameSprites;
    const A = window.GameAudio;

    const DIR_DX = [0, 1, 0, -1];
    const DIR_DY = [-1, 0, 1, 0];

    const els = {
        xpTrack: document.getElementById('xp-track'),
        xpFill: document.getElementById('xp-fill'),
        statLv: document.getElementById('stat-lv'),
        statFloor: document.getElementById('stat-floor'),
        statKills: document.getElementById('stat-kills'),
        statVr: document.getElementById('stat-vr'),
        hpText: document.getElementById('hp-text'),
        shieldBadge: document.getElementById('shield-badge'),
        shieldVal: document.getElementById('shield-val'),
        manaText: document.getElementById('mana-text'),
        manaSub: document.getElementById('mana-sub'),
        alliesStrip: document.getElementById('allies-strip'),
        passivesStrip: document.getElementById('passives-strip'),
        btnMute: document.getElementById('btn-mute'),
        iconSoundOn: document.getElementById('icon-sound-on'),
        iconSoundOff: document.getElementById('icon-sound-off'),
        btnRestart: document.getElementById('btn-restart'),
        viewport: document.getElementById('viewport'),
        glCanvas: document.getElementById('gl-canvas'),
        hudCanvas: document.getElementById('hud-canvas'),
        miniCanvas: document.getElementById('minimap-canvas'),
        comboBadge: document.getElementById('combo-badge'),
        comboNum: document.getElementById('combo-num'),
        overkillBanner: document.getElementById('overkill-banner'),
        evolutionBanner: document.getElementById('evolution-banner'),
        logText: document.getElementById('log-text'),
        explorePanel: document.getElementById('explore-panel'),
        combatPanel: document.getElementById('combat-panel'),
        handGrid: document.getElementById('hand-grid'),
        btnTurnLeft: document.getElementById('btn-turn-left'),
        btnMoveFwd: document.getElementById('btn-move-fwd'),
        btnTurnRight: document.getElementById('btn-turn-right'),
        btnStrafeLeft: document.getElementById('btn-strafe-left'),
        btnMoveBack: document.getElementById('btn-move-back'),
        btnStrafeRight: document.getElementById('btn-strafe-right'),
        btnPlayAll: document.getElementById('btn-play-all'),
        btnEndTurn: document.getElementById('btn-end-turn'),
        xpParticlesLayer: document.getElementById('xp-particles-layer'),
        levelupModal: document.getElementById('levelup-modal'),
        rewardGrid: document.getElementById('reward-grid'),
        shopModal: document.getElementById('shop-modal'),
        shopVrVal: document.getElementById('shop-vr-val'),
        shopItemsGrid: document.getElementById('shop-items-grid'),
        btnShopClose: document.getElementById('btn-shop-close'),
        eventModal: document.getElementById('event-modal'),
        eventTitle: document.getElementById('event-title'),
        eventDesc: document.getElementById('event-desc'),
        eventChoices: document.getElementById('event-choices'),
        endModal: document.getElementById('end-modal'),
        endBox: document.getElementById('end-box'),
        endTitle: document.getElementById('end-title'),
        endDesc: document.getElementById('end-desc'),
        endStats: document.getElementById('end-stats'),
        btnPlayAgain: document.getElementById('btn-play-again')
    };

    let state = null;
    let uidCounter = 1;
    let chestIndex = 0;
    let eventIndex = 0;
    let logHideTimer = null;

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

    function hasAlly(allyId) {
        return state.allies.includes(allyId);
    }

    function scaleVr(amount) {
        return Math.round(amount * (hasAlly('ally_claudia') ? 1.5 : 1));
    }

    function findStartPos(layout) {
        for (let y = 0; y < layout.length; y++) {
            const x = layout[y].indexOf('S');
            if (x >= 0) return { x: x, y: y };
        }
        return { x: 6, y: 11 };
    }

    function createInitialState() {
        const fl = D.getFloorConfig(1);
        const start = findStartPos(fl.layout);
        uidCounter = 1;
        chestIndex = 0;
        eventIndex = 0;
        const s = {
            mode: 'explore',
            previousMode: 'explore',
            busy: false,
            autoPlaying: false,
            floor: 1,
            player: {
                x: start.x,
                y: start.y,
                dir: 0
            },
            hp: 60,
            maxHp: 60,
            mana: 3,
            maxMana: 3,
            shield: 0,
            xp: 0,
            xpNext: 50,
            level: 1,
            vr: 0,
            combo: 1,
            damageMult: 1,
            allies: [],
            relics: [],
            passives: [],
            evolvedCards: {},
            pendingEvolutions: [],
            deck: D.STARTING_DECK.slice(),
            drawPile: [],
            hand: [],
            discardPile: [],
            enemies: [],
            targetUid: null,
            currentEncounterTile: null,
            bossDefeated: false,
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
        revealAround(state, start.x, start.y, fl.layout);

        R.setHoveredCard(null);
        R.buildMap(fl.layout, state);
        R.syncState(state);
        A.play('levelup');
        setLog('Andar ' + fl.floor + '/3: ' + fl.name + ' — Chefe: ' + fl.bossName + '!');
        renderAll();
    }

    function setLog(msg) {
        els.logText.textContent = msg;
        els.logText.classList.remove('toast-hidden');
        if (logHideTimer) clearTimeout(logHideTimer);
        logHideTimer = setTimeout(() => {
            els.logText.classList.add('toast-hidden');
        }, 3200);
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

    function triggerOverkillBanner() {
        els.overkillBanner.classList.remove('show');
        void els.overkillBanner.offsetWidth;
        els.overkillBanner.classList.add('show');
        A.play('overkill');
        R.triggerShake(0.09, 0.3);
        R.triggerScreenFlash('#f3c552', 0.28, 0.25);
    }

    function triggerEvolutionBanner(cardName) {
        els.evolutionBanner.textContent = 'EVOLUCAO! ' + cardName.toUpperCase();
        els.evolutionBanner.classList.remove('show');
        void els.evolutionBanner.offsetWidth;
        els.evolutionBanner.classList.add('show');
        A.play('levelup');
        R.triggerShake(0.07, 0.25);
        R.triggerScreenFlash('#ffd147', 0.3, 0.28);
    }

    function checkAndTriggerEvolutions(deferBannerIfModal) {
        let evolvedNames = [];
        D.EVOLUTIONS.forEach(ev => {
            if (!state.relics.includes(ev.passiveId)) return;
            let upgradedAny = false;
            const replaceInPile = (pile) => {
                for (let i = 0; i < pile.length; i++) {
                    if (pile[i] === ev.fromCard) {
                        pile[i] = ev.toCard;
                        upgradedAny = true;
                    }
                }
            };
            replaceInPile(state.deck);
            replaceInPile(state.drawPile);
            replaceInPile(state.hand);
            replaceInPile(state.discardPile);

            if (upgradedAny || !state.evolvedCards[ev.toCard]) {
                if (state.deck.includes(ev.toCard) && !state.evolvedCards[ev.toCard]) {
                    state.evolvedCards[ev.toCard] = true;
                    evolvedNames.push(D.CARDS[ev.toCard].name);
                }
            }
        });

        if (evolvedNames.length > 0) {
            const label = evolvedNames.join(' & ');
            if (deferBannerIfModal && (state.mode === 'shop' || state.mode === 'levelup')) {
                state.pendingEvolutions.push(label);
            } else {
                triggerEvolutionBanner(label);
                setLog('EVOLUCAO CONCLUIDA! Carta aprimorada: ' + label + '!');
            }
        }
    }

    function flushPendingEvolutionBanner() {
        if (state.pendingEvolutions.length > 0 && state.mode === 'explore') {
            const label = state.pendingEvolutions.shift();
            triggerEvolutionBanner(label);
            setLog('EVOLUCAO CONCLUIDA! Carta aprimorada: ' + label + '!');
        }
    }

    function spawnXpParticles(fromX, fromY, totalXp) {
        const trackRect = els.xpTrack.getBoundingClientRect();
        const targetX = trackRect.left + trackRect.width * 0.5;
        const targetY = trackRect.top + trackRect.height * 0.5;
        const count = Math.min(12, Math.max(6, Math.round(totalXp / 6)));
        const xpPerOrb = Math.floor(totalXp / count);
        let remainder = totalXp - xpPerOrb * count;

        for (let i = 0; i < count; i++) {
            const orb = document.createElement('div');
            orb.className = 'xp-orb';
            const startX = fromX + (Math.random() - 0.5) * 44;
            const startY = fromY + (Math.random() - 0.5) * 44;
            const ctrlX = (startX + targetX) / 2 + (Math.random() - 0.5) * 140;
            const ctrlY = Math.min(startY, targetY) - 60 - Math.random() * 60;
            const dur = 460 + i * 35;
            const startTime = performance.now() + i * 28;
            const orbXp = xpPerOrb + (remainder > 0 ? 1 : 0);
            if (remainder > 0) remainder--;

            orb.style.left = startX + 'px';
            orb.style.top = startY + 'px';
            els.xpParticlesLayer.appendChild(orb);

            function tick(now) {
                if (now < startTime) {
                    requestAnimationFrame(tick);
                    return;
                }
                const p = Math.min(1, (now - startTime) / dur);
                const inv = 1 - p;
                const x = inv * inv * startX + 2 * inv * p * ctrlX + p * p * targetX;
                const y = inv * inv * startY + 2 * inv * p * ctrlY + p * p * targetY;
                orb.style.left = x + 'px';
                orb.style.top = y + 'px';

                if (p < 1) {
                    requestAnimationFrame(tick);
                } else {
                    orb.remove();
                    gainXp(orbXp);
                }
            }
            requestAnimationFrame(tick);
        }
    }

    function gainXp(amount) {
        if (state.mode === 'gameover') return;
        state.xp += amount;
        A.play('xpTick');
        els.xpTrack.classList.remove('pulse');
        void els.xpTrack.offsetWidth;
        els.xpTrack.classList.add('pulse');

        while (state.xp >= state.xpNext) {
            state.xp -= state.xpNext;
            state.level += 1;
            state.xpNext = Math.round(state.xpNext * 1.45);
            state.pendingLevelUps += 1;
        }

        renderHud();

        if (state.pendingLevelUps > 0 && state.mode === 'explore' && !state.busy) {
            openLevelUpModal();
        }
    }

    function openLevelUpModal() {
        if (state.pendingLevelUps <= 0 || state.mode === 'gameover') return;
        state.pendingLevelUps -= 1;
        state.previousMode = state.mode;
        state.mode = 'levelup';
        R.setHoveredCard(null);
        A.play('levelup');

        const pool = D.LEVEL_UP_REWARDS.filter(rw => !(rw.once && state.relics.includes(rw.id)));
        const choices = shuffle(pool).slice(0, 3);
        els.rewardGrid.innerHTML = '';

        choices.forEach(rw => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'reward-card';
            const kindLabel = rw.kind === 'carta' ? 'Nova Carta' : rw.kind === 'reliquia' ? 'Reliquia Evolucao' : 'Passiva / Status';
            btn.innerHTML =
                '<span class="reward-kind">' + kindLabel + '</span>' +
                '<img src="' + S.getIconUrl(rw.icon) + '" alt="' + rw.title + '" />' +
                '<div class="reward-title">' + rw.title + '</div>' +
                '<div class="reward-origin">(' + rw.origin + ')</div>' +
                '<div class="reward-desc">' + rw.desc + '</div>';
            btn.addEventListener('click', () => {
                A.unlock();
                A.play('card');
                rw.apply(state);
                els.levelupModal.classList.add('hidden');
                state.mode = state.previousMode;
                checkAndTriggerEvolutions(false);
                if (state.pendingEvolutions.length === 0) {
                    setLog('Promocao aplicada a Sir Valter: ' + rw.title + '!');
                }
                renderAll();

                if (state.pendingLevelUps > 0) {
                    setTimeout(openLevelUpModal, 220);
                }
            });
            els.rewardGrid.appendChild(btn);
        });

        els.levelupModal.classList.remove('hidden');
    }

    // ---------- LOJA DA MÁQUINA DE CAFÉ & ALIADOS ----------

    function openShopModal() {
        state.mode = 'shop';
        R.setHoveredCard(null);
        A.play('chest');
        renderShopModal();
        els.shopModal.classList.remove('hidden');
    }

    function renderShopModal() {
        els.shopVrVal.textContent = String(state.vr);
        els.shopItemsGrid.innerHTML = '';

        // 1) Café Expresso (15 VR)
        const needHeal = state.hp < state.maxHp;
        addShopItem({
            title: 'Café Expresso',
            desc: 'Cura +25 de Sanidade para Sir Valter imediatamente.',
            icon: 'coffee',
            price: 15,
            disabled: state.vr < 15 || !needHeal,
            priceText: needHeal ? '15 VR' : 'SANIDADE CHEIA',
            onBuy: () => {
                state.vr -= 15;
                state.hp = Math.min(state.maxHp, state.hp + 25);
                A.play('chest');
                setLog('Sir Valter tomou um Expresso quente! +25 Sanidade.');
            }
        });

        // 2) Relíquia de Evolução disponível (25 VR)
        const availRelic = D.EVOLUTIONS.find(ev => !state.relics.includes(ev.passiveId));
        if (availRelic) {
            addShopItem({
                title: availRelic.title,
                desc: availRelic.desc,
                icon: availRelic.icon,
                price: 25,
                disabled: state.vr < 25,
                priceText: '25 VR',
                onBuy: () => {
                    state.vr -= 25;
                    state.relics.push(availRelic.passiveId);
                    state.passives.push({ label: availRelic.title + ' (Evolucao)', icon: availRelic.icon });
                    A.play('levelup');
                    checkAndTriggerEvolutions(true);
                    setLog('Reliquia obtida: ' + availRelic.title + '!');
                }
            });
        } else {
            addShopItem({
                title: 'Tônico de Cafeína',
                desc: '+10 Sanidade Máxima e cura +10 Sanidade.',
                icon: 'espresso',
                price: 25,
                disabled: state.vr < 25,
                priceText: '25 VR',
                onBuy: () => {
                    state.vr -= 25;
                    state.maxHp += 10;
                    state.hp = Math.min(state.maxHp, state.hp + 10);
                    A.play('levelup');
                }
            });
        }

        // 3) Carta extra Demissão Silenciosa ou Relíquia 2
        const secondRelic = D.EVOLUTIONS.find(ev => ev !== availRelic && !state.relics.includes(ev.passiveId));
        if (secondRelic) {
            addShopItem({
                title: secondRelic.title,
                desc: secondRelic.desc,
                icon: secondRelic.icon,
                price: 25,
                disabled: state.vr < 25,
                priceText: '25 VR',
                onBuy: () => {
                    state.vr -= 25;
                    state.relics.push(secondRelic.passiveId);
                    state.passives.push({ label: secondRelic.title + ' (Evolucao)', icon: secondRelic.icon });
                    A.play('levelup');
                    checkAndTriggerEvolutions(true);
                }
            });
        } else {
            addShopItem({
                title: 'Atestado Arcano',
                desc: 'Adiciona ao deck: Custo 0 — Cura 12, +8 Escudo e +1 Cafeína.',
                icon: 'medical',
                price: 20,
                disabled: state.vr < 20,
                priceText: '20 VR',
                onBuy: () => {
                    state.vr -= 20;
                    state.deck.push('atestado_arcano');
                    A.play('card');
                }
            });
        }

        // 4..6) Recrutamento de Aliados (35 VR)
        D.ALLIES.forEach(ally => {
            const hired = hasAlly(ally.id);
            addShopItem({
                title: ally.name,
                desc: ally.role + ': ' + ally.desc,
                icon: ally.icon,
                price: ally.cost,
                allyOffer: true,
                disabled: hired || state.vr < ally.cost,
                priceText: hired ? 'RECRUTADO' : ally.cost + ' VR',
                onBuy: () => {
                    state.vr -= ally.cost;
                    state.allies.push(ally.id);
                    A.play('levelup');
                    setLog(ally.name + ' entrou para a equipe de Sir Valter!');
                }
            });
        });
    }

    function addShopItem(opts) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shop-item-card' + (opts.allyOffer ? ' ally-offer' : '');
        btn.disabled = !!opts.disabled;
        btn.innerHTML =
            '<img src="' + S.getIconUrl(opts.icon) + '" alt="' + opts.title + '" />' +
            '<div class="shop-item-title">' + opts.title + '</div>' +
            '<div class="shop-item-desc">' + opts.desc + '</div>' +
            '<span class="shop-item-price">' + opts.priceText + '</span>';
        btn.addEventListener('click', () => {
            A.unlock();
            opts.onBuy();
            renderHud();
            renderShopModal();
        });
        els.shopItemsGrid.appendChild(btn);
    }

    function closeShopModal() {
        els.shopModal.classList.add('hidden');
        state.mode = 'explore';
        renderAll();
        flushPendingEvolutionBanner();
    }

    // ---------- EVENTOS ALEATÓRIOS (?) ----------

    function openEventModal(tileKey) {
        state.mode = 'event';
        R.setHoveredCard(null);
        A.play('encounter');

        const ev = D.CORRIDOR_EVENTS[eventIndex % D.CORRIDOR_EVENTS.length];
        eventIndex++;
        els.eventTitle.textContent = ev.title;
        els.eventDesc.textContent = ev.desc;
        els.eventChoices.innerHTML = '';

        const helpers = {
            scaleVr: scaleVr,
            addXp: function (amt) { gainXp(amt); },
            triggerAmbush: function (enemies, intro) {
                els.eventModal.classList.add('hidden');
                startEncounter(tileKey, {
                    zone: 'Emboscada no Corredor',
                    intro: intro,
                    enemies: enemies
                });
            }
        };

        ev.choices.forEach(ch => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'event-choice-btn';
            btn.innerHTML =
                '<span>' + ch.label + '</span>' +
                '<span class="event-choice-hint">' + ch.hint + '</span>';
            btn.addEventListener('click', () => {
                A.unlock();
                A.play('card');
                const msg = ch.effect(state, helpers);
                if (state.mode === 'combat') return;
                els.eventModal.classList.add('hidden');
                state.mode = 'explore';
                if (msg) setLog(msg);
                R.syncState(state);
                renderAll();
                if (state.pendingLevelUps > 0) {
                    setTimeout(openLevelUpModal, 200);
                }
            });
            els.eventChoices.appendChild(btn);
        });

        els.eventModal.classList.remove('hidden');
    }

    // ---------- EXPLORAÇÃO ----------

    function moveRelative(forwardStep, strafeStep) {
        if (state.mode !== 'explore' || state.busy) return;
        A.unlock();
        const layout = currentFloor().layout;
        const dir = state.player.dir;
        const rightDir = (dir + 1) % 4;
        const nx = state.player.x + DIR_DX[dir] * forwardStep + DIR_DX[rightDir] * strafeStep;
        const ny = state.player.y + DIR_DY[dir] * forwardStep + DIR_DY[rightDir] * strafeStep;

        if (ny < 0 || ny >= layout.length || nx < 0 || nx >= layout[0].length) return;
        const tile = layout[ny][nx];
        if (tile === '#') {
            A.play('hit');
            R.triggerShake(0.03, 0.12);
            setLog('Sir Valter esbarrou na divisoria de uma baia sombria.');
            return;
        }

        state.player.x = nx;
        state.player.y = ny;
        revealAround(state, nx, ny, layout);
        A.play('step');
        R.triggerStepBob();
        R.syncState(state);
        renderAll();

        handleTileEvent(nx, ny, tile);
    }

    function turnPlayer(deltaDir) {
        if (state.mode !== 'explore' || state.busy) return;
        A.unlock();
        state.player.dir = (state.player.dir + deltaDir + 4) % 4;
        A.play('turn');
        R.turnCamera(deltaDir);
        R.syncState(state);
    }

    function handleTileEvent(x, y, tile) {
        const key = x + ',' + y;
        const fl = currentFloor();

        if (tile === 'M') {
            openShopModal();
            return;
        }

        if (tile === '?' && !state.clearedTiles.has(key)) {
            state.clearedTiles.add(key);
            openEventModal(key);
            return;
        }

        if (tile === 'C' && !state.clearedTiles.has(key)) {
            state.clearedTiles.add(key);
            const loot = D.CHEST_LOOT[chestIndex % D.CHEST_LOOT.length];
            chestIndex++;
            const gainedVr = scaleVr(loot.vr);
            state.hp = Math.min(state.maxHp, state.hp + loot.hp);
            state.vr += gainedVr;
            A.play('chest');
            setLog(loot.title + ': ' + loot.text);

            const vpRect = els.viewport.getBoundingClientRect();
            spawnFloatingText(vpRect.left + vpRect.width / 2, vpRect.top + vpRect.height * 0.45, '+' + loot.hp + ' Sanidade', 'heal');
            spawnXpParticles(vpRect.left + vpRect.width / 2, vpRect.top + vpRect.height * 0.48, loot.xp);
            R.syncState(state);
            renderAll();
            return;
        }

        if (fl.encounters[tile] && !state.clearedTiles.has(key)) {
            startEncounter(key, fl.encounters[tile]);
            return;
        }

        if (tile === 'E') {
            if (state.bossDefeated) {
                if (state.floor < D.FLOORS.length) {
                    loadFloor(state.floor + 1);
                } else {
                    endGame(true);
                }
            } else {
                setLog('Elevador trancado! Derrote ' + fl.bossName + ' antes de subir!');
                A.play('immune');
            }
        }
    }

    // ---------- COMBATE TURBO ----------

    function startEncounter(tileKey, enc) {
        state.mode = 'combat';
        state.currentEncounterTile = tileKey;
        state.mana = state.maxMana;
        state.shield = hasAlly('ally_jorge') ? 5 : 0;
        state.combo = 1;
        state.enemies = enc.enemies.map(kind => {
            const tpl = D.ENEMIES[kind];
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
                doubleIfUnshielded: !!tpl.doubleIfUnshielded,
                isBoss: !!tpl.isBoss,
                scale: tpl.scale,
                stunned: false
            };
        });
        state.targetUid = state.enemies[0].uid;

        state.drawPile = shuffle(state.deck);
        state.discardPile = [];
        state.hand = [];
        drawCards(4);

        A.play('encounter');
        R.triggerShake(0.05, 0.22);
        setLog(enc.intro);
        R.syncState(state);
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
        const flatAlly = hasAlly('ally_claudia') ? 3 : 0;
        return Math.round((card.damage + flatAlly) * state.damageMult * state.combo);
    }

    function applyDamageToEnemy(enemy, dmg, card, usedCombo) {
        if (!enemy || enemy.hp <= 0) return { overkill: false };
        const pos = R.getEnemyScreenPos(enemy.uid);
        let remaining = dmg;

        if (!card.ignoreShield && enemy.shield > 0) {
            const blocked = Math.min(enemy.shield, remaining);
            enemy.shield -= blocked;
            remaining -= blocked;
            if (blocked > 0) {
                spawnFloatingText(pos.x, pos.y - 24, 'Escudo -' + blocked, 'shield');
            }
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
                const isOverkill = excess >= 8 || (prevHp > 0 && usedCombo >= 2 && excess >= 4);
                let bonusXp = 0;
                let bonusVr = 0;
                if (isOverkill) {
                    overkill = true;
                    state.overkills += 1;
                    bonusXp = 15;
                    bonusVr = 10;
                }

                state.kills += 1;
                state.vr += scaleVr(enemy.vr + bonusVr);
                if (enemy.isBoss) state.bossDefeated = true;

                A.play('death');
                spawnXpParticles(pos.x, pos.y, enemy.xp + bonusXp);
            }
        }
        return { overkill: overkill };
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
            const dIdx = state.deck.indexOf(cardId);
            if (dIdx >= 0) state.deck.splice(dIdx, 1);
            A.play('card');
            setLog('Ata de Reuniao arquivada e removida da mao!');
            R.syncState(state);
            renderAll();
            return true;
        }

        state.discardPile.push(cardId);
        const comboStep = hasAlly('ally_vivi') ? 2 : 1;
        const vpRect = els.viewport.getBoundingClientRect();

        if (card.shield > 0) {
            state.shield += card.shield;
            spawnFloatingText(vpRect.left + vpRect.width * 0.5, vpRect.top + vpRect.height * 0.72, '+' + card.shield + ' Escudo', 'shield');
        }
        if (card.heal > 0) {
            state.hp = Math.min(state.maxHp, state.hp + card.heal);
            spawnFloatingText(vpRect.left + vpRect.width * 0.5, vpRect.top + vpRect.height * 0.65, '+' + card.heal + ' Sanidade', 'heal');
        }
        if (card.manaGain > 0) {
            state.mana += card.manaGain;
        }

        const totalHits = card.hits || 1;
        if (totalHits > 1) {
            // Golpes múltiplos sequenciais (ex: Mandíbula de Ferro 3x)
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
                    if (anyOverkill) triggerOverkillBanner();
                    setLog(card.name + ': sequencia de ' + hitNum + 'x golpes!');
                    getTargetEnemy();
                    R.syncState(state);
                    renderAll(true);
                    if (state.enemies.every(e => e.hp <= 0)) finishEncounter();
                    return;
                }

                const usedCombo = state.combo;
                const dmg = computeCardDamage(card);
                A.play(card.sfx);
                if (usedCombo > 1) setTimeout(() => A.play('combo', usedCombo), 40);

                const res = applyDamageToEnemy(target, dmg, card, usedCombo);
                if (res.overkill) anyOverkill = true;
                state.combo += comboStep;
                hitNum++;

                R.syncState(state);
                renderAll(true);
                setTimeout(runHit, 165);
            };
            runHit();
            return true;
        }

        const usedCombo = state.combo;
        const dmg = computeCardDamage(card);
        A.play(card.sfx);
        if (usedCombo > 1) {
            setTimeout(() => A.play('combo', usedCombo), 60);
        }

        let targets = [];
        if (card.target === 'single') {
            const t = getTargetEnemy();
            if (t) targets = [t];
        } else if (card.target === 'all') {
            targets = state.enemies.filter(e => e.hp > 0);
        }

        let logMsg = card.name + ' (' + card.origin + ')';
        if (usedCombo > 1) logMsg += ' [COMBO x' + usedCombo + ']';

        let overkillTriggered = false;
        targets.forEach(enemy => {
            const pos = R.getEnemyScreenPos(enemy.uid);
            if (dmg > 0) {
                const res = applyDamageToEnemy(enemy, dmg, card, usedCombo);
                if (res.overkill) overkillTriggered = true;
            }
            if (card.knockback && enemy.hp > 0) {
                if (enemy.immuneKnockback) {
                    A.play('immune');
                    spawnFloatingText(pos.x, pos.y + 16, 'IMUNE KB!', 'player-hit');
                } else {
                    enemy.stunned = true;
                    A.play('stun');
                    spawnFloatingText(pos.x, pos.y + 16, 'KNOCKBACK!', 'shield');
                }
            }
        });

        if (overkillTriggered) {
            triggerOverkillBanner();
            logMsg += ' — OVERKILL! (+15 XP, +10 VR)';
        }

        state.combo += comboStep;
        setLog(logMsg);

        getTargetEnemy();
        R.syncState(state);
        renderAll(true);

        if (state.enemies.every(e => e.hp <= 0)) {
            finishEncounter();
        }
        return true;
    }

    function playAllCards() {
        if (state.mode !== 'combat' || state.busy || state.autoPlaying) return;
        const playableExists = state.hand.some(id => !D.CARDS[id].purgeOnPlay && D.CARDS[id].cost <= state.mana);
        if (!playableExists) {
            setLog('Sem Cafeina suficiente para jogar cartas uteis. Clique em Fim do Turno!');
            return;
        }

        state.autoPlaying = true;
        renderCombatControls();

        function stepNext() {
            if (state.mode !== 'combat' || !state.autoPlaying) {
                state.autoPlaying = false;
                return;
            }
            if (state.busy) {
                setTimeout(stepNext, 100);
                return;
            }
            const idx = state.hand.findIndex(id => !D.CARDS[id].purgeOnPlay && D.CARDS[id].cost <= state.mana);
            if (idx < 0 || state.enemies.every(e => e.hp <= 0)) {
                state.autoPlaying = false;
                renderAll();
                return;
            }
            playCard(idx);
            const waitMs = state.busy ? 560 : 220;
            if (state.mode === 'combat' && state.enemies.some(e => e.hp > 0)) {
                setTimeout(stepNext, waitMs);
            } else {
                state.autoPlaying = false;
                renderCombatControls();
            }
        }

        stepNext();
    }

    function endTurn() {
        if (state.mode !== 'combat' || state.busy || state.autoPlaying) return;
        A.unlock();
        R.setHoveredCard(null);
        state.busy = true;
        renderCombatControls();

        const alive = state.enemies.filter(e => e.hp > 0);
        const pendingCurses = [];
        let idx = 0;

        function nextEnemyAction() {
            if (state.mode !== 'combat') {
                state.busy = false;
                return;
            }
            if (idx >= alive.length) {
                state.mana = state.maxMana;
                state.combo = 1;
                state.shield = hasAlly('ally_jorge') ? 5 : 0;
                while (state.hand.length > 0) {
                    state.discardPile.push(state.hand.pop());
                }
                drawCards(4);
                pendingCurses.forEach(curseId => {
                    if (state.hand.length < 5) {
                        state.hand.push(curseId);
                    } else {
                        state.drawPile.push(curseId);
                    }
                });
                state.busy = false;
                A.play('card');
                setLog(hasAlly('ally_jorge')
                    ? 'Seu Jorge do TI ativou +5 Escudo! Cafeina recarregada.'
                    : 'Novo turno! Cafeina recarregada e Combo reiniciado.');
                R.syncState(state);
                renderAll();
                return;
            }

            const enemy = alive[idx++];
            const pos = R.getEnemyScreenPos(enemy.uid);
            const vpRect = els.viewport.getBoundingClientRect();

            if (enemy.stunned) {
                enemy.stunned = false;
                spawnFloatingText(pos.x, pos.y, 'ATORDOADO!', 'shield');
                setLog(enemy.name + ' perdeu o turno por Knockback!');
                R.syncState(state);
                setTimeout(nextEnemyAction, 380);
                return;
            }

            // Habilidade do Cultista: buffa ataque dos aliados vivos
            if (enemy.buffAllies > 0) {
                alive.forEach(allyEnemy => {
                    if (allyEnemy.hp > 0) allyEnemy.atk += enemy.buffAllies;
                });
                spawnFloatingText(pos.x, pos.y - 24, '+' + enemy.buffAllies + ' ATK Grupo!', 'heal');
            }

            // Habilidade da Dona Carmem: coloca Ata de Reunião na mão do próximo turno
            if (enemy.curseCard) {
                pendingCurses.push(enemy.curseCard);
                spawnFloatingText(pos.x, pos.y - 24, '+Ata de Reuniao!', 'player-hit');
            }

            R.triggerEnemyAttackAnim(enemy.uid);
            let dmg = enemy.atk;
            if (enemy.doubleIfUnshielded && state.shield <= 0) {
                dmg = enemy.atk * 2;
                spawnFloatingText(pos.x, pos.y - 26, 'CORTE EM DOBRO!', 'player-hit');
            }

            const absorbed = Math.min(state.shield, dmg);
            state.shield -= absorbed;
            dmg -= absorbed;

            if (absorbed > 0) {
                A.play('block');
                spawnFloatingText(vpRect.left + vpRect.width * 0.5, vpRect.top + vpRect.height * 0.7, 'Bloqueou ' + absorbed, 'shield');
            }
            if (dmg > 0) {
                state.hp = Math.max(0, state.hp - dmg);
                A.play('hurt');
                R.triggerShake(0.08, 0.25);
                R.triggerScreenFlash('#d8452f', 0.36, 0.26);
                spawnFloatingText(vpRect.left + vpRect.width * 0.5, vpRect.top + vpRect.height * 0.62, '-' + dmg + ' Sanidade', 'player-hit');
                const heartEl = els.hpText.parentElement;
                if (heartEl) {
                    heartEl.classList.remove('hit-pulse');
                    void heartEl.offsetWidth;
                    heartEl.classList.add('hit-pulse');
                }
            }

            setLog(enemy.name + ' (' + enemy.origin + '): ' + D.ENEMIES[enemy.kind].quip);
            renderHud();

            if (state.hp <= 0) {
                state.busy = false;
                endGame(false);
                return;
            }

            setTimeout(nextEnemyAction, 520);
        }

        nextEnemyAction();
    }

    function finishEncounter() {
        state.busy = true;
        R.setHoveredCard(null);
        state.clearedTiles.add(state.currentEncounterTile);
        state.currentEncounterTile = null;

        setTimeout(() => {
            if (state.mode === 'gameover') return;
            state.mode = 'explore';
            state.enemies = [];
            state.combo = 1;
            state.shield = 0;
            state.busy = false;
            state.autoPlaying = false;

            const fl = currentFloor();
            if (state.bossDefeated && state.floor === D.FLOORS.length) {
                endGame(true);
                return;
            }

            if (state.bossDefeated) {
                setLog('CHEFE DERROTADO! ' + fl.exitHint);
            } else {
                setLog('Horda dispersada! Continue explorando o Andar ' + state.floor + '.');
            }

            R.syncState(state);
            renderAll();

            if (state.pendingLevelUps > 0) {
                setTimeout(openLevelUpModal, 360);
            }
        }, 520);
    }

    function endGame(victory) {
        state.mode = 'gameover';
        R.setHoveredCard(null);
        els.endBox.classList.toggle('defeat', !victory);
        if (victory) {
            A.play('victory');
            els.endTitle.textContent = 'SEXTOU! VOCE BATEU O PONTO AS 18:00!';
            els.endDesc.textContent =
                'Sir Valter derrotou o Lich, Dona Carmem do RH e Lorde Valdemar, O CEO! O expediente sombrio acabou!';
        } else {
            A.play('defeat');
            els.endTitle.textContent = 'BURNOUT TOTAL...';
            els.endDesc.textContent =
                'A Sanidade de Sir Valter zerou no Andar ' + state.floor + '. O RH convocou uma reuniao eterna.';
        }
        els.endStats.textContent =
            'ANDAR ' + state.floor + '/3  |  LV ' + state.level +
            '  |  VR: ' + state.vr + '  |  Abates: ' + state.kills +
            '  |  Overkills: ' + state.overkills;
        els.endModal.classList.remove('hidden');
        renderAll();
    }

    // ---------- RENDERIZAÇÃO DA UI ----------

    function renderHud() {
        const xpPct = Math.min(100, Math.round((state.xp / state.xpNext) * 100));
        els.xpFill.style.width = xpPct + '%';
        els.statLv.textContent = String(state.level);
        els.statFloor.textContent = 'ANDAR ' + state.floor + '/3';
        els.statKills.textContent = String(state.kills);
        els.statVr.textContent = String(state.vr);

        els.hpText.textContent = state.hp + '/' + state.maxHp;
        if (state.shield > 0) {
            els.shieldVal.textContent = String(state.shield);
            els.shieldBadge.classList.remove('hidden');
        } else {
            els.shieldBadge.classList.add('hidden');
        }

        els.manaText.textContent = String(state.mana);
        els.manaSub.textContent = state.mana + '/' + state.maxMana;

        els.alliesStrip.innerHTML = '';
        state.allies.forEach(allyId => {
            const ally = D.ALLIES.find(a => a.id === allyId);
            if (!ally) return;
            const box = document.createElement('div');
            box.className = 'ally-portrait-box';
            box.title = ally.name + ' (' + ally.desc + ')';
            box.innerHTML = '<img src="' + S.getIconUrl(ally.icon) + '" alt="' + ally.name + '" />';
            els.alliesStrip.appendChild(box);
        });

        els.passivesStrip.innerHTML = '';
        state.passives.forEach(p => {
            const label = typeof p === 'string' ? p : p.label;
            const icon = typeof p === 'string' ? 'headphones' : p.icon;
            const box = document.createElement('div');
            box.className = 'passive-icon-box';
            box.title = label;
            box.innerHTML = '<img src="' + S.getIconUrl(icon) + '" alt="' + label + '" />';
            els.passivesStrip.appendChild(box);
        });
    }

    function renderCombatControls(popCombo) {
        const inCombat = state.mode === 'combat';
        els.explorePanel.classList.toggle('hidden', inCombat);
        els.combatPanel.classList.toggle('hidden', !inCombat);

        if (!inCombat) {
            els.comboBadge.classList.add('hidden');
            R.setHoveredCard(null);
            return;
        }

        els.comboBadge.classList.remove('hidden');
        els.comboNum.textContent = 'x' + state.combo;
        if (popCombo) {
            els.comboBadge.classList.remove('pop');
            void els.comboBadge.offsetWidth;
            els.comboBadge.classList.add('pop');
        }

        const locked = state.busy || state.autoPlaying;
        const canPlayAny = !locked && state.hand.some(id => !D.CARDS[id].purgeOnPlay && D.CARDS[id].cost <= state.mana);
        els.btnPlayAll.disabled = !canPlayAny;
        els.btnEndTurn.disabled = locked;

        els.handGrid.innerHTML = '';
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
                '<div class="card-art"><img src="' + S.getIconUrl(card.icon) + '" alt="' + card.name + '" /></div>' +
                '<div class="card-textbox"><div class="card-origin">' + card.origin + '</div>' +
                '<div class="card-desc">' + desc + '</div></div>';

            btn.addEventListener('mouseenter', () => {
                if (!btn.disabled && (card.damage > 0 || card.knockback)) {
                    R.setHoveredCard(card);
                }
            });
            btn.addEventListener('mouseleave', () => {
                R.setHoveredCard(null);
            });
            btn.addEventListener('click', () => playCard(idx));
            els.handGrid.appendChild(btn);
        });
    }

    function renderAll(popCombo) {
        renderHud();
        renderCombatControls(popCombo);
    }

    function startNewGame() {
        els.levelupModal.classList.add('hidden');
        els.shopModal.classList.add('hidden');
        els.eventModal.classList.add('hidden');
        els.endModal.classList.add('hidden');
        state = createInitialState();
        const fl = currentFloor();
        R.setHoveredCard(null);
        R.buildMap(fl.layout, state);
        R.syncState(state);
        setLog('Sir Valter entrou no Andar 1 (' + fl.name + '). Chefe: ' + fl.bossName + '!');
        renderAll();
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
    els.btnShopClose.addEventListener('click', closeShopModal);

    els.btnMute.addEventListener('click', () => {
        const isMuted = A.toggleMute();
        els.iconSoundOn.classList.toggle('hidden', isMuted);
        els.iconSoundOff.classList.toggle('hidden', !isMuted);
    });
    els.btnRestart.addEventListener('click', startNewGame);
    els.btnPlayAgain.addEventListener('click', startNewGame);

    window.addEventListener('keydown', ev => {
        if (state.mode === 'shop' && ev.key === 'Escape') {
            closeShopModal();
            return;
        }
        if (state.mode === 'levelup' || state.mode === 'shop' || state.mode === 'event' || state.mode === 'gameover') return;

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

    startNewGame();
})();

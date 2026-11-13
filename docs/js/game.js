// Lógica principal: exploração em grid + combate turbo + zero emojis.
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
        statKills: document.getElementById('stat-kills'),
        statVr: document.getElementById('stat-vr'),
        hpText: document.getElementById('hp-text'),
        shieldBadge: document.getElementById('shield-badge'),
        shieldVal: document.getElementById('shield-val'),
        manaText: document.getElementById('mana-text'),
        manaSub: document.getElementById('mana-sub'),
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

    function findStartPos() {
        for (let y = 0; y < D.MAP_LAYOUT.length; y++) {
            const x = D.MAP_LAYOUT[y].indexOf('S');
            if (x >= 0) return { x: x, y: y };
        }
        return { x: 6, y: 11 };
    }

    function createInitialState() {
        const start = findStartPos();
        uidCounter = 1;
        chestIndex = 0;
        const s = {
            mode: 'explore',
            previousMode: 'explore',
            busy: false,
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
            passives: [],
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
        revealAround(s, start.x, start.y);
        return s;
    }

    function revealAround(s, px, py) {
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const nx = px + dx;
                const ny = py + dy;
                if (ny >= 0 && ny < D.MAP_LAYOUT.length && nx >= 0 && nx < D.MAP_LAYOUT[0].length) {
                    s.exploredTiles.add(nx + ',' + ny);
                }
            }
        }
    }

    let logHideTimer = null;

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

        if (state.pendingLevelUps > 0 && state.mode !== 'levelup' && !state.busy) {
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

        const choices = shuffle(D.LEVEL_UP_REWARDS).slice(0, 3);
        els.rewardGrid.innerHTML = '';

        choices.forEach(rw => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'reward-card';
            btn.innerHTML =
                '<span class="reward-kind">' + (rw.kind === 'carta' ? 'Nova Carta' : 'Passiva / Status') + '</span>' +
                '<img src="' + S.getIconUrl(rw.icon) + '" alt="' + rw.title + '" />' +
                '<div class="reward-title">' + rw.title + '</div>' +
                '<div class="reward-origin">(' + rw.origin + ')</div>' +
                '<div class="reward-desc">' + rw.desc + '</div>';
            btn.addEventListener('click', () => {
                A.unlock();
                A.play('card');
                const prevPassivesLen = state.passives.length;
                rw.apply(state);
                if (state.passives.length > prevPassivesLen) {
                    const last = state.passives[state.passives.length - 1];
                    if (typeof last === 'string') {
                        state.passives[state.passives.length - 1] = { label: last, icon: rw.icon };
                    }
                }
                els.levelupModal.classList.add('hidden');
                state.mode = state.previousMode;
                setLog('Promocao aplicada: ' + rw.title + '!');
                renderAll();

                if (state.pendingLevelUps > 0) {
                    setTimeout(openLevelUpModal, 180);
                }
            });
            els.rewardGrid.appendChild(btn);
        });

        els.levelupModal.classList.remove('hidden');
    }

    // ---------- EXPLORAÇÃO ----------

    function moveRelative(forwardStep, strafeStep) {
        if (state.mode !== 'explore' || state.busy) return;
        A.unlock();
        const dir = state.player.dir;
        const rightDir = (dir + 1) % 4;
        const nx = state.player.x + DIR_DX[dir] * forwardStep + DIR_DX[rightDir] * strafeStep;
        const ny = state.player.y + DIR_DY[dir] * forwardStep + DIR_DY[rightDir] * strafeStep;

        if (ny < 0 || ny >= D.MAP_LAYOUT.length || nx < 0 || nx >= D.MAP_LAYOUT[0].length) return;
        const tile = D.MAP_LAYOUT[ny][nx];
        if (tile === '#') {
            A.play('hit');
            R.triggerShake(0.03, 0.12);
            setLog('Voce esbarrou na divisoria de uma baia sombria.');
            return;
        }

        state.player.x = nx;
        state.player.y = ny;
        revealAround(state, nx, ny);
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
        if (tile === 'C' && !state.clearedTiles.has(key)) {
            state.clearedTiles.add(key);
            const loot = D.CHEST_LOOT[chestIndex % D.CHEST_LOOT.length];
            chestIndex++;
            state.hp = Math.min(state.maxHp, state.hp + loot.hp);
            state.vr += loot.vr;
            A.play('chest');
            setLog(loot.title + ': ' + loot.text);

            const vpRect = els.viewport.getBoundingClientRect();
            spawnFloatingText(vpRect.left + vpRect.width / 2, vpRect.top + vpRect.height * 0.45, '+' + loot.hp + ' Sanidade', 'heal');
            spawnXpParticles(vpRect.left + vpRect.width / 2, vpRect.top + vpRect.height * 0.48, loot.xp);
            R.syncState(state);
            renderAll();
            return;
        }

        if (D.ENCOUNTERS[tile] && !state.clearedTiles.has(key)) {
            startEncounter(key, D.ENCOUNTERS[tile]);
            return;
        }

        if (tile === 'E') {
            if (state.bossDefeated) {
                endGame(true);
            } else {
                setLog('Elevador das 18h trancado! Derrote o Lich das Planilhas na Ala da Diretoria.');
                A.play('immune');
            }
        }
    }

    // ---------- COMBATE TURBO ----------

    function startEncounter(tileKey, enc) {
        state.mode = 'combat';
        state.currentEncounterTile = tileKey;
        state.mana = state.maxMana;
        state.shield = 0;
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
                atk: tpl.atk,
                xp: tpl.xp,
                vr: tpl.vr,
                immuneKnockback: tpl.immuneKnockback,
                isBoss: kind === 'lich',
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
        return Math.round(card.damage * state.damageMult * state.combo);
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
        state.discardPile.push(cardId);

        const usedCombo = state.combo;
        const dmg = computeCardDamage(card);

        A.play(card.sfx);
        if (usedCombo > 1) {
            setTimeout(() => A.play('combo', usedCombo), 60);
        }

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
                const prevHp = enemy.hp;
                enemy.hp = Math.max(0, enemy.hp - dmg);
                R.triggerEnemyHitAnim(enemy.uid, usedCombo >= 2);
                R.triggerShake(usedCombo >= 2 ? 0.065 : 0.035, 0.16);
                spawnFloatingText(pos.x, pos.y - 10, '-' + dmg, '');

                if (enemy.hp === 0) {
                    const excess = dmg - prevHp;
                    const isOverkill = excess >= 8 || (prevHp > 0 && usedCombo >= 2 && excess >= 4);
                    let bonusXp = 0;
                    let bonusVr = 0;
                    if (isOverkill) {
                        overkillTriggered = true;
                        state.overkills += 1;
                        bonusXp = 15;
                        bonusVr = 10;
                    }

                    state.kills += 1;
                    state.vr += enemy.vr + bonusVr;
                    if (enemy.isBoss) state.bossDefeated = true;

                    A.play('death');
                    spawnXpParticles(pos.x, pos.y, enemy.xp + bonusXp);
                }
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

        state.combo += 1;
        setLog(logMsg);

        getTargetEnemy();
        R.syncState(state);
        renderAll(true);

        const remaining = state.enemies.filter(e => e.hp > 0);
        if (remaining.length === 0) {
            finishEncounter();
        }
        return true;
    }

    function playAllCards() {
        if (state.mode !== 'combat' || state.busy) return;
        const playableExists = state.hand.some(id => D.CARDS[id].cost <= state.mana);
        if (!playableExists) {
            setLog('Sem Cafeina suficiente. Clique em Fim do Turno!');
            return;
        }

        state.busy = true;
        renderCombatControls();

        function stepNext() {
            if (state.mode !== 'combat') {
                state.busy = false;
                return;
            }
            const idx = state.hand.findIndex(id => D.CARDS[id].cost <= state.mana);
            if (idx < 0 || state.enemies.every(e => e.hp <= 0)) {
                state.busy = false;
                renderAll();
                if (state.pendingLevelUps > 0 && state.mode === 'explore') {
                    openLevelUpModal();
                }
                return;
            }
            state.busy = false;
            playCard(idx);
            if (state.mode === 'combat' && state.enemies.some(e => e.hp > 0)) {
                state.busy = true;
                renderCombatControls();
                setTimeout(stepNext, 220);
            }
        }

        stepNext();
    }

    function endTurn() {
        if (state.mode !== 'combat' || state.busy) return;
        A.unlock();
        R.setHoveredCard(null);
        state.busy = true;
        renderCombatControls();

        const alive = state.enemies.filter(e => e.hp > 0);
        let idx = 0;

        function nextEnemyAction() {
            if (state.mode !== 'combat') {
                state.busy = false;
                return;
            }
            if (idx >= alive.length) {
                state.mana = state.maxMana;
                state.combo = 1;
                state.shield = 0;
                while (state.hand.length > 0) {
                    state.discardPile.push(state.hand.pop());
                }
                drawCards(4);
                state.busy = false;
                A.play('card');
                setLog('Novo turno! Cafeina recarregada e Combo reiniciado.');
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
                setTimeout(nextEnemyAction, 320);
                return;
            }

            R.triggerEnemyAttackAnim(enemy.uid);
            let dmg = enemy.atk;
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
            }

            setLog(enemy.name + ' (' + enemy.origin + '): ' + D.ENEMIES[enemy.kind].quip);
            renderHud();

            if (state.hp <= 0) {
                state.busy = false;
                endGame(false);
                return;
            }

            setTimeout(nextEnemyAction, 380);
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

            if (state.bossDefeated) {
                setLog('VITORIA! O Lich caiu! Avance ate o Portal das 18h para bater o ponto!');
            } else {
                setLog('Horda dispersada! Continue explorando o andar.');
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
            els.endTitle.textContent = 'EXPEDIENTE ENCERRADO! VOCE VENCEU!';
            els.endDesc.textContent =
                'Voce derrotou o Lich das Planilhas, sobreviveu a masmorra corporativa e bateu o ponto as 18h!';
        } else {
            A.play('defeat');
            els.endTitle.textContent = 'BURNOUT TOTAL...';
            els.endDesc.textContent =
                'Sua Sanidade chegou a zero. O RH te convocou para uma reuniao eterna.';
        }
        els.endStats.textContent =
            'LV ' + state.level + '  |  VR: ' + state.vr +
            '  |  Abates: ' + state.kills + '  |  Overkills: ' + state.overkills;
        els.endModal.classList.remove('hidden');
        renderAll();
    }

    // ---------- RENDERIZAÇÃO DA UI ----------

    function renderHud() {
        const xpPct = Math.min(100, Math.round((state.xp / state.xpNext) * 100));
        els.xpFill.style.width = xpPct + '%';
        els.statLv.textContent = String(state.level);
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

        const canPlayAny = !state.busy && state.hand.some(id => D.CARDS[id].cost <= state.mana);
        els.btnPlayAll.disabled = !canPlayAny;
        els.btnEndTurn.disabled = state.busy;

        els.handGrid.innerHTML = '';
        state.hand.forEach((cardId, idx) => {
            const card = D.CARDS[cardId];
            const dmg = computeCardDamage(card);
            const desc = card.desc.replace('{DMG}', String(dmg));
            let powerTag = '';
            if (dmg > 0) powerTag = String(dmg);
            else if (card.shield > 0) powerTag = '+' + card.shield;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card-btn ' + card.type;
            btn.disabled = state.busy || state.mana < card.cost;
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
        els.endModal.classList.add('hidden');
        state = createInitialState();
        R.setHoveredCard(null);
        R.buildMap(D.MAP_LAYOUT, state);
        R.syncState(state);
        setLog('Voce passou pela catraca. Explore as baias ate derrotar o Lich das Planilhas!');
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

    els.btnMute.addEventListener('click', () => {
        const isMuted = A.toggleMute();
        els.iconSoundOn.classList.toggle('hidden', isMuted);
        els.iconSoundOff.classList.toggle('hidden', !isMuted);
    });
    els.btnRestart.addEventListener('click', startNewGame);
    els.btnPlayAgain.addEventListener('click', startNewGame);

    window.addEventListener('keydown', ev => {
        if (state.mode === 'levelup' || state.mode === 'gameover') return;

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
            if (ev.key >= '1' && ev.key <= '4') {
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

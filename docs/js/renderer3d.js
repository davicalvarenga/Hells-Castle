// Renderizador 2.5D Pixel Art em Primeira Pessoa (Three.js com fallback 2D) + Minimapa Pergaminho.
(function () {
    'use strict';

    const INTERNAL_HEIGHT = 270;
    const WALL_HEIGHT = 1.6;
    const DIR_DX = [0, 1, 0, -1];
    const DIR_DY = [-1, 0, 1, 0];

    let glCanvas = null;
    let hudCanvas = null;
    let hctx = null;
    let miniCanvas = null;
    let mctx = null;

    let renderer = null;
    let scene = null;
    let camera = null;
    let webglOk = false;

    let viewW = 0;
    let viewH = 0;
    let dpr = 1;

    let mapGrid = [];
    let mapCols = 0;
    let mapRows = 0;

    let camX = 0;
    let camZ = 0;
    let camYaw = 0;
    let targetCamX = 0;
    let targetCamZ = 0;
    let targetCamYaw = 0;
    let ambientLight = null;
    let playerLight = null;
    let stepBob = 0;
    let shakeMag = 0;
    let shakeTime = 0;
    let screenFlash = { color: '#ff3a2a', alpha: 0, maxAlpha: 0, time: 0, dur: 1 };
    let edgeFlash = { rgb: '216,40,30', alpha: 0, maxAlpha: 0, time: 0, dur: 1 };
    let camTurnRate = 14;
    let camY = 0.68;

    const CAM_HEIGHT_EXPLORE = 0.68;
    const CAM_HEIGHT_COMBAT = 0.52;   // câmera um pouco mais baixa: horda compacta fica na altura dos olhos
    // Formação compacta em "V" / duas fileiras dentro do corredor (largura do corredor = 1 tile).
    // x = deslocamento lateral, z = distância da câmera, w = largura do sprite (escala 1.0).
    // O centro de cada sprite fica em |x| <= 0.29 e a borda nunca passa de CORRIDOR_HALF_SAFE.
    const CORRIDOR_HALF_SAFE = 0.44;
    const MAX_COMBAT_DEPTH = 1.42;    // < 1.5: nunca atrás da parede que fecha o tile à frente
    const FORMATIONS = {
        1: [{ x: 0, z: 1.05, w: 0.62 }],
        2: [{ x: -0.2, z: 0.95, w: 0.44 }, { x: 0.2, z: 1.1, w: 0.44 }],
        3: [{ x: -0.28, z: 0.78, w: 0.32 }, { x: 0, z: 1.28, w: 0.56 }, { x: 0.28, z: 0.78, w: 0.32 }],
        4: [{ x: -0.29, z: 0.78, w: 0.3 }, { x: -0.15, z: 1.3, w: 0.4 }, { x: 0.15, z: 1.3, w: 0.4 }, { x: 0.29, z: 0.78, w: 0.3 }]
    };

    function getFormationSlot(count, idx) {
        const f = FORMATIONS[count];
        if (f) return f[idx];
        // Fallback genérico (5+): zigue-zague em duas fileiras
        const t = count === 1 ? 0 : (idx / (count - 1)) * 2 - 1;
        return { x: t * 0.3, z: idx % 2 === 0 ? 0.78 : 1.3, w: Math.max(0.2, 0.9 / count) };
    }

    function isWallAt(x, z) {
        const gx = Math.round(x);
        const gy = Math.round(z);
        if (gy < 0 || gy >= mapRows || gx < 0 || gx >= mapCols) return true;
        return mapGrid[gy][gx] === '#';
    }

    // Tempos (s) da animação de ataque: antecipação -> investida/projétil -> retorno
    const ATK_ANTICIPATION = 0.15;
    const ATK_STRIKE = 0.2;
    const ATK_RECOVER = 0.24;
    const DEATH_DURATION = 0.72;

    const torches = [];
    const worldPickups = new Map();
    const combatSprites = new Map();
    const encounterSprites = new Map();
    const enemyHitboxes = [];
    const projectiles = [];
    const hudParticles = [];
    let encounterAlert = null;

    let currentState = null;
    let hoveredCard = null;
    let onSelectEnemy = null;
    let rafId = 0;
    let lastTime = 0;
    const tmpVec = new (window.THREE ? window.THREE.Vector3 : function () {
        this.x = 0; this.y = 0; this.z = 0;
    })();

    function clamp(v, a, b) {
        return Math.max(a, Math.min(b, v));
    }

    function makeTexture(canvas, repeatX, repeatY) {
        const THREE = window.THREE;
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        if (THREE.SRGBColorSpace) {
            tex.colorSpace = THREE.SRGBColorSpace;
        }
        if (repeatX || repeatY) {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(repeatX || 1, repeatY || 1);
        }
        return tex;
    }

    function init(opts) {
        glCanvas = opts.glCanvas;
        hudCanvas = opts.hudCanvas;
        miniCanvas = opts.miniCanvas;
        onSelectEnemy = opts.onSelectEnemy;
        hctx = hudCanvas.getContext('2d');
        mctx = miniCanvas.getContext('2d');

        if (window.THREE) {
            try {
                renderer = new window.THREE.WebGLRenderer({
                    canvas: glCanvas,
                    antialias: false,
                    powerPreference: 'default'
                });
                renderer.setPixelRatio(1);
                renderer.setClearColor(0x161224, 1);

                scene = new window.THREE.Scene();
                scene.fog = new window.THREE.Fog(0x161224, 2.8, 9.5);

                camera = new window.THREE.PerspectiveCamera(72, 16 / 9, 0.08, 22);
                camera.rotation.order = 'YXZ';
                webglOk = true;
            } catch (e) {
                webglOk = false;
                renderer = null;
            }
        }

        hudCanvas.addEventListener('click', handleHudClick);
        lastTime = performance.now();
        if (!rafId) {
            rafId = requestAnimationFrame(loop);
        }
    }

    function handleHudClick(ev) {
        if (!currentState || currentState.mode !== 'combat' || !onSelectEnemy) return;
        const rect = hudCanvas.getBoundingClientRect();
        const cx = ev.clientX - rect.left;
        const cy = ev.clientY - rect.top;
        for (let i = enemyHitboxes.length - 1; i >= 0; i--) {
            const b = enemyHitboxes[i];
            if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
                onSelectEnemy(b.id);
                return;
            }
        }
    }

    function buildMap(layout, state) {
        mapGrid = layout;
        mapRows = layout.length;
        mapCols = layout[0].length;
        currentState = state;

        camX = state.player.x;
        camZ = state.player.y;
        targetCamX = camX;
        targetCamZ = camZ;
        camYaw = -state.player.dir * (Math.PI / 2);
        targetCamYaw = camYaw;

        if (!webglOk) {
            encounterSprites.clear();
            encounterAlert = null;
            buildEncounterSprites(state);
            return;
        }
        const THREE = window.THREE;

        const floorNum = (state && state.floor) || 1;
        const floorColors = {
            1: { bg: 0x161224, amb: 0xc8c2e8, hemiSky: 0xd0d8ff, hemiGnd: 0x3a2d4c, torch: 0xffaa44, player: 0xffe6c4 },
            2: { bg: 0x0f1f18, amb: 0xaee6c4, hemiSky: 0xb6ffd4, hemiGnd: 0x223d2d, torch: 0x7eff9e, player: 0xd9ffe8 },
            3: { bg: 0x220d12, amb: 0xf2c2b6, hemiSky: 0xffe1a8, hemiGnd: 0x451a22, torch: 0xffc644, player: 0xffe8ba }
        };
        const fc = floorColors[floorNum] || floorColors[1];
        renderer.setClearColor(fc.bg, 1);
        scene.fog = new THREE.Fog(fc.bg, 2.8, 9.5);

        while (scene.children.length > 0) {
            scene.remove(scene.children[0]);
        }
        torches.length = 0;
        worldPickups.clear();
        combatSprites.clear();
        encounterSprites.clear();
        projectiles.length = 0;
        hudParticles.length = 0;
        encounterAlert = null;

        ambientLight = new THREE.AmbientLight(fc.amb, 2.1);
        scene.add(ambientLight);
        scene.add(new THREE.HemisphereLight(fc.hemiSky, fc.hemiGnd, 1.15));

        playerLight = new THREE.PointLight(fc.player, 3.6, 7.5, 1.1);
        playerLight.position.set(camX, 0.95, camZ);
        scene.add(playerLight);

        const floorTex = makeTexture(window.GameSprites.makeFloorTexture(floorNum), mapCols, mapRows);
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(mapCols, mapRows),
            new THREE.MeshLambertMaterial({ map: floorTex })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.set((mapCols - 1) / 2, 0, (mapRows - 1) / 2);
        scene.add(floor);

        const ceilTex = makeTexture(window.GameSprites.makeCeilingTexture(floorNum), mapCols, mapRows);
        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(mapCols, mapRows),
            new THREE.MeshLambertMaterial({ map: ceilTex })
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set((mapCols - 1) / 2, WALL_HEIGHT, (mapRows - 1) / 2);
        scene.add(ceiling);

        const wallMats = [0, 1, 2, 3, 4, 5].map(v =>
            new THREE.MeshLambertMaterial({ map: makeTexture(window.GameSprites.makeWallTexture(v, floorNum)) })
        );
        const wallGeo = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);

        const torchFrames = [0, 1, 2].map(v => makeTexture(window.GameSprites.makeTorchCanvas(v)));
        let torchCount = 0;

        for (let y = 0; y < mapRows; y++) {
            for (let x = 0; x < mapCols; x++) {
                const ch = layout[y][x];
                if (ch === '#') {
                    const mat = wallMats[(x * 7 + y * 13) % wallMats.length];
                    const wall = new THREE.Mesh(wallGeo, mat);
                    wall.position.set(x, WALL_HEIGHT / 2, y);
                    scene.add(wall);
                } else {
                    const shouldTorch = ((x + y) % 4 === 0) && torchCount < 10;
                    if (shouldTorch) {
                        const adjWall = findAdjacentWallOffset(x, y);
                        if (adjWall) {
                            torchCount++;
                            const flame = new THREE.Sprite(
                                new THREE.SpriteMaterial({
                                    map: torchFrames[0],
                                    transparent: true,
                                    alphaTest: 0.4,
                                    fog: false
                                })
                            );
                            flame.scale.set(0.24, 0.34, 1);
                            flame.position.set(x + adjWall[0] * 0.42, 1.04, y + adjWall[1] * 0.42);
                            scene.add(flame);

                            const stick = new THREE.Mesh(
                                new THREE.BoxGeometry(0.05, 0.22, 0.05),
                                new THREE.MeshLambertMaterial({ color: 0x4b2f1b })
                            );
                            stick.position.set(x + adjWall[0] * 0.45, 0.84, y + adjWall[1] * 0.45);
                            scene.add(stick);

                            const light = new THREE.PointLight(fc.torch, 4.2, 6.0, 1.2);
                            light.position.set(x + adjWall[0] * 0.22, 1.05, y + adjWall[1] * 0.22);
                            scene.add(light);
                            torches.push({
                                flame: flame,
                                light: light,
                                frames: torchFrames,
                                seed: x * 3.1 + y * 1.7
                            });
                        }
                    }

                    if (ch === 'C') {
                        addWorldSprite(x, y, 'chest', 0.68);
                    } else if (ch === 'M') {
                        addWorldSprite(x, y, 'vending', 0.9);
                    } else if (ch === '?') {
                        addWorldSprite(x, y, 'event_q', 0.78);
                    } else if (ch === 'E') {
                        addWorldSprite(x, y, 'exit', 0.94);
                    }
                }
            }
        }

        buildEncounterSprites(state);
    }

    // Encontros são entidades móveis (patrulha): um sprite por encontro, com posição interpolada.
    function buildEncounterSprites(state) {
        const list = (state && state.encounters) || [];
        list.forEach(enc => {
            const kinds = enc.enc && enc.enc.enemies ? enc.enc.enemies : ['goblin'];
            const previewKind = enc.isBoss ? kinds[Math.floor(kinds.length / 2)] : kinds[0];
            // largura < 1 tile para o billboard nunca entrar nas paredes laterais
            const baseScale = enc.isBoss ? 0.95 : 0.88;
            let sprite = null;
            if (webglOk) {
                const THREE = window.THREE;
                const sheet = window.GameSprites.getSheet(previewKind);
                sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                    map: makeTexture(sheet.normal),
                    transparent: true,
                    alphaTest: 0.1,
                    fog: false
                }));
                sprite.center.set(0.5, 0);
                sprite.scale.set(baseScale, baseScale, 1);
                sprite.position.set(enc.x, 0.02, enc.y);
                scene.add(sprite);
            }
            encounterSprites.set(enc.id, {
                sprite: sprite,
                baseScale: baseScale,
                isBoss: !!enc.isBoss,
                x: enc.x,
                z: enc.y,
                tx: enc.x,
                tz: enc.y,
                alive: enc.alive !== false,
                phase: Math.random() * Math.PI * 2,
                rate: 0.85 + Math.random() * 0.3
            });
        });
    }

    function findAdjacentWallOffset(x, y) {
        const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        for (const d of dirs) {
            const nx = x + d[0];
            const ny = y + d[1];
            if (ny >= 0 && ny < mapRows && nx >= 0 && nx < mapCols && mapGrid[ny][nx] === '#') {
                return d;
            }
        }
        return null;
    }

    function addWorldSprite(x, y, kind, scale) {
        if (!webglOk) return;
        const THREE = window.THREE;
        const sheet = window.GameSprites.getSheet(kind);
        const mat = new THREE.SpriteMaterial({
            map: makeTexture(sheet.normal),
            transparent: true,
            alphaTest: 0.1,
            fog: false
        });
        const sp = new THREE.Sprite(mat);
        sp.center.set(0.5, 0);
        sp.scale.set(scale, scale, 1);
        sp.position.set(x, 0.02, y);
        scene.add(sp);
        worldPickups.set(x + ',' + y, { sprite: sp, kind: kind, baseScale: scale });
    }

    function syncState(state) {
        currentState = state;
        targetCamX = state.player.x;
        targetCamZ = state.player.y;

        for (const [key, obj] of worldPickups.entries()) {
            const cleared = state.clearedTiles.has(key);
            if (obj.kind === 'vending') {
                obj.sprite.visible = state.mode !== 'combat';
            } else {
                obj.sprite.visible = !cleared && state.mode !== 'combat';
            }
        }

        (state.encounters || []).forEach(enc => {
            const entry = encounterSprites.get(enc.id);
            if (!entry) return;
            entry.tx = enc.x;
            entry.tz = enc.y;
            entry.alive = enc.alive !== false;
            if (entry.sprite) {
                entry.sprite.visible = entry.alive && state.mode !== 'combat';
            }
        });

        syncCombatSprites(state);
    }

    function setHoveredCard(card) {
        hoveredCard = card || null;
    }

    function turnCamera(deltaDir, smooth) {
        targetCamYaw -= deltaDir * (Math.PI / 2);
        if (smooth) camTurnRate = 6.5;
    }

    // Assenta a câmera no alvo (usado ao iniciar o combate, para a formação já nascer alinhada
    // ao corredor mesmo se o giro ainda não tiver terminado em máquinas lentas).
    function settleCamera() {
        camYaw = targetCamYaw;
        camX = targetCamX;
        camZ = targetCamZ;
        camTurnRate = 14;
    }

    function showEncounterAlert(encId, dur) {
        encounterAlert = { id: encId, time: dur || 0.7, dur: dur || 0.7 };
    }

    function triggerEdgeFlash(rgb, alpha, dur) {
        edgeFlash.rgb = rgb || '216,40,30';
        edgeFlash.maxAlpha = alpha || 0.7;
        edgeFlash.alpha = edgeFlash.maxAlpha;
        edgeFlash.dur = dur || 0.4;
        edgeFlash.time = edgeFlash.dur;
    }

    // Partículas quadradas (pixel) no canvas da HUD. x/y em coordenadas locais do viewport.
    function spawnBurstLocal(x, y, colors, count, opts) {
        const o = opts || {};
        const n = count || 12;
        for (let i = 0; i < n; i++) {
            const ang = o.upward
                ? -Math.PI / 2 + (Math.random() - 0.5) * 1.7
                : Math.random() * Math.PI * 2;
            const speed = (o.speed || 150) * (0.45 + Math.random() * 0.75);
            const life = (o.life || 0.6) * (0.7 + Math.random() * 0.5);
            hudParticles.push({
                x: x + (Math.random() - 0.5) * (o.spread || 30),
                y: y + (Math.random() - 0.5) * (o.spread || 30),
                vx: Math.cos(ang) * speed,
                vy: Math.sin(ang) * speed,
                gravity: o.gravity == null ? 220 : o.gravity,
                life: life,
                max: life,
                size: (o.size || 6) * (0.7 + Math.random() * 0.6),
                color: colors[i % colors.length]
            });
        }
        if (hudParticles.length > 260) hudParticles.splice(0, hudParticles.length - 260);
    }

    function spawnBurst(clientX, clientY, colors, count, opts) {
        const rect = hudCanvas.getBoundingClientRect();
        spawnBurstLocal(clientX - rect.left, clientY - rect.top, colors, count, opts);
    }

    function enemyLocalPos(entry, height) {
        if (webglOk && entry) {
            const p = project3D(entry.curX, height, entry.curZ);
            if (p) return p;
        }
        return { x: viewW / 2, y: viewH * 0.45, s: viewH * 0.3 };
    }

    function triggerStepBob() {
        stepBob = 1;
    }

    function triggerShake(mag, dur) {
        shakeMag = Math.max(shakeMag, mag || 0.06);
        shakeTime = Math.max(shakeTime, dur || 0.2);
    }

    function triggerScreenFlash(color, alpha, dur) {
        screenFlash.color = color || '#ff3a2a';
        screenFlash.maxAlpha = alpha || 0.35;
        screenFlash.alpha = screenFlash.maxAlpha;
        screenFlash.dur = dur || 0.26;
        screenFlash.time = screenFlash.dur;
    }

    function triggerEnemyHitAnim(enemyId, isCrit) {
        const entry = combatSprites.get(enemyId);
        if (!entry) return;
        entry.anim.hurt = 1;
        entry.anim.white = isCrit ? 1 : 0.75;
        entry.anim.shake = 0.25;
    }

    // style: 'lunge' (investida até a câmera), 'paper' (planilha arremessada) ou 'wave' (onda sônica)
    function triggerEnemyAttackAnim(enemyId, style) {
        const entry = combatSprites.get(enemyId);
        if (!entry) return;
        entry.anim.atk = 0;
        entry.anim.atkStyle = style || 'lunge';
        entry.anim.projFired = false;
    }

    // Salto com partículas (buff do Cultista, Ata da Carmem, invocação do CEO)
    function triggerEnemyBuffAnim(enemyId, palette) {
        const entry = combatSprites.get(enemyId);
        if (!entry) return;
        entry.anim.buff = 1;
        const p = enemyLocalPos(entry, 0.1 + 0.5 * entry.scale);
        const colors = palette === 'gold'
            ? ['#ffd147', '#fff2a8', '#f59e0b', '#c084fc']
            : ['#c084fc', '#a855f7', '#e9d5ff', '#ffd147'];
        spawnBurstLocal(p.x, p.y, colors, 22, { upward: true, speed: 210, life: 0.7, size: 7, spread: 60, gravity: 160 });
    }

    function getAttackTimings() {
        return {
            anticipation: ATK_ANTICIPATION * 1000,
            strike: ATK_STRIKE * 1000,
            impact: (ATK_ANTICIPATION + ATK_STRIKE) * 1000,
            death: DEATH_DURATION * 1000
        };
    }

    function syncCombatSprites(state) {
        if (!webglOk) return;
        const THREE = window.THREE;

        if (state.mode !== 'combat') {
            for (const entry of combatSprites.values()) {
                scene.remove(entry.group);
            }
            combatSprites.clear();
            return;
        }

        const activeIds = new Set(state.enemies.map(e => e.uid));
        for (const [uid, entry] of combatSprites.entries()) {
            if (!activeIds.has(uid)) {
                scene.remove(entry.group);
                combatSprites.delete(uid);
            }
        }

        const count = state.enemies.length;
        const dir = state.player.dir;
        const fx = DIR_DX[dir];
        const fz = DIR_DY[dir];
        const rx = -fz;
        const rz = fx;

        state.enemies.forEach((enemy, idx) => {
            let entry = combatSprites.get(enemy.uid);
            if (!entry) {
                const sheet = window.GameSprites.getSheet(enemy.kind);
                const group = new THREE.Group();

                const makePart = (canvas, extra) => {
                    const m = new THREE.SpriteMaterial(Object.assign({
                        map: makeTexture(canvas),
                        transparent: true,
                        alphaTest: 0.08,
                        fog: false,
                        depthTest: false
                    }, extra || {}));
                    const s = new THREE.Sprite(m);
                    s.center.set(0.5, 0);
                    return s;
                };

                const main = makePart(sheet.normal);
                const red = makePart(sheet.red, { depthWrite: false });
                const white = makePart(sheet.white, { depthWrite: false });
                main.renderOrder = 10;
                red.renderOrder = 11;
                white.renderOrder = 12;
                red.material.opacity = 0;
                white.material.opacity = 0;

                const shadow = new THREE.Mesh(
                    new THREE.CircleGeometry(0.25, 12),
                    new THREE.MeshBasicMaterial({
                        color: 0x000000,
                        transparent: true,
                        opacity: 0.45,
                        depthWrite: false,
                        depthTest: false
                    })
                );
                shadow.renderOrder = 9;
                shadow.rotation.x = -Math.PI / 2;
                shadow.position.y = 0.015;

                group.add(shadow, main, red, white);
                scene.add(group);
                entry = {
                    group: group,
                    main: main,
                    red: red,
                    white: white,
                    shadow: shadow,
                    scale: 0.5,
                    slotX: 0,
                    slotZ: 1,
                    curX: null,
                    curZ: null,
                    anim: {
                        hurt: 0, white: 0, shake: 0, death: 0, buff: 0,
                        atk: -1, atkStyle: 'lunge', projFired: false,
                        spawn: enemy.summoned ? 1 : 0,
                        // fase e ritmo aleatórios para os inimigos não respirarem em sincronia
                        phase: Math.random() * Math.PI * 2,
                        rate: 0.8 + Math.random() * 0.4
                    }
                };
                combatSprites.set(enemy.uid, entry);
            }

            // Formação compacta: tudo dentro do tile livre à frente do jogador.
            const slot = getFormationSlot(count, idx);
            const aheadFree = !isWallAt(state.player.x + fx, state.player.y + fz);
            const depthK = aheadFree ? 1 : 0.3;
            const lateral = slot.x;
            const dist = Math.min(MAX_COMBAT_DEPTH, slot.z) * depthK;
            // largura limitada para a borda do sprite não encostar na parede lateral
            const width = Math.min(slot.w * (enemy.scale || 1), 2 * (CORRIDOR_HALF_SAFE - Math.abs(lateral)) / 1.12);
            entry.scale = width;
            entry.slotX = lateral;
            entry.slotZ = dist;
            entry.rightX = rx;
            entry.rightZ = rz;
            entry.shadow.scale.setScalar(width / 0.62);
            // fileira da frente desenha por cima da de trás (sprites sem depthTest)
            entry.rank = Math.round((2 - dist) * 10) * 3;
            entry.baseX = state.player.x + fx * dist + rx * lateral;
            entry.baseZ = state.player.y + fz * dist + rz * lateral;
            if (entry.curX === null) {
                entry.curX = entry.baseX;
                entry.curZ = entry.baseZ;
            }
            entry.alive = enemy.hp > 0;
        });
    }

    function resize() {
        const w = hudCanvas.clientWidth;
        const h = hudCanvas.clientHeight;
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        if (w === viewW && h === viewH && ratio === dpr) return;
        viewW = w;
        viewH = h;
        dpr = ratio;
        if (w <= 0 || h <= 0) return;

        hudCanvas.width = Math.round(w * dpr);
        hudCanvas.height = Math.round(h * dpr);

        if (webglOk && renderer && camera) {
            const ih = INTERNAL_HEIGHT;
            const iw = Math.max(2, Math.round((ih * w) / h));
            renderer.setSize(iw, ih, false);
            camera.aspect = w / h;
            camera.fov = w / h < 1.15 ? 78 : 70;
            camera.updateProjectionMatrix();
        }
    }

    function project3D(wx, wy, wz) {
        if (!webglOk || !camera) return null;
        tmpVec.set(wx, wy, wz).applyMatrix4(camera.matrixWorldInverse);
        const depth = -tmpVec.z;
        if (depth < 0.1) return null;
        tmpVec.applyMatrix4(camera.projectionMatrix);
        return {
            x: (tmpVec.x * 0.5 + 0.5) * viewW,
            y: (-tmpVec.y * 0.5 + 0.5) * viewH,
            s: (viewH / 2) / Math.tan((camera.fov * Math.PI) / 360) / depth
        };
    }

    function drawOutlined(text, x, y, size, color, align) {
        hctx.font = Math.round(size) + 'px "Jersey 15", monospace';
        hctx.textAlign = align || 'center';
        hctx.textBaseline = 'middle';
        hctx.lineJoin = 'round';
        hctx.lineWidth = Math.max(3, size * 0.22);
        hctx.strokeStyle = '#0d0812';
        hctx.strokeText(text, x, y);
        hctx.fillStyle = color;
        hctx.fillText(text, x, y);
    }

    // Ícones pixel art desenhados diretamente no canvas (zero emojis)
    function drawPixelArrowDown(cx, cy) {
        hctx.fillStyle = '#0b0710';
        hctx.fillRect(cx - 7, cy - 4, 14, 3);
        hctx.fillRect(cx - 5, cy - 1, 10, 3);
        hctx.fillRect(cx - 3, cy + 2, 6, 3);
        hctx.fillStyle = '#f5cb5c';
        hctx.fillRect(cx - 5, cy - 3, 10, 2);
        hctx.fillRect(cx - 3, cy - 1, 6, 2);
        hctx.fillRect(cx - 1, cy + 1, 2, 2);
    }

    function drawPixelSword(cx, cy) {
        hctx.fillStyle = '#0b0710';
        hctx.fillRect(cx - 5, cy - 5, 11, 11);
        hctx.fillStyle = '#e8effa';
        hctx.fillRect(cx + 2, cy - 4, 2, 2);
        hctx.fillRect(cx, cy - 2, 2, 2);
        hctx.fillRect(cx - 2, cy, 2, 2);
        hctx.fillStyle = '#f5cb5c';
        hctx.fillRect(cx - 4, cy + 1, 4, 2);
        hctx.fillRect(cx - 3, cy + 2, 2, 2);
    }

    function drawPixelStun(cx, cy) {
        hctx.fillStyle = '#0b0710';
        hctx.fillRect(cx - 5, cy - 5, 10, 10);
        hctx.fillStyle = '#69c8f0';
        hctx.fillRect(cx - 1, cy - 4, 2, 8);
        hctx.fillRect(cx - 4, cy - 1, 8, 2);
        hctx.fillStyle = '#ffffff';
        hctx.fillRect(cx - 1, cy - 1, 2, 2);
    }

    function drawReticle(cx, cy, size, now, isAll) {
        const pulse = Math.sin(now / 110) * 5;
        const r = size * 0.44 + pulse;
        const len = Math.max(10, r * 0.35);
        hctx.save();
        hctx.strokeStyle = isAll ? '#ff6b4a' : '#f5cb5c';
        hctx.lineWidth = 3;

        hctx.beginPath();
        hctx.moveTo(cx - r, cy - r + len); hctx.lineTo(cx - r, cy - r); hctx.lineTo(cx - r + len, cy - r);
        hctx.moveTo(cx + r - len, cy - r); hctx.lineTo(cx + r, cy - r); hctx.lineTo(cx + r, cy - r + len);
        hctx.moveTo(cx - r, cy + r - len); hctx.lineTo(cx - r, cy + r); hctx.lineTo(cx - r + len, cy + r);
        hctx.moveTo(cx + r - len, cy + r); hctx.lineTo(cx + r, cy + r); hctx.lineTo(cx + r, cy + r - len);
        hctx.stroke();

        hctx.strokeStyle = 'rgba(255, 80, 60, 0.85)';
        hctx.lineWidth = 2;
        hctx.beginPath();
        hctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
        hctx.moveTo(cx - r * 0.65, cy); hctx.lineTo(cx - r * 0.25, cy);
        hctx.moveTo(cx + r * 0.25, cy); hctx.lineTo(cx + r * 0.65, cy);
        hctx.moveTo(cx, cy - r * 0.65); hctx.lineTo(cx, cy - r * 0.25);
        hctx.moveTo(cx, cy + r * 0.25); hctx.lineTo(cx, cy + r * 0.65);
        hctx.stroke();
        hctx.restore();
    }

    function renderFallback2D(now) {
        const W = viewW;
        const H = viewH;
        const grad = hctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#161224');
        grad.addColorStop(0.5, '#2b223d');
        grad.addColorStop(1, '#1a1426');
        hctx.fillStyle = grad;
        hctx.fillRect(0, 0, W, H);

        hctx.strokeStyle = '#574870';
        hctx.lineWidth = 2;
        hctx.strokeRect(W * 0.2, H * 0.18, W * 0.6, H * 0.56);
        hctx.beginPath();
        hctx.moveTo(0, 0); hctx.lineTo(W * 0.2, H * 0.18);
        hctx.moveTo(W, 0); hctx.lineTo(W * 0.8, H * 0.18);
        hctx.moveTo(0, H); hctx.lineTo(W * 0.2, H * 0.74);
        hctx.moveTo(W, H); hctx.lineTo(W * 0.8, H * 0.74);
        hctx.stroke();

        if (currentState && currentState.mode === 'combat') {
            const count = currentState.enemies.length;
            currentState.enemies.forEach((e, idx) => {
                if (e.hp <= 0) return;
                const sx = count === 1 ? W * 0.5 : W * (0.22 + (idx / (count - 1)) * 0.56);
                const sy = H * 0.66;
                const sz = Math.min(W, H) * 0.27 * (e.scale || 1);
                const sheet = window.GameSprites.getSheet(e.kind);
                hctx.imageSmoothingEnabled = false;
                const bob = Math.sin(now / 260 + idx) * 4;
                hctx.drawImage(sheet.normal, sx - sz / 2, sy - sz + bob, sz, sz);
            });
        }
    }

    function drawCombatHud(now) {
        enemyHitboxes.length = 0;
        if (!currentState || currentState.mode !== 'combat') return;

        const enemies = currentState.enemies;
        const count = enemies.length;
        const items = [];

        enemies.forEach((enemy, idx) => {
            if (enemy.hp <= 0) return;

            let sx = viewW * 0.5;
            let topY = viewH * 0.3;
            let botY = viewH * 0.68;
            let scalePx = viewH * 0.36;

            const entry = combatSprites.get(enemy.uid);
            if (webglOk && entry) {
                const top = project3D(entry.curX, 0.1 + entry.scale * 1.02, entry.curZ);
                const bot = project3D(entry.curX, 0.1, entry.curZ);
                if (top && bot) {
                    sx = top.x;
                    topY = top.y;
                    botY = bot.y;
                    scalePx = Math.max(60, bot.y - top.y);
                }
            } else {
                sx = count === 1 ? viewW * 0.5 : viewW * (0.22 + (idx / (count - 1)) * 0.56);
                topY = viewH * 0.28;
                botY = viewH * 0.66;
                scalePx = viewH * 0.28;
            }

            const bw = clamp(scalePx * 0.62, 62, 132);
            const nameSize = clamp(bw * 0.15, 12, 18);
            hctx.font = Math.round(nameSize) + 'px "Jersey 15", monospace';
            const nameW = hctx.measureText(enemy.name).width;
            items.push({
                enemy: enemy,
                sx: sx,
                topY: topY,
                botY: botY,
                scalePx: scalePx,
                bw: bw,
                nameSize: nameSize,
                // bloco do label: nome + barra de HP + intenção
                labelW: Math.max(bw, nameW) + 10,
                cx: clamp(sx, Math.max(bw, nameW) * 0.5 + 8, viewW - Math.max(bw, nameW) * 0.5 - 8),
                by: clamp(topY - 30, 74, viewH * 0.52)
            });
        });

        // Evita sobreposição de nome/HP com 3-4 inimigos: quem colide sobe um "andar" de label.
        const LABEL_H = 50;
        const placed = [];
        items.slice().sort((a, b) => b.by - a.by || a.sx - b.sx).forEach(it => {
            for (let tries = 0; tries < 6; tries++) {
                const hit = placed.some(o =>
                    Math.abs(o.cx - it.cx) < (o.labelW + it.labelW) * 0.5 &&
                    Math.abs(o.by - it.by) < LABEL_H);
                if (!hit) break;
                it.by -= LABEL_H;
            }
            it.by = Math.max(74, it.by);
            placed.push(it);
        });

        items.forEach(it => {
            const enemy = it.enemy;
            const sx = it.sx;
            const cx = it.cx;
            const bw = it.bw;
            const bh = 11;
            const by = it.by;
            const bx = cx - bw / 2;
            const isTarget = currentState.targetUid === enemy.uid;

            enemyHitboxes.push({
                id: enemy.uid,
                x: sx - it.scalePx * 0.4,
                y: Math.min(by - 26, it.topY),
                w: it.scalePx * 0.8,
                h: it.botY - Math.min(by - 26, it.topY)
            });

            if (hoveredCard && (hoveredCard.target === 'all' || (hoveredCard.target === 'single' && isTarget))) {
                const midY = (it.topY + it.botY) * 0.5;
                drawReticle(sx, midY, it.scalePx * 0.9, now, hoveredCard.target === 'all');
            }

            if (isTarget) {
                const pulse = Math.round(Math.sin(now / 150) * 3);
                drawPixelArrowDown(Math.round(cx), Math.round(by - 26 + pulse));
            }

            drawOutlined(enemy.name, cx, by - 11, it.nameSize, isTarget ? '#fff5d4' : '#efe6d8');

            hctx.fillStyle = '#0d0812';
            hctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
            hctx.fillStyle = '#3b1518';
            hctx.fillRect(bx, by, bw, bh);
            const hpPct = clamp(enemy.hp / enemy.maxHp, 0, 1);
            hctx.fillStyle = enemy.isBoss ? '#e84545' : '#d8452f';
            hctx.fillRect(bx, by, Math.max(2, bw * hpPct), bh);

            const hpText = enemy.shield > 0
                ? enemy.hp + '/' + enemy.maxHp + ' (+' + enemy.shield + ')'
                : enemy.hp + '/' + enemy.maxHp;
            drawOutlined(hpText, cx, by + bh / 2 + 1, 13, '#ffffff');

            const intentY = by + bh + 11;
            if (enemy.stunned) {
                drawPixelStun(Math.round(cx - 38), Math.round(intentY));
                drawOutlined('ATORDOADO', cx + 8, intentY, 13, '#69c8f0');
            } else {
                let tag = '';
                if (enemy.doubleIfUnshielded) tag = currentState.shield > 0 ? ' [BLOQ]' : 'x2 [DOBRO]';
                else if (enemy.curseCard) tag = ' [+ATA]';
                else if (enemy.buffAllies) tag = ' [+BUFF]';
                else if (enemy.immuneKnockback) tag = ' [IMUNE]';
                if (enemy.stunImmune > 0) tag = ' [IMUNE 1t]';
                const label = 'ATK ' + enemy.atk + tag;
                drawPixelSword(Math.round(cx - (tag ? 50 : 26)), Math.round(intentY));
                drawOutlined(label, cx + 8, intentY, 14, enemy.stunImmune > 0 ? '#69c8f0' : (enemy.isBoss ? '#ff9f68' : '#f0a03c'));
            }
        });

        drawProjectiles();
    }

    // Projéteis pixelados voando do inimigo até a tela (planilha / onda sônica)
    function drawProjectiles() {
        for (const pr of projectiles) {
            const p = clamp(pr.t / pr.dur, 0, 1);
            const ease = p * p;
            const tx = viewW * 0.5;
            const ty = viewH * 0.8;
            const x = pr.sx + (tx - pr.sx) * ease;
            const y = pr.sy + (ty - pr.sy) * ease - Math.sin(p * Math.PI) * viewH * 0.06;
            const size = 18 + ease * viewH * 0.34;

            hctx.save();
            hctx.translate(Math.round(x), Math.round(y));
            if (pr.kind === 'wave') {
                hctx.lineCap = 'butt';
                for (let i = 0; i < 3; i++) {
                    const r = size * (0.35 + i * 0.3);
                    hctx.strokeStyle = '#0d0812';
                    hctx.lineWidth = Math.max(6, size * 0.13);
                    hctx.beginPath();
                    hctx.arc(0, -size * 0.2, r, Math.PI * 0.18, Math.PI * 0.82);
                    hctx.stroke();
                    hctx.strokeStyle = i === 1 ? '#f5d0fe' : '#c084fc';
                    hctx.lineWidth = Math.max(3, size * 0.07);
                    hctx.beginPath();
                    hctx.arc(0, -size * 0.2, r, Math.PI * 0.18, Math.PI * 0.82);
                    hctx.stroke();
                }
            } else {
                // Folha de planilha girando em passos de 22.5 graus (aspecto pixelado)
                hctx.rotate(Math.floor(p * 14) * (Math.PI / 8));
                const w = size * 0.78;
                const h = size;
                const u = Math.max(2, Math.round(size / 14));
                hctx.fillStyle = '#0d0812';
                hctx.fillRect(-w / 2 - u, -h / 2 - u, w + u * 2, h + u * 2);
                hctx.fillStyle = '#f4f1e6';
                hctx.fillRect(-w / 2, -h / 2, w, h);
                hctx.fillStyle = '#1d6f42';
                hctx.fillRect(-w / 2, -h / 2, w, u * 2);
                hctx.fillStyle = '#9aa7b8';
                for (let ly = -h / 2 + u * 4; ly < h / 2 - u; ly += u * 3) {
                    hctx.fillRect(-w / 2 + u, ly, w - u * 2, u);
                }
                hctx.fillRect(-u / 2, -h / 2 + u * 2, u, h - u * 3);
                hctx.fillStyle = '#d8452f';
                hctx.fillRect(w / 2 - u * 4, h / 2 - u * 4, u * 3, u * 3);
            }
            hctx.restore();
        }
    }

    function drawHudParticles() {
        for (const pt of hudParticles) {
            const a = clamp(pt.life / pt.max, 0, 1);
            const sz = Math.max(2, Math.round(pt.size * (0.5 + a * 0.5)));
            hctx.globalAlpha = Math.min(1, a * 1.6);
            hctx.fillStyle = '#0d0812';
            hctx.fillRect(Math.round(pt.x - sz / 2) - 1, Math.round(pt.y - sz / 2) - 1, sz + 2, sz + 2);
            hctx.fillStyle = pt.color;
            hctx.fillRect(Math.round(pt.x - sz / 2), Math.round(pt.y - sz / 2), sz, sz);
        }
        hctx.globalAlpha = 1;
    }

    // Ícone de alerta "!" vermelho sobre o encontro que avistou o jogador
    function drawEncounterAlert(now) {
        if (!encounterAlert) return;
        const entry = encounterSprites.get(encounterAlert.id);
        if (!entry) return;
        let x = viewW * 0.5;
        let y = viewH * 0.3;
        if (webglOk) {
            const p = project3D(entry.x, entry.baseScale * 0.92 + 0.1, entry.z);
            if (!p) return;
            x = clamp(p.x, 40, viewW - 40);
            y = clamp(p.y, 70, viewH * 0.7);
        }
        const age = encounterAlert.dur - encounterAlert.time;
        const pop = age < 0.14 ? 1.7 - (age / 0.14) * 0.7 : 1 + Math.sin(now / 55) * 0.06;
        const size = clamp(viewH * 0.15, 54, 96) * pop;
        const bw = size * 0.52;
        const bh = size * 0.95;
        hctx.fillStyle = '#0d0812';
        hctx.fillRect(Math.round(x - bw / 2) - 4, Math.round(y - bh) - 4, Math.round(bw) + 8, Math.round(bh) + 8);
        hctx.fillStyle = '#fff6c9';
        hctx.fillRect(Math.round(x - bw / 2), Math.round(y - bh), Math.round(bw), Math.round(bh));
        hctx.fillStyle = '#e02818';
        const sw = Math.round(bw * 0.3);
        hctx.fillRect(Math.round(x - sw / 2), Math.round(y - bh * 0.88), sw, Math.round(bh * 0.52));
        hctx.fillRect(Math.round(x - sw / 2), Math.round(y - bh * 0.26), sw, Math.round(bh * 0.15));
    }

    function renderMinimap() {
        if (!mctx || !currentState || !mapRows) return;
        const mw = miniCanvas.width;
        const mh = miniCanvas.height;

        mctx.fillStyle = '#e6d2a8';
        mctx.fillRect(0, 0, mw, mh);

        mctx.strokeStyle = '#c4ab7a';
        mctx.lineWidth = 4;
        mctx.strokeRect(2, 2, mw - 4, mh - 4);

        const cell = Math.floor(Math.min((mw - 10) / mapCols, (mh - 10) / mapRows));
        const ox = Math.floor((mw - cell * mapCols) / 2);
        const oy = Math.floor((mh - cell * mapRows) / 2);

        for (let y = 0; y < mapRows; y++) {
            for (let x = 0; x < mapCols; x++) {
                const key = x + ',' + y;
                const seen = currentState.exploredTiles.has(key);
                const ch = mapGrid[y][x];
                const px = ox + x * cell;
                const py = oy + y * cell;

                if (!seen) {
                    mctx.fillStyle = '#d3bd92';
                    mctx.fillRect(px, py, cell, cell);
                    continue;
                }

                if (ch === '#') {
                    mctx.fillStyle = '#593e25';
                    mctx.fillRect(px, py, cell, cell);
                    mctx.strokeStyle = '#362312';
                    mctx.lineWidth = 1;
                    mctx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
                } else {
                    mctx.fillStyle = '#f5e7c8';
                    mctx.fillRect(px, py, cell, cell);
                    mctx.strokeStyle = 'rgba(138, 108, 68, 0.25)';
                    mctx.lineWidth = 1;
                    mctx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);

                    const cleared = currentState.clearedTiles.has(key);
                    if (ch === 'C' && !cleared) {
                        mctx.fillStyle = '#d99a16';
                        mctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
                    } else if (ch === 'M') {
                        mctx.fillStyle = '#2b8a3e';
                        mctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
                        mctx.fillStyle = '#f5cb5c';
                        mctx.fillRect(px + Math.floor(cell * 0.32), py + Math.floor(cell * 0.32), Math.max(2, cell * 0.36), Math.max(2, cell * 0.36));
                    } else if (ch === '?' && !cleared) {
                        mctx.fillStyle = '#7b3fa8';
                        mctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
                        mctx.fillStyle = '#f5cb5c';
                        mctx.fillRect(px + Math.floor(cell * 0.38), py + Math.floor(cell * 0.38), Math.max(2, cell * 0.24), Math.max(2, cell * 0.24));
                    } else if (ch === 'E') {
                        mctx.fillStyle = '#2b8a3e';
                        mctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
                    }
                }
            }
        }

        // Encontros em patrulha: posição interpolada em tempo real
        for (const [encId, entry] of encounterSprites.entries()) {
            if (!entry.alive) continue;
            if (!currentState.exploredTiles.has(Math.round(entry.tx) + ',' + Math.round(entry.tz))) continue;
            const ecx = ox + entry.x * cell + cell / 2;
            const ecy = oy + entry.z * cell + cell / 2;
            const alerted = encounterAlert && encounterAlert.id === encId;
            mctx.fillStyle = alerted ? '#ff2a1a' : (entry.isBoss ? '#b81414' : '#d9480f');
            mctx.strokeStyle = '#3a1208';
            mctx.lineWidth = 1;
            mctx.beginPath();
            mctx.arc(ecx, ecy, cell * (alerted ? 0.42 : (entry.isBoss ? 0.36 : 0.3)), 0, Math.PI * 2);
            mctx.fill();
            mctx.stroke();
        }

        const pcx = ox + currentState.player.x * cell + cell / 2;
        const pcy = oy + currentState.player.y * cell + cell / 2;
        const dir = currentState.player.dir;
        const fx = DIR_DX[dir];
        const fy = DIR_DY[dir];
        const rx = -fy;
        const ry = fx;
        const r = cell * 0.45;

        mctx.fillStyle = '#1864ab';
        mctx.strokeStyle = '#ffffff';
        mctx.lineWidth = 1.5;
        mctx.beginPath();
        mctx.moveTo(pcx + fx * r, pcy + fy * r);
        mctx.lineTo(pcx - fx * r * 0.75 + rx * r * 0.72, pcy - fy * r * 0.75 + ry * r * 0.72);
        mctx.lineTo(pcx - fx * r * 0.75 - rx * r * 0.72, pcy - fy * r * 0.75 - ry * r * 0.72);
        mctx.closePath();
        mctx.fill();
        mctx.stroke();

        // Carimbo / Cabeçalho discreto de Planta de Emergência / Memorando
        mctx.save();
        mctx.fillStyle = 'rgba(54, 35, 18, 0.75)';
        mctx.font = 'bold 10px monospace';
        mctx.fillText('PLANTA #25', 7, 13);
        mctx.translate(mw - 34, mh - 14);
        mctx.rotate(-0.14);
        mctx.strokeStyle = 'rgba(155, 28, 28, 0.65)';
        mctx.lineWidth = 1.5;
        mctx.strokeRect(-26, -7, 52, 12);
        mctx.fillStyle = 'rgba(155, 28, 28, 0.75)';
        mctx.font = 'bold 8px monospace';
        mctx.textAlign = 'center';
        mctx.textBaseline = 'middle';
        mctx.fillText('EMERGÊNCIA', 0, -0.5);
        mctx.restore();
    }

    function loop(now) {
        rafId = requestAnimationFrame(loop);
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        resize();
        if (viewW <= 0 || viewH <= 0) return;

        const k = 1 - Math.exp(-dt * 14);
        camX += (targetCamX - camX) * k;
        camZ += (targetCamZ - camZ) * k;
        camYaw += (targetCamYaw - camYaw) * (1 - Math.exp(-dt * camTurnRate));
        if (Math.abs(targetCamYaw - camYaw) < 0.01) camTurnRate = 14;

        if (edgeFlash.time > 0) {
            edgeFlash.time = Math.max(0, edgeFlash.time - dt);
            edgeFlash.alpha = edgeFlash.maxAlpha * (edgeFlash.time / edgeFlash.dur);
        } else {
            edgeFlash.alpha = 0;
        }
        if (encounterAlert) {
            encounterAlert.time -= dt;
            if (encounterAlert.time <= 0) encounterAlert = null;
        }

        // Patrulha: interpola a posição dos encontros (também usada pelo minimapa)
        const kEnc = 1 - Math.exp(-dt * 7);
        for (const entry of encounterSprites.values()) {
            entry.x += (entry.tx - entry.x) * kEnc;
            entry.z += (entry.tz - entry.z) * kEnc;
        }

        for (let i = projectiles.length - 1; i >= 0; i--) {
            projectiles[i].t += dt;
            if (projectiles[i].t >= projectiles[i].dur) projectiles.splice(i, 1);
        }
        for (let i = hudParticles.length - 1; i >= 0; i--) {
            const pt = hudParticles[i];
            pt.life -= dt;
            if (pt.life <= 0) {
                hudParticles.splice(i, 1);
                continue;
            }
            pt.vy += pt.gravity * dt;
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
        }

        if (stepBob > 0) stepBob = Math.max(0, stepBob - dt * 5.2);
        if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - dt);
        else shakeMag = 0;

        if (screenFlash.time > 0) {
            screenFlash.time = Math.max(0, screenFlash.time - dt);
            screenFlash.alpha = screenFlash.maxAlpha * (screenFlash.time / screenFlash.dur);
        } else {
            screenFlash.alpha = 0;
        }

        if (webglOk && renderer && scene && camera) {
            const bobY = Math.sin(stepBob * Math.PI) * 0.055;
            let sx = 0, sy = 0;
            if (shakeTime > 0) {
                sx = (Math.random() * 2 - 1) * shakeMag;
                sy = (Math.random() * 2 - 1) * shakeMag;
            }
            const camYTarget = currentState && currentState.mode === 'combat' ? CAM_HEIGHT_COMBAT : CAM_HEIGHT_EXPLORE;
            camY += (camYTarget - camY) * (1 - Math.exp(-dt * 8));
            camera.position.set(camX + sx, camY + bobY + sy, camZ);
            camera.rotation.y = camYaw;
            camera.updateMatrixWorld();

            const stutter = Math.sin(now * 0.0017) > 0.86 ? (Math.sin(now * 0.09) < -0.25 ? 0.78 : 1.04) : 1;
            const fluoFlick = stutter * (1 + Math.sin(now * 0.045) * 0.015);
            if (ambientLight) {
                ambientLight.intensity = 2.1 * fluoFlick;
            }
            if (playerLight) {
                playerLight.position.set(camX, 0.95, camZ);
                playerLight.intensity = 3.6 * fluoFlick;
            }

            for (const t of torches) {
                const flick = 1 + Math.sin(now / 85 + t.seed) * 0.1 + Math.sin(now / 41 + t.seed * 2) * 0.07;
                t.light.intensity = 4.2 * flick;
                const frame = Math.floor(now / 120 + t.seed) % t.frames.length;
                if (t.flame.material.map !== t.frames[frame]) {
                    t.flame.material.map = t.frames[frame];
                    t.flame.material.needsUpdate = true;
                }
            }

            for (const obj of worldPickups.values()) {
                if (!obj.sprite.visible) continue;
                obj.sprite.position.y = 0.04 + Math.sin(now / 320 + obj.sprite.position.x) * 0.03;
            }

            // Idle contínuo dos encontros no mapa (respiração + flutuação, fase aleatória)
            for (const entry of encounterSprites.values()) {
                if (!entry.sprite || !entry.sprite.visible) continue;
                const breath = Math.sin(now / 430 * entry.rate + entry.phase);
                const alertHop = encounterAlert && encounterSprites.get(encounterAlert.id) === entry
                    ? Math.abs(Math.sin(now / 70)) * 0.06 : 0;
                entry.sprite.position.set(entry.x, 0.04 + breath * 0.028 + alertHop, entry.z);
                entry.sprite.scale.set(
                    entry.baseScale * (1 - breath * 0.018),
                    entry.baseScale * (1 + breath * 0.035),
                    1
                );
            }

            const kBase = 1 - Math.exp(-dt * 9);
            for (const entry of combatSprites.values()) {
                const a = entry.anim;
                if (a.hurt > 0) a.hurt = Math.max(0, a.hurt - dt * 4.2);
                if (a.white > 0) a.white = Math.max(0, a.white - dt * 5.8);
                if (a.shake > 0) a.shake = Math.max(0, a.shake - dt);
                if (a.buff > 0) a.buff = Math.max(0, a.buff - dt / 0.46);
                if (a.spawn > 0) a.spawn = Math.max(0, a.spawn - dt / 0.36);
                if (!entry.alive) a.death = Math.min(1, a.death + dt / DEATH_DURATION);

                entry.curX += (entry.baseX - entry.curX) * kBase;
                entry.curZ += (entry.baseZ - entry.curZ) * kBase;

                // Distância até a câmera e limites para a animação nunca sair do corredor:
                // o recuo não pode levar o sprite para trás da parede do fundo.
                const camDist = Math.hypot(camX - entry.curX, camZ - entry.curZ) || 1;
                const recoil = Math.max(0, Math.min(0.1, (MAX_COMBAT_DEPTH + 0.04 - entry.slotZ) * 0.9));
                let lungeReach = 0;

                // --- Ataque: antecipação (pisca laranja/vermelho + recuo) -> investida/projétil -> retorno ---
                let toward = 0;        // deslocamento em direção à câmera (negativo = recuo)
                let atkScale = 1;
                let atkHop = 0;
                let flashAlpha = 0;
                let flashColor = 0xffffff;
                if (a.atk >= 0 && entry.alive) {
                    a.atk += dt;
                    const t = a.atk;
                    const ranged = a.atkStyle !== 'lunge';
                    lungeReach = Math.max(0, camDist - 0.42);
                    if (t < ATK_ANTICIPATION) {
                        const p = t / ATK_ANTICIPATION;
                        toward = -recoil * Math.sin(p * Math.PI * 0.5);
                        atkScale = 1 - 0.1 * p;
                        flashAlpha = 0.9;
                        flashColor = Math.floor(t / 0.05) % 2 === 0 ? 0xff8a1e : 0xff2a1a;
                    } else if (t < ATK_ANTICIPATION + ATK_STRIKE) {
                        const p = (t - ATK_ANTICIPATION) / ATK_STRIKE;
                        const ease = p * p;
                        if (ranged) {
                            toward = -recoil + Math.sin(p * Math.PI) * Math.min(0.3, lungeReach);
                            atkScale = 0.9 + Math.sin(p * Math.PI) * 0.22;
                            atkHop = Math.sin(p * Math.PI) * 0.1;
                            if (!a.projFired) {
                                a.projFired = true;
                                const sp = enemyLocalPos(entry, 0.1 + 0.55 * entry.scale);
                                projectiles.push({
                                    kind: a.atkStyle === 'wave' ? 'wave' : 'paper',
                                    t: 0,
                                    dur: ATK_STRIKE,
                                    sx: sp.x,
                                    sy: sp.y
                                });
                            }
                        } else {
                            toward = -recoil + ease * (recoil + lungeReach);
                            atkScale = 0.9 + ease * 0.7;
                            atkHop = Math.sin(p * Math.PI) * 0.06;
                        }
                        flashAlpha = 0.55 * (1 - p);
                        flashColor = 0xff5a1e;
                    } else if (t < ATK_ANTICIPATION + ATK_STRIKE + ATK_RECOVER) {
                        const p = (t - ATK_ANTICIPATION - ATK_STRIKE) / ATK_RECOVER;
                        const back = 1 - (1 - p) * (1 - p);
                        if (ranged) {
                            toward = -recoil * (1 - back);
                            atkScale = 0.9 + 0.1 * back;
                        } else {
                            toward = lungeReach * (1 - back);
                            atkScale = 1.6 - 0.6 * back;
                        }
                    } else {
                        a.atk = -1;
                    }
                }

                // --- Idle contínuo: flutuação no eixo Y + pulsação de escala ---
                const breath = Math.sin(now / 420 * a.rate + a.phase);
                const idleBob = breath * 0.022;
                const idleSx = 1 - breath * 0.02;
                const idleSy = 1 + breath * 0.038;

                // --- Buff / invocação: salto para cima ---
                const buffSin = a.buff > 0 ? Math.sin((1 - a.buff) * Math.PI) : 0;
                const buffHop = buffSin * 0.24;
                const buffScale = 1 + buffSin * 0.1;

                // --- Morte: treme e pisca, depois encolhe/dissolve caindo no chão ---
                let deathSx = 1;
                let deathSy = 1;
                let alpha = 1;
                let deathShake = 0;
                let deathBlink = 0;
                if (a.death > 0) {
                    if (a.death < 0.4) {
                        deathShake = Math.sin(now / 14) * 0.05;
                        deathBlink = Math.floor(now / 55) % 2 === 0 ? 0.85 : 0;
                    } else {
                        const p = (a.death - 0.4) / 0.6;
                        deathSy = Math.max(0.02, 1 - p * p * 0.98);
                        deathSx = 1 + p * 0.2 - p * p * 0.75;
                        alpha = 1 - p * p;
                        deathShake = Math.sin(now / 14) * 0.03 * (1 - p);
                    }
                }

                const spawnScale = a.spawn > 0 ? (1 - a.spawn) * (1 + Math.sin((1 - a.spawn) * Math.PI) * 0.25) : 1;
                // Tremor (dano/morte) apenas lateral e limitado à folga até a parede
                const sideRoom = Math.max(0, 0.485 - Math.abs(entry.slotX) - entry.scale * 0.56);
                const rawShake = (a.shake > 0 ? Math.sin(now / 18) * 0.06 : 0) + deathShake;
                const shakeOffset = clamp(rawShake, -sideRoom, sideRoom);

                // A investida vai em direção à câmera (centro da tela), não só para frente
                let tdx = camX - entry.curX;
                let tdz = camZ - entry.curZ;
                const tlen = Math.hypot(tdx, tdz) || 1;
                tdx /= tlen;
                tdz /= tlen;

                entry.group.position.set(
                    entry.curX + tdx * toward + (entry.rightX || 0) * shakeOffset,
                    0.1 + (a.death > 0 ? 0 : idleBob) + atkHop + buffHop - (a.death > 0.4 ? (a.death - 0.4) * 0.16 : 0),
                    entry.curZ + tdz * toward + (entry.rightZ || 0) * shakeOffset
                );
                entry.drawW = 0;

                const base = entry.scale * atkScale * buffScale * spawnScale;
                const sxScale = Math.max(0.001, base * idleSx * deathSx);
                const syScale = Math.max(0.001, base * idleSy * deathSy);
                entry.main.scale.set(sxScale, syScale, 1);
                entry.red.scale.set(sxScale, syScale, 1);
                entry.white.scale.set(sxScale, syScale, 1);

                entry.drawW = sxScale;

                // Fileira da frente por cima; o atacante fica por cima de todos durante a investida
                const order = 10 + (a.atk >= 0 ? 60 : (entry.rank || 0));
                entry.shadow.renderOrder = order - 1;
                entry.main.renderOrder = order;
                entry.red.renderOrder = order + 1;
                entry.white.renderOrder = order + 2;

                const whiteAlpha = Math.max(a.white, deathBlink, flashAlpha);
                entry.white.material.color.setHex(flashAlpha > 0 && flashAlpha >= a.white ? flashColor : 0xffffff);
                entry.main.material.opacity = alpha;
                entry.red.material.opacity = a.hurt * 0.85 * alpha;
                entry.white.material.opacity = whiteAlpha * alpha;
                entry.shadow.material.opacity = 0.45 * alpha * (a.spawn > 0 ? 1 - a.spawn : 1);
                entry.group.visible = alpha > 0.02;
            }

            renderer.render(scene, camera);
        }

        hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        hctx.clearRect(0, 0, viewW, viewH);

        if (!webglOk) {
            renderFallback2D(now);
        }

        drawCombatHud(now);
        drawHudParticles();
        drawEncounterAlert(now);

        // Flash de dano nas bordas da janela 3D
        if (edgeFlash.alpha > 0.01) {
            const eg = hctx.createRadialGradient(
                viewW / 2, viewH / 2, viewH * 0.22,
                viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.62
            );
            eg.addColorStop(0, 'rgba(' + edgeFlash.rgb + ',0)');
            eg.addColorStop(0.55, 'rgba(' + edgeFlash.rgb + ',' + (edgeFlash.alpha * 0.45).toFixed(3) + ')');
            eg.addColorStop(1, 'rgba(' + edgeFlash.rgb + ',' + edgeFlash.alpha.toFixed(3) + ')');
            hctx.fillStyle = eg;
            hctx.fillRect(0, 0, viewW, viewH);
            const bt = Math.max(4, Math.round(viewH * 0.018));
            hctx.fillStyle = 'rgba(' + edgeFlash.rgb + ',' + Math.min(1, edgeFlash.alpha * 1.2).toFixed(3) + ')';
            hctx.fillRect(0, 0, viewW, bt);
            hctx.fillRect(0, viewH - bt, viewW, bt);
            hctx.fillRect(0, 0, bt, viewH);
            hctx.fillRect(viewW - bt, 0, bt, viewH);
        }

        if (screenFlash.alpha > 0.01) {
            hctx.fillStyle = screenFlash.color;
            hctx.globalAlpha = screenFlash.alpha;
            hctx.fillRect(0, 0, viewW, viewH);
            hctx.globalAlpha = 1;
        }

        const vig = hctx.createRadialGradient(
            viewW / 2, viewH / 2, viewH * 0.42,
            viewW / 2, viewH / 2, viewH * 0.95
        );
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(8,5,14,0.42)');
        hctx.fillStyle = vig;
        hctx.fillRect(0, 0, viewW, viewH);

        renderMinimap();
    }

    // Diagnóstico: segmentos (no chão) ocupados pelos billboards visíveis, para testes de clipping.
    function getDebugBounds() {
        const out = [];
        const rxC = Math.cos(camYaw);
        const rzC = -Math.sin(camYaw);
        if (currentState && currentState.mode === 'combat') {
            for (const [uid, entry] of combatSprites.entries()) {
                if (!entry.group.visible || !entry.alive) continue;
                const hw = (entry.drawW || entry.scale) * 0.5;
                const px = entry.group.position.x;
                const pz = entry.group.position.z;
                out.push({ id: uid, type: 'combat', x1: px - rxC * hw, z1: pz - rzC * hw, x2: px + rxC * hw, z2: pz + rzC * hw });
            }
        } else {
            for (const [id, entry] of encounterSprites.entries()) {
                if (!entry.sprite || !entry.sprite.visible) continue;
                const hw = entry.sprite.scale.x * 0.5;
                out.push({ id: id, type: 'world', x1: entry.x - rxC * hw, z1: entry.z - rzC * hw, x2: entry.x + rxC * hw, z2: entry.z + rzC * hw });
            }
            for (const [key, obj] of worldPickups.entries()) {
                if (!obj.sprite.visible) continue;
                const hw = obj.sprite.scale.x * 0.5;
                const px = obj.sprite.position.x;
                const pz = obj.sprite.position.z;
                out.push({ id: obj.kind + '@' + key, type: 'world', x1: px - rxC * hw, z1: pz - rzC * hw, x2: px + rxC * hw, z2: pz + rzC * hw });
            }
        }
        return out;
    }

    function getEnemyScreenPos(enemyUid) {
        const rect = hudCanvas.getBoundingClientRect();
        const entry = combatSprites.get(enemyUid);
        if (webglOk && entry) {
            const p = project3D(entry.curX, 0.1 + entry.scale * 0.55, entry.curZ);
            if (p) {
                return { x: rect.left + p.x, y: rect.top + p.y };
            }
        }
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.45 };
    }

    window.GameRenderer = {
        init: init,
        buildMap: buildMap,
        syncState: syncState,
        setHoveredCard: setHoveredCard,
        turnCamera: turnCamera,
        triggerStepBob: triggerStepBob,
        triggerShake: triggerShake,
        triggerScreenFlash: triggerScreenFlash,
        triggerEnemyHitAnim: triggerEnemyHitAnim,
        triggerEnemyAttackAnim: triggerEnemyAttackAnim,
        triggerEnemyBuffAnim: triggerEnemyBuffAnim,
        triggerEdgeFlash: triggerEdgeFlash,
        showEncounterAlert: showEncounterAlert,
        spawnBurst: spawnBurst,
        getAttackTimings: getAttackTimings,
        getDebugBounds: getDebugBounds,
        settleCamera: settleCamera,
        getEnemyScreenPos: getEnemyScreenPos
    };
})();

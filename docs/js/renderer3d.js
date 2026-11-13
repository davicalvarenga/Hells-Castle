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

    const torches = [];
    const worldPickups = new Map();
    const combatSprites = new Map();
    const enemyHitboxes = [];

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

        if (!webglOk) return;
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
        const floorCfg = window.GameData && window.GameData.getFloorConfig ? window.GameData.getFloorConfig(floorNum) : null;

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
                        addWorldSprite(x, y, 'vending', 0.94);
                    } else if (ch === '?') {
                        addWorldSprite(x, y, 'event_q', 0.78);
                    } else if (ch === 'E') {
                        addWorldSprite(x, y, 'exit', 1.2);
                    } else if ((ch >= '1' && ch <= '9') || ch === 'B') {
                        const enc = floorCfg && floorCfg.encounters && floorCfg.encounters[ch];
                        const previewKind = enc && enc.enemies ? (ch === 'B' ? enc.enemies[Math.floor(enc.enemies.length / 2)] : enc.enemies[0]) : (ch === 'B' ? 'lich' : 'goblin');
                        addWorldSprite(x, y, previewKind, ch === 'B' ? 1.15 : 0.92);
                    }
                }
            }
        }
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

        syncCombatSprites(state);
    }

    function setHoveredCard(card) {
        hoveredCard = card || null;
    }

    function turnCamera(deltaDir) {
        targetCamYaw -= deltaDir * (Math.PI / 2);
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

    function triggerEnemyAttackAnim(enemyId) {
        const entry = combatSprites.get(enemyId);
        if (!entry) return;
        entry.anim.lunge = 1;
        entry.anim.white = 0.45;
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
                    scale: (enemy.scale || 1) * 0.88,
                    anim: { hurt: 0, white: 0, shake: 0, lunge: 0, death: 0, phase: idx * 1.9 }
                };
                combatSprites.set(enemy.uid, entry);
            }

            const centerIdx = (count - 1) * 0.5;
            const stepSpread = count <= 2 ? 1.04 : count === 3 ? 0.82 : 0.66;
            const spread = count === 1 ? 0 : (idx - centerIdx) * stepSpread;
            const dist = count === 1 ? 1.44 : count === 2 ? 1.48 : count === 3 ? (idx === 1 ? 1.62 : 1.54) : 1.64;
            entry.baseX = state.player.x + fx * dist + rx * spread;
            entry.baseZ = state.player.y + fz * dist + rz * spread;
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

        enemies.forEach((enemy, idx) => {
            if (enemy.hp <= 0) return;

            let sx = viewW * 0.5;
            let topY = viewH * 0.3;
            let botY = viewH * 0.68;
            let scalePx = viewH * 0.36;

            const entry = combatSprites.get(enemy.uid);
            if (webglOk && entry) {
                const top = project3D(entry.group.position.x, 0.85 * entry.scale + 0.12, entry.group.position.z);
                const bot = project3D(entry.group.position.x, 0, entry.group.position.z);
                if (top && bot) {
                    sx = top.x;
                    topY = top.y;
                    botY = bot.y;
                    scalePx = Math.max(84, bot.y - top.y);
                }
            } else {
                sx = count === 1 ? viewW * 0.5 : viewW * (0.22 + (idx / (count - 1)) * 0.56);
                topY = viewH * 0.28;
                botY = viewH * 0.66;
                scalePx = viewH * 0.28;
            }

            const isTarget = currentState.targetUid === enemy.uid;
            const maxSlotW = viewW / Math.max(2.2, count + 0.8) - 24;
            const bw = clamp(Math.min(scalePx * 0.56, maxSlotW), 64, 132);
            const bh = 11;
            const bx = clamp(sx - bw / 2, 10, viewW - bw - 10);
            const by = clamp(topY - 10, 68, viewH * 0.48);
            const nameSize = clamp(bw * 0.145, 13, 18);

            enemyHitboxes.push({
                id: enemy.uid,
                x: sx - bw * 0.65,
                y: by - 26,
                w: bw * 1.3,
                h: scalePx + 54
            });

            if (hoveredCard && (hoveredCard.target === 'all' || (hoveredCard.target === 'single' && isTarget))) {
                const midY = (topY + botY) * 0.5;
                drawReticle(sx, midY, scalePx * 0.9, now, hoveredCard.target === 'all');
            }

            if (isTarget) {
                const pulse = Math.round(Math.sin(now / 150) * 3);
                drawPixelArrowDown(Math.round(sx), Math.round(by - 26 + pulse));
            }

            drawOutlined(enemy.name, clamp(sx, bw * 0.55, viewW - bw * 0.55), by - 11, nameSize, isTarget ? '#fff5d4' : '#efe6d8');

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
            drawOutlined(hpText, sx, by + bh / 2 + 1, 13, '#ffffff');

            const intentY = by + bh + 11;
            if (enemy.stunned) {
                drawPixelStun(Math.round(sx - 38), Math.round(intentY));
                drawOutlined('ATORDOADO', sx + 8, intentY, 13, '#69c8f0');
            } else {
                let tag = '';
                if (enemy.doubleIfUnshielded) tag = currentState.shield > 0 ? ' [BLOQ]' : 'x2 [DOBRO]';
                else if (enemy.curseCard) tag = ' [+ATA]';
                else if (enemy.buffAllies) tag = ' [+BUFF]';
                else if (enemy.immuneKnockback) tag = ' [IMUNE]';
                const label = 'ATK ' + enemy.atk + tag;
                drawPixelSword(Math.round(sx - (tag ? 48 : 26)), Math.round(intentY));
                drawOutlined(label, sx + 8, intentY, 14, enemy.isBoss ? '#ff9f68' : '#f0a03c');
            }
        });
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
                    } else if (((ch >= '1' && ch <= '9') || ch === 'B') && !cleared) {
                        mctx.fillStyle = ch === 'B' ? '#b81414' : '#d9480f';
                        mctx.beginPath();
                        mctx.arc(px + cell / 2, py + cell / 2, cell * 0.3, 0, Math.PI * 2);
                        mctx.fill();
                    }
                }
            }
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
        camYaw += (targetCamYaw - camYaw) * k;

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
            camera.position.set(camX + sx, 0.68 + bobY + sy, camZ);
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

            for (const entry of combatSprites.values()) {
                const a = entry.anim;
                if (a.hurt > 0) a.hurt = Math.max(0, a.hurt - dt * 4.2);
                if (a.white > 0) a.white = Math.max(0, a.white - dt * 5.8);
                if (a.shake > 0) a.shake = Math.max(0, a.shake - dt);
                if (a.lunge > 0) a.lunge = Math.max(0, a.lunge - dt * 2.8);
                if (!entry.alive) a.death = Math.min(1, a.death + dt * 3.8);

                const dir = currentState ? currentState.player.dir : 0;
                const fx = DIR_DX[dir];
                const fz = DIR_DY[dir];
                const lungeSin = Math.sin(a.lunge * Math.PI);
                const lungeOffset = lungeSin * 0.55;
                const lungeHop = lungeSin * 0.08;
                const lungeScale = 1 + lungeSin * 0.28;
                const shakeOffset = a.shake > 0 ? Math.sin(now / 18) * 0.06 : 0;
                const idleBob = Math.sin(now / 260 + a.phase) * 0.025;

                entry.group.position.set(
                    entry.baseX - fx * lungeOffset + shakeOffset,
                    0.14 + idleBob + lungeHop,
                    entry.baseZ - fz * lungeOffset
                );

                const s = entry.scale * lungeScale * (1 - a.death * 0.65);
                const alpha = 1 - a.death;
                entry.main.scale.set(s, s, 1);
                entry.red.scale.set(s, s, 1);
                entry.white.scale.set(s, s, 1);

                entry.main.material.opacity = alpha;
                entry.red.material.opacity = a.hurt * 0.85 * alpha;
                entry.white.material.opacity = a.white * alpha;
                entry.shadow.material.opacity = 0.45 * alpha;
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

    function getEnemyScreenPos(enemyUid) {
        const rect = hudCanvas.getBoundingClientRect();
        const entry = combatSprites.get(enemyUid);
        if (webglOk && entry) {
            const p = project3D(entry.group.position.x, 0.55, entry.group.position.z);
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
        getEnemyScreenPos: getEnemyScreenPos
    };
})();

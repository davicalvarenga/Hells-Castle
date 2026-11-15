// Renderizador 2.5D Pixel Art em Primeira Pessoa (Three.js) — 5 biomas de devaneio + Minimapa.
// Unidades do mundo: 1 tile = TILE unidades. Chão em y = 0. Todo sprite fica com os pés em y = 0.
(function () {
    'use strict';

    const INTERNAL_HEIGHT = 270;
    const TILE = 2;                 // largura de um tile em unidades do mundo
    const CAM_HEIGHT = 1.35;        // altura dos olhos do protagonista
    const COMMON_HEIGHT = 1.5;      // altura visível de TODO inimigo comum
    const BOSS_HEIGHT = 2.1;        // somente chefes são maiores
    const DIR_DX = [0, 1, 0, -1];
    const DIR_DY = [-1, 0, 1, 0];

    // Tempos (s) da animação de ataque: antecipação -> investida/projétil -> retorno
    const ATK_ANTICIPATION = 0.15;
    const ATK_STRIKE = 0.2;
    const ATK_RECOVER = 0.24;
    const DEATH_DURATION = 0.72;

    // Formação de combate: sempre sobre o chão do tile livre logo à frente do jogador
    // (profundidade entre 1 e 3 unidades da câmera), lado a lado, com leve diferença só no eixo Z.
    const FORMATION_DEPTH = 2.5;
    const FORMATION_MIN_DEPTH = 1.25;
    const FORMATION_MAX_DEPTH = 2.85;
    const FORMATION_GAP = 0.14;
    const WALL_MARGIN = 0.14;
    const VIEW_HALF_WIDTH = 2.6;    // limite lateral visível na profundidade da formação

    // Atmosfera de cada bioma.
    const BIOMES = {
        beach: {
            clear: 0xff9a5a, fog: [0xf5a56c, 16, 70], sky: true, ceiling: false, wallH: 1.1,
            ambient: [0xffe6c8, 1.7], hemi: [0x9fe0e8, 0xd9a066, 1.3], sun: [0xffb070, 1.8, [-8, 6, -12]],
            player: [0xffd9a8, 0.8, 14], orb: '#3fb3b8'
        },
        city: {
            clear: 0x0a0d16, fog: [0x1a2233, 3.5, 19], sky: true, ceiling: false, wallH: 6,
            ambient: [0x7f92bd, 1.5], hemi: [0x8fa4d9, 0x1a1e2b, 1.0], sun: [0xb8c8ff, 0.8, [6, 10, -4]],
            player: [0xa9c4ff, 3.0, 13], orb: '#9fe8ff'
        },
        snow: {
            clear: 0xa9c9ee, fog: [0xa6c6ec, 9, 38], sky: true, ceiling: false, wallH: 3.2,
            ambient: [0xd5e8ff, 1.9], hemi: [0xe2f0ff, 0x7fa3d0, 1.3], sun: [0xffffff, 1.3, [5, 9, 6]],
            player: [0xdcecff, 0.9, 14], orb: '#9fd0ee'
        },
        dungeon: {
            clear: 0x0b0a0e, fog: [0x0b0a0e, 3.5, 17], sky: false, ceiling: true, wallH: 3.2,
            ambient: [0x8f84a0, 1.25], hemi: [0x9a8fb0, 0x2a2430, 0.9], sun: null,
            player: [0xffc27a, 4.2, 14], orb: '#85db60'
        },
        abyss: {
            clear: 0x020108, fog: null, sky: true, ceiling: false, wallH: 0,
            ambient: [0xc3b4ff, 2.2], hemi: [0x9fe8ff, 0x3d2c73, 1.2], sun: null,
            player: [0x9fe8ff, 2.0, 16], orb: '#ec6bff'
        }
    };

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
    let biomeName = 'beach';
    let biome = BIOMES.beach;

    // Câmera em unidades de TILE (convertida para o mundo na hora de desenhar)
    let camX = 0;
    let camZ = 0;
    let camYaw = 0;
    let targetCamX = 0;
    let targetCamZ = 0;
    let targetCamYaw = 0;
    let camTurnRate = 14;
    let ambientLight = null;
    let playerLight = null;
    let skyMesh = null;
    let waterTex = null;
    let snowPoints = null;
    let stepBob = 0;
    let shakeMag = 0;
    let shakeTime = 0;
    let screenFlash = { color: '#ff3a2a', alpha: 0, maxAlpha: 0, time: 0, dur: 1 };
    let edgeFlash = { rgb: '216,40,30', alpha: 0, maxAlpha: 0, time: 0, dur: 1 };

    const torches = [];
    const worldPickups = new Map();
    const combatSprites = new Map();
    const encounterSprites = new Map();
    const epilogueSprites = [];
    const enemyHitboxes = [];
    const projectiles = [];
    const hudParticles = [];
    const texCache = new Map();
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

    // Texturas de sprites são compartilhadas (normal / branca / vermelha por tipo).
    function sheetTextures(kind) {
        if (!texCache.has(kind)) {
            const sheet = window.GameSprites.getSheet(kind);
            texCache.set(kind, {
                sheet: sheet,
                normal: makeTexture(sheet.normal),
                white: makeTexture(sheet.white),
                red: makeTexture(sheet.red)
            });
        }
        return texCache.get(kind);
    }

    // Cria um billboard com os PÉS apoiados no ponto de ancoragem (y = 0 = chão) e com a
    // altura VISÍVEL (pixels opacos) igual a targetH. maxW limita a largura visível.
    function makeBillboard(kind, targetH, maxW, materialOpts) {
        const THREE = window.THREE;
        const tx = sheetTextures(kind);
        const b = tx.sheet.bounds;
        const visHpx = b.y1 - b.y0 + 1;
        const visWpx = b.x1 - b.x0 + 1;
        let visH = targetH;
        let visW = targetH * visWpx / visHpx;
        if (maxW && visW > maxW) {
            visH *= maxW / visW;
            visW = maxW;
        }
        const scale = visH * b.h / visHpx;   // tamanho do quad inteiro (sprite quadrado)
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({
            map: tx.normal,
            transparent: true,
            alphaTest: 0.1,
            fog: true
        }, materialOpts || {})));
        sprite.center.set(((b.x0 + b.x1 + 1) / 2) / b.w, (b.h - 1 - b.y1) / b.h);
        sprite.scale.set(scale, scale, 1);
        return { sprite: sprite, tex: tx, scale: scale, visW: visW, visH: visH };
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
                camera = new window.THREE.PerspectiveCamera(70, 16 / 9, 0.1, 260);
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

    function isWallAt(gx, gy) {
        if (gy < 0 || gy >= mapRows || gx < 0 || gx >= mapCols) return true;
        return mapGrid[gy][gx] === '#';
    }

    function isBorder(gx, gy) {
        return gx === 0 || gy === 0 || gx === mapCols - 1 || gy === mapRows - 1;
    }

    function findAdjacentWallOffset(x, y) {
        const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        for (const d of dirs) {
            if (isWallAt(x + d[0], y + d[1])) return d;
        }
        return null;
    }

    // ---------------------------------------------------------------------------------
    // CONSTRUÇÃO DO BIOMA
    // ---------------------------------------------------------------------------------
    function buildMap(layout, state) {
        mapGrid = layout;
        mapRows = layout.length;
        mapCols = layout[0].length;
        currentState = state;

        // O andar da run é gerado por seed; o layout base só vale como fallback.
        const floorCfg = (state.floors && state.floors[state.floor]) || window.GameData.getFloorConfig(state.floor);
        biomeName = floorCfg.biome || 'dungeon';
        biome = BIOMES[biomeName] || BIOMES.dungeon;

        camX = state.player.x;
        camZ = state.player.y;
        targetCamX = camX;
        targetCamZ = camZ;
        camYaw = -state.player.dir * (Math.PI / 2);
        targetCamYaw = camYaw;

        encounterSprites.clear();
        combatSprites.clear();
        worldPickups.clear();
        epilogueSprites.length = 0;
        projectiles.length = 0;
        hudParticles.length = 0;
        torches.length = 0;
        encounterAlert = null;
        skyMesh = null;
        waterTex = null;
        snowPoints = null;

        if (!webglOk) {
            buildEncounterSprites(state);
            return;
        }
        const THREE = window.THREE;
        const SP = window.GameSprites;

        while (scene.children.length > 0) {
            scene.remove(scene.children[0]);
        }
        renderer.setClearColor(biome.clear, 1);
        scene.fog = biome.fog ? new THREE.Fog(biome.fog[0], biome.fog[1], biome.fog[2]) : null;

        ambientLight = new THREE.AmbientLight(biome.ambient[0], biome.ambient[1]);
        scene.add(ambientLight);
        scene.add(new THREE.HemisphereLight(biome.hemi[0], biome.hemi[1], biome.hemi[2]));
        if (biome.sun) {
            const sun = new THREE.DirectionalLight(biome.sun[0], biome.sun[1]);
            sun.position.set(biome.sun[2][0], biome.sun[2][1], biome.sun[2][2]);
            scene.add(sun);
        }
        playerLight = new THREE.PointLight(biome.player[0], biome.player[1], biome.player[2], 1.1);
        scene.add(playerLight);

        const midX = (mapCols - 1) * TILE / 2;
        const midZ = (mapRows - 1) * TILE / 2;

        // Céu aberto (esfera com textura pixelada); a dungeon tem teto fechado.
        if (biome.sky) {
            skyMesh = new THREE.Mesh(
                new THREE.SphereGeometry(120, 32, 16),
                new THREE.MeshBasicMaterial({
                    map: makeTexture(SP.makeSkyTexture(biomeName)),
                    side: THREE.BackSide,
                    fog: false,
                    depthWrite: false
                })
            );
            skyMesh.renderOrder = -10;
            scene.add(skyMesh);
        }

        // Chão
        const floorCanvas = SP.makeFloorTexture(biomeName);
        if (biomeName === 'abyss') {
            // ladrilhos luminosos flutuando no vazio: só existem onde se pode pisar
            const tileMat = new THREE.MeshBasicMaterial({ map: makeTexture(floorCanvas), fog: false });
            const glowMat = new THREE.MeshBasicMaterial({ color: 0x7ef0ff, transparent: true, opacity: 0.22, fog: false, depthWrite: false });
            const tileGeo = new THREE.BoxGeometry(TILE * 0.92, 0.18, TILE * 0.92);
            const glowGeo = new THREE.PlaneGeometry(TILE * 1.25, TILE * 1.25);
            for (let y = 0; y < mapRows; y++) {
                for (let x = 0; x < mapCols; x++) {
                    if (layout[y][x] === '#') continue;
                    const tile = new THREE.Mesh(tileGeo, tileMat);
                    tile.position.set(x * TILE, -0.09, y * TILE);
                    scene.add(tile);
                    const glow = new THREE.Mesh(glowGeo, glowMat);
                    glow.rotation.x = -Math.PI / 2;
                    glow.position.set(x * TILE, -0.3, y * TILE);
                    scene.add(glow);
                }
            }
            const starGeo = new THREE.BufferGeometry();
            const pts = [];
            for (let i = 0; i < 420; i++) {
                const a = Math.random() * Math.PI * 2;
                const h = Math.random() * 2 - 1;
                const r = 55 + Math.random() * 30;
                const k = Math.sqrt(1 - h * h);
                pts.push(midX + Math.cos(a) * k * r, h * r, midZ + Math.sin(a) * k * r);
            }
            starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
            scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.55, fog: false })));
        } else {
            const inner = biomeName === 'beach';
            const fw = (inner ? mapCols - 2 : mapCols) * TILE;
            const fh = (inner ? mapRows - 2 : mapRows) * TILE;
            const floor = new THREE.Mesh(
                new THREE.PlaneGeometry(fw, fh),
                new THREE.MeshLambertMaterial({ map: makeTexture(floorCanvas, fw / TILE, fh / TILE) })
            );
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(midX, 0, midZ);
            scene.add(floor);
        }

        if (biomeName === 'beach') {
            // mar escuro com reflexos ao redor da faixa de areia
            waterTex = makeTexture(SP.makeWaterTexture(), 90, 90);
            const water = new THREE.Mesh(
                new THREE.PlaneGeometry(360, 360),
                new THREE.MeshBasicMaterial({ map: waterTex, fog: true })
            );
            water.rotation.x = -Math.PI / 2;
            water.position.set(midX, -0.14, midZ);
            scene.add(water);
            const foam = new THREE.Mesh(
                new THREE.PlaneGeometry((mapCols - 2) * TILE + 0.7, (mapRows - 2) * TILE + 0.7),
                new THREE.MeshBasicMaterial({ color: 0xf4fbf6, transparent: true, opacity: 0.55 })
            );
            foam.rotation.x = -Math.PI / 2;
            foam.position.set(midX, -0.06, midZ);
            scene.add(foam);
        }

        if (biome.ceiling) {
            const ceiling = new THREE.Mesh(
                new THREE.PlaneGeometry(mapCols * TILE, mapRows * TILE),
                new THREE.MeshLambertMaterial({ map: makeTexture(SP.makeCeilingTexture(), mapCols, mapRows) })
            );
            ceiling.rotation.x = Math.PI / 2;
            ceiling.position.set(midX, biome.wallH, midZ);
            scene.add(ceiling);
        }

        if (biomeName === 'snow') {
            // flocos de neve caindo em partículas 3D ao redor da câmera
            const geo = new THREE.BufferGeometry();
            const pos = [];
            for (let i = 0; i < 520; i++) {
                pos.push((Math.random() - 0.5) * 22, Math.random() * 8, (Math.random() - 0.5) * 22);
            }
            geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            snowPoints = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, fog: false }));
            snowPoints.frustumCulled = false;
            scene.add(snowPoints);
        }

        // Paredes / obstáculos de cada bioma
        const wallMats = {};
        const wallMat = (kind, opts) => {
            const key = kind + (opts && opts.transparent ? 't' : '');
            if (!wallMats[key]) {
                wallMats[key] = new THREE.MeshLambertMaterial(Object.assign({
                    map: makeTexture(SP.makeWallTexture(biomeName, kind))
                }, opts || {}));
            }
            return wallMats[key];
        };
        const torchFrames = [0, 1, 2].map(v => makeTexture(SP.makeTorchCanvas(v)));
        let lightCount = 0;

        for (let y = 0; y < mapRows; y++) {
            for (let x = 0; x < mapCols; x++) {
                const ch = layout[y][x];
                const wx = x * TILE;
                const wz = y * TILE;
                if (ch === '#') {
                    const border = isBorder(x, y);
                    if (biomeName === 'beach') {
                        if (border) continue;   // a borda é o próprio mar
                        const rock = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.9, biome.wallH, TILE * 0.9), wallMat(0));
                        rock.position.set(wx, biome.wallH / 2, wz);
                        scene.add(rock);
                        const palm = makeBillboard('palm', 4.6, 0);
                        palm.sprite.position.set(wx, biome.wallH - 0.05, wz);
                        scene.add(palm.sprite);
                    } else if (biomeName === 'city') {
                        const kind = (x * 7 + y * 13) % 4;
                        const h = kind === 3 && !border ? 2.6 : biome.wallH;
                        const house = new THREE.Mesh(new THREE.BoxGeometry(TILE, h, TILE), wallMat(kind));
                        house.position.set(wx, h / 2, wz);
                        scene.add(house);
                    } else if (biomeName === 'snow') {
                        const h = border ? 4.6 : biome.wallH;
                        const ice = new THREE.Mesh(
                            new THREE.BoxGeometry(TILE * (border ? 1 : 0.94), h, TILE * (border ? 1 : 0.94)),
                            border ? wallMat(0) : wallMat(1, { transparent: true, opacity: 0.8 })
                        );
                        ice.position.set(wx, h / 2, wz);
                        scene.add(ice);
                        if (!border) {
                            const spire = makeBillboard('icespire', 1.5, 0);
                            spire.sprite.position.set(wx, h - 0.02, wz);
                            scene.add(spire.sprite);
                        }
                    } else if (biomeName === 'dungeon') {
                        const kind = [0, 1, 2, 0, 0][(x * 7 + y * 13) % 5];
                        const wall = new THREE.Mesh(new THREE.BoxGeometry(TILE, biome.wallH, TILE), wallMat(kind));
                        wall.position.set(wx, biome.wallH / 2, wz);
                        scene.add(wall);
                    }
                    continue;
                }

                // Luzes de ambiente presas às paredes: tochas (dungeon) e lampiões (cidade)
                const adj = findAdjacentWallOffset(x, y);
                if (adj && (x + y) % 3 === 0 && lightCount < 9) {
                    if (biomeName === 'dungeon') {
                        lightCount++;
                        const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: torchFrames[0], transparent: true, alphaTest: 0.4, fog: false }));
                        flame.scale.set(0.42, 0.6, 1);
                        flame.position.set(wx + adj[0] * 0.86, 2.0, wz + adj[1] * 0.86);
                        scene.add(flame);
                        const stick = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.4, 0.09), new THREE.MeshLambertMaterial({ color: 0x4b2f1b }));
                        stick.position.set(wx + adj[0] * 0.9, 1.6, wz + adj[1] * 0.9);
                        scene.add(stick);
                        const light = new THREE.PointLight(0xffa040, 5.5, 11, 1.2);
                        light.position.set(wx + adj[0] * 0.5, 2.0, wz + adj[1] * 0.5);
                        scene.add(light);
                        torches.push({ flame: flame, light: light, frames: torchFrames, seed: x * 3.1 + y * 1.7, base: 5.5 });
                    } else if (biomeName === 'city' && ch === '.') {
                        lightCount++;
                        const lamp = makeBillboard('lamp', 3.3, 0, { fog: false });
                        lamp.sprite.position.set(wx + adj[0] * 0.8, 0, wz + adj[1] * 0.8);
                        scene.add(lamp.sprite);
                        const light = new THREE.PointLight(lightCount % 2 ? 0x8fd4ff : 0xffb057, 5.0, 10, 1.2);
                        light.position.set(wx + adj[0] * 0.6, 2.9, wz + adj[1] * 0.6);
                        scene.add(light);
                        torches.push({ flame: null, light: light, frames: null, seed: x * 2.3 + y * 1.1, base: 5.0 });
                    }
                }

                if (ch === 'C') {
                    addWorldSprite(x, y, 'chest', 0.95);
                } else if (ch === 'M') {
                    addWorldSprite(x, y, biomeName === 'city' ? 'restlamp' : 'campfire', biomeName === 'city' ? 1.9 : 1.25);
                    const glow = new THREE.PointLight(0xffa64a, 3.2, 8, 1.3);
                    glow.position.set(wx, 1.0, wz);
                    scene.add(glow);
                    torches.push({ flame: null, light: glow, frames: null, seed: x + y, base: 3.2 });
                } else if (ch === '?') {
                    addWorldSprite(x, y, 'event_q', 1.2);
                } else if (ch === 'E') {
                    addWorldSprite(x, y, 'exit', 2.2);
                }
            }
        }

        buildEncounterSprites(state);
    }

    function addWorldSprite(x, y, kind, height) {
        if (!webglOk) return;
        const bb = makeBillboard(kind, height, TILE * 0.9);
        bb.sprite.position.set(x * TILE, 0, y * TILE);
        scene.add(bb.sprite);
        worldPickups.set(x + ',' + y, { sprite: bb.sprite, kind: kind, visW: bb.visW, baseScale: bb.scale });
    }

    function spriteKindOf(kind) {
        const tpl = window.GameData.ENEMIES[kind];
        return (tpl && tpl.sprite) || kind;
    }

    // Coroa pixel art dos Elites, centrada em (cx, cy) com unidade u (px).
    function drawEliteCrown(cx, cy, u, now) {
        const x = Math.round(cx - u * 3.5);
        const y = Math.round(cy - u * 2 + Math.sin(now / 260) * u * 0.4);
        hctx.fillStyle = '#0d0812';
        hctx.fillRect(x - u, y - u, u * 9, u * 5);
        hctx.fillStyle = '#ffd147';
        hctx.fillRect(x, y + u, u * 7, u * 2);
        hctx.fillRect(x, y, u, u);
        hctx.fillRect(x + u * 3, y - 0, u, u);
        hctx.fillRect(x + u * 6, y, u, u);
        hctx.fillStyle = '#e24a33';
        hctx.fillRect(x + u * 3, y + u, u, u);
    }

    // Encontros são entidades móveis (patrulha): um sprite por encontro, com posição interpolada.
    function buildEncounterSprites(state) {
        const list = (state && state.encounters) || [];
        list.forEach(enc => {
            const kinds = enc.enc && enc.enc.enemies ? enc.enc.enemies : ['crab'];
            const eliteSlot = enc.isElite && enc.enc.formation ? enc.enc.formation.find(slot => slot.elite) : null;
            const previewKind = spriteKindOf(eliteSlot ? eliteSlot.kind
                : (enc.isBoss ? kinds[Math.floor(kinds.length / 2)] : kinds[0]));
            let bb = null;
            if (webglOk) {
                // largura < 1 tile para o billboard nunca entrar em paredes vizinhas
                bb = makeBillboard(previewKind, enc.isBoss ? BOSS_HEIGHT : COMMON_HEIGHT, TILE * 0.9);
                bb.sprite.position.set(enc.x * TILE, 0, enc.y * TILE);
                scene.add(bb.sprite);
            }
            encounterSprites.set(enc.id, {
                sprite: bb ? bb.sprite : null,
                baseScale: bb ? bb.scale : 1,
                visW: bb ? bb.visW : 1,
                visH: bb ? bb.visH : COMMON_HEIGHT,
                isBoss: !!enc.isBoss,
                isElite: !!enc.isElite,
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

    // Epílogo: chefes anteriores abrem caminho até o relógio de ponto.
    function showEpilogue(cfg) {
        if (!webglOk) return;
        epilogueSprites.forEach(e => scene.remove(e.sprite));
        epilogueSprites.length = 0;
        (cfg.bosses || []).forEach((b, i) => {
            const bb = makeBillboard(b.kind, BOSS_HEIGHT, TILE * 0.9, { fog: false });
            bb.sprite.position.set(b.x * TILE, 0, b.y * TILE);
            scene.add(bb.sprite);
            epilogueSprites.push({ sprite: bb.sprite, scale: bb.scale, phase: i * 1.7, visW: bb.visW });
        });
        if (cfg.clock) {
            const bb = makeBillboard('timeclock', 1.7, 0, { fog: false });
            bb.sprite.position.set(cfg.clock.x * TILE, 0, cfg.clock.y * TILE);
            scene.add(bb.sprite);
            epilogueSprites.push({ sprite: bb.sprite, scale: bb.scale, phase: 0, visW: bb.visW, still: true });
            const light = new window.THREE.PointLight(0xffd27a, 6, 14, 1.2);
            light.position.set(cfg.clock.x * TILE, 2, cfg.clock.y * TILE);
            scene.add(light);
        }
    }

    function syncState(state) {
        currentState = state;
        targetCamX = state.player.x;
        targetCamZ = state.player.y;

        for (const [key, obj] of worldPickups.entries()) {
            const cleared = state.clearedTiles.has(key);
            const permanent = obj.kind === 'campfire' || obj.kind === 'restlamp' || obj.kind === 'exit';
            obj.sprite.visible = (permanent || !cleared) && state.mode !== 'combat';
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

    // Assenta a câmera no alvo (ao iniciar o combate a formação já nasce alinhada).
    function settleCamera() {
        camYaw = targetCamYaw;
        camX = targetCamX;
        camZ = targetCamZ;
        camTurnRate = 14;
    }

    function showEncounterAlert(encId, dur) {
        encounterAlert = { id: encId, time: dur || 0.7, dur: dur || 0.7 };
    }

    function triggerStepBob() {
        stepBob = 1;
    }

    function triggerShake(mag, dur) {
        shakeMag = Math.max(shakeMag, (mag || 0.06) * 1.6);
        shakeTime = Math.max(shakeTime, dur || 0.2);
    }

    function triggerScreenFlash(color, alpha, dur) {
        screenFlash.color = color || '#ff3a2a';
        screenFlash.maxAlpha = alpha || 0.35;
        screenFlash.alpha = screenFlash.maxAlpha;
        screenFlash.dur = dur || 0.26;
        screenFlash.time = screenFlash.dur;
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

    function enemyLocalPos(entry, heightFrac) {
        if (webglOk && entry) {
            const p = project3D(entry.curX, entry.visH * heightFrac, entry.curZ);
            if (p) return p;
        }
        return { x: viewW / 2, y: viewH * 0.45, s: viewH * 0.3 };
    }

    // Hit flash: silhueta 100% branca (textura "white" do sheet) por ~95 ms; o loop zera sozinho,
    // então não há estado a restaurar (inimigo morto sai de combatSprites e leva o flash junto).
    function flashEnemy(enemyId) {
        const entry = combatSprites.get(enemyId);
        if (entry) entry.anim.white = 1;
    }

    function triggerEnemyHitAnim(enemyId) {
        const entry = combatSprites.get(enemyId);
        if (!entry) return;
        entry.anim.hurt = 1;
        entry.anim.shake = 0.25;
        flashEnemy(enemyId);
    }

    // style: 'lunge' (investida até a câmera), 'paper' (folha), 'wave' (onda) ou 'orb' (energia)
    function triggerEnemyAttackAnim(enemyId, style) {
        const entry = combatSprites.get(enemyId);
        if (!entry) return;
        entry.anim.atk = 0;
        entry.anim.atkStyle = style || 'lunge';
        entry.anim.projFired = false;
    }

    // Salto com partículas (buff, carta-lixo, invocação, escudo de cristal)
    function triggerEnemyBuffAnim(enemyId, palette) {
        const entry = combatSprites.get(enemyId);
        if (!entry) return;
        entry.anim.buff = 1;
        const p = enemyLocalPos(entry, 0.5);
        const colors = palette === 'gold'
            ? ['#ffd147', '#fff2a8', '#f59e0b', '#c084fc']
            : palette === 'ice'
                ? ['#9fd0ee', '#e6f6ff', '#69c8f0', '#ffffff']
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

    // ---------------------------------------------------------------------------------
    // FORMAÇÃO DE COMBATE (sempre no chão aberto à frente da câmera)
    // ---------------------------------------------------------------------------------
    function syncCombatSprites(state) {
        if (!webglOk) return;
        const THREE = window.THREE;

        if (state.mode !== 'combat') {
            for (const entry of combatSprites.values()) {
                scene.remove(entry.sprite);
                scene.remove(entry.shadow);
            }
            combatSprites.clear();
            return;
        }

        const activeIds = new Set(state.enemies.map(e => e.uid));
        for (const [uid, entry] of combatSprites.entries()) {
            if (!activeIds.has(uid)) {
                scene.remove(entry.sprite);
                scene.remove(entry.shadow);
                combatSprites.delete(uid);
            }
        }

        const dir = state.player.dir;
        const fx = DIR_DX[dir];
        const fz = DIR_DY[dir];
        const rx = -fz;
        const rz = fx;

        state.enemies.forEach(enemy => {
            if (combatSprites.has(enemy.uid)) return;
            // Comuns: mesma altura visível. Chefes: maiores. Pés sempre em y = 0.
            const bb = makeBillboard(spriteKindOf(enemy.kind), enemy.isBoss ? BOSS_HEIGHT : COMMON_HEIGHT, 0);
            const shadow = new THREE.Mesh(
                new THREE.CircleGeometry(0.5, 14),
                new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, fog: false })
            );
            shadow.rotation.x = -Math.PI / 2;
            shadow.scale.setScalar(bb.visW * 0.85);
            scene.add(shadow, bb.sprite);
            combatSprites.set(enemy.uid, {
                sprite: bb.sprite,
                shadow: shadow,
                tex: bb.tex,
                scale: bb.scale,
                visW: bb.visW,
                visH: bb.visH,
                isBoss: !!enemy.isBoss,
                slotX: 0,
                slotZ: FORMATION_DEPTH,
                roomL: 0,
                roomR: 0,
                curX: null,
                curZ: null,
                drawW: bb.visW,
                anim: {
                    hurt: 0, white: 0, shake: 0, death: 0, buff: 0,
                    atk: -1, atkStyle: 'lunge', projFired: false,
                    spawn: enemy.summoned ? 1 : 0,
                    // fase e ritmo aleatórios para os inimigos não respirarem em sincronia
                    phase: Math.random() * Math.PI * 2,
                    rate: 0.8 + Math.random() * 0.4
                }
            });
        });

        // Faixa lateral livre no tile à frente (em unidades do mundo, relativa ao eixo da câmera)
        const ax = state.player.x + fx;
        const ay = state.player.y + fz;
        const aheadFree = !isWallAt(ax, ay);
        let freeL = 0;
        let freeR = 0;
        if (aheadFree) {
            while (freeL < 2 && !isWallAt(ax - rx * (freeL + 1), ay - rz * (freeL + 1))) freeL++;
            while (freeR < 2 && !isWallAt(ax + rx * (freeR + 1), ay + rz * (freeR + 1))) freeR++;
        }
        const left = Math.max(-VIEW_HALF_WIDTH, -(TILE / 2 + freeL * TILE) + WALL_MARGIN);
        const right = Math.min(VIEW_HALF_WIDTH, (TILE / 2 + freeR * TILE) - WALL_MARGIN);

        state.enemies.forEach((enemy, i) => {
            const entry = combatSprites.get(enemy.uid);
            if (!entry) return;
            const col = clamp(typeof enemy.col === 'number' ? enemy.col : (i % 5), 0, 4);
            const row = Math.max(0, typeof enemy.row === 'number' ? enemy.row : 0);
            const span = Math.max(0.8, right - left);
            const margin = Math.min(0.45, span * 0.14);
            const colCenter = (left + margin) + (span - 2 * margin) * (col / 4);
            const peek = row > 0 ? (col <= 2 ? -0.22 : 0.22) : 0;
            const halfW = entry.visW * 0.5;
            const sx = halfW * 2 >= span
                ? (left + right) / 2
                : clamp(colCenter + peek, left + halfW, right - halfW);

            let depth = row === 0
                ? (entry.isBoss ? 2.2 : 2.1)
                : clamp(2.68 + (row - 1) * 0.16, FORMATION_MIN_DEPTH, FORMATION_MAX_DEPTH);
            if (!aheadFree) depth = row === 0 ? 0.8 : 1.15;

            entry.col = col;
            entry.row = row;
            entry.slotX = sx;
            entry.slotZ = depth;
            entry.roomL = Math.max(0, sx - entry.visW / 2 - left);
            entry.roomR = Math.max(0, right - (sx + entry.visW / 2));
            entry.limL = left;
            entry.limR = right;
            entry.fwdX = fx;
            entry.fwdZ = fz;
            entry.originX = state.player.x * TILE;
            entry.originZ = state.player.y * TILE;
            entry.rightX = rx;
            entry.rightZ = rz;
            entry.baseX = state.player.x * TILE + fx * depth + rx * sx;
            entry.baseZ = state.player.y * TILE + fz * depth + rz * sx;
            if (entry.curX === null) {
                entry.curX = entry.baseX;
                entry.curZ = entry.baseZ;
            }
            entry.overkill = !!enemy.overkill;
            entry.alive = enemy.hp > 0 || !!enemy.overkill;
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
            // O campo de visão horizontal precisa cobrir a faixa da formação (VIEW_HALF_WIDTH na
            // fileira da frente); em janelas estreitas (celular) o FOV vertical aumenta para isso.
            const needTan = (VIEW_HALF_WIDTH + 0.25) / (FORMATION_DEPTH - 0.3);
            const fovDeg = 2 * Math.atan(needTan / (w / h)) * 180 / Math.PI;
            camera.fov = clamp(fovDeg, 70, 102);
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

    function drawPixelFlame(cx, cy) {
        hctx.fillStyle = '#0b0710';
        hctx.fillRect(cx - 5, cy - 6, 10, 11);
        hctx.fillStyle = '#e24a33';
        hctx.fillRect(cx - 4, cy - 3, 8, 7);
        hctx.fillRect(cx - 2, cy - 5, 4, 2);
        hctx.fillStyle = '#f59e0b';
        hctx.fillRect(cx - 3, cy - 2, 6, 5);
        hctx.fillStyle = '#fff3b0';
        hctx.fillRect(cx - 1, cy, 2, 3);
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
        if (currentState && currentState.mode === 'combat') {
            const ordered = currentState.enemies.slice().sort((a, b) => (b.row || 0) - (a.row || 0));
            ordered.forEach(e => {
                if (e.hp <= 0 && !e.overkill) return;
                const col = clamp(typeof e.col === 'number' ? e.col : 2, 0, 4);
                const row = Math.max(0, e.row || 0);
                const sx = W * (0.16 + (col / 4) * 0.68) + (row > 0 ? (col <= 2 ? -18 : 18) : 0);
                const sz = Math.min(W, H) * (e.isBoss ? 0.36 : (row > 0 ? 0.2 : 0.27));
                const by = row > 0 ? H * 0.6 : H * 0.72;
                const sheet = window.GameSprites.getSheet(e.kind);
                hctx.imageSmoothingEnabled = false;
                hctx.drawImage(sheet.normal, sx - sz / 2, by - sz, sz, sz);
            });
        }
    }

    // Labels ancorados na projeção do topo real da cabeça de cada sprite.
    function drawCombatHud(now) {
        enemyHitboxes.length = 0;
        if (!currentState || currentState.mode !== 'combat') return;

        // Indicadores de Burn por coluna (0..4)
        if (currentState.columnBurn) {
            for (let c = 0; c < 5; c++) {
                const stacks = currentState.columnBurn[c] || 0;
                if (stacks <= 0) continue;
                const pos = getColumnLocalPos(c);
                drawPixelFlame(Math.round(pos.x - 20), Math.round(pos.y));
                drawOutlined('BURN ' + stacks, pos.x + 12, pos.y, 13, '#ffb347');
            }
        }

        const enemies = currentState.enemies;
        const items = [];

        enemies.forEach(enemy => {
            if (enemy.hp <= 0 && !enemy.overkill) return;
            const col = clamp(typeof enemy.col === 'number' ? enemy.col : 2, 0, 4);
            const row = Math.max(0, enemy.row || 0);
            const isRear = row > 0;
            let sx = viewW * (0.16 + (col / 4) * 0.68) + (isRear ? (col <= 2 ? -18 : 18) : 0);
            let topY = viewH * (enemy.isBoss ? 0.28 : (isRear ? 0.38 : 0.42));
            let botY = viewH * (isRear ? 0.6 : 0.72);
            let widthPx = viewH * (isRear ? 0.18 : 0.24);

            const entry = combatSprites.get(enemy.uid);
            if (webglOk && entry) {
                const top = project3D(entry.curX, entry.visH, entry.curZ);
                const bot = project3D(entry.curX, 0, entry.curZ);
                if (top && bot) {
                    sx = top.x;
                    topY = top.y;
                    botY = bot.y;
                    widthPx = entry.visW * top.s;
                }
            }

            const isTarget = currentState.targetUid === enemy.uid;
            const compactView = viewW < 520;
            const bw = clamp(widthPx * 0.82, compactView ? 42 : 56, compactView ? 92 : 128);
            const nameSize = clamp(bw * 0.15, compactView ? 11 : 13, 17);
            hctx.font = Math.round(nameSize) + 'px "Jersey 15", monospace';
            items.push({
                enemy: enemy,
                isRear: isRear,
                sx: sx,
                topY: topY,
                botY: botY,
                widthPx: widthPx,
                bw: bw,
                nameSize: nameSize,
                nameW: hctx.measureText(enemy.name).width,
                isTarget: isTarget,
                showName: !isRear || isTarget,
                showIntent: !isRear,
                lift: isRear ? 10 : 0
            });
        });

        // A barra nunca é mais larga que o espaço até o vizinho na mesma linha.
        const byX = items.slice().sort((a, b) => a.sx - b.sx);
        byX.forEach((it, i) => {
            let gap = Infinity;
            if (i > 0 && byX[i - 1].isRear === it.isRear) gap = Math.min(gap, it.sx - byX[i - 1].sx);
            if (i < byX.length - 1 && byX[i + 1].isRear === it.isRear) gap = Math.min(gap, byX[i + 1].sx - it.sx);
            it.bw = Math.max(34, Math.min(it.bw, gap - 10));
        });

        // Sem "voar para o teto": em colisão, labels não-alvo viram só a barra (sem nome/intenção)
        // e, no máximo, sobem um degrau curto. O bloco fica sempre colado na cabeça do sprite.
        const blockW = it => Math.max(it.bw, it.showName ? it.nameW : 0, it.showIntent ? 74 : 0) + 8;
        const sorted = items.slice().sort((a, b) => a.sx - b.sx);
        const cxOf = it => clamp(it.sx, blockW(it) / 2 + 4, viewW - blockW(it) / 2 - 4);
        const collide = (a, b) => Math.abs(cxOf(a) - cxOf(b)) < (blockW(a) + blockW(b)) / 2;
        for (let pass = 0; pass < 2; pass++) {
            for (let i = 1; i < sorted.length; i++) {
                const a = sorted[i - 1];
                const b = sorted[i];
                if (!collide(a, b)) continue;
                if (pass === 0) {
                    [a, b].forEach(it => { if (!it.isTarget) it.showName = false; });
                } else {
                    [a, b].forEach(it => { if (!it.isTarget) it.showIntent = false; });
                    if (collide(a, b) && a.lift === b.lift) b.lift += 16;
                }
            }
        }

        // Desenha retaguarda primeiro para que a linha de frente fique visualmente acima.
        items.sort((a, b) => (b.isRear ? 1 : 0) - (a.isRear ? 1 : 0));

        items.forEach(it => {
            const enemy = it.enemy;
            const cx = cxOf(it);
            const bw = it.bw;
            const bh = 10;
            // de baixo para cima a partir da cabeça: intenção, barra de HP, nome
            const intentY = it.topY - 10 - it.lift;
            const by = (it.showIntent ? intentY - 22 : it.topY - 16 - it.lift);
            const safeBy = Math.max(76, by);
            const bx = cx - bw / 2;

            enemyHitboxes.push({
                id: enemy.uid,
                x: it.sx - Math.max(it.widthPx, bw) * 0.5,
                y: safeBy - 20,
                w: Math.max(it.widthPx, bw),
                h: it.botY - (safeBy - 20)
            });

            if (hoveredCard && hoveredCard.previewUids && hoveredCard.previewUids.includes(enemy.uid)) {
                drawReticle(it.sx, (it.topY + it.botY) * 0.5, Math.min(it.widthPx, it.botY - it.topY) * 0.95, now, hoveredCard.target === 'all');
            }

            if (enemy.elite) {
                // Aura pulsante dourada em volta do Elite + coroa acima do nome
                const auraR = Math.max(it.widthPx, it.botY - it.topY) * (0.56 + Math.sin(now / 240) * 0.04);
                hctx.save();
                hctx.globalAlpha = 0.28 + Math.sin(now / 240) * 0.1;
                hctx.fillStyle = '#ffd147';
                hctx.beginPath();
                hctx.arc(it.sx, (it.topY + it.botY) * 0.5, auraR, 0, Math.PI * 2);
                hctx.fill();
                hctx.restore();
                drawEliteCrown(cx, safeBy - (it.showName ? 30 : 14), 3, now);
            }
            if (enemy.frost > 0) {
                drawOutlined('GELO x' + enemy.frost, cx, it.botY - 10, 13, '#b3e5fc');
            }
            if (it.showName) {
                const labelName = it.isRear ? enemy.name + ' [RET]' : enemy.name;
                drawOutlined(labelName, cx, safeBy - 11, it.nameSize, it.isTarget ? '#fff5d4' : (it.isRear ? '#b8adc4' : '#efe6d8'));
            }
            if (it.isTarget) {
                const pulse = Math.round(Math.sin(now / 150) * 3);
                drawPixelArrowDown(Math.round(cx), Math.round(safeBy - (it.showName ? 28 : 12) + pulse));
            }

            hctx.fillStyle = '#0d0812';
            hctx.fillRect(bx - 2, safeBy - 2, bw + 4, bh + 4);
            hctx.fillStyle = '#3b1518';
            hctx.fillRect(bx, safeBy, bw, bh);
            const hpPct = clamp(enemy.hp / enemy.maxHp, 0, 1);
            hctx.fillStyle = enemy.overkill ? '#ffd147' : (enemy.frost > 0 ? '#69c8f0' : (enemy.isBoss ? '#e84545' : (it.isRear ? '#9e3829' : '#d8452f')));
            hctx.fillRect(bx, safeBy, Math.max(enemy.overkill ? bw : 2, bw * hpPct), bh);
            if (enemy.shield > 0) {
                hctx.fillStyle = '#69c8f0';
                hctx.fillRect(bx, safeBy + bh - 2, bw, 2);
            }
            if (enemy.isBoss && !enemy.overkill) {
                // marcas das fases do chefe (66% e 33%)
                hctx.fillStyle = '#0d0812';
                hctx.fillRect(Math.round(bx + bw * 0.66), safeBy, 2, bh);
                hctx.fillRect(Math.round(bx + bw * 0.33), safeBy, 2, bh);
            }
            const hpText = enemy.overkill
                ? 'OVERKILL!'
                : (enemy.shield > 0 ? enemy.hp + ' (+' + enemy.shield + ')' : enemy.hp + '/' + enemy.maxHp);
            drawOutlined(hpText, cx, safeBy + bh / 2 + 1, 12, enemy.overkill ? '#fff6c9' : '#ffffff');

            // Somente inimigos na linha de frente (row === 0) mostram intenção de ataque no turno
            if (!it.showIntent || it.isRear) return;
            const iy = safeBy + bh + 11;
            if (enemy.overkill) {
                drawOutlined('BATA P/ +VR!', cx, iy, 13, '#ffe066');
            } else if (enemy.stunned) {
                drawPixelStun(Math.round(cx - 38), Math.round(iy));
                drawOutlined('ATORDOADO', cx + 8, iy, 13, '#69c8f0');
            } else if (enemy.disarmed) {
                drawPixelStun(Math.round(cx - 42), Math.round(iy));
                drawOutlined('DESARMADO!', cx + 8, iy, 13, '#69c8f0');
            } else if (enemy.intent === 'armor') {
                drawOutlined('ESCUDO +' + enemy.armorGain, cx, iy, 14, '#69c8f0');
            } else if (enemy.intent === 'curse') {
                drawOutlined('CURSE +' + window.GameData.BALANCE.curseStep + '%', cx, iy, 14, '#c084fc');
            } else if (enemy.intent === 'attack' && enemy.hasIntent === false) {
                drawOutlined('CONGELADO', cx, iy, 13, '#b3e5fc');
            } else if (enemy.hasIntent !== false) {
                let tag = '';
                if (enemy.attacksPerTurn > 1) tag = ' x' + enemy.attacksPerTurn;
                else if (enemy.drainMana) tag = ' [DRENA]';
                else if (enemy.shieldPerTurn) tag = ' [+ESC]';
                else if (enemy.curseCard) tag = ' [+LIXO]';
                else if (enemy.summonKind) tag = ' [INVOCA]';
                else if (enemy.buffAllies) tag = ' [+BUFF]';
                if (enemy.stunImmune > 0) tag = ' [IMUNE 1t]';
                const label = 'ATK ' + enemy.atk + tag;
                drawPixelSword(Math.round(cx - (tag ? 50 : 26)), Math.round(iy));
                drawOutlined(label, cx + 8, iy, 14, enemy.stunImmune > 0 ? '#69c8f0' : (enemy.isBoss ? '#ff9f68' : '#f0a03c'));
            }
        });

        drawProjectiles();
    }

    // Projéteis pixelados voando do inimigo até a tela (folha / onda / orbe de energia)
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
            } else if (pr.kind === 'orb') {
                const u = Math.max(3, Math.round(size / 8));
                const s2 = Math.round(size * 0.5);
                hctx.fillStyle = '#0d0812';
                hctx.fillRect(-s2 - u, -s2 + u, (s2 + u) * 2, (s2 - u) * 2);
                hctx.fillRect(-s2 + u, -s2 - u, (s2 - u) * 2, (s2 + u) * 2);
                hctx.fillStyle = pr.color || '#9fe8ff';
                hctx.fillRect(-s2, -s2 + u * 2, s2 * 2, (s2 - u * 2) * 2);
                hctx.fillRect(-s2 + u * 2, -s2, (s2 - u * 2) * 2, s2 * 2);
                hctx.fillStyle = '#ffffff';
                hctx.fillRect(-u * 2, -u * 2, u * 3, u * 3);
            } else {
                // Folha girando em passos de 22.5 graus (aspecto pixelado)
                hctx.rotate(Math.floor(p * 14) * (Math.PI / 8));
                const w = size * 0.78;
                const h = size;
                const u = Math.max(2, Math.round(size / 14));
                hctx.fillStyle = '#0d0812';
                hctx.fillRect(-w / 2 - u, -h / 2 - u, w + u * 2, h + u * 2);
                hctx.fillStyle = '#f4f1e6';
                hctx.fillRect(-w / 2, -h / 2, w, h);
                hctx.fillStyle = '#9aa7b8';
                for (let ly = -h / 2 + u * 3; ly < h / 2 - u; ly += u * 3) {
                    hctx.fillRect(-w / 2 + u, ly, w - u * 2, u);
                }
                hctx.fillStyle = '#22386b';
                hctx.fillRect(w / 2 - u * 5, h / 2 - u * 5, u * 4, u * 4);
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

    // ---------------------------------------------------------------------------------
    // EFEITOS ARCADE (canvas da HUD): projéteis de cartas, números de dano e chuva de loot
    // ---------------------------------------------------------------------------------
    const fxProjectiles = [];
    const damageNumbers = [];
    const lootDrops = [];
    const LOOT_MAX = 14;
    const INK = '#0d0812';
    const PIX = {
        K: INK, w: '#f4f1e6', g: '#9aa7b8', y: '#ffd147', b: '#7a4a21', B: '#4a2d1a', l: '#c98f55',
        d: '#2a2236', e: '#ff4a4a'
    };
    const PIX_BLADE = [
        '...K...', '..KwK..', '..KwK..', '..KwK..', '..KwK..', '..KgK..',
        '..KgK..', '.KKyKK.', '.KyyyK.', '..KbK..', '..KKK..'
    ];
    const PIX_FLASK = [
        '..KKK..', '..KwK..', '..KwK..', '.KKBKK.', 'KBBBBBK',
        'KBlBBBK', 'KBBBBBK', '.KBBBK.', '..KKK..'
    ];
    const PIX_CROW = [
        ['K.......K', 'KdK.K.KdK', 'KddKdKddK', '.KddddddK', '..KddedK.', '...KKKy..'],
        ['...KKK...', '.KKdddKK.', 'KdddedddK', 'KdKdddKdK', 'K..KdK..K', '....K....']
    ];
    const FX_DEFAULT_MS = { blade: 160, fire: 200, orb: 180, flask: 220, wave: 240, bolt: 160, crow: 220 };
    const FX_BURST = {
        blade: ['#ffffff', '#9aa7b8'], fire: ['#ff7a1e', '#ffd147', '#ffffff'], orb: ['#c084fc', '#9fe8ff', '#ffffff'],
        flask: ['#c98f55', '#4a2d1a', '#ffffff'], bolt: ['#ffe14a', '#ffffff'], crow: ['#2a2236', '#ff4a4a']
    };
    // Ícone da carta -> tipo de projétil; sem ícone conhecido, decide pelo alvo/sfx.
    const PROJECTILE_BY_ICON = {
        c_dagger: 'blade', c_sword: 'blade', c_blades: 'blade', c_shadow: 'blade',
        c_wild: 'orb', c_flask: 'flask', c_bolt: 'bolt', c_crows: 'crow',
        c_comet: 'fire', c_sun: 'fire'
    };

    function getProjectileKindForCard(card) {
        if (!card) return 'orb';
        if (PROJECTILE_BY_ICON[card.icon]) return PROJECTILE_BY_ICON[card.icon];
        if (card.sfx === 'whip') return 'bolt';
        if (card.targeting === 'FrontRow') return 'wave';
        return 'orb';
    }

    function toLocal(clientX, clientY) {
        const rect = hudCanvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function fxUnit() {
        return Math.max(3, Math.round(viewH / 110));
    }

    // opts: { kind, toUid, toCol, fromCol, duration (ms), onHit }. Sem canvas utilizável, só chama onHit.
    function fireProjectile(opts) {
        const o = opts || {};
        const kind = FX_DEFAULT_MS[o.kind] ? o.kind : 'orb';
        const dur = (o.duration || FX_DEFAULT_MS[kind]) / 1000;
        const pr = { kind: kind, t: 0, dur: dur, done: false, onHit: o.onHit };
        if (!hctx || !hudCanvas || viewW <= 0 || viewH <= 0) {
            finishProjectile(pr);
            return;
        }
        let target = { x: viewW / 2, y: viewH * 0.45 };
        if (o.toUid != null && combatSprites.has(o.toUid)) {
            target = enemyLocalPos(combatSprites.get(o.toUid), 0.55);
        } else if (o.toCol != null) {
            const c = getColumnLocalPos(o.toCol);
            target = { x: c.x, y: c.y - viewH * 0.12 };
        }
        pr.sx = viewW / 2;
        pr.sy = viewH * 0.92;
        pr.tx = target.x;
        pr.ty = target.y;
        if (kind === 'wave') {
            // varre a fila da frente: de fromCol (padrão 0) até toCol (padrão 4)
            const a = getColumnLocalPos(o.fromCol == null ? 0 : o.fromCol);
            const b = getColumnLocalPos(o.toCol == null ? 4 : o.toCol);
            const margin = viewW * 0.08 * (b.x >= a.x ? 1 : -1);
            pr.sx = a.x - margin;
            pr.tx = b.x + margin;
            pr.sy = pr.ty = getColumnLocalPos(2).y - viewH * 0.1;
        }
        fxProjectiles.push(pr);
        // se o rAF estiver pausado (aba em segundo plano) o combate não pode travar esperando o hit
        setTimeout(() => finishProjectile(pr), dur * 1000 + 120);
    }

    function finishProjectile(pr) {
        if (pr.done) return;
        pr.done = true;
        if (pr.tx != null && pr.kind !== 'wave') {
            spawnBurstLocal(pr.tx, pr.ty, FX_BURST[pr.kind], 9, { speed: 170, life: 0.35, size: 5, spread: 14, gravity: 120 });
        }
        if (pr.onHit) {
            try { pr.onHit(); } catch (e) { console.error(e); }
        }
    }

    // x/y em coordenadas de tela (client), como spawnBurst.
    function spawnDamageNumber(x, y, amount, opts) {
        if (!hctx || !hudCanvas || viewW <= 0) return;
        const p = toLocal(x, y);
        const crit = !!(opts && opts.crit);
        damageNumbers.push({
            x: p.x + (Math.random() - 0.5) * 22,
            y: p.y,
            text: String(amount),
            crit: crit,
            t: 0,
            dur: crit ? 0.9 : 0.7
        });
        if (damageNumbers.length > 30) damageNumbers.shift();
    }

    // Chuva de loot: gemas/moedas saltam, quicam uma vez e voam até xpTarget/vrTarget ({x, y} em client).
    function spawnLootRain(x, y, opts) {
        const o = opts || {};
        const gems = Math.max(0, o.gems || 0);
        const coins = Math.max(0, o.coins || 0);
        const k = Math.min(1, LOOT_MAX / Math.max(1, gems + coins));
        const nGems = Math.round(gems * k);
        const nCoins = Math.min(coins ? Math.max(1, Math.round(coins * k)) : 0, LOOT_MAX - nGems);
        const total = nGems + nCoins;
        if (!hctx || !hudCanvas || viewW <= 0 || viewH <= 0) {
            for (let i = 0; i < total; i++) {
                if (o.onArrive) o.onArrive({ kind: i < nGems ? 'gem' : 'coin' });
            }
            return;
        }
        const p = toLocal(x, y);
        for (let i = 0; i < total; i++) {
            const isGem = i < nGems;
            const tgt = isGem ? o.xpTarget : o.vrTarget;
            lootDrops.push({
                kind: isGem ? 'gem' : 'coin',
                color: isGem ? (i % 2 ? '#4be07a' : '#4aa3ff') : '#ffd147',
                x: p.x + (Math.random() - 0.5) * 20,
                y: p.y,
                vx: (Math.random() - 0.5) * viewH * 0.5,
                vy: -viewH * (0.5 + Math.random() * 0.3),
                floorY: p.y + viewH * (0.03 + Math.random() * 0.06),
                bounces: 0,
                phase: 'air',
                wait: 0.12 + i * 0.02,
                t: 0,
                dur: 0.45 + i * 0.015,
                target: tgt ? toLocal(tgt.x, tgt.y) : null,
                onArrive: o.onArrive,
                spin: Math.random() * 6
            });
        }
    }

    function updateFx(dt) {
        for (let i = fxProjectiles.length - 1; i >= 0; i--) {
            const pr = fxProjectiles[i];
            pr.t += dt;
            if (pr.t >= pr.dur) finishProjectile(pr);
            if (pr.done) fxProjectiles.splice(i, 1);
        }
        for (let i = damageNumbers.length - 1; i >= 0; i--) {
            damageNumbers[i].t += dt;
            if (damageNumbers[i].t >= damageNumbers[i].dur) damageNumbers.splice(i, 1);
        }
        const g = viewH * 2.4;
        for (let i = lootDrops.length - 1; i >= 0; i--) {
            const d = lootDrops[i];
            d.spin += dt * 12;
            let arrived = false;
            if (d.phase === 'air') {
                d.vy += g * dt;
                d.x += d.vx * dt;
                d.y += d.vy * dt;
                if (d.vy > 0 && d.y >= d.floorY) {
                    d.y = d.floorY;
                    if (d.bounces === 0) {
                        d.bounces = 1;
                        d.vy *= -0.42;
                        d.vx *= 0.6;
                    } else {
                        d.phase = 'rest';
                    }
                }
            } else if (d.phase === 'rest') {
                d.wait -= dt;
                if (d.wait <= 0) {
                    if (d.target) {
                        d.phase = 'fly';
                        d.sx = d.x;
                        d.sy = d.y;
                        d.cx = (d.x + d.target.x) / 2 + (Math.random() - 0.5) * viewW * 0.2;
                        d.cy = Math.min(d.y, d.target.y) - viewH * 0.15;
                    } else {
                        arrived = true;
                    }
                }
            } else {
                d.t += dt;
                const p = clamp(d.t / d.dur, 0, 1);
                const q = p * p;
                const inv = 1 - q;
                d.x = inv * inv * d.sx + 2 * inv * q * d.cx + q * q * d.target.x;
                d.y = inv * inv * d.sy + 2 * inv * q * d.cy + q * q * d.target.y;
                arrived = p >= 1;
            }
            if (arrived) {
                lootDrops.splice(i, 1);
                if (d.onArrive) {
                    try { d.onArrive({ kind: d.kind }); } catch (e) { console.error(e); }
                }
            }
        }
    }

    function fxPos(pr, p) {
        const q = Math.max(0, p);
        let x = pr.sx + (pr.tx - pr.sx) * q;
        let y = pr.sy + (pr.ty - pr.sy) * q;
        if (pr.kind === 'flask') y -= Math.sin(q * Math.PI) * viewH * 0.3;
        if (pr.kind === 'crow') x += Math.sin(q * 9) * viewW * 0.02;
        return { x: x, y: y };
    }

    function drawGrid(rows, cx, cy, u) {
        const x0 = Math.round(cx - rows[0].length * u / 2);
        const y0 = Math.round(cy - rows.length * u / 2);
        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
                const ch = rows[r][c];
                if (ch === '.') continue;
                hctx.fillStyle = PIX[ch];
                hctx.fillRect(x0 + c * u, y0 + r * u, u, u);
            }
        }
    }

    function drawDiamond(cx, cy, r, u, color) {
        hctx.fillStyle = color;
        for (let dy = -r; dy <= r; dy++) {
            const half = r - Math.abs(dy);
            hctx.fillRect(Math.round(cx - (half + 0.5) * u), Math.round(cy + (dy - 0.5) * u), (half * 2 + 1) * u, u);
        }
    }

    function drawPixLine(ax, ay, bx, by, th, color) {
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (th * 0.5)));
        hctx.fillStyle = color;
        for (let i = 0; i <= steps; i++) {
            const f = i / steps;
            hctx.fillRect(Math.round(ax + (bx - ax) * f - th / 2), Math.round(ay + (by - ay) * f - th / 2), Math.round(th), Math.round(th));
        }
    }

    function drawBoltFx(pr, p, u) {
        const grow = clamp(p / 0.6, 0, 1);
        const ex = pr.sx + (pr.tx - pr.sx) * grow;
        const ey = pr.sy + (pr.ty - pr.sy) * grow;
        const seed = Math.floor(pr.t * 30);
        const pts = [];
        for (let i = 0; i <= 9; i++) {
            const r = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
            const j = i === 0 || i === 9 ? 0 : (r - Math.floor(r) - 0.5) * 2 * u * 5;
            pts.push({ x: pr.sx + (ex - pr.sx) * i / 9 + j, y: pr.sy + (ey - pr.sy) * i / 9 });
        }
        hctx.globalAlpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
        [[u * 2.6, INK], [u * 1.6, '#ffe14a'], [u * 0.8, '#ffffff']].forEach(pass => {
            for (let i = 0; i < 9; i++) drawPixLine(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, pass[0], pass[1]);
        });
        hctx.globalAlpha = 1;
    }

    // Crista de onda pixelada varrendo a fila da frente (dir = sentido do movimento)
    function drawWaveFx(pr, p, u) {
        const x = pr.sx + (pr.tx - pr.sx) * p;
        const dir = pr.tx >= pr.sx ? 1 : -1;
        const n = Math.round(viewH / u * 0.13);
        hctx.globalAlpha = p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1;
        [[1, INK, 1], [0, '#69c8f0', 0], [-2, '#ffffff', 0]].forEach(layer => {
            hctx.fillStyle = layer[1];
            for (let j = -n - layer[2]; j <= n + layer[2]; j++) {
                const w = Math.round((1 - Math.pow(j / n, 2)) * 5) + 2 + layer[0];
                if (w <= 0) continue;
                hctx.fillRect(Math.round(dir > 0 ? x - w * u : x), Math.round(pr.sy + j * u), w * u, u);
            }
        });
        hctx.globalAlpha = 1;
    }

    function drawFxProjectile(pr) {
        const p = clamp(pr.t / pr.dur, 0, 1);
        const u0 = fxUnit();
        const u = Math.max(2, Math.round(u0 * (1.3 - 0.5 * p)));
        if (pr.kind === 'wave') return drawWaveFx(pr, p, u0);
        if (pr.kind === 'bolt') return drawBoltFx(pr, p, u0);
        const h = fxPos(pr, p);
        if (pr.kind === 'fire' || pr.kind === 'orb' || pr.kind === 'blade') {
            const trail = pr.kind === 'fire' ? ['#ff7a1e', '#e0451f'] : pr.kind === 'orb' ? ['#c084fc', '#9fe8ff'] : ['#ffffff', '#9aa7b8'];
            for (let k = 1; k <= 5; k++) {
                const q = fxPos(pr, p - k * 0.045);
                const sz = Math.max(2, Math.round(u * (3.2 - k * 0.5)));
                hctx.globalAlpha = 0.6 - k * 0.1;
                hctx.fillStyle = trail[k % 2];
                hctx.fillRect(Math.round(q.x - sz / 2), Math.round(q.y - sz / 2), sz, sz);
            }
            hctx.globalAlpha = 1;
        }
        if (pr.kind === 'fire') {
            drawDiamond(h.x, h.y, 4, u, INK);
            drawDiamond(h.x, h.y, 3, u, '#e0451f');
            drawDiamond(h.x, h.y, 2, u, '#ff9f1e');
            drawDiamond(h.x, h.y, 1, u, '#fff2a8');
        } else if (pr.kind === 'orb') {
            const r = 3 + (Math.floor(pr.t * 30) % 2);
            drawDiamond(h.x, h.y, r + 1, u, INK);
            drawDiamond(h.x, h.y, r, u, '#c084fc');
            drawDiamond(h.x, h.y, r - 1, u, '#9fe8ff');
            drawDiamond(h.x, h.y, 1, u, '#ffffff');
        } else if (pr.kind === 'crow') {
            drawGrid(PIX_CROW[Math.floor(pr.t * 18) % 2], h.x, h.y, u);
        } else {
            // lâmina/frasco girando em passos discretos (aspecto pixelado)
            const step = pr.kind === 'flask' ? Math.PI / 2 : Math.PI / 4;
            hctx.save();
            hctx.translate(Math.round(h.x), Math.round(h.y));
            hctx.rotate(Math.floor(pr.t * (pr.kind === 'flask' ? 24 : 40)) * step);
            drawGrid(pr.kind === 'flask' ? PIX_FLASK : PIX_BLADE, 0, 0, u);
            hctx.restore();
        }
    }

    function drawDamageNumber(d) {
        const p = d.t / d.dur;
        const pop = d.t < 0.09 ? 1.5 - (d.t / 0.09) * 0.5 : 1;
        const size = clamp(viewH * 0.05, 22, 38) * (d.crit ? 1.5 : 1) * pop;
        const y = d.y - viewH * 0.09 * (1 - Math.pow(1 - clamp(p / 0.6, 0, 1), 2));
        hctx.globalAlpha = p > 0.65 ? 1 - (p - 0.65) / 0.35 : 1;
        if (d.crit) drawOutlined('CRIT!', d.x, y - size * 0.85, size * 0.55, '#fff2a8');
        drawOutlined(d.text, d.x, y, size, d.crit ? '#ff8a1e' : '#ffe14a');
        hctx.globalAlpha = 1;
    }

    function drawLootDrop(d) {
        const u = Math.max(2, Math.round(viewH / 160));
        if (d.kind === 'gem') {
            drawDiamond(d.x, d.y, 3, u, INK);
            drawDiamond(d.x, d.y, 2, u, d.color);
            hctx.fillStyle = '#ffffff';
            hctx.fillRect(Math.round(d.x - u), Math.round(d.y - u * 1.5), u, u);
        } else {
            const w = Math.max(1, Math.round(Math.abs(Math.cos(d.spin)) * 4));
            hctx.fillStyle = INK;
            hctx.fillRect(Math.round(d.x - (w / 2 + 1) * u), Math.round(d.y - 3 * u), (w + 2) * u, u * 6);
            hctx.fillStyle = '#ffd147';
            hctx.fillRect(Math.round(d.x - (w / 2) * u), Math.round(d.y - 2 * u), w * u, u * 4);
            if (w > 2) {
                hctx.fillStyle = '#fff6c9';
                hctx.fillRect(Math.round(d.x - (w / 2) * u), Math.round(d.y - 2 * u), u, u * 2);
            }
        }
    }

    function drawFx() {
        hctx.imageSmoothingEnabled = false;
        fxProjectiles.forEach(drawFxProjectile);
        lootDrops.forEach(drawLootDrop);
        damageNumbers.forEach(drawDamageNumber);
    }

    // A coroa é desenhada na HUD (sem teste de profundidade): só aparece sem parede no caminho.
    function hasClearLine(x0, z0, x1, z1) {
        const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)) * 3);
        for (let i = 1; i < steps; i++) {
            const row = mapGrid[Math.round(z0 + (z1 - z0) * i / steps)];
            if (!row || row[Math.round(x0 + (x1 - x0) * i / steps)] === '#') return false;
        }
        return true;
    }

    // Coroa flutuando sobre os Elites vistos no mapa (exploração).
    function drawEliteMarkers(now) {
        if (!webglOk || !currentState || currentState.mode === 'combat') return;
        for (const entry of encounterSprites.values()) {
            if (!entry.isElite || !entry.alive || !entry.sprite || !entry.sprite.visible) continue;
            if (!hasClearLine(camX, camZ, entry.x, entry.z)) continue;
            const p = project3D(entry.x * TILE, entry.visH + 0.2, entry.z * TILE);
            if (!p || p.x < 0 || p.x > viewW || p.y < 0 || p.y > viewH) continue;
            drawEliteCrown(p.x, p.y, clamp(Math.round(p.s * 0.06), 2, 5), now);
        }
    }

    // Ícone de alerta "!" vermelho sobre o encontro que avistou o jogador
    function drawEncounterAlert(now) {
        if (!encounterAlert) return;
        const entry = encounterSprites.get(encounterAlert.id);
        if (!entry) return;
        let x = viewW * 0.5;
        let y = viewH * 0.3;
        if (webglOk) {
            const p = project3D(entry.x * TILE, entry.visH + 0.15, entry.z * TILE);
            if (!p) return;
            x = clamp(p.x, 40, viewW - 40);
            y = clamp(p.y, 76, viewH * 0.7);
        }
        const age = encounterAlert.dur - encounterAlert.time;
        const pop = age < 0.14 ? 1.7 - (age / 0.14) * 0.7 : 1 + Math.sin(now / 55) * 0.06;
        const size = clamp(viewH * 0.13, 44, 84) * pop;
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

    const MINI_THEMES = {
        beach: { wall: '#2f6f7a', wallLine: '#1d4a52', floor: '#f3e2b6' },
        city: { wall: '#3a4257', wallLine: '#1f2330', floor: '#c9cbd6' },
        snow: { wall: '#7fb0dc', wallLine: '#4f86b8', floor: '#f4faff' },
        dungeon: { wall: '#593e25', wallLine: '#362312', floor: '#f5e7c8' },
        abyss: { wall: '#1a1238', wallLine: '#120c2b', floor: '#b9a8ff' }
    };

    function renderMinimap() {
        if (!mctx || !currentState || !mapRows) return;
        const mw = miniCanvas.width;
        const mh = miniCanvas.height;
        const theme = MINI_THEMES[biomeName] || MINI_THEMES.dungeon;

        mctx.fillStyle = '#e6d2a8';
        mctx.fillRect(0, 0, mw, mh);
        mctx.strokeStyle = '#c4ab7a';
        mctx.lineWidth = 4;
        mctx.strokeRect(2, 2, mw - 4, mh - 4);

        const cell = Math.floor(Math.min((mw - 12) / mapCols, (mh - 26) / mapRows));
        const ox = Math.floor((mw - cell * mapCols) / 2);
        const oy = Math.floor((mh - cell * mapRows) / 2) + 5;

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
                    mctx.fillStyle = theme.wall;
                    mctx.fillRect(px, py, cell, cell);
                    mctx.strokeStyle = theme.wallLine;
                    mctx.lineWidth = 1;
                    mctx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
                    continue;
                }
                mctx.fillStyle = theme.floor;
                mctx.fillRect(px, py, cell, cell);
                mctx.strokeStyle = 'rgba(90, 70, 50, 0.22)';
                mctx.lineWidth = 1;
                mctx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);

                const cleared = currentState.clearedTiles.has(key);
                const q = Math.max(2, Math.round(cell * 0.2));
                if (ch === 'C' && !cleared) {
                    mctx.fillStyle = '#d99a16';
                    mctx.fillRect(px + q, py + q, cell - q * 2, cell - q * 2);
                } else if (ch === 'M') {
                    mctx.fillStyle = '#e2622b';
                    mctx.fillRect(px + q, py + q, cell - q * 2, cell - q * 2);
                    mctx.fillStyle = '#ffd147';
                    mctx.fillRect(px + q * 2, py + q * 2, cell - q * 4, cell - q * 4);
                } else if (ch === '?' && !cleared) {
                    mctx.fillStyle = '#7b3fa8';
                    mctx.fillRect(px + q, py + q, cell - q * 2, cell - q * 2);
                } else if (ch === 'E') {
                    mctx.fillStyle = '#2b8a3e';
                    mctx.fillRect(px + q, py + q, cell - q * 2, cell - q * 2);
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
            mctx.fillStyle = alerted ? '#ff2a1a' : (entry.isBoss ? '#b81414' : (entry.isElite ? '#e0a80f' : '#d9480f'));
            mctx.strokeStyle = '#3a1208';
            mctx.lineWidth = 1;
            mctx.beginPath();
            mctx.arc(ecx, ecy, cell * (alerted ? 0.42 : (entry.isBoss ? 0.38 : 0.3)), 0, Math.PI * 2);
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

        mctx.fillStyle = 'rgba(54, 35, 18, 0.8)';
        mctx.font = 'bold 10px monospace';
        mctx.textAlign = 'left';
        mctx.textBaseline = 'alphabetic';
        mctx.fillText('MAPA DO DEVANEIO', 7, 13);
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

        if (stepBob > 0) stepBob = Math.max(0, stepBob - dt * 5.2);
        if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - dt);
        else shakeMag = 0;

        if (screenFlash.time > 0) {
            screenFlash.time = Math.max(0, screenFlash.time - dt);
            screenFlash.alpha = screenFlash.maxAlpha * (screenFlash.time / screenFlash.dur);
        } else {
            screenFlash.alpha = 0;
        }
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
        updateFx(dt);
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

        if (webglOk && renderer && scene && camera) {
            const wx = camX * TILE;
            const wz = camZ * TILE;
            const bobY = Math.sin(stepBob * Math.PI) * 0.08;
            let sx = 0, sy = 0;
            if (shakeTime > 0) {
                sx = (Math.random() * 2 - 1) * shakeMag;
                sy = (Math.random() * 2 - 1) * shakeMag;
            }
            camera.position.set(wx + sx, CAM_HEIGHT + bobY + sy, wz);
            camera.rotation.y = camYaw;
            camera.updateMatrixWorld();

            if (skyMesh) skyMesh.position.set(wx, 0, wz);
            if (playerLight) playerLight.position.set(wx, CAM_HEIGHT + 0.4, wz);
            if (waterTex) {
                waterTex.offset.x = (now * 0.000012) % 1;
                waterTex.offset.y = (now * 0.00002) % 1;
            }
            if (snowPoints) {
                const arr = snowPoints.geometry.attributes.position.array;
                for (let i = 0; i < arr.length; i += 3) {
                    arr[i + 1] -= dt * (0.9 + (i % 7) * 0.12);
                    arr[i] += dt * 0.35;
                    if (arr[i + 1] < 0) arr[i + 1] += 8;
                    if (arr[i] > 11) arr[i] -= 22;
                }
                snowPoints.geometry.attributes.position.needsUpdate = true;
                snowPoints.position.set(wx, 0, wz);
            }

            for (const t of torches) {
                const flick = 1 + Math.sin(now / 85 + t.seed) * 0.1 + Math.sin(now / 41 + t.seed * 2) * 0.07;
                t.light.intensity = t.base * flick;
                if (t.flame) {
                    const frame = Math.floor(now / 120 + t.seed) % t.frames.length;
                    if (t.flame.material.map !== t.frames[frame]) {
                        t.flame.material.map = t.frames[frame];
                        t.flame.material.needsUpdate = true;
                    }
                }
            }

            for (const obj of worldPickups.values()) {
                if (!obj.sprite.visible) continue;
                const breath = 1 + Math.sin(now / 320 + obj.sprite.position.x) * 0.03;
                obj.sprite.scale.set(obj.baseScale, obj.baseScale * breath, 1);
            }

            for (const e of epilogueSprites) {
                if (e.still) continue;
                const breath = Math.sin(now / 520 + e.phase);
                e.sprite.scale.set(e.scale * (1 - breath * 0.012), e.scale * (1 + breath * 0.025), 1);
            }

            // Idle dos encontros no mapa: respiração (escala ancorada nos pés), sem sair do chão
            for (const entry of encounterSprites.values()) {
                if (!entry.sprite || !entry.sprite.visible) continue;
                const breath = Math.sin(now / 430 * entry.rate + entry.phase);
                const alertHop = encounterAlert && encounterSprites.get(encounterAlert.id) === entry
                    ? Math.abs(Math.sin(now / 70)) * 0.1 : 0;
                entry.sprite.position.set(entry.x * TILE, alertHop, entry.z * TILE);
                const grow = entry.isElite ? 1.18 + Math.sin(now / 240) * 0.04 : 1;
                entry.sprite.scale.set(entry.baseScale * grow * (1 - breath * 0.015), entry.baseScale * grow * (1 + breath * 0.03), 1);
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

                // Limites: o recuo nunca passa do fim do tile livre; a investida para antes da câmera.
                const camDist = Math.hypot(wx - entry.curX, wz - entry.curZ) || 1;
                const recoil = Math.max(0, Math.min(0.14, FORMATION_MAX_DEPTH + 0.05 - entry.slotZ));
                const lungeReach = Math.max(0, camDist - 1.15);

                // --- Ataque: antecipação (pisca laranja/vermelho + recuo) -> investida/projétil -> retorno ---
                let toward = 0;
                let atkScale = 1;
                let atkHop = 0;
                let flash = 0;
                let flashColor = 0xffffff;
                if (a.atk >= 0 && entry.alive) {
                    a.atk += dt;
                    const t = a.atk;
                    const ranged = a.atkStyle !== 'lunge';
                    if (t < ATK_ANTICIPATION) {
                        const p = t / ATK_ANTICIPATION;
                        toward = -recoil * Math.sin(p * Math.PI * 0.5);
                        atkScale = 1 - 0.1 * p;
                        flash = 1;
                        flashColor = Math.floor(t / 0.05) % 2 === 0 ? 0xff8a1e : 0xff2a1a;
                    } else if (t < ATK_ANTICIPATION + ATK_STRIKE) {
                        const p = (t - ATK_ANTICIPATION) / ATK_STRIKE;
                        const ease = p * p;
                        if (ranged) {
                            toward = -recoil + Math.sin(p * Math.PI) * Math.min(0.4, lungeReach);
                            atkScale = 0.9 + Math.sin(p * Math.PI) * 0.2;
                            atkHop = Math.sin(p * Math.PI) * 0.12;
                            if (!a.projFired) {
                                a.projFired = true;
                                const sp = enemyLocalPos(entry, 0.6);
                                projectiles.push({
                                    kind: a.atkStyle,
                                    color: biome.orb,
                                    t: 0,
                                    dur: ATK_STRIKE,
                                    sx: sp.x,
                                    sy: sp.y
                                });
                            }
                        } else {
                            toward = -recoil + ease * (recoil + lungeReach);
                            atkScale = 0.9 + ease * 0.45;
                            atkHop = Math.sin(p * Math.PI) * 0.1;
                        }
                        if (p < 0.5) {
                            flash = 1;
                            flashColor = 0xff5a1e;
                        }
                    } else if (t < ATK_ANTICIPATION + ATK_STRIKE + ATK_RECOVER) {
                        const p = (t - ATK_ANTICIPATION - ATK_STRIKE) / ATK_RECOVER;
                        const back = 1 - (1 - p) * (1 - p);
                        if (ranged) {
                            toward = -recoil * (1 - back);
                            atkScale = 0.9 + 0.1 * back;
                        } else {
                            toward = lungeReach * (1 - back);
                            atkScale = 1.35 - 0.35 * back;
                        }
                    } else {
                        a.atk = -1;
                    }
                }

                // --- Idle contínuo: respiração (escala ancorada nos pés; nunca sai do chão) ---
                const breath = Math.sin(now / 420 * a.rate + a.phase);
                const idleSx = 1 - breath * 0.018;
                const idleSy = 1 + breath * 0.035;

                // --- Buff / invocação: salto curto ---
                const buffSin = a.buff > 0 ? Math.sin((1 - a.buff) * Math.PI) : 0;
                const buffHop = buffSin * 0.42;

                // --- Morte: treme e pisca, depois encolhe/dissolve no chão ---
                let deathSx = 1;
                let deathSy = 1;
                let alpha = 1;
                let deathShake = 0;
                let deathBlink = false;
                if (a.death > 0) {
                    if (a.death < 0.4) {
                        deathShake = Math.sin(now / 14) * 0.09;
                        deathBlink = Math.floor(now / 55) % 2 === 0;
                    } else {
                        const p = (a.death - 0.4) / 0.6;
                        deathSy = Math.max(0.02, 1 - p * p * 0.98);
                        deathSx = Math.max(0.05, 1 + p * 0.2 - p * p * 0.75);
                        alpha = 1 - p * p;
                        deathShake = Math.sin(now / 14) * 0.04 * (1 - p);
                    }
                }

                const spawnScale = a.spawn > 0 ? Math.max(0.02, (1 - a.spawn) * (1 + Math.sin((1 - a.spawn) * Math.PI) * 0.2)) : 1;

                // Tremor (dano/morte) apenas lateral e limitado à folga até a parede
                const rawShake = (a.shake > 0 ? Math.sin(now / 18) * 0.1 : 0) + deathShake;
                const shakeOffset = clamp(rawShake, -entry.roomL, entry.roomR);

                // A investida vai em direção à câmera (centro da tela)
                const tdx = (wx - entry.curX) / camDist;
                const tdz = (wz - entry.curZ) / camDist;
                let px = entry.curX + tdx * toward + (entry.rightX || 0) * shakeOffset;
                let pz = entry.curZ + tdz * toward + (entry.rightZ || 0) * shakeOffset;

                // Garantia por quadro: o sprite (já com a escala da animação) fica inteiro dentro da
                // faixa livre do tile à frente — nunca passa das paredes laterais nem da do fundo.
                const corridor = entry.limR - entry.limL;
                atkScale = Math.min(atkScale, corridor / (entry.visW * 1.03));
                const halfNow = entry.visW * atkScale * spawnScale * idleSx * deathSx * 0.5;
                const relX = px - entry.originX;
                const relZ = pz - entry.originZ;
                let lat = relX * entry.rightX + relZ * entry.rightZ;
                let dep = relX * entry.fwdX + relZ * entry.fwdZ;
                lat = halfNow * 2 >= corridor
                    ? (entry.limL + entry.limR) / 2
                    : clamp(lat, entry.limL + halfNow, entry.limR - halfNow);
                // a investida para dentro do tile à frente (não invade o tile do jogador, cujas
                // laterais podem ser paredes)
                dep = clamp(dep, Math.min(1.08, entry.slotZ), FORMATION_MAX_DEPTH + 0.06);
                px = entry.originX + entry.rightX * lat + entry.fwdX * dep;
                pz = entry.originZ + entry.rightZ * lat + entry.fwdZ * dep;

                // Pés no chão: y = 0, exceto durante saltos de animação (ataque/buff)
                entry.sprite.position.set(px, atkHop + buffHop, pz);
                entry.shadow.position.set(px, 0.02, pz);

                const sxScale = entry.scale * atkScale * spawnScale * idleSx * deathSx;
                const syScale = entry.scale * atkScale * spawnScale * idleSy * deathSy;
                entry.sprite.scale.set(sxScale, syScale, 1);
                entry.drawW = entry.visW * atkScale * spawnScale * idleSx * deathSx;

                // Flash: troca a textura (branca tingida / vermelha) em vez de sobrepor sprites
                const mat = entry.sprite.material;
                let map = entry.tex.normal;
                let color = 0xffffff;
                if (flash > 0) {
                    map = entry.tex.white;
                    color = flashColor;
                } else if (entry.overkill && Math.floor(now / 150) % 2 === 0) {
                    map = entry.tex.white;
                    color = 0xffd147;
                } else if (deathBlink || a.white > 0.45) {
                    map = entry.tex.white;
                } else if (a.hurt > 0.3) {
                    map = entry.tex.red;
                }
                if (mat.map !== map) {
                    mat.map = map;
                    mat.needsUpdate = true;
                }
                mat.color.setHex(color);
                mat.opacity = alpha;
                entry.shadow.material.opacity = 0.4 * alpha * (a.spawn > 0 ? 1 - a.spawn : 1);
                entry.sprite.visible = alpha > 0.02;
                entry.shadow.visible = alpha > 0.02;
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
        drawFx();
        drawEliteMarkers(now);
        drawEncounterAlert(now);

        // Flash de dano nas bordas da janela 3D
        if (edgeFlash.alpha > 0.01) {
            const eg = hctx.createRadialGradient(
                viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.22,
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
            viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.5,
            viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.8
        );
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(8,5,14,0.36)');
        hctx.fillStyle = vig;
        hctx.fillRect(0, 0, viewW, viewH);

        renderMinimap();
    }

    // Diagnóstico para testes: segmento (no chão, em unidades de TILE) ocupado por cada billboard
    // visível, altura dos pés (y) e altura visível.
    function getDebugBounds() {
        const out = [];
        const rxC = Math.cos(camYaw);
        const rzC = -Math.sin(camYaw);
        const seg = (id, type, px, pz, hw, extra) => Object.assign({
            id: id, type: type,
            x1: (px - rxC * hw) / TILE, z1: (pz - rzC * hw) / TILE,
            x2: (px + rxC * hw) / TILE, z2: (pz + rzC * hw) / TILE
        }, extra || {});
        if (currentState && currentState.mode === 'combat') {
            for (const [uid, entry] of combatSprites.entries()) {
                if (!entry.sprite.visible || !entry.alive) continue;
                out.push(seg(uid, 'combat', entry.sprite.position.x, entry.sprite.position.z, (entry.drawW || entry.visW) * 0.5, {
                    feetY: entry.sprite.position.y,
                    visH: entry.visH,
                    isBoss: entry.isBoss,
                    idle: entry.anim.atk < 0 && entry.anim.buff <= 0,
                    depth: entry.slotZ
                }));
            }
        } else {
            for (const [id, entry] of encounterSprites.entries()) {
                if (!entry.sprite || !entry.sprite.visible) continue;
                out.push(seg(id, 'world', entry.x * TILE, entry.z * TILE, entry.visW * 0.5, { feetY: 0, visH: entry.visH, isBoss: entry.isBoss }));
            }
            for (const [key, obj] of worldPickups.entries()) {
                if (!obj.sprite.visible) continue;
                out.push(seg(obj.kind + '@' + key, 'world', obj.sprite.position.x, obj.sprite.position.z, obj.visW * 0.5, { feetY: obj.sprite.position.y }));
            }
        }
        return out;
    }

    // Posições 2D (locais ao viewport) dos labels, para testes de sobreposição.
    function getCombatLabelAnchors() {
        const out = [];
        for (const [uid, entry] of combatSprites.entries()) {
            if (!entry.alive) continue;
            const top = project3D(entry.curX, entry.visH, entry.curZ);
            const bot = project3D(entry.curX, 0, entry.curZ);
            if (top && bot) out.push({ id: uid, x: top.x, headY: top.y, feetY: bot.y, isBoss: entry.isBoss });
        }
        return out;
    }

    function getColumnLocalPos(col) {
        const c = clamp(col, 0, 4);
        if (webglOk && currentState && currentState.mode === 'combat') {
            const dir = currentState.player.dir;
            const fx = DIR_DX[dir];
            const fz = DIR_DY[dir];
            const rx = -fz;
            const rz = fx;
            const sx = -2.1 + 4.2 * (c / 4);
            const wx = currentState.player.x * TILE + fx * 1.95 + rx * sx;
            const wz = currentState.player.y * TILE + fz * 1.95 + rz * sx;
            const p = project3D(wx, 0.12, wz);
            if (p) return { x: clamp(p.x, 38, viewW - 38), y: clamp(p.y, 90, viewH - 22) };
        }
        return { x: viewW * (0.16 + (c / 4) * 0.68), y: viewH * 0.78 };
    }

    function getColumnScreenPos(col) {
        const rect = hudCanvas.getBoundingClientRect();
        const p = getColumnLocalPos(col);
        return { x: rect.left + p.x, y: rect.top + p.y };
    }

    function getEnemyScreenPos(enemyUid) {
        const rect = hudCanvas.getBoundingClientRect();
        const entry = combatSprites.get(enemyUid);
        if (webglOk && entry) {
            const p = project3D(entry.curX, entry.visH * 0.55, entry.curZ);
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
        settleCamera: settleCamera,
        triggerStepBob: triggerStepBob,
        triggerShake: triggerShake,
        triggerScreenFlash: triggerScreenFlash,
        triggerEdgeFlash: triggerEdgeFlash,
        triggerEnemyHitAnim: triggerEnemyHitAnim,
        flashEnemy: flashEnemy,
        fireProjectile: fireProjectile,
        getProjectileKindForCard: getProjectileKindForCard,
        spawnDamageNumber: spawnDamageNumber,
        spawnLootRain: spawnLootRain,
        triggerEnemyAttackAnim: triggerEnemyAttackAnim,
        triggerEnemyBuffAnim: triggerEnemyBuffAnim,
        showEncounterAlert: showEncounterAlert,
        showEpilogue: showEpilogue,
        spawnBurst: spawnBurst,
        getAttackTimings: getAttackTimings,
        getDebugBounds: getDebugBounds,
        getCombatLabelAnchors: getCombatLabelAnchors,
        getEnemyScreenPos: getEnemyScreenPos,
        getColumnScreenPos: getColumnScreenPos,
        constants: { TILE: TILE, CAM_HEIGHT: CAM_HEIGHT, COMMON_HEIGHT: COMMON_HEIGHT, BOSS_HEIGHT: BOSS_HEIGHT }
    };
})();

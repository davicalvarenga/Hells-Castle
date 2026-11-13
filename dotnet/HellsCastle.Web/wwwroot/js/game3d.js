// Vista 3D da sala (three.js): masmorra em perspectiva, com os personagens como sprites em
// pixel art sempre voltados para a câmera. Não tem regras nem animação próprias: desenha o
// mesmo estado que game.js mantém (posições, efeitos, textos), recebido em "shared".
import * as THREE from './three.module.min.js';

const INTERNAL_HEIGHT = 300;   // resolução interna baixa, ampliada sem suavização (visual retrô)
const WALL_HEIGHT = 2.4;
const SPRITE_SCALE = 1.05;
const TORCH_INTENSITY = 6;
const PLAYER_LIGHT = 2.2;

let S = null;
let gl = null, hud = null, hctx = null;
let renderer = null, scene = null, camera = null;
let room = null, builtCols = 0, builtRows = 0;
let raf = 0, last = 0;
let viewW = 0, viewH = 0, dpr = 1;

const objs = new Map();
let dangerPool = [], markPool = [];
let rings = [];
let doorCanvas = null, doorTexture = null, doorDrawn = -1;
let torches = [];
let playerLight = null;
let ceiling = null;
let points = null, pointPositions = null, pointColors = null;
let walkTexture = null, targetTexture = null;

const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const wantPos = new THREE.Vector3();
const wantLook = new THREE.Vector3();
let camReady = false;
const tmp = new THREE.Vector3();
const tmpColor = new THREE.Color();

const MAX_POINTS = 400;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = p => 1 - (1 - p) * (1 - p);

// ---------------------------------------------------------------------- texturas

function texture(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

function bracketCanvas(fill) {
    const c = makeCanvas(24, 24);
    const g = c.getContext('2d');
    if (fill) {
        g.fillStyle = 'rgba(255,255,255,0.28)';
        g.fillRect(1, 1, 22, 22);
    }
    g.fillStyle = '#ffffff';
    const n = 7, w = 2;
    g.fillRect(1, 1, n, w); g.fillRect(1, 1, w, n);
    g.fillRect(23 - n, 1, n, w); g.fillRect(21, 1, w, n);
    g.fillRect(1, 21, n, w); g.fillRect(1, 23 - n, w, n);
    g.fillRect(23 - n, 21, n, w); g.fillRect(21, 23 - n, w, n);
    return c;
}

function flameCanvas(variant) {
    const c = makeCanvas(8, 12);
    const g = c.getContext('2d');
    const h = 8 + variant;
    g.fillStyle = '#c8402f';
    g.fillRect(2, 12 - h, 4, h);
    g.fillRect(1, 12 - h + 3, 6, h - 4);
    g.fillStyle = '#e8873a';
    g.fillRect(2, 12 - h + 2, 4, h - 2);
    g.fillRect(3 - (variant % 2), 12 - h - 1, 2, 3);
    g.fillStyle = '#f3c552';
    g.fillRect(3, 12 - h + 4, 2, h - 4);
    return c;
}

function drawDoor(open) {
    const g = doorCanvas.getContext('2d');
    const W = doorCanvas.width, H = doorCanvas.height;
    g.clearRect(0, 0, W, H);
    // moldura de pedra
    g.fillStyle = '#7b6f88';
    g.fillRect(0, 3, W, H - 3);
    g.fillRect(2, 1, W - 4, 2);
    g.fillRect(5, 0, W - 10, 1);
    g.fillStyle = '#5a4f66';
    g.fillRect(W - 2, 3, 2, H - 3);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (let y = 9; y < H; y += 7) {
        g.fillRect(0, y, 3, 1);
        g.fillRect(W - 3, y, 3, 1);
    }
    // vão
    const x = 3, y = 4, w = W - 6, h = H - 4;
    g.fillStyle = '#08060a';
    g.fillRect(x, y, w, h);
    if (open > 0) {
        const glow = g.createLinearGradient(0, y, 0, H);
        glow.addColorStop(0, 'rgba(243,197,82,' + (0.25 * open) + ')');
        glow.addColorStop(1, 'rgba(255,240,180,' + open + ')');
        g.fillStyle = glow;
        g.fillRect(x, y, w, h);
    }
    const leaf = Math.round((w / 2) * (1 - open));
    if (leaf > 0) {
        for (const side of [0, 1]) {
            const lx = side === 0 ? x : x + w - leaf;
            g.fillStyle = '#6a4429';
            g.fillRect(lx, y, leaf, h);
            g.fillStyle = '#4b2f1b';
            for (let px = lx + 2; px < lx + leaf; px += 4) g.fillRect(px, y, 1, h);
            g.fillStyle = '#636c7a';
            g.fillRect(lx, y + 6, leaf, 2);
            g.fillRect(lx, y + 17, leaf, 2);
        }
        if (open < 0.05) {
            g.fillStyle = '#f3c552';
            g.fillRect(x + w / 2 - 1, y + 11, 2, 3);
        }
    }
    doorTexture.needsUpdate = true;
    doorDrawn = open;
}

// ---------------------------------------------------------------------- cenário

function disposeTree(node) {
    node.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
            const list = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of list) {
                if (m.map) m.map.dispose();
                m.dispose();
            }
        }
    });
}

function buildRoom() {
    if (room) {
        scene.remove(room);
        disposeTree(room);
    }
    for (const o of objs.values()) removeEntity(o);
    objs.clear();

    const C = S.cols, R = S.rows;
    builtCols = C;
    builtRows = R;
    room = new THREE.Group();
    const cx = (C - 1) / 2, cz = -(R - 1) / 2;
    const T = S.T;

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(C, R),
        new THREE.MeshLambertMaterial({ map: texture(S.floorCanvas()) }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, cz);
    room.add(floor);

    const wall = (w, seed) => new THREE.Mesh(
        new THREE.PlaneGeometry(w, WALL_HEIGHT),
        new THREE.MeshLambertMaterial({ map: texture(S.brickCanvas(Math.round(w * T), Math.round(WALL_HEIGHT * T), seed)) }));

    const back = wall(C, 11);
    back.position.set(cx, WALL_HEIGHT / 2, -(R - 0.5));
    room.add(back);

    const left = wall(R, 23);
    left.rotation.y = Math.PI / 2;
    left.position.set(-0.5, WALL_HEIGHT / 2, cz);
    room.add(left);

    const right = wall(R, 37);
    right.rotation.y = -Math.PI / 2;
    right.position.set(C - 0.5, WALL_HEIGHT / 2, cz);
    room.add(right);

    // A parede da entrada só existe vista de dentro; a câmera por trás enxerga através dela.
    const front = wall(C, 41);
    front.rotation.y = Math.PI;
    front.position.set(cx, WALL_HEIGHT / 2, 0.5);
    room.add(front);

    const entrance = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 1.2),
        new THREE.MeshBasicMaterial({ color: 0x050307 }));
    entrance.rotation.y = Math.PI;
    entrance.position.set(cx, 0.6, 0.49);
    room.add(entrance);

    ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(C, R),
        new THREE.MeshLambertMaterial({ color: 0x3a3142 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(cx, WALL_HEIGHT, cz);
    room.add(ceiling);

    doorCanvas = makeCanvas(28, 32);
    doorTexture = texture(doorCanvas);
    const door = new THREE.Mesh(
        new THREE.PlaneGeometry(28 / T, 32 / T),
        new THREE.MeshBasicMaterial({ map: doorTexture, transparent: true, alphaTest: 0.5 }));
    door.position.set(cx, 16 / T, -(R - 0.5) + 0.02);
    room.add(door);
    drawDoor(S.doorOpen);

    room.add(new THREE.AmbientLight(0xa9a2d6, 1.7));

    torches = [];
    const flames = [0, 1, 2].map(v => texture(flameCanvas(v)));
    for (const tx of [0.55, C - 1.55]) {
        const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flames[0], transparent: true, alphaTest: 0.5, fog: false }));
        flame.scale.set(8 / T * 1.3, 12 / T * 1.3, 1);
        flame.position.set(tx, 1.38, -(R - 0.5) + 0.12);
        room.add(flame);
        const stick = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), new THREE.MeshLambertMaterial({ color: 0x4a3222 }));
        stick.position.set(tx, 1.02, -(R - 0.5) + 0.08);
        room.add(stick);
        const light = new THREE.PointLight(0xffab66, TORCH_INTENSITY, 9, 1.5);
        light.position.set(tx, 1.5, -(R - 0.5) + 0.5);
        room.add(light);
        torches.push({ flame: flame, light: light, flames: flames, seed: tx * 7 });
    }

    playerLight = new THREE.PointLight(0xffe8cc, PLAYER_LIGHT, 5.5, 1.3);
    room.add(playerLight);

    // Casas em perigo e casas clicáveis: um plano por casa, reaproveitado a cada quadro.
    dangerPool = [];
    markPool = [];
    const tileGeo = new THREE.PlaneGeometry(0.94, 0.94);
    walkTexture = texture(bracketCanvas(false));
    targetTexture = texture(bracketCanvas(true));
    for (let i = 0; i < C * R; i++) {
        const d = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ color: 0xe03a28, transparent: true, opacity: 0, depthWrite: false }));
        d.rotation.x = -Math.PI / 2;
        d.visible = false;
        room.add(d);
        dangerPool.push(d);
        const m = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ map: walkTexture, color: 0x9dbb72, transparent: true, depthWrite: false, fog: false }));
        m.rotation.x = -Math.PI / 2;
        m.visible = false;
        room.add(m);
        markPool.push(m);
    }

    rings = [];
    for (const color of [0xf3c552, 0xa47bd0]) {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.88, 1, 48),
            new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false }));
        ring.rotation.x = -Math.PI / 2;
        ring.visible = false;
        room.add(ring);
        rings.push(ring);
    }

    pointPositions = new Float32Array(MAX_POINTS * 3);
    pointColors = new Float32Array(MAX_POINTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));
    geo.setDrawRange(0, 0);
    points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, sizeAttenuation: true, fog: false }));
    points.frustumCulled = false;
    room.add(points);

    scene.add(room);
    camReady = false;
}

// ---------------------------------------------------------------------- personagens

const shadowGeo = new THREE.CircleGeometry(0.3, 16);

function makeSprite(canvas, extra) {
    const material = new THREE.SpriteMaterial(Object.assign({ map: texture(canvas), transparent: true, alphaTest: 0.05 }, extra || {}));
    const sprite = new THREE.Sprite(material);
    sprite.center.set(0.5, 0);
    return sprite;
}

function ensureEntity(e) {
    let o = objs.get(e.id);
    if (o && o.kind === e.kind) return o;
    if (o) removeEntity(o);
    const sheet = S.sheet[e.kind];
    if (!sheet) return null;
    o = {
        kind: e.kind,
        main: makeSprite(sheet.normal),
        white: makeSprite(sheet.white, { depthWrite: false, fog: false }),
        red: makeSprite(sheet.red, { depthWrite: false, fog: false }),
        shadow: new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }))
    };
    o.white.renderOrder = 2;
    o.red.renderOrder = 2;
    o.shadow.rotation.x = -Math.PI / 2;
    scene.add(o.shadow, o.main, o.white, o.red);
    objs.set(e.id, o);
    return o;
}

function removeEntity(o) {
    for (const part of [o.main, o.white, o.red, o.shadow]) {
        scene.remove(part);
        if (part.material.map) part.material.map.dispose();
        part.material.dispose();
    }
}

function worldX(e) { return e.x + e.ox / S.T; }
function worldY(e) { return e.y - e.oy / S.T; }

function updateEntities(now) {
    for (const [id, o] of objs) {
        if (!S.ents.has(id)) {
            removeEntity(o);
            objs.delete(id);
        }
    }
    const firstPerson = S.view === 'fp';
    for (const e of S.ents.values()) {
        const o = ensureEntity(e);
        if (!o) continue;
        const isPlayer = e.kind === 'player';
        const bob = isPlayer
            ? (Math.sin(now / 520 + e.phase) > 0.4 ? 1 : 0)
            : (Math.sin(now / 380 + e.phase) > 0.2 ? 1 : 0);
        const x = worldX(e), z = -worldY(e);
        const height = (e.hop + bob) / S.T;
        const shown = e.alpha > 0.01 && !(isPlayer && firstPerson);

        o.main.visible = shown;
        o.main.position.set(x, height, z);
        o.main.scale.set(SPRITE_SCALE, SPRITE_SCALE * e.sy, 1);
        o.main.material.opacity = e.alpha;

        o.white.visible = shown && e.flash > 0.01;
        o.white.position.copy(o.main.position);
        o.white.scale.copy(o.main.scale);
        o.white.material.opacity = clamp(e.flash, 0, 1) * e.alpha;

        o.red.visible = shown && e.hurt > 0.01;
        o.red.position.copy(o.main.position);
        o.red.scale.copy(o.main.scale);
        o.red.material.opacity = clamp(e.hurt, 0, 1) * 0.8 * e.alpha;

        o.shadow.visible = shown;
        o.shadow.position.set(x, 0.015, z);
        o.shadow.material.opacity = 0.35 * e.alpha;
    }
}

// ---------------------------------------------------------------------- chão, efeitos e luz

function updateTiles(now) {
    let i = 0;
    for (const d of S.danger) {
        if (i >= dangerPool.length) break;
        const mesh = dangerPool[i++];
        const t = d[2];
        let a;
        if (t <= 1) a = 0.55 + 0.22 * Math.sin(now / 80);
        else if (t <= 3) a = 0.3 + 0.06 * Math.sin(now / 220);
        else a = 0.11;
        mesh.visible = true;
        mesh.position.set(d[0], 0.012, -d[1]);
        mesh.material.opacity = a;
    }
    for (; i < dangerPool.length; i++) dangerPool[i].visible = false;

    let j = 0;
    const idle = !S.busy && S.status === 'playing';
    const hover = S.hover;
    const place = (list, map, color) => {
        for (const t of list) {
            if (j >= markPool.length) return;
            const mesh = markPool[j++];
            const hot = hover && hover[0] === t[0] && hover[1] === t[1];
            mesh.visible = true;
            mesh.position.set(t[0], 0.02, -t[1]);
            if (mesh.material.map !== map) {
                mesh.material.map = map;
                mesh.material.needsUpdate = true;
            }
            mesh.material.color.setHex(color);
            mesh.material.opacity = hot ? 1 : 0.72 + 0.2 * Math.sin(now / 200);
            const s = hot ? 1.04 : 1;
            mesh.scale.set(s, s, 1);
        }
    };
    if (idle) {
        place(S.walk, walkTexture, 0xb6dc84);
        place(S.targets, targetTexture, 0xf3c552);
    }
    for (; j < markPool.length; j++) markPool[j].visible = false;
}

function updateEffects(now) {
    for (const ring of rings) ring.visible = false;
    for (const fx of S.effects) {
        if (fx.type !== 'ring') continue;
        const p = clamp(fx.age / fx.dur, 0, 1);
        rings.forEach((ring, k) => {
            const q = clamp(p * 1.25 - k * 0.25, 0, 1);
            if (q <= 0) return;
            ring.visible = true;
            ring.position.set(fx.x, 0.05 + k * 0.01, -fx.y);
            const s = 0.3 + easeOut(q) * 8;
            ring.scale.set(s, s, 1);
            ring.material.opacity = (1 - q) * 0.9;
        });
    }

    // Partículas: game.js as guarda em pixels da vista de cima; aqui o deslocamento vertical
    // dentro da casa vira altura.
    let n = 0;
    const T = S.T;
    for (const pt of S.particles) {
        if (n >= MAX_POINTS) break;
        const rowFloat = (pt.y - S.WALL_TOP) / T;
        if (rowFloat < 0) continue;
        const row = Math.floor(rowFloat);
        const y = S.rows - 1 - row;
        const x = (pt.x - S.WALL_SIDE) / T - 0.5;
        const h = (1 - (rowFloat - row)) * 0.9;
        pointPositions[n * 3] = x;
        pointPositions[n * 3 + 1] = h;
        pointPositions[n * 3 + 2] = -y;
        tmpColor.set(pt.color);
        const fade = clamp(pt.life / pt.max, 0, 1);
        pointColors[n * 3] = tmpColor.r * fade;
        pointColors[n * 3 + 1] = tmpColor.g * fade;
        pointColors[n * 3 + 2] = tmpColor.b * fade;
        n++;
    }
    points.geometry.setDrawRange(0, n);
    points.geometry.attributes.position.needsUpdate = true;
    points.geometry.attributes.color.needsUpdate = true;

    for (const t of torches) {
        const flick = 1 + Math.sin(now / 90 + t.seed) * 0.08 + Math.sin(now / 37 + t.seed * 2) * 0.06;
        t.light.intensity = TORCH_INTENSITY * flick;
        const frame = Math.floor(now / 110 + t.seed) % 3;
        if (t.flame.material.map !== t.flames[frame]) {
            t.flame.material.map = t.flames[frame];
            t.flame.material.needsUpdate = true;
        }
    }

    if (Math.abs(S.doorOpen - doorDrawn) > 0.02) drawDoor(S.doorOpen);
}

function updateCamera(dt) {
    const P = S.ents.get('p');
    if (!P) return;
    const px = worldX(P), py = worldY(P);
    const cx = (S.cols - 1) / 2;

    if (S.view === 'fp') {
        const eye = 0.68 * (0.45 + 0.55 * P.sy) + P.hop / S.T * 0.5;
        wantPos.set(px, eye, -(py - 0.18));
        wantLook.set(px, 0.3, -(py + 3.2));
    } else {
        wantPos.set(px * 0.7 + cx * 0.3, 2.5, -(py - 2.1));
        wantLook.set(px * 0.8 + cx * 0.2, 0.55, -(py + 2.8));
    }

    // Por trás, a câmera fica acima das paredes: sem teto e com a névoa mais distante.
    const firstPerson = S.view === 'fp';
    ceiling.visible = firstPerson;
    scene.fog.near = firstPerson ? 3 : 6;
    scene.fog.far = firstPerson ? 12 : 17;

    if (!camReady) {
        camPos.copy(wantPos);
        camLook.copy(wantLook);
        camReady = true;
    } else {
        const k = 1 - Math.exp(-dt * 0.014);
        camPos.lerp(wantPos, k);
        camLook.lerp(wantLook, k);
    }

    camera.position.copy(camPos);
    const sh = S.shake;
    if (sh) {
        const m = sh.mag * Math.max(0, 1 - sh.age / sh.dur) * 0.018;
        camera.position.x += (Math.random() * 2 - 1) * m;
        camera.position.y += (Math.random() * 2 - 1) * m;
    }
    camera.lookAt(camLook);
    camera.updateMatrixWorld();

    playerLight.position.set(px, 1.1, -py);
    playerLight.intensity = PLAYER_LIGHT * P.alpha;
}

// ---------------------------------------------------------------------- camada 2D sobre a cena

/** Projeta um ponto do mundo na tela. Devolve nulo se estiver atrás da câmera. */
function project(x, h, y) {
    tmp.set(x, h, -y).applyMatrix4(camera.matrixWorldInverse);
    const depth = -tmp.z;
    if (depth < 0.12) return null;
    tmp.applyMatrix4(camera.projectionMatrix);
    return {
        x: (tmp.x * 0.5 + 0.5) * viewW,
        y: (-tmp.y * 0.5 + 0.5) * viewH,
        d: depth,
        // pixels de tela por unidade do mundo, nessa profundidade
        s: (viewH / 2) / Math.tan(camera.fov * Math.PI / 360) / depth
    };
}

function outlined(text, x, y, size, color, alpha, align) {
    hctx.font = Math.round(size) + 'px ' + S.FONT;
    hctx.textAlign = align || 'center';
    hctx.textBaseline = 'middle';
    hctx.globalAlpha = alpha;
    hctx.lineJoin = 'round';
    hctx.lineWidth = Math.max(3, size * 0.2);
    hctx.strokeStyle = '#120c16';
    hctx.strokeText(text, x, y);
    hctx.fillStyle = color;
    hctx.fillText(text, x, y);
    hctx.globalAlpha = 1;
}

function portrait(kind, x, y, size) {
    const sheet = S.sheet[kind];
    if (!sheet) return;
    hctx.imageSmoothingEnabled = false;
    hctx.drawImage(sheet.normal, x - size / 2, y - size / 2, size, size);
}

function drawHud(now) {
    const W = viewW, H = viewH;
    hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hctx.clearRect(0, 0, W, H);
    const P = S.ents.get('p');
    if (!P) return;
    const firstPerson = S.view === 'fp';
    const px = Math.round(P.x), py = Math.round(P.y);

    // Contagem regressiva em cada casa marcada.
    let ownDanger = null;
    for (const d of S.danger) {
        if (d[0] === px && d[1] === py) {
            ownDanger = d[2];
            if (firstPerson) continue;
        }
        const q = project(d[0], 0.03, d[1]);
        if (!q || q.x < -20 || q.x > W + 20 || q.y < -20 || q.y > H + 20) continue;
        const t = d[2];
        const size = clamp(q.s * 0.42, 11, 54);
        if (t <= 1) outlined(String(t), q.x, q.y, size * 1.15, '#ffd0c4', 1);
        else if (t <= 3) outlined(String(t), q.x, q.y, size, '#f0a03c', 0.95);
        else outlined(String(t), q.x, q.y, size * 0.8, '#c98a4a', 0.4);
    }

    // Vida e contagem de cada inimigo, sobre a cabeça; quem está fora da tela vira aviso na borda.
    const edge = { left: 0, right: 0, bottom: 0 };
    for (const e of S.ents.values()) {
        if (e.kind === 'player' || !e.alive || e.alpha < 0.9) continue;
        const q = project(worldX(e), SPRITE_SCALE * 0.98 + 0.12, worldY(e));
        const visible = q && q.x > 24 && q.x < W - 24 && q.y < H;
        if (visible) {
            const bw = clamp(q.s * 0.7, 26, 150), bh = clamp(q.s * 0.07, 4, 12);
            const bx = q.x - bw / 2, by = Math.max(6, q.y - bh);
            hctx.fillStyle = '#17101a';
            hctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
            hctx.fillStyle = '#4a1c18';
            hctx.fillRect(bx, by, bw, bh);
            hctx.fillStyle = '#e0503c';
            hctx.fillRect(bx, by, Math.max(2, bw * e.hp / e.maxHp), bh);
            if (!S.busy) {
                const r = clamp(q.s * 0.15, 10, 28);
                const cx = q.x + bw / 2 + r * 0.9, cy = by + bh / 2;
                hctx.beginPath();
                hctx.arc(cx, cy, r, 0, Math.PI * 2);
                hctx.fillStyle = e.counter <= 1 ? '#c8402f' : '#1b1420';
                hctx.fill();
                hctx.lineWidth = Math.max(2, r * 0.16);
                hctx.strokeStyle = e.counter <= 1 ? '#ffd0c4' : '#e8873a';
                hctx.stroke();
                outlined(String(e.counter), cx, cy + 1, r * 1.6, e.counter <= 1 ? '#ffffff' : '#f3c552', 1);
            }
        } else {
            const dx = worldX(e) - worldX(P);
            const side = dx < -0.3 ? 'left' : dx > 0.3 ? 'right' : 'bottom';
            const size = clamp(H * 0.13, 40, 72);
            let x, y;
            if (side === 'bottom') {
                x = W / 2 + (edge.bottom++ - 0.5) * (size + 10) + (size + 10) / 2;
                y = H - size * 0.6 - 4;
            } else {
                x = side === 'left' ? size * 0.6 + 4 : W - size * 0.6 - 4;
                y = H * 0.55 + (side === 'left' ? edge.left++ : edge.right++) * (size + 10);
            }
            hctx.fillStyle = 'rgba(18,12,22,0.86)';
            hctx.fillRect(x - size / 2, y - size / 2, size, size);
            hctx.lineWidth = 3;
            hctx.strokeStyle = e.counter <= 1 ? '#ff7a66' : '#e8873a';
            hctx.strokeRect(x - size / 2, y - size / 2, size, size);
            portrait(e.kind, x, y - size * 0.06, size * 0.74);
            outlined(String(e.counter), x + size * 0.36, y + size * 0.34, size * 0.5, e.counter <= 1 ? '#ffffff' : '#f3c552', 1);
            const arrow = side === 'left' ? '◀' : side === 'right' ? '▶' : '▼';
            outlined(arrow, x - size * 0.34, y - size * 0.34, size * 0.3, '#efe6d8', 0.9);
        }
    }

    // Golpes, mordida, flecha e escudo.
    for (const fx of S.effects) {
        const p = clamp(fx.age / fx.dur, 0, 1);
        if (fx.type === 'slash') {
            const q = project(fx.x, 0.55, fx.y);
            if (!q) continue;
            const r = clamp(q.s * 0.42, 14, 260);
            hctx.globalAlpha = 1 - p * p;
            if (fx.card === 'Estocada') {
                hctx.fillStyle = '#ffffff';
                hctx.fillRect(q.x - r * 0.07, q.y - r * 1.1, r * 0.14, r * 2.2);
                hctx.fillStyle = '#f3c552';
                hctx.fillRect(q.x - r * 0.2, q.y - r * (0.9 - p * 0.4), r * 0.06, r * 1.6);
                hctx.fillRect(q.x + r * 0.14, q.y - r * (0.9 - p * 0.4), r * 0.06, r * 1.6);
            } else {
                const big = fx.card === 'GolpePesado';
                const a0 = -Math.PI * 0.95 + Math.PI * 0.9 * easeOut(p);
                hctx.lineCap = 'butt';
                hctx.strokeStyle = '#ffffff';
                hctx.lineWidth = r * (big ? 0.34 : 0.24);
                hctx.beginPath();
                hctx.arc(q.x, q.y, r, a0 - 0.9, a0 + 0.5);
                hctx.stroke();
                hctx.strokeStyle = '#f3c552';
                hctx.lineWidth = r * 0.08;
                hctx.beginPath();
                hctx.arc(q.x, q.y, r * 1.22, a0 - 1.1, a0 + 0.2);
                hctx.stroke();
            }
            hctx.globalAlpha = 1;
        } else if (fx.type === 'bite') {
            const own = firstPerson && Math.round(fx.x) === px && Math.round(fx.y) === py;
            const q = own ? { x: W / 2, y: H * 0.55, s: H * 0.6 } : project(fx.x, 0.5, fx.y);
            if (!q) continue;
            const u = clamp(q.s * 0.1, 4, 60);
            const gap = u * 2.4 * (1 - easeOut(Math.min(1, p * 2)));
            hctx.globalAlpha = 1 - p * p;
            hctx.fillStyle = '#ffffff';
            for (let i = -2; i <= 2; i++) {
                const tx = q.x + i * u * 1.1 - u * 0.35;
                hctx.fillRect(tx, q.y - gap - u * 1.5, u * 0.7, u * 1.5);
                hctx.fillRect(tx, q.y + gap, u * 0.7, u * 1.5);
            }
            hctx.globalAlpha = 1;
        } else if (fx.type === 'arrow' && fx.tiles.length) {
            const vertical = fx.tiles.every(t => t[0] === fx.tiles[0][0]);
            let ax, ay, bx, by;
            if (vertical) {
                const fromFar = fx.sy >= (S.rows - 1) / 2;
                ax = bx = fx.tiles[0][0];
                ay = fromFar ? S.rows - 0.5 : -0.5;
                by = fromFar ? -0.5 : S.rows - 0.5;
            } else {
                const fromLeft = fx.sx <= (S.cols - 1) / 2;
                ay = by = fx.tiles[0][1];
                ax = fromLeft ? -0.5 : S.cols - 0.5;
                bx = fromLeft ? S.cols - 0.5 : -0.5;
            }
            const at = k => project(ax + (bx - ax) * k, 0.6, ay + (by - ay) * k);
            const head = at(p), tail = at(Math.max(0, p - 0.3));
            if (head && tail) {
                hctx.globalAlpha = 1 - p * 0.3;
                hctx.strokeStyle = 'rgba(244,234,216,0.5)';
                hctx.lineWidth = clamp(head.s * 0.05, 2, 14);
                hctx.beginPath();
                hctx.moveTo(tail.x, tail.y);
                hctx.lineTo(head.x, head.y);
                hctx.stroke();
                hctx.fillStyle = '#ffffff';
                const r = clamp(head.s * 0.06, 3, 16);
                hctx.fillRect(head.x - r, head.y - r, r * 2, r * 2);
                hctx.globalAlpha = 1;
            } else if (firstPerson && p > 0.6) {
                // a flecha passou pela câmera
                hctx.fillStyle = 'rgba(244,234,216,' + (0.35 * (1 - p)) + ')';
                hctx.fillRect(0, 0, W, H);
            }
        } else if (fx.type === 'shield') {
            if (firstPerson) {
                const g = hctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
                g.addColorStop(0, 'rgba(143,196,234,0)');
                g.addColorStop(1, 'rgba(143,196,234,' + (0.55 * (1 - p)) + ')');
                hctx.fillStyle = g;
                hctx.fillRect(0, 0, W, H);
            } else {
                const q = project(worldX(P), 0.5, worldY(P));
                if (q) {
                    hctx.globalAlpha = (1 - p) * 0.9;
                    hctx.strokeStyle = '#8fc4ea';
                    hctx.lineWidth = Math.max(3, q.s * 0.06);
                    hctx.beginPath();
                    hctx.arc(q.x, q.y, q.s * (0.5 + p * 0.2), 0, Math.PI * 2);
                    hctx.stroke();
                    hctx.globalAlpha = 1;
                }
            }
        }
    }

    // Textos flutuantes.
    for (const t of S.texts) {
        const p = clamp(t.age / t.dur, 0, 1);
        const alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        const pop = t.level > 0 && p < 0.15 ? 1 + (0.15 - p) * 2.4 : 1;
        const onPlayer = Math.abs(t.x - P.x) < 0.6 && Math.abs(t.y - P.y) < 0.6;
        if (firstPerson && onPlayer) {
            const size = H * (t.level === 2 ? 0.1 : t.level === 1 ? 0.12 : 0.07);
            outlined(t.text, W / 2, H * 0.66 - easeOut(p) * H * 0.06 - t.row * H * 0.075, size * pop, t.color, alpha);
            continue;
        }
        const q = project(t.x, 1.25 + easeOut(p) * 0.45 + t.row * 0.28, t.y);
        if (!q) continue;
        const size = clamp(q.s * (t.level === 2 ? 0.4 : t.level === 1 ? 0.5 : 0.3), 15, 96);
        outlined(t.text, clamp(q.x, 60, W - 60), Math.max(size * 0.6, q.y), size * pop, t.color, alpha);
    }

    // Em primeira pessoa não dá para ver a própria casa: o perigo aparece na borda de baixo.
    if (firstPerson && ownDanger !== null && S.status === 'playing') {
        const urgent = ownDanger <= 1;
        const pulse = urgent ? 0.5 + 0.3 * Math.sin(now / 80) : ownDanger <= 3 ? 0.3 : 0.14;
        const g = hctx.createLinearGradient(0, H * 0.62, 0, H);
        g.addColorStop(0, 'rgba(214,58,42,0)');
        g.addColorStop(1, 'rgba(214,58,42,' + pulse + ')');
        hctx.fillStyle = g;
        hctx.fillRect(0, H * 0.62, W, H * 0.38);
        outlined('SUA CASA: ' + ownDanger, W / 2, H - H * 0.07, H * (urgent ? 0.1 : 0.075),
            urgent ? '#ffd0c4' : ownDanger <= 3 ? '#f0a03c' : '#c98a4a', 1);
    }

    const ov = S.overlay;
    if (ov) {
        hctx.globalAlpha = ov.alpha * Math.max(0, 1 - ov.age / ov.dur);
        hctx.fillStyle = ov.color;
        hctx.fillRect(0, 0, W, H);
        hctx.globalAlpha = 1;
    }

    // Vinheta.
    const v = hctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.5)');
    hctx.fillStyle = v;
    hctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------------- laço e entrada

function resize() {
    const w = hud.clientWidth, h = hud.clientHeight;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (w === viewW && h === viewH && ratio === dpr) return;
    viewW = w;
    viewH = h;
    dpr = ratio;
    if (w === 0 || h === 0) return;
    hud.width = Math.round(w * dpr);
    hud.height = Math.round(h * dpr);
    const ih = INTERNAL_HEIGHT;
    const iw = Math.max(2, Math.round(ih * w / h));
    renderer.setSize(iw, ih, false);
    camera.aspect = w / h;
    // Em telas altas e estreitas, abre o campo de visão para a sala caber.
    camera.fov = w / h < 1.1 ? 82 : 70;
    camera.updateProjectionMatrix();
}

function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!S || !S.ready || S.view === '2d') return;
    resize();
    if (viewW === 0 || viewH === 0) return;
    const dt = Math.min(50, now - (last || now));
    last = now;

    if (!room || builtCols !== S.cols || builtRows !== S.rows) buildRoom();

    updateEntities(now);
    updateTiles(now);
    updateEffects(now);
    updateCamera(dt);
    renderer.render(scene, camera);
    drawHud(now);
}

function pick(ev) {
    if (!S || !S.ready || viewW === 0) return null;
    const r = hud.getBoundingClientRect();
    const nx = ((ev.clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((ev.clientY - r.top) / r.height) * 2 - 1);
    const origin = camera.position;
    tmp.set(nx, ny, 0.5).unproject(camera).sub(origin).normalize();
    if (tmp.y > -0.0001) return null;
    const t = -origin.y / tmp.y;
    const x = Math.round(origin.x + tmp.x * t);
    const y = Math.round(-(origin.z + tmp.z * t));
    if (x < 0 || x >= S.cols || y < 0 || y >= S.rows) return null;
    return [x, y];
}

function onClick(ev) {
    const t = pick(ev);
    if (t) S.click(t[0], t[1]);
}

function onMove(ev) {
    const t = pick(ev);
    S.hover = t;
    hud.style.cursor = t && (S.isIn(S.walk, t[0], t[1]) || S.isIn(S.targets, t[0], t[1])) ? 'pointer' : 'default';
}

function onLeave() {
    if (S) S.hover = null;
}

export function attach(shared, glCanvas, hudCanvas) {
    S = shared;
    gl = glCanvas;
    hud = hudCanvas;
    hctx = hud.getContext('2d');
    // Lança erro se o navegador não tiver WebGL; game.js cai para a vista de cima.
    renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: false, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x07050a);
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x07050a, 3, 12);
    camera = new THREE.PerspectiveCamera(70, 4 / 3, 0.05, 40);
    hud.addEventListener('click', onClick);
    hud.addEventListener('pointermove', onMove);
    hud.addEventListener('pointerleave', onLeave);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
}

export function detach() {
    cancelAnimationFrame(raf);
    if (hud) {
        hud.removeEventListener('click', onClick);
        hud.removeEventListener('pointermove', onMove);
        hud.removeEventListener('pointerleave', onLeave);
    }
    for (const o of objs.values()) removeEntity(o);
    objs.clear();
    if (room) {
        scene.remove(room);
        disposeTree(room);
        room = null;
    }
    if (renderer) {
        renderer.dispose();
        renderer = null;
    }
    S = null;
    viewW = 0;
    viewH = 0;
}

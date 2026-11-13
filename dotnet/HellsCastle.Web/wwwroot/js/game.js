// Desenho da sala em canvas: sprites, animações, partículas, iluminação e som.
// As regras ficam no C# (HellsCastle.Core). Aqui só chega um retrato do estado e a lista de
// eventos do que aconteceu; este arquivo anima os eventos e depois se ajusta ao retrato.
(function () {
    'use strict';

    const T = 24;            // lado da casa, em pixels lógicos
    const WALL_SIDE = 12;
    const WALL_TOP = 36;
    const WALL_BOTTOM = 12;
    const SCALE = 4;         // pixels reais por pixel lógico
    const FONT = '"Jersey 15", ui-monospace, monospace';

    const art = window.hellsCastleArt;
    const sheet = {};        // nome -> { normal, white, red, shadow }

    let canvas = null, ctx = null;
    let low = null, lctx = null;       // camada em baixa resolução (pixel art)
    let lit = null, litctx = null;     // máscara de escuridão
    let staticLayer = null;
    let dotnet = null;
    let raf = 0, last = 0;
    let cols = 0, rows = 0, LW = 0, LH = 0;
    let ready = false;

    const ents = new Map();  // 'p' e 'e0', 'e1'... -> estado exibido
    let danger = [];         // [x, y, tiques]
    let walk = [], targets = [];
    let hover = null;
    let pending = null;      // retrato aguardando o fim das animações
    let anims = [];
    let cursor = 0;
    let flushing = false;
    let dashNext = false;
    let doorOpen = 0;
    let status = 'playing';

    let particles = [], texts = [], effects = [], ghosts = [];
    let shakeFx = null, overlayFx = null;

    // ------------------------------------------------------------------ utilidades

    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const clamp01 = v => Math.max(0, Math.min(1, v));
    const easeOut = p => 1 - (1 - p) * (1 - p);
    const easeInOut = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
    const rgb = (r, g, b) => 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';

    const tileX = x => WALL_SIDE + x * T;
    const tileY = y => WALL_TOP + (rows - 1 - y) * T;
    const centerX = x => tileX(x) + T / 2;
    const centerY = y => tileY(y) + T / 2;

    function makeCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    }

    function renderSprite(grid, tint) {
        const c = makeCanvas(16, 16);
        const g = c.getContext('2d');
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                const ch = grid[y][x];
                if (ch === '.') continue;
                g.fillStyle = tint || art.palette[ch] || '#ff00ff';
                g.fillRect(x, y, 1, 1);
            }
        }
        return c;
    }

    function buildSheet() {
        for (const name of Object.keys(art.sprites)) {
            sheet[name] = {
                normal: renderSprite(art.sprites[name]),
                white: renderSprite(art.sprites[name], '#ffffff'),
                red: renderSprite(art.sprites[name], '#ff4a3a'),
                purple: renderSprite(art.sprites[name], '#a47bd0')
            };
        }
    }

    function dataUrls() {
        const out = {};
        for (const name of Object.keys(sheet)) {
            const c = makeCanvas(48, 48);
            const g = c.getContext('2d');
            g.imageSmoothingEnabled = false;
            g.drawImage(sheet[name].normal, 0, 0, 48, 48);
            out[name] = c.toDataURL('image/png');
        }
        return out;
    }

    // ------------------------------------------------------------------ som (sintetizado)

    let actx = null, master = null, muted = false;

    function audio() {
        if (muted) return null;
        if (!actx) {
            try {
                const Ctor = window.AudioContext || window.webkitAudioContext;
                actx = new Ctor();
                master = actx.createGain();
                master.gain.value = 0.45;
                master.connect(actx.destination);
            } catch (e) {
                actx = null;
                return null;
            }
        }
        if (actx.state === 'suspended') actx.resume();
        return actx;
    }

    function tone(freq, dur, type, vol, slideTo, delay) {
        const a = audio();
        if (!a) return;
        const t0 = a.currentTime + (delay || 0);
        const osc = a.createOscillator();
        const gain = a.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
    }

    function noise(dur, vol, filterType, freq, delay, slideTo) {
        const a = audio();
        if (!a) return;
        const t0 = a.currentTime + (delay || 0);
        const frames = Math.max(1, Math.floor(a.sampleRate * dur));
        const buffer = a.createBuffer(1, frames, a.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
        const src = a.createBufferSource();
        src.buffer = buffer;
        const filter = a.createBiquadFilter();
        filter.type = filterType || 'lowpass';
        filter.frequency.setValueAtTime(freq || 1200, t0);
        if (slideTo) filter.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
        const gain = a.createGain();
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        src.start(t0);
    }

    function sfx(name) {
        if (muted || flushing) return;
        switch (name) {
            case 'step': noise(0.06, 0.25, 'lowpass', 500); break;
            case 'step2': noise(0.08, 0.18, 'lowpass', 320); break;
            case 'dash': noise(0.16, 0.25, 'bandpass', 900, 0, 2600); break;
            case 'card': tone(660, 0.05, 'square', 0.08); break;
            case 'slash': noise(0.12, 0.35, 'bandpass', 2400, 0, 700); break;
            case 'heavy': noise(0.2, 0.5, 'lowpass', 900, 0, 120); tone(90, 0.22, 'sine', 0.5, 40); break;
            case 'hit': tone(180, 0.09, 'square', 0.22, 70); noise(0.06, 0.2, 'lowpass', 1400); break;
            case 'death': tone(240, 0.3, 'sawtooth', 0.2, 50); noise(0.25, 0.2, 'lowpass', 800, 0, 150); break;
            case 'push': noise(0.1, 0.3, 'lowpass', 600); break;
            case 'bite': noise(0.07, 0.35, 'highpass', 1800); tone(140, 0.08, 'square', 0.15, 80); break;
            case 'arrow': noise(0.18, 0.3, 'bandpass', 3000, 0, 900); break;
            case 'bell':
                tone(196, 1.3, 'sine', 0.4);
                tone(392, 1.0, 'sine', 0.22);
                tone(587, 0.8, 'triangle', 0.12);
                tone(783, 0.5, 'sine', 0.06);
                break;
            case 'hurt': tone(220, 0.22, 'sawtooth', 0.3, 60); break;
            case 'block': tone(1200, 0.08, 'triangle', 0.25, 700); noise(0.05, 0.2, 'highpass', 3000); break;
            case 'guard': tone(520, 0.1, 'triangle', 0.18, 760); break;
            case 'edge':
                tone(660, 0.09, 'square', 0.14);
                tone(880, 0.09, 'square', 0.14, 0, 0.07);
                tone(1320, 0.16, 'square', 0.14, 0, 0.14);
                break;
            case 'shuffle': noise(0.05, 0.15, 'highpass', 2000); noise(0.05, 0.15, 'highpass', 2000, 0.07); break;
            case 'victory':
                [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.16, 0, i * 0.13));
                break;
            case 'defeat':
                [330, 277, 220, 147].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.16, 0, i * 0.18));
                break;
        }
    }

    // ------------------------------------------------------------------ cenário fixo

    function drawFloorTile(g, px, py, rnd, alt) {
        const j = rnd() * 8 - 4;
        const base = alt ? [60, 54, 70] : [54, 48, 64];
        g.fillStyle = rgb(base[0] + j, base[1] + j, base[2] + j);
        g.fillRect(px, py, T, T);
        g.fillStyle = 'rgba(255,255,255,0.06)';
        g.fillRect(px, py, T, 1);
        g.fillRect(px, py, 1, T);
        g.fillStyle = 'rgba(0,0,0,0.30)';
        g.fillRect(px, py + T - 1, T, 1);
        g.fillRect(px + T - 1, py, 1, T);
        for (let i = 0; i < 12; i++) {
            g.fillStyle = rnd() < 0.55 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.06)';
            g.fillRect(px + 2 + ((rnd() * (T - 4)) | 0), py + 2 + ((rnd() * (T - 4)) | 0), 1, 1);
        }
        if (rnd() < 0.3) {
            let cx = px + 4 + ((rnd() * 14) | 0);
            let cy = py + 3 + ((rnd() * 8) | 0);
            g.fillStyle = 'rgba(0,0,0,0.32)';
            for (let i = 0; i < 7; i++) {
                g.fillRect(cx, cy, 1, 1);
                cy += 1;
                const r = rnd();
                if (r < 0.35) cx += 1; else if (r < 0.6) cx -= 1;
            }
        }
        if (rnd() < 0.12) {
            g.fillStyle = 'rgba(110,150,90,0.35)';
            const mx = px + 2 + ((rnd() * 16) | 0), my = py + T - 4;
            g.fillRect(mx, my, 3, 1);
            g.fillRect(mx + 1, my - 1, 2, 1);
        }
    }

    function drawBricks(g, x0, y0, w, h, rnd, tone) {
        g.fillStyle = '#15111a';
        g.fillRect(x0, y0, w, h);
        const bh = 7, bw = 14;
        for (let r = 0, y = y0; y < y0 + h; y += bh, r++) {
            const off = r % 2 ? -bw / 2 : 0;
            for (let x = x0 + off; x < x0 + w; x += bw) {
                const shade = tone * (0.82 + rnd() * 0.3);
                const rx = Math.max(x0, x + 1);
                const rw = Math.min(x0 + w, x + bw) - rx;
                const rh = Math.min(bh - 1, y0 + h - y - 1);
                if (rw <= 0 || rh <= 0) continue;
                g.fillStyle = rgb(78 * shade, 66 * shade, 86 * shade);
                g.fillRect(rx, y + 1, rw, rh);
                g.fillStyle = 'rgba(255,255,255,0.08)';
                g.fillRect(rx, y + 1, rw, 1);
                g.fillStyle = 'rgba(0,0,0,0.22)';
                g.fillRect(rx, y + rh, rw, 1);
            }
        }
    }

    function buildStatic() {
        const c = makeCanvas(LW, LH);
        const g = c.getContext('2d');
        const rnd = mulberry32(90210);

        g.fillStyle = '#0c090f';
        g.fillRect(0, 0, LW, LH);

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                drawFloorTile(g, tileX(x), tileY(y), rnd, (x + y) % 2);
            }
        }

        // Parede do fundo (de frente) e sua sombra no chão.
        drawBricks(g, 0, 5, LW, WALL_TOP - 5, rnd, 1);
        g.fillStyle = '#231c2b';
        g.fillRect(0, 0, LW, 5);
        g.fillStyle = 'rgba(255,255,255,0.07)';
        g.fillRect(0, 4, LW, 1);
        const shadow = g.createLinearGradient(0, WALL_TOP, 0, WALL_TOP + 10);
        shadow.addColorStop(0, 'rgba(0,0,0,0.55)');
        shadow.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = shadow;
        g.fillRect(WALL_SIDE, WALL_TOP, cols * T, 10);

        // Paredes laterais e da frente (vistas de cima).
        g.fillStyle = '#1b1622';
        g.fillRect(0, WALL_TOP, WALL_SIDE, LH - WALL_TOP);
        g.fillRect(LW - WALL_SIDE, WALL_TOP, WALL_SIDE, LH - WALL_TOP);
        g.fillRect(0, LH - WALL_BOTTOM, LW, WALL_BOTTOM);
        g.fillStyle = '#342b3f';
        g.fillRect(WALL_SIDE - 2, WALL_TOP, 2, LH - WALL_TOP - WALL_BOTTOM + 2);
        g.fillRect(LW - WALL_SIDE, WALL_TOP, 2, LH - WALL_TOP - WALL_BOTTOM + 2);
        g.fillRect(WALL_SIDE - 2, LH - WALL_BOTTOM, cols * T + 4, 2);
        for (let y = WALL_TOP + 6; y < LH - 4; y += 9) {
            g.fillStyle = 'rgba(0,0,0,0.35)';
            g.fillRect(1, y, WALL_SIDE - 4, 1);
            g.fillRect(LW - WALL_SIDE + 3, y, WALL_SIDE - 4, 1);
        }

        // Entrada, embaixo.
        const ex = Math.round(LW / 2 - 9);
        g.fillStyle = '#0a070c';
        g.fillRect(ex, LH - WALL_BOTTOM, 18, WALL_BOTTOM);
        g.fillStyle = '#4b4057';
        g.fillRect(ex - 1, LH - WALL_BOTTOM, 1, WALL_BOTTOM);
        g.fillRect(ex + 18, LH - WALL_BOTTOM, 1, WALL_BOTTOM);

        // Moldura de pedra da porta de saída.
        const dw = 22, dh = 28, dx = Math.round(LW / 2 - dw / 2), dy = WALL_TOP - dh;
        g.fillStyle = '#7b6f88';
        g.fillRect(dx - 3, dy + 3, dw + 6, dh - 3);
        g.fillRect(dx - 1, dy + 1, dw + 2, 2);
        g.fillRect(dx + 2, dy - 1, dw - 4, 2);
        g.fillStyle = '#5a4f66';
        g.fillRect(dx + dw + 1, dy + 3, 2, dh - 3);
        g.fillStyle = 'rgba(0,0,0,0.28)';
        for (let y = dy + 8; y < WALL_TOP; y += 7) {
            g.fillRect(dx - 3, y, 3, 1);
            g.fillRect(dx + dw, y, 3, 1);
        }

        // Suportes das tochas.
        for (const tx of torchXs()) {
            g.fillStyle = '#3a2a1c';
            g.fillRect(tx - 1, 19, 2, 7);
            g.fillStyle = '#636c7a';
            g.fillRect(tx - 2, 18, 4, 2);
        }

        // Detalhes: ossos e entulho nos cantos.
        g.fillStyle = '#c9bda6';
        const bx = tileX(0) + 3, by = tileY(0) + T - 6;
        g.fillRect(bx, by, 5, 1);
        g.fillRect(bx - 1, by - 1, 1, 3);
        g.fillRect(bx + 5, by - 1, 1, 3);
        const sx = tileX(cols - 1) + T - 9, sy = tileY(rows - 1) + 4;
        g.fillRect(sx, sy, 5, 4);
        g.fillRect(sx + 1, sy + 4, 3, 1);
        g.fillStyle = '#17101a';
        g.fillRect(sx + 1, sy + 1, 1, 1);
        g.fillRect(sx + 3, sy + 1, 1, 1);

        staticLayer = c;
    }

    function torchXs() {
        return [Math.round(tileX(0) + T / 2 + 4), Math.round(tileX(cols - 1) + T / 2 - 4)];
    }

    // ------------------------------------------------------------------ estado exibido

    function makeEntity(id, kind, x, y, hp, maxHp, alive) {
        return {
            id: id, kind: kind, x: x, y: y, hp: hp, maxHp: maxHp, alive: alive,
            alpha: alive ? 1 : 0, flash: 0, hurt: 0, ox: 0, oy: 0, sy: 1,
            counter: 0, phase: Math.random() * 6.28
        };
    }

    function resetAll(snap) {
        cols = snap.cols;
        rows = snap.rows;
        LW = WALL_SIDE * 2 + cols * T;
        LH = WALL_TOP + rows * T + WALL_BOTTOM;
        canvas.width = LW * SCALE;
        canvas.height = LH * SCALE;
        canvas.style.aspectRatio = LW + ' / ' + LH;
        low = makeCanvas(LW, LH);
        lctx = low.getContext('2d');
        lit = makeCanvas(canvas.width, canvas.height);
        litctx = lit.getContext('2d');
        buildStatic();

        ents.clear();
        ents.set('p', makeEntity('p', 'player', snap.player.x, snap.player.y, 1, 1, true));
        for (const e of snap.enemies) {
            ents.set('e' + e.id, makeEntity('e' + e.id, e.kind, e.x, e.y, e.hp, e.maxHp, e.alive));
        }

        anims = [];
        particles = [];
        texts = [];
        effects = [];
        ghosts = [];
        shakeFx = null;
        overlayFx = null;
        dashNext = false;
        pending = snap;
        applySnapshot();
        doorOpen = status === 'victory' ? 1 : 0;
        ready = true;
    }

    function applySnapshot() {
        const snap = pending;
        if (!snap) return;
        pending = null;
        status = snap.status;
        danger = snap.danger || [];
        const P = ents.get('p');
        P.x = snap.player.x;
        P.y = snap.player.y;
        P.ox = 0;
        P.oy = 0;
        P.hurt = 0;
        if (status !== 'defeat') {
            P.alpha = 1;
            P.sy = 1;
        }
        for (const e of snap.enemies) {
            const E = ents.get('e' + e.id);
            if (!E) continue;
            E.x = e.x;
            E.y = e.y;
            E.hp = e.hp;
            E.alive = e.alive;
            E.alpha = e.alive ? 1 : 0;
            E.sy = 1;
            E.ox = 0;
            E.oy = 0;
            E.flash = 0;
            E.counter = e.counter;
        }
        if (status === 'victory') doorOpen = Math.max(doorOpen, 1);
    }

    // ------------------------------------------------------------------ animações

    function at(delay, dur, update, end) {
        anims.push({ t0: cursor + delay, dur: Math.max(1, dur), update: update, end: end });
    }

    function call(delay, fn) {
        at(delay, 1, null, fn);
    }

    function flush() {
        if (!anims.length) return;
        flushing = true;
        anims.sort((a, b) => a.t0 - b.t0);
        for (const a of anims) {
            if (a.update) a.update(1);
            if (a.end) a.end();
        }
        anims = [];
        flushing = false;
    }

    function stepAnims(now) {
        if (!anims.length) return;
        for (const a of anims) {
            if (now < a.t0) continue;
            const p = clamp01((now - a.t0) / a.dur);
            if (a.update) a.update(p);
            if (p >= 1) {
                if (a.end) a.end();
                a.done = true;
            }
        }
        anims = anims.filter(a => !a.done);
        if (!anims.length) applySnapshot();
    }

    function dust(x, y, color, count) {
        if (flushing) return;
        for (let i = 0; i < count; i++) {
            particles.push({
                x: centerX(x) + (Math.random() * 8 - 4), y: centerY(y) + 6 + (Math.random() * 3 - 1),
                vx: (Math.random() - 0.5) * 0.03, vy: -Math.random() * 0.02,
                life: 320 + Math.random() * 200, max: 520, color: color, size: 1, g: 0
            });
        }
    }

    function burst(x, y, color, count) {
        if (flushing) return;
        for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const speed = 0.03 + Math.random() * 0.07;
            particles.push({
                x: centerX(x), y: centerY(y) - 2,
                vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed - 0.03,
                life: 300 + Math.random() * 300, max: 600, color: color,
                size: Math.random() < 0.3 ? 2 : 1, g: 0.00025
            });
        }
    }

    function floatText(x, y, text, color, level) {
        if (flushing) return;
        let row = 0;
        for (const t of texts) {
            if (Math.abs(t.x - x) < 0.6 && Math.abs(t.y - y) < 0.6 && t.age < 350) row++;
        }
        texts.push({ x: x, y: y, text: text, color: color, level: level, age: 0, dur: 900, row: row });
    }

    function effect(type, props, dur) {
        if (flushing) return;
        effects.push(Object.assign({ type: type, age: 0, dur: dur }, props));
    }

    function shake(mag, dur) {
        if (flushing) return;
        if (!shakeFx || shakeFx.mag * (1 - shakeFx.age / shakeFx.dur) < mag) {
            shakeFx = { mag: mag, dur: dur, age: 0 };
        }
    }

    function overlay(color, alpha, dur) {
        if (flushing) return;
        overlayFx = { color: color, alpha: alpha, dur: dur, age: 0 };
    }

    const kindColor = { C: '#9dbb72', A: '#f4ead8', S: '#a47bd0' };

    function schedule(ev) {
        const P = ents.get('p');
        const E = ev.id >= 0 ? ents.get('e' + ev.id) : null;

        switch (ev.type) {
            case 'playerMoved': {
                const fx = ev.fx, fy = ev.fy, tx = ev.tx, ty = ev.ty;
                const dash = dashNext;
                const dur = dash ? 110 : 120;
                call(0, () => {
                    sfx(dash ? 'dash' : 'step');
                    dust(fx, fy, dash ? '#a47bd0' : '#8a7f96', dash ? 10 : 4);
                });
                at(0, dur, p => {
                    const e = easeOut(p);
                    P.x = fx + (tx - fx) * e;
                    P.y = fy + (ty - fy) * e;
                    P.oy = -Math.sin(Math.PI * p) * (dash ? 1 : 3);
                    if (dash && !flushing && Math.random() < 0.6) ghosts.push({ x: P.x, y: P.y, age: 0, dur: 220 });
                }, () => {
                    P.x = tx;
                    P.y = ty;
                    P.oy = 0;
                });
                cursor += dur;
                break;
            }

            case 'cardPlayed': {
                call(0, () => sfx('card'));
                if (ev.card === 'PassoSombrio') {
                    dashNext = true;
                    break;
                }
                if (ev.card === 'Aparar') break;

                const tiles = ev.tiles || [];
                let dx = 0, dy = 1;
                if (tiles.length) {
                    let sx = 0, sy = 0;
                    for (const t of tiles) { sx += t[0]; sy += t[1]; }
                    dx = sx / tiles.length - ev.fx;
                    dy = sy / tiles.length - ev.fy;
                }
                const len = Math.hypot(dx, dy) || 1;
                const ux = dx / len, uy = dy / len;
                const heavy = ev.card === 'GolpePesado';
                const reach = heavy ? 9 : 6;
                const dur = heavy ? 280 : 180;
                const hitAt = heavy ? 130 : 70;
                at(0, dur, p => {
                    const k = p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65;
                    P.ox = ux * reach * k;
                    P.oy = -uy * reach * k;
                }, () => {
                    P.ox = 0;
                    P.oy = 0;
                });
                call(Math.max(0, hitAt - 30), () => {
                    sfx(heavy ? 'heavy' : 'slash');
                    for (const t of tiles) effect('slash', { x: t[0], y: t[1], card: ev.card, ux: ux, uy: uy }, heavy ? 240 : 180);
                    if (heavy) shake(4, 200);
                });
                cursor += hitAt;
                break;
            }

            case 'enemyDamaged': {
                if (!E) break;
                call(0, () => {
                    E.hp = Math.max(0, E.hp - ev.amount);
                    sfx('hit');
                    floatText(E.x, E.y, '-' + ev.amount, '#ffe2a8', 1);
                    burst(E.x, E.y, '#f4ead8', 7);
                    shake(1.5, 90);
                });
                at(0, 180, p => {
                    E.flash = 1 - p;
                    E.ox = Math.sin(p * Math.PI * 3) * 2 * (1 - p);
                }, () => {
                    E.flash = 0;
                    E.ox = 0;
                });
                cursor += 40;
                break;
            }

            case 'enemyDied': {
                if (!E) break;
                call(0, () => {
                    sfx('death');
                    burst(E.x, E.y, kindColor[E.kind] || '#ffffff', 18);
                });
                at(0, 300, p => {
                    E.alpha = 1 - p;
                    E.sy = 1 - p * 0.5;
                }, () => {
                    E.alive = false;
                    E.alpha = 0;
                });
                cursor += 140;
                break;
            }

            case 'enemyMoved': {
                if (!E) break;
                const fx = ev.fx, fy = ev.fy, tx = ev.tx, ty = ev.ty;
                const dur = ev.pushed ? 120 : 180;
                call(0, () => {
                    sfx(ev.pushed ? 'push' : 'step2');
                    dust(fx, fy, '#8a7f96', ev.pushed ? 8 : 3);
                });
                at(0, dur, p => {
                    const e = ev.pushed ? easeOut(p) : easeInOut(p);
                    E.x = fx + (tx - fx) * e;
                    E.y = fy + (ty - fy) * e;
                    E.oy = ev.pushed ? 0 : -Math.sin(Math.PI * p) * 2;
                }, () => {
                    E.x = tx;
                    E.y = ty;
                    E.oy = 0;
                });
                cursor += dur;
                break;
            }

            case 'enemyAttacked': {
                if (!E) break;
                const tiles = ev.tiles || [];
                let impact = 150;
                if (E.kind === 'S') {
                    impact = 240;
                    call(0, () => {
                        sfx('bell');
                        effect('ring', { x: E.x, y: E.y }, 520);
                        shake(3, 420);
                    });
                    at(0, 320, p => { E.oy = -Math.sin(p * Math.PI) * 3; }, () => { E.oy = 0; });
                } else if (E.kind === 'A') {
                    impact = 150;
                    call(0, () => {
                        sfx('arrow');
                        effect('arrow', { tiles: tiles, sx: E.x, sy: E.y }, 200);
                    });
                    at(0, 160, p => { E.ox = -Math.sin(p * Math.PI) * 2; }, () => { E.ox = 0; });
                } else {
                    const t = tiles.length ? tiles[0] : [P.x, P.y];
                    const dx = t[0] - E.x, dy = t[1] - E.y;
                    const len = Math.hypot(dx, dy) || 1;
                    at(0, 240, p => {
                        const k = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
                        E.ox = (dx / len) * 8 * k;
                        E.oy = -(dy / len) * 8 * k;
                    }, () => {
                        E.ox = 0;
                        E.oy = 0;
                    });
                    call(90, () => {
                        sfx('bite');
                        effect('bite', { x: t[0], y: t[1] }, 200);
                    });
                    impact = 110;
                }

                call(impact, () => {
                    if (!ev.hit) {
                        floatText(E.x, E.y, 'errou', '#a79db3', 0);
                        return;
                    }
                    if (ev.absorbed > 0) {
                        sfx('block');
                        effect('shield', {}, 280);
                        floatText(P.x, P.y, 'bloqueou ' + ev.absorbed, '#8fc4ea', 0);
                    }
                    if (ev.amount > 0) {
                        sfx('hurt');
                        shake(4, 240);
                        overlay('#c8402f', 0.32, 280);
                        floatText(P.x, P.y, '-' + ev.amount, '#ff7a66', 1);
                        burst(P.x, P.y, '#c8402f', 9);
                    }
                });
                if (ev.hit && ev.amount > 0) {
                    at(impact, 240, p => { P.hurt = 1 - p; }, () => { P.hurt = 0; });
                }
                cursor += impact + 130;
                break;
            }

            case 'blockGained':
                call(0, () => {
                    sfx('guard');
                    effect('shield', {}, 280);
                    floatText(P.x, P.y, '+' + ev.amount + ' bloqueio', '#8fc4ea', 0);
                });
                cursor += 40;
                break;

            case 'edgeGranted':
                call(0, () => {
                    sfx('edge');
                    overlay('#f3c552', 0.26, 420);
                    floatText(P.x, P.y, 'POR UM FIO!', '#f3c552', 2);
                    burst(P.x, P.y, '#f3c552', 14);
                });
                cursor += 60;
                break;

            case 'recomposed':
                call(0, () => {
                    sfx('shuffle');
                    floatText(P.x, P.y, '+' + ev.amount + ' cartas', '#d8cfe0', 0);
                });
                break;

            case 'victory':
                call(150, () => sfx('victory'));
                at(150, 700, p => { doorOpen = p; }, () => { doorOpen = 1; });
                cursor += 300;
                break;

            case 'defeat':
                call(100, () => {
                    sfx('defeat');
                    overlay('#7f2420', 0.55, 1000);
                });
                at(100, 600, p => {
                    P.alpha = 1 - p * 0.65;
                    P.sy = 1 - p * 0.45;
                }, null);
                cursor += 300;
                break;
        }
    }

    // ------------------------------------------------------------------ desenho

    function drawDoor() {
        const w = 22, h = 28, x = Math.round(LW / 2 - w / 2), y = WALL_TOP - h;
        lctx.fillStyle = '#08060a';
        lctx.fillRect(x, y + 3, w, h - 3);
        lctx.fillRect(x + 2, y + 1, w - 4, 2);
        if (doorOpen > 0) {
            const glow = lctx.createLinearGradient(0, y, 0, WALL_TOP);
            glow.addColorStop(0, 'rgba(243,197,82,' + (0.15 * doorOpen) + ')');
            glow.addColorStop(1, 'rgba(255,236,170,' + (0.85 * doorOpen) + ')');
            lctx.fillStyle = glow;
            lctx.fillRect(x, y + 3, w, h - 3);
        }
        const half = w / 2;
        const leaf = Math.round(half * (1 - doorOpen));
        if (leaf > 0) {
            for (const side of [0, 1]) {
                const lx = side === 0 ? x : x + w - leaf;
                lctx.fillStyle = '#6a4429';
                lctx.fillRect(lx, y + 3, leaf, h - 3);
                lctx.fillStyle = '#4b2f1b';
                for (let px = lx + 2; px < lx + leaf; px += 4) lctx.fillRect(px, y + 3, 1, h - 3);
                lctx.fillStyle = '#636c7a';
                lctx.fillRect(lx, y + 9, leaf, 2);
                lctx.fillRect(lx, y + 20, leaf, 2);
            }
            if (doorOpen < 0.05) {
                lctx.fillStyle = '#f3c552';
                lctx.fillRect(x + half - 1, y + 14, 2, 3);
            }
        }
    }

    function drawTorches(now) {
        for (const tx of torchXs()) {
            const flick = Math.sin(now / 70 + tx) * 0.5 + Math.sin(now / 31 + tx * 2) * 0.5;
            const h = 5 + Math.round(flick);
            lctx.fillStyle = '#c8402f';
            lctx.fillRect(tx - 2, 18 - h, 4, h);
            lctx.fillStyle = '#e8873a';
            lctx.fillRect(tx - 2, 18 - h + 1, 4, h - 1);
            lctx.fillRect(tx - 1, 18 - h - 1, 2, 2);
            lctx.fillStyle = '#f3c552';
            lctx.fillRect(tx - 1, 18 - h + 2, 2, h - 2);
            if (Math.random() < 0.06) {
                particles.push({
                    x: tx + (Math.random() * 2 - 1), y: 18 - h, vx: (Math.random() - 0.5) * 0.01, vy: -0.02 - Math.random() * 0.02,
                    life: 500, max: 500, color: '#f3c552', size: 1, g: 0
                });
            }
        }
    }

    function drawDanger(now) {
        for (const d of danger) {
            const t = d[2];
            let a;
            if (t <= 1) a = 0.46 + 0.2 * Math.sin(now / 80);
            else if (t <= 3) a = 0.24 + 0.06 * Math.sin(now / 220);
            else a = 0.09;
            const px = tileX(d[0]), py = tileY(d[1]);
            lctx.fillStyle = 'rgba(214,58,42,' + a + ')';
            lctx.fillRect(px + 1, py + 1, T - 2, T - 2);
            if (t <= 1) {
                lctx.fillStyle = 'rgba(255,120,100,0.9)';
                lctx.fillRect(px + 1, py + 1, T - 2, 1);
                lctx.fillRect(px + 1, py + T - 2, T - 2, 1);
                lctx.fillRect(px + 1, py + 1, 1, T - 2);
                lctx.fillRect(px + T - 2, py + 1, 1, T - 2);
            }
        }
    }

    function brackets(px, py, color, inset) {
        lctx.fillStyle = color;
        const a = px + inset, b = py + inset, c = px + T - 1 - inset, d = py + T - 1 - inset, n = 5;
        lctx.fillRect(a, b, n, 1); lctx.fillRect(a, b, 1, n);
        lctx.fillRect(c - n + 1, b, n, 1); lctx.fillRect(c, b, 1, n);
        lctx.fillRect(a, d, n, 1); lctx.fillRect(a, d - n + 1, 1, n);
        lctx.fillRect(c - n + 1, d, n, 1); lctx.fillRect(c, d - n + 1, 1, n);
    }

    function isIn(list, x, y) {
        for (const t of list) if (t[0] === x && t[1] === y) return true;
        return false;
    }

    function drawHighlights(now) {
        if (anims.length || status !== 'playing') return;
        const pulse = Math.round(Math.sin(now / 260) * 0.5 + 0.5);
        for (const t of walk) {
            const hot = hover && hover[0] === t[0] && hover[1] === t[1];
            if (hot) {
                lctx.fillStyle = 'rgba(157,187,114,0.22)';
                lctx.fillRect(tileX(t[0]) + 1, tileY(t[1]) + 1, T - 2, T - 2);
            }
            brackets(tileX(t[0]), tileY(t[1]), hot ? '#d4f0a8' : '#9dbb72', 2 + pulse);
        }
        for (const t of targets) {
            const hot = hover && hover[0] === t[0] && hover[1] === t[1];
            lctx.fillStyle = 'rgba(243,197,82,' + (hot ? 0.38 : 0.16 + 0.06 * Math.sin(now / 180)) + ')';
            lctx.fillRect(tileX(t[0]) + 1, tileY(t[1]) + 1, T - 2, T - 2);
            brackets(tileX(t[0]), tileY(t[1]), '#f3c552', 1 + pulse);
        }
    }

    function drawEntity(e, now) {
        if (e.alpha <= 0.01) return;
        const img = sheet[e.kind];
        if (!img) return;
        const bob = e.kind === 'player'
            ? (Math.sin(now / 520 + e.phase) > 0.4 ? 1 : 0)
            : (Math.sin(now / 380 + e.phase) > 0.2 ? 1 : 0);
        const cx = Math.round(centerX(e.x) + e.ox);
        const cy = Math.round(centerY(e.y) + e.oy);

        lctx.globalAlpha = 0.38 * e.alpha;
        lctx.fillStyle = '#000000';
        const sy0 = Math.round(centerY(e.y)) + 6;
        lctx.fillRect(cx - 6, sy0, 12, 2);
        lctx.fillRect(cx - 4, sy0 - 1, 8, 1);
        lctx.fillRect(cx - 4, sy0 + 2, 8, 1);

        const h = Math.max(1, Math.round(16 * e.sy));
        const px = cx - 8, py = cy - 11 - bob + (16 - h);
        lctx.globalAlpha = e.alpha;
        lctx.drawImage(img.normal, px, py, 16, h);
        if (e.flash > 0.01) {
            lctx.globalAlpha = e.alpha * clamp01(e.flash);
            lctx.drawImage(img.white, px, py, 16, h);
        }
        if (e.hurt > 0.01) {
            lctx.globalAlpha = e.alpha * clamp01(e.hurt) * 0.8;
            lctx.drawImage(img.red, px, py, 16, h);
        }
        lctx.globalAlpha = 1;

        if (e.kind !== 'player' && e.alive && e.alpha > 0.9) {
            const bw = 14, bx = cx - 7, by = py - 3;
            lctx.fillStyle = '#17101a';
            lctx.fillRect(bx - 1, by - 1, bw + 2, 4);
            lctx.fillStyle = '#4a1c18';
            lctx.fillRect(bx, by, bw, 2);
            lctx.fillStyle = '#e0503c';
            lctx.fillRect(bx, by, Math.max(1, Math.round(bw * e.hp / e.maxHp)), 2);
        }
    }

    function drawEffectsLow(dt) {
        for (const g of ghosts) {
            g.age += dt;
            const img = sheet.player;
            lctx.globalAlpha = 0.5 * (1 - g.age / g.dur);
            lctx.drawImage(img.purple, Math.round(centerX(g.x)) - 8, Math.round(centerY(g.y)) - 11);
        }
        lctx.globalAlpha = 1;
        ghosts = ghosts.filter(g => g.age < g.dur);

        for (const fx of effects) {
            fx.age += dt;
            const p = clamp01(fx.age / fx.dur);
            if (fx.type === 'slash') {
                const cx = centerX(fx.x), cy = centerY(fx.y) - 2;
                if (fx.card === 'Estocada') {
                    lctx.globalAlpha = 1 - p;
                    lctx.fillStyle = '#ffffff';
                    lctx.fillRect(cx - 1, tileY(fx.y) + 1, 2, T - 2);
                    lctx.fillStyle = '#f3c552';
                    lctx.fillRect(cx - 2, tileY(fx.y) + 3 + Math.round(p * 6), 1, T - 8);
                    lctx.fillRect(cx + 1, tileY(fx.y) + 3 + Math.round(p * 6), 1, T - 8);
                } else {
                    const big = fx.card === 'GolpePesado';
                    const base = Math.atan2(-fx.uy, fx.ux);
                    const sweep = Math.PI * (fx.card === 'Varredura' ? 0.9 : 1.1);
                    const a0 = base - sweep / 2 + sweep * easeOut(p) * 0.6;
                    lctx.globalAlpha = 1 - p * p;
                    lctx.strokeStyle = '#ffffff';
                    lctx.lineWidth = big ? 4 : 3;
                    lctx.beginPath();
                    lctx.arc(cx - fx.ux * 4, cy + fx.uy * 4, big ? 10 : 8, a0 - 0.9, a0 + 0.5);
                    lctx.stroke();
                    lctx.strokeStyle = '#f3c552';
                    lctx.lineWidth = 1;
                    lctx.beginPath();
                    lctx.arc(cx - fx.ux * 4, cy + fx.uy * 4, (big ? 10 : 8) + 2, a0 - 1.1, a0 + 0.2);
                    lctx.stroke();
                }
                lctx.globalAlpha = 1;
            } else if (fx.type === 'bite') {
                const cx = centerX(fx.x), cy = centerY(fx.y) - 2;
                const gap = Math.round(7 * (1 - easeOut(Math.min(1, p * 2))));
                lctx.globalAlpha = 1 - p * p;
                lctx.fillStyle = '#ffffff';
                for (let i = -2; i <= 2; i++) {
                    const tx = cx + i * 3 - 1;
                    lctx.fillRect(tx, cy - gap - 4, 2, 4);
                    lctx.fillRect(tx, cy + gap, 2, 4);
                }
                lctx.globalAlpha = 1;
            } else if (fx.type === 'ring') {
                const cx = centerX(fx.x), cy = centerY(fx.y);
                for (let k = 0; k < 2; k++) {
                    const q = clamp01(p * 1.25 - k * 0.25);
                    if (q <= 0) continue;
                    lctx.globalAlpha = (1 - q) * 0.9;
                    lctx.strokeStyle = k === 0 ? '#f3c552' : '#a47bd0';
                    lctx.lineWidth = 2;
                    lctx.beginPath();
                    lctx.arc(cx, cy, 6 + easeOut(q) * 190, 0, Math.PI * 2);
                    lctx.stroke();
                }
                lctx.globalAlpha = 1;
            } else if (fx.type === 'arrow') {
                const tiles = fx.tiles;
                if (tiles.length) {
                    const vertical = tiles.every(t => t[0] === tiles[0][0]);
                    lctx.globalAlpha = 1 - p * 0.4;
                    if (vertical) {
                        const x = centerX(tiles[0][0]);
                        const fromTop = fx.sy >= (rows - 1) / 2;
                        const y0 = WALL_TOP, y1 = WALL_TOP + rows * T;
                        const head = fromTop ? y0 + (y1 - y0) * p : y1 - (y1 - y0) * p;
                        const tail = fromTop ? Math.max(y0, head - 46) : Math.min(y1, head + 46);
                        lctx.fillStyle = 'rgba(244,234,216,0.35)';
                        lctx.fillRect(x - 1, Math.min(head, tail), 2, Math.abs(head - tail));
                        lctx.fillStyle = '#ffffff';
                        lctx.fillRect(x - 1, Math.round(head) - (fromTop ? 8 : 0), 2, 8);
                    } else {
                        const y = centerY(tiles[0][1]) - 2;
                        const fromLeft = fx.sx <= (cols - 1) / 2;
                        const x0 = WALL_SIDE, x1 = WALL_SIDE + cols * T;
                        const head = fromLeft ? x0 + (x1 - x0) * p : x1 - (x1 - x0) * p;
                        const tail = fromLeft ? Math.max(x0, head - 46) : Math.min(x1, head + 46);
                        lctx.fillStyle = 'rgba(244,234,216,0.35)';
                        lctx.fillRect(Math.min(head, tail), y - 1, Math.abs(head - tail), 2);
                        lctx.fillStyle = '#ffffff';
                        lctx.fillRect(Math.round(head) - (fromLeft ? 8 : 0), y - 1, 8, 2);
                    }
                    lctx.globalAlpha = 1;
                }
            } else if (fx.type === 'shield') {
                const P = ents.get('p');
                const cx = centerX(P.x), cy = centerY(P.y) - 3;
                lctx.globalAlpha = (1 - p) * 0.9;
                lctx.strokeStyle = '#8fc4ea';
                lctx.lineWidth = 2;
                lctx.beginPath();
                lctx.arc(cx, cy, 9 + p * 4, 0, Math.PI * 2);
                lctx.stroke();
                lctx.globalAlpha = 1;
            }
        }
        effects = effects.filter(fx => fx.age < fx.dur);

        for (const pt of particles) {
            pt.life -= dt;
            pt.vy += pt.g * dt;
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            lctx.globalAlpha = clamp01(pt.life / pt.max);
            lctx.fillStyle = pt.color;
            lctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
        }
        lctx.globalAlpha = 1;
        particles = particles.filter(pt => pt.life > 0);
    }

    function hole(x, y, r, a) {
        const g = litctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(0,0,0,' + a + ')');
        g.addColorStop(0.55, 'rgba(0,0,0,' + a * 0.6 + ')');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        litctx.fillStyle = g;
        litctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    function glow(x, y, r, color) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    function drawLighting(now, ox, oy) {
        const W = canvas.width, H = canvas.height;
        litctx.globalCompositeOperation = 'source-over';
        litctx.clearRect(0, 0, W, H);
        litctx.fillStyle = 'rgba(8,5,14,0.62)';
        litctx.fillRect(0, 0, W, H);
        litctx.globalCompositeOperation = 'destination-out';

        const flick = 1 + Math.sin(now / 90) * 0.03 + Math.sin(now / 37) * 0.02;
        for (const tx of torchXs()) hole(tx * SCALE + ox, 14 * SCALE + oy, 330 * flick, 0.95);

        const P = ents.get('p');
        hole(centerX(P.x) * SCALE + ox, (centerY(P.y) - 2) * SCALE + oy, 250, 0.9 * P.alpha);
        for (const e of ents.values()) {
            if (e.kind === 'player' || e.alpha <= 0.05) continue;
            hole(centerX(e.x) * SCALE + ox, centerY(e.y) * SCALE + oy, 130, 0.5 * e.alpha);
        }
        if (doorOpen > 0) hole(LW / 2 * SCALE + ox, (WALL_TOP - 8) * SCALE + oy, 300, doorOpen);

        ctx.drawImage(lit, 0, 0);

        ctx.globalCompositeOperation = 'lighter';
        for (const tx of torchXs()) glow(tx * SCALE + ox, 14 * SCALE + oy, 300 * flick, 'rgba(255,130,50,0.20)');
        if (doorOpen > 0) glow(LW / 2 * SCALE + ox, (WALL_TOP - 6) * SCALE + oy, 340, 'rgba(255,220,140,' + 0.3 * doorOpen + ')');
        ctx.globalCompositeOperation = 'source-over';

        const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.72);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, W, H);
    }

    function outlined(text, x, y, size, color, alpha, align) {
        ctx.font = Math.round(size * 1.2) + 'px ' + FONT;
        ctx.textAlign = align || 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = alpha;
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(4, size * 0.22);
        ctx.strokeStyle = '#120c16';
        ctx.strokeText(text, x, y);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.globalAlpha = 1;
    }

    function drawHiRes(dt, ox, oy) {
        // Contagem regressiva em cada casa marcada.
        for (const d of danger) {
            const t = d[2];
            const x = (tileX(d[0]) + T - 5) * SCALE + ox;
            const y = (tileY(d[1]) + 6) * SCALE + oy;
            if (t <= 1) outlined(String(t), x, y, 30, '#ffd0c4', 1);
            else if (t <= 3) outlined(String(t), x, y, 26, '#f0a03c', 0.95);
            else outlined(String(t), x, y, 22, '#c98a4a', 0.5);
        }

        // Contagem de cada inimigo, ao lado da cabeça.
        if (!anims.length) {
            for (const e of ents.values()) {
                if (e.kind === 'player' || !e.alive) continue;
                const x = (centerX(e.x) + 10) * SCALE + ox;
                const y = (centerY(e.y) - 13) * SCALE + oy;
                ctx.beginPath();
                ctx.arc(x, y, 17, 0, Math.PI * 2);
                ctx.fillStyle = e.counter <= 1 ? '#c8402f' : '#1b1420';
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = e.counter <= 1 ? '#ffd0c4' : '#e8873a';
                ctx.stroke();
                outlined(String(e.counter), x, y + 1, 24, e.counter <= 1 ? '#ffffff' : '#f3c552', 1);
            }
        }

        for (const t of texts) {
            t.age += dt;
            const p = clamp01(t.age / t.dur);
            const size = t.level === 2 ? 40 : t.level === 1 ? 44 : 28;
            const x = centerX(t.x) * SCALE + ox;
            const y = (centerY(t.y) - 16 - easeOut(p) * 14 - t.row * 9) * SCALE + oy;
            const pop = t.level > 0 && p < 0.15 ? 1 + (0.15 - p) * 2.4 : 1;
            outlined(t.text, Math.max(90, Math.min(canvas.width - 90, x)), y, size * pop, t.color, p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3);
        }
        texts = texts.filter(t => t.age < t.dur);

        if (overlayFx) {
            overlayFx.age += dt;
            const p = clamp01(overlayFx.age / overlayFx.dur);
            ctx.globalAlpha = overlayFx.alpha * (1 - p);
            ctx.fillStyle = overlayFx.color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1;
            if (p >= 1) overlayFx = null;
        }
    }

    function frame(now) {
        raf = requestAnimationFrame(frame);
        if (!ready) return;
        const dt = Math.min(50, now - (last || now));
        last = now;

        stepAnims(now);

        lctx.globalAlpha = 1;
        lctx.drawImage(staticLayer, 0, 0);
        drawDoor();
        drawTorches(now);
        drawDanger(now);
        drawHighlights(now);
        const order = Array.from(ents.values()).sort((a, b) => b.y - a.y);
        for (const e of order) drawEntity(e, now);
        drawEffectsLow(dt);

        let ox = 0, oy = 0;
        if (shakeFx) {
            shakeFx.age += dt;
            const k = 1 - shakeFx.age / shakeFx.dur;
            if (k <= 0) {
                shakeFx = null;
            } else {
                ox = Math.round((Math.random() * 2 - 1) * shakeFx.mag * k) * SCALE;
                oy = Math.round((Math.random() * 2 - 1) * shakeFx.mag * k) * SCALE;
            }
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#0c090f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(low, ox, oy, LW * SCALE, LH * SCALE);
        drawLighting(now, ox, oy);
        drawHiRes(dt, ox, oy);
    }

    // ------------------------------------------------------------------ entrada

    function tileFromEvent(ev) {
        if (!ready) return null;
        const r = canvas.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return null;
        const lx = (ev.clientX - r.left) / r.width * LW;
        const ly = (ev.clientY - r.top) / r.height * LH;
        const x = Math.floor((lx - WALL_SIDE) / T);
        const y = rows - 1 - Math.floor((ly - WALL_TOP) / T);
        if (x < 0 || x >= cols || y < 0 || y >= rows) return null;
        return [x, y];
    }

    function onClick(ev) {
        audio();
        const t = tileFromEvent(ev);
        if (t && dotnet) dotnet.invokeMethodAsync('OnTileClick', t[0], t[1]);
    }

    function onMove(ev) {
        hover = tileFromEvent(ev);
        const actionable = hover && (isIn(walk, hover[0], hover[1]) || isIn(targets, hover[0], hover[1]));
        canvas.style.cursor = actionable ? 'pointer' : 'default';
    }

    function onLeave() {
        hover = null;
    }

    // ------------------------------------------------------------------ API usada pelo C#

    window.hellsCastle = {
        init: function (canvasElement, dotnetRef) {
            canvas = canvasElement;
            ctx = canvas.getContext('2d');
            dotnet = dotnetRef;
            ready = false;
            buildSheet();
            try {
                muted = window.localStorage.getItem('hc-muted') === '1';
            } catch (e) {
                muted = false;
            }
            if (document.fonts && document.fonts.load) {
                document.fonts.load('24px "Jersey 15"').catch(function () { });
            }
            canvas.addEventListener('click', onClick);
            canvas.addEventListener('pointermove', onMove);
            canvas.addEventListener('pointerleave', onLeave);
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(frame);
            return { icons: dataUrls(), muted: muted };
        },

        sync: function (snap, events, reset) {
            if (!canvas) return;
            if (reset || !ready || snap.cols !== cols || snap.rows !== rows) {
                resetAll(snap);
            }
            walk = snap.walk || [];
            targets = snap.targets || [];
            if (events && events.length) {
                flush();
                cursor = performance.now();
                dashNext = false;
                for (const ev of events) schedule(ev);
                dashNext = false;
            }
            pending = snap;
            if (!anims.length) applySnapshot();
        },

        setMuted: function (value) {
            muted = !!value;
            try {
                window.localStorage.setItem('hc-muted', muted ? '1' : '0');
            } catch (e) {
                // sem armazenamento local: a preferência vale só para esta visita
            }
        },

        unlockAudio: function () {
            audio();
        },

        // Para testes automatizados: indica se ainda há animação em andamento.
        busy: function () {
            return anims.length > 0;
        },

        dispose: function () {
            cancelAnimationFrame(raf);
            if (canvas) {
                canvas.removeEventListener('click', onClick);
                canvas.removeEventListener('pointermove', onMove);
                canvas.removeEventListener('pointerleave', onLeave);
            }
            dotnet = null;
            canvas = null;
            ready = false;
        }
    };
})();

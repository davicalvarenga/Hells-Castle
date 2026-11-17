// Cutscene inicial "08h17 — DA PLANILHA À PRAIA": 5 ilustrações em pixel art (docs/assets/intro/cenaN.png)
// num palco 16:9 com animações CSS por cena e um overlay de partículas em canvas transparente.
// Módulo sem estado do jogo: game.js controla avanço, digitação, áudio e o fim da cutscene.
(function () {
    'use strict';

    // anim: classe CSS do palco (Ken Burns, tremor, zoom dramático, transmutação, pan).
    // ambience/muffle: ambiente de áudio e abafamento | sfx: efeitos com atraso (ms) ao entrar na cena.
    const SCENES = [
        {
            id: 'rotina',
            tag: '08:17 — A ROTINA',
            title: 'A Rotina',
            text: '08:17. Horizonte Serviços. Valter Motta nunca sabe dizer "não" — e toda manhã a pilha na sua mesa é maior que a anterior.',
            image: 'assets/intro/cena1.png',
            anim: 'anim-kenburns',
            ambience: 'office',
            muffle: false,
            sfx: []
        },
        {
            id: 'sufoco',
            tag: '10:42 — O SUFOCO',
            title: 'O Sufoco',
            text: 'Planilhas travam. O chefe cobra. A impressora engasga. O barulho do escritório fica alto demais...',
            image: 'assets/intro/cena2.png',
            anim: 'anim-shake',
            ambience: 'office',
            muffle: false,
            sfx: [{ name: 'mail', at: 0 }, { name: 'mail', at: 650 }, { name: 'printer', at: 1300 }]
        },
        {
            id: 'desligamento',
            tag: '10:43 — O DESLIGAMENTO',
            title: 'O Desligamento',
            text: 'Para não surtar, Valter faz o que sua mente sempre faz quando o peso passa do limite: ele desliga do mundo real.',
            image: 'assets/intro/cena3.png',
            anim: 'anim-zoom',
            ambience: 'office',
            muffle: true,
            sfx: []
        },
        {
            id: 'transmutacao',
            tag: '10:43 — A TRANSMUTAÇÃO',
            title: 'A Transmutação',
            text: 'Cada crise do trabalho vira um mundo épico para enfrentar. É só dentro dos devaneios que ele encontra coragem.',
            image: 'assets/intro/cena4.png',
            anim: 'anim-transmute',
            bubble: 'Ei, Motta... tá me ouvindo?',
            ambience: 'beach',
            muffle: false,
            sfx: [{ name: 'wave', at: 300 }]
        },
        {
            id: 'praia',
            tag: '??:?? — A PRAIA DO CREPÚSCULO',
            title: 'A Praia do Crepúsculo',
            text: '5 devaneios. 5 pesos para vencer até as 18h00. Hora de encarar o primeiro: a Praia da Impressora Faminta.',
            image: 'assets/intro/cena5.png',
            anim: 'anim-pan',
            ambience: 'beach',
            muffle: false,
            sfx: [{ name: 'wave', at: 200 }]
        }
    ];

    // ---------- PRÉ-CARREGAMENTO ----------
    // status: 'loading' | 'loaded' | 'failed'. Uma imagem que falha não trava nada: o palco usa o fundo
    // de reserva da cena (degradê em CSS) e a cutscene segue normalmente.
    const images = [];
    const status = [];

    function preload() {
        if (images.length) return images;
        SCENES.forEach((sc, i) => {
            const img = new Image();
            status[i] = 'loading';
            img.onload = () => { status[i] = img.naturalWidth > 0 ? 'loaded' : 'failed'; };
            img.onerror = () => { status[i] = 'failed'; };
            img.decoding = 'async';
            img.src = sc.image;
            images.push(img);
        });
        return images;
    }

    function getStatus() {
        return status.slice();
    }

    // ---------- PARTÍCULAS (overlay transparente) ----------
    // Cada partícula é função pura de (índice, tempo): sem estado, sem acúmulo, sem pular quadro.
    function hash(i, salt) {
        const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
        return x - Math.floor(x);
    }

    const wrap = (v, max) => ((v % max) + max) % max;

    function dust(g, w, h, t, u) {
        g.fillStyle = 'rgba(220, 240, 230, 0.35)';
        for (let i = 0; i < 26; i++) {
            const x = wrap(hash(i, 1) * w + Math.sin(t * 0.3 + i) * 12 * u, w);
            const y = wrap(hash(i, 2) * h - t * (4 + hash(i, 3) * 6) * u, h);
            const s = Math.max(1, Math.round((1 + hash(i, 4) * 1.5) * u));
            g.fillRect(Math.round(x), Math.round(y), s, s);
        }
    }

    function sparks(g, w, h, t, u) {
        for (let i = 0; i < 34; i++) {
            const life = wrap(t * (0.5 + hash(i, 5) * 0.6) + hash(i, 6), 1);
            const x = hash(i, 7) * w + Math.sin(life * 6 + i) * 10 * u;
            const y = h * (0.95 - life * 0.75);
            const a = Math.sin(life * Math.PI);
            const s = Math.max(1, Math.round((1 + hash(i, 8) * 2) * u));
            g.fillStyle = i % 3 === 0 ? 'rgba(255, 210, 90,' + a + ')' : 'rgba(255, 70, 50,' + (a * 0.9) + ')';
            g.fillRect(Math.round(x), Math.round(y), s, s);
        }
        // alertas "!" subindo
        for (let i = 0; i < 4; i++) {
            const life = wrap(t * 0.35 + i / 4, 1);
            const x = w * (0.12 + 0.22 * i) + Math.sin(t + i) * 6 * u;
            const y = h * (0.85 - life * 0.6);
            const a = Math.sin(life * Math.PI) * 0.85;
            const s = Math.round(3 * u);
            g.fillStyle = 'rgba(255, 60, 40,' + a + ')';
            g.fillRect(Math.round(x), Math.round(y), s, s * 3);
            g.fillRect(Math.round(x), Math.round(y + s * 4), s, s);
        }
    }

    function motes(g, w, h, t, u) {
        g.fillStyle = 'rgba(255, 200, 140, 0.18)';
        for (let i = 0; i < 12; i++) {
            const x = w * 0.5 + Math.cos(i * 0.7 + t * 0.2) * w * (0.15 + hash(i, 9) * 0.3);
            const y = h * 0.5 + Math.sin(i * 1.3 + t * 0.25) * h * (0.15 + hash(i, 10) * 0.25);
            const s = Math.max(1, Math.round(2 * u));
            g.fillRect(Math.round(x), Math.round(y), s, s);
        }
    }

    function paperAndSand(g, w, h, t, u) {
        // folhas brancas cruzando o palco
        for (let i = 0; i < 16; i++) {
            const speed = 0.08 + hash(i, 11) * 0.1;
            const p = wrap(t * speed + hash(i, 12), 1);
            const x = w * (1.1 - p * 1.25);
            const y = h * (0.15 + hash(i, 13) * 0.7) + Math.sin(t * 2 + i) * 14 * u;
            const sw = Math.round((6 + hash(i, 14) * 6) * u);
            const sh = Math.round(sw * 0.7);
            const tilt = Math.sin(t * 3 + i) > 0;
            g.fillStyle = 'rgba(250, 248, 240, 0.92)';
            g.fillRect(Math.round(x), Math.round(y), tilt ? sw : sh, tilt ? sh : sw);
            g.fillStyle = 'rgba(160, 170, 185, 0.6)';
            g.fillRect(Math.round(x + u), Math.round(y + u * 2), Math.max(1, Math.round(sw * 0.6)), Math.max(1, Math.round(u)));
        }
        // areia brilhante
        for (let i = 0; i < 46; i++) {
            const p = wrap(t * (0.12 + hash(i, 15) * 0.15) + hash(i, 16), 1);
            const x = w * (1.05 - p * 1.1);
            const y = h * (0.55 + hash(i, 17) * 0.45) - p * 30 * u;
            const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 6 + i));
            const s = Math.max(1, Math.round(u * (1 + hash(i, 18))));
            g.fillStyle = 'rgba(255, 214, 140,' + a + ')';
            g.fillRect(Math.round(x), Math.round(y), s, s);
        }
    }

    function goldenBreeze(g, w, h, t, u) {
        for (let i = 0; i < 40; i++) {
            const p = wrap(t * (0.04 + hash(i, 19) * 0.06) + hash(i, 20), 1);
            const x = w * (p * 1.1 - 0.05);
            const y = h * (0.2 + hash(i, 21) * 0.75) + Math.sin(t * 1.5 + i * 2) * 10 * u;
            const a = 0.35 + 0.55 * Math.abs(Math.sin(t * 2 + i));
            const s = Math.max(1, Math.round(u * (1 + hash(i, 22) * 1.5)));
            g.fillStyle = 'rgba(255, 205, 110,' + a + ')';
            g.fillRect(Math.round(x), Math.round(y), s, s);
        }
    }

    const PARTICLES = [dust, sparks, motes, paperAndSand, goldenBreeze];

    // ---------- Partículas leves das ilustrações de transição de fase e do epílogo ----------
    function fog(g, w, h, t, u) {
        for (let i = 0; i < 18; i++) {
            const p = wrap(t * (0.015 + hash(i, 23) * 0.02) + hash(i, 24), 1);
            const x = w * (p * 1.3 - 0.15);
            const y = h * (0.45 + hash(i, 25) * 0.5);
            const r = (18 + hash(i, 26) * 30) * u;
            g.fillStyle = 'rgba(160, 190, 220, 0.05)';
            g.fillRect(Math.round(x - r), Math.round(y - r * 0.3), Math.round(r * 2), Math.round(r * 0.6));
        }
        g.fillStyle = 'rgba(120, 220, 255, 0.5)';
        for (let i = 0; i < 10; i++) {
            const life = wrap(t * 0.2 + hash(i, 27), 1);
            const s = Math.max(1, Math.round(u));
            g.fillRect(Math.round(w * hash(i, 28)), Math.round(h * (0.9 - life * 0.6)), s, s);
        }
    }

    function snow(g, w, h, t, u) {
        g.fillStyle = 'rgba(235, 245, 255, 0.85)';
        for (let i = 0; i < 60; i++) {
            const speed = 0.12 + hash(i, 29) * 0.18;
            const p = wrap(t * speed + hash(i, 30), 1);
            const x = wrap(w * hash(i, 31) - p * w * 0.35 + Math.sin(t + i) * 6 * u, w);
            const y = h * (p * 1.1 - 0.05);
            const s = Math.max(1, Math.round(u * (1 + hash(i, 32) * 1.5)));
            g.fillRect(Math.round(x), Math.round(y), s, s);
        }
    }

    function embers(g, w, h, t, u) {
        for (let i = 0; i < 26; i++) {
            const life = wrap(t * (0.18 + hash(i, 33) * 0.2) + hash(i, 34), 1);
            const x = w * hash(i, 35) + Math.sin(life * 8 + i) * 8 * u;
            const y = h * (1 - life * 0.9);
            const a = Math.sin(life * Math.PI) * 0.9;
            const s = Math.max(1, Math.round(u * (1 + hash(i, 36))));
            g.fillStyle = 'rgba(255, ' + Math.round(150 + hash(i, 37) * 80) + ', 60,' + a + ')';
            g.fillRect(Math.round(x), Math.round(y), s, s);
        }
    }

    const PARTICLE_KINDS = { dust: dust, sparks: sparks, motes: motes, paper: paperAndSand, golden: goldenBreeze, fog: fog, snow: snow, embers: embers };
    // Bioma da fase -> partículas da ilustração de entrada.
    const BIOME_PARTICLES = { beach: 'golden', city: 'fog', snow: 'snow', dungeon: 'embers', abyss: 'golden', epilogue: 'golden' };

    // Versão por nome (cards de transição e epílogo). Mesmo canvas transparente e mesmo "pixel" proporcional.
    function drawParticlesKind(canvas, kind, t) {
        return drawWith(canvas, PARTICLE_KINDS[kind] || dust, t);
    }

    // Desenha as partículas da cena `index` no instante `t` (s). O canvas acompanha o tamanho do palco.
    function drawParticles(canvas, index, t) {
        return drawWith(canvas, PARTICLES[Math.max(0, Math.min(PARTICLES.length - 1, index))], t);
    }

    function drawWith(canvas, fn, t) {
        if (!canvas || !canvas.getContext) return false;
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(1, Math.round(rect.width * dpr));
        const h = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        const g = canvas.getContext('2d');
        if (!g) return false;
        g.clearRect(0, 0, w, h);
        // u: "pixel" das partículas proporcional ao palco (mantém o visual pixel art em qualquer tela)
        fn(g, w, h, Math.max(0, t || 0), Math.max(1, w / 480));
        return true;
    }

    window.GameIntro = {
        SCENES: SCENES,
        preload: preload,
        getStatus: getStatus,
        get images() { return images; },
        drawParticles: drawParticles,
        drawParticlesKind: drawParticlesKind,
        BIOME_PARTICLES: BIOME_PARTICLES
    };
})();

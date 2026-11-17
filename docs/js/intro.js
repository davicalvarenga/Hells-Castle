// Cutscene inicial "08h17 — DA PLANILHA À PRAIA": 4 cenas em pixel art desenhadas num canvas 320x180.
// Módulo só de desenho e roteiro (sem estado do jogo): game.js controla avanço, digitação, áudio e o fim.
(function () {
    'use strict';

    const W = 320;
    const H = 180;

    // ambience: ambiente de áudio da cena | sfx: efeito ao entrar na cena (respeita o Mudo do GameAudio).
    const SCENES = [
        {
            id: 'planilha',
            time: '08:17',
            title: 'Só mais uma planilha',
            text: 'Segunda-feira, 08:17. Valter Motta encara uma planilha vazia na baia cinza do terceiro andar. "Só mais uma planilha. Só mais um dia."',
            ambience: 'office',
            sfx: null
        },
        {
            id: 'pressao',
            time: '08:17',
            title: 'A Pressão',
            text: 'URGENTE. URGENTÍSSIMO. "Re: Re: Re: Relatório #25". Os e-mails pipocam na tela, e a impressora do corredor começa a tremer com a luz vermelha piscando.',
            ambience: 'office',
            sfx: 'mail'
        },
        {
            id: 'gatilho',
            time: '08:17',
            title: 'O Gatilho',
            text: 'A impressora engasga e cospe folhas em branco. Dez, cem, mil. O branco cobre o carpete... e vira areia. O zumbido da sala vira o som de ondas.',
            ambience: 'beach',
            sfx: 'printer'
        },
        {
            id: 'devaneio',
            time: '18:00',
            title: 'O Devaneio',
            text: 'Para bater o ponto às 18:00, Valter precisa atravessar os próprios devaneios, um a cada hora do dia. O primeiro começa aqui: a Praia do Crepúsculo, onde mora a Impressora Faminta.',
            ambience: 'beach',
            sfx: 'wave'
        }
    ];

    // Gerador determinístico para os detalhes (o desenho não pisca de quadro para quadro).
    function rng(seed) {
        let s = seed >>> 0;
        return () => {
            s = (s + 0x6D2B79F5) >>> 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const lerp = (a, b, k) => a + (b - a) * k;
    const clamp01 = v => Math.max(0, Math.min(1, v));

    function mix(c1, c2, k) {
        const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
        const a = p(c1);
        const b = p(c2);
        return '#' + a.map((v, i) => Math.round(lerp(v, b[i], clamp01(k))).toString(16).padStart(2, '0')).join('');
    }

    function rect(g, x, y, w, h, c) {
        g.fillStyle = c;
        g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }

    // Valter: usa o sprite 16x16 do crachá (sprites.js), ampliado sem suavização.
    function drawValter(g, x, y, scale, sprites) {
        const sheet = sprites && sprites.getSheet ? sprites.getSheet('hero_valter') : null;
        if (sheet && sheet.normal) {
            g.drawImage(sheet.normal, Math.round(x), Math.round(y), 16 * scale, 16 * scale);
            return;
        }
        rect(g, x + 4 * scale, y, 8 * scale, 7 * scale, '#f2c199');
        rect(g, x + 2 * scale, y + 7 * scale, 12 * scale, 7 * scale, '#3e324b');
    }

    // ---------- ESCRITÓRIO (cenas 1 a 3) ----------
    function drawOffice(g, t, opts) {
        const o = opts || {};
        const flicker = Math.sin(t * 23) > 0.93 ? 0.55 : 1;
        rect(g, 0, 0, W, H, '#4b5361');
        rect(g, 0, 0, W, 18, '#2d333d');
        // lâmpadas fluorescentes
        [40, 140, 240].forEach((x, i) => {
            const on = i === 1 ? flicker : 1;
            rect(g, x, 6, 44, 5, on > 0.9 ? '#e9f6ff' : '#9fb1bd');
        });
        // relógio de parede
        rect(g, 258, 26, 44, 18, '#0b1016');
        rect(g, 260, 28, 40, 14, '#13222b');
        g.fillStyle = '#4ade80';
        g.font = '10px monospace';
        g.fillText('08:17', 265, 39);
        // divisórias da baia
        rect(g, 0, 50, 26, 90, '#8a93a3');
        rect(g, 2, 52, 22, 86, '#a2abba');
        rect(g, 226, 58, 18, 82, '#8a93a3');
        // carpete (vira areia na cena 3)
        rect(g, 0, 140, W, 40, mix('#3a3f4a', '#e9c98f', o.sand || 0));
        for (let x = 0; x < W; x += 8) rect(g, x, 140, 4, 1, mix('#323743', '#d8b479', o.sand || 0));
        // mesa
        rect(g, 40, 122, 190, 8, '#6b4f33');
        rect(g, 46, 130, 6, 24, '#4f3926');
        rect(g, 216, 130, 6, 24, '#4f3926');
        // monitor
        rect(g, 112, 66, 84, 54, '#1a1d24');
        rect(g, 116, 70, 76, 44, '#e8f5e9');
        rect(g, 148, 120, 20, 3, '#1a1d24');
        // planilha vazia: grade verde
        rect(g, 116, 70, 76, 6, '#1d6f42');
        for (let x = 116; x < 192; x += 13) rect(g, x, 76, 1, 38, '#a5d6a7');
        for (let y = 76; y < 114; y += 6) rect(g, 116, y, 76, 1, '#a5d6a7');
        if (Math.floor(t * 2) % 2 === 0) rect(g, 131, 79, 1, 4, '#1a1d24');
        // caneca e post-it
        rect(g, 204, 112, 9, 10, '#f5efe6');
        rect(g, 202, 108, 2, 4, '#c9bda6');
        rect(g, 96, 104, 12, 12, '#f5cb5c');
        // Valter de costas para nós (sentado)
        drawValter(g, 60, 92, 2, o.sprites);
        rect(g, 58, 120, 36, 4, '#2d333d');
    }

    function drawPrinter(g, x, y, t, intensity) {
        const shake = intensity > 0 ? Math.round(Math.sin(t * 50) * intensity) : 0;
        x += shake;
        rect(g, x, y + 8, 54, 30, '#c9cfd8');
        rect(g, x + 4, y, 46, 10, '#aab3c0');
        rect(g, x + 8, y + 18, 38, 4, '#2d333d');
        rect(g, x, y + 36, 54, 6, '#8a93a3');
        const blink = Math.floor(t * 4) % 2 === 0;
        rect(g, x + 44, y + 12, 5, 4, intensity > 0 && blink ? '#ff3a2a' : '#6b1d18');
    }

    function drawScene1(g, t, sprites) {
        drawOffice(g, t, { sprites: sprites });
        drawPrinter(g, 252, 98, t, 0);
    }

    function drawScene2(g, t, sprites) {
        drawOffice(g, t, { sprites: sprites });
        drawPrinter(g, 252, 98, t, 1.5);
        // e-mails urgentes pipocando sobre a planilha
        const count = Math.min(6, 1 + Math.floor(t * 1.6));
        const r = rng(25);
        for (let i = 0; i < count; i++) {
            const x = 112 + Math.floor(r() * 50);
            const y = 64 + Math.floor(r() * 34);
            rect(g, x, y, 42, 22, '#0f172a');
            rect(g, x + 1, y + 1, 40, 20, '#f8fafc');
            rect(g, x + 1, y + 1, 40, 5, '#dc2626');
            rect(g, x + 4, y + 9, 3, 8, '#dc2626');
            rect(g, x + 4, y + 18, 3, 2, '#dc2626');
            rect(g, x + 10, y + 10, 26, 2, '#94a3b8');
            rect(g, x + 10, y + 15, 18, 2, '#94a3b8');
        }
        // brilho vermelho da impressora no chão
        if (Math.floor(t * 4) % 2 === 0) {
            g.fillStyle = 'rgba(255, 58, 42, 0.18)';
            g.fillRect(232, 136, 88, 10);
        }
    }

    function drawScene3(g, t, sprites) {
        const sand = clamp01((t - 1.2) / 2.6);
        drawOffice(g, t, { sprites: sprites, sand: sand });
        drawPrinter(g, 252, 98, t, 2.5);
        // folhas voando da impressora e cobrindo o chão
        const r = rng(77);
        const sheets = Math.min(70, Math.floor(t * 26));
        for (let i = 0; i < sheets; i++) {
            const born = i / 26;
            const life = clamp01((t - born) / 1.4);
            const tx = 10 + r() * 300;
            const ty = 142 + r() * 34;
            const x = lerp(266, tx, life);
            const y = lerp(118, ty, life) - Math.sin(life * Math.PI) * 30;
            rect(g, x, y, 7, 5, mix('#ffffff', '#f3dca6', sand));
        }
        // a maré sobe pelo pé da tela
        if (sand > 0.5) {
            const k = (sand - 0.5) * 2;
            const top = H - k * 14;
            rect(g, 0, top, W, H - top, '#1f6f8b');
            for (let x = 0; x < W; x += 12) rect(g, x + Math.round(Math.sin(t * 3 + x) * 2), top, 6, 1, '#bff3ff');
        }
    }

    // ---------- PRAIA DO CREPÚSCULO (cena 4) ----------
    function drawScene4(g, t, sprites) {
        for (let y = 0; y < 96; y += 4) rect(g, 0, y, W, 4, mix('#3d2c73', '#ff7a3d', y / 96));
        // sol se pondo
        g.fillStyle = '#ffd27a';
        g.beginPath();
        g.arc(230, 92, 20, Math.PI, 0);
        g.fill();
        rect(g, 210, 82, 40, 2, '#ff9f5a');
        // mar com brilhos
        rect(g, 0, 92, W, 30, '#0b2c3c');
        const r = rng(9);
        for (let i = 0; i < 40; i++) {
            const x = (r() * W + t * (6 + i % 5)) % W;
            rect(g, x, 94 + r() * 26, 3 + r() * 6, 1, i % 3 === 0 ? '#ff9f5a' : '#7fe0d8');
        }
        // espuma da onda que vai e volta
        const foam = 122 + Math.round(Math.sin(t * 1.4) * 3);
        rect(g, 0, 120, W, foam - 120 + 2, '#1f6f8b');
        rect(g, 0, foam, W, 2, '#e9fbff');
        // areia
        rect(g, 0, foam + 2, W, H - foam - 2, '#e9c98f');
        for (let i = 0; i < 60; i++) rect(g, r() * W, foam + 6 + r() * 50, 2, 1, '#cfa76a');
        // folhas esquecidas na areia
        for (let i = 0; i < 9; i++) rect(g, 20 + r() * 280, 150 + r() * 24, 6, 4, '#fff7e6');
        // coqueiro em silhueta
        rect(g, 36, 70, 5, 70, '#3b2416');
        [[-22, -4], [-12, -12], [6, -12], [16, -4], [-4, -16]].forEach(([dx, dy]) => rect(g, 38 + dx, 68 + dy, 18, 5, '#1f3d22'));
        // Valter de pé, olhando o horizonte
        drawValter(g, 140, 128, 3, sprites);
        // ao longe, a silhueta da Impressora Faminta
        const bob = Math.round(Math.sin(t * 1.1) * 2);
        rect(g, 262, 100 + bob, 30, 12, '#2a1a3a');
        rect(g, 266, 96 + bob, 22, 5, '#2a1a3a');
        if (Math.floor(t * 2) % 2 === 0) rect(g, 284, 103 + bob, 3, 2, '#ff3a2a');
    }

    const DRAWERS = [drawScene1, drawScene2, drawScene3, drawScene4];

    // Desenha a cena `index` no instante `t` (segundos desde que a cena começou).
    function draw(canvas, index, t, sprites) {
        if (!canvas || !canvas.getContext) return false;
        const g = canvas.getContext('2d');
        if (!g) return false;
        g.imageSmoothingEnabled = false;
        const fn = DRAWERS[Math.max(0, Math.min(DRAWERS.length - 1, index))];
        fn(g, Math.max(0, t || 0), sprites);
        return true;
    }

    window.GameIntro = { SCENES: SCENES, WIDTH: W, HEIGHT: H, draw: draw };
})();

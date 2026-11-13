// Gerador procedural de sprites 24x24/16x16 e texturas em Pixel Art (via Canvas 2D).
(function () {
    'use strict';

    const PALETTE = {
        k: '#100b14', // contorno escuro
        w: '#f4ead8', // branco / papel / osso
        c: '#c9bda6', // cinza osso sombreado
        s: '#9ba8be', // aço / metal claro
        S: '#535e73', // aço escuro
        r: '#e24a33', // vermelho vivo
        R: '#8a221f', // vermelho escuro
        o: '#f08f3c', // laranja brasa / café quente
        y: '#f5cb5c', // ouro / post-it / brilho
        Y: '#ba8524', // ouro escuro
        b: '#b47c50', // couro / madeira / café claro
        B: '#633c20', // café escuro / madeira escura
        g: '#85db60', // goblin / excel neon
        G: '#408339', // goblin escuro
        h: '#255223', // verde sombra profunda
        p: '#b288e0', // roxo arcano / harpia
        P: '#633c91', // roxo escuro
        d: '#3e324b', // terno / tecido escuro
        D: '#241b2e', // sombra profunda
        e: '#ff4838', // olho vermelho
        a: '#69c8f0', // azul dados / rede / escudo
        A: '#2a6f9c'  // azul escuro
    };

    const SPRITE_GRIDS = {
        // Goblin Perguntador (Estagiário Perdido) - 24x24 detalhado
        goblin: [
            '........................',
            '....kk............kk....',
            '...kggk..........kggk...',
            '..kggGgk..kkkk..kgGgGk..',
            '..kggggkkkggggkkkggggk..',
            '...kkGGGGggggggGGGGkk...',
            '....kggggggggggggggk....',
            '....kggyyggggggyyggk....',
            '....kgeGggGGGGggGegk....',
            '....kgggGwwwwwwGgggk....',
            '.....kkGGwkkkkwGGkk.....',
            '.......kkGGGGGGkk.......',
            '....kkkddkrrrrkddkkk....',
            '...kdddddkrrrrkdddddk...',
            '..kggkdddkwyywkdddkggk..',
            '..kgGkdddkwwwwkdddkGgk..',
            '..kkk.kddkcccckddk.kkk..',
            '......kddddddddddk......',
            '.....kddddkddkddddk.....',
            '.....kdddk.kk.kdddk.....',
            '.....kGGk......kGGk.....',
            '....kGGhk......khGGk....',
            '....kkkk........kkkk....',
            '........................'
        ],

        // Harpia do Corredor (Colega Fofoqueiro) - 24x24 detalhado
        harpy: [
            '........................',
            '........kkkkkkkk........',
            '.......kppppppppk.......',
            '......kppPPPPPPppk......',
            '.....kppPyyPPyyPppk.....',
            '.....kpPyDDyyDDyPpk.....',
            '....kkppPPPooPPPppkk....',
            '..kkPppkddddddddkppPkk..',
            '.kPPppkdrrrrrrrrdkppPPk.',
            'kPPpk.kddrrrrrrddk.kpPPk',
            'kPpk..kddddddddddk..kpPk',
            'kpk...kddkwwwwkddk...kpk',
            '.k....kddkcccckddk....k.',
            '......kddkkkkkkddk......',
            '.....kPPkddddddkPPk.....',
            '....kPPk.kddddk.kPPk....',
            '....kpk..kdkkdk..kpk....',
            '....kk...kdkkdk...kk....',
            '.........kPk.kPk........',
            '.........kPk.kPk........',
            '........kyyk.kyyk.......',
            '.......kykYk.kYkyk......',
            '.......kkk.k.k.kkk......',
            '........................'
        ],

        // Lich das Planilhas (Gerente - Chefe Final) - 24x24 imponente
        lich: [
            '......kkkkkkkkkkkk......',
            '.....kyyYyyYYyyYyyk.....',
            '.....kYyyYyyyyYyyYk.....',
            '.....kkkkkkkkkkkkkk.....',
            '.....kwwwwwwwwwwwwk.....',
            '....kwwccwwwwwwccwwk....',
            '....kwkeekwwwwkeekwk....',
            '....kwwwwwwkkwwwwwwk....',
            '.....kkwwkwwwwkwwkk.....',
            '......kkwkwwwwkwkk......',
            '....kkDDkrrrrrrkDDkk....',
            '...kDDDDkrrrrrrkDDDDk...',
            '..kDDddDkrrYYrrkDddDDk..',
            '.kDDdkDDkggggggkDDkdDDk.',
            '.kDdk.kDkgwwwwgkDk.kdDk.',
            '.kkk..kDkgGGGGgkDk..kkk.',
            '......kDkgwggwgkDk......',
            '......kDkggggggkDk......',
            '.....kDDkkkkkkkkDDk.....',
            '.....kDDDDDDDDDDDDk.....',
            '....kDDDDkDDDDkDDDDk....',
            '....kDDDk.kDDk.kDDDk....',
            '....kkkk..kkkk..kkkk....',
            '........................'
        ],

        // Baú Corporativo / Cafeteira Arcana - 16x16
        chest: [
            '................',
            '................',
            '....kkkkkkkk....',
            '...kbbbbbbbbk...',
            '..kbyyyyyyyybk..',
            '..kBkkkkkkkkBk..',
            '..kBbyykkbyyBk..',
            '..kBbyykkbyyBk..',
            '..kBkkkkkkkkBk..',
            '..kBBBBBBBBBBk..',
            '..kBByBByBByBk..',
            '..kBBBBBBBBBBk..',
            '..kkkkkkkkkkkk..',
            '................',
            '................',
            '................'
        ],

        // Portal das 18h (Elevador da Liberdade) - 16x16
        exit: [
            '...kkkkkkkkkk...',
            '..kyyyyyyyyyyk..',
            '.kyykkkkkkkkYYk.',
            '.kykggggggggkYk.',
            '.kykgwwwwwwgkYk.',
            '.kykgwggggwgkYk.',
            '.kykgwgwwgwgkYk.',
            '.kykgwgwwgwgkYk.',
            '.kykgwggggwgkYk.',
            '.kykgwggggwgkYk.',
            '.kykgwwwwwwgkYk.',
            '.kykggggggggkYk.',
            '.kykggggggggkYk.',
            '.kykkkkkkkkkkYk.',
            '.kkkkkkkkkkkkkk.',
            '................'
        ],

        // Ícones de Cartas e Passivas - 16x16
        stapler: [
            '................',
            '................',
            '..kkkkkkkkkkkk..',
            '.kssssssssssssk.',
            '.ksSSSSSSSSSSsk.',
            '.ksskkkkkkkkssk.',
            '..kk.kwwwwk.kk..',
            '....kkkkkkk.....',
            '..kkSSSSSSSSkk..',
            '.kRRRRRRRRRRRRk.',
            '.kkkkkkkkkkkkkk.',
            '................',
            '................',
            '................',
            '................',
            '................'
        ],
        coffee: [
            '................',
            '.....o...o......',
            '....o...o.......',
            '.....o...o......',
            '...kkkkkkkkk....',
            '..kBBBBBBBBBk...',
            '..kwwwwwwwwwkkk.',
            '..kwwwwwwwwwk.wk',
            '..kwwwrrrwwwk.wk',
            '..kwwwrrrwwwkkk.',
            '..kwwwwwwwwwk...',
            '...kwwwwwwwk....',
            '..kkkkkkkkkkk...',
            '.kcccccccccccck.',
            '..kkkkkkkkkkkk..',
            '................'
        ],
        whip: [
            '................',
            '..........kkkk..',
            '........kkaaaak.',
            '.......kaakk.kak',
            '......kak...kak.',
            '.....kak...kak..',
            '....kak...kAk...',
            '...kAk..kkaak...',
            '..kAk..kak......',
            '.kAk..kAk.......',
            'kAk..kAk........',
            'kk..kAk.........',
            '...kssk.........',
            '..ksssk.........',
            '..kkkk..........',
            '................'
        ],
        shield: [
            '................',
            '..kkkkkkkkkkkk..',
            '.kssssssssssssk.',
            '.ksaaaaaaaaaaSk.',
            '.ksawwwwwwwwaSk.',
            '.ksawwwwwwwwaSk.',
            '.ksaawwrrwwaaSk.',
            '.ksawwwwwwwwaSk.',
            '..ksaaaaaaaaSk..',
            '..ksaaaaaaaaSk..',
            '...ksaaaaaaSk...',
            '....ksawwaSk....',
            '.....ksaaSk.....',
            '......kssk......',
            '.......kk.......',
            '................'
        ],
        quiet: [
            '................',
            '.....kkkkkk.....',
            '...kkddddddkk...',
            '..kddwwwwwwddk..',
            '..kdwkwwwwkwdk..',
            '..kdwwwwwwwwdk..',
            '..kddwwrrwwddk..',
            '...kkdwwwwdkk...',
            '....kddwwddk....',
            '...kddddddddk...',
            '..kddddwwddddk..',
            '..kddkddddkddk..',
            '.....kddddk.....',
            '....kdk..kdk....',
            '....kkk..kkk....',
            '................'
        ],
        cc: [
            '................',
            '..kkkkkkkkkk....',
            '.kwwwwwwwwwwk...',
            '.kwaawwwwwwakk..',
            '.kwwwwwwwwwwkwk.',
            '.kwaaawwwwwwkwk.',
            '.kwwwwwwwwwwkwk.',
            '..kkkkkkkkkkkwk.',
            '....kwyyyyyykwk.',
            '....kwyrrrrrywk.',
            '....kwyyyyyykwk.',
            '....kkkkkkkkkkk.',
            '.....oo..oo.....',
            '....oo..oo......',
            '................',
            '................'
        ],
        medical: [
            '................',
            '..kkkkkkkkkkkk..',
            '.kwwwwwwwwwwwwk.',
            '.kwwwwrrrrwwwwk.',
            '.kwwwwrrrrwwwwk.',
            '.kwwrrrrrrrrwwk.',
            '.kwwrrrrrrrrwwk.',
            '.kwwwwrrrrwwwwk.',
            '.kwwwwrrrrwwwwk.',
            '.kwwwwwwwwwwwwk.',
            '.kwwccccccccwwk.',
            '.kwwccccccccwwk.',
            '.kwwwwwwwwwwwwk.',
            '..kkkkkkkkkkkk..',
            '................',
            '................'
        ],
        headphones: [
            '................',
            '....kkkkkkkk....',
            '...kssssssssk...',
            '..ksskkkkkkssk..',
            '..ksk......ksk..',
            '.kksk......kskk.',
            'kpppk......kpppk',
            'kpPpk......kpPpk',
            'kpPpk......kpPpk',
            'kpppk......kpppk',
            '.kkkk......kkkk.',
            '................',
            '................',
            '................',
            '................',
            '................'
        ],
        espresso: [
            '................',
            '....y....y......',
            '...y....y.......',
            '..kkkkkkkkkk....',
            '.kBBBBBBBBBBk...',
            '.ksssssssssskkk.',
            '.kssyyyyyyssk.sk',
            '.kssyyyyyysskkk.',
            '.kssssssssssk...',
            '..kssssssssk....',
            '..kkkkkkkkkk....',
            '.kYYYYYYYYYYk...',
            '..kkkkkkkkkk....',
            '................',
            '................',
            '................'
        ],
        vr_boost: [
            '................',
            '................',
            '.kkkkkkkkkkkkkk.',
            'kyyyyyyyyyyyyyyk',
            'kyYYYYYYYYYYYYyk',
            'kyywwwwyyyyyyyyk',
            'kyywwwwyyYYYYyyk',
            'kyyyyyyyyyyyyyyk',
            'kyyggggggggggyyk',
            'kyyyyyyyyyyyyyyk',
            '.kkkkkkkkkkkkkk.',
            '................',
            '................',
            '................',
            '................',
            '................'
        ]
    };

    function makeCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    }

    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a |= 0;
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function renderGrid(grid, tintColor) {
        const h = grid.length;
        const w = grid[0].length;
        const c = makeCanvas(w, h);
        const g = c.getContext('2d');
        for (let y = 0; y < h; y++) {
            const row = grid[y];
            for (let x = 0; x < w; x++) {
                const ch = row[x];
                if (ch === '.') continue;
                g.fillStyle = tintColor || PALETTE[ch] || '#ff00ff';
                g.fillRect(x, y, 1, 1);
            }
        }
        return c;
    }

    function makeWallTexture(variant) {
        const size = 48;
        const c = makeCanvas(size, size);
        const g = c.getContext('2d');
        const rnd = mulberry32(2026 + (variant || 0) * 131);

        g.fillStyle = '#332942';
        g.fillRect(0, 0, size, size);

        for (let y = 32; y < size; y += 8) {
            const off = (y % 16 === 0) ? 0 : 6;
            for (let x = -off; x < size; x += 12) {
                const shade = 0.85 + rnd() * 0.3;
                g.fillStyle = 'rgb(' + ((82 * shade) | 0) + ',' + ((70 * shade) | 0) + ',' + ((98 * shade) | 0) + ')';
                g.fillRect(x + 1, y + 1, 10, 6);
                g.fillStyle = 'rgba(255,255,255,0.12)';
                g.fillRect(x + 1, y + 1, 10, 1);
                g.fillStyle = 'rgba(0,0,0,0.35)';
                g.fillRect(x + 1, y + 6, 10, 1);
            }
        }

        g.fillStyle = '#5c667d';
        g.fillRect(0, 0, size, 5);
        g.fillRect(0, 30, size, 3);
        g.fillRect(0, 0, 3, 32);
        g.fillRect(size - 3, 0, 3, 32);
        g.fillStyle = '#8b97b0';
        g.fillRect(0, 0, size, 1);
        g.fillRect(0, 30, size, 1);

        const v = (variant || 0) % 3;
        if (v === 0) {
            g.fillStyle = '#3d281b';
            g.fillRect(5, 6, size - 10, 23);
            g.fillStyle = '#5e3e29';
            g.fillRect(6, 13, size - 12, 2);
            g.fillRect(6, 21, size - 12, 2);

            const colors = ['#d8452f', '#38b6ff', '#f3c552', '#7fd15a', '#a47bd0', '#efe6d8'];
            for (const sy of [7, 15, 23]) {
                for (let sx = 7; sx < size - 9; sx += 4) {
                    if (rnd() < 0.2) continue;
                    g.fillStyle = colors[((rnd() * colors.length) | 0)];
                    const bh = 4 + ((rnd() * 2) | 0);
                    g.fillRect(sx, sy + (6 - bh), 3, bh);
                    g.fillStyle = 'rgba(0,0,0,0.28)';
                    g.fillRect(sx + 2, sy + (6 - bh), 1, bh);
                }
            }
        } else if (v === 1) {
            g.fillStyle = '#473c59';
            g.fillRect(4, 6, size - 8, 23);
            g.fillStyle = '#141722';
            g.fillRect(14, 9, 20, 14);
            g.fillStyle = '#256fa8';
            g.fillRect(16, 11, 16, 10);
            g.fillStyle = '#69e2ff';
            g.fillRect(17, 12, 10, 2);
            g.fillRect(17, 15, 13, 1);
            g.fillRect(17, 17, 8, 1);
            g.fillRect(17, 19, 11, 1);
            g.fillStyle = '#f5cb5c';
            g.fillRect(6, 10, 5, 5);
            g.fillStyle = '#e8873a';
            g.fillRect(37, 13, 5, 5);
            g.fillStyle = '#b288e0';
            g.fillRect(7, 18, 4, 4);
        } else {
            g.fillStyle = '#463b57';
            g.fillRect(4, 6, size - 8, 23);
            g.fillStyle = '#d8d0c4';
            g.fillRect(9, 8, 30, 15);
            g.fillStyle = '#232030';
            g.fillRect(10, 9, 28, 13);
            g.fillStyle = '#e24a33';
            g.fillRect(12, 12, 6, 2);
            g.fillRect(18, 14, 6, 2);
            g.fillRect(24, 16, 8, 2);
            g.fillStyle = '#7fd15a';
            g.fillRect(12, 18, 10, 2);
        }

        return c;
    }

    // Piso em ladrilhos de pedra escura + tapete gótico carmesim com friso dourado
    function makeFloorTexture() {
        const size = 48;
        const c = makeCanvas(size, size);
        const g = c.getContext('2d');
        const rnd = mulberry32(4242);

        g.fillStyle = '#2a2236';
        g.fillRect(0, 0, size, size);

        for (let qy = 0; qy < 2; qy++) {
            for (let qx = 0; qx < 2; qx++) {
                const alt = (qx + qy) % 2 === 0;
                g.fillStyle = alt ? '#3f3450' : '#342a44';
                g.fillRect(qx * 24 + 2, qy * 24 + 2, 20, 20);
                g.fillStyle = 'rgba(255,255,255,0.08)';
                g.fillRect(qx * 24 + 2, qy * 24 + 2, 20, 1);
            }
        }

        // Centro de tapete gótico vinho com borda dourada
        g.fillStyle = '#631d28';
        g.fillRect(10, 0, 28, size);
        g.fillStyle = '#7d2634';
        g.fillRect(14, 0, 20, size);
        g.fillStyle = '#ba8524';
        g.fillRect(10, 0, 2, size);
        g.fillRect(36, 0, 2, size);

        // Junta do grid
        g.fillStyle = '#181221';
        g.fillRect(0, 0, size, 2);
        g.fillRect(0, 0, 2, size);

        for (let i = 0; i < 40; i++) {
            g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.07)';
            g.fillRect(((rnd() * 44) | 0) + 2, ((rnd() * 44) | 0) + 2, 1, 1);
        }
        return c;
    }

    function makeCeilingTexture() {
        const size = 48;
        const c = makeCanvas(size, size);
        const g = c.getContext('2d');
        g.fillStyle = '#1a1424';
        g.fillRect(0, 0, size, size);
        g.fillStyle = '#282036';
        g.fillRect(3, 3, size - 6, size - 6);
        g.fillStyle = '#3d334d';
        g.fillRect(0, 0, size, 3);
        g.fillRect(0, 0, 3, size);
        g.fillStyle = '#474f66';
        g.fillRect(10, 18, 28, 12);
        g.fillStyle = '#97b4db';
        g.fillRect(13, 21, 22, 6);
        g.fillStyle = '#d2ecff';
        g.fillRect(15, 23, 18, 2);
        return c;
    }

    function makeTorchCanvas(variant) {
        const c = makeCanvas(8, 12);
        const g = c.getContext('2d');
        const h = 7 + (variant % 3);
        g.fillStyle = '#e24a33';
        g.fillRect(2, 12 - h, 4, h);
        g.fillRect(1, 12 - h + 3, 6, h - 4);
        g.fillStyle = '#f08f3c';
        g.fillRect(2, 12 - h + 2, 4, h - 2);
        g.fillRect(3 - (variant % 2), 12 - h - 1, 2, 3);
        g.fillStyle = '#fff099';
        g.fillRect(3, 12 - h + 4, 2, h - 4);
        return c;
    }

    const sheets = {};
    const iconUrls = {};

    function init() {
        for (const key of Object.keys(SPRITE_GRIDS)) {
            const grid = SPRITE_GRIDS[key];
            sheets[key] = {
                normal: renderGrid(grid),
                white: renderGrid(grid, '#ffffff'),
                red: renderGrid(grid, '#ff3a2a')
            };

            const iconCanvas = makeCanvas(48, 48);
            const ig = iconCanvas.getContext('2d');
            ig.imageSmoothingEnabled = false;
            ig.drawImage(sheets[key].normal, 0, 0, 48, 48);
            iconUrls[key] = iconCanvas.toDataURL('image/png');
        }
    }

    init();

    window.GameSprites = {
        getSheet: function (name) {
            return sheets[name] || sheets.goblin;
        },
        getIconUrl: function (name) {
            return iconUrls[name] || iconUrls.stapler;
        },
        makeWallTexture: makeWallTexture,
        makeFloorTexture: makeFloorTexture,
        makeCeilingTexture: makeCeilingTexture,
        makeTorchCanvas: makeTorchCanvas
    };
})();

// Arte em pixel do protótipo. Cada sprite é uma grade de 16x16 caracteres; cada caractere
// é uma cor da paleta abaixo ('.' é transparente). Para trocar a arte, basta editar este arquivo.
(function () {
    'use strict';

    const palette = {
        k: '#17101a', // contorno
        w: '#f4ead8', // osso / branco
        c: '#c9bda6', // osso sombreado
        g: '#aab3bf', // aço claro
        G: '#636c7a', // aço escuro
        r: '#c8402f', // vermelho
        R: '#7f2420', // vermelho escuro
        o: '#e8873a', // brasa
        y: '#f3c552', // ouro
        Y: '#b98a2e', // ouro escuro
        b: '#a8744b', // couro / madeira clara
        B: '#6a4429', // madeira escura
        n: '#9dbb72', // carniçal claro
        N: '#5c7a45', // carniçal escuro
        p: '#a47bd0', // roxo claro
        P: '#5e3d86', // roxo escuro
        d: '#3d3040', // tecido escuro
        D: '#2a2130', // tecido mais escuro
        e: '#ff5846'  // olho brilhante
    };

    const sprites = {
        // Protagonista visto de costas: ele sempre avança, nunca recua.
        player: [
            '................',
            '.....kkkkkk.....',
            '....kgggggGk....',
            '...kgggggGGGk...',
            '...kggggGGGGk.k.',
            '...kGggGGGGGkkwk',
            '....kGGGGGGk.kwk',
            '...kkkkkkkkkkkwk',
            '..krrrrrrrrRkgwk',
            '..krrrrrrrRRkkyk',
            '..krrrrrrRRRk.k.',
            '..kRrrrrRRRRk...',
            '..kRRrrRRRRRk...',
            '...kRRRRRRRk....',
            '...kGGk.kGGk....',
            '...kkkk.kkkk....'
        ],

        // Carniçal
        C: [
            '................',
            '....kkkkkkk.....',
            '...knnnnnnnk....',
            '...knennnenk....',
            '...knnnnnnnk....',
            '...kNwkwkwNk....',
            '....kNNNNNk.....',
            '..kkknnnnnkkk...',
            '.knnkNnnnNknnk..',
            '.knNkNnnnNkNnk..',
            '.knk.kNNNk.knk..',
            '.knk.kNnNk.knk..',
            '.kwk.kNkNk.kwk..',
            '.kk.kNNkNNk.kk..',
            '....kNk.kNk.....',
            '....kkk.kkk.....'
        ],

        // Arqueiro de Ossos
        A: [
            '................',
            '....kkkkkk......',
            '...kddddddk..k..',
            '..kddwwwwddkkbk.',
            '..kdwkwwkwdkb.k.',
            '..kdwwwwwwdkb.k.',
            '...kwkwwkwkkb.k.',
            '...kkwwwwkk.b.k.',
            '..kddkddkddkb.k.',
            '.kdckddddkcwb.k.',
            '.kckkddddkkkb.k.',
            '.kk.kddddk.kb.k.',
            '....kdkkdk.kb.k.',
            '....kck.kck.kbk.',
            '....kck.kck..k..',
            '....kkk.kkk.....'
        ],

        // Sineiro
        S: [
            '................',
            '....kkkkkk......',
            '...kppppppk.....',
            '..kppDDDDppk....',
            '..kpDyDDyDpk....',
            '..kpDDDDDDpk....',
            '..kkppDDppkk.k..',
            '.kpppppppppkkyk.',
            '.kpPkppppkPkyyYk',
            '.kpk.kppk.kyyyYk',
            '.kpk.kppkkyyyyYk',
            '.kkk.kppkkyyyYYk',
            '....kpppPkkkokk.',
            '...kppppPPk.k...',
            '...kPPPPPPk.....',
            '...kkkkkkkk.....'
        ],

        // Ícones das cartas
        Golpe: [
            '................',
            '............kk..',
            '...........kwwk.',
            '..........kwwgk.',
            '.........kwwgk..',
            '........kwwgk...',
            '.......kwwgk....',
            '..kk..kwwgk.....',
            '..kyk.wwgk......',
            '...kykwgk.......',
            '....kyyk........',
            '...kbkyyk.......',
            '..kbBk.kyk......',
            '.kbBk...kk......',
            '.kkk............',
            '................'
        ],
        Aparar: [
            '................',
            '..kkkkkkkkkkkk..',
            '..kggggggGGGGk..',
            '..kgrrrrrRRRGk..',
            '..kgrrryrRRRGk..',
            '..kgrryyyRRRGk..',
            '..kgryyyyyRRGk..',
            '..kgrryyyRRRGk..',
            '..kgrrryrRRRGk..',
            '...kgrrrRRRGk...',
            '...kgrrrRRRGk...',
            '....kgrrRRGk....',
            '.....kgrRGk.....',
            '......kgGk......',
            '.......kk.......',
            '................'
        ],
        Estocada: [
            '.......kk.......',
            '......kwwk......',
            '......kwgk......',
            '.....kwwggk.....',
            '.....kwwggk.....',
            '.....kwwggk.....',
            '......kwgk......',
            '.....kyyyyk.....',
            '......kbBk......',
            '......kbBk......',
            '......kbBk......',
            '......kbBk......',
            '......kbBk......',
            '......kbBk......',
            '......kbBk......',
            '......kkkk......'
        ],
        Varredura: [
            '................',
            '................',
            '....kkkkkkkk....',
            '..kkwwwwwwwwkk..',
            '.kwwwyyyyyywwwk.',
            'kwwyykkkkkkyywwk',
            'kwykk......kkywk',
            'kyk..........kyk',
            'kk.....kk.....kk',
            '......kgGk......',
            '......kgGk......',
            '......kgGk......',
            '.....kyyyyk.....',
            '......kbBk......',
            '......kkkk......',
            '................'
        ],
        GolpePesado: [
            '................',
            '..kkkkkkkkkkk...',
            '.kgggggggggGGk..',
            '.kgggggggggGGk..',
            '.kgGGGGGGGGGGk..',
            '.kGGGGGGGGGGGk..',
            '..kkkkkbBkkkk...',
            '......kbBk......',
            '......kbBk......',
            '......kbBk......',
            '......kbBk......',
            '......kbBk......',
            '......kbBk......',
            '......kyYk......',
            '......kkkk......',
            '................'
        ],
        PassoSombrio: [
            '................',
            '......kkkk......',
            '......kddk......',
            '......kddk......',
            '..p...kddk......',
            '.p....kddk......',
            '..p...kdddk.....',
            '.p....kddddkk...',
            '..p...kdddddPk..',
            '.p....kddddPPPk.',
            '..p..kkkkkkkkkk.',
            '.p...kPPPPPPPPk.',
            '.....kkkkkkkkkk.',
            '................',
            '................',
            '................'
        ],
        Guardar: [
            '................',
            '....kkkkkkkk....',
            '...kggggGGGGk...',
            '...kgggGGGGGk...',
            '...kggkkkkGGk...',
            '...kggk..kGGk...',
            '..kkkkkkkkkkkk..',
            '..kyyyyyyyYYYk..',
            '..kyyyykkyYYYk..',
            '..kyyyykkyYYYk..',
            '..kyyyyykYYYYk..',
            '..kyyyyyyYYYYk..',
            '..kkkkkkkkkkkk..',
            '................',
            '................',
            '................'
        ],
        Recompor: [
            '................',
            '..kkkkkkkk......',
            '..kwwwwwwkkk....',
            '..kwcccwwkwkkk..',
            '..kwwwwwwkwkwk..',
            '..kwcccwwkwkwk..',
            '..kwwwwwwkwkwk..',
            '..kwcccwwkwkwk..',
            '..kwwwwwwkwkwk..',
            '..kwwwwwwkwkwk..',
            '..kkkkkkkkwkwk..',
            '....kkkkkkkkwk..',
            '......kkkkkkkk..',
            '................',
            '................',
            '................'
        ]
    };

    window.hellsCastleArt = { palette: palette, sprites: sprites };
})();

// Gerador procedural de sprites (32x32, 24x24, 16x16) e texturas dos biomas em Pixel Art (via Canvas 2D).
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
        A: '#2a6f9c', // azul escuro
        f: '#f2c199', // pele clara
        F: '#c48a62', // pele sombra
        m: '#6ae0a8', // menta slime / led
        t: '#3aa88b', // turquesa copa
        u: '#f078b8'  // magenta arte
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

        // Lich das Planilhas (Gerente - Chefe Andar 1) - 24x24 imponente
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

        // Limo da Geladeira (Marmita de 2024) - 24x24
        slime: [
            '........................',
            '.......kkkkkkkkkk.......',
            '......kaaaaaaaaaak......',
            '.....kwwwwwwwwwwwwk.....',
            '....kAAkkkkkkkkkkAAk....',
            '....kkmmmmmmmmmmmmkk....',
            '...kmmmmggggggggmmmmk...',
            '..kmmmgggmmmmmmgggmmmk..',
            '..kmmgmmggggggggmmgmmk..',
            '.kmmgggkeeekkeekggmmmk..',
            '.kmmgggkewkkkeekggmmmk..',
            '.kmmggggkkkkkkkkggmmmk..',
            '.kmmgGGGGmmmmmmGGGGmmk..',
            '..kmGGGGGGGGGGGGGGGGmk..',
            '..kmmGmmGrrrrrrGmmGmmk..',
            '.kmmgGGGGGGGGGGGGGGgmmk.',
            '.kmGGhGGGGhhhhGGGGhGGmk.',
            '.kmGhhhGGhmmmmhGGhhhGmk.',
            '.kGGhhhhhhhhhhhhhhhhGGk.',
            '..kGGhhGGhGGGGhGGhhGGk..',
            '...kGGGGh......hGGGGk...',
            '....kkkk........kkkk....',
            '........................',
            '........................'
        ],

        // Cultista do Mindset (Coach Corporativo) - 24x24
        cultist: [
            '........................',
            '........kkkkkkkk........',
            '......kkPPPPPPPPkk......',
            '.....kPPppppppppPPk.....',
            '....kPPpDDDDDDDDpPPk....',
            '....kPpDDDDDDDDDDpPk....',
            '...kaakDDyyDDyyDDpPk....',
            '...kaakDDeeDDeeDDpPk....',
            '...kaaSDDDDDDDDDDpPk....',
            '....kSDDDwwwwwwDDPPk....',
            '.....kDDDwkkkkwDDPk.....',
            '....kkPPPDDDDDDPPPkk....',
            '...kPPPPdkYYYYkdPPPPk...',
            '..kPPppPdkrrrrkdPppPPk..',
            '..kPpPpkdkrrrrkdkpPpPk..',
            '.kffkpk.kddYYddk.kpkffk.',
            '.kFFk...kddddddk...kFFk.',
            '..kk....kPPddPPk....kk..',
            '.......kPPPPPPPPk.......',
            '......kPPPkkkkPPPk......',
            '......kPPk....kPPk......',
            '......kDDk....kDDk......',
            '......kkkk....kkkk......',
            '........................'
        ],

        // Górgona da Bandeja 2 (Impressora Possuída) - 24x24
        gorgon: [
            '........................',
            '......kk........kk......',
            '.....kwwk......kwwk.....',
            '....kwwwwkkkkkkwwwwk....',
            '....kwccksssssskccwk....',
            '...kkssskSSSSSSkssskk...',
            '..ksssssSSSSSSSSsssssk..',
            '..ksDDDDSSSSSSSSDDDDsk..',
            '..ksDeekSSSSSSSSkeedsk..',
            '..ksDDDDkrrrrrrkDDDDsk..',
            '..kssssskwwwwwwksssssk..',
            '..ksssskwwkkkkwwkssssk..',
            '..kSSSSskwwwwwwksSSSSk..',
            '.kkSSSSkkkkkkkkkkSSSSkk.',
            '.kwkSSksssssssssskSSkwk.',
            'kwwkSSksaaaaaaaaaskSSkww',
            'kwckkkksaaDDDDaaskkkkckw',
            'kcck...ksDDDDDDsk...kcck',
            '.kk.....kSSSSSSk.....kk.',
            '.......kSSk..kSSk.......',
            '......kSSk....kSSk......',
            '.....kwkk......kkwk.....',
            '.....kkk........kkk.....',
            '........................'
        ],

        // Dona Carmem do RH (Inquisidora do Feedback - Chefe Andar 2) - 24x24
        carmem: [
            '.......kkkkkkkkkk.......',
            '......kDDDDDDDDDDk......',
            '.....kDDddddddddDDk.....',
            '....kDDddddddkkddDDk....',
            '....kDdkffffffffkdDk....',
            '...kkaakfkkffkkfkaakk...',
            '...kwwakfeefkfeefkawwk..',
            '....kkfkffffffffkfkk....',
            '.....kffkrrrrrrkffk.....',
            '......kffkkkkkkffk......',
            '.....kkRRRRddRRRRkk.....',
            '....kRRRRRdyyydRRRRRk...',
            '...kRRrrRddyyyyddRrrRk..',
            '..kRRrkRRdwwwwwwdRRkrRk.',
            '.kffk.kRRdwbbbbwdRRk.kfk',
            '..kk..kRRdwbyybwdRRk..kk',
            '......kRRdwwwwwwdRRk....',
            '.....kRRRddddddddRRRk...',
            '.....kRRRkkkkkkkkRRRk...',
            '....kRRRRkDDDDDDkRRRRk..',
            '....kRRRRk......kRRRRk..',
            '....kDDDDk......kDDDDk..',
            '....kkkkkk......kkkkkk..',
            '........................'
        ],

        // Lorde Valdemar, O CEO (Chefe Final Andar 3) - 24x24
        valdemar: [
            '....kk..kkkkkkkk..kk....',
            '...kyykkYYYYYYYYkkyyk...',
            '...kYyyyyyyyyyyyyyyYk...',
            '....kkkkkkkkkkkkkkkk....',
            '.....kDDDDDDDDDDDDk.....',
            '....kDDkffffffffkDDk....',
            '....kDkfccffffccfkDk....',
            '....kDkfekffffkefkDk....',
            '....kDkffffkkffffkDk....',
            '.....kkffkwwwwkffkk.....',
            '..kkkRRkkDDDDDDkkRRkkk..',
            '.kRRRRRkDDrrrrDDkRRRRRk.',
            '.kRRRddkDDryyrDDkddRRRk.',
            'kRRrkDDkDDryyrDDkDDkrRRk',
            'kRrk.kDkDDDDDDDDkDk.krRk',
            'kkk..kDkdYYYYYYdkDk..kkk',
            '.....kDkddddddddkDk.....',
            '....kRRkddddddddkRRk....',
            '....kRRkdddkkdddkRRk....',
            '...kRRRkddk..kddkRRRk...',
            '...kDDkkDDk..kDDkkDDk...',
            '...kkkkDDk....kDDkkkk...',
            '......kkkk....kkkk......',
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
        ],

        // Máquina de Café da Copa (Loja) - 16x16
        vending: [
            '..kkkkkkkkkkkk..',
            '.kyyyyyyyyyyyyk.',
            '.kyGGGGGGGGGGyk.',
            '.kyGkkkkkkkkGyk.',
            '.kyGkBBBBBBkGyk.',
            '.kyGkBoooookGyk.',
            '.kyGkaaaaaakGyk.',
            '.kyGkkkkkkkkGyk.',
            '.kyGGGGyyGGGGyk.',
            '.kyGkDDDDDDkGyk.',
            '.kyGkDwwwwDkGyk.',
            '.kyGkDBBBBDkGyk.',
            '.kyGkkkkkkkkGyk.',
            '.kyGGGGGGGGGGyk.',
            '.kkkkkkkkkkkkkk.',
            '..kkk......kkk..'
        ],

        // Evento Aleatório do Corredor (?) - 16x16
        event_q: [
            '................',
            '....kkkkkkkk....',
            '...kPPPPPPPPk...',
            '..kPPyyyyyyPPk..',
            '..kPykPPPPkyPk..',
            '..kPykPPPPkyPk..',
            '..kPPPkkPPkyPk..',
            '..kPPPPkyykPPk..',
            '..kPPPPkykPPPk..',
            '..kPPPPkykPPPk..',
            '..kPPPPPPPPPPk..',
            '..kPPPPkykPPPk..',
            '..kPPPPPPPPPPk..',
            '...kPPPPPPPPk...',
            '....kkkkkkkk....',
            '................'
        ],

        // Aliado: Seu Jorge do TI - 16x16
        ally_jorge: [
            '....kkkkkkkk....',
            '...kssssssssk...',
            '..kssffffffssk..',
            '..kffkakkfakfk..',
            '..kffffffffffk..',
            '...kffkccckffk..',
            '...kffcccccffk..',
            '..kkttttttttkk..',
            '.kttttaaaattttk.',
            '.ktttawwwwattkk.',
            '.kttttawwaattkk.',
            '.kttttttttttttk.',
            '..kkttttttttkk..',
            '...kDDk..kDDk...',
            '...kkkk..kkkk...',
            '................'
        ],

        // Aliada: Vivi da Arte - 16x16
        ally_vivi: [
            '...kkkkkkkkkk...',
            '..kuuuuuuuuuuk..',
            '.kuukffffffkuuk.',
            '.kuukfkkfkfkuuk.',
            '.kukffffffffkuk.',
            '..kkfffrrfffkk..',
            '...kkffffffkk...',
            '..kkppppppppkk..',
            '.kppyyppppyuppk.',
            '.kppyyyyyyuuppk.',
            '.kppppppppppppk.',
            '..kkppppppppkk..',
            '...kDDk..kDDk...',
            '...kkkk..kkkk...',
            '................',
            '................'
        ],

        // Aliada: Cláudia do Financeiro - 16x16
        ally_claudia: [
            '....kkkkkkkk....',
            '...kBBBBBBBBk...',
            '..kBBffffffBBk..',
            '..kBfkaakfakBk..',
            '..kBffffffffBk..',
            '...kfffrrfffk...',
            '..kkDDDDDDDDkk..',
            '.kDDDDyyyyDDDDk.',
            '.kDDDywwwwyDDDk.',
            '.kDDDywggwyDDDk.',
            '.kDDDDyyyyDDDDk.',
            '.kDDDDDDDDDDDDk.',
            '..kkDDk..kDDkk..',
            '...kkkk..kkkk...',
            '................',
            '................'
        ],

        // Relíquia: Garrafa Térmica - 16x16
        thermos: [
            '.....kkkkkk.....',
            '....kssssssk....',
            '....kSSSSSSk....',
            '.....kkkkkk.....',
            '....krrrrrrk....',
            '...krrroorrrk...',
            '...krrroorrrk...',
            '...krrroorrrk...',
            '...krrryyrrrk...',
            '...krrryyrrrk...',
            '...krrrrrrrrk...',
            '...kRRRRRRRRk...',
            '...kRRRRRRRRk...',
            '....kkkkkkkk....',
            '................',
            '................'
        ],

        // Relíquia: Caixa de Grampos - 16x16
        staple_box: [
            '................',
            '..kkkkkkkkkkkk..',
            '.kssssssssssssk.',
            '.kswyyssssssSsk.',
            '.ksyyyyyssssSsk.',
            '.kkkkkkkkkkkkkk.',
            '.kssssssssssssk.',
            '.ksSkSkSkSkSkSk.',
            '.ksSkSkSkSkSkSk.',
            '.ksSSSSSSSSSSsk.',
            '.kssssssssssssk.',
            '.kkkkkkkkkkkkkk.',
            '................',
            '................',
            '................',
            '................'
        ],

        // Relíquia: Cópia Oculta CCO - 16x16
        cco_shield: [
            '..kkkkkkkkkkkk..',
            '.kyyyyyyyyyyyyk.',
            '.kyksssssssskyk.',
            '.kyksawwwwaskyk.',
            '.kyksaakkkaskyk.',
            '.kyksaaaaaaaskyk',
            '.kyksaaeeaaaskyk',
            '.kykssaaaasskyk.',
            '..kyksssssskyk..',
            '...kyksssskyk...',
            '....kyksskyk....',
            '.....kykkyk.....',
            '......kyyk......',
            '.......kk.......',
            '................',
            '................'
        ],

        // Carta Evoluída: Vulcão de Expresso - 16x16
        vulcao: [
            '.....o..y..o....',
            '....r.oo.yy.r...',
            '...rrrooyyoor...',
            '....kkoyyokk....',
            '...kRRRRRRRRk...',
            '..kRRRRooRRRRk..',
            '..kRRRyyyyRRRk..',
            '.kRRRRyooyRRRRk.',
            '.kRRRooooooRRRk.',
            '.kRRRRRRRRRRRRk.',
            '.kDDDDDDDDDDDDk.',
            '..kkkkkkkkkkkk..',
            '................',
            '................',
            '................',
            '................'
        ],

        // Carta Evoluída: Mandíbula de Ferro - 16x16
        mandibula: [
            '.kkkkkkkkkkkkkk.',
            'kyyyyyyyyyyyyyyk',
            'kyssssssssssssyk',
            'kyswwkkkkkkwwsyk',
            '.kk..k.kk.k..kk.',
            '.....kw..wk.....',
            '.....k....k.....',
            '.....kw..wk.....',
            '.kk..k.kk.k..kk.',
            'kyswwkkkkkkwwsyk',
            'kyRRRRRRRRRRRRyk',
            'kyyyyyyyyyyyyyyk',
            '.kkkkkkkkkkkkkk.',
            '................',
            '................',
            '................'
        ],

        // Carta Evoluída: Muralha Jurídica - 16x16
        muralha: [
            '..kk..kkkk..kk..',
            '.kyykkyyyykyyk..',
            '.kyyyyyyyyyyyyk.',
            '.kBBBByyyyBBBBk.',
            '.kBssBysysBssBk.',
            '.kBssByssyBssBk.',
            '.kBssByssyBssBk.',
            '.kBssByssyBssBk.',
            '.kBBBByyyyBBBBk.',
            '.kBBBBBBBBBBBBk.',
            '.kBBBBkkkkBBBBk.',
            '.kBBBBk..kBBBBk.',
            '.kkkkkk..kkkkkk.',
            '................',
            '................',
            '................'
        ],

        // Carta Maldição: Ata de Reunião - 16x16
        ata: [
            '................',
            '..kkkkkkkkkkk...',
            '.kccccccccckk...',
            '.kcDDDDDDcckwk..',
            '.kccccccccckwk..',
            '.kcDDDDDDcckwk..',
            '.kccccccccckwk..',
            '.kcDDDDDDcckwk..',
            '.kcccccccrckwk..',
            '.kccccccrrckwk..',
            '.kccccccccckwk..',
            '..kkkkkkkkkkwk..',
            '...kkkkkkkkkkk..',
            '................',
            '................',
            '................'
        ],

        // Protagonista: Valter Motta (Analista / Sir Valter) - 16x16
        hero_valter: [
            '....kkkkkkkk....',
            '...kDDDDDDDDk...',
            '..kDDffffffDDk..',
            '..kDffkffkffDk..',
            '..kffffffffffk..',
            '...kfffFFfffk...',
            '...kkffffffkk...',
            '..kddddwwddddk..',
            '.kddddwrwdddddk.',
            '.kddddwrwddssdk.',
            '.kddddwrwddssdk.',
            '.kdddddddddddk..',
            '..kkddddddddkk..',
            '...kDDk..kDDk...',
            '...kkkk..kkkk...',
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
                if (!ch || ch === '.') continue;
                g.fillStyle = tintColor || PALETTE[ch] || '#ff00ff';
                g.fillRect(x, y, 1, 1);
            }
        }
        return c;
    }

    // =====================================================================================
    // PINTOR PROCEDURAL (campanha dos 5 biomas): sprites 32x32 / ícones 16x16 descritos por
    // operações simples, espelhados no eixo vertical e com contorno automático.
    //   ['e', cx, cy, rx, ry, cor]  elipse      ['r', x, y, w, h, cor]  retângulo
    //   ['l', x0, y0, x1, y1, cor, espessura]   linha       ['p', x, y, cor]  pixel
    // Prefixo '!' = não espelhar. Cor '.' apaga.
    // =====================================================================================
    Object.assign(PALETTE, {
        i: '#22386b', I: '#121d3d', n: '#e6f6ff', N: '#9fd0ee', v: '#4f8dc2', q: '#3fb3b8',
        z: '#8b909e', Z: '#4d5261', x: '#5f9440', l: '#9fe8ff', j: '#a3542a', T: '#e0603c',
        V: '#3d2c73', W: '#ffffff', O: '#d1a13c', H: '#7d5c1f', M: '#ec6bff'
    });

    function paintSprite(size, ops) {
        const buf = [];
        for (let y = 0; y < size; y++) buf.push(new Array(size).fill('.'));
        const put = (x, y, c) => {
            x = Math.round(x);
            y = Math.round(y);
            if (x >= 0 && x < size && y >= 0 && y < size) buf[y][x] = c;
        };
        const rect = (x, y, w, h, c) => {
            for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, c);
        };
        const ellipse = (cx, cy, rx, ry, c) => {
            for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) {
                for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
                    const dx = (xx + 0.5 - cx) / rx;
                    const dy = (yy + 0.5 - cy) / ry;
                    if (dx * dx + dy * dy <= 1) put(xx, yy, c);
                }
            }
        };
        const line = (x0, y0, x1, y1, c, th) => {
            const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
            for (let i = 0; i <= steps; i++) {
                rect(Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps), th, th, c);
            }
        };
        ops.forEach(op => {
            const noMirror = op[0][0] === '!';
            const t = op[0].replace('!', '');
            if (t === 'e') {
                ellipse(op[1], op[2], op[3], op[4], op[5]);
                if (!noMirror) ellipse(size - op[1], op[2], op[3], op[4], op[5]);
            } else if (t === 'r') {
                rect(op[1], op[2], op[3], op[4], op[5]);
                if (!noMirror) rect(size - op[1] - op[3], op[2], op[3], op[4], op[5]);
            } else if (t === 'l') {
                const th = op[6] || 1;
                line(op[1], op[2], op[3], op[4], op[5], th);
                if (!noMirror) line(size - th - op[1], op[2], size - th - op[3], op[4], op[5], th);
            } else if (t === 'p') {
                put(op[1], op[2], op[3]);
                if (!noMirror) put(size - 1 - op[1], op[2], op[3]);
            }
        });
        // contorno automático
        const out = buf.map(row => row.slice());
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (buf[y][x] !== '.') continue;
                const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(d => {
                    const r = buf[y + d[1]];
                    const c = r ? r[x + d[0]] : undefined;
                    return c !== undefined && c !== '.';
                });
                if (near) out[y][x] = 'k';
            }
        }
        return out.map(row => row.join(''));
    }

    const PAINTED_32 = {
        // ---------------- Fase 1: Praia ----------------
        crab: [
            ['l', 7, 24, 3, 29, 'R', 2], ['l', 9, 26, 7, 30, 'R', 2], ['l', 12, 27, 11, 30, 'R', 2],
            ['l', 8, 18, 5, 11, 'T', 3], ['e', 5.5, 6.5, 4, 5, 'T'], ['r', 5, 2, 1, 5, '.'], ['r', 3, 8, 2, 3, 'R'],
            ['r', 12, 11, 2, 6, 'T'], ['r', 11, 8, 4, 4, 'w'], ['r', 13, 9, 1, 2, 'k'],
            ['e', 16, 21, 10, 6, 'T'], ['e', 16, 24, 8, 3, 'R'], ['r', 12, 22, 8, 1, 'k'],
            ['r', 15, 17, 2, 3, 'i'], ['p', 10, 20, 'i'], ['!r', 19, 18, 2, 2, 'i']
        ],
        gull: [
            ['e', 6.5, 12, 6, 3.5, 'c'], ['e', 4, 10, 3, 2.5, 'd'], ['l', 11, 14, 8, 13, 'w', 3],
            ['r', 14, 26, 4, 2, 'd'],
            ['e', 16, 20, 5.5, 7, 'w'], ['e', 16, 23, 4, 4, 'c'],
            ['e', 16, 9, 4.5, 4.5, 'w'], ['r', 12, 7, 8, 3, 'd'], ['r', 13, 8, 2, 1, 'e'],
            ['r', 15, 11, 2, 3, 'o'], ['r', 15, 13, 2, 1, 'Y'],
            ['r', 13, 27, 1, 3, 'o'], ['r', 11, 30, 4, 1, 'o'],
            ['!r', 20, 15, 5, 6, 'w'], ['!r', 21, 17, 3, 1, 'c'], ['!r', 21, 19, 3, 1, 'c']
        ],
        specter: [
            ['e', 6, 17, 3.5, 2.5, 'q'], ['r', 3, 18, 2, 3, 'q'],
            ['e', 16, 9, 7.5, 8, 'q'], ['r', 9, 9, 14, 15, 'q'],
            ['r', 9, 24, 3, 7, 'q'], ['r', 13, 24, 2, 5, 'q'], ['r', 15, 24, 2, 7, 'q'],
            ['e', 12.5, 6, 2.5, 3, 'm'], ['r', 9, 21, 14, 2, 't'],
            ['r', 11, 9, 3, 4, 'D'], ['p', 12, 10, 'a'], ['r', 15, 15, 2, 4, 'D'],
            ['r', 9, 30, 3, 1, 'w'], ['r', 15, 30, 2, 1, 'w']
        ],
        // ---------------- Fase 2: Cidade Gótica ----------------
        hunter: [
            ['r', 12, 1, 8, 3, 'D'], ['r', 7, 4, 18, 2, 'D'], ['r', 6, 3, 2, 1, 'D'],
            ['r', 12, 6, 8, 5, 'f'], ['r', 12, 9, 8, 3, 'd'], ['r', 13, 7, 2, 1, 'e'], ['r', 13, 12, 6, 2, 'R'],
            ['r', 6, 14, 4, 9, 'd'], ['r', 6, 23, 3, 2, 'f'],
            ['r', 10, 14, 12, 10, 'd'], ['r', 15, 14, 2, 10, 'D'], ['p', 14, 16, 'y'], ['p', 14, 19, 'y'],
            ['r', 8, 22, 16, 5, 'd'], ['r', 8, 26, 16, 1, 'D'],
            ['r', 11, 27, 4, 3, 'D'], ['r', 10, 30, 5, 1, 'B'],
            ['!r', 3, 6, 2, 17, 's'], ['!p', 2, 8, 's'], ['!p', 2, 11, 's'], ['!p', 2, 14, 's'], ['!p', 2, 17, 's'], ['!r', 3, 22, 2, 4, 'B']
        ],
        crow: [
            ['e', 8, 17, 4.5, 8, 'd'], ['r', 4, 22, 3, 4, 'D'],
            ['e', 16, 19, 6.5, 8, 'D'], ['e', 16, 20, 3.5, 5, 'd'],
            ['r', 15, 1, 2, 2, 'D'], ['e', 16, 8, 5.5, 5.5, 'D'], ['r', 12, 6, 2, 2, 'e'],
            ['r', 15, 9, 2, 5, 'y'], ['r', 15, 13, 2, 1, 'Y'],
            ['r', 14, 20, 4, 1, 'H'], ['r', 13, 21, 6, 4, 'O'], ['r', 12, 25, 8, 1, 'O'], ['r', 15, 26, 2, 1, 'H'], ['!p', 14, 22, 'y'],
            ['r', 12, 27, 2, 3, 'Y'], ['r', 10, 30, 5, 1, 'Y']
        ],
        herald: [
            ['e', 8, 17, 3, 3.5, 'p'], ['r', 7, 20, 2, 2, 'f'],
            ['e', 16, 7, 6.5, 6.5, 'P'], ['e', 16, 8, 4, 4.5, 'D'], ['r', 13, 7, 2, 2, 'l'],
            ['r', 11, 13, 10, 6, 'P'], ['r', 9, 19, 14, 6, 'P'], ['r', 7, 25, 18, 6, 'P'], ['r', 7, 30, 18, 1, 'p'],
            ['r', 15, 13, 2, 18, 'y'], ['r', 11, 18, 10, 1, 'Y'],
            ['!r', 4, 7, 1, 24, 'b'], ['!r', 2, 2, 5, 5, 'S'], ['!r', 3, 3, 3, 3, 'l']
        ],
        // ---------------- Fase 3: Pico Nevado ----------------
        wolf: [
            ['!e', 25, 25, 3, 4, 'n'],
            ['r', 9, 2, 3, 5, 'n'], ['r', 10, 1, 2, 1, 'n'], ['r', 10, 3, 1, 3, 'u'],
            ['e', 16, 22, 8, 8, 'N'], ['e', 16, 22, 4.5, 7, 'n'],
            ['r', 10, 24, 4, 7, 'n'], ['r', 9, 30, 5, 1, 'w'],
            ['e', 16, 10, 7, 6, 'n'], ['r', 8, 11, 2, 3, 'n'],
            ['r', 11, 8, 3, 2, 'a'], ['p', 12, 8, 'k'],
            ['e', 16, 13, 3.5, 3.5, 'w'], ['r', 15, 11, 2, 2, 'k'], ['r', 14, 15, 4, 1, 'k'], ['p', 14, 16, 'w']
        ],
        serpent: [
            ['e', 16, 25.5, 11, 5.5, 'v'], ['e', 16, 24, 8, 3, 'N'], ['r', 11, 23, 10, 1, 'n'],
            ['r', 5, 18, 2, 5, 'n'], ['p', 5, 17, 'n'], ['r', 8, 20, 1, 3, 'a'],
            ['e', 16, 8, 8, 6.5, 'N'], ['r', 9, 7, 2, 3, 'v'],
            ['r', 13, 12, 6, 9, 'N'], ['r', 14, 13, 4, 1, 'n'], ['r', 14, 15, 4, 1, 'n'], ['r', 14, 17, 4, 1, 'n'], ['r', 14, 19, 4, 1, 'n'],
            ['e', 16, 7, 4, 4.5, 'n'], ['r', 13, 5, 2, 2, 'e'], ['r', 15, 11, 2, 2, 'r'], ['p', 14, 13, 'r']
        ],
        sentinel: [
            ['e', 8, 13, 4, 3, 'n'], ['r', 5, 15, 2, 3, 'n'], ['p', 5, 18, 'n'],
            ['r', 6, 15, 3, 8, 's'], ['r', 6, 23, 3, 2, 'S'],
            ['r', 10, 11, 12, 10, 'S'], ['r', 12, 12, 8, 6, 's'], ['r', 15, 14, 2, 3, 'a'], ['r', 10, 20, 12, 1, 'A'],
            ['r', 11, 21, 4, 8, 'S'], ['r', 11, 24, 4, 1, 's'], ['r', 10, 29, 5, 2, 's'],
            ['r', 11, 1, 10, 9, 's'], ['r', 15, 0, 2, 2, 'a'], ['r', 12, 5, 8, 2, 'D'], ['r', 13, 5, 2, 2, 'a'], ['r', 11, 9, 10, 1, 'S'],
            ['!r', 26, 7, 2, 18, 'n'], ['!p', 26, 6, 'n'], ['!r', 24, 24, 6, 1, 'S'], ['!r', 26, 25, 2, 3, 'B']
        ],
        // ---------------- Fase 4: Dungeon ----------------
        skeleton: [
            ['r', 8, 12, 3, 2, 'w'], ['r', 8, 14, 2, 8, 'c'], ['r', 7, 22, 3, 2, 'w'],
            ['r', 15, 12, 2, 10, 'c'], ['r', 11, 13, 10, 1, 'w'], ['r', 10, 15, 12, 1, 'w'], ['r', 11, 17, 10, 1, 'w'], ['r', 12, 19, 8, 1, 'w'],
            ['r', 11, 22, 10, 2, 'w'], ['r', 12, 24, 2, 6, 'c'], ['r', 10, 30, 5, 1, 'w'],
            ['e', 16, 6, 5.5, 5.5, 'w'], ['r', 12, 5, 3, 3, 'k'], ['p', 13, 6, 'm'], ['r', 15, 8, 2, 2, 'k'],
            ['r', 13, 10, 6, 2, 'c'], ['p', 14, 11, 'k'],
            ['!r', 21, 18, 7, 7, 'b'], ['!r', 21, 18, 7, 1, 'y'], ['!r', 23, 21, 3, 1, 'w']
        ],
        mimic: [
            ['r', 6, 29, 3, 2, 'b'], ['r', 5, 30, 5, 1, 'B'],
            ['r', 5, 3, 22, 1, 'b'], ['r', 4, 4, 24, 9, 'b'], ['r', 4, 8, 24, 1, 'B'], ['r', 4, 4, 2, 9, 's'],
            ['r', 9, 5, 4, 3, 'y'], ['r', 11, 6, 1, 2, 'k'],
            ['r', 5, 13, 22, 7, 'D'], ['r', 6, 13, 2, 2, 'w'], ['r', 10, 13, 2, 3, 'w'], ['r', 14, 13, 2, 2, 'w'],
            ['r', 8, 18, 2, 2, 'w'], ['r', 12, 17, 2, 3, 'w'],
            ['r', 14, 16, 4, 5, 'r'], ['r', 15, 20, 2, 3, 'u'],
            ['r', 4, 20, 24, 9, 'B'], ['r', 6, 22, 20, 5, 'b'], ['r', 13, 23, 6, 2, 'y'], ['r', 14, 24, 4, 1, 'Y'], ['r', 4, 20, 2, 9, 'S']
        ],
        gargoyle: [
            ['e', 6, 13, 5.5, 9, 'Z'], ['e', 6.5, 14, 3.5, 6.5, 'z'], ['r', 2, 3, 2, 3, 'Z'],
            ['r', 10, 1, 2, 5, 'Z'], ['r', 9, 1, 1, 2, 'Z'],
            ['r', 8, 17, 3, 7, 'z'], ['r', 8, 24, 3, 1, 'w'],
            ['e', 16, 20, 6.5, 7.5, 'z'], ['e', 16, 21, 3.5, 5, 'Z'], ['!r', 19, 22, 2, 2, 'x'], ['!r', 10, 16, 2, 1, 'x'],
            ['r', 11, 26, 4, 4, 'Z'], ['r', 9, 30, 7, 1, 'z'],
            ['e', 16, 8, 5.5, 5, 'z'], ['r', 12, 6, 8, 1, 'Z'], ['r', 12, 7, 3, 2, 'e'], ['r', 14, 11, 4, 1, 'k'], ['p', 14, 12, 'w']
        ],
        // ---------------- Chefes ----------------
        kraken: [
            ['l', 8, 18, 3, 24, 'i', 3], ['l', 3, 24, 5, 29, 'i', 3], ['l', 11, 20, 9, 29, 'i', 3], ['l', 14, 21, 14, 29, 'I', 3],
            ['p', 4, 25, 'u'], ['p', 10, 24, 'u'], ['p', 10, 27, 'u'],
            ['e', 16, 11, 11, 10, 'i'], ['e', 16, 15, 9, 5, 'I'], ['e', 11, 6, 4, 3, 'A'],
            ['r', 9, 10, 5, 4, 'y'], ['r', 11, 11, 2, 3, 'k'],
            ['r', 14, 17, 4, 3, 'D'], ['r', 15, 19, 2, 2, 'o'],
            ['!r', 19, 2, 5, 6, 'w'], ['!r', 20, 4, 3, 1, 'c'], ['!r', 6, 16, 4, 5, 'w'], ['!r', 7, 18, 2, 1, 'c']
        ],
        mensageiro: [
            ['r', 5, 26, 22, 5, 'D'], ['r', 7, 20, 18, 6, 'd'], ['r', 9, 13, 14, 7, 'd'], ['r', 9, 13, 2, 18, 'D'],
            ['r', 14, 13, 4, 18, 'D'], ['p', 15, 15, 's'], ['p', 15, 18, 's'], ['p', 15, 21, 's'],
            ['r', 12, 30, 3, 1, 'B'],
            ['r', 12, 0, 8, 4, 'D'], ['r', 8, 4, 16, 2, 'D'], ['r', 12, 3, 8, 1, 'A'],
            ['r', 13, 6, 6, 4, 'F'], ['r', 13, 7, 2, 1, 'l'], ['r', 11, 10, 10, 3, 'R'], ['!r', 20, 12, 3, 6, 'R'],
            ['!r', 5, 14, 4, 3, 'd'], ['!r', 3, 13, 2, 3, 'S'], ['!r', 1, 16, 6, 8, 'S'], ['!r', 2, 17, 4, 6, 'l'], ['!r', 3, 18, 2, 3, 'W'],
            ['!r', 25, 15, 3, 2, 'd'], ['!r', 25, 17, 5, 5, 'O'], ['!r', 24, 22, 7, 1, 'O'], ['!p', 27, 23, 'H']
        ],
        estrategista: [
            ['r', 5, 25, 2, 6, 'N'],
            ['r', 10, 5, 3, 13, 'n'],
            ['r', 7, 15, 3, 8, 'N'], ['r', 7, 23, 2, 2, 'f'],
            ['r', 9, 20, 14, 5, 'n'], ['r', 7, 25, 18, 6, 'w'], ['r', 11, 22, 1, 9, 'N'], ['r', 7, 30, 18, 1, 'N'],
            ['r', 11, 12, 10, 8, 'N'], ['r', 15, 13, 2, 3, 'a'], ['r', 11, 19, 10, 1, 'v'],
            ['e', 8.5, 13, 4, 3, 'n'], ['r', 5, 9, 2, 3, 'N'],
            ['e', 16, 8, 4, 4, 'f'], ['r', 13, 7, 2, 1, 'a'], ['r', 15, 10, 2, 1, 'u'],
            ['r', 11, 1, 2, 4, 'N'], ['r', 15, 0, 2, 5, 'n'], ['r', 11, 4, 10, 1, 'a'],
            ['!r', 27, 5, 1, 26, 's'], ['!r', 25, 1, 5, 5, 'a'], ['!r', 26, 2, 3, 3, 'W']
        ],
        guardia: [
            ['r', 5, 27, 22, 4, 'D'], ['r', 7, 22, 18, 5, 'Z'], ['r', 9, 13, 14, 9, 'Z'], ['r', 14, 14, 4, 17, 'D'],
            ['!r', 9, 24, 3, 2, 'x'], ['!r', 20, 17, 2, 2, 'x'],
            ['l', 10, 14, 15, 19, 'S', 1],
            ['e', 7, 17, 3, 4, 'z'], ['r', 5, 20, 3, 2, 'w'],
            ['e', 16, 7, 7.5, 7, 'Z'], ['e', 16, 8, 5, 5.5, 'D'], ['e', 16, 8.5, 4, 4.5, 'w'],
            ['r', 13, 7, 2, 3, 'k'], ['p', 13, 8, 'm'], ['r', 15, 10, 2, 1, 'k'], ['r', 14, 12, 4, 1, 'c'],
            ['!r', 3, 22, 1, 3, 'S'], ['!r', 1, 25, 5, 5, 'j'], ['!r', 2, 26, 3, 3, 'm'],
            ['!r', 25, 21, 1, 4, 'S'], ['!r', 24, 25, 4, 4, 'y'], ['!r', 25, 26, 2, 2, '.'], ['!r', 26, 29, 1, 2, 'y']
        ],
        horas: [
            ['l', 3, 15, 1, 23, 'V', 2], ['r', 0, 24, 3, 3, 'O'],
            ['r', 10, 25, 5, 5, 'V'], ['r', 11, 26, 3, 1, 'p'], ['r', 8, 30, 8, 1, 'H'],
            ['r', 14, 0, 4, 2, 'H'], ['r', 4, 3, 3, 3, 'H'], ['r', 1, 11, 2, 4, 'H'], ['r', 4, 21, 3, 3, 'H'],
            ['e', 16, 13, 13, 12.5, 'O'], ['e', 16, 13, 11, 10.5, 'H'], ['e', 16, 13, 9.5, 9, 'D'],
            ['r', 15, 5, 2, 2, 'y'], ['r', 8, 12, 2, 2, 'y'], ['r', 15, 20, 2, 2, 'y'], ['p', 10, 7, 'y'], ['p', 10, 18, 'y'],
            ['r', 11, 10, 3, 2, 'M'], ['r', 13, 16, 6, 1, 'M'],
            ['!l', 16, 13, 16, 7, 'w', 1], ['!l', 16, 13, 21, 16, 'r', 1], ['r', 15, 12, 2, 2, 'y'],
            ['!p', 28, 1, 'W'], ['!p', 3, 29, 'W']
        ],
        // ---------------- Props dos biomas ----------------
        palm: [
            ['!l', 17, 29, 14, 12, 'b', 3], ['!l', 19, 29, 16, 12, 'B', 1],
            ['e', 8, 9, 8, 3, 'G'], ['e', 6, 13, 5, 2.5, 'h'], ['e', 10, 6, 6, 2.5, 'g'], ['e', 16, 9, 4, 3, 'G'],
            ['r', 1, 10, 2, 3, 'G'], ['r', 2, 14, 2, 3, 'h'], ['r', 14, 11, 2, 2, 'B']
        ],
        lamp: [
            ['r', 15, 9, 2, 21, 'S'], ['r', 13, 29, 6, 2, 'S'], ['r', 12, 30, 8, 1, 'D'], ['r', 12, 8, 8, 1, 'S'],
            ['r', 12, 1, 8, 8, 'D'], ['r', 13, 2, 6, 6, 'l'], ['r', 15, 3, 2, 4, 'W'], ['r', 14, 0, 4, 1, 'S']
        ],
        restlamp: [
            ['r', 15, 12, 2, 18, 'B'], ['r', 12, 29, 8, 2, 'B'], ['r', 11, 11, 10, 1, 'S'],
            ['r', 11, 2, 10, 10, 'D'], ['r', 12, 3, 8, 8, 'y'], ['r', 14, 4, 4, 6, 'W'], ['r', 13, 1, 6, 1, 'S'],
            ['r', 6, 27, 4, 4, 'b'], ['r', 6, 26, 4, 1, 'R']
        ],
        icespire: [
            ['r', 4, 22, 3, 9, 'N'], ['r', 5, 20, 1, 2, 'n'],
            ['r', 14, 1, 4, 5, 'n'], ['r', 12, 6, 8, 8, 'N'], ['r', 10, 14, 12, 9, 'N'], ['r', 8, 23, 16, 8, 'v'],
            ['!r', 13, 4, 1, 20, 'n'], ['!r', 11, 16, 1, 10, 'W']
        ],
        campfire: [
            ['r', 6, 28, 4, 3, 'z'], ['r', 11, 29, 10, 2, 'Z'],
            ['!l', 7, 24, 22, 28, 'B', 3], ['!l', 9, 28, 24, 24, 'b', 3],
            ['r', 15, 7, 2, 4, 'r'], ['e', 16, 18, 6, 9, 'r'], ['e', 16, 20, 4, 7, 'o'], ['e', 16, 22, 2.5, 5, 'y'],
            ['!p', 10, 8, 'y'], ['!p', 22, 11, 'o']
        ],
        timeclock: [
            ['r', 13, 22, 6, 9, 'S'], ['r', 10, 30, 12, 1, 'D'],
            ['r', 8, 3, 16, 19, 'S'], ['r', 9, 4, 14, 17, 's'], ['r', 10, 5, 12, 8, 'D'],
            ['r', 11, 7, 2, 4, 'g'], ['r', 15, 7, 2, 4, 'g'], ['r', 15, 8, 2, 1, 'D'],
            ['r', 11, 15, 10, 2, 'w'], ['r', 11, 18, 10, 1, 'D']
        ],
        // ---------------- Tiles especiais (Baú de Prata, Poço dos Desejos, Mesa de Oferenda) ----------------
        chest_silver: [
            ['e', 16, 13, 11, 6, 's'], ['r', 5, 13, 11, 15, 's'], ['r', 5, 18, 11, 2, 'S'], ['r', 5, 26, 11, 2, 'S'], ['r', 5, 13, 2, 15, 'S'],
            ['!r', 14, 17, 4, 5, 'n'], ['!r', 15, 19, 2, 2, 'A'], ['p', 9, 11, 'W'], ['r', 8, 9, 3, 1, 'W']
        ],
        well: [
            ['r', 6, 20, 10, 9, 'z'], ['r', 6, 23, 10, 1, 'Z'], ['r', 6, 26, 10, 1, 'Z'],
            ['e', 16, 20, 10, 3.5, 'Z'], ['e', 16, 20, 8, 2.5, 'A'], ['e', 16, 20, 5, 1.5, 'a'],
            ['r', 6, 6, 2, 14, 'B'], ['r', 5, 3, 11, 4, 'R'], ['r', 7, 2, 9, 1, 'r'],
            ['!r', 15, 7, 2, 6, 'b'], ['!p', 14, 19, 'W'], ['!p', 18, 20, 'W']
        ],
        altar: [
            ['r', 5, 16, 11, 3, 'z'], ['r', 7, 19, 4, 10, 'Z'], ['r', 6, 28, 6, 2, 'z'], ['r', 5, 16, 11, 1, 'n'],
            ['r', 9, 17, 7, 4, 'P'], ['r', 10, 21, 6, 1, 'p'],
            ['!l', 16, 4, 12, 8, 'M', 1], ['!l', 16, 4, 20, 8, 'M', 1], ['!l', 12, 8, 16, 12, 'M', 1], ['!l', 20, 8, 16, 12, 'M', 1],
            ['!r', 15, 7, 2, 3, 'W'], ['p', 9, 6, 'y'], ['p', 6, 11, 'y']
        ]
    };

    const PAINTED_16 = {
        c_sword: [['!l', 4, 10, 11, 3, 's', 2], ['!r', 12, 2, 2, 2, 'w'], ['!l', 3, 8, 7, 12, 'y', 2], ['!l', 2, 12, 3, 13, 'B', 2], ['!r', 1, 13, 2, 2, 'y']],
        c_flask: [['r', 7, 1, 2, 1, 'b'], ['r', 7, 2, 2, 3, 's'], ['e', 8, 10, 5, 5, 'r'], ['e', 8, 11, 4, 3.5, 'o'], ['r', 7, 10, 2, 2, 'y'], ['!r', 5, 8, 1, 3, 'w']],
        c_bolt: [['!l', 9, 1, 5, 6, 'y', 3], ['!r', 5, 7, 6, 2, 'y'], ['!l', 8, 8, 4, 13, 'y', 3], ['!p', 12, 3, 'a'], ['!p', 3, 11, 'a'], ['!p', 13, 10, 'a']],
        c_aegis: [['r', 3, 2, 10, 7, 'a'], ['r', 4, 9, 8, 2, 'a'], ['r', 5, 11, 6, 2, 'A'], ['r', 7, 13, 2, 1, 'A'], ['r', 7, 3, 2, 8, 'w'], ['r', 5, 5, 6, 2, 'w']],
        c_shadow: [['r', 3, 12, 10, 2, 'D'], ['r', 4, 9, 8, 4, 'd'], ['e', 8, 6, 5, 5, 'd'], ['e', 8, 7, 3, 3, 'D'], ['r', 6, 6, 1, 1, 'a'], ['!r', 13, 7, 1, 6, 's']],
        c_crows: [['!l', 1, 4, 3, 6, 'D', 1], ['!l', 3, 6, 5, 4, 'D', 1], ['!l', 8, 2, 10, 4, 'D', 1], ['!l', 10, 4, 13, 2, 'D', 1], ['!l', 5, 10, 8, 13, 'P', 1], ['!l', 8, 13, 11, 10, 'P', 1], ['!p', 3, 6, 'e'], ['!p', 10, 4, 'e'], ['!p', 8, 13, 'e']],
        c_bless: [['e', 5.5, 6, 3, 3, 'r'], ['r', 3, 7, 10, 3, 'r'], ['r', 4, 10, 8, 2, 'r'], ['r', 6, 12, 4, 1, 'R'], ['r', 7, 13, 2, 1, 'R'], ['r', 7, 5, 2, 6, 'w'], ['r', 5, 7, 6, 2, 'w']],
        c_sun: [['r', 7, 0, 2, 2, 'o'], ['r', 7, 14, 2, 2, 'o'], ['r', 0, 7, 2, 2, 'o'], ['p', 2, 2, 'o'], ['p', 2, 13, 'o'], ['e', 8, 8, 5.5, 5.5, 'o'], ['e', 8, 8, 4.5, 4.5, 'y'], ['e', 8, 8, 2.5, 2.5, 'w']],
        c_blades: [['!l', 2, 12, 12, 2, 's', 2], ['!l', 12, 12, 2, 2, 'w', 2], ['!r', 1, 13, 3, 2, 'y'], ['!r', 12, 13, 3, 2, 'y']],
        c_wall: [['r', 1, 1, 3, 2, 's'], ['r', 6, 1, 4, 2, 's'], ['r', 1, 3, 14, 10, 'S'], ['r', 1, 6, 14, 1, 'D'], ['r', 1, 9, 14, 1, 'D'], ['r', 5, 3, 1, 3, 'D'], ['r', 3, 7, 1, 2, 'D'], ['r', 5, 10, 1, 3, 'D'], ['r', 7, 10, 2, 3, 'a']],
        r_photo: [['r', 2, 3, 12, 10, 'w'], ['r', 3, 4, 10, 5, 'a'], ['r', 3, 9, 10, 3, 'g'], ['!r', 10, 5, 2, 2, 'y'], ['!r', 5, 6, 2, 4, 'G'], ['!r', 8, 8, 1, 3, 'r']],
        r_ticket: [['r', 2, 5, 12, 6, 'y'], ['r', 2, 7, 12, 1, 'Y'], ['r', 7, 8, 2, 2, 'r'], ['r', 2, 7, 1, 2, '.']],
        r_key: [['!e', 5, 5, 3, 3, 'y'], ['!r', 4, 4, 2, 2, '.'], ['!l', 7, 7, 12, 12, 'y', 2], ['!r', 11, 13, 2, 1, 'y'], ['!r', 13, 11, 1, 2, 'y']],
        c_dagger: [['!l', 3, 12, 12, 3, 's', 2], ['!p', 13, 2, 'w'], ['!l', 3, 9, 6, 12, 'y', 2], ['!l', 2, 12, 3, 13, 'B', 1], ['!r', 1, 13, 2, 2, 'y']],
        c_wild: [['r', 7, 1, 2, 14, 'y'], ['r', 1, 7, 14, 2, 'y'], ['e', 8, 8, 4.5, 4.5, 'a'], ['e', 8, 8, 2.5, 2.5, 'w'], ['p', 3, 3, 'l'], ['p', 3, 12, 'l']],
        c_chalice: [['r', 4, 2, 8, 5, 'y'], ['r', 5, 3, 6, 3, 'r'], ['r', 6, 7, 4, 2, 'Y'], ['r', 7, 9, 2, 3, 'y'], ['r', 5, 12, 6, 2, 'Y'], ['p', 6, 4, 'w']],
        c_comet: [['!e', 11, 5, 3.5, 3.5, 'p'], ['!e', 11, 5, 2, 2, 'l'], ['!p', 11, 5, 'w'], ['!l', 2, 13, 9, 6, 'a', 2], ['!l', 3, 10, 8, 5, 'p', 1], ['!l', 5, 13, 10, 8, 'M', 1], ['!p', 2, 8, 'l'], ['!p', 7, 13, 'y']],
        p_amount: [['!l', 2, 12, 7, 3, 'b', 1], ['!r', 6, 2, 2, 2, 's'], ['!r', 2, 11, 2, 2, 'r'], ['!l', 8, 13, 13, 4, 'b', 1], ['!r', 12, 3, 2, 2, 'w'], ['!r', 8, 12, 2, 2, 'r']],
        p_area: [['r', 7, 1, 2, 2, 'a'], ['r', 7, 13, 2, 2, 'a'], ['r', 1, 7, 2, 2, 'a'], ['e', 8, 8, 4.5, 4.5, 'l'], ['e', 8, 8, 2.5, 2.5, 'w'], ['p', 3, 3, 'y'], ['p', 3, 12, 'y']],
        p_luck: [['e', 5.5, 5.5, 2.5, 2.5, 'g'], ['e', 5.5, 9.5, 2.5, 2.5, 'G'], ['r', 7, 11, 2, 4, 'h'], ['p', 5, 5, 'm'], ['p', 8, 7, 'y']],
        p_growth: [['r', 3, 2, 10, 12, 'P'], ['r', 4, 3, 8, 10, 'p'], ['r', 5, 4, 6, 8, 'w'], ['r', 7, 5, 2, 6, 'y'], ['r', 6, 6, 4, 2, 'y']],
        // ---------------- Etapa 4: custo X, Wilds, Tomos, pickups e mecânicas únicas ----------------
        c_xburst: [['e', 8, 8, 5.5, 5.5, 'r'], ['e', 8, 8, 4, 4, 'o'], ['e', 8, 8, 2.5, 2.5, 'y'], ['r', 7, 0, 2, 3, 'o'], ['r', 7, 13, 2, 3, 'o'], ['r', 0, 7, 3, 2, 'o'], ['p', 2, 2, 'y'], ['p', 2, 13, 'y'], ['!r', 7, 7, 2, 2, 'w']],
        c_wings: [['e', 4, 6, 3.5, 3, 'n'], ['r', 1, 8, 5, 2, 'N'], ['r', 2, 10, 4, 2, 'N'], ['r', 4, 12, 2, 1, 'v'], ['!r', 7, 5, 2, 7, 'y'], ['!p', 7, 4, 'w']],
        c_amulet: [['l', 4, 1, 7, 6, 'y', 1], ['e', 8, 10, 3.5, 3.5, 'Y'], ['e', 8, 10, 2.5, 2.5, 'm'], ['!p', 7, 9, 'w']],
        c_bracelet: [['e', 8, 8, 6, 5, 'r'], ['e', 8, 8, 4, 3, '.'], ['p', 3, 5, 'y'], ['p', 4, 11, 'a'], ['!r', 7, 2, 2, 2, 'y'], ['!r', 7, 12, 2, 2, 'a']],
        c_buckler: [['e', 8, 8, 6, 6, 'S'], ['e', 8, 8, 5, 5, 's'], ['e', 8, 8, 2, 2, 'y'], ['!p', 5, 5, 'w'], ['!p', 6, 4, 'w']],
        c_tome: [['r', 3, 2, 10, 12, 'B'], ['r', 4, 3, 8, 10, 'b'], ['r', 3, 12, 10, 2, 'w'], ['!r', 6, 5, 4, 4, 'a'], ['!r', 7, 6, 2, 2, 'l']],
        c_note: [['!r', 9, 2, 1, 9, 'y'], ['!r', 9, 2, 4, 2, 'y'], ['!e', 7.5, 11.5, 2.5, 2, 'y'], ['!p', 12, 5, 'Y'], ['!e', 3.5, 5, 1.5, 1.5, 'a']],
        c_hourglass: [['r', 3, 1, 10, 2, 'Y'], ['r', 3, 13, 10, 2, 'Y'], ['!e', 8, 5.5, 3.5, 2.5, 'n'], ['!e', 8, 10.5, 3.5, 2.5, 'n'], ['!r', 7, 7, 2, 2, 'n'], ['!e', 8, 11, 2.5, 1.5, 'a'], ['!r', 7, 5, 2, 2, 'a']],
        // Colegas (Crawlers): rosto + gola, no mesmo enquadramento do crachá do Valter.
        hero_vivi: [['e', 8, 7, 5.5, 5.5, 'M'], ['r', 3, 7, 2, 6, 'M'], ['e', 8, 8, 4, 4.5, 'f'], ['r', 4, 3, 8, 2, 'M'],
            ['!p', 6, 8, 'k'], ['!p', 10, 8, 'k'], ['!r', 7, 11, 2, 1, 'r'], ['r', 3, 13, 10, 3, 'q'], ['!r', 12, 2, 2, 2, 'y']],
        hero_jorge: [['e', 8, 8, 4.5, 4.5, 'F'], ['r', 4, 3, 8, 2, 'c'], ['r', 4, 7, 8, 2, 'k'], ['!r', 5, 7, 2, 2, 'a'], ['!r', 9, 7, 2, 2, 'a'],
            ['r', 5, 11, 6, 1, 'c'], ['r', 3, 13, 10, 3, 'A'], ['!r', 7, 13, 2, 3, 'w'], ['!r', 12, 13, 1, 2, 'y']],
        hero_claudia: [['e', 8, 7, 5, 5.5, 'B'], ['e', 8, 8, 4, 4.5, 'f'], ['r', 4, 3, 8, 2, 'B'], ['!p', 6, 8, 'k'], ['!p', 10, 8, 'k'],
            ['!r', 7, 11, 2, 1, 'R'], ['r', 3, 13, 10, 3, 'd'], ['!r', 7, 13, 2, 3, 'w'], ['!p', 4, 10, 'y'], ['!p', 11, 10, 'y']],
        c_rosary: [['!e', 8, 6, 5, 4.5, 'w'], ['!e', 8, 6, 3.5, 3, '.'], ['!p', 3, 6, 'y'], ['!p', 13, 6, 'y'], ['!p', 8, 1, 'y'],
            ['!r', 7, 10, 2, 5, 'y'], ['!r', 5, 12, 6, 1, 'y'], ['!p', 5, 3, 'R'], ['!p', 11, 3, 'R']],
        c_bell: [['e', 8, 7, 4.5, 5, 'y'], ['r', 3, 10, 10, 2, 'Y'], ['!r', 7, 1, 2, 2, 'Y'], ['!r', 7, 12, 2, 2, 'o'], ['!p', 6, 5, 'w']],
        c_coins: [['e', 8, 10, 5, 4.5, 'b'], ['r', 6, 4, 4, 2, 'B'], ['r', 5, 3, 6, 1, 'b'], ['!r', 7, 8, 2, 4, 'y'], ['!r', 6, 9, 4, 1, 'y']],
        c_heart: [['e', 5.5, 6, 3, 3, 'r'], ['r', 3, 7, 10, 3, 'r'], ['r', 4, 10, 8, 2, 'r'], ['r', 6, 12, 4, 1, 'R'], ['r', 7, 13, 2, 1, 'R'], ['!p', 5, 5, 'w'], ['!p', 4, 6, 'w']],
        c_eclipse: [['e', 8, 8, 6, 6, 'p'], ['e', 8, 8, 4.5, 4.5, 'D'], ['!e', 10, 6, 1.5, 1.5, 'M'], ['p', 1, 1, 'l'], ['p', 2, 13, 'l']],
        c_prism: [['e', 8, 8, 6, 6, 'n'], ['!e', 10.5, 6.5, 4.5, 4.5, '.'], ['!p', 11, 3, 'M'], ['!p', 13, 6, 'a'], ['!p', 12, 10, 'y'], ['!p', 10, 12, 'm']],
        c_loop: [['e', 8, 8, 6, 6, 'a'], ['e', 8, 8, 4, 4, '.'], ['!l', 9, 4, 6, 8, 'y', 2], ['!l', 8, 8, 6, 12, 'y', 2]],
        c_dew: [['e', 8, 10, 4, 4, 'a'], ['r', 6, 5, 4, 3, 'a'], ['!r', 7, 2, 2, 3, 'a'], ['!e', 8, 11, 2, 2, 'o'], ['!p', 6, 9, 'w']],
        c_pool: [['e', 8, 11, 7, 3.5, 'R'], ['e', 8, 11, 5.5, 2.5, 'o'], ['e', 8, 11, 3, 1.5, 'y'], ['!r', 7, 3, 2, 4, 'o'], ['!p', 4, 5, 'r'], ['!p', 11, 4, 'r'], ['!r', 7, 5, 2, 2, 'y']],
        c_fusion: [['!l', 3, 12, 11, 4, 'y', 2], ['!r', 12, 2, 2, 2, 'w'], ['!l', 3, 8, 7, 12, 'o', 2], ['!l', 2, 12, 3, 13, 'B', 2], ['!e', 11.5, 11, 2.5, 3, 'r'], ['!e', 11.5, 12, 1.5, 2, 'y']]
    };

    Object.keys(PAINTED_32).forEach(key => { SPRITE_GRIDS[key] = paintSprite(32, PAINTED_32[key]); });
    Object.keys(PAINTED_16).forEach(key => { SPRITE_GRIDS[key] = paintSprite(16, PAINTED_16[key]); });

    // Valida todas as grades (quadradas, linhas do mesmo tamanho, só cores conhecidas).
    function validateGrids() {
        const problems = [];
        Object.keys(SPRITE_GRIDS).forEach(key => {
            const grid = SPRITE_GRIDS[key];
            const w = grid[0].length;
            grid.forEach((row, y) => {
                if (row.length !== w) problems.push(key + ': linha ' + y + ' com ' + row.length + ' colunas (esperado ' + w + ')');
                for (const ch of row) {
                    if (ch !== '.' && !PALETTE[ch]) problems.push(key + ': cor desconhecida "' + ch + '" na linha ' + y);
                }
            });
        });
        return problems;
    }

    // Caixa delimitadora dos pixels opacos: o renderizador usa para apoiar os pés no chão
    // e dar a mesma altura visível a todos os inimigos comuns.
    function gridBounds(grid) {
        let x0 = grid[0].length, x1 = -1, y0 = grid.length, y1 = -1;
        grid.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                if (row[x] === '.') continue;
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
        });
        return { x0: x0, y0: y0, x1: x1, y1: y1, w: grid[0].length, h: grid.length };
    }

    // =====================================================================================
    // TEXTURAS DOS BIOMAS
    // =====================================================================================
    function speckle(g, w, h, colors, count, rng, size) {
        for (let i = 0; i < count; i++) {
            g.fillStyle = colors[Math.floor(rng() * colors.length)];
            const s = size ? 1 + Math.floor(rng() * size) : 1;
            g.fillRect(Math.floor(rng() * w), Math.floor(rng() * h), s, 1);
        }
    }

    function makeFloorTexture(biome) {
        const c = makeCanvas(32, 32);
        const g = c.getContext('2d');
        const rng = mulberry32(biome.length * 977 + 13);
        if (biome === 'beach') {
            g.fillStyle = '#ecd6a4';
            g.fillRect(0, 0, 32, 32);
            speckle(g, 32, 32, ['#f6e6bd', '#dcc089', '#cfae78', '#fff3d6'], 190, rng, 2);
            g.fillStyle = '#c9a56d';
            for (let y = 5; y < 32; y += 9) for (let x = 0; x < 32; x += 2) g.fillRect(x, y + Math.round(Math.sin(x * 0.5) * 1.5), 1, 1);
            g.fillStyle = '#f7b7a3';
            g.fillRect(22, 12, 2, 1);
            g.fillRect(7, 25, 2, 1);
        } else if (biome === 'city') {
            g.fillStyle = '#14171f';
            g.fillRect(0, 0, 32, 32);
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 4; col++) {
                    const ox = col * 8 + (row % 2 ? 4 : 0);
                    const shade = ['#2c3242', '#343b4d', '#262b39', '#3a4257'][Math.floor(rng() * 4)];
                    g.fillStyle = shade;
                    g.fillRect((ox + 1) % 32, row * 8 + 1, 6, 6);
                    if (ox + 7 > 32) g.fillRect(0, row * 8 + 1, (ox + 7) % 32, 6);
                    g.fillStyle = '#5b6885';
                    g.fillRect((ox + 2) % 32, row * 8 + 2, 2, 1);
                }
            }
            speckle(g, 32, 32, ['#6f85b0', '#465270'], 22, rng, 2);
        } else if (biome === 'snow') {
            g.fillStyle = '#eef6ff';
            g.fillRect(0, 0, 32, 32);
            speckle(g, 32, 32, ['#ffffff', '#d5e6f7', '#c2d9f0', '#dfeeff'], 170, rng, 3);
            g.fillStyle = '#b3cdea';
            for (let x = 0; x < 32; x += 2) g.fillRect(x, 20 + Math.round(Math.sin(x * 0.4) * 2), 2, 1);
        } else if (biome === 'dungeon') {
            g.fillStyle = '#1b1a1f';
            g.fillRect(0, 0, 32, 32);
            [[0, 0, 16, 16], [16, 0, 16, 16], [-8, 16, 16, 16], [8, 16, 16, 16], [24, 16, 16, 16]].forEach(t => {
                g.fillStyle = ['#4a4850', '#53515a', '#434149'][Math.floor(rng() * 3)];
                g.fillRect(t[0] + 1, t[1] + 1, t[2] - 2, t[3] - 2);
                g.fillStyle = '#62606b';
                g.fillRect(t[0] + 2, t[1] + 2, t[2] - 6, 1);
            });
            speckle(g, 32, 32, ['#3a3940', '#2d2c33'], 50, rng, 2);
            speckle(g, 32, 32, ['#4f7a35', '#3d6129'], 22, rng, 2);
        } else {
            // abismo: ladrilho luminoso
            g.fillStyle = '#120c2b';
            g.fillRect(0, 0, 32, 32);
            g.fillStyle = '#7ef0ff';
            g.fillRect(0, 0, 32, 2); g.fillRect(0, 30, 32, 2); g.fillRect(0, 0, 2, 32); g.fillRect(30, 0, 2, 32);
            g.fillStyle = '#3c8fd8';
            g.fillRect(2, 2, 28, 1); g.fillRect(2, 29, 28, 1); g.fillRect(2, 2, 1, 28); g.fillRect(29, 2, 1, 28);
            g.fillStyle = '#241a52';
            g.fillRect(6, 6, 20, 20);
            g.fillStyle = '#c59bff';
            g.fillRect(15, 10, 2, 12); g.fillRect(10, 15, 12, 2);
            speckle(g, 32, 32, ['#ffffff', '#9fe8ff'], 8, rng);
        }
        return c;
    }

    // Paredes/obstáculos. 'kind' escolhe a variação (fachada, grade, estante...).
    function makeWallTexture(biome, kind) {
        const tall = biome === 'city';
        const c = makeCanvas(32, tall ? 96 : 48);
        const g = c.getContext('2d');
        const W = c.width;
        const H = c.height;
        const rng = mulberry32(biome.length * 131 + (kind || 0) * 17 + 5);
        const bricks = (base, mortar, shades, bw, bh) => {
            g.fillStyle = mortar;
            g.fillRect(0, 0, W, H);
            for (let y = 0, r = 0; y < H; y += bh, r++) {
                for (let x = (r % 2 ? -bw / 2 : 0); x < W; x += bw) {
                    g.fillStyle = shades[Math.floor(rng() * shades.length)] || base;
                    g.fillRect(x + 1, y + 1, bw - 1, bh - 1);
                }
            }
        };
        if (biome === 'beach') {
            g.fillStyle = '#5b4632';
            g.fillRect(0, 0, W, H);
            speckle(g, W, H, ['#6f573f', '#4a3827', '#806549', '#3c2d1f'], 260, rng, 4);
            g.fillStyle = '#2d221a';
            for (let i = 0; i < 6; i++) g.fillRect(Math.floor(rng() * W), Math.floor(rng() * H), 1, 6);
            g.fillStyle = '#2f8f9a';
            g.fillRect(0, H - 4, W, 4);
            g.fillStyle = '#e9f7f2';
            for (let x = 0; x < W; x += 3) g.fillRect(x, H - 5 + (x % 2), 2, 1);
        } else if (biome === 'city') {
            bricks('#252a38', '#12141b', ['#252a38', '#2b3142', '#1f2330', '#303749'], 8, 4);
            // telhado e cornija
            g.fillStyle = '#0c0e14';
            g.fillRect(0, 0, W, 6);
            g.fillStyle = '#3a4257';
            g.fillRect(0, 6, W, 2);
            if (kind === 3) {
                // grade de ferro vitoriana sobre mureta
                g.fillStyle = '#0c0e14';
                g.fillRect(0, 8, W, H - 26);
                g.fillStyle = '#2b3142';
                g.fillRect(0, H - 18, W, 18);
                g.fillStyle = '#596482';
                for (let x = 2; x < W; x += 5) {
                    g.fillRect(x, 30, 1, H - 48);
                    g.fillRect(x - 1, 28, 3, 2);
                }
                g.fillRect(0, 40, W, 1);
                g.fillRect(0, H - 22, W, 1);
            } else {
                const lit = kind === 1 ? '#ffb347' : kind === 2 ? '#7fd4ff' : '#10131b';
                [[5, 16], [19, 16], [5, 44], [19, 44]].forEach((p, i) => {
                    const on = lit !== '#10131b' && (i + kind) % 2 === 0;
                    g.fillStyle = '#0c0e14';
                    g.fillRect(p[0] - 1, p[1] - 2, 10, 20);
                    g.fillStyle = on ? lit : '#161b28';
                    g.fillRect(p[0], p[1], 8, 17);
                    g.fillRect(p[0] + 2, p[1] - 1, 4, 1);
                    g.fillStyle = '#0c0e14';
                    g.fillRect(p[0] + 3, p[1], 2, 17);
                    g.fillRect(p[0], p[1] + 8, 8, 1);
                });
                // porta
                g.fillStyle = '#0c0e14';
                g.fillRect(10, H - 26, 12, 26);
                g.fillStyle = kind === 1 ? '#3a2416' : '#1c2130';
                g.fillRect(11, H - 24, 10, 24);
                g.fillStyle = '#c79a3a';
                g.fillRect(18, H - 12, 1, 2);
            }
        } else if (biome === 'snow') {
            const grad = g.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, '#f4fbff');
            grad.addColorStop(0.25, '#bfe2f7');
            grad.addColorStop(1, '#5b9bd0');
            g.fillStyle = grad;
            g.fillRect(0, 0, W, H);
            g.fillStyle = '#ffffff';
            g.fillRect(0, 0, W, 4);
            for (let x = 0; x < W; x += 4) g.fillRect(x, 4, 2, 1 + Math.floor(rng() * 3));
            g.fillStyle = '#e9f7ff';
            for (let i = 0; i < 7; i++) {
                const x = Math.floor(rng() * W);
                const y = 8 + Math.floor(rng() * (H - 16));
                g.fillRect(x, y, 1, 7);
                g.fillRect(x + 1, y + 3, 2, 1);
            }
            g.fillStyle = '#3f79b3';
            for (let i = 0; i < 6; i++) g.fillRect(Math.floor(rng() * W), 10 + Math.floor(rng() * (H - 14)), 1, 5);
        } else {
            // dungeon
            bricks('#4b4a54', '#17161b', ['#4b4a54', '#55545f', '#403f48', '#5c5a66'], 16, 8);
            speckle(g, W, H, ['#34333a', '#2a292f'], 60, rng, 2);
            g.fillStyle = '#4f7a35';
            for (let x = 0; x < W; x += 2) g.fillRect(x, H - 3 - Math.floor(rng() * 4), 2, 7);
            speckle(g, W, H, ['#4f7a35', '#6b9a47'], 26, rng, 2);
            if (kind === 1) {
                // grade enferrujada
                g.fillStyle = '#0d0c10';
                g.fillRect(8, 14, 16, 26);
                g.fillStyle = '#a3542a';
                for (let x = 9; x < 24; x += 3) g.fillRect(x, 14, 1, 26);
                g.fillRect(8, 20, 16, 1);
                g.fillRect(8, 32, 16, 1);
            } else if (kind === 2) {
                // estante antiga
                g.fillStyle = '#3b2616';
                g.fillRect(4, 10, 24, 32);
                g.fillStyle = '#1e130b';
                g.fillRect(6, 12, 20, 8); g.fillRect(6, 22, 20, 8); g.fillRect(6, 32, 20, 8);
                const spines = ['#8a221f', '#2a6f9c', '#ba8524', '#408339', '#633c91', '#c9bda6'];
                [14, 24, 34].forEach(sy => {
                    for (let x = 7; x < 25; x += 2) {
                        g.fillStyle = spines[Math.floor(rng() * spines.length)];
                        g.fillRect(x, sy + Math.floor(rng() * 2), 2, 6);
                    }
                });
            }
        }
        return c;
    }

    function makeCeilingTexture() {
        const c = makeCanvas(32, 32);
        const g = c.getContext('2d');
        const rng = mulberry32(4242);
        g.fillStyle = '#131217';
        g.fillRect(0, 0, 32, 32);
        for (let y = 0; y < 32; y += 8) {
            for (let x = (y % 16 ? -8 : 0); x < 32; x += 16) {
                g.fillStyle = ['#2c2b33', '#34333c', '#26252c'][Math.floor(rng() * 3)];
                g.fillRect(x + 1, y + 1, 15, 7);
            }
        }
        return c;
    }

    // Céu equirretangular pixelado (256x128). O horizonte fica na metade da altura.
    function makeSkyTexture(biome) {
        const W = 256;
        const H = 128;
        const c = makeCanvas(W, H);
        const g = c.getContext('2d');
        const rng = mulberry32(biome.length * 53 + 7);
        const bands = (stops) => {
            const grad = g.createLinearGradient(0, 0, 0, H);
            stops.forEach(s => grad.addColorStop(s[0], s[1]));
            g.fillStyle = grad;
            g.fillRect(0, 0, W, H);
        };
        const disc = (cx, cy, r, color) => {
            g.fillStyle = color;
            for (let y = -r; y <= r; y++) {
                const half = Math.round(Math.sqrt(r * r - y * y));
                g.fillRect(cx - half, cy + y, half * 2, 1);
            }
        };
        if (biome === 'beach') {
            bands([[0, '#123a5e'], [0.22, '#1f8fa0'], [0.36, '#5fd0c4'], [0.44, '#ffc266'], [0.5, '#ff7a3d'], [0.52, '#0d2a38'], [1, '#081a24']]);
            disc(64, 60, 9, '#fff1b8');
            disc(64, 60, 7, '#ffffff');
            disc(192, 60, 9, '#fff1b8');
            g.fillStyle = '#ffd9a0';
            for (let i = 0; i < 26; i++) g.fillRect(Math.floor(rng() * W), 40 + Math.floor(rng() * 20), 6 + Math.floor(rng() * 14), 1);
            g.fillStyle = '#ff9f6b';
            for (let i = 0; i < 14; i++) g.fillRect(Math.floor(rng() * W), 48 + Math.floor(rng() * 12), 10 + Math.floor(rng() * 16), 2);
        } else if (biome === 'city') {
            bands([[0, '#05070f'], [0.3, '#0c1222'], [0.5, '#27324a'], [0.52, '#0a0d16'], [1, '#05070c']]);
            speckle(g, W, 56, ['#8fa4c9', '#c8d6f0', '#56658a'], 90, rng);
            disc(64, 30, 11, '#59658a');
            disc(64, 30, 9, '#dfe6f2');
            g.fillStyle = '#b9c3d6';
            g.fillRect(60, 26, 3, 2); g.fillRect(66, 32, 4, 2); g.fillRect(62, 34, 2, 1);
            disc(192, 30, 9, '#dfe6f2');
            // silhueta de torres ao longe
            g.fillStyle = '#0a0d16';
            for (let x = 0; x < W; x += 9) {
                const h = 6 + Math.floor(rng() * 16);
                g.fillRect(x, 64 - h, 7, h);
                g.fillRect(x + 3, 64 - h - 4, 1, 4);
            }
        } else if (biome === 'snow') {
            bands([[0, '#071433'], [0.25, '#12306e'], [0.44, '#3f73c0'], [0.5, '#a9c9ee'], [0.52, '#dcebfb'], [1, '#c7dbf2']]);
            speckle(g, W, 50, ['#ffffff', '#bcd4ff'], 110, rng);
            g.fillStyle = '#e8f3ff';
            for (let x = 0; x < W; x += 5) {
                const h = 5 + Math.round(Math.abs(Math.sin(x * 0.09)) * 15 + rng() * 4);
                g.fillRect(x, 66 - h, 5, h);
            }
            g.fillStyle = '#9db9de';
            for (let x = 0; x < W; x += 5) g.fillRect(x + 3, 58, 2, 6);
            g.fillStyle = '#7fe0c9';
            for (let i = 0; i < 18; i++) g.fillRect(Math.floor(rng() * W), 14 + Math.floor(rng() * 14), 8 + Math.floor(rng() * 10), 1);
        } else {
            // abismo estrelado
            g.fillStyle = '#020108';
            g.fillRect(0, 0, W, H);
            for (let i = 0; i < 40; i++) {
                g.fillStyle = ['rgba(90,50,160,0.20)', 'rgba(40,90,170,0.18)', 'rgba(150,60,170,0.14)'][i % 3];
                g.fillRect(Math.floor(rng() * W), Math.floor(rng() * H), 16 + Math.floor(rng() * 30), 4 + Math.floor(rng() * 8));
            }
            speckle(g, W, H, ['#ffffff', '#ffffff', '#9fe8ff', '#ffd9a0', '#c59bff'], 420, rng);
            g.fillStyle = '#ffffff';
            for (let i = 0; i < 26; i++) {
                const x = Math.floor(rng() * W);
                const y = Math.floor(rng() * H);
                g.fillRect(x - 1, y, 3, 1);
                g.fillRect(x, y - 1, 1, 3);
            }
        }
        return c;
    }

    function makeWaterTexture() {
        const c = makeCanvas(32, 32);
        const g = c.getContext('2d');
        const rng = mulberry32(909);
        g.fillStyle = '#0b2c3c';
        g.fillRect(0, 0, 32, 32);
        speckle(g, 32, 32, ['#0f3a4d', '#082230'], 60, rng, 5);
        g.fillStyle = '#ff9f5a';
        for (let i = 0; i < 9; i++) g.fillRect(Math.floor(rng() * 28), Math.floor(rng() * 32), 3 + Math.floor(rng() * 4), 1);
        g.fillStyle = '#7fe0d8';
        for (let i = 0; i < 7; i++) g.fillRect(Math.floor(rng() * 28), Math.floor(rng() * 32), 2 + Math.floor(rng() * 3), 1);
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
                bounds: gridBounds(grid),
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

    validateGrids().forEach(msg => console.error('[Hells Castle] Sprite inválido — ' + msg));
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
        makeSkyTexture: makeSkyTexture,
        makeWaterTexture: makeWaterTexture,
        validateGrids: validateGrids,
        hasSheet: function (name) { return !!sheets[name]; },
        makeTorchCanvas: makeTorchCanvas
    };
})();

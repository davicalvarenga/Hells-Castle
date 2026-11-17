// Meta-progressão persistente entre partidas ("Recepção"): Fundo de Reserva, Almoxarifado (PowerUps),
// Grafia/Encadernação (slots de gema permanentes), Curadoria (frequência e selo de gemas), colegas
// desbloqueados e o modo Hora Extra Infinita. Módulo puro: sem DOM; o armazenamento é injetado
// (localStorage no navegador, objeto falso nos testes) e toda leitura é validada.
(function () {
    'use strict';

    const STORAGE_KEY = 'hc_meta_v1';
    const VERSION = 1;

    // ---------- ALMOXARIFADO ----------
    // cost = (rank + 1) * base + floor(20 * 1.1 ^ totalBought), totalBought = ranks comprados somando todos.
    const POWERUPS = [
        { id: 'Might', name: 'Might', icon: 'headphones', base: 120, max: 5, desc: '+10% de dano por rank.' },
        { id: 'MaxHealth', name: 'Sanidade Máx.', icon: 'c_heart', base: 100, max: 5, desc: '+10 de Sanidade Máxima por rank.' },
        { id: 'Armor', name: 'Armadura', icon: 'c_aegis', base: 150, max: 3, desc: '+1 de Escudo no início de cada combate por rank.' },
        { id: 'Area', name: 'Área', icon: 'p_area', base: 100, max: 3, desc: '+10% de Area por rank.' },
        { id: 'Amount', name: 'Quantidade', icon: 'p_amount', base: 900, max: 1, desc: '+1 projétil (caro!).' },
        { id: 'Growth', name: 'Crescimento', icon: 'p_growth', base: 90, max: 5, desc: '+15% de XP por rank.' },
        { id: 'Greed', name: 'Ganância', icon: 'c_coins', base: 80, max: 5, desc: '+20% de VR ganho por rank.' },
        { id: 'Luck', name: 'Sorte', icon: 'p_luck', base: 100, max: 3, desc: '+15% de Luck por rank.' },
        { id: 'Recovery', name: 'Recuperação', icon: 'thermos', base: 120, max: 5, desc: '+1 de cura ao vencer cada encontro por rank.' },
        { id: 'Cooldown', name: 'Cafeína', icon: 'espresso', base: 700, max: 2, desc: '+1 de Cafeína máxima por rank (máx. 2).' },
        { id: 'Reroll', name: 'Re-rolar', icon: 'event_q', base: 60, max: 3, desc: '+1 Re-rolar no Level Up por rank.' },
        { id: 'Skip', name: 'Pular', icon: 'cc', base: 40, max: 3, desc: '+1 Pular no Level Up por rank.' },
        { id: 'Banish', name: 'Banir', icon: 'ata', base: 60, max: 3, desc: '+1 Banir no Level Up por rank.' },
        { id: 'Revival', name: 'Revival', icon: 'c_chalice', base: 1500, max: 1, desc: '+1 carga de Revival (muito caro!).' },
        { id: 'Curse', name: 'Maldição', icon: 'vr_boost', base: 50, max: 5, desc: '+15% de força inimiga e de XP por rank.' }
    ];
    const POWERUP_BY_ID = POWERUPS.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});

    // ---------- GRAFIA / ENCADERNAÇÃO ----------
    const FORGE_MAX_SLOTS = 3;           // slots permanentes no total
    const FORGE_PER_CARD = 1;            // no máximo +1 permanente por carta
    const FORGE_PRICES = [150, 300, 450];

    // ---------- CURADORIA ----------
    const CURATION_MAX_SEALED = 5;
    const CURATION_MAX_FAVORED = 3;
    const FAVOR_WEIGHT = 2;              // gema "Favorita" aparece com o dobro do peso

    // ---------- COLEGAS ----------
    // Valter vem desbloqueado. Os outros: créditos ou vencer a run (cada vitória contrata o próximo da fila).
    const CHARACTER_PRICES = { valter: 0, vivi: 400, jorge: 600, claudia: 800 };
    const CHARACTER_ORDER = ['valter', 'vivi', 'jorge', 'claudia'];

    // ---------- NÍVEIS DE PRESSÃO ----------
    // Bônus de crédito por nível (igual a GameData.PRESSURE_LEVELS; os testes garantem a paridade).
    // Vencer às 18:00 no nível N libera o N+1 (a 1ª vitória libera o 1).
    const PRESSURE_BONUS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    const PRESSURE_MAX = PRESSURE_BONUS.length - 1;

    function defaults() {
        return {
            version: VERSION,
            credits: 0,
            powerups: {},
            spentOnPowerups: 0,
            forge: {},
            spentOnForge: 0,
            sealedGems: [],
            favoredGems: [],
            unlockedChars: ['valter'],
            selectedChar: 'valter',
            infiniteUnlocked: false,
            infiniteMode: false,
            pressureUnlocked: 0,
            pressure: 0,
            achievements: { secretEnding: false, trickster: false },
            stats: { runs: 0, wins: 0, bestWave: 0, totalCredits: 0 }
        };
    }

    const toInt = (v, min, max) => {
        const n = Math.floor(Number(v));
        if (!Number.isFinite(n)) return min;
        return Math.max(min, Math.min(max, n));
    };

    // Valida um objeto vindo do armazenamento: campos desconhecidos são ignorados, números são limitados,
    // listas só aceitam ids conhecidos. opts.gemIds / opts.cardIds / opts.charIds restringem os ids aceitos.
    function sanitize(raw, opts) {
        const o = opts || {};
        const out = defaults();
        if (!raw || typeof raw !== 'object') return out;
        const BIG = 1e9;
        out.credits = toInt(raw.credits, 0, BIG);
        out.spentOnPowerups = toInt(raw.spentOnPowerups, 0, BIG);
        out.spentOnForge = toInt(raw.spentOnForge, 0, BIG);
        POWERUPS.forEach(p => {
            const rank = toInt(raw.powerups && raw.powerups[p.id], 0, p.max);
            if (rank > 0) out.powerups[p.id] = rank;
        });
        const validCard = id => typeof id === 'string' && (!o.cardIds || o.cardIds.includes(id));
        let forgeTotal = 0;
        Object.keys((raw.forge && typeof raw.forge === 'object') ? raw.forge : {}).forEach(id => {
            const n = toInt(raw.forge[id], 0, FORGE_PER_CARD);
            if (n > 0 && validCard(id) && forgeTotal + n <= FORGE_MAX_SLOTS) {
                out.forge[id] = n;
                forgeTotal += n;
            }
        });
        const validGem = id => typeof id === 'string' && (!o.gemIds || o.gemIds.includes(id));
        const uniq = list => Array.from(new Set(Array.isArray(list) ? list : []));
        out.sealedGems = uniq(raw.sealedGems).filter(validGem).slice(0, CURATION_MAX_SEALED);
        out.favoredGems = uniq(raw.favoredGems).filter(id => validGem(id) && !out.sealedGems.includes(id)).slice(0, CURATION_MAX_FAVORED);
        const validChar = id => CHARACTER_ORDER.includes(id) && (!o.charIds || o.charIds.includes(id));
        out.unlockedChars = uniq(['valter'].concat(raw.unlockedChars || [])).filter(validChar);
        out.selectedChar = out.unlockedChars.includes(raw.selectedChar) ? raw.selectedChar : 'valter';
        out.infiniteUnlocked = raw.infiniteUnlocked === true;
        out.infiniteMode = out.infiniteUnlocked && raw.infiniteMode === true;
        out.pressureUnlocked = toInt(raw.pressureUnlocked, 0, PRESSURE_MAX);
        out.pressure = toInt(raw.pressure, 0, out.pressureUnlocked);
        const ach = raw.achievements && typeof raw.achievements === 'object' ? raw.achievements : {};
        out.achievements = { secretEnding: ach.secretEnding === true, trickster: ach.trickster === true };
        const st = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
        out.stats = {
            runs: toInt(st.runs, 0, BIG),
            wins: toInt(st.wins, 0, BIG),
            bestWave: toInt(st.bestWave, 0, BIG),
            totalCredits: toInt(st.totalCredits, 0, BIG)
        };
        return out;
    }

    // Leitura tolerante: armazenamento bloqueado, ausente ou JSON corrompido viram o estado padrão.
    function load(storage, opts) {
        try {
            const text = storage && storage.getItem(STORAGE_KEY);
            return sanitize(text ? JSON.parse(text) : null, opts);
        } catch (err) {
            return defaults();
        }
    }

    function save(storage, meta) {
        try {
            if (!storage) return false;
            storage.setItem(STORAGE_KEY, JSON.stringify(meta));
            return true;
        } catch (err) {
            return false;
        }
    }

    function clear(storage) {
        try {
            if (storage) storage.removeItem(STORAGE_KEY);
            return true;
        } catch (err) {
            return false;
        }
    }

    // ---------- ALMOXARIFADO ----------
    function rankOf(meta, id) {
        return (meta.powerups && meta.powerups[id]) || 0;
    }

    function totalBought(meta) {
        return Object.keys(meta.powerups || {}).reduce((sum, id) => sum + meta.powerups[id], 0);
    }

    function powerupCost(def, rank, bought) {
        return (rank + 1) * def.base + Math.floor(20 * Math.pow(1.1, bought));
    }

    function nextPowerupCost(meta, id) {
        const def = POWERUP_BY_ID[id];
        if (!def || rankOf(meta, id) >= def.max) return null;
        return powerupCost(def, rankOf(meta, id), totalBought(meta));
    }

    function buyPowerup(meta, id) {
        const cost = nextPowerupCost(meta, id);
        if (cost === null || meta.credits < cost) return false;
        meta.credits -= cost;
        meta.spentOnPowerups += cost;
        meta.powerups[id] = rankOf(meta, id) + 1;
        return true;
    }

    // Reembolso total e gratuito: zera os ranks e devolve tudo o que foi gasto no Almoxarifado.
    function refundPowerups(meta) {
        const back = meta.spentOnPowerups;
        meta.credits += back;
        meta.spentOnPowerups = 0;
        meta.powerups = {};
        return back;
    }

    // ---------- GRAFIA / ENCADERNAÇÃO ----------
    function forgeUsed(meta) {
        return Object.keys(meta.forge || {}).reduce((sum, id) => sum + meta.forge[id], 0);
    }

    function nextForgeCost(meta) {
        const used = forgeUsed(meta);
        return used >= FORGE_MAX_SLOTS ? null : FORGE_PRICES[used];
    }

    function canForge(meta, cardId) {
        return nextForgeCost(meta) !== null && (meta.forge[cardId] || 0) < FORGE_PER_CARD;
    }

    function forgeSlot(meta, cardId) {
        const cost = nextForgeCost(meta);
        if (!canForge(meta, cardId) || meta.credits < cost) return false;
        meta.credits -= cost;
        meta.spentOnForge += cost;
        meta.forge[cardId] = (meta.forge[cardId] || 0) + 1;
        return true;
    }

    function refundForge(meta) {
        const back = meta.spentOnForge;
        meta.credits += back;
        meta.spentOnForge = 0;
        meta.forge = {};
        return back;
    }

    // ---------- CURADORIA (gratuita, com limites) ----------
    // Ciclo de cada gema: normal -> favorita -> selada -> normal.
    function gemCuration(meta, gemId) {
        if (meta.sealedGems.includes(gemId)) return 'sealed';
        if (meta.favoredGems.includes(gemId)) return 'favored';
        return 'normal';
    }

    function cycleGem(meta, gemId) {
        const now = gemCuration(meta, gemId);
        if (now === 'normal') {
            if (meta.favoredGems.length < CURATION_MAX_FAVORED) {
                meta.favoredGems.push(gemId);
                return 'favored';
            }
            if (meta.sealedGems.length < CURATION_MAX_SEALED) {
                meta.sealedGems.push(gemId);
                return 'sealed';
            }
            return 'normal';
        }
        if (now === 'favored') {
            meta.favoredGems = meta.favoredGems.filter(id => id !== gemId);
            if (meta.sealedGems.length < CURATION_MAX_SEALED) {
                meta.sealedGems.push(gemId);
                return 'sealed';
            }
            return 'normal';
        }
        meta.sealedGems = meta.sealedGems.filter(id => id !== gemId);
        return 'normal';
    }

    // Multiplicador de peso no sorteio: 0 = selada (não aparece), 2 = favorita.
    function gemWeightMult(meta, gemId) {
        const c = gemCuration(meta, gemId);
        return c === 'sealed' ? 0 : c === 'favored' ? FAVOR_WEIGHT : 1;
    }

    // ---------- COLEGAS ----------
    function isUnlocked(meta, charId) {
        return meta.unlockedChars.includes(charId);
    }

    function unlockCharacter(meta, charId) {
        const price = CHARACTER_PRICES[charId];
        if (price === undefined || isUnlocked(meta, charId) || meta.credits < price) return false;
        meta.credits -= price;
        meta.unlockedChars.push(charId);
        return true;
    }

    function selectCharacter(meta, charId) {
        if (!isUnlocked(meta, charId)) return false;
        meta.selectedChar = charId;
        return true;
    }

    function setPressure(meta, level) {
        const lv = toInt(level, 0, PRESSURE_MAX);
        if (lv > meta.pressureUnlocked) return false;
        meta.pressure = lv;
        return true;
    }

    // ---------- FIM DE RUN ----------
    // Todo VR ganho na run (inclui Overkill de chefe e o que foi gasto na fogueira) vira crédito,
    // multiplicado pelo bônus do nível de Pressão jogado.
    // result: { vrEarned, victory, infinite, wave, pressure, secretEnding, trickster }.
    function recordRun(meta, result) {
        const r = result || {};
        const pressure = toInt(r.pressure, 0, PRESSURE_MAX);
        const credits = Math.floor(toInt(r.vrEarned, 0, 1e9) * (1 + PRESSURE_BONUS[pressure]));
        const out = { credits: credits, pressureBonus: PRESSURE_BONUS[pressure], unlockedChar: null, unlockedInfinite: false,
            newBestWave: false, unlockedPressure: 0, newSecretEnding: false, newTrickster: false };
        if (r.trickster && !meta.achievements.trickster) {
            meta.achievements.trickster = true;
            out.newTrickster = true;
        }
        meta.credits += credits;
        meta.stats.totalCredits += credits;
        meta.stats.runs += 1;
        if (r.infinite) {
            const wave = toInt(r.wave, 0, 1e9);
            if (wave > meta.stats.bestWave) {
                meta.stats.bestWave = wave;
                out.newBestWave = true;
            }
        } else if (r.victory) {
            meta.stats.wins += 1;
            const next = Math.min(PRESSURE_MAX, pressure + 1);
            if (next > meta.pressureUnlocked) {
                meta.pressureUnlocked = next;
                out.unlockedPressure = next;
            }
            if (r.secretEnding && !meta.achievements.secretEnding) {
                meta.achievements.secretEnding = true;
                out.newSecretEnding = true;
            }
            if (!meta.infiniteUnlocked) {
                meta.infiniteUnlocked = true;
                out.unlockedInfinite = true;
            }
            const hire = CHARACTER_ORDER.find(id => !isUnlocked(meta, id));
            if (hire) {
                meta.unlockedChars.push(hire);
                out.unlockedChar = hire;
            }
        }
        return out;
    }

    window.GameMeta = {
        STORAGE_KEY: STORAGE_KEY,
        POWERUPS: POWERUPS,
        POWERUP_BY_ID: POWERUP_BY_ID,
        FORGE_MAX_SLOTS: FORGE_MAX_SLOTS,
        FORGE_PER_CARD: FORGE_PER_CARD,
        FORGE_PRICES: FORGE_PRICES,
        CURATION_MAX_SEALED: CURATION_MAX_SEALED,
        CURATION_MAX_FAVORED: CURATION_MAX_FAVORED,
        CHARACTER_PRICES: CHARACTER_PRICES,
        CHARACTER_ORDER: CHARACTER_ORDER,
        PRESSURE_BONUS: PRESSURE_BONUS,
        PRESSURE_MAX: PRESSURE_MAX,
        setPressure: setPressure,
        defaults: defaults,
        sanitize: sanitize,
        load: load,
        save: save,
        clear: clear,
        rankOf: rankOf,
        totalBought: totalBought,
        powerupCost: powerupCost,
        nextPowerupCost: nextPowerupCost,
        buyPowerup: buyPowerup,
        refundPowerups: refundPowerups,
        forgeUsed: forgeUsed,
        nextForgeCost: nextForgeCost,
        canForge: canForge,
        forgeSlot: forgeSlot,
        refundForge: refundForge,
        gemCuration: gemCuration,
        cycleGem: cycleGem,
        gemWeightMult: gemWeightMult,
        isUnlocked: isUnlocked,
        unlockCharacter: unlockCharacter,
        selectCharacter: selectCharacter,
        recordRun: recordRun
    };
})();

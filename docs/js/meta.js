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

    // ---------- QUADRO DE METAS ("CARIMBOS DO RH") ----------
    // scope: 'run' = o jogo marca durante a run; 'meta' = deduzida do save (evaluateMetaGoals).
    // Cada meta paga uma única vez em crédito persistente.
    const GOALS = [
        { id: 'primeiro_ponto', name: 'Primeiro Ponto', desc: 'Vença o expediente às 18:00.', reward: 60, icon: 'r_photo', scope: 'meta' },
        { id: 'escadinha', name: 'Mestre da Escadinha', desc: 'Chegue ao Combo x5 no mesmo turno.', reward: 40, icon: 'c_wild', scope: 'run' },
        { id: 'ultramatanca', name: 'Ultramatança', desc: 'Cause 100+ de Overkill num mesmo chefe.', reward: 80, icon: 'c_comet', scope: 'run' },
        { id: 'minimalista', name: 'Minimalista', desc: 'Vença sem gastar nada na Fogueira.', reward: 120, icon: 'campfire', scope: 'run' },
        { id: 'alquimista', name: 'Alquimista', desc: 'Faça 2+ evoluções/fusões na mesma run.', reward: 80, icon: 'c_fusion', scope: 'run' },
        { id: 'colegas', name: 'Colegas de Turno', desc: 'Vença com Vivi, com Seu Jorge e com Cláudia.', reward: 150, icon: 'hero_vivi', scope: 'meta' },
        { id: 'cacador_segredos', name: 'Caçador de Segredos', desc: 'Derrote O Trapaceiro e veja o Final Secreto.', reward: 150, icon: 'event_q', scope: 'meta' },
        { id: 'sob_pressao', name: 'Sob Pressão', desc: 'Vença na Pressão 3 e na Pressão 5.', reward: 150, icon: 'vr_boost', scope: 'meta' },
        { id: 'infinito', name: 'Infinito', desc: 'Chegue à onda 5 na Hora Extra Infinita.', reward: 100, icon: 'c_loop', scope: 'meta' },
        { id: 'joalheiro', name: 'Joalheiro de Bolso', desc: 'Encaixe 10 gemas na mesma run.', reward: 50, icon: 'c_prism', scope: 'run' },
        { id: 'abates', name: 'Expediente Sangrento', desc: 'Derrote 100 inimigos na mesma run.', reward: 50, icon: 'c_blades', scope: 'run' },
        { id: 'caixa_forte', name: 'Caixa-Forte', desc: 'Ganhe 500 VR na mesma run.', reward: 60, icon: 'c_coins', scope: 'run' },
        { id: 'intocavel', name: 'Intocável', desc: 'Vença um chefe sem perder Sanidade na luta.', reward: 80, icon: 'c_aegis', scope: 'run' },
        { id: 'frio_calculista', name: 'Frio e Calculista', desc: 'Tenha 3 inimigos congelados ao mesmo tempo.', reward: 60, icon: 'c_hourglass', scope: 'run' },
        { id: 'mao_pesada', name: 'Mão Pesada', desc: 'Estilhace 3 cartas na mesma run.', reward: 40, icon: 'ata', scope: 'run' },
        { id: 'arquiteto', name: 'Arquiteto do Almoxarifado', desc: 'Compre 10 ranks de PowerUp no total.', reward: 60, icon: 'headphones', scope: 'meta' },
        { id: 'recrutador', name: 'Recrutador', desc: 'Tenha os 4 colegas contratados.', reward: 80, icon: 'hero_claudia', scope: 'meta' },
        { id: 'estagiario', name: 'Estágio Concluído', desc: 'Conclua o Tutorial Guiado.', reward: 40, icon: 'hero_valter', scope: 'run' },
        // Etapa 8: arquétipos das cartas de bioma.
        { id: 'piromaniaco', name: 'Piromaníaco', desc: 'Cause 50+ de dano de Burn numa única luta.', reward: 60, icon: 'c_wave', scope: 'run' },
        { id: 'cacador_implacavel', name: 'Caçador Implacável', desc: 'Desarme 3 inimigos no mesmo turno.', reward: 80, icon: 'c_bullet', scope: 'run' },
        { id: 'fortaleza_viva', name: 'Fortaleza Viva', desc: 'Cause 35+ de dano baseado em Escudo num turno.', reward: 80, icon: 'c_crystal', scope: 'run' },
        { id: 'queima_arquivo', name: 'Queima de Arquivo', desc: 'Destrua 4+ cartas com Destroy numa luta.', reward: 60, icon: 'c_shredder', scope: 'run' },
        { id: 'mestre_paradoxo', name: 'Mestre do Paradoxo', desc: 'Chegue ao Combo x7+ num turno.', reward: 120, icon: 'c_paradox', scope: 'run' },
        { id: 'viajante_mundos', name: 'Viajante de Mundos', desc: 'Vença jogando cartas exclusivas de 3+ biomas diferentes.', reward: 150, icon: 'c_mirror', scope: 'run' }
    ];
    const GOAL_BY_ID = GOALS.reduce((acc, g) => { acc[g.id] = g; return acc; }, {});
    const SEEN_KINDS = ['cards', 'gems', 'arcanas', 'enemies'];

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
            goals: {},
            seen: { cards: [], gems: [], arcanas: [], enemies: [] },
            winsByChar: {},
            pressureWins: [],
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
        const goals = raw.goals && typeof raw.goals === 'object' ? raw.goals : {};
        GOALS.forEach(g => { if (goals[g.id] === true) out.goals[g.id] = true; });
        const seen = raw.seen && typeof raw.seen === 'object' ? raw.seen : {};
        const known = { cards: o.cardIds, gems: o.gemIds, arcanas: o.arcanaIds, enemies: o.enemyIds };
        SEEN_KINDS.forEach(kind => {
            out.seen[kind] = uniq(seen[kind]).filter(id => typeof id === 'string' && id.length < 64 && (!known[kind] || known[kind].includes(id)));
        });
        const wins = raw.winsByChar && typeof raw.winsByChar === 'object' ? raw.winsByChar : {};
        CHARACTER_ORDER.forEach(id => {
            const n = toInt(wins[id], 0, BIG);
            if (n > 0) out.winsByChar[id] = n;
        });
        out.pressureWins = uniq(raw.pressureWins).map(v => toInt(v, -1, PRESSURE_MAX)).filter(v => v >= 0).sort((a, b) => a - b);
        out.pressureWins = uniq(out.pressureWins);
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
            if (CHARACTER_ORDER.includes(r.char)) meta.winsByChar[r.char] = (meta.winsByChar[r.char] || 0) + 1;
            if (!meta.pressureWins.includes(pressure)) meta.pressureWins = meta.pressureWins.concat(pressure).sort((a, b) => a - b);
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

    // ---------- METAS ----------
    // Concede a meta uma única vez: +crédito no Fundo de Reserva. Retorna o valor pago (0 se já tinha).
    function awardGoal(meta, id) {
        const goal = GOAL_BY_ID[id];
        if (!goal || meta.goals[id]) return 0;
        meta.goals[id] = true;
        meta.credits += goal.reward;
        meta.stats.totalCredits += goal.reward;
        return goal.reward;
    }

    // Metas deduzidas do próprio save (vitórias, colegas, segredos, Pressão, Hora Extra, Almoxarifado).
    function metaGoalsMet(meta) {
        const wins = meta.winsByChar || {};
        return {
            primeiro_ponto: meta.stats.wins > 0,
            colegas: ['vivi', 'jorge', 'claudia'].every(id => wins[id] > 0),
            cacador_segredos: meta.achievements.secretEnding && meta.achievements.trickster,
            sob_pressao: meta.pressureWins.includes(3) && meta.pressureWins.includes(5),
            infinito: meta.stats.bestWave >= 5,
            arquiteto: totalBought(meta) >= 10,
            recrutador: CHARACTER_ORDER.every(id => isUnlocked(meta, id))
        };
    }

    // Concede todas as metas de save já cumpridas. Retorna a lista [{ id, reward }] do que foi pago agora.
    function evaluateMetaGoals(meta) {
        const met = metaGoalsMet(meta);
        return Object.keys(met).filter(id => met[id]).map(id => ({ id: id, reward: awardGoal(meta, id) })).filter(x => x.reward > 0);
    }

    // ---------- COLEÇÃO ----------
    function markSeen(meta, kind, id) {
        if (!SEEN_KINDS.includes(kind) || typeof id !== 'string' || meta.seen[kind].includes(id)) return false;
        meta.seen[kind].push(id);
        return true;
    }

    // ---------- BACKUP (exportar / importar) ----------
    // Formato: HCSAVE1.<base64 do JSON em UTF-8>.<FNV-1a 32 bits do JSON, 8 dígitos hex>.
    const BACKUP_PREFIX = 'HCSAVE1';

    function fnv1a(text) {
        let h = 0x811c9dc5;
        for (let i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        return ('0000000' + h.toString(16)).slice(-8);
    }

    function toBase64(text) {
        const bytes = new TextEncoder().encode(text);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
    }

    function fromBase64(b64) {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }

    function encodeBackup(meta, ui) {
        const json = JSON.stringify({ v: 1, meta: meta, ui: ui || {} });
        return BACKUP_PREFIX + '.' + toBase64(json) + '.' + fnv1a(json);
    }

    // Nunca lança: { ok: true, meta (já validada), ui (bruta) } ou { ok: false, error } com mensagem clara.
    function decodeBackup(text, opts) {
        const raw = String(text || '').replace(/\s+/g, '');
        if (!raw) return { ok: false, error: 'Cole o código do backup na caixa antes de importar.' };
        const parts = raw.split('.');
        if (parts.length !== 3 || parts[0] !== BACKUP_PREFIX) {
            return { ok: false, error: 'Código inválido: um backup do Hell\'s Castle começa com ' + BACKUP_PREFIX + '.' };
        }
        let json;
        try {
            json = fromBase64(parts[1]);
        } catch (err) {
            return { ok: false, error: 'Código corrompido: o conteúdo não é Base64 válido.' };
        }
        if (fnv1a(json) !== parts[2].toLowerCase()) {
            return { ok: false, error: 'Checksum não confere: o código foi cortado ou alterado.' };
        }
        let data;
        try {
            data = JSON.parse(json);
        } catch (err) {
            return { ok: false, error: 'Código corrompido: os dados não são JSON válido.' };
        }
        if (!data || data.v !== 1 || !data.meta || typeof data.meta !== 'object') {
            return { ok: false, error: 'Backup de outra versão ou sem dados de progresso.' };
        }
        return { ok: true, meta: sanitize(data.meta, opts), ui: data.ui && typeof data.ui === 'object' ? data.ui : {} };
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
        GOALS: GOALS,
        GOAL_BY_ID: GOAL_BY_ID,
        SEEN_KINDS: SEEN_KINDS,
        BACKUP_PREFIX: BACKUP_PREFIX,
        awardGoal: awardGoal,
        metaGoalsMet: metaGoalsMet,
        evaluateMetaGoals: evaluateMetaGoals,
        markSeen: markSeen,
        encodeBackup: encodeBackup,
        decodeBackup: decodeBackup,
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

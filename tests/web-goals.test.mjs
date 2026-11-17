// Etapa 7: Metas ("Carimbos do RH"), Coleção, Backup do Save e prontidão para Itch.io. Rodar: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const context = vm.createContext({ window: {}, console, TextEncoder, TextDecoder, btoa, atob });
vm.runInContext(readFileSync(new URL('../docs/js/data.js', import.meta.url), 'utf8'), context);
vm.runInContext(readFileSync(new URL('../docs/js/meta.js', import.meta.url), 'utf8'), context);
const D = context.window.GameData;
const M = context.window.GameMeta;
const plain = obj => JSON.parse(JSON.stringify(obj));
const IDS = {
    gemIds: Object.keys(D.GEMS), cardIds: Object.keys(D.CARDS), charIds: D.CHARACTERS.map(c => c.id),
    arcanaIds: Object.keys(D.ARCANAS), enemyIds: Object.keys(D.ENEMIES)
};
const fresh = () => M.sanitize ? M.sanitize(M.defaults(), IDS) : M.defaults();

test('metas: 18 da Etapa 7 + 6 da Etapa 8, ids únicos, recompensa entre 40 e 150 CR e as obrigatórias presentes', () => {
    assert.equal(M.GOALS.length, 24, 'total ' + M.GOALS.length);
    assert.equal(new Set(M.GOALS.map(g => g.id)).size, M.GOALS.length);
    M.GOALS.forEach(g => {
        assert.ok(g.reward >= 40 && g.reward <= 150, g.id);
        assert.ok(g.name && g.desc && g.icon, g.id);
        assert.ok(g.scope === 'run' || g.scope === 'meta', g.id);
    });
    ['primeiro_ponto', 'escadinha', 'ultramatanca', 'minimalista', 'alquimista', 'colegas', 'cacador_segredos', 'sob_pressao', 'infinito']
        .forEach(id => assert.ok(M.GOAL_BY_ID[id], 'falta ' + id));
});

test('awardGoal: paga uma única vez e soma ao crédito e ao total histórico', () => {
    const m = M.defaults();
    const r = M.awardGoal(m, 'escadinha');
    assert.equal(r, M.GOAL_BY_ID.escadinha.reward);
    assert.equal(m.credits, r);
    assert.equal(m.stats.totalCredits, r);
    assert.equal(M.awardGoal(m, 'escadinha'), 0);
    assert.equal(m.credits, r);
    assert.equal(M.awardGoal(m, 'nao_existe'), 0);
});

test('metas de save: Colegas de Turno exige vitória com Vivi, Seu Jorge e Cláudia', () => {
    const m = M.defaults();
    ['vivi', 'jorge'].forEach(c => M.recordRun(m, { vrEarned: 10, victory: true, char: c }));
    let paid = M.evaluateMetaGoals(m).map(p => p.id);
    assert.ok(paid.includes('primeiro_ponto'));
    assert.ok(!paid.includes('colegas'));
    M.recordRun(m, { vrEarned: 10, victory: true, char: 'claudia' });
    paid = M.evaluateMetaGoals(m).map(p => p.id);
    assert.ok(paid.includes('colegas') && !paid.includes('primeiro_ponto'));
    assert.deepEqual(plain(M.evaluateMetaGoals(m)), [], 'nada paga duas vezes');
});

test('metas de save: Sob Pressão (3 e 5), Infinito (onda 5+) e Caçador de Segredos', () => {
    const m = M.defaults();
    m.pressureUnlocked = 5;
    M.recordRun(m, { vrEarned: 1, victory: true, char: 'valter', pressure: 3 });
    assert.ok(!M.metaGoalsMet(m).sob_pressao);
    M.recordRun(m, { vrEarned: 1, victory: true, char: 'valter', pressure: 5 });
    assert.ok(M.metaGoalsMet(m).sob_pressao);
    assert.deepEqual(plain(m.pressureWins), [3, 5]);
    M.recordRun(m, { vrEarned: 1, victory: false, infinite: true, wave: 6 });
    assert.ok(M.metaGoalsMet(m).infinito);
    m.achievements.trickster = true;
    assert.ok(!M.metaGoalsMet(m).cacador_segredos);
    m.achievements.secretEnding = true;
    assert.ok(M.metaGoalsMet(m).cacador_segredos);
});

test('Coleção: markSeen registra uma vez e o save descarta ids desconhecidos', () => {
    const m = M.defaults();
    assert.equal(M.markSeen(m, 'cards', 'mordida_ferro'), true);
    assert.equal(M.markSeen(m, 'cards', 'mordida_ferro'), false);
    assert.equal(M.markSeen(m, 'tipo_invalido', 'x'), false);
    const st = new Map();
    const storage = { getItem: k => st.get(k) ?? null, setItem: (k, v) => st.set(k, String(v)) };
    storage.setItem('hc_meta_v1', JSON.stringify({
        goals: { escadinha: true, hack: true, minimalista: 'sim' },
        seen: { cards: ['mordida_ferro', 'nao_existe', 5, 'mordida_ferro'], enemies: ['crab', 'dragao'], gems: 'x' },
        winsByChar: { vivi: 2, intruso: 9 }, pressureWins: [5, 3, 3, 9, -1, 'a']
    }));
    const loaded = M.load(storage, IDS);
    assert.deepEqual(plain(loaded.goals), { escadinha: true });
    assert.deepEqual(plain(loaded.seen.cards), ['mordida_ferro']);
    assert.deepEqual(plain(loaded.seen.enemies), ['crab']);
    assert.deepEqual(plain(loaded.seen.gems), []);
    assert.deepEqual(plain(loaded.winsByChar), { vivi: 2 });
    assert.deepEqual(plain(loaded.pressureWins), [3, 5]);
});

test('Backup: exportar e importar faz ida e volta completa (meta + metas + UI, com acentos)', () => {
    const m = fresh();
    m.credits = 1234;
    m.goals = { escadinha: true, colegas: true };
    m.seen.cards = ['mordida_ferro'];
    m.unlockedChars = ['valter', 'vivi'];
    const code = M.encodeBackup(m, { introSeen: true, tutorialDone: true, tips: ['combo'] });
    assert.match(code, /^HCSAVE1\.[A-Za-z0-9+/=]+\.[0-9a-f]{8}$/);
    const res = M.decodeBackup('  ' + code + '\n', IDS);
    assert.equal(res.ok, true);
    assert.equal(res.meta.credits, 1234);
    assert.deepEqual(plain(res.meta.goals), { escadinha: true, colegas: true });
    assert.deepEqual(plain(res.meta.unlockedChars), ['valter', 'vivi']);
    assert.equal(res.ui.tutorialDone, true);
});

test('Backup: inválidos são rejeitados com mensagem e sem lançar exceção', () => {
    const code = M.encodeBackup(fresh(), { introSeen: true });
    const [pre, body, sum] = code.split('.');
    const cases = {
        vazio: '',
        nulo: null,
        lixo: 'isso não é um save',
        prefixo: 'XXSAVE1.' + body + '.' + sum,
        checksum: pre + '.' + body + '.' + (sum === '00000000' ? '00000001' : '00000000'),
        conteudo: pre + '.' + (body[5] === 'A' ? body.slice(0, 5) + 'B' : body.slice(0, 5) + 'A') + body.slice(6) + '.' + sum,
        base64: pre + '.@@@###.' + sum,
        semPartes: pre + '.' + body
    };
    Object.entries(cases).forEach(([name, text]) => {
        let res;
        assert.doesNotThrow(() => { res = M.decodeBackup(text, IDS); }, name);
        assert.equal(res.ok, false, name);
        assert.ok(typeof res.error === 'string' && res.error.length > 10, name);
    });
    // JSON válido com checksum correto, mas sem "meta": versão/forma errada.
    const json = JSON.stringify({ v: 1 });
    const b64 = Buffer.from(json, 'utf8').toString('base64');
    let h = 0x811c9dc5;
    for (const ch of json) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    const forged = 'HCSAVE1.' + b64 + '.' + h.toString(16).padStart(8, '0');
    assert.equal(M.decodeBackup(forged, IDS).ok, false);
});

test('Backup: valores absurdos dentro de um código válido são saneados ao importar', () => {
    const m = M.defaults();
    m.credits = -50;
    m.goals = { hack: true, escadinha: true };
    m.powerups = { Might: 999 };
    const res = M.decodeBackup(M.encodeBackup(m, {}), IDS);
    assert.equal(res.ok, true);
    assert.ok(res.meta.credits >= 0);
    assert.deepEqual(plain(res.meta.goals), { escadinha: true });
    assert.ok(res.meta.powerups.Might <= 5);
});

// ---------- Itch.io: todos os caminhos de docs/ são relativos e apontam para arquivos existentes ----------
const DOCS = fileURLToPath(new URL('../docs/', import.meta.url));
const walk = dir => readdirSync(dir).flatMap(f => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
});
const TEXT_FILES = walk(DOCS).filter(f => /\.(html|css|js|json|webmanifest)$/.test(f) && !/three\.min\.js$/.test(f));

test('Itch.io: nenhum caminho absoluto (começando com /) em HTML, CSS e JS de docs/', () => {
    const bad = [];
    const patterns = [
        /\b(?:src|href|action|poster)\s*=\s*["']\/(?!\/)/g,
        /url\(\s*["']?\/(?!\/)/g,
        /["'`]\/(?:assets|css|js|fonts|icon)[^"'`]*["'`]/g
    ];
    TEXT_FILES.forEach(f => {
        const txt = readFileSync(f, 'utf8');
        patterns.forEach(re => { for (const m of txt.matchAll(re)) bad.push(path.relative(DOCS, f) + ': ' + m[0]); });
    });
    assert.deepEqual(bad, []);
});

test('Itch.io: todo recurso local referenciado em HTML/CSS existe dentro de docs/', () => {
    const missing = [];
    TEXT_FILES.filter(f => /\.(html|css)$/.test(f)).forEach(f => {
        const txt = readFileSync(f, 'utf8');
        const refs = [...txt.matchAll(/\b(?:src|href)\s*=\s*["']([^"'#]+)["']/g), ...txt.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map(m => m[1]);
        refs.filter(r => !/^(?:[a-z]+:|\/\/|data:|\.\/?$)/i.test(r)).forEach(r => {
            const target = path.resolve(path.dirname(f), r.split('?')[0]);
            if (!target.startsWith(DOCS) || !existsSync(target)) missing.push(path.relative(DOCS, f) + ' -> ' + r);
        });
    });
    // Ilustrações carregadas pelo JS (cutscene e transições).
    const js = TEXT_FILES.filter(f => f.endsWith('.js')).map(f => readFileSync(f, 'utf8')).join('\n');
    [...js.matchAll(/["'](assets\/[^"']+\.(?:png|jpg|webp|mp3|ogg))["']/g)].forEach(m => {
        if (!existsSync(path.join(DOCS, m[1]))) missing.push('js -> ' + m[1]);
    });
    assert.deepEqual(missing, []);
});

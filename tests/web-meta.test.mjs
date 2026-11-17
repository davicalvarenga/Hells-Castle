// Meta-progressão persistente (docs/js/meta.js) e dados dos colegas. Rodar: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {}, console });
vm.runInContext(readFileSync(new URL('../docs/js/data.js', import.meta.url), 'utf8'), context);
vm.runInContext(readFileSync(new URL('../docs/js/meta.js', import.meta.url), 'utf8'), context);
const D = context.window.GameData;
const M = context.window.GameMeta;
const plain = obj => JSON.parse(JSON.stringify(obj));

// localStorage falso: guarda strings como o real e pode simular cota cheia / acesso bloqueado.
function fakeStorage(opts) {
    const data = new Map();
    return {
        data,
        getItem: k => { if (opts && opts.blockRead) throw new Error('bloqueado'); return data.has(k) ? data.get(k) : null; },
        setItem: (k, v) => { if (opts && opts.full) throw new Error('QuotaExceededError'); data.set(k, String(v)); },
        removeItem: k => data.delete(k)
    };
}
const IDS = { gemIds: Object.keys(D.GEMS), cardIds: Object.keys(D.CARDS), charIds: D.CHARACTERS.map(c => c.id) };

test('padrão: só Valter, sem créditos, Hora Extra bloqueada', () => {
    const m = M.load(fakeStorage(), IDS);
    assert.equal(m.credits, 0);
    assert.deepEqual(plain(m.unlockedChars), ['valter']);
    assert.equal(m.selectedChar, 'valter');
    assert.equal(m.infiniteUnlocked, false);
    assert.equal(m.infiniteMode, false);
});

test('salvar e carregar preserva tudo (ida e volta pelo armazenamento)', () => {
    const st = fakeStorage();
    const m = M.load(st, IDS);
    m.credits = 5000;
    assert.ok(M.buyPowerup(m, 'Might'));
    assert.ok(M.buyPowerup(m, 'Might'));
    assert.ok(M.forgeSlot(m, 'mordida_ferro'));
    M.cycleGem(m, 'double');                   // favorita
    M.cycleGem(m, 'steal');
    M.cycleGem(m, 'steal');                    // selada
    assert.ok(M.unlockCharacter(m, 'vivi'));
    assert.ok(M.selectCharacter(m, 'vivi'));
    assert.ok(M.save(st, m));
    const back = M.load(st, IDS);
    assert.deepEqual(plain(back), plain(m));
    assert.ok(st.data.get(M.STORAGE_KEY).includes('"Might":2'));
});

test('armazenamento corrompido, bloqueado ou cheio nunca quebra o jogo', () => {
    const bad = fakeStorage();
    bad.setItem(M.STORAGE_KEY, '{nao é json');
    assert.deepEqual(plain(M.load(bad, IDS)), plain(M.defaults()));
    assert.deepEqual(plain(M.load(fakeStorage({ blockRead: true }), IDS)), plain(M.defaults()));
    assert.equal(M.load(null, IDS).credits, 0);
    assert.equal(M.save(fakeStorage({ full: true }), M.defaults()), false);
    assert.equal(M.save(null, M.defaults()), false);
});

test('sanitize: limita números, ignora ids desconhecidos e respeita os tetos', () => {
    const m = M.sanitize({
        credits: -50, spentOnPowerups: 'abc',
        powerups: { Might: 99, Amount: 7, Hacker: 3, Cooldown: 2.9 },
        forge: { mordida_ferro: 5, carta_falsa: 1, pocao_fogo: 1, chicote_dados: 1, golpe_furtivo: 1 },
        sealedGems: ['double', 'double', 'nao_existe', 'steal', 'drain', 'freeze', 'leader', 'wild'],
        favoredGems: ['steal', 'eco'],
        unlockedChars: ['vivi', 'chefe_secreto'], selectedChar: 'claudia',
        infiniteUnlocked: 'sim', infiniteMode: true,
        stats: { runs: 3.7, wins: -1 }
    }, IDS);
    assert.equal(m.credits, 0);
    assert.equal(m.spentOnPowerups, 0);
    assert.deepEqual(plain(m.powerups), { Might: 5, Amount: 1, Cooldown: 2 });
    assert.equal(M.forgeUsed(m), M.FORGE_MAX_SLOTS, 'teto total da Grafia');
    assert.ok(!('carta_falsa' in m.forge));
    assert.equal(m.forge.mordida_ferro, 1, '+1 por carta');
    assert.equal(m.sealedGems.length, M.CURATION_MAX_SEALED);
    assert.ok(!m.sealedGems.includes('nao_existe'));
    assert.deepEqual(plain(m.favoredGems), ['eco'], 'selada não pode ser favorita');
    assert.deepEqual(plain(m.unlockedChars), ['valter', 'vivi']);
    assert.equal(m.selectedChar, 'valter', 'colega bloqueado não fica selecionado');
    assert.equal(m.infiniteUnlocked, false);
    assert.equal(m.infiniteMode, false, 'modo infinito exige desbloqueio');
    assert.deepEqual(plain(m.stats), { runs: 3, wins: 0, bestWave: 0, totalCredits: 0 });
});

test('Almoxarifado: custo (lv+1)*base + floor(20*1.1^totalBought), teto e reembolso grátis', () => {
    const m = M.defaults();
    const might = M.POWERUP_BY_ID.Might;
    assert.equal(M.nextPowerupCost(m, 'Might'), might.base + 20);
    m.credits = 100000;
    let spent = 0;
    for (let i = 0; i < might.max; i++) {
        const cost = M.nextPowerupCost(m, 'Might');
        assert.equal(cost, (i + 1) * might.base + Math.floor(20 * Math.pow(1.1, i)));
        assert.ok(M.buyPowerup(m, 'Might'));
        spent += cost;
    }
    assert.equal(M.nextPowerupCost(m, 'Might'), null, 'rank máximo');
    assert.ok(!M.buyPowerup(m, 'Might'));
    // o totalBought de outro PowerUp encarece os seguintes
    assert.equal(M.nextPowerupCost(m, 'Growth'), M.POWERUP_BY_ID.Growth.base + Math.floor(20 * Math.pow(1.1, might.max)));
    assert.equal(M.refundPowerups(m), spent);
    assert.equal(m.credits, 100000);
    assert.equal(M.totalBought(m), 0);
    const poor = M.defaults();
    poor.credits = 10;
    assert.ok(!M.buyPowerup(poor, 'Skip'), 'sem crédito não compra');
    assert.equal(poor.credits, 10);
    ['Might', 'MaxHealth', 'Armor', 'Area', 'Amount', 'Growth', 'Greed', 'Luck', 'Recovery', 'Cooldown', 'Reroll', 'Skip',
        'Banish', 'Revival', 'Curse'].forEach(id => assert.ok(M.POWERUP_BY_ID[id], id));
    assert.equal(M.POWERUP_BY_ID.Cooldown.max, 2);
    assert.ok(M.POWERUP_BY_ID.Amount.base > M.POWERUP_BY_ID.Might.base * 4, 'Amount é caro');
    assert.ok(M.POWERUP_BY_ID.Revival.base >= 1000, 'Revival é muito caro');
});

test('Grafia: até 3 slots permanentes, +1 por carta, preço crescente e reembolso', () => {
    const m = M.defaults();
    m.credits = 10000;
    assert.ok(M.forgeSlot(m, 'mordida_ferro'));
    assert.ok(!M.forgeSlot(m, 'mordida_ferro'), 'só +1 por carta');
    assert.ok(M.forgeSlot(m, 'pocao_fogo'));
    assert.ok(M.forgeSlot(m, 'chicote_dados'));
    assert.ok(!M.forgeSlot(m, 'golpe_furtivo'), 'teto de 3');
    const spent = M.FORGE_PRICES.reduce((a, b) => a + b, 0);
    assert.equal(m.credits, 10000 - spent);
    assert.equal(M.refundForge(m), spent);
    assert.equal(M.forgeUsed(m), 0);
    // na run: slot permanente soma ao slot natural (respeitando o teto de 4)
    assert.equal(D.getCardGemSlots(D.CARDS.golpe_furtivo, 1), 2);
});

test('Curadoria: ciclo normal -> favorita -> selada -> normal, limites e peso no sorteio', () => {
    const m = M.defaults();
    assert.equal(M.cycleGem(m, 'double'), 'favored');
    assert.equal(M.gemWeightMult(m, 'double'), 2);
    assert.equal(M.cycleGem(m, 'double'), 'sealed');
    assert.equal(M.gemWeightMult(m, 'double'), 0);
    assert.equal(M.cycleGem(m, 'double'), 'normal');
    ['eco', 'copia', 'ima'].forEach(id => M.cycleGem(m, id));
    assert.equal(m.favoredGems.length, M.CURATION_MAX_FAVORED);
    assert.equal(M.cycleGem(m, 'demi'), 'sealed', 'favoritas cheias: pula para selada');
    // selada nunca sai; favorita pesa o dobro
    const w = id => M.gemWeightMult(m, id);
    for (let i = 0; i < 200; i++) assert.notEqual(D.pickGemByRarity(['demi', 'spike'], i / 200, w), 'demi');
    assert.equal(D.pickGemByRarity(['demi'], 0.5, w), null, 'só seladas: nada');
    const counts = { eco: 0, discharge: 0 };       // ambas Épicas; eco é favorita
    for (let i = 0; i < 300; i++) counts[D.pickGemByRarity(['eco', 'discharge'], i / 300, w)]++;
    assert.ok(Math.abs(counts.eco - 200) <= 2 && Math.abs(counts.discharge - 100) <= 2, JSON.stringify(counts));
});

test('colegas: contratar com créditos e seleção só de desbloqueados', () => {
    const m = M.defaults();
    assert.ok(!M.selectCharacter(m, 'vivi'));
    m.credits = M.CHARACTER_PRICES.vivi - 1;
    assert.ok(!M.unlockCharacter(m, 'vivi'));
    m.credits += 1;
    assert.ok(M.unlockCharacter(m, 'vivi'));
    assert.equal(m.credits, 0);
    assert.ok(!M.unlockCharacter(m, 'vivi'), 'não compra duas vezes');
    assert.ok(M.selectCharacter(m, 'vivi'));
});

test('fim de run: VR vira crédito; vitória libera Hora Extra e o próximo colega; recorde de ondas', () => {
    const m = M.defaults();
    const loss = M.recordRun(m, { vrEarned: 321.9, victory: false });
    assert.equal(loss.credits, 321);
    assert.equal(m.credits, 321);
    assert.equal(m.infiniteUnlocked, false);
    const win = M.recordRun(m, { vrEarned: 500, victory: true });
    assert.ok(win.unlockedInfinite);
    assert.equal(win.unlockedChar, 'vivi');
    assert.equal(m.stats.wins, 1);
    assert.ok(!M.recordRun(m, { vrEarned: 0, victory: true }).unlockedInfinite, 'só na primeira vitória');
    assert.deepEqual(plain(m.unlockedChars), ['valter', 'vivi', 'jorge']);
    const inf = M.recordRun(m, { vrEarned: 40, infinite: true, wave: 7 });
    assert.ok(inf.newBestWave);
    assert.equal(m.stats.bestWave, 7);
    assert.ok(!M.recordRun(m, { vrEarned: 0, infinite: true, wave: 3 }).newBestWave);
    assert.equal(m.stats.wins, 2, 'Hora Extra não conta como vitória da campanha');
    assert.equal(m.stats.runs, 5);
    assert.equal(m.stats.totalCredits, 321 + 500 + 40);
});

test('dados: 4 colegas com baralho, passiva e Carta de Crawler válidos', () => {
    assert.deepEqual(D.CHARACTERS.map(c => c.id), M.CHARACTER_ORDER.slice());
    D.CHARACTERS.forEach(hero => {
        assert.ok(hero.name && hero.desc && hero.icon && hero.maxHp > 0, hero.id);
        (hero.deck || D.STARTING_DECK).forEach(id => assert.ok(D.CARDS[id], hero.id + ': ' + id));
        assert.ok((hero.deck || D.STARTING_DECK).length >= D.BALANCE.minDeckSize, hero.id);
        const crawler = D.CARDS[hero.crawlerCard];
        assert.equal(crawler.crawler, hero.id);
        assert.ok(crawler.crawlerTrigger.length > 0 && Object.keys(crawler.crawlerFx).length > 0, hero.id);
        assert.ok(D.isWildCard(crawler), 'crachá comba como Wild');
        assert.equal(D.getCardGemSlots(crawler), 0, 'crachá não recebe gema');
        assert.ok(!D.isBreakableCard(crawler), 'crachá não racha');
        assert.ok(M.CHARACTER_PRICES[hero.id] >= 0, hero.id);
    });
    const vivi = D.getCharacter('vivi');
    assert.ok(vivi.deck.filter(id => D.isWildCard(D.CARDS[id])).length >= 4, 'Vivi focada em Wild');
    assert.ok(D.getCharacter('jorge').deck.some(id => id.startsWith('tomo_')), 'Jorge com Tomos');
    assert.ok(D.getCharacter('claudia').deck.filter(id => D.CARDS[id].critChance > 0).length >= 4, 'Cláudia com Crítico');
    assert.equal(D.getCharacter('nao_existe').id, 'valter');
    const inf = D.BALANCE.infinite;
    assert.ok(inf.waveHp > 0 && inf.waveAtk > 0 && inf.cursePerTurn > 0 && inf.curseCap > D.BALANCE.curseCap);
});

// ---------- Etapa 6: Pressão, segredos e falas ----------
test('Pressão: bônus de crédito igual nos dados e na meta, preços da fogueira e crédito por nível', () => {
    assert.deepEqual(plain(M.PRESSURE_BONUS), plain(D.PRESSURE_LEVELS.map(l => l.creditBonus)));
    assert.equal(D.PRESSURE_LEVELS.length, 6);
    assert.equal(D.pressureCredits(100, 0), 100);
    assert.equal(D.pressureCredits(100, 1), 120);
    assert.equal(D.pressureCredits(101, 5), 202);
    assert.deepEqual(plain(D.restConfig(3)), plain(D.BALANCE.rest), 'até a Pressão 3 a fogueira não muda');
    const r4 = D.restConfig(4);
    assert.equal(r4.healPrice, Math.ceil(D.BALANCE.rest.healPrice * 1.25));
    assert.equal(r4.healAmount, Math.round(D.BALANCE.rest.healAmount * 0.75));
    assert.deepEqual(plain(r4.removePrices), plain(D.BALANCE.rest.removePrices.map(v => Math.ceil(v * 1.25))));
    assert.deepEqual(plain(D.restConfig(5)), plain(r4), 'Véspera de Feriado acumula a Auditoria');
});

test('Pressão: vencer no nível N libera o N+1; escolha limitada ao liberado; crédito multiplicado', () => {
    const m = M.defaults();
    assert.equal(m.pressureUnlocked, 0);
    assert.ok(!M.setPressure(m, 1), 'bloqueado antes da 1ª vitória');
    let r = M.recordRun(m, { vrEarned: 100, victory: true, pressure: 0 });
    assert.equal(r.unlockedPressure, 1);
    assert.equal(r.credits, 100);
    assert.ok(M.setPressure(m, 1));
    r = M.recordRun(m, { vrEarned: 100, victory: false, pressure: 1 });
    assert.equal(r.credits, 120, '+20% na Pressão 1');
    assert.equal(m.pressureUnlocked, 1, 'derrota não libera nível');
    for (let lv = 1; lv <= 5; lv++) {
        M.setPressure(m, lv);
        M.recordRun(m, { vrEarned: 0, victory: true, pressure: lv });
    }
    assert.equal(m.pressureUnlocked, 5, 'teto 5');
    r = M.recordRun(m, { vrEarned: 50, victory: false, pressure: 5 });
    assert.equal(r.credits, 100, '+100% na Véspera de Feriado');
    assert.ok(!M.recordRun(m, { vrEarned: 0, infinite: true, wave: 3, pressure: 5 }).unlockedPressure, 'Hora Extra não libera nível');
    const bad = M.sanitize({ pressureUnlocked: 9, pressure: 7 });
    assert.equal(bad.pressureUnlocked, 5);
    assert.equal(bad.pressure, 5);
    assert.equal(M.sanitize({ pressureUnlocked: 2, pressure: 4 }).pressure, 2, 'nível escolhido nunca passa do liberado');
});

test('conquistas: Final Secreto só em vitória; Trapaceiro em qualquer run; registradas 1x', () => {
    const m = M.defaults();
    assert.deepEqual(plain(m.achievements), { secretEnding: false, trickster: false });
    assert.ok(!M.recordRun(m, { vrEarned: 0, victory: false, secretEnding: true }).newSecretEnding);
    assert.ok(M.recordRun(m, { vrEarned: 0, victory: true, secretEnding: true }).newSecretEnding);
    assert.ok(!M.recordRun(m, { vrEarned: 0, victory: true, secretEnding: true }).newSecretEnding);
    assert.ok(M.recordRun(m, { vrEarned: 0, victory: false, trickster: true }).newTrickster);
    assert.deepEqual(plain(m.achievements), { secretEnding: true, trickster: true });
    assert.deepEqual(plain(M.sanitize({ achievements: { secretEnding: 'sim', trickster: true } }).achievements), { secretEnding: false, trickster: true });
});

test('segredos e falas: Trapaceiro existe com sprite; todo chefe tem fala nas fases 2 e 3; final secreto', () => {
    const t = D.ENEMIES.trickster;
    assert.ok(t && t.secret && t.name && t.hp > 0 && t.atk > 0 && t.floor, 'Trapaceiro');
    assert.ok(!Object.values(D.BIOME_ENEMIES || {}).some(p => (p.common || []).includes('trickster')), 'nunca aparece por sorteio');
    Object.values(D.ENEMIES).filter(e => e.isBoss).forEach(boss => {
        [2, 3].forEach(n => assert.ok(boss.phases[n].quote && boss.phases[n].quote.length <= 70, boss.kind + ' fase ' + n));
    });
    assert.equal(D.EPILOGUE.secretRelic, 'foto_parque');
    assert.ok(D.SPECIAL_RELICS.foto_parque);
    assert.ok(D.EPILOGUE.secretEndLines.some(l => l.includes('O mundo lá fora ainda está esperando.')));
    assert.ok(D.EPILOGUE.secretEndLines.some(l => /férias/.test(l)));
});

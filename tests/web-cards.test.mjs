// Etapa 8: cartas exclusivas de bioma, fusões dos arquétipos, ficha didática e novas metas. Rodar: node --test
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
const SPRITES = readFileSync(new URL('../docs/js/sprites.js', import.meta.url), 'utf8');
const GAME = readFileSync(new URL('../docs/js/game.js', import.meta.url), 'utf8');

const NEW_CARDS = {
    1: ['mare_alta', 'ressaca', 'concha_eco'],
    2: ['bala_prata', 'manto_cacador', 'sino_vigia'],
    3: ['estilhaco_glacial', 'bastiao_cristal', 'nevasca_eterna'],
    4: ['incinerar_arquivo', 'pacto_catacumbas', 'grimorio_proibido'],
    5: ['ponteiro_invertido', 'espelho_cosmico', 'paradoxo_18h']
};
const ALL_NEW = Object.values(NEW_CARDS).flat();

test('15 cartas de bioma: 3 por Fase, ids e nomes sem colidir com as cartas existentes', () => {
    assert.equal(ALL_NEW.length, 15);
    Object.entries(NEW_CARDS).forEach(([biome, ids]) => {
        ids.forEach(id => {
            const c = D.CARDS[id];
            assert.ok(c, 'falta ' + id);
            assert.equal(c.id, id);
            assert.equal(c.biome, Number(biome), id);
            assert.ok(!c.evolved, id);
        });
    });
    const names = Object.values(D.CARDS).map(c => c.name);
    assert.equal(new Set(names).size, names.length, 'nome de carta repetido');
    // Nenhuma carta de bioma substituiu uma carta anterior (o id não aparece duas vezes no data.js).
    const src = readFileSync(new URL('../docs/js/data.js', import.meta.url), 'utf8');
    ALL_NEW.forEach(id => assert.equal((src.match(new RegExp('\\n\\s+' + id + ': \\{', 'g')) || []).length, 1, id));
});

test('custos e keywords pedidos para cada carta', () => {
    const C = D.CARDS;
    assert.deepEqual(ALL_NEW.map(id => C[id].xCost ? 'X' : C[id].cost),
        [1, 0, 2, 1, 0, 2, 1, 2, 3, 0, 1, 'X', 0, 2, 4]);
    assert.equal(C.mare_alta.targeting, 'LeftRight');
    assert.equal(C.mare_alta.burnPerHit, 2);
    assert.equal(C.mare_alta.pierceVsBurning, 1);
    assert.ok(C.ressaca.burnTickNow && C.ressaca.drawIfBurning);
    assert.equal(C.concha_eco.returnTimes, 1);
    assert.equal(C.bala_prata.priority, 'Attacking');
    assert.equal(C.bala_prata.critChance, 0.35);
    assert.equal(C.bala_prata.critMult, 2.0);
    assert.equal(C.bala_prata.knockbackChance, 0.8);
    assert.equal(C.bala_prata.manaOnDisarm, 1);
    assert.equal(C.manto_cacador.shield, 5);
    assert.equal(C.manto_cacador.turnCrit, 0.15);
    assert.equal(C.sino_vigia.targeting, 'Random');
    assert.equal(C.sino_vigia.baseAmount, 3);
    assert.equal(C.sino_vigia.bonusVsControlled, 2);
    assert.ok(C.sino_vigia.critExplosion);
    assert.equal(C.estilhaco_glacial.freeze, 1);
    assert.equal(C.estilhaco_glacial.shatterShield, 6);
    assert.equal(C.bastiao_cristal.shield, 12);
    assert.ok(C.bastiao_cristal.retain && C.bastiao_cristal.scalesWithCombo && C.bastiao_cristal.damageFromShield);
    assert.equal(C.nevasca_eterna.targeting, 'FrontRow');
    assert.ok(C.nevasca_eterna.ignoreShield && C.nevasca_eterna.freeze === 1);
    assert.ok(C.incinerar_arquivo.burnWorstCard);
    assert.equal(C.pacto_catacumbas.scavenge, 3);
    assert.ok(C.grimorio_proibido.xCost && C.grimorio_proibido.xHitsBonus === 2 && C.grimorio_proibido.afterlifeShot);
    assert.ok(D.isWildCard(C.ponteiro_invertido) && C.ponteiro_invertido.turnReverse && C.ponteiro_invertido.handDiscount === 1);
    assert.ok(C.espelho_cosmico.mirrorLast);
    assert.ok(C.paradoxo_18h.comboCostCut && C.paradoxo_18h.targeting === 'FrontRow');
});

test('Cartas Assinatura: uma por Chefe das Fases 1 a 4, fora do pool comum', () => {
    assert.deepEqual([1, 2, 3, 4, 5].map(b => D.getSignatureCard(b)), ['concha_eco', 'sino_vigia', 'nevasca_eterna', 'grimorio_proibido', null]);
    [1, 2, 3, 4].forEach(b => {
        assert.deepEqual(plain(D.getBiomeCards(b)), NEW_CARDS[b].filter(id => !D.CARDS[id].signature));
        assert.ok(!D.LEVEL_UP_REWARDS.some(r => r.id === 'add_' + D.getSignatureCard(b)), 'Assinatura no pool: ' + b);
    });
    // O Abismo não tem próxima Fase: as 3 entram no pool.
    assert.deepEqual(plain(D.getBiomeCards(5, true)), NEW_CARDS[5]);
});

test('pool de Level Up: cartas de bioma marcadas com a Fase; Nível MÁX das que fundem exige ter a carta', () => {
    const biomeRewards = D.LEVEL_UP_REWARDS.filter(r => r.biome);
    assert.equal(biomeRewards.length, 11);
    biomeRewards.forEach(r => assert.equal(D.CARDS[r.id.replace('add_', '')].biome, r.biome));
    ['mare_alta', 'concha_eco', 'bala_prata', 'sino_vigia', 'estilhaco_glacial', 'bastiao_cristal'].forEach(id => {
        const up = D.LEVEL_UP_REWARDS.find(r => r.id === 'up_' + id);
        assert.ok(up, 'falta up_' + id);
        assert.equal(up.requiresCard, id);
        assert.ok(!up.biome, 'Nível MÁX vale em qualquer Fase: ' + id);
        const st = { cardLevels: {}, deck: [], discardPile: [] };
        up.apply(st);
        assert.equal(st.cardLevels[id], D.BALANCE.maxCardLevel);
        assert.deepEqual(plain(st.deck), [id]);
    });
});

test('3 novas fusões dos arquétipos', () => {
    const want = { tsunami_escaldante: ['mare_alta', 'concha_eco'], execucao_lunar: ['bala_prata', 'sino_vigia'], glaciar_absoluto: ['estilhaco_glacial', 'bastiao_cristal'] };
    Object.entries(want).forEach(([to, cards]) => {
        const fus = D.FUSIONS.find(f => f.toCard === to);
        assert.ok(fus, 'falta fusão ' + to);
        assert.deepEqual(plain(fus.cards), cards);
        assert.ok(D.CARDS[to].evolved && D.CARDS[to].fused, to);
    });
    assert.equal(new Set(D.FUSIONS.map(f => f.id)).size, D.FUSIONS.length);
});

test('todas as cartas novas têm ícone desenhado, descrição e guia didático', () => {
    ALL_NEW.concat(['tsunami_escaldante', 'execucao_lunar', 'glaciar_absoluto']).forEach(id => {
        const c = D.CARDS[id];
        assert.ok(new RegExp('\\n\\s+' + c.icon + ': \\[').test(SPRITES), 'ícone ' + c.icon);
        assert.ok(c.desc.length > 20, id);
        const g = D.getCardGuide(c);
        assert.ok(g.role.length > 10 && g.tip.length > 10, id);
    });
    // Cartas antigas recebem guia gerado (nunca vazio).
    Object.values(D.CARDS).forEach(c => {
        const g = D.getCardGuide(c);
        assert.ok(g.role && g.tip, c.id);
    });
});

test('padrão de mira nas 5 colunas', () => {
    const cols = id => plain(D.getTargetPattern(D.CARDS[id]).cells).map(c => c.mark || '-').join('');
    assert.equal(cols('mare_alta'), 'hithithit--');
    assert.equal(cols('nevasca_eterna'), 'hithithithithit');
    assert.equal(cols('sino_vigia'), 'maybemaybemaybemaybemaybe');
    assert.equal(cols('bala_prata'), '--hit--');
    assert.equal(cols('demissao_silenciosa'), '----hit');
    assert.equal(cols('ressaca'), '-----');
    assert.equal(cols('bastiao_cristal'), 'hithithithithit');
    assert.equal(D.getTargetPattern(D.CARDS.mare_alta).cells[2].order, '3');
});

test('keywords da ficha', () => {
    const keys = id => plain(D.getCardKeywords(D.CARDS[id])).map(k => k.key);
    assert.ok(keys('mare_alta').includes('Burn') && keys('mare_alta').includes('Pierce'));
    assert.ok(keys('concha_eco').includes('Return') && keys('concha_eco').includes('Assinatura'));
    assert.ok(keys('bastiao_cristal').includes('Retain') && keys('bastiao_cristal').includes('Escudo'));
    assert.ok(keys('grimorio_proibido').includes('CustoX') && keys('grimorio_proibido').includes('PosVida'));
    assert.ok(keys('ponteiro_invertido').includes('Wild') && keys('ponteiro_invertido').includes('ComboReverso'));
    assert.ok(keys('pacto_catacumbas').includes('Scavenge'));
    assert.ok(keys('glaciar_absoluto').includes('Fusao'));
    Object.values(D.CARDS).forEach(c => D.getCardKeywords(c).forEach(k => assert.ok(k.text && k.label, c.id + ' ' + k.key)));
});

test('6 novas metas da Etapa 8', () => {
    ['piromaniaco', 'cacador_implacavel', 'fortaleza_viva', 'queima_arquivo', 'mestre_paradoxo', 'viajante_mundos'].forEach(id => {
        const g = M.GOAL_BY_ID[id];
        assert.ok(g, 'falta ' + id);
        assert.ok(g.reward >= 40 && g.reward <= 150);
        assert.ok(new RegExp("goal\\('" + id + "'\\)").test(GAME), 'meta nunca concedida no jogo: ' + id);
        assert.ok(new RegExp('\\n\\s+' + g.icon + ': \\[').test(SPRITES), 'ícone ' + g.icon);
    });
});

test('troca de Fase não mexe no baralho: loadFloor não reatribui state.deck', () => {
    const body = GAME.slice(GAME.indexOf('function loadFloor('), GAME.indexOf('\n    }\n', GAME.indexOf('function loadFloor(')));
    assert.ok(body.length > 100);
    assert.ok(!/state\.deck\s*=/.test(body));
});

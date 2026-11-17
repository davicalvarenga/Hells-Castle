// Manual do Expediente (Códice "?"): conteúdo das 5 abas. As listas (biomas, gemas, arcanas, evoluções,
// PowerUps, colegas) vêm dos próprios dados do jogo, então o manual acompanha o balanceamento.
(function () {
    'use strict';

    const esc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const dl = rows => '<dl class="codex-dl">' + rows.map(r => '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>').join('') + '</dl>';
    const h = title => '<h3>' + title + '</h3>';
    const p = text => '<p>' + text + '</p>';
    const ul = items => '<ul>' + items.map(i => '<li>' + i + '</li>').join('') + '</ul>';

    function story(D) {
        const biomes = D.FLOORS.map(fl => [
            fl.trigger.time + ' · ' + esc(fl.name),
            'Chefe: ' + esc(fl.bossName) + '. ' + esc(fl.trigger.title) + '.'
        ]);
        return h('A história') +
            p('Segunda-feira, 08:17. Valter Motta, analista da Helton Corp, encara uma planilha vazia. A pressão dos e-mails ' +
                'e a impressora engasgada viram um devaneio: o escritório vira uma praia ao crepúsculo, e cada tarefa do dia vira um bioma de dark fantasy.') +
            h('Objetivo') +
            p('Atravessar os 5 devaneios e bater o ponto às <b>18:00</b>. Cada fase termina ao derrotar o chefe e passar pela saída. ' +
                'Se a <b>Sanidade</b> (vida) chegar a 0, é Burnout: a run acaba e o VR ganho vira crédito na Recepção.') +
            h('Os 5 biomas') + dl(biomes) +
            h('Controles') +
            dl([
                ['Andar', '<kbd>W</kbd>/<kbd>↑</kbd> frente, <kbd>S</kbd>/<kbd>↓</kbd> trás, <kbd>Q</kbd>/<kbd>E</kbd> de lado, <kbd>A</kbd>/<kbd>D</kbd> ou <kbd>←</kbd>/<kbd>→</kbd> girar. No celular, os botões na tela.'],
                ['Combate', '<kbd>1</kbd>–<kbd>6</kbd> jogam a carta, <kbd>Espaço</kbd> = Jogar Tudo, <kbd>Enter</kbd> = Fim do Turno, <kbd>Tab</kbd> troca o alvo.'],
                ['Atalhos', '<kbd>P</kbd> = Modo Planilha (pausa), <kbd>Esc</kbd> fecha a fogueira e este manual.']
            ]) +
            h('Mapa') +
            p('O minimapa mostra o que você já viu: baús (dourado), eventos <b>?</b> (roxo), fogueira (laranja), saída (verde) e os tiles especiais ' +
                '(Baú de Prata, Mesa de Oferenda, Poço dos Desejos). Os mapas são gerados a cada run; <code>?seed=N</code> na URL repete um mapa.');
    }

    function combo(D) {
        const B = D.BALANCE;
        return h('Turno do jogador') +
            ul([
                'Você começa cada turno com <b>' + B.baseMana + ' de Cafeína</b> (mana) e compra <b>' + B.dealCount + ' cartas</b> (mão máxima de ' + B.maxHandSize + ').',
                'Jogar uma carta gasta Cafeína igual ao custo dela. A Cafeína não gasta some no fim do turno (exceto com a Arcana Mente Afiada).',
                'O <b>Escudo</b> absorve dano e expira no início do seu próximo turno.',
                '<b>Fim do Turno</b>: as cartas da mão vão para o descarte, o Burn queima e os inimigos da frente agem.'
            ]) +
            h('Escada de Combo (+1)') +
            p('A carta seguinte só <b>comba</b> se custar exatamente <b>1 a mais</b> que a anterior: 0 → 1 → 2 → 3. ' +
                'Cada carta encadeada sobe o multiplicador (x2, x3, x4...). Quebrar a sequência reinicia em x1 a partir da carta jogada.') +
            dl([
                ['Wild', 'Sempre comba, seja qual for o custo, e reinicia a escada no custo 0 (depois de um Wild, a próxima ideal custa 0).'],
                ['Combo Reverso', 'Gema: depois dela, descer 1 no custo também comba.'],
                ['Tomos', 'Custam N e devolvem N+1 de Cafeína: ganho líquido +1 e ponte perfeita na escada.'],
                ['Custo X', 'Gasta TODA a Cafeína; X vale como o custo dela na escada.']
            ]) +
            h('Jogar Tudo') +
            p('Joga a mão na melhor ordem de combo: busca o custo que continua a escada, usa Wild quando falta o degrau e deixa Custo X e Quebra-Combo por último. ' +
                'Ele não gasta pickups de combate nem o Selo do Eclipse: essas são decisões suas.') +
            h('Pilhas do baralho') +
            p('<b>Compra</b> → <b>Mão</b> → (jogada) <b>Pilha do turno</b> → <b>Descarte</b>. Com a compra vazia, o descarte é embaralhado de volta. ' +
                'A mini-pilha à direita mostra a cadeia do turno e o próximo custo que mantém o combo.');
    }

    function stats(D) {
        const B = D.BALANCE;
        return h('Atributos') +
            dl([
                ['Might', 'Multiplica todo o dano causado (+10% = 1,1x).'],
                ['Amount', 'Projéteis extras nas cartas de acerto múltiplo; nas ondas, multiplica o dano.'],
                ['Area', 'Cada acerto respinga (Area% × 20%) do dano nas frentes das outras colunas ocupadas.'],
                ['Luck', 'Aumenta Crítico, Knockback, quiques e a chance da 4ª opção no Level Up.'],
                ['Growth', 'Multiplica todo XP (Horas Extras) ganho.'],
                ['Greed', 'Multiplica o VR ganho em combate, baús e pickups.'],
                ['Recovery', 'Cura ao vencer cada encontro.'],
                ['Revival', 'Cada carga revive com Sanidade cheia ao chegar a 0 (máx. ' + B.revivalMax + ').'],
                ['Curse', 'Inimigos mais fortes (HP e dano) e mais XP. Elites e chefes podem trocar um ataque por "Aumentar Curse".'],
                ['Freeze / Duration', 'Freeze: chance de cada golpe aplicar Gelo. Duration: prolonga Burn, Gelo e o crachá do Crawler.']
            ]) +
            h('Palavras-chave das cartas') +
            dl([
                ['Knockback (Desarme)', 'Chance de cancelar o ataque do inimigo neste turno. Chefes resistem; quem sai do atordoamento fica 1 turno imune.'],
                ['Freeze (Gelo)', 'Congelado não ataca (chefe só perde metade do ATK) e o próximo golpe nele causa ' + B.freezeDamageMult + 'x.'],
                ['Burn', 'Fica na <b>coluna</b>, não no inimigo: no fim do turno queima quem estiver na frente dela e cai 1. Burn persistente nunca cai abaixo do piso.'],
                ['Return', 'Volta para a mão depois de jogada (N vezes por turno).'],
                ['Retain', 'Não é descartada no fim do turno.'],
                ['Destroy', 'Sai da luta ao ser jogada. Cartas de bônus permanente saem do baralho da run.'],
                ['Custo X', 'Gasta toda a Cafeína e multiplica o efeito por X.'],
                ['Pierce / Quique', 'O acerto atravessa para quem está atrás ou pula para outra coluna.'],
                ['Crítico', 'Dano extra; com Explosão, parte do crítico atinge as colunas vizinhas.'],
                ['Rachada', 'Carta comum usada mais de ' + B.crackAfterUses + ' vezes no mesmo combate racha; usada de novo além do limite, tem ' +
                    Math.round(B.crackShatterChance * 100) + '% de estilhaçar. Inquebrável, À Prova de Fogo ou a fogueira resolvem.'],
                ['Temporária / Pickup', 'Cópias e cartas geradas somem no fim do turno. Pickups de baú ficam à mão até serem usados (uso único).']
            ]);
    }

    function enemies(D) {
        const B = D.BALANCE;
        const bosses = Object.keys(D.ENEMIES).filter(k => D.ENEMIES[k].isBoss).map(k => {
            const e = D.ENEMIES[k];
            return [esc(e.name), esc(e.origin.replace(' — Chefe Final', '').replace(' — Chefe', '')) + '. Fases em 66% e 33% da vida.'];
        });
        return h('5 colunas: Frente e Retaguarda') +
            p('Os inimigos ocupam 5 colunas. Só a <b>linha de frente</b> de cada coluna ataca e é atingida pela maioria das cartas. ' +
                'Quando o da frente morre, <b>a retaguarda avança</b>. Clique num inimigo (ou <kbd>Tab</kbd>) para trocar o alvo.') +
            h('Intenções') +
            dl([
                ['ATK', 'Vai atacar no fim do seu turno. Escudo absorve; Knockback e Gelo cancelam.'],
                ['Escudo', 'Alguns inimigos trocam o ataque por armadura a cada N turnos.'],
                ['Curse', 'Elites e chefes avançados aumentam a Curse da run em vez de atacar (teto ' + B.curseCap + '%).'],
                ['Suporte', 'Alguns dão +ATK aos aliados, erguem escudo de cristal ou invocam reforços.']
            ]) +
            h('Aggro, patrulha e emboscada') +
            p('O combate começa quando um encontro fica a até ' + B.aggroRange + ' casas na sua linha de visão. A cada ' + B.patrolEverySteps +
                ' passos os encontros próximos avançam; se encostarem pelo lado ou por trás, é <b>EMBOSCADA</b> (' + B.ambushDamage + ' de dano antes do Turno 1).') +
            h('Elites') +
            p('Uma por fase, guardando um baú. Mais vida e dano, resistem a Knockback e aumentam a Curse a cada ' + B.eliteHexEvery + ' turnos. Vencer dá loot de baú.') +
            h('Chefes') + dl(bosses) +
            h('Cartas-lixo (debuffs)') +
            dl([
                ['Folha Presa', 'Ocupa a mão; pague 1 para descartar e comprar 1.'],
                ['Confusão', 'Embaralha os custos da mão em ±2 neste turno.'],
                ['Bomba de Mana', 'Se ficar na mão no fim do turno, explode (e cresce a cada explosão). Jogue para desarmar.']
            ]) +
            h('Overkill') +
            p('Matar com folga dá XP e VR extras. Ao derrotar um <b>chefe</b>, ele fica em OVERKILL até o fim do turno: todo dano a mais vira VR. ' +
                'Continue jogando cartas antes de encerrar o turno!');
    }

    function progression(D, M) {
        const rarities = ['comum', 'rara', 'epica', 'lendaria'];
        const gems = rarities.map(r => [D.GEM_RARITY_LABEL[r],
            Object.keys(D.GEMS).filter(id => D.GEMS[id].rarity === r).map(id => '<b>' + esc(D.GEMS[id].name) + '</b>: ' + esc(D.GEMS[id].desc)).join('<br>')]);
        const evolutions = D.EVOLUTIONS.map(ev => [esc(D.CARDS[ev.fromCard].name) + ' → ' + esc(D.CARDS[ev.toCard].name), 'Relíquia: ' + esc(ev.title) + '.'])
            .concat(D.FUSIONS.map(f => [f.cards.map(id => esc(D.CARDS[id].name)).join(' + ') + ' → ' + esc(D.CARDS[f.toCard].name), 'Fusão: as duas no Nível MÁX.']));
        const arcanas = Object.keys(D.ARCANAS).map(id => [esc(D.ARCANAS[id].name), esc(D.ARCANAS[id].desc)]);
        const rest = D.BALANCE.rest;
        const powerups = M ? M.POWERUPS.map(pu => esc(pu.name) + ' (' + pu.max + ')').join(', ') : '';
        const crew = D.CHARACTERS.map(c => [esc(c.name), esc(c.desc)]);
        return h('Level Up') +
            p('Ao encher a barra de Horas Extras, escolha 1 de 3 melhorias (4 com sorte). <b>Re-rolar</b> troca as opções, ' +
                '<b>Pular</b> dá +20% do XP do nível e <b>Banir</b> tira uma opção desta run.') +
            h('Gemas') +
            p('Cada carta tem 1 a 3 slots (evoluídas: 3; a Mesa de Oferenda e a Grafia dão mais). Gemas incompatíveis não encaixam juntas. ' +
                'Recusar uma gema dá VR.') +
            dl(gems) +
            h('Evoluções e Fusão') +
            p('Carta no Nível MÁX + a Relíquia certa evolui no próximo baú ou Level Up.') + dl(evolutions) +
            h('Arcanas (Estados de Espírito)') +
            p('Uma no início da run; o Poço dos Desejos e o Baú de Prata podem dar outras, que se somam.') + dl(arcanas) +
            h('Fogueira (Ponto de Pausa)') +
            dl([
                ['Descansar', '+' + rest.healAmount + ' Sanidade por ' + rest.healPrice + ' VR.'],
                ['Deixar um Peso', 'Remove 1 carta (' + rest.removePrices.join('/') + ' VR, até 3 por fase).'],
                ['Gema Bruta', 'Uma gema por ' + rest.gemPrice + ' VR (1 por fase).'],
                ['Fôlego Extra', '+Escudo e +Cafeína no próximo combate (' + rest.breathPrice + ' VR).'],
                ['Reparar Rachaduras', 'Conserta as cartas Rachadas (' + rest.repairPrice + ' VR).'],
                ['Relíquia', 'Uma Relíquia de Evolução por ' + rest.relicPrice + ' VR (1 por fase).']
            ]) +
            h('Eventos do mapa') +
            dl([
                ['Baú', 'Sanidade, VR, XP e uma gema; às vezes um pickup de uso único.'],
                ['Evento ?', 'Escolhas com risco e recompensa.'],
                ['Baú de Prata', 'Raro. Pede 1 carta de cada um de dois tipos; dá Gema Épica/Lendária ou Arcana extra.'],
                ['Mesa de Oferenda', 'Sacrifique 1 carta por +1 Slot de Gema em outra, ou por VR.'],
                ['Poço dos Desejos', 'Uso único: Gema rara (ou melhor) ou Arcana extra.']
            ]) +
            h('Recepção (entre runs)') +
            dl([
                ['Fundo de Reserva', 'Todo VR ganho na run vira crédito (CR), na vitória ou na derrota.'],
                ['Almoxarifado', 'PowerUps permanentes com reembolso grátis: ' + powerups + '.'],
                ['Grafia (Ferreiro)', 'Slots de gema permanentes em cartas específicas (até 3).'],
                ['Curadoria (Joalheiro)', 'Gemas favoritas (aparecem mais) ou seladas (nunca aparecem).'],
                ['Hora Extra Infinita', 'Depois da 1ª vitória: ondas contínuas cada vez mais fortes. Recorde salvo.']
            ]) +
            h('Colegas e Carta de Crawler') +
            p('Cada colega começa com o próprio crachá no baralho: jogado, fica ativo como retrato por alguns turnos e dispara a passiva ' +
                'sempre que você joga uma carta do tipo dele.') + dl(crew);
    }

    const TABS = [
        { id: 'historia', label: 'História', title: 'História & Objetivo', build: story },
        { id: 'combo', label: 'Combo', title: 'Combo & Turnos', build: combo },
        { id: 'atributos', label: 'Atributos', title: 'Atributos & Keywords', build: stats },
        { id: 'inimigos', label: 'Inimigos', title: 'Inimigos & Overkill', build: enemies },
        { id: 'progressao', label: 'Progressão', title: 'Gemas, Eventos & Recepção', build: progression }
    ];

    function build(D, M) {
        return TABS.map(t => ({ id: t.id, label: t.label, title: t.title, html: t.build(D, M) }));
    }

    window.GameCodex = { TABS: TABS, build: build };
})();

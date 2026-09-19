/* =========================================================
   CENTRAL DE NOTIFICAÇÕES (dentro do app)

   Não é notificação de celular — é a caixa do sininho, no cabeçalho da
   tela inicial. Funciona com o app fechado? Não, e nem tenta: quem
   avisa com o app fechado é push, que precisa de servidor (ver o bloco
   PUSH no sw.js). Isto aqui é o que a pessoa encontra quando abre.

   ── REGRA DE OURO ────────────────────────────────────────
   Toda notificação sai de um fato que já aconteceu nos dados dela.
   Nada é inventado e nada é agendado "pra dar um oi". Caixa de
   notificação que vira mural de propaganda a pessoa aprende a ignorar
   em uma semana, e aí a de verdade também não é lida.

   Por isso a de oferta (o reajuste) é UMA, e só aparece quando o mês
   virou de verdade ou quando ela está mesmo há mais de 30 dias no
   mesmo plano.
   ========================================================= */

const Notif = {
  /* quais ids ela já leu, guardado no perfil pra viajar junto na nuvem */
  lidas() {
    const p = Store.db.perfil;
    if (!p) return [];
    if (!Array.isArray(p.notif_lidas)) p.notif_lidas = [];
    return p.notif_lidas;
  },

  marcarLida(id) {
    const l = this.lidas();
    if (l.indexOf(id) < 0) l.push(id);
    /* não deixa a lista crescer pra sempre: 60 ids cobre meses */
    if (l.length > 60) l.splice(0, l.length - 60);
    Store.save();
  },

  marcarTodasLidas() {
    this.lista().forEach(n => this.marcarLida(n.id));
    Store.save();
  },

  naoLidas() {
    const l = this.lidas();
    return this.lista().filter(n => l.indexOf(n.id) < 0);
  },

  /* a lista, sempre recalculada do estado atual — nada fica guardado
     como "notificação", só o que já foi lido. Assim ela nunca vê um
     aviso que deixou de valer. */
  lista() {
    const out = [];
    const p = Store.db.perfil;
    if (!p) return out;

    const mes = Store.mesAtual();
    const dias = Store.diasSemReajuste();
    const liberado = Store.reajusteLiberado();

    /* ---------- 1. virada de mês (a oferta) ---------- */
    if (Store.reajustePendente()) {
      const nomeMes = MESES_PT[Number(mes.slice(5)) - 1] || '';
      out.push({
        id: 'reajuste:' + mes,
        ic: 'calendario',
        tom: liberado ? 'verde' : 'oferta',
        titulo: liberado
          ? `Seu plano de ${nomeMes} está pronto`
          : `Virou o mês: seu plano pode ser reajustado`,
        texto: liberado
          ? 'Refizemos as suas contas com o que você registrou. Toque para ver o que mudou.'
          : `Você está há ${Store.frasedias(dias)} no mesmo plano. Libere o reajuste para o app recalcular as suas metas e evoluir o seu treino.`,
        acao: 'App.irReajuste()',
        rotulo: liberado ? 'Ver o reajuste' : 'Ver como funciona'
      });
    } else if (!liberado && dias >= 30) {
      /* ela já viu a virada deste mês e não assinou: lembra uma vez,
         com o número que é dela, não com pressão inventada */
      out.push({
        id: 'mesmoplano:' + mes,
        ic: 'calendario',
        tom: 'oferta',
        titulo: `${Store.frasedias(dias)} com o mesmo plano`,
        texto: 'Seu corpo mudou desde que este plano foi montado. O reajuste recalcula as metas e faz o treino evoluir de fase.',
        acao: 'App.irReajuste()',
        rotulo: 'Ver como funciona'
      });
    }

    /* ---------- 2. refeições que passaram hoje ---------- */
    try {
      const perdidas = (typeof Lembretes !== 'undefined' && Lembretes.perdidasHoje) ? Lembretes.perdidasHoje() : [];
      if (perdidas.length) {
        out.push({
          id: 'refeicoes:' + Store.hoje(),
          ic: 'talher',
          tom: 'neutro',
          titulo: perdidas.length === 1 ? 'Uma refeição passou do horário' : `${perdidas.length} refeições passaram do horário`,
          texto: perdidas.map(r => r.nome).join(', ') + '. Marque se você fez, mesmo fora da hora.',
          acao: "App.ir('alimentacao')",
          rotulo: 'Abrir o cardápio'
        });
      }
    } catch (e) { /* lembretes desligados: sem aviso, sem erro */ }

    /* ---------- 3. faz tempo que não pesa ---------- */
    const pes = Store.db.pesagens || [];
    if (pes.length) {
      const ultima = pes[pes.length - 1];
      const d = Math.round((Date.now() - Store.deIso(ultima.data).getTime()) / 86400000);
      if (d >= 7) {
        out.push({
          id: 'pesagem:' + ultima.data,
          ic: 'balanca',
          tom: 'neutro',
          titulo: `${d} dias sem registrar peso`,
          texto: 'É pela pesagem que o app acerta as suas metas. Sem ela, as contas ficam paradas no último número.',
          acao: 'App.abrirPeso()',
          rotulo: 'Registrar pesagem'
        });
      }
    }

    /* ---------- 4. resumo de domingo ---------- */
    if (Store.resumoPendente()) {
      out.push({
        id: 'resumo:' + Store.hoje(),
        ic: 'barras',
        tom: 'verde',
        titulo: 'Seu resumo da semana saiu',
        texto: 'O que você fechou nos últimos sete dias, num lugar só.',
        acao: "App.ir('resumo')",
        rotulo: 'Ver o resumo'
      });
    }

    /* ---------- 5. semana perfeita ---------- */
    try {
      const sp = Store.semanaPerfeita();
      if (sp && sp.completa) {
        out.push({
          id: 'semana:' + Store.hoje().slice(0, 7) + ':' + (sp.dias ? sp.dias.length : 7),
          ic: 'festa',
          tom: 'verde',
          titulo: 'Semana perfeita',
          texto: 'Você fechou todos os dias da semana. Isso é o que move o ponteiro.',
          acao: "App.ir('progresso')",
          rotulo: 'Ver o progresso'
        });
      }
    } catch (e) { /* estrutura diferente: melhor não avisar do que avisar errado */ }

    return out;
  }
};

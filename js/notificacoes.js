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

    /* ---------- 5. as duas ofertas de produto ----------
       Entram DEPOIS dos avisos de uso, nunca antes: a caixa é dela, não
       é vitrine. E cada uma aparece uma vez por mês, só depois que a
       pessoa já usou o app por alguns dias — oferecer no primeiro acesso
       é vender pra quem ainda não viu o que comprou. */
    out.push.apply(out, this._ofertas());

    return out;
  },

  /* ---------- as ofertas de produto ----------
     Regras que valem pras duas:
       • só depois de DIAS_ATE_OFERTA dias de app, contados do cadastro;
       • só pra quem AINDA não tem aquilo;
       • nunca dentro do app da Play Store (o Google não deixa app da
         loja mandar pagar fora dela);
       • uma por mês, e nunca as duas no mesmo mês: duas ofertas na
         mesma caixa é a hora em que a pessoa para de abrir a caixa.
     Em mês par vai a do Duo, em ímpar a da Corrida, e se uma delas não
     se aplica a outra ocupa a vez. */
  DIAS_ATE_OFERTA: { corrida: 5, duo: 10 },

  /* quantos dias de app ela tem */
  _diasDeApp() {
    const p = Store.db.perfil;
    if (!p || !p.criado_em) return 0;
    return Math.max(0, Math.round((Date.now() - Store.deIso(p.criado_em).getTime()) / 86400000));
  },

  _podeCorrida() {
    if (window.NO_APP_DA_LOJA) return false;
    if (!CONFIG.CHECKOUT_URL_CORRIDA) return false;
    if (this._diasDeApp() < this.DIAS_ATE_OFERTA.corrida) return false;
    /* App.extras null = ainda não consultado: não ofereço o que ela
       talvez já tenha comprado */
    return Array.isArray(App.extras) && App.extras.indexOf('corrida') < 0;
  },

  _podeDuo() {
    if (window.NO_APP_DA_LOJA) return false;
    if (!CONFIG.CHECKOUT_URL_DUO) return false;
    if (this._diasDeApp() < this.DIAS_ATE_OFERTA.duo) return false;
    const d = App.duo;
    if (!d || !d.ok) return false;              /* ainda não consultado */
    if (d.titular_email) return false;          /* ela JÁ é a convidada de alguém */
    return Number(d.vagas || 1) < 2;            /* já tem a segunda vaga? então não */
  },

  _ofertas() {
    const corrida = this._podeCorrida();
    const duo = this._podeDuo();
    if (!corrida && !duo) return [];

    const mes = Store.mesAtual();
    const par = Number(mes.slice(5)) % 2 === 0;
    const vez = (par && duo) || !corrida ? 'duo' : 'corrida';

    if (vez === 'duo') return [{
      id: 'oferta-duo:' + mes,
      ic: 'pessoa',
      tom: 'oferta',
      titulo: 'Chame alguém para o seu plano',
      texto: `O Plano Duo abre uma segunda vaga na sua assinatura por ${CONFIG.PRECO_DUO || 'R$14,90'} por mês. A outra pessoa monta o plano dela, com as metas dela, e cada uma enxerga só o seu.`,
      acao: 'App.abrirDuo()',
      rotulo: 'Ver como funciona'
    }];

    return [{
      id: 'oferta-corrida:' + mes,
      ic: 'corrida',
      tom: 'oferta',
      titulo: 'Seu app também conta corrida',
      texto: `O Modo Corrida mede distância, tempo, ritmo e calorias de cada corrida sua, na mesma tela do seu plano. São ${CONFIG.PRECO_CORRIDA || 'R$19,90'} por um ano.`,
      acao: "App.irCorrida()",
      rotulo: 'Ver o Modo Corrida'
    }];
  }
};

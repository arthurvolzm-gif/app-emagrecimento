/* =========================================================
   LEMBRETES NO CELULAR

   Dois caminhos, e o app escolhe sozinho:

     • PUSH (o principal): com login e navegador que suporta, o celular
       se inscreve e manda a agenda da semana pro Supabase
       (salvar_push). A function `enviar-lembretes` roda a cada 5
       minutos e avisa MESMO COM O APP FECHADO. Vale no Android (Chrome e
       o app da Play Store) e no iPhone instalado na tela de início
       (iOS 16.4+). Aqui só se decide QUANDO lembrar; quem manda é o
       servidor.
     • LOCAL (reserva): sem login (acesso de teste), sem internet ou
       navegador sem push, volta ao setTimeout de antes, que só dispara
       com o app aberto (mesmo minimizado).

   Os dois nunca rodam juntos: com o push confirmado, os timers locais
   ficam desligados, senão cada aviso chegaria duas vezes.

   ── QUATRO LEMBRETES, QUATRO CHAVES ──────────────────────
   Cada um liga e desliga sozinho, porque são pedidos diferentes: quem
   quer ser lembrada de beber água não necessariamente quer ser cobrada
   pelo treino. A chave da refeição continua com o nome antigo
   (`focusfit_lembretes`) de propósito: quem já tinha ligado não perde.
   ========================================================= */
const Lembretes = {
  CHAVES: {
    refeicao: 'focusfit_lembretes',
    agua:     'focusfit_lembretes_agua',
    sono:     'focusfit_lembretes_sono',
    treino:   'focusfit_lembretes_treino'
  },
  _timers: [],

  suportado() {
    try { return typeof Notification !== 'undefined'; } catch (e) { return false; }
  },

  permitido() {
    return this.suportado() && Notification.permission === 'granted';
  },

  /* Padrão é LIGADO. A pessoa não pede pra ativar: ela desativa se
     quiser, pelo switch. Por isso o critério é "não tem um '0' salvo",
     não "tem um '1' salvo" — chave ausente (ninguém nunca mexeu) conta
     como ligado. Só '0' explícito desliga. */
  ligado(tipo) {
    const chave = this.CHAVES[tipo || 'refeicao'];
    try { return localStorage.getItem(chave) !== '0'; } catch (e) { return true; }
  },

  /* algum dos quatro ligado? é o que decide se vale reagendar */
  algumLigado() {
    return Object.keys(this.CHAVES).some(t => this.ligado(t));
  },

  /* liga um: pede permissão e só grava se a pessoa aceitar */
  async ligar(tipo) {
    tipo = tipo || 'refeicao';
    if (!this.suportado()) return 'sem-suporte';
    let p = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission();
    if (p !== 'granted') return p === 'denied' ? 'negado' : 'cancelado';
    try { localStorage.setItem(this.CHAVES[tipo], '1'); } catch (e) {}
    this.agendar();
    return 'ok';
  },

  desligar(tipo) {
    try { localStorage.setItem(this.CHAVES[tipo || 'refeicao'], '0'); } catch (e) {}
    this.agendar();
  },

  limpar() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
  },

  /* ---------- os horários de cada tipo ----------
     Todos devolvem [{ hora:'HH:MM', titulo, corpo, tag }]. */

  /* refeição: os horários vêm do próprio cardápio, não invento nada */
  _horasRefeicao() {
    try {
      return Store.planoAlimentar()
        .filter(r => r.horario)
        .map(r => ({
          hora: r.horario,
          titulo: `${r.nome} · Focus Fit`,
          corpo: 'Hora da sua refeição. Abra o app e marque o que comeu.',
          tag: 'refeicao'
        }));
    } catch (e) { return []; }
  },

  /* água: horários fixos espalhados no dia acordado. A meta em ml é a
     do perfil, então o lembrete fala o número dela, não um genérico. */
  _horasAgua() {
    let meta = 0;
    try { meta = Number(Store.db.perfil && Store.db.perfil.meta_agua) || 0; } catch (e) {}
    const alvo = meta ? (meta / 1000).toFixed(1).replace('.', ',') + ' L' : 'a sua meta';
    return AGUA_HORARIOS.map(hora => ({
      hora,
      titulo: 'Hora de beber água · Focus Fit',
      corpo: `Um copo agora e você segue no ritmo de ${alvo} hoje.`,
      tag: 'agua'                                  /* um só na bandeja, sem empilhar */
    }));
  },

  /* sono: um por noite, no horário do HORA_SONO */
  _horasSono() {
    return [{
      hora: HORA_SONO,
      titulo: 'Hora de desacelerar · Focus Fit',
      corpo: 'Comece a se preparar para dormir. O sono é parte do plano, igual ao treino.',
      tag: 'sono'
    }];
  },

  /* treino: só nos dias que TÊM treino, no horário que ela escolheu.
     Dia de descanso não cobra ninguém. `pos` é 0=Seg ... 6=Dom. */
  _itemTreino(pos) {
    const dia = Store.diasTreino()[pos];
    if (!dia || dia.descanso) return null;
    const hora = Store.horaTreino(pos);
    if (!hora) return null;
    return {
      hora,
      titulo: `Treino de ${dia.foco} · Focus Fit`,
      corpo: 'Seu horário de treino chegou. Abra o app e veja os exercícios de hoje.',
      tag: 'treino'
    };
  },

  _horasTreino() {
    try {
      const item = this._itemTreino(App.indiceHoje());
      return item ? [item] : [];
    } catch (e) { return []; }
  },

  /* tudo que ainda vai tocar hoje, já filtrado pelo que está ligado */
  agenda() {
    let lista = [];
    if (this.ligado('refeicao')) lista = lista.concat(this._horasRefeicao());
    if (this.ligado('agua'))     lista = lista.concat(this._horasAgua());
    if (this.ligado('sono'))     lista = lista.concat(this._horasSono());
    if (this.ligado('treino'))   lista = lista.concat(this._horasTreino());
    return lista;
  },

  /* a semana inteira, pro servidor de push: o mesmo de agenda(), mas o
     treino vai com o dia da semana dele (dias: [pos]), porque o
     servidor avisa em qualquer dia, não só hoje */
  agendaSemana() {
    let lista = [];
    if (this.ligado('refeicao')) lista = lista.concat(this._horasRefeicao());
    if (this.ligado('agua'))     lista = lista.concat(this._horasAgua());
    if (this.ligado('sono'))     lista = lista.concat(this._horasSono());
    if (this.ligado('treino')) {
      for (let pos = 0; pos < 7; pos++) {
        try {
          const item = this._itemTreino(pos);
          if (item) lista.push(Object.assign(item, { dias: [pos] }));
        } catch (e) {}
      }
    }
    return lista;
  },

  /* Conta quantos avisos ainda faltam hoje (é o número do toast) e, se
     o push não estiver confirmado, arma um setTimeout pra cada um. Em
     todo caso manda a agenda nova pro servidor. */
  agendar() {
    this.limpar();
    this._pedirSync();
    if (!this.permitido() || !this.algumLigado()) return 0;

    const agora = new Date();
    const local = !this.pushAtivo();
    let n = 0;
    this.agenda().forEach(av => {
      const [h, m] = String(av.hora).split(':').map(Number);
      if (isNaN(h)) return;
      const quando = new Date();
      quando.setHours(h, m || 0, 0, 0);
      const falta = quando - agora;
      if (falta <= 0) return;                      /* já passou hoje */
      n++;
      if (local) this._timers.push(setTimeout(() => this.disparar(av), falta));
    });
    return n;
  },

  /* ---------- PUSH ---------- */
  CHAVE_PUSH: 'focusfit_push',
  _timerPush: null,

  pushSuportado() {
    return this.suportado() && 'serviceWorker' in navigator && 'PushManager' in window &&
           typeof CONFIG !== 'undefined' && !!CONFIG.PUSH_VAPID_PUBLICA;
  },

  /* o servidor confirmou a inscrição deste aparelho */
  pushAtivo() {
    try { return !!localStorage.getItem(this.CHAVE_PUSH); } catch (e) { return false; }
  },

  /* agendar() é chamado em rajada (abrir o app, trocar três horários):
     junta tudo num envio só */
  _pedirSync() {
    clearTimeout(this._timerPush);
    this._timerPush = setTimeout(() => this.sincronizarPush(), 1500);
  },

  /* a chave pública VAPID vem em base64url; o navegador quer bytes */
  _bytes(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const bin = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  },

  async _registro() {
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, falha) => setTimeout(() => falha(new Error('service worker não respondeu')), 8000))
    ]);
  },

  /* Inscreve (se ainda não estiver) e manda a agenda. Sem login, sem
     permissão ou sem suporte, não faz nada e o aviso local segue. */
  async sincronizarPush() {
    if (!this.pushSuportado() || !this.permitido() || !Backend.ativo()) return false;
    try {
      const reg = await this._registro();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this._bytes(CONFIG.PUSH_VAPID_PUBLICA)
        });
      }
      const j = sub.toJSON();
      let fuso = 'America/Sao_Paulo';
      try { fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || fuso; } catch (e) {}
      const ok = await Backend.salvarPush({
        endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
        fuso, agenda: this.algumLigado() ? this.agendaSemana() : []
      });
      if (!ok) return false;
      const antes = this.pushAtivo();
      try { localStorage.setItem(this.CHAVE_PUSH, j.endpoint); } catch (e) {}
      if (!antes) this.limpar();                   /* dali pra frente quem avisa é o servidor */
      return true;
    } catch (e) {
      console.warn('Push indisponível, seguindo com o aviso local:', e && e.message);
      return false;
    }
  },

  /* ao sair da conta: este aparelho para de receber os avisos dela.
     Precisa rodar ANTES do signOut, enquanto ainda há sessão. */
  async pararPush() {
    try { localStorage.removeItem(this.CHAVE_PUSH); } catch (e) {}
    clearTimeout(this._timerPush);
    if (!this.pushSuportado()) return;
    try {
      const reg = await this._registro();
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      await Backend.removerPush(sub.endpoint);
      await sub.unsubscribe();
    } catch (e) { /* sem service worker ou sem rede: o servidor limpa quando der 410 */ }
  },

  /* a tela que cada lembrete abre no toque (o mesmo mapa do sw.js) */
  TELA: { treino: 'treinos', refeicao: 'alimentacao', agua: 'inicio', sono: 'inicio' },

  disparar(av) {
    if (!this.permitido()) return;
    try {
      const n = new Notification(av.titulo, {
        body: av.corpo,
        icon: 'logo-focusfit.png',
        tag: av.tag                                /* não empilha lembrete repetido */
      });
      n.onclick = () => {
        try { window.focus(); } catch (e) {}
        App.abrirDoAviso(this.TELA[av.tag] || 'inicio');
        n.close();
      };
    } catch (e) {}
  },

  /* ao reabrir o app: o que estava previsto e já passou hoje sem marcação */
  perdidasHoje() {
    const agora = new Date();
    const plano = (() => { try { return Store.planoAlimentar(); } catch (e) { return []; } })();
    return plano.filter(r => {
      if (!r.horario) return false;
      const [h, m] = String(r.horario).split(':').map(Number);
      if (isNaN(h)) return false;
      const quando = new Date();
      quando.setHours(h, m || 0, 0, 0);
      if (quando > agora) return false;
      const [marcados, total] = Store.progressoRefeicao(r);
      return total > 0 && marcados === 0;
    });
  }
};

window.Lembretes = Lembretes;

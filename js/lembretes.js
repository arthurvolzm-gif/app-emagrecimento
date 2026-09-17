/* =========================================================
   LEMBRETES DE REFEIÇÃO

   ⚠️ LEIA ANTES DE MEXER — o limite aqui é do navegador, não do código.
   Site não agenda notificação para disparar com ele FECHADO. A API que
   faria isso (Notification Triggers) não é suportada de forma confiável,
   e push de verdade exige servidor com chave VAPID e um service worker
   registrado. Então o que dá pra fazer hoje, honestamente, é:

     • app aberto (inclusive em segundo plano, aba minimizada): dispara
       na hora certa — é o caso de quem deixa o app aberto no celular;
     • app fechado: NÃO dispara. Ao reabrir, mostra o que perdeu.

   Quando existir o APK, o lembrete com app fechado vira código nativo do
   wrapper lendo os mesmos horários daqui. A parte de decidir QUANDO
   lembrar já está pronta e é o que se aproveita.
   ========================================================= */
const Lembretes = {
  CHAVE: 'focusfit_lembretes',
  _timers: [],

  suportado() {
    try { return typeof Notification !== 'undefined'; } catch (e) { return false; }
  },

  ligado() {
    try { return localStorage.getItem(this.CHAVE) === '1'; } catch (e) { return false; }
  },

  permitido() {
    return this.suportado() && Notification.permission === 'granted';
  },

  /* liga: pede permissão e só grava se a pessoa aceitar */
  async ligar() {
    if (!this.suportado()) return 'sem-suporte';
    let p = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission();
    if (p !== 'granted') return p === 'denied' ? 'negado' : 'cancelado';
    try { localStorage.setItem(this.CHAVE, '1'); } catch (e) {}
    this.agendar();
    return 'ok';
  },

  desligar() {
    try { localStorage.setItem(this.CHAVE, '0'); } catch (e) {}
    this.limpar();
  },

  limpar() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
  },

  /* horários vêm do próprio cardápio: o dado já existe, não invento nada */
  horarios() {
    try {
      return Store.planoAlimentar()
        .filter(r => r.horario)
        .map(r => ({ hora: r.horario, nome: r.nome }));
    } catch (e) { return []; }
  },

  /* um setTimeout por refeição que ainda não passou hoje */
  agendar() {
    this.limpar();
    if (!this.ligado() || !this.permitido()) return 0;

    const agora = new Date();
    let n = 0;
    this.horarios().forEach(({ hora, nome }) => {
      const [h, m] = String(hora).split(':').map(Number);
      if (isNaN(h)) return;
      const quando = new Date();
      quando.setHours(h, m || 0, 0, 0);
      const falta = quando - agora;
      if (falta <= 0) return;                      /* já passou hoje */
      n++;
      this._timers.push(setTimeout(() => this.disparar(nome), falta));
    });
    return n;
  },

  disparar(nome) {
    if (!this.permitido()) return;
    try {
      new Notification(`${nome} · Focus Fit`, {
        body: 'Hora da sua refeição. Abra o app e marque o que comeu.',
        icon: 'logo-focusfit.png',
        tag: 'refeicao'                            /* não empilha lembrete repetido */
      });
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

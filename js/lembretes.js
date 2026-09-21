/* =========================================================
   LEMBRETES NO CELULAR

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
     Dia de descanso não cobra ninguém. */
  _horasTreino() {
    try {
      const pos = App.indiceHoje();
      const dia = Store.diasTreino()[pos];
      if (!dia || dia.descanso) return [];
      const hora = Store.horaTreino(pos);
      if (!hora) return [];
      return [{
        hora,
        titulo: `Treino de ${dia.foco} · Focus Fit`,
        corpo: 'Seu horário de treino chegou. Abra o app e veja os exercícios de hoje.',
        tag: 'treino'
      }];
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

  /* um setTimeout por aviso que ainda não passou hoje */
  agendar() {
    this.limpar();
    if (!this.permitido() || !this.algumLigado()) return 0;

    const agora = new Date();
    let n = 0;
    this.agenda().forEach(av => {
      const [h, m] = String(av.hora).split(':').map(Number);
      if (isNaN(h)) return;
      const quando = new Date();
      quando.setHours(h, m || 0, 0, 0);
      const falta = quando - agora;
      if (falta <= 0) return;                      /* já passou hoje */
      n++;
      this._timers.push(setTimeout(() => this.disparar(av), falta));
    });
    return n;
  },

  disparar(av) {
    if (!this.permitido()) return;
    try {
      new Notification(av.titulo, {
        body: av.corpo,
        icon: 'logo-focusfit.png',
        tag: av.tag                                /* não empilha lembrete repetido */
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

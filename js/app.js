/* =========================================================
   APP — roteador, ações e inicialização
   ========================================================= */

/* Interruptor do login. Com true, o app abre direto no cadastro, sem
   pedir e-mail nem checar assinatura — é o modo de teste, pra olhar
   as telas sem precisar de conta. Troque para false quando quiser o
   fluxo real: e-mail → código → assinatura verificada. */
const PULAR_LOGIN = true;

/* Ordem das telas pra animação de troca saber o lado: quem está mais à
   frente na lista entra pela direita, quem está atrás entra pela esquerda.
   Tela que não está aqui (as abas de baixo) faz só um cruzamento.
   Mexeu no fluxo do onboarding? Mexa aqui junto. */
const ORDEM_TELAS = [
  'abertura', 'auth', 'codigo', 'recebendo', 'revisao',
  'criando', 'plano', 'cadastro', 'assinatura', 'inicio'
];

const App = {
  tela: 'inicio',
  passo: 1,
  diaTreino: 0,
  refAberta: null,
  busca: '',
  cat: 'Todos',
  exAberto: null,
  abaCardapio: 'cardapio',
  modoLocal: false,

  /* última tela realmente pintada — a animação de troca compara com ela
     pra não reanimar quando a mesma tela é redesenhada no lugar */
  telaPintada: undefined,

  /* ---------- inicialização ---------- */
  async iniciar() {
    Store.load();
    this.pintarNav();

    /* abertura: a mira cresce, encolhe e o resto da logo aparece em volta.
       O carregamento continua por baixo, então a animação não atrasa a
       entrada — quando ela acaba, a tela certa já está decidida. */
    this.tela = 'abertura';
    this.pintar();
    this.telaPintada = 'abertura';
    const abertura = new Promise(ok => setTimeout(ok, 2800));

    await Backend.carregarLib();
    const temBackend = Backend.init();

    /* se a pessoa chegou com ?quiz=TOKEN (link do fim do quiz), busca as
       respostas no Supabase e já deixa o cadastro pré-preenchido —
       funciona mesmo sem conta ainda, e mesmo vindo de outro aparelho/
       navegador (diferente do localStorage, que só funciona no mesmo). */
    await this.aplicarRespostasDoQuizViaLink();

    /* modo de teste (ver PULAR_LOGIN no topo do arquivo) */
    if (PULAR_LOGIN && !Store.temPerfil()) {
      this.tela = 'cadastro';
      this.modoLocal = true;
        this.diaTreino = this.indiceHoje();
      await abertura;
      await this.trocarDaAbertura();
      return;
    }

    if (temBackend) {
      const usuario = await Backend.sessao();
      if (usuario) {
        const remoto = await Backend.carregar();
        if (remoto && remoto.perfil) {
          Store.db = remoto;
          Store.save();
          this.tela = 'inicio';
        } else {
          this.tela = Store.temPerfil() ? 'inicio' : 'cadastro';
        }
        if (this.tela === 'inicio') await this.verificarAssinatura();
      } else {
        /* sem sessão: se já usava o app localmente, respeita o modo local */
        this.tela = Store.temPerfil() ? 'inicio' : 'auth';
        this.modoLocal = Store.temPerfil();
      }
    } else {
      this.tela = Store.temPerfil() ? 'inicio' : 'auth';
      this.modoLocal = true;
    }

    Lembretes.agendar();
    this.diaTreino = this.indiceHoje();
    await abertura;
    await this.trocarDaAbertura();
  },

  /* ---------- handoff do quiz via link (?quiz=TOKEN) ---------- */
  async aplicarRespostasDoQuizViaLink() {
    let token;
    try {
      const params = new URLSearchParams(location.search);
      token = params.get('quiz');
      if (!token) return;
      params.delete('quiz');
      const novaUrl = location.pathname + (params.toString() ? '?' + params.toString() : '');
      history.replaceState(null, '', novaUrl);   // tira o token da URL, não tenta de novo num F5
    } catch (e) { return; }

    try {
      const respostas = await Backend.buscarRespostasQuiz(token);
      if (!respostas) return;
      const campos = {};
      for (const k in Onb.dados) {
        if (respostas[k] !== undefined && respostas[k] !== null && respostas[k] !== '') campos[k] = String(respostas[k]);
      }
      Object.assign(Onb.dados, campos);
    } catch (e) { /* sem isso, o cadastro só fica sem pré-preenchimento */ }
  },

  /* ---------- assinatura (bloqueia telas internas sem pagamento ativo) ----------
     Só entra em ação com conta de verdade (Backend.ativo()) — quem usa
     "sem conta" continua liberado, é o modo gratuito/local já existente. */
  async verificarAssinatura() {
    if (!Backend.ativo()) return true;
    await Backend.vincularAssinatura();
    const a = await Backend.assinatura();
    if (Backend.assinaturaAtiva(a)) return true;
    this.assinaturaInfo = a;
    this.tela = 'assinatura';
    return false;
  },

  /* a barra de baixo é fixa no HTML; os ícones entram uma vez, aqui, pra
     não repetir SVG dentro do markup */
  pintarNav() {
    document.querySelectorAll('#nav .ic[data-ic]').forEach(el => {
      el.innerHTML = Ic[el.dataset.ic] ? Ic[el.dataset.ic](23) : '';
    });
  },

  /* ---------- render ----------
     render() é a porta: ela decide a animação de entrada e chama pintar(),
     que é quem realmente monta o HTML. Quem já chamava App.render() antes
     continua funcionando igual. */
  render() {
    const de   = this.telaPintada;
    const para = this.tela;
    this.pintar();
    this.telaPintada = this.tela;          /* pintar() pode ter trocado */
    if (de !== undefined && de !== this.telaPintada) this.animarTroca(de, this.telaPintada);
    this.boasVindas();
  },

  /* ---------- boas-vindas ----------
     Camada por cima da tela inicial. A tela é montada normalmente e fica
     escurecida atrás, então a pessoa já vê o app dela enquanto lê — e o
     "Continuar" libera, em vez de revelar algo que ela não viu. */
  boasVindas() {
    const bg = document.getElementById('bv-bg');
    if (!bg) return;
    const mostrar = this.tela === 'inicio' && Store.temPerfil() && Store.boasVindasPendente();

    if (!mostrar) {
      if (bg.classList.contains('on')) bg.classList.remove('on');
      bg.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('travado');
      return;
    }
    if (bg.classList.contains('on')) return;          /* já está aberta */

    bg.innerHTML = Telas.boasVindas(Store.db.perfil);
    bg.classList.add('on');
    bg.setAttribute('aria-hidden', 'false');
    document.body.classList.add('travado');           /* nada rola atrás */
  },

  /* ---------- animação de troca de tela ----------
     A direção sai da ORDEM_TELAS: avançou no fluxo, a tela entra pela
     direita; voltou, entra pela esquerda. Tela que não está no fluxo
     (as abas de baixo) faz só um cruzamento, sem lado. */
  animarTroca(de, para) {
    const app = document.getElementById('app');
    if (!app) return;
    const i = ORDEM_TELAS.indexOf(de), j = ORDEM_TELAS.indexOf(para);
    this.cascata(app, (i === -1 || j === -1) ? 0 : (j > i ? 28 : -28));
  },

  /* Põe cada pedaço da tela nova na fila de entrada, um atrás do outro.
     É a cascata que faz parecer que a página virou de verdade: se só o
     bloco inteiro deslizasse, a leitura seria de tela empurrada, não de
     conteúdo novo chegando.
     --lado diz de que direção cada elemento vem (0 = só sobe, pras abas
     de baixo), --i diz a vez dele. O índice trava em 9 pra tela comprida
     não levar uma eternidade pra assentar. */
  cascata(app, lado) {
    app.style.setProperty('--lado', lado + 'px');
    app.style.setProperty('--sobe', lado ? '0px' : '14px');
    this.elementosDaTela(app).forEach((el, i) => {
      el.style.setProperty('--i', Math.min(i, 9));
      el.classList.add('entra-el');
    });
    this.letrear(app);
  },

  /* O título grande da tela aparece letra por letra, no lugar de entrar
     como bloco. É o detalhe que faz a troca parecer uma virada de página
     e não um corte seco.
     Duas condições, pra não estragar nada: o título tem que ser texto
     puro (um nó de texto só, senão a marcação de dentro se perde) e tem
     que ser ele mesmo um item da cascata — se estivesse dentro de outro
     item, as letras subiriam junto com o bloco e ficaria embolado. */
  letrear(raiz, atraso) {
    const tt = raiz.querySelector('.login-h1');
    if (!tt) return;
    if (tt.childNodes.length !== 1 || tt.firstChild.nodeType !== 3) return;

    const texto = tt.textContent;
    if (texto.length > 40) return;

    if (atraso === undefined) {
      if (!tt.classList.contains('entra-el')) return;
      atraso = Number(tt.style.getPropertyValue('--i') || 0) * 45 + 40;
    }
    tt.classList.remove('entra-el');
    tt.style.setProperty('--atraso', atraso + 'ms');
    tt.setAttribute('aria-label', texto);          /* leitor de tela lê a frase, não as letras */
    tt.innerHTML = [...texto].map((c, i) => c === ' '
      ? ' '
      : `<span class="letra" style="--l:${i}" aria-hidden="true">${
          c.replace('&', '&amp;').replace('<', '&lt;')}</span>`).join('');
    tt.classList.add('letreando');
  },

  /* Onde estão "os elementos" muda com a tela, então a lista é montada
     aqui e não com um seletor só. Tela nova com outra estrutura? É este
     o lugar de ensinar onde olhar. */
  elementosDaTela(app) {
    /* telas escuras (login, código, perfil, plano): tudo mora dentro de
       .login-content, e o rodapé do suporte vem depois */
    const conteudo = app.querySelector('.login-content');
    if (conteudo) {
      const lista = [...conteudo.children];
      const rodape = app.querySelector('.login-footer');
      if (rodape) lista.push(rodape);
      return lista;
    }
    /* telas internas: o cabeçalho, e dentro de .tela cada cartão */
    const lista = [];
    for (const filho of app.children) {
      if (filho.classList.contains('tela')) lista.push(...filho.children);
      else lista.push(filho);
    }
    return lista;
  },

  /* ---------- saída da abertura ----------
     A abertura não desliza pro lado: ela vira uma capa preta por cima da
     tela seguinte e some. A capa é uma cópia parada do último quadro da
     animação (sem a classe .tocar), então não tem salto na troca. */
  async trocarDaAbertura() {
    const capa  = document.createElement('div');
    capa.className = 'capa-abertura';
    capa.innerHTML = '<div class="capa-fundo"></div>';

    /* A logo que vai voar é a PRÓPRIA da abertura, tirada de dentro do
       #app e pendurada na capa, não uma cópia: <img> novo precisa
       decodificar de novo e pisca no quadro da troca.
       Tirar .tocar é seguro: o último quadro da animação é igual ao
       estado natural do elemento (escala 1, recorte maior que a imagem,
       filtros neutros) — conferido, não chutado.
       Ela fica FORA do fundo preto porque é o fundo que desbota; se ela
       desbotasse junto, sumiria no meio do caminho e reapareceria de
       repente no destino. */
    const voando = document.querySelector('#app .abertura-logo');
    if (voando) {
      const r = voando.getBoundingClientRect();
      voando.classList.remove('tocar');
      voando.style.position = 'fixed';
      voando.style.left = r.left + 'px';
      voando.style.top  = r.top  + 'px';
      voando.style.margin = '0';
      capa.appendChild(voando);
    }
    document.body.appendChild(capa);

    this.pintar();
    this.telaPintada = this.tela;

    /* a marca não pisca duas vezes: a logo grande da capa é levada até o
       lugar exato da logo da tela seguinte (medido na hora, não chutado),
       e a de baixo só aparece quando a de cima já encaixou nela */
    const app   = document.getElementById('app');
    const tela  = document.querySelector('#app .tela-login');
    const marca = voando;
    if (tela) {
      /* o conteúdo do login entra em cascata igual às outras trocas, só
         que a logo fica de fora: ela vem voando da capa */
      tela.classList.add('entrando');
      [...tela.querySelectorAll('.login-content > *')]
        .filter(el => !el.classList.contains('login-logo'))
        .forEach((el, i) => el.style.setProperty('--i', i));
      const tt = tela.querySelector('.login-h1');
      if (tt) this.letrear(tela, 240 + Number(tt.style.getPropertyValue('--i') || 0) * 60);
    } else if (app) {
      this.cascata(app, 0);
    }
    if (tela && marca) {
      const alvo = tela.querySelector('.login-logo');
      if (alvo) {
        const a = alvo.getBoundingClientRect(), m = marca.getBoundingClientRect();
        marca.style.setProperty('--dx',  (a.left + a.width  / 2 - (m.left + m.width  / 2)) + 'px');
        marca.style.setProperty('--dy',  (a.top  + a.height / 2 - (m.top  + m.height / 2)) + 'px');
        marca.style.setProperty('--esc', a.width / m.width);
        capa.classList.add('juntando');
      }
    }

    capa.classList.add('saindo');
    await new Promise(ok => setTimeout(ok, 700));
    capa.remove();
  },

  pintar() {
    const app = document.getElementById('app');
    const nav = document.getElementById('nav');

    /* telas sem navegação inferior */
    if (this.tela === 'abertura')   { app.innerHTML = Onb.abertura();   nav.style.display = 'none'; Onb.animarAbertura(); return; }
    if (this.tela === 'auth')       { app.innerHTML = Onb.auth();       nav.style.display = 'none'; return; }
    if (this.tela === 'codigo')     { app.innerHTML = Onb.codigo();     nav.style.display = 'none'; return; }
    if (this.tela === 'recebendo')  { app.innerHTML = Onb.recebendo();  nav.style.display = 'none'; return; }
    if (this.tela === 'revisao')    { app.innerHTML = Onb.revisao();    nav.style.display = 'none'; return; }
    if (this.tela === 'criando')    { app.innerHTML = Onb.criando();    nav.style.display = 'none'; return; }
    if (this.tela === 'plano')      { app.innerHTML = Onb.plano();      nav.style.display = 'none'; return; }
    if (this.tela === 'cadastro')   { app.innerHTML = Onb.cadastro();   nav.style.display = 'none'; return; }
    if (this.tela === 'assinatura') { app.innerHTML = Onb.assinatura(); nav.style.display = 'none'; return; }

    if (!Store.temPerfil()) { this.tela = 'cadastro'; return this.pintar(); }

    const fn = Telas[this.tela] || Telas.inicio;
    app.innerHTML = fn.call(Telas);

    /* telas internas ocupam a tela inteira, sem a barra de navegação */
    const internas = ['biblioteca', 'cardapio', 'resumo', 'fotos'];
    nav.style.display = internas.includes(this.tela) ? 'none' : 'flex';
    document.querySelectorAll('.nav button').forEach(b => {
      b.classList.toggle('on', b.dataset.tela === this.tela);
    });
  },

  ir(tela) {
    this.tela = tela;
    if (tela === 'treinos') this.diaTreino = this.indiceHoje();
    this.render();
    window.scrollTo(0, 0);
  },

  /* ---------- lembretes de refeição ---------- */
  async alternarLembretes() {
    if (Lembretes.ligado() && Lembretes.permitido()) {
      Lembretes.desligar();
      this.render();
      return this.toast('Lembretes desligados.');
    }
    const r = await Lembretes.ligar();
    this.render();
    if (r === 'ok') {
      const n = Lembretes.agendar();
      return this.toast(n ? `Pronto. ${n} ${n === 1 ? 'lembrete' : 'lembretes'} hoje. 🔔`
                          : 'Pronto. Os lembretes começam amanhã. 🔔', true);
    }
    if (r === 'negado') return this.toast('O celular bloqueou as notificações. Libere nas configurações do navegador.');
    if (r === 'sem-suporte') return this.toast('Este navegador não faz notificações.');
    this.toast('Lembretes não foram ligados.');
  },

  /* ---------- fotos de progresso ----------
     A tela é a única do app que depende de leitura assíncrona: o
     IndexedDB responde depois do render. Por isso ela pinta o esqueleto
     e preenche a lista em seguida, em vez de segurar a navegação. */
  _fotoUrls: {},

  abrirFotos() {
    this.ir('fotos');
    this.pintarFotos();
  },

  async pintarFotos() {
    const alvo = document.getElementById('foto-lista');
    if (!alvo) return;
    if (!Fotos.disponivel()) {
      alvo.innerHTML = `<div class="card"><div class="rev-vazio">Este navegador não guarda fotos.</div></div>`;
      return;
    }
    try {
      /* solta as URLs da pintura anterior pra não vazar memória */
      Object.values(this._fotoUrls).forEach(u => URL.revokeObjectURL(u));
      this._fotoUrls = {};

      const lista = await Fotos.listar();
      lista.forEach(f => { this._fotoUrls[f.data] = URL.createObjectURL(f.blob); });
      alvo.innerHTML = Telas._fotosConteudo(lista, this._fotoUrls);
    } catch (e) {
      alvo.innerHTML = `<div class="card"><div class="rev-vazio">Não consegui abrir suas fotos neste aparelho.</div></div>`;
    }
  },

  async salvarFoto(input) {
    const arquivo = input.files && input.files[0];
    input.value = '';
    if (!arquivo) return;
    try {
      /* aproveita a última pesagem pra dar contexto à foto */
      const ult = Store.db.pesagens[Store.db.pesagens.length - 1];
      await Fotos.salvar(arquivo, ult ? ult.peso : null);
      await this.pintarFotos();
      this.toast('Foto guardada neste aparelho. 📸', true);
    } catch (e) {
      this.toast('Não consegui guardar essa foto.');
    }
  },

  async apagarFoto(data) {
    if (!confirm('Apagar esta foto? Não dá pra desfazer.')) return;
    try {
      await Fotos.apagar(data);
      await this.pintarFotos();
      this.toast('Foto apagada.');
    } catch (e) { this.toast('Não consegui apagar.'); }
  },

  /* ---------- dia fora da rotina ---------- */
  marcarForaDaRotina() {
    const ligou = Store.alternarForaDaRotina();
    Backend.agendarSync();
    this.render();
    this.toast(ligou ? 'Dia marcado. Aproveite sem culpa. 🎉'
                     : 'Voltou a ser um dia normal.', ligou);
  },

  /* ---------- resumo de domingo ---------- */
  fecharResumo() {
    Store.marcarResumoVisto();
    Backend.agendarSync();
    this.ir('inicio');
  },

  /* ---------- boas-vindas ---------- */
  fecharBoasVindas() {
    const bg = document.getElementById('bv-bg');
    Store.fecharBoasVindas();
    Backend.agendarSync();
    document.body.classList.remove('travado');
    /* deixa a saída acontecer antes de tirar a camada do caminho */
    if (bg) {
      bg.classList.add('saindo');
      setTimeout(() => {
        bg.classList.remove('on', 'saindo');
        bg.innerHTML = '';
        bg.setAttribute('aria-hidden', 'true');
      }, 320);
    }
  },

  /* "Como usar o app", na aba de Perfil: reabre a mensagem e leva pra
     tela inicial, que é onde ela mora */
  verBoasVindas() {
    if (Store.db.perfil) { Store.db.perfil.boas_vindas_visto = false; Store.save(); }
    Backend.agendarSync();
    this.ir('inicio');            /* o render de lá reabre a camada */
  },

  /* ---------- ações do dia ---------- */
  agua(ml) {
    const antes = Store.dia().agua;
    Store.addAgua(ml);
    Backend.agendarSync();
    const p = Store.db.perfil;
    const depois = Store.dia().agua;
    this.render();
    if (this.checarNivel()) return;
    if (antes < p.meta_agua && depois >= p.meta_agua) this.toast('Meta de água batida! +20 pontos 💧', true);
  },

  marcarTreino() {
    if (!Store.concluirTreino()) return;      // já estava concluído, ignora
    Backend.agendarSync();
    this.render();
    if (this.checarNivel()) return;
    this.toast('Treino concluído! +40 pontos 🏋️', true);
    /* deixa o toast aparecer sozinho antes de puxar a pergunta */
    setTimeout(() => this.perguntarEsforco(), 900);
  },

  /* ---------- como foi o treino ----------
     Uma pergunta de três opções logo depois de marcar o treino. É o único
     jeito barato de saber se a carga está certa: a pessoa responde no
     calor do momento, em um toque, e não precisa anotar nada. */
  perguntarEsforco() {
    this.modal(`
      <h3 class="display">Como foi o treino?</h3>
      <p class="m-sub">Sua resposta ajusta a carga que o app vai sugerir. Um toque e pronto.</p>
      <div class="esforco-fila">
        <button class="esforco-op" onclick="App.salvarEsforco('leve')">
          <span class="e">🙂</span><span class="t">Leve</span>
          <span class="s">Daria pra fazer mais</span>
        </button>
        <button class="esforco-op" onclick="App.salvarEsforco('ponto')">
          <span class="e">💪</span><span class="t">No ponto</span>
          <span class="s">Exigiu, mas deu certo</span>
        </button>
        <button class="esforco-op" onclick="App.salvarEsforco('pesado')">
          <span class="e">🥵</span><span class="t">Pesado</span>
          <span class="s">Não terminei as séries</span>
        </button>
      </div>
      <button class="btn sec" onclick="App.fecharModal()">Responder depois</button>
    `);
  },

  salvarEsforco(nivel) {
    Store.registrarEsforco(nivel);
    Backend.agendarSync();
    this.fecharModal();
    this.render();
    const fala = { leve: 'Anotado. Vamos subir a carga.',
                   ponto: 'Esse é o ponto certo. Continua assim.',
                   pesado: 'Anotado. Segura a carga por enquanto.' };
    this.toast(fala[nivel] || 'Anotado.', true);
  },

  marcarAlimento(refId, alimId) {
    Store.alternarAlimento(refId, alimId);
    Backend.agendarSync();
    const ref = Store.planoAlimentar().find(r => r.id === refId);
    const [m, t] = Store.progressoRefeicao(ref);
    this.render();
    if (this.checarNivel()) return;
    if (m === t) this.toast(`${ref.nome} completa! +10 pontos ✅`, true);
  },

  refeicaoToda(refId, marcar) {
    Store.marcarRefeicaoToda(refId, marcar);
    Backend.agendarSync();
    this.render();
    if (this.checarNivel()) return;
    if (marcar) this.toast('Refeição marcada como feita ✅', true);
  },

  abrirRef(id) {
    this.refAberta = this.refAberta === id ? null : id;
    this.render();
  },

  selDia(i) { this.diaTreino = i; this.render(); },

  /* ---------- organização da semana ---------- */

  /* folha de escolha do treino de um dia. Substitui o <select> nativo,
     que o navegador desenha do jeito dele e ignora o tema do app. */
  abrirDiaTreino(posicao) {
    const plano  = Store.planoTreino();
    const ordem  = Store.ordemTreino();
    const atual  = ordem[posicao];

    let nDesc = 0;
    const rotulos = plano.dias.map(d => d.descanso ? `Descanso ${++nDesc}` : d.foco);

    this.modal(`
      <h3 class="display">${DIAS_SEMANA_LONGO[posicao]}</h3>
      <p class="m-sub">Escolha o que fica neste dia. O treino que estiver aqui hoje vai para o dia de onde você tirou o novo, então a semana mantém o mesmo volume.</p>

      <div class="troca-lista">
        ${plano.dias.map((op, idx) => {
          const onde = ordem.indexOf(idx);
          const ehAtual = idx === atual;
          const dia = DIAS_SEMANA_LONGO[onde];
          /* Sábado e Domingo são masculinos: "no Sábado", não "na Sábado" */
          const em = (dia === 'Sábado' || dia === 'Domingo' ? 'no ' : 'na ') + dia;
          return `
            <button class="troca-op ${ehAtual ? 'on' : ''}" onclick="App.escolherDiaTreino(${posicao}, ${idx})">
              <span class="to-check">${ehAtual ? '✓' : ''}</span>
              <span class="to-txt">
                <b>${rotulos[idx]}</b>
                <small>${
                  ehAtual
                    ? 'É o que está neste dia'
                    : op.descanso
                      ? `Dia de descanso · está ${em}`
                      : `${op.exercicios.length} exercícios · está ${em}`
                }</small>
              </span>
            </button>`;
        }).join('')}
      </div>

      <button class="btn sec" onclick="App.fecharModal()">Cancelar</button>
    `);
  },

  escolherDiaTreino(posicao, idxTreino) {
    this.fecharModal();
    this.trocarDiaTreino(posicao, idxTreino);
  },

  trocarDiaTreino(posicao, idxTreino) {
    const trocou = Store.trocarDiaTreino(posicao, idxTreino);
    Backend.agendarSync();
    this.render();
    if (trocou) this.toast('Semana reorganizada ✅', true);
  },

  restaurarOrdem() {
    Store.restaurarOrdemTreino();
    Backend.agendarSync();
    this.render();
    this.toast('Ordem original do plano restaurada');
  },

  /* ---------- cargas dos exercícios ---------- */
  /* recebe a posição do exercício no treino do dia e devolve o nome,
     que é a chave usada para guardar o histórico de carga */
  nomeExercicio(i) {
    const dia = Store.diasTreino()[this.diaTreino];
    return dia && dia.exercicios && dia.exercicios[i] ? dia.exercicios[i].ex : null;
  },

  abrirEx(i) {
    const nome = this.nomeExercicio(i);
    if (!nome) return;
    this.exAberto = this.exAberto === nome ? null : nome;
    this.render();
  },

  salvarCarga(i) {
    const nome = this.nomeExercicio(i);
    if (!nome) return;
    const peso = parseFloat(document.getElementById('carga-peso').value);
    const reps = parseInt(document.getElementById('carga-reps').value, 10);
    if (isNaN(peso) || peso < 0 || peso > 1000) return this.toast('Digite uma carga válida.');

    const anterior = Store.ultimaCarga(nome);
    Store.registrarCarga(nome, peso, reps);
    Backend.agendarSync();
    this.exAberto = null;
    this.render();

    if (anterior && peso > anterior.peso) {
      this.toast(`Subiu de ${anterior.peso}kg para ${peso}kg! 💪`, true);
    } else {
      this.toast('Carga registrada ✅', true);
    }
  },
  setAbaCardapio(a) { this.abaCardapio = a; this.render(); window.scrollTo(0, 0); },
  setCat(c) { this.cat = c; this.render(); },

  buscar(v) {
    this.busca = v;
    const pos = document.querySelector('.busca').selectionStart;
    this.render();
    const inp = document.querySelector('.busca');
    if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
  },

  /* ---------- subida de nível ----------
     Chamado depois de toda ação que dá pontos. Se a pessoa cruzou
     a faixa de um nível novo, a comemoração entra no lugar do toast. */
  checarNivel() {
    const novo = Store.nivelPendente();
    if (!novo) return false;
    Store.marcarNivelVisto(novo.n);
    Backend.agendarSync();
    setTimeout(() => this.mostrarNivelUp(novo), 260);
    return true;
  },

  mostrarNivelUp(nv) {
    const el = document.getElementById('nivelup');
    const cores = [nv.cor2, '#FFFFFF', nv.cor1, '#FFD86B', nv.cor2];

    /* confete: cada pedaço com posição, atraso, giro e forma próprios */
    let confete = '';
    for (let i = 0; i < 46; i++) {
      const cor = cores[i % cores.length];
      const esq = Math.random() * 100;
      const atraso = Math.random() * 0.7;
      const dur = 1.9 + Math.random() * 1.4;
      const larg = 6 + Math.random() * 7;
      const alt = larg * (0.5 + Math.random());
      const giro = (Math.random() * 900 - 450).toFixed(0);
      const desvio = (Math.random() * 120 - 60).toFixed(0);
      const redondo = i % 4 === 0 ? '50%' : '2px';
      confete += `<i style="left:${esq}%;background:${cor};width:${larg}px;height:${alt}px;
                    border-radius:${redondo};animation-delay:${atraso}s;animation-duration:${dur}s;
                    --giro:${giro}deg;--desvio:${desvio}px"></i>`;
    }

    el.innerHTML = `
      <div class="nu-brilho" style="background:radial-gradient(circle at 50% 42%, ${nv.cor2}55 0%, transparent 62%)"></div>
      <div class="nu-confete">${confete}</div>

      <div class="nu-caixa">
        <div class="nu-selo-area">
          <span class="nu-anel" style="border-color:${nv.cor2}"></span>
          <span class="nu-anel a2" style="border-color:${nv.cor2}"></span>
          <span class="nu-anel a3" style="border-color:${nv.cor2}"></span>
          <div class="nu-raios">${Array.from({length:12},(_, i)=>
            `<b style="transform:rotate(${i*30}deg);background:linear-gradient(to top, transparent, ${nv.cor2})"></b>`).join('')}</div>
          <div class="nu-halo" style="background:radial-gradient(circle, ${nv.cor2} 0%, transparent 70%)"></div>
          <div class="nu-selo" style="--brilho:${nv.cor2}90">${nv.icone}</div>
        </div>

        <div class="nu-tag">${nv.n === 1 ? 'Seu plano está pronto' : 'Você subiu de nível'}</div>
        <div class="nu-nome" style="background:linear-gradient(100deg, ${nv.cor2}, #fff);
             -webkit-background-clip:text;background-clip:text;color:transparent">${nv.nome}</div>
        <div class="nu-n">Nível ${nv.n} de ${NIVEIS.length} · ${nv.pontos} pontos</div>
        <p class="nu-frase">${nv.frase}</p>

        ${nv.proximo ? `
          <div class="nu-prox">
            Próximo: <b>${nv.proximo.nome}</b> ${nv.proximo.icone} em mais ${nv.faltam} pontos
          </div>` : `
          <div class="nu-prox">Você chegou ao último nível. 👑</div>`}

        <button class="nu-btn" onclick="App.fecharNivelUp()">Continuar</button>
      </div>`;

    el.classList.add('on');
  },

  fecharNivelUp() {
    const el = document.getElementById('nivelup');
    el.classList.add('saindo');
    setTimeout(() => {
      el.className = 'nivelup';
      el.innerHTML = '';
      this.render();
    }, 320);
  },

  /* ---------- modais ---------- */
  modal(html) {
    const bg = document.getElementById('modal-bg');
    document.getElementById('modal').innerHTML = `<div class="modal-puxador"></div>` + html;
    bg.classList.add('on');
  },

  fecharModal() { document.getElementById('modal-bg').classList.remove('on'); },

  /* ---------- troca de alimento ---------- */
  abrirTroca(idx) {
    const lista = Store.alimentosTrocaveis();
    const a = lista[idx];
    if (!a) return;
    const atual = Store.trocaDe(a.nome);

    this.modal(`
      <h3 class="display">${a.nome}</h3>
      <p class="m-sub">Escolha o que você prefere comer no lugar. A escolha vale para o cardápio e para a lista de compras.</p>

      <div class="troca-lista">
        <button class="troca-op ${atual === null ? 'on' : ''}" onclick="App.escolherTroca(${idx}, null)">
          <span class="to-check">${atual === null ? '✓' : ''}</span>
          <span class="to-txt">
            <b>${a.nome}</b>
            <small>${/vontade|se quiser/i.test(a.un) ? a.un : a.g + 'g · ' + a.un} · opção original</small>
          </span>
        </button>

        ${a.alt.map((op, i) => `
          <button class="troca-op ${atual === i ? 'on' : ''}" onclick="App.escolherTroca(${idx}, ${i})">
            <span class="to-check">${atual === i ? '✓' : ''}</span>
            <span class="to-txt"><b>${op}</b></span>
          </button>`).join('')}
      </div>

      <p class="troca-nota">As opções foram montadas como porções equivalentes, então as calorias e a proteína do dia continuam as mesmas.</p>
      <button class="btn sec" style="margin-top:14px" onclick="App.fecharModal()">Fechar</button>
    `);
  },

  escolherTroca(idx, opcao) {
    const a = Store.alimentosTrocaveis()[idx];
    if (!a) return;
    Store.definirTroca(a.nome, opcao);
    Backend.agendarSync();
    this.fecharModal();
    this.render();
    this.toast(opcao === null ? `Voltou para ${a.nome}` : `Trocado por ${a.alt[opcao]}`, true);
  },

  abrirSono() {
    const atual = Store.dia().sono || '';
    this.modal(`
      <h3 class="display">Quanto você dormiu?</h3>
      <p class="m-sub">Registre as horas de sono da noite passada.</p>
      <div class="campo">
        <label>Horas de sono</label>
        <input id="m-sono" type="number" inputmode="decimal" step="0.5" placeholder="Ex: 7.5" value="${atual}">
      </div>
      <button class="btn" onclick="App.salvarSono()">Salvar</button>
      <div style="height:10px"></div>
      <button class="btn sec" onclick="App.fecharModal()">Cancelar</button>
    `);
    setTimeout(() => document.getElementById('m-sono').focus(), 120);
  },

  salvarSono() {
    const v = parseFloat(document.getElementById('m-sono').value);
    if (isNaN(v)) return;
    const p = Store.db.perfil;
    const antes = Store.dia().sono;
    Store.setSono(v);
    Backend.agendarSync();
    this.fecharModal();
    this.render();
    if (this.checarNivel()) return;
    if (antes < p.meta_sono && v >= p.meta_sono) this.toast('Meta de sono batida! +20 pontos 😴', true);
  },

  abrirPeso() {
    this.modal(`
      <h3 class="display">Registrar pesagem</h3>
      <p class="m-sub">Pese-se sempre no mesmo horário, de preferência em jejum.</p>
      <div class="campo">
        <label>Peso de hoje (kg)</label>
        <input id="m-peso" type="number" inputmode="decimal" step="0.1" placeholder="Ex: 79.8" value="${Store.db.perfil.peso_atual}">
      </div>
      <button class="btn" onclick="App.salvarPeso()">Salvar pesagem</button>
      <div style="height:10px"></div>
      <button class="btn sec" onclick="App.fecharModal()">Cancelar</button>
    `);
    setTimeout(() => document.getElementById('m-peso').select(), 120);
  },

  salvarPeso() {
    const v = parseFloat(document.getElementById('m-peso').value);
    if (isNaN(v) || v < 35 || v > 300) return this.toast('Digite um peso válido.');
    Store.registrarPeso(v);
    Backend.agendarSync();
    this.fecharModal();
    this.render();
    if (this.checarNivel()) return;
    this.toast('Pesagem registrada! +15 pontos ⚖️', true);
  },

  abrirEditar() {
    const p = Store.db.perfil;
    this.modal(`
      <h3 class="display">Editar meus dados</h3>
      <p class="m-sub">Ao mudar peso, altura, idade ou objetivo, suas metas são recalculadas.</p>

      <div class="campo"><label>Nome</label><input id="e-nome" value="${p.nome}"></div>
      <div class="campo"><label>Idade</label><input id="e-idade" type="number" value="${p.idade}"></div>
      <div class="campo"><label>Altura (cm)</label><input id="e-altura" type="number" value="${p.altura}"></div>
      <div class="campo"><label>Meta de peso (kg)</label><input id="e-meta" type="number" step="0.1" value="${p.meta_peso}"></div>

      <div class="campo">
        <label>Objetivo</label>
        <select id="e-objetivo">
          <option value="emagrecimento" ${p.objetivo==='emagrecimento'?'selected':''}>Emagrecimento</option>
          <option value="hipertrofia" ${p.objetivo==='hipertrofia'?'selected':''}>Hipertrofia</option>
          <option value="manutencao" ${p.objetivo==='manutencao'?'selected':''}>Manutenção</option>
        </select>
      </div>

      <div class="campo">
        <label>Local de treino</label>
        <select id="e-local">
          <option value="academia" ${p.local==='academia'?'selected':''}>Academia</option>
          <option value="casa" ${p.local==='casa'?'selected':''}>Em casa</option>
        </select>
      </div>

      <div class="campo">
        <label>Treinos indicados para</label>
        <select id="e-sexo">
          <option value="feminino" ${p.sexo==='feminino'?'selected':''}>Mulher</option>
          <option value="masculino" ${p.sexo==='masculino'?'selected':''}>Homem</option>
        </select>
      </div>

      <button class="btn" onclick="App.salvarEdicao()">Salvar alterações</button>
      <div style="height:10px"></div>
      <button class="btn sec" onclick="App.fecharModal()">Cancelar</button>
    `);
  },

  salvarEdicao() {
    const v = id => document.getElementById(id).value;
    Store.atualizarPerfil({
      nome: v('e-nome').trim() || Store.db.perfil.nome,
      idade: Number(v('e-idade')),
      altura: Number(v('e-altura')),
      meta_peso: Number(v('e-meta')),
      objetivo: v('e-objetivo'),
      local: v('e-local'),
      sexo: v('e-sexo')
    });
    Backend.agendarSync();
    this.fecharModal();
    this.diaTreino = this.indiceHoje();
    this.render();
    this.toast('Dados atualizados e metas recalculadas ✅', true);
  },

  /* ---------- conta ---------- */

  /* Entrou de verdade (código do e-mail confirmado). Daqui decide pra
     onde a pessoa vai: quem já tem plano salvo na nuvem cai no início,
     quem nunca preencheu vai pro cadastro — e aí tentamos preencher
     sozinho com o que ela respondeu no quiz. */
  async entrarComSessao() {
    const remoto = await Backend.carregar();

    if (remoto && remoto.perfil) {
      Store.db = remoto;
      Store.save();
      this.tela = 'inicio';
      await this.verificarAssinatura();   // pode trocar pra 'assinatura' se não houver pagamento ativo
        this.diaTreino = this.indiceHoje();
      this.render();
      return;
    }

    /* conta sem plano ainda: mostra a tela de carregamento enquanto busca
       as respostas do quiz por e-mail (funciona no APK e em outro aparelho,
       porque não depende do link com token) e depois abre a revisão. */
    Store.resetar();
    this.tela = 'recebendo';
    this.render();

    const buscando = this.aplicarRespostasDoQuizPorEmail();
    /* o giro fica um tempo mínimo na tela mesmo se a busca voltar na hora:
       piscar e sumir passa a impressão de que nada foi carregado */
    await Promise.all([buscando, new Promise(ok => setTimeout(ok, 1800))]);

    if (!this.dadosDoQuizChegaram()) {
      /* sem respostas do quiz não há o que revisar: segue pelo cadastro */
      this.tela = 'cadastro';
      this.passo = 1;
      this.render();
      return;
    }

    this.tela = 'revisao';
    this.render();
  },

  /* veio alguma resposta do quiz? (só o e-mail não conta) */
  dadosDoQuizChegaram() {
    return ['sexo', 'idade', 'altura', 'peso', 'objetivo'].some(k => Onb.dados[k]);
  },

  async aplicarRespostasDoQuizPorEmail() {
    try {
      const respostas = await Backend.buscarRespostasQuizPorEmail();
      if (!respostas) return;
      const campos = {};
      for (const k in Onb.dados) {
        if (respostas[k] !== undefined && respostas[k] !== null && respostas[k] !== '') campos[k] = String(respostas[k]);
      }
      Object.assign(Onb.dados, campos);
    } catch (e) { /* sem isso, o cadastro só fica sem pré-preenchimento */ }
  },

  usarLocal() {
    this.modoLocal = true;
    this.tela = Store.temPerfil() ? 'inicio' : 'cadastro';
    this.passo = 1;
    this.render();
  },

  async sair() {
    if (!confirm('Sair da sua conta? Seus dados continuam salvos na nuvem.')) return;
    await Backend.salvar();
    await Backend.sair();
    Store.resetar();
    this.tela = 'auth';
    Onb.emailPendente = '';
    Onb.erro = '';
    this.render();
  },

  resetar() {
    if (!confirm('Apagar todos os seus dados deste aparelho? Isso não tem volta.')) return;
    Store.resetar();
    this.tela = 'cadastro';
    this.passo = 1;
    Onb.dados = { nome:'', idade:'', sexo:'', peso:'', altura:'', meta_peso:'', objetivo:'', local:'' };
    this.render();
  },

  /* ---------- helpers ---------- */
  saudacao() {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  },

  /* 0=Seg ... 6=Dom, alinhado com a ordem do plano de treino */
  indiceHoje() {
    const d = new Date().getDay();      // 0=Dom
    return d === 0 ? 6 : d - 1;
  },

  treinoDeHoje() {
    return Store.planoTreino().dias[this.indiceHoje()];
  },

  rotuloObjetivo() {
    const o = Store.db.perfil.objetivo;
    return o === 'emagrecimento' ? 'Emagrecimento'
         : o === 'hipertrofia'   ? 'Hipertrofia'
         : 'Manutenção';
  },

  iconeCat(c) {
    return { Pernas:'🦵', Glúteos:'🍑', Costas:'🔙', Peito:'💪', Ombro:'🤸',
             Braço:'💪', Abdômen:'🎯', Cardio:'🔥' }[c] || '🏋️';
  },

  dataBr(iso) {
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  },

  dataCurta(iso) {
    const [, m, d] = iso.split('-');
    const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    return `${d} ${meses[Number(m) - 1]}`;
  },

  toast(msg, verde) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast on' + (verde ? ' verde' : '');
    clearTimeout(this._tToast);
    this._tToast = setTimeout(() => { t.className = 'toast'; }, 2600);
  }
};

/* salva pendências ao sair da página */
window.addEventListener('pagehide', () => { if (Backend.ativo()) Backend.salvar(); });

document.addEventListener('DOMContentLoaded', () => App.iniciar());

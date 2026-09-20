/* =========================================================
   APP — roteador, ações e inicialização
   ========================================================= */

/* Interruptor do login.
   false = fluxo real: e-mail → código de 6 números → assinatura conferida.
   true  = modo de teste, abre direto no cadastro sem pedir nada.
   ⚠️ NUNCA publicar com true: o app fica liberado pra qualquer um que
   souber o link, sem passar pela compra. */
const PULAR_LOGIN = false;

/* Ordem das telas pra animação de troca saber o lado: quem está mais à
   frente na lista entra pela direita, quem está atrás entra pela esquerda.
   Tela que não está aqui (as abas de baixo) faz só um cruzamento.
   Mexeu no fluxo do onboarding? Mexa aqui junto. */
const ORDEM_TELAS = [
  'abertura', 'auth', 'codigo', 'recebendo', 'revisao',
  'criando', 'plano', 'cadastro', 'assinatura', 'reajuste', 'inicio'
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

  /* Plano Duo: o retrato que o banco devolve (vagas, quem está na vaga,
     quem convidou). null = ainda não consultado. Ver App.carregarDuo. */
  duo: null,
  duoErro: '',

  /* Modo Corrida: qual botão da aba Treinos está ativo, e a lista de
     produtos extras que a pessoa comprou (vem do banco, não do
     aparelho — ver App.carregarExtras). null = ainda não consultado. */
  abaTreinos: 'treino',
  camada: false,        /* uma camada (não a de boas-vindas) está aberta */
  foraAberta: false,    /* o cartão do dia fora da rotina está expandido */
  extras: null,

  /* a virada de mês: o resultado de Store.fecharReajuste(), guardado
     enquanto a tela está aberta */
  reajusteDados: null,

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
        } else if (Store.temPerfil()) {
          this.tela = 'inicio';
        } else {
          /* conta de verdade, ainda sem plano: cai na mesma tela "Seu
             perfil" do login — preenchida pra quem fez o quiz com este
             e-mail, em branco pra quem não fez (é o caso de quem entrou
             pela vaga do Plano Duo). A busca roda enquanto a animação de
             abertura está na tela, então não atrasa nada. */
          await this.aplicarRespostasDoQuizPorEmail();
          this.setarModoDoPerfil();
          this.tela = 'revisao';
        }
        if (this.tela === 'inicio') await this.verificarAssinatura();
        /* os extras vêm antes da virada de mês: é a lista deles que diz
           se ela vê o reajuste completo ou a versão com a oferta */
        if (this.tela === 'inicio') { await this.carregarExtras(); this.checarReajuste(); }
        /* o Duo vai sem await: a caixa de notificações consulta App.duo
           e, quando a resposta chega, o próximo render já a inclui. Não
           vale segurar a abertura do app por causa de uma oferta. */
        if (this.tela === 'inicio') this.carregarDuo();
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
    /* guarda sempre, não só quando está vencida: é daqui que sai o
       `tem_videos`, que é o order bump dos vídeos de execução */
    this.assinaturaInfo = a;
    if (Backend.assinaturaAtiva(a)) return true;
    this.tela = 'assinatura';
    return false;
  },

  /* ---------- VÍDEOS DE EXECUÇÃO (order bump) ----------
     O bump entra na mesma assinatura do plano, então o acesso vale
     enquanto a assinatura estiver ativa: não tem validade própria.

     Sem conta (modo local) fica liberado, que é o mesmo critério do
     resto do app: quem não tem backend não tem o que travar. */
  temVideos() {
    if (!Backend.ativo()) return true;
    const a = this.assinaturaInfo;
    return !!(a && a.tem_videos);
  },

  /* A marca no cabeçalho, em dois arranjos:
     - na Início, o cabeçalho já tem a saudação de um lado e o sino do
       outro, então ela ocupa o meio que sobra entre os dois;
     - nas outras abas ela fica sozinha numa faixa acima, e o título só
       começa depois dela. O cabeçalho vira duas etapas em vez de uma
       linha cheia, e o título volta ao tamanho maior porque não disputa
       mais espaço com ela.
     Entra aqui, depois do render, e não no markup de cada tela: são oito
     cabeçalhos, e assim a próxima tela já nasce com ela. */
  pintarMarcaTopo() {
    const app = document.getElementById('app');
    const topo = app && app.querySelector('.topo');
    if (!topo || app.querySelector('.topo-marca, .marca-linha')) return;

    const img = document.createElement('img');
    img.src = 'logo-focusfit.png';
    img.alt = 'Focus Fit';

    if (this.tela === 'inicio') {
      img.className = 'topo-marca';
      topo.insertBefore(img, topo.children[1] || null);
      return;
    }

    const faixa = document.createElement('div');
    faixa.className = 'marca-linha';
    faixa.appendChild(img);
    topo.parentNode.insertBefore(faixa, topo);
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
    this.pintarMarcaTopo();
    this.telaPintada = this.tela;          /* pintar() pode ter trocado */
    if (de !== undefined && de !== this.telaPintada) this.animarTroca(de, this.telaPintada);
    this.boasVindas();
  },

  /* Concordância de gênero. O app fala direto com a pessoa e o perfil já
     guarda o sexo, então não custa acertar: sem isso, metade das pessoas
     é tratada no gênero errado. Na dúvida (perfil ainda não criado), cai
     no feminino, que é o público principal. */
  gen(fem, masc) {
    return (Store.db && Store.db.perfil && Store.db.perfil.sexo === 'masculino') ? masc : fem;
  },

  /* ---------- boas-vindas ----------
     Camada por cima da tela inicial. A tela é montada normalmente e fica
     escurecida atrás, então a pessoa já vê o app dela enquanto lê — e o
     "Continuar" libera, em vez de revelar algo que ela não viu. */
  boasVindas() {
    const bg = document.getElementById('bv-bg');
    if (!bg) return;
    if (this.camada) return;          /* outra camada está usando o mesmo elemento */
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
    /* As letras vão agrupadas por PALAVRA, não soltas. Cada letra é um
       inline-block, e inline-block solto pode quebrar linha em qualquer
       ponto — foi assim que "reajustado" virou "reaj / ustado" no fim
       de uma linha. A palavra em volta segura as letras juntas; a
       quebra volta a acontecer só nos espaços, como em texto normal.
       O índice `--l` continua corrido entre as palavras pra cascata
       não dar salto na troca. */
    let i = 0;
    tt.innerHTML = texto.split(' ').map(palavra =>
      `<span class="palavra">${[...palavra].map(c =>
        `<span class="letra" style="--l:${i++}" aria-hidden="true">${
          c.replace('&', '&amp;').replace('<', '&lt;')}</span>`).join('')}</span>`
    ).join(' ');
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
    this.pintarMarcaTopo();   /* a marca do cabeçalho já tem que existir: é pra lá que a logo voa quando a pessoa cai direto na Início */
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
    /* Pra onde a logo voa. A tela de login tem a dela; quem já tem perfil
       cai direto na Início, e aí o destino é a marca do cabeçalho.

       Sem esse segundo caso a logo não tinha pra onde ir: o `if` não
       rodava, ela não ganhava a classe `juntando` e ficava parada, opaca,
       por cima do app já montado até a capa sumir. Era o "ela não some
       junto com o fundo". */
    if (marca) {
      const alvo = (tela && tela.querySelector('.login-logo'))
                || document.querySelector('#app .topo-marca, #app .marca-linha img');

      if (alvo) {
        const a = alvo.getBoundingClientRect(), m = marca.getBoundingClientRect();
        marca.style.setProperty('--dx',  (a.left + a.width  / 2 - (m.left + m.width  / 2)) + 'px');
        marca.style.setProperty('--dy',  (a.top  + a.height / 2 - (m.top  + m.height / 2)) + 'px');
        marca.style.setProperty('--esc', a.width / m.width);
        capa.classList.add('juntando');
        /* a de baixo só acende quando a de cima encaixou nela, senão a
           marca aparece duas vezes durante o voo. Na tela de login isso
           já vem do CSS (.tela-login.entrando .login-logo). */
        if (!tela) alvo.classList.add('marca-chegando');
      } else {
        /* nenhum destino: some junto com o fundo em vez de ficar parada */
        capa.classList.add('sumindo');
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
    if (this.tela === 'reajuste')   { app.innerHTML = Telas.reajuste();  nav.style.display = 'none'; return; }
    if (this.tela === 'criando')    { app.innerHTML = Onb.criando();    nav.style.display = 'none'; return; }
    if (this.tela === 'plano')      { app.innerHTML = Onb.plano();      nav.style.display = 'none'; return; }
    if (this.tela === 'cadastro')   { app.innerHTML = Onb.cadastro();   nav.style.display = 'none'; return; }
    if (this.tela === 'assinatura') { app.innerHTML = Onb.assinatura(); nav.style.display = 'none'; return; }

    if (!Store.temPerfil()) { this.tela = 'cadastro'; return this.pintar(); }

    const fn = Telas[this.tela] || Telas.inicio;
    app.innerHTML = fn.call(Telas);

    /* telas internas ocupam a tela inteira, sem a barra de navegação */
    const internas = ['biblioteca', 'cardapio', 'resumo', 'fotos', 'notificacoes', 'niveis', 'corridaAtiva'];
    nav.style.display = internas.includes(this.tela) ? 'none' : 'flex';
    document.querySelectorAll('.nav button').forEach(b => {
      b.classList.toggle('on', b.dataset.tela === this.tela);
    });
  },

  ir(tela) {
    this.tela = tela;
    if (tela === 'treinos') { this.diaTreino = this.indiceHoje(); this.carregarExtras(); }
    if (tela === 'perfil') this.carregarDuo();   // pinta agora, o cartão do Duo entra quando a resposta chegar
    this.render();
    window.scrollTo(0, 0);
  },

  /* ---------- VÍDEO DE EXECUÇÃO ----------
     O player entra só agora, no toque. A lista de exercícios tem
     dezenas de itens: um iframe em cada um derrubaria o desempenho da
     tela e gastaria os dados da pessoa com vídeo que ela nem abriu. */
  verVideo(nome) {
    if (!Video.tem(nome)) return;
    const ex = (typeof BIBLIOTECA !== 'undefined' ? BIBLIOTECA.find(b => b.nome === nome) : null);
    this.modal(`
      <h3>${nome}</h3>
      ${ex ? `<p class="m-sub">${ex.desc}</p>` : '<div style="height:8px"></div>'}
      ${Video.html(nome)}
      <div style="height:14px"></div>
      <button class="btn sec" onclick="App.fecharModal()">Fechar</button>`);
  },

  /* ---------- REAJUSTE MENSAL ----------
     Uma vez por mês, no primeiro acesso, antes da tela inicial. É o
     momento em que a assinatura mostra serviço: o plano dela mudou, e
     ela vê por quê.

     Roda depois da assinatura conferida, nunca antes: quem está
     devendo vê a tela de pagamento, não a de reajuste.            */
  checarReajuste() {
    if (this.tela !== 'inicio') return false;
    if (!Store.reajustePendente()) return false;
    this.abrirReajuste();
    return true;
  },

  /* Fecha o mês e abre a tela. Quem não assina o reajuste também passa
     por aqui: o retrato é gravado do mesmo jeito (senão a virada de
     mês reapareceria a cada abertura do app, virando perseguição), e
     a tela mostra a versão trancada. */
  abrirReajuste() {
    this.reajusteDados = Store.fecharReajuste();
    Backend.agendarSync();
    this.tela = 'reajuste';
  },

  /* entrada pela notificação: se o mês já foi fechado, remonta o
     retrato do último reajuste em vez de gravar outro */
  irReajuste() {
    if (Store.reajustePendente()) this.abrirReajuste();
    else {
      const ult = Store.ultimoReajuste();
      if (!ult) return this.toast('Ainda não há reajuste para mostrar.');
      Store.db.reajustes.pop();          /* desfaz pra fecharReajuste() recompor a mesma comparação */
      this.abrirReajuste();
    }
    this.render();
    window.scrollTo(0, 0);
  },

  fecharReajuste() {
    this.reajusteDados = null;
    this.tela = 'inicio';
    this.diaTreino = this.indiceHoje();
    this.render();
    window.scrollTo(0, 0);
  },

  lerTodasNotif() {
    Notif.marcarTodasLidas();
    Backend.agendarSync();
    this.render();
  },

  /* ---------- REAJUSTE MENSAL: a compra (R$9,90/mês) ---------- */
  temReajuste() {
    if (!CONFIG.CHECKOUT_URL_REAJUSTE) return true;   /* produto não criado: liberado pra todos */
    return Array.isArray(this.extras) && this.extras.indexOf('reajuste') >= 0;
  },

  comprarReajuste(periodo) {
    const url = (periodo === 'anual' && CONFIG.CHECKOUT_URL_REAJUSTE_ANUAL)
      ? CONFIG.CHECKOUT_URL_REAJUSTE_ANUAL
      : CONFIG.CHECKOUT_URL_REAJUSTE;
    if (!url) return;
    try { sessionStorage.setItem('ff_comprou_reajuste', '1'); } catch (e) {}
    const email = Backend.emailAtual();
    /* o e-mail vai junto: pagar com outro e-mail grava o acesso no
       lugar errado, e é o erro de suporte número um deste tipo de venda */
    const sep = url.includes('?') ? '&' : '?';
    location.href = url + (email ? sep + 'email=' + encodeURIComponent(email) : '');
  },

  async verificarReajuste(silencioso) {
    if (!Backend.ativo()) return false;
    if (!silencioso) this.toast('Conferindo seu pagamento...');

    for (let t = 0; t < 5; t++) {
      await this.carregarExtras(true);
      if (this.temReajuste()) {
        /* refaz o retrato agora que as fases estão liberadas, senão
           ela veria a tela cheia ainda calculada como fase 1 */
        if (Store.reajustes().length) Store.db.reajustes.pop();
        this.abrirReajuste();
        this.render();
        this.toast('Reajuste liberado ✅', true);
        return true;
      }
      await new Promise(ok => setTimeout(ok, 2500));
    }

    if (!silencioso) {
      this.modal(`
        <h3>Ainda não achamos o pagamento</h3>
        <p class="m-sub">Pode levar alguns minutos pra cair. Se você já pagou, feche e abra o app daqui a pouco. Se não aparecer, chame o suporte que a gente libera na mão.</p>
        <a class="btn sec" href="${CONFIG.SUPORTE_WHATS}" target="_blank" rel="noopener">Falar com o suporte</a>
        <div style="height:10px"></div>
        <button class="btn sec" onclick="App.fecharModal()">Fechar</button>`);
    }
    return false;
  },

  /* ---------- MODO CORRIDA (produto extra) ----------
     A tranca fica no servidor: o app pergunta ao banco quais produtos
     este e-mail comprou. Guardar isso no aparelho seria o mesmo que não
     ter tranca — qualquer um editaria o localStorage e liberaria. */
  temCorrida() {
    return Array.isArray(this.extras) && this.extras.indexOf('corrida') >= 0;
  },

  async carregarExtras(forcar) {
    if (!Backend.ativo()) { if (this.extras === null) this.extras = []; return; }
    if (this.extras && !forcar) return;
    const lista = await Backend.extras();
    const mudou = JSON.stringify(lista) !== JSON.stringify(this.extras);
    this.extras = lista;
    if (mudou && this.tela === 'treinos') this.render();
  },

  setAbaTreinos(aba) {
    this.abaTreinos = aba;
    if (aba === 'corrida') this.carregarExtras();
    this.render();
    window.scrollTo(0, 0);
  },

  /* ---------- BIBLIOTECA DE EXERCÍCIOS ----------
     O acesso vem do order bump (App.temVideos). Este checkout avulso é
     só pra quem já é cliente e não levou o bump na hora da assinatura. */
  /* liberada abre a lista; trancada abre a camada de venda por cima da
     tela, no mesmo formato da mensagem de boas-vindas */
  abrirBiblioteca() {
    if (this.temVideos()) { this.busca = ''; this.cat = 'Todos'; return this.ir('biblioteca'); }
    this.abrirCamada(Telas.bibliotecaCamada());
  },

  /* ---------- camada por cima da tela ----------
     Reaproveita o mesmo elemento e o mesmo visual da mensagem de
     boas-vindas. A marca `camada` existe porque App.boasVindas() roda a
     cada render e fecharia esta camada junto, por achar que a de
     boas-vindas é que estava aberta. */
  abrirCamada(html) {
    const bg = document.getElementById('bv-bg');
    if (!bg) return;
    bg.innerHTML = html;
    bg.classList.add('on');
    bg.setAttribute('aria-hidden', 'false');
    document.body.classList.add('travado');
    this.camada = true;
  },

  fecharCamada() {
    const bg = document.getElementById('bv-bg');
    this.camada = false;
    if (!bg) return;
    bg.classList.add('saindo');
    setTimeout(() => {
      bg.classList.remove('on', 'saindo');
      bg.setAttribute('aria-hidden', 'true');
      bg.innerHTML = '';
      document.body.classList.remove('travado');
    }, 280);
  },

  comprarBiblioteca() {
    if (!CONFIG.CHECKOUT_URL_BIBLIOTECA) return;
    try { sessionStorage.setItem('ff_comprou_biblioteca', '1'); } catch (e) {}
    const email = Backend.emailAtual();
    const sep = CONFIG.CHECKOUT_URL_BIBLIOTECA.includes('?') ? '&' : '?';
    location.href = CONFIG.CHECKOUT_URL_BIBLIOTECA + (email ? sep + 'email=' + encodeURIComponent(email) : '');
  },

  async verificarBiblioteca(silencioso) {
    if (!Backend.ativo()) return false;
    if (!silencioso) this.toast('Conferindo seu pagamento...');

    for (let t = 0; t < 5; t++) {
      /* o acesso mora na linha da assinatura (tem_videos), então quem
         responde é a mesma consulta de sempre */
      this.assinaturaInfo = await Backend.assinatura();
      if (this.temVideos()) {
        this.fecharCamada();
        this.busca = ''; this.cat = 'Todos';
        this.ir('biblioteca');
        this.toast('Biblioteca liberada ✅', true);
        return true;
      }
      await new Promise(ok => setTimeout(ok, 2500));
    }

    if (!silencioso) {
      this.modal(`
        <h3>Ainda não achamos o pagamento</h3>
        <p class="m-sub">Pode levar alguns minutos pra cair. Se você já pagou, feche e abra o app daqui a pouco. Se não aparecer, chame o suporte que a gente libera na mão.</p>
        <a class="btn sec" href="${CONFIG.SUPORTE_WHATS}" target="_blank" rel="noopener">Falar com o suporte</a>
        <div style="height:10px"></div>
        <button class="btn sec" onclick="App.fecharModal()">Fechar</button>`);
    }
    return false;
  },

  /* ---------- MOTOR DA CORRIDA ----------
     Cronômetro + GPS. Tudo vive em App.corridaEstado enquanto dura; só
     o resultado final vai pro Store.

     ⚠️ Limite da plataforma: navegador não rastreia com a tela apagada.
     Por isso o app segura a tela acesa (Wake Lock) e, no fim, deixa
     corrigir a distância na mão. Fingir que funciona bloqueado seria
     vender o que o app não entrega. */
  corridaEstado: null,

  /* km com vírgula, que é como se escreve número aqui */
  km(metros, casas) {
    return ((Number(metros) || 0) / 1000).toFixed(casas === undefined ? 2 : casas).replace('.', ',');
  },

  duracaoLonga(seg) {
    seg = Math.max(0, Math.round(seg));
    const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), x = seg % 60;
    const dois = n => String(n).padStart(2, '0');
    return (h ? h + ':' : '') + dois(m) + ':' + dois(x);
  },

  duracaoCurta(seg) {
    seg = Math.max(0, Math.round(seg));
    const h = Math.floor(seg / 3600), m = Math.round((seg % 3600) / 60);
    return h ? h + 'h' + String(m).padStart(2, '0') : m + 'min';
  },

  /* ritmo vem em segundos por km e se lê como 5:30 */
  paceTexto(seg) {
    /* acima de 99 min/km não é ritmo de corrida: é distância curta demais
       ou medida torto. Um traço diz a verdade melhor que um número absurdo. */
    if (!seg || seg > 5999) return '--:--';
    const m = Math.floor(seg / 60), x = Math.round(seg % 60);
    return m + ':' + String(x).padStart(2, '0');
  },

  async iniciarCorrida() {
    if (!this.temCorrida()) return;
    this.corridaEstado = {
      contagem: 3, segundos: 0, metros: 0, pausado: false, acumulado: 0, inicio: 0,
      gpsOk: false, gpsErro: '', ultimo: null, watch: null, wake: null, timer: null
    };
    this.tela = 'corridaAtiva';
    this.render();

    this.segurarTela();
    this.ligarGPS();

    /* 3, 2, 1 e vai */
    const passo = () => {
      const c = this.corridaEstado;
      if (!c) return;
      c.contagem--;
      this.render();
      if (c.contagem > 0) return setTimeout(passo, 1000);
      c.inicio = Date.now();
      c.acumulado = 0;
      c.timer = setInterval(() => this.tiqueCorrida(), 1000);
      this.render();
    };
    setTimeout(passo, 1000);
  },

  /* O tempo vem do relógio do aparelho, não da contagem de tiques: o
     navegador atrasa ou pula setInterval quando a aba sai da frente, e
     somar 1 a cada tique faria a corrida terminar com menos tempo do
     que ela durou de verdade. */
  tiqueCorrida() {
    const c = this.corridaEstado;
    if (!c || c.pausado || c.contagem > 0) return;
    c.segundos = c.acumulado + Math.floor((Date.now() - c.inicio) / 1000);
    this.atualizarCorrida();
  },

  /* Troca só os números na tela. Remontar a tela inteira a cada segundo
     pisca o cronômetro e reinicia as animações do CSS. */
  atualizarCorrida() {
    const c = this.corridaEstado;
    if (!c || this.tela !== 'corridaAtiva') return;

    const tempo = document.getElementById('cr-tempo');
    if (!tempo) return this.render();     /* a tela ainda não está montada */

    const ritmo = Store.ritmo(c.metros, c.segundos);
    const põe = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

    tempo.textContent = this.duracaoLonga(c.segundos);
    põe('cr-km', this.km(c.metros));
    põe('cr-ritmo', ritmo ? this.paceTexto(ritmo) : '--:--');
    põe('cr-kcal', Store.caloriasCorrida(c.metros, c.segundos));

    const gps = document.getElementById('cr-gps');
    if (gps) {
      gps.textContent = c.gpsOk ? 'GPS ativo' : (c.gpsErro || 'Procurando GPS...');
      gps.classList.toggle('on', c.gpsOk);
    }
  },

  /* mantém a tela acesa enquanto corre; se o navegador não tiver a API,
     segue sem ela (o aviso na tela já explica o risco) */
  async segurarTela() {
    try {
      if ('wakeLock' in navigator) {
        this.corridaEstado.wake = await navigator.wakeLock.request('screen');
      }
    } catch (e) { /* negado ou indisponível: não trava a corrida */ }
  },

  ligarGPS() {
    const c = this.corridaEstado;
    if (!navigator.geolocation) { c.gpsErro = 'Sem GPS neste aparelho'; return this.atualizarCorrida(); }

    c.watch = navigator.geolocation.watchPosition(
      pos => {
        const e = this.corridaEstado;
        if (!e || e.pausado || e.contagem > 0) return;
        /* leitura ruim atrapalha mais que ajuda: acima de 25m de erro,
           o ponto é ruído e inflaria a distância */
        if (pos.coords.accuracy > 25) return;
        e.gpsOk = true; e.gpsErro = '';
        if (e.ultimo) {
          const d = this.distanciaEntre(e.ultimo, pos.coords);
          if (d > 1 && d < 60) e.metros += d;   /* passo mínimo e salto máximo */
        }
        e.ultimo = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      },
      err => {
        const e = this.corridaEstado;
        if (!e) return;
        e.gpsErro = err.code === 1 ? 'GPS negado' : 'GPS indisponível';
        e.gpsOk = false;
        this.atualizarCorrida();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  },

  /* haversine: distância em metros entre dois pontos do globo */
  distanciaEntre(a, b) {
    const R = 6371000, rad = x => x * Math.PI / 180;
    const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2 +
              Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  },

  pausarCorrida() {
    const c = this.corridaEstado;
    if (!c || c.contagem > 0) return;

    if (c.pausado) {
      c.inicio = Date.now();              /* retoma contando a partir de agora */
      c.pausado = false;
    } else {
      c.acumulado = c.segundos;           /* guarda o que já correu */
      c.pausado = true;
    }
    c.ultimo = null;          /* retomar não pode contar o trecho parado */
    this.render();
  },

  encerrarRecursos() {
    const c = this.corridaEstado;
    if (!c) return;
    clearInterval(c.timer);
    if (c.watch != null && navigator.geolocation) navigator.geolocation.clearWatch(c.watch);
    if (c.wake) { try { c.wake.release(); } catch (e) {} }
    c.timer = null; c.watch = null; c.wake = null;
  },

  finalizarCorrida() {
    const c = this.corridaEstado;
    if (!c) return;
    this.encerrarRecursos();

    if (c.segundos < 10) {
      this.corridaEstado = null;
      this.tela = 'treinos'; this.abaTreinos = 'corrida';
      this.render();
      return this.toast('Corrida curta demais para registrar.');
    }

    const km = (c.metros / 1000).toFixed(2);
    this.modal(`
      <h3>Corrida concluída</h3>
      <p class="m-sub">${this.duracaoLonga(c.segundos)} em movimento. Confira a distância antes de salvar.</p>
      <div class="campo">
        <label>Distância (km)</label>
        <input id="fim-km" type="number" inputmode="decimal" step="0.01" value="${km}">
        <div class="dica">${c.gpsOk
          ? 'Medida pelo GPS. Se o percurso ficou torto, corrija aqui.'
          : 'O GPS não mediu o percurso. Digite quantos quilômetros você fez.'}</div>
      </div>
      <button class="btn" onclick="App.salvarCorrida()">Salvar corrida</button>
      <div style="height:10px"></div>
      <button class="btn sec" onclick="App.descartarCorrida()">Descartar</button>`);
  },

  salvarCorrida() {
    const c = this.corridaEstado;
    if (!c) return;
    const el = document.getElementById('fim-km');
    const km = parseFloat(el ? el.value : '0');
    const metros = isNaN(km) || km < 0 ? 0 : Math.round(km * 1000);

    /* "gps" só vale se ela não mexeu no número que o GPS sugeriu. O
       sugerido é o valor JÁ arredondado que apareceu no campo, senão a
       comparação nunca bate e toda corrida vira "distância digitada". */
    const sugerido = Math.round(parseFloat((c.metros / 1000).toFixed(2)) * 1000);
    const reg = Store.salvarCorrida({ segundos: c.segundos, metros, gps: c.gpsOk && metros === sugerido });
    Backend.agendarSync();
    this.corridaEstado = null;
    this.fecharModal();
    this.tela = 'treinos'; this.abaTreinos = 'corrida';
    this.render();
    if (this.checarNivel()) return;
    this.toast(`${(reg.metros / 1000).toFixed(2)} km registrados. +${PONTOS.corrida} pontos 🏃`, true);
  },

  descartarCorrida() {
    this.encerrarRecursos();
    this.corridaEstado = null;
    this.fecharModal();
    this.tela = 'treinos'; this.abaTreinos = 'corrida';
    this.render();
  },

  apagarCorrida(quando) {
    this.modal(`
      <h3>Apagar esta corrida?</h3>
      <p class="m-sub">Ela sai do seu histórico e dos seus totais. Não tem como desfazer.</p>
      <button class="btn perigo" onclick="App.apagarCorridaConfirmado('${quando}')">Apagar</button>
      <div style="height:10px"></div>
      <button class="btn sec" onclick="App.fecharModal()">Cancelar</button>`);
  },

  apagarCorridaConfirmado(quando) {
    Store.apagarCorrida(quando);
    Backend.agendarSync();
    this.fecharModal();
    this.render();
    this.toast('Corrida apagada.');
  },

  /* leva pro checkout e deixa marcado que foi, pra quando voltar o app
     já conferir sozinho se o pagamento caiu (ver o pageshow no fim) */
  comprarCorrida() {
    if (!CONFIG.CHECKOUT_URL_CORRIDA) return;
    try { sessionStorage.setItem('ff_comprou_corrida', '1'); } catch (e) {}
    const email = Backend.emailAtual();
    /* leva o e-mail pro checkout já preenchido: se a pessoa pagar com
       OUTRO e-mail, o webhook grava o acesso no e-mail errado e ela não
       libera nada. É o erro de suporte mais comum nesse tipo de venda. */
    const sep = CONFIG.CHECKOUT_URL_CORRIDA.includes('?') ? '&' : '?';
    location.href = CONFIG.CHECKOUT_URL_CORRIDA + (email ? sep + 'email=' + encodeURIComponent(email) : '');
  },

  /* pergunta de novo ao banco. Usada pelo "já paguei" e pela volta do
     checkout: o webhook pode demorar alguns segundos, então tenta
     algumas vezes antes de desistir. */
  async verificarCorrida(silencioso) {
    if (!Backend.ativo()) return false;
    if (!silencioso) this.toast('Conferindo seu pagamento...');

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      await this.carregarExtras(true);
      if (this.temCorrida()) {
        this.abaTreinos = 'corrida';
        this.render();
        this.toast('Modo Corrida liberado 🏃 Bom treino!', true);
        return true;
      }
      await new Promise(ok => setTimeout(ok, 2500));
    }

    if (!silencioso) {
      this.modal(`
        <h3>Ainda não achamos o pagamento</h3>
        <p class="m-sub">Pode levar alguns minutos pra cair. Se você já pagou, feche e abra o app daqui a pouco. Se não aparecer, chame o suporte que a gente libera na mão.</p>
        <a class="btn sec" href="${CONFIG.SUPORTE_WHATS}" target="_blank" rel="noopener">Falar com o suporte</a>
        <div style="height:10px"></div>
        <button class="btn sec" onclick="App.fecharModal()">Fechar</button>`);
    }
    return false;
  },

  /* ---------- PLANO DUO ----------
     Quem comprou o Duo ganhou uma vaga pra outra pessoa, e é ele quem
     diz qual e-mail vai ocupar — a plataforma de pagamento só conheceu
     o dele. Quem confere se pode e grava é o banco (ver schema.sql);
     aqui é só a tela.

     Carrega uma vez por sessão: não muda sozinho, e a aba de perfil é
     aberta muitas vezes. duoRecarregar() força depois de convidar ou
     remover. */
  async carregarDuo(forcar) {
    if (!Backend.ativo()) return;
    if (this.duo && !forcar) return;
    const d = await Backend.duoEstado();
    if (!d) return;
    this.duo = d;
    /* a Início entra na lista porque o sininho conta as notificações e
       uma delas depende do estado do Duo */
    if (this.tela === 'perfil' || this.tela === 'inicio') this.render();
  },

  async duoConvidar() {
    const campo = document.getElementById('in-duo');
    const btn = document.getElementById('btn-duo');
    const email = (campo && campo.value || '').trim();
    if (!email) { this.duoErro = 'Digite o e-mail da pessoa.'; return this.render(); }

    if (btn) { btn.disabled = true; btn.textContent = 'Liberando...'; }
    const r = await Backend.duoConvidar(email);

    if (!r.ok) {
      this.duoErro = r.erro || 'Não foi possível convidar.';
      this.render();
      return;
    }
    this.duoErro = '';
    await this.carregarDuo(true);
    this.render();
    this.toast('Acesso liberado para ' + r.email + ' ✅', true);
  },

  async duoRemover(email) {
    this.modal(`
      <h3>Tirar do seu plano?</h3>
      <p class="m-sub">${email} perde o acesso ao app na hora. Os dados dela ficam guardados: se você chamar de novo, está tudo lá.</p>
      <button class="btn perigo" onclick="App.duoRemoverConfirmado('${email}')">Tirar do plano</button>
      <div style="height:10px"></div>
      <button class="btn sec" onclick="App.fecharModal()">Cancelar</button>`);
  },

  async duoRemoverConfirmado(email) {
    this.fecharModal();
    const r = await Backend.duoRemover(email);
    if (!r.ok) { this.duoErro = r.erro || 'Não foi possível remover.'; return this.render(); }
    this.duoErro = '';
    await this.carregarDuo(true);
    this.render();
    this.toast('Vaga liberada. Você já pode chamar outra pessoa.');
  },

  /* ---------- lembretes de refeição ---------- */
  /* ---------- lembretes do celular ----------
     São quatro switches independentes (refeição, água, sono, treino).
     alternarLembretes() continua existindo com o nome antigo porque é
     o que a tela do Perfil chama; ela só repassa pro tipo 'refeicao'. */
  alternarLembretes() { return this.alternarLembrete('refeicao'); },

  NOME_LEMBRETE: {
    refeicao: 'Lembrete de refeição',
    agua: 'Lembrete de água',
    sono: 'Lembrete de sono',
    treino: 'Lembrete de treino'
  },

  async alternarLembrete(tipo) {
    const nome = this.NOME_LEMBRETE[tipo] || 'Lembretes';

    if (Lembretes.ligado(tipo) && Lembretes.permitido()) {
      Lembretes.desligar(tipo);
      this.render();
      return this.toast(nome + ' desligado.');
    }

    /* o lembrete de treino sem horário nenhum marcado não teria quando
       tocar: avisa em vez de ligar um switch que não faz nada */
    if (tipo === 'treino' && !Object.keys(Store.horasTreino()).length) {
      return this.toast('Marque primeiro o seu horário de treino.');
    }

    const r = await Lembretes.ligar(tipo);
    this.render();
    if (r === 'ok') {
      const n = Lembretes.agendar();
      return this.toast(n ? `Pronto. ${n} ${n === 1 ? 'aviso' : 'avisos'} ainda hoje. 🔔`
                          : 'Pronto. Os avisos começam amanhã. 🔔', true);
    }
    if (r === 'negado') return this.toast('O celular bloqueou as notificações. Libere nas configurações do navegador.');
    if (r === 'sem-suporte') return this.toast('Este navegador não faz notificações.');
    this.toast('Não foi possível ligar.');
  },

  /* ---------- horário de treino ---------- */
  salvarHoraTreinoTodos(hora) {
    Store.definirHoraTreinoTodos(hora);
    Backend.agendarSync();
    Lembretes.agendar();
    this.render();
    this.toast(hora ? `Treino marcado para as ${hora} nos seus dias de treino.` : 'Horário de treino removido.');
  },

  salvarHoraDoDia(pos, hora) {
    Store.definirHoraTreino(pos, hora);
    Backend.agendarSync();
    Lembretes.agendar();
    this.fecharModal();
    this.render();
    this.toast(hora ? `${DIAS_SEMANA_LONGO[pos]}: treino às ${hora}.` : `${DIAS_SEMANA_LONGO[pos]}: horário removido.`);
  },

  /* ---------- calendário ----------
     Guarda só o deslocamento em meses a partir do atual, não uma data:
     assim o calendário nunca fica preso num mês velho quando o app
     passa a virada da meia-noite aberto. */
  mesOffset: 0,

  mesCalendario() {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + this.mesOffset);
    return d;
  },

  mudarMes(n) {
    this.mesOffset += n;
    this.render();
  },

  /* toque num dia do calendário: mostra QUAL é o treino daquele dia e
     deixa marcar o horário dele */
  abrirDataTreino(iso) {
    const t = Store.treinoDaData(iso);
    if (!t) return;

    const feito = Store.treinoFeitoEm(iso);
    const hoje = Store.hoje();
    const quando = iso === hoje ? 'Hoje' : this.dataBr(iso);
    const hora = Store.horaTreino(t.pos);

    if (t.descanso) {
      return this.modal(`
        <h3>${quando} · descanso</h3>
        <p class="m-sub">${DIAS_SEMANA_LONGO[t.pos]} é o seu dia de descanso. ${t.sugestao || ''}</p>
        <button class="btn sec" onclick="App.fecharModal()">Fechar</button>`);
    }

    this.modal(`
      <h3>${quando} · ${t.foco}</h3>
      <p class="m-sub">${DIAS_SEMANA_LONGO[t.pos]} · ${t.exercicios.length} exercícios${feito ? ' · já concluído' : ''}</p>

      <div class="dia-ex">
        ${t.exercicios.slice(0, 6).map(e => `
          <div><span>${e.series}x${e.reps}</span>${e.ex}</div>`).join('')}
        ${t.exercicios.length > 6 ? `<div class="dia-ex-mais">e mais ${t.exercicios.length - 6}</div>` : ''}
      </div>

      <div class="campo">
        <label for="dia-hora">Horário do treino de ${DIAS_SEMANA_LONGO[t.pos].toLowerCase()}</label>
        <input id="dia-hora" type="time" value="${hora || HORA_TREINO_PADRAO}">
        <div class="dica">Vale para toda ${DIAS_SEMANA_LONGO[t.pos].toLowerCase()}, porque treino é rotina.</div>
      </div>

      <button class="btn" onclick="App.salvarHoraDoDia(${t.pos}, document.getElementById('dia-hora').value)">Salvar horário</button>
      <div style="height:10px"></div>
      ${hora ? `<button class="btn sec" onclick="App.salvarHoraDoDia(${t.pos}, '')">Tirar o horário</button>`
             : `<button class="btn sec" onclick="App.fecharModal()">Fechar</button>`}`);
  },

  /* ---------- Plano Duo (oferta) ---------- */
  abrirDuo() {
    this.abrirCamada(Telas.duoCamada());
  },

  comprarDuo() {
    if (!CONFIG.CHECKOUT_URL_DUO) return;
    try { sessionStorage.setItem('ff_comprou_duo', '1'); } catch (e) {}
    const email = Backend.emailAtual();
    const sep = CONFIG.CHECKOUT_URL_DUO.includes('?') ? '&' : '?';
    location.href = CONFIG.CHECKOUT_URL_DUO + (email ? sep + 'email=' + encodeURIComponent(email) : '');
  },

  async verificarDuo(silencioso) {
    if (!Backend.ativo()) return false;
    if (!silencioso) this.toast('Conferindo seu pagamento...');

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      await this.carregarDuo(true);
      if (this.duo && this.duo.ok && Number(this.duo.vagas || 1) >= 2) {
        this.fecharCamada();
        this.render();
        /* a camada em vez do toast: o toast some em três segundos e a
           pessoa fica sem saber que ainda falta chamar alguém */
        setTimeout(() => this.abrirCamada(Telas.duoVagaCamada()), 320);
        return true;
      }
      await new Promise(ok => setTimeout(ok, 2000));
    }
    if (!silencioso) this.toast('Ainda não achamos o pagamento. Se você acabou de pagar, tente de novo em um minuto.');
    return false;
  },

  /* leva pro Perfil, onde mora o campo de convite do Duo */
  irConvidarDuo() {
    this.fecharCamada();
    this.ir('perfil');
    setTimeout(() => {
      const campo = document.getElementById('in-duo');
      if (campo) { campo.scrollIntoView({ block: 'center', behavior: 'smooth' }); campo.focus(); }
    }, 350);
  },

  /* atalho da notificação: leva direto pra aba Corrida */
  irCorrida() {
    this.abaTreinos = 'corrida';
    this.ir('treinos');
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
  abrirFora() {
    this.foraAberta = !this.foraAberta;
    this.render();
  },

  marcarForaDaRotina() {
    /* a trava de uma vez por semana mora no Store; aqui é só o aviso */
    if (!Store.foraDaRotina() && !Store.podeForaDaRotina()) {
      return this.toast('Você já usou o dia fora da rotina nesta semana.');
    }
    const ligou = Store.alternarForaDaRotina();
    Backend.agendarSync();
    this.foraAberta = true;          /* continua aberto pra ela ver o que mudou */
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

  salvarCarga(i, series) {
    const nome = this.nomeExercicio(i);
    if (!nome) return;

    /* lê as linhas preenchidas; série deixada em branco não vira
       registro, pra quem parou antes do fim não gravar zero */
    const lidas = [];
    for (let k = 0; k < (Number(series) || 1); k++) {
      const elP = document.getElementById('carga-peso-' + k);
      const elR = document.getElementById('carga-reps-' + k);
      if (!elP) continue;
      const peso = parseFloat(elP.value);
      if (isNaN(peso)) continue;
      if (peso < 0 || peso > 1000) return this.toast('Digite uma carga válida.');
      lidas.push({ peso, reps: parseInt(elR ? elR.value : '', 10) });
    }
    if (!lidas.length) return this.toast('Preencha a carga de pelo menos uma série.');

    const anterior = Store.ultimaCarga(nome);
    const topo = Store.registrarCarga(nome, lidas);
    const peso = topo ? topo.peso : 0;
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
      await this.carregarExtras();        // o que ela comprou decide o que o reajuste mostra
      this.checarReajuste();              // virada de mês, se for o primeiro acesso do mês
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

    /* Sem respostas do quiz, a mesma tela "Seu perfil" abre em branco e a
       pessoa preenche ali. É o caminho de quem entrou pela vaga do Plano
       Duo (nunca fez o quiz, porque quem fez foi quem pagou) e de quem
       comprou por fora do funil.

       Antes esse caso caía no cadastro de 3 passos, que só pergunta 8 dos
       15 campos: sono, água, frequência, nível, tempo de treino,
       refeições e restrições ficavam de fora, e o plano saía montado com
       os padrões em vez das respostas dela. */
    this.setarModoDoPerfil();
    this.tela = 'revisao';
    this.render();
  },

  /* decide se a tela "Seu perfil" abre preenchida ou em branco, e
     descobre quem convidou (quando a pessoa entrou pelo Plano Duo) */
  async setarModoDoPerfil() {
    Onb.emBranco = !this.dadosDoQuizChegaram();
    Onb.convidadoPor = '';
    if (!Onb.emBranco) return;
    try {
      const a = await Backend.assinatura();
      if (a && a.titular_email) {
        Onb.convidadoPor = a.titular_email;
        if (this.tela === 'revisao') this.render();
      }
    } catch (e) { /* o aviso de quem convidou é enfeite: não trava o cadastro */ }
  },

  /* veio alguma resposta do quiz? (só o e-mail não conta) */
  dadosDoQuizChegaram() {
    return ['sexo', 'idade', 'altura', 'peso', 'objetivo'].some(k => Onb.dados[k]);
  },

  /* ---------- acesso de teste (CONFIG.ACESSO_TESTE) ----------
     Entra sem código e sem checar assinatura, mas o resto do caminho é o
     mesmo do login de verdade: busca as respostas do quiz pelo e-mail e
     cai na revisão do perfil ou no cadastro. É o que permite testar o app
     publicado enquanto o envio de e-mail e o webhook da Zuptos não estão
     de pé — e, diferente do PULAR_LOGIN, não deixa o app aberto pra
     qualquer um com o link. */
  async entrarSemCodigo(email) {
    this.modoLocal = true;
    Onb.emailPendente = email;
    Onb.erro = '';

    if (Store.temPerfil()) {
      this.tela = 'inicio';
      this.diaTreino = this.indiceHoje();
      this.render();
      return;
    }

    Store.resetar();
    this.tela = 'recebendo';
    this.render();

    const buscando = this.aplicarRespostasDoQuizPorEmail(email);
    await Promise.all([buscando, new Promise(ok => setTimeout(ok, 1800))]);

    this.setarModoDoPerfil();
    this.tela = 'revisao';
    this.render();
  },

  async aplicarRespostasDoQuizPorEmail(email) {
    try {
      const respostas = await Backend.buscarRespostasQuizPorEmail(email);
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
    this.extras = null;          /* acesso é por e-mail: some junto com a conta */
    this.duo = null;
    this.abaTreinos = 'treino';
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

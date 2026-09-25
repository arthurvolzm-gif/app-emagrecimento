/* =========================================================
   LOGIN + CADASTRO (onboarding em 3 passos)
   ========================================================= */

/* chave onde o quiz (quiz.html) deixa as respostas.
   Se a pessoa veio de lá, o cadastro já abre preenchido em vez
   de pedir de novo o que ela acabou de responder. */
const CHAVE_QUIZ = 'app_emag_quiz';

function dadosDoQuiz() {
  const vazio = {
    nome:'', idade:'', sexo:'', peso:'', altura:'', meta_peso:'', objetivo:'', local:'',
    dias_treino:'', sono:'', agua:'',
    nivel_treino:'', tempo_treino:'', refeicoes:'', restricoes:''
  };
  try {
    const bruto = localStorage.getItem(CHAVE_QUIZ);
    if (!bruto) return vazio;
    const q = JSON.parse(bruto);
    const campos = {};
    for (const k in vazio) {
      if (q[k] !== undefined && q[k] !== null && q[k] !== '') campos[k] = String(q[k]);
    }
    return Object.assign(vazio, campos);
  } catch (e) {
    return vazio;
  }
}

/* =========================================================
   TELA "SEU PERFIL" — o que a pessoa vê logo depois de entrar

   Cada linha é montada a partir desta lista. Os `id` são os mesmos
   campos de `Onb.dados`, então o que a pessoa corrigir aqui já sai
   certo no perfil. Para mexer na tela, mexa nesta lista: a marcação
   e os botões de escolha são gerados sozinhos.
   ========================================================= */
const PERFIL_ICONES = {
  pessoa:    '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 19.5c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6"/>',
  calendario:'<rect x="3.5" y="5" width="17" height="15" rx="2.6"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  regua:     '<rect x="2.6" y="8" width="18.8" height="8" rx="2.2" transform="rotate(-20 12 12)"/><path d="M8 8.6l1.2 2.4M11.4 7.2l1.2 2.4M14.8 5.8l1.2 2.4"/>',
  balanca:   '<rect x="4" y="4.5" width="16" height="15" rx="3"/><path d="M12 8v3"/><path d="M9.5 8h5"/>',
  alvo:      '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
  trofeu:    '<path d="M7 4h10v5a5 5 0 01-10 0z"/><path d="M7 6H4.5v1.5A3 3 0 007.4 10M17 6h2.5v1.5A3 3 0 0116.6 10"/><path d="M12 14v3M8.5 20h7"/>',
  halter:    '<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>',
  lua:       '<path d="M20 14.5A8.2 8.2 0 019.6 4 8.5 8.5 0 1020 14.5z"/>',
  gota:      '<path d="M12 3.5s5.5 6 5.5 9.6A5.5 5.5 0 0112 18.6a5.5 5.5 0 01-5.5-5.5C6.5 9.5 12 3.5 12 3.5z"/>',
  medalha:   '<circle cx="12" cy="14.5" r="5"/><path d="M9 9.6L7 3h10l-2 6.6"/><path d="M12 12.5l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
  relogio:   '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  prato:     '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/>',
  folha:     '<path d="M19.5 4.5C10 4.5 5 9 5 15.5c0 1.6.4 3 1 4"/><path d="M6 19.5c9.5 0 13.5-5.5 13.5-15"/>',
  casa:      '<path d="M4 10.5L12 4l8 6.5"/><path d="M6.5 10v9.5h11V10"/>'
};

const PERFIL_CAMPOS = [
  { secao: 'Seus dados' },
  { id:'nome',      ic:'pessoa',    rot:'Nome',                 tipo:'texto' },
  { id:'sexo',      ic:'pessoa',    rot:'Gênero',               tipo:'opcoes', opcoes:[['feminino','Feminino'],['masculino','Masculino']] },
  { id:'idade',     ic:'calendario',rot:'Idade',                tipo:'numero', un:'anos', min:14,  max:99 },
  { id:'altura',    ic:'regua',     rot:'Altura',               tipo:'numero', un:'cm',   min:120, max:230 },
  { id:'peso',      ic:'balanca',   rot:'Peso',                 tipo:'numero', un:'kg',   min:35,  max:300 },

  { secao: 'Seu objetivo' },
  { id:'objetivo',  ic:'alvo',      rot:'Objetivo',             tipo:'opcoes', opcoes:[['emagrecimento','Emagrecimento'],['hipertrofia','Hipertrofia'],['manutencao','Manutenção']] },
  { id:'meta_peso', ic:'trofeu',    rot:'Meta de peso',         tipo:'numero', un:'kg',   min:35,  max:300 },

  { secao: 'Seus hábitos' },
  { id:'dias_treino', ic:'halter',  rot:'Frequência de treino', tipo:'opcoes', opcoes:[['3','3x por semana'],['4','4x por semana'],['5','5x por semana'],['6','6x por semana']] },
  { id:'sono',      ic:'lua',       rot:'Sono',                 tipo:'opcoes', opcoes:[['0','Menos de 5 horas'],['1','5 a 6 horas'],['2','7 a 8 horas'],['3','Mais de 8 horas']] },
  { id:'agua',      ic:'gota',      rot:'Água',                 tipo:'opcoes', opcoes:[['0','Menos de 1 litro'],['1','1 a 2 litros'],['2','Mais de 2 litros']] },

  { secao: 'Informações adicionais' },
  { id:'nivel_treino', ic:'medalha',rot:'Nível de experiência com treino', tipo:'opcoes', opcoes:[['iniciante','Iniciante'],['intermediario','Intermediário'],['avancado','Avançado']] },
  { id:'tempo_treino', ic:'relogio',rot:'Tempo por sessão de treino',      tipo:'opcoes', opcoes:[['30','Até 30 minutos'],['45','45 minutos'],['60','1 hora'],['90','Mais de 1 hora']] },
  { id:'refeicoes',    ic:'prato',  rot:'Refeições por dia',               tipo:'opcoes', opcoes:[['3','3 refeições'],['4','4 refeições'],['5','5 refeições'],['6','6 refeições']] },
  { id:'restricoes',   ic:'folha',  rot:'Restrições e preferências alimentares', tipo:'multi', opcoes:[['nenhuma','Nenhuma'],['lactose','Sem lactose'],['gluten','Sem glúten'],['vegetariano','Vegetariano'],['vegano','Vegano'],['low_carb','Low carb']] },
  { id:'local',        ic:'casa',   rot:'Onde você vai treinar',           tipo:'opcoes', opcoes:[['academia','Academia'],['casa','Em casa']] }
];

const Onb = {
  /* rascunho do cadastro enquanto a pessoa preenche
     (já vem preenchido quando a pessoa chegou pelo quiz) */
  dados: dadosDoQuiz(),
  erro: '',

  /* qual linha da tela "Seu perfil" está aberta pra edição ('' = nenhuma) */
  abertoPerfil: '',

  /* qual bloco da tela "Seu plano está pronto" está aberto ('' = nenhum) */
  abertoPlano: '',

  /* e-mail digitado na primeira etapa, guardado pra confirmar o código */
  emailPendente: '',

  /* A tela "Seu perfil" atende dois públicos:
     - quem veio do quiz: chega preenchida, e o trabalho é conferir;
     - quem nunca fez o quiz (o caso do Plano Duo, mas também de quem
       comprou por outro caminho): chega em branco, e o trabalho é
       preencher.
     É a mesma tela e a mesma lista de campos de propósito — o que muda
     é o texto, porque "confira o que você respondeu" pra quem não
     respondeu nada é confuso. */
  emBranco: false,

  /* e-mail de quem pagou, quando a pessoa entrou pela vaga do Plano Duo */
  convidadoPor: '',

  /* ---------- etapa 1: pedir o e-mail ----------
     Um caminho só pra entrar e pra criar conta: quem nunca entrou
     tem a conta criada na hora que confirma o código. O que decide
     se ela vê as telas internas é a assinatura, não o cadastro. */
  /* a logo de verdade, o mesmo arquivo usado na abertura e no giro das
     telas de carregamento — uma fonte só pra marca no app inteiro */
  logoHTML() {
    return `<img class="login-logo" src="logo-focusfit.png" alt="Focus Fit">`;
  },

  /* link direto pro WhatsApp, sem mensagem pronta — só abre a conversa */
  suporteHTML() {
    return `
      <div class="login-footer">
        <a href="${CONFIG.SUPORTE_WHATS}" target="_blank" rel="noopener">Suporte</a>
      </div>`;
  },

  auth() {
    return `
      <div class="tela-login">
        <div class="login-content">
          ${this.logoHTML()}
          <h1 class="login-h1">Entrar</h1>
          <p class="login-sub">Digite o e-mail que você usou na compra. Mandamos um código de 6 números pra ele.</p>

          ${this.erro ? `<div class="erro">${this.erro}</div>` : ''}

          <div class="login-campo">
            <span class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 6h18v12H3z" stroke="#3FBE7C" stroke-width="1.8"/><path d="M3 7l9 6 9-6" stroke="#3FBE7C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            <input type="email" id="in-email" placeholder="E-mail" autocomplete="email"
                   value="${this.emailPendente}" onkeydown="if(event.key==='Enter')Onb.pedirCodigo()">
          </div>

          <button class="login-btn" id="btn-auth" onclick="Onb.pedirCodigo()">Receber código</button>

          <!-- quem baixou o app sem ter passado pelo quiz não tem conta
               nenhuma: o login por código só funciona pra quem já comprou.
               Este link manda essa pessoa pro WhatsApp, que é por onde a
               venda dela acontece. -->
          <a class="login-criar" href="${CONFIG.SUPORTE_WHATS}" target="_blank" rel="noopener">
            Ainda não tem conta? <strong>Criar Conta</strong>
          </a>
        </div>
        ${this.suporteHTML()}
      </div>`;
  },

  /* ---------- etapa 2: confirmar o código ---------- */
  codigo() {
    return `
      <div class="tela-login">
        <div class="login-content">
          ${this.logoHTML()}
          <h1 class="login-h1">Digite o código</h1>
          <p class="login-sub">Enviamos 6 números para <strong>${this.emailPendente}</strong>. Se não achar, olhe no spam.</p>

          ${this.erro ? `<div class="erro">${this.erro}</div>` : ''}

          <div class="login-campo sem-icone">
            <input type="text" id="in-codigo" placeholder="000000" inputmode="numeric"
                   maxlength="6" autocomplete="one-time-code"
                   style="letter-spacing:8px;text-align:center;font-size:22px;font-weight:800"
                   onkeydown="if(event.key==='Enter')Onb.confirmarCodigo()">
          </div>

          <button class="login-btn" id="btn-codigo" onclick="Onb.confirmarCodigo()">Entrar</button>

          <div class="login-alt" style="margin-top:22px">
            Não chegou? <button class="login-link" onclick="Onb.pedirCodigo(true)">Reenviar</button>
          </div>

          <div class="login-alt" style="margin-top:10px">
            <button onclick="Onb.trocarEmail()">Usar outro e-mail</button>
          </div>
        </div>
        ${this.suporteHTML()}
      </div>`;
  },

  async pedirCodigo(reenvio) {
    const campo = document.getElementById('in-email');
    const email = (campo ? campo.value : this.emailPendente).trim().toLowerCase();
    const btn = document.getElementById(reenvio ? 'btn-codigo' : 'btn-auth');

    if (!email || !email.includes('@')) { this.erro = 'Digite um e-mail válido.'; App.render(); return; }

    /* acesso fechado: enquanto CONFIG.ACESSO_TESTE tiver e-mails, só eles
       entram — e entram direto, sem código, porque o envio de e-mail
       ainda não está de pé. Ver o comentário em config.js. */
    const lista = (CONFIG.ACESSO_TESTE || []).map(e => String(e).trim().toLowerCase());
    if (lista.length) {
      if (!lista.includes(email)) {
        this.erro = 'O app ainda está em testes e este e-mail não tem acesso.';
        App.render();
        return;
      }
      this.emailPendente = email;
      if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }
      await App.entrarSemCodigo(email);
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    this.erro = '';

    try {
      await Backend.enviarCodigo(email);
      this.emailPendente = email;
      App.tela = 'codigo';
      App.render();
    } catch (e) {
      this.erro = e.message;
      App.render();
    }
  },

  async confirmarCodigo() {
    const campo = document.getElementById('in-codigo');
    const codigo = (campo ? campo.value : '').trim();
    const btn = document.getElementById('btn-codigo');

    if (codigo.length < 6) { this.erro = 'O código tem 6 números.'; App.render(); return; }

    if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }
    this.erro = '';

    try {
      await Backend.verificarCodigo(this.emailPendente, codigo);
      await App.entrarComSessao();
    } catch (e) {
      this.erro = e.message;
      App.render();
    }
  },

  trocarEmail() {
    this.erro = '';
    App.tela = 'auth';
    App.render();
  },

  /* ---------- abertura ----------
     A mira entra com um fade + leve zoom, parada no centro da tela.
     Antes isso vinha do wordmark "FOCUS FIT" (a mira era só o "O", e um
     recorte circular + filtro escondia o resto até o fim). Agora a
     marca É a mira, sem texto, então a animação ficou só isso. */
  abertura() {
    return `
      <div class="tela-login tela-abertura">
        <div class="login-content">
          <div class="abertura-logo">
            <img src="mira-abertura.png" alt="Focus Fit">
          </div>
        </div>
      </div>`;
  },

  animarAbertura() {
    const comecar = () => {
      const logo = document.querySelector('.abertura-logo');
      if (logo && !logo.classList.contains('tocar')) logo.classList.add('tocar');
    };
    const img = document.querySelector('.abertura-logo img');
    /* só começa com a imagem carregada: animar um <img> vazio faria a
       logo aparecer no meio do movimento */
    if (img && !img.complete) {
      img.onload = () => requestAnimationFrame(comecar);
      img.onerror = comecar;
      setTimeout(comecar, 1200);         // rede lenta: não deixa a tela parada
    } else {
      requestAnimationFrame(comecar);
    }
  },

  /* ---------- telas de carregamento ----------
     Mesma tela, só muda o texto: uma antes de "Seu perfil" (enquanto
     busca as respostas do quiz) e outra antes de "Seu plano está
     pronto" (enquanto o perfil vira plano). */
  carregando(titulo, sub) {
    return `
      <div class="tela-login">
        <div class="login-content">
          ${this.logoHTML()}
          <div class="girando"></div>
          <h1 class="login-h1" style="margin-top:30px">${titulo}</h1>
          <p class="login-sub" style="margin-bottom:0">${sub}</p>
        </div>
        ${this.suporteHTML()}
      </div>`;
  },

  recebendo() {
    return this.carregando(
      'Recebendo suas respostas...',
      'Só um instante enquanto montamos o seu perfil.'
    );
  },

  criando() {
    return this.carregando(
      'Criando seu Plano Personalizado',
      'Calculando suas metas, montando o cardápio e a sua semana de treinos.'
    );
  },

  /* ---------- "Seu perfil": confere as respostas antes de criar o plano ----------
     Chamada de 'revisao' no App.tela porque 'perfil' já é a aba de perfil
     de dentro do app (Telas.perfil), que é outra tela. */
  revisao() {
    const linhas = PERFIL_CAMPOS.map(c => c.secao
      ? `<div class="rev-secao">${c.secao}</div>`
      : this.perfilLinha(c)).join('');

    const branco = this.emBranco;

    return `
      <div class="tela-login tela-perfil">
        <div class="login-content">
          ${this.logoHTML()}

          ${this.convidadoPor ? `
            <div class="aviso" style="margin-bottom:18px">
              Seu acesso foi liberado por <strong>${this.convidadoPor}</strong>, pelo Plano Duo.
              O plano que você montar aqui é só seu: metas, cardápio, treino e progresso separados.
            </div>` : ''}

          <h1 class="login-h1 esq">${branco ? 'Seus dados' : 'Seu perfil'}</h1>
          <p class="login-sub esq">${branco
            ? 'Preencha para o app montar o seu cardápio, o seu treino e as suas metas. Toque em cada linha para responder.'
            : 'Confira o que você respondeu antes de criar seu plano.'}</p>

          ${this.erro ? `<div class="erro">${this.erro}</div>` : ''}

          ${linhas}

          <button class="login-btn" style="margin-top:22px" onclick="Onb.confirmarPerfil()">${branco ? 'Criar meu plano' : 'Confirmar e criar meu plano'}</button>
        </div>
        ${this.suporteHTML()}
      </div>`;
  },

  perfilLinha(c) {
    const aberto = this.abertoPerfil === c.id;
    const valor = this.perfilValor(c);
    const vazio = !valor;

    return `
      <div class="rev-linha${aberto ? ' aberta' : ''}">
        <button class="rev-topo" onclick="Onb.abrirCampo('${c.id}')">
          <span class="rev-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="#3FBE7C" stroke-width="1.7"
                 stroke-linecap="round" stroke-linejoin="round">${PERFIL_ICONES[c.ic]}</svg>
          </span>
          <span class="rev-txt">
            <span class="rev-rot">${c.rot}</span>
            <span class="rev-val${vazio ? ' rev-vazio' : ''}">${valor || (c.tipo === 'texto' || c.tipo === 'numero' ? 'Toque para preencher' : 'Toque para escolher')}</span>
          </span>
          <span class="rev-seta">
            <svg viewBox="0 0 24 24" fill="none" stroke="#3FBE7C" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 5l7 7-7 7"/>
            </svg>
          </span>
        </button>
        ${aberto ? this.perfilEditor(c) : ''}
      </div>`;
  },

  /* texto mostrado na linha, já traduzido do valor guardado */
  perfilValor(c) {
    const v = this.dados[c.id];
    if (v === '' || v === undefined || v === null) return '';

    if (c.tipo === 'multi') {
      const marcados = String(v).split(',').filter(Boolean);
      if (!marcados.length) return '';
      return marcados.map(m => (c.opcoes.find(o => o[0] === m) || [, m])[1]).join(', ');
    }
    if (c.tipo === 'opcoes') {
      const achou = c.opcoes.find(o => o[0] === String(v));
      return achou ? achou[1] : '';
    }
    if (c.tipo === 'numero') return `${v} ${c.un}`;
    return String(v);
  },

  perfilEditor(c) {
    if (c.tipo === 'texto' || c.tipo === 'numero') {
      const tipo = c.tipo === 'numero' ? 'number' : 'text';
      const modo = c.tipo === 'numero' ? 'decimal' : 'text';
      return `
        <div class="rev-ops">
          <input class="rev-input" id="perfil-in" type="${tipo}" inputmode="${modo}"
                 value="${this.dados[c.id] || ''}" placeholder="${c.rot}"
                 onkeydown="if(event.key==='Enter')Onb.salvarCampoTexto('${c.id}')">
          <button class="rev-op ok" onclick="Onb.salvarCampoTexto('${c.id}')">Salvar</button>
        </div>`;
    }

    const marcados = c.tipo === 'multi' ? String(this.dados[c.id] || '').split(',').filter(Boolean) : [];
    return `
      <div class="rev-ops">
        ${c.opcoes.map(([val, rotulo]) => {
          const on = c.tipo === 'multi'
            ? marcados.includes(val)
            : String(this.dados[c.id]) === val;
          const acao = c.tipo === 'multi'
            ? `Onb.alternarMulti('${c.id}','${val}')`
            : `Onb.salvarCampo('${c.id}','${val}')`;
          return `<button class="rev-op${on ? ' on' : ''}" onclick="${acao}">${rotulo}</button>`;
        }).join('')}
        ${c.tipo === 'multi' ? `<button class="rev-op ok" onclick="Onb.abrirCampo('')">Pronto</button>` : ''}
      </div>`;
  },

  abrirCampo(id) {
    this.abertoPerfil = (this.abertoPerfil === id) ? '' : id;
    this.erro = '';
    App.render();
    const campo = document.getElementById('perfil-in');
    if (campo) setTimeout(() => campo.focus(), 60);
  },

  salvarCampo(id, valor) {
    this.dados[id] = valor;
    this.abertoPerfil = '';
    App.render();
  },

  salvarCampoTexto(id) {
    const campo = document.getElementById('perfil-in');
    if (campo) this.dados[id] = campo.value.trim();
    this.abertoPerfil = '';
    App.render();
  },

  alternarMulti(id, valor) {
    let marcados = String(this.dados[id] || '').split(',').filter(Boolean);
    /* "Nenhuma" é exclusiva: marcar ela limpa o resto, e marcar qualquer
       outra tira ela — senão dá pra dizer "nenhuma restrição, sem glúten" */
    if (valor === 'nenhuma') {
      marcados = marcados.includes('nenhuma') ? [] : ['nenhuma'];
    } else {
      marcados = marcados.filter(m => m !== 'nenhuma');
      marcados = marcados.includes(valor) ? marcados.filter(m => m !== valor) : [...marcados, valor];
    }
    this.dados[id] = marcados.join(',');
    App.render();
  },

  confirmarPerfil() {
    const d = this.dados;
    const falta = PERFIL_CAMPOS.find(c => !c.secao && !this.perfilValor(c));
    if (falta) {
      this.erro = `Falta preencher: ${falta.rot}.`;
      this.abertoPerfil = falta.id;
      App.render();
      window.scrollTo(0, 0);
      return;
    }
    if (Number(d.idade) < 14 || Number(d.idade) > 99) return this.falha('Digite uma idade válida.');
    if (Number(d.altura) < 120 || Number(d.altura) > 230) return this.falha('Digite uma altura válida em centímetros.');
    if (Number(d.peso) < 35 || Number(d.peso) > 300) return this.falha('Digite um peso válido.');
    if (Number(d.meta_peso) < 35 || Number(d.meta_peso) > 300) return this.falha('Digite uma meta de peso válida.');

    this.erro = '';
    this.finalizar();
  },

  /* ---------- "Seu plano está pronto" ----------
     Mostra, em três blocos que abrem ao toque, o que o app acabou de
     montar com as respostas dela. Tudo aqui é lido do perfil e dos
     planos que o app já usa nas telas internas: nada é escrito à mão,
     então o que ela vê aqui é o mesmo que vai encontrar lá dentro. */
  plano() {
    const blocos = [
      { id:'metas',    ic:'alvo',   rot:'Metas',    sub:'Os números do seu dia' },
      { id:'cardapio', ic:'prato',  rot:'Cardápio', sub:'Como fica a sua semana' },
      { id:'treino',   ic:'halter', rot:'Treino',   sub:'Sua agenda de treinos' }
    ];
    const nome = (Store.db.perfil.nome || '').split(' ')[0];

    return `
      <div class="tela-login tela-perfil">
        <div class="login-content">
          ${this.logoHTML()}
          <h1 class="login-h1 esq">Seu plano está pronto</h1>
          <p class="login-sub esq">${nome ? nome + ', montamos' : 'Montamos'} tudo com base no que você respondeu. Toque para ver cada parte.</p>

          ${blocos.map(b => {
            const aberto = this.abertoPlano === b.id;
            return `
            <div class="rev-linha${aberto ? ' aberta' : ''}">
              <button class="rev-topo" onclick="Onb.abrirBloco('${b.id}')">
                <span class="rev-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#3FBE7C" stroke-width="1.7"
                       stroke-linecap="round" stroke-linejoin="round">${PERFIL_ICONES[b.ic]}</svg>
                </span>
                <span class="rev-txt">
                  <span class="rev-rot">${b.sub}</span>
                  <span class="rev-val">${b.rot}</span>
                </span>
                <span class="rev-seta">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#3FBE7C" stroke-width="2.2"
                       stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>
                </span>
              </button>
              ${aberto ? `<div class="plano-corpo">${this['bloco_' + b.id]()}</div>` : ''}
            </div>`;
          }).join('')}

          <button class="login-btn" style="margin-top:22px" onclick="Onb.comecar()">Começar</button>
        </div>
        ${this.suporteHTML()}
      </div>`;
  },

  bloco_metas() {
    const p = Store.db.perfil;
    const metas = [
      ['Calorias',     p.meta_kcal + ' kcal', 'por dia'],
      ['Proteína',     p.meta_prot + ' g',    'por dia'],
      ['Carboidratos', p.meta_carb + ' g',    'por dia'],
      ['Água',         (p.meta_agua / 1000).toFixed(1).replace('.', ',') + ' L', 'por dia'],
      ['Sono',         p.meta_sono + ' h',    'por noite']
    ];
    return metas.map(([nome, valor, quando]) => `
      <div class="plano-item">
        <span class="plano-item-nome">${nome}</span>
        <span class="plano-item-val">${valor}<small> ${quando}</small></span>
      </div>`).join('');
  },

  bloco_cardapio() {
    const base = Store.planoBase();
    const refeicoes = Store.planoAlimentar();
    const variacoes = base.refeicoes[0] ? base.refeicoes[0].variacoes.length : 0;

    return `
      ${refeicoes.map(r => {
        const kcal = r.alimentos.reduce((s, a) => s + (a.opcional ? 0 : a.kcal), 0);
        return `
        <div class="plano-item">
          <span class="plano-item-nome">${r.icone} ${r.nome}<small> ${r.horario}</small></span>
          <span class="plano-item-val">${kcal} kcal</span>
        </div>`;
      }).join('')}
      <p class="plano-nota">
        ${variacoes} variações de cada refeição girando pelos dias, para a semana não ficar repetida.
        Dá para trocar qualquer alimento por outro equivalente dentro do app.
        ${base.livre ? '<br><br>' + base.livre : ''}
      </p>`;
  },

  bloco_treino() {
    const plano = Store.planoTreino();
    const dias = Store.diasTreino();

    return `
      <div class="plano-item">
        <span class="plano-item-nome">${plano.nome}</span>
        <span class="plano-item-val">${plano.frequencia}</span>
      </div>
      ${dias.map(d => `
        <div class="plano-item">
          <span class="plano-item-nome">${d.dia}</span>
          <span class="plano-item-val ${d.descanso ? 'plano-folga' : ''}">${d.descanso ? 'Descanso' : d.foco}</span>
        </div>`).join('')}
      <p class="plano-nota">${plano.desc}</p>`;
  },

  abrirBloco(id) {
    this.abertoPlano = (this.abertoPlano === id) ? '' : id;
    App.render();
  },

  async comecar() {
    App.tela = 'inicio';
    App.render();
    window.scrollTo(0, 0);
    const nome = (Store.db.perfil.nome || '').split(' ')[0];
    /* recebe a pessoa com a comemoração do nível 1 em vez de um toast */
    setTimeout(() => { if (!App.checarNivel()) App.toast(`Bora começar, ${nome}! 🌿`, true); }, 500);
  },

  /* ---------- cadastro em 3 passos ---------- */
  cadastro() {
    const d = this.dados;
    const passos = `
      <div class="passos">
        <div class="passo ${App.passo >= 1 ? 'on' : ''}"></div>
        <div class="passo ${App.passo >= 2 ? 'on' : ''}"></div>
        <div class="passo ${App.passo >= 3 ? 'on' : ''}"></div>
      </div>`;

    if (App.passo === 1) return `
      <div class="onb">
        ${passos}
        <h1 class="display">Vamos montar<br>o seu plano</h1>
        <p class="sub">Três passos rápidos. É com isso que o app calcula sua meta de calorias e escolhe o seu treino.</p>
        ${this.erro ? `<div class="erro">${this.erro}</div>` : ''}

        <div class="campo">
          <label>Como você se chama?</label>
          <input id="f-nome" placeholder="Seu nome" value="${d.nome}">
        </div>

        <div class="campo">
          <label>Sua idade</label>
          <input id="f-idade" type="number" inputmode="numeric" placeholder="Ex: 32" value="${d.idade}">
          <div class="dica">Usamos para calcular seu gasto calórico com precisão.</div>
        </div>

        <div class="campo">
          <label>Treinos indicados para</label>
          <div class="opcoes duas">
            <button class="opc ${d.sexo === 'feminino' ? 'on' : ''}" onclick="Onb.set('sexo','feminino')">
              <div class="t">Mulher</div><div class="s">Foco em glúteos e pernas</div>
            </button>
            <button class="opc ${d.sexo === 'masculino' ? 'on' : ''}" onclick="Onb.set('sexo','masculino')">
              <div class="t">Homem</div><div class="s">Divisão de força ABC</div>
            </button>
          </div>
        </div>

        <button class="btn" onclick="Onb.avancar()">Continuar</button>
      </div>`;

    if (App.passo === 2) return `
      <div class="onb">
        ${passos}
        <h1 class="display">Seus números<br>de hoje</h1>
        <p class="sub">Esses dados definem sua meta calórica, sua meta de água e as gramagens do seu cardápio.</p>
        ${this.erro ? `<div class="erro">${this.erro}</div>` : ''}

        <div class="campo">
          <label>Peso atual (kg)</label>
          <input id="f-peso" type="number" inputmode="decimal" step="0.1" placeholder="Ex: 82.5" value="${d.peso}">
        </div>

        <div class="campo">
          <label>Altura (cm)</label>
          <input id="f-altura" type="number" inputmode="numeric" placeholder="Ex: 168" value="${d.altura}">
        </div>

        <div class="campo">
          <label>Meta de peso (kg)</label>
          <input id="f-meta" type="number" inputmode="decimal" step="0.1" placeholder="Ex: 70" value="${d.meta_peso}">
          <div class="dica">Aonde você quer chegar. Dá para mudar depois.</div>
        </div>

        <button class="btn" onclick="Onb.avancar()">Continuar</button>
        <div style="height:10px"></div>
        <button class="btn sec" onclick="Onb.voltar()">Voltar</button>
      </div>`;

    return `
      <div class="onb">
        ${passos}
        <h1 class="display">Objetivo<br>e rotina</h1>
        <p class="sub">Última etapa. É isso que define o cardápio e a planilha de treino que você vai receber.</p>
        ${this.erro ? `<div class="erro">${this.erro}</div>` : ''}

        <div class="campo">
          <label>Qual é o seu objetivo?</label>
          <div class="opcoes">
            <button class="opc ${d.objetivo === 'emagrecimento' ? 'on' : ''}" onclick="Onb.set('objetivo','emagrecimento')">
              <div class="t">Emagrecimento</div><div class="s">Déficit calórico com proteína alta para preservar músculo</div>
            </button>
            <button class="opc ${d.objetivo === 'hipertrofia' ? 'on' : ''}" onclick="Onb.set('objetivo','hipertrofia')">
              <div class="t">Hipertrofia</div><div class="s">Superávit controlado para ganhar massa magra</div>
            </button>
            <button class="opc ${d.objetivo === 'manutencao' ? 'on' : ''}" onclick="Onb.set('objetivo','manutencao')">
              <div class="t">Manutenção</div><div class="s">Sustentar o peso e melhorar a composição corporal</div>
            </button>
          </div>
        </div>

        <div class="campo">
          <label>Onde você vai treinar?</label>
          <div class="opcoes duas">
            <button class="opc ${d.local === 'academia' ? 'on' : ''}" onclick="Onb.set('local','academia')">
              <div class="t">Academia</div><div class="s">Com aparelhos e pesos</div>
            </button>
            <button class="opc ${d.local === 'casa' ? 'on' : ''}" onclick="Onb.set('local','casa')">
              <div class="t">Em casa</div><div class="s">Peso do corpo e elástico</div>
            </button>
          </div>
        </div>

        <button class="btn" onclick="Onb.finalizar()">Criar meu plano</button>
        <div style="height:10px"></div>
        <button class="btn sec" onclick="Onb.voltar()">Voltar</button>
      </div>`;
  },

  set(campo, valor) {
    this.guardarInputs();
    this.dados[campo] = valor;
    this.erro = '';
    App.render();
  },

  /* preserva o que já foi digitado antes de re-renderizar */
  guardarInputs() {
    const pegar = id => { const el = document.getElementById(id); return el ? el.value : null; };
    const m = {
      'f-nome':'nome', 'f-idade':'idade', 'f-peso':'peso',
      'f-altura':'altura', 'f-meta':'meta_peso'
    };
    for (const id in m) { const v = pegar(id); if (v !== null) this.dados[m[id]] = v; }
  },

  avancar() {
    this.guardarInputs();
    const d = this.dados;

    if (App.passo === 1) {
      if (!d.nome.trim()) return this.falha('Digite o seu nome.');
      if (!d.idade || d.idade < 14 || d.idade > 99) return this.falha('Digite uma idade válida.');
      if (!d.sexo) return this.falha('Escolha para qual tipo de treino você quer o plano.');
    }
    if (App.passo === 2) {
      if (!d.peso || d.peso < 35 || d.peso > 300) return this.falha('Digite um peso válido.');
      if (!d.altura || d.altura < 120 || d.altura > 230) return this.falha('Digite uma altura válida em centímetros.');
      if (!d.meta_peso || d.meta_peso < 35 || d.meta_peso > 300) return this.falha('Digite uma meta de peso válida.');
    }

    this.erro = '';
    App.passo++;
    App.render();
    window.scrollTo(0, 0);
  },

  voltar() {
    this.guardarInputs();
    this.erro = '';
    App.passo--;
    App.render();
    window.scrollTo(0, 0);
  },

  falha(msg) { this.erro = msg; App.render(); window.scrollTo(0, 0); },

  async finalizar() {
    this.guardarInputs();
    const d = this.dados;
    if (!d.objetivo) return this.falha('Escolha o seu objetivo.');
    if (!d.local) return this.falha('Escolha onde você vai treinar.');

    Store.criarPerfil(d);
    Backend.salvar();
    /* agora que o perfil existe e foi pra nuvem, as respostas do quiz
       já cumpriram o papel delas e podem sair do banco */
    Backend.limparRespostasQuiz();

    /* carregamento -> plano montado -> app. A comemoração de nível fica
       pro "Começar" (ver Onb.comecar). */
    this.abertoPlano = '';
    App.tela = 'criando';
    App.render();
    window.scrollTo(0, 0);

    const liberado = await App.verificarAssinatura();
    if (!liberado) { App.render(); return; }   // sem pagamento ativo: vai pra tela de assinatura

    await new Promise(ok => setTimeout(ok, 2200));
    App.tela = 'plano';
    App.render();
  },

  /* ---------- tela de assinatura (bloqueio de acesso sem pagamento ativo) ---------- */
  assinatura() {
    const a = App.assinaturaInfo;
    const planos = [
      { chave:'CHECKOUT_URL_MENSAL',     nome:'Mensal',     preco:'R$29,90/mês' },
      { chave:'CHECKOUT_URL_TRIMESTRAL', nome:'Trimestral', preco:'R$74,70 (sai R$24,90/mês)' },
      { chave:'CHECKOUT_URL_ANUAL',      nome:'Anual',      preco:'R$238,80 (sai R$19,90/mês)' }
    ];

    const statusTexto = !a
      ? 'Ainda não encontramos nenhum pagamento pra esta conta.'
      : a.status === 'atrasada'
        ? `Sua assinatura (${a.plano || 'plano'}) está com um pagamento atrasado.`
        : a.status === 'cancelada'
          ? `Sua assinatura (${a.plano || 'plano'}) foi cancelada.`
          : `Sua assinatura (${a.plano || 'plano'}) expirou.`;

    /* ---------- versão da Play Store ----------
       O Google não deixa um app da loja mandar a pessoa pagar fora da
       Play (política de Pagamentos). Um botão de checkout aqui dentro
       derruba a publicação. O que é permitido é o modelo do Netflix:
       quem já assinou entra com a conta, e o app não fala de preço,
       de link nem de onde comprar. É isso que esta tela vira dentro
       do app da loja. Fora dela (navegador, iPhone) nada muda. */
    if (window.NO_APP_DA_LOJA) {
      return `
        <div class="onb">
          <div class="onb-logo">🔒</div>
          <h1 class="display">Não encontramos sua assinatura</h1>
          <p class="sub">${statusTexto} Entre com o mesmo e-mail que você usou na contratação.</p>

          <button class="btn" id="btn-verificar-pgto" onclick="Onb.verificarPagamento()">Verificar de novo</button>

          <a class="btn sec" style="margin-top:10px" href="${CONFIG.SUPORTE_WHATS}" target="_blank" rel="noopener">
            Falar com o suporte
          </a>

          <div style="text-align:center;margin-top:22px">
            <button style="font-size:13px;color:var(--cinza);font-weight:700" onclick="Backend.sair().then(()=>location.reload())">
              Entrar com outro e-mail
            </button>
          </div>
        </div>`;
    }

    return `
      <div class="onb">
        <div class="onb-logo">🔒</div>
        <h1 class="display">Falta só o pagamento</h1>
        <p class="sub">${statusTexto} Escolha um plano pra liberar o app.</p>

        ${planos.map(p => `
          <button class="btn" style="margin-bottom:10px;${CONFIG[p.chave] ? '' : 'opacity:.5;cursor:not-allowed;'}"
            onclick="${CONFIG[p.chave] ? `location.href='${CONFIG[p.chave]}'` : ''}">
            ${p.nome} — ${p.preco}
          </button>`).join('')}

        ${planos.every(p => !CONFIG[p.chave]) ? `
          <div class="aviso" style="margin-top:6px">Os links de pagamento ainda não foram configurados em config.js.</div>
        ` : ''}

        <div style="height:6px"></div>
        <button class="btn sec" id="btn-verificar-pgto" onclick="Onb.verificarPagamento()">Já paguei, verificar de novo</button>

        <div style="text-align:center;margin-top:22px">
          <button style="font-size:13px;color:var(--cinza);font-weight:700" onclick="Backend.sair().then(()=>location.reload())">
            Sair desta conta
          </button>
        </div>
      </div>`;
  },

  async verificarPagamento() {
    const btn = document.getElementById('btn-verificar-pgto');
    if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }
    const ok = await App.verificarAssinatura();
    if (ok) App.tela = 'inicio';
    App.render();
  }
};

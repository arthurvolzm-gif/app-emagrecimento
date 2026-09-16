/* =========================================================
   LOGIN + CADASTRO (onboarding em 3 passos)
   ========================================================= */

/* chave onde o quiz (quiz.html) deixa as respostas.
   Se a pessoa veio de lá, o cadastro já abre preenchido em vez
   de pedir de novo o que ela acabou de responder. */
const CHAVE_QUIZ = 'app_emag_quiz';

function dadosDoQuiz() {
  const vazio = { nome:'', idade:'', sexo:'', peso:'', altura:'', meta_peso:'', objetivo:'', local:'' };
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

const Onb = {
  /* rascunho do cadastro enquanto a pessoa preenche
     (já vem preenchido quando a pessoa chegou pelo quiz) */
  dados: dadosDoQuiz(),
  erro: '',

  /* e-mail digitado na primeira etapa, guardado pra confirmar o código */
  emailPendente: '',

  /* ---------- etapa 1: pedir o e-mail ----------
     Um caminho só pra entrar e pra criar conta: quem nunca entrou
     tem a conta criada na hora que confirma o código. O que decide
     se ela vê as telas internas é a assinatura, não o cadastro. */
  logoHTML() {
    return `
      <div class="login-logo">
        <div class="login-wordmark">
          <span>F</span>
          <span class="login-o">
            <svg width="30" height="30" viewBox="0 0 34 34" fill="none">
              <circle cx="17" cy="17" r="9" stroke="#fff" stroke-width="2.4"/>
              <path d="M17 1v5M17 28v5M1 17h5M28 17h5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
              <circle cx="17" cy="17" r="3" fill="#3FBE7C"/>
            </svg>
          </span>
          <span>CUS</span>
        </div>
        <div class="login-fit">FIT</div>
      </div>`;
  },

  /* link direto pro WhatsApp, sem mensagem pronta — só abre a conversa */
  suporteHTML() {
    return `
      <div class="login-footer">
        <a href="https://wa.me/5541987975115" target="_blank" rel="noopener">Suporte</a>
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
    App.tela = 'inicio';
    await App.verificarAssinatura();   // pode trocar pra 'assinatura' se ainda não tiver pagamento ativo
    App.render();
    window.scrollTo(0, 0);
    /* recebe a pessoa com a comemoração do nível 1 em vez de um toast (só quando entrou mesmo no app) */
    if (App.tela === 'inicio') {
      setTimeout(() => { if (!App.checarNivel()) App.toast(`Plano criado, ${d.nome.split(' ')[0]}! 🌿`, true); }, 500);
    }
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

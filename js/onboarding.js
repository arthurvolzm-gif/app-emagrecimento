/* =========================================================
   LOGIN + CADASTRO (onboarding em 3 passos)
   ========================================================= */

const Onb = {
  /* rascunho do cadastro enquanto a pessoa preenche */
  dados: { nome:'', idade:'', sexo:'', peso:'', altura:'', meta_peso:'', objetivo:'', local:'' },
  erro: '',

  /* ---------- tela de login / criar conta ---------- */
  auth() {
    const criando = App.modoAuth === 'criar';
    return `
      <div class="onb">
        <div class="onb-logo">🌿</div>
        <h1 class="display">${criando ? 'Criar sua conta' : 'Bem-vindo de volta'}</h1>
        <p class="sub">${criando
          ? 'Seu plano alimentar, treinos e progresso ficam salvos na sua conta, acessíveis de qualquer aparelho.'
          : 'Entre para continuar de onde você parou.'}</p>

        ${this.erro ? `<div class="erro">${this.erro}</div>` : ''}

        <div class="campo">
          <label>E-mail</label>
          <input type="email" id="in-email" placeholder="voce@email.com" autocomplete="email">
        </div>

        <div class="campo">
          <label>Senha</label>
          <input type="password" id="in-senha" placeholder="Mínimo 6 caracteres" autocomplete="${criando ? 'new-password' : 'current-password'}">
        </div>

        <button class="btn" id="btn-auth" onclick="Onb.enviarAuth()">
          ${criando ? 'Criar conta e começar' : 'Entrar'}
        </button>

        <div style="text-align:center;margin-top:18px;font-size:13.5px;color:var(--cinza);font-weight:600">
          ${criando ? 'Já tem conta?' : 'Ainda não tem conta?'}
          <button style="color:var(--verde);font-weight:800" onclick="App.trocarModoAuth()">
            ${criando ? 'Entrar' : 'Criar agora'}
          </button>
        </div>

        ${Backend.configurado() ? '' : `
          <div class="aviso" style="margin-top:22px">
            ${Backend.libOk
              ? 'As chaves do servidor não estão preenchidas em config.js. Você pode usar o app normalmente neste aparelho.'
              : 'Não conseguimos falar com o servidor agora. Verifique sua internet e recarregue a página, ou use o app só neste aparelho.'}
          </div>`}

        <div style="text-align:center;margin-top:22px">
          <button style="font-size:13px;color:var(--cinza);font-weight:700" onclick="App.usarLocal()">
            Continuar sem conta neste aparelho
          </button>
        </div>
      </div>`;
  },

  async enviarAuth() {
    const email = document.getElementById('in-email').value.trim();
    const senha = document.getElementById('in-senha').value;
    const btn = document.getElementById('btn-auth');

    if (!email || !senha) { this.erro = 'Preencha e-mail e senha.'; App.render(); return; }
    if (senha.length < 6) { this.erro = 'A senha precisa ter pelo menos 6 caracteres.'; App.render(); return; }

    btn.disabled = true;
    btn.textContent = 'Aguarde...';
    this.erro = '';

    try {
      if (App.modoAuth === 'criar') {
        await Backend.criarConta(email, senha);
        /* conta nova: nunca tem dados, vai direto para o cadastro */
        Store.resetar();
        App.tela = 'cadastro';
        App.passo = 1;
      } else {
        await Backend.entrar(email, senha);
        const remoto = await Backend.carregar();
        if (remoto && remoto.perfil) {
          Store.db = remoto;
          Store.save();
          App.tela = 'inicio';
        } else {
          Store.resetar();
          App.tela = 'cadastro';
          App.passo = 1;
        }
      }
      App.render();
    } catch (e) {
      this.erro = e.message;
      App.render();
    }
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

  finalizar() {
    this.guardarInputs();
    const d = this.dados;
    if (!d.objetivo) return this.falha('Escolha o seu objetivo.');
    if (!d.local) return this.falha('Escolha onde você vai treinar.');

    Store.criarPerfil(d);
    Backend.salvar();
    App.tela = 'inicio';
    App.render();
    window.scrollTo(0, 0);
    setTimeout(() => App.toast(`Plano criado, ${d.nome.split(' ')[0]}! Bora começar. 🌿`, true), 400);
  }
};

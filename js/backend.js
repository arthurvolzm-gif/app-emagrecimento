/* =========================================================
   BACKEND — Supabase (login + sincronização na nuvem)

   Cada usuário tem UMA linha na tabela `dados_usuario`, com todo
   o seu progresso num campo JSON. As políticas RLS garantem que
   ninguém enxerga o dado de ninguém.

   Se as chaves não estiverem preenchidas em config.js, o app
   continua funcionando 100% no aparelho (localStorage).
   ========================================================= */

const Backend = {
  sb: null,
  usuario: null,
  timerSync: null,

  /* estado do carregamento da biblioteca, para dar mensagem certa ao usuário */
  libOk: false,

  /* Garante que a biblioteca do Supabase está carregada.
     Se o CDN principal falhar, tenta o reserva antes de desistir. */
  async carregarLib() {
    if (window.supabase) { this.libOk = true; return true; }

    const cdns = [
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
      'https://unpkg.com/@supabase/supabase-js@2'
    ];

    for (const url of cdns) {
      try {
        await new Promise((ok, falhou) => {
          const s = document.createElement('script');
          s.src = url;
          s.onload = ok;
          s.onerror = () => falhou(new Error('falhou: ' + url));
          document.head.appendChild(s);
        });
        if (window.supabase) { this.libOk = true; return true; }
      } catch (e) { /* tenta o próximo */ }
    }
    return false;
  },

  /* ---------- inicialização ---------- */
  init() {
    /* CONFIG é declarado com const em config.js, então não vira window.CONFIG */
    if (typeof CONFIG === 'undefined' || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) return false;
    if (!window.supabase) return false;
    this.libOk = true;
    try {
      this.sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
      return true;
    } catch (e) {
      console.warn('Supabase indisponível, usando modo local.', e);
      return false;
    }
  },

  configurado() { return !!this.sb; },
  ativo() { return !!(this.sb && this.usuario); },
  emailAtual() { return this.usuario ? this.usuario.email : null; },

  /* ---------- sessão ---------- */
  async sessao() {
    if (!this.sb) return null;
    const { data } = await this.sb.auth.getSession();
    this.usuario = data.session ? data.session.user : null;
    return this.usuario;
  },

  /* barra o uso antes da biblioteca existir, com mensagem clara */
  exigirConexao() {
    if (this.sb) return;
    throw new Error(this.libOk
      ? 'Não foi possível conectar ao servidor. Confira as chaves em config.js.'
      : 'Sem conexão com o servidor agora. Verifique sua internet e recarregue a página.');
  },

  /* ---------- entrada por código no e-mail (sem senha) ----------
     Um fluxo só serve para entrar e para criar conta: se o e-mail
     ainda não tem conta, o Supabase cria na hora que o código é
     confirmado (shouldCreateUser). Quem manda no acesso às telas
     internas é a assinatura, não o cadastro — ver verificarAssinatura. */
  async enviarCodigo(email) {
    this.exigirConexao();
    const { error } = await this.sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true }
    });
    if (error) throw new Error(this.traduzErro(error.message));
    return true;
  },

  async verificarCodigo(email, codigo) {
    this.exigirConexao();
    const { data, error } = await this.sb.auth.verifyOtp({
      email,
      token: (codigo || '').trim(),
      type: 'email'
    });
    if (error) throw new Error(this.traduzErro(error.message));
    this.usuario = data.user;
    return data;
  },

  async sair() {
    if (this.sb) await this.sb.auth.signOut();
    this.usuario = null;
  },

  traduzErro(msg) {
    const m = (msg || '').toLowerCase();
    if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
    if (m.includes('already registered')) return 'Este e-mail já tem conta. Tente entrar.';
    if (m.includes('password') && m.includes('6')) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (m.includes('valid email')) return 'Digite um e-mail válido.';
    if (m.includes('rate limit') || m.includes('too many')) return 'Muitos códigos pedidos. Aguarde um minuto e tente de novo.';
    if (m.includes('expired')) return 'Esse código expirou. Peça um novo.';
    if (m.includes('invalid') && m.includes('token')) return 'Código incorreto. Confira os números do e-mail.';
    if (m.includes('otp')) return 'Código inválido ou expirado. Peça um novo.';
    return msg || 'Algo deu errado. Tente de novo.';
  },

  /* ---------- carregar / salvar ---------- */
  async carregar() {
    if (!this.ativo()) return null;
    const { data, error } = await this.sb
      .from('dados_usuario')
      .select('dados')
      .eq('user_id', this.usuario.id)
      .maybeSingle();

    if (error) { console.warn('Erro ao carregar:', error.message); return null; }
    return data ? data.dados : null;
  },

  /* grava com atraso, para não bater no banco a cada clique */
  agendarSync() {
    if (!this.ativo()) return;
    clearTimeout(this.timerSync);
    this.timerSync = setTimeout(() => this.salvar(), 1500);
  },

  async salvar() {
    if (!this.ativo()) return;
    const { error } = await this.sb
      .from('dados_usuario')
      .upsert({
        user_id: this.usuario.id,
        dados: Store.db,
        atualizado_em: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) console.warn('Erro ao salvar:', error.message);
  },

  /* ---------- assinatura (controle de pagamento via Ticto) ----------
     A linha em `assinaturas` é criada pelo webhook da Ticto (veja
     supabase/functions/ticto-webhook), não pelo app — aqui só lemos.
     Retorna null se não achar nenhuma cobrança pra esse e-mail ainda
     (ex.: pessoa criou conta mas nunca pagou nada). */
  async assinatura() {
    if (!this.ativo()) return null;
    const { data, error } = await this.sb
      .from('assinaturas')
      .select('plano, status, data_expiracao, vagas, titular_email, tem_videos')
      .eq('email', this.usuario.email.toLowerCase())
      .maybeSingle();

    if (error) { console.warn('Erro ao consultar assinatura:', error.message); return null; }
    return data;
  },

  assinaturaAtiva(a) {
    if (!a || a.status !== 'ativa') return false;
    if (!a.data_expiracao) return true;
    return new Date(a.data_expiracao).getTime() > Date.now();
  },

  /* liga a linha da assinatura (que pode ter nascido só com o e-mail,
     antes da conta existir) ao user_id, na primeira vez que a pessoa
     loga — silencioso: se falhar, o app continua funcionando, só
     não deixa a consulta por user_id disponível além da por e-mail. */
  async vincularAssinatura() {
    if (!this.ativo()) return;
    try {
      await this.sb
        .from('assinaturas')
        .update({ user_id: this.usuario.id })
        .eq('email', this.usuario.email.toLowerCase())
        .is('user_id', null);
    } catch (e) { /* não bloqueia o login por causa disso */ }
  },

  /* ---------- ACESSOS EXTRAS (Modo Corrida) ----------
     Compra avulsa, separada da assinatura. Quem grava é o webhook
     (service_role); o app só lê, e só a própria linha — a RLS compara
     com o e-mail do token de sessão.

     Devolve uma lista de nomes de produto: ['corrida']. Sem sessão
     devolve lista vazia, que é o mesmo que "não comprou" — a tranca
     fica do lado do servidor, nunca no aparelho. */
  async extras() {
    if (!this.ativo()) return [];
    const { data, error } = await this.sb
      .from('acessos_extras')
      .select('produto, status, data_expiracao')
      .eq('email', this.usuario.email.toLowerCase());

    if (error) { console.warn('Erro ao consultar acessos extras:', error.message); return []; }
    const agora = Date.now();
    return (data || [])
      /* data_expiracao nula = vitalício (Modo Corrida). Preenchida = é
         assinatura (reajuste mensal) e precisa estar em dia. */
      .filter(r => r.status === 'ativo' &&
                   (!r.data_expiracao || new Date(r.data_expiracao).getTime() > agora))
      .map(r => r.produto);
  },

  /* ---------- PLANO DUO ----------
     A vaga da segunda pessoa não nasce do pagamento: a plataforma de
     checkout só conhece o e-mail de quem pagou. Quem cria a vaga é o
     titular, aqui de dentro, depois da compra.

     As três chamadas passam por função no banco (security definer), não
     pela tabela: `assinaturas` é fechada pra escrita justamente pra
     ninguém se declarar assinante editando o que o navegador manda. Toda
     a conferência (assinatura ativa, vaga livre, e-mail que já tem plano
     próprio) acontece lá dentro, onde o navegador não alcança — e a
     identidade de quem chama vem do token de sessão, que o Supabase
     assina. Ver schema.sql. */
  async duoEstado() {
    if (!this.ativo()) return null;
    const { data, error } = await this.sb.rpc('duo_estado');
    if (error) { console.warn('Erro ao consultar o plano duo:', error.message); return null; }
    return data;
  },

  async duoConvidar(email) {
    if (!this.ativo()) return { ok: false, erro: 'Entre na sua conta para convidar.' };
    const { data, error } = await this.sb.rpc('duo_convidar', { p_email: email });
    if (error) return { ok: false, erro: 'Não foi possível convidar agora. Tente de novo.' };
    return data || { ok: false, erro: 'Não foi possível convidar agora.' };
  },

  async duoRemover(email) {
    if (!this.ativo()) return { ok: false, erro: 'Entre na sua conta.' };
    const { data, error } = await this.sb.rpc('duo_remover', { p_email: email });
    if (error) return { ok: false, erro: 'Não foi possível remover agora. Tente de novo.' };
    return data || { ok: false, erro: 'Não foi possível remover agora.' };
  },

  /* ---------- ponte quiz -> cadastro (respostas salvas no Supabase) ----------
     Complementa o localStorage (que só funciona no mesmo navegador):
     o quiz grava as respostas com um token e manda esse token na URL;
     aqui a gente busca por ele.

     A linha NÃO é apagada na leitura: se a pessoa abrir a tela "Seu
     perfil" e fechar o app antes de confirmar, as respostas dela ainda
     estarão lá na próxima vez. Quem apaga é limparRespostasQuiz(),
     chamada só depois que o perfil existe de verdade. */
  quizLido: null,      // { campo: 'token'|'email', valor } da linha que já foi usada

  async buscarRespostasQuiz(token) {
    if (!this.sb || !token) return null;
    /* via função no banco, não direto na tabela: a RLS não deixa ler
       respostas_quiz de fora, justamente pra ninguém baixar a lista
       inteira com a chave pública. Ver schema.sql. */
    const { data, error } = await this.sb.rpc('buscar_resposta_quiz', { p_token: token });

    if (error || !data) return null;
    this.quizLido = { campo: 'token', valor: token };
    return data;
  },

  /* apaga as respostas do quiz que já viraram perfil. Silencioso: se
     falhar, a limpeza automática do banco pega depois (ver schema.sql). */
  async limparRespostasQuiz() {
    if (!this.sb || !this.quizLido) return;
    const { campo, valor } = this.quizLido;
    this.quizLido = null;
    try {
      if (campo === 'token') {
        await this.sb.rpc('consumir_resposta_quiz', { p_token: valor });
      } else {
        /* por e-mail só apaga quem está logado com ele: é o que a RLS
           permite, e é o suficiente porque a linha é dessa pessoa */
        await this.sb.from('respostas_quiz').delete().eq(campo, valor);
      }
    } catch (e) { /* não trava a criação do plano por causa disso */ }
  },

  /* ---------- ponte quiz -> cadastro pelo e-mail ----------
     A outra ponta da mesma ideia, sem depender de link nenhum: quem
     digitou o e-mail no quiz e depois entra no app com esse mesmo
     e-mail acha as próprias respostas. É o caminho que funciona
     dentro do APK e em outro aparelho, dias depois.

     Só roda com a pessoa já logada: a RLS compara o e-mail da linha
     com o e-mail do token de sessão, então ninguém lê a resposta de
     outro. Pega a mais recente; apagar fica pra limparRespostasQuiz(). */
  /* emailForcado existe pro acesso de teste (CONFIG.ACESSO_TESTE), que
     entra sem sessão: aí não há usuário logado de quem tirar o e-mail. */
  async buscarRespostasQuizPorEmail(emailForcado) {
    if (!this.sb) return null;
    if (!emailForcado && !this.ativo()) return null;
    const email = String(emailForcado || this.usuario.email || '').trim().toLowerCase();
    if (!email) return null;

    const { data, error } = await this.sb
      .from('respostas_quiz')
      .select('token, respostas')
      .eq('email', email)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    this.quizLido = { campo: 'email', valor: email };
    return data.respostas;
  }
};

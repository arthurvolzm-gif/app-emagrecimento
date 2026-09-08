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

  /* ---------- inicialização ---------- */
  init() {
    if (!window.CONFIG || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) return false;
    if (!window.supabase) return false;
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

  async criarConta(email, senha) {
    const { data, error } = await this.sb.auth.signUp({ email, password: senha });
    if (error) throw new Error(this.traduzErro(error.message));
    this.usuario = data.user;
    return data;
  },

  async entrar(email, senha) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password: senha });
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
    if (m.includes('rate limit')) return 'Muitas tentativas. Aguarde um instante.';
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
  }
};

/* =========================================================
   STORE — estado, persistência e cálculos
   Hoje grava no localStorage do navegador.
   Para ligar o Supabase depois, basta reescrever save()/load()
   e as funções de leitura: o resto do app não muda.
   ========================================================= */

const CHAVE = 'app_emag_v1';

const Store = {
  db: null,

  /* ---------- persistência ---------- */
  load() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      this.db = bruto ? JSON.parse(bruto) : this.vazio();
    } catch (e) {
      this.db = this.vazio();
    }
    return this.db;
  },

  save() {
    try { localStorage.setItem(CHAVE, JSON.stringify(this.db)); } catch (e) {}
  },

  vazio() {
    return { perfil: null, dias: {}, pesagens: [] };
  },

  resetar() {
    this.db = this.vazio();
    this.save();
  },

  /* ---------- datas ---------- */
  hoje() { return this.iso(new Date()); },

  iso(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  },

  deIso(s) {
    const [a, m, d] = s.split('-').map(Number);
    return new Date(a, m - 1, d);
  },

  diasAtras(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return this.iso(d);
  },

  /* ---------- perfil ---------- */
  criarPerfil(dados) {
    const perfil = {
      nome: dados.nome,
      sexo: dados.sexo,                 // 'feminino' | 'masculino'
      idade: Number(dados.idade),
      altura: Number(dados.altura),     // cm
      peso_inicial: Number(dados.peso),
      peso_atual: Number(dados.peso),
      meta_peso: Number(dados.meta_peso),
      objetivo: dados.objetivo,         // 'emagrecimento' | 'hipertrofia' | 'manutencao'
      local: dados.local,               // 'academia' | 'casa'
      criado_em: this.hoje()
    };
    perfil.meta_kcal = this.calcMetaKcal(perfil);
    perfil.meta_agua = this.calcMetaAgua(perfil);   // ml
    perfil.meta_sono = 8;                            // horas
    perfil.meta_prot = this.calcMetaProt(perfil);    // g

    this.db.perfil = perfil;
    this.db.pesagens = [{ data: this.hoje(), peso: perfil.peso_inicial }];
    this.save();
    return perfil;
  },

  atualizarPerfil(campos) {
    Object.assign(this.db.perfil, campos);
    const p = this.db.perfil;
    p.meta_kcal = this.calcMetaKcal(p);
    p.meta_agua = this.calcMetaAgua(p);
    p.meta_prot = this.calcMetaProt(p);
    this.save();
  },

  temPerfil() { return !!(this.db && this.db.perfil); },

  /* ---------- cálculos de meta ---------- */
  /* Mifflin-St Jeor + fator de atividade + ajuste do objetivo */
  calcMetaKcal(p) {
    const base = 10 * p.peso_atual + 6.25 * p.altura - 5 * p.idade;
    const tmb = p.sexo === 'masculino' ? base + 5 : base - 161;
    const get = tmb * 1.45;
    const fator = p.objetivo === 'emagrecimento' ? 0.80
                : p.objetivo === 'hipertrofia'   ? 1.12
                : 1.00;
    return Math.round(get * fator / 10) * 10;
  },

  calcMetaAgua(p) {
    return Math.round(p.peso_atual * 35 / 100) * 100;  // ml, arredondado
  },

  calcMetaProt(p) {
    const gkg = p.objetivo === 'emagrecimento' ? 2.0
              : p.objetivo === 'hipertrofia'   ? 1.8
              : 1.6;
    return Math.round(p.peso_atual * gkg);
  },

  /* ---------- plano alimentar reescalado para a meta ---------- */
  planoAlimentar() {
    const p = this.db.perfil;
    const plano = PLANOS_ALIMENTARES[p.objetivo] || PLANOS_ALIMENTARES.emagrecimento;
    let fator = p.meta_kcal / plano.kcalBase;
    fator = Math.max(0.6, Math.min(1.8, fator));

    return plano.refeicoes.map(r => ({
      ...r,
      alimentos: r.alimentos.map(a => ({
        ...a,
        g: Math.round(a.g * fator),
        kcal: Math.round(a.kcal * fator),
        prot: Math.round(a.prot * fator)
      }))
    }));
  },

  planoTreino() {
    const p = this.db.perfil;
    return PLANOS_TREINO[`${p.sexo}_${p.local}`] || PLANOS_TREINO.feminino_academia;
  },

  /* ---------- registro diário ---------- */
  dia(data) {
    const d = data || this.hoje();
    if (!this.db.dias[d]) {
      this.db.dias[d] = { alimentos: [], agua: 0, sono: 0, treino: false };
    }
    return this.db.dias[d];
  },

  /* marca/desmarca um alimento. chave = 'refeicaoId:alimentoId' */
  alternarAlimento(refId, alimId) {
    const d = this.dia();
    const chave = `${refId}:${alimId}`;
    const i = d.alimentos.indexOf(chave);
    if (i >= 0) d.alimentos.splice(i, 1);
    else d.alimentos.push(chave);
    this.save();
  },

  alimentoMarcado(refId, alimId) {
    return this.dia().alimentos.indexOf(`${refId}:${alimId}`) >= 0;
  },

  marcarRefeicaoToda(refId, marcar) {
    const d = this.dia();
    const ref = this.planoAlimentar().find(r => r.id === refId);
    ref.alimentos.forEach(a => {
      const chave = `${refId}:${a.id}`;
      const i = d.alimentos.indexOf(chave);
      if (marcar && i < 0) d.alimentos.push(chave);
      if (!marcar && i >= 0) d.alimentos.splice(i, 1);
    });
    this.save();
  },

  addAgua(ml) {
    const d = this.dia();
    d.agua = Math.max(0, d.agua + ml);
    this.save();
  },

  setSono(h) {
    const d = this.dia();
    d.sono = Math.max(0, Math.min(14, h));
    this.save();
  },

  alternarTreino() {
    const d = this.dia();
    d.treino = !d.treino;
    this.save();
    return d.treino;
  },

  registrarPeso(peso) {
    const hoje = this.hoje();
    /* uma pesagem por dia: remove qualquer registro anterior da mesma data */
    this.db.pesagens = this.db.pesagens.filter(p => p.data !== hoje);
    this.db.pesagens.push({ data: hoje, peso: Number(peso) });
    this.db.pesagens.sort((a, b) => a.data.localeCompare(b.data));
    this.db.perfil.peso_atual = Number(peso);
    this.atualizarPerfil({});
    this.save();
  },

  /* ---------- totais do dia ---------- */
  totaisDoDia(data) {
    const d = this.db.dias[data || this.hoje()];
    const plano = this.planoAlimentar();
    let kcal = 0, prot = 0, marcados = 0, total = 0;

    plano.forEach(r => {
      r.alimentos.forEach(a => {
        total++;
        if (d && d.alimentos.indexOf(`${r.id}:${a.id}`) >= 0) {
          kcal += a.kcal; prot += a.prot; marcados++;
        }
      });
    });

    return {
      kcal, prot, marcados, total,
      agua: d ? d.agua : 0,
      sono: d ? d.sono : 0,
      treino: d ? d.treino : false
    };
  },

  /* progresso de uma refeição específica: [marcados, total] */
  progressoRefeicao(ref, data) {
    const d = this.db.dias[data || this.hoje()];
    if (!d) return [0, ref.alimentos.length];
    const m = ref.alimentos.filter(a => d.alimentos.indexOf(`${ref.id}:${a.id}`) >= 0).length;
    return [m, ref.alimentos.length];
  },

  /* ---------- pontos e níveis ---------- */
  pontosDoDia(data) {
    const d = this.db.dias[data];
    if (!d) return 0;
    const p = this.db.perfil;
    let pts = d.alimentos.length * PONTOS.alimento;

    /* bônus por refeição completa */
    this.planoAlimentar().forEach(r => {
      const [m, t] = this.progressoRefeicao(r, data);
      if (t > 0 && m === t) pts += PONTOS.refeicao;
    });

    if (d.agua >= p.meta_agua) pts += PONTOS.agua;
    if (d.sono >= p.meta_sono) pts += PONTOS.sono;
    if (d.treino) pts += PONTOS.treino;
    return pts;
  },

  pontosTotais() {
    let total = Object.keys(this.db.dias).reduce((s, d) => s + this.pontosDoDia(d), 0);
    total += this.db.pesagens.length * PONTOS.pesagem;
    return total;
  },

  nivel() {
    const pts = this.pontosTotais();
    let atual = NIVEIS[0];
    for (const n of NIVEIS) if (pts >= n.min) atual = n;

    const proximo = NIVEIS.find(n => n.min > pts) || null;
    const base = atual.min;
    const alvo = proximo ? proximo.min : atual.min;
    const pct = proximo ? Math.round(((pts - base) / (alvo - base)) * 100) : 100;

    return { ...atual, pontos: pts, proximo, pct, faltam: proximo ? alvo - pts : 0 };
  },

  /* ---------- streak (dias seguidos com atividade) ---------- */
  streak() {
    let dias = 0;
    for (let i = 0; i < 400; i++) {
      const data = this.diasAtras(i);
      const d = this.db.dias[data];
      const pesou = this.db.pesagens.some(p => p.data === data);
      const ativo = pesou || (d && (d.alimentos.length > 0 || d.treino || d.agua > 0 || d.sono > 0));
      if (ativo) { dias++; continue; }
      /* o dia de hoje ainda pode estar zerado sem quebrar a sequência */
      if (i === 0) continue;
      break;
    }
    return dias;
  },

  /* ---------- agregados para a página de progresso ---------- */
  resumo(periodo) {
    const qtdDias = periodo === 'mes' ? 30 : 7;
    const datas = [];
    for (let i = qtdDias - 1; i >= 0; i--) datas.push(this.diasAtras(i));

    let treinos = 0, agua = 0, kcal = 0, prot = 0, refeicoes = 0, diasAtivos = 0;

    datas.forEach(data => {
      const d = this.db.dias[data];
      if (!d) return;
      const t = this.totaisDoDia(data);
      if (d.treino) treinos++;
      agua += d.agua;
      kcal += t.kcal;
      prot += t.prot;
      this.planoAlimentar().forEach(r => {
        const [m, tt] = this.progressoRefeicao(r, data);
        if (tt > 0 && m === tt) refeicoes++;
      });
      if (d.alimentos.length || d.treino || d.agua || d.sono) diasAtivos++;
    });

    /* peso perdido dentro do período */
    const inicio = datas[0];
    const pesagensPeriodo = this.db.pesagens.filter(p => p.data >= inicio);
    let pesoPerdido = 0;
    if (pesagensPeriodo.length >= 2) {
      pesoPerdido = pesagensPeriodo[0].peso - pesagensPeriodo[pesagensPeriodo.length - 1].peso;
    } else if (pesagensPeriodo.length === 1 && this.db.pesagens.length >= 2) {
      const anterior = this.db.pesagens.filter(p => p.data < inicio).pop();
      if (anterior) pesoPerdido = anterior.peso - pesagensPeriodo[0].peso;
    }

    return {
      dias: qtdDias, treinos, refeicoes, diasAtivos,
      agua: Math.round(agua / 100) / 10,          // litros
      kcal, prot,
      kcalMedia: diasAtivos ? Math.round(kcal / diasAtivos) : 0,
      pesoPerdido: Math.round(pesoPerdido * 10) / 10
    };
  },

  /* série do gráfico de peso */
  seriePeso() {
    return this.db.pesagens.slice(-12);
  },

  /* metas batidas nos últimos 7 dias, para o card do dashboard */
  metasSemana() {
    const p = this.db.perfil;
    let agua = 0, sono = 0, treino = 0, dieta = 0;
    for (let i = 0; i < 7; i++) {
      const data = this.diasAtras(i);
      const d = this.db.dias[data];
      if (!d) continue;
      if (d.agua >= p.meta_agua) agua++;
      if (d.sono >= p.meta_sono) sono++;
      if (d.treino) treino++;
      const t = this.totaisDoDia(data);
      if (t.total > 0 && t.marcados === t.total) dieta++;
    }
    return { agua, sono, treino, dieta };
  }
};

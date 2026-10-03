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
    return { perfil: null, dias: {}, pesagens: [], cargas: {}, trocas: {}, corridas: [], reajustes: [], medidas: [] };
  },

  /* ---------- MODO CORRIDA ----------
     Registro das corridas dela: tempo, distância, ritmo e calorias.
     Cada corrida é uma linha; nada aqui decide acesso (isso é
     App.temCorrida, que pergunta ao banco). */
  corridas() {
    if (!Array.isArray(this.db.corridas)) this.db.corridas = [];
    return this.db.corridas;
  },

  /* velocidade em km/h a partir de metros e segundos */
  velocidade(metros, segundos) {
    if (!segundos || !metros) return 0;
    return (metros / 1000) / (segundos / 3600);
  },

  /* kcal = MET × 3,5 × peso / 200 × minutos (Compêndio de Atividades
     Físicas). ESTIMATIVA: sem frequência cardíaca não há número exato,
     e a tela diz isso em vez de fingir precisão. */
  caloriasCorrida(metros, segundos) {
    const peso = (this.db.perfil && this.db.perfil.peso_atual) || 70;
    const kmh = this.velocidade(metros, segundos);
    let met = CORRIDA_MET[0][1];
    for (const [v, m] of CORRIDA_MET) if (kmh >= v) met = m;
    return Math.round(met * 3.5 * peso / 200 * (segundos / 60));
  },

  /* ritmo em segundos por km (o "pace"), que é como corredor pensa */
  ritmo(metros, segundos) {
    if (!metros || metros < 50) return 0;
    return Math.round(segundos / (metros / 1000));
  },

  faixaCorrida(metros, segundos) {
    const kmh = this.velocidade(metros, segundos);
    let nome = CORRIDA_FAIXAS[0][1];
    for (const [v, n] of CORRIDA_FAIXAS) if (kmh >= v) nome = n;
    return nome;
  },

  salvarCorrida({ segundos, metros, gps }) {
    const c = this.corridas();
    const reg = {
      data: this.hoje(),
      quando: new Date().toISOString(),
      segundos: Math.round(Number(segundos) || 0),
      metros: Math.round(Number(metros) || 0),
      gps: !!gps
    };
    reg.kcal = this.caloriasCorrida(reg.metros, reg.segundos);
    reg.ritmo = this.ritmo(reg.metros, reg.segundos);
    c.push(reg);
    this.save();
    return reg;
  },

  apagarCorrida(quando) {
    this.db.corridas = this.corridas().filter(c => c.quando !== quando);
    this.save();
  },

  /* os números do topo da tela: total, melhor ritmo, semana atual */
  resumoCorridas() {
    const lista = this.corridas();
    const metros = lista.reduce((s, c) => s + c.metros, 0);
    const segundos = lista.reduce((s, c) => s + c.segundos, 0);
    const kcal = lista.reduce((s, c) => s + (c.kcal || 0), 0);

    /* melhor ritmo só entre corridas com distância de verdade: 300m
       medidos torto dariam um "recorde" que nunca aconteceu */
    const comRitmo = lista.filter(c => c.metros >= 1000 && c.ritmo);
    const melhor = comRitmo.length ? Math.min(...comRitmo.map(c => c.ritmo)) : 0;

    const hoje = new Date();
    const desdeSegunda = (hoje.getDay() + 6) % 7;
    const inicioSemana = this.diasAtras(desdeSegunda);
    const semana = lista.filter(c => c.data >= inicioSemana);

    return {
      total: lista.length,
      metros, segundos, kcal, melhor,
      maisLonga: lista.reduce((a, c) => (c.metros > (a ? a.metros : 0) ? c : a), null),
      semanaQtd: semana.length,
      semanaMetros: semana.reduce((s, c) => s + c.metros, 0)
    };
  },

  /* quantas corridas registradas: é o que vira ponto (ver pontosTotais) */
  corridaConcluidas() {
    return this.corridas().length;
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
      /* o formulário sempre manda meta_peso, mas o quiz manda meta_kg
         (quilos a eliminar). Sem essa rede, quem viesse só do quiz
         ficava com NaN na tela de peso e no perfil. */
      meta_peso: Number(dados.meta_peso) ||
                 Math.max(35, Math.round((Number(dados.peso) - (Number(dados.meta_kg) || 0)) * 10) / 10),
      objetivo: dados.objetivo,         // 'emagrecimento' | 'hipertrofia' | 'manutencao'
      local: dados.local,               // 'academia' | 'casa'
      dias_treino: Number(dados.dias_treino) || 5,  // quantos dias por semana a pessoa quer treinar (do quiz)
      /* respondidos na tela "Seu perfil", logo depois do login.
         Ainda não entram em nenhum cálculo: ficam guardados para
         personalizar treino e cardápio. */
      sono_hoje: dados.sono,
      agua_hoje: dados.agua,
      nivel_treino: dados.nivel_treino,     // iniciante | intermediario | avancado
      tempo_treino: Number(dados.tempo_treino) || '',  // minutos por sessão
      refeicoes: Number(dados.refeicoes) || '',        // refeições por dia
      restricoes: dados.restricoes || '',              // lista separada por vírgula
      ordem_treino: [0, 1, 2, 3, 4, 5, 6],
      nivel_visto: 0,       // 0 para a comemoração do nível 1 disparar no primeiro acesso
      streak_visto: 0,      // último marco de sequência já comemorado (ver STREAK_MARCOS)
      criado_em: this.hoje()
    };
    this.recalcularMetas(perfil);   // meta_kcal, meta_prot, meta_carb (g), meta_agua (ml), meta_sono (h)

    this.db.perfil = perfil;
    this.db.pesagens = [{ data: this.hoje(), peso: perfil.peso_inicial }];
    this.save();
    return perfil;
  },

  atualizarPerfil(campos) {
    Object.assign(this.db.perfil, campos);
    this.recalcularMetas(this.db.perfil);
    this.save();
  },

  /* ---------- metas: sugestão do app ou a que ela escolheu ----------
     Cada meta tem a conta do app (abaixo) e, se ela preferir, um número
     dela em `metas_manuais`. O que ela escolheu vence; o que ela não
     mexeu continua acompanhando o peso a cada pesagem.
     O carboidrato é calculado DEPOIS de calorias e proteína, já com os
     números finais: se ela subir a proteína, a sugestão de carboidrato
     desce junto pra fechar a mesma caloria. */
  recalcularMetas(p) {
    const m = (p && p.metas_manuais) || {};
    p.meta_kcal = Number(m.kcal) || this.calcMetaKcal(p);
    p.meta_prot = Number(m.prot) || this.calcMetaProt(p);
    p.meta_carb = Number(m.carb) || this.calcMetaCarb(p);
    p.meta_agua = Number(m.agua) || this.calcMetaAgua(p);
    p.meta_sono = Number(m.sono) || 8;
  },

  /* o que o app sugere pra cada meta, com os números de agora */
  sugestaoMetas() {
    const p = this.db.perfil;
    const base = { ...p, metas_manuais: {} };
    const kcal = this.calcMetaKcal(base);
    const prot = this.calcMetaProt(base);
    return {
      kcal, prot,
      /* carboidrato sugerido em cima das calorias e da proteína que valem
         pra ela (as dela, se escolheu) */
      carb: this.calcMetaCarb({ ...base, meta_kcal: p.meta_kcal, meta_prot: p.meta_prot }),
      agua: this.calcMetaAgua(base),
      sono: 8
    };
  },

  /* grava as metas dela. Valor vazio ou igual à sugestão volta pro
     automático, pra ninguém ficar preso num número que parou de mudar. */
  definirMetas(campos) {
    const p = this.db.perfil;
    if (!p.metas_manuais || typeof p.metas_manuais !== 'object') p.metas_manuais = {};
    for (const k in campos) {
      const v = Number(campos[k]);
      if (!v || v <= 0) delete p.metas_manuais[k];
      else p.metas_manuais[k] = v;
    }
    this.recalcularMetas(p);
    const sug = this.sugestaoMetas();
    for (const k in p.metas_manuais) if (Number(p.metas_manuais[k]) === Number(sug[k])) delete p.metas_manuais[k];
    this.recalcularMetas(p);
    this.save();
  },

  metaManual(k) {
    const m = this.db.perfil && this.db.perfil.metas_manuais;
    return !!(m && m[k]);
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

  /* 35 ml por quilo de peso corporal, arredondado para meio litro —
     assim a meta vira 2,5L / 3L em vez de 2,9L, e fecha certinho
     com os copos de 250 ml do botão de água.                        */
  calcMetaAgua(p) {
    const bruto = p.peso_atual * 35;
    const arredondado = Math.round(bruto / 500) * 500;
    return Math.max(1500, Math.min(4500, arredondado));
  },

  calcMetaProt(p) {
    const gkg = p.objetivo === 'emagrecimento' ? 2.0
              : p.objetivo === 'hipertrofia'   ? 1.8
              : 1.6;
    return Math.round(p.peso_atual * gkg);
  },

  /* O que sobra das calorias depois da proteína e da gordura vira
     carboidrato. A gordura fica em 25% das calorias do dia, que é a
     faixa usada em dieta comum e evita cair abaixo do mínimo saudável.
     Proteína e carboidrato têm 4 kcal por grama; gordura, 9.          */
  calcMetaCarb(p) {
    const kcal = p.meta_kcal || this.calcMetaKcal(p);
    const prot = p.meta_prot || this.calcMetaProt(p);
    const kcalGordura = kcal * 0.25;
    const kcalCarb = kcal - (prot * 4) - kcalGordura;
    return Math.max(0, Math.round(kcalCarb / 4));
  },

  /* ---------- plano alimentar reescalado para a meta ---------- */
  planoBase() {
    const p = this.db.perfil;
    return PLANOS_ALIMENTARES[p.objetivo] || PLANOS_ALIMENTARES.emagrecimento;
  },

  /* ---------- variação do cardápio ----------
     Cada refeição tem 3 variações que giram pelos dias da semana:
     Seg=1ª, Ter=2ª, Qua=3ª, Qui=1ª, Sex=2ª, Sáb=3ª, Dom=1ª.       */
  variacaoDoDia(data) {
    const d = data ? this.deIso(data) : new Date();
    const dow = d.getDay();                     // 0=Dom
    const pos = dow === 0 ? 6 : dow - 1;        // 0=Seg ... 6=Dom
    return pos % 3;
  },

  /* o cardápio de uma data. SEMPRE passe a data ao calcular dias
     passados, senão o histórico usa o cardápio de hoje.           */
  planoAlimentar(data) {
    return this._planoDaVariacao(this.variacaoDoDia(data));
  },

  _planoDaVariacao(v) {
    const p = this.db.perfil;
    if (this.dietaPropriaAtiva()) return this._planoProprio();
    const plano = this.planoBase();
    const horas = (p && p.horarios_refeicao) || {};

    const refeicoes = plano.refeicoes.map(r => {
      const varia = r.variacoes[v % r.variacoes.length];
      return {
        id: r.id, nome: r.nome, horario: horas[r.id] || r.horario, icone: r.icone,
        variacao: varia.nome,
        alimentos: varia.alimentos
      };
    });

    /* a base é somada dos próprios alimentos do dia (sem os opcionais),
       então editar o cardápio nunca desalinha o cálculo */
    const base = refeicoes.reduce((s, r) =>
      s + r.alimentos.reduce((x, a) => x + (a.opcional ? 0 : a.kcal), 0), 0) || 1;

    let fator = p.meta_kcal / base;
    fator = Math.max(0.6, Math.min(1.8, fator));

    return refeicoes.map(r => ({
      ...r,
      alimentos: r.alimentos.map(a => {
        const g = Math.round(a.g * fator);
        const item = {
          ...a,
          g,
          kcal: Math.round(a.kcal * fator),
          prot: Math.round(a.prot * fator),
          carb: Math.round((CARB_100G[a.nome] || 0) * g / 100)
        };

        /* se a pessoa escolheu uma troca para este alimento, ela passa a
           ser o item mostrado — calorias e proteína seguem as mesmas, já
           que as opções foram escritas como porções equivalentes */
        const idx = this.trocaDe(a.nome);
        if (idx !== null && Array.isArray(a.alt) && a.alt[idx]) {
          item.nomeOriginal = a.nome;
          item.nome = a.alt[idx];
          item.trocado = true;
        }
        return item;
      })
    }));
  },

  /* ---------- trocas de alimento ----------
     Guardadas pelo NOME original, então valem em todas as refeições
     em que aquele alimento aparece.                                  */
  trocaDe(nome) {
    const t = this.db.trocas || {};
    return (nome in t) ? t[nome] : null;
  },

  definirTroca(nome, idx) {
    if (!this.db.trocas) this.db.trocas = {};
    if (idx === null) delete this.db.trocas[nome];
    else this.db.trocas[nome] = Number(idx);
    this.save();
  },

  /* ---------- horário de cada refeição ----------
     Vale pros dois cardápios: no do app fica em `horarios_refeicao`, por
     id da refeição; na dieta própria, dentro da própria refeição. É o
     mesmo horário que o lembrete de refeição usa. */
  definirHoraRefeicao(id, hora) {
    const p = this.db.perfil;
    if (this.dietaPropriaAtiva()) {
      const r = p.dieta_propria.refeicoes.find(x => x.id === id);
      if (r && hora) r.horario = hora;
    } else {
      if (!p.horarios_refeicao || typeof p.horarios_refeicao !== 'object') p.horarios_refeicao = {};
      if (hora) p.horarios_refeicao[id] = hora; else delete p.horarios_refeicao[id];
    }
    this.save();
  },

  /* ---------- DIETA PRÓPRIA ----------
     Quem já tem a rotina alimentar dela monta aqui: as refeições, os
     alimentos de cada uma e a quantidade em gramas. Calorias, proteína e
     carboidrato saem da tabela ALIMENTOS (por 100 g) vezes a gramagem.
     Com ela ligada, o cardápio do app sai de cena inteiro: não reescala
     pela meta, não gira variação e não oferece troca. É o prato dela.

     Guardado no perfil pra viajar junto na nuvem:
       dieta_propria = { ativa, refeicoes: [{ id, nome, horario,
         alimentos: [{ id, ref, nome, g, kcal100, prot100, carb100 }] }] } */
  dietaPropriaAtiva() {
    const d = this.db.perfil && this.db.perfil.dieta_propria;
    return !!(d && d.ativa && Array.isArray(d.refeicoes) && d.refeicoes.length);
  },

  dietaPropria() {
    const p = this.db.perfil;
    if (!p.dieta_propria || !Array.isArray(p.dieta_propria.refeicoes)) {
      /* começa com as refeições e horários do cardápio do app, vazias:
         é mais fácil apagar uma que sobrou do que lembrar de criar */
      p.dieta_propria = {
        ativa: false,
        refeicoes: this.planoBase().refeicoes.map(r => ({
          id: 'p' + r.id, nome: r.nome, horario: (p.horarios_refeicao || {})[r.id] || r.horario, alimentos: []
        }))
      };
    }
    return p.dieta_propria;
  },

  _itemProprio(a) {
    const g = Math.max(0, Number(a.g) || 0);
    return {
      id: a.id, nome: a.nome, g, un: g + ' g',
      kcal: Math.round((a.kcal100 || 0) * g / 100),
      prot: Math.round((a.prot100 || 0) * g / 100),
      carb: Math.round((a.carb100 || 0) * g / 100)
    };
  },

  _planoProprio() {
    return this.dietaPropria().refeicoes.map(r => ({
      id: r.id, nome: r.nome, horario: r.horario, icone: '',
      variacao: '',
      alimentos: r.alimentos.map(a => this._itemProprio(a))
    }));
  },

  /* a soma do dia da dieta dela, pra comparar com as metas */
  totaisDietaPropria() {
    const t = { kcal: 0, prot: 0, carb: 0 };
    this._planoProprio().forEach(r => r.alimentos.forEach(a => { t.kcal += a.kcal; t.prot += a.prot; t.carb += a.carb; }));
    return t;
  },

  ativarDietaPropria(ligar) {
    this.dietaPropria().ativa = !!ligar;
    this.save();
  },

  _novoId(prefixo) {
    return prefixo + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },

  addRefeicaoPropria(nome, horario) {
    const d = this.dietaPropria();
    const r = { id: this._novoId('p'), nome: nome || 'Refeição', horario: horario || '12:00', alimentos: [] };
    d.refeicoes.push(r);
    d.refeicoes.sort((a, b) => a.horario.localeCompare(b.horario));
    this.save();
    return r;
  },

  editarRefeicaoPropria(id, campos) {
    const r = this.dietaPropria().refeicoes.find(x => x.id === id);
    if (!r) return;
    if (campos.nome !== undefined) r.nome = String(campos.nome).trim() || r.nome;
    if (campos.horario) r.horario = campos.horario;
    this.dietaPropria().refeicoes.sort((a, b) => a.horario.localeCompare(b.horario));
    this.save();
  },

  removerRefeicaoPropria(id) {
    const d = this.dietaPropria();
    d.refeicoes = d.refeicoes.filter(x => x.id !== id);
    this.save();
  },

  /* alimento que não está na tabela: ela digita o nome e os valores
     por 100 g (os do rótulo) */
  addAlimentoLivre(refId, gramas, livre) {
    const r = this.dietaPropria().refeicoes.find(x => x.id === refId);
    if (!r || !livre || !livre.nome) return null;
    const a = { id: this._novoId('a'), ref: null, nome: String(livre.nome).trim(), g: Math.round(Number(gramas) || 0),
                kcal100: Number(livre.kcal) || 0, prot100: Number(livre.prot) || 0, carb100: Number(livre.carb) || 0 };
    r.alimentos.push(a);
    this.save();
    return a;
  },

  addAlimentoTabela(refId, alimentoId, gramas) {
    const r = this.dietaPropria().refeicoes.find(x => x.id === refId);
    const t = ALIMENTOS.find(x => x.id === alimentoId);
    if (!r || !t) return null;
    const a = { id: this._novoId('a'), ref: t.id, nome: t.nome, g: Math.round(Number(gramas) || 0),
                kcal100: t.kcal, prot100: t.prot, carb100: t.carb };
    r.alimentos.push(a);
    this.save();
    return a;
  },

  editarGramasProprio(refId, alimId, gramas) {
    const r = this.dietaPropria().refeicoes.find(x => x.id === refId);
    const a = r && r.alimentos.find(x => x.id === alimId);
    if (!a) return;
    a.g = Math.max(0, Math.round(Number(gramas) || 0));
    this.save();
  },

  removerAlimentoProprio(refId, alimId) {
    const r = this.dietaPropria().refeicoes.find(x => x.id === refId);
    if (!r) return;
    r.alimentos = r.alimentos.filter(x => x.id !== alimId);
    this.save();
  },

  /* lista única de alimentos que aceitam troca, para as telas
     referenciarem por índice (evita escapar aspas no onclick) */
  alimentosTrocaveis() {
    const vistos = {};
    const lista = [];
    this.planoBase().refeicoes.forEach(r => r.variacoes.forEach(v => v.alimentos.forEach(a => {
      if (!Array.isArray(a.alt) || !a.alt.length || vistos[a.nome]) return;
      vistos[a.nome] = true;
      lista.push({ nome: a.nome, alt: a.alt, un: a.un, g: a.g });
    })));
    return lista;
  },

  indiceTrocavel(nome) {
    return this.alimentosTrocaveis().findIndex(a => a.nome === nome);
  },

  planoTreino() {
    const p = this.db.perfil;
    const tp = p.treino_plano;
    if (tp && Array.isArray(tp.dias) && tp.dias.length) {
      const base = {
        nome: tp.nome,
        desc: tp.livre ? 'Montado por você, com as suas séries.' : 'Divisão escolhida por você, com as séries e repetições sugeridas pelo app.',
        dias: tp.dias.map(d => ({
          foco: d.foco || this.nomeDoDia(d.grupos),
          grupos: d.grupos || [],
          exercicios: (d.exercicios || []).map(e => ({ ...e, livre: !!tp.livre }))
        })).concat([{ descanso: true, sugestao: 'Descanso. Recuperação é parte do treino.' }])
      };
      const semana = this.montarSemana(base, p.dias_treino);
      return tp.livre ? semana : this.aplicarFase(semana);
    }
    const base = PLANOS_TREINO[`${p.sexo}_${p.local}`] || PLANOS_TREINO.feminino_academia;
    return this.aplicarFase(this.montarSemana(base, p.dias_treino));
  },

  /* ---------- TIPO DE TREINO E TREINO PRÓPRIO ----------
     `treino_plano` no perfil é o treino que ela escolheu ou montou:
       { divisao, nome, livre, dias: [{ foco, grupos, exercicios:
         [{ ex, grupo, series, reps, desc }] }] }
     `livre` = as séries e repetições são dela (o treino mostra "4 Séries"
     e ela anota as repetições que fez), em vez da sugestão do app.
     Sem `treino_plano` vale o plano padrão por sexo e local, que é o que
     todo mundo tinha antes. */
  treinoPlano() {
    return this.db.perfil && this.db.perfil.treino_plano || null;
  },

  /* 'Peito e Tríceps', 'Costas, Bíceps e Abdômen' */
  nomeDoDia(grupos) {
    const g = (grupos || []).filter(Boolean);
    if (!g.length) return 'Treino sem músculos';
    if (g.length === 1) return g[0];
    return g.slice(0, -1).join(', ') + ' e ' + g[g.length - 1];
  },

  /* as divisões que aparecem pra ela, com a recomendada primeiro */
  divisoesPara() {
    const p = this.db.perfil;
    const rec = this.divisaoRecomendada();
    return DIVISOES
      .filter(d => d.sexo === 'ambos' || d.sexo === p.sexo)
      .filter(d => d.id !== 'circuito' || p.local === 'casa')
      .map(d => ({ ...d, recomendada: d.id === rec }))
      .sort((a, b) => (b.recomendada ? 1 : 0) - (a.recomendada ? 1 : 0));
  },

  /* A recomendação sai de três respostas dela: onde treina, quantos dias
     e o objetivo. É a leitura mais comum entre treinadores:
     - poucos dias ou em casa: corpo todo em cada treino;
     - 4 dias: superior e inferior (ou ABCD com glúteo, pra ela);
     - 5 ou 6 dias com foco em massa: divisões com mais volume por músculo. */
  divisaoRecomendada() {
    const p = this.db.perfil;
    const n = Number(p.dias_treino) || 5;
    const fem = p.sexo === 'feminino';
    if (p.local === 'casa') return n >= 4 ? 'circuito' : 'fullbody';
    if (n <= 3) return p.objetivo === 'hipertrofia' ? (fem ? 'abc_gluteo' : 'abc') : 'fullbody';
    if (n === 4) return fem ? 'abcd_gluteo' : (p.objetivo === 'hipertrofia' ? 'abcd' : 'ab');
    if (n === 5) return fem ? 'abc_gluteo' : (p.objetivo === 'hipertrofia' ? 'abcde' : 'ppl');
    return fem ? 'abc_gluteo' : 'ppl';
  },

  /* séries, repetições e descanso que o app sugere pra um exercício, pelo
     objetivo e pelo tamanho do músculo. O primeiro exercício de músculo
     grande é o composto e leva uma série a mais e descanso maior. */
  _prescricao(grupo, principal) {
    const p = this.db.perfil;
    const grande = GRUPOS_GRANDES.includes(grupo);
    if (grupo === 'Cardio') return { series: 4, reps: '40s', desc: '20s' };
    if (grupo === 'Abdômen') return { series: 3, reps: '15', desc: '30s' };
    const reps = p.objetivo === 'hipertrofia' ? (grande ? 10 : 12)
               : p.objetivo === 'emagrecimento' ? (grande ? 12 : 15)
               : (grande ? 12 : 12);
    return {
      series: grande && principal ? 4 : 3,
      reps: String(grupo === 'Panturrilha' ? 20 : reps),
      desc: grande && principal ? '90s' : '60s'
    };
  },

  exerciciosDoGrupo(grupo) {
    const p = this.db.perfil;
    const lista = EXERCICIOS_POR_GRUPO[grupo];
    if (!lista) return [];
    return lista[p.local === 'casa' ? 'casa' : 'academia'] || [];
  },

  /* quantos exercícios cabem no treino: sai do tempo por sessão que ela
     respondeu (30 min, 45, 1 h, mais de 1 h) */
  _exerciciosPorTreino() {
    const t = Number(this.db.perfil.tempo_treino) || 60;
    return t <= 30 ? 4 : t <= 45 ? 5 : t <= 60 ? 6 : 7;
  },

  /* Monta os exercícios de um dia a partir dos músculos. Músculo grande
     vale dois pesos, pequeno um; o total de exercícios é dividido nessa
     proporção, com pelo menos um por músculo. O que já existia no dia
     (e continua num músculo que ficou) é mantido, pra ela não perder uma
     troca que fez. */
  montarExercicios(grupos, existentes) {
    const g = (grupos || []).filter(x => EXERCICIOS_POR_GRUPO[x]);
    if (!g.length) return [];
    const total = Math.max(g.length, this._exerciciosPorTreino());
    const pesos = g.map(x => GRUPOS_GRANDES.includes(x) ? 2 : 1);
    const soma = pesos.reduce((s, x) => s + x, 0);
    const cotas = pesos.map(w => Math.max(1, Math.floor(total * w / soma)));
    let sobra = total - cotas.reduce((s, x) => s + x, 0);
    for (let i = 0; sobra > 0 && i < cotas.length * 3; i++) {
      const k = i % cotas.length;
      if (cotas[k] < this.exerciciosDoGrupo(g[k]).length) { cotas[k]++; sobra--; }
    }
    const velhos = (existentes || []).filter(e => g.includes(e.grupo));
    const saida = [];
    g.forEach((grupo, k) => {
      const meus = velhos.filter(e => e.grupo === grupo).slice(0, cotas[k]);
      const usados = meus.map(e => e.ex);
      const novos = this.exerciciosDoGrupo(grupo).filter(n => !usados.includes(n));
      while (meus.length < cotas[k] && novos.length) {
        const ex = novos.shift();
        meus.push({ ex, grupo, ...this._prescricao(grupo, meus.length === 0) });
      }
      saida.push(...meus);
    });
    return saida;
  },

  /* escolhe uma divisão (ou 'proprio', que começa com os dias vazios pra
     ela preencher). Treino com mais dias que a frequência dela ganha a
     frequência que precisa, senão o D e o E nunca apareceriam. */
  escolherDivisao(id) {
    const p = this.db.perfil;
    const livre = id === 'proprio';
    let dias;
    if (livre) {
      const n = Math.max(3, Math.min(6, Number(p.dias_treino) || 3));
      dias = Array.from({ length: n }, () => ({ foco: '', grupos: [], exercicios: [] }));
    } else {
      const d = DIVISOES.find(x => x.id === id);
      if (!d) return false;
      dias = d.dias.map(x => ({ foco: x.foco, grupos: x.grupos.slice(), exercicios: this.montarExercicios(x.grupos) }));
      if ((Number(p.dias_treino) || 0) < d.dias.length) p.dias_treino = Math.min(6, d.dias.length);
    }
    const nome = livre ? 'Meu treino' : DIVISOES.find(x => x.id === id).nome;
    p.treino_plano = { divisao: id, nome, livre, dias };
    p.ordem_treino = [0, 1, 2, 3, 4, 5, 6];      /* a semana nova começa na ordem dela */
    this.save();
    return true;
  },

  /* quem já usa o app e abre o editor: o plano padrão vira editável, com
     os mesmos treinos e exercícios que ela já fazia */
  garantirTreinoPlano() {
    const p = this.db.perfil;
    if (this.treinoPlano()) return p.treino_plano;
    const base = PLANOS_TREINO[`${p.sexo}_${p.local}`] || PLANOS_TREINO.feminino_academia;
    const grupoDe = nome => {
      for (const g in EXERCICIOS_POR_GRUPO) {
        const l = EXERCICIOS_POR_GRUPO[g];
        if (l.academia.includes(nome) || l.casa.includes(nome)) return g;
      }
      const b = BIBLIOTECA.find(x => x.nome === nome);
      const mapa = { Pernas: 'Quadríceps', 'Glúteos': 'Glúteos', Costas: 'Costas', Peito: 'Peito', Ombro: 'Ombro', 'Braço': 'Bíceps', 'Abdômen': 'Abdômen', Cardio: 'Cardio' };
      return b ? (mapa[b.cat] || 'Abdômen') : 'Abdômen';
    };
    const dias = base.dias.filter(d => !d.descanso).map(d => {
      const exercicios = d.exercicios.map(e => ({ ...e, grupo: grupoDe(e.ex) }));
      const grupos = [];
      exercicios.forEach(e => { if (!grupos.includes(e.grupo)) grupos.push(e.grupo); });
      return { foco: d.foco, grupos, exercicios };
    });
    p.treino_plano = { divisao: 'app', nome: base.nome, livre: false, dias };
    this.save();
    return p.treino_plano;
  },

  _diaPlano(i) {
    const tp = this.garantirTreinoPlano();
    return tp.dias[i] || null;
  },

  definirGruposDia(i, grupos) {
    const d = this._diaPlano(i);
    if (!d) return;
    const tp = this.treinoPlano();
    d.grupos = grupos.filter(g => GRUPOS_MUSCULARES.includes(g));
    const antes = d.exercicios.map(e => e.ex);
    d.exercicios = this.montarExercicios(d.grupos, d.exercicios);
    /* com as séries dela, exercício que entrou agora vem sem repetição
       fixa: ela anota no dia */
    if (tp && tp.livre) d.exercicios.forEach(e => { if (!antes.includes(e.ex)) e.reps = ''; });
    /* o nome do dia acompanha os músculos, a não ser que ela tenha
       escolhido uma divisão com nome próprio e não mexido nos músculos */
    d.foco = this.nomeDoDia(d.grupos);
    if (tp) tp.divisao = tp.divisao === 'proprio' ? 'proprio' : 'editado';
    this.save();
  },

  trocarExercicio(i, k, nome) {
    const d = this._diaPlano(i);
    if (!d || !d.exercicios[k]) return;
    d.exercicios[k] = { ...d.exercicios[k], ex: nome };
    this.save();
  },

  addExercicio(i, grupo, nome) {
    const d = this._diaPlano(i);
    if (!d) return;
    if (!d.grupos.includes(grupo)) d.grupos.push(grupo);
    const pr = this._prescricao(grupo, false);
    const tp = this.treinoPlano();
    if (tp && tp.livre) pr.reps = '';
    d.exercicios.push({ ex: nome, grupo, ...pr });
    d.foco = this.nomeDoDia(d.grupos);
    this.save();
  },

  removerExercicio(i, k) {
    const d = this._diaPlano(i);
    if (!d) return;
    d.exercicios.splice(k, 1);
    this.save();
  },

  /* séries e repetições dela num exercício do plano. Mexer aqui tira o
     ajuste feito pelo "+/−" dentro do treino, senão os dois brigariam. */
  definirSeriesReps(i, k, series, reps) {
    const d = this._diaPlano(i);
    const e = d && d.exercicios[k];
    if (!e) return;
    if (series !== undefined && series !== null) {
      e.series = Math.max(1, Math.min(10, Number(series) || 1));
      const p = this.db.perfil;
      if (p.series_ex) delete p.series_ex[e.ex];
    }
    if (reps !== undefined && reps !== null) e.reps = String(reps).trim();
    this.save();
  },

  /* liga as séries e repetições dela no plano todo (ou volta pra sugestão
     do app, que recalcula cada exercício pelo músculo e objetivo) */
  definirLivre(livre) {
    const tp = this.garantirTreinoPlano();
    tp.livre = !!livre;
    /* as minhas: fica a quantidade de séries, e a repetição sai (ela
       anota o que fez no dia, ou escreve a dela no editor) */
    if (livre) tp.dias.forEach(d => d.exercicios.forEach(e => { e.reps = ''; }));
    if (!livre) tp.dias.forEach(d => d.exercicios.forEach((e, k) => {
      const pr = this._prescricao(e.grupo, d.exercicios.findIndex(x => x.grupo === e.grupo) === k);
      e.series = pr.series; e.reps = pr.reps; e.desc = pr.desc;
    }));
    this.save();
  },

  definirDiasTreino(n) {
    const p = this.db.perfil;
    p.dias_treino = Math.max(3, Math.min(6, Number(n) || 3));
    const tp = this.treinoPlano();
    /* treino próprio tem um dia por dia de treino; a divisão pronta gira */
    if (tp && tp.divisao === 'proprio') {
      while (tp.dias.length < p.dias_treino) tp.dias.push({ foco: '', grupos: [], exercicios: [] });
      while (tp.dias.length > p.dias_treino) tp.dias.pop();
    }
    p.ordem_treino = [0, 1, 2, 3, 4, 5, 6];
    this.save();
  },

  /* ---------- REAJUSTE MENSAL ----------
     O cardápio já reajusta sozinho (as gramagens escalam pela meta de
     calorias, que é recalculada a cada pesagem). O treino não reajustava
     nada: mesma planilha no mês 1 e no mês 6. Estas funções resolvem
     isso, e a tela de virada de mês mostra o que mudou.

     Nada disto vai pro Supabase: é cálculo em cima do perfil, roda no
     aparelho. O Supabase só guarda quem tem acesso.                    */

  mesAtual() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  },

  reajustes() {
    if (!Array.isArray(this.db.reajustes)) this.db.reajustes = [];
    return this.db.reajustes;
  },

  ultimoReajuste() {
    const r = this.reajustes();
    return r.length ? r[r.length - 1] : null;
  },

  /* O reajuste é um extra pago (R$9,90/mês), com a PRIMEIRA troca de
     estratégia sempre grátis pra todo mundo — é o "vem ver o que você
     ganha". Quem não assina depois disso fica na fase 1, que é o plano
     base — exatamente o que ela já tinha antes de existir reajuste.
     Nada é tirado de ninguém: o que a assinatura compra são as fases
     seguintes, as sugestões de carga e o relatório de virada de mês.

     Fica aqui embaixo de App porque a tranca de verdade é do servidor
     (Backend.extras); isto é só a porta da tela. */
  reajusteLiberado() {
    if (typeof CONFIG !== 'undefined' && !CONFIG.CHECKOUT_URL_REAJUSTE) return true;  /* sem produto criado, liberado pra todos */
    /* primeira troca de estratégia: sempre grátis. Conta só as aplicadas:
       quem recusou o reajuste num mês não gastou a troca grátis */
    if (this.reajustes().filter(r => r.liberado).length === 0) return true;
    return typeof App !== 'undefined' && typeof App.temReajuste === 'function' && App.temReajuste();
  },

  /* a fase gira 1 → 2 → 3 → 4 → 1... a cada mês fechado */
  faseAtual() {
    if (!this.reajusteLiberado()) return FASES_TREINO[0];
    const ult = this.ultimoReajuste();
    const n = ult && ult.fase ? ult.fase : 1;
    return FASES_TREINO[(n - 1) % FASES_TREINO.length];
  },

  /* Quantos dias no mesmo plano. É o número que a notificação mostra,
     então tem que ser verdade.

     Conta a partir do último reajuste QUE FOI APLICADO. O retrato do
     mês é gravado mesmo pra quem não assina (senão a virada de mês
     reapareceria a cada abertura do app), mas o plano dela não mudou —
     contar a partir dele diria "0 dias no mesmo plano" pra quem está
     no mesmo plano há dois meses. */
  /* "1 dia" / "47 dias" — sem isto a tela escreve "há 1 dias" */
  frasedias(n) { return n + (n === 1 ? ' dia' : ' dias'); },

  diasSemReajuste() {
    const aplicado = this.reajustes().filter(r => r.liberado).pop();
    const desde = (aplicado && aplicado.data) || (this.db.perfil && this.db.perfil.criado_em);
    if (!desde) return 0;
    return Math.max(0, Math.round((Date.now() - this.deIso(desde).getTime()) / 86400000));
  },

  /* aplica a fase por cima da semana montada: só os DOIS primeiros
     exercícios ganham série (são os compostos, onde volume rende), e
     repetição só mexe quando o texto é um número puro — '15 cada' e
     '10-12' ficam como estão em vez de virar bobagem. */
  /* recebe e devolve o OBJETO do plano ({nome, desc, frequencia, dias}),
     não a lista de dias: é assim que planoTreino() entrega pro resto do
     app, e trocar a forma aqui quebraria todas as telas de treino. */
  aplicarFase(plano) {
    const f = this.faseAtual();
    if (f.series === 0 && f.reps === 0 && f.descanso === 0) return plano;

    return { ...plano, dias: plano.dias.map(dia => {
      if (dia.descanso || !dia.exercicios) return dia;
      return {
        ...dia,
        exercicios: dia.exercicios.map((e, i) => {
          const novo = { ...e };
          if (f.series && i < 2) novo.series = e.series + f.series;

          if (f.reps && /^\d+$/.test(String(e.reps))) {
            novo.reps = String(Math.max(6, Number(e.reps) + f.reps));
          }

          if (f.descanso) {
            const seg = parseInt(String(e.desc), 10);
            if (!isNaN(seg)) novo.desc = Math.max(30, seg + f.descanso) + 's';
          }
          return novo;
        })
      };
    }) };
  },

  /* carga sugerida pro exercício: a última que ela registrou, mais um
     passo pequeno. Só sugere com histórico de verdade — chutar carga
     pra quem nunca registrou nada é como as pessoas se machucam. */
  cargaSugerida(ex) {
    const hist = this.cargas(ex);
    if (hist.length < CARGA_MIN_SESSOES) return null;
    const ultima = hist[hist.length - 1].peso;
    if (!ultima) return null;
    /* arredonda pra 0,5 kg, que é o menor par de anilhas de verdade */
    const alvo = Math.round(ultima * (1 + CARGA_INCREMENTO) * 2) / 2;
    return alvo > ultima ? alvo : ultima + 0.5;
  },

  /* tem virada de mês pra mostrar?
     Só pra quem entrou num mês anterior: quem criou a conta há três
     dias não tem o que reajustar, e a tela viraria enfeite. */
  reajustePendente() {
    if (!this.db.perfil) return false;
    const mes = this.mesAtual();
    /* pra quem não assina, "pendente" continua valendo: é o que faz a
       notificação aparecer e a tela mostrar a oferta. O que ela não vê
       são os números novos. */
    const ult = this.ultimoReajuste();
    if (ult && ult.mes === mes) return false;
    const criado = String(this.db.perfil.criado_em || '').slice(0, 7);
    return !!criado && criado < mes;
  },

  /* ela respondeu "não, manter o plano": guarda o retrato do mês (pra
     não perguntar de novo até o mês que vem) sem andar a fase. Fica
     marcado como não aplicado, então não conta como "antes" do próximo
     reajuste nem zera a contagem de dias no mesmo plano. */
  recusarReajuste() {
    const p = this.db.perfil;
    const ult = this.ultimoReajuste();
    this.reajustes().push({
      mes: this.mesAtual(),
      data: this.hoje(),
      peso: p.peso_atual,
      meta_kcal: p.meta_kcal,
      meta_prot: p.meta_prot,
      fase: ult && ult.fase ? ult.fase : 1,
      liberado: false,
      recusado: true
    });
    this.save();
  },

  /* fecha o mês: guarda o retrato de agora e devolve a comparação com
     o retrato anterior, que é o que a tela mostra. */
  fecharReajuste() {
    const p = this.db.perfil;
    const mes = this.mesAtual();
    const ult = this.ultimoReajuste();
    const liberado = this.reajusteLiberado();
    /* a fase só anda pra quem assina o reajuste. Sem isso, quem não
       paga acumularia fases no retrato e pularia direto pra fase 4 no
       dia que assinasse. */
    const faseNova = !liberado ? (ult && ult.fase ? ult.fase : 1)
                   : (ult && ult.fase ? (ult.fase % FASES_TREINO.length) + 1 : 1);

    /* No PRIMEIRO reajuste não existe retrato anterior. Usar o
       `meta_kcal` de agora como "antes" mostraria 1730 → 1730 mesmo
       para quem emagreceu 4 kg, porque a meta já foi recalculada na
       pesagem. Então recalculamos com o peso inicial: é o número que
       ela realmente tinha quando começou. */
    const perfilInicial = { ...p, peso_atual: p.peso_inicial };
    /* compara com o último reajuste aplicado de verdade: os retratos de
       quem só viu a oferta não são um "antes", porque nada mudou neles */
    const base = this.reajustes().filter(r => r.liberado).pop() || ult;
    const antes = base || {
      peso: p.peso_inicial,
      meta_kcal: this.calcMetaKcal(perfilInicial),
      meta_prot: this.calcMetaProt(perfilInicial),
      fase: 1
    };

    const retrato = {
      mes,
      data: this.hoje(),
      peso: p.peso_atual,
      meta_kcal: p.meta_kcal,
      meta_prot: p.meta_prot,
      fase: faseNova,
      liberado                   /* false = ela viu a oferta e não assinou */
    };
    this.reajustes().push(retrato);
    this.save();

    const mesNum = Number(mes.slice(5)) - 1;
    return {
      mesNome: MESES_PT[mesNum] || '',
      antes,
      agora: retrato,
      difPeso: Math.round((p.peso_atual - antes.peso) * 10) / 10,
      difKcal: Math.round(p.meta_kcal - antes.meta_kcal),
      difProt: Math.round((p.meta_prot || 0) - (antes.meta_prot || 0)),
      /* o quanto o prato encolheu ou cresceu, que é o reajuste que ela
         vê no cardápio todo dia */
      pctPorcao: antes.meta_kcal ? Math.round((p.meta_kcal / antes.meta_kcal - 1) * 100) : 0,
      fase: FASES_TREINO[(faseNova - 1) % FASES_TREINO.length],
      faseAntes: FASES_TREINO[(antes.fase - 1) % FASES_TREINO.length],
      primeiro: !ult
    };
  },

  /* monta a semana de 7 dias a partir dos focos musculares fixos do plano
     (sempre os mesmos, por sexo/local), escolhendo quantos deles viram
     treino de verdade conforme `dias_treino` (resposta do quiz) e
     espalhando os dias de descanso pela semana em vez de empilhar tudo
     no fim — é isso que faz "quantos dias por semana" mudar a agenda. */
  montarSemana(base, diasTreino) {
    const n = Math.max(3, Math.min(6, Number(diasTreino) || 5));
    const focos = base.dias.filter(d => !d.descanso);
    const descansoModelo = base.dias.find(d => d.descanso) || { descanso: true, sugestao: 'Descanso. Recuperação é parte do treino.' };

    // posições (0=Seg ... 6=Dom) que viram treino, por quantidade de dias
    const PADROES = { 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };
    const posTreino = PADROES[n];

    let k = 0;
    return {
      ...base,
      frequencia: `${n}x por semana`,
      dias: Array.from({ length: 7 }, (_, pos) => {
        if (!posTreino.includes(pos)) return descansoModelo;
        return focos[k++ % focos.length];
      })
    };
  },

  /* ---------- organização da semana ----------
     `ordem_treino` guarda, para cada dia da semana (posição 0=Seg ... 6=Dom),
     qual treino do plano original ocupa aquele dia. Trocar dois dias é só
     trocar duas posições deste array.                                       */
  ordemTreino() {
    const p = this.db.perfil;
    if (!p.ordem_treino || p.ordem_treino.length !== 7) {
      p.ordem_treino = [0, 1, 2, 3, 4, 5, 6];
    }
    return p.ordem_treino;
  },

  /* os 7 dias já reorganizados: o rótulo do dia vem da posição,
     o conteúdo do treino vem da ordem escolhida pela pessoa */
  diasTreino() {
    const plano = this.planoTreino();
    return this.ordemTreino().map((idx, pos) => ({
      ...plano.dias[idx],
      dia: DIAS_SEMANA[pos],
      diaLongo: DIAS_SEMANA_LONGO[pos]
    }));
  },

  /* põe o treino `idxTreino` no dia `posicao`, trocando de lugar
     com o que estava ali */
  trocarDiaTreino(posicao, idxTreino) {
    const ordem = this.ordemTreino();
    idxTreino = Number(idxTreino);
    const origem = ordem.indexOf(idxTreino);
    if (origem === -1 || origem === posicao) return false;

    const antigo = ordem[posicao];
    ordem[posicao] = idxTreino;
    ordem[origem] = antigo;
    this.save();
    return true;
  },

  /* ---------- horário de treino ----------
     Guardado POR DIA DA SEMANA (posição 0 = segunda), porque treino é
     rotina: quem marca "terça às 19h" quer isso toda terça, não só na
     terça que vem. Fica no perfil pra viajar junto na nuvem.

     Vazio em tudo = ninguém escolheu nada ainda, e aí o lembrete de
     treino não toca. Só passa a tocar depois que ela marcar um horário. */
  horasTreino() {
    const p = this.db.perfil;
    if (!p) return {};
    if (!p.treino_horas || typeof p.treino_horas !== 'object') p.treino_horas = {};
    return p.treino_horas;
  },

  horaTreino(pos) {
    return this.horasTreino()[pos] || '';
  },

  /* O horário que o lembrete usa. Enquanto ela não escolheu nenhum, vale
     o padrão que o campo já mostra (HORA_TREINO_PADRAO): antes, o campo
     exibia 18:30 mas nada era salvo, e o lembrete de treino nunca tocava
     pra quem não mexeu no horário. Escolhido algum dia, vale só o que ela
     salvou. */
  horaTreinoEfetiva(pos) {
    const h = this.horasTreino();
    if (h[pos]) return h[pos];
    return Object.keys(h).length ? '' : HORA_TREINO_PADRAO;
  },

  /* horário do lembrete de sono: o que ela escolheu nas metas, ou o padrão */
  horaSono() {
    const p = this.db.perfil;
    return (p && p.hora_sono) || HORA_SONO;
  },

  /* hora vazia apaga o horário daquele dia */
  definirHoraTreino(pos, hora) {
    const h = this.horasTreino();
    if (hora) h[pos] = hora; else delete h[pos];
    this.save();
    return this.horaTreino(pos);
  },

  /* aplica o mesmo horário em todos os dias que TÊM treino. É o botão
     "usar em todos os dias": quem treina sempre às 19h não vai abrir
     sete vezes o calendário pra dizer isso. */
  definirHoraTreinoTodos(hora) {
    const h = this.horasTreino();
    this.diasTreino().forEach((d, pos) => {
      if (d.descanso) delete h[pos];
      else if (hora) h[pos] = hora;
      else delete h[pos];
    });
    this.save();
  },

  /* o treino de uma data qualquer, respeitando a ordem que ela montou */
  treinoDaData(iso) {
    const d = this.deIso(iso).getDay();          // 0 = domingo
    const pos = d === 0 ? 6 : d - 1;
    const dia = this.diasTreino()[pos];
    return dia ? { ...dia, pos } : null;
  },

  /* fez o treino naquele dia? lê o registro, sem criar dia novo */
  treinoFeitoEm(iso) {
    const d = this.db.dias[iso];
    return !!(d && d.treino);
  },

  restaurarOrdemTreino() {
    this.db.perfil.ordem_treino = [0, 1, 2, 3, 4, 5, 6];
    this.save();
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
    const ref = this.planoAlimentar(this.hoje()).find(r => r.id === refId);
    ref.alimentos.forEach(a => {
      const chave = `${refId}:${a.id}`;
      const i = d.alimentos.indexOf(chave);
      /* "marcar tudo" não marca a sobremesa por você */
      if (marcar && i < 0 && !a.opcional) d.alimentos.push(chave);
      if (!marcar && i >= 0) d.alimentos.splice(i, 1);
    });
    this.save();
  },

  /* lista de compras da semana: quantidade diária × 7, somando repetidos.
     Quando a medida caseira faz mais sentido que gramas (ovos, potes,
     xícaras), a lista usa ela — ninguém compra "1575g de café".        */
  listaCompras() {
    const CASEIRAS = /^(\d+(?:[.,]\d+)?)\s*(unidades?|potes?|scoops?|x[ií]caras?|fatias?|fil[ée]s?|por[çc][õo]es?|punhados?|conchas?)/i;
    const PLURAIS = { unidade:'unidades', pote:'potes', scoop:'scoops', xicara:'xícaras',
                      fatia:'fatias', file:'filés', porcao:'porções', punhado:'punhados', concha:'conchas' };
    const mapa = {};

    /* percorre os 7 dias da semana, cada um com a sua variação de cardápio,
       somando o que aquele dia realmente pede — em vez de multiplicar um
       único cardápio por 7 */
    for (let pos = 0; pos < 7; pos++) {
      this._planoDaVariacao(pos % 3).forEach(r => r.alimentos.forEach(a => {
        if (a.opcional) return;

        /* item trocado: a quantidade vem do texto da própria troca */
        if (a.trocado) {
          const t = this._lerTroca(a.nome);
          if (!mapa[t.nome]) mapa[t.nome] = { nome: t.nome, gramas: 0, aVontade: false, caseira: null, trocadoDe: a.nomeOriginal };
          const it = mapa[t.nome];
          if (t.gramas) it.gramas += t.gramas;
          else if (t.caseira) {
            if (!it.caseira) it.caseira = { qtd: 0, rotulo: t.caseira.rotulo };
            it.caseira.qtd += t.caseira.qtd;
          } else it.aVontade = true;
          return;
        }

        if (!mapa[a.nome]) mapa[a.nome] = { nome: a.nome, gramas: 0, aVontade: false, caseira: null };
        const item = mapa[a.nome];

        if (/vontade/i.test(a.un)) { item.aVontade = true; return; }

        item.gramas += a.g;

        const m = a.un.match(CASEIRAS);
        if (m) {
          const chave = m[2].toLowerCase()
            .replace(/s$/, '').replace('í', 'i').replace('é', 'e').replace('ç', 'c').replace('õ', 'o');
          const qtd = parseFloat(m[1].replace(',', '.'));
          if (!item.caseira) item.caseira = { qtd: 0, rotulo: PLURAIS[chave] || m[2] };
          item.caseira.qtd += qtd;
        }
      }));
    }

    return Object.values(mapa)
      .map(i => ({ ...i, texto: this._qtdCompras(i) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },

  _lerTroca(texto) {
    let t = String(texto).trim();

    const gr = t.match(/^(\d+(?:[.,]\d+)?)\s*(g|ml)\b\s*(?:de\s+)?(.*)$/i);
    if (gr) {
      const nome = gr[3].trim();
      return { gramas: parseFloat(gr[1].replace(',', '.')), nome: this._maiuscula(nome || t) };
    }

    const un = t.match(/^(\d+(?:[.,]\d+)?)\s+([a-zà-ú.]+)\s*(?:de\s+)?(.*)$/i);
    if (un) {
      const qtd = parseFloat(un[1].replace(',', '.'));
      const rotulo = un[2].toLowerCase();
      const resto = un[3].trim();
      const nome = resto ? `${this._maiuscula(rotulo)} ${resto}` : this._maiuscula(rotulo);
      return { caseira: { qtd, rotulo }, nome };
    }

    return { nome: this._maiuscula(t) };
  },

  _maiuscula(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  },

  _qtdCompras(item) {
    if (item.aVontade) return 'à vontade';
    if (item.caseira) {
      const q = Math.round(item.caseira.qtd * 10) / 10;
      return `${String(q).replace('.', ',')} ${item.caseira.rotulo}`;
    }
    return item.gramas >= 1000
      ? `${(item.gramas / 1000).toFixed(1).replace('.', ',')} kg`
      : `${item.gramas} g`;
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

  /* concluir treino é via de mão única: marcou, ficou marcado no dia */
  concluirTreino() {
    const d = this.dia();
    if (d.treino) return false;
    d.treino = true;
    d.treino_fim = Date.now();
    this.save();
    return true;
  },

  /* ---------- a sessão de treino de hoje ----------
     A hora da primeira coisa que ela faz no treino (abrir um exercício,
     anotar carga, ajustar série, registrar cardio). É dela que sai a
     duração do resumo. */
  iniciarTreinoHoje() {
    const d = this.dia();
    if (d.treino || d.treino_inicio) return;
    d.treino_inicio = Date.now();
    this.save();
  },

  /* ---------- séries por exercício ----------
     Ela pode tirar ou pôr séries. Guardado por NOME do exercício, no
     perfil (viaja pra nuvem junto), e vale pra todo treino que tiver ele. */
  seriesEx(nome, padrao) {
    const o = this.db.perfil && this.db.perfil.series_ex;
    return (o && o[nome]) || Number(padrao) || 1;
  },

  ajustarSeries(nome, padrao, delta) {
    const p = this.db.perfil;
    if (!p.series_ex || typeof p.series_ex !== 'object') p.series_ex = {};
    const n = Math.max(1, Math.min(10, this.seriesEx(nome, padrao) + delta));
    if (n === Number(padrao)) delete p.series_ex[nome]; else p.series_ex[nome] = n;
    this.save();
    return n;
  },

  /* ---------- cardio do treino ---------- */
  caloriasCardio(tipo, minutos, km) {
    const peso = (this.db.perfil && this.db.perfil.peso_atual) || 70;
    const min = Math.max(0, Number(minutos) || 0);
    const kmh = km > 0 && min > 0 ? km / (min / 60) : 0;
    const t = CARDIO_TIPOS.find(x => x.id === tipo) || CARDIO_TIPOS[0];
    let met;
    if (t.id === 'corrida') {
      if (!kmh) met = CAMINHADA_MET_SEM_DISTANCIA;
      else { met = CORRIDA_MET[0][1]; for (const [v, m] of CORRIDA_MET) if (kmh >= v) met = m; }
    } else if (t.id === 'bike') {
      if (!kmh) met = BIKE_MET_SEM_DISTANCIA;
      else { met = BIKE_MET[0][1]; for (const [v, m] of BIKE_MET) if (kmh >= v) met = m; }
    } else {
      met = t.met;
    }
    return Math.round(met * 3.5 * peso / 200 * min);
  },

  /* `data` deixa registrar o cardio de outro dia da semana (o que já
     passou): sem ela, é hoje */
  salvarCardio(tipo, minutos, km, data) {
    const d = this.dia(data);
    const t = CARDIO_TIPOS.find(x => x.id === tipo) || CARDIO_TIPOS[0];
    const dist = t.distancia && km > 0 ? Math.round(km * 100) / 100 : 0;
    d.cardio = { tipo: t.id, minutos: Math.round(minutos), km: dist, kcal: this.caloriasCardio(t.id, minutos, dist) };
    if (!data || data === this.hoje()) this.iniciarTreinoHoje();
    this.save();
    return d.cardio;
  },

  removerCardio(data) {
    delete this.dia(data).cardio;
    this.save();
  },

  /* ---------- dias ativos ----------
     O mesmo critério da sequência: registrou peso, comida, treino, água
     ou sono naquele dia. */
  diaAtivo(data) {
    const d = this.db.dias[data];
    const pesou = this.db.pesagens.some(p => p.data === data);
    return !!(pesou || (d && (d.alimentos.length > 0 || d.treino || d.agua > 0 || d.sono > 0)));
  },

  diasAtivosTotal() {
    const datas = new Set(Object.keys(this.db.dias || {}));
    (this.db.pesagens || []).forEach(p => datas.add(p.data));
    let n = 0;
    datas.forEach(data => { if (this.diaAtivo(data)) n++; });
    return n;
  },

  /* ---------- o resumo do treino concluído ----------
     Montado uma vez, na hora em que ela conclui, e guardado no dia: é o
     que aparece na tela de parabéns e vira a imagem pros stories. Tudo
     sai do que ela registrou; o que é estimativa (calorias, duração sem
     hora de início) vem marcado como tal. */
  montarResumoTreino(treino) {
    const d = this.dia();
    const hoje = this.hoje();
    const exercicios = (treino.exercicios || []).map(e => ({
      nome: e.ex, series: this.seriesEx(e.ex, e.series), desc: e.desc
    }));
    const series = exercicios.reduce((s, e) => s + e.series, 0);

    /* duração: da primeira ação até o "concluir". Fora de 5 min a 4 h é
       sinal de que ela abriu o treino de manhã e treinou à noite: aí
       estima pelas séries e descansos do plano */
    let minutos = d.treino_inicio && d.treino_fim ? Math.round((d.treino_fim - d.treino_inicio) / 60000) : 0;
    let estimada = false;
    if (minutos < 5 || minutos > 240) {
      const seg = exercicios.reduce((s, e) => s + e.series * (SEGUNDOS_POR_SERIE + (parseInt(e.desc, 10) || 60)), 0);
      minutos = Math.max(10, Math.round(seg / 60));
      estimada = true;
    }
    const cardio = d.cardio || null;
    /* o tempo de cardio não conta de novo como musculação */
    const minMusculacao = Math.max(0, minutos - (cardio && !estimada ? cardio.minutos : 0));
    const peso = (this.db.perfil && this.db.perfil.peso_atual) || 70;
    const kcalTreino = Math.round(MUSCULACAO_MET * 3.5 * peso / 200 * minMusculacao);

    /* recorde: a série mais pesada de hoje passou a mais pesada de antes */
    const prs = [];
    exercicios.forEach(e => {
      const hist = this.cargas(e.nome);
      const deHoje = hist.find(r => r.data === hoje);
      if (!deHoje) return;
      const antes = hist.filter(r => r.data < hoje).reduce((m, r) => Math.max(m, Number(r.peso) || 0), 0);
      if (antes > 0 && deHoje.peso > antes) prs.push({ nome: e.nome, peso: deHoje.peso, antes });
    });

    const musculos = [];
    exercicios.forEach(e => {
      const b = BIBLIOTECA.find(x => x.nome === e.nome);
      (b ? b.musc : []).forEach(m => { if (!musculos.includes(m)) musculos.push(m); });
    });

    const r = {
      data: hoje,
      foco: treino.foco,
      exercicios: exercicios.map(e => e.nome),
      series,
      minutos: minutos + (cardio && estimada ? cardio.minutos : 0),
      duracaoEstimada: estimada,
      kcalTreino,
      cardio,
      kcal: kcalTreino + (cardio ? cardio.kcal : 0),
      prs,
      musculos,
      sequencia: this.streak(),
      diasAtivos: this.diasAtivosTotal()
    };
    d.resumo_treino = r;
    this.save();
    return r;
  },

  /* ---------- como foi o treino ----------
     Guardado por dia, junto com o resto. Serve pra duas coisas: mostrar
     na aba de Treinos como as últimas sessões foram, e — mais pra frente
     — ajustar a carga sugerida sozinho, quando houver histórico. */
  registrarEsforco(nivel, nota) {
    const d = this.dia();
    d.esforco = nivel;                        // 'leve' | 'ponto' | 'pesado'
    /* a anotação é opcional ("senti o ombro", "faltou tempo") */
    const n = String(nota || '').trim().slice(0, 200);
    if (n) d.esforco_nota = n; else delete d.esforco_nota;
    this.save();
  },

  /* as últimas N respostas, da mais recente pra mais antiga */
  esforcosRecentes(n = 6) {
    const lista = [];
    for (let i = 0; i < 90 && lista.length < n; i++) {
      const d = this.db.dias[this.diasAtras(i)];
      if (d && d.treino && d.esforco) lista.push(d.esforco);
    }
    return lista;
  },

  /* leitura simples do histórico: só opina quando tem 3 respostas ou mais
     e quando a maioria aponta pro mesmo lado. Sem isso, dois dias ruins
     seguidos mandariam a pessoa baixar a carga sem motivo. */
  lidaDoEsforco() {
    const l = this.esforcosRecentes(5);
    if (l.length < 3) return null;
    const conta = t => l.filter(x => x === t).length;
    if (conta('pesado') >= Math.ceil(l.length * 0.6))
      return { tom: 'pesado', texto: 'Seus últimos treinos vieram pesados demais. Segure a carga onde está por uma semana antes de subir.' };
    if (conta('leve') >= Math.ceil(l.length * 0.6))
      return { tom: 'leve', texto: 'Os últimos treinos estão leves pra você. Suba a carga no próximo, com cuidado.' };
    return { tom: 'ponto', texto: 'Seus treinos estão no ponto. Siga subindo aos poucos.' };
  },

  /* ---------- evolução e feedback POR TREINO ----------
     Cada dia concluído guarda o resumo do treino (com o foco, ex. "Peito")
     e a resposta de "como foi". Juntando os dois, dá pra ver só as sessões
     daquele treino, como no histórico que um personal acompanha. */
  sessoesDoTreino(foco, n = 12) {
    const lista = [];
    for (let i = 0; i < 365 && lista.length < n; i++) {
      const data = this.diasAtras(i);
      const d = this.db.dias[data];
      if (!d || !d.treino || !d.resumo_treino || d.resumo_treino.foco !== foco) continue;
      lista.push({ data, esforco: d.esforco || null, nota: d.esforco_nota || '',
                   minutos: d.resumo_treino.minutos, series: d.resumo_treino.series });
    }
    return lista;
  },

  /* a carga de cada exercício DESTE treino, do primeiro registro ao último */
  evolucaoDoTreino(exercicios) {
    return (exercicios || []).map(e => {
      const reg = this.cargas(e.ex);
      if (!reg.length) return { ex: e.ex, registros: 0 };
      const inicio = reg[0].peso, atual = reg[reg.length - 1].peso;
      return { ex: e.ex, registros: reg.length, inicio, atual,
               ganho: Math.round((atual - inicio) * 10) / 10,
               serie: reg.slice(-8).map(r => r.peso) };
    });
  },

  /* ---------- medidas corporais (cm) ----------
     Uma linha por dia, com as medidas que ela preencher (não precisa
     ser as quatro). Viaja pra nuvem junto com o resto do banco. */
  MEDIDAS: [['cintura', 'Cintura'], ['quadril', 'Quadril'], ['braco', 'Braço'], ['coxa', 'Coxa']],

  medidas() {
    if (!Array.isArray(this.db.medidas)) this.db.medidas = [];
    return this.db.medidas;
  },

  registrarMedidas(valores) {
    const reg = { data: this.hoje() };
    let alguma = false;
    this.MEDIDAS.forEach(([k]) => {
      const v = Number(valores[k]);
      if (v > 0) { reg[k] = Math.round(v * 10) / 10; alguma = true; }
    });
    if (!alguma) return false;
    this.db.medidas = this.medidas().filter(r => r.data !== reg.data);
    this.db.medidas.push(reg);
    this.db.medidas.sort((a, b) => a.data.localeCompare(b.data));
    this.save();
    return true;
  },

  /* a última medida de cada parte, pra abrir o formulário preenchido */
  ultimaMedida(k) {
    const reg = this.medidas().filter(r => r[k] > 0);
    return reg.length ? reg[reg.length - 1][k] : '';
  },

  /* da primeira à última medida de uma parte do corpo */
  evolucaoMedida(k) {
    const reg = this.medidas().filter(r => r[k] > 0);
    if (!reg.length) return null;
    const inicio = reg[0][k], atual = reg[reg.length - 1][k];
    return { inicio, atual, dif: Math.round((atual - inicio) * 10) / 10,
             registros: reg.length, serie: reg.slice(-8).map(r => r[k]) };
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

  /* ---------- cargas dos exercícios ----------
     Guardadas por NOME do exercício, então o histórico sobrevive
     a trocas de plano de treino.                                 */
  cargas(ex) {
    return (this.db.cargas && this.db.cargas[ex]) || [];
  },

  ultimaCarga(ex) {
    const lista = this.cargas(ex);
    return lista.length ? lista[lista.length - 1] : null;
  },

  /* Recebe as séries do dia: [{peso, reps}, ...], uma por série do
     treino. Guarda a lista inteira E um par peso/reps representativo,
     que é a SÉRIE MAIS PESADA do dia.

     O par continua existindo porque o histórico, o gráfico de evolução
     e a sugestão de carga do reajuste leem dele. Assim os registros
     antigos (que só tinham o par) continuam valendo sem migração, e as
     telas não precisaram mudar. */
  registrarCarga(ex, series) {
    if (!this.db.cargas) this.db.cargas = {};
    if (!this.db.cargas[ex]) this.db.cargas[ex] = [];

    const preenchidas = (series || [])
      .map(s => ({ peso: Number(s && s.peso), reps: Number(s && s.reps) || null }))
      .filter(s => !isNaN(s.peso) && s.peso > 0);
    if (!preenchidas.length) return null;

    const topo = preenchidas.reduce((a, b) => (b.peso > a.peso ? b : a));
    const hoje = this.hoje();
    /* um registro por exercício por dia */
    this.db.cargas[ex] = this.db.cargas[ex].filter(r => r.data !== hoje);
    this.db.cargas[ex].push({ data: hoje, peso: topo.peso, reps: topo.reps, series: preenchidas });
    this.db.cargas[ex].sort((a, b) => a.data.localeCompare(b.data));
    this.save();
    return topo;
  },

  /* As séries de um registro. Registro antigo não tem `series`: o par
     peso/reps dele vira uma série só, pra quem lê não precisar saber
     que existiram dois formatos. */
  seriesDe(reg) {
    if (!reg) return [];
    if (Array.isArray(reg.series) && reg.series.length) return reg.series;
    return [{ peso: reg.peso, reps: reg.reps }];
  },

  /* resumo de evolução para a aba de progresso */
  evolucaoCargas() {
    const c = this.db.cargas || {};
    const saida = [];

    for (const ex in c) {
      const reg = c[ex];
      if (!reg.length) continue;
      const inicio = reg[0].peso;
      const atual = reg[reg.length - 1].peso;
      saida.push({
        ex, inicio, atual,
        ganho: Math.round((atual - inicio) * 10) / 10,
        pct: inicio > 0 ? Math.round(((atual - inicio) / inicio) * 100) : 0,
        registros: reg.length,
        serie: reg.slice(-8).map(r => r.peso),
        ultimaData: reg[reg.length - 1].data
      });
    }

    return saida.sort((a, b) => b.ganho - a.ganho || b.registros - a.registros);
  },

  /* ---------- totais do dia ---------- */
  totaisDoDia(data) {
    const dia = data || this.hoje();
    const d = this.db.dias[dia];
    const plano = this.planoAlimentar(dia);
    let kcal = 0, prot = 0, carb = 0, marcados = 0, total = 0;
    /* duas contagens diferentes, e as telas usam cada uma no lugar dela:
       `marcados/total` são ALIMENTOS; `refeicoes/refeicoesTotal` são as
       refeições fechadas. Uma refeição só conta quando todos os itens
       obrigatórios dela estão marcados — a mesma regra que o sistema de
       pontos já usa pro bônus de refeição completa. */
    let refeicoes = 0, refeicoesTotal = 0;

    plano.forEach(r => {
      let obrig = 0, feitos = 0;
      r.alimentos.forEach(a => {
        const feito = d && d.alimentos.indexOf(`${r.id}:${a.id}`) >= 0;
        /* opcionais (sobremesa) não entram na conta do "completou tudo",
           mas somam calorias se a pessoa marcar */
        if (!a.opcional) { total++; obrig++; if (feito) { marcados++; feitos++; } }
        if (feito) { kcal += a.kcal; prot += a.prot; carb += a.carb || 0; }
      });
      if (obrig > 0) { refeicoesTotal++; if (feitos === obrig) refeicoes++; }
    });

    return {
      kcal, prot, carb, marcados, total, refeicoes, refeicoesTotal,
      agua: d ? d.agua : 0,
      sono: d ? d.sono : 0,
      treino: d ? d.treino : false
    };
  },

  /* progresso de uma refeição específica: [marcados, total] */
  progressoRefeicao(ref, data) {
    const obrigatorios = ref.alimentos.filter(a => !a.opcional);
    const d = this.db.dias[data || this.hoje()];
    if (!d) return [0, obrigatorios.length];
    const m = obrigatorios.filter(a => d.alimentos.indexOf(`${ref.id}:${a.id}`) >= 0).length;
    return [m, obrigatorios.length];
  },

  /* ---------- pontos e níveis ---------- */
  pontosDoDia(data) {
    const d = this.db.dias[data];
    if (!d) return 0;
    const p = this.db.perfil;
    let pts = d.alimentos.length * PONTOS.alimento;

    /* bônus por refeição completa */
    this.planoAlimentar(data).forEach(r => {
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
    total += this.corridaConcluidas() * PONTOS.corrida;
    return total;
  },

  nivel() {
    const pts = this.pontosTotais();
    let atual = NIVEIS[0];
    for (const n of NIVEIS) if (pts >= n.min) atual = n;

    const proximo = NIVEIS.find(n => n.min > pts) || null;
    const totalNiveis = NIVEIS.length;
    const base = atual.min;
    const alvo = proximo ? proximo.min : atual.min;
    const pct = proximo ? Math.round(((pts - base) / (alvo - base)) * 100) : 100;

    return { ...atual, pontos: pts, proximo, pct, totalNiveis, faltam: proximo ? alvo - pts : 0 };
  },

  /* ---------- controle de "subiu de nível" ----------
     Guarda o último nível que a pessoa já viu comemorado, para a
     animação disparar uma vez só por nível conquistado.            */
  nivelPendente() {
    const atual = this.nivel();
    /* atenção: nivel_visto pode ser 0 (perfil novo), e 0 é falso em JS —
       por isso a checagem é contra null/undefined, não com || */
    const bruto = this.db.perfil.nivel_visto;
    const visto = (bruto === null || bruto === undefined) ? 1 : bruto;
    return atual.n > visto ? atual : null;
  },

  /* ---------- boas-vindas ----------
     Aparece no topo da tela inicial até a pessoa fechar. Fica no perfil
     e não no localStorage solto pra viajar junto na sincronização: quem
     já fechou num aparelho não vê de novo no outro. */
  boasVindasPendente() {
    return !!this.db.perfil && !this.db.perfil.boas_vindas_visto;
  },

  fecharBoasVindas() {
    if (!this.db.perfil) return;
    this.db.perfil.boas_vindas_visto = true;
    this.save();
  },

  marcarNivelVisto(n) {
    this.db.perfil.nivel_visto = n;
    this.save();
  },

  /* ---------- semana perfeita ----------
     Substitui a leitura de "dias seguidos" na tela inicial. Sequência que
     zera castiga quem viajou um fim de semana, e é o motivo mais comum de
     abandono em app de hábito: a pessoa quebra uma vez, perde o número e
     não volta. Aqui são sete bolinhas que enchem na semana e reiniciam no
     domingo. Motiva igual e não pune.
     A semana começa na segunda (getDay(): 0 = domingo). */
  semanaPerfeita() {
    const hoje = new Date();
    const desdeSegunda = (hoje.getDay() + 6) % 7;
    const dias = [];
    for (let i = 0; i < 7; i++) {
      const data = this.diasAtras(desdeSegunda - i);
      const futuro = i > desdeSegunda;
      const d = this.db.dias[data];
      const pesou = this.db.pesagens.some(x => x.data === data);
      dias.push({
        data,
        futuro,
        hoje: i === desdeSegunda,
        fora: !!(d && d.fora_rotina),
        ativo: !futuro && !!(pesou || (d && (d.alimentos.length > 0 || d.treino || d.agua > 0 || d.sono > 0)))
      });
    }
    const feitos = dias.filter(d => d.ativo || d.fora).length;
    return { dias, feitos, passados: desdeSegunda + 1 };
  },

  /* ---------- dia fora da rotina ----------
     Aniversário, viagem, almoço de domingo. Sem isso a pessoa
     simplesmente não marca nada, vê o dia vazio e se sente fracassada —
     e é aí que ela desinstala. Marcado, o dia conta como cumprido na
     semana perfeita e o app muda de tom em vez de cobrar. */
  foraDaRotina(data) {
    return !!this.dia(data).fora_rotina;
  },

  /* O dia fora da rotina vale uma vez por semana. Devolve a data em que
     já foi usado nesta semana (segunda a domingo), ou null.

     A semana começa na segunda, igual à semanaPerfeita(): getDay() dá
     0 pra domingo, então (dia + 6) % 7 põe a segunda no zero. */
  foraDaRotinaNaSemana() {
    const hoje = new Date();
    const desdeSegunda = (hoje.getDay() + 6) % 7;
    for (let i = 0; i <= desdeSegunda; i++) {
      const data = this.diasAtras(desdeSegunda - i);
      const d = this.db.dias[data];
      if (d && d.fora_rotina) return data;
    }
    return null;
  },

  /* pode marcar hoje? Só se a semana ainda não tiver um. */
  podeForaDaRotina() {
    const usado = this.foraDaRotinaNaSemana();
    return !usado || usado === this.hoje();
  },

  alternarForaDaRotina() {
    const d = this.dia();
    d.fora_rotina = !d.fora_rotina;
    this.save();
    return d.fora_rotina;
  },

  /* ---------- streak (dias seguidos com atividade) ---------- */
  streak() {
    let dias = 0;
    for (let i = 0; i < 400; i++) {
      if (this.diaAtivo(this.diasAtras(i))) { dias++; continue; }
      /* o dia de hoje ainda pode estar zerado sem quebrar a sequência */
      if (i === 0) continue;
      break;
    }
    return dias;
  },

  /* ---------- controle de "bateu marco de sequência" ----------
     Mesmo padrão do nivelPendente/marcarNivelVisto: guarda o maior
     marco já comemorado pra a animação disparar uma vez só por marco,
     mesmo que a pessoa continue ativa depois dele. */
  streakPendente() {
    const dias = this.streak();
    const visto = this.db.perfil.streak_visto || 0;
    const marco = STREAK_MARCOS.filter(m => m <= dias && m > visto).pop();
    return marco || null;
  },

  marcarStreakVisto(n) {
    this.db.perfil.streak_visto = n;
    this.save();
  },

  /* ---------- resumo da semana ----------
     Alimenta a tela de domingo. Olha os 7 dias que terminam hoje e
     devolve o que foi batido, o que escapou e um foco pra semana que
     vem. O foco sai do ponto mais fraco, nunca inventado. */
  resumoDaSemana() {
    const p = this.db.perfil;
    const ms = this.metasSemana();
    const sp = this.semanaPerfeita();
    const plano = this.planoTreino();
    const alvoTreino = Number(String(plano.frequencia).match(/\d+/)?.[0]) || 5;

    const itens = [
      { chave: 'treino', ic: '🏋️', nome: 'Treinos',   feito: ms.treino, alvo: alvoTreino },
      { chave: 'dieta',  ic: '🍽️', nome: 'Dias de dieta completa', feito: ms.dieta, alvo: 7 },
      { chave: 'agua',   ic: '💧', nome: 'Dias na meta de água',   feito: ms.agua,  alvo: 7 },
      { chave: 'sono',   ic: '😴', nome: 'Dias na meta de sono',   feito: ms.sono,  alvo: 7 }
    ].map(i => ({ ...i, pct: i.alvo ? Math.min(100, Math.round((i.feito / i.alvo) * 100)) : 0 }));

    const bateu  = itens.filter(i => i.feito >= i.alvo);
    const escapou = itens.filter(i => i.feito < i.alvo).sort((a, b) => a.pct - b.pct);

    const FOCOS = {
      treino: 'Marque no calendário os dias de treino da semana que vem, com hora. Dia sem hora marcada é dia que não acontece.',
      dieta:  'Escolha uma refeição só pra acertar todo dia. Quando ela virar automática, a próxima vem sozinha.',
      agua:   'Deixe uma garrafa cheia à vista desde cedo. Beber água é menos sobre lembrar e mais sobre estar ao alcance.',
      sono:   'Adiante o despertar do sono em 20 minutos. Sono é o que segura a fome do dia seguinte.'
    };

    /* pesagem: só compara se houver duas na janela */
    const pes = this.db.pesagens.slice().sort((a, b) => a.data < b.data ? -1 : 1);
    const naSemana = pes.filter(x => x.data >= this.diasAtras(7));
    const variacao = naSemana.length >= 2
      ? Math.round((naSemana[naSemana.length - 1].peso - naSemana[0].peso) * 10) / 10
      : null;

    return {
      itens, bateu, escapou,
      diasAtivos: sp.feitos,
      variacao,
      foco: escapou.length ? FOCOS[escapou[0].chave] : 'Semana cheia. Segure esse ritmo e suba a carga do treino.',
      focoNome: escapou.length ? escapou[0].nome : 'Manter o ritmo'
    };
  },

  /* domingo é o dia do fechamento — e a tela só aparece uma vez por semana */
  resumoPendente() {
    if (new Date().getDay() !== 0) return false;
    return this.db.perfil && this.db.perfil.resumo_visto !== this.hoje();
  },

  marcarResumoVisto() {
    if (!this.db.perfil) return;
    this.db.perfil.resumo_visto = this.hoje();
    this.save();
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
      this.planoAlimentar(data).forEach(r => {
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

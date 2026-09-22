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
    return { perfil: null, dias: {}, pesagens: [], cargas: {}, trocas: {}, corridas: [], reajustes: [] };
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
      criado_em: this.hoje()
    };
    perfil.meta_kcal = this.calcMetaKcal(perfil);
    perfil.meta_agua = this.calcMetaAgua(perfil);   // ml
    perfil.meta_sono = 8;                            // horas
    perfil.meta_prot = this.calcMetaProt(perfil);    // g
    perfil.meta_carb = this.calcMetaCarb(perfil);    // g

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
    p.meta_carb = this.calcMetaCarb(p);
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
    const plano = this.planoBase();

    const refeicoes = plano.refeicoes.map(r => {
      const varia = r.variacoes[v % r.variacoes.length];
      return {
        id: r.id, nome: r.nome, horario: r.horario, icone: r.icone,
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
        const item = {
          ...a,
          g: Math.round(a.g * fator),
          kcal: Math.round(a.kcal * fator),
          prot: Math.round(a.prot * fator)
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
    const base = PLANOS_TREINO[`${p.sexo}_${p.local}`] || PLANOS_TREINO.feminino_academia;
    return this.aplicarFase(this.montarSemana(base, p.dias_treino));
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
    if (this.reajustes().length === 0) return true;  /* primeira troca de estratégia: sempre grátis */
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
    this.save();
    return true;
  },

  /* ---------- como foi o treino ----------
     Guardado por dia, junto com o resto. Serve pra duas coisas: mostrar
     na aba de Treinos como as últimas sessões foram, e — mais pra frente
     — ajustar a carga sugerida sozinho, quando houver histórico. */
  registrarEsforco(nivel) {
    const d = this.dia();
    d.esforco = nivel;                        // 'leve' | 'ponto' | 'pesado'
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
    let kcal = 0, prot = 0, marcados = 0, total = 0;
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
        if (feito) { kcal += a.kcal; prot += a.prot; }
      });
      if (obrig > 0) { refeicoesTotal++; if (feitos === obrig) refeicoes++; }
    });

    return {
      kcal, prot, marcados, total, refeicoes, refeicoesTotal,
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

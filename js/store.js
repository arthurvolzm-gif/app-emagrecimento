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
    return { perfil: null, dias: {}, pesagens: [], cargas: {}, trocas: {} };
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
      ordem_treino: [0, 1, 2, 3, 4, 5, 6],
      nivel_visto: 0,       // 0 para a comemoração do nível 1 disparar no primeiro acesso
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

  /* ---------- plano alimentar reescalado para a meta ---------- */
  planoBase() {
    const p = this.db.perfil;
    return PLANOS_ALIMENTARES[p.objetivo] || PLANOS_ALIMENTARES.emagrecimento;
  },

  planoAlimentar() {
    const p = this.db.perfil;
    const plano = this.planoBase();

    /* a base é somada dos próprios alimentos (sem os opcionais), então
       editar o cardápio nunca desalinha o cálculo */
    const base = plano.refeicoes.reduce((s, r) =>
      s + r.alimentos.reduce((x, a) => x + (a.opcional ? 0 : a.kcal), 0), 0) || 1;

    let fator = p.meta_kcal / base;
    fator = Math.max(0.6, Math.min(1.8, fator));

    return plano.refeicoes.map(r => ({
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
    this.planoBase().refeicoes.forEach(r => r.alimentos.forEach(a => {
      if (!Array.isArray(a.alt) || !a.alt.length || vistos[a.nome]) return;
      vistos[a.nome] = true;
      lista.push({ nome: a.nome, alt: a.alt, un: a.un, g: a.g });
    }));
    return lista;
  },

  indiceTrocavel(nome) {
    return this.alimentosTrocaveis().findIndex(a => a.nome === nome);
  },

  planoTreino() {
    const p = this.db.perfil;
    return PLANOS_TREINO[`${p.sexo}_${p.local}`] || PLANOS_TREINO.feminino_academia;
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
    const ref = this.planoAlimentar().find(r => r.id === refId);
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

    this.planoAlimentar().forEach(r => r.alimentos.forEach(a => {
      if (a.opcional) return;

      /* item trocado: a quantidade vem do texto da própria troca
         ("150g de tilápia", "2 ovos cozidos") em vez da gramagem original */
      if (a.trocado) {
        const t = this._lerTroca(a.nome);
        if (!mapa[t.nome]) mapa[t.nome] = { nome: t.nome, gramas: 0, aVontade: false, caseira: null, trocadoDe: a.nomeOriginal };
        const it = mapa[t.nome];
        if (t.gramas) it.gramas += t.gramas * 7;
        else if (t.caseira) {
          if (!it.caseira) it.caseira = { qtd: 0, rotulo: t.caseira.rotulo };
          it.caseira.qtd += t.caseira.qtd * 7;
        } else it.aVontade = true;
        return;
      }

      if (!mapa[a.nome]) mapa[a.nome] = { nome: a.nome, gramas: 0, aVontade: false, caseira: null };
      const item = mapa[a.nome];

      if (/vontade/i.test(a.un)) { item.aVontade = true; return; }

      item.gramas += a.g * 7;

      const m = a.un.match(CASEIRAS);
      if (m) {
        const chave = m[2].toLowerCase()
          .replace(/s$/, '').replace('í', 'i').replace('é', 'e').replace('ç', 'c').replace('õ', 'o');
        const qtd = parseFloat(m[1].replace(',', '.')) * 7;
        if (!item.caseira) item.caseira = { qtd: 0, rotulo: PLURAIS[chave] || m[2] };
        item.caseira.qtd += qtd;
      }
    }));

    return Object.values(mapa)
      .map(i => ({ ...i, texto: this._qtdCompras(i) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },

  /* separa quantidade e nome de um texto de troca:
     "150g de tilápia"   -> { gramas:150, nome:'Tilápia' }
     "2 ovos cozidos"    -> { caseira:{qtd:2, rotulo:'ovos'}, nome:'Ovos cozidos' }
     "Brócolis"          -> { nome:'Brócolis' }                                   */
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

  registrarCarga(ex, peso, reps) {
    if (!this.db.cargas) this.db.cargas = {};
    if (!this.db.cargas[ex]) this.db.cargas[ex] = [];
    const hoje = this.hoje();
    /* um registro por exercício por dia */
    this.db.cargas[ex] = this.db.cargas[ex].filter(r => r.data !== hoje);
    this.db.cargas[ex].push({ data: hoje, peso: Number(peso), reps: Number(reps) || null });
    this.db.cargas[ex].sort((a, b) => a.data.localeCompare(b.data));
    this.save();
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
    const d = this.db.dias[data || this.hoje()];
    const plano = this.planoAlimentar();
    let kcal = 0, prot = 0, marcados = 0, total = 0;

    plano.forEach(r => {
      r.alimentos.forEach(a => {
        const feito = d && d.alimentos.indexOf(`${r.id}:${a.id}`) >= 0;
        /* opcionais (sobremesa) não entram na conta do "completou tudo",
           mas somam calorias se a pessoa marcar */
        if (!a.opcional) { total++; if (feito) marcados++; }
        if (feito) { kcal += a.kcal; prot += a.prot; }
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

  marcarNivelVisto(n) {
    this.db.perfil.nivel_visto = n;
    this.save();
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

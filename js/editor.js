/* =========================================================
   EDITOR DO PLANO — treino, alimentação e metas do jeito dela

   Duas telas:
   - 'escolhaTreino': "Qual treino você segue ou quer seguir?". As
     divisões mais conhecidas, filtradas pelo sexo, com uma recomendada
     pelo objetivo, pelos dias de treino e pelo local; ou montar do zero.
   - 'montarPlano': três abas (Treino, Alimentação, Metas). No treino ela
     troca os músculos de cada dia, troca e tira exercícios e decide se
     usa as séries e repetições do app ou as dela. Na alimentação escolhe
     entre o cardápio do app e a dieta dela, com os alimentos e as gramas.
     Nas metas vê a sugestão do app e troca o número que quiser.

   As duas aparecem no cadastro, logo depois das perguntas (Editor.onb),
   e continuam abertas dentro do app pelos botões de editar.
   A regra de negócio mora no Store; aqui é só tela e toque.
   ========================================================= */
const Editor = {
  onb: false,          // true enquanto é o cadastro (sem botão de fechar)
  aba: 'treino',
  dia: 0,              // treino aberto nas abas (A = 0)
  exAberto: null,      // exercício aberto no dia (índice)
  origem: 'inicio',    // pra onde o ✕ volta
  gruposSel: [],       // seleção em andamento no modal de músculos
  refAlvo: null,       // refeição que vai receber o alimento
  busca: '',
  grupoBusca: 'Todos',

  LETRAS: ['A', 'B', 'C', 'D', 'E', 'F'],

  /* ---------- entrar e sair ---------- */
  abrir(aba) {
    this.onb = false;
    if (App.tela !== 'montarPlano' && App.tela !== 'escolhaTreino') this.origem = App.tela;
    this.aba = aba || 'treino';
    this.dia = 0;
    this.exAberto = null;
    App.tela = 'montarPlano';
    App.render();
    window.scrollTo(0, 0);
  },

  fechar() {
    this._salvar();
    const volta = this.origem && !['montarPlano', 'escolhaTreino'].includes(this.origem) ? this.origem : 'inicio';
    App.ir(volta);
  },

  /* toda mudança vai pra nuvem e reagenda os lembretes (horário de
     refeição, de sono e o treino do dia mudam o que toca no celular) */
  _salvar() {
    Backend.agendarSync();
    if (typeof Lembretes !== 'undefined') Lembretes.agendar();
  },

  _pintar() {
    const y = window.scrollY;
    App.render();
    window.scrollTo(0, y);
  },

  irEscolha() {
    App.tela = 'escolhaTreino';
    App.render();
    window.scrollTo(0, 0);
  },

  /* ============ ESCOLHA DO TIPO DE TREINO ============ */
  escolhaTreino() {
    const lista = Store.divisoesPara();
    const atual = Store.treinoPlano();
    return `
      <div class="topo">
        <div>
          <h1 class="display">Qual treino você segue ou quer seguir?</h1>
          <div class="topo-sub">${this.onb
            ? 'Escolha um dos mais conhecidos ou monte o seu. Dá pra trocar os músculos e os exercícios depois.'
            : 'Trocar o tipo de treino monta a semana de novo, com os exercícios sugeridos.'}</div>
        </div>
        ${this.onb ? '' : `<button class="btn-mini" style="width:40px;height:40px;flex-shrink:0" onclick="Editor.abrir('treino')" aria-label="Voltar">✕</button>`}
      </div>

      <div class="tela">
        ${lista.map(d => `
          <button class="card ed-divisao ${atual && atual.divisao === d.id ? 'atual' : ''}" onclick="Editor.escolher('${d.id}')">
            <div class="ed-div-topo">
              <div class="ed-div-nome">${d.nome}</div>
              ${d.recomendada ? '<span class="ed-selo">Recomendado pra você</span>' : ''}
            </div>
            <div class="ed-div-freq">${d.freq}</div>
            <p class="ed-div-desc">${d.desc}</p>
            <div class="ed-div-dias">
              ${d.dias.map((x, i) => `<span><b>${this.LETRAS[i]}</b> ${x.foco}</span>`).join('')}
            </div>
          </button>`).join('')}

        <button class="card ed-divisao ed-proprio ${atual && atual.divisao === 'proprio' ? 'atual' : ''}" onclick="Editor.escolher('proprio')">
          <div class="ed-div-topo"><div class="ed-div-nome">Quero montar o meu</div></div>
          <p class="ed-div-desc">Você escolhe os músculos de cada dia e os exercícios. As séries são suas e as repetições você anota no dia, sem número fixo.</p>
        </button>

        ${this.onb ? `<button class="bib-depois" onclick="Editor.escolher('app')">Deixar o app montar pra mim</button>` : ''}
      </div>`;
  },

  escolher(id) {
    if (id === 'app') {
      delete Store.db.perfil.treino_plano;
      Store.db.perfil.ordem_treino = [0, 1, 2, 3, 4, 5, 6];
      Store.save();
    } else {
      Store.escolherDivisao(id);
    }
    this._salvar();
    this.aba = 'treino';
    this.dia = 0;
    this.exAberto = null;
    App.tela = 'montarPlano';
    App.render();
    window.scrollTo(0, 0);
  },

  /* ============ MONTE SEU PLANO ============ */
  montarPlano() {
    const abas = [['treino', 'Treino'], ['alimentacao', 'Alimentação'], ['metas', 'Metas']];
    return `
      <div class="topo">
        <div>
          <h1 class="display">${this.onb ? 'Monte seu plano' : 'Seu plano'}</h1>
          <div class="topo-sub">${this.onb
            ? 'Ajuste o que quiser. Tudo aqui dá pra mudar depois, dentro do app.'
            : 'Treino, alimentação e metas, do seu jeito.'}</div>
        </div>
        ${this.onb ? '' : `<button class="btn-mini" style="width:40px;height:40px;flex-shrink:0" onclick="Editor.fechar()" aria-label="Fechar">✕</button>`}
      </div>

      <div class="tela">
        <div class="toggle">
          ${abas.map(([id, nome]) => `<button class="${this.aba === id ? 'on' : ''}" onclick="Editor.setAba('${id}')">${nome}</button>`).join('')}
        </div>

        ${this.aba === 'alimentacao' ? this._alimentacao() : this.aba === 'metas' ? this._metas() : this._treino()}

        ${this.onb ? `
          <div style="height:8px"></div>
          <button class="btn" onclick="Onb.criarPlano()">Criar meu plano</button>` : ''}
      </div>`;
  },

  setAba(aba) {
    this.aba = aba;
    this.exAberto = null;
    App.render();
    window.scrollTo(0, 0);
  },

  /* ---------- aba TREINO ---------- */
  _treino() {
    const p = Store.db.perfil;
    const tp = Store.garantirTreinoPlano();
    if (this.dia >= tp.dias.length) this.dia = 0;
    const d = tp.dias[this.dia];
    const livre = !!tp.livre;

    return `
      <div class="card">
        <div class="ed-linha-topo">
          <div>
            <div class="ed-rot" style="margin:0">Tipo de treino</div>
            <div class="ed-nome">${tp.nome}</div>
          </div>
          <button class="mh-editar" onclick="Editor.irEscolha()">Trocar</button>
        </div>

        <div class="ed-rot">Dias de treino por semana</div>
        <div class="ed-chips">
          ${[3, 4, 5, 6].map(n => `<button class="cardio-tipo ${Number(p.dias_treino) === n ? 'on' : ''}" onclick="Editor.diasSemana(${n})">${n}x</button>`).join('')}
        </div>

        <div class="ed-rot">Séries e repetições</div>
        <div class="toggle duas" style="margin-bottom:8px">
          <button class="${!livre ? 'on' : ''}" onclick="Editor.livre(false)">Sugestão do app</button>
          <button class="${livre ? 'on' : ''}" onclick="Editor.livre(true)">As minhas</button>
        </div>
        <p class="ed-nota">${livre
          ? 'O treino mostra só as séries. As repetições você anota no dia, do jeito que fizer.'
          : 'O app sugere as séries e as repetições pelo músculo e pelo seu objetivo.'}</p>
      </div>

      <div class="ed-dias">
        ${tp.dias.map((x, i) => `
          <button class="ed-dia ${i === this.dia ? 'on' : ''}" onclick="Editor.selDia(${i})">
            <b>${this.LETRAS[i]}</b><span>${x.foco || 'Sem músculos'}</span>
          </button>`).join('')}
      </div>

      <div class="card">
        <div class="card-tt">${Ic.halter(20)} Treino ${this.LETRAS[this.dia]}<span class="n">${d.exercicios.length} ${d.exercicios.length === 1 ? 'exercício' : 'exercícios'}</span></div>

        <div class="ed-musc">
          ${d.grupos.length ? d.grupos.map(g => `<span class="musc">${g}</span>`).join('') : '<span class="ed-nota" style="margin:0">Nenhum músculo escolhido ainda.</span>'}
        </div>
        <button class="btn sec" style="margin:4px 0 12px" onclick="Editor.abrirGrupos()">Trocar os músculos deste treino</button>

        ${d.exercicios.map((e, k) => this._exLinha(d, e, k, livre)).join('')}

        <button class="btn sec" style="margin-top:12px" onclick="Editor.abrirAddEx()">+ Adicionar exercício</button>
      </div>

      <p class="ed-nota" style="text-align:center">A semana gira os treinos pelos seus dias de treino. Para escolher o que cai em cada dia, use "Organize a sua semana" na aba Treinos.</p>`;
  },

  _exLinha(d, e, k, livre) {
    const aberto = this.exAberto === k;
    const noDia = d.exercicios.map(x => x.ex);
    const alternativas = Store.exerciciosDoGrupo(e.grupo)
      .map((nome, idx) => ({ nome, idx }))
      .filter(x => !noDia.includes(x.nome));
    const serie = livre && !String(e.reps || '').trim()
      ? `${e.series} ${Number(e.series) === 1 ? 'Série' : 'Séries'}`
      : `${e.series}×${e.reps}`;

    return `
      <div class="ex-bloco ${aberto ? 'aberto' : ''}">
        <div class="ex" onclick="Editor.abrirEx(${k})">
          <div class="ex-n">${k + 1}</div>
          <div style="flex:1;min-width:0">
            <div class="ex-nome">${e.ex}</div>
            <div class="ex-det">${e.grupo || ''}${!livre && e.desc ? ' · descanso ' + e.desc : ''}</div>
          </div>
          <div class="ex-serie">${serie}</div>
          <div class="ex-seta">▾</div>
        </div>
        <div class="ex-corpo">
          ${alternativas.length ? `
            <div class="ed-rot">Trocar por</div>
            <div class="ed-chips">
              ${alternativas.map(x => `<button class="cardio-tipo" onclick="Editor.trocarEx(${k}, ${x.idx})">${x.nome}</button>`).join('')}
            </div>` : ''}

          ${livre ? `
            <div class="series-ajuste">
              <span>Séries</span>
              <button class="btn-mini" onclick="Editor.series(${k}, -1)" aria-label="Tirar uma série">−</button>
              <b>${e.series}</b>
              <button class="btn-mini" onclick="Editor.series(${k}, 1)" aria-label="Pôr uma série">+</button>
            </div>
            <label class="ed-campo">Repetições (opcional)
              <input type="text" value="${String(e.reps || '').replace(/"/g, '')}" placeholder="Em branco: você anota no dia"
                     onchange="Editor.reps(${k}, this.value)">
            </label>` : `
            <p class="ed-nota">Sugestão do app: ${e.series} séries de ${e.reps}${e.desc ? ', descanso de ' + e.desc : ''}. Para usar as suas, escolha "As minhas" lá em cima.</p>`}

          <button class="link-excluir" onclick="Editor.removerEx(${k})">Tirar este exercício</button>
        </div>
      </div>`;
  },

  selDia(i) { this.dia = i; this.exAberto = null; this._pintar(); },

  abrirEx(k) { this.exAberto = this.exAberto === k ? null : k; this._pintar(); },

  diasSemana(n) {
    Store.definirDiasTreino(n);
    this._salvar();
    this._pintar();
  },

  livre(sim) {
    Store.definirLivre(sim);
    this._salvar();
    this._pintar();
  },

  trocarEx(k, idx) {
    const d = Store.treinoPlano().dias[this.dia];
    const nome = Store.exerciciosDoGrupo(d.exercicios[k].grupo)[idx];
    if (!nome) return;
    Store.trocarExercicio(this.dia, k, nome);
    this._salvar();
    this._pintar();
  },

  series(k, delta) {
    const e = Store.treinoPlano().dias[this.dia].exercicios[k];
    Store.definirSeriesReps(this.dia, k, Number(e.series) + delta, null);
    this._salvar();
    this._pintar();
  },

  reps(k, valor) {
    Store.definirSeriesReps(this.dia, k, null, valor);
    this._salvar();
    this._pintar();
  },

  removerEx(k) {
    Store.removerExercicio(this.dia, k);
    this.exAberto = null;
    this._salvar();
    this._pintar();
  },

  /* músculos do dia: seleção num modal, só grava no Salvar */
  abrirGrupos(manter) {
    if (!manter) this.gruposSel = Store.treinoPlano().dias[this.dia].grupos.slice();
    App.modal(`
      <h3>Músculos do treino ${this.LETRAS[this.dia]}</h3>
      <p class="m-sub">Toque para marcar ou desmarcar. O app monta os exercícios com o que você escolher, e o que você já tinha trocado fica.</p>
      <div class="ed-chips" style="margin-bottom:16px">
        ${GRUPOS_MUSCULARES.map(g => `
          <button class="cardio-tipo ${this.gruposSel.includes(g) ? 'on' : ''}" onclick="Editor.alternarGrupo('${g}')">${g}</button>`).join('')}
      </div>
      <button class="btn" onclick="Editor.salvarGrupos()">Salvar</button>
      <div style="height:10px"></div>
      <button class="btn sec" onclick="App.fecharModal()">Cancelar</button>`);
  },

  alternarGrupo(g) {
    const i = this.gruposSel.indexOf(g);
    if (i >= 0) this.gruposSel.splice(i, 1); else this.gruposSel.push(g);
    /* mantém a ordem da lista de músculos, que é a ordem do treino */
    this.gruposSel.sort((a, b) => GRUPOS_MUSCULARES.indexOf(a) - GRUPOS_MUSCULARES.indexOf(b));
    this.abrirGrupos(true);
  },

  salvarGrupos() {
    Store.definirGruposDia(this.dia, this.gruposSel);
    App.fecharModal();
    this.exAberto = null;
    this._salvar();
    this._pintar();
  },

  /* adicionar exercício: primeiro o músculo, depois o exercício */
  abrirAddEx(grupo) {
    const d = Store.treinoPlano().dias[this.dia];
    if (!grupo) {
      return App.modal(`
        <h3>Adicionar exercício</h3>
        <p class="m-sub">De qual músculo?</p>
        <div class="ed-chips" style="margin-bottom:16px">
          ${GRUPOS_MUSCULARES.map(g => `<button class="cardio-tipo" onclick="Editor.abrirAddEx('${g}')">${g}</button>`).join('')}
        </div>
        <button class="btn sec" onclick="App.fecharModal()">Cancelar</button>`);
    }
    const noDia = d.exercicios.map(x => x.ex);
    const lista = Store.exerciciosDoGrupo(grupo).map((nome, idx) => ({ nome, idx })).filter(x => !noDia.includes(x.nome));
    App.modal(`
      <h3>${grupo}</h3>
      <p class="m-sub">${lista.length ? 'Escolha o exercício.' : 'Todos os exercícios deste músculo já estão no treino.'}</p>
      <div class="ed-lista-ex">
        ${lista.map(x => `<button class="ed-item" onclick="Editor.addEx('${grupo}', ${x.idx})">${x.nome}<span>+</span></button>`).join('')}
      </div>
      <div style="height:12px"></div>
      <button class="btn sec" onclick="Editor.abrirAddEx()">Voltar</button>`);
  },

  addEx(grupo, idx) {
    const nome = Store.exerciciosDoGrupo(grupo)[idx];
    if (!nome) return;
    Store.addExercicio(this.dia, grupo, nome);
    App.fecharModal();
    this._salvar();
    this._pintar();
  },

  /* ---------- aba ALIMENTAÇÃO ---------- */
  _alimentacao() {
    const propria = Store.dietaPropriaAtiva() || (Store.db.perfil.dieta_propria && Store.db.perfil.dieta_propria.ativa);
    return `
      <div class="toggle duas">
        <button class="${!propria ? 'on' : ''}" onclick="Editor.modoDieta(false)">Cardápio do app</button>
        <button class="${propria ? 'on' : ''}" onclick="Editor.modoDieta(true)">Minha dieta</button>
      </div>
      ${propria ? this._dietaPropria() : this._horariosApp()}`;
  },

  _horariosApp() {
    return `
      <div class="card">
        <div class="card-tt">${Ic.talher(20)} Horários das refeições</div>
        <p class="ed-nota">O cardápio do app ajusta as gramagens à sua meta de calorias e muda de variação durante a semana. Aqui você escolhe o horário de cada refeição; o lembrete toca no horário novo.</p>
        ${Store.planoAlimentar().map(r => `
          <div class="ed-hora">
            <span>${r.nome}</span>
            <input type="time" value="${r.horario}" onchange="Editor.horaRef('${r.id}', this.value)">
          </div>`).join('')}
      </div>
      <p class="ed-nota" style="text-align:center">Já tem a sua rotina alimentar? Toque em <b>Minha dieta</b> e monte com os seus alimentos e as suas quantidades.</p>`;
  },

  _dietaPropria() {
    const p = Store.db.perfil;
    const d = Store.dietaPropria();
    const t = Store.totaisDietaPropria();
    const barra = (v, m) => `<div class="barra"><i style="width:${m ? Math.min(100, Math.round(v / m * 100)) : 0}%"></i></div>`;
    return `
      <div class="card">
        <div class="card-tt">${Ic.alvo(20)} Sua dieta soma, por dia</div>
        <div class="ed-soma"><span>Calorias</span><b>${t.kcal} <small>/ ${p.meta_kcal} kcal</small></b></div>${barra(t.kcal, p.meta_kcal)}
        <div class="ed-soma"><span>Proteína</span><b>${t.prot} <small>/ ${p.meta_prot} g</small></b></div>${barra(t.prot, p.meta_prot)}
        <div class="ed-soma"><span>Carboidratos</span><b>${t.carb} <small>/ ${p.meta_carb} g</small></b></div>${barra(t.carb, p.meta_carb)}
        <p class="ed-nota" style="margin-top:10px">Valores médios da tabela TACO, calculados pelas gramas de cada alimento. As metas você ajusta na aba Metas.</p>
      </div>

      ${d.refeicoes.map(r => `
        <div class="card">
          <div class="ed-ref-topo">
            <input class="ed-ref-nome" value="${r.nome.replace(/"/g, '')}" onchange="Editor.nomeRef('${r.id}', this.value)" aria-label="Nome da refeição">
            <input type="time" value="${r.horario}" onchange="Editor.horaRef('${r.id}', this.value)" aria-label="Horário">
          </div>
          ${r.alimentos.length ? r.alimentos.map(a => {
            const it = Store._itemProprio(a);
            return `
            <div class="ed-alim">
              <div style="flex:1;min-width:0">
                <div class="ed-alim-nome">${a.nome}</div>
                <div class="ed-alim-det">${it.kcal} kcal · ${it.prot}g P · ${it.carb}g C</div>
              </div>
              <label class="ed-gramas"><input type="number" inputmode="numeric" min="0" value="${a.g}"
                     onchange="Editor.gramas('${r.id}', '${a.id}', this.value)"><span>g</span></label>
              <button class="corrida-apagar" onclick="Editor.removerAlim('${r.id}', '${a.id}')" aria-label="Tirar">&times;</button>
            </div>`;
          }).join('') : `<p class="ed-nota">Nenhum alimento ainda.</p>`}
          <button class="btn sec" style="margin-top:10px" onclick="Editor.abrirAddAlim('${r.id}')">+ Adicionar alimento</button>
          <button class="link-excluir" onclick="Editor.removerRef('${r.id}')">Tirar esta refeição</button>
        </div>`).join('')}

      <button class="btn sec" onclick="Editor.novaRef()">+ Nova refeição</button>`;
  },

  modoDieta(propria) {
    Store.ativarDietaPropria(propria);
    this._salvar();
    this._pintar();
  },

  horaRef(id, hora) {
    if (!hora) return;
    if (Store.dietaPropriaAtiva() || (Store.db.perfil.dieta_propria && Store.db.perfil.dieta_propria.ativa)) Store.editarRefeicaoPropria(id, { horario: hora });
    else Store.definirHoraRefeicao(id, hora);
    this._salvar();
    this._pintar();
    App.toast(`Horário salvo: ${hora}.`);
  },

  nomeRef(id, nome) {
    Store.editarRefeicaoPropria(id, { nome });
    this._salvar();
  },

  novaRef() {
    Store.addRefeicaoPropria('Nova refeição', '15:00');
    this._salvar();
    this._pintar();
  },

  removerRef(id) {
    if (!confirm('Tirar esta refeição da sua dieta?')) return;
    Store.removerRefeicaoPropria(id);
    this._salvar();
    this._pintar();
  },

  gramas(refId, alimId, g) {
    Store.editarGramasProprio(refId, alimId, g);
    this._salvar();
    this._pintar();
  },

  removerAlim(refId, alimId) {
    Store.removerAlimentoProprio(refId, alimId);
    this._salvar();
    this._pintar();
  },

  /* adicionar alimento: busca na tabela, escolhe, digita as gramas */
  abrirAddAlim(refId) {
    this.refAlvo = refId;
    this.busca = '';
    this.grupoBusca = 'Todos';
    const grupos = ['Todos', ...new Set(ALIMENTOS.map(a => a.grupo))];
    App.modal(`
      <h3>Adicionar alimento</h3>
      <input class="ed-busca" id="ed-busca" type="search" placeholder="Buscar: arroz, frango, banana..."
             oninput="Editor.buscar(this.value)" autocomplete="off">
      <div class="ed-chips ed-grupos" id="ed-grupos">${this._chipsGrupo(grupos)}</div>
      <div class="ed-lista-ex" id="ed-lista">${this._listaAlim()}</div>
      <button class="ed-link" style="margin:12px 0" onclick="Editor.alimLivre()">Não achei o alimento</button>
      <button class="btn sec" onclick="App.fecharModal()">Cancelar</button>`);
  },

  _chipsGrupo(grupos) {
    return grupos.map(g => `<button class="cardio-tipo ${this.grupoBusca === g ? 'on' : ''}" onclick="Editor.filtrarGrupo('${g}')">${g}</button>`).join('');
  },

  _semAcento(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); },

  _listaAlim() {
    const q = this._semAcento(this.busca.trim());
    const lista = ALIMENTOS.filter(a =>
      (this.grupoBusca === 'Todos' || a.grupo === this.grupoBusca) &&
      (!q || this._semAcento(a.nome).includes(q)));
    if (!lista.length) return `<p class="ed-nota">Nada com esse nome. Use "Não achei o alimento" e digite os valores do rótulo.</p>`;
    return lista.map(a => `
      <button class="ed-item" onclick="Editor.selAlim('${a.id}')">
        <div><div>${a.nome}</div><small>100 g: ${a.kcal} kcal · ${a.prot}g P · ${a.carb}g C</small></div><span>+</span>
      </button>`).join('');
  },

  buscar(v) {
    this.busca = v;
    const el = document.getElementById('ed-lista');
    if (el) el.innerHTML = this._listaAlim();
  },

  filtrarGrupo(g) {
    this.grupoBusca = g;
    const grupos = ['Todos', ...new Set(ALIMENTOS.map(a => a.grupo))];
    const c = document.getElementById('ed-grupos');
    if (c) c.innerHTML = this._chipsGrupo(grupos);
    this.buscar(this.busca);
  },

  selAlim(id) {
    const a = ALIMENTOS.find(x => x.id === id);
    if (!a) return;
    App.modal(`
      <h3>${a.nome}</h3>
      <p class="m-sub">Em 100 g: ${a.kcal} kcal, ${a.prot} g de proteína e ${a.carb} g de carboidrato.</p>
      <div class="campo">
        <label>Quantidade em gramas</label>
        <input id="ed-g" type="number" inputmode="numeric" min="1" placeholder="Ex: 120"
               oninput="Editor.previa('${a.id}')">
      </div>
      <p class="ed-previa" id="ed-previa">Digite as gramas para ver as calorias.</p>
      <button class="btn" onclick="Editor.confirmarAlim('${a.id}')">Adicionar</button>
      <div style="height:10px"></div>
      <button class="btn sec" onclick="Editor.abrirAddAlim('${this.refAlvo}')">Voltar</button>`);
    setTimeout(() => { const c = document.getElementById('ed-g'); if (c) c.focus(); }, 80);
  },

  previa(id) {
    const a = ALIMENTOS.find(x => x.id === id);
    const g = Number((document.getElementById('ed-g') || {}).value) || 0;
    const el = document.getElementById('ed-previa');
    if (!a || !el) return;
    el.textContent = g
      ? `${g} g = ${Math.round(a.kcal * g / 100)} kcal · ${Math.round(a.prot * g / 100)} g de proteína · ${Math.round(a.carb * g / 100)} g de carboidrato`
      : 'Digite as gramas para ver as calorias.';
  },

  confirmarAlim(id) {
    const g = Number((document.getElementById('ed-g') || {}).value);
    if (!g || g <= 0 || g > 3000) return App.toast('Digite a quantidade em gramas.');
    Store.addAlimentoTabela(this.refAlvo, id, g);
    App.fecharModal();
    this._salvar();
    this._pintar();
  },

  alimLivre() {
    App.modal(`
      <h3>Outro alimento</h3>
      <p class="m-sub">Digite o nome e os valores da tabela nutricional do rótulo, <b>por 100 g</b>.</p>
      <div class="campo"><label>Nome</label><input id="al-nome" type="text" placeholder="Ex: Pão de queijo"></div>
      <div class="cardio-campos">
        <label>Calorias (kcal)<input id="al-kcal" type="number" inputmode="decimal" min="0"></label>
        <label>Proteína (g)<input id="al-prot" type="number" inputmode="decimal" min="0"></label>
      </div>
      <div class="cardio-campos">
        <label>Carboidrato (g)<input id="al-carb" type="number" inputmode="decimal" min="0"></label>
        <label>Quanto você come (g)<input id="al-g" type="number" inputmode="numeric" min="1"></label>
      </div>
      <button class="btn" onclick="Editor.confirmarLivre()">Adicionar</button>
      <div style="height:10px"></div>
      <button class="btn sec" onclick="Editor.abrirAddAlim('${this.refAlvo}')">Voltar</button>`);
  },

  confirmarLivre() {
    const v = id => (document.getElementById(id) || {}).value;
    const nome = String(v('al-nome') || '').trim();
    const g = Number(v('al-g'));
    if (!nome) return App.toast('Digite o nome do alimento.');
    if (!g || g <= 0) return App.toast('Digite quantas gramas você come.');
    if (!Number(v('al-kcal'))) return App.toast('Digite as calorias por 100 g do rótulo.');
    Store.addAlimentoLivre(this.refAlvo, g, { nome, kcal: v('al-kcal'), prot: v('al-prot'), carb: v('al-carb') });
    App.fecharModal();
    this._salvar();
    this._pintar();
  },

  /* ---------- aba METAS ---------- */
  _metas() {
    const p = Store.db.perfil;
    const s = Store.sugestaoMetas();
    const gkg = p.objetivo === 'emagrecimento' ? '2,0' : p.objetivo === 'hipertrofia' ? '1,8' : '1,6';
    const fmt = v => String(v).replace('.', ',');
    const linhas = [
      ['kcal', 'Calorias', 'kcal', p.meta_kcal, s.kcal, 1, 'Fórmula de Mifflin-St Jeor com o seu peso, altura, idade e objetivo.'],
      ['prot', 'Proteína', 'g', p.meta_prot, s.prot, 1, `${gkg} g por quilo do seu peso, pelo seu objetivo.`],
      ['carb', 'Carboidratos', 'g', p.meta_carb, s.carb, 1, 'O que sobra das calorias depois da proteína e de 25% de gordura.'],
      ['agua', 'Água', 'L', p.meta_agua / 1000, s.agua / 1000, 0.1, '35 ml por quilo do seu peso.'],
      ['sono', 'Sono', 'h', p.meta_sono, s.sono, 0.5, 'Entre 7 e 9 horas por noite é o recomendado para adultos.']
    ];
    const dieta = Store.dietaPropriaAtiva() ? Store.totaisDietaPropria() : null;

    return `
      <div class="card">
        <div class="card-tt">${Ic.alvo(20)} Suas metas do dia</div>
        <p class="ed-nota">O app calcula cada meta pelos seus dados e recalcula a cada pesagem. Se preferir outro número, troque e salve: o seu vale até você voltar para a sugestão.</p>
        ${linhas.map(([k, nome, un, valor, sug, passo, porque]) => `
          <div class="ed-meta">
            <div class="ed-meta-topo">
              <b>${nome}</b>
              ${Store.metaManual(k) ? '<span class="ed-selo">sua</span>' : '<span class="ed-selo claro">do app</span>'}
            </div>
            <div class="ed-meta-in">
              <input id="meta-${k}" type="number" inputmode="decimal" step="${passo}" min="0"
                     value="${valor}" data-orig="${valor}">
              <span>${un}</span>
            </div>
            <div class="ed-nota" style="margin:4px 0 0">Sugestão do app: <b>${fmt(sug)} ${un}</b>. ${porque}
              ${Store.metaManual(k) ? `<button class="ed-link" onclick="Editor.usarSugestao('${k}')">Usar a sugestão</button>` : ''}</div>
          </div>`).join('')}

        <div class="ed-meta">
          <div class="ed-meta-topo"><b>Horário do lembrete de sono</b></div>
          <div class="ed-meta-in"><input id="meta-hora-sono" type="time" value="${Store.horaSono()}"></div>
        </div>

        ${dieta ? `<p class="ed-nota">A sua dieta soma hoje ${dieta.kcal} kcal, ${dieta.prot} g de proteína e ${dieta.carb} g de carboidrato.</p>` : ''}

        <button class="btn" onclick="Editor.salvarMetas()">Salvar metas</button>
      </div>`;
  },

  /* só vai pro Store o que ela mudou: um campo que ela não tocou e estava
     no automático continua no automático (e segue acompanhando o peso) */
  salvarMetas() {
    const campos = {};
    ['kcal', 'prot', 'carb', 'agua', 'sono'].forEach(k => {
      const el = document.getElementById('meta-' + k);
      if (!el) return;
      const v = parseFloat(String(el.value).replace(',', '.'));
      const orig = parseFloat(el.dataset.orig);
      if (isNaN(v) || v === orig) return;
      campos[k] = k === 'agua' ? Math.round(v * 1000) : v;
    });
    if (campos.kcal !== undefined && (campos.kcal < 800 || campos.kcal > 6000)) return App.toast('Calorias entre 800 e 6000.');
    if (campos.agua !== undefined && (campos.agua < 500 || campos.agua > 8000)) return App.toast('Água entre 0,5 e 8 litros.');
    if (campos.sono !== undefined && (campos.sono < 4 || campos.sono > 12)) return App.toast('Sono entre 4 e 12 horas.');
    if (Object.keys(campos).length) Store.definirMetas(campos);
    const hs = document.getElementById('meta-hora-sono');
    if (hs && hs.value) { Store.db.perfil.hora_sono = hs.value; Store.save(); }
    this._salvar();
    this._pintar();
    App.toast('Metas salvas ✅', true);
  },

  usarSugestao(k) {
    const p = Store.db.perfil;
    if (p.metas_manuais) delete p.metas_manuais[k];
    Store.recalcularMetas(p);
    Store.save();
    this._salvar();
    this._pintar();
  }
};

window.Editor = Editor;

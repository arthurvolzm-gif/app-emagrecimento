/* =========================================================
   APP — roteador, ações e inicialização
   ========================================================= */

const App = {
  tela: 'inicio',
  passo: 1,
  modoAuth: 'entrar',
  periodo: 'semana',
  diaTreino: 0,
  refAberta: null,
  busca: '',
  cat: 'Todos',
  exAberto: null,
  abaCardapio: 'cardapio',
  modoLocal: false,

  /* ---------- inicialização ---------- */
  async iniciar() {
    Store.load();
    await Backend.carregarLib();
    const temBackend = Backend.init();

    if (temBackend) {
      const usuario = await Backend.sessao();
      if (usuario) {
        const remoto = await Backend.carregar();
        if (remoto && remoto.perfil) {
          Store.db = remoto;
          Store.save();
          this.tela = 'inicio';
        } else {
          this.tela = Store.temPerfil() ? 'inicio' : 'cadastro';
        }
      } else {
        /* sem sessão: se já usava o app localmente, respeita o modo local */
        this.tela = Store.temPerfil() ? 'inicio' : 'auth';
        this.modoLocal = Store.temPerfil();
      }
    } else {
      this.tela = Store.temPerfil() ? 'inicio' : 'auth';
      this.modoLocal = true;
    }

    this.diaTreino = this.indiceHoje();
    this.render();
  },

  /* ---------- render ---------- */
  render() {
    const app = document.getElementById('app');
    const nav = document.getElementById('nav');

    /* telas sem navegação inferior */
    if (this.tela === 'auth')     { app.innerHTML = Onb.auth();     nav.style.display = 'none'; return; }
    if (this.tela === 'cadastro') { app.innerHTML = Onb.cadastro(); nav.style.display = 'none'; return; }

    if (!Store.temPerfil()) { this.tela = 'cadastro'; return this.render(); }

    const fn = Telas[this.tela] || Telas.inicio;
    app.innerHTML = fn.call(Telas);

    /* telas internas ocupam a tela inteira, sem a barra de navegação */
    const internas = ['biblioteca', 'cardapio'];
    nav.style.display = internas.includes(this.tela) ? 'none' : 'flex';
    document.querySelectorAll('.nav button').forEach(b => {
      b.classList.toggle('on', b.dataset.tela === this.tela);
    });
  },

  ir(tela) {
    this.tela = tela;
    if (tela === 'treinos') this.diaTreino = this.indiceHoje();
    this.render();
    window.scrollTo(0, 0);
  },

  /* ---------- ações do dia ---------- */
  agua(ml) {
    const antes = Store.dia().agua;
    Store.addAgua(ml);
    Backend.agendarSync();
    const p = Store.db.perfil;
    const depois = Store.dia().agua;
    this.render();
    if (antes < p.meta_agua && depois >= p.meta_agua) this.toast('Meta de água batida! +20 pontos 💧', true);
  },

  marcarTreino() {
    if (!Store.concluirTreino()) return;      // já estava concluído, ignora
    Backend.agendarSync();
    this.render();
    this.toast('Treino concluído! +40 pontos 🏋️', true);
  },

  marcarAlimento(refId, alimId) {
    Store.alternarAlimento(refId, alimId);
    Backend.agendarSync();
    const ref = Store.planoAlimentar().find(r => r.id === refId);
    const [m, t] = Store.progressoRefeicao(ref);
    this.render();
    if (m === t) this.toast(`${ref.nome} completa! +10 pontos ✅`, true);
  },

  refeicaoToda(refId, marcar) {
    Store.marcarRefeicaoToda(refId, marcar);
    Backend.agendarSync();
    this.render();
    if (marcar) this.toast('Refeição marcada como feita ✅', true);
  },

  abrirRef(id) {
    this.refAberta = this.refAberta === id ? null : id;
    this.render();
  },

  selDia(i) { this.diaTreino = i; this.render(); },

  /* ---------- organização da semana ---------- */
  trocarDiaTreino(posicao, idxTreino) {
    const trocou = Store.trocarDiaTreino(posicao, idxTreino);
    Backend.agendarSync();
    this.render();
    if (trocou) this.toast('Semana reorganizada ✅', true);
  },

  restaurarOrdem() {
    Store.restaurarOrdemTreino();
    Backend.agendarSync();
    this.render();
    this.toast('Ordem original do plano restaurada');
  },

  /* ---------- cargas dos exercícios ---------- */
  /* recebe a posição do exercício no treino do dia e devolve o nome,
     que é a chave usada para guardar o histórico de carga */
  nomeExercicio(i) {
    const dia = Store.diasTreino()[this.diaTreino];
    return dia && dia.exercicios && dia.exercicios[i] ? dia.exercicios[i].ex : null;
  },

  abrirEx(i) {
    const nome = this.nomeExercicio(i);
    if (!nome) return;
    this.exAberto = this.exAberto === nome ? null : nome;
    this.render();
  },

  salvarCarga(i) {
    const nome = this.nomeExercicio(i);
    if (!nome) return;
    const peso = parseFloat(document.getElementById('carga-peso').value);
    const reps = parseInt(document.getElementById('carga-reps').value, 10);
    if (isNaN(peso) || peso < 0 || peso > 1000) return this.toast('Digite uma carga válida.');

    const anterior = Store.ultimaCarga(nome);
    Store.registrarCarga(nome, peso, reps);
    Backend.agendarSync();
    this.exAberto = null;
    this.render();

    if (anterior && peso > anterior.peso) {
      this.toast(`Subiu de ${anterior.peso}kg para ${peso}kg! 💪`, true);
    } else {
      this.toast('Carga registrada ✅', true);
    }
  },
  setPeriodo(p) { this.periodo = p; this.render(); },
  setAbaCardapio(a) { this.abaCardapio = a; this.render(); window.scrollTo(0, 0); },
  setCat(c) { this.cat = c; this.render(); },

  buscar(v) {
    this.busca = v;
    const pos = document.querySelector('.busca').selectionStart;
    this.render();
    const inp = document.querySelector('.busca');
    if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
  },

  /* ---------- modais ---------- */
  modal(html) {
    const bg = document.getElementById('modal-bg');
    document.getElementById('modal').innerHTML = `<div class="modal-puxador"></div>` + html;
    bg.classList.add('on');
  },

  fecharModal() { document.getElementById('modal-bg').classList.remove('on'); },

  abrirSono() {
    const atual = Store.dia().sono || '';
    this.modal(`
      <h3 class="display">Quanto você dormiu?</h3>
      <p class="m-sub">Registre as horas de sono da noite passada.</p>
      <div class="campo">
        <label>Horas de sono</label>
        <input id="m-sono" type="number" inputmode="decimal" step="0.5" placeholder="Ex: 7.5" value="${atual}">
      </div>
      <button class="btn" onclick="App.salvarSono()">Salvar</button>
      <div style="height:10px"></div>
      <button class="btn sec" onclick="App.fecharModal()">Cancelar</button>
    `);
    setTimeout(() => document.getElementById('m-sono').focus(), 120);
  },

  salvarSono() {
    const v = parseFloat(document.getElementById('m-sono').value);
    if (isNaN(v)) return;
    const p = Store.db.perfil;
    const antes = Store.dia().sono;
    Store.setSono(v);
    Backend.agendarSync();
    this.fecharModal();
    this.render();
    if (antes < p.meta_sono && v >= p.meta_sono) this.toast('Meta de sono batida! +20 pontos 😴', true);
  },

  abrirPeso() {
    this.modal(`
      <h3 class="display">Registrar pesagem</h3>
      <p class="m-sub">Pese-se sempre no mesmo horário, de preferência em jejum.</p>
      <div class="campo">
        <label>Peso de hoje (kg)</label>
        <input id="m-peso" type="number" inputmode="decimal" step="0.1" placeholder="Ex: 79.8" value="${Store.db.perfil.peso_atual}">
      </div>
      <button class="btn" onclick="App.salvarPeso()">Salvar pesagem</button>
      <div style="height:10px"></div>
      <button class="btn sec" onclick="App.fecharModal()">Cancelar</button>
    `);
    setTimeout(() => document.getElementById('m-peso').select(), 120);
  },

  salvarPeso() {
    const v = parseFloat(document.getElementById('m-peso').value);
    if (isNaN(v) || v < 35 || v > 300) return this.toast('Digite um peso válido.');
    Store.registrarPeso(v);
    Backend.agendarSync();
    this.fecharModal();
    this.render();
    this.toast('Pesagem registrada! +15 pontos ⚖️', true);
  },

  abrirEditar() {
    const p = Store.db.perfil;
    this.modal(`
      <h3 class="display">Editar meus dados</h3>
      <p class="m-sub">Ao mudar peso, altura, idade ou objetivo, suas metas são recalculadas.</p>

      <div class="campo"><label>Nome</label><input id="e-nome" value="${p.nome}"></div>
      <div class="campo"><label>Idade</label><input id="e-idade" type="number" value="${p.idade}"></div>
      <div class="campo"><label>Altura (cm)</label><input id="e-altura" type="number" value="${p.altura}"></div>
      <div class="campo"><label>Meta de peso (kg)</label><input id="e-meta" type="number" step="0.1" value="${p.meta_peso}"></div>

      <div class="campo">
        <label>Objetivo</label>
        <select id="e-objetivo">
          <option value="emagrecimento" ${p.objetivo==='emagrecimento'?'selected':''}>Emagrecimento</option>
          <option value="hipertrofia" ${p.objetivo==='hipertrofia'?'selected':''}>Hipertrofia</option>
          <option value="manutencao" ${p.objetivo==='manutencao'?'selected':''}>Manutenção</option>
        </select>
      </div>

      <div class="campo">
        <label>Local de treino</label>
        <select id="e-local">
          <option value="academia" ${p.local==='academia'?'selected':''}>Academia</option>
          <option value="casa" ${p.local==='casa'?'selected':''}>Em casa</option>
        </select>
      </div>

      <div class="campo">
        <label>Treinos indicados para</label>
        <select id="e-sexo">
          <option value="feminino" ${p.sexo==='feminino'?'selected':''}>Mulher</option>
          <option value="masculino" ${p.sexo==='masculino'?'selected':''}>Homem</option>
        </select>
      </div>

      <button class="btn" onclick="App.salvarEdicao()">Salvar alterações</button>
      <div style="height:10px"></div>
      <button class="btn sec" onclick="App.fecharModal()">Cancelar</button>
    `);
  },

  salvarEdicao() {
    const v = id => document.getElementById(id).value;
    Store.atualizarPerfil({
      nome: v('e-nome').trim() || Store.db.perfil.nome,
      idade: Number(v('e-idade')),
      altura: Number(v('e-altura')),
      meta_peso: Number(v('e-meta')),
      objetivo: v('e-objetivo'),
      local: v('e-local'),
      sexo: v('e-sexo')
    });
    Backend.agendarSync();
    this.fecharModal();
    this.diaTreino = this.indiceHoje();
    this.render();
    this.toast('Dados atualizados e metas recalculadas ✅', true);
  },

  /* ---------- conta ---------- */
  trocarModoAuth() {
    this.modoAuth = this.modoAuth === 'entrar' ? 'criar' : 'entrar';
    Onb.erro = '';
    this.render();
  },

  usarLocal() {
    this.modoLocal = true;
    this.tela = Store.temPerfil() ? 'inicio' : 'cadastro';
    this.passo = 1;
    this.render();
  },

  async sair() {
    if (!confirm('Sair da sua conta? Seus dados continuam salvos na nuvem.')) return;
    await Backend.salvar();
    await Backend.sair();
    Store.resetar();
    this.tela = 'auth';
    this.modoAuth = 'entrar';
    this.render();
  },

  resetar() {
    if (!confirm('Apagar todos os seus dados deste aparelho? Isso não tem volta.')) return;
    Store.resetar();
    this.tela = 'cadastro';
    this.passo = 1;
    Onb.dados = { nome:'', idade:'', sexo:'', peso:'', altura:'', meta_peso:'', objetivo:'', local:'' };
    this.render();
  },

  /* ---------- helpers ---------- */
  saudacao() {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  },

  /* 0=Seg ... 6=Dom, alinhado com a ordem do plano de treino */
  indiceHoje() {
    const d = new Date().getDay();      // 0=Dom
    return d === 0 ? 6 : d - 1;
  },

  treinoDeHoje() {
    return Store.planoTreino().dias[this.indiceHoje()];
  },

  rotuloObjetivo() {
    const o = Store.db.perfil.objetivo;
    return o === 'emagrecimento' ? 'Emagrecimento'
         : o === 'hipertrofia'   ? 'Hipertrofia'
         : 'Manutenção';
  },

  iconeCat(c) {
    return { Pernas:'🦵', Glúteos:'🍑', Costas:'🔙', Peito:'💪', Ombro:'🤸',
             Braço:'💪', Abdômen:'🎯', Cardio:'🔥' }[c] || '🏋️';
  },

  dataBr(iso) {
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  },

  dataCurta(iso) {
    const [, m, d] = iso.split('-');
    const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    return `${d} ${meses[Number(m) - 1]}`;
  },

  toast(msg, verde) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast on' + (verde ? ' verde' : '');
    clearTimeout(this._tToast);
    this._tToast = setTimeout(() => { t.className = 'toast'; }, 2600);
  }
};

/* salva pendências ao sair da página */
window.addEventListener('pagehide', () => { if (Backend.ativo()) Backend.salvar(); });

document.addEventListener('DOMContentLoaded', () => App.iniciar());

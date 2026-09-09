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
    this.aplicarTema();
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

    this.aplicarTema();          /* de novo: o tema pode ter vindo da nuvem */
    this.diaTreino = this.indiceHoje();
    this.render();
  },

  /* ---------- tema claro / escuro ---------- */
  aplicarTema() {
    const t = Store.tema();
    document.documentElement.dataset.tema = t;
    try { localStorage.setItem('app_emag_tema', t); } catch (e) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'escuro' ? '#0B1310' : '#159A55');
  },

  alternarTema() {
    Store.definirTema(Store.tema() === 'escuro' ? 'claro' : 'escuro');
    this.aplicarTema();
    Backend.agendarSync();
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
    if (this.checarNivel()) return;
    if (antes < p.meta_agua && depois >= p.meta_agua) this.toast('Meta de água batida! +20 pontos 💧', true);
  },

  marcarTreino() {
    if (!Store.concluirTreino()) return;      // já estava concluído, ignora
    Backend.agendarSync();
    this.render();
    if (this.checarNivel()) return;
    this.toast('Treino concluído! +40 pontos 🏋️', true);
  },

  marcarAlimento(refId, alimId) {
    Store.alternarAlimento(refId, alimId);
    Backend.agendarSync();
    const ref = Store.planoAlimentar().find(r => r.id === refId);
    const [m, t] = Store.progressoRefeicao(ref);
    this.render();
    if (this.checarNivel()) return;
    if (m === t) this.toast(`${ref.nome} completa! +10 pontos ✅`, true);
  },

  refeicaoToda(refId, marcar) {
    Store.marcarRefeicaoToda(refId, marcar);
    Backend.agendarSync();
    this.render();
    if (this.checarNivel()) return;
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

  /* ---------- subida de nível ----------
     Chamado depois de toda ação que dá pontos. Se a pessoa cruzou
     a faixa de um nível novo, a comemoração entra no lugar do toast. */
  checarNivel() {
    const novo = Store.nivelPendente();
    if (!novo) return false;
    Store.marcarNivelVisto(novo.n);
    Backend.agendarSync();
    setTimeout(() => this.mostrarNivelUp(novo), 260);
    return true;
  },

  /* prévia: mostra a animação de qualquer nível sem mexer no progresso real */
  previaNivel(n) {
    const base = NIVEIS[n - 1];
    if (!base) return;
    const proximo = NIVEIS[n] || null;
    this.mostrarNivelUp({
      ...base,
      pontos: base.min,
      totalNiveis: NIVEIS.length,
      proximo,
      faltam: proximo ? proximo.min - base.min : 0
    });
  },

  mostrarNivelUp(nv) {
    const el = document.getElementById('nivelup');
    const cores = [nv.cor2, '#FFFFFF', nv.cor1, '#FFD86B', nv.cor2];

    /* confete: cada pedaço com posição, atraso, giro e forma próprios */
    let confete = '';
    for (let i = 0; i < 46; i++) {
      const cor = cores[i % cores.length];
      const esq = Math.random() * 100;
      const atraso = Math.random() * 0.7;
      const dur = 1.9 + Math.random() * 1.4;
      const larg = 6 + Math.random() * 7;
      const alt = larg * (0.5 + Math.random());
      const giro = (Math.random() * 900 - 450).toFixed(0);
      const desvio = (Math.random() * 120 - 60).toFixed(0);
      const redondo = i % 4 === 0 ? '50%' : '2px';
      confete += `<i style="left:${esq}%;background:${cor};width:${larg}px;height:${alt}px;
                    border-radius:${redondo};animation-delay:${atraso}s;animation-duration:${dur}s;
                    --giro:${giro}deg;--desvio:${desvio}px"></i>`;
    }

    el.innerHTML = `
      <div class="nu-brilho" style="background:radial-gradient(circle at 50% 42%, ${nv.cor2}55 0%, transparent 62%)"></div>
      <div class="nu-confete">${confete}</div>

      <div class="nu-caixa">
        <div class="nu-selo-area">
          <span class="nu-anel" style="border-color:${nv.cor2}"></span>
          <span class="nu-anel a2" style="border-color:${nv.cor2}"></span>
          <span class="nu-anel a3" style="border-color:${nv.cor2}"></span>
          <div class="nu-raios">${Array.from({length:12},(_, i)=>
            `<b style="transform:rotate(${i*30}deg);background:linear-gradient(to top, transparent, ${nv.cor2})"></b>`).join('')}</div>
          <div class="nu-halo" style="background:radial-gradient(circle, ${nv.cor2} 0%, transparent 70%)"></div>
          <div class="nu-selo" style="--brilho:${nv.cor2}90">${nv.icone}</div>
        </div>

        <div class="nu-tag">${nv.n === 1 ? 'Seu plano está pronto' : 'Você subiu de nível'}</div>
        <div class="nu-nome" style="background:linear-gradient(100deg, ${nv.cor2}, #fff);
             -webkit-background-clip:text;background-clip:text;color:transparent">${nv.nome}</div>
        <div class="nu-n">Nível ${nv.n} de ${NIVEIS.length} · ${nv.pontos} pontos</div>
        <p class="nu-frase">${nv.frase}</p>

        ${nv.proximo ? `
          <div class="nu-prox">
            Próximo: <b>${nv.proximo.nome}</b> ${nv.proximo.icone} em mais ${nv.faltam} pontos
          </div>` : `
          <div class="nu-prox">Você chegou ao último nível. 👑</div>`}

        <button class="nu-btn" onclick="App.fecharNivelUp()">Continuar</button>
      </div>`;

    el.classList.add('on');
  },

  fecharNivelUp() {
    const el = document.getElementById('nivelup');
    el.classList.add('saindo');
    setTimeout(() => {
      el.className = 'nivelup';
      el.innerHTML = '';
      this.render();
    }, 320);
  },

  /* ---------- modais ---------- */
  modal(html) {
    const bg = document.getElementById('modal-bg');
    document.getElementById('modal').innerHTML = `<div class="modal-puxador"></div>` + html;
    bg.classList.add('on');
  },

  fecharModal() { document.getElementById('modal-bg').classList.remove('on'); },

  /* ---------- troca de alimento ---------- */
  abrirTroca(idx) {
    const lista = Store.alimentosTrocaveis();
    const a = lista[idx];
    if (!a) return;
    const atual = Store.trocaDe(a.nome);

    this.modal(`
      <h3 class="display">${a.nome}</h3>
      <p class="m-sub">Escolha o que você prefere comer no lugar. A escolha vale para o cardápio e para a lista de compras.</p>

      <div class="troca-lista">
        <button class="troca-op ${atual === null ? 'on' : ''}" onclick="App.escolherTroca(${idx}, null)">
          <span class="to-check">${atual === null ? '✓' : ''}</span>
          <span class="to-txt">
            <b>${a.nome}</b>
            <small>${/vontade|se quiser/i.test(a.un) ? a.un : a.g + 'g · ' + a.un} · opção original</small>
          </span>
        </button>

        ${a.alt.map((op, i) => `
          <button class="troca-op ${atual === i ? 'on' : ''}" onclick="App.escolherTroca(${idx}, ${i})">
            <span class="to-check">${atual === i ? '✓' : ''}</span>
            <span class="to-txt"><b>${op}</b></span>
          </button>`).join('')}
      </div>

      <p class="troca-nota">As opções foram montadas como porções equivalentes, então as calorias e a proteína do dia continuam as mesmas.</p>
      <button class="btn sec" style="margin-top:14px" onclick="App.fecharModal()">Fechar</button>
    `);
  },

  escolherTroca(idx, opcao) {
    const a = Store.alimentosTrocaveis()[idx];
    if (!a) return;
    Store.definirTroca(a.nome, opcao);
    Backend.agendarSync();
    this.fecharModal();
    this.render();
    this.toast(opcao === null ? `Voltou para ${a.nome}` : `Trocado por ${a.alt[opcao]}`, true);
  },

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
    if (this.checarNivel()) return;
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
    if (this.checarNivel()) return;
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

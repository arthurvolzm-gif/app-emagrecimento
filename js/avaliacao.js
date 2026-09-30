/* =========================================================
   AVALIAÇÃO DO APP

   Uma pesquisa curta, em passos, na mesma camada das boas-vindas:
     0. convite: "Quer participar da avaliação pra melhorarmos o app?"
     1. como conheceu o app
     2. através de quem
     3. o que fez baixar (mais de uma resposta)
     4. sugestão para melhorar (só texto)
     5. de 0 a 10, a chance de indicar pra um amigo
   Nota acima de 7 termina na oferta do Plano Duo: é quem já indicaria o
   app, e o Duo é exatamente "trazer alguém junto".

   Quando aparece: a partir do 3º dia de uso, na Início, uma vez por
   abertura do app. "Agora não" adia 7 dias; depois de três recusas não
   pergunta mais sozinha. Dá pra responder quando quiser pelo Perfil.
   O andamento fica no perfil (viaja na nuvem): perfil.avaliacao =
   { status: 'respondida' | 'adiada', vezes, ultima }.
   ========================================================= */
const Avaliacao = {
  DIAS_ATE_PERGUNTAR: 3,
  ADIAR_DIAS: 7,
  MAX_RECUSAS: 3,

  ORIGENS: ['Instagram', 'TikTok', 'YouTube', 'Anúncio', 'Google', 'Indicação de alguém', 'Outro'],
  QUEM: ['Um influenciador', 'Amigo ou familiar', 'Nutricionista ou personal', 'Ninguém, achei sozinho', 'Outro'],
  MOTIVOS: ['Emagrecer', 'Ganhar massa', 'Ter uma dieta montada', 'Ter um treino organizado', 'Acompanhar meu progresso',
            'Lembretes de refeição, água e treino', 'O preço', 'A indicação de alguém', 'Outro'],

  passo: 0,
  r: null,          // respostas em andamento

  _estado() {
    const p = Store.db && Store.db.perfil;
    return (p && p.avaliacao) || {};
  },

  _gravarEstado(e) {
    Store.db.perfil.avaliacao = Object.assign({}, this._estado(), e);
    Store.save();
    Backend.agendarSync();
  },

  /* pode perguntar sozinha agora? */
  pendente() {
    const p = Store.db && Store.db.perfil;
    if (!p || !p.criado_em) return false;
    const dias = Math.round((Date.now() - Store.deIso(p.criado_em).getTime()) / 86400000);
    if (dias < this.DIAS_ATE_PERGUNTAR) return false;
    const e = this._estado();
    if (e.status === 'respondida') return false;
    if ((e.vezes || 0) >= this.MAX_RECUSAS) return false;
    if (e.ultima && (Date.now() - new Date(e.ultima).getTime()) < this.ADIAR_DIAS * 86400000) return false;
    return true;
  },

  /* chamada no fim da abertura do app: só na Início, sem outra camada,
     modal ou comemoração na frente */
  talvezPerguntar() {
    if (App.tela !== 'inicio' || App.camada) return;
    if (Store.boasVindasPendente && Store.boasVindasPendente()) return;
    const modal = document.getElementById('modal-bg');
    if (modal && modal.classList.contains('on')) return;
    if (!this.pendente()) return;
    this.abrir();
  },

  abrir() {
    this.passo = 0;
    this.r = { origem: '', origem_outro: '', indicado_por: '', indicado_nome: '', motivos: [], motivo_outro: '', sugestao: '', nps: null };
    this._pintar();
  },

  /* a partir do Perfil: pula o convite, ela já disse que quer */
  abrirDireto() {
    this.abrir();
    this.passo = 1;
    this._pintar();
  },

  _pintar() {
    /* a caixa entra animada só na primeira vez; nos passos seguintes ela
       fica parada e só o conteúdo troca, senão piscaria a cada toque */
    this._seguindo = !!App.camada;
    const html = this['_passo' + this.passo]();
    if (App.camada) {
      const bg = document.getElementById('bv-bg');
      if (bg) bg.innerHTML = html;
    } else {
      App.abrirCamada(html);
    }
  },

  _caixa(corpo, rodape) {
    const total = 5;
    return `
      <div class="bv-caixa av-caixa ${this._seguindo ? 'av-segue' : ''}" role="dialog" aria-modal="true">
        ${this.passo > 0 ? `
          <div class="av-passos">${Array.from({ length: total }, (_, i) => `<i class="${i < this.passo ? 'on' : ''}"></i>`).join('')}</div>` : ''}
        ${corpo}
        ${rodape || ''}
      </div>`;
  },

  _opcoes(lista, campo, multi) {
    return `
      <div class="av-ops">
        ${lista.map((o, i) => {
          const on = multi ? this.r[campo].includes(o) : this.r[campo] === o;
          return `<button class="rev-op ${on ? 'on' : ''}" onclick="Avaliacao.marcar('${campo}', ${i}, ${multi ? 'true' : 'false'})">${o}</button>`;
        }).join('')}
      </div>`;
  },

  _nav(podeSeguir, rotulo) {
    return `
      <button class="btn" ${podeSeguir ? '' : 'disabled'} onclick="Avaliacao.seguir()">${rotulo || 'Continuar'}</button>
      <button class="bib-depois" onclick="${this.passo > 1 ? 'Avaliacao.voltar()' : 'Avaliacao.adiar()'}">${this.passo > 1 ? 'Voltar' : 'Agora não'}</button>`;
  },

  /* 0: o convite */
  _passo0() {
    return this._caixa(`
      <div class="bv-marca">${Ic.chat(26)}</div>
      <h2 class="bv-tt display">Ajude a melhorar o Focus Fit</h2>
      <p class="bv-txt" style="text-align:center">Quer participar de uma avaliação rápida? São 5 perguntas, leva menos de um minuto, e o que você responder decide o que a gente melhora primeiro.</p>`, `
      <button class="btn" onclick="Avaliacao.seguir()">Quero participar</button>
      <button class="bib-depois" onclick="Avaliacao.adiar()">Agora não</button>`);
  },

  _passo1() {
    const outro = this.r.origem === 'Outro';
    return this._caixa(`
      <h2 class="bv-tt display av-tt">Como você conheceu o Focus Fit?</h2>
      ${this._opcoes(this.ORIGENS, 'origem')}
      ${outro ? `<input class="av-input" id="av-origem-outro" placeholder="Onde foi?" value="${this._esc(this.r.origem_outro)}" oninput="Avaliacao.r.origem_outro=this.value">` : ''}`,
      this._nav(!!this.r.origem));
  },

  _passo2() {
    const escreve = ['Um influenciador', 'Amigo ou familiar', 'Nutricionista ou personal', 'Outro'].includes(this.r.indicado_por);
    return this._caixa(`
      <h2 class="bv-tt display av-tt">Através de quem?</h2>
      ${this._opcoes(this.QUEM, 'indicado_por')}
      ${escreve ? `<input class="av-input" id="av-quem" placeholder="${this.r.indicado_por === 'Um influenciador' ? 'Qual influenciador? (o @ ou o nome)' : 'Quem foi? (opcional)'}"
                         value="${this._esc(this.r.indicado_nome)}" oninput="Avaliacao.r.indicado_nome=this.value">` : ''}`,
      this._nav(!!this.r.indicado_por));
  },

  _passo3() {
    const outro = this.r.motivos.includes('Outro');
    return this._caixa(`
      <h2 class="bv-tt display av-tt">O que fez você baixar o app?</h2>
      <p class="av-sub">Pode marcar mais de uma.</p>
      ${this._opcoes(this.MOTIVOS, 'motivos', true)}
      ${outro ? `<input class="av-input" id="av-motivo-outro" placeholder="Conta pra gente" value="${this._esc(this.r.motivo_outro)}" oninput="Avaliacao.r.motivo_outro=this.value">` : ''}`,
      this._nav(this.r.motivos.length > 0));
  },

  _passo4() {
    return this._caixa(`
      <h2 class="bv-tt display av-tt">O que você sugere para melhorar o app?</h2>
      <p class="av-sub">Escreva do seu jeito: o que falta, o que atrapalha, o que você gostaria de ver.</p>
      <textarea class="av-input av-texto" id="av-sugestao" maxlength="2000" placeholder="Sua sugestão"
                oninput="Avaliacao.r.sugestao=this.value">${this._esc(this.r.sugestao)}</textarea>`,
      this._nav(true));
  },

  _passo5() {
    return this._caixa(`
      <h2 class="bv-tt display av-tt">De 0 a 10, qual a chance de você indicar o Focus Fit para um amigo?</h2>
      <div class="av-nps">
        ${Array.from({ length: 11 }, (_, n) => `<button class="${this.r.nps === n ? 'on' : ''}" onclick="Avaliacao.nota(${n})">${n}</button>`).join('')}
      </div>
      <div class="av-nps-leg"><span>Nenhuma chance</span><span>Com certeza</span></div>`,
      this._nav(this.r.nps !== null, 'Enviar'));
  },

  /* fim: obrigado, e o Duo pra quem indicaria */
  _passo6() {
    const promotora = this.r.nps !== null && this.r.nps > 7;
    const d = App.duo;
    const temVaga = d && d.ok && Number(d.vagas || 1) >= 2 && !d.titular_email;
    const podeDuo = promotora && (CONFIG.CHECKOUT_URL_DUO || temVaga) && !(d && d.titular_email);
    return this._caixa(`
      <div class="bv-marca">${Ic.festa(26)}</div>
      <h2 class="bv-tt display">Obrigado!</h2>
      ${podeDuo ? `
        <p class="bv-txt" style="text-align:center">Que bom que você indicaria o Focus Fit. ${temVaga
          ? 'Você já tem uma vaga do Plano Duo: chame alguém pra usar com você.'
          : 'Com o <b>Plano Duo</b>, você chama alguém pra usar junto na mesma assinatura, com 50% de desconto na segunda vaga. Cada um com o próprio plano, as próprias metas e o próprio progresso.'}</p>` : `
        <p class="bv-txt" style="text-align:center">Sua resposta chegou. É com ela que a gente decide o que melhorar primeiro no app.</p>`}`,
      podeDuo ? `
        <button class="btn" onclick="Avaliacao.irDuo(${temVaga ? 'true' : 'false'})">${temVaga ? 'Chamar alguém agora' : 'Conhecer o Plano Duo'}</button>
        <button class="bib-depois" onclick="App.fecharCamada()">Agora não</button>` : `
        <button class="btn" onclick="App.fecharCamada()">Fechar</button>`);
  },

  _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); },

  marcar(campo, i, multi) {
    const lista = campo === 'origem' ? this.ORIGENS : campo === 'indicado_por' ? this.QUEM : this.MOTIVOS;
    const v = lista[i];
    if (multi) {
      const k = this.r[campo].indexOf(v);
      if (k >= 0) this.r[campo].splice(k, 1); else this.r[campo].push(v);
    } else {
      this.r[campo] = v;
    }
    this._pintar();
  },

  nota(n) { this.r.nps = n; this._pintar(); },

  seguir() {
    if (this.passo === 5) return this.enviar();
    this.passo++;
    this._pintar();
  },

  voltar() {
    if (this.passo > 1) this.passo--;
    this._pintar();
  },

  adiar() {
    const e = this._estado();
    this._gravarEstado({ status: 'adiada', vezes: (e.vezes || 0) + 1, ultima: new Date().toISOString() });
    App.fecharCamada();
  },

  async enviar() {
    const r = this.r;
    const btn = document.querySelector('.av-caixa .btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    let ok = false;
    if (Backend.ativo() && Backend.sb) {
      try {
        const { data, error } = await Backend.sb.rpc('salvar_avaliacao', {
          p_origem: r.origem, p_origem_outro: r.origem === 'Outro' ? r.origem_outro.trim() : '',
          p_indicado_por: r.indicado_por, p_indicado_nome: r.indicado_nome.trim(),
          p_motivos: r.motivos, p_motivo_outro: r.motivos.includes('Outro') ? r.motivo_outro.trim() : '',
          p_sugestao: r.sugestao.trim(), p_nps: r.nps
        });
        ok = !error && data === true;
        if (error) console.warn('Avaliação não enviada:', error.message);
      } catch (e) { console.warn('Avaliação não enviada:', e && e.message); }
    }
    if (!ok && Backend.ativo()) {
      if (btn) { btn.disabled = false; btn.textContent = 'Enviar'; }
      return App.toast('Não consegui enviar agora. Confira a internet e toque em Enviar de novo.');
    }
    this._gravarEstado({ status: 'respondida', ultima: new Date().toISOString(), nps: r.nps });
    this.passo = 6;
    this._pintar();
  },

  irDuo(temVaga) {
    App.fecharCamada();
    setTimeout(() => temVaga ? App.irConvidarDuo() : App.abrirDuo(), 320);
  }
};

window.Avaliacao = Avaliacao;

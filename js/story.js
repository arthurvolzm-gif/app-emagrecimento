/* =========================================================
   IMAGEM DO TREINO PROS STORIES
   Desenha o resumo do treino concluído num canvas 1080×1920 (o tamanho
   dos stories do Instagram) e devolve um PNG. A tela de resumo mostra
   essa mesma imagem, então o que ela vê é o que vai ser postado.

   O conteúdo fica entre ~200 e ~1750 px de altura: o Instagram cobre o
   topo (foto e barra de progresso) e o rodapé (campo de resposta).
   ========================================================= */
const Story = {
  L: 1080,
  A: 1920,
  MENTA: '#00D7A2',
  CINZA: '#9DB2A7',

  async gerar(r) {
    const c = document.createElement('canvas');
    c.width = this.L;
    c.height = this.A;
    const g = c.getContext('2d');
    await this._fontes();
    const logo = await this._imagem('logo-focusfit.png');

    this._fundo(g);
    let y = 180;

    /* logo: o PNG tem sobra transparente em volta; recorta só a marca */
    if (logo) {
      const sx = 190, sy = 95, sw = 1060, sh = 320;
      const w = 400, h = Math.round(w * sh / sw);
      g.drawImage(logo, sx, sy, sw, sh, (this.L - w) / 2, y, w, h);
      y += h + 46;
    } else {
      this._texto(g, 'FOCUS FIT', this.L / 2, y + 80, '800 72px "Bricolage Grotesque", sans-serif', '#fff', 'center');
      y += 140;
    }

    y = this._selo(g, 'TREINO CONCLUÍDO', y);
    y = this._titulo(g, r.foco || 'Treino', y + 26);
    this._texto(g, this._data(r.data), this.L / 2, y + 44, '700 36px Manrope, sans-serif', this.CINZA, 'center');
    y += 86;

    const dur = r.minutos >= 60 ? `${Math.floor(r.minutos / 60)}h ${String(r.minutos % 60).padStart(2, '0')}` : `${r.minutos}`;
    const durUn = r.minutos >= 60 ? '' : 'min';
    y = this._grade(g, y, [
      { rot: r.duracaoEstimada ? 'DURAÇÃO (EST.)' : 'DURAÇÃO', val: dur, un: durUn },
      { rot: 'CALORIAS (EST.)', val: String(r.kcal), un: 'kcal' },
      { rot: 'EXERCÍCIOS', val: String(r.exercicios.length), un: '' },
      { rot: 'SÉRIES', val: String(r.series), un: '' }
    ]);

    if (r.cardio) {
      const t = (typeof CARDIO_TIPOS !== 'undefined' && CARDIO_TIPOS.find(x => x.id === r.cardio.tipo)) || { nome: 'Cardio' };
      const partes = [t.nome, r.cardio.minutos + ' min'];
      if (r.cardio.km) partes.push(String(r.cardio.km).replace('.', ',') + ' km');
      partes.push(r.cardio.kcal + ' kcal');
      const linha = 'Cardio: ' + partes.join(' · ');
      let tam = 34;
      do { g.font = `700 ${tam}px Manrope, sans-serif`; } while (g.measureText(linha).width > 940 && (tam -= 2) > 24);
      this._texto(g, linha, this.L / 2, y + 48, g.font, '#DDE8E2', 'center');
      y += 68;
    }

    /* O rodapé (sequência e dias ativos) tem lugar fixo. No meio entram
       músculos e recordes, no espaço que sobrar: garante uma linha de
       músculos, e os recordes (até 3) ficam com o resto. */
    const RODAPE = 1540;
    const fimMeio = RODAPE - 36;
    const prs = r.prs || [];
    const musc = r.musculos || [];
    const blocoMusc = 30 + 28 + 18 + 72;
    const livre = fimMeio - y - (musc.length ? blocoMusc : 0);
    const nPR = Math.max(0, Math.min(3, prs.length, Math.floor((livre - 66) / 104)));
    const blocoPR = nPR ? 66 + nPR * 104 : 0;

    if (musc.length && fimMeio - y >= blocoMusc) {
      y = this._rotulo(g, 'MÚSCULOS TREINADOS', y + 30);
      y = this._chips(g, musc, y + 18, fimMeio - blocoPR);
    }

    if (nPR) {
      y = this._rotulo(g, 'RECORDES DE HOJE', y + 36);
      y = this._recordes(g, prs.slice(0, nPR), y + 18);
    }

    this._rodape(g, r, RODAPE);
    this._texto(g, 'Treino feito com o Focus Fit', this.L / 2, 1790, '700 30px Manrope, sans-serif', '#6F8579', 'center');

    return new Promise((ok, erro) => c.toBlob(b => b ? ok(b) : erro(new Error('canvas vazio')), 'image/png'));
  },

  async _fontes() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load('800 96px "Bricolage Grotesque"'),
          document.fonts.load('700 36px Manrope'),
          document.fonts.load('800 36px Manrope')
        ]),
        new Promise(ok => setTimeout(ok, 2500))
      ]);
    } catch (e) { /* sem a fonte da marca, sai com a do sistema */ }
  },

  _imagem(src) {
    return new Promise(ok => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => ok(null);
      im.src = src;
    });
  },

  _fundo(g) {
    g.fillStyle = '#030605';
    g.fillRect(0, 0, this.L, this.A);
    const brilho = (x, y, raio, a) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, raio);
      gr.addColorStop(0, `rgba(0,215,162,${a})`);
      gr.addColorStop(1, 'rgba(0,215,162,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, this.L, this.A);
    };
    brilho(540, 330, 900, 0.22);
    brilho(540, 1900, 800, 0.10);
  },

  _texto(g, txt, x, y, fonte, cor, alinha) {
    g.font = fonte;
    g.fillStyle = cor;
    g.textAlign = alinha || 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(txt, x, y);
  },

  _espaco(g, px) {
    if ('letterSpacing' in g) g.letterSpacing = px + 'px';
  },

  _caixa(g, x, y, w, h, raio, fundo, borda, espessura) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, raio);
    else g.rect(x, y, w, h);
    if (fundo) { g.fillStyle = fundo; g.fill(); }
    if (borda) { g.strokeStyle = borda; g.lineWidth = espessura || 2; g.stroke(); }
  },

  _selo(g, txt, y) {
    g.font = '800 32px Manrope, sans-serif';
    this._espaco(g, 6);
    const w = g.measureText(txt).width + 70;
    this._caixa(g, (this.L - w) / 2, y, w, 70, 35, 'rgba(0,215,162,0.14)', this.MENTA, 2);
    this._texto(g, txt, this.L / 2, y + 47, '800 32px Manrope, sans-serif', this.MENTA, 'center');
    this._espaco(g, 0);
    return y + 70;
  },

  /* o foco do treino ("Peito e Tríceps"): diminui a fonte até caber em
     no máximo duas linhas */
  _titulo(g, txt, y) {
    const max = 920;
    for (let tam = 104; tam >= 60; tam -= 6) {
      g.font = `800 ${tam}px "Bricolage Grotesque", sans-serif`;
      const linhas = this._quebrar(g, txt, max);
      if (linhas.length <= 2) {
        linhas.forEach((l, k) => this._texto(g, l, this.L / 2, y + tam + k * (tam * 1.05), g.font, '#FFFFFF', 'center'));
        return y + tam + (linhas.length - 1) * tam * 1.05 + 10;
      }
    }
    this._texto(g, txt, this.L / 2, y + 60, g.font, '#FFFFFF', 'center');
    return y + 70;
  },

  _quebrar(g, txt, max) {
    const palavras = String(txt).split(' ');
    const linhas = [];
    let atual = '';
    palavras.forEach(p => {
      const teste = atual ? atual + ' ' + p : p;
      if (g.measureText(teste).width <= max || !atual) atual = teste;
      else { linhas.push(atual); atual = p; }
    });
    if (atual) linhas.push(atual);
    return linhas;
  },

  _grade(g, y, itens) {
    const w = 450, h = 176, gap = 18, x0 = (this.L - (w * 2 + gap)) / 2;
    itens.forEach((it, k) => {
      const x = x0 + (k % 2) * (w + gap);
      const yy = y + Math.floor(k / 2) * (h + gap);
      this._caixa(g, x, yy, w, h, 36, 'rgba(11,18,15,0.92)', 'rgba(0,215,162,0.34)', 2);
      g.font = '800 26px Manrope, sans-serif';
      this._espaco(g, 3);
      this._texto(g, it.rot, x + 40, yy + 52, g.font, this.CINZA);
      this._espaco(g, 0);
      g.font = '800 96px "Bricolage Grotesque", sans-serif';
      this._texto(g, it.val, x + 38, yy + 142, g.font, '#FFFFFF');
      if (it.un) {
        const larg = g.measureText(it.val).width;
        this._texto(g, it.un, x + 38 + larg + 12, yy + 142, '800 38px Manrope, sans-serif', this.MENTA);
      }
    });
    return y + h * 2 + gap;
  },

  _rotulo(g, txt, y) {
    g.font = '800 28px Manrope, sans-serif';
    this._espaco(g, 5);
    this._texto(g, txt, this.L / 2, y + 28, g.font, this.MENTA, 'center');
    this._espaco(g, 0);
    return y + 28;
  },

  /* músculos em pílulas, centralizadas, quebrando linha; o que não
     couber até `limite` fica de fora */
  _chips(g, lista, y, limite) {
    g.font = '700 34px Manrope, sans-serif';
    const h = 72, gap = 16, max = 960;
    const linhas = [[]];
    let larg = 0;
    lista.forEach(m => {
      const w = g.measureText(m).width + 56;
      if (larg + w > max && linhas[linhas.length - 1].length) { linhas.push([]); larg = 0; }
      linhas[linhas.length - 1].push({ m, w });
      larg += w + gap;
    });
    let yy = y;
    for (const linha of linhas) {
      if (yy + h > limite) break;
      const total = linha.reduce((s, c) => s + c.w, 0) + gap * (linha.length - 1);
      let x = (this.L - total) / 2;
      linha.forEach(c => {
        this._caixa(g, x, yy, c.w, h, 36, 'rgba(0,215,162,0.10)', 'rgba(0,215,162,0.5)', 2);
        this._texto(g, c.m, x + c.w / 2, yy + 47, '700 34px Manrope, sans-serif', '#FFFFFF', 'center');
        x += c.w + gap;
      });
      yy += h + gap;
    }
    return yy - gap;
  },

  _recordes(g, prs, y) {
    const w = 920, h = 88, x = (this.L - w) / 2;
    prs.forEach((p, k) => {
      const yy = y + k * (h + 16);
      this._caixa(g, x, yy, w, h, 28, 'rgba(11,18,15,0.92)', 'rgba(0,215,162,0.34)', 2);
      g.font = '700 34px Manrope, sans-serif';
      let nome = p.nome;
      while (g.measureText(nome).width > 520 && nome.length > 4) nome = nome.slice(0, -2);
      if (nome !== p.nome) nome = nome.trim() + '…';
      this._texto(g, nome, x + 34, yy + 57, g.font, '#FFFFFF');
      const val = p.peso + ' kg';
      this._texto(g, val, x + w - 34, yy + 60, '800 46px "Bricolage Grotesque", sans-serif', this.MENTA, 'right');
      g.font = '800 46px "Bricolage Grotesque", sans-serif';
      const lv = g.measureText(val).width;
      this._texto(g, 'antes ' + p.antes + ' kg', x + w - 34 - lv - 18, yy + 56, '700 26px Manrope, sans-serif', this.CINZA, 'right');
    });
    return y + prs.length * (h + 16) - 16;
  },

  /* Rodapé: o fogo da sequência (número de dias seguidos dentro, cor
     pelo marco da sequência) e, ao lado, só os dias ativos no app. */
  _rodape(g, r, y) {
    const seq = r.sequencia || 1;
    const ativos = r.diasAtivos || 1;
    const cores = this._corFogo(seq);
    const w = 920, h = 190, x = (this.L - w) / 2;
    this._caixa(g, x, y, w, h, 40, 'rgba(11,18,15,0.92)', cores[0] + '88', 2);

    const fw = 132, fh = 168;
    this._fogo(g, x + 50, y + (h - fh) / 2 + 4, fw, fh, cores, String(seq));

    const tx = x + 50 + fw + 44;
    g.font = '800 104px "Bricolage Grotesque", sans-serif';
    this._texto(g, String(ativos), tx, y + 112, g.font, '#FFFFFF');
    this._texto(g, ativos === 1 ? 'dia ativo no app' : 'dias ativos no app', tx, y + 158, '700 34px Manrope, sans-serif', '#DDE8E2');
  },

  _corFogo(seq) {
    let c = STREAK_CORES[0];
    for (const faixa of STREAK_CORES) if (seq >= faixa[0]) c = faixa;
    return [c[1], c[2]];
  },

  /* o fogo, desenhado em vetor (emoji no canvas muda de aparelho pra
     aparelho): chama externa em degradê, miolo claro, número dentro */
  _fogo(g, x, y, w, h, cores, num) {
    const externo = new Path2D('M52 2C58 24 80 36 88 60C98 90 86 122 50 128C14 122 2 92 12 64C18 48 30 40 34 22C42 34 44 42 44 50C50 38 56 22 52 2Z');
    const miolo = new Path2D('M50 58C56 70 70 78 72 94C74 112 64 122 50 122C36 122 26 112 28 96C29 86 36 80 40 70C44 76 46 80 46 84C50 76 52 68 50 58Z');
    g.save();
    g.translate(x, y);
    g.scale(w / 100, h / 130);
    g.shadowColor = cores[0];
    g.shadowBlur = 28;
    const gr = g.createLinearGradient(0, 0, 0, 130);
    gr.addColorStop(0, cores[1]);
    gr.addColorStop(0.55, cores[0]);
    gr.addColorStop(1, cores[0]);
    g.fillStyle = gr;
    g.fill(externo);
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fill(miolo);
    g.restore();

    const tam = num.length >= 3 ? 50 : 62;
    g.font = `800 ${tam}px "Bricolage Grotesque", sans-serif`;
    g.fillStyle = '#FFFFFF';
    g.textAlign = 'center';
    g.shadowColor = 'rgba(0,0,0,0.45)';
    g.shadowBlur = 8;
    g.fillText(num, x + w / 2, y + h * 0.80);
    g.shadowBlur = 0;
  },

  _data(iso) {
    try {
      const t = new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
      return t.charAt(0).toUpperCase() + t.slice(1);
    } catch (e) { return iso; }
  }
};

window.Story = Story;

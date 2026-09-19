/* =========================================================
   VÍDEOS DE EXECUÇÃO DOS EXERCÍCIOS

   ── COMO ADICIONAR UM VÍDEO ──────────────────────────────
   1. Grave o exercício (15 a 30 segundos bastam: dois ou três
      movimentos completos, de lado e de frente).
   2. Suba no YouTube como **Não listado**. Não listado não aparece
      na busca nem no seu canal, mas abre pra quem tem o link — que é
      exatamente o que o app precisa. (Privado NÃO funciona: nem
      embutido o app consegue tocar.)
   3. Cole o link aqui embaixo, na linha do exercício.

   Pode colar o link inteiro (`https://youtu.be/abc123`,
   `https://www.youtube.com/watch?v=abc123`), só o id (`abc123`), um
   link do Vimeo, ou o endereço de um `.mp4` seu. A função `Video.de()`
   entende todos.

   O nome tem que ser IGUAL ao da biblioteca em `js/data.js` — é por
   ele que o app acha o vídeo. Exercício sem vídeo aqui simplesmente
   não mostra o botão: nada quebra, e a pessoa não vê buraco.

   ── POR QUE YOUTUBE NÃO LISTADO ──────────────────────────
   Custo zero de hospedagem e de banda, toca em qualquer aparelho e o
   vídeo já chega no tamanho certo pra conexão de cada uma. Guardar no
   Supabase Storage é possível, mas você paga a banda de cada pessoa
   que assiste, e todo mundo baixa o arquivo cheio. Pra 60 exercícios
   vistos várias vezes por dia, a conta cresce rápido.
   ========================================================= */

const VIDEOS = {
  /* Exemplo (descomente e troque pelo seu):
  'Agachamento livre': 'https://youtu.be/SEU_ID_AQUI',
  'Supino reto com barra': 'SEU_ID_AQUI',
  */
};

const Video = {
  /* devolve { tipo, src } pronto pro player, ou null se não houver */
  de(nomeExercicio) {
    const bruto = (VIDEOS[nomeExercicio] || '').trim();
    if (!bruto) return null;

    /* mp4/webm direto: toca no <video> nativo, sem iframe */
    if (/\.(mp4|webm|mov)(\?|$)/i.test(bruto)) {
      return { tipo: 'arquivo', src: bruto };
    }

    const vimeo = bruto.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    if (vimeo) {
      return { tipo: 'iframe', src: 'https://player.vimeo.com/video/' + vimeo[1] };
    }

    /* youtube: aceita link completo, encurtado, /embed/ ou só o id.
       O domínio -nocookie não grava nada de quem só assistiu. */
    const yt = bruto.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{6,})/);
    const id = yt ? yt[1] : (/^[A-Za-z0-9_-]{6,}$/.test(bruto) ? bruto : null);
    if (id) {
      return {
        tipo: 'iframe',
        src: 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&modestbranding=1&playsinline=1'
      };
    }
    return null;
  },

  /* Tem vídeo E a pessoa pode ver? O acesso é o order bump da compra
     (ver App.temVideos). A tranca de verdade é o banco; isto aqui só
     decide se o botão aparece. */
  tem(nomeExercicio) {
    if (!this.de(nomeExercicio)) return false;
    return typeof App === 'undefined' || typeof App.temVideos !== 'function' || App.temVideos();
  },

  /* só o vídeo existe, ignorando o acesso */
  existe(nomeExercicio) { return !!this.de(nomeExercicio); },

  /* Quantos exercícios da biblioteca já têm vídeo. Usado só pra te
     dar o número enquanto você grava; não aparece pra quem usa. */
  cobertura() {
    const total = typeof BIBLIOTECA !== 'undefined' ? BIBLIOTECA.length : 0;
    /* existe(), não tem(): a cobertura é quanto VOCÊ já gravou, e não
       muda conforme o acesso de quem está olhando */
    const com = typeof BIBLIOTECA !== 'undefined'
      ? BIBLIOTECA.filter(e => Video.existe(e.nome)).length : 0;
    return { com, total, pct: total ? Math.round(com / total * 100) : 0 };
  },

  /* o player. Carrega só quando a pessoa toca, nunca junto com a
     lista: são dezenas de exercícios por tela, e um iframe em cada um
     derrubaria o desempenho e gastaria os dados dela à toa. */
  html(nomeExercicio) {
    const v = this.de(nomeExercicio);
    if (!v) return '';
    if (v.tipo === 'arquivo') {
      return `<video class="video-quadro" src="${v.src}" controls playsinline preload="metadata"></video>`;
    }
    return `<div class="video-caixa"><iframe src="${v.src}" title="Execução: ${nomeExercicio}"
      frameborder="0" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
      referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe></div>`;
  }
};

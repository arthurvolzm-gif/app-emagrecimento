/* =========================================================
   ÍCONES
   Desenhados em SVG de traço, no lugar dos emojis, pra bater com as telas
   de referência: monocromáticos, herdando a cor de quem os contém
   (currentColor), então o mesmo ícone serve aceso em verde na navegação e
   apagado em cinza fora dela.
   Emoji colorido continua onde a referência usa emoji de verdade: os
   níveis (🌱 🏅 👑) e os quadros de estatística do Progresso.
   ========================================================= */
const Ic = {
  _svg(corpo, tam) {
    return `<svg viewBox="0 0 24 24" width="${tam || 22}" height="${tam || 22}" fill="none"
      stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">${corpo}</svg>`;
  },

  /* ---------- navegação ---------- */
  casa: t => Ic._svg('<path d="M3 10.4 12 3l9 7.4V20a1 1 0 0 1-1 1h-4.6v-6.2H8.6V21H4a1 1 0 0 1-1-1z"/>', t),
  halter: t => Ic._svg('<path d="M6.6 7.2v9.6M17.4 7.2v9.6M3.4 9.8v4.4M20.6 9.8v4.4M6.6 12h10.8"/>', t),
  talher: t => Ic._svg('<path d="M6 3v6a2.2 2.2 0 0 0 2.2 2.2H8.6V21M6 3v5.2M9.2 3v5.2M17.6 3c-1.4 1.9-2.1 3.8-2.1 5.8 0 1.6.7 2.7 2.1 3V21"/>', t),
  barras: t => Ic._svg('<path d="M5.5 20.5V14M12 20.5V5.5M18.5 20.5v-9.6"/>', t),
  pessoa: t => Ic._svg('<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>', t),

  /* ---------- títulos de cartão e listas ---------- */
  alvo: t => Ic._svg('<circle cx="12" cy="12" r="7.2"/><circle cx="12" cy="12" r="2.6"/><path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3"/>', t),
  calendario: t => Ic._svg('<rect x="3.2" y="5" width="17.6" height="16" rx="2.6"/><path d="M3.2 10h17.6M8.2 3v4M15.8 3v4"/>', t),
  gota: t => Ic._svg('<path d="M12 3.2c3.6 3.7 5.8 6.6 5.8 9.4a5.8 5.8 0 0 1-11.6 0c0-2.8 2.2-5.7 5.8-9.4z"/>', t),
  lua: t => Ic._svg('<path d="M20.2 14.6A8.6 8.6 0 1 1 9.4 3.8a6.9 6.9 0 0 0 10.8 10.8z"/>', t),
  livro: t => Ic._svg('<path d="M4.2 5.4A2.4 2.4 0 0 1 6.6 3H19.8v15.4H6.6a2.4 2.4 0 0 0-2.4 2.4z"/><path d="M19.8 18.4H6.6"/>', t),
  sino: t => Ic._svg('<path d="M18 15.6V10a6 6 0 1 0-12 0v5.6L4.2 18.6h15.6zM9.8 21.4h4.4"/>', t),
  balanca: t => Ic._svg('<path d="M12 3.4v17.2M7.4 20.6h9.2M4.4 8h15.2M4.4 8 2 13.6a2.9 2.9 0 0 0 4.8 0zM19.6 8 22 13.6a2.9 2.9 0 0 1-4.8 0z"/>', t),
  camera: t => Ic._svg('<path d="M3.2 8.6A2.4 2.4 0 0 1 5.6 6.2h1.9l1.4-2.2h6.2l1.4 2.2h1.9a2.4 2.4 0 0 1 2.4 2.4v9.4a2.4 2.4 0 0 1-2.4 2.4H5.6a2.4 2.4 0 0 1-2.4-2.4z"/><circle cx="12" cy="13" r="3.8"/>', t),
  chat: t => Ic._svg('<path d="M21 11.6a7.9 7.9 0 0 1-8 7.9H4.4l2.5-2.9A7.9 7.9 0 1 1 21 11.6z"/>', t),
  bussola: t => Ic._svg('<circle cx="12" cy="12" r="8.8"/><path d="m15.4 8.6-2 4.8-4.8 2 2-4.8z"/>', t),
  prancheta: t => Ic._svg('<rect x="5" y="4.2" width="14" height="17" rx="2.4"/><path d="M9 4.2V3a1.4 1.4 0 0 1 1.4-1.4h3.2A1.4 1.4 0 0 1 15 3v1.2M9 10h6M9 14.4h6"/>', t),
  fogo: t => Ic._svg('<path d="M12 2.6c2.9 4 4.8 5.7 4.8 9.2a4.8 4.8 0 0 1-9.6 0c0-1.7.8-2.8 1.7-3.7.5 1.4 1 1.9 1.8 1.9 0-2.8 1.3-5 1.3-7.4z"/>', t),
  festa: t => Ic._svg('<path d="M3.4 20.6 8 9.4l6.6 6.6z"/><path d="M14.4 3.2v2M20.4 6.2l-1.6 1.2M21 12.6h-2M16.6 4.8l1.2 1.2"/>', t),
  carne: t => Ic._svg('<path d="M4.6 14.4a6.4 6.4 0 0 1 9-9 6.4 6.4 0 0 0 5.8 5.8 6.4 6.4 0 0 1-9 9 6.4 6.4 0 0 0-5.8-5.8z"/><circle cx="9.6" cy="14.4" r="2.2"/>', t),
  corrida: t => Ic._svg('<circle cx="15.4" cy="4.6" r="2"/><path d="m8 21 2.6-5.4-2.4-2.6.9-4.6 3.5-1.2 2.6 3.2 3.2 1M8.4 12.6 4.6 13M13 15.6l3 2 .9 3.4"/>', t),
  cama: t => Ic._svg('<path d="M3 19v-9M3 13h18a0 0 0 0 1 0 0v6M3 19h18M7.4 13V9.8h6.2V13"/>', t),
  check: t => Ic._svg('<circle cx="12" cy="12" r="8.8"/><path d="m8.2 12.2 2.6 2.6 5-5.4"/>', t),
  seta: t => Ic._svg('<path d="m9 5 7 7-7 7"/>', t),
  lapis: t => Ic._svg('<path d="M4 20.2h4l10.4-10.4a2.6 2.6 0 0 0-3.7-3.7L4.4 16.5z"/><path d="m14.6 7.2 3.7 3.7"/>', t),
  visto: t => Ic._svg('<path d="m5.5 12.4 4.4 4.4 8.6-9.2"/>', t),

  /* refeições — ver Ic.refeicao() logo abaixo */
  sol: t => Ic._svg('<circle cx="12" cy="12" r="4.4"/><path d="M12 1.8v2.6M12 19.6v2.6M4.8 4.8l1.9 1.9M17.3 17.3l1.9 1.9M1.8 12h2.6M19.6 12h2.6M4.8 19.2l1.9-1.9M17.3 6.7l1.9-1.9"/>', t),
  maca: t => Ic._svg('<path d="M12 7.4c-1-.9-2.2-1.4-3.5-1.4C5.9 6 4 8.4 4 11.8c0 3.9 2.8 8.4 5 8.4 1 0 1.9-.6 3-.6s2 .6 3 .6c2.2 0 5-4.5 5-8.4 0-3.4-1.9-5.8-4.5-5.8-1.3 0-2.5.5-3.5 1.4z"/><path d="M12 7.4V4.6M12 4.6c1.6 0 2.8-1 3-2.4-1.6-.2-2.8.8-3 2.4z"/>', t),
  raio: t => Ic._svg('<path d="M13.4 2.4 4.6 13.4h6.2l-.8 8.2 9-11h-6.4z"/>', t),
  copo: t => Ic._svg('<path d="M6.4 4.2h11.2l-1.2 15.4a2 2 0 0 1-2 1.8H9.6a2 2 0 0 1-2-1.8z"/><path d="M6.9 10.4h10.2"/>', t),

  /* o ícone de cada refeição sai do id, não do emoji: assim continua
     valendo se o nome ou o horário da refeição mudarem em data.js */
  refeicao(id, t) {
    const mapa = { cafe: Ic.sol, lanche1: Ic.maca, almoco: Ic.talher,
                   lanche2: Ic.raio, jantar: Ic.lua, ceia: Ic.copo };
    return (mapa[id] || Ic.talher)(t);
  }
};

window.Ic = Ic;

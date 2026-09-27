/* =========================================================
   FOTOS DE PROGRESSO
   Ficam SÓ no aparelho, em IndexedDB, e nunca saem dele: não entram na
   sincronização com o Supabase, não vão pro backup na nuvem e não são
   material de anúncio. É registro privado da pessoa.
   IndexedDB e não localStorage porque foto é binário e localStorage tem
   ~5 MB de teto compartilhado com o resto do app.
   ========================================================= */
const Fotos = {
  BANCO: 'focusfit_fotos',
  /* v1 guardava na loja 'fotos' com a data como chave, então a segunda
     foto do dia apagava a primeira. v2 dá um id próprio a cada foto e
     copia as antigas pra cá na primeira abertura. */
  LOJA: 'fotos_v2',
  LOJA_V1: 'fotos',
  LARGURA_MAX: 900,          /* redimensiona antes de guardar */
  _db: null,

  disponivel() {
    try { return typeof indexedDB !== 'undefined'; } catch (e) { return false; }
  },

  abrir() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((ok, erro) => {
      const req = indexedDB.open(this.BANCO, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        const nova = db.objectStoreNames.contains(this.LOJA)
          ? req.transaction.objectStore(this.LOJA)
          : db.createObjectStore(this.LOJA, { keyPath: 'id', autoIncrement: true });
        if (db.objectStoreNames.contains(this.LOJA_V1)) {
          const velhas = req.transaction.objectStore(this.LOJA_V1).getAll();
          velhas.onsuccess = () => {
            (velhas.result || []).forEach(f => {
              nova.add({ data: f.data, blob: f.blob, peso: f.peso || null, em: f.em || Store.deIso(f.data).getTime() });
            });
            db.deleteObjectStore(this.LOJA_V1);
          };
        }
      };
      req.onsuccess = () => { this._db = req.result; ok(this._db); };
      req.onerror = () => erro(req.error);
    });
  },

  async _tx(modo) {
    const db = await this.abrir();
    return db.transaction(this.LOJA, modo).objectStore(this.LOJA);
  },

  /* redimensiona e comprime: foto de celular tem 4 MB, aqui vira ~120 KB */
  encolher(arquivo) {
    return new Promise((ok, erro) => {
      const url = URL.createObjectURL(arquivo);
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, this.LARGURA_MAX / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * escala);
        c.height = Math.round(img.height * escala);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? ok(b) : erro(new Error('falhou ao comprimir')), 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); erro(new Error('arquivo não é imagem')); };
      img.src = url;
    });
  },

  async salvar(arquivo, peso) {
    const blob = await this.encolher(arquivo);
    const loja = await this._tx('readwrite');
    return new Promise((ok, erro) => {
      const req = loja.add({ data: Store.hoje(), blob, peso: peso || null, em: Date.now() });
      req.onsuccess = () => ok(true);
      req.onerror = () => erro(req.error);
    });
  },

  /* da mais antiga pra mais recente, pela hora em que foi tirada */
  async listar() {
    const loja = await this._tx('readonly');
    return new Promise((ok, erro) => {
      const req = loja.getAll();
      req.onsuccess = () => ok((req.result || []).sort((a, b) => (a.em || 0) - (b.em || 0)));
      req.onerror = () => erro(req.error);
    });
  },

  async apagar(id) {
    const loja = await this._tx('readwrite');
    return new Promise((ok, erro) => {
      const req = loja.delete(id);
      req.onsuccess = () => ok(true);
      req.onerror = () => erro(req.error);
    });
  }
};

window.Fotos = Fotos;

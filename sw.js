/* =========================================================
   SERVICE WORKER — Focus Fit

   Serve pra três coisas, nesta ordem de importância:

   1. O app abrir sem internet (ou com internet ruim) em vez de
      mostrar a tela de dinossauro do Chrome. A Play Store reprova
      app que mostra erro de navegador quando está offline, então
      isto deixou de ser enfeite e virou requisito.
   2. Abrir rápido na segunda vez: o CSS, o JS e as imagens saem do
      aparelho, não da rede.
   3. Ser a base pra notificação com o app fechado no Android, que
      hoje não existe (ver o bloco PUSH lá embaixo).

   ESTRATÉGIA: rede primeiro, cache como rede reserva.
   É de propósito. Com "cache primeiro" o app editado na Vercel
   demoraria horas ou dias pra chegar em quem já instalou — e a gente
   edita esse app toda semana. Com "rede primeiro", quem está online
   sempre vê a última versão, e quem está offline vê a última que
   funcionou. Imagem e fonte são a exceção: essas saem do cache
   direto, porque não mudam e são o que mais pesa.

   ⚠️ Ao publicar uma versão nova, troque o número de VERSAO. É ele
   que apaga o cache velho — sem trocar, sobra lixo da versão
   anterior no aparelho das pessoas.
   ========================================================= */

const VERSAO = 'focusfit-v3';
const CACHE_APP   = VERSAO + '-app';
const CACHE_MIDIA = VERSAO + '-midia';

/* o mínimo pro app abrir offline: sem isso a tela fica em branco */
const CASCA = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './config.js',
  './js/icones.js',
  './js/data.js',
  './js/videos.js',
  './js/store.js',
  './js/backend.js',
  './js/fotos.js',
  './js/lembretes.js',
  './js/notificacoes.js',
  './js/screens.js',
  './js/onboarding.js',
  './js/app.js',
  './logo-focusfit.png',
  './icone-192.png',
  './icone-512.png'
];

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(CACHE_APP)
      /* um addAll falha inteiro se UM arquivo falhar, e aí a instalação
         toda morre. Como a casca é o que garante o offline, vale mais
         instalar com um arquivo faltando do que não instalar. */
      .then(cache => Promise.all(CASCA.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(
        nomes.filter(n => !n.startsWith(VERSAO)).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

/* nunca passar perto disto: login, dados da pessoa e pagamento não
   podem sair de cache velho nem ficar guardados no aparelho */
function ehDadoVivo(url) {
  return url.hostname.endsWith('.supabase.co')
      || url.hostname.endsWith('.supabase.in')
      || url.hostname.includes('zuptos')
      || url.pathname.includes('/auth/');
}

function ehMidia(url) {
  return /\.(png|jpe?g|svg|gif|webp|woff2?|ttf)$/i.test(url.pathname)
      || url.hostname.includes('fonts.gstatic.com');
}

self.addEventListener('fetch', evento => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (ehDadoVivo(url)) return;                 /* deixa passar direto pra rede */

  /* imagem e fonte: cache primeiro, e atualiza em segundo plano */
  if (ehMidia(url)) {
    evento.respondWith(
      caches.match(req).then(guardado => {
        const daRede = fetch(req).then(resp => {
          if (resp && resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE_MIDIA).then(c => c.put(req, copia));
          }
          return resp;
        }).catch(() => guardado);
        return guardado || daRede;
      })
    );
    return;
  }

  /* resto (html, css, js): rede primeiro */
  evento.respondWith(
    fetch(req)
      .then(resp => {
        if (resp && resp.ok && url.origin === location.origin) {
          const copia = resp.clone();
          caches.open(CACHE_APP).then(c => c.put(req, copia));
        }
        return resp;
      })
      .catch(() =>
        caches.match(req).then(guardado =>
          /* navegação que falhou e não está no cache: devolve a casca do
             app, que é uma página de verdade em vez do erro do navegador */
          guardado || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)
        )
      )
  );
});

/* ---------- PUSH (ainda não ligado) ----------
   O aparelho só recebe aviso com o app fechado se existir um servidor
   mandando push com chave VAPID. Enquanto esse servidor não existir,
   js/lembretes.js continua avisando só com o app aberto. O listener
   fica aqui pronto: no dia que o servidor subir, é só ele começar a
   mandar e o aviso aparece, sem mexer em mais nada.                */
self.addEventListener('push', evento => {
  let dados = { titulo: 'Focus Fit', texto: 'Você tem algo pra registrar hoje.' };
  try { if (evento.data) dados = Object.assign(dados, evento.data.json()); } catch (e) {}
  evento.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.texto,
      icon: './icone-192.png',
      badge: './icone-192.png',
      lang: 'pt-BR'
    })
  );
});

self.addEventListener('notificationclick', evento => {
  evento.notification.close();
  evento.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(abertas => {
      for (const janela of abertas) {
        if ('focus' in janela) return janela.focus();
      }
      return clients.openWindow('./');
    })
  );
});

/* Le carnet doit fonctionner sans réseau : la salle paroissiale ne capte pas toujours. */
const CACHE = "csm-v1";
const COQUILLE = [
  "./",
  "index.html",
  "app.css",
  "cr.css",
  "app.js",
  "manifest.webmanifest",
  "assets/emblem.png",
  "assets/saint-mommolin.jpg",
  "assets/icon-192.png",
  "assets/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(COQUILLE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(l => Promise.all(l.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const memeOrigine = new URL(req.url).origin === self.location.origin;

  if (memeOrigine) {
    /* réseau d'abord pour rester à jour, cache en secours */
    e.respondWith(
      fetch(req)
        .then(rep => {
          const copie = rep.clone();
          caches.open(CACHE).then(c => c.put(req, copie));
          return rep;
        })
        .catch(() => caches.match(req).then(r => r || caches.match("index.html")))
    );
    return;
  }

  /* polices Google : cache d'abord, elles ne changent pas */
  e.respondWith(
    caches.match(req).then(r => r || fetch(req).then(rep => {
      if (rep.ok || rep.type === "opaque") {
        const copie = rep.clone();
        caches.open(CACHE).then(c => c.put(req, copie));
      }
      return rep;
    }).catch(() => r))
  );
});

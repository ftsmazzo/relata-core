const CACHE = "relata-shell-v1";
const SHELL = ["/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Navegação (HTML) e o próprio bundle JS/CSS: sempre tenta a rede primeiro.
// Cache-first pra esses arquivos deixava a aba presa numa versão antiga do
// app depois de cada deploy (o HTML antigo referenciava um JS com hash que
// não existia mais, quebrando a página até um hard refresh).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/api/")) return;

  const isNavigation = event.request.mode === "navigate";
  const isBuiltAsset = event.request.url.includes("/assets/");

  if (isNavigation || isBuiltAsset) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request)),
  );
});

/* Service worker de Sama Stock : garde la caisse hors ligne (/hors-ligne) et ses fichiers. */
const PRECACHE_PREFIX = "sama-offline-";
const OFFLINE_URL = "/hors-ligne";
const EXTRA = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

let precaching = null;
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "precache" && typeof data.version === "string") {
    precaching = precaching || precache(data.version).finally(() => (precaching = null));
    event.waitUntil(precaching);
  }
});

async function precache(version) {
  const name = PRECACHE_PREFIX + version;
  const existing = await caches.open(name);
  if (await existing.match(OFFLINE_URL)) return;

  const res = await fetch(OFFLINE_URL, { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) return;
  const html = await res.clone().text();
  const assets = new Set(EXTRA);
  for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) assets.add(m[0]);

  const cache = await caches.open(name);
  const styles = [];
  await Promise.all(
    [...assets].map(async (url) => {
      try {
        const r = await fetch(url);
        if (!r.ok) return;
        if (url.includes(".css")) styles.push(await r.clone().text());
        await cache.put(url, r);
      } catch {}
    }),
  );
  // Polices et images citées par les feuilles de style
  const more = new Set();
  for (const css of styles) for (const m of css.matchAll(/\/_next\/static\/media\/[^"'\s)]+/g)) if (!assets.has(m[0])) more.add(m[0]);
  await Promise.all(
    [...more].map(async (url) => {
      try {
        const r = await fetch(url);
        if (r.ok) await cache.put(url, r);
      } catch {}
    }),
  );
  // La page en dernier : sa présence signifie que tout est prêt
  await cache.put(OFFLINE_URL, res);
  for (const key of await caches.keys()) if (key.startsWith(PRECACHE_PREFIX) && key !== name) await caches.delete(key);
}

async function offlinePage() {
  for (const key of await caches.keys()) {
    if (!key.startsWith(PRECACHE_PREFIX)) continue;
    const hit = await (await caches.open(key)).match(OFFLINE_URL);
    if (hit) return hit;
  }
  return null;
}

function notReady() {
  const html =
    '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>Pas d'internet · Sama Stock</title>" +
    '<body style="font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem;color:#0b1310;line-height:1.5">' +
    "<h1 style=\"font-size:1.25rem\">Pas d'internet</h1>" +
    "<p>Ouvrez Sama Stock une fois avec internet : le téléphone gardera alors une copie de la caisse pour vendre pendant les coupures.</p>" +
    "</body></html>";
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function navigate(request, url) {
  try {
    return await fetch(request);
  } catch {
    const page = await offlinePage();
    if (!page) return notReady();
    if (url.pathname === OFFLINE_URL) return page;
    const target = new URL(OFFLINE_URL, self.location.origin);
    target.searchParams.set("depuis", url.pathname);
    return Response.redirect(target.href, 302);
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(navigate(request, url));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || EXTRA.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
  }
});

/* Notifications (vente, commande, stock) envoyées par le serveur, même application fermée. */
const VIBRATIONS = {
  sale: [120, 60, 120],
  sale_cancel: [300, 120, 300],
  order: [200, 80, 200],
  stock_low: [300, 120, 300],
  stock_out: [400, 150, 400, 150, 400],
};

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) w.postMessage({ type: "sama-notification", notification: data });
      // Application ouverte devant la personne : elle joue son propre son et affiche le message elle-même
      if (windows.some((w) => w.visibilityState === "visible")) return;
      await self.registration.showNotification(data.title || "Sama Stock", {
        body: data.body || "",
        icon: data.icon || "/icon-192.png",
        tag: data.tag,
        data: { url: data.url || "/tableau-de-bord" },
        vibrate: VIBRATIONS[data.kind] || [200, 100, 200],
        timestamp: Date.now(),
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/tableau-de-bord", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if ("navigate" in open) return open.navigate(target);
        return;
      }
      return self.clients.openWindow(target);
    })(),
  );
});

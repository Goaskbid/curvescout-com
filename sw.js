/* CurveScout service worker - the road is where the signal isn't.
   Shell + index: cache-first, refreshed in the background.
   Ride shards: cached the moment a ride is opened, so it stays readable with no bars.
   Tiles / live APIs: never cached here (they go stale and they're big). */
const V = 'curvescout-15c80bf';
/* ---- AN UPDATE MUST NOT TAKE A RIDER'S ROUTES ----
   Route data was cached in the same versioned cache as the shell, and activation deletes every
   cache but the new version - so each app update silently wiped the routes a rider had taken
   offline. Route data now lives in its own cache, which activation never touches; only the
   rider's own "Erase everything" clears it. V is stamped with the build when the site is
   assembled, so every release really is a new version. */
const ROUTES = 'curvescout-routes';
/* ---- THE WORKER WAS DOWNLOADING THE INDEX A SECOND TIME ----
   Measured on a cold load: 23.8 MB fetched, of which 21.6 MB was data/summary.json twice.
   The page asks for it because it needs it now; the worker asked for it again during
   install, in parallel, for offline use. Same ten megabytes, same second, twice over a
   phone connection.
   The shell is the small things a page cannot start without. The index is added to the
   cache when the page's own copy arrives - see the message handler below - so offline still
   works and nobody pays for it twice. */
const SHELL = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './data__places.json',
  './assets__curvescout-mark-transparent.png', './assets__cerebral-local.svg',
];

/* ---- THE WORKER HOLDS COPIES TOO ----
   "Erase everything" cleared six keys in the page and left every cache this worker had
   opened, including saved routes a rider had deliberately taken offline. The page asks; the
   worker empties itself and says nothing more about it. */
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'erase-all') return;
  e.waitUntil(caches.keys().then(names => Promise.all(names.map(n => caches.delete(n)))));
});

/* the page hands over what it has already downloaded; we store it rather than re-fetch it */
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type !== 'cache-index' || !d.url || typeof d.body !== 'string') return;
  e.waitUntil(caches.open(V).then(c => c.put(new Request(d.url),
    new Response(d.body, { headers: { 'content-type': 'application/json' } }))));
});

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u)))) // one 404 must not fail the install
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== V && k !== ROUTES).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // tiles, weather, wiki, overpass: straight to network

  /* ---- STALE-WHILE-REVALIDATE, NOT FETCH-TWICE ----
     This started a network refresh on every request, including a cache MISS - so the very
     first load of data/summary.json went out twice in the same second: once because the
     page needed it, once "in the background" to refresh a copy that did not exist yet.
     Measured on a cold load: 23.8 MB fetched, 21.6 MB of it that one file, doubled.
     On a hit, serve the cache and refresh behind it. On a miss, fetch once and keep it. */
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      caches.match(req).then(hit => {
        if (hit) {
          fetch(req).then(res => {
            if (res && res.ok) caches.open(ROUTES).then(c => c.put(req, res.clone()));
          }).catch(() => {});
          return hit;
        }
        return fetch(req).then(res => {
          if (res && res.ok) caches.open(ROUTES).then(c => c.put(req, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // Shell: cache-first with a network fallback, and index.html for any navigation.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok && (res.type === 'basic')) {
        const copy = res.clone();
        caches.open(V).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  );
});

// The app asks for specific rides to be stored for a trip.
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type !== 'cacheRides' || !Array.isArray(d.urls)) return;
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.allSettled(d.urls.map(u => c.add(u))))
      .then(rs => {
        const okCount = rs.filter(x => x.status === 'fulfilled').length;
        if (e.source) e.source.postMessage({ type: 'cached', ok: okCount, total: d.urls.length });
      })
  );
});

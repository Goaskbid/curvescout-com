/* CurveScout service worker - the road is where the signal isn't.
   App files: network first, cached copy offline. Pictures and libraries: cache-first.
   Ride shards: cached the moment a ride is opened, so it stays readable with no bars.
   Tiles / live APIs: never cached here (they go stale and they're big). */
const V = 'curvescout-b1444e4';
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
  './data/places.json',
  './assets/curvescout-mark-transparent.png', './assets/cerebral-local.svg',
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

/* ---- A NEW RELEASE MUST REACH A PAGE THAT IS ALREADY OPEN (owner 2026-10-12) ----
   A browser that had visited the old site kept running the old app from this cache: a shared trip link opened the start
   page (the old app has no trips) and back left the trip. When this worker replaces an older CurveScout release it asks
   every open page who it is. A page running this app or newer answers and decides itself (it switches at once if it was
   just opened, otherwise on the rider's next tap, so nothing typed is lost). A page that does not answer is an older app
   that cannot update itself: it is reloaded once, at the same address, so the link the rider tapped opens in the new
   app. A first install reloads nothing; the map library's own tile cache does not count as an older release. */
const ACKS = new Set();
self.addEventListener('message', e => { if (e.data && e.data.type === 'cs-ack' && e.source) ACKS.add(e.source.id); });
self.addEventListener('activate', e => {
  let upgrade = 0;
  e.waitUntil(
    caches.keys()
      .then(keys => { const old = keys.filter(k => k !== V && k !== ROUTES);
        upgrade = old.filter(k => /^curvescout-/.test(k)).length;
        return Promise.all(old.map(k => caches.delete(k))); })
      .then(() => self.clients.claim())
      /* the hand-over to open pages runs AFTER activation, never inside it: a page reload inside waitUntil held the
         worker in "activating", and every request of every page waited behind it (found in testing, 2026-10-12) */
      .then(() => { if (upgrade) setTimeout(handOver, 0); })
  );
});
function handOver() {
  self.clients.matchAll({ type: 'window' }).then(cs => {
    cs.forEach(c => { try { c.postMessage({ type: 'cs-release', v: V }); } catch (err) {} });
    setTimeout(() => cs.filter(c => !ACKS.has(c.id)).forEach(c => { try { c.navigate && c.navigate(c.url).catch(() => {}); } catch (err) {} }), 1500);
  });
}

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
  /* the folder-free site names data files data__… (audit 2026-10-11: route data landed in the per-release cache) */
  /* the GitHub build stores every file without folders, so ride data is any .json at the top level (not the manifest) */
  if (url.pathname.includes('/data/') || /\/data__/.test(url.pathname) || /\.json(\.gz)?$/.test(url.pathname)) {
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

  /* ---- THE APP ITSELF COMES FROM THE NETWORK FIRST ----
     Cache-first kept a phone on the old app after every release, until a second reload. The page and the files that
     make the app (index, app.js, styles, config, the mapper) are now asked from the network first, with the cached copy
     as the offline fallback and after 4 s of no answer. Pictures and the map library stay cache-first. */
  const shellFile = req.mode === 'navigate' || /\/(index\.html|app\.js|styles\.css|config\.js|sw\.js)?$/.test(url.pathname);
  if (shellFile) {
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fromCache = () => caches.match(req).then(h => h || (req.mode === 'navigate' ? caches.match('./index.html') : null));
      const t = setTimeout(() => fromCache().then(h => { if (h && !done) { done = true; resolve(h); } }), 4000);
      /* cache: 'no-cache' asks the server whether the file changed - GitHub Pages lets browsers keep files 10 minutes,
         which paired a new page with the old app.js */
      fetch(req, { cache: 'no-cache' }).then(res => {
        if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); }
        if (!done) { done = true; clearTimeout(t); resolve(res); }
      }).catch(() => fromCache().then(h => { if (!done) { done = true; clearTimeout(t); resolve(h || Response.error()); } }));
    }));
    return;
  }

  // Everything else from this site: cache-first with a network fallback.
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

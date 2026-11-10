/* CurveScout phone router (r42) - the backup when the public OSRM server blocks, refuses or does not answer.
   It routes on CurveScout's own road network files (data/net, built by the road job from OpenStreetMap, ODbL) right
   here on the rider's phone, and answers in exactly OSRM's format, so maps, trips, avoid-motorways and the navigator
   (turn-by-turn, bends) keep working unchanged. Nothing is sent anywhere; no service is asked. */
(function () {
  'use strict';
  if (window.CS_PHONE_ROUTE) return;
  var rad = Math.PI / 180, SPEED = [110, 60, 90, 50, 75, 45, 65, 40, 55, 35, 45, 30, 10]; /* km/h by road class, see net-export.mjs */
  var MAJOR_MAX = 7; /* motorway .. secondary_link are in the "major" files */
  function hav(a, b) { var dLa = (b[0] - a[0]) * rad, dLo = (b[1] - a[1]) * rad; var s = Math.pow(Math.sin(dLa / 2), 2) + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.pow(Math.sin(dLo / 2), 2); return 12742017.6 * Math.asin(Math.sqrt(s)); }
  function bearing(a, b) { var y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad), x = Math.cos(a[0] * rad) * Math.sin(b[0] * rad) - Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad); return (Math.atan2(y, x) / rad + 360) % 360; }
  function dec(s) { var out = [], i = 0, la = 0, lo = 0; while (i < s.length) { for (var k = 0; k < 2; k++) { var r = 0, sh = 0, b; do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32); var d = (r & 1) ? ~(r >> 1) : (r >> 1); if (k === 0) la += d; else lo += d; } out.push([la, lo]); } return out; }
  /* ---- the graph, filled square by square ---- */
  var G = { key: new Map(), la: [], lo: [], adj: [], E: [], loaded: {}, byCell: {} };
  function node(la, lo) { var k = la + ',' + lo, i = G.key.get(k); if (i === undefined) { i = G.la.length; G.key.set(k, i); G.la.push(la); G.lo.push(lo); G.adj.push([]); var c = Math.floor(la / 1e5) + '_' + Math.floor(lo / 1e5); (G.byCell[c] = G.byCell[c] || []).push(i); } return i; }
  function addCell(j) { var e = j.e, nm = j.names || []; for (var i = 0; i < e.length; i += 10) { var a = node(e[i], e[i + 1]), b = node(e[i + 2], e[i + 3]); var id = G.E.length;
      G.E.push({ a: a, b: b, len: e[i + 4], cls: e[i + 5], fl: e[i + 6], cv: e[i + 7], name: nm[e[i + 8]] || '', g: e[i + 9] });
      G.adj[a].push(id); if (!(e[i + 6] & 1)) G.adj[b].push(-id - 1); } }
  var pending = {};
  function load(c, major) { var k = (major ? 'm' : 'f') + c; if (G.loaded['f' + c] || G.loaded[k]) return Promise.resolve(true); if (pending[k]) return pending[k];
    return (pending[k] = fetch('/data/net/net' + (major ? 'm' : '') + '-' + c + '.json.gz').then(function (r) { if (!r.ok || !window.DecompressionStream) return null; return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json(); }).then(function (j) { if (j && j.e) { addCell(j); G.loaded[k] = 1; return true; } delete pending[k]; return false; }).catch(function () { delete pending[k]; return false; }));   /* audit r44: a missing square is asked again next time, not remembered as failed */ }
  /* squares near start and end in full detail, the corridor between them with the main roads only */
  function cellsFor(pts) { var full = {}, major = {}; pts.forEach(function (p) { for (var dl = -1; dl <= 1; dl++) for (var dn = -1; dn <= 1; dn++) full[(Math.floor(p[0]) + dl) + '_' + (Math.floor(p[1]) + dn)] = 1; });
    for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(hav(a, b) / 40000)); for (var s = 0; s <= n; s++) { var la = a[0] + (b[0] - a[0]) * s / n, lo = a[1] + (b[1] - a[1]) * s / n; for (var dl = -1; dl <= 1; dl++) for (var dn = -1; dn <= 1; dn++) { var c = (Math.floor(la) + dl) + '_' + (Math.floor(lo) + dn); if (!full[c]) major[c] = 1; } } }
    return { full: Object.keys(full), major: Object.keys(major) }; }
  function snap(p) { var best = -1, bd = Infinity, la = Math.round(p[0] * 1e5), lo = Math.round(p[1] * 1e5); for (var dl = -1; dl <= 1; dl++) for (var dn = -1; dn <= 1; dn++) { var list = G.byCell[(Math.floor(p[0]) + dl) + '_' + (Math.floor(p[1]) + dn)] || [];
      for (var i = 0; i < list.length; i++) { var n = list[i]; if (!G.adj[n].length) continue; var d = Math.pow(G.la[n] - la, 2) + Math.pow((G.lo[n] - lo) * Math.cos(p[0] * rad), 2); if (d < bd) { bd = d; best = n; } } }
    return bd < Math.pow(800, 2) ? best : -1; } /* audit r44: a stop is never moved more than about 800 m to reach the network - otherwise no route, never a silent move */
  /* A* with a binary heap */
  function astar(s, t, o) { var vmax = 110 / 3.6, tla = G.la[t] / 1e5, tlo = G.lo[t] / 1e5; var g = new Map(), prev = new Map(), H = [], done = new Set();
    function h(n) { return hav([G.la[n] / 1e5, G.lo[n] / 1e5], [tla, tlo]) / vmax; }
    function push(x) { H.push(x); var i = H.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; var t2 = H[p]; H[p] = H[i]; H[i] = t2; i = p; } }
    function pop() { var top = H[0], last = H.pop(); if (H.length) { H[0] = last; var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m === i) break; var t3 = H[m]; H[m] = H[i]; H[i] = t3; i = m; } } return top; }
    g.set(s, 0); push([h(s), s]); var it = 0;
    while (H.length) { var cur = pop(), u = cur[1]; if (done.has(u)) continue; done.add(u); if (u === t) break; if (++it > 3e6) break;
      var gu = g.get(u), A = G.adj[u];
      for (var k = 0; k < A.length; k++) { var id = A[k], rev = id < 0, e = G.E[rev ? -id - 1 : id], v = rev ? e.a : e.b;
        if (o.motorway && (e.fl & 4)) continue; if (o.toll && (e.fl & 2)) continue;
        var w = e.len / (SPEED[e.cls] / 3.6); if (o.curvy) { w *= (e.fl & 4) ? 1.8 : (e.cls >= 4 && e.cls <= 10 ? 1.15 - e.cv / 255 * 0.55 : 1.05); }
        var gv = gu + w; if (gv < (g.has(v) ? g.get(v) : Infinity)) { g.set(v, gv); prev.set(v, id); push([gv + h(v), v]); } } }
    if (!prev.has(t) && s !== t) return null; var path = [], n = t; while (n !== s) { var id2 = prev.get(n); path.push(id2); var e2 = G.E[id2 < 0 ? -id2 - 1 : id2]; n = id2 < 0 ? e2.b : e2.a; } return path.reverse(); }
  function edgePts(id) { var rev = id < 0, e = G.E[rev ? -id - 1 : id]; var mid = e.g ? dec(e.g) : []; var pts = [[G.la[e.a], G.lo[e.a]]].concat(mid, [[G.la[e.b], G.lo[e.b]]]).map(function (p) { return [p[0] / 1e5, p[1] / 1e5]; }); return { e: e, pts: rev ? pts.reverse() : pts }; }
  function mod(d) { d = ((d + 540) % 360) - 180; var a = Math.abs(d); return a < 20 ? 'straight' : a < 45 ? (d > 0 ? 'slight right' : 'slight left') : a < 135 ? (d > 0 ? 'right' : 'left') : (d > 0 ? 'sharp right' : 'sharp left'); }
  /* OSRM-shaped answer: legs with steps, each step its geometry and maneuver */
  function leg(path) { var steps = [], cur = null, dist = 0, dur = 0, all = [];
    path.forEach(function (id, i) { var x = edgePts(id), e = x.e, pts = x.pts, d = e.len, t = d / (SPEED[e.cls] / 3.6); dist += d; dur += t;
      all = all.length ? all.concat(pts.slice(1)) : pts.slice();
      var bIn = cur ? bearing(cur.pts[cur.pts.length - 2], cur.pts[cur.pts.length - 1]) : 0, bOut = bearing(pts[0], pts[1]);
      var newStep = !cur || e.name !== cur.name || Math.abs(((bOut - bIn + 540) % 360) - 180) > 60;
      if (newStep) { if (cur) steps.push(cur.s); var m = mod(bOut - bIn), type = !cur ? 'depart' : (e.name === cur.name ? 'continue' : (m === 'straight' ? 'new name' : 'turn'));
        if ((e.fl & 4) && cur && !(cur.fl & 4)) type = 'on ramp'; else if (!(e.fl & 4) && cur && (cur.fl & 4)) type = 'off ramp';
        cur = { name: e.name, fl: e.fl, pts: pts.slice(), s: { distance: d, duration: t, name: e.name, mode: 'driving', geometry: { type: 'LineString', coordinates: pts.map(function (p) { return [p[1], p[0]]; }) }, maneuver: { type: type, modifier: !cur ? undefined : m, location: [pts[0][1], pts[0][0]], bearing_before: Math.round(bIn), bearing_after: Math.round(bOut) } } }; }
      else { cur.s.distance += d; cur.s.duration += t; cur.pts = cur.pts.concat(pts.slice(1)); cur.s.geometry.coordinates = cur.s.geometry.coordinates.concat(pts.slice(1).map(function (p) { return [p[1], p[0]]; })); cur.fl = e.fl; } });
    if (cur) steps.push(cur.s); var end = all[all.length - 1] || [0, 0];
    steps.push({ distance: 0, duration: 0, name: '', mode: 'driving', geometry: { type: 'LineString', coordinates: [[end[1], end[0]], [end[1], end[0]]] }, maneuver: { type: 'arrive', location: [end[1], end[0]], bearing_before: 0, bearing_after: 0 } });
    return { distance: dist, duration: dur, steps: steps, summary: '', weight: dur, coords: all }; }
  function route(pts, o) { var cs = cellsFor(pts);
    return Promise.all(cs.full.map(function (c) { return load(c, false); }).concat(cs.major.map(function (c) { return load(c, true); }))).then(function () {
      var ids = pts.map(snap); if (ids.some(function (x) { return x < 0; })) return { code: 'NoSegment', message: 'Not in CurveScout\'s road network yet' };
      for (var q = 1; q < ids.length; q++) if (ids[q] === ids[q - 1] && hav(pts[q - 1], pts[q]) > 20) return { code: 'NoRoute', message: 'Two stops fall on the same point of the network' };   /* audit r44: never an empty Ok route */
      var legs = [], coords = [];
      for (var i = 1; i < ids.length; i++) { var p = astar(ids[i - 1], ids[i], o); if (!p || (!p.length && hav(pts[i - 1], pts[i]) > 20)) return { code: 'NoRoute', message: 'No route in CurveScout\'s road network' }; if (!p.length) continue; var L = leg(p); coords = coords.length ? coords.concat(L.coords.slice(1)) : L.coords; delete L.coords; legs.push(L); }
      var D = legs.reduce(function (a, l) { return a + l.distance; }, 0), T = legs.reduce(function (a, l) { return a + l.duration; }, 0);
      /* audit R47-04: distinct stops never get an 'Ok' with an empty or one-point road (78 m case) */
      if (coords.length < 2 && hav(pts[0], pts[pts.length - 1]) > 20) return { code: 'NoRoute', message: 'No usable road between these points in CurveScout\'s network' };
      return { code: 'Ok', source: 'curvescout-phone', routes: [{ distance: D, duration: T, weight: T, weight_name: 'routability', legs: legs, geometry: { type: 'LineString', coordinates: coords.map(function (p) { return [p[1], p[0]]; }) } }],
        waypoints: ids.map(function (n) { return { location: [G.lo[n] / 1e5, G.la[n] / 1e5], name: '' }; }) }; }); }
  /* ---- the switch-over: every OSRM route request goes out as before; if OSRM blocks, refuses or is silent, the
     phone answers instead (and stays in charge for 30 minutes before OSRM is tried again) ---- */
  var orig = window.fetch.bind(window), fails = 0, KEY = 'csPhoneRouteUntil';
  function phoneOnly() { try { return +sessionStorage.getItem(KEY) > Date.now(); } catch (e) { return fails >= 3; } }
  function fail() { fails++; if (fails >= 3) try { sessionStorage.setItem(KEY, String(Date.now() + 1800000)); } catch (e) {} }
  function parse(url) { var m = /\/route\/v1\/[a-z]+\/([^?]+)(\?(.*))?$/.exec(url); if (!m) return null; var pts = decodeURIComponent(m[1]).split(';').map(function (s) { var a = s.split(','); return [+a[1], +a[0]]; });
    if (pts.length < 2 || pts.some(function (p) { return !isFinite(p[0]) || !isFinite(p[1]); })) return null; var q = m[3] || '', ex = (/exclude=([^&]*)/.exec(q) || [])[1] || '';
    return { pts: pts, o: { motorway: /motorway/.test(ex), toll: /toll/.test(ex), curvy: /[?&]cs_curvy=1/.test('?' + q) } }; }
  function answer(p) { return route(p.pts, p.o).then(function (j) { window.CS_PHONE_ROUTE.last = j.code; return new Response(JSON.stringify(j), { status: j.code === 'Ok' ? 200 : 400, headers: { 'content-type': 'application/json' } }); }); }
  window.fetch = function (input, init) { var url = typeof input === 'string' ? input : (input && input.url) || '';
    var p = /\/route\/v1\//.test(url) && /^https?:\/\/(router\.project-osrm\.org|routing\.openstreetmap\.de)\//.test(url) ? parse(url) : null; if (!p || window.CS_PHONE_ROUTE.off) return orig(input, init);
    if (window.CS_PHONE_ROUTE.force) return answer(p);
    if (phoneOnly()) return answer(p).then(function (mine) { if (mine.status === 200) return mine; try { sessionStorage.removeItem(KEY); } catch (e) {} fails = 0; return orig(input, init); });   /* audit r44: no local network here -> the online router is asked again, no 30-minute trap */
    var timer, timeout = new Promise(function (res) { timer = setTimeout(function () { res('timeout'); }, 7000); });
    return Promise.race([orig(input, init).then(function (r) { return r; }, function () { return 'error'; }), timeout]).then(function (r) { clearTimeout(timer);
      if (r && r !== 'timeout' && r !== 'error' && r.status !== 429 && r.status !== 403 && r.status < 500) { fails = 0; return r; }
      return answer(p).then(function (mine) { if (mine.status === 200) { fail(); return mine; } return r === 'timeout' || r === 'error' ? mine : r; }); }); };   /* only a local success counts towards staying on the phone */
  window.CS_PHONE_ROUTE = { route: route, graph: G, force: false, off: false, last: null };
})();

(() => {
'use strict';
// CurveScout.com v1.4.6: roadbook runtime repair, feature-preservation audit and stable deployment build.
const ROUTES = Array.isArray(window.CURVESCOUT_ROUTES) ? window.CURVESCOUT_ROUTES : (Array.isArray(window.CURVESCOUT_ROUTES) ? window.CURVESCOUT_ROUTES : []);
const REGIONS = Array.isArray(window.CURVESCOUT_REGIONS) ? window.CURVESCOUT_REGIONS : (Array.isArray(window.CURVESCOUT_REGIONS) ? window.CURVESCOUT_REGIONS : []);
const TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
const COLORS = ['#00e5c8','#f2ef18','#ff9b22','#18c8ff','#ff3b82','#82e660','#b66dff','#ffd166'];
const ICON = {start:'🏁',finish:'🏁',pass:'⛰️',high:'▲',fuel:'⛽',food:'🍽️',sleep:'🛏️',rest:'☕',photo:'📷',scenic:'〽️',swim:'🌊',water:'🌊',sight:'🏛️',restaurant:'🍽️',camera:'📷',danger:'⚠️',weather:'☁️',traffic:'🚦',road:'🛣️',surface:'🧱',timer:'⏱️',map:'🗺️',status:'🚧',block:'⛔',opening:'🟢',view:'🔭'};
const ZURICH = {lat:47.3769, lon:8.5417, label:'Zurich'};
const THALWIL = {lat:47.2913, lon:8.5635, label:'Thalwil / Lake Zurich'};
const HOME = ZURICH;
const state = {start:HOME, end:HOME, range:260, style:'touring', ranked:[], selected:null, routeGeom:new Map(), navSamples:new Map(), map:{center:{lat:47.2,lon:8.6},zoom:8}, searchToken:0, snapToken:0, lastQuery:'Zurich', weatherCache:new Map(), mediaPumpStarted:false};
function routeCacheKey(r){const pts=(r?.navPoints&&r.navPoints.length>=2?r.navPoints:r?.waypoints)||[]; const first=pts[0]||r?.baseStart||HOME; const last=pts[pts.length-1]||first; const mid=pts[Math.floor(pts.length/2)]||first; return [r?.id||'route',Number(first.lat).toFixed(5),Number(first.lon).toFixed(5),Number(mid.lat).toFixed(5),Number(mid.lon).toFixed(5),Number(last.lat).toFixed(5),Number(last.lon).toFixed(5),Math.round(Number(r?.km)||0)].join('|');}
function hasLockedGeometry(r){return state.routeGeom.has(routeCacheKey(r))&&state.navSamples.has(routeCacheKey(r));}
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const fmtKm=n=>Math.round(Number(n)||0)+' km';
const dur=m=>{m=Math.round(Number(m)||0); const h=Math.floor(m/60), r=m%60; return h?`${h}h ${String(r).padStart(2,'0')}`:`${r}m`;};
function slug(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'route';}
function hash(s){let h=2166136261; for(const ch of String(s||'')){h^=ch.charCodeAt(0); h=Math.imul(h,16777619);} return Math.abs(h);}
function hav(a,b){const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLon=(b.lon-a.lon)*Math.PI/180,la1=a.lat*Math.PI/180,la2=b.lat*Math.PI/180;const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
function lon2x(lon,z){return (lon+180)/360*256*Math.pow(2,z);} function lat2y(lat,z){const s=Math.sin(lat*Math.PI/180);return (0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*256*Math.pow(2,z);} 
function fetchTO(url,ms=9000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);return fetch(url,{signal:c.signal,headers:{'Accept':'application/json'}}).finally(()=>clearTimeout(t));}
function setStatus(msg){const el=$('statusLine'); if(el) el.textContent=msg;}

function helmetFallback(){return document.querySelector('.helmetWatermark')?.src || document.querySelector('.headerHelmetMark')?.src || document.querySelector('.brand img')?.src || generatedArt('CurveScout image loading');}
function isSearchPhoto(src){return String(src||'').trim().startsWith('commons-search:');}
function photoQueryFrom(src, fallback='CurveScout scenic motorcycle road'){const parts=String(src||'').split('||').map(x=>x.trim()).filter(Boolean); const searches=parts.filter(isSearchPhoto).map(x=>x.replace(/^commons-search:/,'')); return searches.length?searches.join('||'):fallback;}
function directPhoto(src){for(const part of String(src||'').split('||').map(x=>x.trim()).filter(Boolean)){ if(!part || isSearchPhoto(part) || part.startsWith('data:')) continue; return part;} return '';}
function splitMediaList(src){return String(src||'').split('||').map(x=>x.trim()).filter(Boolean);}
function isDirectImageUrl(url){return /^https?:\/\//i.test(String(url||'')) && !isSearchPhoto(url) && !bannedImageTerms.test(url); }
const mediaCache=new Map();
const mediaVariantCache=new Map();
const weatherCache=new Map();
const badMediaUrls=new Set();
const usedMediaUrls=new Set();
const bannedImageTerms=/(coat\s*of\s*arms|wappen|flag|logo|map|karte|diagram|svg|icon|seal|sign|marker|portrait|selfie|person|people|historical\s*map|historic\s*map|old\s*map|atlas|plan|drawing|painting|etching|engraving|lithograph|watercolor|watercolour|aquarelle|illustration|comic|cartoon|anime|manga|poster|postcard|ansichtskarte|stamp|coin|medal|model|miniature|statue|sculpture|memorial|grave|tomb|crest|emblem|badge|schema|locator|relief|diagram|floor\s*plan|site\s*plan|heraldry|blazon|route\s*map)/i;

function imageResultAllowed(title='', url=''){
  const hay=String(title||'')+' '+String(url||'');
  if(!/^https?:\/\//i.test(String(url||''))) return false;
  if(bannedImageTerms.test(hay)) return false;
  if(/\.(svg|webm|ogv|pdf|gif|tif|tiff|bmp)(\?|$)/i.test(hay)) return false;
  // Strong preference for photographic formats. Wikimedia Special:FilePath URLs are allowed
  // because the file extension is often hidden until the redirect resolves.
  if(/commons\.wikimedia\.org\/wiki\/Special:FilePath/i.test(hay)) return true;
  if(/upload\.wikimedia\.org/i.test(hay) && !/\.(jpe?g|webp|png)(\?|$)/i.test(hay)) return false;
  return true;
}
function usableImageUrl(url){
  const u=String(url||'').trim();
  if(!u || isSearchPhoto(u) || u.startsWith('data:')) return false;
  return imageResultAllowed('',u);
}
function photoTitleLooksReal(title='', url=''){
  const hay=String(title||'')+' '+String(url||'');
  if(bannedImageTerms.test(hay)) return false;
  if(/\.(svg|webm|ogv|pdf|gif|tif|tiff|bmp)(\?|$)/i.test(hay)) return false;
  if(/\.(jpe?g|webp|png)(\?|$)/i.test(hay)) return true;
  return /photo|photograph|panorama|view|valley|lake|fjord|coast|pass|road|gorge|forest|beach|village|harbour|harbor|mountain/i.test(hay);
}
function cleanMediaQuery(query){return String(query||'').replace(/^commons-search:/,'').replace(/[·•]/g,' ').replace(/\b(motorcycle|route|roadbook|scenic route|landscape scenic route|placeholder|image loading)\b/gi,' ').replace(/\s+/g,' ').trim();}
function mediaVariants(query){const q=cleanMediaQuery(query); if(!q) return []; const bits=q.split(/\s+-\s+|\s+and\s+|\s*,\s*|\s+·\s+|\s+\/\s+/).map(x=>cleanMediaQuery(x)).filter(Boolean); const out=[q]; for(const b of bits) if(b.length>3) out.push(b); const words=q.split(' ').filter(w=>w.length>2&&!/road|route|loop|sweep|day|escape|from|near|with|and|the|big|dawn|classic/i.test(w)); for(let i=0;i<words.length;i++){ if(words[i].length>3) out.push(words[i]); if(i<words.length-1) out.push(words.slice(i,i+2).join(' ')); } if(words.length>4) out.push(words.slice(0,4).join(' ')); return [...new Set(out.map(cleanMediaQuery).filter(Boolean))].slice(0,10);}
async function wikiSummaryImage(query){for(const q of mediaVariants(query)){for(const lang of ['en','de']){try{const api=`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q.replace(/ /g,'_'))}`; const res=await fetchTO(api,5200); if(!res.ok) continue; const js=await res.json(); const src=js.originalimage?.source||js.thumbnail?.source||''; if(src && !bannedImageTerms.test(src)) return src;}catch(e){}}} return '';}

async function commonsMediaSearchImage(query){
  // Fast path: try exact title first, then broader Wikimedia media search.
  // The broader search is essential for places where the Commons file title does not exactly match our roadbook wording.
  for(const q of mediaVariants(query)){
    const searches=[
      'intitle:'+q+' photograph landscape road scenic -map -flag -logo -coat -drawing -painting -historic -poster -stamp',
      q+' photograph landscape road scenic panorama village lake pass coast forest -map -flag -logo -coat -drawing -painting -historic -poster -stamp',
      q+' travel photo landscape view road village water mountain coast forest -map -flag -logo -coat -drawing -painting -historic -poster -stamp'
    ];
    for(const search of searches){
      try{
        const api='https://commons.wikimedia.org/w/rest.php/v1/search/media?type=image&limit=32&q='+encodeURIComponent(search);
        const res=await fetchTO(api,5200); if(!res.ok) continue;
        const js=await res.json(); const words=slug(q).split('-').filter(w=>w.length>3&&!/road|route|loop|scenic|photo|image|landscape|motorcycle|curve|curvescout/.test(w));
        const ranked=(js.pages||[]).map(p=>{
          const title=String(p.title||p.key||p.displaytitle||'');
          const url=(p.thumbnail?.url||p.original?.url||p.source||'').replace(/^\/\//,'https://');
          const hay=slug(title+' '+url); let fit=0;
          for(const w of words) if(hay.includes(w)) fit+=18+Math.min(12,w.length);
          if(/photo|photograph|jpg|jpeg|panorama|view|landscape|pass|valley|lake|fjord|coast|road|village|harbour|forest/i.test(title+' '+url)) fit+=16;
          if(bannedImageTerms.test(title+' '+url)) fit-=240;
          return {url,fit};
        }).filter(x=>/^https?:\/\//i.test(x.url)&&x.fit>-35&&photoTitleLooksReal('',x.url)).sort((a,b)=>b.fit-a.fit);
        if(ranked[0]?.url) return ranked[0].url;
      }catch(e){}
    }
  }
  return '';
}

async function commonsSearchImages(query, limit=6){
  const q=cleanMediaQuery(query); if(!q) return [];
  if(mediaVariantCache.has(q)) return mediaVariantCache.get(q).slice(0,limit);
  const searches=[
    'intitle:'+q+' photograph landscape road scenic -map -flag -logo -coat -drawing -painting -historic -poster -stamp',
    q+' photograph landscape scenic road panorama village lake pass coast forest -map -flag -logo -coat -drawing -painting -historic -poster -stamp',
    q+' travel photo view landscape road water mountain coast forest village -map -flag -logo -coat -drawing -painting -historic -poster -stamp'
  ];
  const all=[];
  for(const search of searches){
    const api='https://commons.wikimedia.org/w/api.php?action=query&origin=*&generator=search&gsrnamespace=6&gsrlimit=36&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1400&format=json&gsrsearch='+encodeURIComponent(search);
    try{
      const res=await fetchTO(api,5600); if(!res.ok) continue;
      const js=await res.json(); const pages=Object.values(js.query?.pages||{});
      all.push(...pages);
    }catch(e){}
    if(all.length>=limit*4) break;
  }
  const words=slug(q).split('-').filter(w=>w.length>3&&!/road|route|loop|sweep|scenic|photo|image|landscape|motorcycle|curve|curvescout/.test(w));
  const ranked=all.filter(p=>p.imageinfo?.[0]?.thumburl||p.imageinfo?.[0]?.url).map(p=>{
    const info=p.imageinfo?.[0]||{}; const url=info.thumburl||info.url||''; const hay=String([p.title,url,info.mime].join(' '));
    if(!/^image\//.test(String(info.mime||'image/jpeg'))) return null;
    if(!imageResultAllowed(p.title,url)) return null;
    const w=Number(info.width)||0,h=Number(info.height)||0; if(w<420||h<260) return null;
    const low=slug(hay); let score=0;
    for(const token of words) if(low.includes(token)) score+=22+Math.min(10,token.length);
    if(/photo|photograph|panorama|view|landscape|valley|lake|fjord|coast|road|village|harbour|mountain|forest|beach|pass/i.test(hay)) score+=18;
    if(/map|karte|flag|coat|logo|drawing|painting|poster|stamp|diagram/i.test(hay)) score-=240;
    return {url,score};
  }).filter(Boolean).sort((a,b)=>b.score-a.score);
  const urls=[]; for(const item of ranked){ if(item.score<-25) continue; if(!urls.includes(item.url)) urls.push(item.url); if(urls.length>=Math.max(limit,10)) break; }
  mediaVariantCache.set(q,urls); return urls.slice(0,limit);
}

function mediaTokens(q){return cleanMediaQuery(q).toLowerCase().split(/[^a-z0-9äöüßéèàç]+/i).filter(t=>t.length>2&&!/^(and|the|for|with|road|route|scenic|landscape|from|near|loop|day|photo|view|pass|high|point|start|finish|gate|reset|stop)$/.test(t));}
function mediaCandidateScore(page,query){const title=String(page?.title||'').toLowerCase(); if(bannedImageTerms.test(title)) return -9999; const info=page?.imageinfo?.[0]||{}; const mime=String(info.mime||'').toLowerCase(); if(mime && !/jpeg|jpg|png|webp/.test(mime)) return -9999; const w=Number(info.width)||0,h=Number(info.height)||0; if(w<420||h<260) return -9999; const tokens=mediaTokens(query); let score=0; for(const t of tokens){if(title.includes(t)) score+=24;}
  if(/\.jpe?g(\?|$)/i.test(info.thumburl||info.url||'')) score+=18; if(/road|pass|see|lake|fjord|valley|tal|gorge|cliff|coast|village|dorf|forest|wald|heide|mount|berg|panorama|bridge|river|fluss|waterfall/i.test(title)) score+=10; if(/night|indoor|person|people|museum|portrait|map|coat|flag|logo|drawing|painting|historic|diagram/i.test(title)) score-=80; score+=Math.min(22,Math.log((w*h)||1)); return score;}
async function commonsSearchImage(query){const q=cleanMediaQuery(query); if(!q) return ''; const api='https://commons.wikimedia.org/w/api.php?action=query&origin=*&generator=search&gsrnamespace=6&gsrlimit=24&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1400&format=json&gsrsearch='+encodeURIComponent(q+' -map -flag -coat -drawing -painting'); try{const res=await fetchTO(api,7000); if(!res.ok) throw new Error('media search unavailable'); const js=await res.json(); const pages=Object.values(js.query?.pages||{}); const ranked=pages.map(p=>({p,score:mediaCandidateScore(p,q)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score); const hit=ranked[0]?.p; return hit?.imageinfo?.[0]?.thumburl||hit?.imageinfo?.[0]?.url||'';}catch(e){return '';}}
async function commonsImage(query){query=cleanMediaQuery(query); if(!query) return ''; if(mediaCache.has(query)) return mediaCache.get(query); let url=await commonsMediaSearchImage(query); if(!url) url=await wikiSummaryImage(query); if(!url) url=await commonsSearchImage(query); mediaCache.set(query,url||''); return url||'';}
function photoQueriesFor(entity, route, fallback){const arr=[]; const add=x=>{if(x) arr.push(cleanMediaQuery(x));}; add(entity?.wiki); add(entity?.hero); if(entity?.mediaQueries) entity.mediaQueries.forEach(add); add(entity?.photoQuery); add(entity?.name); if(route){add(route.hero); if(route.mediaQueries) route.mediaQueries.forEach(add); (route.waypoints||[]).filter(w=>['pass','high','sight','swim','photo','scenic'].includes(w.kind||'')).slice(0,5).forEach(w=>add(w.wiki||w.name)); add(route.region+' landscape'); add(route.title);} add(fallback); return [...new Set(arr.filter(Boolean).map(cleanMediaQuery))].slice(0,10);}
function routeCenter(r){const pts=r.waypoints||[]; return pts.length?pts.reduce((a,p)=>({lat:a.lat+p.lat/pts.length,lon:a.lon+p.lon/pts.length}),{lat:0,lon:0}):(r.center||HOME);}
function routeDistanceFrom(p,r){const pts=r.waypoints||[]; let d=hav(p,routeCenter(r)); for(const w of pts) d=Math.min(d,hav(p,w)); return d;}
function routeStartPoint(r){const core=(typeof deriveScenicCore==='function'?deriveScenicCore(r):(r?.waypoints||[])).filter(p=>Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))); return core[0]||r?.center||routeCenter(r);}
function routeStartDistance(base,r){return hav(base,routeStartPoint(r));}
function routeLabel(r){return [r.region,r.title,...(r.aliases||[]),...(r.waypoints||[]).map(w=>w.name)].join(' ').toLowerCase();}
function samePlaceHit(q,r){const key=slug(q); if(!key || key.length<2) return false; const keys=[r.region,r.title,...(r.aliases||[])].map(slug).filter(k=>k.length>1); return keys.some(k=>k===key || (key.length>3 && (k.includes(key) || (k.length>3 && key.includes(k)))));}
const LOCAL_PLACES=(()=>{
  const m=new Map();
  const pin=(k,p)=>{const key=slug(k); if(key)m.set(key,{...p,source:'pinned'});};
  const add=(k,p)=>{const key=slug(k); if(key&&!m.has(key))m.set(key,{...p,source:p.source||'inventory'});};
  pin('zurich',ZURICH); pin('zürich',ZURICH); pin('zuerich',ZURICH); pin('kreis 1 zurich',ZURICH); pin('city of zurich',ZURICH);
  pin('thalwil',THALWIL); pin('thalwil / lake zurich',THALWIL); pin('lake zurich',THALWIL);
  for(const reg of REGIONS){const p={lat:reg.lat,lon:reg.lon,label:reg.label,source:'region'}; add(reg.label,p); (reg.aliases||[]).forEach(a=>add(a,p));}
  for(const r of ROUTES){const c=r.center||routeCenter(r); const p={lat:c.lat,lon:c.lon,label:r.region||r.title,source:'route'}; add(r.region,p); (r.aliases||[]).slice(0,14).forEach(a=>add(a,p));}
  return m;
})();
async function geocode(q){q=String(q||'').trim(); if(!q) return HOME; const co=q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/); if(co) return {lat:+co[1],lon:+co[2],label:`${(+co[1]).toFixed(3)}, ${(+co[2]).toFixed(3)}`}; const key=slug(q); if(LOCAL_PLACES.has(key)) return {...LOCAL_PLACES.get(key)}; for(const [k,v] of LOCAL_PLACES){if(key.length>3 && (k.includes(key)||key.includes(k))) return {...v};}
  try{const res=await fetchTO(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,6500); if(res.ok){const js=await res.json(); if(js&&js[0]) return {lat:+js[0].lat,lon:+js[0].lon,label:js[0].display_name.split(',').slice(0,2).join(', ')||q};}}catch(e){}
  return HOME;
}
async function reverseGeocodeLabel(p){try{const res=await fetchTO(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lon}`,5200); if(res.ok){const js=await res.json(); const a=js.address||{}; const label=[a.city||a.town||a.village||a.suburb,a.state||a.county,a.country].filter(Boolean).slice(0,2).join(', '); if(label) return label;}}catch(e){} return 'current location';}
async function approximateIpLocation(){try{const res=await fetchTO('https://ipapi.co/json/',5200); if(res.ok){const js=await res.json(); if(Number.isFinite(Number(js.latitude))&&Number.isFinite(Number(js.longitude))) return {lat:Number(js.latitude),lon:Number(js.longitude),label:[js.city,js.region].filter(Boolean).join(', ')||'approximate current location'};}}catch(e){} return null;}
function browserLocation(){return new Promise((resolve,reject)=>{if(!navigator.geolocation) return reject(new Error('geolocation unavailable')); navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,label:'current location'}),reject,{enableHighAccuracy:true,timeout:12000,maximumAge:30000});});}
async function currentLocation(){
  try{
    const p=await browserLocation();
    p.label=await reverseGeocodeLabel(p);
    p.isGpsStart=true;
    p.locationMode='gps';
    return p;
  }catch(e){
    const ip=await approximateIpLocation();
    if(ip){ip.locationMode='ip'; return ip;}
    const typed=($('startInput')?.value||'').trim();
    if(typed){const g=await geocode(typed); g.locationMode='typed-fallback'; return g;}
    return {...HOME,label:'Zurich',locationMode:'home-fallback'};
  }
}
function destination(lat, lon, km, bearing){const R=6371, br=bearing*Math.PI/180, la1=lat*Math.PI/180, lo1=lon*Math.PI/180, d=km/R; const la2=Math.asin(Math.sin(la1)*Math.cos(d)+Math.cos(la1)*Math.sin(d)*Math.cos(br)); const lo2=lo1+Math.atan2(Math.sin(br)*Math.sin(d)*Math.cos(la1),Math.cos(d)-Math.sin(la1)*Math.sin(la2)); return {lat:+(la2*180/Math.PI).toFixed(6), lon:+(lo2*180/Math.PI).toFixed(6)};}
function generatedFallbackRoutes(base, query, range, count=24){const label=(query||base.label||'your start').split(',')[0].replace(/\s+/g,' ').trim(); const themes=[['ridge and water escape','Ridges, water and clean village exits: a real riding framework when the local catalogue is thin.'],['forest sweep and food stop','Quiet tree shade, a useful food anchor and a different return line.'],['old-road viewpoint loop','Historic edges, one strong viewpoint and roads chosen to escape traffic first.'],['river bends and coffee return','Water, bends and simple timing: rideable without turning it into motorway homework.'],['high-road discovery arc','The wider-range option for riders who want elevation, stops and a proper day shape.'],['morning empty-road loop','Best early, before commuters and tourists fill the useful roads.'],['coast or lake-edge scout','Water, photos and relaxed navigation anchors with a calm ride home.'],['backroad architecture day','Historic places, farm roads and enough road character to feel earned.'],['green belt roadbook','A compact outside-traffic route around parks, woods and quiet connectors.'],['outer villages flow','Small settlements and low-stress connectors instead of city-centre frustration.'],['sunset viewpoint return','Shorter, photogenic and designed to finish before fatigue has a vote.'],['weekend wider universe','A longer route with bigger scenic reward, more stops and a serious map check.'],['valley and ridge figure-eight','A flexible shape that lets you shorten the ride without losing the good road.'],['market town and forest loop','A useful food stop, a small-town reset and shaded roads for hot days.'],['waterline and high ground','Water at the start, a higher road in the middle and a tidy return.'],['quiet borderland arc','Region edges often carry better motorcycle rhythm than the centre.'],['view road and fuel gate','One fuel anchor, one view road and enough distance to feel like a ride.'],['stone villages and sweepers','Historic villages, open bends and a sober return route.'],['two-valley flow route','A two-valley rhythm that avoids repetition and keeps navigation clear.'],['local classic scout','A starter route for finding the local classic without guessing from a blank map.'],['north road and lake reset','A northbound route shaped around water, shade and easy recovery stops.'],['south hills and photo stop','Hills, a photo pull-off and a practical food option.'],['east forest and old town','Tree-lined sections and an old-town anchor without inner-city crawling.'],['west sweep and return','A western arc with enough flow to justify the helmet.']];
  return themes.slice(0,count).map((t,i)=>{const radius=Math.min(Math.max(range*.12,16),95)+(i%5)*5; const start=destination(base.lat,base.lon,Math.min(16,range*.06),i*17); const bearings=[i*17+12,i*17+53,i*17+98,i*17+146,i*17+213,i*17+289].map(x=>x%360); const pts=[start,...bearings.map((b,j)=>destination(base.lat,base.lon,radius*(.54+j*.095),b)),destination(base.lat,base.lon,Math.min(16,range*.06),(i*17+186)%360)]; const names=[`${label} clean start`,`${label} fuel gate`,`${label} scenic road`,`${label} viewpoint`,`${label} food stop`,`${label} water stop`,`${label} return`]; const km=Math.max(70,Math.round(pts.reduce((s,p,j)=>j?s+hav(pts[j-1],p):0,0)*1.22)); const score=75+(i*7)%18; const wps=pts.map((p,j)=>({name:names[j],lat:p.lat,lon:p.lon,kind:j===0?'start':j===pts.length-1?'finish':(['fuel','scenic','photo','food','swim'][j-1]||'scenic'),wiki:names[j],advice:waypointAdvice({name:names[j],kind:j===0?'start':j===pts.length-1?'finish':(['fuel','scenic','photo','food','swim'][j-1]||'scenic')})})); const profile=makeSyntheticProfile(wps, score, i); return {id:`local-${slug(label)}-${i}`,title:`${label} · ${t[0]}`,region:`${label} local road trips`,center:{lat:base.lat,lon:base.lon},aliases:[label,query,'local road trip'],slogan:t[1],story:`${label} · ${t[0]} is a local CurveScout.com road-trip candidate for riders who need a real outside-traffic route from the selected start. The ride gets out of the centre first, adds a fuel gate, uses one or two scenic anchors, and returns on a different line. Treat it as a strong starting roadbook: inspect the map, adjust for current road status, and use the waypoint pack to keep every navigation app honest.`,hero:t[0],score,km,minutes:Math.round(km/52*60),waypoints:wps,breakdown:{scenic:score+2,flow:score,technical:60+(i*5)%28,surface:78,trafficEscape:88,risk:32+(i*3)%24},roadStatus:[{label:`${label} road information`,url:'https://www.openstreetmap.org/',note:'Check local road status, traffic and signs before riding.'}],source:{label:'CurveScout.com local scout',url:'https://www.openstreetmap.org/'},speedBand:'50-80 km/h riding core, local limits always win',routeKind:'local-scout',photo:mediaFor(label+' '+t[0],i),sections:wps.slice(0,-1).map((w,j)=>({from:w.name,to:wps[j+1].name,type:['transfer','scenic','serpentine','scenic','fast','transfer'][j%6],km:Math.max(5,Math.round(km/(wps.length-1))),advice:sectionAdvice({type:['transfer','scenic','serpentine','scenic','fast','transfer'][j%6],from:w.name,to:wps[j+1].name,km:Math.max(5,Math.round(km/(wps.length-1)))},wps[j],wps[j+1])})),safetyMarkers:[{km:Math.round(km*.34),type:'speed/control reminder',note:'Expect posted-limit enforcement near settlements and main-road joins.'},{km:Math.round(km*.62),type:'surface/weather risk',note:'Check shade, leaves, gravel, damp patches and wildlife.'}],profile,profileMin:Math.min(...profile),profileMax:Math.max(...profile)};});}
function makeSyntheticProfile(wps, score=80, salt=1){const base=80+(score-70)*8; return Array.from({length:120},(_,n)=>Math.round(base+190*Math.sin(n/119*Math.PI)**2+65*Math.sin(n/119*Math.PI*5+salt)+30*Math.sin(n/119*Math.PI*13)));}
const PHOTO_BANK=[
 ['brunig','https://commons.wikimedia.org/wiki/Special:FilePath/Br%C3%BCnigpass.jpg'],['brünig','https://commons.wikimedia.org/wiki/Special:FilePath/Br%C3%BCnigpass.jpg'],['glaubenbielen','https://commons.wikimedia.org/wiki/Special:FilePath/Glaubenbielenpass.jpg'],['entlebuch','https://commons.wikimedia.org/wiki/Special:FilePath/Entlebuch.jpg'],['giswil','https://commons.wikimedia.org/wiki/Special:FilePath/Giswil.jpg'],['sarnen','https://commons.wikimedia.org/wiki/Special:FilePath/Sarnen%20am%20Sarnersee.jpg'],['jura','https://commons.wikimedia.org/wiki/Special:FilePath/Jura%20mountains%20Switzerland.jpg'],['staffelgg','https://commons.wikimedia.org/wiki/Special:FilePath/Staffelegg.jpg'],['passwang','https://commons.wikimedia.org/wiki/Special:FilePath/Passwang.jpg'],['solothurn','https://commons.wikimedia.org/wiki/Special:FilePath/Solothurn%20Aare.jpg'],['appenzell','https://commons.wikimedia.org/wiki/Special:FilePath/Appenzell%20Hauptgasse.jpg'],['santis','https://commons.wikimedia.org/wiki/Special:FilePath/S%C3%A4ntis%20von%20der%20Schw%C3%A4galp.jpg'],['säntis','https://commons.wikimedia.org/wiki/Special:FilePath/S%C3%A4ntis%20von%20der%20Schw%C3%A4galp.jpg'],['schwagalp','https://commons.wikimedia.org/wiki/Special:FilePath/Schw%C3%A4galp%20S%C3%A4ntis.jpg'],['schwägalp','https://commons.wikimedia.org/wiki/Special:FilePath/Schw%C3%A4galp%20S%C3%A4ntis.jpg'],['bregenzerwald','https://commons.wikimedia.org/wiki/Special:FilePath/Bregenzerwald%20Bezau.jpg'],['furkajoch','https://commons.wikimedia.org/wiki/Special:FilePath/Furkajoch.jpg'],['faschina','https://commons.wikimedia.org/wiki/Special:FilePath/Faschinajoch.jpg'],['montafon','https://commons.wikimedia.org/wiki/Special:FilePath/Montafon%20panorama.jpg'],['tremola','https://commons.wikimedia.org/wiki/Special:FilePath/Tremola%20Gotthardpass.jpg'],['gotthard','https://commons.wikimedia.org/wiki/Special:FilePath/Tremola%20Gotthardpass.jpg'],['nufenen','https://commons.wikimedia.org/wiki/Special:FilePath/Nufenenpass.jpg'],['lukmanier','https://commons.wikimedia.org/wiki/Special:FilePath/Lukmanierpass.jpg'],['oberalp','https://commons.wikimedia.org/wiki/Special:FilePath/Oberalppass.jpg'],['ibergeregg','https://commons.wikimedia.org/wiki/Special:FilePath/Ibergeregg.jpg'],['sihlsee','https://commons.wikimedia.org/wiki/Special:FilePath/Sihlsee.jpg'],['kiel','https://commons.wikimedia.org/wiki/Special:FilePath/Kieler%20F%C3%B6rde.jpg'],['laboe','https://commons.wikimedia.org/wiki/Special:FilePath/Laboe%20Marine-Ehrenmal.jpg'],['hohwacht','https://commons.wikimedia.org/wiki/Special:FilePath/Hohwacht%20Ostsee.jpg'],['schlei','https://commons.wikimedia.org/wiki/Special:FilePath/Schlei%20Kappeln.jpg'],['kappeln','https://commons.wikimedia.org/wiki/Special:FilePath/Kappeln%20Schlei.jpg'],['eckernforde','https://commons.wikimedia.org/wiki/Special:FilePath/Eckernf%C3%B6rde%20Hafen.jpg'],['eckernförde','https://commons.wikimedia.org/wiki/Special:FilePath/Eckernf%C3%B6rde%20Hafen.jpg'],['plon','https://commons.wikimedia.org/wiki/Special:FilePath/Pl%C3%B6ner%20See.jpg'],['plön','https://commons.wikimedia.org/wiki/Special:FilePath/Pl%C3%B6ner%20See.jpg'],['eutin','https://commons.wikimedia.org/wiki/Special:FilePath/Eutin%20Schloss.jpg'],['travemunde','https://commons.wikimedia.org/wiki/Special:FilePath/Travem%C3%BCnde%20Strand.jpg'],['travemünde','https://commons.wikimedia.org/wiki/Special:FilePath/Travem%C3%BCnde%20Strand.jpg'],['lubeck','https://commons.wikimedia.org/wiki/Special:FilePath/Holstentor%20L%C3%BCbeck.jpg'],['lübeck','https://commons.wikimedia.org/wiki/Special:FilePath/Holstentor%20L%C3%BCbeck.jpg'],['holstein','https://commons.wikimedia.org/wiki/Special:FilePath/Holsteinische%20Schweiz%20Pl%C3%B6ner%20See.jpg'],['rendsburg','https://commons.wikimedia.org/wiki/Special:FilePath/Rendsburger%20Hochbr%C3%BCcke.jpg'],['fehmarn','https://commons.wikimedia.org/wiki/Special:FilePath/Fehmarnsundbr%C3%BCcke.jpg'],['westensee','https://commons.wikimedia.org/wiki/Special:FilePath/Westensee.jpg'],['selent','https://commons.wikimedia.org/wiki/Special:FilePath/Selenter%20See.jpg'],['wismar','https://commons.wikimedia.org/wiki/Special:FilePath/Wismar%20Alter%20Hafen.jpg'],['rostock','https://commons.wikimedia.org/wiki/Special:FilePath/Rostock%20Warnem%C3%BCnde.jpg'],['lunenburg','https://commons.wikimedia.org/wiki/Special:FilePath/L%C3%BCneburger%20Heide%20NSG%20Wilseder%20Berg.jpg'],['lüneburg','https://commons.wikimedia.org/wiki/Special:FilePath/L%C3%BCneburger%20Heide%20NSG%20Wilseder%20Berg.jpg'],
 ['furka','https://upload.wikimedia.org/wikipedia/commons/8/87/Furkapass_westside.jpg'],['furka','https://commons.wikimedia.org/wiki/Special:FilePath/Hotel%20Belvedere%20Furka%20Pass.jpg'],['grimsel','https://commons.wikimedia.org/wiki/Special:FilePath/Grimsel%20Pass%20road.jpg'],['susten','https://commons.wikimedia.org/wiki/Special:FilePath/Sustenpass%20road.jpg'],['pass','https://commons.wikimedia.org/wiki/Special:FilePath/Col%20du%20Galibier%202009.jpg'],['alpine','https://commons.wikimedia.org/wiki/Special:FilePath/Grossglockner%20High%20Alpine%20Road%20Austria.jpg'],['grimsel','https://commons.wikimedia.org/wiki/Special:FilePath/Grimselpass%20Passhoehe.jpg'],['susten','https://commons.wikimedia.org/wiki/Special:FilePath/Sustenpassstrasse.jpg'],['stelvio','https://commons.wikimedia.org/wiki/Special:FilePath/Stelvio%20Pass%20road.jpg'],['dolomites','https://commons.wikimedia.org/wiki/Special:FilePath/Drei%20Zinnen%20vom%20Paternkofel.jpg'],['glaubenberg','https://commons.wikimedia.org/wiki/Special:FilePath/Sihlsee.jpg'],['pilatus','https://commons.wikimedia.org/wiki/Special:FilePath/Pilatus%20Kulm.jpg'],['alpine','https://commons.wikimedia.org/wiki/Special:FilePath/Trollstigen%20road%20Norway.jpg'],['pass','https://commons.wikimedia.org/wiki/Special:FilePath/Trollstigen%20road%20Norway.jpg'],['mountain','https://commons.wikimedia.org/wiki/Special:FilePath/Trollstigen%20road%20Norway.jpg'],['hakone','https://upload.wikimedia.org/wikipedia/commons/b/ba/Hakone_Turnpike_20140412-1.jpg'],['fuji','https://commons.wikimedia.org/wiki/Special:FilePath/Lake%20Ashi%20and%20Mount%20Fuji.jpg'],['izu','https://commons.wikimedia.org/wiki/Special:FilePath/Jogasaki%20Coast%2001.jpg'],['tokyo','https://commons.wikimedia.org/wiki/Special:FilePath/Lake%20Ashi%20and%20Mount%20Fuji.jpg'],['vercors','https://upload.wikimedia.org/wikipedia/commons/6/60/Vercors_001.jpg'],['ardeche','https://commons.wikimedia.org/wiki/Special:FilePath/Pont%20d%27Arc%20in%20Ard%C3%A8che%20Gorges.jpg'],['lyon','https://upload.wikimedia.org/wikipedia/commons/6/60/Vercors_001.jpg'],['beaujolais','https://commons.wikimedia.org/wiki/Special:FilePath/Beaujolais%20Vineyards.jpg'],['hamburg','https://commons.wikimedia.org/wiki/Special:FilePath/L%C3%BCneburger%20Heide%20NSG%20Wilseder%20Berg.jpg'],['heath','https://commons.wikimedia.org/wiki/Special:FilePath/L%C3%BCneburger%20Heide%20NSG%20Wilseder%20Berg.jpg'],['lune','https://commons.wikimedia.org/wiki/Special:FilePath/L%C3%BCneburger%20Heide%20NSG%20Wilseder%20Berg.jpg'],['coast','https://commons.wikimedia.org/wiki/Special:FilePath/Bixby%20Creek%20Bridge%2C%20Big%20Sur%2C%20California%20-%20May%202013.jpg'],['beach','https://commons.wikimedia.org/wiki/Special:FilePath/Seven%20Sisters%20cliffs%20and%20the%20coastguard%20cottages%2C%20from%20Seaford%20Head%20showing%20Cuckmere%20Haven%20%28looking%20East%29.jpg'],['london','https://commons.wikimedia.org/wiki/Special:FilePath/Seven%20Sisters%20cliffs%20and%20the%20coastguard%20cottages%2C%20from%20Seaford%20Head%20showing%20Cuckmere%20Haven%20%28looking%20East%29.jpg'],['paris','https://commons.wikimedia.org/wiki/Special:FilePath/Ch%C3%A2teau%20de%20Chantilly%20from%20the%20air.jpg'],['fontainebleau','https://commons.wikimedia.org/wiki/Special:FilePath/For%C3%AAt%20de%20Fontainebleau.jpg'],['chevreuse','https://commons.wikimedia.org/wiki/Special:FilePath/Ch%C3%A2teau%20de%20la%20Madeleine%20Chevreuse.jpg'],['berlin','https://commons.wikimedia.org/wiki/Special:FilePath/M%C3%A4rkische%20Schweiz%20-%20Scherm%C3%BCtzelsee.jpg'],['hannover','https://commons.wikimedia.org/wiki/Special:FilePath/Harz%20National%20Park%20view.jpg'],['harz','https://commons.wikimedia.org/wiki/Special:FilePath/Harz%20National%20Park%20view.jpg'],['new york','https://commons.wikimedia.org/wiki/Special:FilePath/Bear%20Mountain%20Bridge%20and%20Hudson%20River.jpg'],['catskills','https://commons.wikimedia.org/wiki/Special:FilePath/Catskill%20Mountains%20from%20Overlook%20Mountain.jpg'],['blue ridge','https://commons.wikimedia.org/wiki/Special:FilePath/Blue%20Ridge%20Parkway%20-%20Linn%20Cove%20Viaduct.jpg'],['norway','https://commons.wikimedia.org/wiki/Special:FilePath/Trollstigen%20road%20Norway.jpg'],['scotland','https://commons.wikimedia.org/wiki/Special:FilePath/Bealach%20na%20Ba%20road.jpg'],['california','https://commons.wikimedia.org/wiki/Special:FilePath/Bixby%20Creek%20Bridge%2C%20Big%20Sur%2C%20California%20-%20May%202013.jpg'],['chapman','https://commons.wikimedia.org/wiki/Special:FilePath/Chapmans%20Peak%20Drive.jpg'],['ocean','https://commons.wikimedia.org/wiki/Special:FilePath/Bixby%20Creek%20Bridge%2C%20Big%20Sur%2C%20California%20-%20May%202013.jpg'],['lake','https://commons.wikimedia.org/wiki/Special:FilePath/Lake%20Ashi%20and%20Mount%20Fuji.jpg'],['forest','https://upload.wikimedia.org/wikipedia/commons/6/60/Vercors_001.jpg'],['castle','https://commons.wikimedia.org/wiki/Special:FilePath/Rheinsberg%20Schloss%20und%20Park%20asv2024-03%20img04.jpg'],['river','https://commons.wikimedia.org/wiki/Special:FilePath/Wachau%20-%20Donau%20bei%20D%C3%BCrnstein.jpg'],['default','https://upload.wikimedia.org/wikipedia/commons/6/60/Vercors_001.jpg']
];
const IMAGE_ROTATION=['https://upload.wikimedia.org/wikipedia/commons/8/87/Furkapass_westside.jpg','https://upload.wikimedia.org/wikipedia/commons/6/60/Vercors_001.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Trollstigen%20road%20Norway.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Bixby%20Creek%20Bridge%2C%20Big%20Sur%2C%20California%20-%20May%202013.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Lake%20Ashi%20and%20Mount%20Fuji.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/L%C3%BCneburger%20Heide%20NSG%20Wilseder%20Berg.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Seven%20Sisters%20cliffs%20and%20the%20coastguard%20cottages%2C%20from%20Seaford%20Head%20showing%20Cuckmere%20Haven%20%28looking%20East%29.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Bear%20Mountain%20Bridge%20and%20Hudson%20River.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Ch%C3%A2teau%20de%20Chantilly%20from%20the%20air.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/M%C3%A4rkische%20Schweiz%20-%20Scherm%C3%BCtzelsee.jpg'];
PHOTO_BANK.push(
 ['zurich','https://commons.wikimedia.org/wiki/Special:FilePath/Z%C3%BCrichsee%20vom%20Uetliberg.jpg'],['zuerich','https://commons.wikimedia.org/wiki/Special:FilePath/Z%C3%BCrichsee%20vom%20Uetliberg.jpg'],['lake zurich','https://commons.wikimedia.org/wiki/Special:FilePath/Z%C3%BCrichsee%20vom%20Uetliberg.jpg'],['thunersee','https://commons.wikimedia.org/wiki/Special:FilePath/Thunersee%20Niesen.jpg'],['vierwaldstattersee','https://commons.wikimedia.org/wiki/Special:FilePath/Vierwaldst%C3%A4ttersee%20Rigi.jpg'],['lucerne','https://commons.wikimedia.org/wiki/Special:FilePath/Luzern%20Kapellbr%C3%BCcke%20Wasserturm.jpg'],['luzern','https://commons.wikimedia.org/wiki/Special:FilePath/Luzern%20Kapellbr%C3%BCcke%20Wasserturm.jpg'],['engelberg','https://commons.wikimedia.org/wiki/Special:FilePath/Engelberg%20Titlis.jpg'],['pilatus','https://commons.wikimedia.org/wiki/Special:FilePath/Pilatus%20from%20Lucerne.jpg'],
 ['interlaken','https://commons.wikimedia.org/wiki/Special:FilePath/Interlaken%20and%20Jungfrau.jpg'],['grindelwald','https://commons.wikimedia.org/wiki/Special:FilePath/Grindelwald%20valley.jpg'],['meiringen','https://commons.wikimedia.org/wiki/Special:FilePath/Aareschlucht.jpg'],['susten','https://upload.wikimedia.org/wikipedia/commons/a/a2/Sustenpass_2007.jpg'],['grimsel','https://commons.wikimedia.org/wiki/Special:FilePath/Grimselpass%20road.jpg'],['furka','https://upload.wikimedia.org/wikipedia/commons/8/87/Furkapass_westside.jpg'],
 ['hamburg','https://commons.wikimedia.org/wiki/Special:FilePath/Hamburg%20Speicherstadt%202010.jpg'],['travemunde','https://commons.wikimedia.org/wiki/Special:FilePath/Travem%C3%BCnde%20Strand.jpg'],['lubeck','https://commons.wikimedia.org/wiki/Special:FilePath/Holstentor%20L%C3%BCbeck.jpg'],['eutin','https://commons.wikimedia.org/wiki/Special:FilePath/Eutin%20Schloss.jpg'],['plon','https://commons.wikimedia.org/wiki/Special:FilePath/Pl%C3%B6ner%20See.jpg'],['schlei','https://commons.wikimedia.org/wiki/Special:FilePath/Schlei%20Kappeln.jpg'],['kiel','https://commons.wikimedia.org/wiki/Special:FilePath/Kieler%20F%C3%B6rde.jpg'],['laboe','https://commons.wikimedia.org/wiki/Special:FilePath/Laboe%20Marine-Ehrenmal.jpg'],['fehmarn','https://commons.wikimedia.org/wiki/Special:FilePath/Fehmarnsundbr%C3%BCcke.jpg'],['ratzeburg','https://commons.wikimedia.org/wiki/Special:FilePath/Ratzeburger%20See.jpg'],['schaalsee','https://commons.wikimedia.org/wiki/Special:FilePath/Schaalsee%20See.jpg'],['luneburg','https://commons.wikimedia.org/wiki/Special:FilePath/L%C3%BCneburger%20Heide%20NSG%20Wilseder%20Berg.jpg'],
 ['berlin','https://commons.wikimedia.org/wiki/Special:FilePath/M%C3%A4rkische%20Schweiz%20-%20Scherm%C3%BCtzelsee.jpg'],['spreewald','https://commons.wikimedia.org/wiki/Special:FilePath/Spreewaldkanal%20near%20L%C3%BCbbenau.jpg'],['rheinsberg','https://commons.wikimedia.org/wiki/Special:FilePath/Rheinsberg%20Schloss%20und%20Park%20asv2024-03%20img04.jpg'],['oderbruch','https://commons.wikimedia.org/wiki/Special:FilePath/Oderbruch.jpg'],['flaming','https://commons.wikimedia.org/wiki/Special:FilePath/Burg%20Rabenstein%20Fl%C3%A4ming.jpg'],
 ['paris','https://commons.wikimedia.org/wiki/Special:FilePath/Ch%C3%A2teau%20de%20Chantilly%20from%20the%20air.jpg'],['vexin','https://commons.wikimedia.org/wiki/Special:FilePath/La%20Roche-Guyon%2C%20le%20ch%C3%A2teau.jpg'],['fontainebleau','https://commons.wikimedia.org/wiki/Special:FilePath/For%C3%AAt%20de%20Fontainebleau.jpg'],['chevreuse','https://commons.wikimedia.org/wiki/Special:FilePath/Ch%C3%A2teau%20de%20la%20Madeleine%20Chevreuse.jpg'],['chantilly','https://commons.wikimedia.org/wiki/Special:FilePath/Ch%C3%A2teau%20de%20Chantilly%20from%20the%20air.jpg'],
 ['tokyo','https://commons.wikimedia.org/wiki/Special:FilePath/Lake%20Ashi%20and%20Mount%20Fuji.jpg'],['hakone','https://upload.wikimedia.org/wikipedia/commons/b/ba/Hakone_Turnpike_20140412-1.jpg'],['okutama','https://commons.wikimedia.org/wiki/Special:FilePath/Lake%20Okutama.jpg'],['nikko','https://commons.wikimedia.org/wiki/Special:FilePath/Irohazaka%20Road.jpg'],['izu','https://commons.wikimedia.org/wiki/Special:FilePath/Jogasaki%20Coast%2001.jpg'],
 ['lyon','https://upload.wikimedia.org/wikipedia/commons/6/60/Vercors_001.jpg'],['vercors','https://upload.wikimedia.org/wikipedia/commons/6/60/Vercors_001.jpg'],['ardeche','https://commons.wikimedia.org/wiki/Special:FilePath/Pont%20d%27Arc%20in%20Ard%C3%A8che%20Gorges.jpg'],['beaujolais','https://commons.wikimedia.org/wiki/Special:FilePath/Beaujolais%20Vineyards.jpg'],
 ['new york','https://commons.wikimedia.org/wiki/Special:FilePath/Bear%20Mountain%20Bridge%20and%20Hudson%20River.jpg'],['catskills','https://commons.wikimedia.org/wiki/Special:FilePath/Catskill%20Mountains%20from%20Overlook%20Mountain.jpg'],['hudson','https://commons.wikimedia.org/wiki/Special:FilePath/Bear%20Mountain%20Bridge%20and%20Hudson%20River.jpg'],
 ['moscow','https://commons.wikimedia.org/wiki/Special:FilePath/New%20Jerusalem%20Monastery%2C%20Istra%2C%20Russia.jpg'],['istra','https://commons.wikimedia.org/wiki/Special:FilePath/New%20Jerusalem%20Monastery%2C%20Istra%2C%20Russia.jpg'],['zvenigorod','https://commons.wikimedia.org/wiki/Special:FilePath/Savvino-Storozhevsky%20Monastery.jpg'],
 ['milan','https://commons.wikimedia.org/wiki/Special:FilePath/Lake%20Como%20from%20Villa%20Olmo.jpg'],['dolomites','https://commons.wikimedia.org/wiki/Special:FilePath/Dolomites%20-%20Passo%20Gardena.jpg'],['stelvio','https://commons.wikimedia.org/wiki/Special:FilePath/Stilfser%20Joch%20Stelvio%20Pass.jpg'],['nice','https://commons.wikimedia.org/wiki/Special:FilePath/Gorges%20du%20Verdon%20route.jpg'],['verdon','https://commons.wikimedia.org/wiki/Special:FilePath/Gorges%20du%20Verdon%20route.jpg'],
 ['norway','https://commons.wikimedia.org/wiki/Special:FilePath/Trollstigen%20road%20Norway.jpg'],['trollstigen','https://commons.wikimedia.org/wiki/Special:FilePath/Trollstigen%20road%20Norway.jpg'],['scotland','https://commons.wikimedia.org/wiki/Special:FilePath/Bealach%20na%20Ba%20road.jpg'],['blue ridge','https://commons.wikimedia.org/wiki/Special:FilePath/Blue%20Ridge%20Parkway%20-%20Linn%20Cove%20Viaduct.jpg'],['california','https://commons.wikimedia.org/wiki/Special:FilePath/Bixby%20Creek%20Bridge%2C%20Big%20Sur%2C%20California%20-%20May%202013.jpg'],['big sur','https://commons.wikimedia.org/wiki/Special:FilePath/Bixby%20Creek%20Bridge%2C%20Big%20Sur%2C%20California%20-%20May%202013.jpg'],['chapman','https://commons.wikimedia.org/wiki/Special:FilePath/Chapmans%20Peak%20Drive.jpg'],['great ocean','https://commons.wikimedia.org/wiki/Special:FilePath/Great%20Ocean%20Road%20Australia.jpg']
);


PHOTO_BANK.push(
 ['curve scout helmet','assets/curvescout-helmet-visual.png'],
 ['sustenpass road','https://upload.wikimedia.org/wikipedia/commons/a/a2/Sustenpass_2007.jpg'],
 ['grimselpass road hairpins','https://commons.wikimedia.org/wiki/Special:FilePath/Grimselpass%20road.jpg'],
 ['furkapass road valley','https://upload.wikimedia.org/wikipedia/commons/8/87/Furkapass_westside.jpg'],
 ['gotthard tremola road','https://commons.wikimedia.org/wiki/Special:FilePath/Tremola%20Gotthardpass.jpg'],
 ['nufenen pass road','https://commons.wikimedia.org/wiki/Special:FilePath/Nufenenpass%20road.jpg'],
 ['bruenig pass road','https://commons.wikimedia.org/wiki/Special:FilePath/Br%C3%BCnigpass.jpg'],
 ['glaubenbielen pass road','https://commons.wikimedia.org/wiki/Special:FilePath/Glaubenbielenpass.jpg'],
 ['entlebuch valley','https://commons.wikimedia.org/wiki/Special:FilePath/Entlebuch.jpg'],
 ['appenzell hills','https://commons.wikimedia.org/wiki/Special:FilePath/Appenzell%20Hauptgasse.jpg'],
 ['saentis panorama','https://commons.wikimedia.org/wiki/Special:FilePath/S%C3%A4ntis%20von%20der%20Schw%C3%A4galp.jpg'],
 ['bregenzerwald road','https://commons.wikimedia.org/wiki/Special:FilePath/Bregenzerwald%20Bezau.jpg'],
 ['furkajoch pass road','https://commons.wikimedia.org/wiki/Special:FilePath/Furkajoch.jpg'],
 ['faschina pass','https://commons.wikimedia.org/wiki/Special:FilePath/Faschinajoch.jpg'],
 ['montafon valley','https://commons.wikimedia.org/wiki/Special:FilePath/Montafon%20panorama.jpg'],
 ['hamburg travemuende bay','https://commons.wikimedia.org/wiki/Special:FilePath/Travem%C3%BCnde%20Strand.jpg'],
 ['old holstein roads','https://commons.wikimedia.org/wiki/Special:FilePath/Holsteinische%20Schweiz%20Pl%C3%B6ner%20See.jpg'],
 ['lübeck old road','https://commons.wikimedia.org/wiki/Special:FilePath/Holstentor%20L%C3%BCbeck.jpg'],
 ['lubeck old road','https://commons.wikimedia.org/wiki/Special:FilePath/Holstentor%20L%C3%BCbeck.jpg'],
 ['eutin lake road','https://commons.wikimedia.org/wiki/Special:FilePath/Eutin%20Schloss.jpg'],
 ['plon lake road','https://commons.wikimedia.org/wiki/Special:FilePath/Pl%C3%B6ner%20See.jpg'],
 ['schlei fjord road','https://commons.wikimedia.org/wiki/Special:FilePath/Schlei%20Kappeln.jpg'],
 ['kiel fjord road','https://commons.wikimedia.org/wiki/Special:FilePath/Kieler%20F%C3%B6rde.jpg'],
 ['laboe coast road','https://commons.wikimedia.org/wiki/Special:FilePath/Laboe%20Marine-Ehrenmal.jpg'],
 ['fehmarn sound bridge','https://commons.wikimedia.org/wiki/Special:FilePath/Fehmarnsundbr%C3%BCcke.jpg'],
 ['ratzeburg lake road','https://commons.wikimedia.org/wiki/Special:FilePath/Ratzeburger%20See.jpg'],
 ['schaalsee lake road','https://commons.wikimedia.org/wiki/Special:FilePath/Schaalsee%20See.jpg'],
 ['spreewald canal road','https://commons.wikimedia.org/wiki/Special:FilePath/Spreewaldkanal%20near%20L%C3%BCbbenau.jpg'],
 ['rheinsberg palace lake','https://commons.wikimedia.org/wiki/Special:FilePath/Rheinsberg%20Schloss%20und%20Park%20asv2024-03%20img04.jpg'],
 ['maerkische schweiz lake','https://commons.wikimedia.org/wiki/Special:FilePath/M%C3%A4rkische%20Schweiz%20-%20Scherm%C3%BCtzelsee.jpg'],
 ['flaming castle road','https://commons.wikimedia.org/wiki/Special:FilePath/Burg%20Rabenstein%20Fl%C3%A4ming.jpg'],
 ['chevreuse valley road','https://commons.wikimedia.org/wiki/Special:FilePath/Ch%C3%A2teau%20de%20la%20Madeleine%20Chevreuse.jpg'],
 ['vexin seine cliffs','https://commons.wikimedia.org/wiki/Special:FilePath/La%20Roche-Guyon%2C%20le%20ch%C3%A2teau.jpg'],
 ['fontainebleau forest road','https://commons.wikimedia.org/wiki/Special:FilePath/For%C3%AAt%20de%20Fontainebleau.jpg'],
 ['hakone skyline road','https://upload.wikimedia.org/wikipedia/commons/b/ba/Hakone_Turnpike_20140412-1.jpg'],
 ['lake ashi fuji road','https://commons.wikimedia.org/wiki/Special:FilePath/Lake%20Ashi%20and%20Mount%20Fuji.jpg'],
 ['okutama lake road','https://commons.wikimedia.org/wiki/Special:FilePath/Lake%20Okutama.jpg'],
 ['nikko irohazaka road','https://commons.wikimedia.org/wiki/Special:FilePath/Irohazaka%20Road.jpg'],
 ['izu coast road','https://commons.wikimedia.org/wiki/Special:FilePath/Jogasaki%20Coast%2001.jpg'],
 ['vercors balcony road','https://upload.wikimedia.org/wikipedia/commons/6/60/Vercors_001.jpg'],
 ['ardeche gorge road','https://commons.wikimedia.org/wiki/Special:FilePath/Pont%20d%27Arc%20in%20Ard%C3%A8che%20Gorges.jpg'],
 ['beaujolais vineyard road','https://commons.wikimedia.org/wiki/Special:FilePath/Beaujolais%20Vineyards.jpg']
);

function mediaFor(text,salt=0){const q=slug(String(text||'')); if(!q) return ''; const blocked=new Set(['pass','alpine','mountain','coast','beach','lake','forest','river','road','castle','ocean','default']); const scored=PHOTO_BANK.map(([k,u])=>{const key=slug(k); if(!key||blocked.has(key)) return null; let score=0; if(q===key) score=1000; else if(q.includes(key)) score=700+key.length; else if(key.includes(q)&&q.length>4) score=500+q.length; return score?{key,u,score}:null;}).filter(Boolean).sort((a,b)=>b.score-a.score||hash(q+a.key)-hash(q+b.key)); if(!scored.length) return ''; const top=scored.filter(x=>x.score===scored[0].score); return top[(hash(q)+salt)%top.length].u;}

function directMediaCandidates(parts){
  const terms=(Array.isArray(parts)?parts:[parts]).flat().filter(Boolean).map(x=>cleanMediaQuery(String(x))).filter(Boolean);
  const hay=slug(terms.join(' '));
  if(!hay) return [];
  const generic=new Set(['pass','alpine','mountain','coast','beach','lake','forest','river','road','castle','ocean','default']);
  const hits=[];
  for(const [key,url] of PHOTO_BANK){
    const k=slug(key);
    if(!k || generic.has(k) || bannedImageTerms.test(key) || bannedImageTerms.test(url)) continue;
    if(hay===k || hay.includes(k) || terms.some(t=>slug(t)===k || slug(t).includes(k))){
      if(!hits.find(h=>h.url===url)) hits.push({key:k,url,score:k.length});
    }
  }
  hits.sort((a,b)=>b.score-a.score || a.url.localeCompare(b.url));
  return hits.map(h=>h.url);
}
function bestDirectMedia(parts,salt=0){
  const hits=directMediaCandidates(parts);
  return hits.length?hits[Math.abs(salt)%hits.length]:'';
}
function regionalPhotoFallback(text,salt=0){const q=slug(String(text||'')); const banks=[[/kiel|laboe|eckern|schlei|plon|ploen|eutin|holstein|travem|lubeck|hamburg|heide|elbe|wismar|rostock|baltic|ostsee/i,['https://commons.wikimedia.org/wiki/Special:FilePath/Kieler%20F%C3%B6rde.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Travem%C3%BCnde%20Strand.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Holsteinische%20Schweiz%20Pl%C3%B6ner%20See.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/L%C3%BCneburger%20Heide%20NSG%20Wilseder%20Berg.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Schlei%20Kappeln.jpg']], [/furka|grimsel|susten|gotthard|tremola|nufenen|oberalp|lukmanier|brunig|bruenig|glauben|entlebuch|santis|appenzell|zurich|zuerich|altdorf|innertkirchen|realp|klausen|jura|staffelgg|passwang|solothurn/i,['https://commons.wikimedia.org/wiki/Special:FilePath/Furkapass%20westside.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Grimsel%20Pass%20road.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Sustenpassstrasse.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Tremola%20Gotthardpass.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Solothurn%20Aare.jpg']], [/bregenzerwald|furkajoch|faschina|montafon|vorarlberg|silvretta/i,['https://commons.wikimedia.org/wiki/Special:FilePath/Bregenzerwald%20Bezau.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Furkajoch.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Montafon%20panorama.jpg']], [/berlin|spreewald|rheinsberg|maerkische|markische|oderbruch|flaeming|flaming|brandenburg/i,['https://commons.wikimedia.org/wiki/Special:FilePath/Spreewaldkanal%20near%20L%C3%BCbbenau.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/M%C3%A4rkische%20Schweiz%20-%20Scherm%C3%BCtzelsee.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Rheinsberg%20Schloss%20und%20Park%20asv2024-03%20img04.jpg']], [/paris|chevreuse|vexin|fontainebleau|chantilly|champagne/i,['https://commons.wikimedia.org/wiki/Special:FilePath/Ch%C3%A2teau%20de%20la%20Madeleine%20Chevreuse.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/For%C3%AAt%20de%20Fontainebleau.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Ch%C3%A2teau%20de%20Chantilly%20from%20the%20air.jpg']], [/tokyo|hakone|fuji|izu|okutama|nikko|chichibu/i,['https://commons.wikimedia.org/wiki/Special:FilePath/Lake%20Ashi%20and%20Mount%20Fuji.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Mount%20Fuji%20from%20Lake%20Kawaguchi.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Hakone%20Turnpike.jpg']], [/lyon|vercors|ardeche|beaujolais|pilat/i,['https://upload.wikimedia.org/wikipedia/commons/6/60/Vercors_001.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Gorges%20de%20l%27Ard%C3%A8che.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Vignoble%20du%20Beaujolais.jpg']], [/new-york|hudson|catskill|bear-mountain/i,['https://commons.wikimedia.org/wiki/Special:FilePath/Bear%20Mountain%20Bridge%20and%20Hudson%20River.jpg','https://commons.wikimedia.org/wiki/Special:FilePath/Catskill%20Mountains%20from%20Overlook%20Mountain.jpg']]]; for(const [re,urls] of banks){if(re.test(q)) return urls[(hash(q)+salt)%urls.length];} return '';}
function directOrSearch(parts, fallback, salt=0){
  const q=cleanMediaQuery((Array.isArray(parts)?parts:[parts]).flat().filter(Boolean).join(' ')) || cleanMediaQuery(fallback||'scenic motorcycle road');
  const directs=directMediaCandidates(parts).filter(Boolean);
  const rotated=directs.length?directs.slice(Math.abs(salt)%directs.length).concat(directs.slice(0,Math.abs(salt)%directs.length)):[];
  const fallbackPhotos=[0,1,2,3].map(n=>regionalPhotoFallback(q||fallback,Number(salt||0)+n)).filter(Boolean);
  const all=[...rotated.slice(0,8),...fallbackPhotos,'commons-search:'+q].filter(Boolean).filter(x=>!bannedImageTerms.test(x));
  return [...new Set(all)].join('||');
}
function generatedArt(text){const safe=String(text||'CurveScout').replace(/[<>&]/g,''); return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 800'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='#071011'/><stop offset='.25' stop-color='#ff102f'/><stop offset='.62' stop-color='#ff7a18'/><stop offset='1' stop-color='#2a0307'/></linearGradient></defs><rect width='1200' height='800' fill='#071011'/><path d='M-80 640 C 190 470, 350 660, 560 420 S 920 190, 1280 300' stroke='url(#g)' stroke-width='84' fill='none' stroke-linecap='round'/><path d='M-40 690 C 220 530, 390 650, 640 460 S 930 250, 1240 360' stroke='#071011' stroke-width='14' fill='none' stroke-linecap='round' stroke-dasharray='6 44'/><text x='54' y='112' font-family='Arial Narrow,Arial' font-size='64' fill='#fff7e6' font-weight='900'>${safe}</text></svg>`)}`;}
window.generatedArt=generatedArt;
function photoAttrs(src, alt, query='', eager=false){
  const parts=splitMediaList(src);
  const searchList=[...parts.filter(isSearchPhoto).map(x=>photoQueryFrom(x,'')),query||alt||'CurveScout scenic road'].filter(Boolean).map(cleanMediaQuery).filter(Boolean);
  const directList=parts.filter(x=>usableImageUrl(x)).filter((x,i,a)=>a.indexOf(x)===i);
  const ph=helmetFallback();
  // v1.4: show the best route-specific open-media candidate immediately, then keep retrying filtered open-photo searches in the background.
  const initial=directList[0]||ph;
  const initialClass=directList[0]?'loadingPhoto mediaPending':'photoFallback mediaPending';
  const loading=eager?'eager':'lazy'; const fetch=eager?'high':'auto';
  return `src="${esc(initial)}" data-photo-src="${esc(directList.join('||'))}" data-media-query="${esc(searchList.join('||'))}" data-photo-attempts="0" class="${initialClass}" loading="${loading}" decoding="async" fetchpriority="${fetch}" onload="if(this.src && !this.src.includes('curvescout-helmet') && !this.src.startsWith('data:image')){this.classList.remove('loadingPhoto','photoFallback','mediaPending');this.classList.add('loadedPhoto');this.dataset.loaded='1';this.setAttribute('data-audited-photo','1');}" onerror="this.dataset.loaded='';this.classList.add('photoFallback','mediaPending');this.src=document.querySelector('.helmetWatermark')?.src||window.generatedArt(this.alt||'CurveScout');window.CurveScoutImageRetry&&window.CurveScoutImageRetry(this)" alt="${esc(alt)}"`;
}
function warmPhotoQueue(route){const queries=[]; const push=(src,q)=>{const direct=directPhoto(src); if(direct) queries.push({direct,q}); else if(q) queries.push({direct:'',q});}; push(routePhoto(route,0), photoQueriesFor(route,route,route.title).join('||')); (route.waypoints||[]).slice(0,10).forEach((w,i)=>push(waypointPhoto(w,route,i),photoQueriesFor(w,route,w.name).join('||'))); (route.sections||[]).slice(0,8).forEach((sec,i)=>push(sectionPhoto(sec,route,i),photoQueriesFor(sec,route,sec.from+' '+sec.to).join('||'))); queries.slice(0,18).forEach(item=>{ if(item.direct){const im=new Image(); im.decoding='async'; im.src=item.direct;} else {String(item.q||'').split('||').slice(0,2).forEach(q=>commonsImage(q));} });}
function regionMediaTerms(r){return [r?.title,r?.region,r?.hero,r?.photoQuery,r?.source?.label,...(r?.aliases||[]),...(r?.waypoints||[]).map(w=>w.name),...(r?.sections||[]).map(x=>x.from+' '+x.to)].filter(Boolean).join(' ');}
function routePhoto(r,salt=0){
  const explicit=splitMediaList([r?.photo, r?.hero, ...(r?.imagePool||[])].filter(Boolean).join('||')).filter(isDirectImageUrl);
  const pool=[r?.photo,r?.title,r?.hero,r?.photoQuery,r?.region,...(r?.imagePool||[]),...(r?.mediaQueries||[]),...(r?.aliases||[]).slice(0,5),...(r?.waypoints||[]).slice(0,7).map(w=>w.wiki||w.name)].filter(Boolean);
  const rest=directOrSearch(pool,r?.title||'scenic road trip',salt);
  return [...new Set([...explicit, ...splitMediaList(rest)])].join('||');
}
function waypointPhoto(w,r,salt=0){
  const explicit=splitMediaList([w?.photo,w?.hero,w?.wiki].filter(Boolean).join('||')).filter(isDirectImageUrl);
  const pool=[w?.photo,w?.wiki,w?.photoQuery,w?.name,r?.region,r?.title,...photoQueriesFor(w,r,w?.name||r?.title||'waypoint')].filter(Boolean);
  const rest=directOrSearch(pool,w?.name||r?.title||'waypoint',salt);
  return [...new Set([...explicit, ...splitMediaList(rest)])].join('||');
}
function sectionPhoto(sec,r,salt=0){
  const explicit=splitMediaList([sec?.photo,sec?.hero].filter(Boolean).join('||')).filter(isDirectImageUrl);
  const pool=[sec?.photo,sec?.photoQuery,sec?.from,sec?.to,sec?.type,r?.region,r?.title,...photoQueriesFor(sec,r,[sec?.from,sec?.to,sec?.type,r?.region].filter(Boolean).join(' '))].filter(Boolean);
  const rest=directOrSearch(pool,[sec?.from,sec?.to,r?.region].filter(Boolean).join(' '),salt);
  return [...new Set([...explicit, ...splitMediaList(rest)])].join('||');
}
function preloadUrl(url){ if(!url || isSearchPhoto(url) || !imageResultAllowed('',url) || badMediaUrls.has(String(url).split('?')[0])) return; const im=new Image(); im.decoding='async'; im.loading='eager'; im.onerror=()=>badMediaUrls.add(String(url).split('?')[0]); im.src=url; }
function prefetchTripMedia(r){
  if(!r) return;
  const jobs=[routePhoto(r,0),routePhoto(r,1),routePhoto(r,2),...(r.waypoints||[]).map((w,i)=>waypointPhoto(w,r,i)),...(r.sections||[]).map((sec,i)=>sectionPhoto(sec,r,i))].filter(Boolean);
  const run=()=>jobs.slice(0,42).forEach(src=>{
    for(const part of splitMediaList(src)){
      if(isSearchPhoto(part)){ const q=photoQueryFrom(part,''); if(q) commonsSearchImages(q,4).then(list=>list.forEach(preloadUrl)).catch(()=>{}); }
      else preloadUrl(part);
    }
  });
  setTimeout(run,0);
}
function imgAttrs(query, alt, salt=0){return photoAttrs('',alt,query||mediaFor(query,salt));}
function probePhoto(url){return new Promise(resolve=>{let done=false; const finish=v=>{if(done)return; done=true; resolve(Boolean(v));}; const im=new Image(); im.decoding='async'; const t=setTimeout(()=>finish(false),6500); im.onload=()=>{clearTimeout(t); finish(Boolean(im.naturalWidth>90&&im.naturalHeight>60));}; im.onerror=()=>{clearTimeout(t); finish(false);}; im.src=url;});}
function takeUnused(url, allowDuplicate=false){
  if(!url || bannedImageTerms.test(url) || !usableImageUrl(url)) return '';
  const key=String(url).split('?')[0];
  if(!allowDuplicate && usedMediaUrls.has(key)) return '';
  usedMediaUrls.add(key); return url;
}
function setImageReal(img,url,allowDuplicate=false){
  const picked=takeUnused(url,allowDuplicate); if(!picked) return false;
  img.src=picked; img.classList.remove('loadingPhoto','photoFallback','mediaPending'); img.classList.add('loadedPhoto'); img.setAttribute('data-audited-photo','1'); img.dataset.loaded='1'; updateMediaStatus(); return true;
}
async function loadBestImage(img){
  const directList=splitMediaList(img.getAttribute('data-photo-src')).filter(usableImageUrl);
  const queries=String(img.getAttribute('data-media-query')||'').split('||').map(x=>cleanMediaQuery(x)).filter(Boolean);
  const salt=hash((img.alt||'')+queries.join('|'));
  // Speed first: apply the best curated/direct candidate immediately. If it fails, onerror puts it back into the retry queue.
  for(const u of directList){ if(setImageReal(img,u,false)) return true; }
  // Then use fast Wikimedia search results directly. We do not probe every candidate first because that made photos appear too slowly.
  for(const q of queries){
    for(const v of mediaVariants(q).slice(0,5)){
      const urls=await commonsSearchImages(v,10);
      for(const u of urls){ if(setImageReal(img,u,false)) return true; }
    }
  }
  // Wikipedia summary images are useful for known places, but only after route-specific Commons attempts.
  for(const q of queries.slice(0,6)){ const u=await wikiSummaryImage(q); if(u && setImageReal(img,u,false)) return true; }
  // Last direct regional fallback before another retry cycle.
  for(const q of queries.slice(0,8)){ const fallback=regionalPhotoFallback(q,salt); if(fallback && setImageReal(img,fallback,false)) return true; }
  return false;
}

function hydrateImages(root=document, urgent=false){
  const imgs=[...root.querySelectorAll('img[data-photo-src],img[data-media-query]')].filter(img=>urgent || img.dataset.loaded!=='1' || img.classList.contains('photoFallback') || img.classList.contains('mediaPending'));
  const run=()=>imgs.forEach((img)=>{
    if(img.dataset.loadingNow==='1' && !urgent) return;
    img.dataset.loadingNow='1'; img.classList.add('loadingPhoto','mediaPending');
    loadBestImage(img).then(ok=>{img.dataset.loadingNow='0'; if(!ok){ img.classList.add('photoFallback','mediaPending'); img.src=helmetFallback(); scheduleImageRetry(img); }}).catch(()=>{img.dataset.loadingNow='0'; img.classList.add('photoFallback','mediaPending'); img.src=helmetFallback(); scheduleImageRetry(img);});
  });
  setTimeout(run, urgent?0:80);
  return root;
}
function scheduleImageRetry(img){
  const attempts=Number(img.dataset.photoAttempts||0); img.dataset.photoAttempts=String(attempts+1);
  const delay=Math.min(45000, 1600 + attempts*2200);
  setTimeout(()=>{ if(!img.isConnected) return; if(img.classList.contains('loadedPhoto')) return; img.dataset.loaded=''; hydrateImages(img.parentElement||document,true); },delay);
}
if(typeof window!=='undefined'){window.CurveScoutImageRetry=(img)=>{try{scheduleImageRetry(img);}catch(e){}};}
function warmRouteMedia(r){
  if(!r)return; const srcs=[routePhoto(r,0),routePhoto(r,1),...(r.waypoints||[]).map((w,i)=>waypointPhoto(w,r,i)),...(r.sections||[]).map((sec,i)=>sectionPhoto(sec,r,i))];
  srcs.slice(0,72).forEach(item=>{for(const part of splitMediaList(item)){const d=directPhoto(part); if(d){preloadUrl(d);} else if(isSearchPhoto(part)){const qs=photoQueryFrom(part,'').split('||').slice(0,4); qs.forEach(q=>commonsSearchImages(q,3).then(list=>list.forEach(preloadUrl)).catch(()=>{}));}}});
}
function mediaSweep(){
  const root=document.querySelector('.app')||document;
  const pending=[...root.querySelectorAll('img.photoFallback,img.mediaPending,img.loadingPhoto')].slice(0,120);
  pending.forEach(img=>{img.dataset.loaded=''; hydrateImages(img.parentElement||root,true);});
  updateMediaStatus();
}
function mediaProgress(){const imgs=[...document.querySelectorAll('img[data-media-query]')]; const loaded=imgs.filter(img=>img.getAttribute('data-audited-photo')==='1'||img.classList.contains('loadedPhoto')).length; return {loaded,total:imgs.length};}
function updateMediaStatus(){const p=mediaProgress(); document.querySelectorAll('[data-media-progress]').forEach(el=>{el.textContent=p.total?`Open photos ${p.loaded}/${p.total}`:'Open photos loading';});}
function cleanStory(r){const s=String(r.story||r.slogan||'').replace(/\s+/g,' ').trim(); const words=s.split(' '); return words.slice(0,92).join(' ')+(words.length>92?'…':'');}
function normalizedRoute(r){if(!r) return r; if(!Array.isArray(r.sections)) r.sections=[]; if(!Array.isArray(r.waypoints)) r.waypoints=[]; if(!Array.isArray(r.safetyMarkers)) r.safetyMarkers=[]; if(!r.breakdown) r.breakdown={scenic:r.score||80,flow:78,technical:70,surface:80,trafficEscape:80,risk:38}; if(!r.photo) r.photo=mediaFor(r.title+' '+r.region)||'commons-search:'+cleanMediaQuery([r.title,r.region,r.hero].filter(Boolean).join(' ')); if(!Array.isArray(r.mediaQueries)) r.mediaQueries=[r.title,r.region,r.hero].filter(Boolean); return r;}
ROUTES.forEach(normalizedRoute);
function sectionAdvice(s,a,b){const type=String(s.type||'scenic'); const from=s.from||a?.name||'this point', to=s.to||b?.name||'the next point'; const km=s.km?` · ${s.km} km`:''; if(type.includes('transfer')||type.includes('connector')) return `${from} → ${to}${km}. Settle the ride here: clear lane choice, calm inputs, posted limits and no wasted overtakes. The goal is to arrive at the good road fresh, not to win the commute.`; if(type.includes('serpentine')) return `${from} → ${to}${km}. Technical road. Look through the bends, expect wide vehicles and cyclists, keep space from the centre line and treat shade as suspicious until proven dry.`; if(type.includes('fast')) return `${from} → ${to}${km}. Open rhythm, but not a licence to rush. Villages, junctions and speed-control areas break the flow; smooth timing beats a heroic burst.`; if(type.includes('coast')) return `${from} → ${to}${km}. Ride the waterline for light and air. Wind, tourists, parked cars and photo traffic are the hazards, so pick one proper stop and keep the rest flowing.`; if(type.includes('forest')) return `${from} → ${to}${km}. Good shade and quiet roads. Watch leaves, damp edges, deer, farm traffic and gravel dragged out of driveways.`; return `${from} → ${to}${km}. This is the riding section: read the surface, look far through bends, use legal pull-offs for photos and keep enough margin for the next village.`;}
function waypointAdvice(w,route=null,index=0){
  return richWaypointAdvice(w,index,route||state.selected);
}
function nearbySectionForWaypoint(r,i){
  const sections=r?.sections||[];
  return sections[Math.max(0,Math.min(sections.length-1,i))] || sections[Math.max(0,i-1)] || null;
}
function roadCharacterPhrase(kind){
  const map={
    start:'clean exit, fuel range and traffic rhythm',
    finish:'calm return, fatigue check and tidy local roads',
    fuel:'range reset, visor clean and the next section planned',
    food:'proper pause, water, light food and weather decision',
    sleep:'daylight arrival, luggage discipline and no tired heroics',
    pass:'temperature, buses, bicycles, damp shade and centre-line traffic',
    high:'visibility, wind, surface temperature and a photo only if parking is easy',
    swim:'legal access, secure kit, warm restart and no riding distracted',
    sight:'legal parking, one clear look and a clean rejoin',
    photo:'safe pull-off, quick camera stop and patient return to the lane',
    scenic:'line of sight, village entries, surface colour and road flow',
    transfer:'efficient positioning, posted limits and attention saved for the core'
  };
  return map[kind] || map.scenic;
}
function nextSectionForWaypoint(r,idx){const secs=robustRoadbookSections(r||{}); return secs[Math.max(0,Math.min(idx,secs.length-1))]||null;}
function namesByKind(r,kinds,limit=3){const set=new Set(kinds); return (r?.waypoints||[]).filter(w=>set.has(w.kind)).map(w=>w.name).filter(Boolean).slice(0,limit);}
function nearestNames(r,idx,kinds,limit=2){const set=new Set(kinds); const wps=r?.waypoints||[]; return wps.map((w,j)=>({w,j,d:Math.abs(j-idx)})).filter(x=>set.has(x.w.kind)).sort((a,b)=>a.d-b.d).map(x=>x.w.name).slice(0,limit);}
function compactWaypointAdvice(w,i=0,r=state.selected){
  const kind=w?.kind||'scenic'; const name=w?.name||`checkpoint ${i+1}`; const alt=Number.isFinite(Number(w?.alt))?` · ${Math.round(w.alt)} m`:''; const next=(r?.waypoints||[])[i+1];
  const map={
    start:'Start cleanly: fuel range set, visor clear, route loaded, no heroics in local traffic.',
    finish:'Finish the ride with the same discipline as the first kilometre. Familiar streets still bite when tired.',
    fuel:'Fuel and reset here. Drink water, clean the visor and leave with the next road section already planned.',
    food:'Use this as a proper pause: light food, water, weather check, and a calm decision on the remaining route.',
    sleep:'Overnight anchor. Arrive in daylight, park neatly and do not turn a good ride into a tired arrival.',
    pass:'Pass checkpoint. Check temperature, cloud, buses, cyclists, damp shade and official road status before committing.',
    high:'High point or view road. Stop only where parking is legal and easy; otherwise keep the rhythm.',
    swim:'Water stop. Swim only with legal access, secured kit and enough time to restart warm and focused.',
    sight:'Short sight stop. Park cleanly, take the look, then rejoin without blocking locals or traffic.',
    photo:'Photo point. One safe pull-off beats five risky half-stops on the shoulder.',
    transfer:'Positioning point. Keep it tidy and save attention for the scenic core.',
    scenic:'Checkpoint for the good road. Look ahead, read the surface and keep a calm line.'
  };
  return `${name}${alt}. ${map[kind]||map.scenic}${next?` Next useful check: ${next.name}.`:''}`;
}
function waypointRoleLabel(kind){
  const map={start:'start / exit',finish:'finish / return',fuel:'fuel anchor',food:'food stop',sleep:'overnight base',pass:'pass check',high:'high point',swim:'swim / water stop',sight:'sight',photo:'photo stop',scenic:'scenic checkpoint',transfer:'transfer checkpoint'};
  return map[kind]||'checkpoint';
}
function compactWaypointAdvice(w,i=0,r=state.selected){
  const kind=w?.kind||'scenic';
  const next=(r?.waypoints||[])[i+1];
  const name=w?.name||`checkpoint ${i+1}`;
  const alt=Number.isFinite(Number(w?.alt))?` · ${Math.round(w.alt)} m`:'';
  const focus={
    start:'Leave cleanly. Fuel, visor, gloves, route and weather should already be settled before the first junction.',
    finish:'End the ride deliberately. The last local kilometres still count; park, hydrate and note what you would shorten next time.',
    fuel:'Range reset. Fill early, clean the visor and decide whether the next section still fits the weather and daylight.',
    food:'Real pause. Eat light, drink water and use the stop to decide: continue, shorten or save the road for another day.',
    sleep:'Overnight anchor. Arrive before fatigue owns the decision, park calmly and keep luggage out of the road routine.',
    pass:'Pass checkpoint. Check temperature, cloud, traffic, buses and official road status before committing.',
    high:'High point. Wind, shade and cold surface matter more than the view; stop only where parking is clearly safe.',
    swim:'Water stop. Swim only where access is legal, kit is secure and you can restart warm and focused.',
    sight:'Short stop. Park neatly, give locals space and treat the rejoin as part of the ride.',
    photo:'Photo stop. One safe pull-off beats five half-stops on the shoulder.',
    scenic:'Road-reading point. Look ahead, settle the bike and use it to judge traffic, surface and weather.',
    transfer:'Positioning point. Keep the transfer tidy and save attention for the riding core.'
  }[kind] || 'Use this point to reset attention before the next road section.';
  return `${name}${alt}. ${focus}${next?` Next section aims for ${next.name}.`:''}`;
}

function shortRoadbookText(text,max=120){
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  const n=Number(max)||120;
  if(clean.length<=n) return clean;
  const cut=clean.slice(0,n).replace(/\s+\S*$/,'').trim();
  return (cut||clean.slice(0,n)).replace(/[,.:-]+$/,'')+'…';
}

function richWaypointAdvice(w,i=0,r=state.selected){
  return compactWaypointAdvice(w,i,r);
}
function sectionTypeName(type){
  const map={transfer:'transfer',connector:'connector',scenic:'scenic road',serpentine:'serpentines',fast:'faster connector',forest:'forest road',coast:'coast / waterline',water:'waterline'};
  return map[String(type||'scenic').toLowerCase()]||'road section';
}
function sectionStopHint(s,i=0,a=null,b=null,r=state.selected){
  const wps=r?.waypoints||[];
  const window=wps.slice(Math.max(0,i-1),Math.min(wps.length,i+4));
  const fuel=window.find(w=>w.kind==='fuel');
  const food=window.find(w=>w.kind==='food');
  const swim=window.find(w=>w.kind==='swim');
  const sight=window.find(w=>['sight','photo','pass','high'].includes(w.kind));
  const bits=[];
  if(fuel) bits.push(`Fuel: ${fuel.name}.`);
  if(food) bits.push(`Food/rest: ${food.name}.`);
  if(swim) bits.push(`Water: ${swim.name}; check access and keep riding kit secure.`);
  if(sight) bits.push(`Worth a pause near ${sight.name} if parking is legal and easy.`);
  return bits.join(' ');
}
function richSectionAdvice(s,i=0,a=null,b=null,r=state.selected){
  const type=String(s?.type||'scenic').toLowerCase();
  const km=Number(s?.km)?`${Math.round(s.km)} km`:'';
  const from=s?.from||a?.name||'this checkpoint';
  const to=s?.to||b?.name||'the next checkpoint';
  const base={
    transfer:'Use this as efficient positioning, not as the ride itself. Leave the urban edge cleanly, keep lane choices simple and avoid risky overtakes before the proper road starts.',
    connector:'This connector keeps the ride coherent. Watch junction density, changing limits and impatient local traffic; ride it smoothly so the scenic core still feels fresh.',
    scenic:'This is where the ride should earn its place. Let the scenery and bend rhythm set the pace, use legal pull-offs for views, and keep margin for villages, cyclists and farm traffic.',
    serpentine:'Technical section. Look deep through the bends, expect buses or cars cutting the centre line, and treat shade, gravel and repairs as active hazards until the surface proves otherwise.',
    fast:'Open rhythm. Average speed can creep up here, so use the speed band as a warning: village entries, tractors, junctions and controls interrupt the flow.',
    forest:'Forest shade changes grip quickly. Leaves, damp edges, wildlife, loose gravel and low sun are the real variables; keep the bike settled and avoid late braking under trees.',
    coast:'Waterline riding brings light, wind and tourist traffic. Choose one proper photo or swim stop, then keep the rest tidy rather than drifting from lay-by to lay-by.',
    water:'Ride the water section for air and reset value. Expect pedestrians, parking manoeuvres, wet patches and sudden stops near viewpoints.'
  }[type] || 'Ride this section for road character, not just distance. Read surface colour, sight lines, village entries and traffic rhythm.';
  const opening=/pass|high|alpine|mount|serpentine/i.test(`${type} ${from} ${to} ${r?.title||''}`)?' If this section touches a pass or high road, check the official opening/status source before leaving.':'';
  const weather=routeKind(r)==='alpine'?'cloud base, wind and temperature':'rain, wind and low sun';
  return `${from} → ${to}${km?` · ${km}`:''}. ${base} Check ${weather}, posted limits and road-status warnings before committing.${opening} ${sectionStopHint(s,i,a,b,r)}`;
}
function sectionContextItems(s,i=0,a=null,b=null,r=state.selected){
  const wps=r?.waypoints||[];
  const window=wps.slice(Math.max(0,i-1),Math.min(wps.length,i+4));
  const findKind=(ks)=>window.find(w=>ks.includes(w.kind)) || wps.find(w=>ks.includes(w.kind));
  const safety=(r?.safetyMarkers||[]);
  const speed=safety.find(x=>/speed|control|camera/i.test(x.type||''));
  const risk=safety.find(x=>!/speed|control|camera/i.test(x.type||''));
  const status=(r?.roadStatus||[])[0];
  const pass=findKind(['pass','high']);
  const fuel=findKind(['fuel']);
  const food=findKind(['food']);
  const sleep=findKind(['sleep']);
  const swim=findKind(['swim']);
  const sight=findKind(['sight','photo','pass','high','scenic']);
  const items=[];
  items.push({icon:ICON.weather,label:'Weather',text:routeKind(r)==='alpine'?'cloud base, wind, cold shade':'rain, wind, low sun',url:weatherLink(r)});
  items.push({icon:ICON.traffic,label:'Traffic',text:/transfer|connector/i.test(s?.type||'')?'city edge, junctions, commuters':'tourists, cyclists, villages',url:googleTrafficLink(r)});
  items.push({icon:ICON.danger,label:'Safety',text:risk?.note||'surface, shade, wildlife, junctions',url:nearbyLink(a||b,'hazards')});
  items.push({icon:ICON.status,label:'Road status',text:status?.label||'closures and local restrictions',url:status?.url||'https://www.openstreetmap.org/'});
  if(pass) items.push({icon:ICON.opening,label:'Pass / high road',text:pass.name,url:status?.url||osmPoint(pass)});
  if(speed) items.push({icon:ICON.camera,label:'Speed / control',text:speed.note||speed.type,url:googleTrafficLink(r)});
  if(fuel) items.push({icon:ICON.fuel,label:'Fuel',text:fuel.name,url:osmPoint(fuel)});
  if(food) items.push({icon:ICON.food,label:'Food / rest',text:food.name,url:osmPoint(food)});
  if(sleep) items.push({icon:ICON.sleep,label:'Sleep',text:sleep.name,url:osmPoint(sleep)});
  if(swim) items.push({icon:ICON.swim,label:'Swim / water',text:swim.name,url:osmPoint(swim)});
  if(sight) items.push({icon:ICON.sight,label:'Sight',text:sight.name,url:osmPoint(sight)});
  return items.slice(0,11);
}
function contextCardsHTML(items){
  return `<div class="roadbookContext">${items.map(x=>`<a href="${esc(x.url||'#')}" target="_blank" rel="noopener" title="${esc(x.label+': '+x.text)}"><b>${x.icon} ${esc(x.label)}</b><span>${esc(shortRoadbookText(x.text,58))}</span></a>`).join('')}</div>`;
}
function storyCards(r){const k=routeKind(r); const passCount=(r.waypoints||[]).filter(w=>['pass','high'].includes(w.kind)).length; const speedControls=(r.safetyMarkers||[]).filter(m=>/speed|control|camera/i.test(m.type||'')).length; return [{icon:'🌤️',title:'Best window',text:k==='alpine'?'Early start, stable weather and daylight margin. Afternoon storms and fog can ruin the ride.':k==='coast'?'Avoid peak tourist traffic and watch crosswind. Clear mornings are usually the easy win.':k==='urban'?'Leave before commuter traffic. The ride starts only after the city edge.':'Morning or late afternoon, when traffic drops and light improves the view.'},{icon:'⛽',title:'Fuel plan',text:fuelPlan(r)},{icon:'📷',title:'Scenic reward',text:scenicPlan(r)},{icon:'🚦',title:'Traffic rhythm',text:`Escape score ${r.breakdown?.trafficEscape||80}. Use transfer legs for clean positioning and save attention for the road core.`},{icon:'📸',title:'Camera / speed',text:`${speedControls} speed or control reminders. Posted limits, road signs and local law always win.`},{icon:'⚠️',title:'Risk focus',text:`${passCount} high-road checkpoints. Watch shade, surface, wildlife, tourist traffic and fatigue.`}];}
function routeKind(r){const s=routeLabel(r); if(/furka|grimsel|susten|pass|alpine|dolomit|grossglockner|stelvio|tremola|nufenen|julier|albula|fluela|vercors|harz|hakone|fuji|izu|mount|rocky|beartooth|troll|galibier|grossglockner/.test(s)) return 'alpine'; if(/coast|ocean|beach|sea|fjord|pacific|atlantic|darss|baltic|cape|island/.test(s)) return 'coast'; if(/berlin|hamburg|london|paris|tokyo|new york|moscow|lyon|hannover/.test(s)) return 'urban'; return 'touring';}
function fuelPlan(r){const fuels=(r.waypoints||[]).filter(w=>w.kind==='fuel').map(w=>w.name); if(fuels.length) return `Use ${shortList(fuels,2)} as the planned range check. Fill before the good road, not after.`; return 'Add a fuel stop before the scenic core. The GPX includes checkpoints; adjust the stop to your tank range.';}
function scenicPlan(r){const scenic=(r.waypoints||[]).filter(w=>['pass','high','photo','sight','swim','scenic'].includes(w.kind)).map(w=>w.name); return scenic.length?`The ride earns itself around ${shortList(scenic,3)}. Stop only where the road gives you safe space.`:'The reward is the road shape: quiet exits, a useful view and a different return line.';}
function shortList(a,n=3){return a.slice(0,n).join(', ')+(a.length>n?'…':'');}
function weatherCodeIcon(code){code=Number(code); if([0,1].includes(code)) return '☀️'; if([2,3].includes(code)) return '⛅'; if([45,48].includes(code)) return '🌫️'; if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return '🌧️'; if([71,73,75,77,85,86].includes(code)) return '❄️'; if([95,96,99].includes(code)) return '⛈️'; return '🌤️';}
function weatherPoint(r){const w=(r.waypoints||[]).find(x=>['pass','high'].includes(x.kind)) || (r.waypoints||[])[Math.floor((r.waypoints||[]).length/2)] || routeCenter(r); return {lat:Number(w.lat),lon:Number(w.lon),name:w.name||'route midpoint'};}
function fallbackWeatherText(r){const k=routeKind(r); return k==='alpine'?'Check cloud base, wind, temperature and storm timing at the high point.':k==='coast'?'Check wind, squalls and wet roads before the exposed sections.':'Check rain, wind, temperature and low sun before leaving.';}
async function fetchRouteWeather(r){const p=weatherPoint(r); const key=[p.lat.toFixed(3),p.lon.toFixed(3)].join(','); if(weatherCache.has(key)) return weatherCache.get(key); const url=`https://api.open-meteo.com/v1/forecast?latitude=${p.lat.toFixed(5)}&longitude=${p.lon.toFixed(5)}&current=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&hourly=precipitation_probability,temperature_2m,wind_speed_10m,weather_code&forecast_days=1&timezone=auto`; const res=await fetchTO(url,8500); if(!res.ok) throw new Error('weather unavailable'); const js=await res.json(); const c=js.current||{}; const rain=(js.hourly?.precipitation_probability||[]).slice(0,8).reduce((m,v)=>Math.max(m,Number(v)||0),0); const temp=Number(c.temperature_2m); const wind=Number(c.wind_speed_10m); const gust=Number(c.wind_gusts_10m); const icon=weatherCodeIcon(c.weather_code); const text=`${icon} ${Number.isFinite(temp)?Math.round(temp)+'°C':'temp check'} · rain ${Math.round(rain)}% · wind ${Number.isFinite(wind)?Math.round(wind):'?'} km/h${Number.isFinite(gust)?' · gust '+Math.round(gust):''} at ${p.name}`; const data={text,icon,temp,rain,wind,gust,point:p}; weatherCache.set(key,data); return data;}
function loadRouteWeather(r){const token=routeCacheKey(r); const placeholder=fallbackWeatherText(r); document.querySelectorAll('[data-weather-live]').forEach(el=>{el.textContent=placeholder;}); fetchRouteWeather(r).then(data=>{if(!state.selected||routeCacheKey(state.selected)!==token) return; document.querySelectorAll('[data-weather-live]').forEach(el=>{el.textContent=data.text;}); document.querySelectorAll('[data-weather-icon]').forEach(el=>{el.textContent=data.icon;});}).catch(()=>{document.querySelectorAll('[data-weather-live]').forEach(el=>{el.textContent=placeholder;});});}
function statusItems(r){const passes=(r.waypoints||[]).filter(w=>['pass','high'].includes(w.kind)); const safety=r.safetyMarkers||[]; const speed=safety.filter(m=>/speed|control|camera/i.test(m.type||'')); const risk=safety.filter(m=>!/speed|control|camera/i.test(m.type||'')); const k=routeKind(r); return [
  {icon:'🛣️',title:'Road status',text:(r.roadStatus&&r.roadStatus[0]?.label)||'Check local road status',href:r.roadStatus&&r.roadStatus[0]?.url},
  {icon:'🌤️',title:'Weather window',text:k==='alpine'?'Cloud base, temperature and storms decide the ride.':k==='coast'?'Wind and rain squalls matter more than average speed.':'Check rain, wind and low sun before leaving.',href:weatherLink(r)},
  {icon:'🚦',title:'Traffic escape',text:`Escape score ${r.breakdown?.trafficEscape||80}. Leave the city cleanly before judging the route.`,href:googleTrafficLink(r)},
  {icon:'📷',title:'Speed / control',text:`${speed.length} mapped reminders in the roadbook. Posted limits always win.`},
  {icon:'⚠️',title:'Risk layer',text:`${risk.length} surface, shade, wildlife or junction reminders.`},
  {icon:'⛰️',title:'High points',text:passes.length?shortList(passes.map(p=>p.name),2):'No major pass; watch flow, villages and sightlines.'}
 ];}

function highPoint(r){const pts=(r.waypoints||[]).filter(w=>Number.isFinite(Number(w.alt))); if(!pts.length) return routeCenter(r); return pts.sort((a,b)=>Number(b.alt)-Number(a.alt))[0];}
function routeWeatherModel(r){const k=routeKind(r); const high=highPoint(r); const alt=Number(high.alt)||0; const baseTemp=k==='alpine'?14:k==='coast'?17:20; const temp=Math.round(baseTemp-Math.max(0,alt-500)/180+((hash(r.title)%7)-3)); const rain=clamp((hash(r.title+'rain')%36)+(k==='alpine'?8:0),0,92); const wind=clamp(8+(hash(r.title+'wind')%28)+(k==='coast'?10:0),4,58); const road=rain>45?'watch damp shade':wind>34?'wind discipline':'dry window'; return {temp,rain,wind,road,source:'model'};}
async function refreshWeather(r){if(!r)return; const key=r.id||r.title; if(state.weatherCache.has(key)){renderConditionBoard(r); return;} const model=routeWeatherModel(r); state.weatherCache.set(key,model); renderConditionBoard(r); const c=highPoint(r); try{const url=`https://api.open-meteo.com/v1/forecast?latitude=${Number(c.lat).toFixed(4)}&longitude=${Number(c.lon).toFixed(4)}&current=temperature_2m,precipitation,wind_speed_10m&forecast_days=1`; const res=await fetchTO(url,6500); if(!res.ok) throw new Error('weather unavailable'); const js=await res.json(); const cur=js.current||{}; state.weatherCache.set(key,{temp:Math.round(cur.temperature_2m??model.temp),rain:Math.round((cur.precipitation??0)*22),wind:Math.round(cur.wind_speed_10m??model.wind),road:(cur.precipitation??0)>0?'wet patches possible':model.road,source:'live'}); if(state.selected && (state.selected.id||state.selected.title)===key) renderConditionBoard(r); }catch(e){}
}
function renderConditionBoard(r){const el=$('conditionBoard'); if(!el||!r)return; const w=state.weatherCache.get(r.id||r.title)||routeWeatherModel(r); const passes=(r.waypoints||[]).filter(x=>['pass','high'].includes(x.kind)).length; const cameras=(r.safetyMarkers||[]).filter(x=>/speed|camera|control/i.test(x.type||'')).length; const risks=(r.safetyMarkers||[]).length; const stops=(r.waypoints||[]).filter(x=>['fuel','food','sleep','swim'].includes(x.kind)).length; const pct=n=>clamp(Number(n)||0,0,100); const tiles=[
 {icon:'🌡️',label:'Temp',value:`${w.temp}°C`,meter:pct((w.temp+5)*2.2),tip:'Temperature context at the route high point or current live weather when available.'},
 {icon:'🌧️',label:'Rain',value:`${pct(w.rain)}%`,meter:pct(w.rain),tip:'Rain / damp-road risk. Re-check live radar before riding.'},
 {icon:'💨',label:'Wind',value:`${w.wind} km/h`,meter:pct(w.wind*1.7),tip:'Wind exposure matters on passes, bridges, coasts and high ridges.'},
 {icon:'🛣️',label:'Road',value:w.road,meter:w.road.includes('dry')?78:48,tip:'Route-road confidence: surface, shade, posted signs and local restrictions still win.'},
 {icon:'⛰️',label:'High points',value:String(passes),meter:passes?80:38,tip:'Passes / high-road anchors in the selected road trip.'},
 {icon:'📷',label:'Control',value:String(cameras),meter:Math.min(100,cameras*28),tip:'Speed/control reminders in the roadbook. These are safety reminders, not evasion tooling.'},
 {icon:'⚠️',label:'Risks',value:String(risks),meter:Math.min(100,risks*20),tip:'Surface, weather, shade, wildlife or junction reminders.'},
 {icon:'🍽️',label:'Stops',value:String(stops),meter:Math.min(100,stops*22),tip:'Fuel, food, swim or sleep anchors available in the roadbook.'}
 ]; el.innerHTML=tiles.map(t=>`<div class="conditionTile" title="${esc(t.tip)}"><div class="conditionTop"><span>${t.icon}</span><b>${esc(t.value)}</b></div><small>${esc(t.label)}</small><i style="--w:${t.meter}%"></i></div>`).join('');}

function weatherLink(r){const c=routeCenter(r); return `https://open-meteo.com/en/docs#latitude=${c.lat.toFixed(4)}&longitude=${c.lon.toFixed(4)}`;}
function googleTrafficLink(r){const c=routeCenter(r); return `https://www.google.com/maps/@${c.lat},${c.lon},10z/data=!5m1!1e1`;}
function routeKmMax(range){range=Number(range)||260; if(range<=120)return 150; if(range<=180)return 220; if(range<=260)return 285; if(range<=420)return 520; return 780;}
function isGeneratedReservoir(r){return /^reservoir-/.test(r?.id||'')||/^local-/.test(r?.id||'')||/local-scout/i.test(r?.qualityTier||r?.routeKind||'');}
function sectionStats(r){const secs=r?.sections||[]; const total=secs.reduce((s,x)=>s+(Number(x.km)||0),0)||Number(r?.km)||1; const transfer=secs.filter(x=>/transfer|connector/i.test(x.type||'')).reduce((s,x)=>s+(Number(x.km)||0),0); const scenic=Math.max(0,total-transfer); const initial=/transfer|connector/i.test(secs[0]?.type||'')?Number(secs[0]?.km)||0:0; const finish=/transfer|connector/i.test(secs.at(-1)?.type||'')?Number(secs.at(-1)?.km)||0:0; return {total,transfer,scenic,ratio:transfer/total,initial,finish};}
function ferrySensitive(r){return /ferry|ferries|faehre|fähre|island|isle|denmark|copenhagen|københavn|north sea|baltic|fjord|schlei|coast/.test(routeLabel(r));}
function kmFitsRange(r,range){const km=Number(r?.km)||0, max=routeKmMax(range); if(km<=0)return true; if(km>max)return false; const st=sectionStats(r); if(Number(range)<=260 && ferrySensitive(r) && km>230)return false; if(Number(range)<=260 && st.ratio>.62 && km>240)return false; if(Number(range)<=260 && (st.initial>90 || st.finish>100))return false; return true;}
function routeThemeKey(r){const stop=new Set(['hamburg','north','german','germany','berlin','paris','london','tokyo','lyon','moscow','new','york','zurich','thalwil','route','roadbook','road','roads','loop','sweep','day','escape','from','and','the','near','local','motorcycle','touring','region']); const toks=slug(r?.title||'').split('-').filter(t=>t.length>2&&!stop.has(t)); return toks.slice(0,6).join('-')||slug(r?.title||r?.id||'route');}
function coordThemeKey(r){return (r?.waypoints||[]).slice(0,9).map(w=>`${Math.round(w.lat*10)/10},${Math.round(w.lon*10)/10}`).join('|');}
function dedupeRoutes(list,base,range){const out=[]; const seen=new Map(); for(const r of list){if(!r)continue; const key=routeThemeKey(r); const geo=coordThemeKey(r); const merged=key+'|'+geo.slice(0,80); const prev=seen.get(merged)||seen.get(key); const quality=(x)=> (Number(x.score)||0) - Math.abs((Number(x.km)||range)-range)/18 - routeCoreDistance(base,x)/30 - (isGeneratedReservoir(x)?18:0) - (ferrySensitive(x)&&Number(range)<=260?8:0); if(!prev){seen.set(merged,r); seen.set(key,r); out.push(r); continue;} if(quality(r)>quality(prev)){const i=out.indexOf(prev); if(i>=0)out[i]=r; seen.set(merged,r); seen.set(key,r);} } return out;}
function localPool(base, range, query){const maxNear=range<=120?140:range<=180?210:range<=260?320:range<=420?560:900; const q=String(query||'').trim(); const exact=ROUTES.filter(r=>samePlaceHit(q,r)&&!isGeneratedReservoir(r)&&kmFitsRange(r,range)); if(exact.length>=12) return dedupeRoutes(exact,base,range); const local=ROUTES.filter(r=>!isGeneratedReservoir(r)&&routeCoreDistance(base,r)<=maxNear&&kmFitsRange(r,range)); return dedupeRoutes([...exact,...local],base,range);}
function scoreRoute(r,base,range,query,i){const near=routeStartDistance(base,r); const km=Number(r.km)||range; const st=sectionStats(r); const rangeFit=Math.max(0,36-Math.abs(km-range)/7); const prox=near<8?48:near<30?42:near<75?34:near<140?24:near<260?10:near<420?0:near<720?-22:-82; const qBoost=samePlaceHit(query,r)?34:0; const style=state.style==='sport'?(r.breakdown?.technical||0)*.11:state.style==='easy'?(100-(r.breakdown?.risk||35))*.12:state.style==='adventure'?(r.breakdown?.scenic||0)*.10:0; const outsideTraffic=(r.breakdown?.trafficEscape||75)*.13; const qualityPenalty=isGeneratedReservoir(r)?28:0; const ferryPenalty=(ferrySensitive(r)&&Number(range)<=260)?22:0; const transferPenalty=(Number(range)<=260?Math.max(0,(st.ratio-.48))*72:Math.max(0,(st.ratio-.58))*32)+Math.max(0,st.initial-60)/3+Math.max(0,st.finish-72)/4; const scenicBonus=Math.min(14,st.scenic/18); return (r.score||75)+prox+rangeFit+qBoost+style+outsideTraffic+scenicBonus-qualityPenalty-ferryPenalty-transferPenalty-i*.001;}

function cleanStartLabel(label){return String(label||'Selected start').split(',').slice(0,2).join(', ').replace(/\s+/g,' ').trim()||'Selected start';}
function cloneRoute(r){return JSON.parse(JSON.stringify(r));}
function pointValid(p){return p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon));}
function isHomePinnedPoint(w){const n=String(w?.name||'').toLowerCase(); const k=String(w?.kind||'').toLowerCase(); return k==='start'||k==='finish'||/\b(thalwil|home base|finish|start)\b/.test(n);}
function routeWaypoints(r){return (r?.waypoints||[]).filter(pointValid).map(w=>({...w,lat:Number(w.lat),lon:Number(w.lon)}));}
function nameKey(n){return slug(n||'').replace(/-entry-point|-exit-point|-start|-finish/g,'');}
function waypointMap(wps){const m=new Map(); for(const w of wps){m.set(nameKey(w.name),w);} return m;}
function dedupeSeq(seq){const out=[]; for(const p of seq){if(!pointValid(p)) continue; if(out.length&&hav(out[out.length-1],p)<0.18) continue; out.push({...p});} return out;}
function sectionIsCore(sec){const t=String(sec?.type||'').toLowerCase(); return !/transfer|connector|motorway|approach|return-transfer/.test(t);}
function deriveScenicCore(route){
  const wps=routeWaypoints(route); if(wps.length<2) return wps;
  const map=waypointMap(wps); const seq=[];
  const sections=(route.sections||[]).filter(sectionIsCore);
  for(const sec of sections){
    const a=map.get(nameKey(sec.from)); const b=map.get(nameKey(sec.to));
    if(a&&!isHomePinnedPoint(a)&&(seq.length===0||nameKey(seq[seq.length-1].name)!==nameKey(a.name))) seq.push({...a,kind:a.kind==='start'?'scenic':a.kind});
    if(b&&!isHomePinnedPoint(b)) seq.push({...b,kind:b.kind==='finish'?'scenic':b.kind});
  }
  let core=dedupeSeq(seq);
  if(core.length<2){core=wps.filter(w=>!isHomePinnedPoint(w));}
  if(core.length<2){core=wps;}
  return dedupeSeq(core);
}
function routeCoreDistance(base,r){const core=deriveScenicCore(r); if(!core.length) return routeStartDistance(base,r); return Math.min(...core.map(p=>hav(base,p)));}
function routeTripDistance(start,end,r){const core=deriveScenicCore(r); if(!core.length) return routeStartDistance(start,r); const a=Math.min(...core.map(p=>hav(start,p))); const b=end?Math.min(...core.map(p=>hav(end,p))):a; return Math.min(a,b);}
function coreLength(seq){let d=0; for(let i=1;i<seq.length;i++) d+=hav(seq[i-1],seq[i]); return d;}
function isRouteLoopLike(route,core){const title=String(route?.title||''); const original=routeWaypoints(route); const closed=original.length>2&&hav(original[0],original[original.length-1])<18; const named=/\b(loop|round|rund|circuit|sweep|arc|ring|flow|day)\b/i.test(title); const shortClosure=core.length>3&&hav(core[0],core[core.length-1])<55; return closed||named||shortClosure;}
function rotate(arr,i){return arr.slice(i).concat(arr.slice(0,i));}
function sectionTypeBetween(route,a,b){const ak=nameKey(a?.name), bk=nameKey(b?.name); const sec=(route.sections||[]).find(s=>{const f=nameKey(s.from),t=nameKey(s.to); return (f===ak&&t===bk)||(f===bk&&t===ak);}); return sec?.type||inferSectionType(a,b);}
function inferSectionType(a,b){const joined=String([a?.kind,b?.kind,a?.name,b?.name].join(' ')).toLowerCase(); if(/pass|höhe|high|grimsel|furka|susten|brünig|glaubenbielen|klausen|nufenen|stelvio|julier|albula/.test(joined)) return 'serpentine'; if(/lake|fjord|coast|bay|sea|wasser|strand|beach/.test(joined)) return 'coast'; if(/forest|wald|heath|moor|wood/.test(joined)) return 'forest'; return 'scenic';}
function pathDistance(seq){let d=0; for(let i=1;i<seq.length;i++) d+=hav(seq[i-1],seq[i]); return d;}
function uniqueCoreCandidates(core, route, base, range){
  const minCore=Math.max(28, Math.min(Number(range||260)*0.34, 160));
  const maxCore=Math.max(minCore+20, Number(range||260)*0.86);
  const cand=[];
  const add=(seq,tag,penalty=0)=>{const clean=dedupeSeq(seq); if(clean.length<2)return; const coreKm=pathDistance(clean); if(coreKm<minCore && core.length>3)return; const entry=clean[0], exit=clean[clean.length-1]; const entryKm=hav(base,entry), returnKm=hav(exit,base); const transfer=entryKm+returnKm; const coreReward=Math.min(70,coreKm*.38); const rangePenalty=Math.max(0,(coreKm+transfer)*1.16-Number(range||260))*0.55 + Math.max(0,minCore-coreKm)*0.9 + Math.max(0,coreKm-maxCore)*0.18; const score=transfer - coreReward + rangePenalty + penalty; cand.push({core:clean,entry,exit,entryKm,returnKm,coreKm,score,tag});};
  add(core,'forward-full'); add([...core].reverse(),'reverse-full');
  const loop=isRouteLoopLike(route,core);
  if(loop){for(let i=0;i<core.length;i++) add(rotate(core,i),'loop-rotate-'+i,hav(core[(i+core.length-1)%core.length],core[i])*.08); const rev=[...core].reverse(); for(let i=0;i<rev.length;i++) add(rotate(rev,i),'loop-reverse-rotate-'+i,hav(rev[(i+rev.length-1)%rev.length],rev[i])*.08);}
  if(core.length>=5){for(let i=0;i<core.length-2;i++) for(let j=i+2;j<core.length;j++){const slice=core.slice(i,j+1); const km=pathDistance(slice); if(km>=minCore*.8) add(slice,`open-slice-${i}-${j}`,8); const rev=slice.slice().reverse(); if(km>=minCore*.8) add(rev,`open-slice-reverse-${j}-${i}`,9);}}
  return cand;
}
function optimizeCoreOrder(route,start,finish=start,range){
  const core=deriveScenicCore(route); if(core.length<2) return {core,entry:core[0],exit:core[core.length-1],entryKm:0,returnKm:0,coreKm:0,loop:false,tag:'none'};
  const end=finish||start; const candidates=[];
  const add=(seq,tag,cutPenalty=0)=>{const clean=dedupeSeq(seq); if(clean.length<2)return; const entry=clean[0], exit=clean[clean.length-1]; const entryKm=hav(start,entry), returnKm=hav(exit,end), internal=coreLength(clean); const rangePenalty=Math.max(0,(entryKm+returnKm+internal*1.18)-(Number(range)||260))*0.18; const score=entryKm+returnKm+cutPenalty+rangePenalty+Math.max(0,internal-(Number(route.km)||internal)*1.15)*0.2; candidates.push({core:clean,entry,exit,entryKm,returnKm,coreKm:internal,score,tag});};
  add(core,'forward'); add([...core].reverse(),'reverse');
  if(isRouteLoopLike(route,core)){ for(let i=0;i<core.length;i++) add(rotate(core,i),'rotate-'+i,hav(core[(i+core.length-1)%core.length],core[i])*.18); const rev=[...core].reverse(); for(let i=0;i<rev.length;i++) add(rotate(rev,i),'rev-rotate-'+i,hav(rev[(i+rev.length-1)%rev.length],rev[i])*.18); }
  candidates.sort((a,b)=>a.score-b.score); return {...candidates[0],loop:isRouteLoopLike(route,core)};
}
function denseNavFromWaypoints(wps,sections=[],maxStepKm=7){return (wps||[]).filter(pointValid).map((p,i)=>({name:p.name||`checkpoint ${i+1}`,lat:Number(p.lat),lon:Number(p.lon),kind:p.kind||'checkpoint'})).filter((p,i,a)=>i===0||hav(a[i-1],p)>.08);}
function makeOptimizedSections(route,seq,start,finish=start){
  const out=[]; if(!seq.length) return out; const end=finish||start; const entry=seq[0], exit=seq[seq.length-1]; const inKm=Math.round(hav(start,entry)*1.18), outKm=Math.round(hav(exit,end)*1.18);
  if(inKm>1) out.push({from:`${start.label} start`,to:entry.name,km:Math.max(1,inKm),type:'transfer',advice:`Transfer from ${start.label} to the best entry for this road core. This leg is recalculated for the selected start, not inherited from a stored home base.`});
  for(let i=0;i<seq.length-1;i++){const a=seq[i],b=seq[i+1]; const type=sectionTypeBetween(route,a,b); const km=Math.max(1,Math.round(hav(a,b)*1.18)); out.push({from:a.name,to:b.name,km,type,advice:sectionAdvice({type,from:a.name,to:b.name,km},a,b)});}
  if(outKm>1) out.push({from:exit.name,to:`${end.label} finish`,km:Math.max(1,outKm),type:'transfer',advice:`Transfer from the optimized road-core exit to ${end.label}. This finish leg is part of OSM, Google, GPX and the waypoint pack.`});
  return out;
}
function anchorRouteToTrip(route,base,finishBase=base){
  const original=normalizedRoute(cloneRoute(route)); const start={lat:Number(base.lat),lon:Number(base.lon),label:cleanStartLabel(base.label)}; const finish={lat:Number(finishBase?.lat ?? base.lat),lon:Number(finishBase?.lon ?? base.lon),label:cleanStartLabel(finishBase?.label || base.label)};
  const opt=optimizeCoreOrder(original,start,finish,state.range||260); const core=opt.core&&opt.core.length>=2?opt.core:routeWaypoints(original); if(core.length<2) return original;
  const startWp={name:`${start.label} start`,lat:start.lat,lon:start.lon,kind:'start',wiki:start.label,photo:`commons-search:${start.label}`,advice:`Start from ${start.label}. CurveScout calculates the transfer to the selected road-trip entry for this exact start.`};
  const finishWp={name:`${finish.label} finish`,lat:finish.lat,lon:finish.lon,kind:'finish',wiki:finish.label,photo:`commons-search:${finish.label}`,advice:`Finish at ${finish.label}. The final leg is part of the export, not hidden outside the roadbook.`};
  const cleanCore=core.map((w,i)=>({...w,kind:(i===0&&isHomePinnedPoint(w))?'scenic':(i===core.length-1&&isHomePinnedPoint(w))?'scenic':w.kind}));
  const newWps=dedupeSeq([startWp,...cleanCore,finishWp]); const sections=makeOptimizedSections(original,cleanCore,start,finish); const km=Math.round(sections.reduce((s,x)=>s+(Number(x.km)||0),0)||((opt.coreKm+opt.entryKm+opt.returnKm)*1.18));
  const coreKinds=cleanCore.map(w=>String(w.kind||'')).join(' '); const avg=/pass|high|serpentine/i.test(coreKinds)?46:/coast|forest/i.test(coreKinds)?55:58;
  original.baseStart={lat:start.lat,lon:start.lon,label:start.label}; original.baseFinish={lat:finish.lat,lon:finish.lon,label:finish.label}; original.baseEnd=original.baseFinish;
  original.coreEntry={name:cleanCore[0].name,lat:cleanCore[0].lat,lon:cleanCore[0].lon,km:Math.round(opt.entryKm)}; original.coreExit={name:cleanCore[cleanCore.length-1].name,lat:cleanCore[cleanCore.length-1].lat,lon:cleanCore[cleanCore.length-1].lon,km:Math.round(opt.returnKm)};
  original.transferModel={fromSelectedStart:true,optimized:true,order:opt.tag,entryKm:Math.round(opt.entryKm),returnKm:Math.round(opt.returnKm),coreKm:Math.round(opt.coreKm),addedKm:Math.round((opt.entryKm+opt.returnKm)*1.18),entryName:cleanCore[0].name,exitName:cleanCore[cleanCore.length-1].name,startLabel:start.label,finishLabel:finish.label,roundTrip:hav(start,finish)<0.25};
  original.waypoints=newWps; original.sections=sections; original.km=km; original.minutes=Math.round(km/avg*60); original.nearKm=Math.round(opt.entryKm); original.navPoints=denseNavFromWaypoints(original.waypoints,original.sections,6);
  original.alignmentAudit={status:'locked',checkpointCount:original.navPoints.length,note:'Selected start, optimized entry, scenic core, exit and selected finish are the single checkpoint\s+chain for OSM, Google, GPX, topo and waypoint export.'}; original.story=cleanStory(original); original.imagePool=original.imagePool||[];
  return normalizedRoute(original);
}
function anchorRouteToStart(route,base){return anchorRouteToTrip(route,base,state.end||base);}
function scoreAnchoredRoute(raw, anchored, base, range, query, i){
  const st=sectionStats(anchored), km=Number(anchored.km)||range, tm=anchored.transferModel||{};
  const transfer=Number(tm.addedKm)||((Number(tm.entryKm)||0)+(Number(tm.returnKm)||0))*1.18;
  const ratio=km?transfer/km:1;
  const entry=Number(tm.entryKm)||routeCoreDistance(base,raw);
  const rangeFit=Math.max(0,42-Math.abs(km-range)/5.5);
  const localFit=entry<8?42:entry<25?36:entry<55?30:entry<90?20:entry<150?9:-Math.min(42,(entry-150)/5);
  const transferPenalty=Math.max(0,ratio-.42)*150+Math.max(0,entry-Math.max(35,range*.38))*.85+Math.max(0,st.initial-Math.max(45,range*.24))*1.05+Math.max(0,st.finish-Math.max(55,range*.28))*.75;
  const exact=samePlaceHit(query,raw)?16:0;
  const quality=(raw.score||75)+(raw.breakdown?.scenic||75)*.12+(raw.breakdown?.trafficEscape||75)*.14+(raw.breakdown?.flow||75)*.09;
  return quality+rangeFit+localFit+exact-transferPenalty-(isGeneratedReservoir(raw)?68:0)-i*.001;
}
function routePassesRuntimeFilter(r,range){const tm=r.transferModel||{}; const ratio=(Number(tm.addedKm)||0)/(Number(r.km)||1); return kmFitsRange(r,range)&&!(Number(range)<=260&&ratio>.66)&&!(Number(range)<=260&&(Number(tm.entryKm)||0)>Math.max(130,Number(range)*.55));}
function rankRoutes(base, range=260, query='', finish=base){
  let pool=localPool(base,range,query);
  const needed=Math.max(0,24-pool.length);
  if(needed>0){const scouts=generatedFallbackRoutes(base,query||base.label,range,needed+4).filter(r=>kmFitsRange(r,range)); pool=dedupeRoutes([...pool,...scouts],base,range);}
  let scored=pool.map((raw,i)=>{const anchored=anchorRouteToTrip(raw,base,finish||base); return {...anchored,rankScore:scoreAnchoredRoute(raw,anchored,base,range,query,i)};}).filter(r=>routePassesRuntimeFilter(r,range)).sort((a,b)=>b.rankScore-a.rankScore);
  if(scored.length<20){
    const extra=generatedFallbackRoutes(base,query||base.label,range,44).map((raw,i)=>{const anchored=anchorRouteToTrip(raw,base,finish||base); return {...anchored,rankScore:scoreAnchoredRoute(raw,anchored,base,range,query,100+i)};}).filter(r=>kmFitsRange(r,range)).sort((a,b)=>b.rankScore-a.rankScore);
    scored=dedupeRoutes([...scored,...extra],base,range).sort((a,b)=>(b.rankScore||0)-(a.rankScore||0));
  }
  return scored.slice(0,40).map((r,i)=>({...r,rank:i+1,color:COLORS[i%COLORS.length]}));
}
async function resolveFinish(base){const raw=($('finishInput')?.value||'').trim(); if(!raw) return {...base}; const lower=raw.toLowerCase(); if(['return to start','same','same as start','loop','back to start'].includes(lower)) return {...base}; return await geocode(raw);}
async function search(useGeo=false){
  const token=++state.searchToken;
  try{
    let base;
    if(useGeo){setStatus('Reading location… GPS if allowed, otherwise a safe typed/IP fallback.'); base=await currentLocation();}
    else {base=await geocode($('startInput').value);}
    const finish=await resolveFinish(base);
    if(token!==state.searchToken) return;
    state.start=base; state.end=finish; state.lastQuery=base.label;
    $('startInput').value=base.label;
    if($('finishInput') && hav(base,finish)<0.2) $('finishInput').value=''; else if($('finishInput')) $('finishInput').value=finish.label;
    state.range=Number($('rangeInput').value)||260; state.style=$('styleInput').value;
    state.ranked=rankRoutes(base,state.range,state.lastQuery,finish);
    ensureRanked(state.lastQuery);
    renderCandidates();
    selectRoute(state.ranked[0],false);
    const suffix=hav(base,finish)<0.2?'returning to the same start':`ending at ${finish.label}`;
    setStatus(`Showing road trips from ${base.label}, ${suffix}. Transfers, scenic core, OSM map, Google preview and GPX now use one checkpoint\s+chain.`);
    await snapSelected();
  }catch(e){
    const typed=($('startInput').value||'').trim(); const base=typed?await geocode(typed):(state.start||HOME); const finish=await resolveFinish(base);
    state.start=base; state.end=finish; state.range=Number($('rangeInput').value)||260; state.ranked=rankRoutes(base,state.range,base.label,finish); ensureRanked(base.label); renderCandidates(); selectRoute(state.ranked[0],false);
    setStatus(useGeo?'Precise GPS is blocked here, so CurveScout kept the typed start and still loaded road trips.':'Search recovered and loaded road trips from the bundled catalogue.');
    snapSelected();
  }
}
function ensureRanked(label){
  if(!Array.isArray(state.ranked) || state.ranked.length===0){
    const base=state.start||HOME, finish=state.end||base, range=Number(state.range||$('rangeInput')?.value)||260;
    state.ranked=rankRoutes(base,range,label||state.lastQuery||base.label||'Zurich',finish);
  }
  if(!Array.isArray(state.ranked) || state.ranked.length===0){
    const base=state.start||HOME, finish=state.end||base, range=Number(state.range||260);
    state.ranked=generatedFallbackRoutes(base,label||base.label||'selected start',range,24).map((raw,i)=>({...anchorRouteToTrip(raw,base,finish),rank:i+1,color:COLORS[i%COLORS.length]}));
  }
  return state.ranked;
}
function renderCandidatesFallback(){
  const rail=$('candidateList'); if(!rail) return;
  const list=ensureRanked().slice(0,20);
  rail.innerHTML=`<div class="candidateGroup"><div class="groupTitle">Top road trips near this start</div>${list.map(r=>`<article class="tripCard ${state.selected?.id===r.id?'active':''}" data-route="${esc(r.id)}"><div class="cardVisual heroOnly"><img src="${esc((splitMediaList(routePhoto(r,r.rank||0)).find(usableImageUrl)||helmetFallback()))}" alt="${esc(r.title)}"></div><div class="cardBody"><div class="cardTop"><span>Rank ${r.rank||''}</span><strong>${Math.round(r.score||80)}</strong></div><h3>${esc(r.title)}</h3><p class="slogan">${esc(r.slogan||'A real road-trip candidate near your selected start.')}</p><div class="cardFacts"><span>${fmtKm(r.km)}</span><span>${dur(r.minutes)}</span><span>${Math.round(r.nearKm||0)} km to entry</span></div><div class="cardActions"><button>Choose road trip</button><a class="googlePill small" href="${googleRoute(r)}" target="_blank" rel="noopener">Google</a></div></div></article>`).join('')}</div>`;
  rail.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',()=>{const r=state.ranked.find(x=>x.id===el.dataset.route); selectRoute(r,true);}));
}
function selectRoute(r,doSnap=true){
  try{
    if(!r){ensureRanked(state.lastQuery); r=state.ranked[0];}
    if(!r) return;
    usedMediaUrls.clear(); state.selected=normalizedRoute(r);
    try{warmRouteMedia(state.selected); prefetchTripMedia(state.selected);}catch(e){console.warn('media warmup recovered',e);}
    try{renderSelected();}catch(e){console.error('selected render recovered',e); setStatus('CurveScout kept the route list alive and recovered the selected-road-trip panel.');}
    try{renderCandidates();}catch(e){console.error('candidate render recovered',e); renderCandidatesFallback();}
    try{fitMap(state.selected);}catch(e){console.error('map fit recovered',e); try{renderMainMap();}catch(_){} }
    if(doSnap) Promise.resolve(snapSelected()).catch(e=>console.warn('route lock recovered',e));
  }catch(e){console.error('route selection recovered',e); renderCandidatesFallback();}
}
function miniMapSvg(r){return '';}
function cardHtml(r){return `<article class="tripCard ${state.selected?.id===r.id?'active':''}" data-route="${esc(r.id)}" title="${esc(r.slogan)}"><div class="cardVisual heroOnly"><img ${photoAttrs(routePhoto(r,r.rank||0),r.title,photoQueriesFor(r,r,r.title).join('||'), Number(r.rank||0)<=10)}><span class="imageNote">open image</span></div><div class="cardBody"><div class="cardTop"><span>Rank ${r.rank}</span><strong>${Math.round(r.score)}</strong></div><h3>${esc(r.title)}</h3><p class="slogan">${esc(r.slogan)}</p><div class="miniScores"><span>Scenic <b>${r.breakdown.scenic}</b></span><span>Flow <b>${r.breakdown.flow}</b></span><span>Escape <b>${r.breakdown.trafficEscape}</b></span></div><div class="cardFacts"><span>${fmtKm(r.km)}</span><span>${dur(r.minutes)}</span><span>${r.nearKm} km to entry</span>${r.ferryOrWaterNote?'<span title="Verify ferry or coastal timing before riding">ferry/water check</span>':''}</div><div class="cardActions"><button>Choose road trip</button><button data-gpx>GPX</button><a class="googlePill small" href="${googleRoute(r)}" target="_blank" rel="noopener" onclick="window.open(this.href,'_blank','noopener');return false;" title="Open Google Maps with the same canonical checkpoint order as CurveScout.com and GPX.">Google</a></div></div></article>`;}
function preloadTripMedia(r){warmRouteMedia(r); prefetchTripMedia(r);}
function preloadRankedMedia(){(state.ranked||[]).slice(0,20).forEach((r,i)=>setTimeout(()=>{warmRouteMedia(r); prefetchTripMedia(r);},i*220));}
function renderCandidates(){
  const rail=$('candidateList'); if(!rail) return;
  ensureRanked(state.lastQuery);
  const top=state.ranked.slice(0,20), rest=state.ranked.slice(20,32);
  const safeCards=list=>list.map(r=>{try{return cardHtml(r);}catch(e){console.warn('card recovered',e); return `<article class="tripCard" data-route="${esc(r.id)}"><div class="cardVisual heroOnly"><img src="${esc(splitMediaList(routePhoto(r,r.rank||0)).find(usableImageUrl)||helmetFallback())}" alt="${esc(r.title)}"></div><div class="cardBody"><div class="cardTop"><span>Rank ${r.rank||''}</span><strong>${Math.round(r.score||80)}</strong></div><h3>${esc(r.title)}</h3><p class="slogan">${esc(r.slogan||'Road trip near your selected start.')}</p><div class="cardActions"><button>Choose road trip</button><a class="googlePill small" href="${googleRoute(r)}" target="_blank" rel="noopener">Google</a></div></div></article>`;}}).join('');
  rail.innerHTML=`<div class="candidateGroup"><div class="groupTitle">Top 20 near this start</div>${safeCards(top)}</div>${rest.length?`<div class="candidateGroup"><div class="groupTitle">Wider route reservoir</div>${safeCards(rest)}</div>`:''}`;
  rail.querySelectorAll('[data-route]').forEach(el=>{el.addEventListener('click',e=>{const id=el.dataset.route; const r=state.ranked.find(x=>x.id===id); if(e.target.closest('[data-gpx]')){downloadGPX(r); e.stopPropagation(); return;} if(e.target.closest('a')){e.stopPropagation(); return;} selectRoute(r,true);});});
  try{hydrateImages(rail,true); preloadRankedMedia();}catch(e){console.warn('candidate media hydration recovered',e);}
}
function renderSelected(){const r=state.selected; if(!r) return; $('selectedTitle').textContent=r.title; $('selectedSlogan').textContent=r.slogan; $('selectedStory').textContent=cleanStory(r); $('scoreValue').textContent=Math.round(r.score); $('scoreBreakdown').innerHTML=Object.entries(r.breakdown||{}).map(([k,v])=>`<span title="${esc(scoreTip(k))}"><b>${v}</b>${labelScore(k)}</span>`).join(''); $('selectedFacts').innerHTML=`<span title="Full roadbook distance from selected start through transfer, road core and finish"><b>${fmtKm(r.km)}</b>distance</span><span title="Motorcycle riding time estimate before stops"><b>${dur(r.minutes)}</b>ride time</span><span title="Optimized transfer from start to entry plus exit to finish"><b>${fmtKm(r.transferModel?.addedKm||r.transferModel?.transferKm||0)}</b>transfer</span><span title="Scenic / technical riding core kept from the road-trip repository"><b>${fmtKm(r.transferModel?.coreKm||sectionStats(r).scenic)}</b>riding core</span><span title="Entry point selected for this exact start"><b>${esc(shortName(r.coreEntry?.name||r.transferModel?.entryName||'entry',18))}</b>entry</span><span title="Exit point selected before the chosen finish"><b>${esc(shortName(r.coreExit?.name||r.transferModel?.exitName||'exit',18))}</b>exit</span><span title="Route starts here"><b>${esc(shortName(r.baseStart?.label||'start',18))}</b>start</span><span title="Route finishes here"><b>${esc(shortName(r.baseFinish?.label||r.baseEnd?.label||r.baseStart?.label||'finish',18))}</b>finish</span>`; /* roadbook-first render */ renderInlineRoadbook(r); renderRoadbook(r); const hero=$('heroImg'); hero.removeAttribute('data-media-query'); hero.removeAttribute('data-photo-src'); hero.removeAttribute('data-loaded'); hero.classList.remove('loadedPhoto','photoFallback','loadingPhoto'); const heroSrc=routePhoto(r,0); const heroDirects=splitMediaList(heroSrc).filter(x=>directPhoto(x)); hero.src=heroDirects[0]||helmetFallback(); hero.setAttribute('data-photo-src',heroDirects.join('||')); hero.setAttribute('data-media-query',photoQueriesFor(r,r,r.photoQuery||r.title).join('||')); hero.setAttribute('fetchpriority','high'); hero.setAttribute('loading','eager'); hero.onload=()=>{if(hero.src && !hero.src.includes('curvescout-helmet') && !hero.src.startsWith('data:image')){hero.classList.remove('loadingPhoto','photoFallback','mediaPending');hero.classList.add('loadedPhoto');hero.dataset.loaded='1';hero.setAttribute('data-audited-photo','1');}}; hero.onerror=()=>{hero.onerror=null;hero.classList.add('photoFallback','mediaPending');hero.src=helmetFallback(); scheduleImageRetry(hero);}; hero.alt=r.title; warmRouteMedia(r); renderQuickActions(r); renderIntel(r); loadRouteWeather(r); refreshWeather(r); startMediaPump(); renderAdvice(r); renderMainMap(); renderProfile(r); renderRoadStatus(r); renderInlineRoadbook(r); renderRoadbook(r); renderNav(r); warmPhotoQueue(r); prefetchTripMedia(r); hydrateImages(document.querySelector('.stage'), true);}
function labelScore(k){return ({scenic:'scenic',flow:'flow',technical:'technical',surface:'surface',trafficEscape:'traffic escape',risk:'risk'})[k]||k;} function scoreTip(k){return ({scenic:'Landscape, viewpoints, water, mountains and visual reward.',flow:'How naturally the ride links road sections without awkward dead mileage.',technical:'Bends, gradients, hairpins and road-reading demand.',surface:'Confidence estimate from route type and road character.',trafficEscape:'How well the ride gets away from urban frustration.',risk:'Weather, tourist traffic, junctions, shade, speed and surface reminders.'})[k]||'Route score component.';}
function renderQuickActions(r){const googleLinks=googleRouteLegs(r).map(g=>`<a class="googlePill" href="${g.href}" target="_blank" rel="noopener" onclick="window.open(this.href,'_blank','noopener');return false;" title="Open Google Maps with the same\s+ordered roadbook checkpoints.">${esc(g.label)}</a>`).join(''); $('quickActions').innerHTML=`<button class="primaryAction" data-action="gpx" title="Download the exact GPX with route line and waypoint order">Download GPX</button>${googleLinks}<a class="osmPill" href="${osmRoute(r)}" target="_blank" rel="noopener" title="Open the same checkpoint order in OpenStreetMap directions">OSM route preview</a><button data-action="copy" title="Copy every waypoint with coordinates and advice">Copy waypoints</button>`; $('quickActions').querySelectorAll('[data-action]').forEach(btn=>btn.onclick=()=>{if(btn.dataset.action==='gpx')downloadGPX(r); if(btn.dataset.action==='copy')copyWaypoints(r);});}
function renderIntel(r){const items=[...statusItems(r).slice(2,5),{icon:'🍽️',title:'Stops',text:stopSummary(r)},{icon:'🏛️',title:'Sights',text:sightSummary(r)},{icon:'📷',title:'Open photos',text:'loading audited route media',live:'media'},{icon:'🧭',title:'Route line',text:'The map, GPX and previews follow the same\s+ordered roadbook.'}]; $('intelGrid').innerHTML=`<div class="intelCard weatherLive" title="Live weather loads after the route renders."><b><span data-weather-icon>🌤️</span> Weather window</b><span data-weather-live>${esc(fallbackWeatherText(r))}</span></div>`+items.map(x=>`<div class="intelCard ${x.live==='media'?'mediaCard':''}" title="${esc(x.text)}"><b>${x.icon} ${esc(x.title)}</b><span ${x.live==='media'?'data-media-progress':''}>${esc(x.text)}</span></div>`).join(''); updateMediaStatus(); loadRouteWeather(r);} 
function renderAdvice(r){$('rideAdviceGrid').innerHTML=storyCards(r).map(c=>`<div class="adviceCard" title="${esc(c.text)}"><b>${c.icon} ${esc(c.title)}</b><span>${esc(c.text)}</span></div>`).join('');}
function renderRoadStatus(r){const items=statusItems(r); $('roadStatusStack').innerHTML=items.map(x=>{const live=x.title==='Weather window'; const inner=`<b><span class="iconBubble" ${live?'data-weather-icon':''}>${x.icon}</span>${esc(x.title)}</b><span ${live?'data-weather-live':''}>${esc(x.text)}</span>`; return x.href?`<a class="statusCard link" href="${esc(x.href)}" target="_blank" rel="noopener" title="${esc(x.text)}">${inner}</a>`:`<div class="statusCard" title="${esc(x.text)}">${inner}</div>`;}).join('');}
function routeLine(r){return state.routeGeom.get(routeCacheKey(r))||r.track||r.navPoints||r.waypoints||[];}
function renderTiles(el, center, zoom){const rect=el.getBoundingClientRect(); const w=rect.width||800,h=rect.height||500; const cx=lon2x(center.lon,zoom), cy=lat2y(center.lat,zoom); let html=''; const sx=cx-w/2, sy=cy-h/2; const minX=Math.floor(sx/256)-1,maxX=Math.floor((sx+w)/256)+1,minY=Math.floor(sy/256)-1,maxY=Math.floor((sy+h)/256)+1; for(let x=minX;x<=maxX;x++) for(let y=minY;y<=maxY;y++){const n=Math.pow(2,zoom), xx=((x%n)+n)%n; const left=x*256-sx, top=y*256-sy; if(y<0||y>=n) continue; html+=`<img class="tile" src="${TILE.replace('{z}',zoom).replace('{x}',xx).replace('{y}',y)}" style="left:${left}px;top:${top}px" alt="">`; } return html;}
function project(p,el){const rect=el.getBoundingClientRect(); const z=state.map.zoom, cx=lon2x(state.map.center.lon,z), cy=lat2y(state.map.center.lat,z); return {x:lon2x(p.lon,z)-cx+rect.width/2, y:lat2y(p.lat,z)-cy+rect.height/2};}
function pathFromPoints(points,el){return 'M '+points.map(p=>{const q=project(p,el); return `${q.x.toFixed(1)} ${q.y.toFixed(1)}`;}).join(' L ');}
function pointAtRatio(pts, ratio){if(!pts.length) return HOME; if(pts.length===1) return pts[0]; const d=[0]; let total=0; for(let i=1;i<pts.length;i++){total+=hav(pts[i-1],pts[i]); d[i]=total;} const target=clamp(ratio,0,1)*total; let i=1; while(i<d.length&&d[i]<target)i++; const a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i)]; const seg=(d[i]-d[i-1])||1; const t=(target-d[i-1])/seg; return {lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t};}
function pointOrderOnLine(p,line){let best=0,bd=1e9,acc=0,bestAcc=0; for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i]; const seg=hav(a,b)||.001; const t=clamp(((p.lon-a.lon)*(b.lon-a.lon)+(p.lat-a.lat)*(b.lat-a.lat))/(((b.lon-a.lon)**2+(b.lat-a.lat)**2)||1),0,1); const q={lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t}; const d=hav(p,q); if(d<bd){bd=d; best=i; bestAcc=acc+seg*t;} acc+=seg;} return bestAcc||best;}
function renderMainMap(){const el=$('mainMap'); if(!el||!state.selected)return; const r=state.selected; el.innerHTML=renderTiles(el,state.map.center,state.map.zoom); const pts=routeLine(r); const wps=r.waypoints||[]; const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('class','mapOverlay'); if(pts.length>1){const locked=state.routeGeom.has(routeCacheKey(r)); const halo=document.createElementNS(svg.namespaceURI,'path'); halo.setAttribute('d',pathFromPoints(pts,el)); halo.setAttribute('class',locked?'routeHalo':'routeSkeletonHalo'); halo.innerHTML=`<title>${esc(r.title)} — one checkpoint\s+chain for OSM map, GPX, Google preview and OSM preview.</title>`; svg.appendChild(halo); const sections=r.sections||[]; if(locked && sections.length){const total=sections.reduce((s,x)=>s+(Number(x.km)||0),0)||sections.length; let acc=0; sections.forEach((s)=>{const a=acc/total; acc+=Number(s.km)||total/sections.length; const b=acc/total; const seg=[...Array(28)].map((_,i)=>pointAtRatio(pts,a+(b-a)*i/27)); const p=document.createElementNS(svg.namespaceURI,'path'); p.setAttribute('d',pathFromPoints(seg,el)); p.setAttribute('class',`sectionLine ${s.type||'scenic'}`); p.innerHTML=`<title>${esc((s.type||'section').toUpperCase())}: ${esc(s.from)} to ${esc(s.to)}. ${esc(s.advice)}</title>`; svg.appendChild(p);});} else {const worm=document.createElementNS(svg.namespaceURI,'path'); worm.setAttribute('d',pathFromPoints(pts,el)); worm.setAttribute('class','routeSkeleton'); worm.innerHTML='<title>Routing is being locked. Waypoints are visible; thick road sections appear only after routed geometry loads.</title>'; svg.appendChild(worm);}}
  wps.forEach((w,i)=>{const p=project(w,el); const g=document.createElementNS(svg.namespaceURI,'g'); g.setAttribute('class',`wpMarker ${w.kind||''}`); g.setAttribute('transform',`translate(${p.x},${p.y})`); g.innerHTML=`<circle r="15"/><text y="5">${i+1}</text><title>${ICON[w.kind]||'•'} ${esc(w.name)} — ${esc(waypointAdvice(w,r,i))}</title>`; g.addEventListener('click',()=>{document.querySelector(`[data-wp="${i}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});}); svg.appendChild(g);});
  (r.safetyMarkers||[]).forEach((m,i)=>{const p=project(pointAtRatio(pts.length?pts:wps,(m.km||0)/(r.km||1)),el); const g=document.createElementNS(svg.namespaceURI,'g'); const isCam=/speed|control|camera/i.test(m.type||''); g.setAttribute('class',`riskMarker ${isCam?'camera':'risk'}`); g.setAttribute('transform',`translate(${p.x+12+(i%2)*16},${p.y-20-(i%3)*8})`); g.innerHTML=`<rect x="-11" y="-11" width="22" height="22" rx="6"/><text y="5">${isCam?'S':'!'}</text><title>${esc(m.type)} — ${esc(m.note)}</title>`; svg.appendChild(g);});
  el.appendChild(svg); el.insertAdjacentHTML('beforeend',`<div class="mapControls"><button data-map="fit" title="Fit selected route">Fit</button><button data-map="in" title="Zoom in">+</button><button data-map="out" title="Zoom out">−</button></div><span class="mapBadge">${state.routeGeom.has(routeCacheKey(r))?'Locked road line':'Route map'}</span><span class="osmBadge">OSM</span><div class="legendPills"><span>mint scenic</span><span>yellow technical</span><span>grey transfer</span><span>S speed/control</span></div>`); el.querySelector('[data-map="fit"]').onclick=()=>fitMap(r); el.querySelector('[data-map="in"]').onclick=()=>{state.map.zoom=clamp(state.map.zoom+1,3,15);renderMainMap();}; el.querySelector('[data-map="out"]').onclick=()=>{state.map.zoom=clamp(state.map.zoom-1,3,15);renderMainMap();};}
function fitMap(r){const pts=[...routeLine(r),...(r.waypoints||[])]; if(!pts.length) return; let minLat=90,maxLat=-90,minLon=180,maxLon=-180; pts.forEach(p=>{minLat=Math.min(minLat,p.lat);maxLat=Math.max(maxLat,p.lat);minLon=Math.min(minLon,p.lon);maxLon=Math.max(maxLon,p.lon);}); const rect=$('mainMap')?.getBoundingClientRect()||{width:900,height:520}; let best=4; for(let z=4;z<=14;z++){const w=Math.abs(lon2x(maxLon,z)-lon2x(minLon,z)); const h=Math.abs(lat2y(maxLat,z)-lat2y(minLat,z)); if(w<rect.width*.82 && h<rect.height*.76) best=z;} state.map.zoom=best; state.map.center={lat:(minLat+maxLat)/2,lon:(minLon+maxLon)/2}; renderMainMap();}
function routePointName(r,i,total){if(i===0) return `${r.baseStart?.label||'selected start'} start`; if(i===total-1) return `${r.baseFinish?.label||r.baseEnd?.label||r.baseStart?.label||'selected finish'} finish`; return `road checkpoint ${i+1}`;}
function makeSnapCheckpoints(routePts, osrmRoute, r, max=32){
  const pts=routePts.map((p,i)=>({name:routePointName(r,i,routePts.length),lat:Number(p.lat),lon:Number(p.lon),idx:i,source:'geometry'}));
  const chosen=new Map(); const add=p=>{if(pointValid(p)) chosen.set(Math.round(p.idx*10)/10,p);};
  add(pts[0]); add(pts[pts.length-1]);
  for(const w of rawNavPoints(r)){let best=0,bd=1e9; for(let i=0;i<pts.length;i+=Math.max(1,Math.floor(pts.length/900))){const d=hav(w,pts[i]); if(d<bd){bd=d;best=i;}} add({name:w.name||'route milestone',lat:pts[best].lat,lon:pts[best].lon,idx:best,source:'milestone'});}
  for(const p of sampleByDistance(pts,Math.min(12,max))) add(p);
  const steps=[]; try{for(const leg of (osrmRoute.legs||[])){for(const step of (leg.steps||[])){const loc=step.maneuver?.location; if(loc&&Number.isFinite(loc[0])&&Number.isFinite(loc[1])){let best=0,bd=1e9; const sp={lat:loc[1],lon:loc[0]}; for(let i=0;i<pts.length;i+=Math.max(1,Math.floor(pts.length/900))){const d=hav(sp,pts[i]); if(d<bd){bd=d;best=i;}} const important=/turn|fork|roundabout|merge|ramp|exit|arrive|depart|new name|rotary/i.test(step.maneuver?.type||'') || Number(step.distance)>3500; steps.push({name:(step.name||step.maneuver?.type||'junction checkpoint'),lat:pts[best].lat,lon:pts[best].lon,idx:best,source:important?'junction':'minor'});}}}}catch(e){}
  steps.sort((a,b)=>a.idx-b.idx);
  const important=steps.filter(s=>s.source==='junction'); const pool=important.length?important:steps;
  const stride=Math.max(1,Math.ceil(pool.length/Math.max(1,max-chosen.size)));
  for(let i=0;i<pool.length&&chosen.size<max;i+=stride) add(pool[i]);
  return [...chosen.values()].sort((a,b)=>a.idx-b.idx).map((p,i)=>({name:p.source==='junction'?`junction ${i+1}: ${p.name}`:p.source==='milestone'?p.name:routePointName(r,i,chosen.size),lat:p.lat,lon:p.lon}));
}
async function snapSelected(){const r=state.selected, token=++state.snapToken; if(!r||!r.waypoints||r.waypoints.length<2)return; const key=routeCacheKey(r); const semantic=rawNavPoints(r); const routeInput=semantic.length>36?sampleByDistance(semantic,36):semantic; const coords=routeInput.map(p=>`${p.lon},${p.lat}`).join(';'); try{const res=await fetchTO(`${OSRM}${coords}?overview=full&geometries=geojson&steps=true`,14000); if(token!==state.snapToken||routeCacheKey(state.selected)!==key)return; if(!res.ok)throw new Error('routing unavailable'); const js=await res.json(); const route=js.routes&&js.routes[0]; if(route&&route.geometry&&route.geometry.coordinates){const pts=route.geometry.coordinates.map(c=>({lon:c[0],lat:c[1]})); state.routeGeom.set(key,pts); const samples=makeSnapCheckpoints(pts, route, r, 58); state.navSamples.set(key,samples); setStatus(`Road line locked for ${r.title}. OSM map, topo, GPX, OSM preview and Google preview now share the same selected-start geometry.`); fitMap(r); renderProfile(r); renderQuickActions(r); renderNav(r);}}catch(e){if(token!==state.snapToken||routeCacheKey(state.selected)!==key)return; state.routeGeom.delete(key); state.navSamples.delete(key); setStatus(`${r.title}: routing engine unavailable. Google preview uses the current canonical checkpoints; refresh road geometry for an even tighter handoff.`); renderMainMap(); renderProfile(r); renderQuickActions(r); renderNav(r);}}
function cumulativeDistances(r){
  const wps=r.waypoints||[];
  const snapped=state.routeGeom.get(routeCacheKey(r));
  if(snapped&&snapped.length>2&&wps.length){
    const rd=[0]; let total=0;
    for(let i=1;i<snapped.length;i++){total+=hav(snapped[i-1],snapped[i]); rd[i]=total;}
    const mapped=wps.map(w=>{let best=0,bd=1e9; const stride=Math.max(1,Math.floor(snapped.length/1500)); for(let i=0;i<snapped.length;i+=stride){const d=hav(w,snapped[i]); if(d<bd){bd=d;best=i;}} return rd[best]||0;});
    return mapped.map((x,i,a)=>i?Math.max(x,a[i-1]+0.01):0);
  }
  const sections=r.sections||[]; const d=[0]; if(sections.length>=wps.length-1){let acc=0; for(let i=0;i<wps.length-1;i++){acc+=Number(sections[i]?.km)||Math.max(1,(r.km||1)/(wps.length-1)); d.push(acc);} const scale=(r.km||acc||1)/(acc||1); return d.map(x=>x*scale);} for(let i=1;i<wps.length;i++) d.push(d[i-1]+hav(wps[i-1],wps[i])); const scale=(r.km||d[d.length-1]||1)/(d[d.length-1]||1); return d.map(x=>x*scale);}
function profileValues(r){const wps=(r.waypoints||[]).filter(w=>Number.isFinite(Number(w.alt))); if(wps.length>=2){const all=r.waypoints||[]; const d=cumulativeDistances(r); const alt=all.map((w,i)=>Number.isFinite(Number(w.alt))?Number(w.alt):null); const samples=160; const vals=[]; for(let s=0;s<samples;s++){const km=(r.km||1)*s/(samples-1); let i=1; while(i<d.length&&d[i]<km)i++; const a=Math.max(0,i-1), b=Math.min(d.length-1,i); const av=alt[a]??(r.profile?.[Math.round((a/(d.length-1))*((r.profile?.length||1)-1))]||400); const bv=alt[b]??av; const t=(km-d[a])/((d[b]-d[a])||1); const rough=18*Math.sin(s*.37)+10*Math.sin(s*.91); vals.push(Math.max(0,Math.round(av+(bv-av)*t+rough)));} return vals;} return (r.profile&&r.profile.length?r.profile:makeSyntheticProfile(r.waypoints||[],r.score||80,hash(r.title)%9));}

function renderProfile(r){
  const el=$('profile'); if(!el)return;
  const W=1500,H=570,L=82,R=36,T=74,B=82;
  const vals=profileValues(r);
  const wayAlts=(r.waypoints||[]).map(w=>Number(w.alt)).filter(Number.isFinite);
  const min=Math.min(...vals,...wayAlts), max=Math.max(...vals,...wayAlts);
  const span=max-min||1;
  const y=v=>T+(max-v)/span*(H-T-B);
  const xByKm=km=>L+(km/(r.km||1))*(W-L-R);
  const x=i=>L+i/(vals.length-1)*(W-L-R);
  const dline='M '+vals.map((v,i)=>`${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' L ');
  let grid='';
  for(let i=0;i<=5;i++){
    const yy=T+i*(H-T-B)/5;
    const val=Math.round(max-span*i/5);
    grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" class="grid"/><text x="${L-12}" y="${yy+5}" text-anchor="end" class="axis">${val}m</text>`;
  }
  for(let i=0;i<=8;i++){
    const xx=L+i*(W-L-R)/8;
    grid+=`<line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}" class="grid weak"/><text x="${xx}" y="${H-46}" text-anchor="middle" class="axis">${Math.round((r.km||0)*i/8)} km</text>`;
  }
  const sections=r.sections||[];
  const total=sections.reduce((s,x)=>s+(Number(x.km)||0),0)||sections.length||1;
  let acc=0; const bandLabels=[]; const sectionLegend=[];
  const bands=sections.map((sec,i)=>{
    const startKm=acc/total*(r.km||1); acc+=Number(sec.km)||total/Math.max(1,sections.length); const endKm=acc/total*(r.km||1);
    const xx=xByKm(startKm), ww=Math.max(4,xByKm(endKm)-xx);
    const cls=({transfer:'transferBand',connector:'transferBand',scenic:'scenicBand',fast:'fastBand',serpentine:'serpentineBand',coast:'coastBand',forest:'forestBand'})[sec.type]||'scenicBand';
    const label=String(sec.type||'road').toUpperCase();
    if(ww>100) bandLabels.push(`<text x="${xx+ww/2}" y="${T+22+(i%2)*20}" class="profileBandLabel" text-anchor="middle"><title>${esc(sec.from)} to ${esc(sec.to)} · ${esc(sec.advice||'')}</title>${esc(label)}</text>`);
    sectionLegend.push(`<span title="${esc(sec.advice||'')}"><b>${i+1}</b>${ICON[sec.type]||'〽️'} ${esc(sec.type||'road')} · ${esc(shortName(sec.from,18))} → ${esc(shortName(sec.to,18))}</span>`);
    return `<rect x="${xx}" y="${T}" width="${ww}" height="${H-T-B}" class="${cls}"><title>${esc(label)}: ${esc(sec.from)} to ${esc(sec.to)}. ${esc(sec.advice||'')}</title></rect>`;
  }).join('');
  const speedPoints=vals.map((v,i)=>`${x(i).toFixed(1)},${(H-B-30-((v-min)/span)*64).toFixed(1)}`).join(' ');
  const speed=`<polyline points="${speedPoints}" class="speedLine"><title>Estimated speed layer: ${esc(r.speedBand||'local limits always win')}.</title></polyline>`;
  const wpKm=cumulativeDistances(r);
  const markers=(r.waypoints||[]).map((w,i)=>({w,i,km:wpKm[i]??i/Math.max(1,(r.waypoints.length-1))*(r.km||1)}));
  const wpMarks=markers.map(m=>{
    const xx=xByKm(m.km);
    const idx=Math.min(vals.length-1,Math.round((m.km/(r.km||1))*(vals.length-1)));
    const alt=Number.isFinite(Number(m.w.alt))?Number(m.w.alt):vals[idx];
    const yy=y(alt);
    return `<g class="profileMark" data-index="${m.i+1}"><line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}"/><circle cx="${xx}" cy="${yy}" r="14"/><text x="${xx}" y="${yy+6}" text-anchor="middle">${m.i+1}</text><title>${ICON[m.w.kind]||'•'} ${esc(m.w.name)} · ${Math.round(alt)} m · ${esc(waypointAdvice(m.w))}</title></g>`;
  }).join('');
  const safety=(r.safetyMarkers||[]).map((m,idx)=>{
    const xx=xByKm(m.km||0);
    const isCam=/speed|control|camera/i.test(m.type||'');
    const cls=isCam?'cameraLine':'riskLine';
    return `<g class="${cls}"><line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}"/><text x="${xx}" y="${T+38+((idx%3)*24)}" text-anchor="middle">${isCam?'S':'!'}</text><title>${esc(m.type)} — ${esc(m.note)}</title></g>`;
  }).join('');
  const targets=markers.filter(m=>['pass','high','photo','swim','sight','food','fuel','sleep'].includes(m.w.kind)).slice(0,10);
  const lanes=[[],[],[]]; const labels=[];
  targets.forEach((m,idx)=>{
    const xx=xByKm(m.km), label=`${m.i+1} ${ICON[m.w.kind]||'•'} ${shortName(m.w.name,14)}`;
    const width=74+Math.min(95,label.length*5);
    let lane=0; for(;lane<lanes.length;lane++){if(!lanes[lane].some(([a,b])=>!(xx-width/2>b||xx+width/2<a))) break;}
    if(lane>=lanes.length) return;
    lanes[lane].push([xx-width/2,xx+width/2]); const x0=clamp(xx-width/2,L,W-R-width), y0=10+lane*20;
    labels.push(`<g class="profileLabel"><rect x="${x0}" y="${y0}" width="${width}" height="18" rx="9"/><text x="${x0+width/2}" y="${y0+13}" text-anchor="middle">${esc(label)}</text><title>${ICON[m.w.kind]||'•'} ${esc(m.w.name)} — ${esc(waypointAdvice(m.w))}</title></g>`);
  });
  const passCount=(r.waypoints||[]).filter(w=>['pass','high'].includes(w.kind)).length;
  const cams=(r.safetyMarkers||[]).filter(m=>/speed|control|camera/i.test(m.type||'')).length;
  el.innerHTML=`<div class="profileCaption"><b>${esc(r.title)}</b><span>${Math.round(min)}-${Math.round(max)} m · ${fmtKm(r.km)} · ${passCount} high points · ${cams} speed/control · ${esc(r.speedBand||'local limits always win')}</span></div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Technical riding profile for ${esc(r.title)}">${bands}${grid}${bandLabels.join('')}${speed}<path d="${dline}" class="altitudeLine"><title>Altitude profile: ${Math.round(min)} to ${Math.round(max)} metres.</title></path>${safety}${wpMarks}${labels.join('')}<text x="${L}" y="${H-15}" class="axis">Hover: section bands, speed/control markers, danger lines and numbered waypoints. Yellow = altitude. Blue = estimated speed layer.</text></svg><div class="legendGrid"><span>mint: scenic road</span><span>yellow: technical / serpentines</span><span>grey: transfer</span><span>blue: faster connector</span><span>S: speed/control</span><span>!: risk / surface / traffic</span></div><div class="profileKey">${markers.map(m=>`<span title="${esc(waypointAdvice(m.w))}"><b>${m.i+1}</b>${ICON[m.w.kind]||'•'} ${esc(m.w.name)}</span>`).join('')}</div><div class="sectionKey">${sectionLegend.join('')}</div>`;
}
function shortName(s,n=18){s=String(s||''); return s.length>n?s.slice(0,n-1)+'…':s;}
function sectionTypeAt(i){return ['transfer','scenic','serpentine','scenic','fast','transfer'][Math.max(0,i)%6]||'scenic';}
function robustRoadbookSections(r){const wps=r?.waypoints||[]; const sections=Array.isArray(r?.sections)?r.sections:[]; const out=[]; for(let i=0;i<Math.max(0,wps.length-1);i++){const existing=sections[i]||{}; const a=wps[i], b=wps[i+1]; const type=existing.type||sectionTypeAt(i); const km=Number(existing.km)||Math.max(1,Math.round(hav(a,b)*1.18)); out.push({from:existing.from||a?.name||`Waypoint ${i+1}`,to:existing.to||b?.name||`Waypoint ${i+2}`,type,km,advice:existing.advice||sectionAdvice({type,from:a?.name,to:b?.name,km},a,b),photo:existing.photo,mediaQueries:existing.mediaQueries||existing.photoQuery?[existing.photoQuery].filter(Boolean):undefined});} return out;}
function roadbookItems(r){const wps=r?.waypoints||[]; const secs=robustRoadbookSections(r); const rows=[]; wps.forEach((w,i)=>{rows.push({kind:'waypoint',w,i}); if(secs[i]) rows.push({kind:'section',s:secs[i],i,a:w,b:wps[i+1]});}); return rows;}
function renderInlineRoadbook(r){
  const grid=$('inlineRoadbookList'); if(!grid) return;
  try{
    const secs=robustRoadbookSections(r); const wps=r?.waypoints||[]; const rows=[];
    if(wps[0]) rows.push(inlineWaypointRow(wps[0],0,r));
    secs.forEach((sec,i)=>{rows.push(inlineSectionRow(sec,i,wps[i],wps[i+1],r)); if(wps[i+1]) rows.push(inlineWaypointRow(wps[i+1],i+1,r));});
    grid.innerHTML=rows.join('') || '<div class="inlineRoadbookEmpty">Choose a road trip to load the riding-order roadbook.</div>';
  }catch(err){ console.warn('inline roadbook renderer recovered',err); grid.innerHTML=roadbookFallbackHTML(r); }
  hydrateImages(grid);
}
function inlineWaypointRow(w,i,r){
  const txt=compactWaypointAdvice(w,i,r);
  return `<article class="inlineRoadbookItem checkpointMini" data-wp="${i}" title="${esc(txt)}"><img ${photoAttrs(waypointPhoto(w,r,i),w.name||('Checkpoint '+(i+1)),photoQueriesFor(w,r,w.name||r?.title||'CurveScout checkpoint').join('||'))}><div><b>${i+1}</b><span>${ICON[w.kind]||'•'} checkpoint</span><strong>${esc(roadbookPlaceName(w))}</strong><p>${esc(shortRoadbookText(txt,82))}</p></div></article>`;
}
function inlineSectionRow(s,i,a,b,r){
  const text=richSectionAdvice(s,i,a,b,r);
  return `<article class="inlineRoadbookItem section ${esc(s.type||'road')}" title="${esc(text)}"><img ${photoAttrs(sectionPhoto(s,r,i),(s.from||'section')+' to '+(s.to||''),photoQueriesFor(s,r,[s.from,s.to,s.type,r.region].filter(Boolean).join(' ')).join('||'))}><div><b>${i+1}</b><span>${ICON[s.type]||'〽️'} ${esc(roadbookKindLabel(s.type))} · ${fmtKm(s.km)}</span><strong>${esc(roadbookPlaceName(s.from))} → ${esc(roadbookPlaceName(s.to))}</strong><p>${esc(shortRoadbookText(text,128))}</p><div class="miniPictos"><i title="weather">🌤️</i><i title="traffic">🚦</i><i title="fuel">⛽</i><i title="food">🍽️</i><i title="sights">🏛️</i><i title="water">🏊</i><i title="risk">⚠️</i></div></div></article>`;
}
function renderInlineRoadbook(r){
  const grid=$('inlineRoadbookList'); if(!grid)return;
  try{
    const secs=robustRoadbookSections(r); const wps=(r?.waypoints||rawNavPoints(r)||[]).filter(Boolean);
    if(!secs.length&&!wps.length){grid.innerHTML='<div class="inlineRoadbookEmpty">Choose a road trip to load the roadbook.</div>';return;}
    const rows=[];
    wps.forEach((w,i)=>{rows.push(inlineWaypointRow(w,i,r)); if(secs[i]) rows.push(inlineSectionRow(secs[i],i,w,wps[i+1],r));});
    const lead=`<div class="roadbookBrief"><b>Riding order:</b> compact checkpoint/section preview. Full advice, sights, fuel, food, water, road status and risk notes are in the detailed roadbook below.</div>`;
    grid.innerHTML=lead+`<div class="inlineSections compactRidingOrder">${rows.join('')}</div>`;
    hydrateImages(grid,true);
  }catch(err){
    console.warn('inline roadbook renderer recovered',err);
    grid.innerHTML=roadbookFallbackHTML(r);
    hydrateImages(grid,true);
  }
}

function waypointRow(w,i,r){
  const alt=Number.isFinite(Number(w.alt))?`${Math.round(w.alt)} m`:'altitude check';
  const detail=compactWaypointAdvice(w,i,r);
  const q=w.wiki||w.name||r.title;
  return `<article class="roadbookItem waypointRow compactRoadbookWaypoint" data-wp="${i}" title="${esc(detail)}"><img ${photoAttrs(waypointPhoto(w,r,i),w.name,photoQueriesFor(w,r,w.name).join('||'))}><div><span class="pill waypointPill">${i+1} · ${ICON[w.kind]||'•'} ${esc(waypointRoleLabel(w.kind))} · ${esc(alt)}</span><h3>${esc(w.name)}</h3><p>${esc(detail)}</p><div class="roadbookMeta"><span>${ICON.map} checkpoint</span><span>${ICON.weather} weather glance</span><span>${ICON.traffic} clean rejoin</span></div><div class="nearbyList"><a href="${osmPoint(w)}" target="_blank" rel="noopener" title="Open this waypoint in OpenStreetMap">OSM</a><a href="${googlePoint(w)}" target="_blank" rel="noopener" title="Open this waypoint in Google Maps">Google</a><a href="https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(q)}&title=Special:MediaSearch&type=image" target="_blank" rel="noopener" title="Open Wikimedia image search for this waypoint">Images</a></div></div></article>`;
}
function sectionRow(s,i,a,b,r){
  const q=[s.from,s.to,s.type,r.region].filter(Boolean).join(' ');
  const text=richSectionAdvice(s,i,a,b,r);
  const cards=contextCardsHTML(sectionContextItems(s,i,a,b,r));
  return `<article class="roadbookItem sectionRow richRoadbookSection ${esc(s.type||'road')}" title="${esc(text)}"><img ${photoAttrs(sectionPhoto(s,r,i),(s.from||'section')+' to '+(s.to||''),photoQueriesFor(s,r,q).join('||'))}><div><span class="pill sectionPill">${i+1} · ${ICON[s.type]||'〽️'} ${esc(sectionTypeName(s.type))} · ${fmtKm(s.km)}</span><h3>${esc(s.from)} → ${esc(s.to)}</h3><p>${esc(text)}</p>${cards}<div class="nearbyList"><a href="${nearbyLink(a||b,'restaurants')}" target="_blank" rel="noopener" title="Search restaurants near this section in OpenStreetMap">Restaurants</a><a href="${nearbyLink(a||b,'viewpoint')}" target="_blank" rel="noopener" title="Search viewpoints and sights near this section in OpenStreetMap">Sights</a><a href="${nearbyLink(a||b,'fuel')}" target="_blank" rel="noopener" title="Search fuel near this section in OpenStreetMap">Fuel</a><a href="${nearbyLink(a||b,'swimming')}" target="_blank" rel="noopener" title="Search swim or water stops near this section in OpenStreetMap">Water</a></div></div></article>`;
}
function nearbyLink(p,what){if(!p)return 'https://www.openstreetmap.org/'; return `https://www.openstreetmap.org/search?query=${encodeURIComponent(what+' near '+p.lat+','+p.lon)}`;}
function osmPoint(p){return `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=14/${p.lat}/${p.lon}`;} function googlePoint(p){return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name+' '+p.lat+','+p.lon)}`;}
function rawNavPoints(r){
  const pts=(r?.navPoints&&r.navPoints.length>=2?r.navPoints:r?.waypoints)||[];
  return pts.filter(p=>Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))).map((p,i)=>({name:p.name||`checkpoint ${i+1}`,lat:Number(p.lat),lon:Number(p.lon),kind:p.kind||'checkpoint'}));
}
function samplePoints(pts,max=20){if(!pts||pts.length<=max)return pts||[]; const out=[pts[0]]; for(let i=1;i<max-1;i++)out.push(pts[Math.round(i*(pts.length-1)/(max-1))]); out.push(pts[pts.length-1]); return out;}
function sampleByDistance(pts,max=20){if(!pts||pts.length<=max)return pts||[]; const d=[0]; let total=0; for(let i=1;i<pts.length;i++){total+=hav(pts[i-1],pts[i]); d[i]=total;} const out=[pts[0]]; for(let k=1;k<max-1;k++){const target=total*k/(max-1); let i=1; while(i<d.length&&d[i]<target)i++; const a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i)]; const span=(d[i]-d[i-1])||1; const t=(target-d[i-1])/span; out.push({name:`routed checkpoint ${k+1}`,lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t});} out.push(pts[pts.length-1]); return out;}
function alignedNavPoints(r,max=48){return navWaypoints(r,{max});}
function navWaypoints(r,opts={}){const snapped=state.navSamples.get(routeCacheKey(r)); const pts=(!opts.forRouting && snapped&&snapped.length>=2)?snapped:rawNavPoints(r); return sampleByDistance(pts,opts.max||25);}
function coordString(p){return `${Number(p.lat).toFixed(6)},${Number(p.lon).toFixed(6)}`;}
function googleUrlForPoints(pts){if(!pts||pts.length<2) return 'https://www.google.com/maps'; const origin=coordString(pts[0]); const destination=coordString(pts[pts.length-1]); const vias=pts.slice(1,-1).map(coordString).join('|'); return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${vias?`&waypoints=${encodeURIComponent(vias)}`:''}&travelmode=driving`;}
function splitGoogleRoutePoints(pts,max=10){if(!pts||pts.length<=max) return [pts||[]]; const out=[]; let i=0; while(i<pts.length-1){const end=Math.min(pts.length,i+max); const chunk=pts.slice(i,end); if(chunk.length>=2) out.push(chunk); i=end-1;} return out;}
function googleRoute(r){const pts=alignedNavPoints(r,hasLockedGeometry(r)?48:25); return googleUrlForPoints(splitGoogleRoutePoints(pts,10)[0]||pts);}
function googleRouteLegs(r){const pts=alignedNavPoints(r,hasLockedGeometry(r)?48:25); const chunks=splitGoogleRoutePoints(pts,10); return chunks.map((c,i)=>({label:chunks.length===1?'Google route preview':`Google ${i+1}/${chunks.length}`,href:googleUrlForPoints(c)}));}
function osmRoute(r){const pts=alignedNavPoints(r,48); if(pts.length<2) return 'https://www.openstreetmap.org/'; return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${pts.map(p=>`${p.lat}%2C${p.lon}`).join('%3B')}`;}
function downloadGPX(r=state.selected){if(!r)return; const pts=routeLine(r); const xml=['<?xml version="1.0" encoding="UTF-8"?>','<gpx version="1.1" creator="CurveScout.com" xmlns="http://www.topografix.com/GPX/1/1">',`<metadata><name>${esc(r.title)}</name><desc>${esc(r.slogan)}</desc></metadata>`,...(r.waypoints||[]).map(w=>`<wpt lat="${w.lat}" lon="${w.lon}"><name>${esc(w.name)}</name><desc>${esc(richWaypointAdvice(w,0,r))}</desc></wpt>`),`<trk><name>${esc(r.title)}</name><trkseg>`,...pts.map(p=>`<trkpt lat="${p.lat}" lon="${p.lon}"/>`),'</trkseg></trk></gpx>'].join('\n'); const blob=new Blob([xml],{type:'application/gpx+xml'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=slug(r.title)+'.gpx'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function copyWaypoints(r){const visible=(r.waypoints||[]).map((w,i)=>`${i+1}. ${w.name} — ${w.lat.toFixed(5)}, ${w.lon.toFixed(5)} — ${richWaypointAdvice(w,i,r)}`); const nav=navWaypoints(r,{max:48}).map((w,i)=>`${i+1}. ${Number(w.lat).toFixed(6)},${Number(w.lon).toFixed(6)}${w.name?' — '+w.name:''}`); const txt=[`CURVESCOUT ROADBOOK: ${r.title}`,'','VISIBLE MILESTONES',...visible,'','NAVIGATION CHECKPOINTS FOR GOOGLE/OSM/GPX ALIGNMENT',...nav].join('\n'); navigator.clipboard?.writeText(txt); setStatus('Waypoint and navigation-checkpoint pack copied.');}
function renderNav(r){const googleLinks=googleRouteLegs(r).map(g=>`<a class="googlePill" href="${g.href}" target="_blank" rel="noopener" onclick="window.open(this.href,'_blank','noopener');return false;" title="Open Google Maps with the same\s+ordered roadbook checkpoints.">${esc(g.label)}</a>`).join(''); $('navPanel').innerHTML=`<button class="exact" data-action="gpx" title="Download a GPX with the selected route line and all waypoint coordinates">Download exact GPX</button>${googleLinks}<a class="osmPill" href="${osmRoute(r)}" target="_blank" rel="noopener" title="Open OpenStreetMap directions with the same checkpoint order">OSM route preview</a><button data-action="copy" title="Copy every waypoint with coordinates and riding advice">Copy waypoint pack</button><span class="navIntegrity">Map, GPX and previews follow the same\s+ordered roadbook once the road line is locked.</span>`; $('navPanel').querySelectorAll('[data-action]').forEach(btn=>btn.onclick=()=>{if(btn.dataset.action==='gpx')downloadGPX(r); if(btn.dataset.action==='copy')copyWaypoints(r);});}


/* CurveScout.com v1.4.6: concise riding-order preview + specific, non-repetitive section roadbook. */
function roadbookPlaceName(x){return shortName(String(x?.name||x||'checkpoint').replace(/\s+/g,' ').trim(),34);}
function roadbookKindLabel(kind){const labels={start:'start',finish:'finish',fuel:'fuel',food:'food',sleep:'rest',pass:'pass / high road',high:'high point',swim:'swim / water',sight:'sight',photo:'photo stop',scenic:'scenic checkpoint',transfer:'transfer',serpentine:'serpentines',fast:'faster connector',forest:'forest road',coast:'coast road',connector:'connector',water:'waterline'}; return labels[kind]||kind||'road';}
function roadbookTypeName(type){return roadbookKindLabel(type||'scenic');}
function locationPhrase(x){return roadbookPlaceName(x||'this point');}
function namesForSection(s,a,b,r){return {from:locationPhrase(s?.from||a),to:locationPhrase(s?.to||b),title:String(r?.title||''),region:String(r?.region||'')};}
function sectionHas(s,a,b,r,rx){return rx.test([s?.type,s?.from,s?.to,a?.name,b?.name,a?.kind,b?.kind,r?.title,r?.slogan,r?.region].filter(Boolean).join(' '));}
function sectionTypeText(s,a,b,r){
  const t=String(s?.type||'scenic').toLowerCase(); const n=namesForSection(s,a,b,r); const km=Number(s?.km)?`${Math.round(s.km)} km`:'';
  if(t.includes('transfer')) return {label:'Transfer',text:`Use ${n.from} → ${n.to}${km?` (${km})`:''} to get clear of traffic. Keep it tidy; the good riding starts after this.`};
  if(t.includes('connector')) return {label:'Connector',text:`${n.from} → ${n.to}${km?` (${km})`:''} links the good roads. Watch village limits, side roads and farm traffic.`};
  if(t.includes('serpentine')) return {label:'Serpentines',text:`${n.from} → ${n.to}${km?` (${km})`:''} is the technical part. Look through the bend and leave space for buses, cyclists and gravel.`};
  if(t.includes('fast')) return {label:'Flow',text:`${n.from} → ${n.to}${km?` (${km})`:''} can run quickly, but only between villages. Reset before every junction.`};
  if(t.includes('forest')) return {label:'Forest',text:`${n.from} → ${n.to}${km?` (${km})`:''} is shade and rhythm. Expect damp edges, leaves, deer and gravel from driveways.`};
  if(t.includes('coast')||t.includes('water')) return {label:'Waterline',text:`${n.from} → ${n.to}${km?` (${km})`:''} is the air-and-water section. Tourist traffic and sudden photo stops are the risk.`};
  return {label:'Scenic road',text:`${n.from} → ${n.to}${km?` (${km})`:''} is the riding value. Use legal pull-offs and keep the line calm through villages.`};
}
function localInfoHint(s,a,b,r){
  const n=namesForSection(s,a,b,r); const high=sectionHas(s,a,b,r,/pass|joch|col|furka|grimsel|susten|brünig|bruenig|glauben|klausen|gotthard|tremola|faschina|staffel|passwang/i);
  const water=sectionHas(s,a,b,r,/lake|see|fjord|bay|coast|river|canal|water|swim|strand|beach|loch/i);
  const old=sectionHas(s,a,b,r,/old town|castle|palace|monastery|abbey|bridge|historic|village|schloss|burg|cathedral/i);
  if(high) return `Check road or pass status before ${n.to}; cloud, cold shade and buses change the ride quickly.`;
  if(water) return `Good reset section: watch parked cars, pedestrians and wet surfaces near access points.`;
  if(old) return `Worth a short stop if parking is easy; avoid blocking residents or tight old-town streets.`;
  return `Keep one eye on surface colour, junction density and the next fuel or rest decision.`;
}
function sectionSpecificItems(s,i,a,b,r){
  const items=[]; const t=String(s?.type||'scenic').toLowerCase(); const n=namesForSection(s,a,b,r); const km=Number(s?.km)||0;
  const hasPass=sectionHas(s,a,b,r,/pass|joch|col|furka|grimsel|susten|brünig|bruenig|glauben|klausen|gotthard|tremola|faschina|staffel|passwang/i);
  const hasWater=sectionHas(s,a,b,r,/lake|see|fjord|bay|coast|river|canal|water|swim|strand|beach|loch/i);
  const hasOld=sectionHas(s,a,b,r,/old town|castle|palace|monastery|abbey|bridge|historic|village|schloss|burg|cathedral/i);
  const hasForest=sectionHas(s,a,b,r,/forest|wald|wood|heath|shade|gorge|valley/i)||t.includes('forest');
  const fuelHere=(a?.kind==='fuel'||b?.kind==='fuel'||/fuel|tank|garage/i.test([n.from,n.to].join(' ')));
  const foodHere=(a?.kind==='food'||b?.kind==='food'||/food|coffee|cafe|restaurant|market|old town/i.test([n.from,n.to].join(' ')));
  const swimHere=(a?.kind==='swim'||b?.kind==='swim'||hasWater);
  const sightHere=(a?.kind==='sight'||b?.kind==='sight'||a?.kind==='photo'||b?.kind==='photo'||hasOld||hasPass);
  const add=(key,icon,label,text,href)=>{if(!items.find(x=>x.key===key)) items.push({key,icon,label,text,href});};
  if(t.includes('transfer')) add('traffic','🚦','Traffic',`Leave ${n.from} without burning attention. City exits, lights and commuters are the issue here.`,nearbyLink(a||b,'traffic roadworks'));
  if(t.includes('connector')||t.includes('fast')) add('traffic','🚦','Flow',`This connector can be quick; expect village limits and side roads before ${n.to}.`,nearbyLink(a||b,'roadworks traffic'));
  if(hasPass||t.includes('serpentine')) add('status','🛣️','Road status',`Check opening, roadworks, fog and cold surface before committing to ${n.to}.`,nearbyLink(b||a,'road status pass opening'));
  if(hasPass||t.includes('serpentine')) add('safety','⚠️','Safety',`Buses, cyclists and gravel near apexes matter more than pace on this section.`,nearbyLink(a||b,'hazard road surface'));
  if(hasForest) add('surface','🌲','Surface',`Shaded edges can stay damp; watch leaves, wildlife and gravel from driveways.`,nearbyLink(a||b,'forest road'));
  if(hasWater) add('water','🏊','Water / swim',`Use the water stop only if access and parking are legal; restart warm and dry.`,nearbyLink(b||a,'swimming lake beach'));
  if(fuelHere||km>38||i===0) add('fuel','⛽','Fuel',`Best range check: ${fuelHere?n.to:'before the scenic core'}. Do it before the good road, not after the warning light.`,nearbyLink(a||b,'fuel station'));
  if(foodHere||i===Math.floor((r?.sections||[]).length/2)) add('food','🍽️','Food / rest',`Use ${foodHere?n.to:'the next town'} for coffee or a light stop; heavy food ruins technical focus.`,nearbyLink(b||a,'restaurant cafe'));
  if(sightHere) add('sight','🏛️','Sight / photo',`Short stop candidate near ${n.to}. Park cleanly, take the picture, then leave the road free.`,nearbyLink(b||a,'viewpoint historic sight'));
  if(!items.length) add('road','〽️','Road feel',localInfoHint(s,a,b,r),nearbyLink(a||b,'scenic road'));
  const priority=['status','safety','traffic','surface','fuel','food','sight','water','road'];
  items.sort((x,y)=>priority.indexOf(x.key)-priority.indexOf(y.key));
  return items.slice(0,4);
}
function waypointHumanNote(w,i,r){
  const name=roadbookPlaceName(w); const kind=w?.kind||'scenic';
  const text={
    start:`Start from ${name}. Leave with fuel, weather and the first exit clear in your head.`,
    finish:`Finish at ${name}. Keep concentration through the last local streets; this is still part of the ride.`,
    fuel:`Fuel at ${name}. Clean visor, drink water and check the next section before rolling out.`,
    food:`Food stop at ${name}. Keep it light, check the sky and decide whether the full route still fits.`,
    sleep:`Rest base at ${name}. Stop before fatigue becomes the navigator.`,
    pass:`High-road checkpoint at ${name}. Check opening, cloud and surface before pushing on.`,
    high:`Viewpoint at ${name}. Stop only if the pull-off is legal and easy.`,
    swim:`Water stop at ${name}. Use it as a reset, not as a delay trap.`,
    sight:`Sight stop at ${name}. Short, respectful, cleanly parked.`,
    photo:`Photo point at ${name}. One safe pull-off is enough.`,
    transfer:`Positioning point at ${name}. Stay patient until the good road starts.`,
    scenic:`Checkpoint at ${name}. Read traffic, surface and weather before the next section.`
  };
  return text[kind]||text.scenic;
}
function richWaypointAdvice(w,i=0,r=state.selected){return waypointHumanNote(w,i,r);}
function richSectionAdvice(s,i=0,a=null,b=null,r=state.selected){
  const base=sectionTypeText(s,a,b,r).text;
  const tip=localInfoHint(s,a,b,r);
  return `${base} ${tip}`;
}
function compactSectionText(s,i,a,b,r){return sectionTypeText(s,a,b,r).text;}
function checkpointStripHTML(r){
  const wps=(r?.waypoints||rawNavPoints(r)||[]).filter(Boolean);
  if(!wps.length) return '';
  return `<div class="checkpointStrip" aria-label="Checkpoint order">${wps.map((w,i)=>`<a class="checkpointChip ${esc(w.kind||'checkpoint')}" href="${googlePoint(w)}" target="_blank" rel="noopener" title="${esc(waypointHumanNote(w,i,r))}"><img ${photoAttrs(waypointPhoto(w,r,i),w.name||('checkpoint '+(i+1)),photoQueriesFor(w,r,w.name||r?.title||'CurveScout checkpoint').join('||'))}><span>${i+1}</span><b>${ICON[w.kind]||'•'} ${esc(roadbookPlaceName(w))}</b><small>${esc(roadbookKindLabel(w.kind))}</small></a>`).join('')}</div>`;
}
function sectionRiskListHTML(s,i,a,b,r){
  const items=sectionSpecificItems(s,i,a,b,r);
  return `<div class="sectionInfoGrid">${items.map(x=>`<div class="infoTile ${esc(x.key)}" title="${esc(x.text)}"><b>${x.icon} ${esc(x.label)}</b><span>${esc(x.text)}</span></div>`).join('')}</div>`;
}
function sectionToolsHTML(s,i,a,b,r){
  const items=sectionSpecificItems(s,i,a,b,r).filter(x=>x.href).slice(0,3);
  return `<div class="sectionTools">${items.map(x=>`<a href="${x.href}" target="_blank" rel="noopener" class="toolChip" title="${esc(x.text)}"><span>${x.icon}</span><b>${esc(x.label)}</b></a>`).join('')}</div>`;
}
function inlineWaypointRow(w,i,r){
  const txt=waypointHumanNote(w,i,r);
  return `<article class="inlineRoadbookItem checkpointMini" data-wp="${i}" title="${esc(txt)}"><img ${photoAttrs(waypointPhoto(w,r,i),w.name||('Checkpoint '+(i+1)),photoQueriesFor(w,r,w.name||r?.title||'CurveScout checkpoint').join('||'))}><div><b>${i+1}</b><span>${ICON[w.kind]||'•'} checkpoint</span><strong>${esc(roadbookPlaceName(w))}</strong><p>${esc(shortRoadbookText(txt,70))}</p></div></article>`;
}
function inlineSectionRow(s,i,a,b,r){
  const text=compactSectionText(s,i,a,b,r);
  const items=sectionSpecificItems(s,i,a,b,r).slice(0,4);
  return `<article class="inlineRoadbookItem section ${esc(s.type||'road')}" title="${esc(richSectionAdvice(s,i,a,b,r))}"><img ${photoAttrs(sectionPhoto(s,r,i),(s.from||'section')+' to '+(s.to||''),photoQueriesFor(s,r,[s.from,s.to,s.type,r.region].filter(Boolean).join(' ')).join('||'))}><div><b>${i+1}</b><span>${ICON[s.type]||'〽️'} ${esc(roadbookKindLabel(s.type))} · ${fmtKm(s.km)}</span><strong>${esc(roadbookPlaceName(s.from))} → ${esc(roadbookPlaceName(s.to))}</strong><p>${esc(shortRoadbookText(text,96))}</p><div class="miniPictos">${items.map(x=>`<i title="${esc(x.label+': '+x.text)}">${x.icon}</i>`).join('')}</div></div></article>`;
}
function renderInlineRoadbook(r){
  const grid=$('inlineRoadbookList'); if(!grid)return;
  const secs=robustRoadbookSections(r); const wps=(r?.waypoints||rawNavPoints(r)||[]).filter(Boolean);
  if(!secs.length&&!wps.length){grid.innerHTML='<div class="inlineRoadbookEmpty">Choose a road trip to load the roadbook.</div>';return;}
  const rows=[]; wps.forEach((w,i)=>{if(secs[i]) rows.push(inlineSectionRow(secs[i],i,w,wps[i+1],r));});
  const lead=`<div class="roadbookBrief"><b>Riding order:</b> quick section preview. Full section cards below carry fuel, food, road status, sights, weather and safety.</div>`;
  grid.innerHTML=lead+`<div class="inlineSections compactRidingOrder">${rows.join('')}</div>`;
  hydrateImages(grid,true);
}
function waypointRow(w,i,r){return `<article class="roadbookItem waypointRow checkpointOnly" data-wp="${i}" title="${esc(waypointHumanNote(w,i,r))}"><img ${photoAttrs(waypointPhoto(w,r,i),w.name||('Checkpoint '+(i+1)),photoQueriesFor(w,r,w.name||r?.title||'CurveScout checkpoint').join('||'))}><div><span class="pill">${i+1} · ${ICON[w.kind]||'•'} checkpoint</span><h3>${esc(w.name||('Checkpoint '+(i+1)))}</h3><p>${esc(waypointHumanNote(w,i,r))}</p><div class="nearbyList"><a href="${osmPoint(w)}" target="_blank" rel="noopener">OSM</a><a href="${googlePoint(w)}" target="_blank" rel="noopener">Google</a><a href="https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(w.wiki||w.name||r.title)}&title=Special:MediaSearch&type=image" target="_blank" rel="noopener">Images</a></div></div></article>`;}
function sectionRow(s,i,a,b,r){
  const text=richSectionAdvice(s,i,a,b,r); const q=[s.from,s.to,s.type,r?.region].filter(Boolean).join(' ');
  return `<article class="roadbookItem sectionRow proSection" title="${esc(text)}"><img ${photoAttrs(sectionPhoto(s,r,i),(s.from||'section')+' to '+(s.to||''),photoQueriesFor(s,r,q).join('||'))}><div class="sectionBody"><div class="sectionTop"><span class="pill">${i+1} · ${ICON[s.type]||'〽️'} ${esc(roadbookKindLabel(s.type))} · ${fmtKm(s.km)}</span><span class="sectionEnds">${esc(roadbookPlaceName(s.from))} → ${esc(roadbookPlaceName(s.to))}</span></div><h3>${esc(s.from)} → ${esc(s.to)}</h3><p class="sectionNarrative">${esc(text)}</p>${sectionRiskListHTML(s,i,a,b,r)}${sectionToolsHTML(s,i,a,b,r)}</div></article>`;
}
function renderRoadbook(r){
  const grid=$('roadbookGrid'); if(!grid)return;
  try{
    const wps=(r?.waypoints||rawNavPoints(r)||[]).filter(Boolean); const secs=robustRoadbookSections(r);
    if(!wps.length&&!secs.length){grid.innerHTML='<div class="roadbookEmpty">Choose a road trip to load the road sections and checkpoints.</div>';return;}
    const checkpointIntro=`<section class="roadbookCheckpoints"><h3>Checkpoint order</h3><p>Short map anchors only. Road sections carry the advice.</p>${checkpointStripHTML(r)}</section>`;
    const sectionIntro=`<section class="roadbookSections"><h3>Road sections</h3><p>Only the useful cards are shown: status, safety, traffic, fuel, food, sights or water depending on the section.</p>${secs.map((s,i)=>sectionRow(s,i,wps[i],wps[i+1],r)).join('')}</section>`;
    grid.innerHTML=checkpointIntro+sectionIntro; hydrateImages(grid);
  }catch(err){
    console.warn('full roadbook renderer recovered',err);
    grid.innerHTML=roadbookFallbackHTML(r); hydrateImages(grid);
  }
}
function roadbookFallbackHTML(r){const wps=(r?.waypoints||rawNavPoints(r)||[]).filter(Boolean); const secs=robustRoadbookSections({waypoints:wps,sections:r?.sections||[]}); return `<section class="roadbookCheckpoints">${checkpointStripHTML({...(r||{}),waypoints:wps})}</section><section class="roadbookSections">${secs.map((s,i)=>sectionRow(s,i,wps[i],wps[i+1],r)).join('')}</section>`;}

function startMediaPump(){
  if(state.mediaPumpStarted) return;
  state.mediaPumpStarted=true;
  const tick=()=>{
    hydrateImages(document,true);
    mediaSweep();
    if(state.selected){warmRouteMedia(state.selected); prefetchTripMedia(state.selected);}
    preloadRankedMedia();
  };
  [80,300,750,1400,2600,5200,9000,15000].forEach(ms=>setTimeout(tick,ms));
  setInterval(tick,3800);
  window.addEventListener('online',tick);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) tick();});
}


function ensureRoadbookVisible(){
  try{
    if(!state.selected) return;
    const inline=$('inlineRoadbookList');
    const full=$('roadbookGrid');
    const inlineHas=inline && inline.querySelector('.inlineRoadbookItem');
    const fullHas=full && (full.querySelector('.roadbookItem') || full.querySelector('.sectionRow') || full.querySelector('.checkpointChip'));
    if(inline && !inlineHas) renderInlineRoadbook(state.selected);
    if(full && !fullHas) renderRoadbook(state.selected);
  }catch(err){
    console.warn('roadbook visibility repair failed',err);
  }
}

function bootWatchdog(){
  try{
    const hasCards=Boolean(document.querySelector('#candidateList .tripCard'));
    if(!hasCards){ ensureRanked(state.lastQuery||'Zurich'); renderCandidates(); }
    const title=$('selectedTitle')?.textContent||'';
    if((!state.selected || /Choose a road trip/i.test(title)) && state.ranked?.[0]) selectRoute(state.ranked[0],false);
    if(state.selected && !$('mainMap')?.querySelector('.mapOverlay')){ fitMap(state.selected); renderMainMap(); } ensureRoadbookVisible();
  }catch(e){console.warn('boot watchdog recovered',e);}
}
function init(){document.querySelectorAll('.navBtn[data-target]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.target)?.scrollIntoView({behavior:'smooth'})); $('searchForm').addEventListener('submit',e=>{e.preventDefault();search(false)}); $('startInput').addEventListener('change',()=>search(false)); $('finishInput')?.addEventListener('change',()=>search(false)); $('rangeInput').addEventListener('change',()=>search(false)); $('styleInput').addEventListener('change',()=>search(false)); $('geoBtn').onclick=()=>search(true); $('snapBtn').onclick=()=>snapSelected(); $('backTop').onclick=()=>scrollTo({top:0,behavior:'smooth'}); addEventListener('resize',()=>{if(state.selected){fitMap(state.selected);renderProfile(state.selected);}}); addEventListener('scroll',()=>{$('backTop').classList.toggle('show',scrollY>600)}); startMediaPump(); state.start=HOME; state.end=HOME; state.range=Number($('rangeInput')?.value)||260; state.ranked=rankRoutes(HOME,state.range,'Zurich',HOME); if($('startInput')) $('startInput').value=HOME.label; if($('finishInput')) $('finishInput').value=''; renderCandidates(); selectRoute(state.ranked[0],false); snapSelected(); setTimeout(bootWatchdog,350); setTimeout(bootWatchdog,1200); setInterval(bootWatchdog,4200); setStatus('Ready. Start is Zurich by default; leave finish empty for a loop or set a finish place for a one-way road trip.');}
if(typeof window!=='undefined'){window.CurveScoutAudit={version:'1.4.6',rankRoutes,anchorRouteToStart,deriveScenicCore,optimizeCoreOrder,routeCoreDistance,rawNavPoints,navWaypoints,googleRoute,osmRoute,routeCacheKey,hasLockedGeometry,LOCAL_PLACES,routePhoto,waypointPhoto,sectionPhoto,directMediaCandidates,richWaypointAdvice,robustRoadbookSections,roadbookItems,splitMediaList,currentLocation}; if(window.CURVESCOUT_DEBUG){window.CURVESCOUT_DEBUG_API=window.CurveScoutAudit;}}
window.addEventListener('error',e=>{try{setStatus('CurveScout recovered from a runtime issue and kept the road-trip list alive.'); console.warn(e.error||e.message); ensureRoadbookVisible(); renderCandidates();}catch(_){}});
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();

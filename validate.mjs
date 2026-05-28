import fs from 'fs';
const routes=JSON.parse(fs.readFileSync('data/routes.json','utf8'));
function slug(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function hav(a,b){const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLon=(b.lon-a.lon)*Math.PI/180,la1=a.lat*Math.PI/180,la2=b.lat*Math.PI/180;const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
function center(r){const pts=r.waypoints||[]; return pts.length?pts.reduce((a,p)=>({lat:a.lat+p.lat/pts.length,lon:a.lon+p.lon/pts.length}),{lat:0,lon:0}):(r.center||{lat:0,lon:0});}
function dist(p,r){const pts=r.waypoints||[]; let d=hav(p,center(r)); for(const w of pts) d=Math.min(d,hav(p,w)); return d;}
const places={hannover:{lat:52.3759,lon:9.732},hamburg:{lat:53.5511,lon:9.9937},paris:{lat:48.8566,lon:2.3522},london:{lat:51.5072,lon:-0.1276},tokyo:{lat:35.6762,lon:139.6503},lyon:{lat:45.764,lon:4.8357},moscow:{lat:55.7558,lon:37.6173},'new york':{lat:40.7128,lon:-74.006},thalwil:{lat:47.2913,lon:8.5635}};
for (const [name,base] of Object.entries(places)){
  const maxNear=name==='new york'||name==='moscow'||name==='tokyo'?520:420;
  const near=routes.filter(r=>dist(base,r)<=maxNear || [r.region,r.title,...(r.aliases||[])].join(' ').toLowerCase().includes(name)).sort((a,b)=>dist(base,a)-dist(base,b)).slice(0,20);
  if(near.length<20) throw new Error(`${name}: only ${near.length} route candidates`);
  if(name==='hannover' && near.some(r=>/furka|grimsel|susten|alpine/.test(slug(r.title)))) throw new Error('hannover contaminated by alpine classics');
  console.log(`${name}: ${near.length} candidates, first=${near[0].title}`);
}

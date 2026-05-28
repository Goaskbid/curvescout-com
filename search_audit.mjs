import fs from 'fs';
import vm from 'vm';
import path from 'path';
const root=process.cwd();
const context={console,navigator:{geolocation:{getCurrentPosition(){}}},document:{readyState:'loading',addEventListener(){},querySelector(){return {src:''}},querySelectorAll(){return []},getElementById(){return null}},addEventListener(){},setTimeout,clearTimeout,fetch(){return Promise.reject(new Error('network disabled in audit'));}};
context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'data/routes.js'),'utf8'),context,{filename:'routes.js'});
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context,{filename:'app.js'});
const api=context.window.CurveScoutAudit;
if(!api) throw new Error('CurveScoutAudit API missing');
const cases=[
  {label:'Zurich',lat:47.3769,lon:8.5417,query:'Zurich'},
  {label:'Lucerne',lat:47.0502,lon:8.3093,query:'Lucerne'},
  {label:'Kiel',lat:54.3233,lon:10.1228,query:'Kiel'},
  {label:'Hamburg',lat:53.5511,lon:9.9937,query:'Hamburg'},
  {label:'Berlin',lat:52.52,lon:13.405,query:'Berlin'}
];
const bad=[];
for(const c of cases){
  const list=api.rankRoutes(c,260,c.query).slice(0,10);
  if(list.length<10) bad.push(`${c.label}: fewer than 10 candidates (${list.length})`);
  for(const r of list){
    const first=r.waypoints?.[0]; const last=r.waypoints?.[r.waypoints.length-1];
    const firstName=String(first?.name||'').toLowerCase(); const lastName=String(last?.name||'').toLowerCase();
    if(!firstName.includes(c.label.toLowerCase())) bad.push(`${c.label}/${r.title}: first waypoint is not selected start (${first?.name})`);
    if(!lastName.includes(c.label.toLowerCase())) bad.push(`${c.label}/${r.title}: last waypoint is not selected finish (${last?.name})`);
    if(!r.transferModel?.optimized) bad.push(`${c.label}/${r.title}: transfer model not optimized`);
    if(!r.coreEntry?.name || !r.coreExit?.name) bad.push(`${c.label}/${r.title}: entry/exit missing`);
    if(/thalwil/i.test(firstName) && !/thalwil/i.test(c.label)) bad.push(`${c.label}/${r.title}: inherited Thalwil start visible`);
    const nav=api.rawNavPoints(r); if(nav.length<r.waypoints.length) bad.push(`${c.label}/${r.title}: nav chain shorter than waypoint chain`);
  }
}
if(bad.length){console.error(bad.join('\n')); process.exit(1);}
console.log('CurveScout.com v1.4.5 transfer audit ok:', cases.map(c=>c.label).join(', '));

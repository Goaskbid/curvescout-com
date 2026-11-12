/* CurveScout Calendar core. Deterministic, dependency-free, no network or DOM. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CSCalendarCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='2.0.0',DAY=86400000;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;}
function epoch(s){const n=typeof s==='number'?s:Date.parse(s);return Number.isFinite(n)?n:null;}
function utcDay(s,offset=0){if(!validDate(s))return null;return new Date(Date.parse(s+'T12:00:00Z')+offset*DAY).toISOString().slice(0,10);}
const fmtCache=new Map();
function localParts(at,tz){const n=epoch(at);if(n===null||!tz)return null;try{let f=fmtCache.get(tz);if(!f){f=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});fmtCache.set(tz,f);}const p=Object.fromEntries(f.formatToParts(new Date(n)).map(x=>[x.type,x.value]));const date=p.year+'-'+p.month+'-'+p.day;return {date,month:+p.month,year:+p.year,minutes:(+p.hour%24)*60+(+p.minute),seconds:+p.second,weekday:new Date(date+'T12:00:00Z').getUTCDay()};}catch(e){return null;}}
function timeMinutes(t){if(t==='24:00')return 1440;if(!/^\d{2}:\d{2}$/.test(t||''))return null;const [h,m]=t.split(':').map(Number);return h<24&&m<60?h*60+m:null;}
/* Returns zero, one or two instants. DST gaps and repeated clocks are explicit. */
function wallInstants(date,time,tz){if(!validDate(date)||timeMinutes(time)===null||time==='24:00')return [];const base=Date.parse(date+'T'+time+':00Z'),out=[];const offsets=new Set();for(const h of [-36,-24,-12,0,12,24,36]){const t=base+h*3600000,p=localParts(t,tz);if(p){const wall=Date.parse(p.date+'T'+String(Math.floor(p.minutes/60)).padStart(2,'0')+':'+String(p.minutes%60).padStart(2,'0')+':00Z');offsets.add(wall-t);}}for(const off of offsets){const t=base-off,p=localParts(t,tz);if(p&&p.date===date&&p.minutes===timeMinutes(time))out.push(new Date(t).toISOString());}return [...new Set(out)].sort();}
function inSeason(date,start,end){const md=date.slice(5);return start<=end?md>=start&&md<=end:md>=start||md<=end;}
function sourceUsable(source){return !!(source&&/^https:\/\//.test(source.url)&&['official','operator'].includes(source.kind));}
function effectAt(rule,at,ctx={}){
 const p=localParts(at,rule.timeZone);if(!p)return {state:'review',reason:'Road time zone or arrival time is missing.'};
 const now=epoch(ctx.now||Date.now());
 const scope=rule.vehicleTypes||[];const vt=ctx.vehicleType||'motorcycle';
 if(!scope.includes('all')&&!scope.includes(vt))return {state:'not_applicable',reason:'Vehicle class outside this rule.'};
 if(rule.singleTrackOnly&&ctx.singleTrack===false)return {state:'not_applicable',reason:'Rule is for single-track vehicles.'};
 if(rule.phase==='entry'&&ctx.phase==='unknown')return {state:'review',reason:'The road is mapped, but passage through the admission gate is not established.'};
 if(rule.phase==='entry'&&ctx.phase==='transit')return {state:'not_applicable',reason:'Admission-time rule only.'};
 if(rule.absoluteStart){const t=epoch(at),a=epoch(rule.absoluteStart),b=epoch(rule.absoluteEnd);if(a===null||b===null)return {state:'review',reason:'Invalid absolute schedule.'};if(t<a)return {state:'not_active',reason:'Closure has not begun.'};if(t>=b)return rule.plannedEnd?{state:'review',reason:'Planned reopening passed; an actual opening confirmation is needed.'}:{state:'not_active',reason:'Dated rule ended.'};}
 else {
  const start=timeMinutes(rule.timeStart),end=timeMinutes(rule.timeEnd);if(start===null||end===null)return {state:'review',reason:'Rule time is invalid.'};
  const overnight=end<start;let anchor=p.date;
  let clock=(start===end)||(overnight?(p.minutes>=start||p.minutes<end):(p.minutes>=start&&p.minutes<end));
  if(rule.boundaryExclusive&&p.minutes===start&&p.seconds===0)clock=false;
  if(overnight&&p.minutes<end)anchor=utcDay(anchor,-1);
  if(anchor<rule.validFrom||anchor>rule.validUntil)return {state:anchor>rule.validUntil?'expired':'not_active',reason:anchor>rule.validUntil?'This source does not establish the rule for that year.':'Before the rule starts.'};
  if(!inSeason(anchor,rule.seasonStart,rule.seasonEnd))return {state:'not_active',reason:'Outside the published seasonal interval.'};
  if(!clock)return {state:'not_active',reason:'Outside these restricted hours.'};
  if(rule.boundaryReview&&(p.date.slice(5)===rule.seasonStart||p.date.slice(5)===rule.seasonEnd||p.date.slice(5)===utcDay(p.date.slice(0,4)+'-'+rule.seasonEnd,1)?.slice(5)))return {state:'review',reason:'Verify the authority notice for the exact first or final overnight boundary.'};
  const wd=new Date(anchor+'T12:00:00Z').getUTCDay();
  if(rule.weekdays&&!rule.weekdays.includes(wd))return {state:'not_active',reason:'Outside the published weekdays.'};
  if(rule.publicHolidays){if(!Array.isArray(ctx.holidays))return {state:'review',reason:'Jurisdiction holiday calendar missing.'};if(!ctx.holidays.includes(anchor))return {state:'not_active',reason:'Not a published local public holiday.'};}
 }
 if(rule.direction!=='both'&&ctx.direction!==rule.direction)return ctx.direction?{state:'not_applicable',reason:'Opposite direction.'}:{state:'review',reason:'Travel direction must be resolved.'};
 if(rule.noiseAboveDbA!==undefined){if(!finite(ctx.noiseDbA))return {state:'review',reason:'Registered stationary noise is needed, not a phone noise reading.'};if(ctx.noiseDbA<=rule.noiseAboveDbA)return {state:'not_applicable',reason:'Registered noise is not above the threshold.'};if(rule.singleTrackOnly&&ctx.singleTrack==null)return {state:'review',reason:'Confirm single-track motorcycle class.'};}
 if(rule.exceptions&&rule.exceptions.includes(ctx.vehicleSubclass))return {state:'not_applicable',reason:'Published vehicle exception.'};
 if(ctx.authorisationClaimed&&rule.exceptions?.includes('documented-authorisation'))return {state:'review',reason:'Authority-specific exemption needs document verification.'};
 if(rule.reviewState!=='researched'&&rule.reviewState!=='approved')return {state:'review',reason:'Source record is not reviewed.'};
 if(now!==null&&validDate(rule.reviewDue)&&now>Date.parse(rule.reviewDue+'T23:59:59Z'))return {state:'review',reason:'Legal-source recheck is overdue; prior restriction is retained for review.'};
 return {state:rule.effect==='prohibited'?'blocked':'obligation',reason:rule.summary};
}
function evaluateRule(rule,ctx={}){
 const start=epoch(ctx.at||ctx.arrivalAt),end=rule.phase==='entry'?start:epoch(ctx.leaveAt||ctx.at||ctx.arrivalAt);
 if(start===null||end===null||end<start)return {ruleId:rule.id,state:'review',reason:'Valid arrival and departure instants are required.'};
 if(end-start>2*DAY)return {ruleId:rule.id,state:'review',reason:'Split long journeys into road-level visits before evaluating time rules.'};
 let worst={state:'not_active',reason:'No restriction in this interval.'};const priority={blocked:7,obligation:6,review:5,expired:4,not_active:1,not_applicable:0};
 // Evaluate every minute and both endpoints; times in this schema have minute precision.
 // Transit uses an exclusive end so arrival at the end of a closed window is not misclassified.
 const times=[start];for(let t=Math.floor(start/60000)*60000+60000;t<end;t+=60000)times.push(t);if(end>start)times.push(end-1);
 for(const t of times){const r=effectAt(rule,t,ctx);if(priority[r.state]>priority[worst.state])worst=r;if(r.state==='blocked')break;}
 // Preserve not-applicable for a point event rather than the initial not-active default.
 if(start===end)worst=effectAt(rule,start,ctx);
 return {ruleId:rule.id,...worst};
}
function statusAt(observations,at,now=Date.now(),sourceMap={}){
 const instant=epoch(at),n=epoch(now);if(instant===null||n===null)return {state:'unknown',reason:'Invalid time.'};
 const valid=[];let stale=false;
 for(const o of observations||[]){if(!sourceUsable(sourceMap[o.sourceId])||!['official','operator'].includes(o.authority)||!['open','closed','restricted'].includes(o.state))continue;
  const checked=epoch(o.checkedAt),issued=epoch(o.issuedAt),from=epoch(o.validFrom),to=epoch(o.validUntil),expires=epoch(o.expiresAt);
  if([checked,issued,from,to,expires].some(x=>x===null)||checked>n+300000||issued>n+300000||to<=from||expires<checked)continue;
  const ttl=sourceMap[o.sourceId].maxAgeSeconds;const deadline=finite(ttl)?Math.min(expires,issued+ttl*1000):expires;if(n>=deadline){stale=true;continue;}if(instant<from||instant>=to)continue;if(o.state==='open'&&instant>=deadline)continue;
  if(o.state==='open'&&o.scope!=='whole_road'){valid.push({...o,state:'restricted'});continue;}valid.push(o);
 }
 if(!valid.length)return {state:stale?'stale':'unknown',reason:stale?'Last verified observation expired.':'No current official observation covers this instant.'};
 const states=new Set(valid.map(x=>x.state));if(states.has('closed')&&states.has('open'))return {state:'conflict',reason:'Overlapping official observations disagree; retain the closure.',observations:valid};
 const state=states.has('closed')?'closed':states.has('restricted')?'restricted':'open';return {state,reason:state==='open'?'Official observation covers this interval; not a guarantee of conditions.':'Official restriction applies.',observations:valid};
}
function weatherAssessment(weather,at,now=Date.now()){
 const t=epoch(at),n=epoch(now);if(!weather||t===null||n===null)return {state:'unknown',reasons:['No forecast for the road and arrival time.'],penalty:null};
 if(epoch(weather.issuedAt)===null||epoch(weather.expiresAt)===null||epoch(weather.issuedAt)>n+300000||n>=epoch(weather.expiresAt))return {state:'unknown',reasons:['Forecast missing, future-dated or stale.'],penalty:null};
 if(epoch(weather.validFrom)===null||epoch(weather.validUntil)===null||epoch(weather.validUntil)<=epoch(weather.validFrom)||t<epoch(weather.validFrom)||t>=epoch(weather.validUntil)||!Array.isArray(weather.samples)||!weather.samples.length)return {state:'unknown',reasons:['Arrival falls outside forecast coverage.'],penalty:null};
 const reasons=[];let penalty=0,complete=true,severe=false;
 for(const s of weather.samples){
  // A reported hazard is not erased by missing wind or temperature fields.
  if(s.snowfallMmH>0||s.officialIce===true||s.officialFlood===true||s.officialClosure===true){reasons.push('Snow or an official ice, flood or closure signal requires a different plan.');severe=true;penalty=100;}
  if(![s.airTempC,s.precipMmH,s.gustKmh].every(finite)||s.valid!==true)complete=false;
  if(finite(s.airTempC)&&s.airTempC<=2){reasons.push('Low air temperature: check for ice; road temperature is not measured.');penalty=Math.max(penalty,30);}
  if(finite(s.gustKmh)&&s.gustKmh>=50){reasons.push('Strong gusts in the sampled road interval.');penalty=Math.max(penalty,35);}
  if(finite(s.precipMmH)&&s.precipMmH>=4){reasons.push('Heavy precipitation in the sampled road interval.');penalty=Math.max(penalty,25);}
  if(s.snowfallMmH>0||s.officialIce===true||s.officialFlood===true||s.officialClosure===true){reasons.push('Snow or an official ice, flood or closure signal requires a different plan.');severe=true;penalty=100;}
 }
 if(!complete||weather.routeCoverage!==1)return {state:severe?'avoid':'incomplete',reasons:[...new Set(reasons),'Forecast coverage is incomplete; missing data do not improve the result.'],penalty:severe?100:null};
 return {state:severe?'avoid':penalty?'caution':'no_flag',reasons:[...new Set(reasons)],penalty};
}
function seasonAt(profile,month){return profile&&Number.isInteger(month)&&month>=1&&month<=12?{state:profile.months[month-1],basis:profile.basis,summary:profile.summary,forecast:false}:{state:'unrated',basis:'missing',summary:'No reviewed seasonal profile. Altitude or hemisphere alone is not a riding-season model.',forecast:false};}
function assessRoute(route,ctx,data,sources){
 const sourceMap=Object.fromEntries((sources||[]).map(x=>[x.id,x]));const targets=new Set(route.confirmedTargetIds||[]);const matched=data.passes.filter(p=>targets.has(p.id));
 const ruleResults=[],statusResults=[];let missingVisit=false;
 for(const p of matched){const visits=(route.visits||[]).filter(v=>v.targetId===p.id);
  if(!visits.length){missingVisit=true;statusResults.push({targetId:p.id,state:'unknown',reason:'No road-specific arrival and departure estimate.'});continue;}
  for(let i=0;i<visits.length;i++){const visit=visits[i];if(epoch(visit.at)===null||epoch(visit.leaveAt)===null||epoch(visit.leaveAt)<epoch(visit.at)){missingVisit=true;continue;}
   for(const r of data.rules){if(!r.targetIds.includes(p.id))continue;const evaluated=sourceUsable(sourceMap[r.sourceId])?evaluateRule(r,{...ctx,...visit,phase:visit.phase||'unknown',now:ctx.now}):{ruleId:r.id,state:'review',reason:'Rule authority has not been established.'};ruleResults.push({...evaluated,targetId:p.id,visitIndex:i});}
   const start=statusAt(p.statusObservations,visit.at,ctx.now,sourceMap),end=statusAt(p.statusObservations,Math.max(epoch(visit.at),epoch(visit.leaveAt)-1),ctx.now,sourceMap);
   const priorities={closed:6,conflict:5,restricted:4,stale:3,unknown:2,open:1};
   // Evaluate interval boundaries too. A closure beginning between two open samples is not missed.
   const checks=[start,end];for(const o of p.statusObservations||[]){const ttl=sourceMap[o.sourceId]?.maxAgeSeconds;const extra=finite(ttl)&&epoch(o.issuedAt)!==null?epoch(o.issuedAt)+ttl*1000:null;if(extra!==null&&extra>epoch(visit.at)&&extra<epoch(visit.leaveAt))checks.push(statusAt(p.statusObservations,extra,ctx.now,sourceMap));for(const key of ['validFrom','validUntil','expiresAt']){const t=epoch(o[key]);if(t!==null&&t>epoch(visit.at)&&t<epoch(visit.leaveAt))checks.push(statusAt(p.statusObservations,t,ctx.now,sourceMap));}}
   const worst=checks.sort((a,b)=>priorities[b.state]-priorities[a.state])[0];statusResults.push({targetId:p.id,visitIndex:i,...worst});
  }
 }
 const wx=weatherAssessment(ctx.weather||route.weather,ctx.at,ctx.now);const blockers=ruleResults.filter(r=>r.state==='blocked').concat(statusResults.filter(r=>r.state==='closed'||r.state==='conflict'));
 const uncertain=!targets.size||matched.length!==targets.size||missingVisit||route.bindingApproved!==true||route.coverageComplete!==true||statusResults.some(r=>r.state!=='open')||ruleResults.some(r=>['review','expired','obligation'].includes(r.state));
 const evidenceGate=route.bindingApproved===true;
 const eligibility=blockers.length&&evidenceGate?'blocked':uncertain?'review':'no_recorded_restriction';
 return {eligibility,blockers:evidenceGate?blockers:[],candidateWarnings:!evidenceGate?blockers:[],rules:ruleResults,statuses:statusResults,weather:wx,confirmedTargets:matched.length,coverageComplete:route.coverageComplete===true,seasonProfiles:[...new Set(matched.map(p=>p.seasonProfileId).filter(Boolean))],explanation:eligibility==='blocked'?'A dated restriction affects this mapped road.':eligibility==='review'?'Coverage or evidence is incomplete. Check the source before committing.':'No recorded restriction in the assessed scope. This is not legal or road-safety clearance.'};
}
function rankRoutes(routes,ctx,data,sources,{hideBlocked=false,preferConditions=false}={}){return routes.map((route,index)=>({route,index,assessment:assessRoute(route,ctx,data,sources)})).filter(x=>!hideBlocked||x.assessment.eligibility!=='blocked').sort((a,b)=>{const p={no_recorded_restriction:0,review:1,blocked:2},w={no_flag:0,caution:1,avoid:2,incomplete:3,unknown:3};return p[a.assessment.eligibility]-p[b.assessment.eligibility]||(preferConditions?w[a.assessment.weather.state]-w[b.assessment.weather.state]:0)||a.index-b.index;});}
function nextRuleChanges(rules,targetIds,fromDate,days=30){
 if(!validDate(fromDate)||!Number.isInteger(days)||days<1||days>366)return [];
 const ids=new Set(targetIds),out=[];
 for(const r of rules.filter(r=>r.targetIds.some(id=>ids.has(id)))){
  const dates=new Set();if(r.absoluteStart)dates.add(localParts(r.absoluteStart,r.timeZone)?.date);if(r.absoluteEnd)dates.add(localParts(r.absoluteEnd,r.timeZone)?.date);
  for(const y of (r.absoluteStart||(r.seasonStart==='01-01'&&r.seasonEnd==='12-31')?[]:[+fromDate.slice(0,4),+fromDate.slice(0,4)+1])){dates.add(y+'-'+r.seasonStart);const end=y+'-'+r.seasonEnd;if(validDate(end))dates.add(utcDay(end,1));}
  for(const date of dates){if(validDate(date)&&date>=fromDate&&date<=utcDay(fromDate,days)&&date>=r.validFrom&&date<=utcDay(r.validUntil,1))out.push({date,ruleId:r.id,title:r.title,targetIds:r.targetIds,planned:!!r.plannedEnd,kind:'scheduled_change',message:'Published schedule boundary. Recheck the authority; not an opening confirmation.'});}
 }
 return out.sort((a,b)=>a.date.localeCompare(b.date));
}
function semanticState(record,sourceMap,now){const s=statusAt(record.statusObservations,now,now,sourceMap);return {state:s.state,restrictions:record.ruleRevision||null,plannedOpening:record.plannedOpening||null};}
function diffWatched(previous,records,watched,sourceMap,now){const events=[],next={...previous};for(const id of watched){const r=records.find(x=>x.id===id);if(!r)continue;const state=semanticState(r,sourceMap,now),v=JSON.stringify(state),old=previous[id];next[id]=v;if(old&&old!==v){let a;try{a=JSON.parse(old);}catch(e){a={state:'unknown'};}events.push({id:id+'|'+old+'|'+v,targetId:id,title:r.name,from:a.state,to:state.state,kind:['stale','unknown'].includes(state.state)?'refresh_needed':state.restrictions!==a.restrictions?'rule_change':'status_change',at:new Date(now).toISOString()});}}return {events,next};}
function percentile(a,p){if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y),n=(b.length-1)*p,l=Math.floor(n);return b[l]+(b[Math.ceil(n)]-b[l])*(n-l);}
function historicalWindow(rows,targetId){const all=rows.filter(r=>r.targetId===targetId),used=all.filter(r=>(r.openingComparable??r.comparable)&&validDate(r.opened)&&validDate(r.closed));const day=s=>Math.round((Date.parse('2000-'+s.slice(5)+'T12:00:00Z')-Date.parse('2000-01-01T12:00:00Z'))/DAY);return {n:used.length,excluded:all.length-used.length,firstYear:used.length?Math.min(...used.map(r=>r.year)):null,lastYear:used.length?Math.max(...used.map(r=>r.year)):null,opening:used.length>=5?{p10:percentile(used.map(r=>day(r.opened)),.1),median:percentile(used.map(r=>day(r.opened)),.5),p90:percentile(used.map(r=>day(r.opened)),.9)}:null,label:'Historical sample only. Not an opening prediction or probability.'};}
function escapeICS(s){return String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r/g,'');}
function fold(s){const enc=new TextEncoder();let out='',line='',n=0;for(const c of s){const len=enc.encode(c).length;if(n+len>73){out+=line+'\r\n';line=' ';n=1;}line+=c;n+=len;}return out+line;}
function reminderICS(record,date,now=Date.now()){if(!validDate(date))throw new Error('Valid date required');const stamp=new Date(now).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');const fields=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CurveScout//Road Check Reminder//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+escapeICS(record.id)+'-'+date+'@curvescout.com','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+date.replace(/-/g,''),'DTEND;VALUE=DATE:'+utcDay(date,1).replace(/-/g,''),'SUMMARY:'+escapeICS('Check road status: '+record.name),'DESCRIPTION:'+escapeICS('Reminder to check official road status, motorcycle rules and weather. This is not a road opening confirmation. Saved locally from CurveScout.'),'END:VEVENT','END:VCALENDAR'];return fields.map(fold).join('\r\n')+'\r\n';}
function validateData(d,sources){const errors=[],ids=new Set(),sids=new Set(sources.map(s=>s.id));if(d.schemaVersion!==1)errors.push('Unsupported schema');for(const p of d.passes||[]){if(!/^[a-z0-9-]+$/.test(p.id)||ids.has(p.id))errors.push('Invalid/duplicate target '+p.id);ids.add(p.id);if((p.lat!==null&&!finite(p.lat))||(p.lon!==null&&!finite(p.lon)))errors.push('Invalid coordinates '+p.id);if(p.lat!==null&&Math.abs(p.lat)>90||p.lon!==null&&Math.abs(p.lon)>180)errors.push('Out of range '+p.id);for(const s of p.sourceIds||[])if(!sids.has(s))errors.push('Unknown source '+s);}
 for(const r of d.rules||[]){if(!sids.has(r.sourceId))errors.push('Unknown rule source');for(const id of r.targetIds)if(!ids.has(id))errors.push('Unresolved rule target '+id);if(!validDate(r.validFrom)||!validDate(r.validUntil)||r.validUntil<r.validFrom)errors.push('Invalid rule validity '+r.id);if(!localParts(Date.now(),r.timeZone))errors.push('Invalid rule zone');}
 for(const p of d.seasons||[])if(!Array.isArray(p.months)||p.months.length!==12)errors.push('Missing months '+p.id);
 return errors;
}
/* v2: saved trips are local plans. No function here changes a route or grants access. */
function stableJSON(value) {
 if (Array.isArray(value)) return '[' + value.map(stableJSON).join(',') + ']';
 if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableJSON(value[k])).join(',') + '}';
 return JSON.stringify(value);
}
function validateTrip(plan, data) {
 const errors=[], ids=new Set((data.passes||[]).map(p=>p.id));
 if (!plan || typeof plan !== 'object') return ['A trip object is required.'];
 if (typeof plan.id!=='string'||(!/^[a-zA-Z0-9_-]{1,100}$/.test(plan.id)||['__proto__','constructor','prototype'].includes(plan.id))) errors.push('Trip ID is invalid.');
 if (typeof plan.name!=='string'||!plan.name.trim()||plan.name.length>120) errors.push('Use a trip name of 1 to 120 characters.');
 if (!validDate(plan.date)||timeMinutes(plan.time)===null||plan.time==='24:00') errors.push('Choose a valid departure date and time.');
 if (!localParts(Date.now(),plan.startTimeZone)) errors.push('Choose an IANA departure time zone.');
 if (!Array.isArray(plan.legs)||!plan.legs.length||plan.legs.length>100) errors.push('A trip needs 1 to 100 road visits.');
 for (const leg of (Array.isArray(plan.legs)?plan.legs:[])) {
  if(!leg||typeof leg!=='object'){errors.push('Each road visit must be an object.');continue;}
  if (!ids.has(leg.targetId)) errors.push('Unknown road in trip: '+String(leg.targetId));
  for (const k of ['arrivalOffsetSeconds','departureOffsetSeconds']) if (!finite(leg[k])||leg[k]<0||leg[k]>366*86400) errors.push('Travel estimates must be explicit nonnegative seconds.');
  if (leg.departureOffsetSeconds<leg.arrivalOffsetSeconds) errors.push('A visit cannot finish before arrival.');
 }
 for(let i=1;i<(Array.isArray(plan.legs)?plan.legs:[]).length;i++) if(plan.legs[i]&&plan.legs[i-1]&&plan.legs[i].arrivalOffsetSeconds<plan.legs[i-1].departureOffsetSeconds) errors.push('Visits overlap or are out of order.');
 return [...new Set(errors)];
}
function identityMatches(identity,binding) {
 const fields=['geometrySha256','orderedStopsSha256','graphRevision','profileKey','direction'];
 return !!(identity&&binding&&binding.approved===true&&fields.every(k=>typeof identity[k]==='string'&&identity[k]&&identity[k]===binding[k]));
}
function resolveTrip(plan,date,data) {
 const errors=validateTrip({...plan,date},data); if(errors.length) return {errors,visits:[],bound:false};
 const instants=wallInstants(date,plan.time,plan.startTimeZone);
 if(instants.length!==1) return {errors:[instants.length?'Departure clock occurs twice. Choose an unambiguous time.':'Departure clock does not exist in this time zone.'],visits:[],bound:false};
 const binding=(data.routeBindings||[]).find(b=>b.routeId===plan.routeId);
 const bound=identityMatches(plan.routeIdentity,binding);
 // An approved route uses the current producer's visits, not a stale saved absolute clock.
 const legs=bound?binding.visits:plan.legs;
 const boundErrors=bound?validateTrip({...plan,legs},data):[];if(boundErrors.length)return {errors:boundErrors,visits:[],bound:false};
 const start=epoch(instants[0]);
 return {errors:[],at:instants[0],bound,bindingInvalidated:!!plan.routeIdentity&&!bound,
  coverageComplete:bound&&binding.coverageComplete===true,
  visits:legs.map(v=>({...v,at:new Date(start+v.arrivalOffsetSeconds*1000).toISOString(),leaveAt:new Date(start+v.departureOffsetSeconds*1000).toISOString()}))};
}
function intervalForecast(targetId,from,to,data,now) {
 const a=epoch(from),b=epoch(to),n=epoch(now),out=[],checks=new Set([a,Math.max(a,b-1)]);
 const rows=(data.forecasts||[]).filter(f=>f.targetId===targetId&&epoch(f.validFrom)!==null&&epoch(f.validUntil)!==null&&epoch(f.expiresAt)>n&&epoch(f.issuedAt)!==null&&epoch(f.issuedAt)<=n+300000);
 for(const r of rows) for(const k of ['validFrom','validUntil']) {const t=epoch(r[k]);if(t>a&&t<b) checks.add(t);}
 let covered=true;
 for(const t of [...checks].sort((x,y)=>x-y)) {
  const row=rows.filter(r=>t>=epoch(r.validFrom)&&t<epoch(r.validUntil)).sort((x,y)=>epoch(y.issuedAt)-epoch(x.issuedAt))[0];
  if(!row) {covered=false;out.push({state:'unknown',reasons:['No forecast covers this point and time.'],penalty:null});continue;}
  const r=weatherAssessment(row,t,now);out.push(r);
  if(['unknown','incomplete'].includes(r.state)||row.routeCoverage!==1) covered=false;
 }
 const reasons=[...new Set(out.flatMap(x=>x.reasons))],bad=out.some(x=>x.state==='avoid'),flag=out.some(x=>x.state==='caution');
 return {complete:covered,state:bad?'avoid':!covered?'incomplete':flag?'caution':'no_flag',reasons,penalty:covered?Math.max(0,...out.map(x=>x.penalty||0)):null};
}
function assessTrip(plan,date,ctx,data,sources) {
 const resolved=resolveTrip(plan,date,data);
 if(resolved.errors.length) return {date,valid:false,errors:resolved.errors,action:'Resolve departure and travel estimates',comparability:'none'};
 const route={confirmedTargetIds:[...new Set(resolved.visits.map(v=>v.targetId))],bindingApproved:resolved.bound,coverageComplete:resolved.coverageComplete,visits:resolved.visits};
 const context={...ctx,at:resolved.at,vehicleType:ctx.vehicleType||'motorcycle'};
 const assessment=assessRoute(route,context,data,sources),passMap=Object.fromEntries(data.passes.map(p=>[p.id,p]));
 const details=resolved.visits.map((v,i)=>{const p=passMap[v.targetId],wx=intervalForecast(v.targetId,v.at,v.leaveAt,data,ctx.now);
  return {index:i,targetId:v.targetId,name:p?.name||v.targetId,at:v.at,leaveAt:v.leaveAt,localArrival:localParts(v.at,p?.timeZone),timeZone:p?.timeZone||null,weather:wx,season:seasonAt((data.seasons||[]).find(s=>s.id===p?.seasonProfileId),localParts(v.at,p?.timeZone)?.month)};});
 const conflicts=assessment.rules.filter(r=>r.state==='blocked').concat(assessment.statuses.filter(s=>['closed','conflict'].includes(s.state)));
 const statusCoverage=assessment.statuses.filter(s=>['open','closed','restricted','conflict'].includes(s.state)).length;
 const weatherComplete=details.length>0&&details.every(d=>d.weather.complete);
 const weatherPenalty=weatherComplete?Math.max(...details.map(d=>d.weather.penalty||0)):null;
 const reviews=assessment.rules.filter(r=>['review','expired','obligation'].includes(r.state)).length;
 const actions=[];
 if(conflicts.length) actions.push({kind:'change_date_or_road',text:conflicts.length+' dated restriction(s) affect the selected roads. Compare departure dates or choose another road.'});
 if(assessment.rules.some(r=>r.state==='obligation')) actions.push({kind:'check_equipment',text:'Check the stated equipment or permit requirement for this vehicle.'});
 if(details.some(d=>d.weather.state==='avoid')) actions.push({kind:'weather_hazard',text:'A published weather hazard affects a checked interval. Replan and verify the authority.'});
 if(!resolved.bound) actions.push({kind:'route_binding',text:resolved.bindingInvalidated?'The saved route identity changed. Reconnect the accepted route before applying any restriction to navigation.':'This is a road-check plan, not a routed itinerary. Road order and travel estimates were supplied by you.'});
 if(statusCoverage<resolved.visits.length) actions.push({kind:'check_status',text:'Current authority status is missing for part or all of the trip.'});
 if(!weatherComplete) actions.push({kind:'check_weather',text:'Weather coverage is incomplete. The date comparison cannot claim better weather.'});
 return {date,valid:true,departureAt:resolved.at,details,assessment,conflicts,conflictCount:conflicts.length,reviews,statusCoverage,totalVisits:resolved.visits.length,weatherComplete,weatherPenalty,actions,bound:resolved.bound,bindingInvalidated:resolved.bindingInvalidated,comparability:weatherComplete?'schedule_and_assessed_weather':'published_schedule_only'};
}
function compareAssessments(base,rows) {
 for(const row of rows) {
  row.improvement='Not comparable';row.canApply=false;
  if(!row.valid||!base.valid) continue;
  const lostEvidence=row.statusCoverage<base.statusCoverage||(base.weatherComplete&&!row.weatherComplete)||row.reviews>base.reviews;
  const fewer=row.conflictCount<base.conflictCount;
  const betterWeather=row.conflictCount<=base.conflictCount&&row.weatherComplete&&base.weatherComplete&&row.weatherPenalty<base.weatherPenalty;
  row.canApply=true;
  if(lostEvidence) row.improvement='Less evidence available; not a verified improvement';
  else if(fewer) row.improvement='Fewer published restrictions. Check remaining status and weather';
  else if(betterWeather) row.improvement='Fewer assessed weather flags. Verify before departure';
  else if(row.conflictCount>base.conflictCount) row.improvement='More published restrictions';
  else row.improvement='No demonstrated improvement in assessed scope';
  row.demonstratedImprovement=!lostEvidence&&(fewer||betterWeather);
 }
 return {base,rows,bestCandidates:rows.filter(r=>r.demonstratedImprovement),claim:'Compare evidence, not a safety score. No automatic route or departure change.'};
}
function compareTripDates(plan,dates,ctx,data,sources) {
 if(!Array.isArray(dates)||!dates.length||dates.length>31||dates.some(d=>!validDate(d))) throw Error('Compare 1 to 31 valid departure dates.');
 return compareAssessments(assessTrip(plan,plan.date,ctx,data,sources),[...new Set(dates)].map(date=>({...assessTrip(plan,date,ctx,data,sources),time:plan.time})));
}
function compareTripOptions(plan,options,ctx,data,sources) {
 if(!Array.isArray(options)||!options.length||options.length>64||options.some(o=>!o||!validDate(o.date)||timeMinutes(o.time)===null||o.time==='24:00'))throw Error('Compare 1 to 64 valid departure options.');
 const unique=[...new Map(options.map(o=>[o.date+' '+o.time,o])).values()];
 return compareAssessments(assessTrip(plan,plan.date,ctx,data,sources),unique.map(o=>({...assessTrip({...plan,time:o.time},o.date,ctx,data,sources),time:o.time})));
}

function tripSignature(result) {
 if(!result.valid) return stableJSON({valid:false,errors:result.errors});
 return stableJSON({conflicts:result.conflicts.map(x=>[x.targetId,x.ruleId||null,x.state]),rules:result.assessment.rules.map(x=>[x.targetId,x.ruleId,x.state]),statuses:result.assessment.statuses.map(x=>[x.targetId,x.state]),weather:result.details.map(x=>[x.targetId,x.weather.state]),bound:result.bound,bindingInvalidated:result.bindingInvalidated});
}
function diffTrips(previous,plans,ctx,data,sources) {
 const events=[],next={};
 for(const p of plans) {
  const r=assessTrip(p,p.date,ctx,data,sources),sig=tripSignature(r);next[p.id]=sig;
  if(previous[p.id]&&previous[p.id]!==sig) {
   const missing=r.valid&&(r.statusCoverage<r.totalVisits||!r.weatherComplete);
   events.push({id:p.id+'|'+previous[p.id]+'|'+sig,tripId:p.id,title:p.name,kind:missing?'trip_recheck':'trip_change',at:new Date(ctx.now).toISOString(),summary:r.valid?r.actions.map(a=>a.text).join(' '):r.errors.join(' ')});
  }
 }
 return {events,next};
}
function tripRemindersICS(plan,now=Date.now()) {
 if(!validDate(plan.date)) throw Error('A valid departure date is required.');
 const dtstamp=new Date(now).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CurveScout//Trip Checks//EN','CALSCALE:GREGORIAN'];
 for(const days of [7,2,0]) {const d=utcDay(plan.date,-days);lines.push('BEGIN:VEVENT','UID:'+escapeICS(plan.id)+'-'+plan.date+'-'+days+'@curvescout.com','DTSTAMP:'+dtstamp,'DTSTART;VALUE=DATE:'+d.replace(/-/g,''),'DTEND;VALUE=DATE:'+utcDay(d,1).replace(/-/g,''),'SUMMARY:'+escapeICS((days?days+' days before: ':'Departure-day check: ')+plan.name),'DESCRIPTION:'+escapeICS('Recheck official road status, dated rules and weather in CurveScout. This reminder is not an opening confirmation or a reservation.'),'STATUS:TENTATIVE','END:VEVENT');}
 lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
function coverageReport(data,sources,now=Date.now()) {
 const sm=Object.fromEntries(sources.map(s=>[s.id,s]));const regions={};
 for(const p of data.passes) {const r=regions[p.region]||(regions[p.region]={inventory:0,sourced:0,rules:0,season:0,freshStatus:0});r.inventory++;if(p.sourceIds.some(s=>s!=='cs-inventory'&&sourceUsable(sm[s])))r.sourced++;if(data.rules.some(x=>x.targetIds.includes(p.id)))r.rules++;if(p.seasonProfileId)r.season++;if(['open','closed','restricted','conflict'].includes(statusAt(p.statusObservations,now,now,sm).state))r.freshStatus++;}
 return {regions,inventory:data.passes.length,authorities:sources.filter(s=>s.kind==='official'||s.kind==='operator').length,verifiedLiveRoads:Object.values(regions).reduce((a,r)=>a+r.freshStatus,0),countries:[...new Set(data.passes.flatMap(p=>p.countryContext?.countries||p.countries||[]))].sort(),generatedAt:new Date(now).toISOString()};
}

return {VERSION,validDate,utcDay,localParts,wallInstants,timeMinutes,inSeason,evaluateRule,statusAt,weatherAssessment,seasonAt,assessRoute,rankRoutes,diffWatched,historicalWindow,reminderICS,validateData,nextRuleChanges,stableJSON,validateTrip,identityMatches,resolveTrip,intervalForecast,assessTrip,compareTripDates,compareTripOptions,tripSignature,diffTrips,tripRemindersICS,coverageReport};
});

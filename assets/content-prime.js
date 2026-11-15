/* CurveScout content-prime 1.0. Local reading continuity, no network or analytics. */
(function () {
  'use strict';
  const KEY = 'curvescout.reading.v1';
  const MAX = 6;
  let memory = [];
  let volatile = false;
  function compact(list) { const seen=new Set(); return list.filter(item=>{if(!valid(item)||seen.has(item.path))return false;seen.add(item.path);return true;}).slice(0,MAX); }
  const clean = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  function valid(item) {
    return item && typeof item.title === 'string' && item.title.length > 0 && item.title.length <= 260 &&
      typeof item.path === 'string' && /^\/rides\/[a-z0-9][a-z0-9-]*\.html$/.test(item.path) &&
      typeof item.at === 'number' && Number.isFinite(item.at);
  }
  function read() {
    if (volatile) return memory.slice();
    try {
      const raw=localStorage.getItem(KEY)||'[]'; if(raw.length>50000)return memory.slice();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return memory.slice();
      return compact(parsed);
    } catch (_) { return memory.slice(); }
  }
  function write(list) {
    memory = compact(list);
    try { localStorage.setItem(KEY, JSON.stringify(memory)); volatile=false; return true; } catch (_) { volatile=true; return false; }
  }
  function recent() {
    const marker = document.querySelector('[data-cs-read-path]');
    if (marker) {
      const item = {path:marker.getAttribute('data-cs-read-path'), title:marker.getAttribute('data-cs-read-title'), at:Date.now()};
      if (valid(item)) {
        const durable = write([item].concat(read().filter(x => x.path !== item.path)));
        const note = document.querySelector('[data-cs-reading-storage]');
        if (note && !durable) note.textContent = 'Reading history is available in this tab only; browser storage is unavailable.';
      }
    }
    document.querySelectorAll('[data-cs-recent]').forEach(host => {
      const list = read(); host.replaceChildren();
      if (!list.length) { host.hidden = true; return; }
      host.hidden = false;
      const h = document.createElement('h2'); h.textContent = 'Continue reading'; host.append(h);
      const p = document.createElement('p'); p.textContent = 'Recently read on this device. Your saved rides and road-watch list stay separate.'; host.append(p);
      const ul = document.createElement('ul');
      list.forEach(item => { const li=document.createElement('li'), a=document.createElement('a'); a.href=item.path; a.textContent=item.title; li.append(a);ul.append(li); });host.append(ul);
      const clear = document.createElement('button'); clear.type='button'; clear.textContent='Clear reading history';
      clear.addEventListener('click', () => { memory=[];let removed=true;try { localStorage.removeItem(KEY);volatile=false; } catch (_) {volatile=true;removed=false;} host.replaceChildren();host.hidden=removed;if(!removed){const note=document.createElement('p');note.textContent='This tab is cleared. Browser storage could not be changed.';host.append(note);} });host.append(clear);
    });
  }
  function filters() {
    document.querySelectorAll('[data-cs-filter]').forEach(input => {
      if (input.dataset.bound) return;input.dataset.bound='1';
      const container = document.getElementById(input.getAttribute('data-cs-filter'));
      if (!container) return;
      const items=[...container.children]; const status=document.getElementById(input.getAttribute('aria-describedby'));
      const update=()=>{const q=clean(input.value);let count=0;items.forEach(item=>{const show=!q||clean(item.textContent).includes(q);item.hidden=!show;if(show)count++;});if(status)status.textContent=count+' of '+items.length+' countries shown.';};
      input.addEventListener('input',update);update();
      const reset=document.querySelector('[data-cs-clear="'+input.id+'"]');
      if(reset)reset.addEventListener('click',()=>{input.value='';update();input.focus();});
    });
  }
  function boot(){recent();filters();}
  window.CSReading={read,write,valid,clean,boot};
  if (document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

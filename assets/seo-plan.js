/* CurveScout planning utilities. No telemetry, geolocation or network requests. */
(function (root) {
  'use strict';
  const KEY = 'curvescout:ride-day-budget:v1';
  function number(value, name, max) {
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') throw new Error('Enter ' + name + '.');
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(name + ' must be between 0 and ' + max + '.');
    return n;
  }
  function calculate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Budget inputs are missing.');
    const ride = number(input.rideHours, 'riding hours', 24), stops = number(input.stopsMinutes, 'stop minutes', 1440);
    const delay = number(input.delayMinutes, 'delay minutes', 1440), available = number(input.availableHours, 'available hours', 72);
    const departure = String(input.departure || '');
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(departure)) throw new Error('Use a valid local departure time.');
    const total = Math.round(ride * 60 + stops + delay);
    const start = Number(departure.slice(0, 2)) * 60 + Number(departure.slice(3));
    const finish = start + total, clock = (Math.floor(finish / 60) % 24).toString().padStart(2, '0') + ':' + (finish % 60).toString().padStart(2, '0');
    return { totalMinutes: total, spareMinutes: Math.round(available * 60) - total, finishLocalClock: clock, dayOffset: Math.floor(finish / 1440), longerDelayMinutes: total + 60 };
  }
  function sanitize(input) {
    calculate(input);
    return { rideHours: Number(input.rideHours), stopsMinutes: Number(input.stopsMinutes), delayMinutes: Number(input.delayMinutes), availableHours: Number(input.availableHours), departure: input.departure };
  }
  function parseSaved(text) {
    if (typeof text !== 'string' || text.length > 8192) throw new Error('Saved budget is too large or invalid.');
    const data = JSON.parse(text);
    if (!data || data.version !== 1 || typeof data.inputs !== 'object') throw new Error('Unsupported saved budget.');
    return sanitize(data.inputs);
  }
  function reportPage(value) {
    const u = new URL(value, 'https://curvescout.com');
    if (u.protocol !== 'https:' || u.hostname !== 'curvescout.com' || u.username || u.password || u.port) throw new Error('Use a CurveScout page URL.');
    // A source URL can contain private query strings or a planner fragment. Do not export them.
    return 'https://curvescout.com' + u.pathname;
  }
  function duration(n) { return Math.floor(Math.abs(n) / 60) + ' h ' + String(Math.abs(n) % 60).padStart(2, '0') + ' min'; }
  const api = { calculate, sanitize, parseSaved, reportPage, storageKey: KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CSSeoTools = api;
  if (typeof document === 'undefined') return;
  function download(text, name, type) {
    const blob = new Blob([text], { type: type || 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function mount() {
    const form = document.getElementById('cs-budget');
    if (form && !form.dataset.mounted) {
      form.dataset.mounted = '1'; const result = document.getElementById('cs-budget-result'), state = document.getElementById('cs-budget-state');
      const input = () => Object.fromEntries(['rideHours','stopsMinutes','delayMinutes','availableHours','departure'].map(k => [k, form.elements.namedItem(k).value]));
      function render() {
        try {
          const v = calculate(input());
          result.textContent = duration(v.totalMinutes) + ' total. Finish at ' + v.finishLocalClock + (v.dayOffset ? ', ' + v.dayOffset + ' day' + (v.dayOffset > 1 ? 's' : '') + ' later' : ' on the departure day') + '. ' + (v.spareMinutes >= 0 ? duration(v.spareMinutes) + ' remains in your stated time budget.' : 'Exceeds your stated time budget by ' + duration(v.spareMinutes) + '.') + ' With one extra hour of delay: ' + duration(v.longerDelayMinutes) + ' total.';
          result.dataset.valid = 'true'; return true;
        } catch (error) { result.textContent = error.message; result.dataset.valid = 'false'; return false; }
      }
      form.addEventListener('submit', event => { event.preventDefault(); render(); });
      form.addEventListener('input', render);
      document.getElementById('cs-budget-save').addEventListener('click', () => {
        if (!render()) return;
        try { localStorage.setItem(KEY, JSON.stringify({version:1, inputs:sanitize(input()), savedAt:new Date().toISOString()})); state.textContent = 'Saved in this browser. No server copy exists.'; }
        catch (_) { state.textContent = 'Storage is unavailable. Keep this tab open or export your budget.'; }
      });
      document.getElementById('cs-budget-clear').addEventListener('click', () => {
        try { localStorage.removeItem(KEY); form.reset(); state.textContent = 'Saved budget removed. Example inputs restored.'; render(); }
        catch (_) { state.textContent = 'Browser storage could not be cleared. Check your browser storage controls.'; }
      });
      document.getElementById('cs-budget-export').addEventListener('click', () => { if (render()) download(JSON.stringify({version:1,inputs:sanitize(input())},null,2),'curvescout-day-budget.json'); });
      try { const text = localStorage.getItem(KEY); if (text) { const data=parseSaved(text); Object.keys(data).forEach(k => {form.elements.namedItem(k).value = data[k];}); state.textContent='Restored your saved budget from this browser.'; } }
      catch (_) { state.textContent = 'Saved budget could not be read. No stored data was overwritten.'; }
      render();
    }
    const correction = document.getElementById('cs-correction');
    if (correction && !correction.dataset.mounted) {
      correction.dataset.mounted='1'; const output=document.getElementById('cs-correction-output');
      correction.addEventListener('submit', event => {
        event.preventDefault();
        try {
          const page=reportPage(correction.elements.namedItem('page').value), issue=correction.elements.namedItem('issue').value.trim();
          if (issue.length < 10 || issue.length > 5000) throw new Error('Describe the correction in 10 to 5,000 characters.');
          const text='CurveScout correction report\nPage: '+page+'\nPrepared: '+new Date().toISOString()+'\n\n'+issue+'\n\nThis report has not been sent. Use the publisher contact details on the site to submit it.\n';
          output.textContent='Report prepared locally. Downloaded report is not a submitted correction. Use Publisher contact to send it.';
          download(text,'curvescout-correction.txt','text/plain');
        } catch (error) { output.textContent=error.message; }
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true}); else mount();
})(typeof window !== 'undefined' ? window : globalThis);

/* One explicit section jump. Never pull the reader back with delayed timers. */
(function () {
  'use strict';
  let pending = null;
  const events = ['wheel', 'touchstart', 'keydown', 'pointerdown', 'hashchange', 'popstate'];
  function cancel() {
    if (!pending) return;
    cancelAnimationFrame(pending.frame);
    events.forEach(name => window.removeEventListener(name, pending.cancel));
    pending = null;
  }
  function jump(el, openTab) {
    cancel();
    if (!el || !el.isConnected) return;
    if (typeof openTab === 'function') openTab(el);
    const hash = location.hash;
    const state = {cancel, frame: null};
    pending = state;
    events.forEach(name => window.addEventListener(name, cancel, {once:true, passive:true}));
    state.frame = requestAnimationFrame(() => {
      if (pending !== state) return;
      const allowed = el.isConnected && location.hash === hash;
      cancel();
      if (!allowed) return;
      window.scrollTo({top:Math.max(0,el.getBoundingClientRect().top+window.scrollY-70),behavior:'auto'});
    });
  }
  window.CSPrimeAnchor = {jump, cancel};
})();

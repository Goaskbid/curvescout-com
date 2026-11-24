/* CurveScout pass status policy - copied verbatim from the app (app.core.js) at build time, so the app and the pass
   pages judge a report the same way. Generated; do not edit here. */
(function(){const CS_PASS_MAX_AGE_MS = 6 * 3600e3;
function csPassInstant(value) {
  return typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value)) ? Date.parse(value) : NaN;
}
function csPassSnapshotFresh(j, now) {
  if (!j || j.feed === 'unavailable') return false;
  const checked = csPassInstant(j.checked || j.updated || '');
  return Number.isFinite(checked) && checked <= now + 600e3 && now < checked + CS_PASS_MAX_AGE_MS;
}
function csPassPhase(st, snapshotFresh, now) {
  if (!st || typeof st !== 'object') return 'none';
  if (!snapshotFresh) return 'stale';
  const hasFrom = st.since != null && st.since !== '', hasTo = st.until != null && st.until !== '';
  const from = hasFrom ? csPassInstant(st.since) : NaN, to = hasTo ? csPassInstant(st.until) : NaN;
  if ((hasFrom && !Number.isFinite(from)) || (hasTo && !Number.isFinite(to)) || (hasFrom && hasTo && to <= from)) return 'invalid';
  if (hasTo && now >= to) return 'ended';
  if (hasFrom && now < from) return 'scheduled';
  // A planned event does not become an observed closure merely because its start time passes.
  if (st.status === 'planned') return 'schedule-started';
  return st.status === 'closed' ? 'closed' : st.status === 'restricted' ? 'restricted' : 'unknown';
}
window.CSPassPolicy={instant:csPassInstant,fresh:csPassSnapshotFresh,phase:csPassPhase,maxAge:CS_PASS_MAX_AGE_MS};})();

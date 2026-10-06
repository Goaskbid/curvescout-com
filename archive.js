window.__CS_READY = (async () => {
  const r = await fetch('archive.json.gz');
  if (!r.ok) throw new Error('archive ' + r.status);
  const buf = new Uint8Array(await r.arrayBuffer());
  const ds = new DecompressionStream('gzip');
  const text = await new Response(new Blob([buf]).stream().pipeThrough(ds)).text();
  window.CURVESCOUT_INLINE = JSON.parse(text);
  document.dispatchEvent(new Event('curvescout:archive'));
})();

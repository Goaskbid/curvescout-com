/* Preserve area photographs and attribution; never imply that a geosearch proves the route. */
(function () {
  'use strict';
  const image=document.querySelector('[data-pic]');
  const credit=document.querySelector('[data-cred]');
  if (!image || !credit) return;
  const lat=Number(image.dataset.lat),lon=Number(image.dataset.lon);
  if (!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180) return;
  const safe=(value,kind)=>{try{const u=new URL(value);return u.protocol==='https:'&&(kind==='image'?u.hostname==='upload.wikimedia.org':u.hostname==='commons.wikimedia.org')?u.href:null;}catch(_){return null;}};
  const plain=value=>String(value&&value.value||'').replace(/<[^>]*>/g,'');
  const hide=()=>{const hero=image.closest('.hero');if(hero)hero.hidden=true;};
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
  const url='https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggsnamespace=6&ggscoord='+lat+'%7C'+lon+'&ggsradius=8000&ggslimit=6&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata&iiurlwidth=1200';
  fetch(url,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('Photo service unavailable');return r.json();}).then(j=>{
    const pages=j.query&&j.query.pages||{};
    for (const page of Object.values(pages)) {
      const ii=page.imageinfo&&page.imageinfo[0];if(!ii)continue;
      if (/map|karte|diagram|logo|wappen|coat of arms/i.test(page.title||''))continue;
      if ((ii.thumbwidth||0)<(ii.thumbheight||0))continue;
      const src=safe(ii.thumburl,'image'),href=safe(ii.descriptionurl,'source');if(!src||!href)continue;
      image.src=src;image.alt='Area photograph near a recorded stop; not proof of the selected road or current conditions.';
      const em=ii.extmetadata||{},a=document.createElement('a');a.href=href;a.rel='nofollow noopener';a.target='_blank';
      a.textContent=(plain(em.LicenseShortName)||'Wikimedia Commons')+(plain(em.Artist)?' | '+plain(em.Artist):'');
      credit.replaceChildren(document.createTextNode('Area photograph: '),a);return;
    }
    hide();
  }).catch(hide).finally(()=>clearTimeout(timer));
})();

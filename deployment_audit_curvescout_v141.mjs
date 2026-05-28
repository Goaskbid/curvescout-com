import fs from 'fs';
import path from 'path';
const root=process.cwd();
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const routesJs=fs.readFileSync(path.join(root,'data/routes.js'),'utf8');
const appJs=fs.readFileSync(path.join(root,'app.js'),'utf8');
function b64(file){return fs.readFileSync(path.join(root,file)).toString('base64');}
const assets={
  'assets/curvescout-mark-transparent.png':`data:image/png;base64,${b64('assets/curvescout-mark-transparent.png')}`,
  'assets/curvescout-helmet-visual.png':`data:image/png;base64,${b64('assets/curvescout-helmet-visual.png')}`,
  'assets/curvescout-media-fallback.png':`data:image/png;base64,${b64('assets/curvescout-media-fallback.png')}`,
  'assets/curvescout-brand-board.png':`data:image/png;base64,${b64('assets/curvescout-brand-board.png')}`,
  'assets/curvescout-wordmark-board.png':`data:image/png;base64,${b64('assets/curvescout-wordmark-board.png')}`,
  'assets/cerebral-local.svg':`data:image/svg+xml;base64,${b64('assets/cerebral-local.svg')}`
};
let out=html.replace('<link rel="stylesheet" href="styles.css">',`<style>\n${css}\n</style>`);
for(const [file,data] of Object.entries(assets)){
  const escaped=file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  out=out.replace(new RegExp(`src="${escaped}"`,'g'),`src="${data}"`);
  out=out.replace(new RegExp(`url\\(['"]?${escaped}['"]?\\)`,'g'),`url(${data})`);
}
out=out.replace('<script src="data/routes.js"></script>',`<script>\n${routesJs}\n</script>`);
out=out.replace('<script src="app.js"></script>',`<script>\n${appJs}\n</script>`);
fs.writeFileSync(path.join(root,'standalone.html'),out);
fs.writeFileSync('/mnt/data/curvescout_com_v1_4_6_standalone.html',out);
console.log('standalone bytes',out.length);

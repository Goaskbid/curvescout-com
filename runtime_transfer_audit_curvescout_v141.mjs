import fs from 'fs';
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const requiredHtml=['id="inlineRoadbook"','id="inlineRoadbookList"','data-target="inlineRoadbook"','id="roadbookGrid"','Road sections and checkpoints'];
const requiredApp=['function renderInlineRoadbook','function robustRoadbookSections','function roadbookItems','renderInlineRoadbook(r)','function renderRoadbook','function waypointRow','function sectionRow','function shortRoadbookText','function ensureRoadbookVisible'];
const requiredCss=['.inlineRoadbook','.inlineRoadbookList','.inlineRoadbookItem','.roadbookList','.roadbookItem'];
const missing=[...requiredHtml.filter(x=>!html.includes(x)),...requiredApp.filter(x=>!app.includes(x)),...requiredCss.filter(x=>!css.includes(x))];
if(missing.length){console.error('Roadbook restore audit failed:', missing.join(', ')); process.exit(1);}
console.log('Roadbook restore audit ok: inline and full riding-order roadbooks present; runtime helpers present');

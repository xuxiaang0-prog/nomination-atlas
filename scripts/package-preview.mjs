import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const folder=path.join(root,'apps/web/dist/assets');const assets=await readdir(folder);
const js=await readFile(path.join(folder,assets.find(p=>p.endsWith('.js'))),'utf8');
const css=await readFile(path.join(folder,assets.find(p=>p.endsWith('.css'))),'utf8');
const snapshot=JSON.stringify(JSON.parse(await readFile(path.join(root,'artifacts/snapshot.json'),'utf8')));
const escapeScript=s=>s.replaceAll('</script','<\\/script');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Nomination Atlas local reference preview; exact exported API snapshots, official invitation history with scope-aware scores and counts; synthetic demo isolated."><title>Nomination Atlas · v0.5 · 近期职业分数与数量</title><style>${css}</style></head><body><div id="root"></div><script>window.ATLAS_SNAPSHOT=${snapshot.replaceAll('<','\\u003c')};</script><script type="module">${escapeScript(js)}</script></body></html>`;
const target=path.join(root,'dist/preview.html');await mkdir(path.dirname(target),{recursive:true});await writeFile(target,html);
// Keep the downloadable local preview alongside the source delivery.
if (!process.env.VERCEL) await writeFile(path.join(root,'../NominationAtlas_Preview.html'),html);
console.log(`${target}: ${Buffer.byteLength(html).toLocaleString()} bytes`);

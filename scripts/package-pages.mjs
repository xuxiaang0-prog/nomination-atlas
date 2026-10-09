import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'dist/pages');
const snapshot = JSON.parse(await readFile(path.join(root, 'artifacts/snapshot.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(root, 'data/official/history.json'), 'utf8'));
if (snapshot.officialHistory?.datasetVersion !== manifest.datasetVersion) {
  throw new Error('The exported API snapshot and official manifest have different releases. Run verify:local before publishing.');
}
const html = await readFile(path.join(root, 'dist/preview.html'), 'utf8');
if (!html.includes('window.ATLAS_SNAPSHOT=') || !html.includes(manifest.datasetVersion)) {
  throw new Error('Rebuild the preview before packaging the public site.');
}
const description = '澳洲八州与领地职业资料：比较官方公开的EOI快照分数、数量、签证主申请量与州邀请披露，查看日期、统计口径和原始来源。';
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'index.html'), html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${description}">`));
await writeFile(path.join(output, '.nojekyll'), '');
console.log(`Static site ready: ${output} (${manifest.datasetVersion})`);

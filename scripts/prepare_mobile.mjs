import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'mobile', 'www');
const buildVersion = createHash('sha256')
  .update(await readFile(path.join(root, 'assets', 'app.css')))
  .update(await readFile(path.join(root, 'assets', 'app.js')))
  .update(await readFile(path.join(root, 'mobile', 'src', 'native-bridge.js')))
  .digest('hex')
  .slice(0, 12);

await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'assets'), { recursive: true });

let html = await readFile(path.join(root, 'app', 'index.html'), 'utf8');
html = html
  .replace(/<html([^>]*)>/, '<html$1 data-native-app>')
  .replace(/<link rel="manifest"[^>]*>\n?/, '')
  .replace(/<link rel="icon"[^>]*>\n?/g, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '')
  .replace(/<meta property="og:[^>]*>\n?/g, '')
  .replace(/<meta name="twitter:[^>]*>\n?/g, '')
  .replace(/\.\.\/assets\/app\.css(?:\?v=[^"']+)?/, `assets/app.css?v=${buildVersion}`)
  .replace(/\.\.\/assets\/app\.js(?:\?v=[^"']+)?/, `assets/app.js?v=${buildVersion}`)
  .replace(/(<meta name="viewport"[^>]*>)/, '$1\n<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; base-uri \'none\'; object-src \'none\'; frame-src \'none\'; worker-src \'none\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; font-src \'self\'; img-src \'self\' https://obtimes.com blob:; media-src \'self\' https://obtimes.com blob:; connect-src \'self\' https://obtimes.com; form-action \'none\'">')
  .replace(new RegExp(`<script src="assets/app\\.js\\?v=${buildVersion}" defer></script>`), `<script src="assets/native-bridge.js?v=${buildVersion}" defer></script>\n<script src="assets/app.js?v=${buildVersion}" defer></script>`)
  .replace(/<a class="app-brand" href="\.\.\/"/, '<a class="app-brand" href="https://obtimes.com/" data-native-external');

assert.match(html, /<html[^>]*\bdata-native-app\b/);
assert.match(html, /Content-Security-Policy/);
assert.match(html, new RegExp(`assets/native-bridge\\.js\\?v=${buildVersion}`));
assert.match(html, /href="https:\/\/obtimes\.com\/" data-native-external/);
assert.doesNotMatch(html, /\.\.\/assets\/app\.(?:css|js)/);
assert.doesNotMatch(html, /rel="manifest"/);
await writeFile(path.join(output, 'index.html'), html);

for (const relative of [
  'assets/app.css',
  'assets/app.js',
  'assets/app-catalog.json',
  'assets/app-icon.svg',
  'assets/app-icon-512.png',
  'assets/favicon.svg'
]) {
  const destination = path.join(output, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, relative), destination);
}

for (const directory of ['assets/fonts', 'assets/covers', 'essays', 'media']) {
  await cp(path.join(root, directory), path.join(output, directory), { recursive: true });
}

await build({
  entryPoints: [path.join(root, 'mobile', 'src', 'native-bridge.js')],
  outfile: path.join(output, 'assets', 'native-bridge.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['safari15', 'chrome100'],
  minify: true,
  sourcemap: false
});

console.log(JSON.stringify({
  output,
  buildVersion,
  bundledFallback: ['current catalogue', 'essay text', 'covers', 'inline figures'],
  streamed: ['audio editions', 'PDF editions', 'new editorial content']
}, null, 2));

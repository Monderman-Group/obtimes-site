import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resources = path.join(root, 'resources');
await mkdir(resources, { recursive: true });

const regular = path.join(root, 'assets', 'app-icon.svg');
const maskable = path.join(root, 'assets', 'app-icon-maskable.svg');
const black = {r: 25, g: 27, b: 25};

await sharp(regular)
  .resize(1024, 1024)
  .flatten({background: black})
  .removeAlpha()
  .png()
  .toFile(path.join(resources, 'icon-only.png'));

await sharp(maskable)
  .resize(1024, 1024)
  .flatten({background: black})
  .png()
  .toFile(path.join(resources, 'icon-foreground.png'));

await sharp({create: {width: 1024, height: 1024, channels: 3, background: black}})
  .png()
  .toFile(path.join(resources, 'icon-background.png'));

const splashMark = await sharp(regular).resize(720, 720).png().toBuffer();
for (const name of ['splash.png', 'splash-dark.png']) {
  await sharp({create: {width: 2732, height: 2732, channels: 3, background: black}})
    .composite([{input: splashMark, left: 1006, top: 1006}])
    .png()
    .toFile(path.join(resources, name));
}

console.log(JSON.stringify({resources, icon: '1024x1024 RGB', splash: '2732x2732 RGB'}, null, 2));

// Copies the open-licensed (OFL) resume fonts from node_modules into public/fonts.
// Runs automatically before `npm run dev` and `npm run build`.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', '@expo-google-fonts');
const out = join(root, 'public', 'fonts');
mkdirSync(out, { recursive: true });

const fonts = [
  ['inter', 'Inter'],
  ['lato', 'Lato'],
  ['source-serif-4', 'SourceSerif4'],
  ['eb-garamond', 'EBGaramond'],
];
const styles = [
  ['400Regular', 'normal'],
  ['700Bold', 'bold'],
  ['400Regular_Italic', 'italic'],
];
for (const [pkg, file] of fonts) {
  for (const [variant, style] of styles) {
    const from = join(src, pkg, variant, `${file}_${variant}.ttf`);
    if (!existsSync(from)) throw new Error(`Missing font file: ${from}`);
    copyFileSync(from, join(out, `${pkg}-${style}.ttf`));
  }
}
console.log(`Copied ${fonts.length * styles.length} font files to public/fonts`);

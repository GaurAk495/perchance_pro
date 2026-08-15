import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const files: [string, string][] = [
  ['src/sidebar/sidebar.html', 'dist/sidebar.html'],
  ['src/sidebar/sidebar.css', 'dist/sidebar.css'],
  ['manifest.json', 'dist/manifest.json'],
  ['public/icon16.png', 'dist/public/icon16.png'],
  ['public/icon32.png', 'dist/public/icon32.png'],
  ['public/icon48.png', 'dist/public/icon48.png'],
  ['public/icon128.png', 'dist/public/icon128.png'],
];

if (!existsSync('dist')) {
  await mkdir('dist', { recursive: true });
}

if (!existsSync('dist/public')) {
  await mkdir('dist/public', { recursive: true });
}

for (const [src, dest] of files) {
  await copyFile(src, dest);
  console.log(`Copied ${src} -> ${dest}`);
}

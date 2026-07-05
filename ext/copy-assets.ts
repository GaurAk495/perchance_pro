import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const files: [string, string][] = [
  ['src/sidebar/sidebar.html', 'dist/sidebar.html'],
  ['src/sidebar/sidebar.css', 'dist/sidebar.css'],
  ['manifest.json', 'dist/manifest.json'],
];

if (!existsSync('dist')) {
  await mkdir('dist', { recursive: true });
}

for (const [src, dest] of files) {
  await copyFile(src, dest);
  console.log(`Copied ${src} -> ${dest}`);
}

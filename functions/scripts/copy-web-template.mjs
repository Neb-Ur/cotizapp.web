import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const candidates = ['dist/cotizacion-web/browser/index.csr.html', 'dist/cotizacion-web/browser/index.html'];
const source = candidates.find(existsSync);
if (source) {
  mkdirSync('functions/assets', { recursive: true });
  writeFileSync('functions/assets/index.html', readFileSync(source, 'utf8'));
}

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BUNDLE = /^(?:main|polyfills|styles|chunk)-[A-Za-z0-9_-]+\.(?:js|css)$/;
const MANIFEST = 'hosted-bundles.json';
export async function preserveHostedBundles({ base, output }) {
  const queue = [];
  const seen = new Set();
  const enqueue = name => { if (BUNDLE.test(name) && !seen.has(name)) { seen.add(name); queue.push(name); } };
  const collect = body => { for (const match of body.matchAll(/["'](?:\.\/|\/)?((?:main|polyfills|styles|chunk)-[A-Za-z0-9_-]+\.(?:js|css))["']/g)) enqueue(match[1]); };
  const request = async (path, expectedStatus = 200) => {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(45000) });
    if (response.status !== expectedStatus) throw new Error(`Cannot preserve hosted bundles: ${path} returned ${response.status}`);
    return response.text();
  };
  // Keep every previous generation, including files that no longer appear in
  // the latest page but can still be requested by an already-open browser tab.
  const manifestResponse = await fetch(`${base}/${MANIFEST}`, { signal: AbortSignal.timeout(45000) });
  if (manifestResponse.status === 200) {
    const manifest = await manifestResponse.json();
    if (manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error('Invalid hosted bundle manifest');
    manifest.files.forEach(enqueue);
  } else if (manifestResponse.status !== 404) throw new Error(`Cannot read hosted bundle manifest: ${manifestResponse.status}`);
  collect(await request('/'));
  collect(await request('/productos/no-existe-qa-cotizapp-404', 404));
  mkdirSync(output, { recursive: true });
  readdirSync(output).forEach(enqueue);
  let retained = 0;
  for (let index = 0; index < queue.length; index++) {
    const name = queue[index]; const destination = join(output, name);
    // Existing files must also be scanned: their lazy children may be absent.
    const body = existsSync(destination) ? readFileSync(destination, 'utf8') : await request(`/${name}`);
    collect(body);
    if (!existsSync(destination)) { mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, body); retained++; }
  }
  writeFileSync(join(output, MANIFEST), JSON.stringify({ version: 1, files: [...seen].sort() }));
  return { retained, total: seen.size };
}

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Hosting-only releases must retain the hashed bundles referenced by the
// HTML template in the currently deployed API, until Functions is updated.
if (process.env.PRESERVE_HOSTED_BUNDLES === 'true') {
  const base = process.env.PRODUCTION_URL || 'https://cotizapp-d71c8.web.app';
  const output = 'dist/cotizacion-web/browser';
  const queue = [];
  const seen = new Set();
  function collect(body) {
    for (const match of body.matchAll(/["'](?:\.\/|\/)?((?:main|polyfills|styles|chunk)-[A-Za-z0-9_-]+\.(?:js|css))["']/g)) {
      if (!seen.has(match[1])) { seen.add(match[1]); queue.push(match[1]); }
    }
  }
  async function request(path, expectedStatus = 200) {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(45000) });
    if (response.status !== expectedStatus) throw new Error(`Cannot preserve API bundles: ${path} returned ${response.status}`);
    return response.text();
  }
  collect(await request('/'));
  // A missing product still uses the API's deployed HTML template.
  collect(await request('/productos/no-existe-qa-cotizapp-404', 404));
  let retained = 0;
  for (let index = 0; index < queue.length; index++) {
    const name = queue[index];
    const destination = join(output, name);
    if (existsSync(destination)) continue;
    const body = await request(`/${name}`);
    collect(body);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, body);
    retained++;
  }
  console.log(`Retained ${retained} bundles for the deployed API HTML template.`);
}

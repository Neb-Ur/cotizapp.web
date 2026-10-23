import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

let port;
const child = spawn(process.execPath, ['dist/cotizacion-web/server/server.mjs'], {
  env: { ...process.env, PORT: '0' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('SSR startup timed out')), 30000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`SSR exited before validation: ${code}`)); });
    child.stdout.on('data', () => {
      const listening = /Node Express server listening on http:\/\/localhost:(\d+)/.exec(output);
      if (listening) { port = Number(listening[1]); clearTimeout(timeout); resolve(); }
    });
  });
  for (const path of ['/index.csr.html', '/index.html']) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(30000) });
    await response.text();
    assert.equal(response.status, 200, `${path}: HTTP status`);
    assert.equal(response.headers.get('cache-control'), 'no-cache', `${path}: revalidate deployment documents`);
    console.log(`PASS SSR ${path}: revalidation required`);
  }
  for (const [path, expected] of [['/ruta-qa-inexistente', 404], ['/login', 200], ['/registro', 200]]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(30000) });
    const html = await response.text();
    assert.equal(response.status, expected, `${path}: HTTP status`);
    assert.match(html, /ng-version=/, `${path}: Angular must actually render`);
    assert.match(html, /name="robots"[^>]*noindex/, `${path}: noindex`);
    if (expected === 404) assert.match(html, /Página no encontrada/, `${path}: not-found content`);
    console.log(`PASS SSR ${path}: ${response.status}, rendered, noindex`);
  }
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM');
    await once(child, 'exit');
  }
}
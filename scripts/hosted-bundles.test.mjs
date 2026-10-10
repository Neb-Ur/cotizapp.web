import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preserveHostedBundles } from './hosted-bundles.mjs';

test('keeps old lazy graphs across two deployments and scans existing parent bundles', async () => {
  const files = new Map([
    ['/', '<script src="main-NEW.js"></script>'], ['/productos/no-existe-qa-cotizapp-404', 'Not found'],
    ['/hosted-bundles.json', JSON.stringify({version:1,files:['main-OLD.js','chunk-OLD.js']})],
    ['/main-OLD.js', 'import("./chunk-OLD.js")'], ['/chunk-OLD.js', 'export const old = true;'],
    ['/main-NEW.js', 'import("./chunk-NEW.js")'], ['/chunk-NEW.js', 'export const current = true;']
  ]);
  const server = createServer((req,res)=>{ const body = files.get(req.url); res.statusCode = req.url === '/productos/no-existe-qa-cotizapp-404' || body === undefined ? 404 : 200; res.end(body || 'Not found'); });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const first = mkdtempSync(join(tmpdir(),'trovio-bundles-first-')); const second = mkdtempSync(join(tmpdir(),'trovio-bundles-second-'));
  try {
    writeFileSync(join(first,'main-NEW.js'),files.get('/main-NEW.js'));
    await preserveHostedBundles({base,output:first});
    assert.ok(existsSync(join(first,'chunk-NEW.js'))); assert.ok(existsSync(join(first,'chunk-OLD.js')));
    const manifest = JSON.parse(readFileSync(join(first,'hosted-bundles.json'),'utf8'));
    for (const name of manifest.files) files.set('/'+name,readFileSync(join(first,name),'utf8'));
    files.set('/hosted-bundles.json',JSON.stringify(manifest));
    files.set('/','<script src="main-THIRD.js"></script>'); files.set('/main-THIRD.js','import("./chunk-THIRD.js")');files.set('/chunk-THIRD.js','export const third=true;');
    await preserveHostedBundles({base,output:second});
    for (const name of ['main-OLD.js','chunk-OLD.js','main-NEW.js','chunk-NEW.js','main-THIRD.js','chunk-THIRD.js']) assert.ok(existsSync(join(second,name)),name);
  } finally { await new Promise(resolve=>server.close(resolve)); rmSync(first,{recursive:true});rmSync(second,{recursive:true}); }
});

test('refuses to publish a version with a missing required lazy chunk', async () => {
  const server = createServer((req,res)=>{ if(req.url==='/'){res.end('<script src="main-MISSING.js"></script>');}else{res.statusCode=404;res.end('Not found');} });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const output=mkdtempSync(join(tmpdir(),'trovio-bundles-missing-'));
  try { await assert.rejects(preserveHostedBundles({base:`http://127.0.0.1:${server.address().port}`,output}),/main-MISSING.js returned 404/); }
  finally { await new Promise(resolve=>server.close(resolve));rmSync(output,{recursive:true}); }
});

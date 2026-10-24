import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { preserveServerConfig } from '../functions/scripts/lib/server-config.mjs';

const root = new URL('../', import.meta.url);
const readJson = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

test('package scripts point to existing local Node entrypoints', () => {
  for (const path of ['package.json', 'functions/package.json']) {
    for (const [name, command] of Object.entries(readJson(path).scripts)) {
      let directory = new URL('./', new URL(path, root));
      for (const segment of command.split('&&').map(value => value.trim())) {
        const changeDirectory = /^cd\s+(\S+)$/.exec(segment);
        if (changeDirectory) directory = new URL(`${changeDirectory[1]}/`, directory);
        for (const match of segment.matchAll(/\bnode\s+([^\s;&|]+\.(?:mjs|cjs|js))\b/g)) {
          if (match[1].startsWith('dist/') || match[1].startsWith('lib/')) continue;
          assert.ok(existsSync(new URL(match[1], directory)), `${path} ${name}: ${match[1]}`);
        }
      }
    }
  }
});

test('production preflight and CI require the compiled SSR smoke after building', () => {
  const scripts = readJson('package.json').scripts;
  assert.equal(scripts['test:ssr'], 'node scripts/smoke-ssr.mjs');
  assert.match(scripts['preflight:production'], /npm run build && npm run test:ssr/);
  const workflow = readFileSync(new URL('.github/workflows/firebase-mvp-ci.yml', root), 'utf8');
  assert.ok(workflow.indexOf('run: npm run test:ssr') > workflow.indexOf('run: npm run build'));
  assert.ok(workflow.includes('run: npm run test:ssr'));
});

test('Firebase predeploy hooks retain bundle preservation and the Functions build', () => {
  const config = readJson('firebase.json');
  assert.ok(config.hosting.predeploy.includes('node scripts/preserve-hosted-bundles.mjs'));
  assert.ok(config.functions.predeploy.includes('npm --prefix functions run build'));
  assert.equal(config.functions.runtime, `nodejs${readJson('functions/package.json').engines.node}`);
});

test('production deploys require main and cannot cancel an in-progress release', () => {
  const workflow = readFileSync(new URL('.github/workflows/firebase-mvp-ci.yml', root), 'utf8');
  assert.match(workflow, /group: cotizapp-\$\{\{ github\.ref \}\}\s+cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
  const deploy = workflow.slice(workflow.indexOf('\n  deploy:'));
  const condition = deploy.slice(deploy.indexOf('if: >-'), deploy.indexOf('needs: ci'));
  assert.match(condition, /github\.ref == 'refs\/heads\/main' &&/);
  assert.match(condition, /needs\.ci\.result == 'success' &&/);
  assert.match(condition, /inputs\.action == 'publish'/);
  assert.doesNotMatch(deploy.slice(0, deploy.indexOf('steps:')), /FIREBASE_SERVICE_ACCOUNT_JSON/);
  assert.match(deploy, /name: Configure Firebase authentication\s+env:\s+FIREBASE_SERVICE_ACCOUNT_JSON:/);
});

test('SQL bootstrap includes the blocked account status migration after the existing migrations', () => {
  const bootstrap = readFileSync(new URL('functions/scripts/bootstrap-sql.mjs', root), 'utf8');
  assert.match(bootstrap, /'021-donor-trigger-search-path\.sql','022-blocked-account-status\.sql'/);
  assert.ok(existsSync(new URL('sql/findi/022-blocked-account-status.sql', root)));
});

test('deploy preservation retains custom SQL connection settings and replication state', () => {
  const existing = {
    USE_SQL_DATABASE: 'true',
    SQL_REPLICATION_ENABLED: 'true',
    SQL_INSTANCE_CONNECTION_NAME: 'test-project:test-region:custom-instance',
    SQL_DATABASE_NAME: 'custom-database',
    SQL_DATABASE_USER: 'custom-runtime'
  };
  const preserved = preserveServerConfig(existing, 'test-project');
  for (const [key, value] of Object.entries(existing)) assert.equal(preserved[key], value, key);
});

test('prerendered sitemap pages use URLs without trailing-slash redirects', () => {
  const config = readJson('firebase.json');
  assert.equal(config.hosting.trailingSlash, false);
  const routes = readFileSync(new URL('prerender-routes.txt', root), 'utf8').trim().split(/\r?\n/);
  assert.ok(routes.every(path => path === '/' || !path.endsWith('/')));
});

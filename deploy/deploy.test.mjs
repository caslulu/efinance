import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const release = 'a'.repeat(40);
const image = `ghcr.io/caslulu/efinance-backend@sha256:${'b'.repeat(64)}`;
const frontendImage = `ghcr.io/caslulu/efinance-frontend@sha256:${'c'.repeat(64)}`;
const dockerStub = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.DEPLOY_TEST_LOG, JSON.stringify(args) + '\\n');
if (args[0] === 'inspect') { console.log('sha256:' + 'd'.repeat(64)); process.exit(0); }
if (args.includes('exec')) {
  if (process.env.FAIL_AT === 'backup') process.exit(1);
  console.log('-- database backup');
}
if (args.includes('run') && process.env.FAIL_AT === 'schema') process.exit(1);
if (args.includes('up') && args.includes('backend') && !args.includes('never') && process.env.FAIL_AT === 'deploy') process.exit(1);
`;

function scenario(failure, check) {
  const app = mkdtempSync('/tmp/finance-deploy-');
  try {
    const releaseDir = join(app, '.deploy/releases', release);
    const bin = join(app, 'bin');
    const registry = join(app, '.deploy/registry-test');
    mkdirSync(releaseDir, { recursive: true });
    mkdirSync(bin);
    mkdirSync(registry);
    mkdirSync(join(app, 'backend'));
    writeFileSync(join(app, '.env.prod'), 'DB_USER=test\nDB_PASSWORD=test\nDB_NAME=test\n');
    writeFileSync(join(app, 'backend/.env.prod'), 'JWT_SECRET=test\n');
    writeFileSync(join(registry, 'config.json'), '{}');
    copyFileSync(resolve('docker-compose.prod.yml'), join(releaseDir, 'docker-compose.prod.yml'));
    writeFileSync(join(bin, 'docker'), dockerStub, { mode: 0o700 });
    writeFileSync(join(bin, 'flock'), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
    writeFileSync(join(bin, 'curl'), '#!/bin/sh\nprintf \'{"message":"OK"}\'\n', { mode: 0o700 });
    const log = join(app, 'commands.jsonl');
    const result = spawnSync('bash', ['deploy/deploy.sh', app, release, image, frontendImage], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, DEPLOY_TEST_LOG: log, FAIL_AT: failure || '', DOCKER_CONFIG: registry },
    });
    const commands = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
    check({ result, commands, app });
    assert.equal(existsSync(join(registry, 'config.json')), false, 'registry credentials must be removed');
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
}

test('deploy succeeds after backup and schema update, recording the release', () => {
  scenario('', ({ result, commands, app }) => {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(app, '.deploy/current-release'), 'utf8').trim(), release);
    const backup = commands.findIndex((args) => args.includes('exec'));
    const schema = commands.findIndex((args) => args.includes('run'));
    const update = commands.findIndex((args) => args.includes('up') && args.includes('backend'));
    assert.ok(backup < schema && schema < update);
    assert.equal(commands.some((args) => args.some((arg) => arg.includes('--accept-data-loss'))), false);
    assert.equal(commands.some((args) => args.includes('down')), false);
  });
});

for (const failure of ['backup', 'schema']) {
  test(`${failure} failure leaves application containers untouched`, () => {
    scenario(failure, ({ result, commands, app }) => {
      assert.notEqual(result.status, 0);
      assert.equal(commands.some((args) => args.includes('up') && args.includes('backend')), false);
      assert.equal(existsSync(join(app, '.deploy/current-release')), false);
    });
  });
}

test('an unhealthy deployment restores the exact previous images and fails the workflow', () => {
  scenario('deploy', ({ result, commands, app }) => {
    assert.notEqual(result.status, 0);
    const rollback = commands.find((args) => args.includes('up') && args.includes('never'));
    assert.ok(rollback, result.stderr);
    assert.ok(rollback.includes(join(app, `.deploy/releases/${release}/rollback.env`)));
    assert.match(readFileSync(join(app, `.deploy/releases/${release}/rollback.env`), 'utf8'), /BACKEND_IMAGE=sha256:/);
    assert.equal(existsSync(join(app, '.deploy/current-release')), false);
  });
});

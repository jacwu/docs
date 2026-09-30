import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const cfg = JSON.parse(readFileSync('sandbox.remote.json', 'utf8'));
const action = process.argv[2];
if (!['build', 'run'].includes(action) || !['web', 'cli'].includes(cfg.kind)) {
  throw new Error('Use build/run; configuration kind must be web/cli.');
}
for (const key of ['subscription', 'resourceGroup', 'sandboxGroup', 'region', 'sandboxId']) {
  if (typeof cfg[key] !== 'string' || !cfg[key] || cfg[key].startsWith('YOUR_')) {
    throw new Error(`Configure ${key} in sandbox.remote.json first.`);
  }
}
const env = {
  ...process.env,
  ACA_SUBSCRIPTION: cfg.subscription,
  ACA_RESOURCE_GROUP: cfg.resourceGroup,
  ACA_SANDBOX_GROUP: cfg.sandboxGroup,
  ACA_REGION: cfg.region,
};
const quote = value => "'" + value.replaceAll("'", "'\"'\"'") + "'";
const call = (bin, args) => execFileSync(bin, args, {
  env, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
});
const aca = (...args) => call('aca', args);
const remote = script => aca('sandbox', 'exec', '--id', cfg.sandboxId,
  '-c', `bash -lc ${quote(script)}`);

async function ensureRunning() {
  const get = () => JSON.parse(aca('sandbox', 'get', '--id', cfg.sandboxId, '-o', 'json'));
  if (get().state === 'Stopped') aca('sandbox', 'resume', '--id', cfg.sandboxId);
  for (let i = 0; i < 40; i++) {
    if (get().state === 'Running') return;
    await delay(3000);
  }
  throw new Error('Sandbox did not become Running.');
}

async function build() {
  await ensureRunning();
  const folder = `/workspace/remote-build/runs/${randomUUID()}`;
  const temp = mkdtempSync(join(tmpdir(), 'aca-source-'));
  try {
    const archive = join(temp, 'source.tar.gz');
    if (!Array.isArray(cfg.include) || cfg.include.some(p =>
      typeof p !== 'string' || !p || isAbsolute(p) ||
      p.startsWith('-') || p.includes('\\') || p.split('/').some(x => x === '..' || x === '.'))) {
      throw new Error('include must contain explicit project-relative files/directories.');
    }
    const files = cfg.include.filter(p => existsSync(p));
    for (const required of ['package.json', 'package-lock.json']) {
      if (!files.includes(required)) throw new Error(`Missing ${required}.`);
    }
    call('tar', ['--exclude=.git', '--exclude=node_modules', '--exclude=dist',
      '--exclude=.env*', '--exclude=*.pem', '--exclude=*.key',
      '-czf', archive, ...files]);
    const digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
    remote(`mkdir -p ${quote(folder + '/source')}`);
    aca('sandbox', 'fs', 'cp', archive, `${cfg.sandboxId}:${folder}/source.tar.gz`);
    remote(`cd ${quote(folder)} && printf '%s  source.tar.gz\n' ${quote(digest)} | sha256sum -c - && tar -xzf source.tar.gz -C source`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  console.log(`Remote source: ${folder}/source`);
  const task = `set -e
cd ${quote(folder + '/source')}
export CI=1
export npm_config_cache=/workspace/remote-build/npm-cache
npm ci --include=dev
npm run build
npm test`;
  // Outer shell records the exit code even when a build/test command fails.
  const worker = `set +e
bash -lc ${quote(task)}
code=$?
printf '%s\n' "$code" > exit.tmp
mv exit.tmp exit.code
exit "$code"`;
  // The marker prevents a retried launch request from starting another build.
  remote(`cd ${quote(folder)}
if mkdir dispatched 2>/dev/null; then
  nohup bash -c ${quote(worker)} > build.log 2>&1 < /dev/null &
fi`);

  const deadline = Date.now() + 30 * 60_000;
  while (Date.now() < deadline) {
    const state = remote(`cd ${quote(folder)}; if [ -f exit.code ]; then cat exit.code; else echo PENDING; fi`).trim();
    if (/^\d+$/.test(state)) {
      console.log(remote(`cat ${quote(folder + '/build.log')}`));
      if (Number(state) !== 0) throw new Error(`Remote build/test failed: exit ${state}.`);
      return folder + '/source';
    }
    if (state !== 'PENDING') throw new Error(`Unknown job status: ${state}`);
    await delay(3000);
  }
  throw new Error(`Monitoring timed out; remote work may still be running. Inspect ${folder}.`);
}

try {
  // run also builds a fresh snapshot: never silently run an older build.
  const source = await build();
  if (action === 'run') {
    if (cfg.kind === 'web') {
      console.log('Open the configured HTTPS endpoint once the server is ready:');
      console.log(aca('sandbox', 'port', 'list', '--id', cfg.sandboxId));
      console.log('Keep this terminal open. Ctrl+C stops the preview server.');
    } else {
      console.log('Entering cloud Bash. Run npm start -- --help, npm test, or other commands.');
    }
    const command = cfg.kind === 'web' ? 'exec npm start' : 'exec bash --noprofile --norc -i';
    const session = spawnSync('aca', ['sandbox', 'shell', '--id', cfg.sandboxId,
      '-c', `bash -lc ${quote(`cd ${quote(source)} && ${command}`)}`], { env, stdio: 'inherit' });
    if (session.error) throw session.error;
    process.exitCode = session.status ?? 1;
  } else {
    console.log('Build and tests passed in Azure. Artifacts remain in the remote source directory.');
  }
} catch (error) {
  console.error(error.message);
  console.error('No local build/test fallback. On network failure, inspect the remote run before retrying.');
  process.exitCode = 1;
}

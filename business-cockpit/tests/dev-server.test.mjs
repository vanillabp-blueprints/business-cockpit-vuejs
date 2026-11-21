import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readJson, readText, repositoryRoot } from './helpers.mjs';

const devServerPort = 5173;

// Vite listens on the address "localhost" resolves to, which is IPv6 on some machines and IPv4 on others.
const hostAddresses = ['127.0.0.1', '[::1]'];

async function untilAnswers(path, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    for (const host of hostAddresses) {
      try {
        return await fetch(`http://${host}:${devServerPort}${path}`);
      } catch {
        // try the next address
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`the dev server did not answer on port ${devServerPort}`);
}

test('PKG-064 the root script dev starts the dev server of packages/ui on a fixed port at the base path /', async () => {
  assert.equal(readJson('package.json').scripts.dev, 'npm run dev --workspace packages/ui');
  const viteConfig = readText('packages/ui/vite.config.ts');
  assert.match(viteConfig, /strictPort: true/);
  assert.match(viteConfig, new RegExp(`devServerPort = ${devServerPort}`));
  assert.match(viteConfig, /base: '\/'/);

  const devServer = spawn('npm', ['run', 'dev'], { cwd: repositoryRoot, stdio: 'ignore', detached: true });
  try {
    const shell = await untilAnswers('/');
    const shellText = await shell.text();
    assert.match(shellText, /<div id="app">/);
    const unknownPath = await untilAnswers('/some/deep/link');
    assert.equal(unknownPath.status, 200);
    assert.match(await unknownPath.text(), /<div id="app">/, 'an unknown path gets index.html');
  } finally {
    process.kill(-devServer.pid, 'SIGTERM');
  }
});

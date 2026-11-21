import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkEntries } from '@example/bc-module-kit/check';
import { EXPORT_NAMES } from '@example/bc-types';
import { filesBelow, readJson, readText, repositoryRoot } from './helpers.mjs';

const sourcesOf = (folder) =>
  filesBelow(join(repositoryRoot, folder))
    .filter((path) => /\.(ts|vue|js|mjs)$/.test(path) && !path.includes('generated/') && !path.includes('node_modules/') && !path.startsWith('dist/'))
    .map((path) => ({ path: `${folder}/${path}`, text: readText(`${folder}/${path}`) }));

const FRAMEWORKS = /^(react|react-dom|vue|@vue\/|@angular\/|zone\.js|preact|svelte|solid-js|lit)/;

test('PKG-049 the module host depends on the module kit only and has no framework', () => {
  const host = readJson('packages/bc-module-host/package.json');
  assert.deepEqual(Object.keys(host.dependencies), ['@example/bc-module-kit']);
  assert.equal(host.peerDependencies, undefined);
  for (const { path, text } of sourcesOf('packages/bc-module-host/src')) {
    for (const [, specifier] of text.matchAll(/from '([^']+)'/g)) {
      assert.ok(specifier.startsWith('.') || specifier === '@example/bc-module-kit', `${path} imports ${specifier}`);
      assert.doesNotMatch(specifier, FRAMEWORKS);
    }
  }
});

test('PKG-049 the user interface loads every part of a module through the module host, and no other code calls import() for a module', () => {
  const sources = sourcesOf('packages/ui/src');
  const withHost = sources.filter(({ text }) => text.includes("from '@example/bc-module-host'")).map(({ path }) => path);
  assert.ok(withHost.length > 0, 'the user interface uses the host');
  for (const { path, text } of sources) {
    // The only dynamic imports are the lazy screens of the router, with a fixed path of the user interface itself.
    for (const [, argument] of text.matchAll(/\bimport\(\s*([^)]*)\)/g)) {
      assert.match(argument, /^'\.\.?\/[^']*'$/, `${path} calls import(${argument})`);
    }
  }
  const hostSource = readText('packages/bc-module-host/src/module-host.ts');
  assert.match(hostSource, /import\(\/\* @vite-ignore \*\/ \/\* webpackIgnore: true \*\/ url\)/);
});

test('PKG-057 the module host takes the name of the function of a data entry from EXPORT_NAMES, and no other code writes an export name itself', () => {
  const exportNames = Object.values(EXPORT_NAMES);
  assert.ok(exportNames.length >= 5);
  const hostSource = readText('packages/bc-module-host/src/module-host.ts');
  assert.match(hostSource, /\.\.\.EXPORT_NAMES/);
  for (const { path, text } of [...sourcesOf('packages/ui/src'), ...sourcesOf('packages/bc-module-host/src')]) {
    for (const name of exportNames) {
      assert.doesNotMatch(text, new RegExp(`['"\`]${name}['"\`]`), `${path} does not write the export name ${name}`);
    }
  }
});

for (const folder of ['react-module', 'vue-module', 'angular-module']) {
  test(`PKG-040 bc-check-entries passes for the test module ${folder}`, () => {
    const manifest = join(repositoryRoot, 'e2e/modules', folder, 'dist/bc-manifest.json');
    assert.ok(existsSync(manifest), `${folder} is built`);
    const metafile = join(repositoryRoot, 'e2e/modules', folder, 'build/meta.json');
    const { problems, dataEntries } = checkEntries(manifest, { metafile });
    assert.deepEqual(problems, []);
    assert.ok(dataEntries.length >= 3, 'its data entries were checked');
  });
}

test('PKG-040 bc-check-entries fails for a test entry that imports a framework', () => {
  const folder = mkdtempSync(join(tmpdir(), 'entry-'));
  const source = join(repositoryRoot, 'e2e/modules/react-module/src/imports-react.js');
  writeFileSync(source, "import { createElement } from 'react';\nexport const userTaskForm = () => createElement('div');\n");
  try {
    const { metafile } = buildSync({
      entryPoints: { UserTaskForm: source },
      bundle: true,
      format: 'esm',
      minify: true,
      outdir: join(folder, 'dist'),
      metafile: true,
      absWorkingDir: join(repositoryRoot, 'e2e/modules/react-module'),
      logLevel: 'silent',
    });
    mkdirSync(join(folder, 'dist'), { recursive: true });
    writeFileSync(join(folder, 'meta.json'), JSON.stringify(metafile));
    writeFileSync(join(folder, 'dist/bc-manifest.json'), JSON.stringify({ manifestVersion: 1, entries: { UserTaskForm: 'UserTaskForm.js' } }));
    const { problems } = checkEntries(join(folder, 'dist/bc-manifest.json'), { metafile: join(folder, 'meta.json') });
    assert.ok(problems.some((problem) => problem.includes('carries no framework')), problems.join('\n'));
    assert.ok(problems.some((problem) => problem.includes('package react')), 'the metafile names the package');
  } finally {
    // The file lies in the test module only so that the build finds react there.
    rmSync(source, { force: true });
  }
});

test('PKG-056 the three test modules are written in React, Vue and Angular against the module kit of the repository', () => {
  const dependenciesOf = (folder) => Object.keys(readJson(`e2e/modules/${folder}/package.json`).dependencies);
  assert.ok(dependenciesOf('react-module').includes('react'));
  assert.ok(dependenciesOf('vue-module').includes('vue'));
  assert.ok(dependenciesOf('angular-module').includes('@angular/core'));
  for (const folder of ['react-module', 'vue-module', 'angular-module']) {
    assert.ok(dependenciesOf(folder).includes('@example/bc-module-kit'), `${folder} uses the kit of the repository`);
    assert.equal(readJson(`e2e/modules/${folder}/package.json`).private, true);
  }
  assert.doesNotMatch(readFileSync(join(repositoryRoot, 'e2e/modules/angular-module/package.json'), 'utf8'), /zone\.js/);
});

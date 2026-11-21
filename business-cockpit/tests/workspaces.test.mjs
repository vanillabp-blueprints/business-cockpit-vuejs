import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setVersion } from '../scripts/set-version.mjs';
import { readJson, readText, rootPackage, workspacePackages, repositoryRoot, filesBelow } from './helpers.mjs';

const scope = '@example';
const expectedBuildOrder = ['packages/bc-types', 'packages/bc-module-kit', 'packages/bc-module-host', 'packages/bc-theme', 'packages/ui'];

const byFolder = (folder) => workspacePackages().find((candidate) => candidate.folder === folder).content;

test('PKG-044 the root package.json lists every workspace and the one lock file lies at the root', () => {
  const { workspaces } = rootPackage();
  for (const folder of [...expectedBuildOrder, 'packages/bc-dev-shell-*', 'e2e/compare']) {
    assert.ok(workspaces.includes(folder), `${folder} is a workspace`);
  }
  assert.ok(existsSync(join(repositoryRoot, 'package-lock.json')));
  for (const { folder } of workspacePackages()) {
    assert.ok(!existsSync(join(repositoryRoot, folder, 'package-lock.json')), `${folder} has no lock file of its own`);
  }
});

test('PKG-045 the build order is types, kit, host, theme, user interface, dev shells, e2e/compare and then the UI jar', () => {
  const { workspaces, scripts } = rootPackage();
  assert.deepEqual(workspaces, [...expectedBuildOrder, 'packages/bc-dev-shell-*', 'e2e/compare']);
  assert.match(scripts.build, /^npm run build --workspaces --if-present && npm run build:jars/);
});

test('PKG-035 one command builds everything without Maven, Gradle or Java', () => {
  const everyScript = [rootPackage(), ...workspacePackages().map((workspace) => workspace.content)]
    .flatMap((content) => Object.values(content.scripts ?? {}))
    .join('\n');
  assert.doesNotMatch(everyScript, /\b(mvn|mvnw|gradle|gradlew|java)\b/);
  assert.equal(rootPackage().scripts.build.startsWith('npm run build'), true);
});

test('PKG-014 the UI repository has no pom.xml and no Gradle build file', () => {
  const buildFiles = filesBelow(repositoryRoot)
    .filter((path) => !path.startsWith('node_modules/') && !path.includes('/node_modules/'))
    .filter((path) => /(^|\/)(pom\.xml|build\.gradle(\.kts)?|settings\.gradle(\.kts)?)$/.test(path));
  assert.deepEqual(buildFiles, []);
});

test('PKG-014 the backend repository, where it exists, has no package.json', () => {
  const backend = join(repositoryRoot, '..', 'business-cockpit-backend');
  if (!existsSync(backend)) return;
  const packageFiles = filesBelow(backend).filter((path) => !path.includes('node_modules/') && path.endsWith('package.json'));
  assert.deepEqual(packageFiles, []);
});

test('PKG-046 all workspaces have the version of the root package.json; the published ones are public, the others private', () => {
  const version = rootPackage().version;
  for (const { folder, content } of workspacePackages()) {
    assert.equal(content.version, version, `${folder} has the root version`);
  }
  for (const folder of expectedBuildOrder.filter((name) => name !== 'packages/ui')) {
    assert.notEqual(byFolder(folder).private, true, `${folder} is published`);
    assert.ok(byFolder(folder).name.startsWith(`${scope}/`));
  }
  assert.equal(byFolder('packages/ui').private, true);
  assert.equal(byFolder('e2e/compare').private, true);
  assert.equal(rootPackage().private, true);
});

test('PKG-046 set-version writes a new version into every package.json and into the dependencies between the workspaces', () => {
  const copy = mkdtempSync(join(tmpdir(), 'repository-'));
  cpSync(join(repositoryRoot, 'package.json'), join(copy, 'package.json'));
  for (const { folder } of workspacePackages()) {
    cpSync(join(repositoryRoot, folder, 'package.json'), join(copy, folder, 'package.json'));
  }
  setVersion({ root: copy, version: '3.2.1' });
  const read = (path) => JSON.parse(readFileSync(join(copy, path), 'utf8'));
  assert.equal(read('package.json').version, '3.2.1');
  for (const { folder } of workspacePackages()) {
    const content = JSON.parse(readText(join(folder, 'package.json')));
    const rewritten = read(`${folder}/package.json`);
    assert.equal(rewritten.version, '3.2.1');
    for (const name of Object.keys(content.dependencies ?? {}).filter((dependency) => dependency.startsWith(`${scope}/`))) {
      assert.equal(rewritten.dependencies[name], '3.2.1');
    }
  }
  assert.ok(existsSync(join(repositoryRoot, 'scripts/set-version.mjs')));
});

test('PKG-047 each workspace names the workspaces it depends on with their exact version', () => {
  const version = rootPackage().version;
  const dependencies = {
    'packages/bc-types': [],
    'packages/bc-module-kit': ['bc-types'],
    'packages/bc-module-host': ['bc-module-kit'],
    'packages/bc-theme': [],
    'packages/ui': ['bc-module-host', 'bc-module-kit', 'bc-theme'],
  };
  for (const [folder, expected] of Object.entries(dependencies)) {
    const content = byFolder(folder);
    const ownWorkspaces = Object.entries({ ...content.dependencies, ...content.devDependencies })
      .filter(([name]) => name.startsWith(`${scope}/`));
    assert.deepEqual(ownWorkspaces.map(([name]) => name).sort(), expected.map((name) => `${scope}/${name}`).sort(), folder);
    for (const [, range] of ownWorkspaces) assert.equal(range, version, `${folder} names the exact version`);
  }
});

test('PKG-047 npm ci links the workspaces instead of downloading them', () => {
  for (const name of ['bc-types', 'bc-module-kit', 'bc-module-host', 'bc-theme']) {
    const linked = join(repositoryRoot, 'node_modules', scope, name);
    assert.ok(existsSync(linked), `${name} is installed`);
    assert.equal(readdirSync(join(repositoryRoot, 'node_modules', scope), { withFileTypes: true }).find((entry) => entry.name === name).isSymbolicLink(), true);
  }
});

test('PKG-006 the types library is published with no dependencies and no peer dependencies', () => {
  const types = byFolder('packages/bc-types');
  assert.equal(types.dependencies, undefined);
  assert.equal(types.peerDependencies, undefined);
  assert.notEqual(types.private, true);
});

test('PKG-032 Renovate groups the updates of each framework and leaves the dependencies between the workspaces alone', () => {
  const renovate = readJson('renovate.json');
  const groupOf = (name) => renovate.packageRules.find((rule) => rule.matchPackageNames.includes(name))?.groupName;
  assert.equal(groupOf('vue'), groupOf('vue-tsc'));
  assert.ok(groupOf('vue'));
  assert.equal(groupOf('vuetify'), 'vuetify');
  assert.notEqual(renovate.updateInternalDeps, true);
});

test('PKG-062 the client and the types are generated with one exact version of @hey-api/openapi-ts into folders Git ignores', () => {
  for (const folder of ['packages/bc-types', 'packages/ui']) {
    const content = byFolder(folder);
    assert.equal(content.devDependencies['@hey-api/openapi-ts'], '0.99.0');
    assert.equal(content.engines.node, '>=24');
    const ignored = execFileSync('git', ['check-ignore', join(folder, 'src/generated/official-gui-api/types.gen.ts')], { cwd: repositoryRoot }).toString();
    assert.ok(ignored.includes('types.gen.ts'));
  }
  assert.equal(rootPackage().engines.node, '>=24');
  const tracked = execFileSync('git', ['ls-files', '--', '**/src/generated/**'], { cwd: repositoryRoot }).toString();
  assert.equal(tracked.trim(), '', 'no generated file is committed');
  for (const folder of ['packages/bc-types', 'packages/ui']) {
    assert.match(readText(`${folder}/openapi-ts.config.mjs`), /build\/openapi\//, 'it reads a local file, so nothing is downloaded while it runs');
  }
});

test('PKG-062 the client has one class per tag, a client that throws and the data of the answer', () => {
  const config = readText('packages/ui/openapi-ts.config.mjs');
  assert.match(config, /throwOnError: true/);
  assert.match(config, /strategy: 'byTags'/);
  assert.match(config, /responseStyle: 'data'/);
  assert.ok(existsSync(join(repositoryRoot, 'packages/ui/src/generated/official-gui-api/sdk.gen.ts')));
  assert.ok(existsSync(join(repositoryRoot, 'packages/ui/src/generated/cockpit-gui-api/sdk.gen.ts')));
});

test('PKG-055 no code but the configuration names the base path of the GUI API', () => {
  const sourceFiles = filesBelow(join(repositoryRoot, 'packages/ui/src'))
    .filter((path) => !path.startsWith('generated/'))
    .filter((path) => /\.(ts|vue)$/.test(path));
  const naming = sourceFiles.filter((path) => readText(`packages/ui/src/${path}`).includes('/gui/api/v1'));
  assert.deepEqual(naming, ['config.ts']);
  assert.match(readText('packages/ui/src/api/clients.ts'), /officialGuiApiClient\.setConfig/);
  assert.match(readText('packages/ui/src/api/clients.ts'), /cockpitGuiApiClient\.setConfig/);
});

test('PKG-033 the user interface takes its look from the theme library', () => {
  assert.ok(byFolder('packages/ui').dependencies[`${scope}/bc-theme`]);
  assert.match(readText('packages/ui/src/main.ts'), /@example\/bc-theme\/bc-theme\.css/);
  const bundleFiles = filesBelow(join(repositoryRoot, 'packages/ui/dist/assets'));
  const css = bundleFiles.filter((name) => name.endsWith('.css')).map((name) => readText(`packages/ui/dist/assets/${name}`)).join('\n');
  assert.match(css, /--bc-color-primary:/);
  assert.match(css, /Carlito/);
});

test('PKG-008 INTERVIEW.md and CHECKLIST.md are in the project and name the version of the reference', () => {
  assert.match(readText('INTERVIEW.md'), /^Reference: 1\.0\.0$/m);
  assert.match(readText('CHECKLIST.md'), /^Reference: 1\.0\.0$/m);
});

test('PKG-052 INTERVIEW.md has a section with an answer for every question', () => {
  const sections = readText('INTERVIEW.md').split(/^## /m).slice(1).filter((section) => section.startsWith('Q-'));
  assert.ok(sections.length >= 70);
  for (const section of sections) {
    assert.match(section, /^Answer: \S|^Not asked/m, `${section.split('\n')[0]} has an answer or a reason`);
  }
  const skillQuestions = join(repositoryRoot, '..', '.claude/skills/business-cockpit-creator/references/interview.md');
  if (!existsSync(skillQuestions)) return;
  const askedIds = [...readText(join('..', '.claude/skills/business-cockpit-creator/references/interview.md')).matchAll(/^\| `(Q-[A-Z0-9-]+)`/gm)].map((match) => match[1]);
  const answeredIds = sections.map((section) => section.split('\n')[0].trim());
  const missing = askedIds.filter((id) => !answeredIds.includes(id));
  assert.deepEqual(missing, []);
});

test('PKG-063 CHECKLIST.md keeps every item, and every id of the plan is in it', () => {
  const checklist = readText('CHECKLIST.md');
  const ids = readText('plan/ids.txt').split('\n').filter(Boolean);
  assert.ok(ids.length > 300);
  const missing = ids.filter((id) => !checklist.includes(`\`${id}\``));
  assert.deepEqual(missing, []);
  assert.ok(checklist.includes('`CUST-001`'), 'the customer items start at CUST-001');
});

test('PKG-061 the README says how to build, publish, run against a cockpit, run the nginx image and run the end-to-end tests', () => {
  const readme = readText('README.md');
  for (const heading of ['Build', 'Publish', 'Developing against the backend', 'The nginx image', 'End-to-end tests']) {
    assert.match(readme, new RegExp(`^#+ ${heading}`, 'm'), `section ${heading}`);
  }
});

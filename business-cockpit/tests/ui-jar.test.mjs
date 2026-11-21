import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { publishJars } from '../jars/publish-jars.mjs';
import { installJars } from '../jars/install-jars.mjs';
import { readJson, rootPackage, workspacePackages, filesBelow, repositoryRoot } from './helpers.mjs';

const jarSettings = readJson('jars/ui-jar.config.json');
const version = rootPackage().version;
const jarFile = join(repositoryRoot, `jars/dist/${jarSettings.artifactId}-${version}.jar`);
const pomFile = join(repositoryRoot, `jars/dist/${jarSettings.artifactId}-${version}.pom`);
const jarEntries = () => unzipSync(new Uint8Array(readFileSync(jarFile)));

test('PKG-003 the UI jar has the coordinates of the interview and the version of the root package.json', () => {
  assert.equal(jarSettings.groupId, 'com.example.cockpit');
  assert.equal(jarSettings.artifactId, 'business-cockpit-ui');
  assert.equal(version, '0.1.0-SNAPSHOT');
});

test('PKG-003 the UI jar holds index.html and the bundle below static/, and a manifest', () => {
  const names = Object.keys(jarEntries());
  assert.ok(names.includes('META-INF/MANIFEST.MF'));
  assert.ok(names.includes('static/index.html'));
  assert.ok(names.some((name) => name.startsWith('static/assets/') && name.endsWith('.js')));
  assert.ok(names.every((name) => name.startsWith('static/') || name.startsWith('META-INF/')), 'nothing else in the jar');
});

test('PKG-003 the pom has packaging jar and no dependencies', () => {
  const pom = readFileSync(pomFile, 'utf8');
  assert.match(pom, /<groupId>com\.example\.cockpit<\/groupId>/);
  assert.match(pom, /<artifactId>business-cockpit-ui<\/artifactId>/);
  assert.match(pom, new RegExp(`<version>${version}</version>`));
  assert.match(pom, /<packaging>jar<\/packaging>/);
  assert.doesNotMatch(pom, /<dependencies>/);
});

test('PKG-003 the jar and the pom are installed into the local Maven repository', () => {
  const localRepository = mkdtempSync(join(tmpdir(), 'm2-'));
  const folder = installJars({ localRepository });
  assert.equal(folder, join(localRepository, 'com/example/cockpit/business-cockpit-ui', version));
  assert.deepEqual(readFileSync(join(folder, `business-cockpit-ui-${version}.jar`)), readFileSync(jarFile));
  assert.equal(readFileSync(join(folder, `business-cockpit-ui-${version}.pom`), 'utf8'), readFileSync(pomFile, 'utf8'));
});

test('PKG-059 every file of the bundle but index.html lies below /assets/', () => {
  const bundleFiles = filesBelow(join(repositoryRoot, 'packages/ui/dist'));
  assert.ok(bundleFiles.includes('index.html'));
  for (const file of bundleFiles.filter((name) => name !== 'index.html')) {
    assert.ok(file.startsWith('assets/'), `${file} lies below assets/`);
  }
});

test('PKG-020 the bundle has no import map, no es-module-shims and no module federation', () => {
  const entries = jarEntries();
  const textOfBundle = Object.entries(entries)
    .filter(([name]) => /\.(html|js|css)$/.test(name))
    .map(([, content]) => strFromU8(content))
    .join('\n');
  assert.doesNotMatch(textOfBundle, /type=["']importmap["']/);
  assert.doesNotMatch(textOfBundle, /es-module-shims/);
  assert.doesNotMatch(textOfBundle, /__federation|@module-federation|originjs\/vite-plugin-federation/);
  for (const { content } of workspacePackages()) {
    const names = Object.keys({ ...content.dependencies, ...content.devDependencies });
    assert.deepEqual(names.filter((name) => /federation|es-module-shims/.test(name)), []);
  }
});

test('PKG-009 the bundle contains no part of any workflow module', () => {
  const names = Object.keys(jarEntries());
  assert.ok(names.every((name) => !/bc-manifest\.json$/.test(name)));
  assert.ok(!Object.entries(jarEntries()).some(([name, content]) => name.endsWith('.js') && /bc-manifest\.json.*defineBcElement|taxi-ride/.test(strFromU8(content))));
});

async function withUploadServer(run) {
  const stored = new Map();
  const requests = [];
  const server = createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      requests.push({ method: request.method, url: request.url, authorization: request.headers.authorization });
      if (request.method === 'PUT') stored.set(request.url, Buffer.concat(chunks));
      response.statusCode = request.method === 'HEAD' && !stored.has(request.url) ? 404 : 200;
      response.end();
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}/releases`, stored, requests);
  } finally {
    server.close();
  }
}

function folderWithReleaseFiles(releaseVersion) {
  const folder = mkdtempSync(join(tmpdir(), 'jars-'));
  writeFileSync(join(folder, `business-cockpit-ui-${releaseVersion}.jar`), 'jar bytes');
  writeFileSync(join(folder, `business-cockpit-ui-${releaseVersion}.pom`), '<project/>');
  return folder;
}

test('PKG-011 the upload puts jar, pom and their four checksums with PUT, with the credentials of the environment', async () => {
  const folder = folderWithReleaseFiles('1.0.0');
  await withUploadServer(async (repository, stored, requests) => {
    await publishJars({ repositoryUrl: repository, username: 'uploader', password: 'pw', publishedVersion: '1.0.0', folder });
    const base = '/releases/com/example/cockpit/business-cockpit-ui/1.0.0/business-cockpit-ui-1.0.0';
    for (const extension of ['jar', 'pom']) {
      assert.ok(stored.has(`${base}.${extension}`));
      for (const [suffix, algorithm] of [['sha1', 'sha1'], ['md5', 'md5'], ['sha256', 'sha256'], ['sha512', 'sha512']]) {
        const expected = createHash(algorithm).update(stored.get(`${base}.${extension}`)).digest('hex');
        assert.equal(stored.get(`${base}.${extension}.${suffix}`).toString(), expected);
      }
    }
    assert.equal(requests[0].method, 'HEAD', 'it asks first');
    const expectedLogin = 'Basic ' + Buffer.from('uploader:pw').toString('base64');
    assert.ok(requests.every((request) => request.authorization === expectedLogin));
  });
});

test('PKG-011 it uploads no version that ends in -SNAPSHOT', async () => {
  const folder = folderWithReleaseFiles('1.0.0-SNAPSHOT');
  await withUploadServer(async (repository, stored) => {
    await assert.rejects(
      publishJars({ repositoryUrl: repository, publishedVersion: '1.0.0-SNAPSHOT', folder }),
      /snapshot/,
    );
    assert.equal(stored.size, 0);
  });
});

test('PKG-011 it refuses to overwrite a release that is already there', async () => {
  const folder = folderWithReleaseFiles('1.0.0');
  await withUploadServer(async (repository, stored) => {
    await publishJars({ repositoryUrl: repository, publishedVersion: '1.0.0', folder });
    const uploaded = stored.size;
    await assert.rejects(publishJars({ repositoryUrl: repository, publishedVersion: '1.0.0', folder }), /already in the repository/);
    assert.equal(stored.size, uploaded);
  });
});

test('PKG-011 the repository address and the credentials are read from the environment variables the interview names', () => {
  assert.deepEqual(
    [jarSettings.mavenRepositoryUrlVariable, jarSettings.mavenRepositoryUsernameVariable, jarSettings.mavenRepositoryPasswordVariable],
    ['MAVEN_REPOSITORY_URL', 'MAVEN_REPOSITORY_USERNAME', 'MAVEN_REPOSITORY_PASSWORD'],
  );
  assert.equal(rootPackage().scripts['publish:jars'], 'node jars/publish-jars.mjs');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { fetchOpenApiFiles, newestJarVersion } from '../scripts/fetch-openapi.mjs';
import { readJson, readText, repositoryRoot } from './helpers.mjs';

const config = {
  group: 'org.example',
  version: '2.0.0-SNAPSHOT',
  officialGuiApi: { artifact: 'official-api', fileInJar: 'v1.yaml' },
  cockpitGuiApi: { artifact: 'cockpit', fileInJar: 'api/gui/v1.yaml' },
};

const snapshotMetadata = `<metadata><versioning><snapshotVersions>
  <snapshotVersion><classifier>javadoc</classifier><extension>jar</extension><value>2.0.0-20260102.000000-9</value><updated>20260102000000</updated></snapshotVersion>
  <snapshotVersion><extension>jar</extension><value>2.0.0-20260101.000000-8</value><updated>20260101000000</updated></snapshotVersion>
  <snapshotVersion><extension>jar</extension><value>2.0.0-20251231.000000-7</value><updated>20251231000000</updated></snapshotVersion>
  <snapshotVersion><extension>pom</extension><value>2.0.0-20260102.000000-9</value><updated>20260102000000</updated></snapshotVersion>
</snapshotVersions></versioning></metadata>`;

async function withMavenRepository(serve, run) {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ url: request.url, authorization: request.headers.authorization });
    const answer = serve(request.url);
    response.statusCode = answer ? 200 : 404;
    response.end(answer ?? '');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}/maven`, requests);
  } finally {
    server.close();
  }
}

const fakeCockpitJars = (url) => {
  if (url.endsWith('maven-metadata.xml')) return snapshotMetadata;
  if (url.endsWith('official-api-2.0.0-20260101.000000-8.jar')) return Buffer.from(zipSync({ 'v1.yaml': strToU8('openapi: official') }));
  if (url.endsWith('cockpit-2.0.0-20260101.000000-8.jar')) return Buffer.from(zipSync({ 'api/gui/v1.yaml': strToU8('openapi: cockpit') }));
  return null;
};

test('PKG-019 a snapshot takes the newest jar without classifier from maven-metadata.xml', () => {
  assert.equal(newestJarVersion(snapshotMetadata, '2.0.0-SNAPSHOT'), '2.0.0-20260101.000000-8');
});

test('PKG-019 the OpenAPI files are read from the jars of the cockpit coordinates', async () => {
  const outputFolder = mkdtempSync(join(tmpdir(), 'openapi-'));
  await withMavenRepository(fakeCockpitJars, async (repository, requests) => {
    await fetchOpenApiFiles({ config, outputFolder, repository });
    assert.equal(readFileSync(join(outputFolder, 'official-gui-api.yaml'), 'utf8'), 'openapi: official');
    assert.equal(readFileSync(join(outputFolder, 'cockpit-gui-api.yaml'), 'utf8'), 'openapi: cockpit');
    assert.ok(requests.some((request) => request.url === '/maven/org/example/official-api/2.0.0-SNAPSHOT/maven-metadata.xml'));
    assert.ok(requests.every((request) => request.authorization === undefined), 'no login is sent where none is asked for');
  });
});

test('PKG-019 a token is sent only when one is given', async () => {
  const outputFolder = mkdtempSync(join(tmpdir(), 'openapi-'));
  await withMavenRepository(fakeCockpitJars, async (repository, requests) => {
    await fetchOpenApiFiles({ config, outputFolder, repository, token: 'secret-token' });
    assert.ok(requests.length > 0);
    assert.ok(requests.every((request) => request.authorization === 'Bearer secret-token'));
  });
});

test('PKG-019 the cockpit coordinates, the Maven Central snapshot repository and the token variable are configured, the token is not', () => {
  const cockpit = readJson('cockpit.config.json');
  assert.equal(cockpit.group, 'io.vanillabp.businesscockpit');
  assert.equal(cockpit.version, '0.9.0-SNAPSHOT');
  assert.equal(cockpit.repository, 'https://central.sonatype.com/repository/maven-snapshots/');
  assert.match(cockpit.tokenVariable, /^[A-Z_]+$/);
  assert.ok(!JSON.stringify(cockpit).toLowerCase().includes('secret'));
  assert.ok(!readText('scripts/fetch-openapi.mjs').includes('.npmrc'));
});

test('PKG-002 the OpenAPI files come from the jars at build time and are not committed', () => {
  assert.ok(existsSync(join(repositoryRoot, 'build/openapi/official-gui-api.yaml')));
  assert.ok(readText('.gitignore').split('\n').includes('build/'));
  assert.match(readJson('package.json').scripts.prebuild, /fetch:openapi/);
});

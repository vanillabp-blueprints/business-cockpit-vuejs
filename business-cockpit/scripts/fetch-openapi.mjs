// Loads the two OpenAPI files of the GUI API out of the released jars of the Business Cockpit
// and writes them to build/openapi/, where the client generators read them.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

/** Gives the file name stem of the newest jar without classifier that maven-metadata.xml lists. */
export function newestJarVersion(metadataXml, version) {
  if (!version.endsWith('-SNAPSHOT')) return version;
  const snapshotVersions = [...metadataXml.matchAll(/<snapshotVersion>([\s\S]*?)<\/snapshotVersion>/g)].map((match) => match[1]);
  const plainJars = snapshotVersions.filter((entry) => /<extension>jar<\/extension>/.test(entry) && !/<classifier>/.test(entry));
  const newest = plainJars
    .map((entry) => ({
      value: entry.match(/<value>(.*?)<\/value>/)?.[1],
      updated: entry.match(/<updated>(.*?)<\/updated>/)?.[1] ?? '',
    }))
    .filter((entry) => entry.value)
    .sort((first, second) => second.updated.localeCompare(first.updated))[0];
  if (!newest) throw new Error(`maven-metadata.xml lists no jar for ${version}`);
  return newest.value;
}

export function jarUrl({ repository, group, artifact, version, fileVersion }) {
  const folder = `${repository.replace(/\/$/, '')}/${group.replaceAll('.', '/')}/${artifact}/${version}`;
  return { folder, jar: `${folder}/${artifact}-${fileVersion}.jar`, metadata: `${folder}/maven-metadata.xml` };
}

// A token is sent only when the repository asks for a login, that is when the variable is set.
function requestHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function download(url, token) {
  const answer = await fetch(url, { headers: requestHeaders(token) });
  if (!answer.ok) throw new Error(`GET ${url} answered ${answer.status}`);
  return Buffer.from(await answer.arrayBuffer());
}

async function fileOfJar({ repository, group, version, token }, { artifact, fileInJar }) {
  const isSnapshot = version.endsWith('-SNAPSHOT');
  const addresses = jarUrl({ repository, group, artifact, version, fileVersion: version });
  let fileVersion = version;
  if (isSnapshot) {
    const metadata = (await download(addresses.metadata, token)).toString('utf8');
    fileVersion = newestJarVersion(metadata, version);
  }
  const jarAddress = jarUrl({ repository, group, artifact, version, fileVersion }).jar;
  const unpacked = unzipSync(new Uint8Array(await download(jarAddress, token)), { filter: (entry) => entry.name === fileInJar });
  if (!unpacked[fileInJar]) throw new Error(`${jarAddress} has no ${fileInJar}`);
  return { text: Buffer.from(unpacked[fileInJar]).toString('utf8'), fileVersion };
}

export async function fetchOpenApiFiles({ config, outputFolder, repository = config.repository, token }) {
  mkdirSync(outputFolder, { recursive: true });
  const common = { repository, group: config.group, version: config.version, token };
  const versions = {};
  for (const [name, source] of [['official-gui-api', config.officialGuiApi], ['cockpit-gui-api', config.cockpitGuiApi]]) {
    const { text, fileVersion } = await fileOfJar(common, source);
    writeFileSync(`${outputFolder}/${name}.yaml`, text);
    versions[name] = fileVersion;
  }
  writeFileSync(`${outputFolder}/versions.json`, JSON.stringify(versions, null, 2) + '\n');
  return versions;
}

async function main() {
  const config = JSON.parse(readFileSync(`${repositoryRoot}cockpit.config.json`, 'utf8'));
  const repository = process.env.COCKPIT_REPOSITORY_URL ?? config.repository;
  const token = process.env[config.tokenVariable];
  const outputFolder = `${repositoryRoot}build/openapi`;
  const versions = await fetchOpenApiFiles({ config, outputFolder, repository, token });
  console.log(`OpenAPI files of ${config.group} ${config.version} written to build/openapi:`, versions);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((failure) => {
    // A build without network can go on with the files of the last run.
    if (existsSync(`${repositoryRoot}build/openapi/official-gui-api.yaml`) && existsSync(`${repositoryRoot}build/openapi/cockpit-gui-api.yaml`)) {
      console.warn(`Could not load the OpenAPI files (${failure.message}); using those of the last run.`);
      return;
    }
    console.error(failure.message);
    process.exit(1);
  });
}

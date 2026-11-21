// Installs the UI jar and its pom into the local Maven repository, for a backend that builds
// on the same machine. It is the work of `mvn install`, done without Maven.
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jarSettings, version, jarsFolder, fileBaseNameOf, pathInRepositoryOf } from './jar-coordinates.mjs';

export function installJars({ localRepository = join(homedir(), '.m2', 'repository'), folder = jarsFolder } = {}) {
  const fileBaseName = fileBaseNameOf(version);
  const versionFolder = join(localRepository, pathInRepositoryOf(version));
  mkdirSync(versionFolder, { recursive: true });
  for (const extension of ['jar', 'pom']) {
    const installed = join(versionFolder, `${fileBaseName}.${extension}`);
    copyFileSync(join(folder, `${fileBaseName}.${extension}`), installed);
    // Checksums of an earlier build would no longer match the new file, and Maven would complain.
    for (const suffix of ['md5', 'sha1', 'sha256', 'sha512']) rmSync(`${installed}.${suffix}`, { force: true });
  }
  const artifactFolder = join(versionFolder, '..');
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  writeFileSync(join(artifactFolder, 'maven-metadata-local.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<metadata>
  <groupId>${jarSettings.groupId}</groupId>
  <artifactId>${jarSettings.artifactId}</artifactId>
  <versioning>
    <versions>
      <version>${version}</version>
    </versions>
    <lastUpdated>${timestamp}</lastUpdated>
  </versioning>
</metadata>
`);
  return versionFolder;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`Installed the UI jar into ${installJars()}`);
}

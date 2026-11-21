// Builds the UI jar from packages/ui/dist. A jar is a zip file with a manifest; it holds no
// compiled class, so neither Maven nor Java is needed.
import { createWriteStream, mkdirSync, readdirSync, statSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { pipeline } from 'node:stream/promises';
import yazl from 'yazl';
import { jarSettings, version, jarsFolder, fileBaseNameOf } from './jar-coordinates.mjs';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

export function pomText() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>${jarSettings.groupId}</groupId>
  <artifactId>${jarSettings.artifactId}</artifactId>
  <version>${version}</version>
  <packaging>jar</packaging>
  <name>${jarSettings.artifactId}</name>
  <description>${jarSettings.description}</description>
</project>
`;
}

function filesBelow(folder) {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? filesBelow(path) : [path];
  });
}

export async function buildJar({ bundleFolder }) {
  const fileBaseName = fileBaseNameOf(version);
  if (!existsSync(join(bundleFolder, 'index.html'))) {
    throw new Error(`${bundleFolder} has no index.html; build packages/ui first`);
  }
  rmSync(jarsFolder, { recursive: true, force: true });
  mkdirSync(jarsFolder, { recursive: true });
  const jar = new yazl.ZipFile();
  // The manifest comes first, as the jar format asks for.
  jar.addBuffer(Buffer.from('Manifest-Version: 1.0\r\nCreated-By: business-cockpit UI build\r\n\r\n'), 'META-INF/MANIFEST.MF');
  for (const file of filesBelow(bundleFolder)) {
    jar.addFile(file, `${jarSettings.folderInJar}/${relative(bundleFolder, file).split('\\').join('/')}`);
  }
  jar.end();
  await pipeline(jar.outputStream, createWriteStream(join(jarsFolder, `${fileBaseName}.jar`)));
  writeFileSync(join(jarsFolder, `${fileBaseName}.pom`), pomText());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildJar({ bundleFolder: `${repositoryRoot}packages/ui/dist` });
  console.log(`Built ${jarsFolder}/${fileBaseNameOf(version)}.jar and .pom`);
}

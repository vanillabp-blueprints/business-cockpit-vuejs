// What build, install and publish all need to know about the UI jar.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

export const jarSettings = JSON.parse(readFileSync(`${repositoryRoot}jars/ui-jar.config.json`, 'utf8'));
export const version = JSON.parse(readFileSync(`${repositoryRoot}package.json`, 'utf8')).version;
export const jarsFolder = `${repositoryRoot}jars/dist`;

export function fileBaseNameOf(jarVersion) {
  return `${jarSettings.artifactId}-${jarVersion}`;
}

export function pathInRepositoryOf(jarVersion) {
  return `${jarSettings.groupId.replaceAll('.', '/')}/${jarSettings.artifactId}/${jarVersion}`;
}

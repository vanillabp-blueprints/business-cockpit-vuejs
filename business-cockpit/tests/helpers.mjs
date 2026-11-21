import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

export const readText = (relativePath) => readFileSync(join(repositoryRoot, relativePath), 'utf8');
export const readJson = (relativePath) => JSON.parse(readText(relativePath));

export const rootPackage = () => readJson('package.json');

/** The package.json files of the root and of every workspace that exists. */
export function workspacePackages() {
  const root = rootPackage();
  const folders = root.workspaces.flatMap((pattern) => {
    if (!pattern.includes('*')) return [pattern];
    const parent = pattern.split('*')[0];
    const parentPath = join(repositoryRoot, parent);
    if (!existsSync(parentPath)) return [];
    return readdirSync(parentPath).map((name) => join(parent, name));
  });
  return folders
    .filter((folder) => existsSync(join(repositoryRoot, folder, 'package.json')))
    .map((folder) => ({ folder, content: readJson(join(folder, 'package.json')) }));
}

/** Every file below a folder, as paths relative to it. */
export function filesBelow(folder, prefix = '') {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? filesBelow(path, `${prefix}${name}/`) : [`${prefix}${name}`];
  });
}

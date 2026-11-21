// Writes one version into every package.json of the repository and into the dependencies
// between the workspaces, then runs npm install so that the lock file follows.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dependencyKinds = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

function packageFilesBelow(root, workspacePatterns) {
  const files = [join(root, 'package.json')];
  for (const pattern of workspacePatterns) {
    const [folder, wildcard] = pattern.split('*');
    if (wildcard === undefined) {
      files.push(join(root, pattern, 'package.json'));
    } else {
      const parent = join(root, folder);
      if (!existsSync(parent)) continue;
      for (const entry of readdirSync(parent)) {
        const candidate = join(parent, entry, 'package.json');
        if (statSync(join(parent, entry)).isDirectory() && existsSync(candidate)) files.push(candidate);
      }
    }
  }
  return files.filter((file) => existsSync(file));
}

export function setVersion({ root, version }) {
  const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const files = packageFilesBelow(root, rootPackage.workspaces ?? []);
  const workspaceNames = new Set(files.map((file) => JSON.parse(readFileSync(file, 'utf8')).name));
  for (const file of files) {
    const content = JSON.parse(readFileSync(file, 'utf8'));
    content.version = version;
    for (const kind of dependencyKinds) {
      for (const name of Object.keys(content[kind] ?? {})) {
        if (workspaceNames.has(name)) content[kind][name] = version;
      }
    }
    writeFileSync(file, JSON.stringify(content, null, 2) + '\n');
  }
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version, ...options] = process.argv.slice(2);
  if (!version) {
    console.error('Usage: node scripts/set-version.mjs <version> [--skip-install]');
    process.exit(1);
  }
  const root = fileURLToPath(new URL('..', import.meta.url));
  const files = setVersion({ root, version });
  console.log(`Version ${version} written to ${files.length} package.json files.`);
  if (!options.includes('--skip-install')) {
    execFileSync('npm', ['install'], { cwd: root, stdio: 'inherit' });
  }
}

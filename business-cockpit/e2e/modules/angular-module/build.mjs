// Builds the test module with the Angular CLI, as every Angular project builds, and writes bc-manifest.json
// from the list of outputs the CLI writes with statsJson. Then it runs bc-check-entries.
import { createManifest } from '@example/bc-module-kit';
import { checkEntries } from '@example/bc-module-kit/check';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleFolder = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(moduleFolder, 'package.json'), 'utf8'));
const isForced = process.argv.includes('--force');

function newestChangeBelow(path) {
  if (!existsSync(path)) return 0;
  if (!statSync(path).isDirectory()) return statSync(path).mtimeMs;
  return Math.max(0, ...readdirSync(path).filter((name) => name !== 'bc-build.ts').map((name) => newestChangeBelow(join(path, name))));
}

const manifestFile = join(moduleFolder, 'dist', 'bc-manifest.json');
const inputs = ['src', 'angular.json', 'tsconfig.json', 'package.json', 'build.mjs', '../../../packages/bc-module-kit/dist', '../../../packages/bc-types/dist'].map((name) => join(moduleFolder, name));
if (!isForced && existsSync(manifestFile) && statSync(manifestFile).mtimeMs > Math.max(...inputs.map(newestChangeBelow))) {
  console.log(`${packageJson.name}: the build is up to date`);
  process.exit(0);
}

const buildId = Date.now().toString(36);
writeFileSync(
  join(moduleFolder, 'src', 'bc-build.ts'),
  `export const WORKFLOW_MODULE_ID = ${JSON.stringify(packageJson.workflowModuleId)};\nexport const BUILD_ID = ${JSON.stringify(buildId)};\n`,
);

rmSync(join(moduleFolder, 'dist'), { recursive: true, force: true });
const ng = join(moduleFolder, 'node_modules', '.bin', 'ng');
execFileSync(existsSync(ng) ? ng : join(moduleFolder, '..', '..', '..', 'node_modules', '.bin', 'ng'), ['build'], { cwd: moduleFolder, stdio: 'inherit' });

// The statistics of the build name the output of each entry point; the sources name the entry.
const statsFile = join(moduleFolder, 'dist', 'browser-stats.json');
const stats = JSON.parse(readFileSync(statsFile, 'utf8'));
const entryOfSource = {
  'src/data/user-task-list.ts': 'UserTaskList',
  'src/data/workflow-list.ts': 'WorkflowList',
  'src/data/user-task-form.ts': 'UserTaskForm',
  'src/forms/claim-forms.ts': 'ClaimForms',
};
const filesOfEntries = {};
for (const [output, { entryPoint }] of Object.entries(stats.outputs)) {
  const entry = entryPoint && entryOfSource[relative(moduleFolder, resolve(moduleFolder, entryPoint))];
  if (entry) filesOfEntries[entry] = output;
}
mkdirSync(join(moduleFolder, 'build'), { recursive: true });
renameSync(statsFile, join(moduleFolder, 'build', 'meta.json'));
writeFileSync(
  manifestFile,
  JSON.stringify(createManifest({ entries: filesOfEntries, buildVersion: packageJson.version, buildTimestamp: new Date(Number.parseInt(buildId, 36)) }), null, 2),
);

const { problems } = checkEntries(manifestFile, { metafile: join(moduleFolder, 'build', 'meta.json') });
if (problems.length > 0) {
  console.error(problems.map((problem) => `- ${problem}`).join('\n'));
  process.exit(1);
}
console.log(`${packageJson.name}: built ${Object.keys(filesOfEntries).length} entries`);

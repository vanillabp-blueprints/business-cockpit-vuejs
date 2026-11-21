// Builds a test module with esbuild, the way a module of the organisation builds its parts: one file per
// entry with the hash of its content in the name, a bc-manifest.json written from the list of outputs, and
// bc-check-entries over the result. A Vue file is compiled with the compiler that comes with the package vue.
import { build } from 'esbuild';
import { createManifest } from '@example/bc-module-kit';
import { checkEntries } from '@example/bc-module-kit/check';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const moduleFolder = resolve(process.argv[2] ?? '.');
const isForced = process.argv.includes('--force');
const here = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(moduleFolder, 'package.json'), 'utf8'));

function newestChangeBelow(path) {
  if (!existsSync(path)) return 0;
  if (!statSync(path).isDirectory()) return statSync(path).mtimeMs;
  return Math.max(0, ...readdirSync(path).filter((name) => name !== 'bc-build.js').map((name) => newestChangeBelow(join(path, name))));
}

const manifestFile = join(moduleFolder, 'dist', 'bc-manifest.json');
const inputs = [join(moduleFolder, 'src'), join(moduleFolder, 'entries.mjs'), join(moduleFolder, 'package.json'), join(here, 'build-module.mjs'), join(here, '../../packages/bc-module-kit/dist'), join(here, '../../packages/bc-types/dist')];
if (!isForced && existsSync(manifestFile) && statSync(manifestFile).mtimeMs > Math.max(...inputs.map(newestChangeBelow))) {
  console.log(`${packageJson.name}: the build is up to date`);
  process.exit(0);
}

const buildId = Date.now().toString(36);
writeFileSync(
  join(moduleFolder, 'src', 'bc-build.js'),
  `export const WORKFLOW_MODULE_ID = ${JSON.stringify(packageJson.workflowModuleId)};\nexport const BUILD_ID = ${JSON.stringify(buildId)};\n`,
);

const { entries } = await import(pathToFileURL(join(moduleFolder, 'entries.mjs')).href);

/** Hands every .vue file to the compiler of the package vue; the template is compiled into the script. */
const vueFiles = {
  name: 'vue-files',
  setup(esbuild) {
    const compiler = createRequire(join(moduleFolder, 'package.json'))('vue/compiler-sfc');
    esbuild.onLoad({ filter: /\.vue$/ }, (file) => {
      const source = readFileSync(file.path, 'utf8');
      const { descriptor, errors } = compiler.parse(source, { filename: file.path });
      if (errors.length > 0) return { errors: errors.map((error) => ({ text: error.message })) };
      if (descriptor.styles.length > 0) {
        return { errors: [{ text: 'A style block does not reach the shadow root. Write the style in a css file and add it to the shadow root.' }] };
      }
      const script = compiler.compileScript(descriptor, { id: basename(file.path), inlineTemplate: true });
      return { contents: script.content, loader: script.lang === 'ts' || script.lang === 'tsx' ? 'ts' : 'js', resolveDir: dirname(file.path) };
    });
  },
};

rmSync(join(moduleFolder, 'dist'), { recursive: true, force: true });
const outcome = await build({
  absWorkingDir: moduleFolder,
  entryPoints: entries,
  bundle: true,
  splitting: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  outdir: 'dist',
  entryNames: 'entries/[name]-[hash]',
  chunkNames: 'chunks/[name]-[hash]',
  metafile: true,
  jsx: 'automatic',
  loader: { '.css': 'text' },
  define: { 'process.env.NODE_ENV': '"production"', __VUE_OPTIONS_API__: 'false', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
  plugins: [vueFiles],
  logLevel: 'warning',
});

const entryOfSource = Object.fromEntries(Object.entries(entries).map(([entry, source]) => [resolve(moduleFolder, source), entry]));
const filesOfEntries = {};
for (const [output, { entryPoint }] of Object.entries(outcome.metafile.outputs)) {
  const entry = entryPoint && entryOfSource[resolve(moduleFolder, entryPoint)];
  if (entry) filesOfEntries[entry] = relative('dist', output);
}
writeFileSync(
  manifestFile,
  JSON.stringify(createManifest({ entries: filesOfEntries, buildVersion: packageJson.version, buildTimestamp: new Date(Number.parseInt(buildId, 36)) }), null, 2),
);
mkdirSync(join(moduleFolder, 'build'), { recursive: true });
writeFileSync(join(moduleFolder, 'build', 'meta.json'), JSON.stringify(outcome.metafile));

const { problems } = checkEntries(manifestFile, { metafile: join(moduleFolder, 'build', 'meta.json') });
if (problems.length > 0) {
  console.error(problems.map((problem) => `- ${problem}`).join('\n'));
  process.exit(1);
}
console.log(`${packageJson.name}: built ${Object.keys(filesOfEntries).length} entries`);

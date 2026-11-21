// The checks of `bc-check-entries`, for a module's build. They run in Node.js and use nothing but the
// types library and Node itself.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { EXPORT_NAMES } from '@example/bc-types';
import { readManifest } from './manifest.js';

/** The limit of a data entry with every file it imports: 32 KB before compression. */
export const DEFAULT_LIMIT_BYTES = 32 * 1024;

/** The packages whose code must not be in a data entry. The check finds them through the inputs of a metafile. */
export const FRAMEWORK_PACKAGES: readonly string[] = [
  'react', 'react-dom', 'scheduler', 'vue', '@vue/', '@angular/', 'zone.js',
  'preact', 'svelte', 'solid-js', 'lit', 'lit-html', 'lit-element', '@lit/',
];

/** Markers that framework packages leave in a bundle, also when it is minified. */
export const FRAMEWORK_MARKERS: ReadonlyArray<{ framework: string; marker: string }> = [
  { framework: 'react', marker: '@license React' },
  { framework: 'react', marker: 'react.transitional.element' },
  { framework: 'react', marker: '__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE' },
  { framework: 'react', marker: '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED' },
  { framework: 'vue', marker: '__vue_app__' },
  { framework: 'vue', marker: '__v_isRef' },
  { framework: 'angular', marker: '@license Angular' },
  { framework: 'angular', marker: 'ɵɵdefineComponent' },
  { framework: 'zone.js', marker: '__zone_symbol__' },
  { framework: 'lit', marker: 'litHtmlVersions' },
];

/** Reads a size like `32kb`, `0.5mb` or `32768`. A kilobyte is 1024 bytes. */
export function parseLimit(size: string | number): number {
  if (typeof size === 'number') return size;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(b|kb|k|mb|m)?\s*$/i.exec(size);
  if (!match) throw new Error(`"${size}" is no size; write it like 32kb or 32768`);
  const factors: Record<string, number> = { b: 1, k: 1024, kb: 1024, m: 1024 * 1024, mb: 1024 * 1024 };
  return Math.round(Number(match[1]) * factors[(match[2] ?? 'b').toLowerCase()]);
}

/** Lists the frameworks whose markers are in a source. */
export function findFrameworkCode(source: string): string[] {
  const found = new Set<string>();
  for (const { framework, marker } of FRAMEWORK_MARKERS) {
    if (source.includes(marker)) found.add(framework);
  }
  return [...found];
}

const STATIC_IMPORT = /(?:^|[^.\w$])(?:import|export)\s*(?:[\w$*{}\s,]*?\s*from\s*)?["']([^"'\n]+)["']/g;
const DYNAMIC_IMPORT = /(?:^|[^.\w$])import\s*\(\s*["']([^"'\n]+)["']\s*\)/g;

/** Lists the specifiers a file imports, static ones and dynamic ones with a fixed string. */
export function importsOf(source: string): string[] {
  const specifiers = new Set<string>();
  for (const pattern of [STATIC_IMPORT, DYNAMIC_IMPORT]) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

/** The file part of a manifest entry, without `?v=...` and without `#...`. */
const pathOf = (file: string): string => file.split(/[?#]/, 1)[0];

/** Reads the inputs per output file from an esbuild metafile. */
function readMetafile(metafilePath: string): (file: string) => string[] | undefined {
  const metafile = JSON.parse(readFileSync(metafilePath, 'utf8')) as { outputs?: Record<string, { inputs?: object }> };
  const outputs = Object.entries(metafile.outputs ?? {}).map(([output, { inputs }]) => ({
    suffix: sep + output.split('/').join(sep).replace(/^(\.\.?[\\/])+/, ''),
    inputs: Object.keys(inputs ?? {}),
  }));
  return (file) => outputs.find(({ suffix }) => file.endsWith(suffix))?.inputs;
}

/** Says whether an input of a bundle comes from a framework package, and names the package. */
function frameworkOfInput(input: string): string | undefined {
  const parts = input.split(/[\\/]node_modules[\\/]|^node_modules[\\/]/);
  if (parts.length < 2) return undefined;
  const segments = parts[parts.length - 1].split(/[\\/]/);
  // A scoped package has two segments in its name, @scope/name.
  const name = segments[0].startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
  const isFramework = FRAMEWORK_PACKAGES.some((framework) => (framework.endsWith('/') ? name.startsWith(framework) : name === framework));
  return isFramework ? name : undefined;
}

export interface CheckOptions {
  limit?: number | string;
  dataEntries?: string[];
  metafile?: string;
}

export interface CheckedDataEntry {
  entry: string;
  files: string[];
  bytes: number;
}

/**
 * Checks the entries of a manifest. Every entry must have a file. Every data entry, with every file it
 * imports, must stay below the limit, must import nothing by a bare name, and must hold no framework
 * code. The data entries are the keys of `EXPORT_NAMES`, together with `options.dataEntries`: the
 * entries of the module's own. A visual entry is only checked for its file.
 */
export function checkEntries(
  manifestPath: string,
  options: CheckOptions = {},
): { problems: string[]; dataEntries: CheckedDataEntry[] } {
  const limit = parseLimit(options.limit ?? DEFAULT_LIMIT_BYTES);
  const dataEntryNames = new Set([...Object.keys(EXPORT_NAMES), ...(options.dataEntries ?? [])]);
  const inputsOf = options.metafile ? readMetafile(resolve(options.metafile)) : () => undefined;
  const base = dirname(resolve(manifestPath));
  const problems: string[] = [];
  const dataEntries: CheckedDataEntry[] = [];

  let manifest;
  try {
    manifest = readManifest(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return { problems: [(error as Error).message], dataEntries };
  }

  for (const [entry, file] of Object.entries(manifest.entries)) {
    const path = resolve(base, pathOf(file));
    if (!existsSync(path) || !statSync(path).isFile()) {
      problems.push(`${entry}: the file ${file} does not exist`);
      continue;
    }
    if (!dataEntryNames.has(entry)) continue;

    const files: string[] = [];
    const seen = new Set<string>();
    const queue = [path];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (seen.has(current)) continue;
      seen.add(current);
      files.push(current);
      const source = readFileSync(current, 'utf8');
      const shown = current.slice(base.length + 1);
      for (const framework of findFrameworkCode(source)) {
        problems.push(`${entry}: ${shown} contains code of ${framework}; a data entry carries no framework`);
      }
      for (const input of inputsOf(current) ?? []) {
        const framework = frameworkOfInput(input);
        if (framework) problems.push(`${entry}: ${shown} was built from ${input} of the package ${framework}; a data entry carries no framework`);
      }
      for (const specifier of importsOf(source)) {
        if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
          problems.push(`${entry}: ${shown} imports "${specifier}"; an entry imports only files of its own module, by relative paths`);
          continue;
        }
        const imported = resolve(dirname(current), pathOf(specifier));
        if (!imported.startsWith(base + sep)) {
          problems.push(`${entry}: ${shown} imports ${specifier}, which lies outside the folder of the manifest`);
        } else if (!existsSync(imported)) {
          problems.push(`${entry}: ${shown} imports ${specifier}, which does not exist`);
        } else {
          queue.push(imported);
        }
      }
    }
    const bytes = files.reduce((sum, current) => sum + statSync(current).size, 0);
    if (bytes > limit) {
      problems.push(`${entry}: ${bytes} bytes with the files it imports, more than the limit of ${limit} bytes`);
    }
    dataEntries.push({ entry, files: files.map((current) => current.slice(base.length + 1)), bytes });
  }
  return { problems: [...new Set(problems)], dataEntries };
}

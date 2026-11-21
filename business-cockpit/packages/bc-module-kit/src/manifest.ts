import type { BcManifest } from '@example/bc-types';

/** The fixed name of the manifest at the root of the module's web path. */
export const MANIFEST_FILE_NAME = 'bc-manifest.json';

/** The version of the manifest format this kit writes and reads. */
export const MANIFEST_VERSION = 1;

/** Thrown when a manifest breaks the format. `problems` lists every rule it breaks. */
export class BcManifestError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`bc-manifest.json is not valid:\n- ${problems.join('\n- ')}`);
    this.name = 'BcManifestError';
    this.problems = problems;
  }
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Says what is wrong with a file of the manifest. The file must stay below the module's web path. */
function problemOfFile(file: unknown): string | undefined {
  if (typeof file !== 'string' || file.length === 0) return 'is not a non-empty string';
  if (SCHEME.test(file) || file.startsWith('//')) return 'is a whole address, but it must be relative to the manifest';
  if (file.startsWith('/')) return 'starts with "/", but it must be relative to the manifest';
  const path = file.split(/[?#]/, 1)[0];
  if (path.split('/').includes('..')) return 'leaves the module\'s web path with ".."';
  return undefined;
}

/**
 * Checks a parsed manifest and lists every rule it breaks. An empty list means the manifest is fine.
 * Fields this version does not know are allowed and ignored.
 */
export function checkManifest(manifest: unknown): string[] {
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return ['the manifest is not a JSON object'];
  }
  const problems: string[] = [];
  const { manifestVersion, buildVersion, buildTimestamp, entries } = manifest as Record<string, unknown>;
  if (!Number.isInteger(manifestVersion) || (manifestVersion as number) < 1) {
    problems.push('"manifestVersion" must be a whole number from 1 on');
  } else if ((manifestVersion as number) > MANIFEST_VERSION) {
    problems.push(`"manifestVersion" is ${manifestVersion}, but this kit only knows version ${MANIFEST_VERSION}`);
  }
  if (buildVersion !== undefined && typeof buildVersion !== 'string') {
    problems.push('"buildVersion" must be a string');
  }
  if (buildTimestamp !== undefined && (typeof buildTimestamp !== 'string' || Number.isNaN(Date.parse(buildTimestamp)))) {
    problems.push('"buildTimestamp" must be a date and time like 2026-10-16T09:30:00Z');
  }
  if (entries === null || typeof entries !== 'object' || Array.isArray(entries)) {
    problems.push('"entries" must be an object of entry name to file');
    return problems;
  }
  for (const [name, file] of Object.entries(entries as Record<string, unknown>)) {
    if (name.length === 0) problems.push('an entry has an empty name');
    if (name.startsWith('./')) {
      problems.push(`the entry "${name}" starts with "./"; write "${name.slice(2)}" instead`);
    }
    const problem = problemOfFile(file);
    if (problem) problems.push(`the file of the entry "${name}" ${problem}`);
  }
  return problems;
}

/** Reads a manifest from its JSON text or from the parsed object, checks it and returns a frozen copy. */
export function readManifest(source: string | object): BcManifest {
  let manifest: unknown = source;
  if (typeof source === 'string') {
    try {
      manifest = JSON.parse(source);
    } catch (error) {
      throw new BcManifestError([`the text is not JSON: ${(error as Error).message}`]);
    }
  }
  const problems = checkManifest(manifest);
  if (problems.length > 0) throw new BcManifestError(problems);
  const { entries, ...rest } = manifest as BcManifest;
  return Object.freeze({ ...rest, entries: Object.freeze({ ...entries }) }) as BcManifest;
}

/** Builds the manifest a module's build writes, from the files its bundler wrote, relative to the manifest. */
export function createManifest(options: {
  entries: Record<string, string>;
  buildVersion?: string;
  buildTimestamp?: string | Date;
}): BcManifest {
  const { entries, buildVersion, buildTimestamp = new Date() } = options;
  return readManifest({
    manifestVersion: MANIFEST_VERSION,
    ...(buildVersion === undefined ? {} : { buildVersion }),
    buildTimestamp: buildTimestamp instanceof Date ? buildTimestamp.toISOString() : buildTimestamp,
    entries,
  });
}

/** The address of an entry's file, or `undefined` when the manifest does not name the entry. */
export function entryUrl(manifest: BcManifest, entry: string, manifestUrl: string | URL): string | undefined {
  if (!Object.hasOwn(manifest.entries, entry)) return undefined;
  return new URL(manifest.entries[entry], manifestUrl).href;
}

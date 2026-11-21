// Checks that every language file has every key of the file of the default language. The build of
// the user interface runs it, so a missing translation fails the build and names the file and the key.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultTextFolder = fileURLToPath(new URL('../packages/ui/src/i18n', import.meta.url));
const defaultLanguage = 'de';

export function missingKeys(textFolder, defaultLanguageCode) {
  const languageFiles = readdirSync(textFolder).filter((name) => name.endsWith('.json'));
  const keysOf = (file) => Object.keys(JSON.parse(readFileSync(join(textFolder, file), 'utf8')));
  const keysOfDefaultLanguage = keysOf(`${defaultLanguageCode}.json`);

  return languageFiles
    .filter((file) => file !== `${defaultLanguageCode}.json`)
    .flatMap((file) => {
      const keysOfFile = new Set(keysOf(file));
      return keysOfDefaultLanguage.filter((key) => !keysOfFile.has(key)).map((key) => ({ file, key }));
    });
}

if (process.argv[1] && basename(process.argv[1]) === 'check-texts.mjs') {
  const textFolder = process.argv[2] ?? defaultTextFolder;
  const missing = missingKeys(textFolder, process.argv[3] ?? defaultLanguage);
  for (const { file, key } of missing) console.error(`${file} misses the key "${key}"`);
  process.exit(missing.length === 0 ? 0 : 1);
}

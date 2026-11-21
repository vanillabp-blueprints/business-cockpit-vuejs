import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repositoryRoot } from './helpers.mjs';

const textFolder = join(repositoryRoot, 'packages/ui/src/i18n');
const script = join(repositoryRoot, 'scripts/check-texts.mjs');
const readLanguage = (language) => JSON.parse(readFileSync(join(textFolder, `${language}.json`), 'utf8'));

test('I18N-001 every language has a file of its own and no text lies in the code', () => {
  assert.deepEqual(readdirSync(textFolder).filter((name) => name.endsWith('.json')).sort(), ['de.json', 'en.json', 'fr.json']);
  const components = join(repositoryRoot, 'packages/ui/src/components');
  for (const component of readdirSync(components)) {
    const template = readFileSync(join(components, component), 'utf8').split('</template>')[0];
    const textBetweenTags = [...template.matchAll(/>([^<>{}]*[A-Za-zÄÖÜäöüéè]{3,}[^<>{}]*)</g)].map((match) => match[1].trim());
    assert.deepEqual(textBetweenTags.filter((text) => !text.startsWith('<!--')), [], `${component} has no fixed text`);
  }
});

test('I18N-006 the build fails when a language file misses a key of the default language, and names file and key', () => {
  const folder = mkdtempSync(join(tmpdir(), 'texts-'));
  writeFileSync(join(folder, 'de.json'), JSON.stringify({ 'menu.logout': 'Abmelden', 'menu.language': 'Sprache' }));
  writeFileSync(join(folder, 'en.json'), JSON.stringify({ 'menu.logout': 'Log out' }));

  const outcome = spawnSync('node', [script, folder, 'de'], { encoding: 'utf8' });
  assert.equal(outcome.status, 1);
  assert.match(outcome.stderr, /en\.json misses the key "menu\.language"/);
});

test('I18N-006 the texts of the cockpit are complete and the build of the user interface runs the check first', () => {
  execFileSync('node', [script], { stdio: 'pipe' });
  const { scripts } = JSON.parse(readFileSync(join(repositoryRoot, 'packages/ui/package.json'), 'utf8'));
  assert.match(scripts.prebuild, /check-texts\.mjs/);
});

// NAV-009: the interview chose English Case, German Fall, French Dossier.
const wordForCase = { en: 'Cases', de: 'Fälle', fr: 'Dossiers' };
const otherWordsForCase = {
  en: /\b(process(es)?|workflows?|files?|fall|fälle|dossiers?)\b/i,
  de: /\b(vorgang|vorgänge|prozess(e)?|akten?|cases?|dossiers?)\b/i,
  fr: /\b(cas|processus|affaires?|cases?|fall|fälle)\b/i,
};

for (const language of ['de', 'en', 'fr']) {
  test(`NAV-009 the ${language} texts use the one word for a case and never another`, () => {
    const texts = readLanguage(language);
    assert.equal(texts['lists.cases'], wordForCase[language]);
    for (const [key, text] of Object.entries(texts)) {
      assert.doesNotMatch(text, otherWordsForCase[language], `${language}.json ${key}`);
    }
  });
}

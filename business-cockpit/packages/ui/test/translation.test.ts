import { describe, expect, it } from 'vitest';
import { createTexts, formatDateTime, formatNumber, languagesToTry, pickTranslation } from '../src/i18n/translation';

const files = {
  de: { greeting: 'Hallo', onlyGerman: 'Nur deutsch' },
  en: { greeting: 'Hello' },
  fr: { greeting: 'Bonjour', onlyFrench: 'Seulement français' },
};

describe('I18N-004 a missing translation falls back to the default language, then to the first language there is', () => {
  const texts = createTexts(files, 'de');

  it('uses the chosen language when it has the text', () => {
    expect(texts.text('greeting', 'en')).toBe('Hello');
  });

  it('takes the default language when the chosen one misses the text', () => {
    expect(texts.text('onlyGerman', 'en')).toBe('Nur deutsch');
  });

  it('takes the first language there is when the default language misses the text too', () => {
    expect(texts.text('onlyFrench', 'en')).toBe('Seulement français');
  });

  it('shows the key when no language has the text', () => {
    expect(texts.text('unknown', 'en')).toBe('unknown');
  });

  it('follows the same order for the titles and cells a workflow module brings', () => {
    expect(pickTranslation({ en: 'Open', fr: 'Ouvert' }, 'fr', 'de')).toBe('Ouvert');
    expect(pickTranslation({ de: 'Offen', fr: 'Ouvert' }, 'en', 'de')).toBe('Offen');
    expect(pickTranslation({ fr: 'Ouvert', en: 'Open' }, 'es', 'de')).toBe('Ouvert');
    expect(pickTranslation({}, 'en', 'de')).toBeUndefined();
    expect(languagesToTry('en', 'de', ['fr', 'de'])).toEqual(['en', 'de', 'fr']);
  });

  it('fills the placeholders of a text', () => {
    expect(createTexts({ de: { v: 'Version {version}' } }, 'de').text('v', 'de', { version: '1.2' })).toBe('Version 1.2');
  });
});

describe('I18N-005 numbers and dates are formatted for the chosen language', () => {
  it('writes a number with the separators of the language', () => {
    expect(formatNumber('de', 1000000)).toBe('1.000.000');
    expect(formatNumber('en', 1000000)).toBe('1,000,000');
  });

  it('writes a date and time in the order of the language', () => {
    const moment = '2026-11-21T10:30:00Z';
    expect(formatDateTime('de', moment)).toMatch(/21\.11\.2026/);
    expect(formatDateTime('en', moment)).toMatch(/Nov 21, 2026/);
  });
});

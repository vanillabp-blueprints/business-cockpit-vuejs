import { ref } from 'vue';
import de from './de.json';
import en from './en.json';
import fr from './fr.json';
import { createTexts, dateCellOf, formatDateAndTime, formatDateTime, formatNumber, pickTranslation, type TextFile } from './translation';

export const DEFAULT_LANGUAGE = 'de';

const texts = createTexts({ de, en, fr } satisfies Record<string, TextFile>, DEFAULT_LANGUAGE);

/** The user interface starts in the default language. The language switch changes it later. */
const language = ref(DEFAULT_LANGUAGE);

export function setLanguage(chosenLanguage: string): void {
  language.value = chosenLanguage;
  document.documentElement.lang = chosenLanguage;
}

export function useTexts() {
  return {
    language,
    availableLanguages: texts.availableLanguages,
    text: (key: string, parameters?: Record<string, string | number>) => texts.text(key, language.value, parameters),
    // A language is always named in itself, so a user finds it whatever language the page is in.
    languageName: (languageCode: string) => texts.text('language.name', languageCode),
    formatNumber: (number: number) => formatNumber(language.value, number),
    formatDateTime: (moment: Date | string) => formatDateTime(language.value, moment),
    formatDateAndTime: (moment: Date | string) => formatDateAndTime(language.value, moment),
    dateCellOf: (moment: Date | string) => dateCellOf(language.value, moment),
    // A text of a workflow module comes in many languages. The user reads the one of the chosen language.
    translated: (translations: Record<string, string> | undefined) =>
      translations ? (pickTranslation(translations, language.value, DEFAULT_LANGUAGE) ?? '') : '',
  };
}

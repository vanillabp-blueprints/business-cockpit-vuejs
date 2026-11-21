export type TextFile = Record<string, string>;

/**
 * The order in which languages are tried for one text: the chosen language, then the default
 * language, then the first language there is that has the text. Headers, cells and titles all
 * use this order.
 */
export function languagesToTry(chosenLanguage: string, defaultLanguage: string, availableLanguages: string[]): string[] {
  const inOrder = [chosenLanguage, defaultLanguage, ...availableLanguages];
  return inOrder.filter((language, index) => inOrder.indexOf(language) === index);
}

/** Picks the text of a map from language to text, as a column title or a cell of a workflow module brings it. */
export function pickTranslation(
  translations: Record<string, string>,
  chosenLanguage: string,
  defaultLanguage: string,
): string | undefined {
  const languages = languagesToTry(chosenLanguage, defaultLanguage, Object.keys(translations));
  const language = languages.find((candidate) => translations[candidate]);
  return language === undefined ? undefined : translations[language];
}

/** Puts the parameters into the placeholders, for example `{version}`. */
export function fillPlaceholders(text: string, parameters: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(parameters[name] ?? placeholder));
}

export function createTexts(files: Record<string, TextFile>, defaultLanguage: string) {
  const availableLanguages = Object.keys(files);
  return {
    availableLanguages,
    text(key: string, chosenLanguage: string, parameters: Record<string, string | number> = {}): string {
      const languages = languagesToTry(chosenLanguage, defaultLanguage, availableLanguages);
      const language = languages.find((candidate) => files[candidate]?.[key] !== undefined);
      return language === undefined ? key : fillPlaceholders(files[language][key], parameters);
    },
  };
}

// One formatter per language. A formatter is expensive to make, and a list asks for thousands of numbers.
const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatNumber(language: string, number: number): string {
  if (!numberFormatters.has(language)) numberFormatters.set(language, new Intl.NumberFormat(language));
  return numberFormatters.get(language)!.format(number);
}

export function formatDateTime(language: string, moment: Date | string): string {
  if (!dateTimeFormatters.has(language)) {
    dateTimeFormatters.set(language, new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }));
  }
  return dateTimeFormatters.get(language)!.format(new Date(moment));
}

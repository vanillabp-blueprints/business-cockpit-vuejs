/** How the suggestions of a search field behave. A unit test replaces the delay. */
export interface SuggestionRules {
  minimumLength: number;
  delayMs: number;
  maximumShown: number;
}

export const SUGGESTION_RULES: SuggestionRules = { minimumLength: 3, delayMs: 300, maximumShown: 20 };

/**
 * Asks for suggestions while a user types. It asks once, `delayMs` after the last key, and only
 * from `minimumLength` characters on, because the server answers nothing below that. An answer to
 * an older input is dropped, so a slow answer never replaces a newer one.
 */
export function createSuggestionSource(
  loadWords: (input: string) => Promise<string[]>,
  onSuggestions: (words: string[]) => void,
  rules: SuggestionRules = SUGGESTION_RULES,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latestInput = 0;

  function forgetPendingInput(): void {
    clearTimeout(timer);
    timer = undefined;
    latestInput++;
  }

  return {
    inputChanged(input: string): void {
      forgetPendingInput();
      if (input.length < rules.minimumLength) {
        onSuggestions([]);
        return;
      }
      const thisInput = latestInput;
      timer = setTimeout(async () => {
        try {
          const words = await loadWords(input);
          // The server returns one more than shown, so a user could be told there are more.
          if (thisInput === latestInput) onSuggestions(words.slice(0, rules.maximumShown));
        } catch {
          // Suggestions are a help. When they fail, the user can still type the search and press Enter.
          if (thisInput === latestInput) onSuggestions([]);
        }
      }, rules.delayMs);
    },
    /** The input is taken or cleared: no request starts and no answer is used. */
    stop(): void {
      forgetPendingInput();
      onSuggestions([]);
    },
  };
}

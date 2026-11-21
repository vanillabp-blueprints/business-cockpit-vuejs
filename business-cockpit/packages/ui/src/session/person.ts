import type { Person } from '../generated/official-gui-api/types.gen';

/** The first letters of the first and the last word, so "Clara Maria Clerk" becomes "CC". */
export function initialsOf(person: Pick<Person, 'id' | 'display'>): string {
  const nameOrId = person.display?.trim() || person.id;
  const words = nameOrId.split(/[\s._-]+/).filter(Boolean);
  const firstAndLast = words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1);
  return firstAndLast.map((word) => word[0]!.toLocaleUpperCase()).join('');
}

/** The short form is what a menu and a list show. It falls back to the long form and then to the id. */
export function shortNameOf(person: Pick<Person, 'id' | 'display' | 'displayShort'>): string {
  return person.displayShort?.trim() || person.display?.trim() || person.id;
}

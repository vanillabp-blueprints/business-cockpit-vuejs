import type { KwicResult, SearchQuery, UserTask } from '../../packages/ui/src/generated/official-gui-api/types.gen.ts';

/**
 * What the real cockpit does with `searchQueries`, `sort` and the suggestions, in the small. The
 * real one runs them in MongoDB. This one runs them over a list in memory, so the user interface
 * can be tested for what it asks and for what it does with the answer.
 */

const FIELDS_OF_FULL_TEXT = ['title', 'workflowTitle', 'note'] as const;

/** The text of a field, also for a text of many languages, which the real cockpit stores one text per language. */
function textOf(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textOf).join(' ');
  return Object.values(value as Record<string, unknown>).map(textOf).join(' ');
}

/** The value at a path like `workflowTitle.de` or `assignee.sort`. `<person>.sort` is the name made for sorting. */
function valueAt(task: UserTask, path: string): unknown {
  return path.split('.').reduce<unknown>((value, part) => {
    if (value === undefined || value === null) return undefined;
    if (part === 'sort' && typeof (value as { display?: string }).display === 'string') {
      return (value as { display: string }).display.toLowerCase();
    }
    return (value as Record<string, unknown>)[part];
  }, task);
}

const fullTextOf = (task: UserTask): string =>
  FIELDS_OF_FULL_TEXT.map((field) => textOf((task as unknown as Record<string, unknown>)[field])).join(' ');

/** A query entry without a path searches the full text, as the real cockpit does. The text is plain, never a pattern. */
export function matchesSearch(task: UserTask, search: SearchQuery): boolean {
  const searched = search.path ? textOf(valueAt(task, search.path)) : fullTextOf(task);
  return search.caseInsensitive
    ? searched.toLowerCase().includes(search.query.toLowerCase())
    : searched.includes(search.query);
}

export const matchesAllSearches = (task: UserTask, searches: SearchQuery[] | undefined): boolean =>
  (searches ?? []).every((search) => matchesSearch(task, search));

const FAR_FUTURE = '9999-12-31T00:00:00Z';

const byDueDateThenCreationThenId = (first: UserTask, second: UserTask) =>
  (first.dueDate ?? FAR_FUTURE).localeCompare(second.dueDate ?? FAR_FUTURE) ||
  first.createdAt.localeCompare(second.createdAt) ||
  first.id.localeCompare(second.id);

/** Rows without a value come first when ascending, as MongoDB orders them. */
function compareAt(first: UserTask, second: UserTask, path: string): number {
  const firstText = textOf(valueAt(first, path));
  const secondText = textOf(valueAt(second, path));
  if (firstText === secondText) return 0;
  if (firstText === '') return -1;
  if (secondText === '') return 1;
  return firstText < secondText ? -1 : 1;
}

/** The order of the list, with the order of the server added at the end so that paging stays stable. */
export function sortedBy(tasks: UserTask[], sort: string | undefined, sortAscending: boolean | undefined): UserTask[] {
  if (!sort) return tasks;
  const paths = sort.split(',');
  const direction = sortAscending === false ? -1 : 1;
  return [...tasks].sort((first, second) => {
    for (const path of paths) {
      const order = compareAt(first, second, path);
      if (order !== 0) return order * direction;
    }
    return byDueDateThenCreationThenId(first, second);
  });
}

const WORD = /[\p{L}\p{N}_-]+/gu;
const MORE_THAN_SHOWN = 21;

/** The words of the full text that contain the input, the most frequent first, then in alphabetical order. At most 21. */
export function suggestionsFor(tasks: UserTask[], input: string): KwicResult[] {
  if (input.length < 3) return [];
  const needle = input.toLowerCase();
  const countOfWord = new Map<string, number>();
  for (const task of tasks) {
    for (const [word] of fullTextOf(task).matchAll(WORD)) {
      if (word.toLowerCase().includes(needle)) countOfWord.set(word, (countOfWord.get(word) ?? 0) + 1);
    }
  }
  return [...countOfWord]
    .map(([item, count]) => ({ item, count }))
    .sort((first, second) => second.count - first.count || (first.item < second.item ? -1 : first.item > second.item ? 1 : 0))
    .slice(0, MORE_THAN_SHOWN);
}

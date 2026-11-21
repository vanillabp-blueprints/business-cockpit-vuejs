import type { SearchQuery } from '../generated/official-gui-api/types.gen';

/** What both lists need to know about a column to sort and filter by it. */
export interface QueryableColumn {
  key: string;
  /** The path of the field in the GUI API. For a text of many languages it names the language of the user. */
  pathFor: (language: string) => string;
  sortable: boolean;
  filterable: boolean;
  kind: 'text' | 'person';
}

export interface ListSort {
  columnKey: string;
  isAscending: boolean;
}

/** What the user has typed and clicked to narrow and order a list. Nothing here is a path: the columns turn it into one. */
export interface ListQuery {
  fullText: string;
  /** The search term of each filtered column, by the key of the column. */
  filterOfColumn: Record<string, string>;
  sort: ListSort | undefined;
}

/** The part of a list request that comes from a ListQuery. */
export interface ListRequestPart {
  searchQueries?: SearchQuery[];
  sort?: string;
  sortAscending?: boolean;
}

export const EMPTY_LIST_QUERY: ListQuery = { fullText: '', filterOfColumn: {}, sort: undefined };

export const hasSearchOrFilter = (query: ListQuery): boolean =>
  query.fullText !== '' || Object.values(query.filterOfColumn).some((term) => term !== '');

/** A person is sorted by the name made for sorting, then by the id, so two people with one name keep their order. */
export function sortPathOf(column: QueryableColumn, language: string): string {
  const path = column.pathFor(language);
  return column.kind === 'person' ? `${path}.sort,${path}.id` : path;
}

export function filterPathOf(column: QueryableColumn, language: string): string {
  const path = column.pathFor(language);
  return column.kind === 'person' ? `${path}.sort` : path;
}

/**
 * A click on a header: the first click sorts ascending, the second turns the direction, the third
 * goes back to the default order of the list. A click on another column starts with ascending.
 */
export function sortAfterClickOn(columnKey: string, current: ListSort | undefined): ListSort | undefined {
  if (current?.columnKey !== columnKey) return { columnKey, isAscending: true };
  return current.isAscending ? { columnKey, isAscending: false } : undefined;
}

/**
 * The request fields of a query. Only the columns the list shows with the flags `sortable` and
 * `filterable` count, so a column that has gone away leaves no hidden condition behind. The server
 * joins two conditions on one path in a way that fails today, so there is one entry per path: the
 * full-text search has none, and each column has its own.
 */
export function requestPartOf(query: ListQuery, columns: QueryableColumn[], language: string): ListRequestPart {
  const searchQueries: SearchQuery[] = [];
  // The input goes to the server as it was typed. The server escapes it itself.
  if (query.fullText !== '') searchQueries.push({ query: query.fullText, caseInsensitive: true });
  for (const column of columns) {
    const term = query.filterOfColumn[column.key];
    if (column.filterable && term) searchQueries.push({ path: filterPathOf(column, language), query: term, caseInsensitive: true });
  }

  const part: ListRequestPart = {};
  if (searchQueries.length > 0) part.searchQueries = searchQueries;
  const sortColumn = columns.find((column) => column.key === query.sort?.columnKey);
  if (sortColumn?.sortable) {
    part.sort = sortPathOf(sortColumn, language);
    part.sortAscending = query.sort!.isAscending;
  }
  return part;
}

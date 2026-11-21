/** The rows the user sees, counted from the first row of the list, both ends included. */
export interface RowRange {
  first: number;
  last: number;
}

/** The pages the list holds, both ends included. */
export interface PageRange {
  first: number;
  last: number;
}

/** The number of rows the list has: what the server counts, but never more than the limit. */
export function lengthWithinLimit(totalElements: number, maxEntries: number): number {
  return Math.min(totalElements, maxEntries);
}

/** The page that crosses the limit is cut at the limit, so the list is never longer than that. */
export function cutAtLimit<Row>(rowsOfPage: Row[], pageNumber: number, pageSize: number, maxEntries: number): Row[] {
  const rowsBeforeThisPage = pageNumber * pageSize;
  return rowsOfPage.slice(0, Math.max(0, maxEntries - rowsBeforeThisPage));
}

/**
 * The pages the list wants to hold for the rows the user sees: every page that overlaps the rows,
 * and the given number of pages ahead on both sides. Returns nothing for a list without rows.
 */
export function pagesToHold(visible: RowRange, pageSize: number, lengthOfServerRows: number, pagesAhead: number): PageRange | undefined {
  if (lengthOfServerRows <= 0) return undefined;
  const lastPage = Math.floor((lengthOfServerRows - 1) / pageSize);
  const firstVisibleRow = Math.min(Math.max(visible.first, 0), lengthOfServerRows - 1);
  const lastVisibleRow = Math.min(Math.max(visible.last, 0), lengthOfServerRows - 1);
  return {
    first: Math.max(0, Math.floor(firstVisibleRow / pageSize) - pagesAhead),
    last: Math.min(lastPage, Math.floor(lastVisibleRow / pageSize) + pagesAhead),
  };
}

export function overlap(first: PageRange, second: PageRange): boolean {
  return first.first <= second.last && second.first <= first.last;
}

/** The numbers first to last, nearest to the pages the user sees first, so those arrive first. */
export function pagesNearestFirst(wanted: PageRange, visible: PageRange): number[] {
  const pages: number[] = [];
  for (let page = wanted.first; page <= wanted.last; page++) pages.push(page);
  const distanceToVisible = (page: number) => Math.max(visible.first - page, page - visible.last, 0);
  return pages.sort((first, second) => distanceToVisible(first) - distanceToVisible(second));
}

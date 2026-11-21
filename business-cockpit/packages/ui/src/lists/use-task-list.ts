import { computed, ref, shallowRef } from 'vue';
import type { UserTask, UserTasks } from '../generated/official-gui-api/types.gen';
import { rememberTotalOfList } from '../counts/counts';
import { MAX_PAGE_REQUESTS_AT_ONCE, PAGE_SIZE, PAGES_AHEAD, PAUSE_BEFORE_LOADING_MS } from './list-constants';
import { MAX_LIST_ENTRIES } from './max-list-entries';
import { createPageRequestQueue } from './page-request-queue';
import {
  cutAtLimit,
  lengthWithinLimit,
  overlap,
  pagesNearestFirst,
  pagesToHold,
  type PageRange,
  type RowRange,
} from './page-window';
import type { TaskPrimaryFilter } from './primary-filters';
import { loadPageOfTasks } from './task-list-api';
import type { TaskListName } from './task-lists';

/** What a unit test replaces: the size of a page, the limit, the pause and the way a page is loaded. */
export interface TaskListOptions {
  pageSize: number;
  maxEntries: number;
  pagesAhead: number;
  pauseBeforeLoadingMs: number;
  maxRequestsAtOnce: number;
  loadPage: typeof loadPageOfTasks;
}

/** A row the list draws: the task, or nothing while its page is still on its way. */
export interface DrawnRow {
  index: number;
  task: UserTask | undefined;
}

/**
 * The rows of one task list with one primary filter. The list is as long as the server counts, but
 * holds only a window of pages: the pages the user sees and one page ahead on both sides. Pages
 * further away are dropped, so memory depends on the size of the window and not on the distance
 * scrolled.
 */
export function useTaskList(list: TaskListName, overrides: Partial<TaskListOptions> = {}) {
  const options: TaskListOptions = {
    pageSize: PAGE_SIZE,
    maxEntries: MAX_LIST_ENTRIES,
    pagesAhead: PAGES_AHEAD,
    pauseBeforeLoadingMs: PAUSE_BEFORE_LOADING_MS,
    maxRequestsAtOnce: MAX_PAGE_REQUESTS_AT_ONCE,
    loadPage: loadPageOfTasks,
    ...overrides,
  };
  const queue = createPageRequestQueue<UserTasks>(options.maxRequestsAtOnce);
  const filter = ref<TaskPrimaryFilter>();
  // Only the pages in the window. A page is a plain array that nothing else points at.
  const pages = shallowRef(new Map<number, UserTask[]>());
  // Rows that a live update put above the rows of the server. The page numbers do not count them.
  const liveRowsAbove = shallowRef<UserTask[]>([]);
  const totalElements = ref(0);
  const hasLoadedFirstPage = ref(false);
  const failure = ref<unknown>();
  const visibleRows = shallowRef<RowRange>({ first: 0, last: 0 });
  const heldPages = shallowRef<PageRange>();
  // Every page asks with the timestamp of the first page. Otherwise a task that ends while the
  // user scrolls moves all later rows by one, and the user sees one row twice or none.
  let timestampOfFirstPage: string | undefined;
  // An answer for a filter the user has left meanwhile must not touch the rows of the new one.
  let generation = 0;
  let pauseTimer: ReturnType<typeof setTimeout> | undefined;

  const lengthOfServerRows = computed(() => lengthWithinLimit(totalElements.value, options.maxEntries));
  const length = computed(() => liveRowsAbove.value.length + lengthOfServerRows.value);
  const isCapped = computed(() => totalElements.value > options.maxEntries);

  const rowsOfServerStartAt = () => liveRowsAbove.value.length;

  function rowAt(index: number): UserTask | undefined {
    const liveRows = liveRowsAbove.value;
    if (index < liveRows.length) return liveRows[index];
    const indexOfServerRow = index - liveRows.length;
    return pages.value.get(Math.floor(indexOfServerRow / options.pageSize))?.[indexOfServerRow % options.pageSize];
  }

  /** The rows of the window and the rows the user sees, which differ for a moment after a jump. */
  const rowsToDraw = computed<DrawnRow[]>(() => {
    const held = heldPages.value;
    const ranges: RowRange[] = [visibleRows.value];
    if (held) {
      const firstRowOfServer = rowsOfServerStartAt();
      ranges.push({
        first: held.first === 0 ? 0 : firstRowOfServer + held.first * options.pageSize,
        last: firstRowOfServer + (held.last + 1) * options.pageSize - 1,
      });
    }
    const drawn = new Set<number>();
    for (const range of ranges) {
      const lastIndex = Math.min(range.last, length.value - 1);
      for (let index = Math.max(range.first, 0); index <= lastIndex; index++) drawn.add(index);
    }
    return [...drawn].sort((first, second) => first - second).map((index) => ({ index, task: rowAt(index) }));
  });

  function pagesOfVisibleRows(pagesAhead: number): PageRange | undefined {
    const shift = rowsOfServerStartAt();
    const visible = { first: visibleRows.value.first - shift, last: visibleRows.value.last - shift };
    return pagesToHold(visible, options.pageSize, lengthOfServerRows.value, pagesAhead);
  }

  function askForPage(pageNumber: number): void {
    const askedFor = generation;
    const askedFilter = filter.value!;
    queue.ask({
      key: `${askedFor}:${pageNumber}`,
      load: () => options.loadPage(list, askedFilter, pageNumber, timestampOfFirstPage),
      onLoaded: (answer) => {
        if (askedFor !== generation) return;
        const isFirstPage = !hasLoadedFirstPage.value;
        if (isFirstPage) {
          timestampOfFirstPage = answer.serverTimestamp;
          hasLoadedFirstPage.value = true;
          rememberTotalOfList(list, askedFilter, answer.page.totalElements);
        }
        totalElements.value = answer.page.totalElements;
        // The user may have scrolled on while the page was on its way. Then nobody needs it.
        const held = heldPages.value;
        const isStillWanted = !held || (pageNumber >= held.first && pageNumber <= held.last);
        if (isStillWanted) {
          const rows = cutAtLimit(answer.userTasks, pageNumber, options.pageSize, options.maxEntries);
          pages.value = new Map(pages.value).set(pageNumber, rows);
        }
        // Only the first answer knows how long the list is, so only it can tell which pages to ask for next.
        if (isFirstPage) holdPagesOfVisibleRows();
      },
      onFailed: (reason) => {
        if (askedFor === generation) failure.value = reason;
      },
    });
  }

  function holdPages(wanted: PageRange): void {
    const held = heldPages.value;
    // A scroll event that changes nothing for the window must not draw the rows again.
    if (!held || held.first !== wanted.first || held.last !== wanted.last) heldPages.value = wanted;
    const stillHeld = [...pages.value].filter(([pageNumber]) => pageNumber >= wanted.first && pageNumber <= wanted.last);
    if (stillHeld.length < pages.value.size) pages.value = new Map(stillHeld);
    // What did not start is outdated: the user has scrolled on.
    queue.dropWaitingRequests();
    const visible = pagesOfVisibleRows(0) ?? wanted;
    for (const pageNumber of pagesNearestFirst(wanted, visible)) {
      if (!pages.value.has(pageNumber)) askForPage(pageNumber);
    }
  }

  function holdPagesOfVisibleRows(): void {
    const wanted = pagesOfVisibleRows(options.pagesAhead);
    if (wanted) holdPages(wanted);
  }

  function forgetPauseTimer(): void {
    clearTimeout(pauseTimer);
    pauseTimer = undefined;
  }

  return {
    filter,
    totalElements,
    hasLoadedFirstPage,
    failure,
    length,
    isCapped,
    rowsToDraw,
    heldPages,

    /** Starts the list again with a primary filter: other rows, a new timestamp, no old requests. */
    showWith(primaryFilter: TaskPrimaryFilter): void {
      generation++;
      forgetPauseTimer();
      queue.dropWaitingRequests();
      filter.value = primaryFilter;
      pages.value = new Map();
      liveRowsAbove.value = [];
      totalElements.value = 0;
      hasLoadedFirstPage.value = false;
      failure.value = undefined;
      visibleRows.value = { first: 0, last: 0 };
      // The first page is the one that is held until the answer tells how long the list is.
      heldPages.value = { first: 0, last: 0 };
      timestampOfFirstPage = undefined;
      askForPage(0);
    },

    /**
     * Tells which rows the user sees. Rows next to the window load at once, so the user never meets
     * a placeholder when scrolling with the wheel. A jump leaves the window, and then the list waits
     * until the scrolling pauses, so a drag to the end asks only for the pages where it stops.
     */
    showRows(rows: RowRange): void {
      if (rows.first === visibleRows.value.first && rows.last === visibleRows.value.last) return;
      visibleRows.value = rows;
      forgetPauseTimer();
      if (!hasLoadedFirstPage.value) return;
      const wanted = pagesOfVisibleRows(options.pagesAhead);
      if (!wanted) return;
      const held = heldPages.value;
      if (!held || overlap(held, wanted)) holdPages(wanted);
      else pauseTimer = setTimeout(holdPagesOfVisibleRows, options.pauseBeforeLoadingMs);
    },

    /** A live update puts a task above the rows of the server. A capped list may become longer than the limit. */
    addLiveRowAbove(task: UserTask): void {
      liveRowsAbove.value = [task, ...liveRowsAbove.value];
    },

    /** No request starts, no answer is used, and the rows are let go. */
    close(): void {
      generation++;
      forgetPauseTimer();
      queue.close();
      pages.value = new Map();
      liveRowsAbove.value = [];
      heldPages.value = undefined;
    },
  };
}

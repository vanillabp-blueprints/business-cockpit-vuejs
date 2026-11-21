import { computed, ref, shallowRef } from 'vue';
import type { UserTask, UserTasks } from '../generated/official-gui-api/types.gen';
import { rememberTotalOfList } from '../counts/counts';
import { MAX_PAGE_REQUESTS_AT_ONCE } from './list-constants';
import { createPageRequestQueue } from './page-request-queue';
import type { TaskPrimaryFilter } from './primary-filters';
import { loadPageOfTasks } from './task-list-api';
import type { TaskListName } from './task-lists';

/**
 * The rows of one task list with one primary filter. It loads page after page and keeps every
 * page, which is enough for the first rows. The window that drops far pages comes on top of this.
 */
export function useTaskList(list: TaskListName) {
  const queue = createPageRequestQueue<UserTasks>(MAX_PAGE_REQUESTS_AT_ONCE);
  const filter = ref<TaskPrimaryFilter>();
  const pages = shallowRef(new Map<number, UserTask[]>());
  const totalElements = ref(0);
  const totalPages = ref(0);
  const hasLoadedFirstPage = ref(false);
  const failure = ref<unknown>();
  // Every page asks with the timestamp of the first page. Otherwise a task that ends while the
  // user scrolls moves all later rows by one, and the user sees one row twice or none.
  let timestampOfFirstPage: string | undefined;
  // An answer for a filter the user has left meanwhile must not touch the rows of the new one.
  let generation = 0;

  const rows = computed(() =>
    [...pages.value.entries()].sort(([first], [second]) => first - second).flatMap(([, tasks]) => tasks),
  );
  const hasMorePages = computed(() => pages.value.size < totalPages.value);

  function askForPage(pageNumber: number): void {
    const askedFor = generation;
    const askedFilter = filter.value!;
    queue.ask({
      key: `${askedFor}:${pageNumber}`,
      load: () => loadPageOfTasks(list, askedFilter, pageNumber, timestampOfFirstPage),
      onLoaded: (answer) => {
        if (askedFor !== generation) return;
        if (pageNumber === 0) {
          timestampOfFirstPage = answer.serverTimestamp;
          hasLoadedFirstPage.value = true;
          rememberTotalOfList(list, askedFilter, answer.page.totalElements);
        }
        totalElements.value = answer.page.totalElements;
        totalPages.value = answer.page.totalPages;
        pages.value = new Map(pages.value).set(pageNumber, answer.userTasks);
      },
      onFailed: (reason) => {
        if (askedFor === generation) failure.value = reason;
      },
    });
  }

  return {
    filter,
    rows,
    totalElements,
    hasLoadedFirstPage,
    failure,

    /** Starts the list again with a primary filter: other rows, a new timestamp, no old requests. */
    showWith(primaryFilter: TaskPrimaryFilter): void {
      generation++;
      queue.dropWaitingRequests();
      filter.value = primaryFilter;
      pages.value = new Map();
      totalElements.value = 0;
      totalPages.value = 0;
      hasLoadedFirstPage.value = false;
      failure.value = undefined;
      timestampOfFirstPage = undefined;
      askForPage(0);
    },

    /** Asks for the page after the last one that loaded, when there is one and no request is under way. */
    loadNextPage(): void {
      if (!hasLoadedFirstPage.value || !hasMorePages.value || queue.isBusy()) return;
      askForPage(pages.value.size);
    },

    /** No request starts and no answer is used after this. */
    close(): void {
      generation++;
      queue.close();
    },
  };
}

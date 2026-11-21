import { ref } from 'vue';
import { loadPrimaryFilterChoice, primaryFilterChoiceOf } from '../lists/primary-filter-choice';
import { FILTER_COUNTED_ON_MOUSE_OVER, TASK_PRIMARY_FILTERS, type TaskPrimaryFilter } from '../lists/primary-filters';
import { countCasesInProgress, countTasks } from '../lists/task-list-api';
import { TASK_LIST_NAMES, type TaskListName } from '../lists/task-lists';

type CountsOfFilters = Partial<Record<TaskPrimaryFilter, number>>;

/** The counts next to the primary filters of each task list. The count of the closed tasks is not among them. */
export const countsOfFilters = ref<Record<TaskListName, CountsOfFilters>>({ tasks: {}, 'my-tasks': {} });

/** The counts in the header toggle. Each one uses the primary filter its list opens with. */
export const countsOfToggle = ref<{ tasks?: number; 'my-tasks'?: number; cases?: number }>({});

/** The count of the closed tasks, kept only while the mouse is over its button. */
export const countOfClosedTasks = ref<number>();

/** The list that is open, so its own filter counts are asked again with the others. */
const openList = ref<TaskListName>();

const FILTERS_WITH_A_COUNT = TASK_PRIMARY_FILTERS.filter((filter) => filter !== FILTER_COUNTED_ON_MOUSE_OVER);

/**
 * One asking at a time. A second call while the first is under way gets the answer of the first,
 * so an event that comes twice at once asks the server once.
 */
function oneAtATime<Arguments extends unknown[]>(ask: (...parameters: Arguments) => Promise<void>) {
  const running = new Map<string, Promise<void>>();
  return (...parameters: Arguments): Promise<void> => {
    const sameAsking = JSON.stringify(parameters);
    if (!running.has(sameAsking)) {
      running.set(sameAsking, ask(...parameters).finally(() => running.delete(sameAsking)));
    }
    return running.get(sameAsking)!;
  };
}

function remember(list: TaskListName, countsByKey: { key: string; count: number }[]): void {
  const counted = Object.fromEntries(countsByKey.map(({ key, count }) => [key, count])) as CountsOfFilters;
  countsOfFilters.value[list] = { ...countsOfFilters.value[list], ...counted };
}

export const refreshCountsOfToggle = oneAtATime(async (): Promise<void> => {
  const toTheToggle = TASK_LIST_NAMES.map(async (list) => {
    const filter = await loadPrimaryFilterChoice(list);
    const counted = await countTasks(list, [filter]);
    countsOfToggle.value[list] = counted.counts[0]?.count;
  });
  const casesToTheToggle = countCasesInProgress().then((counted) => {
    countsOfToggle.value.cases = counted.counts[0]?.count;
  });
  await Promise.allSettled([...toTheToggle, casesToTheToggle]);
});

export const refreshCountsOfFilters = oneAtATime(async (list: TaskListName): Promise<void> => {
  const counted = await countTasks(list, FILTERS_WITH_A_COUNT).catch(() => undefined);
  if (counted) remember(list, counted.counts);
});

export async function refreshCountOfClosedTasks(list: TaskListName): Promise<void> {
  const counted = await countTasks(list, [FILTER_COUNTED_ON_MOUSE_OVER]).catch(() => undefined);
  countOfClosedTasks.value = counted?.counts[0]?.count;
}

export function forgetCountOfClosedTasks(): void {
  countOfClosedTasks.value = undefined;
}

/** The list asks for its rows itself, and the total of its primary filter comes with the first page. */
export function rememberTotalOfList(list: TaskListName, filter: TaskPrimaryFilter, total: number): void {
  if (filter !== FILTER_COUNTED_ON_MOUSE_OVER) remember(list, [{ key: filter, count: total }]);
  if (primaryFilterChoiceOf(list).value === filter) countsOfToggle.value[list] = total;
}

export function tellWhichListIsOpen(list: TaskListName | undefined): void {
  openList.value = list;
}

/** Asks every count again: when the application opens and when the user comes back to the tab. */
export async function refreshAllCounts(): Promise<void> {
  const list = openList.value;
  await Promise.allSettled([refreshCountsOfToggle(), list ? refreshCountsOfFilters(list) : undefined]);
}

export function refreshCountsWhenTheTabComesBack(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshAllCounts();
  });
}

import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  Count,
  UserTask,
  UserTaskCountsRequest,
  UserTaskRetrieveMode,
  UserTasksRequest,
} from '../../packages/ui/src/generated/official-gui-api/types.gen.ts';
import { readBody, sendJson, sendNothing } from './http.ts';
import type { Simulator } from './state.ts';

/** The three base paths of the cockpit answer the same endpoints. /current-user shows only what is assigned to the user. */
const TASK_LIST_PATH = /^(\/current-user)?\/usertask(\/count)?$/;
const CASE_COUNT_PATH = '/workflow/count';

export function isTaskListPath(pathBelowBase: string): boolean {
  return TASK_LIST_PATH.test(pathBelowBase) || pathBelowBase === CASE_COUNT_PATH;
}

const FAR_FUTURE = '9999-12-31T00:00:00Z';

function isOpenAt(task: UserTask, moment: string): boolean {
  // A task that ended after the list was opened still counts as open, so the pages stay the same.
  return !task.endedAt || task.endedAt > moment;
}

/** The rules of the primary filters, as the GUI API describes them. */
export function matchesMode(task: UserTask, mode: UserTaskRetrieveMode | undefined, initialTimestamp: string): boolean {
  const hasFollowUpInTheFuture = task.followUpDate !== undefined && task.followUpDate > new Date().toISOString();
  switch (mode ?? 'OpenTasksWithFollowUp') {
    case 'All':
      return true;
    case 'OpenTasksWithFollowUp':
      return isOpenAt(task, initialTimestamp);
    case 'OpenTasksWithoutFollowUp':
      return isOpenAt(task, initialTimestamp) && !hasFollowUpInTheFuture;
    case 'OpenTaskOnlyFollowUp':
      return isOpenAt(task, initialTimestamp) && hasFollowUpInTheFuture;
    case 'ClosedTasksOnly':
      return !isOpenAt(task, initialTimestamp);
  }
}

const byDueDateThenCreationThenId = (first: UserTask, second: UserTask) =>
  (first.dueDate ?? FAR_FUTURE).localeCompare(second.dueDate ?? FAR_FUTURE) ||
  first.createdAt.localeCompare(second.createdAt) ||
  first.id.localeCompare(second.id);

// Sorting 30,000 tasks for every page would make the simulator slower than a real backend with an
// index, and a test would then measure the simulator. The sorted order is made once per list of tasks.
const sortedOnce = new WeakMap<UserTask[], UserTask[]>();

function sortedTasksOf(tasks: UserTask[]): UserTask[] {
  if (!sortedOnce.has(tasks)) sortedOnce.set(tasks, [...tasks].sort(byDueDateThenCreationThenId));
  return sortedOnce.get(tasks)!;
}

export async function handleTaskLists(
  simulator: Simulator,
  request: IncomingMessage,
  response: ServerResponse,
  pathBelowBase: string,
  userId: string,
): Promise<boolean> {
  const url = new URL(request.url ?? '/', 'http://simulator');
  // Taken before the first await: the log entry of this request is still the last one.
  const logEntry = simulator.requests.at(-1);
  const body = request.method === 'GET' ? undefined : JSON.parse((await readBody(request)) || '{}');
  if (logEntry) Object.assign(logEntry, { query: url.search, body });

  if (simulator.state.taskListDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, simulator.state.taskListDelayMs));
  }

  if (pathBelowBase === CASE_COUNT_PATH) {
    const filters = (body as { filters: { key: string }[] }).filters;
    sendJson(response, {
      serverTimestamp: new Date().toISOString(),
      counts: filters.map((filter): Count => ({ key: filter.key, count: simulator.state.casesInProgress })),
    });
    return true;
  }

  const [, isOwnList, isCount] = TASK_LIST_PATH.exec(pathBelowBase)!;
  const initialTimestamp = url.searchParams.get('initialTimestamp') ?? new Date().toISOString();
  const visible = sortedTasksOf(simulator.state.tasks).filter((task) => !isOwnList || task.assignee?.id === userId);

  if (request.method !== 'POST') {
    sendNothing(response, 405);
    return true;
  }

  if (isCount) {
    const { filters } = body as UserTaskCountsRequest;
    sendJson(response, {
      serverTimestamp: initialTimestamp,
      counts: filters.map((filter): Count => ({
        key: filter.key,
        count: visible.filter((task) => matchesMode(task, filter.mode, initialTimestamp)).length,
      })),
    });
    return true;
  }

  const { pageNumber = 0, pageSize, mode } = body as UserTasksRequest;
  if (!pageSize || pageSize < 1 || pageNumber < 0) {
    sendJson(response, { message: "The request is not valid: 'pageSize' is missing." }, 400);
    return true;
  }
  const matching = visible.filter((task) => matchesMode(task, mode, initialTimestamp));
  sendJson(response, {
    serverTimestamp: initialTimestamp,
    page: {
      number: pageNumber,
      size: pageSize,
      totalElements: matching.length,
      totalPages: Math.ceil(matching.length / pageSize),
    },
    userTasks: matching.slice(pageNumber * pageSize, (pageNumber + 1) * pageSize),
  });
  return true;
}

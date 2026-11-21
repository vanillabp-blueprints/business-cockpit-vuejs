import { guiApiBasePath } from '../config';
import { OfficialTasklistApi, OfficialWorkflowlistApi } from '../generated/official-gui-api/sdk.gen';
import type { Counts, UserTasks, UserTaskRetrieveMode } from '../generated/official-gui-api/types.gen';
import { PAGE_SIZE } from './list-constants';
import { guiApiBasePathOfList, type TaskListName } from './task-lists';

const tasklist = new OfficialTasklistApi();
const workflowlist = new OfficialWorkflowlistApi();

const baseUrlOf = (list: TaskListName) => ({ baseUrl: guiApiBasePathOfList(list, guiApiBasePath()) });

export function loadPageOfTasks(
  list: TaskListName,
  mode: UserTaskRetrieveMode,
  pageNumber: number,
  initialTimestamp: string | undefined,
): Promise<UserTasks> {
  // The primary filter is always sent, so the list never depends on the default of the server.
  return tasklist.getUserTasks(
    { initialTimestamp, userTasksRequest: { pageNumber, pageSize: PAGE_SIZE, mode } },
    baseUrlOf(list),
  );
}

/** One request counts all the filters. Each count answers with the key of its filter. */
export function countTasks(list: TaskListName, modes: UserTaskRetrieveMode[]): Promise<Counts> {
  const filters = modes.map((mode) => ({ key: mode, mode }));
  return tasklist.countUserTasks({ userTaskCountsRequest: { filters } }, baseUrlOf(list));
}

export function countCasesInProgress(): Promise<Counts> {
  return workflowlist.countWorkflows({
    workflowCountsRequest: { filters: [{ key: 'InProgress', mode: 'InProgress' }] },
  });
}

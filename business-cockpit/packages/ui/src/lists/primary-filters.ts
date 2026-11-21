import type { UserTaskRetrieveMode } from '../generated/official-gui-api/types.gen';

/** The primary filters the task list offers, in the order of the status line. */
export const TASK_PRIMARY_FILTERS = [
  'OpenTasksWithoutFollowUp',
  'OpenTasksWithFollowUp',
  'OpenTaskOnlyFollowUp',
  'ClosedTasksOnly',
] as const satisfies readonly UserTaskRetrieveMode[];

export type TaskPrimaryFilter = (typeof TASK_PRIMARY_FILTERS)[number];

export const DEFAULT_TASK_PRIMARY_FILTER: TaskPrimaryFilter = 'OpenTasksWithoutFollowUp';

/**
 * The count of this filter would grow without end and is rarely needed. So it is asked only when
 * the mouse is over its button.
 */
export const FILTER_COUNTED_ON_MOUSE_OVER: TaskPrimaryFilter = 'ClosedTasksOnly';

export function isTaskPrimaryFilter(candidate: unknown): candidate is TaskPrimaryFilter {
  return TASK_PRIMARY_FILTERS.includes(candidate as TaskPrimaryFilter);
}

export const CASE_PRIMARY_FILTER_OF_TOGGLE = 'InProgress';

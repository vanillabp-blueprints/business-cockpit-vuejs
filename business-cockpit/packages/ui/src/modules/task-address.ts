import { UI_URI_TYPE_ES_MODULES, UI_URI_TYPE_EXTERNAL, type UserTask } from '@example/bc-module-kit';

type TaskAddressFields = Pick<UserTask, 'workflowModuleId' | 'uiUri'>;

const IS_WHOLE_ADDRESS = /^https?:\/\//;

/**
 * The address of a user task. A `uiUri` that starts with http:// or https:// is a whole address and
 * stays as it is. Any other `uiUri` is a path of the module, below /wm/<workflowModuleId>/. The type of
 * the task never changes the address, only what is done with it.
 */
export function addressOfTask(task: TaskAddressFields): string {
  if (IS_WHOLE_ADDRESS.test(task.uiUri)) return task.uiUri;
  return `/wm/${encodeURIComponent(task.workflowModuleId)}/${task.uiUri.replace(/^\/+/, '')}`;
}

/** What the cockpit does with a task, decided by its `uiUriType` and never by the form of its address. */
export type WayToOpen = 'in-cockpit' | 'own-tab' | 'unknown';

export function wayToOpen(task: Pick<UserTask, 'uiUriType'>): WayToOpen {
  if (task.uiUriType === UI_URI_TYPE_ES_MODULES) return 'in-cockpit';
  if (task.uiUriType === UI_URI_TYPE_EXTERNAL) return 'own-tab';
  return 'unknown';
}

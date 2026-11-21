/** The two task lists the cockpit offers. Each one is answered by a controller of the backend with its own visibility. */
export type TaskListName = 'tasks' | 'my-tasks';

export const TASK_LIST_NAMES: readonly TaskListName[] = ['tasks', 'my-tasks'];

/** What each list adds to the base path of the GUI API. `/my-tasks` shows only what is assigned to the user. */
const PATH_BELOW_GUI_API_BASE: Record<TaskListName, string> = {
  tasks: '',
  'my-tasks': '/current-user',
};

export function guiApiBasePathOfList(list: TaskListName, guiApiBasePath: string): string {
  return guiApiBasePath + PATH_BELOW_GUI_API_BASE[list];
}

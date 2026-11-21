/**
 * The screens and their paths, one path per language. The path of every language opens its screen
 * in every language of the user interface.
 */
export type ScreenName = 'tasks' | 'my-tasks' | 'task' | 'workflows';

export const PATHS_OF_SCREENS: Record<ScreenName, Record<string, string>> = {
  tasks: { de: '/aufgaben', en: '/tasks', fr: '/taches' },
  'my-tasks': { de: '/meine-aufgaben', en: '/my-tasks', fr: '/mes-taches' },
  task: { de: '/aufgaben/:id', en: '/tasks/:id', fr: '/taches/:id' },
  workflows: { de: '/faelle', en: '/workflows', fr: '/dossiers' },
};

/** The path of a screen in the language of the viewer. A language without its own path takes the English one. */
export function pathOfScreen(screen: ScreenName, language: string): string {
  return PATHS_OF_SCREENS[screen][language] ?? PATHS_OF_SCREENS[screen].en;
}

/** The address of one user task, in the language of the viewer. */
export function pathOfTask(taskId: string, language: string): string {
  return pathOfScreen('task', language).replace(':id', encodeURIComponent(taskId));
}

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useTexts } from '../i18n/texts';
import { PATHS_OF_SCREENS, pathOfScreen, type ScreenName } from './screens';

const { language } = useTexts();

/** One record for a screen. The paths of the other languages are aliases of its first path. */
function routeOfScreen(screen: ScreenName, component: RouteRecordRaw['component'], props?: RouteRecordRaw['props']): RouteRecordRaw {
  const [path, ...otherPaths] = Object.values(PATHS_OF_SCREENS[screen]);
  return { name: screen, path, alias: otherPaths, component, props } as RouteRecordRaw;
}

const nothingYet = { render: () => null };

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // The start page is the list of the user's tasks until the dashboard exists.
    { path: '/', redirect: () => pathOfScreen('tasks', language.value) },
    routeOfScreen('tasks', () => import('../components/TaskListPage.vue'), { list: 'tasks' }),
    routeOfScreen('my-tasks', () => import('../components/TaskListPage.vue'), { list: 'my-tasks' }),
    routeOfScreen('task', nothingYet),
    routeOfScreen('workflows', nothingYet),
  ],
});

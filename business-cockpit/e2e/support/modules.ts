import type { Page } from '@playwright/test';
import type { UserTask } from '../../packages/ui/src/generated/official-gui-api/types.gen.ts';
import { aTask } from './tasks.ts';
import type { SimulatorControl } from './test.ts';

/** The three built test modules, as GET /workflow-module lists them. */
export const TEST_MODULES = [
  { id: 'react-module', version: 1, uri: '/wm/react-module' },
  { id: 'vue-module', version: 1, uri: '/wm/vue-module' },
  { id: 'angular-module', version: 1, uri: '/wm/angular-module' },
];

/** A user task of a test module: a form with the areas body, information and actions. */
export const reactTask = (overrides: Partial<UserTask> = {}) =>
  aTask({ workflowModuleId: 'react-module', bpmnProcessId: 'react-order', taskDefinition: 'assessRisk', uiUri: '/bc-manifest.json', businessId: 'R-1', ...overrides });
export const vueTask = (overrides: Partial<UserTask> = {}) =>
  aTask({ workflowModuleId: 'vue-module', bpmnProcessId: 'vue-loan', taskDefinition: 'review', uiUri: '/bc-manifest.json', businessId: 'V-1', ...overrides });
export const angularTask = (overrides: Partial<UserTask> = {}) =>
  aTask({ workflowModuleId: 'angular-module', bpmnProcessId: 'angular-claim', taskDefinition: 'check', uiUri: '/bc-manifest.json', businessId: 'A-1', ...overrides });

export async function registerTestModules(simulator: SimulatorControl): Promise<void> {
  await simulator.change({ workflowModules: TEST_MODULES });
}

/**
 * Lets a test move the clock of the page forward. The loader reads a manifest again after a minute, and
 * no test waits that long.
 */
export async function makeClockSkewable(page: Page): Promise<(milliseconds: number) => Promise<void>> {
  await page.addInitScript(() => {
    const realNow = Date.now.bind(Date);
    const skew = { milliseconds: 0 };
    Object.assign(window, { __clockSkew: skew });
    Date.now = () => realNow() + skew.milliseconds;
  });
  return (milliseconds) =>
    page.evaluate((skewed) => {
      (window as unknown as { __clockSkew: { milliseconds: number } }).__clockSkew.milliseconds += skewed;
    }, milliseconds);
}

/** Collects what the page writes to the console, so a test sees what the author of a module would see. */
export function collectConsole(page: Page): string[] {
  const lines: string[] = [];
  page.on('console', (message) => lines.push(`${message.type()}: ${message.text()}`));
  return lines;
}

/** The paths of the requests so far below /wm/<moduleId>/. */
export async function moduleRequests(simulator: SimulatorControl, moduleId: string): Promise<string[]> {
  const prefix = `/wm/${moduleId}/`;
  return (await simulator.requests()).map((entry) => entry.path).filter((path) => path.startsWith(prefix)).map((path) => path.slice(prefix.length));
}

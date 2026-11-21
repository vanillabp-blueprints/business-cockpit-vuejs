import type { Page } from '@playwright/test';
import type { SimulatedFile } from '../simulator/state.ts';
import { aTask } from './tasks.ts';
import { fakeModule, namesOf, type FakeModuleSpec } from './fake-module.ts';
import { logInAs, type SimulatorControl } from './test.ts';

export const FAKE_MODULE_ID = 'fake';
export const FAKE_PROCESS = 'p';

/** A user task of the fake module; its form is the one `simpleSpec` names. */
export const fakeTask = (id: string, overrides = {}) =>
  aTask({ id, workflowModuleId: FAKE_MODULE_ID, bpmnProcessId: FAKE_PROCESS, taskDefinition: 'form', uiUri: '/bc-manifest.json', ...overrides });

/** A fake module with one form that has the area body, and the names of its parts. */
export function simpleSpec(buildId = 'b1', moduleId = FAKE_MODULE_ID) {
  const names = namesOf(moduleId, buildId);
  const body = names.userTask(FAKE_PROCESS, 'form', 'body');
  const spec: FakeModuleSpec = {
    buildId,
    forms: { form: { entry: 'Form', element: { body } } },
    visualEntries: { Form: { defines: [body] } },
  };
  return { names, body, spec };
}

/** Makes a file of a fake module answer after a delay. */
export function slowed(files: Record<string, SimulatedFile>, fileName: string, delayMs: number): void {
  const file = files[fileName];
  files[fileName] = { body: typeof file === 'string' ? file : file.body, delayMs };
}

export async function serveFakeModule(simulator: SimulatorControl, files: Record<string, SimulatedFile>, moduleId = FAKE_MODULE_ID): Promise<void> {
  await simulator.change({ fakeModules: { [moduleId]: files } });
}

export async function showFakeTask(page: Page, simulator: SimulatorControl, files: Record<string, SimulatedFile> = fakeModule(FAKE_MODULE_ID, simpleSpec().spec)): Promise<void> {
  await simulator.change({ tasks: [fakeTask('t1')], fakeModules: { [FAKE_MODULE_ID]: files } });
  await logInAs(page, 'clerk', '/aufgaben/t1');
}

export const formOf = (page: Page) => page.getByTestId('module-form');
export const loadingStep = (page: Page, step: string) => page.locator(`[data-testid=task-page-loading][data-step=${step}]`);
export const errorNote = (page: Page, kind: string) => page.locator(`[data-testid=task-page-error][data-error=${kind}]`);

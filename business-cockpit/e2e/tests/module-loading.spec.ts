import type { Page } from '@playwright/test';
import { expect, logInAs, test } from '../support/test.ts';
import { collectConsole, makeClockSkewable, moduleRequests, registerTestModules, vueTask } from '../support/modules.ts';
import { fakeModule, FAKE_ELEMENT_THAT_THROWS } from '../support/fake-module.ts';
import { aTask } from '../support/tasks.ts';
import {
  errorNote,
  FAKE_MODULE_ID,
  FAKE_PROCESS,
  fakeTask,
  formOf,
  loadingStep,
  serveFakeModule,
  showFakeTask,
  simpleSpec,
  slowed,
} from '../support/fake-task.ts';

const manifestReads = async (simulator: Parameters<typeof moduleRequests>[0]) => (await moduleRequests(simulator, FAKE_MODULE_ID)).filter((path) => path === 'bc-manifest.json').length;

test.describe('loading the parts of a module for the page of a task', () => {
  test('TF-025 the page shows a loading state of its own for the task, the data entry and the visual entry', async ({ page, simulator }) => {
    const { spec } = simpleSpec();
    const files = fakeModule(FAKE_MODULE_ID, spec);
    slowed(files, 'user-task-form-b1.js', 700);
    slowed(files, 'Form-b1.js', 700);
    await simulator.change({ userTaskDelayMs: 700 });
    await showFakeTask(page, simulator, files);
    await expect(loadingStep(page, 'task')).toBeVisible();
    await expect(loadingStep(page, 'ask')).toBeVisible();
    await expect(loadingStep(page, 'load')).toBeVisible();
    await expect(formOf(page)).toBeVisible();
    await expect(page.getByTestId('task-page-loading')).toHaveCount(0);
  });

  test('TF-026 a task that fails to load shows a note with a retry', async ({ page, simulator }) => {
    await simulator.change({ userTaskFailures: 1 });
    await showFakeTask(page, simulator);
    await expect(errorNote(page, 'task')).toBeVisible();
    await page.getByTestId('task-page-retry').click();
    await expect(formOf(page)).toBeVisible();
  });

  test('TF-026 a module without a form for the task says so, and names the module', async ({ page, simulator }) => {
    await showFakeTask(page, simulator, fakeModule(FAKE_MODULE_ID, { forms: {} }));
    await expect(errorNote(page, 'no-form')).toContainText(FAKE_MODULE_ID);
    await expect(page.getByTestId('task-page-retry')).toHaveCount(0);
  });

  test('TF-026 a data entry that fails to load shows a note with a retry, and the retry shows the form', async ({ page, simulator }) => {
    const { spec } = simpleSpec();
    const files = fakeModule(FAKE_MODULE_ID, spec);
    files['user-task-form-b1.js'] = { status: 500 };
    await showFakeTask(page, simulator, files);
    await expect(errorNote(page, 'data-entry')).toContainText('UserTaskForm');
    await serveFakeModule(simulator, fakeModule(FAKE_MODULE_ID, spec));
    await page.getByTestId('task-page-retry').click();
    await expect(formOf(page)).toBeVisible();
  });

  test('TF-026 a visual entry that fails to load shows a note with a retry, and the retry shows the form', async ({ page, simulator }) => {
    const { spec } = simpleSpec();
    const files = fakeModule(FAKE_MODULE_ID, spec);
    files['Form-b1.js'] = { status: 500 };
    await showFakeTask(page, simulator, files);
    await expect(errorNote(page, 'visual-entry')).toContainText('Form');
    await serveFakeModule(simulator, fakeModule(FAKE_MODULE_ID, spec));
    await page.getByTestId('task-page-retry').click();
    await expect(formOf(page)).toBeVisible();
  });

  test('TF-026 EXT-036 EXT-037 a web component that is not defined in time shows a note that names the module, the entry and the web component, and the console says the same', async ({ page, simulator }) => {
    const { spec, body } = simpleSpec();
    const lines = collectConsole(page);
    await page.clock.install();
    await showFakeTask(page, simulator, fakeModule(FAKE_MODULE_ID, { ...spec, visualEntries: { Form: { defines: ['fake-b1-another-element'] } } }));
    await expect(loadingStep(page, 'load')).toBeVisible();
    await page.clock.fastForward(11_000);
    const note = errorNote(page, 'not-defined');
    await expect(note).toBeVisible();
    for (const name of [FAKE_MODULE_ID, 'Form', body]) await expect(note).toContainText(name);
    expect(lines.some((line) => line.startsWith('error:') && line.includes(FAKE_MODULE_ID) && line.includes('Form') && line.includes(body))).toBe(true);
  });

  test('EXT-037 a function that answers undefined is no error and a web component that cannot be created shows a note that names the module and the web component', async ({ page, simulator }) => {
    const { spec, body } = simpleSpec();
    const files = fakeModule(FAKE_MODULE_ID, spec);
    files['Form-b1.js'] = FAKE_ELEMENT_THAT_THROWS(body);
    await showFakeTask(page, simulator, files);
    const note = errorNote(page, 'draw');
    await expect(note).toBeVisible();
    await expect(note).toContainText(FAKE_MODULE_ID);
    await expect(note).toContainText(body);
  });

  test('EXT-016 the registry is read once at the start and a module that registered later is asked for once', async ({ page, simulator }) => {
    await registerTestModules(simulator);
    const { spec } = simpleSpec();
    await simulator.change({ tasks: [vueTask({ id: 'v1' }), vueTask({ id: 'v2' }), fakeTask('f1'), fakeTask('f2')], fakeModules: { [FAKE_MODULE_ID]: fakeModule(FAKE_MODULE_ID, spec) } });
    await logInAs(page, 'clerk', '/tasks');
    for (const id of ['v1', 'v2', 'f1', 'f2']) {
      await page.locator(`[data-testid=task-row][data-task-id=${id}]`).getByTestId('task-title').click();
      await expect(page.getByTestId('module-form').first()).toBeVisible();
      await page.goBack();
    }
    const guiRequests = (await simulator.guiApiRequests()).map((entry) => entry.path);
    expect(guiRequests.filter((path) => path === '/gui/api/v1/workflow-module')).toHaveLength(1);
    expect(guiRequests.filter((path) => path === `/gui/api/v1/workflow-module/${FAKE_MODULE_ID}`)).toHaveLength(1);
  });

  test('EXT-026 a task of the ES module type loads its parts through the loader, whatever the form of its address', async ({ page, simulator }) => {
    const { spec } = simpleSpec();
    const uiUris = ['/bc-manifest.json', 'bc-manifest.json', 'https://elsewhere.example/bc-manifest.json', 'http://elsewhere.example/other.json'];
    await simulator.change({
      tasks: uiUris.map((uiUri, index) => fakeTask(`address-${index}`, { uiUri })),
      fakeModules: { [FAKE_MODULE_ID]: fakeModule(FAKE_MODULE_ID, spec) },
    });
    await logInAs(page, 'clerk', '/tasks');
    for (const index of uiUris.keys()) {
      await page.locator(`[data-testid=task-row][data-task-id=address-${index}]`).getByTestId('task-title').click();
      await expect(formOf(page)).toBeVisible();
      await page.goBack();
    }
    expect((await simulator.requests()).filter((entry) => entry.path.includes('elsewhere'))).toEqual([]);
  });

  test('EXT-033 a retry reads the manifest and imports the entry again, and when it fails again the note offers to reload the page', async ({ page, simulator }) => {
    const { spec } = simpleSpec();
    const files = fakeModule(FAKE_MODULE_ID, spec);
    files['user-task-form-b1.js'] = { status: 500 };
    await showFakeTask(page, simulator, files);
    await expect(errorNote(page, 'data-entry')).toBeVisible();
    await expect(page.getByTestId('task-page-reload')).toHaveCount(0);
    expect(await manifestReads(simulator)).toBe(1);
    await page.getByTestId('task-page-retry').click();
    await expect(page.getByTestId('task-page-reload')).toBeVisible();
    expect(await manifestReads(simulator)).toBe(2);
    expect((await moduleRequests(simulator, FAKE_MODULE_ID)).filter((path) => path === 'user-task-form-b1.js')).toHaveLength(2);
    await serveFakeModule(simulator, fakeModule(FAKE_MODULE_ID, spec));
    await Promise.all([page.waitForEvent('load'), page.getByTestId('task-page-reload').click()]);
    await expect(formOf(page)).toBeVisible();
  });

  test('EXT-035 the visual entry is loaded only when its web component is about to be shown', async ({ page, simulator }) => {
    const names = simpleSpec().names;
    const first = names.userTask(FAKE_PROCESS, 'first', 'body');
    const second = names.userTask(FAKE_PROCESS, 'second', 'body');
    await simulator.change({
      tasks: [fakeTask('first', { taskDefinition: 'first' }), fakeTask('second', { taskDefinition: 'second' })],
      fakeModules: {
        [FAKE_MODULE_ID]: fakeModule(FAKE_MODULE_ID, {
          forms: { first: { entry: 'FirstForm', element: { body: first } }, second: { entry: 'SecondForm', element: { body: second } } },
          visualEntries: { FirstForm: { defines: [first] }, SecondForm: { defines: [second] } },
        }),
      },
    });
    await logInAs(page, 'clerk', '/tasks');
    await page.locator('[data-testid=task-row][data-task-id=first]').getByTestId('task-title').click();
    await expect(formOf(page)).toHaveAttribute('data-element', first);
    const loadedForFirst = await moduleRequests(simulator, FAKE_MODULE_ID);
    expect(loadedForFirst).toContain('FirstForm-b1.js');
    expect(loadedForFirst).not.toContain('SecondForm-b1.js');
    await page.goBack();
    await page.locator('[data-testid=task-row][data-task-id=second]').getByTestId('task-title').click();
    await expect(formOf(page)).toHaveAttribute('data-element', second);
    expect(await moduleRequests(simulator, FAKE_MODULE_ID)).toContain('SecondForm-b1.js');
  });

  test('EXT-044 a name that breaks a rule is refused with a note, nothing is loaded for it and the console says the same', async ({ page, simulator }) => {
    const lines = collectConsole(page);
    const wrongNames: Record<string, string> = {
      'no valid name of a custom element': 'Fake-B1-Body',
      'a name without a hyphen': 'fakebody',
      'another prefix than the module': 'other-b1-p--form--body',
      'the longer prefix of another module': 'fake-ride-b1-p--form--body',
    };
    await simulator.change({
      workflowModules: [
        { id: FAKE_MODULE_ID, version: 1, uri: `/wm/${FAKE_MODULE_ID}` },
        { id: 'fake-ride', version: 1, uri: '/wm/fake-ride' },
      ],
      tasks: [fakeTask('t1')],
    });
    for (const [index, [rule, name]] of Object.entries(wrongNames).entries()) {
      // The files of a build never change, so the browser keeps them. Each try is a build of its own.
      await simulator.change({
        fakeModules: {
          [FAKE_MODULE_ID]: fakeModule(FAKE_MODULE_ID, {
            buildId: `try${index}`,
            forms: { form: { entry: 'Form', element: { body: name } } },
            visualEntries: { Form: { defines: [name.toLowerCase()] } },
          }),
        },
      });
      await openFreshly(page, '/aufgaben/t1');
      const note = errorNote(page, 'wrong-name');
      await expect(note, rule).toBeVisible();
      for (const text of [FAKE_MODULE_ID, name, 'fake-']) await expect(note, rule).toContainText(text);
      expect(lines.some((line) => line.startsWith('error:') && line.includes(name) && line.includes('fake-')), rule).toBe(true);
    }
    expect((await moduleRequests(simulator, FAKE_MODULE_ID)).filter((path) => path.startsWith('Form-'))).toEqual([]);
  });

  test('EXT-046 a part whose web components are defined already is drawn at once, without loading, waiting or a loading state', async ({ page, simulator }) => {
    const { spec } = simpleSpec();
    await page.addInitScript(() => {
      const seen: string[] = [];
      Object.assign(window, { stepsSeen: seen });
      new MutationObserver(() => {
        const step = document.querySelector('[data-testid=task-page-loading]')?.getAttribute('data-step');
        if (step) seen.push(step);
      }).observe(document, { childList: true, subtree: true, attributes: true });
    });
    await simulator.change({ tasks: [fakeTask('one'), fakeTask('two')], fakeModules: { [FAKE_MODULE_ID]: fakeModule(FAKE_MODULE_ID, spec) } });
    await logInAs(page, 'clerk', '/tasks');
    await page.locator('[data-testid=task-row][data-task-id=one]').getByTestId('task-title').click();
    await expect(formOf(page)).toBeVisible();
    await page.goBack();
    const requestsBefore = (await moduleRequests(simulator, FAKE_MODULE_ID)).length;
    await page.evaluate(() => ((window as unknown as { stepsSeen: string[] }).stepsSeen.length = 0));
    await page.locator('[data-testid=task-row][data-task-id=two]').getByTestId('task-title').click();
    await expect(formOf(page)).toBeVisible();
    expect((await moduleRequests(simulator, FAKE_MODULE_ID)).length).toBe(requestsBefore);
    const stepsSeen = await page.evaluate(() => (window as unknown as { stepsSeen: string[] }).stepsSeen);
    expect(stepsSeen).not.toContain('load');
  });

  test('EXT-047 the manifest is read again only after a minute, and then with no-cache; a failed read keeps the manifest it has', async ({ page, simulator }) => {
    const { spec } = simpleSpec();
    const moveClock = await makeClockSkewable(page);
    const manifestRequests: Record<string, string>[] = [];
    const manifestStatuses: number[] = [];
    page.on('request', async (request) => {
      // The headers the browser adds itself, such as the condition of its cache, come with allHeaders only.
      if (request.url().endsWith('/wm/fake/bc-manifest.json')) manifestRequests.push(await request.allHeaders());
    });
    page.on('response', (response) => {
      if (response.url().endsWith('/wm/fake/bc-manifest.json')) manifestStatuses.push(response.status());
    });
    await simulator.change({ tasks: [fakeTask('one'), fakeTask('two'), fakeTask('three')], fakeModules: { [FAKE_MODULE_ID]: fakeModule(FAKE_MODULE_ID, spec) } });
    await logInAs(page, 'clerk', '/tasks');
    const open = async (id: string) => {
      await page.locator(`[data-testid=task-row][data-task-id=${id}]`).getByTestId('task-title').click();
      await expect(formOf(page)).toBeVisible();
      await page.goBack();
    };
    await open('one');
    expect(manifestRequests).toHaveLength(1);
    await moveClock(30_000);
    await open('two');
    expect(manifestRequests).toHaveLength(1);

    await moveClock(40_000);
    await open('three');
    expect(manifestRequests).toHaveLength(2);
    // The browser asks the module whether the file changed and gets 304, instead of taking the file from its cache.
    expect(manifestRequests[1]['cache-control']).toMatch(/no-cache|max-age=0/);
    expect(manifestRequests[1]['if-none-match']).toBeTruthy();
    expect(manifestStatuses).toEqual([200, 304]);

    await moveClock(61_000);
    await simulator.change({ fakeModules: { [FAKE_MODULE_ID]: { ...fakeModule(FAKE_MODULE_ID, spec), 'bc-manifest.json': { status: 500 } } } });
    await open('one');
    expect(manifestRequests).toHaveLength(3);
  });

  test('EXT-048 after a new build with new names the next part comes from the new build without a reload, and the page on the screen stays', async ({ page, simulator }) => {
    const moveClock = await makeClockSkewable(page);
    const firstBuild = simpleSpec('b1');
    const secondBuild = simpleSpec('b2');
    await simulator.change({ tasks: [fakeTask('one'), fakeTask('two')], fakeModules: { [FAKE_MODULE_ID]: fakeModule(FAKE_MODULE_ID, firstBuild.spec) } });
    await logInAs(page, 'clerk', '/tasks');
    await page.locator('[data-testid=task-row][data-task-id=one]').getByTestId('task-title').click();
    await expect(formOf(page)).toHaveAttribute('data-element', firstBuild.body);
    await page.evaluate(() => ((window as unknown as { keptByNoReload: boolean }).keptByNoReload = true));

    await serveFakeModule(simulator, fakeModule(FAKE_MODULE_ID, secondBuild.spec));
    await moveClock(61_000);
    // Nothing asks a part, so the page on the screen keeps its web component.
    await expect(formOf(page)).toHaveAttribute('data-element', firstBuild.body);
    await page.goBack();
    await page.locator('[data-testid=task-row][data-task-id=two]').getByTestId('task-title').click();
    await expect(formOf(page)).toHaveAttribute('data-element', secondBuild.body);
    expect(await page.evaluate(() => (window as unknown as { keptByNoReload?: boolean }).keptByNoReload)).toBe(true);
  });

  test('EXT-049 a new build that answers with a name an earlier build defined is not loaded, and the page offers a reload', async ({ page, simulator }) => {
    const lines = collectConsole(page);
    const moveClock = await makeClockSkewable(page);
    const sameNames = simpleSpec('b1');
    await simulator.change({ tasks: [fakeTask('one'), fakeTask('two')], fakeModules: { [FAKE_MODULE_ID]: fakeModule(FAKE_MODULE_ID, sameNames.spec) } });
    await logInAs(page, 'clerk', '/tasks');
    await page.locator('[data-testid=task-row][data-task-id=one]').getByTestId('task-title').click();
    await expect(formOf(page)).toBeVisible();
    await page.goBack();
    // The new build names the same web component, because it builds its names without the build id.
    await serveFakeModule(simulator, fakeModule(FAKE_MODULE_ID, { ...sameNames.spec, buildId: 'b2', visualEntries: { Form: { defines: [sameNames.body] } } }));
    await moveClock(61_000);
    await page.locator('[data-testid=task-row][data-task-id=two]').getByTestId('task-title').click();
    await expect(errorNote(page, 'updated')).toContainText(FAKE_MODULE_ID);
    await expect(page.getByTestId('task-page-reload')).toBeVisible();
    expect(await moduleRequests(simulator, FAKE_MODULE_ID)).not.toContain('Form-b2.js');
    expect(lines.some((line) => line.includes(FAKE_MODULE_ID) && line.includes(sameNames.body))).toBe(true);
    await Promise.all([page.waitForEvent('load'), page.getByTestId('task-page-reload').click()]);
    await expect(formOf(page)).toBeVisible();
  });

  test('EXT-050 the loader refuses a manifest that breaks a rule and names the module, and it accepts unknown fields and ?v= at the end of a file', async ({ page, simulator }) => {
    const { spec } = simpleSpec();
    const refused: Record<string, Record<string, unknown>> = {
      'a manifestVersion it does not know': { manifestVersion: 2 },
      'a whole address': { entries: { UserTaskForm: 'https://elsewhere.example/form.js', Form: 'Form-b1.js' } },
      'a file that starts with a slash': { entries: { UserTaskForm: '/user-task-form-b1.js', Form: 'Form-b1.js' } },
      'a file with two dots': { entries: { UserTaskForm: '../user-task-form-b1.js', Form: 'Form-b1.js' } },
    };
    await simulator.change({ tasks: [fakeTask('t1')] });
    for (const [rule, manifest] of Object.entries(refused)) {
      await simulator.change({ fakeModules: { [FAKE_MODULE_ID]: fakeModule(FAKE_MODULE_ID, { ...spec, manifest }) } });
      await openFreshly(page, '/aufgaben/t1');
      await expect(errorNote(page, 'manifest'), rule).toContainText(FAKE_MODULE_ID);
    }
    const files = fakeModule(FAKE_MODULE_ID, { ...spec, manifest: { somethingNew: { a: 1 } } });
    const manifest = JSON.parse(files['bc-manifest.json'] as string);
    manifest.entries.UserTaskForm = `${manifest.entries.UserTaskForm}?v=3#top`;
    files['bc-manifest.json'] = JSON.stringify(manifest);
    await simulator.change({ fakeModules: { [FAKE_MODULE_ID]: files } });
    await page.goto('/aufgaben/t1');
    await expect(formOf(page)).toBeVisible();
  });

  test('EXT-051 a module that does not answer does not stop the others, and a module without a manifest is not asked again', async ({ page, simulator }) => {
    const { spec } = simpleSpec();
    await registerWorkingAndBrokenModules(simulator, spec);
    await logInAs(page, 'clerk', '/tasks');
    await page.locator('[data-testid=task-row][data-task-id=broken]').getByTestId('task-title').click();
    await expect(errorNote(page, 'data-entry')).toBeVisible();
    await page.goBack();
    await page.locator('[data-testid=task-row][data-task-id=working]').getByTestId('task-title').click();
    await expect(formOf(page)).toBeVisible();
    await page.goBack();
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.locator('[data-testid=task-row][data-task-id=missing]').getByTestId('task-title').click();
      await expect(errorNote(page, 'no-form')).toContainText('missing');
      await page.goBack();
    }
    expect((await moduleRequests(simulator, 'missing')).filter((path) => path === 'bc-manifest.json')).toHaveLength(1);
  });

  test('EXT-052 a module whose data entry lacks the function EXPORT_NAMES names is loaded and shows nothing, and the console names the module', async ({ page, simulator }) => {
    const { spec } = simpleSpec();
    const lines = collectConsole(page);
    await showFakeTask(page, simulator, fakeModule(FAKE_MODULE_ID, { ...spec, userTaskFormExport: 'someOtherName' }));
    await expect(errorNote(page, 'no-form')).toBeVisible();
    expect(lines.some((line) => line.includes(FAKE_MODULE_ID) && line.includes('userTaskForm'))).toBe(true);
  });

  test('EXT-053 two modules with the same prefix make the cockpit write a warning to the console', async ({ page, simulator }) => {
    const lines = collectConsole(page);
    await simulator.change({
      workflowModules: [
        { id: 'TaxiRide', version: 1, uri: '/wm/TaxiRide' },
        { id: 'taxi-ride', version: 1, uri: '/wm/taxi-ride' },
      ],
    });
    await logInAs(page, 'clerk', '/tasks');
    await expect.poll(() => lines.some((line) => line.startsWith('warning:') && line.includes('TaxiRide') && line.includes('taxi-ride') && line.includes('same prefix'))).toBe(true);
  });
});

/** Opens an address as a new page load, with a login when there is none yet, so no earlier page is mistaken for it. */
async function openFreshly(page: Page, address: string): Promise<void> {
  await page.goto('about:blank');
  await page.goto(address);
  const login = page.getByRole('button', { name: 'clerk', exact: true });
  await login.or(page.getByTestId('user-name')).first().waitFor();
  if (await login.isVisible()) await login.click();
}

async function registerWorkingAndBrokenModules(simulator: Parameters<typeof moduleRequests>[0], workingSpec: ReturnType<typeof simpleSpec>['spec']): Promise<void> {
  const brokenFiles = fakeModule('broken', {});
  brokenFiles['bc-manifest.json'] = { status: 500 };
  await simulator.change({
    tasks: [
      fakeTask('working'),
      aTask({ id: 'broken', workflowModuleId: 'broken', uiUri: '/bc-manifest.json', bpmnProcessId: FAKE_PROCESS, taskDefinition: 'form' }),
      aTask({ id: 'missing', workflowModuleId: 'missing', uiUri: '/bc-manifest.json', bpmnProcessId: FAKE_PROCESS, taskDefinition: 'form' }),
    ],
    fakeModules: { [FAKE_MODULE_ID]: fakeModule(FAKE_MODULE_ID, workingSpec), broken: brokenFiles, missing: {} },
  });
}

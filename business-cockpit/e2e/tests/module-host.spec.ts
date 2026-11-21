import { EXPORT_NAMES, AREA_ACTIONS, AREA_ALL, AREA_BODY, AREA_INFORMATION } from '@example/bc-module-kit';
import { findFrameworkCode } from '@example/bc-module-kit/check';
import { openHostHarness } from '../support/host-harness.ts';
import { angularTask, reactTask, TEST_MODULES, vueTask } from '../support/modules.ts';
import { fakeModule } from '../support/fake-module.ts';
import { FAKE_MODULE_ID, fakeTask, simpleSpec } from '../support/fake-task.ts';
import { expect, test } from '../support/test.ts';

test.describe('a test of a module loads its parts with the module host', () => {
  test('PKG-050 the host asks the entries of the interview and draws the areas of the interview, or all', async ({ page, simulator }) => {
    await simulator.change({ workflowModules: TEST_MODULES });
    await openHostHarness(page);
    const drawn = await page.evaluate(
      async ([laidOut, whole]) => {
        const host = window.harness.createModuleHost({ modules: [{ id: 'react-module' }] });
        const container = document.body.appendChild(document.createElement('div'));
        const laidOutPart = await host.showUserTask('react-module', laidOut, container, { language: 'en' });
        const wholePart = await host.showUserTask('react-module', whole, container, { language: 'en' });
        return {
          areas: [...host.areas],
          entries: [...host.entries],
          laidOutAreas: [...(laidOutPart?.elements.keys() ?? [])],
          wholeAreas: [...(wholePart?.elements.keys() ?? [])],
        };
      },
      [reactTask({ id: 'a' }), reactTask({ id: 'b', taskDefinition: 'confirm' })] as const,
    );
    expect(drawn.areas).toEqual([AREA_BODY, AREA_INFORMATION, AREA_ACTIONS]);
    expect(drawn.entries).toEqual(Object.keys(EXPORT_NAMES));
    expect(drawn.laidOutAreas).toEqual([AREA_BODY, AREA_INFORMATION, AREA_ACTIONS]);
    expect(drawn.wholeAreas).toEqual([AREA_ALL]);
    await expect(page.locator('[data-framework=react][data-area=body]')).toBeVisible();
    await expect(page.locator('[data-framework=react][data-area=all]')).toBeVisible();
  });

  test('EXT-029 one page shows parts of modules in React, Vue and Angular, in a cockpit that is none of them', async ({ page, simulator }) => {
    await simulator.change({ workflowModules: TEST_MODULES });
    await openHostHarness(page);
    await page.evaluate(
      async ([react, vue, angular]) => {
        const host = window.harness.createModuleHost({ modules: [{ id: 'react-module' }, { id: 'vue-module' }, { id: 'angular-module' }] });
        const container = document.body.appendChild(document.createElement('div'));
        await Promise.all([
          host.showUserTask('react-module', react, container, { language: 'de' }),
          host.showUserTask('vue-module', vue, container, { language: 'de' }),
          host.showUserTask('angular-module', angular, container, { language: 'de' }),
        ]);
      },
      [reactTask({ id: 'r' }), vueTask({ id: 'v' }), angularTask({ id: 'a' })] as const,
    );
    for (const framework of ['react', 'vue', 'angular']) {
      await expect(page.locator(`[data-framework=${framework}][data-area=body]`)).toBeVisible();
      await expect(page.locator(`[data-framework=${framework}][data-area=body] [data-testid=module-title]`)).toBeVisible();
    }
    await page.locator('[data-framework=angular] [data-testid=module-button]').first().click();
    await expect(page.locator('[data-framework=angular] [data-testid=module-button]').first()).toHaveText('Clicked 1');
    await page.locator('[data-framework=react] [data-testid=module-button]').first().click();
    await expect(page.locator('[data-framework=react] [data-testid=module-button]').first()).toHaveText('Clicked 1');
    await page.locator('[data-framework=vue] [data-testid=module-button]').first().click();
    await expect(page.locator('[data-framework=vue] [data-testid=module-button]').first()).toHaveText('Clicked 1');
  });

  test('EXT-034 loading the data entries of the test modules fetches no file of the framework of a module', async ({ page, simulator }) => {
    await simulator.change({ workflowModules: TEST_MODULES });
    await openHostHarness(page);
    await page.evaluate(
      async ([react, vue, angular]) => {
        const host = window.harness.createModuleHost({ modules: [{ id: 'react-module' }, { id: 'vue-module' }, { id: 'angular-module' }] });
        const asked = [
          ['react-module', 'UserTaskList', [react]],
          ['react-module', 'UserTaskForm', [react]],
          ['react-module', 'Header', [{ id: 'clerk' }]],
          ['vue-module', 'UserTaskList', [vue]],
          ['vue-module', 'WorkflowList', [{ id: 'w', workflowModuleId: 'vue-module' }]],
          ['vue-module', 'UserTaskForm', [vue]],
          ['vue-module', 'WorkflowPage', [{ id: 'w', bpmnProcessId: 'vue-loan' }]],
          ['angular-module', 'UserTaskList', [angular]],
          ['angular-module', 'WorkflowList', [{ id: 'w', workflowModuleId: 'angular-module' }]],
          ['angular-module', 'UserTaskForm', [angular]],
        ] as const;
        for (const [moduleId, entry, args] of asked) await host.ask(moduleId, entry, [...args]);
      },
      [reactTask({ id: 'r' }), vueTask({ id: 'v' }), angularTask({ id: 'a' })] as const,
    );
    const fetched = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => ({ path: new URL(entry.name).pathname, bytes: (entry as PerformanceResourceTiming).decodedBodySize }))
        .filter((entry) => entry.path.startsWith('/wm/')),
    );
    expect(fetched.length).toBeGreaterThan(6);
    const visualEntries = /(RiskForms|HeaderElements|LoanForms|claim-forms|ClaimForms)/;
    for (const { path, bytes } of fetched) {
      expect(path, 'a visual entry is not loaded').not.toMatch(visualEntries);
      expect(bytes, `${path} is small`).toBeLessThan(8 * 1024);
      const source = await (await page.request.get(path)).text();
      expect(findFrameworkCode(source), `${path} has no framework code`).toEqual([]);
    }
  });

  test('EXT-045 callers that ask for the same pair of module and entry while it loads wait on one load', async ({ page, simulator }) => {
    const { spec, body } = simpleSpec();
    await simulator.change({ fakeModules: { [FAKE_MODULE_ID]: fakeModule(FAKE_MODULE_ID, spec) } });
    await openHostHarness(page);
    await page.evaluate(
      async ([task, name]) => {
        const host = window.harness.createModuleHost({ modules: [{ id: 'fake' }] });
        await Promise.all(Array.from({ length: 10 }, () => host.ask('fake', 'UserTaskForm', [task])));
        await Promise.all(Array.from({ length: 10 }, () => host.load('fake', 'Form', [name])));
      },
      [fakeTask('x'), body] as const,
    );
    const paths = (await simulator.requests()).map((entry) => entry.path).filter((path) => path.startsWith('/wm/fake/'));
    expect(paths.filter((path) => path === '/wm/fake/bc-manifest.json')).toHaveLength(1);
    expect(paths.filter((path) => path === '/wm/fake/user-task-form-b1.js')).toHaveLength(1);
    expect(paths.filter((path) => path === '/wm/fake/Form-b1.js')).toHaveLength(1);
  });

  test('EXT-045 a part that is asked again later is not fetched again', async ({ page, simulator }) => {
    const { spec } = simpleSpec();
    await simulator.change({ fakeModules: { [FAKE_MODULE_ID]: fakeModule(FAKE_MODULE_ID, spec) } });
    await openHostHarness(page);
    await page.evaluate(
      async ([task]) => {
        const host = window.harness.createModuleHost({ modules: [{ id: 'fake' }] });
        const container = document.body.appendChild(document.createElement('div'));
        for (let round = 0; round < 3; round++) {
          const part = await host.showUserTask('fake', task, container, {});
          part?.remove();
        }
      },
      [fakeTask('x')] as const,
    );
    const paths = (await simulator.requests()).map((entry) => entry.path).filter((path) => path.startsWith('/wm/fake/'));
    expect(paths).toHaveLength(3);
  });

  test('EXT-027 the entry names of a manifest are those of the types library and the interview, without ./ in front', async ({ page, simulator }) => {
    await simulator.change({ workflowModules: TEST_MODULES });
    await openHostHarness(page);
    expect(Object.keys(EXPORT_NAMES)).toEqual(['UserTaskList', 'WorkflowList', 'UserTaskForm', 'WorkflowPage', 'Header']);
    for (const { id } of TEST_MODULES) {
      const manifest = await (await page.request.get(`/wm/${id}/bc-manifest.json`)).json();
      const names = Object.keys(manifest.entries);
      expect(names.filter((name) => name.startsWith('./')), id).toEqual([]);
      expect(names, id).toContain('UserTaskForm');
      expect(names.filter((name) => name in EXPORT_NAMES).length, id).toBeGreaterThan(1);
    }
  });

  test('PKG-056 the three test modules, in React, Vue and Angular, bring different columns and together cover every entry and area', async ({ page, simulator }) => {
    await simulator.change({ workflowModules: TEST_MODULES });
    await openHostHarness(page);
    const covered = await page.evaluate(async ([react, vue, angular]) => {
      const host = window.harness.createModuleHost({ modules: [{ id: 'react-module' }, { id: 'vue-module' }, { id: 'angular-module' }] });
      const columnsOf = async (moduleId: string, task: object) =>
        ((await host.ask(moduleId, 'UserTaskList', [task])) as Array<{ path: string }>).map((column) => column.path);
      const entries = new Set<string>();
      const areas = new Set<string>();
      for (const [moduleId, task] of [['react-module', react], ['vue-module', vue], ['angular-module', angular]] as const) {
        const manifest = await host.readManifest(moduleId);
        for (const name of Object.keys(manifest?.entries ?? {})) entries.add(name);
        const parts = await host.ask(moduleId, 'UserTaskForm', [task]);
        for (const area of Object.keys(typeof parts.element === 'string' ? { all: 1 } : parts.element)) areas.add(area);
      }
      return {
        columns: [await columnsOf('react-module', react), await columnsOf('vue-module', vue), await columnsOf('angular-module', angular)],
        entries: [...entries],
        areas: [...areas],
      };
    }, [reactTask({ id: 'r' }), vueTask({ id: 'v' }), angularTask({ id: 'a' })] as const);
    expect(new Set(covered.columns.flat()).size).toBe(3);
    for (const entry of Object.keys(EXPORT_NAMES)) expect(covered.entries).toContain(entry);
    for (const area of [AREA_ALL, AREA_BODY, AREA_INFORMATION, AREA_ACTIONS]) expect(covered.areas).toContain(area);
  });
});

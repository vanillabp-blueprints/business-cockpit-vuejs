import type { Locator, Page } from '@playwright/test';
import { expect, logInAs, test } from '../support/test.ts';
import { aTask } from '../support/tasks.ts';
import { angularTask, reactTask, registerTestModules, vueTask } from '../support/modules.ts';

const form = (page: Page, area: string) => page.locator(`[data-testid=area-${area}] [data-testid=module-form]`);
const themeColor = (page: Page, token: string) =>
  page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, token);
const style = (locator: Locator, property: string) => locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);

test.describe('the page of a user task', () => {
  test.beforeEach(async ({ simulator }) => {
    await registerTestModules(simulator);
  });

  test('TF-001 opening a task marks it as read and shows the web components the page function names', async ({ page, simulator }) => {
    const task = vueTask({ id: 'unread', read: undefined, businessId: 'V-4711' });
    await simulator.change({ tasks: [task] });
    await logInAs(page, 'clerk', '/aufgaben/unread');
    await expect(form(page, 'body')).toBeVisible();
    await expect(form(page, 'information')).toBeVisible();
    await expect(form(page, 'actions')).toBeVisible();
    await expect(page.locator('[data-testid=area-information] [data-testid=module-business-id]')).toHaveText('V-4711');
    const requests = await simulator.requests();
    expect(requests.some((entry) => entry.method === 'GET' && entry.path === '/gui/api/v1/usertask/unread')).toBe(true);
    expect(requests.some((entry) => entry.method === 'PATCH' && entry.path === '/gui/api/v1/usertask/unread/mark-as-read')).toBe(true);
  });

  test('TF-001 a task is opened from the list with a click on its title and the list row is no longer bold after coming back', async ({ page, simulator }) => {
    await simulator.change({ tasks: [vueTask({ id: 'from-list', read: undefined })] });
    await logInAs(page, 'clerk', '/tasks');
    await expect(page.locator('[data-testid=task-row][data-task-id=from-list]')).toHaveClass(/task-row--unread/);
    await page.locator('[data-testid=task-row][data-task-id=from-list]').getByTestId('task-title').click();
    await expect(form(page, 'body')).toBeVisible();
    await page.goBack();
    await expect(page.locator('[data-testid=task-row][data-task-id=from-list]')).not.toHaveClass(/task-row--unread/);
  });

  test('TF-024 a click on the title opens the page in the same tab and opens no other tab', async ({ page, context, simulator }) => {
    await simulator.change({ tasks: [vueTask({ id: 'same-tab' })] });
    await logInAs(page, 'clerk', '/tasks');
    const title = page.locator('[data-testid=task-row][data-task-id=same-tab]').getByTestId('task-title');
    await expect(title).not.toHaveAttribute('target', '_blank');
    await title.click();
    await expect(page).toHaveURL(/\/aufgaben\/same-tab$/);
    await expect(form(page, 'body')).toBeVisible();
    expect(context.pages()).toHaveLength(1);
  });

  test('TF-019 a task with the type EXTERNAL opens its address in a tab of its own and the list stays', async ({ page, context, simulator }) => {
    await simulator.change({
      tasks: [aTask({ id: 'external', workflowModuleId: 'portal', uiUriType: 'EXTERNAL', uiUri: 'start.html' })],
      fakeModules: { portal: { 'start.html': '<h1 data-testid="portal-page">The page of the module</h1>' } },
    });
    await logInAs(page, 'clerk', '/tasks');
    const opened = context.waitForEvent('page');
    await page.locator('[data-testid=task-row][data-task-id=external]').getByTestId('task-title').click();
    const tab = await opened;
    await expect(tab.getByTestId('portal-page')).toBeVisible();
    expect(new URL(tab.url()).pathname).toBe('/wm/portal/start.html');
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.getByTestId('task-list-page')).toBeVisible();
  });

  test('TF-020 the address of a task is its uiUri when that is a whole address, and a path below /wm/<module>/ otherwise', async ({ page, simulator }) => {
    const external = (id: string, uiUri: string, uiUriType = 'EXTERNAL') => aTask({ id, workflowModuleId: 'portal', uiUriType, uiUri });
    await simulator.change({
      tasks: [
        external('relative', 'pages/start.html'),
        external('slash', '/pages/start.html'),
        external('http', 'http://example.org/a?b=1'),
        external('https', 'https://example.org/a#c'),
      ],
    });
    await logInAs(page, 'clerk', '/tasks');
    const addressOf = (id: string) => page.locator(`[data-testid=task-row][data-task-id=${id}]`).getByTestId('task-title').getAttribute('href');
    expect(await addressOf('relative')).toBe('/wm/portal/pages/start.html');
    expect(await addressOf('slash')).toBe('/wm/portal/pages/start.html');
    expect(await addressOf('http')).toBe('http://example.org/a?b=1');
    expect(await addressOf('https')).toBe('https://example.org/a#c');
  });

  test('TF-027 a page function that returns one web component gives it the whole area with no column', async ({ page, simulator }) => {
    await simulator.change({ tasks: [reactTask({ id: 'whole', taskDefinition: 'confirm' })] });
    await logInAs(page, 'clerk', '/aufgaben/whole');
    await expect(page.locator('[data-testid=area-all] [data-testid=module-form]')).toHaveAttribute('data-area', 'all');
    await expect(page.getByTestId('area-body')).toHaveCount(0);
    await expect(page.locator('.task-page__column')).toHaveCount(0);
  });

  test('TF-027 a page function that returns an object gives each named web component its area and loads the visual entry named in entry', async ({ page, simulator }) => {
    await simulator.change({ tasks: [vueTask({ id: 'areas' })] });
    await logInAs(page, 'clerk', '/aufgaben/areas');
    for (const area of ['body', 'information', 'actions']) {
      await expect(form(page, area)).toHaveAttribute('data-area', area);
    }
    const files = (await simulator.requests()).map((entry) => entry.path);
    expect(files.some((path) => /^\/wm\/vue-module\/entries\/LoanForms-.*\.js$/.test(path))).toBe(true);
  });

  test('TF-029 the page draws the areas it knows and never all together with them', async ({ page, simulator }) => {
    await simulator.change({ tasks: [vueTask({ id: 'known' })] });
    await logInAs(page, 'clerk', '/aufgaben/known');
    await expect(form(page, 'body')).toBeVisible();
    await expect(page.locator('[data-testid=module-form][data-area=all]')).toHaveCount(0);
  });

  test('TF-029 when the object names none of the areas the page draws all', async ({ page, simulator }) => {
    await simulator.change({ tasks: [vueTask({ id: 'unknown-areas', taskDefinition: 'approve' })] });
    await logInAs(page, 'clerk', '/aufgaben/unknown-areas');
    await expect(page.locator('[data-testid=area-all] [data-testid=module-form]')).toHaveAttribute('data-area', 'all');
    await expect(page.getByTestId('area-body')).toHaveCount(0);
  });

  test('TF-029 an object with one known area is the laid-out form and the other areas stay empty', async ({ page, simulator }) => {
    await simulator.change({ tasks: [vueTask({ id: 'only-body', taskDefinition: 'only-body' })] });
    await logInAs(page, 'clerk', '/aufgaben/only-body');
    await expect(form(page, 'body')).toBeVisible();
    await expect(form(page, 'information')).toHaveCount(0);
    await expect(form(page, 'actions')).toHaveCount(0);
  });

  test('TF-038 the cockpit sets no read-only flag and disables no input', async ({ page, simulator }) => {
    await simulator.change({ tasks: [reactTask({ id: 'editable' })] });
    await logInAs(page, 'clerk', '/aufgaben/editable');
    const input = page.getByTestId('module-input');
    await expect(input).toBeEditable();
    await expect(input).toBeEnabled();
    const attributesOfElements = await page.locator('[data-testid=task-page-areas] > * *').evaluateAll((elements) =>
      elements.filter((element) => element.localName.includes('-')).flatMap((element) => [...element.attributes].map((attribute) => attribute.name)),
    );
    expect(attributesOfElements.filter((name) => ['readonly', 'disabled', 'inert'].includes(name))).toEqual([]);
    await input.fill('typed');
    await expect(input).toHaveValue('typed');
  });

  test('TF-040 the header of an open task shows neither the title of the task nor what the areas show', async ({ page, simulator }) => {
    await simulator.change({ tasks: [vueTask({ id: 'plain-header', title: { de: 'Ein besonderer Titel', en: 'A special title' }, businessId: 'V-7777' })] });
    await logInAs(page, 'clerk', '/aufgaben/plain-header');
    await expect(page.getByTestId('module-title')).toHaveText('Ein besonderer Titel');
    const header = page.getByTestId('app-header');
    await expect(header).not.toContainText('Ein besonderer Titel');
    await expect(header).not.toContainText('V-7777');
    await expect(header).not.toContainText('Bestellung');
  });

  test('TF-042 the header of an open task has the look of the state of the task and shows nothing struck through', async ({ page, simulator }) => {
    const MOMENT = '2026-11-02T08:00:00Z';
    await simulator.change({
      tasks: [
        vueTask({ id: 'completed', endedAt: MOMENT, endReason: 'COMPLETED' }),
        vueTask({ id: 'cancelled', endedAt: MOMENT, endReason: 'CANCELLED' }),
        vueTask({ id: 'suspended', suspendedAt: MOMENT }),
        vueTask({ id: 'active' }),
      ],
    });
    await logInAs(page, 'clerk', '/aufgaben/active');
    const header = page.getByTestId('app-header');
    await expect(header).toHaveAttribute('data-state', 'active');
    const ordinaryBackground = await style(header, 'background-color');
    const ordinaryColour = await style(header, 'color');

    for (const id of ['completed', 'cancelled']) {
      await page.goto(`/aufgaben/${id}`);
      await expect(header).toHaveAttribute('data-state', id);
      expect(await style(header, 'background-color')).toBe(await themeColor(page, '--bc-color-row-ended'));
      expect(await style(header, 'text-decoration-line')).toBe('none');
      expect(await style(header.getByTestId('header-title'), 'text-decoration-line')).toBe('none');
    }
    await page.goto('/aufgaben/suspended');
    await expect(header).toHaveAttribute('data-state', 'suspended');
    expect(await style(header, 'color')).toBe(await themeColor(page, '--bc-color-text-suspended'));
    expect(await style(header, 'background-color')).toBe(ordinaryBackground);
    expect(ordinaryColour).not.toBe(await themeColor(page, '--bc-color-text-suspended'));
  });

  test('TF-043 a suspended task has a barrier over its areas that lets the content be read and scrolled but takes clicks and keys', async ({ page, simulator }) => {
    await simulator.change({ tasks: [reactTask({ id: 'held', suspendedAt: '2026-11-02T08:00:00Z' })] });
    await logInAs(page, 'clerk', '/aufgaben/held');
    for (const area of ['body', 'information', 'actions']) {
      await expect(page.locator(`[data-testid=area-${area}] [data-testid=barrier]`)).toBeVisible();
    }
    await expect(page.getByTestId('module-title')).toBeVisible();

    await page.getByTestId('module-button').click({ force: true });
    await expect(page.getByTestId('module-button')).toHaveText('Clicked 0');
    await page.getByTestId('module-input').evaluate((input: HTMLInputElement) => input.focus());
    await page.keyboard.type('abc');
    await expect(page.getByTestId('module-input')).toHaveValue('');

    const body = page.getByTestId('area-body');
    const before = await body.evaluate((element) => element.scrollTop);
    await body.hover();
    await page.mouse.wheel(0, 400);
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(before);
    // The barrier is as high as the whole content, so it is still over the form after the scroll.
    const barrier = page.locator('[data-testid=area-body] [data-testid=barrier]');
    const [barrierHeight, areaScrollHeight] = await Promise.all([barrier.evaluate((element) => element.getBoundingClientRect().height), body.evaluate((element) => element.scrollHeight)]);
    expect(barrierHeight).toBeGreaterThanOrEqual(areaScrollHeight - 1);
  });

  test('TF-043 an active task and a task that ended while it was suspended have no barrier', async ({ page, simulator }) => {
    await simulator.change({
      tasks: [reactTask({ id: 'free' }), reactTask({ id: 'ended', suspendedAt: '2026-11-02T08:00:00Z', endedAt: '2026-11-03T08:00:00Z', endReason: 'CANCELLED' })],
    });
    await logInAs(page, 'clerk', '/aufgaben/free');
    await expect(page.getByTestId('module-form').first()).toBeVisible();
    await expect(page.getByTestId('barrier')).toHaveCount(0);
    await page.goto('/aufgaben/ended');
    await expect(page.getByTestId('module-form').first()).toBeVisible();
    await expect(page.getByTestId('barrier')).toHaveCount(0);
  });

  test('TF-044 when the suspended task is activated again the page reads it again and the barrier goes without a reload', async ({ page, simulator }) => {
    const suspended = vueTask({ id: 'wakes-up', suspendedAt: '2026-11-02T08:00:00Z' });
    await simulator.change({ tasks: [suspended] });
    await logInAs(page, 'clerk', '/aufgaben/wakes-up');
    await expect(page.getByTestId('module-state').first()).toHaveText('suspended');
    await expect(page.getByTestId('barrier')).toHaveCount(3);
    await page.evaluate(() => (window as unknown as { keptByNoReload: boolean }).keptByNoReload = true);

    const { suspendedAt: _activatedNow, ...activated } = suspended;
    await simulator.change({ tasks: [activated] });
    // The page reads the task again when its tab comes back to the front.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.getByTestId('barrier')).toHaveCount(0);
    await expect(page.getByTestId('module-state').first()).toHaveText('active');
    expect(await page.evaluate(() => (window as unknown as { keptByNoReload?: boolean }).keptByNoReload)).toBe(true);
  });

  test('TF-045 a list page answers a question on the BroadcastChannel with its visibility state, also after a reload', async ({ page, simulator }) => {
    await simulator.change({ tasks: [vueTask({ id: 'x' })] });
    await logInAs(page, 'clerk', '/tasks');
    await expect(page.getByTestId('task-list-page')).toBeVisible();
    const ask = () =>
      page.evaluate(
        () =>
          new Promise((resolve) => {
            const channel = new BroadcastChannel('bc-cockpit');
            const second = new BroadcastChannel('bc-cockpit');
            second.onmessage = (message) => {
              if (message.data?.type === 'list-pong') resolve(message.data);
            };
            // The page that asks is the one that answers, but a channel never delivers to itself, so the
            // asking side is a second channel object of the same page.
            second.postMessage({ type: 'list-ping', id: 'ask-1' });
            channel.close();
          }),
      );
    expect(await ask()).toEqual({ type: 'list-pong', id: 'ask-1', visible: true });
    await page.reload();
    await expect(page.getByTestId('task-list-page')).toBeVisible();
    expect(await ask()).toEqual({ type: 'list-pong', id: 'ask-1', visible: true });
    expect(await page.evaluate(() => window.name)).toBe('bc-list');
  });

  test('TF-045 every page of the cockpit sets the same Cross-Origin-Opener-Policy', async ({ page, simulator }) => {
    await simulator.change({ tasks: [vueTask({ id: 'x' })] });
    await logInAs(page, 'clerk', '/tasks');
    const policyOf = async (address: string) => (await page.request.get(address)).headers()['cross-origin-opener-policy'];
    expect(await policyOf('/tasks')).toBe(await policyOf('/tasks/x'));
    expect(await policyOf('/tasks')).toBe(await policyOf('/workflows'));
  });

  test('EXT-005 a web component of a module renders in a shadow DOM and the styles of the cockpit and of the module stay apart', async ({ page, simulator }) => {
    await simulator.change({ tasks: [reactTask({ id: 'in-react' }), vueTask({ id: 'in-vue' }), angularTask({ id: 'in-angular' })] });
    await logInAs(page, 'clerk', '/aufgaben/in-react');
    const rules: Record<string, string> = { 'in-react': 'react', 'in-vue': 'vue', 'in-angular': 'angular' };
    for (const [id, framework] of Object.entries(rules)) {
      await page.goto(`/aufgaben/${id}`);
      await expect(page.locator(`[data-testid=area-body] [data-framework=${framework}]`)).toBeVisible();
      const host = page.locator('[data-testid=area-body] [data-bc-area] > *').first();
      expect(await host.evaluate((element) => element.shadowRoot?.mode)).toBe('open');
      await page.addStyleTag({ content: 'button, h2 { background: rgb(255, 0, 0) !important; color: rgb(0, 255, 0) !important; }' });
      expect(await style(page.getByTestId('module-button'), 'background-color')).not.toBe('rgb(255, 0, 0)');
      expect(await style(page.getByTestId('module-title'), 'color')).not.toBe('rgb(0, 255, 0)');
      // The module styles h2 and button inside its shadow root. The buttons and headings of the cockpit have not changed.
      const cockpitButtonColour = await page.locator('.v-app-bar button').first().evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(cockpitButtonColour).not.toMatch(/^rgb\((20, 90, 160|30, 130, 80|150, 60, 150)\)$/);
      // Not one style element of the module reaches the head of the page.
      const stylesInHead = await page.evaluate(() => [...document.head.querySelectorAll('style')].filter((element) => element.textContent?.includes('data-testid')).length);
      expect(stylesInHead).toBe(0);
    }
  });

  test('TF-039 opening a second task of the same kind loads no entry again and reads no manifest again within a minute', async ({ page, simulator }) => {
    await simulator.change({ tasks: [vueTask({ id: 'first' }), vueTask({ id: 'second' })] });
    await logInAs(page, 'clerk', '/tasks');
    await page.locator('[data-testid=task-row][data-task-id=first]').getByTestId('task-title').click();
    await expect(form(page, 'body')).toBeVisible();
    const loadedByFirst = (await simulator.requests()).filter((entry) => entry.path.startsWith('/wm/vue-module/'));
    expect(loadedByFirst.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(['/wm/vue-module/bc-manifest.json']),
    );
    await page.goBack();
    await page.locator('[data-testid=task-row][data-task-id=second]').getByTestId('task-title').click();
    await expect(form(page, 'body')).toBeVisible();
    await page.goBack();
    await page.locator('[data-testid=task-row][data-task-id=first]').getByTestId('task-title').click();
    await expect(form(page, 'body')).toBeVisible();
    const loadedByAll = (await simulator.requests()).filter((entry) => entry.path.startsWith('/wm/vue-module/'));
    expect(loadedByAll).toHaveLength(loadedByFirst.length);
  });
});

import type { Page } from '@playwright/test';
import type { UserTask } from '../../packages/ui/src/generated/official-gui-api/types.gen.ts';
import { expect, logInAs, test, type SimulatorControl } from '../support/test.ts';
import { aTask, clerkPerson, otherPerson } from '../support/tasks.ts';

const rowOf = (page: Page, taskId: string) => page.locator(`[data-testid=task-row][data-task-id="${taskId}"]`);
const taskRows = (page: Page) => page.getByTestId('task-row');
const primaryFilter = (page: Page, filter: string) => page.getByTestId(`primary-filter-${filter}`);
// Vuetify marks the chosen button of a group with this class.
const CHOSEN = /v-btn--active/;

async function showList(page: Page, simulator: SimulatorControl, tasks: UserTask[], address = '/tasks', casesInProgress = 0) {
  await simulator.change({ tasks, casesInProgress });
  await logInAs(page, 'clerk', address);
  await expect(page.getByTestId('task-list-page')).toBeVisible();
}

const inTheFuture = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const inThePast = (days: number) => inTheFuture(-days);

/** What the simulator saw of the requests to the lists and the count endpoints of the GUI API. */
async function requestsTo(simulator: SimulatorControl, endsWith: string) {
  return (await simulator.guiApiRequests()).filter((entry) => entry.path.endsWith(endsWith));
}

const modeOf = (entry: { body?: unknown }) => (entry.body as { mode?: string }).mode;

test.describe('which tasks a list shows', () => {
  const tasksOfThreePeople = [
    aTask({ id: 'mine', assignee: clerkPerson }),
    aTask({ id: 'of-olaf', assignee: otherPerson }),
    aTask({ id: 'unassigned', candidateUsers: [clerkPerson] }),
  ];

  test('NAV-001 /tasks shows all user tasks the user may see', async ({ page, simulator }) => {
    await showList(page, simulator, tasksOfThreePeople, '/tasks');
    await expect(taskRows(page)).toHaveCount(3);
    const asked = await requestsTo(simulator, '/usertask');
    expect(asked.map((entry) => entry.path)).toEqual(['/gui/api/v1/usertask']);
  });

  test('NAV-002 /my-tasks shows the user tasks where the user is the assignee', async ({ page, simulator }) => {
    await showList(page, simulator, tasksOfThreePeople, '/my-tasks');
    await expect(taskRows(page)).toHaveCount(1);
    await expect(rowOf(page, 'mine')).toBeVisible();
    const asked = await requestsTo(simulator, '/usertask');
    expect(asked.map((entry) => entry.path)).toEqual(['/gui/api/v1/current-user/usertask']);
  });

  test('NAV-001 the path of every language opens the list', async ({ page, simulator }) => {
    await showList(page, simulator, tasksOfThreePeople, '/aufgaben');
    for (const address of ['/aufgaben', '/tasks', '/taches']) {
      await page.goto(address);
      await expect(taskRows(page)).toHaveCount(3);
    }
  });
});

test.describe('the toggle in the header', () => {
  test('NAV-006 each part of the toggle shows its count and opens its list without narrowing', async ({ page, simulator }) => {
    const tasks = [
      aTask({ assignee: clerkPerson }),
      aTask({ assignee: clerkPerson }),
      aTask({ assignee: otherPerson }),
      aTask({ assignee: otherPerson }),
      aTask({ assignee: otherPerson }),
    ];
    await showList(page, simulator, tasks, '/tasks', 7);

    await expect(page.getByTestId('toggle-my-tasks')).toContainText('Meine Aufgaben (2)');
    await expect(page.getByTestId('toggle-tasks')).toContainText('Alle Aufgaben (5)');
    await expect(page.getByTestId('toggle-workflows')).toContainText('Fälle (7)');

    await page.getByTestId('toggle-my-tasks').click();
    await expect(page).toHaveURL(/\/meine-aufgaben$/);
    await expect(taskRows(page)).toHaveCount(2);
    await page.getByTestId('toggle-tasks').click();
    await expect(page).toHaveURL(/\/aufgaben$/);
    await expect(taskRows(page)).toHaveCount(5);
    await page.getByTestId('toggle-workflows').click();
    await expect(page).toHaveURL(/\/faelle$/);
  });

  test('NAV-010 the counts are asked again when the application opens, when a list opens and when the tab comes back', async ({ page, simulator }) => {
    await showList(page, simulator, [aTask({ assignee: clerkPerson })], '/tasks');
    await expect(page.getByTestId('toggle-count-my-tasks')).toHaveText('(1)');
    const countsAfterStart = (await requestsTo(simulator, '/usertask/count')).length;
    expect(countsAfterStart).toBeGreaterThanOrEqual(2);

    await simulator.change({ tasks: [aTask({ assignee: clerkPerson }), aTask({ assignee: clerkPerson })] });
    await page.getByTestId('toggle-my-tasks').click();
    await expect(page.getByTestId('toggle-count-my-tasks')).toHaveText('(2)');
    const countsAfterOpening = (await requestsTo(simulator, '/usertask/count')).length;
    expect(countsAfterOpening).toBeGreaterThan(countsAfterStart);

    await simulator.change({ tasks: [aTask({ assignee: clerkPerson })] });
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByTestId('toggle-count-my-tasks')).toHaveText('(1)');
    expect((await requestsTo(simulator, '/usertask/count')).length).toBeGreaterThan(countsAfterOpening);
  });

  test('NAV-010 a count in the toggle uses the primary filter its list opens with', async ({ page, simulator }) => {
    const tasks = [aTask({ assignee: clerkPerson }), aTask({ assignee: clerkPerson, endedAt: inThePast(1), endReason: 'COMPLETED' })];
    await showList(page, simulator, tasks, '/tasks');
    await expect(page.getByTestId('toggle-count-tasks')).toHaveText('(1)');

    await page.getByTestId('primary-filter-ClosedTasksOnly').click();
    await expect(page.getByTestId('toggle-count-tasks')).toHaveText('(1)');
    await simulator.change({ tasks: [...tasks, aTask({ endedAt: inThePast(2), endReason: 'COMPLETED' })] });
    await page.reload();
    await expect(page.getByTestId('toggle-count-tasks')).toHaveText('(2)');
    const lastCountOfTheToggle = (await requestsTo(simulator, '/usertask/count')).filter((entry) => {
      const filters = (entry.body as { filters: { mode: string }[] }).filters;
      return filters.length === 1 && filters[0].mode === 'ClosedTasksOnly';
    });
    expect(lastCountOfTheToggle.length).toBeGreaterThan(0);
  });
});

test.describe('the primary filters', () => {
  const tasks = [
    aTask({ id: 'open' }),
    aTask({ id: 'put-aside', followUpDate: inTheFuture(3) }),
    aTask({ id: 'due-again', followUpDate: inThePast(1) }),
    aTask({ id: 'done', endedAt: inThePast(2), endReason: 'COMPLETED' }),
    aTask({ id: 'done-too', endedAt: inThePast(3), endReason: 'CANCELLED' }),
  ];

  test('TL-001 the status line offers the four primary filters with short translated labels', async ({ page, simulator }) => {
    await showList(page, simulator, tasks);
    await expect(page.getByTestId('primary-filter-OpenTasksWithoutFollowUp')).toContainText('Offen');
    await expect(page.getByTestId('primary-filter-OpenTasksWithFollowUp')).toContainText('Alle offenen');
    await expect(page.getByTestId('primary-filter-OpenTaskOnlyFollowUp')).toContainText('Wiedervorlage');
    await expect(page.getByTestId('primary-filter-ClosedTasksOnly')).toContainText('Erledigt');

    await page.getByTestId('open-menu').click();
    await page.getByTestId('language-en').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('primary-filter-ClosedTasksOnly')).toContainText('Closed');
  });

  test('TL-002 the list opens with OpenTasksWithoutFollowUp and always sends its primary filter', async ({ page, simulator }) => {
    await showList(page, simulator, tasks);
    await expect(taskRows(page)).toHaveCount(2);
    await expect(rowOf(page, 'put-aside')).toHaveCount(0);
    const pages = await requestsTo(simulator, '/usertask');
    expect(pages.map(modeOf)).toEqual(['OpenTasksWithoutFollowUp']);
  });

  test('TL-003 each primary filter except ClosedTasksOnly shows its count in brackets', async ({ page, simulator }) => {
    await showList(page, simulator, tasks);
    await expect(page.getByTestId('primary-filter-count-OpenTasksWithoutFollowUp')).toHaveText('(2)');
    await expect(page.getByTestId('primary-filter-count-OpenTasksWithFollowUp')).toHaveText('(3)');
    await expect(page.getByTestId('primary-filter-count-OpenTaskOnlyFollowUp')).toHaveText('(1)');
    await expect(page.getByTestId('primary-filter-count-ClosedTasksOnly')).toHaveText('');
  });

  test('TL-003 the count of ClosedTasksOnly is asked on mouse-over only and is not kept', async ({ page, simulator }) => {
    await showList(page, simulator, tasks);
    const closedCountsAsked = async () =>
      (await requestsTo(simulator, '/usertask/count')).filter((entry) =>
        (entry.body as { filters: { mode: string }[] }).filters.some((filter) => filter.mode === 'ClosedTasksOnly'),
      ).length;
    // The counts of the toggle ask for the primary filter the list opens with, which is not the closed one.
    expect(await closedCountsAsked()).toBe(0);

    await page.getByTestId('primary-filter-ClosedTasksOnly').hover();
    await expect(page.getByTestId('primary-filter-count-ClosedTasksOnly')).toHaveText('(2)');
    expect(await closedCountsAsked()).toBe(1);

    await page.mouse.move(5, 300);
    await expect(page.getByTestId('primary-filter-count-ClosedTasksOnly')).toHaveText('');
  });

  test('TL-005 the primary filter last chosen is used again the next time the user opens the list', async ({ page, simulator }) => {
    await showList(page, simulator, tasks);
    await page.getByTestId('primary-filter-ClosedTasksOnly').click();
    await expect(taskRows(page)).toHaveCount(2);

    await page.reload();
    await expect(primaryFilter(page, 'ClosedTasksOnly')).toHaveClass(CHOSEN);
    await expect(taskRows(page)).toHaveCount(2);
    const pages = await requestsTo(simulator, '/usertask');
    expect(pages.map(modeOf)).toEqual(['OpenTasksWithoutFollowUp', 'ClosedTasksOnly', 'ClosedTasksOnly']);
  });

  test('TL-005 the choice is a setting of the user on the server, so it follows the user to another browser', async ({ page, browser, simulator }) => {
    await showList(page, simulator, tasks);
    await page.getByTestId('primary-filter-OpenTaskOnlyFollowUp').click();
    await expect(taskRows(page)).toHaveCount(1);

    const otherBrowser = await browser.newContext();
    const otherPage = await otherBrowser.newPage();
    await logInAs(otherPage, 'clerk', '/tasks');
    await expect(otherPage.getByTestId('primary-filter-OpenTaskOnlyFollowUp')).toHaveClass(CHOSEN);
    await expect(otherPage.getByTestId('task-row')).toHaveCount(1);
    await otherBrowser.close();
  });

  test('TL-005 each list remembers its own primary filter under a key with colons', async ({ page, simulator }) => {
    await showList(page, simulator, tasks, '/my-tasks');
    await page.getByTestId('primary-filter-ClosedTasksOnly').click();
    await expect.poll(async () => (await simulator.guiApiRequests()).map((entry) => `${entry.method} ${decodeURIComponent(entry.path)}`)).toContain(
      'PUT /gui/api/v1/app/current-user/settings/bc:my-tasks:primaryFilter',
    );
  });
});

test.describe('the fixed columns', () => {
  const headingsOf = (page: Page) => page.locator('[data-testid=task-list-header] > div');
  const columnsOf = async (page: Page) => headingsOf(page).evaluateAll((cells) => cells.map((cell) => (cell as HTMLElement).dataset.column));

  test('TL-008 the fixed columns are the ones from the interview, in its order', async ({ page, simulator }) => {
    await showList(page, simulator, [aTask()]);
    expect(await columnsOf(page)).toEqual(['select', 'caseKind', 'title', 'dueDate', 'note', 'assignee', 'candidateUsers']);
    const headings = await headingsOf(page).allInnerTexts();
    expect(headings.filter(Boolean)).toEqual(['Fallart', 'Titel', 'Fällig', 'Notiz', 'Bearbeiter']);
  });

  test('TL-009 the follow-up column shows only for OpenTasksWithFollowUp and OpenTaskOnlyFollowUp', async ({ page, simulator }) => {
    await showList(page, simulator, [aTask({ followUpDate: inTheFuture(2) })]);
    const shownFor: Record<string, boolean> = {};
    for (const filter of ['OpenTasksWithoutFollowUp', 'OpenTasksWithFollowUp', 'OpenTaskOnlyFollowUp', 'ClosedTasksOnly']) {
      await page.getByTestId(`primary-filter-${filter}`).click();
      await expect(primaryFilter(page, filter)).toHaveClass(CHOSEN);
      shownFor[filter] = (await columnsOf(page)).includes('followUpDate');
    }
    expect(shownFor).toEqual({
      OpenTasksWithoutFollowUp: false,
      OpenTasksWithFollowUp: true,
      OpenTaskOnlyFollowUp: true,
      ClosedTasksOnly: false,
    });
  });

  test('TL-010 the ended column shows only for ClosedTasksOnly, at the end', async ({ page, simulator }) => {
    await showList(page, simulator, [aTask({ endedAt: inThePast(1), endReason: 'COMPLETED' })]);
    expect(await columnsOf(page)).not.toContain('endedAt');
    await page.getByTestId('primary-filter-ClosedTasksOnly').click();
    await expect(page.locator('[data-column=endedAt]')).toBeVisible();
    expect((await columnsOf(page)).at(-1)).toBe('endedAt');
    await page.getByTestId('primary-filter-OpenTasksWithFollowUp').click();
    await expect(page.locator('[data-column=endedAt]')).toHaveCount(0);
  });

  test('COL-015 the fixed columns are always shown, whatever the primary filter', async ({ page, simulator }) => {
    await showList(page, simulator, [aTask()]);
    for (const filter of ['OpenTasksWithFollowUp', 'OpenTaskOnlyFollowUp', 'ClosedTasksOnly', 'OpenTasksWithoutFollowUp']) {
      await page.getByTestId(`primary-filter-${filter}`).click();
      await expect(primaryFilter(page, filter)).toHaveClass(CHOSEN);
      expect((await columnsOf(page)).slice(0, 7)).toEqual(['select', 'caseKind', 'title', 'dueDate', 'note', 'assignee', 'candidateUsers']);
    }
  });

  test('COL-021 each fixed column has the path of its field in the GUI API', async ({ page, simulator }) => {
    await showList(page, simulator, [aTask()]);
    await page.getByTestId('primary-filter-OpenTasksWithFollowUp').click();
    await expect(page.locator('[data-column=followUpDate]')).toBeVisible();
    const paths = await headingsOf(page).evaluateAll((cells) => cells.map((cell) => (cell as HTMLElement).dataset.path));
    // The case kind is the title of the case, a text per language, so its path names the language of the user.
    expect(paths).toEqual(['id', 'workflowTitle.de', 'title', 'dueDate', 'note', 'assignee', 'candidateUsers', 'followUpDate']);
  });

  test('TL-011 the id column is a checkbox that selects the row, and the id is not shown', async ({ page, simulator }) => {
    await showList(page, simulator, [aTask({ id: 'secret-id-4711', title: { de: 'Erste' } }), aTask({ id: 'other-id', title: { de: 'Zweite' } })]);
    await expect(page.getByTestId('task-list')).not.toContainText('secret-id-4711');
    const checkbox = rowOf(page, 'secret-id-4711').getByTestId('select-task').getByRole('checkbox');
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await expect(rowOf(page, 'other-id').getByRole('checkbox')).not.toBeChecked();
  });

  test('TL-012 the title is a real link that opens the task page, and open in new tab works on it', async ({ page, context, simulator }) => {
    await showList(page, simulator, [aTask({ id: 'task-a', title: { de: 'Rechnung prüfen' } })]);
    const link = rowOf(page, 'task-a').getByTestId('task-title');
    await expect(link).toHaveText('Rechnung prüfen');
    expect(await link.evaluate((element) => element.tagName)).toBe('A');
    await expect(link).toHaveAttribute('href', '/aufgaben/task-a');

    const newTab = context.waitForEvent('page');
    await link.click({ modifiers: ['ControlOrMeta'] });
    expect((await newTab).url()).toMatch(/\/aufgaben\/task-a$/);
    await expect(page).toHaveURL(/\/tasks$/);

    await link.click();
    await expect(page).toHaveURL(/\/aufgaben\/task-a$/);
  });

  test('TL-012 the case kind shows the title of the case in the language of the user', async ({ page, simulator }) => {
    await showList(page, simulator, [aTask({ id: 'a', workflowTitle: { de: 'Bestellung', en: 'Order' } })]);
    await expect(rowOf(page, 'a').getByTestId('cell-caseKind')).toHaveText('Bestellung');
    await page.getByTestId('open-menu').click();
    await page.getByTestId('language-en').click();
    await expect(rowOf(page, 'a').getByTestId('cell-caseKind')).toHaveText('Order');
  });

  test('TL-013 the assignee cell shows the short form, and on mouse-over the long form, the user id and the email', async ({ page, simulator }) => {
    await showList(page, simulator, [aTask({ id: 'a', assignee: otherPerson })]);
    const name = rowOf(page, 'a').getByTestId('cell-assignee').getByTestId('person-name');
    await expect(name).toHaveText('O. Other');
    await name.hover();
    const details = page.getByTestId('person-details');
    await expect(details).toContainText('Olaf Other');
    await expect(details).toContainText('olaf');
    await expect(details).toContainText('olaf@example.com');
  });

  test('TL-015 a task the current user claimed shows a bar before the name, and the names stay aligned', async ({ page, simulator }) => {
    await showList(page, simulator, [aTask({ id: 'mine', assignee: clerkPerson }), aTask({ id: 'olafs', assignee: otherPerson })]);
    const barOf = (id: string) => rowOf(page, id).getByTestId('claim-bar');
    const nameOf = (id: string) => rowOf(page, id).getByTestId('person-name');
    expect(await barOf('mine').evaluate((bar) => getComputedStyle(bar).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    expect(await barOf('olafs').evaluate((bar) => getComputedStyle(bar).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    const barBox = (await barOf('mine').boundingBox())!;
    const nameOfMine = (await nameOf('mine').boundingBox())!;
    expect(barBox.x + barBox.width).toBeLessThanOrEqual(nameOfMine.x);
    expect((await nameOf('olafs').boundingBox())!.x).toBeCloseTo(nameOfMine.x, 0);
  });

  test('TL-016 the candidate users column is icon-wide and shows a one-person or a several-people icon', async ({ page, simulator }) => {
    await showList(page, simulator, [
      aTask({ id: 'one', candidateUsers: [clerkPerson] }),
      aTask({ id: 'several', candidateUsers: [clerkPerson, otherPerson] }),
      aTask({ id: 'nobody' }),
    ]);
    const heading = page.locator('[data-column=candidateUsers]');
    expect((await heading.boundingBox())!.width).toBeLessThanOrEqual(64);
    const iconOf = (id: string) => rowOf(page, id).getByTestId('candidate-icon').locator('path');
    const one = await iconOf('one').getAttribute('d');
    const several = await iconOf('several').getAttribute('d');
    expect(one).not.toBe(several);
    expect(await heading.locator('path').getAttribute('d')).toBe(several);
    await expect(rowOf(page, 'nobody').getByTestId('candidate-icon')).toHaveCount(0);

    await rowOf(page, 'several').getByTestId('candidate-icon').hover();
    await expect(page.locator('.v-overlay--active').getByTestId('candidate-user')).toHaveText(['C. Clerk', 'O. Other']);
  });

  test('TL-007 a row whose task the user has not read is bold', async ({ page, simulator }) => {
    await showList(page, simulator, [aTask({ id: 'unread', read: undefined }), aTask({ id: 'read' })]);
    const weightOf = (id: string) => rowOf(page, id).evaluate((row) => getComputedStyle(row).fontWeight);
    expect(Number(await weightOf('unread'))).toBeGreaterThanOrEqual(700);
    expect(Number(await weightOf('read'))).toBeLessThan(600);
  });
});

test.describe('dates', () => {
  test('TL-018 a date column shows the localised date, or the time if the date is today, and the other one on mouse-over', async ({ page, simulator }) => {
    const today = new Date();
    await showList(page, simulator, [
      aTask({ id: 'today', dueDate: today.toISOString() }),
      aTask({ id: 'later', dueDate: '2027-03-04T14:05:00Z' }),
    ]);
    const timeOfToday = new Intl.DateTimeFormat('de', { timeStyle: 'short' }).format(today);
    const dateOfLater = new Intl.DateTimeFormat('de', { dateStyle: 'medium' }).format(new Date('2027-03-04T14:05:00Z'));

    const dueToday = rowOf(page, 'today').getByTestId('cell-dueDate').getByTestId('date-cell');
    await expect(dueToday).toHaveText(timeOfToday);
    await dueToday.hover();
    await expect(page.locator('[data-testid=date-cell-details]:visible')).toContainText(new Intl.DateTimeFormat('de', { dateStyle: 'medium' }).format(today));

    await page.mouse.move(5, 5);
    const dueLater = rowOf(page, 'later').getByTestId('cell-dueDate').getByTestId('date-cell');
    await expect(dueLater).toHaveText(dateOfLater);
    await dueLater.hover();
    await expect(page.locator('[data-testid=date-cell-details]:visible')).toContainText(new Intl.DateTimeFormat('de', { timeStyle: 'short' }).format(new Date('2027-03-04T14:05:00Z')));
  });

  test('COL-019 no date with a time shows the T of the ISO value', async ({ page, simulator }) => {
    await showList(page, simulator, [aTask({ id: 'later', dueDate: '2027-03-04T14:05:00Z' })]);
    await rowOf(page, 'later').getByTestId('date-cell').hover();
    const details = (await page.locator('[data-testid=date-cell-details]:visible').innerText()).trim();
    const expected = `${new Intl.DateTimeFormat('de', { dateStyle: 'medium' }).format(new Date('2027-03-04T14:05:00Z'))} ${new Intl.DateTimeFormat('de', { timeStyle: 'short' }).format(new Date('2027-03-04T14:05:00Z'))}`;
    expect(details).toBe(expected);
    expect(details).not.toMatch(/\dT\d/);
    expect(await page.getByTestId('task-list').innerText()).not.toMatch(/\dT\d/);
  });
});

test.describe('scrolling and paging', () => {
  test('COL-017 a list with more columns than the window has room for scrolls horizontally and the header scrolls with it', async ({ page, simulator }) => {
    await page.setViewportSize({ width: 700, height: 600 });
    await showList(page, simulator, [aTask()]);
    const list = page.getByTestId('task-list');
    const { scrollWidth, clientWidth } = await list.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);

    const titleHeading = page.locator('[data-column=title]');
    const before = (await titleHeading.boundingBox())!.x;
    await list.evaluate((element) => (element.scrollLeft = 120));
    await expect.poll(async () => (await titleHeading.boundingBox())!.x).toBe(before - 120);
  });

  test('COL-018 the room for both scroll bars is reserved always, also while the list loads', async ({ page, simulator }) => {
    await simulator.change({ taskListDelayMs: 600 });
    await page.setViewportSize({ width: 1800, height: 900 });
    await logInAs(page, 'clerk', '/tasks');
    const list = page.getByTestId('task-list');
    // The browser of the tests hides its scroll bars, so their width cannot be measured. Both bars are
    // there always when the list says `scroll` for both directions, and then the room is the same
    // whether the list is empty or full.
    const roomOfTheList = () =>
      list.evaluate((element: HTMLElement) => ({
        overflowX: getComputedStyle(element).overflowX,
        overflowY: getComputedStyle(element).overflowY,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
      }));
    const whileLoading = await roomOfTheList();
    expect(whileLoading).toMatchObject({ overflowX: 'scroll', overflowY: 'scroll' });

    await simulator.change({ taskListDelayMs: 0, tasks: [aTask()] });
    await expect(taskRows(page)).toHaveCount(1);
    expect(await roomOfTheList()).toEqual(whileLoading);
  });

  test('TL-024 further pages load while the user scrolls, each one once, with the timestamp of the first page', async ({ page, simulator }) => {
    await page.setViewportSize({ width: 1400, height: 500 });
    const many = Array.from({ length: 65 }, (_, index) => aTask({ id: `t-${String(index).padStart(3, '0')}`, dueDate: `2027-01-01T00:${String(index % 60).padStart(2, '0')}:00Z` }));
    await showList(page, simulator, many);
    await expect(taskRows(page).first()).toBeVisible();

    const list = page.getByTestId('task-list');
    await expect.poll(async () => taskRows(page).count()).toBeGreaterThanOrEqual(20);
    await list.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    // The list holds a window of pages, so the last rows are there and the first ones are dropped.
    await expect(rowOf(page, 't-064')).toBeVisible();
    await expect(rowOf(page, 't-000')).toHaveCount(0);

    const pagesAsked = await requestsTo(simulator, '/usertask');
    expect(pagesAsked.map((entry) => (entry.body as { pageNumber: number }).pageNumber).sort()).toEqual([0, 1, 2, 3]);
    const timestamps = pagesAsked.map((entry) => new URLSearchParams(entry.query).get('initialTimestamp'));
    expect(timestamps[0]).toBeNull();
    expect(new Set(timestamps.slice(1)).size).toBe(1);
    expect(timestamps[1]).not.toBeNull();
  });

  test('TL-024 every count comes from the count endpoint and no page is asked only for its total', async ({ page, simulator }) => {
    await showList(page, simulator, [aTask(), aTask()]);
    await page.getByTestId('primary-filter-ClosedTasksOnly').hover();
    await expect(page.getByTestId('primary-filter-count-ClosedTasksOnly')).toHaveText('(0)');

    const pages = await requestsTo(simulator, '/usertask');
    expect(pages).toHaveLength(1);
    expect((pages[0].body as { pageSize: number }).pageSize).toBe(20);
    expect((await requestsTo(simulator, '/usertask/count')).length).toBeGreaterThan(2);
  });

  test('TL-024 changing the primary filter starts the list again, and a late answer of the old one is not shown', async ({ page, simulator }) => {
    await simulator.change({ taskListDelayMs: 0 });
    await showList(page, simulator, [aTask({ id: 'open' }), aTask({ id: 'done', endedAt: inThePast(1), endReason: 'COMPLETED' })]);
    await simulator.change({ taskListDelayMs: 500 });
    await page.getByTestId('primary-filter-OpenTasksWithFollowUp').click();
    await page.getByTestId('primary-filter-ClosedTasksOnly').click();
    await expect(rowOf(page, 'done')).toBeVisible();
    await page.waitForTimeout(800);
    await expect(taskRows(page)).toHaveCount(1);
    await expect(rowOf(page, 'open')).toHaveCount(0);
  });
});

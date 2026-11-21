import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { jumpToShareOfScrollBar, scrollInSteps, startWatchingFrames, stopWatchingFrames, waitForDataAtScrollPosition } from '../support/list-measurement.ts';
import { pretendToHaveEntries } from '../support/many-entries.ts';
import { manyTasks } from '../support/tasks.ts';
import { expect, logInAs, test, type SimulatorControl } from '../support/test.ts';

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 40;
const PAGE_SIZE = 20;
const MAX_LIST_ENTRIES = 100_000;

const THIRTY_THOUSAND = manyTasks(30_000);

const taskRows = (page: Page) => page.getByTestId('task-row');
const placeholders = (page: Page) => page.getByTestId('task-placeholder');
const list = (page: Page) => page.getByTestId('task-list');

async function showLongList(page: Page, simulator: SimulatorControl, address = '/tasks') {
  await simulator.change({ tasks: THIRTY_THOUSAND });
  await logInAs(page, 'clerk', address);
  await expect(taskRows(page).first()).toBeVisible();
}

const pagesAsked = async (simulator: SimulatorControl) =>
  (await simulator.guiApiRequests())
    .filter((entry) => /\/usertask$/.test(entry.path))
    .map((entry) => ({ pageNumber: (entry.body as { pageNumber: number }).pageNumber, body: entry.body as { pageSize: number; mode: string }, query: entry.query }));

const scrollTopOf = (page: Page) => list(page).evaluate((element) => element.scrollTop);
const scrollHeightOf = (page: Page) => list(page).evaluate((element) => element.scrollHeight);

test.describe('the window of pages', () => {
  test('SRCH-010 the list draws only the rows of a window of pages and drops far pages', async ({ page, simulator }) => {
    await page.setViewportSize({ width: 1400, height: 700 });
    await showLongList(page, simulator);
    // The visible area is 16 rows: page 0, and one page ahead below.
    await expect(taskRows(page)).toHaveCount(2 * PAGE_SIZE);

    await jumpToShareOfScrollBar(page, 0.5);
    await waitForDataAtScrollPosition(page);
    await expect(page.locator('[data-task-id="m-000000"]')).toHaveCount(0);
    await expect.poll(() => taskRows(page).count()).toBeLessThanOrEqual(4 * PAGE_SIZE);
    await expect(placeholders(page)).toHaveCount(0);
  });

  test('SRCH-011 every request after the first sends the initialTimestamp of the first answer', async ({ page, simulator }) => {
    await showLongList(page, simulator);
    await scrollInSteps(page, 'here', 300, 400, 30);
    await waitForDataAtScrollPosition(page);
    const requests = (await simulator.guiApiRequests()).filter((entry) => /\/usertask$/.test(entry.path));
    expect(requests.length).toBeGreaterThan(3);
    const timestamps = requests.map((entry) => new URLSearchParams(entry.query).get('initialTimestamp'));
    expect(timestamps[0]).toBeNull();
    expect(timestamps.slice(1).every((timestamp) => timestamp !== null && timestamp === timestamps[1])).toBe(true);
  });

  test('SRCH-012 every request of the list sets the page size and the primary filter', async ({ page, simulator }) => {
    await showLongList(page, simulator);
    await page.getByTestId('primary-filter-ClosedTasksOnly').click();
    await expect(taskRows(page).first()).toHaveAttribute('data-state', /completed|cancelled/);
    await jumpToShareOfScrollBar(page, 0.3);
    await waitForDataAtScrollPosition(page);
    const asked = await pagesAsked(simulator);
    expect(asked.length).toBeGreaterThan(4);
    expect(asked.every((request) => request.body.pageSize === PAGE_SIZE && typeof request.body.mode === 'string')).toBe(true);
    expect(new Set(asked.map((request) => request.body.mode))).toEqual(new Set(['OpenTasksWithoutFollowUp', 'ClosedTasksOnly']));
  });

  test('SRCH-014 a taller list area holds more rows in its window than a shorter one', async ({ page, simulator }) => {
    await page.setViewportSize({ width: 1400, height: 500 });
    await showLongList(page, simulator);
    await expect(taskRows(page)).toHaveCount(2 * PAGE_SIZE);
    const rowsOfShortArea = await taskRows(page).count();

    await page.setViewportSize({ width: 1400, height: 1300 });
    await expect.poll(() => taskRows(page).count()).toBeGreaterThan(rowsOfShortArea);
  });

  test('SRCH-015 scrolling up and down slowly shows no empty row while pages load', async ({ page, simulator }) => {
    await simulator.change({ taskListDelayMs: 40 });
    await showLongList(page, simulator);
    // The page ahead of the first one follows the first answer. A user starts to scroll after that.
    await expect(taskRows(page)).toHaveCount(2 * PAGE_SIZE);
    await startWatchingFrames(page);
    await scrollInSteps(page, 'here', 400, 120, 16);
    await scrollInSteps(page, 'here', 100, 120, 16);
    const watched = await stopWatchingFrames(page);
    expect(watched.framesWithPlaceholder).toBe(0);
  });

  test('SRCH-019 after jumps to 37 %, 71 % and 12 % every visible row shows its data within 3 seconds', async ({ page, simulator }) => {
    await showLongList(page, simulator);
    for (const share of [0.37, 0.71, 0.12]) {
      await jumpToShareOfScrollBar(page, share);
      await waitForDataAtScrollPosition(page);
      await expect.poll(() => placeholders(page).count(), { timeout: 3000 }).toBe(0);
      await expect.poll(() => taskRows(page).count(), { timeout: 3000 }).toBeGreaterThan(PAGE_SIZE);
      const firstIndexInView = Math.floor((await scrollTopOf(page)) / ROW_HEIGHT);
      const tops = await taskRows(page).evaluateAll((rows) => rows.map((row) => parseFloat((row as HTMLElement).style.top)));
      expect(tops).toContain(firstIndexInView * ROW_HEIGHT);
    }
  });

  test('SRCH-020 a fast drag of the scroll bar from top to bottom asks only for the pages where it stops', async ({ page, simulator }) => {
    await showLongList(page, simulator);
    const askedBeforeDrag = (await pagesAsked(simulator)).length;
    // A drag is a series of big jumps, a few milliseconds apart.
    await scrollInSteps(page, 'here', 'end', 60_000, 5);
    await waitForDataAtScrollPosition(page);
    const askedByDrag = (await pagesAsked(simulator)).slice(askedBeforeDrag).map((request) => request.pageNumber);
    const lastPage = Math.ceil(THIRTY_THOUSAND.filter((task) => !task.endedAt && !task.followUpDate).length / PAGE_SIZE) - 1;
    expect(askedByDrag.length).toBeLessThanOrEqual(5);
    expect(askedByDrag.every((pageNumber) => pageNumber >= lastPage - 3)).toBe(true);
  });

  test('SRCH-021 no page is asked for again while it is on its way or in the window, and an answer starts no request', async ({ page, simulator }) => {
    await simulator.change({ taskListDelayMs: 30 });
    await showLongList(page, simulator);
    // Down only, so no page leaves the window and comes back.
    await scrollInSteps(page, 'here', 400, 500, 10);
    await waitForDataAtScrollPosition(page);
    const asked = (await pagesAsked(simulator)).map((request) => request.pageNumber);
    expect(new Set(asked).size).toBe(asked.length);

    await page.waitForTimeout(500);
    expect(await pagesAsked(simulator)).toHaveLength(asked.length);
  });

  test('SRCH-028 the loading sign shows on the first load only, not while more pages load', async ({ page, simulator }) => {
    await simulator.change({ tasks: THIRTY_THOUSAND, taskListDelayMs: 400 });
    await logInAs(page, 'clerk', '/tasks');
    await expect(page.getByTestId('list-loading')).toBeVisible();
    await expect(taskRows(page).first()).toBeVisible();
    await expect(page.getByTestId('list-loading')).toHaveCount(0);

    await jumpToShareOfScrollBar(page, 0.6);
    await expect(placeholders(page).first()).toBeVisible();
    await expect(page.getByTestId('list-loading')).toHaveCount(0);
    await page.waitForTimeout(300);
    await expect(page.getByTestId('list-loading')).toHaveCount(0);
  });
});

test.describe('the length of the list and its scroll bar', () => {
  test('SRCH-032 the scroll bar is sized from the number of rows and the fixed row height', async ({ page, simulator }) => {
    await showLongList(page, simulator);
    const openTasks = THIRTY_THOUSAND.filter((task) => !task.endedAt && !task.followUpDate).length;
    const heightOfRows = await page.getByTestId('task-list-rows').evaluate((element) => element.getBoundingClientRect().height);
    expect(heightOfRows).toBe(openTasks * ROW_HEIGHT);
    expect(await scrollHeightOf(page)).toBe(HEADER_HEIGHT + openTasks * ROW_HEIGHT);
  });

  test('SRCH-032 a list with more entries than the limit is as long as the limit, and the notice stands after it', async ({ page, simulator }) => {
    await pretendToHaveEntries(page, 1_000_000);
    await showLongList(page, simulator);
    const heightOfRows = await page.getByTestId('task-list-rows').evaluate((element) => element.getBoundingClientRect().height);
    expect(heightOfRows).toBe((MAX_LIST_ENTRIES + 1) * ROW_HEIGHT);
  });
});

test.describe('a list with more entries than the limit', () => {
  test('SRCH-022 lists only as many entries as the limit, in the current sort, and counts the real total', async ({ page, simulator }) => {
    await pretendToHaveEntries(page, 1_000_000);
    await showLongList(page, simulator);
    await expect(page.getByTestId('toggle-count-tasks')).toHaveText('(1.000.000)');
    await expect(page.getByTestId('primary-filter-count-OpenTasksWithoutFollowUp')).toHaveText('(1.000.000)');

    await scrollInSteps(page, 'here', 'end', 2_000_000, 5);
    await waitForDataAtScrollPosition(page);
    const tops = await taskRows(page).evaluateAll((rows) => rows.map((row) => parseFloat((row as HTMLElement).style.top)));
    expect(Math.max(...tops)).toBe((MAX_LIST_ENTRIES - 1) * ROW_HEIGHT);
  });

  test('SRCH-023 only a capped list shows a notice row after its last entry, which cannot be selected or opened', async ({ page, simulator }) => {
    await showLongList(page, simulator);
    await expect(page.getByTestId('list-cap-notice')).toHaveCount(0);

    await pretendToHaveEntries(page, 1_000_000);
    await page.reload();
    await expect(taskRows(page).first()).toBeVisible();
    const notice = page.getByTestId('list-cap-notice');
    await scrollInSteps(page, 'here', 'end', 2_000_000, 5);
    await expect(notice).toBeVisible();
    await waitForDataAtScrollPosition(page);

    expect(await notice.innerText()).toBe(
      'Es werden nur die ersten 100.000 Einträge in der aktuellen Sortierung aufgelistet. Bitte grenzen Sie die Liste mit weiteren Kriterien ein.',
    );
    const geometry = await page.evaluate(() => {
      const noticeRow = document.querySelector<HTMLElement>('[data-testid=list-cap-notice]')!;
      const header = document.querySelector<HTMLElement>('[data-testid=task-list-header]')!;
      const lastRow = [...document.querySelectorAll<HTMLElement>('[data-testid=task-row]')].at(-1)!;
      return {
        noticeWidth: noticeRow.getBoundingClientRect().width,
        headerWidth: header.getBoundingClientRect().width,
        noticeTop: noticeRow.getBoundingClientRect().top,
        lastRowBottom: lastRow.getBoundingClientRect().bottom,
        userSelect: getComputedStyle(noticeRow).userSelect,
        checkboxes: noticeRow.querySelectorAll('input, a, button').length,
      };
    });
    expect(geometry.noticeWidth).toBe(geometry.headerWidth);
    expect(Math.abs(geometry.noticeTop - geometry.lastRowBottom)).toBeLessThanOrEqual(1);
    expect(geometry.userSelect).toBe('none');
    expect(geometry.checkboxes).toBe(0);

    const addressBefore = page.url();
    await notice.click();
    await notice.dblclick();
    expect(page.url()).toBe(addressBefore);
  });

  test('SRCH-024 every count above the limit shows the text of the notice on mouse-over, and no other count does', async ({ page, simulator }) => {
    await showLongList(page, simulator);
    await page.getByTestId('toggle-count-tasks').hover();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('count-above-limit-tooltip')).toHaveCount(0);

    await pretendToHaveEntries(page, 1_000_000);
    await page.reload();
    await expect(page.getByTestId('toggle-count-tasks')).toHaveText('(1.000.000)');
    const shownTooltip = page.locator('.v-overlay__content:visible', { hasText: /ersten 100\.000 Einträge in der aktuellen Sortierung/ });
    await page.getByTestId('toggle-count-tasks').hover();
    await expect(shownTooltip).toBeVisible();
    await page.mouse.move(600, 400);
    await expect(shownTooltip).toHaveCount(0);
    await page.getByTestId('primary-filter-count-OpenTasksWithoutFollowUp').hover();
    await expect(shownTooltip).toBeVisible();
  });
});

test.describe('how the code keeps the rules', () => {
  const source = (path: string) => readFileSync(new URL(`../../packages/ui/src/${path}`, import.meta.url), 'utf8');

  test('SRCH-030 the limit is one named constant in a file of its own that the list reads', async () => {
    expect(source('lists/max-list-entries.ts')).toContain('export const MAX_LIST_ENTRIES = 100_000;');
    expect(source('lists/use-task-list.ts')).toContain("from './max-list-entries'");
    for (const file of ['lists/use-task-list.ts', 'lists/page-window.ts', 'lists/list-constants.ts', 'components/TaskListPage.vue']) {
      expect(source(file)).not.toMatch(/100_?000/);
    }
  });

  test('SRCH-030 a request for a page goes into a queue, and the list closes it when it closes', async () => {
    const taskList = source('lists/use-task-list.ts');
    expect(taskList).toContain('createPageRequestQueue');
    expect(taskList).toMatch(/close\(\): void \{[\s\S]*queue\.close\(\)/);
    expect(source('components/TaskListPage.vue')).toMatch(/onBeforeUnmount\(\(\) => \{[\s\S]*taskList\.close\(\)/);
  });
});

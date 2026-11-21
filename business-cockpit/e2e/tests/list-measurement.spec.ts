import { existsSync } from 'node:fs';
import { firefox, type Page } from '@playwright/test';
import {
  jumpToShareOfScrollBar,
  LONG_FRAMES_ALLOWED,
  ListMeasurement,
  MEMORY_LIMIT_BYTES,
  scrollInSteps,
  startWatchingFrames,
  stopWatchingFrames,
  waitForDataAtScrollPosition,
} from '../support/list-measurement.ts';
import { pretendToHaveEntries } from '../support/many-entries.ts';
import { manyTasks } from '../support/tasks.ts';
import { expect, logInAs, test, type SimulatorControl } from '../support/test.ts';

// The walks through 30,000 tasks take minutes. Run them again with:
//   npx playwright test list-measurement
// The numbers of the measurement are written to e2e/measurements/.
test.setTimeout(900_000);

const THIRTY_THOUSAND = manyTasks(30_000);
const SCREEN_WITH_NO_LIST = '/faelle';
// A slow reader moves less than the window holds ahead (20 rows of 40 px) between two looks.
const SLOW_STEP_PX = 1200;
const WITHIN_TEN_PERCENT = 1.1;
const PRIMARY_FILTERS = ['OpenTasksWithFollowUp', 'OpenTasksWithoutFollowUp', 'OpenTaskOnlyFollowUp', 'ClosedTasksOnly'] as const;

const taskRows = (page: Page) => page.getByTestId('task-row');
const placeholders = (page: Page) => page.getByTestId('task-placeholder');

async function showLongList(page: Page, simulator: SimulatorControl, address = '/tasks') {
  await simulator.change({ tasks: THIRTY_THOUSAND });
  await logInAs(page, 'clerk', address);
  await expect(taskRows(page).first()).toBeVisible();
}

/** Scrolls with the mouse wheel a few rows at a time, the way a user reads, and watches the frames. */
async function scrollWithTheWheelFor(page: Page, milliseconds: number) {
  const area = (await page.getByTestId('task-list').boundingBox())!;
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
  await startWatchingFrames(page);
  const end = Date.now() + milliseconds;
  while (Date.now() < end) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(16);
  }
  return stopWatchingFrames(page);
}

async function expectSmoothWheelScrollingAndRecoveryAfterADrag(page: Page) {
  const watched = await scrollWithTheWheelFor(page, 10_000);
  console.log(`Wheel for ten seconds: ${watched.longFrames.length} frames longer than 50 ms ${JSON.stringify(watched.longFrames)}, ${watched.framesWithPlaceholder} frames with a placeholder`);
  expect(watched.longFrames.length).toBeLessThanOrEqual(LONG_FRAMES_ALLOWED);
  expect(watched.framesWithPlaceholder).toBe(0);

  await scrollInSteps(page, 'here', 'start', 60_000, 5);
  await scrollInSteps(page, 'here', 'end', 60_000, 5);
  await waitForDataAtScrollPosition(page);
  await expect.poll(() => placeholders(page).count(), { timeout: 3000 }).toBe(0);
}

test.describe.serial('the measurement of the task list over 30,000 tasks of four modules', () => {
  const measurement: { current?: ListMeasurement } = {};

  test('SRCH-031 scrolls slowly and fast to the end and back, jumps, leaves and comes back, and writes the numbers down', async ({ page, simulator }) => {
    await simulator.change({ tasks: THIRTY_THOUSAND });
    await logInAs(page, 'clerk', SCREEN_WITH_NO_LIST);
    const measured = (measurement.current = await ListMeasurement.start(page, simulator));
    await measured.read('before the list opened');

    await page.getByTestId('toggle-tasks').click();
    await expect(taskRows(page).first()).toBeVisible();
    await measured.read('list loaded');

    for (const cycle of [1, 2, 3]) {
      await scrollInSteps(page, 'here', 'end', SLOW_STEP_PX, 20);
      await scrollInSteps(page, 'here', 'start', SLOW_STEP_PX, 20);
      await measured.read(`slow, down and up, time ${cycle}`);
      await scrollInSteps(page, 'here', 'end', 60_000, 5);
      await scrollInSteps(page, 'here', 'start', 60_000, 5);
      await measured.read(`fast, down and up, time ${cycle}`);
    }

    for (const share of [0.37, 0.71, 0.12]) {
      await jumpToShareOfScrollBar(page, share);
      await measured.read(`jump to ${Math.round(share * 100)} %`);
    }

    for (const time of ['first', 'second']) {
      await page.getByTestId('toggle-workflows').click();
      await measured.read(`other screen, ${time} time`);
      await page.getByTestId('toggle-tasks').click();
      await expect(taskRows(page).first()).toBeVisible();
      await measured.read(`back at the list, ${time} time`);
    }
    await page.getByTestId('toggle-workflows').click();
    await measured.read('other screen, last time');

    measured.report('task-list-30000');
    for (const reading of measured.readings) expect(reading.emptyRowsAfter3Seconds, `empty rows after 3 seconds, ${reading.step}`).toBe(0);
    for (const field of ['heapBytes', 'domNodes', 'eventListeners'] as const) {
      expect(measured.readings.every((reading) => reading[field] > 0)).toBe(true);
    }
  });

  test('SRCH-017 scrolling the whole list down and up three times keeps heap and DOM nodes within 10 % of the first time', async () => {
    const readings = measurement.current!.readings;
    for (const kind of ['slow', 'fast']) {
      const times = [1, 2, 3].map((time) => readings.find((reading) => reading.step === `${kind}, down and up, time ${time}`)!);
      for (const later of times.slice(1)) {
        expect(later.heapBytes, `heap, ${later.step}`).toBeLessThanOrEqual(times[0].heapBytes * WITHIN_TEN_PERCENT);
        expect(later.domNodes, `DOM nodes, ${later.step}`).toBeLessThanOrEqual(times[0].domNodes * WITHIN_TEN_PERCENT);
      }
    }
  });

  test('SRCH-018 leaving the list gives back heap and DOM nodes, also when it opens and closes again', async () => {
    const readings = measurement.current!.readings;
    const at = (step: string) => readings.find((reading) => reading.step === step)!;
    const before = at('before the list opened');
    const afterFirst = at('other screen, first time');
    for (const step of ['other screen, first time', 'other screen, second time', 'other screen, last time']) {
      expect(at(step).domNodes, `DOM nodes, ${step}`).toBeLessThanOrEqual(before.domNodes * WITHIN_TEN_PERCENT);
      expect(at(step).eventListeners, `listeners, ${step}`).toBeLessThanOrEqual(before.eventListeners * WITHIN_TEN_PERCENT);
      // The heap of the first visit also holds the code the browser compiled for the list, a few MB that no
      // row owns. So the heap is compared with the first time the user left the list, and the repeats may not raise it.
      expect(at(step).heapBytes, `heap, ${step}`).toBeLessThanOrEqual(afterFirst.heapBytes * WITHIN_TEN_PERCENT);
    }
    expect(afterFirst.heapBytes - before.heapBytes, 'heap of the code of the list').toBeLessThan(5 * 1024 * 1024);
  });
});

test('SRCH-013 after scrolling from top to bottom through 30,000 tasks the heap is below the limit, for each primary filter', async ({ page, simulator }) => {
  await showLongList(page, simulator);
  const measured = await ListMeasurement.start(page, simulator);
  for (const filter of PRIMARY_FILTERS) {
    await page.getByTestId(`primary-filter-${filter}`).click();
    await scrollInSteps(page, 'here', 'end', SLOW_STEP_PX, 8);
    await waitForDataAtScrollPosition(page);
    await expect.poll(() => placeholders(page).count(), { timeout: 3000 }).toBe(0);
    const reading = await measured.read(`bottom of ${filter}`);
    expect(reading.heapBytes, `heap at the bottom of ${filter}`).toBeLessThan(MEMORY_LIMIT_BYTES);
    await scrollInSteps(page, 'here', 'start', 60_000, 5);
  }
  measured.report('task-list-heap-per-primary-filter');
});

test('SRCH-016 scrolling with the mouse wheel for ten seconds has few long frames and no placeholder; after a fast drag every placeholder gets its data', async ({ page, simulator }) => {
  await showLongList(page, simulator);
  await expectSmoothWheelScrollingAndRecoveryAfterADrag(page);
});

test.describe('with a total of 1,000,000 entries', () => {
  test('SRCH-025 the check of the wheel and the drag still passes', async ({ page, simulator }) => {
    await pretendToHaveEntries(page, 1_000_000);
    await showLongList(page, simulator);
    await expect(page.getByTestId('toggle-count-tasks')).toHaveText('(1.000.000)');
    await expectSmoothWheelScrollingAndRecoveryAfterADrag(page);
  });

  test('SRCH-025 the user can scroll to the notice row at the end of the list in Chromium', async ({ page, simulator }) => {
    await pretendToHaveEntries(page, 1_000_000);
    await showLongList(page, simulator);
    await scrollInSteps(page, 'here', 'end', 200_000, 5);
    await expect(page.getByTestId('list-cap-notice')).toBeInViewport();
  });

  test('SRCH-025 the user can scroll to the notice row at the end of the list in Firefox', async ({ simulator }) => {
    test.skip(!existsSync(firefox.executablePath()), 'Firefox is not installed here: run `npx playwright install firefox` and this test runs.');
    const browser = await firefox.launch();
    const page = await browser.newPage();
    try {
      await pretendToHaveEntries(page, 1_000_000);
      await showLongList(page, simulator);
      await scrollInSteps(page, 'here', 'end', 200_000, 5);
      await expect(page.getByTestId('list-cap-notice')).toBeInViewport();
    } finally {
      await browser.close();
    }
  });
});

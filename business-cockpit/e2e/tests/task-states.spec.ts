import type { Locator, Page } from '@playwright/test';
import type { UserTask } from '../../packages/ui/src/generated/official-gui-api/types.gen.ts';
import { expect, logInAs, test, type SimulatorControl } from '../support/test.ts';
import { aTask } from '../support/tasks.ts';

const rowOf = (page: Page, taskId: string) => page.locator(`[data-testid=task-row][data-task-id="${taskId}"]`);
const MOMENT = '2026-11-02T08:00:00Z';

const completed = aTask({ id: 'completed', endedAt: MOMENT, endReason: 'COMPLETED' });
const cancelled = aTask({ id: 'cancelled', endedAt: MOMENT, endReason: 'CANCELLED' });
const suspended = aTask({ id: 'suspended', suspendedAt: MOMENT });
const cancelledWhileSuspended = aTask({ id: 'cancelled-suspended', endedAt: MOMENT, endReason: 'CANCELLED', suspendedAt: MOMENT });
const active = aTask({ id: 'active' });

async function showList(page: Page, simulator: SimulatorControl, tasks: UserTask[], closedOnly = false) {
  await simulator.change({ tasks });
  await logInAs(page, 'clerk', '/tasks');
  await expect(page.getByTestId('task-list-page')).toBeVisible();
  if (closedOnly) await page.getByTestId('primary-filter-ClosedTasksOnly').click();
}

const style = (locator: Locator, property: string) => locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
const themeColor = (page: Page, token: string) =>
  page.evaluate((name) => {
    // Resolves the token the way the browser paints it.
    const probe = document.createElement('div');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, token);
const titleOf = (page: Page, taskId: string) => rowOf(page, taskId).getByTestId('task-title');

test.describe('closed and suspended tasks', () => {
  test('TL-022 closed tasks are listed and opened like open ones', async ({ page, simulator }) => {
    await showList(page, simulator, [active, completed, cancelled], true);
    await expect(page.getByTestId('task-row')).toHaveCount(2);
    for (const id of ['completed', 'cancelled']) {
      await titleOf(page, id).click();
      await expect(page).toHaveURL(new RegExp(`/aufgaben/${id}$`));
      await page.goBack();
      await expect(page.getByTestId('task-row')).toHaveCount(2);
    }
  });

  test('TL-022 a suspended task is listed with the open ones and opened', async ({ page, simulator }) => {
    await showList(page, simulator, [active, suspended]);
    await expect(page.getByTestId('task-row')).toHaveCount(2);
    await titleOf(page, 'suspended').click();
    await expect(page).toHaveURL(/\/aufgaben\/suspended$/);
  });
});

test.describe('the look of a row per state', () => {
  test('TL-023 an active row has normal background and text', async ({ page, simulator }) => {
    await showList(page, simulator, [active, completed]);
    const row = rowOf(page, 'active');
    await expect(row).toHaveAttribute('data-state', 'active');
    expect(await style(row, 'background-color')).toBe('rgba(0, 0, 0, 0)');
    expect(await style(row, 'text-decoration-line')).toBe('none');
  });

  test('TL-023 a completed row is grey with normal text and nothing struck through', async ({ page, simulator }) => {
    await showList(page, simulator, [active, completed], true);
    const row = rowOf(page, 'completed');
    await expect(row).toHaveAttribute('data-state', 'completed');
    expect(await style(row, 'background-color')).toBe(await themeColor(page, '--bc-color-row-ended'));
    expect(await style(row, 'color')).not.toBe(await themeColor(page, '--bc-color-text-suspended'));
    expect(await style(titleOf(page, 'completed'), 'text-decoration-line')).not.toBe('line-through');
  });

  test('TL-023 a cancelled row is grey and only its title is struck through', async ({ page, simulator }) => {
    await showList(page, simulator, [cancelled], true);
    const row = rowOf(page, 'cancelled');
    await expect(row).toHaveAttribute('data-state', 'cancelled');
    expect(await style(row, 'background-color')).toBe(await themeColor(page, '--bc-color-row-ended'));
    expect(await style(titleOf(page, 'cancelled'), 'text-decoration-line')).toBe('line-through');
    expect(await style(row.getByTestId('cell-caseKind'), 'text-decoration-line')).toBe('none');
  });

  test('TL-023 a suspended row has normal background and lighter text', async ({ page, simulator }) => {
    await showList(page, simulator, [active, suspended]);
    const row = rowOf(page, 'suspended');
    await expect(row).toHaveAttribute('data-state', 'suspended');
    expect(await style(row, 'background-color')).toBe('rgba(0, 0, 0, 0)');
    const lighter = await themeColor(page, '--bc-color-text-suspended');
    expect(await style(row, 'color')).toBe(lighter);
    expect(await style(titleOf(page, 'suspended'), 'color')).toBe(lighter);
    expect(await style(rowOf(page, 'active'), 'color')).not.toBe(lighter);
  });

  test('TL-023 endedAt decides before suspendedAt, so a task cancelled while suspended looks cancelled', async ({ page, simulator }) => {
    await showList(page, simulator, [cancelledWhileSuspended], true);
    const row = rowOf(page, 'cancelled-suspended');
    await expect(row).toHaveAttribute('data-state', 'cancelled');
    expect(await style(row, 'background-color')).toBe(await themeColor(page, '--bc-color-row-ended'));
    expect(await style(row, 'color')).not.toBe(await themeColor(page, '--bc-color-text-suspended'));
    expect(await style(titleOf(page, 'cancelled-suspended'), 'text-decoration-line')).toBe('line-through');
  });

  test('TL-023 the colours come from the tokens of the theme package', async ({ page, simulator }) => {
    await showList(page, simulator, [completed], true);
    const token = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bc-color-row-ended').trim());
    expect(token).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

import type { Page } from '@playwright/test';
import type { SearchQuery, UserTask } from '../../packages/ui/src/generated/official-gui-api/types.gen.ts';
import { expect, logInAs, test, type SimulatorControl } from '../support/test.ts';
import { aTask, clerkPerson, otherPerson } from '../support/tasks.ts';

const titlesShown = (page: Page) => page.getByTestId('task-title');
const searchInput = (page: Page) => page.getByTestId('search-input').locator('input');
const filterInput = (page: Page, column: string) => page.getByTestId(`filter-input-${column}`).locator('input');
const suggestions = (page: Page) => page.getByTestId('search-suggestion');

async function showList(page: Page, simulator: SimulatorControl, tasks: UserTask[], address = '/tasks') {
  await simulator.change({ tasks });
  await logInAs(page, 'clerk', address);
  await expect(page.getByTestId('task-list-page')).toBeVisible();
  await expect(page.getByTestId('list-loading')).toHaveCount(0);
}

const titled = (title: string, overrides: Partial<UserTask> = {}) =>
  aTask({ title: { de: title, en: title }, ...overrides });

interface ListBody {
  pageNumber: number;
  sort?: string;
  sortAscending?: boolean;
  searchQueries?: SearchQuery[];
}

/** The requests for pages of the list, and the suggestions, as the simulator saw them. */
async function pagesAsked(simulator: SimulatorControl) {
  return (await simulator.guiApiRequests())
    .filter((entry) => entry.method === 'POST' && /\/usertask$/.test(entry.path))
    .map((entry) => ({ body: entry.body as ListBody, query: new URLSearchParams(entry.query ?? '') }));
}

const suggestionsAsked = async (simulator: SimulatorControl) =>
  (await simulator.guiApiRequests()).filter((entry) => entry.method === 'OPTIONS');

const fewTasks = [
  titled('Bestellung prüfen', { id: 'a', dueDate: '2027-01-03T00:00:00Z', note: 'dringend' }),
  titled('Kredit bewerten', { id: 'b', dueDate: '2027-01-01T00:00:00Z', workflowTitle: { de: 'Kredit', en: 'Loan' }, assignee: otherPerson }),
  titled('Antrag erfassen', { id: 'c', dueDate: '2027-01-02T00:00:00Z', workflowTitle: { de: 'Antrag', en: 'Claim' }, assignee: clerkPerson }),
];

test.describe('the full-text search', () => {
  for (const address of ['/tasks', '/my-tasks']) {
    test(`SRCH-001 ${address} has a search with an x button that clears it`, async ({ page, simulator }) => {
      await showList(page, simulator, fewTasks.map((task) => ({ ...task, assignee: clerkPerson })), address);
      await expect(titlesShown(page)).toHaveCount(3);

      await searchInput(page).fill('Kredit');
      await searchInput(page).press('Enter');
      await expect(titlesShown(page)).toHaveText(['Kredit bewerten']);

      await page.getByTestId('search-clear').click();
      await expect(searchInput(page)).toHaveValue('');
      await expect(titlesShown(page)).toHaveCount(3);
    });
  }

  test('SRCH-002 asks for suggestions once, 300 ms after the last key, and only from three characters on', async ({ page, simulator }) => {
    await showList(page, simulator, fewTasks);

    await searchInput(page).pressSequentially('Be', { delay: 20 });
    await page.waitForTimeout(600);
    expect(await suggestionsAsked(simulator)).toHaveLength(0);

    const typedAt = Date.now();
    await searchInput(page).pressSequentially('stel', { delay: 20 });
    await page.waitForTimeout(150);
    expect(await suggestionsAsked(simulator)).toHaveLength(0);
    await expect(suggestions(page).first()).toBeVisible();
    expect(Date.now() - typedAt).toBeGreaterThanOrEqual(300);

    const asked = await suggestionsAsked(simulator);
    expect(asked).toHaveLength(1);
    expect(new URLSearchParams(asked[0].query).get('query')).toBe('Bestel');
    await expect(suggestions(page)).toHaveText(['Bestellung']);
  });

  test('SRCH-003 shows at most 20 suggestions, the most frequent first, in the order of the server', async ({ page, simulator }) => {
    const manyWords = Array.from({ length: 25 }, (_, index) => `Wort${String(index).padStart(2, '0')}`);
    const tasks = [
      ...manyWords.map((word) => titled(`${word} zu prüfen`)),
      titled('Wort24 nochmal'),
      titled('Wort24 und wieder'),
      titled('Wort23 nochmal'),
    ];
    await showList(page, simulator, tasks);

    await searchInput(page).fill('wort');
    await expect(suggestions(page)).toHaveCount(20);
    const shown = await suggestions(page).allTextContents();
    expect(shown.slice(0, 2)).toEqual(['Wort24', 'Wort23']);
    expect(shown.slice(2)).toEqual(manyWords.filter((word) => word !== 'Wort24' && word !== 'Wort23').slice(0, 18));
  });

  test('SRCH-004 sends the input as typed and finds only rows with that character', async ({ page, simulator }) => {
    await showList(page, simulator, [titled('Plan a.b'), titled('Plan axb'), titled('Plan (zwei)'), titled('Plan zwei')]);

    await searchInput(page).fill('a.b');
    await searchInput(page).press('Enter');
    await expect(titlesShown(page)).toHaveText(['Plan a.b']);

    await searchInput(page).fill('(');
    await searchInput(page).press('Enter');
    await expect(titlesShown(page)).toHaveText(['Plan (zwei)']);

    const asked = (await pagesAsked(simulator)).map((page) => page.body.searchQueries?.[0]?.query);
    expect(asked.slice(-2)).toEqual(['a.b', '(']);
  });

  test('SRCH-026 ignores upper and lower case, and a click takes a suggestion while Enter takes the input', async ({ page, simulator }) => {
    await showList(page, simulator, fewTasks);

    await searchInput(page).fill('BESTELLUNG');
    await searchInput(page).press('Enter');
    await expect(titlesShown(page)).toHaveText(['Bestellung prüfen']);
    const last = (await pagesAsked(simulator)).at(-1)!;
    expect(last.body.searchQueries).toEqual([{ query: 'BESTELLUNG', caseInsensitive: true }]);

    await page.getByTestId('search-clear').click();
    await searchInput(page).fill('kred');
    await suggestions(page).filter({ hasText: 'Kredit' }).first().click();
    await expect(searchInput(page)).toHaveValue('Kredit');
    await expect(titlesShown(page)).toHaveText(['Kredit bewerten']);
    await expect(suggestions(page)).toHaveCount(0);

    await searchInput(page).fill('anträ');
    await searchInput(page).press('Enter');
    await expect(titlesShown(page)).toHaveCount(0);
    await expect(suggestions(page)).toHaveCount(0);
  });
});

test.describe('filters per column', () => {
  async function setFilter(page: Page, column: string, term: string) {
    await page.getByTestId(`filter-button-${column}`).click();
    await filterInput(page, column).fill(term);
    await filterInput(page, column).press('Enter');
    // The menu fades out. Until it is gone, the next click would meet the old one.
    await expect(filterInput(page, column)).toHaveCount(0);
  }

  test('SRCH-005 a filter is set and removed per column and only one filter per path is sent', async ({ page, simulator }) => {
    await showList(page, simulator, fewTasks);

    await setFilter(page, 'title', 'e');
    await expect(titlesShown(page)).toHaveCount(3);
    await setFilter(page, 'title', 'kredit');
    await expect(titlesShown(page)).toHaveText(['Kredit bewerten']);
    await setFilter(page, 'note', 'dring');
    await expect(titlesShown(page)).toHaveCount(0);

    const last = (await pagesAsked(simulator)).at(-1)!;
    expect(last.body.searchQueries).toEqual([
      { path: 'title', query: 'kredit', caseInsensitive: true },
      { path: 'note', query: 'dring', caseInsensitive: true },
    ]);
    // No request ever carries two entries for one path.
    for (const asked of await pagesAsked(simulator)) {
      const paths = (asked.body.searchQueries ?? []).map((search) => search.path);
      expect(new Set(paths).size).toBe(paths.length);
    }

    await page.getByTestId('filter-button-note').click();
    await page.getByTestId('filter-clear-note').click();
    await expect(titlesShown(page)).toHaveText(['Kredit bewerten']);
    await expect(page.getByTestId('filter-button-note')).toHaveAttribute('data-active', 'false');
    await expect(page.getByTestId('filter-button-title')).toHaveAttribute('data-active', 'true');
  });

  test('SRCH-006 the reset button removes the search and every filter', async ({ page, simulator }) => {
    await showList(page, simulator, fewTasks);
    await expect(page.getByTestId('reset-search')).toBeDisabled();

    await searchInput(page).fill('Kredit');
    await searchInput(page).press('Enter');
    await setFilter(page, 'title', 'bewerten');
    await expect(titlesShown(page)).toHaveCount(1);

    await page.getByTestId('reset-search').click();
    await expect(titlesShown(page)).toHaveCount(3);
    await expect(searchInput(page)).toHaveValue('');
    await expect(page.getByTestId('filter-button-title')).toHaveAttribute('data-active', 'false');
    await expect(page.getByTestId('reset-search')).toBeDisabled();
    expect((await pagesAsked(simulator)).at(-1)!.body.searchQueries).toBeUndefined();
  });

  test('SRCH-009 only a column with sortable offers sorting and only one with filterable offers a filter', async ({ page, simulator }) => {
    await showList(page, simulator, fewTasks);

    for (const column of ['caseKind', 'title', 'note', 'assignee']) {
      await expect(page.getByTestId(`sort-${column}`)).toBeVisible();
      await expect(page.getByTestId(`filter-button-${column}`)).toBeVisible();
    }
    // Sortable, but a date is not searched by text.
    await expect(page.getByTestId('sort-dueDate')).toBeVisible();
    await expect(page.getByTestId('filter-button-dueDate')).toHaveCount(0);
    // The icon column offers neither.
    await expect(page.getByTestId('sort-candidateUsers')).toHaveCount(0);
    await expect(page.getByTestId('filter-button-candidateUsers')).toHaveCount(0);
  });
});

test.describe('sorting', () => {
  async function rowIds(page: Page) {
    return page.getByTestId('task-row').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-task-id')));
  }

  test('SRCH-007 a click sorts, a second click turns the direction, a third goes back to the default', async ({ page, simulator }) => {
    await showList(page, simulator, fewTasks);
    // The default order of the list is the due date.
    expect(await rowIds(page)).toEqual(['b', 'c', 'a']);

    await page.getByTestId('sort-title').click();
    await expect(page.getByTestId('sort-mark-title')).toBeVisible();
    await expect.poll(() => rowIds(page)).toEqual(['c', 'a', 'b']);
    await page.getByTestId('sort-title').click();
    await expect.poll(() => rowIds(page)).toEqual(['b', 'a', 'c']);
    await page.getByTestId('sort-title').click();
    await expect.poll(() => rowIds(page)).toEqual(['b', 'c', 'a']);
    await expect(page.getByTestId('sort-mark-title')).toHaveCount(0);

    const sorts = (await pagesAsked(simulator)).map((asked) => [asked.body.sort, asked.body.sortAscending]);
    expect(sorts).toEqual([[undefined, undefined], ['title', true], ['title', false], [undefined, undefined]]);
  });

  test('SRCH-008 a text of many languages sorts by the language of the user and a person by name and id', async ({ page, simulator }) => {
    await showList(page, simulator, fewTasks);

    await page.getByTestId('sort-caseKind').click();
    await expect.poll(() => rowIds(page)).toEqual(['c', 'a', 'b']);
    await page.getByTestId('sort-assignee').click();
    await expect.poll(() => rowIds(page)).toEqual(['a', 'c', 'b']);

    const sorts = (await pagesAsked(simulator)).map((asked) => asked.body.sort);
    expect(sorts).toEqual([undefined, 'workflowTitle.de', 'assignee.sort,assignee.id']);
  });

  test('SRCH-027 a new sort or search starts the list again at the top with a new start timestamp', async ({ page, simulator }) => {
    const fortyFive = Array.from({ length: 45 }, (_, index) =>
      titled(`Aufgabe ${String(index).padStart(2, '0')}`, { id: `t-${String(index).padStart(2, '0')}`, dueDate: `2027-01-01T00:${String(index).padStart(2, '0')}:00Z` }),
    );
    await page.setViewportSize({ width: 1400, height: 1200 });
    await showList(page, simulator, fortyFive);
    await expect(page.locator('[data-task-id=t-30]')).toBeVisible();

    await page.getByTestId('task-list').evaluate((element) => (element.scrollTop = 300));
    await page.getByTestId('sort-title').click();
    await expect(page.getByTestId('sort-mark-title')).toBeVisible();
    await expect.poll(() => page.getByTestId('task-list').evaluate((element) => element.scrollTop)).toBe(0);
    await expect(page.locator('[data-task-id=t-30]')).toBeVisible();

    await searchInput(page).fill('Aufgabe 1');
    await searchInput(page).press('Enter');
    await expect(titlesShown(page)).toHaveCount(10);

    const asked = await pagesAsked(simulator);
    const starts = asked.filter((entry) => entry.body.pageNumber === 0);
    // A new start asks without a timestamp, and the pages after it carry the one the server gave.
    expect(starts.length).toBe(3);
    for (const start of starts) expect(start.query.get('initialTimestamp')).toBeNull();
    const stamps = asked.map((entry) => entry.query.get('initialTimestamp')).filter((stamp) => stamp !== null);
    expect(new Set(stamps).size).toBeGreaterThanOrEqual(2);
  });
});

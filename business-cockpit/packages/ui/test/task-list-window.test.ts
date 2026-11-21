import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserTask, UserTasks } from '../src/generated/official-gui-api/types.gen';
import { FIREFOX_MAX_ELEMENT_HEIGHT_PX, ROW_HEIGHT_PX } from '../src/lists/list-constants';
import { MAX_LIST_ENTRIES } from '../src/lists/max-list-entries';
import { useTaskList, type TaskListOptions } from '../src/lists/use-task-list';

const PAGE_SIZE = 20;

/** A server that counts the pages it was asked for and answers each one at once. */
function aServer(totalElements: number, pageSize = PAGE_SIZE) {
  const asked: { pageNumber: number; initialTimestamp: string | undefined }[] = [];
  const loadPage: TaskListOptions['loadPage'] = async (_list, _filter, pageNumber, initialTimestamp) => {
    asked.push({ pageNumber, initialTimestamp });
    const first = pageNumber * pageSize;
    const count = Math.max(0, Math.min(pageSize, totalElements - first));
    const userTasks = Array.from({ length: count }, (_, offset) => ({ id: `task-${first + offset}` }) as UserTask);
    return {
      serverTimestamp: '2026-11-21T10:00:00Z',
      page: { number: pageNumber, size: pageSize, totalElements, totalPages: Math.ceil(totalElements / pageSize) },
      userTasks,
    } as UserTasks;
  };
  return { asked, loadPage, pagesAsked: () => asked.map((request) => request.pageNumber) };
}

const letRequestsRun = () => vi.advanceTimersByTimeAsync(0);
const loadedRows = (list: ReturnType<typeof useTaskList>) => list.rowsToDraw.value.filter((row) => row.task).map((row) => row.index);
const placeholders = (list: ReturnType<typeof useTaskList>) => list.rowsToDraw.value.filter((row) => !row.task).length;

async function anOpenList(server: ReturnType<typeof aServer>, overrides: Partial<TaskListOptions> = {}) {
  const list = useTaskList('tasks', { pageSize: PAGE_SIZE, loadPage: server.loadPage, maxRequestsAtOnce: 2, ...overrides });
  list.showWith('OpenTasksWithoutFollowUp');
  await letRequestsRun();
  return list;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SRCH-029 loading pages', () => {
  it('loads every page asked for in a burst, although only two requests run at once', async () => {
    const server = aServer(1000);
    const list = await anOpenList(server);
    list.showRows({ first: 0, last: 75 });
    await letRequestsRun();
    expect(server.pagesAsked().sort()).toEqual([0, 1, 2, 3, 4]);
    expect(loadedRows(list)).toHaveLength(5 * PAGE_SIZE);
    expect(placeholders(list)).toBe(0);
  });

  it('asks for a page once while it is on its way and once while it is in the window', async () => {
    const server = aServer(1000);
    const list = await anOpenList(server);
    for (const first of [0, 5, 10, 15, 20, 25, 30]) list.showRows({ first, last: first + 12 });
    for (const first of [30, 29, 28, 30]) list.showRows({ first, last: first + 12 });
    await letRequestsRun();
    const asked = server.pagesAsked();
    expect(new Set(asked).size).toBe(asked.length);
  });

  it('asks again for a page that left the window and came back', async () => {
    const server = aServer(1000);
    const list = await anOpenList(server);
    list.showRows({ first: 40, last: 52 });
    await letRequestsRun();
    list.showRows({ first: 0, last: 12 });
    await vi.advanceTimersByTimeAsync(150);
    expect(server.pagesAsked().filter((page) => page === 0)).toHaveLength(2);
  });

  it('does not start a request when a page that is not the first one arrives', async () => {
    const server = aServer(1000);
    const list = await anOpenList(server);
    list.showRows({ first: 0, last: 12 });
    await letRequestsRun();
    const askedWhenSettled = server.asked.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(server.asked).toHaveLength(askedWhenSettled);
  });

  it('SRCH-011 every request after the first sends the timestamp of the first answer', async () => {
    const server = aServer(1000);
    const list = await anOpenList(server);
    list.showRows({ first: 0, last: 60 });
    await letRequestsRun();
    expect(server.asked[0].initialTimestamp).toBeUndefined();
    expect(server.asked.slice(1).every((request) => request.initialTimestamp === '2026-11-21T10:00:00Z')).toBe(true);
    expect(server.asked.length).toBeGreaterThan(2);
  });
});

describe('SRCH-029 fast scrolling', () => {
  it('loads only the pages of the range drawn after the pause, not the ones the scrolling passed', async () => {
    const server = aServer(30_000);
    const list = await anOpenList(server);
    server.asked.length = 0;

    for (let step = 1; step <= 40; step++) {
      list.showRows({ first: step * 700, last: step * 700 + 12 });
      await vi.advanceTimersByTimeAsync(10);
    }
    expect(server.asked).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(150);
    const stopsAtPage = Math.floor(28_000 / PAGE_SIZE);
    expect(server.pagesAsked().sort((first, second) => first - second)).toEqual([stopsAtPage - 1, stopsAtPage, stopsAtPage + 1]);
  });

  it('loads the page ahead at once when the range only moves next to the window', async () => {
    const server = aServer(30_000);
    const list = await anOpenList(server);
    list.showRows({ first: 30, last: 42 });
    await letRequestsRun();
    expect(server.pagesAsked()).toContain(3);
  });

  it('drops the pages far from the window and keeps the memory of the window only', async () => {
    const server = aServer(30_000);
    const list = await anOpenList(server);
    list.showRows({ first: 15_000, last: 15_012 });
    await vi.advanceTimersByTimeAsync(150);
    expect(loadedRows(list).every((index) => index >= 14_980 && index < 15_060)).toBe(true);
  });

  it('holds more pages for a taller area', async () => {
    const shortArea = await anOpenList(aServer(30_000));
    shortArea.showRows({ first: 0, last: 11 });
    await letRequestsRun();
    const tallArea = await anOpenList(aServer(30_000));
    tallArea.showRows({ first: 0, last: 29 });
    await letRequestsRun();
    expect(loadedRows(tallArea).length).toBeGreaterThan(loadedRows(shortArea).length);
  });
});

describe('SRCH-029 opening and closing', () => {
  it('opening the list twice leaves one list: the answers of the first opening are not used', async () => {
    const server = aServer(1000);
    const list = useTaskList('tasks', { pageSize: PAGE_SIZE, loadPage: server.loadPage });
    list.showWith('OpenTasksWithoutFollowUp');
    list.showWith('ClosedTasksOnly');
    await letRequestsRun();
    expect(list.filter.value).toBe('ClosedTasksOnly');
    // The page the user sees and one page ahead, once. The first opening adds nothing on top.
    expect(loadedRows(list)).toHaveLength(2 * PAGE_SIZE);
    expect(new Set(loadedRows(list)).size).toBe(2 * PAGE_SIZE);
  });

  it('closing frees the rows and starts no request any more', async () => {
    const server = aServer(1000);
    const list = await anOpenList(server);
    list.showRows({ first: 0, last: 50 });
    list.close();
    await vi.advanceTimersByTimeAsync(1000);
    expect(list.rowsToDraw.value.filter((row) => row.task)).toHaveLength(0);
    const askedAfterClosing = server.asked.length;
    list.showRows({ first: 500, last: 520 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(server.asked).toHaveLength(askedAfterClosing);
  });
});

describe('SRCH-029 the longest list', () => {
  it('is not longer than the limit, shows the real total and cuts the page that crosses the limit', async () => {
    const server = aServer(130);
    const list = await anOpenList(server, { maxEntries: 50 });
    list.showRows({ first: 0, last: 100 });
    await letRequestsRun();
    expect(list.length.value).toBe(50);
    expect(list.totalElements.value).toBe(130);
    expect(Math.max(...loadedRows(list))).toBe(49);
    expect(server.pagesAsked()).not.toContain(3);
  });

  it('keeps the rows a live update added above the limit when the next page loads', async () => {
    const server = aServer(130);
    const list = await anOpenList(server, { maxEntries: 50 });
    list.showRows({ first: 0, last: 12 });
    await letRequestsRun();
    list.addLiveRowAbove({ id: 'live' } as UserTask);
    list.showRows({ first: 36, last: 51 });
    await letRequestsRun();
    expect(list.length.value).toBe(51);
    expect(list.rowsToDraw.value[0].task?.id).toBe('live');
    expect(list.rowsToDraw.value.at(-1)?.index).toBe(50);
  });

  it('knows a capped list only above the limit, and the count is exact below it', async () => {
    const below = await anOpenList(aServer(50), { maxEntries: 50 });
    const above = await anOpenList(aServer(51), { maxEntries: 50 });
    expect(below.isCapped.value).toBe(false);
    expect(below.length.value).toBe(50);
    expect(above.isCapped.value).toBe(true);
  });
});

describe('SRCH-030 and SRCH-032 the limit', () => {
  it('is 100,000 and small enough that Firefox can draw the list', () => {
    expect(MAX_LIST_ENTRIES).toBe(100_000);
    expect((MAX_LIST_ENTRIES + 1) * ROW_HEIGHT_PX).toBeLessThan(FIREFOX_MAX_ELEMENT_HEIGHT_PX);
  });
});

import { mkdirSync, writeFileSync } from 'node:fs';
import type { CDPSession, Page } from '@playwright/test';
import type { SimulatorControl } from './test.ts';

/** The most the JavaScript heap may use after the walk through the list (Q-MEMORY-LIMIT). */
export const MEMORY_LIMIT_BYTES = 150 * 1024 * 1024;

/** How many frames may take longer than this while the user scrolls with the mouse wheel. */
export const LONG_FRAME_MS = 50;
export const LONG_FRAMES_ALLOWED = 5;

export interface Reading {
  step: string;
  heapBytes: number;
  domNodes: number;
  eventListeners: number;
  /** The pages the list asked for since the start, one number per request. */
  pagesAsked: number[];
  emptyRowsRightAway: number;
  emptyRowsAfter3Seconds: number;
}

const placeholders = (page: Page) => page.getByTestId('task-placeholder').count();

/** Only the placeholders the user can see count: the ones in the window outside the screen are fine. */
export function countVisiblePlaceholders(page: Page): Promise<number> {
  return page.evaluate(() => {
    const area = document.querySelector<HTMLElement>('[data-testid=task-list]')!;
    const top = area.scrollTop + 40;
    const bottom = area.scrollTop + area.clientHeight;
    return [...document.querySelectorAll<HTMLElement>('[data-testid=task-placeholder]')].filter((placeholder) => {
      const rowTop = parseFloat(placeholder.style.top) + 40;
      return rowTop + 40 > top && rowTop < bottom;
    }).length;
  });
}

/**
 * Reads the memory the way the checklist asks for it: after a forced garbage collection, through
 * the Chrome DevTools Protocol, which Chromium offers only. The readings are kept in a list and
 * written to a file when the measurement ends, so anyone can look at them after a run.
 */
export class ListMeasurement {
  readonly readings: Reading[] = [];
  readonly #session: CDPSession;
  readonly #page: Page;
  readonly #simulator: SimulatorControl;

  private constructor(page: Page, session: CDPSession, simulator: SimulatorControl) {
    this.#page = page;
    this.#session = session;
    this.#simulator = simulator;
  }

  static async start(page: Page, simulator: SimulatorControl): Promise<ListMeasurement> {
    const session = await page.context().newCDPSession(page);
    await session.send('Runtime.enable');
    await session.send('HeapProfiler.enable');
    return new ListMeasurement(page, session, simulator);
  }

  async forceGarbageCollection(): Promise<void> {
    // Twice, because objects freed by the first run may hold others that the second run frees.
    await this.#session.send('HeapProfiler.collectGarbage');
    await this.#session.send('HeapProfiler.collectGarbage');
  }

  async heapAndDom(): Promise<Pick<Reading, 'heapBytes' | 'domNodes' | 'eventListeners'>> {
    await this.forceGarbageCollection();
    const heap = await this.#session.send('Runtime.getHeapUsage');
    const counters = (await this.#session.send('Memory.getDOMCounters' as never)) as { nodes: number; jsEventListeners: number };
    return { heapBytes: heap.usedSize, domNodes: counters.nodes, eventListeners: counters.jsEventListeners };
  }

  async pagesAsked(): Promise<number[]> {
    const requests = await this.#simulator.guiApiRequests();
    return requests
      .filter((entry) => /\/usertask$/.test(entry.path))
      .map((entry) => (entry.body as { pageNumber?: number }).pageNumber ?? 0);
  }

  /** Writes down heap, DOM nodes, listeners, the pages asked for so far, and the empty rows now and 3 seconds later. */
  async read(step: string): Promise<Reading> {
    const emptyRowsRightAway = await placeholders(this.#page);
    await this.#page.waitForTimeout(3000);
    const emptyRowsAfter3Seconds = await placeholders(this.#page);
    const reading: Reading = {
      step,
      ...(await this.heapAndDom()),
      pagesAsked: await this.pagesAsked(),
      emptyRowsRightAway,
      emptyRowsAfter3Seconds,
    };
    this.readings.push(reading);
    return reading;
  }

  /** The table of the readings in the output of the test run, and the file e2e/measurements/<name>.json. */
  report(name: string): void {
    const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
    console.log(`\nMeasurement ${name}`);
    console.table(
      this.readings.map((reading) => ({
        step: reading.step,
        'heap MB': megabytes(reading.heapBytes),
        'DOM nodes': reading.domNodes,
        listeners: reading.eventListeners,
        requests: reading.pagesAsked.length,
        'empty now': reading.emptyRowsRightAway,
        'empty after 3 s': reading.emptyRowsAfter3Seconds,
      })),
    );
    mkdirSync('e2e/measurements', { recursive: true });
    writeFileSync(
      `e2e/measurements/${name}.json`,
      JSON.stringify(this.readings.map((reading) => ({ ...reading, pagesAsked: reading.pagesAsked.length })), null, 2),
    );
  }
}

/** Frames that took longer than 50 ms, counted by the browser, and the frames that showed a placeholder. */
export async function startWatchingFrames(page: Page): Promise<void> {
  await page.evaluate((longFrameMs) => {
    const watch = { longFrames: [] as number[], framesWithPlaceholder: 0, isRunning: true };
    (window as unknown as { frameWatch: typeof watch }).frameWatch = watch;
    new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) if (entry.duration > longFrameMs) watch.longFrames.push(Math.round(entry.duration));
    }).observe({ type: 'long-animation-frame', buffered: false });
    const area = document.querySelector<HTMLElement>('[data-testid=task-list]')!;
    const lookForPlaceholders = () => {
      const top = area.scrollTop + 40;
      const bottom = area.scrollTop + area.clientHeight;
      const isVisible = (placeholder: HTMLElement) => {
        const rowTop = parseFloat(placeholder.style.top) + 40;
        return rowTop + 40 > top && rowTop < bottom;
      };
      if ([...document.querySelectorAll<HTMLElement>('[data-testid=task-placeholder]')].some(isVisible)) watch.framesWithPlaceholder++;
      if (watch.isRunning) requestAnimationFrame(lookForPlaceholders);
    };
    requestAnimationFrame(lookForPlaceholders);
  }, LONG_FRAME_MS);
}

export async function stopWatchingFrames(page: Page): Promise<{ longFrames: number[]; framesWithPlaceholder: number }> {
  return page.evaluate(() => {
    const watch = (window as unknown as { frameWatch: { longFrames: number[]; framesWithPlaceholder: number; isRunning: boolean } }).frameWatch;
    watch.isRunning = false;
    return { longFrames: watch.longFrames, framesWithPlaceholder: watch.framesWithPlaceholder };
  });
}

/** Scrolls the list in steps, one step per frame pause, the way a slow reader or a fast one moves. */
export function scrollInSteps(page: Page, fromRow: number | 'here', toRow: number | 'end' | 'start', stepPx: number, pauseMs: number): Promise<void> {
  return page.evaluate(
    async ({ fromRow, toRow, stepPx, pauseMs }) => {
      const area = document.querySelector<HTMLElement>('[data-testid=task-list]')!;
      const maxTop = area.scrollHeight - area.clientHeight;
      const target = toRow === 'end' ? maxTop : toRow === 'start' ? 0 : Math.min(maxTop, toRow * 40);
      if (fromRow !== 'here') area.scrollTop = fromRow * 40;
      const direction = target >= area.scrollTop ? 1 : -1;
      while ((target - area.scrollTop) * direction > 0) {
        area.scrollTop = direction > 0 ? Math.min(target, area.scrollTop + stepPx) : Math.max(target, area.scrollTop - stepPx);
        await new Promise((resolve) => setTimeout(resolve, pauseMs));
      }
    },
    { fromRow, toRow, stepPx, pauseMs },
  );
}

export function jumpToShareOfScrollBar(page: Page, share: number): Promise<void> {
  return page.evaluate((share) => {
    const area = document.querySelector<HTMLElement>('[data-testid=task-list]')!;
    area.scrollTop = share * (area.scrollHeight - area.clientHeight);
  }, share);
}

/** Waits until the row at the top of the visible area has its data. A jump is handled a moment after it happened. */
export async function waitForDataAtScrollPosition(page: Page, timeoutMs = 3000): Promise<void> {
  await page.waitForFunction(
    () => {
      const area = document.querySelector<HTMLElement>('[data-testid=task-list]')!;
      const firstRowInView = Math.floor(area.scrollTop / 40) * 40;
      return [...document.querySelectorAll<HTMLElement>('[data-testid=task-row]')].some((row) => parseFloat(row.style.top) === firstRowInView);
    },
    undefined,
    { timeout: timeoutMs },
  );
}

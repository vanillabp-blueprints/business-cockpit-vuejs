/** One page of a list. The key says which page of which start of the list it is, so a stale request never blocks a new one. */
export interface PageRequest<Page> {
  key: string;
  load: () => Promise<Page>;
  onLoaded: (page: Page) => void;
  onFailed: (failure: unknown) => void;
}

/**
 * A request for a page is an event, not a state. The queue keeps every request until it runs, so
 * none gets lost when the user scrolls fast, and it runs only a few at a time, see
 * MAX_PAGE_REQUESTS_AT_ONCE. A request with a key that is already queued or running is ignored.
 */
export function createPageRequestQueue<Page>(maxAtOnce: number) {
  const waiting: PageRequest<Page>[] = [];
  const running = new Set<string>();
  let isClosed = false;

  function startWaitingRequests(): void {
    while (!isClosed && running.size < maxAtOnce && waiting.length > 0) {
      const request = waiting.shift()!;
      running.add(request.key);
      request.load().then(
        (page) => finish(request, () => request.onLoaded(page)),
        (failure: unknown) => finish(request, () => request.onFailed(failure)),
      );
    }
  }

  function finish(request: PageRequest<Page>, tellTheList: () => void): void {
    running.delete(request.key);
    // An answer that comes after the list was closed belongs to nobody.
    if (!isClosed) tellTheList();
    startWaitingRequests();
  }

  return {
    ask(request: PageRequest<Page>): void {
      const isKnown = running.has(request.key) || waiting.some((queued) => queued.key === request.key);
      if (isKnown || isClosed) return;
      waiting.push(request);
      startWaitingRequests();
    },

    /** Drops the requests that did not start. Used when the list starts again with other filters. */
    dropWaitingRequests(): void {
      waiting.length = 0;
    },

    isBusy: (): boolean => running.size > 0 || waiting.length > 0,

    /** After closing, nothing starts and no answer is passed on. */
    close(): void {
      isClosed = true;
      waiting.length = 0;
    },
  };
}

/** How many rows one page of a list loads. */
export const PAGE_SIZE = 20;

/**
 * The browser opens six connections per host. A list uses at most this many of them, so the answers
 * the user waits for are not stuck behind requests for pages nobody looks at any more.
 */
export const MAX_PAGE_REQUESTS_AT_ONCE = 2;

/** Every row has this height, so the list knows where a row stands without drawing it. */
export const ROW_HEIGHT_PX = 40;

/** The next page is asked for when the user is this close to the end of the loaded rows. */
export const LOAD_NEXT_PAGE_MARGIN_PX = ROW_HEIGHT_PX * 5;

/** The list shows at most this many rows, however many the server counts. */
export const MAX_LIST_ENTRIES = 100_000;

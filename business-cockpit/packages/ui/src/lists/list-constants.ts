/** How many rows one page of a list loads. */
export const PAGE_SIZE = 20;

/**
 * The browser opens six connections per host. A list uses at most this many of them, so the answers
 * the user waits for are not stuck behind requests for pages nobody looks at any more.
 */
export const MAX_PAGE_REQUESTS_AT_ONCE = 2;

/** Every row has this height, so the list knows where a row stands without drawing it. */
export const ROW_HEIGHT_PX = 40;

/** The header stays at the top of the list and covers this much of the scrolled area. */
export const HEADER_HEIGHT_PX = 40;

/** The window holds this many pages above and below the pages the user sees. */
export const PAGES_AHEAD = 1;

/**
 * After a jump or a drag of the scroll bar, the list waits until the scrolling pauses this long
 * before it asks for pages. Otherwise one drag to the end asks for every page it passes.
 */
export const PAUSE_BEFORE_LOADING_MS = 100;

/** Firefox stops drawing an element taller than this, so the list must be shorter. */
export const FIREFOX_MAX_ELEMENT_HEIGHT_PX = 17_900_000;

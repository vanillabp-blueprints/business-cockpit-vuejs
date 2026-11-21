/**
 * The list shows at most this many rows, however many the server counts (Q-MAX-LIST-ENTRIES).
 * Browsers limit the height of an element. Firefox stops at about 17.9 million pixels, so the
 * limit times the row height must stay below that, see the unit test of the lists.
 */
export const MAX_LIST_ENTRIES = 100_000;

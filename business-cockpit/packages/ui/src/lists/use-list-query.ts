import { ref } from 'vue';
import { EMPTY_LIST_QUERY, sortAfterClickOn, type ListQuery } from './list-query';

/**
 * What the user typed and clicked to narrow and order one list. Every change replaces the whole
 * query, so a watcher sees one change per action and the list loads again once.
 */
export function useListQuery() {
  const query = ref<ListQuery>(EMPTY_LIST_QUERY);

  return {
    query,

    searchFor(fullText: string): void {
      if (fullText !== query.value.fullText) query.value = { ...query.value, fullText };
    },

    /** An empty term removes the filter of the column. The filters of other columns stay. */
    filterColumn(columnKey: string, term: string): void {
      if (term === (query.value.filterOfColumn[columnKey] ?? '')) return;
      const filterOfColumn = { ...query.value.filterOfColumn };
      if (term === '') delete filterOfColumn[columnKey];
      else filterOfColumn[columnKey] = term;
      query.value = { ...query.value, filterOfColumn };
    },

    sortBy(columnKey: string): void {
      query.value = { ...query.value, sort: sortAfterClickOn(columnKey, query.value.sort) };
    },

    /** Removes every search and every filter. The sort is no search, so it stays. */
    resetSearchAndFilters(): void {
      query.value = { ...query.value, fullText: '', filterOfColumn: {} };
    },
  };
}

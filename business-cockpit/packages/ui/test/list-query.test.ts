import { describe, expect, it, vi } from 'vitest';
import { EMPTY_LIST_QUERY, requestPartOf, sortAfterClickOn, type ListQuery } from '../src/lists/list-query';
import { createSuggestionSource } from '../src/lists/suggestion-source';
import { columnsShownFor, TASK_COLUMNS } from '../src/lists/task-columns';

const columns = columnsShownFor('ClosedTasksOnly');
const queryWith = (changes: Partial<ListQuery>): ListQuery => ({ ...EMPTY_LIST_QUERY, ...changes });

describe('the request part of a query', () => {
  it('SRCH-004 sends the input as typed, without a path, and ignoring case', () => {
    const part = requestPartOf(queryWith({ fullText: 'a.(b' }), columns, 'de');
    expect(part.searchQueries).toEqual([{ query: 'a.(b', caseInsensitive: true }]);
  });

  it('SRCH-005 sends one entry per column path and none for a column that cannot be filtered', () => {
    const part = requestPartOf(queryWith({ filterOfColumn: { title: 'x', dueDate: 'y', assignee: 'cla' } }), columns, 'de');
    expect(part.searchQueries).toEqual([
      { path: 'title', query: 'x', caseInsensitive: true },
      { path: 'assignee.sort', query: 'cla', caseInsensitive: true },
    ]);
  });

  it('SRCH-008 sorts a text of many languages by the language of the user and a person by name and id', () => {
    expect(requestPartOf(queryWith({ sort: { columnKey: 'caseKind', isAscending: false } }), columns, 'fr')).toEqual({
      sort: 'workflowTitle.fr',
      sortAscending: false,
    });
    expect(requestPartOf(queryWith({ sort: { columnKey: 'assignee', isAscending: true } }), columns, 'de')).toEqual({
      sort: 'assignee.sort,assignee.id',
      sortAscending: true,
    });
  });

  it('SRCH-009 ignores the sort of a column that cannot be sorted and the filter of a column that is not shown', () => {
    expect(requestPartOf(queryWith({ sort: { columnKey: 'candidateUsers', isAscending: true } }), columns, 'de')).toEqual({});
    const withoutFollowUp = columnsShownFor('OpenTasksWithoutFollowUp');
    expect(requestPartOf(queryWith({ sort: { columnKey: 'endedAt', isAscending: true } }), withoutFollowUp, 'de')).toEqual({});
  });

  it('SRCH-009 offers sorting and filtering only where the column says so', () => {
    expect(TASK_COLUMNS.filter((column) => column.sortable).map((column) => column.key)).not.toContain('candidateUsers');
    expect(TASK_COLUMNS.filter((column) => column.filterable).map((column) => column.key)).toEqual(['caseKind', 'title', 'note', 'assignee']);
  });
});

describe('the clicks on a header', () => {
  it('SRCH-007 sort ascending, then descending, then back to the default', () => {
    const first = sortAfterClickOn('title', undefined);
    const second = sortAfterClickOn('title', first);
    expect([first, second, sortAfterClickOn('title', second)]).toEqual([
      { columnKey: 'title', isAscending: true },
      { columnKey: 'title', isAscending: false },
      undefined,
    ]);
    expect(sortAfterClickOn('note', second)).toEqual({ columnKey: 'note', isAscending: true });
  });
});

describe('the suggestions while typing', () => {
  const answer = (words: string[]) => vi.fn(async () => words);

  it('SRCH-002 ask once, 300 ms after the last key and not below three characters', async () => {
    vi.useFakeTimers();
    const load = answer(['alpha']);
    const shown: string[][] = [];
    const source = createSuggestionSource(load, (words) => shown.push(words));
    source.inputChanged('al');
    source.inputChanged('alp');
    await vi.advanceTimersByTimeAsync(299);
    source.inputChanged('alph');
    await vi.advanceTimersByTimeAsync(299);
    expect(load).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('alph');
    vi.useRealTimers();
  });

  it('SRCH-003 show at most 20 in the order of the server', async () => {
    vi.useFakeTimers();
    const words = Array.from({ length: 21 }, (_, index) => `word${index}`);
    let shown: string[] = [];
    createSuggestionSource(answer(words), (suggestions) => (shown = suggestions)).inputChanged('wor');
    await vi.advanceTimersByTimeAsync(300);
    expect(shown).toEqual(words.slice(0, 20));
    vi.useRealTimers();
  });
});

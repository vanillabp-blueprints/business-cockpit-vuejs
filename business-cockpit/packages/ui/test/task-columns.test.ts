import { describe, expect, it } from 'vitest';
import { columnsShownFor, TASK_COLUMNS } from '../src/lists/task-columns';
import { TASK_PRIMARY_FILTERS } from '../src/lists/primary-filters';

const keysShownFor = (filter: (typeof TASK_PRIMARY_FILTERS)[number]) => columnsShownFor(filter).map((column) => column.key);

describe('the fixed columns of the task list', () => {
  it('TL-008 stand in the order of the interview', () => {
    expect(TASK_COLUMNS.map((column) => column.key)).toEqual([
      'select', 'caseKind', 'title', 'dueDate', 'note', 'assignee', 'candidateUsers', 'followUpDate', 'endedAt',
    ]);
  });

  it('TL-009 TL-010 show the follow-up column for two filters and the ended column for the closed ones only', () => {
    expect(keysShownFor('OpenTasksWithFollowUp')).toContain('followUpDate');
    expect(keysShownFor('OpenTaskOnlyFollowUp')).toContain('followUpDate');
    expect(keysShownFor('OpenTasksWithoutFollowUp')).not.toContain('followUpDate');
    expect(keysShownFor('ClosedTasksOnly')).toContain('endedAt');
    expect(keysShownFor('ClosedTasksOnly')).not.toContain('followUpDate');
    expect(keysShownFor('OpenTasksWithFollowUp')).not.toContain('endedAt');
  });

  it('COL-021 name the field of the GUI API and never a path made up from the heading', () => {
    const pathsInGerman = Object.fromEntries(TASK_COLUMNS.map((column) => [column.key, column.pathFor('de')]));
    expect(pathsInGerman).toEqual({
      select: 'id',
      caseKind: 'workflowTitle.de',
      title: 'title',
      dueDate: 'dueDate',
      note: 'note',
      assignee: 'assignee',
      candidateUsers: 'candidateUsers',
      followUpDate: 'followUpDate',
      endedAt: 'endedAt',
    });
    expect(TASK_COLUMNS.find((column) => column.key === 'caseKind')!.pathFor('fr')).toBe('workflowTitle.fr');
  });
});

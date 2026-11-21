import type { TaskPrimaryFilter } from './primary-filters';

export type TaskColumnKey =
  | 'select'
  | 'caseKind'
  | 'title'
  | 'dueDate'
  | 'note'
  | 'assignee'
  | 'candidateUsers'
  | 'followUpDate'
  | 'endedAt';

export interface TaskColumn {
  key: TaskColumnKey;
  /** The path of the field in the GUI API, for sorting and filtering. Never made up from the heading. */
  pathFor: (language: string) => string;
  headingKey: string;
  widthPx: number;
  isShownFor: (filter: TaskPrimaryFilter) => boolean;
}

const always = () => true;
const field = (path: string) => () => path;

/**
 * The fixed columns in the order of the interview. The case kind is the title of the case, which
 * the server stores one text per language, so its path names the language of the user.
 */
export const TASK_COLUMNS: readonly TaskColumn[] = [
  { key: 'select', pathFor: field('id'), headingKey: 'columns.select', widthPx: 48, isShownFor: always },
  { key: 'caseKind', pathFor: (language) => `workflowTitle.${language}`, headingKey: 'columns.caseKind', widthPx: 200, isShownFor: always },
  { key: 'title', pathFor: field('title'), headingKey: 'columns.title', widthPx: 340, isShownFor: always },
  { key: 'dueDate', pathFor: field('dueDate'), headingKey: 'columns.dueDate', widthPx: 150, isShownFor: always },
  { key: 'note', pathFor: field('note'), headingKey: 'columns.note', widthPx: 220, isShownFor: always },
  { key: 'assignee', pathFor: field('assignee'), headingKey: 'columns.assignee', widthPx: 180, isShownFor: always },
  { key: 'candidateUsers', pathFor: field('candidateUsers'), headingKey: 'columns.candidateUsers', widthPx: 56, isShownFor: always },
  {
    key: 'followUpDate',
    pathFor: field('followUpDate'),
    headingKey: 'columns.followUpDate',
    widthPx: 150,
    isShownFor: (filter) => filter === 'OpenTasksWithFollowUp' || filter === 'OpenTaskOnlyFollowUp',
  },
  { key: 'endedAt', pathFor: field('endedAt'), headingKey: 'columns.endedAt', widthPx: 150, isShownFor: (filter) => filter === 'ClosedTasksOnly' },
];

export function columnsShownFor(filter: TaskPrimaryFilter): TaskColumn[] {
  return TASK_COLUMNS.filter((column) => column.isShownFor(filter));
}

/** The grid of a row: one fixed width per column, so the header and every row line up. */
export function gridTemplateOf(columns: TaskColumn[]): string {
  return columns.map((column) => `${column.widthPx}px`).join(' ');
}

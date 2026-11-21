import type { Translatable, User, UserTask, Workflow } from './generated/official-gui-api/types.gen.js';

// The minimum, the same as in the VanillaBP kit @vanillabp/bc-module-kit.
export const USER_TASK_LIST = 'UserTaskList';
export const WORKFLOW_LIST = 'WorkflowList';
export const USER_TASK_FORM = 'UserTaskForm';
export const WORKFLOW_PAGE = 'WorkflowPage';
export const AREA_ALL = 'all';

// Extension point of this cockpit: buttons in the application header.
export const HEADER = 'Header';

/**
 * Entry -> the name of the function the file of the entry exports. Every entry of this cockpit that
 * exports a function is here: the four minimum ones and the header.
 */
export const EXPORT_NAMES = {
  UserTaskList: 'userTaskListColumns',
  WorkflowList: 'workflowListColumns',
  UserTaskForm: 'userTaskForm',
  WorkflowPage: 'workflowPage',
  Header: 'header',
} as const;

/** The entries that carry no framework. It is the keys of EXPORT_NAMES, never a list of its own. */
export const DATA_ENTRIES = Object.freeze(Object.keys(EXPORT_NAMES)) as readonly (keyof typeof EXPORT_NAMES)[];

// The areas of the page of a user task and of the page of a case.
export const AREA_BODY = 'body';
export const AREA_INFORMATION = 'information';
export const AREA_ACTIONS = 'actions';

/** The areas this cockpit lays out, without `all`. */
export const PAGE_AREAS = [AREA_BODY, AREA_INFORMATION, AREA_ACTIONS] as const;

/** The user the cockpit hands every part as `currentUser`. */
export type CurrentUser = User;

export interface Column {
  title: Translatable;
  /** The path of the value within the user task or the case. */
  path: string;
  type?: 'value' | 'i18n' | 'person' | 'date' | 'date-time' | 'time';
  priority: number;
  width: string;
  show: boolean;
  sortable: boolean;
  filterable: boolean;
  resizeable: boolean;
}

export type ColumnsOfUserTaskFunction = (userTask: UserTask) => Column[] | undefined;
export type ColumnsOfWorkflowFunction = (workflow: Workflow) => Column[] | undefined;

/** A web component that a data entry names, and the visual entry that defines it. */
export interface BcElementRef {
  element: string;
  entry: string;
}

/**
 * Area -> name of a web component. 'all' is the one every cockpit knows. This cockpit shows the areas
 * it knows and ignores the others; when none of them is offered, it shows 'all'.
 */
export type PageAreas = { [area: string]: string };

/**
 * The web components of the page of a user task or a case, and the visual entry that defines them.
 * A string as 'element' is the one web component of the area 'all'.
 */
export interface BcPageParts {
  element: string | PageAreas;
  entry: string;
}

/** undefined: this user task is not the module's. */
export type UserTaskFormFunction = (userTask: UserTask) => BcPageParts | undefined;

/** undefined: this case is not the module's. */
export type WorkflowPageFunction = (workflow: Workflow) => BcPageParts | undefined;

export type HeaderFunction = (currentUser: CurrentUser) => BcElementRef[] | undefined;

/** The type of bc-manifest.json. */
export interface BcManifest {
  manifestVersion: 1;
  buildVersion?: string;
  buildTimestamp?: string;
  /** Entry name -> file, relative to the manifest. */
  entries: { readonly [entry: string]: string };
}

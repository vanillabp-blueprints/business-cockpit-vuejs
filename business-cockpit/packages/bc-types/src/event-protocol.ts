import type { UserTask, Workflow } from './generated/official-gui-api/types.gen.js';
import type { BcElementRef, CurrentUser } from './extension-points.js';

/** The event a part dispatches on its own web component to ask the cockpit for something. */
export const REQUEST_EVENT = 'bc-request';
/** The event the cockpit dispatches on the same web component to answer a request. */
export const RESPONSE_EVENT = 'bc-response';
/** The event the cockpit dispatches on the web component of an area to deliver a message. */
export const MESSAGE_EVENT = 'bc-message';

/** The actions every cockpit knows. */
export const ACTIONS = {
  USER_TASK_OPEN: 'userTask.open',
  USER_TASK_NAVIGATE_TO_WORKFLOW: 'userTask.navigateToWorkflow',
  USER_TASK_CLAIM: 'userTask.claim',
  USER_TASK_UNCLAIM: 'userTask.unclaim',
  USER_TASK_ASSIGN: 'userTask.assign',
  USER_TASK_UNASSIGN: 'userTask.unassign',
  WORKFLOW_NAVIGATE_TO_WORKFLOW: 'workflow.navigateToWorkflow',
  WORKFLOW_GET_USER_TASKS: 'workflow.getUserTasks',
  PAGE_SEND_TO: 'page.sendTo',
  PAGE_SUBSCRIBE: 'page.subscribe',
  PAGE_UNSUBSCRIBE: 'page.unsubscribe',
  COCKPIT_SHOW_NOTIFICATION: 'cockpit.showNotification',
  COCKPIT_OPEN_DIALOG: 'cockpit.openDialog',
  COCKPIT_CLOSE_DIALOG: 'cockpit.closeDialog',
} as const;

/** The codes of a failed request. The cockpit sets the first four, the kit sets the last two. */
export const ERROR_CODES = {
  UNKNOWN_ACTION: 'UNKNOWN_ACTION',
  REFUSED: 'REFUSED',
  FAILED: 'FAILED',
  NO_TARGET: 'NO_TARGET',
  TIMEOUT: 'TIMEOUT',
  DISCONNECTED: 'DISCONNECTED',
} as const;

export type BcErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** How long a part waits for an answer, in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Actions that wait for the user and so have no timeout. */
export const ACTIONS_WITHOUT_TIMEOUT: readonly string[] = [ACTIONS.COCKPIT_OPEN_DIALOG];

/** The detail of a `bc-request` event. */
export interface BcRequest {
  requestId: string;
  action: string;
  args: Record<string, unknown>;
}

/** The detail of a `bc-response` event. */
export type BcResponse =
  | { requestId: string; ok: true; result?: unknown }
  | { requestId: string; ok: false; error: { code: BcErrorCode | string; status?: number; message?: string } };

/** The detail of a `bc-message` event. */
export interface BcMessage {
  subscriptionId: string;
  from: string;
  message: unknown;
}

export interface BcSubscription {
  /** Resolves once the cockpit delivers messages to this area. */
  ready: Promise<void>;
  /** Stops the delivery. */
  unsubscribe: () => Promise<void>;
}

/** Messages between the areas of one page, for example from 'body' to 'actions'. */
export interface BcPageMessaging {
  sendTo: (target: string, message: unknown) => Promise<void>;
  receiveMessage: (handler: (message: unknown, from: string) => void) => BcSubscription;
}

export interface BcUserTask extends UserTask, BcPageMessaging {
  open: () => Promise<void>;
  navigateToWorkflow: () => Promise<void>;
  assign: (userId: string) => Promise<void>;
  unassign: (userId: string) => Promise<void>;
  claim: () => Promise<void>;
  unclaim: () => Promise<void>;
}

export type BcUserTasksProvider = (
  activeOnly: boolean,
  limitListAccordingToCurrentUsersPermissions: boolean,
) => Promise<Array<BcUserTask>>;

export interface BcWorkflow extends Workflow, BcPageMessaging {
  navigateToWorkflow: () => Promise<void>;
  getUserTasks: BcUserTasksProvider;
}

export interface BcNotification {
  level: 'info' | 'success' | 'warning' | 'error';
  /** In the language the part got as 'language'. */
  text: string;
  /** true: stays until the user clicks it away. */
  sticky?: boolean;
}

/** Shows a toast in the cockpit. */
export type ShowNotificationFunction = (notification: BcNotification) => Promise<void>;

/**
 * Loads the visual entry 'dialog.entry', shows its web component 'dialog.element' in a modal dialog
 * and resolves with what the dialog closed with.
 */
export type OpenDialogFunction = (dialog: BcElementRef, data?: unknown) => Promise<unknown>;

export type CloseDialogFunction = (result?: unknown) => Promise<void>;

/** The module that a web component belongs to, as `GET /workflow-module` lists it. */
export interface BcWorkflowModule {
  id: string;
  version?: number | string;
  uri?: string;
}

/** What `mount` and `update` get: the properties the cockpit set, and the functions of the cockpit. */
export interface BcElementProps {
  /** On the page of a user task. */
  userTask?: BcUserTask;
  /** On the page of a case. */
  workflow?: BcWorkflow;
  /** The area of a page, or 'all' for an all-in-one form. */
  area?: string;
  language?: string;
  currentUser?: CurrentUser;
  /** For parts outside the pages of a user task and a case. */
  workflowModule?: BcWorkflowModule;
  /** For a dialog: what `openDialog` handed over. */
  data?: unknown;
  /** The web component itself. */
  element: HTMLElement;
  showNotification: ShowNotificationFunction;
  openDialog: OpenDialogFunction;
  closeDialog: CloseDialogFunction;
  sendTo: BcPageMessaging['sendTo'];
  receiveMessage: BcPageMessaging['receiveMessage'];
  /** Any further action, for example one of an extension point of this cockpit. */
  request: (action: string, args?: Record<string, unknown>, timeoutMs?: number) => Promise<unknown>;
  [property: string]: unknown;
}

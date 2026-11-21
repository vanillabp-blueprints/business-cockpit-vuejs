import {
  ACTIONS,
  ACTIONS_WITHOUT_TIMEOUT,
  DEFAULT_TIMEOUT_MS,
  ERROR_CODES,
  MESSAGE_EVENT,
  REQUEST_EVENT,
  RESPONSE_EVENT,
  type BcElementRef,
  type BcMessage,
  type BcNotification,
  type BcResponse,
  type BcSubscription,
  type BcUserTask,
  type BcWorkflow,
  type UserTask,
  type Workflow,
} from '@example/bc-types';

/** A request the cockpit did not carry out, or one which got no answer. */
export class BcRequestError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly action: string;

  constructor(details: { code: string; message?: string; status?: number; action: string }) {
    super(details.message || `The cockpit answered "${details.action}" with ${details.code}`);
    this.name = 'BcRequestError';
    this.code = details.code;
    this.status = details.status;
    this.action = details.action;
  }
}

const openRequests = new WeakMap<EventTarget, Map<string, (error: BcRequestError) => void>>();

let counter = 0;

/**
 * A correlation id. `crypto.randomUUID()` exists only in a secure context, so a page served over plain
 * http on another host than localhost gets a counter with a random part instead.
 */
function newRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  counter += 1;
  return `${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Asks the cockpit to run an action and waits for its answer. `timeoutMs` of 0 waits for ever. By
 * default it waits 30 seconds, and for ever for `cockpit.openDialog`.
 */
export function requestFromCockpit(
  element: EventTarget,
  action: string,
  args: Record<string, unknown> = {},
  timeoutMs?: number,
): Promise<unknown> {
  const limit = timeoutMs ?? (ACTIONS_WITHOUT_TIMEOUT.includes(action) ? 0 : DEFAULT_TIMEOUT_MS);
  const requestId = newRequestId();
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = openRequests.get(element);
    if (!pending) {
      pending = new Map();
      openRequests.set(element, pending);
    }
    const openOfElement = pending;
    const finish = () => {
      clearTimeout(timer);
      element.removeEventListener(RESPONSE_EVENT, onResponse);
      openOfElement.delete(requestId);
    };
    const onResponse = (event: Event) => {
      const answer = (event as CustomEvent<BcResponse>).detail;
      if (!answer || answer.requestId !== requestId) return;
      finish();
      if (answer.ok) {
        resolve(answer.result);
      } else {
        const error = answer.error ?? {};
        reject(new BcRequestError({ code: error.code ?? ERROR_CODES.FAILED, message: error.message, status: error.status, action }));
      }
    };
    openOfElement.set(requestId, (error) => {
      finish();
      reject(error);
    });
    element.addEventListener(RESPONSE_EVENT, onResponse);
    if (limit > 0) {
      timer = setTimeout(() => {
        finish();
        reject(new BcRequestError({ code: ERROR_CODES.TIMEOUT, message: `No answer to "${action}" within ${limit} ms`, action }));
      }, limit);
    }
    element.dispatchEvent(
      new CustomEvent(REQUEST_EVENT, { bubbles: false, composed: false, detail: { requestId, action, args } }),
    );
  });
}

/**
 * Rejects every open request of an element with `DISCONNECTED`. A web component calls it when it leaves
 * the page, in `disconnectedCallback`. `defineBcElement` does that by itself.
 */
export function rejectOpenRequests(element: EventTarget): void {
  const pending = openRequests.get(element);
  if (!pending) return;
  for (const reject of [...pending.values()]) {
    reject(new BcRequestError({ code: ERROR_CODES.DISCONNECTED, message: 'The element left the page before the answer came', action: '' }));
  }
}

/** Sends a message to the web component of another area of the same page. */
export function sendTo(element: EventTarget, target: string, message: unknown): Promise<void> {
  return requestFromCockpit(element, ACTIONS.PAGE_SEND_TO, { target, message }) as Promise<void>;
}

/**
 * Asks the cockpit to deliver the messages for this element's area to `handler`. Messages which arrive
 * before the cockpit has answered are kept and handed over once the subscription id is known.
 */
export function receiveMessage(
  element: EventTarget,
  handler: (message: unknown, from: string) => void,
): BcSubscription {
  let subscriptionId: string | undefined;
  let stopped = false;
  const early: BcMessage[] = [];
  const onMessage = (event: Event) => {
    const delivered = (event as CustomEvent<BcMessage>).detail;
    if (!delivered || stopped) return;
    if (subscriptionId === undefined) {
      early.push(delivered);
    } else if (delivered.subscriptionId === subscriptionId) {
      handler(delivered.message, delivered.from);
    }
  };
  element.addEventListener(MESSAGE_EVENT, onMessage);
  const ready = requestFromCockpit(element, ACTIONS.PAGE_SUBSCRIBE, {}).then((answer) => {
    subscriptionId = (answer as { subscriptionId?: string } | undefined)?.subscriptionId;
    for (const delivered of early.splice(0)) {
      if (!stopped && delivered.subscriptionId === subscriptionId) handler(delivered.message, delivered.from);
    }
  });
  ready.catch(() => element.removeEventListener(MESSAGE_EVENT, onMessage));
  return {
    ready,
    unsubscribe: async () => {
      if (stopped) return;
      stopped = true;
      element.removeEventListener(MESSAGE_EVENT, onMessage);
      await ready.catch(() => undefined);
      if (subscriptionId !== undefined) {
        await requestFromCockpit(element, ACTIONS.PAGE_UNSUBSCRIBE, { subscriptionId });
      }
    },
  };
}

/** Shows a toast in the cockpit. */
export function showNotification(element: EventTarget, { level, text, sticky = false }: BcNotification): Promise<void> {
  return requestFromCockpit(element, ACTIONS.COCKPIT_SHOW_NOTIFICATION, { level, text, sticky }) as Promise<void>;
}

/**
 * Asks the cockpit to show a web component in a modal dialog. Resolves with what the dialog closed with.
 * It has no timeout, because it waits for the user.
 */
export function openDialog(element: EventTarget, { element: name, entry }: BcElementRef, data?: unknown): Promise<unknown> {
  return requestFromCockpit(element, ACTIONS.COCKPIT_OPEN_DIALOG, { element: name, entry, data });
}

/** Closes the dialog this element is shown in. */
export function closeDialog(element: EventTarget, result?: unknown): Promise<void> {
  return requestFromCockpit(element, ACTIONS.COCKPIT_CLOSE_DIALOG, { result }) as Promise<void>;
}

/** Adds the functions of a user task to its plain data from the GUI API. */
export function toBcUserTask(element: EventTarget, userTask: UserTask): BcUserTask {
  const userTaskId = userTask.id;
  const request = (action: string, args: Record<string, unknown> = {}) =>
    requestFromCockpit(element, action, { userTaskId, ...args }) as Promise<void>;
  return {
    ...userTask,
    open: () => request(ACTIONS.USER_TASK_OPEN),
    navigateToWorkflow: () => request(ACTIONS.USER_TASK_NAVIGATE_TO_WORKFLOW),
    claim: () => request(ACTIONS.USER_TASK_CLAIM),
    unclaim: () => request(ACTIONS.USER_TASK_UNCLAIM),
    assign: (userId: string) => request(ACTIONS.USER_TASK_ASSIGN, { userId }),
    unassign: (userId: string) => request(ACTIONS.USER_TASK_UNASSIGN, { userId }),
    sendTo: (target, message) => sendTo(element, target, message),
    receiveMessage: (handler) => receiveMessage(element, handler),
  };
}

/** Adds the functions of a case to its plain data from the GUI API. */
export function toBcWorkflow(element: EventTarget, workflow: Workflow): BcWorkflow {
  const workflowId = workflow.id;
  return {
    ...workflow,
    navigateToWorkflow: () =>
      requestFromCockpit(element, ACTIONS.WORKFLOW_NAVIGATE_TO_WORKFLOW, { workflowId }) as Promise<void>,
    getUserTasks: async (activeOnly, limitListAccordingToCurrentUsersPermissions) => {
      const userTasks = await requestFromCockpit(element, ACTIONS.WORKFLOW_GET_USER_TASKS, {
        workflowId,
        activeOnly,
        limitListAccordingToCurrentUsersPermissions,
      });
      return ((userTasks as UserTask[] | undefined) ?? []).map((userTask) => toBcUserTask(element, userTask));
    },
    sendTo: (target, message) => sendTo(element, target, message),
    receiveMessage: (handler) => receiveMessage(element, handler),
  };
}

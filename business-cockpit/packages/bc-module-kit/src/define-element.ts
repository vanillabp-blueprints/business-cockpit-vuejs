import type { BcElementProps } from '@example/bc-types';
import {
  closeDialog,
  openDialog,
  receiveMessage,
  rejectOpenRequests,
  requestFromCockpit,
  sendTo,
  showNotification,
  toBcUserTask,
  toBcWorkflow,
} from './protocol.js';

/** The properties every cockpit may set on a part's web component. */
export const HOST_PROPERTIES: readonly string[] = ['userTask', 'workflow', 'area', 'language', 'currentUser', 'workflowModule', 'data'];

export interface BcElementFunctions {
  mount: (root: ShadowRoot, props: BcElementProps) => void;
  update?: (root: ShadowRoot, props: BcElementProps) => void;
  unmount?: (root: ShadowRoot) => void;
}

/**
 * Defines a custom element under `name`. When the cockpit puts it into the page, it attaches an open
 * shadow root and calls `mount` with the root and the properties. When the cockpit sets a property
 * again, it calls `update` once per task. When the element leaves the page, it calls `unmount`, stops
 * every subscription the part made and rejects every open request with `DISCONNECTED`.
 *
 * Build `name` with `createElementNames`, so it starts with the prefix of the module and holds the
 * build id. `options.properties` names further properties an extension point of this cockpit sets.
 */
export function defineBcElement(
  name: string,
  { mount, update, unmount }: BcElementFunctions,
  options: { properties?: string[] } = {},
): CustomElementConstructor {
  if (typeof globalThis.customElements === 'undefined') {
    throw new Error('defineBcElement needs a browser: customElements does not exist here');
  }
  if (customElements.get(name)) {
    throw new Error(
      `The web component "${name}" is defined already. Build its name with createElementNames, so it holds the prefix of the module and the build id. Two BPMN ids which differ only in case or in characters like _ or . give the same name, so give one of them another id.`,
    );
  }
  const properties = [...HOST_PROPERTIES, ...(options.properties ?? [])];

  class BcElement extends HTMLElement {
    #values: Record<string, unknown> = {};
    #subscriptions: Array<{ unsubscribe: () => Promise<void> }> = [];
    #mounted = false;
    #updateQueued = false;

    constructor() {
      super();
      // A value set before the element was upgraded sits on the instance and hides the accessor.
      for (const property of properties) {
        if (Object.hasOwn(this, property)) {
          const early = (this as unknown as Record<string, unknown>)[property];
          delete (this as unknown as Record<string, unknown>)[property];
          this.#values[property] = early;
        }
      }
    }

    bcGet(property: string): unknown {
      return this.#values[property];
    }

    bcSet(property: string, value: unknown): void {
      this.#values[property] = value;
      this.#changed();
    }

    connectedCallback(): void {
      const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
      if (this.#mounted) return;
      this.#mounted = true;
      mount(root, this.#props());
    }

    disconnectedCallback(): void {
      if (!this.#mounted) return;
      this.#mounted = false;
      rejectOpenRequests(this);
      for (const subscription of this.#subscriptions.splice(0)) subscription.unsubscribe().catch(() => undefined);
      unmount?.(this.shadowRoot as ShadowRoot);
    }

    /** Collects all changes of one task into one call of `update`. */
    #changed(): void {
      if (!this.#mounted || this.#updateQueued) return;
      this.#updateQueued = true;
      queueMicrotask(() => {
        this.#updateQueued = false;
        if (this.#mounted) update?.(this.shadowRoot as ShadowRoot, this.#props());
      });
    }

    #props(): BcElementProps {
      const receive: BcElementProps['receiveMessage'] = (handler) => {
        const subscription = receiveMessage(this, handler);
        this.#subscriptions.push(subscription);
        return subscription;
      };
      const values: Record<string, any> = { ...this.#values };
      if (values.userTask) values.userTask = { ...toBcUserTask(this, values.userTask), receiveMessage: receive };
      if (values.workflow) values.workflow = { ...toBcWorkflow(this, values.workflow), receiveMessage: receive };
      return {
        ...values,
        element: this,
        showNotification: (notification) => showNotification(this, notification),
        openDialog: (dialog, data) => openDialog(this, dialog, data),
        closeDialog: (result) => closeDialog(this, result),
        sendTo: (target, message) => sendTo(this, target, message),
        receiveMessage: receive,
        request: (action, args, timeoutMs) => requestFromCockpit(this, action, args, timeoutMs),
      };
    }
  }

  for (const property of properties) {
    Object.defineProperty(BcElement.prototype, property, {
      configurable: true,
      enumerable: true,
      get(this: BcElement) {
        return this.bcGet(property);
      },
      set(this: BcElement, value: unknown) {
        this.bcSet(property, value);
      },
    });
  }

  customElements.define(name, BcElement);
  return BcElement;
}

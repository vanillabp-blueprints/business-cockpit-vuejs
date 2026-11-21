import { ERROR_CODES } from '@example/bc-module-kit';

/** How long the host waits for a web component to be defined, in milliseconds. */
export const DEFAULT_WHEN_DEFINED_TIMEOUT_MS = 10_000;

/**
 * How long the host uses a manifest before it reads it again, in milliseconds. It reads it again only
 * before it asks a part of the module, so a module nobody uses is not asked at all.
 */
export const MANIFEST_RECHECK_MS = 60_000;

/**
 * The code of a `BcHostError` thrown because an earlier build of the module defined a web component in
 * this page already. Only a reload of the page shows the new build of such a module.
 */
export const ALREADY_DEFINED = 'ALREADY_DEFINED';

/**
 * The code of a `BcHostError` thrown because a module names a web component the host refuses: the name
 * is no valid name of a custom element, it does not start with the prefix of its module and a hyphen,
 * or it starts with the longer prefix of another module of the registry.
 */
export const WRONG_ELEMENT_NAME = 'WRONG_ELEMENT_NAME';

/** The code of a `BcHostError` thrown because the manifest of a module breaks a rule of the format. */
export const INVALID_MANIFEST = 'INVALID_MANIFEST';

/** The code of a `BcHostError` thrown because a web component was not defined within the time limit. */
export const NOT_DEFINED_IN_TIME = 'NOT_DEFINED_IN_TIME';

export type HostErrorCode =
  | typeof ALREADY_DEFINED
  | typeof WRONG_ELEMENT_NAME
  | typeof INVALID_MANIFEST
  | typeof NOT_DEFINED_IN_TIME;

export type HostStep = 'ask' | 'load' | 'draw';

/** A step of ask, load and draw that failed. */
export class BcHostError extends Error {
  readonly step: HostStep;
  readonly moduleId: string;
  readonly entry?: string;
  readonly element?: string;
  readonly code?: HostErrorCode;

  constructor(details: {
    step: HostStep;
    moduleId: string;
    entry?: string;
    element?: string;
    code?: HostErrorCode;
    message: string;
    cause?: unknown;
  }) {
    super(details.message, { cause: details.cause });
    this.name = 'BcHostError';
    this.step = details.step;
    this.moduleId = details.moduleId;
    this.entry = details.entry;
    this.element = details.element;
    this.code = details.code;
  }
}

/** An error an action handler throws to answer with `REFUSED` and an HTTP status. */
export class BcRefusedError extends Error {
  readonly code = ERROR_CODES.REFUSED;
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message ?? `refused with HTTP status ${status}`);
    this.name = 'BcRefusedError';
    this.status = status;
  }
}

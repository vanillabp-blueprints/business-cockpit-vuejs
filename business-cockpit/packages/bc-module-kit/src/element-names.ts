/**
 * The names of a module's web components. All modules define their web components in the one
 * `customElements` registry of the page, so every name has three parts:
 *
 *     taxi-ride-mvaro4w0-taxi-ride--assess-risk--form
 *     prefix    build    short name
 *
 * The prefix comes from the module id and keeps the modules apart. The build id is new for every
 * build and keeps the builds of one module apart: the browser can define a name only once per page,
 * so a new build needs new names to load without a reload of the page. The short name holds the
 * BPMN ids of the workflow or the user task, so it is unique within the module.
 */

/** Names the HTML standard does not allow for a custom element, although they have a hyphen. */
const RESERVED_NAMES: readonly string[] = [
  'annotation-xml',
  'color-profile',
  'font-face',
  'font-face-src',
  'font-face-uri',
  'font-face-format',
  'font-face-name',
  'missing-glyph',
];

/**
 * Turns a module id into the prefix of its web components. A module id can be any string, but a
 * custom element name has to start with a lower case letter and must not have upper case letters.
 * The cockpit uses the same function to check the names a module draws, so the two always agree.
 *
 * 1. A hyphen goes between a lower case letter or a digit and an upper case letter after it.
 * 2. Every letter becomes lower case.
 * 3. Each run of characters other than `a` to `z`, `0` to `9` and `-` becomes one hyphen, and
 *    hyphens at the start and at the end are removed.
 * 4. If the result is empty or does not start with a letter, `wm-` goes in front of it.
 *
 * `taxi-ride` and `TaxiRide` give `taxi-ride`, `loan_approval.2` gives `loan-approval-2` and `4711`
 * gives `wm-4711`.
 */
export function elementPrefix(workflowModuleId: string): string {
  if (typeof workflowModuleId !== 'string') {
    throw new TypeError(`The module id must be a string, but it is ${describe(workflowModuleId)}`);
  }
  const prefix = workflowModuleId
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return /^[a-z]/.test(prefix) ? prefix : `wm-${prefix}`;
}

/** One id or part in a short name: words of lower case letters and digits, one hyphen between two words. */
const SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Turns a BPMN id, like the id of a process or the task definition of a user task, into one segment
 * of a short name. The rules are those of `elementPrefix`, with two differences: a run of hyphens
 * becomes one hyphen as well, and there is no `wm-` in front, because a segment never starts the name.
 */
function bpmnSegment(bpmnId: unknown, what: string): string {
  if (typeof bpmnId !== 'string') {
    throw new TypeError(`The ${what} must be a string, but it is ${describe(bpmnId)}`);
  }
  const segment = bpmnId
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (segment === '') {
    throw new TypeError(
      `The ${what} ${describe(bpmnId)} has no letter and no digit, so it cannot be part of the name of a web component`,
    );
  }
  return segment;
}

function checkedSegment(value: unknown, what: string): string {
  if (typeof value !== 'string' || !SEGMENT.test(value)) {
    throw new TypeError(
      `The ${what} must be lower case letters and digits, with one hyphen between two words and no hyphen at the start or the end, but it is ${describe(value)}`,
    );
  }
  return value;
}

/**
 * The functions which build the names of a module's web components. Every name is
 * `<prefix>-<build id>-<short name>`, and `--` goes between two segments of the short name.
 */
export interface ElementNames {
  /** `workflow('TaxiRide', 'page')` gives `taxi-ride-mvaro4w0-taxi-ride--page`. */
  workflow(bpmnProcessId: string, part: string): string;
  /** `userTask('TaxiRide', 'assessRisk', 'form')` gives `taxi-ride-mvaro4w0-taxi-ride--assess-risk--form`. */
  userTask(bpmnProcessId: string, taskDefinition: string, part: string): string;
  /** The name of anything else: `<prefix>-<build id>-<short name>`. The short name has no `--`. */
  custom(shortName: string): string;
}

/**
 * Returns the functions which build the names of a module's web components. A module calls it once,
 * in a small file of its own which its data entries and its visual entries import. The build script
 * writes the module id and the build id before it starts the bundler.
 *
 * A part and a custom short name must be a segment already. Two BPMN ids which differ only in case
 * or in the characters which become a hyphen, like `assess_risk` and `assessRisk`, give the same
 * segment and so the same name.
 */
export function createElementNames(workflowModuleId: string, buildId: string): Readonly<ElementNames> {
  const prefix = elementPrefix(workflowModuleId);
  if (typeof buildId !== 'string' || !/^[a-z0-9]+$/.test(buildId)) {
    throw new TypeError(
      `The build id must be a string of lower case letters and digits, for example Date.now().toString(36), but it is ${describe(buildId)}`,
    );
  }
  const name = (...segments: string[]) => {
    const whole = `${prefix}-${buildId}-${segments.join('--')}`;
    if (RESERVED_NAMES.includes(whole)) {
      throw new TypeError(`"${whole}" is a reserved name in HTML and cannot be the name of a web component`);
    }
    return whole;
  };
  const names: ElementNames = {
    workflow: (bpmnProcessId, part) => name(bpmnSegment(bpmnProcessId, 'BPMN process id'), checkedSegment(part, 'part')),
    userTask: (bpmnProcessId, taskDefinition, part) =>
      name(
        bpmnSegment(bpmnProcessId, 'BPMN process id'),
        bpmnSegment(taskDefinition, 'task definition'),
        checkedSegment(part, 'part'),
      ),
    custom: (shortName) => name(checkedSegment(shortName, 'short name of a web component')),
  };
  return Object.freeze(names);
}

function describe(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}

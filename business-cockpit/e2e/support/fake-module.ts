import { createElementNames, type BcPageParts } from '@example/bc-module-kit';
import type { SimulatedFile } from '../simulator/state.ts';

/** One visual entry of a fake module: the web components its file defines. */
export interface FakeVisualEntry {
  /** The whole names of the web components the entry defines. */
  defines: string[];
  /** Replaces the file of the entry, for example with one that fails. */
  file?: SimulatedFile;
}

export interface FakeModuleSpec {
  /** New for every build. It is part of the names and of the file names, so a new build has new addresses. */
  buildId?: string;
  /** What `userTaskForm` answers, by task definition. A task definition without an entry gets `undefined`. */
  forms?: Record<string, BcPageParts>;
  visualEntries?: Record<string, FakeVisualEntry>;
  /** The name under which the data entry exports its function; it is `userTaskForm` unless a test changes it. */
  userTaskFormExport?: string;
  /** Replaces the file of the data entry `UserTaskForm`. */
  dataEntryFile?: SimulatedFile;
  /** Fields and entries added to the manifest, or replacing what the fake builds. */
  manifest?: Record<string, unknown>;
}

/** A plain web component: an open shadow root with the title of its task, and no framework. */
const PLAIN_ELEMENT_SOURCE = `
function define(name, options = {}) {
  customElements.define(name, class extends HTMLElement {
    #task;
    #area = 'all';
    #language = 'en';
    connectedCallback() {
      this.attachShadow({ mode: 'open' });
      this.#render();
    }
    set userTask(value) {
      if (options.throwsOnProperties) throw new Error('This web component cannot be created');
      this.#task = value;
      this.#render();
    }
    set area(value) { this.#area = value; this.#render(); }
    set language(value) { this.#language = value; this.#render(); }
    #render() {
      if (!this.shadowRoot) return;
      const title = this.#task?.title?.[this.#language] ?? '';
      this.shadowRoot.innerHTML = '<div data-testid="module-form" data-area="' + this.#area + '" data-element="' + name + '">' + title + '</div>';
    }
  });
}
`;

/**
 * The files of a module made for one test, below /wm/<id>/. The module is plain JavaScript, so a test shows
 * exactly the failure it wants: a missing file, a slow one, a name that breaks a rule.
 */
export function fakeModule(moduleId: string, spec: FakeModuleSpec = {}): Record<string, SimulatedFile> {
  const buildId = spec.buildId ?? 'b1';
  const dataEntryFileName = `user-task-form-${buildId}.js`;
  const forms = spec.forms ?? {};
  const visualEntries = spec.visualEntries ?? {};
  const exportName = spec.userTaskFormExport ?? 'userTaskForm';

  const files: Record<string, SimulatedFile> = {
    [dataEntryFileName]:
      spec.dataEntryFile ??
      `const forms = ${JSON.stringify(forms)};
       export const ${exportName} = (userTask) => forms[userTask.taskDefinition];`,
  };
  const entries: Record<string, string> = { UserTaskForm: dataEntryFileName };
  for (const [entry, { defines, file }] of Object.entries(visualEntries)) {
    const fileName = `${entry}-${buildId}.js`;
    entries[entry] = fileName;
    files[fileName] = file ?? `${PLAIN_ELEMENT_SOURCE}\n${defines.map((name) => `define(${JSON.stringify(name)});`).join('\n')}`;
  }
  files['bc-manifest.json'] = JSON.stringify({
    manifestVersion: 1,
    buildVersion: buildId,
    buildTimestamp: '2026-11-21T10:00:00Z',
    entries,
    ...spec.manifest,
  });
  return files;
}

/** The names a fake module's parts carry, built the way a module builds them. */
export const namesOf = (moduleId: string, buildId = 'b1') => createElementNames(moduleId, buildId);

/** A part that defines a web component with a given function of the module. */
export const FAKE_ELEMENT_THAT_THROWS = (name: string): string =>
  `${PLAIN_ELEMENT_SOURCE}\ndefine(${JSON.stringify(name)}, { throwsOnProperties: true });`;

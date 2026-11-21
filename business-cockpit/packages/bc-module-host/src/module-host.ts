import {
  ACTIONS,
  AREA_ALL,
  ERROR_CODES,
  EXPORT_NAMES,
  MANIFEST_FILE_NAME,
  MESSAGE_EVENT,
  PAGE_AREAS,
  REQUEST_EVENT,
  RESPONSE_EVENT,
  USER_TASK_FORM,
  WORKFLOW_PAGE,
  BcManifestError,
  elementPrefix,
  entryUrl,
  readManifest,
  type BcManifest,
  type BcPageParts,
  type BcRequest,
  type BcWorkflowModule,
} from '@example/bc-module-kit';
import {
  ALREADY_DEFINED,
  BcHostError,
  DEFAULT_WHEN_DEFINED_TIMEOUT_MS,
  INVALID_MANIFEST,
  MANIFEST_RECHECK_MS,
  NOT_DEFINED_IN_TIME,
  WRONG_ELEMENT_NAME,
} from './host-errors.js';
import { problemOfElementName } from './element-names.js';

const HTTP_NOT_MODIFIED = 304;
const HTTP_NOT_FOUND = 404;

/** What an action handler gets besides the `args` of the request. */
export interface ActionContext {
  moduleId: string;
  /** The area of the element that asked; 'all' for an all-in-one form. */
  area: string;
  element: HTMLElement;
}

/** Runs an action of the event protocol. Throw a `BcRefusedError` to answer with `REFUSED`. */
export type ActionHandler = (args: Record<string, any>, context: ActionContext) => unknown | Promise<unknown>;

export interface ModuleHostOptions {
  /** The address the module paths `/wm/<id>/` are resolved against; by default the page's address. */
  baseUrl?: string;
  /** The modules of the registry. Without them, `loadModules` gives the list. */
  modules?: BcWorkflowModule[];
  /** Like `GET /gui/api/v1/workflow-module`; called once. */
  loadModules?: () => BcWorkflowModule[] | Promise<BcWorkflowModule[]>;
  /** Like `GET /gui/api/v1/workflow-module/{id}`, for a module which registered later. */
  loadModule?: (moduleId: string) => BcWorkflowModule | undefined | Promise<BcWorkflowModule | undefined>;
  fetch?: typeof fetch;
  /** Replaces `import()`, for example in a test under Node.js. */
  importModule?: (url: string) => Promise<any>;
  /** How long the host waits for a web component; by default 10 seconds. */
  whenDefinedTimeoutMs?: number;
  /**
   * How long the host uses a manifest before it reads it again, in milliseconds; by default
   * `MANIFEST_RECHECK_MS`. A test sets a short time to see a new build of a module without waiting.
   */
  manifestRecheckMs?: number;
  /**
   * Called when the host read the manifest of a module again and found a new build. Everything the host
   * loaded from the old build is dropped by then; parts already on the page stay. A cockpit asks its
   * header and its menu again here.
   */
  onNewBuild?: (moduleId: string, manifest: BcManifest, previous: BcManifest) => void;
  /** The actions the host runs besides the page and dialog actions it brings itself. */
  actions?: Record<string, ActionHandler>;
  /** Properties every drawn web component gets, for example `language` and `currentUser`. */
  properties?: Record<string, unknown>;
  /** Data entries this host asks besides those of `EXPORT_NAMES`: entry -> the name of the function it exports. */
  entries?: Record<string, string>;
  /** The areas of the page of a user task or a case. By default those of this cockpit. */
  areas?: readonly string[];
  /** Where dialogs go; by default `document.body`. */
  dialogContainer?: Element;
  logger?: Pick<Console, 'warn' | 'error'>;
}

/** The web components of one part in the page. */
export interface DrawnPart {
  /** Area -> web component. A form shown as one web component has the one area 'all'. */
  elements: Map<string, HTMLElement>;
  /** Sets properties on every web component again, for example a changed user task. */
  update(properties: Record<string, unknown>): void;
  /** Takes the web components out of the page and drops their subscriptions. */
  remove(): void;
}

export interface PartToDraw {
  moduleId: string;
  entry: string;
  element: BcPageParts['element'];
  container: Element;
  properties?: Record<string, unknown>;
}

export interface ModuleHost {
  registry: {
    load(): Promise<void>;
    list(): BcWorkflowModule[];
    get(moduleId: string): BcWorkflowModule | undefined;
    ensure(moduleId: string): Promise<BcWorkflowModule | undefined>;
  };
  /** The manifest of a module, read again first when its last read is older than `manifestRecheckMs`. */
  readManifest(moduleId: string): Promise<BcManifest | undefined>;
  /** The exports of an entry of the module's current build; loaded once per build. */
  loadEntry(moduleId: string, entry: string): Promise<any>;
  /** The areas this host knows, besides 'all'. */
  readonly areas: readonly string[];
  /** The data entries this host asks. */
  readonly entries: readonly string[];
  /** Area -> web component: what `draw` shows of what a data entry offers. */
  pickAreas(element: BcPageParts['element']): Record<string, string>;
  /** undefined for an entry this host does not know, or which the module does not offer. */
  ask(moduleId: string, entry: string, args?: unknown[]): Promise<any>;
  /**
   * Does nothing when the current build of the module defined every web component already. Throws a
   * `BcHostError` with the code `WRONG_ELEMENT_NAME` for a name the module may not draw, and with the
   * code `ALREADY_DEFINED` when an earlier build defined one.
   */
  load(moduleId: string, entry: string, elements: string[]): Promise<void>;
  /** Whether the current build of the module defined every web component already, so `load` has nothing to do. */
  isDefined(moduleId: string, elements: string[]): boolean;
  draw(part: PartToDraw): DrawnPart;
  showUserTask(moduleId: string, userTask: object, container: Element, properties?: Record<string, unknown>): Promise<DrawnPart | undefined>;
  showWorkflow(moduleId: string, workflow: object, container: Element, properties?: Record<string, unknown>): Promise<DrawnPart | undefined>;
}

/** What the loader read from the manifest of a module. */
interface ManifestRead {
  manifest: BcManifest;
  url: string;
  etag?: string;
  lastModified?: string;
  build: string;
}

/**
 * What the loader holds for one module: the manifest it loads from, when it read it last, the read that
 * runs now, and the promises of the entries of the current build.
 */
interface ModuleState {
  current?: ManifestRead;
  readAt: number;
  missing: boolean;
  reading?: Promise<ManifestRead | undefined>;
  waiting: Map<string, Promise<any>>;
  entries: Map<string, Promise<any>>;
  earlierBuilds: Set<string>;
}

/**
 * Creates the host of a cockpit: a registry of modules, one loader that reads the manifests and calls
 * import(), the three steps ask, load and draw, and the cockpit's side of the event protocol. Its
 * entries and areas default to those of this cockpit.
 */
export function createModuleHost(options: ModuleHostOptions = {}): ModuleHost {
  const {
    baseUrl = globalThis.location?.href,
    fetch: fetchFn = globalThis.fetch?.bind(globalThis),
    importModule = (url: string) => import(/* @vite-ignore */ /* webpackIgnore: true */ url),
    loadModules,
    loadModule,
    whenDefinedTimeoutMs = DEFAULT_WHEN_DEFINED_TIMEOUT_MS,
    manifestRecheckMs = MANIFEST_RECHECK_MS,
    onNewBuild,
    actions = {},
    logger = globalThis.console,
    dialogContainer,
    entries: extraEntries = {},
    areas: pageAreas = PAGE_AREAS,
  } = options;

  /** Data entry -> the name of the function its file exports. */
  const knownEntries: Record<string, string> = { ...EXPORT_NAMES, ...extraEntries };

  const modules = new Map<string, BcWorkflowModule>((options.modules ?? []).map((module) => [module.id, module]));
  let registryLoaded: Promise<void> | undefined = options.modules ? Promise.resolve() : undefined;

  const manifestUrlOf = (moduleId: string) =>
    new URL(`/wm/${encodeURIComponent(moduleId)}/${MANIFEST_FILE_NAME}`, baseUrl).href;

  /** Two modules with the same prefix could name the same web component, so the author hears of it. */
  function warnAboutSamePrefix(newModule: BcWorkflowModule): void {
    const prefix = elementPrefix(newModule.id);
    for (const other of modules.values()) {
      if (other.id !== newModule.id && elementPrefix(other.id) === prefix) {
        logger?.warn?.(
          `The modules ${other.id} and ${newModule.id} have the same prefix ${prefix} for their web components. Their names can clash unless both carry a build id.`,
        );
      }
    }
  }

  function addToRegistry(module: BcWorkflowModule): void {
    warnAboutSamePrefix(module);
    modules.set(module.id, module);
  }

  const registry = {
    /** Reads the modules once, like `GET /gui/api/v1/workflow-module`. */
    load(): Promise<void> {
      registryLoaded ??= Promise.resolve(loadModules?.() ?? []).then((list) => {
        for (const module of list) addToRegistry(module);
      });
      return registryLoaded;
    },
    list: () => [...modules.values()],
    get: (moduleId: string) => modules.get(moduleId),
    /** Adds a module which registered after the page loaded, like `GET /gui/api/v1/workflow-module/{id}`. */
    async ensure(moduleId: string): Promise<BcWorkflowModule | undefined> {
      await registry.load();
      if (!modules.has(moduleId) && loadModule) {
        const module = await loadModule(moduleId);
        if (module) addToRegistry(module);
      }
      return modules.get(moduleId);
    },
  };

  const moduleStates = new Map<string, ModuleState>();
  /** Web component -> the module and build which defined it, as `<module>\n<build>`. */
  const definedBy = new Map<string, string>();

  function stateOf(moduleId: string): ModuleState {
    let state = moduleStates.get(moduleId);
    if (!state) {
      state = { readAt: -Infinity, missing: false, waiting: new Map(), entries: new Map(), earlierBuilds: new Set() };
      moduleStates.set(moduleId, state);
    }
    return state;
  }

  /**
   * Says which build a manifest belongs to. `buildVersion` alone is not enough, because a version like
   * `1.4.0-SNAPSHOT` stays the same over many builds, so `buildTimestamp` counts as well. A manifest with
   * neither is told apart by its files, which carry the hash of their content.
   */
  function buildOf(manifest: BcManifest): string {
    const { buildVersion, buildTimestamp, entries } = manifest;
    if (buildVersion !== undefined || buildTimestamp !== undefined) return JSON.stringify([buildVersion, buildTimestamp]);
    return JSON.stringify(Object.entries(entries).sort(([first], [second]) => (first < second ? -1 : first > second ? 1 : 0)));
  }

  /**
   * Reads the manifest of a module and keeps it. A module without a manifest (404) has no parts, and the
   * host does not ask again. When the first read fails, it is forgotten, so the next call asks again.
   * When a later read fails, the host goes on with the manifest it has and asks again the next time.
   */
  function readManifestNow(moduleId: string, state: ModuleState): Promise<ManifestRead | undefined> {
    const url = manifestUrlOf(moduleId);
    const previous = state.current;
    const keepPrevious = (problem: string) => {
      logger?.warn?.(`Reading the manifest of the module ${moduleId} again failed (${problem}), so the host goes on with the build it has`);
      return previous;
    };
    state.waiting = new Map();
    const reading = (async (): Promise<ManifestRead | undefined> => {
      if (!previous) {
        const module = await registry.ensure(moduleId);
        if (module && module.uri === '') {
          state.missing = true;
          return undefined;
        }
      }
      // A browser asks again with the ETag of its cache by itself. A fetch without a cache, as in Node.js,
      // gets the 304 only when the host names the version it has.
      const conditions: Record<string, string> = {
        ...(previous?.etag ? { 'if-none-match': previous.etag } : {}),
        ...(previous?.lastModified ? { 'if-modified-since': previous.lastModified } : {}),
      };
      const init: RequestInit = Object.keys(conditions).length > 0 ? { cache: 'no-cache', headers: conditions } : { cache: 'no-cache' };
      let response: Response;
      try {
        response = await fetchFn(url, init);
      } catch (error) {
        if (previous) return keepPrevious((error as Error)?.message ?? String(error));
        throw error;
      }
      if (previous && response.status === HTTP_NOT_MODIFIED) {
        state.readAt = Date.now();
        return previous;
      }
      if (!previous && response.status === HTTP_NOT_FOUND) {
        state.missing = true;
        return undefined;
      }
      if (!response.ok) {
        const problem = `${url} answered with HTTP status ${response.status}`;
        if (previous) return keepPrevious(problem);
        throw new Error(problem);
      }
      let manifest: BcManifest;
      try {
        manifest = readManifest(await response.text());
      } catch (error) {
        if (previous) return keepPrevious((error as Error).message);
        throw error;
      }
      const read: ManifestRead = {
        manifest,
        url,
        etag: response.headers?.get?.('etag') ?? undefined,
        lastModified: response.headers?.get?.('last-modified') ?? undefined,
        build: buildOf(manifest),
      };
      const isNewBuild = previous !== undefined && previous.build !== read.build;
      if (isNewBuild) {
        // Everything loaded from the old build is dropped. Parts already on the page stay.
        state.entries = new Map();
        state.earlierBuilds.add(previous.build);
      }
      state.current = read;
      state.readAt = Date.now();
      if (isNewBuild) onNewBuild?.(moduleId, read.manifest, previous.manifest);
      return read;
    })();
    state.reading = reading;
    const forgetRead = () => {
      state.reading = undefined;
    };
    reading.then(forgetRead, forgetRead);
    return reading;
  }

  /**
   * Returns the read of the manifest which runs now, or starts one when the module was never read or its
   * last read is older than `manifestRecheckMs`. Returns `undefined` when the manifest the host has is
   * recent enough.
   */
  function refreshManifest(moduleId: string, state: ModuleState): Promise<ManifestRead | undefined> | undefined {
    if (state.missing) return undefined;
    if (state.reading) return state.reading;
    if (state.current && Date.now() - state.readAt <= manifestRecheckMs) return undefined;
    return readManifestNow(moduleId, state);
  }

  /** The manifest of a module, read again first when that is due. */
  function readManifestOf(moduleId: string): Promise<ManifestRead | undefined> {
    const state = stateOf(moduleId);
    return refreshManifest(moduleId, state) ?? Promise.resolve(state.current);
  }

  /**
   * Imports an entry of the build the host has now, once. The promise goes into the map in the same
   * synchronous step as import(), so every caller gets the same pending promise. A failed import is
   * forgotten, and the next call reads the manifest again first.
   */
  function importEntry(state: ModuleState, entry: string, read: ManifestRead | undefined): Promise<any> {
    if (!read) return Promise.resolve(undefined);
    let loading = state.entries.get(entry);
    if (!loading) {
      const url = entryUrl(read.manifest, entry, read.url);
      if (!url) return Promise.resolve(undefined);
      const entriesOfBuild = state.entries;
      loading = importModule(url);
      entriesOfBuild.set(entry, loading);
      const thisLoading = loading;
      loading.catch(() => {
        if (entriesOfBuild.get(entry) === thisLoading) entriesOfBuild.delete(entry);
        state.readAt = -Infinity;
      });
    }
    return loading;
  }

  /**
   * Loads an entry of a module once per build and returns its exports, or `undefined` when the module's
   * manifest does not name it. Before it does, it reads the manifest again when its last read is older
   * than `manifestRecheckMs`. A failed load is forgotten, so a retry reads the manifest again and calls
   * import() again.
   */
  function loadEntry(moduleId: string, entry: string): Promise<any> {
    const state = stateOf(moduleId);
    const reading = refreshManifest(moduleId, state);
    if (!reading) return importEntry(state, entry, state.current);
    // Callers which come while the manifest is read share one promise per entry as well.
    let loading = state.waiting.get(entry);
    if (!loading) {
      loading = reading.then((read) => importEntry(state, entry, read));
      state.waiting.set(entry, loading);
    }
    return loading;
  }

  /** The error of a failed load of an entry: a manifest which breaks the format gets a code of its own. */
  function loadFailure(step: 'ask' | 'load', moduleId: string, entry: string, kind: string, cause: unknown): BcHostError {
    const isInvalidManifest = cause instanceof BcManifestError;
    return new BcHostError({
      step,
      moduleId,
      entry,
      code: isInvalidManifest ? INVALID_MANIFEST : undefined,
      message: isInvalidManifest
        ? `The manifest of the module ${moduleId} is refused: ${cause.problems.join('; ')}`
        : `The ${kind} ${entry} of the module ${moduleId} failed to load`,
      cause,
    });
  }

  /**
   * Step one: ask a data entry. Calls its function with the arguments and returns the answer, or
   * `undefined` when the module does not name the entry or does not export the function. An entry this
   * host does not know is not loaded at all, and the answer is `undefined` as well.
   */
  async function ask(moduleId: string, entry: string, args: unknown[] = []): Promise<any> {
    const exportName = knownEntries[entry];
    if (exportName === undefined) return undefined;
    let exports: Record<string, unknown> | undefined;
    try {
      exports = await loadEntry(moduleId, entry);
    } catch (cause) {
      throw loadFailure('ask', moduleId, entry, 'data entry', cause);
    }
    if (!exports) return undefined;
    const answerOfModule = exports[exportName];
    if (typeof answerOfModule !== 'function') {
      logger?.warn?.(`The module ${moduleId} names the entry ${entry}, but it does not export the function ${exportName}`);
      return undefined;
    }
    return answerOfModule(...args);
  }

  /** Waits for a web component, at most `whenDefinedTimeoutMs`. */
  function whenDefined(name: string): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
      customElements.whenDefined(name).then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), whenDefinedTimeoutMs);
      }),
    ]).finally(() => clearTimeout(timer));
  }

  /** Refuses the names of web components which a module may not draw, before anything is loaded. */
  async function checkElementNames(moduleId: string, entry: string, names: unknown[]): Promise<void> {
    await registry.load();
    const otherModuleIds = registry.list().map(({ id }) => id).filter((id) => id !== moduleId);
    for (const name of names) {
      const problem = problemOfElementName(name, moduleId, otherModuleIds);
      if (!problem) continue;
      const prefix = elementPrefix(moduleId);
      const message = `The module ${moduleId} names the web component ${String(name)}, which ${problem}. Every web component of the module ${moduleId} has to start with "${prefix}-", so the host loads nothing for it. Build the names with createElementNames of the module kit.`;
      logger?.error?.(message);
      throw new BcHostError({
        step: 'load',
        moduleId,
        entry,
        element: typeof name === 'string' ? name : undefined,
        code: WRONG_ELEMENT_NAME,
        message,
      });
    }
  }

  function definedByCurrentBuild(moduleId: string, name: string): boolean {
    const build = stateOf(moduleId).current?.build;
    return build !== undefined && customElements.get(name) !== undefined && definedBy.get(name) === `${moduleId}\n${build}`;
  }

  /**
   * Step two: load the visual entry and wait for every web component it should define. First it checks
   * the names. When the build the host has now defined all of them already, it does nothing: no
   * import(), no waiting. When an earlier build defined one of them, the new visual entry could not
   * define it again, so the host loads nothing and throws a `BcHostError` with the code `ALREADY_DEFINED`.
   */
  async function load(moduleId: string, entry: string, names: string[]): Promise<void> {
    await checkElementNames(moduleId, entry, names);
    let read: ManifestRead | undefined;
    try {
      read = await readManifestOf(moduleId);
    } catch (cause) {
      throw loadFailure('load', moduleId, entry, 'visual entry', cause);
    }
    const state = stateOf(moduleId);
    if (read) {
      if (names.every((name) => definedByCurrentBuild(moduleId, name))) return;
      const definedEarlier = names.find(
        (name) =>
          !definedByCurrentBuild(moduleId, name) &&
          customElements.get(name) !== undefined &&
          (definedBy.has(name) || state.earlierBuilds.size > 0),
      );
      if (definedEarlier) {
        const message = `The module ${moduleId} was updated, but its new build names the web component ${definedEarlier}, which an earlier build defined in this page already. Reload the page to show the new build.`;
        logger?.error?.(message);
        throw new BcHostError({ step: 'load', moduleId, entry, element: definedEarlier, code: ALREADY_DEFINED, message });
      }
    }
    let exports: unknown;
    try {
      exports = await loadEntry(moduleId, entry);
    } catch (cause) {
      throw loadFailure('load', moduleId, entry, 'visual entry', cause);
    }
    if (exports === undefined) {
      throw new BcHostError({ step: 'load', moduleId, entry, message: `The module ${moduleId} does not name the visual entry ${entry} in its manifest` });
    }
    for (const name of names) {
      if (!(await whenDefined(name))) {
        const message = `The visual entry ${entry} of the module ${moduleId} did not define the web component ${name} within ${whenDefinedTimeoutMs} ms`;
        logger?.error?.(message);
        throw new BcHostError({ step: 'load', moduleId, entry, element: name, code: NOT_DEFINED_IN_TIME, message });
      }
      if (read && !definedBy.has(name)) definedBy.set(name, `${moduleId}\n${read.build}`);
    }
  }

  /**
   * Picks the web components to show from what a data entry offers. The areas this host knows come
   * first; the areas it does not know are ignored. When none of its areas is offered, or it has no areas,
   * it shows the web component of `all`, and never `all` together with areas.
   */
  function pickAreas(element: BcPageParts['element']): Record<string, string> {
    const offered: Record<string, unknown> = typeof element === 'string' ? { [AREA_ALL]: element } : { ...element };
    const known = pageAreas.filter((area) => area !== AREA_ALL && typeof offered[area] === 'string');
    if (known.length > 0) return Object.fromEntries(known.map((area) => [area, offered[area] as string]));
    return typeof offered[AREA_ALL] === 'string' ? { [AREA_ALL]: offered[AREA_ALL] } : {};
  }

  let nextSubscriptionId = 0;

  /**
   * Step three: draw web components into a container and run the cockpit's side of the event protocol
   * for them. Run `load` before. Which areas are drawn follows `pickAreas`. An element of an area goes
   * into the element of the container with `data-bc-area` of that area, or else into the container.
   */
  function draw({ moduleId, entry, element, container, properties = {} }: PartToDraw): DrawnPart {
    const areas = pickAreas(element);
    const elements = new Map<string, HTMLElement>();
    const subscriptions = new Map<string, string>();
    /** Messages kept until their area subscribes. */
    const waiting = new Map<string, Array<{ from: string; message: unknown }>>();
    const cleanups: Array<() => void> = [];

    const deliver = (area: string, from: string, message: unknown) => {
      const subscriptionId = subscriptions.get(area);
      if (subscriptionId === undefined) {
        if (!waiting.has(area)) waiting.set(area, []);
        waiting.get(area)!.push({ from, message });
        return;
      }
      elements.get(area)?.dispatchEvent(new CustomEvent(MESSAGE_EVENT, { detail: { subscriptionId, from, message } }));
    };

    const pageActions: Record<string, ActionHandler> = {
      [ACTIONS.PAGE_SEND_TO]: ({ target, message }, { area }) => {
        if (!elements.has(target)) throw Object.assign(new Error(`This page has no area ${target}`), { code: ERROR_CODES.NO_TARGET });
        deliver(target, area, structuredClone(message));
      },
      [ACTIONS.PAGE_SUBSCRIBE]: (_args, { area }) => {
        nextSubscriptionId += 1;
        const subscriptionId = `subscription-${nextSubscriptionId}`;
        subscriptions.set(area, subscriptionId);
        // The kept messages follow the answer, so the part knows its subscription id by then.
        setTimeout(() => {
          for (const { from, message } of waiting.get(area)?.splice(0) ?? []) deliver(area, from, message);
        });
        return { subscriptionId };
      },
      [ACTIONS.PAGE_UNSUBSCRIBE]: ({ subscriptionId }, { area }) => {
        if (subscriptions.get(area) === subscriptionId) subscriptions.delete(area);
      },
    };

    for (const [area, name] of Object.entries(areas)) {
      let created: HTMLElement;
      try {
        created = document.createElement(name);
        Object.assign(created, properties, { area });
      } catch (cause) {
        throw new BcHostError({ step: 'draw', moduleId, entry, element: name, message: `Creating the web component ${name} of the module ${moduleId} failed`, cause });
      }
      const onRequest = (event: Event) => {
        answer(created, (event as CustomEvent<BcRequest>).detail, { moduleId, area, page: pageActions });
      };
      created.addEventListener(REQUEST_EVENT, onRequest);
      cleanups.push(() => created.removeEventListener(REQUEST_EVENT, onRequest));
      elements.set(area, created);
    }
    for (const [area, created] of elements) {
      const slot = container.querySelector(`[data-bc-area="${area}"]`) ?? container;
      slot.append(created);
      if (!created.shadowRoot) {
        logger?.warn?.(`The web component ${created.localName} of the module ${moduleId} has no open shadow root`);
      }
    }
    return {
      elements,
      update(changed) {
        for (const created of elements.values()) Object.assign(created, changed);
      },
      remove() {
        for (const cleanup of cleanups.splice(0)) cleanup();
        subscriptions.clear();
        waiting.clear();
        for (const created of elements.values()) created.remove();
      },
    };
  }

  /** Open dialogs: element -> the function that resolves what `openDialog` waits for. */
  const dialogs = new Map<HTMLElement, (result: unknown) => void>();

  const cockpitActions: Record<string, ActionHandler> = {
    [ACTIONS.COCKPIT_OPEN_DIALOG]: async ({ element: name, entry, data }, { moduleId }) => {
      await load(moduleId, entry, [name]);
      const layer = document.createElement('dialog');
      layer.setAttribute('data-bc-dialog', name);
      (dialogContainer ?? document.body).append(layer);
      const part = draw({ moduleId, entry, element: name, container: layer, properties: { ...options.properties, workflowModule: registry.get(moduleId), data } });
      layer.showModal?.();
      const [created] = part.elements.values();
      return new Promise((resolve) => {
        dialogs.set(created, (result) => {
          dialogs.delete(created);
          resolve(result);
          // The answer to closeDialog goes out first. Removed before it, the web component would see its
          // request fail with DISCONNECTED.
          setTimeout(() => {
            part.remove();
            layer.remove();
          });
        });
      });
    },
    [ACTIONS.COCKPIT_CLOSE_DIALOG]: ({ result }, { element }) => {
      const close = dialogs.get(element);
      if (!close) throw Object.assign(new Error('This element is not shown in a dialog'), { code: ERROR_CODES.FAILED });
      close(result);
    },
  };

  /** Answers one request exactly once, on the element it came from. */
  async function answer(
    element: HTMLElement,
    request: BcRequest | undefined,
    { moduleId, area, page }: { moduleId: string; area: string; page: Record<string, ActionHandler> },
  ): Promise<void> {
    if (!request || typeof request.requestId !== 'string') return;
    const { requestId, action, args = {} } = request;
    const respond = (body: object) => element.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: { requestId, ...body } }));
    const handler = page[action] ?? cockpitActions[action] ?? actions[action];
    if (!handler) {
      respond({ ok: false, error: { code: ERROR_CODES.UNKNOWN_ACTION, message: `This host does not know the action ${action}` } });
      return;
    }
    try {
      const result = await handler(args, { moduleId, area, element });
      respond({ ok: true, result });
    } catch (error) {
      const failure = error as { code?: string; status?: number; message?: string };
      const code = failure?.code && Object.values<string>(ERROR_CODES).includes(failure.code) ? failure.code : ERROR_CODES.FAILED;
      respond({ ok: false, error: { code, status: failure?.status, message: failure?.message } });
    }
  }

  /** Ask, load and draw for the page of a user task or a case, in one call. */
  async function showPage(page: {
    moduleId: string;
    entry: string;
    data: object;
    property: 'userTask' | 'workflow';
    container: Element;
    properties?: Record<string, unknown>;
  }): Promise<DrawnPart | undefined> {
    const { moduleId, entry, data, property, container, properties = {} } = page;
    const parts: BcPageParts | undefined = await ask(moduleId, entry, [data]);
    if (!parts) return undefined;
    const names = Object.values(pickAreas(parts.element));
    if (names.length === 0) {
      const known = pageAreas.length > 0 ? `the areas ${pageAreas.join(', ')} or ${AREA_ALL}` : `the area ${AREA_ALL}`;
      logger?.warn?.(`The module ${moduleId} offers no web component for ${known} in its entry ${entry}, so this host shows nothing`);
      return undefined;
    }
    await load(moduleId, parts.entry, names);
    return draw({ moduleId, entry: parts.entry, element: parts.element, container, properties: { ...options.properties, ...properties, [property]: data } });
  }

  return {
    registry,
    readManifest: (moduleId) => readManifestOf(moduleId).then((read) => read?.manifest),
    loadEntry,
    areas: Object.freeze([...pageAreas]),
    entries: Object.freeze(Object.keys(knownEntries)),
    pickAreas,
    ask,
    load,
    isDefined: (moduleId, names) => names.every((name) => definedByCurrentBuild(moduleId, name)),
    draw,
    showUserTask: (moduleId, userTask, container, properties) =>
      showPage({ moduleId, entry: USER_TASK_FORM, data: userTask, property: 'userTask', container, properties }),
    showWorkflow: (moduleId, workflow, container, properties) =>
      showPage({ moduleId, entry: WORKFLOW_PAGE, data: workflow, property: 'workflow', container, properties }),
  };
}

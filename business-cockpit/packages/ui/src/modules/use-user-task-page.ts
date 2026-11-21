import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue';
import {
  ALREADY_DEFINED,
  BcHostError,
  INVALID_MANIFEST,
  NOT_DEFINED_IN_TIME,
  WRONG_ELEMENT_NAME,
  type DrawnPart,
} from '@example/bc-module-host';
import { elementPrefix, USER_TASK_FORM, type BcPageParts } from '@example/bc-module-kit';
import { OfficialTasklistApi } from '../generated/official-gui-api/sdk.gen';
import type { UserTask } from '../generated/official-gui-api/types.gen';
import { useTexts } from '../i18n/texts';
import { currentUser } from '../session/session';
import { moduleHost } from './module-host';
import { openTask } from './open-task';
import { wayToOpen } from './task-address';

const tasks = new OfficialTasklistApi();

/** What went wrong on the page of a user task. Each kind has its own note. */
export type TaskPageError =
  | { kind: 'task' }
  | { kind: 'cannot-open' }
  | { kind: 'external' }
  | { kind: 'no-form'; moduleId: string }
  | { kind: 'data-entry'; moduleId: string; entry: string }
  | { kind: 'visual-entry'; moduleId: string; entry: string }
  | { kind: 'not-defined'; moduleId: string; entry: string; element: string }
  | { kind: 'wrong-name'; moduleId: string; element: string; prefix: string }
  | { kind: 'updated'; moduleId: string }
  | { kind: 'manifest'; moduleId: string }
  | { kind: 'draw'; moduleId: string; element: string };

/** Which step the page is in: reading the task, asking the data entry, loading the visual entry, showing the form. */
export type TaskPagePhase = 'task' | 'ask' | 'load' | 'ready' | 'error';

/** After this many failed tries in a row, the note offers to reload the page. */
const FAILED_TRIES_BEFORE_RELOAD_IS_OFFERED = 2;

function errorOfHostFailure(failure: unknown, moduleId: string, entry: string): TaskPageError {
  // A function of the module that throws is a failure of the entry as well.
  if (!(failure instanceof BcHostError)) return { kind: 'data-entry', moduleId, entry };
  const element = failure.element ?? '';
  if (failure.code === WRONG_ELEMENT_NAME) return { kind: 'wrong-name', moduleId, element, prefix: elementPrefix(moduleId) };
  if (failure.code === ALREADY_DEFINED) return { kind: 'updated', moduleId };
  if (failure.code === INVALID_MANIFEST) return { kind: 'manifest', moduleId };
  if (failure.code === NOT_DEFINED_IN_TIME) return { kind: 'not-defined', moduleId, entry: failure.entry ?? entry, element };
  if (failure.step === 'draw') return { kind: 'draw', moduleId, element };
  return { kind: failure.step === 'ask' ? 'data-entry' : 'visual-entry', moduleId, entry: failure.entry ?? entry };
}

/**
 * The page of one user task: read it, mark it as read, ask the data entry `UserTaskForm` of its module,
 * load the visual entry it names and draw its web components into `container`. Each step has its own
 * loading state and its own error.
 */
export function useUserTaskPage(taskId: Ref<string>, container: Ref<HTMLElement | null>) {
  const { language } = useTexts();

  const task = ref<UserTask>();
  const phase = ref<TaskPagePhase>('task');
  const error = ref<TaskPageError>();
  const parts = shallowRef<BcPageParts>();
  const failedTriesInARow = ref(0);
  let kindOfLastFailure: TaskPageError['kind'] | undefined;
  let drawn: DrawnPart | undefined;
  // Each start of the page gets a number, so the answer of an earlier start never overwrites a later one.
  let currentRun = 0;

  const areasToDraw = computed(() => (parts.value ? moduleHost.pickAreas(parts.value.element) : {}));
  const drawsAreas = computed(() => Object.keys(areasToDraw.value).some((area) => area !== 'all'));
  const isSuspended = computed(() => Boolean(task.value?.suspendedAt && !task.value.endedAt));
  const offersReload = computed(
    () =>
      error.value?.kind === 'updated' ||
      (failedTriesInARow.value >= FAILED_TRIES_BEFORE_RELOAD_IS_OFFERED &&
        (error.value?.kind === 'data-entry' || error.value?.kind === 'visual-entry')),
  );
  const canRetry = computed(() => ['task', 'data-entry', 'visual-entry', 'not-defined', 'draw', 'manifest'].includes(error.value?.kind ?? ''));

  function fail(run: number, failure: TaskPageError): void {
    if (run !== currentRun) return;
    failedTriesInARow.value = kindOfLastFailure === failure.kind ? failedTriesInARow.value + 1 : 1;
    kindOfLastFailure = failure.kind;
    error.value = failure;
    phase.value = 'error';
  }

  async function loadTaskAndMarkItAsRead(run: number): Promise<UserTask | undefined> {
    try {
      const opened = await tasks.getUserTask({ userTaskId: taskId.value });
      await tasks.markTaskAsRead({ userTaskId: taskId.value });
      if (run !== currentRun) return undefined;
      task.value = opened;
      openTask.value = opened;
      return opened;
    } catch {
      fail(run, { kind: 'task' });
      return undefined;
    }
  }

  async function start(): Promise<void> {
    const run = ++currentRun;
    removeDrawnParts();
    error.value = undefined;
    phase.value = 'task';

    const opened = task.value?.id === taskId.value ? task.value : await loadTaskAndMarkItAsRead(run);
    if (!opened || run !== currentRun) return;

    const way = wayToOpen(opened);
    if (way === 'unknown') return fail(run, { kind: 'cannot-open' });
    if (way === 'own-tab') return fail(run, { kind: 'external' });

    const moduleId = opened.workflowModuleId;
    phase.value = 'ask';
    let pageParts: BcPageParts | undefined;
    try {
      pageParts = await moduleHost.ask(moduleId, USER_TASK_FORM, [opened]);
    } catch (failure) {
      return fail(run, errorOfHostFailure(failure, moduleId, USER_TASK_FORM));
    }
    if (run !== currentRun) return;
    const names = pageParts ? Object.values(moduleHost.pickAreas(pageParts.element)) : [];
    if (!pageParts || names.length === 0) return fail(run, { kind: 'no-form', moduleId });

    // A part whose web components the current build defined already is drawn at once, without a loading state.
    if (!moduleHost.isDefined(moduleId, names)) {
      phase.value = 'load';
      try {
        await moduleHost.load(moduleId, pageParts.entry, names);
      } catch (failure) {
        return fail(run, errorOfHostFailure(failure, moduleId, pageParts.entry));
      }
      if (run !== currentRun) return;
    }
    parts.value = pageParts;
    failedTriesInARow.value = 0;
    kindOfLastFailure = undefined;
    phase.value = 'ready';
  }

  const hostProperties = () => ({
    userTask: task.value,
    language: language.value,
    currentUser: currentUser.value,
    workflowModule: task.value ? moduleHost.registry.get(task.value.workflowModuleId) : undefined,
  });

  function drawWhenThereIsRoom(): void {
    if (phase.value !== 'ready' || !container.value || !parts.value || !task.value || drawn) return;
    const moduleId = task.value.workflowModuleId;
    try {
      drawn = moduleHost.draw({ moduleId, entry: parts.value.entry, element: parts.value.element, container: container.value, properties: hostProperties() });
    } catch (failure) {
      fail(currentRun, errorOfHostFailure(failure, moduleId, parts.value.entry));
    }
  }

  function removeDrawnParts(): void {
    drawn?.remove();
    drawn = undefined;
    parts.value = undefined;
  }

  /**
   * Reads the task again and hands it to the web components. The page does this when the browser tab
   * comes back to the front, so a task that changed in the meantime shows its new state.
   */
  async function readTaskAgain(): Promise<void> {
    try {
      task.value = await tasks.getUserTask({ userTaskId: taskId.value });
      openTask.value = task.value;
    } catch {
      // The page keeps what it shows. The next try asks again.
    }
  }

  const readAgainWhenTheTabComesBack = () => {
    if (document.visibilityState === 'visible' && phase.value === 'ready') readTaskAgain();
  };

  watch([phase, container], drawWhenThereIsRoom, { flush: 'post' });
  watch([task, language, currentUser], () => drawn?.update(hostProperties()));
  watch(taskId, () => {
    task.value = undefined;
    start();
  });
  onMounted(() => {
    start();
    document.addEventListener('visibilitychange', readAgainWhenTheTabComesBack);
  });
  onBeforeUnmount(() => {
    currentRun++;
    removeDrawnParts();
    openTask.value = undefined;
    document.removeEventListener('visibilitychange', readAgainWhenTheTabComesBack);
  });

  return { task, phase, error, drawsAreas, isSuspended, offersReload, canRetry, retry: start, reloadPage: () => window.location.reload() };
}

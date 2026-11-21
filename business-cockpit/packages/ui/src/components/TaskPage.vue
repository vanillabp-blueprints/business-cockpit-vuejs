<template>
  <div class="task-page" data-testid="task-page" :data-phase="phase">
    <div v-if="isLoading" class="task-page__note" data-testid="task-page-loading" :data-step="phase" role="status">
      <v-progress-circular indeterminate size="24" class="mr-3" />
      {{ text(`taskPage.loading.${phase}`) }}
    </div>

    <div v-else-if="phase === 'error' && error" class="task-page__note" data-testid="task-page-error" :data-error="error.kind" role="alert">
      <span data-testid="task-page-error-text">{{ errorText }}</span>
      <a v-if="error.kind === 'external' && task" :href="addressOfTask(task)" target="_blank" rel="noopener" class="ml-3" data-testid="task-page-open-external">
        {{ text('taskPage.openExternal') }}
      </a>
      <v-btn v-if="canRetry" class="ml-3" variant="outlined" size="small" data-testid="task-page-retry" @click="retry">
        {{ text('taskPage.retry') }}
      </v-btn>
      <v-btn v-if="offersReload" class="ml-3" variant="outlined" size="small" data-testid="task-page-reload" @click="reloadPage">
        {{ text('taskPage.reload') }}
      </v-btn>
    </div>

    <div v-else ref="container" class="task-page__areas" :class="{ 'task-page__areas--laid-out': drawsAreas }" data-testid="task-page-areas">
      <template v-if="drawsAreas">
        <area-frame class="task-page__body" area="body" :is-suspended="isSuspended" :suspended-note="text('taskPage.suspended')" />
        <div class="task-page__column">
          <area-frame class="task-page__information" area="information" :is-suspended="isSuspended" :suspended-note="text('taskPage.suspended')" />
          <area-frame class="task-page__actions" area="actions" :is-suspended="isSuspended" :suspended-note="text('taskPage.suspended')" />
        </div>
      </template>
      <area-frame v-else class="task-page__all" area="all" :is-suspended="isSuspended" :suspended-note="text('taskPage.suspended')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { useTexts } from '../i18n/texts';
import { addressOfTask } from '../modules/task-address';
import { useUserTaskPage, type TaskPageError } from '../modules/use-user-task-page';
import AreaFrame from './AreaFrame.vue';

const props = defineProps<{ id: string }>();
const { text } = useTexts();

const container = ref<HTMLElement | null>(null);
const { task, phase, error, drawsAreas, isSuspended, offersReload, canRetry, retry, reloadPage } = useUserTaskPage(toRef(props, 'id'), container);

const isLoading = computed(() => phase.value === 'task' || phase.value === 'ask' || phase.value === 'load');

const NOTE_KEY_OF_ERROR: Record<TaskPageError['kind'], string> = {
  task: 'taskPage.error.task',
  'cannot-open': 'taskPage.error.cannotOpen',
  external: 'taskPage.external',
  'no-form': 'taskPage.error.noForm',
  'data-entry': 'taskPage.error.dataEntry',
  'visual-entry': 'taskPage.error.visualEntry',
  'not-defined': 'taskPage.error.notDefined',
  'wrong-name': 'taskPage.error.wrongName',
  updated: 'taskPage.error.updated',
  manifest: 'taskPage.error.manifest',
  draw: 'taskPage.error.draw',
};

// The notes name the module, the entry and the web component, so the author of the module finds the fault.
function namesOf(failure: TaskPageError) {
  return {
    module: 'moduleId' in failure ? failure.moduleId : '',
    entry: 'entry' in failure ? failure.entry : '',
    element: 'element' in failure ? failure.element : '',
    prefix: 'prefix' in failure ? failure.prefix : '',
  };
}

const errorText = computed(() => (error.value ? text(NOTE_KEY_OF_ERROR[error.value.kind], namesOf(error.value)) : ''));
</script>

<style scoped>
.task-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--v-layout-top, 64px));
}
.task-page__note {
  display: flex;
  align-items: center;
  padding: 24px;
}
.task-page__areas {
  flex: 1;
  min-height: 0;
  display: flex;
}
.task-page__areas--laid-out .task-page__body {
  flex: 1;
  min-width: 0;
}
/* The column fills the whole visible height: information scrolls on its own, actions stay at the bottom. */
.task-page__column {
  display: flex;
  flex-direction: column;
  flex: none;
  width: 320px;
  min-height: 0;
  border-left: 1px solid rgb(var(--v-theme-surface-variant));
}
.task-page__information {
  flex: 1;
  min-height: 0;
}
.task-page__actions {
  flex: none;
  max-height: 50%;
  border-top: 1px solid rgb(var(--v-theme-surface-variant));
}
.task-page__all {
  flex: 1;
  min-width: 0;
}
</style>

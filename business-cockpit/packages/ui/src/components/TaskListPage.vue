<template>
  <div class="task-list-page" data-testid="task-list-page" :data-list="list">
    <task-status-line :list="list" :filter="taskList.filter.value" @choose="chooseFilter" />

    <div ref="scroller" class="task-list" data-testid="task-list" @scroll.passive="loadWhileNearTheEnd">
      <div class="task-list__content" :style="{ minWidth: `${widthOfColumns}px` }">
        <div class="task-list__header" :style="{ gridTemplateColumns: gridTemplate }" data-testid="task-list-header">
          <div v-for="column in columns" :key="column.key" class="task-list__heading" :data-column="column.key" :data-path="column.pathFor(language)">
            <v-icon v-if="column.key === 'candidateUsers'" :icon="mdiAccountMultiple" size="small" :aria-label="text(column.headingKey)" />
            <span v-else-if="column.key !== 'select'">{{ text(column.headingKey) }}</span>
          </div>
        </div>

        <task-row
          v-for="task in taskList.rows.value"
          :key="task.id"
          :task="task"
          :columns="columns"
          :is-selected="selectedIds.has(task.id)"
          @select="(isSelected) => selectTask(task.id, isSelected)"
        />

        <div v-if="taskList.hasLoadedFirstPage.value && taskList.rows.value.length === 0" class="pa-4" data-testid="task-list-empty">
          {{ text('list.empty') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { mdiAccountMultiple } from '@mdi/js';
import { refreshAllCounts, tellWhichListIsOpen } from '../counts/counts';
import { useTexts } from '../i18n/texts';
import { LOAD_NEXT_PAGE_MARGIN_PX } from '../lists/list-constants';
import { choosePrimaryFilter, loadPrimaryFilterChoice } from '../lists/primary-filter-choice';
import type { TaskPrimaryFilter } from '../lists/primary-filters';
import { columnsShownFor, gridTemplateOf } from '../lists/task-columns';
import type { TaskListName } from '../lists/task-lists';
import { useTaskList } from '../lists/use-task-list';
import TaskRow from './TaskRow.vue';
import TaskStatusLine from './TaskStatusLine.vue';

const props = defineProps<{ list: TaskListName }>();

const { text, language } = useTexts();

const taskList = useTaskList(props.list);
const scroller = ref<HTMLElement>();
const selectedIds = ref(new Set<string>());

const columns = computed(() => columnsShownFor(taskList.filter.value ?? 'OpenTasksWithoutFollowUp'));
const gridTemplate = computed(() => gridTemplateOf(columns.value));
const widthOfColumns = computed(() => columns.value.reduce((sum, column) => sum + column.widthPx, 0));

function selectTask(taskId: string, isSelected: boolean): void {
  const selection = new Set(selectedIds.value);
  if (isSelected) selection.add(taskId);
  else selection.delete(taskId);
  selectedIds.value = selection;
}

function chooseFilter(filter: TaskPrimaryFilter): void {
  if (filter === taskList.filter.value) return;
  choosePrimaryFilter(props.list, filter);
  selectedIds.value = new Set();
  taskList.showWith(filter);
}

function loadWhileNearTheEnd(): void {
  const area = scroller.value;
  if (!area) return;
  const distanceToEnd = area.scrollHeight - area.scrollTop - area.clientHeight;
  if (distanceToEnd < LOAD_NEXT_PAGE_MARGIN_PX) taskList.loadNextPage();
}

// A tall window shows the first page without a scroll, so the end is near without any scrolling.
watch(
  () => taskList.rows.value.length,
  async () => {
    await nextTick();
    loadWhileNearTheEnd();
  },
);

onMounted(async () => {
  tellWhichListIsOpen(props.list);
  taskList.showWith(await loadPrimaryFilterChoice(props.list));
  refreshAllCounts();
});

onBeforeUnmount(() => {
  taskList.close();
  tellWhichListIsOpen(undefined);
});
</script>

<style scoped>
.task-list-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--v-layout-top, 64px));
}
.task-list {
  flex: 1;
  min-height: 0;
  /* Both scroll bars always have their room, so the list does not draw itself again when one appears. */
  overflow: scroll;
}
.task-list__header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: grid;
  height: 40px;
  align-items: center;
  background: rgb(var(--v-theme-surface));
  border-bottom: 2px solid rgb(var(--v-theme-surface-variant));
  font-weight: 600;
}
.task-list__heading {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 8px;
}
.task-list__heading[data-column='candidateUsers'],
.task-list__heading[data-column='select'] {
  justify-content: center;
  padding: 0;
}
</style>

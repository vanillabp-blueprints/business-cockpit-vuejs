<template>
  <div class="task-list-page" data-testid="task-list-page" :data-list="list">
    <div class="task-list-page__top">
      <task-status-line :list="list" :filter="taskList.filter.value" @choose="chooseFilter" />
      <list-search-bar
        :query="query"
        :load-suggestions="suggestWordsFor"
        @search="listQuery.searchFor"
        @reset="listQuery.resetSearchAndFilters"
      />
    </div>

    <!-- Its room is there always, so the list does not move when the sign goes away. -->
    <div class="task-list-page__loading">
      <v-progress-linear v-if="!taskList.hasLoadedFirstPage.value" indeterminate :aria-label="text('list.loading')" data-testid="list-loading" />
    </div>

    <div ref="scroller" class="task-list" data-testid="task-list" @scroll.passive="tellWhichRowsAreVisible">
      <div class="task-list__content" :style="{ minWidth: `${widthOfColumns}px` }">
        <div class="task-list__header" :style="{ gridTemplateColumns: gridTemplate }" data-testid="task-list-header">
          <div v-for="column in columns" :key="column.key" class="task-list__heading" :data-column="column.key" :data-path="column.pathFor(language)">
            <v-icon v-if="column.key === 'candidateUsers'" :icon="mdiAccountMultiple" size="small" :aria-label="text(column.headingKey)" />
            <column-heading
              v-else-if="column.key !== 'select'"
              :column-key="column.key"
              :name="text(column.headingKey)"
              :sortable="column.sortable"
              :filterable="column.filterable"
              :sort="query.sort"
              :filter-term="query.filterOfColumn[column.key] ?? ''"
              @sort="listQuery.sortBy(column.key)"
              @filter="listQuery.filterColumn(column.key, $event)"
            />
          </div>
        </div>

        <!-- The rows stand where they belong in the whole list. Only the rows of the window exist. -->
        <div class="task-list__rows" :style="{ height: `${heightOfRows}px` }" data-testid="task-list-rows">
          <template v-for="row in taskList.rowsToDraw.value" :key="row.index">
            <task-row
              v-if="row.task"
              :task="row.task"
              :columns="columns"
              :is-selected="selectedIds.has(row.task.id)"
              :style="{ top: `${row.index * ROW_HEIGHT_PX}px` }"
              @select="(isSelected) => selectTask(row.task!.id, isSelected)"
            />
            <div
              v-else
              class="task-placeholder"
              :style="{ top: `${row.index * ROW_HEIGHT_PX}px`, height: `${ROW_HEIGHT_PX}px` }"
              data-testid="task-placeholder"
            />
          </template>

          <div
            v-if="taskList.isCapped.value"
            class="task-list__cap-notice"
            :style="{ top: `${taskList.length.value * ROW_HEIGHT_PX}px`, height: `${ROW_HEIGHT_PX}px` }"
            data-testid="list-cap-notice"
          >
            {{ text('list.capNotice', { limit: formatNumber(MAX_LIST_ENTRIES) }) }}
          </div>
        </div>

        <div v-if="taskList.hasLoadedFirstPage.value && taskList.length.value === 0" class="pa-4" data-testid="task-list-empty">
          {{ text('list.empty') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { mdiAccountMultiple } from '@mdi/js';
import { refreshAllCounts, tellWhichListIsOpen } from '../counts/counts';
import { useTexts } from '../i18n/texts';
import { HEADER_HEIGHT_PX, ROW_HEIGHT_PX } from '../lists/list-constants';
import { MAX_LIST_ENTRIES } from '../lists/max-list-entries';
import { choosePrimaryFilter, loadPrimaryFilterChoice } from '../lists/primary-filter-choice';
import { DEFAULT_TASK_PRIMARY_FILTER, type TaskPrimaryFilter } from '../lists/primary-filters';
import { requestPartOf } from '../lists/list-query';
import { loadSuggestionsForTasks } from '../lists/task-list-api';
import { useListQuery } from '../lists/use-list-query';
import { columnsShownFor, gridTemplateOf } from '../lists/task-columns';
import type { TaskListName } from '../lists/task-lists';
import { useTaskList } from '../lists/use-task-list';
import ColumnHeading from './ColumnHeading.vue';
import ListSearchBar from './ListSearchBar.vue';
import TaskRow from './TaskRow.vue';
import TaskStatusLine from './TaskStatusLine.vue';

const props = defineProps<{ list: TaskListName }>();

const { text, language, formatNumber } = useTexts();

const taskList = useTaskList(props.list);
const scroller = ref<HTMLElement>();
const selectedIds = ref(new Set<string>());

const listQuery = useListQuery();
const query = listQuery.query;

const columns = computed(() => columnsShownFor(taskList.filter.value ?? 'OpenTasksWithoutFollowUp'));
const gridTemplate = computed(() => gridTemplateOf(columns.value));
// One more row of room after the last one when the list is capped: the notice stands there.
const heightOfRows = computed(() => (taskList.length.value + (taskList.isCapped.value ? 1 : 0)) * ROW_HEIGHT_PX);
const widthOfColumns = computed(() => columns.value.reduce((sum, column) => sum + column.widthPx, 0));

function selectTask(taskId: string, isSelected: boolean): void {
  const selection = new Set(selectedIds.value);
  if (isSelected) selection.add(taskId);
  else selection.delete(taskId);
  selectedIds.value = selection;
}

// The columns of the primary filter decide which sort and which column filters still count.
const searchAndSort = (filter: TaskPrimaryFilter) => requestPartOf(query.value, columnsShownFor(filter), language.value);

/** Shows the list from its first row again, for a new primary filter, a new search or a new sort. */
function showFromTheStart(filter: TaskPrimaryFilter): void {
  selectedIds.value = new Set();
  if (scroller.value) scroller.value.scrollTop = 0;
  taskList.showWith(filter, searchAndSort(filter));
}

function chooseFilter(filter: TaskPrimaryFilter): void {
  if (filter === taskList.filter.value) return;
  choosePrimaryFilter(props.list, filter);
  showFromTheStart(filter);
}

watch(query, () => {
  if (taskList.filter.value) showFromTheStart(taskList.filter.value);
});

/** The suggestions keep to the filters of the columns. The full-text search itself is what the user is still typing. */
function suggestWordsFor(input: string): Promise<string[]> {
  const conditionsOfColumns = (searchAndSort(taskList.filter.value ?? DEFAULT_TASK_PRIMARY_FILTER).searchQueries ?? []).filter((condition) => condition.path);
  return loadSuggestionsForTasks(props.list, input, conditionsOfColumns);
}

/**
 * The header covers the top of the scrolled area, so the first row the user sees is the one at the
 * scroll position, counted in rows. One row more on each side makes up for rows only half in view.
 */
function tellWhichRowsAreVisible(): void {
  const area = scroller.value;
  if (!area) return;
  const rowsInView = Math.ceil((area.clientHeight - HEADER_HEIGHT_PX) / ROW_HEIGHT_PX);
  const firstRow = Math.floor(area.scrollTop / ROW_HEIGHT_PX);
  taskList.showRows({ first: firstRow, last: firstRow + rowsInView });
}

// The first answer gives the list its length, and a resized area shows more or fewer rows.
watch(() => taskList.hasLoadedFirstPage.value, tellWhichRowsAreVisible, { flush: 'post' });
let watchesSize: ResizeObserver | undefined;

onMounted(async () => {
  tellWhichListIsOpen(props.list);
  watchesSize = new ResizeObserver(tellWhichRowsAreVisible);
  watchesSize.observe(scroller.value!);
  tellWhichRowsAreVisible();
  const filter = await loadPrimaryFilterChoice(props.list);
  taskList.showWith(filter, searchAndSort(filter));
  refreshAllCounts();
});

onBeforeUnmount(() => {
  watchesSize?.disconnect();
  taskList.close();
  tellWhichListIsOpen(undefined);
});
</script>

<style scoped>
.task-list-page__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
}
.task-list-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--v-layout-top, 64px));
}
.task-list-page__loading {
  height: 4px;
  flex: none;
}
.task-list {
  flex: 1;
  min-height: 0;
  /* Both scroll bars always have their room, so the list does not draw itself again when one appears. */
  overflow: scroll;
  /* The list sets its own height. The browser must not move the scroll position when it changes. */
  overflow-anchor: none;
}
.task-list__rows {
  position: relative;
}
.task-placeholder,
.task-list__cap-notice {
  position: absolute;
  left: 0;
  right: 0;
  box-sizing: border-box;
}
.task-placeholder {
  border-bottom: 1px solid rgb(var(--v-theme-surface-variant));
  background: linear-gradient(rgb(var(--v-theme-surface-variant)), rgb(var(--v-theme-surface-variant))) 8px 50% / 30% 12px no-repeat;
  opacity: 0.6;
}
.task-list__cap-notice {
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: rgb(var(--v-theme-surface-variant));
  font-style: italic;
  user-select: none;
  cursor: default;
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

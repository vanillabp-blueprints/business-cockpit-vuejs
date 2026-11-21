<template>
  <div class="status-line" data-testid="status-line">
    <v-btn-toggle :model-value="filter" mandatory divided density="comfortable">
      <v-btn
        v-for="primaryFilter in TASK_PRIMARY_FILTERS"
        :key="primaryFilter"
        :value="primaryFilter"
        :data-testid="`primary-filter-${primaryFilter}`"
        @click="$emit('choose', primaryFilter)"
        @mouseenter="primaryFilter === FILTER_COUNTED_ON_MOUSE_OVER && refreshCountOfClosedTasks(list)"
        @mouseleave="primaryFilter === FILTER_COUNTED_ON_MOUSE_OVER && forgetCountOfClosedTasks()"
      >
        {{ text(`filters.${primaryFilter}`) }}
        <count-badge class="ml-1" :count="countOf(primaryFilter)" :testid="`primary-filter-count-${primaryFilter}`" />
      </v-btn>
    </v-btn-toggle>
  </div>
</template>

<script setup lang="ts">
import { countOfClosedTasks, countsOfFilters, forgetCountOfClosedTasks, refreshCountOfClosedTasks } from '../counts/counts';
import { useTexts } from '../i18n/texts';
import { FILTER_COUNTED_ON_MOUSE_OVER, TASK_PRIMARY_FILTERS, type TaskPrimaryFilter } from '../lists/primary-filters';
import type { TaskListName } from '../lists/task-lists';
import CountBadge from './CountBadge.vue';

const props = defineProps<{ list: TaskListName; filter: TaskPrimaryFilter | undefined }>();
defineEmits<{ choose: [filter: TaskPrimaryFilter] }>();

const { text } = useTexts();

function countOf(primaryFilter: TaskPrimaryFilter): number | undefined {
  return primaryFilter === FILTER_COUNTED_ON_MOUSE_OVER ? countOfClosedTasks.value : countsOfFilters.value[props.list][primaryFilter];
}
</script>

<style scoped>
.status-line {
  display: flex;
  padding: 8px 16px;
}
</style>

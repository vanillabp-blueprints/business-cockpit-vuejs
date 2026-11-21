<template>
  <!-- A span, so a heading is still found as the one div that holds its name. -->
  <span class="column-heading" :data-sort="direction" data-testid="column-heading">
    <!-- A column without `sortable` is plain text: no pointer, no mark, no click. -->
    <button
      v-if="sortable"
      type="button"
      class="column-heading__sort"
      :aria-label="text('sort.by', { column: name })"
      :aria-sort="ariaSort"
      :data-testid="`sort-${columnKey}`"
      @click="$emit('sort')"
    >
      <span>{{ name }}</span>
      <v-icon v-if="direction !== 'none'" :icon="direction === 'ascending' ? mdiArrowUp : mdiArrowDown" size="small" :data-testid="`sort-mark-${columnKey}`" />
    </button>
    <span v-else>{{ name }}</span>

    <column-filter v-if="filterable" :column-key="columnKey" :column-name="name" :term="filterTerm" @filter="$emit('filter', $event)" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { mdiArrowDown, mdiArrowUp } from '@mdi/js';
import { useTexts } from '../i18n/texts';
import type { ListSort } from '../lists/list-query';
import ColumnFilter from './ColumnFilter.vue';

const props = defineProps<{
  columnKey: string;
  name: string;
  sortable: boolean;
  filterable: boolean;
  sort: ListSort | undefined;
  filterTerm: string;
}>();
defineEmits<{ sort: []; filter: [term: string] }>();

const { text } = useTexts();

const direction = computed(() => {
  if (!props.sortable || props.sort?.columnKey !== props.columnKey) return 'none';
  return props.sort.isAscending ? 'ascending' : 'descending';
});
const ariaSort = computed(() => direction.value);
</script>

<style scoped>
.column-heading {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.column-heading__sort {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  background: none;
  border: 0;
  padding: 0;
}
</style>

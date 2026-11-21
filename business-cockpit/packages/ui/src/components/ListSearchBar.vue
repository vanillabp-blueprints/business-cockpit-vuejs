<template>
  <div class="search-bar" data-testid="search-bar">
    <list-search-field :applied-search="query.fullText" :load-suggestions="loadSuggestions" @search="$emit('search', $event)" />
    <v-btn variant="text" :disabled="!hasSearchOrFilter(query)" data-testid="reset-search" @click="$emit('reset')">
      {{ text('search.reset') }}
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { useTexts } from '../i18n/texts';
import { hasSearchOrFilter, type ListQuery } from '../lists/list-query';
import ListSearchField from './ListSearchField.vue';

defineProps<{ query: ListQuery; loadSuggestions: (input: string) => Promise<string[]> }>();
defineEmits<{ search: [fullText: string]; reset: [] }>();

const { text } = useTexts();
</script>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
}
</style>

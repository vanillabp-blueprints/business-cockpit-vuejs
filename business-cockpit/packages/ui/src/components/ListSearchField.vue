<template>
  <div class="search-field" data-testid="search-field">
    <v-text-field
      v-model="input"
      density="compact"
      variant="outlined"
      hide-details
      :placeholder="text('search.placeholder')"
      :aria-label="text('search.placeholder')"
      :prepend-inner-icon="mdiMagnify"
      autocomplete="off"
      data-testid="search-input"
      @update:model-value="suggestionSource.inputChanged"
      @keydown.enter="takeInput"
      @keydown.esc="suggestionSource.stop"
      @blur="closeSuggestionsSoon"
    >
      <template #append-inner>
        <v-btn
          v-if="input !== ''"
          :icon="mdiClose"
          size="x-small"
          variant="text"
          :aria-label="text('search.clear')"
          data-testid="search-clear"
          @mousedown.prevent
          @click="clear"
        />
      </template>
    </v-text-field>

    <ul v-if="suggestions.length > 0" class="search-field__suggestions" role="listbox" data-testid="search-suggestions">
      <!-- mousedown, not click: the field loses focus first, and the list would be gone before the click. -->
      <li
        v-for="suggestion in suggestions"
        :key="suggestion"
        role="option"
        class="search-field__suggestion"
        data-testid="search-suggestion"
        @mousedown.prevent="takeSuggestion(suggestion)"
      >
        {{ suggestion }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { mdiClose, mdiMagnify } from '@mdi/js';
import { useTexts } from '../i18n/texts';
import { createSuggestionSource } from '../lists/suggestion-source';

const props = defineProps<{
  /** The search the list shows now. When it becomes empty from outside, for example by a reset, so does the input. */
  appliedSearch: string;
  /** Asks the list for words that contain the input. */
  loadSuggestions: (input: string) => Promise<string[]>;
}>();
const emit = defineEmits<{ search: [fullText: string] }>();

const { text } = useTexts();

const input = ref(props.appliedSearch);
const suggestions = ref<string[]>([]);
const suggestionSource = createSuggestionSource(props.loadSuggestions, (words) => (suggestions.value = words));

watch(
  () => props.appliedSearch,
  (applied) => {
    if (applied !== input.value) {
      input.value = applied;
      suggestionSource.stop();
    }
  },
);

function takeInput(): void {
  suggestionSource.stop();
  emit('search', input.value);
}

function takeSuggestion(suggestion: string): void {
  input.value = suggestion;
  takeInput();
}

function clear(): void {
  input.value = '';
  takeInput();
}

function closeSuggestionsSoon(): void {
  suggestionSource.stop();
}

onBeforeUnmount(suggestionSource.stop);
</script>

<style scoped>
.search-field {
  position: relative;
  width: 360px;
}
.search-field__suggestions {
  position: absolute;
  z-index: 3;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 320px;
  margin: 2px 0 0;
  padding: 4px 0;
  overflow-y: auto;
  list-style: none;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-surface-variant));
  border-radius: 4px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.2);
}
.search-field__suggestion {
  padding: 6px 12px;
  cursor: pointer;
}
.search-field__suggestion:hover {
  background: rgb(var(--v-theme-surface-variant));
}
</style>

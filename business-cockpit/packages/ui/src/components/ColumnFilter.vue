<template>
  <v-menu v-model="isOpen" :close-on-content-click="false" location="bottom" @after-leave="draft = term">
    <template #activator="{ props: activator }">
      <v-btn
        v-bind="activator"
        :icon="mdiFilterVariant"
        size="x-small"
        variant="text"
        :color="term ? 'primary' : undefined"
        :aria-label="text('filter.open', { column: columnName })"
        :data-active="term !== ''"
        :data-testid="`filter-button-${columnKey}`"
        @click.stop
      />
    </template>
    <v-card class="pa-2" min-width="240">
      <v-text-field
        v-model="draft"
        density="compact"
        variant="outlined"
        hide-details
        autofocus
        autocomplete="off"
        :label="text('filter.label', { column: columnName })"
        :data-testid="`filter-input-${columnKey}`"
        @keydown.enter="apply(draft)"
      >
        <template #append-inner>
          <v-btn
            v-if="draft !== ''"
            :icon="mdiClose"
            size="x-small"
            variant="text"
            :aria-label="text('filter.clear')"
            :data-testid="`filter-clear-${columnKey}`"
            @click="apply('')"
          />
        </template>
      </v-text-field>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { mdiClose, mdiFilterVariant } from '@mdi/js';
import { useTexts } from '../i18n/texts';

const props = defineProps<{ columnKey: string; columnName: string; term: string }>();
const emit = defineEmits<{ filter: [term: string] }>();

const { text } = useTexts();

const isOpen = ref(false);
// What the user types stays a draft until Enter. A reset from outside replaces it.
const draft = ref(props.term);
watch(() => props.term, (term) => (draft.value = term));

function apply(term: string): void {
  draft.value = term;
  isOpen.value = false;
  emit('filter', term);
}
</script>

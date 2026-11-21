<template>
  <span v-if="moment" data-testid="date-cell">
    {{ cell.shown }}
    <v-tooltip activator="parent" location="bottom">
      <span data-testid="date-cell-details">{{ cell.onMouseOver }}</span>
    </v-tooltip>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTexts } from '../i18n/texts';

const props = defineProps<{ moment?: string }>();

const { dateCellOf } = useTexts();
const cell = computed(() => (props.moment ? dateCellOf(props.moment) : { shown: '', onMouseOver: '' }));
</script>

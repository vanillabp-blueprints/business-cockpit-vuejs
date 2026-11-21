<template>
  <hover-tooltip v-if="moment" data-testid="date-cell">
    {{ cell.shown }}
    <template #tip>
      <span data-testid="date-cell-details">{{ cell.onMouseOver }}</span>
    </template>
  </hover-tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTexts } from '../i18n/texts';
import HoverTooltip from './HoverTooltip.vue';

const props = defineProps<{ moment?: string }>();

const { dateCellOf } = useTexts();
const cell = computed(() => (props.moment ? dateCellOf(props.moment) : { shown: '', onMouseOver: '' }));
</script>

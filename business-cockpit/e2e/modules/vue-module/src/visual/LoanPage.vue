<script setup>
import { computed, inject } from 'vue';
import { PROPS_KEY } from './props-key.js';

const props = inject(PROPS_KEY);
const title = computed(() => props.value.workflow.title?.[props.value.language] ?? '');
</script>

<template>
  <div class="form" data-testid="module-form" data-framework="vue" data-area="all">
    <h2 data-testid="module-title">{{ title }}</h2>
  </div>
</template>

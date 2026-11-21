<script setup>
import { computed, inject, ref } from 'vue';
import { PROPS_KEY } from './props-key.js';

const props = inject(PROPS_KEY);
const clicks = ref(0);

const area = computed(() => props.value.area);
const task = computed(() => props.value.userTask);
const title = computed(() => task.value.title[props.value.language] ?? Object.values(task.value.title)[0]);
const workflowTitle = computed(() => task.value.workflowTitle?.[props.value.language] ?? '');
const shows = (part) => area.value === 'all' || area.value === part;
</script>

<template>
  <div class="form" data-testid="module-form" data-framework="vue" :data-area="area">
    <div v-if="shows('body')">
      <h2 data-testid="module-title">{{ title }}</h2>
      <span data-testid="module-state">{{ task.suspendedAt ? 'suspended' : 'active' }}</span>
      <input data-testid="module-input" placeholder="Remark" />
      <button data-testid="module-button" @click="clicks++">Clicked {{ clicks }}</button>
      <div style="height: 1500px" data-testid="module-spacer" />
    </div>
    <div v-if="shows('information')">
      <div data-testid="module-business-id">{{ task.businessId }}</div>
      <div data-testid="module-case-title">{{ workflowTitle }}</div>
    </div>
    <div v-if="shows('actions')">
      <button data-testid="module-complete">Complete</button>
    </div>
  </div>
</template>

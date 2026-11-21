<template>
  <span class="hover-tooltip" @mouseenter="isShown = true" @mouseleave="leave">
    <slot />
    <!--
      The tooltip is made when the mouse comes over, not with the row. A list draws thousands of
      rows while the user scrolls, and a tooltip in each of them costs time and memory.
    -->
    <v-tooltip
      v-if="isShown"
      :model-value="true"
      activator="parent"
      location="bottom"
      :interactive="interactive"
      @update:model-value="(isOpen: boolean) => !isOpen && (isShown = false)"
    >
      <slot name="tip" />
    </v-tooltip>
  </span>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ interactive?: boolean }>();

const isShown = ref(false);

// An interactive tooltip stays while the mouse is over it, so the tooltip itself says when it closes.
function leave(): void {
  if (!props.interactive) isShown.value = false;
}
</script>

<style scoped>
.hover-tooltip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
}
</style>

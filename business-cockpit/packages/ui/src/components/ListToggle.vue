<template>
  <v-btn-toggle :model-value="shownList" mandatory divided density="comfortable" data-testid="list-toggle">
    <v-btn
      v-for="part in parts"
      :key="part.screen"
      :value="part.screen"
      :to="pathOfScreen(part.screen, language)"
      :data-testid="`toggle-${part.screen}`"
    >
      {{ text(part.textKey) }}
      <count-badge class="ml-1" :count="part.count" :testid="`toggle-count-${part.screen}`" />
    </v-btn>
  </v-btn-toggle>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { countsOfToggle } from '../counts/counts';
import { useTexts } from '../i18n/texts';
import { pathOfScreen, type ScreenName } from '../router/screens';
import CountBadge from './CountBadge.vue';

const { text, language } = useTexts();
const route = useRoute();

const parts = computed(() => [
  { screen: 'my-tasks' as const, textKey: 'lists.myTasks', count: countsOfToggle.value['my-tasks'] },
  { screen: 'tasks' as const, textKey: 'lists.allTasks', count: countsOfToggle.value.tasks },
  { screen: 'workflows' as const, textKey: 'lists.cases', count: countsOfToggle.value.cases },
]);

const shownList = computed<ScreenName | undefined>(() =>
  parts.value.find((part) => part.screen === route.name)?.screen,
);
</script>

<template>
  <v-app-bar flat border="b" :class="stateOfOpenTask && `app-header--${stateOfOpenTask}`" :data-state="stateOfOpenTask" data-testid="app-header">
    <img :src="logoUrl" alt="" class="header-logo ml-4" />
    <v-app-bar-title data-testid="header-title">
      {{ appInformation?.titleShort }}
      <v-tooltip v-if="appInformation" activator="parent" location="bottom">
        <span data-testid="header-version-info">{{ versionInfo }}</span>
      </v-tooltip>
    </v-app-bar-title>
    <list-toggle class="mx-4" />
    <!-- The menu slides in from the right, so the burger sits there as well. -->
    <v-app-bar-nav-icon :aria-label="text('header.openMenu')" data-testid="open-menu" @click="$emit('open-menu')" />
  </v-app-bar>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import logoUrl from '@example/bc-theme/logo/vanillabp-logo-compact.svg';
import { useTexts } from '../i18n/texts';
import ListToggle from './ListToggle.vue';
import { rowStateOf } from '../lists/row-state';
import { openTask } from '../modules/open-task';
import { appInformation } from '../session/session';

defineEmits<{ 'open-menu': [] }>();

const { text, formatDateTime } = useTexts();

// While a task is open, the header looks like the row of that task, but it shows no title.
const stateOfOpenTask = computed(() => (openTask.value ? rowStateOf(openTask.value) : undefined));

const versionInfo = computed(() => {
  const information = appInformation.value;
  if (!information) return '';
  const builtOn = information.buildTimestamp ? formatDateTime(information.buildTimestamp) : '-';
  return text('header.versionInfo', { version: information.version, builtOn });
});
</script>

<style scoped>
.header-logo {
  height: 2rem;
}
.app-header--completed,
.app-header--cancelled {
  background: var(--bc-color-row-ended);
}
.app-header--suspended {
  color: var(--bc-color-text-suspended);
}
</style>

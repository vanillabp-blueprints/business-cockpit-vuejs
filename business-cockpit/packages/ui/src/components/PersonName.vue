<template>
  <hover-tooltip class="person-name" data-testid="person-name">
    {{ shortNameOf(person) }}
    <template #tip>
      <div data-testid="person-details">
        <div>{{ person.display ?? person.id }}</div>
        <div>{{ text('user.id') }}: {{ person.id }}</div>
        <div v-if="person.email">{{ person.email }}</div>
      </div>
    </template>
  </hover-tooltip>
</template>

<script setup lang="ts">
import type { Person } from '../generated/official-gui-api/types.gen';
import { useTexts } from '../i18n/texts';
import { shortNameOf } from '../session/person';
import HoverTooltip from './HoverTooltip.vue';

defineProps<{ person: Person }>();

const { text } = useTexts();
</script>

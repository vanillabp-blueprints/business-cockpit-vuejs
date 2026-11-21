<template>
  <span class="person-name" data-testid="person-name">
    {{ shortNameOf(person) }}
    <v-tooltip activator="parent" location="bottom">
      <div data-testid="person-details">
        <div>{{ person.display ?? person.id }}</div>
        <div>{{ text('user.id') }}: {{ person.id }}</div>
        <div v-if="person.email">{{ person.email }}</div>
      </div>
    </v-tooltip>
  </span>
</template>

<script setup lang="ts">
import type { Person } from '../generated/official-gui-api/types.gen';
import { useTexts } from '../i18n/texts';
import { shortNameOf } from '../session/person';

defineProps<{ person: Person }>();

const { text } = useTexts();
</script>

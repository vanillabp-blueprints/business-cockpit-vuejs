<template>
  <v-avatar color="primary" :size="size" class="user-badge" data-testid="user-badge">
    <span class="user-badge__initials">{{ initialsOf(person) }}</span>
    <!-- Hovering the badge, and not only the name, tells who the user is. -->
    <v-tooltip v-if="withDetails" activator="parent" location="bottom">
      <div data-testid="user-badge-details">
        <div>{{ person.display ?? person.id }}</div>
        <div>{{ text('user.id') }}: {{ person.id }}</div>
        <div v-if="person.email">{{ person.email }}</div>
      </div>
    </v-tooltip>
  </v-avatar>
</template>

<script setup lang="ts">
import { useTexts } from '../i18n/texts';
import type { Person } from '../generated/official-gui-api/types.gen';
import { initialsOf } from '../session/person';

withDefaults(defineProps<{ person: Person; size?: number; withDetails?: boolean }>(), {
  size: 40,
  withDetails: true,
});

const { text } = useTexts();
</script>

<style scoped>
.user-badge {
  color: rgb(var(--v-theme-on-primary));
  font-weight: 700;
}
</style>

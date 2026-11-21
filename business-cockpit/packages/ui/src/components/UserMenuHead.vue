<template>
  <div class="d-flex align-center pa-4" data-testid="menu-user">
    <user-badge :person="person" />
    <span class="user-name ml-auto text-subtitle-1" data-testid="user-name">
      {{ shortNameOf(person) }}
      <!-- The overview is drawn only while it is open, so the data is asked on the first mouse-over. -->
      <v-menu
        activator="parent"
        open-on-hover
        :open-on-click="false"
        :close-on-content-click="false"
        location="bottom end"
        :open-delay="100"
        :close-delay="200"
      >
        <rights-overview :person="person" />
      </v-menu>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { Person } from '../generated/official-gui-api/types.gen';
import { shortNameOf } from '../session/person';
import RightsOverview from './RightsOverview.vue';
import UserBadge from './UserBadge.vue';

defineProps<{ person: Person }>();
</script>

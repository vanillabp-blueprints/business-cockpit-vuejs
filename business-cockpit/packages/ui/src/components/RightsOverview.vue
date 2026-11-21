<template>
  <v-card class="rights-overview" data-testid="rights-overview" elevation="8" width="28rem">
    <v-card-text>
      <div class="d-flex justify-center mb-3">
        <user-badge :person="person" :size="56" :with-details="false" />
      </div>
      <h2 class="text-h6">{{ text('rights.title') }}</h2>
      <p class="mb-4">{{ text('rights.explanation') }}</p>

      <p v-if="isLoading" data-testid="rights-loading">{{ text('rights.loading') }}</p>
      <p v-else-if="tables.length === 0" data-testid="rights-nothing-known">{{ text('rights.nothingKnown') }}</p>
      <section v-for="table in tables" v-else :key="table.workflowModuleId" class="mb-4" data-testid="rights-table">
        <h3 class="text-subtitle-1">{{ table.workflowModuleId }}</h3>
        <v-table density="compact">
          <thead>
            <tr>
              <th>{{ text('rights.column.name') }}</th>
              <th>{{ text('rights.column.kind') }}</th>
              <th>{{ text('rights.column.givenBy') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in table.rows" :key="`${row.name}/${givenByName(row)}`" data-testid="rights-row">
              <td>{{ row.name }}</td>
              <td>{{ text(`rights.kind.${row.kind}`) }}</td>
              <td>{{ givenByName(row) }}</td>
            </tr>
          </tbody>
        </v-table>
      </section>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTexts } from '../i18n/texts';
import type { Person } from '../generated/official-gui-api/types.gen';
import { rightsOfUser } from '../session/session';
import { ORGANISATION, tablesOf, type RightRow } from '../session/rights-overview';
import UserBadge from './UserBadge.vue';

defineProps<{ person: Person }>();

const { text } = useTexts();

const isLoading = ref(true);
const answer = ref<Awaited<ReturnType<typeof rightsOfUser>>>();
const tables = computed(() => tablesOf(answer.value));

const givenByName = (row: RightRow) => (row.givenBy === ORGANISATION ? text('rights.givenBy.organisation') : row.givenBy);

// The overview is only drawn after the first mouse-over, so asking here is asking on the first mouse-over.
rightsOfUser().then((rights) => {
  answer.value = rights;
  isLoading.value = false;
});
</script>

<style scoped>
.rights-overview {
  /* About two thirds of the window; a longer table scrolls inside. */
  max-height: 66vh;
  overflow-y: auto;
}
</style>

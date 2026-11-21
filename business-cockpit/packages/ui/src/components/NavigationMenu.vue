<template>
  <v-navigation-drawer v-model="isOpen" temporary location="end" data-testid="menu" width="320">
    <div class="d-flex flex-column h-100">
      <user-menu-head v-if="currentUser" :person="currentUser" />
      <v-divider />

      <!-- The screens, the notification settings and the entries of workflow modules come here, before the language switch. -->
      <v-list class="flex-grow-1" data-testid="menu-entries" />

      <v-divider />
      <div class="pa-4" data-testid="language-switch">
        <div class="text-caption mb-1">{{ text('menu.language') }}</div>
        <v-btn-toggle :model-value="language" mandatory density="comfortable" divided @update:model-value="setLanguage">
          <v-btn v-for="offered in offeredLanguages" :key="offered" :value="offered" :data-testid="`language-${offered}`">
            {{ languageName(offered) }}
          </v-btn>
        </v-btn-toggle>
      </div>

      <v-divider />
      <v-list>
        <v-list-item :title="text('menu.logout')" data-testid="logout" @click="sendBrowserToLogout()" />
      </v-list>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { setLanguage, useTexts } from '../i18n/texts';
import { appInformation, currentUser } from '../session/session';
import { sendBrowserToLogout } from '../session/login';
import UserMenuHead from './UserMenuHead.vue';

const isOpen = defineModel<boolean>({ required: true });

const { text, language, availableLanguages, languageName } = useTexts();

// The backend names the languages on offer, for example `languages: en,de`.
const offeredLanguages = computed(() => {
  const named = String(appInformation.value?.additionalProperties?.languages ?? '').split(',').map((name) => name.trim());
  const offered = availableLanguages.filter((available) => named.includes(available));
  return offered.length > 0 ? offered : availableLanguages;
});
</script>

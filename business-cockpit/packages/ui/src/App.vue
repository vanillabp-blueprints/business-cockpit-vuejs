<template>
  <v-app>
    <!-- Nothing is drawn before the backend has said who is logged in. -->
    <template v-if="currentUser">
      <app-header @open-menu="isMenuOpen = true" />
      <navigation-menu v-model="isMenuOpen" />
      <v-main>
        <!-- The key makes a list of another route start from scratch instead of reusing the page. -->
        <router-view v-slot="{ Component, route }">
          <component :is="Component" :key="String(route.name)" />
        </router-view>
      </v-main>
    </template>
  </v-app>
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import AppHeader from './components/AppHeader.vue';
import NavigationMenu from './components/NavigationMenu.vue';
import { appInformation, currentUser } from './session/session';

const isMenuOpen = ref(false);

watchEffect(() => {
  if (appInformation.value) document.title = appInformation.value.titleLong;
});
</script>

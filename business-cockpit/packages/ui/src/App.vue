<template>
  <v-app>
    <v-main class="d-flex align-center justify-center">
      <img :src="logoUrl" alt="VanillaBP" class="shell-logo" />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import logoUrl from '@example/bc-theme/logo/vanillabp-logo-light.svg';
</script>

<style>
.shell-logo {
  max-width: 16rem;
}
</style>

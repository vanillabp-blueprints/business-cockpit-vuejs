<template>
  <span :data-testid="testid">
    {{ shown }}
    <!-- Only a count above the limit has a tooltip, so the many other counts stay cheap. -->
    <v-tooltip v-if="isAboveLimit" activator="parent" location="bottom" data-testid="count-above-limit-tooltip">
      {{ text('list.capNotice', { limit: formatNumber(MAX_LIST_ENTRIES) }) }}
    </v-tooltip>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTexts } from '../i18n/texts';
import { MAX_LIST_ENTRIES } from '../lists/max-list-entries';

const props = defineProps<{ count: number | undefined; testid: string }>();

const { text, formatNumber } = useTexts();

// A count that is not known yet shows nothing, so no wrong number flashes by.
const shown = computed(() => (props.count === undefined ? '' : `(${formatNumber(props.count)})`));
const isAboveLimit = computed(() => props.count !== undefined && props.count > MAX_LIST_ENTRIES);
</script>

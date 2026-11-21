<template>
  <div class="area-frame" :data-testid="`area-${area}`" @keydown.capture="blockKeys" @keyup.capture="blockKeys" @keypress.capture="blockKeys" @beforeinput.capture="blockKeys">
    <div class="area-frame__inner">
      <!-- The web component of the module is put here. -->
      <div class="area-frame__content" :data-bc-area="area" />
      <!--
        The barrier lies in the scroll container of the area and is as high as the content. So the wheel and
        touch scrolling still move the area, but a click does not reach the form. The content stays readable.
      -->
      <div v-if="isSuspended" class="area-frame__barrier" :title="suspendedNote" data-testid="barrier" data-barrier="suspended" />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ area: string; isSuspended: boolean; suspendedNote: string }>();

/** A key press must not reach the form under the barrier either; the capture phase stops it on its way down. */
function blockKeys(event: Event): void {
  if (!props.isSuspended) return;
  event.stopPropagation();
  event.preventDefault();
}
</script>

<style scoped>
.area-frame {
  overflow: auto;
  min-height: 0;
  min-width: 0;
}
/* As high as the content, and at least as high as the area, so the barrier covers all of what scrolls. */
.area-frame__inner {
  position: relative;
  min-height: 100%;
}
.area-frame__content > * {
  /* A web component is an inline element; the area gives it the whole width. */
  display: block;
}
.area-frame__barrier {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(var(--v-theme-surface), 0.45);
}
</style>

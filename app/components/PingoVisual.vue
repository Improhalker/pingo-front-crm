<script setup lang="ts">
// Individual assets are replaceable; never render the original identity board as an avatar.
defineProps<{ src: string; alt: string; width: number; height: number }>()
</script>
<template>
  <img
    :src="src"
    :alt="alt"
    :width="width"
    :height="height"
    decoding="async"
    class="max-w-full"
  />
</template>

<script setup lang="ts">
defineProps<{ label: string; performer?: string }>()
</script>

<template>
  <header class="mb-4 text-center">
    <span
      class="text-[12px] text-on-tertiary-container/60 uppercase tracking-[0.2em]"
    >
      {{ label }}<template v-if="performer"> &middot; {{ performer }}</template>
    </span>
  </header>
</template>

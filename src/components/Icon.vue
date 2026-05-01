<script setup lang="ts">
defineProps<{ name: string; filled?: boolean; size?: number }>()
</script>

<template>
  <span
    class="material-symbols-outlined"
    :style="{
      fontSize: size ? `${size}px` : undefined,
      fontVariationSettings: filled ? `'FILL' 1` : undefined,
    }"
  >{{ name }}</span>
</template>

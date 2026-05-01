<script setup lang="ts">
import { RouterView } from 'vue-router'
import BackgroundDecoration from '@/components/BackgroundDecoration.vue'
</script>

<template>
  <div class="no-print"><BackgroundDecoration /></div>
  <RouterView />
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { ref } from 'vue'

const auth = useAuthStore()
const error = ref<string | null>(null)

async function onGoogle() {
  error.value = null
  try {
    await auth.signInWithGoogle()
  } catch (e) {
    error.value = (e as Error).message
  }
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center px-6">
    <div class="max-w-sm w-full text-center">
      <h1 class="text-2xl font-light tracking-[0.2em] uppercase text-zinc-900 mb-2">LyricLens</h1>
      <p class="text-sm text-zinc-500 mb-10">Sign in to sync your library across devices.</p>

      <button
        @click="onGoogle"
        :disabled="auth.loading"
        class="w-full h-11 rounded-full bg-zinc-900 text-white text-sm tracking-wide hover:bg-zinc-800 disabled:opacity-50 transition-colors"
      >
        {{ auth.loading ? 'Opening Google…' : 'Continue with Google' }}
      </button>

      <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
    </div>
  </main>
</template>

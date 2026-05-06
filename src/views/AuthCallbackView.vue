<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

// supabase-js (detectSessionInUrl: true) parses the OAuth fragment automatically
// once the client is constructed. We just need to wait until it has settled, then
// forward the user to the library.
onMounted(async () => {
  if (!auth.ready) await auth.init()
  router.replace(auth.isAuthenticated ? '/library' : '/login')
})
</script>

<template>
  <main class="min-h-screen flex items-center justify-center">
    <p class="text-sm text-zinc-500 tracking-wide">Signing you in…</p>
  </main>
</template>

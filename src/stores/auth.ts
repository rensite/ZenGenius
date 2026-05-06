import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { clearCache } from '@/api/drivers/cache'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  // `null` while we're still resolving the initial session from storage; this
  // matters for the router guard so it doesn't bounce a logged-in user to /login
  // before supabase-js has rehydrated.
  const ready = ref(false)
  const loading = ref(false)

  // App falls back to LocalDriver when Supabase is not configured. In that mode
  // there is no auth at all and the guard treats everything as authorized.
  const cloud = supabase != null

  const isAuthenticated = computed(() => !cloud || user.value != null)

  async function init() {
    if (!supabase) {
      ready.value = true
      return
    }
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    user.value = data.session?.user ?? null
    supabase.auth.onAuthStateChange((_event, next) => {
      session.value = next
      user.value = next?.user ?? null
    })
    ready.value = true
  }

  async function signInWithGoogle() {
    if (!supabase) throw new Error('Supabase is not configured')
    loading.value = true
    try {
      // We use hash history (#/), so the OAuth provider must redirect back to a
      // hash route. The auth callback view then strips the URL and forwards to
      // the library.
      const redirectTo = `${window.location.origin}${window.location.pathname}#/auth/callback`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (error) throw error
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    if (!supabase) return
    loading.value = true
    try {
      await supabase.auth.signOut()
      // Cached rows belong to the user that just signed out — purge so the next
      // user can't ever see them on first load (before the network round-trip).
      await clearCache()
    } finally {
      loading.value = false
    }
  }

  return {
    user,
    session,
    ready,
    loading,
    cloud,
    isAuthenticated,
    init,
    signInWithGoogle,
    signOut,
  }
})

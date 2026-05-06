import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// `supabase` from '@/lib/supabase' is null when env vars are missing — which is
// the case in tests. That's exactly the LocalDriver fallback path we want to
// verify here: with no Supabase, auth.isAuthenticated must always be true so the
// router guard doesn't lock the user out of the app in dev mode.

describe('auth store (no Supabase configured)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetModules()
  })

  it('treats every user as authenticated when running in LocalDriver mode', async () => {
    const { useAuthStore } = await import('@/stores/auth')
    const auth = useAuthStore()
    await auth.init()
    expect(auth.cloud).toBe(false)
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.ready).toBe(true)
  })

  it('throws if signInWithGoogle is called without Supabase configured', async () => {
    const { useAuthStore } = await import('@/stores/auth')
    const auth = useAuthStore()
    await expect(auth.signInWithGoogle()).rejects.toThrow(/not configured/)
  })
})

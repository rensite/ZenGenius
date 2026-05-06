import { beforeEach } from 'vitest'
import { SupabaseDriver } from '@/api/drivers/supabase.driver'
import { clearCache } from '@/api/drivers/cache'
import { FakeSupabase } from './helpers/fakeSupabase'
import { runDriverContract } from './contracts/driver.contract'
import type { SupabaseClient } from '@supabase/supabase-js'

beforeEach(async () => {
  await clearCache()
})

runDriverContract('SupabaseDriver', () => {
  const fake = new FakeSupabase()
  return new SupabaseDriver(fake as unknown as SupabaseClient)
})

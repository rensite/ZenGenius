import { LocalDriver } from './drivers/local.driver'
import { HttpDriver } from './drivers/http.driver'
import { SupabaseDriver } from './drivers/supabase.driver'
import { supabase } from '@/lib/supabase'
import type { DataDriver } from './drivers/types'

export type { DataDriver } from './drivers/types'

const apiUrl = import.meta.env.VITE_API_URL as string | undefined

// Driver selection priority:
//   1. Supabase if VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set.
//   2. HTTP if VITE_API_URL is set (legacy / custom backend).
//   3. LocalDriver as fallback so dev works with no env at all.
export const driver: DataDriver = supabase
  ? new SupabaseDriver(supabase)
  : apiUrl
    ? new HttpDriver(apiUrl)
    : new LocalDriver()

export const localDriver = driver instanceof LocalDriver ? (driver as LocalDriver) : null

export const isCloud = driver instanceof SupabaseDriver

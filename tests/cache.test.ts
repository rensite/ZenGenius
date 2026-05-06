import { beforeEach, describe, it, expect, afterEach, vi } from 'vitest'
import { SupabaseDriver } from '@/api/drivers/supabase.driver'
import { clearCache, getCache } from '@/api/drivers/cache'
import { FakeSupabase } from './helpers/fakeSupabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Track } from '@/types/domain'

const ISO = '2025-01-01T00:00:00.000Z'
const track = (id: string, title = id): Track => ({
  id,
  title,
  artist: 'A',
  sections: [],
  createdAt: ISO,
  updatedAt: ISO,
})

describe('SupabaseDriver Dexie cache', () => {
  beforeEach(async () => {
    await clearCache()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('populates the cache on listTracks', async () => {
    const fake = new FakeSupabase()
    const d = new SupabaseDriver(fake as unknown as SupabaseClient)
    await d.saveTrack(track('a'))
    await d.listTracks()
    const cached = await getCache().tracks.toArray()
    expect(cached.map((t) => t.id)).toEqual(['a'])
  })

  it('serves listTracks from cache when offline', async () => {
    const fake = new FakeSupabase()
    const d = new SupabaseDriver(fake as unknown as SupabaseClient)
    await d.saveTrack(track('a'))
    await d.listTracks() // populate cache

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    // Wipe the network store so we'd notice if the offline path hit it.
    fake.tables.tracks = []

    const result = await d.listTracks()
    expect(result.map((t) => t.id)).toEqual(['a'])
  })

  it('rejects writes when offline', async () => {
    const fake = new FakeSupabase()
    const d = new SupabaseDriver(fake as unknown as SupabaseClient)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })

    await expect(d.saveTrack(track('a'))).rejects.toThrow(/Offline/)
    await expect(d.deleteTrack('a')).rejects.toThrow(/Offline/)
    await expect(
      d.saveAnnotation({
        id: 'an-1',
        trackId: 'a',
        ranges: [],
        body: '',
        tags: [],
        createdAt: ISO,
      }),
    ).rejects.toThrow(/Offline/)
  })

  it('cascade-clears children from cache on track delete', async () => {
    const fake = new FakeSupabase()
    const d = new SupabaseDriver(fake as unknown as SupabaseClient)
    await d.saveTrack(track('a'))
    await d.saveAnnotation({
      id: 'an-1',
      trackId: 'a',
      ranges: [],
      body: '',
      tags: [],
      createdAt: ISO,
    })
    await d.listAnnotations('a') // populate cache

    await d.deleteTrack('a')

    expect(await getCache().annotations.where('trackId').equals('a').count()).toBe(0)
  })
})

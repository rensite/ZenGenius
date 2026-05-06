import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Annotation,
  AnnotationTag,
  DictionaryEntry,
  ID,
  RhymeColor,
  RhymeGroup,
  Section,
  Track,
} from '@/types/domain'
import type { DataDriver } from './types'
import { getCache } from './cache'

// Postgres column names use snake_case; the domain types use camelCase. These
// helpers are the only place where the mapping lives, so the rest of the app
// keeps speaking the domain language.

type TrackRow = {
  id: string
  title: string
  artist: string
  album: string | null
  about: string | null
  characters: string[] | null
  sections: Section[] | null
  created_at: string
  updated_at: string
}

type AnnotationRow = {
  id: string
  track_id: string
  ranges: Annotation['ranges'] | null
  body: string
  tags: AnnotationTag[] | null
  contributor: string | null
  created_at: string
  updated_at: string | null
}

type RhymeRow = {
  id: string
  track_id: string
  color: RhymeColor
  marks: RhymeGroup['marks'] | null
  note: string | null
}

type DictionaryRow = {
  id: string
  track_id: string
  term: string
  definition: string
}

const trackFromRow = (r: TrackRow): Track => ({
  id: r.id,
  title: r.title,
  artist: r.artist,
  album: r.album ?? undefined,
  about: r.about ?? undefined,
  characters: r.characters ?? undefined,
  sections: r.sections ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const trackToRow = (t: Track) => ({
  id: t.id,
  title: t.title,
  artist: t.artist,
  album: t.album ?? null,
  about: t.about ?? null,
  characters: t.characters ?? null,
  sections: t.sections,
})

const annotationFromRow = (r: AnnotationRow): Annotation => ({
  id: r.id,
  trackId: r.track_id,
  ranges: r.ranges ?? [],
  body: r.body,
  tags: r.tags ?? [],
  contributor: r.contributor ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at ?? undefined,
})

const annotationToRow = (a: Annotation) => ({
  id: a.id,
  track_id: a.trackId,
  ranges: a.ranges,
  body: a.body,
  tags: a.tags,
  contributor: a.contributor ?? null,
})

const rhymeFromRow = (r: RhymeRow): RhymeGroup => ({
  id: r.id,
  trackId: r.track_id,
  color: r.color,
  marks: r.marks ?? [],
  note: r.note ?? undefined,
})

const rhymeToRow = (g: RhymeGroup) => ({
  id: g.id,
  track_id: g.trackId,
  color: g.color,
  marks: g.marks,
  note: g.note ?? null,
})

const dictFromRow = (r: DictionaryRow): DictionaryEntry => ({
  id: r.id,
  trackId: r.track_id,
  term: r.term,
  definition: r.definition,
})

const dictToRow = (d: DictionaryEntry) => ({
  id: d.id,
  track_id: d.trackId,
  term: d.term,
  definition: d.definition,
})

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

const OFFLINE_WRITE = new Error(
  'Offline: writes require a network connection. Try again when online.',
)

export class SupabaseDriver implements DataDriver {
  constructor(private client: SupabaseClient) {}

  // --- tracks ---

  async listTracks(): Promise<Track[]> {
    const cache = getCache()
    if (isOffline()) {
      const cached = await cache.tracks.toArray()
      return cached.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }
    const { data, error } = await this.client
      .from('tracks')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) throw error
    const tracks = (data as TrackRow[]).map(trackFromRow)
    await cache.tracks.clear()
    if (tracks.length) await cache.tracks.bulkPut(tracks)
    return tracks
  }

  async getTrack(id: ID): Promise<Track | null> {
    if (isOffline()) return (await getCache().tracks.get(id)) ?? null
    const { data, error } = await this.client
      .from('tracks')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const track = trackFromRow(data as TrackRow)
    await getCache().tracks.put(track)
    return track
  }

  async saveTrack(track: Track): Promise<Track> {
    if (isOffline()) throw OFFLINE_WRITE
    const { data, error } = await this.client
      .from('tracks')
      .upsert(trackToRow(track), { onConflict: 'id' })
      .select('*')
      .single()
    if (error) throw error
    const saved = trackFromRow(data as TrackRow)
    await getCache().tracks.put(saved)
    return saved
  }

  async deleteTrack(id: ID): Promise<void> {
    if (isOffline()) throw OFFLINE_WRITE
    const { error } = await this.client.from('tracks').delete().eq('id', id)
    if (error) throw error
    const cache = getCache()
    await cache.tracks.delete(id)
    // ON DELETE CASCADE in Postgres also removes children; keep cache consistent.
    await cache.annotations.where('trackId').equals(id).delete()
    await cache.rhymes.where('trackId').equals(id).delete()
    await cache.dictionary.where('trackId').equals(id).delete()
  }

  // --- annotations ---

  async listAnnotations(trackId: ID): Promise<Annotation[]> {
    const cache = getCache()
    if (isOffline()) return cache.annotations.where('trackId').equals(trackId).toArray()
    const { data, error } = await this.client
      .from('annotations')
      .select('*')
      .eq('track_id', trackId)
    if (error) throw error
    const items = (data as AnnotationRow[]).map(annotationFromRow)
    await cache.annotations.where('trackId').equals(trackId).delete()
    if (items.length) await cache.annotations.bulkPut(items)
    return items
  }

  async saveAnnotation(a: Annotation): Promise<Annotation> {
    if (isOffline()) throw OFFLINE_WRITE
    const { data, error } = await this.client
      .from('annotations')
      .upsert(annotationToRow(a), { onConflict: 'id' })
      .select('*')
      .single()
    if (error) throw error
    const saved = annotationFromRow(data as AnnotationRow)
    await getCache().annotations.put(saved)
    return saved
  }

  async deleteAnnotation(id: ID): Promise<void> {
    if (isOffline()) throw OFFLINE_WRITE
    const { error } = await this.client.from('annotations').delete().eq('id', id)
    if (error) throw error
    await getCache().annotations.delete(id)
  }

  // --- rhyme groups ---

  async listRhymeGroups(trackId: ID): Promise<RhymeGroup[]> {
    const cache = getCache()
    if (isOffline()) return cache.rhymes.where('trackId').equals(trackId).toArray()
    const { data, error } = await this.client
      .from('rhyme_groups')
      .select('*')
      .eq('track_id', trackId)
    if (error) throw error
    const items = (data as RhymeRow[]).map(rhymeFromRow)
    await cache.rhymes.where('trackId').equals(trackId).delete()
    if (items.length) await cache.rhymes.bulkPut(items)
    return items
  }

  async saveRhymeGroup(g: RhymeGroup): Promise<RhymeGroup> {
    if (isOffline()) throw OFFLINE_WRITE
    const { data, error } = await this.client
      .from('rhyme_groups')
      .upsert(rhymeToRow(g), { onConflict: 'id' })
      .select('*')
      .single()
    if (error) throw error
    const saved = rhymeFromRow(data as RhymeRow)
    await getCache().rhymes.put(saved)
    return saved
  }

  async deleteRhymeGroup(id: ID): Promise<void> {
    if (isOffline()) throw OFFLINE_WRITE
    const { error } = await this.client.from('rhyme_groups').delete().eq('id', id)
    if (error) throw error
    await getCache().rhymes.delete(id)
  }

  // --- dictionary ---

  async listDictionary(trackId: ID): Promise<DictionaryEntry[]> {
    const cache = getCache()
    if (isOffline()) return cache.dictionary.where('trackId').equals(trackId).toArray()
    const { data, error } = await this.client
      .from('dictionary_entries')
      .select('*')
      .eq('track_id', trackId)
    if (error) throw error
    const items = (data as DictionaryRow[]).map(dictFromRow)
    await cache.dictionary.where('trackId').equals(trackId).delete()
    if (items.length) await cache.dictionary.bulkPut(items)
    return items
  }

  async saveDictionaryEntry(d: DictionaryEntry): Promise<DictionaryEntry> {
    if (isOffline()) throw OFFLINE_WRITE
    const { data, error } = await this.client
      .from('dictionary_entries')
      .upsert(dictToRow(d), { onConflict: 'id' })
      .select('*')
      .single()
    if (error) throw error
    const saved = dictFromRow(data as DictionaryRow)
    await getCache().dictionary.put(saved)
    return saved
  }

  async deleteDictionaryEntry(id: ID): Promise<void> {
    if (isOffline()) throw OFFLINE_WRITE
    const { error } = await this.client.from('dictionary_entries').delete().eq('id', id)
    if (error) throw error
    await getCache().dictionary.delete(id)
  }
}

import Dexie, { type Table } from 'dexie'
import type {
  Annotation,
  DictionaryEntry,
  ID,
  RhymeGroup,
  Track,
} from '@/types/domain'

class LyricLensCache extends Dexie {
  tracks!: Table<Track, ID>
  annotations!: Table<Annotation, ID>
  rhymes!: Table<RhymeGroup, ID>
  dictionary!: Table<DictionaryEntry, ID>

  constructor() {
    super('lyriclens-cache')
    this.version(1).stores({
      tracks: 'id, updatedAt',
      annotations: 'id, trackId',
      rhymes: 'id, trackId',
      dictionary: 'id, trackId',
    })
  }
}

let db: LyricLensCache | null = null

export function getCache(): LyricLensCache {
  if (!db) db = new LyricLensCache()
  return db
}

export async function clearCache() {
  const c = getCache()
  await Promise.all([c.tracks.clear(), c.annotations.clear(), c.rhymes.clear(), c.dictionary.clear()])
}

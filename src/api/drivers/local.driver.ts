import type {
  Annotation,
  AnnotationTag,
  DictionaryEntry,
  ID,
  RhymeGroup,
  Track,
} from '@/types/domain'

function migrateAnnotation(a: Annotation & { type?: string; title?: string }): Annotation {
  if (a.tags) return a
  const tags: AnnotationTag[] = []
  if (a.type === 'translation' || a.type === 'reference' || a.type === 'dictionary') {
    tags.push(a.type as AnnotationTag)
  }
  return {
    id: a.id,
    trackId: a.trackId,
    lineId: a.lineId,
    charStart: a.charStart,
    charEnd: a.charEnd,
    body: a.title ? `${a.title}\n\n${a.body}` : a.body,
    tags,
    contributor: a.contributor,
    createdAt: a.createdAt,
  }
}

export interface DataDriver {
  listTracks(): Promise<Track[]>
  getTrack(id: ID): Promise<Track | null>
  saveTrack(track: Track): Promise<Track>
  deleteTrack(id: ID): Promise<void>

  listAnnotations(trackId: ID): Promise<Annotation[]>
  saveAnnotation(a: Annotation): Promise<Annotation>
  deleteAnnotation(id: ID): Promise<void>

  listRhymeGroups(trackId: ID): Promise<RhymeGroup[]>
  saveRhymeGroup(g: RhymeGroup): Promise<RhymeGroup>
  deleteRhymeGroup(id: ID): Promise<void>

  listDictionary(trackId: ID): Promise<DictionaryEntry[]>
  saveDictionaryEntry(d: DictionaryEntry): Promise<DictionaryEntry>
  deleteDictionaryEntry(id: ID): Promise<void>
}

const KEY = {
  tracks: 'lyriclens.tracks',
  annotations: 'lyriclens.annotations',
  rhymes: 'lyriclens.rhymes',
  dictionary: 'lyriclens.dictionary',
  seeded: 'lyriclens.seeded',
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

export class LocalDriver implements DataDriver {
  async listTracks() {
    return read<Track[]>(KEY.tracks, [])
  }
  async getTrack(id: ID) {
    return (await this.listTracks()).find((t) => t.id === id) ?? null
  }
  async saveTrack(track: Track) {
    const tracks = await this.listTracks()
    const idx = tracks.findIndex((t) => t.id === track.id)
    const next = { ...track, updatedAt: new Date().toISOString() }
    if (idx === -1) tracks.push(next)
    else tracks[idx] = next
    write(KEY.tracks, tracks)
    return next
  }
  async deleteTrack(id: ID) {
    write(
      KEY.tracks,
      (await this.listTracks()).filter((t) => t.id !== id),
    )
  }

  async listAnnotations(trackId: ID) {
    const raw = read<(Annotation & { type?: string; title?: string })[]>(KEY.annotations, [])
    return raw
      .filter((a) => a.trackId === trackId)
      .map((a) => migrateAnnotation(a))
  }
  async saveAnnotation(a: Annotation) {
    const all = read<Annotation[]>(KEY.annotations, [])
    const idx = all.findIndex((x) => x.id === a.id)
    if (idx === -1) all.push(a)
    else all[idx] = a
    write(KEY.annotations, all)
    return a
  }
  async deleteAnnotation(id: ID) {
    write(
      KEY.annotations,
      read<Annotation[]>(KEY.annotations, []).filter((a) => a.id !== id),
    )
  }

  async listRhymeGroups(trackId: ID) {
    return read<RhymeGroup[]>(KEY.rhymes, []).filter((g) => g.trackId === trackId)
  }
  async saveRhymeGroup(g: RhymeGroup) {
    const all = read<RhymeGroup[]>(KEY.rhymes, [])
    const idx = all.findIndex((x) => x.id === g.id)
    if (idx === -1) all.push(g)
    else all[idx] = g
    write(KEY.rhymes, all)
    return g
  }
  async deleteRhymeGroup(id: ID) {
    write(
      KEY.rhymes,
      read<RhymeGroup[]>(KEY.rhymes, []).filter((g) => g.id !== id),
    )
  }

  async listDictionary(trackId: ID) {
    return read<DictionaryEntry[]>(KEY.dictionary, []).filter((d) => d.trackId === trackId)
  }
  async saveDictionaryEntry(d: DictionaryEntry) {
    const all = read<DictionaryEntry[]>(KEY.dictionary, [])
    const idx = all.findIndex((x) => x.id === d.id)
    if (idx === -1) all.push(d)
    else all[idx] = d
    write(KEY.dictionary, all)
    return d
  }
  async deleteDictionaryEntry(id: ID) {
    write(
      KEY.dictionary,
      read<DictionaryEntry[]>(KEY.dictionary, []).filter((d) => d.id !== id),
    )
  }

  isSeeded() {
    return localStorage.getItem(KEY.seeded) === '1'
  }
  markSeeded() {
    localStorage.setItem(KEY.seeded, '1')
  }
  reset() {
    Object.values(KEY).forEach((k) => localStorage.removeItem(k))
  }
}

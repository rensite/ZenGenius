import type {
  Annotation,
  DictionaryEntry,
  ID,
  RhymeGroup,
  Track,
} from '@/types/domain'
import type { DataDriver } from './local.driver'

export class HttpDriver implements DataDriver {
  constructor(private baseURL: string) {}

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseURL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
  }

  listTracks() {
    return this.req<Track[]>('/tracks')
  }
  getTrack(id: ID) {
    return this.req<Track | null>(`/tracks/${id}`)
  }
  saveTrack(track: Track) {
    return this.req<Track>(`/tracks/${track.id}`, {
      method: 'PUT',
      body: JSON.stringify(track),
    })
  }
  deleteTrack(id: ID) {
    return this.req<void>(`/tracks/${id}`, { method: 'DELETE' })
  }

  listAnnotations(trackId: ID) {
    return this.req<Annotation[]>(`/tracks/${trackId}/annotations`)
  }
  saveAnnotation(a: Annotation) {
    return this.req<Annotation>(`/annotations/${a.id}`, {
      method: 'PUT',
      body: JSON.stringify(a),
    })
  }
  deleteAnnotation(id: ID) {
    return this.req<void>(`/annotations/${id}`, { method: 'DELETE' })
  }

  listRhymeGroups(trackId: ID) {
    return this.req<RhymeGroup[]>(`/tracks/${trackId}/rhymes`)
  }
  saveRhymeGroup(g: RhymeGroup) {
    return this.req<RhymeGroup>(`/rhymes/${g.id}`, {
      method: 'PUT',
      body: JSON.stringify(g),
    })
  }
  deleteRhymeGroup(id: ID) {
    return this.req<void>(`/rhymes/${id}`, { method: 'DELETE' })
  }

  listDictionary(trackId: ID) {
    return this.req<DictionaryEntry[]>(`/tracks/${trackId}/dictionary`)
  }
  saveDictionaryEntry(d: DictionaryEntry) {
    return this.req<DictionaryEntry>(`/dictionary/${d.id}`, {
      method: 'PUT',
      body: JSON.stringify(d),
    })
  }
  deleteDictionaryEntry(id: ID) {
    return this.req<void>(`/dictionary/${id}`, { method: 'DELETE' })
  }
}

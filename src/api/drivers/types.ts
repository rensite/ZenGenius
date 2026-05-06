import type {
  Annotation,
  DictionaryEntry,
  ID,
  RhymeGroup,
  Track,
} from '@/types/domain'

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

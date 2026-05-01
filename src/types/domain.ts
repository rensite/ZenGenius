export type ID = string

export type SectionKind =
  | 'intro'
  | 'verse'
  | 'pre-chorus'
  | 'chorus'
  | 'bridge'
  | 'outro'
  | 'hook'
  | 'interlude'
  | 'other'

export interface Line {
  id: ID
  text: string
}

export interface Section {
  id: ID
  kind: SectionKind
  label: string
  performer?: string
  lines: Line[]
}

export interface Track {
  id: ID
  title: string
  artist: string
  album?: string
  about?: string
  characters?: string[]
  sections: Section[]
  createdAt: string
  updatedAt: string
}

export type AnnotationTag = 'translation' | 'reference' | 'dictionary'

export const ANNOTATION_TAGS: {
  key: AnnotationTag
  label: string
  marker: string
  markerClass: string
}[] = [
  { key: 'translation', label: 'Translation', marker: '●', markerClass: 'text-sky-500' },
  { key: 'reference', label: 'Reference', marker: '#', markerClass: 'text-amber-600' },
  { key: 'dictionary', label: 'Dictionary', marker: '≡', markerClass: 'text-purple-500' },
]

export interface Annotation {
  id: ID
  trackId: ID
  lineId: ID
  charStart: number
  charEnd: number
  body: string
  tags: AnnotationTag[]
  contributor?: string
  createdAt: string
  updatedAt?: string
}

export type RhymeColor = 'blue' | 'purple' | 'mint' | 'gold' | 'rose'

export interface RhymeMark {
  lineId: ID
  charStart: number
  charEnd: number
}

export interface RhymeGroup {
  id: ID
  trackId: ID
  color: RhymeColor
  marks: RhymeMark[]
  note?: string
}

export interface DictionaryEntry {
  id: ID
  trackId: ID
  term: string
  definition: string
}

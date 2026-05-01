import type { Annotation, DictionaryEntry, RhymeGroup } from '@/types/domain'

export function buildSeedAnnotations(): Annotation[] {
  const t = 'architecture-of-silence'
  const now = new Date().toISOString()
  return [
    {
      id: `${t}-ann-1`,
      trackId: t,
      lineId: `${t}-l3`,
      charStart: 0,
      charEnd: 35,
      tags: [],
      body:
        'The "fifteen windows" represent the multifaceted gaze of observers, while "burnt out lies" suggests the exhaustion of maintaining a false facade. There is a deliberate contrast between architectural clarity (windows) and the smoke-like quality of deceit.',
      contributor: 'Julian Thorne',
      createdAt: now,
    },
    {
      id: `${t}-ann-2`,
      trackId: t,
      lineId: `${t}-l13`,
      charStart: 0,
      charEnd: 30,
      tags: ['reference'],
      body:
        'A skyline likened to a heart-rate trace — the city as a patient. The motif is reused in "Quiet Light" b-sides where buildings are repeatedly given clinical anatomy.',
      contributor: 'Halen Crow',
      createdAt: now,
    },
  ]
}

export function buildSeedDictionary(): DictionaryEntry[] {
  const t = 'architecture-of-silence'
  return [
    {
      id: `${t}-dict-1`,
      trackId: t,
      term: 'borderless line',
      definition:
        'A paradox: a boundary without bounds. In the lyric, the narrator is trapped inside a definition that has no edges to push against.',
    },
    {
      id: `${t}-dict-2`,
      trackId: t,
      term: 'EKG (electrocardiogram)',
      definition:
        'A medical recording of electrical heart activity. Used here as a metaphor for a city skyline — implying the city is alive and possibly dying.',
    },
    {
      id: 'paper-cartographer-dict-1',
      trackId: 'paper-cartographer',
      term: 'cartographer',
      definition: 'A maker of maps. The narrator maps emotional rather than geographical territory.',
    },
  ]
}

export function buildSeedRhymes(): RhymeGroup[] {
  const t = 'architecture-of-silence'
  return [
    {
      id: `${t}-rh-1`,
      trackId: t,
      color: 'blue',
      marks: [
        { lineId: `${t}-l5`, charStart: 22, charEnd: 26 },
        { lineId: `${t}-l7`, charStart: 33, charEnd: 39 },
      ],
    },
    {
      id: `${t}-rh-2`,
      trackId: t,
      color: 'gold',
      marks: [
        { lineId: `${t}-l8`, charStart: 36, charEnd: 40 },
        { lineId: `${t}-l13`, charStart: 24, charEnd: 28 },
      ],
    },
  ]
}

import { driver } from '@/api'
import type {
  Annotation,
  DictionaryEntry,
  RhymeGroup,
  Track,
} from '@/types/domain'

export interface DataDump {
  version: 1
  exportedAt: string
  tracks: Track[]
  annotations: Annotation[]
  rhymes: RhymeGroup[]
  dictionary: DictionaryEntry[]
}

export async function exportData(): Promise<DataDump> {
  const tracks = await driver.listTracks()
  const annotations: Annotation[] = []
  const rhymes: RhymeGroup[] = []
  const dictionary: DictionaryEntry[] = []
  for (const t of tracks) {
    annotations.push(...(await driver.listAnnotations(t.id)))
    rhymes.push(...(await driver.listRhymeGroups(t.id)))
    dictionary.push(...(await driver.listDictionary(t.id)))
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tracks,
    annotations,
    rhymes,
    dictionary,
  }
}

export async function downloadExport() {
  const data = await exportData()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lyriclens-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function isDataDump(x: unknown): x is DataDump {
  if (!x || typeof x !== 'object') return false
  const d = x as Partial<DataDump>
  return (
    d.version === 1 &&
    Array.isArray(d.tracks) &&
    Array.isArray(d.annotations) &&
    Array.isArray(d.rhymes) &&
    Array.isArray(d.dictionary)
  )
}

export interface ImportResult {
  tracks: number
  annotations: number
  rhymes: number
  dictionary: number
}

export async function importData(
  raw: string,
  mode: 'replace' | 'merge' = 'replace',
): Promise<ImportResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON')
  }
  if (!isDataDump(parsed)) throw new Error('Unrecognized data format')

  if (mode === 'replace') {
    for (const t of await driver.listTracks()) {
      for (const a of await driver.listAnnotations(t.id)) await driver.deleteAnnotation(a.id)
      for (const r of await driver.listRhymeGroups(t.id)) await driver.deleteRhymeGroup(r.id)
      for (const d of await driver.listDictionary(t.id)) await driver.deleteDictionaryEntry(d.id)
      await driver.deleteTrack(t.id)
    }
  }

  for (const t of parsed.tracks) await driver.saveTrack(t)
  for (const a of parsed.annotations) await driver.saveAnnotation(a)
  for (const r of parsed.rhymes) await driver.saveRhymeGroup(r)
  for (const d of parsed.dictionary) await driver.saveDictionaryEntry(d)

  return {
    tracks: parsed.tracks.length,
    annotations: parsed.annotations.length,
    rhymes: parsed.rhymes.length,
    dictionary: parsed.dictionary.length,
  }
}

export function pickFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      const text = await file.text()
      resolve(text)
    }
    input.click()
  })
}

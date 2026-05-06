import { describe, it, expect } from 'vitest'
import type { DataDriver } from '@/api/drivers/types'
import type { Annotation, DictionaryEntry, RhymeGroup, Track } from '@/types/domain'

const now = '2025-01-01T00:00:00.000Z'

const sampleTrack = (id: string): Track => ({
  id,
  title: `Title ${id}`,
  artist: 'Artist',
  sections: [
    {
      id: `s-${id}`,
      kind: 'verse',
      label: 'Verse 1',
      lines: [{ id: `l-${id}-1`, text: 'hello world' }],
    },
  ],
  createdAt: now,
  updatedAt: now,
})

const sampleAnnotation = (id: string, trackId: string): Annotation => ({
  id,
  trackId,
  ranges: [{ lineId: `l-${trackId}-1`, charStart: 0, charEnd: 5 }],
  body: 'note',
  tags: ['translation'],
  createdAt: now,
})

const sampleRhyme = (id: string, trackId: string): RhymeGroup => ({
  id,
  trackId,
  color: 'blue',
  marks: [{ lineId: `l-${trackId}-1`, charStart: 0, charEnd: 5 }],
})

const sampleDict = (id: string, trackId: string): DictionaryEntry => ({
  id,
  trackId,
  term: 'hello',
  definition: 'a greeting',
})

// All drivers must satisfy the same external behavior. A new driver implementation
// gets a single import + describe to be fully covered.
export function runDriverContract(name: string, makeDriver: () => DataDriver | Promise<DataDriver>) {
  describe(`DataDriver contract: ${name}`, () => {
    it('round-trips a track via save / get / list / delete', async () => {
      const d = await makeDriver()
      const t = sampleTrack('t1')

      expect(await d.listTracks()).toEqual([])
      expect(await d.getTrack('missing')).toBeNull()

      const saved = await d.saveTrack(t)
      expect(saved.id).toBe('t1')

      const fetched = await d.getTrack('t1')
      expect(fetched?.title).toBe('Title t1')

      const all = await d.listTracks()
      expect(all).toHaveLength(1)

      await d.deleteTrack('t1')
      expect(await d.listTracks()).toEqual([])
    })

    it('updating a track replaces, not duplicates', async () => {
      const d = await makeDriver()
      await d.saveTrack(sampleTrack('t1'))
      await d.saveTrack({ ...sampleTrack('t1'), title: 'Updated' })
      const all = await d.listTracks()
      expect(all).toHaveLength(1)
      expect(all[0].title).toBe('Updated')
    })

    it('annotations are scoped to a track', async () => {
      const d = await makeDriver()
      await d.saveTrack(sampleTrack('a'))
      await d.saveTrack(sampleTrack('b'))
      await d.saveAnnotation(sampleAnnotation('an-1', 'a'))
      await d.saveAnnotation(sampleAnnotation('an-2', 'b'))

      const forA = await d.listAnnotations('a')
      const forB = await d.listAnnotations('b')

      expect(forA.map((x) => x.id)).toEqual(['an-1'])
      expect(forB.map((x) => x.id)).toEqual(['an-2'])
    })

    it('rhyme groups are scoped to a track', async () => {
      const d = await makeDriver()
      await d.saveTrack(sampleTrack('a'))
      await d.saveTrack(sampleTrack('b'))
      await d.saveRhymeGroup(sampleRhyme('r-1', 'a'))
      await d.saveRhymeGroup(sampleRhyme('r-2', 'b'))

      expect((await d.listRhymeGroups('a')).map((x) => x.id)).toEqual(['r-1'])
      expect((await d.listRhymeGroups('b')).map((x) => x.id)).toEqual(['r-2'])
    })

    it('dictionary entries are scoped to a track', async () => {
      const d = await makeDriver()
      await d.saveTrack(sampleTrack('a'))
      await d.saveTrack(sampleTrack('b'))
      await d.saveDictionaryEntry(sampleDict('d-1', 'a'))
      await d.saveDictionaryEntry(sampleDict('d-2', 'b'))

      expect((await d.listDictionary('a')).map((x) => x.id)).toEqual(['d-1'])
      expect((await d.listDictionary('b')).map((x) => x.id)).toEqual(['d-2'])
    })

    it('deleting child entities removes them and only them', async () => {
      const d = await makeDriver()
      await d.saveTrack(sampleTrack('a'))
      await d.saveAnnotation(sampleAnnotation('an-1', 'a'))
      await d.saveAnnotation(sampleAnnotation('an-2', 'a'))

      await d.deleteAnnotation('an-1')
      const remaining = await d.listAnnotations('a')
      expect(remaining.map((x) => x.id)).toEqual(['an-2'])
    })
  })
}

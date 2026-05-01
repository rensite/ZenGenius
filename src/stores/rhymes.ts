import { defineStore } from 'pinia'
import { ref } from 'vue'
import { driver } from '@/api'
import type { ID, RhymeColor, RhymeGroup, RhymeMark } from '@/types/domain'

export const useRhymesStore = defineStore('rhymes', () => {
  const byTrack = ref<Record<ID, RhymeGroup[]>>({})

  async function fetchFor(trackId: ID) {
    if (byTrack.value[trackId]) return
    byTrack.value[trackId] = await driver.listRhymeGroups(trackId)
  }

  function findGroup(trackId: ID, color: RhymeColor): RhymeGroup | null {
    return (byTrack.value[trackId] ?? []).find((g) => g.color === color) ?? null
  }

  async function toggleMark(trackId: ID, color: RhymeColor, mark: RhymeMark) {
    let group = findGroup(trackId, color)
    if (!group) {
      group = {
        id: `rh-${trackId}-${color}`,
        trackId,
        color,
        marks: [],
      }
      byTrack.value[trackId] = [...(byTrack.value[trackId] ?? []), group]
    }
    const exists = group.marks.find(
      (m) =>
        m.lineId === mark.lineId &&
        m.charStart === mark.charStart &&
        m.charEnd === mark.charEnd,
    )
    if (exists) {
      group.marks = group.marks.filter((m) => m !== exists)
    } else {
      // remove mark from any other color group on same range
      for (const g of byTrack.value[trackId]) {
        if (g.color === color) continue
        g.marks = g.marks.filter(
          (m) =>
            !(
              m.lineId === mark.lineId &&
              m.charStart === mark.charStart &&
              m.charEnd === mark.charEnd
            ),
        )
      }
      group.marks.push(mark)
    }
    await driver.saveRhymeGroup(group)
    // persist sibling groups too (mutated above)
    for (const g of byTrack.value[trackId]) {
      if (g.id !== group.id) await driver.saveRhymeGroup(g)
    }
  }

  function colorAt(trackId: ID, lineId: ID, charStart: number, charEnd: number): RhymeColor | null {
    for (const g of byTrack.value[trackId] ?? []) {
      const hit = g.marks.find(
        (m) => m.lineId === lineId && m.charStart === charStart && m.charEnd === charEnd,
      )
      if (hit) return g.color
    }
    return null
  }

  async function setNote(trackId: ID, color: RhymeColor, note: string) {
    let group = findGroup(trackId, color)
    if (!group) {
      group = { id: `rh-${trackId}-${color}`, trackId, color, marks: [], note }
      byTrack.value[trackId] = [...(byTrack.value[trackId] ?? []), group]
    } else {
      group.note = note
    }
    await driver.saveRhymeGroup(group)
  }

  async function clearAll(trackId: ID) {
    for (const g of byTrack.value[trackId] ?? []) {
      await driver.deleteRhymeGroup(g.id)
    }
    byTrack.value[trackId] = []
  }

  return { byTrack, fetchFor, toggleMark, colorAt, setNote, clearAll }
})

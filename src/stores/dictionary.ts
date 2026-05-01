import { defineStore } from 'pinia'
import { ref } from 'vue'
import { driver } from '@/api'
import type { DictionaryEntry, ID } from '@/types/domain'

export const useDictionaryStore = defineStore('dictionary', () => {
  const byTrack = ref<Record<ID, DictionaryEntry[]>>({})

  async function fetchFor(trackId: ID) {
    if (byTrack.value[trackId]) return
    byTrack.value[trackId] = await driver.listDictionary(trackId)
  }

  async function add(entry: Omit<DictionaryEntry, 'id'>) {
    const full: DictionaryEntry = { ...entry, id: `dict-${Date.now()}` }
    await driver.saveDictionaryEntry(full)
    if (!byTrack.value[entry.trackId]) byTrack.value[entry.trackId] = []
    byTrack.value[entry.trackId].push(full)
  }

  async function remove(trackId: ID, id: ID) {
    await driver.deleteDictionaryEntry(id)
    byTrack.value[trackId] = (byTrack.value[trackId] ?? []).filter((d) => d.id !== id)
  }

  return { byTrack, fetchFor, add, remove }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { driver } from '@/api'
import type { Annotation, ID } from '@/types/domain'

export const useAnnotationsStore = defineStore('annotations', () => {
  const byTrack = ref<Record<ID, Annotation[]>>({})
  const loading = ref(false)

  async function fetchFor(trackId: ID) {
    if (byTrack.value[trackId]) return
    loading.value = true
    try {
      byTrack.value[trackId] = await driver.listAnnotations(trackId)
    } finally {
      loading.value = false
    }
  }

  async function add(a: Omit<Annotation, 'id' | 'createdAt'>) {
    const full: Annotation = {
      ...a,
      id: `ann-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    await driver.saveAnnotation(full)
    if (!byTrack.value[a.trackId]) byTrack.value[a.trackId] = []
    byTrack.value[a.trackId].push(full)
    return full
  }

  async function update(annotation: Annotation) {
    const next = { ...annotation, updatedAt: new Date().toISOString() }
    await driver.saveAnnotation(next)
    const arr = byTrack.value[annotation.trackId] ?? []
    const idx = arr.findIndex((a) => a.id === annotation.id)
    if (idx !== -1) arr[idx] = next
    return next
  }

  async function remove(trackId: ID, id: ID) {
    await driver.deleteAnnotation(id)
    byTrack.value[trackId] = (byTrack.value[trackId] ?? []).filter((a) => a.id !== id)
  }

  function forLine(trackId: ID, lineId: ID): Annotation[] {
    return (byTrack.value[trackId] ?? []).filter((a) => a.lineId === lineId)
  }

  return { byTrack, loading, fetchFor, add, update, remove, forLine }
})

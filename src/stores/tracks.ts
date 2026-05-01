import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { driver } from '@/api'
import type { ID, Line, Section, Track } from '@/types/domain'

export const useTracksStore = defineStore('tracks', () => {
  const tracks = ref<Track[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  async function fetchAll() {
    if (loaded.value) return
    loading.value = true
    try {
      tracks.value = await driver.listTracks()
      tracks.value.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  const byId = computed(
    () => (id: ID) => tracks.value.find((t) => t.id === id) ?? null,
  )

  function findLine(trackId: ID, lineId: ID): Line | null {
    const t = byId.value(trackId)
    if (!t) return null
    for (const s of t.sections) {
      const l = s.lines.find((x) => x.id === lineId)
      if (l) return l
    }
    return null
  }

  async function save(track: Track) {
    const saved = await driver.saveTrack(track)
    const idx = tracks.value.findIndex((t) => t.id === saved.id)
    if (idx === -1) tracks.value.unshift(saved)
    else tracks.value[idx] = saved
  }

  async function updateLyrics(
    trackId: ID,
    raw: string,
    meta?: { title?: string; artist?: string; album?: string; about?: string },
  ) {
    const t = byId.value(trackId)
    if (!t) return
    const { parseLyrics } = await import('@/seed/parseLyrics')
    const parsed = parseLyrics(trackId, raw)
    const oldByText = new Map<string, ID>()
    for (const s of t.sections) for (const l of s.lines) oldByText.set(l.text, l.id)
    for (const s of parsed) {
      for (const l of s.lines) {
        const reused = oldByText.get(l.text)
        if (reused) {
          l.id = reused
          oldByText.delete(l.text)
        }
      }
    }
    await save({
      ...t,
      ...(meta?.title !== undefined && { title: meta.title }),
      ...(meta?.artist !== undefined && { artist: meta.artist }),
      ...(meta?.album !== undefined && { album: meta.album || undefined }),
      ...(meta?.about !== undefined && { about: meta.about || undefined }),
      sections: parsed,
    })
  }

  async function updateLine(trackId: ID, lineId: ID, text: string) {
    const t = byId.value(trackId)
    if (!t) return
    const next: Track = {
      ...t,
      sections: t.sections.map((s) => ({
        ...s,
        lines: s.lines.map((l) => (l.id === lineId ? { ...l, text } : l)),
      })),
    }
    await save(next)
  }

  async function remove(id: ID) {
    for (const a of await driver.listAnnotations(id)) await driver.deleteAnnotation(a.id)
    for (const r of await driver.listRhymeGroups(id)) await driver.deleteRhymeGroup(r.id)
    for (const d of await driver.listDictionary(id)) await driver.deleteDictionaryEntry(d.id)
    await driver.deleteTrack(id)
    tracks.value = tracks.value.filter((t) => t.id !== id)
  }

  async function create(input: { title: string; artist: string; album?: string; lyrics: string }) {
    const { parseLyrics } = await import('@/seed/parseLyrics')
    const id = `t-${Date.now()}`
    const sections: Section[] = parseLyrics(id, input.lyrics)
    const now = new Date().toISOString()
    const track: Track = {
      id,
      title: input.title,
      artist: input.artist,
      album: input.album,
      sections,
      createdAt: now,
      updatedAt: now,
    }
    await save(track)
    return track
  }

  function reset() {
    tracks.value = []
    loaded.value = false
  }

  return { tracks, loading, loaded, fetchAll, byId, findLine, save, updateLine, updateLyrics, remove, create, reset }
})

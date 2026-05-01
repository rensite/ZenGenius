<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import Icon from './Icon.vue'
import { resetSeed } from '@/seed'
import { useTracksStore } from '@/stores/tracks'
import { useAnnotationsStore } from '@/stores/annotations'
import { useRhymesStore } from '@/stores/rhymes'
import { useDictionaryStore } from '@/stores/dictionary'
import { downloadExport, importData, pickFile } from '@/api/dataIO'

const router = useRouter()
const tracks = useTracksStore()
const annotations = useAnnotationsStore()
const rhymes = useRhymesStore()
const dictionary = useDictionaryStore()

const menuOpen = ref(false)

function refreshAllStores() {
  tracks.reset()
  annotations.byTrack = {}
  rhymes.byTrack = {}
  dictionary.byTrack = {}
}

async function reset() {
  menuOpen.value = false
  if (!confirm('Reset all local data and re-seed with sample tracks?')) return
  await resetSeed()
  refreshAllStores()
  await tracks.fetchAll()
  router.replace('/library')
}

async function onExport() {
  menuOpen.value = false
  await downloadExport()
}

async function onImport() {
  menuOpen.value = false
  const raw = await pickFile()
  if (!raw) return
  if (!confirm('Replace all current data with imported file?')) return
  try {
    const r = await importData(raw, 'replace')
    refreshAllStores()
    await tracks.fetchAll()
    alert(
      `Imported: ${r.tracks} tracks · ${r.annotations} annotations · ${r.rhymes} rhyme groups · ${r.dictionary} dictionary entries`,
    )
    router.replace('/library')
  } catch (e) {
    alert(`Import failed: ${(e as Error).message}`)
  }
}

function onDocClick(e: MouseEvent) {
  if (!menuOpen.value) return
  const target = e.target as HTMLElement
  if (!target.closest('[data-menu-root]')) menuOpen.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <header
    class="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-8 h-16 bg-white/40 glass-blur border-b border-zinc-900/5"
  >
    <RouterLink
      to="/library"
      class="text-sm font-light tracking-[0.2em] uppercase text-zinc-900 hover:opacity-70 transition-opacity"
    >LyricLens</RouterLink>

    <div class="relative" data-menu-root>
      <button
        @click="menuOpen = !menuOpen"
        class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-900/5 text-on-surface transition-colors"
        aria-label="Menu"
      >
        <Icon name="more_vert" :size="20" />
      </button>
      <Transition name="fade">
        <div
          v-if="menuOpen"
          class="absolute right-0 top-12 w-56 bg-white ghost-border rounded-xl shadow-xl shadow-zinc-900/5 py-2"
        >
          <button
            @click="onExport"
            class="w-full flex items-center gap-3 px-4 py-2 text-body-sm text-on-surface hover:bg-zinc-50 transition-colors text-left"
          >
            <Icon name="download" :size="16" />
            Export data
          </button>
          <button
            @click="onImport"
            class="w-full flex items-center gap-3 px-4 py-2 text-body-sm text-on-surface hover:bg-zinc-50 transition-colors text-left"
          >
            <Icon name="upload" :size="16" />
            Import data
          </button>
          <div class="h-px bg-zinc-100 my-1" />
          <button
            @click="reset"
            class="w-full flex items-center gap-3 px-4 py-2 text-body-sm text-on-surface hover:bg-zinc-50 transition-colors text-left"
          >
            <Icon name="refresh" :size="16" />
            Reset to seed
          </button>
        </div>
      </Transition>
    </div>
  </header>
</template>

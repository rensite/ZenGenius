<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTracksStore } from '@/stores/tracks'
import TopBar from '@/components/TopBar.vue'
import Icon from '@/components/Icon.vue'
import TrackComposerPanel from '@/components/TrackComposerPanel.vue'

const tracks = useTracksStore()
const router = useRouter()

onMounted(() => tracks.fetchAll())

const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return tracks.tracks
  return tracks.tracks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.album ?? '').toLowerCase().includes(q),
  )
})

const composerOpen = ref(false)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })

function open(id: string) {
  router.push(`/track/${id}`)
}

async function createTrack(input: {
  title: string
  artist: string
  album?: string
  lyrics: string
}) {
  const t = await tracks.create(input)
  composerOpen.value = false
  router.push(`/track/${t.id}`)
}
</script>

<template>
  <TopBar />

  <main class="max-w-[1100px] mx-auto px-gutter pt-24 pb-24">
    <header class="text-center mb-12">
      <h1 class="text-display-lyric text-on-surface mb-2">Library</h1>
      <p class="text-metadata text-on-surface-variant uppercase tracking-widest">
        {{ tracks.tracks.length }}
        {{ tracks.tracks.length === 1 ? 'track' : 'tracks' }}
      </p>
    </header>

    <div class="flex items-center gap-3 mb-10">
      <div
        class="flex-1 flex items-center gap-3 px-5 py-3 rounded-full bg-surface-container-low ghost-border"
      >
        <Icon name="search" :size="18" class="text-on-surface/40" />
        <input
          v-model="query"
          type="text"
          placeholder="Search title, artist, album…"
          class="flex-1 bg-transparent border-none outline-none focus:ring-0 text-body-sm placeholder:text-on-surface/30 p-0"
        />
        <button
          v-if="query"
          @click="query = ''"
          class="text-on-surface/40 hover:text-on-surface"
        >
          <Icon name="close" :size="16" />
        </button>
      </div>
      <button
        @click="composerOpen = true"
        class="flex items-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-full text-[11px] uppercase tracking-widest hover:bg-zinc-700 transition-colors whitespace-nowrap"
      >
        <Icon name="add" :size="16" />
        New track
      </button>
    </div>

    <section
      v-if="filtered.length"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      <button
        v-for="t in filtered"
        :key="t.id"
        @click="open(t.id)"
        class="group text-left rounded-xl ghost-border bg-white/40 hover:bg-white hover:shadow-xl hover:shadow-zinc-900/5 transition-all p-6 flex flex-col gap-3 min-h-[180px]"
      >
        <span class="text-metadata text-on-surface-variant uppercase tracking-widest">
          {{ t.artist }}
        </span>
        <h2 class="text-active-lyric text-on-surface leading-tight flex-1">{{ t.title }}</h2>
        <div
          class="flex items-center justify-between text-[11px] uppercase tracking-widest text-on-surface/40"
        >
          <span>{{ t.album || '—' }}</span>
          <span>{{ formatDate(t.updatedAt) }}</span>
        </div>
      </button>
    </section>

    <section
      v-else-if="tracks.loaded && query"
      class="text-center py-20 text-on-surface/40"
    >
      <p class="text-body-sm">No tracks match "{{ query }}".</p>
    </section>

    <section v-else-if="tracks.loaded" class="text-center py-20 text-on-surface/40">
      <p class="text-body-sm">Library is empty.</p>
      <p class="text-[11px] uppercase tracking-widest mt-2">
        Click "New track" above to add one.
      </p>
    </section>
  </main>

  <Transition name="slide-right">
    <TrackComposerPanel
      v-if="composerOpen"
      @close="composerOpen = false"
      @save="createTrack"
    />
  </Transition>
</template>

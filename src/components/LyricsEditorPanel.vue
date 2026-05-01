<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'
import type { Track } from '@/types/domain'
import { serializeLyrics } from '@/seed/serializeLyrics'

const props = defineProps<{ track: Track }>()
const emit = defineEmits<{
  close: []
  save: [{ title: string; artist: string; album?: string; about?: string; lyrics: string }]
}>()

const title = ref(props.track.title)
const artist = ref(props.track.artist)
const album = ref(props.track.album ?? '')
const about = ref(props.track.about ?? '')
const lyrics = ref(serializeLyrics(props.track.sections))

const dirty = () =>
  title.value !== props.track.title ||
  artist.value !== props.track.artist ||
  (album.value || '') !== (props.track.album ?? '') ||
  (about.value || '') !== (props.track.about ?? '') ||
  lyrics.value !== serializeLyrics(props.track.sections)

function submit() {
  if (!title.value.trim() || !artist.value.trim() || !lyrics.value.trim()) return
  emit('save', {
    title: title.value.trim(),
    artist: artist.value.trim(),
    album: album.value.trim() || undefined,
    about: about.value.trim() || undefined,
    lyrics: lyrics.value,
  })
}
</script>

<template>
  <aside
    class="fixed top-0 right-0 bottom-0 w-[520px] z-[60] bg-white/95 glass-zen border-l border-black/5 flex flex-col p-8 shadow-2xl shadow-zinc-900/5"
  >
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-metadata text-on-tertiary-container uppercase tracking-widest">
        Edit lyrics
      </h2>
      <button
        @click="$emit('close')"
        aria-label="Close"
        class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-900/5 text-on-surface transition-colors"
      >
        <Icon name="close" :size="20" />
      </button>
    </div>

    <div class="space-y-4 mb-4">
      <div>
        <p class="text-[10px] uppercase tracking-widest text-on-surface/40 mb-1">Title</p>
        <input
          v-model="title"
          type="text"
          class="w-full p-2 rounded border border-black/10 focus:border-zinc-900 focus:ring-0 outline-none text-body-sm"
        />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <p class="text-[10px] uppercase tracking-widest text-on-surface/40 mb-1">Artist</p>
          <input
            v-model="artist"
            type="text"
            class="w-full p-2 rounded border border-black/10 focus:border-zinc-900 focus:ring-0 outline-none text-body-sm"
          />
        </div>
        <div>
          <p class="text-[10px] uppercase tracking-widest text-on-surface/40 mb-1">
            Album <span class="opacity-50 normal-case tracking-normal">(optional)</span>
          </p>
          <input
            v-model="album"
            type="text"
            class="w-full p-2 rounded border border-black/10 focus:border-zinc-900 focus:ring-0 outline-none text-body-sm"
          />
        </div>
      </div>
      <div>
        <p class="text-[10px] uppercase tracking-widest text-on-surface/40 mb-1">
          About <span class="opacity-50 normal-case tracking-normal">(optional)</span>
        </p>
        <textarea
          v-model="about"
          rows="2"
          class="w-full p-2 rounded border border-black/10 focus:border-zinc-900 focus:ring-0 outline-none text-body-sm resize-none"
          placeholder="A short description of the track…"
        />
      </div>
    </div>

    <div class="flex-1 flex flex-col">
      <div class="flex items-baseline justify-between mb-1">
        <p class="text-[10px] uppercase tracking-widest text-on-surface/40">Lyrics</p>
        <p class="text-[10px] text-on-surface/40">
          <span class="font-mono">[Verse 1]</span> · <span class="font-mono">[Chorus]</span> · <span class="font-mono">[Bridge: Singer]</span>
        </p>
      </div>
      <textarea
        v-model="lyrics"
        spellcheck="false"
        class="flex-1 w-full p-3 rounded-lg border border-black/10 focus:border-zinc-900 focus:ring-0 outline-none text-body-sm resize-none font-mono text-[13px] leading-relaxed min-h-[320px]"
      />
      <p class="text-[11px] text-on-surface/40 mt-2 leading-relaxed">
        Annotations attached to lines whose text you don't change will survive.
        Edited or deleted lines lose their annotations.
      </p>
    </div>

    <div class="flex justify-end gap-2 mt-5">
      <button
        @click="$emit('close')"
        class="px-4 py-2 text-[11px] uppercase tracking-widest text-on-surface/60 hover:text-on-surface"
      >Cancel</button>
      <button
        @click="submit"
        :disabled="!dirty()"
        class="px-5 py-2 bg-zinc-900 text-white rounded-full text-[11px] uppercase tracking-widest hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
      >Save</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'

const emit = defineEmits<{
  close: []
  save: [{ title: string; artist: string; album?: string; lyrics: string }]
}>()

const title = ref('')
const artist = ref('')
const album = ref('')
const lyrics = ref('')

const placeholder = `[Intro]
First lines of your song here

[Verse 1]
Verse text, line by line
Each line on its own row

[Chorus]
The chorus goes here

[Bridge]
And so on…

[Outro]
Closing lines`

function submit() {
  if (!title.value.trim() || !artist.value.trim() || !lyrics.value.trim()) return
  emit('save', {
    title: title.value.trim(),
    artist: artist.value.trim(),
    album: album.value.trim() || undefined,
    lyrics: lyrics.value,
  })
}

const canSave = () => !!(title.value.trim() && artist.value.trim() && lyrics.value.trim())
</script>

<template>
  <aside
    class="fixed top-0 right-0 bottom-0 w-[480px] z-[60] bg-white/95 glass-zen border-l border-black/5 flex flex-col p-8 shadow-2xl shadow-zinc-900/5"
  >
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-metadata text-on-tertiary-container uppercase tracking-widest">
        New track
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
          placeholder="Quiet Light"
        />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <p class="text-[10px] uppercase tracking-widest text-on-surface/40 mb-1">Artist</p>
          <input
            v-model="artist"
            type="text"
            class="w-full p-2 rounded border border-black/10 focus:border-zinc-900 focus:ring-0 outline-none text-body-sm"
            placeholder="Halen Crow"
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
            placeholder=""
          />
        </div>
      </div>
    </div>

    <div class="flex-1 flex flex-col">
      <p class="text-[10px] uppercase tracking-widest text-on-surface/40 mb-1">
        Lyrics
      </p>
      <p class="text-[11px] text-on-surface/40 mb-2 leading-relaxed">
        Mark sections in square brackets:
        <span class="font-mono text-on-surface/60">[Intro]</span>,
        <span class="font-mono text-on-surface/60">[Verse 1]</span>,
        <span class="font-mono text-on-surface/60">[Pre-Chorus]</span>,
        <span class="font-mono text-on-surface/60">[Chorus]</span>,
        <span class="font-mono text-on-surface/60">[Bridge]</span>,
        <span class="font-mono text-on-surface/60">[Outro]</span>,
        <span class="font-mono text-on-surface/60">[Hook]</span>,
        <span class="font-mono text-on-surface/60">[Interlude]</span>.
        Append <span class="font-mono text-on-surface/60">: Performer</span> if needed.
      </p>
      <textarea
        v-model="lyrics"
        :placeholder="placeholder"
        class="flex-1 w-full p-3 rounded-lg border border-black/10 focus:border-zinc-900 focus:ring-0 outline-none text-body-sm resize-none font-mono text-[13px] leading-relaxed min-h-[280px]"
      />
    </div>

    <div class="flex justify-end gap-2 mt-5">
      <button
        @click="$emit('close')"
        class="px-4 py-2 text-[11px] uppercase tracking-widest text-on-surface/60 hover:text-on-surface"
      >Cancel</button>
      <button
        @click="submit"
        :disabled="!canSave()"
        class="px-5 py-2 bg-zinc-900 text-white rounded-full text-[11px] uppercase tracking-widest hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
      >Create</button>
    </div>
  </aside>
</template>

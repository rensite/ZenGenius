<script setup lang="ts">
import Icon from './Icon.vue'
import type { DictionaryEntry, Track } from '@/types/domain'

defineProps<{ track: Track; dictionary: DictionaryEntry[] }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <aside
    class="fixed top-0 right-0 bottom-0 w-96 z-[60] bg-white/95 glass-zen border-l border-black/5 flex flex-col p-8 shadow-2xl shadow-zinc-900/5"
  >
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-metadata text-on-tertiary-container uppercase tracking-widest">About</h2>
      <button
        @click="$emit('close')"
        aria-label="Close"
        class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-900/5 text-on-surface transition-colors"
      >
        <Icon name="close" :size="20" />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto pr-2 space-y-8">
      <section>
        <p class="text-active-lyric text-on-surface leading-snug">{{ track.title }}</p>
        <p class="text-metadata text-on-surface-variant uppercase tracking-widest mt-1">
          {{ track.artist }}<template v-if="track.album"> · {{ track.album }}</template>
        </p>
      </section>

      <section v-if="track.about">
        <p class="text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">About</p>
        <p class="text-body-sm leading-relaxed">{{ track.about }}</p>
      </section>

      <section v-if="track.characters?.length">
        <p class="text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Characters</p>
        <ul class="space-y-1">
          <li v-for="c in track.characters" :key="c" class="text-body-sm text-on-surface/70">{{ c }}</li>
        </ul>
      </section>

      <section v-if="dictionary.length">
        <p class="text-[10px] uppercase tracking-widest text-on-surface/40 mb-3">Dictionary</p>
        <ul class="space-y-4">
          <li v-for="d in dictionary" :key="d.id">
            <p class="text-body-sm font-medium">{{ d.term }}</p>
            <p class="text-[13px] text-on-surface/60 leading-relaxed mt-0.5">
              {{ d.definition }}
            </p>
          </li>
        </ul>
      </section>
    </div>
  </aside>
</template>

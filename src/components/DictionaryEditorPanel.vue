<script setup lang="ts">
import { ref, watch } from 'vue'
import Icon from './Icon.vue'
import type { DictionaryEntry } from '@/types/domain'

const props = defineProps<{
  // existing entry to edit, or undefined for "new entry"
  existing?: DictionaryEntry
  // pre-fill the term field (e.g. clicked token text) when creating new
  defaultTerm?: string
}>()

const emit = defineEmits<{
  close: []
  save: [{ term: string; definition: string }]
  remove: [string]
}>()

const term = ref(props.existing?.term ?? props.defaultTerm ?? '')
const definition = ref(props.existing?.definition ?? '')

watch(
  () => props.existing?.id,
  () => {
    term.value = props.existing?.term ?? props.defaultTerm ?? ''
    definition.value = props.existing?.definition ?? ''
  },
)

function submit() {
  const t = term.value.trim()
  const d = definition.value.trim()
  if (!t || !d) return
  emit('save', { term: t, definition: d })
}
</script>

<template>
  <aside
    class="fixed top-0 right-0 bottom-0 w-96 z-[60] bg-white/95 glass-zen border-l border-black/5 flex flex-col p-8 shadow-2xl shadow-zinc-900/5"
  >
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-metadata text-on-tertiary-container uppercase tracking-widest">
        {{ existing ? 'Edit translation' : 'New translation' }}
      </h2>
      <button
        @click="$emit('close')"
        aria-label="Close"
        class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-900/5 text-on-surface transition-colors"
      >
        <Icon name="close" :size="20" />
      </button>
    </div>

    <p class="text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Term</p>
    <input
      v-model="term"
      type="text"
      class="w-full p-3 rounded-lg border border-black/10 focus:border-zinc-900 focus:ring-0 outline-none text-body-sm mb-5"
      placeholder="word or phrase"
    />

    <p class="text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Translation</p>
    <textarea
      v-model="definition"
      rows="8"
      autofocus
      class="flex-1 w-full p-3 rounded-lg border border-black/10 focus:border-zinc-900 focus:ring-0 outline-none text-body-sm resize-none min-h-[200px]"
      placeholder="meaning, slang, AAVE, references…"
      @keydown.meta.enter.prevent="submit"
      @keydown.ctrl.enter.prevent="submit"
    />

    <div class="flex items-center justify-between gap-2 mt-6">
      <button
        v-if="existing"
        @click="$emit('remove', existing.id)"
        class="text-[11px] uppercase tracking-widest text-on-surface/40 hover:text-red-600 transition-colors"
      >Delete</button>
      <span v-else />
      <div class="flex gap-2">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-[11px] uppercase tracking-widest text-on-surface/60 hover:text-on-surface"
        >Cancel</button>
        <button
          @click="submit"
          :disabled="!term.trim() || !definition.trim()"
          class="px-5 py-2 bg-zinc-900 text-white rounded-full text-[11px] uppercase tracking-widest hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >{{ existing ? 'Save' : 'Add' }}</button>
      </div>
    </div>
  </aside>
</template>

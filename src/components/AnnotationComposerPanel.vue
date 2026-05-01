<script setup lang="ts">
import { ref, watch } from 'vue'
import Icon from './Icon.vue'
import { ANNOTATION_TAGS, type Annotation, type AnnotationTag } from '@/types/domain'

const props = defineProps<{
  selectedText: string
  existing?: Annotation
}>()

const emit = defineEmits<{
  close: []
  save: [{ tags: AnnotationTag[]; body: string }]
}>()

const tags = ref<AnnotationTag[]>([...(props.existing?.tags ?? [])])
const body = ref(props.existing?.body ?? '')

watch(
  () => props.existing?.id,
  () => {
    tags.value = [...(props.existing?.tags ?? [])]
    body.value = props.existing?.body ?? ''
  },
)

function toggleTag(t: AnnotationTag) {
  const i = tags.value.indexOf(t)
  if (i === -1) tags.value.push(t)
  else tags.value.splice(i, 1)
}

function submit() {
  if (!body.value.trim()) return
  emit('save', { tags: [...tags.value], body: body.value.trim() })
}
</script>

<template>
  <aside
    class="fixed top-0 right-0 bottom-0 w-96 z-[60] bg-white/95 glass-zen border-l border-black/5 flex flex-col p-8 shadow-2xl shadow-zinc-900/5"
  >
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-metadata text-on-tertiary-container uppercase tracking-widest">
        {{ existing ? 'Edit comment' : 'New comment' }}
      </h2>
      <button
        @click="$emit('close')"
        aria-label="Close"
        class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-900/5 text-on-surface transition-colors"
      >
        <Icon name="close" :size="20" />
      </button>
    </div>

    <p class="text-active-lyric text-on-surface leading-snug mb-6">
      &ldquo;{{ selectedText }}&rdquo;
    </p>

    <p class="text-[10px] uppercase tracking-widest text-on-surface/40 mb-3">Tags</p>
    <div class="flex flex-wrap gap-2 mb-6">
      <button
        v-for="t in ANNOTATION_TAGS"
        :key="t.key"
        @click="toggleTag(t.key)"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-widest transition-colors border"
        :class="
          tags.includes(t.key)
            ? 'bg-zinc-900 text-white border-zinc-900'
            : 'bg-white text-on-surface/60 border-zinc-200 hover:border-zinc-400'
        "
      >
        <span class="font-bold" :class="tags.includes(t.key) ? '' : t.markerClass">
          {{ t.marker }}
        </span>
        {{ t.label }}
      </button>
    </div>

    <p class="text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Comment</p>
    <textarea
      v-model="body"
      rows="6"
      autofocus
      class="flex-1 w-full p-3 rounded-lg border border-black/10 focus:border-zinc-900 focus:ring-0 outline-none text-body-sm resize-none min-h-[160px]"
      placeholder="Add a comment, translation, or reference…"
      @keydown.meta.enter.prevent="submit"
      @keydown.ctrl.enter.prevent="submit"
    />

    <div class="flex justify-end gap-2 mt-6">
      <button
        @click="$emit('close')"
        class="px-4 py-2 text-[11px] uppercase tracking-widest text-on-surface/60 hover:text-on-surface"
      >Cancel</button>
      <button
        @click="submit"
        :disabled="!body.trim()"
        class="px-5 py-2 bg-zinc-900 text-white rounded-full text-[11px] uppercase tracking-widest hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
      >{{ existing ? 'Save' : 'Add' }}</button>
    </div>
  </aside>
</template>

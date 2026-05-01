<script setup lang="ts">
import Icon from './Icon.vue'
import { ANNOTATION_TAGS, type Annotation, type AnnotationTag } from '@/types/domain'

defineProps<{
  annotations: Annotation[]
  lineText?: string
}>()

defineEmits<{
  close: []
  remove: [string]
  edit: [Annotation]
}>()

const tagMeta = (t: AnnotationTag) => ANNOTATION_TAGS.find((x) => x.key === t)!
</script>

<template>
  <aside
    class="fixed top-0 right-0 bottom-0 w-96 z-[60] bg-white/95 glass-zen border-l border-black/5 flex flex-col p-8 shadow-2xl shadow-zinc-900/5"
  >
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-metadata text-on-tertiary-container uppercase tracking-widest">
        Comment
      </h2>
      <button
        @click="$emit('close')"
        aria-label="Close"
        class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-900/5 text-on-surface transition-colors"
      >
        <Icon name="close" :size="20" />
      </button>
    </div>

    <p
      v-if="lineText"
      class="text-active-lyric text-on-surface/50 leading-snug mb-8 italic"
    >&ldquo;{{ lineText }}&rdquo;</p>

    <div class="flex-1 overflow-y-auto pr-2 space-y-6">
      <div
        v-for="a in annotations"
        :key="a.id"
        class="pb-6 border-b border-black/5 last:border-b-0"
      >
        <div class="flex items-center justify-between mb-3 gap-2">
          <div v-if="a.tags.length" class="flex items-center gap-1.5 flex-wrap">
            <span
              v-for="t in a.tags"
              :key="t"
              class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 text-[10px] uppercase tracking-widest text-on-surface/70"
            >
              <span class="font-bold" :class="tagMeta(t).markerClass">
                {{ tagMeta(t).marker }}
              </span>
              {{ tagMeta(t).label }}
            </span>
          </div>
          <span v-else class="text-[10px] uppercase tracking-widest text-on-surface/40">
            Comment
          </span>
          <div class="flex items-center gap-3 ml-auto shrink-0">
            <button
              @click="$emit('edit', a)"
              class="text-on-surface/40 hover:text-on-surface transition-colors text-[11px] uppercase tracking-widest"
            >Edit</button>
            <button
              @click="$emit('remove', a.id)"
              class="text-on-surface/40 hover:text-red-600 transition-colors text-[11px] uppercase tracking-widest"
            >Delete</button>
          </div>
        </div>
        <p class="text-body-sm leading-relaxed whitespace-pre-wrap">{{ a.body }}</p>
        <p
          v-if="a.contributor"
          class="text-[10px] text-on-surface/40 uppercase tracking-widest mt-3"
        >&mdash; {{ a.contributor }}</p>
      </div>
    </div>
  </aside>
</template>

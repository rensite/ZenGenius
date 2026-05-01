<script setup lang="ts">
import { computed } from 'vue'
import {
  ANNOTATION_TAGS,
  type Annotation,
  type AnnotationTag,
  type Line,
  type RhymeColor,
  type RhymeMark,
} from '@/types/domain'

interface Props {
  line: Line
  active?: boolean
  italic?: boolean
  annotations?: Annotation[]
  rhymes?: { mark: RhymeMark; color: RhymeColor }[]
  showAnnotations?: boolean
  showRhymes?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  active: true,
  italic: false,
  annotations: () => [],
  rhymes: () => [],
  showAnnotations: true,
  showRhymes: true,
})

const emit = defineEmits<{
  'annotation-click': [{ annotations: Annotation[]; x: number; y: number }]
}>()

interface Span {
  text: string
  classes: string[]
  title?: string
  annotationIds: string[]
  tags: AnnotationTag[]
}

const colorCls: Record<RhymeColor, string> = {
  blue: 'rhyme-blue',
  purple: 'rhyme-purple',
  mint: 'rhyme-mint',
  gold: 'rhyme-gold',
  rose: 'rhyme-rose',
}

const tagMeta = (t: AnnotationTag) => ANNOTATION_TAGS.find((x) => x.key === t)!

const spans = computed<Span[]>(() => {
  const text = props.line.text
  type Range = {
    start: number
    end: number
    classes: string[]
    title?: string
    annotationId?: string
    tags?: AnnotationTag[]
  }
  const ranges: Range[] = []

  if (props.showAnnotations) {
    for (const a of props.annotations) {
      ranges.push({
        start: a.charStart,
        end: Math.min(a.charEnd, text.length),
        classes: ['annotation-highlight', 'cursor-pointer'],
        title: a.body.slice(0, 80),
        annotationId: a.id,
        tags: a.tags,
      })
    }
  }
  if (props.showRhymes) {
    for (const { mark, color } of props.rhymes) {
      ranges.push({
        start: mark.charStart,
        end: Math.min(mark.charEnd, text.length),
        classes: [colorCls[color], 'rounded px-0.5'],
      })
    }
  }
  if (ranges.length === 0) return [{ text, classes: [], annotationIds: [], tags: [] }]

  const points = new Set<number>([0, text.length])
  for (const r of ranges) {
    points.add(Math.max(0, r.start))
    points.add(Math.min(text.length, r.end))
  }
  const sorted = [...points].sort((a, b) => a - b)
  const out: Span[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (a === b) continue
    const matched = ranges.filter((r) => r.start <= a && r.end >= b)
    const tagSet = new Set<AnnotationTag>()
    for (const r of matched) for (const t of r.tags ?? []) tagSet.add(t)
    out.push({
      text: text.slice(a, b),
      classes: matched.flatMap((r) => r.classes),
      title: matched.find((r) => r.title)?.title,
      annotationIds: matched.map((r) => r.annotationId).filter((id): id is string => !!id),
      tags: [...tagSet],
    })
  }
  return out
})

function onSpanClick(span: Span, e: MouseEvent) {
  if (span.annotationIds.length === 0) return
  e.stopPropagation()
  const found = props.annotations.filter((a) => span.annotationIds.includes(a.id))
  if (found.length === 0) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  emit('annotation-click', {
    annotations: found,
    x: rect.left + rect.width / 2,
    y: rect.top - 8,
  })
}
</script>

<template>
  <p
    class="text-center transition-opacity duration-500"
    :class="[
      active ? 'text-active-lyric text-on-surface' : 'text-inactive-lyric text-on-surface/40',
      italic && 'italic',
    ]"
  >
    <template v-for="(s, i) in spans" :key="i">
      <span
        :class="[s.classes, s.annotationIds.length && 'relative inline-block']"
        :title="s.title"
        @click="onSpanClick(s, $event)"
      >
        <span
          v-if="s.tags.length"
          class="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[11px] leading-none pointer-events-none select-none"
        >
          <span
            v-for="t in s.tags"
            :key="t"
            :class="tagMeta(t).markerClass"
            class="font-bold"
          >{{ tagMeta(t).marker }}</span>
        </span>
        {{ s.text }}
      </span>
    </template>
  </p>
</template>

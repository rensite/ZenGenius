<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTracksStore } from '@/stores/tracks'
import { useAnnotationsStore } from '@/stores/annotations'
import { useRhymesStore } from '@/stores/rhymes'
import { useDictionaryStore } from '@/stores/dictionary'
import { storeToRefs } from 'pinia'
import TopBar from '@/components/TopBar.vue'
import LyricLine from '@/components/LyricLine.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import AnnotationPanel from '@/components/AnnotationPanel.vue'
import AnnotationComposerPanel from '@/components/AnnotationComposerPanel.vue'
import LyricsEditorPanel from '@/components/LyricsEditorPanel.vue'
import TrackAboutPanel from '@/components/TrackAboutPanel.vue'
import Icon from '@/components/Icon.vue'
import type { Annotation, AnnotationRange, AnnotationTag, RhymeColor } from '@/types/domain'
import { useUIStore } from '@/stores/ui'

const props = defineProps<{ id: string }>()
const router = useRouter()

const tracksStore = useTracksStore()
const annotationsStore = useAnnotationsStore()
const rhymesStore = useRhymesStore()
const dictionaryStore = useDictionaryStore()
const ui = useUIStore()
const { activeRhymeColor } = storeToRefs(ui)

onMounted(async () => {
  await tracksStore.fetchAll()
  await annotationsStore.fetchFor(props.id)
  await rhymesStore.fetchFor(props.id)
  await dictionaryStore.fetchFor(props.id)
})

const track = computed(() => tracksStore.byId(props.id))
const trackAnnotations = computed(() => annotationsStore.byTrack[props.id] ?? [])
const trackDictionary = computed(() => dictionaryStore.byTrack[props.id] ?? [])

type Mode = 'read' | 'rhymes' | 'keywords'
const mode = ref<Mode>('keywords')

const MIN_WIDTH = 480
const MAX_WIDTH = 1280
const containerWidth = ref<number>(
  parseInt(localStorage.getItem('lyriclens.containerWidth') ?? '860', 10),
)
const resizing = ref(false)

function startResize(e: MouseEvent, side: 'left' | 'right' = 'right') {
  e.preventDefault()
  resizing.value = true
  const startX = e.clientX
  const startW = containerWidth.value
  const sign = side === 'right' ? 1 : -1
  function onMove(ev: MouseEvent) {
    const delta = (ev.clientX - startX) * 2 * sign
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + delta))
    containerWidth.value = next
  }
  function onUp() {
    resizing.value = false
    localStorage.setItem('lyriclens.containerWidth', String(containerWidth.value))
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

const aboutOpen = ref(false)
const editOpen = ref(false)
const viewing = ref<{ annotations: Annotation[]; lineId: string } | null>(null)
const composing = ref<{
  ranges: AnnotationRange[]
  text: string
  existing?: Annotation
} | null>(null)
const pendingRanges = ref<AnnotationRange[]>([])

function lineTextById(lineId: string): string {
  if (!track.value) return ''
  for (const s of track.value.sections) {
    const l = s.lines.find((x) => x.id === lineId)
    if (l) return l.text
  }
  return ''
}

function rangesText(ranges: AnnotationRange[]): string {
  return ranges
    .map((r) => lineTextById(r.lineId).slice(r.charStart, r.charEnd))
    .join(' · ')
}

async function saveAnnotation(payload: { tags: AnnotationTag[]; body: string }) {
  if (!composing.value) return
  if (composing.value.existing) {
    await annotationsStore.update({
      ...composing.value.existing,
      tags: payload.tags,
      body: payload.body,
    })
  } else {
    await annotationsStore.add({
      trackId: props.id,
      ranges: composing.value.ranges,
      tags: payload.tags,
      body: payload.body,
    })
  }
  composing.value = null
  pendingRanges.value = []
  window.getSelection()?.removeAllRanges()
}

function startEdit(a: Annotation) {
  composing.value = {
    ranges: a.ranges.map((r) => ({ ...r })),
    text: rangesText(a.ranges),
    existing: a,
  }
  viewing.value = null
}

function dismissCompose() {
  composing.value = null
  window.getSelection()?.removeAllRanges()
}

function onAnnotationClick(p: { annotations: Annotation[] }) {
  if (p.annotations.length === 0) return
  const first = p.annotations[0]
  viewing.value = { annotations: p.annotations, lineId: first.ranges[0]?.lineId ?? '' }
}

const viewingLineText = computed(() => {
  if (!viewing.value) return ''
  return lineTextById(viewing.value.lineId)
})

async function removeViewedAnnotation(id: string) {
  await annotationsStore.remove(props.id, id)
  if (!viewing.value) return
  viewing.value.annotations = viewing.value.annotations.filter((a) => a.id !== id)
  if (viewing.value.annotations.length === 0) viewing.value = null
}

async function saveLyrics(payload: {
  title: string
  artist: string
  album?: string
  about?: string
  lyrics: string
}) {
  await tracksStore.updateLyrics(props.id, payload.lyrics, {
    title: payload.title,
    artist: payload.artist,
    album: payload.album,
    about: payload.about,
  })
  editOpen.value = false
}

async function deleteTrack() {
  if (!track.value) return
  if (!confirm(`Delete "${track.value.title}"? This cannot be undone.`)) return
  await tracksStore.remove(props.id)
  router.replace('/library')
}

// Rhymes mode
function rhymesForLine(lineId: string) {
  const groups = rhymesStore.byTrack[props.id] ?? []
  return groups.flatMap((g) =>
    g.marks.filter((m) => m.lineId === lineId).map((mark) => ({ mark, color: g.color })),
  )
}

interface Token {
  text: string
  start: number
  end: number
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length })
  }
  return tokens
}

function tokenColor(lineId: string, t: Token): RhymeColor | null {
  return rhymesStore.colorAt(props.id, lineId, t.start, t.end)
}

function tokenAnnotations(lineId: string, t: Token): Annotation[] {
  return trackAnnotations.value.filter((a) =>
    a.ranges.some(
      (r) => r.lineId === lineId && r.charStart < t.end && r.charEnd > t.start,
    ),
  )
}

interface FlowToken extends Token {
  lineId: string
  tokIdx: number
  lineStart: boolean
  bindRight: boolean
}

function sectionTokens(lines: { id: string; text: string }[]): FlowToken[] {
  const out: FlowToken[] = []
  let idx = 0
  lines.forEach((l, li) => {
    tokenize(l.text).forEach((t, ti) => {
      out.push({
        ...t,
        lineId: l.id,
        tokIdx: idx++,
        lineStart: li > 0 && ti === 0,
        bindRight: false,
      })
    })
  })
  for (let k = 0; k < out.length - 1; k++) {
    if (out[k + 1].lineStart) out[k].bindRight = true
  }
  return out
}

function sectionTokensFor(lineId: string): FlowToken[] {
  if (!track.value) return []
  for (const s of track.value.sections) {
    if (s.lines.some((l) => l.id === lineId)) return sectionTokens(s.lines)
  }
  return []
}

function rangesFromTokens(tokens: FlowToken[]): AnnotationRange[] {
  const byLine = new Map<string, { start: number; end: number }>()
  for (const t of tokens) {
    const r = byLine.get(t.lineId)
    if (!r) byLine.set(t.lineId, { start: t.start, end: t.end })
    else {
      r.start = Math.min(r.start, t.start)
      r.end = Math.max(r.end, t.end)
    }
  }
  return [...byLine.entries()].map(([lineId, r]) => ({
    lineId,
    charStart: r.start,
    charEnd: r.end,
  }))
}

function rangesEqual(a: AnnotationRange, b: AnnotationRange): boolean {
  return a.lineId === b.lineId && a.charStart === b.charStart && a.charEnd === b.charEnd
}

function pendingHasToken(t: FlowToken): boolean {
  return pendingRanges.value.some(
    (r) => r.lineId === t.lineId && r.charStart <= t.start && r.charEnd >= t.end,
  )
}

function togglePendingToken(t: FlowToken) {
  const tokenRange: AnnotationRange = {
    lineId: t.lineId,
    charStart: t.start,
    charEnd: t.end,
  }
  const idx = pendingRanges.value.findIndex((r) => rangesEqual(r, tokenRange))
  if (idx !== -1) pendingRanges.value.splice(idx, 1)
  else pendingRanges.value.push(tokenRange)
}

function clickKeywordToken(lineId: string, t: Token, e: MouseEvent) {
  const sel = window.getSelection()
  if (e.shiftKey) {
    e.preventDefault()
    e.stopPropagation()
    sel?.removeAllRanges()
    const flow = sectionTokensFor(lineId).find(
      (x) => x.lineId === lineId && x.start === t.start && x.end === t.end,
    )
    if (flow) togglePendingToken(flow)
    return
  }
  if (sel && !sel.isCollapsed) return
  e.stopPropagation()
  const found = tokenAnnotations(lineId, t)
  if (found.length > 0) {
    viewing.value = { annotations: found, lineId }
    return
  }
  composing.value = {
    ranges: [{ lineId, charStart: t.start, charEnd: t.end }],
    text: t.text,
  }
  pendingRanges.value = []
  viewing.value = null
}

function findTokenSpan(node: Node | null): HTMLElement | null {
  while (node && node !== document.body) {
    if (node instanceof HTMLElement && node.dataset.tokStart != null) return node
    node = node.parentNode
  }
  return null
}

function onKeywordsMouseup(e: MouseEvent) {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const a = findTokenSpan(range.startContainer)
  const b = findTokenSpan(range.endContainer)
  if (!a || !b) return
  const flowA = sectionTokensFor(a.dataset.lineId!).find(
    (x) =>
      x.lineId === a.dataset.lineId &&
      x.start === parseInt(a.dataset.tokStart!, 10),
  )
  const flowB = sectionTokensFor(b.dataset.lineId!).find(
    (x) =>
      x.lineId === b.dataset.lineId &&
      x.start === parseInt(b.dataset.tokStart!, 10),
  )
  if (!flowA || !flowB) return
  const sectionFlow = sectionTokensFor(flowA.lineId)
  if (!sectionFlow.some((x) => x.lineId === flowB.lineId)) return // different section
  const i1 = sectionFlow.findIndex(
    (x) => x.lineId === flowA.lineId && x.start === flowA.start,
  )
  const i2 = sectionFlow.findIndex(
    (x) => x.lineId === flowB.lineId && x.start === flowB.start,
  )
  if (i1 === -1 || i2 === -1) return
  const [lo, hi] = i1 <= i2 ? [i1, i2] : [i2, i1]
  const slice = sectionFlow.slice(lo, hi + 1)
  const ranges = rangesFromTokens(slice)
  if (ranges.length === 0) return
  const firstSpan = document.querySelector<HTMLElement>(
    `span[data-line-id="${slice[0].lineId}"][data-tok-start="${slice[0].start}"]`,
  )
  const lastSpan = document.querySelector<HTMLElement>(
    `span[data-line-id="${slice[slice.length - 1].lineId}"][data-tok-start="${slice[slice.length - 1].start}"]`,
  )
  if (firstSpan && lastSpan) {
    const snapped = document.createRange()
    snapped.setStart(firstSpan, 0)
    snapped.setEnd(lastSpan, lastSpan.childNodes.length)
    sel.removeAllRanges()
    sel.addRange(snapped)
  }
  if (e.shiftKey) {
    for (const r of ranges) {
      if (!pendingRanges.value.some((p) => rangesEqual(p, r))) pendingRanges.value.push(r)
    }
    return
  }
  composing.value = { ranges, text: rangesText(ranges) }
  pendingRanges.value = []
  viewing.value = null
}

function commitPending() {
  if (pendingRanges.value.length === 0) return
  composing.value = {
    ranges: [...pendingRanges.value],
    text: rangesText(pendingRanges.value),
  }
  pendingRanges.value = []
  viewing.value = null
}

function clearPending() {
  pendingRanges.value = []
}

const hoveredAnnotationId = ref<string | null>(null)

function isTokenHovered(lineId: string, t: Token): boolean {
  if (!hoveredAnnotationId.value) return false
  return tokenAnnotations(lineId, t).some((a) => a.id === hoveredAnnotationId.value)
}

const rhymeColorClass: Record<RhymeColor, string> = {
  blue: 'rhyme-blue',
  purple: 'rhyme-purple',
  mint: 'rhyme-mint',
  gold: 'rhyme-gold',
  rose: 'rhyme-rose',
}

const palette: { color: RhymeColor; bg: string; ring: string }[] = [
  { color: 'blue', bg: 'bg-sky-200', ring: 'ring-sky-300' },
  { color: 'purple', bg: 'bg-purple-200', ring: 'ring-purple-300' },
  { color: 'mint', bg: 'bg-emerald-200', ring: 'ring-emerald-300' },
  { color: 'gold', bg: 'bg-amber-200', ring: 'ring-amber-300' },
  { color: 'rose', bg: 'bg-rose-200', ring: 'ring-rose-300' },
]

async function clickToken(lineId: string, t: Token) {
  await rhymesStore.toggleMark(props.id, activeRhymeColor.value, {
    lineId,
    charStart: t.start,
    charEnd: t.end,
  })
}

async function clearRhymes() {
  if (!confirm('Clear all rhyme groups for this track?')) return
  await rhymesStore.clearAll(props.id)
}

function printPage() {
  window.print()
}
</script>

<template>
  <div class="no-print">
    <TopBar />
  </div>

  <main
    v-if="track"
    class="pt-24 pb-32 mx-auto px-gutter relative"
    :style="{ maxWidth: containerWidth + 'px' }"
    :class="resizing ? 'select-none' : ''"
  >
    <!-- Resize handles -->
    <div
      class="no-print hidden md:block absolute top-24 bottom-32 -left-3 w-6 cursor-ew-resize group z-30"
      @mousedown="startResize($event, 'left')"
      title="Drag to resize"
    >
      <div
        class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
        :class="resizing ? '!opacity-100 bg-zinc-900' : ''"
      ></div>
    </div>
    <div
      class="no-print hidden md:block absolute top-24 bottom-32 -right-3 w-6 cursor-ew-resize group z-30"
      @mousedown="startResize($event, 'right')"
      title="Drag to resize"
    >
      <div
        class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
        :class="resizing ? '!opacity-100 bg-zinc-900' : ''"
      ></div>
    </div>
    <!-- Sub-header: breadcrumb, mode tabs, actions -->
    <div class="no-print flex items-center justify-between mb-10">
      <RouterLink
        to="/library"
        class="flex items-center gap-2 text-[12px] uppercase tracking-widest text-on-surface/50 hover:text-on-surface transition-colors"
      >
        <Icon name="arrow_back" :size="16" />
        Library
      </RouterLink>

      <div
        class="inline-flex items-center gap-1 p-1 rounded-full ghost-border bg-white/40 glass-blur"
      >
        <button
          v-for="m in (['keywords', 'read', 'rhymes'] as Mode[])"
          :key="m"
          @click="mode = m"
          class="px-4 py-1.5 rounded-full text-[11px] uppercase tracking-widest transition-colors"
          :class="
            mode === m
              ? 'bg-zinc-900 text-white'
              : 'text-on-surface/60 hover:text-on-surface'
          "
        >{{ m }}</button>
      </div>

      <div class="flex items-center gap-1">
        <button
          @click="aboutOpen = true"
          class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-900/5 text-on-surface/60 hover:text-on-surface transition-colors"
          title="About / Dictionary"
        >
          <Icon name="info" :size="18" />
        </button>
        <button
          @click="editOpen = true"
          class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-900/5 text-on-surface/60 hover:text-on-surface transition-colors"
          title="Edit lyrics"
        >
          <Icon name="edit" :size="18" />
        </button>
        <button
          @click="printPage"
          class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-900/5 text-on-surface/60 hover:text-on-surface transition-colors"
          title="Print"
        >
          <Icon name="print" :size="18" />
        </button>
        <button
          @click="deleteTrack"
          class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-red-50 text-on-surface/40 hover:text-red-600 transition-colors"
          title="Delete track"
        >
          <Icon name="delete" :size="18" />
        </button>
      </div>
    </div>

    <!-- Heading -->
    <header class="text-center mb-16">
      <p class="text-metadata text-on-surface-variant uppercase tracking-widest mb-2">
        {{ track.artist }}<template v-if="track.album"> &middot; {{ track.album }}</template>
      </p>
      <h1 class="text-display-lyric text-on-surface">{{ track.title }}</h1>
    </header>

    <!-- Lyrics -->
    <article class="space-y-12">
      <section v-for="s in track.sections" :key="s.id">
        <SectionHeader :label="s.label" :performer="s.performer" />
        <!-- Keywords: section flows as one justified block -->
        <p
          v-if="mode === 'keywords'"
          class="mt-4 uppercase text-active-lyric text-justify py-1 select-text leading-[2.4]"
          @mouseup="onKeywordsMouseup"
        >
          <template v-for="(t, i) in sectionTokens(s.lines)" :key="i"><span
            v-if="t.lineStart"
            class="text-on-surface/30"
          >/{{ '\u00a0' }}</span><span
            class="px-1 transition-colors cursor-pointer rounded"
            :class="[
              tokenAnnotations(t.lineId, t).length
                ? 'text-on-surface'
                : 'text-on-surface/25 hover:text-on-surface/60',
              isTokenHovered(t.lineId, t) ? 'bg-zinc-900/[0.06]' : '',
              pendingHasToken(t) ? 'bg-amber-200/60 text-on-surface' : '',
            ]"
            :data-line-id="t.lineId"
            :data-tok-start="t.start"
            :data-tok-end="t.end"
            @click="clickKeywordToken(t.lineId, t, $event)"
            @mouseenter="
              hoveredAnnotationId = tokenAnnotations(t.lineId, t)[0]?.id ?? null
            "
            @mouseleave="hoveredAnnotationId = null"
          >{{ t.text }}{{ t.bindRight ? '\u00a0' : ' ' }}</span></template>
        </p>
        <div v-else class="space-y-3 mt-4">
          <template v-for="l in s.lines" :key="l.id">
            <!-- Read: render as LyricLine with annotation underlines -->
            <div
              v-if="mode === 'read'"
              :data-line-id="l.id"
              class="px-2 py-1 rounded transition-colors"
            >
              <LyricLine
                :line="l"
                :italic="s.kind === 'chorus'"
                :annotations="trackAnnotations.filter((a) => a.ranges.some((r) => r.lineId === l.id))"
                :show-annotations="true"
                :show-rhymes="false"
                @annotation-click="onAnnotationClick"
              />
            </div>
            <!-- Rhymes: token-clickable -->
            <p
              v-else-if="mode === 'rhymes'"
              class="text-inactive-lyric flex flex-wrap justify-center gap-x-3 gap-y-2 py-1"
            >
              <span
                v-for="t in tokenize(l.text)"
                :key="t.start"
                class="cursor-pointer px-1 transition-colors rounded"
                :class="
                  tokenColor(l.id, t)
                    ? rhymeColorClass[tokenColor(l.id, t)!]
                    : 'hover:bg-surface-container'
                "
                @click="clickToken(l.id, t)"
              >{{ t.text }}</span>
            </p>
          </template>
        </div>
      </section>
    </article>
  </main>

  <p
    v-else-if="tracksStore.loaded"
    class="fixed inset-0 flex items-center justify-center text-on-surface/50"
  >Track not found.</p>

  <!-- Keywords pending-selection floating bar -->
  <Transition name="fade">
    <div
      v-if="mode === 'keywords' && pendingRanges.length > 0 && !composing && !viewing"
      class="no-print fixed bottom-10 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 bg-white/80 glass-blur ghost-border rounded-full shadow-xl shadow-zinc-900/5 flex items-center gap-3"
    >
      <span class="text-[11px] uppercase tracking-widest text-on-surface/60">
        {{ pendingRanges.length }} pieces
      </span>
      <button
        @click="commitPending"
        class="flex items-center gap-1.5 px-4 py-1.5 bg-zinc-900 text-white rounded-full text-[11px] uppercase tracking-widest hover:bg-zinc-700 transition-colors"
      >
        <Icon name="edit_note" :size="14" filled />
        Annotate
      </button>
      <button
        @click="clearPending"
        class="text-[11px] uppercase tracking-widest text-on-surface/40 hover:text-on-surface"
      >Clear</button>
    </div>
  </Transition>

  <!-- Rhymes-mode palette -->
  <Transition name="fade">
    <nav
      v-if="mode === 'rhymes'"
      class="no-print fixed bottom-10 left-1/2 -translate-x-1/2 z-40 flex items-center gap-6 px-6 py-3 bg-white/40 glass-zen rounded-full border border-white/30 shadow-2xl shadow-zinc-500/10"
    >
      <div class="flex items-center gap-3 pr-4 border-r border-zinc-200/50">
        <span class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Color</span>
        <div class="flex items-center gap-2">
          <button
            v-for="p in palette"
            :key="p.color"
            @click="ui.setRhymeColor(p.color)"
            class="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
            :class="[
              p.bg,
              activeRhymeColor === p.color
                ? `ring-4 ring-offset-0 ${p.ring} scale-110`
                : 'border border-black/5',
            ]"
          >
            <Icon v-if="activeRhymeColor === p.color" name="check" :size="12" />
          </button>
        </div>
      </div>
      <button
        @click="clearRhymes"
        class="text-zinc-600 hover:text-zinc-900 transition-colors"
        title="Clear all"
      >
        <Icon name="delete" :size="18" />
      </button>
    </nav>
  </Transition>

  <!-- Side panels -->
  <Transition name="slide-right" class="no-print">
    <AnnotationPanel
      v-if="viewing"
      :annotations="viewing.annotations"
      :line-text="viewingLineText"
      @close="viewing = null"
      @remove="removeViewedAnnotation"
      @edit="startEdit"
    />
  </Transition>

  <Transition name="slide-right" class="no-print">
    <AnnotationComposerPanel
      v-if="composing"
      :selected-text="composing.text"
      :existing="composing.existing"
      @close="dismissCompose"
      @save="saveAnnotation"
    />
  </Transition>

  <Transition name="slide-right" class="no-print">
    <LyricsEditorPanel
      v-if="editOpen && track"
      :track="track"
      @close="editOpen = false"
      @save="saveLyrics"
    />
  </Transition>

  <Transition name="slide-right" class="no-print">
    <TrackAboutPanel
      v-if="aboutOpen && track"
      :track="track"
      :dictionary="trackDictionary"
      @close="aboutOpen = false"
    />
  </Transition>
</template>

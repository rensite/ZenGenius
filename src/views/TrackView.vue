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
import type { Annotation, AnnotationTag, RhymeColor } from '@/types/domain'
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
  document.addEventListener('selectionchange', onSelectionChange)
})

const track = computed(() => tracksStore.byId(props.id))
const trackAnnotations = computed(() => annotationsStore.byTrack[props.id] ?? [])
const trackDictionary = computed(() => dictionaryStore.byTrack[props.id] ?? [])

type Mode = 'read' | 'annotate' | 'rhymes' | 'keywords'
const mode = ref<Mode>('read')

const aboutOpen = ref(false)
const editOpen = ref(false)
const viewing = ref<{ annotations: Annotation[]; lineId: string } | null>(null)
const composing = ref<{
  lineId: string
  start: number
  end: number
  text: string
  existing?: Annotation
} | null>(null)

function offsetWithin(root: HTMLElement, node: Node, offset: number): number {
  let total = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = walker.nextNode())) {
    if (n === node) return total + offset
    total += (n.nodeValue ?? '').length
  }
  return total
}

function findLineAncestor(node: Node | null): HTMLElement | null {
  while (node && node !== document.body) {
    if (node instanceof HTMLElement && node.dataset.lineId) return node
    node = node.parentNode
  }
  return null
}

function onSelectionChange() {
  if (mode.value !== 'annotate' || composing.value || editOpen.value) return
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
  // Note: we don't dismiss here; the floating popup uses pending selection.
}

function tryStartCompose() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const lineEl = findLineAncestor(range.startContainer)
  if (!lineEl || !lineEl.contains(range.endContainer)) return
  const a = offsetWithin(lineEl, range.startContainer, range.startOffset)
  const b = offsetWithin(lineEl, range.endContainer, range.endOffset)
  const start = Math.min(a, b)
  const end = Math.max(a, b)
  if (start === end) return
  composing.value = {
    lineId: lineEl.dataset.lineId!,
    start,
    end,
    text: lineEl.innerText.slice(start, end),
  }
  viewing.value = null
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
      lineId: composing.value.lineId,
      charStart: composing.value.start,
      charEnd: composing.value.end,
      tags: payload.tags,
      body: payload.body,
    })
  }
  composing.value = null
  window.getSelection()?.removeAllRanges()
}

function startEdit(a: Annotation) {
  if (!track.value) return
  let lineText = ''
  for (const s of track.value.sections) {
    const l = s.lines.find((x) => x.id === a.lineId)
    if (l) {
      lineText = l.text
      break
    }
  }
  composing.value = {
    lineId: a.lineId,
    start: a.charStart,
    end: a.charEnd,
    text: lineText.slice(a.charStart, a.charEnd),
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
  viewing.value = { annotations: p.annotations, lineId: p.annotations[0].lineId }
}

const viewingLineText = computed(() => {
  if (!viewing.value || !track.value) return ''
  for (const s of track.value.sections) {
    const l = s.lines.find((x) => x.id === viewing.value!.lineId)
    if (l) return l.text
  }
  return ''
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
  return trackAnnotations.value.filter(
    (a) => a.lineId === lineId && a.charStart < t.end && a.charEnd > t.start,
  )
}

function clickKeywordToken(lineId: string, t: Token, e: MouseEvent) {
  const found = tokenAnnotations(lineId, t)
  if (found.length === 0) return
  e.stopPropagation()
  viewing.value = { annotations: found, lineId }
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
</script>

<template>
  <TopBar />

  <main v-if="track" class="pt-24 pb-32 max-w-[860px] mx-auto px-gutter">
    <!-- Sub-header: breadcrumb, mode tabs, actions -->
    <div class="flex items-center justify-between mb-10">
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
          v-for="m in (['read', 'annotate', 'keywords', 'rhymes'] as Mode[])"
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
        <div class="space-y-3 mt-4">
          <template v-for="l in s.lines" :key="l.id">
            <!-- Read / Annotate: render as LyricLine with annotation underlines -->
            <div
              v-if="mode === 'read' || mode === 'annotate'"
              :data-line-id="l.id"
              class="px-2 py-1 rounded transition-colors"
              :class="mode === 'annotate' ? 'hover:bg-zinc-900/[0.02]' : ''"
            >
              <LyricLine
                :line="l"
                :italic="s.kind === 'chorus'"
                :annotations="trackAnnotations.filter((a) => a.lineId === l.id)"
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
            <!-- Keywords: dim non-annotated tokens, keep annotated ones prominent -->
            <p
              v-else-if="mode === 'keywords'"
              class="text-active-lyric uppercase flex flex-wrap justify-center gap-x-0 gap-y-2 py-1"
            >
              <span
                v-for="t in tokenize(l.text)"
                :key="t.start"
                class="px-2 transition-colors"
                :class="[
                  tokenAnnotations(l.id, t).length
                    ? 'text-on-surface cursor-pointer'
                    : 'text-on-surface/25',
                  isTokenHovered(l.id, t) ? 'bg-zinc-900/[0.06]' : 'rounded',
                ]"
                @click="clickKeywordToken(l.id, t, $event)"
                @mouseenter="
                  hoveredAnnotationId = tokenAnnotations(l.id, t)[0]?.id ?? null
                "
                @mouseleave="hoveredAnnotationId = null"
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

  <!-- Annotate-mode floating popup -->
  <Transition name="fade">
    <div
      v-if="mode === 'annotate' && !composing && !viewing"
      class="fixed bottom-10 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 bg-white/80 glass-blur ghost-border rounded-full shadow-xl shadow-zinc-900/5 flex items-center gap-3"
    >
      <span class="text-[11px] uppercase tracking-widest text-on-surface/60">
        Select a phrase
      </span>
      <button
        @mousedown.prevent="tryStartCompose"
        class="flex items-center gap-1.5 px-4 py-1.5 bg-zinc-900 text-white rounded-full text-[11px] uppercase tracking-widest hover:bg-zinc-700 transition-colors"
      >
        <Icon name="edit_note" :size="14" filled />
        Annotate
      </button>
    </div>
  </Transition>

  <!-- Rhymes-mode palette -->
  <Transition name="fade">
    <nav
      v-if="mode === 'rhymes'"
      class="fixed bottom-10 left-1/2 -translate-x-1/2 z-40 flex items-center gap-6 px-6 py-3 bg-white/40 glass-zen rounded-full border border-white/30 shadow-2xl shadow-zinc-500/10"
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
  <Transition name="slide-right">
    <AnnotationPanel
      v-if="viewing"
      :annotations="viewing.annotations"
      :line-text="viewingLineText"
      @close="viewing = null"
      @remove="removeViewedAnnotation"
      @edit="startEdit"
    />
  </Transition>

  <Transition name="slide-right">
    <AnnotationComposerPanel
      v-if="composing"
      :selected-text="composing.text"
      :existing="composing.existing"
      @close="dismissCompose"
      @save="saveAnnotation"
    />
  </Transition>

  <Transition name="slide-right">
    <LyricsEditorPanel
      v-if="editOpen && track"
      :track="track"
      @close="editOpen = false"
      @save="saveLyrics"
    />
  </Transition>

  <Transition name="slide-right">
    <TrackAboutPanel
      v-if="aboutOpen && track"
      :track="track"
      :dictionary="trackDictionary"
      @close="aboutOpen = false"
    />
  </Transition>
</template>

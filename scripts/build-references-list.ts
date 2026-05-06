// Walk every <song>/REFS.md, extract `**term** — definition` entries, and
// collapse duplicates by case-insensitive term. The output is a markdown
// review file: each unique reference lists every song that mentions it and
// the definition each song wrote, so you can dedupe and edit by hand before
// importing anything into the DB.
//
// Run:
//   SOURCE_DIR='/Users/.../Песни' npx tsx scripts/build-references-list.ts \
//     > /tmp/lyriclens-references.md

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

const sourceDir = required('SOURCE_DIR')

function required(key: string): string {
  const v = process.env[key]
  if (!v) {
    console.error(`Missing env: ${key}`)
    process.exit(1)
  }
  return v
}

const titleCase = (s: string) =>
  s.toLowerCase().split(' ').map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')

// Only strip a leading/trailing quote when it's balanced. The previous
// version naively trimmed every quote char and lost the closing » of terms
// like "Phil Collins — «In the Air Tonight»".
const QUOTE_PAIRS: [string, string][] = [
  ['"', '"'],
  ['“', '”'],
  ['«', '»'],
  ['„', '"'],
  ["'", "'"],
  ['`', '`'],
]
function stripQuotes(s: string): string {
  let prev: string
  s = s.trim()
  do {
    prev = s
    for (const [open, close] of QUOTE_PAIRS) {
      if (s.length >= open.length + close.length && s.startsWith(open) && s.endsWith(close)) {
        s = s.slice(open.length, s.length - close.length).trim()
      }
    }
  } while (s !== prev)
  return s
}

// Cyrillic → Latin transliteration just for dedup keys, so "Ким Скотт" and
// "Kim Scott" land in the same group. Display strings keep the original.
const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}
function transliterate(s: string): string {
  let out = ''
  for (const ch of s) out += CYRILLIC_MAP[ch] ?? ch
  return out
}

// Manual aliases for terms the structural normalizer can't merge — different
// surnames, nicknames, transliterations that diverge too far. Keys and values
// are matched after the structural normalize runs, so write them in lowercase
// Latin form.
const ALIASES: Record<string, string> = {
  // Hailie Jade Mathers (Eminem's daughter)
  'hailie jade mathers': 'hailie jade',
  'hailie jade scott': 'hailie jade',
  'hailie jade scott mathers': 'hailie jade',
  hailie: 'hailie jade',
  haili: 'hailie jade',
  hailey: 'hailie jade',
  'heili dzheid': 'hailie jade',
  heili: 'hailie jade',

  // Kim Scott (Eminem's ex-wife). Note: leaves the SONG entries titled "Kim" /
  // «KIM» alone — those are about the track, not the person.
  'kim scott': 'kim scott',
  'kim skott': 'kim scott',
  'kimberly anne scott': 'kim scott',
  'kimberley anne skott': 'kim scott',
  "kim scott's experiences": 'kim scott',

  // Debbie Mathers / Debbie Nelson (Eminem's mother)
  debbie: 'debbie mathers',
  'debbie mathers': 'debbie mathers',
  'debbie mathers-swanson': 'debbie mathers',
  'debbie nelson': 'debbie mathers',
  debbi: 'debbie mathers',
  'debbi nelson': 'debbie mathers',
  'debbi meters': 'debbie mathers', // Дэбби Мэтерс
  'debbi meters-swanson': 'debbie mathers',

  // Dr. Dre (Andre Romelle Young)
  'dr. dre': 'dr dre',
  'dr dre': 'dr dre',
  'andre romelle young': 'dr dre',
  'doktor dre': 'dr dre', // Доктор Дрэ
  'doktor dre.': 'dr dre',
}

function normalizeKey(term: string): string {
  const base = transliterate(
    term
      .toLowerCase()
      .replace(/\([^)]*\)/g, '') // drop parenthetical aliases
      // drop typographic quote characters but NOT the ASCII apostrophe — that
      // one appears inside contractions like "Kim Scott's" and stripping it
      // produces a different key.
      .replace(/[«»“”‘’„‚`]/g, '')
      .replace(/[\s ]+/g, ' ')
      .trim(),
  )
  return ALIASES[base] ?? base
}

// Pick the cleanest display name: prefer terms without parentheticals (which
// often carry tangential context), and among those, the shortest reasonable
// one. Falls back to length comparison when both have or both lack parens.
function isBetterDisplay(candidate: string, current: string): boolean {
  const cParen = /[()]/.test(candidate)
  const curParen = /[()]/.test(current)
  if (cParen !== curParen) return !cParen // prefer no parens
  // Same parenness: prefer shorter (less likely to be a verbose variant)
  return candidate.length < current.length
}

interface RefHit {
  term: string
  definition: string
  song: string
}

function parseRefs(raw: string, song: string): RefHit[] {
  const out: RefHit[] = []
  const lines = raw.split('\n')
  let cur: { term: string; definition: string } | null = null
  let inCrossRefs = false

  const flush = () => {
    if (cur) {
      cur.definition = cur.definition.trim()
      if (cur.term && cur.definition) out.push({ ...cur, song })
    }
    cur = null
  }

  for (const line of lines) {
    const t = line.trim()

    if (/^\*перекр[её]стные\s+ссылки\*/i.test(t)) {
      flush()
      inCrossRefs = true
      continue
    }
    if (inCrossRefs) continue

    // ## Section heading — divider, not a term.
    if (/^#{1,2}\s/.test(t) || /^#\s/.test(t)) {
      flush()
      continue
    }

    // ### term — open an entry that captures the following paragraph(s).
    const h3 = t.match(/^###\s+(.+?)\s*$/)
    if (h3) {
      flush()
      cur = { term: stripQuotes(h3[1].trim()), definition: '' }
      continue
    }

    const inline = t.match(/^\*\*(.+?)\*\*\s*[—\-–:]\s*(.+)$/)
    if (inline) {
      flush()
      out.push({ term: stripQuotes(inline[1].trim()), definition: inline[2].trim(), song })
      continue
    }

    const bold = t.match(/^\*\*(.+?)\*\*(?:\s*\(.+?\))?\s*$/)
    if (bold) {
      flush()
      cur = { term: stripQuotes(bold[1].trim()), definition: '' }
      continue
    }

    if (!t || t.startsWith('---')) {
      flush()
      continue
    }

    if (cur) {
      // Strip leading bullets and inline-bold marker lines like `**Связь:**`
      // from the body, since they're labels, not content.
      const text = t.replace(/^[-*]\s+/, '')
      cur.definition += (cur.definition ? ' ' : '') + text
    }
  }
  flush()
  return out
}

const folders = readdirSync(sourceDir)
  .filter((d) => statSync(join(sourceDir, d)).isDirectory())
  .sort()

const allHits: RefHit[] = []
let songsWithRefs = 0

for (const folderName of folders) {
  const path = join(sourceDir, folderName, 'REFS.md')
  if (!existsSync(path)) continue
  const hits = parseRefs(readFileSync(path, 'utf8'), titleCase(basename(folderName)))
  if (hits.length === 0) continue
  songsWithRefs++
  allHits.push(...hits)
}

// Group by normalized key (transliterated, parentheticals/quotes stripped) so
// "Kim Scott (Kimberly Anne Scott)", "Kim Scott", and "Ким Скотт" all merge.
// The display name is the longest variant — that usually carries the most
// context (full name, dates, etc.).
const byKey = new Map<string, { display: string; variants: Set<string>; hits: RefHit[] }>()
for (const h of allHits) {
  const key = normalizeKey(h.term)
  if (!key) continue
  const slot = byKey.get(key)
  if (slot) {
    slot.hits.push(h)
    slot.variants.add(h.term)
    if (isBetterDisplay(h.term, slot.display)) slot.display = h.term
  } else {
    byKey.set(key, { display: h.term, variants: new Set([h.term]), hits: [h] })
  }
}

const groups = [...byKey.values()].sort((a, b) => a.display.localeCompare(b.display))

let out = ''
out += `# References — consolidated review file\n\n`
out += `Source folders: ${folders.length}, with REFS.md: ${songsWithRefs}, total entries: ${allHits.length}, unique terms: ${groups.length}.\n\n`
out += `Edit this file freely (merge variants, drop noise, rewrite definitions) before importing into the DB.\n\n`
out += `---\n\n`

for (const g of groups) {
  out += `## ${g.display}\n\n`
  const songs = [...new Set(g.hits.map((h) => h.song))].sort()
  out += `**Songs (${songs.length}):** ${songs.join(', ')}\n\n`
  if (g.variants.size > 1) {
    out += `**Variants:** ${[...g.variants].sort().join(' · ')}\n\n`
  }
  if (g.hits.length === 1) {
    out += `${g.hits[0].definition}\n\n`
  } else {
    for (const h of g.hits) {
      out += `### From ${h.song}\n${h.definition}\n\n`
    }
  }
  out += `---\n\n`
}

process.stdout.write(out)
console.error(`Wrote ${groups.length} unique references from ${songsWithRefs} songs (${allHits.length} raw entries).`)

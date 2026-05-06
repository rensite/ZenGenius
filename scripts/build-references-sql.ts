// Convert the consolidated /tmp/lyriclens-references.md into Annotation rows
// tagged 'reference'. For each `## term` group we read its variants and the
// per-song definitions, then for every song listed under "**Songs (N):**" we
// regex-match the term + variants in that song's lyrics and emit one
// Annotation row per (term × song) with all matched ranges.
//
// Output: SQL chunks under OUT_DIR. First chunk wipes existing reference
// annotations for the target owner; trigger is disabled around inserts so
// owner_id survives in SQL Editor (auth.uid() is NULL there).
//
// Run:
//   IMPORT_OWNER_ID=<uuid> \
//   SOURCE_DIR='/Users/.../Песни' \
//   REFS_FILE=/tmp/lyriclens-references.md \
//   npx tsx scripts/build-references-sql.ts

import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { parseLyrics } from '../src/seed/parseLyrics'

const ownerId = required('IMPORT_OWNER_ID')
const sourceDir = required('SOURCE_DIR')
const refsFile = process.env.REFS_FILE ?? '/tmp/lyriclens-references.md'
const fallbackDir = process.env.FALLBACK_DIR ?? './песни'
const outDir = process.env.OUT_DIR ?? '/tmp/lyriclens-references'
const annoBatch = Number(process.env.ANNO_BATCH ?? 200)

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
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

interface RefGroup {
  display: string
  variants: string[]
  songs: string[]
  // Per-song body. Falls back to `default` when a song has no specific def.
  bodies: Map<string, string>
  default: string
}

// Parse the consolidated review file into RefGroups. The format is:
//
//   ## <display>
//
//   **Songs (N):** s1, s2, ...
//
//   **Variants:** v1 · v2 · ...   (optional)
//
//   <single body>             (when one song)
//   ---OR---
//   ### From <Song>
//   <body>
//
//   ### From <Song2>
//   <body2>
//
//   ---
function parseRefsMd(raw: string): RefGroup[] {
  const groups: RefGroup[] = []
  const lines = raw.split('\n')
  let cur: RefGroup | null = null
  let bodyTarget: 'default' | string | null = null
  let buf: string[] = []

  const flushBody = () => {
    if (!cur || bodyTarget === null) return
    const text = buf.join(' ').replace(/\s+/g, ' ').trim()
    if (text) {
      if (bodyTarget === 'default') cur.default = text
      else cur.bodies.set(bodyTarget, text)
    }
    buf = []
  }
  const flushGroup = () => {
    flushBody()
    if (cur && cur.songs.length) groups.push(cur)
    cur = null
    bodyTarget = null
    buf = []
  }

  for (const raw of lines) {
    const t = raw.trim()
    const h2 = t.match(/^##\s+(.+?)\s*$/)
    if (h2) {
      flushGroup()
      cur = { display: h2[1], variants: [h2[1]], songs: [], bodies: new Map(), default: '' }
      bodyTarget = 'default'
      continue
    }
    if (!cur) continue

    if (t.startsWith('# ')) continue // top H1 banner
    if (t === '---') { flushBody(); bodyTarget = 'default'; continue }

    const songsLine = t.match(/^\*\*Songs\s*\(\d+\)\s*:?\*\*\s*(.+)$/i)
    if (songsLine) {
      flushBody()
      cur.songs = songsLine[1].split(',').map((s) => s.trim()).filter(Boolean)
      bodyTarget = 'default'
      continue
    }
    const variantsLine = t.match(/^\*\*Variants\s*:?\*\*\s*(.+)$/i)
    if (variantsLine) {
      flushBody()
      const vs = variantsLine[1].split('·').map((s) => s.trim()).filter(Boolean)
      // Keep display as first; add others uniquely.
      for (const v of vs) if (!cur.variants.includes(v)) cur.variants.push(v)
      bodyTarget = 'default'
      continue
    }
    const fromHeader = t.match(/^###\s+From\s+(.+?)\s*$/i)
    if (fromHeader) {
      flushBody()
      bodyTarget = fromHeader[1].trim()
      continue
    }

    if (t) buf.push(t)
  }
  flushGroup()
  return groups
}

// Strip surrounding parenthetical context from a variant for matching: we
// want to match "Kim Scott", not "Kim Scott (Kimberly Anne Scott)".
function matchableVariants(g: RefGroup): string[] {
  const out = new Set<string>()
  for (const v of g.variants) {
    const cleaned = v.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
    // Drop very short tokens that would over-match (e.g. "Kim" inside "Kimberly")
    // — let the regex's word-boundary handle that, but skip empty/1-char.
    if (cleaned.length >= 2) out.add(cleaned)
  }
  return [...out]
}

function readSong(folder: string) {
  const title = titleCase(basename(folder))
  const lp = join(folder, 'LYRICS.md')
  let lyrics = ''
  if (existsSync(lp)) lyrics = readFileSync(lp, 'utf8')
  else {
    const fb = readdirSync(fallbackDir).find(
      (f) => extname(f) === '.md' && basename(f, '.md').toUpperCase() === basename(folder).toUpperCase(),
    )
    if (fb) lyrics = readFileSync(join(fallbackDir, fb), 'utf8')
  }
  if (!lyrics.trim()) return null
  return { title, lyrics }
}

interface AnnoRow {
  id: string
  track_id: string
  ranges: { lineId: string; charStart: number; charEnd: number }[]
  body: string
  tags: string[]
  created_at: string
}

const groups = parseRefsMd(readFileSync(refsFile, 'utf8'))
console.error(`Parsed ${groups.length} reference groups from ${refsFile}`)

// Build a map: TitleCase song name → { trackId, sections }
const folders = readdirSync(sourceDir).filter((d) => statSync(join(sourceDir, d)).isDirectory()).sort()
const songs = new Map<string, { trackId: string; sections: ReturnType<typeof parseLyrics> }>()
for (const f of folders) {
  const s = readSong(join(sourceDir, f))
  if (!s) continue
  const trackId = `track-${slug(s.title)}`
  const sections = parseLyrics(trackId, s.lyrics)
  if (sections.length) songs.set(s.title, { trackId, sections })
}
console.error(`Loaded ${songs.size} songs with parsed lyrics`)

const now = new Date().toISOString()
const annotations: AnnoRow[] = []
let matchCount = 0
let implicitCount = 0
let groupsMatched = 0
const missingSongs = new Set<string>()
const noMatch: string[] = []

groups.forEach((g, gi) => {
  const variants = matchableVariants(g)
  if (variants.length === 0) return
  // One regex matching any variant, longest first to prefer full matches.
  const sorted = [...variants].sort((a, b) => b.length - a.length)
  const rx = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${sorted.map(escapeRegex).join('|')})(?![\\p{L}\\p{N}])`,
    'giu',
  )

  let groupHadMatch = false
  for (const songName of g.songs) {
    const song = songs.get(songName) ?? songs.get(titleCase(songName))
    if (!song) { missingSongs.add(songName); continue }
    const ranges: AnnoRow['ranges'] = []
    for (const sec of song.sections) {
      for (const l of sec.lines) {
        rx.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = rx.exec(l.text))) {
          ranges.push({ lineId: l.id, charStart: m.index, charEnd: m.index + m[0].length })
          if (m.index === rx.lastIndex) rx.lastIndex++
        }
      }
    }
    const body = g.bodies.get(songName) ?? g.bodies.get(titleCase(songName)) ?? g.default
    if (ranges.length === 0) {
      // Implicit reference: term doesn't appear literally in lyrics. Anchor
      // the annotation to the song's first non-empty line so the UI can show
      // a marker / underline that opens the body in the side panel.
      const firstLine = song.sections.flatMap((s) => s.lines).find((l) => l.text.trim().length > 0)
      if (!firstLine) continue
      annotations.push({
        id: `ann-ref-${gi}-${slug(song.trackId)}`,
        track_id: song.trackId,
        ranges: [{ lineId: firstLine.id, charStart: 0, charEnd: firstLine.text.length }],
        body: `${g.display} — ${body}`,
        tags: ['reference'],
        created_at: now,
      })
      implicitCount++
      continue
    }
    matchCount += ranges.length
    groupHadMatch = true
    annotations.push({
      id: `ann-ref-${gi}-${slug(song.trackId)}`,
      track_id: song.trackId,
      ranges,
      body: `${g.display} — ${body}`,
      tags: ['reference'],
      created_at: now,
    })
  }
  if (groupHadMatch) groupsMatched++
  else noMatch.push(g.display)
})

function pickTag(payload: string): string {
  for (const tag of ['LL', 'LL2', 'LL3', 'X_DUMP']) if (!payload.includes(`$${tag}$`)) return tag
  throw new Error('No safe dollar-quote tag')
}

function annoInsertSQL(slice: AnnoRow[]): string {
  const json = JSON.stringify(slice, null, 2)
  const tag = pickTag(json)
  const Q = `$${tag}$`
  return `insert into public.annotations
  (id, track_id, owner_id, ranges, body, tags, created_at)
select id, track_id, '${ownerId}'::uuid, ranges, body, tags, created_at
from jsonb_to_recordset(${Q}
${json}
${Q}::jsonb) as a(
  id text, track_id text, ranges jsonb, body text, tags text[], created_at timestamptz
);`
}

mkdirSync(outDir, { recursive: true })
const written: string[] = []
let fileIdx = 1
const fname = (s: string) => `${String(fileIdx++).padStart(2, '0')}-${s}.sql`

const setup = [
  `begin;`,
  `delete from public.annotations`,
  `  where owner_id = '${ownerId}'::uuid`,
  `    and 'reference' = any(tags);`,
  `alter table public.annotations disable trigger user;`,
  `commit;`,
].join('\n')
const setupName = fname('setup')
writeFileSync(join(outDir, setupName), setup)
written.push(`${setupName}   → wipe + disable trigger`)

for (let i = 0; i < annotations.length; i += annoBatch) {
  const slice = annotations.slice(i, i + annoBatch)
  const sql = [
    `begin;`,
    `alter table public.annotations disable trigger user;`,
    annoInsertSQL(slice),
    `commit;`,
  ].join('\n\n')
  const name = fname(`anno-${i / annoBatch + 1}`)
  writeFileSync(join(outDir, name), sql)
  written.push(`${name}   → annotations ${i + 1}-${Math.min(i + annoBatch, annotations.length)}`)
}

const finish = [`begin;`, `alter table public.annotations enable trigger user;`, `commit;`].join('\n')
const finishName = fname('finish')
writeFileSync(join(outDir, finishName), finish)
written.push(`${finishName}   → re-enable trigger`)

console.log(`Reference groups: ${groups.length}`)
console.log(`Groups with at least one match: ${groupsMatched}`)
console.log(`Groups with NO matches in any listed song: ${noMatch.length}`)
console.log(`Annotations emitted: ${annotations.length} (explicit: ${annotations.length - implicitCount}, implicit/whole-line: ${implicitCount})`)
console.log(`Total ranges: ${matchCount}`)
if (missingSongs.size) {
  console.log(`Songs listed in REFS but missing from corpus (${missingSongs.size}):`)
  for (const s of [...missingSongs].sort()) console.log('  - ' + s)
}
if (noMatch.length) {
  console.log(`First 20 groups without matches (term doesn't appear literally in lyrics):`)
  for (const t of noMatch.slice(0, 20)) console.log('  - ' + t)
}
console.log(`Written to ${outDir}:`)
for (const f of written) console.log('  ' + f)

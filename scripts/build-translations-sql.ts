// Convert each DictionaryEntry into an Annotation tagged 'translation' so the
// app has a single source of truth: annotations carry both lyric ranges and
// the editor UI. For every dict term we scan all parsed lyrics lines and
// emit one Annotation row with all matching ranges (lineId, charStart, end).
//
// Output: SQL chunks under OUT_DIR. First chunk wipes existing translation
// annotations for the target owner so re-runs are idempotent. Last chunk
// re-enables triggers (we disable them so explicit owner_id survives in
// SQL Editor, where auth.uid() is NULL).

import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { parseLyrics } from '../src/seed/parseLyrics'

const ownerId = required('IMPORT_OWNER_ID')
const sourceDir = required('SOURCE_DIR')
const fallbackDir = process.env.FALLBACK_DIR ?? './песни'
const outDir = process.env.OUT_DIR ?? '/tmp/lyriclens-translations'
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
const stripQuotes = (s: string) => s.replace(/^["“«„'`]+|["”»“'`]+$/g, '').trim()
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

interface DictEntry { term: string; definition: string }

function parseDict(raw: string): DictEntry[] {
  const out: DictEntry[] = []
  let cur: DictEntry | null = null
  const flush = () => {
    if (cur) {
      cur.definition = cur.definition.trim()
      if (cur.term && cur.definition) out.push(cur)
    }
    cur = null
  }
  for (const line of raw.split('\n')) {
    const t = line.trim()
    const inline = t.match(/^\*\*(.+?)\*\*\s*[—\-–:]\s*(.+)$/)
    if (inline) { flush(); out.push({ term: stripQuotes(inline[1].trim()), definition: inline[2].trim() }); continue }
    const bold = t.match(/^\*\*(.+?)\*\*(?:\s*\(.+?\))?\s*$/)
    if (bold) { flush(); cur = { term: stripQuotes(bold[1].trim()), definition: '' }; continue }
    const h3 = t.match(/^###\s+(.+?)\s*$/)
    if (h3) { flush(); cur = { term: stripQuotes(h3[1].trim()), definition: '' }; continue }
    if (!t || t.startsWith('---') || /^#{1,2}\s/.test(t)) { flush(); continue }
    if (cur) {
      const text = t.replace(/^[-*]\s+/, '')
      cur.definition += (cur.definition ? ' ' : '') + text
    }
  }
  flush()
  return out
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
  const dp = join(folder, 'DICT.md')
  const dict = existsSync(dp) ? parseDict(readFileSync(dp, 'utf8')) : []
  return { title, lyrics, dict }
}

interface AnnoRow {
  id: string
  track_id: string
  ranges: { lineId: string; charStart: number; charEnd: number }[]
  body: string
  tags: string[]
  created_at: string
}

const folders = readdirSync(sourceDir).filter((d) => statSync(join(sourceDir, d)).isDirectory()).sort()
const now = new Date().toISOString()
const annotations: AnnoRow[] = []

let trackCount = 0
let entryCount = 0
let matchCount = 0

for (const folderName of folders) {
  const song = readSong(join(sourceDir, folderName))
  if (!song) continue
  const trackId = `track-${slug(song.title)}`
  const sections = parseLyrics(trackId, song.lyrics)
  if (sections.length === 0) continue
  trackCount++

  song.dict.forEach((entry, idx) => {
    if (entry.term.length < 2) return
    entryCount++
    const rx = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(entry.term)}(?![\\p{L}\\p{N}])`, 'giu')
    const ranges: AnnoRow['ranges'] = []
    for (const s of sections) {
      for (const l of s.lines) {
        rx.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = rx.exec(l.text))) {
          ranges.push({ lineId: l.id, charStart: m.index, charEnd: m.index + m[0].length })
          if (m.index === rx.lastIndex) rx.lastIndex++
        }
      }
    }
    if (ranges.length === 0) return
    matchCount += ranges.length
    annotations.push({
      id: `ann-trans-${slug(song.title)}-${idx}`,
      track_id: trackId,
      ranges,
      body: `${entry.term} — ${entry.definition}`,
      tags: ['translation'],
      created_at: now,
    })
  })
}

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

// File 1: wipe existing translation annotations for this owner + disable trigger.
const setup = [
  `begin;`,
  `delete from public.annotations`,
  `  where owner_id = '${ownerId}'::uuid`,
  `    and 'translation' = any(tags);`,
  `alter table public.annotations disable trigger user;`,
  `commit;`,
].join('\n')
const setupName = fname('setup')
writeFileSync(join(outDir, setupName), setup)
written.push(`${setupName}   → wipe + disable trigger`)

// Annotation chunks.
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

// File N: re-enable trigger.
const finish = [
  `begin;`,
  `alter table public.annotations enable trigger user;`,
  `commit;`,
].join('\n')
const finishName = fname('finish')
writeFileSync(join(outDir, finishName), finish)
written.push(`${finishName}   → re-enable trigger`)

console.log(`Tracks scanned: ${trackCount}`)
console.log(`Dict entries with matches: ${annotations.length}/${entryCount}`)
console.log(`Total ranges: ${matchCount}`)
console.log(`Written to ${outDir}:`)
for (const f of written) console.log('  ' + f)

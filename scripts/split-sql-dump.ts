// Split the SQL import into chunks small enough for the Supabase SQL Editor.
// The first chunk does the setup (DELETE + DISABLE triggers + tracks insert).
// Subsequent chunks insert dictionary entries in batches. The final chunk
// re-enables triggers. Each chunk is its own transaction.
//
// Run AFTER scripts/build-sql-dump.ts has produced the source SQL — actually
// this script reads the same JSON inputs directly to make slicing reliable.

import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { parseLyrics } from '../src/seed/parseLyrics'

const ownerId = required('IMPORT_OWNER_ID')
const sourceDir = required('SOURCE_DIR')
const fallbackDir = process.env.FALLBACK_DIR ?? './песни'
const defaultArtist = process.env.IMPORT_ARTIST ?? 'Eminem'
const outDir = process.env.OUT_DIR ?? '/tmp/lyriclens-sql'
const dictBatch = Number(process.env.DICT_BATCH ?? 400)
const trackBatch = Number(process.env.TRACK_BATCH ?? 30)

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

const folders = readdirSync(sourceDir).filter((d) => statSync(join(sourceDir, d)).isDirectory()).sort()
const now = new Date().toISOString()

const tracks: any[] = []
const dictionary: any[] = []
for (const folderName of folders) {
  const song = readSong(join(sourceDir, folderName))
  if (!song) continue
  const trackId = `track-${slug(song.title)}`
  const sections = parseLyrics(trackId, song.lyrics)
  if (sections.length === 0) continue
  tracks.push({ id: trackId, title: song.title, artist: defaultArtist, sections, created_at: now, updated_at: now })
  song.dict.forEach((e, idx) => {
    dictionary.push({ id: `dict-${slug(song.title)}-${idx}`, track_id: trackId, term: e.term, definition: e.definition })
  })
}

// Each chunk is a full transaction. We re-disable triggers in every dict chunk
// because each connection is independent in SQL Editor. The first chunk wipes
// existing rows so the whole sequence is replay-safe.
function setupHeader(): string {
  return [
    `begin;`,
    `delete from public.tracks where owner_id = '${ownerId}'::uuid;`,
    `alter table public.tracks             disable trigger user;`,
    `alter table public.dictionary_entries disable trigger user;`,
  ].join('\n')
}
function disableHeader(): string {
  return [
    `begin;`,
    `alter table public.dictionary_entries disable trigger user;`,
  ].join('\n')
}
function enableFooter(): string {
  return [
    `alter table public.dictionary_entries enable trigger user;`,
    `commit;`,
  ].join('\n')
}
function fullEnableFooter(): string {
  return [
    `alter table public.tracks             enable trigger user;`,
    `alter table public.dictionary_entries enable trigger user;`,
    `commit;`,
  ].join('\n')
}

function pickTag(payload: string): string {
  for (const tag of ['LL', 'LL2', 'LL3', 'X_DUMP']) if (!payload.includes(`$${tag}$`)) return tag
  throw new Error('No safe dollar-quote tag')
}

function tracksInsertSQL(slice: any[]): string {
  const json = JSON.stringify(slice, null, 2)
  const tag = pickTag(json)
  const Q = `$${tag}$`
  return `insert into public.tracks
  (id, owner_id, title, artist, sections, created_at, updated_at)
select id, '${ownerId}'::uuid, title, artist, sections, created_at, updated_at
from jsonb_to_recordset(${Q}
${json}
${Q}::jsonb) as t(
  id text, title text, artist text, sections jsonb, created_at timestamptz, updated_at timestamptz
);`
}

function disableTracksHeader(): string {
  return [
    `begin;`,
    `alter table public.tracks disable trigger user;`,
  ].join('\n')
}
function commitFooter(): string {
  return `commit;`
}

function dictInsertSQL(slice: any[]): string {
  const json = JSON.stringify(slice, null, 2)
  const tag = pickTag(json)
  const Q = `$${tag}$`
  return `insert into public.dictionary_entries
  (id, track_id, owner_id, term, definition)
select id, track_id, '${ownerId}'::uuid, term, definition
from jsonb_to_recordset(${Q}
${json}
${Q}::jsonb) as d(
  id text, track_id text, term text, definition text
);`
}

mkdirSync(outDir, { recursive: true })

const written: { name: string; desc: string }[] = []
let fileIdx = 1
const fname = (suffix: string) => `${String(fileIdx++).padStart(2, '0')}-${suffix}.sql`

// Track files. First one wipes existing rows + disables triggers; subsequent
// just disable + insert + commit. Triggers stay disabled across files because
// each transaction is independent.
for (let i = 0; i < tracks.length; i += trackBatch) {
  const slice = tracks.slice(i, i + trackBatch)
  const isFirst = i === 0
  const sql = [
    isFirst ? setupHeader() : disableTracksHeader(),
    tracksInsertSQL(slice),
    commitFooter(),
  ].join('\n\n')
  const batchNum = i / trackBatch + 1
  const name = fname(`tracks-${batchNum}`)
  writeFileSync(join(outDir, name), sql)
  written.push({ name, desc: `tracks ${i + 1}-${Math.min(i + trackBatch, tracks.length)}` })
}

// Dict files. Last file re-enables ALL triggers.
for (let i = 0; i < dictionary.length; i += dictBatch) {
  const slice = dictionary.slice(i, i + dictBatch)
  const isLast = i + dictBatch >= dictionary.length
  const sql = [
    disableHeader(),
    dictInsertSQL(slice),
    isLast ? fullEnableFooter() : enableFooter(),
  ].join('\n\n')
  const batchNum = i / dictBatch + 1
  const name = fname(`dict-${batchNum}`)
  writeFileSync(join(outDir, name), sql)
  written.push({ name, desc: `dict ${i + 1}-${Math.min(i + dictBatch, dictionary.length)}` })
}

console.log(`Written to ${outDir}:`)
for (const f of written) console.log(`  ${f.name}   → ${f.desc}`)
console.log(`Total: ${tracks.length} tracks, ${dictionary.length} dict entries.`)

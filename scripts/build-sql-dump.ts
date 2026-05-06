// Emit a SQL file you can paste into Supabase SQL Editor. The dump:
//   1. wraps everything in a transaction,
//   2. wipes the target user's existing rows (idempotent re-import),
//   3. disables the BEFORE INSERT owner_id trigger so we can supply owner_id
//      explicitly (the editor runs as the postgres role; auth.uid() is NULL
//      there, so the default trigger would NULL the column),
//   4. bulk-inserts via jsonb_to_recordset to avoid SQL escaping headaches.
//
// Usage:
//   IMPORT_OWNER_ID=<auth.users.id> \
//   SOURCE_DIR='/Users/.../Песни' \
//   FALLBACK_DIR=./песни \
//   IMPORT_ARTIST=Eminem \
//   npx tsx scripts/build-sql-dump.ts > /tmp/lyriclens-import.sql

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { parseLyrics } from '../src/seed/parseLyrics'

const ownerId = required('IMPORT_OWNER_ID')
const sourceDir = required('SOURCE_DIR')
const fallbackDir = process.env.FALLBACK_DIR ?? './песни'
const defaultArtist = process.env.IMPORT_ARTIST ?? 'Eminem'

function required(key: string): string {
  const v = process.env[key]
  if (!v) {
    console.error(`Missing env: ${key}`)
    process.exit(1)
  }
  return v
}

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const stripQuotes = (s: string) =>
  s.replace(/^["“«„'`]+|["”»“'`]+$/g, '').trim()

interface DictEntry { term: string; definition: string }

function parseDict(raw: string): DictEntry[] {
  const out: DictEntry[] = []
  const lines = raw.split('\n')
  let cur: DictEntry | null = null
  const flush = () => {
    if (cur) {
      cur.definition = cur.definition.trim()
      if (cur.term && cur.definition) out.push(cur)
    }
    cur = null
  }
  for (const line of lines) {
    const t = line.trim()
    const inline = t.match(/^\*\*(.+?)\*\*\s*[—\-–:]\s*(.+)$/)
    if (inline) {
      flush()
      out.push({ term: stripQuotes(inline[1].trim()), definition: inline[2].trim() })
      continue
    }
    const bold = t.match(/^\*\*(.+?)\*\*(?:\s*\(.+?\))?\s*$/)
    if (bold) {
      flush()
      cur = { term: stripQuotes(bold[1].trim()), definition: '' }
      continue
    }
    const h3 = t.match(/^###\s+(.+?)\s*$/)
    if (h3) {
      flush()
      cur = { term: stripQuotes(h3[1].trim()), definition: '' }
      continue
    }
    if (!t || t.startsWith('---') || /^#{1,2}\s/.test(t)) {
      flush()
      continue
    }
    if (cur) {
      const text = t.replace(/^[-*]\s+/, '')
      cur.definition += (cur.definition ? ' ' : '') + text
    }
  }
  flush()
  return out
}

function readSong(folder: string): { title: string; lyrics: string; dict: DictEntry[] } | null {
  const title = titleCase(basename(folder))
  const lp = join(folder, 'LYRICS.md')
  let lyrics = ''
  if (existsSync(lp)) {
    lyrics = readFileSync(lp, 'utf8')
  } else {
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

const folders = readdirSync(sourceDir)
  .filter((d) => statSync(join(sourceDir, d)).isDirectory())
  .sort()

const now = new Date().toISOString()

const tracks: Array<{ id: string; title: string; artist: string; sections: any; created_at: string; updated_at: string }> = []
const dictionary: Array<{ id: string; track_id: string; term: string; definition: string }> = []

for (const folderName of folders) {
  const song = readSong(join(sourceDir, folderName))
  if (!song) continue
  const trackId = `track-${slug(song.title)}`
  const sections = parseLyrics(trackId, song.lyrics)
  if (sections.length === 0 || sections.every((s) => s.lines.length === 0)) continue
  tracks.push({
    id: trackId,
    title: song.title,
    artist: defaultArtist,
    sections,
    created_at: now,
    updated_at: now,
  })
  song.dict.forEach((entry, idx) => {
    dictionary.push({
      id: `dict-${slug(song.title)}-${idx}`,
      track_id: trackId,
      term: entry.term,
      definition: entry.definition,
    })
  })
}

// Pick a dollar-quote tag that does NOT appear in any payload.
function safeTag(payload: string): string {
  for (const tag of ['LL', 'LL2', 'LYRIC_DUMP', 'X_LYRIC', 'X_X_X']) {
    if (!payload.includes(`$${tag}$`)) return tag
  }
  throw new Error('Could not find a safe dollar-quote tag')
}

const tracksJson = JSON.stringify(tracks, null, 2)
const dictJson = JSON.stringify(dictionary, null, 2)
const tag = safeTag(tracksJson + dictJson)
const Q = `$${tag}$`

const sql = `-- LyricLens import. Run inside Supabase SQL Editor.
-- Owner: ${ownerId}
-- Tracks: ${tracks.length}, Dictionary entries: ${dictionary.length}

begin;

-- Idempotent: wipe this owner's existing rows so re-running this script is safe.
-- ON DELETE CASCADE on tracks removes children automatically.
delete from public.tracks where owner_id = '${ownerId}'::uuid;

-- The BEFORE INSERT trigger calls auth.uid(), which is NULL when running in
-- the SQL Editor (postgres role, not anon/auth). Disable user triggers on the
-- target tables for this transaction so our explicit owner_id survives.
alter table public.tracks             disable trigger user;
alter table public.dictionary_entries disable trigger user;

insert into public.tracks
  (id, owner_id, title, artist, sections, created_at, updated_at)
select
  id,
  '${ownerId}'::uuid,
  title,
  artist,
  sections,
  created_at,
  updated_at
from jsonb_to_recordset(${Q}
${tracksJson}
${Q}::jsonb) as t(
  id text,
  title text,
  artist text,
  sections jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

insert into public.dictionary_entries
  (id, track_id, owner_id, term, definition)
select
  id,
  track_id,
  '${ownerId}'::uuid,
  term,
  definition
from jsonb_to_recordset(${Q}
${dictJson}
${Q}::jsonb) as d(
  id text,
  track_id text,
  term text,
  definition text
);

alter table public.tracks             enable trigger user;
alter table public.dictionary_entries enable trigger user;

commit;
`

process.stdout.write(sql)
console.error(`Built SQL with ${tracks.length} tracks, ${dictionary.length} dict entries.`)

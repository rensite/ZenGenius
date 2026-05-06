// Build a DataDump JSON from the rich Renat/ song folders. Each folder is one
// song with LYRICS.md (lyrics) and DICT.md (term → definition). Falls back to
// ./песни/<TITLE>.md when LYRICS.md is missing so we don't lose tracks.
//
// Usage:
//   SOURCE_DIR='/Users/renattogalini/Documents/Renat/ВЗЛОМА'\''ЕМ ВСЁ/Песни' \
//   FALLBACK_DIR=./песни \
//   IMPORT_ARTIST=Eminem \
//   npx tsx scripts/build-dump-v2.ts > /tmp/lyriclens-import-v2.json
//
// IDs are deterministic (`track-${slug}` / `dict-${slug}-${idx}`) so re-running
// the script and re-importing produces the same rows.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { parseLyrics } from '../src/seed/parseLyrics'

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

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// Strip a single layer of surrounding quotes / guillemets / Russian quotes.
function stripQuotes(s: string): string {
  return s.replace(/^["“«„'`]+|["”»“'`]+$/g, '').trim()
}

interface DictEntry {
  term: string
  definition: string
}

// DICT.md mixes two formats. We accept both:
//   1.  `## Section heading` (ignored as a divider)
//       `**term** — definition`
//       `**"quoted term"** — definition`
//
//   2.  `### term`
//       `Paragraph that defines the term, possibly across multiple lines
//       until the next heading or '---'.`
//
// Definitions are joined into a single line because DictionaryEntry has no rich
// text. Inline `**term** — def` always wins over an open H3 entry — `flush`
// closes any in-progress entry first.
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
    const trimmed = line.trim()

    const inline = trimmed.match(/^\*\*(.+?)\*\*\s*[—\-–:]\s*(.+)$/)
    if (inline) {
      flush()
      out.push({ term: stripQuotes(inline[1].trim()), definition: inline[2].trim() })
      continue
    }

    // `**term**` or `**term** (transliteration)` on its own line: treat like
    // an H3 heading — definition accumulates from following bullet/paragraph
    // lines until the next heading or blank line.
    const boldHeading = trimmed.match(/^\*\*(.+?)\*\*(?:\s*\(.+?\))?\s*$/)
    if (boldHeading) {
      flush()
      cur = { term: stripQuotes(boldHeading[1].trim()), definition: '' }
      continue
    }

    const h3 = trimmed.match(/^###\s+(.+?)\s*$/)
    if (h3) {
      flush()
      cur = { term: stripQuotes(h3[1].trim()), definition: '' }
      continue
    }

    if (!trimmed || trimmed.startsWith('---') || /^#{1,2}\s/.test(trimmed)) {
      flush()
      continue
    }

    if (cur) {
      // Strip leading bullet marker so the joined definition reads cleanly.
      const text = trimmed.replace(/^[-*]\s+/, '')
      cur.definition += (cur.definition ? ' ' : '') + text
    }
  }
  flush()
  return out
}

interface SongInput {
  title: string
  lyrics: string
  dict: DictEntry[]
}

function readSong(folder: string): SongInput | null {
  const title = titleCase(basename(folder))
  const lyricsPath = join(folder, 'LYRICS.md')
  const dictPath = join(folder, 'DICT.md')

  let lyrics = ''
  if (existsSync(lyricsPath)) {
    lyrics = readFileSync(lyricsPath, 'utf8')
  } else {
    // Fall back to flat ./песни/<TITLE>.md (case-insensitive match).
    const fallbackName = readdirSync(fallbackDir).find(
      (f) => extname(f) === '.md' && basename(f, '.md').toUpperCase() === basename(folder).toUpperCase(),
    )
    if (fallbackName) lyrics = readFileSync(join(fallbackDir, fallbackName), 'utf8')
  }
  if (!lyrics.trim()) return null

  const dict = existsSync(dictPath) ? parseDict(readFileSync(dictPath, 'utf8')) : []
  return { title, lyrics, dict }
}

const folders = readdirSync(sourceDir)
  .filter((d) => statSync(join(sourceDir, d)).isDirectory())
  .sort()

const now = new Date().toISOString()
const tracks: any[] = []
const dictionary: any[] = []

for (const folderName of folders) {
  const song = readSong(join(sourceDir, folderName))
  if (!song) {
    console.error(`  skip: ${folderName} (no lyrics anywhere)`)
    continue
  }

  const trackId = `track-${slug(song.title)}`
  const sections = parseLyrics(trackId, song.lyrics)

  if (sections.length === 0 || sections.every((s) => s.lines.length === 0)) {
    console.error(`  skip: ${folderName} (parsed 0 sections)`)
    continue
  }

  tracks.push({
    id: trackId,
    title: song.title,
    artist: defaultArtist,
    sections,
    createdAt: now,
    updatedAt: now,
  })

  song.dict.forEach((entry, idx) => {
    dictionary.push({
      id: `dict-${slug(song.title)}-${idx}`,
      trackId,
      term: entry.term,
      definition: entry.definition,
    })
  })

  console.error(`  ok:   ${folderName} → "${song.title}" (${sections.length} sections, ${song.dict.length} dict)`)
}

const dump = {
  version: 1 as const,
  exportedAt: now,
  tracks,
  annotations: [],
  rhymes: [],
  dictionary,
}

process.stdout.write(JSON.stringify(dump, null, 2))
console.error(`\nBuilt: ${tracks.length} tracks, ${dictionary.length} dictionary entries.`)

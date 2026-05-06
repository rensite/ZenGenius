// Build a DataDump JSON file from a directory of .md lyric files. Drop the
// resulting file into the app's "Import data" menu — the import will replace
// the existing library and run inserts under the user's JWT (so RLS and the
// owner_id trigger work as designed, no service-role key needed).
//
// Usage:
//   IMPORT_DIR=./песни IMPORT_ARTIST=Eminem npx tsx scripts/build-songs-dump.ts \
//     > lyriclens-import.json

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { parseLyrics } from '../src/seed/parseLyrics'

const dir = process.env.IMPORT_DIR ?? './песни'
const defaultArtist = process.env.IMPORT_ARTIST ?? 'Eminem'

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

const files = readdirSync(dir)
  .filter((f) => extname(f).toLowerCase() === '.md')
  .filter((f) => statSync(join(dir, f)).isFile())
  .sort()

const now = new Date().toISOString()

const tracks = files
  .map((file, idx) => {
    const raw = readFileSync(join(dir, file), 'utf8')
    const title = titleCase(basename(file, extname(file)))
    const id = `import-${idx}-${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
    const sections = parseLyrics(id, raw)
    return { id, title, sections, file }
  })
  .filter((t) => t.sections.length > 0 && t.sections.some((s) => s.lines.length > 0))
  .map(({ id, title, sections }) => ({
    id,
    title,
    artist: defaultArtist,
    sections,
    createdAt: now,
    updatedAt: now,
  }))

const dump = {
  version: 1 as const,
  exportedAt: now,
  tracks,
  annotations: [],
  rhymes: [],
  dictionary: [],
}

process.stdout.write(JSON.stringify(dump, null, 2))
console.error(`Built dump with ${tracks.length} tracks (skipped ${files.length - tracks.length}).`)

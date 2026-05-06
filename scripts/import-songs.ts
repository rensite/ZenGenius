// One-off importer: reads .md files from ./песни/ (or any directory) and
// inserts them as Tracks for a single Supabase user.
//
// Run:
//   SUPABASE_URL=...                     \
//   SUPABASE_SERVICE_ROLE_KEY=...        \
//   IMPORT_OWNER_ID=<auth.users.id>      \
//   IMPORT_DIR=./песни                   \
//   IMPORT_ARTIST=Eminem                 \
//   npx tsx scripts/import-songs.ts
//
// The service-role key bypasses RLS, which is what we want for a backfill.
// Never commit it; never expose it to the browser bundle.

import { createClient } from '@supabase/supabase-js'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { parseLyrics } from '../src/seed/parseLyrics'

const url = required('SUPABASE_URL')
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY')
const ownerId = required('IMPORT_OWNER_ID')
const dir = process.env.IMPORT_DIR ?? './песни'
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

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

const files = readdirSync(dir)
  .filter((f) => extname(f).toLowerCase() === '.md')
  .filter((f) => statSync(join(dir, f)).isFile())
  .sort()

console.log(`Importing ${files.length} files from ${dir} for owner ${ownerId}`)

let imported = 0
let skipped = 0
const now = new Date().toISOString()

for (const file of files) {
  const raw = readFileSync(join(dir, file), 'utf8')
  const title = titleCase(basename(file, extname(file)))
  const id = `import-${Date.now()}-${imported}`
  const sections = parseLyrics(id, raw)

  if (sections.length === 0 || sections.every((s) => s.lines.length === 0)) {
    console.warn(`  skip: ${file} (no parseable sections)`)
    skipped++
    continue
  }

  const { error } = await supabase.from('tracks').upsert(
    {
      id,
      owner_id: ownerId,
      title,
      artist: defaultArtist,
      sections,
      created_at: now,
      updated_at: now,
    },
    { onConflict: 'id' },
  )

  if (error) {
    console.error(`  fail: ${file} → ${error.message}`)
    skipped++
    continue
  }

  imported++
  console.log(`  ok:   ${file} → "${title}" (${sections.length} sections)`)
}

console.log(`\nDone. ${imported} imported, ${skipped} skipped.`)

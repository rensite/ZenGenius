import type { Section, SectionKind, Line } from '@/types/domain'

const KIND_RX: Record<SectionKind, RegExp> = {
  intro: /intro/i,
  outro: /outro/i,
  'pre-chorus': /pre[-\s]?chorus/i,
  chorus: /chorus|hook/i,
  bridge: /bridge|interlude/i,
  verse: /verse/i,
  hook: /hook/i,
  interlude: /interlude/i,
  other: /.^/,
}

function classify(label: string): SectionKind {
  const order: SectionKind[] = [
    'pre-chorus',
    'intro',
    'outro',
    'chorus',
    'bridge',
    'verse',
    'hook',
    'interlude',
  ]
  for (const k of order) if (KIND_RX[k].test(label)) return k
  return 'other'
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function parseLyrics(trackId: string, raw: string): Section[] {
  const sections: Section[] = []
  let cur: Section | null = null
  let secCount = 0
  let lineCount = 0
  let skipUntilNextHeader = false

  for (const original of raw.split('\n')) {
    const trimmed = original.trim()
    const header = trimmed.match(/^\[(.+?)\]$/)
    if (header) {
      skipUntilNextHeader = false
      if (cur && cur.lines.length > 0) sections.push(cur)
      const inner = header[1]
      const [labelPart, performerPart] = inner.split(':').map((s) => s.trim())
      cur = {
        id: `${trackId}-s${++secCount}`,
        kind: classify(labelPart),
        label: labelPart,
        performer: performerPart || undefined,
        lines: [],
      }
      continue
    }
    if (skipUntilNextHeader) continue
    if (/^you might also like/i.test(trimmed)) {
      skipUntilNextHeader = true
      continue
    }
    if (!trimmed) continue
    if (!cur) {
      cur = {
        id: `${trackId}-s${++secCount}`,
        kind: 'other',
        label: 'Lyrics',
        lines: [],
      }
    }
    const line: Line = {
      id: `${trackId}-l${++lineCount}`,
      text: trimmed,
    }
    cur.lines.push(line)
  }
  if (cur && cur.lines.length > 0) sections.push(cur)
  return sections.map((s) => ({ ...s, id: `${trackId}-${slug(s.label)}-${s.id.split('-s')[1]}` }))
}

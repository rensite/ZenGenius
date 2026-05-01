import type { Section } from '@/types/domain'

export function serializeLyrics(sections: Section[]): string {
  return sections
    .map((s) => {
      const header = s.performer ? `[${s.label}: ${s.performer}]` : `[${s.label}]`
      return `${header}\n${s.lines.map((l) => l.text).join('\n')}`
    })
    .join('\n\n')
}

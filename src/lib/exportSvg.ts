// Save an HTML element as a lightweight, native SVG.
//
// Instead of stuffing serialized HTML into a <foreignObject> with every
// computed CSS property inlined (which produces huge files), we walk the
// live DOM and re-emit it as primitive SVG: <rect> for backgrounds and
// bottom borders (rhyme underlines), <text> per visual run obtained from
// Range.getBoundingClientRect(). Justified layout is preserved because
// we read each character's actual painted position.

interface Ctx {
  ox: number
  oy: number
  bgs: string[]
  borders: string[]
  texts: string[]
}

function isVisible(el: Element): boolean {
  const cs = window.getComputedStyle(el as HTMLElement)
  if (cs.visibility === 'hidden' || cs.display === 'none') return false
  if (parseFloat(cs.opacity) === 0) return false
  return true
}

function isTransparent(c: string): boolean {
  if (!c) return true
  if (c === 'transparent') return true
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (!m) return false
  const parts = m[1].split(',').map((s) => s.trim())
  if (parts.length === 4 && parseFloat(parts[3]) === 0) return true
  return false
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function transformText(s: string, transform: string): string {
  if (transform === 'uppercase') return s.toUpperCase()
  if (transform === 'lowercase') return s.toLowerCase()
  if (transform === 'capitalize')
    return s.replace(/\b\w/g, (c) => c.toUpperCase())
  return s
}

function emitBoxes(el: HTMLElement, ctx: Ctx) {
  const cs = window.getComputedStyle(el)
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return

  const bg = cs.backgroundColor
  if (!isTransparent(bg)) {
    const radius = parseFloat(cs.borderRadius) || 0
    ctx.bgs.push(
      `<rect x="${(rect.left - ctx.ox).toFixed(2)}" y="${(rect.top - ctx.oy).toFixed(2)}" width="${rect.width.toFixed(2)}" height="${rect.height.toFixed(2)}"${
        radius ? ` rx="${radius}" ry="${radius}"` : ''
      } fill="${bg}"/>`,
    )
  }

  const bbw = parseFloat(cs.borderBottomWidth)
  const bbc = cs.borderBottomColor
  if (bbw > 0 && !isTransparent(bbc)) {
    const y = (rect.bottom - ctx.oy - bbw / 2).toFixed(2)
    ctx.borders.push(
      `<line x1="${(rect.left - ctx.ox).toFixed(2)}" y1="${y}" x2="${(rect.right - ctx.ox).toFixed(2)}" y2="${y}" stroke="${bbc}" stroke-width="${bbw}"/>`,
    )
  }
}

function emitText(node: Text, ctx: Ctx) {
  const parent = node.parentElement
  if (!parent) return
  const cs = window.getComputedStyle(parent)
  const raw = node.nodeValue ?? ''
  if (!raw.trim()) return

  const text = transformText(raw, cs.textTransform)
  const fontSize = parseFloat(cs.fontSize)
  const fill = cs.color
  const family = cs.fontFamily
  const weight = cs.fontWeight
  const style = cs.fontStyle
  const letterSp = cs.letterSpacing
  const opacity = parseFloat(cs.opacity)

  // Group characters into runs sharing the same baseline (y).
  const len = text.length
  const range = document.createRange()
  type Run = { text: string; x: number; bottom: number; right: number }
  const runs: Run[] = []
  let cur: Run | null = null
  for (let i = 0; i < len; i++) {
    range.setStart(node, i)
    range.setEnd(node, i + 1)
    const r = range.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) {
      // whitespace at line wrap — extend current run with the char so spaces
      // inside a run are preserved.
      if (cur) cur.text += text[i]
      continue
    }
    if (!cur || Math.abs(r.bottom - cur.bottom) > 1) {
      if (cur) runs.push(cur)
      cur = { text: text[i], x: r.left, bottom: r.bottom, right: r.right }
    } else {
      cur.text += text[i]
      cur.right = r.right
    }
  }
  if (cur) runs.push(cur)

  const attrs: string[] = []
  attrs.push(`font-size="${fontSize}"`)
  if (family) attrs.push(`font-family="${escapeXml(family)}"`)
  if (weight && weight !== '400') attrs.push(`font-weight="${weight}"`)
  if (style && style !== 'normal') attrs.push(`font-style="${style}"`)
  if (letterSp && letterSp !== 'normal' && letterSp !== '0px')
    attrs.push(`letter-spacing="${letterSp}"`)
  attrs.push(`fill="${fill}"`)
  if (opacity < 1) attrs.push(`opacity="${opacity}"`)

  // Use baseline placement: bottom of glyph rect ≈ baseline + descent. A
  // descent of ~0.2em is a decent visual fit across UI fonts.
  const descent = fontSize * 0.2
  for (const run of runs) {
    if (!run.text) continue
    const x = (run.x - ctx.ox).toFixed(2)
    const y = (run.bottom - ctx.oy - descent).toFixed(2)
    ctx.texts.push(
      `<text x="${x}" y="${y}" ${attrs.join(' ')}>${escapeXml(run.text)}</text>`,
    )
  }
}

function walk(el: Element, ctx: Ctx) {
  if (el instanceof HTMLElement) {
    if (el.hasAttribute('data-no-export')) return
    if (!isVisible(el)) return
    emitBoxes(el, ctx)
  }
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) emitText(child as Text, ctx)
    else if (child.nodeType === Node.ELEMENT_NODE) walk(child as Element, ctx)
  }
}

export function exportElementAsSvg(el: HTMLElement, filename: string) {
  const rect = el.getBoundingClientRect()
  const width = Math.ceil(rect.width)
  const height = Math.ceil(rect.height)
  if (width === 0 || height === 0) return

  const ctx: Ctx = {
    ox: rect.left,
    oy: rect.top,
    bgs: [],
    borders: [],
    texts: [],
  }

  const pageBg = window.getComputedStyle(document.body).backgroundColor
  if (!isTransparent(pageBg)) {
    ctx.bgs.unshift(
      `<rect x="0" y="0" width="${width}" height="${height}" fill="${pageBg}"/>`,
    )
  }

  walk(el, ctx)

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    ctx.bgs.join('') +
    ctx.borders.join('') +
    ctx.texts.join('') +
    `</svg>`

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'block'
  )
}

// Save an arbitrary HTML element as a self-contained .svg file.
// Strategy: clone the subtree, inline every computed style, then wrap the
// serialized HTML in an <svg><foreignObject> so the result renders identically
// in browsers / Inkscape / Figma without needing the original stylesheet.

export function exportElementAsSvg(el: HTMLElement, filename: string) {
  const rect = el.getBoundingClientRect()
  const width = Math.ceil(rect.width)
  const height = Math.ceil(rect.height)
  if (width === 0 || height === 0) return

  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-no-export]').forEach((n) => n.remove())
  clone.querySelectorAll('script').forEach((n) => n.remove())

  // Walk the live source tree in parallel with the clone so getComputedStyle
  // sees real layout. Skip the same nodes we removed from the clone so the
  // index walk stays in sync.
  inlineWithSkip(el, clone)

  const bg =
    window.getComputedStyle(document.body).backgroundColor || '#ffffff'
  const xhtml = new XMLSerializer().serializeToString(clone)

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;background:${bg};box-sizing:border-box;">` +
    xhtml +
    `</div>` +
    `</foreignObject>` +
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

function inlineWithSkip(src: Element, dst: Element) {
  if (src instanceof HTMLElement && dst instanceof HTMLElement) {
    const cs = window.getComputedStyle(src)
    let style = ''
    for (let i = 0; i < cs.length; i++) {
      const prop = cs.item(i)
      style += `${prop}:${cs.getPropertyValue(prop)};`
    }
    dst.setAttribute('style', style)
    dst.removeAttribute('class')
  }
  // Build a list of source children that survived in the clone (skip
  // data-no-export and <script>).
  const srcChildren: Element[] = []
  for (const c of Array.from(src.children)) {
    if (c instanceof HTMLElement && c.hasAttribute('data-no-export')) continue
    if (c.tagName.toLowerCase() === 'script') continue
    srcChildren.push(c)
  }
  const dstChildren = Array.from(dst.children)
  for (let i = 0; i < srcChildren.length && i < dstChildren.length; i++) {
    inlineWithSkip(srcChildren[i], dstChildren[i])
  }
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'block'
}

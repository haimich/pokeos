// Mini markup for terminal lines: "{cls|text}" -> styled span, "{$|cmd}" -> clickable command.
const RE = /\{([\w$-]+)\|([^{}]*)\}/g

export function parse(str) {
  const parts = []
  let last = 0
  let m
  RE.lastIndex = 0
  while ((m = RE.exec(str))) {
    if (m.index > last) parts.push({ t: str.slice(last, m.index) })
    const [, cls, text] = m
    if (cls === '$') parts.push({ t: text, c: 'cmd', run: text })
    else parts.push({ t: text, c: cls })
    last = RE.lastIndex
  }
  if (last < str.length) parts.push({ t: str.slice(last) })
  return parts
}

export const vlen = (s) => parse(String(s)).reduce((n, p) => n + [...p.t].length, 0)
export const vpad = (s, w) => s + ' '.repeat(Math.max(0, w - vlen(s)))
export const esc = (s) => String(s ?? '').replace(/[{}]/g, '')

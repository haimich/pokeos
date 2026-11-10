import { reactive, watch } from 'vue'
import { parse } from './markup'
import { GEN_CAPS, GEN_INFO } from './poke'

const SAVE_KEY = 'pokeos:save:v1'
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}
  } catch {
    return {}
  }
})()

// Each rank unlocks one more generation (rank index i -> gens I..i+1).
export const RANKS = [
  { xp: 0, title: 'guest' },
  { xp: 50, title: 'user' },
  { xp: 130, title: 'trainer' },
  { xp: 250, title: 'wheel' },
  { xp: 400, title: 'gym-leader' },
  { xp: 600, title: 'elite-four' },
  { xp: 850, title: 'champion' },
  { xp: 1150, title: 'professor' },
  { xp: 1500, title: 'root' },
]

export const state = reactive({
  booted: false,
  lines: [],
  cards: [],
  quiz: null,
  ask: null, // pending interactive prompt (e.g. sudo password)
  busy: false,
  streak: 0,
  flash: 0,
  xp: saved.xp || 0,
  best: saved.best || 0,
  caught: saved.caught || [],
  modeStats: saved.modeStats || {},
  history: saved.history || [],
  sudo: !!saved.sudo,
  verbose: !!saved.verbose,
  crt: saved.crt ?? true,
  genLimit: saved.genLimit ?? null,
  speciesTotal: 1025,
})

watch(
  () => ({
    xp: state.xp, best: state.best, caught: state.caught, modeStats: state.modeStats, history: state.history.slice(-200),
    sudo: state.sudo, verbose: state.verbose, crt: state.crt, genLimit: state.genLimit,
  }),
  (v) => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(v))
    } catch {}
  },
  { deep: true },
)

export const rankOf = (xp) => RANKS.reduce((i, r, j) => (xp >= r.xp ? j : i), 0)
export const level = () => (state.sudo ? RANKS.length - 1 : rankOf(state.xp))
export const rankTitle = () => RANKS[level()].title
export const maxGen = () => Math.min(level() + 1, state.genLimit || 99)
export const genCap = () => GEN_CAPS[maxGen() - 1]
export const genRoman = () => GEN_INFO[maxGen() - 1].roman

export const hooks = { onRankUp: null }

export function addXp(n) {
  const before = level()
  state.xp += n
  const after = level()
  if (after > before) hooks.onRankUp?.(before, after)
}

let lineId = 0
export function pushParts(parts) {
  state.lines.push({ id: ++lineId, parts })
  if (state.lines.length > 1500) state.lines.splice(0, state.lines.length - 1500)
}
export function print(...items) {
  for (const s of items) {
    if (Array.isArray(s)) {
      if (typeof s[0] === 'string') print(...s)
      else pushParts(s)
    } else pushParts(parse(String(s ?? '')))
  }
}

import { get } from './api'
import { esc } from './markup'

export { get }

export const TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy']

export const TYPE_COLORS = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C', grass: '#7AC74C', ice: '#96D9D6',
  fighting: '#C22E28', poison: '#A33EA1', ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746', steel: '#B7B7CE', fairy: '#D685AD',
}

export const STAT_SHORT = { hp: 'HP', attack: 'Atk', defense: 'Def', 'special-attack': 'SpA', 'special-defense': 'SpD', speed: 'Spe', bst: 'BST' }
export const STAT_LONG = { hp: 'HP', attack: 'Attack', defense: 'Defense', 'special-attack': 'Sp. Atk', 'special-defense': 'Sp. Def', speed: 'Speed', bst: 'Base Stat Total' }

export const GEN_INFO = [
  { n: 1, roman: 'I', region: 'Kanto', games: 'Red / Green / Blue / Yellow', year: 1996 },
  { n: 2, roman: 'II', region: 'Johto', games: 'Gold / Silver / Crystal', year: 1999 },
  { n: 3, roman: 'III', region: 'Hoenn', games: 'Ruby / Sapphire / Emerald, FR/LG', year: 2002 },
  { n: 4, roman: 'IV', region: 'Sinnoh', games: 'Diamond / Pearl / Platinum, HG/SS', year: 2006 },
  { n: 5, roman: 'V', region: 'Unova', games: 'Black / White, B2/W2', year: 2010 },
  { n: 6, roman: 'VI', region: 'Kalos', games: 'X / Y, OR/AS', year: 2013 },
  { n: 7, roman: 'VII', region: 'Alola', games: "Sun / Moon, US/UM, Let's Go", year: 2016 },
  { n: 8, roman: 'VIII', region: 'Galar', games: 'Sword / Shield, BD/SP, Legends: Arceus', year: 2019 },
  { n: 9, roman: 'IX', region: 'Paldea', games: 'Scarlet / Violet, Legends: Z-A', year: 2022 },
]
export const GEN_CAPS = [151, 251, 386, 493, 649, 721, 809, 905, 1025]

// ---------- small utils ----------
export const rand = (n) => Math.floor(Math.random() * n)
export const pick = (a) => a[rand(a.length)]
export const shuffle = (a) => {
  a = [...a]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
export const sample = (a, n) => shuffle(a).slice(0, n)
export const title = (slug) => String(slug).split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
export const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '')
export const en = (arr, key = 'name') => arr?.find((e) => e.language?.name === 'en')?.[key]
export const idFromUrl = (url) => +String(url).split('/').filter(Boolean).pop()
export const pad = (n, w = 4) => String(n).padStart(w, '0')
export const genLabel = (slug) => (slug ? 'Gen ' + slug.replace('generation-', '').toUpperCase() : '?')
export const genNum = (slug) => GEN_INFO.findIndex((g) => g.roman === slug?.replace('generation-', '').toUpperCase()) + 1
export const fmtType = (t) => `{t-${t}|${t}}`
export const fmtTypes = (ts) => ts.map(fmtType).join('{d| / }')
export const fmtMult = (m) => ({ 0: '0×', 0.25: '¼×', 0.5: '½×', 1: '1×', 2: '2×', 4: '4×' })[m] ?? `${m}×`
export const multCls = (m) => (m === 0 ? 'v' : m < 1 ? 'g' : m > 1 ? 'r' : 'd')

export function levenshtein(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}
export function suggest(q, names) {
  let best = null
  let bd = Infinity
  for (const n of names) {
    const d = levenshtein(q, n)
    if (d < bd) [best, bd] = [n, d]
  }
  return bd <= Math.max(2, q.length / 3) ? best : null
}

// ---------- resources ----------
let speciesP, abilityP, moveP
export const speciesList = () =>
  (speciesP ??= get('pokemon-species?limit=2000').then((d) => d.results.map((r) => ({ name: r.name, id: idFromUrl(r.url) })).sort((a, b) => a.id - b.id)))
export const abilityList = () =>
  (abilityP ??= get('ability?limit=1000').then((d) => d.results.map((r) => ({ name: r.name, id: idFromUrl(r.url) })).filter((a) => a.id < 10000)))
export const moveList = () =>
  (moveP ??= get('move?limit=2000').then((d) => d.results.map((r) => ({ name: r.name, id: idFromUrl(r.url) })).filter((a) => a.id < 10000)))

export const getPokemon = (q) => get(`pokemon/${String(q).toLowerCase()}`)
export const getSpecies = (q) => get(`pokemon-species/${String(q).toLowerCase()}`)
export const getType = (t) => get(`type/${t}`)

export const randId = (cap) => 1 + rand(cap)

export async function randomNames(n, excludeIds, cap) {
  const ex = new Set([].concat(excludeIds))
  const list = (await speciesList()).filter((s) => s.id <= cap && !ex.has(s.id))
  return sample(list, n).map((s) => title(s.name))
}

export async function resolvePokemon(q) {
  q = String(q ?? '').toLowerCase().trim()
  if (!q) throw new Error('which pokémon? e.g. {$|dex pikachu}')
  const list = await speciesList()
  const entry = /^\d+$/.test(q) ? list.find((s) => s.id === +q) : list.find((s) => s.name === q) || list.find((s) => norm(s.name) === norm(q))
  if (entry) {
    const [p, s] = await Promise.all([getPokemon(entry.id), getSpecies(entry.id)])
    return { p, s }
  }
  try {
    const p = await getPokemon(q) // forms like charizard-mega-x, raichu-alola
    const s = await get(p.species.url)
    return { p, s }
  } catch {
    const sug = suggest(q, list.map((x) => x.name))
    throw new Error(`no pokémon called '${esc(q)}'` + (sug ? ` — did you mean {$|dex ${sug}}?` : ''))
  }
}

export function flavorTexts(s) {
  const seen = new Set()
  for (const f of s.flavor_text_entries || []) {
    if (f.language.name !== 'en') continue
    seen.add(f.flavor_text.replace(/­\s*/g, '').replace(/[\f\n\r]+/g, ' ').replace(/\s+/g, ' ').trim())
  }
  return [...seen]
}

export function toCard(p, s, mask = {}) {
  const stats = p.stats.map((x) => ({ key: x.stat.name, label: STAT_SHORT[x.stat.name], value: x.base_stat }))
  const flavors = s ? flavorTexts(s) : []
  return {
    id: s?.id ?? p.id,
    slug: p.name,
    name: (s && p.is_default && en(s.names)) || title(p.name),
    genus: (s && en(s.genera, 'genus')) || '',
    types: [...p.types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
    sprite: p.sprites?.other?.['official-artwork']?.front_default || p.sprites?.front_default,
    stats,
    bst: stats.reduce((a, b) => a + b.value, 0),
    abilities: p.abilities.map((a) => ({ name: title(a.ability.name), hidden: a.is_hidden })),
    height: p.height / 10,
    weight: p.weight / 10,
    flavor: flavors[flavors.length - 1] || '',
    gen: s?.generation?.name,
    legendary: s?.is_legendary,
    mythical: s?.is_mythical,
    cry: p.cries?.latest || p.cries?.legacy,
    highlight: null,
    mask: { ...mask },
  }
}

// ---------- type math ----------
export async function attackMultiplier(atk, defTypes) {
  const r = (await getType(atk)).damage_relations
  let m = 1
  const parts = []
  for (const d of defTypes) {
    let f = 1
    if (r.no_damage_to.some((x) => x.name === d)) f = 0
    else if (r.double_damage_to.some((x) => x.name === d)) f = 2
    else if (r.half_damage_to.some((x) => x.name === d)) f = 0.5
    m *= f
    parts.push({ type: d, f })
  }
  return { m, parts }
}

export async function defenseTable(defTypes) {
  const datas = await Promise.all(defTypes.map(getType))
  const out = Object.fromEntries(TYPES.map((t) => [t, 1]))
  for (const d of datas) {
    const r = d.damage_relations
    r.double_damage_from.forEach((x) => x.name in out && (out[x.name] *= 2))
    r.half_damage_from.forEach((x) => x.name in out && (out[x.name] *= 0.5))
    r.no_damage_from.forEach((x) => x.name in out && (out[x.name] *= 0))
  }
  return out
}

export function defenseLines(tab) {
  const group = (f) => TYPES.filter((t) => f(tab[t]))
  const rows = [
    ['4× weak', group((m) => m === 4), 'r'],
    ['2× weak', group((m) => m === 2), 'o'],
    ['½× resist', group((m) => m === 0.5), 'g'],
    ['¼× resist', group((m) => m === 0.25), 'c'],
    ['0× immune', group((m) => m === 0), 'v'],
  ]
  return rows.filter(([, ts]) => ts.length).map(([l, ts, c]) => `  {${c}|${l.padEnd(10)}} ${ts.map(fmtType).join(' ')}`)
}

// Abilities that change type matchups in battle — the "well, actually" an expert will bring up.
export const MATCHUP_ABILITIES = {
  levitate: { ground: 'immune to Ground' },
  'flash-fire': { fire: 'absorbs Fire' },
  'well-baked-body': { fire: 'absorbs Fire' },
  'volt-absorb': { electric: 'absorbs Electric' },
  'lightning-rod': { electric: 'absorbs Electric' },
  'motor-drive': { electric: 'absorbs Electric' },
  'water-absorb': { water: 'absorbs Water' },
  'storm-drain': { water: 'absorbs Water' },
  'dry-skin': { water: 'absorbs Water', fire: 'takes 1.25× from Fire' },
  'sap-sipper': { grass: 'absorbs Grass' },
  'earth-eater': { ground: 'absorbs Ground' },
  'thick-fat': { fire: 'halves Fire', ice: 'halves Ice' },
  heatproof: { fire: 'halves Fire' },
  'purifying-salt': { ghost: 'halves Ghost' },
  'water-bubble': { fire: 'halves Fire' },
  fluffy: { fire: 'doubles Fire damage taken' },
}

// ---------- evolution ----------
export function chainEdges(chain) {
  const edges = []
  const walk = (node) => {
    for (const nx of node.evolves_to) {
      edges.push({
        from: node.species.name, fromId: idFromUrl(node.species.url),
        to: nx.species.name, toId: idFromUrl(nx.species.url),
        details: nx.evolution_details || [],
      })
      walk(nx)
    }
  }
  walk(chain)
  return edges
}
export function chainMembers(chain) {
  const out = []
  const walk = (n) => (out.push({ name: n.species.name, id: idFromUrl(n.species.url) }), n.evolves_to.forEach(walk))
  walk(chain)
  return out
}

export function describeEvo(d) {
  if (!d) return 'special'
  const t = (x) => title(x?.name ?? x)
  const trig = d.trigger?.name
  const parts = []
  if (trig === 'level-up') parts.push(d.min_level ? `Level ${d.min_level}` : 'Level up')
  else if (trig === 'use-item') parts.push(`Use ${t(d.item)}`)
  else if (trig === 'trade') parts.push('Trade')
  else if (trig) parts.push(t(trig))
  if (d.held_item) parts.push(`holding ${t(d.held_item)}`)
  if (d.item && trig !== 'use-item') parts.push(`with ${t(d.item)}`)
  if (d.min_happiness) parts.push('high friendship')
  if (d.min_affection) parts.push('high affection')
  if (d.min_beauty) parts.push('high beauty')
  if (d.known_move) parts.push(`knowing ${t(d.known_move)}`)
  if (d.known_move_type) parts.push(`knowing a ${t(d.known_move_type)}-type move`)
  if (d.location) parts.push(`at ${t(d.location)}`)
  if (d.party_species) parts.push(`with ${t(d.party_species)} in party`)
  if (d.party_type) parts.push(`with a ${t(d.party_type)}-type in party`)
  if (d.trade_species) parts.push(`for ${t(d.trade_species)}`)
  if (d.gender === 1) parts.push('(female)')
  if (d.gender === 2) parts.push('(male)')
  if (d.needs_overworld_rain) parts.push('while raining')
  if (d.turn_upside_down) parts.push('with the console upside down')
  if (d.relative_physical_stats === 1) parts.push('Atk > Def')
  if (d.relative_physical_stats === 0) parts.push('Atk = Def')
  if (d.relative_physical_stats === -1) parts.push('Atk < Def')
  if (d.time_of_day) parts.push(`(${d.time_of_day})`)
  return parts.join(', ') || 'special'
}

const METHOD_POOL = [
  'Level 16', 'Level 22', 'Level 30', 'Level 36', 'Use Fire Stone', 'Use Water Stone', 'Use Thunder Stone', 'Use Leaf Stone',
  'Use Moon Stone', 'Use Sun Stone', 'Use Shiny Stone', 'Use Dusk Stone', 'Use Ice Stone', 'Trade', 'Trade, holding Metal Coat',
  'Trade, holding Kings Rock', 'Level up, high friendship', 'Level up, high friendship, (day)', 'Level up, high friendship, (night)',
  'Level up, knowing Ancient Power', 'Level up, holding Razor Claw, (night)', 'Level up, at Mt Coronet', 'Level up, high affection, knowing a Fairy-type move',
]
export function methodDistractors(correct) {
  const pool = new Set(METHOD_POOL)
  const lv = /^Level (\d+)$/.exec(correct)
  if (lv) {
    const n = +lv[1]
    ;[-10, -6, -4, 4, 6, 12].forEach((d) => n + d > 1 && pool.add(`Level ${n + d}`))
  }
  pool.delete(correct)
  return sample([...pool], 3)
}

export function evoTree(node, highlight, prefix = '', root = true) {
  const nm = (n) => `{${n.species.name === highlight ? 'p' : 'y'}|${title(n.species.name)}}`
  const lines = root ? [nm(node)] : []
  node.evolves_to.forEach((nx, i) => {
    const last = i === node.evolves_to.length - 1
    const extra = nx.evolution_details.length > 1 ? ` {d|+${nx.evolution_details.length - 1} alt}` : ''
    lines.push(`${prefix}{d|${last ? '└──▶' : '├──▶'}} ${nm(nx)} {d|· ${esc(describeEvo(nx.evolution_details.at(-1)))}}${extra}`)
    lines.push(...evoTree(nx, highlight, prefix + (last ? '     ' : '{d|│}    '), false))
  })
  return lines
}

export function statBar(v, width = 18) {
  const n = Math.max(1, Math.round((Math.min(v, 255) / 255) * width))
  const c = v < 50 ? 'r' : v < 80 ? 'o' : v < 100 ? 'y' : v < 125 ? 'g' : 'c'
  return `{${c}|${'█'.repeat(n)}}{dd|${'░'.repeat(width - n)}}`
}

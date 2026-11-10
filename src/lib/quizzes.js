import { state, print, pushParts, addXp, level, genCap } from './store'
import { esc } from './markup'
import * as P from './poke'

export const MODES = {
  whos: { label: "Who's that Pokémon?", level: 0, xp: 10, desc: 'name the silhouette' },
  flavor: { label: 'Pokédex entry', level: 0, xp: 10, desc: 'guess the Pokémon from its dex text' },
  type: { label: 'Type check', level: 1, xp: 15, desc: "pick the Pokémon's typing" },
  stat: { label: 'Stat duel', level: 2, xp: 15, desc: 'which base stat is higher?' },
  evo: { label: 'Evolution', level: 3, xp: 20, desc: 'evolutions and how they happen' },
  matchup: { label: 'Type matchup', level: 4, xp: 25, desc: 'damage multipliers, dual types included' },
  ability: { label: 'Abilities', level: 5, xp: 30, desc: 'regular and hidden abilities' },
  move: { label: 'Move dex', level: 6, xp: 30, desc: 'move types and damage classes' },
}
export const BADGE_AT = 10
export const unlockedModes = () => Object.keys(MODES).filter((m) => MODES[m].level <= level())

const ctx = () => ({ cap: genCap(), level: level() })
const nameOf = (s) => en(s.names) || P.title(s.name)
const { en } = P

const STAT_FACTS = {
  hp: 'HP: how much damage it can take. Record holder: Blissey (255).',
  attack: 'Attack powers physical moves (contact moves are usually physical).',
  defense: 'Defense reduces damage from physical moves.',
  'special-attack': 'Sp. Atk powers special moves. Before Gen II, Atk/Def had a single "Special" stat.',
  'special-defense': 'Sp. Def reduces damage from special moves. It split from "Special" in Gen II.',
  speed: 'Speed decides turn order within a priority bracket. Trick Room flips it.',
  bst: 'BST = sum of all six base stats. Rough guide: ~500+ is fully evolved, 580–600 is pseudo-legendary or legendary.',
}

// ---------------------------------------------------------------- generators
const GEN = {
  async whos({ cap }) {
    const id = P.randId(cap)
    const [p, s] = await Promise.all([P.getPokemon(id), P.getSpecies(id)])
    const card = P.toCard(p, s, { silhouette: true, hideName: true, hideTypes: true, hideStats: true, hideFlavor: true, hideAbilities: true })
    if (!card.sprite) return null
    const answer = P.title(s.name)
    const choices = P.shuffle([answer, ...(await P.randomNames(3, id, cap))])
    return {
      prompt: [`{h|Who's that Pokémon?} {d|(silhouette → dex pane · typing the name instead of a number gives +5 xp)}`],
      choices,
      answer: choices.indexOf(answer),
      accept: [s.name, nameOf(s)],
      typedBonus: 5,
      cards: [card],
      caught: id,
      hint: () => {
        card.mask.hideTypes = false
        return [`types: ${P.fmtTypes(card.types)} · introduced in ${P.genLabel(card.gen)}`]
      },
      explain: () => [`It's {y|${esc(card.name)}} {d|#${P.pad(id)}} — the ${esc(card.genus)}.`, `{d|“${esc(card.flavor)}”}`],
    }
  },

  async flavor({ cap }) {
    const id = P.randId(cap)
    const [p, s] = await Promise.all([P.getPokemon(id), P.getSpecies(id)])
    const texts = P.flavorTexts(s)
    if (!texts.length) return null
    const names = [nameOf(s), s.name, P.title(s.name)].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const text = P.pick(texts).replace(new RegExp(names.join('|'), 'gi'), '█████')
    const card = P.toCard(p, s, { mystery: true })
    const answer = P.title(s.name)
    const choices = P.shuffle([answer, ...(await P.randomNames(3, id, cap))])
    return {
      prompt: ['{h|Whose Pokédex entry is this?}', `  {c|“${esc(text)}”}`],
      choices,
      answer: choices.indexOf(answer),
      accept: [s.name, nameOf(s)],
      cards: [card],
      caught: id,
      hint: () => [`it's a ${P.fmtTypes(card.types)} type, the ${esc(card.genus)}`],
      explain: () => [`That's {y|${esc(card.name)}}, the ${esc(card.genus)}. Its dex has ${texts.length} distinct English entries across games.`],
    }
  },

  async type({ cap }) {
    const id = P.randId(cap)
    const [p, s] = await Promise.all([P.getPokemon(id), P.getSpecies(id)])
    const card = P.toCard(p, s, { hideTypes: true })
    const correct = card.types
    const key = (ts) => [...ts].sort().join('/')
    const opts = new Map([[key(correct), correct]])
    const near = correct.length === 2 ? [[correct[0]], [correct[1]], [correct[1], P.pick(P.TYPES)]] : [[correct[0], P.pick(P.TYPES)], [P.pick(P.TYPES), correct[0]]]
    for (const c of P.shuffle(near)) if (opts.size < 3 && new Set(c).size === c.length) opts.set(key(c), c)
    while (opts.size < 4) {
      const c = Math.random() < 0.5 ? [P.pick(P.TYPES)] : P.sample(P.TYPES, 2)
      opts.set(key(c), c)
    }
    const label = (ts) => ts.map(P.title).join(' / ')
    const choices = P.shuffle([...opts.values()].map(label))
    return {
      prompt: [`{h|Type check:} what is {y|${esc(card.name)}}'s typing?`],
      choices,
      answer: choices.indexOf(label(correct)),
      cards: [card],
      caught: id,
      explain: async () => [`{y|${esc(card.name)}} is ${P.fmtTypes(correct)}. Defensively that means:`, ...P.defenseLines(await P.defenseTable(correct))],
    }
  },

  async stat({ cap }) {
    const [a, b] = P.sample(Array.from({ length: cap }, (_, i) => i + 1), 2)
    const [pa, sa, pb, sb] = await Promise.all([P.getPokemon(a), P.getSpecies(a), P.getPokemon(b), P.getSpecies(b)])
    const ca = P.toCard(pa, sa, { hideStats: true })
    const cb = P.toCard(pb, sb, { hideStats: true })
    const stat = P.pick(['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed', 'bst'])
    const val = (c) => (stat === 'bst' ? c.bst : c.stats.find((x) => x.key === stat).value)
    const [va, vb] = [val(ca), val(cb)]
    if (va === vb) return null
    ca.highlight = cb.highlight = stat
    return {
      prompt: [`{h|Stat duel:} which has the higher base {y|${P.STAT_LONG[stat]}}?`],
      choices: [ca.name, cb.name],
      answer: va > vb ? 0 : 1,
      cards: [ca, cb],
      explain: () => [`  ${esc(ca.name).padEnd(14)} ${P.statBar(Math.min(va, 255))} {y|${va}}`, `  ${esc(cb.name).padEnd(14)} ${P.statBar(Math.min(vb, 255))} {y|${vb}}`, `{d|${STAT_FACTS[stat]}}`],
    }
  },

  async evo({ cap, level }) {
    const s0 = await P.getSpecies(P.randId(cap))
    if (!s0.evolution_chain) return null
    const ch = await P.get(s0.evolution_chain.url)
    const edges = P.chainEdges(ch.chain).filter((e) => e.toId <= cap && e.fromId <= cap)
    if (!edges.length) return null
    const e = P.pick(edges)
    const [pf, sf, pt, st] = await Promise.all([P.getPokemon(e.fromId), P.getSpecies(e.fromId), P.getPokemon(e.toId), P.getSpecies(e.toId)])
    const from = P.toCard(pf, sf)
    const method = P.describeEvo(e.details.at(-1))
    const askMethod = level >= 4 && method !== 'special' && Math.random() < 0.6
    const to = P.toCard(pt, st, askMethod ? {} : { silhouette: true, hideName: true, hideTypes: true, hideStats: true, hideFlavor: true, hideAbilities: true })
    const explain = () => [
      `{d|full chain} {d|(evolution-chain/${P.idFromUrl(s0.evolution_chain.url)})}:`,
      ...P.evoTree(ch.chain, e.to).map((l) => '  ' + l),
      ...(P.chainEdges(ch.chain).some((x, _, arr) => arr.filter((y) => y.from === x.from).length > 1) ? ['{d|↳ branched evolution: one Pokémon, several possible outcomes.}'] : []),
    ]
    if (askMethod) {
      const choices = P.shuffle([method, ...P.methodDistractors(method)])
      return { prompt: [`{h|Evolution:} how does {y|${esc(from.name)}} evolve into {y|${esc(to.name)}}?`], choices, answer: choices.indexOf(method), cards: [from, to], explain }
    }
    const members = P.chainMembers(ch.chain).map((m) => m.id)
    const answer = P.title(e.to)
    const choices = P.shuffle([answer, ...(await P.randomNames(3, members, cap))])
    return {
      prompt: [`{h|Evolution:} what does {y|${esc(from.name)}} evolve into?`],
      choices,
      answer: choices.indexOf(answer),
      accept: [e.to, nameOf(st)],
      cards: [from, to],
      caught: e.toId,
      explain,
    }
  },

  async matchup({ cap }) {
    const id = P.randId(cap)
    const [p, s] = await Promise.all([P.getPokemon(id), P.getSpecies(id)])
    const card = P.toCard(p, s)
    // bias towards interesting results: ~70% non-neutral
    let atk, res
    for (let i = 0; i < 6; i++) {
      atk = P.pick(P.TYPES)
      res = await P.attackMultiplier(atk, card.types)
      if (res.m !== 1 || Math.random() < 0.3) break
    }
    const choices = ['0×', '¼×', '½×', '1×', '2×', '4×']
    const notes = p.abilities.map((a) => [a, P.MATCHUP_ABILITIES[a.ability.name]?.[atk]]).filter(([, n]) => n)
    return {
      prompt: [`{h|Matchup:} a ${P.fmtType(atk)} move hits {y|${esc(card.name)}} (${P.fmtTypes(card.types)}). Multiplier?`],
      choices,
      answer: choices.indexOf(P.fmtMult(res.m)),
      cards: [card],
      explain: () => [
        ...res.parts.map((x) => `  ${P.fmtType(atk)} → ${P.fmtType(x.type)}  {${P.multCls(x.f)}|${P.fmtMult(x.f)}}`),
        `  {d|total} {${P.multCls(res.m)}|${P.fmtMult(res.m)}} {d|(dual types multiply)}`,
        ...notes.map(([a, n]) => `  {o|⚠ well, actually:} with {y|${P.title(a.ability.name)}}${a.is_hidden ? ' (hidden)' : ''} it ${n}.`),
      ],
    }
  },

  async ability({ cap, level }) {
    const id = P.randId(cap)
    const [p, s] = await Promise.all([P.getPokemon(id), P.getSpecies(id)])
    const card = P.toCard(p, s, { hideAbilities: true })
    const all = await P.abilityList()
    const own = new Set(p.abilities.map((a) => a.ability.name))
    const hidden = p.abilities.find((a) => a.is_hidden)
    const askHidden = level >= 7 && hidden && own.size > 1 && Math.random() < 0.5
    let correct, pool
    if (askHidden) {
      correct = hidden.ability.name
      pool = p.abilities.filter((a) => !a.is_hidden).map((a) => a.ability.name)
    } else {
      correct = P.pick(p.abilities).ability.name
      pool = []
    }
    const fill = P.sample(all.filter((a) => !own.has(a.name)), 3).map((a) => a.name)
    const choices = P.shuffle([correct, ...[...pool, ...fill].slice(0, 3)]).map(P.title)
    return {
      prompt: [askHidden ? `{h|Abilities:} which is {y|${esc(card.name)}}'s {p|hidden} ability?` : `{h|Abilities:} which ability can {y|${esc(card.name)}} have?`],
      choices,
      answer: choices.indexOf(P.title(correct)),
      cards: [card],
      explain: async () => {
        const ab = await P.get(`ability/${correct}`)
        const eff = en(ab.effect_entries, 'short_effect') || en(ab.flavor_text_entries, 'flavor_text') || ''
        return [
          `{y|${P.title(correct)}}{d|: ${esc(eff).replace(/\s+/g, ' ')}}`,
          `{d|${esc(card.name)}'s abilities:} ${p.abilities.map((a) => P.title(a.ability.name) + (a.is_hidden ? ' {p|(hidden)}' : '')).join(', ')}`,
        ]
      },
    }
  },

  async move({ level }) {
    const m = P.pick(await P.moveList())
    const mv = await P.get(`move/${m.id}`)
    if (mv.pp === 1 || !mv.damage_class) return null // skip Z-Moves / Max Moves
    const name = en(mv.names) || P.title(mv.name)
    const askClass = level >= 7 && Math.random() < 0.4
    let choices, answer
    if (askClass) {
      choices = ['Physical', 'Special', 'Status']
      answer = choices.indexOf(P.title(mv.damage_class.name))
    } else {
      choices = P.shuffle([mv.type.name, ...P.sample(P.TYPES.filter((t) => t !== mv.type.name), 3)]).map(P.title)
      answer = choices.indexOf(P.title(mv.type.name))
    }
    return {
      prompt: [askClass ? `{h|Move dex:} is {y|${esc(name)}} physical, special or status?` : `{h|Move dex:} what type is {y|${esc(name)}}?`],
      choices,
      answer,
      cards: [],
      explain: () => {
        const eff = (en(mv.effect_entries, 'short_effect') || '').replace(/\$effect_chance/g, mv.effect_chance)
        return [
          `{y|${esc(name)}} · ${P.fmtType(mv.type.name)} · ${mv.damage_class.name} · pow {c|${mv.power ?? '—'}} · acc {c|${mv.accuracy ?? '—'}} · pp {c|${mv.pp}} · prio {c|${mv.priority}} · ${P.genLabel(mv.generation?.name)}`,
          `{d|${esc(eff)}}`,
        ]
      },
    }
  },
}

// ---------------------------------------------------------------- session
export async function startQuiz(mode) {
  state.quiz = { mode, q: null, n: 0, right: 0, answered: 0, awaitNext: false, hinted: false, eliminated: [] }
  const label = mode === 'mix' ? 'Mixed run' : MODES[mode].label
  print('', `{h|▶ ${label}} {d|— ${mode === 'mix' ? unlockedModes().join(', ') : MODES[mode].desc}}`, '{d|answer with a number or the name ·} {$|hint} {d|·} {$|skip} {d|·} {$|q}{d| to quit}')
  await next()
}

export function endQuiz() {
  const qz = state.quiz
  state.quiz = null
  if (!qz) return
  print(`{d|── session over:} {g|${qz.right}}{d|/${qz.answered} correct · best streak ever} {y|${state.best}}`)
}

async function next() {
  const qz = state.quiz
  if (!qz) return
  Object.assign(qz, { awaitNext: false, q: null, hinted: false, eliminated: [] })
  const mode = qz.mode === 'mix' ? P.pick(unlockedModes()) : qz.mode
  state.busy = true
  let q = null
  let err
  try {
    for (let i = 0; i < 8 && !q; i++) {
      try {
        q = await GEN[mode](ctx())
      } catch (e) {
        err = e
      }
    }
  } finally {
    state.busy = false
  }
  if (state.quiz !== qz) return
  if (!q) {
    print(`{r|E:} couldn't build a question (${esc(err?.message || 'no data')}). PokeAPI down? try again.`)
    state.quiz = null
    return
  }
  q.mode = mode
  qz.q = q
  qz.n++
  state.cards = q.cards
  print('', `{d|── Q${qz.n} · ${MODES[mode].label} · ${MODES[mode].xp}xp ${'─'.repeat(20)}}`)
  print(...q.prompt)
  printChoices(q, qz)
}

function printChoices(q, qz) {
  q.choices.forEach((c, i) => {
    if (qz.eliminated.includes(i)) pushParts([{ t: `  [${i + 1}] ` , c: 'd' }, { t: c, c: 'd strike' }])
    else pushParts([{ t: '  ' }, { t: `[${i + 1}]`, c: 'cmd', run: String(i + 1) }, { t: ' ' + c }])
  })
}

function revealCards() {
  state.cards.forEach((c) => (c.mask = {}))
}

async function explain(q) {
  try {
    const lines = await q.explain?.()
    if (lines) print(...lines)
  } catch (e) {
    print(`{d|(couldn't load details: ${esc(e.message)})}`)
  }
  print('{$|n}{d| ⏎ next question ·} {$|q}{d| quit}')
}

export async function quizInput(line) {
  const qz = state.quiz
  const l = line.trim().toLowerCase()
  if (['q', 'quit', 'exit', ':q', ':wq', 'stop', 'logout'].includes(l)) return endQuiz()
  if (qz.awaitNext) return next()
  const q = qz.q
  if (!q || !l) return
  if (l === 'help' || l === '?') {
    print('{d|in a quiz: type the number or the answer ·} {$|hint} {d|(halves xp) ·} {$|skip} {d|·} {$|q} {d|quit}')
    return
  }
  if (l === 'hint') {
    qz.hinted = true
    if (q.hint) print(`{o|hint:} ${q.hint()}`)
    const wrong = q.choices.map((_, i) => i).filter((i) => i !== q.answer && !qz.eliminated.includes(i))
    if (wrong.length > 1) {
      qz.eliminated.push(P.pick(wrong))
      print('{o|hint:} one wrong answer removed {d|(xp for this question is halved)}')
      printChoices(q, qz)
    } else if (!q.hint) print('{o|no more hints — it is one of two.}')
    return
  }
  if (l === 'skip') {
    qz.awaitNext = true
    state.streak = 0
    print(`{o|↷ skipped.} it was {y|${esc(q.choices[q.answer])}}`)
    revealCards()
    return explain(q)
  }

  let idx = -1
  let typed = false
  if (/^\d+$/.test(l)) idx = +l - 1
  else {
    const n = P.norm(l)
    idx = q.choices.findIndex((c) => P.norm(c) === n)
    if (idx < 0 && q.accept?.some((a) => P.norm(a) === n)) idx = q.answer
    typed = idx >= 0
    if (idx < 0) {
      // a non-matching free-text answer for a name question counts as a wrong guess
      if (q.accept) idx = -2
      else return print(`{o|?} not one of the options — answer 1-${q.choices.length}`)
    }
  }
  if (idx === -1 || idx >= q.choices.length || qz.eliminated.includes(idx)) return print(`{o|?} pick 1-${q.choices.length}`)

  const correct = idx === q.answer
  qz.awaitNext = true
  qz.answered++
  const ms = (state.modeStats[q.mode] ??= { right: 0, total: 0 })
  ms.total++
  if (correct) {
    qz.right++
    state.streak++
    state.best = Math.max(state.best, state.streak)
    ms.right++
    const base = MODES[q.mode].xp + Math.min(state.streak - 1, 10) * 2 + (typed && q.typedBonus ? q.typedBonus : 0)
    const xp = Math.max(1, Math.round(base * (qz.hinted ? 0.5 : 1)))
    const flames = state.streak >= 3 ? ` {o|${'▲'.repeat(Math.min(state.streak, 10))} streak ${state.streak}}` : ''
    print(`{g|✔ correct!} {y|+${xp} xp}${typed && q.typedBonus ? ' {d|(typed it!)}' : ''}${flames}`)
    state.flash++
    addXp(xp)
    if (ms.right === BADGE_AT) print(`{p|◆ BADGE EARNED:} ${MODES[q.mode].label} {d|(${BADGE_AT} correct) — see} {$|badges}`)
    if (q.caught && !state.caught.includes(q.caught)) {
      state.caught.push(q.caught)
      print(`{d|+ registered #${P.pad(q.caught)} in your Pokédex (${state.caught.length}/${state.speciesTotal})}`)
    }
  } else {
    const was = state.streak
    state.streak = 0
    print(`{r|✘ nope.} it's {y|${esc(q.choices[q.answer])}}${was >= 3 ? ` {d|(streak of ${was} lost)}` : ''}`)
  }
  revealCards()
  await explain(q)
}

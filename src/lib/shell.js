import { state, print, pushParts, hooks, RANKS, level, genRoman, genCap, rankTitle } from './store'
import { esc } from './markup'
import { setLogger } from './api'
import { COMMANDS, ALIASES } from './commands'
import { MODES, quizInput, endQuiz } from './quizzes'
import { TOPICS } from './learn'
import * as P from './poke'

export function promptText() {
  if (state.ask) return state.ask.label
  if (state.quiz) return `quiz/${state.quiz.mode}> `
  const u = state.sudo ? 'root' : rankTitle()
  return `${u}@pokeos:~${state.sudo ? '#' : '$'} `
}

setLogger(({ url, status, ms }) => {
  if (!state.verbose) return
  let path = url.replace('https://pokeapi.co', '')
  // don't leak answers through the request log mid-question
  if (state.quiz && !state.quiz.awaitNext) path = path.replace(/\/[^/?]+$/, '/•••')
  print(`{d|  ↳ GET ${esc(path)}} {${status < 400 ? 'g' : 'r'}|${status}} {d|${ms}ms}`)
})

hooks.onRankUp = (from, to) => {
  const modes = Object.entries(MODES).filter(([, m]) => m.level > from && m.level <= to)
  const cmds = Object.values(COMMANDS).filter((c) => c.level > from && c.level <= to && !c.hidden)
  const topics = Object.entries(TOPICS).filter(([, t]) => t.level > from && t.level <= to)
  state.flash += 10
  print(
    '',
    `{p|╔══════════════════════════════════════════╗}`,
    `{p|║}  {h|RANK UP}  ${RANKS[from].title} → {y|${RANKS[to].title}}`,
    `{p|╚══════════════════════════════════════════╝}`,
    `  {g|+} Pokémon pool now Gen I–${genRoman()} {d|(#1–#${genCap()})}`,
    ...modes.map(([k, m]) => `  {g|+} quiz: {$|play ${k}} {d|— ${m.desc}}`),
    ...cmds.map((c) => `  {g|+} command: {$|${c.name}} {d|— ${c.desc}}`),
    ...topics.map(([k, t]) => `  {g|+} notes: {$|learn ${k}} {d|— ${t.title}}`),
  )
}

const tokenize = (s) => (s.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^(["'])(.*)\1$/, '$2'))

export async function exec(raw, elevated = false) {
  const line = raw.trim()
  if (state.ask) {
    const a = state.ask
    state.ask = null
    pushParts([{ t: a.label, c: 'prompt' }, { t: a.secret ? '' : raw }])
    return a.resolve(line)
  }
  if (!elevated) pushParts([{ t: promptText(), c: 'prompt' }, { t: raw }])
  if (state.quiz) return quizInput(line)
  if (!line) return
  if (!elevated) state.history.push(line)

  let cmdLine = line
  if (/\|/.test(line)) {
    const m = /^(curl\s+\S+)\s*\|\s*jq\s+(\S+)/.exec(line)
    if (m) cmdLine = `${m[1]} ${m[2].replace(/^['"]|['"]$/g, '')}`
    else return print('{r|pokesh:} pipes are clogged {d|(a Muk is sitting on them)}. {d|only} curl … | jq .path {d|works.}')
  }
  const [name0, ...args] = tokenize(cmdLine)
  const name = ALIASES[name0.toLowerCase()] || name0.toLowerCase()
  const cmd = COMMANDS[name]
  if (!cmd) {
    const sug = P.suggest(name, Object.keys(COMMANDS).filter((k) => !COMMANDS[k].hidden))
    // maybe they typed a pokémon name directly
    const species = (await P.speciesList()).find((s) => s.name === name0.toLowerCase())
    if (species) return COMMANDS.dex.run([species.name])
    return print(`{r|pokesh:} command not found: ${esc(name0)}${sug ? ` {d|— did you mean} {$|${sug}}{d|?}` : ''} {d|·} {$|help}`)
  }
  if (cmd.level > level()) return print(`{r|pokesh:} ${name}: permission denied {d|— unlocks at rank} {y|${RANKS[cmd.level].title}}`)
  state.busy = true
  try {
    await cmd.run(args, cmdLine)
  } catch (e) {
    print(`{r|E:} ${String(e.message).includes('{$|') ? e.message : esc(e.message)}`)
  } finally {
    state.busy = false
  }
}

export function interrupt() {
  pushParts([{ t: promptText(), c: 'prompt' }, { t: '^C', c: 'd' }])
  if (state.ask) (state.ask = null), (state.busy = false)
  if (state.quiz) endQuiz()
}

export async function complete(buf) {
  const parts = buf.split(/\s+/)
  const sources = async (cmd) => {
    const c = typeof cmd.complete === 'function' ? cmd.complete() : cmd.complete
    if (c === 'pokemon') return (await P.speciesList()).map((s) => s.name)
    return c || []
  }
  let cands
  if (parts.length === 1) cands = Object.keys(COMMANDS).filter((k) => !COMMANDS[k].hidden && COMMANDS[k].level <= level())
  else {
    const cmd = COMMANDS[ALIASES[parts[0]] || parts[0]]
    if (!cmd) return null
    cands = await sources(cmd)
  }
  const pre = parts[parts.length - 1].toLowerCase()
  const hits = cands.filter((c) => c.startsWith(pre))
  if (!hits.length) return null
  let common = hits[0]
  for (const h of hits) while (!h.startsWith(common)) common = common.slice(0, -1)
  const head = parts.slice(0, -1).join(' ')
  const out = (head ? head + ' ' : '') + common + (hits.length === 1 ? ' ' : '')
  return { value: out, hits: hits.length > 1 ? hits : [] }
}

export function motd() {
  print(
    '{h|Welcome to pokéOS 9.0} {d|(GNU/Pokémon x86_64) — powered by} {c|pokeapi.co/api/v2}',
    '',
    `  {d|*} new here?        {$|play whos}   {d|— who's that Pokémon?}`,
    `  {d|*} field notes:     {$|learn}       {d|— short lessons, interview-flavored}`,
    `  {d|*} look stuff up:   {$|dex pikachu} {d|·} {$|random}`,
    `  {d|*} everything else: {$|help}`,
    '',
    `{d|You are} {p|${rankTitle()}}{d|. Earn xp to climb: ${RANKS.map((r) => r.title).join(' → ')}.}`,
    '{d|Each rank unlocks another generation, deeper quiz modes, and new commands.}',
    '',
  )
}

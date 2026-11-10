import { state, print, pushParts, level, rankTitle, RANKS, genCap, maxGen, genRoman } from './store'
import { esc, vpad } from './markup'
import { get, netStats } from './api'
import { MODES, BADGE_AT, startQuiz, unlockedModes } from './quizzes'
import { TOPICS, topicLines } from './learn'
import * as P from './poke'

export const COMMANDS = {}
export const ALIASES = { cat: 'dex', pokedex: 'dex', quiz: 'play', man: 'help', '?': 'help', cls: 'clear', score: 'stats', natures: 'nature', types: 'type', logout: 'exit', reboot: 'exit', top: 'stats', fetch: 'neofetch' }

function def(name, o) {
  COMMANDS[name] = { name, level: 0, group: 'sys', args: '', ...o }
}

const BOOTED_AT = Date.now()
const card = async (q, mask) => {
  const { p, s } = await P.resolvePokemon(q)
  return { p, s, c: P.toCard(p, s, mask) }
}

// ───────────────────────────────────────── game
def('play', {
  group: 'game', args: '[mode]', desc: 'start a quiz — the main game',
  complete: () => [...Object.keys(MODES), 'mix'],
  async run([mode]) {
    if (!mode) {
      print('{h|quiz modes} {d|(xp per correct answer; streaks add a bonus)}')
      for (const [k, m] of Object.entries(MODES)) {
        const ok = m.level <= level()
        const st = state.modeStats[k]
        const acc = st?.total ? ` {d|${st.right}/${st.total}}` : ''
        print(ok
          ? `  {$|play ${k}}${' '.repeat(9 - k.length)} {y|${String(m.xp).padStart(2)}xp} ${m.label} {d|— ${m.desc}}${acc}`
          : `  {dd|play ${k.padEnd(9)} ${String(m.xp).padStart(2)}xp ${m.label}} {d|🔒 rank ${RANKS[m.level].title}}`)
      }
      print(`  {$|play mix}       {d|random mix of everything you've unlocked}`)
      return
    }
    if (mode === 'all' || mode === 'random') mode = 'mix'
    if (mode !== 'mix' && !MODES[mode]) return print(`{r|play:} unknown mode '${esc(mode)}'. try {$|play}`)
    if (mode !== 'mix' && MODES[mode].level > level()) return print(`{r|play:} '${mode}' is locked until rank {y|${RANKS[MODES[mode].level].title}}. keep playing ↑`)
    await startQuiz(mode)
  },
})

def('stats', {
  group: 'game', desc: 'your progress, accuracy per mode',
  run() {
    const L = level()
    const nx = RANKS[L + 1]
    print(`{h|${state.sudo ? 'root' : rankTitle()}} {d|· rank ${L}/${RANKS.length - 1} · ${state.xp} xp${nx ? ` · ${nx.xp - state.xp} xp to ${nx.title}` : ' · max rank'}}`)
    print(`  pokédex   {y|${state.caught.length}}/${state.speciesTotal} registered {d|(answer correctly to register)}`)
    print(`  streak    {y|${state.streak}} now · {y|${state.best}} best`)
    print(`  pool      Gen I–${genRoman()} {d|(#1–#${genCap()})}${state.genLimit ? ' {o|(limited by config)}' : ''}`)
    for (const [k, m] of Object.entries(MODES)) {
      const st = state.modeStats[k]
      if (!st) continue
      const pct = Math.round((st.right / st.total) * 100)
      print(`  ${vpad(m.label, 20)} ${P.statBar(pct * 2.55, 14)} {y|${pct}%} {d|(${st.right}/${st.total})}${st.right >= BADGE_AT ? ' {p|◆}' : ''}`)
    }
    print(`  {d|network: ${netStats.requests} requests, ${netStats.hits} cache hits this session}`)
  },
})

def('badges', {
  group: 'game', desc: `one badge per quiz mode (${BADGE_AT} correct)`,
  run() {
    print('{h|badge case}')
    for (const [k, m] of Object.entries(MODES)) {
      const r = state.modeStats[k]?.right || 0
      print(r >= BADGE_AT ? `  {p|◆} ${m.label}` : `  {dd|◇} {d|${m.label} — ${r}/${BADGE_AT}}`)
    }
  },
})

// ───────────────────────────────────────── dex
def('dex', {
  group: 'dex', args: '<pokémon|#>', desc: 'look up a Pokémon (cat works too)', complete: 'pokemon',
  async run(args) {
    const { p, s, c } = await card(args.join('-'))
    state.cards = [c]
    print(`{p|#${P.pad(c.id)}} {h|${esc(c.name)}} {d|— ${esc(c.genus)}}  ${P.fmtTypes(c.types)}${c.legendary ? ' {o|★ legendary}' : ''}${c.mythical ? ' {v|✦ mythical}' : ''}`)
    print(`{d|${c.height} m · ${c.weight} kg · ${P.genLabel(c.gen)} · capture rate ${s.capture_rate} · ${s.gender_rate < 0 ? 'genderless' : `${(s.gender_rate / 8) * 100}% female`}}`)
    for (const st of c.stats) print(`  ${st.label.padEnd(4)} ${P.statBar(st.value)} {y|${st.value}}`)
    print(`  {d|BST}  {y|${c.bst}}`)
    print(`  abilities: ${p.abilities.map((a) => P.title(a.ability.name) + (a.is_hidden ? ' {p|(hidden)}' : '')).join(', ')}`)
    if (s.varieties.length > 1) print(`  {d|varieties:} ${s.varieties.map((v) => `{$|dex ${v.pokemon.name}}`).join(' ')}`)
    if (c.flavor) print(`  {c|“${esc(c.flavor)}”}`)
    print(`  {d|more:} {$|evo ${s.name}} {$|weak ${p.name}} {$|cry ${p.name}} {$|curl pokemon/${p.name}}`)
  },
})

def('random', {
  group: 'dex', desc: 'surprise me (within your unlocked gens)',
  run: () => COMMANDS.dex.run([String(P.randId(genCap()))]),
})

def('cry', {
  group: 'dex', args: '[pokémon]', desc: 'play its cry 🔊', complete: 'pokemon',
  async run(args) {
    let url = state.cards[0]?.cry
    let name = state.cards[0]?.name
    if (args.length) {
      const r = await card(args.join('-'))
      url = r.c.cry
      name = r.c.name
      state.cards = [r.c]
    }
    if (!url) return print('{r|cry:} nothing to play. try {$|cry pikachu}')
    if (state.quiz && state.cards[0]?.mask?.hideName) return print('{o|nice try.} no cries during a silhouette 😉')
    await new Audio(url).play()
    print(`{v|♪ ♫} ${esc(name)} {d|(${url.split('/').slice(-2).join('/')})}`)
  },
})

def('evo', {
  group: 'dex', level: 1, args: '<pokémon>', desc: 'evolution tree with methods', complete: 'pokemon',
  async run(args) {
    const { s, c } = await card(args.join('-'))
    if (!s.evolution_chain) return print('{d|no evolution chain}')
    const ch = await get(s.evolution_chain.url)
    state.cards = [c]
    print(`{d|evolution-chain/${P.idFromUrl(s.evolution_chain.url)}}`)
    print(...P.evoTree(ch.chain, s.name).map((l) => '  ' + l))
    if (!ch.chain.evolves_to.length) print('{d|  (does not evolve)}')
    if (s.is_baby) print('{d|  ↳ a baby Pokémon (Gen II+ concept, usually hatched from eggs)}')
  },
})

def('type', {
  group: 'dex', level: 1, args: '<type>', desc: 'offense & defense of a type', complete: () => P.TYPES,
  async run([t]) {
    if (!t) return print(`{d|types:} ${P.TYPES.map((x) => `{t-${x}|${x}}`).join(' ')}  {d|→ e.g.} {$|type ghost}`)
    t = t.toLowerCase()
    if (!P.TYPES.includes(t)) return print(`{r|type:} unknown type '${esc(t)}'`)
    const d = await P.getType(t)
    const r = d.damage_relations
    const row = (label, cls, list) => list.length && print(`  {${cls}|${label.padEnd(18)}} ${list.map((x) => P.fmtType(x.name)).join(' ')}`)
    print(`{h|${P.title(t)}} {d|· introduced ${P.genLabel(d.generation.name)} · move class pre-Gen IV: ${d.move_damage_class?.name ?? '—'} · ${d.moves.length} moves · ${d.pokemon.length} pokémon}`)
    print('{d|attacking}')
    row('2× super effective', 'r', r.double_damage_to)
    row('½× not very', 'g', r.half_damage_to)
    row('0× no effect', 'v', r.no_damage_to)
    print('{d|defending}')
    row('2× weak to', 'r', r.double_damage_from)
    row('½× resists', 'g', r.half_damage_from)
    row('0× immune to', 'v', r.no_damage_from)
    if (d.past_damage_relations?.length) print(`{o|history:} relations changed after ${d.past_damage_relations.map((x) => P.genLabel(x.generation.name)).join(', ')} → {$|curl type/${t} .past_damage_relations}`)
  },
})

def('weak', {
  group: 'dex', level: 2, args: '<pokémon>', desc: 'defensive matchups of a Pokémon', complete: 'pokemon',
  async run(args) {
    const { p, c } = await card(args.join('-'))
    state.cards = [c]
    print(`{h|${esc(c.name)}} ${P.fmtTypes(c.types)} {d|defending}`)
    print(...P.defenseLines(await P.defenseTable(c.types)))
    const notes = p.abilities.flatMap((a) => Object.entries(P.MATCHUP_ABILITIES[a.ability.name] || {}).map(([, n]) => `{y|${P.title(a.ability.name)}}${a.is_hidden ? ' (hidden)' : ''}: ${n}`))
    if (notes.length) print(`  {o|abilities:} ${notes.join(' · ')}`)
  },
})

def('compare', {
  group: 'dex', level: 2, args: '<a> <b>', desc: 'base stats side by side', complete: 'pokemon',
  async run([a, b]) {
    if (!a || !b) return print('usage: {$|compare garchomp salamence}')
    const [x, y] = await Promise.all([card(a), card(b)])
    state.cards = [x.c, y.c]
    print(`  ${''.padEnd(5)}{y|${esc(x.c.name).padEnd(16)}}{p|${esc(y.c.name)}}`)
    const rows = [...x.c.stats.map((s, i) => [s.label, s.value, y.c.stats[i].value]), ['BST', x.c.bst, y.c.bst]]
    for (const [l, va, vb] of rows) {
      const w = va === vb ? '{d|=}' : va > vb ? '{y|◀}' : '{p|▶}'
      print(`  ${l.padEnd(4)} ${String(va).padStart(4)} ${P.statBar(Math.min(va, 255), 10)} ${w} ${P.statBar(Math.min(vb, 255), 10)} ${vb}`)
    }
  },
})

def('nature', {
  group: 'dex', level: 3, desc: 'all 25 natures',
  async run() {
    const list = await get('nature?limit=30')
    const ns = await Promise.all(list.results.map((r) => get(r.url)))
    const S = (x) => (x ? P.STAT_SHORT[x.name] : '—')
    print(`{d|${'nature'.padEnd(10)} ${'+10%'.padEnd(5)} ${'−10%'.padEnd(5)} likes      dislikes}`)
    for (const n of ns.sort((a, b) => a.name.localeCompare(b.name))) {
      const neutral = !n.increased_stat
      print(`${neutral ? '{d|' : '{y|'}${P.title(n.name).padEnd(10)}} {g|${S(n.increased_stat).padEnd(5)}} {r|${S(n.decreased_stat).padEnd(5)}} {d|${(n.likes_flavor?.name || '—').padEnd(10)} ${n.hates_flavor?.name || '—'}}`)
    }
    print('{d|neutral natures raise & lower the same stat → no effect.}')
  },
})

def('gen', {
  group: 'dex', level: 3, args: '[n]', desc: 'generations, regions, debut counts',
  async run([n]) {
    if (!n) {
      const gens = await Promise.all(P.GEN_INFO.map((g) => get(`generation/${g.n}`)))
      gens.forEach((g, i) => {
        const info = P.GEN_INFO[i]
        const lock = i + 1 > maxGen() ? ' {d|🔒}' : ''
        print(`  {$|gen ${i + 1}} {y|${('Gen ' + info.roman).padEnd(8)}} ${info.region.padEnd(7)} {c|${String(g.pokemon_species.length).padStart(3)}} new · {d|${g.moves.length} moves · ${info.games}}${lock}`)
      })
      return
    }
    const g = await get(`generation/${n}`)
    const info = P.GEN_INFO[g.id - 1]
    const ids = g.pokemon_species.map((s) => P.idFromUrl(s.url)).sort((a, b) => a - b)
    print(`{h|Gen ${info.roman} — ${g.main_region.name}} {d|(${info.year})} ${info.games}`)
    print(`  species #${ids[0]}–#${ids[ids.length - 1]} (${ids.length}) · ${g.moves.length} new moves · ${g.abilities.length} new abilities${g.types.length ? ` · new types: ${g.types.map((t) => P.fmtType(t.name)).join(' ')}` : ''}`)
    print(`  {d|version groups:} ${g.version_groups.map((v) => v.name).join(', ')}`)
  },
})

// ───────────────────────────────────────── learn
def('learn', {
  group: 'learn', args: '[topic]', desc: 'field notes for the interview 📓', complete: () => Object.keys(TOPICS),
  run([t]) {
    if (!t) {
      print('{h|field notes} {d|— short lessons; each ends with commands to poke at}')
      for (const [k, v] of Object.entries(TOPICS)) {
        const ok = v.level <= level()
        print(ok ? `  {$|learn ${k}}${' '.repeat(12 - k.length)}${v.title}` : `  {dd|learn ${k.padEnd(12)}${v.title}} {d|🔒 ${RANKS[v.level].title}}`)
      }
      return
    }
    if (!TOPICS[t]) return print(`{r|learn:} no notes on '${esc(t)}'. try {$|learn}`)
    if (TOPICS[t].level > level()) return print(`{r|learn:} '${t}' unlocks at rank {y|${RANKS[TOPICS[t].level].title}}`)
    print(...topicLines(t))
  },
})

def('curl', {
  group: 'learn', level: 4, args: '<path> [.jq.path]', desc: 'raw PokeAPI JSON (pipe to jq works too)',
  async run([path, sel, ...rest]) {
    if (!path) return print('usage: {$|curl pokemon/pikachu .types} · {$|curl type/fire .damage_relations}')
    let data = await get(path.replace(/^https?:\/\/pokeapi\.co\/api\/v2\//, ''))
    if (sel && sel !== '.') {
      for (const k of sel.split(/[.[\]]/).filter(Boolean)) {
        data = data?.[k]
        if (data === undefined) return print(`{r|jq:} no key '${esc(k)}'`)
      }
    }
    const all = rest.includes('--all') || sel === '--all'
    const lines = JSON.stringify(data, null, 2).split('\n')
    const show = all ? lines : lines.slice(0, 60)
    for (const l of show) {
      const m = /^(\s*)(".*?":)?\s?(.*)$/.exec(l)
      const v = m[3]
      const c = /^"/.test(v) ? 'y' : /^-?\d/.test(v) ? 'v' : /^(true|false|null)/.test(v) ? 'o' : 'd'
      pushParts([{ t: m[1] }, ...(m[2] ? [{ t: m[2] + ' ', c: 'p' }] : []), { t: v, c }])
    }
    if (!all && lines.length > 60) print(`{d|… ${lines.length - 60} more lines (add --all, or narrow with a .path)}`)
  },
})

def('verbose', {
  group: 'learn', args: '[on|off]', desc: 'log every PokeAPI request',
  run([v]) {
    state.verbose = v ? v === 'on' : !state.verbose
    print(`verbose ${state.verbose ? '{g|on}' : '{d|off}'} {d|— requests show as ↳ GET lines}`)
  },
})

// ───────────────────────────────────────── system
def('help', {
  args: '[cmd]', desc: 'this screen', complete: () => Object.keys(COMMANDS),
  run([c]) {
    if (c) {
      const cmd = COMMANDS[ALIASES[c] || c]
      if (!cmd) return print(`No manual entry for ${esc(c)}`)
      return print(`{h|${cmd.name}} ${cmd.args} {d|— ${cmd.desc}}${cmd.level > level() ? ` {d|🔒 rank ${RANKS[cmd.level].title}}` : ''}`)
    }
    print('{h|pokesh} {d|0.9 — tab completes · ↑↓ history · ctrl+l clears · ctrl+c cancels ·} {p|click} {d|highlighted text}')
    const groups = { game: 'play', dex: 'pokédex', learn: 'learn', sys: 'system' }
    for (const [g, label] of Object.entries(groups)) {
      print(`{d|${label}}`)
      for (const cmd of Object.values(COMMANDS).filter((x) => x.group === g && !x.hidden)) {
        const sig = `${cmd.name} ${cmd.args}`.trim()
        if (cmd.level <= level()) print('  ' + vpad(`{$|${cmd.name}} {d|${esc(cmd.args)}}`, 27) + cmd.desc)
        else print(`  {dd|${sig.padEnd(26)} ${cmd.desc}} {d|🔒 ${RANKS[cmd.level].title}}`)
      }
    }
  },
})

def('clear', { desc: 'clear the screen', run: () => (state.lines = []) })
def('history', { desc: 'command history', run: () => state.history.slice(-30).forEach((h, i, a) => print(`{d|${String(state.history.length - a.length + i + 1).padStart(5)}}  ${esc(h)}`)) })
def('whoami', { desc: 'who are you, really', run: () => print(state.sudo ? 'root' : rankTitle()) })
def('neofetch', {
  desc: 'system info, but make it pokéball',
  run() {
    const art = [
      '{p|      ▄▄▄▄▄▄▄      }',
      '{p|   ▄███████████▄   }',
      '{p|  ███████████████  }',
      '{p| ▐██████▀▀▀██████▌ }',
      '{d| ━━━━━━━(o)━━━━━━━ }',
      ' ▐██████▄▄▄██████▌ ',
      '  ███████████████  ',
      '   ▀███████████▀   ',
      '      ▀▀▀▀▀▀▀      ',
    ]
    const up = Math.round((Date.now() - BOOTED_AT) / 60000)
    const u = state.sudo ? 'root' : rankTitle()
    const info = [
      `{p|${u}}@{p|pokeos}`,
      '{d|─────────────}',
      `{p|OS}: pokéOS 9.0 (Paldea) x86_64`,
      `{p|Kernel}: pokeapi-v2`,
      `{p|Uptime}: ${up} min`,
      `{p|Shell}: pokesh 0.9`,
      `{p|Rank}: ${u} (${level()}/${RANKS.length - 1}) · ${state.xp} xp`,
      `{p|Pokédex}: ${state.caught.length}/${state.speciesTotal} · Gen ≤ ${genRoman()}`,
      `{p|Terminal}: tty1  {r|██}{o|██}{y|██}{g|██}{c|██}{b|██}{v|██}`,
    ]
    art.forEach((a, i) => print(`${a}   ${info[i] || ''}`))
  },
})
def('date', { desc: 'current date', run: () => print(new Date().toString()) })
def('uname', { args: '[-a]', desc: 'kernel info', run: ([a]) => print(a === '-a' ? 'pokeOS pallet 9.0.25-paldea #1025 SMP PREEMPT_DYNAMAX x86_64 GNU/Pokémon' : 'pokeOS') })
def('echo', { args: '<text>', desc: 'echo echo echo', run: (args) => print(esc(args.join(' '))) })
def('pwd', { desc: 'where am I', run: () => print(`/home/${state.sudo ? 'root' : rankTitle()}/pallet-town`) })
def('cd', { hidden: true, desc: '', run: () => print("{r|cd:} you can't leave Pallet Town without a Pokémon. try {$|play whos}") })
def('ls', {
  args: '[path]', desc: 'list the virtual filesystem',
  async run([p = '/']) {
    p = p.replace(/\/+$/, '') || '/'
    if (p === '/' || p === '~' || p === '.') return print('{c|bin/}  {c|dev/}  {c|proc/}  {c|usr/}  {d|try} {$|ls /dev/pokedex} {$|ls /proc/types} {$|ls /usr/share/learn} {$|ls /bin}')
    if (p === '/bin') return print(Object.values(COMMANDS).filter((c) => !c.hidden).map((c) => (c.level <= level() ? `{g|${c.name}}` : `{dd|${c.name}}`)).join('  '))
    if (p === '/proc/types') return print(P.TYPES.map((t) => `{$|type ${t}}`).join(' '))
    if (p === '/usr/share/learn') return print(Object.keys(TOPICS).map((t) => `{$|learn ${t}}`).join('  '))
    if (p === '/dev/pokedex' || p === '/dev') {
      const list = (await P.speciesList()).filter((s) => s.id <= genCap())
      const cols = 6
      for (let i = 0; i < list.length; i += cols)
        print(list.slice(i, i + cols).map((s) => `{d|${P.pad(s.id)}} ${(state.caught.includes(s.id) ? `{g|${s.name}}` : s.name).padEnd(15)}`).join(''))
      print(`{d|${list.length} entries · green = registered by you}`)
      return
    }
    print(`{r|ls:} cannot access '${esc(p)}': No such file or directory`)
  },
})
def('fortune', {
  desc: 'a random Pokédex fortune',
  async run() {
    const s = await P.getSpecies(P.randId(genCap()))
    const t = P.pick(P.flavorTexts(s)) || '…'
    print(`{c|“${esc(t)}”}`, `{d|      — ${P.en(s.names) || s.name}, ${P.en(s.genera, 'genus') || ''}}`)
  },
})
def('pokesay', {
  args: '<text>', desc: 'cowsay, but pokéball',
  run(args) {
    const t = esc(args.join(' ') || 'Gotta grep \'em all!')
    print(' ' + '_'.repeat(t.length + 2), `< ${t} >`, ' ' + '‾'.repeat(t.length + 2), '    \\   {p|▄███▄}', '     \\ {p|█████}', '       {d|━(o)━}', '       █████', '        ▀█▀')
  },
})
def('config', {
  args: '<gen|crt> <val>', desc: 'limit Pokémon pool (gen 1…9|auto), CRT on|off',
  run([k, v]) {
    if (k === 'gen') {
      if (!v || v === 'auto') state.genLimit = null
      else if (+v >= 1 && +v <= 9) state.genLimit = +v
      else return print('usage: {$|config gen 1} … {$|config gen auto}')
      return print(`pool: Gen I–${genRoman()} (#1–#${genCap()})${state.genLimit && state.genLimit > level() + 1 ? ' {d|(capped by your rank)}' : ''}`)
    }
    if (k === 'crt') {
      state.crt = v ? v === 'on' : !state.crt
      return print(`crt ${state.crt ? '{g|on}' : '{d|off}'}`)
    }
    print('usage: {$|config gen 1} · {$|config gen auto} · {$|config crt off}')
  },
})
def('reset', {
  args: '--yes', desc: 'wipe all progress',
  run([y]) {
    if (y !== '--yes') return print('{o|this wipes xp, badges and your pokédex.} run {$|reset --yes} to confirm.')
    Object.assign(state, { xp: 0, best: 0, streak: 0, caught: [], modeStats: {}, sudo: false, genLimit: null })
    print('{g|progress wiped.} welcome back, guest.')
  },
})
def('exit', {
  desc: 'try to leave',
  run() {
    if (state.sudo) {
      state.sudo = false
      return print('logout {d|— back to being a mere} ' + rankTitle())
    }
    print("there's no logging out of the Pokémon world. {p|gotta catch 'em all.}")
  },
})
def('sudo', {
  args: '<cmd>', desc: 'with great power…',
  async run(args, raw) {
    if (state.sudo) {
      const rest = raw.replace(/^sudo\s+/, '')
      if (rest === 'su' || rest === '-i') return print('{d|already root.}')
      const { exec } = await import('./shell')
      return exec(rest, true)
    }
    if (args[0] === 'su' || args[0] === '-i') {
      let tries = 0
      const ask = () =>
        new Promise((resolve) => {
          state.ask = {
            label: `[sudo] password for ${rankTitle()}: `,
            secret: true,
            resolve: (pw) => {
              if (P.norm(pw) === 'oak') {
                state.sudo = true
                print('{p|# you are root now.} every gen, quiz, and command is unlocked. {d|(exit to drop privileges)}')
                resolve()
              } else if (++tries >= 3) {
                print('sudo: 3 incorrect password attempts. {p|This incident will be reported to Professor Oak.}')
                resolve()
              } else {
                print('Sorry, try again.')
                ask().then(resolve)
              }
            },
          }
        })
      return ask()
    }
    print(`${rankTitle()} is not in the sudoers file. {p|This incident will be reported to Professor Oak.}`)
  },
})
def('rm', { hidden: true, run: () => print("{r|rm:} cannot remove 'MissingNo.': Device or resource busy") })
def('vim', { hidden: true, run: () => print('you are now trapped in vim. {d|(just kidding, it\'s not installed. type} {$|:q}{d|)}') })
def(':q', { hidden: true, run: () => print('{d|not in vim, but nice reflex.}') })
def('ping', { hidden: true, async run() { const t = performance.now(); await fetch('https://pokeapi.co/api/v2/', { cache: 'no-store' }); print(`64 bytes from pokeapi.co: icmp_seq=1 ttl=151 time=${Math.round(performance.now() - t)} ms`) } })
def('pikachu', { hidden: true, run: () => print('{y|pika pika!} {d|(did you mean} {$|dex pikachu}{d|?)}') })

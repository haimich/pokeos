<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { state, level, RANKS, rankTitle, genRoman } from '../lib/store'
import { MODES, BADGE_AT } from '../lib/quizzes'

const now = ref(new Date())
const t = setInterval(() => (now.value = new Date()), 10000)
onUnmounted(() => clearInterval(t))

const L = computed(() => level())
const prog = computed(() => {
  const cur = RANKS[rankOfXp()]
  const nx = RANKS[rankOfXp() + 1]
  if (!nx) return 1
  return (state.xp - cur.xp) / (nx.xp - cur.xp)
  function rankOfXp() {
    return RANKS.reduce((i, r, j) => (state.xp >= r.xp ? j : i), 0)
  }
})
const bar = computed(() => {
  const n = Math.round(prog.value * 10)
  return '▰'.repeat(n) + '▱'.repeat(10 - n)
})
const mode = computed(() => (state.ask ? 'PASSWD' : state.quiz ? 'QUIZ' : state.busy ? 'FETCH' : 'NORMAL'))
const badges = computed(() => Object.keys(MODES).map((k) => ({ k, on: (state.modeStats[k]?.right || 0) >= BADGE_AT, label: MODES[k].label })))
const clock = computed(() => now.value.toTimeString().slice(0, 5))
</script>

<template>
  <footer class="statusbar">
    <span class="seg mode" :class="mode.toLowerCase()">{{ mode }}</span>
    <span class="seg user">{{ state.sudo ? 'root' : rankTitle() }}@pokeos</span>
    <span class="seg">lv {{ L }}/{{ RANKS.length - 1 }}</span>
    <span class="seg xp" :title="`${state.xp} xp`"><span class="bar">{{ bar }}</span> {{ state.xp }}xp</span>
    <span class="seg streak" v-if="state.streak">▲{{ state.streak }}</span>
    <span class="spacer"></span>
    <span class="seg wide">dex {{ state.caught.length }}/{{ state.speciesTotal }}</span>
    <span class="seg wide">gen ≤ {{ genRoman() }}</span>
    <span class="seg badges" title="badges"><span v-for="b in badges" :key="b.k" :class="{ on: b.on }" :title="b.label">{{ b.on ? '◆' : '◇' }}</span></span>
    <span class="seg clock">{{ clock }}</span>
  </footer>
</template>

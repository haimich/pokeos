<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { state } from '../lib/store'
import { speciesList } from '../lib/poke'

const emit = defineEmits(['done'])
const lines = ref([])
let skip = false
let finished = false
const ts = () => `[${(performance.now() / 1000).toFixed(6).padStart(12)}]`
const sleep = (ms) => new Promise((r) => setTimeout(r, skip ? 0 : ms))
const finish = () => !finished && ((finished = true), emit('done'))
const onKey = () => (skip = true)

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  const listP = speciesList().catch(() => null)
  const log = async (text, cls = '', ms = 60) => {
    lines.value.push({ text, cls })
    await sleep(ms)
  }
  await log(`${ts()} pokéOS version 9.0.25-paldea (oak@pallet-lab) (gcc 19.96.0)`, 'd')
  await log(`${ts()} Command line: BOOT_IMAGE=/vmlinuz-pkmn root=/dev/pokedex ro quiet splash`, 'd')
  await log(`${ts()} Memory: 151K/151K available (ought to be enough for anybody)`, 'd')
  await log(`${ts()} CPU0: MissingNo. @ 4.19 MHz … just kidding, all good`, 'd')
  await log(`${ts()} usb 1-1: new PokéGear device detected`, 'd')
  await log(`${ts()} loading module pokeapi.ko`, 'd', 120)
  await log('[  OK  ] Reached target Network.', 'ok')
  await log('[  OK  ] Started PokéAPI client (https://pokeapi.co/api/v2).', 'ok')
  const list = await listP
  if (list) {
    state.speciesTotal = list.length
    await log(`[  OK  ] Mounted /dev/pokedex (${list.length} species).`, 'ok')
  } else await log('[FAILED] Mount /dev/pokedex — PokeAPI unreachable. Running degraded.', 'fail')
  await log("[  OK  ] Started Professor Oak's lab daemon (oakd).", 'ok')
  await log('[  OK  ] Reached target Pokémon Trainer Mode.', 'ok', 250)
  await log('')
  await log('pokéOS 9.0 pallet tty1', '', 120)
  await log('pallet login: guest (automatic login)', '', 400)
  finish()
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="boot" @click="skip = true">
    <div v-for="(l, i) in lines" :key="i" :class="l.cls">
      <template v-if="l.cls === 'ok'">[<b>  OK  </b>]{{ l.text.slice(8) }}</template>
      <template v-else-if="l.cls === 'fail'">[<b class="f">FAILED</b>]{{ l.text.slice(8) }}</template>
      <template v-else>{{ l.text }}</template>
    </div>
    <span class="cursor">█</span>
  </div>
</template>

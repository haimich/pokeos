<script setup>
import { ref, watch } from 'vue'
import { state } from './lib/store'
import { motd } from './lib/shell'
import Boot from './components/Boot.vue'
import Terminal from './components/Terminal.vue'
import Viewer from './components/Viewer.vue'
import StatusBar from './components/StatusBar.vue'

const flashing = ref(false)
watch(
  () => state.flash,
  () => {
    flashing.value = false
    requestAnimationFrame(() => (flashing.value = true))
    setTimeout(() => (flashing.value = false), 600)
  },
)
function booted() {
  state.booted = true
  motd()
}
</script>

<template>
  <div class="app" :class="{ crt: state.crt, flash: flashing }">
    <Boot v-if="!state.booted" @done="booted" />
    <template v-else>
      <main class="panes">
        <section class="pane term-pane">
          <header><span class="tab on">1:pokesh</span><span class="title">~/pallet-town</span></header>
          <Terminal />
        </section>
        <section class="pane dex-pane">
          <header><span class="tab">2:dex</span><span class="title">/dev/pokedex</span></header>
          <Viewer />
        </section>
      </main>
      <StatusBar />
    </template>
  </div>
</template>

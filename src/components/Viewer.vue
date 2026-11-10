<script setup>
import { state } from '../lib/store'
import PokeCard from './PokeCard.vue'
import { exec } from '../lib/shell'
</script>

<template>
  <div class="viewer">
    <div v-if="state.cards.length" class="cards" :class="{ duo: state.cards.length > 1 }">
      <PokeCard v-for="(c, i) in state.cards" :key="c.slug + i" :card="c" :compact="state.cards.length > 1" />
    </div>
    <div v-else class="idle">
      <pre class="ball" aria-hidden="true"><span class="p">      ▄▄▄▄▄▄▄
   ▄███████████▄
  ███████████████
 ▐██████▀▀▀██████▌</span>
<span class="d"> ━━━━━━━(o)━━━━━━━</span>
 ▐██████▄▄▄██████▌
  ███████████████
   ▀███████████▀
      ▀▀▀▀▀▀▀</pre>
      <p>/dev/pokedex is idle.</p>
      <p class="hint">
        try <button @click="exec('dex pikachu')">dex pikachu</button> or <button @click="exec('play whos')">play whos</button>
      </p>
    </div>
  </div>
</template>

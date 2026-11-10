<script setup>
import { computed } from 'vue'
import { TYPE_COLORS, pad, genLabel } from '../lib/poke'

const props = defineProps({ card: Object, compact: Boolean })
const m = computed(() => props.card.mask || {})
const color = (v) => (v < 50 ? 'var(--hot)' : v < 80 ? 'var(--orange)' : v < 100 ? 'var(--yellow)' : v < 125 ? 'var(--green)' : 'var(--cyan)')
const accent = computed(() => (m.value.hideTypes || m.value.mystery ? 'var(--pink)' : TYPE_COLORS[props.card.types[0]]))
</script>

<template>
  <article class="card" :class="{ compact, mystery: m.mystery }" :style="{ '--accent': accent }">
    <header>
      <span class="num">#{{ m.hideName || m.mystery ? '????' : pad(card.id) }}</span>
      <h2>{{ m.hideName || m.mystery ? '?????' : card.name }}</h2>
      <span v-if="!m.hideName && !m.mystery && (card.legendary || card.mythical)" class="tag">{{ card.mythical ? '✦ mythical' : '★ legendary' }}</span>
    </header>
    <div class="genus">{{ m.hideName || m.mystery ? 'Unknown Pokémon' : card.genus }}</div>
    <div class="art">
      <div v-if="m.mystery" class="mystery-art" aria-label="hidden">?</div>
      <img v-else-if="card.sprite" :src="card.sprite" :class="{ silhouette: m.silhouette }" alt="" draggable="false" />
    </div>
    <div class="types">
      <template v-if="m.hideTypes || m.mystery"><span class="badge unknown">???</span></template>
      <span v-else v-for="t in card.types" :key="t" class="badge" :style="{ background: TYPE_COLORS[t] }">{{ t }}</span>
    </div>
    <dl class="meta" v-if="!m.mystery">
      <div><dt>ht</dt><dd>{{ card.height }} m</dd></div>
      <div><dt>wt</dt><dd>{{ card.weight }} kg</dd></div>
      <div><dt>gen</dt><dd>{{ m.hideName ? '?' : genLabel(card.gen).replace('Gen ', '') }}</dd></div>
    </dl>
    <div class="stats" v-if="!m.mystery">
      <div v-for="s in card.stats" :key="s.key" class="stat" :class="{ hl: card.highlight === s.key }">
        <span class="lbl">{{ s.label }}</span>
        <span class="track"><span class="fill" :style="{ width: m.hideStats ? '0%' : (Math.min(s.value, 255) / 255) * 100 + '%', background: color(s.value) }"></span></span>
        <span class="val">{{ m.hideStats ? '??' : s.value }}</span>
      </div>
      <div class="stat total" :class="{ hl: card.highlight === 'bst' }">
        <span class="lbl">BST</span><span></span><span class="val">{{ m.hideStats ? '???' : card.bst }}</span>
      </div>
    </div>
    <div class="abilities" v-if="!m.mystery">
      <template v-if="m.hideAbilities">abilities: ???</template>
      <template v-else>
        <span v-for="a in card.abilities" :key="a.name" :class="{ hidden: a.hidden }">{{ a.name }}<sup v-if="a.hidden">HA</sup></span>
      </template>
    </div>
    <p class="flavor" v-if="card.flavor && !m.hideFlavor && !m.mystery && !compact">“{{ card.flavor }}”</p>
  </article>
</template>

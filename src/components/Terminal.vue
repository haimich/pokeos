<script setup>
import { ref, watch, nextTick, onMounted, computed } from 'vue'
import { state, print } from '../lib/store'
import { exec, complete, interrupt, promptText } from '../lib/shell'

const buf = ref('')
const input = ref(null)
const scroller = ref(null)
let hIdx = -1
const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
const spin = ref(0)
setInterval(() => state.busy && (spin.value = (spin.value + 1) % SPIN.length), 80)
const prompt = computed(() => promptText())

const focus = () => {
  if (window.getSelection()?.toString()) return
  input.value?.focus({ preventScroll: true })
}
const toBottom = () => nextTick(() => scroller.value && (scroller.value.scrollTop = scroller.value.scrollHeight))
watch(() => state.lines.length, toBottom)
watch(() => state.busy, toBottom)
onMounted(() => {
  focus()
  toBottom()
})

async function submit(text) {
  if (state.busy && !state.ask) return
  hIdx = -1
  buf.value = ''
  await exec(text)
  focus()
}
const run = (cmd) => submit(cmd)

async function onKey(e) {
  if (e.key === 'Enter') return submit(buf.value)
  if (e.key === 'Tab') {
    e.preventDefault()
    if (state.quiz || state.ask) return
    const r = await complete(buf.value)
    if (!r) return
    buf.value = r.value
    if (r.hits.length) print(`{d|${r.hits.slice(0, 60).join('  ')}${r.hits.length > 60 ? `  … +${r.hits.length - 60}` : ''}}`)
    return
  }
  if (e.ctrlKey && e.key === 'l') {
    e.preventDefault()
    state.lines = []
    return
  }
  if (e.ctrlKey && e.key === 'c' && !window.getSelection()?.toString()) {
    e.preventDefault()
    buf.value = ''
    return interrupt()
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    if (state.quiz || state.ask) return
    e.preventDefault()
    const h = state.history
    if (!h.length) return
    if (e.key === 'ArrowUp') hIdx = hIdx < 0 ? h.length - 1 : Math.max(0, hIdx - 1)
    else hIdx = hIdx < 0 ? -1 : hIdx + 1 >= h.length ? -1 : hIdx + 1
    buf.value = hIdx < 0 ? '' : h[hIdx]
    nextTick(() => input.value.setSelectionRange(buf.value.length, buf.value.length))
  }
}
</script>

<template>
  <div class="term" ref="scroller" @click="focus">
    <div v-for="l in state.lines" :key="l.id" class="line">
      <template v-for="(p, i) in l.parts" :key="i"
        ><span v-if="p.run" class="cmd" :class="p.c" role="button" tabindex="-1" @click.stop="run(p.run)">{{ p.t }}</span
        ><span v-else :class="p.c">{{ p.t }}</span></template
      >
    </div>
    <label class="input-line">
      <span class="prompt">{{ prompt }}</span>
      <span v-if="state.busy && !state.ask" class="spin">{{ SPIN[spin] }}</span>
      <input
        ref="input"
        v-model="buf"
        :type="state.ask?.secret ? 'password' : 'text'"
        :aria-label="prompt"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        enterkeyhint="send"
        @keydown="onKey"
      />
    </label>
  </div>
</template>

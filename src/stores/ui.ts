import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RhymeColor } from '@/types/domain'

export const useUIStore = defineStore('ui', () => {
  const activeRhymeColor = ref<RhymeColor>('blue')

  function setRhymeColor(c: RhymeColor) {
    activeRhymeColor.value = c
  }

  return { activeRhymeColor, setRhymeColor }
})

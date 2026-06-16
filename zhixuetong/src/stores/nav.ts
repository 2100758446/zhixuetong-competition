import { defineStore } from 'pinia'
import { ref } from 'vue'

// 跨页面传递「要打开的笔记 ID」
export const useNavStore = defineStore('nav', () => {
  const pendingNoteId = ref('')

  function openNote(id: string) {
    pendingNoteId.value = id
  }

  function consumeNoteId(): string {
    const id = pendingNoteId.value
    pendingNoteId.value = ''
    return id
  }

  return { pendingNoteId, openNote, consumeNoteId }
})

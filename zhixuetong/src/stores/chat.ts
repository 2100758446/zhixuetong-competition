import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ChatMessage {
  id: number
  role: 'user' | 'ai'
  content: string
  html: string
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isTyping = ref(false)
  let nextId = 0

  function addMessage(role: 'user' | 'ai', content: string, html: string) {
    messages.value.push({ id: nextId++, role, content, html })
  }

  function clearMessages() {
    messages.value = []
    nextId = 0
    isTyping.value = false
  }

  return { messages, isTyping, addMessage, clearMessages }
})

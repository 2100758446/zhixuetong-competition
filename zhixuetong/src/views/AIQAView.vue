<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import mathjax3 from 'markdown-it-mathjax3'
import axios from 'axios'
import { useChatStore } from '@/stores/chat'

import 'highlight.js/styles/github.css'

const API_URL = `${import.meta.env.VITE_API_BASE_URL}/api/chat`
const chatStore = useChatStore()

// ── Markdown-it 配置 ──
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs-code-block"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`
      } catch {
        // fall through
      }
    }
    return `<pre class="hljs-code-block"><code>${md.utils.escapeHtml(str)}</code></pre>`
  },
})
md.use(mathjax3)

// ── 从 store 取状态 ──
const messages = chatStore.messages
const inputText = ref('')
const chatContainer = ref<HTMLDivElement>()
const inputRef = ref<HTMLTextAreaElement>()

// ── 滚动到底部 ──
function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTo({
        top: chatContainer.value.scrollHeight,
        behavior: 'smooth',
      })
    }
  })
}

// ── 发送消息（调用后端 API，携带上下文） ──
async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || chatStore.isTyping) return

  chatStore.addMessage('user', text, md.render(text))
  inputText.value = ''
  scrollToBottom()

  chatStore.isTyping = true

  // 构造上下文 messages 数组（user/ai 交替）
  const contextMessages = chatStore.messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }))

  try {
    const { data } = await axios.post(API_URL, { messages: contextMessages }, { timeout: 60000 })
    chatStore.addMessage('ai', data.reply, md.render(data.reply))
  } catch (err: unknown) {
    const errorMsg = axios.isAxiosError(err)
      ? err.response?.data?.detail || err.response?.data?.error || err.message
      : '未知错误'
    chatStore.addMessage('ai', `⚠️ 请求失败：${errorMsg}`, `<p style="color:#ef4444">⚠️ 请求失败：${errorMsg}</p>`)
  } finally {
    chatStore.isTyping = false
    scrollToBottom()
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

onMounted(() => {
  inputRef.value?.focus()
})
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- ═══ 聊天主区域 ═══ -->
    <div
      ref="chatContainer"
      class="flex-1 overflow-y-auto px-4 py-6"
    >
      <!-- 空状态 -->
      <div
        v-if="messages.length === 0"
        class="flex h-full flex-col items-center justify-center"
      >
        <div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-50 text-4xl">
          🤖
        </div>
        <h2 class="mt-4 text-xl font-semibold text-gray-800">AI 智能问答</h2>
        <p class="mt-2 max-w-sm text-center text-sm text-gray-500">
          你好！我是你的学习助手，可以帮你解答问题、分析代码、理解公式。试试问我点什么吧！
        </p>
      </div>

      <!-- 消息列表 -->
      <div class="mx-auto max-w-3xl space-y-6">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="flex gap-3"
          :class="msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'"
        >
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            :class="msg.role === 'user'
              ? 'bg-indigo-600 text-white'
              : 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white'"
          >
            {{ msg.role === 'user' ? '我' : 'AI' }}
          </div>

          <div
            class="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm"
            :class="msg.role === 'user'
              ? 'bg-indigo-600 text-white rounded-tr-md'
              : 'bg-white text-gray-800 rounded-tl-md ring-1 ring-gray-200/60'"
          >
            <p v-if="msg.role === 'user'" class="whitespace-pre-wrap">{{ msg.content }}</p>
            <div
              v-else
              class="markdown-body"
              v-html="msg.html"
            ></div>
          </div>
        </div>

        <!-- AI 打字指示器 -->
        <div v-if="chatStore.isTyping" class="flex gap-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white">
            AI
          </div>
          <div class="flex items-center gap-1 rounded-2xl rounded-tl-md bg-white px-4 py-3 shadow-sm ring-1 ring-gray-200/60">
            <span class="h-2 w-2 animate-bounce rounded-full bg-gray-400" style="animation-delay: 0ms"></span>
            <span class="h-2 w-2 animate-bounce rounded-full bg-gray-400" style="animation-delay: 150ms"></span>
            <span class="h-2 w-2 animate-bounce rounded-full bg-gray-400" style="animation-delay: 300ms"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ 底部输入区 ═══ -->
    <div class="border-t border-gray-200 bg-white px-4 py-4">
      <div class="mx-auto max-w-3xl">
        <div class="flex items-end gap-3 rounded-2xl border border-gray-300 bg-white px-4 py-3 shadow-sm transition-colors focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
          <textarea
            ref="inputRef"
            v-model="inputText"
            rows="1"
            placeholder="输入你的问题… (Shift+Enter 换行，Enter 发送)"
            class="max-h-32 flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
            @keydown="handleKeydown"
          ></textarea>
          <button
            :disabled="!inputText.trim() || chatStore.isTyping"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            @click="sendMessage"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p class="mt-2 text-center text-xs text-gray-400">
          AI 生成内容仅供参考，请结合实际情况判断
        </p>
      </div>
    </div>
  </div>
</template>

<style>
/* ── Markdown 渲染样式 ── */
.markdown-body h2 {
  margin-top: 1.25em;
  margin-bottom: 0.5em;
  font-size: 1.05em;
  font-weight: 600;
  color: #1f2937;
  border-bottom: 1px solid #f3f4f6;
  padding-bottom: 0.3em;
}
.markdown-body h2:first-child {
  margin-top: 0;
}
.markdown-body p {
  margin: 0.5em 0;
  line-height: 1.7;
}
.markdown-body strong {
  font-weight: 600;
  color: #111827;
}
.markdown-body ul,
.markdown-body ol {
  padding-left: 1.5em;
  margin: 0.5em 0;
}
.markdown-body li {
  margin: 0.25em 0;
}

/* 表格 */
.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75em 0;
  font-size: 0.85em;
}
.markdown-body th {
  background: #f9fafb;
  font-weight: 600;
  text-align: left;
  padding: 0.6em 0.8em;
  border: 1px solid #e5e7eb;
  color: #374151;
}
.markdown-body td {
  padding: 0.5em 0.8em;
  border: 1px solid #e5e7eb;
  color: #4b5563;
}
.markdown-body tr:hover td {
  background: #f9fafb;
}

/* 行内代码 */
.markdown-body code:not(.hljs) {
  background: #f3f4f6;
  color: #e11d48;
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.88em;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
}

/* 代码块 */
.markdown-body .hljs-code-block {
  margin: 0.75em 0;
  border-radius: 10px;
  overflow-x: auto;
  background: #f6f8fa;
  border: 1px solid #e5e7eb;
}
.markdown-body .hljs-code-block code {
  display: block;
  padding: 1em 1.2em;
  font-size: 0.82em;
  line-height: 1.6;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  color: #24292e;
  background: transparent;
}

/* ── MathJax SVG 公式样式 ── */
.markdown-body mjx-container {
  display: inline-block;
  margin: 0.5em 0;
  overflow-x: auto;
  overflow-y: hidden;
  max-width: 100%;
}
.markdown-body mjx-container[jax="SVG"] {
  display: block;
  text-align: center;
  margin: 0.75em 0;
}
.markdown-body mjx-container svg {
  display: inline-block;
  max-width: 100%;
}
</style>

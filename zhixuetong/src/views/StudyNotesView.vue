<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import mathjax3 from 'markdown-it-mathjax3'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useNavStore } from '@/stores/nav'

import 'highlight.js/styles/github.css'

const API = import.meta.env.VITE_API_BASE_URL
const auth = useAuthStore()
const nav = useNavStore()

const md = new MarkdownIt({
  html: false, linkify: true, typographer: true,
  highlight(str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try { return `<pre class="hljs-code-block"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>` } catch { /* */ }
    }
    return `<pre class="hljs-code-block"><code>${md.utils.escapeHtml(str)}</code></pre>`
  },
})
md.use(mathjax3)

// ── 类型 ──
interface TreeNode {
  id: string; title: string; content: string; parentId: string; sort: number
  createdAt: string; updatedAt: string; children: TreeNode[]
}
interface FlatNode { id: string; title: string; hasChildren: boolean; depth: number; expanded: boolean }
interface NoteDetail {
  id: string; title: string; content: string; parentId: string
  breadcrumb: { id: string; title: string }[]
  createdAt: string; updatedAt: string
}
interface SearchResult { id: string; title: string; parentId: string }

// ── 状态 ──
const tree = ref<TreeNode[]>([])
const expandedSet = ref<Set<string>>(new Set())
const currentNote = ref<NoteDetail | null>(null)
const title = ref('')
const content = ref('')
const previewMode = ref<'edit' | 'preview'>('edit')
const saving = ref(false)
const loading = ref(false)

// ── 链接搜索 ──
const linkSearchQuery = ref('')
const linkSearchResults = ref<SearchResult[]>([])
const showLinkSearch = ref(false)
const linkSearchPos = ref({ top: 0, left: 0 })

// ── 浏览历史栈 ──
const historyStack = ref<string[]>([])
const historyIndex = ref(-1)

// ── 新建/重命名 ──
const showNewModal = ref(false)
const newType = ref<'note' | 'folder'>('note')
const newParentId = ref('')
const newName = ref('')

const showRenameModal = ref(false)
const renameTargetId = ref('')
const renameName = ref('')

// ── 反向链接 ──
interface Backlink { id: string; title: string; parentId: string; context: string }
const backlinks = ref<Backlink[]>([])
const backlinksExpanded = ref(false)

// ── AI 概念与关联 ──
interface AIConcept { name: string; summary: string }
interface AIRelatedLink { source: string; target: string; type: string; label: string; sourceTitle: string; targetTitle: string }
const aiConcepts = ref<AIConcept[]>([])
const aiRelatedLinks = ref<AIRelatedLink[]>([])
const aiConceptsExpanded = ref(false)
const analyzingNote = ref(false)

// ── 扁平化树（用于渲染） ──
const flatList = computed<FlatNode[]>(() => {
  const result: FlatNode[] = []
  function walk(nodes: TreeNode[], depth: number) {
    for (const n of nodes) {
      const expanded = expandedSet.value.has(n.id)
      result.push({ id: n.id, title: n.title, hasChildren: n.children.length > 0, depth, expanded })
      if (expanded && n.children.length > 0) walk(n.children, depth + 1)
    }
  }
  walk(tree.value, 0)
  return result
})

// ── Markdown 渲染（处理 [[链接]] 语法） ──
const previewHtml = computed(() => {
  let raw = content.value || ''
  raw = raw.replace(/\[\[id:([^|]+)\|([^\]]+)\]\]/g, '<span class="note-link" data-note-id="$1">$2</span>')
  raw = raw.replace(/\[\[([^\]]+)\]\]/g, '<span class="note-link-pending">$1</span>')
  return md.render(raw)
})

// ── 加载树 ──
async function loadTree() {
  const { data } = await axios.get(`${API}/api/notes/tree`, { params: { username: auth.username } })
  tree.value = data
}

// ── 展开/折叠 ──
function toggleExpand(id: string) {
  const s = new Set(expandedSet.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandedSet.value = s
}

// ── 加载反向链接 ──
async function loadBacklinks(id: string) {
  try {
    const { data } = await axios.get(`${API}/api/notes/${id}/backlinks`, { params: { username: auth.username } })
    backlinks.value = data
  } catch { backlinks.value = [] }
}

// ── 加载 AI 概念与关联 ──
async function loadAIConcepts(id: string) {
  try {
    const { data } = await axios.get(`${API}/api/notes/${id}/concepts`, { params: { username: auth.username } })
    aiConcepts.value = data.concepts || []
    aiRelatedLinks.value = data.relatedLinks || []
  } catch { aiConcepts.value = []; aiRelatedLinks.value = [] }
}

// ── AI 分析当前笔记 ──
async function analyzeCurrentNote() {
  if (analyzingNote.value || !currentNote.value) return
  analyzingNote.value = true
  try {
    await axios.post(`${API}/api/notes/analyze`, { username: auth.username }, { timeout: 600000 })
    // 重新加载当前笔记的 AI 数据
    await loadAIConcepts(currentNote.value.id)
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? err.response?.data?.detail || err.message : '未知错误'
    alert('AI 分析失败：' + msg)
  } finally {
    analyzingNote.value = false
  }
}

function aiLinkTypeLabel(type: string) {
  const map: Record<string, string> = { prerequisite: '前置知识', extends: '延伸扩展', related: '相关概念', application: '应用场景' }
  return map[type] || type
}

// ── 打开笔记 ──
async function openNote(id: string) {
  loading.value = true
  try {
    const { data } = await axios.get(`${API}/api/notes/${id}`, { params: { username: auth.username } })
    currentNote.value = data
    title.value = data.title
    content.value = data.content
    previewMode.value = 'edit'
    loadBacklinks(id)
    loadAIConcepts(id)
    if (historyStack.value[historyIndex.value] !== id) {
      historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)
      historyStack.value.push(id)
      if (historyStack.value.length > 50) historyStack.value.shift()
      historyIndex.value = historyStack.value.length - 1
    }
  } finally {
    loading.value = false
  }
}

// ── 返回/前进 ──
function goBack() {
  if (historyIndex.value > 0) { historyIndex.value--; loadNoteDirect(historyStack.value[historyIndex.value]) }
}
function goForward() {
  if (historyIndex.value < historyStack.value.length - 1) { historyIndex.value++; loadNoteDirect(historyStack.value[historyIndex.value]) }
}
async function loadNoteDirect(id: string) {
  loading.value = true
  try {
    const { data } = await axios.get(`${API}/api/notes/${id}`, { params: { username: auth.username } })
    currentNote.value = data; title.value = data.title; content.value = data.content
  } finally { loading.value = false }
}

// ── 保存 ──
async function saveNote() {
  if (!currentNote.value || !title.value.trim()) return
  saving.value = true
  await axios.put(`${API}/api/notes/${currentNote.value.id}`, { username: auth.username, title: title.value.trim(), content: content.value })
  saving.value = false
  await loadTree()
}

// ── 新建 ──
function openNew(type: 'note' | 'folder', parentId: string) {
  newType.value = type; newParentId.value = parentId; newName.value = ''; showNewModal.value = true
}

async function createNote() {
  if (!newName.value.trim()) return
  const { data } = await axios.post(`${API}/api/notes`, { username: auth.username, title: newName.value.trim(), parentId: newParentId.value, content: '' })
  showNewModal.value = false
  // 自动展开父节点
  if (newParentId.value) {
    const s = new Set(expandedSet.value); s.add(newParentId.value); expandedSet.value = s
  }
  await loadTree()
  openNote(data.id)
}

// ── 重命名 ──
function openRename(id: string, currentTitle: string) {
  renameTargetId.value = id; renameName.value = currentTitle; showRenameModal.value = true
}

async function doRename() {
  if (!renameName.value.trim()) return
  await axios.put(`${API}/api/notes/${renameTargetId.value}`, { username: auth.username, title: renameName.value.trim() })
  showRenameModal.value = false
  await loadTree()
  if (currentNote.value?.id === renameTargetId.value) title.value = renameName.value.trim()
}

// ── 删除 ──
async function deleteNoteNode(id: string, nodeTitle: string) {
  if (!confirm(`确定删除「${nodeTitle}」及其所有子笔记吗？`)) return
  await axios.delete(`${API}/api/notes/${id}`, { params: { username: auth.username } })
  if (currentNote.value?.id === id) currentNote.value = null
  await loadTree()
}

// ── 链接搜索 ──
function onContentInput(e: Event) {
  const textarea = e.target as HTMLTextAreaElement
  const cursor = textarea.selectionStart
  const before = textarea.value.slice(Math.max(0, cursor - 2), cursor)
  if (before === '[[') {
    const rect = textarea.getBoundingClientRect()
    linkSearchPos.value = { top: rect.top + 24, left: rect.left + 20 }
    linkSearchQuery.value = ''; linkSearchResults.value = []; showLinkSearch.value = true
    nextTick(() => document.getElementById('link-search-input')?.focus())
  }
}

async function searchLinks() {
  if (!linkSearchQuery.value.trim()) { linkSearchResults.value = []; return }
  const { data } = await axios.get(`${API}/api/notes/search`, { params: { username: auth.username, q: linkSearchQuery.value } })
  linkSearchResults.value = data
}

function insertLink(note: SearchResult) {
  const textarea = document.querySelector('textarea') as HTMLTextAreaElement
  if (!textarea) return
  const cursor = textarea.selectionStart
  const before = content.value.slice(0, cursor)
  const after = content.value.slice(cursor)
  const linkStart = before.lastIndexOf('[[')
  content.value = before.slice(0, linkStart) + `[[id:${note.id}|${note.title}]]` + after
  showLinkSearch.value = false
  nextTick(() => {
    const pos = linkStart + `[[id:${note.id}|${note.title}]]`.length
    textarea.setSelectionRange(pos, pos); textarea.focus()
  })
}

function onPreviewClick(e: Event) {
  const target = e.target as HTMLElement
  if (target.classList.contains('note-link')) {
    const id = target.dataset.noteId
    if (id) openNote(id)
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const canGoBack = computed(() => historyIndex.value > 0)
const canGoForward = computed(() => historyIndex.value < historyStack.value.length - 1)

onMounted(async () => {
  await loadTree()
  const pendingId = nav.consumeNoteId()
  if (pendingId) openNote(pendingId)
})
watch(() => auth.username, loadTree)
</script>

<template>
  <div class="flex h-full gap-4">
    <!-- ═══ 左侧：树形导航 ═══ -->
    <div class="flex w-60 shrink-0 flex-col rounded-xl bg-white shadow-sm ring-1 ring-gray-200/50 overflow-hidden">
      <div class="flex items-center justify-between border-b border-gray-100 px-3 py-2.5">
        <h3 class="text-sm font-semibold text-gray-800">📚 笔记</h3>
        <div class="flex gap-1">
          <button class="rounded p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" title="新建笔记" @click="openNew('note', '')">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
          </button>
          <button class="rounded p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" title="新建文件夹" @click="openNew('folder', '')">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto py-1">
        <div v-if="flatList.length === 0" class="px-4 py-8 text-center text-xs text-gray-400">还没有笔记</div>
        <div v-for="node in flatList" :key="node.id"
          class="group flex items-center gap-1.5 rounded-md px-2 py-1 cursor-pointer text-sm transition-colors"
          :class="currentNote?.id === node.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'"
          :style="{ paddingLeft: (node.depth * 16 + 8) + 'px' }">
          <!-- 展开箭头 -->
          <button v-if="node.hasChildren" class="shrink-0 p-0.5 text-gray-400 hover:text-gray-600" @click.stop="toggleExpand(node.id)">
            <svg class="h-3 w-3 transition-transform" :class="{ 'rotate-90': node.expanded }" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <span v-else class="w-4 shrink-0"></span>
          <!-- 图标 -->
          <span class="shrink-0 text-xs">{{ node.hasChildren ? (node.expanded ? '📂' : '📁') : '📄' }}</span>
          <!-- 标题 -->
          <span class="truncate flex-1" @click="openNote(node.id)">{{ node.title }}</span>
          <!-- 操作 -->
          <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button class="rounded p-0.5 text-gray-300 hover:text-indigo-500" title="新建子笔记" @click.stop="openNew('note', node.id)">
              <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </button>
            <button class="rounded p-0.5 text-gray-300 hover:text-indigo-500" title="重命名" @click.stop="openRename(node.id, node.title)">
              <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
            </button>
            <button class="rounded p-0.5 text-gray-300 hover:text-red-500" title="删除" @click.stop="deleteNoteNode(node.id, node.title)">
              <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ 右侧：编辑区 ═══ -->
    <div class="flex flex-1 flex-col rounded-xl bg-white shadow-sm ring-1 ring-gray-200/50 overflow-hidden">
      <!-- 空状态 -->
      <div v-if="!currentNote" class="flex flex-1 flex-col items-center justify-center text-gray-400">
        <svg class="h-16 w-16 mb-4 text-gray-200" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
        <p class="text-sm">选择左侧笔记开始编辑</p>
      </div>

      <!-- 加载中 -->
      <div v-else-if="loading" class="flex flex-1 items-center justify-center">
        <svg class="h-8 w-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      </div>

      <!-- 编辑器 -->
      <template v-else>
        <!-- 面包屑 + 工具栏 -->
        <div class="flex items-center gap-2 border-b border-gray-100 px-4 py-2">
          <button :disabled="!canGoBack" class="rounded p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" @click="goBack" title="返回">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          </button>
          <button :disabled="!canGoForward" class="rounded p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" @click="goForward" title="前进">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
          </button>
          <div class="mx-2 h-4 w-px bg-gray-200"></div>
          <nav class="flex items-center gap-1 text-xs text-gray-500 min-w-0">
            <button v-for="bc in currentNote.breadcrumb" :key="bc.id"
              class="truncate max-w-[120px] hover:text-indigo-600" @click="openNote(bc.id)">{{ bc.title }}</button>
            <span v-if="currentNote.breadcrumb.length > 0" class="text-gray-300">/</span>
            <span class="truncate font-medium text-gray-800 max-w-[150px]">{{ title }}</span>
          </nav>
          <div class="ml-auto flex items-center gap-1">
            <div class="flex rounded bg-gray-100 p-0.5">
              <button class="rounded px-2 py-0.5 text-xs font-medium" :class="previewMode === 'edit' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'" @click="previewMode = 'edit'">编辑</button>
              <button class="rounded px-2 py-0.5 text-xs font-medium" :class="previewMode === 'preview' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'" @click="previewMode = 'preview'">预览</button>
            </div>
            <button :disabled="saving" class="ml-2 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50" @click="saveNote">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>

        <!-- 标题 -->
        <div class="border-b border-gray-50 px-6 py-3">
          <input v-model="title" placeholder="笔记标题" class="w-full text-xl font-semibold text-gray-800 placeholder-gray-300 outline-none bg-transparent" />
          <p class="mt-1 text-xs text-gray-400">最后编辑：{{ formatDate(currentNote.updatedAt) }}</p>
          <!-- AI 概念标签 -->
          <div v-if="aiConcepts.length > 0" class="mt-2 flex items-center gap-2 flex-wrap">
            <span class="text-xs text-purple-500 font-medium">🏷️ AI 概念：</span>
            <span v-for="c in aiConcepts" :key="c.name"
              class="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs text-purple-700 border border-purple-200"
              :title="c.summary"
            >{{ c.name }}</span>
          </div>
        </div>

        <!-- 内容区 -->
        <div class="flex-1 overflow-hidden">
          <textarea v-if="previewMode === 'edit'" v-model="content" @input="onContentInput"
            placeholder="写点什么...（输入 [[ 可插入笔记链接）"
            class="h-full w-full resize-none px-6 py-4 text-sm leading-relaxed text-gray-800 placeholder-gray-400 outline-none"></textarea>
          <div v-else class="markdown-body h-full overflow-y-auto px-6 py-4" @click="onPreviewClick" v-html="previewHtml"></div>
        </div>

        <!-- 反向链接面板 -->
        <div v-if="backlinks.length > 0" class="border-t border-gray-100">
          <button class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            @click="backlinksExpanded = !backlinksExpanded">
            <svg class="h-4 w-4 text-gray-400 transition-transform" :class="{ 'rotate-90': backlinksExpanded }" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span>📎 被以下笔记引用</span>
            <span class="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">{{ backlinks.length }}</span>
          </button>
          <div v-show="backlinksExpanded" class="border-t border-gray-50 px-4 py-2 space-y-1 max-h-32 overflow-y-auto">
            <button v-for="bl in backlinks" :key="bl.id"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              @click="openNote(bl.id)">
              <span class="text-xs text-gray-400">📄</span>
              <span class="font-medium">{{ bl.title }}</span>
              <span class="text-xs text-gray-400 truncate">— "{{ bl.context }}"</span>
            </button>
          </div>
        </div>

        <!-- AI 关联面板 -->
        <div v-if="aiRelatedLinks.length > 0" class="border-t border-gray-100">
          <button class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            @click="aiConceptsExpanded = !aiConceptsExpanded">
            <svg class="h-4 w-4 text-gray-400 transition-transform" :class="{ 'rotate-90': aiConceptsExpanded }" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span>🤖 AI 发现关联</span>
            <span class="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-600">{{ aiRelatedLinks.length }}</span>
          </button>
          <div v-show="aiConceptsExpanded" class="border-t border-gray-50 px-4 py-2 space-y-1 max-h-40 overflow-y-auto">
            <button v-for="link in aiRelatedLinks" :key="link.source + link.target"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-purple-50 hover:text-purple-700 transition-colors"
              :class="link.source === currentNote?.id ? 'text-gray-700' : 'text-gray-700'"
              @click="openNote(link.source === currentNote?.id ? link.target : link.source)">
              <span class="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium"
                :class="{
                  'bg-blue-50 text-blue-600': link.type === 'prerequisite',
                  'bg-green-50 text-green-600': link.type === 'extends',
                  'bg-purple-50 text-purple-600': link.type === 'related',
                  'bg-amber-50 text-amber-600': link.type === 'application',
                }"
              >{{ aiLinkTypeLabel(link.type) }}</span>
              <span class="font-medium">{{ link.source === currentNote?.id ? link.targetTitle : link.sourceTitle }}</span>
              <span class="text-xs text-gray-400 truncate">— {{ link.label }}</span>
            </button>
          </div>
        </div>

        <!-- AI 分析按钮（无数据时显示） -->
        <div v-if="aiConcepts.length === 0 && aiRelatedLinks.length === 0 && !analyzingNote" class="border-t border-gray-100 px-4 py-2.5">
          <button
            class="flex items-center gap-2 text-xs text-purple-500 hover:text-purple-700 transition-colors"
            @click="analyzeCurrentNote"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            AI 分析全部笔记，发现隐藏关联
          </button>
        </div>
        <div v-if="analyzingNote" class="border-t border-gray-100 px-4 py-2.5 flex items-center gap-2 text-xs text-purple-500">
          <svg class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          AI 正在分析...
        </div>

        <!-- 链接搜索浮层 -->
        <div v-if="showLinkSearch" class="fixed inset-0 z-40" @click="showLinkSearch = false"></div>
        <div v-if="showLinkSearch" class="fixed z-50 w-72 rounded-xl bg-white shadow-xl ring-1 ring-gray-200 p-2"
          :style="{ top: linkSearchPos.top + 'px', left: linkSearchPos.left + 'px' }">
          <input id="link-search-input" v-model="linkSearchQuery" @input="searchLinks"
            placeholder="搜索笔记标题..." class="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-500" />
          <div class="mt-1 max-h-40 overflow-y-auto">
            <button v-for="r in linkSearchResults" :key="r.id" class="w-full rounded-lg px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-indigo-50" @click="insertLink(r)">{{ r.title }}</button>
            <p v-if="linkSearchQuery && linkSearchResults.length === 0" class="px-3 py-2 text-xs text-gray-400">未找到</p>
          </div>
        </div>
      </template>
    </div>

    <!-- ═══ 新建弹窗 ═══ -->
    <div v-if="showNewModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" @click.self="showNewModal = false">
      <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 class="mb-4 text-lg font-semibold text-gray-800">{{ newType === 'folder' ? '新建文件夹' : '新建笔记' }}</h3>
        <input v-model="newName" :placeholder="newType === 'folder' ? '文件夹名称' : '笔记标题'" @keydown.enter="createNote"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" autofocus />
        <div class="mt-4 flex justify-end gap-2">
          <button class="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100" @click="showNewModal = false">取消</button>
          <button class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50" :disabled="!newName.trim()" @click="createNote">创建</button>
        </div>
      </div>
    </div>

    <!-- ═══ 重命名弹窗 ═══ -->
    <div v-if="showRenameModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" @click.self="showRenameModal = false">
      <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 class="mb-4 text-lg font-semibold text-gray-800">重命名</h3>
        <input v-model="renameName" @keydown.enter="doRename"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" autofocus />
        <div class="mt-4 flex justify-end gap-2">
          <button class="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100" @click="showRenameModal = false">取消</button>
          <button class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50" :disabled="!renameName.trim()" @click="doRename">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.markdown-body h2 { margin-top: 1.25em; margin-bottom: 0.5em; font-size: 1.1em; font-weight: 600; color: #1f2937; border-bottom: 1px solid #f3f4f6; padding-bottom: 0.3em; }
.markdown-body h2:first-child { margin-top: 0; }
.markdown-body h3 { margin-top: 1em; margin-bottom: 0.4em; font-size: 1em; font-weight: 600; color: #374151; }
.markdown-body p { margin: 0.5em 0; line-height: 1.7; }
.markdown-body strong { font-weight: 600; color: #111827; }
.markdown-body ul, .markdown-body ol { padding-left: 1.5em; margin: 0.5em 0; }
.markdown-body li { margin: 0.25em 0; }
.markdown-body table { width: 100%; border-collapse: collapse; margin: 0.75em 0; font-size: 0.85em; }
.markdown-body th { background: #f9fafb; font-weight: 600; text-align: left; padding: 0.6em 0.8em; border: 1px solid #e5e7eb; color: #374151; }
.markdown-body td { padding: 0.5em 0.8em; border: 1px solid #e5e7eb; color: #4b5563; }
.markdown-body code:not(.hljs) { background: #f3f4f6; color: #e11d48; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.88em; }
.markdown-body .hljs-code-block { margin: 0.75em 0; border-radius: 10px; overflow-x: auto; background: #f6f8fa; border: 1px solid #e5e7eb; }
.markdown-body .hljs-code-block code { display: block; padding: 1em 1.2em; font-size: 0.82em; line-height: 1.6; color: #24292e; background: transparent; }
.markdown-body mjx-container { display: inline-block; margin: 0.5em 0; overflow-x: auto; max-width: 100%; }
.markdown-body mjx-container[jax="SVG"] { display: block; text-align: center; margin: 0.75em 0; }
.note-link { color: #4f46e5; cursor: pointer; text-decoration: underline; text-decoration-color: #a5b4fc; text-underline-offset: 2px; }
.note-link:hover { color: #4338ca; }
.note-link-pending { color: #9ca3af; font-style: italic; }
</style>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useNavStore } from '@/stores/nav'

const API = import.meta.env.VITE_API_BASE_URL
const router = useRouter()
const auth = useAuthStore()
const nav = useNavStore()

interface GraphNode { id: string; title: string; parentId: string; topId: string; linkCount: number }
interface GraphEdge { source: string; target: string }
interface TopFolder { id: string; title: string }
interface AIEdge { source: string; target: string; type: string; label: string; ai: boolean }
interface ConceptNode { id: string; name: string; noteId: string; summary: string; topId: string; isConcept: boolean; linkCount: number }

const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const nodes = ref<GraphNode[]>([])
const edges = ref<GraphEdge[]>([])
const topFolders = ref<TopFolder[]>([])
const aiEdges = ref<AIEdge[]>([])
const conceptNodes = ref<ConceptNode[]>([])
const aiAnalyzed = ref(false)
const analyzedAt = ref('')
const activeFilter = ref<string>('all')
const loading = ref(true)
const analyzing = ref(false)
const showAiLinks = ref(true)
const showConcepts = ref(false)

// ── 预设颜色 ──
const FOLDER_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f97316']
const AI_LINK_COLORS: Record<string, string> = {
  prerequisite: '#3b82f6',
  extends: '#10b981',
  related: '#8b5cf6',
  application: '#f59e0b',
  has_concept: '#ec4899',
}
const AI_LINK_LABELS: Record<string, string> = {
  prerequisite: '前置知识',
  extends: '延伸扩展',
  related: '相关概念',
  application: '应用场景',
  has_concept: '核心概念',
}
const colorMap = ref<Map<string, string>>(new Map())

// ── 加载图谱数据 ──
async function loadGraph() {
  loading.value = true
  const { data } = await axios.get(`${API}/api/notes/graph`, { params: { username: auth.username } })
  nodes.value = data.nodes || []
  edges.value = data.edges || []
  topFolders.value = data.topFolders || []
  aiEdges.value = data.aiEdges || []
  conceptNodes.value = data.conceptNodes || []
  aiAnalyzed.value = data.aiAnalyzed || false
  analyzedAt.value = data.analyzedAt || ''

  // 为每个顶层文件夹分配颜色
  const cm = new Map<string, string>()
  data.topFolders.forEach((f: TopFolder, i: number) => {
    cm.set(f.id, FOLDER_COLORS[i % FOLDER_COLORS.length])
  })
  colorMap.value = cm

  loading.value = false
  await nextTick()
  renderChart()
}

// ── AI 智能分析（增量） ──
async function runAiAnalysis(force = false) {
  if (analyzing.value) return
  analyzing.value = true
  try {
    const { data } = await axios.post(`${API}/api/notes/analyze`, { username: auth.username, force }, { timeout: 600000 })
    if (data.skipped) {
      alert('所有笔记已是最新分析，无需重复分析。')
      analyzing.value = false
      return
    }
    nodes.value = data.nodes || []
    edges.value = data.edges || []
    topFolders.value = data.topFolders || []
    aiEdges.value = data.aiEdges || []
    conceptNodes.value = data.conceptNodes || []
    aiAnalyzed.value = data.aiAnalyzed || false
    analyzedAt.value = data.analyzedAt || ''
    // 更新颜色映射
    const cm = new Map<string, string>()
    data.topFolders.forEach((f: TopFolder, i: number) => {
      cm.set(f.id, FOLDER_COLORS[i % FOLDER_COLORS.length])
    })
    colorMap.value = cm
    await nextTick()
    renderChart()
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? err.response?.data?.detail || err.message : '未知错误'
    alert('AI 分析失败：' + msg)
  } finally {
    analyzing.value = false
  }
}

// ── 渲染图表 ──
function renderChart() {
  if (!chartRef.value) return
  if (chart) { chart.dispose(); chart = null }

  const container = chartRef.value
  const rect = container.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    requestAnimationFrame(() => renderChart())
    return
  }

  // 核心修复：用显式尺寸初始化，确保 canvas 填满整个容器
  chart = echarts.init(container, null, {
    width: rect.width,
    height: rect.height,
  })

  // 让 ECharts 内部的 canvas 接收所有指针事件
  const canvas = container.querySelector('canvas')
  if (canvas) {
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.cursor = 'grab'
  }

  // 监听容器尺寸变化，canvas 始终跟随
  if (resizeObserver) resizeObserver.disconnect()
  resizeObserver = new ResizeObserver(() => {
    if (chart && container) {
      const r = container.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        chart.resize({ width: r.width, height: r.height })
      }
    }
  })
  resizeObserver.observe(container)

  // ── 筛选节点 ──
  const filteredNodes = activeFilter.value === 'all'
    ? nodes.value
    : nodes.value.filter((n) => n.topId === activeFilter.value)

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id))

  // 手动链接
  const filteredManualEdges = edges.value.filter(
    (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target),
  )

  // AI 链接（只保留两端都在筛选节点中的）
  const filteredAIEdges = showAiLinks.value
    ? aiEdges.value.filter(
        (e) => {
          // has_concept 边：source 是笔记，target 是概念节点
          if (e.type === 'has_concept') {
            return showConcepts.value && filteredNodeIds.has(e.source)
          }
          return filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
        },
      )
    : []

  // 概念节点（只保留其父笔记在筛选节点中的）
  const filteredConcepts = showConcepts.value
    ? conceptNodes.value.filter((c) => filteredNodeIds.has(c.noteId))
    : []

  // ── 构建 ECharts nodes ──
  const chartNodes: Array<{
    id: string
    name: string
    symbolSize: number
    symbol: string
    itemStyle: { color: string; borderColor: string; borderWidth: number; borderType?: string }
    label: { show: boolean; fontSize: number; color: string; formatter?: string }
    category?: number
    tooltip?: string
  }> = []

  // 笔记节点
  for (const n of filteredNodes) {
    chartNodes.push({
      id: n.id,
      name: n.title,
      symbolSize: Math.max(18, 12 + n.linkCount * 5),
      symbol: 'circle',
      itemStyle: {
        color: colorMap.value.get(n.topId) || '#9ca3af',
        borderColor: '#fff',
        borderWidth: 2,
      },
      label: { show: true, fontSize: 10, color: '#4b5563' },
    })
  }

  // 概念节点
  for (const c of filteredConcepts) {
    const parentColor = colorMap.value.get(c.topId) || '#9ca3af'
    chartNodes.push({
      id: c.id,
      name: c.name,
      symbolSize: 12,
      symbol: 'diamond',
      itemStyle: {
        color: parentColor + '25',
        borderColor: parentColor + '80',
        borderWidth: 1,
        borderType: 'dashed',
      },
      label: { show: true, fontSize: 7, color: '#9ca3af' },
      tooltip: c.summary,
    })
  }

  // ── 构建 ECharts links ──
  const chartLinks: Array<{
    source: string
    target: string
    lineStyle: { color: string; width: number; curveness: number; type: string }
    label?: { show: boolean; fontSize: number; color: string; formatter: string }
  }> = []

  // 手动链接
  for (const e of filteredManualEdges) {
    chartLinks.push({
      source: e.source,
      target: e.target,
      lineStyle: { color: '#e5e7eb', width: 1, curveness: 0.2, type: 'solid' },
    })
  }

  // AI 链接
  for (const e of filteredAIEdges) {
    chartLinks.push({
      source: e.source,
      target: e.target,
      lineStyle: {
        color: AI_LINK_COLORS[e.type] || '#8b5cf6',
        width: 1.2,
        curveness: 0.3,
        type: 'dashed',
      },
      label: {
        show: false,
        fontSize: 8,
        color: AI_LINK_COLORS[e.type] || '#8b5cf6',
        formatter: e.type !== 'has_concept' ? (e.label || AI_LINK_LABELS[e.type] || '') : '',
      },
    })
  }

  const allNodes = [...filteredNodes, ...filteredConcepts]
  const hasContent = allNodes.length > 0

  chart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: '#fff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 13 },
      formatter: (params: { dataType?: string; name?: string; data?: { id: string; tooltip?: string } }) => {
        if (params.dataType === 'node' && params.data) {
          // 概念节点
          if (params.data.tooltip) {
            return `<strong>📌 ${params.name}</strong><br/><span style="color:#6b7280;font-size:12px">${params.data.tooltip}</span>`
          }
          // 笔记节点
          const node = nodes.value.find((n) => n.id === params.data?.id)
          const conceptItems = conceptNodes.value.filter((c) => c.noteId === params.data?.id)
          let html = `<strong>📄 ${params.name}</strong><br/>被引用 ${node?.linkCount || 0} 次`
          if (conceptItems.length > 0) {
            html += `<br/><span style="color:#8b5cf6;font-size:11px">🏷️ AI 提取概念：${conceptItems.map((c) => c.name).join('、')}</span>`
          }
          html += `<br/><span style="color:#9ca3af;font-size:12px">点击跳转到笔记</span>`
          return html
        }
        if (params.dataType === 'edge' && params.data) {
          const edgeData = params.data as { label?: { formatter?: string } }
          return edgeData.label?.formatter || ''
        }
        return ''
      },
    },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      scaleLimit: { min: 0.05, max: 10 },
      force: {
        repulsion: hasContent ? 800 : 0,
        gravity: 0.02,
        edgeLength: [50, 280],
        friction: 0.5,
        layoutAnimation: true,
      },
      data: chartNodes,
      links: chartLinks,
      emphasis: {
        focus: 'adjacency',
        lineStyle: { width: 3, color: '#6366f1' },
        edgeLabel: { show: true, fontSize: 10, color: '#374151' },
      },
    }],
  })

  // 点击节点跳转到笔记
  chart.off('click')
  chart.on('click', (params: any) => {
    if (params.dataType === 'node' && params.data) {
      // 概念节点：跳转到其父笔记
      if (params.data.tooltip) {
        const concept = conceptNodes.value.find((c) => c.id === params.data.id)
        if (concept) {
          nav.openNote(concept.noteId)
          router.push('/notes')
        }
        return
      }
      // 笔记节点
      if (params.data.id) {
        nav.openNote(params.data.id)
        router.push('/notes')
      }
    }
  })
}

function handleResize() { chart?.resize() }

function setFilter(id: string) {
  activeFilter.value = id
  renderChart()
}

function toggleAiLinks() {
  showAiLinks.value = !showAiLinks.value
  renderChart()
}

function toggleConcepts() {
  showConcepts.value = !showConcepts.value
  renderChart()
}

onMounted(() => {
  loadGraph()
  window.addEventListener('resize', handleResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null }
  chart?.dispose()
})
watch(() => auth.username, loadGraph)
</script>

<template>
  <div class="flex h-full flex-col gap-4">
    <!-- ═══ 顶部：标题 + AI 分析 + 筛选 ═══ -->
    <div class="shrink-0 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-gray-800">🧠 知识图谱</h2>
          <p class="text-sm text-gray-500">
            <template v-if="aiAnalyzed">AI 已分析 {{ nodes.length }} 个节点、{{ edges.length + aiEdges.length }} 条关联</template>
            <template v-else>笔记链接关系可视化 · 点击「AI 智能分析」发现隐藏关联</template>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <!-- AI 分析按钮 -->
          <div class="flex items-center gap-2">
            <button
              :disabled="analyzing"
              class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-60"
              :class="aiAnalyzed
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700'
                : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 animate-pulse'"
              @click="runAiAnalysis(false)"
            >
              <svg v-if="analyzing" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span v-else>🤖</span>
              {{ analyzing ? 'AI 分析中...' : aiAnalyzed ? '增量分析' : 'AI 智能分析' }}
            </button>
            <button
              v-if="aiAnalyzed"
              :disabled="analyzing"
              class="rounded-xl px-3 py-2.5 text-xs font-medium text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
              title="忽略缓存，重新分析全部笔记"
              @click="runAiAnalysis(true)"
            >全量</button>
          </div>
        </div>
      </div>

      <!-- 筛选标签 -->
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs text-gray-400">筛选：</span>
        <button
          class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          :class="activeFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          @click="setFilter('all')"
        >全部</button>
        <button
          v-for="f in topFolders" :key="f.id"
          class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          :class="activeFilter === f.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          :style="activeFilter === f.id ? { background: colorMap.get(f.id) || '#6366f1' } : {}"
          @click="setFilter(f.id)"
        >{{ f.title }}</button>

        <!-- AI 分析后才显示开关 -->
        <template v-if="aiAnalyzed">
          <span class="ml-4 w-px h-5 bg-gray-200"></span>
          <button
            class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="showAiLinks ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-400'"
            @click="toggleAiLinks"
          >
            <span class="h-2 w-2 rounded-full" :class="showAiLinks ? 'bg-purple-500' : 'bg-gray-300'"></span>
            AI 关联
          </button>
          <button
            class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
            :class="showConcepts ? 'bg-pink-50 text-pink-600' : 'bg-gray-100 text-gray-400'"
            @click="toggleConcepts"
          >
            <span class="h-2 w-2 rotate-45" :class="showConcepts ? 'bg-pink-500' : 'bg-gray-300'"></span>
            概念节点
          </button>
        </template>
      </div>
    </div>

    <!-- ═══ 图谱主区域 ═══ -->
    <div class="relative min-h-0 flex-1 rounded-xl bg-white shadow-sm ring-1 ring-gray-200/50 overflow-hidden">
      <!-- 加载 -->
      <div v-if="loading" class="flex h-full items-center justify-center">
        <svg class="h-8 w-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>

      <!-- 空状态 -->
      <div v-else-if="nodes.length === 0 && !aiAnalyzed" class="flex h-full flex-col items-center justify-center text-gray-400">
        <svg class="h-16 w-16 mb-4 text-gray-200" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.153a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L5.25 9.879" />
        </svg>
        <p class="text-sm">笔记之间还没有链接关系</p>
        <p class="text-xs text-gray-400 mt-1">在笔记中使用 [[ 链接其他笔记，或点击「AI 智能分析」自动发现关联</p>
      </div>

      <!-- ECharts 图谱 -->
      <div v-else ref="chartRef" class="absolute inset-0"></div>

      <!-- AI 分析遮罩 -->
      <div v-if="analyzing" class="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-sm">
        <div class="text-center">
          <svg class="h-10 w-10 mx-auto animate-spin text-indigo-500 mb-3" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p class="text-sm font-medium text-gray-700">🤖 AI 正在分析笔记...</p>
          <p class="text-xs text-gray-400 mt-1">提取概念、发现关联，可能需要 10-30 秒</p>
        </div>
      </div>
    </div>

    <!-- ═══ 底部图例 ═══ -->
    <div v-if="!loading && (nodes.length > 0 || aiAnalyzed)" class="shrink-0 flex items-center gap-4 px-2 flex-wrap">
      <!-- 学科图例 -->
      <span class="text-xs text-gray-400">学科：</span>
      <div v-for="f in topFolders" :key="f.id" class="flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-full" :style="{ background: colorMap.get(f.id) || '#9ca3af' }"></span>
        <span class="text-xs text-gray-600">{{ f.title }}</span>
      </div>

      <template v-if="aiAnalyzed">
        <span class="w-px h-4 bg-gray-200"></span>
        <span class="text-xs text-gray-400">AI 关联：</span>
        <div v-for="(color, type) in AI_LINK_COLORS" :key="type" class="flex items-center gap-1.5">
          <svg class="h-3 w-5" viewBox="0 0 20 12">
            <line x1="0" y1="6" x2="20" y2="6" :stroke="color" stroke-width="2" stroke-dasharray="4 3" />
          </svg>
          <span class="text-xs text-gray-500">{{ AI_LINK_LABELS[type] || type }}</span>
        </div>

        <span class="w-px h-4 bg-gray-200"></span>
        <span class="text-xs text-gray-400">概念：</span>
        <span class="inline-block h-2.5 w-2.5 rotate-45 rounded-sm border border-dashed border-purple-400 bg-purple-100"></span>
        <span class="text-xs text-gray-500">AI 提取概念</span>
      </template>

      <span class="ml-auto text-xs text-gray-400">可拖拽 · 滚轮缩放 · 点击跳转</span>
    </div>
  </div>
</template>

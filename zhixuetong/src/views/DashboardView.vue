<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const API = import.meta.env.VITE_API_BASE_URL
const router = useRouter()
const auth = useAuthStore()

// ── 状态 ──
const checkinStats = ref({
  streak: 0, checkedInToday: false, todayCheckin: null as any,
  calendar: [] as Array<{ date: string; count: number }>,
  totalDays: 0, todayTotal: 0, todayDone: 0, todayAllDone: false,
})
const noteCount = ref(0)
const checkingIn = ref(false)
const checkinNote = ref('')

const weeklyBarRef = ref<HTMLDivElement>()
const heatmapRef = ref<HTMLDivElement>()
let barChart: echarts.ECharts | null = null
let heatmapChart: echarts.ECharts | null = null

// ── 统计卡片 ──
const stats = computed(() => [
  { label: '坚持天数', value: `${checkinStats.value.streak} 天`, emoji: '🔥', bg: 'bg-amber-50', ring: 'ring-amber-100', color: 'text-amber-700' },
  { label: '笔记数量', value: `${noteCount.value} 篇`, emoji: '📝', bg: 'bg-blue-50', ring: 'ring-blue-100', color: 'text-blue-700' },
  { label: '总打卡', value: `${checkinStats.value.totalDays} 天`, emoji: '✅', bg: 'bg-emerald-50', ring: 'ring-emerald-100', color: 'text-emerald-700' },
])

const shortcuts = [
  { label: 'AI 问答', icon: '💬', route: '/ai-qa', bg: 'bg-indigo-50', hover: 'hover:bg-indigo-100' },
  { label: '学习计划', icon: '📅', route: '/study-plan', bg: 'bg-emerald-50', hover: 'hover:bg-emerald-100' },
  { label: '知识图谱', icon: '🧠', route: '/knowledge-graph', bg: 'bg-purple-50', hover: 'hover:bg-purple-100' },
  { label: '记笔记', icon: '✏️', route: '/notes', bg: 'bg-amber-50', hover: 'hover:bg-amber-100' },
]

// ── 今日进度 ──
const todayProgress = computed(() => {
  const { todayTotal, todayDone } = checkinStats.value
  return todayTotal > 0 ? Math.round(todayDone / todayTotal * 100) : 0
})

// ── 加载数据 ──
async function loadAll() {
  const [notesRes, cRes] = await Promise.all([
    axios.get(`${API}/api/notes`, { params: { username: auth.username } }),
    axios.get(`${API}/api/checkins/stats`, { params: { username: auth.username } }),
  ])
  noteCount.value = notesRes.data.length
  checkinStats.value = cRes.data
  await Promise.all([initHeatmap(), initBarChart()])
}

// ── 手动打卡 ──
async function handleCheckin() {
  if (checkingIn.value) return
  checkingIn.value = true
  try {
    const { data } = await axios.post(`${API}/api/checkin`, {
      username: auth.username,
      note: checkinNote.value,
    })
    checkinStats.value = { ...checkinStats.value, ...data.stats, checkedInToday: true, todayCheckin: data }
    checkinNote.value = ''
    initHeatmap()
  } catch (err: unknown) {
    alert('打卡失败')
  } finally {
    checkingIn.value = false
  }
}

// ── 取消今日打卡 ──
async function handleCancelCheckin() {
  if (checkingIn.value) return
  checkingIn.value = true
  try {
    const { data } = await axios.delete(`${API}/api/checkins/today`, {
      params: { username: auth.username },
    })
    checkinStats.value = { ...checkinStats.value, ...data.stats, checkedInToday: false, todayCheckin: null }
    initHeatmap()
  } catch {
    alert('取消失败')
  } finally {
    checkingIn.value = false
  }
}

// ── 打卡日历热力图 ──
async function initHeatmap() {
  if (!heatmapRef.value) return
  if (heatmapChart) heatmapChart.dispose()
  heatmapChart = echarts.init(heatmapRef.value)

  const calendar = checkinStats.value.calendar
  if (calendar.length === 0) return

  // 生成热力图数据
  const data = calendar.map((c) => [c.date, c.count])

  heatmapChart.setOption({
    tooltip: {
      backgroundColor: '#fff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 12 },
      formatter: (params: any) => {
        const d = params.data?.[0] || ''
        const v = params.data?.[1] || 0
        return `${d}<br/>${v ? '✅ 已打卡' : '▢ 未打卡'}`
      },
    },
    calendar: {
      top: 12,
      left: 32,
      right: 16,
      bottom: 4,
      cellSize: ['auto', 14],
      range: [calendar[0]?.date, calendar[calendar.length - 1]?.date],
      splitLine: { lineStyle: { color: '#f3f4f6' } },
      itemStyle: { borderWidth: 3, borderColor: '#fff', borderRadius: 3 },
      yearLabel: { show: false },
      monthLabel: { fontSize: 10, color: '#9ca3af', margin: 4 },
      dayLabel: { fontSize: 10, color: '#9ca3af', margin: 4, nameMap: ['', '一', '', '三', '', '五', ''] },
    },
    visualMap: {
      min: 0, max: 1,
      show: false,
      inRange: { color: ['#f3f4f6', '#10b981'] },
    },
    series: [{
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data,
      emphasis: {
        itemStyle: { shadowBlur: 8, shadowColor: 'rgba(16,185,129,0.4)' },
      },
    }],
  })
}

// ── 周完成柱状图（复用原逻辑） ──
async function initBarChart() {
  if (!weeklyBarRef.value) return
  if (barChart) barChart.dispose()
  barChart = echarts.init(weeklyBarRef.value)

  const statsRes = await axios.get(`${API}/api/tasks/stats`, { params: { username: auth.username } })
  const weekly = statsRes.data.weekly || []

  barChart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e5e7eb', borderWidth: 1, textStyle: { color: '#374151', fontSize: 13 } },
    grid: { top: 20, right: 16, bottom: 24, left: 36 },
    xAxis: { type: 'category', data: weekly.map((d: any) => d.label), axisLine: { lineStyle: { color: '#e5e7eb' } }, axisTick: { show: false }, axisLabel: { color: '#6b7280', fontSize: 11 } },
    yAxis: { type: 'value', name: '任务数', nameTextStyle: { color: '#9ca3af', fontSize: 10 }, splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } }, axisLabel: { color: '#9ca3af', fontSize: 11 }, minInterval: 1 },
    series: [{
      name: '完成任务', type: 'bar', data: weekly.map((d: any) => d.done), barWidth: '40%',
      itemStyle: { borderRadius: [6, 6, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#818cf8' }, { offset: 1, color: '#6366f1' }]) },
    }],
  })
}

function handleResize() {
  barChart?.resize()
  heatmapChart?.resize()
}

onMounted(() => { loadAll(); window.addEventListener('resize', handleResize) })
onBeforeUnmount(() => { window.removeEventListener('resize', handleResize); barChart?.dispose(); heatmapChart?.dispose() })
</script>

<template>
  <div class="space-y-5">
    <!-- ═══ 打卡卡片 ═══ -->
    <div
      class="rounded-2xl p-6 shadow-md ring-1 transition-all"
      :class="checkinStats.checkedInToday
        ? 'bg-gradient-to-br from-emerald-50 to-teal-50 ring-emerald-200'
        : 'bg-gradient-to-br from-indigo-50 to-purple-50 ring-indigo-200'"
    >
      <div class="flex items-center gap-6">
        <!-- 打卡按钮 -->
        <button
          v-if="!checkinStats.checkedInToday"
          :disabled="checkingIn"
          class="shrink-0 flex flex-col items-center justify-center h-24 w-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
          @click="handleCheckin"
        >
          <svg v-if="checkingIn" class="h-7 w-7 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <template v-else>
            <svg class="h-7 w-7 mb-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-xs font-bold">打卡</span>
          </template>
        </button>

        <!-- 已打卡 -->
        <div v-else class="shrink-0 flex flex-col items-center gap-2">
          <div class="flex flex-col items-center justify-center h-24 w-24 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-200">
            <svg class="h-7 w-7 mb-1" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span class="text-xs font-bold">已打卡</span>
          </div>
          <button
            :disabled="checkingIn"
            class="text-xs text-gray-400 hover:text-red-500 transition-colors"
            @click="handleCancelCheckin"
          >取消</button>
        </div>

        <div class="min-w-0 flex-1">
          <h3 class="text-lg font-bold" :class="checkinStats.checkedInToday ? 'text-emerald-800' : 'text-indigo-800'">
            {{ checkinStats.checkedInToday ? '今日已打卡！' : '今日打卡' }}
          </h3>
          <p class="text-sm mt-0.5" :class="checkinStats.checkedInToday ? 'text-emerald-600' : 'text-indigo-600'">
            <template v-if="checkinStats.checkedInToday">
              🔥 连续 {{ checkinStats.streak }} 天 · 累计 {{ checkinStats.totalDays }} 天
            </template>
            <template v-else>
              今天完成 {{ checkinStats.todayDone }}/{{ checkinStats.todayTotal }} 个任务
              <span v-if="checkinStats.todayAllDone" class="font-semibold">— 任务已全部完成，勾选最后一个任务即可自动打卡</span>
            </template>
          </p>
          <!-- 进度条 -->
          <div v-if="!checkinStats.checkedInToday && checkinStats.todayTotal > 0" class="mt-3 max-w-xs">
            <div class="h-2 rounded-full bg-white/60 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-500 to-purple-500"
                :style="{ width: todayProgress + '%' }"
              ></div>
            </div>
          </div>
          <!-- 补打卡备注 -->
          <div v-if="!checkinStats.checkedInToday" class="mt-3 flex items-center gap-2">
            <input
              v-model="checkinNote"
              placeholder="写句学习小结（可选）"
              class="flex-1 max-w-xs rounded-lg border border-white/40 bg-white/60 px-3 py-1.5 text-sm placeholder-gray-400 outline-none focus:border-indigo-400"
              @keydown.enter="handleCheckin"
            />
          </div>
        </div>

        <!-- 坚持天数 -->
        <div class="shrink-0 text-right">
          <p class="text-4xl font-extrabold" :class="checkinStats.checkedInToday ? 'text-emerald-700' : 'text-indigo-700'">
            {{ checkinStats.streak }}
          </p>
          <p class="text-xs font-medium" :class="checkinStats.checkedInToday ? 'text-emerald-500' : 'text-indigo-500'">
            连续打卡
          </p>
        </div>
      </div>
    </div>

    <!-- ═══ 统计卡片 ═══ -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div v-for="item in stats" :key="item.label"
        :class="[item.bg, item.ring]"
        class="flex items-center gap-4 rounded-xl px-5 py-4 ring-1 shadow-sm transition-shadow hover:shadow-md">
        <span class="text-2xl">{{ item.emoji }}</span>
        <div>
          <p class="text-xs text-gray-500">{{ item.label }}</p>
          <p class="text-xl font-bold" :class="item.color">{{ item.value }}</p>
        </div>
      </div>
    </div>

    <!-- ═══ 图表行 ═══ -->
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <!-- 打卡日历 -->
      <div class="lg:col-span-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200/50">
        <h3 class="mb-1 text-sm font-semibold text-gray-800">📅 打卡日历</h3>
        <div ref="heatmapRef" class="h-36 w-full"></div>
      </div>

      <!-- 快捷入口 -->
      <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200/50">
        <h3 class="mb-3 text-sm font-semibold text-gray-800">⚡ 快捷入口</h3>
        <div class="grid grid-cols-2 gap-2.5">
          <button v-for="item in shortcuts" :key="item.label" :class="[item.bg, item.hover]"
            class="flex flex-col items-center justify-center gap-1.5 rounded-xl py-4 text-sm font-medium text-gray-700 transition-colors cursor-pointer"
            @click="router.push(item.route)">
            <span class="text-xl">{{ item.icon }}</span>
            <span class="text-xs">{{ item.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ 周趋势 + 贴士 ═══ -->
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div class="lg:col-span-2 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200/50">
        <h3 class="mb-2 text-sm font-semibold text-gray-800">📊 本周任务趋势</h3>
        <div ref="weeklyBarRef" class="h-64 w-full"></div>
      </div>

      <div class="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-5 text-white shadow-md flex flex-col justify-center">
        <h4 class="text-base font-semibold">💡 学习小贴士</h4>
        <p class="mt-2 text-sm leading-relaxed text-indigo-100">
          费曼学习法：用教别人的方式来学习，是最高效的输入。试试把刚学到的知识用自己的话讲给朋友听，或者写成笔记，你会发现自己理解得更深。
        </p>
        <p class="mt-3 text-xs text-indigo-200">
          — 每天打卡，见证自己的进步 📈
        </p>
      </div>
    </div>
  </div>
</template>

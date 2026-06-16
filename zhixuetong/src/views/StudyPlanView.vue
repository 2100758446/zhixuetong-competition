<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import * as echarts from 'echarts'

const API = import.meta.env.VITE_API_BASE_URL
const auth = useAuthStore()

// ── 类型 ──
interface Subject { id: string; name: string; color: string; order: number }
interface Task {
  id: string; subjectId: string; title: string; note: string
  repeatType: 'none' | 'daily' | 'weekly' | 'monthly'; repeatDays: number[]
  startTime: string; endTime: string; dueDate: string | null
  done?: boolean; subjectName?: string; subjectColor?: string
}
interface Deadline { id: string; title: string; date: string }
interface DayData { date: string; tasks: Task[] }

// ── 状态 ──
const view = ref<'today' | 'week' | 'list'>('today')
const subjects = ref<Subject[]>([])
const todayTasks = ref<Task[]>([])
const weekData = ref<DayData[]>([])
const deadlines = ref<Deadline[]>([])
const stats = ref({ streak: 0, weekly: [] as { date: string; label: string; total: number; done: number }[] })

// 本地日期（避免 UTC 时区偏移）
const d0 = new Date()
const today = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0')
const weekStart = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay() + 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
})

// ── 今日进度 ──
const todayTotal = computed(() => todayTasks.value.length)
const todayDone = computed(() => todayTasks.value.filter((t) => t.done).length)
const todayProgress = computed(() => todayTotal.value ? Math.round(todayDone.value / todayTotal.value * 100) : 0)

// ── 最近倒计时 ──
const nextDeadline = computed(() => deadlines.value.find((d) => d.date >= today))
const deadlineDays = computed(() => {
  if (!nextDeadline.value) return 0
  return Math.ceil((new Date(nextDeadline.value.date).getTime() - new Date(today).getTime()) / 86400000)
})

// ── 展开/折叠状态 ──
const expandedNotes = ref<Set<string>>(new Set())
const collapsedDoneGroups = ref<Set<string>>(new Set())
const expandedListSubjects = ref<Set<string>>(new Set())

// ── 弹窗状态 ──
const showTaskModal = ref(false)
const editingTask = ref<Task | null>(null)
const taskForm = ref({ subjectId: '', title: '', note: '', repeatType: 'none' as Task['repeatType'], repeatDays: [] as number[], startTime: '', endTime: '', dueDate: today })

const showSubjectModal = ref(false)
const editingSubject = ref<Subject | null>(null)
const subjectForm = ref({ name: '', color: '#6366f1' })

const showDeadlineModal = ref(false)
const deadlineForm = ref({ title: '', date: '' })

const dayLabels = ['日', '一', '二', '三', '四', '五', '六']
const colorOptions = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f97316']

// ── 加载数据 ──
async function loadAll() {
  const u = auth.username
  const [subj, dl, st] = await Promise.all([
    axios.get(`${API}/api/subjects`, { params: { username: u } }),
    axios.get(`${API}/api/deadlines`, { params: { username: u } }),
    axios.get(`${API}/api/tasks/stats`, { params: { username: u } }),
  ])
  subjects.value = subj.data
  deadlines.value = dl.data
  stats.value = st.data
  await loadToday()
  await loadWeek()
}

async function loadToday() {
  const { data } = await axios.get(`${API}/api/tasks/today`, { params: { username: auth.username } })
  todayTasks.value = data
}

async function loadWeek() {
  const { data } = await axios.get(`${API}/api/tasks/week`, { params: { username: auth.username, startDate: weekStart.value } })
  weekData.value = data
}

// ── 打卡 ──
async function toggleTask(task: Task) {
  await axios.post(`${API}/api/tasks/${task.id}/toggle`, { username: auth.username, date: today })
  await loadAll()
}

// ── 任务 CRUD ──
function openAddTask(presetDate?: string) {
  editingTask.value = null
  taskForm.value = { subjectId: subjects.value[0]?.id || '', title: '', note: '', repeatType: 'none', repeatDays: [], startTime: '', endTime: '', dueDate: presetDate || today }
  showTaskModal.value = true
}

function openEditTask(task: Task) {
  editingTask.value = task
  taskForm.value = { subjectId: task.subjectId, title: task.title, note: task.note, repeatType: task.repeatType, repeatDays: [...task.repeatDays], startTime: task.startTime, endTime: task.endTime, dueDate: task.dueDate || today }
  showTaskModal.value = true
}

async function saveTask() {
  const payload = { username: auth.username, ...taskForm.value }
  if (editingTask.value) {
    await axios.put(`${API}/api/tasks/${editingTask.value.id}`, payload)
  } else {
    await axios.post(`${API}/api/tasks`, payload)
  }
  showTaskModal.value = false
  await loadAll()
}

async function removeTask(id: string) {
  await axios.delete(`${API}/api/tasks/${id}`, { params: { username: auth.username } })
  await loadAll()
}

// ── 学科 CRUD ──
function openAddSubject() {
  editingSubject.value = null
  subjectForm.value = { name: '', color: colorOptions[subjects.value.length % colorOptions.length] }
  showSubjectModal.value = true
}

function openEditSubject(subj: Subject) {
  editingSubject.value = subj
  subjectForm.value = { name: subj.name, color: subj.color }
  showSubjectModal.value = true
}

async function saveSubject() {
  const payload = { username: auth.username, ...subjectForm.value }
  if (editingSubject.value) {
    await axios.put(`${API}/api/subjects/${editingSubject.value.id}`, payload)
  } else {
    await axios.post(`${API}/api/subjects`, payload)
  }
  showSubjectModal.value = false
  await loadAll()
}

async function removeSubject(id: string) {
  await axios.delete(`${API}/api/subjects/${id}`, { params: { username: auth.username } })
  await loadAll()
}

// ── 倒计时 CRUD ──
function openAddDeadline() {
  deadlineForm.value = { title: '', date: '' }
  showDeadlineModal.value = true
}

async function saveDeadline() {
  await axios.post(`${API}/api/deadlines`, { username: auth.username, ...deadlineForm.value })
  showDeadlineModal.value = false
  await loadAll()
}

async function removeDeadline(id: string) {
  await axios.delete(`${API}/api/deadlines/${id}`, { params: { username: auth.username } })
  await loadAll()
}

// ── 列表视图：按学科分组 ──
const groupedTasks = computed(() => {
  const allTasks = todayTasks.value.length ? todayTasks.value : []
  // 需要全部任务（不只是今天的）
  return subjects.value.map((s) => ({
    ...s,
    tasks: allTasks.filter((t) => t.subjectId === s.id),
  }))
})

// ── 周视图 ECharts ──
const pieRef = ref<HTMLDivElement>()
let pieChart: echarts.ECharts | null = null

function renderPie() {
  if (!pieRef.value) return
  if (pieChart) pieChart.dispose()
  pieChart = echarts.init(pieRef.value)
  const weekly = stats.value.weekly || []
  const totalDone = weekly.reduce((s, d) => s + d.done, 0)
  const totalAll = weekly.reduce((s, d) => s + d.total, 0)
  pieChart.setOption({
    series: [{
      type: 'pie', radius: ['55%', '80%'], center: ['50%', '50%'],
      label: { show: false },
      data: [
        { value: totalDone, itemStyle: { color: '#6366f1' } },
        { value: Math.max(0, totalAll - totalDone), itemStyle: { color: '#e5e7eb' } },
      ],
    }],
  })
}

// ── 工具函数 ──
function toggleRepeatDay(day: number) {
  const idx = taskForm.value.repeatDays.indexOf(day)
  if (idx >= 0) taskForm.value.repeatDays.splice(idx, 1)
  else taskForm.value.repeatDays.push(day)
}

function toggleNoteExpand(id: string) {
  if (expandedNotes.value.has(id)) expandedNotes.value.delete(id)
  else expandedNotes.value.add(id)
}

function toggleDoneGroup(subjectId: string) {
  if (collapsedDoneGroups.value.has(subjectId)) collapsedDoneGroups.value.delete(subjectId)
  else collapsedDoneGroups.value.add(subjectId)
}

function formatTime(t: string) {
  return t || ''
}

function taskTimeDisplay(task: Task) {
  if (task.startTime && task.endTime) return `${task.startTime}-${task.endTime}`
  if (task.startTime) return task.startTime
  return ''
}

function repeatDisplay(task: Task) {
  if (task.repeatType === 'daily') return '每天'
  if (task.repeatType === 'weekly') return task.repeatDays.map((d) => `周${dayLabels[d]}`).join('、')
  if (task.repeatType === 'monthly') return '每月'
  return ''
}

// ── 周视图每周统计 ──
const weekTotal = computed(() => (stats.value.weekly || []).reduce((s, d) => s + d.total, 0))
const weekDone = computed(() => (stats.value.weekly || []).reduce((s, d) => s + d.done, 0))
const weekPercent = computed(() => weekTotal.value ? Math.round(weekDone.value / weekTotal.value * 100) : 0)

onMounted(loadAll)
watch(() => auth.username, loadAll)
</script>

<template>
  <div class="flex h-full flex-col gap-4">
    <!-- ═══ 顶部：倒计时 + 进度 + tab ═══ -->
    <div class="shrink-0 space-y-3">
      <!-- 倒计时条 -->
      <div v-if="nextDeadline" class="flex items-center justify-between rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 px-5 py-3 text-white shadow-sm">
        <div class="flex items-center gap-2">
          <span class="text-lg">🎯</span>
          <span class="text-sm font-medium">距离 {{ nextDeadline.title }} 还有 <span class="text-xl font-bold">{{ deadlineDays }}</span> 天</span>
        </div>
        <div class="flex items-center gap-2">
          <button class="rounded-lg bg-white/20 px-2.5 py-1 text-xs hover:bg-white/30" @click="openAddDeadline">管理</button>
        </div>
      </div>
      <div v-else class="flex items-center justify-between rounded-xl bg-gray-100 px-5 py-3">
        <span class="text-sm text-gray-500">🎯 设置一个倒计时目标，激励自己</span>
        <button class="rounded-lg bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50" @click="openAddDeadline">添加倒计时</button>
      </div>

      <!-- 今日进度 -->
      <div class="flex items-center gap-4 rounded-xl bg-white px-5 py-3 shadow-sm ring-1 ring-gray-200/50">
        <div class="flex-1">
          <div class="mb-1 flex items-center justify-between">
            <span class="text-sm font-medium text-gray-700">今日进度</span>
            <span class="text-sm font-semibold" :class="todayProgress === 100 ? 'text-emerald-600' : 'text-indigo-600'">{{ todayDone }}/{{ todayTotal }}</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-gray-100">
            <div class="h-full rounded-full transition-all duration-500" :class="todayProgress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'" :style="{ width: todayProgress + '%' }"></div>
          </div>
        </div>
        <div class="text-right">
          <p class="text-xs text-gray-400">坚持天数</p>
          <p class="text-lg font-bold text-amber-600">{{ stats.streak }}<span class="text-xs font-normal text-gray-400"> 天</span></p>
        </div>
      </div>

      <!-- Tab 栏 -->
      <div class="flex items-center gap-2">
        <div class="flex rounded-lg bg-gray-100 p-0.5">
          <button v-for="v in [{ key: 'today', label: '今天' }, { key: 'week', label: '周视图' }, { key: 'list', label: '列表' }]" :key="v.key"
            class="rounded-md px-4 py-1.5 text-xs font-medium transition-colors"
            :class="view === v.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
            @click="view = v.key as typeof view">{{ v.label }}</button>
        </div>
        <button class="ml-auto flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700" @click="openAddTask()">
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          添加任务
        </button>
      </div>
    </div>

    <!-- ═══ 视图区 ═══ -->
    <div class="min-h-0 flex-1 overflow-y-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200/50">

      <!-- 视图 A：今天 -->
      <div v-if="view === 'today'" class="p-4">
        <div v-if="todayTasks.length === 0" class="py-12 text-center text-sm text-gray-400">
          今天没有任务，点击「添加任务」创建一个
        </div>
        <template v-for="subj in subjects" :key="subj.id">
          <div v-if="todayTasks.filter(t => t.subjectId === subj.id).length > 0" class="mb-4">
            <div class="mb-2 flex items-center gap-2 cursor-pointer" @click="toggleDoneGroup(subj.id)">
              <span class="h-2.5 w-2.5 rounded-full" :style="{ background: subj.color }"></span>
              <span class="text-sm font-semibold text-gray-700">{{ subj.name }}</span>
              <span class="text-xs text-gray-400">{{ todayTasks.filter(t => t.subjectId === subj.id && t.done).length }}/{{ todayTasks.filter(t => t.subjectId === subj.id).length }}</span>
              <svg class="ml-auto h-4 w-4 text-gray-300 transition-transform" :class="{ 'rotate-180': !collapsedDoneGroups.has(subj.id) }" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
            <div v-show="!collapsedDoneGroups.has(subj.id)" class="space-y-1">
              <div v-for="task in todayTasks.filter(t => t.subjectId === subj.id)" :key="task.id"
                class="group flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-50"
                :class="task.done ? 'opacity-50' : ''">
                <input type="checkbox" :checked="task.done" @change="toggleTask(task)"
                  class="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-sm" :class="task.done ? 'text-gray-400 line-through' : 'text-gray-800'">{{ task.title }}</span>
                    <span v-if="taskTimeDisplay(task)" class="text-xs text-gray-400">{{ taskTimeDisplay(task) }}</span>
                  </div>
                  <p v-if="task.note" class="mt-0.5 cursor-pointer text-xs text-gray-400" @click="toggleNoteExpand(task.id)">
                    {{ expandedNotes.has(task.id) ? task.note : (task.note.length > 40 ? task.note.slice(0, 40) + '...' : task.note) }}
                  </p>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button class="rounded p-0.5 text-gray-300 hover:text-indigo-500" @click="openEditTask(task)"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg></button>
                  <button class="rounded p-0.5 text-gray-300 hover:text-red-500" @click="removeTask(task.id)"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 视图 B：周视图 -->
      <div v-else-if="view === 'week'" class="p-4">
        <div class="grid grid-cols-7 gap-2">
          <div v-for="(day, i) in weekData" :key="day.date"
            class="min-h-[120px] rounded-lg border border-gray-100 p-2"
            :class="day.date === today ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50/50'">
            <div class="mb-1 text-center">
              <p class="text-xs text-gray-400">周{{ ['日','一','二','三','四','五','六'][i] }}</p>
              <p class="text-sm font-semibold" :class="day.date === today ? 'text-indigo-600' : 'text-gray-700'">{{ parseInt(day.date.slice(8)) }}</p>
            </div>
            <div class="space-y-1">
              <div v-for="task in day.tasks.slice(0, 4)" :key="task.id"
                class="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs cursor-pointer"
                :class="task.done ? 'text-gray-400 line-through' : 'text-gray-700'"
                :style="{ background: task.done ? 'transparent' : (task.subjectColor || '#6366f1') + '15' }"
                @click="toggleTask(task)">
                <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: task.subjectColor }"></span>
                <span class="truncate">{{ task.title }}</span>
              </div>
              <p v-if="day.tasks.length > 4" class="text-center text-xs text-gray-400">+{{ day.tasks.length - 4 }}项</p>
            </div>
            <button class="mt-1 w-full rounded py-0.5 text-xs text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors" @click="openAddTask(day.date)">+</button>
          </div>
        </div>
        <!-- 本周统计 -->
        <div class="mt-4 flex items-center justify-center gap-6 rounded-lg bg-gray-50 p-4">
          <div ref="pieRef" class="h-24 w-24"></div>
          <div>
            <p class="text-sm text-gray-500">本周完成率</p>
            <p class="text-2xl font-bold text-indigo-600">{{ weekPercent }}%</p>
            <p class="text-xs text-gray-400">{{ weekDone }}/{{ weekTotal }} 个任务</p>
          </div>
        </div>
      </div>

      <!-- 视图 C：列表 -->
      <div v-else class="p-4">
        <div v-if="subjects.length === 0" class="py-12 text-center text-sm text-gray-400">
          还没有学科，先创建一个
        </div>
        <div v-for="subj in subjects" :key="subj.id" class="mb-4">
          <div class="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-gray-50 cursor-pointer group" @click="expandedListSubjects.has(subj.id) ? expandedListSubjects.delete(subj.id) : expandedListSubjects.add(subj.id)">
            <span class="h-3 w-3 rounded-full" :style="{ background: subj.color }"></span>
            <span class="text-sm font-semibold text-gray-800">{{ subj.name }}</span>
            <div class="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button class="rounded p-0.5 text-gray-300 hover:text-indigo-500" @click.stop="openEditSubject(subj)"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg></button>
              <button class="rounded p-0.5 text-gray-300 hover:text-red-500" @click.stop="removeSubject(subj.id)"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg></button>
            </div>
          </div>
          <div v-show="expandedListSubjects.has(subj.id)" class="ml-5 space-y-1">
            <div v-for="task in todayTasks.filter(t => t.subjectId === subj.id)" :key="task.id"
              class="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50">
              <span class="text-sm text-gray-800">{{ task.title }}</span>
              <span v-if="repeatDisplay(task)" class="text-xs text-gray-400">{{ repeatDisplay(task) }}</span>
              <span v-if="taskTimeDisplay(task)" class="text-xs text-gray-400">{{ taskTimeDisplay(task) }}</span>
              <div class="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button class="rounded p-0.5 text-gray-300 hover:text-indigo-500" @click="openEditTask(task)"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg></button>
                <button class="rounded p-0.5 text-gray-300 hover:text-red-500" @click="removeTask(task.id)"><svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            </div>
            <button class="flex items-center gap-1 rounded-lg px-3 py-2 text-xs text-gray-400 hover:text-indigo-500" @click="openAddTask()">
              <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              添加任务
            </button>
          </div>
        </div>
        <button class="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors" @click="openAddSubject">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          新建学科
        </button>
      </div>
    </div>

    <!-- ═══ 任务弹窗 ═══ -->
    <div v-if="showTaskModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" @click.self="showTaskModal = false">
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 class="mb-4 text-lg font-semibold text-gray-800">{{ editingTask ? '编辑任务' : '新建任务' }}</h3>
        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">任务标题 *</label>
            <input v-model="taskForm.title" placeholder="如：第三章习题" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">所属学科 *</label>
            <select v-model="taskForm.subjectId" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500">
              <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">备注详情</label>
            <textarea v-model="taskForm.note" rows="2" placeholder="知识点、习题范围等" class="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"></textarea>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">重复</label>
            <select v-model="taskForm.repeatType" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500">
              <option value="none">不重复</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
          </div>
          <div v-if="taskForm.repeatType === 'weekly'" class="flex gap-1.5">
            <button v-for="d in 7" :key="d" @click="toggleRepeatDay((d - 1) % 7)"
              class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors"
              :class="taskForm.repeatDays.includes((d - 1) % 7) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'">
              {{ dayLabels[(d - 1) % 7] }}
            </button>
          </div>
          <div v-if="taskForm.repeatType === 'none'" class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600">指定日期</label>
              <input type="date" v-model="taskForm.dueDate" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600">开始时间</label>
              <input type="time" v-model="taskForm.startTime" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600">结束时间（可选）</label>
              <input type="time" v-model="taskForm.endTime" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
            </div>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100" @click="showTaskModal = false">取消</button>
          <button class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50" :disabled="!taskForm.title.trim() || !taskForm.subjectId" @click="saveTask">保存</button>
        </div>
      </div>
    </div>

    <!-- ═══ 学科弹窗 ═══ -->
    <div v-if="showSubjectModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" @click.self="showSubjectModal = false">
      <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 class="mb-4 text-lg font-semibold text-gray-800">{{ editingSubject ? '编辑学科' : '新建学科' }}</h3>
        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">学科名称</label>
            <input v-model="subjectForm.name" placeholder="如：高等数学" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">颜色</label>
            <div class="flex gap-2">
              <button v-for="c in colorOptions" :key="c" @click="subjectForm.color = c"
                class="h-7 w-7 rounded-full transition-transform" :class="subjectForm.color === c ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : ''"
                :style="{ background: c }"></button>
            </div>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100" @click="showSubjectModal = false">取消</button>
          <button class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50" :disabled="!subjectForm.name.trim()" @click="saveSubject">保存</button>
        </div>
      </div>
    </div>

    <!-- ═══ 倒计时弹窗 ═══ -->
    <div v-if="showDeadlineModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" @click.self="showDeadlineModal = false">
      <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 class="mb-4 text-lg font-semibold text-gray-800">管理倒计时</h3>
        <div class="mb-4 space-y-2">
          <div v-for="dl in deadlines" :key="dl.id" class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <div>
              <p class="text-sm font-medium text-gray-800">{{ dl.title }}</p>
              <p class="text-xs text-gray-400">{{ dl.date }} · 距今 {{ Math.ceil((new Date(dl.date).getTime() - Date.now()) / 86400000) }} 天</p>
            </div>
            <button class="text-gray-300 hover:text-red-500" @click="removeDeadline(dl.id)">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <p v-if="deadlines.length === 0" class="text-center text-xs text-gray-400 py-2">暂无倒计时</p>
        </div>
        <div class="space-y-3 border-t border-gray-100 pt-4">
          <input v-model="deadlineForm.title" placeholder="如：期末考试" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
          <input type="date" v-model="deadlineForm.date" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
          <button class="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50" :disabled="!deadlineForm.title.trim() || !deadlineForm.date" @click="saveDeadline">添加</button>
        </div>
        <div class="mt-4 flex justify-end">
          <button class="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100" @click="showDeadlineModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

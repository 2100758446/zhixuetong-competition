<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const sidebarCollapsed = ref(false)

const navItems = [
  { path: '/dashboard', name: '仪表盘', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/ai-qa', name: 'AI 智能问答', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { path: '/study-plan', name: '学习计划', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { path: '/knowledge-graph', name: '知识图谱', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
  { path: '/notes', name: '学习笔记', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
]

const isActive = (path: string) => route.path === path

const pageTitle = computed(() => {
  const item = navItems.find((i) => i.path === route.path)
  return item?.name || '智学通'
})

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="flex h-screen bg-gray-50 font-sans">
    <!-- Sidebar -->
    <aside
      :class="[sidebarCollapsed ? 'w-20' : 'w-64']"
      class="relative flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ease-in-out"
    >
      <!-- Logo -->
      <div class="flex h-16 items-center gap-3 px-5 border-b border-gray-100">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white text-sm font-bold">
          智
        </div>
        <span v-show="!sidebarCollapsed" class="text-lg font-semibold text-gray-800 whitespace-nowrap">
          智学通
        </span>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          :class="[
            isActive(item.path)
              ? 'bg-indigo-50 text-indigo-600'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
          ]"
          class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
        >
          <svg
            class="h-5 w-5 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
          </svg>
          <span v-show="!sidebarCollapsed" class="whitespace-nowrap">{{ item.name }}</span>
        </router-link>
      </nav>

      <!-- User footer -->
      <div class="border-t border-gray-100 px-3 py-4">
        <div class="flex items-center gap-3 rounded-lg px-3 py-2">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold">
            {{ auth.username.charAt(0).toUpperCase() }}
          </div>
          <div v-show="!sidebarCollapsed" class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-800 truncate">{{ auth.username }}</p>
            <p class="text-xs text-gray-400">在线</p>
          </div>
          <button
            v-show="!sidebarCollapsed"
            title="退出登录"
            class="text-gray-400 hover:text-red-500 transition-colors"
            @click="handleLogout"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Collapse toggle -->
      <button
        class="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm hover:text-indigo-600 transition-colors"
        @click="sidebarCollapsed = !sidebarCollapsed"
      >
        <svg
          class="h-3 w-3 transition-transform"
          :class="{ 'rotate-180': sidebarCollapsed }"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </aside>

    <!-- Main content -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Top bar -->
      <header class="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
        <h1 class="text-xl font-semibold text-gray-800">{{ pageTitle }}</h1>
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-500">欢迎回来，{{ auth.username }}</span>
        </div>
      </header>

      <!-- Page content -->
      <main class="flex-1 overflow-y-auto p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-gray-50">
    <p class="text-6xl font-bold text-indigo-600">404</p>
    <h1 class="mt-4 text-2xl font-semibold text-gray-800">页面不存在</h1>
    <p class="mt-2 text-gray-500">你访问的页面不存在或已被移除</p>
    <button
      class="mt-6 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
      @click="router.push('/dashboard')"
    >
      返回首页
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const isRegister = ref(false)
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const form = reactive({
  username: '',
  password: '',
  email: '',
})

const errors = reactive({
  username: '',
  password: '',
  email: '',
})

function validate(): boolean {
  let valid = true
  errors.username = ''
  errors.password = ''
  errors.email = ''

  if (form.username.trim().length < 3) {
    errors.username = '用户名至少需要 3 个字符'
    valid = false
  }

  if (form.password.length < 6) {
    errors.password = '密码至少需要 6 个字符'
    valid = false
  }

  if (isRegister.value && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = '请输入有效的邮箱地址'
    valid = false
  }

  return valid
}

async function handleSubmit() {
  errorMsg.value = ''
  successMsg.value = ''
  if (!validate()) return

  loading.value = true

  if (isRegister.value) {
    const result = await auth.register(form.username, form.password, form.email || undefined)
    if (result.ok) {
      successMsg.value = '注册成功，请登录'
      isRegister.value = false
      form.password = ''
    } else {
      errorMsg.value = result.error || '注册失败'
    }
  } else {
    const result = await auth.login(form.username, form.password)
    if (result.ok) {
      router.push('/dashboard')
    } else {
      errorMsg.value = result.error || '登录失败'
    }
  }

  loading.value = false
}

function toggleMode() {
  isRegister.value = !isRegister.value
  errorMsg.value = ''
  successMsg.value = ''
  errors.username = ''
  errors.password = ''
  errors.email = ''
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
    <div class="w-full max-w-md">
      <!-- Card -->
      <div class="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-gray-200/50">
        <!-- Header -->
        <div class="mb-8 text-center">
          <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white text-xl font-bold shadow-lg shadow-indigo-200">
            智
          </div>
          <h1 class="text-2xl font-bold text-gray-900">
            {{ isRegister ? '创建账号' : '欢迎回来' }}
          </h1>
          <p class="mt-1 text-sm text-gray-500">
            {{ isRegister ? '注册智学通，开启智能学习之旅' : '登录智学通，继续你的学习旅程' }}
          </p>
        </div>

        <!-- Error banner -->
        <div
          v-if="errorMsg"
          class="mb-6 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          <svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {{ errorMsg }}
        </div>

        <!-- Success banner -->
        <div
          v-if="successMsg"
          class="mb-6 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600"
        >
          <svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ successMsg }}
        </div>

        <!-- Form -->
        <form class="space-y-5" @submit.prevent="handleSubmit">
          <!-- Username -->
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700 mb-1.5">用户名</label>
            <input
              id="username"
              v-model="form.username"
              type="text"
              placeholder="请输入用户名"
              autocomplete="username"
              class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
            <p v-if="errors.username" class="mt-1.5 text-xs text-red-500">{{ errors.username }}</p>
          </div>

          <!-- Password -->
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              autocomplete="current-password"
              class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
            <p v-if="errors.password" class="mt-1.5 text-xs text-red-500">{{ errors.password }}</p>
          </div>

          <!-- Email (register only) -->
          <div v-if="isRegister">
            <label for="email" class="block text-sm font-medium text-gray-700 mb-1.5">
              邮箱 <span class="text-gray-400 font-normal">(选填)</span>
            </label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              placeholder="your@email.com"
              autocomplete="email"
              class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
            <p v-if="errors.email" class="mt-1.5 text-xs text-red-500">{{ errors.email }}</p>
          </div>

          <!-- Submit -->
          <button
            type="submit"
            :disabled="loading"
            class="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg
              v-if="loading"
              class="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ loading ? '处理中...' : (isRegister ? '注 册' : '登 录') }}
          </button>
        </form>

        <!-- Toggle mode -->
        <p class="mt-6 text-center text-sm text-gray-500">
          {{ isRegister ? '已有账号？' : '没有账号？' }}
          <button
            type="button"
            class="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            @click="toggleMode"
          >
            {{ isRegister ? '立即登录' : '立即注册' }}
          </button>
        </p>

        <!-- Demo hint -->
        <div class="mt-5 rounded-lg bg-gray-50 px-4 py-3 text-center">
          <p class="text-xs text-gray-400">
            演示账号：<span class="font-mono text-gray-500">demo</span>
            &nbsp;/&nbsp;
            <span class="font-mono text-gray-500">demo123</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

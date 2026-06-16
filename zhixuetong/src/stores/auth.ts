import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const API = import.meta.env.VITE_API_BASE_URL

export const useAuthStore = defineStore('auth', () => {
  const username = ref(localStorage.getItem('username') || '')
  const isAuthenticated = computed(() => username.value !== '')

  async function login(user: string, pass: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const { data } = await axios.post(`${API}/api/login`, { username: user, password: pass })
      username.value = data.username
      localStorage.setItem('username', data.username)
      return { ok: true }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error || '登录失败' : '网络错误'
      return { ok: false, error: msg }
    }
  }

  async function register(user: string, pass: string, email?: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await axios.post(`${API}/api/register`, { username: user, password: pass, email })
      return { ok: true }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error || '注册失败' : '网络错误'
      return { ok: false, error: msg }
    }
  }

  function logout() {
    username.value = ''
    localStorage.removeItem('username')
  }

  return { username, isAuthenticated, login, register, logout }
})

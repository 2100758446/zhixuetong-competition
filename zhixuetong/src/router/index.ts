import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/components/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard',
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/DashboardView.vue'),
      },
      {
        path: 'ai-qa',
        name: 'AIQA',
        component: () => import('@/views/AIQAView.vue'),
      },
      {
        path: 'study-plan',
        name: 'StudyPlan',
        component: () => import('@/views/StudyPlanView.vue'),
      },
      {
        path: 'knowledge-graph',
        name: 'KnowledgeGraph',
        component: () => import('@/views/KnowledgeGraphView.vue'),
      },
      {
        path: 'notes',
        name: 'StudyNotes',
        component: () => import('@/views/StudyNotesView.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard
router.beforeEach((to) => {
  const auth = useAuthStore()
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth !== false)

  if (requiresAuth && !auth.isAuthenticated) {
    return { name: 'Login' }
  }

  if (to.name === 'Login' && auth.isAuthenticated) {
    return { path: '/dashboard' }
  }
})

export default router

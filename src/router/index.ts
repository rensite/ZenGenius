import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const toTrack = (to: { params: Record<string, unknown> }) => `/track/${to.params.id}`

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/library' },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('@/views/AuthCallbackView.vue'),
    meta: { public: true },
  },
  {
    path: '/library',
    name: 'library',
    component: () => import('@/views/LibraryView.vue'),
  },
  {
    path: '/track/:id',
    name: 'track',
    component: () => import('@/views/TrackView.vue'),
    props: true,
  },
  { path: '/track/:id/investigate', redirect: toTrack },
  { path: '/track/:id/edit', redirect: toTrack },
  { path: '/track/:id/rhymes', redirect: toTrack },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const auth = useAuthStore()
  // First navigation may arrive before the auth store has hydrated from
  // localStorage. Wait so we don't bounce a logged-in user to /login on reload.
  if (!auth.ready) await auth.init()
  if (!auth.isAuthenticated) return { path: '/login', query: { next: to.fullPath } }
  return true
})

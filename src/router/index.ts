import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const toTrack = (to: { params: Record<string, unknown> }) => `/track/${to.params.id}`

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/library' },
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
  history: createWebHistory(),
  routes,
})

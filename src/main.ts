import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { ensureSeed } from './seed'
import { useAuthStore } from './stores/auth'
import './styles/main.css'

async function bootstrap() {
  await ensureSeed()

  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  // Resolve the initial Supabase session before mounting so the router guard
  // sees the correct auth state on the first navigation.
  const auth = useAuthStore(pinia)
  await auth.init()

  app.use(router)
  app.mount('#app')
}

bootstrap()

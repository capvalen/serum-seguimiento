import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/bienvenido',
      name: 'bienvenido',
      component: () => import('@/views/BienvenidoView.vue'),
      meta: { menu: true },
    },
    {
      path: '/atenciones/:fecha',
      name: 'atenciones-fecha',
      component: () => import('@/views/AtencionesFechaView.vue'),
      meta: { menu: true },
    },
    {
      path: '/configuracion',
      name: 'configuracion',
      component: () => import('@/views/ConfiguracionView.vue'),
      meta: { menu: true },
    },
  ],
})

export default router

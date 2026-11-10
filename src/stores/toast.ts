import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ToastTipo = 'exito' | 'error'

/**
 * Store global de notificaciones (toasts).
 * Se auto-ocultan tras unos segundos y sobreviven a la navegación
 * porque el componente vive en `App.vue`.
 */
export const useToastStore = defineStore('toast', () => {
  const mensaje = ref('')
  const tipo = ref<ToastTipo>('exito')
  const visible = ref(false)

  let timer: ReturnType<typeof setTimeout> | undefined

  function mostrar(msg: string, t: ToastTipo = 'exito') {
    mensaje.value = msg
    tipo.value = t
    visible.value = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      visible.value = false
    }, 3000)
  }

  function ocultar() {
    visible.value = false
    clearTimeout(timer)
  }

  return { mensaje, tipo, visible, mostrar, ocultar }
})

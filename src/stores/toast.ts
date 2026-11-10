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

  /** Duración por defecto del toast (3 s). */
  const DURACION_DEFECTO = 3000

  /**
   * Muestra una notificación.
   * @param msg     Texto a mostrar.
   * @param t       Tipo ('exito' | 'error').
   * @param duracionMs  Tiempo visible en ms. Por defecto 3000.
   */
  function mostrar(
    msg: string,
    t: ToastTipo = 'exito',
    duracionMs = DURACION_DEFECTO,
  ) {
    mensaje.value = msg
    tipo.value = t
    visible.value = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      visible.value = false
    }, duracionMs)
  }

  function ocultar() {
    visible.value = false
    clearTimeout(timer)
  }

  return { mensaje, tipo, visible, mostrar, ocultar }
})

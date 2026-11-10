import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Servicio {
  servicio: string
  abreviatura: string
}

/** Datos del establecimiento de salud del usuario. */
export interface Establecimiento {
  anio: string
  centroSalud: string
  tipoSerum: 'remunerada' | 'equivalente'
}

/** Resultado del reporte diario que devuelve `/api/reporte/:correo/dia/:fecha`. */
export interface ReporteDia {
  fecha: string
  total: number
  servicios: Record<string, number>
}

/** Resultado del reporte mensual que devuelve `/api/reporte/:correo/mes/:anioMes`. */
export interface ReporteMes {
  mes: string
  total: number
  /** Total de atendidos por día: { "2026-03-02": 3, ... } */
  dias: Record<string, number>
  /** Desglose por día y servicio: { "2026-03-02": { "triaje": 4 }, ... } */
  detalle: Record<string, Record<string, number>>
  servicios: Record<string, number>
}

/** Clave usada para persistir el correo en localStorage. */
export const KV_CORREO = 'kv_correo'

/**
 * Store global del usuario autenticado.
 * Guarda el correo y los servicios que devuelve `/api/datos/:correo`.
 */
export const useUsuarioStore = defineStore('usuario', () => {
  const correo = ref(localStorage.getItem(KV_CORREO) ?? '')
  const servicios = ref<Servicio[]>([])
  const reporteMes = ref<ReporteMes | null>(null)
  const establecimiento = ref<Establecimiento>({
    anio: '',
    centroSalud: '',
    tipoSerum: 'remunerada',
  })

  /** Guarda los datos recibidos desde la API y persiste el correo. */
  function setDatos(email: string, nuevosServicios: Servicio[]) {
    correo.value = email
    servicios.value = nuevosServicios
    localStorage.setItem(KV_CORREO, email)
  }

  /**
   * Carga el correo, los servicios y el establecimiento desde
   * `/api/datos/:correo`.
   * Útil al entrar directo a una ruta (p. ej. `/bienvenido`) sin pasar por el login.
   */
  async function cargarDatos() {
    if (!correo.value) return
    const res = await fetch(`/api/datos/${encodeURIComponent(correo.value)}`)
    if (!res.ok) return
    const datos = (await res.json()) as {
      servicios?: Servicio[]
      establecimiento?: Establecimiento
    }
    servicios.value = datos.servicios ?? []
    if (datos.establecimiento) establecimiento.value = datos.establecimiento
  }

  /** Reemplaza el establecimiento (tras guardarlo en la API). */
  function setEstablecimiento(datos: Establecimiento) {
    establecimiento.value = datos
  }

  /** Guarda el reporte mensual consultado. */
  function setReporteMes(datos: ReporteMes) {
    reporteMes.value = datos
  }

  /** Reemplaza la lista de servicios (tras un CRUD en el catálogo). */
  function setServicios(nuevos: Servicio[]) {
    servicios.value = nuevos
  }

  /** Limpia el estado (por ejemplo al cerrar sesión). */
  function limpiar() {
    correo.value = ''
    servicios.value = []
    reporteMes.value = null
    establecimiento.value = { anio: '', centroSalud: '', tipoSerum: 'remunerada' }
    localStorage.removeItem(KV_CORREO)
  }

  return {
    correo,
    servicios,
    reporteMes,
    establecimiento,
    setDatos,
    cargarDatos,
    setReporteMes,
    setServicios,
    setEstablecimiento,
    limpiar,
  }
})

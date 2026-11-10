<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { IconCalendarMonth, IconCalendar, IconVaccine, IconMessageCircleSearch, IconUsers, IconFileSpreadsheet, IconCalendarStats, IconListDetails } from '@tabler/icons-vue'
import { useUsuarioStore, type ReporteMes } from '@/stores/usuario'
import { useToastStore } from '@/stores/toast'
import AgregarAtencion from '@/components/AgregarAtencion.vue'

const router = useRouter()
const usuario = useUsuarioStore()
const toast = useToastStore()

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const hoy = new Date()
const ANIO_INICIO = 2026

/** Años desde 2026 hasta el año actual (inclusive), saltando de 1 en 1. */
const anios = computed(() => {
  const actual = hoy.getFullYear()
  const fin = Math.max(actual, ANIO_INICIO)
  const lista: number[] = []
  for (let a = ANIO_INICIO; a <= fin; a++) lista.push(a)
  return lista
})

// Valores por defecto: mes y año actuales.
const mes = ref(hoy.getMonth() + 1)
const anio = ref(hoy.getFullYear())

const cargando = ref(false)

/** Clave del mes en formato `YYYY-MM` (ej. `2026-02`). */
const claveMes = computed(
  () => `${anio.value}-${String(mes.value).padStart(2, '0')}`,
)

/** Etiqueta en español de una fecha ISO: "Lunes, 2 de nov.". */
function etiquetaFecha(fechaISO: string) {
  const [y, m, d] = fechaISO.split('-')
  const fecha = new Date(Number(y), Number(m) - 1, Number(d))
  const partes = new Intl.DateTimeFormat('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).formatToParts(fecha)

  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? ''

  const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const mes = valor('month').replace(/\.$/, '')

  return `${capitalizar(valor('weekday'))}, ${valor('day')} de ${mes}.`
}

/** Días del mes con registros, ordenados cronológicamente. */
const diasDelMes = computed(() => {
  const dias = usuario.reporteMes?.dias ?? {}
  return Object.entries(dias)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, total]) => ({ fecha, etiqueta: etiquetaFecha(fecha), total }))
})

/** Servicios del mes ordenados por total (desc) y luego por nombre. */
const serviciosDelMes = computed(() => {
  const servicios = usuario.reporteMes?.servicios ?? {}
  const catalogo = new Map(
    usuario.servicios.map((s) => [s.servicio.toLowerCase(), s]),
  )
  return Object.entries(servicios)
    .map(([servicio, total]) => ({
      servicio,
      total,
      etiqueta:
        catalogo.get(servicio.toLowerCase())?.servicio ??
        servicio.charAt(0).toUpperCase() + servicio.slice(1),
    }))
    .sort((a, b) => b.total - a.total || a.etiqueta.localeCompare(b.etiqueta))
})

/** Modo de visualización del reporte mensual. */
const vista = ref<'fechas' | 'detalle'>('fechas')

/** Consulta en la API el reporte del mes seleccionado. */
async function buscarReporte() {
  if (!usuario.correo) return

  cargando.value = true
  try {
    const url = `/api/reporte/${encodeURIComponent(usuario.correo)}/mes/${claveMes.value}`
    const res = await fetch(url)
    const datos: ReporteMes = await res.json()
    usuario.setReporteMes(datos)
    console.log('Reporte del mes:', datos)
  } catch (error) {
    console.error('Error al consultar el reporte:', error)
  } finally {
    cargando.value = false
  }
}

// Al entrar a la ruta y al cambiar mes o año.
onMounted(() => {
  buscarReporte()
  // Asegura tener los servicios disponibles para el modal de "Agregar atención".
  if (!usuario.servicios.length) usuario.cargarDatos()
})
watch([mes, anio], buscarReporte)

/** Tras registrar una atención, navega a la vista de esa fecha. */
function alGuardar(fecha: string) {
  router.push(`/atenciones/${fecha}`)
}

const exportando = ref(false)

/** Genera y descarga el Excel consolidado del mes seleccionado. */
async function exportar() {
  if (!usuario.reporteMes) return

  exportando.value = true
  try {
    // La librería se carga bajo demanda para no engordar el bundle inicial.
    const { exportarConsolidado } = await import('@/utils/consolidadoExcel')
    await exportarConsolidado({
      mes: mes.value,
      anio: anio.value,
      reporte: usuario.reporteMes,
      catalogo: usuario.servicios,
      establecimiento: usuario.establecimiento,
    })
    toast.mostrar('Excel exportado')
  } catch (error) {
    console.error('Error al exportar el Excel:', error)
    toast.mostrar('No se pudo exportar', 'error')
  } finally {
    exportando.value = false
  }
}
</script>

<template>
  <main class="bienvenido">
    <div class="med-card">
      <IconVaccine :size="40" class="logo" stroke-width="1.5" />
      <h1>Bienvenido</h1>
      <p v-if="usuario.correo" class="correo">{{ usuario.correo }}</p>

      <p class="instruccion">Elija la fecha para alimentar información</p>

      <div class="selects">
        <label>
          <IconCalendarMonth :size="18" stroke-width="1.5" />
          <select v-model.number="mes">
            <option v-for="(nombre, i) in MESES" :key="i" :value="i + 1">
              {{ nombre }}
            </option>
          </select>
        </label>

        <label>
          <IconCalendar :size="18" stroke-width="1.5" />
          <select v-model.number="anio">
            <option v-for="a in anios" :key="a" :value="a">{{ a }}</option>
          </select>
        </label>
      </div>

      <p v-if="cargando" class="estado">Buscando registros...</p>
      <div v-else-if="usuario.reporteMes && usuario.reporteMes.total === 0" class="vacio">
        <IconMessageCircleSearch :size="40" stroke-width="1.5" />
        <p>No hay registros.</p>
      </div>
      <template v-else-if="usuario.reporteMes && usuario.reporteMes.total > 0">
        <div class="switch" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="vista === 'fechas'"
            :class="{ activo: vista === 'fechas' }"
            @click="vista = 'fechas'"
          >
            <IconCalendarStats :size="18" stroke-width="1.5" />
            Vista por fechas
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="vista === 'detalle'"
            :class="{ activo: vista === 'detalle' }"
            @click="vista = 'detalle'"
          >
            <IconListDetails :size="18" stroke-width="1.5" />
            Vista por detalle
          </button>
        </div>

        <div class="resumen">
          <span class="resumen-etiqueta">
            <IconUsers :size="20" stroke-width="1.5" />
            Total de atendidos:
          </span>
          <span class="numero">{{ usuario.reporteMes.total }}</span>
        </div>

        <p class="subtitulo">
          {{ vista === 'fechas' ? 'Listado por días:' : 'Detalle por servicio:' }}
        </p>

        <ul v-if="vista === 'fechas'" class="lista-dias">
          <li v-for="d in diasDelMes" :key="d.fecha">
            <RouterLink :to="`/atenciones/${d.fecha}`" class="dia">
              <span class="dia-fecha">{{ d.etiqueta }}</span>
              <span class="dia-total">
                {{ d.total }} {{ d.total === 1 ? 'atención' : 'atenciones' }}
              </span>
            </RouterLink>
          </li>
        </ul>

        <ul v-else class="lista-dias">
          <li v-for="s in serviciosDelMes" :key="s.servicio">
            <div class="dia">
              <span class="dia-fecha">{{ s.etiqueta }}</span>
              <span class="dia-total">
                {{ s.total }} {{ s.total === 1 ? 'atención' : 'atenciones' }}
              </span>
            </div>
          </li>
        </ul>

        <div class="resumen total-final">
          <span class="resumen-etiqueta">
            <IconUsers :size="20" stroke-width="1.5" />
            Total de atendidos:
          </span>
          <span class="numero">{{ usuario.reporteMes.total }}</span>
        </div>

        <button
          type="button"
          class="btn-exportar"
          :disabled="exportando"
          @click="exportar"
        >
          <IconFileSpreadsheet :size="20" stroke-width="1.5" />
          {{ exportando ? 'Exportando...' : 'Exportar' }}
        </button>
      </template>
    </div>

    <AgregarAtencion
      :mes-inicial="mes"
      :anio-inicial="anio"
      @guardado="alGuardar"
    />
  </main>
</template>

<style scoped>
.bienvenido {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1rem;
  padding-bottom: calc(1rem + var(--menu-alto));
}

.med-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 420px;
  text-align: center;
}

.logo {
  color: var(--med-blue-600);
}

h1 {
  margin: 0;
  font-size: 1.6rem;
}

.correo {
  margin: 0;
  color: var(--med-text-muted);
  font-size: 0.9rem;
}

.instruccion {
  margin: 0.5rem 0 0;
  font-weight: 600;
  color: var(--med-blue-700);
}

.selects {
  display: flex;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.5rem;
}

.selects label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
  color: var(--med-text-muted);
}

.selects select {
  cursor: pointer;
}

.vacio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 0;
  color: var(--med-text-muted);
}

.vacio p {
  margin: 0;
}

.estado {
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
  color: var(--med-text-muted);
}

.resumen {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  padding: 0.75rem 0.5rem;
  font-weight: 700;
  color: var(--med-blue-700);
}

.resumen-etiqueta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.numero {
  font-size: 1.15rem;
}

.subtitulo {
	margin: 0px 0;
  width: 100%;
  text-align: left;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--med-text-muted);
}

.switch {
  display: flex;
  width: 100%;
  gap: 0.5rem;
  margin-top: 0.5rem;
  background: transparent;
  border: none;
}

.switch button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.6rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--med-text-muted);
  background: transparent;
  border: 1.5px solid var(--med-border);
  box-shadow: none;
  border-radius: var(--med-radius-sm);
  transition: color var(--med-transition), background var(--med-transition),
    border-color var(--med-transition), box-shadow var(--med-transition);
}

.switch button:hover:not(.activo) {
  transform: none;
  box-shadow: none;
  color: var(--med-blue-600);
  border-color: var(--med-blue-400);
  background: var(--med-blue-50);
}

.switch button.activo {
  color: #fff;
  background: linear-gradient(135deg, var(--med-blue-600), var(--med-blue-500));
  border-color: transparent;
  box-shadow: var(--med-shadow-hover);
}

.switch button.activo:hover {
  transform: none;
}

.lista-dias {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
}

.lista-dias li + li {
  border-top: 1px solid var(--med-border);
}

.dia {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  padding: 0.95rem 0.5rem;
  color: var(--med-text);
  text-decoration: none;
  border-radius: var(--med-radius-sm);
  transition: background var(--med-transition), color var(--med-transition);
}

.dia:hover {
  background: var(--med-blue-50);
  color: var(--med-blue-700);
}

.dia-fecha {
  text-align: left;
}

.dia-total {
  font-weight: 700;
  color: var(--med-blue-600);
  white-space: nowrap;
}

.total-final {
  margin-top: 1.25rem;
  padding-top: 0.85rem;
  border-top: 2px solid var(--med-border);
}

.btn-exportar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  margin-top: 1.25rem;
  background: linear-gradient(135deg, #4a5a6a, #37474f);
}

.btn-exportar:hover:not(:disabled) {
  filter: brightness(1.12);
}
</style>

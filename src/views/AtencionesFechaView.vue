<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconUsers,
  IconMessageCircleSearch,
} from '@tabler/icons-vue'
import { useUsuarioStore, type ReporteDia } from '@/stores/usuario'
import AgregarAtencion from '@/components/AgregarAtencion.vue'
import EditarAtencion from '@/components/EditarAtencion.vue'

const route = useRoute()
const router = useRouter()
const usuario = useUsuarioStore()

const fecha = computed(() => String(route.params.fecha))
const cargando = ref(false)
const reporte = ref<ReporteDia | null>(null)

/** Día, mes y año de la fecha de la ruta (para preseleccionar el modal). */
const partes = computed(() => {
  const [y, m, d] = fecha.value.split('-').map(Number)
  return { dia: d || 0, mes: m || 0, anio: y || 0 }
})

/** Registro seleccionado para editar/eliminar (null = modal cerrado). */
const seleccion = ref<{ servicio: string; atendidos: number } | null>(null)

/** Fecha en español: "Lunes, 25 mar. 2025". */
const titulo = computed(() => {
  const [y, m, d] = fecha.value.split('-')
  const partes = new Intl.DateTimeFormat('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(new Date(Number(y), Number(m) - 1, Number(d)))

  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? ''

  const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const mes = valor('month').replace(/\.$/, '')

  return `${capitalizar(valor('weekday'))}, ${valor('day')} ${mes}. ${valor('year')}`
})

/** Servicios del día ordenados por cantidad desc y luego por nombre. */
const filas = computed(() => {
  const servicios = reporte.value?.servicios ?? {}
  return Object.entries(servicios)
    .map(([servicio, atendidos]) => ({ servicio, atendidos }))
    .sort((a, b) => b.atendidos - a.atendidos || a.servicio.localeCompare(b.servicio))
})

async function cargar() {
  if (!usuario.correo) return
  cargando.value = true
  try {
    const res = await fetch(
      `/api/reporte/${encodeURIComponent(usuario.correo)}/dia/${fecha.value}`,
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    reporte.value = (await res.json()) as ReporteDia
  } catch (error) {
    console.error('Error al cargar el reporte del día:', error)
    reporte.value = null
  } finally {
    cargando.value = false
  }
}

/** Tras guardar una nueva atención desde esta pantalla. */
function alGuardar(nuevaFecha: string) {
  if (nuevaFecha === fecha.value) cargar()
  else router.push(`/atenciones/${nuevaFecha}`)
}

/**
 * Navega a la fecha actual +/- `dias`.
 * Usa `Date` para que cruce correctamente de mes y año.
 */
function cambiarDia(dias: number) {
  const { anio, mes, dia } = partes.value
  if (!anio || !mes || !dia) return

  const nueva = new Date(anio, mes - 1, dia + dias)
  const y = nueva.getFullYear()
  const m = String(nueva.getMonth() + 1).padStart(2, '0')
  const d = String(nueva.getDate()).padStart(2, '0')

  router.push(`/atenciones/${y}-${m}-${d}`)
}

onMounted(() => {
  if (!usuario.correo) return
  cargar()
})

watch(fecha, cargar)
</script>

<template>
  <main class="pagina">
    <div class="med-card">
      <header class="cabecera">
        <button type="button" class="volver" title="Volver" @click="router.push('/bienvenido')">
          <IconArrowLeft :size="20" stroke-width="1.5" />
        </button>
        <div class="titulo">
          <span class="etiqueta">Detalle de:</span>
          <h1>{{ titulo }}</h1>

          <div class="navegacion-dias">
            <button
              type="button"
              class="btn-dia"
              title="Día anterior"
              @click="cambiarDia(-1)"
            >
              <IconChevronLeft :size="16" stroke-width="1.5" />
              Día anterior
            </button>
            <button
              type="button"
              class="btn-dia"
              title="Próximo día"
              @click="cambiarDia(1)"
            >
              Próximo día
              <IconChevronRight :size="16" stroke-width="1.5" />
            </button>
          </div>
        </div>
      </header>
      <p v-if="cargando" class="estado">Cargando...</p>

      <template v-else-if="reporte && reporte.total > 0">
        <div class="total">
          <span class="total-etiqueta">
            <IconUsers :size="22" stroke-width="1.5" />
            Total de atendidos
          </span>
          <span class="total-numero">{{ reporte.total }}</span>
        </div>

        <p class="subtitulo">Servicios realizados:</p>

        <ul class="lista">
          <li v-for="f in filas" :key="f.servicio">
            <button type="button" class="fila" @click="seleccion = f">
              <span class="fila-izq">
                <IconChevronRight :size="18" stroke-width="1.5" class="chevron" />
                <span class="nombre">{{ f.servicio }}</span>
              </span>
              <span class="valor">{{ f.atendidos }}</span>
            </button>
          </li>
        </ul>
      </template>

      <div v-else class="vacio">
        <IconMessageCircleSearch :size="40" stroke-width="1.5" />
        <p>No hay registros.</p>
      </div>
    </div>

    <AgregarAtencion
      :dia-inicial="partes.dia"
      :mes-inicial="partes.mes"
      :anio-inicial="partes.anio"
      @guardado="alGuardar"
    />

    <EditarAtencion
      v-if="seleccion"
      :fecha="fecha"
      :servicio="seleccion.servicio"
      :atendidos="seleccion.atendidos"
      @cerrado="seleccion = null"
      @cambiado="cargar"
    />
  </main>
</template>

<style scoped>
.pagina {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1rem;
  padding-bottom: calc(1rem + var(--menu-alto));
}

.med-card {
  width: 460px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cabecera {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.6rem;
}

.titulo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  width: 100%;
}

.etiqueta {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--med-text-muted);
}

.cabecera h1 {
  margin: 0;
  font-size: 1.4rem;
  text-align: left;
}

/* Navegación entre días (botones blancos, uno a cada extremo) */
.navegacion-dias {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  margin-top: 0.4rem;
}

.btn-dia {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.7rem;
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--med-text);
  background: var(--med-surface);
  border: 1.5px solid var(--med-border);
  border-radius: var(--med-radius-sm);
  transition: background var(--med-transition), border-color var(--med-transition),
    color var(--med-transition);
}

.btn-dia:hover {
  transform: none;
  box-shadow: none;
  color: var(--med-blue-700);
  background: var(--med-blue-50);
  border-color: var(--med-blue-400);
}

.volver {
  padding: 0.3rem;
  background: transparent;
  color: var(--med-blue-700);
  border: 1.5px solid var(--med-border);
  display: flex;
}

.volver:hover {
  transform: none;
  background: var(--med-blue-50);
  box-shadow: none;
}

.total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.5rem;
  font-weight: 700;
  color: var(--med-blue-700);
  margin: 0;
}

.total-etiqueta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.total-numero {
  font-size: 1.15rem;
}

.subtitulo {
  margin: 0 0 0.25rem;
  text-align: left;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--med-text-muted);
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.lista li {
  border-bottom: 1px solid var(--med-border);
}

.lista li:last-child {
  border-bottom: none;
}

.fila {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  padding: 0.95rem 0.5rem;
  background: transparent;
  color: var(--med-text);
  font-size: 1rem;
  font-weight: 500;
  text-align: left;
  border-radius: var(--med-radius-sm);
  transition: background var(--med-transition);
}

.fila:hover {
  transform: none;
  box-shadow: none;
  background: var(--med-blue-50);
}

.fila-izq {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.chevron {
  flex-shrink: 0;
  color: var(--med-blue-400);
  transition: transform var(--med-transition);
}

.fila:hover .chevron {
  transform: translateX(2px);
  color: var(--med-blue-600);
}

.nombre {
  text-align: left;
}

.valor {
  font-weight: 700;
  color: var(--med-blue-600);
  white-space: nowrap;
}

.vacio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 0;
  color: var(--med-text-muted);
}

.estado {
  color: var(--med-text-muted);
}
</style>

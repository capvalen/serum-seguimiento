<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  IconUserPlus,
  IconX,
  IconCalendar,
  IconCalendarMonth,
  IconCalendarEvent,
  IconStethoscope,
  IconUsers,
  IconDeviceFloppy,
} from '@tabler/icons-vue'
import { useUsuarioStore } from '@/stores/usuario'
import { useToastStore } from '@/stores/toast'

const props = withDefaults(
  defineProps<{
    /** Mes a preseleccionar al abrir (1-12). Por defecto, el mes actual. */
    mesInicial?: number
    /** Año a preseleccionar al abrir. Por defecto, el año actual. */
    anioInicial?: number
  }>(),
  { mesInicial: 0, anioInicial: 0 },
)

const emit = defineEmits<{ guardado: [fecha: string] }>()

const usuario = useUsuarioStore()
const toast = useToastStore()

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const ANIO_INICIO = 2026
const hoy = new Date()

const abierto = ref(false)

// Valores del formulario (por defecto: hoy).
const dia = ref(hoy.getDate())
const mes = ref(hoy.getMonth() + 1)
const anio = ref(hoy.getFullYear())
const servicio = ref('')
const atendidos = ref<number | null>(null)

/** Años desde 2026 hasta el año actual (inclusive). */
const anios = computed(() => {
  const fin = Math.max(hoy.getFullYear(), ANIO_INICIO)
  const lista: number[] = []
  for (let a = ANIO_INICIO; a <= fin; a++) lista.push(a)
  return lista
})

/** Número de días del mes/año seleccionado (28, 29, 30 o 31). */
const diasEnMes = computed(() => new Date(anio.value, mes.value, 0).getDate())

/** Lista 1..diasEnMes. */
const dias = computed(() =>
  Array.from({ length: diasEnMes.value }, (_, i) => i + 1),
)

/** Solo la primera letra en mayúscula (ej. "triaje" -> "Triaje"). */
function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * Servicios ordenados alfabéticamente (asc).
 * `valor` mantiene el texto original (clave del KV) y `label` la primera letra en mayúscula.
 */
const serviciosOrdenados = computed(() =>
  [...usuario.servicios]
    .sort((a, b) => a.servicio.localeCompare(b.servicio))
    .map((s) => ({ valor: s.servicio, label: capitalizar(s.servicio) })),
)

/** Fecha ISO `YYYY-MM-DD` de la selección actual. */
const claveFecha = computed(
  () =>
    `${anio.value}-${String(mes.value).padStart(2, '0')}-${String(dia.value).padStart(2, '0')}`,
)

/** Fecha seleccionada formateada en español: "Lunes, 3 mar. 2026". */
const fechaLarga = computed(() => {
  const d = new Date(anio.value, mes.value - 1, dia.value)
  const partes = new Intl.DateTimeFormat('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(d)

  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? ''

  const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const diaTexto = valor('day')
  const mesTexto = valor('month').replace(/\.$/, '')
  const anioTexto = valor('year')
  const semanaTexto = capitalizar(valor('weekday'))

  return `${semanaTexto}, ${diaTexto} ${mesTexto}. ${anioTexto}`
})

// Si el día elegido supera el máximo del mes, se ajusta (ej. 31 -> 28 en febrero).
watch([mes, anio], () => {
  if (dia.value > diasEnMes.value) dia.value = diasEnMes.value
})

const guardando = ref(false)

/** Se activa al pulsar el botón flotante para disparar el salto. */
const saltando = ref(false)

/** Abre el modal y prepara el formulario. */
function abrir() {
  // Reinicia la animación de salto.
  saltando.value = false
  requestAnimationFrame(() => {
    saltando.value = true
    setTimeout(() => {
      saltando.value = false
    }, 700)
  })

  const d = new Date()
  // Preselecciona el mes/año indicados; si no se pasan, usa el mes actual.
  const mesAbierto = props.mesInicial || d.getMonth() + 1
  const anioAbierto = props.anioInicial || d.getFullYear()
  anio.value = anioAbierto
  mes.value = mesAbierto
  // Día: el de hoy si coincide con el mes/año mostrados; si no, el día 1.
  const esMesActual =
    anioAbierto === d.getFullYear() && mesAbierto === d.getMonth() + 1
  const maxDia = new Date(anioAbierto, mesAbierto, 0).getDate()
  dia.value = esMesActual ? Math.min(d.getDate(), maxDia) : 1
  servicio.value = serviciosOrdenados.value[0]?.valor ?? ''
  atendidos.value = null
  abierto.value = true
}

function cerrar() {
  abierto.value = false
}

async function guardar() {
  if (!servicio.value || atendidos.value === null || atendidos.value < 0) return

  guardando.value = true
  try {
    const res = await fetch(
      `/api/atenciones/${encodeURIComponent(usuario.correo)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: claveFecha.value,
          // Se envía con la primera letra en mayúscula y el resto tal cual.
          servicio: capitalizar(servicio.value),
          atendidos: atendidos.value,
        }),
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    toast.mostrar('Atención registrada')
    emit('guardado', claveFecha.value)
    cerrar()
  } catch (error) {
    console.error('Error al registrar la atención:', error)
    toast.mostrar('No se pudo registrar', 'error')
  } finally {
    guardando.value = false
  }
}

// Asegura tener los servicios cargados aunque no se haya pasado por el login.
onMounted(() => {
  if (!usuario.servicios.length) usuario.cargarDatos()
})
</script>

<template>
  <!-- Botón flotante siempre visible en la esquina inferior derecha -->
  <button
    type="button"
    class="fab"
    :class="{ saltando }"
    title="Agregar atención"
    aria-label="Agregar atención"
    @click="abrir"
  >
    <span class="fab-anillo" aria-hidden="true"></span>
    <IconUserPlus class="fab-icono" :size="30" stroke-width="2.25" />
    <span class="fab-etiqueta">Agregar atención</span>
  </button>

  <!-- Modal -->
  <Transition name="modal">
    <div v-if="abierto" class="overlay" @click.self="cerrar">
      <div class="modal med-card" role="dialog" aria-modal="true">
        <header class="modal-head">
          <h2>Agregar atención</h2>
          <button type="button" class="cerrar" title="Cerrar" @click="cerrar">
            <IconX :size="18" stroke-width="1.5" />
          </button>
        </header>

        <div class="campo-fila">
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

        <div class="campo-dia">
          <label class="campo-ancho">
            <IconCalendarEvent :size="18" stroke-width="1.5" />
            <select v-model.number="dia">
              <option v-for="d in dias" :key="d" :value="d">{{ d }}</option>
            </select>
          </label>
          <p class="fecha-seleccionada">Fecha seleccionada: {{ fechaLarga }}</p>
        </div>

        <label class="campo-ancho">
          <IconStethoscope :size="18" stroke-width="1.5" />
          <select v-model="servicio">
            <option v-for="s in serviciosOrdenados" :key="s.valor" :value="s.valor">
              {{ s.label }}
            </option>
          </select>
        </label>

        <label class="campo-ancho">
          <IconUsers :size="18" stroke-width="1.5" />
          <input
            v-model.number="atendidos"
            type="number"
            min="0"
            placeholder="Número de atendidos"
          />
        </label>

        <div class="acciones">
          <button type="button" class="secundario" @click="cerrar">Cancelar</button>
          <button
            type="button"
            :disabled="guardando || !servicio || atendidos === null"
            @click="guardar"
          >
            <IconDeviceFloppy :size="18" stroke-width="1.5" />
            {{ guardando ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fab {
  position: fixed;
  right: 1.75rem;
  /* Se eleva por encima del menú inferior. */
  bottom: calc(1.25rem + var(--menu-alto));
  z-index: 1000;

  width: 64px;
  height: 64px;
  padding: 0;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  color: #fff;
  background: linear-gradient(140deg, var(--med-blue-500), var(--med-blue-700));
  box-shadow:
    0 8px 20px rgba(13, 71, 161, 0.35),
    0 2px 6px rgba(13, 71, 161, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);

  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.25s ease, filter 0.25s ease;
}

.fab:hover {
  transform: translateY(-3px) scale(1.08);
  filter: brightness(1.08);
  box-shadow:
    0 14px 30px rgba(13, 71, 161, 0.45),
    0 4px 10px rgba(13, 71, 161, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.fab:active {
  transform: translateY(0) scale(0.96);
  box-shadow:
    0 4px 12px rgba(13, 71, 161, 0.35),
    inset 0 2px 6px rgba(10, 42, 74, 0.35);
}

/* Salto vertical al pulsar (arriba y abajo). */
.fab.saltando {
  animation: fab-salto 0.7s cubic-bezier(0.28, 0.84, 0.42, 1);
}

@keyframes fab-salto {
  0% {
    transform: translateY(0) scale(1);
  }
  25% {
    transform: translateY(-22px) scale(1.06);
  }
  50% {
    transform: translateY(0) scale(0.96);
  }
  70% {
    transform: translateY(-10px) scale(1.03);
  }
  85% {
    transform: translateY(0) scale(0.98);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}

.fab-icono {
  position: relative;
  z-index: 1;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fab:hover .fab-icono {
  transform: scale(1.15);
}

/* Anillo pulsante que llama la atención */
.fab-anillo {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--med-blue-400);
  animation: fab-pulso 2.4s ease-out infinite;
  pointer-events: none;
}

@keyframes fab-pulso {
  0% {
    transform: scale(1);
    opacity: 0.7;
  }
  70% {
    transform: scale(1.55);
    opacity: 0;
  }
  100% {
    transform: scale(1.55);
    opacity: 0;
  }
}

/* Etiqueta que aparece al pasar el ratón */
.fab-etiqueta {
  position: absolute;
  right: calc(100% + 0.75rem);
  white-space: nowrap;
  padding: 0.4rem 0.7rem;
  border-radius: var(--med-radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
  background: var(--med-blue-900);
  box-shadow: var(--med-shadow);

  opacity: 0;
  transform: translateX(0.5rem);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
}

.fab:hover .fab-etiqueta {
  opacity: 1;
  transform: translateX(0);
}

@media (prefers-reduced-motion: reduce) {
  .fab-anillo {
    animation: none;
  }
  .fab.saltando {
    animation: none;
  }
  .fab:hover,
  .fab:hover .fab-icono {
    transform: none;
  }
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(10, 42, 74, 0.45);
}

.modal {
  width: 460px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-head h2 {
  margin: 0;
  font-size: 1.25rem;
}

.cerrar {
  padding: 0.25rem;
  background: transparent;
  color: var(--med-text-muted);
  display: flex;
}

.cerrar:hover {
  transform: none;
  box-shadow: none;
  color: var(--med-error);
}

.campo-fila {
  display: flex;
  gap: 0.75rem;
}

.campo-fila label,
.campo-ancho {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex: 1;
  color: var(--med-text-muted);
}

/* El icono no se encoge y queda separado del control. */
.campo-fila label > svg,
.campo-ancho > svg {
  flex-shrink: 0;
}

.campo-fila select,
.campo-ancho select {
  cursor: pointer;
}

.campo-dia {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.fecha-seleccionada {
  margin: 0;
  padding-left: 1.9rem; /* alinea con el texto del select, tras el icono */
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--med-blue-700);
}

.campo-ancho input {
  border: none;
  padding-left: 0;
  background: transparent;
}

.acciones {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.acciones button {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.secundario {
  background: transparent;
  color: var(--med-blue-700);
  border: 1.5px solid var(--med-border);
}

.secundario:hover:not(:disabled) {
  background: var(--med-blue-50);
  box-shadow: none;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>

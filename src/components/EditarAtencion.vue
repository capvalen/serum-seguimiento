<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IconX,
  IconStethoscope,
  IconUsers,
  IconDeviceFloppy,
  IconTrash,
} from '@tabler/icons-vue'
import { useUsuarioStore } from '@/stores/usuario'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{
  fecha: string
  servicio: string
  atendidos: number
}>()

const emit = defineEmits<{
  cerrado: []
  cambiado: []
}>()

const usuario = useUsuarioStore()
const toast = useToastStore()

/** Solo la primera letra en mayúscula (ej. "triaje" -> "Triaje"). */
function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

const servicio = ref(props.servicio)
const atendidos = ref<number | null>(props.atendidos)
const guardando = ref(false)
const eliminando = ref(false)

/** Servicios ordenados alfabéticamente, incluyendo el actual si no está en la lista. */
const serviciosOrdenados = computed(() => {
  const base = usuario.servicios.map((s) => s.servicio)
  const lista = base.includes(props.servicio) ? base : [...base, props.servicio]
  return lista
    .sort((a, b) => a.localeCompare(b))
    .map((s) => ({ valor: s, label: capitalizar(s) }))
})

function cerrar() {
  emit('cerrado')
}

/** Guarda los cambios (permite renombrar el servicio). */
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
          fecha: props.fecha,
          servicio: capitalizar(servicio.value),
          servicioOriginal: props.servicio,
          atendidos: atendidos.value,
        }),
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    toast.mostrar('Registro actualizado')
    emit('cambiado')
    cerrar()
  } catch (error) {
    console.error('Error al actualizar el registro:', error)
    toast.mostrar('No se pudo actualizar', 'error')
  } finally {
    guardando.value = false
  }
}

/** Elimina el registro del servicio en esta fecha. */
async function eliminar() {
  eliminando.value = true
  try {
    const res = await fetch(
      `/api/atenciones/${encodeURIComponent(usuario.correo)}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: props.fecha, servicio: props.servicio }),
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    toast.mostrar('Registro eliminado')
    emit('cambiado')
    cerrar()
  } catch (error) {
    console.error('Error al eliminar el registro:', error)
    toast.mostrar('No se pudo eliminar', 'error')
  } finally {
    eliminando.value = false
  }
}
</script>

<template>
  <div class="overlay" @click.self="cerrar">
    <div class="modal med-card" role="dialog" aria-modal="true">
      <header class="modal-head">
        <h2>Editar atención</h2>
        <button type="button" class="cerrar" title="Cerrar" @click="cerrar">
          <IconX :size="18" stroke-width="1.5" />
        </button>
      </header>

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
        <button
          type="button"
          class="eliminar"
          :disabled="guardando || eliminando"
          @click="eliminar"
        >
          <IconTrash :size="18" stroke-width="1.5" />
          {{ eliminando ? 'Eliminando...' : 'Eliminar' }}
        </button>

        <button
          type="button"
          :disabled="guardando || eliminando || !servicio || atendidos === null"
          @click="guardar"
        >
          <IconDeviceFloppy :size="18" stroke-width="1.5" />
          {{ guardando ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.campo-ancho {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--med-text-muted);
}

.campo-ancho > svg {
  flex-shrink: 0;
}

.campo-ancho select {
  cursor: pointer;
}

.campo-ancho input {
  border: none;
  padding-left: 0;
  background: transparent;
}

.acciones {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.acciones button {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.eliminar {
  background: transparent;
  color: var(--med-error);
  border: 1.5px solid #f2c4c4;
}

.eliminar:hover:not(:disabled) {
  background: #fdecec;
  box-shadow: none;
}
</style>

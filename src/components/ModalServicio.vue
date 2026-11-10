<script setup lang="ts">
import { ref } from 'vue'
import {
  IconX,
  IconStethoscope,
  IconAbc,
  IconDeviceFloppy,
} from '@tabler/icons-vue'
import { useUsuarioStore, type Servicio } from '@/stores/usuario'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{
  /** Si viene un servicio, el modal está en modo edición. */
  servicio?: Servicio
}>()

const emit = defineEmits<{ cerrado: []; guardado: [] }>()

const usuario = useUsuarioStore()
const toast = useToastStore()

const esEdicion = Boolean(props.servicio)
const nombre = ref(props.servicio?.servicio ?? '')
const abreviatura = ref(props.servicio?.abreviatura ?? '')
const guardando = ref(false)

function cerrar() {
  emit('cerrado')
}

async function guardar() {
  if (!nombre.value.trim()) return

  guardando.value = true
  try {
    const url = `/api/servicios/${encodeURIComponent(usuario.correo)}`
    const res = await fetch(url, {
      method: esEdicion ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        servicioOriginal: props.servicio?.servicio,
        servicio: nombre.value,
        abreviatura: abreviatura.value,
      }),
    })

    const datos = (await res.json()) as { servicios?: Servicio[]; error?: string }
    if (!res.ok) throw new Error(datos.error ?? `HTTP ${res.status}`)

    usuario.setServicios(datos.servicios ?? [])
    toast.mostrar(esEdicion ? 'Servicio actualizado' : 'Servicio agregado')
    emit('guardado')
    cerrar()
  } catch (error) {
    console.error('Error al guardar el servicio:', error)
    toast.mostrar(error instanceof Error ? error.message : 'No se pudo guardar', 'error')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="overlay" @click.self="cerrar">
    <div class="modal med-card" role="dialog" aria-modal="true">
      <header class="modal-head">
        <h2>{{ esEdicion ? 'Editar servicio' : 'Nuevo servicio' }}</h2>
        <button type="button" class="cerrar" title="Cerrar" @click="cerrar">
          <IconX :size="18" stroke-width="1.5" />
        </button>
      </header>

      <label class="campo">
        <IconStethoscope :size="18" stroke-width="1.5" />
        <input
          v-model="nombre"
          type="text"
          placeholder="Nombre del servicio"
          @keyup.enter="guardar"
        />
      </label>

      <label class="campo">
        <IconAbc :size="18" stroke-width="1.5" />
        <input
          v-model="abreviatura"
          type="text"
          placeholder="Abreviatura (opcional)"
          @keyup.enter="guardar"
        />
      </label>

      <p class="ayuda">
        El nombre se guarda con la primera letra en mayúscula y el resto en minúscula.
      </p>

      <div class="acciones">
        <button type="button" class="secundario" @click="cerrar">Cancelar</button>
        <button
          type="button"
          :disabled="guardando || !nombre.trim()"
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
  width: 420px;
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

.campo {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0 0.75rem;
  color: var(--med-text-muted);
  background: var(--med-surface);
  border: 1.5px solid var(--med-border);
  border-radius: var(--med-radius-sm);
  transition: border-color var(--med-transition), box-shadow var(--med-transition);
}

.campo:focus-within {
  border-color: var(--med-blue-500);
  box-shadow: 0 0 0 4px rgba(30, 136, 229, 0.15);
}

.campo > svg {
  flex-shrink: 0;
}

.campo input {
  border: none;
  padding-left: 0;
  background: transparent;
}

.campo input:focus {
  box-shadow: none;
}

.ayuda {
  margin: 0;
  font-size: 0.8rem;
  color: var(--med-text-muted);
}

.acciones {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
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
</style>

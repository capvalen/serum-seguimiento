<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  IconSettings,
  IconPlus,
  IconPencil,
  IconTrash,
  IconAlertTriangle,
  IconCalendar,
  IconBuildingHospital,
  IconShieldCheck,
  IconDeviceFloppy,
} from '@tabler/icons-vue'
import {
  useUsuarioStore,
  type Servicio,
  type Establecimiento,
} from '@/stores/usuario'
import { useToastStore } from '@/stores/toast'
import ModalServicio from '@/components/ModalServicio.vue'

const usuario = useUsuarioStore()
const toast = useToastStore()

/** null = modal cerrado; { servicio } = modal de edición. */
const modal = ref<{ servicio?: Servicio } | null>(null)

/** Servicio pendiente de confirmar eliminación. */
const porEliminar = ref<Servicio | null>(null)
const eliminando = ref(false)

/** Servicios ordenados alfabéticamente. */
const lista = computed(() =>
  [...usuario.servicios].sort((a, b) => a.servicio.localeCompare(b.servicio)),
)

function abrirCrear() {
  modal.value = {}
}

function abrirEditar(servicio: Servicio) {
  modal.value = { servicio }
}

async function eliminar() {
  if (!porEliminar.value) return

  eliminando.value = true
  try {
    const res = await fetch(
      `/api/servicios/${encodeURIComponent(usuario.correo)}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicio: porEliminar.value.servicio }),
      },
    )
    const datos = (await res.json()) as { servicios?: Servicio[]; error?: string }
    if (!res.ok) throw new Error(datos.error ?? `HTTP ${res.status}`)

    usuario.setServicios(datos.servicios ?? [])
    toast.mostrar('Servicio eliminado')
  } catch (error) {
    console.error('Error al eliminar el servicio:', error)
    toast.mostrar('No se pudo eliminar', 'error')
  } finally {
    eliminando.value = false
    porEliminar.value = null
  }
}

/* ------------------------------ Establecimiento ----------------------------- */

/** Copia editable del establecimiento (se guarda al pulsar el botón). */
const form = ref<Establecimiento>({ ...usuario.establecimiento })
const guardandoEst = ref(false)

onMounted(async () => {
  await usuario.cargarDatos()
  form.value = { ...usuario.establecimiento }
})

async function guardarEstablecimiento() {
  guardandoEst.value = true
  try {
    const res = await fetch(
      `/api/establecimiento/${encodeURIComponent(usuario.correo)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form.value),
      },
    )
    const datos = (await res.json()) as {
      establecimiento?: Establecimiento
      error?: string
    }
    if (!res.ok) throw new Error(datos.error ?? `HTTP ${res.status}`)

    if (datos.establecimiento) {
      usuario.setEstablecimiento(datos.establecimiento)
      form.value = { ...datos.establecimiento }
    }
    toast.mostrar('Establecimiento guardado')
  } catch (error) {
    console.error('Error al guardar el establecimiento:', error)
    toast.mostrar('No se pudo guardar', 'error')
  } finally {
    guardandoEst.value = false
  }
}
</script>

<template>
  <main class="pagina">
    <div class="med-card">
      <header class="cabecera">
        <IconSettings :size="34" class="logo" stroke-width="1.5" />
        <div>
          <h1>Configuraciones</h1>
          <p v-if="usuario.correo" class="correo">{{ usuario.correo }}</p>
        </div>
      </header>

      <div class="seccion-head">
        <p class="subtitulo">Establecimiento</p>
      </div>

      <label class="campo">
        <IconCalendar :size="18" stroke-width="1.5" />
        <input v-model="form.anio" type="text" placeholder="Año" />
      </label>

      <label class="campo">
        <IconBuildingHospital :size="18" stroke-width="1.5" />
        <input
          v-model="form.centroSalud"
          type="text"
          placeholder="Centro de salud"
        />
      </label>

      <div class="campo-tipo">
        <span class="campo-etiqueta">
          <IconShieldCheck :size="18" stroke-width="1.5" />
          Tipo Serum
        </span>
        <div class="switch" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="form.tipoSerum === 'remunerada'"
            :class="{ activo: form.tipoSerum === 'remunerada' }"
            @click="form.tipoSerum = 'remunerada'"
          >
            Remunerada
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="form.tipoSerum === 'equivalente'"
            :class="{ activo: form.tipoSerum === 'equivalente' }"
            @click="form.tipoSerum = 'equivalente'"
          >
            Equivalente
          </button>
        </div>
      </div>

      <button
        type="button"
        class="btn-guardar"
        :disabled="guardandoEst"
        @click="guardarEstablecimiento"
      >
        <IconDeviceFloppy :size="18" stroke-width="1.5" />
        {{ guardandoEst ? 'Guardando...' : 'Guardar establecimiento' }}
      </button>

      <div class="seccion-head">
        <p class="subtitulo">Servicios</p>
        <button type="button" class="btn-agregar" @click="abrirCrear">
          <IconPlus :size="18" stroke-width="1.5" />
          Agregar
        </button>
      </div>

      <ul v-if="lista.length" class="lista">
        <li v-for="s in lista" :key="s.servicio">
          <div class="info">
            <span class="nombre">{{ s.servicio }}</span>
            <span v-if="s.abreviatura" class="abrev">{{ s.abreviatura }}</span>
          </div>
          <div class="ops">
            <button type="button" class="op" title="Editar" @click="abrirEditar(s)">
              <IconPencil :size="18" stroke-width="1.5" />
            </button>
            <button
              type="button"
              class="op peligro"
              title="Eliminar"
              @click="porEliminar = s"
            >
              <IconTrash :size="18" stroke-width="1.5" />
            </button>
          </div>
        </li>
      </ul>

      <p v-else class="vacio">Aún no hay servicios registrados.</p>
    </div>

    <ModalServicio
      v-if="modal"
      :servicio="modal.servicio"
      @cerrado="modal = null"
    />

    <!-- Confirmación de eliminación -->
    <div v-if="porEliminar" class="overlay" @click.self="porEliminar = null">
      <div class="confirmar med-card" role="alertdialog" aria-modal="true">
        <IconAlertTriangle :size="34" class="aviso" stroke-width="1.5" />
        <h2>Eliminar servicio</h2>
        <p>
          ¿Seguro que quieres eliminar
          <strong>{{ porEliminar.servicio }}</strong>?
        </p>
        <p class="nota">Las atenciones ya registradas no se borrarán.</p>

        <div class="acciones">
          <button type="button" class="secundario" @click="porEliminar = null">
            Cancelar
          </button>
          <button type="button" class="eliminar" :disabled="eliminando" @click="eliminar">
            <IconTrash :size="18" stroke-width="1.5" />
            {{ eliminando ? 'Eliminando...' : 'Eliminar' }}
          </button>
        </div>
      </div>
    </div>
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
  align-items: center;
  gap: 0.75rem;
}

.logo {
  flex-shrink: 0;
  color: var(--med-blue-600);
}

.cabecera h1 {
  margin: 0;
  font-size: 1.4rem;
  text-align: left;
}

.correo {
  margin: 0.1rem 0 0;
  color: var(--med-text-muted);
  font-size: 0.85rem;
  text-align: left;
}

.seccion-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.subtitulo {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--med-text-muted);
}

.btn-agregar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  font-size: 0.85rem;
}

/* Campo con icono + input dentro de un borde (igual que en los modales). */
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

.campo-tipo {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.campo-etiqueta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--med-text-muted);
}

.switch {
  display: flex;
  width: 100%;
  padding: 0.25rem;
  gap: 0.25rem;
  background: var(--med-blue-100);
  border: 1px solid var(--med-border);
  border-radius: var(--med-radius-sm);
}

.switch button {
  flex: 1;
  padding: 0.5rem 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--med-blue-700);
  background: transparent;
  box-shadow: none;
  border-radius: calc(var(--med-radius-sm) - 3px);
}

.switch button:hover:not(.activo) {
  transform: none;
  box-shadow: none;
  background: rgba(255, 255, 255, 0.6);
}

.switch button.activo {
  background: var(--med-surface);
  box-shadow: var(--med-shadow);
}

.switch button.activo:hover {
  transform: none;
}

.btn-guardar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.lista li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 0.25rem;
  border-bottom: 1px solid var(--med-border);
}

.lista li:last-child {
  border-bottom: none;
}

.info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.nombre {
  text-align: left;
  font-weight: 600;
}

.abrev {
  font-size: 0.78rem;
  color: var(--med-text-muted);
  text-align: left;
}

.ops {
  display: flex;
  gap: 0.35rem;
  flex-shrink: 0;
}

.op {
  padding: 0.4rem;
  background: transparent;
  color: var(--med-blue-700);
  border: 1.5px solid var(--med-border);
  display: flex;
}

.op:hover {
  transform: none;
  background: var(--med-blue-50);
  box-shadow: none;
}

.op.peligro {
  color: var(--med-error);
  border-color: #f2c4c4;
}

.op.peligro:hover {
  background: #fdecec;
}

.vacio {
  margin: 0;
  padding: 1rem 0;
  color: var(--med-text-muted);
  text-align: center;
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 1600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(10, 42, 74, 0.45);
}

.confirmar {
  width: 380px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
}

.aviso {
  color: var(--med-error);
}

.confirmar h2 {
  margin: 0;
  font-size: 1.2rem;
}

.confirmar p {
  margin: 0;
}

.nota {
  font-size: 0.8rem;
  color: var(--med-text-muted);
}

.acciones {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
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

.eliminar {
  background: var(--med-error);
}
</style>

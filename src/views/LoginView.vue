<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { IconStethoscope, IconMail, IconLogin2 } from '@tabler/icons-vue'
import { useUsuarioStore, type Servicio } from '@/stores/usuario'

interface DatosUsuario {
  servicios: Servicio[]
}

const router = useRouter()
const usuario = useUsuarioStore()

// Precarga el último correo guardado en localStorage (kv_correo).
const correo = ref(usuario.correo)
const cargando = ref(false)

async function iniciar() {
  if (!correo.value) return

  cargando.value = true
  try {
    const res = await fetch(`/api/datos/${encodeURIComponent(correo.value)}`)
    const datos: DatosUsuario = await res.json()

    // Guarda los servicios en el store global de Pinia.
    usuario.setDatos(correo.value, datos.servicios ?? [])

    // Navega a la pantalla de bienvenida.
    router.push('/bienvenido')
  } catch (error) {
    console.error('Error al consultar /api/datos:', error)
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <main class="login">
    <div class="med-card">
      <IconStethoscope :size="48" class="logo" stroke-width="1.5" />
      <h1>Iniciar sesión</h1>

      <form @submit.prevent="iniciar">
        <div class="campo">
          <IconMail :size="20" stroke-width="1.5" />
          <input
            v-model="correo"
            type="email"
            placeholder="Correo electrónico"
            autocomplete="email"
          />
        </div>
        <button type="submit" :disabled="cargando">
          <IconLogin2 :size="20" stroke-width="1.5" />
          {{ cargando ? 'Cargando...' : 'Iniciar' }}
        </button>
      </form>
    </div>
  </main>
</template>

<style scoped>
.login {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1rem;
}

.med-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 340px;
  text-align: center;
}

.logo {
  color: var(--med-blue-600);
}

h1 {
  margin: 0;
  font-size: 1.6rem;
}

form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  width: 100%;
  margin-top: 0.5rem;
}

.campo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

.campo input {
  border: none;
  padding-left: 0;
  background: transparent;
}

.campo input:focus {
  box-shadow: none;
}

button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
</style>

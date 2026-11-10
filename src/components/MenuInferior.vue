<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IconHome,
  IconSettings,
  IconLogout,
} from '@tabler/icons-vue'
import { useUsuarioStore } from '@/stores/usuario'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const router = useRouter()
const usuario = useUsuarioStore()
const toast = useToastStore()

const activa = computed(() => route.name)

/** "Principal" engloba también el detalle de una fecha. */
const enPrincipal = computed(
  () => activa.value === 'bienvenido' || activa.value === 'atenciones-fecha',
)

/** Cierra la sesión: limpia el estado y vuelve al login. */
function salir() {
  usuario.limpiar()
  toast.mostrar('Sesión cerrada')
  router.push('/')
}
</script>

<template>
  <nav class="menu" role="navigation" aria-label="Menú principal">
    <RouterLink to="/bienvenido" class="item" :class="{ activo: enPrincipal }">
      <IconHome :size="22" stroke-width="1.5" />
      <span>Principal</span>
    </RouterLink>

    <RouterLink
      to="/configuracion"
      class="item"
      :class="{ activo: activa === 'configuracion' }"
    >
      <IconSettings :size="22" stroke-width="1.5" />
      <span>Configuraciones</span>
    </RouterLink>

    <button type="button" class="item" @click="salir">
      <IconLogout :size="22" stroke-width="1.5" />
      <span>Salir</span>
    </button>
  </nav>
</template>

<style scoped>
.menu {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1200;

  display: flex;
  align-items: stretch;
  justify-content: space-around;
  height: var(--menu-alto);
  padding: 0.25rem 0.5rem;
  background: var(--med-surface);
  border-top: 1px solid var(--med-border);
  box-shadow: 0 -4px 16px rgba(13, 71, 161, 0.08);
}

.item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;

  padding: 0.25rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--med-text-muted);
  text-decoration: none;
  background: transparent;
  border: none;
  border-radius: var(--med-radius-sm);
  cursor: pointer;
  transition: color var(--med-transition), background var(--med-transition);
}

.item:hover {
  transform: none;
  box-shadow: none;
  color: var(--med-blue-600);
  background: var(--med-blue-50);
}

.item.activo {
  color: var(--med-blue-700);
}

.item.activo span {
  font-weight: 700;
}
</style>

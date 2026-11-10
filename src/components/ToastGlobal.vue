<script setup lang="ts">
import { IconCircleCheck, IconAlertCircle, IconX } from '@tabler/icons-vue'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <Transition name="toast">
    <div v-if="toast.visible" class="toast" :class="toast.tipo" role="status">
      <IconCircleCheck
        v-if="toast.tipo === 'exito'"
        :size="22"
        stroke-width="1.5"
      />
      <IconAlertCircle v-else :size="22" stroke-width="1.5" />

      <span class="toast-texto">{{ toast.mensaje }}</span>

      <button type="button" class="toast-cerrar" title="Cerrar" @click="toast.ocultar">
        <IconX :size="16" stroke-width="1.5" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: calc(1rem + var(--menu-alto));
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;

  display: flex;
  align-items: center;
  gap: 0.6rem;
  max-width: calc(100vw - 2rem);
  padding: 0.75rem 1rem;
  border-radius: var(--med-radius-sm);
  color: #fff;
  box-shadow: var(--med-shadow-hover);
}

.toast.exito {
  background: var(--med-success);
}

.toast.error {
  background: var(--med-error);
}

.toast-texto {
  font-weight: 600;
}

.toast-cerrar {
  padding: 0.15rem;
  background: transparent;
  border: none;
  color: inherit;
  opacity: 0.85;
  cursor: pointer;
  display: flex;
}

.toast-cerrar:hover {
  opacity: 1;
  transform: none;
  box-shadow: none;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 1rem);
}
</style>

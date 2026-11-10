<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import ToastGlobal from '@/components/ToastGlobal.vue'
import MenuInferior from '@/components/MenuInferior.vue'

const route = useRoute()
</script>

<template>
  <RouterView />
  <MenuInferior v-if="route.meta.menu" />
  <ToastGlobal />
</template>

<script setup>
import { useRouter } from 'vue-router';
defineProps({ title: String, subtitle: String, eyebrow: { type: String, default: 'Riwayat Customer' } });
const router = useRouter();
</script>
<template>
  <header class="sales-header">
    <button aria-label="Kembali" @click="router.back()"><font-awesome-icon icon="chevron-left" /></button>
    <div><p class="sales-eyebrow">{{ eyebrow }}</p><h1>{{ title }}</h1><p v-if="subtitle">{{ subtitle }}</p></div>
    <slot />
  </header>
</template>

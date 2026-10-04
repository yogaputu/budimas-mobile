import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useConnectivityStore = defineStore('connectivity', () => {
  // Gunakan navigator.onLine sebagai nilai awal saja
  const isOnline = ref(
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true
  );

  const setOnlineStatus = (status) => {
    isOnline.value = !!status;
  };

  // Browser fallback listener (Capacitor Network listener disetup di App.vue)
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => setOnlineStatus(true));
    window.addEventListener('offline', () => setOnlineStatus(false));
  }

  return { isOnline, setOnlineStatus };
});

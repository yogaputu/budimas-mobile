<script setup>
import { ref, onMounted, onUnmounted } from 'vue'; // Tambahkan ref
import { useRouter, useRoute } from 'vue-router';
import { App as CapApp } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { useAuthStore } from '@/stores/auth';
import { useConnectivityStore } from '@/stores/connectivity';
import { SyncService } from '@/services/SyncService';
import { useSyncStore } from '@/stores/SyncStore';
import Swal from 'sweetalert2';
import { Camera } from '@capacitor/camera';
import { isNativeApp, syncEnabled } from '@/config/runtime';
import { ensureLocationPermission } from '@/utils/location';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const connectivity = useConnectivityStore();
const syncStore = useSyncStore();

// STATE LOADING
const isInitialLoading = ref(true); // Default true saat aplikasi dibuka

let networkListener = null;
let syncInterval = null;
let isSyncing = false;
let isAlive = true;
let lastSyncAt = 0;
let hasSyncedInSession = false;

const requestAppPermissions = async () => {
  try {
    // 1. Minta Izin Lokasi (GPS)
    await ensureLocationPermission();

    // 2. Minta Izin Kamera
    const camStatus = await Camera.checkPermissions();
    if (camStatus.camera !== 'granted') {
      await Camera.requestPermissions();
    }
    
    console.log("✅ Semua izin aplikasi telah diberikan.");
  } catch (error) {
    console.error("❌ Gagal meminta izin:", error);
  }
};

const MIN_SYNC_GAP_MS = 30000;

// =========================
// 🚫 ANDROID BACK BUTTON HANDLER
// =========================
const setupBackButton = async () => {
  await CapApp.addListener('backButton', async () => {
    if (syncStore.isSyncing) return;

    const path = route.path;
    if (path === '/dashboard' || path === '/login' || path === '/') {
      const result = await Swal.fire({
        title: 'Keluar Budimas?',
        text: 'Apakah Anda ingin menutup aplikasi?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Keluar',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#0f172a',
        cancelButtonColor: '#64748b',
        reverseButtons: true
      });

      if (result.isConfirmed) {
        CapApp.exitApp();
      }
    } else {
      router.back();
    }
  });
};

const resolveOnlineStatus = (statusNative) => {
  if (typeof statusNative?.connected === 'boolean') return statusNative.connected;
  if (statusNative === null) return connectivity.isOnline;
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') return navigator.onLine;
  return false;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldSkipSync = () => {
  const now = Date.now();
  return now - lastSyncAt < MIN_SYNC_GAP_MS;
};

const handleSyncAndStatus = async (statusNative = null, options = {}) => {
  const { allowImmediate = false } = options;
  if (!syncEnabled) {
    connectivity.setOnlineStatus(resolveOnlineStatus(statusNative));
    return;
  }
  try {
    const isOnline = resolveOnlineStatus(statusNative);
    connectivity.setOnlineStatus(isOnline);
    if (!isAlive || !auth.user || !isOnline || isSyncing) return;
    if (!allowImmediate && shouldSkipSync()) return;

    // Cek apakah hasSyncedAfterLogin sudah valid (hanya berlaku 1 jam)
    const lastSyncKey = 'app_last_session_sync';
    let skipDueToRecentSync = false;
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const lastSync = await Preferences.get({ key: lastSyncKey });
      if (lastSync?.value) {
        const diff = Date.now() - new Date(lastSync.value).getTime();
        skipDueToRecentSync = diff < 60 * 60 * 1000; // skip jika < 1 jam
      }
    } catch {}

    if (skipDueToRecentSync && hasSyncedInSession) return;

    isSyncing = true;
    const uploadResult = await SyncService.uploadAllPendingData();
    if (!uploadResult?.success) {
      lastSyncAt = Date.now();
      return;
    }

    await sleep(300);
    const downloadResult = await SyncService.downloadLightMasterData();
    if (downloadResult?.success) {
      hasSyncedInSession = true;
      try {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({ key: lastSyncKey, value: new Date().toISOString() });
      } catch {}
    }
    lastSyncAt = Date.now();
  } catch (error) {
    console.error('❌ Sync error:', error);
  } finally {
    isSyncing = false;
  }
};

onMounted(async () => {
  isAlive = true;
  isInitialLoading.value = true; // Pastikan loader muncul

  try {
    if (isNativeApp) {
      await requestAppPermissions();
    }

    await auth.checkAuth();
    if (isNativeApp) {
      setupBackButton();
    }

    // 3. Setup Network
    const statusAwal = await Network.getStatus();
    connectivity.setOnlineStatus(resolveOnlineStatus(statusAwal));

    networkListener = await Network.addListener('networkStatusChange', async (status) => {
      const wasOnline = connectivity.isOnline;
      const nowOnline = resolveOnlineStatus(status);
      connectivity.setOnlineStatus(nowOnline);
      if (syncEnabled && !wasOnline && nowOnline) {
        await handleSyncAndStatus(status, { allowImmediate: true });
      }
    });

    if (syncEnabled) {
      syncInterval = setInterval(async () => {
        const status = await Network.getStatus().catch(() => null);
        await handleSyncAndStatus(status, { allowImmediate: false });
      }, 60000);
    }

    // 4. Beri jeda sedikit agar transisi mulus
    await sleep(1500);

  } catch (error) {
    console.error('❌ App init error:', error);
  } finally {
    // LOADING SELESAI
    isInitialLoading.value = false;
  }
});

onUnmounted(async () => {
  isAlive = false;
  if (networkListener) await networkListener.remove();
  if (syncInterval) clearInterval(syncInterval);
});
</script>

<template>
  <div v-if="isInitialLoading" class="enterprise-initial-loader">
    <div class="loader-content">
      <div class="brand-logo">B</div>
      <div class="spinner-container">
        <div class="premium-spinner"></div>
      </div>
      <div class="loading-text">
        <h3>BUDIMAS ERP</h3>
        <p>Initializing Secure Session...</p>
      </div>
    </div>
  </div>

  <router-view v-if="!isInitialLoading" />
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

/* LOADER STYLES */
.enterprise-initial-loader {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at center, #1e293b, #0f172a);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.loader-content {
  text-align: center;
}

.brand-logo {
  font-size: 3.5rem;
  font-weight: 900;
  color: #3b82f6;
  margin-bottom: 20px;
  text-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
}

.spinner-container {
  width: 50px;
  height: 50px;
  margin: 0 auto 25px;
}

.premium-spinner {
  width: 100%;
  height: 100%;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
}

.loading-text h3 {
  margin: 0;
  letter-spacing: 3px;
  font-weight: 800;
}

.loading-text p {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-top: 8px;
}

/* ANIMASI TRANSISI */
.fade-out-leave-active {
  transition: all 0.6s ease-in-out;
}
.fade-out-leave-to {
  opacity: 0;
  transform: scale(1.05);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* GLOBAL STYLES */
body {
  margin: 0;
  padding: 0;
  background: var(--app-body-bg, #f8fafc);
  color: var(--app-body-text, #0f172a);
  font-family: 'Plus Jakarta Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
  overscroll-behavior-y: none; 
  transition: background 0.25s ease, color 0.25s ease;
}

* {
  -webkit-tap-highlight-color: transparent;
  user-select: none; 
}

input, textarea {
  user-select: auto;
}

</style>

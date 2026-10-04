<template>
  <div v-if="isInitialLoading" class="full-loading-screen">
    <div class="loader-wrapper">
      <div class="main-loader"></div>
      <p>Menghubungkan Budimas...</p>
    </div>
  </div>

  <template v-else>
  <div v-if="isOffline" class="offline-top-bar">
    MODE OFFLINE AKTIF · DATA LOKAL
  </div>

  <div
    ref="dashboardContainer"
    class="dashboard-container"
    @touchstart.passive="handleTouchStart"
    @touchmove.passive="handleTouchMove"
    @touchend.passive="handleTouchEnd"
    @touchcancel.passive="handleTouchEnd"
  >
    <div
      class="pull-to-refresh-layer"
      :style="{ height: pullDistance + 'px', opacity: pullDistance / 80 }"
    >
      <div class="refresh-content" :class="{ 'is-refreshing': loading }">
        <span v-if="!loading">{{ pullDistance > 65 ? 'Lepaskan untuk refresh' : 'Tarik untuk refresh' }}</span>
        <div v-else class="loader-mini"></div>
      </div>
    </div>

    <header class="hero-header">
      <div class="hero-overlay"></div>
      <div class="hero-grid"></div>

      <div class="hero-top">
        <div class="hero-user">
          <div class="user-avatar">{{ displayInitial }}</div>
          <div class="user-info">
            <p class="welcome-text">Selamat datang kembali</p>
            <h3 class="user-name">{{ displayName }}</h3>
            <p class="hero-date">{{ todayLabel }}</p>
          </div>
        </div>

        <div class="hero-actions">
          <button
            @click="theme.toggleTheme"
            class="btn-theme-mode icon-action-btn"
            :aria-label="theme.isDark ? 'Aktifkan light theme' : 'Aktifkan dark theme'"
            :title="theme.isDark ? 'Light theme' : 'Dark theme'"
          >
            <font-awesome-icon :icon="theme.isDark ? 'sun' : 'moon'" />
          </button>
          <button
            @click="handleLogout"
            class="btn-logout icon-action-btn"
            aria-label="Keluar"
            title="Keluar"
          >
            <font-awesome-icon icon="sign-out-alt" />
          </button>
        </div>
      </div>

      <div class="hero-summary-card">
        <div class="hero-summary-left">
          <p class="hero-summary-label">Ringkasan Hari Ini</p>
          <h2 class="hero-summary-title">
            {{ isOffline ? 'Mode Offline Aktif' : (canCheckIn ? 'Siap Mulai Kunjungan' : 'Ada Kunjungan Aktif') }}
          </h2>
          <p class="hero-summary-subtitle">
            {{ isOffline ? 'Aplikasi menggunakan data lokal tersimpan.' : (canCheckIn ? 'Jadwal kunjungan siap dijalankan.' : 'Selesaikan kunjungan yang sedang berjalan.') }}
          </p>
        </div>

        <div class="hero-summary-right">
          <div class="role-badge" :class="{ 'role-offline': isOffline }">
            <font-awesome-icon :icon="isOffline ? 'exclamation-triangle' : 'map-marked-alt'" />
          </div>
          <div class="status-pill" :class="{ 'status-pill-offline': isOffline }">
            <span
              class="status-dot"
              :class="isOffline ? 'dot-offline' : (canCheckIn ? 'dot-success' : 'dot-pulse')"
            ></span>
            <font-awesome-icon :icon="isOffline ? 'database' : (canCheckIn ? 'check-circle' : 'clock')" />
            <span class="sr-only">{{ isOffline ? 'Local Data' : (canCheckIn ? 'Ready' : 'On Progress') }}</span>
          </div>
        </div>
      </div>

      <div class="hero-meta-row">
        <div class="hero-meta-card">
          <span class="hero-meta-label">Update Data</span>
          <strong>{{ lastUpdatedLabel }}</strong>
        </div>
        <div class="hero-meta-card">
          <span class="hero-meta-label">Aksi Berikutnya</span>
          <strong>{{ nextActionLabel }}</strong>
        </div>
      </div>
    </header>

    <main class="main-content">
      <section v-if="activeVisitCard" class="active-visit-card">
        <div class="active-visit-head">
          <div>
            <p class="section-eyebrow">Kunjungan Aktif</p>
            <h3 class="section-title">{{ activeVisitCard.Nama }}</h3>
          </div>
          <button class="visit-action-btn" @click="handleKunjungan" aria-label="Buka kunjungan" title="Buka">
            <font-awesome-icon icon="chevron-right" />
          </button>
        </div>

        <p class="active-visit-address">{{ activeVisitCard.Alamat || 'Alamat tidak tersedia' }}</p>

        <div class="active-visit-grid">
          <div class="active-chip">
            <span class="chip-label">Piutang</span>
            <strong>{{ formatCompactRupiah(activeVisitCard.TotalPiutang) }}</strong>
          </div>
          <div class="active-chip">
            <span class="chip-label">Sisa Plafon</span>
            <strong>{{ formatCompactRupiah(activeVisitCard.SisaPlafon) }}</strong>
          </div>
        </div>
      </section>

      <section class="menu-section priority-menu">
        <div class="section-header compact-section-header">
          <div>
            <p class="section-eyebrow">Aktivitas Utama</p>
            <h3 class="section-title">Navigasi Cepat</h3>
          </div>
        </div>

        <div class="main-btn premium-main-btn" @click="handleKunjungan">
          <div class="btn-icon btn-icon-primary">
            <font-awesome-icon icon="map-marked-alt" />
          </div>
          <div class="btn-txt">
            <span class="btn-top">{{ labelUtama }}</span>
            <span class="btn-sub">{{ labelSub }}</span>
          </div>
          <div class="btn-arrow">
            <font-awesome-icon icon="chevron-right" />
          </div>
        </div>

        <div class="sub-menu-grid">
          <div class="sub-item" @click="router.push('/registrasi-toko')">
            <div class="si-icon b-blue">
              <font-awesome-icon icon="store-alt" />
            </div>
            <span>Registrasi</span>
          </div>
          <div class="sub-item" @click="router.push('/cari-toko')">
            <div class="si-icon b-orange">
              <font-awesome-icon icon="search" />
            </div>
            <span>Cari Toko</span>
          </div>
          <div class="sub-item" @click="handleHistory">
            <div class="si-icon b-purple">
              <font-awesome-icon icon="history" />
            </div>
            <span>Riwayat</span>
          </div>
          <div class="sub-item" @click="router.push('/lph')">
            <div class="si-icon b-blue">
              <font-awesome-icon icon="clipboard-check" />
            </div>
            <span>LPH</span>
          </div>
          <div v-if="isCanvasSales" class="sub-item" @click="router.push({ path: '/sales-canvas', query: { mode: 'request', source: 'dashboard' } })">
            <div class="si-icon b-green">
              <font-awesome-icon icon="boxes" />
            </div>
            <span>Canvas</span>
          </div>
          <div class="sub-item" @click="router.push('/profile')">
            <div class="si-icon b-gray">
              <font-awesome-icon icon="user-shield" />
            </div>
            <span>Profil</span>
          </div>
        </div>
      </section>

      <section class="kpi-section">
        <div class="section-header">
          <div>
            <p class="section-eyebrow">Hari Ini</p>
            <h3 class="section-title">Pencapaian Kunjungan</h3>
          </div>
        </div>

        <div class="daily-grid">
          <div class="stat-card highlight-blue">
            <div class="stat-icon icon-blue">
              <font-awesome-icon icon="calendar-day" />
            </div>
            <div class="stat-text">
              <span class="stat-label">Call Plan</span>
              <strong class="stat-value">{{ summary.totalCP }}</strong>
            </div>
          </div>

          <div class="stat-card highlight-green">
            <div class="stat-icon icon-green">
              <font-awesome-icon icon="map-marker-alt" />
            </div>
            <div class="stat-text">
              <span class="stat-label">Active Trx</span>
              <strong class="stat-value">{{ summary.totalAT }}</strong>
            </div>
          </div>

          <div class="stat-card highlight-purple">
            <div class="stat-icon icon-purple">
              <font-awesome-icon icon="check-double" />
            </div>
            <div class="stat-text">
              <span class="stat-label">Effective</span>
              <strong class="stat-value">{{ summary.totalECO }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="focus-strip">
        <div class="focus-card">
          <span class="focus-label">Progress Target</span>
          <strong>{{ achievementPercentage }}%</strong>
          <small>{{ formatCompactRupiah(ValueOrder) }} dari {{ formatCompactRupiah(targetSales) }}</small>
        </div>
        <div class="focus-card">
          <span class="focus-label">Average Order</span>
          <strong>{{ formatCompactRupiah(orderAverageValue) }}</strong>
          <small>{{ dashboardStats.completed }} outlet checkout</small>
        </div>
      </section>

      <section class="kpi-section">
        <div class="section-header">
          <div>
            <p class="section-eyebrow">Bulan Berjalan</p>
            <h3 class="section-title">Statistik MTD</h3>
          </div>
        </div>

        <div class="mtd-grid">
          <div class="mtd-card">
            <div class="mtd-label">
              <font-awesome-icon icon="calendar-day" />
              <span class="sr-only">Call Plan</span>
            </div>
            <div class="mtd-val">{{ monthlySummary.totalCP }}</div>
          </div>
          <div class="mtd-card">
            <div class="mtd-label">
              <font-awesome-icon icon="map-marker-alt" />
              <span class="sr-only">Active Transaction</span>
            </div>
            <div class="mtd-val">{{ monthlySummary.totalAT }}</div>
          </div>
          <div class="mtd-card">
            <div class="mtd-label">
              <font-awesome-icon icon="check-double" />
              <span class="sr-only">Effective Call</span>
            </div>
            <div class="mtd-val">{{ monthlySummary.totalECO }}</div>
          </div>
          <div class="mtd-card">
            <div class="mtd-label">
              <font-awesome-icon icon="file-invoice" />
              <span class="sr-only">Effective Call Faktur</span>
            </div>
            <div class="mtd-val">{{ monthlySummary.totalECF }}</div>
          </div>
        </div>
      </section>

      <section class="insight-panel">
        <div class="section-header">
          <div>
            <p class="section-eyebrow">Operasional</p>
            <h3 class="section-title">Ringkasan Lapangan</h3>
          </div>
        </div>

        <div class="insight-grid">
          <div class="insight-card">
            <span class="insight-label">Sudah Visit</span>
            <strong>{{ dashboardStats.visited }}</strong>
            <small>{{ dashboardStats.visitRate }}% dari call plan</small>
          </div>
          <div class="insight-card">
            <span class="insight-label">Masih Aktif</span>
            <strong>{{ dashboardStats.active }}</strong>
            <small>{{ dashboardStats.activeText }}</small>
          </div>
          <div class="insight-card">
            <span class="insight-label">Selesai Checkout</span>
            <strong>{{ dashboardStats.completed }}</strong>
            <small>{{ dashboardStats.completedText }}</small>
          </div>
          <div class="insight-card">
            <span class="insight-label">Tanpa Transaksi</span>
            <strong>{{ dashboardStats.noTransaction }}</strong>
            <small>{{ dashboardStats.noTransactionText }}</small>
          </div>
        </div>
      </section>

      <section class="performance-card premium-card">
        <div class="perf-header">
          <div>
            <p class="section-eyebrow">Performa</p>
            <span class="perf-title">Ringkasan Sales</span>
          </div>
          <span class="perf-period">{{ currentMonthName }}</span>
        </div>

        <div class="target-block">
          <div>
            <small class="muted-label">Target Sales</small>
            <h3>{{ formatRupiah(targetSales) }}</h3>
          </div>
          <div class="target-achievement">
            <span>{{ achievementPercentage }}%</span>
          </div>
        </div>

        <div class="value-row premium-row">
          <div class="value-box">
            <small>Order Bulan Ini</small>
            <p class="blue">{{ formatRupiah(ValueOrder) }}</p>
          </div>
          <div class="value-box">
            <small>Faktur Bulan Ini</small>
            <p class="green">{{ formatRupiah(ValueFaktur) }}</p>
          </div>
        </div>

        <div class="progress-section">
          <div class="prog-info">
            <span>Target Achieved</span>
            <span class="fw-bold">{{ achievementPercentage }}%</span>
          </div>
          <div class="prog-bar-bg">
            <div class="prog-fill purple-fill" :style="{ width: achievementBarWidth + '%' }"></div>
          </div>
        </div>

        <div class="progress-section mt-3">
          <div class="prog-info">
            <span>Kunjungan (ECF)</span>
            <span class="fw-bold">{{ monthlySummary.totalECF }}%</span>
          </div>
          <div class="prog-bar-bg">
            <div class="prog-fill green-fill" :style="{ width: ecfBarWidth + '%' }"></div>
          </div>
        </div>

        <div class="value-row premium-row secondary-row">
          <div class="value-box soft-box">
            <small>Average Order</small>
            <p>{{ formatCompactRupiah(orderAverageValue) }}</p>
          </div>
          <div class="value-box soft-box">
            <small>Gap ke Target</small>
            <p :class="remainingTargetValue > 0 ? 'orange' : 'green'">
              {{ formatCompactRupiah(remainingTargetValue) }}
            </p>
          </div>
        </div>
      </section>

      <!-- <section class="sync-panel">
        <div class="section-header">
          <div>
            <p class="section-eyebrow">Maintenance</p>
            <h3 class="section-title">Sinkronisasi Manual</h3>
          </div>
        </div>

        <div class="sync-grid">
          <button class="sync-card" @click="handleSyncStok">
            <div class="sync-card-top">
              <div class="si-icon b-green">
                <font-awesome-icon icon="database" />
              </div>
              <span class="sync-chip">MASTER</span>
            </div>
            <strong>Sync Stok</strong>
            <small>{{ stokSyncLabel }}</small>
          </button>

          <button class="sync-card" @click="handleSyncReason">
            <div class="sync-card-top">
              <div class="si-icon b-red">
                <font-awesome-icon icon="sticky-note" />
              </div>
              <span class="sync-chip">CACHE</span>
            </div>
            <strong>Sync Reason</strong>
            <small>{{ reasonSyncLabel }}</small>
          </button>
        </div>
      </section> -->
    </main>
    <div v-if="isSyncing" class="floating-sync-bar">
      <div class="sync-header">
        <span>Sinkronisasi Stok...</span>
        <span>{{ syncPercent }}%</span>
      </div>
      <div class="progress-container">
        <div class="progress-fill" :style="{ width: syncPercent + '%' }"></div>
      </div>
      <div class="sync-footer">
        <span>{{ syncCurrent.toLocaleString() }} / {{ syncTotal.toLocaleString() }} item</span>
      </div>
    </div>
  </div>
  </template>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import api from '@/api/axios';
import Swal from 'sweetalert2';
import { getDb } from '@/services/database';
import { useConnectivityStore } from '@/stores/connectivity';
import { SyncService } from '@/services/SyncService';
import { useSyncStore } from '@/stores/SyncStore';
import { useThemeStore } from '@/stores/theme';
import { storeToRefs } from 'pinia';
import {
  normalizeProfile,
  normalizeKunjungan,
  normalizeList,
  normalizeStatistik
} from '@/utils/apiMapper';
import {
  getCanCheckIn,
  getPayloadObject,
  getPendingVisit,
  getVisitList
} from '@/services/visitService';

const auth = useAuthStore();
const router = useRouter();
const connectivity = useConnectivityStore();
const theme = useThemeStore();

const dashboardContainer = ref(null);

const profile = ref(null);
const canCheckIn = ref(true);
const isInitialLoading = ref(true);
const loading = ref(false);
const INITIAL_LOADING_MAX_MS = 8000;
let initialLoadingTimer = null;

const targetSales = ref(0);
const ValueOrder = ref(0);
const ValueFaktur = ref(0);
const summary = ref({ totalCP: 0, totalAT: 0, totalECO: 0 });
const monthlySummary = ref({ totalCP: 0, totalAT: 0, totalECO: 0, totalECF: 0 });
const visitList = ref([]);
const lastUpdatedAt = ref(null);

const pullDistance = ref(0);
const startY = ref(0);
const isPulling = ref(false);

const syncStore = useSyncStore();
const { isSyncing, syncPercent, syncCurrent, syncTotal } = storeToRefs(syncStore);

const isOffline = computed(() => !connectivity.isOnline);

const labelUtama = computed(() =>
  canCheckIn.value ? 'Mulai Kunjungan' : 'Lanjut Kunjungan'
);

const labelSub = computed(() =>
  canCheckIn.value ? 'Pilih jadwal hari ini' : 'Selesaikan kunjungan aktif'
);

const currentMonthName = computed(() => {
  return new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date());
});

const displayName = computed(() => {
  return profile.value?.Nama || auth.user?.name || auth.user?.nama || 'User';
});

const displayInitial = computed(() => {
  return displayName.value?.charAt(0)?.toUpperCase() || 'U';
});

const isCanvasSales = computed(() => {
  const type = String(auth.user?.nama_tipe_sales || '').trim().toLowerCase();
  return ['canvasser', 'canvaser', 'taking order - canvasser', 'taking order - canvaser'].includes(type);
});

const achievementPercentage = computed(() => {
  if (!targetSales.value || targetSales.value <= 0) return 0;
  const percent = (Number(ValueOrder.value) / Number(targetSales.value)) * 100;
  if (Number.isNaN(percent) || !Number.isFinite(percent)) return 0;
  return Number(percent.toFixed(1));
});

const achievementBarWidth = computed(() => {
  return Math.max(0, Math.min(achievementPercentage.value, 100));
});

const ecfBarWidth = computed(() => {
  const value = Number(monthlySummary.value.totalECF) || 0;
  return Math.max(0, Math.min(value, 100));
});

const todayLabel = computed(() => {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date());
});

const activeVisitCard = computed(() =>
  visitList.value.find((item) => item.isVisited && !item.isCheckOut) || null
);

const dashboardStats = computed(() => {
  const total = Number(summary.value.totalCP) || 0;
  const visited = visitList.value.filter((item) => item.isVisited).length;
  const completed = visitList.value.filter((item) => item.isCheckOut).length;
  const active = visitList.value.filter((item) => item.isVisited && !item.isCheckOut).length;
  const noTransaction = visitList.value.filter(
    (item) => item.isCheckOut && String(item.Alasan || '').trim() !== ''
  ).length;
  const visitRate = total > 0 ? Number(((visited / total) * 100).toFixed(1)) : 0;

  return {
    total,
    visited,
    completed,
    active,
    noTransaction,
    visitRate,
    activeText: active > 0 ? 'Perlu diselesaikan hari ini' : 'Tidak ada kunjungan tertahan',
    completedText: total > 0 ? `${completed}/${total} outlet selesai` : 'Belum ada checkout',
    noTransactionText: noTransaction > 0 ? 'Periksa alasan kunjungan' : 'Semua outlet ada transaksi'
  };
});

const orderAverageValue = computed(() => {
  const completed = dashboardStats.value.completed;
  if (!completed) return 0;
  return Number(ValueOrder.value || 0) / completed;
});

const remainingTargetValue = computed(() =>
  Math.max(0, Number(targetSales.value || 0) - Number(ValueOrder.value || 0))
);

const nextActionLabel = computed(() => {
  if (isOffline.value) return 'Gunakan data lokal';
  if (activeVisitCard.value) return 'Selesaikan kunjungan aktif';
  if (canCheckIn.value) return 'Mulai call plan hari ini';
  return 'Lanjutkan aktivitas sales';
});

const lastUpdatedLabel = computed(() => {
  if (!lastUpdatedAt.value) return isOffline.value ? 'Dari data lokal' : 'Menunggu sinkron';
  return formatSyncTime(lastUpdatedAt.value);
});

const STOK_SYNC_KEY = 'manual_sync_stok_at';
const REASON_SYNC_KEY = 'manual_sync_reason_at';

const getLastSyncTime = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setLastSyncTime = (key) => {
  try {
    localStorage.setItem(key, new Date().toISOString());
  } catch {}
};

const formatSyncTime = (iso) => {
  if (!iso) return 'belum pernah';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'belum pernah';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
};

const stokSyncLabel = computed(() => {
  const last = getLastSyncTime(STOK_SYNC_KEY);
  return last ? `Terakhir ${formatSyncTime(last)}` : 'Belum pernah disinkron';
});

const reasonSyncLabel = computed(() => {
  const last = getLastSyncTime(REASON_SYNC_KEY);
  return last ? `Terakhir ${formatSyncTime(last)}` : 'Belum pernah disinkron';
});

const resetDashboardState = () => {
  profile.value = null;
  canCheckIn.value = true;
  targetSales.value = 0;
  ValueOrder.value = 0;
  ValueFaktur.value = 0;
  summary.value = { totalCP: 0, totalAT: 0, totalECO: 0 };
  monthlySummary.value = { totalCP: 0, totalAT: 0, totalECO: 0, totalECF: 0 };
  visitList.value = [];
  lastUpdatedAt.value = null;
};

const stopInitialLoading = () => {
  if (initialLoadingTimer) {
    clearTimeout(initialLoadingTimer);
    initialLoadingTimer = null;
  }

  isInitialLoading.value = false;
};

const startInitialLoadingGuard = () => {
  if (initialLoadingTimer) clearTimeout(initialLoadingTimer);

  initialLoadingTimer = setTimeout(async () => {
    if (!isInitialLoading.value) return;

    console.warn('Dashboard initial loading timeout, showing page while data continues loading.');
    loading.value = false;
    stopInitialLoading();

    if (!profile.value && visitList.value.length === 0) {
      await loadDataFromSQLite();
    }
  }, INITIAL_LOADING_MAX_MS);
};

const pickNumber = (...values) => {
  const value = values.find((entry) => entry !== undefined && entry !== null && String(entry).trim() !== '');
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const getCurrentPeriodParams = () => {
  const today = new Date();
  return {
    tahun: today.getFullYear(),
    bulan: today.getMonth() + 1
  };
};

const findMonthlyTargetRow = (payload) => {
  const raw = getPayloadObject(payload) || {};
  const rows = Array.isArray(raw.rows)
    ? raw.rows
    : Array.isArray(raw.data?.rows)
      ? raw.data.rows
      : [];

  const salesId = String(
    auth.user?.id_sales ||
    auth.user?.Kode ||
    profile.value?.sales?.id ||
    profile.value?.id_sales ||
    ''
  ).trim();
  const userId = String(
    auth.user?.id_user ||
    auth.user?.id ||
    profile.value?.id ||
    ''
  ).trim();

  return rows.find((row) => salesId && String(row.id_sales || '').trim() === salesId)
    || rows.find((row) => userId && String(row.id_user || '').trim() === userId)
    || null;
};

const saveProfileToSQLite = async (db) => {
  if (!db || !profile.value) return;

  await db.execute('DELETE FROM profile');
  await db.run(
    `
    INSERT INTO profile (kode, nama, alamat, kota, nama_principle, type, telpon)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      profile.value.Kode || '',
      profile.value.Nama || '',
      profile.value.Alamat || '',
      profile.value.Kota || '',
      profile.value.NamaPrinciple || '',
      profile.value.Type || '',
      profile.value.Telpon || profile.value.telepon || ''
    ]
  );
};

const saveStatsToSQLite = async (db) => {
  if (!db) return;

  await db.execute('DELETE FROM stats');

  const statsToSave = [
    ['target_sales', targetSales.value],
    ['value_order', ValueOrder.value],
    ['value_faktur', ValueFaktur.value],
    ['atmd_cp', monthlySummary.value.totalCP],
    ['atmd_at', monthlySummary.value.totalAT],
    ['atmd_eco', monthlySummary.value.totalECO],
    ['atmd_ecf', monthlySummary.value.totalECF],
    ['summary_cp', summary.value.totalCP],
    ['summary_at', summary.value.totalAT],
    ['summary_eco', summary.value.totalECO]
  ];

  for (const [key, val] of statsToSave) {
    await db.run(
      'INSERT OR REPLACE INTO stats (key, value) VALUES (?, ?)',
      [key, String(val ?? 0)]
    );
  }
};

const saveKunjunganToSQLite = async (db, rows = []) => {
  if (!db) return;

  await db.run('DELETE FROM kunjungan_toko');

  for (const item of rows) {
    await db.run(
      `
      INSERT OR REPLACE INTO kunjungan_toko
      (kode, nama, alamat, kota, telpon, latitude, longitude, id_plafon, id_kunjungan, is_visited, is_checkout, total_piutang, sisa_plafon, qrcode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        item.Kode || '',
        item.Nama || '',
        item.Alamat || '',
        item.Kota || '',
        item.Telpon || '',
        item.Latitude || '0',
        item.Longitude || '0',
        item.IDPlafon || item.id_plafon || '',
        item.IDKunjungan || '',
        item.isVisited ? 1 : 0,
        item.isCheckOut ? 1 : 0,
        item.TotalPiutang || 0,
        item.SisaPlafon || 0,
        item.QRCode || ''
      ]
    );
  }
};

const loadDataFromSQLite = async () => {
  try {
    const db = getDb();
    if (!db) return;

    console.log('📂 Dashboard: Memuat data dari SQLite karena offline...');

    const p = await db.query('SELECT * FROM profile LIMIT 1');
    if (p.values?.length > 0) {
      profile.value = normalizeProfile({
        Kode: p.values[0].kode,
        Nama: p.values[0].nama,
        Alamat: p.values[0].alamat,
        Kota: p.values[0].kota,
        NamaPrinciple: p.values[0].nama_principle,
        Type: p.values[0].type,
        Telpon: p.values[0].telpon
      });
    }

    const s = await db.query('SELECT * FROM stats');
    if (s.values?.length > 0) {
      s.values.forEach((item) => {
        const val = parseFloat(item.value) || 0;

        switch (item.key) {
          case 'target_sales':
            targetSales.value = val;
            break;
          case 'value_order':
            ValueOrder.value = val;
            break;
          case 'value_faktur':
            ValueFaktur.value = val;
            break;
          case 'atmd_cp':
            monthlySummary.value.totalCP = val;
            break;
          case 'atmd_at':
            monthlySummary.value.totalAT = val;
            break;
          case 'atmd_eco':
            monthlySummary.value.totalECO = val;
            break;
          case 'atmd_ecf':
            monthlySummary.value.totalECF = val;
            break;
          case 'summary_cp':
            summary.value.totalCP = val;
            break;
          case 'summary_at':
            summary.value.totalAT = val;
            break;
          case 'summary_eco':
            summary.value.totalECO = val;
            break;
        }
      });
    }

    const activeVisit = await db.query(`
      SELECT *
      FROM kunjungan_toko
      WHERE is_visited = 1
        AND is_checkout = 0
      ORDER BY updated_at_local DESC, id_kunjungan DESC
      LIMIT 1
    `);

    const kunjunganRows = await db.query('SELECT * FROM kunjungan_toko');
    visitList.value = (kunjunganRows.values || []).map((item) =>
      normalizeKunjungan({
        Kode: item.kode,
        Nama: item.nama,
        Alamat: item.alamat,
        Kota: item.kota,
        Telpon: item.telpon,
        Latitude: item.latitude,
        Longitude: item.longitude,
        IDPlafon: item.id_plafon,
        IDKunjungan: item.id_kunjungan,
        isVisited: Number(item.is_visited) === 1,
        isCheckOut: Number(item.is_checkout) === 1,
        TotalPiutang: item.total_piutang,
        SisaPlafon: item.sisa_plafon,
        QRCode: item.qrcode,
        Alasan: item.alasan
      })
    );

    lastUpdatedAt.value = getLastSyncTime(STOK_SYNC_KEY) || new Date().toISOString();
    canCheckIn.value = !(activeVisit.values?.length > 0);
  } catch (e) {
    console.error('❌ Dashboard: Gagal memuat SQLite', e);
  }
};

const syncWhenOnline = async () => {
  if (!connectivity.isOnline) {
    return { success: false, message: 'Offline' };
  }

  try {
    const uploadResult = await SyncService.uploadAllPendingData();

    if (!uploadResult?.success) {
      console.warn('⚠️ Upload pending gagal:', uploadResult?.message || uploadResult);
      return uploadResult;
    }

    const lightResult = await SyncService.downloadLightMasterData();

    if (!lightResult?.success) {
      console.warn('⚠️ Light sync gagal:', lightResult?.message || lightResult);
      return lightResult;
    }

    return { success: true, message: 'Sync online berhasil' };
  } catch (e) {
    console.warn('⚠️ Sync online exception:', e?.message || e);
    throw e;
  }
};

const refreshData = async ({ silent = false } = {}) => {
  if (loading.value) {
    if (isInitialLoading.value) stopInitialLoading();
    return;
  }

  const db = getDb();

  if (!silent) loading.value = true;

  try {
    if (!connectivity.isOnline) {
      await loadDataFromSQLite();
      return;
    }

    const syncResult = await syncWhenOnline();

    if (syncResult && syncResult.success === false) {
      console.warn('⚠️ Sync online tidak penuh:', syncResult.message);
    }

    console.log('🌐 Dashboard: Mengambil data server...');

    const [canCheckInResult, profileRes, targetRes, atmdRes, monthlyTargetRes, daftar] = await Promise.all([
      getCanCheckIn(),
      api.get('/api/profile/me'),
      api.get('/api/statistik/sales_target'),
      api.get('/api/statistik/sales_atmd'),
      api.get('/api/sales/targets-monthly', {
        params: getCurrentPeriodParams()
      }).catch((error) => {
        console.warn('Target bulanan new_budimas tidak bisa dimuat:', error?.message || error);
        return null;
      }),
      getVisitList()
    ]);

    profile.value = normalizeProfile(getPayloadObject(profileRes?.data) || {});

    canCheckIn.value = !!canCheckInResult;

    const monthlyTarget = findMonthlyTargetRow(monthlyTargetRes?.data);
    const targetRaw = getPayloadObject(targetRes?.data) || {};
    const targetData = normalizeStatistik(targetRaw);
    targetSales.value = pickNumber(
      monthlyTarget?.target_omset,
      targetRaw.TargetSales,
      targetRaw.target_sales,
      targetRaw.targetSales,
      targetRaw.Target,
      targetRaw.target,
      targetData.target
    );

    const atmdRaw = getPayloadObject(atmdRes?.data) || {};

    ValueOrder.value = pickNumber(
      monthlyTarget?.actual_omset,
      atmdRaw.ValueOrder,
      atmdRaw.value_order,
      atmdRaw.order_value,
      atmdRaw.TotalOrder,
      atmdRaw.total_order,
      atmdRaw.realisasi,
      atmdRaw.Realisasi
    );
    ValueFaktur.value = pickNumber(
      atmdRaw.ValueFaktur,
      atmdRaw.value_faktur,
      atmdRaw.faktur_value,
      atmdRaw.TotalFaktur,
      atmdRaw.total_faktur
    );

    monthlySummary.value = {
      totalCP: pickNumber(atmdRaw.CP, atmdRaw.totalCP, atmdRaw.total_cp, atmdRaw.cp),
      totalAT: pickNumber(monthlyTarget?.actual_kunjungan, atmdRaw.AT, atmdRaw.totalAT, atmdRaw.total_at, atmdRaw.at),
      totalECO: pickNumber(atmdRaw.ECO, atmdRaw.totalECO, atmdRaw.total_eco, atmdRaw.eco),
      totalECF: pickNumber(
        monthlyTarget?.visit_achievement_percent,
        atmdRaw.ECF,
        atmdRaw.totalECF,
        atmdRaw.total_ecf,
        atmdRaw.ecf,
        atmdRaw.atmd,
        atmdRaw.ATMD
      )
    };

    visitList.value = daftar;

    summary.value = {
      totalCP: daftar.length,
      totalAT: daftar.filter((i) => i.isVisited).length,
      totalECO: daftar.filter((i) => i.isCheckOut).length
    };

    if (db) {
      await saveProfileToSQLite(db);
      await saveStatsToSQLite(db);
      await saveKunjunganToSQLite(db, daftar);
    }

    lastUpdatedAt.value = new Date().toISOString();
    await checkStatusKunjungan();

    console.log('✅ Dashboard loaded:', {
      profile: profile.value,
      targetSales: targetSales.value,
      ValueOrder: ValueOrder.value,
      ValueFaktur: ValueFaktur.value,
      summary: summary.value,
      monthlySummary: monthlySummary.value,
      canCheckIn: canCheckIn.value
    });
  } catch (error) {
    console.error('❌ Dashboard API Error:', error);

    if (!connectivity.isOnline) {
      await loadDataFromSQLite();
    } else {
      await Swal.fire({
        icon: 'error',
        title: 'Server Error',
        text: 'Gagal mengambil data terbaru dari server.'
      });
    }
  } finally {
    loading.value = false;
    stopInitialLoading();
  }
};

const checkStatusKunjungan = async () => {
  try {
    if (connectivity.isOnline) {
      canCheckIn.value = await getCanCheckIn();
      return;
    }

    const db = getDb();
    if (!db) {
      canCheckIn.value = true;
      return;
    }

    const res = await db.query(`
      SELECT 1
      FROM kunjungan_toko
      WHERE is_visited = 1 AND is_checkout = 0
      ORDER BY updated_at_local DESC, id_kunjungan DESC
      LIMIT 1
    `);

    canCheckIn.value = !((res.values || []).length > 0);
  } catch (e) {
    console.error('Status check failed', e);
    canCheckIn.value = true;
  }
};

const checkPendingVisit = async () => {
  const db = getDb();

  try {
    if (connectivity.isOnline) {
      const { pending, item } = await getPendingVisit();

      if (pending && item) {
        const namaToko = item.Nama || 'Unknown';

        const result = await Swal.fire({
          title: 'Kunjungan Belum Selesai',
          text: `Anda masih memiliki kunjungan yang menggantung di ${namaToko}. Selesaikan sekarang?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#3085d6',
          cancelButtonColor: '#d33',
          confirmButtonText: 'Ya, Selesaikan',
          cancelButtonText: 'Nanti saja',
          reverseButtons: true
        });

        if (result.isConfirmed) {
          router.push({
            path: '/kunjungan-aktif',
            query: {
              kode: item.Kode || '',
              kode_customer: item.Kode || '',
              nama_toko: item.Nama || '',
              id_kunjungan: item.IDKunjungan || '',
              id_plafon: item.IDPlafon || item.id_plafon || ''
            }
          });
        }

        return;
      }
    }

    if (db) {
      const localRes = await db.query(`
        SELECT *
        FROM kunjungan_toko
        WHERE is_visited = 1
          AND is_checkout = 0
        LIMIT 1
      `);

      if (localRes.values?.length > 0) {
        const visit = localRes.values[0];

        const result = await Swal.fire({
          title: 'Kunjungan Belum Selesai',
          text: `Anda masih memiliki kunjungan yang menggantung di ${visit.nama || 'Unknown'}. Selesaikan sekarang?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#3085d6',
          cancelButtonColor: '#d33',
          confirmButtonText: 'Ya, Selesaikan',
          cancelButtonText: 'Nanti saja',
          reverseButtons: true
        });

        if (result.isConfirmed) {
          router.push({
            path: '/kunjungan-aktif',
            query: {
              kode: visit.kode || '',
              kode_customer: visit.kode || '',
              nama_toko: visit.nama || '',
              id_kunjungan: visit.id_kunjungan || '',
              id_plafon: visit.id_plafon || ''
            }
          });
        }
      }
    }
  } catch (e) {
    console.error('Pending check failed', e);
  }
};

const syncReasonManual = async () => {
  const db = getDb();
  if (!db) throw new Error('Database belum siap');

  const resReason = await api.get('/api/sync/big-sync-reason');

  if (!resReason?.data?.success) {
    throw new Error(resReason?.data?.message || 'Gagal sync reason');
  }

  const reasonList = Array.isArray(resReason.data.payload) ? resReason.data.payload : [];

  await db.run(
    `
    INSERT OR REPLACE INTO app_cache (cache_key, payload_json, updated_at)
    VALUES (?, ?, ?)
    `,
    ['reason_history', JSON.stringify(reasonList), new Date().toISOString()]
  );

  setLastSyncTime(REASON_SYNC_KEY);

  return reasonList.length;
};

const handleSyncStok = async () => {
  if (!connectivity.isOnline) {
    return Swal.fire('Offline', 'Cek koneksi internet untuk sinkronisasi stok.', 'info');
  }

  const confirmRes = await Swal.fire({
    title: 'Mulai Sinkronisasi?',
    text: 'Proses ini berjalan di latar belakang. Anda tetap bisa menggunakan menu lain.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Ya, Sinkronkan',
    cancelButtonText: 'Batal',
    reverseButtons: true
  });

  if (!confirmRes.isConfirmed) return;

  try {
    const result = await syncStore.startSyncStok();

    if (result.success) {
      await refreshData({ silent: true });

      Swal.fire({
        icon: 'success',
        title: 'Sync Stok Selesai',
        text: `${result.total} data diperbarui`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    }
  } catch (e) {
    Swal.fire({
      icon: 'error',
      title: 'Sync Gagal',
      text: e.message || 'Terjadi kesalahan pada server Budimas.'
    });
  }
};

const handleSyncReason = async () => {
  if (!connectivity.isOnline) {
    await Swal.fire('Offline', 'Sync alasan hanya bisa saat online.', 'info');
    return;
  }

  const lastSync = getLastSyncTime(REASON_SYNC_KEY);
  const timeInfo = lastSync
    ? `\nTerakhir disinkron: ${formatSyncTime(lastSync)}`
    : '\nData lokal belum tersedia.';

  const confirmRes = await Swal.fire({
    title: 'Konfirmasi Sync Alasan',
    text: `Tarik data daftar alasan terbaru dari server?${timeInfo}`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Ya, Sinkronkan',
    cancelButtonText: 'Batal',
    reverseButtons: true
  });

  if (!confirmRes.isConfirmed) return;

  loading.value = true;

  try {
    const total = await syncReasonManual();

    await Swal.fire({
      icon: 'success',
      title: 'Sync Berhasil',
      text: `${total} data alasan telah diperbarui.`,
      timer: 1500,
      showConfirmButton: false
    });
  } catch (e) {
    console.error('Sync reason manual error:', e);
    await Swal.fire('Gagal', e?.message || 'Gagal sinkronisasi daftar alasan.', 'error');
  } finally {
    loading.value = false;
  }
};

const handleKunjungan = async () => {
  await checkStatusKunjungan();

  if (canCheckIn.value) {
    router.push('/jadwal');
  } else {
    router.push('/kunjungan-aktif');
  }
};

const handleHistory = () => {
  router.push('/jadwal-dikunjungi');
};

const handleLogout = async () => {
  const res = await Swal.fire({
    title: 'Logout?',
    text: 'Anda akan keluar dari sesi ini.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Ya, Keluar'
  });

  if (res.isConfirmed) {
    await auth.logout();
    router.push('/login');
  }
};

const handleTouchStart = (e) => {
  const container = dashboardContainer.value;
  if (!container) return;

  if (container.scrollTop === 0 && !loading.value) {
    startY.value = e.touches[0].pageY;
    isPulling.value = true;
  }
};

const handleTouchMove = (e) => {
  if (!isPulling.value) return;

  const currentY = e.touches[0].pageY;
  const distance = currentY - startY.value;

  if (distance > 0) {
    pullDistance.value = Math.min(distance * 0.4, 80);
  } else {
    pullDistance.value = 0;
    isPulling.value = false;
  }
};

const handleTouchEnd = async () => {
  if (!isPulling.value) return;

  isPulling.value = false;

  if (pullDistance.value > 65) {
    await refreshData();
  }

  pullDistance.value = 0;
};

const formatRupiah = (value) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
};

const formatCompactRupiah = (value) => {
  const amount = Number(value) || 0;

  if (amount >= 1000000000) {
    return `Rp ${(amount / 1000000000).toFixed(1)} M`;
  }

  if (amount >= 1000000) {
    return `Rp ${(amount / 1000000).toFixed(1)} Jt`;
  }

  if (amount >= 1000) {
    return `Rp ${(amount / 1000).toFixed(0)} Rb`;
  }

  return formatRupiah(amount);
};

watch(
  () => connectivity.isOnline,
  async (newStatus, oldStatus) => {
    if (newStatus && !oldStatus) {
      console.log('🌐 Online kembali: sync & refresh data...');
      await refreshData();
      await checkPendingVisit();
    }
  }
);

onMounted(async () => {
  isInitialLoading.value = true;
  startInitialLoadingGuard();
  resetDashboardState();
  await refreshData().catch((error) => {
    console.error('Dashboard initial refresh failed:', error);
    stopInitialLoading();
  });

  if (connectivity.isOnline) {
    checkPendingVisit();
  }
});
</script>

<style scoped>
.floating-sync-bar {
  position: fixed;
  bottom: 85px; /* Sesuaikan agar tidak menutupi navbar bawah */
  left: 15px;
  right: 15px;
  background: rgba(45, 52, 54, 0.95);
  backdrop-filter: blur(5px);
  color: white;
  padding: 12px;
  border-radius: 12px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.3);
  z-index: 1000;
}
.sync-header {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 8px;
}
.progress-container {
  width: 100%;
  height: 8px;
  background: #636e72;
  border-radius: 4px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #0984e3;
  transition: width 0.4s ease;
}
.sync-footer {
  text-align: center;
  font-size: 11px;
  margin-top: 6px;
  color: #dfe6e9;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.icon-action-btn {
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
}

.b-green {
  background: #dcfce7;
  color: #166534;
}

.b-red {
  background: #fee2e2;
  color: #991b1b;
}

.pull-to-refresh-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: height 0.2s ease-out, opacity 0.2s;
  pointer-events: none;
  background: #f0f4ff;
}

.loader-mini {
  width: 20px;
  height: 20px;
  border: 2px solid #4f46e5;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.dashboard-container {
  position: relative;
  background: #f8fafc;
  height: 100vh;
  min-height: 100vh;
  max-height: 100vh;
  height: 100dvh;
  min-height: 100dvh;
  max-height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
  font-family: 'Inter', sans-serif;
}

.offline-top-bar {
  background: #f59e0b;
  color: white;
  font-size: 0.75rem;
  text-align: center;
  padding: 8px 0;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.banner-offline {
  border: 1.5px solid #f59e0b !important;
  background: #fffbeb !important;
}

.dot-offline {
  background: #f59e0b;
  box-shadow: 0 0 8px #f59e0b;
}

.header {
  background: #0f172a;
  padding: 45px 22px 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom-left-radius: 32px;
  border-bottom-right-radius: 32px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-info {
  min-width: 0;
}

.user-avatar {
  width: 45px;
  height: 45px;
  background: #3b82f6;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 800;
  font-size: 1.2rem;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.user-name {
  color: white;
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.2;
}

.welcome-text {
  color: #94a3b8;
  font-size: 0.85rem;
  margin-bottom: 2px;
  font-weight: 500;
}

.btn-logout {
  background: rgba(255, 255, 255, 0.12);
  border: none;
  padding: 12px;
  border-radius: 15px;
  color: white;
  font-size: 1.2rem;
  transition: background 0.2s;
}

.main-content {
  padding: 0 18px;
  margin-top: -30px;
  padding-bottom: 40px;
}

.status-banner {
  background: white;
  padding: 16px 20px;
  border-radius: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.1);
  margin-bottom: 25px;
  border: 1px solid #f1f5f9;
}

.status-dot-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-success {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.dot-pulse {
  background: #3b82f6;
  animation: pulse 2s infinite;
  box-shadow: 0 0 8px #3b82f6;
}

.status-text {
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
}

.role-badge {
  background: #f1f5f9;
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 800;
  color: #475569;
}

.section-wrapper {
  margin-bottom: 28px;
}

.stats-label {
  font-size: 0.85rem;
  font-weight: 800;
  color: #64748b;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.daily-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.mini-card {
  background: white;
  padding: 15px 10px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #f1f5f9;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.mini-card strong {
  font-size: 1rem;
  color: #0f172a;
}

.mini-card small {
  font-size: 0.7rem;
  color: #94a3b8;
  font-weight: 600;
}

.m-icon {
  font-size: 1.3rem;
}

.mtd-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.mtd-card {
  background: white;
  padding: 18px 5px;
  border-radius: 18px;
  text-align: center;
  border: 1px solid #f1f5f9;
}

.mtd-val {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1;
}

.mtd-label {
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 700;
  margin-top: 6px;
}

.performance-card {
  background: white;
  padding: 24px;
  border-radius: 26px;
  border: 1px solid #f1f5f9;
  margin-bottom: 28px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.perf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}

.perf-title {
  font-weight: 800;
  font-size: 1rem;
  color: #0f172a;
}

.perf-period {
  font-size: 0.85rem;
  color: #3b82f6;
  font-weight: 700;
}

.target-section small {
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 600;
}

.target-section h3 {
  font-size: 1.65rem;
  margin: 6px 0 20px;
  color: #0f172a;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.value-row {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #f8fafc;
  padding-top: 20px;
  margin-bottom: 20px;
}

.v-col small {
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 600;
}

.v-col p {
  font-size: 1rem;
  font-weight: 800;
  margin: 4px 0;
}

.v-line {
  width: 1.5px;
  background: #f1f5f9;
}

.progress-section {
  margin-top: 18px;
}

.prog-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 10px;
}

.prog-bar-bg {
  height: 12px;
  background: #f1f5f9;
  border-radius: 12px;
  overflow: hidden;
}

.prog-fill {
  height: 100%;
  border-radius: 12px;
  transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
}

.purple-fill {
  background: linear-gradient(90deg, #8b5cf6, #d946ef);
}

.green-fill {
  background: #10b981;
}

.main-btn {
  background: white;
  padding: 20px;
  border-radius: 22px;
  display: flex;
  align-items: center;
  gap: 15px;
  border: 1px solid #f1f5f9;
  margin-bottom: 22px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.02);
}

.btn-icon {
  width: 52px;
  height: 52px;
  background: #f0fdf4;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
}

.btn-top {
  display: block;
  font-weight: 800;
  font-size: 1.1rem;
  color: #0f172a;
}

.btn-sub {
  font-size: 0.85rem;
  color: #94a3b8;
  font-weight: 500;
}

.sub-menu-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.sub-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  background: #ffffff;
  border-radius: 14px;
}

.si-icon {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  transition: transform 0.2s;
}

.si-icon:active {
  transform: scale(0.9);
}

.sub-item span {
  font-size: 0.75rem;
  font-weight: 800;
  color: #475569;
  margin-top: 8px;
  text-align: center;
}

.full-loading-screen {
  position: fixed;
  inset: 0;
  background: #0f172a;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  color: white;
  text-align: center;
}

.loader-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.main-loader {
  width: 55px;
  height: 55px;
  border: 5px solid rgba(255, 255, 255, 0.1);
  border-top: 5px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.mt-3 {
  margin-top: 1rem;
}

.fw-bold {
  font-weight: 800;
}

.blue {
  color: #3b82f6;
}

.green {
  color: #10b981;
}

.orange {
  color: #f59e0b;
}

.hero-meta-row {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 12px;
}

.hero-meta-card {
  background: rgba(255, 255, 255, 0.09);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  padding: 12px 14px;
  backdrop-filter: blur(12px);
}

.hero-meta-label {
  display: block;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.68);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-weight: 800;
  margin-bottom: 6px;
}

.hero-meta-card strong {
  color: #fff;
  font-size: 0.82rem;
  line-height: 1.4;
}

.active-visit-card,
.insight-panel {
  background: linear-gradient(180deg, #ffffff, #f8fbff);
  border: 1px solid #e6edf6;
  border-radius: 26px;
  padding: 18px;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.045);
  margin-bottom: 26px;
}

.active-visit-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.visit-action-btn {
  border: none;
  border-radius: 14px;
  background: #e0ecff;
  color: #1d4ed8;
  font-size: 0.8rem;
  font-weight: 800;
  padding: 10px 14px;
}

.active-visit-address {
  margin: 10px 0 16px;
  color: #64748b;
  font-size: 0.82rem;
  line-height: 1.5;
}

.active-visit-grid,
.insight-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.active-chip,
.insight-card {
  background: #fff;
  border: 1px solid #edf2f7;
  border-radius: 18px;
  padding: 14px 15px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.025);
}

.chip-label,
.insight-label {
  display: block;
  color: #64748b;
  font-size: 0.74rem;
  font-weight: 700;
  margin-bottom: 6px;
}

.active-chip strong,
.insight-card strong {
  display: block;
  color: var(--text);
  font-size: 1rem;
  font-weight: 900;
}

.insight-card small {
  color: #94a3b8;
  font-size: 0.73rem;
  line-height: 1.4;
}

.secondary-row {
  margin-top: 18px;
  margin-bottom: 0;
}

.soft-box {
  background: #f8fbff;
}

.dashboard-container::-webkit-scrollbar {
  display: none;
}
:root {
  --bg: #f4f7fb;
  --text: #0f172a;
  --muted: #64748b;
  --line: #e2e8f0;
  --card: #ffffff;
  --primary: #2563eb;
  --primary-dark: #1d4ed8;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --purple: #8b5cf6;
}

.b-green {
  background: #dcfce7;
  color: #166534;
}

.b-red {
  background: #fee2e2;
  color: #991b1b;
}

.b-blue {
  background: #dbeafe;
  color: #1d4ed8;
}

.b-orange {
  background: #ffedd5;
  color: #c2410c;
}

.b-purple {
  background: #ede9fe;
  color: #6d28d9;
}

.b-gray {
  background: #e2e8f0;
  color: #334155;
}

.dashboard-container {
  position: relative;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 24%),
    radial-gradient(circle at top left, rgba(139, 92, 246, 0.08), transparent 18%),
    var(--bg);
  height: 100vh;
  min-height: 100vh;
  max-height: 100vh;
  height: 100dvh;
  min-height: 100dvh;
  max-height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
  font-family: 'Inter', sans-serif;
}

.dashboard-container::-webkit-scrollbar {
  display: none;
}

.pull-to-refresh-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: height 0.2s ease-out, opacity 0.2s;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(2, 6, 23, 0.88), rgba(2, 6, 23, 0));
}

.refresh-content {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
}

.loader-mini {
  width: 20px;
  height: 20px;
  border: 2px solid #4f46e5;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.offline-top-bar {
  background: linear-gradient(90deg, #f59e0b, #f97316);
  color: white;
  font-size: 0.72rem;
  text-align: center;
  padding: 9px 0;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.3px;
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 8px 20px rgba(245, 158, 11, 0.28);
}

.hero-header {
  position: relative;
  padding: 24px 18px 18px;
  background:
    linear-gradient(135deg, #0f172a 0%, #172554 55%, #1d4ed8 100%);
  border-bottom-left-radius: 34px;
  border-bottom-right-radius: 34px;
  overflow: hidden;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.12), transparent 22%),
    radial-gradient(circle at bottom left, rgba(255, 255, 255, 0.08), transparent 24%);
  pointer-events: none;
}

.hero-top {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hero-user {
  display: flex;
  align-items: center;
  gap: 14px;
}

.user-avatar {
  width: 54px;
  height: 54px;
  background: linear-gradient(135deg, #60a5fa, #2563eb);
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 900;
  font-size: 1.25rem;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.35);
}

.user-info {
  min-width: 0;
}

.welcome-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.82rem;
  margin: 0 0 2px;
  font-weight: 500;
}

.user-name {
  color: white;
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
  line-height: 1.2;
}

.hero-date {
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.76rem;
  margin: 4px 0 0;
}

.btn-logout {
  position: relative;
  z-index: 2;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-radius: 14px;
  padding: 10px 14px;
  font-weight: 700;
  font-size: 0.85rem;
  backdrop-filter: blur(8px);
}

.hero-actions {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.btn-theme-mode {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-radius: 14px;
  padding: 9px 13px;
  font-weight: 800;
  font-size: 0.78rem;
  min-width: 64px;
  backdrop-filter: blur(8px);
}

.hero-summary-card {
  position: relative;
  z-index: 2;
  margin-top: 22px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  padding: 18px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  backdrop-filter: blur(14px);
}

.hero-summary-left {
  flex: 1;
}

.hero-summary-label {
  margin: 0 0 6px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 700;
}

.hero-summary-title {
  color: white;
  margin: 0;
  font-size: 1.12rem;
  font-weight: 800;
  line-height: 1.25;
}

.hero-summary-subtitle {
  margin: 6px 0 0;
  color: rgba(255, 255, 255, 0.76);
  font-size: 0.82rem;
  line-height: 1.4;
}

.hero-summary-right {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
}

.role-badge {
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.16);
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 900;
  color: white;
  letter-spacing: 0.8px;
}

.role-offline {
  background: rgba(245, 158, 11, 0.16);
  color: #fef3c7;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.12);
  color: white;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 0.74rem;
  font-weight: 700;
}

.status-pill-offline {
  color: #fff7ed;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-success {
  background: var(--success);
  box-shadow: 0 0 10px var(--success);
}

.dot-pulse {
  background: #60a5fa;
  animation: pulse 2s infinite;
  box-shadow: 0 0 10px #60a5fa;
}

.dot-offline {
  background: var(--warning);
  box-shadow: 0 0 10px var(--warning);
}

.main-content {
  padding: 49px 18px 0px;
  margin-top: -42px;
  position: relative;
  z-index: 3;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  margin-bottom: 12px;
}

.section-eyebrow {
  margin: 0 0 4px;
  color: #94a3b8;
  font-size: 0.73rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 800;
}

.section-title {
  margin: 0;
  color: var(--text);
  font-size: 1rem;
  font-weight: 800;
}

.kpi-section,
.menu-section,
.sync-panel {
  margin-bottom: 26px;
}

.daily-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-card {
  background: var(--card);
  border-radius: 22px;
  padding: 16px 14px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.04);
}

.highlight-blue {
  background: linear-gradient(180deg, #ffffff, #eff6ff);
}

.highlight-green {
  background: linear-gradient(180deg, #ffffff, #ecfdf5);
}

.highlight-purple {
  background: linear-gradient(180deg, #ffffff, #faf5ff);
}

.stat-icon {
  font-size: 1.35rem;
  margin-bottom: 10px;
}

.stat-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 700;
}

.stat-value {
  color: var(--text);
  font-size: 1.1rem;
  font-weight: 900;
}

.mtd-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.mtd-card {
  background: var(--card);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 20px;
  padding: 18px 8px;
  text-align: center;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.035);
}

.mtd-label {
  font-size: 0.72rem;
  color: #94a3b8;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.7px;
}

.mtd-val {
  margin-top: 8px;
  font-size: 1.28rem;
  font-weight: 900;
  color: var(--text);
  line-height: 1;
}

.premium-card {
  background: linear-gradient(180deg, #ffffff, #f8fbff);
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 28px;
  padding: 24px;
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.06);
}

.perf-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 18px;
}

.perf-title {
  font-weight: 900;
  font-size: 1.05rem;
  color: var(--text);
}

.perf-period {
  font-size: 0.8rem;
  color: var(--primary);
  font-weight: 800;
  background: #eff6ff;
  padding: 7px 10px;
  border-radius: 999px;
}

.target-block {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.muted-label {
  font-size: 0.83rem;
  color: #64748b;
  font-weight: 700;
}

.target-block h3 {
  font-size: 1.55rem;
  margin: 6px 0 0;
  color: var(--text);
  font-weight: 900;
  letter-spacing: -0.5px;
}

.target-achievement {
  min-width: 68px;
  height: 68px;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #dbeafe, #eff6ff);
  color: var(--primary-dark);
  font-weight: 900;
  font-size: 1rem;
}

.premium-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.value-box {
  background: #fff;
  border: 1px solid #eef2f7;
  border-radius: 18px;
  padding: 14px 16px;
}

.value-box small {
  font-size: 0.73rem;
  color: #94a3b8;
  font-weight: 700;
}

.value-box p {
  margin: 6px 0 0;
  font-size: 1rem;
  font-weight: 900;
}

.progress-section {
  margin-top: 18px;
}

.prog-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.84rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 10px;
}

.prog-bar-bg {
  height: 12px;
  background: #eef2f7;
  border-radius: 999px;
  overflow: hidden;
}

.prog-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
}

.purple-fill {
  background: linear-gradient(90deg, #8b5cf6, #d946ef);
}

.green-fill {
  background: linear-gradient(90deg, #10b981, #34d399);
}

.premium-main-btn {
  background: linear-gradient(135deg, #ffffff, #f8fbff);
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 24px;
  padding: 18px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.055);
  margin-bottom: 18px;
}

.btn-icon {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
}

.btn-icon-primary {
  background: linear-gradient(135deg, #dcfce7, #ecfdf5);
}

.btn-txt {
  flex: 1;
}

.btn-top {
  display: block;
  font-weight: 900;
  font-size: 1.08rem;
  color: var(--text);
}

.btn-sub {
  font-size: 0.82rem;
  color: #94a3b8;
  font-weight: 600;
}

.btn-arrow {
  color: var(--primary);
  font-size: 1.25rem;
  font-weight: 900;
}

.sub-menu-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.sub-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  background: #ffffff;
  border: 1px solid #edf2f7;
  border-radius: 18px;
  padding: 14px 10px;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.03);
}

.si-icon {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  transition: transform 0.2s;
}

.si-icon:active {
  transform: scale(0.92);
}

.sub-item span {
  font-size: 0.74rem;
  font-weight: 800;
  color: #475569;
  margin-top: 8px;
  text-align: center;
}

.sync-panel {
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  border: 1px solid #e5edf6;
  border-radius: 26px;
  padding: 18px;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.04);
}

.sync-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.sync-card {
  border: 1px solid #edf2f7;
  background: #fff;
  border-radius: 20px;
  padding: 16px 14px;
  text-align: left;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.03);
}

.sync-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.sync-card strong {
  display: block;
  font-size: 0.95rem;
  color: var(--text);
  margin-bottom: 6px;
}

.sync-card small {
  display: block;
  font-size: 0.74rem;
  color: #64748b;
  line-height: 1.4;
}

.sync-chip {
  font-size: 0.66rem;
  font-weight: 900;
  color: var(--primary);
  background: #eff6ff;
  padding: 5px 8px;
  border-radius: 999px;
}

.full-loading-screen {
  position: fixed;
  inset: 0;
  background: linear-gradient(180deg, #0f172a, #111827);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  color: white;
  text-align: center;
}

.loader-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.main-loader {
  width: 55px;
  height: 55px;
  border: 5px solid rgba(255, 255, 255, 0.12);
  border-top: 5px solid #60a5fa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.mt-3 {
  margin-top: 1rem;
}

.fw-bold {
  font-weight: 800;
}

.blue {
  color: #2563eb;
}

.green {
  color: #10b981;
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.55;
    transform: scale(0.92);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.hero-header {
  box-shadow: 0 22px 48px rgba(15, 23, 42, 0.16);
}

.hero-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 28px 28px;
  opacity: 0.22;
  pointer-events: none;
}

.hero-summary-card {
  background: rgba(255, 255, 255, 0.13);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.focus-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 26px;
}

.focus-card {
  background: linear-gradient(180deg, #ffffff, #f8fbff);
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 22px;
  padding: 16px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.04);
}

.focus-label {
  display: block;
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 8px;
}

.focus-card strong {
  display: block;
  color: var(--text);
  font-size: 1.12rem;
  font-weight: 900;
  margin-bottom: 6px;
}

.focus-card small {
  display: block;
  font-size: 0.74rem;
  color: #94a3b8;
  line-height: 1.45;
}

.stat-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
}

.icon-blue {
  color: #1d4ed8;
  background: #dbeafe;
}

.icon-green {
  color: #15803d;
  background: #dcfce7;
}

.icon-purple {
  color: #7c3aed;
  background: #ede9fe;
}

.btn-icon {
  font-size: 0.9rem;
  font-weight: 900;
  letter-spacing: 0.06em;
}

.btn-icon-primary {
  background: linear-gradient(135deg, #dbeafe, #eff6ff);
  color: #1d4ed8;
}

.si-icon {
  font-size: 0.8rem;
  font-weight: 900;
  letter-spacing: 0.05em;
}

.premium-main-btn,
.sub-item,
.sync-card,
.visit-action-btn {
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.premium-main-btn:active,
.sub-item:active,
.sync-card:active,
.visit-action-btn:active {
  transform: scale(0.985);
}

.main-content {
  padding: 32px 16px 24px;
  margin-top: -28px;
}

.hero-header {
  padding-bottom: 58px;
}

.hero-top {
  align-items: flex-start;
}

.hero-summary-card {
  margin-top: 18px;
  padding: 16px;
  border-radius: 22px;
}

.hero-summary-title {
  font-size: 1.05rem;
  line-height: 1.25;
  margin: 4px 0;
}

.hero-summary-subtitle {
  font-size: 0.78rem;
  line-height: 1.45;
}

.hero-meta-row {
  margin-top: 12px;
}

.hero-meta-card {
  min-height: 58px;
  padding: 12px 14px;
}

.priority-menu {
  margin-bottom: 22px;
}

.compact-section-header {
  margin-bottom: 10px;
}

.priority-menu .premium-main-btn {
  padding: 14px;
  border-radius: 20px;
  margin-bottom: 12px;
}

.priority-menu .btn-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
}

.priority-menu .btn-top {
  font-size: 0.98rem;
}

.priority-menu .btn-sub {
  font-size: 0.76rem;
}

.sub-menu-grid {
  gap: 8px;
}

.sub-item {
  border-radius: 16px;
  padding: 10px 6px;
  min-height: 82px;
}

.si-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
}

.sub-item span {
  font-size: 0.69rem;
  margin-top: 7px;
}

.daily-grid {
  gap: 8px;
}

.stat-card {
  border-radius: 18px;
  padding: 12px 10px;
}

.stat-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  margin-bottom: 8px;
}

.focus-strip,
.kpi-section,
.menu-section,
.sync-panel,
.performance-card,
.insight-panel {
  margin-bottom: 20px;
}

.performance-card {
  padding: 18px;
  border-radius: 24px;
}

@media (max-width: 420px) {
  .focus-strip {
    grid-template-columns: 1fr;
  }
}

:global(:root[data-theme='dark']) .dashboard-container,
:global(:root[data-theme='dark']) .scroll-area {
  background: #020617 !important;
}

:global(:root[data-theme='dark']) .hero-header {
  box-shadow: 0 24px 48px rgba(2, 6, 23, 0.5) !important;
}

:global(:root[data-theme='dark']) .hero-grid {
  opacity: 0.12 !important;
}

:global(:root[data-theme='dark']) .hero-summary-card {
  background: rgba(15, 23, 42, 0.58) !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02) !important;
}

:global(:root[data-theme='dark']) .focus-card,
:global(:root[data-theme='dark']) .sync-card,
:global(:root[data-theme='dark']) .sub-item {
  background: linear-gradient(180deg, #0f172a, #111827) !important;
  border-color: rgba(51, 65, 85, 0.9) !important;
  box-shadow: 0 16px 32px rgba(2, 6, 23, 0.32) !important;
}

:global(:root[data-theme='dark']) .focus-label,
:global(:root[data-theme='dark']) .sync-card small {
  color: #94a3b8 !important;
}

:global(:root[data-theme='dark']) .focus-card strong,
:global(:root[data-theme='dark']) .sync-card strong {
  color: #e2e8f0 !important;
}

:global(:root[data-theme='dark']) .focus-card small {
  color: #64748b !important;
}

:global(:root[data-theme='dark']) .sync-chip {
  background: rgba(37, 99, 235, 0.18) !important;
  color: #93c5fd !important;
}

:global(:root[data-theme='dark']) .icon-blue {
  background: rgba(59, 130, 246, 0.16) !important;
  color: #93c5fd !important;
}

:global(:root[data-theme='dark']) .icon-green {
  background: rgba(16, 185, 129, 0.16) !important;
  color: #6ee7b7 !important;
}

:global(:root[data-theme='dark']) .icon-purple {
  background: rgba(124, 58, 237, 0.16) !important;
  color: #c4b5fd !important;
}

:global(:root[data-theme='dark']) .btn-icon-primary {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(29, 78, 216, 0.12)) !important;
  color: #93c5fd !important;
}

/* Dashboard true-dark pass: this block intentionally wins over older duplicated dashboard styles. */
:global(:root[data-theme='dark']) .dashboard-container {
  --bg: #000814;
  --card: #030712;
  --text: #f8fafc;
  --muted: #9fb0c7;
  --line: rgba(51, 65, 85, 0.86);
  --primary: #60a5fa;
  --primary-dark: #93c5fd;
  background: #000814 !important;
  color: #f8fafc !important;
}

:global(:root[data-theme='dark']) .dashboard-container .hero-header {
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.18), transparent 28%),
    linear-gradient(135deg, #020617 0%, #07111f 48%, #0b1d3a 100%) !important;
  box-shadow: 0 28px 54px rgba(0, 0, 0, 0.72) !important;
}

:global(:root[data-theme='dark']) .dashboard-container .hero-overlay {
  background:
    radial-gradient(circle at top right, rgba(96, 165, 250, 0.16), transparent 24%),
    radial-gradient(circle at bottom left, rgba(14, 165, 233, 0.08), transparent 28%) !important;
}

:global(:root[data-theme='dark']) .dashboard-container .hero-summary-card,
:global(:root[data-theme='dark']) .dashboard-container .hero-meta-card,
:global(:root[data-theme='dark']) .dashboard-container .active-visit-card,
:global(:root[data-theme='dark']) .dashboard-container .stat-card,
:global(:root[data-theme='dark']) .dashboard-container .focus-card,
:global(:root[data-theme='dark']) .dashboard-container .mtd-card,
:global(:root[data-theme='dark']) .dashboard-container .insight-panel,
:global(:root[data-theme='dark']) .dashboard-container .insight-card,
:global(:root[data-theme='dark']) .dashboard-container .performance-card,
:global(:root[data-theme='dark']) .dashboard-container .premium-card,
:global(:root[data-theme='dark']) .dashboard-container .premium-main-btn,
:global(:root[data-theme='dark']) .dashboard-container .sub-item,
:global(:root[data-theme='dark']) .dashboard-container .sync-panel,
:global(:root[data-theme='dark']) .dashboard-container .sync-card,
:global(:root[data-theme='dark']) .dashboard-container .value-box,
:global(:root[data-theme='dark']) .dashboard-container .active-chip {
  background: linear-gradient(180deg, #030712 0%, #070f1d 100%) !important;
  border-color: rgba(51, 65, 85, 0.9) !important;
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.48) !important;
  color: #f8fafc !important;
}

:global(:root[data-theme='dark']) .dashboard-container .hero-summary-card,
:global(:root[data-theme='dark']) .dashboard-container .hero-meta-card {
  background: rgba(2, 6, 23, 0.72) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
}

:global(:root[data-theme='dark']) .dashboard-container .welcome-text,
:global(:root[data-theme='dark']) .dashboard-container .hero-date,
:global(:root[data-theme='dark']) .dashboard-container .hero-summary-label,
:global(:root[data-theme='dark']) .dashboard-container .hero-summary-subtitle,
:global(:root[data-theme='dark']) .dashboard-container .hero-meta-label,
:global(:root[data-theme='dark']) .dashboard-container .section-eyebrow,
:global(:root[data-theme='dark']) .dashboard-container .stat-label,
:global(:root[data-theme='dark']) .dashboard-container .focus-label,
:global(:root[data-theme='dark']) .dashboard-container .focus-card small,
:global(:root[data-theme='dark']) .dashboard-container .mtd-label,
:global(:root[data-theme='dark']) .dashboard-container .insight-label,
:global(:root[data-theme='dark']) .dashboard-container .insight-card small,
:global(:root[data-theme='dark']) .dashboard-container .muted-label,
:global(:root[data-theme='dark']) .dashboard-container .value-box small,
:global(:root[data-theme='dark']) .dashboard-container .prog-info,
:global(:root[data-theme='dark']) .dashboard-container .btn-sub,
:global(:root[data-theme='dark']) .dashboard-container .sub-item span,
:global(:root[data-theme='dark']) .dashboard-container .sync-card small,
:global(:root[data-theme='dark']) .dashboard-container .chip-label,
:global(:root[data-theme='dark']) .dashboard-container .active-visit-address {
  color: #b6c3d6 !important;
  opacity: 1 !important;
}

:global(:root[data-theme='dark']) .dashboard-container .user-name,
:global(:root[data-theme='dark']) .dashboard-container .hero-summary-title,
:global(:root[data-theme='dark']) .dashboard-container .section-title,
:global(:root[data-theme='dark']) .dashboard-container .stat-value,
:global(:root[data-theme='dark']) .dashboard-container .focus-card strong,
:global(:root[data-theme='dark']) .dashboard-container .mtd-val,
:global(:root[data-theme='dark']) .dashboard-container .insight-card strong,
:global(:root[data-theme='dark']) .dashboard-container .perf-title,
:global(:root[data-theme='dark']) .dashboard-container .target-block h3,
:global(:root[data-theme='dark']) .dashboard-container .value-box p,
:global(:root[data-theme='dark']) .dashboard-container .btn-top,
:global(:root[data-theme='dark']) .dashboard-container .sync-card strong,
:global(:root[data-theme='dark']) .dashboard-container .active-chip strong {
  color: #f8fafc !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

:global(:root[data-theme='dark']) .dashboard-container .btn-logout,
:global(:root[data-theme='dark']) .dashboard-container .btn-theme-mode,
:global(:root[data-theme='dark']) .dashboard-container .role-badge,
:global(:root[data-theme='dark']) .dashboard-container .status-pill {
  background: #020617 !important;
  border: 1px solid rgba(96, 165, 250, 0.24) !important;
  color: #f8fafc !important;
  opacity: 1 !important;
}

:global(:root[data-theme='dark']) .dashboard-container .user-avatar {
  background: linear-gradient(135deg, #2563eb, #0ea5e9) !important;
  color: #eff6ff !important;
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.34) !important;
}

:global(:root[data-theme='dark']) .dashboard-container .highlight-blue,
:global(:root[data-theme='dark']) .dashboard-container .highlight-green,
:global(:root[data-theme='dark']) .dashboard-container .highlight-purple {
  background: linear-gradient(180deg, #030712 0%, #071426 100%) !important;
}

:global(:root[data-theme='dark']) .dashboard-container .target-achievement,
:global(:root[data-theme='dark']) .dashboard-container .perf-period,
:global(:root[data-theme='dark']) .dashboard-container .sync-chip {
  background: rgba(37, 99, 235, 0.18) !important;
  border: 1px solid rgba(96, 165, 250, 0.28) !important;
  color: #93c5fd !important;
}

:global(:root[data-theme='dark']) .dashboard-container .prog-bar-bg {
  background: #111827 !important;
}

:global(:root[data-theme='dark']) .dashboard-container .blue {
  color: #93c5fd !important;
}

:global(:root[data-theme='dark']) .dashboard-container .green {
  color: #6ee7b7 !important;
}

:global(:root[data-theme='dark']) .dashboard-container .pull-to-refresh-layer {
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.16), transparent) !important;
}

:global(:root[data-theme='dark']) .dashboard-container .refresh-content {
  color: #cbd5e1 !important;
}

:global(:root[data-theme='light']) .dashboard-container {
  background: #f8fafc !important;
  color: #0f172a !important;
}

:global(:root[data-theme='light']) .dashboard-container .hero-header {
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%) !important;
  border: 1px solid #e2e8f0 !important;
  border-top: none !important;
  border-radius: 0 0 22px 22px !important;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06) !important;
}

:global(:root[data-theme='light']) .dashboard-container .welcome-text,
:global(:root[data-theme='light']) .dashboard-container .hero-date,
:global(:root[data-theme='light']) .dashboard-container .hero-summary-label,
:global(:root[data-theme='light']) .dashboard-container .hero-summary-subtitle,
:global(:root[data-theme='light']) .dashboard-container .hero-meta-label,
:global(:root[data-theme='light']) .dashboard-container .section-eyebrow,
:global(:root[data-theme='light']) .dashboard-container .stat-label,
:global(:root[data-theme='light']) .dashboard-container .mtd-label,
:global(:root[data-theme='light']) .dashboard-container .insight-label,
:global(:root[data-theme='light']) .dashboard-container .value-box small,
:global(:root[data-theme='light']) .dashboard-container .prog-info,
:global(:root[data-theme='light']) .dashboard-container .btn-sub,
:global(:root[data-theme='light']) .dashboard-container .sub-item span,
:global(:root[data-theme='light']) .dashboard-container .sync-card small,
:global(:root[data-theme='light']) .dashboard-container .chip-label,
:global(:root[data-theme='light']) .dashboard-container .active-visit-address {
  color: #64748b !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

:global(:root[data-theme='light']) .dashboard-container .user-name,
:global(:root[data-theme='light']) .dashboard-container .hero-summary-title,
:global(:root[data-theme='light']) .dashboard-container .section-title,
:global(:root[data-theme='light']) .dashboard-container .stat-value,
:global(:root[data-theme='light']) .dashboard-container .mtd-val,
:global(:root[data-theme='light']) .dashboard-container .insight-card strong,
:global(:root[data-theme='light']) .dashboard-container .perf-title,
:global(:root[data-theme='light']) .dashboard-container .target-block h3,
:global(:root[data-theme='light']) .dashboard-container .value-box p,
:global(:root[data-theme='light']) .dashboard-container .btn-top,
:global(:root[data-theme='light']) .dashboard-container .sync-card strong,
:global(:root[data-theme='light']) .dashboard-container .active-chip strong {
  color: #0f172a !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

:global(:root[data-theme='light']) .dashboard-container .hero-summary-card,
:global(:root[data-theme='light']) .dashboard-container .hero-meta-card,
:global(:root[data-theme='light']) .dashboard-container .active-visit-card,
:global(:root[data-theme='light']) .dashboard-container .stat-card,
:global(:root[data-theme='light']) .dashboard-container .focus-card,
:global(:root[data-theme='light']) .dashboard-container .mtd-card,
:global(:root[data-theme='light']) .dashboard-container .insight-panel,
:global(:root[data-theme='light']) .dashboard-container .insight-card,
:global(:root[data-theme='light']) .dashboard-container .performance-card,
:global(:root[data-theme='light']) .dashboard-container .premium-card,
:global(:root[data-theme='light']) .dashboard-container .premium-main-btn,
:global(:root[data-theme='light']) .dashboard-container .sub-item,
:global(:root[data-theme='light']) .dashboard-container .sync-panel,
:global(:root[data-theme='light']) .dashboard-container .sync-card,
:global(:root[data-theme='light']) .dashboard-container .value-box,
:global(:root[data-theme='light']) .dashboard-container .active-chip {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06) !important;
  color: #0f172a !important;
}

:global(:root[data-theme='light']) .dashboard-container .highlight-blue,
:global(:root[data-theme='light']) .dashboard-container .highlight-green,
:global(:root[data-theme='light']) .dashboard-container .highlight-purple {
  background: #ffffff !important;
}

:global(:root[data-theme='light']) .dashboard-container .hero-summary-card {
  border-radius: 16px !important;
  margin-top: 16px !important;
  padding: 14px !important;
}

:global(:root[data-theme='light']) .dashboard-container .main-content {
  margin-top: -22px !important;
  padding: 30px 16px 0 !important;
}

:global(:root[data-theme='light']) .dashboard-container .kpi-section,
:global(:root[data-theme='light']) .dashboard-container .menu-section,
:global(:root[data-theme='light']) .dashboard-container .sync-panel {
  margin-bottom: 18px !important;
}

:global(:root[data-theme='light']) .dashboard-container .btn-logout,
:global(:root[data-theme='light']) .dashboard-container .btn-theme-mode,
:global(:root[data-theme='light']) .dashboard-container .role-badge,
:global(:root[data-theme='light']) .dashboard-container .status-pill {
  background: #f8fafc !important;
  border: 1px solid #e2e8f0 !important;
  color: #0f172a !important;
}

:global(:root[data-theme='light']) .dashboard-container .user-avatar {
  background: #2563eb !important;
  color: #ffffff !important;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.22) !important;
}

:global(:root[data-theme='light']) .dashboard-container .target-achievement,
:global(:root[data-theme='light']) .dashboard-container .perf-period,
:global(:root[data-theme='light']) .dashboard-container .sync-chip {
  background: #eff6ff !important;
  border: 1px solid #bfdbfe !important;
  color: #1d4ed8 !important;
}

:global(:root[data-theme='light']) .dashboard-container .sub-menu-grid,
:global(:root[data-theme='light']) .dashboard-container .insight-grid,
:global(:root[data-theme='light']) .dashboard-container .daily-grid {
  gap: 10px !important;
}

.dashboard-container .icon-action-btn {
  width: 42px !important;
  min-width: 42px !important;
  height: 42px !important;
  padding: 0 !important;
  border-radius: 14px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 1rem !important;
}

.dashboard-container .btn-icon svg,
.dashboard-container .si-icon svg,
.dashboard-container .stat-icon svg,
.dashboard-container .mtd-label svg,
.dashboard-container .role-badge svg,
.dashboard-container .status-pill svg {
  display: block;
}

/* Dashboard true-light pass: wins over older global dark/card rules in Android WebView. */
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container,
:global(body[data-theme='light']) .dashboard-container,
:global(:root[data-theme='light']) .dashboard-container {
  --dash-bg: #f8fafc;
  --dash-card: #ffffff;
  --dash-soft: #f1f5f9;
  --dash-text: #0f172a;
  --dash-muted: #64748b;
  --dash-border: #e2e8f0;
  background: var(--dash-bg) !important;
  color: var(--dash-text) !important;
  width: 100vw !important;
  max-width: 100vw !important;
  height: 100vh !important;
  min-height: 100vh !important;
  max-height: 100vh !important;
  height: 100dvh !important;
  min-height: 100dvh !important;
  max-height: 100dvh !important;
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  touch-action: pan-y !important;
  -webkit-overflow-scrolling: touch !important;
}

:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .hero-header,
:global(body[data-theme='light']) .dashboard-container .hero-header,
:global(:root[data-theme='light']) .dashboard-container .hero-header {
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%) !important;
  border-color: var(--dash-border) !important;
  color: var(--dash-text) !important;
}

:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .hero-summary-card,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .hero-meta-card,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .active-visit-card,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .premium-main-btn,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .sub-item,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .stat-card,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .focus-card,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .mtd-card,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .insight-panel,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .insight-card,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .performance-card,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .premium-card,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .sync-panel,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .sync-card,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .value-box,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .active-chip,
:global(body[data-theme='light']) .dashboard-container .hero-summary-card,
:global(body[data-theme='light']) .dashboard-container .hero-meta-card,
:global(body[data-theme='light']) .dashboard-container .active-visit-card,
:global(body[data-theme='light']) .dashboard-container .premium-main-btn,
:global(body[data-theme='light']) .dashboard-container .sub-item,
:global(body[data-theme='light']) .dashboard-container .stat-card,
:global(body[data-theme='light']) .dashboard-container .focus-card,
:global(body[data-theme='light']) .dashboard-container .mtd-card,
:global(body[data-theme='light']) .dashboard-container .insight-panel,
:global(body[data-theme='light']) .dashboard-container .insight-card,
:global(body[data-theme='light']) .dashboard-container .performance-card,
:global(body[data-theme='light']) .dashboard-container .premium-card,
:global(body[data-theme='light']) .dashboard-container .sync-panel,
:global(body[data-theme='light']) .dashboard-container .sync-card,
:global(body[data-theme='light']) .dashboard-container .value-box,
:global(body[data-theme='light']) .dashboard-container .active-chip,
:global(:root[data-theme='light']) .dashboard-container .hero-summary-card,
:global(:root[data-theme='light']) .dashboard-container .hero-meta-card,
:global(:root[data-theme='light']) .dashboard-container .active-visit-card,
:global(:root[data-theme='light']) .dashboard-container .premium-main-btn,
:global(:root[data-theme='light']) .dashboard-container .sub-item,
:global(:root[data-theme='light']) .dashboard-container .stat-card,
:global(:root[data-theme='light']) .dashboard-container .focus-card,
:global(:root[data-theme='light']) .dashboard-container .mtd-card,
:global(:root[data-theme='light']) .dashboard-container .insight-panel,
:global(:root[data-theme='light']) .dashboard-container .insight-card,
:global(:root[data-theme='light']) .dashboard-container .performance-card,
:global(:root[data-theme='light']) .dashboard-container .premium-card,
:global(:root[data-theme='light']) .dashboard-container .sync-panel,
:global(:root[data-theme='light']) .dashboard-container .sync-card,
:global(:root[data-theme='light']) .dashboard-container .value-box,
:global(:root[data-theme='light']) .dashboard-container .active-chip {
  background: var(--dash-card) !important;
  border-color: var(--dash-border) !important;
  color: var(--dash-text) !important;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06) !important;
  text-shadow: none !important;
}

:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .welcome-text,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .hero-date,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .hero-summary-label,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .hero-summary-subtitle,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .hero-meta-label,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .section-eyebrow,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .stat-label,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .focus-label,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .focus-card small,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .mtd-label,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .insight-label,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .insight-card small,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .muted-label,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .value-box small,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .prog-info,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .btn-sub,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .sub-item span,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .sync-card small,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .chip-label,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .active-visit-address,
:global(body[data-theme='light']) .dashboard-container .welcome-text,
:global(body[data-theme='light']) .dashboard-container .hero-date,
:global(body[data-theme='light']) .dashboard-container .hero-summary-label,
:global(body[data-theme='light']) .dashboard-container .hero-summary-subtitle,
:global(body[data-theme='light']) .dashboard-container .hero-meta-label,
:global(body[data-theme='light']) .dashboard-container .section-eyebrow,
:global(body[data-theme='light']) .dashboard-container .stat-label,
:global(body[data-theme='light']) .dashboard-container .focus-label,
:global(body[data-theme='light']) .dashboard-container .focus-card small,
:global(body[data-theme='light']) .dashboard-container .mtd-label,
:global(body[data-theme='light']) .dashboard-container .insight-label,
:global(body[data-theme='light']) .dashboard-container .insight-card small,
:global(body[data-theme='light']) .dashboard-container .muted-label,
:global(body[data-theme='light']) .dashboard-container .value-box small,
:global(body[data-theme='light']) .dashboard-container .prog-info,
:global(body[data-theme='light']) .dashboard-container .btn-sub,
:global(body[data-theme='light']) .dashboard-container .sub-item span,
:global(body[data-theme='light']) .dashboard-container .sync-card small,
:global(body[data-theme='light']) .dashboard-container .chip-label,
:global(body[data-theme='light']) .dashboard-container .active-visit-address {
  color: var(--dash-muted) !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .user-name,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .hero-summary-title,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .hero-meta-card strong,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .section-title,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .stat-value,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .focus-card strong,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .mtd-val,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .insight-card strong,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .perf-title,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .target-block h3,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .value-box p,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .btn-top,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .sync-card strong,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .active-chip strong,
:global(body[data-theme='light']) .dashboard-container .user-name,
:global(body[data-theme='light']) .dashboard-container .hero-summary-title,
:global(body[data-theme='light']) .dashboard-container .hero-meta-card strong,
:global(body[data-theme='light']) .dashboard-container .section-title,
:global(body[data-theme='light']) .dashboard-container .stat-value,
:global(body[data-theme='light']) .dashboard-container .focus-card strong,
:global(body[data-theme='light']) .dashboard-container .mtd-val,
:global(body[data-theme='light']) .dashboard-container .insight-card strong,
:global(body[data-theme='light']) .dashboard-container .perf-title,
:global(body[data-theme='light']) .dashboard-container .target-block h3,
:global(body[data-theme='light']) .dashboard-container .value-box p,
:global(body[data-theme='light']) .dashboard-container .btn-top,
:global(body[data-theme='light']) .dashboard-container .sync-card strong,
:global(body[data-theme='light']) .dashboard-container .active-chip strong {
  color: var(--dash-text) !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .btn-logout,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .btn-theme-mode,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .role-badge,
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .status-pill,
:global(body[data-theme='light']) .dashboard-container .btn-logout,
:global(body[data-theme='light']) .dashboard-container .btn-theme-mode,
:global(body[data-theme='light']) .dashboard-container .role-badge,
:global(body[data-theme='light']) .dashboard-container .status-pill {
  background: var(--dash-soft) !important;
  border: 1px solid var(--dash-border) !important;
  color: var(--dash-text) !important;
}

/* Final dark contrast guard: keep dashboard crisp after global theme layers. */
:global(html[data-theme='dark'] body[data-theme='dark']) .dashboard-container,
:global(html[data-theme='dark'] body[data-theme='dark']) .dashboard-container * {
  filter: none !important;
  mix-blend-mode: normal !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .dashboard-container,
:global(html[data-theme='dark'] body[data-theme='dark']) .dashboard-container :is(
  .hero-header,
  .main-content,
  .kpi-section,
  .menu-section,
  .sync-panel,
  .performance-card,
  .insight-panel
) {
  opacity: 1 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .dashboard-container :is(
  .user-name,
  .hero-summary-title,
  .hero-meta-card strong,
  .section-title,
  .stat-value,
  .focus-card strong,
  .mtd-val,
  .insight-card strong,
  .perf-title,
  .target-block h3,
  .value-box p,
  .btn-top,
  .sync-card strong,
  .active-chip strong
) {
  color: #ffffff !important;
  opacity: 1 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .dashboard-container :is(
  .welcome-text,
  .hero-date,
  .hero-summary-label,
  .hero-summary-subtitle,
  .hero-meta-label,
  .section-eyebrow,
  .stat-label,
  .focus-label,
  .focus-card small,
  .mtd-label,
  .insight-label,
  .insight-card small,
  .muted-label,
  .value-box small,
  .prog-info,
  .btn-sub,
  .sub-item span,
  .sync-card small,
  .chip-label,
  .active-visit-address
) {
  color: #cbd5e1 !important;
  opacity: 1 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .dashboard-container :is(
  .hero-summary-card,
  .hero-meta-card,
  .active-visit-card,
  .stat-card,
  .focus-card,
  .mtd-card,
  .insight-panel,
  .insight-card,
  .performance-card,
  .premium-card,
  .premium-main-btn,
  .sub-item,
  .sync-panel,
  .sync-card,
  .value-box,
  .active-chip
) {
  background: linear-gradient(180deg, #030712 0%, #07111f 100%) !important;
  border-color: rgba(71, 85, 105, 0.92) !important;
  opacity: 1 !important;
}

/* Final light guard for hero meta cards: these sit on top of the hero and were
   still inheriting white text from the default dark hero styling in some builds. */
:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .hero-meta-card,
:global(body[data-theme='light']) .dashboard-container .hero-meta-card,
:global(:root[data-theme='light']) .dashboard-container .hero-meta-card {
  background: #ffffff !important;
  border-color: #e2e8f0 !important;
  color: #0f172a !important;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06) !important;
  text-shadow: none !important;
  backdrop-filter: none !important;
}

:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .hero-meta-label,
:global(body[data-theme='light']) .dashboard-container .hero-meta-label,
:global(:root[data-theme='light']) .dashboard-container .hero-meta-label {
  color: #475569 !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

:global(html[data-theme='light'] body[data-theme='light']) .dashboard-container .hero-meta-card strong,
:global(body[data-theme='light']) .dashboard-container .hero-meta-card strong,
:global(:root[data-theme='light']) .dashboard-container .hero-meta-card strong {
  color: #0f172a !important;
  opacity: 1 !important;
  text-shadow: none !important;
}
</style>

<style>
html[data-theme='light'] .dashboard-container,
body[data-theme='light'] .dashboard-container {
  background: #f8fafc !important;
  color: #0f172a !important;
  width: 100vw !important;
  max-width: 100vw !important;
  height: 100vh !important;
  min-height: 100vh !important;
  max-height: 100vh !important;
  height: 100dvh !important;
  min-height: 100dvh !important;
  max-height: 100dvh !important;
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  touch-action: pan-y !important;
  -webkit-overflow-scrolling: touch !important;
}

html[data-theme='light'] .dashboard-container .hero-header,
body[data-theme='light'] .dashboard-container .hero-header {
  background:
    linear-gradient(135deg, rgba(239, 246, 255, 0.96) 0%, rgba(255, 255, 255, 0.98) 54%, rgba(224, 242, 254, 0.92) 100%) !important;
  border: 0 !important;
  border-top: none !important;
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  box-sizing: border-box !important;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08) !important;
  color: #0f172a !important;
}

html[data-theme='light'] .dashboard-container .hero-overlay,
html[data-theme='light'] .dashboard-container .hero-grid,
body[data-theme='light'] .dashboard-container .hero-overlay,
body[data-theme='light'] .dashboard-container .hero-grid {
  opacity: 0 !important;
}

html[data-theme='light'] .dashboard-container :is(
  .welcome-text,
  .hero-date,
  .hero-summary-label,
  .hero-summary-subtitle,
  .hero-meta-label
),
body[data-theme='light'] .dashboard-container :is(
  .welcome-text,
  .hero-date,
  .hero-summary-label,
  .hero-summary-subtitle,
  .hero-meta-label
) {
  color: #475569 !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

html[data-theme='light'] .dashboard-container :is(
  .user-name,
  .hero-summary-title,
  .hero-meta-card strong
),
body[data-theme='light'] .dashboard-container :is(
  .user-name,
  .hero-summary-title,
  .hero-meta-card strong
) {
  color: #0f172a !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

html[data-theme='light'] .dashboard-container :is(.hero-summary-card, .hero-meta-card),
body[data-theme='light'] .dashboard-container :is(.hero-summary-card, .hero-meta-card) {
  background: #ffffff !important;
  border: 1px solid #dbeafe !important;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.07) !important;
  color: #0f172a !important;
  backdrop-filter: none !important;
}

html[data-theme='light'] .dashboard-container :is(.role-badge, .status-pill, .btn-theme-mode, .btn-logout),
body[data-theme='light'] .dashboard-container :is(.role-badge, .status-pill, .btn-theme-mode, .btn-logout) {
  background: #eef6ff !important;
  border: 1px solid #bfdbfe !important;
  color: #1e3a8a !important;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.12) !important;
}

html[data-theme='dark'] .dashboard-container .performance-card,
body[data-theme='dark'] .dashboard-container .performance-card {
  background: linear-gradient(180deg, #030712 0%, #0b1120 100%) !important;
  border-color: rgba(51, 65, 85, 0.92) !important;
  color: #cbd5e1 !important;
}

html[data-theme='dark'] .dashboard-container .performance-card :is(.section-eyebrow, .muted-label, .value-box small),
body[data-theme='dark'] .dashboard-container .performance-card :is(.section-eyebrow, .muted-label, .value-box small) {
  color: #94a3b8 !important;
  opacity: 1 !important;
}

html[data-theme='dark'] .dashboard-container .performance-card .section-eyebrow,
body[data-theme='dark'] .dashboard-container .performance-card .section-eyebrow {
  color: #38bdf8 !important;
}

html[data-theme='dark'] .dashboard-container .performance-card .perf-title,
body[data-theme='dark'] .dashboard-container .performance-card .perf-title {
  color: #60a5fa !important;
}

html[data-theme='dark'] .dashboard-container .performance-card .target-block h3,
body[data-theme='dark'] .dashboard-container .performance-card .target-block h3 {
  color: #38bdf8 !important;
}

html[data-theme='dark'] .dashboard-container .performance-card .prog-info,
body[data-theme='dark'] .dashboard-container .performance-card .prog-info {
  color: #94a3b8 !important;
}

html[data-theme='dark'] .dashboard-container .performance-card .prog-info .fw-bold,
body[data-theme='dark'] .dashboard-container .performance-card .prog-info .fw-bold {
  color: #60a5fa !important;
}

html[data-theme='dark'] .dashboard-container .performance-card .value-box,
body[data-theme='dark'] .dashboard-container .performance-card .value-box {
  background: rgba(15, 23, 42, 0.78) !important;
  border-color: rgba(51, 65, 85, 0.92) !important;
}

html[data-theme='dark'] .dashboard-container .performance-card .value-box p:not(.blue):not(.green):not(.orange),
body[data-theme='dark'] .dashboard-container .performance-card .value-box p:not(.blue):not(.green):not(.orange) {
  color: #93c5fd !important;
}

html[data-theme='dark'] .dashboard-container .performance-card .value-box p.blue,
body[data-theme='dark'] .dashboard-container .performance-card .value-box p.blue {
  color: #60a5fa !important;
}

html[data-theme='dark'] .dashboard-container .performance-card .value-box p.green,
body[data-theme='dark'] .dashboard-container .performance-card .value-box p.green {
  color: #34d399 !important;
}

html[data-theme='dark'] .dashboard-container .performance-card :is(.perf-period, .target-achievement),
body[data-theme='dark'] .dashboard-container .performance-card :is(.perf-period, .target-achievement) {
  background: rgba(37, 99, 235, 0.18) !important;
  border: 1px solid rgba(96, 165, 250, 0.34) !important;
  color: #bfdbfe !important;
  box-shadow: none !important;
}
</style>

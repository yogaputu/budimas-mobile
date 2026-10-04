<template>
  <div class="page-wrapper">
    <div class="tagihan-container">
      <header class="header">
        <button @click="$router.back()" class="btn-back" aria-label="Kembali" title="Kembali"><font-awesome-icon icon="chevron-left" /></button>
        <div class="header-title">
          <h3>Tagihan Piutang</h3>
          <p>{{ customerData.Nama }}</p>
        </div>
      </header>

      <div v-if="isOffline" class="offline-banner">
        MODE OFFLINE AKTIF - menampilkan cache tagihan
      </div>

      <div class="summary-card">
        <div class="summary-info">
          <span>Total Piutang Toko</span>
          <h2>Rp {{ formatNumber(totalPiutang) }}</h2>
        </div>
        <div class="summary-badge">
          {{ rawData.length }} Nota
        </div>
      </div>

      <main class="scroll-area">
        <div v-if="loading" class="state-container">
          <div class="loader-enterprise"></div>
        </div>

        <div v-else-if="rawData.length === 0" class="state-container">
          <div class="icon-state">✅</div>
          <p>{{ isOffline ? 'Cache tagihan tidak tersedia.' : 'Toko ini tidak memiliki tunggakan.' }}</p>
        </div>

        <div v-else class="nota-list">
          <div
            v-for="nota in rawData"
            :key="nota.Nota"
            class="nota-card"
            @click="lihatDetail(nota.Nota)"
          >
            <div class="nota-header">
              <span class="nota-number">{{ nota.Nota }}</span>
              <span
                :class="[
                  'status-pajak',
                  String(nota.NamaPrinciple || '').toUpperCase().includes('PAJAK') ? 'pajak' : 'non'
                ]"
              >
                {{ nota.NamaPrinciple || '-' }}
              </span>
            </div>

            <div class="nota-body">
              <div class="info-row">
                <span class="label">Jatuh Tempo:</span>
                <span :class="['value', { overdue: isOverdue(nota.JatuhTempo) }]">
                  {{ formatDate(nota.JatuhTempo) }}
                  <small v-if="isOverdue(nota.JatuhTempo)">(Lewat Tempo)</small>
                </span>
              </div>

              <div class="info-row">
                <span class="label">Sisa Tagihan:</span>
                <span class="value amount">Rp {{ formatNumber(nota.Piutang) }}</span>
              </div>
            </div>

            <div class="nota-footer">
              <span class="tap-hint">Klik untuk lihat detail barang ➔</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api/axios';
import Swal from 'sweetalert2';
import dayjs from 'dayjs';
import { useConnectivityStore } from '@/stores/connectivity';
import { getDb } from '@/services/database';
import { getPayloadArray } from '@/services/visitService';
import { filterLphReady } from '@/utils/lph';

const route = useRoute();
const router = useRouter();
const connectivity = useConnectivityStore();

const loading = ref(false);
const rawData = ref([]);

const isOffline = computed(() => !connectivity.isOnline);

const customerData = computed(() => ({
  Kode: route.query.kode_customer || '',
  Nama: route.query.nama_toko || 'Pelanggan'
}));

const visitId = computed(() => String(route.query.id_kunjungan || route.query.id || '').trim());
const plafonId = computed(() => String(route.query.id_plafon || '').trim());
const customerScopeKey = computed(() => visitId.value || plafonId.value || customerData.value.Kode);
const cacheKey = computed(() => `tagihan:${customerData.value.Kode}:${customerScopeKey.value}`);

// =========================
// DB CACHE HELPERS
// =========================
const getCacheDb = async (cacheKeyValue) => {
  const db = getDb();
  if (!db) return null;

  try {
    const res = await db.query(
      `SELECT payload_json FROM app_cache WHERE cache_key = ? LIMIT 1`,
      [cacheKeyValue]
    );

    const raw = res.values?.[0]?.payload_json;
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('❌ getCacheDb error:', err);
    return null;
  }
};

const saveCacheDb = async (cacheKeyValue, payload) => {
  const db = getDb();
  if (!db) return false;

  try {
    await db.run(
      `
      INSERT OR REPLACE INTO app_cache (cache_key, payload_json, updated_at)
      VALUES (?, ?, ?)
      `,
      [cacheKeyValue, JSON.stringify(payload ?? null), new Date().toISOString()]
    );

    return true;
  } catch (err) {
    console.error('❌ saveCacheDb error:', err);
    return false;
  }
};

// =========================
// NORMALIZE DATA
// =========================
const normalizeTagihan = (rows) => {
  return filterLphReady(Array.isArray(rows) ? rows : []).map((item) => ({
    is_lph: true,
    Nota: String(item.Nota || item.NoFaktur || item.no_faktur || item.no_order || '').trim(),
    NamaPrinciple: String(item.NamaPrinciple || item.nama_principal || '').trim(),
    JatuhTempo: item.JatuhTempo || null,
    Piutang: Number(item.Piutang || item.piutang || item.SisaPiutang || item.sisa_piutang || 0)
  }));
};

const shouldSaveFetchedCache = (rows, payload) => {
  return rows.length > 0 || Array.isArray(payload);
};

// =========================
// LOAD CACHE
// =========================
const loadFromCache = async (showToast = false) => {
  rawData.value = normalizeTagihan(await getCacheDb(cacheKey.value));

  if (showToast && rawData.value.length > 0) {
    await Swal.fire({
      icon: 'info',
      title: 'Mode Offline',
      text: 'Menampilkan tagihan dari cache SQLite.',
      timer: 1400,
      showConfirmButton: false
    });
  }
};

// =========================
// FETCH DATA
// =========================
const fetchData = async () => {
  if (!customerData.value.Kode) return;

  loading.value = true;

  try {
    if (isOffline.value) {
      await loadFromCache(true);
      return;
    }

    const response = await api.get('/api/tagihan/customer', {
      params: {
        kode_customer: customerData.value.Kode,
        id_kunjungan: visitId.value,
        id_plafon: plafonId.value,
        only_lph: 1
      }
    });

    rawData.value = normalizeTagihan(getPayloadArray(response.data));
    if (shouldSaveFetchedCache(rawData.value, response.data)) {
      await saveCacheDb(cacheKey.value, rawData.value);
    }
  } catch (e) {
    console.error('❌ Fetch tagihan error:', e);

    rawData.value = normalizeTagihan(await getCacheDb(cacheKey.value));

    if (rawData.value.length > 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'Koneksi Bermasalah',
        text: 'Menampilkan cache tagihan terakhir dari SQLite.',
        timer: 1500,
        showConfirmButton: false
      });
    } else {
      await Swal.fire('Error', 'Gagal memuat data tagihan', 'error');
    }
  } finally {
    loading.value = false;
  }
};

// =========================
// COMPUTED
// =========================
const totalPiutang = computed(() => {
  return rawData.value.reduce((acc, curr) => acc + Number(curr.Piutang || 0), 0);
});

// =========================
// NAVIGATION
// =========================
const lihatDetail = (nota) => {
  router.push({
    path: '/history-detail',
    query: {
      nota,
      kode_customer: customerData.value.Kode,
      nama_toko: customerData.value.Nama,
      id_kunjungan: visitId.value,
      id_plafon: plafonId.value
    }
  });
};

// =========================
// FORMATTERS
// =========================
const formatNumber = (val) => {
  return new Intl.NumberFormat('id-ID').format(Number(val) || 0);
};

const formatDate = (date) => {
  if (!date) return '-';
  const d = dayjs(date);
  return d.isValid() ? d.format('DD MMM YYYY') : '-';
};

const isOverdue = (date) => {
  if (!date) return false;
  const d = dayjs(date);
  return d.isValid() ? dayjs().isAfter(d, 'day') : false;
};

// =========================
// WATCHERS
// =========================
watch(
  () => connectivity.isOnline,
  async (online) => {
    if (online) {
      await fetchData();
    }
  }
);

// =========================
// INIT
// =========================
onMounted(async () => {
  await fetchData();
});
</script>

<style scoped>
.page-wrapper {
  background: #f8fafc;
  min-height: 100vh;
  display: flex;
  justify-content: stretch;
  width: 100vw;
}

.tagihan-container {
  width: 100vw;
  max-width: none;
  background: white;
  display: flex;
  flex-direction: column;
}

.header {
  background: #1e293b;
  padding: 16px 20px;
  color: white;
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-back {
  background: rgba(255,255,255,0.1);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.header-title h3 {
  margin: 0;
  font-size: 1rem;
}

.header-title p {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.7;
}

.offline-banner {
  background: #f59e0b;
  color: white;
  text-align: center;
  padding: 8px 12px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.summary-card {
  margin: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 16px;
  color: white;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
}

.summary-info span {
  font-size: 0.8rem;
  opacity: 0.9;
}

.summary-info h2 {
  margin: 4px 0 0;
  font-size: clamp(1.25rem, 6vw, 1.5rem);
  font-weight: 800;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.summary-badge {
  background: rgba(255,255,255,0.2);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 20px;
}

.nota-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nota-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px 14px;
  transition: all 0.2s;
}

.nota-card:active {
  transform: scale(0.98);
  background: #f1f5f9;
}

.nota-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(108px, max-content);
  align-items: start;
  gap: 12px;
  margin-bottom: 12px;
}

.nota-number {
  font-weight: 800;
  color: #1e293b;
  font-size: 0.9rem;
  line-height: 1.35;
  text-align: left;
  overflow-wrap: anywhere;
}

.status-pajak {
  font-size: 0.65rem;
  padding: 7px 10px;
  border-radius: 6px;
  font-weight: 700;
  background: #f1f5f9;
  color: #64748b;
  line-height: 1.45;
  min-height: 38px;
  max-width: 132px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow-wrap: anywhere;
}

.status-pajak.pajak {
  background: #fef3c7;
  color: #92400e;
}

.status-pajak.non {
  background: #e0f2fe;
  color: #0369a1;
}

.info-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(92px, auto);
  align-items: start;
  gap: 12px;
  margin-bottom: 6px;
  font-size: 0.85rem;
}

.label {
  color: #64748b;
}

.value {
  font-weight: 600;
  color: #1e293b;
  text-align: right;
  overflow-wrap: anywhere;
}

.value.overdue {
  color: #e11d48;
}

.value.amount {
  font-size: 1rem;
  color: #2563eb;
  font-weight: 800;
}

.nota-footer {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e2e8f0;
}

.tap-hint {
  font-size: 0.7rem;
  color: #94a3b8;
  display: block;
  text-align: center;
}

.state-container {
  padding: 40px;
  text-align: center;
  color: #94a3b8;
}

.icon-state {
  font-size: 2rem;
  margin-bottom: 8px;
}

.loader-enterprise {
  width: 30px;
  height: 30px;
  border: 3px solid #f1f5f9;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

:global(html[data-theme='dark']) .page-wrapper,
:global(body[data-theme='dark']) .page-wrapper {
  background: #020617;
}

:global(html[data-theme='dark']) .tagihan-container,
:global(body[data-theme='dark']) .tagihan-container {
  background: #000814;
  color: #f8fafc;
}

:global(html[data-theme='dark']) .summary-card,
:global(body[data-theme='dark']) .summary-card {
  background: #030712;
  border: 1px solid #1f2937;
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.52);
}

:global(html[data-theme='dark']) .nota-card,
:global(body[data-theme='dark']) .nota-card {
  background: #020617;
  border-color: #1f2937;
  box-shadow: none;
}

:global(html[data-theme='dark']) .nota-card:active,
:global(body[data-theme='dark']) .nota-card:active {
  background: #07111f;
}

:global(html[data-theme='dark']) .status-pajak,
:global(body[data-theme='dark']) .status-pajak,
:global(html[data-theme='dark']) .status-pajak.non,
:global(body[data-theme='dark']) .status-pajak.non {
  background: rgba(14, 165, 233, 0.16);
  border: 1px solid rgba(125, 211, 252, 0.24);
  color: #bae6fd;
}

:global(html[data-theme='dark']) .status-pajak.pajak,
:global(body[data-theme='dark']) .status-pajak.pajak {
  background: rgba(245, 158, 11, 0.16);
  border-color: rgba(251, 191, 36, 0.26);
  color: #fde68a;
}

:global(html[data-theme='dark']) .nota-footer,
:global(body[data-theme='dark']) .nota-footer {
  border-top-color: #1f2937;
}

@media (max-width: 380px) {
  .summary-card {
    grid-template-columns: 1fr;
  }

  .summary-badge {
    width: fit-content;
  }

  .nota-header {
    grid-template-columns: 1fr;
  }

  .status-pajak {
    max-width: 100%;
    width: fit-content;
  }
}
</style>

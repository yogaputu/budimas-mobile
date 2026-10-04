<template>
  <div class="page-wrapper">
    <div class="detail-container">
      <header class="header">
        <button @click="$router.back()" class="btn-back" aria-label="Kembali" title="Kembali"><font-awesome-icon icon="chevron-left" /></button>
        <div class="header-title">
          <h3>Detail Nota</h3>
          <p>{{ notaId }}</p>
        </div>
      </header>

      <div v-if="isOffline" class="offline-banner">
        MODE OFFLINE AKTIF - menampilkan cache detail nota
      </div>

      <main class="scroll-area">
        <div v-if="loading" class="state-container">
          <div class="loader-enterprise"></div>
          <p>Memuat detail nota...</p>
        </div>

        <div v-else-if="errorConnection && !detail" class="state-container">
          <div class="icon-error">📡</div>
          <h4>{{ isOffline ? 'Data Offline Tidak Tersedia' : 'Koneksi Terputus' }}</h4>
          <p>
            {{
              isOffline
                ? 'Detail nota ini belum pernah tersimpan di cache lokal.'
                : 'Gagal mengambil data dari server. Pastikan internet Anda aktif.'
            }}
          </p>
          <button v-if="!isOffline" @click="fetchData" class="btn-reload">
            Hubungkan Ulang
          </button>
        </div>

        <template v-else-if="detail">
          <div class="info-card">
            <div class="info-header">
              <span class="pt-label">{{ detail.NamaPrinciple || '-' }}</span>
              <span class="date">{{ formatDate(detail.Tanggal) }}</span>
            </div>

            <div class="info-main">
              <div class="customer-box">
                <small>Pelanggan:</small>
                <h4>{{ detail.NamaCustomer || '-' }}</h4>
                <p>{{ detail.KodeCustomer || '-' }}</p>
              </div>
            </div>
          </div>

          <div class="items-section">
            <div class="section-title">Rincian Barang</div>

            <div class="item-list">
              <div v-for="(item, index) in detail.items" :key="index" class="item-row">
                <div class="item-desc">
                  <span class="item-name">{{ item.NamaBarang || '-' }}</span>
                  <span class="item-sub">
                    {{ item.KodeStok || '-' }} |
                    {{ formatUomSummary(item) }}
                    @ Rp {{ formatNumber(item.Harga) }}
                  </span>
                </div>
                <div class="item-total">
                  Rp {{ formatNumber(item.JumlahHarga) }}
                </div>
              </div>
            </div>
          </div>

          <div class="calculation-card">
            <div class="calc-row">
              <span>Subtotal</span>
              <span>Rp {{ formatNumber(detail.TotalPenjualan) }}</span>
            </div>

            <div v-if="Number(detail.Potongan) > 0" class="calc-row discount">
              <span>Potongan/Diskon (-)</span>
              <span>Rp {{ formatNumber(detail.Potongan) }}</span>
            </div>

            <div class="calc-row total">
              <span>Total Nota</span>
              <span>Rp {{ formatNumber(detail.TotalPenjualan) }}</span>
            </div>

            <div class="calc-row paid">
              <span>Sudah Terbayar (-)</span>
              <span>Rp {{ formatNumber(detail.Terbayar) }}</span>
            </div>

            <div class="calc-row summary">
              <span>Sisa Piutang</span>
              <span class="highlight">Rp {{ formatNumber(sisaPiutang) }}</span>
            </div>
          </div>

          <div class="action-section">
            <button
              class="btn-pay-now"
              :disabled="sisaPiutang <= 0"
              @click="goToPayment"
            >
              {{ sisaPiutang > 0 ? 'Bayar Sekarang' : 'Sudah Lunas' }}
            </button>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api/axios';
import dayjs from 'dayjs';
import Swal from 'sweetalert2';
import { useConnectivityStore } from '@/stores/connectivity';
import { getDb } from '@/services/database';

const route = useRoute();
const router = useRouter();
const connectivity = useConnectivityStore();

const notaId = ref(route.query.nota || '');
const loading = ref(false);
const detail = ref(null);
const errorConnection = ref(false);

const isOffline = computed(() => !connectivity.isOnline);
const cacheKey = computed(() => `tagihan-detail:${notaId.value}`);

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
const normalizeDetail = (data) => {
  if (!data || typeof data !== 'object') return null;

  return {
    Nota: data.Nota || data.NoFaktur || data.no_faktur || notaId.value,
    NamaPrinciple: String(data.NamaPrinciple || data.nama_principal || '').trim(),
    Tanggal: data.Tanggal || null,
    NamaCustomer: String(data.NamaCustomer || data.nama_customer || '').trim(),
    KodeCustomer: String(data.KodeCustomer || data.kode_customer || '').trim(),
    TotalPenjualan: Number(data.TotalPenjualan || data.total_penjualan || 0),
    Potongan: Number(data.Potongan || data.subtotal_diskon || 0),
    Terbayar: Number(data.Terbayar || data.total_bayar || 0),
    items: Array.isArray(data.items)
      ? data.items.map((item) => ({
          NamaBarang: String(item.NamaBarang || item.nama_barang || item.NamaStok || '').trim(),
          KodeStok: String(item.KodeStok || item.kode_stok || '').trim(),
          Jumlah: Number(item.Jumlah || item.jumlah || item.Pieces || item.pieces || 0),
          Pieces: Number(item.Pieces || item.pieces || 0),
          Box: Number(item.Box || item.box || 0),
          Karton: Number(item.Karton || item.karton || 0),
          PC: String(item.PC || item.pc || 'PCS').trim(),
          Harga: Number(item.Harga || item.harga || 0),
          JumlahHarga: Number(item.JumlahHarga || item.jumlah_harga || 0)
        }))
      : []
  };
};

const formatUomSummary = (item) => {
  const parts = []
  if (Number(item.Pieces || 0) > 0) parts.push(`${formatNumber(item.Pieces)} PCS`)
  if (Number(item.Box || 0) > 0) parts.push(`${formatNumber(item.Box)} BOX`)
  if (Number(item.Karton || 0) > 0) parts.push(`${formatNumber(item.Karton)} KARTON`)

  if (parts.length) return parts.join(' | ')
  return `${formatNumber(item.Jumlah)} ${item.PC || 'PCS'}`
}

// =========================
// LOAD FROM CACHE
// =========================
const loadFromCache = async (showToast = false) => {
  const cached = await getCacheDb(cacheKey.value);
  detail.value = normalizeDetail(cached);

  if (showToast && detail.value) {
    await Swal.fire({
      icon: 'info',
      title: 'Mode Offline',
      text: 'Menampilkan detail nota dari cache SQLite.',
      timer: 1300,
      showConfirmButton: false
    });
  }
};

// =========================
// FETCH DATA
// =========================
const fetchData = async () => {
  if (!notaId.value) return;

  loading.value = true;
  errorConnection.value = false;

  try {
    if (isOffline.value) {
      await loadFromCache(true);

      if (!detail.value) {
        errorConnection.value = true;
      }
      return;
    }

    const response = await api.get('/api/tagihan/detail', {
      params: { nota: notaId.value }
    });

    detail.value = normalizeDetail(response.data);

    if (detail.value) {
      await saveCacheDb(cacheKey.value, detail.value);
    } else {
      errorConnection.value = true;
    }
  } catch (e) {
    console.error('❌ Gagal muat detail nota', e);

    await loadFromCache(false);

    if (detail.value) {
      await Swal.fire({
        icon: 'warning',
        title: 'Koneksi Bermasalah',
        text: 'Menampilkan cache detail nota terakhir dari SQLite.',
        timer: 1400,
        showConfirmButton: false
      });
    } else {
      errorConnection.value = true;
    }
  } finally {
    loading.value = false;
  }
};

// =========================
// COMPUTED
// =========================
const sisaPiutang = computed(() => {
  if (!detail.value) return 0;
  return Math.max(
    0,
    Number(detail.value.TotalPenjualan || 0) - Number(detail.value.Terbayar || 0)
  );
});

// =========================
// ACTIONS
// =========================
const goToPayment = () => {
  if (!detail.value || sisaPiutang.value <= 0) return;

  router.push({
    path: '/payment',
    query: {
      nota: detail.value.Nota || notaId.value,
      kode_customer: detail.value.KodeCustomer || route.query.kode_customer || '',
      nama_toko: detail.value.NamaCustomer || route.query.nama_toko || '',
      total_tagihan: String(sisaPiutang.value),
      total_bayar: String(sisaPiutang.value),
      metode: 'TUNAI',
      id_kunjungan: route.query.id_kunjungan || '',
      nama_principle: detail.value.NamaPrinciple || '',
      jatuh_tempo: detail.value.Tanggal || ''
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
  return d.isValid() ? d.format('DD MMMM YYYY') : '-';
};

// =========================
// WATCHERS
// =========================
watch(
  () => connectivity.isOnline,
  async (online) => {
    if (online && notaId.value) {
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
  background: #f1f5f9;
  min-height: 100vh;
  display: flex;
  justify-content: stretch;
  width: 100vw;
}

.detail-container {
  width: 100vw;
  max-width: none;
  background: white;
  display: flex;
  flex-direction: column;
}

/* Header */
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

.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* Info Card */
.info-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.info-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.pt-label {
  font-size: 0.65rem;
  font-weight: 800;
  color: #3b82f6;
  text-transform: uppercase;
}

.date {
  font-size: 0.75rem;
  color: #64748b;
}

.customer-box small {
  color: #94a3b8;
  font-size: 0.7rem;
}

.customer-box h4 {
  margin: 2px 0;
  color: #1e293b;
}

.customer-box p {
  margin: 0;
  font-size: 0.75rem;
  color: #64748b;
}

/* Items Section */
.section-title {
  font-size: 0.8rem;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 12px;
  padding-left: 4px;
  border-left: 4px solid #3b82f6;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 25px;
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 8px;
}

.item-desc {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding-right: 10px;
}

.item-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
}

.item-sub {
  font-size: 0.75rem;
  color: #64748b;
}

.item-total {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
}

/* Calculation Card */
.calculation-card {
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.calc-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: #475569;
}

.calc-row.total {
  font-weight: 700;
  color: #1e293b;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
}

.calc-row.discount {
  color: #e11d48;
}

.calc-row.paid {
  color: #059669;
}

.calc-row.summary {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 2px solid #e2e8f0;
  font-weight: 800;
  font-size: 1rem;
}

.highlight {
  color: #2563eb;
}

.action-section {
  margin-top: 20px;
}

.btn-pay-now {
  width: 100%;
  padding: 14px 16px;
  border: none;
  border-radius: 12px;
  background: #14b8a6;
  color: white;
  font-weight: 800;
  font-size: 0.95rem;
}

.btn-pay-now:disabled {
  background: #cbd5e1;
}

/* State */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: #94a3b8;
}

.icon-error {
  font-size: 3rem;
  margin-bottom: 10px;
}

.btn-reload {
  margin-top: 20px;
  padding: 12px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.9rem;
  box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
}

.btn-reload:active {
  transform: scale(0.95);
  background: #2563eb;
}

.loader-enterprise {
  width: 35px;
  height: 35px;
  border: 4px solid #f1f5f9;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

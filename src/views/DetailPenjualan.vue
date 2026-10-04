<template>
  <div class="viewport-wrapper">
    <header class="header-enterprise">
      <div class="header-left">
        <button @click="router.back()" class="btn-icon-back" aria-label="Kembali" title="Kembali">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div class="title-stack">
          <h1>Rincian Transaksi</h1>
          <span class="nota-label">#{{ notaId }}</span>
        </div>
      </div>
      <div class="header-right">
        <span v-if="routeStatusLabel" :class="['pill-status', 'verify-status', `verify-${routeStatusGroup}`]">
          {{ routeStatusLabel }}
        </span>
        <span v-if="detail" :class="['pill-status', detail.Tunai === 'KREDIT' ? 'is-kredit' : 'is-tunai']">
          {{ detail.Tunai || '-' }} {{ detail.StNota || '' }}
        </span>
      </div>
    </header>

    <div v-if="isOffline" class="offline-banner">
      MODE OFFLINE AKTIF - menampilkan cache detail penjualan
    </div>

    <main v-if="loading" class="full-center">
      <div class="loader-enterprise"></div>
      <p class="loading-text">{{ isOffline ? 'Memuat cache lokal...' : 'Menyiapkan Data...' }}</p>
    </main>

    <main v-else-if="detail" class="main-content">
      <section class="card-brief">
        <div class="brief-item">
          <label>Pelanggan</label>
          <p class="font-bold">{{ detail.NamaCustomer?.trim() || '-' }}</p>
        </div>
        <div class="brief-item text-right">
          <label>Waktu Transaksi</label>
          <p>{{ formatIndoDate(detail.Tanggal) }}</p>
        </div>
      </section>

      <section class="items-container">
        <div class="table-header">
          <span>Daftar Barang (Net)</span>
          <span>Subtotal</span>
        </div>

        <div class="scrollable-list">
          <div v-for="(item, index) in detail.items" :key="index" class="list-row">
            <div class="row-info">
              <span class="row-name">{{ item.NamaStok?.trim() || '-' }}</span>
              <span class="row-meta">
                {{ formatUomSummary(item) }} @ {{ formatNumber(item.Harga) }}
                <small v-if="Number(item.DiscRP) > 0" class="text-rose">
                  (Disc: -{{ formatNumber(item.DiscRP) }})
                </small>
              </span>
            </div>
            <div class="row-price">
              Rp {{ formatNumber(itemLineSubtotal(item)) }}
            </div>
          </div>
        </div>
      </section>

      <section class="footer-summary">
        <div class="tax-calculation">
          <div class="tax-row">
            <span>Subtotal</span>
            <span>Rp {{ formatNumber(subtotal) }}</span>
          </div>
          <div class="tax-row">
            <span>Diskon</span>
            <span>Rp {{ formatNumber(totalDiskon) }}</span>
          </div>
          <div class="tax-row">
            <span>Subtotal (DPP)</span>
            <span>Rp {{ formatNumber(subtotalDPP) }}</span>
          </div>
          <div class="tax-row">
            <span>PPN (11%)</span>
            <span>Rp {{ formatNumber(ppnAmount) }}</span>
          </div>
        </div>

        <div class="summary-line">
          <span>Total Akhir</span>
          <span class="grand-total-text">Rp {{ formatNumber(grandTotalWithTax) }}</span>
        </div>

        <div class="meta-grid-footer">
          <div class="m-item">
            <label>Jatuh Tempo</label>
            <span class="val text-rose">{{ formatFullDate(detail.JatuhTempo) }}</span>
          </div>
          <div class="m-item">
            <label>Sales / Principle</label>
            <span class="val">
              {{ detail.NamaSales?.trim() || '-' }} / {{ detail.NamaPrinciple?.trim() || '-' }}
            </span>
          </div>
        </div>
      </section>
    </main>

    <main v-else class="full-center">
      <p>{{ isOffline ? 'Data offline tidak ditemukan.' : 'Data tidak ditemukan.' }}</p>
      <button v-if="!isOffline" @click="fetchDetail" class="btn-retry">Coba Lagi</button>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api/axios';
import { useConnectivityStore } from '@/stores/connectivity';
import { getDb } from '@/services/database';
import { parseLocalDateInput } from '@/utils/dateLocal';

const route = useRoute();
const router = useRouter();
const connectivity = useConnectivityStore();

const loading = ref(true);
const detail = ref(null);

const notaId = computed(() => route.query?.nota || '-');
const isOffline = computed(() => !connectivity.isOnline);
const cacheKey = computed(() => `detail-penjualan:${notaId.value}`);
const routeStatusLabel = computed(() => String(route.query?.status_label || '').trim());
const routeStatusGroup = computed(() => {
  const status = Number(route.query?.status_order);
  if (status === -1 || status === 7) return 'rejected';
  if (status === -2) return 'skipped';
  if (status === 0 || Number.isNaN(status)) return 'pending';
  return 'accepted';
});

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
    Nota: data.Nota || notaId.value,
    Tunai: String(data.Tunai || '').trim(),
    StNota: String(data.StNota || '').trim(),
    NamaCustomer: String(data.NamaCustomer || '').trim(),
    KodeCustomer: String(data.KodeCustomer || '').trim(),
    Tanggal: data.Tanggal || null,
    JatuhTempo: data.JatuhTempo || null,
    NamaSales: String(data.NamaSales || '').trim(),
    NamaPrinciple: String(data.NamaPrinciple || '').trim(),
    TotalPenjualan: Number(data.TotalPenjualan || 0),
    Potongan: Number(data.Potongan || data.subtotal_diskon || 0),
    items: Array.isArray(data.items)
      ? data.items.map((item) => ({
          NamaStok: String(item.NamaStok || item.NamaBarang || item.nama_stok || '').trim(),
          KodeStok: String(item.KodeStok || item.kode_stok || '').trim(),
          Jumlah: Number(item.Jumlah || item.jumlah || 0),
          Pieces: Number(item.Pieces || item.pieces || 0),
          Box: Number(item.Box || item.box || 0),
          Karton: Number(item.Karton || item.karton || 0),
          CT: String(item.CT || item.PC || item.ct || 'PCS').trim(),
          Harga: Number(item.Harga || item.harga || 0),
          DiscRP: Number(item.DiscRP || item.disc_rp || 0),
          JumlahHarga: Number(item.JumlahHarga || item.jumlah_harga || 0),
          StatusTerima: String(item.StatusTerima || item.status_terima || 'Belum Diterima').trim()
        }))
      : []
  };
};

const receivedStatusClass = (status) => {
  const value = String(status || '').toLowerCase();
  if (value.includes('sudah')) return 'is-received';
  if (value.includes('pengiriman') || value.includes('sebagian')) return 'is-partial';
  return 'is-pending';
};

// =========================
// LOAD CACHE
// =========================
const loadFromCache = async () => {
  const cached = await getCacheDb(cacheKey.value);
  detail.value = normalizeDetail(cached);
};

// =========================
// CALCULATIONS
// =========================
const itemLineSubtotal = (item) => {
  return Number(item.JumlahHarga || ((Number(item.Jumlah) || 0) * (Number(item.Harga) || 0)));
};

const formatUomSummary = (item) => {
  const parts = []
  if (Number(item.Pieces || 0) > 0) parts.push(`${formatNumber(item.Pieces)} PCS`)
  if (Number(item.Box || 0) > 0) parts.push(`${formatNumber(item.Box)} BOX`)
  if (Number(item.Karton || 0) > 0) parts.push(`${formatNumber(item.Karton)} KARTON`)

  if (parts.length) return parts.join(' | ')
  return `${formatNumber(item.Jumlah)} ${item.CT?.trim() || 'PCS'}`
}

const subtotal = computed(() => {
  if (!detail.value) return 0;
  const backendTotal = Number(detail.value.TotalPenjualan || 0);
  if (backendTotal > 0) return backendTotal;
  if (!detail.value.items) return 0;
  return detail.value.items.reduce((acc, item) => acc + itemLineSubtotal(item), 0);
});

const totalDiskon = computed(() => {
  if (!detail.value) return 0;
  const detailPotongan = Number(detail.value.Potongan || 0);
  if (detailPotongan > 0) return detailPotongan;
  return (detail.value.items || []).reduce((acc, item) => acc + (Number(item.DiscRP) || 0), 0);
});

const subtotalDPP = computed(() => {
  return subtotal.value - totalDiskon.value;
});

const ppnAmount = computed(() => {
  return subtotalDPP.value * 0.11;
});

const grandTotalWithTax = computed(() => {
  return subtotalDPP.value + ppnAmount.value;
});

// =========================
// FORMATTERS
// =========================
const formatNumber = (n) => {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(n) || 0);
};

const formatIndoDate = (dateStr) => {
  if (!dateStr) return '-';

  const d = parseLocalDateInput(dateStr);
  if (Number.isNaN(d.getTime())) return '-';

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatFullDate = (d) => {
  if (!d) return '-';
  const date = parseLocalDateInput(d);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

// =========================
// FETCH DETAIL
// =========================
const fetchDetail = async () => {
  loading.value = true;

  try {
    const nId = route.query?.nota;
    if (!nId) {
      detail.value = null;
      return;
    }

    if (isOffline.value) {
      await loadFromCache();
      return;
    }

    const response = await api.get('/api/tagihan/detail', {
      params: {
        nota: nId.toString().trim()
      }
    });

    detail.value = normalizeDetail(response.data);

    if (detail.value) {
      await saveCacheDb(cacheKey.value, detail.value);
    }
  } catch (error) {
    console.error('❌ Fetch Detail Error:', error);
    await loadFromCache();
  } finally {
    loading.value = false;
  }
};

// =========================
// WATCHERS
// =========================
watch(
  () => connectivity.isOnline,
  async (online) => {
    if (online && route.query?.nota) {
      await fetchDetail();
    }
  }
);

// =========================
// INIT
// =========================
onMounted(async () => {
  await fetchDetail();
});
</script>

<style scoped>
.viewport-wrapper {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
}

.header-enterprise {
  min-height: 78px;
  background: white;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.header-left {
  display: contents;
}

.btn-icon-back {
  background: #f1f5f9;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.title-stack h1 {
  font-size: 1.02rem;
  margin: 0;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.18;
}

.nota-label {
  display: block;
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 800;
  line-height: 1.25;
  overflow-wrap: anywhere;
  max-width: 100%;
}

.header-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  max-width: 132px;
}

.pill-status {
  max-width: 100%;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.58rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0;
  line-height: 1.15;
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
}

.verify-status {
  border: 1px solid transparent;
}

.verify-pending {
  background: #fffbeb;
  color: #92400e;
  border-color: #fde68a;
}

.verify-accepted {
  background: #ecfdf5;
  color: #047857;
  border-color: #a7f3d0;
}

.verify-rejected {
  background: #fff1f2;
  color: #be123c;
  border-color: #fecdd3;
}

.verify-skipped {
  background: #f8fafc;
  color: #475569;
  border-color: #e2e8f0;
}

.is-kredit {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.is-tunai {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
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

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 12px;
  overflow: hidden;
}

.card-brief {
  background: white;
  border-radius: 16px;
  padding: 12px 16px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  border: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.brief-item label {
  display: block;
  font-size: 0.65rem;
  color: #94a3b8;
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 2px;
}

.brief-item p {
  margin: 0;
  font-size: 0.85rem;
  color: #1e293b;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.font-bold {
  font-weight: 700;
}

.items-container {
  flex: 1;
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-header {
  padding: 12px 16px;
  background: #f8fafc;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  border-bottom: 1px solid #f1f5f9;
}

.scrollable-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
}

.list-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
  gap: 12px;
}

.row-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.row-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.item-received-pill {
  width: fit-content;
  margin-top: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 800;
  border: 1px solid transparent;
}

.item-received-pill.is-received {
  background: #dcfce7;
  color: #166534;
  border-color: #bbf7d0;
}

.item-received-pill.is-partial {
  background: #fef3c7;
  color: #92400e;
  border-color: #fde68a;
}

.item-received-pill.is-pending {
  background: #f1f5f9;
  color: #475569;
  border-color: #e2e8f0;
}

.row-meta {
  font-size: 0.75rem;
  color: #94a3b8;
}

.row-price {
  font-size: 0.85rem;
  font-weight: 700;
  color: #0f172a;
  align-self: start;
  white-space: nowrap;
}

.footer-summary {
  background: #1e293b;
  border-radius: 16px;
  padding: 16px;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 -4px 12px rgba(0,0,0,0.05);
}

.tax-calculation {
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  padding-bottom: 10px;
}

.tax-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #94a3b8;
  margin-bottom: 4px;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.grand-total-text {
  font-size: 1.35rem;
  font-weight: 800;
  color: #10b981;
  text-align: right;
  white-space: nowrap;
}

.meta-grid-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.m-item label {
  display: block;
  font-size: 0.6rem;
  color: #94a3b8;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.m-item .val {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: #e2e8f0;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.text-rose {
  color: #fb7185 !important;
}

.full-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.loading-text {
  font-size: 0.85rem;
  color: #94a3b8;
}

.loader-enterprise {
  width: 30px;
  height: 30px;
  border: 3px solid #e2e8f0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.btn-retry {
  background: #6366f1;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  margin-top: 10px;
  font-weight: 600;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 380px) {
  .header-enterprise {
    grid-template-columns: 40px minmax(0, 1fr);
    align-items: start;
  }

  .header-right {
    grid-column: 2;
    align-items: flex-start;
    flex-direction: row;
    flex-wrap: wrap;
    max-width: none;
  }

  .pill-status {
    max-width: 150px;
  }

  .grand-total-text {
    font-size: 1.18rem;
  }
}
</style>

<style>
html[data-theme='dark'] .viewport-wrapper,
body[data-theme='dark'] .viewport-wrapper {
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.12), transparent 26%),
    linear-gradient(180deg, #020617 0%, #030712 100%) !important;
  color: #e5edf8 !important;
}

html[data-theme='dark'] .viewport-wrapper .header-enterprise,
body[data-theme='dark'] .viewport-wrapper .header-enterprise {
  background: rgba(2, 6, 23, 0.94) !important;
  border-bottom-color: rgba(51, 65, 85, 0.92) !important;
}

html[data-theme='dark'] .viewport-wrapper .btn-icon-back,
body[data-theme='dark'] .viewport-wrapper .btn-icon-back {
  background: #0f172a !important;
  border: 1px solid rgba(51, 65, 85, 0.92) !important;
  color: #e5edf8 !important;
}

html[data-theme='dark'] .viewport-wrapper .title-stack h1,
body[data-theme='dark'] .viewport-wrapper .title-stack h1,
html[data-theme='dark'] .viewport-wrapper .brief-item p,
body[data-theme='dark'] .viewport-wrapper .brief-item p,
html[data-theme='dark'] .viewport-wrapper .row-name,
body[data-theme='dark'] .viewport-wrapper .row-name,
html[data-theme='dark'] .viewport-wrapper .row-price,
body[data-theme='dark'] .viewport-wrapper .row-price,
html[data-theme='dark'] .viewport-wrapper .summary-line span,
body[data-theme='dark'] .viewport-wrapper .summary-line span {
  color: #f8fafc !important;
  opacity: 1 !important;
}

html[data-theme='dark'] .viewport-wrapper .nota-label,
body[data-theme='dark'] .viewport-wrapper .nota-label,
html[data-theme='dark'] .viewport-wrapper .brief-item label,
body[data-theme='dark'] .viewport-wrapper .brief-item label,
html[data-theme='dark'] .viewport-wrapper .table-header,
body[data-theme='dark'] .viewport-wrapper .table-header,
html[data-theme='dark'] .viewport-wrapper .row-meta,
body[data-theme='dark'] .viewport-wrapper .row-meta,
html[data-theme='dark'] .viewport-wrapper .tax-row,
body[data-theme='dark'] .viewport-wrapper .tax-row,
html[data-theme='dark'] .viewport-wrapper .m-item label,
body[data-theme='dark'] .viewport-wrapper .m-item label {
  color: #9fb0c7 !important;
  opacity: 1 !important;
}

html[data-theme='dark'] .viewport-wrapper .card-brief,
body[data-theme='dark'] .viewport-wrapper .card-brief,
html[data-theme='dark'] .viewport-wrapper .items-container,
body[data-theme='dark'] .viewport-wrapper .items-container,
html[data-theme='dark'] .viewport-wrapper .footer-summary,
body[data-theme='dark'] .viewport-wrapper .footer-summary {
  background: linear-gradient(180deg, #030712 0%, #0b1220 100%) !important;
  border: 1px solid rgba(51, 65, 85, 0.94) !important;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.32) !important;
}

html[data-theme='dark'] .viewport-wrapper .table-header,
body[data-theme='dark'] .viewport-wrapper .table-header {
  background: #020617 !important;
  border-bottom-color: rgba(51, 65, 85, 0.92) !important;
}

html[data-theme='dark'] .viewport-wrapper .list-row,
body[data-theme='dark'] .viewport-wrapper .list-row {
  border-bottom-color: rgba(51, 65, 85, 0.72) !important;
}

html[data-theme='dark'] .viewport-wrapper .grand-total-text,
body[data-theme='dark'] .viewport-wrapper .grand-total-text {
  color: #f8fafc !important;
}

html[data-theme='dark'] .viewport-wrapper .verify-pending,
body[data-theme='dark'] .viewport-wrapper .verify-pending {
  background: rgba(120, 53, 15, 0.24) !important;
  color: #fed7aa !important;
  border-color: rgba(251, 146, 60, 0.42) !important;
}

html[data-theme='dark'] .viewport-wrapper .verify-accepted,
body[data-theme='dark'] .viewport-wrapper .verify-accepted,
html[data-theme='dark'] .viewport-wrapper .is-tunai,
body[data-theme='dark'] .viewport-wrapper .is-tunai {
  background: rgba(6, 78, 59, 0.24) !important;
  color: #a7f3d0 !important;
  border-color: rgba(52, 211, 153, 0.38) !important;
}

html[data-theme='dark'] .viewport-wrapper .verify-rejected,
body[data-theme='dark'] .viewport-wrapper .verify-rejected {
  background: rgba(127, 29, 29, 0.24) !important;
  color: #fca5a5 !important;
  border-color: rgba(239, 68, 68, 0.38) !important;
}

html[data-theme='dark'] .viewport-wrapper .verify-skipped,
body[data-theme='dark'] .viewport-wrapper .verify-skipped,
html[data-theme='dark'] .viewport-wrapper .is-kredit,
body[data-theme='dark'] .viewport-wrapper .is-kredit {
  background: rgba(30, 41, 59, 0.88) !important;
  color: #cbd5e1 !important;
  border-color: rgba(71, 85, 105, 0.92) !important;
}
</style>

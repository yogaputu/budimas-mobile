<template>
  <div class="history-container">
    <header class="header-modern">
      <div class="header-glow"></div>

      <div class="header-content">
        <button @click="router.back()" class="btn-blur-back" aria-label="Kembali">
          <span><font-awesome-icon icon="chevron-left" /></span>
        </button>

        <div class="header-title">
          <span>Riwayat Penjualan Customer</span>
          <h3>Lini Masa Transaksi</h3>
        </div>
      </div>

      <div v-if="listHistory.length > 0" class="header-stats">
        <div class="stat-chip">
          <small>Total Nota</small>
          <strong>{{ listHistory.length }}</strong>
        </div>
        <div class="stat-chip success">
          <small>Total Omset</small>
          <strong>Rp {{ formatNumber(totalOmset) }}</strong>
        </div>
      </div>
    </header>

    <div v-if="loading && page === 1" class="loading-state">
      <div class="spinner"></div>
      <p>Mengambil data riwayat...</p>
    </div>

    <div v-else-if="listHistory.length === 0" class="empty-state">
      <div class="empty-orb">📂</div>
      <h4>Belum Ada Riwayat</h4>
      <p>Belum ada transaksi untuk customer ini.</p>
    </div>

    <div v-else class="timeline-body">
      <section
        v-for="monthGroup in groupedHistoryByMonth"
        :key="monthGroup.monthKey"
        class="month-section"
      >
        <div class="month-header-sticky">
          <div class="month-header-card">
            <div class="month-header-left">
              <small>Periode</small>
              <h4>{{ monthGroup.monthLabel }}</h4>
            </div>

            <div class="month-header-right">
              <div class="mini-badge">{{ monthGroup.totalItems }} Nota</div>
              <div class="mini-badge success">Rp {{ formatNumber(monthGroup.totalOmset) }}</div>
            </div>
          </div>
        </div>

        <div
          v-for="dateGroup in monthGroup.dates"
          :key="dateGroup.dateKey"
          class="date-section"
        >
          <div class="date-badge-sticky">
            <div class="badge-content">
              <div class="badge-date-main">{{ formatHeaderDate(dateGroup.dateKey) }}</div>
              <span class="nota-count">{{ dateGroup.items.length }} Nota</span>
            </div>
          </div>

          <div class="cards-stack">
            <div
              v-for="item in dateGroup.items"
              :key="item.Nota"
              class="card-nota"
              @click="viewDetail(item)"
            >
              <div class="timeline-dot"></div>

              <div class="nota-header">
                <div class="nota-badge-wrap">
                  <span class="nota-id">#{{ item.Nota }}</span>
                  <span class="time-pill">{{ formatTime(item.Tanggal) }}</span>
                  <span :class="['verify-pill', `verify-${item.StatusVerifikasiGroup}`]">
                    {{ item.StatusOrderLabel }}
                  </span>
                  <span :class="['delivery-pill', `delivery-${item.StatusTerimaGroup}`]">
                    {{ item.StatusTerima }}
                  </span>
                </div>

                <div class="arrow-wrap">
                  <span>›</span>
                </div>
              </div>

              <div class="nota-body">
                <div class="customer-info">
                  <h4>{{ item.NamaCustomer }}</h4>
                  <p class="customer-code">{{ item.KodeCustomer }}</p>
                </div>

                <div class="total-info text-right">
                  <small class="total-label">Total Penjualan</small>
                  <div class="total-amount">Rp {{ formatNumber(item.TotalPenjualan) }}</div>
                </div>
              </div>

              <div class="card-bottom-accent"></div>
            </div>
          </div>
        </div>
      </section>

      <div class="pagination-trigger">
        <button
          v-if="!isFinished"
          @click="loadMore"
          class="btn-load-more"
          :disabled="loading"
        >
          {{ loading ? 'Memuat...' : 'Tampilkan Lebih Banyak' }}
        </button>

        <p v-else class="end-message">Semua data telah ditampilkan</p>
      </div>
    </div>

    <div v-if="listHistory.length > 0" class="summary-footer">
      <div class="summary-content">
        <div class="summary-item">
          <small>Total Nota Tampil</small>
          <strong>{{ listHistory.length }} Nota</strong>
        </div>

        <div class="summary-divider"></div>

        <div class="summary-item text-right">
          <small>Total Omset Tampil</small>
          <strong class="text-success">Rp {{ formatNumber(totalOmset) }}</strong>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import api from '@/api/axios';
import Swal from 'sweetalert2';
import { useConnectivityStore } from '@/stores/connectivity';
import { getDb } from '@/services/database';
import { getPayloadArray } from '@/services/visitService';
import { parseLocalDateInput } from '@/utils/dateLocal';

const router = useRouter();
const route = useRoute();
const connectivity = useConnectivityStore();

const loading = ref(true);
const listHistory = ref([]);
const page = ref(1);
const isFinished = ref(false);

const isOffline = computed(() => !connectivity.isOnline);
const customerCode = computed(() => route.query.kode_customer || '');
const visitId = computed(() => route.query.id_kunjungan || '');
const plafonId = computed(() => route.query.id_plafon || route.query.IDPlafon || '');
const cacheKey = computed(() => (
  `history-sales:${customerCode.value}:${plafonId.value || 'no_plafon'}:${visitId.value || 'no_visit'}`
));

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
const resolveOrderStatusGroup = (status) => {
  const numericStatus = Number(status);

  if (numericStatus === -1 || numericStatus === 7) return 'rejected';
  if (numericStatus === -2) return 'skipped';
  if (numericStatus === 0 || Number.isNaN(numericStatus)) return 'pending';
  return 'accepted';
};

const resolveOrderStatusLabel = (status) => {
  const numericStatus = Number(status);

  const statusMap = {
    '-2': 'Tidak Ada Transaksi',
    '-1': 'Ditolak',
    0: 'Menunggu Verifikasi',
    1: 'Diterima',
    2: 'Terjadwal',
    3: 'Picking Selesai',
    4: 'Dalam Pengiriman',
    5: 'Perlu Revisi',
    6: 'Terkirim',
    7: 'Dibatalkan',
    8: 'Retur',
    9: 'Dijadwalkan Ulang',
    10: 'Terjadwal Ulang',
    11: 'Pengiriman Ulang'
  };

  if (Number.isNaN(numericStatus)) return 'Menunggu Verifikasi';
  return statusMap[numericStatus] || 'Menunggu Verifikasi';
};

const normalizeHistory = (rows) => {
  return (Array.isArray(rows) ? rows : []).map((item) => {
    const rawStatus = item.StatusOrder ?? item.status_order ?? item.status ?? 0;
    const statusLabel = String(
      item.StatusOrderLabel
      || item.status_order_label
      || item.StatusVerifikasi
      || item.status_verifikasi
      || resolveOrderStatusLabel(rawStatus)
    ).trim();

    return {
      Nota: String(item.Nota || item.NoFaktur || item.no_faktur || item.no_order || item.id || '').trim(),
      Tanggal: item.Tanggal || '',
      NamaCustomer: String(item.NamaCustomer || item.nama_customer || '').trim(),
      KodeCustomer: String(item.KodeCustomer || item.kode_customer || '').trim(),
      TotalPenjualan: Number(item.TotalPenjualan || item.total_penjualan || item.Total || 0),
      StatusOrder: Number(rawStatus),
      StatusOrderLabel: statusLabel || resolveOrderStatusLabel(rawStatus),
      StatusVerifikasiGroup: String(
        item.StatusVerifikasiGroup
        || item.status_verifikasi_group
        || resolveOrderStatusGroup(rawStatus)
      ).trim(),
      StatusTerima: String(item.StatusTerima || item.status_terima || 'Belum Diterima').trim(),
      StatusTerimaGroup: String(item.StatusTerimaGroup || item.status_terima_group || 'pending').trim()
    };
  });
};

const shouldSaveFetchedCache = (rows, payload) => {
  return rows.length > 0 || Array.isArray(payload);
};

// =========================
// DATE HELPERS
// =========================
const parseDateSafe = (dateValue) => {
  if (!dateValue) return null;

  const normalized = String(dateValue).trim();
  const date = normalized.includes(' ') || normalized.includes('T')
    ? new Date(normalized.replace(' ', 'T'))
    : parseLocalDateInput(normalized);

  if (!isNaN(date.getTime())) return date;

  const onlyDate = String(dateValue).split(' ')[0].split('T')[0];
  const fallback = parseLocalDateInput(onlyDate);
  return !isNaN(fallback.getTime()) ? fallback : null;
};

const getDateKey = (dateValue) => {
  const date = parseDateSafe(dateValue);
  if (!date) return 'Tanpa Tanggal';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getMonthKey = (dateValue) => {
  const date = parseDateSafe(dateValue);
  if (!date) return 'Tanpa Bulan';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
};

const formatMonthYear = (monthKey) => {
  if (monthKey === 'Tanpa Bulan') return monthKey;

  try {
    const [year, month] = monthKey.split('-');
    return new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric'
    }).format(new Date(Number(year), Number(month) - 1, 1));
  } catch (e) {
    return monthKey;
  }
};

// =========================
// LOAD CACHE
// =========================
const loadFromCache = async (showToast = false) => {
  listHistory.value = normalizeHistory(await getCacheDb(cacheKey.value));
  isFinished.value = true;

  if (showToast && listHistory.value.length > 0) {
    await Swal.fire({
      icon: 'info',
      title: 'Mode Offline',
      text: 'Menampilkan riwayat penjualan dari cache SQLite.',
      timer: 1400,
      showConfirmButton: false
    });
  }
};

// =========================
// FETCH DATA
// =========================
const fetchHistory = async (isLoadMore = false) => {
  try {
    if (!customerCode.value) {
      listHistory.value = [];
      isFinished.value = true;
      return;
    }

    if (!isLoadMore) {
      loading.value = true;
      page.value = 1;
      listHistory.value = [];
      isFinished.value = false;
    }

    if (isOffline.value) {
      await loadFromCache(true);
      return;
    }

    const response = await api.get('/api/history/by-customer', {
      params: {
        kode_customer: customerCode.value,
        id_kunjungan: visitId.value,
        id_plafon: plafonId.value,
        page: page.value
      }
    });

    const data = getPayloadArray(response.data);
    const normalized = normalizeHistory(data);

    listHistory.value = isLoadMore
      ? [...listHistory.value, ...normalized]
      : normalized;

    if (shouldSaveFetchedCache(normalized, response.data)) {
      await saveCacheDb(cacheKey.value, listHistory.value);
    }

    if (normalized.length < 25) {
      isFinished.value = true;
    }
  } catch (error) {
    console.error('❌ Fetch history error:', error);

    listHistory.value = normalizeHistory(await getCacheDb(cacheKey.value));
    isFinished.value = true;

    if (listHistory.value.length > 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'Koneksi Bermasalah',
        text: 'Menampilkan cache riwayat terakhir dari SQLite.',
        timer: 1500,
        showConfirmButton: false
      });
    } else {
      await Swal.fire('Error', 'Gagal memuat riwayat penjualan', 'error');
    }
  } finally {
    loading.value = false;
  }
};

// =========================
// GROUPING PREMIUM
// =========================
const groupedHistoryByMonth = computed(() => {
  const monthMap = {};

  const sortedRows = [...listHistory.value].sort((a, b) => {
    const dateA = parseDateSafe(a.Tanggal)?.getTime() || 0;
    const dateB = parseDateSafe(b.Tanggal)?.getTime() || 0;
    return dateB - dateA;
  });

  sortedRows.forEach((item) => {
    const monthKey = getMonthKey(item.Tanggal);
    const dateKey = getDateKey(item.Tanggal);

    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {
        monthKey,
        monthLabel: formatMonthYear(monthKey),
        totalItems: 0,
        totalOmset: 0,
        dateMap: {}
      };
    }

    if (!monthMap[monthKey].dateMap[dateKey]) {
      monthMap[monthKey].dateMap[dateKey] = [];
    }

    monthMap[monthKey].dateMap[dateKey].push(item);
    monthMap[monthKey].totalItems += 1;
    monthMap[monthKey].totalOmset += Number(item.TotalPenjualan || 0);
  });

  return Object.values(monthMap)
    .sort((a, b) => {
      if (a.monthKey === 'Tanpa Bulan') return 1;
      if (b.monthKey === 'Tanpa Bulan') return -1;
      return b.monthKey.localeCompare(a.monthKey);
    })
    .map((monthGroup) => {
      const dates = Object.keys(monthGroup.dateMap)
        .sort((a, b) => {
          if (a === 'Tanpa Tanggal') return 1;
          if (b === 'Tanpa Tanggal') return -1;
          return b.localeCompare(a);
        })
        .map((dateKey) => ({
          dateKey,
          items: [...monthGroup.dateMap[dateKey]].sort((a, b) => {
            const dateA = parseDateSafe(a.Tanggal)?.getTime() || 0;
            const dateB = parseDateSafe(b.Tanggal)?.getTime() || 0;
            return dateB - dateA;
          })
        }));

      return {
        monthKey: monthGroup.monthKey,
        monthLabel: monthGroup.monthLabel,
        totalItems: monthGroup.totalItems,
        totalOmset: monthGroup.totalOmset,
        dates
      };
    });
});

// =========================
// LOAD MORE
// =========================
const loadMore = () => {
  if (!isFinished.value && !loading.value && !isOffline.value) {
    page.value++;
    fetchHistory(true);
  }
};

// =========================
// COMPUTED TOTAL
// =========================
const totalOmset = computed(() => {
  return listHistory.value.reduce(
    (acc, curr) => acc + Number(curr.TotalPenjualan || 0),
    0
  );
});

// =========================
// FORMATTERS
// =========================
const formatNumber = (num) =>
  new Intl.NumberFormat('id-ID').format(Number(num) || 0);

const formatTime = (dateTime) => {
  if (!dateTime) return '--:--';
  const str = String(dateTime);
  const timePart = str.includes(' ') ? str.split(' ')[1] : str.split('T')[1];
  return timePart?.substring(0, 5) || '--:--';
};

const formatHeaderDate = (dateStr) => {
  if (dateStr === 'Tanpa Tanggal') return dateStr;

  try {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(parseLocalDateInput(dateStr));
  } catch (e) {
    return dateStr;
  }
};

// =========================
// NAVIGATION
// =========================
const viewDetail = (item) => {
  const cleanNota = String(item.Nota || '').trim();

  router.push({
    name: 'DetailPenjualan',
    query: {
      nota: cleanNota,
      kode_customer: item.KodeCustomer,
      nama_toko: item.NamaCustomer,
      status_order: item.StatusOrder,
      status_label: item.StatusOrderLabel
    }
  });
};

// =========================
// WATCHERS
// =========================
watch(
  () => connectivity.isOnline,
  async (online) => {
    if (online && customerCode.value) {
      await fetchHistory(false);
    }
  }
);

// =========================
// INIT
// =========================
onMounted(() => {
  fetchHistory(false);
});
</script>

<style scoped>
.history-container {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(99, 102, 241, 0.12), transparent 32%),
    radial-gradient(circle at top right, rgba(16, 185, 129, 0.10), transparent 26%),
    linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  padding-bottom: 150px;
}

/* Header */
.header-modern {
  position: sticky;
  top: 0;
  z-index: 120;
  padding: 20px 18px 18px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

.header-glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at left top, rgba(99, 102, 241, 0.16), transparent 28%),
    radial-gradient(circle at right top, rgba(16, 185, 129, 0.12), transparent 22%);
  pointer-events: none;
}

.header-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  z-index: 2;
}

.btn-blur-back {
  width: 44px;
  height: 44px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: rgba(255, 255, 255, 0.88);
  color: #0f172a;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.65rem;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.btn-blur-back:active {
  transform: scale(0.96);
}

.header-title span {
  display: block;
  font-size: 0.72rem;
  text-transform: uppercase;
  color: #6366f1;
  font-weight: 800;
  letter-spacing: 1.4px;
  margin-bottom: 2px;
}

.header-title h3 {
  margin: 0;
  font-size: 1.32rem;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: -0.35px;
}

.header-stats {
  position: relative;
  z-index: 2;
  margin-top: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-chip {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 18px;
  padding: 12px 14px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
}

.stat-chip small {
  display: block;
  font-size: 0.68rem;
  text-transform: uppercase;
  font-weight: 800;
  color: #64748b;
  margin-bottom: 6px;
}

.stat-chip strong {
  display: block;
  font-size: 1rem;
  font-weight: 900;
  color: #0f172a;
  line-height: 1.2;
}

.stat-chip.success strong {
  color: #059669;
}

/* States */
.loading-state,
.empty-state {
  text-align: center;
  padding: 110px 28px;
  color: #64748b;
}

.empty-orb {
  width: 84px;
  height: 84px;
  margin: 0 auto 18px;
  display: grid;
  place-items: center;
  font-size: 2.2rem;
  border-radius: 24px;
  background: linear-gradient(135deg, #ffffff, #eef2ff);
  box-shadow: 0 20px 50px rgba(99, 102, 241, 0.12);
}

.empty-state h4 {
  margin: 0 0 6px;
  color: #0f172a;
  font-size: 1.1rem;
  font-weight: 900;
}

.empty-state p {
  margin: 0;
  font-size: 0.92rem;
}

.spinner {
  width: 42px;
  height: 42px;
  border: 4px solid #dbeafe;
  border-top: 4px solid #6366f1;
  border-radius: 50%;
  margin: 0 auto 18px;
  animation: spin 1s linear infinite;
}

/* Body */
.timeline-body {
  padding: 18px 18px 0;
}

.month-section {
  margin-top: 18px;
}

.month-header-sticky {
  position: sticky;
  top: 138px;
  z-index: 70;
  margin-bottom: 16px;
}

.month-header-card {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.95));
  color: white;
  border-radius: 24px;
  padding: 16px 18px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.20);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
}

.month-header-left small {
  display: block;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.68rem;
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 1.1px;
  margin-bottom: 4px;
}

.month-header-left h4 {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 900;
  text-transform: capitalize;
  letter-spacing: -0.25px;
}

.month-header-right {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.mini-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  background: rgba(255, 255, 255, 0.10);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.10);
  backdrop-filter: blur(8px);
}

.mini-badge.success {
  background: rgba(16, 185, 129, 0.14);
  color: #86efac;
  border-color: rgba(134, 239, 172, 0.14);
}

.date-section {
  margin-top: 18px;
  position: relative;
}

.date-badge-sticky {
  position: sticky;
  top: 228px;
  z-index: 60;
  margin-bottom: 14px;
}

.badge-content {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(226, 232, 240, 0.85);
  border-radius: 999px;
  padding: 10px 14px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.07);
}

.badge-date-main {
  font-size: 0.77rem;
  font-weight: 800;
  color: #334155;
}

.nota-count {
  background: linear-gradient(135deg, #6366f1, #4338ca);
  color: white;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 800;
}

/* Cards */
.cards-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-left: 22px;
  border-left: 2px dashed rgba(99, 102, 241, 0.22);
  margin-left: 10px;
}

.card-nota {
  position: relative;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 24px;
  padding: 16px;
  box-shadow:
    0 10px 30px rgba(15, 23, 42, 0.05),
    0 2px 8px rgba(15, 23, 42, 0.03);
  transition: all 0.22s ease;
}

.card-nota:active {
  transform: scale(0.98);
}

.timeline-dot {
  position: absolute;
  left: -29px;
  top: 28px;
  width: 14px;
  height: 14px;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border: 4px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
}

.nota-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.nota-badge-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.nota-id {
  font-weight: 900;
  color: #4338ca;
  font-size: 0.72rem;
  background: #eef2ff;
  padding: 5px 10px;
  border-radius: 10px;
  letter-spacing: 0.2px;
}

.time-pill {
  color: #475569;
  font-size: 0.7rem;
  font-weight: 800;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 5px 10px;
  border-radius: 10px;
}

.verify-pill {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 900;
  line-height: 1;
  border: 1px solid transparent;
  text-transform: uppercase;
  letter-spacing: 0.25px;
}

.verify-pending {
  color: #92400e;
  background: #fffbeb;
  border-color: #fde68a;
}

.verify-accepted {
  color: #047857;
  background: #ecfdf5;
  border-color: #a7f3d0;
}

.verify-rejected {
  color: #be123c;
  background: #fff1f2;
  border-color: #fecdd3;
}

.verify-skipped {
  color: #475569;
  background: #f8fafc;
  border-color: #e2e8f0;
}

.delivery-pill {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 900;
  line-height: 1;
  border: 1px solid transparent;
  text-transform: uppercase;
  letter-spacing: 0.25px;
}

.delivery-received {
  color: #047857;
  background: #ecfdf5;
  border-color: #a7f3d0;
}

.delivery-partial {
  color: #92400e;
  background: #fffbeb;
  border-color: #fde68a;
}

.delivery-pending {
  color: #475569;
  background: #f8fafc;
  border-color: #e2e8f0;
}

.arrow-wrap {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #f8fafc, #eef2ff);
  color: #475569;
  font-size: 1.2rem;
  font-weight: 900;
}

.nota-body {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 14px;
}

.customer-info {
  min-width: 0;
}

.customer-info h4 {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 900;
  color: #0f172a;
  text-transform: uppercase;
  line-height: 1.25;
}

.customer-code {
  font-size: 0.76rem;
  color: #64748b;
  margin-top: 4px;
  font-weight: 700;
}

.total-info {
  margin-top: 8px;
  flex-shrink: 0;
}

.total-label {
  display: block;
  font-size: 0.62rem;
  color: #94a3b8;
  text-transform: uppercase;
  font-weight: 800;
  margin-bottom: 4px;
}

.total-amount {
  font-weight: 900;
  font-size: 1.08rem;
  color: #059669;
  letter-spacing: -0.4px;
}

.card-bottom-accent {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 0;
  height: 4px;
  border-radius: 999px 999px 0 0;
  background: linear-gradient(90deg, #6366f1, #10b981);
  opacity: 0.14;
}

/* Pagination */
.pagination-trigger {
  padding: 34px 10px 10px;
  text-align: center;
}

.btn-load-more {
  min-width: 210px;
  background: linear-gradient(135deg, #ffffff, #eef2ff);
  border: 1.5px solid rgba(99, 102, 241, 0.28);
  color: #4338ca;
  padding: 13px 24px;
  border-radius: 16px;
  font-weight: 900;
  font-size: 0.86rem;
  box-shadow: 0 12px 28px rgba(99, 102, 241, 0.10);
}

.btn-load-more:disabled {
  opacity: 0.7;
}

.end-message {
  color: #64748b;
  font-size: 0.82rem;
  font-weight: 700;
}

/* Footer */
.summary-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #0f172a, #111827);
  color: white;
  padding: 20px 24px 34px;
  border-radius: 30px 30px 0 0;
  z-index: 120;
  box-shadow: 0 -16px 40px rgba(15, 23, 42, 0.24);
}

.summary-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-item small {
  display: block;
  color: #94a3b8;
  font-size: 0.66rem;
  text-transform: uppercase;
  margin-bottom: 4px;
  font-weight: 800;
}

.summary-item strong {
  font-size: 1.08rem;
  font-weight: 900;
}

.summary-divider {
  width: 1px;
  height: 36px;
  background: rgba(255, 255, 255, 0.10);
}

.text-success {
  color: #4ade80 !important;
}

.text-right {
  text-align: right;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>

<template>
  <main class="sales-ui sales-document-page sales-v2">
    <SalesPageHeader title="Riwayat Order" :subtitle="route.query.nama_toko || route.query.nama || customerCode" />
    <div class="sales-page-content">
      <p v-if="isOffline" class="sales-notice warning">Offline — menampilkan riwayat tersimpan.</p>
      <section class="sales-surface sales-summary-inline"><div><span>Nota dimuat</span><strong>{{ listHistory.length }}</strong></div><div><span>Nilai order yang tampil</span><strong>Rp {{ formatNumber(totalOmset) }}</strong></div></section>
      <label class="sales-form-label history-search">Cari order<input v-model="searchQuery" class="sales-input" type="search" placeholder="Nomor order / faktur / customer" /></label>
      <p v-if="loading && page === 1" class="sales-empty" role="status">Memuat riwayat order…</p>
      <p v-else-if="!visibleHistory.length" class="sales-empty">{{ searchQuery ? 'Tidak ada order yang cocok pada data yang dimuat.' : 'Belum ada riwayat order customer ini.' }}</p>
      <section v-else class="sales-records" aria-label="Daftar order">
        <button v-for="item in visibleHistory" :key="item.Nota" class="sales-record-card" @click="viewDetail(item)">
          <div class="sales-record-top"><div><strong>{{ item.Nota }}</strong><p class="sales-muted">{{ item.NamaCustomer }} · {{ item.KodeCustomer }}</p></div><font-awesome-icon icon="chevron-right" /></div>
          <div class="sales-record-meta"><span class="sales-pill info">Order: {{ item.StatusOrderLabel }}</span><span class="sales-pill">Barang: {{ item.StatusTerima }}</span></div>
          <div class="sales-record-footer"><span class="sales-muted">{{ formatHeaderDate(String(item.Tanggal || '').slice(0,10)) }} · {{ formatTime(item.Tanggal) }}</span><span class="sales-record-amount">Rp {{ formatNumber(item.TotalPenjualan) }}</span></div>
        </button>
      </section>
      <button v-if="!isFinished && listHistory.length" class="sales-button" :disabled="loading" @click="loadMore">{{ loading ? 'Memuat…' : 'Muat order lainnya' }}</button>
      <p v-else-if="listHistory.length" class="sales-muted">Semua data tersedia telah ditampilkan.</p>
    </div>
  </main></template>

<script setup>
import SalesPageHeader from '@/components/SalesPageHeader.vue';
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

const searchQuery = ref('');
const visibleHistory = computed(() => listHistory.value.filter(i => [i.Nota,i.NamaCustomer,i.KodeCustomer].join(' ').toLowerCase().includes(searchQuery.value.trim().toLowerCase())));
</script>

<template>
  <main class="sales-ui sales-document-page sales-v2">
    <SalesPageHeader title="Invoice" :subtitle="customerData.Nama" />
    <div class="sales-page-content">
      <p v-if="isOffline" class="sales-notice warning">Offline — menampilkan tagihan tersimpan.</p>
      <section class="sales-surface sales-summary-inline"><div><span>Nota pada LPH</span><strong>{{ rawData.length }}</strong></div><div><span>Sisa tagihan tampil</span><strong>Rp {{ formatNumber(totalPiutang) }}</strong></div></section>
      <label class="sales-form-label history-search">Cari invoice<input v-model="searchQuery" class="sales-input" type="search" placeholder="Nomor faktur / principal" /></label>
      <p v-if="loading" class="sales-empty" role="status">Memuat invoice…</p>
      <p v-else-if="!visibleInvoices.length" class="sales-empty">{{ searchQuery ? 'Tidak ada invoice yang cocok.' : 'Belum ada invoice pada LPH yang dapat ditampilkan.' }}</p>
      <section v-else class="sales-records" aria-label="Daftar invoice">
        <button v-for="nota in visibleInvoices" :key="nota.Nota" class="sales-record-card" @click="lihatDetail(nota.Nota)">
          <div class="sales-record-top"><strong>{{ nota.Nota }}</strong><font-awesome-icon icon="chevron-right" /></div>
          <div class="sales-record-meta"><span class="sales-pill info">{{ nota.NamaPrinciple || 'Principal' }}</span><span v-if="isOverdue(nota.JatuhTempo)" class="sales-pill danger">Lewat jatuh tempo</span></div>
          <div class="sales-record-footer"><span class="sales-muted">Jatuh tempo {{ formatDate(nota.JatuhTempo) }}</span><span class="sales-record-amount">Rp {{ formatNumber(nota.Piutang) }}</span></div>
        </button>
      </section>
    </div>
  </main></template>

<script setup>
import SalesPageHeader from '@/components/SalesPageHeader.vue';
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

const searchQuery = ref('');
const visibleInvoices = computed(() => rawData.value.filter(i => [i.Nota,i.NamaPrinciple].join(' ').toLowerCase().includes(searchQuery.value.trim().toLowerCase())));
</script>

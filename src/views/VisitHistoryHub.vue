<template>
  <div class="history-hub-page">
    <header class="hub-header">
      <button @click="router.back()" class="back-btn" aria-label="Kembali" title="Kembali"><font-awesome-icon icon="chevron-left" /></button>
      <div>
        <p class="eyebrow">{{ visitLabel }}</p>
        <h1>Histori Outlet</h1>
        <p class="subtitle">{{ customerName }}</p>
      </div>
    </header>

    <section class="hero-card">
      <div>
        <span class="hero-label">Customer</span>
        <h2>{{ customerCode || '-' }}</h2>
        <p>{{ customerName }}</p>
      </div>
      <div class="hero-badge">4 Menu</div>
    </section>

    <section v-if="reasonLoading || latestReason || reasonHistory.length" class="reason-card">
      <div class="reason-head">
        <div>
          <small>Audit Kunjungan</small>
          <h3>Riwayat Alasan</h3>
        </div>
        <span class="reason-count">{{ reasonHistory.length }} catatan</span>
      </div>

      <div v-if="reasonLoading" class="reason-state">Memuat histori alasan...</div>

      <template v-else-if="latestReason">
        <div class="reason-latest">
          <span class="reason-badge">Terakhir</span>
          <strong>{{ latestReason.alasan }}</strong>
          <p>{{ formatDate(latestReason.updated_at || latestReason.created_at) }}</p>
        </div>

        <div v-if="reasonHistory.length > 1" class="reason-list">
          <div
            v-for="item in reasonHistory.slice(1, 4)"
            :key="item.id"
            class="reason-item"
          >
            <strong>{{ item.alasan }}</strong>
            <span>{{ formatDate(item.updated_at || item.created_at) }}</span>
          </div>
        </div>
      </template>
    </section>

    <section class="menu-grid">
      <button class="menu-card" @click="goTo('sales')">
        <div class="menu-icon blue">🧾</div>
        <strong>Riwayat Order</strong>
        <span>Semua penjualan customer</span>
      </button>

      <button class="menu-card" @click="goTo('retur')">
        <div class="menu-icon red">↩</div>
        <strong>Riwayat Retur</strong>
        <span>Barang rusak dan retur</span>
      </button>

      <button class="menu-card" @click="goTo('invoice')">
        <div class="menu-icon green">💳</div>
        <strong>Invoice</strong>
        <span>Tagihan dan detail nota</span>
      </button>

      <button class="menu-card" @click="goTo('payment')">
        <div class="menu-icon amber">💰</div>
        <strong>Histori Pembayaran</strong>
        <span>Pembayaran online dan offline</span>
      </button>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api/axios';

const route = useRoute();
const router = useRouter();

const customerCode = computed(() => String(route.query.kode_customer || route.query.kode || '').trim());
const customerName = computed(() => String(route.query.nama_toko || route.query.nama || 'Pelanggan').trim());
const plafonId = computed(() => String(route.query.id_plafon || route.query.IDPlafon || '').trim());
const visitLabel = computed(() =>
  String(route.query.visit_state || '').trim().toLowerCase() === 'selesai'
    ? 'Kunjungan Selesai'
    : 'Kunjungan Aktif'
);
const reasonLoading = ref(false);
const reasonHistory = ref([]);
const latestReason = computed(() => reasonHistory.value[0] || null);

const baseQuery = computed(() => ({
  kode_customer: customerCode.value,
  nama_toko: customerName.value,
  id_kunjungan: route.query.id_kunjungan || '',
  id_plafon: plafonId.value,
  visit_state: route.query.visit_state || '',
}));

const goTo = (type) => {
  if (type === 'sales') {
    router.push({ path: '/history-toko', query: baseQuery.value });
    return;
  }

  if (type === 'retur') {
    router.push({ path: '/pageretur-barang', query: baseQuery.value });
    return;
  }

  if (type === 'invoice') {
    router.push({ path: '/tagihan-customer', query: baseQuery.value });
    return;
  }

  router.push({ path: '/payment-history', query: baseQuery.value });
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const fetchReasonHistory = async () => {
  if (!customerCode.value && !baseQuery.value.id_kunjungan) {
    reasonHistory.value = [];
    return;
  }

  try {
    reasonLoading.value = true;
    const res = await api.get('/api/kunjungan/alasan-history', {
      params: {
        kode_customer: customerCode.value,
        id_kunjungan: baseQuery.value.id_kunjungan,
        id_plafon: plafonId.value,
        limit: 5,
      }
    });
    reasonHistory.value = Array.isArray(res.data?.items) ? res.data.items : [];
  } catch (err) {
    console.error('Gagal memuat histori alasan:', err);
    reasonHistory.value = [];
  } finally {
    reasonLoading.value = false;
  }
};

onMounted(fetchReasonHistory);

watch(
  () => [route.query.kode_customer, route.query.id_kunjungan, route.query.id_plafon],
  async () => {
    await fetchReasonHistory();
  }
);
</script>

<style scoped>
.history-hub-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  padding: 20px 16px 32px;
}

.hub-header {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.back-btn {
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 14px;
  background: #fff;
  color: #0f172a;
  font-size: 1.8rem;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.eyebrow {
  margin: 0 0 4px;
  color: #6366f1;
  font-size: 0.72rem;
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 1px;
}

.hub-header h1 {
  margin: 0;
  font-size: 1.35rem;
  color: #0f172a;
}

.subtitle {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.82rem;
}

.hero-card {
  background: linear-gradient(135deg, #0f172a, #1d4ed8);
  color: white;
  border-radius: 24px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 18px;
  box-shadow: 0 18px 40px rgba(29, 78, 216, 0.22);
}

.hero-label {
  display: block;
  font-size: 0.72rem;
  text-transform: uppercase;
  opacity: 0.75;
  margin-bottom: 6px;
  font-weight: 700;
}

.hero-card h2 {
  margin: 0;
  font-size: 1.15rem;
}

.hero-card p {
  margin: 6px 0 0;
  opacity: 0.82;
  font-size: 0.82rem;
}

.hero-badge {
  background: rgba(255, 255, 255, 0.14);
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 800;
}

.menu-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.reason-card {
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e2e8f0;
  border-radius: 22px;
  padding: 18px 16px;
  margin-bottom: 18px;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.05);
}

.reason-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.reason-head small {
  display: block;
  color: #6366f1;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.reason-head h3 {
  margin: 0;
  color: #0f172a;
  font-size: 1rem;
}

.reason-count {
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 0.72rem;
  font-weight: 800;
}

.reason-state {
  color: #64748b;
  font-size: 0.82rem;
}

.reason-latest {
  background: linear-gradient(135deg, #f8fafc, #eef2ff);
  border: 1px solid #dbeafe;
  border-radius: 18px;
  padding: 14px;
}

.reason-badge {
  display: inline-flex;
  margin-bottom: 8px;
  background: #dbeafe;
  color: #1d4ed8;
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 0.68rem;
  font-weight: 800;
}

.reason-latest strong {
  display: block;
  color: #0f172a;
  font-size: 0.95rem;
}

.reason-latest p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 0.76rem;
}

.reason-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.reason-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 12px;
}

.reason-item strong {
  color: #0f172a;
  font-size: 0.84rem;
}

.reason-item span {
  color: #64748b;
  font-size: 0.72rem;
  white-space: nowrap;
}

.menu-card {
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e2e8f0;
  border-radius: 22px;
  padding: 18px 16px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.05);
}

.menu-icon {
  width: 46px;
  height: 46px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  font-size: 1.25rem;
}

.menu-icon.blue { background: #dbeafe; }
.menu-icon.red { background: #fee2e2; }
.menu-icon.green { background: #dcfce7; }
.menu-icon.amber { background: #fef3c7; }

.menu-card strong {
  color: #0f172a;
  font-size: 0.95rem;
}

.menu-card span {
  color: #64748b;
  font-size: 0.76rem;
  line-height: 1.45;
}
</style>

<style>
html[data-theme='dark'] .history-hub-page,
body[data-theme='dark'] .history-hub-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.12), transparent 26%),
    linear-gradient(180deg, #020617 0%, #030712 100%) !important;
  color: #e5edf8 !important;
}

html[data-theme='dark'] .history-hub-page .back-btn,
body[data-theme='dark'] .history-hub-page .back-btn {
  background: #0f172a !important;
  border: 1px solid rgba(51, 65, 85, 0.92) !important;
  color: #e5edf8 !important;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.34) !important;
}

html[data-theme='dark'] .history-hub-page .hub-header h1,
body[data-theme='dark'] .history-hub-page .hub-header h1,
html[data-theme='dark'] .history-hub-page .reason-head h3,
body[data-theme='dark'] .history-hub-page .reason-head h3,
html[data-theme='dark'] .history-hub-page .reason-latest strong,
body[data-theme='dark'] .history-hub-page .reason-latest strong,
html[data-theme='dark'] .history-hub-page .reason-item strong,
body[data-theme='dark'] .history-hub-page .reason-item strong,
html[data-theme='dark'] .history-hub-page .menu-card strong,
body[data-theme='dark'] .history-hub-page .menu-card strong {
  color: #f8fafc !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

html[data-theme='dark'] .history-hub-page .subtitle,
body[data-theme='dark'] .history-hub-page .subtitle,
html[data-theme='dark'] .history-hub-page .reason-state,
body[data-theme='dark'] .history-hub-page .reason-state,
html[data-theme='dark'] .history-hub-page .reason-latest p,
body[data-theme='dark'] .history-hub-page .reason-latest p,
html[data-theme='dark'] .history-hub-page .reason-item span,
body[data-theme='dark'] .history-hub-page .reason-item span,
html[data-theme='dark'] .history-hub-page .menu-card span,
body[data-theme='dark'] .history-hub-page .menu-card span {
  color: #9fb0c7 !important;
  opacity: 1 !important;
}

html[data-theme='dark'] .history-hub-page .eyebrow,
body[data-theme='dark'] .history-hub-page .eyebrow,
html[data-theme='dark'] .history-hub-page .reason-head small,
body[data-theme='dark'] .history-hub-page .reason-head small {
  color: #93c5fd !important;
}

html[data-theme='dark'] .history-hub-page .hero-card,
body[data-theme='dark'] .history-hub-page .hero-card {
  background:
    radial-gradient(circle at top right, rgba(96, 165, 250, 0.16), transparent 30%),
    linear-gradient(135deg, #020617 0%, #0f1f3d 48%, #17315f 100%) !important;
  border: 1px solid rgba(96, 165, 250, 0.22) !important;
  box-shadow: 0 22px 48px rgba(0, 0, 0, 0.38) !important;
}

html[data-theme='dark'] .history-hub-page .hero-badge,
body[data-theme='dark'] .history-hub-page .hero-badge,
html[data-theme='dark'] .history-hub-page .reason-count,
body[data-theme='dark'] .history-hub-page .reason-count {
  background: rgba(30, 41, 59, 0.86) !important;
  border: 1px solid rgba(96, 165, 250, 0.22) !important;
  color: #bfdbfe !important;
}

html[data-theme='dark'] .history-hub-page .reason-card,
body[data-theme='dark'] .history-hub-page .reason-card,
html[data-theme='dark'] .history-hub-page .menu-card,
body[data-theme='dark'] .history-hub-page .menu-card {
  background: linear-gradient(180deg, #030712 0%, #0b1220 100%) !important;
  border: 1px solid rgba(51, 65, 85, 0.94) !important;
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.34) !important;
  color: #e5edf8 !important;
}

html[data-theme='dark'] .history-hub-page .reason-latest,
body[data-theme='dark'] .history-hub-page .reason-latest,
html[data-theme='dark'] .history-hub-page .reason-item,
body[data-theme='dark'] .history-hub-page .reason-item {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.78)) !important;
  border: 1px solid rgba(51, 65, 85, 0.96) !important;
  color: #e5edf8 !important;
}

html[data-theme='dark'] .history-hub-page .reason-badge,
body[data-theme='dark'] .history-hub-page .reason-badge {
  background: rgba(37, 99, 235, 0.22) !important;
  border: 1px solid rgba(96, 165, 250, 0.34) !important;
  color: #bfdbfe !important;
}

html[data-theme='dark'] .history-hub-page .menu-icon.blue,
body[data-theme='dark'] .history-hub-page .menu-icon.blue {
  background: rgba(37, 99, 235, 0.2) !important;
  color: #bfdbfe !important;
}

html[data-theme='dark'] .history-hub-page .menu-icon.red,
body[data-theme='dark'] .history-hub-page .menu-icon.red {
  background: rgba(127, 29, 29, 0.24) !important;
  color: #fca5a5 !important;
}

html[data-theme='dark'] .history-hub-page .menu-icon.green,
body[data-theme='dark'] .history-hub-page .menu-icon.green {
  background: rgba(6, 78, 59, 0.24) !important;
  color: #a7f3d0 !important;
}

html[data-theme='dark'] .history-hub-page .menu-icon.amber,
body[data-theme='dark'] .history-hub-page .menu-icon.amber {
  background: rgba(120, 53, 15, 0.24) !important;
  color: #fed7aa !important;
}
</style>

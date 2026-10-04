<template>
  <div class="payment-history-page">
    <header class="page-header">
      <button @click="router.back()" class="back-btn" aria-label="Kembali" title="Kembali"><font-awesome-icon icon="chevron-left" /></button>
      <div>
        <p class="eyebrow">Kunjungan Aktif</p>
        <h1>Histori Pembayaran</h1>
        <p class="subtitle">{{ customerName }}</p>
      </div>
    </header>

    <div v-if="isOffline" class="offline-banner">
      MODE OFFLINE AKTIF - menampilkan data lokal pembayaran
    </div>

    <section class="summary-card">
      <div>
        <span>Total Pembayaran</span>
        <h2>{{ rows.length }}</h2>
      </div>
      <div class="amount-box">
        <small>Nominal</small>
        <strong>Rp {{ formatNumber(totalNominal) }}</strong>
      </div>
    </section>

    <main class="content-area">
      <div v-if="loading" class="state-box">
        <div class="spinner"></div>
        <p>Memuat histori pembayaran...</p>
      </div>

      <div v-else-if="rows.length === 0" class="state-box">
        <p>Belum ada histori pembayaran untuk customer ini.</p>
      </div>

      <div v-else class="list-stack">
        <article v-for="item in rows" :key="item.key" class="payment-card">
          <div class="card-top">
            <div>
              <span class="status-pill" :class="item.source === 'offline' ? 'offline' : 'online'">
                {{ item.source === 'offline' ? 'OFFLINE' : 'ONLINE' }}
              </span>
              <h3>{{ item.nota || 'Tanpa Nota' }}</h3>
              <small class="order-caption">{{ item.payment_count }} pembayaran untuk order ini</small>
            </div>
            <strong>Rp {{ formatNumber(item.total_bayar) }}</strong>
          </div>

          <div class="card-grid">
            <div>
              <small>Metode</small>
              <p>{{ item.metode || '-' }}</p>
            </div>
            <div>
              <small>Status Order</small>
              <p>{{ item.status || '-' }}</p>
            </div>
            <div>
              <small>Sisa Tagihan</small>
              <p>Rp {{ formatNumber(item.sisa_tagihan) }}</p>
            </div>
            <div>
              <small>Tanggal</small>
              <p>{{ formatDate(item.created_at) }}</p>
            </div>
            <div>
              <small>Referensi</small>
              <p>{{ item.no_bukti || '-' }}</p>
            </div>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useConnectivityStore } from '@/stores/connectivity';
import { getDb } from '@/services/database';
import api from '@/api/axios';
import { getPayloadArray } from '@/services/visitService';

const route = useRoute();
const router = useRouter();
const connectivity = useConnectivityStore();

const loading = ref(true);
const rows = ref([]);

const customerCode = computed(() => String(route.query.kode_customer || '').trim());
const customerName = computed(() => String(route.query.nama_toko || 'Pelanggan').trim());
const visitId = computed(() => String(route.query.id_kunjungan || route.query.id || '').trim());
const plafonId = computed(() => String(route.query.id_plafon || '').trim());
const isOffline = computed(() => !connectivity.isOnline);

const totalNominal = computed(() =>
  rows.value.reduce((sum, item) => sum + Number(item.total_bayar || 0), 0)
);

const formatNumber = (value) => new Intl.NumberFormat('id-ID').format(Number(value) || 0);

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

const normalizeRow = (item = {}, index = 0) => ({
  key: `${item.id_sales_order || item.payment_id || item.id || item.nota || 'payment'}-${index}`,
  id_sales_order: item.id_sales_order || item.IdSalesOrder || null,
  nota: item.nota || item.Nota || item.no_faktur || item.no_order || '',
  total_bayar: Number(item.total_bayar || item.TotalBayar || item.jumlah_setoran || 0),
  total_tagihan: Number(item.total_tagihan || item.TotalTagihan || 0),
  sisa_tagihan: Number(item.sisa_tagihan || item.SisaTagihan || item.Piutang || 0),
  metode: item.metode || item.Metode || item.tipe_setoran || '',
  no_bukti: item.no_bukti || item.NoBukti || '',
  status: item.status || item.status_pembayaran || item.Status || 'Tersimpan',
  created_at: item.created_at || item.CreatedAt || item.Tanggal || '',
  source: item.source || 'online',
  payment_count: Number(item.payment_count || 1),
});

const fetchLocalPayments = async () => {
  const db = getDb();
  if (!db || !customerCode.value) {
    return [];
  }

  const localPayments = await db.query(
    `
    SELECT
      payment_id,
      nota,
      total_bayar,
      metode,
      no_bukti,
      status_pembayaran,
      status_sync,
      created_at
    FROM payment_offline
    WHERE kode_customer = ?
    ORDER BY created_at DESC
    `,
    [customerCode.value]
  );

  return (localPayments.values || []).map((item, index) => normalizeRow({
    nota: item.nota,
    total_bayar: item.total_bayar,
    metode: item.metode,
    no_bukti: item.no_bukti,
    status: item.status_sync === 'pending' ? 'Pending Upload' : (item.status_pembayaran || 'Tersimpan'),
    created_at: item.created_at,
    source: 'offline',
    payment_id: item.payment_id,
  }, index));
};

const fetchOnlinePayments = async () => {
  if (!customerCode.value) return [];
  const res = await api.get('/api/payment/history', {
    params: {
      kode_customer: customerCode.value,
      id_kunjungan: visitId.value,
      id_plafon: plafonId.value,
    }
  });
  return getPayloadArray(res.data).map((item, index) => normalizeRow({
    ...item,
    source: 'online',
    status: item.status || 'Tersimpan',
  }, index));
};

const mergeRows = (onlineRows = [], localRows = []) => {
  const merged = [];
  const seen = new Set();

  [...onlineRows, ...localRows].forEach((item) => {
    const key = `${item.nota}|${item.total_bayar}|${item.created_at}|${item.source}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });

  merged.sort((a, b) => {
    const da = new Date(String(a.created_at || '').replace(' ', 'T')).getTime() || 0;
    const db = new Date(String(b.created_at || '').replace(' ', 'T')).getTime() || 0;
    return db - da;
  });

  rows.value = groupRowsByOrder(merged);
};

const groupRowsByOrder = (items = []) => {
  const groups = new Map();

  items.forEach((item) => {
    const key = item.id_sales_order ? `order:${item.id_sales_order}` : `nota:${item.nota || item.key}`;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        ...item,
        key,
        metode_set: new Set([item.metode].filter(Boolean)),
        no_bukti_set: new Set([item.no_bukti].filter(Boolean)),
        payment_count: item.payment_count || 1,
      });
      return;
    }

    current.total_bayar += Number(item.total_bayar || 0);
    current.payment_count += 1;
    current.sisa_tagihan = Number(item.sisa_tagihan ?? current.sisa_tagihan ?? 0);
    current.total_tagihan = Number(item.total_tagihan || current.total_tagihan || 0);
    current.status = item.status || current.status;
    if (item.metode) current.metode_set.add(item.metode);
    if (item.no_bukti) current.no_bukti_set.add(item.no_bukti);

    const currentTime = new Date(String(current.created_at || '').replace(' ', 'T')).getTime() || 0;
    const itemTime = new Date(String(item.created_at || '').replace(' ', 'T')).getTime() || 0;
    if (itemTime > currentTime) {
      current.created_at = item.created_at;
    }
  });

  return Array.from(groups.values())
    .map((item) => ({
      ...item,
      metode: Array.from(item.metode_set || []).join(', ') || item.metode,
      no_bukti: Array.from(item.no_bukti_set || []).join(', ') || item.no_bukti,
    }))
    .sort((a, b) => {
      const da = new Date(String(a.created_at || '').replace(' ', 'T')).getTime() || 0;
      const db = new Date(String(b.created_at || '').replace(' ', 'T')).getTime() || 0;
      return db - da;
    });
};

onMounted(async () => {
  try {
    loading.value = true;
    const localRows = await fetchLocalPayments();
    if (isOffline.value) {
      rows.value = groupRowsByOrder(localRows);
      return;
    }
    const onlineRows = await fetchOnlinePayments();
    mergeRows(onlineRows, localRows);
  } catch (error) {
    console.error('Gagal memuat histori pembayaran:', error);
    rows.value = groupRowsByOrder(await fetchLocalPayments());
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.payment-history-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
  padding: 20px 16px 28px;
}

.page-header {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 16px;
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
  color: #0f766e;
  font-size: 0.72rem;
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 1px;
}

.page-header h1 {
  margin: 0;
  font-size: 1.32rem;
  color: #0f172a;
}

.subtitle {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.82rem;
}

.offline-banner {
  background: linear-gradient(90deg, #f59e0b, #f97316);
  color: white;
  text-align: center;
  padding: 8px 12px;
  border-radius: 14px;
  font-size: 0.74rem;
  font-weight: 800;
  margin-bottom: 14px;
}

.summary-card {
  background: linear-gradient(135deg, #0f766e, #14b8a6);
  color: white;
  border-radius: 22px;
  padding: 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.summary-card span,
.amount-box small {
  display: block;
  opacity: 0.8;
  font-size: 0.74rem;
}

.summary-card h2,
.amount-box strong {
  margin: 6px 0 0;
}

.content-area {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.state-box {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 28px 20px;
  text-align: center;
  color: #64748b;
}

.spinner {
  width: 34px;
  height: 34px;
  border: 4px solid #d1fae5;
  border-top-color: #14b8a6;
  border-radius: 50%;
  margin: 0 auto 12px;
  animation: spin 0.8s linear infinite;
}

.list-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.payment-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 22px;
  padding: 16px;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.04);
}

.card-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.status-pill {
  display: inline-flex;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  margin-bottom: 8px;
}

.status-pill.online {
  background: #dcfce7;
  color: #166534;
}

.status-pill.offline {
  background: #fef3c7;
  color: #92400e;
}

.card-top h3 {
  margin: 0;
  color: #0f172a;
  font-size: 0.96rem;
}

.order-caption {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 700;
}

.card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.card-grid small {
  display: block;
  color: #94a3b8;
  font-size: 0.68rem;
  margin-bottom: 4px;
  text-transform: uppercase;
  font-weight: 700;
}

.card-grid p {
  margin: 0;
  color: #334155;
  font-size: 0.8rem;
  font-weight: 700;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

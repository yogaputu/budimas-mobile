<template>
  <div class="canvas-billing-page">
    <header class="billing-header">
      <button @click="router.back()" aria-label="Kembali" title="Kembali">
        <font-awesome-icon icon="chevron-left" />
      </button>
      <div>
        <p>Sales Canvas</p>
        <h3>Tagihan Customer</h3>
      </div>
      <button @click="refresh" :disabled="loading" aria-label="Refresh" title="Refresh">
        <font-awesome-icon icon="sync-alt" />
      </button>
    </header>

    <main class="billing-content">
      <section class="billing-summary">
        <div>
          <span>Customer Belum Lunas</span>
          <strong>{{ formatNumber(filteredCustomers.length) }}</strong>
        </div>
        <div>
          <span>Total Sisa Bayar</span>
          <strong>Rp {{ formatNumber(filteredTotalRemaining) }}</strong>
        </div>
      </section>

      <section class="search-card">
        <font-awesome-icon icon="search" />
        <input v-model.trim="search" placeholder="Cari customer atau kode..." type="search" />
      </section>

      <nav class="billing-tabs" aria-label="Mode tagihan canvas">
        <button type="button" :class="{ active: activeTab === 'tagihan' }" @click="activeTab = 'tagihan'">
          <font-awesome-icon icon="receipt" />
          <span>Tagihan</span>
        </button>
        <button type="button" :class="{ active: activeTab === 'riwayat' }" @click="activeTab = 'riwayat'">
          <font-awesome-icon icon="history" />
          <span>Riwayat</span>
        </button>
        <button type="button" :class="{ active: activeTab === 'rekap' }" @click="activeTab = 'rekap'">
          <font-awesome-icon icon="clipboard-check" />
          <span>Rekap</span>
        </button>
      </nav>

      <div v-if="loading && activeTab !== 'riwayat'" class="state-box">
        <div class="spinner"></div>
        <p>Memuat tagihan canvas...</p>
      </div>

      <div v-else-if="activeTab === 'tagihan' && filteredCustomers.length === 0" class="state-box">
        <font-awesome-icon icon="receipt" />
        <p>Tidak ada tagihan canvas yang belum lunas.</p>
      </div>

      <section v-else-if="activeTab === 'tagihan'" class="customer-list">
        <article v-for="customer in filteredCustomers" :key="customer.key" class="customer-card">
          <button type="button" class="customer-head" @click="toggleCustomer(customer.key)">
            <div>
              <strong>{{ customer.nama_customer || 'Customer Canvas' }}</strong>
              <span>{{ customer.kode_customer || 'Tanpa kode' }} · {{ customer.orders.length }} order</span>
            </div>
            <div class="customer-amount">
              <span>Sisa Bayar</span>
              <b>Rp {{ formatNumber(customer.sisa_tagihan) }}</b>
            </div>
          </button>

          <div v-if="expandedCustomer === customer.key" class="order-list">
            <button
              v-for="order in customer.orders"
              :key="order.id"
              type="button"
              class="order-row"
              @click="openPayment(order)"
            >
              <div>
                <strong>Order #{{ order.id }}</strong>
                <span>{{ order.tanggal_order || '-' }}</span>
              </div>
              <div>
                <span>Total Rp {{ formatNumber(order.total_order) }}</span>
                <b>Sisa Rp {{ formatNumber(order.sisa_tagihan) }}</b>
              </div>
            </button>
          </div>
        </article>
      </section>

      <section v-if="activeTab === 'rekap'" class="history-section">
        <div class="section-title-row">
          <div>
            <span>Rekap Penjualan</span>
            <strong>Rp {{ formatNumber(rekapSummary.total_order) }}</strong>
          </div>
          <button type="button" @click="refresh" :disabled="loading">
            <font-awesome-icon icon="sync-alt" />
          </button>
        </div>

        <div class="rekap-grid">
          <div>
            <span>Order</span>
            <strong>{{ formatNumber(rekapSummary.total_orders) }}</strong>
          </div>
          <div>
            <span>Klaim Pembayaran</span>
            <strong>Rp {{ formatNumber(rekapSummary.total_paid) }}</strong>
          </div>
          <div>
            <span>Sisa</span>
            <strong>Rp {{ formatNumber(rekapSummary.total_remaining) }}</strong>
          </div>
          <div>
            <span>Klaim Penuh</span>
            <strong>{{ formatNumber(rekapSummary.paid_orders) }}</strong>
          </div>
        </div>

        <div class="history-customer-list">
          <article v-for="order in filteredRekapOrders" :key="order.id" class="history-detail-row">
            <div>
              <strong>{{ order.nama_customer || 'Customer Canvas' }}</strong>
              <span>Order #{{ order.id }} · {{ formatDate(order.tanggal_order) }}</span>
            </div>
            <b>{{ orderStatusLabel(order) }} - Rp {{ formatNumber(order.total_order) }}</b>
          </article>
          <p v-if="!filteredRekapOrders.length" class="empty-history">Belum ada penjualan canvas pada filter ini.</p>
        </div>
      </section>

      <section v-if="activeTab === 'riwayat'" class="history-section">
        <div class="section-title-row">
          <div>
            <span>Riwayat Pembayaran</span>
            <strong>{{ formatNumber(filteredHistoryCustomers.length) }} customer</strong>
          </div>
          <button type="button" @click="fetchPaymentHistoryBySales" :disabled="historyLoading">
            <font-awesome-icon icon="sync-alt" />
          </button>
        </div>

        <div class="date-filter">
          <label>
            <span>Dari</span>
            <input v-model="dateFrom" type="date" @change="fetchPaymentHistoryBySales" />
          </label>
          <label>
            <span>Sampai</span>
            <input v-model="dateTo" type="date" @change="fetchPaymentHistoryBySales" />
          </label>
        </div>

        <div v-if="historyLoading" class="state-box compact">
          <div class="spinner"></div>
          <p>Memuat riwayat...</p>
        </div>

        <div v-else-if="filteredHistoryCustomers.length === 0" class="empty-history">
          Belum ada riwayat pembayaran pada filter ini.
        </div>

        <div v-else class="history-customer-list">
          <button
            v-for="customer in filteredHistoryCustomers"
            :key="customer.key"
            type="button"
            class="history-customer-card"
            @click="openHistoryDetail(customer)"
          >
            <div>
              <strong>{{ customer.nama_customer || 'Customer Canvas' }}</strong>
              <span>{{ customer.kode_customer || 'Tanpa kode' }} · {{ customer.payments.length }} pembayaran</span>
            </div>
            <b>Rp {{ formatNumber(customer.total_nominal) }}</b>
          </button>
        </div>
      </section>
    </main>

    <div v-if="paymentOpen" class="modal-backdrop" @click.self="closePayment">
      <section class="payment-sheet">
        <header>
          <div>
            <span>Bayar Tagihan</span>
            <h4>{{ selectedOrder?.nama_customer || 'Customer Canvas' }}</h4>
          </div>
          <button @click="closePayment" aria-label="Tutup" title="Tutup">
            <font-awesome-icon icon="times" />
          </button>
        </header>

        <div class="payment-summary">
          <div>
            <span>Total Tagihan</span>
            <strong>Rp {{ formatNumber(selectedOrder?.total_order) }}</strong>
          </div>
          <div>
            <span>Klaim Pembayaran</span>
            <strong>Rp {{ formatNumber(selectedOrder?.total_dibayarkan) }}</strong>
          </div>
          <div>
            <span>Sisa Bayar</span>
            <strong>Rp {{ formatNumber(selectedOrderRemaining) }}</strong>
          </div>
        </div>

        <label>Jumlah Bayar</label>
        <div class="payment-input-row">
          <input v-model.number="paymentAmount" type="number" min="0" inputmode="numeric" placeholder="Masukkan nominal pembayaran" />
          <button type="button" :disabled="selectedOrderRemaining <= 0" @click="fillFullPayment">
            Isi Sisa Tagihan
          </button>
        </div>
        <label>Metode Pembayaran</label>
        <select v-model="paymentMethod" class="payment-method-select">
          <option value="tunai">Tunai</option>
          <option value="non_tunai">Non Tunai / Transfer</option>
        </select>
        <small class="payment-note">Pembayaran dapat sebagian atau lunas. Data disimpan sebagai pengakuan sales dan menunggu Rekap, Setoran, serta finalisasi Finance.</small>

        <div v-if="paymentHistory.length" class="payment-history">
          <span>Riwayat Pembayaran</span>
          <p v-for="payment in paymentHistory" :key="payment.id || payment.id_setoran || payment.tanggal_input">
            Rp {{ formatNumber(payment.jumlah_setoran || payment.nominal || payment.jumlah_dibayarkan) }}
          </p>
        </div>

        <button class="submit-payment" :disabled="submitting || !canSubmitPayment" @click="submitPayment">
          <font-awesome-icon :icon="submitting ? 'sync-alt' : 'floppy-disk'" />
          <span>{{ submitting ? 'Menyimpan...' : 'Simpan Pembayaran' }}</span>
        </button>
      </section>
    </div>

    <div v-if="historyDetailOpen" class="modal-backdrop" @click.self="closeHistoryDetail">
      <section class="payment-sheet">
        <header>
          <div>
            <span>Detail Pembayaran</span>
            <h4>{{ selectedHistoryCustomer?.nama_customer || 'Customer Canvas' }}</h4>
          </div>
          <button @click="closeHistoryDetail" aria-label="Tutup" title="Tutup">
            <font-awesome-icon icon="times" />
          </button>
        </header>

        <div class="payment-summary">
          <div>
            <span>Total Pembayaran</span>
            <strong>Rp {{ formatNumber(selectedHistoryCustomer?.total_nominal) }}</strong>
          </div>
          <div>
            <span>Jumlah Transaksi</span>
            <strong>{{ formatNumber(selectedHistoryCustomer?.payments?.length) }}</strong>
          </div>
        </div>

        <div class="history-detail-list">
          <article v-for="payment in selectedHistoryCustomer?.payments || []" :key="payment.id" class="history-detail-row">
            <div>
              <strong>Rp {{ formatNumber(payment.nominal) }}</strong>
              <span>Order #{{ payment.id_canvas_order }} · {{ formatDate(payment.tanggal_input) }}</span>
            </div>
            <b>{{ paymentStatusText(payment.status_setoran, payment.status_finance) }}</b>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Swal from 'sweetalert2';
import api from '@/api/axios';
import { useAuthStore } from '@/stores/auth';
import { getPayloadArray, getPayloadObject } from '@/services/visitService';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const loading = ref(false);
const submitting = ref(false);
const historyLoading = ref(false);
const orders = ref([]);
const salesPaymentHistory = ref([]);
const search = ref('');
const activeTab = ref(['tagihan', 'riwayat', 'rekap'].includes(String(route.query.tab || '')) ? String(route.query.tab) : 'tagihan');
const dateFrom = ref('');
const dateTo = ref('');
const expandedCustomer = ref('');
const paymentOpen = ref(false);
const historyDetailOpen = ref(false);
const selectedOrder = ref(null);
const selectedHistoryCustomer = ref(null);
const paymentAmount = ref(0);
const paymentMethod = ref('tunai');
const paymentHistory = ref([]);
const paymentAttempt = ref({ signature: '', id: '' });

const userParams = computed(() => ({
  id_user: auth.user?.id_user || auth.user?.id || '',
  id_sales: auth.user?.id_sales || ''
}));

const getCanvasArray = (payload) => {
  const direct = getPayloadArray(payload);
  if (direct.length) return direct;
  if (Array.isArray(payload?.pages)) return payload.pages;
  if (Array.isArray(payload?.result?.pages)) return payload.result.pages;
  return [];
};

const getCanvasObject = (payload) => {
  const rows = getCanvasArray(payload);
  if (rows.length) return rows[0];
  return getPayloadObject(payload) || payload;
};

const assertCanvasSuccess = (payload) => {
  const data = getCanvasObject(payload);
  if (String(data?.status || '').toLowerCase() === 'error') {
    throw new Error(data?.message || 'Proses tagihan canvas ditolak server.');
  }
  return data;
};

const normalizeOrder = (order) => {
  const total = Number(order.total_order || order.total_tagihan || 0);
  const paid = Number(order.total_dibayarkan || order.jumlah_setoran || 0);
  const remaining = Number(order.sisa_tagihan ?? order.sisa_pembayaran ?? Math.max(total - paid, 0));
  return {
    ...order,
    id: Number(order.id || order.id_canvas_order || 0),
    nama_customer: String(order.nama_customer || 'Customer Canvas').trim(),
    kode_customer: String(order.kode_customer || '').trim(),
    total_order: total,
    total_dibayarkan: paid,
    sisa_tagihan: Math.max(remaining, 0)
  };
};

const payableOrders = computed(() => orders.value
  .map(normalizeOrder)
  .filter((order) => order.id && order.sisa_tagihan > 0));

const groupedCustomers = computed(() => {
  const groups = new Map();
  payableOrders.value.forEach((order) => {
    const key = order.kode_customer || order.nama_customer.toLowerCase() || `order-${order.id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        nama_customer: order.nama_customer,
        kode_customer: order.kode_customer,
        total_order: 0,
        total_dibayarkan: 0,
        sisa_tagihan: 0,
        orders: []
      });
    }
    const group = groups.get(key);
    group.total_order += order.total_order;
    group.total_dibayarkan += order.total_dibayarkan;
    group.sisa_tagihan += order.sisa_tagihan;
    group.orders.push(order);
  });
  return Array.from(groups.values()).sort((a, b) => b.sisa_tagihan - a.sisa_tagihan);
});

const filteredCustomers = computed(() => {
  const keyword = search.value.toLowerCase();
  if (!keyword) return groupedCustomers.value;
  return groupedCustomers.value.filter((customer) => (
    customer.nama_customer.toLowerCase().includes(keyword)
    || customer.kode_customer.toLowerCase().includes(keyword)
    || customer.orders.some((order) => String(order.id).includes(keyword))
  ));
});

const filteredTotalRemaining = computed(() => filteredCustomers.value.reduce((sum, customer) => (
  sum + Number(customer.sisa_tagihan || 0)
), 0));

const normalizedOrders = computed(() => orders.value.map(normalizeOrder).filter((order) => order.id));

const filteredRekapOrders = computed(() => {
  const keyword = search.value.toLowerCase();
  if (!keyword) return normalizedOrders.value;
  return normalizedOrders.value.filter((order) => (
    order.nama_customer.toLowerCase().includes(keyword)
    || order.kode_customer.toLowerCase().includes(keyword)
    || String(order.id).includes(keyword)
  ));
});

const rekapSummary = computed(() => filteredRekapOrders.value.reduce((summary, order) => {
  summary.total_orders += 1;
  summary.total_order += Number(order.total_order || 0);
  summary.total_paid += Number(order.total_dibayarkan || 0);
  summary.total_remaining += Number(order.sisa_tagihan || 0);
  if (Number(order.sisa_tagihan || 0) <= 0) summary.paid_orders += 1;
  return summary;
}, {
  total_orders: 0,
  paid_orders: 0,
  total_order: 0,
  total_paid: 0,
  total_remaining: 0
}));

const normalizedPaymentHistory = computed(() => salesPaymentHistory.value.map((payment) => ({
  ...payment,
  id: Number(payment.id || payment.id_setoran_customer || 0),
  id_canvas_order: Number(payment.id_canvas_order || 0),
  nama_customer: String(payment.nama_customer || 'Customer Canvas').trim(),
  kode_customer: String(payment.kode_customer || '').trim(),
  nominal: Number(payment.nominal || payment.jumlah_setoran || payment.jumlah_dibayarkan || 0),
  tanggal_input: payment.tanggal_input || '',
  status_setoran: payment.status_setoran || []
})).filter((payment) => payment.id && payment.nominal > 0));

const historyCustomers = computed(() => {
  const groups = new Map();
  normalizedPaymentHistory.value.forEach((payment) => {
    const key = payment.kode_customer || payment.nama_customer.toLowerCase() || `payment-${payment.id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        nama_customer: payment.nama_customer,
        kode_customer: payment.kode_customer,
        total_nominal: 0,
        payments: []
      });
    }
    const group = groups.get(key);
    group.total_nominal += payment.nominal;
    group.payments.push(payment);
  });
  return Array.from(groups.values()).sort((a, b) => b.total_nominal - a.total_nominal);
});

const filteredHistoryCustomers = computed(() => {
  const keyword = search.value.toLowerCase();
  if (!keyword) return historyCustomers.value;
  return historyCustomers.value.filter((customer) => (
    customer.nama_customer.toLowerCase().includes(keyword)
    || customer.kode_customer.toLowerCase().includes(keyword)
    || customer.payments.some((payment) => String(payment.id_canvas_order).includes(keyword))
  ));
});

const selectedOrderRemaining = computed(() => Number(selectedOrder.value?.sisa_tagihan || 0));
const canSubmitPayment = computed(() => {
  const amount = Number(paymentAmount.value || 0);
  return Boolean(selectedOrder.value)
    && amount > 0
    && amount <= Number(selectedOrderRemaining.value || 0) + 0.005;
});

const formatNumber = (value) => new Intl.NumberFormat('id-ID').format(Number(value || 0));
const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

const paymentStatusText = (statusSetoran, statusFinance = '') => {
  if (statusFinance === 'MENUNGGU_REKAP') return 'Menunggu Piutang Canvas Finance';
  if (statusFinance === 'SUDAH_DIREKAP') return 'Diproses Piutang Canvas Finance';
  const statuses = Array.isArray(statusSetoran) ? statusSetoran.map(Number) : [Number(statusSetoran || 0)];
  if (statuses.includes(3)) return 'Audit';
  if (statuses.includes(2)) return 'Diterima';
  if (statuses.includes(1)) return 'Draft';
  return 'Tersimpan';
};

const orderStatusLabel = (order) => {
  if (Number(order?.sisa_tagihan || 0) <= 0) return 'Klaim penuh · Menunggu Piutang Canvas Finance';
  if (Number(order?.total_dibayarkan || 0) > 0) return 'Klaim sebagian · Menunggu Piutang Canvas Finance';
  return 'Belum Bayar';
};

const refresh = async () => {
  loading.value = true;
  try {
    const [orderResponse] = await Promise.all([
      api.get('/api/sales-canvas/all-canvas-order', { params: userParams.value }),
      fetchPaymentHistoryBySales()
    ]);
    orders.value = getCanvasArray(orderResponse.data);
  } catch (error) {
    console.error('Load tagihan canvas gagal:', error);
    orders.value = [];
    await Swal.fire('Gagal', error?.response?.data?.message || 'Gagal memuat tagihan canvas.', 'error');
  } finally {
    loading.value = false;
  }
};

const fetchPaymentHistoryBySales = async () => {
  historyLoading.value = true;
  try {
    const response = await api.get('/api/sales-canvas/riwayat-pembayaran', {
      params: {
        ...userParams.value,
        ...(dateFrom.value ? { tanggal_mulai: dateFrom.value } : {}),
        ...(dateTo.value ? { tanggal_selesai: dateTo.value } : {})
      }
    });
    salesPaymentHistory.value = getCanvasArray(response.data);
  } catch (error) {
    console.error('Load riwayat pembayaran canvas gagal:', error);
    salesPaymentHistory.value = [];
  } finally {
    historyLoading.value = false;
  }
};

const toggleCustomer = (key) => {
  expandedCustomer.value = expandedCustomer.value === key ? '' : key;
};

const fetchPaymentHistory = async () => {
  paymentHistory.value = [];
  if (!selectedOrder.value?.id) return;
  try {
    const response = await api.get('/api/sales-canvas/tagihan-pembayaran', {
      params: {
        ...userParams.value,
        id_canvas_order: selectedOrder.value.id
      }
    });
    paymentHistory.value = getCanvasArray(response.data);
  } catch (error) {
    console.error('Load pembayaran canvas gagal:', error);
  }
};

const openPayment = async (order) => {
  selectedOrder.value = order;
  paymentAttempt.value = { signature: '', id: '' };
  paymentMethod.value = 'tunai';
  fillFullPayment();
  paymentOpen.value = true;
  await fetchPaymentHistory();
};

const fillFullPayment = () => {
  paymentAmount.value = Math.max(Number(selectedOrderRemaining.value || 0), 0);
};

const closePayment = () => {
  paymentOpen.value = false;
  selectedOrder.value = null;
  paymentAmount.value = 0;
  paymentMethod.value = 'tunai';
  paymentHistory.value = [];
  paymentAttempt.value = { signature: '', id: '' };
};

const openHistoryDetail = (customer) => {
  selectedHistoryCustomer.value = customer;
  historyDetailOpen.value = true;
};

const closeHistoryDetail = () => {
  selectedHistoryCustomer.value = null;
  historyDetailOpen.value = false;
};

const submitPayment = async () => {
  if (!canSubmitPayment.value) {
    await Swal.fire('Peringatan', 'Nominal pembayaran harus lebih dari Rp 0 dan tidak boleh melebihi sisa tagihan.', 'warning');
    return;
  }

  submitting.value = true;
  try {
    const amount = Number(paymentAmount.value || 0);
    const signature = [selectedOrder.value.id, amount.toFixed(2), paymentMethod.value].join(':');
    if (paymentAttempt.value.signature !== signature) {
      const paymentId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
      paymentAttempt.value = { signature, id: paymentId };
    }
    const response = await api.post('/api/sales-canvas/submit-tagihan-pembayaran', {
      ...userParams.value,
      id_canvas_order: selectedOrder.value.id,
      jumlah_dibayarkan: amount,
      tipe_setoran: paymentMethod.value,
      payment_id: paymentAttempt.value.id
    });
    assertCanvasSuccess(response.data);
    paymentAttempt.value = { signature: '', id: '' };
    await Swal.fire({
      icon: 'success',
      title: 'Berhasil',
      text: 'Pembayaran Canvas disimpan sebagai claim dan menunggu proses Piutang Canvas Finance.',
      timer: 1300,
      showConfirmButton: false
    });
    closePayment();
    await refresh();
  } catch (error) {
    console.error('Submit pembayaran canvas gagal:', error);
    await Swal.fire('Gagal', error?.response?.data?.message || error.message || 'Gagal menyimpan pembayaran canvas.', 'error');
  } finally {
    submitting.value = false;
  }
};

onMounted(refresh);
</script>

<style scoped>
.canvas-billing-page {
  min-height: 100vh;
  background: var(--app-body-bg);
  color: var(--app-body-text);
  padding-bottom: 22px;
}
.billing-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--app-surface);
  color: var(--app-body-text);
  border-bottom: 1px solid var(--app-border);
}
.billing-header button,
.payment-sheet header button {
  border: none;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: var(--app-surface-muted);
  color: var(--app-body-text);
}
.billing-header button:last-child { margin-left: auto; }
.billing-header p,
.billing-summary span,
.search-card svg,
.customer-card span,
.customer-amount span,
.order-row span,
.payment-summary span,
.payment-history span,
.payment-sheet label {
  color: var(--app-text-muted);
}
.billing-header p {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  font-weight: 900;
}
.billing-header h3 {
  margin: 2px 0 0;
  font-size: 1rem;
}
.billing-content {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.billing-summary,
.search-card,
.customer-card,
.payment-sheet,
.payment-summary,
.payment-history {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 12px;
}
.billing-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 12px;
}
.billing-summary span,
.payment-summary span,
.payment-history span,
.payment-sheet label {
  display: block;
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
}
.billing-summary strong,
.customer-card strong,
.customer-amount b,
.order-row b,
.payment-summary strong,
.payment-history p {
  color: var(--app-body-text);
}
.billing-summary strong {
  display: block;
  margin-top: 4px;
}
.search-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
}
.billing-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  overflow: hidden;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 12px;
}
.billing-tabs button {
  min-height: 44px;
  border: none;
  border-right: 1px solid var(--app-border);
  background: transparent;
  color: var(--app-text-muted);
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}
.billing-tabs button:last-child {
  border-right: none;
}
.billing-tabs button.active {
  background: #ecfdf5;
  color: #0f766e;
  box-shadow: inset 0 0 0 1px rgba(15, 118, 110, 0.2);
}
.search-card input {
  border: none;
  outline: none;
  background: transparent;
  color: var(--app-body-text);
  width: 100%;
  font-size: 0.95rem;
}
.state-box {
  min-height: 220px;
  display: grid;
  place-items: center;
  text-align: center;
  color: var(--app-text-muted);
  gap: 10px;
}
.state-box.compact {
  min-height: 120px;
}
.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--app-border);
  border-top-color: #0f766e;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.customer-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.customer-card {
  overflow: hidden;
}
.customer-head,
.order-row {
  width: 100%;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
}
.customer-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
}
.customer-head strong,
.order-row strong {
  display: block;
}
.customer-head span,
.order-row span {
  display: block;
  margin-top: 4px;
  font-size: 0.76rem;
}
.customer-amount {
  text-align: right;
  flex-shrink: 0;
}
.order-list {
  border-top: 1px solid var(--app-border);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.order-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  background: var(--app-surface-soft);
}
.order-row div:last-child {
  text-align: right;
}
.history-section {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 12px;
}
.rekap-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 12px;
}
.rekap-grid div {
  background: var(--app-surface-soft);
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 10px;
}
.rekap-grid span {
  color: var(--app-text-muted);
  display: block;
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
}
.rekap-grid strong {
  display: block;
  margin-top: 4px;
  color: var(--app-body-text);
}
.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.section-title-row span,
.date-filter span,
.history-customer-card span,
.history-detail-row span {
  color: var(--app-text-muted);
}
.section-title-row span,
.date-filter span {
  display: block;
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
}
.section-title-row strong {
  display: block;
  margin-top: 4px;
  color: var(--app-body-text);
}
.section-title-row button {
  border: none;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--app-surface-muted);
  color: var(--app-body-text);
}
.date-filter {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
}
.date-filter input {
  margin-top: 5px;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 10px;
  background: var(--app-surface-soft);
  color: var(--app-body-text);
}
.empty-history {
  margin-top: 12px;
  padding: 16px;
  text-align: center;
  color: var(--app-text-muted);
  background: var(--app-surface-soft);
  border-radius: 10px;
}
.history-customer-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.history-customer-card,
.history-detail-row {
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-surface-soft);
  color: var(--app-body-text);
  padding: 10px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  text-align: left;
}
.history-customer-card {
  width: 100%;
}
.history-customer-card strong,
.history-detail-row strong {
  display: block;
  color: var(--app-body-text);
}
.history-customer-card span,
.history-detail-row span {
  display: block;
  margin-top: 3px;
  font-size: 0.76rem;
}
.history-customer-card b,
.history-detail-row b {
  flex-shrink: 0;
  color: #0f766e;
}
.history-detail-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(15,23,42,0.55);
  display: flex;
  align-items: flex-end;
}
.payment-sheet {
  width: 100%;
  max-height: 84vh;
  overflow: auto;
  border-radius: 18px 18px 0 0;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.payment-sheet header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--app-border);
}
.payment-sheet header span {
  color: var(--app-text-muted);
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
}
.payment-sheet header h4 {
  margin: 2px 0 0;
}
.payment-summary {
  display: grid;
  gap: 8px;
  padding: 10px;
  background: var(--app-surface-soft);
}
.payment-sheet input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 12px;
  font-size: 1rem;
  background: var(--app-surface-soft);
  color: var(--app-body-text);
}
.payment-input-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: stretch;
}
.payment-input-row button {
  border: none;
  border-radius: 10px;
  padding: 0 14px;
  background: #0f766e;
  color: #fff;
  font-weight: 900;
}
.payment-input-row button:disabled {
  background: #cbd5e1;
  color: #64748b;
}
.payment-method-select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 12px;
  font: inherit;
  background: var(--app-surface-soft);
  color: var(--app-body-text);
}
.payment-note {
  display: block;
  margin-top: -4px;
  color: var(--app-text-muted);
  font-size: 0.75rem;
}
.payment-history {
  padding: 10px;
  background: var(--app-surface-soft);
}
.payment-history p {
  margin: 6px 0 0;
  font-weight: 800;
}
.submit-payment {
  border: none;
  border-radius: 12px;
  padding: 13px 16px;
  background: #0f766e;
  color: #fff;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.submit-payment:disabled {
  background: #cbd5e1;
  color: #64748b;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>

<template>
  <div class="stok-page">
    <header class="stok-header">
      <div class="stok-header-top">
        <button @click="router.back()" class="btn-back" aria-label="Kembali" title="Kembali">
          <span><font-awesome-icon icon="chevron-left" /></span>
        </button>

        <div class="header-title">
          <span class="eyebrow">Budimas Mobile</span>
          <h3>Stok Opname</h3>
        </div>
      </div>

      <div class="customer-hero">
        <div class="hero-badge" :class="isDone ? 'done' : 'pending'">
          {{ isDone ? 'SUDAH OPNAME' : 'BELUM OPNAME' }}
        </div>

        <h2>{{ namaToko }}</h2>
        <p>{{ alamatToko }}</p>

        <div class="hero-meta">
          <div class="meta-item">
            <small>KODE CUSTOMER</small>
            <strong>{{ kodeCustomer || '-' }}</strong>
          </div>
          <div class="meta-divider"></div>
          <div class="meta-item">
            <small>ID KUNJUNGAN</small>
            <strong>{{ idKunjungan || '-' }}</strong>
          </div>
        </div>
      </div>
    </header>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Memuat data stok opname...</p>
    </div>

    <div v-else class="stok-content">
      <div class="status-card" :class="isDone ? 'status-done' : 'status-pending'">
        <div>
          <h4>{{ isDone ? 'Opname sudah dilakukan' : 'Opname belum dilakukan' }}</h4>
          <p>{{ message }}</p>
        </div>
      </div>

      <div v-if="isDone" class="summary-grid">
        <div class="summary-card">
          <small>Total Item</small>
          <strong>{{ summary.total_item }}</strong>
        </div>
        <div class="summary-card">
          <small>Sesuai</small>
          <strong>{{ summary.total_item_sesuai }}</strong>
        </div>
        <div class="summary-card">
          <small>Lebih</small>
          <strong>{{ summary.total_item_lebih }}</strong>
        </div>
        <div class="summary-card">
          <small>Kurang</small>
          <strong>{{ summary.total_item_kurang }}</strong>
        </div>
      </div>

      <div v-if="items.length === 0" class="empty-state">
        <div class="empty-icon"><font-awesome-icon icon="box-open" /></div>
        <h4>Belum ada item</h4>
        <p>Tambahkan item stok opname untuk customer ini.</p>
      </div>

      <div v-else class="items-wrap">
        <div
          v-for="(item, index) in items"
          :key="`${item.kode_barang || item.KodeStok || 'item'}-${index}`"
          class="item-card"
          :class="[
            item.status_selisih === 'sesuai'
              ? 'card-sesuai'
              : item.status_selisih === 'lebih'
                ? 'card-lebih'
                : item.status_selisih === 'kurang'
                  ? 'card-kurang'
                  : ''
          ]"
        >
          <div class="item-main">
            <div class="item-info">
              <div class="item-title-row">
                <h4>{{ item.nama_barang || item.NamaBarang || 'Barang Tanpa Nama' }}</h4>

                <span
                  v-if="isDone"
                  class="status-chip"
                  :class="[
                    item.status_selisih === 'sesuai'
                      ? 'chip-sesuai'
                      : item.status_selisih === 'lebih'
                        ? 'chip-lebih'
                        : item.status_selisih === 'kurang'
                          ? 'chip-kurang'
                          : 'chip-default'
                  ]"
                >
                  {{ formatStatusSelisih(item.status_selisih) }}
                </span>
              </div>

              <p>{{ item.kode_barang || item.KodeStok || '-' }}</p>

              <div v-if="isDone" class="item-meta">
                <span v-if="item.kategori">
                  <i class="fas fa-tags"></i> {{ item.kategori }}
                </span>
                <span v-if="item.satuan">
                  <i class="fas fa-box"></i> {{ item.satuan }}
                </span>
                <span v-if="item.tanggal_input">
                  <i class="far fa-calendar-alt"></i> {{ formatDate(item.tanggal_input) }}
                </span>
              </div>
            </div>

            <div class="item-input">
              <small>{{ isDone ? 'Qty Opname' : 'Input Qty' }}</small>

              <template v-if="isDone">
                <div class="qty-readonly">
                  {{ formatNumber(item.stok_opname) }}
                </div>
              </template>

              <template v-else>
                <input
                  v-model.number="item.Jumlah"
                  type="number"
                  min="0"
                  inputmode="numeric"
                  class="qty-box"
                  placeholder="0"
                />
              </template>
            </div>
          </div>

          <div v-if="isDone" class="item-stats">
            <div class="stat-box">
              <small>Stok Sistem</small>
              <strong>{{ formatNumber(item.stok_system) }}</strong>
            </div>

            <div class="stat-box">
              <small>Stok Opname</small>
              <strong>{{ formatNumber(item.stok_opname) }}</strong>
            </div>

            <div class="stat-box">
              <small>Selisih</small>
              <strong>{{ formatSignedNumber(item.selisih) }}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading && !isDone" class="footer-actions">
      <button class="btn-add" @click="addEmptyItem" aria-label="Tambah item" title="Tambah item"><font-awesome-icon icon="plus" /></button>

      <button class="btn-save" @click="submitOpname" :disabled="saving || !canSubmit">
        <font-awesome-icon :icon="saving ? 'sync-alt' : 'floppy-disk'" />
        <span>{{ saving ? 'Menyimpan...' : 'Simpan Stok Opname' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api/axios';
import Swal from 'sweetalert2';
import { parseLocalDateInput } from '@/utils/dateLocal';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const saving = ref(false);
const isDone = ref(false);
const message = ref('');
const items = ref([]);
const summary = ref({
  total_item: 0,
  total_item_sesuai: 0,
  total_item_lebih: 0,
  total_item_kurang: 0,
  total_stok_opname: 0,
  total_stok_system: 0,
  total_selisih: 0
});

const idKunjungan = computed(() =>
  String(route.query.id || route.query.id_kunjungan || '').trim()
);
const plafonId = computed(() =>
  String(route.query.id_plafon || route.query.IDPlafon || '').trim()
);
const kodeCustomer = computed(() => String(route.query.kode_customer || '').trim());
const namaToko = computed(() => String(route.query.nama_toko || 'Toko Tanpa Nama').trim());
const alamatToko = computed(() => String(route.query.alamat || 'Alamat tidak tersedia').trim());

const formatNumber = (value) => {
  const num = Number(value || 0);
  return Number.isInteger(num)
    ? num.toLocaleString('id-ID')
    : num.toLocaleString('id-ID', { maximumFractionDigits: 2 });
};

const formatSignedNumber = (value) => {
  const num = Number(value || 0);
  if (num > 0) return `+${formatNumber(num)}`;
  return formatNumber(num);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = parseLocalDateInput(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;

  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatStatusSelisih = (status) => {
  switch (String(status || '').toLowerCase()) {
    case 'sesuai':
      return 'Sesuai';
    case 'lebih':
      return 'Lebih';
    case 'kurang':
      return 'Kurang';
    default:
      return 'Status';
  }
};

const canSubmit = computed(() => {
  if (!idKunjungan.value || !kodeCustomer.value) return false;
  if (!items.value.length) return false;

  return items.value.every(item =>
    String(item.KodeStok || '').trim() !== '' &&
    item.Jumlah !== '' &&
    item.Jumlah !== null &&
    item.Jumlah !== undefined &&
    Number(item.Jumlah) >= 0
  );
});

const normalizeCheckResponse = (payload) => {
  return {
    is_done: !!payload?.is_done,
    message: payload?.message || '',
    summary: payload?.summary || {
      total_item: 0,
      total_item_sesuai: 0,
      total_item_lebih: 0,
      total_item_kurang: 0,
      total_stok_opname: 0,
      total_stok_system: 0,
      total_selisih: 0
    },
    items: Array.isArray(payload?.items) ? payload.items : []
  };
};

const normalizeSavedItems = (rows) => {
  return rows.map((row) => ({
    id: row.id,
    id_kunjungan: String(row.id_kunjungan || '').trim(),

    kode_barang: String(row.kode_barang || row.KodeStok || '').trim(),
    kode_customer: String(row.kode_customer || '').trim(),

    nama_barang: String(row.nama_barang || row.NamaBarang || 'Barang').trim(),

    // 🔥 penting
    stok_opname: Number(
      row.stok_opname ??
      row.StokOpname ??
      row.Jumlah ??
      0
    ),

    stok_system: Number(row.stok_system ?? 0),
    selisih: Number(row.selisih ?? 0),
    status_selisih: String(row.status_selisih || '').toLowerCase(),

    kategori: String(row.kategori || ''),
    satuan: String(row.satuan || ''),
    tanggal_input: row.tanggal_input || ''
  }));
};

const fetchStatus = async () => {
  try {
    loading.value = true;

    if (!idKunjungan.value || idKunjungan.value === 'null' || idKunjungan.value === '-') {
      console.warn('⚠️ ID Kunjungan tidak valid:', idKunjungan.value);
      loading.value = false;
      return;
    }

    const res = await api.get(`/api/kunjungan/stok-opname/check/${idKunjungan.value}`);
    const result = normalizeCheckResponse(res.data);

    isDone.value = result.is_done;
    message.value = result.message;
    summary.value = result.summary;

    if (result.is_done) {
      items.value = normalizeSavedItems(result.items);
    } else {
      items.value = [{ KodeStok: '', NamaBarang: '', Jumlah: 0 }];
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error('❌ Endpoint 404: Cek routes/api.php di Laravel Anda!');
      await Swal.fire('Error 404', 'Endpoint stok-opname/check tidak ditemukan di server.', 'error');
    } else {
      console.error('Gagal cek status stok opname:', error);
      await Swal.fire('Gagal', 'Tidak dapat terhubung ke server untuk mengecek status opname.', 'error');
    }
  } finally {
    loading.value = false;
  }
};

const addEmptyItem = () => {
  items.value.push({
    KodeStok: '',
    NamaBarang: '',
    Jumlah: 0
  });
};

const submitOpname = async () => {
  try {
    if (!canSubmit.value) {
      Swal.fire('Info', 'Lengkapi dulu kode barang dan jumlah opname', 'info');
      return;
    }

    saving.value = true;

    const payload = {
      id_kunjungan: idKunjungan.value,
      KodeCustomer: kodeCustomer.value,
      id_plafon: plafonId.value || null,
      Items: items.value.map(item => ({
        KodeStok: String(item.KodeStok || '').trim(),
        Jumlah: Number(item.Jumlah || 0)
      }))
    };

    const res = await api.post('/api/kunjungan/stok-opname/save', payload);

    if (res.data?.success) {
      await Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: res.data?.message || 'Stok opname berhasil disimpan',
        timer: 1200,
        showConfirmButton: false
      });

      await fetchStatus();
    } else {
      Swal.fire('Gagal', res.data?.message || 'Gagal menyimpan stok opname', 'error');
    }
  } catch (error) {
    console.error('Gagal simpan stok opname:', error);
    Swal.fire('Gagal', error?.response?.data?.message || 'Gagal menyimpan stok opname', 'error');
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  console.log('ROUTE QUERY:', route.query);
  console.log('ID KUNJUNGAN:', idKunjungan.value);
  fetchStatus();
});
</script>

<style scoped>
.stok-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.10), transparent 30%),
    linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
  padding-bottom: 120px;
  font-family: 'Plus Jakarta Sans', sans-serif;
}

.stok-header {
  background: rgba(255,255,255,0.88);
  backdrop-filter: blur(16px);
  border-radius: 0 0 28px 28px;
  padding: 18px 18px 22px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
}

.stok-header-top {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.btn-back {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 14px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 1.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-title .eyebrow {
  display: block;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 1px;
  color: #64748b;
  text-transform: uppercase;
}

.header-title h3 {
  margin: 2px 0 0;
  font-size: 1.22rem;
  font-weight: 900;
  color: #0f172a;
}

.customer-hero {
  background: linear-gradient(135deg, #0f172a, #1e293b);
  color: white;
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.18);
}

.hero-badge {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.hero-badge.done {
  background: rgba(34, 197, 94, 0.18);
  color: #86efac;
}

.hero-badge.pending {
  background: rgba(250, 204, 21, 0.18);
  color: #fde68a;
}

.customer-hero h2 {
  margin: 0 0 6px;
  font-size: 1.35rem;
  font-weight: 900;
}

.customer-hero p {
  margin: 0;
  color: rgba(255,255,255,0.75);
  font-size: 0.88rem;
}

.hero-meta {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.10);
  display: flex;
  align-items: center;
  gap: 18px;
}

.meta-item small {
  display: block;
  font-size: 0.65rem;
  color: rgba(255,255,255,0.55);
  margin-bottom: 4px;
  font-weight: 700;
}

.meta-item strong {
  font-size: 0.9rem;
  font-weight: 800;
}

.meta-divider {
  width: 1px;
  height: 34px;
  background: rgba(255,255,255,0.10);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 80px 24px;
  color: #64748b;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 14px;
}

.spinner {
  width: 42px;
  height: 42px;
  border: 4px solid #dbeafe;
  border-top: 4px solid #2563eb;
  border-radius: 50%;
  margin: 0 auto 16px;
  animation: spin 1s linear infinite;
}

.stok-content {
  padding: 18px;
}

.status-card {
  border-radius: 20px;
  padding: 18px;
  margin-bottom: 16px;
  border: 1px solid transparent;
}

.status-card h4 {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 800;
}

.status-card p {
  margin: 0;
  font-size: 0.85rem;
}

.status-done {
  background: #ecfdf5;
  border-color: #bbf7d0;
  color: #065f46;
}

.status-pending {
  background: #fff7ed;
  border-color: #fed7aa;
  color: #9a3412;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card {
  background: rgba(255,255,255,0.94);
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 14px 16px;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
}

.summary-card small {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 6px;
}

.summary-card strong {
  font-size: 1.2rem;
  color: #0f172a;
  font-weight: 900;
}

.items-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.item-card {
  background: rgba(255,255,255,0.92);
  border: 1px solid #e2e8f0;
  border-radius: 22px;
  padding: 16px;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
}

.card-sesuai {
  border-color: #bbf7d0;
  background: linear-gradient(180deg, rgba(236, 253, 245, 0.95), rgba(255,255,255,0.95));
}

.card-lebih {
  border-color: #bfdbfe;
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.95), rgba(255,255,255,0.95));
}

.card-kurang {
  border-color: #fed7aa;
  background: linear-gradient(180deg, rgba(255, 247, 237, 0.95), rgba(255,255,255,0.95));
}

.item-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
}

.item-info {
  flex: 1;
}

.item-title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.item-info h4 {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 800;
  color: #0f172a;
}

.item-info p {
  margin: 0;
  font-size: 0.78rem;
  color: #64748b;
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 10px;
}

.item-meta span {
  font-size: 0.72rem;
  color: #475569;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.item-input {
  min-width: 96px;
  text-align: right;
}

.item-input small {
  display: block;
  font-size: 0.65rem;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 6px;
}

.qty-box,
.qty-readonly {
  width: 86px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid #cbd5e1;
  background: #fff;
  text-align: center;
  font-size: 1rem;
  font-weight: 800;
  color: #0f172a;
}

.qty-box:focus {
  outline: none;
  border-color: #3b82f6;
}

.qty-readonly {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
}

.item-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.stat-box {
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 10px 12px;
}

.stat-box small {
  display: block;
  font-size: 0.68rem;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-box strong {
  font-size: 0.95rem;
  color: #0f172a;
  font-weight: 900;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.chip-sesuai {
  background: #dcfce7;
  color: #166534;
}

.chip-lebih {
  background: #dbeafe;
  color: #1d4ed8;
}

.chip-kurang {
  background: #ffedd5;
  color: #c2410c;
}

.chip-default {
  background: #e2e8f0;
  color: #334155;
}

.footer-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255,255,255,0.96);
  backdrop-filter: blur(14px);
  border-top: 1px solid #e2e8f0;
  padding: 14px 18px 28px;
  display: flex;
  gap: 12px;
}

.btn-add,
.btn-save {
  height: 54px;
  border: none;
  border-radius: 16px;
  font-weight: 800;
  font-size: 0.92rem;
}

.btn-add {
  flex: 1;
  background: #e2e8f0;
  color: #1e293b;
}

.btn-save {
  flex: 2;
  background: linear-gradient(135deg, #1d4ed8, #1e3a8a);
  color: white;
  box-shadow: 0 10px 22px rgba(29, 78, 216, 0.24);
}

.btn-save:disabled {
  opacity: 0.6;
  box-shadow: none;
}

@media (max-width: 640px) {
  .item-main {
    align-items: flex-start;
  }

  .item-stats {
    grid-template-columns: 1fr;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

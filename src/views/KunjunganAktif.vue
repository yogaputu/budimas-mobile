<template>
  <div class="enterprise-container">
    <header class="glass-header">
      <div class="top-nav">
        <button @click="router.push('/dashboard')" class="btn-icon-blur">
          <i class="fas fa-chevron-left"></i>
        </button>
        <div class="brand-identity">
          <span class="system-label">BUDIMAS ERP SYSTEM</span>
          <h3 class="page-title">Operational Visit</h3>
        </div>
        <div class="connectivity-status">
          <div :class="['status-indicator', connectivity.isOnline ? 'online' : 'offline']"></div>
          <span>{{ connectivity.isOnline ? 'SERVER CONNECTED' : 'LOCAL MODE' }}</span>
        </div>
      </div>
    </header>

    <div v-if="loading" class="full-page-loader">
      <div class="loader-content">
        <div class="enterprise-spinner"></div>
        <p>Synchronizing operational data...</p>
      </div>
    </div>

    <div v-else class="content-scrollable">
      
      <section v-if="dataKunjungan" class="identity-card shadow-lg">
        <div class="card-header">
          <div class="live-status">
            <span class="pulse-dot"></span>
            <span class="live-text">SESSION ACTIVE</span>
          </div>
          <div class="session-timer">
            <i class="far fa-clock"></i> {{ duration }}
          </div>
        </div>

        <div class="store-info">
          <h1 class="store-name">{{ dataKunjungan.Nama }}</h1>
          <div class="store-address">
            <i class="fas fa-map-marker-alt"></i>
            <span>{{ dataKunjungan.Alamat }}</span>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-item">
            <label>CUSTOMER CODE</label>
            <div class="value">{{ dataKunjungan.Kode }}</div>
          </div>
          <div class="stat-item highlight">
            <label>Total Tagihan</label>
            <div class="value">{{ formatCurrency(dataKunjungan.TotalTagihan) }}</div>
          </div>
        </div>
      </section>

      <div v-if="dataKunjungan" class="mission-grid">        
        <div class="action-card primary-gradient" @click="navigateTo('StokOpname')">
          <div class="icon-box">
            <i class="fas fa-boxes"></i>
          </div>
          <div class="card-text">
            <h4>Stok Opname</h4>
            <p>{{ stockOpnameStatusText }}</p>
          </div>
          <div class="status-icon">
            <i v-if="isStokOpnameDone" class="fas fa-check-circle"></i>
            <i v-else class="fas fa-chevron-right"></i>
          </div>
        </div>

        <div class="secondary-actions">
          <div 
            v-for="menu in menuListFiltered" 
            :key="menu.target"
            :class="['action-mini-card', { 'locked': !canAccessMenu(menu) }]"
            :aria-disabled="!canAccessMenu(menu)"
            @click="handleMenuClick(menu)"
          >
            <div class="mini-icon" :style="{ background: menu.gradient }">
              <i :class="menu.iconClass"></i>
            </div>
            <h5>{{ menu.title }}</h5>
            <div v-if="!canAccessMenu(menu)" class="lock-overlay">
              <i class="fas fa-lock"></i>
            </div>
          </div>
        </div>

        <!-- <div class="history-panel">
          <div class="history-panel-head">
            <h4>Histori Outlet</h4>
            <p>Order, retur, invoice, dan pembayaran</p>
          </div>

          <button class="history-entry" @click="navigateTo('VisitHistoryHub')">
            <div class="icon-box gray">
              <i class="fas fa-folder-open"></i>
            </div>
            <div class="card-text">
              <h4>Buka Histori Lengkap</h4>
              <p>Lihat semua histori transaksi customer ini</p>
            </div>
            <i class="fas fa-chevron-right edit-btn"></i>
          </button>
        </div> -->

        <div class="action-card secondary-outline" @click="showReasonModal = true">
          <div class="icon-box gray">
            <i class="fas fa-comment-alt"></i>
          </div>
          <div class="card-text">
            <h4>Catatan Kunjungan</h4>
            <p>{{ selectedReason?.nama_alasan || 'Sebutkan alasan jika tidak ada transaksi' }}</p>
          </div>
          <i class="fas fa-edit edit-btn"></i>
        </div>
      </div>

      <footer v-if="dataKunjungan" class="checkout-footer">
        <div :class="['swipe-wrapper', { 'swipe-disabled': !hasCompletedStockStep && !selectedReason }]">
          <div class="swipe-bg">
            <span class="swipe-instruction">
              {{ hasCompletedStockStep || selectedReason ? 'GESER UNTUK MENYELESAIKAN' : 'SELESAIKAN TUGAS UNTUK MEMBUKA' }}
            </span>
          </div>
          <div
            class="swipe-thumb"
            :style="{ transform: `translateX(${currentX}px)` }"
            @touchstart="onTouchStart"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
          >
            <i class="fas fa-angle-double-right"></i>
          </div>
        </div>
      </footer>

      <div v-if="!dataKunjungan && !loading" class="empty-enterprise">
        <i class="fas fa-clipboard-check"></i>
        <h3>No Deployment Active</h3>
        <p>Deploy a new visit mission from your executive dashboard.</p>
        <button @click="router.push('/dashboard')" class="btn-primary-enterprise">Return to Dashboard</button>
      </div>
    </div>

    <div v-if="showReasonModal" class="enterprise-modal">
      <div class="modal-backdrop" @click="showReasonModal = false"></div>
      <div class="modal-sheet">
        <div class="modal-header">
          <div class="handle"></div>
          <h3>Select Remark</h3>
          <p>Provide a reason for non-transactional visit</p>
        </div>
        <div class="reason-list">
          <button 
            v-for="reason in listAlasan" 
            :key="reason.id"
            @click="selectReason(reason)"
            :class="['reason-btn', { active: selectedReason?.id === reason.id }]"
          >
            {{ reason.nama_alasan }}
            <i v-if="selectedReason?.id === reason.id" class="fas fa-check"></i>
          </button>
        </div>
        <div class="reason-footer">
          <button @click="resetReason" class="reason-clear-btn">Tidak Ada Catatan</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api/axios';
import Swal from 'sweetalert2';
import { getDb } from '@/services/database';
import { useAuthStore } from '@/stores/auth';
import { useConnectivityStore } from '@/stores/connectivity';
import {
  checkVisitStockOpname,
  checkoutVisit,
  findActiveVisitFromServer,
  getVisitReason,
  saveVisitReason
} from '@/services/visitService';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const connectivity = useConnectivityStore();

// STATE MANAGEMENT
const loading = ref(true);
const loadingCheckout = ref(false);
const dataKunjungan = ref(null);
const startTime = ref(null);
const now = ref(new Date());
let timerInterval = null;

const getActivePlafonId = () => String(
  dataKunjungan.value?.IDPlafon || route.query.id_plafon || route.query.IDPlafon || ''
).trim();

// GATEKEEPER STATE
const isStokOpnameDone = ref(false);
const isCheckingStokOpname = ref(false);
const isStokOpnameRequired = ref(true);
const showReasonModal = ref(false);
const selectedReason = ref(null);

// SWIPE LOGIC
const isSwiped = ref(false);
const startX = ref(0);
const currentX = ref(0);
const maxSwipe = 280;

// MENU LIST DEFINITION
const menuListFiltered = computed(() => {
  const menus = [
  { title: 'Order Baru', iconClass: 'fas fa-shopping-cart', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', target: 'SalesOrder' },
  { title: 'Invoice', iconClass: 'fas fa-file-invoice-dollar', gradient: 'linear-gradient(135deg, #10b981, #059669)', target: 'Tagihan' },
  { title: 'Pembayaran', iconClass: 'fas fa-hand-holding-usd', gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)', target: 'Payment' },
  { title: 'Riwayat', iconClass: 'fas fa-history', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)', target: 'VisitHistoryHub' },
  { title: 'Retur', iconClass: 'fas fa-undo', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', target: 'Retur' },
  ];
  return menus;
});

const hasCompletedStockStep = computed(() =>
  isStokOpnameDone.value === true || isStokOpnameRequired.value === false
);

const canAccessMenu = () => hasCompletedStockStep.value && !isCheckingStokOpname.value;
const stockOpnameStatusText = computed(() => {
  if (isCheckingStokOpname.value) return 'Mengecek status...';
  if (!isStokOpnameRequired.value) return 'Dilewati, belum ada riwayat order';
  return isStokOpnameDone.value ? 'Sudah dilakukan' : 'Wajib dicek sebelum transaksi';
});

const listAlasan = ref([
  { id: 1, nama_alasan: 'Tutup Permanen' },
  { id: 2, nama_alasan: 'Tutup Sementara' },
  { id: 3, nama_alasan: 'Uang Habis' },
  { id: 4, nama_alasan: 'Beli Dari Sumber Lain' },
  { id: 5, nama_alasan: 'Stok Masih Ada' },
  { id: 11, nama_alasan: 'Pemilik Tidak Ada' }
]);

const getDoneCacheKey = (idKunjungan, kodeCustomer) =>
  `stokopname:done:${idKunjungan || 'no_visit'}:${kodeCustomer || ''}`;

const getDoneLocalKeys = (idKunjungan, kodeCustomer) => ([
  getDoneCacheKey(idKunjungan, kodeCustomer),
  getDoneCacheKey('no_visit', kodeCustomer)
]);

const readLocalDoneMarker = (idKunjungan, kodeCustomer) => {
  try {
    for (const key of getDoneLocalKeys(idKunjungan, kodeCustomer)) {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Gagal baca marker stok opname lokal:', err);
  }
  return null;
};

const hasStockOpnameDoneQuery = () =>
  ['1', 'true', 'yes'].includes(String(
    route.query.stok_opname_done ||
    route.query.stock_opname_done ||
    route.query.skip_stok_opname ||
    ''
  ).trim().toLowerCase());

const getDoneMarker = async (idKunjungan, kodeCustomer) => {
  const db = getDb();
  if (!db) return readLocalDoneMarker(idKunjungan, kodeCustomer);

  try {
    const keys = [
      getDoneCacheKey(idKunjungan, kodeCustomer),
      getDoneCacheKey('no_visit', kodeCustomer)
    ];

    for (const key of keys) {
      const exact = await db.query(
        `SELECT payload_json FROM app_cache WHERE cache_key = ? LIMIT 1`,
        [key]
      );
      const exactRaw = exact.values?.[0]?.payload_json;
      if (exactRaw) return JSON.parse(exactRaw);
    }

    const fallback = await db.query(
      `
      SELECT payload_json
      FROM app_cache
      WHERE cache_key LIKE ?
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [`stokopname:done:%:${kodeCustomer || ''}`]
    );
    const raw = fallback.values?.[0]?.payload_json;
    return raw ? JSON.parse(raw) : readLocalDoneMarker(idKunjungan, kodeCustomer);
  } catch (err) {
    console.error('getDoneMarker error:', err);
    return readLocalDoneMarker(idKunjungan, kodeCustomer);
  }
};

// 1. FUNGSI FETCH UTAMA (HYBRID)
const fetchKunjunganAktif = async () => {
  loading.value = true;
  const db = getDb();

  if (connectivity.isOnline) {
    try {
      const aktif = await findActiveVisitFromServer();
      if (aktif) {
        mapDataKunjungan(aktif);
        if (db) {
          await db.run(
            "UPDATE kunjungan_toko SET is_visited = 1, is_checkout = 0, id_kunjungan = ? WHERE kode = ? AND id_plafon = ?",
            [aktif.IDKunjungan, (aktif.Kode || '').trim(), String(aktif.IDPlafon || aktif.id_plafon || '').trim()]
          );
        }
      } else { await fetchKunjunganAktifOffline(); }
    } catch (error) { await fetchKunjunganAktifOffline(); }
    finally { loading.value = false; }
  } else {
    await fetchKunjunganAktifOffline();
    loading.value = false;
  }
};

const fetchKunjunganAktifOffline = async () => {
  const db = getDb();
  if (!db) return;
  try {
    const res = await db.query(
      "SELECT * FROM kunjungan_toko WHERE is_visited = 1 AND is_checkout = 0 ORDER BY updated_at_local DESC, id_kunjungan DESC LIMIT 1"
    );
    if (res.values?.length > 0) {
      const a = res.values[0];
      dataKunjungan.value = {
        ID: a.id_kunjungan, IDPlafon: a.id_plafon || '', Kode: a.kode, Nama: a.nama, Alamat: a.alamat,
        Tanggal: a.waktu_checkin || new Date().toISOString(),
        TotalTagihan: parseFloat(a.total_piutang || 0), Alasan: a.alasan || null
      };
      if (dataKunjungan.value.Tanggal) startTime.value = new Date(dataKunjungan.value.Tanggal.replace(' ', 'T'));
      checkStokOpnameStatus(a.id_kunjungan);
      checkExistingReason(dataKunjungan.value.Kode);
    }
  } catch (e) { console.error(e); }
};

const mapDataKunjungan = (aktif) => {
  dataKunjungan.value = {
    ID: aktif.IDKunjungan, Kode: (aktif.Kode || '').trim(), Nama: (aktif.Nama || '').trim(),
    IDPlafon: aktif.IDPlafon || aktif.id_plafon || '',
    Alamat: (aktif.Alamat || '').trim(), Tanggal: aktif.Tanggal,
    TotalTagihan: parseFloat(aktif.TotalPiutang || 0), Alasan: aktif.Alasan || null
  };
  if (aktif.Tanggal) startTime.value = new Date(aktif.Tanggal.split('.')[0].replace(' ', 'T'));
  checkStokOpnameStatus(aktif.IDKunjungan);
  checkExistingReason(dataKunjungan.value.Kode);
};

const isRejectedByServer = (error) => {
  const statusCode = Number(error?.response?.status || 0);
  return error?.isRejectedByServer || (statusCode >= 400 && statusCode < 500);
};

const getServerMessage = (error, fallback) => (
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback
);

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.payload)) return data.payload;
  if (Array.isArray(data?.result)) return data.result;
  return [];
};

const hasOrderHistoryForStockOpname = async (idKunjungan) => {
  try {
    const res = await api.get('/api/stok/history-order', {
      params: {
        kode_customer: dataKunjungan.value?.Kode || '',
        id_plafon: dataKunjungan.value?.IDPlafon || '',
        id_kunjungan: idKunjungan || ''
      }
    });
    return unwrapList(res.data).length > 0;
  } catch (err) {
    console.warn('Gagal cek riwayat order untuk stok opname:', err?.message || err);
    return true;
  }
};

const checkStokOpnameStatus = async (idKunjungan) => {
  isStokOpnameDone.value = false;
  isStokOpnameRequired.value = true;
  const db = getDb();
  const doneMarker = await getDoneMarker(idKunjungan, dataKunjungan.value?.Kode || '');
  isCheckingStokOpname.value = true;
  try {
    if (doneMarker?.is_done) {
      isStokOpnameDone.value = true;
      if (doneMarker.is_required === false || doneMarker.source === 'no_history') {
        isStokOpnameRequired.value = false;
      }
      return;
    }

    if (hasStockOpnameDoneQuery()) {
      isStokOpnameDone.value = true;
      isStokOpnameRequired.value = false;
      return;
    }

    if (!idKunjungan) {
      if (connectivity.isOnline) {
        const hasHistory = await hasOrderHistoryForStockOpname('');
        isStokOpnameRequired.value = hasHistory;
        isStokOpnameDone.value = !hasHistory;
      }
      return;
    }

    if (connectivity.isOnline) {
      const res = await checkVisitStockOpname(idKunjungan, {
        kode_customer: dataKunjungan.value?.Kode || '',
        id_plafon: dataKunjungan.value?.IDPlafon || ''
      });
      if (res.success || typeof res.is_done !== 'undefined') {
        isStokOpnameRequired.value = res.is_required !== false;
        isStokOpnameDone.value = !!res.is_done;
        if (res.is_required === undefined) {
          const hasHistory = await hasOrderHistoryForStockOpname(idKunjungan);
          isStokOpnameRequired.value = hasHistory;
          if (!hasHistory) {
            isStokOpnameDone.value = true;
          }
        }
        if (res.is_required === false) {
          isStokOpnameDone.value = true;
        }
        return;
      }

      const hasHistory = await hasOrderHistoryForStockOpname(idKunjungan);
      isStokOpnameRequired.value = hasHistory;
      if (!hasHistory) {
        isStokOpnameDone.value = true;
        return;
      }
    }

    if (!connectivity.isOnline) {
      if (db) {
        const localRes = await db.query(
          "SELECT id FROM stock_opname_offline WHERE id_kunjungan = ? AND status_sync = 'pending' LIMIT 1",
          [idKunjungan]
        );
        isStokOpnameDone.value = (localRes.values || []).length > 0;
        return;
      }
    }

    isStokOpnameDone.value = !!doneMarker?.is_done;
  } catch (e) {
    if (doneMarker?.is_done) {
      isStokOpnameDone.value = true;
      return;
    }
    isStokOpnameDone.value = false;
  } finally {
    isCheckingStokOpname.value = false;
  }
};

const selectReason = async (reason) => {
  if (selectedReason.value?.id === reason.id) {
    await resetReason();
    return;
  }

  loadingCheckout.value = true;
  const db = getDb();
  const plafonId = getActivePlafonId();
  const payload = {
    IDKunjungan: dataKunjungan.value.ID,
    Kode: dataKunjungan.value.Kode,
    id_plafon: plafonId,
    Alasan: '-',
    AlasanNoOrder: reason.nama_alasan
  };

  const saveOffline = async () => {
    if (!db) throw new Error('Database offline belum siap.');
    await db.run(
      "UPDATE kunjungan_toko SET alasan = ? WHERE kode = ? AND id_plafon = ?",
      [reason.nama_alasan, dataKunjungan.value.Kode, plafonId]
    );
    await db.run(
      "DELETE FROM kunjungan_offline WHERE kode_toko = ? AND id_plafon = ? AND status = 'pending_reason'",
      [dataKunjungan.value.Kode, plafonId]
    );
    await db.run(
      "INSERT INTO kunjungan_offline (id_kunjungan, id_plafon, kode_toko, nama_toko, alasan, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending_reason', ?)",
      [dataKunjungan.value.ID || '', plafonId, dataKunjungan.value.Kode, dataKunjungan.value.Nama, reason.nama_alasan, new Date().toISOString()]
    );
    selectedReason.value = reason;
    showReasonModal.value = false;
    Swal.fire({ icon: 'info', title: 'Offline Mode Simpan', timer: 1500 });
  };

  try {
    if (connectivity.isOnline) {
      const res = await saveVisitReason(payload);
      if (res?.success) {
        selectedReason.value = reason;
        if (dataKunjungan.value) dataKunjungan.value.Alasan = reason.nama_alasan;
        showReasonModal.value = false;
        Swal.fire({ icon: 'success', title: 'Alasan Kunjungan Tersimpan', timer: 1000 });
        return;
      }
      throw Object.assign(new Error(res?.message || 'Alasan kunjungan ditolak server.'), {
        isRejectedByServer: true
      });
    }
    await saveOffline();
  } catch (e) {
    if (isRejectedByServer(e)) {
      await Swal.fire('Gagal', getServerMessage(e, 'Alasan kunjungan ditolak server.'), 'error');
      return;
    }

    await saveOffline();
  } finally { loadingCheckout.value = false; }
};

const resetReason = async () => {
  if (!dataKunjungan.value) return;

  loadingCheckout.value = true;
  const db = getDb();
  const plafonId = getActivePlafonId();

  const clearLocalReason = async () => {
    if (db) {
      await db.run(
        "UPDATE kunjungan_toko SET alasan = NULL WHERE kode = ? AND id_plafon = ?",
        [dataKunjungan.value.Kode, plafonId]
      );
      await db.run(
        "DELETE FROM kunjungan_offline WHERE kode_toko = ? AND id_plafon = ? AND status = 'pending_reason'",
        [dataKunjungan.value.Kode, plafonId]
      );
    }
    selectedReason.value = null;
    dataKunjungan.value.Alasan = null;
    showReasonModal.value = false;
  };

  try {
    if (connectivity.isOnline) {
      const res = await api.delete('/api/kunjungan/hapus-alasan', {
        params: {
          KodeCustomer: dataKunjungan.value.Kode,
          IDKunjungan: dataKunjungan.value.ID,
          id_plafon: plafonId
        }
      });

      if (!res.data?.success) {
        throw Object.assign(new Error(res.data?.message || 'Catatan ditolak server.'), {
          isRejectedByServer: true
        });
      }
    }

    await clearLocalReason();
    await Swal.fire({
      icon: 'success',
      title: 'Catatan Dikosongkan',
      timer: 900,
      showConfirmButton: false
    });
  } catch (e) {
    if (isRejectedByServer(e)) {
      await Swal.fire('Gagal', getServerMessage(e, 'Catatan ditolak server.'), 'error');
      return;
    }

    await clearLocalReason();
    await Swal.fire({
      icon: 'info',
      title: 'Catatan Dikosongkan',
      text: 'Perubahan lokal akan mengikuti saat koneksi tersedia.',
      timer: 1200,
      showConfirmButton: false
    });
  } finally {
    loadingCheckout.value = false;
  }
};

const handleCheckOut = async () => {
  loadingCheckout.value = true;
  const db = getDb();
  const plafonId = getActivePlafonId();

  const saveCheckoutOffline = async () => {
    if (!db) throw new Error('Database offline belum siap.');
    await db.run(
      "DELETE FROM kunjungan_offline WHERE kode_toko = ? AND id_plafon = ? AND status = 'pending_checkout'",
      [dataKunjungan.value.Kode, plafonId]
    );
    await db.run(
      "INSERT INTO kunjungan_offline (id_kunjungan, id_plafon, kode_toko, nama_toko, status, waktu_checkout, created_at) VALUES (?, ?, ?, ?, 'pending_checkout', ?, ?)",
      [
        dataKunjungan.value.ID || '',
        plafonId,
        dataKunjungan.value.Kode,
        dataKunjungan.value.Nama || '',
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );
    await db.run(
      "UPDATE kunjungan_toko SET is_checkout = 1 WHERE kode = ? AND id_plafon = ?",
      [dataKunjungan.value.Kode, plafonId]
    );
  };

  try {
    if (connectivity.isOnline) {
      const res = await checkoutVisit({ IDKunjungan: dataKunjungan.value.ID, id_plafon: plafonId });
      if (res?.success) {
        if (db) {
          await db.run(
            "UPDATE kunjungan_toko SET is_visited = 1, is_checkout = 1 WHERE kode = ? AND id_plafon = ?",
            [dataKunjungan.value.Kode, plafonId]
          );
        }
        Swal.fire({ icon: 'success', title: 'Kunjungan Telah Selesai', timer: 1500 }).then(() => router.push('/dashboard'));
        return;
      }
      throw Object.assign(new Error(res?.message || 'Checkout ditolak server.'), {
        isRejectedByServer: true
      });
    }

    await saveCheckoutOffline();
    Swal.fire({ icon: 'warning', title: 'Offline Completion', text: 'Auto-sync on signal recovery.' }).then(() => router.push('/dashboard'));
  } catch (e) {
    if (isRejectedByServer(e)) {
      Swal.fire('Error', getServerMessage(e, 'Checkout ditolak server.'), 'error');
      resetSwipe();
      return;
    }

    try {
      await saveCheckoutOffline();
      Swal.fire({ icon: 'warning', title: 'Offline Completion', text: 'Koneksi terputus. Checkout masuk antrean offline.' }).then(() => router.push('/dashboard'));
    } catch (offlineErr) {
      console.error('Gagal menyimpan checkout offline:', offlineErr);
      Swal.fire('Error', offlineErr?.message || 'Action Failed', 'error');
      resetSwipe();
    }
  }
  finally { loadingCheckout.value = false; }
};

// HELPER FUNCTIONS
const formatCurrency = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v);
const duration = computed(() => {
  if (!startTime.value) return '00:00';
  const mins = Math.floor((now.value - startTime.value) / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
});

const onTouchStart = (e) => {
  if (isSwiped.value || (!hasCompletedStockStep.value && !selectedReason.value)) return;
  startX.value = e.touches[0].clientX;
};
const onTouchMove = (e) => {
  if (isSwiped.value || (!hasCompletedStockStep.value && !selectedReason.value)) return;
  let diff = e.touches[0].clientX - startX.value;
  currentX.value = Math.max(0, Math.min(diff, maxSwipe));
};
const onTouchEnd = () => {
  if (currentX.value >= maxSwipe * 0.8) {
    currentX.value = maxSwipe; isSwiped.value = true;
    confirmCheckOut();
    setTimeout(() => { if(!loadingCheckout.value) resetSwipe(); }, 3000);
  } else { currentX.value = 0; }
};
const resetSwipe = () => { isSwiped.value = false; currentX.value = 0; };
const warnOpname = () => Swal.fire({ title: 'Menu Terkunci', text: 'Selesaikan Stok Opname terlebih dahulu.', icon: 'warning' });
const handleMenuClick = async (menu) => {
  await checkStokOpnameStatus(dataKunjungan.value?.ID);
  if (!canAccessMenu(menu)) {
    warnOpname();
    return;
  }
  navigateTo(menu.target);
};
const checkExistingReason = async (k) => {
  try {
    const res = await getVisitReason({
      kode_customer: k,
      id_kunjungan: dataKunjungan.value?.ID || ''
    });
    if (res?.is_exists) {
      const txt = res.alasan;
      selectedReason.value = listAlasan.value.find(r => r.nama_alasan === txt) || { id: 99, nama_alasan: txt };
      if (dataKunjungan.value) dataKunjungan.value.Alasan = txt;
    } else {
      selectedReason.value = null;
      if (dataKunjungan.value) dataKunjungan.value.Alasan = null;
    }
  } catch (e) {}
};

const navigateTo = (t) => {
  if (t !== 'StokOpname' && !hasCompletedStockStep.value) {
    warnOpname();
    return;
  }

  router.push({
    path: routes[t],
    query: {
      id_kunjungan: dataKunjungan.value.ID,
      id_plafon: dataKunjungan.value.IDPlafon || '',
      kode_customer: dataKunjungan.value.Kode,
      nama_toko: dataKunjungan.value.Nama
    }
  });
};
const routes = {
  'SalesOrder': '/sales-order',
  'Tagihan': '/tagihan-customer',
  'StokOpname': '/stok-opname',
  'VisitHistoryHub': '/visit-history',
  'Retur': '/retur-page',
  'Payment': '/payment'
};

const confirmCheckOut = () => {
  Swal.fire({ title: 'Selesai Kunjungan?', text: 'Verifikasi Dulu Sebelum Keluar.', icon: 'question', showCancelButton: true, confirmButtonText: 'Confirm' })
  .then(r => r.isConfirmed ? handleCheckOut() : resetSwipe());
};

onMounted(() => { fetchKunjunganAktif(); timerInterval = setInterval(() => { now.value = new Date(); }, 30000); });
onUnmounted(() => clearInterval(timerInterval));
</script>

<style scoped>
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css');

.enterprise-container {
  background: #f1f5f9;
  min-height: 100vh;
  color: #1e293b;
  font-family: 'Inter', sans-serif;
}

/* HEADER GLASS */
.glass-header {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 15px 20px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.btn-icon-blur {
  background: #fff;
  border: 1px solid #e2e8f0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

.brand-identity {
  text-align: center;
}

.system-label {
  font-size: 9px;
  font-weight: 800;
  color: #64748b;
  letter-spacing: 1px;
}

.page-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.connectivity-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 8px;
  font-weight: 700;
  color: #64748b;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-bottom: 2px;
}

.status-indicator.online { background: #10b981; box-shadow: 0 0 5px #10b981; }
.status-indicator.offline { background: #ef4444; }

/* IDENTITY CARD */
.content-scrollable {
  padding: 20px;
  padding-bottom: 120px;
}

.identity-card {
  background: #fff;
  border-radius: 24px;
  padding: 24px;
  margin-bottom: 25px;
  border: 1px solid rgba(0,0,0,0.03);
}

.card-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
}

.live-status {
  display: flex;
  align-items: center;
  background: #f0fdf4;
  padding: 4px 12px;
  border-radius: 100px;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background: #22c55e;
  border-radius: 50%;
  margin-right: 8px;
  animation: pulse 1.5s infinite;
}

.live-text {
  font-size: 10px;
  font-weight: 800;
  color: #166534;
}

.session-timer {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.store-name {
  font-size: 22px;
  font-weight: 800;
  margin: 0 0 8px 0;
  color: #0f172a;
  letter-spacing: -0.5px;
}

.store-address {
  display: flex;
  align-items: flex-start;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}

.store-address i { margin-top: 3px; margin-right: 8px; color: #94a3b8; }

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 15px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #f1f5f9;
}

.stat-item label {
  display: block;
  font-size: 9px;
  font-weight: 800;
  color: #94a3b8;
  margin-bottom: 4px;
}

.stat-item .value {
  font-size: 15px;
  font-weight: 700;
}

.stat-item.highlight .value {
  color: #ef4444;
}

/* MISSION CONTROL */
.section-label {
  font-size: 11px;
  font-weight: 800;
  color: #94a3b8;
  margin-bottom: 15px;
  letter-spacing: 1px;
}

.action-card {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 18px;
  justify-content: space-between;
  border-radius: 20px;
  margin-bottom: 15px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
}

.action-card.primary-gradient {
  background: linear-gradient(135deg, #0f172a, #334155);
  color: #fff;
}

.icon-box {
  width: 50px;
  height: 50px;
  background: rgba(255,255,255,0.1);
  border-radius: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 15px;
}

.card-text h4 { margin: 0; font-size: 16px; font-weight: 700; }
.card-text p { margin: 2px 0 0 0; font-size: 11px; opacity: 0.6; }

.secondary-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 15px;
}

.history-panel {
  margin-bottom: 15px;
}

.history-panel-head {
  margin-bottom: 12px;
}

.history-panel-head h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 800;
  color: #0f172a;
}

.history-panel-head p {
  margin: 4px 0 0;
  font-size: 11px;
  color: #64748b;
}

.history-entry {
  width: 100%;
  border: none;
  text-align: left;
  background: #fff;
  border-radius: 20px;
  padding: 18px;
  display: flex;
  align-items: center;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
}

.action-mini-card {
  background: #fff;
  padding: 15px 10px;
  border-radius: 20px;
  text-align: center;
  position: relative;
  overflow: hidden;
  cursor: pointer;
}

.action-mini-card.locked {
  cursor: not-allowed;
  filter: grayscale(0.35);
}

.mini-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 10px;
  color: #fff;
  font-size: 16px;
}

.action-mini-card h5 { margin: 0; font-size: 11px; font-weight: 700; }

.lock-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(255,255,255,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #94a3b8;
}

/* FOOTER SWIPE */
.checkout-footer {
  position: fixed;
  bottom: 0; left: -21px; width: 100%;
  padding: 20px;
  background: linear-gradient(to top, #f1f5f9 80%, transparent);
}

.swipe-wrapper {
  background: #e2e8f0;
  height: 65px;
  border-radius: 100px;
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 6px;
}

.swipe-disabled { opacity: 0.5; filter: grayscale(1); }

.swipe-bg {
  width: 100%;
  text-align: center;
}

.swipe-instruction {
  font-size: 11px;
  font-weight: 800;
  color: #64748b;
  letter-spacing: 1px;
}

.swipe-thumb {
  position: absolute;
  left: 6px;
  width: 53px;
  height: 53px;
  background: #0f172a;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.2);
}

/* MODAL */
.enterprise-modal {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.modal-backdrop {
  position: absolute;
  width: 100%; height: 100%;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
}

.modal-sheet {
  position: relative;
  width: 100%;
  background: #fff;
  border-radius: 30px 30px 0 0;
  padding: 20px 20px 40px 20px;
  animation: slideUp 0.3s ease-out;
}

.handle {
  width: 40px; height: 5px;
  background: #e2e8f0;
  border-radius: 10px;
  margin: 0 auto 20px;
}

.modal-header h3 { margin: 0; font-size: 18px; font-weight: 800; }
.modal-header p { margin: 5px 0 20px 0; font-size: 13px; color: #64748b; }

.reason-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reason-footer {
  margin-top: 14px;
}

.reason-clear-btn {
  width: 100%;
  border: 1px solid #fecaca;
  background: #fff1f2;
  color: #be123c;
  border-radius: 12px;
  padding: 12px;
  font-weight: 800;
}

.reason-btn {
  padding: 18px;
  border-radius: 16px;
  border: 1px solid #f1f5f9;
  background: #f8fafc;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
}

.reason-btn.active {
  background: #0f172a;
  color: #fff;
  border-color: #0f172a;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.4; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

:global(:root[data-theme='dark']) .enterprise-container {
  background: linear-gradient(180deg, #020617 0%, #0f172a 24%, #020617 100%) !important;
}

:global(:root[data-theme='dark']) .glass-header,
:global(:root[data-theme='dark']) .identity-card,
:global(:root[data-theme='dark']) .action-card,
:global(:root[data-theme='dark']) .action-mini-card,
:global(:root[data-theme='dark']) .history-entry,
:global(:root[data-theme='dark']) .modal-sheet {
  background: rgba(15, 23, 42, 0.92) !important;
  border: 1px solid rgba(51, 65, 85, 0.9) !important;
  box-shadow: 0 18px 36px rgba(2, 6, 23, 0.36) !important;
}

:global(:root[data-theme='dark']) .page-title,
:global(:root[data-theme='dark']) .store-name,
:global(:root[data-theme='dark']) .history-panel-head h4,
:global(:root[data-theme='dark']) .modal-header h3,
:global(:root[data-theme='dark']) .card-text h4,
:global(:root[data-theme='dark']) .stat-item .value,
:global(:root[data-theme='dark']) .action-mini-card h5 {
  color: #e2e8f0 !important;
}

:global(:root[data-theme='dark']) .section-label,
:global(:root[data-theme='dark']) .history-panel-head p,
:global(:root[data-theme='dark']) .modal-header p,
:global(:root[data-theme='dark']) .card-text p,
:global(:root[data-theme='dark']) .stat-item label,
:global(:root[data-theme='dark']) .connectivity-status,
:global(:root[data-theme='dark']) .store-address,
:global(:root[data-theme='dark']) .store-address i {
  color: #94a3b8 !important;
}

:global(:root[data-theme='dark']) .stats-grid {
  border-top-color: rgba(51, 65, 85, 0.88) !important;
}

:global(:root[data-theme='dark']) .lock-overlay {
  background: rgba(2, 6, 23, 0.78) !important;
  color: #64748b !important;
}

:global(:root[data-theme='dark']) .checkout-footer {
  background: linear-gradient(to top, rgba(2, 6, 23, 0.95) 80%, transparent) !important;
}

:global(:root[data-theme='dark']) .swipe-wrapper {
  background: #1e293b !important;
  box-shadow: inset 0 1px 0 rgba(148, 163, 184, 0.08) !important;
}

:global(:root[data-theme='dark']) .swipe-instruction {
  color: #cbd5e1 !important;
}

:global(:root[data-theme='dark']) .handle {
  background: #334155 !important;
}

:global(:root[data-theme='dark']) .reason-btn {
  background: #111827 !important;
  border-color: #334155 !important;
  color: #e2e8f0 !important;
}

:global(:root[data-theme='dark']) .reason-btn.active {
  background: #2563eb !important;
  border-color: #2563eb !important;
  color: #eff6ff !important;
}

/* Final dark contrast guard: avoid washed-out visit screen from shared theme layers. */
:global(html[data-theme='dark'] body[data-theme='dark']) .enterprise-container,
:global(html[data-theme='dark'] body[data-theme='dark']) .enterprise-container * {
  filter: none !important;
  mix-blend-mode: normal !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .enterprise-container {
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.16), transparent 28%),
       linear-gradient(180deg, #000814 0%, #020617 44%, #000814 100%) !important;
  color: #f8fafc !important;
  opacity: 1 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .enterprise-container :is(
  .glass-header,
  .identity-card,
  .action-card,
  .action-mini-card,
  .history-entry,
  .modal-sheet,
  .reason-btn
) {
  background: rgba(3, 7, 18, 0.94) !important;
  border-color: rgba(71, 85, 105, 0.9) !important;
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.44) !important;
  opacity: 1 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .enterprise-container :is(
  .page-title,
  .store-name,
  .history-panel-head h4,
  .modal-header h3,
  .card-text h4,
  .stat-item .value,
  .action-mini-card h5
) {
  color: #ffffff !important;
  opacity: 1 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .enterprise-container :is(
  .system-label,
  .connectivity-status,
  .section-label,
  .store-address,
  .store-address i,
  .stat-item label,
  .session-timer,
  .card-text p,
  .modal-header p,
  .swipe-instruction
) {
  color: #cbd5e1 !important;
  opacity: 1 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .enterprise-container .action-card.primary-gradient {
  background: linear-gradient(135deg, rgba(30, 64, 175, 0.38), rgba(3, 7, 18, 0.96)) !important;
  border-color: rgba(96, 165, 250, 0.38) !important;
}
</style>

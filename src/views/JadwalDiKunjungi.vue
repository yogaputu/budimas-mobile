<template>
  <div class="enterprise-jadwal-container">
    <div v-if="isOffline" class="enterprise-offline-banner">
      <div class="banner-content">
        <i class="fas fa-database"></i>
        <span>LOCAL DATABASE ACTIVE</span>
        <small>Data sinkronisasi: {{ lastSyncTime || 'Hari ini' }}</small>
      </div>
    </div>

    <header class="glass-header">
      <div class="header-main">
        <button @click="router.push('/dashboard')" class="btn-back-modern" aria-label="Dashboard" title="Dashboard">
          <i class="fas fa-chevron-left"></i>
        </button>
        <div class="header-info">
          <h3 class="header-title">Riwayat Kunjungan</h3>
          <p class="header-date">{{ currentDate }}</p>
        </div>
        <div class="header-stats">
          <div class="stat-pill">
            <span class="count">{{ groupedJadwal.length }}</span>
            <span class="label">OUTLET</span>
          </div>
        </div>
      </div>

      <div class="search-container-modern">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input 
            v-model="searchQuery" 
            placeholder="Cari nama outlet atau kode..." 
            aria-label="Search"
          />
          <button v-if="searchQuery" @click="searchQuery = ''" class="btn-clear" aria-label="Bersihkan" title="Bersihkan">
            <i class="fas fa-times-circle"></i>
          </button>
        </div>
      </div>
    </header>

    <main class="content-area">
      
      <div v-if="loading" class="state-wrapper">
        <div class="enterprise-loader">
          <div class="orbit"></div>
          <div class="orbit"></div>
          <div class="orbit"></div>
        </div>
        <p class="loading-text">Memuat riwayat kunjungan...</p>
      </div>

      <div v-else-if="groupedJadwal.length === 0" class="state-wrapper animate-fade-in">
        <div class="empty-illustration">
          <i class="fas fa-calendar-day"></i>
        </div>
        <h4>Riwayat Belum Tersedia</h4>
        <p>Belum ada outlet yang dikunjungi atau data belum tersinkron.</p>
        <button @click="fetchJadwal" class="btn-refresh">
          <i class="fas fa-sync-alt"></i> Muat Ulang
        </button>
      </div>

      <div v-else class="outlet-grid animate-slide-up">
        <div 
          v-for="outlet in groupedJadwal"
          :key="outlet.OutletKey"
          class="outlet-card"
          :class="{ 
            'status-visited': outlet.AllPlansFinished,
            'status-failed': outlet.HasFailedPlan,
            'status-offline': isOffline 
          }"
        >
          <div class="card-indicator" :class="getOutletIndicatorClass(outlet)"></div>

          <div class="card-body">
            <div class="outlet-header-row">
              <span class="id-tag">#{{ outlet.Kode?.trim() || '-' }}</span>
              <div class="outlet-plan-count">{{ outlet.VisitPlans.length }} PLAFON</div>
            </div>

            <h4 class="outlet-name-text">{{ outlet.Nama?.trim() || 'Outlet Tanpa Nama' }}</h4>

            <div class="plan-section">
              <div class="plan-section-header">
                <span>RIWAYAT PER PRINCIPAL / PLAFON</span>
                <span class="plan-progress">{{ outlet.CompletedPlanCount }}/{{ outlet.VisitPlans.length }} selesai</span>
              </div>
              <button
                v-for="plan in outlet.VisitPlans"
                :key="getVisitScopeKey(plan)"
                type="button"
                class="plan-item"
                :class="{ 'plan-item-completed': isPlanFinished(plan), 'plan-item-failed': !!plan.AlasanFailed }"
                @click="pilihCustomer(plan)"
              >
                <div class="plan-item-main">
                  <strong>{{ getPrincipalLabel(plan) }}</strong>
                  <span v-if="plan.AlasanFailed" class="plan-reason">{{ plan.AlasanFailed }}</span>
                </div>
                <div class="plan-item-meta">
                  <span>Sisa Rp {{ formatNumber(plan.SisaPlafon) }}</span>
                  <span class="plan-status" :class="getPlanStatusClass(plan)">{{ getStatusLabel(plan) }}</span>
                </div>
                <i :class="isPlanFinished(plan) ? 'fas fa-clipboard-check action-done' : 'fas fa-chevron-right action-next'"></i>
              </button>
            </div>
            
            <div class="address-row">
              <i class="fas fa-map-marker-alt"></i>
              <p class="address-text">{{ outlet.Alamat?.trim() || 'Alamat outlet belum tersedia' }}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/api/axios';
import Swal from 'sweetalert2';
import { getDb } from '@/services/database';
import { useConnectivityStore } from '@/stores/connectivity';

const isOffline = ref(false);
const router = useRouter();
const connectivity = useConnectivityStore();
const jadwal = ref([]);
const loading = ref(true);
const searchQuery = ref('');
const isInitialLoading = ref(true);
const lastSyncTime = ref('');

const currentDate = computed(() => {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date());
});

const getPayloadArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

const getPlafonId = (item = {}) => String(item.IDPlafon ?? item.id_plafon ?? '').trim();
const getVisitScopeKey = (item = {}) => `${String(item.Kode || item.kode || '').trim()}::${getPlafonId(item) || 'tanpa-plafon'}`;
const getOutletGroupKey = (item = {}) => {
  const kode = String(item.Kode || item.kode || '').trim();
  if (kode) return `kode:${kode}`;
  return `outlet:${String(item.Nama || item.nama || '').trim().toLowerCase()}::${String(item.Alamat || item.alamat || '').trim().toLowerCase()}`;
};

const getPrincipalLabel = (item = {}) => {
  const kode = String(item.KodePrincipal || item.kode_principal || '').trim();
  const nama = String(item.NamaPrincipal || item.nama_principal || '').trim();
  const plafon = String(item.KodePlafon || item.kode_plafon || '').trim();
  const plafonId = getPlafonId(item);
  if (kode && nama && kode.toLowerCase() !== nama.toLowerCase()) return `${kode} — ${nama}`;
  return nama || kode || plafon || (plafonId ? `Plafon #${plafonId}` : 'Principal belum tersedia');
};

const isPlanFinished = (item = {}) => Boolean(item.isVisited || item.AlasanFailed);

const getPlanStatusClass = (item = {}) => {
  if (item.AlasanFailed) return 'plan-status-failed';
  if (item.isCheckOut) return 'plan-status-completed';
  if (item.isVisited) return 'plan-status-started';
  return 'plan-status-pending';
};

const getOutletIndicatorClass = (outlet = {}) => {
  if (outlet.HasFailedPlan) return 'bg-failed';
  if (outlet.AllPlansFinished) return 'bg-visited';
  return 'bg-pending';
};

const groupVisitHistoryByOutlet = (items = []) => {
  const groups = new Map();
  for (const item of items) {
    const outletKey = getOutletGroupKey(item);
    const scopeKey = getVisitScopeKey(item);
    let group = groups.get(outletKey);
    if (!group) {
      group = { ...item, OutletKey: outletKey, VisitPlans: [], _planKeys: new Set() };
      groups.set(outletKey, group);
    }
    if (!group._planKeys.has(scopeKey)) {
      group._planKeys.add(scopeKey);
      group.VisitPlans.push(item);
    }
  }

  return Array.from(groups.values()).map((group) => {
    const plans = group.VisitPlans;
    const completedPlanCount = plans.filter(isPlanFinished).length;
    return {
      ...group,
      CompletedPlanCount: completedPlanCount,
      AllPlansFinished: plans.length > 0 && completedPlanCount === plans.length,
      HasFailedPlan: plans.some((plan) => Boolean(plan.AlasanFailed))
    };
  });
};

const normalizeApiItem = (item = {}) => {
  const kode = String(
    item.Kode ??
    item.kode_customer ??
    item.KodeCustomer ??
    item.id_plafon ??
    item.IDPlafon ??
    ''
  ).trim();

  const status = Number(item.status ?? item.Status ?? 0);
  const idKunjungan = item.IDKunjungan ?? item.id_kunjungan ?? item.id ?? null;

  return {
    ...item,
    Kode: kode,
    Nama: String(item.Nama ?? item.nama_customer ?? item.NamaCustomer ?? item.nama_toko ?? 'Tanpa Nama').trim(),
    Alamat: String(item.Alamat ?? item.alamat ?? item.AlamatCustomer ?? '').trim(),
    IDKunjungan: idKunjungan,
    IDJadwal: item.IDJadwal ?? item.id_jadwal ?? null,
    IDPlafon: item.IDPlafon ?? item.id_plafon ?? null,
    isVisited: Boolean(item.isVisited) || status === 1 || status === 2 || !!idKunjungan,
    isCheckOut: Boolean(item.isCheckOut) || status === 2 || Number(item.CheckOut ?? item.checkout ?? 0) === 1,
    TotalPiutang: Number(item.TotalPiutang ?? item.total_piutang ?? item.piutang ?? 0) || 0,
    SisaPlafon: Number(item.SisaPlafon ?? item.sisa_plafon ?? 0) || 0,
    AlasanFailed: item.AlasanFailed ?? item.Alasan ?? item.alasan ?? ''
  };
};

const mapSQLiteRowToView = (item = {}) => ({
  Kode: String(item.kode ?? item.Kode ?? '').trim(),
  Nama: String(item.nama ?? item.Nama ?? 'Tanpa Nama').trim(),
  Alamat: String(item.alamat ?? item.Alamat ?? '').trim(),
  IDKunjungan: item.id_kunjungan ?? item.IDKunjungan ?? null,
  IDPlafon: item.id_plafon ?? item.IDPlafon ?? '',
  isVisited: Number(item.is_visited ?? item.isVisited ?? 0) === 1,
  isCheckOut: Number(item.is_checkout ?? item.isCheckOut ?? 0) === 1,
  TotalPiutang: Number(item.total_piutang ?? item.TotalPiutang ?? 0) || 0,
  SisaPlafon: Number(item.sisa_plafon ?? item.SisaPlafon ?? 0) || 0,
  AlasanFailed: item.alasan ?? item.AlasanFailed ?? ''
});

const getReasonFromServer = async (kode) => {
  try {
    const res = await api.get('/api/kunjungan/cek-alasan', {
      params: { kode_customer: kode }
    });
    return res.data?.is_exists ? (res.data.alasan || '') : '';
  } catch (e) {
    return '';
  }
};

const mergeServerData = async (rawJadwal = [], rawSudahKunjung = []) => {
  const listJadwal = rawJadwal.map(normalizeApiItem);
  const listSudahKunjung = rawSudahKunjung.map(normalizeApiItem);
  const sourceList = listJadwal.length > 0 ? listJadwal : listSudahKunjung;

  const visitedMap = new Map();
  for (const item of listSudahKunjung) {
    if (item.Kode) visitedMap.set(getVisitScopeKey(item), item);
  }

  const tempEnrichedData = [];

  for (const item of sourceList) {
    const infoKunjungan = visitedMap.get(getVisitScopeKey(item));
    let alasan = infoKunjungan?.AlasanFailed || item.AlasanFailed || '';

    if (!alasan && (infoKunjungan || item.isVisited)) {
      alasan = await getReasonFromServer(item.Kode);
    }

    tempEnrichedData.push(normalizeApiItem({
      ...item,
      isVisited: Boolean(infoKunjungan?.isVisited) || Boolean(item.isVisited),
      isCheckOut: Boolean(infoKunjungan?.isCheckOut) || Boolean(item.isCheckOut),
      IDKunjungan: infoKunjungan?.IDKunjungan || item.IDKunjungan || '',
      TotalPiutang: infoKunjungan?.TotalPiutang ?? item.TotalPiutang ?? 0,
      SisaPlafon: infoKunjungan?.SisaPlafon ?? item.SisaPlafon ?? 0,
      AlasanFailed: alasan
    }));
  }

  return tempEnrichedData;
};

const syncToSQLite = async (data = []) => {
  const db = getDb();
  if (!db || data.length === 0) return;

  for (const toko of data) {
    if (!toko.Kode) continue;

    await db.run(
      `INSERT OR REPLACE INTO kunjungan_toko
      (kode, nama, alamat, id_plafon, id_kunjungan, is_visited, is_checkout, total_piutang, sisa_plafon, alasan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        toko.Kode,
        toko.Nama,
        toko.Alamat || '',
        getPlafonId(toko),
        toko.IDKunjungan || '',
        toko.isVisited ? 1 : 0,
        toko.isCheckOut ? 1 : 0,
        toko.TotalPiutang || 0,
        toko.SisaPlafon || 0,
        toko.AlasanFailed || ''
      ]
    );
  }

  lastSyncTime.value = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());
};

const fetchJadwal = async () => {
  try {
    loading.value = true;
    if (jadwal.value.length === 0) isInitialLoading.value = true;

    const [resJadwal, resDaftar] = await Promise.all([
      api.get('/api/kunjungan/jadwal'),
      api.get('/api/kunjungan/daftar')
    ]);

    isOffline.value = false;

    const rawJadwal = getPayloadArray(resJadwal.data);
    const rawDaftar = getPayloadArray(resDaftar.data);
    const enrichedData = await mergeServerData(rawJadwal, rawDaftar);

    jadwal.value = enrichedData;
    await syncToSQLite(enrichedData);

    console.log('✅ JadwalDiKunjungi:', {
      jadwal: rawJadwal.length,
      daftar: rawDaftar.length,
      tampil: enrichedData.length
    });
  } catch (error) {
    console.error('⚠️ Koneksi terputus, mengambil dari SQLite...', error);
    await loadJadwalOffline();
  } finally {
    loading.value = false;
    isInitialLoading.value = false;
  }
};

const loadJadwalOffline = async () => {
  try {
    const db = getDb();
    if (!db) {
      jadwal.value = [];
      isOffline.value = true;
      return;
    }

    const result = await db.query('SELECT * FROM kunjungan_toko ORDER BY nama ASC');
    jadwal.value = (result.values || []).map(mapSQLiteRowToView);
    isOffline.value = true;
  } catch (error) {
    console.error('Gagal load data offline:', error);
    jadwal.value = [];
    isOffline.value = true;
  }
};

const filteredJadwal = computed(() => {
  if (!searchQuery.value) return jadwal.value || [];

  const q = searchQuery.value.toLowerCase();

  return (jadwal.value || []).filter(item => {
    const nama = String(item.Nama || '').toLowerCase();
    const kode = String(item.Kode || '').toLowerCase();
    const alamat = String(item.Alamat || '').toLowerCase();
    return nama.includes(q) || kode.includes(q) || alamat.includes(q);
  });
});

const groupedJadwal = computed(() => groupVisitHistoryByOutlet(filteredJadwal.value || []));

const formatNumber = (num) => new Intl.NumberFormat('id-ID').format(num || 0);

const getStatusLabel = (item) => {
  if (item?.AlasanFailed) return 'Tidak Ada Transaksi';
  if (item?.isCheckOut) return 'Kunjungan Selesai';
  if (item?.isVisited) return 'Sudah Dikunjungi';
  return 'Belum Dikunjungi';
};

const pilihCustomer = (customer) => {
  const kodeClean = String(customer.Kode || '').trim();
  const namaClean = String(customer.Nama || '').trim() || 'Tanpa Nama';
  const alamatClean = String(customer.Alamat || '').trim() || 'Alamat tidak tersedia';

  if (!kodeClean) {
    Swal.fire('Gagal', 'Kode customer tidak ditemukan', 'error');
    return;
  }

  router.push({
    path: '/kunjungan-selesai',
    query: {
      kode_customer: kodeClean,
      nama_toko: namaClean,
      alamat: alamatClean,
      id: customer.IDKunjungan || '',
      id_jadwal: customer.IDJadwal || '',
      id_plafon: getPlafonId(customer),
      mode: 'view'
    }
  });
};

const checkExistingReason = async (kodeCustomer) => {
  return await getReasonFromServer(kodeCustomer);
};

watch(
  () => connectivity.isOnline,
  async (online, oldOnline) => {
    if (online !== oldOnline) {
      await fetchJadwal();
    }
  }
);

onMounted(() => {
  fetchJadwal();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
</script>

<style scoped>
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css');

.enterprise-jadwal-container {
  background:
    radial-gradient(circle at top right, rgba(16, 185, 129, 0.08), transparent 28%),
    linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
  min-height: 100vh;
  font-family: 'Inter', sans-serif;
}

/* OFFLINE BANNER */
.enterprise-offline-banner {
  background: #f59e0b;
  color: white;
  padding: 10px 20px;
  position: sticky;
  top: 0;
  z-index: 1001;
  box-shadow: 0 2px 10px rgba(245, 158, 11, 0.3);
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 11px;
  letter-spacing: 0.5px;
}

.banner-content i { animation: blink 1s infinite; }

/* HEADER GLASS */
.glass-header {
  background:
    linear-gradient(135deg, #064e3b 0%, #0f766e 50%, #0ea5e9 100%);
  color: #fff;
  padding: 20px 20px 22px;
  position: sticky;
  top: 0;
  z-index: 1000;
  border-bottom: none;
  border-radius: 0 0 28px 28px;
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.18);
}

.header-main {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}

.btn-back-modern {
  width: 42px; height: 42px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 12px;
  color: #fff;
  font-size: 18px;
  backdrop-filter: blur(10px);
}

.header-info { flex: 1; }
.header-title { margin: 0; font-size: 18px; font-weight: 900; color: #fff; }
.header-date { margin: 2px 0 0; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.72); }

.stat-pill {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: white;
  padding: 6px 12px;
  border-radius: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-pill .count { font-size: 14px; font-weight: 800; }
.stat-pill .label { font-size: 8px; font-weight: 700; opacity: 0.8; }

/* SEARCH BOX */
.search-container-modern {
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 14px;
  padding: 2px 15px;
  display: flex;
  align-items: center;
  backdrop-filter: blur(10px);
}

.search-box {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 12px;
}

.search-box i { color: rgba(255,255,255,0.72); font-size: 14px; }
.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  padding: 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  outline: none;
}

.search-box input::placeholder { color: rgba(255,255,255,0.62); }

/* OUTLET GRID */
.content-area { padding: 20px; }
.outlet-grid { display: flex; flex-direction: column; gap: 16px; }

.outlet-card {
  background: rgba(255, 255, 255, 0.96);
  border-radius: 22px;
  display: flex;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
  position: relative;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
}

.outlet-card:active { transform: scale(0.98); }

.card-indicator { width: 6px; }
.bg-pending { background: #e2e8f0; }
.bg-visited { background: #10b981; }
.bg-failed { background: #f59e0b; }

.card-body { flex: 1; padding: 18px; }

.outlet-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.id-tag { font-size: 10px; font-weight: 800; color: #0f766e; background: #ecfdf5; padding: 3px 9px; border-radius: 999px; }

.status-pill-solid {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 100px;
  font-size: 10px;
  font-weight: 800;
  color: white;
}

.status-pill-solid.visited { background: #10b981; }
.status-pill-solid.failed { background: #b45309; }

.outlet-name-text { margin: 0 0 6px; font-size: 16px; font-weight: 800; color: #0f172a; }

.outlet-plan-count {
  border-radius: 999px;
  padding: 4px 8px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 9px;
  font-weight: 900;
}

.plan-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 13px 0;
  padding: 11px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #f8fafc;
}

.plan-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #64748b;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .035em;
}

.plan-progress { color: #0f766e; white-space: nowrap; }

.plan-item {
  width: 100%;
  border: 1px solid #dbeafe;
  border-radius: 11px;
  padding: 10px;
  background: #fff;
  color: #0f172a;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 18px;
  gap: 9px;
  align-items: center;
  text-align: left;
}

.plan-item-completed { border-color: #a7f3d0; background: #f0fdf4; }
.plan-item-failed { border-color: #fde68a; background: #fffbeb; }
.plan-item-main strong, .plan-item-main span, .plan-item-meta span { display: block; }
.plan-item-main strong { font-size: 11px; font-weight: 800; line-height: 1.3; }
.plan-reason { margin-top: 3px; color: #a16207; font-size: 10px; line-height: 1.3; }
.plan-item-meta { text-align: right; }
.plan-item-meta > span:first-child { color: #64748b; font-size: 9px; font-weight: 700; }
.plan-status { margin-top: 4px; font-size: 9px; font-weight: 900; }
.plan-status-completed { color: #047857; }
.plan-status-started { color: #0369a1; }
.plan-status-failed { color: #b45309; }
.plan-status-pending { color: #64748b; }

.address-row { display: flex; align-items: flex-start; gap: 8px; }
.address-row i { margin-top: 3px; font-size: 12px; color: #94a3b8; }
.address-text { margin: 0; font-size: 12px; color: #64748b; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.reason-panel {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border: 1px solid #fcd34d;
}

.reason-label {
  display: block;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.5px;
  color: #92400e;
  margin-bottom: 6px;
}

.reason-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #78350f;
  font-weight: 600;
}

.finance-metrics {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px dashed #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.metric { flex: 1; }
.m-label { display: block; font-size: 8px; font-weight: 800; color: #94a3b8; margin-bottom: 2px; }
.m-value { font-size: 12px; font-weight: 700; color: #1e293b; }

.text-danger { color: #ef4444; }
.text-success { color: #10b981; }

.metric-divider { width: 1px; height: 25px; background: #e2e8f0; margin: 0 15px; }

.card-action { display: flex; align-items: center; padding-right: 15px; }
.action-next { color: #cbd5e1; font-size: 18px; }
.action-done { color: #10b981; font-size: 20px; }

/* STATES */
.state-wrapper { text-align: center; padding: 60px 20px; }
.enterprise-loader { position: relative; width: 50px; height: 50px; margin: 0 auto 20px; }
.orbit { position: absolute; width: 100%; height: 100%; border: 3px solid transparent; border-top-color: #0f172a; border-radius: 50%; animation: spin 1s linear infinite; }
.orbit:nth-child(2) { width: 70%; height: 70%; top: 15%; left: 15%; animation-duration: 0.8s; border-top-color: #334155; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.animate-slide-up { animation: slideUp 0.4s ease-out; }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

:global(:root[data-theme='dark']) .enterprise-jadwal-container {
  background: #000814 !important;
  color: #f8fafc !important;
}

:global(:root[data-theme='dark']) .glass-header {
  background:
    radial-gradient(circle at top right, rgba(45, 212, 191, 0.14), transparent 26%),
    linear-gradient(135deg, #020617 0%, #052e2b 48%, #0b1d3a 100%) !important;
  box-shadow: 0 24px 42px rgba(0, 0, 0, 0.62) !important;
}

:global(:root[data-theme='dark']) .btn-back-modern,
:global(:root[data-theme='dark']) .stat-pill,
:global(:root[data-theme='dark']) .search-container-modern {
  background: rgba(2, 6, 23, 0.72) !important;
  border-color: rgba(45, 212, 191, 0.22) !important;
  color: #f8fafc !important;
}

:global(:root[data-theme='dark']) .header-title,
:global(:root[data-theme='dark']) .outlet-name-text,
:global(:root[data-theme='dark']) .m-value,
:global(:root[data-theme='dark']) .plan-item,
:global(:root[data-theme='dark']) .plan-item-main strong,
:global(:root[data-theme='dark']) .state-wrapper h4 {
  color: #f8fafc !important;
}

:global(:root[data-theme='dark']) .header-date,
:global(:root[data-theme='dark']) .address-text,
:global(:root[data-theme='dark']) .m-label,
:global(:root[data-theme='dark']) .state-wrapper p,
:global(:root[data-theme='dark']) .address-row i,
:global(:root[data-theme='dark']) .action-next {
  color: #9fb0c7 !important;
}

:global(:root[data-theme='dark']) .search-box input {
  color: #f8fafc !important;
}

:global(:root[data-theme='dark']) .search-box input::placeholder {
  color: #8091aa !important;
}

:global(:root[data-theme='dark']) .outlet-card {
  background: linear-gradient(180deg, #030712 0%, #07111f 100%) !important;
  border-color: rgba(51, 65, 85, 0.9) !important;
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.46) !important;
}

:global(:root[data-theme='dark']) .plan-section {
  background: #020617 !important;
  border-color: #334155 !important;
}

:global(:root[data-theme='dark']) .plan-item {
  background: #0f172a !important;
  border-color: #334155 !important;
}

:global(:root[data-theme='dark']) .plan-item-completed { background: rgba(6, 78, 59, .22) !important; border-color: rgba(74, 222, 128, .32) !important; }
:global(:root[data-theme='dark']) .plan-item-failed { background: rgba(120, 53, 15, .22) !important; border-color: rgba(245, 158, 11, .3) !important; }
:global(:root[data-theme='dark']) .plan-section-header,
:global(:root[data-theme='dark']) .plan-item-meta > span:first-child { color: #94a3b8 !important; }

:global(:root[data-theme='dark']) .id-tag {
  background: rgba(20, 184, 166, 0.16) !important;
  color: #5eead4 !important;
}

:global(:root[data-theme='dark']) .reason-panel {
  background: linear-gradient(135deg, rgba(120, 53, 15, 0.22), rgba(69, 26, 3, 0.28)) !important;
  border-color: rgba(245, 158, 11, 0.28) !important;
}

:global(:root[data-theme='dark']) .reason-label {
  color: #fcd34d !important;
}

:global(:root[data-theme='dark']) .reason-text {
  color: #fde68a !important;
}

:global(:root[data-theme='dark']) .finance-metrics {
  border-top-color: rgba(51, 65, 85, 0.9) !important;
}

:global(:root[data-theme='dark']) .metric-divider {
  background: rgba(51, 65, 85, 0.9) !important;
}

:global(:root[data-theme='dark']) .orbit {
  border-top-color: #5eead4 !important;
}

:global(:root[data-theme='dark']) .orbit:nth-child(2) {
  border-top-color: #60a5fa !important;
}

:global(html[data-theme='dark']) body .enterprise-jadwal-container {
  background: #000814 !important;
}

:global(html[data-theme='dark']) body .enterprise-jadwal-container .content-area {
  background: #000814 !important;
}

:global(html[data-theme='dark']) body .enterprise-jadwal-container .outlet-grid {
  background: transparent !important;
}

:global(html[data-theme='dark']) body .enterprise-jadwal-container .outlet-card {
  background: #030712 !important;
  border-color: #1f2937 !important;
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.58) !important;
}

:global(html[data-theme='dark']) body .enterprise-jadwal-container .card-body,
:global(html[data-theme='dark']) body .enterprise-jadwal-container .card-action {
  background: #030712 !important;
}

:global(html[data-theme='dark']) body .enterprise-jadwal-container .outlet-name-text,
:global(html[data-theme='dark']) body .enterprise-jadwal-container .m-value {
  color: #f8fafc !important;
}

:global(html[data-theme='dark']) body .enterprise-jadwal-container .id-tag,
:global(html[data-theme='dark']) body .enterprise-jadwal-container .search-container-modern {
  background: #020617 !important;
  border-color: #1f2937 !important;
}

:global(html[data-theme='dark']) body .enterprise-jadwal-container .finance-metrics {
  border-top-color: #1f2937 !important;
}

:global(html[data-theme='dark']) body .enterprise-jadwal-container .reason-panel {
  background: #241506 !important;
  border-color: rgba(245, 158, 11, 0.35) !important;
}
</style>

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
          <h3 class="header-title">Jadwal Kunjungan</h3>
          <p class="header-date">{{ currentDate }}</p>
        </div>
        <div class="header-stats">
          <div class="stat-pill">
            <span class="count">{{ uniqueOutletCount }}</span>
            <span class="label">OUTLET</span>
          </div>
        </div>
      </div>

      <div class="search-container-modern">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input 
            v-model="searchQuery" 
            placeholder="Cari outlet, kode, atau principal..." 
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
        <p class="loading-text">Memuat jadwal kunjungan...</p>
      </div>

      <div v-else-if="groupedJadwal.length === 0" class="state-wrapper animate-fade-in">
        <div class="empty-illustration">
          <i class="fas fa-calendar-day"></i>
        </div>
        <h4>Jadwal Belum Tersedia</h4>
        <p>Belum ada outlet yang terjadwal untuk periode ini atau data belum tersinkron.</p>
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
              <span v-if="outlet.DistanceKm !== null && outlet.DistanceKm !== undefined" class="distance-tag">
                {{ formatDistance(outlet.DistanceKm) }}
              </span>
              <div class="outlet-plan-count">
                {{ outlet.CallPlans.length }} PLAFON
              </div>
            </div>

            <h4 class="outlet-name-text">{{ outlet.Nama?.trim() || 'Outlet Tanpa Nama' }}</h4>

            <div class="plan-section">
              <div class="plan-section-header">
                <div class="principal-heading">
                  <i class="fas fa-tags"></i>
                  <span>PRINCIPAL / PLAFON</span>
                </div>
                <span class="plan-progress">{{ outlet.CompletedPlanCount }}/{{ outlet.CallPlans.length }} selesai</span>
              </div>

              <button
                v-for="plan in outlet.CallPlans"
                :key="getKunjunganScopeKey(plan)"
                type="button"
                class="plan-item"
                :class="{
                  'plan-item-completed': isPlanFinished(plan),
                  'plan-item-failed': !!plan.AlasanFailed
                }"
                @click.stop="pilihCustomer(plan)"
              >
                <div class="plan-item-main">
                  <strong>{{ getPrincipalLabel(plan) }}</strong>
                  <span v-if="plan.KodePlafon?.trim()" class="plan-code">Plafon: {{ plan.KodePlafon.trim() }}</span>
                  <span v-if="plan.AlasanFailed" class="plan-reason">{{ plan.AlasanFailed }}</span>
                </div>
                <div class="plan-item-meta">
                  <span class="plan-metric">Sisa Rp {{ formatNumber(plan.SisaPlafon) }}</span>
                  <span class="plan-status" :class="getPlanStatusClass(plan)">{{ getStatusLabel(plan) }}</span>
                </div>
                <i :class="isPlanFinished(plan) ? 'fas fa-clipboard-check plan-action-done' : 'fas fa-chevron-right plan-action-next'"></i>
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
import Swal from 'sweetalert2';
import { getDb } from '@/services/database';
import { useConnectivityStore } from '@/stores/connectivity';
import { normalizeKunjungan } from '@/utils/apiMapper';
import { getVisitList, getVisitSchedule } from '@/services/visitService';
import { getCurrentDevicePosition } from '@/utils/location';

const router = useRouter();
const connectivity = useConnectivityStore();

const jadwal = ref([]);
const loading = ref(true);
const searchQuery = ref('');
const isOffline = ref(false);
const isInitialLoading = ref(true);
const lastSyncTime = ref('');

const currentDate = computed(() => {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date());
});

const getKodeCustomer = (item = {}) => String(item.Kode || item.kode || '').trim();
const getPlafonId = (item = {}) => String(item.IDPlafon || item.id_plafon || '').trim();
const getKunjunganScopeKey = (item = {}) => {
  const kode = getKodeCustomer(item);
  const plafonId = getPlafonId(item);
  return `${kode}::${plafonId || 'tanpa-plafon'}`;
};

const getPrincipalLabel = (item = {}) => {
  const kode = String(item.KodePrincipal || item.kode_principal || '').trim();
  const nama = String(item.NamaPrincipal || item.nama_principal || '').trim();
  const kodePlafon = String(item.KodePlafon || item.kode_plafon || '').trim();
  const plafonId = getPlafonId(item);

  if (kode && nama && kode.toLowerCase() !== nama.toLowerCase()) return `${kode} — ${nama}`;
  return nama || kode || kodePlafon || (plafonId ? `Plafon #${plafonId}` : 'Principal belum tersedia');
};

const isPlanFinished = (plan = {}) => Boolean(plan.isVisited || plan.AlasanFailed);

const getPlanStatusClass = (plan = {}) => {
  if (plan.AlasanFailed) return 'plan-status-failed';
  if (plan.isCheckOut) return 'plan-status-completed';
  if (plan.isVisited) return 'plan-status-started';
  return 'plan-status-pending';
};

const getOutletGroupKey = (item = {}) => {
  const kode = getKodeCustomer(item);
  if (kode) return `kode:${kode}`;

  const nama = String(item.Nama || item.nama || '').trim().toLowerCase();
  const alamat = String(item.Alamat || item.alamat || '').trim().toLowerCase();
  return `outlet:${nama}::${alamat}`;
};

const groupJadwalByOutlet = (items = []) => {
  const groups = new Map();

  for (const item of items) {
    const outletKey = getOutletGroupKey(item);
    const scopeKey = getKunjunganScopeKey(item);
    let group = groups.get(outletKey);

    if (!group) {
      group = {
        ...item,
        OutletKey: outletKey,
        CallPlans: [],
        _planKeys: new Set()
      };
      groups.set(outletKey, group);
    }

    // Satu plafon hanya boleh ditampilkan sekali di dalam satu kartu outlet,
    // meskipun API mengirim ulang data yang sama dari cache/jadwal.
    if (!group._planKeys.has(scopeKey)) {
      group._planKeys.add(scopeKey);
      group.CallPlans.push(item);
    }
  }

  return Array.from(groups.values()).map((group) => {
    const plans = group.CallPlans;
    const completedPlanCount = plans.filter(isPlanFinished).length;

    return {
      ...group,
      CompletedPlanCount: completedPlanCount,
      AllPlansFinished: plans.length > 0 && completedPlanCount === plans.length,
      HasFailedPlan: plans.some((plan) => Boolean(plan.AlasanFailed))
    };
  });
};

const getOutletIndicatorClass = (outlet = {}) => {
  if (outlet.HasFailedPlan) return 'bg-failed';
  if (outlet.AllPlansFinished) return 'bg-visited';
  return 'bg-pending';
};

const mapSQLiteRowToView = (t = {}) => ({
  Kode: String(t.kode || '').trim(),
  Nama: String(t.nama || 'Tanpa Nama').trim(),
  Alamat: String(t.alamat || '').trim(),
  Kota: String(t.kota || '').trim(),
  Telpon: String(t.telpon || '').trim(),
  Latitude: t.latitude || '0',
  Longitude: t.longitude || '0',
  IDPlafon: t.id_plafon || null,
  KodePlafon: t.kode_plafon || '',
  KodePrincipal: t.kode_principal || '',
  NamaPrincipal: t.nama_principal || '',
  IDKunjungan: t.id_kunjungan || null,
  isVisited: Number(t.is_visited) === 1,
  isCheckOut: Number(t.is_checkout) === 1,
  TotalPiutang: Number(t.total_piutang) || 0,
  SisaPlafon: Number(t.sisa_plafon) || 0,
  QRCode: t.qrcode || '',
  AlasanFailed: t.alasan || ''
});

const parseCoordinate = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const calculateDistanceKm = (fromLat, fromLng, toLat, toLng) => {
  const lat1 = parseCoordinate(fromLat);
  const lng1 = parseCoordinate(fromLng);
  const lat2 = parseCoordinate(toLat);
  const lng2 = parseCoordinate(toLng);
  if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) return null;
  if (lat2 === 0 && lng2 === 0) return null;

  const radiusKm = 6371;
  const toRad = (degree) => degree * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const sortByNearest = (rows = [], locationParams = {}) => {
  const originLat = parseCoordinate(locationParams.lat);
  const originLng = parseCoordinate(locationParams.lng);
  if (originLat === null || originLng === null) return rows;

  return [...rows]
    .map((item, index) => {
      const distance = calculateDistanceKm(originLat, originLng, item.Latitude, item.Longitude);
      return {
        item: {
          ...item,
          DistanceKm: distance === null ? null : Number(distance.toFixed(3)),
          distance_km: distance === null ? null : Number(distance.toFixed(3))
        },
        distance,
        index
      };
    })
    .sort((a, b) => {
      if (a.distance === null && b.distance === null) return a.index - b.index;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance || a.index - b.index;
    })
    .map((entry) => entry.item);
};

const getVisitLocationParams = async () => {
  try {
    const position = await getCurrentDevicePosition({
      enableHighAccuracy: true,
      timeout: 6000,
      maximumAge: 60000
    });
    const lat = position?.coords?.latitude;
    const lng = position?.coords?.longitude;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  } catch (_) {
    // GPS optional untuk sorting; jika gagal, daftar tetap mengikuti urutan lama.
  }
  return {};
};

const loadJadwalFromSQLite = async (showOfflineToast = false, locationParams = {}) => {
  const db = getDb();
  if (!db) {
    jadwal.value = [];
    return;
  }

  const res = await db.query('SELECT * FROM kunjungan_toko ORDER BY nama ASC');
  const rows = res.values || [];
  jadwal.value = sortByNearest(rows.map(mapSQLiteRowToView), locationParams);

  if (showOfflineToast && rows.length > 0) {
    await Swal.fire({
      icon: 'warning',
      title: 'Mode Offline',
      text: 'Menampilkan jadwal dari database lokal.',
      timer: 1800,
      showConfirmButton: false
    });
  }
};

const mergeServerData = (rawJadwal = [], rawSudahKunjung = [], localRows = []) => {
  const listJadwal = rawJadwal.map(normalizeKunjungan);
  const listSudahKunjung = rawSudahKunjung.map(normalizeKunjungan);

  const sourceList = listJadwal.length > 0 ? listJadwal : listSudahKunjung;

  const visitedMap = new Map();
  for (const item of listSudahKunjung) {
    const scopeKey = getKunjunganScopeKey(item);
    if (getKodeCustomer(item)) visitedMap.set(scopeKey, item);
  }

  const localMap = new Map(
    localRows.map((row) => [getKunjunganScopeKey(row), row])
  );

  return sourceList.map((item) => {
    const scopeKey = getKunjunganScopeKey(item);
    const infoKunjungan = visitedMap.get(scopeKey);
    const local = localMap.get(scopeKey);

    const localVisited = Number(local?.is_visited) === 1;
    const localCheckout = Number(local?.is_checkout) === 1;
    const localId = local?.id_kunjungan || null;
    const localAlasan = local?.alasan || '';

    return normalizeKunjungan({
      ...item,
      isVisited: Boolean(infoKunjungan?.isVisited) || Boolean(item.isVisited) || localVisited,
      isCheckOut: Boolean(infoKunjungan?.isCheckOut) || Boolean(item.isCheckOut) || localCheckout,
      IDKunjungan: infoKunjungan?.IDKunjungan || item.IDKunjungan || localId,
      TotalPiutang: infoKunjungan?.TotalPiutang ?? item.TotalPiutang ?? local?.total_piutang ?? 0,
      SisaPlafon: infoKunjungan?.SisaPlafon ?? item.SisaPlafon ?? local?.sisa_plafon ?? 0,
      AlasanFailed: infoKunjungan?.AlasanFailed || item.AlasanFailed || localAlasan || ''
    });
  });
};

const syncJadwalToSQLite = async (data = []) => {
  const db = getDb();
  if (!db || data.length === 0) return;

  for (const toko of data) {
    const kode = getKodeCustomer(toko);
    const plafonId = getPlafonId(toko);
    if (!kode) continue;

    const existing = await db.query(
      `SELECT is_visited, is_checkout, id_kunjungan, alasan
       FROM kunjungan_toko
       WHERE kode = ? AND id_plafon = ?
       LIMIT 1`,
      [kode, plafonId]
    );

    const row = existing.values?.[0];
    const finalVisited = row ? Number(row.is_visited) === 1 || !!toko.isVisited : !!toko.isVisited;
    const finalCheckout = row ? Number(row.is_checkout) === 1 || !!toko.isCheckOut : !!toko.isCheckOut;
    const finalId = row?.id_kunjungan || toko.IDKunjungan || null;
    const finalAlasan = row?.alasan || toko.AlasanFailed || '';

    await db.run(
      `INSERT OR REPLACE INTO kunjungan_toko
      (kode, nama, alamat, kota, telpon, latitude, longitude, id_plafon, kode_plafon, kode_principal, nama_principal, id_kunjungan, is_visited, is_checkout, total_piutang, sisa_plafon, qrcode, alasan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        kode,
        String(toko.Nama || '').trim(),
        toko.Alamat || '',
        toko.Kota || '',
        toko.Telpon || '',
        toko.Latitude || '0',
        toko.Longitude || '0',
        plafonId,
        toko.KodePlafon || toko.kode_plafon || '',
        toko.KodePrincipal || toko.kode_principal || '',
        toko.NamaPrincipal || toko.nama_principal || '',
        finalId,
        finalVisited ? 1 : 0,
        finalCheckout ? 1 : 0,
        Number(toko.TotalPiutang) || 0,
        Number(toko.SisaPlafon) || 0,
        toko.QRCode || '',
        finalAlasan
      ]
    );
  }

  // Cache versi lama hanya memiliki key customer. Setelah jadwal server yang
  // sudah memiliki plafon diterima, hapus cache lama agar tidak tampil ganda.
  if (data.some((toko) => !!getPlafonId(toko))) {
    await db.execute(`DELETE FROM kunjungan_toko WHERE COALESCE(TRIM(id_plafon), '') = ''`);
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

    const locationParams = await getVisitLocationParams();
    const [rawJadwal, rawDaftar] = await Promise.all([
      getVisitSchedule(locationParams),
      getVisitList(locationParams)
    ]);

    isOffline.value = false;

    const db = getDb();
    let localRows = [];
    if (db) {
      try {
        const localRes = await db.query('SELECT * FROM kunjungan_toko');
        localRows = localRes.values || [];
      } catch (e) {
        localRows = [];
      }
    }

    const enrichedData = sortByNearest(mergeServerData(rawJadwal, rawDaftar, localRows), locationParams);
    jadwal.value = enrichedData;

    await syncJadwalToSQLite(enrichedData);

    console.log('✅ JadwalKunjungan:', {
      jadwal: rawJadwal.length,
      daftar: rawDaftar.length,
      tampil: enrichedData.length
    });
  } catch (error) {
    console.error('⚠️ Koneksi terputus, mengambil dari SQLite...', error);
    isOffline.value = true;
    const locationParams = await getVisitLocationParams();
    await loadJadwalFromSQLite(true, locationParams);
  } finally {
    loading.value = false;
    isInitialLoading.value = false;
  }
};

const filteredJadwal = computed(() => {
  const list = jadwal.value || [];
  const q = searchQuery.value.trim().toLowerCase();

  if (!q) return list;

  return list.filter((item) => {
    const nama = String(item.Nama || '').toLowerCase();
    const kode = String(item.Kode || '').toLowerCase();
    const alamat = String(item.Alamat || '').toLowerCase();
    const principal = getPrincipalLabel(item).toLowerCase();

    return nama.includes(q) || kode.includes(q) || alamat.includes(q) || principal.includes(q);
  });
});

const groupedJadwal = computed(() => groupJadwalByOutlet(filteredJadwal.value));

const uniqueOutletCount = computed(() => {
  return groupedJadwal.value.length;
});

const formatNumber = (value) => {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('id-ID').format(Math.floor(num));
};

const formatDistance = (value) => {
  const km = Number(value);
  if (!Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`;
};

const getStatusLabel = (item) => {
  if (item?.AlasanFailed) return 'Tidak Ada Transaksi';
  if (item?.isCheckOut) return 'Kunjungan Selesai';
  if (item?.isVisited) return 'Sudah Dikunjungi';
  return 'Belum Dikunjungi';
};

const getActiveVisitFromSQLite = async () => {
  const db = getDb();
  if (!db) return null;

  const res = await db.query(
    `SELECT * FROM kunjungan_toko
    WHERE is_visited = 1 AND is_checkout = 0
    ORDER BY updated_at_local DESC, id_kunjungan DESC
    LIMIT 1`
  );

  if (!res.values?.length) return null;
  return mapSQLiteRowToView(res.values[0]);
};

const pilihCustomer = async (customer) => {
  const kodeClean = String(customer.Kode || '').trim();
  const namaClean = String(customer.Nama || '').trim();
  const alamatClean = String(customer.Alamat || '').trim();
  const plafonId = getPlafonId(customer);

  if (!kodeClean || !plafonId) {
    await Swal.fire({
      icon: 'warning',
      title: 'Jadwal Belum Lengkap',
      text: 'Konteks plafon belum tersedia. Silakan muat ulang jadwal saat koneksi aktif.',
      confirmButtonColor: '#1a1a3d'
    });
    return;
  }

  if (customer.isVisited || customer.AlasanFailed) {
    const statusMsg = customer.isCheckOut
      ? 'Kunjungan telah selesai (Checked Out).'
      : 'Anda sudah melakukan Check-In di toko ini.';

    await Swal.fire({
      icon: 'info',
      title: 'Outlet Terverifikasi',
      text: statusMsg,
      confirmButtonColor: '#1a1a3d',
      timer: 2200
    });
    return;
  }

  const kunjunganAktif = await getActiveVisitFromSQLite();

  if (kunjunganAktif) {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Kunjungan Aktif Terdeteksi',
      html: `Anda masih memiliki kunjungan aktif di:<br><b>${kunjunganAktif.Nama}</b><br><br>Selesaikan kunjungan tersebut sebelum memulai yang baru.`,
      showCancelButton: true,
      confirmButtonColor: '#1a1a3d',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Lanjut Kunjungan Aktif',
      cancelButtonText: 'Tutup',
      reverseButtons: true
    });

    if (result.isConfirmed) {
      router.push({
        path: '/kunjungan-aktif',
        query: {
          id: kunjunganAktif.IDKunjungan,
          kode: kunjunganAktif.Kode,
          kode_customer: kunjunganAktif.Kode,
          nama_toko: kunjunganAktif.Nama,
          id_plafon: getPlafonId(kunjunganAktif)
        }
      });
    }

    return;
  }

  router.push({
    path: '/checkin-konfirmasi',
    query: {
      kode: kodeClean,
      nama: namaClean,
      alamat: alamatClean,
      id_jadwal: customer.IDJadwal || '',
      id_plafon: plafonId
    }
  });
};

watch(
  () => connectivity.isOnline,
  async (online, oldOnline) => {
    if (online !== oldOnline) {
      await fetchJadwal();
    }
  }
);

onMounted(async () => {
  await fetchJadwal();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
</script>

<style scoped>
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css');

.enterprise-jadwal-container {
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 28%),
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
    linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
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

.stat-pill .count { font-size: 16px; font-weight: 800; }
.stat-pill .label { font-size: 8px; font-weight: 700; opacity: 0.8; }
.stat-pill .call-plan-count { margin-top: 2px; font-size: 7px; font-weight: 800; letter-spacing: 0.35px; color: rgba(255,255,255,0.8); white-space: nowrap; }

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

.id-tag { font-size: 10px; font-weight: 800; color: #2563eb; background: #eff6ff; padding: 3px 9px; border-radius: 999px; }
.distance-tag {
  margin-left: auto;
  font-size: 10px;
  font-weight: 800;
  color: #047857;
  background: #d1fae5;
  padding: 3px 9px;
  border-radius: 999px;
}

.outlet-name-text { margin: 0 0 6px; font-size: 16px; font-weight: 800; color: #0f172a; }

.outlet-plan-count {
  margin-left: 8px;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.45px;
  color: #6d28d9;
  background: #f3e8ff;
  padding: 4px 8px;
  border-radius: 999px;
}

.plan-section {
  margin: 12px 0;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #f8fafc;
}

.plan-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.principal-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.45px;
  color: #64748b;
}

.principal-heading i { color: #7c3aed; font-size: 12px; }

.plan-progress {
  font-size: 9px;
  font-weight: 800;
  color: #475569;
  white-space: nowrap;
}

.plan-item {
  width: 100%;
  appearance: none;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  color: #0f172a;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 16px;
  align-items: center;
  gap: 10px;
  text-align: left;
  padding: 10px;
  cursor: pointer;
}

.plan-item + .plan-item { margin-top: 8px; }
.plan-item:active { transform: scale(0.99); }
.plan-item-completed { border-color: #a7f3d0; background: #f0fdf4; }
.plan-item-failed { border-color: #fde68a; background: #fffbeb; }

.plan-item-main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.plan-item-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: #4c1d95; }
.plan-code { font-size: 9px; font-weight: 700; color: #64748b; }
.plan-reason { font-size: 9px; line-height: 1.3; color: #92400e; }

.plan-item-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.plan-metric { font-size: 9px; font-weight: 800; color: #047857; white-space: nowrap; }
.plan-status { font-size: 8px; font-weight: 900; white-space: nowrap; }
.plan-status-pending { color: #64748b; }
.plan-status-started { color: #2563eb; }
.plan-status-completed { color: #047857; }
.plan-status-failed { color: #b45309; }
.plan-action-next { color: #94a3b8; font-size: 14px; }
.plan-action-done { color: #10b981; font-size: 15px; }

.address-row { display: flex; align-items: flex-start; gap: 8px; }
.address-row i { margin-top: 3px; font-size: 12px; color: #94a3b8; }
.address-text { margin: 0; font-size: 12px; color: #64748b; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

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
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.16), transparent 26%),
    linear-gradient(135deg, #020617 0%, #07111f 48%, #0b1d3a 100%) !important;
  box-shadow: 0 24px 42px rgba(0, 0, 0, 0.62) !important;
}

:global(:root[data-theme='dark']) .btn-back-modern,
:global(:root[data-theme='dark']) .stat-pill,
:global(:root[data-theme='dark']) .search-container-modern {
  background: rgba(2, 6, 23, 0.72) !important;
  border-color: rgba(96, 165, 250, 0.22) !important;
  color: #f8fafc !important;
}

:global(:root[data-theme='dark']) .header-title,
:global(:root[data-theme='dark']) .outlet-name-text,
:global(:root[data-theme='dark']) .state-wrapper h4 {
  color: #f8fafc !important;
}

:global(:root[data-theme='dark']) .header-date,
:global(:root[data-theme='dark']) .address-text,
:global(:root[data-theme='dark']) .state-wrapper p,
:global(:root[data-theme='dark']) .address-row i {
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

:global(:root[data-theme='dark']) .id-tag {
  background: rgba(37, 99, 235, 0.18) !important;
  color: #93c5fd !important;
}

:global(:root[data-theme='dark']) .principal-heading i {
  color: #c4b5fd !important;
}

:global(:root[data-theme='dark']) .principal-heading,
:global(:root[data-theme='dark']) .plan-progress,
:global(:root[data-theme='dark']) .plan-code {
  color: #9fb0c7 !important;
}

:global(:root[data-theme='dark']) .outlet-plan-count {
  background: rgba(124, 58, 237, 0.2) !important;
  color: #ddd6fe !important;
}

:global(:root[data-theme='dark']) .plan-section {
  background: #020617 !important;
  border-top-color: rgba(51, 65, 85, 0.9) !important;
}

:global(:root[data-theme='dark']) .plan-item {
  background: #07111f !important;
  border-color: rgba(51, 65, 85, 0.9) !important;
  color: #f8fafc !important;
}

:global(:root[data-theme='dark']) .plan-item-completed {
  background: rgba(6, 78, 59, 0.22) !important;
  border-color: rgba(16, 185, 129, 0.35) !important;
}

:global(:root[data-theme='dark']) .plan-item-failed {
  background: rgba(120, 53, 15, 0.22) !important;
  border-color: rgba(245, 158, 11, 0.3) !important;
}

:global(:root[data-theme='dark']) .plan-item-main strong {
  color: #ddd6fe !important;
}

:global(:root[data-theme='dark']) .plan-metric {
  color: #6ee7b7 !important;
}

:global(:root[data-theme='dark']) .orbit {
  border-top-color: #60a5fa !important;
}

:global(:root[data-theme='dark']) .orbit:nth-child(2) {
  border-top-color: #22c55e !important;
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
:global(html[data-theme='dark']) body .enterprise-jadwal-container .plan-item-main strong {
  color: #f8fafc !important;
}

:global(html[data-theme='dark']) body .enterprise-jadwal-container .id-tag,
:global(html[data-theme='dark']) body .enterprise-jadwal-container .search-container-modern {
  background: #020617 !important;
  border-color: #1f2937 !important;
}

:global(html[data-theme='dark']) body .enterprise-jadwal-container .plan-section,
:global(html[data-theme='dark']) body .enterprise-jadwal-container .plan-item {
  background: #020617 !important;
  border-color: #1f2937 !important;
}
</style>

<template>
  <div class="checkin-container">
    <header class="header-enterprise">
      <button @click="router.back()" class="btn-back" aria-label="Kembali">
        <font-awesome-icon icon="chevron-left" />
      </button>
      <div class="header-content">
        <h3 class="title">{{ isViewMode ? 'Detail Kunjungan' : 'Konfirmasi Check-In' }}</h3>
        <p class="subtitle">
          {{ isViewMode
            ? 'Ringkasan aktivitas outlet, histori nota, dan catatan kunjungan'
            : 'Validasi outlet, koordinat GPS, dan kesiapan sesi lapangan sebelum memulai kunjungan' }}
        </p>
      </div>
    </header>

    <div class="content-wrapper animate-up" :class="{ 'content-wrapper-checkin': !isViewMode }">
      <section class="hero-panel">
        <div class="hero-copy">
          <span class="hero-eyebrow">{{ isViewMode ? 'KUNJUNGAN TERSIMPAN' : 'SESI CHECK-IN' }}</span>
          <h4 class="hero-title">{{ displayOutletName }}</h4>
          <p class="hero-subtitle">{{ displayAddress }}</p>
        </div>

        <div class="hero-state" :class="isViewMode ? (alasanHistory ? 'state-warning' : 'state-success') : locationStateClass">
          <span class="state-pill-label">{{ isViewMode ? 'Status Kunjungan' : 'Status GPS' }}</span>
          <strong>{{ isViewMode ? viewModeStatusLabel : locationStateLabel }}</strong>
          <small>{{ isViewMode ? viewModeStatusHint : locationHint }}</small>
        </div>
      </section>

      <div class="action-section">
        <div v-if="isViewMode" class="view-mode-wrapper animate-up">
          <div class="status-banner" :class="alasanHistory ? 'banner-failed' : 'banner-success'">
            <span class="icon-status">{{ alasanHistory ? '!' : 'OK' }}</span>
            <div class="text">
              <label>Status Kunjungan</label>
              <strong>{{ alasanHistory ? 'FAILED / TIDAK ADA TRANSAKSI' : 'VISITED / SELESAI' }}</strong>
            </div>
          </div>

          <div v-if="viewLoading" class="location-status">
            <div class="custom-loader-small"></div>
            <p>Memuat detail kunjungan...</p>
          </div>

          <template v-else>
            <div v-if="!alasanHistory" class="history-card-section">
              <h5 class="section-label">NOTA HARI INI</h5>

              <div v-if="listNota.length > 0" class="nota-list">
                <div v-for="nota in listNota" :key="getNotaKey(nota)" class="nota-item">
                  <div class="nota-info">
                    <span class="nota-no">{{ getNotaNumber(nota) }}</span>
                    <small>{{ getNotaDate(nota) }}</small>
                  </div>
                  <div class="nota-amount">Rp {{ formatNumber(getNotaTotal(nota)) }}</div>
                </div>
              </div>

              <div v-else class="nota-empty">
                <p>Kunjungan rutin tanpa transaksi nota pada hari ini.</p>
              </div>
            </div>

            <div v-if="alasanHistory" class="reason-history-box">
              <label>Keterangan Alasan</label>
              <p>{{ alasanHistory }}</p>
            </div>
          </template>

          <div class="menu-grid">
            <button @click="openVisitHistoryHub" class="menu-item">
              <div class="menu-icon blue"><font-awesome-icon icon="history" /></div>
              <div class="menu-text">
                <span>Histori Outlet</span>
                <small>Order, retur, invoice, dan pembayaran outlet.</small>
              </div>
            </button>

            <button @click="openInvoiceHistory" class="menu-item">
              <div class="menu-icon orange"><font-awesome-icon icon="file-invoice" /></div>
              <div class="menu-text">
                <span>Invoice Outlet</span>
                <small>Cek tagihan dan detail nota dari outlet ini.</small>
              </div>
            </button>
          </div>

          <button @click="router.back()" class="btn-back-only">
            <font-awesome-icon icon="chevron-left" />
            <span>Kembali ke Jadwal</span>
          </button>
        </div>

        <div v-else class="checkin-mode-wrapper">
          <section class="readiness-card readiness-card-compact">
            <div class="readiness-head readiness-head-compact">
              <div>
                <span class="section-kicker">Kesiapan Lapangan</span>
                <h5>Siap mulai kunjungan</h5>
              </div>
              <span class="readiness-badge" :class="locationStateClass">{{ locationStateLabel }}</span>
            </div>

            <div class="readiness-mini-grid">
              <div class="readiness-mini" :class="coords.lat && coords.lng ? 'done' : 'pending'">
                <span class="mini-index">1</span>
                <div>
                  <strong>GPS</strong>
                  <p>{{ coords.lat && coords.lng ? 'Terdeteksi' : 'Menunggu lokasi' }}</p>
                </div>
              </div>
              <div class="readiness-mini done">
                <span class="mini-index">2</span>
                <div>
                  <strong>Outlet</strong>
                  <p>{{ displayCustomerCode }}</p>
                </div>
              </div>
              <div class="readiness-mini done">
                <span class="mini-index">3</span>
                <div>
                  <strong>Payload</strong>
                  <p>Siap kirim</p>
                </div>
              </div>
            </div>
          </section>

          <section class="action-callout action-callout-compact">
            <div class="action-copy">
              <span class="section-kicker">Aksi Utama</span>
              <h5>Mulai kunjungan outlet ini</h5>
              <p>Masuk ke sesi aktif untuk stok opname, transaksi, alasan no order, dan checkout.</p>
            </div>

            <div class="inline-status" :class="locationStateClass">
              <span class="inline-status-icon">
                {{ gettingLocation ? '...' : coords.lat && coords.lng ? 'OK' : '!' }}
              </span>
              <div class="inline-status-copy">
                <strong>{{ locationStateLabel }}</strong>
                <small>{{ gettingLocation ? 'Sinkronisasi GPS dan validasi koordinat...' : coords.lat && coords.lng ? `Koordinat aktif ${coordinateLabel}` : 'Koordinat belum tersedia. Aktifkan GPS lalu tunggu posisi terbaca.' }}</small>
              </div>
            </div>

            <button
              @click="prosesCheckIn"
              :disabled="loadingCheckIn || gettingLocation"
              class="btn-confirm"
            >
              <span v-if="loadingCheckIn" class="spinner-white"></span>
              {{ loadingCheckIn ? 'Mengirim Data...' : 'Mulai Kunjungan' }}
            </button>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api/axios';
import Swal from 'sweetalert2';
import { getDb } from '@/services/database';
import { useConnectivityStore } from '@/stores/connectivity';
import {
  findActiveVisitFromServer,
  findVisitByKode,
  getVisitInvoices,
  startVisit
} from '@/services/visitService';
import { getCurrentDevicePosition, getLocationErrorMessage } from '@/utils/location';

const route = useRoute();
const router = useRouter();
const connectivity = useConnectivityStore();

const loadingCheckIn = ref(false);
const gettingLocation = ref(true);
const viewLoading = ref(false);
const coords = ref({ lat: null, lng: null });
const alasanHistory = ref('');
const listNota = ref([]);
const activeVisit = ref(null);

const isViewMode = computed(() => route.query.mode === 'view');
const displayOutletName = computed(() => getNamaToko() || '-');
const displayAddress = computed(() => String(route.query.alamat || route.query.address || 'Alamat outlet belum tersedia.').trim());
const displayCustomerCode = computed(() => getKodeToko() || '-');
const displayPlafonId = computed(() => String(route.query.id_plafon || route.query.IDPlafon || getKodeToko() || '-').trim());
const coordinateLabel = computed(() => {
  if (!coords.value.lat || !coords.value.lng) return 'Belum terbaca';
  return `${coords.value.lat.toFixed(5)}, ${coords.value.lng.toFixed(5)}`;
});
const locationStateLabel = computed(() => {
  if (gettingLocation.value) return 'Membaca GPS';
  if (coords.value.lat && coords.value.lng) return 'Siap Check-In';
  return 'Menunggu Lokasi';
});
const locationStateClass = computed(() => {
  if (gettingLocation.value) return 'state-info';
  if (coords.value.lat && coords.value.lng) return 'state-success';
  return 'state-muted';
});
const locationHint = computed(() => {
  if (gettingLocation.value) return 'Perangkat sedang membaca lokasi terbaru dari GPS.';
  if (coords.value.lat && coords.value.lng) return 'Lokasi sudah valid dan siap dipakai untuk memulai kunjungan.';
  return 'GPS belum berhasil memberikan koordinat. Cek izin lokasi atau coba lagi.';
});
const coordinateHint = computed(() => {
  if (!coords.value.lat || !coords.value.lng) return 'Koordinat akan muncul otomatis setelah GPS terbaca.';
  return 'Koordinat ini akan dikirim bersama sesi check-in ke backend.';
});
const viewModeStatusLabel = computed(() => (alasanHistory.value ? 'No Order / Failed' : 'Visited / Completed'));
const viewModeStatusHint = computed(() =>
  alasanHistory.value
    ? 'Ada catatan alasan atau tidak ada transaksi pada kunjungan ini.'
    : 'Kunjungan selesai dan outlet sudah tercatat pernah dikunjungi.'
);

const formatNumber = (num) => new Intl.NumberFormat('id-ID').format(num || 0);

const getNotaNumber = (nota = {}) =>
  nota.NoNota ||
  nota.Nota ||
  nota.no_nota ||
  nota.no_faktur ||
  '-';

const getNotaDate = (nota = {}) =>
  nota.Tanggal ||
  nota.tanggal ||
  '-';

const getNotaTotal = (nota = {}) =>
  Number(
    nota.TotalPenjualan ??
    nota.Total ??
    nota.total ??
    nota.nominal ??
    0
  );

const getNotaKey = (nota = {}) =>
  `${getNotaNumber(nota)}-${getNotaDate(nota)}`;

const normalizeKunjungan = (item = {}) => {
  const kode = String(
    item.Kode ||
    item.kode_customer ||
    item.id_plafon ||
    item.IDPlafon ||
    ''
  ).trim();

  const status = Number(item.status ?? 0);

  return {
    ...item,
    Kode: kode,
    Nama: String(item.Nama || item.nama_customer || 'Toko Tanpa Nama').trim(),
    Alamat: String(item.Alamat || item.alamat || 'Alamat tidak tersedia').trim(),
    IDKunjungan: item.IDKunjungan || item.id_kunjungan || item.id || null,
    IDJadwal: item.IDJadwal || item.id_jadwal || null,
    IDPlafon: item.IDPlafon || item.id_plafon || kode || null,
    CheckOut:
      item.CheckOut !== undefined && item.CheckOut !== null
        ? item.CheckOut
        : status === 2
          ? 1
          : status === 1
            ? 0
            : null,
    Alasan: item.Alasan || item.alasan || null,
    Tanggal: item.Tanggal || item.tanggal || null,
    TotalPiutang: item.TotalPiutang || item.total_piutang || 0,
    SisaPlafon: item.SisaPlafon || item.sisa_plafon || 0,
    Kota: item.Kota || item.kota || '',
    Telpon: item.Telpon || item.telpon || '',
    Latitude: item.Latitude || item.latitude || '0',
    Longitude: item.Longitude || item.longitude || '0',
    QRCode: item.QRCode || item.qrcode || ''
  };
};

const getKodeToko = () => {
  return String(
    route.query.kode ||
    route.query.kode_customer ||
    ''
  ).trim();
};

const getPlafonId = () => String(
  route.query.id_plafon || route.query.IDPlafon || ''
).trim();

const getNamaToko = () => {
  return String(route.query.nama || route.query.nama_customer || '').trim();
};

const isLikelyOfflineError = (error) => {
  return (
    error?.isOffline ||
    error?.isNetworkError ||
    !connectivity.isOnline ||
    !error?.response ||
    error?.message?.includes('Network Error') ||
    error?.message?.includes('timeout') ||
    error?.code === 'ECONNABORTED'
  );
};

const syncStok = async (db) => {
  if (!db) return;

  try {
    const resStok = await api.get('/api/stok/all');
    const stokList = Array.isArray(resStok.data)
      ? resStok.data
      : resStok.data?.data || resStok.data?.items || [];

    await db.run('DELETE FROM stok_master');

    for (const item of stokList) {
      await db.run(
        `
        INSERT OR REPLACE INTO stok_master
        (kode, nama, satuan, nama_unit, nama_brand, harga, suggestion, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          String(item.Kode || item.kode || '').trim(),
          String(item.Nama || item.nama || item.nama_barang || '').trim(),
          String(item.Satuan || item.satuan || '').trim(),
          String(item.NamaUnit || item.nama_unit || '').trim(),
          String(item.NamaBrand || item.nama_brand || item.brand || '').trim(),
          Number(item.HargaE || item.harga || 0),
          Number(item.Suggestion || item.suggestion || 0),
          new Date().toISOString()
        ]
      );
    }
  } catch (e) {
    console.error('Dashboard: Gagal sync stok ke SQLite', e);
  }
};

const safeUpdateKunjunganToko = async (db, kode, idPlafon, values) => {
  if (!db || !kode || !idPlafon) return;

  try {
    await db.run(
      `
      UPDATE kunjungan_toko
      SET is_visited = ?,
          is_checkout = ?,
          id_kunjungan = ?,
          alasan = ?,
          local_modified = ?,
          updated_at_local = ?
      WHERE kode = ? AND id_plafon = ?
      `,
      [
        values.is_visited ?? 0,
        values.is_checkout ?? 0,
        values.id_kunjungan ?? null,
        values.alasan ?? null,
        values.local_modified ?? 0,
        values.updated_at_local ?? null,
        kode,
        idPlafon
      ]
    );
  } catch (_) {
    await db.run(
      `
      UPDATE kunjungan_toko
      SET is_visited = ?,
          is_checkout = ?,
          id_kunjungan = ?,
          alasan = ?
      WHERE kode = ? AND id_plafon = ?
      `,
      [
        values.is_visited ?? 0,
        values.is_checkout ?? 0,
        values.id_kunjungan ?? null,
        values.alasan ?? null,
        kode,
        idPlafon
      ]
    );
  }
};

const openVisitHistoryHub = () => {
  router.push({
    path: '/visit-history',
    query: {
      kode_customer: getKodeToko(),
      nama_toko: getNamaToko(),
      id_kunjungan: route.query.id_kunjungan || route.query.id || '',
      id_plafon: getPlafonId()
    }
  });
};

const openInvoiceHistory = () => {
  router.push({
    path: '/tagihan-customer',
    query: {
      kode_customer: getKodeToko(),
      nama_toko: getNamaToko(),
      id_kunjungan: route.query.id_kunjungan || route.query.id || '',
      id_plafon: getPlafonId()
    }
  });
};

const getLocation = async () => {
  gettingLocation.value = true;

  try {
    const position = await getCurrentDevicePosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    });

    coords.value.lat = position.coords.latitude;
    coords.value.lng = position.coords.longitude;
  } catch (error) {
    console.error('GPS Error:', error);
    Swal.fire({
      title: 'GPS Belum Terbaca',
      text: getLocationErrorMessage(error),
      icon: 'warning',
      confirmButtonColor: '#1a1a3d'
    });
  } finally {
    gettingLocation.value = false;
  }
};

const fetchDetailKunjungan = async () => {
  viewLoading.value = true;
  alasanHistory.value = '';
  listNota.value = [];

  const kodeToko = getKodeToko();
  const plafonId = getPlafonId();

  try {
    const db = getDb();

    if (db && kodeToko) {
      const local = await db.query(
        'SELECT alasan FROM kunjungan_toko WHERE kode = ? AND id_plafon = ? LIMIT 1',
        [kodeToko, plafonId]
      );

      if (local.values?.length > 0) {
        alasanHistory.value = local.values[0].alasan || '';
      }
    }

    const kunjungan = await findVisitByKode(kodeToko, plafonId);

    if (kunjungan) {
      alasanHistory.value = kunjungan.Alasan || alasanHistory.value || '';

      const idKunjungan = kunjungan.IDKunjungan;

      if (idKunjungan) {
        try {
          listNota.value = await getVisitInvoices({
            id_kunjungan: idKunjungan,
            kode: kodeToko,
            kode_customer: kodeToko,
            id_plafon: plafonId
          });
        } catch (notaErr) {
          console.warn('Gagal memuat nota kunjungan:', notaErr?.message || notaErr);
          listNota.value = [];
        }
      }
    }
  } catch (error) {
    console.warn('Detail kunjungan memakai fallback lokal:', error?.message || error);
  } finally {
    viewLoading.value = false;
  }
};

const checkCurrentStatus = async () => {
  const db = getDb();

  try {
    if (db) {
      const localCheck = await db.query(
        `
        SELECT * FROM kunjungan_toko
        WHERE is_visited = 1 AND is_checkout = 0
        LIMIT 1
        `
      );

      if (localCheck.values?.length > 0) {
        const local = localCheck.values[0];

        activeVisit.value = {
          ...local,
          Kode: local.kode,
          Nama: local.nama,
          Alamat: local.alamat,
          IDKunjungan: local.id_kunjungan
        };

        router.push({
          path: '/kunjungan-aktif',
          query: {
            id: local.id_kunjungan || '',
            kode_customer: local.kode || '',
            nama_toko: local.nama || '',
            id_plafon: local.id_plafon || ''
          }
        });
        return true;
      }
    }

    const aktif = await findActiveVisitFromServer();

    if (aktif) {
      activeVisit.value = {
        ID: aktif.IDKunjungan,
        Kode: aktif.Kode || '-',
        Nama: aktif.Nama || 'Toko Tanpa Nama',
        Alamat: aktif.Alamat || 'Alamat tidak tersedia',
        Tanggal: aktif.Tanggal,
        Alasan: aktif.Alasan || null
      };

      if (db && aktif.Kode) {
        await safeUpdateKunjunganToko(db, aktif.Kode, String(aktif.IDPlafon || aktif.id_plafon || '').trim(), {
          is_visited: 1,
          is_checkout: 0,
          id_kunjungan: aktif.IDKunjungan,
          alasan: aktif.Alasan || null,
          local_modified: 0,
          updated_at_local: new Date().toISOString()
        });
      }

      await Swal.fire({
        icon: 'info',
        title: 'Kunjungan Terdeteksi',
        text: 'Anda sudah tercatat check-in di server.',
        timer: 1500,
        showConfirmButton: false
      });

      router.push({
        path: '/kunjungan-aktif',
        query: {
          id: aktif.IDKunjungan || '',
          kode_customer: aktif.Kode || '',
          nama_toko: aktif.Nama || '',
          id_plafon: aktif.IDPlafon || aktif.id_plafon || ''
        }
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error fetching active visit:', error);

    if (!connectivity.isOnline || isLikelyOfflineError(error)) {
      return false;
    }

    await Swal.fire('Error', 'Gagal memverifikasi status ke server.', 'error');
    return false;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryCheckIn = (error) => {
  const statusCode = Number(error?.response?.status || 0);
  const message = String(
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    ''
  ).toLowerCase();

  return (
    statusCode >= 500 ||
    message.includes('terjadi kesalahan sistem') ||
    message.includes('system') ||
    message.includes('timeout')
  );
};

const startVisitWithRetry = async (payload) => {
  try {
    return await startVisit(payload);
  } catch (error) {
    if (!shouldRetryCheckIn(error)) throw error;

    await sleep(700);
    const activeAfterError = await findActiveVisitFromServer().catch(() => null);
    if (activeAfterError?.IDKunjungan) {
      return {
        success: true,
        idKunjungan: activeAfterError.IDKunjungan,
        message: 'Kunjungan sudah tercatat di server.',
        raw: activeAfterError
      };
    }

    return startVisit(payload);
  }
};

const prosesCheckIn = async () => {
  if (!coords.value.lat || !coords.value.lng) {
    return Swal.fire(
      'Lokasi?',
      'Koordinat GPS belum terdeteksi. Pastikan GPS perangkat menyala.',
      'question'
    );
  }

  loadingCheckIn.value = true;

  const db = getDb();
  const kodeToko = getKodeToko();
  const namaToko = getNamaToko();
  const plafonId = getPlafonId();
  const nowIso = new Date().toISOString();

  if (!kodeToko || !plafonId) {
    loadingCheckIn.value = false;
    return Swal.fire(
      'Data Outlet Tidak Lengkap',
      'Kode customer atau plafon jadwal tidak ditemukan. Silakan muat ulang jadwal kunjungan.',
      'error'
    );
  }

  try {
    const hasActive = await checkCurrentStatus();
    if (hasActive) {
      loadingCheckIn.value = false;
      return;
    }

    const payload = {
      Kode: kodeToko,
      kode_customer: kodeToko,
      id_plafon: plafonId,
      id_jadwal: route.query.id_jadwal || route.query.IDJadwal || null,
      Latitude: coords.value.lat,
      Longitude: coords.value.lng,
      latitude: coords.value.lat,
      longitude: coords.value.lng
    };

    const result = await startVisitWithRetry(payload);

    if (result?.success) {
      const idAsli = result.idKunjungan;

      if (db) {
        await safeUpdateKunjunganToko(db, kodeToko, plafonId, {
          is_visited: 1,
          is_checkout: 0,
          id_kunjungan: idAsli,
          alasan: null,
          local_modified: 0,
          updated_at_local: nowIso
        });
      }

      await Swal.fire({
        icon: 'success',
        title: 'Check-In Berhasil',
        text: 'Kunjungan dimulai.',
        timer: 1500,
        showConfirmButton: false
      });

      router.push({
        path: '/kunjungan-aktif',
        query: {
          id: idAsli || '',
          kode_customer: kodeToko,
          nama_toko: namaToko,
          id_plafon: plafonId
        }
      });
      return;
    }

    await Swal.fire(
      'Gagal',
      result?.message || 'Check-in gagal.',
      'error'
    );
  } catch (error) {
    console.error('Koneksi Error:', error);

    if (error?.response?.status === 403) {
      await Swal.fire(
        'Gagal',
        error.response?.data?.message || 'Anda berada terlalu jauh dari outlet.',
        'error'
      );
      return;
    }

    if (isLikelyOfflineError(error)) {
      if (!db) {
        await Swal.fire('Error Lokal', 'Database lokal belum siap.', 'error');
        return;
      }

      try {
        const tempID = `OFF-${Date.now()}`;

        await db.run(
          `
          INSERT INTO kunjungan_offline
          (id_kunjungan, id_plafon, kode_toko, nama_toko, lat, lng, waktu_checkin, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [tempID, plafonId, kodeToko, namaToko, coords.value.lat, coords.value.lng, nowIso, 'pending']
        );

        await safeUpdateKunjunganToko(db, kodeToko, plafonId, {
          is_visited: 1,
          is_checkout: 0,
          id_kunjungan: tempID,
          alasan: null,
          local_modified: 1,
          updated_at_local: nowIso
        });

        await Swal.fire({
          title: 'Mode Offline Aktif',
          text: `Check-in disimpan lokal dengan ID sementara ${tempID}. Data akan disinkronkan saat online.`,
          icon: 'warning',
          confirmButtonText: 'Lanjutkan'
        });

        router.push({
          path: '/kunjungan-aktif',
          query: {
            id: tempID,
            kode_customer: kodeToko,
            nama_toko: namaToko,
            id_plafon: plafonId
          }
        });
        return;
      } catch (dbErr) {
        console.error('Gagal simpan ke SQLite:', dbErr);
        await Swal.fire('Error Lokal', 'Gagal menyimpan data ke memori perangkat.', 'error');
        return;
      }
    }

    await Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
  } finally {
    loadingCheckIn.value = false;
  }
};

onMounted(async () => {
  if (!isViewMode.value) {
    await checkCurrentStatus();
    getLocation();

    const db = getDb();
    await syncStok(db);
  } else {
    gettingLocation.value = false;
    await fetchDetailKunjungan();
  }
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

.checkin-container {
  min-height: 100vh;
  width: 100%;
  overflow-x: hidden;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent 28%),
    linear-gradient(180deg, #f8fbff 0%, #f3f7fb 100%);
  font-family: 'Plus Jakarta Sans', sans-serif;
  display: flex;
  flex-direction: column;
}

.header-enterprise {
  background: rgba(255, 255, 255, 0.92);
  padding: 28px 20px 18px;
  display: flex;
  align-items: center;
  gap: 15px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
  backdrop-filter: blur(18px);
}

.btn-back {
  width: 45px;
  height: 45px;
  border-radius: 16px;
  border: none;
  background: #f1f5f9;
  color: #1a1a3d;
  font-size: 1.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-content .title {
  margin: 0;
  font-size: 1.18rem;
  font-weight: 800;
  color: #1a1a3d;
  letter-spacing: -0.02em;
}

.header-content .subtitle {
  margin: 4px 0 0;
  font-size: 0.74rem;
  color: #7b8aa2;
  font-weight: 600;
}

.content-wrapper {
  padding: 16px 16px 20px;
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.content-wrapper-checkin {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  max-width: 560px;
}

.hero-panel {
  background:
    radial-gradient(circle at top right, rgba(96, 165, 250, 0.2), transparent 30%),
    linear-gradient(135deg, #0f1d39 0%, #162543 45%, #1f3561 100%);
  color: #fff;
  border-radius: 24px;
  padding: 18px 18px;
  box-shadow: 0 18px 42px rgba(17, 39, 77, 0.16);
  display: grid;
  gap: 14px;
  margin-bottom: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.hero-copy {
  display: grid;
  gap: 6px;
}

.hero-eyebrow,
.section-kicker {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(191, 219, 254, 0.92);
}

.hero-title {
  margin: 0;
  font-size: 1.18rem;
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #ffffff;
  text-shadow: 0 8px 22px rgba(15, 23, 42, 0.28);
}

.hero-subtitle {
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.5;
  color: rgba(226, 232, 240, 0.96);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hero-state {
  border-radius: 22px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(10, 18, 34, 0.28);
  display: grid;
  gap: 4px;
  backdrop-filter: blur(12px);
}

.state-pill-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 800;
  opacity: 0.74;
}

.hero-state strong {
  font-size: 1rem;
  letter-spacing: -0.02em;
}

.hero-state small {
  font-size: 0.76rem;
  line-height: 1.45;
  color: rgba(226, 232, 240, 0.88);
}

.state-success {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.16), rgba(15, 118, 110, 0.14));
}

.state-warning {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.17), rgba(217, 119, 6, 0.12));
}

.state-info {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.16), rgba(14, 116, 144, 0.12));
}

.state-muted {
  background: rgba(255, 255, 255, 0.06);
}

.summary-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}

.summary-grid-compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.summary-grid-compact .summary-card-compact:last-child {
  grid-column: 1 / -1;
}

.summary-card,
.readiness-card,
.action-callout,
.history-card-section,
.reason-history-box,
.location-status,
.menu-item {
  background: rgba(255, 255, 255, 0.94);
  border-radius: 24px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.05);
}

.summary-card {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-height: 132px;
}

.summary-card-compact {
  min-height: auto;
  padding: 12px;
  border-radius: 18px;
  gap: 5px;
}

.summary-label {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.13em;
  color: #8291a8;
}

.summary-card strong {
  color: #14213d;
  font-size: 1rem;
  letter-spacing: -0.02em;
  display: block;
  width: 100%;
  overflow-wrap: anywhere;
  line-height: 1.35;
}

.summary-card-compact strong {
  font-size: 0.88rem;
}

.summary-card small,
.readiness-item p,
.action-copy p,
.hero-subtitle,
.note-footer,
.nota-empty,
.menu-text small {
  color: #6b7a90;
  font-size: 0.76rem;
  line-height: 1.5;
  display: block;
  width: 100%;
  overflow-wrap: anywhere;
}

.summary-card-compact small {
  font-size: 0.68rem;
  line-height: 1.35;
}

.summary-card-compact .summary-label {
  font-size: 0.62rem;
}

.checkin-mode-wrapper {
  display: grid;
  gap: 8px;
}

.status-banner {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  border-radius: 18px;
  margin-bottom: 18px;
}

.banner-success {
  background: #f0fdf4;
  border: 1px solid #10b981;
  color: #10b981;
}

.banner-failed {
  background: #fffbeb;
  border: 1px solid #f59e0b;
  color: #f59e0b;
}

.icon-status {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 800;
  background: rgba(255, 255, 255, 0.72);
}

.text label {
  display: block;
  font-size: 0.62rem;
  text-transform: uppercase;
  font-weight: 800;
  opacity: 0.8;
  margin-bottom: 3px;
}

.text strong {
  font-size: 0.92rem;
}

.readiness-card,
.action-callout,
.history-card-section,
.reason-history-box,
.location-status {
  padding: 18px;
  margin-bottom: 18px;
}

.readiness-card-compact,
.action-callout-compact,
.location-status-compact {
  padding: 12px;
  border-radius: 20px;
}

.readiness-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.readiness-head-compact {
  margin-bottom: 12px;
}

.readiness-head h5,
.action-copy h5 {
  margin: 6px 0 0;
  color: #14213d;
  font-size: 1rem;
  letter-spacing: -0.02em;
}

.readiness-head-compact h5,
.action-callout-compact .action-copy h5 {
  font-size: 0.86rem;
}

.readiness-badge {
  border-radius: 999px;
  padding: 9px 12px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  white-space: nowrap;
  color: #fff;
}

.readiness-list {
  display: grid;
  gap: 12px;
}

.readiness-mini-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.readiness-mini {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px;
  border-radius: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  min-width: 0;
}

.readiness-mini.done {
  background: #effcf6;
  border-color: #bbf7d0;
}

.readiness-mini.pending {
  background: #fff7ed;
  border-color: #fed7aa;
}

.mini-index {
  width: 24px;
  height: 24px;
  min-width: 24px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.76rem;
  font-weight: 800;
  background: #dbeafe;
  color: #1d4ed8;
}

.readiness-mini strong {
  display: block;
  color: #14213d;
  font-size: 0.72rem;
  font-weight: 700;
}

.readiness-mini p {
  margin: 2px 0 0;
  color: #64748b;
  font-size: 0.62rem;
  line-height: 1.3;
}

.readiness-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  border-radius: 18px;
  background: #f8fafc;
  padding: 14px;
}

.readiness-dot {
  width: 28px;
  height: 28px;
  min-width: 28px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.76rem;
  font-weight: 800;
  background: #dbeafe;
  color: #1d4ed8;
}

.readiness-item.done .readiness-dot {
  background: #dcfce7;
  color: #15803d;
}

.readiness-item.pending .readiness-dot {
  background: #fff7ed;
  color: #c2410c;
}

.readiness-item strong,
.menu-text span,
.nota-no,
.reason-history-box p {
  display: block;
  color: #14213d;
  font-size: 0.88rem;
  font-weight: 700;
}

.location-status {
  text-align: center;
}

.location-status-compact p {
  font-size: 0.74rem;
}

.location-status.success {
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfeff 100%);
}

.location-status.success p {
  color: #10b981;
  font-size: 0.8rem;
  font-weight: 600;
}

.action-callout {
  display: grid;
  gap: 16px;
}

.action-callout-compact {
  gap: 12px;
}

.action-callout-compact .action-copy p {
  font-size: 0.7rem;
  line-height: 1.35;
}

.inline-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: #f8fafc;
}

.inline-status.state-success {
  background: #effcf6;
  border-color: #bbf7d0;
}

.inline-status.state-info {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.inline-status.state-muted {
  background: #fff7ed;
  border-color: #fed7aa;
}

.inline-status-icon {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.74rem;
  font-weight: 800;
  color: #1d4ed8;
  background: rgba(255, 255, 255, 0.9);
}

.inline-status-copy strong {
  display: block;
  font-size: 0.78rem;
  color: #14213d;
}

.inline-status-copy small {
  display: block;
  margin-top: 2px;
  font-size: 0.67rem;
  line-height: 1.35;
  color: #64748b;
}

.btn-confirm {
  width: 100%;
  padding: 15px;
  background: linear-gradient(135deg, #1a1a3d 0%, #253b6b 100%);
  color: white;
  border: none;
  border-radius: 22px;
  font-weight: 800;
  font-size: 1rem;
  box-shadow: 0 16px 36px rgba(26, 26, 61, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.btn-confirm:disabled {
  opacity: 0.7;
}

.btn-back-only {
  width: 100%;
  padding: 16px;
  background: #f1f5f9;
  color: #64748b;
  border: none;
  border-radius: 18px;
  font-weight: 700;
}

.menu-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 18px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  text-align: left;
  transition: transform 0.2s;
}

.menu-item:active {
  transform: scale(0.98);
}

.menu-icon {
  width: 45px;
  height: 45px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  font-weight: 800;
}

.menu-icon.blue {
  background: #eff6ff;
  color: #2563eb;
}

.menu-icon.orange {
  background: #fff7ed;
  color: #ea580c;
}

.section-label {
  font-size: 0.7rem;
  font-weight: 800;
  color: #94a3b8;
  margin-bottom: 15px;
  letter-spacing: 0.12em;
}

.nota-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}

.nota-item:last-child {
  border-bottom: none;
}

.nota-info small {
  color: #8ea0ba;
  font-size: 0.73rem;
}

.nota-amount {
  font-weight: 800;
  color: #10b981;
  font-size: 0.9rem;
}

.reason-history-box label {
  font-size: 0.7rem;
  font-weight: 800;
  color: #94a3b8;
  letter-spacing: 0.1em;
}

.custom-loader-small {
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-top-color: #1a1a3d;
  border-radius: 50%;
  margin: 0 auto 8px;
  animation: spin 0.8s linear infinite;
}

.spinner-white {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.success-icon {
  font-weight: 800;
  font-size: 1rem;
  color: #10b981;
  margin-bottom: 6px;
}

.animate-up {
  animation: slideUp 0.4s ease-out;
}

.note-footer-compact {
  margin: 0;
  text-align: center;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(15px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (min-width: 680px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .summary-grid-compact,
  .readiness-mini-grid {
    grid-template-columns: 1fr;
  }

  .summary-grid-compact .summary-card-compact:last-child {
    grid-column: auto;
  }

  .content-wrapper-checkin {
    padding-bottom: 16px;
  }

  .header-enterprise {
    padding: 20px 14px 14px;
    gap: 12px;
  }

  .btn-back {
    width: 40px;
    height: 40px;
    border-radius: 14px;
    font-size: 1.5rem;
  }

  .header-content .title {
    font-size: 1.02rem;
  }

  .header-content .subtitle,
  .summary-card-compact small,
  .action-callout-compact .action-copy p {
    display: none;
  }

  .hero-panel {
    padding: 16px;
  }
}

@media (min-width: 960px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

:global(:root[data-theme='dark']) .checkin-container {
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.12), transparent 24%),
    linear-gradient(180deg, #000814 0%, #020617 100%) !important;
}

:global(:root[data-theme='dark']) .header-enterprise,
:global(:root[data-theme='dark']) .summary-card,
:global(:root[data-theme='dark']) .readiness-card,
:global(:root[data-theme='dark']) .action-callout,
:global(:root[data-theme='dark']) .history-card-section,
:global(:root[data-theme='dark']) .reason-history-box,
:global(:root[data-theme='dark']) .location-status,
:global(:root[data-theme='dark']) .menu-item,
:global(:root[data-theme='dark']) .readiness-item {
  background: linear-gradient(180deg, #030712 0%, #0a1020 100%) !important;
  border-color: rgba(30, 41, 59, 0.95) !important;
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.4) !important;
}

:global(:root[data-theme='dark']) .btn-back,
:global(:root[data-theme='dark']) .btn-back-only {
  background: #020617 !important;
  color: #f1f5f9 !important;
  border: 1px solid rgba(51, 65, 85, 0.92) !important;
}

:global(:root[data-theme='dark']) .header-content .title,
:global(:root[data-theme='dark']) .summary-card strong,
:global(:root[data-theme='dark']) .readiness-item strong,
:global(:root[data-theme='dark']) .readiness-head h5,
:global(:root[data-theme='dark']) .action-copy h5,
:global(:root[data-theme='dark']) .menu-text span,
:global(:root[data-theme='dark']) .nota-no,
:global(:root[data-theme='dark']) .reason-history-box p {
  color: #f1f5f9 !important;
}

:global(:root[data-theme='dark']) .header-content .subtitle,
:global(:root[data-theme='dark']) .summary-card small,
:global(:root[data-theme='dark']) .summary-label,
:global(:root[data-theme='dark']) .readiness-item p,
:global(:root[data-theme='dark']) .hero-subtitle,
:global(:root[data-theme='dark']) .hero-state small,
:global(:root[data-theme='dark']) .note-footer,
:global(:root[data-theme='dark']) .menu-text small,
:global(:root[data-theme='dark']) .section-label,
:global(:root[data-theme='dark']) .reason-history-box label {
  color: #9fb0c7 !important;
}

:global(:root[data-theme='dark']) .hero-panel {
  background: linear-gradient(135deg, #071126 0%, #132341 45%, #1c3667 100%) !important;
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.42) !important;
}

:global(:root[data-theme='dark']) .banner-success {
  background: rgba(6, 95, 70, 0.18) !important;
  border-color: rgba(16, 185, 129, 0.32) !important;
  color: #6ee7b7 !important;
}

:global(:root[data-theme='dark']) .banner-failed {
  background: rgba(120, 53, 15, 0.18) !important;
  border-color: rgba(245, 158, 11, 0.32) !important;
  color: #fcd34d !important;
}

:global(:root[data-theme='dark']) .menu-icon.blue {
  background: rgba(37, 99, 235, 0.16) !important;
  color: #93c5fd !important;
}

:global(:root[data-theme='dark']) .menu-icon.orange {
  background: rgba(249, 115, 22, 0.16) !important;
  color: #fdba74 !important;
}

:global(:root[data-theme='dark']) .location-status.success {
  background: rgba(6, 95, 70, 0.18) !important;
}

:global(:root[data-theme='dark']) .location-status.success p,
:global(:root[data-theme='dark']) .nota-amount,
:global(:root[data-theme='dark']) .success-icon {
  color: #6ee7b7 !important;
}

:global(:root[data-theme='dark']) .custom-loader-small {
  border-color: #1e293b !important;
  border-top-color: #60a5fa !important;
}

/* Final theme pass for Check-In confirmation. Keeps this page isolated from
   older global page/card rules that can bleed across light and dark mode. */
:global(html[data-theme='light']) .checkin-container,
:global(body[data-theme='light']) .checkin-container,
:global(:root[data-theme='light']) .checkin-container {
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent 26%),
    linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%) !important;
  color: #0f172a !important;
}

:global(html[data-theme='light']) .checkin-container :is(
  .header-enterprise,
  .summary-card,
  .readiness-card,
  .action-callout,
  .history-card-section,
  .reason-history-box,
  .location-status,
  .menu-item
),
:global(body[data-theme='light']) .checkin-container :is(
  .header-enterprise,
  .summary-card,
  .readiness-card,
  .action-callout,
  .history-card-section,
  .reason-history-box,
  .location-status,
  .menu-item
),
:global(:root[data-theme='light']) .checkin-container :is(
  .header-enterprise,
  .summary-card,
  .readiness-card,
  .action-callout,
  .history-card-section,
  .reason-history-box,
  .location-status,
  .menu-item
) {
  background: #ffffff !important;
  border-color: #dbeafe !important;
  color: #0f172a !important;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.07) !important;
}

:global(html[data-theme='light']) .checkin-container .header-enterprise,
:global(body[data-theme='light']) .checkin-container .header-enterprise,
:global(:root[data-theme='light']) .checkin-container .header-enterprise {
  background: rgba(255, 255, 255, 0.96) !important;
  border-bottom-color: #dbeafe !important;
}

:global(html[data-theme='light']) .checkin-container .hero-panel,
:global(body[data-theme='light']) .checkin-container .hero-panel,
:global(:root[data-theme='light']) .checkin-container .hero-panel {
  background:
    radial-gradient(circle at top right, rgba(96, 165, 250, 0.16), transparent 30%),
    linear-gradient(135deg, #eff6ff 0%, #ffffff 58%, #dbeafe 100%) !important;
  color: #0f172a !important;
  border-color: #bfdbfe !important;
  box-shadow: 0 18px 38px rgba(37, 99, 235, 0.12) !important;
}

:global(html[data-theme='light']) .checkin-container :is(
  .header-content .title,
  .hero-title,
  .summary-card strong,
  .readiness-head h5,
  .readiness-mini strong,
  .readiness-item strong,
  .action-copy h5,
  .inline-status-copy strong,
  .menu-text span,
  .nota-no,
  .reason-history-box p
),
:global(body[data-theme='light']) .checkin-container :is(
  .header-content .title,
  .hero-title,
  .summary-card strong,
  .readiness-head h5,
  .readiness-mini strong,
  .readiness-item strong,
  .action-copy h5,
  .inline-status-copy strong,
  .menu-text span,
  .nota-no,
  .reason-history-box p
),
:global(:root[data-theme='light']) .checkin-container :is(
  .header-content .title,
  .hero-title,
  .summary-card strong,
  .readiness-head h5,
  .readiness-mini strong,
  .readiness-item strong,
  .action-copy h5,
  .inline-status-copy strong,
  .menu-text span,
  .nota-no,
  .reason-history-box p
) {
  color: #0f172a !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

:global(html[data-theme='light']) .checkin-container :is(
  .header-content .subtitle,
  .hero-subtitle,
  .hero-state small,
  .summary-card small,
  .summary-label,
  .section-kicker,
  .hero-eyebrow,
  .readiness-mini p,
  .readiness-item p,
  .action-copy p,
  .inline-status-copy small,
  .note-footer,
  .menu-text small,
  .section-label,
  .reason-history-box label
),
:global(body[data-theme='light']) .checkin-container :is(
  .header-content .subtitle,
  .hero-subtitle,
  .hero-state small,
  .summary-card small,
  .summary-label,
  .section-kicker,
  .hero-eyebrow,
  .readiness-mini p,
  .readiness-item p,
  .action-copy p,
  .inline-status-copy small,
  .note-footer,
  .menu-text small,
  .section-label,
  .reason-history-box label
),
:global(:root[data-theme='light']) .checkin-container :is(
  .header-content .subtitle,
  .hero-subtitle,
  .hero-state small,
  .summary-card small,
  .summary-label,
  .section-kicker,
  .hero-eyebrow,
  .readiness-mini p,
  .readiness-item p,
  .action-copy p,
  .inline-status-copy small,
  .note-footer,
  .menu-text small,
  .section-label,
  .reason-history-box label
) {
  color: #64748b !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

:global(html[data-theme='light']) .checkin-container :is(.btn-back, .btn-back-only),
:global(body[data-theme='light']) .checkin-container :is(.btn-back, .btn-back-only),
:global(:root[data-theme='light']) .checkin-container :is(.btn-back, .btn-back-only) {
  background: #eff6ff !important;
  border: 1px solid #bfdbfe !important;
  color: #1d4ed8 !important;
}

:global(html[data-theme='light']) .checkin-container :is(.readiness-mini, .readiness-item, .inline-status),
:global(body[data-theme='light']) .checkin-container :is(.readiness-mini, .readiness-item, .inline-status),
:global(:root[data-theme='light']) .checkin-container :is(.readiness-mini, .readiness-item, .inline-status) {
  background: #f8fafc !important;
  border-color: #dbeafe !important;
}

:global(html[data-theme='light']) .checkin-container :is(.state-success, .inline-status.state-success, .readiness-mini.done),
:global(body[data-theme='light']) .checkin-container :is(.state-success, .inline-status.state-success, .readiness-mini.done),
:global(:root[data-theme='light']) .checkin-container :is(.state-success, .inline-status.state-success, .readiness-mini.done) {
  background: #ecfdf5 !important;
  border-color: #bbf7d0 !important;
}

:global(html[data-theme='light']) .checkin-container :is(.state-info, .inline-status.state-info),
:global(body[data-theme='light']) .checkin-container :is(.state-info, .inline-status.state-info),
:global(:root[data-theme='light']) .checkin-container :is(.state-info, .inline-status.state-info) {
  background: #eff6ff !important;
  border-color: #bfdbfe !important;
}

:global(html[data-theme='light']) .checkin-container :is(.state-muted, .inline-status.state-muted, .readiness-mini.pending),
:global(body[data-theme='light']) .checkin-container :is(.state-muted, .inline-status.state-muted, .readiness-mini.pending),
:global(:root[data-theme='light']) .checkin-container :is(.state-muted, .inline-status.state-muted, .readiness-mini.pending) {
  background: #fff7ed !important;
  border-color: #fed7aa !important;
}

:global(html[data-theme='dark']) .checkin-container,
:global(body[data-theme='dark']) .checkin-container,
:global(:root[data-theme='dark']) .checkin-container {
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.14), transparent 24%),
    linear-gradient(180deg, #020617 0%, #030712 100%) !important;
  color: #e2e8f0 !important;
}

:global(html[data-theme='dark']) .checkin-container :is(
  .header-enterprise,
  .summary-card,
  .readiness-card,
  .action-callout,
  .history-card-section,
  .reason-history-box,
  .location-status,
  .menu-item
),
:global(body[data-theme='dark']) .checkin-container :is(
  .header-enterprise,
  .summary-card,
  .readiness-card,
  .action-callout,
  .history-card-section,
  .reason-history-box,
  .location-status,
  .menu-item
),
:global(:root[data-theme='dark']) .checkin-container :is(
  .header-enterprise,
  .summary-card,
  .readiness-card,
  .action-callout,
  .history-card-section,
  .reason-history-box,
  .location-status,
  .menu-item
) {
  background: linear-gradient(180deg, #030712 0%, #0f172a 100%) !important;
  border-color: rgba(51, 65, 85, 0.9) !important;
  color: #e2e8f0 !important;
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.34) !important;
}

:global(html[data-theme='dark']) .checkin-container .hero-panel,
:global(body[data-theme='dark']) .checkin-container .hero-panel,
:global(:root[data-theme='dark']) .checkin-container .hero-panel {
  background: linear-gradient(135deg, #020617 0%, #0f1f3d 48%, #17315f 100%) !important;
  border-color: rgba(96, 165, 250, 0.22) !important;
  box-shadow: 0 22px 48px rgba(0, 0, 0, 0.38) !important;
}

:global(html[data-theme='dark']) .checkin-container :is(
  .header-content .title,
  .hero-title,
  .summary-card strong,
  .readiness-head h5,
  .readiness-mini strong,
  .readiness-item strong,
  .action-copy h5,
  .inline-status-copy strong,
  .menu-text span,
  .nota-no,
  .reason-history-box p
),
:global(body[data-theme='dark']) .checkin-container :is(
  .header-content .title,
  .hero-title,
  .summary-card strong,
  .readiness-head h5,
  .readiness-mini strong,
  .readiness-item strong,
  .action-copy h5,
  .inline-status-copy strong,
  .menu-text span,
  .nota-no,
  .reason-history-box p
),
:global(:root[data-theme='dark']) .checkin-container :is(
  .header-content .title,
  .hero-title,
  .summary-card strong,
  .readiness-head h5,
  .readiness-mini strong,
  .readiness-item strong,
  .action-copy h5,
  .inline-status-copy strong,
  .menu-text span,
  .nota-no,
  .reason-history-box p
) {
  color: #f8fafc !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

:global(html[data-theme='dark']) .checkin-container :is(
  .header-content .subtitle,
  .hero-subtitle,
  .hero-state small,
  .summary-card small,
  .summary-label,
  .section-kicker,
  .hero-eyebrow,
  .readiness-mini p,
  .readiness-item p,
  .action-copy p,
  .inline-status-copy small,
  .note-footer,
  .menu-text small,
  .section-label,
  .reason-history-box label
),
:global(body[data-theme='dark']) .checkin-container :is(
  .header-content .subtitle,
  .hero-subtitle,
  .hero-state small,
  .summary-card small,
  .summary-label,
  .section-kicker,
  .hero-eyebrow,
  .readiness-mini p,
  .readiness-item p,
  .action-copy p,
  .inline-status-copy small,
  .note-footer,
  .menu-text small,
  .section-label,
  .reason-history-box label
),
:global(:root[data-theme='dark']) .checkin-container :is(
  .header-content .subtitle,
  .hero-subtitle,
  .hero-state small,
  .summary-card small,
  .summary-label,
  .section-kicker,
  .hero-eyebrow,
  .readiness-mini p,
  .readiness-item p,
  .action-copy p,
  .inline-status-copy small,
  .note-footer,
  .menu-text small,
  .section-label,
  .reason-history-box label
) {
  color: #94a3b8 !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

:global(html[data-theme='dark']) .checkin-container :is(.btn-back, .btn-back-only),
:global(body[data-theme='dark']) .checkin-container :is(.btn-back, .btn-back-only),
:global(:root[data-theme='dark']) .checkin-container :is(.btn-back, .btn-back-only) {
  background: #0f172a !important;
  border: 1px solid rgba(51, 65, 85, 0.92) !important;
  color: #e2e8f0 !important;
}

:global(html[data-theme='dark']) .checkin-container :is(.readiness-mini, .readiness-item, .inline-status),
:global(body[data-theme='dark']) .checkin-container :is(.readiness-mini, .readiness-item, .inline-status),
:global(:root[data-theme='dark']) .checkin-container :is(.readiness-mini, .readiness-item, .inline-status) {
  background: rgba(15, 23, 42, 0.82) !important;
  border-color: rgba(51, 65, 85, 0.9) !important;
}

:global(html[data-theme='dark']) .checkin-container :is(.state-success, .inline-status.state-success, .readiness-mini.done),
:global(body[data-theme='dark']) .checkin-container :is(.state-success, .inline-status.state-success, .readiness-mini.done),
:global(:root[data-theme='dark']) .checkin-container :is(.state-success, .inline-status.state-success, .readiness-mini.done) {
  background: rgba(6, 95, 70, 0.2) !important;
  border-color: rgba(16, 185, 129, 0.34) !important;
}

:global(html[data-theme='dark']) .checkin-container :is(.state-info, .inline-status.state-info),
:global(body[data-theme='dark']) .checkin-container :is(.state-info, .inline-status.state-info),
:global(:root[data-theme='dark']) .checkin-container :is(.state-info, .inline-status.state-info) {
  background: rgba(37, 99, 235, 0.18) !important;
  border-color: rgba(96, 165, 250, 0.34) !important;
}

:global(html[data-theme='dark']) .checkin-container :is(.state-muted, .inline-status.state-muted, .readiness-mini.pending),
:global(body[data-theme='dark']) .checkin-container :is(.state-muted, .inline-status.state-muted, .readiness-mini.pending),
:global(:root[data-theme='dark']) .checkin-container :is(.state-muted, .inline-status.state-muted, .readiness-mini.pending) {
  background: rgba(120, 53, 15, 0.2) !important;
  border-color: rgba(251, 146, 60, 0.34) !important;
}

:global(html[data-theme='dark']) .checkin-container .inline-status-icon,
:global(body[data-theme='dark']) .checkin-container .inline-status-icon,
:global(:root[data-theme='dark']) .checkin-container .inline-status-icon {
  background: rgba(30, 41, 59, 0.94) !important;
  color: #93c5fd !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .checkin-container .checkin-mode-wrapper :is(.readiness-card-compact, .action-callout-compact),
:global(body[data-theme='dark']) .checkin-container .checkin-mode-wrapper :is(.readiness-card-compact, .action-callout-compact),
:global(:root[data-theme='dark']) .checkin-container .checkin-mode-wrapper :is(.readiness-card-compact, .action-callout-compact) {
  background: linear-gradient(180deg, #020617 0%, #0b1220 100%) !important;
  border: 1px solid rgba(51, 65, 85, 0.96) !important;
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.36) !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .checkin-container .checkin-mode-wrapper :is(.readiness-head h5, .action-copy h5, .inline-status-copy strong, .readiness-mini strong),
:global(body[data-theme='dark']) .checkin-container .checkin-mode-wrapper :is(.readiness-head h5, .action-copy h5, .inline-status-copy strong, .readiness-mini strong),
:global(:root[data-theme='dark']) .checkin-container .checkin-mode-wrapper :is(.readiness-head h5, .action-copy h5, .inline-status-copy strong, .readiness-mini strong) {
  color: #e2e8f0 !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .checkin-container .checkin-mode-wrapper :is(.section-kicker, .readiness-mini p, .action-copy p, .inline-status-copy small),
:global(body[data-theme='dark']) .checkin-container .checkin-mode-wrapper :is(.section-kicker, .readiness-mini p, .action-copy p, .inline-status-copy small),
:global(:root[data-theme='dark']) .checkin-container .checkin-mode-wrapper :is(.section-kicker, .readiness-mini p, .action-copy p, .inline-status-copy small) {
  color: #94a3b8 !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .readiness-mini,
:global(body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .readiness-mini,
:global(:root[data-theme='dark']) .checkin-container .checkin-mode-wrapper .readiness-mini {
  background: #0f172a !important;
  border-color: rgba(51, 65, 85, 0.96) !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .readiness-mini.done,
:global(body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .readiness-mini.done,
:global(:root[data-theme='dark']) .checkin-container .checkin-mode-wrapper .readiness-mini.done {
  background: rgba(6, 78, 59, 0.2) !important;
  border-color: rgba(52, 211, 153, 0.34) !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .readiness-mini.pending,
:global(body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .readiness-mini.pending,
:global(:root[data-theme='dark']) .checkin-container .checkin-mode-wrapper .readiness-mini.pending {
  background: rgba(124, 45, 18, 0.22) !important;
  border-color: rgba(251, 146, 60, 0.36) !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .mini-index,
:global(body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .mini-index,
:global(:root[data-theme='dark']) .checkin-container .checkin-mode-wrapper .mini-index {
  background: rgba(37, 99, 235, 0.22) !important;
  color: #bfdbfe !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .readiness-mini.done .mini-index,
:global(body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .readiness-mini.done .mini-index,
:global(:root[data-theme='dark']) .checkin-container .checkin-mode-wrapper .readiness-mini.done .mini-index {
  background: rgba(16, 185, 129, 0.22) !important;
  color: #a7f3d0 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .readiness-mini.pending .mini-index,
:global(body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .readiness-mini.pending .mini-index,
:global(:root[data-theme='dark']) .checkin-container .checkin-mode-wrapper .readiness-mini.pending .mini-index {
  background: rgba(249, 115, 22, 0.22) !important;
  color: #fed7aa !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .inline-status,
:global(body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .inline-status,
:global(:root[data-theme='dark']) .checkin-container .checkin-mode-wrapper .inline-status {
  background: #0f172a !important;
  border-color: rgba(51, 65, 85, 0.96) !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .btn-confirm,
:global(body[data-theme='dark']) .checkin-container .checkin-mode-wrapper .btn-confirm,
:global(:root[data-theme='dark']) .checkin-container .checkin-mode-wrapper .btn-confirm {
  background: linear-gradient(135deg, #1d4ed8 0%, #0f766e 100%) !important;
  color: #ffffff !important;
  box-shadow: 0 16px 34px rgba(29, 78, 216, 0.28) !important;
}
</style>

<style>
html[data-theme='dark'] .checkin-container,
body[data-theme='dark'] .checkin-container {
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.14), transparent 26%),
    linear-gradient(180deg, #020617 0%, #030712 100%) !important;
  color: #e5edf8 !important;
}

html[data-theme='dark'] .checkin-container .header-enterprise,
body[data-theme='dark'] .checkin-container .header-enterprise {
  background: rgba(2, 6, 23, 0.94) !important;
  border-bottom: 1px solid rgba(51, 65, 85, 0.88) !important;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.3) !important;
}

html[data-theme='dark'] .checkin-container .btn-back,
body[data-theme='dark'] .checkin-container .btn-back {
  background: #0f172a !important;
  border: 1px solid rgba(71, 85, 105, 0.72) !important;
  color: #e5edf8 !important;
}

html[data-theme='dark'] .checkin-container .header-content .title,
body[data-theme='dark'] .checkin-container .header-content .title,
html[data-theme='dark'] .checkin-container .hero-title,
body[data-theme='dark'] .checkin-container .hero-title,
html[data-theme='dark'] .checkin-container .readiness-head h5,
body[data-theme='dark'] .checkin-container .readiness-head h5,
html[data-theme='dark'] .checkin-container .action-copy h5,
body[data-theme='dark'] .checkin-container .action-copy h5,
html[data-theme='dark'] .checkin-container .readiness-mini strong,
body[data-theme='dark'] .checkin-container .readiness-mini strong,
html[data-theme='dark'] .checkin-container .inline-status-copy strong,
body[data-theme='dark'] .checkin-container .inline-status-copy strong {
  color: #f8fafc !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

html[data-theme='dark'] .checkin-container .header-content .subtitle,
body[data-theme='dark'] .checkin-container .header-content .subtitle,
html[data-theme='dark'] .checkin-container .hero-subtitle,
body[data-theme='dark'] .checkin-container .hero-subtitle,
html[data-theme='dark'] .checkin-container .section-kicker,
body[data-theme='dark'] .checkin-container .section-kicker,
html[data-theme='dark'] .checkin-container .readiness-mini p,
body[data-theme='dark'] .checkin-container .readiness-mini p,
html[data-theme='dark'] .checkin-container .action-copy p,
body[data-theme='dark'] .checkin-container .action-copy p,
html[data-theme='dark'] .checkin-container .inline-status-copy small,
body[data-theme='dark'] .checkin-container .inline-status-copy small {
  color: #9fb0c7 !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

html[data-theme='dark'] .checkin-container .hero-panel,
body[data-theme='dark'] .checkin-container .hero-panel {
  background:
    radial-gradient(circle at top right, rgba(96, 165, 250, 0.18), transparent 32%),
    linear-gradient(135deg, #020617 0%, #0f1f3d 48%, #16315f 100%) !important;
  border: 1px solid rgba(96, 165, 250, 0.24) !important;
  box-shadow: 0 22px 48px rgba(0, 0, 0, 0.38) !important;
}

html[data-theme='dark'] .checkin-container .hero-state,
body[data-theme='dark'] .checkin-container .hero-state {
  background: rgba(15, 23, 42, 0.72) !important;
  border: 1px solid rgba(96, 165, 250, 0.2) !important;
  color: #f8fafc !important;
}

html[data-theme='dark'] .checkin-container .hero-state small,
body[data-theme='dark'] .checkin-container .hero-state small {
  color: #cbd5e1 !important;
}

html[data-theme='dark'] .checkin-container .checkin-mode-wrapper .readiness-card-compact,
body[data-theme='dark'] .checkin-container .checkin-mode-wrapper .readiness-card-compact,
html[data-theme='dark'] .checkin-container .checkin-mode-wrapper .action-callout-compact,
body[data-theme='dark'] .checkin-container .checkin-mode-wrapper .action-callout-compact {
  background: linear-gradient(180deg, #020617 0%, #0b1220 100%) !important;
  border: 1px solid rgba(51, 65, 85, 0.96) !important;
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.36) !important;
}

html[data-theme='dark'] .checkin-container .readiness-mini,
body[data-theme='dark'] .checkin-container .readiness-mini,
html[data-theme='dark'] .checkin-container .inline-status,
body[data-theme='dark'] .checkin-container .inline-status {
  background: #0f172a !important;
  border: 1px solid rgba(51, 65, 85, 0.96) !important;
  color: #e5edf8 !important;
}

html[data-theme='dark'] .checkin-container .readiness-mini.done,
body[data-theme='dark'] .checkin-container .readiness-mini.done,
html[data-theme='dark'] .checkin-container .inline-status.state-success,
body[data-theme='dark'] .checkin-container .inline-status.state-success {
  background: rgba(6, 78, 59, 0.22) !important;
  border-color: rgba(52, 211, 153, 0.36) !important;
}

html[data-theme='dark'] .checkin-container .readiness-mini.pending,
body[data-theme='dark'] .checkin-container .readiness-mini.pending,
html[data-theme='dark'] .checkin-container .inline-status.state-muted,
body[data-theme='dark'] .checkin-container .inline-status.state-muted {
  background: rgba(124, 45, 18, 0.24) !important;
  border-color: rgba(251, 146, 60, 0.38) !important;
}

html[data-theme='dark'] .checkin-container .inline-status.state-info,
body[data-theme='dark'] .checkin-container .inline-status.state-info {
  background: rgba(37, 99, 235, 0.2) !important;
  border-color: rgba(96, 165, 250, 0.36) !important;
}

html[data-theme='dark'] .checkin-container .mini-index,
body[data-theme='dark'] .checkin-container .mini-index,
html[data-theme='dark'] .checkin-container .inline-status-icon,
body[data-theme='dark'] .checkin-container .inline-status-icon {
  background: rgba(37, 99, 235, 0.24) !important;
  color: #bfdbfe !important;
}

html[data-theme='dark'] .checkin-container .readiness-mini.done .mini-index,
body[data-theme='dark'] .checkin-container .readiness-mini.done .mini-index {
  background: rgba(16, 185, 129, 0.22) !important;
  color: #a7f3d0 !important;
}

html[data-theme='dark'] .checkin-container .readiness-mini.pending .mini-index,
body[data-theme='dark'] .checkin-container .readiness-mini.pending .mini-index {
  background: rgba(249, 115, 22, 0.24) !important;
  color: #fed7aa !important;
}

html[data-theme='dark'] .checkin-container .btn-confirm,
body[data-theme='dark'] .checkin-container .btn-confirm {
  background: linear-gradient(135deg, #1d4ed8 0%, #0f766e 100%) !important;
  color: #ffffff !important;
  box-shadow: 0 16px 34px rgba(29, 78, 216, 0.28) !important;
}
</style>

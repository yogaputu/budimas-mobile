import api from '@/api/axios';
import { getDb } from '@/services/database';
import { useConnectivityStore } from '@/stores/connectivity';
import { Preferences } from '@capacitor/preferences';
import { getVisitList, getVisitSchedule } from '@/services/visitService';
import { dateInputToLocalDateTime } from '@/utils/dateLocal';
import { offlineEnabled } from '@/config/runtime';

// Helper: simpan timestamp sync ke Preferences (bukan localStorage)
const setSyncTimestamp = async (key) => {
  try {
    await Preferences.set({ key, value: nowIso() });
  } catch {
    // fallback ke localStorage jika berjalan di web/test
    try { localStorage.setItem(key, nowIso()); } catch {}
  }
};

const KUNJUNGAN_PENDING_STATUSES = ['pending', 'pending_checkout', 'pending_reason'];

const nowIso = () => new Date().toISOString();
const normalizePlafonId = (value) => String(value ?? '').trim();
const getVisitPlafonId = (item = {}) => normalizePlafonId(item.IDPlafon || item.id_plafon);
const getVisitPlafonCode = (item = {}) => String(item.KodePlafon || item.kode_plafon || '').trim();
const getVisitPrincipalCode = (item = {}) => String(item.KodePrincipal || item.kode_principal || '').trim();
const getVisitPrincipalName = (item = {}) => String(item.NamaPrincipal || item.nama_principal || '').trim();
const activeUploads = new Set();

const withUploadLock = async (key, task) => {
  if (activeUploads.has(key)) {
    return { success: true, skipped: true, message: `Sinkronisasi ${key} sedang berjalan` };
  }

  activeUploads.add(key);
  try {
    return await task();
  } finally {
    activeUploads.delete(key);
  }
};

const isConnectivityError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return !!(
    error?.isOffline ||
    error?.isNetworkError ||
    error?.code === 'ECONNABORTED' ||
    message.includes('network error') ||
    message.includes('koneksi terputus') ||
    message.includes('timeout') ||
    message.includes('offline') ||
    message.includes('masih offline')
  );
};

export const SyncService = {
  // =========================
  // 🔍 GENERIC CHECK PENDING
  // =========================
  async hasPendingKunjunganData() {
    const db = getDb();
    if (!db) return false;

    try {
      const res = await db.query(
        `
        SELECT COUNT(*) as total
        FROM kunjungan_offline
        WHERE status IN ('pending', 'pending_checkout', 'pending_reason')
        `
      );

      return (res.values?.[0]?.total || 0) > 0;
    } catch (err) {
      console.error('❌ Gagal cek pending kunjungan:', err);
      return false;
    }
  },

  async hasPendingSalesOrderData() {
    const db = getDb();
    if (!db) return false;

    try {
      const res = await db.query(
        `
        SELECT COUNT(*) as total
        FROM sales_order_offline
        WHERE status_sync = 'pending'
        `
      );

      return (res.values?.[0]?.total || 0) > 0;
    } catch (err) {
      console.error('❌ Gagal cek pending sales order:', err);
      return false;
    }
  },

  async hasPendingPaymentData({ strict = false } = {}) {
    const db = getDb();
    if (!db) {
      if (strict && offlineEnabled) throw new Error('Penyimpanan pembayaran offline belum siap. Buka ulang aplikasi sebelum pengembalian LPH.');
      return false;
    }

    try {
      const res = await db.query(
        `
        SELECT COUNT(*) as total
        FROM payment_offline
        WHERE status_sync = 'pending'
        `
      );

      return (res.values?.[0]?.total || 0) > 0;
    } catch (err) {
      console.error('❌ Gagal cek pending payment:', err);
      if (strict) throw new Error('Pembayaran offline belum dapat diperiksa. Coba lagi sebelum pengembalian LPH.');
      return false;
    }
  },

  async hasPendingReturData() {
    const db = getDb();
    if (!db) return false;

    try {
      const res = await db.query(
        `
        SELECT COUNT(*) as total
        FROM retur_offline
        WHERE status_sync = 'pending'
        `
      );

      return (res.values?.[0]?.total || 0) > 0;
    } catch (err) {
      console.error('❌ Gagal cek pending retur:', err);
      return false;
    }
  },

  async hasPendingStockOpnameData() {
    const db = getDb();
    if (!db) return false;

    try {
      const res = await db.query(
        `
        SELECT COUNT(*) as total
        FROM stock_opname_offline
        WHERE status_sync = 'pending'
        `
      );

      return (res.values?.[0]?.total || 0) > 0;
    } catch (err) {
      console.error('❌ Gagal cek pending stock opname:', err);
      return false;
    }
  },

  async hasAnyPendingData() {
    const [
      hasKunjungan,
      hasSO,
      hasPayment,
      hasRetur,
      hasStockOpname
    ] = await Promise.all([
      this.hasPendingKunjunganData(),
      this.hasPendingSalesOrderData(),
      this.hasPendingPaymentData(),
      this.hasPendingReturData(),
      this.hasPendingStockOpnameData()
    ]);

    return hasKunjungan || hasSO || hasPayment || hasRetur || hasStockOpname;
  },

  // backward compatibility
  async hasPendingOfflineData() {
    return this.hasPendingKunjunganData();
  },

  // =========================
  // 🧰 HELPER
  // =========================
  async markSyncFailed(tableName, id, errorMessage) {
    const db = getDb();
    if (!db) return;

    try {
      if (tableName === 'kunjungan_offline') {
        await db.run(
          `
          UPDATE kunjungan_offline
          SET retry_count = COALESCE(retry_count, 0) + 1,
              last_error = ?
          WHERE id = ?
          `,
          [String(errorMessage || 'Unknown error'), id]
        );
        return;
      }

      await db.run(
        `
        UPDATE ${tableName}
        SET retry_count = COALESCE(retry_count, 0) + 1,
            last_error = ?
        WHERE id = ?
        `,
        [String(errorMessage || 'Unknown error'), id]
      );
    } catch (err) {
      console.error(`❌ Gagal update retry ${tableName}:`, err);
    }
  },

  async markSynced(tableName, id) {
    const db = getDb();
    if (!db) return;

    try {
      if (tableName === 'kunjungan_offline') {
        await db.run(`DELETE FROM kunjungan_offline WHERE id = ?`, [id]);
        return;
      }

      await db.run(
        `
        UPDATE ${tableName}
        SET status_sync = 'synced',
            synced_at = ?,
            last_error = NULL
        WHERE id = ?
        `,
        [nowIso(), id]
      );
    } catch (err) {
      console.error(`❌ Gagal mark synced ${tableName}:`, err);
    }
  },

  async parseItemsJson(raw) {
    try {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      return JSON.parse(raw);
    } catch (err) {
      console.error('❌ Gagal parse items_json:', err);
      return [];
    }
  },

  // =========================
  // 📥 BIG SYNC MASTER
  // =========================
async downloadFullMasterData(){
  const db = getDb();
  if (!db) {
    return { success: false, message: 'Database belum siap' };
  }

  try {
    const hasPending = await this.hasAnyPendingData();

    if (hasPending) {
      console.warn('⏳ Big sync ditunda karena masih ada data offline pending');
      return {
        success: false,
        message: 'Masih ada data offline yang belum tersinkron'
      };
    }

    console.log('📥 Memulai Big Sync...');

    // =========================
    // A. BIG SYNC JADWAL + STATS
    // =========================
    const res = await api.get('/api/sync/big-sync');

    if (!res?.data?.success) {
      return {
        success: false,
        message: res?.data?.message || 'Big sync gagal'
      };
    }

    const data = res.data.payload || {};

    // =========================
    // B. SINKRONISASI JADWAL
    // =========================
    if (Array.isArray(data.jadwal)) {
      await db.execute(`DELETE FROM kunjungan_toko`);

      for (const t of data.jadwal) {
        const kode = String(t.Kode || '').trim();
        const plafonId = getVisitPlafonId(t);

        await db.run(
          `
          INSERT OR REPLACE INTO kunjungan_toko
          (kode, nama, alamat, kota, telpon, latitude, longitude, id_plafon, kode_plafon, kode_principal, nama_principal, id_kunjungan,
           is_visited, is_checkout, total_piutang, sisa_plafon, qrcode, alasan, local_modified, updated_at_local)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
          `,
          [
            kode,
            String(t.Nama || '').trim(),
            t.Alamat || '',
            t.Kota || '',
            t.Telpon || '',
            t.Latitude || '',
            t.Longitude || '',
            plafonId,
            getVisitPlafonCode(t),
            getVisitPrincipalCode(t),
            getVisitPrincipalName(t),
            t.IDKunjungan || '',
            t.isVisited ? 1 : 0,
            t.isCheckOut ? 1 : 0,
            Number(t.TotalPiutang || 0),
            Number(t.SisaPlafon || 0),
            t.QRCode || '',
            t.AlasanFailed || ''
          ]
        );
      }

      console.log('📍 Jadwal kunjungan berhasil di-sync ke SQLite');
    }

    // =========================
    // C. SINKRONISASI STATS
    // =========================
    if (data.stats) {
      await db.execute('DELETE FROM stats');

      const s = data.stats;
      const statsMap = [
        ['target_sales', s.target],
        ['value_order', s.order],
        ['value_faktur', s.faktur],
        ['atmd_cp', s.cp],
        ['atmd_at', s.at],
        ['atmd_eco', s.eco],
        ['atmd_ecf', s.ecf]
      ];

      for (const [key, val] of statsMap) {
        await db.run(
          'INSERT INTO stats (key, value) VALUES (?, ?)',
          [key, String(val || 0)]
        );
      }

      console.log('📊 Stats berhasil di-sync ke SQLite');
    }

    await setSyncTimestamp('last_sync');

    return { success: true, message: 'Big sync berhasil' };
  } catch (err) {
    console.error('❌ Gagal Big Sync:', err);
    return {
      success: false,
      message: err?.response?.data?.message || err?.message || 'Terjadi kesalahan saat big sync'
    };
  }
},

  // =========================
  // 📥 BIG SYNC MASTER STOK
  // =========================
async downloadStokMasterData(){
  const db = getDb();
  if (!db) {
    return { success: false, message: 'Database belum siap' };
  }

  try {
    const hasPending = await this.hasAnyPendingData();

    if (hasPending) {
      console.warn('⏳ Big sync ditunda karena masih ada data offline pending');
      return {
        success: false,
        message: 'Masih ada data offline yang belum tersinkron'
      };
    }

    console.log('📥 Memulai Big Sync Stok...');
// =========================
    // D. SINKRONISASI STOK MASTER
    // =========================
    const resStok = await api.get('/api/sync/big-sync-stok');

    if (resStok?.data?.success) {
      const stokList = Array.isArray(resStok.data.payload) ? resStok.data.payload : [];

      await db.execute('DELETE FROM stok_master');

      for (const item of stokList) {
        await db.run(
          `
          INSERT OR REPLACE INTO stok_master
          (kode, nama, satuan, nama_unit, nama_brand, brand, harga, suggestion, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            String(item.Kode || '').trim(),
            String(item.Nama || '').trim(),
            String(item.Satuan || '').trim(),
            String(item.NamaUnit || '').trim(),
            String(item.NamaBrand || '').trim(),
            String(item.Principle || '').trim(),
            Number(item.HargaE || 0),
            Number(item.Suggestion || 0),
            nowIso()
          ]
        );
      }

      console.log(`📦 Stok master berhasil di-sync ke SQLite (${stokList.length} item)`);
    } else {
      console.warn('⚠️ Sync stok master dilewati:', resStok?.data?.message || 'Unknown');
    }

    // =========================
    // E. SINKRONISASI REASON HISTORY
    // =========================
    const resReason = await api.get('/api/sync/big-sync-reason');

    if (resReason?.data?.success) {
      const reasonList = Array.isArray(resReason.data.payload) ? resReason.data.payload : [];

      await db.run(
        `
        INSERT OR REPLACE INTO app_cache (cache_key, payload_json, updated_at)
        VALUES (?, ?, ?)
        `,
        ['reason_history', JSON.stringify(reasonList), nowIso()]
      );

      console.log(`📝 Reason history berhasil di-cache (${reasonList.length} item)`);
    } else {
      console.warn('⚠️ Sync reason history dilewati:', resReason?.data?.message || 'Unknown');
    }

    await setSyncTimestamp('last_sync');

    return { success: true, message: 'Big sync berhasil' };
  } catch (err) {
    console.error('❌ Gagal Big Sync:', err);
    return {
      success: false,
      message: err?.response?.data?.message || err?.message || 'Terjadi kesalahan saat big sync'
    };
  }
},

  // =========================
  // 📥 BIG SYNC MASTER Reason
  // =========================
async downloadReasonMasterData(){
  const db = getDb();
  if (!db) {
    return { success: false, message: 'Database belum siap' };
  }

  try {
    const hasPending = await this.hasAnyPendingData();

    if (hasPending) {
      console.warn('⏳ Big sync ditunda karena masih ada data offline pending');
      return {
        success: false,
        message: 'Masih ada data offline yang belum tersinkron'
      };
    }

    console.log('📥 Memulai Big Sync reason...');
    // =========================
    // E. SINKRONISASI REASON HISTORY
    // =========================
    const resReason = await api.get('/api/sync/big-sync-reason');

    if (resReason?.data?.success) {
      const reasonList = Array.isArray(resReason.data.payload) ? resReason.data.payload : [];

      await db.run(
        `
        INSERT OR REPLACE INTO app_cache (cache_key, payload_json, updated_at)
        VALUES (?, ?, ?)
        `,
        ['reason_history', JSON.stringify(reasonList), nowIso()]
      );

      console.log(`📝 Reason history berhasil di-cache (${reasonList.length} item)`);
    } else {
      console.warn('⚠️ Sync reason history dilewati:', resReason?.data?.message || 'Unknown');
    }

    await setSyncTimestamp('last_sync');

    return { success: true, message: 'Big sync berhasil' };
  } catch (err) {
    console.error('❌ Gagal Big Sync:', err);
    return {
      success: false,
      message: err?.response?.data?.message || err?.message || 'Terjadi kesalahan saat big sync'
    };
  }
},

async downloadLightMasterData() {
  const db = getDb();
  if (!db) {
    return { success: false, message: 'Database belum siap' };
  }

  try {
    const hasPending = await this.hasAnyPendingData();

    if (hasPending) {
      console.warn('⏳ Light sync ditunda karena masih ada data offline pending');
      return {
        success: false,
        message: 'Masih ada data offline yang belum tersinkron'
      };
    }

    console.log('📥 Memulai Light Sync...');
    const res = await api.get('/api/sync/big-sync');

    if (!res?.data?.success) {
      return {
        success: false,
        message: res?.data?.message || 'Light sync gagal'
      };
    }

    const data = res.data.payload || {};

    // =========================
    // A. SINKRONISASI JADWAL
    // =========================
    if (Array.isArray(data.jadwal)) {
      await db.execute(`DELETE FROM kunjungan_toko`);

      for (const t of data.jadwal) {
        const kode = String(t.Kode || '').trim();
        const plafonId = getVisitPlafonId(t);
        console.log("daftar toko:", data.jadwal);

        await db.run(
          `
          INSERT OR REPLACE INTO kunjungan_toko
          (kode, nama, alamat, kota, telpon, latitude, longitude, id_plafon, kode_plafon, kode_principal, nama_principal, id_kunjungan,
           is_visited, is_checkout, total_piutang, sisa_plafon, qrcode, alasan, local_modified, updated_at_local)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
          `,
          [
            kode,
            String(t.Nama || '').trim(),
            t.Alamat || '',
            t.Kota || '',
            t.Telpon || '',
            t.Latitude || '',
            t.Longitude || '',
            plafonId,
            getVisitPlafonCode(t),
            getVisitPrincipalCode(t),
            getVisitPrincipalName(t),
            t.IDKunjungan || '',
            t.isVisited ? 1 : 0,
            t.isCheckOut ? 1 : 0,
            Number(t.TotalPiutang || 0),
            Number(t.SisaPlafon || 0),
            t.QRCode || '',
            t.AlasanFailed || ''
          ]
        );
      }

      console.log('📍 Jadwal kunjungan berhasil di-sync ke SQLite');
    }

    // =========================
    // B. SINKRONISASI STATS
    // =========================
    if (data.stats) {
      await db.execute('DELETE FROM stats');

      const s = data.stats;
      const statsMap = [
        ['target_sales', s.target],
        ['value_order', s.order],
        ['value_faktur', s.faktur],
        ['atmd_cp', s.cp],
        ['atmd_at', s.at],
        ['atmd_eco', s.eco],
        ['atmd_ecf', s.ecf]
      ];

      for (const [key, val] of statsMap) {
        await db.run(
          'INSERT INTO stats (key, value) VALUES (?, ?)',
          [key, String(val || 0)]
        );
      }

      console.log('📊 Stats berhasil di-sync ke SQLite');
    }

    await setSyncTimestamp('last_light_sync');

    return { success: true, message: 'Light sync berhasil' };
  } catch (err) {
    console.error('❌ Gagal Light Sync:', err);
    return {
      success: false,
      message: err?.response?.data?.message || err?.message || 'Terjadi kesalahan saat light sync'
    };
  }
},

  // =========================
  // 📤 UPLOAD KUNJUNGAN
  // =========================
async uploadPendingKunjunganData() {
  return withUploadLock('kunjungan', async () => {
  const db = getDb();
  const connectivity = useConnectivityStore();

  if (!db) return { success: false, message: 'Database belum siap' };
  if (!connectivity.isOnline) {
    return { success: false, message: 'Masih offline' };
  }

  try {
    const res = await db.query(
      `
      SELECT *
      FROM kunjungan_offline
      WHERE status IN ('pending', 'pending_checkout', 'pending_reason')
      ORDER BY id ASC
      `
    );

    const items = res.values || [];

    if (items.length === 0) {
      return { success: true, message: 'Tidak ada data pending kunjungan' };
    }

    console.log(`📡 Memulai sinkronisasi kunjungan: ${items.length} data...`);

    for (const item of items) {
      try {
        let response;

        // =========================
        // A. CHECK-IN
        // =========================
        if (item.status === 'pending') {
          response = await api.post('/api/kunjungan/save?env=production', {
            Kode: item.kode_toko,
            id_plafon: normalizePlafonId(item.id_plafon),
            Latitude: item.lat,
            Longitude: item.lng,
            WaktuOffline: item.waktu_checkin
          });

          // console.log('respon upload data:', response);

          if (response?.data?.success) {
            let idAsli =
              response?.data?.id_kunjungan ||
              response?.data?.IDKunjungan ||
              null;

            const idSementara = item.id_kunjungan || '';

            // fallback: kalau API save tidak mengembalikan ID,
            // ambil khusus untuk toko yang sedang diproses
            if (!idAsli) {
              const [listJadwal, listSudahKunjung] = await Promise.all([
                getVisitSchedule(),
                getVisitList()
              ]);

              const kodeClean = String(item.kode_toko || '').trim();
              const plafonId = normalizePlafonId(item.id_plafon);
              const sameScope = (row) => (
                String(row.Kode || '').trim() === kodeClean &&
                (!plafonId || getVisitPlafonId(row) === plafonId)
              );

              const jadwalItem = listJadwal.find(sameScope);

              const daftarItem = listSudahKunjung.find(sameScope);

              idAsli =
                daftarItem?.IDKunjungan ||
                jadwalItem?.IDKunjungan ||
                null;
            }

            if (!idAsli) {
              throw new Error(`ID kunjungan server tidak ditemukan untuk toko ${item.kode_toko}`);
            }

            // update semua row offline terkait outlet ini
            await db.run(
              `
              UPDATE kunjungan_offline
              SET id_kunjungan = ?
              WHERE kode_toko = ?
                AND COALESCE(id_plafon, '') = ?
                AND (
                  id_kunjungan = ?
                  OR id_kunjungan IS NULL
                  OR id_kunjungan = ''
                  OR id_kunjungan LIKE 'OFF%'
                )
              `,
              [idAsli, item.kode_toko, normalizePlafonId(item.id_plafon), idSementara]
            );

            // update master jadwal lokal
            await db.run(
              `
              UPDATE kunjungan_toko
              SET is_visited = 1,
                  id_kunjungan = ?,
                  local_modified = 0,
                  updated_at_local = ?
              WHERE kode = ? AND id_plafon = ?
              `,
              [idAsli, nowIso(), item.kode_toko, normalizePlafonId(item.id_plafon)]
            );

            // row yang sedang diproses selesai
            await this.markSynced('kunjungan_offline', item.id);
            console.log(`✅ Check-in terkirim. ID ${idSementara || '(kosong)'} → ${idAsli}`);
          } else {
            throw new Error(response?.data?.message || 'Gagal kirim check-in');
          }
        }

        // =========================
        // B. ALASAN
        // =========================
        else if (item.status === 'pending_reason') {
          let finalId = item.id_kunjungan;

          if (!finalId || String(finalId).includes('OFF')) {
            finalId = await this.getIdKunjungan(item.kode_toko, item.id_plafon);
          }

          if (!finalId) {
            console.warn(`⏳ Reason ${item.nama_toko} ditunda karena ID belum ada`);
            await this.markSyncFailed(
              'kunjungan_offline',
              item.id,
              `Reason ditunda: ID kunjungan belum ada untuk toko ${item.kode_toko}`
            );
            continue;
          }

          const payload = {
            IDKunjungan: finalId,
            Kode: item.kode_toko,
            id_plafon: normalizePlafonId(item.id_plafon),
            Alasan: '-',
            AlasanNoOrder: item.alasan
          };

          console.log('📤 Payload save reason:', payload);

          response = await api.post('/api/kunjungan/save-reason', payload);

          console.log('📥 Response save reason:', response?.data);

          if (response?.data?.success === true) {
            await db.run(
              `
              UPDATE kunjungan_toko
              SET alasan = ?,
                  local_modified = 0,
                  updated_at_local = ?
              WHERE kode = ? AND id_plafon = ?
              `,
              [item.alasan, nowIso(), item.kode_toko, normalizePlafonId(item.id_plafon)]
            );

            await this.markSynced('kunjungan_offline', item.id);
            console.log(`✅ Alasan terkirim untuk toko: ${item.kode_toko}`);
          } else {
            throw new Error(
              response?.data?.message ||
              JSON.stringify(response?.data) ||
              'Gagal kirim alasan'
            );
          }
        }

        // =========================
        // C. CHECKOUT
        // =========================
        else if (item.status === 'pending_checkout') {
          let finalId = item.id_kunjungan;

          // fallback 1: ambil dari master jadwal lokal
          if (!finalId || String(finalId).includes('OFF')) {
            finalId = await this.getIdKunjungan(item.kode_toko, item.id_plafon);
          }

          // fallback 2: cari ID final di kunjungan_offline untuk outlet yang sama
          if (!finalId) {
            const fallbackRes = await db.query(
              `
              SELECT id_kunjungan
              FROM kunjungan_offline
              WHERE kode_toko = ?
                AND COALESCE(id_plafon, '') = ?
                AND id_kunjungan IS NOT NULL
                AND id_kunjungan <> ''
                AND id_kunjungan NOT LIKE 'OFF%'
              ORDER BY id DESC
              LIMIT 1
              `,
              [item.kode_toko, normalizePlafonId(item.id_plafon)]
            );

            finalId = fallbackRes.values?.[0]?.id_kunjungan || null;
          }

          if (!finalId) {
            console.warn(`⏳ Checkout ${item.nama_toko} ditunda karena ID belum sinkron`);
            continue;
          }

          response = await api.post('/api/kunjungan/checkout', {
            IDKunjungan: finalId,
            WaktuOffline: item.waktu_checkout || item.waktu_checkin
          });

          if (response?.data?.success) {
            await db.run(
              `
              UPDATE kunjungan_toko
              SET is_visited = 1,
                  is_checkout = 1,
                  id_kunjungan = ?,
                  local_modified = 0,
                  updated_at_local = ?
              WHERE kode = ? AND id_plafon = ?
              `,
              [finalId, nowIso(), item.kode_toko, normalizePlafonId(item.id_plafon)]
            );

            await this.markSynced('kunjungan_offline', item.id);
            console.log(`✅ Check-out sukses dengan ID: ${finalId}`);
          } else {
            throw new Error(response?.data?.message || 'Gagal kirim checkout');
          }
        }
      } catch (e) {
        console.error(`❌ Gagal sync kunjungan ${item.nama_toko}:`, e?.message || e);
        if (isConnectivityError(e)) {
          return { success: false, message: 'Koneksi terputus saat sinkronisasi kunjungan' };
        }
        await this.markSyncFailed('kunjungan_offline', item.id, e?.message || e);
        continue;
      }
    }

    return { success: true, message: 'Sinkronisasi kunjungan selesai diproses' };
  } catch (err) {
    console.error('❌ Sync Kunjungan Error:', err);
    return {
      success: false,
      message: err?.message || 'Terjadi kesalahan saat upload kunjungan'
    };
  }
  });
},

  // =========================
  // 📤 UPLOAD SALES ORDER
  // =========================
  async uploadPendingSalesOrderData() {
    return withUploadLock('sales_order', async () => {
    const db = getDb();
    const connectivity = useConnectivityStore();

    if (!db) return { success: false, message: 'Database belum siap' };
    if (!connectivity.isOnline) {
      return { success: false, message: 'Masih offline' };
    }

    try {
      const res = await db.query(
        `
        SELECT *
        FROM sales_order_offline
        WHERE status_sync = 'pending'
        ORDER BY id ASC
        `
      );

      const items = res.values || [];

      if (items.length === 0) {
        return { success: true, message: 'Tidak ada sales order pending' };
      }

      console.log(`📦 Upload sales order pending: ${items.length} data...`);

      for (const item of items) {
        try {
          // SalesOrder.vue menyimpan items_json sebagai object {items, keterangan, subtotal, ppn}
          const rawParsed = await this.parseItemsJson(item.items_json);
          const parsedItems = Array.isArray(rawParsed)
            ? rawParsed
            : (Array.isArray(rawParsed?.items) ? rawParsed.items : []);
          const keterangan = rawParsed?.keterangan || '';
          const subtotal = Number(rawParsed?.subtotal || 0);
          const subtotalBruto = Number(rawParsed?.subtotal_bruto || subtotal || 0);
          const subtotalPenjualan = Number(rawParsed?.subtotal_penjualan || subtotalBruto || 0);
          const subtotalDiskon = Number(rawParsed?.subtotal_diskon || rawParsed?.promo_discount || rawParsed?.voucher_discount || 0);
          const ppn = Number(rawParsed?.ppn || 0);
          const pajak = Number(rawParsed?.pajak || ppn || 0);
          const dpp = Number(rawParsed?.dpp || subtotal || 0);

          const response = await api.post('/api/transaksi/save', {
            unique_id: item.order_id,
            tanggal: dateInputToLocalDateTime(item.tanggal, item.created_at || new Date()),
            jatuh_tempo: dateInputToLocalDateTime(item.jatuh_tempo, item.created_at || new Date()),
            customer: {
              Kode: item.kode_customer,
              Nama: item.nama_customer
            },
            keterangan,
            items: parsedItems,
            products: parsedItems,
            subtotal,
            subtotalorder: subtotal,
            subtotal_penjualan: subtotalPenjualan,
            subtotal_bruto: subtotalBruto,
            subtotal_diskon: subtotalDiskon,
            promo_discount: Number(rawParsed?.promo_discount || subtotalDiskon || 0),
            voucher_discount: Number(rawParsed?.voucher_discount || subtotalDiskon || 0),
            dpp,
            pajak,
            promo_application: rawParsed?.promo_application || null,
            promo_preview: rawParsed?.promo_preview || null,
            applied_promos: rawParsed?.applied_promos || [],
            vouchers: rawParsed?.vouchers || null,
            ppn,
            ppnorder: ppn,
            total_penjualan: Number(item.total_penjualan || 0),
            totalorder: Number(item.total_penjualan || 0),
          });

          if (response?.data?.success) {
            await this.markSynced('sales_order_offline', item.id);
            console.log(`✅ Sales order synced: ${item.order_id}`);
          } else {
            throw new Error(response?.data?.message || 'Gagal upload sales order');
          }
        } catch (e) {
          console.error(`❌ Gagal sync sales order ${item.order_id}:`, e?.message || e);
          if (isConnectivityError(e)) {
            return { success: false, message: 'Koneksi terputus saat sinkronisasi sales order' };
          }
          await this.markSyncFailed('sales_order_offline', item.id, e?.message || e);
        }
      }

      return { success: true, message: 'Sinkronisasi sales order selesai diproses' };
    } catch (err) {
      console.error('❌ Sync Sales Order Error:', err);
      return {
        success: false,
        message: err?.message || 'Terjadi kesalahan saat upload sales order'
      };
    }
    });
  },

  // =========================
  // 📤 UPLOAD PAYMENT
  // =========================
  async uploadPendingPaymentData() {
    return withUploadLock('payment', async () => {
    const db = getDb();
    const connectivity = useConnectivityStore();

    if (!db) return { success: false, message: 'Database belum siap' };
    if (!connectivity.isOnline) {
      return { success: false, message: 'Masih offline' };
    }

    try {
      const res = await db.query(
        `
        SELECT *
        FROM payment_offline
        WHERE status_sync = 'pending'
        ORDER BY id ASC
        `
      );

      const items = res.values || [];

      if (items.length === 0) {
        return { success: true, message: 'Tidak ada payment pending' };
      }

      console.log(`💳 Upload payment pending: ${items.length} data...`);

      for (const item of items) {
        try {
          let metadata = {};
          try {
            metadata = item.metadata_json ? JSON.parse(item.metadata_json) : {};
          } catch (_) {
            metadata = {};
          }

          const response = await api.post('/api/payment/save', {
            payment_id: metadata.payment_id || item.payment_id || '',
            nota: item.nota,
            total_bayar: Number(item.total_bayar || 0),
            total_tagihan: Number(item.total_tagihan || 0),
            metode: item.metode,
            no_bukti: item.no_bukti || '',
            kode_customer: item.kode_customer,
            status: item.status_pembayaran || 'LUNAS',
            credit_note_id: metadata.credit_note_id || '',
            credit_note_no: metadata.credit_note_no || '',
            credit_note_amount: Number(metadata.credit_note_amount || 0),
            credit_notes: Array.isArray(metadata.credit_notes) ? metadata.credit_notes : [],
            // Retain the exact source selected before the app went offline.
            // A parent invoice may cover several principal-specific SOs, so
            // retrying only by its displayed invoice number is unsafe.
            id_sales_order: metadata.id_sales_order || null,
            id_faktur: metadata.id_faktur || null,
            selected_nota_key: metadata.selected_nota_key || null
          });

          if (response?.data?.success) {
            await this.markSynced('payment_offline', item.id);
            console.log(`✅ Payment synced: ${item.payment_id}`);
          } else {
            throw new Error(response?.data?.message || 'Gagal upload payment');
          }
        } catch (e) {
          const message = (
            e?.response?.data?.message
            || e?.response?.data?.error
            || e?.message
            || e
          );
          console.error(`❌ Gagal sync payment ${item.payment_id}:`, message);
          if (isConnectivityError(e)) {
            return { success: false, message: 'Koneksi terputus saat sinkronisasi pembayaran' };
          }
          await this.markSyncFailed('payment_offline', item.id, message);
        }
      }

      return { success: true, message: 'Sinkronisasi payment selesai diproses' };
    } catch (err) {
      console.error('❌ Sync Payment Error:', err);
      return {
        success: false,
        message: err?.message || 'Terjadi kesalahan saat upload payment'
      };
    }
    });
  },

  // =========================
  // 📤 UPLOAD RETUR
  // =========================
  async uploadPendingReturData() {
    return withUploadLock('retur', async () => {
    const db = getDb();
    const connectivity = useConnectivityStore();

    if (!db) return { success: false, message: 'Database belum siap' };
    if (!connectivity.isOnline) {
      return { success: false, message: 'Masih offline' };
    }

    try {
      const res = await db.query(
        `
        SELECT *
        FROM retur_offline
        WHERE status_sync = 'pending'
        ORDER BY id ASC
        `
      );

      const items = res.values || [];

      if (items.length === 0) {
        return { success: true, message: 'Tidak ada retur pending' };
      }

      console.log(`🔁 Upload retur pending: ${items.length} data...`);

      for (const item of items) {
        try {
          const rawParsed = await this.parseItemsJson(item.items_json);
          const parsedItems = Array.isArray(rawParsed)
            ? rawParsed
            : (Array.isArray(rawParsed?.items) ? rawParsed.items : []);
          const parsedProducts = Array.isArray(rawParsed?.products) ? rawParsed.products : parsedItems;
          // `retur_id` is the durable mobile ID.  Reuse it after a timeout so
          // the API can acknowledge the original request instead of creating
          // a second return (or rejecting its own successful first attempt).
          const clientReturId = String(
            rawParsed?.client_retur_id || rawParsed?.retur_id || item.retur_id || ''
          ).trim();

          const response = await api.post('/api/retur/save', {
            retur_id: clientReturId,
            client_retur_id: clientReturId,
            idempotency_key: clientReturId,
            id_sales_order: rawParsed?.id_sales_order || rawParsed?.source_sales_order_id || null,
            source_sales_order_id: rawParsed?.id_sales_order || rawParsed?.source_sales_order_id || null,
            // Preserve the printed invoice/order reference that was selected
            // when the return was queued.  The numeric source order remains
            // the authoritative identifier; this field supports traceability.
            source_reference: rawParsed?.source_reference || '',
            kode_customer: item.kode_customer,
            id_plafon: normalizePlafonId(rawParsed?.id_plafon),
            id_kunjungan: item.id_kunjungan || '',
            tanggal_transaksi: rawParsed?.tanggal_transaksi || '',
            tanggal_retur_pengajuan: rawParsed?.tanggal_retur_pengajuan || rawParsed?.tanggal_transaksi || '',
            keterangan: rawParsed?.keterangan || '',
            items: parsedItems,
            products: parsedProducts,
            subtotal: Number(rawParsed?.subtotal || 0),
            ppn: Number(rawParsed?.ppn || 0),
            total_retur: Number(item.total_retur || 0)
          });

          if (response?.data?.success === true || String(response?.data?.status || '').toLowerCase() === 'success') {
            await this.markSynced('retur_offline', item.id);
            console.log(`✅ Retur synced: ${item.retur_id}`);
          } else {
            throw new Error(response?.data?.message || 'Gagal upload retur');
          }
        } catch (e) {
          console.error(`❌ Gagal sync retur ${item.retur_id}:`, e?.message || e);
          if (isConnectivityError(e)) {
            return { success: false, message: 'Koneksi terputus saat sinkronisasi retur' };
          }
          await this.markSyncFailed('retur_offline', item.id, e?.message || e);
        }
      }

      return { success: true, message: 'Sinkronisasi retur selesai diproses' };
    } catch (err) {
      console.error('❌ Sync Retur Error:', err);
      return {
        success: false,
        message: err?.message || 'Terjadi kesalahan saat upload retur'
      };
    }
    });
  },

  // =========================
  // 📤 UPLOAD STOCK OPNAME
  // =========================
  async uploadPendingStockOpnameData() {
    return withUploadLock('stock_opname', async () => {
    const db = getDb();
    const connectivity = useConnectivityStore();

    if (!db) return { success: false, message: 'Database belum siap' };
    if (!connectivity.isOnline) {
      return { success: false, message: 'Masih offline' };
    }

    try {
      const res = await db.query(
        `
        SELECT *
        FROM stock_opname_offline
        WHERE status_sync = 'pending'
        ORDER BY id ASC
        `
      );

      const items = res.values || [];

      if (items.length === 0) {
        return { success: true, message: 'Tidak ada stock opname pending' };
      }

      console.log(`📦 Upload stock opname pending: ${items.length} data...`);

      for (const item of items) {
        try {
          const parsedItems = await this.parseItemsJson(item.items_json);

          const response = await api.post('/api/kunjungan/stok-opname/save', {
            id_kunjungan: item.id_kunjungan,
            KodeCustomer: item.kode_customer,
            Items: parsedItems
          });

          if (response?.data?.success) {
            await this.markSynced('stock_opname_offline', item.id);
            console.log(`✅ Stock opname synced: ${item.opname_id}`);
          } else {
            throw new Error(response?.data?.message || 'Gagal upload stock opname');
          }
        } catch (e) {
          console.error(`❌ Gagal sync stock opname ${item.opname_id}:`, e?.message || e);
          if (isConnectivityError(e)) {
            return { success: false, message: 'Koneksi terputus saat sinkronisasi stock opname' };
          }
          await this.markSyncFailed('stock_opname_offline', item.id, e?.message || e);
        }
      }

      return { success: true, message: 'Sinkronisasi stock opname selesai diproses' };
    } catch (err) {
      console.error('❌ Sync Stock Opname Error:', err);
      return {
        success: false,
        message: err?.message || 'Terjadi kesalahan saat upload stock opname'
      };
    }
    });
  },

  // =========================
  // 📤 UPLOAD SEMUA PENDING
  // =========================
  async uploadAllPendingData() {
    const connectivity = useConnectivityStore();

    if (!connectivity.isOnline) {
      return { success: false, message: 'Masih offline' };
    }

    try {
      const results = [];
      const runStep = async (syncFn) => {
        const result = await syncFn();
        results.push(result);

        if (!result?.success && isConnectivityError(result)) {
          return false;
        }

        return true;
      };

      if (!await runStep(() => this.uploadPendingKunjunganData())) {
        return { success: false, message: 'Koneksi terputus saat upload pending', results };
      }
      if (!await runStep(() => this.uploadPendingSalesOrderData())) {
        return { success: false, message: 'Koneksi terputus saat upload pending', results };
      }
      if (!await runStep(() => this.uploadPendingPaymentData())) {
        return { success: false, message: 'Koneksi terputus saat upload pending', results };
      }
      if (!await runStep(() => this.uploadPendingReturData())) {
        return { success: false, message: 'Koneksi terputus saat upload pending', results };
      }
      if (!await runStep(() => this.uploadPendingStockOpnameData())) {
        return { success: false, message: 'Koneksi terputus saat upload pending', results };
      }

      const failed = results.filter((r) => !r.success);

      if (failed.length > 0) {
        return {
          success: false,
          message: 'Sebagian sinkronisasi gagal',
          results
        };
      }

      return {
        success: true,
        message: 'Semua data pending selesai diproses',
        results
      };
    } catch (err) {
      console.error('❌ Upload all pending error:', err);
      return {
        success: false,
        message: err?.message || 'Terjadi kesalahan saat upload semua pending data'
      };
    }
  },

  // backward compatibility
  async uploadPendingData() {
    return this.uploadPendingKunjunganData();
  },

  // =========================
  // 🔎 GET ID KUNJUNGAN
  // =========================
  async getIdKunjungan(kodeToko, idPlafon = '') {
    const db = getDb();
    if (!db) return null;

    const plafonId = normalizePlafonId(idPlafon);

    const res = await db.query(
      'SELECT id_kunjungan FROM kunjungan_toko WHERE kode = ? AND id_plafon = ?',
      [kodeToko, plafonId]
    );

    const directId = res.values?.[0]?.id_kunjungan || null;
    if (directId && !String(directId).includes('OFF')) {
      return directId;
    }

    const fallback = await db.query(
      `
      SELECT id_kunjungan
      FROM kunjungan_offline
      WHERE kode_toko = ?
        AND COALESCE(id_plafon, '') = ?
        AND id_kunjungan IS NOT NULL
        AND id_kunjungan <> ''
        AND id_kunjungan NOT LIKE 'OFF%'
      ORDER BY id DESC
      LIMIT 1
      `,
      [kodeToko, plafonId]
    );

    return fallback.values?.[0]?.id_kunjungan || null;
  },

  async syncStokMaster() {
    const db = getDb();
    if (!db) return { success: false, message: 'Database belum siap' };

    try {
      const res = await api.get('/api/sync/big-sync-stok');
      const items = Array.isArray(res.data?.payload) ? res.data.payload : [];

      if (items.length > 0) {
        await db.execute('DELETE FROM stok_master');

        for (const item of items) {
          await db.run(
            `INSERT OR REPLACE INTO stok_master
            (kode, nama, satuan, nama_unit, nama_brand, brand, harga, suggestion, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              String(item.Kode || '').trim(),
              String(item.Nama || '').trim(),
              String(item.Satuan || '').trim(),
              String(item.NamaUnit || '').trim(),
              String(item.NamaBrand || '').trim(),
              String(item.Principle || '').trim(),
              Number(item.HargaE || 0),
              Number(item.Suggestion || 0),
              nowIso()
            ]
          );
        }
      }

      return { success: true, total: items.length };
    } catch (err) {
      console.error('❌ syncStokMaster error:', err);
      return { success: false, message: err?.message || 'Gagal sync stok master' };
    }
  }

};



export default SyncService;

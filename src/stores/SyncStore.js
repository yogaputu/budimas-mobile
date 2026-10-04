import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/api/axios';
import { getDb } from '@/services/database';

export const useSyncStore = defineStore('sync', () => {
  // --- STATE (Data yang disimpan) ---
  const isSyncing = ref(false);
  const syncPercent = ref(0);
  const syncCurrent = ref(0);
  const syncTotal = ref(0);
  const lastSyncType = ref(''); // 'stok' atau 'reason'

  // --- ACTIONS (Fungsi Logika) ---
  
  // Fungsi Utama Sync Stok
  const startSyncStok = async () => {
    const db = getDb();
    if (!db || isSyncing.value) return;

    isSyncing.value = true;
    syncPercent.value = 0;
    lastSyncType.value = 'stok';

    try {
      const res = await api.get('/api/sync/big-sync-stok');
      const stokList = Array.isArray(res.data.payload) ? res.data.payload : [];
      syncTotal.value = stokList.length;

      if (syncTotal.value > 0) {
        await db.execute('DELETE FROM stok_master');

        for (let i = 0; i < syncTotal.value; i++) {
          const item = stokList[i];
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
              new Date().toISOString()
            ]
          );

          // Update Progress ke UI setiap 10 data
          if (i % 10 === 0 || i === syncTotal.value - 1) {
            syncCurrent.value = i + 1;
            syncPercent.value = Math.round(((i + 1) / syncTotal.value) * 100);
          }
        }
      }
      return { success: true, total: syncTotal.value };
    } catch (error) {
      console.error("Sync Store Error:", error);
      throw error;
    } finally {
      isSyncing.value = false;
    }
  };

  return {
    isSyncing,
    syncPercent,
    syncCurrent,
    syncTotal,
    lastSyncType,
    startSyncStok
  };
});
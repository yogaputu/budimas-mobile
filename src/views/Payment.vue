<template>
  <div class="page-wrapper">
    <div class="payment-container">
      <header class="header">
        <button @click="$router.back()" class="btn-back" aria-label="Kembali" title="Kembali"><font-awesome-icon icon="chevron-left" /></button>
        <div class="header-title">
          <h3>Input Pembayaran</h3>
          <p>{{ customerData.Nama }}</p>
        </div>
      </header>

      <div v-if="isOffline" class="offline-banner">
        MODE OFFLINE AKTIF - pembayaran akan masuk antrean lokal
      </div>

      <main class="scroll-area">
        <div class="lph-empty-hint"><p>Untuk LPH Kuitansi, catat klaim di menu baru.</p><button type="button" @click="router.push('/lph-kuitansi')">LPH & Klaim Pembayaran</button></div>
        <div v-if="loadingTagihan" class="state-container">
          <div class="loader-enterprise"></div>
          <p>{{ isOffline ? 'Memuat cache tagihan...' : 'Memuat tagihan...' }}</p>
        </div>

        <template v-else>
          <div class="form-card">
            <div v-if="pendingCount > 0" class="pending-box">
              <div>
                <strong>{{ pendingCount }} pembayaran pending</strong>
                <p>Upload saat online agar masuk ke server.</p>
              </div>
              <button class="btn-pending-sync" @click="uploadPendingPayments" :disabled="isOffline || isUploadingPending">
                {{ isUploadingPending ? 'Mengupload...' : 'Upload Pending' }}
              </button>
            </div>

            <div class="payment-summary-card" v-if="selectedNota">
              <div class="summary-line">
                <span>Nota</span>
                <strong>{{ selectedNota.Nota }}</strong>
              </div>
              <div class="summary-line">
                <span>Sisa Piutang</span>
                <strong class="text-primary">Rp {{ formatNumber(selectedNota.Piutang) }}</strong>
              </div>
              <div class="summary-line">
                <span>Status</span>
                <strong :class="['payment-status', selectedNota.StatusPembayaranClass]">
                  {{ selectedNota.StatusPembayaran }}
                </strong>
              </div>
              <div class="summary-line" v-if="selectedNota.NamaPrinciple">
                <span>Principle</span>
                <strong>{{ selectedNota.NamaPrinciple }}</strong>
              </div>
              <div class="summary-line" v-if="selectedNota.JatuhTempo">
                <span>Jatuh Tempo</span>
                <strong>{{ formatDate(selectedNota.JatuhTempo) }}</strong>
              </div>
            </div>

            <div class="input-group">
              <label>Pilih Nota Tagihan</label>
              <select v-model="form.selected_nota_key" @change="handleNotaChange" class="custom-select">
                <option value="">-- Pilih Nota --</option>
                <option v-for="n in payableNotaList" :key="n.selected_nota_key" :value="n.selected_nota_key">
                  {{ n.Nota }}<template v-if="n.NamaPrinciple"> · {{ n.NamaPrinciple }}</template><template v-if="n.NoOrder"> · {{ n.NoOrder }}</template> - {{ n.StatusPembayaran }} (Sisa: {{ formatNumber(n.Piutang) }})
                </option>
              </select>
              <small v-if="listNota.length > 0 && payableNotaList.length === 0" class="helper-success">
                Semua nota toko ini sudah lunas.
              </small>
              <div v-else-if="!isOffline && listNota.length === 0" class="lph-empty-hint">
                <span>Belum ada faktur dari LPH yang aktif untuk sales.</span>
                <button type="button" @click="router.push('/lph')">Buka LPH</button>
              </div>
            </div>

            <div v-if="selectedNota" class="info-piutang">
              <div class="piutang-row">
                <span>Total Piutang:</span>
                <b>Rp {{ formatNumber(selectedNota.TotalPiutang) }}</b>
              </div>
              <div v-if="selectedCreditNote" class="piutang-row">
                <span>Potongan CN:</span>
                <b>- Rp {{ formatNumber(selectedCreditNote.nominal_dipakai) }}</b>
              </div>
              <div class="piutang-row total-row">
                <span>Sisa Pembayaran:</span>
                <b>Rp {{ formatNumber(payableAfterCreditNote) }}</b>
              </div>
            </div>

            <div class="input-group">
              <label>Pilih Credit Note</label>
              <select v-model="form.credit_note_id" @change="updateCreditNote" class="custom-select">
                <option value="">-- Tanpa Credit Note --</option>
                <option v-for="cn in creditNoteList" :key="cn.id" :value="cn.id">
                  {{ cn.nomor }} - Rp {{ formatNumber(cn.sisa_nominal) }}
                </option>
              </select>
              <small v-if="creditNoteList.length === 0" class="helper-success">
                Tidak ada CN yang sudah LPH dan masih bisa digunakan.
              </small>
            </div>

            <div class="input-group">
              <label>Jumlah Bayar (Rp)</label>
              <input
                type="number"
                v-model.number="form.total_bayar"
                class="custom-input"
                placeholder="0"
                min="0"
              />
              <small v-if="selectedNota && Number(form.total_bayar) > payableAfterCreditNote" class="helper-error">
                Jumlah bayar tidak boleh melebihi sisa tagihan setelah CN.
              </small>
            </div>

            <div class="input-group">
              <label>Metode Pembayaran</label>
              <div class="method-grid">
                <button
                  type="button"
                  @click="form.metode = 'TUNAI'"
                  :aria-pressed="form.metode === 'TUNAI'"
                  :class="['btn-method', { active: form.metode === 'TUNAI' }]"
                >
                  <font-awesome-icon icon="money-bill-wave" />
                  <span>TUNAI</span>
                </button>
                <button
                  type="button"
                  @click="form.metode = 'TRANSFER'"
                  :aria-pressed="form.metode === 'TRANSFER'"
                  :class="['btn-method', { active: form.metode === 'TRANSFER' }]"
                >
                  <font-awesome-icon icon="file-invoice" />
                  <span>TRANSFER</span>
                </button>
              </div>
            </div>

            <div v-if="form.metode === 'TRANSFER'" class="input-group">
              <label>No. Ref / Bukti Transfer</label>
              <input
                type="text"
                v-model="form.no_bukti"
                class="custom-input"
                placeholder="Contoh: Kode Reff Bank"
              />
            </div>
          </div>
        </template>
      </main>

      <footer class="footer-action">
        <button @click="savePayment" class="btn-save-payment" :disabled="!isFormValid || isSaving">
          <font-awesome-icon :icon="isSaving ? 'sync-alt' : 'floppy-disk'" />
          <span>{{ isSaving ? 'Memproses...' : (isOffline ? 'Simpan Offline' : 'Simpan Pembayaran') }}</span>
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api/axios';
import Swal from 'sweetalert2';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { useConnectivityStore } from '@/stores/connectivity';
import { getDb } from '@/services/database';
import { SyncService } from '@/services/SyncService';
import { getPayloadArray } from '@/services/visitService';
import { filterLphReady } from '@/utils/lph';

const route = useRoute();
const router = useRouter();
const connectivity = useConnectivityStore();

const loadingTagihan = ref(false);
const isSaving = ref(false);
const isUploadingPending = ref(false);
const listNota = ref([]);
const creditNoteList = ref([]);
const selectedNota = ref(null);
const selectedCreditNote = ref(null);
const pendingCount = ref(0);

const isOffline = computed(() => !connectivity.isOnline);
const payableNotaList = computed(() =>
  listNota.value.filter((n) => (
    Number(n.Piutang || 0) > 0 &&
    n.StatusPembayaranClass !== 'is-paid'
  ))
);
const isSelectedNotaLunas = computed(() =>
  !!selectedNota.value && Number(selectedNota.value.Piutang || 0) <= 0
);
const creditNoteAmount = computed(() => Number(selectedCreditNote.value?.nominal_dipakai || 0));
const payableAfterCreditNote = computed(() =>
  Math.max(Number(selectedNota.value?.Piutang || 0) - creditNoteAmount.value, 0)
);

const customerData = computed(() => ({
  Kode: route.query.kode_customer || '',
  Nama: route.query.nama_toko || 'Pelanggan'
}));

const cacheKeyTagihan = computed(() => `payment:tagihan:${customerData.value.Kode}`);
const draftKey = computed(() => `payment:draft:${customerData.value.Kode}:${route.query.id_kunjungan || 'no_visit'}`);

const form = ref({
  payment_id: uuidv4(),
  nota: route.query.nota || '',
  selected_nota_key: route.query.selected_nota_key || '',
  total_bayar: route.query.total_bayar ? Number(route.query.total_bayar) : null,
  total_tagihan: route.query.total_tagihan ? Number(route.query.total_tagihan) : 0,
  credit_note_id: '',
  credit_note_no: '',
  credit_note_amount: 0,
  metode: route.query.metode || 'TUNAI',
  no_bukti: '',
  kode_customer: customerData.value.Kode,
  nama_customer: customerData.value.Nama,
  status: 'LUNAS',
  id_kunjungan: route.query.id_kunjungan || '',
  created_offline_at: null
});

const isFormValid = computed(() => {
  if (!form.value.nota) return false;
  if (isSelectedNotaLunas.value) return false;

  const totalBayar = Number(form.value.total_bayar || 0);
  if (totalBayar < 0) return false;
  if (totalBayar + creditNoteAmount.value <= 0) return false;

  if (selectedNota.value && totalBayar > payableAfterCreditNote.value) {
    return false;
  }

  if (totalBayar > 0 && form.value.metode === 'TRANSFER' && !String(form.value.no_bukti || '').trim()) {
    return false;
  }

  return true;
});

// =========================
// DB HELPERS
// =========================
const getCacheDb = async (cacheKey) => {
  const db = getDb();
  if (!db) return null;

  try {
    const res = await db.query(
      `SELECT payload_json FROM app_cache WHERE cache_key = ? LIMIT 1`,
      [cacheKey]
    );
    const raw = res.values?.[0]?.payload_json;
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('❌ getCacheDb error:', err);
    return null;
  }
};

const saveCacheDb = async (cacheKey, payload) => {
  const db = getDb();
  if (!db) return false;

  try {
    await db.run(
      `
      INSERT OR REPLACE INTO app_cache (cache_key, payload_json, updated_at)
      VALUES (?, ?, ?)
      `,
      [cacheKey, JSON.stringify(payload ?? null), new Date().toISOString()]
    );
    return true;
  } catch (err) {
    console.error('❌ saveCacheDb error:', err);
    return false;
  }
};

const getDraftDb = async (draftKeyValue) => {
  const db = getDb();
  if (!db) return null;

  try {
    const res = await db.query(
      `SELECT payload_json FROM app_drafts WHERE draft_key = ? LIMIT 1`,
      [draftKeyValue]
    );
    const raw = res.values?.[0]?.payload_json;
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('❌ getDraftDb error:', err);
    return null;
  }
};

const saveDraftDb = async (draftKeyValue, payload) => {
  const db = getDb();
  if (!db) return false;

  try {
    await db.run(
      `
      INSERT OR REPLACE INTO app_drafts (draft_key, payload_json, updated_at)
      VALUES (?, ?, ?)
      `,
      [draftKeyValue, JSON.stringify(payload ?? null), new Date().toISOString()]
    );
    return true;
  } catch (err) {
    console.error('❌ saveDraftDb error:', err);
    return false;
  }
};

const deleteDraftDb = async (draftKeyValue) => {
  const db = getDb();
  if (!db) return false;

  try {
    await db.run(`DELETE FROM app_drafts WHERE draft_key = ?`, [draftKeyValue]);
    return true;
  } catch (err) {
    console.error('❌ deleteDraftDb error:', err);
    return false;
  }
};

const refreshPendingCount = async () => {
  const db = getDb();
  if (!db) {
    pendingCount.value = 0;
    return;
  }

  try {
    const res = await db.query(
      `
      SELECT COUNT(*) as total
      FROM payment_offline
      WHERE status_sync = 'pending'
      `
    );
    pendingCount.value = Number(res.values?.[0]?.total || 0);
  } catch (err) {
    console.error('❌ refreshPendingCount payment error:', err);
    pendingCount.value = 0;
  }
};

// =========================
// DRAFT HELPERS
// =========================
const persistDraft = async () => {
  await saveDraftDb(draftKey.value, form.value);
};

const restoreDraft = async () => {
  const saved = await getDraftDb(draftKey.value);
  if (saved) {
    form.value = {
      ...form.value,
      ...saved
    };
  }
};

const applyRoutePrefill = () => {
  if (route.query.nota) {
    form.value.nota = String(route.query.nota);
  }

  if (route.query.selected_nota_key) {
    form.value.selected_nota_key = String(route.query.selected_nota_key);
  }

  if (route.query.total_tagihan) {
    form.value.total_tagihan = Number(route.query.total_tagihan) || 0;
  }

  if (route.query.total_bayar) {
    form.value.total_bayar = Number(route.query.total_bayar) || 0;
  }

  if (route.query.metode) {
    form.value.metode = String(route.query.metode);
  }
};

const clearDraft = async () => {
  await deleteDraftDb(draftKey.value);

  form.value = {
    payment_id: uuidv4(),
    nota: '',
    selected_nota_key: '',
    total_bayar: null,
    total_tagihan: 0,
    credit_note_id: '',
    credit_note_no: '',
    credit_note_amount: 0,
    metode: 'TUNAI',
    no_bukti: '',
    kode_customer: customerData.value.Kode,
    nama_customer: customerData.value.Nama,
    status: 'LUNAS',
    id_kunjungan: route.query.id_kunjungan || '',
    created_offline_at: null
  };

  selectedNota.value = null;
  selectedCreditNote.value = null;
};

// =========================
// DATA HELPERS
// =========================
const buildNotaSelectionKey = (item) => {
  const idFaktur = String(item?.id_faktur || item?.IdFaktur || item?.faktur_id || '').trim();
  const idSalesOrder = String(item?.id_sales_order || item?.IdSalesOrder || item?.sales_order_id || '').trim();
  if (idFaktur && idSalesOrder) return `faktur:${idFaktur}:so:${idSalesOrder}`;

  // Old/cache rows may not yet contain the new exact IDs.  Keep them usable
  // only when their displayed reference is otherwise unique.
  return `nota:${String(item?.Nota || item?.nota || item?.no_faktur || item?.no_order || '').trim()}`;
};

const normalizeTagihan = (rows) => {
  return filterLphReady(Array.isArray(rows) ? rows : []).map((item) => {
    const providedTotalPiutang = item.TotalPiutang ?? item.total_piutang;
    const totalTagihanRaw = Number(
      item.TotalTagihan ??
      item.total_tagihan ??
      item.TotalPenjualan ??
      item.total_penjualan ??
      item.NilaiTagihan ??
      item.nilai_tagihan ??
      item.Piutang ??
      item.piutang ??
      0
    );
    const nominalRetur = Number(item.NominalRetur ?? item.nominal_retur ?? 0) || 0;
    const totalVoucher = Number(item.TotalVoucher ?? item.total_voucher ?? 0) || 0;
    const totalBayar = Number(item.TotalBayar ?? item.total_bayar ?? item.Terbayar ?? item.terbayar ?? 0) || 0;
    const explicitSisa = Number(
      item.SisaPembayaran ??
      item.sisa_pembayaran ??
      item.SisaTagihan ??
      item.sisa_tagihan ??
      item.SisaPiutang ??
      item.sisa_piutang ??
      item.Piutang ??
      item.piutang ??
      NaN
    );
    const totalPiutang = providedTotalPiutang !== undefined && providedTotalPiutang !== null
      ? Math.max(Number(providedTotalPiutang) || 0, 0)
      : Math.max(totalTagihanRaw - nominalRetur - totalVoucher, 0);
    const sisaPembayaran = Number.isFinite(explicitSisa)
      ? Math.max(explicitSisa, 0)
      : Math.max(totalPiutang - totalBayar, 0);
    const statusRaw = String(item.StatusPembayaran || item.status_pembayaran || '').trim();
    const status = statusRaw || (
      sisaPembayaran <= 0
        ? 'Lunas'
        : totalBayar > 0 || totalVoucher > 0
          ? 'Sebagian'
          : 'Belum Dibayar'
    );

    const normalized = {
      is_lph: true,
      Nota: String(item.Nota || item.nota || item.no_faktur || '').trim(),
      Piutang: sisaPembayaran,
      TotalPiutang: totalPiutang || sisaPembayaran,
      TotalBayar: totalBayar,
      TotalVoucher: totalVoucher,
      NominalRetur: nominalRetur,
      id_sales_order: item.id_sales_order || item.IdSalesOrder || null,
      id_faktur: item.id_faktur || item.IdFaktur || item.faktur_id || null,
      NoOrder: String(item.NoOrder || item.no_order || '').trim(),
      NamaPrinciple: String(item.NamaPrinciple || item.nama_principle || '').trim(),
      JatuhTempo: item.JatuhTempo || item.jatuh_tempo || null,
      StatusPembayaran: status
    };
    return {
      ...normalized,
      selected_nota_key: String(item.selected_nota_key || item.selection_key || buildNotaSelectionKey(normalized))
    };
  }).map((item) => {
    const status = item.StatusPembayaran;
    return {
      ...item,
      StatusPembayaran: status,
      StatusPembayaranClass:
        status.toLowerCase().includes('lunas')
          ? 'is-paid'
          : status.toLowerCase().includes('sebagian')
            ? 'is-partial'
            : 'is-unpaid'
    };
  });
};

const normalizeCreditNotes = (rows) => {
  return filterLphReady(Array.isArray(rows) ? rows : []).map((item) => {
    const id = String(item.id || item.ID || item.usage_id || item.id_cn || item.IDCN || item.credit_note_id || '').trim();
    const nomor = String(item.nomor || item.kode || item.Kode || item.NoCN || item.no_cn || item.CN || item.credit_note_no || id).trim();
    const nominal = Number(
      item.sisa_nominal ??
      item.SisaNominal ??
      item.nominal_sisa ??
      item.NominalSisa ??
      item.nominal ??
      item.Nominal ??
      item.total ??
      0
    );

    return {
      is_lph: true,
      id: id || nomor,
      nomor,
      sisa_nominal: Math.max(nominal, 0),
      raw: item
    };
  }).filter((item) => item.id && item.sisa_nominal > 0);
};

const shouldSaveFetchedCache = (rows, payload) => {
  return rows.length > 0 || Array.isArray(payload);
};

const fetchCreditNotes = async () => {
  const cacheKey = `payment:credit-notes:${customerData.value.Kode}`;
  const selectedOrderId = selectedNota.value?.id_sales_order || route.query.id_sales_order || '';
  const params = {
    kode_customer: customerData.value.Kode,
    kode: customerData.value.Kode,
    id_sales_order: selectedOrderId,
    id_kunjungan: route.query.id_kunjungan || '',
    only_lph: 1
  };
  const endpoints = [
    '/api/finance/eligible-payment-vouchers',
    '/api/credit-note/available',
    '/api/credit-note/customer',
    '/api/cn/available',
    '/api/cn/customer'
  ];

  try {
    if (isOffline.value) {
      creditNoteList.value = normalizeCreditNotes(await getCacheDb(cacheKey));
      updateCreditNote();
      return;
    }

    let rows = [];
    for (const endpoint of endpoints) {
      try {
        const res = await api.get(endpoint, {
          suppressOfflineStatus: true,
          params
        });
        rows = normalizeCreditNotes(getPayloadArray(res.data));
        if (rows.length > 0) break;
      } catch (err) {
        if (Number(err?.response?.status || 0) !== 404) {
          console.warn(`Credit note gagal dari ${endpoint}:`, err?.message || err);
        }
      }
    }

    creditNoteList.value = rows;
    await saveCacheDb(cacheKey, creditNoteList.value);
  } catch (e) {
    console.warn('Credit note tidak tersedia atau gagal dimuat:', e?.message || e);
    creditNoteList.value = normalizeCreditNotes(await getCacheDb(cacheKey));
  } finally {
    updateCreditNote();
  }
};

const handleNotaChange = async () => {
  form.value.credit_note_id = '';
  await updateTagihan();
  await fetchCreditNotes();
};

const fetchTagihan = async () => {
  if (!customerData.value.Kode) return;

  loadingTagihan.value = true;

  try {
    if (isOffline.value) {
      listNota.value = normalizeTagihan(await getCacheDb(cacheKeyTagihan.value));

      if (listNota.value.length > 0) {
        await Swal.fire({
          icon: 'info',
          title: 'Mode Offline',
          text: 'Menampilkan daftar tagihan dari cache SQLite.',
          timer: 1300,
          showConfirmButton: false
        });
      }

      updateTagihan();
      return;
    }

    const res = await api.get('/api/tagihan/customer', {
      params: {
        kode_customer: customerData.value.Kode,
        id_kunjungan: route.query.id_kunjungan || '',
        id_plafon: route.query.id_plafon || '',
        only_lph: 1,
      }
    });

    listNota.value = normalizeTagihan(getPayloadArray(res.data));
    if (shouldSaveFetchedCache(listNota.value, res.data)) {
      await saveCacheDb(cacheKeyTagihan.value, listNota.value);
    }

    updateTagihan();
  } catch (e) {
    console.error('❌ Fetch tagihan payment error:', e);

    listNota.value = normalizeTagihan(await getCacheDb(cacheKeyTagihan.value));
    updateTagihan();

    if (listNota.value.length > 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'Koneksi Bermasalah',
        text: 'Menampilkan cache tagihan terakhir dari SQLite.',
        timer: 1400,
        showConfirmButton: false
      });
    } else {
      await Swal.fire('Error', 'Gagal memuat data tagihan', 'error');
    }
  } finally {
    loadingTagihan.value = false;
  }
};

const updateTagihan = async () => {
  const selectedKey = String(form.value.selected_nota_key || '').trim();
  const selectedByKey = selectedKey
    ? listNota.value.find((n) => n.selected_nota_key === selectedKey)
    : null;
  const routeSalesOrder = String(route.query.id_sales_order || route.query.sales_order_id || '').trim();
  const routeFaktur = String(route.query.id_faktur || route.query.faktur_id || '').trim();
  const selectedByRoute = (!selectedByKey && (routeSalesOrder || routeFaktur))
    ? listNota.value.find((n) => (
      (!routeSalesOrder || String(n.id_sales_order || '') === routeSalesOrder)
      && (!routeFaktur || String(n.id_faktur || '') === routeFaktur)
      && (!route.query.nota || n.Nota === String(route.query.nota))
    ))
    : null;
  const matchingNota = !selectedByKey && !selectedByRoute && form.value.nota
    ? listNota.value.filter((n) => n.Nota === form.value.nota)
    : [];

  // A legacy draft with a unique normal invoice stays usable.  A shared
  // parent invoice intentionally remains unselected until its precise SO is
  // chosen; this prevents silently assigning payment to the first principal.
  selectedNota.value = selectedByKey || selectedByRoute || (
    matchingNota.length === 1 ? matchingNota[0] : null
  );
  updateCreditNote();

  if (selectedNota.value) {
    form.value.nota = selectedNota.value.Nota;
    form.value.selected_nota_key = selectedNota.value.selected_nota_key;
    form.value.total_tagihan = payableAfterCreditNote.value;

    if (payableAfterCreditNote.value <= 0) {
      form.value.total_bayar = 0;
      return;
    }

    if (
      !form.value.total_bayar ||
      Number(form.value.total_bayar) <= 0 ||
      Number(form.value.total_bayar) > payableAfterCreditNote.value
    ) {
      form.value.total_bayar = payableAfterCreditNote.value;
    }
  } else if (route.query.nota && route.query.total_tagihan) {
    selectedNota.value = {
      Nota: String(route.query.nota),
      id_sales_order: route.query.id_sales_order || route.query.sales_order_id || null,
      id_faktur: route.query.id_faktur || route.query.faktur_id || null,
      Piutang: Number(route.query.total_tagihan || 0),
      TotalPiutang: Number(route.query.total_tagihan || 0),
      NamaPrinciple: String(route.query.nama_principle || '').trim(),
      JatuhTempo: route.query.jatuh_tempo || null,
      StatusPembayaran: 'Belum Dibayar',
      StatusPembayaranClass: 'is-unpaid'
    };
    selectedNota.value.selected_nota_key = buildNotaSelectionKey(selectedNota.value);
    form.value.selected_nota_key = selectedNota.value.selected_nota_key;

    form.value.total_tagihan = Number(route.query.total_tagihan || 0);

    if (!form.value.total_bayar || Number(form.value.total_bayar) <= 0) {
      form.value.total_bayar = Number(route.query.total_bayar || route.query.total_tagihan || 0);
    }
  } else {
    form.value.total_tagihan = 0;
  }

  await persistDraft();
};

const updateCreditNote = () => {
  selectedCreditNote.value = creditNoteList.value.find((cn) => cn.id === form.value.credit_note_id) || null;

  if (selectedCreditNote.value && selectedNota.value) {
    selectedCreditNote.value.nominal_dipakai = Math.min(
      Number(selectedCreditNote.value.sisa_nominal || 0),
      Number(selectedNota.value.Piutang || 0)
    );
  }

  form.value.credit_note_no = selectedCreditNote.value?.nomor || '';
  form.value.credit_note_amount = Number(selectedCreditNote.value?.nominal_dipakai || 0);

  if (selectedNota.value) {
    form.value.total_tagihan = payableAfterCreditNote.value;
    if (Number(form.value.total_bayar || 0) > payableAfterCreditNote.value) {
      form.value.total_bayar = payableAfterCreditNote.value || null;
    }
  }
};

// =========================
// PAYMENT PAYLOAD
// =========================
const buildPaymentPayload = () => {
  // A printed mixed-principal invoice can map to more than one Sales Order.
  // Keep the exact context selected in the UI so the server never has to
  // guess which principal's receivable is being paid.
  const idSalesOrder = selectedNota.value?.id_sales_order
    || route.query.id_sales_order
    || route.query.sales_order_id
    || null;
  const idFaktur = selectedNota.value?.id_faktur
    || route.query.id_faktur
    || route.query.faktur_id
    || null;

  return {
    payment_id: form.value.payment_id || uuidv4(),
    nota: form.value.nota,
    total_bayar: Number(form.value.total_bayar || 0),
    total_tagihan: Number(form.value.total_tagihan || 0),
    credit_note_id: form.value.credit_note_id || '',
    credit_note_no: form.value.credit_note_no || '',
    credit_note_amount: Number(form.value.credit_note_amount || 0),
    credit_notes: selectedCreditNote.value
      ? [{
          id: form.value.credit_note_id,
          nomor: form.value.credit_note_no,
          nominal: Number(form.value.credit_note_amount || 0)
        }]
      : [],
    metode: form.value.metode,
    no_bukti: String(form.value.no_bukti || '').trim(),
    kode_customer: customerData.value.Kode,
    nama_customer: customerData.value.Nama,
    status: form.value.status || 'LUNAS',
    id_sales_order: idSalesOrder,
    id_faktur: idFaktur,
    selected_nota_key: selectedNota.value?.selected_nota_key || form.value.selected_nota_key || null,
    id_kunjungan: route.query.id_kunjungan || '',
    created_offline_at: form.value.created_offline_at || new Date().toISOString()
  };
};

const submitPaymentToServer = async (payload) => {
  return api.post('/api/payment/save', {
    payment_id: payload.payment_id,
    nota: payload.nota,
    total_bayar: payload.total_bayar,
    total_tagihan: payload.total_tagihan,
    credit_note_id: payload.credit_note_id,
    credit_note_no: payload.credit_note_no,
    credit_note_amount: payload.credit_note_amount,
    credit_notes: payload.credit_notes,
    metode: payload.metode,
    no_bukti: payload.no_bukti,
    kode_customer: payload.kode_customer,
    status: payload.status,
    id_sales_order: payload.id_sales_order || null,
    id_faktur: payload.id_faktur || null,
    // Kept with the request as diagnostic context.  The server authorizes by
    // the numeric IDs above, not by this client-display key.
    selected_nota_key: payload.selected_nota_key || null
  });
};

const savePaymentToOfflineQueue = async (payload) => {
  const db = getDb();
  if (!db) throw new Error('Database belum siap');

  await db.run(
    `
    INSERT OR REPLACE INTO payment_offline
    (payment_id, id_kunjungan, nota, kode_customer, nama_customer, total_bayar,
     total_tagihan, metode, no_bukti, status_pembayaran, metadata_json, status_sync, retry_count, last_error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?)
    `,
    [
      payload.payment_id,
      payload.id_kunjungan || '',
      payload.nota,
      payload.kode_customer,
      payload.nama_customer,
      Number(payload.total_bayar || 0),
      Number(payload.total_tagihan || 0),
      payload.metode,
      payload.no_bukti || '',
      payload.status || 'LUNAS',
      JSON.stringify({
        credit_note_id: payload.credit_note_id || '',
        credit_note_no: payload.credit_note_no || '',
        credit_note_amount: Number(payload.credit_note_amount || 0),
        credit_notes: payload.credit_notes || [],
        payment_id: payload.payment_id,
        id_sales_order: payload.id_sales_order || null,
        id_faktur: payload.id_faktur || null,
        selected_nota_key: payload.selected_nota_key || null
      }),
      payload.created_offline_at || new Date().toISOString()
    ]
  );
};

// =========================
// PENDING UPLOAD
// =========================
const uploadPendingPayments = async () => {
  if (isOffline.value) {
    await Swal.fire('Offline', 'Upload pending hanya bisa saat online.', 'info');
    return;
  }

  if (pendingCount.value === 0) {
    await Swal.fire('Info', 'Tidak ada pembayaran pending.', 'info');
    return;
  }

  if (isUploadingPending.value) return;

  isUploadingPending.value = true;

  try {
    const result = await SyncService.uploadPendingPaymentData();
    await refreshPendingCount();

    if (result.success) {
      if (pendingCount.value === 0) {
        await Swal.fire({
          icon: 'success',
          title: 'Selesai',
          text: 'Semua pembayaran pending berhasil diupload.',
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        await Swal.fire(
          'Sebagian Gagal',
          `${pendingCount.value} pembayaran masih pending dan akan dicoba lagi nanti.`,
          'warning'
        );
      }
    } else {
      await Swal.fire('Gagal', result.message || 'Gagal upload pending payment.', 'error');
    }
  } finally {
    isUploadingPending.value = false;
  }
};

const autoUploadPendingPayments = async () => {
  if (isOffline.value || isUploadingPending.value) return;
  await refreshPendingCount();
  if (pendingCount.value === 0) return;

  isUploadingPending.value = true;
  try {
    await SyncService.uploadPendingPaymentData();
    await refreshPendingCount();
  } catch (err) {
    console.error('Auto upload payment gagal:', err);
  } finally {
    isUploadingPending.value = false;
  }
};

// =========================
// SAVE PAYMENT
// =========================
const savePayment = async () => {
  if (!isFormValid.value) {
    await Swal.fire('Validasi', 'Lengkapi data pembayaran terlebih dahulu.', 'warning');
    return;
  }

  const payload = buildPaymentPayload();

  const result = await Swal.fire({
    title: isOffline.value ? 'Simpan Offline?' : 'Simpan Pembayaran?',
    text: isOffline.value
      ? 'Pembayaran akan masuk antrean SQLite dan diupload saat online.'
      : 'Pastikan nominal pembayaran sudah benar.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Ya, Simpan'
  });

  if (!result.isConfirmed) return;

  isSaving.value = true;

  try {
    if (isOffline.value) {
      await savePaymentToOfflineQueue(payload);
      await clearDraft();
      await refreshPendingCount();

      await Swal.fire({
        icon: 'info',
        title: 'Tersimpan Offline',
        text: 'Pembayaran masuk antrean SQLite dan akan diupload saat online.',
        timer: 1600,
        showConfirmButton: false
      });

      router.back();
      return;
    }

    const res = await submitPaymentToServer(payload);

    if (res.data?.success) {
      await clearDraft();

      await Swal.fire(
        'Berhasil',
        'Kwitansi: ' + (res.data.no_kwitansi || '-'),
        'success'
      );

      router.back();
      return;
    }

    throw new Error(res.data?.message || 'Gagal memproses pembayaran');
  } catch (e) {
    console.error('❌ Save payment error:', e);

    const statusCode = Number(e?.response?.status || 0);
    const backendMessage = (
      e?.response?.data?.message
      || e?.response?.data?.error
      || e?.message
      || 'Pembayaran ditolak server.'
    );

    if (statusCode >= 400 && statusCode < 500) {
      await Swal.fire({
        icon: 'error',
        title: 'Pembayaran Ditolak',
        text: backendMessage,
        confirmButtonText: 'OK'
      });
      return;
    }

    await savePaymentToOfflineQueue(payload);
    await clearDraft();
    await refreshPendingCount();

    await Swal.fire({
      icon: 'warning',
      title: 'Disimpan ke Antrean',
      text: 'Koneksi bermasalah. Pembayaran disimpan di SQLite dan akan diupload saat online.',
      confirmButtonText: 'OK'
    });

    router.back();
  } finally {
    isSaving.value = false;
  }
};

// =========================
// FORMATTERS
// =========================
const formatNumber = (val) => new Intl.NumberFormat('id-ID').format(Number(val) || 0);

const formatDate = (date) => {
  if (!date) return '-';
  const d = dayjs(date);
  return d.isValid() ? d.format('DD MMM YYYY') : '-';
};

// =========================
// WATCHERS
// =========================
watch(
  () => form.value,
  async () => {
    await persistDraft();
  },
  { deep: true }
);

watch(
  () => connectivity.isOnline,
  async (online) => {
    if (online) {
      await autoUploadPendingPayments();
      await fetchTagihan();
      await fetchCreditNotes();
    }
  }
);

// =========================
// INIT
// =========================
onMounted(async () => {
  await refreshPendingCount();
  await restoreDraft();
  applyRoutePrefill();
  await fetchTagihan();
  await fetchCreditNotes();
  await updateTagihan();

  await autoUploadPendingPayments();
});
</script>

<style scoped>
.page-wrapper {
  background: #f8fafc;
  min-height: 100vh;
  display: flex;
  justify-content: stretch;
  width: 100vw;
}

.payment-container {
  width: 100vw;
  max-width: none;
  background: white;
  display: flex;
  flex-direction: column;
}

.header {
  background: #14b8a6;
  padding: 16px;
  color: white;
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-back {
  background: rgba(255,255,255,0.2);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.header-title h3 {
  margin: 0;
  font-size: 1rem;
}

.header-title p {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.7;
}

.offline-banner {
  background: #f59e0b;
  color: white;
  text-align: center;
  padding: 8px 12px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.scroll-area {
  flex: 1;
  padding: 16px;
}

.form-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.pending-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 12px;
  padding: 12px;
  color: #9a3412;
}

.pending-box p {
  margin: 4px 0 0;
  font-size: 0.75rem;
}

.btn-pending-sync {
  border: none;
  background: #ea580c;
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.payment-summary-card {
  background: linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%);
  border: 1px solid #99f6e4;
  border-radius: 14px;
  padding: 14px;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 0.85rem;
  margin-bottom: 8px;
}

.summary-line:last-child {
  margin-bottom: 0;
}

.text-primary {
  color: #0f766e;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 0.85rem;
  font-weight: 700;
  color: #475569;
}

.custom-select,
.custom-input {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  font-size: 1rem;
  outline: none;
  box-sizing: border-box;
}

.info-piutang {
  background: #f1f5f9;
  padding: 12px;
  border-radius: 10px;
  border-left: 4px solid #14b8a6;
}

.piutang-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
}

.total-row {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed #cbd5e1;
}

.helper-error {
  color: #dc2626;
  font-size: 0.75rem;
  font-weight: 600;
}

.lph-empty-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
  padding: 9px 10px;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  background: #eff6ff;
  font-size: 0.74rem;
  line-height: 1.35;
}

.lph-empty-hint button {
  flex: 0 0 auto;
  padding: 6px 8px;
  color: #fff;
  border: 0;
  border-radius: 7px;
  background: #2563eb;
  font-size: 0.72rem;
  font-weight: 700;
}

.helper-success {
  color: #0f766e;
  font-size: 0.75rem;
  font-weight: 700;
}

.payment-status {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
}

.payment-status.is-paid {
  background: #dcfce7;
  color: #166534;
}

.payment-status.is-partial {
  background: #fef3c7;
  color: #92400e;
}

.payment-status.is-unpaid {
  background: #fee2e2;
  color: #991b1b;
}

.method-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.btn-method {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  border: 1.5px solid #14b8a6;
  background: transparent;
  color: #0f766e;
  font-weight: 700;
  font-size: 0.8rem;
  box-shadow: inset 0 0 0 1px rgba(20, 184, 166, 0.08);
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.btn-method.active {
  background: linear-gradient(135deg, #0f766e, #14b8a6);
  color: white;
  border-color: #0f766e;
  box-shadow: 0 10px 22px rgba(20, 184, 166, 0.28);
}

.footer-action {
  padding: 16px;
  border-top: 1px solid #f1f5f9;
}

.btn-save-payment {
  width: 100%;
  padding: 16px;
  background: #14b8a6;
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 800;
  font-size: 1rem;
}

.btn-save-payment:disabled {
  background: #cbd5e1;
}

.state-container {
  padding: 40px;
  text-align: center;
  color: #94a3b8;
}

.loader-enterprise {
  width: 30px;
  height: 30px;
  border: 3px solid #f1f5f9;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

:global(:root[data-theme='dark']) .page-wrapper,
:global(:root[data-theme='dark']) .payment-container,
:global(:root[data-theme='dark']) .scroll-area {
  background: #020617 !important;
}

:global(:root[data-theme='dark']) .header {
  background: linear-gradient(135deg, #0f766e, #115e59) !important;
}

:global(:root[data-theme='dark']) .form-card {
  color: #e2e8f0 !important;
}

:global(:root[data-theme='dark']) .pending-box {
  background: rgba(154, 52, 18, 0.18) !important;
  border-color: rgba(249, 115, 22, 0.28) !important;
  color: #fdba74 !important;
}

:global(:root[data-theme='dark']) .payment-summary-card {
  background: linear-gradient(135deg, rgba(20, 184, 166, 0.16) 0%, rgba(15, 23, 42, 0.95) 100%) !important;
  border-color: rgba(45, 212, 191, 0.28) !important;
}

:global(:root[data-theme='dark']) .input-group label,
:global(:root[data-theme='dark']) .summary-line,
:global(:root[data-theme='dark']) .piutang-row {
  color: #cbd5e1 !important;
}

:global(:root[data-theme='dark']) .custom-select,
:global(:root[data-theme='dark']) .custom-input,
:global(:root[data-theme='dark']) .info-piutang {
  background: #0f172a !important;
  border-color: #334155 !important;
  color: #e2e8f0 !important;
}

:global(:root[data-theme='dark']) .btn-method {
  background: transparent !important;
  border-color: #2dd4bf !important;
  color: #5eead4 !important;
  box-shadow: inset 0 0 0 1px rgba(45, 212, 191, 0.08) !important;
}

:global(:root[data-theme='dark']) .info-piutang {
  border-left-color: #2dd4bf !important;
}

:global(:root[data-theme='dark']) .total-row {
  border-top-color: #334155 !important;
}

:global(:root[data-theme='dark']) .btn-method.active {
  background: linear-gradient(135deg, #0f766e, #14b8a6) !important;
  border-color: #5eead4 !important;
  color: #f8fafc !important;
  box-shadow: 0 12px 24px rgba(20, 184, 166, 0.3) !important;
}

:global(:root[data-theme='dark']) .footer-action {
  border-top-color: #1e293b !important;
  background: #020617 !important;
}

:global(:root[data-theme='dark']) .btn-save-payment:disabled {
  background: #334155 !important;
  color: #94a3b8 !important;
}

:global(:root[data-theme='dark']) .payment-status.is-paid {
  background: rgba(22, 163, 74, 0.18) !important;
  color: #86efac !important;
}

:global(:root[data-theme='dark']) .payment-status.is-partial {
  background: rgba(217, 119, 6, 0.18) !important;
  color: #fcd34d !important;
}

:global(:root[data-theme='dark']) .payment-status.is-unpaid {
  background: rgba(185, 28, 28, 0.2) !important;
  color: #fca5a5 !important;
}

:global(:root[data-theme='dark']) .state-container {
  color: #94a3b8 !important;
}

:global(:root[data-theme='dark']) .loader-enterprise {
  border-color: #1e293b !important;
  border-top-color: #5eead4 !important;
}
</style>

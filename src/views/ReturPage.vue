<template>
  <div class="page-wrapper retur-page" :class="{ 'theme-dark': theme.isDark }">
    <div class="so-container">
      <header class="header red-header">
        <button @click="$router.back()" class="btn-back" aria-label="Kembali"><font-awesome-icon icon="chevron-left" /></button>

        <div class="header-title">
          <h3>Pengajuan Retur</h3>
          <p>{{ activeTabLabel }} - {{ customerData.Nama }}</p>
        </div>

        <button class="header-cart" @click="showCartPreview" aria-label="Lihat keranjang retur">
          <div class="cart-icon-wrapper">
            <font-awesome-icon icon="shopping-cart" />
            <span v-if="totalItems > 0" class="cart-badge">{{ totalItems }}</span>
          </div>
        </button>
      </header>

      <div v-if="isOffline" class="offline-banner">
        <span class="offline-dot"></span>
        MODE OFFLINE AKTIF - retur akan masuk antrean lokal
        <button
          type="button"
          class="offline-retry"
          :disabled="isCheckingConnection"
          @click="retryConnection"
        >
          {{ isCheckingConnection ? 'Mengecek…' : 'Cek koneksi' }}
        </button>
      </div>

      <section class="nav-section fixed-nav-wrapper">
        <div class="tabs-container tabs-wrapper">
          <button
            @click="switchTab('fav')"
            :class="['tab-btn tab-item', { active: activeTab === 'fav' }]"
          >
            Barang Terkirim
          </button>
          <button
            @click="switchTab('history')"
            :class="['tab-btn tab-item', { active: activeTab === 'history' }]"
          >
            Riwayat
          </button>
          <button
            @click="switchTab('all')"
            :class="['tab-btn tab-item', { active: activeTab === 'all' }]"
          >
            Semua
          </button>
        </div>

        <div v-if="activeTab !== 'history'" class="invoice-source-box">
          <label for="retur-source-invoice">Nota/Faktur Sumber Retur <span>*</span></label>
          <select
            id="retur-source-invoice"
            v-model="selectedInvoiceId"
            class="invoice-source-select"
            :disabled="invoiceLoading || (isOffline && invoiceRows.length === 0)"
            @change="onInvoiceChange"
          >
            <option value="">Pilih nota/faktur terlebih dahulu</option>
            <option
              v-for="invoice in invoiceRows"
              :key="invoice.id_sales_order"
              :value="String(invoice.id_sales_order)"
              :disabled="invoice.return_allowed === false"
            >
              {{ invoice.reference_no }} · sisa total {{ formatNumber(invoice.qty_sisa_retur) }} PCS
              {{ invoice.return_allowed === false ? ' (retur masih diproses)' : '' }}
            </option>
          </select>
          <small v-if="selectedInvoice">Sumber aktif: {{ selectedInvoice.reference_no }} — {{ selectedInvoice.status_retur }}. Sisa pada setiap produk mengikuti UOM master produk.</small>
          <small v-else>Pilih satu nota/faktur. Barang dari nota lain tidak akan tercampur.</small>
        </div>

        <div class="search-box search-wrapper">
          <input
            v-model="searchQuery"
            type="text"
            inputmode="search"
            placeholder="Cari barang..."
            class="search-input"
          />
        </div>

        <div class="summary-strip">
          <div class="summary-pill">
            <small>Total SKU</small>
            <strong>{{ filteredItems.length }}</strong>
          </div>
          <div class="summary-pill">
            <small>Sudah Diinput</small>
            <strong>{{ totalItems }}</strong>
          </div>
          <div class="summary-pill">
            <small>Total Qty</small>
            <strong>{{ formatNumber(totalQtyRetur) }}</strong>
          </div>
        </div>
      </section>

      <main class="scroll-area" @scroll="handleScroll">
        <div v-if="loading" class="loading-state state-container">
          <div class="loader-mini-red"></div>
          <p>{{ isOffline ? 'Memuat cache retur...' : 'Memuat daftar barang retur...' }}</p>
        </div>

        <div v-else-if="filteredItems.length === 0" class="empty-state state-container">
          <div class="empty-illustration">Barang</div>
          <p>{{ activeTab !== 'history' && !selectedInvoiceId ? 'Pilih nota/faktur sumber untuk menampilkan barang retur.' : (isOffline ? 'Cache retur belum tersedia.' : 'Tidak ada barang retur untuk nota/faktur ini.') }}</p>
          <small>{{ activeTab !== 'history' && !selectedInvoiceId ? 'Retur diproses satu nota/faktur dalam satu pengajuan.' : 'Coba ganti tab atau periksa koneksi Anda.' }}</small>
        </div>

        <div v-else class="stock-list">
          <div
            v-for="item in filteredItems"
            :key="item.Kode"
            :class="[
              'stock-card',
              {
                'card-active-red is-filled': getCartQty(item.Kode) > 0,
                'is-unavailable': getReturnableQty(item) <= 0
              }
            ]"
          >
            <div class="item-info" @click="openItemDetail(item)">
              <span class="brand-tag red-text">{{ item.NamaBrand || item.NamaPTAsli || 'PT BUDIMAS' }}</span>
              <span class="item-code">{{ item.Kode }}</span>
              <h4 class="item-name-full">{{ item.Nama }}</h4>

              <div class="item-meta stock-style-meta">
                <span class="badge-suggest" :class="{ empty: getReturnableQty(item) <= 0 }">
                  Sisa Retur: {{ formatReturnableUom(item) }}
                </span>
                <span v-if="item.StatusRetur" class="return-status">{{ item.StatusRetur }}</span>
                <span v-if="Number(item.QtySudahRetur || 0) > 0" class="stock-info">
                  Sudah Retur: <b>{{ formatNumber(item.QtySudahRetur) }}</b>
                </span>
                <span class="stock-info">Qty Retur: <b>{{ getCartQty(item.Kode) || 0 }}</b></span>
                <span v-if="getCartQty(item.Kode) > 0" class="stock-info">{{ getReturCartSummary(item.Kode) }}</span>
                <span class="price-info">Harga: <b>Rp {{ formatNumber(item.HargaE || 0) }}</b></span>
              </div>
            </div>

            <div class="item-action-group">
              <input
                :ref="(el) => setQtyInputRef(item.Kode, el)"
                type="number"
                inputmode="numeric"
                :value="getCartQty(item.Kode) || ''"
                @input="updateQty(item, $event.target.value)"
                class="opname-input qty-input-plain"
                placeholder="0"
                min="0"
                :max="getReturnableQty(item)"
                :disabled="getReturnableQty(item) <= 0 || !isReturUomEnabled(cart[item.Kode] || item, 1)"
              />
              <button
                class="btn-detail-mini stock-style-detail"
                type="button"
                @click="openItemDetail(item)"
              >
                <font-awesome-icon icon="info-circle" /><span class="sr-only">Detail</span>
              </button>
            </div>
          </div>

          <div v-if="!hasMore && rawData.length > 0" class="end-list">
            {{ isOffline ? 'Mode offline menampilkan cache yang tersedia' : 'Semua produk sudah ditampilkan' }}
          </div>
        </div>
      </main>

      <footer class="footer-action">
        <div class="form-stack">
          <div class="form-card">
            <label class="field-label">Tanggal Transaksi</label>
            <input
              v-model="tanggalTransaksi"
              type="date"
              class="date-input"
              :min="minTanggal"
              :max="maxTanggal"
            />
          </div>

          <div class="form-card">
            <label class="field-label">Keterangan</label>
            <textarea
              v-model="keterangan"
              class="note-input"
              rows="3"
              placeholder="Tulis keterangan retur..."
            ></textarea>
          </div>
        </div>

        <div class="summary-detail-card">
          <div class="summary-row">
            <span>Total</span>
            <strong>Rp {{ formatNumber(subtotalRetur) }}</strong>
          </div>
          <div class="summary-row">
            <span>PPN (11%)</span>
            <strong>Rp {{ formatNumber(ppnRetur) }}</strong>
          </div>
          <div class="summary-row grand">
            <span>Grand Total</span>
            <strong>Rp {{ formatNumber(grandTotalRetur) }}</strong>
          </div>
        </div>

        <div class="cart-brief" v-if="totalItems > 0">
          <span>Total Input: <b>{{ totalItems }} Item</b></span>
          <span>Estimasi Retur: <b>Rp {{ formatNumber(grandTotalRetur) }}</b></span>
        </div>

        <div class="slide-checkout-wrapper" :class="{ 'is-locked': totalItems === 0 || isSubmitting }">
          <div class="slide-track" ref="slideTrackRef">
            <div class="slide-fill" :style="{ width: `${currentX + 56}px` }"></div>

            <span class="slide-hint">
              {{
                isSubmitting
                  ? 'Memproses...'
                  : isOffline
                    ? 'Geser untuk Simpan Offline'
                    : 'Geser untuk Ajukan Retur'
              }}
            </span>

            <div
              class="slide-handle"
              @touchstart="startSlide"
              @touchmove="moveSlide"
              @touchend="endSlide"
              :style="{ transform: `translateX(${currentX}px)` }"
            >
              <font-awesome-icon icon="chevron-right" />
            </div>
          </div>
        </div>
      </footer>
    </div>

    <!-- detail item -->
    <div v-if="showItemDetail && selectedItemDetail" class="detail-overlay" @click.self="closeItemDetail">
      <div class="detail-sheet">
        <div class="detail-sheet-head">
          <div>
            <h3>Detail Item Retur</h3>
            <p>{{ selectedItemDetail.nama || '-' }}</p>
          </div>
          <button class="btn-close-sheet" @click="closeItemDetail" type="button" aria-label="Tutup detail"><font-awesome-icon icon="times" /></button>
        </div>

        <div class="detail-grid">
          <div class="detail-box">
            <span>Kode</span>
            <strong>{{ selectedItemDetail.kode || '-' }}</strong>
          </div>
          <div class="detail-box">
            <span>Harga</span>
            <strong>Rp {{ formatNumber(selectedItemDetail.harga || 0) }}</strong>
          </div>
          <div class="detail-box">
            <span>Sisa Retur</span>
            <strong>{{ formatReturnableUom(selectedItemDetail.stok) }}</strong>
          </div>
        </div>

        <div class="detail-form">
          <div class="retur-uom-section">
            <div class="retur-uom-head">
              <span>Good</span>
              <small>Barang masih layak</small>
            </div>
            <div class="retur-uom-grid">
              <label v-for="field in ['pieces_retur_good', 'box_retur_good', 'karton_retur_good']" :key="field" class="retur-uom-field" :class="{ disabled: !isReturUomEnabled(selectedItemDetail, getReturFieldLevel(field)) }">
                <span>{{ getReturUomLabel(selectedItemDetail, getReturFieldLevel(field)) }}</span>
                <div class="qty-box detail-qty-box">
                  <button class="qty-btn qty-btn-minus" type="button" :disabled="!isReturUomEnabled(selectedItemDetail, getReturFieldLevel(field))" @click="changeReturField(selectedItemDetail, field, -1)">-</button>
                  <input
                    type="number"
                    inputmode="numeric"
                    :value="selectedItemDetail[field] || ''"
                    min="0"
                    class="qty-input"
                    placeholder="0"
                    :disabled="!isReturUomEnabled(selectedItemDetail, getReturFieldLevel(field))"
                    @input="updateReturField(selectedItemDetail, field, $event.target.value)"
                  />
                  <button class="qty-btn qty-btn-plus" type="button" :disabled="!isReturUomEnabled(selectedItemDetail, getReturFieldLevel(field))" @click="changeReturField(selectedItemDetail, field, 1)">+</button>
                </div>
              </label>
            </div>
          </div>

          <div class="retur-uom-section">
            <div class="retur-uom-head bad">
              <span>Bad</span>
              <small>Barang rusak/expired</small>
            </div>
            <div class="retur-uom-grid">
              <label v-for="field in ['pieces_retur_bad', 'box_retur_bad', 'karton_retur_bad']" :key="field" class="retur-uom-field" :class="{ disabled: !isReturUomEnabled(selectedItemDetail, getReturFieldLevel(field)) }">
                <span>{{ getReturUomLabel(selectedItemDetail, getReturFieldLevel(field)) }}</span>
                <div class="qty-box detail-qty-box">
                  <button class="qty-btn qty-btn-minus" type="button" :disabled="!isReturUomEnabled(selectedItemDetail, getReturFieldLevel(field))" @click="changeReturField(selectedItemDetail, field, -1)">-</button>
                  <input
                    type="number"
                    inputmode="numeric"
                    :value="selectedItemDetail[field] || ''"
                    min="0"
                    class="qty-input"
                    placeholder="0"
                    :disabled="!isReturUomEnabled(selectedItemDetail, getReturFieldLevel(field))"
                    @input="updateReturField(selectedItemDetail, field, $event.target.value)"
                  />
                  <button class="qty-btn qty-btn-plus" type="button" :disabled="!isReturUomEnabled(selectedItemDetail, getReturFieldLevel(field))" @click="changeReturField(selectedItemDetail, field, 1)">+</button>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label class="field-label">Catatan Produk</label>
            <textarea v-model="selectedItemDetail.keterangan_retur" class="note-input" rows="2" placeholder="Catatan retur produk..."></textarea>
          </div>

          <div class="detail-subtotal">
            <span>Subtotal Item</span>
            <strong>
              Rp {{ formatNumber((Number(selectedItemDetail.total_retur_pieces) || 0) * (Number(selectedItemDetail.harga) || 0)) }}
            </strong>
          </div>
        </div>

        <div class="detail-actions">
          <button class="btn-delete-item" @click="removeSelectedItem" type="button"><font-awesome-icon icon="trash-alt" /><span class="sr-only">Hapus Item</span></button>
          <button class="btn-save-item" @click="saveSelectedItemDetail" type="button"><font-awesome-icon icon="floppy-disk" /><span class="sr-only">Simpan</span></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api/axios';
import Swal from 'sweetalert2';
import { v4 as uuidv4 } from 'uuid';
import { useConnectivityStore } from '@/stores/connectivity';
import { useThemeStore } from '@/stores/theme';
import { getDb } from '@/services/database';
import { SyncService } from '@/services/SyncService';
import { getPayloadArray } from '@/services/visitService';
import { parseLocalDateInput, toLocalDateInputValue } from '@/utils/dateLocal';
import { Network } from '@capacitor/network';

const route = useRoute();
const router = useRouter();
const connectivity = useConnectivityStore();
const theme = useThemeStore();

const loading = ref(false);
const isSubmitting = ref(false);
const isUploadingPending = ref(false);
const activeTab = ref('fav');
const rawData = ref([]);
const invoiceRows = ref([]);
const invoiceLoading = ref(false);
const selectedInvoiceId = ref('');
const activeInvoiceId = ref('');
const searchQuery = ref('');
const cart = ref({});
const currentX = ref(0);
const maxSlide = ref(0);
const offset = ref(0);
const limit = 50;
const hasMore = ref(true);
const pendingCount = ref(0);
const slideTrackRef = ref(null);
const isAutoUploading = ref(false);
const qtyInputRefs = ref({});
const isCheckingConnection = ref(false);

const tanggalTransaksi = ref(toLocalDateInputValue());
const keterangan = ref('');
const showItemDetail = ref(false);
const selectedItemDetail = ref(null);
const selectedQtyInput = ref('');

const isOffline = computed(() => !connectivity.isOnline);
let connectivityProbePromise = null;

const today = new Date();
const minDateObj = new Date();
minDateObj.setDate(today.getDate() - 7);
const maxDateObj = new Date();
maxDateObj.setDate(today.getDate() + 30);

const minTanggal = toLocalDateInputValue(minDateObj);
const maxTanggal = toLocalDateInputValue(maxDateObj);

const customerData = computed(() => ({
  Kode: String(
    route.query.kode_customer
      || route.query.kode
      || route.query.KodeCustomer
      || route.query.customer
      || ''
  ).trim(),
  Nama: String(
    route.query.nama_toko
      || route.query.nama_customer
      || route.query.nama
      || route.query.NamaCustomer
      || 'Toko tidak dikenal'
  ).trim()
}));

const visitId = computed(() => route.query.id_kunjungan || '');
const plafonId = computed(() => String(route.query.id_plafon || route.query.IDPlafon || '').trim());
const cachePrefix = computed(() => (
  `retur:${customerData.value.Kode}:${plafonId.value || 'no_plafon'}:${visitId.value || 'no_visit'}`
));
const getCartDraftKey = (invoiceId) => (
  `${cachePrefix.value}:cart:${String(invoiceId || 'no_invoice')}`
);
const cartDraftKey = computed(() => getCartDraftKey(selectedInvoiceId.value));
const itemCacheKey = computed(() => (
  `${cachePrefix.value}:items:${activeTab.value}:${activeTab.value === 'history' ? 'history' : (selectedInvoiceId.value || 'no_invoice')}`
));
const metaDraftKey = computed(() => `${cachePrefix.value}:meta`);
const selectedInvoice = computed(() => invoiceRows.value.find(
  (invoice) => String(invoice.id_sales_order) === String(selectedInvoiceId.value)
) || null);

const totalItems = computed(() =>
  Object.values(cart.value).filter((i) => Number(i.total_retur || 0) > 0).length
);

const totalQtyRetur = computed(() =>
  Object.values(cart.value).reduce((sum, item) => sum + (Number(item.total_retur_pieces || 0) || 0), 0)
);

const activeTabLabel = computed(() => {
  if (activeTab.value === 'fav') return 'Barang Terkirim';
  if (activeTab.value === 'history') return 'Riwayat Customer';
  if (activeTab.value === 'all') return 'Semua Barang Terkirim';
  return 'Pengajuan Retur';
});

const subtotalRetur = computed(() => {
  return Object.values(cart.value).reduce((acc, item) => {
    return acc + ((Number(item.total_retur_pieces) || 0) * (Number(item.harga) || 0));
  }, 0);
});

const ppnRetur = computed(() => subtotalRetur.value * 0.11);
const grandTotalRetur = computed(() => subtotalRetur.value + ppnRetur.value);

const isTanggalValid = computed(() => {
  if (!tanggalTransaksi.value) return false;
  const picked = parseLocalDateInput(tanggalTransaksi.value);
  return picked >= parseLocalDateInput(minTanggal) && picked <= parseLocalDateInput(maxTanggal);
});

// db
const getCacheDb = async (key) => {
  const db = getDb();
  if (!db) return null;
  try {
    const res = await db.query(`SELECT payload_json FROM app_cache WHERE cache_key = ? LIMIT 1`, [key]);
    const raw = res.values?.[0]?.payload_json;
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('❌ getCacheDb error:', err);
    return null;
  }
};

const saveCacheDb = async (key, payload) => {
  const db = getDb();
  if (!db) return false;
  try {
    await db.run(
      `INSERT OR REPLACE INTO app_cache (cache_key, payload_json, updated_at) VALUES (?, ?, ?)`,
      [key, JSON.stringify(payload ?? null), new Date().toISOString()]
    );
    return true;
  } catch (err) {
    console.error('❌ saveCacheDb error:', err);
    return false;
  }
};

const getDraftDb = async (key) => {
  const db = getDb();
  if (!db) return null;
  try {
    const res = await db.query(`SELECT payload_json FROM app_drafts WHERE draft_key = ? LIMIT 1`, [key]);
    const raw = res.values?.[0]?.payload_json;
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('❌ getDraftDb error:', err);
    return null;
  }
};

const saveDraftDb = async (key, payload) => {
  const db = getDb();
  if (!db) return false;
  try {
    await db.run(
      `INSERT OR REPLACE INTO app_drafts (draft_key, payload_json, updated_at) VALUES (?, ?, ?)`,
      [key, JSON.stringify(payload ?? null), new Date().toISOString()]
    );
    return true;
  } catch (err) {
    console.error('❌ saveDraftDb error:', err);
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
    const res = await db.query(`
      SELECT COUNT(*) as total
      FROM retur_offline
      WHERE status_sync = 'pending'
    `);
    pendingCount.value = Number(res.values?.[0]?.total || 0);
  } catch (err) {
    console.error('❌ refreshPendingCount retur error:', err);
    pendingCount.value = 0;
  }
};

const saveReturToOfflineQueue = async (payload) => {
  const db = getDb();
  if (!db) throw new Error('DB belum siap');

  await db.run(
    `
    INSERT OR REPLACE INTO retur_offline
    (retur_id, id_kunjungan, kode_customer, nama_customer,
     total_retur, items_json, status_sync, retry_count, last_error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?)
    `,
    [
      payload.retur_id,
      payload.id_kunjungan || '',
      payload.kode_customer,
      payload.nama_customer,
      Number(payload.total_retur || 0),
      JSON.stringify({
        // Keep the original client ID with the queued payload as well as the
        // queue row.  A response can time out after the server commits, so a
        // later retry must represent this exact same return request.
        client_retur_id: payload.retur_id,
        id_sales_order: payload.id_sales_order || '',
        source_sales_order_id: payload.id_sales_order || '',
        source_reference: payload.source_reference || '',
        id_plafon: payload.id_plafon || '',
        items: payload.items || [],
        products: payload.products || payload.items || [],
        tanggal_transaksi: payload.tanggal_transaksi || '',
        tanggal_retur_pengajuan: payload.tanggal_retur_pengajuan || payload.tanggal_transaksi || '',
        keterangan: payload.keterangan || '',
        subtotal: payload.subtotal || 0,
        ppn: payload.ppn || 0,
        grand_total: payload.grand_total || 0
      }),
      payload.created_offline_at || new Date().toISOString()
    ]
  );
};

// drafts
const persistCartDraft = async () => {
  await saveDraftDb(cartDraftKey.value, cart.value);
};

const restoreCartDraft = async () => {
  cart.value = (await getDraftDb(cartDraftKey.value)) || {};
  activeInvoiceId.value = String(selectedInvoiceId.value || '');
};

const persistMetaDraft = async () => {
  await saveDraftDb(metaDraftKey.value, {
    tanggalTransaksi: tanggalTransaksi.value,
    keterangan: keterangan.value,
    selectedInvoiceId: selectedInvoiceId.value
  });
};

const restoreMetaDraft = async () => {
  const meta = await getDraftDb(metaDraftKey.value);
  if (meta?.tanggalTransaksi) tanggalTransaksi.value = meta.tanggalTransaksi;
  if (typeof meta?.keterangan === 'string') keterangan.value = meta.keterangan;
  if (meta?.selectedInvoiceId) selectedInvoiceId.value = String(meta.selectedInvoiceId);
};

// cart
const createCartEntry = (itemOrKode = {}) => {
  const kode = typeof itemOrKode === 'string'
    ? String(itemOrKode || '').trim()
    : String(itemOrKode.Kode || '').trim();
  const uom = typeof itemOrKode === 'string' ? {
    uom1Label: 'UOM 1',
    uom2Label: 'UOM 2',
    uom3Label: 'UOM 3',
    konversi2: 0,
    konversi3: 0,
    hasUom1: false,
    hasUom2: false,
    hasUom3: false
  } : buildReturUomMeta(itemOrKode);

  return {
    kode,
    nama: typeof itemOrKode === 'string' ? '' : String(itemOrKode.Nama || '').trim(),
    pieces_retur_good: 0,
    box_retur_good: 0,
    karton_retur_good: 0,
    pieces_retur_bad: 0,
    box_retur_bad: 0,
    karton_retur_bad: 0,
    total_retur: 0,
    total_retur_pieces: 0,
    keterangan_retur: '',
    uom1Label: uom.uom1Label,
    uom2Label: uom.uom2Label,
    uom3Label: uom.uom3Label,
    konversi2: uom.konversi2,
    konversi3: uom.konversi3,
    hasUom1: uom.hasUom1,
    hasUom2: uom.hasUom2,
    hasUom3: uom.hasUom3,
    harga: typeof itemOrKode === 'string' ? 0 : Number(itemOrKode.HargaE || 0),
    stok: typeof itemOrKode === 'string' ? null : itemOrKode
  };
};

const ensureCartEntry = (item) => {
  const cleanKode = String(item.Kode || '').trim();
  if (!cart.value[cleanKode]) {
    cart.value[cleanKode] = createCartEntry(item);
  }
  return cart.value[cleanKode];
};

const getCartQty = (kode) => {
  const cleanKode = String(kode || '').trim();
  return Number(cart.value[cleanKode]?.total_retur_pieces || 0);
};

const getCartUnit = (item) => {
  const cleanKode = String(item.Kode || '').trim();
  return cart.value[cleanKode]?.uom1Label || String(item.Satuan || 'PCS').trim();
};

const getReturnableQty = (item) => {
  if (item?.retur_locked || item?.source_mode === 'master_fallback') return 0;
  const qty = Number(item.QtySisaRetur ?? item.Suggestion ?? 0);
  return Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
};

const getSelectedReturnableQty = () => {
  if (!selectedItemDetail.value?.stok) return 0;
  return getReturnableQty(selectedItemDetail.value.stok);
};

const hydrateCartEntry = (item) => {
  const cleanKode = String(item.Kode || '').trim();
  const uom = buildReturUomMeta(item);

  if (!cart.value[cleanKode]) {
    cart.value[cleanKode] = createCartEntry(item);
  } else {
    cart.value[cleanKode] = {
      ...cart.value[cleanKode],
      kode: cleanKode,
      nama: cart.value[cleanKode].nama || String(item.Nama || '').trim(),
      uom1Label: uom.uom1Label,
      uom2Label: uom.uom2Label,
      uom3Label: uom.uom3Label,
      konversi2: uom.konversi2,
      konversi3: uom.konversi3,
      hasUom1: uom.hasUom1,
      hasUom2: uom.hasUom2,
      hasUom3: uom.hasUom3,
      harga: Number(cart.value[cleanKode].harga || item.HargaE || 0),
      stok: item
    };
    recalculateReturEntry(cart.value[cleanKode]);
  }
};

const pickText = (...values) => {
  const value = values.find((entry) => entry !== undefined && entry !== null && String(entry).trim() !== '');
  return value === undefined ? '' : String(value).trim();
};

const pickNumber = (...values) => {
  const value = values.find((entry) => entry !== undefined && entry !== null && String(entry).trim() !== '');
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const pickBoolean = (...values) => {
  const value = values.find((entry) => entry !== undefined && entry !== null && String(entry).trim() !== '');
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  return Boolean(value);
};

const sameUomLabel = (first, second) => (
  String(first || '').trim().toLowerCase() === String(second || '').trim().toLowerCase()
);

const buildReturUomMeta = (item = {}) => {
  const uom1Label = pickText(
    item.uom1Label,
    item.Uom1Label,
    item.uom1_label,
    item.Satuan,
    item.satuan,
    item.puom1_nama,
    item.puom1_kode,
    item.uom_1,
    item.uom1_name
  );
  const configuredUom2Label = pickText(
    item.uom2Label,
    item.Uom2Label,
    item.uom2_label,
    item.puom2_nama,
    item.puom2_kode,
    item.uom_2,
    item.uom2_name
  );
  // `NamaUnit` from the mobile API is the base-unit label for older stock
  // payloads. Do not let it overwrite a configured level-2 label (CT/box),
  // otherwise "2 CT + 5 PCS" is rendered as "2 PCS + 5 PCS".
  const legacyUom2Label = pickText(item.NamaUnit, item.nama_unit);
  const uom2Label = configuredUom2Label || (
    !sameUomLabel(legacyUom2Label, uom1Label) ? legacyUom2Label : ''
  );
  const uom3Label = pickText(
    item.uom3Label,
    item.Uom3Label,
    item.uom3_label,
    item.puom3_nama,
    item.puom3_kode,
    item.uom_3,
    item.uom3_name
  );
  const konversi2 = pickNumber(item.Konversi2, item.konversi_2, item.konversi2, item.konversi_level2);
  const konversi3 = pickNumber(item.Konversi3, item.konversi_3, item.konversi3, item.konversi_level3);
  const configuredHasUom1 = pickBoolean(item.hasUom1, item.HasUom1, item.has_uom_1);
  const configuredHasUom2 = pickBoolean(item.hasUom2, item.HasUom2, item.has_uom_2);
  const configuredHasUom3 = pickBoolean(item.hasUom3, item.HasUom3, item.has_uom_3);
  return {
    uom1Label: uom1Label || 'UOM 1',
    uom2Label: uom2Label || 'UOM 2',
    uom3Label: uom3Label || 'UOM 3',
    konversi2,
    konversi3,
    hasUom1: configuredHasUom1 === null ? Boolean(uom1Label) : configuredHasUom1 && Boolean(uom1Label),
    hasUom2: (configuredHasUom2 === null ? Boolean(uom2Label) : configuredHasUom2) && konversi2 > 0,
    hasUom3: (configuredHasUom3 === null ? Boolean(uom3Label) : configuredHasUom3) && konversi3 > 0
  };
};

const getReturFieldLevel = (field) => {
  if (field.includes('pieces')) return 1;
  if (field.includes('box')) return 2;
  if (field.includes('karton')) return 3;
  return 0;
};

const getReturFieldFactor = (item, field) => {
  const level = getReturFieldLevel(field);
  if (level === 1) return 1;
  if (level === 2) return Math.max(0, Number(item?.konversi2 || item?.stok?.Konversi2 || 0));
  if (level === 3) return Math.max(0, Number(item?.konversi3 || item?.stok?.Konversi3 || 0));
  return 0;
};

const isReturUomEnabled = (item, level) => {
  if (!item) return false;
  if (level === 1) return Boolean(item.hasUom1 ?? item.stok?.hasUom1);
  if (level === 2) return Boolean(item.hasUom2 ?? item.stok?.hasUom2) && Number(item.konversi2 || item.stok?.Konversi2 || 0) > 0;
  if (level === 3) return Boolean(item.hasUom3 ?? item.stok?.hasUom3) && Number(item.konversi3 || item.stok?.Konversi3 || 0) > 0;
  return false;
};

const getReturUomLabel = (item, level) => {
  if (!isReturUomEnabled(item, level)) return `UOM ${level} belum diset`;
  if (level === 1) return item.uom1Label || item.stok?.Satuan || 'PCS';
  if (level === 2) return `${item.uom2Label || item.stok?.NamaUnit} x ${formatNumber(item.konversi2 || item.stok?.Konversi2 || 0)}`;
  return `${item.uom3Label || item.stok?.Uom3Label} x ${formatNumber(item.konversi3 || item.stok?.Konversi3 || 0)}`;
};

const formatReturnableUom = (item) => {
  let remaining = getReturnableQty(item);
  const uom = buildReturUomMeta(item);
  const parts = [];

  if (uom.hasUom3 && uom.konversi3 > 1) {
    const amount = Math.floor(remaining / uom.konversi3);
    if (amount) parts.push(formatNumber(amount) + ' ' + uom.uom3Label);
    remaining %= uom.konversi3;
  }
  if (uom.hasUom2 && uom.konversi2 > 1) {
    const amount = Math.floor(remaining / uom.konversi2);
    if (amount) parts.push(formatNumber(amount) + ' ' + uom.uom2Label);
    remaining %= uom.konversi2;
  }
  if (remaining || !parts.length) {
    parts.push(formatNumber(remaining) + ' ' + (uom.uom1Label || 'PCS'));
  }
  return parts.join(' + ');
};

const recalculateReturEntry = (entry) => {
  if (!entry) return;
  ['pieces_retur_good', 'box_retur_good', 'karton_retur_good', 'pieces_retur_bad', 'box_retur_bad', 'karton_retur_bad'].forEach((field) => {
    const level = getReturFieldLevel(field);
    if (!isReturUomEnabled(entry, level)) entry[field] = 0;
  });

  const goodCount = Number(entry.pieces_retur_good || 0) + Number(entry.box_retur_good || 0) + Number(entry.karton_retur_good || 0);
  const badCount = Number(entry.pieces_retur_bad || 0) + Number(entry.box_retur_bad || 0) + Number(entry.karton_retur_bad || 0);
  const totalPieces =
    Number(entry.pieces_retur_good || 0) +
    (Number(entry.box_retur_good || 0) * Number(entry.konversi2 || 0)) +
    (Number(entry.karton_retur_good || 0) * Number(entry.konversi3 || 0)) +
    Number(entry.pieces_retur_bad || 0) +
    (Number(entry.box_retur_bad || 0) * Number(entry.konversi2 || 0)) +
    (Number(entry.karton_retur_bad || 0) * Number(entry.konversi3 || 0));

  entry.good_total = goodCount;
  entry.bad_total = badCount;
  entry.total_retur = goodCount + badCount;
  entry.total_retur_pieces = totalPieces;
};

const setReturFieldValue = (entry, field, value) => {
  if (!entry) return 0;
  const level = getReturFieldLevel(field);
  if (!isReturUomEnabled(entry, level)) {
    entry[field] = 0;
    recalculateReturEntry(entry);
    return 0;
  }

  const factor = getReturFieldFactor(entry, field);
  const parsed = Number(value);
  const requested = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  if (factor <= 0) {
    entry[field] = 0;
    recalculateReturEntry(entry);
    return 0;
  }

  // Cap the edited UOM against quantities already entered in every other UOM,
  // so the detail sheet, PCS total, and server validation use one limit.
  entry[field] = 0;
  recalculateReturEntry(entry);
  const remaining = Math.max(
    getReturnableQty(entry.stok || entry) - Number(entry.total_retur_pieces || 0),
    0
  );
  entry[field] = Math.min(requested, Math.floor(remaining / factor));
  recalculateReturEntry(entry);
  return entry[field];
};

const getReturCartSummary = (kode) => {
  const entry = cart.value[String(kode || '').trim()];
  if (!entry || Number(entry.total_retur || 0) <= 0) return '-';
  const good = [
    Number(entry.pieces_retur_good || 0) > 0 ? `${formatNumber(entry.pieces_retur_good)} ${entry.uom1Label}` : '',
    Number(entry.box_retur_good || 0) > 0 ? `${formatNumber(entry.box_retur_good)} ${entry.uom2Label}` : '',
    Number(entry.karton_retur_good || 0) > 0 ? `${formatNumber(entry.karton_retur_good)} ${entry.uom3Label}` : ''
  ].filter(Boolean).join(' | ');
  const bad = [
    Number(entry.pieces_retur_bad || 0) > 0 ? `${formatNumber(entry.pieces_retur_bad)} ${entry.uom1Label}` : '',
    Number(entry.box_retur_bad || 0) > 0 ? `${formatNumber(entry.box_retur_bad)} ${entry.uom2Label}` : '',
    Number(entry.karton_retur_bad || 0) > 0 ? `${formatNumber(entry.karton_retur_bad)} ${entry.uom3Label}` : ''
  ].filter(Boolean).join(' | ');
  return [good ? `Good: ${good}` : '', bad ? `Bad: ${bad}` : ''].filter(Boolean).join(' / ');
};

const normalizeItems = (payload) => {
  const rows = getPayloadArray(payload);

  return rows.map((item, index) => {
    const uom = buildReturUomMeta(item);
    const kode = pickText(
      item.Kode,
      item.KodeStok,
      item.kode_stok,
      item.kode_sku,
      item.sku,
      item.kode,
      item.id_produk,
      item.IDProduk,
      `RETUR-${index + 1}`
    );
    const nama = pickText(
      item.Nama,
      item.NamaStok,
      item.NamaBarang,
      item.nama_produk,
      item.nama_barang,
      item.nama_stok,
      item.produk,
      'Produk'
    );
    let qtySisa = pickNumber(
      item.QtySisaRetur,
      item.qty_sisa_retur,
      item.Suggestion,
      item.suggestion
    );
    if (qtySisa <= 0 && pickText(item.source_mode) === 'master_fallback') {
      qtySisa = pickNumber(item.StokAkhir, item.stok_akhir, item.stok, item.Jumlah);
    }
    const qtySudah = pickNumber(
      item.QtySudahRetur,
      item.qty_sudah_retur,
      item.qty_retur,
      item.jumlah_retur
    );

    return {
      ...item,
      Kode: kode,
      Nama: nama,
      Satuan: pickText(item.Satuan, item.satuan, item.PC, item.pc, 'PCS'),
      NamaUnit: pickText(item.NamaUnit, item.nama_unit),
      Uom1Label: uom.uom1Label,
      Uom2Label: uom.uom2Label,
      Uom3Label: uom.uom3Label,
      Konversi2: uom.konversi2,
      Konversi3: uom.konversi3,
      hasUom1: uom.hasUom1,
      hasUom2: uom.hasUom2,
      hasUom3: uom.hasUom3,
      NamaBrand: pickText(item.NamaBrand, item.nama_brand, item.brand),
      NamaPTAsli: pickText(item.NamaPTAsli, item.nama_principal, item.NamaPrinciple, item.principal),
      HargaE: pickNumber(item.HargaE, item.harga_produk, item.harga, item.Harga),
      Suggestion: qtySisa,
      QtyDikirim: pickNumber(item.QtyDikirim, item.qty_dikirim, item.qty_source, item.qty_order, item.Jumlah),
      QtySudahRetur: qtySudah,
      QtySisaRetur: qtySisa,
      StatusRetur: pickText(item.StatusRetur, item.status_retur, item.status_pengajuan),
      retur_locked: Boolean(item.retur_locked) || pickText(item.source_mode) === 'master_fallback',
      source_mode: pickText(item.source_mode),
      id_sales_order: item.id_sales_order || item.IDSalesOrder || null,
      id_sales_order_detail: item.id_sales_order_detail || item.IDSalesOrderDetail || null,
      id_produk: item.id_produk || item.IDProduk || null
    };
  });
};

const normalizeInvoiceRows = (payload) => {
  return getPayloadArray(payload)
    .map((item) => {
      const idSalesOrder = pickText(item.id_sales_order, item.IDSalesOrder, item.id_order);
      const isBlocked = item.return_allowed === false
        || ['false', '0', 'no'].includes(String(item.return_allowed ?? '').trim().toLowerCase());
      return {
        ...item,
        id_sales_order: idSalesOrder,
        no_faktur: pickText(item.no_faktur, item.NoFaktur),
        no_order: pickText(item.no_order, item.NoOrder),
        reference_no: pickText(
          item.reference_no,
          item.no_faktur,
          item.NoFaktur,
          item.no_order,
          item.NoOrder,
          idSalesOrder ? `SO-${idSalesOrder}` : ''
        ),
        qty_sisa_retur: pickNumber(item.qty_sisa_retur, item.QtySisaRetur),
        qty_sudah_retur: pickNumber(item.qty_sudah_retur, item.QtySudahRetur),
        qty_dikirim: pickNumber(item.qty_dikirim, item.QtyDikirim),
        return_allowed: !isBlocked,
        status_retur: pickText(item.status_retur, item.StatusRetur, isBlocked ? 'Retur masih diproses' : 'Siap diretur')
      };
    })
    .filter((item) => item.id_sales_order);
};

const getReturRequestParams = (limit = 100) => ({
  kode_customer: customerData.value.Kode,
  id_plafon: plafonId.value,
  id_kunjungan: visitId.value,
  limit
});

// Android WebView kadang memulai navigator/Capacitor Network sebagai offline
// walaupun koneksi API sudah tersedia. Jangan langsung mengunci halaman ke cache:
// GET tetap diizinkan oleh axios dan respons dari server menjadi bukti koneksi.
const refreshReturConnectivity = async () => {
  if (connectivityProbePromise) return connectivityProbePromise;

  connectivityProbePromise = (async () => {
    const nativeStatus = await Network.getStatus().catch(() => null);
    if (nativeStatus?.connected === true) {
      connectivity.setOnlineStatus(true);
      return true;
    }

    try {
      await api.get('/api/retur/invoices', {
        params: getReturRequestParams(1),
        timeout: 8000,
        // Kegagalan probe tidak boleh mengubah status global bila memang
        // hanya endpoint retur yang sedang bermasalah.
        suppressOfflineStatus: true
      });
      connectivity.setOnlineStatus(true);
      return true;
    } catch (error) {
      // Respons HTTP (mis. validasi/401) tetap membuktikan perangkat dapat
      // mencapai server. Interceptor akan menangani autentikasi bila perlu.
      if (error?.response) {
        connectivity.setOnlineStatus(true);
        return true;
      }

      if (nativeStatus?.connected === false || !connectivity.isOnline) {
        connectivity.setOnlineStatus(false);
      }
      return false;
    } finally {
      connectivityProbePromise = null;
    }
  })();

  return connectivityProbePromise;
};

const retryConnection = async () => {
  if (isCheckingConnection.value) return;
  isCheckingConnection.value = true;
  try {
    const isConnected = await refreshReturConnectivity();
    if (isConnected) {
      await fetchInvoices();
      offset.value = 0;
      hasMore.value = true;
      rawData.value = [];
      await fetchData(false);
      await updateMaxSlide();
    } else {
      await Swal.fire({
        icon: 'warning',
        title: 'Masih Offline',
        text: 'Server belum dapat dihubungi. Draft retur tetap tersimpan lokal.',
        timer: 1500,
        showConfirmButton: false
      });
    }
  } finally {
    isCheckingConnection.value = false;
  }
};

const fetchInvoices = async () => {
  invoiceLoading.value = true;
  try {
    if (isOffline.value) await refreshReturConnectivity();

    if (isOffline.value) {
      invoiceRows.value = normalizeInvoiceRows(await getCacheDb(`${cachePrefix.value}:invoices`));
    } else {
      const res = await api.get('/api/retur/invoices', {
        params: getReturRequestParams(100)
      });
      invoiceRows.value = normalizeInvoiceRows(res.data);
      await saveCacheDb(`${cachePrefix.value}:invoices`, invoiceRows.value);
    }
  } catch (error) {
    console.error('❌ Gagal memuat nota/faktur retur:', error);
    invoiceRows.value = normalizeInvoiceRows(await getCacheDb(`${cachePrefix.value}:invoices`));
  } finally {
    const selected = invoiceRows.value.find(
      (invoice) => String(invoice.id_sales_order) === String(selectedInvoiceId.value)
    );
    if (selectedInvoiceId.value && (!selected || selected.return_allowed === false)) {
      selectedInvoiceId.value = '';
      activeInvoiceId.value = '';
      cart.value = {};
    }
    invoiceLoading.value = false;
  }
};

// fetch
const fetchData = async (isLoadMore = false) => {
  if (loading.value || (!hasMore.value && isLoadMore)) return;
  if (activeTab.value !== 'history' && !selectedInvoiceId.value) {
    rawData.value = [];
    hasMore.value = false;
    return;
  }

  loading.value = true;

  try {
    if (isOffline.value) await refreshReturConnectivity();

    if (isOffline.value) {
      const cached = normalizeItems(await getCacheDb(itemCacheKey.value));
      rawData.value = cached;
      rawData.value.forEach(hydrateCartEntry);
      hasMore.value = false;

      if (cached.length > 0 && !isLoadMore) {
        await Swal.fire({
          icon: 'info',
          title: 'Mode Offline',
          text: 'Menampilkan cache retur dari SQLite.',
          timer: 1300,
          showConfirmButton: false
        });
      }
      return;
    }

    const endpoint =
      activeTab.value === 'fav'
        ? '/api/retur/suggestion'
        : activeTab.value === 'history'
          ? '/api/retur/history'
          : '/api/retur/all';

    const res = await api.get(endpoint, {
      params: {
        kode_customer: customerData.value.Kode,
        id_plafon: plafonId.value,
        id_kunjungan: visitId.value,
        id_sales_order: activeTab.value === 'history' ? undefined : selectedInvoiceId.value,
        limit,
        offset: offset.value
      }
    });

    const newData = normalizeItems(res.data);

    if (!isLoadMore) rawData.value = [];
    if (newData.length < limit) hasMore.value = false;

    newData.forEach((item) => {
      hydrateCartEntry(item);
      const exists = rawData.value.find((x) => x.Kode === item.Kode);
      if (!exists) rawData.value.push(item);
    });

    offset.value += limit;
    await saveCacheDb(itemCacheKey.value, rawData.value);
  } catch (error) {
    console.error('❌ Gagal load data retur:', error);

    const cached = normalizeItems(await getCacheDb(itemCacheKey.value));
    rawData.value = cached;
    rawData.value.forEach(hydrateCartEntry);
    hasMore.value = false;

    if (cached.length > 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'Koneksi Bermasalah',
        text: 'Menampilkan cache retur terakhir dari SQLite.',
        timer: 1400,
        showConfirmButton: false
      });
    }
  } finally {
    loading.value = false;
  }
};

const onInvoiceChange = async () => {
  const nextInvoiceId = String(selectedInvoiceId.value || '').trim();
  const previousInvoiceId = String(activeInvoiceId.value || '').trim();

  if (nextInvoiceId === previousInvoiceId) {
    offset.value = 0;
    hasMore.value = true;
    rawData.value = [];
    await fetchData(false);
    return;
  }

  if (previousInvoiceId && totalItems.value > 0) {
    const decision = await Swal.fire({
      icon: 'warning',
      title: 'Ganti Nota/Faktur?',
      text: 'Keranjang retur hanya berlaku untuk satu nota/faktur. Draft nota sebelumnya akan disimpan terpisah.',
      showCancelButton: true,
      confirmButtonText: 'Ganti Nota',
      cancelButtonText: 'Tetap di Nota Lama',
      confirmButtonColor: '#dc2626'
    });
    if (!decision.isConfirmed) {
      selectedInvoiceId.value = previousInvoiceId;
      return;
    }
  }

  if (previousInvoiceId) {
    await saveDraftDb(getCartDraftKey(previousInvoiceId), cart.value);
  }

  activeInvoiceId.value = nextInvoiceId;
  cart.value = nextInvoiceId ? ((await getDraftDb(getCartDraftKey(nextInvoiceId))) || {}) : {};
  selectedItemDetail.value = null;
  showItemDetail.value = false;
  offset.value = 0;
  hasMore.value = true;
  rawData.value = [];
  currentX.value = 0;
  await persistMetaDraft();
  await fetchData(false);
  await updateMaxSlide();
};

const handleScroll = (e) => {
  if (isOffline.value) return;
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  if (scrollTop + clientHeight >= scrollHeight - 100) {
    fetchData(true);
  }
};

// item detail
const openItemDetail = (item) => {
  if (getReturnableQty(item) <= 0) {
    Swal.fire({
      icon: 'info',
      title: 'Tidak Bisa Diretur',
      text: item?.source_mode === 'master_fallback'
        ? 'Produk ini belum memiliki nota/order sumber. Retur hanya bisa diajukan dari barang yang sudah ada nota atau order terkirim.'
        : 'Sisa retur produk ini sudah habis atau belum tersedia.',
      confirmButtonText: 'Mengerti'
    });
    return;
  }

  const entry = ensureCartEntry(item);
  const uom = buildReturUomMeta(item);

  entry.nama = String(item.Nama || '').trim();
  entry.uom1Label = uom.uom1Label;
  entry.uom2Label = uom.uom2Label;
  entry.uom3Label = uom.uom3Label;
  entry.konversi2 = uom.konversi2;
  entry.konversi3 = uom.konversi3;
  entry.hasUom1 = uom.hasUom1;
  entry.hasUom2 = uom.hasUom2;
  entry.hasUom3 = uom.hasUom3;
  entry.harga = Number(item.HargaE || 0);
  entry.stok = item;
  recalculateReturEntry(entry);

  selectedItemDetail.value = entry;
  selectedQtyInput.value = String(Number(entry.total_retur_pieces || 0));
  showItemDetail.value = true;
};

const closeItemDetail = () => {
  showItemDetail.value = false;
  selectedItemDetail.value = null;
  selectedQtyInput.value = '';
};

const syncSelectedQty = () => {
  if (!selectedItemDetail.value) return;
  const maxQty = getSelectedReturnableQty();
  const parsed = Math.min(maxQty, Math.max(0, Number(selectedQtyInput.value || 0)));
  selectedItemDetail.value.pieces_retur_bad = Number.isNaN(parsed) ? 0 : parsed;
  recalculateReturEntry(selectedItemDetail.value);
  selectedQtyInput.value = selectedItemDetail.value.total_retur_pieces ? String(selectedItemDetail.value.total_retur_pieces) : '';
};

const changeSelectedQty = (delta) => {
  if (!selectedItemDetail.value) return;
  const current = Number(selectedItemDetail.value.pieces_retur_bad || 0);
  const next = Math.min(getSelectedReturnableQty(), Math.max(0, current + delta));
  selectedItemDetail.value.pieces_retur_bad = next;
  recalculateReturEntry(selectedItemDetail.value);
  selectedQtyInput.value = String(next);
};

const updateReturField = async (entry, field, value) => {
  if (!entry) return;
  setReturFieldValue(entry, field, value);
  await persistCartDraft();
};

const changeReturField = async (entry, field, delta) => {
  if (!entry) return;
  const level = getReturFieldLevel(field);
  if (!isReturUomEnabled(entry, level)) return;
  const current = Number(entry[field] || 0);
  await updateReturField(entry, field, Math.max(0, current + delta));
};

const saveSelectedItemDetail = async () => {
  if (!selectedItemDetail.value) return;

  const kode = String(selectedItemDetail.value.kode || '').trim();
  const maxQty = getSelectedReturnableQty();
  recalculateReturEntry(selectedItemDetail.value);
  const totalPieces = Math.max(0, Number(selectedItemDetail.value.total_retur_pieces || 0));
  if (totalPieces > maxQty) {
    await Swal.fire({
      icon: 'warning',
      title: 'Qty Retur Melebihi Sisa',
      text: 'Maksimal retur untuk produk ini adalah ' + formatReturnableUom(selectedItemDetail.value.stok) + '.'
    });
    return;
  }

  if (cart.value[kode]) {
    cart.value[kode] = {
      ...cart.value[kode],
      ...selectedItemDetail.value,
      total_retur_pieces: totalPieces
    };
  }

  await persistCartDraft();
  closeItemDetail();
};

const removeSelectedItem = async () => {
  if (!selectedItemDetail.value) return;
  const kode = String(selectedItemDetail.value.kode || '').trim();

  if (cart.value[kode]) {
    cart.value[kode] = {
      ...cart.value[kode],
      pieces_retur_good: 0,
      box_retur_good: 0,
      karton_retur_good: 0,
      pieces_retur_bad: 0,
      box_retur_bad: 0,
      karton_retur_bad: 0,
      total_retur: 0,
      total_retur_pieces: 0
    };
  }

  await persistCartDraft();
  closeItemDetail();
};

// slide
const updateMaxSlide = async () => {
  await nextTick();
  const track = slideTrackRef.value;
  if (track) {
    maxSlide.value = Math.max(track.offsetWidth - 60, 0);
    if (currentX.value > maxSlide.value) currentX.value = maxSlide.value;
  }
};

const startSlide = () => {
  if (totalItems.value > 0 && !isSubmitting.value) currentX.value = 0;
};

const moveSlide = (e) => {
  if (totalItems.value === 0 || isSubmitting.value) return;

  const track = slideTrackRef.value;
  if (!track) return;

  const rect = track.getBoundingClientRect();
  let x = e.touches[0].clientX - rect.left - 28;

  if (x < 0) x = 0;
  if (x > maxSlide.value) x = maxSlide.value;
  currentX.value = x;
};

const endSlide = () => {
  if (currentX.value >= maxSlide.value * 0.9) {
    currentX.value = maxSlide.value;
    confirmSubmit();
  } else {
    currentX.value = 0;
  }
};

// payload
const buildReturPayload = () => {
  const sourceSalesOrderId = String(selectedInvoiceId.value || '').trim();
  const items = Object.values(cart.value)
    .filter((i) => Number(i.total_retur_pieces) > 0)
    .map((i) => {
      recalculateReturEntry(i);
      return {
        KodeStok: i.kode,
        NamaStok: i.nama,
        Qty: Number(i.total_retur_pieces),
        Unit: i.uom1Label,
        Harga: Number(i.harga) || 0,
        Total: (Number(i.total_retur_pieces) || 0) * (Number(i.harga) || 0),
        id_produk: i.stok?.id_produk || null,
        id_sales_order: i.stok?.id_sales_order || sourceSalesOrderId || null,
        id_sales_order_detail: i.stok?.id_sales_order_detail || null,
        source_mode: i.stok?.source_mode || '',
        StatusRetur: i.stok?.StatusRetur || '',
        QtySisaRetur: getReturnableQty(i.stok),
        QtySudahRetur: Number(i.stok?.QtySudahRetur || 0),
        NamaBrand: i.stok?.NamaBrand || '',
        NamaPTAsli: i.stok?.NamaPTAsli || '',
        pieces_retur_good: Number(i.pieces_retur_good || 0),
        box_retur_good: Number(i.box_retur_good || 0),
        karton_retur_good: Number(i.karton_retur_good || 0),
        pieces_retur_bad: Number(i.pieces_retur_bad || 0),
        box_retur_bad: Number(i.box_retur_bad || 0),
        karton_retur_bad: Number(i.karton_retur_bad || 0),
        total_retur: Number(i.total_retur || 0),
        total_retur_pieces: Number(i.total_retur_pieces || 0),
        keterangan_retur: i.keterangan_retur || '',
        uom1_label: i.uom1Label,
        uom2_label: i.uom2Label,
        uom3_label: i.uom3Label,
        konversi_2: Number(i.konversi2 || 0),
        konversi_3: Number(i.konversi3 || 0)
      };
    });

  return {
    retur_id: uuidv4(),
    id_sales_order: sourceSalesOrderId || null,
    source_sales_order_id: sourceSalesOrderId || null,
    source_reference: selectedInvoice.value?.reference_no || '',
    kode_customer: customerData.value.Kode,
    nama_customer: customerData.value.Nama,
    id_plafon: plafonId.value,
    id_kunjungan: visitId.value,
    tanggal_transaksi: tanggalTransaksi.value,
    tanggal_retur_pengajuan: tanggalTransaksi.value,
    keterangan: String(keterangan.value || '').trim(),
    items,
    products: items,
    subtotal: subtotalRetur.value,
    ppn: ppnRetur.value,
    grand_total: grandTotalRetur.value,
    total_retur: grandTotalRetur.value,
    status_pengajuan: 'Menunggu Persetujuan',
    created_offline_at: new Date().toISOString()
  };
};

const clearCartAfterSubmit = async () => {
  const nextCart = { ...cart.value };
  Object.keys(nextCart).forEach((key) => {
    nextCart[key] = {
      ...nextCart[key],
      pieces_retur_good: 0,
      box_retur_good: 0,
      karton_retur_good: 0,
      pieces_retur_bad: 0,
      box_retur_bad: 0,
      karton_retur_bad: 0,
      total_retur: 0,
      total_retur_pieces: 0,
      keterangan_retur: ''
    };
  });

  cart.value = nextCart;
  keterangan.value = '';
  tanggalTransaksi.value = toLocalDateInputValue();
  await persistCartDraft();
  await persistMetaDraft();
};

const submitReturToServer = async (payload) => {
  const clientReturId = String(payload.retur_id || '').trim();
  return api.post('/api/retur/save', {
    retur_id: clientReturId,
    client_retur_id: clientReturId,
    idempotency_key: clientReturId,
    id_sales_order: payload.id_sales_order,
    source_sales_order_id: payload.id_sales_order,
    // Keep the human-readable source document alongside the immutable order
    // ID.  The API can ignore this on older releases, while newer releases
    // can retain it for the return audit trail.
    source_reference: payload.source_reference || '',
    kode_customer: payload.kode_customer,
    id_plafon: payload.id_plafon,
    id_kunjungan: payload.id_kunjungan,
    tanggal_transaksi: payload.tanggal_transaksi,
    tanggal_retur_pengajuan: payload.tanggal_retur_pengajuan,
    keterangan: payload.keterangan,
    items: payload.items,
    products: payload.products,
    subtotal: payload.subtotal,
    ppn: payload.ppn,
    total_retur: payload.total_retur
  });
};

// achievement hook
const refreshAchievementSafely = async () => {
  try {
    window.dispatchEvent(new CustomEvent('achievement:refresh'));
  } catch (err) {
    console.warn('⚠️ achievement refresh hook gagal:', err);
  }
};

// submit
const confirmSubmit = async () => {
  if (!selectedInvoiceId.value) {
    currentX.value = 0;
    return Swal.fire('Pilih Nota/Faktur', 'Pilih nota/faktur sumber sebelum mengajukan retur.', 'warning');
  }
  const payload = buildReturPayload();
  const itemRows = payload.items.map((item) => `
    <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #fee2e2;">
      <div style="text-align:left;min-width:0;">
        <b>${escapeHtml(item.NamaStok)}</b><br/>
        <small style="color:#64748b">${escapeHtml(item.KodeStok)} - sisa ${formatNumber(item.QtySisaRetur || 0)}</small>
      </div>
      <div style="text-align:right;white-space:nowrap;">
        <b>${formatNumber(item.Qty)} ${escapeHtml(item.Unit || 'PCS')}</b><br/>
        <small style="color:#991b1b">Rp ${formatNumber(item.Total)}</small>
      </div>
    </div>
  `).join('');

  const result = await Swal.fire({
    title: isOffline.value ? 'Simpan Offline?' : 'Konfirmasi Retur',
    html: `
      <div style="text-align:left">
        <p style="margin:0 0 10px;color:#475569">
          ${isOffline.value
            ? 'Barang yang dipilih akan masuk antrean retur offline.'
            : 'Barang yang dipilih akan diajukan untuk persetujuan retur.'}
        </p>
        <div style="max-height:220px;overflow:auto">${itemRows}</div>
        <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:14px">
          <span>Total Estimasi</span>
          <b>Rp ${formatNumber(payload.grand_total)}</b>
        </div>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: isOffline.value ? 'Ya, Simpan' : 'Ya, Kirim'
  });

  if (result.isConfirmed) {
    submitRetur();
  } else {
    currentX.value = 0;
  }
};

const submitRetur = async () => {
  const payload = buildReturPayload();

  if (!payload.id_sales_order) {
    currentX.value = 0;
    return Swal.fire('Pilih Nota/Faktur', 'Pilih nota/faktur sumber sebelum menyimpan retur.', 'warning');
  }

  if (payload.items.length === 0) {
    currentX.value = 0;
    return Swal.fire('Peringatan', 'Belum ada barang retur yang diisi.', 'warning');
  }

  const overQtyItem = payload.items.find((item) => Number(item.Qty || 0) > Number(item.QtySisaRetur || 0));
  if (overQtyItem) {
    currentX.value = 0;
    return Swal.fire({
      icon: 'warning',
      title: 'Qty Retur Melebihi Sisa',
      text: `${overQtyItem.NamaStok} hanya bisa diretur ${formatNumber(overQtyItem.QtySisaRetur)} ${overQtyItem.Unit || 'PCS'}.`
    });
  }

  if (!isTanggalValid.value) {
    currentX.value = 0;
    return Swal.fire('Peringatan', 'Tanggal transaksi tidak valid.', 'warning');
  }

  isSubmitting.value = true;

  try {
    if (isOffline.value) {
      await saveReturToOfflineQueue(payload);
      await clearCartAfterSubmit();
      await refreshPendingCount();
      currentX.value = 0;

      await Swal.fire({
        icon: 'info',
        title: 'Tersimpan Offline',
        text: 'Retur masuk antrean SQLite dan akan diupload saat online.',
        timer: 1600,
        showConfirmButton: false
      });

      router.back();
      return;
    }

    const res = await submitReturToServer(payload);
    const isSuccess = res.data?.success === true || String(res.data?.status || '').toLowerCase() === 'success';

    if (isSuccess) {
      await clearCartAfterSubmit();
      await refreshAchievementSafely();

      const successNumber =
        res.data?.data?.no_retur ||
        res.data?.data?.no_nota ||
        res.data?.data?.kode ||
        res.data?.kode_request ||
        res.data?.message ||
        'Retur berhasil diajukan';

      await Swal.fire({
        icon: 'success',
        title: 'Retur Berhasil',
        html: `
          <div class="retur-success-message">
            <div class="retur-success-caption">Pengajuan retur sudah tersimpan</div>
            <div class="retur-success-code">
              ${escapeHtml(successNumber)}
            </div>
          </div>
        `,
        customClass: {
          popup: 'retur-success-popup'
        },
        confirmButtonText: 'Selesai'
      });
      router.back();
      return;
    }

    throw new Error(res.data?.message || 'Gagal simpan retur');
  } catch (e) {
    console.error('❌ Submit retur error:', e);

    const statusCode = Number(e?.response?.status || 0);
    if (statusCode >= 400 && statusCode < 500) {
      currentX.value = 0;
      await Swal.fire({
        icon: 'error',
        title: 'Retur Ditolak',
        text:
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e.message ||
          'Data retur belum valid.'
      });
      return;
    }

    await saveReturToOfflineQueue(payload);
    await clearCartAfterSubmit();
    await refreshPendingCount();
    currentX.value = 0;

    await Swal.fire({
      icon: 'warning',
      title: 'Disimpan ke Antrean',
      text: 'Koneksi bermasalah. Retur disimpan di SQLite dan akan diupload saat online.',
      confirmButtonText: 'OK'
    });

    router.back();
  } finally {
    isSubmitting.value = false;
  }
};

// pending
const uploadPendingRetur = async () => {
  if (isOffline.value) {
    await Swal.fire('Offline', 'Upload pending hanya bisa saat online.', 'info');
    return;
  }

  if (pendingCount.value === 0) {
    await Swal.fire('Info', 'Tidak ada retur pending.', 'info');
    return;
  }

  if (isAutoUploading.value || isUploadingPending.value) return;

  isUploadingPending.value = true;

  try {
    const result = await SyncService.uploadPendingReturData();
    await refreshPendingCount();

    if (result.success) {
      if (pendingCount.value === 0) {
        await Swal.fire({
          icon: 'success',
          title: 'Selesai',
          text: 'Semua retur pending berhasil diupload.',
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        await Swal.fire(
          'Sebagian Gagal',
          `${pendingCount.value} retur masih pending dan akan dicoba lagi nanti.`,
          'warning'
        );
      }
    } else {
      await Swal.fire('Gagal', result.message || 'Gagal upload pending retur.', 'error');
    }
  } finally {
    isUploadingPending.value = false;
  }
};

const autoUploadPendingRetur = async () => {
  if (isOffline.value || pendingCount.value === 0 || isAutoUploading.value) return;

  isAutoUploading.value = true;
  try {
    await SyncService.uploadPendingReturData();
    await refreshPendingCount();
  } catch (error) {
    console.error('❌ autoUploadPendingRetur error:', error);
  } finally {
    isAutoUploading.value = false;
  }
};

// ui helpers
const formatNumber = (val) => new Intl.NumberFormat('id-ID').format(Number(val) || 0);

const getInitial = (name) => {
  return String(name || 'T').trim().charAt(0).toUpperCase();
};

const switchTab = async (t) => {
  if (activeTab.value === t) return;

  activeTab.value = t;
  offset.value = 0;
  hasMore.value = true;
  rawData.value = [];
  currentX.value = 0;

  await fetchData(false);
  await updateMaxSlide();
};

const filteredItems = computed(() => {
  if (!searchQuery.value) return rawData.value;
  const q = searchQuery.value.toLowerCase();

  return rawData.value.filter((i) =>
    String(i.Nama || '').toLowerCase().includes(q) ||
    String(i.Kode || '').toLowerCase().includes(q)
  );
});

const updateQty = async (item, value) => {
  const entry = ensureCartEntry(item);
  const uom = buildReturUomMeta(item);
  const parsed = value === '' ? 0 : Math.min(getReturnableQty(item), Math.max(0, Number(value)));

  entry.nama = String(item.Nama || '').trim();
  entry.uom1Label = uom.uom1Label;
  entry.uom2Label = uom.uom2Label;
  entry.uom3Label = uom.uom3Label;
  entry.konversi2 = uom.konversi2;
  entry.konversi3 = uom.konversi3;
  entry.hasUom1 = uom.hasUom1;
  entry.hasUom2 = uom.hasUom2;
  entry.hasUom3 = uom.hasUom3;
  entry.harga = Number(item.HargaE || 0);
  entry.stok = item;
  setReturFieldValue(entry, 'pieces_retur_bad', parsed);

  await persistCartDraft();
};

const updateUnit = async (item, value) => {
  const entry = ensureCartEntry(item);
  entry.nama = String(item.Nama || '').trim();
  entry.harga = Number(item.HargaE || 0);
  entry.stok = item;
  entry.uom1Label = value || entry.uom1Label;

  await persistCartDraft();
};

const changeQty = async (item, delta) => {
  const current = getCartQty(item.Kode);
  const next = Math.max(0, current + delta);
  await updateQty(item, next);
};

const setQtyInputRef = (kode, el) => {
  if (el) {
    qtyInputRefs.value[String(kode || '').trim()] = el;
  }
};

const escapeHtml = (unsafe) => {
  return String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const showCartPreview = () => {
  const items = Object.values(cart.value).filter((i) => Number(i.total_retur_pieces) > 0);
  if (items.length === 0) return;

  const list = items.map((i) => `
    <div style="display:flex; justify-content:space-between; gap:12px; font-size:13px; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:6px;">
      <span style="text-align:left;">${escapeHtml(i.nama)}</span>
      <div style="text-align:right;">
        <b style="white-space:nowrap;">${escapeHtml(getReturCartSummary(i.kode))}</b><br/>
        <span style="font-size:12px; color:#64748b;">Rp ${formatNumber((Number(i.total_retur_pieces) || 0) * (Number(i.harga) || 0))}</span>
      </div>
    </div>
  `).join('');

  Swal.fire({
    title: 'Ringkasan Retur',
    html: `
      <div style="text-align:left; max-height:300px; overflow-y:auto;">
        ${list}
        <div style="margin-top:14px; display:flex; justify-content:space-between; font-size:14px;">
          <span>Total</span>
          <strong>Rp ${formatNumber(subtotalRetur.value)}</strong>
        </div>
        <div style="margin-top:8px; display:flex; justify-content:space-between; font-size:14px;">
          <span>PPN (11%)</span>
          <strong>Rp ${formatNumber(ppnRetur.value)}</strong>
        </div>
        <div style="margin-top:8px; display:flex; justify-content:space-between; font-size:15px;">
          <span><b>Grand Total</b></span>
          <strong>Rp ${formatNumber(grandTotalRetur.value)}</strong>
        </div>
      </div>
    `,
    confirmButtonText: 'Tutup'
  });
};

// watchers
watch(
  () => cart.value,
  async () => {
    await persistCartDraft();
  },
  { deep: true }
);

watch(tanggalTransaksi, async () => {
  await persistMetaDraft();
});

watch(keterangan, async () => {
  await persistMetaDraft();
});

watch(
  () => connectivity.isOnline,
  async (online) => {
    if (online) {
      await autoUploadPendingRetur();
      await fetchInvoices();
      offset.value = 0;
      hasMore.value = true;
      rawData.value = [];
      await fetchData(false);
      await updateMaxSlide();
    }
  }
);

// init
const handleResize = () => {
  updateMaxSlide();
};

const handleConnectionResume = async () => {
  if (document.visibilityState && document.visibilityState !== 'visible') return;
  if (isOffline.value) await refreshReturConnectivity();
};

onMounted(async () => {
  await restoreMetaDraft();
  await fetchInvoices();
  await restoreCartDraft();
  await refreshPendingCount();
  await fetchData(false);
  await updateMaxSlide();

  window.addEventListener('resize', handleResize);
  window.addEventListener('focus', handleConnectionResume);
  document.addEventListener('visibilitychange', handleConnectionResume);

  if (!isOffline.value && pendingCount.value > 0) {
    await autoUploadPendingRetur();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('focus', handleConnectionResume);
  document.removeEventListener('visibilitychange', handleConnectionResume);
});
</script>

<style scoped>
:global(body) {
  background: #eef2f7;
}

.page-wrapper {
  position: relative;
  background:
    radial-gradient(circle at top left, rgba(239, 68, 68, 0.08), transparent 30%),
    radial-gradient(circle at top right, rgba(185, 28, 28, 0.08), transparent 28%),
    linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
  min-height: 100vh;
  display: flex;
  justify-content: stretch;
  overflow: hidden;
  width: 100vw;
}

.bg-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(50px);
  pointer-events: none;
  opacity: 0.22;
}

.orb-1 {
  width: 220px;
  height: 220px;
  background: #fca5a5;
  top: -40px;
  left: -60px;
}

.orb-2 {
  width: 240px;
  height: 240px;
  background: #fecaca;
  right: -80px;
  bottom: 120px;
}

.so-container {
  position: relative;
  width: 100vw;
  max-width: none;
  background: rgba(255, 255, 255, 0.90);
  backdrop-filter: blur(22px);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 18px 60px rgba(15, 23, 42, 0.10),
    0 4px 18px rgba(239, 68, 68, 0.06);
  border-left: 0;
  border-right: 0;
}

.header.red-header {
  background: linear-gradient(135deg, #991b1b 0%, #b91c1c 42%, #ef4444 100%);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
  box-shadow: 0 12px 24px rgba(185, 28, 28, 0.18);
}

.btn-back,
.header-cart {
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
}

.btn-back,
.cart-icon-wrapper {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  font-size: 1.45rem;
  line-height: 1;
  color: white;
  background: rgba(255,255,255,0.18);
  backdrop-filter: blur(10px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-title {
  flex: 1;
  min-width: 0;
}

.header-title h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.2px;
}

.header-title p {
  margin: 3px 0 0;
  font-size: 0.77rem;
  opacity: 0.92;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cart-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  font-size: 0.78rem;
  font-weight: 800;
  background: rgba(255,255,255,0.18);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.22),
    0 8px 18px rgba(127, 29, 29, 0.16);
}

.cart-badge {
  position: absolute;
  top: -5px;
  right: -4px;
  background: white;
  color: #b91c1c;
  font-size: 0.7rem;
  font-weight: 900;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}

.offline-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(90deg, #f59e0b 0%, #f97316 100%);
  color: white;
  text-align: center;
  padding: 10px 12px;
  font-size: 0.75rem;
  font-weight: 800;
}

.offline-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: white;
  box-shadow: 0 0 0 4px rgba(255,255,255,0.18);
}

.offline-retry {
  border: 1px solid rgba(255,255,255,0.65);
  border-radius: 999px;
  padding: 4px 8px;
  background: rgba(255,255,255,0.16);
  color: inherit;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 900;
  cursor: pointer;
}

.offline-retry:disabled {
  cursor: wait;
  opacity: 0.7;
}

.nav-section {
  padding: 14px 14px 10px;
  background: linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.82) 100%);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(226, 232, 240, 0.85);
  z-index: 10;
}

.fixed-nav-wrapper {
  position: sticky;
  top: 0;
  z-index: 8;
}

.tabs-wrapper {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.search-wrapper {
  margin-top: 12px;
}

.invoice-source-box {
  margin-top: 12px;
  padding: 11px 12px;
  border: 1px solid #fecaca;
  border-radius: 14px;
  background: linear-gradient(135deg, #fff7f7 0%, #fff 100%);
}

.invoice-source-box label {
  display: block;
  margin-bottom: 7px;
  color: #991b1b;
  font-size: 0.76rem;
  font-weight: 800;
}

.invoice-source-box label span {
  color: #dc2626;
}

.invoice-source-select {
  width: 100%;
  box-sizing: border-box;
  min-height: 42px;
  padding: 9px 10px;
  border: 1px solid #fca5a5;
  border-radius: 10px;
  background: #fff;
  color: #0f172a;
  font-size: 0.86rem;
}

.invoice-source-select:disabled {
  color: #94a3b8;
  background: #f8fafc;
}

.invoice-source-box small {
  display: block;
  margin-top: 7px;
  color: #64748b;
  font-size: 0.7rem;
  line-height: 1.35;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.summary-pill {
  background: #fff7f7;
  border: 1px solid #fee2e2;
  border-radius: 14px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-pill small {
  font-size: 0.68rem;
  color: #94a3b8;
  font-weight: 700;
}

.summary-pill strong {
  font-size: 0.92rem;
  color: #991b1b;
}

.customer-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, #fff 0%, #fff5f5 100%);
  border: 1px solid #fee2e2;
  border-radius: 18px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
}

.customer-mini {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.customer-avatar {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
  color: white;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 16px rgba(239, 68, 68, 0.22);
}

.customer-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.customer-text strong {
  font-size: 0.88rem;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.customer-text span {
  font-size: 0.73rem;
  color: #64748b;
}

.summary-mini {
  display: flex;
  gap: 8px;
}

.summary-mini-item {
  min-width: 76px;
  background: rgba(255,255,255,0.84);
  border: 1px solid #fee2e2;
  border-radius: 14px;
  padding: 8px 10px;
  text-align: center;
}

.summary-mini-item span {
  display: block;
  font-size: 0.67rem;
  color: #64748b;
  margin-bottom: 2px;
}

.summary-mini-item strong {
  display: block;
  font-size: 0.8rem;
  color: #991b1b;
}

.tabs-container {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.tab-btn {
  flex: 1;
  padding: 10px 8px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  font-size: 0.8rem;
  font-weight: 700;
  color: #475569;
}

.tab-btn.active {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border-color: #ef4444;
  box-shadow: 0 8px 20px rgba(239, 68, 68, 0.22);
}

.search-box {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  font-size: 0.95rem;
}

.search-input {
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1.5px solid #e2e8f0;
  background: rgba(248, 250, 252, 0.96);
  font-size: 0.9rem;
  outline: none;
  box-sizing: border-box;
  color: #0f172a;
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.72) 0%, rgba(241, 245, 249, 0.96) 100%);
  -webkit-overflow-scrolling: touch;
}

.stock-card {
  position: relative;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.94);
  border-radius: 20px;
  padding: 14px;
  margin-bottom: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04), 0 2px 6px rgba(15, 23, 42, 0.03);
}

.card-active-red {
  border-color: #fca5a5;
  background: linear-gradient(135deg, #ffffff 0%, #fff7f7 100%);
  box-shadow: 0 12px 26px rgba(239, 68, 68, 0.10), 0 2px 8px rgba(239, 68, 68, 0.06);
}

.stock-card.is-unavailable {
  opacity: 0.88;
  background: #f8fafc;
}

.stock-card.is-unavailable .item-name-full {
  color: #64748b;
}

.stock-card.is-unavailable .qty-input-plain,
.stock-card.is-unavailable .unit-select {
  background: #f1f5f9;
  color: #94a3b8;
}

.card-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, #ef4444 0%, #fca5a5 100%);
  opacity: 0.85;
}

.card-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.top-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.brand-tag {
  font-size: 0.64rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.7px;
}

.item-name {
  margin: 8px 0 10px;
  font-size: 0.96rem;
  color: #0f172a;
  font-weight: 800;
  line-height: 1.35;
}

.item-meta-wrap {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.item-meta {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 8px 10px;
}

.meta-label {
  display: block;
  font-size: 0.66rem;
  color: #94a3b8;
  margin-bottom: 2px;
  font-weight: 700;
  text-transform: uppercase;
}

.meta-value {
  display: block;
  font-size: 0.78rem;
  color: #334155;
  font-weight: 700;
  word-break: break-word;
}

.price {
  color: #991b1b;
}

.suggest-chip {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 0.66rem;
  font-weight: 800;
}

.item-action {
  width: 108px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.input-label,
.field-label {
  font-size: 0.68rem;
  font-weight: 800;
  color: #94a3b8;
  text-transform: uppercase;
}

.qty-box {
  display: grid;
  grid-template-columns: 30px 1fr 30px;
  gap: 6px;
  align-items: center;
}

.qty-btn {
  height: 38px;
  border: none;
  border-radius: 12px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 1rem;
  font-weight: 900;
  box-shadow: inset 0 0 0 1px #fecaca;
}

.qty-input {
  width: 100%;
  padding: 9px 8px;
  border-radius: 12px;
  border: 2px solid #f1f5f9;
  text-align: center;
  font-weight: 900;
  font-size: 1.06rem;
  color: #b91c1c;
  outline: none;
  box-sizing: border-box;
  background: #fff;
  appearance: textfield;
}

.qty-input::-webkit-outer-spin-button,
.qty-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.unit-select,
.date-input,
.note-input {
  width: 100%;
  padding: 10px 12px;
  font-size: 0.82rem;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #fff;
  font-weight: 700;
  color: #475569;
  outline: none;
  box-sizing: border-box;
}

.note-input {
  resize: vertical;
  min-height: 82px;
  font-weight: 600;
}

.line-total {
  text-align: center;
  font-size: 0.7rem;
  font-weight: 800;
  color: #b91c1c;
  background: #fff5f5;
  border: 1px solid #fee2e2;
  border-radius: 10px;
  padding: 5px 6px;
}

.btn-detail-mini {
  border: none;
  background: #fff;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 7px 8px;
  font-size: 0.7rem;
  font-weight: 800;
}

.footer-action {
  padding: 14px 16px 22px;
  background: rgba(255,255,255,0.94);
  backdrop-filter: blur(18px);
  border-top: 1px solid rgba(226, 232, 240, 0.85);
  box-shadow: 0 -10px 22px rgba(15, 23, 42, 0.04);
}

.cart-brief {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px 14px;
  background: #fff7f7;
  border: 1px solid #fee2e2;
  border-radius: 14px;
  font-size: 0.78rem;
  color: #64748b;
}

.cart-brief b {
  color: #991b1b;
}

.stock-list {
  display: grid;
  gap: 12px;
}

.item-code {
  display: block;
  margin-top: 6px;
  font-size: 0.78rem;
  color: #475569;
  font-weight: 500;
  letter-spacing: 0;
  word-break: break-word;
}

.item-name-full {
  margin: 10px 0 0;
  font-size: 1rem;
  line-height: 1.4;
  color: #0f172a;
  font-weight: 800;
  word-break: break-word;
}

.stock-style-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.badge-suggest,
.stock-info,
.price-info {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 12px;
  font-size: 0.78rem;
  line-height: 1;
  white-space: nowrap;
}

.badge-suggest {
  background: #fff4e5;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-weight: 700;
}

.return-status {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 0.78rem;
  font-weight: 800;
}

.badge-suggest.empty {
  background: #f1f5f9;
  border-color: #e2e8f0;
  color: #64748b;
}

.stock-info {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #334155;
  font-weight: 600;
}

.price-info {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #334155;
  font-weight: 600;
}

.stock-info b,
.price-info b {
  color: #0f172a;
  font-weight: 800;
}

.item-action-group {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  margin-top: 14px;
}

.opname-input,
.qty-input-plain {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid #cbd5e1;
  background: #fff;
  box-sizing: border-box;
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
  appearance: textfield;
}

.opname-input::-webkit-outer-spin-button,
.opname-input::-webkit-inner-spin-button,
.qty-input-plain::-webkit-outer-spin-button,
.qty-input-plain::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.stock-style-detail {
  height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.form-stack {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.form-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 12px;
}

.summary-detail-card {
  background: linear-gradient(135deg, #fff 0%, #fff7f7 100%);
  border: 1px solid #fee2e2;
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 12px;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.86rem;
  color: #475569;
}

.summary-row + .summary-row {
  margin-top: 8px;
}

.summary-row.grand {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #fecaca;
}

.summary-row.grand strong {
  color: #b91c1c;
  font-size: 1rem;
}

.glassy {
  background: linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(255,245,245,0.96) 100%);
  border: 1px solid #fee2e2;
}

.summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  padding: 14px;
  border-radius: 18px;
  gap: 12px;
}

.summary-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  display: block;
  font-size: 0.76rem;
  color: #64748b;
  margin-bottom: 4px;
  font-weight: 700;
}

.value {
  font-size: 1.12rem;
  font-weight: 900;
}

.red-text {
  color: #b91c1c;
}

.summary-pill {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #991b1b;
  border: 1px solid #fecaca;
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 0.74rem;
  font-weight: 800;
  white-space: nowrap;
}

.mini-cart-btn {
  border: none;
  background: #b91c1c;
  color: white;
  border-radius: 999px;
  padding: 8px 11px;
  font-size: 0.72rem;
  font-weight: 800;
}

.pending-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
  border: 1px solid #fed7aa;
  border-radius: 16px;
  padding: 12px;
  margin-bottom: 12px;
  color: #9a3412;
}

.pending-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pending-text strong {
  font-size: 0.78rem;
}

.pending-text span {
  font-size: 0.69rem;
  opacity: 0.85;
}

.btn-pending-sync {
  border: none;
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  color: white;
  padding: 9px 12px;
  border-radius: 12px;
  font-size: 0.72rem;
  font-weight: 800;
}

.slide-checkout-wrapper {
  width: 100%;
  height: 58px;
  background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
  border-radius: 999px;
  position: relative;
  overflow: hidden;
  border: 1px solid #fca5a5;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.9);
}

.slide-track {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(90deg, #ef4444 0%, #f87171 100%);
  opacity: 0.14;
  border-radius: 999px;
  transition: width 0.12s ease;
}

.slide-hint {
  position: relative;
  z-index: 1;
  font-size: 0.82rem;
  font-weight: 900;
  color: #ef4444;
  text-transform: uppercase;
  letter-spacing: 0.9px;
}

.slide-handle {
  position: absolute;
  left: 4px;
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.2rem;
  box-shadow: 0 10px 18px rgba(239, 68, 68, 0.34);
  z-index: 2;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-x;
}

.is-locked {
  opacity: 0.58;
  filter: grayscale(0.2);
  pointer-events: none;
}

.end-list,
.empty-state {
  text-align: center;
  padding: 22px 16px;
  font-size: 0.8rem;
  color: #94a3b8;
}

.loading-state {
  text-align: center;
  padding: 24px 16px;
  color: #94a3b8;
  font-size: 0.78rem;
}

.state-container {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.empty-illustration {
  font-size: 2rem;
  opacity: 0.85;
}

.loader-mini-red {
  width: 30px;
  height: 30px;
  border: 3.5px solid #f1f5f9;
  border-top-color: #ef4444;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 12px auto 0;
}

.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.46);
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: stretch;
  padding: 10px 10px calc(10px + env(safe-area-inset-bottom, 0px));
  overflow: hidden;
  box-sizing: border-box;
}

.detail-sheet {
  width: 100%;
  max-width: none;
  max-height: calc(100vh - 18px);
  max-height: calc(100dvh - 18px);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: #fff;
  border-radius: 24px 24px 16px 16px;
  padding: 16px;
  box-sizing: border-box;
  box-shadow: 0 -12px 30px rgba(15, 23, 42, 0.16);
  animation: sheetUp 0.2s ease;
}

.detail-sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.detail-sheet-head h3 {
  margin: 0;
  font-size: 1rem;
  color: #0f172a;
  font-weight: 800;
}

.detail-sheet-head p {
  margin: 4px 0 0;
  font-size: 0.82rem;
  color: #64748b;
}

.btn-close-sheet {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 12px;
  background: #f8fafc;
  color: #334155;
  font-weight: 900;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.detail-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 10px 12px;
}

.detail-box span {
  display: block;
  font-size: 0.68rem;
  color: #94a3b8;
  margin-bottom: 4px;
  font-weight: 800;
  text-transform: uppercase;
}

.detail-box strong {
  font-size: 0.84rem;
  color: #0f172a;
}

.detail-form {
  display: grid;
  gap: 12px;
}

.retur-uom-section {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 12px;
  background: #f8fafc;
}

.retur-uom-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.retur-uom-head span {
  font-size: 0.78rem;
  font-weight: 900;
  color: #16a34a;
}

.retur-uom-head.bad span {
  color: #dc2626;
}

.retur-uom-head small {
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 700;
}

.retur-uom-grid {
  display: grid;
  gap: 10px;
}

.retur-uom-field {
  display: grid;
  gap: 6px;
}

.retur-uom-field > span {
  color: #64748b;
  font-size: 0.68rem;
  font-weight: 900;
  text-transform: uppercase;
}

.retur-uom-field.disabled {
  opacity: 0.55;
}

.qty-btn:disabled,
.qty-input:disabled,
.opname-input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  background: #e2e8f0;
  color: #94a3b8;
}

.detail-qty-box {
  grid-template-columns: 40px 1fr 40px;
}

.detail-subtotal {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff7f7;
  border: 1px solid #fee2e2;
  border-radius: 14px;
  padding: 12px;
}

.detail-subtotal span {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 700;
}

.detail-subtotal strong {
  color: #b91c1c;
  font-size: 0.92rem;
}

.detail-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  position: sticky;
  bottom: -16px;
  margin: 16px -16px -16px;
  padding: 12px 16px 16px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  border-radius: 0 0 16px 16px;
  box-shadow: 0 -10px 20px rgba(15, 23, 42, 0.06);
}

.btn-delete-item,
.btn-save-item {
  height: 48px;
  border: none;
  border-radius: 14px;
  font-weight: 800;
  font-size: 0.85rem;
}

.btn-delete-item {
  background: #fff1f2;
  color: #dc2626;
  border: 1px solid #fecdd3;
}

.btn-save-item {
  background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
  color: white;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes sheetUp {
  from {
    transform: translateY(18px);
    opacity: 0.4;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

:global(:root[data-theme='dark']) .page-wrapper,
:global(:root[data-theme='dark']) .retur-container,
:global(:root[data-theme='dark']) .so-container,
:global(:root[data-theme='dark']) .scroll-area {
  background: #050914 !important;
}

:global(:root[data-theme='dark']) .header.red-header {
  background: linear-gradient(135deg, #0f172a 0%, #172554 54%, #991b1b 100%) !important;
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.34) !important;
}

:global(:root[data-theme='dark']) .fixed-nav-wrapper,
:global(:root[data-theme='dark']) .customer-card,
:global(:root[data-theme='dark']) .stock-card,
:global(:root[data-theme='dark']) .detail-sheet,
:global(:root[data-theme='dark']) .detail-actions,
:global(:root[data-theme='dark']) .detail-box {
  background: linear-gradient(180deg, #0b1220 0%, #070b14 100%) !important;
  border-color: rgba(51, 65, 85, 0.95) !important;
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.42) !important;
}

:global(:root[data-theme='dark']) .tab-btn,
:global(:root[data-theme='dark']) .search-input,
:global(:root[data-theme='dark']) .qty-input,
:global(:root[data-theme='dark']) .qty-input-plain,
:global(:root[data-theme='dark']) .unit-select,
:global(:root[data-theme='dark']) .btn-close-sheet {
  background: #070d1a !important;
  border-color: rgba(71, 85, 105, 0.92) !important;
  color: #f8fafc !important;
}

:global(:root[data-theme='dark']) .tab-btn.active {
  background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #b91c1c 100%) !important;
  border-color: rgba(96, 165, 250, 0.55) !important;
  color: #ffffff !important;
}

:global(:root[data-theme='dark']) .summary-pill,
:global(:root[data-theme='dark']) .item-meta,
:global(:root[data-theme='dark']) .summary-detail-card,
:global(:root[data-theme='dark']) .form-card {
  background: #0b1220 !important;
  border-color: rgba(51, 65, 85, 0.95) !important;
}

:global(:root[data-theme='dark']) .stock-card.is-unavailable {
  opacity: 1 !important;
  background: linear-gradient(180deg, #0b1220 0%, #090f1b 100%) !important;
}

:global(:root[data-theme='dark']) .stock-card.is-unavailable .item-name-full {
  color: #cbd5e1 !important;
}

:global(:root[data-theme='dark']) .stock-card.is-unavailable .qty-input-plain,
:global(:root[data-theme='dark']) .stock-card.is-unavailable .unit-select {
  background: #0f172a !important;
  border-color: rgba(51, 65, 85, 0.95) !important;
  color: #94a3b8 !important;
}

:global(:root[data-theme='dark']) .pending-bar {
  background: linear-gradient(135deg, rgba(154, 52, 18, 0.18) 0%, rgba(127, 29, 29, 0.18) 100%) !important;
  border-color: rgba(249, 115, 22, 0.28) !important;
  color: #fdba74 !important;
}

:global(:root[data-theme='dark']) .slide-checkout-wrapper {
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%) !important;
  border-color: rgba(239, 68, 68, 0.3) !important;
  box-shadow: inset 0 1px 0 rgba(148, 163, 184, 0.05) !important;
}

:global(:root[data-theme='dark']) .slide-hint {
  color: #fca5a5 !important;
}

:global(:root[data-theme='dark']) .detail-sheet-head h3,
:global(:root[data-theme='dark']) .detail-box strong,
:global(:root[data-theme='dark']) .item-name-full,
:global(:root[data-theme='dark']) .summary-pill strong {
  color: #f1f5f9 !important;
}

:global(:root[data-theme='dark']) .brand-tag {
  color: #f87171 !important;
}

:global(:root[data-theme='dark']) .detail-sheet-head p,
:global(:root[data-theme='dark']) .detail-box span,
:global(:root[data-theme='dark']) .item-code,
:global(:root[data-theme='dark']) .stock-info,
:global(:root[data-theme='dark']) .price-info,
:global(:root[data-theme='dark']) .summary-pill small,
:global(:root[data-theme='dark']) .loading-state,
:global(:root[data-theme='dark']) .empty-state,
:global(:root[data-theme='dark']) .end-list {
  color: #9fb0c7 !important;
}

:global(:root[data-theme='dark']) .stock-info,
:global(:root[data-theme='dark']) .price-info,
:global(:root[data-theme='dark']) .badge-suggest {
  background: #111827 !important;
  border-color: rgba(51, 65, 85, 0.95) !important;
}

:global(:root[data-theme='dark']) .stock-info b,
:global(:root[data-theme='dark']) .price-info b {
  color: #e2e8f0 !important;
}

:global(:root[data-theme='dark']) .badge-suggest {
  color: #bfdbfe !important;
}

:global(:root[data-theme='dark']) .badge-suggest.empty {
  color: #cbd5e1 !important;
}

:global(:root[data-theme='dark']) .detail-subtotal {
  background: linear-gradient(135deg, rgba(127, 29, 29, 0.18), rgba(69, 10, 10, 0.24)) !important;
  border-color: rgba(248, 113, 113, 0.22) !important;
}

:global(:root[data-theme='dark']) .detail-subtotal span {
  color: #9fb0c7 !important;
}

:global(:root[data-theme='dark']) .detail-subtotal strong {
  color: #fca5a5 !important;
}

:global(:root[data-theme='dark']) .return-status {
  background: rgba(248, 113, 113, 0.14) !important;
  border-color: rgba(248, 113, 113, 0.32) !important;
  color: #fecaca !important;
}

:global(:root[data-theme='dark']) .btn-delete-item {
  background: rgba(127, 29, 29, 0.2) !important;
  color: #fca5a5 !important;
  border-color: rgba(239, 68, 68, 0.28) !important;
}

:global(:root[data-theme='dark']) .loader-mini-red {
  border-color: #1e293b !important;
  border-top-color: #ef4444 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page {
  background:
    radial-gradient(circle at top left, rgba(239, 68, 68, 0.10), transparent 28%),
    radial-gradient(circle at bottom right, rgba(37, 99, 235, 0.08), transparent 32%),
    linear-gradient(180deg, #000814 0%, #020617 48%, #000814 100%) !important;
  color: #f8fafc !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .so-container {
  background: #020617 !important;
  border-left: 0 !important;
  border-right: 0 !important;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.48) !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .nav-section,
:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .fixed-nav-wrapper,
:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .footer-action {
  background: rgba(3, 7, 18, 0.96) !important;
  background-image: none !important;
  border-color: #1f2937 !important;
  color: #f8fafc !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .scroll-area {
  background: #000814 !important;
  background-image: none !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page :is(
  .summary-pill,
  .stock-card,
  .item-meta,
  .stock-info,
  .price-info,
  .form-card,
  .summary-detail-card,
  .summary-bar,
  .cart-brief,
  .detail-sheet,
  .detail-actions,
  .detail-box,
  .retur-uom-section,
  .detail-subtotal,
  .state-container
) {
  background: #030712 !important;
  background-image: none !important;
  border-color: #1f2937 !important;
  color: #f8fafc !important;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.38) !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .stock-card.card-active-red {
  background: linear-gradient(135deg, rgba(127, 29, 29, 0.24), rgba(3, 7, 18, 0.98)) !important;
  border-color: rgba(248, 113, 113, 0.40) !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .stock-card.is-unavailable {
  background: #050914 !important;
  border-color: #1f2937 !important;
  opacity: 0.82 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page :is(
  .tab-btn,
  .search-input,
  .date-input,
  .note-input,
  .opname-input,
  .qty-input,
  .qty-input-plain,
  .unit-select,
  .btn-close-sheet,
  .btn-detail-mini,
  .qty-btn
) {
  background: #020617 !important;
  background-image: none !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
  -webkit-text-fill-color: #f8fafc !important;
  box-shadow: none !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page :is(
  .opname-input,
  .qty-input,
  .qty-input-plain,
  .date-input,
  .note-input
)::placeholder {
  color: #64748b !important;
  -webkit-text-fill-color: #64748b !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page :is(
  .opname-input,
  .qty-input,
  .qty-input-plain,
  .unit-select,
  .qty-btn
):disabled,
:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .retur-uom-field.disabled .qty-box {
  background: #111827 !important;
  border-color: #1f2937 !important;
  color: #64748b !important;
  -webkit-text-fill-color: #64748b !important;
  opacity: 0.72 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .tab-btn.active {
  background: linear-gradient(135deg, #991b1b 0%, #dc2626 100%) !important;
  border-color: rgba(248, 113, 113, 0.58) !important;
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page :is(
  .header-title h3,
  .item-name,
  .item-name-full,
  .detail-sheet-head h3,
  .detail-box strong,
  .summary-row strong,
  .summary-pill strong,
  .stock-info b,
  .price-info b,
  .cart-brief b,
  .customer-text strong
) {
  color: #f8fafc !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page :is(
  .header-title p,
  .item-code,
  .detail-sheet-head p,
  .detail-box span,
  .summary-row span,
  .summary-pill small,
  .field-label,
  .input-label,
  .retur-uom-field > span,
  .retur-uom-head small,
  .cart-brief span,
  .loading-state,
  .empty-state,
  .end-list,
  .customer-text span
) {
  color: #9fb0c7 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page :is(.red-text, .brand-tag, .summary-row.grand strong) {
  color: #fca5a5 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .retur-uom-head span {
  color: #86efac !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .retur-uom-head.bad span {
  color: #fca5a5 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page :is(.badge-suggest, .return-status) {
  background: rgba(239, 68, 68, 0.16) !important;
  border-color: rgba(248, 113, 113, 0.34) !important;
  color: #fecaca !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .badge-suggest.empty {
  background: #111827 !important;
  border-color: #334155 !important;
  color: #cbd5e1 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .summary-row + .summary-row,
:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .summary-row.grand {
  border-color: #334155 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .slide-checkout-wrapper {
  background: #111827 !important;
  background-image: none !important;
  border-color: rgba(248, 113, 113, 0.34) !important;
  box-shadow: inset 0 1px 0 rgba(248, 250, 252, 0.04) !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .slide-fill {
  background: linear-gradient(90deg, #991b1b 0%, #ef4444 100%) !important;
  opacity: 0.22 !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .slide-hint {
  color: #fecaca !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .detail-overlay {
  background: rgba(0, 8, 20, 0.78) !important;
}

:global(html[data-theme='dark'] body[data-theme='dark']) .retur-page .detail-actions {
  background: #030712 !important;
  background-image: none !important;
  border-top-color: #1f2937 !important;
  box-shadow: 0 -12px 22px rgba(0, 0, 0, 0.32) !important;
}

.retur-page.theme-dark .stock-style-meta,
.retur-page.theme-dark .item-meta {
  background: #111827 !important;
  background-image: none !important;
  border-color: #1f2937 !important;
}

.retur-page.theme-dark .badge-suggest,
.retur-page.theme-dark .stock-info,
.retur-page.theme-dark .price-info,
.retur-page.theme-dark .return-status {
  background: #111827 !important;
  background-image: none !important;
  border: 1px solid #334155 !important;
  color: #e2e8f0 !important;
  box-shadow: none !important;
  -webkit-text-fill-color: #e2e8f0 !important;
}

.retur-page.theme-dark .badge-suggest {
  background: rgba(251, 146, 60, 0.16) !important;
  border-color: rgba(251, 191, 36, 0.28) !important;
  color: #fed7aa !important;
  -webkit-text-fill-color: #fed7aa !important;
}

.retur-page.theme-dark .badge-suggest.empty {
  background: #111827 !important;
  border-color: #334155 !important;
  color: #cbd5e1 !important;
  -webkit-text-fill-color: #cbd5e1 !important;
}

.retur-page.theme-dark .return-status {
  background: rgba(248, 113, 113, 0.16) !important;
  border-color: rgba(248, 113, 113, 0.34) !important;
  color: #fecaca !important;
  -webkit-text-fill-color: #fecaca !important;
}

.retur-page.theme-dark .stock-info b,
.retur-page.theme-dark .price-info b {
  color: #f8fafc !important;
  -webkit-text-fill-color: #f8fafc !important;
}

.retur-page.theme-dark .qty-input-plain,
.retur-page.theme-dark .opname-input,
.retur-page.theme-dark .btn-detail-mini {
  background: #020617 !important;
  background-image: none !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
  -webkit-text-fill-color: #f8fafc !important;
}

.retur-page.theme-dark .qty-input-plain:disabled,
.retur-page.theme-dark .opname-input:disabled,
.retur-page.theme-dark .btn-detail-mini:disabled {
  background: #111827 !important;
  border-color: #1f2937 !important;
  color: #64748b !important;
  -webkit-text-fill-color: #64748b !important;
}

.retur-page.theme-dark .detail-subtotal,
.retur-page.theme-dark .detail-sheet .detail-subtotal {
  background: rgba(127, 29, 29, 0.18) !important;
  background-image: none !important;
  border: 1px solid rgba(248, 113, 113, 0.28) !important;
  color: #f8fafc !important;
  box-shadow: none !important;
}

.retur-page.theme-dark .detail-subtotal span,
.retur-page.theme-dark .detail-sheet .detail-subtotal span {
  color: #fecaca !important;
  -webkit-text-fill-color: #fecaca !important;
}

.retur-page.theme-dark .detail-subtotal strong,
.retur-page.theme-dark .detail-sheet .detail-subtotal strong {
  color: #f8fafc !important;
  -webkit-text-fill-color: #f8fafc !important;
}

.retur-page.theme-dark .detail-actions,
.retur-page.theme-dark .detail-sheet .detail-actions {
  background: #030712 !important;
  background-image: none !important;
  border-top-color: #1f2937 !important;
  box-shadow: 0 -12px 22px rgba(0, 0, 0, 0.32) !important;
}

.retur-page.theme-dark .cart-brief {
  background: #030712 !important;
  background-image: none !important;
  border: 1px solid #1f2937 !important;
  color: #cbd5e1 !important;
  box-shadow: none !important;
}

.retur-page.theme-dark .cart-brief span {
  color: #cbd5e1 !important;
  -webkit-text-fill-color: #cbd5e1 !important;
}

.retur-page.theme-dark .cart-brief b {
  color: #f8fafc !important;
  -webkit-text-fill-color: #f8fafc !important;
}

:global(.retur-success-message) {
  text-align: center;
}

:global(.retur-success-caption) {
  margin-bottom: 8px;
  color: #64748b;
  font-size: 13px;
}

:global(.retur-success-code) {
  display: inline-block;
  padding: 10px 14px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #0f172a;
  font-weight: 800;
}

:global(html[data-theme='dark']) :global(.retur-success-popup),
:global(body[data-theme='dark']) :global(.retur-success-popup) {
  background: #020617 !important;
  border: 1px solid #1f2937 !important;
  color: #f8fafc !important;
}

:global(html[data-theme='dark']) :global(.retur-success-caption),
:global(body[data-theme='dark']) :global(.retur-success-caption) {
  color: #cbd5e1 !important;
  -webkit-text-fill-color: #cbd5e1 !important;
}

:global(html[data-theme='dark']) :global(.retur-success-code),
:global(body[data-theme='dark']) :global(.retur-success-code) {
  background: #111827 !important;
  background-image: none !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
  -webkit-text-fill-color: #f8fafc !important;
  box-shadow: none !important;
}
</style>

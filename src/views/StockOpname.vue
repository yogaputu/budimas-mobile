<template>
  <div class="page-wrapper">
    <div class="stock-opname-container">
      <header class="header">
        <button @click="$router.back()" class="btn-back" aria-label="Kembali" title="Kembali"><font-awesome-icon icon="chevron-left" /></button>
        <div class="header-title">
          <h3>Stok Opname</h3>
          <p>{{ activeTabLabel }} - {{ customerData.Nama }}</p>
        </div>
        <div class="header-cart" aria-label="Lihat keranjang" title="Keranjang" @click="showCartPreview">
          <font-awesome-icon class="cart-icon" icon="shopping-cart" />
          <span v-if="totalInput > 0" class="cart-badge">{{ totalInput }}</span>
        </div>
      </header>

      <div v-if="isOffline" class="offline-banner">
        MODE OFFLINE AKTIF - Draft disimpan lokal
      </div>

      <div class="fixed-nav-wrapper">
        <div class="tabs-wrapper">
          <button @click="switchTab('history')" :class="['tab-item', { active: activeTab === 'history' }]">
            <span class="tab-label"><font-awesome-icon icon="history" /> Riwayat</span>
          </button>
          <button @click="switchTab('all')" :class="['tab-item', { active: activeTab === 'all' }]">
            <span class="tab-label"><font-awesome-icon icon="boxes" /> Semua</span>
          </button>
          <button
            v-for="brand in brandList"
            :key="brand.Kode"
            @click="switchTab(brand.Kode)"
            :class="['tab-item', { active: activeTab === brand.Kode }]"
          >
            <span class="tab-label">{{ brand.Nama }}</span>
          </button>
        </div>

        <div class="search-wrapper">
          <span class="search-icon"><font-awesome-icon icon="search" /></span>
          <input v-model="searchQuery" type="text" placeholder="Cari barang..." class="search-input" />
        </div>

        <div class="summary-strip">
          <div class="summary-pill">
            <small>Total SKU</small>
            <strong>{{ filteredItems.length }}</strong>
          </div>
          <div class="summary-pill">
            <small>Sudah Diinput</small>
            <strong>{{ totalInput }}</strong>
          </div>
          <div class="summary-pill">
            <small>Total Qty</small>
            <strong>{{ formatNumber(totalQtyInput) }}</strong>
          </div>
        </div>
      </div>

      <main class="scroll-area">
        <div v-if="loading" class="state-container">
          <div class="loader-enterprise"></div>
          <p>{{ isOffline ? 'Memuat cache lokal...' : 'Memuat daftar produk...' }}</p>
        </div>

        <div v-else-if="filteredItems.length === 0" class="state-container">
          <p>
            {{
              activeTab === 'history'
                ? 'Toko ini belum memiliki riwayat order. Stok opname tidak wajib untuk kunjungan ini.'
                : 'Tidak ada produk untuk kategori ini.'
            }}
          </p>
          <button v-if="activeTab === 'history'" class="btn-reload" @click="skipOpnameNoHistory">Lanjut Proses</button>
          <button v-if="errorConnection && !isOffline" class="btn-reload" @click="fetchData" aria-label="Muat ulang" title="Muat ulang"><font-awesome-icon icon="sync-alt" /></button>
        </div>

        <div v-else class="stock-list">
          <div
            v-for="item in filteredItems"
            :key="item.Kode"
            :class="['stock-card', { 'is-filled': getOpnameEntry(item.Kode).qty > 0 }]"
          >
            <div class="item-info">
              <span class="brand-tag">{{ item.displayBrand || 'PT BUDIMAS' }}</span>
              <span class="item-code">{{ item.Kode }}</span>
              <h4 class="item-name-full">{{ item.Nama }}</h4>

              <div class="item-meta">
                <span v-if="Number(item.Suggestion) > 0" class="badge-suggest">
                  Saran 30 hari: {{ item.Suggestion }} {{ item.Satuan }}
                </span>
                <span class="stock-info">Stok: <b>{{ item.StokAkhir }}</b></span>
                <span
                  v-if="getQtyDiff(item) !== null"
                  :class="['diff-info', getQtyDiff(item) === 0 ? 'diff-equal' : getQtyDiff(item) > 0 ? 'diff-up' : 'diff-down']"
                >
                  Selisih: <b>{{ formatSignedNumber(getQtyDiff(item)) }}</b>
                </span>
                <span class="price-info">Rp {{ formatNumber(item.HargaE || 0) }}</span>
              </div>
            </div>

            <div class="item-action-group">
              <input
                type="number"
                :value="getOpnameEntry(item.Kode).qty ?? ''"
                @input="updateQty(item, $event.target.value)"
                class="opname-input"
                placeholder="0"
                min="0"
              />
              <select
                :value="getOpnameEntry(item.Kode).unit"
                @change="updateUnit(item, $event.target.value)"
                class="unit-select"
              >
                <option :value="item.Satuan">{{ item.Satuan }}</option>
                <option v-if="item.NamaUnit" :value="item.NamaUnit">{{ item.NamaUnit }}</option>
              </select>
            </div>
          </div>
        </div>
      </main>

      <footer class="footer-action">
        <div v-if="totalInput > 0" class="cart-brief">
          <span>Total Input: <b>{{ totalInput }} Item</b></span>
        </div>
        <div v-if="activeTab === 'history' && historyRequiredMissing.length > 0" class="cart-brief warning">
          <span>Belum lengkap: <b>{{ historyRequiredMissing.length }} produk riwayat</b></span>
        </div>

        <div
          ref="slideContainer"
          class="slide-checkout-container"
          :class="{ 'is-disabled': !canSubmitOpname || isSubmitting }"
        >
          <div class="slide-track">
            <span class="slide-text">
              {{
                isSubmitting
                  ? 'Memproses...'
                  : isOffline
                    ? 'Geser untuk Simpan Draft Offline'
                    : 'Geser untuk Simpan'
              }}
            </span>

            <div
              ref="slideHandle"
              class="slide-handle"
              @touchstart="startSlide"
              @touchmove="moveSlide"
              @touchend="endSlide"
              :style="{ transform: `translateX(${currentX}px)` }"
            >
              <span v-if="!isSubmitting">➔</span>
              <div v-else class="loader-mini"></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, defineProps } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api/axios';
import Swal from 'sweetalert2';
import { useConnectivityStore } from '@/stores/connectivity';
import { getDb } from '@/services/database';
import { SyncService } from '@/services/SyncService';

const route = useRoute();
const router = useRouter();
const connectivity = useConnectivityStore();

const props = defineProps({
  customer: { type: Object, default: () => ({}) }
});

const activeTab = ref('history');
const activeEndpoint = ref('/api/stok/history-order');
const loading = ref(false);
const errorConnection = ref(false);
const isSubmitting = ref(false);
const isAutoUploadingPending = ref(false);
const rawData = ref([]);
const brandList = ref([]);
const searchQuery = ref('');
const opnameData = ref({});

const currentX = ref(0);
const startX = ref(0);
const slideContainer = ref(null);
const slideHandle = ref(null);
const fallbackMaxSlide = 240;

const isOffline = computed(() => !connectivity.isOnline);

const customerData = computed(() => ({
  Kode: String(
    props.customer?.Kode ||
    props.customer?.kode ||
    route.query.kode_customer ||
    route.query.kode ||
    route.query.id_plafon ||
    route.query.KodeCustomer ||
    ''
  ).trim(),
  Nama:
    props.customer?.Nama ||
    props.customer?.nama ||
    route.query.nama_toko ||
    route.query.nama ||
    route.query.nama_customer ||
    'Pelanggan'
}));

const visitId = computed(() =>
  route.query.id_kunjungan ||
  route.query.IDKunjungan ||
  route.query.id ||
  ''
);

// Pada beberapa jalur kunjungan, kode customer tidak ikut diteruskan namun
// ID plafon ada di props/query. Kirim keduanya agar API selalu dapat
// mengikat riwayat ke toko yang tepat, bukan jatuh ke fallback kosong.
const plafonId = computed(() => String(
  props.customer?.IDPlafon ||
  props.customer?.id_plafon ||
  props.customer?.IdPlafon ||
  route.query.id_plafon ||
  route.query.IDPlafon ||
  ''
).trim());

// Riwayat stok opname dibatasi oleh konteks plafon/principal kunjungan.
// Jangan berbagi draft/cache hanya berdasarkan customer karena satu toko dapat
// memiliki lebih dari satu plafon/principal; cache lama dapat memuat produk
// dari principal lain dan kemudian ditolak saat disimpan.
const opnameScopeKey = computed(() => [
  customerData.value.Kode || 'no_customer',
  plafonId.value || 'no_plafon',
  visitId.value || 'no_visit'
].join(':'));
const draftSessionKey = computed(() => `stokopname:draft:${opnameScopeKey.value}`);
const cachePrefix = computed(() => `stokopname:cache:${opnameScopeKey.value}`);
const brandCacheKey = computed(() => `${cachePrefix.value}:brands`);
const itemCacheKey = computed(() => `${cachePrefix.value}:items:${activeTab.value}`);
const doneCacheKey = computed(() => `stokopname:done:${visitId.value || 'no_visit'}:${customerData.value.Kode}`);

const activeTabLabel = computed(() => {
  if (activeTab.value === 'history') return 'Berdasarkan Riwayat';
  if (activeTab.value === 'all') return 'Semua Produk PT';
  const brand = brandList.value.find((b) => b.Kode === activeTab.value);
  return brand ? brand.Nama : 'Daftar Produk';
});

const isQtyFilled = (value) => value !== null && value !== '' && value !== undefined && !Number.isNaN(Number(value));

const totalInput = computed(() =>
  Object.values(opnameData.value).filter((item) => isQtyFilled(item.qty)).length
);

const totalQtyInput = computed(() =>
  Object.values(opnameData.value).reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
);

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.payload)) return data.payload;
  if (Array.isArray(data?.result)) return data.result;
  return [];
};

const normalizeStokItem = (item = {}) => {
  const kode = String(
    item.Kode ||
    item.kode ||
    item.kode_barang ||
    item.KodeStok ||
    item.id_produk ||
    item.id ||
    ''
  ).trim();

  const nama = String(
    item.Nama ||
    item.nama ||
    item.nama_barang ||
    item.nama_produk ||
    item.description ||
    'Produk Tanpa Nama'
  ).trim();

  const satuan = String(
    item.Satuan ||
    item.satuan ||
    item.nama_unit ||
    item.NamaUnit ||
    item.label_uom_1 ||
    ''
  ).trim();

  const brand = String(
    item.NamaBrand ||
    item.Brand ||
    item.brand ||
    item.nama_brand ||
    item.Principle ||
    item.principle ||
    ''
  ).trim();

  return {
    ...item,
    Kode: kode,
    Nama: nama,
    Satuan: satuan,
    NamaUnit: item.NamaUnit || item.nama_unit || satuan,
    NamaBrand: brand,
    Brand: brand,
    StokAkhir: Number(item.StokAkhir || item.stok_akhir || item.stok || item.stock || 0),
    HargaE: Number(item.HargaE || item.harga || item.harga_produk || 0),
    Suggestion: Number(item.Suggestion || item.suggestion || 0),
    displayBrand: brand
  };
};

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

const getDraftDb = async (draftKey) => {
  const db = getDb();
  if (!db) return null;

  try {
    const res = await db.query(
      `SELECT payload_json FROM app_drafts WHERE draft_key = ? LIMIT 1`,
      [draftKey]
    );
    const raw = res.values?.[0]?.payload_json;
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('❌ getDraftDb error:', err);
    return null;
  }
};

const saveDraftDb = async (draftKey, payload) => {
  const db = getDb();
  if (!db) return false;

  try {
    await db.run(
      `
      INSERT OR REPLACE INTO app_drafts (draft_key, payload_json, updated_at)
      VALUES (?, ?, ?)
      `,
      [draftKey, JSON.stringify(payload ?? null), new Date().toISOString()]
    );
    return true;
  } catch (err) {
    console.error('❌ saveDraftDb error:', err);
    return false;
  }
};

// =========================
// SQLITE STOK MASTER
// =========================
const getAllStokMaster = async () => {
  const db = getDb();
  if (!db) return [];

  try {
    const res = await db.query(`
      SELECT kode, nama, satuan, nama_unit, nama_brand, harga, suggestion
      FROM stok_master
      ORDER BY nama ASC
    `);

    return (res.values || []).map(normalizeStokItem);
  } catch (err) {
    console.error('❌ getAllStokMaster error:', err);
    return [];
  }
};

const getStokMasterByBrand = async (brandName) => {
  const db = getDb();
  if (!db) return [];

  try {
    const res = await db.query(
      `
      SELECT kode, nama, satuan, nama_unit, nama_brand, harga, suggestion
      FROM stok_master
      WHERE nama_brand = ?
      ORDER BY nama ASC
      `,
      [brandName]
    );

    return (res.values || []).map(normalizeStokItem);
  } catch (err) {
    console.error('❌ getStokMasterByBrand error:', err);
    return [];
  }
};

const getBrandListFromStokMaster = async () => {
  const db = getDb();
  if (!db) return [];

  try {
    const res = await db.query(`
      SELECT DISTINCT nama_brand
      FROM stok_master
      WHERE COALESCE(nama_brand, '') <> ''
      ORDER BY nama_brand ASC
    `);

    return (res.values || []).map((row) => ({
      Kode: String(row.nama_brand || '').trim(),
      Nama: String(row.nama_brand || '').trim()
    }));
  } catch (err) {
    console.error('❌ getBrandListFromStokMaster error:', err);
    return [];
  }
};

// =========================
// DRAFT
// =========================
const persistDraft = async () => {
  await saveDraftDb(draftSessionKey.value, opnameData.value);
};

const restoreDraft = async () => {
  opnameData.value = (await getDraftDb(draftSessionKey.value)) || {};
};

const hydrateItemToDraft = (item) => {
  const cleanKode = String(item.Kode || '').trim();
  if (!cleanKode) return;

  if (!opnameData.value[cleanKode]) {
    opnameData.value[cleanKode] = {
      kode: cleanKode,
      // SKU dapat sama di principal/perusahaan lain. ID master harus ikut
      // tersimpan agar validasi memakai produk yang sama dengan saran API.
      id_produk: item.id_produk || item.IDProduk || item.idProduk || null,
      nama: String(item.Nama || '').trim(),
      qty: null,
      unit: String(item.Satuan || '').trim(),
      harga: Number(item.HargaE || 0),
      stokSystem: Number(item.StokAkhir || 0),
      pt: item.displayBrand || item.NamaBrand || ''
    };
  } else {
    opnameData.value[cleanKode] = {
      ...opnameData.value[cleanKode],
      kode: cleanKode,
      id_produk:
        opnameData.value[cleanKode].id_produk ||
        item.id_produk ||
        item.IDProduk ||
        item.idProduk ||
        null,
      nama: opnameData.value[cleanKode].nama || String(item.Nama || '').trim(),
      unit: opnameData.value[cleanKode].unit || String(item.Satuan || '').trim(),
      harga: opnameData.value[cleanKode].harga || Number(item.HargaE || 0),
      stokSystem: opnameData.value[cleanKode].stokSystem ?? Number(item.StokAkhir || 0),
      pt: opnameData.value[cleanKode].pt || item.displayBrand || item.NamaBrand || ''
    };
  }
};

const saveDoneMarker = async (payload) => {
  const body = {
    ...payload,
    updated_at: new Date().toISOString()
  };

  await saveCacheDb(doneCacheKey.value, body);
  try {
    localStorage.setItem(doneCacheKey.value, JSON.stringify(body));
  } catch (err) {
    console.warn('Gagal simpan marker stok opname lokal:', err);
  }
  if (visitId.value) {
    const noVisitKey = `stokopname:done:no_visit:${customerData.value.Kode}`;
    await saveCacheDb(noVisitKey, body);
    try {
      localStorage.setItem(noVisitKey, JSON.stringify(body));
    } catch (err) {
      console.warn('Gagal simpan marker stok opname no-visit:', err);
    }
  }
  return true;
};

const skipOpnameNoHistory = async () => {
  await saveDoneMarker({
    is_done: true,
    is_required: false,
    source: 'no_history',
    id_kunjungan: visitId.value || '',
    kode_customer: customerData.value.Kode,
    total_item: 0
  });

  await Swal.fire({
    icon: 'info',
    title: 'Stok Opname Dilewati',
    text: 'Toko belum memiliki riwayat order, proses lain sudah bisa dilanjutkan.',
    timer: 1500,
    showConfirmButton: false
  });

  router.push({
    path: '/kunjungan-aktif',
    query: {
      ...route.query,
      stok_opname_done: '1',
      stock_opname_done: '1',
      skip_stok_opname: '1'
    }
  });
};

// =========================
// FORMAT / FILTER
// =========================
const formatNumber = (val) => {
  return new Intl.NumberFormat('id-ID').format(Math.floor(Number(val) || 0));
};

const formatSignedNumber = (val) => {
  const num = Math.floor(Number(val) || 0);
  if (num > 0) return `+${formatNumber(num)}`;
  return formatNumber(num);
};

const getOpnameEntry = (kode) => {
  const cleanKode = String(kode || '').trim();

  return opnameData.value[cleanKode] || {
    kode: cleanKode,
    id_produk: null,
    qty: null,
    unit: '',
    harga: 0,
    stokSystem: 0,
    pt: ''
  };
};

const getQtyDiff = (item) => {
  const entry = getOpnameEntry(item.Kode);
  if (entry.qty === null || entry.qty === '' || entry.qty === undefined) return null;
  return Number(entry.qty || 0) - Number(item.StokAkhir || 0);
};

const filteredItems = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();

  return rawData.value.filter((i) => {
    const nama = String(i.Nama || '').toLowerCase();
    const kode = String(i.Kode || '').toLowerCase();
    const brand = String(i.NamaBrand || i.Brand || '').toLowerCase();

    return !q || nama.includes(q) || kode.includes(q) || brand.includes(q);
  });
});

const historyRequiredMissing = computed(() => {
  if (activeTab.value !== 'history') return [];
  return rawData.value.filter((item) => !isQtyFilled(getOpnameEntry(item.Kode).qty));
});

const hasHistoryItems = computed(() => activeTab.value === 'history' && rawData.value.length > 0);

const canSubmitOpname = computed(() => {
  if (isSubmitting.value) return false;
  if (activeTab.value === 'history') {
    return hasHistoryItems.value
      ? historyRequiredMissing.value.length === 0
      : totalInput.value > 0;
  }
  return totalInput.value > 0;
});

const getMaxSlide = () => {
  const container = slideContainer.value;
  const handle = slideHandle.value;
  if (!container || !handle) return fallbackMaxSlide;

  const containerWidth = container.clientWidth || 0;
  const handleWidth = handle.offsetWidth || 50;
  const leftOffset = handle.offsetLeft || 5;
  const rightPadding = 5;
  return Math.max(0, containerWidth - handleWidth - leftOffset - rightPadding);
};

// =========================
// SLIDE
// =========================
const resetSlide = () => {
  currentX.value = 0;
};

const startSlide = (e) => {
  if (!canSubmitOpname.value || isSubmitting.value) return;
  startX.value = e.touches[0].clientX;
};

const moveSlide = (e) => {
  if (!canSubmitOpname.value || isSubmitting.value) return;

  const touch = e.touches[0];
  const container = slideContainer.value;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  let x = touch.clientX - rect.left - 25;
  const maxSlide = getMaxSlide();

  if (x < 0) x = 0;
  if (x > maxSlide) x = maxSlide;

  currentX.value = x;
};

const endSlide = () => {
  if (!canSubmitOpname.value || isSubmitting.value) {
    resetSlide();
    return;
  }

  const maxSlide = getMaxSlide();
  if (currentX.value >= maxSlide * 0.9) {
    currentX.value = maxSlide;
    saveOpname();
  } else {
    resetSlide();
  }
};

// =========================
// FETCH
// =========================
const normalizeFetchedItems = (dataRaw) => {
  const rows = unwrapList(dataRaw).map(normalizeStokItem);

  rawData.value = rows
    .filter((item) => item.Kode && item.Nama)
    .map((item) => {
      const cleanKode = String(item.Kode || '').trim();

      const normalized = {
        ...item,
        Kode: cleanKode
      };

      hydrateItemToDraft(normalized);
      return normalized;
    });

  console.log('✅ Stok opname data:', {
    tab: activeTab.value,
    endpoint: activeEndpoint.value,
    total: rawData.value.length,
    sample: rawData.value[0]
  });
};

const fetchBrands = async () => {
  if (isOffline.value) {
    const masterBrands = await getBrandListFromStokMaster();
    brandList.value = masterBrands.length > 0
      ? masterBrands
      : ((await getCacheDb(brandCacheKey.value)) || []);
    return;
  }

  try {
    const res = await api.get('/api/stok/all', {
      params: {
        kode_customer: customerData.value.Kode || null,
        id_plafon: plafonId.value || null,
        id_kunjungan: visitId.value || null
      }
    });
    const data = unwrapList(res.data).map(normalizeStokItem);

    const uniqueBrands = new Map();
    data.forEach((i) => {
      const kode = String(i.Brand || i.NamaBrand || '').trim();
      const nama = String(i.NamaBrand || i.Brand || '').trim();
      if (kode) uniqueBrands.set(kode, nama);
    });

    brandList.value = Array.from(uniqueBrands, ([Kode, Nama]) => ({ Kode, Nama }));
    await saveCacheDb(brandCacheKey.value, brandList.value);
  } catch (e) {
    console.error('❌ Fetch brands error:', e);

    const masterBrands = await getBrandListFromStokMaster();
    brandList.value = masterBrands.length > 0
      ? masterBrands
      : ((await getCacheDb(brandCacheKey.value)) || []);
  }
};

const fetchOfflineItems = async () => {
  if (activeTab.value === 'all') {
    normalizeFetchedItems(await getAllStokMaster());
    return;
  }

  if (activeTab.value !== 'history') {
    const brand = brandList.value.find((b) => b.Kode === activeTab.value);
    if (brand?.Nama) {
      normalizeFetchedItems(await getStokMasterByBrand(brand.Nama));
      return;
    }
  }

  const cachedItems = await getCacheDb(itemCacheKey.value);
  normalizeFetchedItems(cachedItems || []);
};

const fetchData = async () => {
  const currentKode = customerData.value.Kode;
  const idKunjungan = visitId.value;

  loading.value = true;
  errorConnection.value = false;

  try {
    await restoreDraft();

    if (!currentKode) {
      console.warn('⚠️ Kode customer kosong, tetap tampilkan semua stok.');
    }

    if (isOffline.value) {
      await fetchOfflineItems();
      return;
    }

    const response = await api.get(activeEndpoint.value, {
      params: {
        kode_customer: currentKode || null,
        kode: currentKode || null,
        id_plafon: plafonId.value || null,
        id_kunjungan: idKunjungan || null,
        kategori:
          activeTab.value !== 'history' &&
          activeTab.value !== 'all'
            ? activeTab.value
            : null
      }
    });

    let rows = unwrapList(response.data);

    normalizeFetchedItems(rows);

    await saveCacheDb(itemCacheKey.value, rawData.value);
    await persistDraft();
  } catch (e) {
    console.error('❌ Fetch Data Error:', e);
    errorConnection.value = true;

    await fetchOfflineItems();
  } finally {
    loading.value = false;
  }
};

const switchTab = async (tabId) => {
  activeTab.value = tabId;
  resetSlide();

  if (tabId === 'history') activeEndpoint.value = '/api/stok/history-order';
  else if (tabId === 'all') activeEndpoint.value = '/api/stok/all';
  else activeEndpoint.value = '/api/stok/kategori';

  await fetchData();
};

// =========================
// FORM
// =========================
const updateQty = async (item, value) => {
  hydrateItemToDraft(item);

  const cleanKode = String(item.Kode || '').trim();
  const parsed = value === '' ? null : Math.max(0, Number(value));

  opnameData.value[cleanKode].qty = Number.isNaN(parsed) ? null : parsed;
  await persistDraft();
};

const updateUnit = async (item, value) => {
  hydrateItemToDraft(item);

  const cleanKode = String(item.Kode || '').trim();
  opnameData.value[cleanKode].unit = value;
  await persistDraft();
};

// =========================
// PREVIEW / RESET
// =========================
const showCartPreview = () => {
  const items = Object.values(opnameData.value).filter((i) => isQtyFilled(i.qty));

  if (items.length === 0) {
    return Swal.fire({
      title: 'Keranjang Kosong',
      text: 'Anda belum memilih produk.',
      icon: 'info'
    });
  }

  let html = '<div style="text-align:left; max-height:300px; overflow-y:auto; border-top: 1px solid #eee;">';
  items.forEach((i) => {
    html += `
      <div style="padding:10px 0; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">
        <div style="flex:1; padding-right:10px;">
          <b style="font-size:0.85rem;">${i.nama}</b>
        </div>
        <div style="text-align:right; min-width:60px;">
          <b style="color:#3b82f6;">${i.qty} ${i.unit}</b>
        </div>
      </div>
    `;
  });
  html += '</div>';

  Swal.fire({
    title: 'Isi Keranjang',
    html,
    showCancelButton: true,
    confirmButtonText: 'Tutup',
    cancelButtonText: 'Reset Keranjang',
    cancelButtonColor: '#e11d48'
  }).then((result) => {
    if (result.dismiss === Swal.DismissReason.cancel) {
      confirmReset();
    }
  });
};

const confirmReset = async () => {
  const res = await Swal.fire({
    title: 'Hapus Semua?',
    text: 'Seluruh inputan di keranjang akan dibersihkan.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ya, Reset'
  });

  if (res.isConfirmed) {
    const nextDraft = { ...opnameData.value };
    Object.keys(nextDraft).forEach((key) => {
      nextDraft[key] = {
        ...nextDraft[key],
        qty: null
      };
    });

    opnameData.value = nextDraft;
    await persistDraft();
    resetSlide();
  }
};

// =========================
// SAVE
// =========================
const clearDraftAfterSubmit = async () => {
  const nextDraft = { ...opnameData.value };

  Object.keys(nextDraft).forEach((key) => {
    nextDraft[key] = {
      ...nextDraft[key],
      qty: null
    };
  });

  opnameData.value = nextDraft;
  await persistDraft();
};

const saveOpnameToOfflineQueue = async (items) => {
  const db = getDb();
  if (!db) throw new Error('DB belum siap');

  await db.run(
    `
    INSERT OR REPLACE INTO stock_opname_offline
    (opname_id, id_kunjungan, kode_customer, nama_customer,
     total_item, items_json, status_sync, retry_count, last_error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?)
    `,
    [
      crypto.randomUUID(),
      visitId.value || '',
      customerData.value.Kode,
      customerData.value.Nama,
      items.length,
      JSON.stringify(items),
      new Date().toISOString()
    ]
  );

  await saveDoneMarker({
    is_done: true,
    source: 'offline',
    id_kunjungan: visitId.value || '',
    kode_customer: customerData.value.Kode,
    total_item: items.length
  });
};

const hasPendingStockOpname = async () => {
  const db = getDb();
  if (!db) return false;

  try {
    const res = await db.query(
      "SELECT COUNT(*) as total FROM stock_opname_offline WHERE status_sync = 'pending'"
    );
    return Number(res.values?.[0]?.total || 0) > 0;
  } catch (err) {
    console.error('Cek pending stock opname gagal:', err);
    return false;
  }
};

const autoUploadPendingStockOpname = async () => {
  if (isOffline.value || isAutoUploadingPending.value) return;
  if (!await hasPendingStockOpname()) return;

  isAutoUploadingPending.value = true;
  try {
    await SyncService.uploadPendingStockOpnameData();
  } catch (err) {
    console.error('Auto upload stock opname gagal:', err);
  } finally {
    isAutoUploadingPending.value = false;
  }
};

const saveOpname = async () => {
  if (hasHistoryItems.value && historyRequiredMissing.value.length > 0) {
    resetSlide();
    return Swal.fire(
      'Stok Opname Belum Lengkap',
      `Masih ada ${historyRequiredMissing.value.length} produk riwayat yang belum diperbarui. Isi 0 jika stok fisik memang kosong.`,
      'warning'
    );
  }

  const sourceItems = hasHistoryItems.value
    ? rawData.value.map((item) => getOpnameEntry(item.Kode))
    : Object.values(opnameData.value);

  const itemsToSubmit = sourceItems
    .filter((i) => isQtyFilled(i.qty))
    .map((i) => ({
      KodeStok: i.kode,
      id_produk: i.id_produk || null,
      Jumlah: Number(i.qty),
      Satuan: i.unit,
      Harga: Number(i.harga || 0),
      StokSystem: Number(i.stokSystem || 0)
    }));

  if (itemsToSubmit.length === 0) {
    resetSlide();
    return Swal.fire('Peringatan', 'Belum ada stok yang diisi', 'warning');
  }

  if (isOffline.value) {
    await saveOpnameToOfflineQueue(itemsToSubmit);
    await clearDraftAfterSubmit();
    resetSlide();

    return Swal.fire({
      icon: 'info',
      title: 'Tersimpan Offline',
      text: 'Stok opname masuk antrean dan akan diupload saat online.',
      timer: 1500,
      showConfirmButton: false
    });
  }

  const result = await Swal.fire({
    title: 'Simpan Stok Opname?',
    text: `Total ${itemsToSubmit.length} item akan dikirim.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Ya, Simpan'
  });

  if (!result.isConfirmed) {
    resetSlide();
    return;
  }

  isSubmitting.value = true;

  try {
    const res = await api.post('/api/kunjungan/stok-opname/save', {
      id_kunjungan: visitId.value,
      KodeCustomer: customerData.value.Kode,
      // Kirim plafon yang sama dengan endpoint daftar riwayat. Tanpa ini,
      // jalur kunjungan yang hanya membawa ID plafon dapat ter-resolve ke
      // customer lain saat simpan sehingga saran yang valid malah ditolak.
      id_plafon: plafonId.value || null,
      Items: itemsToSubmit,
      require_all_history: hasHistoryItems.value,
      expected_items: hasHistoryItems.value
        ? rawData.value.map((item) => String(item.Kode || '').trim()).filter(Boolean)
        : []
    });

      if (res.data?.success) {
        await saveDoneMarker({
          is_done: true,
          source: 'online',
          id_kunjungan: visitId.value || '',
          kode_customer: customerData.value.Kode,
          id_stock_opname: res.data?.data?.id_stock_opname || null,
          total_item: itemsToSubmit.length,
          response: res.data
        });

        await clearDraftAfterSubmit();

      await Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Data stok opname tersimpan.',
        timer: 1500,
        showConfirmButton: false
      });

      router.push({
        path: '/kunjungan-aktif',
        query: { ...route.query }
      });

      return;
    }

    throw new Error(res.data?.message || 'Gagal menyimpan');
  } catch (e) {
    console.error('❌ Save opname error:', e);

    const statusCode = Number(e?.response?.status || 0);
    if (statusCode >= 400 && statusCode < 500) {
      await Swal.fire({
        icon: 'error',
        title: 'Stok Opname Ditolak',
        text:
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e.message ||
          'Data stok opname belum valid.',
        confirmButtonText: 'OK'
      });
      resetSlide();
      return;
    }

    await saveOpnameToOfflineQueue(itemsToSubmit);
    await clearDraftAfterSubmit();

    await Swal.fire({
      icon: 'warning',
      title: 'Disimpan Offline',
      text: 'Koneksi bermasalah. Data akan diupload otomatis saat online.',
      confirmButtonText: 'OK'
    });

    resetSlide();
  } finally {
    isSubmitting.value = false;
  }
};

// =========================
// WATCHERS
// =========================
watch(
  () => opnameData.value,
  async () => {
    await persistDraft();
  },
  { deep: true }
);

watch(
  () => connectivity.isOnline,
  async (online) => {
    if (online) {
      await autoUploadPendingStockOpname();
      await fetchBrands();
      await fetchData();
    }
  }
);

// =========================
// INIT
// =========================
onMounted(async () => {
  console.log('🧾 Stok opname route query:', route.query);
  await restoreDraft();
  await fetchBrands();
  await fetchData();
});
</script>

<style scoped>
.footer-action {
  padding: 12px 20px calc(42px + env(safe-area-inset-bottom));
  background: white;
  border-top: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cart-brief {
  text-align: center;
  margin-bottom: 0;
  font-size: 0.85rem;
  color: #64748b;
}

.cart-brief.warning {
  background: #f97316;
  border: 1px solid #ea580c;
  color: #ffffff;
  border-radius: 14px;
  padding: 11px 12px;
  box-shadow: 0 8px 18px rgba(249, 115, 22, 0.22);
}

.cart-brief.warning b {
  color: #ffffff;
}

.slide-checkout-container {
  position: relative;
  width: 100%;
  height: 60px;
  background: #f1f5f9;
  border-radius: 30px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.slide-checkout-container.is-disabled {
  opacity: 0.5;
  filter: grayscale(1);
}

.slide-track {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide-text {
  font-size: 0.9rem;
  font-weight: 800;
  color: #94a3b8;
  user-select: none;
}

.slide-handle {
  position: absolute;
  left: 5px;
  width: 50px;
  height: 50px;
  background: #10b981;
  border-radius: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.2rem;
  cursor: grab;
  box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);
  transition: transform 0.1s ease-out;
  z-index: 2;
}

.is-disabled .slide-handle {
  background: #cbd5e1;
}

.loader-mini {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.page-wrapper {
  display: flex;
  justify-content: center;
  background: #f1f5f9;
  min-height: 100vh;
}

.stock-opname-container {
  width: 100%;
  max-width: 480px;
  height: 100vh;
  background: white;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 20px rgba(0,0,0,0.05);
}

.header {
  background: #1e293b;
  padding: 16px 20px;
  color: white;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  position: relative;
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

.header-cart {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.1);
  padding: 8px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.cart-icon {
  font-size: 1.2rem;
}

.cart-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #e11d48;
  color: white;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 50%;
  border: 2px solid #1e293b;
  min-width: 18px;
  text-align: center;
}

.btn-back {
  background: rgba(255,255,255,0.1);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-weight: bold;
}

.header-title h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
}

.header-title p {
  margin: 0;
  font-size: 0.7rem;
  opacity: 0.7;
}

.fixed-nav-wrapper {
  padding: 12px;
  background: white;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.tabs-wrapper {
  display: flex;
  overflow-x: auto;
  gap: 8px;
  padding-bottom: 10px;
  scrollbar-width: none;
}

.tabs-wrapper::-webkit-scrollbar {
  display: none;
}

.tab-item {
  flex: 0 0 auto;
  padding: 8px 16px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
}

.tab-item.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  font-size: 0.9rem;
  color: #94a3b8;
}

.search-input {
  width: 100%;
  padding: 10px 10px 10px 38px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 0.85rem;
  outline: none;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.summary-pill {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 10px 12px;
}

.summary-pill small {
  display: block;
  font-size: 0.62rem;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 4px;
}

.summary-pill strong {
  font-size: 0.95rem;
  color: #0f172a;
  font-weight: 900;
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: #f8fafc;
}

.stock-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stock-card {
  position: relative;
  background: white;
  border-radius: 18px;
  padding: 15px;
  display: flex;
  gap: 12px;
  align-items: center;
  border: 1px solid #f1f5f9;
  transition: all 0.2s;
}

.stock-card.is-filled {
  border-color: #3b82f6;
  background: #eff6ff;
}

.btn-love {
  background: none;
  border: none;
  font-size: 1.3rem;
  cursor: pointer;
  transition: transform 0.2s;
  filter: grayscale(100%);
  opacity: 0.4;
}

.btn-love.is-fav {
  filter: grayscale(0%);
  opacity: 1;
  transform: scale(1.1);
}

.item-info {
  flex: 1;
  overflow: hidden;
}

.brand-tag {
  font-size: 0.6rem;
  font-weight: 800;
  color: #3b82f6;
  text-transform: uppercase;
  display: block;
  margin-bottom: 2px;
}

.item-code {
  font-size: 0.65rem;
  color: #94a3b8;
  font-weight: 600;
}

.item-name-full {
  margin: 2px 0 6px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.3;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.badge-suggest {
  background: #fef3c7;
  color: #92400e;
  font-size: 0.6rem;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 800;
}

.stock-info {
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 600;
}

.diff-info {
  font-size: 0.68rem;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 800;
}

.diff-equal {
  background: #dcfce7;
  color: #166534;
}

.diff-up {
  background: #dbeafe;
  color: #1d4ed8;
}

.diff-down {
  background: #ffedd5;
  color: #c2410c;
}

.price-info {
  font-size: 0.75rem;
  color: #e11d48;
  font-weight: 800;
}

.item-action-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 90px;
}

.opname-input {
  width: 100%;
  padding: 10px 5px;
  border-radius: 10px;
  border: 2px solid #e2e8f0;
  text-align: center;
  font-weight: 800;
  font-size: 1.1rem;
  color: #1a1a3d;
  outline: none;
}

.unit-select {
  width: 100%;
  padding: 4px;
  font-size: 0.65rem;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-weight: 700;
  color: #64748b;
}

.state-container {
  padding: 80px 40px;
  text-align: center;
}

.loader-enterprise {
  width: 40px;
  height: 40px;
  border: 4px solid #f1f5f9;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 15px;
}

.btn-reload {
  margin-top: 15px;
  padding: 10px 25px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 800;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

:global(:root[data-theme='dark']) .page-wrapper,
:global(:root[data-theme='dark']) .stock-opname-container,
:global(:root[data-theme='dark']) .scroll-area {
  background: #020617 !important;
}

:global(:root[data-theme='dark']) .fixed-nav-wrapper,
:global(:root[data-theme='dark']) .stock-card {
  background: #0f172a !important;
  border-color: #334155 !important;
  box-shadow: 0 16px 32px rgba(2, 6, 23, 0.34) !important;
}

:global(:root[data-theme='dark']) .tab-item,
:global(:root[data-theme='dark']) .search-input,
:global(:root[data-theme='dark']) .summary-pill,
:global(:root[data-theme='dark']) .opname-input,
:global(:root[data-theme='dark']) .unit-select {
  background: #111827 !important;
  border-color: #334155 !important;
  color: #e2e8f0 !important;
}

:global(:root[data-theme='dark']) .tab-item.active {
  background: #2563eb !important;
  border-color: #2563eb !important;
}

:global(:root[data-theme='dark']) .summary-pill small,
:global(:root[data-theme='dark']) .stock-info,
:global(:root[data-theme='dark']) .search-icon,
:global(:root[data-theme='dark']) .loading-state,
:global(:root[data-theme='dark']) .end-list,
:global(:root[data-theme='dark']) .empty-state {
  color: #94a3b8 !important;
}

:global(:root[data-theme='dark']) .summary-pill strong,
:global(:root[data-theme='dark']) .item-name-full,
:global(:root[data-theme='dark']) .header-title h3 {
  color: #e2e8f0 !important;
}

:global(:root[data-theme='dark']) .item-code {
  color: #64748b !important;
}

:global(:root[data-theme='dark']) .stock-card.is-filled {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(15, 23, 42, 0.92)) !important;
  border-color: rgba(59, 130, 246, 0.36) !important;
}

:global(:root[data-theme='dark']) .badge-suggest {
  background: rgba(251, 191, 36, 0.16) !important;
  color: #fcd34d !important;
}

:global(:root[data-theme='dark']) .cart-brief.warning {
  background: rgba(154, 52, 18, 0.18) !important;
  border-color: rgba(249, 115, 22, 0.28) !important;
  color: #fdba74 !important;
}

:global(:root[data-theme='dark']) .diff-equal {
  background: rgba(22, 163, 74, 0.18) !important;
  color: #86efac !important;
}

:global(:root[data-theme='dark']) .diff-up {
  background: rgba(37, 99, 235, 0.18) !important;
  color: #93c5fd !important;
}

:global(:root[data-theme='dark']) .diff-down {
  background: rgba(234, 88, 12, 0.18) !important;
  color: #fdba74 !important;
}

:global(:root[data-theme='dark']) .loader-enterprise,
:global(:root[data-theme='dark']) .loader-mini-blue {
  border-color: #1e293b !important;
  border-top-color: #60a5fa !important;
}
</style>

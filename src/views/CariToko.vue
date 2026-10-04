<template>
  <div class="search-container">
    <header class="header-search">
      <div class="search-bar-content">
        <button @click="router.back()" class="btn-back" aria-label="Kembali" title="Kembali">
          <font-awesome-icon icon="chevron-left" />
        </button>
        <div class="search-input-wrapper">
          <span class="search-icon"><font-awesome-icon icon="search" /></span>
          <input 
            v-model="queryText" 
            placeholder="Cari Nama Toko atau Scan..."
            ref="searchInput"
            type="search"
            inputmode="search"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            autofocus
          />
          <button v-if="queryText" @click="clearSearch" class="btn-clear" aria-label="Bersihkan" title="Bersihkan"><font-awesome-icon icon="times" /></button>
        </div>
      </div>
    </header>

    <main class="result-section">
      <div v-if="loading && !stores.length" class="state-container">
        <div class="spinner"></div>
        <p>Mencari data outlet...</p>
      </div>
      
      <div v-else-if="stores.length > 0" class="store-list">
        <div
          v-for="store in stores"
          :key="store.Kode"
          class="store-card"
          @click="goToDetail(store.Kode)"
        >
          <div class="store-icon"><font-awesome-icon icon="store-alt" /></div>
          <div class="store-info">
            <h4>{{ store.Nama }}</h4>
            <div class="meta-row">
              <span class="kode-tag">{{ store.Kode }}</span>
            </div>
            <p v-if="store.Principal" class="principal">{{ store.Principal }}</p>
            <p class="alamat">{{ store.Alamat }}</p>
          </div>
          <div class="arrow"><font-awesome-icon icon="chevron-right" /></div>
        </div>
        <button
          v-if="hasMore"
          type="button"
          class="btn-load-more"
          :disabled="loadingMore"
          @click="loadMoreStores"
        >
          {{ loadingMore ? 'Memuat toko...' : 'Tampilkan toko lainnya' }}
        </button>
      </div>

      <div v-else-if="queryText.trim().length >= minimumQueryLength && !loading" class="state-container">
        <div class="empty-illustration"><font-awesome-icon icon="store-alt" /></div>
        <p class="main-text">Toko tidak ditemukan</p>
        <p class="sub-text">Coba kata kunci lain atau pastikan barcode terbaca jelas.</p>
      </div>

      <div v-else class="state-container">
        <div class="empty-illustration"><font-awesome-icon icon="search" /></div>
        <p class="main-text">Masukkan minimal 2 karakter</p>
        <p class="sub-text">Pencarian mendukung nama, kode, principal, atau barcode toko</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/api/axios';
import { debounce } from 'lodash';
import { getPayloadArray } from '@/services/visitService';

const router = useRouter();
const searchInput = ref(null);
const queryText = ref('');
const stores = ref([]);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(false);
const currentPage = ref(1);

const minimumQueryLength = 2;
const pageSize = 50;
let searchRequestSequence = 0;

onMounted(() => {
  if (searchInput.value) searchInput.value.focus();
});

const clearSearch = () => {
  handleSearch.cancel?.();
  searchRequestSequence += 1;
  queryText.value = '';
  stores.value = [];
  loading.value = false;
  loadingMore.value = false;
  hasMore.value = false;
  currentPage.value = 1;
  if (searchInput.value) searchInput.value.focus();
};

const normalizeStore = (row) => ({
  ...row,
  Kode: String(row?.Kode || row?.kode || row?.kode_customer || row?.id_customer || row?.id || '').trim(),
  Nama: String(row?.Nama || row?.nama || row?.nama_customer || '').trim(),
  Alamat: String(row?.Alamat || row?.alamat || '').trim(),
  Principal: String(row?.Principal || row?.principal_labels || row?.nama_principal || '').trim()
});

const mergeStores = (existing, incoming) => {
  const seen = new Set();
  return [...existing, ...incoming].filter((store) => {
    const key = String(store.id_customer || store.id || store.Kode || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const loadStores = async (keyword, { append = false } = {}) => {
  const value = String(keyword || '').trim();
  const val = value.toLowerCase();

  if (val.length < minimumQueryLength) {
    searchRequestSequence += 1;
    stores.value = [];
    hasMore.value = false;
    currentPage.value = 1;
    loading.value = false;
    loadingMore.value = false;
    return;
  }

  const page = append ? currentPage.value + 1 : 1;
  const requestId = ++searchRequestSequence;
  if (append) {
    loadingMore.value = true;
  } else {
    stores.value = [];
    currentPage.value = 1;
    hasMore.value = false;
    loading.value = true;
  }

  try {
    const response = await api.get('/api/customer/find', {
      params: { text: value, page, limit: pageSize }
    });
    if (requestId !== searchRequestSequence) return;

    const data = getPayloadArray(response.data).map(normalizeStore).filter((store) => store.Kode && store.Nama);
    const responsePage = Number(response?.data?.page || page) || page;
    const moreFromServer = response?.data?.has_more;

    // Server menjadi sumber filter agar hasil yang cocok melalui label
    // principal (mis. P1 - Principal 1) tidak terbuang di filter lokal.
    stores.value = append ? mergeStores(stores.value, data) : data;
    currentPage.value = responsePage;
    hasMore.value = moreFromServer === true;

    console.log('Response Cari Toko:', stores.value);
  } catch (error) {
    if (requestId !== searchRequestSequence) return;
    console.error('Search error detail:', error);
    if (!append) stores.value = [];
    hasMore.value = false;
  } finally {
    if (requestId === searchRequestSequence) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
};

const handleSearch = debounce((keyword) => {
  loadStores(keyword);
}, 500);

const loadMoreStores = () => {
  if (!hasMore.value || loading.value || loadingMore.value) return;
  loadStores(queryText.value, { append: true });
};

watch(queryText, (value) => {
  handleSearch(value);
});

onBeforeUnmount(() => {
  handleSearch.cancel?.();
  searchRequestSequence += 1;
});

const goToDetail = (kode) => {
  router.push(`/store-detail/${kode}`);
};
</script>

<style scoped>
/* Reset & Container */
.search-container {
  background: #fcfcfd;
  min-height: 100vh;
  width: 100%;
  overflow-x: hidden;
}

/* Header & Search Bar */
.header-search {
  background: #1a1a3d;
  padding: 15px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.search-bar-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-back {
  background: none;
  border: none;
  color: white;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-arrow {
  font-size: 2.5rem;
  line-height: 1;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  font-size: 0.9rem;
  z-index: 2;
}

.search-input-wrapper input {
  width: 100%;
  padding: 10px 35px 10px 35px;
  border-radius: 10px;
  border: none;
  outline: none;
  font-size: 0.95rem;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.btn-clear {
  position: absolute;
  right: 10px;
  background: #e2e8f0;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #64748b;
}

/* List Results */
.result-section {
  padding: 15px;
}

.store-card {
  background: white;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  border: 1px solid #f1f5f9;
}

.store-icon {
  width: 45px;
  height: 45px;
  background: #f1f5f9;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.store-info {
  flex: 1;
}

.store-info h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
}

.meta-row {
  margin: 4px 0;
}

.kode-tag {
  font-size: 0.7rem;
  background: #f0fdf4;
  color: #166534;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 700;
}

.alamat {
  margin: 0;
  font-size: 0.8rem;
  color: #64748b;
  display: -webkit-box;
  -line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.principal {
  margin: 0 0 4px;
  color: #0f766e;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.35;
}

.btn-load-more {
  display: block;
  width: 100%;
  margin: 4px 0 16px;
  padding: 12px;
  border: 1px solid #c7d2fe;
  border-radius: 12px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 0.85rem;
  font-weight: 700;
}

.btn-load-more:disabled {
  opacity: 0.65;
}

.arrow {
  font-size: 1.5rem;
  color: #cbd5e1;
}

/* Empty/Loading States */
.state-container {
  text-align: center;
  margin-top: 100px;
  padding: 0 30px;
}

.empty-illustration {
  font-size: 3rem;
  margin-bottom: 15px;
}

.main-text {
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 4px;
}

.sub-text {
  font-size: 0.85rem;
  color: #94a3b8;
  line-height: 1.4;
}

.spinner {
  width: 35px;
  height: 35px;
  border: 3px solid #f1f5f9;
  border-top-color: #1a1a3d;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>

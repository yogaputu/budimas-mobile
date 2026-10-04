<template>
  <div class="detail-page">
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <p>Mengambil data outlet...</p>
    </div>

    <div class="detail-container" v-else-if="store">
      <header class="header-transparent">
        <button @click="router.back()" class="btn-circle" aria-label="Kembali" title="Kembali"><font-awesome-icon icon="chevron-left" /></button>
        <h3>Detail Toko</h3>
      </header>

      <div class="profile-card animate-fade-in">
        <div class="avatar-box"><font-awesome-icon icon="store-alt" /></div>
        <h2>{{ store.Nama?.trim() }}</h2>
        <p class="badge-kode">{{ store.Kode?.trim() }}</p>
        
        <div class="quick-actions">
          <button @click="openMaps" class="act-btn maps" :disabled="!hasCoords" aria-label="Buka Maps" title="Maps">
            <font-awesome-icon icon="location-arrow" />
            <span class="sr-only">Maps</span>
          </button>
          <button @click="callStore" class="act-btn call" :disabled="!hasPhone" aria-label="Telepon toko" title="Telepon">
            <font-awesome-icon icon="phone-alt" />
            <span class="sr-only">Telepon</span>
          </button>
          <button @click="goToEdit" class="act-btn edit" :disabled="!store.Kode" aria-label="Edit toko" title="Edit">
            <font-awesome-icon icon="edit" />
            <span class="sr-only">Edit</span>
          </button>
        </div>
      </div>

      <div class="info-section animate-slide-up">
        <div class="info-group">
          <label>Alamat Lengkap</label>
          <p>{{ store.Alamat?.trim() || '-' }}</p>
        </div>
        <div class="info-group">
          <label>Wilayah / Area</label>
          <p>{{ areaLabel }}</p>
        </div>
        <div class="info-group">
          <label>Jenis Outlet</label>
          <p>{{ store.NamaJenis?.trim() }}</p>
        </div>
        <div class="info-group">
          <label>Koordinat</label>
          <p v-if="hasCoords">{{ store.Latitude }}, {{ store.Longitude }}</p>
          <p v-else class="text-muted">Koordinat belum diset</p>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>Data outlet tidak ditemukan.</p>
      <button @click="router.back()" class="act-btn maps">Kembali</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api/axios';
import { getPayloadObject } from '@/services/visitService';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const storeRaw = ref(null);
const store = ref(null);

const hasCoords = computed(() => {
  return store.value &&
    store.value.Latitude != 0 &&
    store.value.Latitude != null &&
    store.value.Longitude != 0 &&
    store.value.Longitude != null;
});

const hasPhone = computed(() => {
  // Database Anda menggunakan kolom 'Telpon', bukan 'Telepon'
  return store.value && store.value.Telpon && store.value.Telpon.trim() !== '';
});

const areaLabel = computed(() => {
  const name = String(
    store.value?.NamaArea ||
    store.value?.nama_area ||
    store.value?.NamaWilayah4 ||
    store.value?.nama_wilayah4 ||
    store.value?.NamaWilayah3 ||
    store.value?.nama_wilayah3 ||
    store.value?.NamaWilayah2 ||
    store.value?.nama_wilayah2 ||
    store.value?.NamaWilayah1 ||
    store.value?.nama_wilayah1 ||
    ''
  ).trim();
  return name || '-';
});

onMounted(async () => {
  loading.value = true;

  try {
    const res = await api.get(`/api/customer/by-qrcode/${route.params.kode}`);
    const raw = getPayloadObject(res.data);

    if (!raw) {
      store.value = null;
      return;
    }

    // simpan semua field asli
    storeRaw.value = raw;
    console.log("Data mentah toko:", raw);

    // buat alias untuk UI
    store.value = {
      Kode: raw.kode || route.params.kode,
      Nama: raw.nama || raw.nama_customer || 'Toko Tanpa Nama',
      Alamat: raw.alamat || '',
      Telpon: raw.telepon || raw.telepon2 || '',
      Latitude: raw.latitude || 0,
      Longitude: raw.longitude || 0,
      NamaJenis: raw.nama_tipe || raw.tipe_customer || raw.nama_jenis || raw.id_tipe || '-',
      NamaArea: raw.NamaArea || raw.nama_area || raw.NamaWilayah4 || raw.nama_wilayah4 || raw.NamaWilayah3 || raw.nama_wilayah3 || raw.NamaWilayah2 || raw.nama_wilayah2 || raw.NamaWilayah1 || raw.nama_wilayah1 || '',
      KodeArea: raw.KodeArea || raw.kode_area || raw.id_wilayah4 || raw.id_wilayah3 || raw.id_wilayah2 || raw.id_wilayah1 || '',
      NamaWilayah1: raw.NamaWilayah1 || raw.nama_wilayah1 || '',
      NamaWilayah2: raw.NamaWilayah2 || raw.nama_wilayah2 || '',
      NamaWilayah3: raw.NamaWilayah3 || raw.nama_wilayah3 || '',
      NamaWilayah4: raw.NamaWilayah4 || raw.nama_wilayah4 || '',
      id_wilayah1: raw.id_wilayah1,
      id_wilayah2: raw.id_wilayah2,
      id_wilayah3: raw.id_wilayah3,
      id_wilayah4: raw.id_wilayah4
    };

  } catch (e) {
    console.error("Gagal load detail", e);
  } finally {
    loading.value = false;
  }
});

const openMaps = () => {
  if (hasCoords.value) {
    // Perbaikan URL Maps: Menggunakan format standard
    const url = `https://www.google.com/maps/search/?api=1&query=${store.value.Latitude},${store.value.Longitude}`;
    window.open(url, '_blank');
  }
};

const callStore = () => {
  if (hasPhone.value) {
    window.location.href = `tel:${store.value.Telpon.trim()}`;
  }
};

const goToEdit = () => {
  const kode = String(store.value?.Kode || '').trim();
  if (!kode) return;
  router.push(`/edit-toko/${encodeURIComponent(kode)}`);
};
</script>

<style scoped>
.detail-page { background: #fcfcfd; min-height: 100vh; }
.header-transparent { padding: 20px; display: flex; align-items: center; gap: 15px; }
.btn-circle { background: #1a1a3d; color: white; border: none; width: 35px; height: 35px; border-radius: 50%; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; }

.profile-card { background: white; margin: 0 15px 15px; border-radius: 24px; padding: 30px 20px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
.avatar-box { font-size: 3rem; margin-bottom: 10px; }
.profile-card h2 { font-size: 1.2rem; color: #1a1a3d; margin: 10px 0; }
.badge-kode { display: inline-block; background: #f0fdf4; padding: 5px 15px; border-radius: 20px; font-weight: 800; color: #7cb342; font-size: 0.85rem; }

.quick-actions { display: flex; gap: 10px; margin-top: 25px; }
.act-btn { flex: 1; padding: 12px; border: none; border-radius: 12px; font-weight: bold; font-size: 0.9rem; transition: opacity 0.2s; }
.act-btn:disabled { opacity: 0.3; }
.maps { background: #1a1a3d; color: white; }
.call { background: #7cb342; color: white; }

.info-section { background: white; margin: 0 15px; border-radius: 24px; padding: 10px 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
.info-group { padding: 15px 0; border-bottom: 1px solid #f1f5f9; }
.info-group:last-child { border: none; }
.info-group label { font-size: 0.7rem; color: #94a3b8; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
.info-group p { margin-top: 5px; color: #1e293b; font-weight: 600; font-size: 0.95rem; line-height: 1.4; }
.empty-state { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; color: #64748b; }

.loading-overlay { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; color: #94a3b8; }
.spinner { width: 40px; height: 40px; border: 4px solid #f1f5f9; border-top-color: #1a1a3d; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px; }
.text-muted { color: #cbd5e1; font-style: italic; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.animate-slide-up { animation: slideUp 0.4s ease-out; }
</style>

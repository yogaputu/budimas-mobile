<template>
  <div class="edit-page">
    <header class="header-nav">
      <div class="header-content">
        <button @click="router.back()" class="btn-back" aria-label="Kembali" title="Kembali"><font-awesome-icon icon="chevron-left" /></button>
        <h3>Update Data & Lokasi</h3>
      </div>
    </header>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Memuat data toko...</p>
    </div>

    <form v-else @submit.prevent="saveData" class="form-container">
      <div class="info-card">
        <span class="label">KODE CUSTOMER</span>
        <span class="value">{{ formData.Kode }}</span>
      </div>

      <div class="input-section">
        <div class="input-group">
          <label>Nama Toko</label>
          <input v-model="formData.Nama" type="text" required />
        </div>

        <div class="input-group">
          <label>Alamat Lengkap</label>
          <textarea v-model="formData.Alamat" rows="2"></textarea>
        </div>

        <div class="input-group">
          <label>Nomor Telpon</label>
          <input v-model="formData.Telpon" type="tel" />
        </div>

        <div class="map-container">
          <label>Titik Lokasi (Geser Pin)</label>
          <div id="map" class="map-canvas"></div>
          <p class="map-help">Klik pada peta atau geser pin untuk mengubah lokasi</p>
        </div>

        <div class="geo-grid">
          <div class="input-group">
            <label>Latitude</label>
            <input v-model="formData.Latitude" type="text" readonly class="readonly-input" />
          </div>
          <div class="input-group">
            <label>Longitude</label>
            <input v-model="formData.Longitude" type="text" readonly class="readonly-input" />
          </div>
        </div>
        
        <button type="button" @click="getCurrentLocation" class="btn-location">
          📍 Ambil GPS Saat Ini
        </button>
      </div>

      <div class="action-area">
        <button type="submit" class="btn-save" :disabled="saving">
          {{ saving ? 'Menyimpan...' : 'Simpan Perubahan' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api/axios';
import Swal from 'sweetalert2';
import { getPayloadObject } from '@/services/visitService';
import { getCurrentDevicePosition, getLocationErrorMessage } from '@/utils/location';

// Import Leaflet dan CSS-nya
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Perbaikan Icon Leaflet (Sering hilang saat pakai Webpack/Vite)
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const saving = ref(false);

const formData = ref({
  Kode: '',
  Nama: '',
  Alamat: '',
  Telpon: '',
  Latitude: -7.536, 
  Longitude: 110.594
});

let map;
let marker;

const initLeaflet = () => {
  const mapElement = document.getElementById("map");
  
  // CEK: Jika elemen tidak ditemukan, jangan lanjut agar tidak error
  if (!mapElement) {
    console.error("Elemen #map tidak ditemukan di DOM");
    return;
  }

  // Jika map sudah pernah diinisialisasi, hapus dulu (biar tidak bentrok saat hot reload)
  if (map) {
    map.remove();
  }

  const lat = parseFloat(formData.value.Latitude) || -7.536;
  const lng = parseFloat(formData.value.Longitude) || 110.594;

  const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
  });
  L.Marker.prototype.options.icon = DefaultIcon;

  map = L.map('map').setView([lat, lng], 17);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);

  marker = L.marker([lat, lng], { draggable: true }).addTo(map);

  marker.on('dragend', function () {
    const position = marker.getLatLng();
    updateCoords(position.lat, position.lng);
  });

  map.on('click', function (e) {
    const latlng = e.latlng;
    marker.setLatLng(latlng);
    updateCoords(latlng.lat, latlng.lng);
  });
};

const updateCoords = (lat, lng) => {
  formData.value.Latitude = lat.toFixed(7);
  formData.value.Longitude = lng.toFixed(7);
};

const getCurrentLocation = async () => {
  try {
    const position = await getCurrentDevicePosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    });
    const { latitude, longitude } = position.coords;
    const newPos = [latitude, longitude];
    map.setView(newPos, 17);
    marker.setLatLng(newPos);
    updateCoords(latitude, longitude);
  } catch (error) {
    console.error('GPS Error:', error);
    Swal.fire('Error', getLocationErrorMessage(error), 'error');
  }
};

onMounted(async () => {
  try {
    const res = await api.get(`/api/customer/by-qrcode/${route.params.kode}`);

    
    const data = getPayloadObject(res.data);
    
    if (data) {
      formData.value = {
        Kode: (data.kode || data.Kode || '').trim(),
        Nama: (data.nama || data.Nama || '').trim(),
        Alamat: (data.alamat || data.Alamat || '').trim(),
        Telpon: (data.telepon || data.telepon2 || data.Telpon || '').trim(),
        Latitude: parseFloat(data.latitude || data.Latitude) || -7.536,
        Longitude: parseFloat(data.longitude || data.Longitude) || 110.594
      };

      // MATIKAN LOADING DULU
      loading.value = false;

      // TUNGGU DOM UPDATE, BARU JALANKAN MAP
      await nextTick();
      initLeaflet();
    }
  } catch (e) {
    console.error(e);
    loading.value = false;
  }
});

const saveData = async () => {
  saving.value = true;
  try {
    const res = await api.post('/api/customer/update', formData.value);
    if (res.data?.status === 'success' || res.data?.success) {
      await Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Data toko berhasil diupdate.',
        timer: 1400,
        showConfirmButton: false
      });
      router.back();
      return;
    }

    throw new Error(res.data?.message || 'Gagal menyimpan data toko');
  } catch (e) {
    await Swal.fire({
      icon: 'error',
      title: 'Gagal Menyimpan',
      text: e?.response?.data?.message || e.message || 'Koneksi bermasalah.',
      confirmButtonText: 'OK'
    });
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.edit-page { background: #f8fafc; min-height: 100vh; }
.header-nav { background: #1a1a3d; color: white; padding: 10px 0; position: sticky; top: 0; z-index: 1000; }
.header-content { max-width: 500px; margin: 0 auto; display: flex; align-items: center; padding: 0 15px; gap: 10px; }
.btn-back { background: none; border: none; color: white; font-size: 2.5rem; line-height: 1; cursor: pointer; }

.form-container { max-width: 500px; margin: 0 auto; padding: 20px 15px; display: flex; flex-direction: column; gap: 20px; }

.info-card { background: #e2e8f0; padding: 15px; border-radius: 12px; border-left: 5px solid #1a1a3d; }
.info-card .label { font-size: 0.65rem; color: #64748b; font-weight: bold; display: block; }
.info-card .value { font-size: 1rem; color: #1a1a3d; font-weight: 800; }

.input-section { background: white; padding: 20px; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 15px; }

.input-group label { font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 5px; display: block; }
.input-group input, .input-group textarea { width: 100%; padding: 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 1rem; box-sizing: border-box; }
.input-group input:focus { border-color: #1a1a3d; outline: none; }
.readonly-input { background: #f8fafc; color: #94a3b8; }

.map-container { display: flex; flex-direction: column; gap: 8px; }
.map-canvas { width: 100%; height: 250px; border-radius: 12px; border: 1px solid #cbd5e1; z-index: 1; }
.map-help { font-size: 0.7rem; color: #94a3b8; font-style: italic; }

.geo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }

.btn-location { background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; padding: 12px; border-radius: 10px; font-weight: 600; font-size: 0.85rem; }

.action-area { padding-bottom: 20px; }
.btn-save { width: 100%; background: #7cb342; color: white; border: none; padding: 16px; border-radius: 15px; font-weight: bold; font-size: 1.1rem; }
.btn-save:disabled { background: #cbd5e1; }

.loading-state { text-align: center; padding: 100px 20px; color: #64748b; }
.spinner { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #1a1a3d; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>

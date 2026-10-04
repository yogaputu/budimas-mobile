<template>
  <div class="registration-container">
    <header class="header-modern">
      <div class="header-content">
        <button @click="router.back()" class="btn-blur-back" aria-label="Kembali" title="Kembali"><span><font-awesome-icon icon="chevron-left" /></span></button>
        <div class="header-title">
          <span class="app-version">Outlet Management</span>
          <h3>Registrasi Outlet Baru</h3>
        </div>
      </div>
    </header>

    <div class="step-indicator">
      <div v-for="i in 3" :key="i" :class="['step-dot', { active: currentStep >= i }]"></div>
    </div>

    <main class="main-content animate-fade-in">
      <form @submit.prevent="submitRegistrasi">
        
        <section v-if="currentStep === 1" class="form-section">
          <div class="section-header">
            <h4>Informasi Outlet</h4>
            <p>Data lokasi dan identitas fisik toko</p>
          </div>

          <div class="input-group">
            <label>Peta Lokasi</label>
            <div class="gps-box" :class="{ 'gps-active': form.Latitude }" @click="openMapPicker">
              <span v-if="form.Latitude">📍 {{ form.Latitude.toFixed(6) }}, {{ form.Longitude.toFixed(6) }}</span>
              <span v-else>Klik untuk Pilih Lokasi di Map</span>
            </div>
            <button type="button" @click="getLocation" :disabled="loadingGps" class="btn-gps-auto">
              <font-awesome-icon :icon="loadingGps ? 'sync-alt' : 'location-arrow'" />
              <span>{{ loadingGps ? 'Mendeteksi...' : 'Deteksi Lokasi Otomatis' }}</span>
            </button>
          </div>

          <div class="input-group">
            <label>Nama Outlet</label>
            <input v-model="form.NamaOutlet" type="text" placeholder="Masukkan Nama Outlet" maxlength="50" required />
          </div>

          <div class="input-group">
            <label>Alamat Outlet</label>
            <textarea v-model="form.AlamatOutlet" rows="2" placeholder="Detail jalan/no rumah" maxlength="100"></textarea>
          </div>

          <div class="input-group">
            <label>Telepon</label>
            <input v-model="form.TeleponOutlet" type="tel" placeholder="08xxxxxxxx" maxlength="20" required />
          </div>

          <div class="two-cols">
            <div class="input-group">
              <label>Kelurahan</label>
              <input v-model="form.KelurahanOutlet" type="text" maxlength="50" />
            </div>
            <div class="input-group">
              <label>Kecamatan</label>
              <input v-model="form.KecamatanOutlet" type="text" maxlength="50" />
            </div>
          </div>

          <div class="input-group">
            <label>Kota/Kabupaten</label>
            <input v-model="form.KotaOutlet" type="text" maxlength="50" />
          </div>
        </section>

        <section v-else-if="currentStep === 2" class="form-section">
          <div class="section-header">
            <h4>Klasifikasi Outlet</h4>
            <p>Pengelompokan kategori bisnis</p>
          </div>

          <div class="input-group">
            <label>Tipe Outlet</label>
            <div class="modal-trigger-box" @click="showModal('tipe')">
              <span>{{ tipeOutletLabel || 'Pilih Tipe' }}</span>
              <i class="arrow-icon"></i>
            </div>
          </div>

          <div class="input-group">
            <label>Area Outlet</label>
            <div class="modal-trigger-box" @click="showModal('area')">
              <span>{{ areaOutlets[form.AreaOutlet] || 'Pilih Area' }}</span>
              <i class="arrow-icon"></i>
            </div>
          </div>

          <div class="input-group">
            <label>Cluster Outlet</label>
            <div class="modal-trigger-box" @click="showModal('cluster')">
              <span>{{ clusterOutlets[form.ClusterOutlet] || 'Pilih Cluster' }}</span>
              <i class="arrow-icon"></i>
            </div>
          </div>

          <div class="input-group">
            <label>Kode Lama (Opsional)</label>
            <input v-model="form.KodeLama" type="text" placeholder="Isi jika migrasi data lama" maxlength="20" />
          </div>
        </section>

        <section v-else-if="currentStep === 3" class="form-section">
          <div class="section-header">
            <h4>Informasi Pemilik</h4>
            <p>Data identitas pemilik outlet</p>
          </div>

          <div class="input-group">
            <label>Nama Pemilik</label>
            <input v-model="form.NamaPemilik" type="text" placeholder="Nama Sesuai KTP" maxlength="50" required />
          </div>

          <div class="input-group">
            <label>No. KTP</label>
            <input v-model="form.NoKTPPemilik" type="text" placeholder="33xxxxxxxxxxxxxx" maxlength="30" required />
          </div>

          <div class="input-group">
            <label>Telepon Pemilik</label>
            <input v-model="form.TeleponPemilik" type="tel" placeholder="08xxxxxxxx" maxlength="20" />
          </div>

          <div class="input-group">
            <label>Alamat Pemilik</label>
            <textarea v-model="form.AlamatPemilik" rows="2" placeholder="Alamat lengkap pemilik" maxlength="100"></textarea>
          </div>
        </section>

        <div class="form-footer">
          <button v-if="currentStep > 1" type="button" @click="currentStep--" class="btn-prev"><font-awesome-icon icon="chevron-left" /><span class="sr-only">Kembali</span></button>
          <button v-if="currentStep < 3" type="button" @click="currentStep++" class="btn-next"><font-awesome-icon icon="chevron-right" /><span class="sr-only">Lanjut</span></button>
          <button v-else type="submit" class="btn-submit" :disabled="submitting">
            <font-awesome-icon :icon="submitting ? 'sync-alt' : 'floppy-disk'" />
            <span>{{ submitting ? 'Memproses...' : 'Daftarkan Outlet' }}</span>
          </button>
        </div>
      </form>
    </main>

    <Transition name="slide-up">
      <div v-if="activeModal" class="modal-overlay" @click="activeModal = null">
        <div class="bottom-sheet" @click.stop>
          <div class="sheet-handle"></div>
          <h5>Pilih {{ modalTitle }}</h5>
          <div class="options-list">
            <div 
              v-for="(label, val) in currentOptions" 
              :key="val" 
              class="option-item"
              :class="{ selected: isSelected(val) }"
              @click="selectOption(val)"
            >
              {{ label }}
              <span v-if="isSelected(val)" class="check-mark">✓</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/api/axios';
import Swal from 'sweetalert2';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCurrentDevicePosition, getLocationErrorMessage } from '@/utils/location';

const router = useRouter();
const currentStep = ref(1);
const submitting = ref(false);
const loadingGps = ref(false);
const activeModal = ref(null);

const areaOutlets = { "S": "Surakarta", "B": "Boyolali", "K": "Klaten", "W": "Wonogiri", "R": "Sragen" };
const clusterOutlets = { "G": "Grosir", "R": "Retail", "S": "Semi Grosir", "O": "Star Outlet" };
const tipeOutlets = ref({});

const form = reactive({
  NamaOutlet: '', AlamatOutlet: '', TeleponOutlet: '',
  KelurahanOutlet: '', KecamatanOutlet: '', KotaOutlet: '',
  TipeOutlet: '', id_tipe: '', AreaOutlet: 'S', ClusterOutlet: 'G',
  NamaPemilik: '', AlamatPemilik: '', TeleponPemilik: '',
  KelurahanPemilik: '', KecamatanPemilik: '', KotaPemilik: '',
  NoKTPPemilik: '', NPWPPemilik: '',
  Latitude: '', Longitude: '', KodeLama: ''
});

const tipeOutletLabel = computed(() => tipeOutlets.value[String(form.TipeOutlet)] || '');

// MODAL LOGIC
const modalTitle = computed(() => {
  if (activeModal.value === 'tipe') return 'Tipe Outlet';
  if (activeModal.value === 'area') return 'Area Operasional';
  if (activeModal.value === 'cluster') return 'Cluster Bisnis';
  return '';
});

const currentOptions = computed(() => {
  if (activeModal.value === 'tipe') return tipeOutlets.value;
  if (activeModal.value === 'area') return areaOutlets;
  if (activeModal.value === 'cluster') return clusterOutlets;
  return {};
});

const showModal = (type) => activeModal.value = type;
const isSelected = (val) => {
  if (activeModal.value === 'tipe') return form.TipeOutlet === val;
  if (activeModal.value === 'area') return form.AreaOutlet === val;
  if (activeModal.value === 'cluster') return form.ClusterOutlet === val;
  return false;
};
const selectOption = (val) => {
  if (activeModal.value === 'tipe') {
    form.TipeOutlet = val;
    form.id_tipe = val;
  }
  if (activeModal.value === 'area') form.AreaOutlet = val;
  if (activeModal.value === 'cluster') form.ClusterOutlet = val;
  activeModal.value = null;
};

const fetchTipeOutlet = async () => {
  const normalizeRows = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  };

  const endpoints = [
    '/api/customer/types',
    '/api/base/customer_tipe/all',
    '/api/base/customer-tipe/all',
    '/api/base/customer_type/all'
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await api.get(endpoint);
      const rows = normalizeRows(res.data);
      const mapped = rows.reduce((acc, item) => {
      const id = String(item.id || '').trim();
        const label = String(item.nama || item.label || item.tipe || item.kode || '').trim();
        if (id && label) acc[id] = label;
      return acc;
    }, {});

      if (Object.keys(mapped).length > 0) {
        tipeOutlets.value = mapped;
        return;
      }
    } catch (e) {
      console.warn(`Fetch tipe outlet gagal dari ${endpoint}:`, e);
    }
  }

  tipeOutlets.value = {
    1: 'Retail',
    2: 'Grosir',
    3: 'Modern Trade'
  };
};

// API & GEOLOCATION
const fetchAddress = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
    const data = await res.json();
    if (data.address) {
      const a = data.address;
      form.KelurahanOutlet = a.village || a.hamlet || a.suburb || '';
      form.KecamatanOutlet = a.district || a.city_district || '';
      form.KotaOutlet = a.county || a.city || '';
      form.AlamatOutlet = (data.display_name).substring(0, 100);
      
      form.KelurahanPemilik = form.KelurahanOutlet;
      form.KecamatanPemilik = form.KecamatanOutlet;
      form.KotaPemilik = form.KotaOutlet;
      form.AlamatPemilik = form.AlamatOutlet;
    }
  } catch (e) { console.error(e); }
};

const getLocation = async () => {
  loadingGps.value = true;

  try {
    const pos = await getCurrentDevicePosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    });

    form.Latitude = pos.coords.latitude;
    form.Longitude = pos.coords.longitude;
    await fetchAddress(form.Latitude, form.Longitude);
  } catch (error) {
    console.error('GPS Error:', error);
    Swal.fire('Error', getLocationErrorMessage(error), 'error');
  } finally {
    loadingGps.value = false;
  }
};

const openMapPicker = () => {
  const lat = form.Latitude || -7.5361;
  const lng = form.Longitude || 110.5948;
  let tLat = lat, tLng = lng;

  Swal.fire({
    title: 'Pilih Lokasi',
    html: '<div id="map-picker" style="height: 300px; width: 100%; border-radius: 12px;"></div>',
    showCancelButton: true,
    confirmButtonText: 'Gunakan Lokasi Ini',
    didOpen: () => {
      setTimeout(() => {
        const map = L.map('map-picker').setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        marker.on('dragend', (e) => {
          tLat = e.target.getLatLng().lat; tLng = e.target.getLatLng().lng;
        });
      }, 300);
    }
  }).then(async (r) => {
    if (r.isConfirmed) {
      form.Latitude = tLat; form.Longitude = tLng;
      await fetchAddress(tLat, tLng);
    }
  });
};

const submitRegistrasi = async () => {
  if (!form.NamaOutlet?.trim()) {
    return Swal.fire('Peringatan', 'Nama outlet wajib diisi.', 'warning');
  }

  if (!form.TipeOutlet) {
    currentStep.value = 2;
    return Swal.fire('Peringatan', 'Tipe outlet wajib dipilih.', 'warning');
  }

  if (!/^[0-9]{8,20}$/.test(String(form.TeleponOutlet || '').trim())) {
    currentStep.value = 1;
    return Swal.fire('Peringatan', 'Telepon outlet wajib angka 8-20 digit.', 'warning');
  }

  if (!form.Latitude || !form.Longitude) {
    return Swal.fire('Peringatan', 'Lokasi GPS wajib diisi.', 'warning');
  }

  submitting.value = true;

  try {
    const response = await api.post('/api/customer/register', {
      ...form,
      id_tipe: form.id_tipe || form.TipeOutlet
    });

    if (response.data?.success) {
      await Swal.fire('Berhasil!', 'Outlet telah terdaftar.', 'success');
      router.push('/dashboard');
    } else {
      Swal.fire('Gagal', response.data?.message || 'Error saat simpan data', 'error');
    }
  } catch (error) {
    console.error('Registrasi outlet error:', error);
    Swal.fire(
      'Gagal',
      error.response?.data?.message || 'Terjadi gangguan koneksi.',
      'error'
    );
  } finally {
    submitting.value = false;
  }
};

onMounted(async () => {
  await fetchTipeOutlet();
  getLocation();
});
</script>

<style scoped>
.registration-container { background: #f8fafc; min-height: 100vh; padding-bottom: 50px; }
.header-modern { background: #1a1a3d; padding: 25px 20px 40px; border-bottom-left-radius: 30px; border-bottom-right-radius: 30px; color: white; }
.header-content { display: flex; align-items: center; gap: 15px; }
.btn-blur-back { background: rgba(255,255,255,0.15); border: none; color: white; width: 35px; height: 35px; border-radius: 10px; font-size: 1.5rem; line-height: 1; }

.step-indicator { display: flex; justify-content: center; gap: 8px; margin-top: -15px; margin-bottom: 20px; }
.step-dot { width: 35px; height: 6px; background: #dfe6e9; border-radius: 10px; transition: 0.3s; }
.step-dot.active { background: #7cb342; width: 60px; }

.form-section { background: white; padding: 25px; border-radius: 24px; margin: 0 15px 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
.section-header { margin-bottom: 20px; }
.section-header h4 { color: #1a1a3d; font-size: 1.1rem; margin-bottom: 5px; border-left: 4px solid #7cb342; padding-left: 12px; }
.section-header p { color: #64748b; font-size: 0.85rem; }

.input-group { margin-bottom: 20px; }
.input-group label { display: block; font-size: 0.8rem; font-weight: 700; color: #334155; margin-bottom: 8px; }
.input-group input, .input-group textarea { width: 100%; padding: 14px; border: 1.5px solid #e2e8f0; border-radius: 14px; background: #fdfdfd; font-size: 0.95rem; }

.two-cols { display: flex; gap: 12px; }
.two-cols .input-group { flex: 1; }

/* Modal Trigger Styling */
.modal-trigger-box { 
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px;
  cursor: pointer; transition: 0.2s;
}
.modal-trigger-box:active { transform: scale(0.98); background: #f1f5f9; }
.arrow-icon::after { content: '▶'; font-size: 0.6rem; color: #94a3b8; transform: rotate(90deg); display: inline-block; }

/* Custom Modal / Bottom Sheet */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: flex-end; }
.bottom-sheet { 
  width: 100%; background: white; border-top-left-radius: 25px; border-top-right-radius: 25px; 
  padding: 20px; animation: slideUp 0.3s ease-out;
}
.sheet-handle { width: 40px; height: 5px; background: #e2e8f0; border-radius: 10px; margin: 0 auto 20px; }
.bottom-sheet h5 { font-size: 1rem; color: #1a1a3d; margin-bottom: 15px; font-weight: 700; }
.options-list { max-height: 300px; overflow-y: auto; }
.option-item { 
  padding: 16px; border-radius: 12px; display: flex; justify-content: space-between; 
  margin-bottom: 8px; font-weight: 600; color: #475569;
}
.option-item.selected { background: #eff6ff; color: #2563eb; }
.check-mark { color: #2563eb; }

.gps-box { padding: 18px; border: 2px dashed #cbd5e1; background: #f8fafc; border-radius: 16px; text-align: center; color: #7cb342; font-weight: 700; cursor: pointer; }
.btn-gps-auto { width: 100%; background: #1a1a3d; color: white; border: none; padding: 12px; border-radius: 12px; font-weight: 600; margin-top: 10px; }

.form-footer { display: flex; gap: 15px; padding: 10px 20px 30px; }
.btn-next, .btn-submit { flex: 2; background: #1a1a3d; color: white; border: none; height: 55px; border-radius: 18px; font-weight: 700; box-shadow: 0 4px 15px rgba(26, 26, 61, 0.2); }
.btn-prev { flex: 1; background: white; border: 2px solid #1a1a3d; border-radius: 18px; color: #1a1a3d; font-weight: 700; }

.slide-up-enter-active, .slide-up-leave-active { transition: 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(100%); }

@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
</style>

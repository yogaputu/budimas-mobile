<template>
  <div class="active-container">
    <header class="header-modern">
      <div class="header-content">
        <button @click="router.back()" class="btn-blur-back ripple">
          <span><font-awesome-icon icon="chevron-left" /></span>
        </button>
        <div class="header-title">
          <span class="app-version">VISIT SUMMARY</span>
          <h3>Kunjungan Selesai</h3>
        </div>
        <div class="status-indicator">
          <div class="user-status-orb shadow-pulse"></div>
        </div>
      </div>
    </header>

    <div v-if="loading" class="loading-overlay">
      <div class="spinner-box">
        <div class="spinner-dual-ring"></div>
        <p class="loading-text">Memuat ringkasan kunjungan...</p>
      </div>
    </div>

    <div v-else-if="!dataKunjungan" class="empty-state">
      <div class="empty-box animate-bounce-in">
        <div class="empty-icon-wrapper">
          <span class="empty-icon">📂</span>
        </div>
        <h3>Tidak Ada Kunjungan</h3>
        <p>Sesi kunjungan sudah berakhir atau belum ditemukan pada data sinkron.</p>
        <button @click="router.push('/dashboard')" class="btn-primary-outline">Kembali ke Dashboard</button>
      </div>
    </div>

    <div v-else class="main-content animate-fade-in">
      <section class="highlight-card">
        <div class="card-bg-pattern"></div>
        <div class="store-meta">
          <div class="badge-status-container">
            <span class="badge-status">KUNJUNGAN TERSIMPAN</span>
          </div>
          <h2 class="store-name">{{ dataKunjungan.Nama }}</h2>
          <p class="store-address">
            <i class="icon-map">📍</i> {{ dataKunjungan.Alamat }}
          </p>
        </div>
        
        <div class="store-stats">
          <div class="stat-item">
            <small>KODE CUSTOMER</small>
            <span class="stat-value">{{ dataKunjungan.Kode }}</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <small>DURASI</small>
            <span class="timer-text">{{ duration }}</span>
          </div>
        </div>

        <div v-if="dataKunjungan.Alasan" class="visit-reason-banner">
          <span class="reason-badge">Tidak Ada Transaksi</span>
          <p>{{ dataKunjungan.Alasan }}</p>
        </div>
      </section>

      <div class="action-grid-modern">
        <div
          v-for="menu in menuList"
          :key="menu.target"
          class="action-card ripple"
          @click="navigateTo(menu.target)"
        >
          <div :class="['card-icon', menu.color]">{{ menu.icon }}</div>
          <div class="card-info">
            <h4>{{ menu.title }}</h4>
            <p>{{ menu.desc }}</p>
          </div>
        </div>

        <div 
          class="action-card ripple" 
          @click="showReasonModal = true" 
          :class="{ 'card-active': selectedReason || dataKunjungan.Alasan }"
        >
          <div
            class="card-icon"
            :class="selectedReason || dataKunjungan.Alasan ? 'bg-gradient-green shadow-green' : 'bg-gradient-gray'"
          >
            {{ selectedReason || dataKunjungan.Alasan ? '✅' : '💬' }}
          </div>
          <div class="card-info">
            <h4>Alasan Kunjungan</h4>
            <p class="reason-text">
              {{ selectedReason?.nama_alasan || dataKunjungan.Alasan || 'Tambahkan alasan bila tidak ada transaksi' }}
            </p>
          </div>
          <div v-if="selectedReason || dataKunjungan.Alasan" class="active-dot"></div>
        </div>
      </div>
    </div>

    <transition name="sheet-slide">
      <div v-if="showReasonModal" class="bottom-sheet-overlay" @click.self="showReasonModal = false">
        <div class="bottom-sheet">
          <div class="sheet-handle"></div>
          <div class="sheet-header">
            <h3>Keterangan Kunjungan</h3>
            <p>Pilih alasan kunjungan untuk kebutuhan audit dan histori outlet.</p>
          </div>
          
          <div class="reason-list-container">
            <div 
              v-for="r in listAlasan" 
              :key="r.id" 
              @click="handleReasonSelection(r)"
              class="reason-item"
              :class="{ 'active-reason': selectedReason?.nama_alasan === r.nama_alasan }"
            >
              <span class="reason-name">{{ r.nama_alasan }}</span>
              <div class="reason-checkbox" :class="{ 'checked': selectedReason?.nama_alasan === r.nama_alasan }">
                <div class="check-inner"></div>
              </div>
            </div>
          </div>

          <div class="sheet-footer">
            <button @click="resetReason" class="btn-text-danger">Hapus Pilihan</button>
            <button @click="showReasonModal = false" class="btn-sheet-close">Selesai</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import api from '@/api/axios';
import Swal from 'sweetalert2';

const router = useRouter();
const route = useRoute();

const loading = ref(true);
const loadingCheckout = ref(false);
const dataKunjungan = ref(null);
const startTime = ref(null);
const now = ref(new Date());
let timerInterval = null;

const showReasonModal = ref(false);
const selectedReason = ref(null);

const menuList = [
  { title: 'History', desc: 'Riwayat toko', icon: '📊', color: 'bg-gradient-blue', target: 'Riwayat' },
  { title: 'Stok Opname', desc: 'Cek stok customer', icon: '📦', color: 'bg-gradient-orange', target: 'StokOpname' },
  { title: 'Retur', desc: 'Riwayat retur barang', icon: '↩️', color: 'bg-gradient-red', target: 'Retur' },
];

const listAlasan = ref([
  { id: 1, nama_alasan: 'Tutup Permanen' },
  { id: 2, nama_alasan: 'Tutup Sementara' },
  { id: 3, nama_alasan: 'Uang Habis' },
  { id: 4, nama_alasan: 'Beli Dari Sumber Lain' },
  { id: 5, nama_alasan: 'Stok Masih Ada' },
  { id: 10, nama_alasan: 'Saran Order' },
  { id: 11, nama_alasan: 'Pemilik Tidak Ada' },
  { id: 12, nama_alasan: 'Collection Tagihan' }
]);

const duration = computed(() => {
  if (!startTime.value) return '0m';
  const diffInMs = Math.max(0, now.value - startTime.value);
  const diffInMins = Math.floor(diffInMs / 60000);
  if (diffInMins < 60) return `${diffInMins}m`;
  const hours = Math.floor(diffInMins / 60);
  const mins = diffInMins % 60;
  return `${hours}j ${mins}m`;
});

// Helper: Normalisasi Tanggal SQL Server ke JS Date
const normalizeDate = (dateValue) => {
  if (!dateValue) return null;
  // Menangani format "YYYY-MM-DD HH:mm:ss" atau ISO string
  const cleanDate = String(dateValue).split('.')[0].replace(' ', 'T');
  const parsed = new Date(cleanDate);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const fetchKunjunganAktif = async () => {
  try {
    loading.value = true;
    const [response, responseDaf] = await Promise.all([
      api.get('/api/kunjungan/jadwal'),
      api.get('/api/kunjungan/daftar')
    ]);

    const parseData = (data) => {
      if (typeof data === 'string') {
        const start = data.indexOf('[');
        return start !== -1 ? JSON.parse(data.substring(start)) : [];
      }
      return Array.isArray(data) ? data : [];
    };

    const listJadwal = parseData(response.data);
    const listDaftar = parseData(responseDaf.data);

    const kodeDipilih = String(route.query.kode_customer || '').trim().toLowerCase();
    const urlParams = new URLSearchParams(window.location.search);
    const kode = urlParams.get('kode_customer'); 
    const hasil = listDaftar.find(item => item.Kode === kode);

    // Mencari data dengan toleransi spasi dan case-sensitive
    const sd = listDaftar.find(i => {
       const k = (i.Kode || i.kode_customer || i.KodeCustomer || '').toString().trim().toLowerCase();
       return k === kodeDipilih;
    });

    const sj = listJadwal.find(i => {
       const k = (i.Kode || i.kode || '').toString().trim().toLowerCase();
       return k === kodeDipilih;
    });

    // MAPPING DENGAN FALLBACK NAMA KOLOM ALTERNATIF
    // Kadang ID ditulis 'ID', 'id_kunjungan', atau 'id'
    const finalID = sd?.IDKunjungan || sd?.id_kunjungan || sd?.ID || sj?.IDKunjungan || route.query.id || null;
    const finalTanggal = sd?.Tanggal || sd?.tanggal || sj?.Tanggal || null;

    dataKunjungan.value = {
      ID: finalID,
      Kode: (route.query.kode_customer || '').trim(),
      Nama: (sj?.Nama || sd?.Nama || route.query.nama_toko || 'Toko Tanpa Nama').trim(),
      Alamat: (sj?.Alamat || sd?.Alamat || route.query.alamat || 'Alamat tidak tersedia').trim(),
      Tanggal: finalTanggal,
      Alasan: sd?.Alasan || sd?.alasan || sj?.Alasan || null,
      CheckOut: sd?.CheckOut ?? sd?.checkout ?? sj?.CheckOut ?? 1
    };

    console.log("✅ Final Kode customer yang akan dikirim:", route.query.kode_customer);
    console.log("✅ Final ID Kunjungan:", finalID);

    if (dataKunjungan.value.Kode) {
      await syncReasonFromDatabase(dataKunjungan.value.Kode);
    }

    const parsedStart = normalizeDate(dataKunjungan.value.Tanggal);
    if (parsedStart) startTime.value = parsedStart;

  } catch (error) {
    console.error('❌ Error Fetching:', error);
  } finally {
    loading.value = false;
  }
};

const syncReasonFromDatabase = async (kode) => {
  try {
    const res = await api.get('/api/kunjungan/cek-alasan', {
      params: {
        kode_customer: kode,
        id_kunjungan: dataKunjungan.value?.ID || ''
      }
    });
    
    if (res.data?.is_exists && dataKunjungan.value) {
      const reasonText = res.data.alasan;
      dataKunjungan.value.Alasan = reasonText;

      const found = listAlasan.value.find(r => 
        r.nama_alasan.trim().toLowerCase() === String(reasonText || '').trim().toLowerCase()
      );

      selectedReason.value = found || { id: 999, nama_alasan: reasonText };
    }
  } catch (e) {
    console.warn('Reason Sync Failed');
  }
};

const handleReasonSelection = async (reason) => {
  if (!dataKunjungan.value) return;
  
  // Jika sudah ada alasan sebelumnya, panggil EDIT, jika belum panggil SAVE
  if (dataKunjungan.value.Alasan) {
    await apiAction('/api/kunjungan/edit-alasan', {
      IDKunjungan: dataKunjungan.value.ID,
      KodeCustomer: dataKunjungan.value.Kode,
      AlasanNoOrder: reason.nama_alasan
    }, reason);
  } else {
    await apiAction('/api/kunjungan/save-reason', {
      IDKunjungan: dataKunjungan.value.ID,
      Kode: dataKunjungan.value.Kode,
      Alasan: '', // Flag untuk API
      AlasanNoOrder: reason.nama_alasan
    }, reason);
  }
};

const apiAction = async (url, payload, reasonObj) => {
  try {
    loadingCheckout.value = true;
    const method = url.includes('save-reason') ? 'post' : 'put';
    const res = await api[method](url, payload);
    
    if (res.data?.success) {
      selectedReason.value = reasonObj;
      dataKunjungan.value.Alasan = reasonObj.nama_alasan;
      showReasonModal.value = false;
      Swal.fire({ icon: 'success', title: 'Data Disimpan', timer: 1000, showConfirmButton: false });
    }
  } catch (e) {
    Swal.fire('Error', 'Gagal memproses data ke server', 'error');
  } finally {
    loadingCheckout.value = false;
  }
};

const resetReason = async () => {
  try {
    const res = await api.delete('/api/kunjungan/hapus-alasan', {
      params: {
        KodeCustomer: dataKunjungan.value.Kode,
        IDKunjungan: dataKunjungan.value.ID
      }
    });

    if (res.data?.success) {
      selectedReason.value = null;
      dataKunjungan.value.Alasan = null;
      showReasonModal.value = false;
      Swal.fire({ icon: 'success', title: 'Alasan Dihapus', timer: 1000, showConfirmButton: false });
    }
  } catch (e) {
    Swal.fire('Gagal', 'Gagal menghapus data', 'error');
  }
};

const navigateTo = (menuName) => {
  if (!dataKunjungan.value) return;

  const baseQuery = {
    id_kunjungan: dataKunjungan.value.ID || route.query.id_kunjungan || route.query.id || '',
    kode_customer: dataKunjungan.value.Kode,
    nama_toko: dataKunjungan.value.Nama,
    id_plafon: dataKunjungan.value.IDPlafon || route.query.id_plafon || route.query.IDPlafon || '',
    visit_state: 'selesai',
  };

  if (menuName === 'Riwayat') {
    router.push({
      path: '/visit-history',
      query: baseQuery
    });
  } else if (menuName === 'StokOpname') {
    // Validasi ID Kunjungan sangat penting di sini
    if (!baseQuery.id_kunjungan) {
      Swal.fire('ID Tidak Ditemukan', 'ID Kunjungan belum tersinkronisasi. Silakan refresh halaman.', 'warning');
      return;
    }
    router.push({
      path: '/pagestok-opname',
      query: baseQuery
    });
  } else if (menuName === 'Retur') {
    // Validasi ID Kunjungan sangat penting di sini
    if (!baseQuery.id_kunjungan) {
      Swal.fire('ID Tidak Ditemukan', 'ID Kunjungan belum tersinkronisasi. Silakan refresh halaman.', 'warning');
      return;
    }
    router.push({
      path: '/pageretur-barang',
      query: baseQuery
    });
  }
};

watch(() => route.query.kode_customer, () => fetchKunjunganAktif());

onMounted(() => {
  fetchKunjunganAktif();
  timerInterval = setInterval(() => { now.value = new Date(); }, 30000);
});

onUnmounted(() => { if (timerInterval) clearInterval(timerInterval); });
</script>

<style scoped>
.bg-gradient-red {
  background: linear-gradient(135deg, #f87171, #dc2626);
  color: white;
}

.active-container { 
  display: flex; 
  flex-direction: column; 
  height: 100vh; 
  background-color: #f4f7fa; 
  font-family: 'Plus Jakarta Sans', sans-serif; 
}

.header-modern { 
  background: white; 
  padding: 15px 20px 20px; 
  border-radius: 0 0 30px 30px; 
  box-shadow: 0 10px 30px rgba(0,0,0,0.03); 
  z-index: 10;
}
.header-content { display: flex; align-items: center; gap: 15px; }
.btn-blur-back { 
  width: 44px; height: 44px; border-radius: 14px; border: none; 
  background: #f1f2f6; font-size: 1.8rem; color: #2d3436;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.2s;
}
.btn-blur-back:active { transform: scale(0.9); }
.app-version { font-size: 0.65rem; color: #95a5a6; font-weight: 700; letter-spacing: 1px; }
.header-title h3 { margin: 0; font-size: 1.2rem; color: #2d3436; font-weight: 800; }

.main-content { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }

.highlight-card { 
  position: relative;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%);
  color: white; 
  padding: 25px; 
  border-radius: 28px; 
  overflow: hidden;
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.18);
}
.card-bg-pattern {
  position: absolute; top: -20%; right: -10%; width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%);
}
.badge-status { 
  background: rgba(255,255,255,0.12); 
  padding: 4px 12px; 
  border-radius: 100px; 
  font-size: 0.6rem; 
  font-weight: 800; 
  letter-spacing: 1.5px;
  backdrop-filter: blur(5px);
}
.store-name { margin: 15px 0 5px; font-size: 1.5rem; font-weight: 800; line-height: 1.2; }
.store-address { font-size: 0.85rem; color: #cbd5e1; opacity: 0.95; margin: 0; }
.store-stats { 
  display: flex; align-items: center; margin-top: 25px; padding-top: 15px; 
  border-top: 1px solid rgba(255,255,255,0.1); 
}
.stat-item small { display: block; font-size: 0.6rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px; letter-spacing: 0.6px; }
.stat-value { font-size: 0.9rem; font-weight: 700; }
.timer-text { font-size: 1.1rem; font-weight: 800; color: #38bdf8; }
.stat-divider { width: 1px; height: 30px; background: rgba(255,255,255,0.1); margin: 0 25px; }

.visit-reason-banner {
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(251, 191, 36, 0.12) 100%);
  border: 1px solid rgba(251, 191, 36, 0.35);
  backdrop-filter: blur(6px);
}

.reason-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.14);
  color: #fde68a;
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}

.visit-reason-banner p {
  margin: 10px 0 0;
  font-size: 0.82rem;
  line-height: 1.55;
  color: #f8fafc;
  font-weight: 600;
}

.action-grid-modern { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; align-items: stretch; }
.action-card { 
  background: white; 
  padding: 22px 18px; 
  border-radius: 24px; 
  border: 2px solid transparent; 
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
  position: relative;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05);
  min-height: 148px;
  display: flex;
  flex-direction: column;
}
.card-active { 
  border-color: #00b894; 
  background: #f0fff4; 
  transform: translateY(-3px);
  box-shadow: 0 14px 24px rgba(0, 184, 148, 0.12);
}
.card-icon { 
  width: 48px; height: 48px; border-radius: 16px; 
  display: flex; align-items: center; justify-content: center; 
  font-size: 1.4rem; margin-bottom: 12px; 
}
.card-info h4 { margin: 0 0 4px; font-size: 1rem; color: #2d3436; font-weight: 700; }
.card-info p { margin: 0; font-size: 0.75rem; color: #636e72; font-weight: 500; line-height: 1.45; }
.reason-text { font-weight: 700 !important; color: #0f766e !important; }

.bg-gradient-blue { background: linear-gradient(135deg, #74b9ff, #0984e3); color: white; }
.bg-gradient-green { background: linear-gradient(135deg, #55efc4, #00b894); color: white; }
.bg-gradient-gray { background: #f1f2f6; color: #b2bec3; }
.bg-gradient-orange { background: linear-gradient(135deg, #fdcb6e, #e17055); color: white; }
.shadow-green { box-shadow: 0 8px 15px rgba(0, 184, 148, 0.2); }

.bottom-sheet-overlay { 
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); 
  backdrop-filter: blur(4px); z-index: 2000; 
  display: flex; align-items: flex-end; 
}
.bottom-sheet { 
  background: white; 
  width: 100%; 
  border-radius: 35px 35px 0 0; 
  padding: 20px 24px 30px; 
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}
.reason-grid, .reason-list-container { 
  display: flex; 
  flex-direction: column; 
  gap: 12px; 
  margin: 20px 0;
  overflow-y: auto;
  flex: 1;
  padding-bottom: 20px;
}
.reason-grid::-webkit-scrollbar {
  display: none;
}
.sheet-handle { 
  width: 40px; height: 5px; background: #dfe6e9; 
  border-radius: 10px; margin: 0 auto 20px; 
}
.sheet-header h3 { font-size: 1.3rem; margin: 0 0 5px; font-weight: 800; }
.sheet-header p { font-size: 0.85rem; color: #636e72; margin-bottom: 25px; }

.reason-list-container { display: flex; flex-direction: column; gap: 12px; margin-bottom: 30px; }
.reason-item { 
  padding: 18px; border-radius: 20px; border: 2px solid #f1f2f6;
  display: flex; align-items: center; justify-content: space-between;
  transition: all 0.2s;
}
.active-reason { border-color: #1a1a3d; background: #f8f9ff; }
.reason-name { font-weight: 700; font-size: 0.95rem; }
.reason-checkbox { 
  width: 24px; height: 24px; border-radius: 50%; border: 2px solid #dfe6e9; 
  display: flex; align-items: center; justify-content: center;
}
.reason-checkbox.checked { border-color: #1a1a3d; background: #1a1a3d; }
.check-inner { width: 8px; height: 8px; background: white; border-radius: 50%; transform: scale(0); transition: 0.2s; }
.checked .check-inner { transform: scale(1); }

.sheet-footer { display: flex; align-items: center; justify-content: space-between; gap: 15px; }
.btn-text-danger { background: none; border: none; color: #ff7675; font-weight: 700; font-size: 0.9rem; }
.btn-sheet-close { 
  flex: 1; height: 54px; border-radius: 16px; border: none;
  background: #f1f2f6; color: #2d3436; font-weight: 700;
}

.sheet-slide-enter-active, .sheet-slide-leave-active { transition: opacity 0.3s; }
.sheet-slide-enter-from, .sheet-slide-leave-to { opacity: 0; }
.sheet-slide-enter-active .bottom-sheet { animation: slideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
.sheet-slide-leave-active .bottom-sheet { animation: slideIn 0.3s reverse cubic-bezier(0.4, 0, 0.2, 1); }

@keyframes slideIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes bounceIn { 
  0% { transform: scale(0.9); opacity: 0; }
  70% { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
}

.mini-spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.ripple:active { background-color: rgba(0,0,0,0.05); }

:global(:root[data-theme='dark']) .active-container,
:global(:root[data-theme='dark']) .main-content {
  background: #000814 !important;
}

:global(:root[data-theme='dark']) .header-modern,
:global(:root[data-theme='dark']) .action-card,
:global(:root[data-theme='dark']) .bottom-sheet {
  background: linear-gradient(180deg, #030712 0%, #0a1020 100%) !important;
  border: 1px solid rgba(30, 41, 59, 0.95) !important;
  box-shadow: 0 20px 38px rgba(0, 0, 0, 0.42) !important;
}

:global(:root[data-theme='dark']) .btn-blur-back,
:global(:root[data-theme='dark']) .reason-item,
:global(:root[data-theme='dark']) .btn-sheet-close {
  background: #020617 !important;
  border-color: rgba(51, 65, 85, 0.92) !important;
  color: #f1f5f9 !important;
}

:global(:root[data-theme='dark']) .header-title h3,
:global(:root[data-theme='dark']) .card-info h4,
:global(:root[data-theme='dark']) .store-name,
:global(:root[data-theme='dark']) .sheet-header h3,
:global(:root[data-theme='dark']) .reason-name {
  color: #f1f5f9 !important;
}

:global(:root[data-theme='dark']) .app-version,
:global(:root[data-theme='dark']) .card-info p,
:global(:root[data-theme='dark']) .sheet-header p,
:global(:root[data-theme='dark']) .stat-item small,
:global(:root[data-theme='dark']) .store-address {
  color: #9fb0c7 !important;
}

:global(:root[data-theme='dark']) .highlight-card {
  box-shadow: 0 22px 42px rgba(0, 0, 0, 0.5) !important;
}

:global(:root[data-theme='dark']) .card-active {
  border-color: rgba(45, 212, 191, 0.42) !important;
  background: linear-gradient(180deg, rgba(6, 78, 59, 0.28), rgba(3, 7, 18, 0.96)) !important;
  box-shadow: 0 18px 30px rgba(13, 148, 136, 0.14) !important;
}

:global(:root[data-theme='dark']) .bg-gradient-gray {
  background: #111827 !important;
  color: #64748b !important;
}

:global(:root[data-theme='dark']) .sheet-handle,
:global(:root[data-theme='dark']) .reason-checkbox {
  background: #1e293b !important;
  border-color: #334155 !important;
}

:global(:root[data-theme='dark']) .active-reason {
  border-color: #2563eb !important;
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.18), rgba(3, 7, 18, 0.98)) !important;
}

:global(:root[data-theme='dark']) .reason-checkbox.checked {
  border-color: #60a5fa !important;
  background: #2563eb !important;
}

:global(:root[data-theme='dark']) .btn-text-danger {
  color: #fca5a5 !important;
}
</style>

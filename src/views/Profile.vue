<template>
  <main class="sales-ui sales-document-page sales-v2">
    <SalesPageHeader title="Profile" eyebrow="Akun Sales" :subtitle="network.isOnline ? 'Terhubung ke internet' : 'Mode offline'" />
    <div class="sales-page-content">
      <p v-if="loading" role="status" class="sales-empty">Memuat profil…</p>
      <p v-if="profileError" role="alert" class="sales-notice warning">{{ profileError }}</p>
      <template v-if="!loading">
        <section class="sales-surface sales-profile-identity"><span class="sales-profile-avatar">{{ initialName }}</span><div><h2>{{ profileData.Nama }}</h2><p class="sales-muted">{{ profileData.Kode }} · {{ profileData.Type }}</p></div></section>
        <section class="sales-surface">
          <div class="sales-section-title"><h2>Informasi akun</h2><span class="sales-pill" :class="fromServer ? 'success' : 'warning'">{{ fromServer ? 'Data server' : 'Data tersimpan' }}</span></div>
          <dl class="sales-kv-list"><div><dt>Cabang / principal</dt><dd>{{ profileData.NamaPrinciple }}</dd></div><div><dt>Jabatan / tipe sales</dt><dd>{{ profileData.JenisITR }}</dd></div><div><dt>Wilayah</dt><dd>{{ profileData.Kota }}</dd></div><div><dt>Alamat</dt><dd>{{ profileData.Alamat }}</dd></div><div><dt>Kode principal</dt><dd>{{ profileData.KodePrinciple || '-' }}</dd></div></dl>
        </section>
        <section class="sales-surface"><h2>Preferensi tampilan</h2><label class="sales-form-label">Tema aplikasi<select class="sales-input" :value="theme.mode" @change="theme.setTheme($event.target.value)"><option value="light">Terang</option><option value="dark">Gelap</option></select></label><p class="sales-muted">Pilihan tema berlaku di semua halaman.</p></section>
        <div class="sales-link-list"><button class="sales-button" @click="fetchProfile">Muat ulang profil</button><button class="sales-button" @click="handleLogout"><font-awesome-icon icon="sign-out-alt" /> Keluar dari akun</button></div>
      </template>
    </div>
  </main></template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/api/axios'
import Swal from 'sweetalert2'
import SalesPageHeader from '@/components/SalesPageHeader.vue'
import { useConnectivityStore } from '@/stores/connectivity'
import { useThemeStore } from '@/stores/theme'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(true)
const profileData = ref({})
const network = useConnectivityStore(), theme = useThemeStore()
const profileError = ref(''), fromServer = ref(false)

const initialName = computed(() => {
  const name = String(profileData.value.Nama || '-').trim()
  return name ? name.charAt(0).toUpperCase() : '-'
})

const primaryDescriptor = computed(() => {
  const principal = String(profileData.value.NamaPrinciple || '-').trim()
  const role = String(profileData.value.JenisITR || '-').trim()
  return [principal, role].filter(Boolean).join(' • ')
})

const fetchProfile = async () => {
  try {
    loading.value = true
    profileError.value = ''

    const response = await api.get('/api/profile/me')
    const raw = response.data || {}

    profileData.value = {
      ...raw,
      Nama: raw.Nama || raw.nama || '-',
      Kode: raw.Kode || raw.sales?.id || '-',
      KodePrinciple: raw.KodePrinciple || raw.kode_principal || raw.sales?.kode_principal || '-',
      NamaPrinciple:
        raw.NamaPrinciple ||
        raw.nama_cabang ||
        raw.sales?.nama_cabang ||
        '-',
      JenisITR:
        raw.JenisITR ||
        raw.nama_jabatan ||
        raw.sales?.nama_jabatan ||
        '-',
      Kota: raw.Kota || raw.nama_cabang || '-',
      Alamat: raw.Alamat || raw.alamat || '-',
      Type: raw.Type || raw.role || '-'
    }
    fromServer.value = true
  } catch (error) {
    console.error('Gagal mengambil data profil:', error)
    profileError.value = 'Profil terbaru belum dapat dimuat. Informasi akun tersimpan ditampilkan sementara.'
    fromServer.value = false
    if (!profileData.value.Nama) profileData.value = { Nama: auth.user?.nama || auth.user?.Nama || '-', Kode: auth.user?.kode || auth.user?.id_sales || '-', NamaPrinciple: auth.user?.nama_cabang || '-', JenisITR: auth.user?.nama_tipe_sales || auth.user?.role || '-', Kota: '-', Alamat: '-', Type: auth.user?.role || '-' }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  fetchProfile()
})

const handleLogout = () => {
  Swal.fire({
    title: 'Keluar Akun?',
    text: 'Sesi Anda akan berakhir.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    confirmButtonText: 'Ya, Keluar',
    cancelButtonText: 'Batal'
  }).then(async (result) => {
    if (result.isConfirmed) {
      await auth.logout()
      router.replace('/login')
    }
  })
}
</script>



<style>
html[data-theme='dark'] .profile-container,
body[data-theme='dark'] .profile-container {
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.12), transparent 24%),
    linear-gradient(180deg, #000814 0%, #020617 100%) !important;
}

html[data-theme='dark'] .profile-container :is(
  .profile-header,
  .summary-card,
  .detail-card,
  .support-card,
  .detail-item,
  .support-item
),
body[data-theme='dark'] .profile-container :is(
  .profile-header,
  .summary-card,
  .detail-card,
  .support-card,
  .detail-item,
  .support-item
) {
  background: linear-gradient(180deg, #030712 0%, #0a1020 100%) !important;
  background-color: #030712 !important;
  border-color: rgba(51, 65, 85, 0.92) !important;
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.38) !important;
}

html[data-theme='dark'] .profile-container :is(.btn-back, .header-status, .section-badge, .icon),
body[data-theme='dark'] .profile-container :is(.btn-back, .header-status, .section-badge, .icon) {
  background: #0f172a !important;
  background-color: #0f172a !important;
  border-color: rgba(71, 85, 105, 0.9) !important;
  color: #f8fafc !important;
}

html[data-theme='dark'] .profile-container .btn-logout,
body[data-theme='dark'] .profile-container .btn-logout {
  background: linear-gradient(135deg, rgba(127, 29, 29, 0.36), rgba(76, 5, 25, 0.34)) !important;
  background-color: #450a0a !important;
  border-color: rgba(251, 113, 133, 0.32) !important;
  color: #fecdd3 !important;
}

html[data-theme='dark'] .profile-container :is(
  .header-title,
  .user-name,
  .summary-card strong,
  .section-heading h4,
  .detail-item strong,
  .support-item strong,
  .btn-logout span
),
body[data-theme='dark'] .profile-container :is(
  .header-title,
  .user-name,
  .summary-card strong,
  .section-heading h4,
  .detail-item strong,
  .support-item strong,
  .btn-logout span
) {
  color: #f8fafc !important;
}

html[data-theme='dark'] .profile-container :is(
  .summary-label,
  .section-label,
  .detail-item label,
  .support-label,
  .hero-label,
  .user-role
),
body[data-theme='dark'] .profile-container :is(
  .summary-label,
  .section-label,
  .detail-item label,
  .support-label,
  .hero-label,
  .user-role
) {
  color: #cbd5e1 !important;
}
</style>

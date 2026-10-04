<template>
  <div class="profile-container">
    <header class="profile-header">
      <button @click="router.push('/dashboard')" class="btn-back" aria-label="Kembali" title="Kembali">
        <span><font-awesome-icon icon="chevron-left" /></span>
      </button>
      <div class="header-copy">
        <span class="eyebrow">Akun Sales</span>
        <h3 class="header-title">Profil Pengguna</h3>
      </div>
      <div class="header-status">
        <span class="status-dot"></span>
        <span>Aktif</span>
      </div>
    </header>

    <div v-if="loading" class="loader-container card-shell">
      <div class="spinner"></div>
      <p>Memuat profil pengguna...</p>
    </div>

    <div v-else class="page-content animate-up">
      <section class="hero-card">
        <div class="hero-top">
          <div class="avatar-wrapper">
            <div class="avatar-placeholder">{{ initialName }}</div>
            <div class="badge-online"></div>
          </div>

          <div class="hero-main">
            <span class="hero-label">Budimas Mobile Sales</span>
            <h2 class="user-name">{{ profileData.Nama }}</h2>
            <p class="user-role">{{ primaryDescriptor }}</p>
          </div>
        </div>

        <div class="hero-meta">
          <div class="meta-pill">
            <span>Kode Sales</span>
            <strong>{{ profileData.Kode }}</strong>
          </div>
          <div class="meta-pill subtle">
            <span>Tipe Akun</span>
            <strong>{{ profileData.Type }}</strong>
          </div>
        </div>
      </section>

      <section class="summary-grid">
        <div class="summary-card">
          <span class="summary-label">Principal</span>
          <strong>{{ profileData.NamaPrinciple }}</strong>
        </div>
        <div class="summary-card">
          <span class="summary-label">Jabatan</span>
          <strong>{{ profileData.JenisITR }}</strong>
        </div>
        <div class="summary-card">
          <span class="summary-label">Wilayah</span>
          <strong>{{ profileData.Kota }}</strong>
        </div>
      </section>

      <section class="detail-card card-shell">
        <div class="section-heading">
          <div>
            <span class="section-label">Informasi Utama</span>
            <h4>Data Pengguna</h4>
          </div>
          <span class="section-badge">Tersinkron</span>
        </div>

        <div class="detail-list">
          <div class="detail-item">
            <label>Nama Lengkap</label>
            <strong>{{ profileData.Nama }}</strong>
          </div>
          <div class="detail-item">
            <label>Principal / Cabang</label>
            <strong>{{ profileData.NamaPrinciple }}</strong>
          </div>
          <div class="detail-item">
            <label>Jabatan</label>
            <strong>{{ profileData.JenisITR }}</strong>
          </div>
          <div class="detail-item">
            <label>Wilayah Kerja</label>
            <strong>{{ profileData.Kota }}</strong>
          </div>
          <div class="detail-item">
            <label>Alamat</label>
            <strong class="multiline">{{ profileData.Alamat }}</strong>
          </div>
          <div class="detail-item">
            <label>Tipe User</label>
            <strong>{{ profileData.Type }}</strong>
          </div>
        </div>
      </section>

      <section class="support-card card-shell">
        <div class="section-heading compact">
          <div>
            <span class="section-label">Akses</span>
            <h4>Status Akun</h4>
          </div>
        </div>

        <div class="support-grid">
          <div class="support-item">
            <span class="support-label">Status Login</span>
            <strong>Online</strong>
          </div>
          <div class="support-item">
            <span class="support-label">Kode Principal</span>
            <strong>{{ profileData.KodePrinciple || '-' }}</strong>
          </div>
        </div>
      </section>

      <section class="profile-menu">
        <button class="btn-logout" @click="handleLogout">
          <font-awesome-icon class="icon" icon="sign-out-alt" />
          <span>Akhiri Sesi</span>
        </button>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/api/axios'
import Swal from 'sweetalert2'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(true)
const profileData = ref({})

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
  } catch (error) {
    console.error('Gagal mengambil data profil:', error)
    Swal.fire('Error', 'Gagal memuat data profil dari server.', 'error')
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

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

.profile-container {
  min-height: 100vh;
  padding: 20px 16px 42px;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 24%),
    linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%);
  font-family: 'Plus Jakarta Sans', sans-serif;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.btn-back {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  color: #0f172a;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
  cursor: pointer;
  flex-shrink: 0;
}

.header-copy {
  flex: 1;
  min-width: 0;
}

.eyebrow {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #2563eb;
  margin-bottom: 4px;
}

.header-title {
  margin: 0;
  font-size: 1.2rem;
  color: #0f172a;
  font-weight: 800;
}

.header-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #dbe7f5;
  color: #0f172a;
  font-size: 0.72rem;
  font-weight: 800;
  flex-shrink: 0;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.14);
}

.page-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-shell {
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 24px;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.06);
}

.hero-card {
  padding: 18px;
  border-radius: 26px;
  background: linear-gradient(135deg, #0f172a, #1d4ed8);
  color: #fff;
  box-shadow: 0 18px 42px rgba(29, 78, 216, 0.22);
}

.hero-top {
  display: flex;
  align-items: center;
  gap: 14px;
}

.avatar-wrapper {
  position: relative;
  width: 78px;
  height: 78px;
  flex-shrink: 0;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: 2rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(6px);
}

.badge-online {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #22c55e;
  border: 3px solid #fff;
}

.hero-main {
  min-width: 0;
}

.hero-label {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.8;
  margin-bottom: 6px;
}

.user-name {
  margin: 0;
  font-size: 1.24rem;
  line-height: 1.25;
  font-weight: 800;
}

.user-role {
  margin: 6px 0 0;
  font-size: 0.82rem;
  line-height: 1.45;
  opacity: 0.86;
}

.hero-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.meta-pill {
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.meta-pill.subtle {
  background: rgba(255, 255, 255, 0.08);
}

.meta-pill span {
  display: block;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.78;
  margin-bottom: 5px;
}

.meta-pill strong {
  display: block;
  font-size: 0.88rem;
  font-weight: 800;
  line-height: 1.3;
  word-break: break-word;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.summary-card {
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 14px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  min-width: 0;
}

.summary-label {
  display: block;
  font-size: 0.68rem;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 6px;
}

.summary-card strong {
  display: block;
  color: #0f172a;
  font-size: 0.9rem;
  line-height: 1.35;
  font-weight: 800;
  word-break: break-word;
}

.detail-card,
.support-card {
  padding: 18px;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.section-heading h4 {
  margin: 4px 0 0;
  font-size: 1rem;
  color: #0f172a;
  font-weight: 800;
}

.section-label {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #2563eb;
}

.section-badge {
  padding: 7px 10px;
  border-radius: 999px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  font-size: 0.68rem;
  font-weight: 800;
  flex-shrink: 0;
}

.detail-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.detail-item {
  padding: 13px 14px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.detail-item label,
.support-label {
  display: block;
  font-size: 0.66rem;
  font-weight: 800;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}

.detail-item strong,
.support-item strong {
  display: block;
  font-size: 0.9rem;
  font-weight: 800;
  line-height: 1.45;
  color: #0f172a;
}

.multiline {
  white-space: normal;
}

.support-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.support-item {
  padding: 13px 14px;
  border-radius: 18px;
  background: linear-gradient(135deg, #f8fafc, #eff6ff);
  border: 1px solid #dbe7f5;
}

.profile-menu {
  padding-top: 4px;
}

.btn-logout {
  width: 100%;
  padding: 16px 18px;
  border-radius: 20px;
  border: 1px solid #fecdd3;
  background: linear-gradient(135deg, #fff1f2, #ffe4e6);
  color: #be123c;
  font-weight: 800;
  font-size: 0.92rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(190, 24, 93, 0.08);
}

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.64);
  font-size: 0.76rem;
}

.loader-container {
  text-align: center;
  padding: 42px 20px;
  color: #64748b;
}

.spinner {
  width: 34px;
  height: 34px;
  border: 3px solid #dbeafe;
  border-top-color: #1d4ed8;
  border-radius: 50%;
  margin: 0 auto 12px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 420px) {
  .profile-container {
    padding-inline: 14px;
  }

  .profile-header {
    align-items: flex-start;
  }

  .header-status {
    padding-inline: 10px;
  }

  .hero-top {
    align-items: flex-start;
  }

  .hero-meta,
  .summary-grid,
  .support-grid {
    grid-template-columns: 1fr;
  }

  .btn-logout {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
}

:global(:root[data-theme='dark']) .profile-container {
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.1), transparent 24%),
    linear-gradient(180deg, #000814 0%, #020617 100%) !important;
}

:global(:root[data-theme='dark']) .profile-header,
:global(:root[data-theme='dark']) .summary-card,
:global(:root[data-theme='dark']) .detail-card,
:global(:root[data-theme='dark']) .support-card {
  background: linear-gradient(180deg, #030712 0%, #0a1020 100%) !important;
  border-color: rgba(30, 41, 59, 0.95) !important;
  box-shadow: 0 20px 36px rgba(0, 0, 0, 0.42) !important;
}

:global(:root[data-theme='dark']) .btn-back,
:global(:root[data-theme='dark']) .header-status {
  background: rgba(15, 23, 42, 0.92) !important;
  border: 1px solid rgba(51, 65, 85, 0.92) !important;
  color: #f8fafc !important;
  box-shadow: 0 14px 26px rgba(0, 0, 0, 0.36) !important;
}

:global(:root[data-theme='dark']) .header-title,
:global(:root[data-theme='dark']) .user-name {
  color: #f8fafc !important;
}

:global(:root[data-theme='dark']) .eyebrow {
  color: #93c5fd !important;
}

:global(:root[data-theme='dark']) .hero-card {
  box-shadow: 0 24px 44px rgba(0, 0, 0, 0.5) !important;
}

:global(:root[data-theme='dark']) .avatar-placeholder,
:global(:root[data-theme='dark']) .meta-pill {
  background: rgba(15, 23, 42, 0.34) !important;
  border-color: rgba(148, 163, 184, 0.22) !important;
}

:global(:root[data-theme='dark']) .badge-online {
  border-color: #0f172a !important;
}

:global(:root[data-theme='dark']) .summary-label,
:global(:root[data-theme='dark']) .section-label,
:global(:root[data-theme='dark']) .detail-item label,
:global(:root[data-theme='dark']) .support-label,
:global(:root[data-theme='dark']) .loader-container,
:global(:root[data-theme='dark']) .hero-label,
:global(:root[data-theme='dark']) .user-role {
  color: #9fb0c7 !important;
}

:global(:root[data-theme='dark']) .summary-card strong,
:global(:root[data-theme='dark']) .section-heading h4,
:global(:root[data-theme='dark']) .detail-item strong,
:global(:root[data-theme='dark']) .support-item strong {
  color: #f1f5f9 !important;
}

:global(:root[data-theme='dark']) .section-badge {
  background: rgba(37, 99, 235, 0.14) !important;
  border-color: rgba(96, 165, 250, 0.28) !important;
  color: #93c5fd !important;
}

:global(:root[data-theme='dark']) .detail-item,
:global(:root[data-theme='dark']) .support-item {
  background: #020617 !important;
  border-color: rgba(51, 65, 85, 0.92) !important;
}

:global(:root[data-theme='dark']) .btn-logout {
  background: linear-gradient(135deg, rgba(127, 29, 29, 0.22), rgba(76, 5, 25, 0.2)) !important;
  border-color: rgba(244, 114, 182, 0.2) !important;
  color: #fecdd3 !important;
  box-shadow: 0 14px 26px rgba(76, 5, 25, 0.28) !important;
}

:global(:root[data-theme='dark']) .icon {
  background: rgba(15, 23, 42, 0.7) !important;
  color: #fda4af !important;
}

:global(:root[data-theme='dark']) .spinner {
  border-color: #1e293b !important;
  border-top-color: #60a5fa !important;
}
</style>

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

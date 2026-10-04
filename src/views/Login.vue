<template>
  <div class="login-wrapper">
    <div class="bg-decoration"></div>

    <div class="login-card">
      <div class="brand-section">
        <div class="brand-logo">
          <img src="@/assets/logo.png" alt="Budimas Logo" class="logo-image" />
        </div>
        <h1 class="brand-title">Budimas <span class="thin">Mobile</span></h1>
        <p class="brand-subtitle">Enterprise Resource Planning System</p>
      </div>

      <div class="form-container">
        <div class="input-group">
          <label class="input-label">Identity Access</label>
          <div class="input-field-wrapper">
            <span class="input-icon">👤</span>
            <input
              v-model="form.qrcode"
              ref="usernameInput"
              type="text"
              autofocus
              placeholder="Email sales atau akses mobile"
              :disabled="auth.loading"
              @keyup.enter="focusPassword"
            />
          </div>
        </div>

        <div class="input-group">
          <label class="input-label">Security Key</label>
          <div class="input-field-wrapper">
            <span class="input-icon">🔒</span>
            <input
              v-model="form.password"
              type="password"
              ref="passwordInput"
              placeholder="Enter your password"
              :disabled="auth.loading"
              @keyup.enter="handleLogin"
            />
          </div>
        </div>

        <button
          class="btn-primary"
          :class="{ 'btn-loading': auth.loading }"
          @click="handleLogin"
          :disabled="auth.loading"
        >
          <span v-if="!auth.loading">AUTHENTICATE SESSION</span>
          <div v-else class="loader-dots">
            <span></span><span></span><span></span>
          </div>
        </button>
      </div>

      <footer class="login-footer">
        <div class="version-tag">Build v1.0.4.2026</div>
        <div class="company-name">PT BUDIMAS MAKMUR MULIA</div>
        <div class="legal-text">Secure Encrypted Connection</div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, reactive, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import Swal from 'sweetalert2';

const auth = useAuthStore();
const router = useRouter();
const usernameInput = ref(null);
const passwordInput = ref(null);

const form = reactive({
  qrcode: '',
  password: ''
});

const focusPassword = () => {
  passwordInput.value?.focus();
};

onMounted(async () => {
  await nextTick();
  setTimeout(() => {
    usernameInput.value?.focus();
  }, 120);
});

const handleLogin = async () => {
  const qrcode = form.qrcode?.trim();
  const password = form.password?.trim();

  if (!qrcode || !password) {
    await Swal.fire('Error', 'Username dan Password wajib diisi terlebih dahulu.', 'error');
    return;
  }

  try {

    const result = await auth.login(qrcode, password);

    if (result.success) {
      if (result.isOffline) {
        await Swal.fire({
          icon: 'warning',
          title: 'Mode Offline',
          text: 'Masuk menggunakan data lokal.',
          timer: 1800,
          showConfirmButton: false
        });
      } else {
        await Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: 'Login berhasil.',
          timer: 1200,
          showConfirmButton: false
        });
      }

      form.qrcode = '';
      form.password = '';

      await router.push('/dashboard');
      return;
    }

    await Swal.fire('Gagal', result.message || 'Login gagal', 'error');
  } catch (err) {
    console.error('Handle login error:', err);
    await Swal.fire('Error', err?.message || 'Kesalahan sistem saat login.', 'error');
  }
};
</script>

<style scoped>
.brand-logo {
  width: 64px;
  height: 64px;
  background: #ffffff;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  box-shadow: 0 12px 20px -8px rgba(30, 27, 75, 0.15);
  padding: 10px;
  overflow: hidden;
}

.logo-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.login-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fdfdfe;
  font-family: 'Plus Jakarta Sans', sans-serif;
  position: relative;
  overflow: hidden;
  padding: 24px;
}

.bg-decoration {
  position: absolute;
  top: -10%;
  right: -5%;
  width: 40%;
  height: 40%;
  background: radial-gradient(circle, rgba(79, 70, 229, 0.05) 0%, rgba(255, 255, 255, 0) 70%);
  z-index: 0;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  padding: 56px 40px;
  border-radius: 32px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.03), 0 0 1px 1px rgba(0, 0, 0, 0.02);
  z-index: 1;
  text-align: center;
}

.brand-section {
  margin-bottom: 48px;
}

.brand-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.025em;
  margin: 0;
}

.brand-title .thin {
  font-weight: 300;
  color: #64748b;
}

.brand-subtitle {
  font-size: 0.875rem;
  color: #94a3b8;
  margin-top: 8px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-weight: 600;
}

.form-container {
  text-align: left;
}

.input-group {
  margin-bottom: 24px;
}

.input-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.input-field-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 16px;
  font-size: 1rem;
  opacity: 0.4;
}

input {
  width: 100%;
  padding: 16px 16px 16px 48px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 16px;
  font-size: 1rem;
  color: #1e293b;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

input:focus {
  outline: none;
  background: #fff;
  border-color: #6366f1;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.08);
}

.btn-primary {
  width: 100%;
  padding: 18px;
  background: #1e1b4b;
  color: #fff;
  border: none;
  border-radius: 18px;
  font-size: 0.875rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-primary:hover {
  background: #312e81;
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(30, 27, 75, 0.2);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-primary:disabled {
  background: #94a3b8;
  cursor: not-allowed;
  transform: none;
}

.loader-dots {
  display: flex;
  gap: 4px;
}

.loader-dots span {
  width: 8px;
  height: 8px;
  background: #fff;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.loader-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.loader-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.login-footer {
  margin-top: 48px;
  border-top: 1px solid #f1f5f9;
  padding-top: 24px;
}

.version-tag {
  font-size: 0.65rem;
  color: #cbd5e1;
  font-weight: 700;
  margin-bottom: 8px;
}

.company-name {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 700;
  letter-spacing: 0.025em;
}

.legal-text {
  font-size: 0.6rem;
  color: #94a3b8;
  margin-top: 4px;
  text-transform: uppercase;
}

@media (max-width: 480px) {
  .login-card {
    padding: 40px 24px;
    border-radius: 24px;
  }
}

:deep(.swal2-popup) {
  font-family: 'Plus Jakarta Sans', sans-serif !important;
  border-radius: 24px !important;
  padding: 2em !important;
}

:deep(.swal2-title) {
  color: #1a1a3d !important;
  font-weight: 800 !important;
  letter-spacing: -0.02em !important;
}

:deep(.swal2-styled.swal2-confirm) {
  border-radius: 14px !important;
  padding: 12px 30px !important;
  font-weight: 700 !important;
  letter-spacing: 0.05em !important;
}

:deep(.swal2-timer-progress-bar) {
  background: #1a1a3d !important;
}

:global(:root[data-theme='dark']) .login-wrapper {
  background: linear-gradient(180deg, #020617 0%, #0f172a 100%);
}

:global(:root[data-theme='dark']) .login-card {
  background: #0f172a;
  border: 1px solid #334155;
  box-shadow: 0 25px 50px -18px rgba(2, 6, 23, 0.55);
}

:global(:root[data-theme='dark']) .brand-logo {
  background: #111827;
  box-shadow: 0 12px 20px -8px rgba(2, 6, 23, 0.45);
}

:global(:root[data-theme='dark']) .brand-title {
  color: #f8fafc;
}

:global(:root[data-theme='dark']) .brand-title .thin,
:global(:root[data-theme='dark']) .brand-subtitle,
:global(:root[data-theme='dark']) .input-label,
:global(:root[data-theme='dark']) .company-name,
:global(:root[data-theme='dark']) .legal-text,
:global(:root[data-theme='dark']) .version-tag {
  color: #94a3b8;
}

:global(:root[data-theme='dark']) input {
  background: #111827;
  border-color: #334155;
  color: #f8fafc;
}

:global(:root[data-theme='dark']) input:focus {
  background: #111827;
  border-color: #60a5fa;
  box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.12);
}

:global(:root[data-theme='dark']) .login-footer {
  border-top-color: #1f2937;
}

:global(:root[data-theme='dark']) .bg-decoration {
  background: radial-gradient(circle, rgba(59, 130, 246, 0.16) 0%, rgba(255, 255, 255, 0) 72%);
}
</style>

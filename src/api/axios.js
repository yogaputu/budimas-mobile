import axios from 'axios';
import { Preferences } from '@capacitor/preferences';
import { useAuthStore } from '@/stores/auth';
import { useConnectivityStore } from '@/stores/connectivity';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

/**
 * REQUEST INTERCEPTOR
 */
api.interceptors.request.use(async (config) => {
    const auth = useAuthStore();
    const connectivity = useConnectivityStore();

    const method = String(config.method || 'get').toLowerCase();

    if (!connectivity.isOnline && ['post', 'put', 'delete', 'patch'].includes(method)) {
        return Promise.reject({ isOffline: true, message: 'Unit sedang offline' });
    }

    try {
        let token = auth.token;
        let user = auth.user;

        if (!token || !user) {
            const [tRes, uRes] = await Promise.all([
                Preferences.get({ key: 'auth_token' }),
                Preferences.get({ key: 'user_data' })
            ]);

            token = tRes.value;
            user = uRes.value ? JSON.parse(uRes.value) : null;
        }

        if (token) {
            config.headers.Authorization = `Bearer ${token.trim()}`;
        }

        if (user) {
            const userId = user.id_user || user.id || ''
            const salesId = user.id_sales || user.Kode || ''

            config.headers['X-User-Id'] = userId      // 216 untuk kunjungan
            config.headers['X-Sales-Id'] = salesId    // 142 untuk profile
            config.headers['X-Sales-Kode'] = salesId
            config.headers['X-Principle-Kode'] = user.KodePrinciple || ''
        }

        config.params = { env: 'production', ...config.params };

        return config;
    } catch (error) {
        return config;
    }
}, (error) => Promise.reject(error));
/**
 * RESPONSE INTERCEPTOR
 */
api.interceptors.response.use(
  (response) => {
    const connectivity = useConnectivityStore();
    if (!connectivity.isOnline) {
      connectivity.setOnlineStatus(true);
    }
    return response;
  },
  async (error) => {
    const connectivity = useConnectivityStore();
    if (error?.isOffline) {
        return Promise.reject(error);
    }

    const { response, code, config } = error;
    const suppressOfflineStatus = !!config?.suppressOfflineStatus;

    if (response && !connectivity.isOnline) {
        connectivity.setOnlineStatus(true);
    }

    // --- LOGIC 1: AUTH EXPIRED (401) ---
    // Hanya lempar ke login jika Token benar-benar tidak sah/expired
    const requestUrl = String(response?.config?.url || '');
    const isLoginRequest = requestUrl.includes('/api/auth/sales/login') || requestUrl.includes('/api/login');

    if (response && response.status === 401 && !isLoginRequest) {
        console.warn("Token expired, baru boleh logout.");
        const auth = useAuthStore();
        await auth.logout();
        window.location.href = '/login';
        return Promise.reject(error);
    }

    // --- LOGIC 2: GAGAL KONEKSI (Server Mati / Sinyal Hilang) ---
    // JANGAN DI-LOGOUT. Cukup update status store saja.
    if (!response || code === 'ECONNABORTED' || error.message === 'Network Error') {
        console.error("📡 Masalah jaringan terdeteksi.");
        
        // Update store agar dashboard muncul banner orange
        if (connectivity.isOnline && !suppressOfflineStatus) {
            connectivity.setOnlineStatus(false);
        }

        // Return error khusus agar komponen tahu ini masalah sinyal, bukan masalah akun
        return Promise.reject({ 
            isNetworkError: true, 
            message: 'Koneksi ke server Budimas terputus. Data akan disimpan lokal.' 
        });
    }

    return Promise.reject(error);
  }
);

export default api;

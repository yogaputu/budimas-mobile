import { defineStore } from 'pinia';
import api from '@/api/axios';
import { Preferences } from '@capacitor/preferences';
import { getDb } from '@/services/database';
import { offlineEnabled, syncEnabled } from '@/config/runtime';

const storage = {
  async get(key) {
    const { value } = await Preferences.get({ key });
    return value;
  },
  async set(key, value) {
    await Preferences.set({ key, value: String(value) });
  },
  async remove(key) {
    await Preferences.remove({ key });
  }
};

const setAuthHeader = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

const INVALID_CREDENTIAL_MESSAGE = 'Username dan Password anda salah. Silahkan coba lagi';
const REQUIRED_CREDENTIAL_MESSAGE = 'Username dan Password wajib diisi terlebih dahulu.';

const getLoginErrorMessage = (error, fallback = INVALID_CREDENTIAL_MESSAGE) => {
  const status = Number(error?.response?.status || 0);
  const rawMessage = String(
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    ''
  ).trim();
  const lowerMessage = rawMessage.toLowerCase();

  if (lowerMessage.includes('invalid salt')) {
    return INVALID_CREDENTIAL_MESSAGE;
  }

  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('salah') ||
    lowerMessage.includes('password') ||
    lowerMessage.includes('email') ||
    lowerMessage.includes('user tidak ditemukan')
  ) {
    return INVALID_CREDENTIAL_MESSAGE;
  }

  if (status >= 500) {
    return rawMessage || 'Server sedang bermasalah. Coba lagi beberapa saat.';
  }

  return rawMessage || fallback;
};

const shouldTryLegacyLogin = (error) => {
  const status = Number(error?.response?.status || 0);
  const rawMessage = String(error?.response?.data?.message || error?.message || '').toLowerCase();

  if (!status || error?.isNetworkError) return true;
  if (status === 404 || status >= 500) return true;
  if (rawMessage.includes('invalid salt')) return false;
  return false;
};

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: null,
    loading: false,
    hasSyncedAfterLogin: false
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    isOnlineAuthenticated: (state) => !!state.user && !!state.token
  },

  actions: {
    normalizeCurrentBudimasUser(payload = {}, identity = '') {
      return {
        id: payload.id_user || payload.id || null,
        id_user: payload.id_user || payload.id || null,
        id_sales: payload.id_sales || null,
        name: payload.nama_user || payload.nama || payload.name || identity || '',
        nama: payload.nama_user || payload.nama || payload.name || identity || '',
        email: payload.user_email || payload.email || '',
        role: 'sales',
        id_tipe_sales: payload.id_tipe_sales || payload.id_sales_tipe || null,
        nama_tipe_sales: payload.nama_tipe_sales || payload.tipe_sales || payload.sales_tipe || '',
        qrcode: identity,
        Kode: payload.kode_sales || payload.id_sales || '',
        KodePrinciple: payload.kode_principal || ''
      };
    },

    async loginWithCurrentBackend(identity, password) {
      const response = await api.post('/api/auth/sales/login', {
        email: identity,
        password
      });

      const payload = response?.data || {};
      if (!payload?.token) {
        return {
          success: false,
          isOffline: false,
          message: payload?.message || 'Login sales gagal'
        };
      }

      const user = this.normalizeCurrentBudimasUser(payload, identity);
      this.user = user;
      this.token = payload.token || null;

      setAuthHeader(this.token);

      if (this.token) {
        await storage.set('auth_token', this.token);
      } else {
        await storage.remove('auth_token');
      }

      await storage.set('user_data', JSON.stringify(this.user));

      if (offlineEnabled) {
        await this.saveUserToSQLite(user, identity, password);
      }

      if (syncEnabled) {
        try {
          const { SyncService: LazySyncService } = await import('@/services/SyncService');
          await LazySyncService.uploadAllPendingData();
          await LazySyncService.downloadFullMasterData();
          this.hasSyncedAfterLogin = true;
        } catch (syncError) {
          console.error('Sync setelah loginWithCurrentBackend gagal:', syncError);
        }
      }

      return {
        success: true,
        isOffline: false,
        message: 'Login ke backend Budimas berhasil'
      };
    },

    async checkAuth() {
      try {
        const token = await storage.get('auth_token');
        const userData = await storage.get('user_data');

        if (!userData) {
          this.user = null;
          this.token = null;
          setAuthHeader(null);
          return false;
        }

        this.user = JSON.parse(userData);
        this.token = token || null;
        setAuthHeader(this.token);

        return true;
      } catch (error) {
        console.error('checkAuth error:', error);
        this.user = null;
        this.token = null;
        setAuthHeader(null);
        return false;
      }
    },

    async login(qrcode, password) {
      this.loading = true;

      try {
        try {
          const currentLogin = await this.loginWithCurrentBackend(qrcode, password);
          if (currentLogin.success) {
            return currentLogin;
          }
        } catch (currentError) {
          if (!shouldTryLegacyLogin(currentError)) {
            return {
              success: false,
              isOffline: false,
              message: getLoginErrorMessage(currentError)
            };
          }
          console.warn('Login backend Budimas baru gagal, mencoba fallback mobile lama...', currentError?.message || currentError);
        }

        const response = await api.post('/api/login', { qrcode, password });

        if (response?.data?.success) {
          const { token, user } = response.data;

          this.user = user || null;
          this.token = token || null;

          setAuthHeader(this.token);

          if (this.token) {
            await storage.set('auth_token', this.token);
          } else {
            await storage.remove('auth_token');
          }

          await storage.set('user_data', JSON.stringify(this.user));

          if (offlineEnabled) {
            await this.saveUserToSQLite(user, qrcode, password);
          }

          if (syncEnabled) {
            try {
              const { SyncService } = await import('@/services/SyncService');
              const uploadResult = await SyncService.uploadAllPendingData();
              console.log('Sync after login - upload result:', uploadResult);

              const downloadResult = await SyncService.downloadFullMasterData();
              console.log('Sync after login - download result:', downloadResult);

              this.hasSyncedAfterLogin = true;
            } catch (syncError) {
              console.error('Sync setelah login gagal:', syncError);
            }
          }

          return {
            success: true,
            isOffline: false,
            message: 'Login online berhasil'
          };
        }

        return {
          success: false,
          isOffline: false,
          message: INVALID_CREDENTIAL_MESSAGE
        };
      } catch (error) {
        console.warn('Login online gagal.', error?.message || error);

        const isNetworkError =
          error?.isOffline ||
          error?.isNetworkError ||
          !error.response ||
          error.code === 'ECONNABORTED' ||
          error.message?.includes('Network Error') ||
          error.message?.includes('timeout');

        if (isNetworkError && offlineEnabled) {
          return await this.performOfflineLogin(qrcode, password);
        }

        return {
          success: false,
          isOffline: false,
          message: getLoginErrorMessage(error, 'Server Error')
        };
      } finally {
        this.loading = false;
      }
    },

    async saveUserToSQLite(user, qrcode, password) {
      if (!offlineEnabled) return;

      const db = getDb();
      if (!db || !user) return;

      try {
        await db.run(
          `
          INSERT OR REPLACE INTO users (id, qrcode, name, role, password)
          VALUES (?, ?, ?, ?, ?)
          `,
          [
            user.id,
            qrcode,
            user.name || user.nama || '',
            user.role || 'sales',
            password
          ]
        );
      } catch (e) {
        console.error('SQLite User Save Error:', e);
      }
    },

    async performOfflineLogin(qrcode, password) {
      if (!offlineEnabled) {
        return {
          success: false,
          isOffline: false,
          message: 'Mode offline dinonaktifkan untuk browser lokal.'
        };
      }

      const db = getDb();
      if (!db) {
        return {
          success: false,
          isOffline: true,
          message: 'Database lokal belum siap'
        };
      }

      try {
        const res = await db.query(
          `
          SELECT * FROM users
          WHERE qrcode = ? AND password = ?
          LIMIT 1
          `,
          [qrcode, password]
        );

        if (res.values && res.values.length > 0) {
          const userData = res.values[0];

          this.user = {
            id: userData.id,
            name: userData.name,
            role: userData.role,
            qrcode: userData.qrcode
          };

          this.token = null;
          setAuthHeader(null);

          await storage.set('user_data', JSON.stringify(this.user));
          await storage.remove('auth_token');

          return {
            success: true,
            isOffline: true,
            message: 'Login offline berhasil'
          };
        }

        return {
          success: false,
          isOffline: true,
          message: INVALID_CREDENTIAL_MESSAGE
        };
      } catch (e) {
        console.error('Offline login error:', e);
        return {
          success: false,
          isOffline: true,
          message: 'Database Error'
        };
      }
    },

    async syncDashboardToSQLite(profileData, targetData, atmdData) {
      if (!offlineEnabled) return;

      const db = getDb();
      if (!db) return;

      try {
        if (profileData) {
          await db.run(
            `
            INSERT OR REPLACE INTO profile
            (kode, nama, alamat, kota, nama_principle, type, telpon)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
              profileData.Kode || '',
              profileData.Nama || '',
              profileData.Alamat || '',
              profileData.Kota || '',
              profileData.NamaPrinciple || profileData.nama_principle || '',
              profileData.Type || profileData.type || '',
              profileData.Telpon || profileData.telpon || ''
            ]
          );
        }

        const stats = [
          ['target_sales', targetData?.TargetSales || 0],
          ['value_order', atmdData?.[0]?.ValueOrder || 0],
          ['value_faktur', atmdData?.[0]?.ValueFaktur || 0],
          ['atmd_cp', atmdData?.[0]?.CP || 0],
          ['atmd_at', atmdData?.[0]?.AT || 0],
          ['atmd_eco', atmdData?.[0]?.ECO || 0],
          ['atmd_ecf', atmdData?.[0]?.ECF || 0]
        ];

        for (const [key, val] of stats) {
          await db.run(
            'INSERT OR REPLACE INTO stats (key, value) VALUES (?, ?)',
            [key, String(val ?? 0)]
          );
        }
      } catch (e) {
        console.error('Sync Dashboard Error:', e);
      }
    },

    async logout() {
      this.user = null;
      this.token = null;
      setAuthHeader(null);

      await storage.remove('auth_token');
      await storage.remove('user_data');
    }
  }
});

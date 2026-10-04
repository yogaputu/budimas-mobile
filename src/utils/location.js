import { Geolocation } from '@capacitor/geolocation';
import { isNativeApp } from '@/config/runtime';

const DEFAULT_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0
};

export const isLocationPermissionGranted = (status = {}) =>
  status.location === 'granted' || status.coarseLocation === 'granted';

export const isPreciseLocationGranted = (status = {}) => status.location === 'granted';

export const getLocationErrorMessage = (error) => {
  const code = error?.code || '';
  const message = String(error?.message || error || '').toLowerCase();

  if (code === 'OS-PLUG-GLOC-0007' || message.includes('location services')) {
    return 'GPS perangkat belum aktif. Aktifkan lokasi/GPS lalu coba lagi.';
  }

  if (code === 'OS-PLUG-GLOC-0003' || message.includes('permission') || message.includes('denied')) {
    return 'Izin lokasi belum diberikan. Buka pengaturan aplikasi lalu izinkan lokasi.';
  }

  if (message.includes('timeout')) {
    return 'GPS belum berhasil membaca lokasi. Coba di area terbuka atau tekan ulang.';
  }

  return 'Gagal membaca GPS. Pastikan lokasi aktif dan izin aplikasi sudah diberikan.';
};

export const ensureLocationPermission = async () => {
  if (!isNativeApp) {
    return { location: 'granted', coarseLocation: 'granted' };
  }

  let status = await Geolocation.checkPermissions();
  if (isLocationPermissionGranted(status)) return status;

  status = await Geolocation.requestPermissions({
    permissions: ['location', 'coarseLocation']
  });

  if (!isLocationPermissionGranted(status)) {
    throw Object.assign(new Error('Izin lokasi belum diberikan'), {
      code: 'LOCATION_PERMISSION_DENIED',
      status
    });
  }

  return status;
};

export const getCurrentDevicePosition = async (options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (isNativeApp) {
    const status = await ensureLocationPermission();

    return Geolocation.getCurrentPosition({
      ...opts,
      enableHighAccuracy: isPreciseLocationGranted(status) ? opts.enableHighAccuracy : false
    });
  }

  if (!navigator.geolocation) {
    throw Object.assign(new Error('GPS tidak didukung oleh browser Anda'), {
      code: 'LOCATION_UNSUPPORTED'
    });
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, opts);
  });
};

import { Capacitor } from '@capacitor/core';

const offlineEnv = String(import.meta.env.VITE_ENABLE_OFFLINE ?? '').trim().toLowerCase();

export const isNativeApp = Capacitor.isNativePlatform();

export const offlineEnabled =
  offlineEnv === 'true'
    ? true
    : offlineEnv === 'false'
      ? false
      : isNativeApp;

export const syncEnabled = offlineEnabled;

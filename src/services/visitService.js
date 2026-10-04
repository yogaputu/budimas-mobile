import api from '@/api/axios';
import { normalizeKunjungan } from '@/utils/apiMapper';

const unwrapPossibleJsonArray = (payload) => {
  if (typeof payload !== 'string') {
    return payload;
  }

  const value = payload.trim();
  const objectStart = value.indexOf('{');
  const arrayStart = value.indexOf('[');
  const startIndex = [objectStart, arrayStart]
    .filter((idx) => idx >= 0)
    .sort((a, b) => a - b)[0];

  if (startIndex === undefined) {
    return payload;
  }

  try {
    return JSON.parse(value.substring(startIndex));
  } catch (_) {
    const openChar = value[startIndex];
    const closeChar = openChar === '[' ? ']' : '}';
    const endIndex = value.lastIndexOf(closeChar);

    if (endIndex > startIndex) {
      try {
        return JSON.parse(value.substring(startIndex, endIndex + 1));
      } catch (_) {
        return payload;
      }
    }

    return payload;
  }
};

export const getPayloadArray = (payload) => {
  const raw = unwrapPossibleJsonArray(payload);
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.rows)) return raw.rows;
  // Most newer mobile endpoints use the shared paginated response helper.
  // Treat its `pages` collection like the older data/items shapes so a
  // paginated result is never mistaken for an empty list by the UI.
  if (Array.isArray(raw?.pages)) return raw.pages;
  if (Array.isArray(raw?.payload)) return raw.payload;
  if (Array.isArray(raw?.result)) return raw.result;
  return [];
};

export const getPayloadObject = (payload) => {
  const raw = unwrapPossibleJsonArray(payload);
  if (Array.isArray(raw)) return raw[0] || null;
  if (raw?.data && !Array.isArray(raw.data)) return raw.data;
  if (raw?.item && !Array.isArray(raw.item)) return raw.item;
  if (raw?.payload && !Array.isArray(raw.payload)) return raw.payload;
  if (raw?.result && !Array.isArray(raw.result)) return raw.result;
  if (raw && typeof raw === 'object') return raw;
  return null;
};

export const normalizeVisitList = (payload) => {
  return getPayloadArray(payload).map(normalizeKunjungan);
};

export const getVisitSchedule = async (params = {}) => {
  const response = await api.get('/api/kunjungan/jadwal', { params });
  return normalizeVisitList(response.data);
};

export const getVisitList = async (params = {}) => {
  const response = await api.get('/api/kunjungan/daftar', { params });
  return normalizeVisitList(response.data);
};

export const getCanCheckIn = async () => {
  const response = await api.get('/api/kunjungan/cancheckin');
  const data = unwrapPossibleJsonArray(response?.data) || {};

  if (data.result !== undefined) return !!data.result;
  if (data.can_checkin !== undefined) return !!data.can_checkin;
  if (data.active_visit !== undefined) return !data.active_visit;
  return true;
};

export const getPendingVisit = async () => {
  const response = await api.get('/api/kunjungan/cek-pending');
  const data = unwrapPossibleJsonArray(response?.data) || {};
  const pending =
    data.status === 'pending' ||
    data.has_pending === true ||
    Number(data.pending_count || 0) > 0;

  const item = data.data || data.items?.[0] || null;
  return {
    pending,
    item: item ? normalizeKunjungan(item) : null,
    raw: data
  };
};

export const findActiveVisitFromServer = async () => {
  const visits = await getVisitList();
  return (
    visits.find((visit) => {
      const hasVisitId = !!visit.IDKunjungan;
      const isActiveStatus = visit.isVisited && !visit.isCheckOut;
      const rawCheckout = visit.CheckOut;
      return hasVisitId && (isActiveStatus || rawCheckout === 0 || rawCheckout === '0' || rawCheckout === null);
    }) || null
  );
};

export const findVisitByKode = async (kodeCustomer, idPlafon = '') => {
  const cleanKode = String(kodeCustomer || '').trim();
  const cleanPlafonId = String(idPlafon || '').trim();
  if (!cleanKode) return null;

  const visits = await getVisitList();
  return visits.find((visit) => (
    String(visit.Kode || '').trim() === cleanKode &&
    (!cleanPlafonId || String(visit.IDPlafon || visit.id_plafon || '').trim() === cleanPlafonId)
  )) || null;
};

export const getVisitReason = async (params) => {
  const response = await api.get('/api/kunjungan/cek-alasan', { params });
  return unwrapPossibleJsonArray(response?.data) || {};
};

export const getVisitReasonHistory = async (params) => {
  const response = await api.get('/api/kunjungan/alasan-history', { params });
  return unwrapPossibleJsonArray(response?.data) || {};
};

export const getVisitInvoices = async (params) => {
  const response = await api.get('/api/kunjungan/nota', { params });
  return getPayloadArray(response?.data);
};

export const startVisit = async (payload) => {
  const response = await api.post('/api/kunjungan/save', payload);
  const data = unwrapPossibleJsonArray(response?.data) || {};
  const idKunjungan =
    data.id_kunjungan ||
    data.IDKunjungan ||
    data.id ||
    data.data?.id_kunjungan ||
    data.data?.IDKunjungan ||
    data.data?.id ||
    null;

  return {
    success:
      data.success === true ||
      data.result === true ||
      data.status === true ||
      String(data.status || '').toLowerCase() === 'success' ||
      !!idKunjungan,
    message: data.message || '',
    idKunjungan,
    raw: data
  };
};

export const checkoutVisit = async (payload) => {
  const response = await api.post('/api/kunjungan/checkout', payload);
  return unwrapPossibleJsonArray(response?.data) || {};
};

export const saveVisitReason = async (payload) => {
  const response = await api.post('/api/kunjungan/save-reason', payload);
  return unwrapPossibleJsonArray(response?.data) || {};
};

export const checkVisitStockOpname = async (idKunjungan, params = {}) => {
  const response = await api.get(`/api/kunjungan/stok-opname/check/${idKunjungan}`, { params });
  return unwrapPossibleJsonArray(response?.data) || {};
};

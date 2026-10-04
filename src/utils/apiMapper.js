export const normalizeProfile = (raw = {}) => ({
  ...raw,

  Nama: raw.Nama || raw.nama || '-',
  Kode: raw.Kode || raw.sales?.id || raw.id_sales || '-',

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

  Kota:
    raw.Kota ||
    raw.nama_cabang ||
    raw.sales?.nama_cabang ||
    '-',

  Alamat:
    raw.Alamat ||
    raw.alamat ||
    '-',

  Type:
    raw.Type ||
    raw.role ||
    raw.nama_jabatan ||
    raw.sales?.nama_jabatan ||
    '-'
});

export const normalizeKunjungan = (item = {}) => {
  const kode = String(
    item.Kode ||
    item.kode_customer ||
    item.id_plafon ||
    item.IDPlafon ||
    ''
  ).trim();

  const status = Number(item.status ?? 0);

  return {
    ...item,

    Kode: kode,
    Nama: String(item.Nama || item.nama_customer || 'Toko Tanpa Nama').trim(),
    Alamat: String(item.Alamat || item.alamat || 'Alamat tidak tersedia').trim(),

    IDKunjungan: item.IDKunjungan || item.id_kunjungan || item.id || null,
    IDJadwal: item.IDJadwal || item.id_jadwal || null,
    IDPlafon: item.IDPlafon || item.id_plafon || kode || null,
    KodePlafon: String(item.KodePlafon || item.kode_plafon || '').trim(),
    KodePrincipal: String(item.KodePrincipal || item.kode_principal || '').trim(),
    NamaPrincipal: String(item.NamaPrincipal || item.nama_principal || '').trim(),

    isVisited:
      item.isVisited !== undefined
        ? item.isVisited
        : status === 1 || status === 2 || !!item.id,

    isCheckOut:
      item.isCheckOut !== undefined
        ? item.isCheckOut
        : status === 2,

    CheckOut:
      item.CheckOut !== undefined && item.CheckOut !== null
        ? item.CheckOut
        : status === 2
          ? 1
          : status === 1
            ? 0
            : null,

    Alasan: item.Alasan || item.alasan || null,
    Tanggal: item.Tanggal || item.tanggal || null,

    TotalPiutang: item.TotalPiutang || item.total_piutang || 0,
    SisaPlafon: item.SisaPlafon || item.sisa_plafon || 0,

    Kota: item.Kota || item.kota || '',
    Telpon: item.Telpon || item.telpon || '',
    Latitude: item.Latitude || item.latitude || '0',
    Longitude: item.Longitude || item.longitude || '0',
    QRCode: item.QRCode || item.qrcode || ''
  };
};

export const normalizeList = (resData, mapper = (x) => x) => {
  const rows = Array.isArray(resData)
    ? resData
    : resData?.data || resData?.items || [];

  return rows.map(mapper);
};

export const normalizeStok = (item = {}) => ({
  ...item,

  Kode: String(item.Kode || item.kode || item.kode_barang || '').trim(),
  Nama: String(item.Nama || item.nama || item.nama_barang || '').trim(),
  Satuan: item.Satuan || item.satuan || '',
  NamaUnit: item.NamaUnit || item.nama_unit || '',
  NamaBrand: item.NamaBrand || item.nama_brand || item.brand || '',
  HargaE: Number(item.HargaE || item.harga || 0),
  Suggestion: Number(item.Suggestion || item.suggestion || 0)
});

export const normalizeStatistik = (raw = {}) => ({
  ...raw,

  target: Number(raw.target || raw.Target || 0),
  realisasi: Number(raw.realisasi || raw.Realisasi || 0),
  percentage: Number(raw.percentage || raw.persentase || raw.Percent || 0),
  atmd: Number(raw.atmd || raw.ATMD || 0)
});

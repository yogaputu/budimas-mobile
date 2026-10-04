const hasText = (value) => String(value ?? '').trim() !== '';

export const hasLphMetadata = (item = {}) => (
  item.is_lph !== undefined ||
  item.IsLPH !== undefined ||
  item.isLPH !== undefined ||
  item.sudah_lph !== undefined ||
  item.SudahLPH !== undefined ||
  item.lph_ready !== undefined ||
  item.LPHReady !== undefined ||
  item.status_lph !== undefined ||
  item.StatusLPH !== undefined ||
  item.statusLPH !== undefined ||
  item.status_laporan !== undefined ||
  item.StatusLaporan !== undefined ||
  hasText(item.NoLPH) ||
  hasText(item.no_lph) ||
  hasText(item.nomor_lph) ||
  hasText(item.NomorLPH) ||
  hasText(item.id_lph) ||
  hasText(item.IDLPH)
);

export const isLphReady = (item = {}) => {
  const explicit = (
    item.is_lph ??
    item.IsLPH ??
    item.isLPH ??
    item.sudah_lph ??
    item.SudahLPH ??
    item.lph_ready ??
    item.LPHReady
  );

  if (explicit !== undefined && explicit !== null) {
    if (typeof explicit === 'boolean') return explicit;
    const normalized = String(explicit).trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'sudah', 'ready', 'lph'].includes(normalized);
  }

  const status = String(
    item.status_lph ??
    item.StatusLPH ??
    item.statusLPH ??
    item.status_laporan ??
    item.StatusLaporan ??
    ''
  ).trim().toLowerCase();

  if (status) {
    return ['lph', 'sudah lph', 'sudah dibuat lph', 'approved', 'posted', 'ready'].some((key) =>
      status.includes(key)
    );
  }

  return (
    hasText(item.NoLPH) ||
    hasText(item.no_lph) ||
    hasText(item.nomor_lph) ||
    hasText(item.NomorLPH) ||
    hasText(item.id_lph) ||
    hasText(item.IDLPH)
  );
};

export const filterLphReady = (rows = []) => (
  (Array.isArray(rows) ? rows : []).some(hasLphMetadata)
    ? rows.filter(isLphReady)
    : (Array.isArray(rows) ? rows : [])
);

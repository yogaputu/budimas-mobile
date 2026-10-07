export const workflowVersion = row => Number(row?.payment_workflow_version || 1);
export function checkedDetailIds(detail, checkedInvoices) {
  const invoices = detail?.invoices || [];
  if (!invoices.length || !invoices.every(i => checkedInvoices.includes(i.id))) throw new Error('Cocokkan seluruh faktur terlebih dahulu.');
  const ids = (detail.checked_details || []).filter(d => checkedInvoices.includes(d.id_faktur)).map(d => d.id);
  if (!ids.length) throw new Error('Rincian penerimaan belum tersedia. Muat ulang LPH.');
  return ids;
}
export function amountCents(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value))) throw new Error('Nominal harus angka dengan maksimal dua desimal.');
  const [whole, fraction = ''] = String(value).split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw new Error('Nominal terlalu besar.');
  return cents;
}
export function cashHandover(claims, transfer) {
  const total = claims.filter(c => c.method === 'CASH').reduce((sum, c) => sum + amountCents(c.amount), 0);
  const converted = amountCents(transfer);
  if (converted > total) throw new Error('Cash yang ditransfer melebihi klaim tunai.');
  return { cash_transfer: converted / 100, cash_to_cashier: (total - converted) / 100 };
}
export function collectionSummary(claims = []) {
  const cents = { CASH: 0, TRANSFER: 0, GIRO: 0 };
  for (const claim of claims) if (claim.method in cents) cents[claim.method] += amountCents(claim.amount);
  return { cash:cents.CASH / 100, transfer:cents.TRANSFER / 100, giro:cents.GIRO / 100,
    total:(cents.CASH + cents.TRANSFER + cents.GIRO) / 100 };
}
export function claimPayload(form, detail, clientKey) {
  const invoice = detail.invoices.find(i => String(i.id) === String(form.id_faktur));
  if (!invoice || detail.status_dokumen !== 'AKTIF') throw new Error('Pilih faktur pada LPH aktif.');
  if (!['CASH', 'TRANSFER', 'GIRO'].includes(form.method)) throw new Error('Pilih metode klaim.');
  const amount = amountCents(form.amount);
  const used = detail.claims.filter(c => c.id_faktur === invoice.id).reduce((sum, c) => sum + amountCents(c.amount), 0);
  if (!amount || amount + used > amountCents(invoice.remaining)) throw new Error('Klaim melebihi sisa tagihan yang belum diklaim.');
  if (form.method === 'GIRO' && (!form.giro_number.trim() || !form.bank.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(form.due_date))) throw new Error('Lengkapi nomor giro, bank, dan jatuh tempo.');
  return { id_faktur: invoice.id, method: form.method, amount: amount / 100, client_key: clientKey, giro_number: form.method === 'GIRO' ? form.giro_number.trim() : '', bank: form.method === 'GIRO' ? form.bank.trim() : '', due_date: form.method === 'GIRO' ? form.due_date : null };
}
export function workflowError(error) {
  const data = error?.response?.data;
  return data?.message || data?.result?.[0]?.message || error?.message || 'Permintaan gagal. Muat ulang sebelum mencoba lagi.';
}

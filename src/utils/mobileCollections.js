import { amountCents } from './receiptWorkflow.js';

export const collectionMethods = { CASH: 'Tunai', TRANSFER: 'Transfer', GIRO: 'Giro' };
export const collectionOrigins = { CALL_PLAN: 'Dari Call Plan', OUTSIDE_CALL_PLAN: 'Di luar kunjungan', LPH: 'Dari LPH' };
export function collectionPayload(form, invoice, visitId, clientKey) {
  if (!invoice) throw new Error('Pilih faktur dari LPH aktif.');
  const amount = amountCents(form.amount);
  if (!amount || amount > amountCents(invoice.available_to_collect)) throw new Error('Nominal melebihi sisa yang dapat dicatat.');
  if (!collectionMethods[form.method]) throw new Error('Pilih metode penerimaan.');
  const reference = String(form.payment_reference || '').trim();
  if (reference.length > 200) throw new Error('Referensi maksimal 200 karakter.');
  if (form.method === 'TRANSFER' && !reference) throw new Error('Isi referensi atau bukti transfer.');
  if (visitId && !/^[1-9]\d*$/.test(String(visitId))) throw new Error('ID kunjungan tidak valid.');
  if (form.method === 'GIRO' && (!form.giro_number.trim() || !form.bank.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(form.due_date))) throw new Error('Lengkapi nomor giro, bank, dan jatuh tempo.');
  return { id_faktur: invoice.id, amount: amount / 100, method: form.method, client_key: clientKey,
    entry_origin: visitId ? 'CALL_PLAN' : 'OUTSIDE_CALL_PLAN', id_kunjungan: visitId ? Number(visitId) : null,
    payment_reference: reference, giro_number: form.method === 'GIRO' ? form.giro_number.trim() : '',
    bank: form.method === 'GIRO' ? form.bank.trim() : '', due_date: form.method === 'GIRO' ? form.due_date : null };
}

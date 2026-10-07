<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/api/axios';
import { useConnectivityStore } from '@/stores/connectivity';
import { checkedDetailIds, cashHandover, collectionSummary, claimPayload, workflowError } from '@/utils/receiptWorkflow';
const router = useRouter(), network = useConnectivityStore();
const rows = ref([]), detail = ref(null), busy = ref(false), error = ref(''), success = ref(''), checked = ref([]), transfer = ref('0'), returning = ref(false);
const form = reactive({ id_faktur:'', method:'CASH', amount:'', giro_number:'', bank:'', due_date:'' });
const claimKey = ref(null), claimFingerprint = ref(null);
const labels = { MENUNGGU_PENERIMAAN:'Menunggu diterima', AKTIF:'Aktif', DIKEMBALIKAN:'Dikembalikan', DITUTUP:'Ditutup', CASH:'Tunai', TRANSFER:'Transfer', GIRO:'Giro' };
const money = value => new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR' }).format(Number(value || 0));
const date = value => value ? new Date(value).toLocaleDateString('id-ID') : '—';
const split = computed(() => { try { return cashHandover(detail.value?.claims || [], transfer.value); } catch { return null; } });
const collection = computed(() => collectionSummary(detail.value?.claims || []));
const allChecked = computed(() => detail.value?.invoices?.length && detail.value.invoices.every(i => checked.value.includes(i.id)));
const remainingClaim = computed(() => { const invoice = detail.value?.invoices.find(i => String(i.id) === String(form.id_faktur)); return invoice ? Number(invoice.remaining) - detail.value.claims.filter(c => c.id_faktur === invoice.id).reduce((s,c) => s + Number(c.amount),0) : 0; });
watch(() => JSON.stringify(form), () => { claimKey.value = null; claimFingerprint.value = null; });
async function fetchDetail(id) { detail.value = (await api.get(`/api/mobile/workflow/lphs/${id}`)).data.data; }
async function load() {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try { rows.value = (await api.get('/api/mobile/workflow/lphs')).data.data; }
  catch(e) { rows.value = []; error.value = workflowError(e); }
  finally { busy.value = false; }
}
async function open(row) {
  if (busy.value) return;
  busy.value = true; error.value = ''; success.value = ''; checked.value = []; returning.value = false; transfer.value = '0'; detail.value = null;
  Object.assign(form,{ id_faktur:'', method:'CASH', amount:'', giro_number:'', bank:'', due_date:'' });
  try { await fetchDetail(row.id); checked.value = detail.value.invoices.map(i => i.id); }
  catch(e) { error.value = workflowError(e); }
  finally { busy.value = false; }
}
async function mutate(fn, message) {
  if (busy.value) return;
  if (!network.isOnline) { error.value = 'Hubungkan internet terlebih dahulu. Klaim ini tidak dimasukkan ke antrean pembayaran offline.'; return; }
  busy.value = true; error.value = ''; success.value = '';
  try {
    await fn(); success.value = message;
    try { await fetchDetail(detail.value.id); rows.value = (await api.get('/api/mobile/workflow/lphs')).data.data; }
    catch { detail.value = null; error.value = 'Transaksi berhasil, tetapi rincian terbaru belum termuat. Muat ulang daftar.'; }
  } catch(e) { error.value = workflowError(e); }
  finally { busy.value = false; }
}
function accept() {
  try { const ids = checkedDetailIds(detail.value,checked.value); mutate(() => api.post(`/api/mobile/workflow/lphs/${detail.value.id}/accept`,{ checked_detail_ids:ids }), 'LPH diterima. Klaim pembayaran dapat dicatat.'); }
  catch(e) { error.value = workflowError(e); }
}
function saveClaim() {
  try {
    const fingerprint = JSON.stringify(form);
    if (!claimKey.value || claimFingerprint.value !== fingerprint) { claimKey.value = crypto.randomUUID(); claimFingerprint.value = fingerprint; }
    const payload = claimPayload(form,detail.value,claimKey.value);
    mutate(async () => { await api.post(`/api/mobile/workflow/lphs/${detail.value.id}/claims`,payload); form.amount = ''; claimKey.value = null; }, 'Klaim tercatat. Piutang berubah setelah Finance memfinalisasi kuitansi.');
  } catch(e) { error.value = workflowError(e); }
}
function removeClaim(claim) {
  if (window.confirm('Hapus klaim ini?')) mutate(() => api.delete(`/api/mobile/workflow/claims/${claim.id}`),'Klaim dihapus.');
}
function submitReturn() {
  try { const data = cashHandover(detail.value.claims,transfer.value); mutate(() => api.post(`/api/mobile/workflow/lphs/${detail.value.id}/return`,{ cash_transfer:data.cash_transfer }), 'LPH dikembalikan. Sisa cash menunggu approval Kasir.'); returning.value = false; }
  catch(e) { error.value = workflowError(e); }
}
onMounted(load);
</script>

<template>
  <main class="receipt-lph">
    <header><button @click="router.back()" :disabled="busy">‹ Kembali</button><h1>LPH & Klaim Pembayaran</h1><button @click="load" :disabled="busy">Muat ulang</button></header>
    <p>Klaim tunai, transfer, dan giro dicatat untuk rekonsiliasi Finance. Klaim belum mengurangi piutang.</p>
    <p v-if="!network.isOnline" class="warning">Anda offline. Hubungkan internet untuk memproses LPH dan klaim.</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="success" role="status" class="success">{{ success }}</p>
    <p v-if="busy" role="status">Memproses…</p>
    <section v-if="!detail" class="cards">
      <button v-for="row in rows" :key="row.id" class="card" :disabled="busy" @click="open(row)"><b>{{ row.kode_lph }}</b><span>{{ labels[row.status_dokumen] || row.status_dokumen }}</span><small>{{ date(row.tanggal_lph) }}</small></button>
      <p v-if="!rows.length && !busy">Belum ada LPH Kuitansi untuk akun Anda. Finance harus membuat LPH baru dengan alur Kuitansi & Giro.</p>
      <button @click="router.push('/lph')">Buka LPH sebelumnya</button>
    </section>
    <section v-else class="card">
      <button :disabled="busy" @click="detail = null">‹ Daftar LPH</button>
      <h2>{{ detail.kode_lph }}</h2><p>{{ labels[detail.status_dokumen] || detail.status_dokumen }}</p>
      <fieldset :disabled="busy"><legend>Rincian faktur</legend>
        <label v-for="invoice in detail.invoices" :key="invoice.id" class="invoice"><input v-if="detail.status_dokumen === 'MENUNGGU_PENERIMAAN'" v-model="checked" type="checkbox" :value="invoice.id"/><span><b>{{ invoice.no_faktur }}</b><br/>{{ invoice.nama_customer }}<br/>Sisa piutang: {{ money(invoice.remaining) }}</span></label>
      </fieldset>
      <button v-if="detail.status_dokumen === 'MENUNGGU_PENERIMAAN'" :disabled="busy || !network.isOnline || !allChecked" @click="accept">Terima LPH</button>
      <form v-if="detail.status_dokumen === 'AKTIF' && !returning" @submit.prevent="saveClaim">
        <h3>Catat klaim pembayaran</h3><fieldset :disabled="busy || !network.isOnline">
          <label>Faktur<select v-model="form.id_faktur" required><option value="">Pilih faktur</option><option v-for="i in detail.invoices" :key="i.id" :value="i.id">{{ i.no_faktur }} — {{ i.nama_customer }}</option></select></label>
          <p>Sisa yang belum diklaim: {{ money(remainingClaim) }}</p>
          <label>Metode<select v-model="form.method"><option value="CASH">Tunai</option><option value="TRANSFER">Transfer</option><option value="GIRO">Giro</option></select></label>
          <label>Nominal (Rp)<input v-model="form.amount" type="number" min="0.01" step="0.01" inputmode="decimal" required/></label>
          <template v-if="form.method === 'GIRO'"><label>Nomor giro<input v-model="form.giro_number" required maxlength="160"/></label><label>Bank<input v-model="form.bank" required maxlength="160"/></label><label>Jatuh tempo<input v-model="form.due_date" type="date" required/></label></template>
          <button type="submit">Simpan Klaim</button>
        </fieldset>
      </form>
      <h3>Klaim tercatat</h3>
      <dl class="collection-summary" aria-label="Ringkasan penerimaan Sales"><div><dt>Total Uang Diperoleh</dt><dd>{{ money(collection.total) }}</dd></div><div><dt>Tunai</dt><dd>{{ money(collection.cash) }}</dd></div><div><dt>Transfer</dt><dd>{{ money(collection.transfer) }}</dd></div><div><dt>Giro</dt><dd>{{ money(collection.giro) }}</dd></div></dl>
      <article v-for="claim in detail.claims" :key="claim.id" class="invoice"><span>{{ detail.invoices.find(i => i.id === claim.id_faktur)?.no_faktur }} · {{ labels[claim.method] }}<br/><b>{{ money(claim.amount) }}</b><template v-if="claim.method === 'GIRO'"><br/>{{ claim.giro_number }} · {{ claim.bank }} · {{ date(claim.due_date) }}</template></span><button v-if="detail.status_dokumen === 'AKTIF'" :disabled="busy || !network.isOnline" @click="removeClaim(claim)">Hapus</button></article>
      <button v-if="detail.status_dokumen === 'AKTIF' && !returning" :disabled="busy || !network.isOnline" @click="returning = true">Kembalikan LPH</button>
      <form v-if="returning && detail.status_dokumen === 'AKTIF'" @submit.prevent="submitReturn"><h3>Konfirmasi pengembalian LPH</h3><fieldset :disabled="busy || !network.isOnline"><label>Bagian cash yang ditransfer (Rp)<input v-model="transfer" type="number" min="0" step="0.01" inputmode="decimal" required/></label><p v-if="split">Cash diserahkan ke Kasir: <b>{{ money(split.cash_to_cashier) }}</b></p><p v-else class="error">Nominal transfer harus valid dan tidak melebihi klaim tunai.</p><p>Sesudah dikembalikan, klaim tidak dapat diubah. Sisa cash dibuat sebagai setoran menunggu approval Kasir.</p><button :disabled="!split" type="submit">Konfirmasi Pengembalian</button><button type="button" @click="returning = false">Batal</button></fieldset></form>
      <p v-if="detail.handover">Cash ditransfer: {{ money(detail.handover.cash_transfer) }} · Cash ke Kasir: {{ money(detail.handover.cash_to_cashier) }}</p>
    </section>
  </main>
</template>

<style scoped>
.collection-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:18px 0}.collection-summary div{padding:12px;border:1px solid #94a3b8;border-radius:10px}.collection-summary dt{font-size:.8rem;opacity:.8}.collection-summary dd{margin:6px 0 0;font-weight:700}
.receipt-lph,.receipt-lph *{box-sizing:border-box;min-width:0;overflow-wrap:anywhere}.receipt-lph{max-width:720px;margin:auto;padding:18px 14px 90px;color:var(--app-body-text,#172b4d);text-align:left}header{display:flex;flex-wrap:wrap;align-items:center;gap:12px}h1{font-size:1.3rem;flex:1}h2{font-size:1.15rem}.cards{display:grid;gap:12px}.card{display:block;text-align:left;width:100%;border:1px solid #94a3b8;border-radius:14px;padding:16px;margin:14px 0;background:var(--app-surface,#fff)}.card>span,.card>small{display:block;margin-top:8px}button{padding:12px;border:1px solid #94a3b8;border-radius:10px;background:var(--app-surface,#fff);color:inherit;cursor:pointer}button:disabled{opacity:.5;cursor:default}fieldset{border:0;padding:0;margin:14px 0}label{display:block;margin:12px 0}input:not([type=checkbox]),select{display:block;width:100%;box-sizing:border-box;padding:12px;margin-top:7px;border:1px solid #94a3b8;border-radius:9px;background:var(--app-surface,#fff);color:inherit;font:inherit}.invoice{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #cbd5e1;padding:14px 0}.invoice input{min-width:20px;min-height:20px}.error,.warning{background:#fff2e8;color:#9a3412;padding:12px;border-radius:9px}.success{background:#dcfce7;color:#166534;padding:12px;border-radius:9px}form{margin-top:24px}form button{margin:6px 6px 6px 0}h3{margin-top:24px}legend{font-weight:bold}
</style>

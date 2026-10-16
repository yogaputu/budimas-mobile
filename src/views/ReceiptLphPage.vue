<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/api/axios';
import { useConnectivityStore } from '@/stores/connectivity';
import { checkedDetailIds, cashHandover, collectionSummary, workflowError } from '@/utils/receiptWorkflow';
const router = useRouter(), network = useConnectivityStore();
const rows = ref([]), detail = ref(null), busy = ref(false), error = ref(''), success = ref(''), checked = ref([]), transfer = ref('0'), returning = ref(false);
const labels = { MENUNGGU_PENERIMAAN:'Menunggu diterima', AKTIF:'Aktif', DIKEMBALIKAN:'Dikembalikan', DITUTUP:'Ditutup', CASH:'Tunai', TRANSFER:'Transfer', GIRO:'Giro' };
const money = value => new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR' }).format(Number(value || 0));
const date = value => value ? new Date(value).toLocaleDateString('id-ID') : '—';
const split = computed(() => { try { return cashHandover(detail.value?.claims || [], transfer.value); } catch { return null; } });
const collection = computed(() => collectionSummary(detail.value?.claims || []));
const allChecked = computed(() => detail.value?.invoices?.length && detail.value.invoices.every(i => checked.value.includes(i.id)));
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
  <main class="receipt-lph sales-ui sales-document-page">
    <header class="sales-header">
      <button class="sales-header-action" aria-label="Kembali" @click="router.back()" :disabled="busy"><font-awesome-icon icon="chevron-left" /></button>
      <div class="sales-header-copy"><p class="sales-eyebrow">Penagihan Sales</p><h1>LPH</h1><p>Terima dokumen, pantau penerimaan, lalu kembalikan.</p></div>
      <button class="sales-header-action" aria-label="Muat ulang" @click="load" :disabled="busy"><font-awesome-icon icon="sync-alt" :spin="busy" /></button>
    </header>
    <div class="receipt-content">
    <aside class="workflow-note"><font-awesome-icon icon="info-circle" /><p>Klaim tunai, transfer, dan giro dicatat untuk rekonsiliasi Finance. <strong>Klaim belum mengurangi piutang.</strong></p></aside>
    <p v-if="!network.isOnline" class="warning">Anda offline. Hubungkan internet untuk memproses LPH dan klaim.</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="success" role="status" class="success">{{ success }}</p>
    <p v-if="busy" role="status" class="processing"><font-awesome-icon icon="sync-alt" spin /> Memproses…</p>
    <section v-if="!detail" class="cards">
      <div class="list-heading"><h2>Daftar LPH</h2><span>{{ rows.length }} dokumen</span></div>
      <button v-for="row in rows" :key="row.id" class="document-card" :disabled="busy" @click="open(row)">
        <span class="document-icon"><font-awesome-icon icon="clipboard-check" /></span>
        <span class="document-copy"><b>{{ row.kode_lph }}</b><small>{{ date(row.tanggal_lph) }}</small><span class="document-status" :data-status="row.status_dokumen">{{ labels[row.status_dokumen] || row.status_dokumen }}</span></span>
        <font-awesome-icon icon="chevron-right" class="document-arrow" />
      </button>
      <div v-if="!rows.length && !busy" class="receipt-empty"><font-awesome-icon icon="folder-open" /><h3>Belum ada LPH Kuitansi</h3><p>Finance harus membuat LPH baru dengan alur Kuitansi & Giro untuk akun Anda.</p></div>
      <button class="secondary-button legacy-link" @click="router.push('/lph')">Buka LPH sebelumnya <font-awesome-icon icon="chevron-right" /></button>
    </section>
    <section v-else class="receipt-detail">
      <button class="text-button" :disabled="busy" @click="detail = null"><font-awesome-icon icon="chevron-left" /> Daftar LPH</button>
      <div class="detail-title"><span class="sales-eyebrow">Dokumen dipilih</span><h2>{{ detail.kode_lph }}</h2><span class="document-status" :data-status="detail.status_dokumen">{{ labels[detail.status_dokumen] || detail.status_dokumen }}</span></div>
      <fieldset class="receipt-panel" :disabled="busy"><legend>Rincian faktur</legend>
        <label v-for="invoice in detail.invoices" :key="invoice.id" class="invoice"><input v-if="detail.status_dokumen === 'MENUNGGU_PENERIMAAN'" v-model="checked" type="checkbox" :value="invoice.id"/><span><b>{{ invoice.no_faktur }}</b><br/>{{ invoice.nama_customer }}<br/>Sisa piutang: {{ money(invoice.remaining) }}</span></label>
      </fieldset>
      <button v-if="detail.status_dokumen === 'MENUNGGU_PENERIMAAN'" class="primary-button full-button" :disabled="busy || !network.isOnline || !allChecked" @click="accept">Terima LPH</button>
      <aside v-if="detail.status_dokumen === 'AKTIF' && !returning" class="receipt-panel"><h3>Pencatatan penerimaan</h3><p>Catat pembayaran dari kunjungan customer atau menu Pembayaran di Beranda. Semua catatan otomatis masuk rekap LPH ini.</p><button class="primary-button full-button" @click="router.push('/payment')">Buka Pembayaran</button></aside>
      <h3 class="claims-title">Klaim tercatat</h3>
      <dl class="collection-summary" aria-label="Ringkasan penerimaan Sales"><div><dt>Total Uang Diperoleh</dt><dd>{{ money(collection.total) }}</dd></div><div><dt>Tunai</dt><dd>{{ money(collection.cash) }}</dd></div><div><dt>Transfer</dt><dd>{{ money(collection.transfer) }}</dd></div><div><dt>Giro</dt><dd>{{ money(collection.giro) }}</dd></div></dl>
      <article v-for="claim in detail.claims" :key="claim.id" class="invoice claim-row"><span>{{ detail.invoices.find(i => i.id === claim.id_faktur)?.no_faktur }} · {{ labels[claim.method] }}<br/><b>{{ money(claim.amount) }}</b><template v-if="claim.method === 'GIRO'"><br/>{{ claim.giro_number }} · {{ claim.bank }} · {{ date(claim.due_date) }}</template></span><button v-if="detail.status_dokumen === 'AKTIF'" class="danger-button" :disabled="busy || !network.isOnline" @click="removeClaim(claim)">Hapus</button></article>
      <p v-if="!detail.claims.length" class="no-claims">Belum ada klaim pembayaran yang dicatat.</p>
      <button v-if="detail.status_dokumen === 'AKTIF' && !returning" class="secondary-button full-button return-button" :disabled="busy || !network.isOnline" @click="returning = true">Kembalikan LPH</button>
      <form v-if="returning && detail.status_dokumen === 'AKTIF'" class="receipt-panel return-form" @submit.prevent="submitReturn"><h3>Konfirmasi pengembalian LPH</h3><fieldset :disabled="busy || !network.isOnline"><label>Bagian cash yang ditransfer (Rp)<input v-model="transfer" type="number" min="0" step="0.01" inputmode="decimal" required/></label><p v-if="split" class="remaining-note">Cash diserahkan ke Kasir: <b>{{ money(split.cash_to_cashier) }}</b></p><p v-else class="error">Nominal transfer harus valid dan tidak melebihi klaim tunai.</p><p>Sesudah dikembalikan, klaim tidak dapat diubah. Sisa cash dibuat sebagai setoran menunggu approval Kasir.</p><div class="return-actions"><button class="primary-button" :disabled="!split" type="submit">Konfirmasi Pengembalian</button><button class="secondary-button" type="button" @click="returning = false">Batal</button></div></fieldset></form>
      <p v-if="detail.handover" class="handover-note">Cash ditransfer: {{ money(detail.handover.cash_transfer) }} · Cash ke Kasir: {{ money(detail.handover.cash_to_cashier) }}</p>
    </section>
    </div>
  </main>
</template>

<style scoped>
.receipt-lph { width: 100%; min-height: 100dvh; margin: 0 auto; color: var(--app-body-text); text-align: left; }
.receipt-content { max-width: 760px; margin: 0 auto; padding: 18px 16px calc(32px + env(safe-area-inset-bottom)); }
.receipt-lph h2 { margin: 0; font-size: 1.1rem; font-weight: 800; letter-spacing: -.02em; }
.receipt-lph h3 { font-size: 1rem; font-weight: 800; margin: 0 0 16px; }
button { font: inherit; cursor: pointer; }
button:disabled { opacity: .5; cursor: default; }
.workflow-note { display: flex; align-items: flex-start; gap: 10px; padding: 14px; margin-bottom: 22px; border: 1px solid var(--sales-info-border); border-radius: 14px; background: var(--sales-info-bg); color: var(--sales-info-text); }
.workflow-note > svg { flex: 0 0 auto; margin-top: 3px; }
.workflow-note p { margin: 0; font-size: .78rem; line-height: 1.6; }
.cards { display: grid; gap: 12px; }
.list-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.list-heading span { color: var(--app-text-muted); font-size: .75rem; }
.document-card { display: flex; align-items: center; gap: 12px; width: 100%; padding: 16px; text-align: left; color: inherit; background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 16px; box-shadow: var(--app-shadow-sm); }
.document-icon { display: grid; place-items: center; flex: 0 0 42px; height: 46px; border-radius: 12px; background: var(--sales-info-bg); color: var(--sales-info-text); }
.document-copy { flex: 1; min-width: 0; }
.document-copy b, .document-copy small { display: block; }
.document-copy b { font-size: .88rem; overflow-wrap: anywhere; }
.document-copy small { margin: 3px 0 9px; color: var(--app-text-muted); font-size: .75rem; }
.document-arrow { color: var(--app-text-muted); flex-shrink: 0; font-size: .75rem; }
.document-status { display: inline-block; border-radius: 7px; padding: 4px 8px; font-size: .69rem; font-weight: 800; background: var(--app-surface-muted); color: var(--app-text-muted); }
.document-status[data-status='MENUNGGU_PENERIMAAN'] { color: var(--sales-warning-text); background: var(--sales-warning-bg); }
.document-status[data-status='AKTIF'] { color: var(--sales-success-text); background: var(--sales-success-bg); }
.receipt-empty { padding: 32px 20px; border: 1px dashed var(--app-border); border-radius: 16px; text-align: center; background: var(--app-surface); }
.receipt-empty > svg { color: var(--sales-info-text); font-size: 1.8rem; margin-bottom: 16px; }
.receipt-empty h3 { margin-bottom: 8px; }
.receipt-empty p, .no-claims { color: var(--app-text-muted); font-size: .82rem; line-height: 1.6; }
.receipt-detail { min-width: 0; }
.detail-title { padding: 18px 0 12px; }
.detail-title h2 { margin: 6px 0 10px; overflow-wrap: anywhere; }
fieldset { min-width: 0; border: 0; padding: 0; margin: 0; }
.receipt-panel { padding: 18px 16px; border: 1px solid var(--app-border); border-radius: 16px; background: var(--app-surface); margin: 16px 0; }
fieldset.receipt-panel { padding-top: 8px; }
legend { padding: 0 6px; font-size: .88rem; font-weight: 800; }
label { display: block; margin: 14px 0; font-size: .8rem; font-weight: 650; }
input:not([type=checkbox]), select { display: block; width: 100%; min-height: 48px; padding: 12px; margin-top: 8px; border: 1px solid var(--app-border); border-radius: 10px; background: var(--app-surface-soft); color: inherit; font: inherit; font-size: 1rem; }
.invoice { display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--app-border); padding: 14px 0; margin: 0; font-size: .8rem; font-weight: 400; line-height: 1.8; }
.invoice:last-child { border-bottom: 0; }
.invoice > span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.invoice input { width: 22px; height: 22px; flex: 0 0 22px; accent-color: #2563eb; }
.claim-row { padding: 14px; margin: 10px 0; background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 12px; }
.claim-row:last-child { border-bottom: 1px solid var(--app-border); }
.remaining-note { padding: 12px; background: var(--sales-info-bg); color: var(--sales-info-text); border-radius: 10px; font-size: .78rem; line-height: 1.6; }
.remaining-note strong { display: block; }
.collection-summary { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin: 14px 0; }
.collection-summary div { padding: 14px 12px; border: 1px solid var(--app-border); border-radius: 12px; background: var(--app-surface); }
.collection-summary div:first-child { grid-column: 1 / -1; background: var(--sales-info-bg); border-color: var(--sales-info-border); color: var(--sales-info-text); }
.collection-summary dt { font-size: .75rem; }
.collection-summary dd { margin: 7px 0 0; font-size: .92rem; font-weight: 800; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.collection-summary div:first-child dd { font-size: 1.4rem; }
.primary-button, .secondary-button, .danger-button { min-height: 46px; border-radius: 11px; padding: 12px 16px; font-weight: 750; font-size: .82rem; line-height: 1.5; }
.primary-button { background: #2563eb; color: #fff; border: 1px solid #2563eb; }
.secondary-button { background: var(--app-surface); color: var(--sales-info-text); border: 1px solid var(--app-border); }
.danger-button { background: var(--sales-danger-bg); color: var(--sales-danger-text); border: 0; }
.text-button { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 0; background: transparent; border: 0; color: var(--sales-info-text); font-size: .82rem; font-weight: 700; }
.legacy-link { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
.full-button { display: block; width: 100%; }
.return-button, .claims-title { margin-top: 24px !important; }
.return-actions { display: grid; gap: 10px; }
.return-form p, .handover-note { font-size: .8rem; line-height: 1.7; }
.return-form > h3 { line-height: 1.5; }
.error, .warning, .success { padding: 14px; border-radius: 12px; font-size: .82rem; line-height: 1.6; }
.error { background: var(--sales-danger-bg); color: var(--sales-danger-text); }
.warning { background: var(--sales-warning-bg); color: var(--sales-warning-text); }
.success { background: var(--sales-success-bg); color: var(--sales-success-text); }
.processing { color: var(--app-text-muted); font-size: .8rem; }
@media (min-width: 600px) { .collection-summary { grid-template-columns: repeat(3,minmax(0,1fr)); } }
</style>

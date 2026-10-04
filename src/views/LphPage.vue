<template>
  <main class="lph-page">
    <header class="page-header">
      <button class="back-button" type="button" aria-label="Kembali" @click="router.back()">
        <font-awesome-icon icon="chevron-left" />
      </button>
      <div class="header-copy">
        <p class="eyebrow">Dokumen Penagihan</p>
        <h1>LPH Saya</h1>
        <p>Terima LPH sebelum faktur dapat dipakai pada menu Pembayaran.</p>
      </div>
      <button class="refresh-button" type="button" :disabled="loading || submittingId !== null" @click="loadLph">
        <font-awesome-icon :icon="loading ? 'sync-alt' : 'rotate-right'" :class="{ spinning: loading }" />
      </button>
    </header>

    <button class="accept-action" type="button" @click="router.push('/lph-kuitansi')">LPH & Klaim Pembayaran (Kuitansi)</button>
    <section class="guide-card">
      <div class="guide-step">
        <span>1</span>
        <div><strong>Terima LPH</strong><small>LPH menjadi aktif untuk sales.</small></div>
      </div>
      <div class="guide-step">
        <span>2</span>
        <div><strong>Tagih pelanggan</strong><small>Faktur LPH muncul pada Pembayaran.</small></div>
      </div>
      <div class="guide-step">
        <span>3</span>
        <div><strong>Kembalikan LPH</strong><small>Tutup akses faktur saat dokumen dikembalikan.</small></div>
      </div>
    </section>

    <section class="summary-grid">
      <article class="summary-card waiting"><span>Menunggu diterima</span><strong>{{ waitingCount }}</strong></article>
      <article class="summary-card active"><span>LPH aktif</span><strong>{{ activeCount }}</strong></article>
      <article class="summary-card returned"><span>Dikembalikan</span><strong>{{ returnedCount }}</strong></article>
    </section>

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    <section v-if="loading" class="state-card"><div class="spinner"></div><p>Memuat daftar LPH…</p></section>
    <section v-else-if="rows.length === 0" class="state-card"><font-awesome-icon icon="clipboard-check" /><h2>Belum ada LPH</h2><p>LPH yang diserahkan untuk akun sales ini akan muncul di sini.</p></section>

    <section v-else class="lph-list">
      <article v-for="item in rows" :key="item.id_lph" class="lph-card" :class="statusClass(item.status_dokumen)">
        <div class="card-top">
          <div>
            <p class="document-label">{{ resolveLphType(item.is_cp) }}</p>
            <h2>{{ item.kode_lph }}</h2>
            <p class="date-label">{{ formatDate(item.tanggal_lph) }} · {{ item.jumlah_faktur || 0 }} faktur</p>
          </div>
          <span class="status-pill" :class="statusClass(item.status_dokumen)">{{ item.status_label }}</span>
        </div>

        <div class="card-stats">
          <div><span>Total tagihan</span><strong>{{ formatMoney(item.total_faktur || item.jumlah_ditagih) }}</strong></div>
          <div><span>Retur</span><strong>{{ formatMoney(item.total_retur) }}</strong></div>
        </div>

        <p v-if="item.daftar_faktur" class="invoice-preview">{{ item.daftar_faktur }}</p>

        <div class="card-actions">
          <button class="secondary-action" type="button" @click="toggleDetail(item.id_lph)">
            {{ openDetailId === item.id_lph ? 'Tutup rincian' : 'Lihat rincian' }}
          </button>
          <button v-if="item.can_accept" class="accept-action" type="button" :disabled="submittingId !== null || !canAccept(item)" @click="acceptLph(item)">
            {{ submittingId === item.id_lph ? 'Memproses…' : 'Terima LPH' }}
          </button>
          <button v-if="item.can_return" class="return-action" type="button" :disabled="submittingId !== null || returnLoading" @click="returnLph(item)">
            {{ submittingId === item.id_lph ? 'Memproses…' : 'Kembalikan LPH' }}
          </button>
        </div>
        <p v-if="item.can_accept" class="review-hint">Buka rincian dan cocokkan semua faktur dengan dokumen cetak sebelum menerima LPH.</p>

        <section v-if="openDetailId === item.id_lph" class="detail-panel">
          <p v-if="detailLoading" class="detail-state">Memuat rincian…</p>
          <p v-else-if="detailError" class="detail-error">{{ detailError }}</p>
          <template v-else>
            <p class="detail-heading">Rincian LPH <span v-if="item.can_accept">({{ checkedCount }}/{{ detailRows.length }} sesuai)</span></p>
            <div class="invoice-table-wrap">
              <table class="invoice-table">
                <thead><tr>
                  <th v-if="item.can_accept"><input type="checkbox" aria-label="Semua faktur sesuai" :checked="allChecked" :indeterminate="checkedCount > 0 && !allChecked" :disabled="submittingId !== null" @change="setAllChecked($event.target.checked)" /></th>
                  <th>Faktur / Customer</th><th>Tagihan LPH</th><th>Sisa tagihan</th>
                </tr></thead>
                <tbody><tr v-for="line in detailRows" :key="line.id">
                  <td v-if="item.can_accept"><input v-model="checkedDetails[String(line.id)]" type="checkbox" :aria-label="`Faktur ${line.no_faktur || line.no_order} sesuai`" :disabled="submittingId !== null" /></td>
                  <td><strong>{{ line.no_faktur || line.no_order || 'Tanpa nomor faktur' }}</strong><small>{{ line.nama_customer || '-' }}</small></td>
                  <td>{{ formatMoney(line.jumlah_tagihan) }}</td><td>{{ formatMoney(line.sisa_tagihan) }}</td>
                </tr></tbody>
              </table>
            </div>
            <p v-if="item.can_accept && !allChecked" class="review-hint">Semua faktur harus sesuai sebelum LPH diterima. Hubungi admin jika dokumen belum cocok.</p>
            <p v-if="detailRows.length === 0" class="detail-state">Tidak ada faktur pada LPH ini.</p>
          </template>
        </section>
      </article>
    </section>

    <div v-if="returnItem" class="handover-overlay" @click.self="closeReturn">
      <section class="handover-dialog" role="dialog" aria-modal="true" aria-labelledby="return-title">
        <h2 id="return-title">Pengembalian LPH</h2>
        <p>{{ returnItem.kode_lph }}</p>
        <p class="review-hint">Nominal otomatis dari pembayaran Mobile Sales yang sudah tersimpan untuk LPH ini.</p>
        <label>Total tunai<input :value="formatMoney(returnSummary.tunai)" readonly aria-label="Total tunai" /></label>
        <label>Total non tunai<input :value="formatMoney(returnSummary.non_tunai)" readonly aria-label="Total non tunai" /></label>
        <label>Total pembayaran<input :value="formatMoney(returnSummary.total)" readonly aria-label="Total pembayaran" /></label>
        <label>Catatan pengembalian<textarea v-model="returnNote" rows="3" maxlength="2000" :disabled="submittingId !== null" placeholder="Catatan pengembalian (opsional)" /></label>
        <p v-if="returnError" class="detail-error" role="alert">{{ returnError }}</p>
        <div class="card-actions">
          <button class="secondary-action" type="button" :disabled="submittingId !== null" @click="closeReturn">Batal</button>
          <button class="return-action" type="button" :disabled="submittingId !== null || returnBlocked" @click="submitReturn">{{ submittingId !== null ? 'Memproses…' : 'Kembalikan LPH' }}</button>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Swal from 'sweetalert2';
import api from '@/api/axios';
import { SyncService } from '@/services/SyncService';
import { allLphInvoicesChecked, groupLphInvoices } from '@/utils/lphHandover';

const router = useRouter();
const rows = ref([]);
const loading = ref(false);
const errorMessage = ref('');
const submittingId = ref(null);
const openDetailId = ref(null);
const detailRows = ref([]);
const detailLoading = ref(false);
const detailError = ref('');
const checkedDetails = ref({});
let detailRequestSequence = 0;
const returnItem = ref(null);
const returnSummary = ref({ tunai: 0, non_tunai: 0, total: 0 });
const returnNote = ref('');
const returnError = ref('');
const returnLoading = ref(false);
const returnBlocked = ref(false);
const checkedCount = computed(() => detailRows.value.filter((line) => checkedDetails.value[String(line.id)]).length);
const allChecked = computed(() => allLphInvoicesChecked(detailRows.value, checkedDetails.value));
const canAccept = (item) => openDetailId.value === item.id_lph && !detailLoading.value && !detailError.value && allChecked.value;
const setAllChecked = (checked) => { checkedDetails.value = Object.fromEntries(detailRows.value.map((line) => [String(line.id), checked])); };

const waitingCount = computed(() => rows.value.filter((item) => item.status_dokumen === 'MENUNGGU_PENERIMAAN').length);
const activeCount = computed(() => rows.value.filter((item) => item.status_dokumen === 'AKTIF').length);
const returnedCount = computed(() => rows.value.filter((item) => item.status_dokumen === 'DIKEMBALIKAN').length);

const statusClass = (status) => ({
  'MENUNGGU_PENERIMAAN': 'waiting',
  'AKTIF': 'active',
  'DIKEMBALIKAN': 'returned',
}[String(status || '').toUpperCase()] || 'returned');

const formatMoney = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}`;
const resolveLphType = (value) => {
  const type = Number(value || 0);
  if (type === 2) return 'LPH Gabungan';
  return type === 1 ? 'LPH Call Plan' : 'LPH Non Call Plan';
};
const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(parsed);
};

const normalizeRows = (payload) => {
  const source = Array.isArray(payload) ? payload : (payload?.data || payload?.rows || []);
  return Array.isArray(source) ? source.map((row) => ({
    ...row,
    id_lph: Number(row.id_lph || row.id),
    status_dokumen: String(row.status_dokumen || 'AKTIF').toUpperCase(),
    can_accept: Boolean(row.can_accept),
    can_return: Boolean(row.can_return),
  })) : [];
};

const loadLph = async () => {
  detailRequestSequence += 1;
  openDetailId.value = null;
  detailRows.value = [];
  checkedDetails.value = {};
  loading.value = true;
  errorMessage.value = '';
  try {
    const [response, workflow] = await Promise.all([
      api.get('/api/lph'),
      api.get('/api/mobile/workflow/lphs').catch(error => { if (error?.response?.status === 404) return { data:{ data:[] } }; throw error; })
    ]);
    const receiptIds = new Set((workflow.data?.data || []).map(row => Number(row.id)));
    rows.value = normalizeRows(response.data).filter(row => Number(row.payment_workflow_version || 1) !== 2 && !receiptIds.has(row.id_lph));
  } catch (error) {
    rows.value = [];
    errorMessage.value = error?.response?.data?.message || error?.message || 'Daftar LPH belum dapat dimuat.';
  } finally {
    loading.value = false;
  }
};

const toggleDetail = async (idLph) => {
  const sequence = ++detailRequestSequence;
  if (openDetailId.value === idLph) {
    openDetailId.value = null;
    detailRows.value = [];
    return;
  }
  openDetailId.value = idLph;
  detailRows.value = [];
  checkedDetails.value = {};
  detailError.value = '';
  detailLoading.value = true;
  try {
    const response = await api.get(`/api/lph/${idLph}`);
    if (sequence !== detailRequestSequence) return;
    detailRows.value = groupLphInvoices(response?.data?.data?.details || []);
    setAllChecked(true);
  } catch (error) {
    if (sequence !== detailRequestSequence) return;
    detailError.value = error?.response?.data?.message || 'Rincian LPH belum dapat dimuat.';
  } finally {
    if (sequence === detailRequestSequence) detailLoading.value = false;
  }
};

const acceptLph = async (item) => {
  if (!canAccept(item) || submittingId.value !== null) return;
  const checkedDetailIds = detailRows.value.map((line) => Number(line.id));
  const confirm = await Swal.fire({
    title: 'Terima LPH?',
    text: `${checkedDetailIds.length} faktur sudah sesuai dengan dokumen cetak. Faktur akan aktif untuk pembayaran.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Terima LPH',
    cancelButtonText: 'Batal',
  });
  if (!confirm.isConfirmed) return;

  submittingId.value = item.id_lph;
  try {
    const response = await api.post(`/api/lph/${item.id_lph}/accept`, { checked_detail_ids: checkedDetailIds });
    await Swal.fire('LPH diterima', response?.data?.message || 'LPH sudah aktif.', 'success');
    await loadLph();
  } catch (error) {
    await Swal.fire('Gagal', error?.response?.data?.message || 'LPH belum dapat diterima.', 'error');
  } finally {
    submittingId.value = null;
  }
};

const returnLph = async (item) => {
  if (returnLoading.value || submittingId.value !== null) return;
  returnLoading.value = true;
  try {
    if (await SyncService.hasPendingPaymentData({ strict: true })) throw new Error('Masih ada pembayaran offline. Sinkronkan pembayaran terlebih dahulu agar nominal LPH lengkap.');
    const response = await api.get(`/api/lph/${item.id_lph}`);
    const summary = response?.data?.data?.payment_summary;
    if (!summary || !['tunai', 'non_tunai', 'total'].every((key) => Number.isFinite(Number(summary[key])))) throw new Error('Ringkasan pembayaran belum tersedia. Muat ulang atau hubungi admin.');
    returnSummary.value = summary;
    returnNote.value = '';
    returnBlocked.value = Number(summary.unassigned_count || 0) > 0 || Number(summary.unknown_method_count || 0) > 0;
    returnError.value = returnBlocked.value ? 'Ada pembayaran yang belum cocok ke LPH/metode bayar. Hubungi admin sebelum pengembalian.' : '';
    returnItem.value = item;
  } catch (error) {
    await Swal.fire('Belum dapat dikembalikan', error?.response?.data?.message || error.message, 'error');
  } finally {
    returnLoading.value = false;
  }
};

const closeReturn = () => { if (submittingId.value === null) returnItem.value = null; };

const submitReturn = async () => {
  if (!returnItem.value || returnBlocked.value || submittingId.value !== null) return;
  const item = returnItem.value;
  submittingId.value = item.id_lph;
  returnError.value = '';
  try {
    if (await SyncService.hasPendingPaymentData({ strict: true })) throw new Error('Sinkronkan pembayaran offline sebelum mengembalikan LPH.');
    const response = await api.post(`/api/lph/${item.id_lph}/return`, { catatan: returnNote.value, payment_summary: { tunai: returnSummary.value.tunai, non_tunai: returnSummary.value.non_tunai } });
    returnItem.value = null;
    await Swal.fire('LPH dikembalikan', response?.data?.message || 'Dokumen sudah ditandai dikembalikan.', 'success');
    await loadLph();
  } catch (error) {
    returnError.value = error?.response?.data?.message || error.message || 'LPH belum dapat dikembalikan.';
    if (error?.response?.status === 409) returnBlocked.value = true;
  } finally {
    submittingId.value = null;
  }
};

onMounted(loadLph);
</script>

<style scoped>
.lph-page, .lph-page * { box-sizing: border-box; }
.lph-page { min-width: 0; text-align: left; }
.lph-page h1, .lph-page h2 { color: inherit; }
.review-hint { color: #a5b8d1; font-size: .8rem; line-height: 1.5; margin: 12px 0; }
.invoice-table-wrap { overflow-x: auto; }
.invoice-table { width: 100%; border-collapse: collapse; font-size: .8rem; }
.invoice-table th, .invoice-table td { padding: 12px 8px; text-align: left; border-bottom: 1px solid #2b405e; }
.invoice-table th { color: #a5b8d1; }
.invoice-table td:nth-last-child(-n+2) { white-space: nowrap; }
.invoice-table small { display: block; margin-top: 5px; color: #a5b8d1; }
.invoice-table input { width: 20px; height: 20px; accent-color: #60a5fa; }
.handover-overlay { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 18px; background: #020617cc; }
.handover-dialog { width: 100%; min-width: 0; max-width: 480px; max-height: 90vh; overflow-y: auto; border: 1px solid var(--app-border); border-radius: 20px; background: var(--app-surface); color: var(--app-body-text); padding: 22px; }
.handover-dialog .review-hint { color: var(--app-text-muted); }
.handover-dialog h2 { margin-top: 0; }
.handover-dialog label { display: grid; gap: 7px; margin-top: 14px; font-size: .85rem; }
.handover-dialog input, .handover-dialog textarea { box-sizing: border-box; width: 100%; padding: 12px; border: 1px solid #2b405e; border-radius: 10px; color: #e5edf9; background: #07111f; font: inherit; }
.handover-dialog input[readonly] { color: #a7f3d0; font-weight: 700; }
.card-actions button:disabled { opacity: .45; cursor: not-allowed; }
.lph-page { min-height: 100vh; padding: 22px 16px 38px; color: #e5edf9; background: radial-gradient(circle at 100% 0, #1e3a5f 0, transparent 32%), #07111f; }
.page-header { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; align-items: start; gap: 12px; margin-bottom: 20px; }
.back-button, .refresh-button { width: 44px; height: 44px; color: #dbeafe; border: 1px solid #2b405e; border-radius: 14px; background: #0d1b2e; }
.refresh-button:disabled { opacity: .55; }
.header-copy h1 { margin: 2px 0 5px; font-size: 1.45rem; }.header-copy p { margin: 0; color: #9eb1c9; font-size: .85rem; line-height: 1.4; }.eyebrow, .document-label { margin: 0; color: #77a9ff; font-size: .69rem !important; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.guide-card { display: grid; gap: 10px; padding: 14px; border: 1px solid #24476c; border-radius: 18px; background: linear-gradient(135deg, rgba(22, 63, 102, .85), rgba(12, 31, 52, .88)); }.guide-step { display: flex; gap: 10px; align-items: center; }.guide-step > span { display: grid; width: 24px; height: 24px; place-items: center; color: #07111f; border-radius: 50%; background: #65a7ff; font-size: .76rem; font-weight: 800; }.guide-step div { display: grid; gap: 2px; }.guide-step strong { font-size: .82rem; }.guide-step small { color: #a6bbd1; font-size: .72rem; }
.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin: 16px 0; }.summary-card { min-width: 0; padding: 13px 10px; border: 1px solid #24364d; border-radius: 14px; background: #0d1b2e; }.summary-card span { display: block; min-height: 29px; color: #9db0c8; font-size: .66rem; line-height: 1.25; }.summary-card strong { display: block; margin-top: 5px; font-size: 1.45rem; }.summary-card.waiting strong { color: #facc15; }.summary-card.active strong { color: #4ade80; }.summary-card.returned strong { color: #94a3b8; }
.error-message { margin: 0 0 14px; padding: 12px; color: #fecaca; border: 1px solid #7f1d1d; border-radius: 13px; background: #3b121e; font-size: .83rem; }.state-card { display: grid; min-height: 200px; place-content: center; gap: 10px; padding: 22px; text-align: center; color: #9eb1c9; border: 1px dashed #38516e; border-radius: 18px; background: #0b1829; }.state-card svg { margin: auto; color: #6fa9ff; font-size: 2rem; }.state-card h2 { margin: 0; color: #e8f0ff; font-size: 1rem; }.state-card p { max-width: 260px; margin: 0; font-size: .84rem; }.spinner { width: 26px; height: 26px; margin: auto; border: 3px solid #315576; border-top-color: #79afff; border-radius: 50%; animation: spin .7s linear infinite; }
.lph-list { display: grid; gap: 13px; }.lph-card { overflow: hidden; border: 1px solid #2b405e; border-left-width: 4px; border-radius: 18px; background: #0d1b2e; }.lph-card.waiting { border-left-color: #eab308; }.lph-card.active { border-left-color: #22c55e; }.lph-card.returned { border-left-color: #64748b; }.card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 15px 14px 11px; }.card-top h2 { margin: 4px 0; font-size: .97rem; word-break: break-word; }.date-label { margin: 0; color: #8ea3bd; font-size: .73rem; }.status-pill { max-width: 125px; padding: 6px 8px; border-radius: 999px; font-size: .67rem; font-weight: 800; text-align: center; }.status-pill.waiting { color: #fef3c7; background: #854d0e; }.status-pill.active { color: #dcfce7; background: #166534; }.status-pill.returned { color: #e2e8f0; background: #475569; }
.card-stats { display: grid; grid-template-columns: 1fr 1fr; margin: 0 14px; border: 1px solid #22354e; border-radius: 12px; background: #091727; }.card-stats div { padding: 10px; }.card-stats div + div { border-left: 1px solid #22354e; }.card-stats span, .invoice-preview { color: #91a7bf; font-size: .7rem; }.card-stats strong { display: block; margin-top: 3px; color: #edf5ff; font-size: .82rem; }.invoice-preview { overflow: hidden; margin: 11px 14px 0; text-overflow: ellipsis; white-space: nowrap; }.card-actions { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px; }.card-actions button { min-height: 38px; padding: 0 12px; border-radius: 10px; font-size: .77rem; font-weight: 750; }.secondary-action { color: #c4d6eb; border: 1px solid #36516f; background: #10233a; }.accept-action { color: #052e16; border: 0; background: #86efac; }.return-action { color: #fff7ed; border: 0; background: #be123c; }.card-actions button:disabled { opacity: .55; }
.detail-panel { margin: 0 14px 14px; padding: 12px; border: 1px solid #243c59; border-radius: 12px; background: #081525; }.detail-heading { margin: 0 0 8px; color: #a8c7eb; font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }.invoice-line { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-top: 1px solid #1d324a; }.invoice-line > div { display: grid; gap: 2px; min-width: 0; }.invoice-line strong { overflow: hidden; color: #e5eef9; font-size: .78rem; text-overflow: ellipsis; white-space: nowrap; }.invoice-line span { color: #90a6bf; font-size: .7rem; }.line-amount { text-align: right; }.detail-state, .detail-error { margin: 0; color: #9eb1c9; font-size: .78rem; }.detail-error { color: #fca5a5; }
.spinning { animation: spin .7s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>

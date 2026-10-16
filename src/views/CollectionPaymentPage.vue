<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api/axios';
import { useConnectivityStore } from '@/stores/connectivity';
import { collectionMethods, collectionPayload } from '@/utils/mobileCollections';
import { workflowError } from '@/utils/receiptWorkflow';

const route = useRoute(), router = useRouter(), network = useConnectivityStore();
const customers = ref([]), invoices = ref([]), customer = ref(''), customerId = ref(''), invoiceKey = ref(''), search = ref('');
const loading = ref(false), saving = ref(false), error = ref(''), success = ref(''), hasMore = ref(false), needsReload = ref(false);
const form = reactive({ amount: '', method: 'CASH', payment_reference: '', giro_number: '', bank: '', due_date: '' });
const visitId = computed(() => String(route.query.id_kunjungan || route.query.id || '').trim());
const selectedCustomer = computed(() => customers.value.find(c => String(c.id) === customerId.value));
const selectedInvoice = computed(() => invoices.value.find(i => `${i.id_lph}:${i.id}` === invoiceKey.value));
const busy = computed(() => loading.value || saving.value);
const money = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 }).format(Number(value || 0));
let version = 0, timer, claimKey = null;
watch(() => JSON.stringify([form, invoiceKey.value, customer.value, visitId.value]), () => { claimKey = null; });
function resetForm() { invoiceKey.value = ''; Object.assign(form, { amount: '', method: 'CASH', payment_reference: '', giro_number: '', bank: '', due_date: '' }); }
async function readOptions(code = '', searching = false) {
  if (!network.isOnline) { error.value = 'Hubungkan internet untuk memuat LPH dan mencatat penerimaan. Alur baru tidak memakai antrean pembayaran lama.'; return; }
  const requestVersion = ++version;
  loading.value = true; error.value = '';
  try {
    const result = (await api.get('/api/mobile/workflow/collection-options', { params: {
      kode_customer: code, id_customer: code ? customerId.value || undefined : undefined,
      id_kunjungan: visitId.value || undefined, search: searching ? search.value : undefined
    } })).data.data;
    if (requestVersion !== version) return;
    if (!result || !Array.isArray(result.customers) || !Array.isArray(result.invoices)) throw new Error('Respons pembayaran belum sesuai. Perbarui API server.');
    const current = selectedCustomer.value;
    if (!code || visitId.value) customers.value = result.customers;
    else for (const row of result.customers) if (!customers.value.some(c => c.id === row.id)) customers.value.push(row);
    if (current && !customers.value.some(c => c.id === current.id)) customers.value.unshift(current);
    hasMore.value = result.has_more_customers;
    if (code || visitId.value) invoices.value = result.invoices;
    needsReload.value = false;
  } catch (e) {
    if (requestVersion === version) { error.value = e.response?.status === 404 ? 'API pembayaran baru belum tersedia. Update API sebelum memakai fitur ini.' : workflowError(e); needsReload.value = true; }
  } finally { if (requestVersion === version) loading.value = false; }
}
async function chooseCustomer() {
  resetForm(); invoices.value = []; success.value = '';
  customer.value = selectedCustomer.value?.kode || '';
  if (customer.value) await readOptions(customer.value);
}
async function initialize() {
  customer.value = ''; customerId.value = ''; customers.value = []; invoices.value = []; success.value = ''; search.value = ''; resetForm();
  const code = String(route.query.kode_customer || '').trim();
  await readOptions(code);
  const matches = customers.value.filter(c => !code || c.kode === code);
  const initial = matches.length === 1 && (code || visitId.value) ? matches[0] : null;
  customer.value = initial?.kode || ''; customerId.value = initial ? String(initial.id) : '';
  if (!initial) invoices.value = [];
  if (route.query.nota) invoiceKey.value = invoices.value.find(i => i.no_faktur === route.query.nota)?.id
    ? `${invoices.value.find(i => i.no_faktur === route.query.nota).id_lph}:${invoices.value.find(i => i.no_faktur === route.query.nota).id}` : '';
}
async function save() {
  if (busy.value || needsReload.value) return;
  if (!network.isOnline) { error.value = 'Penerimaan belum dikirim. Hubungkan internet lalu coba lagi; data form tetap disimpan di halaman ini.'; return; }
  try {
    claimKey ||= crypto.randomUUID();
    const invoice = selectedInvoice.value;
    const payload = collectionPayload(form, invoice, visitId.value, claimKey);
    saving.value = true; error.value = ''; success.value = '';
    await api.post(`/api/mobile/workflow/lphs/${invoice.id_lph}/claims`, payload);
    success.value = 'Penerimaan tercatat, menunggu rekonsiliasi Finance. Piutang belum berkurang.';
    resetForm();
    await readOptions(customer.value);
  } catch (e) { error.value = workflowError(e); }
  finally { saving.value = false; }
}
watch(search, () => { clearTimeout(timer); if (!visitId.value && !saving.value) timer = setTimeout(() => readOptions('', true), 300); });
watch(() => route.fullPath, initialize, { immediate: true });
onBeforeUnmount(() => { clearTimeout(timer); version++; });
</script>

<template>
  <main class="sales-ui sales-document-page sales-v2 sales-collection-page">
    <header class="sales-header">
      <button aria-label="Kembali" :disabled="saving" @click="router.back()"><font-awesome-icon icon="chevron-left" /></button>
      <div><p class="sales-eyebrow">Penerimaan Customer</p><h1>Pembayaran</h1><p>{{ visitId ? 'Dari Call Plan · customer kunjungan' : 'Di luar kunjungan · tanpa check-in' }}</p></div>
      <button aria-label="Muat ulang" :disabled="busy" @click="readOptions(customer)"><font-awesome-icon icon="sync-alt" :spin="loading" /></button>
    </header>
    <div class="sales-page-content">
      <p class="sales-notice info">Catat uang yang diterima. Saldo tagihan berubah setelah Finance menyelesaikan rekonsiliasi dan approval kuitansi.</p>
      <p v-if="!network.isOnline" class="sales-notice warning">Offline — pencatatan baru memerlukan internet.</p>
      <p v-if="error" class="sales-notice danger" role="alert">{{ error }}</p>
      <p v-if="success" class="sales-notice success" role="status">{{ success }}</p>
      <section class="sales-surface">
        <div class="sales-section-title"><h2>Customer & faktur</h2><span class="sales-pill">{{ visitId ? 'Call Plan' : 'Di luar kunjungan' }}</span></div>
        <template v-if="!visitId">
          <label class="sales-form-label">Cari customer<input v-model="search" class="sales-input" type="search" placeholder="Nama atau kode customer" :disabled="saving" /></label>
          <label class="sales-form-label">Customer<select aria-label="Customer" v-model="customerId" class="sales-input" :disabled="busy" @change="chooseCustomer"><option value="">Pilih customer</option><option v-for="c in customers" :key="c.id" :value="String(c.id)">{{ c.kode }} · {{ c.nama }}</option></select></label>
          <p v-if="hasMore" class="sales-muted">Daftar dibatasi 200 customer. Ketik nama/kode untuk mencari customer lainnya.</p>
        </template>
        <div v-else class="sales-customer-context"><strong>{{ selectedCustomer?.nama || route.query.nama_toko || 'Customer kunjungan' }}</strong><small>{{ selectedCustomer?.kode || route.query.kode_customer }}</small></div>
        <p v-if="loading" role="status" class="sales-muted">Memuat data terbaru…</p>
        <label class="sales-form-label">Faktur dari LPH aktif<select aria-label="Faktur dari LPH aktif" v-model="invoiceKey" class="sales-input" :disabled="busy || !customer || needsReload"><option value="">Pilih faktur</option><option v-for="i in invoices" :key="`${i.id_lph}:${i.id}`" :value="`${i.id_lph}:${i.id}`" :disabled="Number(i.available_to_collect)<=0">{{ i.no_faktur }} · {{ i.kode_lph }} · {{ money(i.available_to_collect) }}</option></select></label>
        <p v-if="!loading && !invoices.length" class="sales-empty">{{ customer || visitId ? 'Belum ada faktur customer ini pada LPH aktif. Terima LPH terlebih dahulu atau periksa dokumen dengan admin.' : 'Pilih customer untuk menampilkan faktur yang dapat ditagih.' }}</p>
        <dl v-if="selectedInvoice" class="sales-kv-list"><div><dt>LPH</dt><dd>{{ selectedInvoice.kode_lph }}</dd></div><div><dt>Sisa piutang</dt><dd>{{ money(selectedInvoice.remaining) }}</dd></div><div><dt>Sudah dicatat, belum final</dt><dd>{{ money(selectedInvoice.pending_amount) }}</dd></div><div><dt>Dapat dicatat</dt><dd>{{ money(selectedInvoice.available_to_collect) }}</dd></div></dl>
      </section>
      <form v-if="selectedInvoice" class="sales-surface" @submit.prevent="save">
        <h2>Catat penerimaan</h2>
        <fieldset :disabled="busy || needsReload || !network.isOnline">
          <label class="sales-form-label">Metode<select aria-label="Metode" v-model="form.method" class="sales-input"><option v-for="(label, key) in collectionMethods" :key="key" :value="key">{{ label }}</option></select></label>
          <label class="sales-form-label">Nominal (Rp)<input v-model="form.amount" class="sales-input" type="number" min="0.01" step="0.01" :max="selectedInvoice.available_to_collect" inputmode="decimal" required /></label>
          <label class="sales-form-label">{{ form.method === 'TRANSFER' ? 'Referensi / bukti transfer' : 'Referensi penerimaan (opsional)' }}<input v-model="form.payment_reference" class="sales-input" maxlength="200" :required="form.method === 'TRANSFER'" placeholder="Nomor referensi" /></label>
          <template v-if="form.method === 'GIRO'"><label class="sales-form-label">Nomor giro<input v-model="form.giro_number" class="sales-input" required maxlength="160" /></label><label class="sales-form-label">Bank<input v-model="form.bank" class="sales-input" required maxlength="160" /></label><label class="sales-form-label">Jatuh tempo<input v-model="form.due_date" class="sales-input" type="date" required /></label></template>
          <button class="sales-button primary full" type="submit">{{ saving ? 'Menyimpan…' : 'Simpan Penerimaan' }}</button>
        </fieldset>
      </form>
      <nav class="sales-surface sales-link-list" aria-label="Menu penagihan">
        <button v-if="customer" class="sales-button" :disabled="busy" @click="router.push({ path: '/payment-history', query: { kode_customer: customer, id_customer: customerId, nama_toko: selectedCustomer?.nama, id_kunjungan: visitId } })">Riwayat pembayaran customer <font-awesome-icon icon="chevron-right" /></button>
        <button class="sales-button" :disabled="busy" @click="router.push('/lph-kuitansi')">Terima / kembalikan LPH <font-awesome-icon icon="chevron-right" /></button>
        <button class="sales-button subtle" :disabled="busy" @click="router.push({ path: '/payment-legacy', query: route.query })">Pembayaran LPH sebelumnya</button>
      </nav>
    </div>
  </main>
</template>

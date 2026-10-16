<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import api from '@/api/axios';
import { getDb } from '@/services/database';
import { getPayloadArray } from '@/services/visitService';
import { useConnectivityStore } from '@/stores/connectivity';
import SalesPageHeader from '@/components/SalesPageHeader.vue';
import { collectionMethods, collectionOrigins } from '@/utils/mobileCollections';

const route = useRoute(), network = useConnectivityStore();
const customerCode = computed(() => String(route.query.kode_customer || '').trim());
const customerName = computed(() => String(route.query.nama_toko || 'Pelanggan'));
const loading = ref(false), error = ref(''), search = ref(''), legacy = ref([]), local = ref([]), collections = ref([]), linkedIds = ref([]), page = ref(1), hasMore = ref(false);
const money = value => new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:2 }).format(Number(value || 0));
const date = value => { const d = new Date(String(value || '').replace(' ', 'T')); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('id-ID', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); };
const receiptLabels = { PENDING:'Menunggu rekonsiliasi', DRAFT:'Kuitansi draf', FINALIZED:'Kuitansi difinalisasi', CANCEL_REQUESTED:'Pembatalan diajukan', CANCELLED:'Kuitansi dibatalkan' };
const rows = computed(() => {
  const items = [
    ...collections.value.map(c => ({ key:'claim:'+c.id, nota:c.no_faktur, amount:c.amount, method:collectionMethods[c.method] || c.method, status:receiptLabels[c.receipt_status] || 'Menunggu rekonsiliasi', pending:!['FINALIZED','CANCELLED'].includes(c.receipt_status), created_at:c.created_at, origin:collectionOrigins[c.entry_origin] || 'Dari LPH', lph:c.kode_lph, reference:c.payment_reference || c.giro_number || '—', receipt:c.receipt_number, giro:c.method==='GIRO' ? [c.bank,c.due_date].filter(Boolean).join(' · ') : '' })),
    ...legacy.value.filter(r=>!linkedIds.value.includes(Number(r.id))).map((r,i)=>({key:'legacy:'+(r.id||i),nota:r.nota||r.Nota,amount:r.total_bayar||r.jumlah_setoran,method:r.metode||r.tipe_setoran,status:r.status||r.status_pembayaran||'Alur sebelumnya',created_at:r.created_at,origin:'Alur sebelumnya',reference:r.no_bukti||'—'})),
    ...local.value.map((r,i)=>({key:'local:'+(r.payment_id||i),nota:r.nota,amount:r.total_bayar,method:r.metode,status:r.status_sync==='pending'?'Menunggu upload':r.status_pembayaran||'Tersimpan lokal',pending:true,created_at:r.created_at,origin:'Data lokal',reference:r.no_bukti||'—'}))
  ];
  return items.sort((a,b)=>(new Date(b.created_at).getTime()||0)-(new Date(a.created_at).getTime()||0));
});
const visible = computed(() => rows.value.filter(r => [r.nota,r.lph,r.method,r.status,r.origin,r.reference].join(' ').toLowerCase().includes(search.value.trim().toLowerCase())));
const total = computed(() => rows.value.reduce((s,r)=>s+Number(r.amount||0),0));
async function readLocal() {
  const db=getDb(); if(!db||!customerCode.value)return;
  const result=await db.query('SELECT * FROM payment_offline WHERE kode_customer = ? ORDER BY created_at DESC',[customerCode.value]);
  local.value=(result.values||[]).filter(r=>!network.isOnline||r.status_sync==='pending');
}
async function load(more=false) {
  if(loading.value)return; loading.value=true;error.value='';
  try {
    if(!more){page.value=1;collections.value=[];await readLocal();}
    if(!network.isOnline)return;
    const requests=[api.get('/api/mobile/workflow/collections',{params:{kode_customer:customerCode.value,id_customer:route.query.id_customer,id_kunjungan:route.query.id_kunjungan,page:page.value}})];
    if(!more)requests.push(api.get('/api/payment/history',{params:{kode_customer:customerCode.value,id_customer:route.query.id_customer,id_kunjungan:route.query.id_kunjungan,id_plafon:route.query.id_plafon}}));
    const results=await Promise.allSettled(requests);
    if(results[0].status==='fulfilled') {
      const data=results[0].value.data.data;
      if(!data||!Array.isArray(data.rows))throw new Error('Respons riwayat baru belum sesuai.');
      collections.value=more?[...collections.value,...data.rows]:data.rows;linkedIds.value=data.legacy_setoran_customer_ids||[];hasMore.value=data.has_more;
    } else { if(more)page.value--; error.value='Riwayat alur kuitansi belum dapat dimuat. Data yang tampil mungkin belum lengkap.'; }
    if(!more&&results[1].status==='fulfilled')legacy.value=getPayloadArray(results[1].value.data);
    else if(!more&&results[1].status==='rejected')error.value='Riwayat pembayaran lama belum dapat dimuat. Data yang tampil mungkin belum lengkap.';
  } catch(e){error.value=e.message||'Riwayat belum dapat dimuat.';}
  finally{loading.value=false;}
}
function more(){page.value++;load(true);}
onMounted(()=>load());
</script>
<template>
  <main class="sales-ui sales-document-page sales-v2">
    <SalesPageHeader title="Riwayat Pembayaran" :subtitle="customerName" />
    <div class="sales-page-content">
      <p v-if="!network.isOnline" class="sales-notice warning">Offline — hanya pembayaran lama yang tersimpan di perangkat tersedia. Riwayat kuitansi memerlukan internet.</p>
      <p v-if="error" role="alert" class="sales-notice warning">{{ error }}</p>
      <section class="sales-surface sales-summary-inline"><div><span>Catatan dimuat</span><strong>{{ rows.length }}</strong></div><div><span>Penerimaan tercatat</span><strong>{{ money(total) }}</strong></div></section>
      <p class="sales-muted">Nominal di bawah adalah catatan penerimaan Sales, bukan saldo pelunasan final. Periksa status kuitansi dan Invoice untuk sisa piutang.</p>
      <label class="sales-form-label history-search">Cari pembayaran<input v-model="search" class="sales-input" type="search" placeholder="Faktur / LPH / metode / referensi" /></label>
      <p v-if="loading && !rows.length" role="status" class="sales-empty">Memuat riwayat pembayaran…</p>
      <p v-else-if="!visible.length" class="sales-empty">{{ search ? 'Tidak ada catatan yang cocok.' : 'Belum ada penerimaan customer ini.' }}</p>
      <section v-else class="sales-records" aria-label="Daftar pembayaran">
        <article v-for="item in visible" :key="item.key" class="sales-record-card">
          <div class="sales-record-top"><div><strong>{{ item.nota || 'Tanpa nomor' }}</strong><p class="sales-muted">{{ date(item.created_at) }}</p></div><span class="sales-pill info">{{ item.method }}</span></div>
          <div class="sales-record-meta"><span class="sales-pill" :class="item.pending?'warning':'info'">{{ item.status }}</span><span class="sales-pill">{{ item.origin }}</span></div>
          <div class="sales-record-footer"><span class="sales-muted">{{ item.lph || 'Pembayaran sebelumnya' }}</span><strong class="sales-record-amount">{{ money(item.amount) }}</strong></div>
          <details><summary>Referensi & kuitansi</summary><dl class="sales-kv-list"><div><dt>Referensi</dt><dd>{{ item.reference }}</dd></div><div v-if="item.receipt"><dt>Kuitansi</dt><dd>{{ item.receipt }}</dd></div><div v-if="item.giro"><dt>Giro</dt><dd>{{ item.giro }}</dd></div></dl></details>
        </article>
      </section>
      <button v-if="hasMore" class="sales-button" :disabled="loading" @click="more">{{ loading?'Memuat…':'Muat catatan lainnya' }}</button>
      <button class="sales-button subtle" :disabled="loading" @click="load()">Muat ulang riwayat</button>
    </div>
  </main>
</template>

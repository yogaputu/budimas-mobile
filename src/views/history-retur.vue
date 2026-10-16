<template>
  <main class="sales-ui sales-document-page sales-v2">
    <SalesPageHeader title="Riwayat Retur" :subtitle="customerName" />
    <div class="sales-page-content">
      <section class="sales-surface sales-summary-inline"><div><span>Baris retur</span><strong>{{ totalTransaksi }}</strong></div><div><span>Nilai retur</span><strong>{{ formatCurrency(totalNominalRetur) }}</strong></div></section>
      <label class="sales-form-label history-search">Cari retur<input v-model="searchQuery" class="sales-input" type="search" placeholder="Nota / produk / kode SKU" /></label>
      <p v-if="loading" class="sales-empty" role="status">Memuat riwayat retur…</p>
      <p v-else-if="!visibleReturns.length" class="sales-empty">{{ searchQuery ? 'Tidak ada retur yang cocok.' : 'Belum ada retur untuk customer ini.' }}</p>
      <section v-else class="sales-records" aria-label="Daftar retur">
        <article v-for="(item, index) in visibleReturns" :key="item.Nota + '-' + index" class="sales-record-card">
          <div class="sales-record-top"><div><strong>{{ safeTrim(item.Nota) || 'Tanpa nomor' }}</strong><p class="sales-muted">{{ formatFullDateTime(item.Tanggal) }}</p></div><span class="sales-pill" :class="safeTrim(item.Approve)==='Y' ? 'success' : 'warning'">{{ item.StatusLabel || (safeTrim(item.Approve)==='Y' ? 'Disetujui' : 'Menunggu') }}</span></div>
          <h3>{{ safeTrim(item.NamaStok) || 'Produk retur' }}</h3>
          <div class="sales-record-meta"><span class="sales-pill">{{ item.KodeStok || '-' }}</span><span class="sales-pill">{{ formatQty(item.Jumlah) }} unit</span><span class="sales-pill">{{ item.StatusBarangRetur || 'Belum diretur' }}</span></div>
          <div class="sales-record-footer"><span class="sales-muted">{{ item.NamaSales || customerName }}</span><span class="sales-record-amount">{{ formatCurrency(item.TotalRetur) }}</span></div>
          <details v-if="item.Keterangan"><summary>Catatan retur</summary><p>{{ item.Keterangan }}</p></details>
        </article>
      </section>
      <button class="sales-button" :disabled="loading" @click="fetchRetur">Muat ulang retur</button>
    </div>
  </main></template>

<script setup>
import SalesPageHeader from '@/components/SalesPageHeader.vue';
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/axios'
import { useThemeStore } from '@/stores/theme'

const route = useRoute()
const router = useRouter()
const theme = useThemeStore()

const loading = ref(true)
const listRetur = ref([])
const customerName = computed(() => String(route.query.nama_toko || route.query.nama || 'Pelanggan').trim())
const kodeCustomer = computed(() =>
  String(route.query.kode_customer || route.query.id_plafon || '').trim()
)
const customerCode = computed(() =>
  String(
    route.query.kode_customer ||
    route.query.id_plafon ||
    route.query.kode ||
    ''
  ).trim()
)
const visitLabel = computed(() =>
  String(route.query.visit_state || '').trim().toLowerCase() === 'selesai'
    ? 'Kunjungan Selesai'
    : 'Riwayat Transaksi'
)

const safeTrim = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const safeNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const parseSqlDate = (value) => {
  if (!value) return null

  const str = String(value).trim()

  if (!str) return null

  const normalized = str.replace(' ', 'T')
  const date = new Date(normalized)

  if (!isNaN(date.getTime())) return date

  const datePart = str.split(' ')[0]
  const fallback = new Date(`${datePart}T00:00:00`)
  return isNaN(fallback.getTime()) ? null : fallback
}

const fetchRetur = async () => {
  try {
    loading.value = true

    const res = await api.get('/api/retur/history', {
       params: {
        kode_customer: kodeCustomer.value,
        id_kunjungan: route.query.id_kunjungan || ''
      }
    })

    let data = res.data

    if (typeof data === 'string') {
      const start = data.indexOf('[')
      if (start !== -1) {
        data = JSON.parse(data.substring(start))
      }
    }

    listRetur.value = normalizeReturRows(Array.isArray(data) ? data : [])
  } catch (error) {
    console.error('Gagal mengambil data retur:', error)
    listRetur.value = []
  } finally {
    loading.value = false
  }
}
const normalizeReturRows = (rows) => {
  return (Array.isArray(rows) ? rows : []).map((item) => {
    const statusRaw = safeTrim(
      item.StatusRequest ??
      item.status_request ??
      item.status_approve ??
      item.Approve ??
      item.approve
    )

    const statusLabel = safeTrim(
      item.StatusLabel ||
      item.status_request_label ||
      item.status_label
    )

    const goodsStatusLabel = safeTrim(
      item.StatusBarangRetur ||
      item.status_barang_retur ||
      item.status_barang ||
      item.goods_status
    )

    const goodsStatusGroup = safeTrim(
      item.StatusBarangReturGroup ||
      item.status_barang_retur_group ||
      item.status_barang_group ||
      item.goods_status_group
    )

    const approved =
      item.Approve === 'Y' ||
      item.approve === 'Y' ||
      ['1', '2', '3', '4', '5', 'approved', 'approve', 'proses kpr'].includes(statusRaw.toLowerCase()) ||
      statusLabel.toLowerCase().includes('approved') ||
      statusLabel.toLowerCase().includes('kpr')

    return {
      Nota: safeTrim(item.Nota || item.NoRetur || item.kode_request || item.no_retur || item.no_nota),
      Tanggal: item.Tanggal || item.TanggalRetur || item.tanggal_retur || item.tanggal_request || '',
      NamaStok: safeTrim(item.NamaStok || item.nama_stok || item.NamaBarang || item.nama_barang),
      KodeStok: safeTrim(item.KodeStok || item.kode_stok),
      TotalRetur: safeNumber(item.TotalRetur || item.total_retur || item.total || item.nominal),
      Jumlah: safeNumber(item.Jumlah || item.total_qty_retur || item.jumlah || item.qty),
      Approve: approved ? 'Y' : 'N',
      StatusLabel: statusLabel || (approved ? 'Approved' : 'Pending'),
      StatusBarangRetur: goodsStatusLabel || 'Belum Diretur',
      StatusBarangReturGroup: goodsStatusGroup || goodsStatusLabel || 'pending',
      Keterangan: safeTrim(item.Keterangan || item.keterangan || item.catatan),
      NamaSales: safeTrim(item.NamaSales || item.nama_sales)
    }
  })
}

const goodsStatusClass = (status) => {
  const value = safeTrim(status).toLowerCase()
  if (value.includes('received') || value.includes('diterima')) return 'goods-received'
  if (value.includes('pickup') || value.includes('pengambilan')) return 'goods-pickup'
  return 'goods-pending'
}

const formatCurrency = (val) => {
  const value = safeNumber(val)
  return 'Rp ' + value.toLocaleString('id-ID', { minimumFractionDigits: 0 })
}

const formatQty = (val) => {
  const value = safeNumber(val)
  return Number.isInteger(value)
    ? value.toLocaleString('id-ID')
    : value.toLocaleString('id-ID', { maximumFractionDigits: 2 })
}

const formatDate = (dateStr) => {
  const date = parseSqlDate(dateStr)
  if (!date) return '-'

  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const formatTime = (dateTimeStr) => {
  if (!dateTimeStr) return '--:--'

  const str = String(dateTimeStr)
  const timePart = str.split(' ')[1]

  if (timePart) return timePart.substring(0, 5)

  const date = parseSqlDate(dateTimeStr)
  if (!date) return '--:--'

  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatFullDateTime = (dateTimeStr) => {
  const date = parseSqlDate(dateTimeStr)
  if (!date) return '-'

  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const calcAvgPerUnit = (totalRetur, jumlah) => {
  const total = safeNumber(totalRetur)
  const qty = safeNumber(jumlah)
  if (!qty) return 0
  return total / qty
}

const totalTransaksi = computed(() => listRetur.value.length)

const totalNominalRetur = computed(() => {
  return listRetur.value.reduce((sum, item) => {
    return sum + safeNumber(item.TotalRetur)
  }, 0)
})

const totalApproved = computed(() => {
  return listRetur.value.filter(item => safeTrim(item.Approve) === 'Y').length
})

const totalPending = computed(() => {
  return listRetur.value.filter(item => safeTrim(item.Approve) !== 'Y').length
})

const groupedData = computed(() => {
  const map = {}

  listRetur.value.forEach(item => {
    const rawTanggal = safeTrim(item.Tanggal)
    const datePart = rawTanggal ? rawTanggal.split(' ')[0] : ''
    const parsedDate = parseSqlDate(rawTanggal || datePart)

    if (!parsedDate || !datePart) return

    const monthKey = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`
    const dateKey = datePart

    if (!map[monthKey]) {
      map[monthKey] = {
        monthKey,
        label: parsedDate.toLocaleDateString('id-ID', {
          month: 'long',
          year: 'numeric'
        }),
        total: 0,
        totalNominal: 0,
        dates: {}
      }
    }

    if (!map[monthKey].dates[dateKey]) {
      map[monthKey].dates[dateKey] = []
    }

    map[monthKey].dates[dateKey].push(item)
    map[monthKey].total += 1
    map[monthKey].totalNominal += safeNumber(item.TotalRetur)
  })

  return Object.values(map)
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
    .map(month => ({
      ...month,
      dates: Object.keys(month.dates)
        .sort((a, b) => b.localeCompare(a))
        .map(dateKey => ({
          dateKey,
          items: month.dates[dateKey].sort((a, b) => {
            const timeA = parseSqlDate(a.Tanggal)?.getTime() || 0
            const timeB = parseSqlDate(b.Tanggal)?.getTime() || 0
            return timeB - timeA
          })
        }))
    }))
})

onMounted(fetchRetur)

watch(
  () => [route.query.kode_customer, route.query.id_kunjungan, route.query.visit_state],
  async () => {
    await fetchRetur()
  }
)

const searchQuery = ref('');
const visibleReturns = computed(() => listRetur.value.filter(i => [i.Nota,i.NamaStok,i.KodeStok].join(' ').toLowerCase().includes(searchQuery.value.trim().toLowerCase())));
</script>

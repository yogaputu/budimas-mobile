<template>
  <div class="retur-container" :class="{ 'theme-dark': theme.isDark }">
    <header class="header-shell">
      <div class="header-card">
        <div class="header">
          <button @click="router.back()" class="btn-back" aria-label="Kembali" title="Kembali">
            <font-awesome-icon icon="chevron-left" />
          </button>

          <div class="header-text">
            <span class="label">{{ visitLabel }}</span>
            <h3>Retur Customer</h3>
            <p class="subtext">Riwayat retur barang untuk outlet yang sedang dipilih.</p>
          </div>
        </div>

        <div class="hero-strip">
          <div class="hero-main">
            <span class="hero-label">Outlet</span>
            <strong>{{ customerName }}</strong>
            <small>{{ customerCode || '-' }}</small>
          </div>
          <div class="hero-stat">
            <span>Total Retur</span>
            <strong>{{ formatCurrency(totalNominalRetur) }}</strong>
          </div>
          <div class="hero-stat subtle">
            <span>Transaksi</span>
            <strong>{{ totalTransaksi }}</strong>
          </div>
        </div>
      </div>
    </header>

    <div v-if="loading" class="center state-card">
      <div class="spinner"></div>
      <h4>Memuat data retur...</h4>
      <p>Mohon tunggu, sistem sedang mengambil histori retur customer.</p>
    </div>

    <div v-else-if="listRetur.length === 0" class="empty state-card">
      <div class="empty-icon">📦</div>
      <h4>Tidak ada retur</h4>
      <p>Belum ada data retur untuk customer ini.</p>
    </div>

    <div v-else class="content">
      <!-- SUMMARY -->
      <section class="summary-grid">
        <div class="summary-card">
          <div class="summary-info">
            <span class="summary-label">Total Transaksi</span>
            <strong>{{ totalTransaksi }}</strong>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-info">
            <span class="summary-label">Total Retur</span>
            <strong>{{ formatCurrency(totalNominalRetur) }}</strong>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-info">
            <span class="summary-label">Approved</span>
            <strong>{{ totalApproved }}</strong>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-info">
            <span class="summary-label">Pending</span>
            <strong>{{ totalPending }}</strong>
          </div>
        </div>
      </section>

      <!-- GROUPED CONTENT -->
      <div
        v-for="month in groupedData"
        :key="month.monthKey"
        class="month-section"
      >
        <div class="month-header">
          <div>
            <h4>{{ month.label }}</h4>
            <p>{{ month.total }} transaksi • {{ formatCurrency(month.totalNominal) }}</p>
          </div>
          <span class="total-badge">{{ month.total }} transaksi</span>
        </div>

        <div
          v-for="date in month.dates"
          :key="date.dateKey"
          class="date-group"
        >
          <div class="date-header">
            <div class="date-left">
              <font-awesome-icon :icon="['far', 'clock']" />
              <span>{{ formatDate(date.dateKey) }}</span>
            </div>
            <span class="date-count">{{ date.items.length }} item</span>
          </div>

          <div
            v-for="(item, idx) in date.items"
            :key="`${item.Nota}-${idx}`"
            class="card"
            :class="{ highlight: Number(item.TotalRetur || 0) >= 1000000 }"
          >
            <div class="card-top">
              <div class="nota-info">
                <div class="nota-row">
                  <span class="nota-badge">#{{ safeTrim(item.Nota) || '-' }}</span>
                  <span
                    :class="[
                      'status-tag',
                      safeTrim(item.Approve) === 'Y' ? 'success' : 'pending'
                    ]"
                  >
                    {{ item.StatusLabel || (safeTrim(item.Approve) === 'Y' ? 'Approved' : 'Pending') }}
                  </span>
                  <span
                    :class="[
                      'status-tag',
                      'goods-status',
                      goodsStatusClass(item.StatusBarangReturGroup || item.StatusBarangRetur)
                    ]"
                  >
                    {{ item.StatusBarangRetur || 'Belum Diretur' }}
                  </span>
                </div>

                <p class="stock-code" v-if="safeTrim(item.KodeStok)">
                  Kode Stok: <strong>{{ safeTrim(item.KodeStok) }}</strong>
                </p>
              </div>

              <div class="top-metrics">
                <div class="metric-pill danger">
                  <small>Qty</small>
                  <strong>{{ formatQty(item.Jumlah) }}</strong>
                </div>
                <div class="metric-pill neutral">
                  <small>Total</small>
                  <strong>{{ formatCurrency(item.TotalRetur) }}</strong>
                </div>
              </div>
            </div>

            <div class="card-body">
              <div class="product-info">
                <h4>{{ safeTrim(item.NamaStok) || 'Nama stok tidak tersedia' }}</h4>

                <div class="meta-list">
                  <span v-if="safeTrim(item.NamaSales)">
                    <i class="far fa-user"></i>
                    {{ safeTrim(item.NamaSales) }}
                  </span>
                  <span v-if="item.Tanggal">
                    <i class="far fa-clock"></i>
                    {{ formatTime(item.Tanggal) }}
                  </span>
                  <span v-if="item.TotalRetur && item.Jumlah">
                    <i class="fas fa-scale-balanced"></i>
                    {{ formatCurrency(calcAvgPerUnit(item.TotalRetur, item.Jumlah)) }}/unit
                  </span>
                </div>

                <p class="desc compact" v-if="safeTrim(item.Keterangan)">
                  {{ safeTrim(item.Keterangan) }}
                </p>
              </div>
            </div>

            <div class="card-footer">
              <div class="footer-item">
                <span class="footer-label">Tanggal</span>
                <strong>{{ formatFullDateTime(item.Tanggal) }}</strong>
              </div>
              <div class="footer-item">
                <span class="footer-label">Status</span>
                <strong>{{ item.StatusLabel || '-' }}</strong>
              </div>
              <div class="footer-item">
                <span class="footer-label">Barang Retur</span>
                <strong>{{ item.StatusBarangRetur || 'Belum Diretur' }}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <button v-if="!loading && listRetur.length" class="floating-refresh" @click="fetchRetur">
      <font-awesome-icon icon="rotate-right" />
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/axios'
import { useThemeStore } from '@/stores/theme'

const route = useRoute()
const router = useRouter()
const theme = useThemeStore()

const loading = ref(true)
const listRetur = ref([])
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
</script>

<style scoped>
.retur-container {
  min-height: 100vh;
  padding: 18px 16px 90px;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 28%),
    linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%);
}

.header-shell {
  margin-bottom: 16px;
}

.header-card {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 24px;
  padding: 16px;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);
}

.header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.hero-strip {
  display: flex;
  gap: 10px;
  align-items: stretch;
  margin-top: 14px;
}

.hero-main {
  min-width: 0;
  flex: 1.2;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 18px;
  background: linear-gradient(135deg, #0f172a, #1d4ed8);
  color: #fff;
}

.hero-label {
  display: block;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.78;
  font-weight: 800;
}

.hero-main strong {
  font-size: 1rem;
  line-height: 1.35;
  font-weight: 800;
}

.hero-main small {
  font-size: 0.78rem;
  opacity: 0.8;
}

.hero-stat {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 108px;
  padding: 12px 14px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid #dbe7f5;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.hero-stat span {
  font-size: 0.68rem;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 6px;
}

.hero-stat strong {
  color: #0f172a;
  font-size: 0.92rem;
  font-weight: 800;
}

.hero-stat.subtle {
  background: linear-gradient(135deg, #eff6ff, #f8fafc);
}

.btn-back {
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #ffffff, #eff6ff);
  color: #0f172a;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.header-text {
  flex: 1;
}

.label {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #2563eb;
  margin-bottom: 4px;
}

.header h3 {
  margin: 0;
  font-size: 1.45rem;
  line-height: 1.2;
  color: #0f172a;
  font-weight: 800;
}

.subtext {
  margin: 6px 0 0;
  font-size: 0.83rem;
  color: #64748b;
}

.state-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 24px;
  padding: 28px 20px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.center,
.empty {
  text-align: center;
  margin-top: 24px;
}

.center h4,
.empty h4 {
  margin: 12px 0 6px;
  color: #0f172a;
  font-size: 1rem;
  font-weight: 800;
}

.center p,
.empty p {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
}

.spinner {
  width: 38px;
  height: 38px;
  margin: 0 auto;
  border: 4px solid #dbeafe;
  border-top: 4px solid #2563eb;
  border-radius: 50%;
  animation: spin 0.85s linear infinite;
}

.empty-icon {
  font-size: 2.4rem;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.summary-card {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 12px 14px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
}

.summary-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.summary-label {
  font-size: 0.68rem;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 4px;
}

.summary-info strong {
  font-size: 0.96rem;
  color: #0f172a;
  font-weight: 800;
  word-break: break-word;
}

.month-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.month-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 2px 0;
}

.month-header h4 {
  margin: 0;
  font-size: 0.95rem;
  color: #0f172a;
  font-weight: 800;
}

.month-header p {
  margin: 4px 0 0;
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 600;
}

.total-badge {
  flex-shrink: 0;
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 0.72rem;
  font-weight: 800;
}

.date-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.date-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 4px;
}

.date-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 0.74rem;
  font-weight: 800;
}

.date-count {
  font-size: 0.68rem;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 999px;
  padding: 4px 9px;
  font-weight: 700;
}

.card {
  position: relative;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 20px;
  padding: 14px;
  border: 1px solid #eaf0f6;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.045);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
}

.card.highlight::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: linear-gradient(180deg, #3b82f6, #1d4ed8);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed #dbe4ef;
}

.nota-info {
  flex: 1;
  min-width: 0;
}

.nota-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.nota-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 0.72rem;
  font-weight: 800;
  max-width: 100%;
  word-break: break-word;
}

.stock-code {
  margin: 6px 0 0;
  font-size: 0.7rem;
  color: #64748b;
}

.status-tag {
  font-size: 0.65rem;
  padding: 4px 8px;
  border-radius: 999px;
  font-weight: 800;
  width: fit-content;
}

.status-tag.success {
  background: #dcfce7;
  color: #15803d;
}

.status-tag.pending {
  background: #fef3c7;
  color: #b45309;
}

.status-tag.goods-status {
  border: 1px solid transparent;
}

.status-tag.goods-received {
  background: #dcfce7;
  color: #166534;
  border-color: #bbf7d0;
}

.status-tag.goods-pickup {
  background: #dbeafe;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.status-tag.goods-pending {
  background: #f8fafc;
  color: #64748b;
  border-color: #e2e8f0;
}

.top-metrics {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.metric-pill {
  min-width: 88px;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  text-align: right;
}

.metric-pill small {
  display: block;
  font-size: 0.64rem;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 3px;
}

.metric-pill strong {
  display: block;
  font-size: 0.82rem;
  color: #0f172a;
  font-weight: 900;
  line-height: 1.25;
}

.metric-pill.danger {
  background: linear-gradient(135deg, #fff1f2, #ffe4e6);
  border-color: #fecdd3;
}

.metric-pill.danger strong {
  color: #be123c;
}

.metric-pill.neutral {
  min-width: 112px;
}

.card-body {
  display: block;
}

.product-info {
  flex: 1;
  min-width: 0;
}

.product-info h4 {
  margin: 0;
  font-size: 0.92rem;
  color: #0f172a;
  line-height: 1.35;
  font-weight: 800;
}

.desc {
  margin: 8px 0 0;
  font-size: 0.76rem;
  color: #64748b;
  line-height: 1.5;
  background: #f8fafc;
  border-radius: 12px;
  padding: 8px 10px;
}

.desc.compact {
  margin-top: 10px;
  padding: 7px 10px;
}

.meta-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 8px;
}

.meta-list span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.68rem;
  color: #475569;
  font-weight: 700;
}

.card-footer {
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.footer-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.footer-label {
  font-size: 0.64rem;
  color: #94a3b8;
  font-weight: 700;
}

.footer-item strong {
  font-size: 0.72rem;
  color: #0f172a;
  font-weight: 800;
  line-height: 1.4;
  word-break: break-word;
}

.floating-refresh {
  position: fixed;
  right: 18px;
  bottom: 22px;
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 18px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  font-size: 1rem;
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.28);
  cursor: pointer;
  z-index: 10;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 420px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero-strip {
    flex-direction: column;
  }

  .hero-stat {
    min-width: 0;
  }

  .card-top {
    flex-direction: column;
  }

  .top-metrics {
    width: 100%;
  }

  .metric-pill {
    flex: 1;
    min-width: 0;
  }

  .card-footer {
    grid-template-columns: 1fr;
  }
}

.retur-container.theme-dark {
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.12), transparent 30%),
    linear-gradient(180deg, #000814 0%, #020617 48%, #000814 100%) !important;
  color: #f8fafc !important;
}

.retur-container.theme-dark :is(
  .header-card,
  .state-card,
  .summary-card,
  .card,
  .hero-stat,
  .date-count,
  .desc,
  .metric-pill,
  .card-footer
) {
  background: #030712 !important;
  background-image: none !important;
  border-color: #1f2937 !important;
  color: #f8fafc !important;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.36) !important;
}

.retur-container.theme-dark .hero-main {
  background: linear-gradient(135deg, #020617, #0b1d3a) !important;
  border: 1px solid #1f2937 !important;
}

.retur-container.theme-dark .btn-back {
  background: #111827 !important;
  background-image: none !important;
  color: #f8fafc !important;
  border: 1px solid #1f2937 !important;
  box-shadow: none !important;
}

.retur-container.theme-dark :is(
  .header h3,
  .hero-main strong,
  .hero-stat strong,
  .summary-info strong,
  .month-header h4,
  .product-info h4,
  .footer-item strong,
  .metric-pill strong,
  .stock-code strong
) {
  color: #f8fafc !important;
  -webkit-text-fill-color: #f8fafc !important;
}

.retur-container.theme-dark :is(
  .subtext,
  .hero-main small,
  .hero-stat span,
  .summary-label,
  .month-header p,
  .date-left,
  .date-count,
  .stock-code,
  .desc,
  .meta-list span,
  .footer-label,
  .center p,
  .empty p,
  .metric-pill small
) {
  color: #9fb0c7 !important;
  -webkit-text-fill-color: #9fb0c7 !important;
}

.retur-container.theme-dark .label {
  color: #93c5fd !important;
  -webkit-text-fill-color: #93c5fd !important;
}

.retur-container.theme-dark .card-top {
  border-bottom-color: #1f2937 !important;
}

.retur-container.theme-dark .card-footer {
  border-top-color: #1f2937 !important;
  box-shadow: none !important;
}

.retur-container.theme-dark :is(.nota-badge, .total-badge) {
  background: rgba(37, 99, 235, 0.18) !important;
  background-image: none !important;
  border-color: rgba(96, 165, 250, 0.30) !important;
  color: #bfdbfe !important;
  -webkit-text-fill-color: #bfdbfe !important;
}

.retur-container.theme-dark .status-tag.success,
.retur-container.theme-dark .status-tag.goods-received {
  background: rgba(22, 163, 74, 0.18) !important;
  border-color: rgba(134, 239, 172, 0.26) !important;
  color: #86efac !important;
  -webkit-text-fill-color: #86efac !important;
}

.retur-container.theme-dark .status-tag.pending {
  background: rgba(245, 158, 11, 0.18) !important;
  border-color: rgba(253, 230, 138, 0.26) !important;
  color: #fde68a !important;
  -webkit-text-fill-color: #fde68a !important;
}

.retur-container.theme-dark .status-tag.goods-pickup {
  background: rgba(37, 99, 235, 0.18) !important;
  border-color: rgba(96, 165, 250, 0.30) !important;
  color: #bfdbfe !important;
  -webkit-text-fill-color: #bfdbfe !important;
}

.retur-container.theme-dark .status-tag.goods-pending {
  background: #111827 !important;
  border-color: #334155 !important;
  color: #cbd5e1 !important;
  -webkit-text-fill-color: #cbd5e1 !important;
}

.retur-container.theme-dark .metric-pill.danger {
  background: rgba(248, 113, 113, 0.14) !important;
  border-color: rgba(248, 113, 113, 0.28) !important;
}

.retur-container.theme-dark .metric-pill.danger strong {
  color: #fecaca !important;
  -webkit-text-fill-color: #fecaca !important;
}

.retur-container.theme-dark .spinner {
  border-color: #1f2937 !important;
  border-top-color: #60a5fa !important;
}
</style>

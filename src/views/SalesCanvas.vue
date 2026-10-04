<template>
  <div class="canvas-page">
    <header class="canvas-header">
      <button class="btn-back" @click="router.back()" aria-label="Kembali" title="Kembali">
        <font-awesome-icon icon="chevron-left" />
      </button>
      <div>
        <p>Sales Canvas</p>
        <h3>{{ modeLabel }}</h3>
      </div>
      <button class="btn-refresh" @click="refreshCanvas" :disabled="loading || canvasPrincipalLoading" aria-label="Refresh" title="Refresh">
        <font-awesome-icon icon="sync-alt" />
      </button>
    </header>

    <main class="canvas-content">
      <div class="summary-card">
        <div>
          <span>Sales</span>
          <strong>{{ auth.user?.nama || auth.user?.name || '-' }}</strong>
        </div>
        <div>
          <span>Tipe</span>
          <strong>{{ salesTypeLabel }}</strong>
        </div>
        <div class="carry-summary">
          <span>Belum Terjual</span>
          <strong>{{ formatNumber(carriedStockTotal) }} pcs</strong>
          <small>{{ formatNumber(carriedStockItems) }} SKU dibawa</small>
        </div>
      </div>

      <section v-if="canvasPrincipals.length" class="principal-card">
        <div class="principal-card-head">
          <div>
            <span>Principal Canvas</span>
            <strong>{{ selectedCanvasPrincipal?.nama_principal || 'Pilih principal' }}</strong>
            <small v-if="selectedCanvasPrincipal?.kode_principal">{{ selectedCanvasPrincipal.kode_principal }}</small>
          </div>
          <em v-if="selectedCanvasPrincipal?.is_primary">Utama</em>
        </div>
        <div v-if="canvasPrincipals.length > 1" class="principal-tabs" role="tablist" aria-label="Pilih principal Canvas">
          <button
            v-for="principal in canvasPrincipals"
            :key="principal.id_principal"
            type="button"
            role="tab"
            :aria-selected="String(selectedCanvasPrincipalId) === String(principal.id_principal)"
            :class="{ active: String(selectedCanvasPrincipalId) === String(principal.id_principal) }"
            :disabled="canvasPrincipalLoading || loading || submitting"
            @click="selectCanvasPrincipal(principal.id_principal)"
          >
            <span>{{ principal.nama_principal }}</span>
            <small v-if="principal.kode_principal">{{ principal.kode_principal }}</small>
          </button>
        </div>
      </section>

      <div v-if="availableModes.length > 1" class="segmented" :class="{ compact: availableModes.length === 2 }">
        <button v-if="availableModes.includes('request')" class="main-tab" :class="{ active: mode === 'request' }" @click="setMode('request')">
          <font-awesome-icon icon="box-open" />
          <span>Request</span>
        </button>
        <button v-if="availableModes.includes('order')" class="main-tab" :class="{ active: mode === 'order' }" @click="setMode('order')">
          <font-awesome-icon icon="shopping-cart" />
          <span>Order</span>
        </button>
        <button v-if="availableModes.includes('payment')" class="main-tab" :class="{ active: mode === 'payment' }" @click="setMode('payment')">
          <font-awesome-icon icon="money-bill-wave" />
          <span>Tagihan</span>
        </button>
        <button v-if="availableModes.includes('return')" class="return-tab" :class="{ active: mode === 'return' }" @click="setMode('return')">
          <font-awesome-icon icon="boxes" />
          <span>Retur</span>
        </button>
        <button v-if="availableModes.includes('history')" class="main-tab" :class="{ active: mode === 'history' }" @click="setMode('history')">
          <font-awesome-icon icon="history" />
          <span>Riwayat</span>
        </button>
      </div>

      <section v-if="mode === 'order'" class="customer-card">
        <label for="canvas-approved-request">Request Approved</label>
        <select id="canvas-approved-request" :value="selectedCanvasRequestId" :disabled="loading || submitting" @change="selectCanvasRequest($event.target.value)">
          <option value="">Pilih request approved</option>
          <option v-for="entry in approvedCanvasRequests" :key="entry.id" :value="String(entry.id)">
            REQ-{{ entry.id }} · {{ formatNumber(entry.available_qty_pcs) }} PCS siap order
          </option>
        </select>
        <small>Jumlah siap order mengikuti sisa request yang dipilih dan stok Canvas saat ini.</small>
      </section>

      <section v-if="mode === 'order'" class="customer-card">
        <label>Customer Terdaftar</label>
        <div class="customer-search-control">
          <input
            v-model.trim="customerSearch"
            type="search"
            autocomplete="off"
            placeholder="Cari kode atau nama toko..."
            :aria-expanded="canvasCustomerOpen ? 'true' : 'false'"
            aria-controls="canvas-customer-results"
            :aria-busy="canvasCustomerLoading ? 'true' : 'false'"
            @focus="openCanvasCustomerSearch"
            @input="onCanvasCustomerSearchInput"
            @blur="closeCanvasCustomerSearch"
          />
          <button
            v-if="selectedCanvasCustomer"
            type="button"
            class="customer-clear"
            aria-label="Hapus customer"
            title="Hapus customer"
            @click="clearCanvasCustomer"
          >
            <font-awesome-icon icon="times" />
          </button>
        </div>
        <div v-if="canvasCustomerOpen" id="canvas-customer-results" class="customer-results" role="listbox">
          <button
            v-for="customer in canvasCustomerRows"
            :key="customer.id_customer"
            type="button"
            class="customer-result"
            @mousedown.prevent="selectCanvasCustomer(customer)"
          >
            <strong>{{ customer.nama_customer }}</strong>
            <span>{{ customer.kode_customer || '-' }}{{ customer.nama_cabang ? ` · ${customer.nama_cabang}` : '' }}</span>
            <span v-if="customer.principal_labels" class="customer-principal-label">{{ customer.principal_labels }}</span>
          </button>
          <p v-if="canvasCustomerLoading" class="customer-search-state">Memuat customer...</p>
          <p v-else-if="!canvasCustomerRows.length" class="customer-search-state">Customer terdaftar tidak ditemukan pada cabang sales ini.</p>
          <button
            v-if="canvasCustomerHasMore && !canvasCustomerLoading"
            type="button"
            class="customer-load-more"
            @mousedown.prevent
            @click="loadMoreCanvasCustomers"
          >
            Tampilkan toko lainnya
          </button>
        </div>
        <small v-if="selectedCanvasCustomer">{{ selectedCanvasCustomer.kode_customer || '-' }} dipilih dari master customer.</small>
        <small v-else>Pilih toko/customer dari master agar order dan voucher tervalidasi dengan benar.</small>
      </section>

      <section v-if="mode === 'order'" class="canvas-voucher-card">
        <div class="canvas-voucher-head">
          <div>
            <span>Voucher Canvas</span>
            <strong>{{ canvasVoucherSummaryText }}</strong>
          </div>
          <button
            type="button"
            class="canvas-voucher-refresh"
            :disabled="canvasVoucherLoading"
            @click="loadEligibleCanvasVouchers({ silent: false })"
          >
            <font-awesome-icon :icon="canvasVoucherLoading ? 'sync-alt' : 'ticket-alt'" :spin="canvasVoucherLoading" />
            <span>{{ canvasVoucherLoading ? 'Cek...' : 'Cek' }}</span>
          </button>
        </div>

        <p v-if="!selectedItems.length" class="canvas-voucher-hint">
          Tambahkan qty produk dan customer terlebih dahulu untuk melihat voucher yang dapat digunakan.
        </p>
        <p v-else-if="canvasVoucherError" class="canvas-voucher-error">{{ canvasVoucherError }}</p>
        <template v-else>
          <p v-if="canvasVoucherFallback" class="canvas-voucher-hint warning">
            Daftar sementara dimuat. Validasi dan perhitungan akhir tetap dilakukan server saat order disimpan.
          </p>
          <p v-else-if="selectedCanvasVoucherQuoteReason" class="canvas-voucher-error">
            {{ selectedCanvasVoucherQuoteReason }}
          </p>
          <p v-else class="canvas-voucher-hint">
            Voucher yang dipilih akan divalidasi ulang oleh server saat order disimpan.
          </p>

          <div class="canvas-voucher-selects">
            <label v-for="type in selectableCanvasVoucherTypes" :key="type">
              <span>Voucher {{ type }}</span>
              <select
                v-model="selectedCanvasVoucherIds[type]"
                :disabled="canvasVoucherLoading || !selectedItems.length"
                @change="handleCanvasVoucherSelection(type)"
              >
                <option value="">Tanpa Voucher {{ type }}</option>
                <option
                  v-for="voucher in canvasVouchersByType[type]"
                  :key="`${voucher.tipe_voucher}-${voucher.id}`"
                  :value="String(voucher.id)"
                  :disabled="!voucher.eligible"
                >
                  {{ voucherOptionLabel(voucher) }}
                </option>
              </select>
              <small v-if="selectedCanvasVoucherReason(type)" class="canvas-voucher-reason">
                {{ selectedCanvasVoucherReason(type) }}
              </small>
            </label>
          </div>

          <div v-if="selectedCanvasVoucherRows.length" class="canvas-voucher-applied">
            <div v-for="voucher in selectedCanvasVoucherRows" :key="`${voucher.tipe_voucher}-${voucher.id}`">
              <div>
                <strong>{{ voucher.nama_voucher || voucher.kode_voucher || `Voucher ${voucher.tipe_voucher}` }}</strong>
                <small>{{ voucher.kode_voucher || `Voucher ${voucher.tipe_voucher}` }}</small>
              </div>
              <b v-if="Number(voucher.discount_preview || 0) > 0">
                {{ canvasVoucherNeedsServerTotal ? 'Est. ' : '- ' }}Rp {{ formatNumber(voucher.discount_preview) }}
              </b>
              <em v-else>Dicek server</em>
            </div>
          </div>
        </template>

        <button type="button" class="canvas-voucher-info" @click="voucherInfoOpen = true">
          Lihat syarat & ketentuan voucher
        </button>
      </section>

      <section v-if="mode === 'payment'" class="payment-card">
        <label>Tagihan Customer</label>
        <div class="payment-order-list">
          <button
            v-for="order in paymentOrders"
            :key="order.id"
            type="button"
            class="payment-order-card"
            :class="{ active: String(selectedCanvasOrderId) === String(order.id), paid: getPaymentStatus(order) === 'paid' }"
            @click="selectPaymentOrder(order)"
          >
            <div>
              <strong>{{ order.nama_customer || 'Customer Canvas' }}</strong>
              <small v-if="order.kode_customer">{{ order.kode_customer }}</small>
              <em :class="paymentStatusClass(order)">{{ paymentStatusLabel(order) }}</em>
            </div>
            <div class="payment-order-amounts">
              <span>Total Rp {{ formatNumber(order.total_order) }}</span>
              <span>Bayar Rp {{ formatNumber(order.total_dibayarkan) }}</span>
              <b>Sisa Rp {{ formatNumber(order.sisa_tagihan) }}</b>
            </div>
          </button>
        </div>

        <div v-if="selectedCanvasOrder" class="payment-summary">
          <div>
            <span>Status</span>
            <strong :class="paymentStatusClass(selectedCanvasOrder)">{{ paymentStatusLabel(selectedCanvasOrder) }}</strong>
          </div>
          <div>
            <span>Total Tagihan</span>
            <strong>Rp {{ formatNumber(selectedOrderTotal) }}</strong>
          </div>
          <div>
            <span>Klaim Pembayaran</span>
            <strong>Rp {{ formatNumber(selectedOrderPaid) }}</strong>
          </div>
          <div>
            <span>Sisa Bayar</span>
            <strong>Rp {{ formatNumber(selectedOrderRemaining) }}</strong>
          </div>
        </div>

        <label>Jumlah Bayar</label>
        <div class="payment-input-row">
          <input v-model.number="paymentAmount" type="number" min="0" inputmode="numeric" placeholder="Masukkan nominal pembayaran" />
          <button type="button" :disabled="!selectedCanvasOrder || selectedOrderRemaining <= 0" @click="fillFullPayment">
            Isi Sisa Tagihan
          </button>
        </div>
        <label>Metode Pembayaran</label>
        <select v-model="paymentMethod" class="payment-method-select">
          <option value="tunai">Tunai</option>
          <option value="non_tunai">Non Tunai / Transfer</option>
        </select>
        <small class="payment-hint">Pembayaran dapat sebagian atau lunas. Data disimpan sebagai pengakuan sales dan menunggu Rekap, Setoran, serta finalisasi Finance.</small>

        <div v-if="paymentHistory.length" class="payment-history">
          <span>Riwayat Pembayaran</span>
          <p v-for="payment in paymentHistory" :key="payment.id || payment.id_setoran || payment.tanggal_input">
            Rp {{ formatNumber(payment.jumlah_setoran || payment.nominal || payment.jumlah_dibayarkan) }}
          </p>
        </div>
      </section>

      <section class="history-strip">
        <button type="button" @click="openHistory('request')">
          <span>Request Hari Ini</span>
          <strong>{{ requestHistory.length }}</strong>
        </button>
        <button type="button" @click="openHistory('order')">
          <span>Order Canvas</span>
          <strong>{{ orderHistory.length }}</strong>
        </button>
      </section>

      <section v-if="mode === 'history'" class="canvas-history-panel">
        <div class="canvas-history-head">
          <div>
            <span>Riwayat Canvas</span>
            <strong>Aktivitas request, order, tagihan, dan retur</strong>
          </div>
          <button type="button" @click="refresh" :disabled="loading">
            <font-awesome-icon icon="sync-alt" :spin="loading" />
            Muat ulang
          </button>
        </div>

        <button type="button" class="canvas-history-summary request" @click="openHistory('request')">
          <div>
            <span>Request Canvas</span>
            <strong>{{ requestHistory.length }} request</strong>
            <small>Ketuk untuk melihat rincian request.</small>
          </div>
          <font-awesome-icon icon="box-open" />
        </button>
        <button type="button" class="canvas-history-summary order" @click="openHistory('order')">
          <div>
            <span>Order & Tagihan Canvas</span>
            <strong>{{ orderHistory.length }} order</strong>
            <small>{{ orderHistory.filter((order) => getPaymentStatus(order) === 'paid').length }} order sudah lunas.</small>
          </div>
          <font-awesome-icon icon="shopping-cart" />
        </button>
        <div class="canvas-history-summary return readonly">
          <div>
            <span>Retur Canvas</span>
            <strong>{{ returnHistory.length }} retur</strong>
            <small>Retur yang sudah dikembalikan ke gudang.</small>
          </div>
          <font-awesome-icon icon="boxes" />
        </div>
        <article v-for="entry in returnHistory.slice(0, 5)" :key="`return-${entry.id_return || entry.id}`" class="return-history-row">
          <div>
            <strong>{{ entry.kode_return || `Retur #${entry.id_return || entry.id || '-'}` }}</strong>
            <span>{{ entry.nama_produk || entry.nama_principal || 'Barang Canvas' }}</span>
          </div>
          <div>
            <b>{{ formatNumber(entry.total_qty_detail || entry.total_qty || 0) }} pcs</b>
            <span>{{ entry.tanggal_return || entry.created_at || '-' }}</span>
          </div>
        </article>
        <p v-if="!returnHistory.length" class="empty-inline">Belum ada retur Canvas tercatat.</p>
      </section>

      <section v-if="mode === 'request' && activeRequest" class="request-card">
        <div>
          <span>Request Aktif</span>
          <strong>#{{ activeRequest.id }} - {{ requestStatusLabel(activeRequest.status) }}</strong>
        </div>
        <div>
          <span>Total Request</span>
          <strong>Rp {{ formatNumber(activeRequest.total_request) }}</strong>
        </div>
      </section>

      <div v-if="loading" class="state-box">
        <div class="spinner"></div>
        <p>Memuat sales canvas...</p>
      </div>

      <div v-else-if="mode === 'payment' && paymentOrders.length === 0" class="state-box">
        <font-awesome-icon icon="receipt" />
        <p>Belum ada order canvas.</p>
      </div>

      <div v-else-if="mode !== 'payment' && mode !== 'history' && items.length === 0" class="state-box">
        <font-awesome-icon icon="box" />
        <p>Produk canvas belum tersedia.</p>
      </div>

      <div v-else-if="mode !== 'payment' && mode !== 'history'" class="product-list">
        <article v-for="item in items" :key="item.id" class="product-card">
          <div class="product-main">
            <div>
              <h4>{{ item.nama_produk }}</h4>
              <p>{{ item.nama_principal || '-' }}</p>
            </div>
            <span class="stock-chip" :class="{ danger: getStock(item) <= 0 }">
              {{ mode === 'request' ? 'Gudang' : mode === 'order' ? 'Siap order' : 'Canvas' }} {{ formatNumber(getStock(item)) }} PCS
            </span>
          </div>

          <p v-if="mode === 'order' && getDraftPieces(item) > getStock(item)" class="customer-search-state">Qty melebihi {{ formatNumber(getStock(item)) }} PCS yang siap order.</p>

          <div class="qty-grid">
            <label>
              <span>{{ item.uom1_nama || 'PCS' }}</span>
              <div class="qty-stepper">
                <button type="button" @click="adjustQty(item.id, 'qty_uom1', -1)" aria-label="Kurangi qty">-</button>
                <input v-model.number="draft[item.id].qty_uom1" type="number" min="0" inputmode="numeric" />
                <button type="button" @click="adjustQty(item.id, 'qty_uom1', 1)" aria-label="Tambah qty">+</button>
              </div>
            </label>
            <label :class="{ disabled: !hasUomLevel(item, 2) }">
              <span>{{ item.uom2_nama || '-' }}</span>
              <div class="qty-stepper">
                <button type="button" @click="adjustQty(item.id, 'qty_uom2', -1)" :disabled="!hasUomLevel(item, 2)" aria-label="Kurangi qty">-</button>
                <input v-model.number="draft[item.id].qty_uom2" type="number" min="0" inputmode="numeric" :disabled="!hasUomLevel(item, 2)" />
                <button type="button" @click="adjustQty(item.id, 'qty_uom2', 1)" :disabled="!hasUomLevel(item, 2)" aria-label="Tambah qty">+</button>
              </div>
            </label>
            <label :class="{ disabled: !hasUomLevel(item, 3) }">
              <span>{{ item.uom3_nama || '-' }}</span>
              <div class="qty-stepper">
                <button type="button" @click="adjustQty(item.id, 'qty_uom3', -1)" :disabled="!hasUomLevel(item, 3)" aria-label="Kurangi qty">-</button>
                <input v-model.number="draft[item.id].qty_uom3" type="number" min="0" inputmode="numeric" :disabled="!hasUomLevel(item, 3)" />
                <button type="button" @click="adjustQty(item.id, 'qty_uom3', 1)" :disabled="!hasUomLevel(item, 3)" aria-label="Tambah qty">+</button>
              </div>
            </label>
          </div>

          <div class="product-footer">
            <span v-if="mode === 'return'">Qty kembali {{ formatNumber(getDraftPieces(item)) }} pcs</span>
            <span v-else>Estimasi Rp {{ formatNumber(estimateLine(item)) }}</span>
            <div class="product-actions">
              <button
                v-if="hasSavedRequest(item)"
                class="danger"
                @click="deleteRequestItem(item)"
                aria-label="Hapus dari request"
                title="Hapus dari request"
              >
                <font-awesome-icon icon="trash-alt" />
              </button>
              <button @click="clearLine(item.id)" aria-label="Kosongkan item" title="Kosongkan">
                <font-awesome-icon icon="times" />
              </button>
            </div>
          </div>
        </article>
      </div>
    </main>

    <div v-if="historyModalOpen" class="modal-backdrop" @click.self="closeHistoryModal">
      <section class="history-modal">
        <header>
          <div>
            <span>{{ historyModalTitle }}</span>
            <h4>{{ selectedHistory ? historyDetailTitle : 'Riwayat' }}</h4>
          </div>
          <button @click="closeHistoryModal" aria-label="Tutup" title="Tutup">
            <font-awesome-icon icon="times" />
          </button>
        </header>

        <div v-if="!selectedHistory" class="history-list-modal">
          <button
            v-for="entry in activeHistoryRows"
            :key="`${historyType}-${entry.id}`"
            type="button"
            class="history-row"
            @click="openHistoryDetail(entry)"
          >
            <div>
              <strong>{{ historyType === 'request' ? `Request #${entry.id}` : (entry.nama_customer || `Order #${entry.id}`) }}</strong>
              <span v-if="historyType === 'order'">Pembelian dari {{ entry.nama_customer || '-' }}{{ entry.kode_customer ? ` (${entry.kode_customer})` : '' }}</span>
              <span>{{ entry.tanggal_request || entry.tanggal_order || '-' }}</span>
            </div>
            <div class="history-amount">
              <em v-if="historyType === 'order'" :class="paymentStatusClass(entry)">{{ paymentStatusLabel(entry) }}</em>
              <b>Rp {{ formatNumber(entry.total_request || entry.total_order || 0) }}</b>
            </div>
          </button>
          <p v-if="!activeHistoryRows.length" class="empty-inline">Belum ada riwayat.</p>
        </div>

        <div v-else class="history-detail-modal">
          <div v-if="historyType === 'order'" class="customer-history-box">
            <span>Customer</span>
            <strong>{{ selectedHistory?.nama_customer || '-' }}</strong>
            <small v-if="selectedHistory?.kode_customer">{{ selectedHistory.kode_customer }}</small>
            <em :class="paymentStatusClass(selectedHistory)">{{ paymentStatusLabel(selectedHistory) }}</em>
          </div>
          <div v-if="historyDetailLoading" class="state-box compact">
            <div class="spinner"></div>
            <p>Memuat detail...</p>
          </div>
          <template v-else>
            <article v-for="item in historyDetailRows" :key="item.id || item.id_produk" class="detail-row">
              <div>
                <strong>{{ item.nama_produk || 'Produk' }}</strong>
                <span>{{ formatQty(item) }}</span>
              </div>
              <b>Rp {{ formatNumber(item.total_permintaan || item.jumlah_harga || item.subtotal_harga || item.total || 0) }}</b>
            </article>
            <p v-if="!historyDetailRows.length" class="empty-inline">Detail produk belum tersedia.</p>
            <div class="detail-total">
              <span>Total</span>
              <strong>Rp {{ formatNumber(historyDetailTotal) }}</strong>
            </div>
          </template>
        </div>
      </section>
    </div>

    <div v-if="voucherInfoOpen" class="modal-backdrop" @click.self="voucherInfoOpen = false">
      <section class="history-modal voucher-info-modal">
        <header>
          <div>
            <span>Voucher Canvas</span>
            <h4>Voucher yang tersedia</h4>
          </div>
          <button @click="voucherInfoOpen = false" aria-label="Tutup" title="Tutup">
            <font-awesome-icon icon="times" />
          </button>
        </header>

        <div v-if="canvasVoucherLoading" class="state-box compact">
          <div class="spinner"></div>
          <p>Memuat voucher...</p>
        </div>
        <div v-else-if="!canvasVoucherRows.length" class="empty-inline">
          Belum ada voucher Canvas yang dapat ditampilkan untuk konteks order ini.
        </div>
        <div v-else class="voucher-info-list">
          <article v-for="voucher in canvasVoucherRows" :key="`${voucher.tipe_voucher}-${voucher.id}`" class="voucher-info-row">
            <div class="voucher-info-title">
              <span>Voucher {{ voucher.tipe_voucher }}</span>
              <strong>{{ voucher.nama_voucher || voucher.kode_voucher || '-' }}</strong>
              <small>{{ voucher.kode_voucher || '-' }}</small>
            </div>
            <em :class="{ unavailable: !voucher.eligible || Number(voucher.tipe_voucher) === 1 }">
              {{ Number(voucher.tipe_voucher) === 1
                ? 'Referensi saja; Voucher 1 belum dapat dipakai pada order Canvas.'
                : (voucher.eligible ? voucherDiscountLabel(voucher) : (voucher.reason || 'Belum memenuhi syarat')) }}
            </em>
            <p v-if="voucher.syarat_ketentuan || voucher.scope">{{ voucher.syarat_ketentuan || voucher.scope }}</p>
          </article>
        </div>
      </section>
    </div>

    <footer v-if="mode !== 'history'" class="canvas-footer">
      <div>
        <span>{{ footerLabel }}</span>
        <strong>{{ footerValueText }}</strong>
      </div>
      <button @click="submit" :disabled="submitting || !canSubmit">
        <font-awesome-icon :icon="submitting ? 'sync-alt' : 'floppy-disk'" />
        <span>{{ submitting ? 'Menyimpan...' : submitLabel }}</span>
      </button>
    </footer>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Swal from 'sweetalert2';
import api from '@/api/axios';
import { useAuthStore } from '@/stores/auth';
import { getPayloadArray, getPayloadObject } from '@/services/visitService';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const availableModes = computed(() => ['request', 'order', 'payment', 'return', 'history']);
const getInitialMode = () => {
  const requestedMode = String(route.query.mode || '').toLowerCase();
  return availableModes.value.includes(requestedMode) ? requestedMode : availableModes.value[0];
};

const mode = ref(getInitialMode());
const loading = ref(false);
const submitting = ref(false);
const items = ref([]);
const requestHistory = ref([]);
const orderHistory = ref([]);
const returnHistory = ref([]);
const draft = ref({});
const customerSearch = ref('');
const canvasCustomerRows = ref([]);
const selectedCanvasCustomer = ref(null);
const canvasCustomerLoading = ref(false);
const canvasCustomerOpen = ref(false);
const canvasCustomerPage = ref(1);
const canvasCustomerHasMore = ref(false);
const canvasCustomerSearchTerm = ref('');
const canvasPrincipals = ref([]);
const selectedCanvasPrincipalId = ref('');
const canvasPrincipalLoading = ref(false);
const approvedCanvasRequests = ref([]);
const selectedCanvasRequestId = ref('');
let canvasProductsRequestSequence = 0;

const salesTypeLabel = computed(() => auth.user?.nama_tipe_sales || 'Sales');
const selectedCanvasOrderId = ref('');
const paymentAmount = ref(0);
const paymentMethod = ref('tunai');
const paymentHistory = ref([]);
const paymentAttempt = ref({ signature: '', id: '' });
const historyModalOpen = ref(false);
const historyType = ref('request');
const selectedHistory = ref(null);
const historyDetailRows = ref([]);
const historyDetailLoading = ref(false);
const carriedStockTotal = ref(0);
const carriedStockItems = ref(0);
const canvasVoucherRows = ref([]);
const canvasVoucherContext = ref({});
const canvasVoucherLoading = ref(false);
const canvasVoucherError = ref('');
const canvasVoucherFallback = ref(false);
const selectedCanvasVoucherIds = ref({ 2: '', 3: '' });
const voucherInfoOpen = ref(false);
let canvasVoucherReloadTimer = null;
let canvasVoucherRequestSequence = 0;
let canvasCustomerSearchTimer = null;
let canvasCustomerRequestSequence = 0;

const modeLabel = computed(() => {
  if (mode.value === 'payment') return 'Pembayaran Canvas';
  if (mode.value === 'return') return 'Pengembalian Stok Canvas';
  if (mode.value === 'history') return 'Riwayat Canvas';
  return mode.value === 'request' ? 'Permintaan Barang Canvas' : 'Order Barang Canvas';
});
const submitLabel = computed(() => {
  if (mode.value === 'payment') return 'Simpan Pembayaran';
  if (mode.value === 'return') return 'Kembalikan Stok';
  return mode.value === 'request' ? 'Kirim Request' : 'Simpan Order';
});

const userParams = computed(() => ({
  id_user: auth.user?.id_user || auth.user?.id || '',
  id_sales: auth.user?.id_sales || ''
}));
const selectedCanvasPrincipal = computed(() => (
  canvasPrincipals.value.find((principal) => (
    String(principal.id_principal) === String(selectedCanvasPrincipalId.value)
  )) || null
));
const canvasPrincipalParams = computed(() => {
  const idPrincipal = String(selectedCanvasPrincipalId.value || '').trim();
  return idPrincipal ? { id_principal: idPrincipal } : {};
});
const canvasScopeParams = computed(() => ({
  ...userParams.value,
  ...canvasPrincipalParams.value
}));
const customerName = computed(() => String(selectedCanvasCustomer.value?.nama_customer || '').trim());
const customerCode = computed(() => String(selectedCanvasCustomer.value?.kode_customer || '').trim());
const customerId = computed(() => String(selectedCanvasCustomer.value?.id_customer || '').trim());
const customerDisplayLabel = computed(() => {
  if (!selectedCanvasCustomer.value) return '';
  return `${customerCode.value || '-'} - ${customerName.value || 'Customer'}`;
});
const orderHistoryParams = computed(() => ({ ...canvasScopeParams.value }));

const ensureDraft = (rows) => {
  const next = { ...draft.value };
  rows.forEach((item) => {
    const savedQty = {
      qty_uom1: Number(item.qty_uom1 || 0),
      qty_uom2: Number(item.qty_uom2 || 0),
      qty_uom3: Number(item.qty_uom3 || 0)
    };
    const hasSavedQty = savedQty.qty_uom1 > 0 || savedQty.qty_uom2 > 0 || savedQty.qty_uom3 > 0;
    if (!next[item.id] || hasSavedQty) {
      next[item.id] = hasSavedQty ? savedQty : { qty_uom1: 0, qty_uom2: 0, qty_uom3: 0 };
    }
  });
  draft.value = next;
};

const getCanvasArray = (payload) => {
  const direct = getPayloadArray(payload);
  if (direct.length) return direct;
  if (Array.isArray(payload?.pages)) return payload.pages;
  if (Array.isArray(payload?.result?.pages)) return payload.result.pages;
  return [];
};

const getCanvasObject = (payload) => {
  const rows = getCanvasArray(payload);
  if (rows.length) return rows[0];
  return getPayloadObject(payload) || payload;
};

const normalizeCanvasCustomers = (payload) => {
  const seen = new Set();
  return getCanvasArray(payload).map((row) => {
    const idCustomer = String(row?.id_customer || row?.id || '').trim();
    return {
      ...row,
      id_customer: idCustomer,
      kode_customer: String(row?.kode_customer || row?.kode || '').trim(),
      nama_customer: String(row?.nama_customer || row?.nama || '').trim(),
      nama_cabang: String(row?.nama_cabang || row?.cabang_nama || '').trim(),
      principal_labels: String(row?.principal_labels || row?.nama_principal || '').trim()
    };
  }).filter((customer) => {
    if (!customer.id_customer || !customer.nama_customer || seen.has(customer.id_customer)) return false;
    seen.add(customer.id_customer);
    return true;
  });
};

const clearCanvasCustomer = () => {
  selectedCanvasCustomer.value = null;
  customerSearch.value = '';
  canvasCustomerOpen.value = true;
  canvasVoucherRows.value = [];
  canvasVoucherContext.value = {};
  canvasVoucherError.value = '';
  selectedCanvasVoucherIds.value = { 2: '', 3: '' };
  loadCanvasCustomers('');
};

const selectCanvasCustomer = (customer) => {
  selectedCanvasCustomer.value = customer;
  customerSearch.value = `${customer.kode_customer || '-'} - ${customer.nama_customer}`;
  canvasCustomerOpen.value = false;
};

const mergeCanvasCustomers = (existing, incoming) => {
  const seen = new Set();
  return [...existing, ...incoming].filter((customer) => {
    const key = String(customer?.id_customer || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getCanvasCustomerMeta = (payload) => {
  const source = payload?.result && !Array.isArray(payload.result) ? payload.result : payload;
  return {
    page: Number(source?.page || source?.current_page || 1) || 1,
    hasMore: source?.has_more === true || source?.hasMore === true
  };
};

const loadCanvasCustomers = async (search = customerSearch.value, { append = false } = {}) => {
  const normalizedSearch = String(search || '').trim();
  const shouldAppend = append && normalizedSearch === canvasCustomerSearchTerm.value;
  const page = shouldAppend ? canvasCustomerPage.value + 1 : 1;
  const params = {
    ...canvasScopeParams.value,
    search: normalizedSearch,
    page,
    limit: 50
  };
  if (!params.id_user || !params.id_sales) {
    canvasCustomerRows.value = [];
    canvasCustomerPage.value = 1;
    canvasCustomerHasMore.value = false;
    return;
  }

  const requestId = ++canvasCustomerRequestSequence;
  if (!shouldAppend) {
    canvasCustomerRows.value = [];
    canvasCustomerPage.value = 1;
    canvasCustomerHasMore.value = false;
  }
  canvasCustomerLoading.value = true;
  try {
    const response = await api.get('/api/sales-canvas/customers', { params });
    if (requestId !== canvasCustomerRequestSequence) return;
    const rows = normalizeCanvasCustomers(response.data);
    const meta = getCanvasCustomerMeta(response.data);
    const selected = selectedCanvasCustomer.value;
    let nextRows = shouldAppend ? mergeCanvasCustomers(canvasCustomerRows.value, rows) : rows;
    if (selected && !nextRows.some((item) => item.id_customer === selected.id_customer)) {
      nextRows = [selected, ...nextRows];
    }
    canvasCustomerRows.value = nextRows;
    canvasCustomerPage.value = meta.page;
    canvasCustomerHasMore.value = meta.hasMore;
    canvasCustomerSearchTerm.value = normalizedSearch;
  } catch (error) {
    if (requestId !== canvasCustomerRequestSequence) return;
    console.error('Load customer Canvas gagal:', error);
    if (!shouldAppend) canvasCustomerRows.value = [];
    canvasCustomerHasMore.value = false;
  } finally {
    if (requestId === canvasCustomerRequestSequence) canvasCustomerLoading.value = false;
  }
};

const loadMoreCanvasCustomers = () => {
  if (canvasCustomerLoading.value || !canvasCustomerHasMore.value) return;
  loadCanvasCustomers(canvasCustomerSearchTerm.value, { append: true });
};

const scheduleCanvasCustomerSearch = () => {
  if (canvasCustomerSearchTimer) clearTimeout(canvasCustomerSearchTimer);
  canvasCustomerSearchTimer = setTimeout(() => {
    canvasCustomerSearchTimer = null;
    loadCanvasCustomers(customerSearch.value);
  }, 250);
};

const openCanvasCustomerSearch = () => {
  canvasCustomerOpen.value = true;
  scheduleCanvasCustomerSearch();
};

const closeCanvasCustomerSearch = () => {
  setTimeout(() => {
    canvasCustomerOpen.value = false;
  }, 150);
};

const onCanvasCustomerSearchInput = () => {
  if (selectedCanvasCustomer.value && customerSearch.value !== customerDisplayLabel.value) {
    selectedCanvasCustomer.value = null;
  }
  canvasCustomerOpen.value = true;
  scheduleCanvasCustomerSearch();
};

const isCanvasPrincipalEndpointUnavailable = (error) => [404, 405, 501].includes(Number(error?.response?.status || 0));
const isCanvasPrimary = (value) => (
  value === true
  || value === 1
  || ['true', '1', 'yes', 'y'].includes(String(value || '').trim().toLowerCase())
);
const normalizeCanvasPrincipals = (payload) => {
  const seen = new Set();
  return getCanvasArray(payload).map((row) => {
    const idPrincipal = String(row?.id_principal || row?.principal_id || row?.id || '').trim();
    return {
      ...row,
      id_principal: idPrincipal,
      nama_principal: String(
        row?.nama_principal || row?.nama || row?.nama_principle || row?.NamaPrinciple || `Principal ${idPrincipal}`
      ).trim(),
      kode_principal: String(row?.kode_principal || row?.kode || row?.KodePrinciple || '').trim(),
      is_primary: isCanvasPrimary(row?.is_primary ?? row?.primary ?? row?.utama)
    };
  }).filter((principal) => {
    if (!principal.id_principal || seen.has(principal.id_principal)) return false;
    seen.add(principal.id_principal);
    return true;
  }).sort((left, right) => {
    if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1;
    return left.nama_principal.localeCompare(right.nama_principal, 'id');
  });
};

const loadCanvasPrincipals = async () => {
  canvasPrincipalLoading.value = true;
  try {
    const response = await api.get('/api/sales-canvas/principals', { params: userParams.value });
    const rows = normalizeCanvasPrincipals(response.data);
    const previousId = String(selectedCanvasPrincipalId.value || '').trim();
    canvasPrincipals.value = rows;

    if (!rows.length) {
      // Endpoint baru dapat belum tersedia pada server lama. Dalam kondisi ini
      // seluruh request tetap dikirim seperti perilaku lama (tanpa id_principal).
      selectedCanvasPrincipalId.value = '';
      return false;
    }

    const selectedStillAvailable = rows.find((principal) => principal.id_principal === previousId);
    const primaryPrincipal = rows.find((principal) => principal.is_primary);
    selectedCanvasPrincipalId.value = (
      selectedStillAvailable || primaryPrincipal || rows[0]
    ).id_principal;
    return true;
  } catch (error) {
    if (isCanvasPrincipalEndpointUnavailable(error)) {
      // Backwards compatible with an API that has not yet received endpoint
      // principal assignment: backend lama tetap menggunakan principal utama.
      canvasPrincipals.value = [];
      selectedCanvasPrincipalId.value = '';
    } else {
      console.warn('Load principal Canvas gagal:', error);
    }
    return false;
  } finally {
    canvasPrincipalLoading.value = false;
  }
};

const resetCanvasPrincipalState = () => {
  canvasProductsRequestSequence += 1;
  approvedCanvasRequests.value = [];
  selectedCanvasRequestId.value = '';
  draft.value = {};
  items.value = [];
  requestHistory.value = [];
  orderHistory.value = [];
  returnHistory.value = [];
  carriedStockTotal.value = 0;
  carriedStockItems.value = 0;
  selectedCanvasOrderId.value = '';
  paymentAmount.value = 0;
  paymentHistory.value = [];
  paymentAttempt.value = { signature: '', id: '' };
  historyModalOpen.value = false;
  selectedHistory.value = null;
  historyDetailRows.value = [];
  canvasCustomerRequestSequence += 1;
  if (canvasCustomerSearchTimer) clearTimeout(canvasCustomerSearchTimer);
  canvasCustomerSearchTimer = null;
  customerSearch.value = '';
  canvasCustomerRows.value = [];
  selectedCanvasCustomer.value = null;
  canvasCustomerLoading.value = false;
  canvasCustomerOpen.value = false;
  canvasCustomerPage.value = 1;
  canvasCustomerHasMore.value = false;
  canvasCustomerSearchTerm.value = '';
  canvasVoucherRequestSequence += 1;
  if (canvasVoucherReloadTimer) clearTimeout(canvasVoucherReloadTimer);
  canvasVoucherReloadTimer = null;
  canvasVoucherRows.value = [];
  canvasVoucherContext.value = {};
  canvasVoucherError.value = '';
  canvasVoucherFallback.value = false;
  selectedCanvasVoucherIds.value = { 2: '', 3: '' };
};

const selectCanvasPrincipal = async (idPrincipal) => {
  const nextId = String(idPrincipal || '').trim();
  if (!nextId || nextId === String(selectedCanvasPrincipalId.value || '').trim()) return;
  selectedCanvasPrincipalId.value = nextId;
  resetCanvasPrincipalState();
  await refresh();
};

const assertCanvasSuccess = (payload) => {
  const data = getCanvasObject(payload);
  if (String(data?.status || '').toLowerCase() === 'error') {
    throw new Error(data?.message || 'Proses sales canvas ditolak server.');
  }
  return data;
};

const normalizeRows = (payload) => {
  const seen = new Set();
  return getCanvasArray(payload).map((item) => {
    const uom2Factor = item.uom2_factor === null || item.uom2_factor === undefined ? 0 : Number(item.uom2_factor || 0);
    const uom3Factor = item.uom3_factor === null || item.uom3_factor === undefined ? 0 : Number(item.uom3_factor || 0);
    return {
      ...item,
      id: Number(item.id || item.id_produk || 0),
      nama_produk: String(item.nama_produk || item.Nama || 'Produk').trim(),
      nama_principal: String(item.nama_principal || '').trim(),
      harga_per_uom1: Number(item.harga_per_uom1 || item.harga_beli || 0),
      uom1_factor: Number(item.uom1_factor || 1),
      uom2_factor: uom2Factor,
      uom3_factor: uom3Factor,
      stock_gudang: Number(item.stock_gudang || 0),
      stock_canvas: Number(item.stock_canvas || 0),
      canvas_request_id: Number(item.canvas_request_id || 0),
      status_canvas: Number(item.status_canvas || 0),
      qty_request_today: Number(item.qty_request_today || item.total_satuan || 0),
      qty_uom1: Number(item.saved_qty_uom1 ?? item.qty_uom1 ?? 0),
      qty_uom2: uom2Factor > 0 ? Number(item.saved_qty_uom2 ?? item.qty_uom2 ?? 0) : 0,
      qty_uom3: uom3Factor > 0 ? Number(item.saved_qty_uom3 ?? item.qty_uom3 ?? 0) : 0,
      uom1_nama: item.uom1_nama || 'PCS',
      uom2_nama: uom2Factor > 0 ? item.uom2_nama : '',
      uom3_nama: uom3Factor > 0 ? item.uom3_nama : ''
    };
  }).filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const applyCarriedStockSummary = (rows) => {
  const carriedRows = rows.filter((item) => Number(item.stock_canvas || 0) > 0);
  carriedStockItems.value = carriedRows.length;
  carriedStockTotal.value = carriedRows.reduce((sum, item) => sum + Number(item.stock_canvas || 0), 0);
};

const hasUomLevel = (item, level) => {
  if (level === 2) return Boolean(item.uom2_nama) && Number(item.uom2_factor || 0) > 0;
  if (level === 3) return Boolean(item.uom3_nama) && Number(item.uom3_factor || 0) > 0;
  return true;
};

const getStock = (item) => mode.value === 'request'
  ? Number(item.stock_gudang || 0)
  : mode.value === 'order'
    ? Math.max(0, Number(item.available_order_qty_pcs || 0))
    : Number(item.stock_canvas || 0);

const getDraftPieces = (item) => {
  const row = draft.value[item.id] || {};
  return (
    Number(row.qty_uom1 || 0) * Number(item.uom1_factor || 1) +
    (hasUomLevel(item, 2) ? Number(row.qty_uom2 || 0) * Number(item.uom2_factor || 0) : 0) +
    (hasUomLevel(item, 3) ? Number(row.qty_uom3 || 0) * Number(item.uom3_factor || 0) : 0)
  );
};

const estimateLine = (item) => getDraftPieces(item) * Number(item.harga_per_uom1 || item.harga_beli || 0);

const selectedItems = computed(() => items.value.filter((item) => {
  const row = draft.value[item.id] || {};
  return Number(row.qty_uom1 || 0) > 0
    || (hasUomLevel(item, 2) && Number(row.qty_uom2 || 0) > 0)
    || (hasUomLevel(item, 3) && Number(row.qty_uom3 || 0) > 0);
}));

const selectableCanvasVoucherTypes = [2, 3];
const toCanvasVoucherNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const canvasVoucherKey = (voucher) => `${Number(voucher?.tipe_voucher || 0)}-${Number(voucher?.id || 0)}`;
const canvasVouchersByType = computed(() => selectableCanvasVoucherTypes.reduce((result, type) => {
  result[type] = canvasVoucherRows.value.filter((voucher) => Number(voucher.tipe_voucher) === Number(type));
  return result;
}, {}));
const selectedCanvasVoucherRows = computed(() => selectableCanvasVoucherTypes
  .map((type) => {
    const id = String(selectedCanvasVoucherIds.value[type] || '').trim();
    return canvasVouchersByType.value[type]?.find((voucher) => String(voucher.id) === id) || null;
  })
  .filter(Boolean));
const selectedCanvasVoucherQuote = computed(() => (
  canvasVoucherContext.value?.selected_quote
  || canvasVoucherContext.value?.quote
  || null
));
const quotedCanvasOrderTotal = computed(() => {
  if (!selectedItems.value.length) return null;
  const total = Number(selectedCanvasVoucherQuote.value?.total_order);
  return Number.isFinite(total) ? Math.max(total, 0) : null;
});
const selectedCanvasVoucherQuoteReason = computed(() => {
  if (!selectedCanvasVoucherRows.value.length) return '';
  if (selectedCanvasVoucherQuote.value?.eligible === false) {
    return String(selectedCanvasVoucherQuote.value?.reason || 'Kombinasi voucher belum dapat digunakan untuk order ini.').trim();
  }
  return '';
});
const serverSelectedCanvasVoucherDiscount = computed(() => toCanvasVoucherNumber(
  canvasVoucherContext.value?.selected_discount_preview
  ?? canvasVoucherContext.value?.selected_discount
  ?? canvasVoucherContext.value?.total_selected_discount
  ?? 0
));
const canvasVoucherNeedsServerTotal = computed(() => (
  selectedCanvasVoucherRows.value.length > 1 && serverSelectedCanvasVoucherDiscount.value <= 0
));
const canvasVoucherDiscountPreview = computed(() => {
  if (!selectedCanvasVoucherRows.value.length) return 0;
  if (serverSelectedCanvasVoucherDiscount.value > 0) return serverSelectedCanvasVoucherDiscount.value;
  if (selectedCanvasVoucherRows.value.length === 1) {
    return Math.max(toCanvasVoucherNumber(selectedCanvasVoucherRows.value[0].discount_preview), 0);
  }
  return 0;
});
const canvasVoucherSummaryText = computed(() => {
  if (canvasVoucherLoading.value) return 'Memeriksa voucher yang berlaku...';
  if (!selectedItems.value.length) return 'Pilih produk untuk cek voucher';
  if (selectedCanvasVoucherRows.value.length) {
    if (canvasVoucherNeedsServerTotal.value) {
      return `${selectedCanvasVoucherRows.value.length} voucher dipilih · nominal final dihitung server`;
    }
    const preview = canvasVoucherDiscountPreview.value;
    return preview > 0
      ? `${selectedCanvasVoucherRows.value.length} voucher dipilih · estimasi hemat Rp ${formatNumber(preview)}`
      : `${selectedCanvasVoucherRows.value.length} voucher dipilih`;
  }
  const totalEligible = selectableCanvasVoucherTypes.reduce(
    (total, type) => total + (canvasVouchersByType.value[type] || []).filter((voucher) => voucher.eligible).length,
    0
  );
  return totalEligible ? `${totalEligible} voucher dapat digunakan` : 'Tidak ada voucher yang memenuhi syarat';
});

const buildCanvasVoucherItems = () => selectedItems.value.map((item) => ({
  id_produk: Number(item.id || item.id_produk || 0),
  qty_uom1: Number(draft.value[item.id]?.qty_uom1 || 0),
  qty_uom2: hasUomLevel(item, 2) ? Number(draft.value[item.id]?.qty_uom2 || 0) : 0,
  qty_uom3: hasUomLevel(item, 3) ? Number(draft.value[item.id]?.qty_uom3 || 0) : 0
})).filter((item) => item.id_produk > 0);

const buildCanvasVoucherSelections = () => selectedCanvasVoucherRows.value
  .filter((voucher) => voucher.eligible && selectableCanvasVoucherTypes.includes(Number(voucher.tipe_voucher)))
  .map((voucher) => ({ tipe_voucher: Number(voucher.tipe_voucher), id: Number(voucher.id) }));

const getCanvasVoucherPayload = (payload) => getPayloadObject(payload) || {};
const getCanvasVoucherRows = (payload) => {
  const directRows = getPayloadArray(payload);
  if (directRows.length) return directRows;
  const data = getCanvasVoucherPayload(payload);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.vouchers)) return data.vouchers;
  if (Array.isArray(data.eligible_vouchers)) return data.eligible_vouchers;

  const groupedRows = [];
  [1, 2, 3].forEach((type) => {
    const grouped = data[`voucher_${type}`]
      || data[`voucher${type}`]
      || data[`v${type}`]
      || data[`v${type}_regular`];
    if (Array.isArray(grouped)) {
      grouped.forEach((row) => groupedRows.push({ ...row, tipe_voucher: row?.tipe_voucher || type }));
    }
  });
  return groupedRows;
};

const normalizeCanvasVoucherRows = (rows, { fallback = false } = {}) => {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const type = Number(row?.tipe_voucher || row?.type || row?.tipe || 0);
    const id = Number(row?.id || row?.id_voucher || row?.voucher_id || 0);
    // New server responses carry `channel_scope`.  Older servers did not have
    // it yet, so legacy data remains `both` until the backend migration is
    // present.  Promo-only vouchers are never made selectable in Canvas.
    const rawChannelScope = String(row?.channel_scope || row?.voucher_scope || '').trim().toLowerCase();
    const channelScope = ['promo', 'canvas', 'both'].includes(rawChannelScope) ? rawChannelScope : 'both';
    const allowedForCanvas = channelScope === 'canvas' || channelScope === 'both';
    const eligibleFromServer = row?.eligible ?? row?.is_eligible ?? row?.can_use;
    // A legacy endpoint only knows the voucher catalog, not the current
    // customer, branch, product, UOM, minimum, or remaining budget.  It is
    // safe to show it as reference during a rolling deployment, but it must
    // never make a voucher selectable before the authoritative endpoint has
    // confirmed it for this exact Canvas order.
    const eligible = allowedForCanvas && !fallback && (
      eligibleFromServer === true
      || eligibleFromServer === 1
      || ['true', '1', 'yes'].includes(String(eligibleFromServer || '').toLowerCase())
    );
    return {
      ...row,
      id,
      tipe_voucher: type,
      channel_scope: channelScope,
      kode_voucher: String(row?.kode_voucher || row?.kode || '').trim(),
      nama_voucher: String(row?.nama_voucher || row?.nama || '').trim(),
      eligible: Boolean(eligible),
      reason: !allowedForCanvas
        ? 'Voucher ini hanya berlaku untuk Promo All-In, bukan order Canvas.'
        : fallback
        ? 'Validasi voucher di server belum tersedia; voucher hanya dapat dilihat, belum dapat dipakai.'
        : String(row?.reason || row?.alasan || row?.message || '').trim(),
      scope: String(row?.scope || row?.cakupan || (channelScope === 'canvas' ? 'Canvas' : 'Promo All-In & Canvas')).trim(),
      syarat_ketentuan: String(row?.syarat_ketentuan || row?.keterangan || '').trim(),
      discount_preview: toCanvasVoucherNumber(
        row?.discount_preview ?? row?.estimated_discount ?? row?.jumlah_diskon ?? row?.nominal_diskon_preview ?? 0
      )
    };
  }).filter((voucher) => {
    if (![1, ...selectableCanvasVoucherTypes].includes(voucher.tipe_voucher) || !voucher.id) return false;
    if (voucher.channel_scope === 'promo') return false;
    const key = canvasVoucherKey(voucher);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const voucherDiscountLabel = (voucher) => {
  const preview = toCanvasVoucherNumber(voucher?.discount_preview);
  if (preview > 0) return `Estimasi hemat Rp ${formatNumber(preview)}`;
  const percent = [
    voucher?.persentase_diskon_1,
    voucher?.persentase_diskon_2,
    voucher?.persentase_diskon_3
  ].map(toCanvasVoucherNumber).filter((value) => value > 0);
  if (percent.length) return `Diskon ${percent.map((value) => `${value}%`).join(' + ')}`;
  return voucher?.eligible ? 'Dapat digunakan' : 'Belum memenuhi syarat';
};

const voucherOptionLabel = (voucher) => {
  const name = voucher.nama_voucher || voucher.kode_voucher || `Voucher ${voucher.tipe_voucher}`;
  const detail = voucherDiscountLabel(voucher);
  return `${name}${detail ? ` · ${detail}` : ''}`;
};

const selectedCanvasVoucherReason = (type) => {
  const selectedId = String(selectedCanvasVoucherIds.value[type] || '').trim();
  if (!selectedId) return '';
  const voucher = canvasVouchersByType.value[type]?.find((row) => String(row.id) === selectedId);
  return voucher && !voucher.eligible ? (voucher.reason || 'Voucher belum memenuhi syarat') : '';
};

const pruneCanvasVoucherSelections = () => {
  const next = { ...selectedCanvasVoucherIds.value };
  selectableCanvasVoucherTypes.forEach((type) => {
    const selectedId = String(next[type] || '').trim();
    if (!selectedId) return;
    const selected = canvasVouchersByType.value[type]?.find((voucher) => String(voucher.id) === selectedId);
    if (!selected || !selected.eligible) next[type] = '';
  });
  selectedCanvasVoucherIds.value = next;
};

const buildCanvasVoucherParams = () => {
  const listItems = buildCanvasVoucherItems();
  const voucherSelections = buildCanvasVoucherSelections();
  const serializedItems = JSON.stringify(listItems);
  return {
    ...canvasScopeParams.value,
    id_customer: customerId.value || '',
    kode_customer: customerCode.value || '',
    nama_customer: customerName.value || '',
    list_items: serializedItems,
    items_json: serializedItems,
    voucher_selections: JSON.stringify(voucherSelections)
  };
};

const isCanvasVoucherEndpointUnavailable = (error) => [404, 405, 501].includes(Number(error?.response?.status || 0));

const loadLegacyCanvasVoucherFallback = async () => {
  const requests = await Promise.allSettled([
    api.get('/api/voucher/get-v2-regular'),
    api.get('/api/voucher/get-v3-regular')
  ]);
  const rows = requests.flatMap((result, index) => (
    result.status === 'fulfilled'
      ? getCanvasVoucherRows(result.value?.data).map((row) => ({ ...row, tipe_voucher: row?.tipe_voucher || index + 2 }))
      : []
  ));
  if (!rows.length) throw new Error('Voucher Canvas belum dapat dimuat.');
  return rows;
};

const loadEligibleCanvasVouchers = async ({ silent = true } = {}) => {
  if (mode.value !== 'order') return true;
  const requestId = ++canvasVoucherRequestSequence;
  canvasVoucherLoading.value = true;
  canvasVoucherError.value = '';
  try {
    const response = await api.get('/api/sales-canvas/eligible-vouchers', {
      params: buildCanvasVoucherParams()
    });
    if (requestId !== canvasVoucherRequestSequence) return false;
    const payload = getCanvasVoucherPayload(response.data);
    canvasVoucherRows.value = normalizeCanvasVoucherRows(getCanvasVoucherRows(response.data));
    // The server returns the canonical selected quote at the top level while
    // its scope metadata lives under context.  Keep both so the mobile footer
    // always uses the saved-order calculation (discount followed by PPN), not
    // a local pre-tax fallback.
    const context = payload.context || payload.summary || {};
    canvasVoucherContext.value = {
      ...context,
      selected_quote: payload.selected_quote || payload.quote || context.selected_quote || context.quote || null,
      quote: payload.quote || payload.selected_quote || context.quote || context.selected_quote || null
    };
    canvasVoucherFallback.value = false;
    pruneCanvasVoucherSelections();
    return true;
  } catch (error) {
    if (!isCanvasVoucherEndpointUnavailable(error)) {
      if (requestId === canvasVoucherRequestSequence) {
        canvasVoucherRows.value = [];
        canvasVoucherContext.value = {};
        canvasVoucherError.value = error?.response?.data?.message || error?.message || 'Voucher Canvas belum dapat diperiksa.';
      }
      if (!silent) await Swal.fire('Voucher Canvas', canvasVoucherError.value, 'info');
      return false;
    }

    try {
      const legacyRows = await loadLegacyCanvasVoucherFallback();
      if (requestId !== canvasVoucherRequestSequence) return false;
      canvasVoucherRows.value = normalizeCanvasVoucherRows(legacyRows, { fallback: true });
      canvasVoucherContext.value = {};
      canvasVoucherFallback.value = true;
      pruneCanvasVoucherSelections();
      return true;
    } catch (fallbackError) {
      if (requestId === canvasVoucherRequestSequence) {
        canvasVoucherRows.value = [];
        canvasVoucherContext.value = {};
        canvasVoucherError.value = fallbackError?.response?.data?.message || fallbackError?.message || 'Voucher Canvas belum dapat dimuat.';
      }
      if (!silent) await Swal.fire('Voucher Canvas', canvasVoucherError.value, 'info');
      return false;
    }
  } finally {
    if (requestId === canvasVoucherRequestSequence) canvasVoucherLoading.value = false;
  }
};

const scheduleCanvasVoucherReload = () => {
  if (canvasVoucherReloadTimer) clearTimeout(canvasVoucherReloadTimer);
  canvasVoucherReloadTimer = setTimeout(() => {
    canvasVoucherReloadTimer = null;
    loadEligibleCanvasVouchers({ silent: true });
  }, 350);
};

const handleCanvasVoucherSelection = async (type) => {
  const selectedId = String(selectedCanvasVoucherIds.value[type] || '').trim();
  if (selectedId) {
    const selected = canvasVouchersByType.value[type]?.find((voucher) => String(voucher.id) === selectedId);
    if (!selected || !selected.eligible) {
      selectedCanvasVoucherIds.value = { ...selectedCanvasVoucherIds.value, [type]: '' };
      await Swal.fire('Voucher tidak dapat digunakan', selected?.reason || 'Voucher belum memenuhi syarat order ini.', 'info');
      return;
    }
  }
  await loadEligibleCanvasVouchers({ silent: true });
};

const selectedCount = computed(() => selectedItems.value.length);
const totalEstimate = computed(() => selectedItems.value.reduce((sum, item) => sum + estimateLine(item), 0));
const selectedTotalPieces = computed(() => selectedItems.value.reduce((sum, item) => sum + getDraftPieces(item), 0));
const paymentOrders = computed(() => orderHistory.value
  .map((order) => ({
    ...order,
    id: Number(order.id || order.id_canvas_order || 0),
    total_order: Number(order.total_order || order.total_tagihan || 0),
    total_dibayarkan: Number(order.total_dibayarkan || order.jumlah_setoran || 0),
    sisa_tagihan: Number(order.sisa_tagihan ?? order.sisa_pembayaran ?? order.total_order ?? 0),
    is_lunas: Boolean(order.is_lunas) || Number(order.sisa_tagihan ?? order.sisa_pembayaran ?? order.total_order ?? 0) <= 0
  }))
  .filter((order) => order.id));
const payableOrders = computed(() => paymentOrders.value.filter((order) => Number(order.sisa_tagihan || 0) > 0));
const selectedCanvasOrder = computed(() => paymentOrders.value.find((order) => String(order.id) === String(selectedCanvasOrderId.value)));
const activeRequest = computed(() => requestHistory.value.find((request) => Number(request.status || 0) === 1) || requestHistory.value[0] || null);
const selectedOrderTotal = computed(() => Number(selectedCanvasOrder.value?.total_order || 0));
const selectedOrderPaid = computed(() => {
  if (!paymentHistory.value.length) return Number(selectedCanvasOrder.value?.total_dibayarkan || 0);
  return paymentHistory.value.reduce((sum, item) => (
    sum + Number(item.jumlah_setoran || item.nominal || item.jumlah_dibayarkan || 0)
  ), 0);
});
const selectedOrderRemaining = computed(() => Math.max(selectedOrderTotal.value - selectedOrderPaid.value, 0));
const activeHistoryRows = computed(() => (historyType.value === 'request' ? requestHistory.value : orderHistory.value));
const historyModalTitle = computed(() => (historyType.value === 'request' ? 'Riwayat Request Canvas' : 'Riwayat Penjualan Canvas'));
const historyDetailTitle = computed(() => {
  if (!selectedHistory.value) return '';
  return historyType.value === 'request'
    ? `Request #${selectedHistory.value.id}`
    : (selectedHistory.value.nama_customer || `Order #${selectedHistory.value.id}`);
});
const historyDetailTotal = computed(() => historyDetailRows.value.reduce((sum, item) => (
  sum + Number(item.total_permintaan || item.jumlah_harga || item.subtotal_harga || item.total || 0)
), 0));
const footerLabel = computed(() => {
  if (mode.value === 'payment') return 'Jumlah bayar';
  if (mode.value === 'order' && quotedCanvasOrderTotal.value !== null) return 'Estimasi tagihan (termasuk PPN)';
  return `${selectedCount.value} item`;
});
const footerTotal = computed(() => {
  if (mode.value === 'payment') return paymentAmount.value;
  if (mode.value === 'order') {
    return quotedCanvasOrderTotal.value ?? Math.max(totalEstimate.value - canvasVoucherDiscountPreview.value, 0);
  }
  return totalEstimate.value;
});
const footerValueText = computed(() => (
  mode.value === 'return'
    ? `${formatNumber(selectedTotalPieces.value)} pcs`
    : `Rp ${formatNumber(footerTotal.value)}`
));
const canSubmit = computed(() => {
  if (loading.value) return false;
  if (mode.value === 'order') {
    return Boolean(selectedCanvasRequestId.value && customerId.value)
      && selectedCount.value > 0
      && selectedItems.value.every((item) => getDraftPieces(item) <= getStock(item));
  }
  if (mode.value !== 'payment') return selectedCount.value > 0;
  const amount = Number(paymentAmount.value || 0);
  return Boolean(selectedCanvasOrder.value) && amount > 0 && amount <= Number(selectedOrderRemaining.value || 0) + 0.005;
});

const formatNumber = (value) => new Intl.NumberFormat('id-ID').format(Number(value || 0));
const getPaymentStatus = (order) => {
  const total = Number(order?.total_order || order?.total_tagihan || 0);
  const remaining = Number(order?.sisa_tagihan ?? order?.sisa_pembayaran ?? total);
  const paid = Number(order?.total_dibayarkan || order?.jumlah_setoran || 0);
  if (Boolean(order?.is_lunas) || (total > 0 && remaining <= 0)) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
};
const paymentStatusLabel = (order) => {
  const status = getPaymentStatus(order);
  if (status === 'paid') return 'Klaim Penuh · Menunggu Piutang Canvas Finance';
  if (status === 'partial') return 'Klaim Sebagian · Menunggu Piutang Canvas Finance';
  return 'Belum Bayar';
};
const paymentStatusClass = (order) => `payment-status ${getPaymentStatus(order)}`;
const requestStatusLabel = (status) => {
  const statusMap = { 1: 'Requested', 2: 'Approved', 3: 'Rejected' };
  return statusMap[Number(status || 0)] || 'Draft';
};

const clearLine = (id) => {
  draft.value[id] = { qty_uom1: 0, qty_uom2: 0, qty_uom3: 0 };
};

const adjustQty = (id, field, delta) => {
  const current = draft.value[id] || { qty_uom1: 0, qty_uom2: 0, qty_uom3: 0 };
  draft.value[id] = {
    ...current,
    [field]: Math.max(0, Number(current[field] || 0) + delta)
  };
};

const hasSavedRequest = (item) => mode.value === 'request' && Number(item.qty_request_today || 0) > 0;

const formatQty = (item) => {
  const parts = [
    { qty: item.qty_uom1, label: item.uom1_nama || 'PCS' },
    { qty: item.qty_uom2, label: item.uom2_nama || 'BOX' },
    { qty: item.qty_uom3, label: item.uom3_nama || 'CTN' }
  ].filter((part) => Number(part.qty || 0) > 0)
    .map((part) => `${formatNumber(part.qty)} ${part.label}`);
  return parts.length ? parts.join(' + ') : '0';
};

const closeHistoryModal = () => {
  historyModalOpen.value = false;
  selectedHistory.value = null;
  historyDetailRows.value = [];
};

const openHistory = async (type) => {
  historyType.value = type;
  selectedHistory.value = null;
  historyDetailRows.value = [];
  historyModalOpen.value = true;
  await fetchHistory();
};

const openHistoryDetail = async (entry) => {
  selectedHistory.value = entry;
  historyDetailRows.value = [];
  historyDetailLoading.value = true;
  try {
    const endpoint = historyType.value === 'request'
      ? '/api/sales-canvas/detail-canvas-request'
      : '/api/sales-canvas/detail-canvas-order';
    const params = historyType.value === 'request'
      ? { ...canvasScopeParams.value, id_canvas: entry.id, tanggal_request: entry.tanggal_request }
      : { ...canvasScopeParams.value, id_canvas_order: entry.id };
    const response = await api.get(endpoint, { params });
    historyDetailRows.value = normalizeRows(response.data);
  } catch (error) {
    console.error('Load detail history canvas gagal:', error);
    await Swal.fire('Gagal', error?.response?.data?.message || 'Gagal memuat detail riwayat canvas.', 'error');
  } finally {
    historyDetailLoading.value = false;
  }
};

const fetchHistory = async () => {
  const [requests, orders, returns] = await Promise.allSettled([
    api.get('/api/sales-canvas/all-canvas-request', { params: canvasScopeParams.value }),
    api.get('/api/sales-canvas/all-canvas-order', { params: orderHistoryParams.value }),
    api.get('/api/sales-canvas/return-stock-canvas/history', { params: canvasScopeParams.value })
  ]);
  requestHistory.value = requests.status === 'fulfilled' ? getCanvasArray(requests.value.data) : [];
  orderHistory.value = orders.status === 'fulfilled' ? getCanvasArray(orders.value.data) : [];
  returnHistory.value = returns.status === 'fulfilled' ? getCanvasArray(returns.value.data) : [];
  if (selectedCanvasOrderId.value && !paymentOrders.value.some((order) => String(order.id) === String(selectedCanvasOrderId.value))) {
    selectedCanvasOrderId.value = '';
    paymentHistory.value = [];
    paymentAmount.value = 0;
    paymentMethod.value = 'tunai';
    paymentAttempt.value = { signature: '', id: '' };
  }
};

const fetchPaymentHistory = async () => {
  paymentHistory.value = [];
  paymentAmount.value = 0;
  paymentMethod.value = 'tunai';
  if (!selectedCanvasOrderId.value) return;

  try {
    const response = await api.get('/api/sales-canvas/tagihan-pembayaran', {
      params: {
        ...canvasScopeParams.value,
        id_canvas_order: selectedCanvasOrderId.value
      }
    });
    paymentHistory.value = getCanvasArray(response.data);
  } catch (error) {
    console.error('Load pembayaran canvas gagal:', error);
    paymentHistory.value = [];
  }
};

const selectPaymentOrder = async (order) => {
  selectedCanvasOrderId.value = order?.id || '';
  paymentAttempt.value = { signature: '', id: '' };
  await fetchPaymentHistory();
  fillFullPayment();
};

const fillFullPayment = () => {
  paymentAmount.value = Math.max(Number(selectedOrderRemaining.value || 0), 0);
};

const fetchCarriedStockSummary = async () => {
  try {
    const response = await api.get('/api/sales-canvas/list-order-canvas', { params: canvasScopeParams.value });
    applyCarriedStockSummary(normalizeRows(response.data));
  } catch (error) {
    console.error('Load ringkasan stok canvas gagal:', error);
    carriedStockItems.value = 0;
    carriedStockTotal.value = 0;
  }
};

const fetchProducts = async () => {
  const sequence = ++canvasProductsRequestSequence;
  const scope = JSON.stringify({ ...canvasScopeParams.value, mode: mode.value });
  const isCurrent = () => sequence === canvasProductsRequestSequence
    && scope === JSON.stringify({ ...canvasScopeParams.value, mode: mode.value });
  loading.value = true;
  try {
    if (mode.value === 'order') {
      const requestsResponse = await api.get('/api/sales-canvas/all-canvas-request', {
        params: { ...canvasScopeParams.value, eligible_only: 1, status: 2, limit: 100, page: 1 }
      });
      if (!isCurrent()) return;
      approvedCanvasRequests.value = getCanvasArray(requestsResponse.data);
      const selectedId = String(selectedCanvasRequestId.value || '');
      const selected = approvedCanvasRequests.value.find((entry) => String(entry.id) === selectedId)
        || approvedCanvasRequests.value[0];
      if (String(selected?.id || '') !== selectedId) draft.value = {};
      selectedCanvasRequestId.value = String(selected?.id || '');
      if (!selected) {
        items.value = [];
        return;
      }
      const detailResponse = await api.get('/api/sales-canvas/detail-canvas-request', {
        params: { ...canvasScopeParams.value, id_canvas: selected.id, eligible_only: 1 }
      });
      if (!isCurrent()) return;
      const rows = normalizeRows(detailResponse.data)
        .filter((item) => Number(item.available_order_qty_pcs || 0) > 0)
        .map((item) => ({ ...item, qty_uom1: 0, qty_uom2: 0, qty_uom3: 0 }));
      items.value = rows;
      ensureDraft(rows);
      return;
    }
    const endpoint = mode.value === 'request'
      ? '/api/sales-canvas/list-product-canvas'
      : '/api/sales-canvas/list-order-canvas';
    const response = await api.get(endpoint, { params: canvasScopeParams.value });
    if (!isCurrent()) return;
    const rows = normalizeRows(response.data);
    items.value = rows;
    ensureDraft(rows);
    if (mode.value !== 'request') {
      applyCarriedStockSummary(rows);
    }
  } catch (error) {
    if (!isCurrent()) return;
    console.error('Load sales canvas gagal:', error);
    items.value = [];
    await Swal.fire('Gagal', error?.response?.data?.message || 'Gagal memuat sales canvas.', 'error');
  } finally {
    if (isCurrent()) loading.value = false;
  }
};

const selectCanvasRequest = async (requestId) => {
  selectedCanvasRequestId.value = String(requestId || '');
  draft.value = {};
  items.value = [];
  selectedCanvasVoucherIds.value = { 2: '', 3: '' };
  await fetchProducts();
  await loadEligibleCanvasVouchers({ silent: true });
};

const refresh = async () => {
  if (mode.value === 'payment' || mode.value === 'history') {
    canvasProductsRequestSequence += 1;
    loading.value = false;
    items.value = [];
    await Promise.all([fetchHistory(), fetchPaymentHistory(), fetchCarriedStockSummary()]);
    return;
  }
  await Promise.all([
    fetchProducts(),
    fetchHistory(),
    ['request', 'order'].includes(mode.value) ? fetchCarriedStockSummary() : Promise.resolve(),
    mode.value === 'order' ? loadCanvasCustomers(customerSearch.value) : Promise.resolve()
  ]);
  if (mode.value === 'order') await loadEligibleCanvasVouchers({ silent: true });
};

const refreshCanvas = async () => {
  const previousPrincipalId = String(selectedCanvasPrincipalId.value || '').trim();
  await loadCanvasPrincipals();
  if (previousPrincipalId !== String(selectedCanvasPrincipalId.value || '').trim()) {
    resetCanvasPrincipalState();
  }
  await refresh();
};

const setMode = async (nextMode, { syncRoute = true } = {}) => {
  if (!availableModes.value.includes(nextMode)) return;
  if (mode.value === nextMode) return;
  canvasProductsRequestSequence += 1;
  loading.value = false;
  mode.value = nextMode;
  draft.value = {};
  selectedCanvasOrderId.value = '';
  paymentHistory.value = [];
  paymentAmount.value = 0;
  if (nextMode !== 'order') {
    canvasVoucherRows.value = [];
    canvasVoucherContext.value = {};
    canvasVoucherError.value = '';
    canvasVoucherFallback.value = false;
    selectedCanvasVoucherIds.value = { 2: '', 3: '' };
  }
  if (nextMode === 'payment' || nextMode === 'history') {
    items.value = [];
    await Promise.all([fetchHistory(), fetchCarriedStockSummary()]);
    return;
  }
  await fetchProducts();
  if (nextMode === 'order') {
    await Promise.all([
      loadCanvasCustomers(customerSearch.value),
      loadEligibleCanvasVouchers({ silent: true })
    ]);
  }
  if (syncRoute) {
    await router.replace({
      path: route.path,
      query: { ...route.query, mode: nextMode }
    });
  }
};

const submitRequest = async () => {
  for (const item of selectedItems.value) {
    const response = await api.post('/api/sales-canvas/create-canvas-request', {
      ...canvasScopeParams.value,
      id_produk: item.id,
      ...draft.value[item.id]
    });
    assertCanvasSuccess(response.data);
  }
};

const deleteRequestItem = async (item) => {
  const confirm = await Swal.fire({
    icon: 'warning',
    title: 'Hapus Item?',
    text: item.nama_produk ? `Hapus ${item.nama_produk} dari request canvas?` : 'Hapus item dari request canvas?',
    showCancelButton: true,
    confirmButtonText: 'Hapus',
    cancelButtonText: 'Batal'
  });

  if (!confirm.isConfirmed) return;

  submitting.value = true;
  try {
    const response = await api.post('/api/sales-canvas/delete-canvas-request-item', {
      ...canvasScopeParams.value,
      id_produk: item.id
    });
    assertCanvasSuccess(response.data);
    clearLine(item.id);
    await Swal.fire({
      icon: 'success',
      title: 'Berhasil',
      text: 'Produk dihapus dari request canvas.',
      timer: 1200,
      showConfirmButton: false
    });
    await refresh();
  } catch (error) {
    console.error('Hapus item request canvas gagal:', error);
    await Swal.fire('Gagal', error?.response?.data?.message || error.message || 'Gagal menghapus item request canvas.', 'error');
  } finally {
    submitting.value = false;
  }
};

const submitOrder = async () => {
  if (!selectedCanvasRequestId.value) {
    await Swal.fire('Peringatan', 'Pilih request approved yang masih memiliki jumlah siap order.', 'warning');
    return false;
  }
  const excessiveItem = selectedItems.value.find((item) => getDraftPieces(item) > getStock(item));
  if (excessiveItem) {
    await Swal.fire('Peringatan', `Qty ${excessiveItem.nama_produk} melebihi ${formatNumber(getStock(excessiveItem))} PCS yang siap order.`, 'warning');
    return false;
  }
  if (!customerId.value || !customerName.value) {
    await Swal.fire('Peringatan', 'Pilih customer terdaftar terlebih dahulu.', 'warning');
    return false;
  }

  const requestedVoucherSelections = buildCanvasVoucherSelections();
  if (requestedVoucherSelections.length) {
    const voucherReady = await loadEligibleCanvasVouchers({ silent: true });
    const verifiedVoucherSelections = buildCanvasVoucherSelections();
    const isSameSelection = requestedVoucherSelections.length === verifiedVoucherSelections.length
      && requestedVoucherSelections.every((requested) => verifiedVoucherSelections.some((verified) => (
        Number(verified.tipe_voucher) === Number(requested.tipe_voucher)
        && Number(verified.id) === Number(requested.id)
      )));
    if (!voucherReady || !isSameSelection || selectedCanvasVoucherQuoteReason.value) {
      await Swal.fire(
        'Voucher berubah',
        selectedCanvasVoucherQuoteReason.value || 'Voucher tidak lagi memenuhi syarat order ini. Pilih ulang voucher yang tersedia.',
        'info'
      );
      return false;
    }
  }

  const listItems = buildCanvasVoucherItems();
  const voucherSelections = buildCanvasVoucherSelections();
  const voucherByType = voucherSelections.reduce((result, selection) => {
    result[selection.tipe_voucher] = selection.id;
    return result;
  }, {});

  const response = await api.post('/api/sales-canvas/create-canvas-order', {
    ...canvasScopeParams.value,
    id_canvas_request: Number(selectedCanvasRequestId.value),
    nama_customer: customerName.value,
    kode_customer: customerCode.value,
    id_customer: customerId.value,
    list_items: listItems,
    voucher_selections: voucherSelections,
    id_voucher_2: voucherByType[2] || null,
    id_voucher_3: voucherByType[3] || null
  });

  assertCanvasSuccess(response.data);
  return true;
};

const submitPayment = async () => {
  if (!selectedCanvasOrder.value) {
    await Swal.fire('Peringatan', 'Pilih order canvas terlebih dahulu.', 'warning');
    return false;
  }

  const amount = Number(paymentAmount.value || 0);
  if (amount <= 0 || amount > Number(selectedOrderRemaining.value || 0) + 0.005) {
    await Swal.fire('Peringatan', 'Nominal pembayaran harus lebih dari Rp 0 dan tidak boleh melebihi sisa tagihan.', 'warning');
    return false;
  }

  const signature = [selectedCanvasOrder.value.id, amount.toFixed(2), paymentMethod.value].join(':');
  if (paymentAttempt.value.signature !== signature) {
    const paymentId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    paymentAttempt.value = { signature, id: paymentId };
  }

  const response = await api.post('/api/sales-canvas/submit-tagihan-pembayaran', {
    ...canvasScopeParams.value,
    id_canvas_order: selectedCanvasOrder.value.id,
    jumlah_dibayarkan: amount,
    tipe_setoran: paymentMethod.value,
    payment_id: paymentAttempt.value.id
  });
  assertCanvasSuccess(response.data);
  paymentAttempt.value = { signature: '', id: '' };
  return true;
};

const submitReturnStock = async () => {
  const listItems = selectedItems.value.map((item) => ({
    id_produk: item.id,
    qty_uom1: Number(draft.value[item.id]?.qty_uom1 || 0),
    qty_uom2: hasUomLevel(item, 2) ? Number(draft.value[item.id]?.qty_uom2 || 0) : 0,
    qty_uom3: hasUomLevel(item, 3) ? Number(draft.value[item.id]?.qty_uom3 || 0) : 0
  }));

  const response = await api.post('/api/sales-canvas/return-stock-canvas', {
    ...canvasScopeParams.value,
    list_items: listItems
  });
  assertCanvasSuccess(response.data);
  return true;
};

const submit = async () => {
  submitting.value = true;
  try {
    const ok = mode.value === 'request'
      ? await submitRequest()
      : mode.value === 'order'
        ? await submitOrder()
        : mode.value === 'return'
          ? await submitReturnStock()
          : await submitPayment();
    if (ok === false) return;

    await Swal.fire({
      icon: 'success',
      title: 'Berhasil',
      text: mode.value === 'request'
        ? 'Request canvas berhasil dikirim.'
        : mode.value === 'order'
          ? 'Order canvas berhasil disimpan.'
          : mode.value === 'return'
            ? 'Pengajuan retur Canvas berhasil dikirim dan menunggu approval serta QC Karantina.'
            : 'Pengakuan pembayaran Canvas berhasil disimpan sebagai claim dan menunggu proses Piutang Canvas Finance.',
      timer: 1400,
      showConfirmButton: false
    });
    draft.value = {};
    paymentAmount.value = 0;
    paymentMethod.value = 'tunai';
    await refresh();
  } catch (error) {
    console.error('Submit sales canvas gagal:', error);
    await Swal.fire('Gagal', error?.response?.data?.message || error.message || 'Gagal menyimpan sales canvas.', 'error');
  } finally {
    submitting.value = false;
  }
};

const canvasVoucherContextKey = computed(() => JSON.stringify({
  mode: mode.value,
  idPrincipal: selectedCanvasPrincipalId.value,
  customerName: customerName.value,
  idCustomer: customerId.value,
  kodeCustomer: customerCode.value,
  items: buildCanvasVoucherItems()
}));

watch(canvasVoucherContextKey, () => {
  if (mode.value === 'order') scheduleCanvasVoucherReload();
});

// The Canvas hub uses `mode` as its tab deep-link.  A component instance is
// reused when only the query changes, so react to browser navigation and any
// in-app legacy redirect instead of leaving the visible tab out of sync.
watch(
  () => route.query.mode,
  async (requestedMode) => {
    const nextMode = String(requestedMode || '').trim().toLowerCase();
    if (!availableModes.value.includes(nextMode) || nextMode === mode.value) return;
    await setMode(nextMode, { syncRoute: false });
  }
);

onBeforeUnmount(() => {
  if (canvasVoucherReloadTimer) clearTimeout(canvasVoucherReloadTimer);
  if (canvasCustomerSearchTimer) clearTimeout(canvasCustomerSearchTimer);
  canvasVoucherRequestSequence += 1;
  canvasCustomerRequestSequence += 1;
});

onMounted(refreshCanvas);
</script>

<style scoped>
.canvas-page { min-height: 100vh; background: #f8fafc; padding-bottom: 92px; color: #0f172a; }
.canvas-header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #0f172a; color: #f8fafc; }
.canvas-header p { margin: 0; font-size: 0.72rem; color: #cbd5e1; text-transform: uppercase; font-weight: 800; }
.canvas-header h3 { margin: 2px 0 0; font-size: 1rem; }
.btn-back, .btn-refresh { border: none; width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; background: rgba(255,255,255,0.1); color: #fff; }
.btn-refresh { margin-left: auto; }
.canvas-content { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.summary-card, .principal-card, .history-strip, .customer-card, .payment-card, .request-card, .product-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
.summary-card { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.principal-card { display: flex; flex-direction: column; gap: 10px; }
.principal-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.principal-card-head span { display: block; color: #64748b; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; }
.principal-card-head strong { display: block; margin-top: 4px; font-size: 0.95rem; }
.principal-card-head small { display: block; margin-top: 2px; color: #64748b; font-size: 0.72rem; font-weight: 700; }
.principal-card-head em { flex: 0 0 auto; border-radius: 999px; padding: 4px 8px; background: #dcfce7; color: #166534; font-size: 0.68rem; font-style: normal; font-weight: 900; }
.principal-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: thin; }
.principal-tabs button { flex: 0 0 auto; max-width: 175px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 9px 10px; background: #f8fafc; color: #475569; text-align: left; }
.principal-tabs button span, .principal-tabs button small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.principal-tabs button span { font-size: 0.78rem; font-weight: 900; }
.principal-tabs button small { margin-top: 2px; color: #64748b; font-size: 0.68rem; font-weight: 700; }
.principal-tabs button.active { border-color: #0f766e; background: #ecfdf5; color: #0f766e; box-shadow: 0 0 0 2px rgba(15,118,110,0.12); }
.principal-tabs button:disabled { opacity: 0.65; }
.history-strip { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.summary-card .carry-summary { grid-column: 1 / -1; border-top: 1px solid #e2e8f0; padding-top: 10px; }
.summary-card small { display: block; margin-top: 2px; color: #64748b; font-size: 0.72rem; font-weight: 700; }
.history-strip button { text-align: left; border: none; background: transparent; padding: 0; color: inherit; }
.summary-card span, .history-strip span, .request-card span, .customer-card label, .payment-card label, .payment-summary span, .payment-history span { display: block; font-size: 0.72rem; color: #64748b; font-weight: 800; text-transform: uppercase; }
.summary-card strong, .history-strip strong, .request-card strong { display: block; margin-top: 4px; font-size: 0.95rem; }
.request-card { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.segmented { display: flex; gap: 0; overflow-x: auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; box-shadow: 0 4px 14px rgba(15,23,42,0.05); scrollbar-width: thin; }
.segmented button { flex: 1 0 auto; min-width: 94px; min-height: 46px; border: none; border-right: 1px solid #e2e8f0; padding: 10px 8px; background: transparent; color: #475569; font-size: 0.72rem; font-weight: 800; display: inline-flex; gap: 6px; justify-content: center; align-items: center; }
.segmented button:last-child { border-right: none; }
.segmented .return-tab { justify-content: center; }
.segmented button.active { background: #ecfdf5; color: #0f766e; box-shadow: inset 0 0 0 1px rgba(15,118,110,0.2); }
.canvas-history-panel { display: flex; flex-direction: column; gap: 10px; background: #fff; border: 1px solid #cbd5e1; border-radius: 14px; padding: 14px; box-shadow: 0 4px 14px rgba(15,23,42,0.05); }
.canvas-history-head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
.canvas-history-head span { display: block; color: #0f766e; font-size: 0.68rem; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; }
.canvas-history-head strong { display: block; margin-top: 3px; color: #0f172a; font-size: .86rem; line-height: 1.35; }
.canvas-history-head button { flex: 0 0 auto; border: 1px solid #99f6e4; border-radius: 9px; padding: 8px 9px; background: #f0fdfa; color: #0f766e; font-size: .7rem; font-weight: 900; display: inline-flex; gap: 5px; align-items: center; }
.canvas-history-summary { width: 100%; border: 1px solid #e2e8f0; border-radius: 12px; padding: 11px; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: space-between; gap: 12px; text-align: left; }
.canvas-history-summary.request { border-color: #bfdbfe; background: #eff6ff; }
.canvas-history-summary.order { border-color: #bbf7d0; background: #f0fdf4; }
.canvas-history-summary.return { border-color: #fed7aa; background: #fff7ed; }
.canvas-history-summary.readonly { cursor: default; }
.canvas-history-summary span, .canvas-history-summary strong, .canvas-history-summary small { display: block; }
.canvas-history-summary span { color: #475569; font-size: .68rem; font-weight: 900; text-transform: uppercase; }
.canvas-history-summary strong { margin-top: 3px; font-size: .9rem; }
.canvas-history-summary small { margin-top: 3px; color: #64748b; font-size: .7rem; line-height: 1.3; }
.canvas-history-summary > svg { flex: 0 0 auto; color: #0f766e; font-size: 1rem; }
.return-history-row { border-top: 1px solid #e2e8f0; padding: 9px 2px 0; display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
.return-history-row strong, .return-history-row span { display: block; }
.return-history-row strong { color: #0f172a; font-size: .76rem; }
.return-history-row span { margin-top: 2px; color: #64748b; font-size: .68rem; }
.return-history-row > div:last-child { text-align: right; }
.return-history-row b { color: #9a3412; font-size: .75rem; }
.customer-card input, .customer-card select, .payment-card input, .payment-card select { margin-top: 8px; width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; font-size: 1rem; background: #fff; color: #0f172a; }
.customer-card input[readonly] { background: #f8fafc; color: #334155; }
.customer-card small { display: block; margin-top: 6px; color: #64748b; font-size: 0.75rem; }
.customer-search-control { position: relative; display: flex; align-items: center; }
.customer-search-control input { padding-right: 42px; }
.customer-clear { position: absolute; right: 8px; top: calc(50% + 4px); transform: translateY(-50%); width: 30px; height: 30px; border: none; border-radius: 8px; background: #e2e8f0; color: #475569; }
.customer-results { position: relative; z-index: 5; max-height: 224px; overflow-y: auto; margin-top: 6px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; box-shadow: 0 10px 24px rgba(15,23,42,0.12); }
.customer-result { width: 100%; border: none; border-bottom: 1px solid #e2e8f0; padding: 10px 12px; background: #fff; color: #0f172a; text-align: left; }
.customer-result:last-child { border-bottom: none; }
.customer-result:active { background: #ecfdf5; }
.customer-result strong, .customer-result span { display: block; }
.customer-result strong { font-size: 0.82rem; }
.customer-result span, .customer-search-state { margin-top: 3px; color: #64748b; font-size: 0.71rem; font-weight: 700; }
.customer-result .customer-principal-label { color: #0f766e; }
.customer-search-state { margin: 0; padding: 12px; text-align: center; }
.customer-load-more { width: 100%; border: none; padding: 11px 12px; background: #ecfdf5; color: #0f766e; font-size: 0.75rem; font-weight: 900; text-align: center; }
.canvas-voucher-card { background: #fff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px; }
.canvas-voucher-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.canvas-voucher-head > div > span { display: block; color: #0369a1; font-size: 0.72rem; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; }
.canvas-voucher-head > div > strong { display: block; margin-top: 4px; color: #0f172a; font-size: 0.86rem; line-height: 1.35; }
.canvas-voucher-refresh { flex: 0 0 auto; border: none; border-radius: 9px; padding: 8px 10px; background: #e0f2fe; color: #0369a1; font-size: 0.74rem; font-weight: 900; display: inline-flex; align-items: center; gap: 6px; }
.canvas-voucher-refresh:disabled { opacity: 0.65; }
.canvas-voucher-hint, .canvas-voucher-error { margin: 10px 0 0; font-size: 0.74rem; line-height: 1.4; }
.canvas-voucher-hint { color: #64748b; }
.canvas-voucher-hint.warning { color: #a16207; }
.canvas-voucher-error { color: #b91c1c; }
.canvas-voucher-selects { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
.canvas-voucher-selects label > span { display: block; margin-bottom: 4px; color: #475569; font-size: 0.68rem; font-weight: 900; text-transform: uppercase; }
.canvas-voucher-selects select { width: 100%; min-width: 0; border: 1px solid #bfdbfe; border-radius: 9px; padding: 9px 8px; background: #f8fbff; color: #0f172a; font-size: 0.78rem; font-weight: 700; }
.canvas-voucher-selects select:disabled { color: #94a3b8; background: #f1f5f9; }
.canvas-voucher-reason { display: block; margin-top: 4px; color: #b45309; font-size: 0.66rem; line-height: 1.3; }
.canvas-voucher-applied { display: flex; flex-direction: column; gap: 7px; margin-top: 10px; }
.canvas-voucher-applied > div { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 9px; border: 1px solid #bae6fd; border-radius: 9px; background: #f0f9ff; }
.canvas-voucher-applied strong, .canvas-voucher-applied small { display: block; }
.canvas-voucher-applied strong { color: #0c4a6e; font-size: 0.76rem; }
.canvas-voucher-applied small { margin-top: 2px; color: #0369a1; font-size: 0.66rem; font-weight: 700; }
.canvas-voucher-applied b { color: #047857; font-size: 0.78rem; white-space: nowrap; }
.canvas-voucher-applied em { color: #64748b; font-size: 0.68rem; font-style: normal; font-weight: 800; white-space: nowrap; }
.canvas-voucher-info { margin-top: 11px; border: none; padding: 0; background: transparent; color: #0369a1; font-size: 0.74rem; font-weight: 900; text-decoration: underline; text-underline-offset: 3px; }
.voucher-info-list { display: flex; flex-direction: column; gap: 9px; margin-top: 12px; }
.voucher-info-row { border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; padding: 10px; }
.voucher-info-title > span, .voucher-info-title > strong, .voucher-info-title > small { display: block; }
.voucher-info-title > span { color: #0369a1; font-size: 0.66rem; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; }
.voucher-info-title > strong { margin-top: 3px; color: #0f172a; font-size: 0.86rem; }
.voucher-info-title > small { margin-top: 2px; color: #64748b; font-size: 0.7rem; font-weight: 700; }
.voucher-info-row em { display: block; margin-top: 8px; color: #047857; font-size: 0.73rem; font-style: normal; font-weight: 800; }
.voucher-info-row em.unavailable { color: #b45309; }
.voucher-info-row p { margin: 7px 0 0; color: #64748b; font-size: 0.73rem; line-height: 1.4; }
.payment-card { display: flex; flex-direction: column; gap: 12px; }
.active-customer-box { border: 1px solid #99f6e4; background: #f0fdfa; border-radius: 12px; padding: 10px; }
.active-customer-box span { display: block; color: #0f766e; font-size: 0.68rem; font-weight: 900; text-transform: uppercase; }
.active-customer-box strong { display: block; margin-top: 3px; color: #134e4a; }
.active-customer-box small { display: block; margin-top: 2px; color: #0f766e; font-size: 0.72rem; font-weight: 800; }
.payment-order-list { display: flex; flex-direction: column; gap: 8px; }
.payment-order-card { border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; color: #0f172a; padding: 10px; display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; text-align: left; }
.payment-order-card.active { border-color: #0f766e; box-shadow: 0 0 0 2px rgba(15,118,110,0.14); background: #f0fdfa; }
.payment-order-card.paid { opacity: 0.78; }
.payment-order-card strong { display: block; font-size: 0.9rem; }
.payment-order-card small { display: block; margin-top: 2px; color: #64748b; font-size: 0.72rem; font-weight: 800; }
.payment-order-card em { margin-top: 7px; }
.payment-order-amounts { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; font-size: 0.72rem; color: #64748b; font-weight: 800; }
.payment-order-amounts b { color: #0f172a; font-size: 0.82rem; }
.payment-summary { display: grid; grid-template-columns: 1fr; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
.payment-summary strong { display: block; margin-top: 3px; color: #0f172a; }
.payment-input-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: stretch; }
.payment-input-row input { margin-top: 0; }
.payment-input-row button { border: none; border-radius: 10px; padding: 0 14px; background: #0f766e; color: #fff; font-weight: 900; }
.payment-input-row button:disabled { background: #cbd5e1; color: #64748b; }
.payment-method-select { width: 100%; margin-top: -4px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 11px 12px; background: #fff; color: #0f172a; font: inherit; }
.payment-hint { display: block; margin-top: -4px; color: #64748b; font-size: 0.75rem; line-height: 1.35; }
.payment-status { display: inline-flex; width: fit-content; border-radius: 999px; padding: 4px 8px; font-size: 0.72rem; font-style: normal; font-weight: 900; }
.payment-status.paid { background: #dcfce7; color: #166534; }
.payment-status.partial { background: #fef3c7; color: #92400e; }
.payment-status.unpaid { background: #fee2e2; color: #991b1b; }
.payment-history { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
.payment-history p { margin: 6px 0 0; color: #0f172a; font-weight: 800; }
.state-box { min-height: 180px; display: grid; place-items: center; text-align: center; color: #64748b; gap: 10px; }
.state-box.compact { min-height: 120px; }
.spinner { width: 30px; height: 30px; border: 3px solid #e2e8f0; border-top-color: #0f766e; border-radius: 50%; animation: spin 0.8s linear infinite; }
.product-list { display: flex; flex-direction: column; gap: 10px; }
.product-main { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
.product-main h4 { margin: 0; font-size: 0.94rem; }
.product-main p { margin: 4px 0 0; color: #64748b; font-size: 0.78rem; }
.stock-chip { white-space: nowrap; background: #dcfce7; color: #166534; border-radius: 999px; padding: 5px 8px; font-size: 0.72rem; font-weight: 800; }
.stock-chip.danger { background: #fee2e2; color: #991b1b; }
.qty-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
.qty-grid label span { display: block; font-size: 0.68rem; color: #64748b; font-weight: 800; margin-bottom: 4px; }
.qty-stepper { display: grid; grid-template-columns: 32px minmax(0, 1fr) 32px; align-items: stretch; border: 1px solid #cbd5e1; border-radius: 9px; overflow: hidden; background: #fff; }
.qty-stepper button { border: none; background: #f1f5f9; color: #0f766e; font-size: 1rem; font-weight: 900; }
.qty-stepper button:disabled { color: #94a3b8; cursor: not-allowed; }
.qty-grid input { width: 100%; min-width: 0; box-sizing: border-box; border: none; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-radius: 0; padding: 9px 2px; text-align: center; font-weight: 800; }
.qty-grid input::-webkit-outer-spin-button,
.qty-grid input::-webkit-inner-spin-button { margin: 0; appearance: none; }
.qty-grid label.disabled { opacity: 0.45; }
.qty-grid label.disabled input,
.qty-grid label.disabled .qty-stepper { background: #e2e8f0; cursor: not-allowed; }
.product-footer { margin-top: 10px; display: flex; justify-content: space-between; align-items: center; color: #475569; font-size: 0.82rem; }
.product-actions { display: inline-flex; gap: 6px; align-items: center; }
.product-footer button { border: none; border-radius: 8px; width: 30px; height: 30px; background: #f1f5f9; color: #64748b; }
.product-footer button.danger { background: #fee2e2; color: #991b1b; }
.canvas-footer { position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; background: #fff; border-top: 1px solid #e2e8f0; box-shadow: 0 -8px 22px rgba(15,23,42,0.08); }
.canvas-footer span { display: block; color: #64748b; font-size: 0.75rem; font-weight: 700; }
.canvas-footer strong { display: block; margin-top: 2px; color: #0f172a; }
.canvas-footer button { border: none; border-radius: 12px; padding: 13px 16px; background: #0f766e; color: #fff; font-weight: 900; display: inline-flex; align-items: center; gap: 8px; }
.canvas-footer button:disabled { background: #cbd5e1; color: #64748b; }
.modal-backdrop { position: fixed; inset: 0; z-index: 30; background: rgba(15,23,42,0.55); display: flex; align-items: flex-end; }
.history-modal { width: 100%; max-height: 82vh; overflow: auto; background: #fff; border-radius: 18px 18px 0 0; padding: 14px; box-shadow: 0 -16px 40px rgba(15,23,42,0.2); }
.history-modal header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
.history-modal header span { color: #64748b; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; }
.history-modal header h4 { margin: 2px 0 0; color: #0f172a; }
.history-modal header button { border: none; width: 34px; height: 34px; border-radius: 10px; background: #f1f5f9; color: #475569; }
.history-list-modal, .history-detail-modal { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.history-row, .detail-row { border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; padding: 10px; display: flex; justify-content: space-between; gap: 10px; align-items: center; text-align: left; color: #0f172a; }
.history-row span, .detail-row span { display: block; margin-top: 3px; color: #64748b; font-size: 0.76rem; }
.history-amount { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
.customer-history-box { border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 12px; padding: 10px; }
.customer-history-box span { display: block; color: #166534; font-size: 0.7rem; font-weight: 900; text-transform: uppercase; }
.customer-history-box strong { display: block; margin-top: 3px; color: #14532d; }
.customer-history-box small { display: block; margin-top: 2px; color: #15803d; }
.customer-history-box em { margin-top: 8px; }
.empty-inline { margin: 12px 0; color: #64748b; text-align: center; }
.detail-total { margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; }
.detail-total span { color: #64748b; font-weight: 800; }
.detail-total strong { color: #0f766e; font-size: 1.05rem; }
@keyframes spin { to { transform: rotate(360deg); } }
:global(:root[data-theme='dark']) .canvas-page { background: #020617; color: #e2e8f0; }
:global(:root[data-theme='dark']) .summary-card,
:global(:root[data-theme='dark']) .principal-card,
:global(:root[data-theme='dark']) .history-strip,
:global(:root[data-theme='dark']) .canvas-history-panel,
:global(:root[data-theme='dark']) .customer-card,
:global(:root[data-theme='dark']) .payment-card,
:global(:root[data-theme='dark']) .request-card,
:global(:root[data-theme='dark']) .product-card,
:global(:root[data-theme='dark']) .canvas-footer { background: #0f172a; border-color: #334155; }
:global(:root[data-theme='dark']) .summary-card .carry-summary { border-color: #334155; }
:global(:root[data-theme='dark']) .customer-card input,
:global(:root[data-theme='dark']) .customer-card select,
:global(:root[data-theme='dark']) .payment-card input,
:global(:root[data-theme='dark']) .payment-card select,
:global(:root[data-theme='dark']) .qty-grid input { background: #020617; border-color: #334155; color: #e2e8f0; }
:global(:root[data-theme='dark']) .customer-results { background: #0f172a; border-color: #334155; box-shadow: 0 10px 24px rgba(0,0,0,0.3); }
:global(:root[data-theme='dark']) .customer-result { background: #0f172a; color: #f8fafc; border-color: #334155; }
:global(:root[data-theme='dark']) .customer-result:active { background: rgba(20,184,166,0.14); }
:global(:root[data-theme='dark']) .customer-clear { background: #334155; color: #e2e8f0; }
:global(:root[data-theme='dark']) .qty-stepper { background: #020617; border-color: #334155; }
:global(:root[data-theme='dark']) .qty-stepper button { background: #111827; color: #2dd4bf; }
:global(:root[data-theme='dark']) .payment-order-card { background: #020617; border-color: #334155; color: #f8fafc; }
:global(:root[data-theme='dark']) .payment-order-card.active { background: rgba(20,184,166,0.12); border-color: #2dd4bf; }
:global(:root[data-theme='dark']) .payment-order-amounts b { color: #f8fafc; }
:global(:root[data-theme='dark']) .active-customer-box { background: rgba(20,184,166,0.12); border-color: rgba(45,212,191,0.35); }
:global(:root[data-theme='dark']) .active-customer-box strong { color: #ccfbf1; }
:global(:root[data-theme='dark']) .customer-card input[readonly] { background: #111827; color: #e2e8f0; }
:global(:root[data-theme='dark']) .payment-summary,
:global(:root[data-theme='dark']) .payment-history { background: #020617; border-color: #334155; }
:global(:root[data-theme='dark']) .payment-hint { color: #94a3b8; }
:global(:root[data-theme='dark']) .segmented { background: #0f172a; border-color: #334155; box-shadow: none; }
:global(:root[data-theme='dark']) .segmented button { border-color: #334155; }
:global(:root[data-theme='dark']) .canvas-history-head strong,
:global(:root[data-theme='dark']) .canvas-history-summary,
:global(:root[data-theme='dark']) .return-history-row strong { color: #f8fafc; }
:global(:root[data-theme='dark']) .canvas-history-summary { background: #020617; border-color: #334155; }
:global(:root[data-theme='dark']) .canvas-history-summary.request { background: rgba(30, 64, 175, .18); border-color: rgba(96, 165, 250, .38); }
:global(:root[data-theme='dark']) .canvas-history-summary.order { background: rgba(6, 78, 59, .2); border-color: rgba(74, 222, 128, .3); }
:global(:root[data-theme='dark']) .canvas-history-summary.return { background: rgba(124, 45, 18, .2); border-color: rgba(251, 146, 60, .35); }
:global(:root[data-theme='dark']) .canvas-history-head button { background: rgba(20, 184, 166, .12); border-color: rgba(45, 212, 191, .35); color: #5eead4; }
:global(:root[data-theme='dark']) .return-history-row { border-color: #334155; }
:global(:root[data-theme='dark']) .history-modal { background: #0f172a; }
:global(:root[data-theme='dark']) .history-modal header,
:global(:root[data-theme='dark']) .detail-total { border-color: #334155; }
:global(:root[data-theme='dark']) .history-modal header h4,
:global(:root[data-theme='dark']) .history-row,
:global(:root[data-theme='dark']) .detail-row { color: #f8fafc; }
:global(:root[data-theme='dark']) .history-row,
:global(:root[data-theme='dark']) .detail-row { background: #020617; border-color: #334155; }
:global(:root[data-theme='dark']) .customer-history-box { background: rgba(20,83,45,0.22); border-color: rgba(74,222,128,0.35); }
:global(:root[data-theme='dark']) .customer-history-box strong { color: #dcfce7; }
:global(:root[data-theme='dark']) .segmented button.active { background: rgba(20,184,166,0.14); color: #2dd4bf; box-shadow: inset 0 0 0 1px rgba(45,212,191,0.24); }
:global(:root[data-theme='dark']) .canvas-footer strong,
:global(:root[data-theme='dark']) .payment-summary strong,
:global(:root[data-theme='dark']) .payment-history p,
:global(:root[data-theme='dark']) .product-main h4 { color: #f8fafc; }

:global(:root[data-theme='light']) .canvas-page { background: #f8fafc; color: #0f172a; }
:global(:root[data-theme='light']) .canvas-header { background: #fff; color: #0f172a; border-bottom: 1px solid #e2e8f0; }
:global(:root[data-theme='light']) .canvas-header p { color: #64748b; }
:global(:root[data-theme='light']) .btn-back,
:global(:root[data-theme='light']) .btn-refresh { background: #f1f5f9; color: #0f172a; }
:global(:root[data-theme='light']) .summary-card,
:global(:root[data-theme='light']) .principal-card,
:global(:root[data-theme='light']) .history-strip,
:global(:root[data-theme='light']) .customer-card,
:global(:root[data-theme='light']) .payment-card,
:global(:root[data-theme='light']) .request-card,
:global(:root[data-theme='light']) .product-card,
:global(:root[data-theme='light']) .canvas-footer,
:global(:root[data-theme='light']) .history-modal {
  background: #fff;
  border-color: #e2e8f0;
  color: #0f172a;
}
:global(:root[data-theme='light']) .summary-card .carry-summary,
:global(:root[data-theme='light']) .history-modal header,
:global(:root[data-theme='light']) .detail-total { border-color: #e2e8f0; }
:global(:root[data-theme='light']) .summary-card strong,
:global(:root[data-theme='light']) .principal-card-head strong,
:global(:root[data-theme='light']) .history-strip strong,
:global(:root[data-theme='light']) .request-card strong,
:global(:root[data-theme='light']) .product-main h4,
:global(:root[data-theme='light']) .payment-summary strong,
:global(:root[data-theme='light']) .payment-history p,
:global(:root[data-theme='light']) .payment-order-amounts b,
:global(:root[data-theme='light']) .canvas-footer strong,
:global(:root[data-theme='light']) .history-modal header h4,
:global(:root[data-theme='light']) .history-row,
:global(:root[data-theme='light']) .detail-row {
  color: #0f172a;
}
:global(:root[data-theme='light']) .summary-card span,
:global(:root[data-theme='light']) .summary-card small,
:global(:root[data-theme='light']) .principal-card-head span,
:global(:root[data-theme='light']) .principal-card-head small,
:global(:root[data-theme='light']) .history-strip span,
:global(:root[data-theme='light']) .request-card span,
:global(:root[data-theme='light']) .customer-card label,
:global(:root[data-theme='light']) .payment-card label,
:global(:root[data-theme='light']) .payment-summary span,
:global(:root[data-theme='light']) .payment-history span,
:global(:root[data-theme='light']) .product-main p,
:global(:root[data-theme='light']) .product-footer,
:global(:root[data-theme='light']) .qty-grid label span,
:global(:root[data-theme='light']) .history-row span,
:global(:root[data-theme='light']) .detail-row span,
:global(:root[data-theme='light']) .payment-order-amounts,
:global(:root[data-theme='light']) .canvas-footer span {
  color: #64748b;
}
:global(:root[data-theme='light']) .segmented { background: #fff; border-color: #cbd5e1; }
:global(:root[data-theme='light']) .segmented button { color: #475569; }
:global(:root[data-theme='light']) .segmented button { border-color: #e2e8f0; }
:global(:root[data-theme='light']) .segmented button.active { background: #ecfdf5; color: #0f766e; }
:global(:root[data-theme='light']) .customer-card input,
:global(:root[data-theme='light']) .customer-card select,
:global(:root[data-theme='light']) .payment-card input,
:global(:root[data-theme='light']) .payment-card select,
:global(:root[data-theme='light']) .qty-grid input,
:global(:root[data-theme='light']) .qty-stepper {
  background: #fff;
  border-color: #cbd5e1;
  color: #0f172a;
}
:global(:root[data-theme='light']) .qty-stepper button,
:global(:root[data-theme='light']) .product-footer button,
:global(:root[data-theme='light']) .history-modal header button { background: #f1f5f9; color: #0f766e; }
:global(:root[data-theme='light']) .customer-card input[readonly],
:global(:root[data-theme='light']) .payment-summary,
:global(:root[data-theme='light']) .payment-history,
:global(:root[data-theme='light']) .payment-order-card,
:global(:root[data-theme='light']) .history-row,
:global(:root[data-theme='light']) .detail-row { background: #f8fafc; border-color: #e2e8f0; }
:global(:root[data-theme='light']) .payment-order-card.active,
:global(:root[data-theme='light']) .active-customer-box { background: #f0fdfa; border-color: #99f6e4; }
:global(:root[data-theme='light']) .active-customer-box strong { color: #134e4a; }
:global(:root[data-theme='light']) .active-customer-box span,
:global(:root[data-theme='light']) .active-customer-box small { color: #0f766e; }

:global(:root[data-theme='dark']) .payment-order-amounts,
:global(:root[data-theme='dark']) .product-main p,
:global(:root[data-theme='dark']) .product-footer,
:global(:root[data-theme='dark']) .qty-grid label span,
:global(:root[data-theme='dark']) .summary-card small,
:global(:root[data-theme='dark']) .principal-card-head span,
:global(:root[data-theme='dark']) .principal-card-head small,
:global(:root[data-theme='dark']) .principal-tabs button small { color: #94a3b8; }
:global(:root[data-theme='dark']) .qty-grid label.disabled input,
:global(:root[data-theme='dark']) .qty-grid label.disabled .qty-stepper { background: #1e293b; }

.canvas-page {
  --canvas-bg: var(--app-body-bg);
  --canvas-text: var(--app-body-text);
  --canvas-surface: var(--app-surface);
  --canvas-surface-soft: var(--app-surface-soft);
  --canvas-surface-muted: var(--app-surface-muted);
  --canvas-border: var(--app-border);
  --canvas-muted: var(--app-text-muted);
  --canvas-soft: var(--app-text-soft);
  background: var(--canvas-bg) !important;
  color: var(--canvas-text) !important;
}
.canvas-header,
.summary-card,
.principal-card,
.history-strip,
.canvas-history-panel,
.customer-card,
.canvas-voucher-card,
.payment-card,
.request-card,
.product-card,
.canvas-footer,
.history-modal,
.voucher-info-row {
  background: var(--canvas-surface) !important;
  border-color: var(--canvas-border) !important;
  color: var(--canvas-text) !important;
}
.canvas-header {
  border-bottom: 1px solid var(--canvas-border);
}
.btn-back,
.btn-refresh,
.product-footer button,
.history-modal header button {
  background: var(--canvas-surface-muted) !important;
  color: var(--canvas-text) !important;
}
.summary-card .carry-summary,
.history-modal header,
.detail-total {
  border-color: var(--canvas-border) !important;
}
.summary-card strong,
.principal-card-head strong,
.history-strip strong,
.canvas-history-head strong,
.canvas-history-summary,
.return-history-row strong,
.request-card strong,
.canvas-voucher-head > div > strong,
.canvas-voucher-applied strong,
.voucher-info-title > strong,
.product-main h4,
.payment-summary strong,
.payment-history p,
.payment-order-amounts b,
.canvas-footer strong,
.history-modal header h4,
.history-row,
.detail-row {
  color: var(--canvas-text) !important;
}
.canvas-header p,
.summary-card span,
.summary-card small,
.principal-card-head span,
.principal-card-head small,
.history-strip span,
.canvas-history-summary span,
.canvas-history-summary small,
.return-history-row span,
.request-card span,
.customer-card label,
.canvas-voucher-hint,
.payment-card label,
.payment-summary span,
.payment-history span,
.product-main p,
.product-footer,
.qty-grid label span,
.history-row span,
.detail-row span,
.payment-order-amounts,
.canvas-footer span,
.customer-card small,
.canvas-voucher-applied em,
.voucher-info-title > small,
.voucher-info-row p,
.empty-inline {
  color: var(--canvas-muted) !important;
}
.segmented {
  background: var(--canvas-surface) !important;
  border-color: var(--canvas-border) !important;
}
.principal-tabs button {
  background: var(--canvas-surface-soft) !important;
  border-color: var(--canvas-border) !important;
  color: var(--canvas-text) !important;
}
.principal-tabs button small { color: var(--canvas-muted) !important; }
.principal-tabs button.active {
  background: rgba(20, 184, 166, 0.14) !important;
  border-color: #0f766e !important;
  color: #0f766e !important;
}
:global(:root[data-theme='dark']) .principal-tabs button.active,
:global(html[data-theme='dark'] body[data-theme='dark']) .canvas-page .principal-tabs button.active {
  border-color: #2dd4bf !important;
  color: #2dd4bf !important;
}
.segmented button {
  color: var(--canvas-muted) !important;
  border-color: var(--canvas-border) !important;
}
.segmented button.active {
  background: rgba(20, 184, 166, 0.14) !important;
  color: #0f766e !important;
}
:global(:root[data-theme='dark']) .segmented button.active,
:global(html[data-theme='dark'] body[data-theme='dark']) .canvas-page .segmented button.active {
  color: #2dd4bf !important;
}
.customer-card input,
.customer-card select,
.payment-card input,
.payment-card select,
.canvas-voucher-selects select,
.qty-grid input,
.qty-stepper {
  background: var(--canvas-surface-soft) !important;
  border-color: var(--canvas-border) !important;
  color: var(--canvas-text) !important;
}
.customer-card input[readonly],
.canvas-voucher-selects select:disabled,
.payment-summary,
.payment-history,
.payment-order-card,
.history-row,
.detail-row {
  background: var(--canvas-surface-soft) !important;
  border-color: var(--canvas-border) !important;
}
.qty-stepper button {
  background: var(--canvas-surface-muted) !important;
  color: #0f766e !important;
}
:global(:root[data-theme='dark']) .qty-stepper button,
:global(html[data-theme='dark'] body[data-theme='dark']) .canvas-page .qty-stepper button {
  color: #2dd4bf !important;
}
.payment-order-card.active,
.active-customer-box {
  background: rgba(20, 184, 166, 0.12) !important;
  border-color: rgba(20, 184, 166, 0.35) !important;
}
.active-customer-box strong {
  color: var(--canvas-text) !important;
}
.active-customer-box span,
.active-customer-box small {
  color: #0f766e !important;
}
:global(:root[data-theme='dark']) .active-customer-box span,
:global(:root[data-theme='dark']) .active-customer-box small,
:global(html[data-theme='dark'] body[data-theme='dark']) .canvas-page .active-customer-box span,
:global(html[data-theme='dark'] body[data-theme='dark']) .canvas-page .active-customer-box small {
  color: #2dd4bf !important;
}
.canvas-voucher-head > div > span,
.canvas-voucher-info,
.voucher-info-title > span {
  color: #0f766e !important;
}
:global(:root[data-theme='dark']) .canvas-voucher-head > div > span,
:global(:root[data-theme='dark']) .canvas-voucher-info,
:global(:root[data-theme='dark']) .voucher-info-title > span,
:global(html[data-theme='dark'] body[data-theme='dark']) .canvas-page .canvas-voucher-head > div > span,
:global(html[data-theme='dark'] body[data-theme='dark']) .canvas-page .canvas-voucher-info,
:global(html[data-theme='dark'] body[data-theme='dark']) .canvas-page .voucher-info-title > span {
  color: #2dd4bf !important;
}
.canvas-voucher-refresh {
  background: var(--canvas-surface-muted) !important;
  color: #0f766e !important;
}
:global(:root[data-theme='dark']) .canvas-voucher-refresh,
:global(html[data-theme='dark'] body[data-theme='dark']) .canvas-page .canvas-voucher-refresh {
  color: #2dd4bf !important;
}
.canvas-voucher-applied > div {
  background: rgba(14, 165, 233, 0.08) !important;
  border-color: var(--canvas-border) !important;
}
.canvas-voucher-applied small {
  color: var(--canvas-muted) !important;
}
.canvas-voucher-applied b,
.voucher-info-row em {
  color: #0f766e !important;
}
:global(:root[data-theme='dark']) .canvas-voucher-applied b,
:global(:root[data-theme='dark']) .voucher-info-row em,
:global(html[data-theme='dark'] body[data-theme='dark']) .canvas-page .canvas-voucher-applied b,
:global(html[data-theme='dark'] body[data-theme='dark']) .canvas-page .voucher-info-row em {
  color: #5eead4 !important;
}
.canvas-voucher-error { color: #dc2626 !important; }
.canvas-voucher-hint.warning,
.canvas-voucher-reason,
.voucher-info-row em.unavailable { color: #b45309 !important; }
</style>

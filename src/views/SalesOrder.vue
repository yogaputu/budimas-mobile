<template>
  <div class="page-wrapper">
    <div class="bg-orb orb-1"></div>
    <div class="bg-orb orb-2"></div>

    <div class="so-container">
      <header class="header blue-header">
        <button @click="$router.back()" class="btn-back" aria-label="Kembali" title="Kembali">
          <font-awesome-icon icon="chevron-left" />
        </button>

        <div class="header-title">
          <h3>Sales Order</h3>
          <p>{{ customerData.Nama }}</p>
        </div>

        <button class="header-cart" @click="showCartPreview" aria-label="Lihat keranjang order">
          <div class="cart-icon-wrapper">
            <font-awesome-icon icon="shopping-cart" />
            <span v-if="totalItems > 0" class="cart-badge">{{ totalItems }}</span>
          </div>
        </button>
      </header>

      <div v-if="customerContextMessage" class="offline-banner" role="status">{{ customerContextMessage }}</div>
      <div v-if="isOffline" class="offline-banner">
        <span class="offline-dot"></span>
        MODE OFFLINE AKTIF - order akan masuk antrean lokal
      </div>

      <section class="nav-section">
        <div class="customer-card">
          <div class="customer-mini">
            <div class="customer-avatar">{{ getInitial(customerData.Nama) }}</div>
            <div class="customer-text">
              <strong>{{ customerData.Nama }}</strong>
              <span>{{ customerData.Kode || 'Tanpa kode customer' }}</span>
            </div>
          </div>

          <div class="summary-mini">
            <div class="summary-mini-item">
              <span>Item</span>
              <strong>{{ totalItems }}</strong>
            </div>
            <div class="summary-mini-item">
              <span>Grand Total</span>
              <strong>Rp {{ formatNumber(grandTotalOrder) }}</strong>
            </div>
          </div>
        </div>

        <div class="tabs-container">
          <button
            @click="switchTab('history')"
            :class="['tab-btn', { active: activeTab === 'history' }]"
          >
            Riwayat
          </button>
          <button
            v-for="tab in categoryTabs"
            :key="tab.key"
            @click="switchTab(tab.key)"
            :class="['tab-btn', { active: activeTab === tab.key }]"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="search-box">
          <span class="search-icon"><font-awesome-icon icon="search" /></span>
          <input
            v-model="searchQuery"
            type="text"
            inputmode="search"
            placeholder="Cari kode atau nama barang..."
            class="search-input"
          />
        </div>
      </section>

      <main class="scroll-area" @scroll="handleScroll">
        <div
          v-for="item in pagedItems"
          :key="item.Kode"
          :class="[
            'stock-card',
            {
              'card-active-blue': hasCartSelection(item.Kode),
              'card-forbidden': isForbiddenOrder(item),
              'card-required': isRequiredOrder(item)
            }
          ]"
        >
          <div class="card-accent"></div>

          <div class="card-content">
            <div class="item-info" @click="openItemDetail(item)">
              <div class="top-line">
                <span class="brand-tag blue-text">{{ item.NamaPTAsli || item.NamaBrand || 'PT BUDIMAS' }}</span>
                <span
                  v-if="getCustomerRuleLabel(item)"
                  :class="['rule-chip', isForbiddenOrder(item) ? 'rule-chip-forbidden' : 'rule-chip-required']"
                >
                  {{ getCustomerRuleLabel(item) }}
                </span>
                <span v-if="item.StokReady != null" class="stock-chip">
                  Stok Ready {{ formatNumber(item.StokReady) }} PCS
                </span>
                <span v-if="Number(item.StokAkhir) > 0" class="stock-chip">
                  Stok toko {{ Math.floor(Number(item.StokAkhir) || 0) }}
                </span>
              </div>

              <h4 class="item-name">{{ item.Nama }}</h4>

              <div class="item-meta-wrap">
                <div class="item-meta">
                  <span class="meta-label">Kode</span>
                  <span class="meta-value">{{ item.Kode }}</span>
                </div>
                <div class="item-meta">
                  <span class="meta-label">Harga</span>
                  <span class="meta-value price">Rp {{ formatNumber(item.HargaE) }}</span>
                </div>
              </div>
            </div>

            <div class="item-action">
              <div class="uom-grid">
                <div class="uom-field" :class="{ 'uom-disabled': !isOrderUomEnabled(item, 'uom1') }">
                  <label class="input-label">{{ getOrderUomLabel(item, 1) }}</label>
                  <div class="qty-box qty-box-compact">
                    <button class="qty-btn qty-btn-minus" @click="changeUomQty(item, 'uom1', -1)" :disabled="!isOrderUomEnabled(item, 'uom1')" type="button">-</button>
                    <input
                      :ref="(el) => setQtyInputRef(`${item.Kode}:uom1`, el)"
                      type="number"
                      inputmode="numeric"
                      :value="getCartUomValue(item.Kode, 'uom1') || ''"
                      @input="updateUomQty(item, 'uom1', $event.target.value)"
                      class="qty-input"
                      placeholder="0"
                      min="0"
                      :disabled="!isOrderUomEnabled(item, 'uom1')"
                    />
                    <button class="qty-btn qty-btn-plus" @click="changeUomQty(item, 'uom1', 1)" :disabled="!isOrderUomEnabled(item, 'uom1')" type="button">+</button>
                  </div>
                </div>

                <div class="uom-field" :class="{ 'uom-disabled': !isOrderUomEnabled(item, 'uom2') }">
                  <label class="input-label">{{ getOrderUomLabel(item, 2) }}</label>
                  <div class="qty-box qty-box-compact">
                    <button class="qty-btn qty-btn-minus" @click="changeUomQty(item, 'uom2', -1)" :disabled="!isOrderUomEnabled(item, 'uom2')" type="button">-</button>
                    <input
                      :ref="(el) => setQtyInputRef(`${item.Kode}:uom2`, el)"
                      type="number"
                      inputmode="numeric"
                      :value="getCartUomValue(item.Kode, 'uom2') || ''"
                      @input="updateUomQty(item, 'uom2', $event.target.value)"
                      class="qty-input"
                      placeholder="0"
                      min="0"
                      :disabled="!isOrderUomEnabled(item, 'uom2')"
                    />
                    <button class="qty-btn qty-btn-plus" @click="changeUomQty(item, 'uom2', 1)" :disabled="!isOrderUomEnabled(item, 'uom2')" type="button">+</button>
                  </div>
                </div>

                <div class="uom-field" :class="{ 'uom-disabled': !isOrderUomEnabled(item, 'uom3') }">
                  <label class="input-label">{{ getOrderUomLabel(item, 3) }}</label>
                  <div class="qty-box qty-box-compact">
                    <button class="qty-btn qty-btn-minus" @click="changeUomQty(item, 'uom3', -1)" :disabled="!isOrderUomEnabled(item, 'uom3')" type="button">-</button>
                    <input
                      :ref="(el) => setQtyInputRef(`${item.Kode}:uom3`, el)"
                      type="number"
                      inputmode="numeric"
                      :value="getCartUomValue(item.Kode, 'uom3') || ''"
                      @input="updateUomQty(item, 'uom3', $event.target.value)"
                      class="qty-input"
                      placeholder="0"
                      min="0"
                      :disabled="!isOrderUomEnabled(item, 'uom3')"
                    />
                    <button class="qty-btn qty-btn-plus" @click="changeUomQty(item, 'uom3', 1)" :disabled="!isOrderUomEnabled(item, 'uom3')" type="button">+</button>
                  </div>
                </div>
              </div>

              <div v-if="hasCartSelection(item.Kode)" class="uom-summary">
                {{ getCartUomSummary(item.Kode) }}
              </div>

              <div v-if="hasCartSelection(item.Kode)" class="line-total blue-line-total">
                Rp {{ formatNumber(getLineSubtotal(item.Kode)) }}
              </div>

              <button
                v-if="hasCartSelection(item.Kode)"
                class="btn-detail-mini"
                type="button"
                @click="openItemDetail(item)"
              >
                <font-awesome-icon icon="info-circle" /><span class="sr-only">Detail</span>
              </button>
            </div>
          </div>
        </div>

        <div v-if="filteredItems.length > pageSize" class="page-control-card">
          <button
            class="page-btn"
            type="button"
            :disabled="currentPage <= 1"
            @click="goToProductPage(currentPage - 1)"
          >
            <font-awesome-icon icon="chevron-left" />
          </button>

          <div class="page-info">
            <strong>Halaman {{ currentPage }} / {{ totalProductPages }}</strong>
            <span>{{ pageStartIndex + 1 }}-{{ pageEndIndex }} dari {{ filteredItems.length }} produk</span>
          </div>

          <button
            class="page-btn"
            type="button"
            :disabled="currentPage >= totalProductPages && (!hasMore || isOffline)"
            @click="goToProductPage(currentPage + 1)"
          >
            <font-awesome-icon icon="chevron-right" />
          </button>
        </div>

        <div v-if="loading" class="loading-state">
          <div class="loader-mini-blue"></div>
          <p>Memuat data order...</p>
        </div>

        <div v-if="!hasMore && rawData.length > 0" class="end-list">
          {{ isOffline ? 'Mode offline menampilkan cache yang tersedia' : 'Semua produk sudah ditampilkan' }}
        </div>

        <div v-if="!loading && rawData.length === 0" class="empty-state">
          <div class="empty-illustration">SO</div>
          <p>{{ isOffline ? 'Cache order belum tersedia.' : 'Tidak ada data order.' }}</p>
          <small>Coba ganti tab atau periksa koneksi Anda.</small>
        </div>
      </main>

      <footer class="footer-action">
        <div class="form-stack">
          <div class="form-card">
            <label class="field-label">Tanggal Transaksi</label>
            <input
              v-model="tanggalTransaksi"
              type="date"
              class="date-input"
              :min="minTanggal"
              :max="maxTanggal"
            />
          </div>

          <div class="two-col-info">
            <div class="info-card">
              <span>Sisa Plafon</span>
              <strong>{{ liveCustomerContext ? `Rp ${formatNumber(customerData.SisaPlafon)}` : "Belum dimuat" }}</strong>
            </div>
            <div class="info-card">
              <span>{{ customerData.piutang_scope === 'customer_company' ? 'Sisa Piutang Customer (Perusahaan)' : 'Sisa Piutang' }}</span>
              <strong>{{ liveCustomerContext ? `Rp ${formatNumber(customerData.Piutang)}` : "Belum dimuat" }}</strong>
            </div>
          </div>

          <div class="two-col-info">
            <div class="info-card">
              <span>Jatuh Tempo</span>
              <strong>{{ liveCustomerContext ? formatDisplayDate(jatuhTempo) : "Belum dimuat" }}</strong>
            </div>
            <div class="info-card">
              <span>Tempo Pembayaran</span>
              <strong>{{ liveCustomerContext ? `${termDays} hari` : "Belum dimuat" }}</strong>
            </div>
          </div>

          <div class="form-card">
            <label class="field-label">Keterangan</label>
            <textarea
              v-model="keterangan"
              class="note-input"
              rows="3"
              placeholder="Tulis keterangan order..."
            ></textarea>
          </div>

          <div class="form-card promo-card">
            <div class="promo-head">
              <div>
                <label class="field-label">Promo & Voucher</label>
                <p>{{ promoSummaryText }}</p>
              </div>
              <button class="btn-check-promo" type="button" :disabled="promoPreviewLoading || totalItems === 0 || isOffline" @click="refreshPromoPreview()">
                <font-awesome-icon icon="ticket-alt" />
                <span>{{ promoPreviewLoading ? 'Cek...' : 'Cek' }}</span>
              </button>
            </div>
            <div v-if="promoPreviewError" class="promo-error">{{ promoPreviewError }}</div>
            <div v-if="promoPreviewGroups.length" class="promo-list">
              <div v-for="promo in promoPreviewGroups" :key="promo.key" class="promo-entry">
                <div class="promo-row">
                  <span>{{ promo.name }}</span>
                  <strong>Rp {{ formatNumber(promo.amount) }}</strong>
                </div>
                <p v-if="promo.note" class="rule-note">{{ promo.note }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="summary-detail-card blue-glow">
          <div class="summary-row">
            <span>Subtotal</span>
            <strong>Rp {{ formatNumber(subtotalOrder) }}</strong>
          </div>
          <div v-if="promoDiscountTotal > 0" class="summary-row promo-discount-row">
            <span>Promo/Voucher</span>
            <strong>- Rp {{ formatNumber(promoDiscountTotal) }}</strong>
          </div>
          <div class="summary-row">
            <span>PPN</span>
            <strong>Rp {{ formatNumber(ppnOrder) }}</strong>
          </div>
          <div class="summary-row grand">
            <span>Grand Total</span>
            <strong>Rp {{ formatNumber(grandTotalOrder) }}</strong>
          </div>
        </div>

        <div class="summary-bar glassy">
          <div>
            <span class="label">Estimasi Pesanan</span>
            <strong class="value blue-text">Rp {{ formatNumber(grandTotalOrder) }}</strong>
          </div>

          <div class="summary-right">
            <div class="summary-pill blue-pill">{{ totalItems }} item</div>
            <button
              v-if="totalItems > 0"
              class="mini-cart-btn blue-btn"
              @click="showCartPreview"
              type="button"
            >
              <font-awesome-icon icon="info-circle" /><span class="sr-only">Detail</span>
            </button>
          </div>
        </div>

        <div class="pending-bar" v-if="pendingCount > 0">
          <div class="pending-text">
            <strong>{{ pendingCount }} order pending lokal</strong>
            <span>Akan dikirim saat koneksi tersedia</span>
          </div>
          <button
            class="btn-pending-sync"
            @click="uploadPendingOrders"
            :disabled="isOffline || isUploadingPending"
          >
            {{ isUploadingPending ? 'Mengupload...' : 'Upload Pending' }}
          </button>
        </div>

        <div class="slide-checkout-wrapper" :class="{ 'is-locked': totalItems === 0 || isSubmitting }">
          <div class="slide-track" ref="slideTrackRef">
            <div class="slide-fill blue-fill" :style="{ width: `${currentX + 56}px` }"></div>

            <span class="slide-hint blue-hint">
              {{
                isSubmitting
                  ? 'Memproses...'
                  : isOffline
                    ? 'Geser untuk Simpan Offline'
                    : 'Geser untuk Kirim Pesanan'
              }}
            </span>

            <div
              class="slide-handle blue-handle"
              @touchstart="startSlide"
              @touchmove="moveSlide"
              @touchend="endSlide"
              :style="{ transform: `translateX(${currentX}px)` }"
            >
              <font-awesome-icon icon="angle-double-right" />
            </div>
          </div>
        </div>
      </footer>
    </div>

    <!-- DETAIL ITEM -->
    <div v-if="showItemDetail && selectedItemDetail" class="detail-overlay" @click.self="closeItemDetail">
      <div class="detail-sheet">
        <div class="detail-sheet-head">
          <div>
            <h3>Detail Item Order</h3>
            <p>{{ selectedItemDetail.nama || '-' }}</p>
          </div>
          <button class="btn-close-sheet" aria-label="Tutup" title="Tutup" @click="closeItemDetail" type="button"><font-awesome-icon icon="times" /></button>
        </div>

        <div class="detail-grid">
          <div class="detail-box">
            <span>Kode</span>
            <strong>{{ selectedItemDetail.kode || '-' }}</strong>
          </div>
          <div class="detail-box">
            <span>Harga</span>
            <strong>Rp {{ formatNumber(selectedItemDetail.harga || 0) }}</strong>
          </div>
          <div class="detail-box">
            <span>Saran</span>
            <strong>{{ formatNumber(selectedItemDetail.stok?.Suggestion || 0) }}</strong>
          </div>
          <div class="detail-box">
            <span>Stok Ready Gudang (PCS)</span>
            <strong>{{ selectedItemDetail.stok?.StokReady != null ? formatNumber(selectedItemDetail.stok.StokReady) : "Belum dimuat" }}</strong>
          </div>
          <div class="detail-box">
            <span>Stok toko</span>
            <strong>{{ formatNumber(selectedItemDetail.stok?.StokAkhir || 0) }}</strong>
          </div>
        </div>

        <div class="detail-form">
          <div class="detail-uom-grid">
            <div :class="{ 'uom-disabled': !isOrderUomEnabled(selectedItemDetail, 'uom1') }">
              <label class="field-label">{{ getOrderUomLabel(selectedItemDetail, 1) }}</label>
              <div class="qty-box detail-qty-box">
                <button class="qty-btn qty-btn-minus" @click="changeSelectedUomQty('uom1', -1)" :disabled="!isOrderUomEnabled(selectedItemDetail, 'uom1')" type="button">-</button>
                <input
                  type="number"
                  inputmode="numeric"
                  :value="selectedItemDetail.uom1 || ''"
                  @input="updateSelectedUomQty('uom1', $event.target.value)"
                  min="0"
                  class="qty-input"
                  placeholder="0"
                  :disabled="!isOrderUomEnabled(selectedItemDetail, 'uom1')"
                />
                <button class="qty-btn qty-btn-plus" @click="changeSelectedUomQty('uom1', 1)" :disabled="!isOrderUomEnabled(selectedItemDetail, 'uom1')" type="button">+</button>
              </div>
            </div>

            <div :class="{ 'uom-disabled': !isOrderUomEnabled(selectedItemDetail, 'uom2') }">
              <label class="field-label">{{ getOrderUomLabel(selectedItemDetail, 2) }}</label>
              <div class="qty-box detail-qty-box">
                <button class="qty-btn qty-btn-minus" @click="changeSelectedUomQty('uom2', -1)" :disabled="!isOrderUomEnabled(selectedItemDetail, 'uom2')" type="button">-</button>
                <input
                  type="number"
                  inputmode="numeric"
                  :value="selectedItemDetail.uom2 || ''"
                  @input="updateSelectedUomQty('uom2', $event.target.value)"
                  min="0"
                  class="qty-input"
                  placeholder="0"
                  :disabled="!isOrderUomEnabled(selectedItemDetail, 'uom2')"
                />
                <button class="qty-btn qty-btn-plus" @click="changeSelectedUomQty('uom2', 1)" :disabled="!isOrderUomEnabled(selectedItemDetail, 'uom2')" type="button">+</button>
              </div>
            </div>

            <div :class="{ 'uom-disabled': !isOrderUomEnabled(selectedItemDetail, 'uom3') }">
              <label class="field-label">{{ getOrderUomLabel(selectedItemDetail, 3) }}</label>
              <div class="qty-box detail-qty-box">
                <button class="qty-btn qty-btn-minus" @click="changeSelectedUomQty('uom3', -1)" :disabled="!isOrderUomEnabled(selectedItemDetail, 'uom3')" type="button">-</button>
                <input
                  type="number"
                  inputmode="numeric"
                  :value="selectedItemDetail.uom3 || ''"
                  @input="updateSelectedUomQty('uom3', $event.target.value)"
                  min="0"
                  class="qty-input"
                  placeholder="0"
                  :disabled="!isOrderUomEnabled(selectedItemDetail, 'uom3')"
                />
                <button class="qty-btn qty-btn-plus" @click="changeSelectedUomQty('uom3', 1)" :disabled="!isOrderUomEnabled(selectedItemDetail, 'uom3')" type="button">+</button>
              </div>
            </div>
          </div>

          <div class="uom-summary detail-uom-summary" v-if="selectedItemDetail">
            {{ formatEntryUomSummary(selectedItemDetail) }}
          </div>

          <div class="bonus-box">
            <label class="bonus-toggle">
              <input type="checkbox" v-model="selectedItemDetail.isBonus" />
              <span>Jadikan bonus</span>
            </label>
          </div>

          <div v-if="!selectedItemDetail.isBonus" class="discount-stack">
            <div class="discount-row">
              <label>Disc 1 (%)</label>
              <input type="number" v-model="selectedItemDetail.disc1" min="0" max="100" class="disc-input" />
            </div>
            <div class="discount-row">
              <label>Disc 2 (%)</label>
              <input type="number" v-model="selectedItemDetail.disc2" min="0" max="100" class="disc-input" />
            </div>
            <div class="discount-row">
              <label>Disc 3 (%)</label>
              <input type="number" v-model="selectedItemDetail.disc3" min="0" max="100" class="disc-input" />
            </div>
          </div>

          <div class="detail-subtotal blue-detail-subtotal">
            <span>Subtotal Item</span>
            <strong>Rp {{ formatNumber(computeSelectedTotal()) }}</strong>
          </div>
        </div>

        <div class="detail-actions">
          <button class="btn-delete-item" @click="removeSelectedItem" type="button"><font-awesome-icon icon="trash-alt" /><span class="sr-only">Hapus Item</span></button>
          <button class="btn-save-item blue-save" @click="saveSelectedItemDetail" type="button"><font-awesome-icon icon="floppy-disk" /><span class="sr-only">Simpan</span></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api/axios';
import Swal from 'sweetalert2';
import { v4 as uuidv4 } from 'uuid';
import { useConnectivityStore } from '@/stores/connectivity';
import { getDb } from '@/services/database';
import { SyncService } from '@/services/SyncService';
import { getPayloadArray } from '@/services/visitService';
import {
  addDaysToDateInput,
  dateInputToLocalDateTime,
  parseLocalDateInput,
  toLocalDateInputValue
} from '@/utils/dateLocal';

const route = useRoute();
const router = useRouter();
const connectivity = useConnectivityStore();

const loading = ref(false);
const isSubmitting = ref(false);
const isUploadingPending = ref(false);
const activeTab = ref('history');
const categoryTabs = ref([]);
const rawData = ref([]);
const searchQuery = ref('');
const cart = ref({});
const currentX = ref(0);
const maxSlide = ref(0);
const offset = ref(0);
const limit = 50;
const pageSize = 10;
const currentPage = ref(1);
const hasMore = ref(true);
const pendingCount = ref(0);
const slideTrackRef = ref(null);
const isAutoUploading = ref(false);
const qtyInputRefs = ref({});
let searchDebounceTimer = null;

const tanggalTransaksi = ref(toLocalDateInputValue());
const keterangan = ref('');
const showItemDetail = ref(false);
const selectedItemDetail = ref(null);
const promoPreview = ref({
  total_estimated_benefit: 0,
  total_estimated_cashback: 0,
  total_estimated_discount: 0,
  qualified_count: 0,
  groups: []
});
const promoPreviewLoading = ref(false);
const promoPreviewError = ref('');
const isOffline = computed(() => !connectivity.isOnline);

const today = new Date();
const minDateObj = new Date();
minDateObj.setDate(today.getDate() - 7);
const maxDateObj = new Date();
maxDateObj.setDate(today.getDate() + 30);

const minTanggal = toLocalDateInputValue(minDateObj);
const maxTanggal = toLocalDateInputValue(maxDateObj);

const liveCustomerContext = ref(null);
const customerContextMessage = ref('');
const customerData = computed(() => ({
  Kode: route.query.kode_customer || '',
  Nama: route.query.nama_toko || 'Pelanggan',
  id_customer: Number(route.query.id_customer || route.query.customer_id || 0),
  id_plafon: route.query.id_plafon || '',
  id_cabang: Number(route.query.id_cabang || 0),
  id_perusahaan: Number(route.query.id_perusahaan || 0),
  SisaPlafon: Number(route.query.sisa_plafon || 0),
  Piutang: Number(route.query.piutang || 0),
  TermOfPayment: Number(route.query.term_of_payment || 14),
  PlafonTerm: Number(route.query.plafon_term || 0),
  Plafon: Number(route.query.plafon || 0),
  ...(liveCustomerContext.value || {})
}));

const termDays = computed(() => Number(customerData.value.PlafonTerm ?? 0));

const refreshCustomerContext = async () => {
  const cacheKey = `order-context:${customerData.value.id_plafon}:${customerData.value.Kode}`;
  if (isOffline.value) {
    try { liveCustomerContext.value = JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch { /* No usable cache. */ }
    customerContextMessage.value = liveCustomerContext.value
      ? 'Offline: informasi plafon memakai data terakhir yang tersimpan.'
      : 'Offline: informasi plafon belum tersimpan. Hubungkan internet untuk memuat master terbaru.';
    return;
  }
  try {
    const response = await api.get('/api/customer/order-context', { params: {
      id_plafon: route.query.id_plafon || undefined,
      kode_customer: route.query.kode_customer || undefined,
      id_kunjungan: route.query.id_kunjungan || undefined
    }});
    liveCustomerContext.value = response.data;
    customerContextMessage.value = '';
    try { localStorage.setItem(cacheKey, JSON.stringify(response.data)); } catch { /* Cache is optional. */ }
  } catch (error) {
    liveCustomerContext.value = null;
    customerContextMessage.value = error.response?.data?.message || 'Informasi plafon terbaru belum dapat dimuat.';
  }
};

const jatuhTempo = computed(() => {
  if (!tanggalTransaksi.value) return '';
  return addDaysToDateInput(tanggalTransaksi.value, termDays.value);
});

const visitId = computed(() => route.query.id_kunjungan || '');
const cachePrefix = computed(() => (
  `salesorder:${customerData.value.Kode}:${customerData.value.id_plafon || 'no_plafon'}:${visitId.value || 'no_visit'}`
));
const cartDraftKey = computed(() => `${cachePrefix.value}:cart`);
const itemCacheKey = computed(() => `${cachePrefix.value}:items:${activeTab.value}`);
const metaDraftKey = computed(() => `${cachePrefix.value}:meta`);
const activeCategoryValue = computed(() => {
  if (!String(activeTab.value || '').startsWith('category:')) return '';
  return String(activeTab.value).replace('category:', '').trim();
});
const activePrincipalValue = computed(() => {
  if (!String(activeTab.value || '').startsWith('principal:')) return '';
  return String(activeTab.value).replace('principal:', '').trim();
});

const productScopeParams = computed(() => ({
  kode_customer: customerData.value.Kode,
  id_customer: customerData.value.id_customer || route.query.id_customer || '',
  id_plafon: customerData.value.id_plafon || '',
  id_kunjungan: visitId.value || ''
}));

const hasText = (value) => String(value ?? '').trim() !== '';

const pickText = (...values) => {
  const value = values.find((entry) => entry !== undefined && entry !== null && String(entry).trim() !== '');
  return value === undefined ? '' : String(value).trim();
};

const pickNumber = (...values) => {
  const value = values.find((entry) => entry !== undefined && entry !== null && String(entry).trim() !== '');
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const pickOptionalNumber = (...values) => {
  const value = values.find((entry) => entry !== undefined && entry !== null && String(entry).trim() !== '');
  if (value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const getOrderUomField = (fieldOrLevel) => {
  if (fieldOrLevel === 'uom1' || Number(fieldOrLevel) === 1) return 'uom1';
  if (fieldOrLevel === 'uom2' || Number(fieldOrLevel) === 2) return 'uom2';
  if (fieldOrLevel === 'uom3' || Number(fieldOrLevel) === 3) return 'uom3';
  return '';
};

const getOrderUomLevel = (fieldOrLevel) => {
  const field = getOrderUomField(fieldOrLevel);
  if (field === 'uom1') return 1;
  if (field === 'uom2') return 2;
  if (field === 'uom3') return 3;
  return 0;
};

const getOrderUomName = (item, level) => {
  if (!item) return '';
  if (level === 1) {
    return pickText(item.uom1Label, item.Uom1Label, item.Satuan, item.puom1_nama, item.puom1_kode, item.uom_1, item.uom1_name);
  }
  if (level === 2) {
    return pickText(item.uom2Label, item.Uom2Label, item.NamaUnit, item.puom2_nama, item.puom2_kode, item.uom_2, item.uom2_name);
  }
  if (level === 3) {
    return pickText(item.uom3Label, item.Uom3Label, item.puom3_nama, item.puom3_kode, item.uom_3, item.uom3_name);
  }
  return '';
};

const getOrderUomConversion = (item, level) => {
  if (level === 1) return 1;
  if (level === 2) return pickNumber(item?.konversi2, item?.Konversi2, item?.konversi_2, item?.konversi_level2, item?.stok?.Konversi2, item?.stok?.konversi_2, item?.stok?.konversi_level2);
  if (level === 3) return pickNumber(item?.konversi3, item?.Konversi3, item?.konversi_3, item?.konversi_level3, item?.stok?.Konversi3, item?.stok?.konversi_3, item?.stok?.konversi_level3);
  return 0;
};

const hasExplicitUomFlag = (item, field) => (
  Object.prototype.hasOwnProperty.call(item || {}, `has${field.charAt(0).toUpperCase()}${field.slice(1)}`) ||
  Object.prototype.hasOwnProperty.call(item || {}, `Has${field.charAt(0).toUpperCase()}${field.slice(1)}`)
);

const getRuleType = (item) => String(
  item?.RuleType ||
  item?.rule_type ||
  item?.CustomerProductRule?.rule_type ||
  item?.stok?.RuleType ||
  item?.stok?.rule_type ||
  item?.stok?.CustomerProductRule?.rule_type ||
  ''
).trim().toLowerCase();

const isForbiddenOrder = (item) => (
  Boolean(item?.IsForbiddenOrder || item?.is_forbidden_order || item?.stok?.IsForbiddenOrder || item?.stok?.is_forbidden_order) ||
  getRuleType(item) === 'forbidden'
);

const isRequiredOrder = (item) => (
  !isForbiddenOrder(item) &&
  (
    Boolean(item?.IsRequiredOrder || item?.is_required_order || item?.stok?.IsRequiredOrder || item?.stok?.is_required_order) ||
    getRuleType(item) === 'required'
  )
);

const getCustomerRuleLabel = (item) => {
  if (isForbiddenOrder(item)) return 'Tidak boleh order';
  if (isRequiredOrder(item)) return 'Wajib order';
  return '';
};

const isOrderUomEnabled = (item, fieldOrLevel) => {
  if (!item) return false;
  if (isForbiddenOrder(item)) return false;
  const field = getOrderUomField(fieldOrLevel);
  const level = getOrderUomLevel(fieldOrLevel);
  if (!field || !level) return false;

  const camelFlag = `has${field.charAt(0).toUpperCase()}${field.slice(1)}`;
  const pascalFlag = `Has${field.charAt(0).toUpperCase()}${field.slice(1)}`;
  if (hasExplicitUomFlag(item, field)) {
    return Boolean(item[camelFlag] ?? item[pascalFlag]);
  }

  const stok = item.stok || {};
  if (hasExplicitUomFlag(stok, field)) {
    return Boolean(stok[camelFlag] ?? stok[pascalFlag]);
  }

  const name = getOrderUomName(item, level) || getOrderUomName(stok, level);
  if (!hasText(name)) return false;
  return level === 1 || getOrderUomConversion(item, level) > 0;
};

const getOrderUomLabel = (item, level) => {
  const name = getOrderUomName(item, level) || getOrderUomName(item?.stok, level);
  if (!isOrderUomEnabled(item, level)) return `UOM ${level} belum diset`;
  if (level === 1) return name;
  return `${name} x ${formatNumber(getOrderUomConversion(item, level))}`;
};

const buildOrderUomFlags = (item = {}) => {
  const uom1Name = pickText(item.Uom1Label, item.Satuan, item.puom1_nama, item.puom1_kode, item.uom_1, item.uom1_name);
  const uom2Name = pickText(item.Uom2Label, item.NamaUnit, item.puom2_nama, item.puom2_kode, item.uom_2, item.uom2_name);
  const uom3Name = pickText(item.Uom3Label, item.puom3_nama, item.puom3_kode, item.uom_3, item.uom3_name);
  const konversi2 = pickNumber(item.Konversi2, item.konversi_2, item.konversi2, item.konversi_level2);
  const konversi3 = pickNumber(item.Konversi3, item.konversi_3, item.konversi3, item.konversi_level3);

  return {
    hasUom1: hasText(uom1Name),
    hasUom2: hasText(uom2Name) && konversi2 > 0,
    hasUom3: hasText(uom3Name) && konversi3 > 0,
    Uom1Label: uom1Name || 'UOM 1',
    Uom2Label: uom2Name || 'UOM 2',
    Uom3Label: uom3Name || 'UOM 3',
    Konversi2: konversi2,
    Konversi3: konversi3
  };
};

const computeTotalPiecesFromEntry = (entry) => {
  const uom1 = isOrderUomEnabled(entry, 'uom1') ? Number(entry?.uom1 || 0) : 0;
  const uom2 = isOrderUomEnabled(entry, 'uom2') ? Number(entry?.uom2 || 0) : 0;
  const uom3 = isOrderUomEnabled(entry, 'uom3') ? Number(entry?.uom3 || 0) : 0;
  const konversi2 = Number(entry?.konversi2 || 0);
  const konversi3 = Number(entry?.konversi3 || 0);
  return uom1 + (uom2 * konversi2) + (uom3 * konversi3);
};

const hasEntrySelection = (entry) => (
  (isOrderUomEnabled(entry, 'uom1') && Number(entry?.uom1 || 0) > 0) ||
  (isOrderUomEnabled(entry, 'uom2') && Number(entry?.uom2 || 0) > 0) ||
  (isOrderUomEnabled(entry, 'uom3') && Number(entry?.uom3 || 0) > 0)
);

const formatEntryUomSummary = (entry) => {
  if (!entry) return '-';
  const parts = [];
  if (isOrderUomEnabled(entry, 'uom1') && Number(entry.uom1 || 0) > 0) parts.push(`${formatNumber(entry.uom1)} ${entry.uom1Label || 'PCS'}`);
  if (isOrderUomEnabled(entry, 'uom2') && Number(entry.uom2 || 0) > 0) parts.push(`${formatNumber(entry.uom2)} ${entry.uom2Label || 'BOX'}`);
  if (isOrderUomEnabled(entry, 'uom3') && Number(entry.uom3 || 0) > 0) parts.push(`${formatNumber(entry.uom3)} ${entry.uom3Label || 'KARTON'}`);
  return parts.length > 0 ? parts.join(' | ') : '-';
};

const getStockAvailability = (entry) => {
  // StokAkhir is the shop's opname/history, not warehouse inventory.  Only
  // raise an order-stock warning using the warehouse report transaction
  // balance for the selected branch.
  const rawValue = (
    entry?.stok?.StokReady ??
    entry?.stok?.stok_ready ??
    entry?.stok?.StokWmsReady ??
    entry?.stok?.stok_wms_ready ??
    entry?.stok?.wms_ready_quantity ??
    null
  );
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }
  const value = Number(
    rawValue
  );
  return Number.isFinite(value) ? Math.max(value, 0) : null;
};

const getEntryStockWarning = (entry) => {
  if (!entry || !hasEntrySelection(entry)) return null;

  const ordered = computeTotalPiecesFromEntry(entry);
  const available = getStockAvailability(entry);

  if (available === null || ordered <= available) return null;

  return {
    kode: String(entry.kode || entry.stok?.Kode || '').trim(),
    nama: String(entry.nama || entry.stok?.Nama || 'Produk').trim(),
    ordered,
    available,
    shortage: ordered - available,
    uom: formatEntryUomSummary(entry)
  };
};

const getStockWarnings = () => (
  Object.values(cart.value)
    .map((entry) => getEntryStockWarning(entry))
    .filter(Boolean)
);

const totalItems = computed(() =>
  Object.values(cart.value).filter((i) => hasEntrySelection(i)).length
);

const computeLineTotalFromEntry = (entry) => {
  const qty = computeTotalPiecesFromEntry(entry);
  const harga = Number(entry?.harga || 0);
  let subtotal = qty * harga;

  if (Number(entry?.isBonus || 0)) return 0;

  const d1 = Math.min(Math.max(Number(entry?.disc1 || 0), 0), 100);
  const d2 = Math.min(Math.max(Number(entry?.disc2 || 0), 0), 100);
  const d3 = Math.min(Math.max(Number(entry?.disc3 || 0), 0), 100);

  subtotal -= subtotal * (d1 / 100);
  subtotal -= subtotal * (d2 / 100);
  subtotal -= subtotal * (d3 / 100);

  return subtotal < 0 ? 0 : subtotal;
};

const getEntryPpnRate = (entry) => {
  const rawRate = pickOptionalNumber(
    entry?.ppnRate,
    entry?.ppn_rate,
    entry?.ppn,
    entry?.PPN,
    entry?.Ppn,
    entry?.persentase_ppn,
    entry?.tax_rate,
    entry?.stok?.ppnRate,
    entry?.stok?.ppn_rate,
    entry?.stok?.ppn,
    entry?.stok?.PPN,
    entry?.stok?.Ppn,
    entry?.stok?.persentase_ppn,
    entry?.stok?.tax_rate
  );
  return rawRate === null ? 0 : Math.min(Math.max(rawRate, 0), 100);
};

const hasEntryPpnRate = (entry) => pickOptionalNumber(
  entry?.ppnRate,
  entry?.ppn_rate,
  entry?.ppn,
  entry?.PPN,
  entry?.Ppn,
  entry?.persentase_ppn,
  entry?.tax_rate,
  entry?.stok?.ppnRate,
  entry?.stok?.ppn_rate,
  entry?.stok?.ppn,
  entry?.stok?.PPN,
  entry?.stok?.Ppn,
  entry?.stok?.persentase_ppn,
  entry?.stok?.tax_rate
) !== null;

const getLineSubtotal = (kode) => {
  const cleanKode = String(kode || '').trim();
  return computeLineTotalFromEntry(cart.value[cleanKode]);
};

const activeCartItems = computed(() => Object.values(cart.value).filter((item) => hasEntrySelection(item)));

const getEntryProductId = (entry) => Number(
  entry?.stok?.id_produk ||
  entry?.stok?.IdProduk ||
  entry?.stok?.IDProduk ||
  entry?.stok?.produk_id ||
  entry?.stok?.id ||
  entry?.id_produk ||
  entry?.IdProduk ||
  0
);

const getOrderRuleViolations = async () => {
  const forbiddenItems = activeCartItems.value.filter((item) => isForbiddenOrder(item));
  const submittedIds = new Set(activeCartItems.value.map((item) => getEntryProductId(item)).filter(Boolean));
  const submittedCodes = new Set(activeCartItems.value.map((item) => String(item.kode || item.stok?.Kode || '').trim()).filter(Boolean));

  let rules = [];
  if (!isOffline.value) {
    try {
      const response = await api.get('/api/stok/customer-product-rules', {
        params: {
          ...productScopeParams.value,
          id_plafon: customerData.value.id_plafon || ''
        }
      });
      rules = Array.isArray(response.data?.rules) ? response.data.rules : [];
    } catch (err) {
      rules = [];
    }
  }

  const requiredRules = rules.length
    ? rules.filter((rule) => String(rule.rule_type || '').toLowerCase() === 'required')
    : rawData.value.filter((item) => isRequiredOrder(item)).map((item) => ({
        id_produk: item.id_produk || item.IdProduk || item.id,
        kode_sku: item.Kode,
        nama_produk: item.Nama
      }));

  const requiredMissing = requiredRules.filter((rule) => {
    const productId = Number(rule.id_produk || 0);
    const code = String(rule.kode_sku || rule.Kode || '').trim();
    return !(productId && submittedIds.has(productId)) && !(code && submittedCodes.has(code));
  });

  return { forbiddenItems, requiredMissing };
};

const subtotalOrder = computed(() => {
  return activeCartItems.value.reduce((acc, item) => acc + computeLineTotalFromEntry(item), 0);
});

const isPromoQualified = (value) => (
  value === true || value === 1 || String(value).toLowerCase() === 'true'
);

const getEligiblePromoGroups = (preview) => {
  const groups = Array.isArray(preview?.groups) ? preview.groups : [];
  return groups.map((item, index) => ({
    key: `${item.program_id || item.id_promo || 'promo'}-${item.rule_id || index}`,
    name: item.nama_promo || item.kode_promo || item.program_name || item.promo_name || `Promo ${index + 1}`,
    amount: Number(item.estimated_benefit || item.estimated_cashback || item.estimated_discount || item.discount_amount || item.total_discount || 0),
    note: String(item.rule_notes || item.RuleNotes || item.note || item.notes || item.keterangan || '').trim(),
    qualified: isPromoQualified(item.qualified)
  })).filter((item) => item.qualified && Number(item.amount || 0) > 0);
};

const promoPreviewGroups = computed(() => getEligiblePromoGroups(promoPreview.value));

const promoPreviewNominal = computed(() => Number(
  promoPreview.value?.total_estimated_benefit ||
  promoPreview.value?.total_estimated_cashback ||
  promoPreview.value?.total_estimated_discount ||
  0
));

const promoDiscountTotal = computed(() => Math.min(
  subtotalOrder.value,
  Math.max(0, promoPreviewNominal.value)
));
const taxableSubtotalOrder = computed(() => Math.max(subtotalOrder.value - promoDiscountTotal.value, 0));
const ppnOrder = computed(() => {
  const subtotal = subtotalOrder.value;
  const totalDiscount = promoDiscountTotal.value;

  return activeCartItems.value.reduce((totalTax, item) => {
    const rowSubtotal = computeLineTotalFromEntry(item);
    const discountRatio = subtotal > 0 ? rowSubtotal / subtotal : 0;
    const rowDiscount = totalDiscount * discountRatio;
    const rowTaxableBase = Math.max(rowSubtotal - rowDiscount, 0);
    return totalTax + (rowTaxableBase * getEntryPpnRate(item) / 100);
  }, 0);
});
const grandTotalOrder = computed(() => taxableSubtotalOrder.value + ppnOrder.value);
const promoSummaryText = computed(() => {
  if (isOffline.value) return 'Promo dicek otomatis saat online.';
  if (promoPreviewLoading.value) return 'Memeriksa promo aktif...';
  if (promoPreviewGroups.value.length > 0) return `${promoPreviewGroups.value.length} promo berlaku`;
  if (totalItems.value === 0) return 'Isi barang dulu untuk cek promo.';
  return 'Cek promo/voucher yang berlaku untuk order ini.';
});

const isTanggalValid = computed(() => {
  if (!tanggalTransaksi.value) return false;
  const picked = parseLocalDateInput(tanggalTransaksi.value);
  return picked >= parseLocalDateInput(minTanggal) && picked <= parseLocalDateInput(maxTanggal);
});

// db
const getCacheDb = async (cacheKey) => {
  const db = getDb();
  if (!db) return null;
  try {
    const res = await db.query(`SELECT payload_json FROM app_cache WHERE cache_key = ? LIMIT 1`, [cacheKey]);
    const raw = res.values?.[0]?.payload_json;
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('[ERR] getCacheDb error:', err);
    return null;
  }
};

const saveCacheDb = async (cacheKey, payload) => {
  const db = getDb();
  if (!db) return false;
  try {
    await db.run(
      `INSERT OR REPLACE INTO app_cache (cache_key, payload_json, updated_at) VALUES (?, ?, ?)`,
      [cacheKey, JSON.stringify(payload ?? null), new Date().toISOString()]
    );
    return true;
  } catch (err) {
    console.error('[ERR] saveCacheDb error:', err);
    return false;
  }
};

const getDraftDb = async (draftKey) => {
  const db = getDb();
  if (!db) return null;
  try {
    const res = await db.query(`SELECT payload_json FROM app_drafts WHERE draft_key = ? LIMIT 1`, [draftKey]);
    const raw = res.values?.[0]?.payload_json;
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('[ERR] getDraftDb error:', err);
    return null;
  }
};

const saveDraftDb = async (draftKey, payload) => {
  const db = getDb();
  if (!db) return false;
  try {
    await db.run(
      `INSERT OR REPLACE INTO app_drafts (draft_key, payload_json, updated_at) VALUES (?, ?, ?)`,
      [draftKey, JSON.stringify(payload ?? null), new Date().toISOString()]
    );
    return true;
  } catch (err) {
    console.error('[ERR] saveDraftDb error:', err);
    return false;
  }
};

const refreshPendingCount = async () => {
  const db = getDb();
  if (!db) {
    pendingCount.value = 0;
    return;
  }

  try {
    const res = await db.query(`
      SELECT COUNT(*) as total
      FROM sales_order_offline
      WHERE status_sync = 'pending'
    `);
    pendingCount.value = Number(res.values?.[0]?.total || 0);
  } catch (err) {
    console.error('[ERR] refreshPendingCount error:', err);
    pendingCount.value = 0;
  }
};

// drafts
const persistCartDraft = async () => {
  await saveDraftDb(cartDraftKey.value, cart.value);
};

const restoreCartDraft = async () => {
  const draft = (await getDraftDb(cartDraftKey.value)) || {};
  const migrated = {};
  Object.entries(draft).forEach(([key, value]) => {
    migrated[key] = {
      ...value,
      uom1: Number(value?.uom1 ?? value?.qty ?? 0),
      uom2: Number(value?.uom2 ?? 0),
      uom3: Number(value?.uom3 ?? 0),
      uom1Label: String(value?.uom1Label || value?.stok?.Uom1Label || value?.stok?.Satuan || 'UOM 1').trim(),
      uom2Label: String(value?.uom2Label || value?.stok?.Uom2Label || value?.stok?.NamaUnit || 'UOM 2').trim(),
      uom3Label: String(value?.uom3Label || value?.stok?.Uom3Label || 'UOM 3').trim(),
      konversi2: Number(value?.konversi2 ?? value?.stok?.Konversi2 ?? 0),
      konversi3: Number(value?.konversi3 ?? value?.stok?.Konversi3 ?? 0),
      hasUom1: Boolean(value?.hasUom1 ?? value?.stok?.hasUom1 ?? value?.stok?.HasUom1 ?? hasText(value?.uom1Label || value?.stok?.Uom1Label || value?.stok?.Satuan)),
      hasUom2: Boolean(value?.hasUom2 ?? value?.stok?.hasUom2 ?? value?.stok?.HasUom2 ?? (hasText(value?.uom2Label || value?.stok?.Uom2Label || value?.stok?.NamaUnit) && Number(value?.konversi2 ?? value?.stok?.Konversi2 ?? 0) > 0)),
      hasUom3: Boolean(value?.hasUom3 ?? value?.stok?.hasUom3 ?? value?.stok?.HasUom3 ?? (hasText(value?.uom3Label || value?.stok?.Uom3Label) && Number(value?.konversi3 ?? value?.stok?.Konversi3 ?? 0) > 0)),
      ppnRate: pickOptionalNumber(value?.ppnRate, value?.ppn_rate, value?.ppn, value?.stok?.ppnRate, value?.stok?.ppn_rate, value?.stok?.ppn)
    };
    delete migrated[key].qty;
    delete migrated[key].unit;
  });
  cart.value = migrated;
};

const persistMetaDraft = async () => {
  await saveDraftDb(metaDraftKey.value, {
    tanggalTransaksi: tanggalTransaksi.value,
    keterangan: keterangan.value
  });
};

const restoreMetaDraft = async () => {
  const meta = await getDraftDb(metaDraftKey.value);
  if (meta?.tanggalTransaksi) tanggalTransaksi.value = meta.tanggalTransaksi;
  if (typeof meta?.keterangan === 'string') keterangan.value = meta.keterangan;
};

// cart
const createCartEntry = (itemOrKode = {}) => {
  const kode = typeof itemOrKode === 'string'
    ? String(itemOrKode || '').trim()
    : String(itemOrKode.Kode || '').trim();
  const flags = typeof itemOrKode === 'string' ? null : buildOrderUomFlags(itemOrKode);

  return {
    kode,
    nama: typeof itemOrKode === 'string' ? '' : String(itemOrKode.Nama || '').trim(),
    uom1: 0,
    uom2: 0,
    uom3: 0,
    uom1Label: typeof itemOrKode === 'string' ? 'UOM 1' : flags.Uom1Label,
    uom2Label: typeof itemOrKode === 'string' ? 'UOM 2' : flags.Uom2Label,
    uom3Label: typeof itemOrKode === 'string' ? 'UOM 3' : flags.Uom3Label,
    konversi2: typeof itemOrKode === 'string' ? 0 : flags.Konversi2,
    konversi3: typeof itemOrKode === 'string' ? 0 : flags.Konversi3,
    hasUom1: typeof itemOrKode === 'string' ? false : flags.hasUom1,
    hasUom2: typeof itemOrKode === 'string' ? false : flags.hasUom2,
    hasUom3: typeof itemOrKode === 'string' ? false : flags.hasUom3,
    harga: typeof itemOrKode === 'string' ? 0 : Number(itemOrKode.HargaE || 0),
    ppnRate: typeof itemOrKode === 'string' ? null : pickOptionalNumber(itemOrKode.ppnRate, itemOrKode.ppn_rate, itemOrKode.ppn, itemOrKode.PPN),
    stok: typeof itemOrKode === 'string' ? null : itemOrKode,
    isBonus: false,
    disc1: 0,
    disc2: 0,
    disc3: 0
  };
};

const ensureCartEntry = (item) => {
  const cleanKode = String(item.Kode || '').trim();
  if (!cart.value[cleanKode]) {
    cart.value[cleanKode] = createCartEntry(item);
  }
  return cart.value[cleanKode];
};

const getCartQty = (kode) => {
  const cleanKode = String(kode || '').trim();
  return computeTotalPiecesFromEntry(cart.value[cleanKode]);
};

const getCartUomValue = (kode, field) => {
  const cleanKode = String(kode || '').trim();
  return Number(cart.value[cleanKode]?.[field] || 0);
};

const hasCartSelection = (kode) => {
  const cleanKode = String(kode || '').trim();
  return hasEntrySelection(cart.value[cleanKode]);
};

const getCartUomSummary = (kode) => {
  const cleanKode = String(kode || '').trim();
  return formatEntryUomSummary(cart.value[cleanKode]);
};

const hydrateCartEntry = (item) => {
  const cleanKode = String(item.Kode || '').trim();
  const flags = buildOrderUomFlags(item);

  if (!cart.value[cleanKode]) {
    cart.value[cleanKode] = createCartEntry(item);
  } else {
    cart.value[cleanKode] = {
      ...cart.value[cleanKode],
      kode: cleanKode,
      nama: cart.value[cleanKode].nama || String(item.Nama || '').trim(),
      uom1Label: flags.Uom1Label,
      uom2Label: flags.Uom2Label,
      uom3Label: flags.Uom3Label,
      konversi2: Number(flags.Konversi2 || 0),
      konversi3: Number(flags.Konversi3 || 0),
      hasUom1: flags.hasUom1,
      hasUom2: flags.hasUom2,
      hasUom3: flags.hasUom3,
      harga: Number(cart.value[cleanKode].harga || item.HargaE || 0),
      ppnRate: pickOptionalNumber(cart.value[cleanKode].ppnRate, item.ppnRate, item.ppn_rate, item.ppn, item.PPN),
      stok: item
    };
  }
};

const clearCartAfterSubmit = async () => {
  const nextCart = { ...cart.value };
  Object.keys(nextCart).forEach((key) => {
    nextCart[key] = {
      ...nextCart[key],
      uom1: 0,
      uom2: 0,
      uom3: 0,
      isBonus: false,
      disc1: 0,
      disc2: 0,
      disc3: 0
    };
  });

  cart.value = nextCart;
  tanggalTransaksi.value = toLocalDateInputValue();
  keterangan.value = '';
  promoPreview.value = {
    total_estimated_benefit: 0,
    total_estimated_cashback: 0,
    total_estimated_discount: 0,
    qualified_count: 0,
    groups: []
  };
  promoPreviewError.value = '';
  await persistCartDraft();
  await persistMetaDraft();
};

const normalizeItems = (rows) => {
  return (Array.isArray(rows) ? rows : []).map((item) => {
    const flags = buildOrderUomFlags(item);
    return {
      ...item,
      Kode: String(item.Kode || '').trim(),
      Nama: String(item.Nama || '').trim(),
      Satuan: flags.Uom1Label,
      NamaUnit: flags.hasUom2 ? flags.Uom2Label : '',
      Uom1Label: flags.Uom1Label,
      Uom2Label: flags.Uom2Label,
      Uom3Label: flags.Uom3Label,
      Konversi2: flags.Konversi2,
      Konversi3: flags.Konversi3,
      hasUom1: flags.hasUom1,
      hasUom2: flags.hasUom2,
      hasUom3: flags.hasUom3,
      NamaBrand: String(item.NamaBrand || '').trim(),
      NamaPTAsli: String(item.NamaPTAsli || '').trim(),
      KategoriCustomer: String(item.KategoriCustomer || item.kategori_customer || '').trim(),
      KategoriIzin: String(item.KategoriIzin || item.kategori_izin || '').trim(),
      KategoriCustomerToko: String(item.KategoriCustomerToko || item.kategori_customer_toko || '').trim(),
      TipeCustomer: String(item.TipeCustomer || item.tipe_customer || '').trim(),
      HargaE: Number(item.HargaE || 0),
      ppn: pickOptionalNumber(item.ppn, item.ppn_rate, item.ppnRate, item.PPN),
      ppn_rate: pickOptionalNumber(item.ppn_rate, item.ppn, item.ppnRate, item.PPN),
      Suggestion: Number(item.Suggestion || 0),
      StokAkhir: Number(item.StokAkhir || 0)
    };
  });
};

const normalizeCategoryTabs = (rows) => {
  return (Array.isArray(rows) ? rows : [])
    .map((tab) => ({
      key: String(tab.key || `principal:${tab.value || tab.id_principal || tab.id || tab.kode || tab.label || ''}`).trim(),
      value: String(tab.value || tab.id_principal || tab.id || tab.kode || '').trim(),
      label: String(tab.label || tab.nama || tab.value || tab.kode || '').trim()
    }))
    .filter((tab) => tab.key && tab.value && tab.label);
};

const getPrincipalId = (item) => String(
  item?.id_principal ||
  item?.IdPrincipal ||
  item?.IDPrincipal ||
  item?.principal_id ||
  ''
).trim();

const getPrincipalName = (item) => String(
  item?.NamaPTAsli ||
  item?.nama_principal ||
  item?.NamaPrinciple ||
  item?.NamaBrand ||
  item?.Brand ||
  ''
).trim();

const buildPrincipalTabsFromItems = (rows) => {
  const seen = new Set();
  const tabs = [];

  normalizeItems(rows).forEach((item) => {
    const id = getPrincipalId(item);
    const name = getPrincipalName(item);
    const key = id || name;
    if (!key || seen.has(key)) return;
    seen.add(key);
    tabs.push({
      key: `principal:${id || name}`,
      value: id || name,
      label: name || `Principal ${id}`
    });
  });

  tabs.sort((a, b) => a.label.localeCompare(b.label));
  if (!tabs.length && Array.isArray(rows) && rows.length) {
    return [{ key: 'all', value: 'all', label: 'Produk' }];
  }
  return tabs;
};

const loadPrincipalTabsFromProducts = async () => {
  const res = await api.get('/api/stok/kategori', {
    params: {
      ...productScopeParams.value,
      kategori: '',
      limit: 1000,
      offset: 0
    }
  });

  return buildPrincipalTabsFromItems(getPayloadArray(res.data));
};

const loadCategoryTabs = async () => {
  const cacheKey = `${cachePrefix.value}:category-tabs`;

  if (isOffline.value) {
    categoryTabs.value = normalizeCategoryTabs(await getCacheDb(cacheKey));
    return;
  }

  try {
    const res = await api.get('/api/stok/principal-tabs', {
      params: {
        ...productScopeParams.value
      }
    });

    categoryTabs.value = normalizeCategoryTabs(getPayloadArray(res.data));
    if (!categoryTabs.value.length) {
      categoryTabs.value = await loadPrincipalTabsFromProducts();
    }
    await saveCacheDb(cacheKey, categoryTabs.value);

    if (activeTab.value !== 'history' && !categoryTabs.value.some((tab) => tab.key === activeTab.value)) {
      activeTab.value = 'history';
    }
  } catch (e) {
    console.error('[ERR] Load category tabs error:', e);
    categoryTabs.value = normalizeCategoryTabs(await getCacheDb(cacheKey));
  }
};

// fetch
const fetchData = async (isLoadMore = false) => {
  if (loading.value || (!hasMore.value && isLoadMore)) return;

  loading.value = true;

  try {
    if (isOffline.value) {
      const cached = normalizeItems(await getCacheDb(itemCacheKey.value));
      rawData.value = cached;
      rawData.value.forEach(hydrateCartEntry);
      hasMore.value = false;

      if (cached.length > 0 && !isLoadMore) {
        await Swal.fire({
          icon: 'info',
          title: 'Mode Offline',
          text: 'Menampilkan cache order dari SQLite.',
          timer: 1200,
          showConfirmButton: false
        });
      }
      return;
    }

    const hasServerSearch = String(searchQuery.value || '').trim() !== '';
    const endpoint = !hasServerSearch && activeTab.value === 'history'
      ? '/api/stok/history-order'
      : '/api/stok/kategori';

    const res = await api.get(endpoint, {
      params: {
        ...productScopeParams.value,
        id_plafon: customerData.value.id_plafon || '',
        kategori: hasServerSearch ? '' : activeCategoryValue.value,
        id_principal: activePrincipalValue.value,
        search: String(searchQuery.value || '').trim(),
        limit,
        offset: offset.value
      }
    });

    const newData = normalizeItems(getPayloadArray(res.data));

    if (!isLoadMore) rawData.value = [];
    if (newData.length < limit) hasMore.value = false;

    newData.forEach((item) => {
      hydrateCartEntry(item);
      const exists = rawData.value.find((x) => x.Kode === item.Kode);
      if (!exists) rawData.value.push(item);
    });

    offset.value += limit;
    await saveCacheDb(itemCacheKey.value, rawData.value);
  } catch (e) {
    console.error('[ERR] Fetch sales order error:', e);

    const cached = normalizeItems(await getCacheDb(itemCacheKey.value));
    rawData.value = cached;
    rawData.value.forEach(hydrateCartEntry);
    hasMore.value = false;

    if (rawData.value.length > 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'Koneksi Bermasalah',
        text: 'Menampilkan cache terakhir dari SQLite.',
        timer: 1200,
        showConfirmButton: false
      });
    }
  } finally {
    loading.value = false;
  }
};

const handleScroll = (e) => {
  if (isOffline.value) return;
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  if (currentPage.value >= totalProductPages.value && scrollTop + clientHeight >= scrollHeight - 100) {
    fetchData(true);
  }
};

// detail
const openItemDetail = (item) => {
  const entry = ensureCartEntry(item);
  const flags = buildOrderUomFlags(item);

  entry.nama = String(item.Nama || '').trim();
  entry.uom1Label = flags.Uom1Label;
  entry.uom2Label = flags.Uom2Label;
  entry.uom3Label = flags.Uom3Label;
  entry.konversi2 = Number(flags.Konversi2 || 0);
  entry.konversi3 = Number(flags.Konversi3 || 0);
  entry.hasUom1 = flags.hasUom1;
  entry.hasUom2 = flags.hasUom2;
  entry.hasUom3 = flags.hasUom3;
  entry.harga = Number(item.HargaE || 0);
  entry.stok = item;

  selectedItemDetail.value = JSON.parse(JSON.stringify(entry));
  showItemDetail.value = true;
};

const closeItemDetail = () => {
  showItemDetail.value = false;
  selectedItemDetail.value = null;
};

const updateSelectedUomQty = (field, value) => {
  if (!selectedItemDetail.value) return;
  if (!isOrderUomEnabled(selectedItemDetail.value, field)) {
    selectedItemDetail.value[field] = 0;
    return;
  }
  const parsed = value === '' ? 0 : Math.max(0, Number(value));
  selectedItemDetail.value[field] = Number.isNaN(parsed) ? 0 : parsed;
};

const changeSelectedUomQty = (field, delta) => {
  if (!selectedItemDetail.value) return;
  if (!isOrderUomEnabled(selectedItemDetail.value, field)) {
    selectedItemDetail.value[field] = 0;
    return;
  }
  const current = Number(selectedItemDetail.value[field] || 0);
  selectedItemDetail.value[field] = Math.max(0, current + delta);
};

const computeSelectedTotal = () => {
  return computeLineTotalFromEntry(selectedItemDetail.value);
};

const saveSelectedItemDetail = async () => {
  if (!selectedItemDetail.value) return;
  const kode = String(selectedItemDetail.value.kode || '').trim();

  cart.value[kode] = {
    ...cart.value[kode],
    ...selectedItemDetail.value,
    uom1: isOrderUomEnabled(selectedItemDetail.value, 'uom1') ? Math.max(0, Number(selectedItemDetail.value.uom1 || 0)) : 0,
    uom2: isOrderUomEnabled(selectedItemDetail.value, 'uom2') ? Math.max(0, Number(selectedItemDetail.value.uom2 || 0)) : 0,
    uom3: isOrderUomEnabled(selectedItemDetail.value, 'uom3') ? Math.max(0, Number(selectedItemDetail.value.uom3 || 0)) : 0,
    disc1: Math.min(Math.max(Number(selectedItemDetail.value.disc1 || 0), 0), 100),
    disc2: Math.min(Math.max(Number(selectedItemDetail.value.disc2 || 0), 0), 100),
    disc3: Math.min(Math.max(Number(selectedItemDetail.value.disc3 || 0), 0), 100),
    isBonus: !!selectedItemDetail.value.isBonus
  };

  await persistCartDraft();
  closeItemDetail();
};

const removeSelectedItem = async () => {
  if (!selectedItemDetail.value) return;
  const kode = String(selectedItemDetail.value.kode || '').trim();

  if (cart.value[kode]) {
    cart.value[kode] = {
      ...cart.value[kode],
      uom1: 0,
      uom2: 0,
      uom3: 0,
      isBonus: false,
      disc1: 0,
      disc2: 0,
      disc3: 0
    };
  }

  await persistCartDraft();
  closeItemDetail();
};

// slide
const updateMaxSlide = async () => {
  await nextTick();
  const track = slideTrackRef.value;
  if (track) {
    maxSlide.value = Math.max(track.offsetWidth - 60, 0);
    if (currentX.value > maxSlide.value) currentX.value = maxSlide.value;
  }
};

const startSlide = () => {
  if (totalItems.value > 0 && !isSubmitting.value) currentX.value = 0;
};

const moveSlide = (e) => {
  if (totalItems.value === 0 || isSubmitting.value) return;

  const track = slideTrackRef.value;
  if (!track) return;

  const rect = track.getBoundingClientRect();
  let x = e.touches[0].clientX - rect.left - 28;

  if (x < 0) x = 0;
  if (x > maxSlide.value) x = maxSlide.value;
  currentX.value = x;
};

const endSlide = () => {
  if (currentX.value >= maxSlide.value * 0.9) {
    currentX.value = maxSlide.value;
    submitOrder();
  } else {
    currentX.value = 0;
  }
};

// payload
const unwrapApiPayload = (response) => (
  response?.data?.data ??
  response?.data?.payload ??
  response?.data?.items ??
  response?.data ??
  null
);

const buildPromoPreviewPayload = () => {
  const activeItems = Object.values(cart.value).filter((i) => hasEntrySelection(i));
  const firstStock = activeItems.find((item) => item?.stok)?.stok || {};

  return {
    order_date: tanggalTransaksi.value,
    id_cabang: customerData.value.id_cabang || route.query.id_cabang || firstStock.id_cabang || '',
    id_perusahaan: customerData.value.id_perusahaan || route.query.id_perusahaan || firstStock.id_perusahaan || '',
    id_principal: route.query.id_principal || route.query.id_prinsipal || firstStock.id_principal || firstStock.IdPrincipal || '',
    id_customer: customerData.value.id_customer || route.query.id_customer || firstStock.id_customer || '',
    id_plafon: customerData.value.id_plafon || route.query.id_plafon || '',
    kode_customer: customerData.value.Kode,
    products: activeItems.map((item) => ({
      id_produk: Number(item.stok?.id_produk || item.stok?.IdProduk || item.stok?.id || 0),
      kode_produk: String(item.stok?.Kode || item.kode || '').trim(),
      harga_jual: Number(item.harga || 0),
      pieces_order: isOrderUomEnabled(item, 'uom1') ? Number(item.uom1 || 0) : 0,
      box_order: isOrderUomEnabled(item, 'uom2') ? Number(item.uom2 || 0) : 0,
      karton_order: isOrderUomEnabled(item, 'uom3') ? Number(item.uom3 || 0) : 0,
      konversi_2: isOrderUomEnabled(item, 'uom2') ? Number(item.konversi2 || 0) : 0,
      konversi_3: isOrderUomEnabled(item, 'uom3') ? Number(item.konversi3 || 0) : 0,
      subtotalorder: computeLineTotalFromEntry(item)
    }))
  };
};

const refreshPromoPreview = async ({ silent = false } = {}) => {
  if (isOffline.value || totalItems.value === 0) {
    promoPreview.value = {
      total_estimated_benefit: 0,
      total_estimated_cashback: 0,
      total_estimated_discount: 0,
      qualified_count: 0,
      groups: []
    };
    return;
  }

  promoPreviewLoading.value = true;
  promoPreviewError.value = '';

  try {
    const response = await api.post('/api/promo/unified/preview-sales-order', buildPromoPreviewPayload());
    promoPreview.value = unwrapApiPayload(response) || {
      total_estimated_benefit: 0,
      total_estimated_cashback: 0,
      total_estimated_discount: 0,
      qualified_count: 0,
      groups: []
    };
    if (!silent && promoPreviewGroups.value.length === 0) {
      await Swal.fire({
        icon: 'info',
        title: 'Tidak ada promo',
        text: 'Tidak ada promo yang memenuhi syarat untuk pesanan ini.',
        confirmButtonText: 'Mengerti'
      });
    }
  } catch (error) {
    promoPreview.value = {
      total_estimated_benefit: 0,
      total_estimated_cashback: 0,
      total_estimated_discount: 0,
      qualified_count: 0,
      groups: []
    };
    promoPreviewError.value = error?.response?.data?.message || error?.message || 'Promo/voucher belum bisa dicek.';
    if (!silent) {
      await Swal.fire('Info', promoPreviewError.value, 'info');
    }
  } finally {
    promoPreviewLoading.value = false;
  }
};

const buildOrderPayload = () => {
  const getIdProduk = (stok) => Number(
    stok?.id_produk ||
    stok?.IdProduk ||
    stok?.IDProduk ||
    stok?.produk_id ||
    stok?.ProductID ||
    stok?.id ||
    stok?.ID ||
    0
  );

  const getIdPrincipal = (stok) => Number(
    stok?.id_principal ||
    stok?.IdPrincipal ||
    stok?.IDPrincipal ||
    stok?.principal_id ||
    stok?.KodePrinciple ||
    stok?.kode_principle ||
    route.query.id_principal ||
    route.query.id_prinsipal ||
    0
  );




  const promoApplication = {
    use_unified_promo: promoDiscountTotal.value > 0,
    id_cabang: customerData.value.id_cabang || route.query.id_cabang || '',
    id_perusahaan: customerData.value.id_perusahaan || route.query.id_perusahaan || '',
    id_principal: route.query.id_principal || route.query.id_prinsipal || '',
    id_customer: customerData.value.id_customer || route.query.id_customer || '',
    id_plafon: customerData.value.id_plafon || route.query.id_plafon || '',
    kode_customer: customerData.value.Kode,
    unified_promo_nominal: promoDiscountTotal.value,
    manual_discount_type: null,
    manual_discount_value: 0,
    manual_discount_nominal: 0,
    manual_discount_note: '',
    total_before_discount: subtotalOrder.value,
    total_discount: promoDiscountTotal.value,
    total_after_discount: grandTotalOrder.value
  };

  const items = Object.values(cart.value)
  .filter((i) => hasEntrySelection(i))
  .map((i) => {
    const totalPieces = computeTotalPiecesFromEntry(i);
    const piecesOrder = isOrderUomEnabled(i, 'uom1') ? Number(i.uom1 || 0) : 0;
    const boxOrder = isOrderUomEnabled(i, 'uom2') ? Number(i.uom2 || 0) : 0;
    const kartonOrder = isOrderUomEnabled(i, 'uom3') ? Number(i.uom3 || 0) : 0;
    const rowSubtotal = computeLineTotalFromEntry(i);
    const ppnRate = getEntryPpnRate(i);
    const ppnFields = hasEntryPpnRate(i)
      ? {
          ppn_rate: ppnRate,
          ppn_value: rowSubtotal * ppnRate / 100
        }
      : {
          ppn_value: 0
        };

    return {
      id_produk: getIdProduk(i.stok),
      id_principal: getIdPrincipal(i.stok),
      kode_produk: String(i.stok?.Kode || i.kode || '').trim(),
      total_pieces: totalPieces,
      pieces_order: piecesOrder,
      box_order: boxOrder,
      karton_order: kartonOrder,
      unit: boxOrder,
      satuan: piecesOrder,
      unit_order: boxOrder,
      satuan_order: piecesOrder,
      konversi_2: isOrderUomEnabled(i, 'uom2') ? Number(i.konversi2 || 0) : 0,
      konversi_3: isOrderUomEnabled(i, 'uom3') ? Number(i.konversi3 || 0) : 0,
      uom1_label: String(i.uom1Label || 'UOM 1'),
      uom2_label: String(i.uom2Label || 'UOM 2'),
      uom3_label: String(i.uom3Label || 'UOM 3'),
      has_uom1: isOrderUomEnabled(i, 'uom1'),
      has_uom2: isOrderUomEnabled(i, 'uom2'),
      has_uom3: isOrderUomEnabled(i, 'uom3'),
      harga: Number(i.harga || 0),
      disc1: Number(i.disc1 || 0),
      disc2: Number(i.disc2 || 0),
      disc3: Number(i.disc3 || 0),
      is_bonus: !!i.isBonus,
      total: rowSubtotal,
      totalHarga: rowSubtotal,
      subtotalorder: rowSubtotal,
      ...ppnFields,
      harga_jual: Number(i.harga || 0),
      promo_preview: promoPreviewGroups.value.filter((promo) => Number(promo.amount || 0) > 0),
    };
  });

    console.log('RAW STOK ITEM:', Object.values(cart.value)[0]?.stok);
console.log('ITEM PAYLOAD:', items);

  return {
    unique_id: uuidv4(),
    tanggal: tanggalTransaksi.value,
    jatuh_tempo: jatuhTempo.value,
    customer: customerData.value,

    id_kunjungan: visitId.value,
    id_plafon: customerData.value.id_plafon || route.query.id_plafon || '',
    kode_customer: customerData.value.Kode,

    keterangan: String(keterangan.value || '').trim(),
    items,
    stock_warnings: getStockWarnings(),
    subtotal_penjualan: subtotalOrder.value,
    subtotal_bruto: subtotalOrder.value,
    subtotal_diskon: promoDiscountTotal.value,
    promo_discount: promoDiscountTotal.value,
    voucher_discount: promoDiscountTotal.value,
    subtotal: taxableSubtotalOrder.value,
    dpp: taxableSubtotalOrder.value,
    ppn: ppnOrder.value,
    pajak: ppnOrder.value,
    total_penjualan: grandTotalOrder.value,
    promo_application: promoApplication,
    promo_preview: promoPreview.value,
    applied_promos: promoPreviewGroups.value,
    vouchers: {
      source: 'mobile_unified_preview',
      discount_total: promoDiscountTotal.value,
      groups: promoPreviewGroups.value
    },
    created_offline_at: new Date().toISOString()
  };
};

const submitOrderToServer = async (payload) => {
  const now = new Date();

  return api.post('/api/transaksi/save', {
    unique_id: payload.unique_id,
    tanggal: dateInputToLocalDateTime(payload.tanggal, now),
    jatuh_tempo: dateInputToLocalDateTime(payload.jatuh_tempo, now),
    customer: payload.customer,

    id_kunjungan: payload.id_kunjungan,
    id_plafon: payload.id_plafon || '',
    kode_customer: payload.kode_customer,

    keterangan: payload.keterangan || '',
    items: Array.isArray(payload.items) ? payload.items : [],
    products: Array.isArray(payload.items) ? payload.items : [],
    stock_warnings: Array.isArray(payload.stock_warnings) ? payload.stock_warnings : [],

    subtotal: Number(payload.subtotal || 0),
    subtotal_penjualan: Number(payload.subtotal_penjualan || payload.subtotal_bruto || 0),
    subtotal_bruto: Number(payload.subtotal_bruto || payload.subtotal || 0),
    subtotal_diskon: Number(payload.subtotal_diskon || 0),
    promo_discount: Number(payload.promo_discount || 0),
    voucher_discount: Number(payload.voucher_discount || 0),
    dpp: Number(payload.dpp || payload.subtotal || 0),
    ppn: Number(payload.ppn || 0),
    pajak: Number(payload.pajak || payload.ppn || 0),
    total_penjualan: Number(payload.total_penjualan || 0),
    promo_application: payload.promo_application || null,
    promo_preview: payload.promo_preview || null,
    applied_promos: payload.applied_promos || [],
    vouchers: payload.vouchers || null,

    // legacy untuk SalesOrder lama
    subtotalorder: Number(payload.subtotal || 0),
    subtotal_diskon_order: Number(payload.subtotal_diskon || 0),
    ppnorder: Number(payload.ppn || 0),
    totalorder: Number(payload.total_penjualan || 0)
  });
};
console.log('ROUTE QUERY:', route.query);

const saveOrderToOfflineQueue = async (payload) => {
  const db = getDb();
  if (!db) throw new Error('Database belum siap');

  await db.run(
    `
    INSERT OR REPLACE INTO sales_order_offline
    (order_id, id_kunjungan, kode_customer, nama_customer, tanggal, jatuh_tempo,
     total_penjualan, items_json, status_sync, retry_count, last_error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?)
    `,
    [
      payload.unique_id,
      payload.id_kunjungan || '',
      payload.customer?.Kode || '',
      payload.customer?.Nama || '',
      payload.tanggal,
      payload.jatuh_tempo,
      Number(payload.total_penjualan || 0),
      JSON.stringify({
        items: payload.items || [],
        keterangan: payload.keterangan || '',
        subtotal_penjualan: payload.subtotal_penjualan || payload.subtotal_bruto || 0,
        subtotal_bruto: payload.subtotal_bruto || 0,
        subtotal_diskon: payload.subtotal_diskon || 0,
        promo_discount: payload.promo_discount || 0,
        voucher_discount: payload.voucher_discount || 0,
        dpp: payload.dpp || payload.subtotal || 0,
        pajak: payload.pajak || payload.ppn || 0,
        promo_application: payload.promo_application || null,
        promo_preview: payload.promo_preview || null,
        applied_promos: payload.applied_promos || [],
        vouchers: payload.vouchers || null,
        subtotal: payload.subtotal || 0,
        ppn: payload.ppn || 0
      }),
      payload.created_offline_at || new Date().toISOString()
    ]
  );
};

// achievement hook
const refreshAchievementSafely = async () => {
  try {
    window.dispatchEvent(new CustomEvent('achievement:refresh'));
  } catch (err) {
    console.warn('[WARN] achievement refresh hook gagal:', err);
  }
};

// pending
const uploadPendingOrders = async () => {
  if (isOffline.value) {
    await Swal.fire('Offline', 'Upload pending hanya bisa saat online.', 'info');
    return;
  }

  if (pendingCount.value === 0) {
    await Swal.fire('Info', 'Tidak ada order pending.', 'info');
    return;
  }

  if (isAutoUploading.value || isUploadingPending.value) return;

  isUploadingPending.value = true;

  try {
    const result = await SyncService.uploadPendingSalesOrderData();
    await refreshPendingCount();

    if (result.success) {
      if (pendingCount.value === 0) {
        await Swal.fire({
          icon: 'success',
          title: 'Selesai',
          text: 'Semua order pending berhasil diupload.',
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        await Swal.fire(
          'Sebagian Gagal',
          `${pendingCount.value} order masih pending dan akan dicoba lagi nanti.`,
          'warning'
        );
      }
    } else {
      await Swal.fire('Gagal', result.message || 'Gagal upload pending order.', 'error');
    }
  } finally {
    isUploadingPending.value = false;
  }
};

const autoUploadPendingOrders = async () => {
  if (isOffline.value || pendingCount.value === 0 || isAutoUploading.value) return;

  isAutoUploading.value = true;
  try {
    await SyncService.uploadPendingSalesOrderData();
    await refreshPendingCount();
  } catch (err) {
    console.error('[ERR] autoUploadPendingOrders error:', err);
  } finally {
    isAutoUploading.value = false;
  }
};

// submit
const submitOrder = async () => {
  if (!isOffline.value && totalItems.value > 0) {
    await refreshPromoPreview({ silent: true });
  }

  const payload = buildOrderPayload();

  if (payload.items.length === 0) {
    currentX.value = 0;
    return Swal.fire('Peringatan', 'Belum ada barang yang diinput.', 'warning');
  }

  if (!isTanggalValid.value) {
    currentX.value = 0;
    return Swal.fire('Peringatan', 'Tanggal transaksi tidak valid.', 'warning');
  }

  const ruleViolations = await getOrderRuleViolations();
  if (ruleViolations.forbiddenItems.length > 0) {
    currentX.value = 0;
    return Swal.fire({
      icon: 'warning',
      title: 'Produk Tidak Boleh Diorder',
      html: `<div style="text-align:left">${ruleViolations.forbiddenItems.slice(0, 8).map((item) => `<div><b>${escapeHtml(item.nama || item.stok?.Nama || item.kode)}</b></div>`).join('')}</div>`
    });
  }

  if (ruleViolations.requiredMissing.length > 0) {
    currentX.value = 0;
    return Swal.fire({
      icon: 'warning',
      title: 'Produk Wajib Belum Diorder',
      html: `<div style="text-align:left">${ruleViolations.requiredMissing.slice(0, 8).map((item) => `<div><b>${escapeHtml(item.nama_produk || item.Nama || item.kode_sku || 'Produk')}</b></div>`).join('')}</div>`
    });
  }

  const stockWarnings = Array.isArray(payload.stock_warnings) ? payload.stock_warnings : [];
  const stockWarningHtml = stockWarnings.length
    ? `
      <div class="swal-stock-warning">
        <b>Stok kurang pada ${stockWarnings.length} item.</b>
        <div class="swal-stock-warning-list">
          ${stockWarnings.slice(0, 5).map((item) => `
            <div class="swal-stock-warning-item">
              <b>${escapeHtml(item.nama)}</b><br/>
              Order ${escapeHtml(formatNumber(item.ordered))} pcs, stok ${escapeHtml(formatNumber(item.available))} pcs, kurang ${escapeHtml(formatNumber(item.shortage))} pcs.
            </div>
          `).join('')}
          ${stockWarnings.length > 5 ? `<small>+${stockWarnings.length - 5} item lain stoknya kurang.</small>` : ''}
        </div>
        <small class="swal-stock-warning-note">Order tetap bisa dikirim untuk diproses admin.</small>
      </div>
    `
    : '';

  const result = await Swal.fire({
    title: stockWarnings.length
      ? (isOffline.value ? 'Stok Kurang, Simpan Offline?' : 'Stok Kurang, Tetap Kirim?')
      : (isOffline.value ? 'Simpan Offline?' : 'Kirim Order?'),
    html: `
      <div style="text-align:left">
        <p style="margin:0">
          ${isOffline.value
            ? `Total <b>${payload.items.length}</b> item akan masuk antrean offline.`
            : `Total <b>${payload.items.length}</b> item akan dikirim.`}
        </p>
        ${stockWarningHtml}
      </div>
    `,
    icon: stockWarnings.length ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: stockWarnings.length
      ? (isOffline.value ? 'Tetap Simpan' : 'Tetap Kirim')
      : (isOffline.value ? 'Ya, Simpan' : 'Ya, Kirim'),
    cancelButtonText: 'Batal'
  });

  if (!result.isConfirmed) {
    currentX.value = 0;
    return;
  }

  isSubmitting.value = true;

  try {
    if (isOffline.value) {
      await saveOrderToOfflineQueue(payload);
      await clearCartAfterSubmit();
      await refreshPendingCount();
      currentX.value = 0;

      await Swal.fire({
        icon: stockWarnings.length ? 'warning' : 'info',
        title: 'Tersimpan Offline',
        text: stockWarnings.length
          ? 'Order masuk antrean offline dengan catatan stok kurang.'
          : 'Order masuk antrean SQLite dan akan diupload saat online.',
        timer: 1600,
        showConfirmButton: false
      });

      router.back();
      return;
    }

    const res = await submitOrderToServer(payload);

    // backend lama sukses tapi tidak selalu return success: true
    if (res.status === 200 && res.data) {
      await clearCartAfterSubmit();
      await refreshAchievementSafely();

      const nota =
        res.data?.nota ||
        res.data?.no_order ||
        res.data?.no_faktur ||
        res.data?.data?.nota ||
        res.data?.data?.no_order ||
        res.data?.data?.no_faktur ||
        '-';

      const next = await Swal.fire({
        icon: 'success',
        title: 'Order Terkirim',
        html: `
          <div style="text-align:left">
            <p style="margin:0 0 8px">Nota: <b>${nota}</b></p>
            <p style="margin:0">Status: <b>Menunggu Verifikasi Admin</b></p>
            ${stockWarnings.length ? '<p style="margin:8px 0 0; color:#b45309"><b>Catatan:</b> ada item dengan stok kurang.</p>' : ''}
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Lihat Riwayat',
        cancelButtonText: 'Kembali'
      });

      currentX.value = 0;
      if (next.isConfirmed) {
        router.push({
          path: '/history-toko',
          query: {
            kode_customer: customerData.value.Kode,
            nama_toko: customerData.value.Nama,
            id_kunjungan: visitId.value || '',
            id_plafon: customerData.value.id_plafon || ''
          }
        });
        return;
      }
      router.back();
      return;
    }

    throw new Error(res.data?.message || 'Gagal kirim order');
  } catch (e) {
    console.error('[ERR] Submit order error:', e);

    const statusCode = Number(e?.response?.status || 0);
    if (statusCode >= 400 && statusCode < 500) {
      currentX.value = 0;
      await Swal.fire({
        icon: 'error',
        title: 'Order Ditolak',
        text:
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e.message ||
          'Data order belum valid.',
        confirmButtonText: 'OK'
      });
      return;
    }

    try {
      const db = getDb();

      if (db) {
        await saveOrderToOfflineQueue(payload);
        await clearCartAfterSubmit();
        await refreshPendingCount();

        await Swal.fire({
          icon: 'warning',
          title: 'Disimpan ke Antrean',
          text: 'Order gagal dikirim. Data disimpan di SQLite dan akan diupload saat online.',
          confirmButtonText: 'OK'
        });

        router.back();
        return;
      }

      await Swal.fire({
        icon: 'error',
        title: 'Gagal Kirim Order',
        text:
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e.message ||
          'Server error dan database offline belum siap.',
        confirmButtonText: 'OK'
      });
    } catch (offlineErr) {
      console.error('[ERR] Simpan offline juga gagal:', offlineErr);

      await Swal.fire({
        icon: 'error',
        title: 'Gagal Total',
        text: offlineErr.message || 'Order gagal dikirim dan gagal disimpan offline.',
        confirmButtonText: 'OK'
      });
    }

    currentX.value = 0;
  } finally {
    isSubmitting.value = false;
  }
};

// ui helpers
const formatNumber = (val) => new Intl.NumberFormat('id-ID').format(Number(val) || 0);

const formatDisplayDate = (value) => {
  if (!value) return '-';
  const d = parseLocalDateInput(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d);
};

const getInitial = (name) => String(name || 'P').trim().charAt(0).toUpperCase();

const switchTab = async (t) => {
  if (activeTab.value === t) return;

  activeTab.value = t;
  offset.value = 0;
  currentPage.value = 1;
  hasMore.value = true;
  rawData.value = [];
  currentX.value = 0;

  await fetchData(false);
  await updateMaxSlide();
};

const filteredItems = computed(() => {
  if (!searchQuery.value) return rawData.value;
  const q = searchQuery.value.toLowerCase();

  return rawData.value.filter((i) =>
    String(i.Nama || '').toLowerCase().includes(q) ||
    String(i.Kode || '').toLowerCase().includes(q)
  );
});

const totalProductPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / pageSize)));
const pageStartIndex = computed(() => (currentPage.value - 1) * pageSize);
const pageEndIndex = computed(() => Math.min(pageStartIndex.value + pageSize, filteredItems.value.length));
const pagedItems = computed(() => filteredItems.value.slice(pageStartIndex.value, pageEndIndex.value));

const goToProductPage = async (page) => {
  const nextPage = Math.max(1, Number(page) || 1);

  if (nextPage > totalProductPages.value && hasMore.value && !loading.value && !isOffline.value) {
    await fetchData(true);
  }

  currentPage.value = Math.min(nextPage, totalProductPages.value);
  await nextTick();
  document.querySelector('.so-container .scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' });
};

watch(searchQuery, () => {
  currentPage.value = 1;
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(async () => {
    offset.value = 0;
    hasMore.value = true;
    await fetchData(false);
  }, 350);
});

watch(filteredItems, () => {
  if (currentPage.value > totalProductPages.value) {
    currentPage.value = totalProductPages.value;
  }
});

const updateUomQty = async (item, field, value) => {
  const entry = ensureCartEntry(item);
  const flags = buildOrderUomFlags(item);

  entry.nama = String(item.Nama || '').trim();
  entry.uom1Label = flags.Uom1Label;
  entry.uom2Label = flags.Uom2Label;
  entry.uom3Label = flags.Uom3Label;
  entry.konversi2 = Number(flags.Konversi2 || 0);
  entry.konversi3 = Number(flags.Konversi3 || 0);
  entry.hasUom1 = flags.hasUom1;
  entry.hasUom2 = flags.hasUom2;
  entry.hasUom3 = flags.hasUom3;
  entry.harga = Number(item.HargaE || 0);
  entry.stok = item;

  if (!isOrderUomEnabled(entry, field)) {
    entry[field] = 0;
    await persistCartDraft();
    return;
  }

  const parsed = value === '' ? 0 : Math.max(0, Number(value));

  entry[field] = Number.isNaN(parsed) ? 0 : parsed;

  await persistCartDraft();
};

const changeUomQty = async (item, field, delta) => {
  if (!isOrderUomEnabled(item, field)) return;
  const current = getCartUomValue(item.Kode, field);
  const next = Math.max(0, current + delta);
  await updateUomQty(item, field, next);
};

const setQtyInputRef = (kode, el) => {
  if (el) qtyInputRefs.value[String(kode || '').trim()] = el;
};

const escapeHtml = (unsafe) => {
  return String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const showCartPreview = () => {
  const items = Object.values(cart.value).filter((i) => hasEntrySelection(i));
  if (items.length === 0) return;

  const list = items.map((i) => `
    <div style="display:flex; justify-content:space-between; gap:12px; font-size:13px; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:6px;">
      <span style="text-align:left;">${escapeHtml(i.nama)}</span>
      <div style="text-align:right;">
        <b style="white-space:nowrap;">${escapeHtml(formatEntryUomSummary(i))}</b><br/>
        <span style="font-size:12px; color:#64748b;">
          Disc ${Number(i.disc1 || 0)} / ${Number(i.disc2 || 0)} / ${Number(i.disc3 || 0)}
        </span><br/>
        <span style="font-size:12px; color:#64748b;">Rp ${formatNumber(computeLineTotalFromEntry(i))}</span>
      </div>
    </div>
  `).join('');

  Swal.fire({
    title: 'Isi Keranjang',
    html: `
      <div style="text-align:left; max-height:300px; overflow-y:auto;">
        ${list}
        <div style="margin-top:14px; display:flex; justify-content:space-between; font-size:14px;">
          <span>Total</span>
          <strong>Rp ${formatNumber(subtotalOrder.value)}</strong>
        </div>
        <div style="margin-top:8px; display:flex; justify-content:space-between; font-size:14px;">
          <span>PPN</span>
          <strong>Rp ${formatNumber(ppnOrder.value)}</strong>
        </div>
        <div style="margin-top:8px; display:flex; justify-content:space-between; font-size:15px;">
          <span><b>Grand Total</b></span>
          <strong>Rp ${formatNumber(grandTotalOrder.value)}</strong>
        </div>
      </div>
    `,
    confirmButtonText: 'Tutup'
  });
};

// watchers
watch(
  () => cart.value,
  async () => {
    promoPreview.value = {
      total_estimated_benefit: 0,
      total_estimated_cashback: 0,
      total_estimated_discount: 0,
      qualified_count: 0,
      groups: []
    };
    promoPreviewError.value = '';
    await persistCartDraft();
  },
  { deep: true }
);

watch(tanggalTransaksi, async () => {
  await persistMetaDraft();
});

watch(keterangan, async () => {
  await persistMetaDraft();
});

watch(
  () => connectivity.isOnline,
  async (online) => {
    if (online) {
      await autoUploadPendingOrders();
      await loadCategoryTabs();
      offset.value = 0;
      hasMore.value = true;
      rawData.value = [];
      await fetchData(false);
      await updateMaxSlide();
    }
  }
);

// init
const handleResize = () => {
  updateMaxSlide();
};

watch(isOffline, (offline) => { if (!offline) refreshCustomerContext(); });

onMounted(async () => {
  await refreshCustomerContext();
  await restoreCartDraft();
  await restoreMetaDraft();
  await refreshPendingCount();
  await loadCategoryTabs();
  await fetchData(false);
  await updateMaxSlide();

  window.addEventListener('resize', handleResize);

  if (!isOffline.value && pendingCount.value > 0) {
    await autoUploadPendingOrders();
  }
});

onBeforeUnmount(() => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
:global(body) {
  background: #eef2f7;
}

.page-wrapper {
  position: relative;
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.10), transparent 30%),
    radial-gradient(circle at top right, rgba(30, 41, 59, 0.08), transparent 28%),
    linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
  min-height: 100vh;
  display: flex;
  justify-content: stretch;
  overflow: hidden;
  width: 100vw;
}

.bg-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(50px);
  pointer-events: none;
  opacity: 0.22;
}

.orb-1 {
  width: 220px;
  height: 220px;
  background: #93c5fd;
  top: -40px;
  left: -60px;
}

.orb-2 {
  width: 240px;
  height: 240px;
  background: #bfdbfe;
  right: -80px;
  bottom: 120px;
}

.so-container {
  position: relative;
  width: 100vw;
  max-width: none;
  background: rgba(255, 255, 255, 0.90);
  backdrop-filter: blur(22px);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 18px 60px rgba(15, 23, 42, 0.10),
    0 4px 18px rgba(59, 130, 246, 0.06);
  border-left: 0;
  border-right: 0;
}

.header.blue-header {
  background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 48%, #3b82f6 100%);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
  box-shadow: 0 12px 24px rgba(29, 78, 216, 0.18);
}

.btn-back,
.header-cart {
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
}

.btn-back {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  font-size: 1.1rem;
  color: white;
  background: rgba(255,255,255,0.18);
  backdrop-filter: blur(10px);
}

.header-title {
  flex: 1;
  min-width: 0;
}

.header-title h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}

.header-title p {
  margin: 3px 0 0;
  font-size: 0.77rem;
  opacity: 0.92;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cart-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  font-size: 1.2rem;
  background: rgba(255,255,255,0.18);
}

.cart-badge {
  position: absolute;
  top: -5px;
  right: -4px;
  background: white;
  color: #1d4ed8;
  font-size: 0.7rem;
  font-weight: 900;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  z-index: 3;
  border: 2px solid rgba(29, 78, 216, 0.28);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.18);
}

.offline-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(90deg, #f59e0b 0%, #f97316 100%);
  color: white;
  text-align: center;
  padding: 10px 12px;
  font-size: 0.75rem;
  font-weight: 800;
}

.offline-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: white;
}

.nav-section {
  padding: 14px 14px 10px;
  background: linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.82) 100%);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(226, 232, 240, 0.85);
}

.customer-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, #fff 0%, #eff6ff 100%);
  border: 1px solid #dbeafe;
  border-radius: 18px;
  padding: 12px;
  margin-bottom: 12px;
}

.customer-mini {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.customer-avatar {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}

.customer-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.customer-text strong {
  font-size: 0.88rem;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.customer-text span {
  font-size: 0.73rem;
  color: #64748b;
}

.summary-mini {
  display: flex;
  gap: 8px;
}

.summary-mini-item {
  min-width: 76px;
  background: rgba(255,255,255,0.84);
  border: 1px solid #dbeafe;
  border-radius: 14px;
  padding: 8px 10px;
  text-align: center;
}

.summary-mini-item span {
  display: block;
  font-size: 0.67rem;
  color: #64748b;
  margin-bottom: 2px;
}

.summary-mini-item strong {
  display: block;
  font-size: 0.8rem;
  color: #1d4ed8;
}

.tabs-container {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.tabs-container::-webkit-scrollbar {
  display: none;
}

.tab-btn {
  flex: 0 0 auto;
  min-width: 88px;
  padding: 10px 8px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  font-size: 0.8rem;
  font-weight: 700;
  color: #475569;
}

.tab-btn.active {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  border-color: #3b82f6;
}

.search-box {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  font-size: 0.95rem;
}

.search-input {
  width: 100%;
  padding: 12px 14px 12px 38px;
  border-radius: 14px;
  border: 1.5px solid #e2e8f0;
  background: rgba(248, 250, 252, 0.96);
  font-size: 0.9rem;
  outline: none;
  box-sizing: border-box;
  color: #0f172a;
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.72) 0%, rgba(241, 245, 249, 0.96) 100%);
  -webkit-overflow-scrolling: touch;
}

.stock-card {
  position: relative;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.94);
  border-radius: 16px;
  padding: 10px 10px 10px 12px;
  margin-bottom: 9px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04), 0 2px 6px rgba(15, 23, 42, 0.03);
}

.card-active-blue {
  border-color: #93c5fd;
  background: linear-gradient(135deg, #ffffff 0%, #eff6ff 100%);
}

.card-required {
  border-color: #7dd3fc;
}

.card-forbidden {
  border-color: #fecdd3;
  background: linear-gradient(135deg, #fff 0%, #fff1f2 100%);
}

.card-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, #3b82f6 0%, #93c5fd 100%);
  opacity: 0.85;
}

.card-content {
  display: grid;
  gap: 8px;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.top-line {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  min-width: 0;
}

.brand-tag {
  font-size: 0.64rem;
  font-weight: 900;
  text-transform: uppercase;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-chip {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 0.62rem;
  font-weight: 900;
  text-transform: uppercase;
  white-space: nowrap;
}

.rule-chip-required {
  background: #e0f2fe;
  color: #0369a1;
  border: 1px solid #7dd3fc;
}

.rule-chip-forbidden {
  background: #ffe4e6;
  color: #be123c;
  border: 1px solid #fda4af;
}

.rule-note {
  margin: -2px 0 8px;
  font-size: 0.72rem;
  line-height: 1.35;
  color: #64748b;
}

.blue-text {
  color: #1d4ed8;
}

.item-name {
  margin: 6px 0 8px;
  font-size: 0.9rem;
  color: #0f172a;
  font-weight: 800;
  line-height: 1.25;
}

.item-meta-wrap {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.item-meta {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 6px 8px;
}

.meta-label {
  display: block;
  font-size: 0.66rem;
  color: #94a3b8;
  margin-bottom: 2px;
  font-weight: 700;
  text-transform: uppercase;
}

.meta-value {
  display: block;
  font-size: 0.72rem;
  color: #334155;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.price {
  color: #1d4ed8;
}

.stock-chip {
  flex-shrink: 0;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 0.66rem;
  font-weight: 800;
}

.item-action {
  display: grid;
  gap: 6px;
}

.uom-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.uom-field {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.uom-disabled {
  opacity: 0.55;
}

.uom-disabled .input-label,
.uom-disabled .field-label {
  color: #94a3b8;
}

.qty-box-compact {
  grid-template-columns: 24px minmax(0, 1fr) 24px;
  gap: 3px;
}

.uom-summary {
  font-size: 0.68rem;
  line-height: 1.35;
  color: #475569;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  padding: 6px 8px;
}

.input-label,
.field-label {
  font-size: 0.62rem;
  font-weight: 800;
  color: #94a3b8;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qty-box {
  display: grid;
  grid-template-columns: 30px 1fr 30px;
  gap: 6px;
  align-items: center;
}

.qty-btn {
  height: 32px;
  border: none;
  border-radius: 9px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 1rem;
  font-weight: 900;
  box-shadow: inset 0 0 0 1px #bfdbfe;
}

.qty-btn:disabled,
.qty-input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  background: #e2e8f0;
  color: #94a3b8;
}

.qty-input {
  width: 100%;
  padding: 6px 4px;
  border-radius: 9px;
  border: 2px solid #e2e8f0;
  text-align: center;
  font-weight: 900;
  font-size: 0.92rem;
  color: #1d4ed8;
  outline: none;
  box-sizing: border-box;
  background: #fff;
  appearance: textfield;
}

.qty-input::-webkit-outer-spin-button,
.qty-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.unit-select,
.date-input,
.note-input,
.disc-input {
  width: 100%;
  padding: 10px 12px;
  font-size: 0.82rem;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #fff;
  font-weight: 700;
  color: #475569;
  outline: none;
  box-sizing: border-box;
}

.note-input {
  resize: vertical;
  min-height: 82px;
  font-weight: 600;
}

.line-total {
  text-align: center;
  font-size: 0.7rem;
  font-weight: 800;
  border-radius: 10px;
  padding: 5px 6px;
}

.blue-line-total {
  color: #1d4ed8;
  background: #eff6ff;
  border: 1px solid #dbeafe;
}

.btn-detail-mini {
  border: none;
  background: #fff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  padding: 7px 8px;
  font-size: 0.7rem;
  font-weight: 800;
}

.footer-action {
  padding: 14px 16px 22px;
  background: rgba(255,255,255,0.94);
  backdrop-filter: blur(18px);
  border-top: 1px solid rgba(226, 232, 240, 0.85);
  box-shadow: 0 -10px 22px rgba(15, 23, 42, 0.04);
}

.form-stack {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.form-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 12px;
}

.two-col-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.info-card {
  background: linear-gradient(135deg, #fff 0%, #eff6ff 100%);
  border: 1px solid #dbeafe;
  border-radius: 16px;
  padding: 12px;
}

.info-card span {
  display: block;
  font-size: 0.7rem;
  color: #64748b;
  margin-bottom: 4px;
  font-weight: 700;
}

.info-card strong {
  color: #1d4ed8;
  font-size: 0.9rem;
}

.summary-detail-card {
  background: linear-gradient(135deg, #fff 0%, #eff6ff 100%);
  border: 1px solid #dbeafe;
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 12px;
}

.page-control-card {
  display: grid;
  grid-template-columns: 42px 1fr 42px;
  align-items: center;
  gap: 10px;
  margin: 8px 0 14px;
  padding: 10px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #e2e8f0;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
}

.page-btn {
  width: 42px;
  height: 38px;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 900;
}

.page-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.page-info {
  display: grid;
  gap: 2px;
  text-align: center;
  min-width: 0;
}

.page-info strong {
  color: #0f172a;
  font-size: 0.8rem;
}

.page-info span {
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 700;
}

.promo-card {
  display: grid;
  gap: 10px;
}

.promo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.promo-head p {
  margin: 3px 0 0;
  color: #64748b;
  font-size: 0.76rem;
  font-weight: 700;
}

.btn-check-promo {
  border: none;
  border-radius: 12px;
  background: #1d4ed8;
  color: white;
  padding: 9px 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  font-weight: 900;
}

.btn-check-promo:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.promo-error {
  border-radius: 12px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  padding: 8px 10px;
  font-size: 0.74rem;
  font-weight: 700;
}

.swal-stock-warning {
  margin: 10px 0 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
}

.swal-stock-warning-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.swal-stock-warning-item {
  font-size: 12px;
  line-height: 1.35;
}

.swal-stock-warning-note {
  display: block;
  margin-top: 8px;
}

.promo-list {
  display: grid;
  gap: 6px;
}

.promo-entry {
  display: grid;
  gap: 4px;
}

.promo-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  border-radius: 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 8px 10px;
  font-size: 0.76rem;
  color: #1e3a8a;
}

.promo-discount-row strong {
  color: #16a34a;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.86rem;
  color: #475569;
}

.summary-row + .summary-row {
  margin-top: 8px;
}

.summary-row.grand {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #bfdbfe;
}

.summary-row.grand strong {
  color: #1d4ed8;
  font-size: 1rem;
}

.glassy {
  background: linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(239,246,255,0.96) 100%);
  border: 1px solid #dbeafe;
}

.summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  padding: 14px;
  border-radius: 18px;
  gap: 12px;
}

.summary-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  display: block;
  font-size: 0.76rem;
  color: #64748b;
  margin-bottom: 4px;
  font-weight: 700;
}

.value {
  font-size: 1.12rem;
  font-weight: 900;
}

.blue-pill {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 0.74rem;
  font-weight: 800;
  white-space: nowrap;
}

.blue-btn {
  border: none;
  background: #1d4ed8;
  color: white;
  border-radius: 999px;
  padding: 8px 11px;
  font-size: 0.72rem;
  font-weight: 800;
}

.pending-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
  border: 1px solid #fed7aa;
  border-radius: 16px;
  padding: 12px;
  margin-bottom: 12px;
  color: #9a3412;
}

.pending-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pending-text strong {
  font-size: 0.78rem;
}

.pending-text span {
  font-size: 0.69rem;
  opacity: 0.85;
}

.btn-pending-sync {
  border: none;
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  color: white;
  padding: 9px 12px;
  border-radius: 12px;
  font-size: 0.72rem;
  font-weight: 800;
}

.slide-checkout-wrapper {
  width: 100%;
  height: 58px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-radius: 999px;
  position: relative;
  overflow: hidden;
  border: 1px solid #bfdbfe;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.9);
}

.slide-track {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 999px;
  transition: width 0.12s ease;
}

.blue-fill {
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
  opacity: 0.16;
}

.slide-hint {
  position: relative;
  z-index: 1;
  font-size: 0.82rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.9px;
}

.blue-hint {
  color: #1d4ed8;
}

.slide-handle {
  position: absolute;
  left: 4px;
  width: 50px;
  height: 50px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.2rem;
  z-index: 2;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-x;
}

.blue-handle {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  box-shadow: 0 10px 18px rgba(59, 130, 246, 0.34);
}

.is-locked {
  opacity: 0.58;
  filter: grayscale(0.2);
  pointer-events: none;
}

.end-list,
.empty-state {
  text-align: center;
  padding: 22px 16px;
  font-size: 0.8rem;
  color: #94a3b8;
}

.loading-state {
  text-align: center;
  padding: 24px 16px;
  color: #94a3b8;
  font-size: 0.78rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.empty-illustration {
  font-size: 2rem;
  opacity: 0.85;
}

.loader-mini-blue {
  width: 30px;
  height: 30px;
  border: 3.5px solid #f1f5f9;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 12px auto 0;
}

.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.46);
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 10px 10px calc(10px + env(safe-area-inset-bottom, 0px));
  overflow: hidden;
  box-sizing: border-box;
}

.detail-sheet {
  width: 100%;
  max-width: 460px;
  max-height: calc(100vh - 18px);
  max-height: calc(100dvh - 18px);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: #fff;
  border-radius: 24px 24px 16px 16px;
  padding: 16px;
  box-sizing: border-box;
  box-shadow: 0 -12px 30px rgba(15, 23, 42, 0.16);
  animation: sheetUp 0.2s ease;
}

.detail-sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.detail-sheet-head h3 {
  margin: 0;
  font-size: 1rem;
  color: #0f172a;
  font-weight: 800;
}

.detail-sheet-head p {
  margin: 4px 0 0;
  font-size: 0.82rem;
  color: #64748b;
}

.btn-close-sheet {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 12px;
  background: #f8fafc;
  color: #334155;
  font-weight: 900;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.detail-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 10px 12px;
}

.detail-box span {
  display: block;
  font-size: 0.68rem;
  color: #94a3b8;
  margin-bottom: 4px;
  font-weight: 800;
  text-transform: uppercase;
}

.detail-box strong {
  font-size: 0.84rem;
  color: #0f172a;
}

.detail-form {
  display: grid;
  gap: 12px;
}

.detail-uom-grid {
  display: grid;
  gap: 10px;
}

.detail-qty-box {
  grid-template-columns: 40px 1fr 40px;
}

.detail-uom-summary {
  font-size: 0.75rem;
}

.bonus-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 12px;
}

.bonus-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.84rem;
  font-weight: 700;
  color: #334155;
}

.discount-stack {
  display: grid;
  gap: 10px;
}

.discount-row {
  display: grid;
  grid-template-columns: 1fr 110px;
  gap: 10px;
  align-items: center;
}

.discount-row label {
  font-size: 0.8rem;
  font-weight: 700;
  color: #475569;
}

.blue-detail-subtotal {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  border-radius: 14px;
  padding: 12px;
}

.blue-detail-subtotal span {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 700;
}

.blue-detail-subtotal strong {
  color: #1d4ed8;
  font-size: 0.92rem;
}

.detail-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  position: sticky;
  bottom: -16px;
  margin: 16px -16px -16px;
  padding: 12px 16px 16px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  border-radius: 0 0 16px 16px;
  box-shadow: 0 -10px 20px rgba(15, 23, 42, 0.06);
}

.btn-delete-item,
.btn-save-item {
  height: 48px;
  border: none;
  border-radius: 14px;
  font-weight: 800;
  font-size: 0.85rem;
}

.btn-delete-item {
  background: #fff1f2;
  color: #dc2626;
  border: 1px solid #fecdd3;
}

.blue-save {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes sheetUp {
  from {
    transform: translateY(18px);
    opacity: 0.4;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

:global(:root[data-theme='dark']) .page-wrapper,
:global(:root[data-theme='dark']) .so-container,
:global(:root[data-theme='dark']) .scroll-area {
  background: #020617 !important;
}

:global(:root[data-theme='dark']) .fixed-nav-wrapper,
:global(:root[data-theme='dark']) .customer-card,
:global(:root[data-theme='dark']) .stock-card,
:global(:root[data-theme='dark']) .summary-bar,
:global(:root[data-theme='dark']) .summary-detail-card,
:global(:root[data-theme='dark']) .page-control-card,
:global(:root[data-theme='dark']) .form-card,
:global(:root[data-theme='dark']) .info-card,
:global(:root[data-theme='dark']) .detail-sheet,
:global(:root[data-theme='dark']) .detail-box,
:global(:root[data-theme='dark']) .bonus-box {
  background: #0f172a !important;
  border-color: #334155 !important;
  box-shadow: 0 18px 34px rgba(2, 6, 23, 0.34) !important;
}

:global(:root[data-theme='dark']) .summary-mini-item,
:global(:root[data-theme='dark']) .tab-btn,
:global(:root[data-theme='dark']) .search-input,
:global(:root[data-theme='dark']) .qty-input,
:global(:root[data-theme='dark']) .page-btn,
:global(:root[data-theme='dark']) .unit-select,
:global(:root[data-theme='dark']) .pending-bar,
:global(:root[data-theme='dark']) .btn-close-sheet {
  background: #111827 !important;
  border-color: #334155 !important;
  color: #e2e8f0 !important;
}

:global(:root[data-theme='dark']) .item-name-full,
:global(:root[data-theme='dark']) .header-title h3,
:global(:root[data-theme='dark']) .detail-sheet-head h3,
:global(:root[data-theme='dark']) .detail-box strong,
:global(:root[data-theme='dark']) .blue-detail-subtotal strong,
:global(:root[data-theme='dark']) .summary-pill strong,
:global(:root[data-theme='dark']) .summary-mini-item strong {
  color: #e2e8f0 !important;
}

:global(:root[data-theme='dark']) .page-info strong {
  color: #e2e8f0 !important;
}

:global(:root[data-theme='dark']) .page-info span {
  color: #94a3b8 !important;
}

:global(:root[data-theme='dark']) .header-title p,
:global(:root[data-theme='dark']) .detail-sheet-head p,
:global(:root[data-theme='dark']) .item-code,
:global(:root[data-theme='dark']) .detail-box span,
:global(:root[data-theme='dark']) .discount-row label,
:global(:root[data-theme='dark']) .summary-pill small,
:global(:root[data-theme='dark']) .summary-mini-item span,
:global(:root[data-theme='dark']) .slide-hint {
  color: #94a3b8 !important;
}

:global(:root[data-theme='dark']) .tab-btn.active,
:global(:root[data-theme='dark']) .stock-card.is-filled,
:global(:root[data-theme='dark']) .blue-detail-subtotal {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(30, 64, 175, 0.22)) !important;
  border-color: rgba(59, 130, 246, 0.3) !important;
}

:global(:root[data-theme='dark']) .slide-checkout-wrapper {
  background: linear-gradient(135deg, #0f172a 0%, #172554 100%) !important;
  border-color: rgba(59, 130, 246, 0.28) !important;
}

:global(:root[data-theme='dark']) .loader-mini-blue {
  border-color: #1e293b !important;
  border-top-color: #60a5fa !important;
}

:global(:root[data-theme='dark']) .btn-delete-item {
  background: rgba(127, 29, 29, 0.2) !important;
  color: #fca5a5 !important;
  border-color: rgba(239, 68, 68, 0.3) !important;
}
</style>

<style>
html[data-theme='dark'] body,
body[data-theme='dark'] {
  background: #020617 !important;
}

html[data-theme='dark'] .page-wrapper,
body[data-theme='dark'] .page-wrapper,
html[data-theme='dark'] .so-container,
body[data-theme='dark'] .so-container,
html[data-theme='dark'] .scroll-area,
body[data-theme='dark'] .scroll-area {
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.12), transparent 28%),
    linear-gradient(180deg, #020617 0%, #030712 100%) !important;
  color: #e5edf8 !important;
}

html[data-theme='dark'] .so-container,
body[data-theme='dark'] .so-container {
  border-left: 0 !important;
  border-right: 0 !important;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.38) !important;
}

html[data-theme='dark'] .nav-section,
body[data-theme='dark'] .nav-section,
html[data-theme='dark'] .footer-action,
body[data-theme='dark'] .footer-action {
  background: rgba(2, 6, 23, 0.94) !important;
  border-color: rgba(51, 65, 85, 0.9) !important;
  box-shadow: 0 -10px 22px rgba(0, 0, 0, 0.26) !important;
}

html[data-theme='dark'] .customer-card,
body[data-theme='dark'] .customer-card,
html[data-theme='dark'] .stock-card,
body[data-theme='dark'] .stock-card,
html[data-theme='dark'] .summary-bar,
body[data-theme='dark'] .summary-bar,
html[data-theme='dark'] .summary-detail-card,
body[data-theme='dark'] .summary-detail-card,
html[data-theme='dark'] .page-control-card,
body[data-theme='dark'] .page-control-card,
html[data-theme='dark'] .form-card,
body[data-theme='dark'] .form-card,
html[data-theme='dark'] .info-card,
body[data-theme='dark'] .info-card,
html[data-theme='dark'] .summary-mini-item,
body[data-theme='dark'] .summary-mini-item,
html[data-theme='dark'] .item-meta,
body[data-theme='dark'] .item-meta,
html[data-theme='dark'] .uom-summary,
body[data-theme='dark'] .uom-summary,
html[data-theme='dark'] .blue-line-total,
body[data-theme='dark'] .blue-line-total,
html[data-theme='dark'] .promo-row,
body[data-theme='dark'] .promo-row {
  background: linear-gradient(180deg, #030712 0%, #0f172a 100%) !important;
  border-color: rgba(51, 65, 85, 0.94) !important;
  color: #e5edf8 !important;
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.28) !important;
}

html[data-theme='dark'] .card-active-blue,
body[data-theme='dark'] .card-active-blue,
html[data-theme='dark'] .tab-btn.active,
body[data-theme='dark'] .tab-btn.active,
html[data-theme='dark'] .blue-detail-subtotal,
body[data-theme='dark'] .blue-detail-subtotal {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.24), rgba(14, 116, 144, 0.18)) !important;
  border-color: rgba(96, 165, 250, 0.38) !important;
}

html[data-theme='dark'] .tab-btn,
body[data-theme='dark'] .tab-btn,
html[data-theme='dark'] .search-input,
body[data-theme='dark'] .search-input,
html[data-theme='dark'] .qty-input,
body[data-theme='dark'] .qty-input,
html[data-theme='dark'] .page-btn,
body[data-theme='dark'] .page-btn,
html[data-theme='dark'] .date-input,
body[data-theme='dark'] .date-input,
html[data-theme='dark'] .note-input,
body[data-theme='dark'] .note-input,
html[data-theme='dark'] .disc-input,
body[data-theme='dark'] .disc-input,
html[data-theme='dark'] .unit-select,
body[data-theme='dark'] .unit-select {
  background: #0f172a !important;
  border-color: rgba(51, 65, 85, 0.96) !important;
  color: #f8fafc !important;
}

html[data-theme='dark'] .qty-input::placeholder,
body[data-theme='dark'] .qty-input::placeholder,
html[data-theme='dark'] .search-input::placeholder,
body[data-theme='dark'] .search-input::placeholder,
html[data-theme='dark'] .note-input::placeholder,
body[data-theme='dark'] .note-input::placeholder {
  color: #64748b !important;
}

html[data-theme='dark'] .qty-btn,
body[data-theme='dark'] .qty-btn,
html[data-theme='dark'] .btn-detail-mini,
body[data-theme='dark'] .btn-detail-mini,
html[data-theme='dark'] .btn-close-sheet,
body[data-theme='dark'] .btn-close-sheet {
  background: #111827 !important;
  border-color: rgba(51, 65, 85, 0.96) !important;
  box-shadow: inset 0 0 0 1px rgba(51, 65, 85, 0.96) !important;
  color: #93c5fd !important;
}

html[data-theme='dark'] .qty-btn:disabled,
body[data-theme='dark'] .qty-btn:disabled,
html[data-theme='dark'] .qty-input:disabled,
body[data-theme='dark'] .qty-input:disabled {
  background: #1e293b !important;
  color: #64748b !important;
  opacity: 0.7 !important;
}

html[data-theme='dark'] .customer-text strong,
body[data-theme='dark'] .customer-text strong,
html[data-theme='dark'] .item-name,
body[data-theme='dark'] .item-name,
html[data-theme='dark'] .summary-mini-item strong,
body[data-theme='dark'] .summary-mini-item strong,
html[data-theme='dark'] .info-card strong,
body[data-theme='dark'] .info-card strong,
html[data-theme='dark'] .summary-row strong,
body[data-theme='dark'] .summary-row strong,
html[data-theme='dark'] .page-info strong,
body[data-theme='dark'] .page-info strong,
html[data-theme='dark'] .value,
body[data-theme='dark'] .value,
html[data-theme='dark'] .meta-value,
body[data-theme='dark'] .meta-value,
html[data-theme='dark'] .promo-row strong,
body[data-theme='dark'] .promo-row strong,
html[data-theme='dark'] .bonus-toggle,
body[data-theme='dark'] .bonus-toggle,
html[data-theme='dark'] .discount-row label,
body[data-theme='dark'] .discount-row label {
  color: #f8fafc !important;
  opacity: 1 !important;
}

html[data-theme='dark'] .customer-text span,
body[data-theme='dark'] .customer-text span,
html[data-theme='dark'] .summary-mini-item span,
body[data-theme='dark'] .summary-mini-item span,
html[data-theme='dark'] .meta-label,
body[data-theme='dark'] .meta-label,
html[data-theme='dark'] .input-label,
body[data-theme='dark'] .input-label,
html[data-theme='dark'] .field-label,
body[data-theme='dark'] .field-label,
html[data-theme='dark'] .promo-head p,
body[data-theme='dark'] .promo-head p,
html[data-theme='dark'] .summary-row,
body[data-theme='dark'] .summary-row,
html[data-theme='dark'] .page-info span,
body[data-theme='dark'] .page-info span,
html[data-theme='dark'] .label,
body[data-theme='dark'] .label,
html[data-theme='dark'] .end-list,
body[data-theme='dark'] .end-list,
html[data-theme='dark'] .empty-state,
body[data-theme='dark'] .empty-state,
html[data-theme='dark'] .loading-state,
body[data-theme='dark'] .loading-state {
  color: #9fb0c7 !important;
  opacity: 1 !important;
}

html[data-theme='dark'] .stock-chip,
body[data-theme='dark'] .stock-chip,
html[data-theme='dark'] .blue-pill,
body[data-theme='dark'] .blue-pill {
  background: rgba(37, 99, 235, 0.2) !important;
  border-color: rgba(96, 165, 250, 0.36) !important;
  color: #bfdbfe !important;
}

html[data-theme='dark'] .pending-bar,
body[data-theme='dark'] .pending-bar,
html[data-theme='dark'] .promo-error,
body[data-theme='dark'] .promo-error {
  background: rgba(124, 45, 18, 0.24) !important;
  border-color: rgba(251, 146, 60, 0.38) !important;
  color: #fed7aa !important;
}

html[data-theme='dark'] .slide-checkout-wrapper,
body[data-theme='dark'] .slide-checkout-wrapper {
  background: linear-gradient(135deg, #0f172a 0%, #172554 100%) !important;
  border-color: rgba(96, 165, 250, 0.34) !important;
  box-shadow: inset 0 1px 0 rgba(148, 163, 184, 0.12) !important;
}

html[data-theme='dark'] .blue-hint,
body[data-theme='dark'] .blue-hint {
  color: #bfdbfe !important;
}

html[data-theme='dark'] .cart-icon-wrapper,
body[data-theme='dark'] .cart-icon-wrapper {
  background: rgba(15, 23, 42, 0.78) !important;
  border: 1px solid rgba(96, 165, 250, 0.24) !important;
  color: #e5edf8 !important;
}

html[data-theme='dark'] .cart-badge,
body[data-theme='dark'] .cart-badge {
  background: linear-gradient(135deg, #38bdf8 0%, #2563eb 100%) !important;
  color: #ffffff !important;
  border: 2px solid #020617 !important;
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.36) !important;
  text-shadow: none !important;
  opacity: 1 !important;
}

html[data-theme='dark'] .detail-overlay,
body[data-theme='dark'] .detail-overlay {
  background: rgba(2, 6, 23, 0.72) !important;
}

html[data-theme='dark'] .detail-sheet,
body[data-theme='dark'] .detail-sheet,
html[data-theme='dark'] .detail-box,
body[data-theme='dark'] .detail-box,
html[data-theme='dark'] .bonus-box,
body[data-theme='dark'] .bonus-box {
  background: linear-gradient(180deg, #030712 0%, #0f172a 100%) !important;
  border: 1px solid rgba(51, 65, 85, 0.94) !important;
  color: #e5edf8 !important;
  box-shadow: 0 -18px 36px rgba(0, 0, 0, 0.44) !important;
}

html[data-theme='dark'] .detail-sheet-head h3,
body[data-theme='dark'] .detail-sheet-head h3,
html[data-theme='dark'] .detail-box strong,
body[data-theme='dark'] .detail-box strong,
html[data-theme='dark'] .blue-detail-subtotal strong,
body[data-theme='dark'] .blue-detail-subtotal strong {
  color: #f8fafc !important;
}

html[data-theme='dark'] .detail-sheet-head p,
body[data-theme='dark'] .detail-sheet-head p,
html[data-theme='dark'] .detail-box span,
body[data-theme='dark'] .detail-box span,
html[data-theme='dark'] .blue-detail-subtotal span,
body[data-theme='dark'] .blue-detail-subtotal span {
  color: #9fb0c7 !important;
}

html[data-theme='dark'] .btn-delete-item,
body[data-theme='dark'] .btn-delete-item {
  background: rgba(127, 29, 29, 0.24) !important;
  color: #fca5a5 !important;
  border-color: rgba(239, 68, 68, 0.34) !important;
}

html[data-theme='dark'] .swal2-popup,
body[data-theme='dark'] .swal2-popup {
  background: #020617 !important;
  border: 1px solid rgba(51, 65, 85, 0.96) !important;
  color: #e5edf8 !important;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5) !important;
}

html[data-theme='dark'] .swal2-title,
body[data-theme='dark'] .swal2-title,
html[data-theme='dark'] .swal2-html-container,
body[data-theme='dark'] .swal2-html-container {
  color: #f8fafc !important;
}

html[data-theme='dark'] .swal2-validation-message,
body[data-theme='dark'] .swal2-validation-message {
  background: #111827 !important;
  color: #e5edf8 !important;
}

html[data-theme='dark'] .swal-stock-warning,
body[data-theme='dark'] .swal-stock-warning {
  background: rgba(124, 45, 18, 0.22) !important;
  border: 1px solid rgba(251, 146, 60, 0.42) !important;
  color: #fed7aa !important;
}

html[data-theme='dark'] .swal-stock-warning b,
body[data-theme='dark'] .swal-stock-warning b {
  color: #ffedd5 !important;
}

html[data-theme='dark'] .swal-stock-warning-item,
body[data-theme='dark'] .swal-stock-warning-item,
html[data-theme='dark'] .swal-stock-warning-note,
body[data-theme='dark'] .swal-stock-warning-note,
html[data-theme='dark'] .swal-stock-warning small,
body[data-theme='dark'] .swal-stock-warning small {
  color: #fed7aa !important;
  opacity: 1 !important;
}
</style>


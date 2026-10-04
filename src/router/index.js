import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import Login from '@/views/Login.vue';
import Dashboard from '@/views/Dashboard.vue'
import JadwalKunjungan from '@/views/JadwalKunjungan.vue'
import CheckInKonfirmasi from '../views/CheckInKonfirmasi.vue';
import KunjunganAktif from '../views/KunjunganAktif.vue';
import HistoryPenjualan from '../views/HistoryPenjualan.vue';
import DetailPenjualan from '../views/DetailPenjualan.vue';
import Profile from '../views/Profile.vue';
import JadwalDiKunjungi from '../views/JadwalDiKunjungi.vue';
import KunjunganSelesai from '../views/KunjunganSelesai.vue';
import RegistrasiToko from '../views/RegistrasiToko.vue';
import CariToko from '../views/CariToko.vue';
import DetailToko from '../views/DetailToko.vue';
import EditToko from '../views/EditToko.vue';
import StockOpname from '../views/StockOpname.vue';
import TagihanCustomer from '../views/TagihanCustomer.vue';
import TagihanDetail from '../views/TagihanDetail.vue';
import SalesOrder from '../views/SalesOrder.vue';
import ReturPage from '../views/ReturPage.vue';
import PageStokOpname from '../views/PageStokOpname.vue';
import HistoryRetur from '../views/history-retur.vue';
import VisitHistoryHub from '../views/VisitHistoryHub.vue';
import PaymentHistory from '../views/PaymentHistory.vue';
import SalesCanvas from '../views/SalesCanvas.vue';
import LphPage from '../views/LphPage.vue';

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: Login },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  {
    path: '/jadwal',
    name: 'JadwalKunjungan',
    component: JadwalKunjungan,
    meta: { requiresAuth: true }
  },
  {
    path: '/checkin-konfirmasi',
    name: 'CekinKonfirmasi',
    component: CheckInKonfirmasi,
    meta: { requiresAuth: true }
  },
  {
    path: '/kunjungan-aktif',
    name: 'KunjunganAktif',
    component: KunjunganAktif,
    meta: { requiresAuth: true }
  },
  {
    path: '/history-toko',
    name: 'HistoryToko',
    component: HistoryPenjualan,
    meta: { requiresAuth: true }
  },
  {
    path: '/detail-penjualan',
    name: 'DetailPenjualan',
    component: DetailPenjualan,
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: Profile,
    meta: { requiresAuth: true }
  },
  {
    path: '/jadwal-dikunjungi',
    name: 'JadwalDiKunjungi',
    component: JadwalDiKunjungi,
    meta: { requiresAuth: true }
  },
  {
    path: '/kunjungan-selesai',
    name: 'KunjunganSelesai',
    component: KunjunganSelesai,
    meta: { requiresAuth: true }
  },
  {
    path: '/registrasi-toko',
    name: 'RegistrasiToko',
    component: RegistrasiToko,
    meta: { requiresAuth: true }
  },
  {
    path: '/cari-toko',
    name: 'CariToko',
    component: CariToko,
    meta: { requiresAuth: true }
  },
  {
    path: '/store-detail/:kode',
    name: 'DetailToko',
    component: DetailToko,
    meta: { requiresAuth: true }
  },
  {
    path: '/edit-toko/:kode',
    name: 'EditToko',
    component: EditToko,
    meta: { requiresAuth: true }
  },
  {
    path: '/stok-opname',
    name: 'StokOpname',
    component: StockOpname,
    meta: { requiresAuth: true }
  },
  {
    path: '/tagihan-customer',
    name: 'TagihanCustomer',
    component: TagihanCustomer,
    meta: { requiresAuth: true }
  },
  {
    path: '/history-detail',
    name: 'TagihanDetail',
    component: TagihanDetail,
    meta: { requiresAuth: true }
  },
  {
    path: '/sales-order',
    name: 'SalesOrder',
    component: SalesOrder,
    meta: { requiresAuth: true }
  },
  {
    path: '/payment',
    name: 'Payment',
    component: () => import('@/views/Payment.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/retur-page',
    name: 'ReturPage',
    component: ReturPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/pagestok-opname',
    name: 'PageStokOpname',
    component: PageStokOpname,
    meta: { requiresAuth: true }
  },
  {
    path: '/pageretur-barang',
    name: 'PageReturBarang',
    component: HistoryRetur,
    meta: { requiresAuth: true }
  },
  {
    path: '/visit-history',
    name: 'VisitHistoryHub',
    component: VisitHistoryHub,
    meta: { requiresAuth: true }
  },
  {
    path: '/payment-history',
    name: 'PaymentHistory',
    component: PaymentHistory,
    meta: { requiresAuth: true }
  },
  {
    path: '/lph',
    name: 'Lph',
    component: LphPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/sales-canvas',
    name: 'SalesCanvas',
    component: SalesCanvas,
    meta: { requiresAuth: true, requiresCanvasSales: true }
  },
  {
    path: '/sales-canvas-tagihan',
    name: 'SalesCanvasTagihan',
    // Keep older deep links working, but use the unified Canvas experience.
    // Tagihan is now a tab inside /sales-canvas rather than a separate menu.
    redirect: () => ({ path: '/sales-canvas', query: { mode: 'payment' } }),
    meta: { requiresAuth: true, requiresCanvasSales: true }
  }
]


const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // Selalu scroll ke atas
    return { top: 0, behavior: 'smooth' }
  },
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true;

  const auth = useAuthStore();

  const canAccessCanvas = () => {
    const type = String(auth.user?.nama_tipe_sales || '').trim().toLowerCase();
    return ['canvasser', 'canvaser', 'taking order - canvasser', 'taking order - canvaser'].includes(type);
  };

  // Jika user sudah ada di store, langsung lolos
  if (auth.user) return to.meta.requiresCanvasSales && !canAccessCanvas() ? '/dashboard' : true;

  // Coba restore dari Preferences (saat app reload / cold start)
  const isAuthenticated = await auth.checkAuth();
  if (isAuthenticated) return to.meta.requiresCanvasSales && !canAccessCanvas() ? '/dashboard' : true;

  // Tidak ada session → paksa ke login
  return '/login';
});

export default router;

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';
import { initDatabase } from '@/services/database';
import { useThemeStore } from '@/stores/theme';
import { offlineEnabled } from '@/config/runtime';
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

import {
  faChevronLeft,
  faChevronRight,
  faSearch,
  faStoreAlt,
  faHistory,
  faUserShield,
  faSignOutAlt,
  faMapMarkedAlt,
  faBoxOpen,
  faStickyNote,
  faCheckDouble,
  faExclamationTriangle,
  faBoxes,
  faCheck,
  faCheckCircle,
  faClipboardCheck,
  faClock,
  faCommentAlt,
  faDatabase,
  faFileInvoice,
  faFolderOpen,
  faInfoCircle,
  faLock,
  faMapMarkerAlt,
  faMoneyBillWave,
  faRotateRight,
  faSyncAlt,
  faTags,
  faTimesCircle,
  faAngleDoubleRight,
  faArrowLeft,
  faBox,
  faCalendarDay,
  faEdit,
  faFloppyDisk,
  faHome,
  faLocationArrow,
  faPhoneAlt,
  faPlus,
  faReceipt,
  faShoppingCart,
  faMoon,
  faSun,
  faTimes,
  faTrashAlt,
  faUpload
} from '@fortawesome/free-solid-svg-icons';

import {
  faClock as farClock
} from '@fortawesome/free-regular-svg-icons';

library.add(
  faChevronLeft, faChevronRight, faSearch, faStoreAlt,
  faHistory, faUserShield, faSignOutAlt, faMapMarkedAlt,
  faBoxOpen, faStickyNote, faCheckDouble, faExclamationTriangle,
  faBoxes, faCheck, faCheckCircle, faClipboardCheck,
  faClock, faCommentAlt, faDatabase, faFileInvoice,
  faFolderOpen, faInfoCircle, faLock, faMapMarkerAlt,
  faMoneyBillWave, faRotateRight, faSyncAlt, faTags,
  faTimesCircle, faAngleDoubleRight, faArrowLeft, faBox,
  faCalendarDay, faEdit, faFloppyDisk, faHome,
  faLocationArrow, faPhoneAlt, faPlus, faReceipt,
  faShoppingCart, faMoon, faSun, faTimes, faTrashAlt,
  faUpload,
  farClock
);

const bootstrapApp = async () => {
  const app = createApp(App);
  const pinia = createPinia();
  app.component('font-awesome-icon', FontAwesomeIcon);
  app.use(pinia);
  app.use(router);
  await useThemeStore(pinia).initTheme();
  app.mount('#app');
};

const startApp = async () => {
  try {
    if (offlineEnabled) {
      await initDatabase();
      console.log('Database lokal siap, memulai Vue...');
    } else {
      console.log('Mode online-only aktif, lewati inisialisasi database lokal.');
    }

    await bootstrapApp();
  } catch (error) {
    console.error('Gagal memulai aplikasi karena inisialisasi lokal:', error);
    await bootstrapApp();
  }
};

startApp();

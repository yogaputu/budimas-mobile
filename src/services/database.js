import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db = null;
let keepAliveInterval = null;

// =========================
// 🔧 FINALIZE CONNECTION
// =========================
const finalizeConnection = async (dbInstance) => {
  console.log('🔥 finalizeConnection masuk');

  const isOpen = await dbInstance.isDBOpen();

  if (!isOpen.result) {
    await dbInstance.open();
    console.log('📂 DB dibuka');
  }

  db = dbInstance;
  window.db = dbInstance;

  console.log('✅ window.db siap:', dbInstance);

  return dbInstance;
};

// =========================
// 🧩 SAFE ALTER TABLE / INDEX
// =========================
const safeAddColumn = async (table, column, type) => {
  try {
    const exists = await columnExists(db, table, column);

    if (!exists) {
      await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      console.log(`✅ Kolom ${column} ditambahkan ke ${table}`);
    }
  } catch (err) {
    console.warn(`⚠️ Gagal tambah kolom ${column}:`, err?.message || err);
  }
};

const columnExists = async (db, table, column) => {
  const res = await db.query(`PRAGMA table_info(${table})`);
  return (res.values || []).some((col) => col.name === column);
};

const safeAlter = async (sql) => {
  try {
    await db.execute(sql);
  } catch (err) {
    const msg = String(err?.message || err || '').toLowerCase();

    if (
      msg.includes('duplicate column name') ||
      msg.includes('already exists') ||
      msg.includes('duplicate') ||
      msg.includes('exists')
    ) {
      return;
    }

    console.warn('⚠️ ALTER/INDEX skipped:', sql, err?.message || err);
  }
};


// =========================
// 🧱 CREATE TABLES
// =========================
const createBaseTables = async () => {
  const tableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      qrcode TEXT UNIQUE,
      name TEXT,
      role TEXT,
      password TEXT
    );

    CREATE TABLE IF NOT EXISTS profile (
      kode TEXT PRIMARY KEY,
      nama TEXT,
      alamat TEXT,
      kota TEXT,
      nama_principle TEXT,
      type TEXT,
      telpon TEXT
    );

    CREATE TABLE IF NOT EXISTS stats (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS kunjungan_offline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_kunjungan TEXT,
      id_plafon TEXT,
      kode_toko TEXT,
      nama_toko TEXT,
      alasan TEXT,
      lat TEXT,
      lng TEXT,
      status TEXT,
      waktu_checkin DATETIME,
      waktu_checkout DATETIME,
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS kunjungan_toko (
      kode TEXT NOT NULL,
      nama TEXT,
      alamat TEXT,
      kota TEXT,
      telpon TEXT,
      latitude TEXT,
      longitude TEXT,
      id_plafon TEXT NOT NULL DEFAULT '',
      kode_plafon TEXT,
      kode_principal TEXT,
      nama_principal TEXT,
      id_kunjungan TEXT,
      is_visited INTEGER DEFAULT 0,
      is_checkout INTEGER DEFAULT 0,
      total_piutang REAL,
      sisa_plafon REAL,
      qrcode TEXT,
      alasan TEXT,
      local_modified INTEGER DEFAULT 0,
      updated_at_local DATETIME,
      PRIMARY KEY (kode, id_plafon)
    );

    CREATE TABLE IF NOT EXISTS sales_order_offline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE,
      id_kunjungan TEXT,
      kode_customer TEXT,
      nama_customer TEXT,
      tanggal TEXT,
      jatuh_tempo TEXT,
      total_penjualan REAL DEFAULT 0,
      items_json TEXT,
      status_sync TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS payment_offline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id TEXT UNIQUE,
      id_kunjungan TEXT,
      nota TEXT,
      kode_customer TEXT,
      nama_customer TEXT,
      total_bayar REAL DEFAULT 0,
      total_tagihan REAL DEFAULT 0,
      metode TEXT,
      no_bukti TEXT,
      status_pembayaran TEXT DEFAULT 'LUNAS',
      metadata_json TEXT,
      status_sync TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS retur_offline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      retur_id TEXT UNIQUE,
      id_kunjungan TEXT,
      kode_customer TEXT,
      nama_customer TEXT,
      total_retur REAL DEFAULT 0,
      items_json TEXT,
      status_sync TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS stock_opname_offline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opname_id TEXT UNIQUE,
      id_kunjungan TEXT,
      kode_customer TEXT,
      nama_customer TEXT,
      total_item INTEGER DEFAULT 0,
      items_json TEXT,
      status_sync TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS app_cache (
      cache_key TEXT PRIMARY KEY,
      payload_json TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_drafts (
      draft_key TEXT PRIMARY KEY,
      payload_json TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stok_master (
      kode TEXT PRIMARY KEY,
      nama TEXT,
      satuan TEXT,
      nama_unit TEXT,
      nama_brand TEXT,
      brand TEXT,
      harga REAL DEFAULT 0,
      suggestion REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

  `;

  await db.execute(tableQuery);
};

// =========================
// 🔐 MIGRASI IDENTITAS JADWAL
// =========================
// Satu customer dapat memiliki lebih dari satu plafon/principal. Sebelumnya
// `kode` menjadi primary key tunggal sehingga jadwal dan status antar-principal
// saling menimpa. SQLite tidak dapat mengubah primary key secara langsung,
// jadi tabel lama direkonstruksi sekali dengan primary key komposit.
const migrateKunjunganTokoScope = async () => {
  const info = await db.query('PRAGMA table_info(kunjungan_toko)');
  const primaryKeys = (info.values || [])
    .filter((column) => Number(column.pk) > 0)
    .sort((a, b) => Number(a.pk) - Number(b.pk))
    .map((column) => column.name);

  if (primaryKeys.length === 2 && primaryKeys[0] === 'kode' && primaryKeys[1] === 'id_plafon') {
    return;
  }

  console.log('🔄 Migrasi kunjungan_toko ke primary key customer + plafon');

  await db.execute(`
    DROP TABLE IF EXISTS kunjungan_toko_scoped;

    CREATE TABLE kunjungan_toko_scoped (
      kode TEXT NOT NULL,
      nama TEXT,
      alamat TEXT,
      kota TEXT,
      telpon TEXT,
      latitude TEXT,
      longitude TEXT,
      id_plafon TEXT NOT NULL DEFAULT '',
      kode_plafon TEXT,
      kode_principal TEXT,
      nama_principal TEXT,
      id_kunjungan TEXT,
      is_visited INTEGER DEFAULT 0,
      is_checkout INTEGER DEFAULT 0,
      total_piutang REAL,
      sisa_plafon REAL,
      qrcode TEXT,
      alasan TEXT,
      local_modified INTEGER DEFAULT 0,
      updated_at_local DATETIME,
      PRIMARY KEY (kode, id_plafon)
    );

    INSERT OR REPLACE INTO kunjungan_toko_scoped
    (kode, nama, alamat, kota, telpon, latitude, longitude, id_plafon,
     kode_plafon, kode_principal, nama_principal,
     id_kunjungan, is_visited, is_checkout, total_piutang, sisa_plafon,
     qrcode, alasan, local_modified, updated_at_local)
    SELECT
      kode, nama, alamat, kota, telpon, latitude, longitude,
      COALESCE(NULLIF(TRIM(id_plafon), ''), ''),
      '', '', '',
      id_kunjungan, is_visited, is_checkout, total_piutang, sisa_plafon,
      qrcode, alasan, local_modified, updated_at_local
    FROM kunjungan_toko;

    DROP TABLE kunjungan_toko;
    ALTER TABLE kunjungan_toko_scoped RENAME TO kunjungan_toko;
  `);
};

// =========================
// 🔄 MIGRATION EXISTING DB
// =========================
const migrateExistingTables = async () => {
  // =========================
  // kolom-kolom tabel
  // =========================

  // kunjungan_offline
  await safeAddColumn('kunjungan_offline', 'waktu_checkout', 'DATETIME');
  await safeAddColumn('kunjungan_offline', 'retry_count', 'INTEGER DEFAULT 0');
  await safeAddColumn('kunjungan_offline', 'last_error', 'TEXT');
  await safeAddColumn('kunjungan_offline', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  await safeAddColumn('kunjungan_offline', 'id_plafon', 'TEXT');

  // kunjungan_toko
  await safeAddColumn('kunjungan_toko', 'id_plafon', 'TEXT');
  await safeAddColumn('kunjungan_toko', 'local_modified', 'INTEGER DEFAULT 0');
  await safeAddColumn('kunjungan_toko', 'updated_at_local', 'DATETIME');
  await migrateKunjunganTokoScope();
  await safeAddColumn('kunjungan_toko', 'kode_plafon', 'TEXT');
  await safeAddColumn('kunjungan_toko', 'kode_principal', 'TEXT');
  await safeAddColumn('kunjungan_toko', 'nama_principal', 'TEXT');

  // sales_order_offline
  await safeAddColumn('sales_order_offline', 'retry_count', 'INTEGER DEFAULT 0');
  await safeAddColumn('sales_order_offline', 'last_error', 'TEXT');
  await safeAddColumn('sales_order_offline', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  await safeAddColumn('sales_order_offline', 'synced_at', 'DATETIME');

  // payment_offline
  await safeAddColumn('payment_offline', 'retry_count', 'INTEGER DEFAULT 0');
  await safeAddColumn('payment_offline', 'last_error', 'TEXT');
  await safeAddColumn('payment_offline', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  await safeAddColumn('payment_offline', 'synced_at', 'DATETIME');
  await safeAddColumn('payment_offline', 'metadata_json', 'TEXT');

  // retur_offline
  await safeAddColumn('retur_offline', 'retry_count', 'INTEGER DEFAULT 0');
  await safeAddColumn('retur_offline', 'last_error', 'TEXT');
  await safeAddColumn('retur_offline', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  await safeAddColumn('retur_offline', 'synced_at', 'DATETIME');

  // stock_opname_offline
  await safeAddColumn('stock_opname_offline', 'retry_count', 'INTEGER DEFAULT 0');
  await safeAddColumn('stock_opname_offline', 'last_error', 'TEXT');
  await safeAddColumn('stock_opname_offline', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  await safeAddColumn('stock_opname_offline', 'synced_at', 'DATETIME');

  // stok_master
  await safeAddColumn('stok_master', 'nama_brand', 'TEXT');
  await safeAddColumn('stok_master', 'brand', 'TEXT');
  await safeAddColumn('stok_master', 'harga', 'REAL DEFAULT 0');
  await safeAddColumn('stok_master', 'suggestion', 'REAL DEFAULT 0');
  await safeAddColumn('stok_master', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

  // =========================
  // index
  // =========================
  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_kunjungan_offline_status ON kunjungan_offline(status)`);
  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_kunjungan_offline_kode ON kunjungan_offline(kode_toko)`);
  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_kunjungan_offline_scope ON kunjungan_offline(kode_toko, id_plafon)`);
  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_kunjungan_toko_visit ON kunjungan_toko(is_visited, is_checkout)`);

  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_sales_order_offline_status ON sales_order_offline(status_sync)`);
  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_sales_order_offline_customer ON sales_order_offline(kode_customer)`);

  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_payment_offline_status ON payment_offline(status_sync)`);
  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_payment_offline_customer ON payment_offline(kode_customer)`);
  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_payment_offline_nota ON payment_offline(nota)`);

  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_retur_offline_status ON retur_offline(status_sync)`);
  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_retur_offline_customer ON retur_offline(kode_customer)`);

  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_stock_opname_offline_status ON stock_opname_offline(status_sync)`);
  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_stock_opname_offline_customer ON stock_opname_offline(kode_customer)`);
  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_stock_opname_offline_kunjungan ON stock_opname_offline(id_kunjungan)`);

  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_app_cache_updated ON app_cache(updated_at)`);
  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_app_drafts_updated ON app_drafts(updated_at)`);

  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_stok_master_nama ON stok_master(nama)`);
  await safeAlter(`CREATE INDEX IF NOT EXISTS idx_stok_master_brand ON stok_master(nama_brand)`);
};

// =========================
// 🚀 INIT DATABASE
// =========================
export const initDatabase = async () => {
  const dbName = 'pos_database';

  console.log('🚀 INIT DATABASE START');
  console.log('📱 Platform:', Capacitor.getPlatform());

  try {
    if (Capacitor.getPlatform() === 'web') {
      console.warn('❌ SQLite tidak jalan di web');

      db = {
        query: async () => ({ values: [] }),
        run: async () => {},
        execute: async () => {}
      };
      window.db = db;

      return db;
    }

    let connection;

    try {
      console.log('🔗 coba retrieveConnection...');
      connection = await sqlite.retrieveConnection(dbName, false);
    } catch (e) {
      console.log('🆕 retrieve gagal → createConnection');
      connection = await sqlite.createConnection(
        dbName,
        false,
        'no-encryption',
        1,
        false
      );
    }

    await finalizeConnection(connection);

    await createBaseTables();
    await migrateExistingTables();

    console.log('🚀 Database siap!');

    await db.query('SELECT name FROM sqlite_master');

    if (!keepAliveInterval) {
      keepAliveInterval = setInterval(async () => {
        try {
          if (db) {
            await db.query('SELECT 1');
          }
        } catch (err) {
          console.log('⚠️ keep alive error:', err.message);
        }
      }, 30000); // 30 detik, bukan 3 detik (hemat baterai)
    }

    return db;
  } catch (error) {
    console.error('❌ INIT DB ERROR:', error);

    db = {
      query: async () => ({ values: [] }),
      run: async () => {},
      execute: async () => {}
    };
    window.db = db;

    return db;
  }
};

// =========================
// 📥 GET DB INSTANCE
// =========================
export const getDb = () => db;

// =========================
// 🧪 DEBUG QUERY
// =========================
export const debugQuery = async (sql, params = []) => {
  try {
    if (!db) throw new Error('DB belum init');

    const res = await db.query(sql, params);
    console.log('🧪 RESULT:', res.values);
    return res.values;
  } catch (err) {
    console.error('❌ QUERY ERROR:', err);
    return [];
  }
};

// =========================
// 💾 CACHE HELPER
// =========================
export const saveCache = async (cacheKey, payload) => {
  try {
    if (!db) return false;

    await db.run(
      `
      INSERT OR REPLACE INTO app_cache (cache_key, payload_json, updated_at)
      VALUES (?, ?, ?)
      `,
      [cacheKey, JSON.stringify(payload ?? null), new Date().toISOString()]
    );

    return true;
  } catch (err) {
    console.error('❌ saveCache error:', err);
    return false;
  }
};

export const getCache = async (cacheKey) => {
  try {
    if (!db) return null;

    const res = await db.query(
      `SELECT payload_json FROM app_cache WHERE cache_key = ? LIMIT 1`,
      [cacheKey]
    );

    const raw = res.values?.[0]?.payload_json;
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('❌ getCache error:', err);
    return null;
  }
};

export const deleteCache = async (cacheKey) => {
  try {
    if (!db) return false;

    await db.run(`DELETE FROM app_cache WHERE cache_key = ?`, [cacheKey]);
    return true;
  } catch (err) {
    console.error('❌ deleteCache error:', err);
    return false;
  }
};

// =========================
// 📝 DRAFT HELPER
// =========================
export const saveDraft = async (draftKey, payload) => {
  try {
    if (!db) return false;

    await db.run(
      `
      INSERT OR REPLACE INTO app_drafts (draft_key, payload_json, updated_at)
      VALUES (?, ?, ?)
      `,
      [draftKey, JSON.stringify(payload ?? null), new Date().toISOString()]
    );

    return true;
  } catch (err) {
    console.error('❌ saveDraft error:', err);
    return false;
  }
};

export const getDraft = async (draftKey) => {
  try {
    if (!db) return null;

    const res = await db.query(
      `SELECT payload_json FROM app_drafts WHERE draft_key = ? LIMIT 1`,
      [draftKey]
    );

    const raw = res.values?.[0]?.payload_json;
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('❌ getDraft error:', err);
    return null;
  }
};

export const deleteDraft = async (draftKey) => {
  try {
    if (!db) return false;

    await db.run(`DELETE FROM app_drafts WHERE draft_key = ?`, [draftKey]);
    return true;
  } catch (err) {
    console.error('❌ deleteDraft error:', err);
    return false;
  }
};

// =========================
// 📦 GENERIC OFFLINE QUEUE HELPER
// =========================
export const insertStockOpnameOffline = async (payload) => {
  try {
    if (!db) return false;

    await db.run(
      `
      INSERT OR REPLACE INTO stock_opname_offline
      (opname_id, id_kunjungan, kode_customer, nama_customer, total_item, items_json, status_sync, retry_count, last_error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?)
      `,
      [
        payload.opname_id,
        payload.id_kunjungan || '',
        payload.kode_customer || '',
        payload.nama_customer || '',
        Number(payload.total_item || 0),
        JSON.stringify(payload.items || []),
        payload.created_at || new Date().toISOString()
      ]
    );

    return true;
  } catch (err) {
    console.error('❌ insertStockOpnameOffline error:', err);
    return false;
  }
};

export const getPendingStockOpname = async () => {
  try {
    if (!db) return [];

    const res = await db.query(
      `
      SELECT *
      FROM stock_opname_offline
      WHERE status_sync = 'pending'
      ORDER BY id ASC
      `
    );

    return res.values || [];
  } catch (err) {
    console.error('❌ getPendingStockOpname error:', err);
    return [];
  }
};

// =========================
// 🛑 STOP KEEP ALIVE
// =========================
export const stopKeepAlive = () => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('🛑 Keep alive dihentikan');
  }
};

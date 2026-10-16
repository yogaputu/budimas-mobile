// Local, synthetic data only. Never call the production ERP during a UI test.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.FRONTEND_TEST_ORIGIN || 'http://127.0.0.1:5175';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.UI_SCREENSHOT_DIR || '/tmp/budimas-sales-ui';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
const errors = [], writes = [];
const longInvoice = 'NPBMMSLO-261000000013';
const customer = 'TOKO MAKMUR BERSAMA CABANG SURAKARTA';
const workflowRow = { id: 1, kode_lph: 'LPH/BMM/20261015/0001', tanggal_lph: '2026-10-15', status_dokumen: 'AKTIF', payment_workflow_version: 2 };
const query = '?kode_customer=C1&nama_toko=' + encodeURIComponent(customer) + '&id_kunjungan=11&id_plafon=1';
const routes = [
  ['/dashboard', 'dashboard', '.sub-menu-grid'],
  ['/lph-kuitansi', 'lph-list', '.document-card'],
  ['/lph', 'lph-legacy', '.workflow-entry'],
  ['/visit-history' + query, 'history', '.menu-grid'],
  ['/payment-history' + query, 'payments', '.sales-record-card'],
  ['/sales-canvas', 'canvas', '.canvas-content'],
  ['/profile', 'profile', '.sales-kv-list'],
];
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme });
    await context.addInitScript(({ theme }) => {
      localStorage.setItem('CapacitorStorage.auth_token', 'mock-only');
      if (!localStorage.getItem('CapacitorStorage.user_data')) localStorage.setItem('CapacitorStorage.user_data', JSON.stringify({ id: 3, id_user: 3, id_sales: 1, nama: 'Sales Test', nama_tipe_sales: 'canvasser' }));
      localStorage.setItem('CapacitorStorage.budimas-mobile-theme', theme);
    }, { theme });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith('/api/')) return url.origin === origin ? route.continue() : route.abort();
      if (route.request().method() !== 'GET') {
        writes.push(url.pathname);
        return route.fulfill({ status: 409, json: { message: 'UI audit must not write transactions.' } });
      }
      let data = [];
      if (url.pathname.endsWith('/profile/me')) data = { Nama: 'SEPTIYANI DU', Kode: 'S001', NamaPrinciple: 'Budimas Solo', JenisITR: 'Sales Canvas', Kota: 'Surakarta', Type: 'Sales' };
      else if (url.pathname.endsWith('/cancheckin')) data = { can_checkin: true };
      else if (url.pathname.endsWith('/statistik/sales_target')) data = { TargetSales: 50000000 };
      else if (url.pathname.endsWith('/statistik/sales_atmd')) data = { ValueOrder: 20000000, ValueFaktur: 18000000, CP: 20, AT: 12, ECO: 10, ECF: 60 };
      else if (url.pathname.endsWith('/mobile/workflow/lphs')) data = { data: [workflowRow] };
      else if (url.pathname.endsWith('/mobile/workflow/lphs/1')) data = { data: { ...workflowRow, invoices: [{ id: 7, no_faktur: longInvoice, nama_customer: customer, remaining: '25000000.00' }], claims: [{ id: 1, id_faktur: 7, method: 'CASH', amount: '1250000' }], checked_details: [], handover: null } };
      else if (url.pathname.endsWith('/mobile/workflow/collection-options')) data = { data: { customers:[{id:1,kode:'C1',nama:customer}],invoices:[],has_more_customers:false } };
      else if (url.pathname.endsWith('/mobile/workflow/collections')) data = { data:{rows:[],has_more:false,legacy_setoran_customer_ids:[]} };
      else if (url.pathname === '/api/lph') data = { data: [{ id_lph: 2, kode_lph: 'LPH-LAMA-001', tanggal_lph: '2026-10-14', status_dokumen: 'DIKEMBALIKAN', status_label: 'Dikembalikan', jumlah_faktur: 3, total_faktur: 1250000 }] };
      else if (url.pathname.endsWith('/kunjungan/alasan-history')) data = { items: [{ id: 1, alasan: 'Toko tutup sementara', created_at: '2026-10-14 09:00:00' }] };
      else if (url.pathname.endsWith('/payment/history')) data = [{ id: 1, id_sales_order: 1, nota: longInvoice, total_bayar: 1250000, sisa_tagihan: 23750000, metode: 'Tunai', no_bukti: 'CS/BMM/20261015/0001', status: 'Menunggu approval', created_at: '2026-10-15 09:15:00' }];
      else if (url.pathname.endsWith('/sales-canvas/principals')) data = [{ id_principal: 1, nama_principal: 'Principal Test', kode_principal: 'P1', is_primary: true }];
      else if (url.pathname.endsWith('/sales-canvas/all-canvas-request')) data = [{ id: 41, tanggal_request: '2026-10-15', total_request: 1250000, status: 1 }];
      else if (url.pathname.endsWith('/sales-canvas/detail-canvas-request')) data = [{ id: 1, nama_produk: 'Produk Test Canvas', qty_uom1: 7, qty_uom3: 3, uom1_nama: 'PCS', uom3_nama: 'CT', total_permintaan: 1250000 }];
      return route.fulfill({ json: data });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error' && msg.text().includes('Could not find one or more icon')) errors.push(msg.text()); });
    for (const [path, name, ready] of routes) {
      await page.goto(origin + path);
      await page.locator(ready).first().waitFor();
      if (name === 'dashboard') await page.getByRole('button', { name: /LPH.*Terima/ }).waitFor();
      await page.screenshot({ path: `${output}/${name}-${theme}.png`, fullPage: true });
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}/${theme}/${width}: horizontal overflow`);
        assert.ok(await page.evaluate(() => [document.documentElement, document.body].every(e => getComputedStyle(e).borderTopWidth === '0px')), `${name}: card theme leaked onto the document`);
        const header = page.locator('.sales-header').first();
        if (await header.count()) {
          assert.ok((await header.boundingBox()).y < 2, `${name}: header must start at the top`);
          assert.equal(await header.locator('h1,h3').first().evaluate(e => getComputedStyle(e).color), 'rgb(255, 255, 255)');
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      if (name === 'lph-list') {
        await page.getByRole('button', { name: /LPH\/BMM/ }).click();
        await page.getByRole('button', { name: 'Buka Pembayaran', exact:true }).waitFor();
        assert.equal(await page.getByLabel('Nominal (Rp)', { exact:true }).count(),0);
        await page.screenshot({ path: `${output}/lph-detail-${theme}.png`, fullPage: true });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.getByRole('button', { name: 'Kembalikan LPH', exact: true }).click();
        await page.getByLabel('Bagian cash yang ditransfer (Rp)', { exact: true }).fill('250000');
        await page.screenshot({ path: `${output}/lph-return-${theme}.png`, fullPage: true });
      }
      if (name === 'canvas') {
        for (const mode of ['Order', 'Tagihan', 'Retur', 'Riwayat', 'Request']) {
          await page.locator('.segmented').getByRole('button', { name: mode, exact: true }).click();
          await page.locator('.segmented button.active').filter({ hasText: mode }).waitFor();
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Canvas ${mode} overflow`);
        }
        await page.getByRole('button', { name: /Request Hari Ini/ }).click();
        await page.getByRole('dialog').getByRole('button', { name: /Request #41/ }).click();
        await page.getByText('Produk Test Canvas', { exact: true }).waitFor();
        await page.screenshot({ path: `${output}/canvas-modal-${theme}.png`, fullPage: true });
        const modalColors = await page.getByRole('dialog').evaluate(e => ({ bg: getComputedStyle(e).backgroundColor, color: getComputedStyle(e).color }));
        assert.notEqual(modalColors.bg, modalColors.color);
        assert.equal(modalColors.bg, theme === 'dark' ? 'rgb(3, 7, 18)' : 'rgb(255, 255, 255)');
        await page.getByRole('button', { name: 'Tutup', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'detached' });
      }
    }
    // Smoke the transaction pages affected only by the scoped-theme repair.
    for (const [path, ready] of [
      ['/sales-order' + query, '.so-container'],
      ['/retur-page' + query, '.so-container'],
      ['/stok-opname' + query, '.stock-opname-container'],
      ['/tagihan-customer' + query, '.sales-v2'],
      ['/payment' + query, '.sales-collection-page'],
      ['/jadwal', '.enterprise-jadwal-container'],
      ['/jadwal-dikunjungi', '.enterprise-jadwal-container'],
    ]) {
      await page.goto(origin + path);
      await page.locator(ready).first().waitFor();
      assert.ok(await page.evaluate(() => [document.documentElement, document.body].every(e => getComputedStyle(e).borderTopWidth === '0px')), `${path}: root border regression`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path}: viewport overflow`);
    }
    // Navigation still uses the existing handlers; Canvas remains role restricted.
    await page.goto(origin + '/dashboard');
    await page.getByRole('button', { name: /LPH.*Terima/ }).click();
    await page.waitForURL('**/lph-kuitansi');
    await page.goto(origin + '/visit-history' + query);
    await page.getByRole('button', { name: /Riwayat Pembayaran/ }).click();
    await page.waitForURL('**/payment-history?**');
    assert.equal(new URL(page.url()).searchParams.get('kode_customer'), 'C1');
    await page.evaluate(() => localStorage.setItem('CapacitorStorage.user_data', JSON.stringify({ id: 3, id_sales: 1, nama_tipe_sales: 'taking order' })));
    await page.goto(origin + '/sales-canvas');
    await page.waitForURL('**/dashboard');
    assert.equal(await page.getByRole('button', { name: /Sales Canvas/ }).count(), 0);
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log('PASS UI: 7 refreshed menus × light/dark × 320/390/768px + 7 transaction/menu smoke checks; claim/return forms, 5 Canvas tabs + modal, navigation and Canvas permission guard; no writes.');
} finally { await browser.close(); }

import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.FRONTEND_TEST_ORIGIN || 'http://127.0.0.1:5176';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
try {
 const page = await browser.newPage({viewport:{width:390,height:844}}), errors=[], writes=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('CapacitorStorage.auth_token','mock-only');localStorage.setItem('CapacitorStorage.user_data',JSON.stringify({id:3,id_user:3,id_sales:1,nama:'Sales Test'}));});
 const row={id:1,kode_lph:'LPH-TEST',status_dokumen:'MENUNGGU_PENERIMAAN',payment_workflow_version:2};
 const detail={...row,invoices:[{id:7,no_faktur:'F-TEST',nama_customer:'Toko Test',remaining:'1000.00'}],checked_details:[{id:11,id_faktur:7},{id:12,id_faktur:7}],claims:[],handover:null};
 await page.route('**/*',async route=>{
   const u=new URL(route.request().url()), method=route.request().method();
   if(u.pathname.startsWith('/api/')) {
    let data=[];
    if(u.pathname.endsWith('/workflow/lphs'))data=[row];
    if(u.pathname.endsWith('/workflow/lphs/1'))data=detail;
    if(method==='POST') {
     const payload=route.request().postDataJSON();writes.push({path:u.pathname,payload});
     if(u.pathname.endsWith('/accept')) {assert.deepEqual(payload.checked_detail_ids,[11,12]);row.status_dokumen=detail.status_dokumen='AKTIF';}
     if(u.pathname.endsWith('/claims')) {assert.equal(payload.amount,1000);detail.claims.push({id:1,id_faktur:7,...payload});}
     if(u.pathname.endsWith('/return')) {assert.equal(payload.cash_transfer,250);row.status_dokumen=detail.status_dokumen='DIKEMBALIKAN';detail.handover={cash_transfer:250,cash_to_cashier:750};}
    }
    return route.fulfill({json:{data}});
   }
   if(u.origin!==new URL(origin).origin)return route.abort();
   return route.continue();
 });
 await page.goto(origin+'/lph-kuitansi');
 await page.getByRole('button',{name:/LPH-TEST/}).click();
 assert.equal(await page.getByRole('button',{name:'Terima LPH',exact:true}).isDisabled(),false);
 await page.locator('input[type=checkbox]').uncheck();
 assert.equal(await page.getByRole('button',{name:'Terima LPH',exact:true}).isDisabled(),true);
 await page.locator('input[type=checkbox]').check();
 await page.getByRole('button',{name:'Terima LPH',exact:true}).click();
 await page.getByLabel('Faktur',{exact:false}).selectOption('7');
 await page.getByLabel('Nominal (Rp)',{exact:true}).fill('1000');
 await page.getByRole('button',{name:'Simpan Klaim',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Klaim tercatat'}).waitFor();
 await page.getByRole('button',{name:'Kembalikan LPH',exact:true}).click();
 await page.getByRole('definition').filter({hasText:/1\.000/}).first().waitFor();
 await page.getByText('Total Uang Diperoleh',{exact:true}).waitFor();
 await page.getByLabel('Bagian cash yang ditransfer (Rp)',{exact:true}).fill('250');
 await page.screenshot({path:process.env.PAYMENT_MOBILE_SCREENSHOT || '/tmp/budimas-payment-demo-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Konfirmasi Pengembalian',exact:true}).click();
 await page.getByRole('status').filter({hasText:'LPH dikembalikan'}).waitFor();
 assert.equal(writes.length,3);assert.deepEqual(errors,[]);
 // Chromium can round fractional layout bounds outward by one pixel.
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth + 1));
 console.log('PASS mobile accept → claim → return, checked detail IDs, exact cash split and narrow viewport');
} finally {await browser.close();}

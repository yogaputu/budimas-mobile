// Synthetic requests only, including writes. Never let requests reach ERP.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.FRONTEND_TEST_ORIGIN||'http://127.0.0.1:5177';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
let checks=0;
try {
 for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});
  await context.addInitScript(theme=>{
   localStorage.setItem('CapacitorStorage.auth_token','mock-only');
   localStorage.setItem('CapacitorStorage.user_data',JSON.stringify({id:3,id_user:3,id_sales:1,nama:'Sales Test',nama_tipe_sales:'sales'}));
   localStorage.setItem('CapacitorStorage.budimas-mobile-theme',theme);
  },theme);
  const lph={id:1,kode_lph:'LPH/BMM/20261015/0001',tanggal_lph:'2026-10-15',status_dokumen:'MENUNGGU_PENERIMAAN',payment_workflow_version:2};
  const customers=[{id:1,kode:'C1',nama:'TOKO MAKMUR BERSAMA CABANG SURAKARTA'},{id:2,kode:'C2',nama:'Toko Kedua'},{id:3,kode:'C1',nama:'Kode sama, customer berbeda'}];
  const invoice={id:7,id_lph:1,id_customer:1,no_faktur:'NPBMMSLO-261000000013',kode_lph:lph.kode_lph,remaining:'1000.00',available_to_collect:'1000.00',pending_amount:0};
  const claims=[],writes=[],errors=[];let failNext=false;
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;
   if(!path.startsWith('/api/'))return url.origin===origin?route.continue():route.abort();
   let data=[];
   if(path.endsWith('/profile/me'))data={Nama:'Sales Test',Kode:'S001',NamaPrinciple:'Budimas Solo',JenisITR:'Sales',Kota:'Solo',Alamat:'Jl. Test',Type:'Sales'};
   else if(path.endsWith('/cancheckin'))data={can_checkin:true};
   else if(path.endsWith('/sales_target'))data={TargetSales:50000000};
   else if(path.endsWith('/sales_atmd'))data={ValueOrder:20000000,ValueFaktur:18000000,CP:20,AT:12,ECO:10,ECF:60};
   else if(path.endsWith('/collection-options')) {
    const selected=url.searchParams.get('kode_customer'),visit=url.searchParams.get('id_kunjungan'),selectedId=url.searchParams.get('id_customer');
    const customerRows=visit?customers.filter(c=>c.id===1):customers.filter(c=>(!selected||c.kode===selected)&&(!selectedId||String(c.id)===selectedId));
    data={data:{customers:customerRows,has_more_customers:false,invoices:lph.status_dokumen==='AKTIF'&&((selected==='C1'&&selectedId==='1')||visit)?[{...invoice,available_to_collect:String(1000-claims.reduce((s,c)=>s+c.amount,0)),pending_amount:claims.reduce((s,c)=>s+c.amount,0)}]:[]}};
   } else if(path.endsWith('/workflow/lphs'))data={data:[lph]};
   else if(path.endsWith('/workflow/lphs/1'))data={data:{...lph,invoices:[{...invoice,nama_customer:customers[0].nama}],claims,checked_details:[{id:11,id_faktur:7}],handover:null}};
   else if(path.endsWith('/workflow/collections'))data={data:{rows:claims.map(c=>({...c,no_faktur:invoice.no_faktur,kode_lph:lph.kode_lph,receipt_status:'PENDING',created_at:'2026-10-15T09:00:00'})),legacy_setoran_customer_ids:[99],has_more:false}};
   else if(path.endsWith('/payment/history'))data=[{id:99,nota:invoice.no_faktur,total_bayar:9999,created_at:'2026-10-15T09:00:00'},{id:42,nota:'LEGACY-42',total_bayar:100,metode:'TUNAI',status:'Sebagian',created_at:'2026-10-14T09:00:00'}];
   else if(path.endsWith('/history/by-customer'))data=[{Nota:'SO-TEST-01',Tanggal:'2026-10-15 09:00:00',NamaCustomer:customers[0].nama,KodeCustomer:'C1',TotalPenjualan:110000,StatusOrder:1}];
   else if(path.endsWith('/retur/history'))data=[{Nota:'RET-TEST-01',Tanggal:'2026-10-15 09:00:00',NamaStok:'Produk Retur Test',KodeStok:'P1',TotalRetur:55000,Jumlah:5,Approve:'Y',StatusBarangRetur:'Diterima',Keterangan:'Kemasan rusak'}];
   else if(path.endsWith('/tagihan/customer'))data=[{Nota:invoice.no_faktur,Piutang:1000,NamaPrinciple:'Principal Test',JatuhTempo:'2026-10-10',is_lph:true,status_dokumen:'AKTIF'}];
   if(req.method()==='POST'){
    const payload=req.postDataJSON();writes.push({path,payload});
    if(path.endsWith('/accept')){assert.deepEqual(payload.checked_detail_ids,[11]);lph.status_dokumen='AKTIF';data={data:lph};}
    else if(path.endsWith('/claims')){
     if(failNext){failNext=false;return route.fulfill({status:503,json:{message:'Jaringan uji gagal. Coba ulang.'}});}
     assert.ok(payload.amount>0&&payload.amount<=1000-claims.reduce((s,c)=>s+c.amount,0));
     claims.push({id:claims.length+1,...payload});data={data:claims.at(-1)};
    }else if(path.endsWith('/return')){assert.equal(payload.cash_transfer,50);lph.status_dokumen='DIKEMBALIKAN';data={data:lph};}
    else return route.fulfill({status:409,json:{message:'Unexpected write in UI test'}});
   }
   return route.fulfill({json:data});
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR:',e.message);});
  page.on('console',message=>{if(/was accessed during render but is not defined|Failed to resolve component|Could not find one or more icon/.test(message.text()))errors.push(message.text());});
  async function responsive(name){for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name}/${theme}/${width}: overflow`);checks++;}await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:`/tmp/budimas-sales-${name}-${theme}.png`,fullPage:true,animations:'disabled'});}
  await page.goto(origin+'/dashboard');await page.getByRole('button',{name:/Pembayaran Catat/}).waitFor();await responsive('beranda');
  await page.getByRole('button',{name:/Pembayaran Catat/}).click();await page.waitForURL('**/payment');await page.getByLabel('Customer',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Customer',{exact:true}).inputValue(),'');checks++;
  await page.goto(origin+'/lph-kuitansi');await page.getByRole('button',{name:/LPH\/BMM/}).click();
  await page.getByRole('button',{name:'Terima LPH',exact:true}).click();await page.getByRole('button',{name:'Buka Pembayaran',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Nominal (Rp)',{exact:true}).count(),0);checks++;
  await page.getByRole('button',{name:'Buka Pembayaran',exact:true}).click();await page.getByLabel('Customer',{exact:true}).selectOption('3');
  await page.getByText(/Belum ada faktur customer/).waitFor();assert.equal(await page.getByLabel('Faktur dari LPH aktif',{exact:true}).locator('option').count(),1);checks++;
  await page.getByLabel('Customer',{exact:true}).selectOption('1');
  await page.getByLabel('Faktur dari LPH aktif',{exact:true}).selectOption('1:7');await page.getByLabel('Nominal (Rp)',{exact:true}).fill('250');
  failNext=true;await page.getByRole('button',{name:'Simpan Penerimaan',exact:true}).click();await page.getByRole('alert').filter({hasText:'Jaringan uji gagal'}).waitFor();
  const firstKey=writes.at(-1).payload.client_key;assert.equal(await page.getByLabel('Nominal (Rp)',{exact:true}).inputValue(),'250');
  await page.getByRole('button',{name:'Simpan Penerimaan',exact:true}).click();await page.getByRole('status').filter({hasText:'Penerimaan tercatat'}).waitFor();
  assert.equal(writes.at(-1).payload.client_key,firstKey);assert.equal(claims[0].entry_origin,'OUTSIDE_CALL_PLAN');assert.equal(claims[0].id_kunjungan,null);checks+=4;
  const query='?kode_customer=C1&nama_toko='+encodeURIComponent(customers[0].nama)+'&id_kunjungan=11&id_plafon=1';
  await page.goto(origin+'/payment'+query);await page.getByLabel('Faktur dari LPH aktif',{exact:true}).selectOption('1:7');assert.equal(await page.getByLabel('Customer',{exact:true}).count(),0);
  await page.getByLabel('Metode',{exact:true}).selectOption('TRANSFER');await page.getByLabel('Nominal (Rp)',{exact:true}).fill('100');await page.getByLabel('Referensi / bukti transfer',{exact:true}).fill('TRF-TEST');
  await responsive('pembayaran');await page.getByRole('button',{name:'Simpan Penerimaan',exact:true}).click();await page.getByRole('status').filter({hasText:'Penerimaan tercatat'}).waitFor();assert.equal(claims[1].entry_origin,'CALL_PLAN');assert.equal(claims[1].id_kunjungan,11);checks+=3;
  await page.getByLabel('Faktur dari LPH aktif',{exact:true}).selectOption('1:7');await page.getByLabel('Metode',{exact:true}).selectOption('GIRO');await page.getByLabel('Nominal (Rp)',{exact:true}).fill('75');await page.getByLabel('Nomor giro',{exact:true}).fill('BG1');await page.getByLabel('Bank',{exact:true}).fill('Bank Test');await page.getByLabel('Jatuh tempo',{exact:true}).fill('2026-11-01');await page.getByRole('button',{name:'Simpan Penerimaan',exact:true}).click();await page.getByRole('status').filter({hasText:'Penerimaan tercatat'}).waitFor();checks++;
  await page.goto(origin+'/payment-history'+query);await page.getByText('LEGACY-42',{exact:true}).waitFor();await page.locator('.sales-record-card').nth(3).waitFor();assert.equal(await page.locator('.sales-record-card').count(),4);await page.getByText('Di luar kunjungan',{exact:true}).waitFor();await responsive('riwayat-pembayaran');checks++;
  for(const [path,name,needle] of [['/history-toko','riwayat-order','SO-TEST-01'],['/pageretur-barang','riwayat-retur','RET-TEST-01'],['/tagihan-customer','invoice',invoice.no_faktur]]){
   await page.goto(origin+path+query);await page.getByText(needle,{exact:true}).waitFor();await responsive(name);
   await page.getByRole('searchbox').fill('TIDAK-ADA');await page.getByText(/Tidak ada .*cocok/).waitFor();checks++;
  }
  await page.goto(origin+'/profile');await page.getByRole('heading',{name:'Sales Test',exact:true}).waitFor();await responsive('profile');
  await page.goto(origin+'/lph-kuitansi');await page.getByRole('button',{name:/LPH\/BMM/}).click();await page.getByRole('button',{name:'Kembalikan LPH',exact:true}).click();await page.getByLabel('Bagian cash yang ditransfer (Rp)',{exact:true}).fill('50');await page.getByRole('button',{name:'Konfirmasi Pengembalian',exact:true}).click();await page.getByRole('status').filter({hasText:'LPH dikembalikan'}).waitFor();checks++;
  await page.goto(origin+'/payment'+query);await page.getByText(/Belum ada faktur customer/).waitFor();assert.equal(await page.getByRole('button',{name:'Simpan Penerimaan',exact:true}).count(),0);checks++;
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS '+checks+' checks: compact home/profile/history, both payment entry points, retry UUID, transfer/giro, exact legacy deduplication, LPH accept/return and 320/390/768px light/dark.');
}finally{await browser.close();}

// Mocked browser regression; every API request is intercepted.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
try {
const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(15000);const errors=[],reads=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('CapacitorStorage.auth_token','mock-only');localStorage.setItem('CapacitorStorage.user_data',JSON.stringify({id:3,id_user:3,id_sales:1,nama:'Sales Test'}));});
await page.route('**/*',async route=>{
const url=new URL(route.request().url());if(url.pathname.startsWith('/api/')) {let data=[];
if(url.pathname.endsWith('/customer/order-context')) {reads.push(url);data={id_customer:1,id_plafon:1,id_cabang:1,id_perusahaan:1,Kode:'C1',Nama:'Toko',Plafon:2000000,SisaPlafon:650000,Piutang:320000,piutang_scope:'customer_company',PlafonTerm:24};}
else if(url.pathname.includes('/stok/principal-tabs'))data=[{id_principal:1,nama_principal:'Principal'}];
else if(url.pathname.includes('/stok/history-order')||url.pathname.includes('/stok/kategori'))data=[{id_produk:1,Kode:'SKU1',Nama:'Produk',StokReady:60,StokWmsReady:60,StokAkhir:10,HargaE:100,Uom1Label:'PCS',hasUom1:true,hasUom2:false,hasUom3:false}];
return route.fulfill({json:data});
}if(url.origin!=='http://127.0.0.1:5175')return route.abort();return route.continue();
});
await page.goto('http://127.0.0.1:5175/sales-order?id_plafon=1&kode_customer=C1&id_kunjungan=11&sisa_plafon=0&plafon_term=0');
await page.getByText('Stok Ready 60 PCS',{exact:true}).waitFor();
const value=name=>page.locator('.info-card').filter({has:page.locator('span').filter({hasText:new RegExp('^'+name+'$')})}).locator('strong').innerText();
assert.equal(await value('Sisa Plafon'),'Rp 650.000');assert.equal(await value('Sisa Piutang Customer \\(Perusahaan\\)'),'Rp 320.000');assert.equal(await value('Tempo Pembayaran'),'24 hari');
await page.locator('input.date-input').fill('2026-10-05');await page.locator('input.date-input').dispatchEvent('input');
assert.match(await value('Jatuh Tempo'),/29/);assert.equal(reads[0].searchParams.get('id_kunjungan'),'11');assert.deepEqual(errors,[]);
console.log('PASS Mobile Sales: live master overrides stale route data; ready stock and 24-day term displayed.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

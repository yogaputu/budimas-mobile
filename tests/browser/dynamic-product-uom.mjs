// Synthetic data only: intercept all API calls and block other remote requests.
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.FRONTEND_TEST_ORIGIN || 'http://127.0.0.1:5175';
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
try {
  for (const count of [1,2,3,4,6]) {
    const context = await browser.newContext({viewport:{width:390,height:844}});
    const units = Array.from({length:count},(_,i)=>({id:101+i,level:i+1,nama:['PCS','CT','BOX','PALET','BUNDLE','PACK'][i],faktor_konversi:10**i}));
    await context.addInitScript(()=>{localStorage.setItem('CapacitorStorage.auth_token','mock-only');localStorage.setItem('CapacitorStorage.user_data',JSON.stringify({id:3,id_sales:1,nama:'Sales'}));});
    let preview;
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if (!url.pathname.startsWith('/api/')) return url.origin===origin?route.continue():route.abort();
      let data=[];
      if(url.pathname.includes('order-context')) data={id_customer:1,id_plafon:1,id_cabang:1,Kode:'C1',Nama:'Toko',Plafon:999999999,SisaPlafon:999999999};
      else if(url.pathname.includes('principal-tabs')) data=[{id_principal:1,nama_principal:'Principal'}];
      else if(url.pathname.includes('history-order')||url.pathname.includes('stok/kategori'))data=[{id_produk:1,Kode:'SKU1',Nama:'Produk',StokReady:99999999,HargaE:100,uoms:units}];
      else if(url.pathname.includes('preview-sales-order')) {preview=route.request().postDataJSON();data={groups:[]};}
      return route.fulfill({json:data});
    });
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/sales-order?id_plafon=1&kode_customer=C1&id_kunjungan=11');
    await page.locator('.uom-grid input').last().waitFor();
    assert.equal(await page.locator('.uom-grid input').count(),count);
    await page.locator('.uom-grid input').last().fill('2');
    await page.getByRole('button',{name:'Cek',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.swal2-popup'));
    assert.equal(preview.products[0].uom_quantities.length,count);
    assert.equal(preview.products[0].uom_quantities.at(-1).quantity,2);
    assert.equal(preview.products[0].total_pieces,2*10**(count-1));
    await page.locator('.swal2-confirm').click();
    for(const width of [320,390,768]) {
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`UOM ${count}, width ${width}`);
    }
    if(count===4)await page.screenshot({path:'/tmp/budimas-mobile-uom-four.png',fullPage:true});
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS Mobile: 1/2/3/4/6 master UOMs, payload, canonical PCS, responsive 320/390/768.');
} finally { await browser.close(); }

# LPH dan klaim pembayaran Mobile Sales

Menu Dashboard **LPH & Klaim Pembayaran** (`/lph-kuitansi`) menggunakan endpoint `/api/mobile/workflow`. Backend harus sudah memuat migrasi `20261004_payment_receipt_workflow.sql` dan route baru. Finance mengaktifkan perusahaan, memetakan COA, lalu membuat LPH baru dengan alur **Kuitansi & Giro**. LPH versi1 tetap memakai menu LPH/Pembayaran sebelumnya.

Sales mencocokkan seluruh faktur sebelum menerima LPH, lalu mencatat klaim Tunai, Transfer, atau Giro. Giro memerlukan nomor, bank dan jatuh tempo. Klaim bisa dihapus selama LPH Aktif. Nominal dibatasi sisa piutang dan seluruh klaim faktur tersebut. Identitas Sales berasal dari token sesuai resolver backend.

Klaim belum mengurangi piutang dan tidak menjadi riwayat pembayaran final pada menu lama. Finance melakukan rekonsiliasi dan finalisasi kuitansi. Saat pengembalian LPH, Sales mengisi bagian cash yang ditransfer; sisa cash menjadi setoran Pending untuk Kasir. Setelah return, klaim tidak dapat diubah.

Workflow ini harus online. Penulisan baru tidak masuk SQLite/antrean `/api/payment/save` yang digunakan pembayaran lama. Tombol dikunci selama permintaan; kegagalan jaringan mempertahankan kunci UUID untuk retry klaim dengan payload yang sama. Perubahan form menghasilkan kunci baru. Jika transaksi berhasil tetapi reload gagal, halaman meminta muat ulang untuk menghindari penggunaan saldo lama.

## Update aplikasi

```sh
git pull --ff-only origin main
npm ci
npm run build
npx cap sync android
```

Kemudian build APK/AAB melalui Android Studio dan install/distribusikan versi baru. APK yang sudah terpasang tidak berubah hanya karena repo/API diperbarui. Untuk iOS, gunakan `npx cap sync ios` dan build melalui Xcode di Mac. Penandatanganan dan build native belum diuji di cloud ini.

Konfigurasi API mengikuti `VITE_API_URL` yang sudah tersedia di `.env`; pastikan tujuan yang dipakai aplikasi memuat backend baru (respons endpoint tanpa token401, bukan404). Jangan memasukkan token/key ke repository.

## Verifikasi

- `node --test tests/*.test.mjs`: tes LPH lama dan validasi klaim, ID detail penerimaan, cash split, batas nominal dan giro.
- `npm run build`: build Vue/Vite.
- `PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs CHROMIUM_PATH=/path/to/chromium node tests/browser/receipt-workflow.mjs`: workflow simulasi pada viewport390px, seluruh API dimock; tidak mengirim transaksi bisnis. Server dev lokal port5176 diperlukan; override `FRONTEND_TEST_ORIGIN` untuk port lain.

Uji penerimaan setelah deploy: Sales menerima LPH baru, menambah klaim, return; Kasir menyetujui cash; Supervisor berbeda memfinalisasi kuitansi melalui web Finance. LPH dan transaksi versi1 tidak perlu dikonversi.

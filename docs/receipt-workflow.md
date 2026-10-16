# LPH dan klaim pembayaran Mobile Sales

Menu Beranda **LPH** (`/lph-kuitansi`) dipakai untuk penerimaan dokumen, rekap penerimaan, dan pengembalian LPH, tanpa check-in. Pencatatan Tunai, Transfer, dan Giro memakai satu halaman **Pembayaran** (`/payment`), baik dari Beranda maupun dari Call Plan. Finance tetap membuat LPH dengan alur **Kuitansi & Giro**. LPH versi 1 tetap memakai `/lph` dan `/payment-legacy`.

Sales mencocokkan seluruh faktur sebelum menerima LPH. Saat pembayaran dibuka dari Call Plan, customer mengikuti kunjungan aktif dan tidak dapat diganti. Dari Beranda, Sales memilih customer dari LPH aktif miliknya. Transfer memerlukan referensi; Giro memerlukan nomor, bank dan jatuh tempo. Klaim bisa dihapus selama LPH aktif. Nominal dibatasi sisa piutang dikurangi catatan belum final di seluruh LPH untuk faktur yang sama. Identitas Sales berasal dari token; server memverifikasi customer, kepemilikan kunjungan, dan status kunjungan.

Klaim belum mengurangi piutang. Riwayat pembayaran menampilkan catatan Sales, asal pencatatan, serta status kuitansi. Proyeksi kuitansi pada riwayat lama disaring menggunakan ID setoran, bukan kesamaan nominal/tanggal. Finance melakukan rekonsiliasi dan finalisasi kuitansi. Saat pengembalian LPH, Sales mengisi bagian cash yang ditransfer; sisa cash menjadi setoran Pending untuk Kasir. LPH boleh dikembalikan dengan faktur belum lunas; setelah return, klaim tidak dapat diubah.

Workflow ini harus online. Penulisan baru tidak masuk SQLite/antrean `/api/payment/save` yang digunakan pembayaran lama. Tombol dikunci selama permintaan; kegagalan jaringan mempertahankan kunci UUID untuk retry klaim dengan payload yang sama. Perubahan form menghasilkan kunci baru. Jika transaksi berhasil tetapi reload gagal, halaman meminta muat ulang untuk menghindari penggunaan saldo lama.

## Update aplikasi

Sebelum memasang APK v1.0.11, jalankan migrasi tambahan API `tools/migrations/20261015_mobile_sales_collections.sql` setelah migrasi workflow yang sudah ada, lalu pasang kode API. Migrasi menambah konteks kunjungan dan indeks tanpa mengubah saldo/piutang. Aplikasi tidak beralih diam-diam ke alur lama bila API baru belum tersedia.

Perubahan API:

- `GET /api/mobile/workflow/collection-options`: parameter `kode_customer`, `id_customer`, `id_kunjungan`, dan `search`; mengembalikan customer serta faktur LPH aktif dengan `available_to_collect`. Pemilihan customer memakai ID, bukan kode yang dapat sama antar cabang.
- `GET /api/mobile/workflow/collections`: parameter `kode_customer`, `id_customer`, `id_kunjungan`, dan `page`; riwayat customer lintas kunjungan, 50 catatan per halaman, `has_more`, serta `legacy_setoran_customer_ids` untuk penyaringan proyeksi lama.
- `GET /api/payment/history`: parameter tambahan `id_customer` untuk mencocokkan customer secara tepat pada akses dari Beranda, dengan cakupan Sales dari token.
- `POST /api/mobile/workflow/lphs/{id}/claims`: tetap kompatibel dengan APK lama; APK baru menambah `entry_origin`, `id_kunjungan` yang dapat null, dan `payment_reference`.

Endpoint baru tetap membutuhkan token Sales. Referensi transfer bukan unggahan gambar/file.

```sh
git pull --ff-only origin main
npm ci
npm run build
npx cap sync android
```

Kemudian build APK/AAB melalui Android Studio dan install/distribusikan versi baru. APK yang sudah terpasang tidak berubah hanya karena repo/API diperbarui. APK debug v1.0.11 dibangun lokal; pengujian pada perangkat fisik dan build rilis bertanda tangan dilakukan terpisah. Untuk iOS, gunakan `npx cap sync ios` dan build melalui Xcode di Mac.

Konfigurasi API mengikuti `VITE_API_URL` yang sudah tersedia di `.env`; pastikan tujuan yang dipakai aplikasi memuat backend baru (respons endpoint tanpa token401, bukan404). Jangan memasukkan token/key ke repository.

## Verifikasi

- `node --test tests/*.test.mjs`: tes LPH lama dan validasi klaim, ID detail penerimaan, cash split, batas nominal dan giro.
- `npm run build`: build Vue/Vite.
- `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROMIUM_PATH=/path/to/chromium node tests/browser/revision-20261015.mjs`: simulasi pembayaran dari Beranda dan Call Plan, retry, Giro, Transfer, riwayat, dan pengembalian LPH. Semua API dimock. Server dev lokal port5177; override `FRONTEND_TEST_ORIGIN` untuk port lain.

Uji penerimaan setelah deploy: Sales menerima LPH, mencatat penerimaan dari Beranda dan Call Plan, lalu mengembalikan LPH; Kasir menyetujui cash dan pengguna dengan hak Approve memfinalisasi kuitansi di Finance. LPH dan transaksi versi 1 tidak perlu dikonversi.

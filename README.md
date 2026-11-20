# MY MONEY — Personal Finance PWA

Aplikasi pengelola keuangan pribadi yang modern, minimalis, dan dapat diinstal seperti aplikasi native di iPhone maupun Android. Seluruh data tersimpan **lokal di perangkat** (IndexedDB) — tanpa backend, tanpa server database, tanpa akun.

## Fitur

- **Dashboard** — total saldo, pemasukan & pengeluaran bulan ini, grafik arus kas 6 bulan, transaksi terakhir, ringkasan tabungan, rasio pengeluaran terhadap pemasukan.
- **Gaji** — pencatatan gaji mingguan/bulanan (pokok, bonus, lembur, tunjangan, potongan → total bersih otomatis), riwayat per periode, tersinkron otomatis sebagai pemasukan tanpa dobel hitung.
- **Pemasukan & Pengeluaran** — tambah/edit/hapus, kategori lengkap, metode pembayaran, catatan, tanggal.
- **Tabungan** — target nominal + tenggat, progres persen, setor/tarik dana (dicatat sebagai *pindah dana*, bukan pengeluaran).
- **Laporan** — harian, mingguan, bulanan, tahunan; grafik Chart.js; filter tanggal & kategori; pengeluaran per kategori.
- **Riwayat Transaksi** — cari, filter jenis/kategori, urutkan, edit, hapus.
- **Backup & Restore** — export/import JSON dengan validasi file dan konfirmasi sebelum menimpa data.
- **PWA & Offline** — manifest + service worker; dapat diinstal ke Home Screen iPhone (Safari) dan Android (Chrome); tetap berfungsi offline setelah kunjungan pertama.
- **Tema Terang & Gelap** — CSS variables, mengikuti preferensi sistem sebagai bawaan.

## Teknologi

HTML5 · CSS3 · JavaScript Vanilla (ES6+) · Bootstrap 5 · IndexedDB · Chart.js · Lucide Icons · Service Worker · Google Fonts (Plus Jakarta Sans, Inter, Roboto, Playfair Display)

## Menjalankan Secara Lokal

Aplikasi memakai Service Worker & IndexedDB, sehingga perlu dibuka lewat server lokal (bukan `file://`):

```bash
cd MY-MONEY
python3 -m http.server 8080
# buka http://localhost:8080
```

atau dengan Node.js:

```bash
npx serve MY-MONEY
```

## Deploy ke GitHub Pages

1. Buat repository baru di GitHub (mis. `my-money`).
2. Upload seluruh isi folder `MY-MONEY/` ke repository (via web upload, atau `git`):
   ```bash
   git init
   git add .
   git commit -m "MY MONEY v1.0.0"
   git branch -M main
   git remote add origin https://github.com/<username>/my-money.git
   git push -u origin main
   ```
3. Di repository: **Settings → Pages → Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save**.
4. Tunggu ±1 menit, lalu buka `https://<username>.github.io/my-money/`.
5. **Instalasi di iPhone**: buka URL di Safari → Share → *Add to Home Screen*.
   **Android**: buka di Chrome → menu ⋮ → *Install app* / *Add to Home Screen*.

Semua path bersifat relatif dan Service Worker menggunakan scope `./`, sehingga berfungsi baik di root domain maupun subpath GitHub Pages.

## Struktur Folder

```
MY-MONEY/
├── index.html
├── manifest.json
├── service-worker.js
├── README.md
├── .gitignore
├── assets/
│   ├── icons/        # ikon PWA & apple-touch-icon
│   ├── images/
│   └── fonts/
├── css/
│   ├── style.css
│   ├── themes.css
│   ├── responsive.css
│   └── animations.css
└── js/
    ├── app.js         # bootstrap + router + service worker
    ├── database.js    # IndexedDB + query/perhitungan
    ├── utils.js       # util, toast, modal, format Rupiah/tanggal
    ├── dashboard.js
    ├── transactions.js
    ├── salary.js
    ├── savings.js
    ├── reports.js
    └── settings.js    # tema, saldo awal, backup/restore, profil
```

Catatan: aplikasi memakai **hash router** (`#/dashboard`, `#/transactions`, …) dalam satu `index.html`, sehingga routing tetap aman di GitHub Pages tanpa konfigurasi server.

## Perhitungan Saldo

```
Saldo akhir = Saldo awal + Total pemasukan − Total pengeluaran
```

- Transfer/pindah dana (mis. setoran tabungan) **tidak** dihitung sebagai pemasukan/pengeluaran → tidak ada perhitungan ganda.
- Gaji yang dicatat otomatis menjadi satu transaksi pemasukan terkait (dengan referensi) — mengedit/menghapus gaji ikut memperbarui transaksinya.
- Format angka: Rupiah Indonesia (`Rp1.000.000`). Format tanggal: `19 November 2026`.

## Catatan Privasi

100% data lokal. Tidak ada pelacakan, tidak ada pengiriman data ke server mana pun. Hapus data kapan saja lewat *Restore* file kosong atau bersihkan site data di browser.

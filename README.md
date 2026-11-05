# CV. SUMBER ARTHA - Front-End Portal Akun Pelanggan (Login & Register)

Implementasi Front-End modern berbasis **HTML5**, **CSS3**, dan **JavaScript (Vanilla)** yang dirancang untuk **sistem eksternal / portal akun pengguna (pelanggan & klien)** CV. Sumber Artha, berfokus penuh pada **Halaman Login dan Register** sesuai hierarki wireframe dengan bingkai visual estetika kayu elegan (*flanking media frames*).

---

## 📁 Struktur Direktori

```
web-front/
├── index.html        # Struktur HTML5 (Login, Register & Admin Dashboard SPA)
├── dashboard.html    # Standalone Admin Dashboard (Analytics & TOP Monitoring)
├── css/
│   └── style.css     # CSS Desain Sistem, Pill Shapes, Timber Theme & Admin Dashboard
├── js/
│   └── app.js        # Validasi Form, Navigasi Tab, Routing Admin, Filter Periode & UX
└── README.md         # Dokumentasi implementasi proyek
```

---

## 📊 Fitur Baru: Admin Dashboard Analytics & Monitoring Produksi

Sesuai permintaan, jika pengguna masuk dengan akun **Admin** (`admin.artha` atau username yang mengandung kata *admin*), sistem secara otomatis mengarahkan ke tampilan **Admin Dashboard Analitik & Monitoring Produksi** dengan palet warna dan tema kayu (*warm timber & slate navy*) yang selaras dengan identitas CV. Sumber Artha:

### 1. Navigasi Sidebar Kiri (Dark Slate Navy & Warm Amber)
- **Identitas**: Box Icon 3D + label **Admin** (CV. Sumber Artha).
- **MAIN**: Menu **Dashboard** (status aktif berbentuk pill amber `#D97706` dengan ikon home).
- **TRANSACTION**:
  - `Transaksi PO` (dilengkapi badge counter `12`).
  - `Surat Jalan` (ikon delivery truck).
  - `Invoice` (ikon receipt dengan badge warning `2`).
- **PRODUCTION**:
  - `Cutting Optimize` (ikon gunting/pemotongan presisi).
  - `Monitoring Produksi` (ikon pulse/aktivitas lini perakitan).
- **INVENTORY**:
  - `Inventaris Offcut` (ikon kubus persediaan sisa bahan usable).
- **Profil & Logout**: Avatar `AD` Administrator + Tombol Keluar untuk kembali ke portal login.

### 2. Banner Header Analitik
- **Judul**: `Dashboard Analitik & Monitoring Produksi`.
- **Deskripsi**: *Ringkasan efisiensi pemotongan bahan, status PO, dan proyeksi piutang TOP 90 Hari*.
- **Filter Periode Interaktif**: Pilihan dropdown rentang waktu (*Bulan Ini (Okt 2026)*, *Bulan Lalu (Sep 2026)*, *Kuartal 3 (Jul - Sep 2026)*, dan *Tahun Berjalan (2026)*) yang secara otomatis memperbarui angka KPI dan grafik secara dinamis.

### 3. Kartu Metrik Utama (4 KPI Cards)
- **Total PO Berjalan**: `12 PO` (`+2 PO bulan ini`).
- **Rata-rata Efisiensi Bahan**: `94,2%` (`+1,8% yield`).
- **Limbah Kayu (Waste)**: `3,4%` (`Turun 0,6%`).
- **Total Piutang (TOP 90)**: `Rp 18,5 jt` (`2 invoice aktif`).

### 4. Visualisasi & Distribusi Material
- **Grafik Batang (Tren Efisiensi LVB & Triplek)**: Menampilkan 6 bulan pengamatan (*Mei: 90.8%*, *Jun: 92.5%*, *Jul: 91.6%*, *Agu: 93.3%*, *Sep: 94.7%*, *Okt: 94.2%*) dengan animasi bar amber, rata-rata yield 94,2%, serta legenda warna lengkap.
- **Distribusi Penggunaan Material**: Tiga progress bar interaktif:
  - `Yield` (Material Terpakai): **94.2%** (Amber Orange).
  - `Offcut Usable` (Sisa Kayu Layak Pakai): **2.4%** (Emerald Green).
  - `Waste` (Limbah Kayu): **3.4%** (Slate Blue).

### 5. Tabel Monitoring Jatuh Tempo Tagihan (TOP 90 Hari)
- Menampilkan daftar invoice jatuh tempo:
  - `INV-26-001` — **PT Artha Furnitur** — Jatuh Tempo: *10 Nov 2026* — Total: *Rp 12.500.000* — Status: *Belum Lunas* — Pembayaran: *Aktif* (Pill Badge Kuning).
  - `INV-26-002` — **CV Mebel Jaya** — Jatuh Tempo: *13 Nov 2026* — Total: *Rp 6.000.000* — Status: *Cicilan* — Pembayaran: *Aktif* (Pill Badge Kuning).

### 6. Alur Akses Cepat & Demo
- **Tombol Uji Coba Cepat**:
  - Klik tombol chip `Admin` lalu klik `MASUK KE SISTEM`, atau
  - Klik tombol chip `⚡ Masuk Langsung (Admin)` untuk langsung masuk ke dashboard dalam 1 klik.
- **Navigasi Berbasis Hash**: Membuka `index.html#dashboard` langsung membuka tampilan dashboard.
- **Halaman Khusus**: Tersedia juga file [dashboard.html](file:///c:/Users/LENOVO/Downloads/Gugu/KULIAH/fulstak/web-front/dashboard.html) untuk akses langsung.

---

## 🎨 Transformasi ke Sistem Eksternal (Sesuai Permintaan)

### 1. Menghilangkan Seluruh Representasi Internal Pabrik & Role
- **Tanpa Pilihan Role**: Pilihan "Hak Akses / Peran (Role)" dan "Pengajuan Peran" telah dihapus sepenuhnya dari formulir Login maupun Register.
- **Tanpa ID Karyawan**: Label dan input telah diubah menjadi representasi akun eksternal umum:
  - Login: **`USERNAME ATAU EMAIL`** & **`PASSWORD`**.
  - Register: **`NAMA LENGKAP`**, **`USERNAME`**, **`ALAMAT EMAIL`**, **`PASSWORD`**, dan **`KONFIRMASI PASSWORD`**.
- **Tanpa Istilah RBAC Pabrik**: Teks footer kartu dan catatan keamanan kini berupa pernyataan privasi resmi:
  *`Dengan mengakses akun, Anda menyetujui Ketentuan Layanan dan Kebijakan Privasi resmi CV. Sumber Artha.`*
- **Logo Brand**: Menggunakan file `favicon.ico` resmi perusahaan yang tertanam rapi pada kartu otentikasi serta favicon browser.
- **Identitas**: `CV. SUMBER ARTHA` — *Furnitur Kayu Berkualitas untuk Hunian Elegan*.

### 2. Tab Navigasi Interaktif (Login & Register)
- **Tab Login**:
  - Input `USERNAME ATAU EMAIL` (disertai tombol pembersih cepat `×`).
  - Input `PASSWORD` (disertai fitur intip sandi & detektor Caps Lock aktif).
  - Checkbox `Ingat saya di perangkat ini`.
  - Tombol aksi: `MASUK KE SISTEM`.
  - Tombol Uji Coba Cepat (1-Klik): `Admin`, `Op. Cutting`, dan `User`.
- **Tab Register**:
  - Input `NAMA LENGKAP`.
  - Input `USERNAME`.
  - Input `ALAMAT EMAIL`.
  - Input `PASSWORD` dan `KONFIRMASI PASSWORD` (layout grid 2 kolom rapi).
  - Checkbox persetujuan Ketentuan Layanan & Kebijakan Privasi.
  - Tombol aksi: `DAFTAR AKUN BARU`.

### 3. Elemen Visual Flanking (Sesuai Sketsa Arsir Kuning)
- **Sisi Kiri**:
  - Kapsul horizontal atas: Foto interior arsitektur kayu elegan.
  - Kapsul horizontal bawah: Foto bahan baku balok kayu berkualitas.
  - Kartu persegi bawah: Foto produk meja solid wood.
- **Sisi Kanan**:
  - Kubah vertikal lengkung (*large arch frame*): Foto panel dinding dan tata ruang kayu mewah.
- *Semua gambar murni estetika visual tanpa teks promosi/iklan.*

### 4. Modal Layanan Pengguna & Customer Care
- **Modal Berhasil Masuk**: Menampilkan status Member Terverifikasi dengan modul eksternal: Koleksi Furnitur, Kustomisasi Desain, Lacak Pesanan, dan Garansi Mebel.
- **Modal Bantuan Akun**: Informasi kontak Customer Service resmi (WhatsApp CS, Email Dukungan, dan Alamat Showroom).
- **Footer Kontak**: `Kontak : Jl. Mangga Muda 17A, Cilandak, Jakarta Selatan 12310 - 021 123 456 7890   — —`.

---

## 🚀 Cara Menjalankan

Tidak memerlukan dependensi atau tools tambahan:
1. Buka file [index.html](file:///c:/Users/LENOVO/Downloads/Gugu/KULIAH/fulstak/web-front/index.html) langsung dengan klik ganda di file explorer Anda menggunakan browser apa pun (Google Chrome, Edge, Firefox, Safari).

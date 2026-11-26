# Laporan Validasi Data

Digenerate: 2026-11-25 11:54 UTC

## Ringkasan

- Baris UMKM: **30**
- Bbox: `[101.391731, 0.451971, 101.483029, 0.576774]`
- Titik dalam batas kelurahan: **29/30**
- Titik di luar batas: **1**
- Titik berbagi koordinat: **0**
- Selisih koordinat maksimum vs referensi survei: **0.000 m**
- Omzet median: **Rp3,500,000**

## Sebaran kategori

- Kuliner: **14**
- Toko & Retail: **8**
- Jasa: **5**
- Sembako: **2**
- Isi Ulang Galon: **1**

## Sebaran kecamatan

- Tampan: **12**
- Rumbai: **12**
- Sukajadi: **5**

## Sebaran kelurahan

- Umban Sari: **10**
- Simpang Baru: **6**
- Pekanbaru Luar Kota/Tampan: **4**
- Harjosari: **3**
- Meranti Pandak: **2**
- Labuh Baru: **2**
- Kedungsari: **2**

## Catatan kualitas data

- Koordinat xlsx kehilangan titik desimal; direkonstruksi dan divalidasi terhadap bbox + layer survei.
- Jumlah pekerja kosong: P24 Ianzy ayam geprek, P28 Toko buah baif (ditampilkan sebagai “Belum diisi”).
- P04 Faiz Jaya di luar batas (1948 m dari Kel. Simpang Baru); koordinat mentah 451970743287666.0, 101391730714091.0.

### Koreksi kategori

- P15 Suzanna Elektronik: `jasa` → `retail` (Toko elektronik termasuk retail).
- P16 Malay Mini Market: `kuliner` → `retail` (Nama usaha minimarket, bukan kuliner).
- P18 Toko Buku Media Sukses: `jasa` → `retail` (Toko buku termasuk retail).
- P19 Toko Buku Parker: `jasa` → `retail` (Toko buku termasuk retail).

## Ukuran aset

- umkm.geojson: **14.8 KB**
- pekanbaru-kelurahan.geojson: **32.1 KB**
- meta.json: **1.4 KB**

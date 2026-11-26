import { icon } from "../lib/icons.js";
import { compactRupiah, dateID, number } from "../lib/format.js";

const FIELDS = [
  ["ID", "ID survei", "P01–P30, unik per usaha."],
  ["Title", "Nama usaha", "Ditampilkan apa adanya; spasi berlebih dibersihkan."],
  ["Date Created", "Tanggal dicatat", "Tanggal digitalisasi/survei, bukan tanggal usaha berdiri."],
  ["Latitude / Longitude", "Koordinat", "Direkonstruksi dari angka tanpa desimal, lalu divalidasi."],
  ["Northing / Easting", "—", "Tidak dipakai karena tidak konsisten dengan koordinat titik."],
  ["Elevation", "Elevasi", "Dikonversi ke meter; hanya pelengkap data spasial."],
  ["Digitalisasi", "Status digitalisasi", "0/1; ditampilkan sebagai “sudah/belum terdata”."],
  ["Jenis", "Kategori asli", "Label mentah disimpan sebagai konteks."],
  ["Jumlah pekerja", "Pekerja", "Dua baris kosong ditampilkan sebagai “Belum diisi”."],
  ["Lama usaha", "Lama usaha", "Dalam tahun, dihitung dari data survei."],
  ["Marketplace", "Marketplace", "0/1; badge “Terhubung marketplace”."],
  ["Omzet", "Tier omzet", "Angka asli tetap tersedia di panel detail."],
];

export function renderAbout(container, meta) {
  const categoryCount = Object.keys(meta.kategori).length;
  const kelurahanCount = Object.keys(meta.kelurahan).length;
  const table = FIELDS.map(
    ([field, label, note]) =>
      `<tr><td>${field}</td><td><strong>${label}</strong></td><td>${note}</td></tr>`
  ).join("");

  container.innerHTML = `<div class="about-hero">
    <div>
      <p class="eyebrow"><span class="eyebrow__dot"></span>Tentang proyek</p>
      <h1 id="aboutTitle">Di balik <em>peta.</em></h1>
      <p>Sekitar adalah sistem informasi geografis sederhana untuk menemukan UMKM di Pekanbaru. Semua titik berasal dari satu survei lapangan, lalu dirapikan agar bisa dijelajahi lewat peta, daftar, dan potret statistik.</p>
    </div>
    <aside class="about-card">
      <span class="about-card__label">Dataset aktif</span>
      <strong class="about-card__big">${meta.jumlah}</strong>
      <span class="about-card__sub">UMKM · ${kelurahanCount} kelurahan · ${categoryCount} kategori</span>
      <ul class="about-card__list">
        <li><span>Median omzet</span><strong>${compactRupiah(meta.medianOmzet)}/bln</strong></li>
        <li><span>Marketplace</span><strong>${meta.marketplace} usaha</strong></li>
        <li><span>Diperbarui</span><strong>${dateID(meta.dibuatPada)}</strong></li>
      </ul>
    </aside>
  </div>

  <div class="about-grid">
    <article class="about-tile">
      <span class="about-tile__icon">${icon("database")}</span>
      <h2>Sumber data</h2>
      <p>Satu berkas survei (<strong>GIS.xlsx</strong>) berisi ${meta.jumlah} usaha. Tidak ada data rating, jam buka, telepon, atau foto di dalamnya — jadi antarmuka tidak menampilkannya.</p>
    </article>
    <article class="about-tile">
      <span class="about-tile__icon">${icon("coins")}</span>
      <h2>Omzet sebagai tier</h2>
      <p>Omzet bulanan dikelompokkan ke empat tier. Angka persis tetap bisa dibuka di panel detail, tetapi tidak ditonjolkan agar data usaha tidak terasa mengekspos pemiliknya.</p>
    </article>
    <article class="about-tile">
      <span class="about-tile__icon">${icon("shield")}</span>
      <h2>Batas & kejujuran</h2>
      <p>${number(meta.jumlah)} titik divalidasi terhadap batas kelurahan; satu titik berada di luar batas dan diberi tanda. Kolom kosong ditampilkan sebagai “Belum diisi”, bukan angka nol.</p>
    </article>
  </div>

  <section class="about-section">
    <div class="about-columns">
      <div class="prose">
        <h2>Apa yang dipetakan</h2>
        <p>Peta menampilkan lokasi usaha, kategori, jarak dari titik awal, skala omzet, jumlah pekerja, lama usaha, dan status marketplace. Klik pin atau kartu untuk membuka detail; klik kelurahan untuk memfilter wilayah.</p>
        <p>Radius pencarian dihitung dari <strong>pusat Pekanbaru</strong> secara default. Jika Anda mengaktifkan “Lokasi saya”, jarak dihitung dari posisi Anda dan radius 1 km langsung diterapkan.</p>

        <h2>Dari spreadsheet ke peta</h2>
        <ul>
          <li>Koordinat xlsx kehilangan titik desimal; nilai direkonstruksi, divalidasi terhadap bbox Pekanbaru, dan dicocokkan dengan layer survei (selisih 0 m).</li>
          <li>Kategori dinormalisasi: kuliner + warung kuliner, toko buku/elektronik/minimarket ke Toko &amp; Retail.</li>
          <li>Titik di-join ke 49 poligon kelurahan; 29 dari 30 titik berhasil masuk batas.</li>
          <li>Batas kelurahan disederhanakan dari 5,9 MB menjadi ±32 KB agar peta tetap ringan.</li>
          <li>Hasil validasi lengkap tersedia di <code>docs/validation-report.md</code> pada repositori.</li>
        </ul>

        <h2>Cara membaca angka</h2>
        <ul>
          <li><strong>Jarak</strong> memakai haversine dari titik awal, bukan jarak tempuh jalan.</li>
          <li><strong>Omzet</strong> adalah tier bulanan, bukan laba bersih dan bukan klasifikasi resmi usaha mikro/kecil.</li>
          <li><strong>Lama usaha</strong> dihitung dalam tahun; nilai kosong tidak dianggap nol.</li>
          <li><strong>Choropleth</strong> menghitung titik yang jatuh di dalam poligon kelurahan, bukan jumlah usaha yang benar-benar ada di lapangan.</li>
        </ul>
      </div>

      <div>
        <h2 style="font-size:var(--fs-md);margin-bottom:10px">Kamus data</h2>
        <div class="dict-wrap">
          <table class="dict">
            <thead><tr><th>Kolom</th><th>Dipakai sebagai</th><th>Catatan</th></tr></thead>
            <tbody>${table}</tbody>
          </table>
        </div>
      </div>
    </div>
  </section>

  <section class="about-section">
    <h2 style="font-size:var(--fs-lg);margin-bottom:12px">Catatan kualitas data</h2>
    <div class="about-note">${icon("info")}
      <span><strong>Empat kategori dikoreksi</strong> (Suzanna Elektronik, Malay Mini Market, Toko Buku Media Sukses, Toko Buku Parker → Toko &amp; Retail). <strong>Dua usaha</strong> tidak mencantumkan jumlah pekerja. <strong>Faiz Jaya</strong> berada ±1,9 km di luar batas kelurahan acuan. Dataset juga tidak memuat jam buka, rating, atau foto, sehingga aplikasi tidak mengarang data tersebut.</span>
    </div>
    <div class="about-note" style="margin-top:10px;border-left-color:var(--brand);background:var(--brand-tint);color:var(--brand-strong)">${icon("sparkles")}
      <span><strong>Privasi & etika.</strong> Omzet ditampilkan sebagai tier pada daftar dan peta. Angka persis hanya muncul setelah pengguna memilih “Lihat angka” di detail. Untuk publikasi nyata, mintalah izin pemilik usaha dan perbarui data secara berkala.</span>
    </div>

    <h2 style="font-size:var(--fs-lg);margin:26px 0 8px">Sumber & kredit</h2>
    <p style="font-size:var(--fs-sm);line-height:1.65;color:var(--muted);max-width:72ch">Data usaha berasal dari survei lapangan yang dilampirkan pada proyek ini. Peta dasar dan teknologi pendukung:</p>
    <div class="credit-list">
      <span class="credit"><strong>Data:</strong> survei UMKM Pekanbaru (GIS.xlsx)</span>
      <span class="credit"><strong>Peta dasar:</strong> OpenStreetMap · CARTO</span>
      <span class="credit"><strong>Citra satelit:</strong> Esri World Imagery</span>
      <span class="credit"><strong>Mesin peta:</strong> OpenLayers</span>
      <span class="credit"><strong>Tipografi:</strong> Plus Jakarta Sans · Fraunces</span>
      <span class="credit"><strong>Batas wilayah:</strong> polygon_riau.json (49 kelurahan Pekanbaru)</span>
    </div>

    <p style="margin-top:26px"><a class="btn btn--primary" href="?view=explore">${icon("compass", "icon--sm")}Kembali menjelajah</a></p>
  </section>`;
}

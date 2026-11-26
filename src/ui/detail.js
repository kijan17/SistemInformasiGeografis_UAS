import { CATEGORY_LABELS, categoryIcon, icon } from "../lib/icons.js";
import {
  dateID,
  distance as fmtDistance,
  escapeHtml,
  rupiah,
  years,
} from "../lib/format.js";

export function renderDetail(container, item, nearby, { hrefFor }) {
  const category = CATEGORY_LABELS[item.kategori] || item.kategori;
  const location = item.dalamBatas
    ? `Kel. ${escapeHtml(item.kelurahan || "—")}, Kec. ${escapeHtml(item.kecamatan || "—")}`
    : "Di luar batas kelurahan Pekanbaru";

  const badges = [
    `<span class="badge">${icon(item.marketplace ? "sparkles" : "store", "icon--sm")}${item.marketplace ? "Terhubung marketplace" : "Belum di marketplace"}</span>`,
    `<span class="badge badge--brand">${icon("coins", "icon--sm")}${escapeHtml(item.omzetLabel)}</span>`,
  ];
  if (!item.dalamBatas) {
    badges.push(`<span class="badge badge--warn">${icon("info", "icon--sm")}Luar batas</span>`);
  }

  const nearbyHTML = nearby.length
    ? nearby
        .map(
          (other) => `<a class="nearby__item" href="${hrefFor(other)}" data-nearby="${other.id}" data-cat="${other.kategori}">
            <span class="nearby__icon">${categoryIcon(other.kategori)}</span>
            <span class="nearby__name">${escapeHtml(other.nama)}</span>
            <span class="nearby__dist">${fmtDistance(other.jarak)}</span>
          </a>`
        )
        .join("")
    : `<p class="note">${icon("info")}Belum ada usaha lain di sekitar titik ini.</p>`;

  container.dataset.cat = item.kategori;
  container.dataset.id = item.id;
  container.innerHTML = `<div class="detail__scroll">
    <div class="detail__hero" data-cat="${item.kategori}">
      <button class="icon-btn detail__close" type="button" data-close aria-label="Tutup detail">
        ${icon("x")}
      </button>
      <div class="detail__glyph">${categoryIcon(item.kategori)}</div>
      <p class="detail__kicker">
        <span>${escapeHtml(category)}</span>
        <span class="dot"></span>
        <span class="muted">${fmtDistance(item.jarak)} dari titik awal</span>
      </p>
      <h2 id="detailTitle">${escapeHtml(item.nama)}</h2>
      <p class="detail__loc">${icon("map-pin")}${location}</p>
      <div class="detail__badges">${badges.join("")}</div>
    </div>

    <div class="detail__body">
      <div class="detail__actions">
        <a class="btn btn--primary" href="https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lon}" target="_blank" rel="noopener noreferrer">
          ${icon("navigation", "icon--sm")}Rute
        </a>
        <button class="btn btn--outline" type="button" data-share>${icon("share", "icon--sm")}Bagikan</button>
        <button class="btn btn--outline" type="button" data-copy>${icon("copy", "icon--sm")}Salin</button>
      </div>

      <div class="stat-grid">
        <div class="stat">
          <span class="stat__label">Omzet / bulan</span>
          <span class="stat__value">${escapeHtml(item.omzetLabel)}</span>
          <span class="stat__exact" data-omzet-exact hidden>${rupiah(item.omzet)}</span>
          <button class="stat__reveal" type="button" data-reveal>Lihat angka</button>
          <span class="stat__hint">Tier omzet dari data survei</span>
        </div>
        <div class="stat">
          <span class="stat__label">Pekerja</span>
          <span class="stat__value">${item.pekerja == null ? "Belum diisi" : item.pekerja}</span>
          <span class="stat__hint">${item.pekerja == null ? "Kolom kosong pada data" : "Orang yang dipekerjakan"}</span>
        </div>
        <div class="stat">
          <span class="stat__label">Lama usaha</span>
          <span class="stat__value">${years(item.lamaUsaha)}</span>
          <span class="stat__hint">Sejak mulai berjualan</span>
        </div>
        <div class="stat">
          <span class="stat__label">Tercatat</span>
          <span class="stat__value">${dateID(item.dicatatPada)}</span>
          <span class="stat__hint">Tanggal survei/digitalisasi</span>
        </div>
      </div>

      <section class="detail__section">
        <h3>Lokasi</h3>
        <p>${item.dalamBatas
          ? `${escapeHtml(item.kelurahan)}, Kecamatan ${escapeHtml(item.kecamatan)}, Pekanbaru.`
          : `Titik berada di luar batas kelurahan pada peta acuan${item.jarakBatasM ? ` (sekitar ${Math.round(item.jarakBatasM)} m)` : ""}.`}</p>
        <div class="coord">
          <code>${item.lat.toFixed(6)}, ${item.lon.toFixed(6)}</code>
          <button type="button" data-copy-coord aria-label="Salin koordinat">${icon("copy", "icon--sm")}</button>
        </div>
        <p class="note">${icon("info")}Data hasil survei lapangan. Dataset tidak memuat jam buka, rating, nomor telepon, atau foto usaha.</p>
      </section>

      <section class="detail__section">
        <h3>Data spasial</h3>
        <dl class="data-list">
          <dt>ID survei</dt><dd>${escapeHtml(item.id)}</dd>
          <dt>Elevasi</dt><dd>${item.elevasi != null ? `${item.elevasi} m` : "—"}</dd>
          <dt>Digitalisasi</dt><dd>${item.digitalisasi ? "Sudah terdata" : "Belum terdata"}</dd>
          <dt>Kategori asli</dt><dd>${escapeHtml(item.jenisAsli || "—")}</dd>
        </dl>
      </section>

      <section class="detail__section">
        <h3>Usaha terdekat</h3>
        <div class="nearby">${nearbyHTML}</div>
      </section>
    </div>
  </div>`;
}

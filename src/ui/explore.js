import { CATEGORY_COLORS, CATEGORY_LABELS, categoryIcon, icon } from "../lib/icons.js";
import {
  distance as fmtDistance,
  escapeHtml,
  highlight,
  number,
  years,
} from "../lib/format.js";

export function chipHTML(key, meta, active) {
  const isAll = key === "semua";
  const info = isAll ? null : meta.kategori[key];
  const count = isAll ? meta.jumlah : info?.jumlah ?? 0;
  const label = isAll ? "Semua" : info?.label ?? CATEGORY_LABELS[key] ?? key;
  const cat = isAll ? "" : `data-cat="${key}"`;
  const iconName = isAll ? "compass" : info?.icon;
  return `<button class="chip" type="button" data-kategori="${key}" aria-pressed="${active === key}" ${cat}>
    ${icon(iconName, "icon--sm")}
    <span>${escapeHtml(label)}</span>
    <span class="chip__count">${count}</span>
  </button>`;
}

export function renderChips(container, meta, active) {
  const keys = ["semua", ...Object.keys(meta.kategori)];
  container.innerHTML = keys.map((key) => chipHTML(key, meta, active)).join("");
}

export function cardHTML(item, { selectedId, query, href }) {
  const badges = [];
  if (item.marketplace) {
    badges.push(`<span class="card__badge">${icon("sparkles", "icon--sm")}Marketplace</span>`);
  }
  if (!item.dalamBatas) {
    badges.push(`<span class="card__badge" style="background:var(--danger-soft);color:var(--danger)">Luar batas</span>`);
  }
  const metaParts = [
    `<strong>${escapeHtml(CATEGORY_LABELS[item.kategori] || item.kategori)}</strong>`,
    item.pekerja != null ? `${item.pekerja} pekerja` : "Pekerja belum diisi",
    item.lamaUsaha != null ? `${years(item.lamaUsaha)} berjualan` : "Lama usaha belum diisi",
  ];
  return `<a class="card${item.id === selectedId ? " is-selected" : ""}" href="${href}" data-id="${item.id}" data-cat="${item.kategori}" aria-label="${escapeHtml(item.nama)} — ${escapeHtml(CATEGORY_LABELS[item.kategori])}, ${fmtDistance(item.jarak)}">
    <span class="card__thumb">${categoryIcon(item.kategori)}</span>
    <span class="card__main">
      <span class="card__top">
        <span class="card__title">${highlight(item.nama, query)}</span>
        <span class="card__dist">${fmtDistance(item.jarak)}</span>
      </span>
      <span class="card__meta">${metaParts.join(" · ")}</span>
      ${badges.length ? `<span class="card__badges">${badges.join("")}</span>` : ""}
    </span>
    <span class="card__chev">${icon("chevron-right", "icon--sm")}</span>
  </a>`;
}

export function renderCards(container, items, options) {
  if (!items.length) {
    renderEmpty(container, options);
    return;
  }
  container.innerHTML = items
    .map((item, index) => {
      const html = cardHTML(item, { ...options, href: options.hrefFor(item) });
      return html.replace('class="card', `style="animation-delay:${Math.min(index * 18, 200)}ms" class="card`);
    })
    .join("");
}

export function renderEmpty(container, { hasFilters, onReset }) {
  container.innerHTML = `<div class="empty">
    <span class="empty__art">${icon("map-pin")}</span>
    <h3>Belum ada usaha di sini</h3>
    <p>Tidak ada hasil untuk kombinasi pencarian dan filter ini. Coba perluas radius atau hapus beberapa filter.</p>
    <div class="empty__actions">
      <button class="btn btn--primary btn--sm" type="button" data-empty-reset>${icon("rotate", "icon--sm")}Reset filter</button>
      <button class="btn btn--outline btn--sm" type="button" data-empty-focus>Ubah pencarian</button>
    </div>
  </div>`;
  container.querySelector("[data-empty-reset]")?.addEventListener("click", onReset);
  container.querySelector("[data-empty-focus]")?.addEventListener("click", () => {
    document.getElementById("searchInput")?.focus();
  });
}

export function renderSkeleton(container) {
  container.innerHTML = Array.from({ length: 5 })
    .map(() => '<div class="skeleton-card" aria-hidden="true"></div>')
    .join("");
}

export function renderActiveFilters(container, filters, onRemove) {
  container.innerHTML = filters
    .map(
      (filter) => `<span class="filter-chip">${escapeHtml(filter.label)}
        <button type="button" data-filter="${filter.key}" aria-label="Hapus filter ${escapeHtml(filter.label)}">${icon("x")}</button>
      </span>`
    )
    .join("");
  container.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => onRemove(button.dataset.filter));
  });
}

export function resultLabel(count, state) {
  const sortLabel =
    {
      terdekat: "terdekat",
      nama: "nama A–Z",
      omzet: "omzet tertinggi",
      lama: "paling lama usaha",
      terbaru: "terbaru dicatat",
    }[state.sort] || "terdekat";
  return `<strong>${number(count)}</strong> usaha · urut ${sortLabel}`;
}

export function renderLegend(container, meta) {
  const items = Object.entries(meta.kategori)
    .map(
      ([key, info]) => `<span class="legend__item">
        <span class="legend__dot" style="background:${CATEGORY_COLORS[key]}"></span>
        ${escapeHtml(info.label)}
        <span class="legend__count">${info.jumlah}</span>
      </span>`
    )
    .join("");
  container.innerHTML = `${items}
    <div class="legend__foot">Klik pin untuk detail. Angka pada lingkaran menunjukkan jumlah usaha yang berdekatan.</div>`;
}

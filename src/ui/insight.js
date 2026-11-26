import { CATEGORY_COLORS, CATEGORY_LABELS, icon } from "../lib/icons.js";
import {
  compactRupiah,
  dateID,
  escapeHtml,
  number,
  years,
} from "../lib/format.js";
import { tierLabel } from "../lib/geo.js";

const SHORT_KELURAHAN = {
  "Pekanbaru Luar Kota/Tampan": "Tampan",
  "Umban Sari": "Umban Sari",
  "Simpang Baru": "Simpang Baru",
  "Meranti Pandak": "Meranti Pandak",
  "Labuh Baru": "Labuh Baru",
  "Kedungsari": "Kedungsari",
  "Harjosari": "Harjosari",
};

function polygonsOf(geometry) {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function choroplethSVG(boundaries, counts) {
  const W = 760;
  const H = 520;
  const PAD = 20;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let fLonMin = Infinity;
  let fLonMax = -Infinity;
  let fLatMin = Infinity;
  let fLatMax = -Infinity;

  for (const feature of boundaries.features) {
    const name = feature.properties.kelurahan;
    const withData = Boolean(counts[name]);
    for (const polygon of polygonsOf(feature.geometry)) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (withData) {
            if (lon < fLonMin) fLonMin = lon;
            if (lon > fLonMax) fLonMax = lon;
            if (lat < fLatMin) fLatMin = lat;
            if (lat > fLatMax) fLatMax = lat;
          }
        }
      }
    }
  }

  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const k = Math.cos(midLat);
  const spanX = (maxLon - minLon) * k;
  const spanY = maxLat - minLat;
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;
  const x = (lon) => offX + (lon - minLon) * k * scale;
  const y = (lat) => offY + (maxLat - lat) * scale;

  const fillFor = (count) => {
    if (!count) return "#EDE6D8";
    if (count <= 2) return "#DCEBE3";
    if (count <= 4) return "#B3D6C6";
    if (count <= 6) return "#7BB6A0";
    return "#12594A";
  };

  // Bidang pandang: fokus ke kelurahan berdata, sisakan konteks kota di timur.
  const focusW = x(fLonMax) - x(fLonMin);
  const focusH = y(fLatMin) - y(fLatMax);
  const padX = focusW * 0.1;
  const padY = focusH * 0.06;
  let viewW = focusW + padX * 2;
  let viewH = focusH + padY * 2;
  const aspect = 1.28;
  if (viewW / viewH < aspect) viewW = viewH * aspect;
  viewW = Math.min(viewW, W);
  viewH = Math.min(viewH, H);
  let viewX = x(fLonMin) - padX;
  let viewY = y(fLatMax) - padY;
  viewX = Math.max(0, Math.min(viewX, W - viewW));
  viewY = Math.max(0, Math.min(viewY, H - viewH));

  const paths = [];
  const candidates = [];

  for (const feature of boundaries.features) {
    const name = feature.properties.kelurahan;
    const count = counts[name] || 0;
    let d = "";
    let cx = 0;
    let cy = 0;
    let bestRingLength = 0;
    let bestRing = null;

    for (const polygon of polygonsOf(feature.geometry)) {
      for (const [ringIndex, ring] of polygon.entries()) {
        if (!ring.length) continue;
        d += `M${ring
          .map(([lon, lat]) => `${x(lon).toFixed(1)},${y(lat).toFixed(1)}`)
          .join("L")}Z`;
        if (ringIndex === 0 && ring.length > bestRingLength) {
          bestRingLength = ring.length;
          bestRing = ring;
        }
      }
    }

    if (bestRing) {
      const total = bestRing.reduce(
        (acc, [lon, lat]) => {
          acc.x += x(lon);
          acc.y += y(lat);
          return acc;
        },
        { x: 0, y: 0 }
      );
      cx = total.x / bestRing.length;
      cy = total.y / bestRing.length;
    }

    paths.push(
      `<path class="choropleth__area" d="${d}" fill="${fillFor(count)}" fill-rule="evenodd" data-kel-filter="${escapeHtml(name)}" tabindex="0" role="button" aria-label="Kelurahan ${escapeHtml(name)}, ${count} UMKM">
        <title>Kel. ${escapeHtml(name)} — ${count} UMKM</title>
      </path>`
    );

    if (count > 0) {
      candidates.push({ name, count, cx, cy });
    }
  }

  // Label prioritas tinggi lebih dulu; lewati label yang bertabrakan.
  candidates.sort((a, b) => b.count - a.count);
  const placed = [];
  const labels = [];
  const fontSize = 8.8;

  for (const candidate of candidates) {
    const text = SHORT_KELURAHAN[candidate.name] || candidate.name;
    const halfW = (text.length * fontSize * 0.56) / 2 + 1.5;
    const halfH = fontSize / 2 + 1.5;
    const box = {
      x0: candidate.cx - halfW,
      y0: candidate.cy - halfH,
      x1: candidate.cx + halfW,
      y1: candidate.cy + halfH,
    };
    const collides = placed.some(
      (other) =>
        !(
          box.x1 < other.x0 ||
          box.x0 > other.x1 ||
          box.y1 < other.y0 ||
          box.y0 > other.y1
        )
    );
    if (collides) continue;
    placed.push(box);
    labels.push(
      `<text class="choropleth__label${candidate.count >= 5 ? " choropleth__label--light" : ""}" x="${candidate.cx.toFixed(1)}" y="${(candidate.cy + fontSize * 0.35).toFixed(1)}" text-anchor="middle">${escapeHtml(text)}</text>`
    );
  }

  return `<svg class="choropleth-svg" viewBox="${viewX.toFixed(1)} ${viewY.toFixed(1)} ${viewW.toFixed(1)} ${viewH.toFixed(1)}" role="img" aria-label="Peta choropleth jumlah UMKM per kelurahan di Pekanbaru">
    ${paths.join("")}
    ${labels.join("")}
  </svg>`;
}

function categoryBars(meta) {
  const entries = Object.entries(meta.kategori).sort((a, b) => b[1].jumlah - a[1].jumlah);
  const max = Math.max(...entries.map(([, info]) => info.jumlah), 1);
  return entries
    .map(
      ([key, info], index) => `<button class="bar-row" type="button" data-cat-filter="${key}">
        <span class="bar-row__label"><span class="bar-row__dot" style="background:${CATEGORY_COLORS[key]}"></span>${escapeHtml(info.label)}</span>
        <span class="bar-row__track"><span class="bar-row__fill" style="width:${(info.jumlah / max) * 100}%;background:${CATEGORY_COLORS[key]};animation-delay:${index * 45}ms"></span></span>
        <span class="bar-row__value">${info.jumlah}</span>
      </button>`
    )
    .join("");
}

function kecamatanBars(meta) {
  const entries = Object.entries(meta.kecamatan).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, count]) => count), 1);
  const inside = entries.reduce((sum, [, count]) => sum + count, 0);
  const outside = meta.jumlah - inside;
  const rows = entries
    .map(
      ([name, count]) => `<div class="kec-row">
        <span class="kec-row__name">${escapeHtml(name)}</span>
        <span class="kec-row__track"><span class="kec-row__fill" style="width:${(count / max) * 100}%"></span></span>
        <span class="kec-row__value">${count}</span>
      </div>`
    )
    .join("");
  return `${rows}
    ${
      outside > 0
        ? `<div class="kec-row">
            <span class="kec-row__name" style="color:var(--muted)">Luar batas</span>
            <span class="kec-row__track"><span class="kec-row__fill" style="width:${(outside / max) * 100}%;background:var(--line-strong)"></span></span>
            <span class="kec-row__value">${outside}</span>
          </div>`
        : ""
    }`;
}

function donut(meta) {
  const pct = meta.jumlah ? meta.marketplace / meta.jumlah : 0;
  const r = 54;
  const c = 2 * Math.PI * r;
  const connected = meta.marketplace;
  const notConnected = meta.jumlah - connected;
  return `<div class="donut-wrap">
    <div class="donut-center">
      <svg class="donut" viewBox="0 0 132 132" role="img" aria-label="${Math.round(pct * 100)} persen usaha terhubung marketplace">
        <circle class="donut__track" cx="66" cy="66" r="${r}" />
        <circle class="donut__value" cx="66" cy="66" r="${r}" stroke-dasharray="${(pct * c).toFixed(1)} ${c.toFixed(1)}" />
      </svg>
      <div class="donut-center__inner">
        <strong>${Math.round(pct * 100)}%</strong>
        <span>${connected} dari ${meta.jumlah}<br />usaha</span>
      </div>
    </div>
    <div class="donut-legend">
      <span class="donut-legend__item"><span class="donut-legend__swatch" style="background:var(--brand)"></span>Sudah terhubung <span class="donut-legend__value">${connected}</span></span>
      <span class="donut-legend__item"><span class="donut-legend__swatch" style="background:var(--surface-2)"></span>Belum terhubung <span class="donut-legend__value">${notConnected}</span></span>
    </div>
  </div>
  <p class="donut-note">Marketplace menandai usaha yang sudah punya kanal jualan digital. Sebagian besar UMKM pada data masih mengandalkan penjualan langsung.</p>`;
}

function scatter(items) {
  const W = 640;
  const H = 360;
  const left = 56;
  const right = 16;
  const top = 22;
  const bottom = 42;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const xMax = 25;
  const logMin = Math.log10(5e5);
  const logMax = Math.log10(1e8);

  const x = (value) => left + (value / xMax) * plotW;
  const y = (value) =>
    top + (1 - (Math.log10(Math.max(value, 5e5)) - logMin) / (logMax - logMin)) * plotH;

  const xTicks = [0, 5, 10, 15, 20, 25];
  const yTicks = [1e6, 3e6, 1e7, 3e7];

  const grid = [
    ...yTicks.map(
      (value) =>
        `<line class="scatter__grid" x1="${left}" x2="${W - right}" y1="${y(value).toFixed(1)}" y2="${y(value).toFixed(1)}" />`
    ),
    ...xTicks.map(
      (value) =>
        `<line class="scatter__grid" x1="${x(value).toFixed(1)}" x2="${x(value).toFixed(1)}" y1="${top}" y2="${H - bottom}" />`
    ),
  ].join("");

  const xLabels = xTicks
    .map(
      (value) =>
        `<text class="scatter__axis" x="${x(value).toFixed(1)}" y="${H - bottom + 15}" text-anchor="middle">${value}</text>`
    )
    .join("");

  const yLabels = yTicks
    .map(
      (value) =>
        `<text class="scatter__axis" x="${left - 8}" y="${(y(value) + 3).toFixed(1)}" text-anchor="end">${compactRupiah(value).replace("Rp", "")}</text>`
    )
    .join("");

  const points = items
    .map((item) => {
      const radius = 5 + Math.sqrt(item.pekerja || 1) * 1.7;
      const cx = x(item.lamaUsaha || 0);
      const cy = y(item.omzet);
      const color = CATEGORY_COLORS[item.kategori] || "#12594A";
      return `<circle class="scatter__point" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${radius.toFixed(1)}" fill="${color}" fill-opacity="0.88" data-umkm-id="${item.id}" tabindex="0" role="button" aria-label="${escapeHtml(item.nama)}, ${years(item.lamaUsaha)}, omzet ${tierLabel(item.omzetTier)}">
        <title>${escapeHtml(item.nama)} — ${years(item.lamaUsaha)} · ${compactRupiah(item.omzet)}/bln</title>
      </circle>`;
    })
    .join("");

  return `<svg class="scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sebaran lama usaha dan omzet bulanan UMKM">
    ${grid}
    <line x1="${left}" x2="${left}" y1="${top}" y2="${H - bottom}" stroke="var(--line-strong)" />
    <line x1="${left}" x2="${W - right}" y1="${H - bottom}" y2="${H - bottom}" stroke="var(--line-strong)" />
    ${xLabels}${yLabels}
    <text class="scatter__axis-title" x="${left}" y="${top - 8}">Omzet / bulan (skala log)</text>
    <text class="scatter__axis-title" x="${W - right}" y="${H - 8}" text-anchor="end">Lama usaha (tahun)</text>
    ${points}
  </svg>`;
}

export function renderInsight(container, { meta, items, boundaries }) {
  const topCategory = Object.entries(meta.kategori).sort((a, b) => b[1].jumlah - a[1].jumlah)[0];
  const marketplacePct = Math.round((meta.marketplace / meta.jumlah) * 100);
  const kelurahanCount = Object.keys(meta.kelurahan).length;
  const ranking = Object.entries(meta.kelurahan).sort((a, b) => b[1] - a[1]);
  const maxKel = Math.max(...ranking.map(([, count]) => count), 1);

  const legend = [
    ["0", "#EDE6D8"],
    ["1–2", "#DCEBE3"],
    ["3–4", "#B3D6C6"],
    ["5–6", "#7BB6A0"],
    ["7+", "#12594A"],
  ]
    .map(
      ([label, color]) =>
        `<span class="legend-scale__row"><span class="legend-scale__swatch" style="background:${color}"></span>${label} UMKM</span>`
    )
    .join("");

  const topList = ranking
    .slice(0, 5)
    .map(
      ([name, count]) => `<button class="top-list__item" type="button" data-kel-filter="${escapeHtml(name)}">
        <span class="top-list__name">${escapeHtml(name)}</span>
        <span class="top-list__bar"><span style="width:${(count / maxKel) * 100}%"></span></span>
        <span class="top-list__value">${count}</span>
      </button>`
    )
    .join("");

  container.innerHTML = `<div class="page__head">
    <div>
      <p class="eyebrow"><span class="eyebrow__dot"></span>Potret wilayah</p>
      <h1 id="insightTitle">Pekanbaru dalam <em>angka.</em></h1>
      <p class="page__lead">${meta.jumlah} UMKM yang tersebar di ${kelurahanCount} kelurahan, dilihat dari kategori, skala omzet, dan jejak digitalnya.</p>
    </div>
    <div class="page__aside">
      <span class="data-pill"><span class="dot"></span>Data survei · ${dateID(meta.dibuatPada)}</span>
      <span class="page__date">Sumber: GIS.xlsx · ${meta.jumlah} titik</span>
    </div>
  </div>

  <div class="stat-row">
    <div class="stat-card">
      <span class="stat-card__label">Usaha terdata</span>
      <strong class="stat-card__value">${meta.jumlah}</strong>
      <span class="stat-card__sub">di ${kelurahanCount} kelurahan dan 3 kecamatan</span>
    </div>
    <div class="stat-card">
      <span class="stat-card__label">Kategori terbanyak</span>
      <strong class="stat-card__value">${topCategory[1].jumlah} <small>usaha</small></strong>
      <span class="stat-card__sub">${escapeHtml(topCategory[1].label)} mendominasi sebaran</span>
    </div>
    <div class="stat-card">
      <span class="stat-card__label">Jejak digital</span>
      <strong class="stat-card__value">${marketplacePct}%</strong>
      <span class="stat-card__sub">${meta.marketplace} usaha sudah terhubung marketplace</span>
    </div>
    <div class="stat-card">
      <span class="stat-card__label">Median omzet</span>
      <strong class="stat-card__value">${compactRupiah(meta.medianOmzet)}</strong>
      <span class="stat-card__sub">per bulan, dari ${meta.jumlah} catatan survei</span>
    </div>
  </div>

  <div class="insight-grid">
    <article class="panel-card">
      <div class="panel-card__head">
        <div>
          <h2>Kategori usaha</h2>
          <p>Komposisi jenis usaha pada dataset.</p>
        </div>
        <span class="panel-card__tag">Klik untuk filter</span>
      </div>
      <div class="bar-list">${categoryBars(meta)}</div>
      <p class="chart-note">${icon("info")}Kuliner dan warung kuliner digabung; toko buku dan elektronik dipetakan ke Toko &amp; Retail.</p>
    </article>

    <article class="panel-card">
      <div class="panel-card__head">
        <div>
          <h2>Jejak marketplace</h2>
          <p>Berapa banyak yang sudah go-digital?</p>
        </div>
      </div>
      ${donut(meta)}
    </article>

    <article class="panel-card panel-card--wide">
      <div class="panel-card__head">
        <div>
          <h2>Sebaran per kelurahan</h2>
          <p>Jumlah UMKM terdata di tiap kelurahan Pekanbaru.</p>
        </div>
        <span class="panel-card__tag">Choropleth</span>
      </div>
      <div class="choropleth-layout">
        <div>
          <div class="choropleth-frame">${choroplethSVG(boundaries, meta.kelurahan)}</div>
          <div class="legend-scale">${legend}</div>
        </div>
        <aside class="choropleth-side">
          <h3>Kelurahan terbanyak</h3>
          <div class="top-list">${topList}</div>
          <p class="choropleth-side__note">Klik kelurahan pada peta atau daftar untuk melihat usaha di wilayah tersebut.</p>
        </aside>
      </div>
    </article>

    <article class="panel-card">
      <div class="panel-card__head">
        <div>
          <h2>Lama usaha vs omzet</h2>
          <p>Apakah usaha yang lebih tua punya omzet lebih besar?</p>
        </div>
        <span class="panel-card__tag">${items.length} titik</span>
      </div>
      <div class="scatter-wrap">${scatter(items)}</div>
      <p class="chart-note">${icon("info")}Ukuran titik = jumlah pekerja. Sumbu omzet memakai skala log agar outlier tetap terbaca.</p>
    </article>

    <article class="panel-card">
      <div class="panel-card__head">
        <div>
          <h2>Sebaran kecamatan</h2>
          <p>Tampan dan Rumbai memuat hampir seluruh titik.</p>
        </div>
      </div>
      <div class="kec-list">${kecamatanBars(meta)}</div>
      <p class="chart-note">${icon("map-pin")}Satu titik berada di luar batas kelurahan acuan dan tidak dihitung pada bar kecamatan.</p>
    </article>
  </div>

  <div class="insight-foot">${icon("database")}
    <span>Angka dihitung langsung dari <strong>${meta.jumlah} baris survei</strong>. Omzet ditampilkan sebagai tier pada antarmuka untuk menjaga kewajaran data usaha. Baca <a href="?view=tentang">metode dan kamus data</a> untuk detailnya.</span>
  </div>`;
}

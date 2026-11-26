import "ol/ol.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";
import "./styles/map.css";
import "./styles/pages.css";

import { hydrateIcons, icon } from "./lib/icons.js";
import { haversine, bboxCenter } from "./lib/geo.js";
import {
  readState,
  buildSearch,
  writeState,
  shareUrl,
  defaultOrigin,
  applyFilters,
  activeFilterList,
  countActiveFilters,
} from "./state.js";
import { createMap } from "./map.js";
import {
  renderChips,
  renderCards,
  renderActiveFilters,
  renderLegend,
  renderSkeleton,
  resultLabel,
} from "./ui/explore.js";
import { renderDetail } from "./ui/detail.js";
import { renderInsight } from "./ui/insight.js";
import { renderAbout } from "./ui/about.js";

const ORIGIN_KEY = "sekitar:origin";
const MOBILE_QUERY = "(max-width: 880px)";

const el = (id) => document.getElementById(id);

const els = {
  explore: el("explore"),
  insight: el("insight"),
  tentang: el("tentang"),
  panel: el("panel"),
  panelScroll: el("panelScroll"),
  mapShell: el("mapShell"),
  mapLoading: el("mapLoading"),
  categoryChips: el("categoryChips"),
  searchInput: el("searchInput"),
  searchClear: el("searchClear"),
  radiusSelect: el("radiusSelect"),
  sortSelect: el("sortSelect"),
  filterBtn: el("filterBtn"),
  filterCount: el("filterCount"),
  filterDialog: el("filterDialog"),
  filterForm: el("filterForm"),
  filterTier: el("filterTier"),
  filterKelurahan: el("filterKelurahan"),
  filterMarketplace: el("filterMarketplace"),
  filterClose: el("filterClose"),
  filterReset: el("filterReset"),
  filterApply: el("filterApply"),
  activeFilters: el("activeFilters"),
  resultList: el("resultList"),
  resultCount: el("resultCount"),
  resetFilters: el("resetFilters"),
  locateBtn: el("locateBtn"),
  locateLabel: el("locateLabel"),
  locNote: el("locNote"),
  mapLocate: el("mapLocate"),
  zoomIn: el("zoomIn"),
  zoomOut: el("zoomOut"),
  mapFullscreen: el("mapFullscreen"),
  layerBtn: el("layerBtn"),
  layerMenu: el("layerMenu"),
  toggleBoundary: el("toggleBoundary"),
  toggleClusters: el("toggleClusters"),
  legendToggle: el("legendToggle"),
  legendBody: el("legendBody"),
  sheetHandle: el("sheetHandle"),
  sheetSummary: document.querySelector(".sheet-summary"),
  sheetFilterBtn: el("sheetFilterBtn"),
  sheetCount: el("sheetCount"),
  sheetSub: el("sheetSub"),
  mapCount: el("mapCount"),
  headerCount: el("headerCount"),
  detail: el("detail"),
  toast: el("toast"),
  introSub: el("introSub"),
};

let meta = null;
let items = [];
let boundaries = null;
let byId = new Map();
let bySlug = new Map();

let state = null;
let filtered = [];
let detailItem = null;
let mapApi = null;
let mapViewInitialized = false;
let toastTimer = null;
let searchTimer = null;
let viewTimer = null;

const titles = {
  explore: "Sekitar — Usaha lokal di sekitarmu",
  insight: "Insight — Sekitar",
  tentang: "Tentang — Sekitar",
};

/* --------------------------------------------------------------------------
   Util
   -------------------------------------------------------------------------- */

function onMobile() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function toast(message, duration = 3200) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, duration);
}

async function copyText(text, message) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      toast(message);
    } catch {
      toast("Tidak bisa menyalin otomatis. Salin manual dari teks.");
    } finally {
      area.remove();
    }
  }
}

function loadStoredOrigin() {
  try {
    const raw = sessionStorage.getItem(ORIGIN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon)) {
        return { ...parsed, source: "user" };
      }
    }
  } catch {
    /* ignore */
  }
  return defaultOrigin(meta);
}

function storeOrigin(origin) {
  try {
    if (origin.source === "user") {
      sessionStorage.setItem(
        ORIGIN_KEY,
        JSON.stringify({ lat: origin.lat, lon: origin.lon, label: origin.label })
      );
    } else {
      sessionStorage.removeItem(ORIGIN_KEY);
    }
  } catch {
    /* ignore */
  }
}

/* --------------------------------------------------------------------------
   Render
   -------------------------------------------------------------------------- */

function applyAndRender({ fit = false } = {}) {
  if (!meta) return;

  filtered = applyFilters(items, state);

  renderChips(els.categoryChips, meta, state.kategori);
  renderActiveFilters(els.activeFilters, activeFilterList(state, meta), removeFilter);
  renderCards(els.resultList, filtered, {
    selectedId: detailItem?.id ?? null,
    query: state.q,
    hrefFor: (item) => buildSearch(state, { usaha: item.slug }),
    onReset: resetFilters,
  });

  els.resultCount.innerHTML = resultLabel(filtered.length, state);
  els.sheetCount.textContent = `${filtered.length} usaha`;
  els.sheetSub.textContent =
    state.origin?.source === "user" ? "di sekitar lokasi Anda" : "di Pekanbaru";
  els.mapCount.textContent = `${filtered.length} titik`;

  const filterCount = countActiveFilters(state);
  els.filterCount.textContent = filterCount;
  els.filterCount.hidden = filterCount === 0;

  els.resetFilters.hidden =
    !filterCount && !state.q && state.kategori === "semua";

  if (document.activeElement !== els.searchInput) {
    els.searchInput.value = state.q;
  }
  els.searchClear.hidden = !state.q;
  els.radiusSelect.value = String(state.radius);
  els.sortSelect.value = state.sort;

  updateOriginNote();

  if (mapApi) {
    mapApi.setFeatures(filtered);
    mapApi.setOrigin(state.origin, state.radius);
    mapApi.setSelected(detailItem?.id ?? null);
    if (fit) {
      if (filtered.length) mapApi.fitItems(filtered, true);
      else mapApi.flyTo(state.origin.lat, state.origin.lon, 13.6);
    }
  }
}

function updateOriginNote() {
  if (state.origin?.source === "user") {
    els.locateLabel.textContent = "Lokasi aktif";
    els.locNote.innerHTML =
      'Jarak dihitung dari lokasi Anda. <button type="button" data-reset-origin>Pakai pusat kota</button>';
  } else {
    els.locateLabel.textContent = "Lokasi saya";
    els.locNote.innerHTML =
      'Jarak dihitung dari pusat Pekanbaru. <button type="button" data-locate-inline>Aktifkan lokasi</button>';
  }
}

function renderDetailPane({ focus = false } = {}) {
  if (!detailItem) {
    els.detail.classList.remove("is-open");
    els.detail.setAttribute("aria-hidden", "true");
    els.detail.innerHTML = "";
    return;
  }

  const jarak = haversine(
    state.origin.lat,
    state.origin.lon,
    detailItem.lat,
    detailItem.lon
  );
  const nearby = items
    .filter((other) => other.id !== detailItem.id)
    .map((other) => ({
      ...other,
      jarak: haversine(detailItem.lat, detailItem.lon, other.lat, other.lon),
    }))
    .sort((a, b) => a.jarak - b.jarak)
    .slice(0, 3);

  renderDetail(els.detail, { ...detailItem, jarak }, nearby, {
    hrefFor: (other) => buildSearch(state, { usaha: other.slug }),
  });

  els.detail.classList.add("is-open");
  els.detail.setAttribute("aria-hidden", "false");
  updateSelectedCard();

  if (focus) {
    els.detail.querySelector("[data-close]")?.focus({ preventScroll: true });
  }
}

function updateSelectedCard() {
  const selectedId = detailItem?.id ?? null;
  els.resultList.querySelectorAll(".card").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.id === selectedId);
  });
}

function syncDetailFromState({ fly = false, focus = false } = {}) {
  let item = state.usaha ? bySlug.get(state.usaha) : null;
  if (state.usaha && !item) {
    state.usaha = null;
    writeState(state, { replace: true });
    toast("Usaha yang diminta tidak ditemukan.");
  }
  detailItem = item || null;
  renderDetailPane({ focus });
  mapApi?.setSelected(detailItem?.id ?? null);
  if (item && fly) mapApi?.flyToItem(item);
  if (item && onMobile()) setSheet("peek");
}

function setView(view, { initial = false } = {}) {
  state.view = view;
  document.body.dataset.view = view;
  els.explore.hidden = view !== "explore";
  els.insight.hidden = view !== "insight";
  els.tentang.hidden = view !== "tentang";
  document.title = titles[view] || titles.explore;

  document.querySelectorAll("[data-nav]").forEach((link) => {
    const active = link.dataset.nav === view;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  if (view === "insight" && meta && !els.insight.dataset.rendered) {
    renderInsight(els.insight, { meta, items, boundaries });
    els.insight.dataset.rendered = "1";
  }
  if (view === "tentang" && meta && !els.tentang.dataset.rendered) {
    renderAbout(els.tentang, meta);
    els.tentang.dataset.rendered = "1";
  }

  if (view === "explore") {
    ensureMapVisible();
  } else if (!initial) {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}

function ensureMapVisible() {
  if (!mapApi) return;
  requestAnimationFrame(() => {
    mapApi.updateSize();
    updateSheetOffset();
    if (!mapViewInitialized) {
      mapViewInitialized = true;
      const restored =
        state.viewLat != null &&
        state.viewLng != null &&
        mapApi.restoreView({
          lat: state.viewLat,
          lng: state.viewLng,
          zoom: state.viewZoom,
        });
      if (!restored) mapApi.fitAll(false);
      if (detailItem) {
        window.setTimeout(() => mapApi.flyToItem(detailItem), 320);
      }
    }
  });
}

/* --------------------------------------------------------------------------
   Navigation
   -------------------------------------------------------------------------- */

function navigateHref(href) {
  const raw = href.startsWith("?") ? href.slice(1) : href.split("?")[1] || "";
  const params = new URLSearchParams(raw);
  const nextView = params.get("view") || state.view;
  const nextUsaha = params.has("usaha")
    ? params.get("usaha")
    : params.has("view")
      ? null
      : state.usaha;

  const changedView = nextView !== state.view;
  state.view = nextView;
  state.usaha = nextUsaha || null;

  writeState(state, { push: true });
  if (changedView) setView(nextView);
  syncDetailFromState({ fly: Boolean(nextUsaha), focus: Boolean(nextUsaha) });
}

function openItem(item) {
  if (!item) return;
  state.view = "explore";
  state.usaha = item.slug;
  writeState(state, { push: true });
  if (els.explore.hidden) setView("explore");
  detailItem = item;
  renderDetailPane({ focus: true });
  mapApi?.setSelected(item.id);
  mapApi?.flyToItem(item);
  if (onMobile()) setSheet("peek");
}

function closeDetail() {
  if (!state.usaha && !detailItem) return;
  state.usaha = null;
  detailItem = null;
  writeState(state);
  renderDetailPane();
  mapApi?.setSelected(null);
}

function resetFilters() {
  state.q = "";
  state.kategori = "semua";
  state.radius = 0;
  state.tier = "semua";
  state.kelurahan = "semua";
  state.marketplace = false;
  state.sort = "terdekat";
  state.usaha = null;
  detailItem = null;
  writeState(state);
  renderDetailPane();
  mapApi?.setSelected(null);
  applyAndRender({ fit: true });
  els.searchInput.value = "";
}

function removeFilter(key) {
  if (key === "radius") state.radius = 0;
  if (key === "tier") state.tier = "semua";
  if (key === "kelurahan") state.kelurahan = "semua";
  if (key === "marketplace") state.marketplace = false;
  writeState(state);
  applyAndRender({ fit: key === "radius" });
}

/* --------------------------------------------------------------------------
   Geolocation
   -------------------------------------------------------------------------- */

function locate() {
  if (!navigator.geolocation) {
    toast("Peramban ini tidak mendukung geolokasi.");
    return;
  }
  els.locateBtn.classList.add("is-loading");
  navigator.geolocation.getCurrentPosition(onLocateSuccess, onLocateError, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 60000,
  });
}

function onLocateSuccess(position) {
  els.locateBtn.classList.remove("is-loading");
  const { latitude: lat, longitude: lon, accuracy } = position.coords;
  const center = bboxCenter(meta.bbox);
  const fromArea = haversine(lat, lon, center.lat, center.lon);

  if (fromArea > 40000) {
    state.origin = defaultOrigin(meta);
    storeOrigin(state.origin);
    toast("Lokasi Anda jauh dari area data. Jarak dihitung dari pusat Pekanbaru.");
    writeState(state);
    applyAndRender({ fit: true });
    return;
  }

  state.origin = {
    lat,
    lon,
    label: "Lokasi saya",
    source: "user",
    accuracy: accuracy ? Math.round(accuracy) : null,
  };
  storeOrigin(state.origin);
  state.radius = 1000;
  state.usaha = null;
  detailItem = null;
  renderDetailPane();
  writeState(state);

  applyAndRender();

  const onlyRadius =
    !state.q &&
    state.kategori === "semua" &&
    state.tier === "semua" &&
    state.kelurahan === "semua" &&
    !state.marketplace;

  let appliedRadius = 1000;
  if (onlyRadius && !filtered.length) {
    appliedRadius = 2000;
    state.radius = 2000;
    writeState(state);
    applyAndRender();
  }
  if (onlyRadius && !filtered.length) {
    appliedRadius = 0;
    state.radius = 0;
    writeState(state);
    applyAndRender();
  }

  const accuracyNote = state.origin.accuracy
    ? ` (±${state.origin.accuracy} m)`
    : "";
  if (appliedRadius > 0) {
    toast(
      `Lokasi ditemukan${accuracyNote}. Radius ${appliedRadius / 1000} km diterapkan.`
    );
  } else {
    toast("Belum ada usaha dalam 2 km. Radius diperluas ke seluruh kota.");
  }

  mapApi?.setOrigin(state.origin, state.radius);
  if (filtered.length) mapApi?.fitItems(filtered, true);
  else mapApi?.flyTo(lat, lon, 14);
}

function onLocateError(error) {
  els.locateBtn.classList.remove("is-loading");
  const message =
    error.code === 1
      ? "Izin lokasi ditolak. Jarak tetap dihitung dari pusat Pekanbaru."
      : "Lokasi tidak tersedia. Jarak tetap dihitung dari pusat Pekanbaru.";
  toast(message);
}

/* --------------------------------------------------------------------------
   Filter dialog
   -------------------------------------------------------------------------- */

function fillKelurahanOptions() {
  const names = Object.entries(meta.kelurahan)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id"))
    .map(([name, count]) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = `${name} (${count})`;
      return option;
    });
  const outside = document.createElement("option");
  outside.value = "luar";
  outside.textContent = "Luar batas kelurahan (1)";
  const frag = document.createDocumentFragment();
  names.forEach((option) => frag.appendChild(option));
  frag.appendChild(outside);
  els.filterKelurahan.appendChild(frag);
}

function openFilterDialog() {
  const checked = els.filterForm.querySelector(
    `input[name="filterRadius"][value="${state.radius}"]`
  );
  els.filterForm
    .querySelectorAll('input[name="filterRadius"]')
    .forEach((radio) => {
      radio.checked = radio === checked;
    });
  els.filterTier.value = state.tier;
  els.filterKelurahan.value = state.kelurahan;
  els.filterMarketplace.checked = state.marketplace;
  if (!els.filterDialog.open) els.filterDialog.showModal();
}

function applyFilterDialog() {
  const checked = els.filterForm.querySelector(
    'input[name="filterRadius"]:checked'
  );
  const nextRadius = checked ? Number(checked.value) : 0;
  const radiusChanged = nextRadius !== state.radius;

  state.radius = nextRadius;
  state.tier = els.filterTier.value;
  state.kelurahan = els.filterKelurahan.value;
  state.marketplace = els.filterMarketplace.checked;

  if (els.filterDialog.open) els.filterDialog.close();
  writeState(state);
  applyAndRender({ fit: radiusChanged });
  if (radiusChanged && onMobile()) setSheet("half");
}

function resetFilterDialog() {
  els.filterForm
    .querySelectorAll('input[name="filterRadius"]')
    .forEach((radio) => {
      radio.checked = radio.value === "0";
    });
  els.filterTier.value = "semua";
  els.filterKelurahan.value = "semua";
  els.filterMarketplace.checked = false;
}

/* --------------------------------------------------------------------------
   Mobile sheet
   -------------------------------------------------------------------------- */

const SHEET_ORDER = ["peek", "half", "full"];

function setSheet(mode) {
  if (!onMobile()) return;
  els.panel.classList.remove("is-peek", "is-half", "is-full");
  els.panel.classList.add(`is-${mode}`);
  window.setTimeout(() => {
    mapApi?.updateSize();
    updateSheetOffset();
  }, 340);
}

function currentSheet() {
  if (els.panel.classList.contains("is-peek")) return "peek";
  if (els.panel.classList.contains("is-full")) return "full";
  return "half";
}

function cycleSheet() {
  const index = SHEET_ORDER.indexOf(currentSheet());
  setSheet(SHEET_ORDER[(index + 1) % SHEET_ORDER.length]);
}

function updateSheetOffset() {
  if (!els.mapShell) return;
  const offset = onMobile() ? Math.max(0, els.panel.offsetHeight - 10) : 0;
  els.mapShell.style.setProperty("--sheet-offset", `${offset}px`);
}

/* --------------------------------------------------------------------------
   Map
   -------------------------------------------------------------------------- */

function initMap() {
  mapApi = createMap({
    target: "map",
    items,
    boundaries,
    onSelect: (id) => {
      const item = byId.get(id);
      if (item) openItem(item);
    },
    onBoundaryClick: (kelurahan, jumlah) => {
      state.kelurahan = kelurahan;
      state.usaha = null;
      detailItem = null;
      state.view = "explore";
      renderDetailPane();
      writeState(state);
      applyAndRender({ fit: true });
      toast(`Menampilkan ${jumlah} usaha di Kel. ${kelurahan}.`);
    },
    onBackgroundClick: () => {
      if (state.usaha) closeDetail();
      els.layerMenu.hidden = true;
      els.layerBtn.setAttribute("aria-expanded", "false");
    },
    onViewChange: ({ lat, lng, zoom }) => {
      state.viewLat = lat;
      state.viewLng = lng;
      state.viewZoom = zoom;
      window.clearTimeout(viewTimer);
      viewTimer = window.setTimeout(() => {
        writeState(state);
      }, 380);
    },
    onTileError: () => {
      toast("Peta dasar gagal dimuat. Periksa koneksi internet — data usaha tetap tersedia.");
    },
  });
}

/* --------------------------------------------------------------------------
   Static wiring
   -------------------------------------------------------------------------- */

function focusSearch() {
  if (state.view !== "explore") {
    state.view = "explore";
    state.usaha = null;
    writeState(state, { replace: true });
    setView("explore");
    syncDetailFromState();
  }
  if (onMobile()) setSheet("half");
  window.setTimeout(() => {
    els.searchInput.focus({ preventScroll: true });
    els.searchInput.select();
  }, 80);
}

function bindStatic() {
  hydrateIcons();

  // Search
  els.searchInput.addEventListener("input", () => {
    const value = els.searchInput.value;
    els.searchClear.hidden = !value;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.q = value.trim();
      writeState(state);
      applyAndRender();
    }, 170);
  });
  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      window.clearTimeout(searchTimer);
      state.q = els.searchInput.value.trim();
      writeState(state);
      applyAndRender();
    }
  });
  els.searchClear.addEventListener("click", () => {
    els.searchInput.value = "";
    els.searchClear.hidden = true;
    state.q = "";
    writeState(state);
    applyAndRender();
    els.searchInput.focus();
  });

  // Category chips
  els.categoryChips.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-kategori]");
    if (!chip) return;
    state.kategori = chip.dataset.kategori;
    writeState(state);
    applyAndRender();
  });

  // Radius + sort
  els.radiusSelect.addEventListener("change", () => {
    state.radius = Number(els.radiusSelect.value);
    writeState(state);
    applyAndRender({ fit: true });
  });
  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    writeState(state);
    applyAndRender();
  });

  // Reset
  els.resetFilters.addEventListener("click", resetFilters);

  // Location
  els.locateBtn.addEventListener("click", locate);
  els.mapLocate.addEventListener("click", locate);
  els.locNote.addEventListener("click", (event) => {
    if (event.target.closest("[data-reset-origin]")) {
      state.origin = defaultOrigin(meta);
      storeOrigin(state.origin);
      state.radius = 0;
      writeState(state);
      applyAndRender({ fit: true });
      mapApi?.setOrigin(state.origin, state.radius);
      toast("Jarak dihitung dari pusat Pekanbaru.");
    }
    if (event.target.closest("[data-locate-inline]")) locate();
  });

  // Filter dialog
  [els.filterBtn, els.sheetFilterBtn].forEach((button) => {
    button?.addEventListener("click", openFilterDialog);
  });
  els.filterClose.addEventListener("click", () => els.filterDialog.close());
  els.filterReset.addEventListener("click", resetFilterDialog);
  els.filterApply.addEventListener("click", applyFilterDialog);
  els.filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilterDialog();
  });
  els.filterDialog.addEventListener("click", (event) => {
    if (event.target === els.filterDialog) els.filterDialog.close();
  });

  // Map controls
  els.zoomIn.addEventListener("click", () => mapApi?.zoomBy(0.8));
  els.zoomOut.addEventListener("click", () => mapApi?.zoomBy(-0.8));

  document.querySelectorAll("[data-basemap]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.basemap;
      document.querySelectorAll("[data-basemap]").forEach((other) => {
        other.setAttribute("aria-pressed", String(other === button));
      });
      mapApi?.setBasemap(kind);
    });
  });

  els.layerBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = els.layerMenu.hidden;
    els.layerMenu.hidden = !open;
    els.layerBtn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".layer-wrap")) {
      els.layerMenu.hidden = true;
      els.layerBtn.setAttribute("aria-expanded", "false");
    }
  });
  els.toggleBoundary.addEventListener("change", () => {
    mapApi?.setBoundaryVisible(els.toggleBoundary.checked);
  });
  els.toggleClusters.addEventListener("change", () => {
    mapApi?.setClustersEnabled(els.toggleClusters.checked);
  });

  els.legendToggle.addEventListener("click", () => {
    const expanded = els.legendToggle.getAttribute("aria-expanded") === "true";
    els.legendToggle.setAttribute("aria-expanded", String(!expanded));
  });

  els.mapFullscreen.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await els.mapShell.requestFullscreen();
      }
    } catch {
      toast("Layar penuh tidak didukung di peramban ini.");
    }
    window.setTimeout(() => mapApi?.updateSize(), 260);
  });

  // Mobile sheet
  els.sheetHandle.addEventListener("click", cycleSheet);
  els.sheetSummary?.addEventListener("click", (event) => {
    if (event.target.closest("#sheetFilterBtn")) return;
    if (currentSheet() === "peek") setSheet("half");
  });

  // Detail interactions
  els.detail.addEventListener("click", async (event) => {
    if (event.target.closest("[data-close]")) {
      event.preventDefault();
      closeDetail();
      return;
    }

    const reveal = event.target.closest("[data-reveal]");
    if (reveal) {
      const exact = els.detail.querySelector("[data-omzet-exact]");
      if (exact) {
        const show = exact.hidden;
        exact.hidden = !show;
        reveal.textContent = show ? "Sembunyikan angka" : "Lihat angka";
      }
      return;
    }

    const copyCoord = event.target.closest("[data-copy-coord]");
    if (copyCoord && detailItem) {
      event.preventDefault();
      await copyText(
        `${detailItem.lat.toFixed(6)}, ${detailItem.lon.toFixed(6)}`,
        "Koordinat disalin."
      );
      return;
    }

    const copy = event.target.closest("[data-copy]");
    if (copy && detailItem) {
      event.preventDefault();
      await copyText(shareUrl(state, detailItem.slug), "Tautan usaha disalin.");
      return;
    }

    const share = event.target.closest("[data-share]");
    if (share && detailItem) {
      event.preventDefault();
      const url = shareUrl(state, detailItem.slug);
      if (navigator.share) {
        try {
          await navigator.share({
            title: detailItem.nama,
            text: `${detailItem.nama} — ${detailItem.kategori} di Pekanbaru`,
            url,
          });
        } catch {
          /* dibatalkan pengguna */
        }
      } else {
        await copyText(url, "Tautan disalin untuk dibagikan.");
      }
    }
  });

  // Insight interactions
  els.insight.addEventListener("click", (event) => {
    const category = event.target.closest("[data-cat-filter]");
    if (category) {
      const key = category.dataset.catFilter;
      state.kategori = key;
      state.usaha = null;
      detailItem = null;
      renderDetailPane();
      writeState(state, { push: true });
      setView("explore");
      applyAndRender({ fit: true });
      toast(`Menampilkan kategori ${meta.kategori[key]?.label || key}.`);
      return;
    }

    const kelurahan = event.target.closest("[data-kel-filter]");
    if (kelurahan) {
      state.kelurahan = kelurahan.dataset.kelFilter;
      state.usaha = null;
      detailItem = null;
      renderDetailPane();
      writeState(state, { push: true });
      setView("explore");
      applyAndRender({ fit: true });
      toast(`Menampilkan usaha di Kel. ${kelurahan.dataset.kelFilter}.`);
      return;
    }

    const point = event.target.closest("[data-umkm-id]");
    if (point) {
      openItem(byId.get(point.dataset.umkmId));
    }
  });

  els.insight.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target.closest(
      "[data-cat-filter], [data-kel-filter], [data-umkm-id]"
    );
    if (!target) return;
    event.preventDefault();
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  // Any in-app link
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const link = event.target.closest('a[href^="?"]');
    if (!link || link.target === "_blank") return;
    event.preventDefault();
    navigateHref(link.getAttribute("href"));
  });

  // History
  window.addEventListener("popstate", () => {
    if (!meta) return;
    const fresh = readState();
    Object.assign(state, fresh);
    setView(fresh.view);
    syncDetailFromState();
    applyAndRender();
    if (fresh.viewLat != null && fresh.viewLng != null) {
      mapApi?.restoreView({
        lat: fresh.viewLat,
        lng: fresh.viewLng,
        zoom: fresh.viewZoom,
      });
    }
  });

  // Keyboard
  document.addEventListener("keydown", (event) => {
    const tag = event.target?.tagName;
    const typing =
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      event.target?.isContentEditable;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      focusSearch();
      return;
    }
    if (event.key === "/" && !typing) {
      event.preventDefault();
      focusSearch();
      return;
    }
    if (event.key === "Escape") {
      if (els.filterDialog.open) return;
      els.layerMenu.hidden = true;
      els.layerBtn.setAttribute("aria-expanded", "false");
      if (!els.layerMenu.hidden) return;
      if (state.usaha) closeDetail();
    }
  });

  // Layout observers
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => updateSheetOffset());
    observer.observe(els.panel);
  }
  window.addEventListener("resize", () => {
    mapApi?.updateSize();
    updateSheetOffset();
  });
  window.matchMedia(MOBILE_QUERY).addEventListener("change", () => {
    updateSheetOffset();
    mapApi?.updateSize();
  });
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */

async function boot() {
  renderSkeleton(els.resultList);
  bindStatic();

  try {
    const base = import.meta.env.BASE_URL;
    const [metaResponse, umkmResponse, boundaryResponse] = await Promise.all([
      fetch(`${base}data/meta.json`),
      fetch(`${base}data/umkm.geojson`),
      fetch(`${base}data/pekanbaru-kelurahan.geojson`),
    ]);
    if (!metaResponse.ok || !umkmResponse.ok || !boundaryResponse.ok) {
      throw new Error("Data request failed");
    }
    meta = await metaResponse.json();
    const umkmGeo = await umkmResponse.json();
    boundaries = await boundaryResponse.json();
    items = umkmGeo.features.map((feature) => ({ ...feature.properties }));
  } catch (error) {
    console.error(error);
    els.mapLoading.innerHTML = "<span>Data tidak dapat dimuat.</span>";
    els.resultCount.textContent = "Data gagal dimuat";
    els.resultList.innerHTML = `<div class="empty">
      <span class="empty__art">${icon("database")}</span>
      <h3>Data belum tersedia</h3>
      <p>Jalankan <code>npm run etl</code> lalu muat ulang halaman untuk membangun dataset.</p>
    </div>`;
    return;
  }

  for (const item of items) {
    byId.set(item.id, item);
    bySlug.set(item.slug, item);
  }

  state = {
    ...readState(),
    origin: loadStoredOrigin(),
  };

  els.headerCount.textContent = meta.jumlah;
  els.introSub.textContent = `${meta.jumlah} usaha di ${
    Object.keys(meta.kelurahan).length
  } kelurahan, siap dijelajahi.`;

  renderLegend(els.legendBody, meta);
  fillKelurahanOptions();
  els.searchInput.value = state.q;
  els.searchClear.hidden = !state.q;

  initMap();
  applyAndRender();
  syncDetailFromState();
  setView(state.view);
  updateSheetOffset();
}

boot();

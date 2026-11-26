import { CATEGORY_LABELS } from "./lib/icons.js";
import { haversine, bboxCenter, TIER_LABELS } from "./lib/geo.js";
import { normalizeText } from "./lib/format.js";

export const RADIUS_OPTIONS = [0, 250, 500, 1000, 2000, 5000];
export const SORT_OPTIONS = ["terdekat", "nama", "omzet", "lama", "terbaru"];
export const VIEWS = ["explore", "insight", "tentang"];

export const SORT_LABELS = {
  terdekat: "terdekat",
  nama: "nama A–Z",
  omzet: "omzet tertinggi",
  lama: "paling lama usaha",
  terbaru: "terbaru dicatat",
};

function pick(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function intOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function readState() {
  const params = new URLSearchParams(window.location.search);
  const radius = Number(params.get("r"));
  return {
    view: pick(params.get("view"), VIEWS, "explore"),
    q: params.get("q") || "",
    kategori: pick(params.get("kat"), Object.keys(CATEGORY_LABELS), "semua"),
    radius: RADIUS_OPTIONS.includes(radius) ? radius : 0,
    sort: pick(params.get("sort"), SORT_OPTIONS, "terdekat"),
    marketplace: params.get("mp") === "1",
    tier: pick(params.get("tier"), Object.keys(TIER_LABELS), "semua"),
    kelurahan: params.get("kel") || "semua",
    usaha: params.get("usaha") || null,
    viewLat: intOrNull(params.get("lat")),
    viewLng: intOrNull(params.get("lng")),
    viewZoom: intOrNull(params.get("z")),
  };
}

export function buildSearch(state, overrides = {}) {
  const merged = { ...state, ...overrides };
  const params = new URLSearchParams();
  if (merged.view && merged.view !== "explore") params.set("view", merged.view);
  if (merged.q) params.set("q", merged.q);
  if (merged.kategori && merged.kategori !== "semua") params.set("kat", merged.kategori);
  if (merged.radius > 0) params.set("r", String(merged.radius));
  if (merged.sort && merged.sort !== "terdekat") params.set("sort", merged.sort);
  if (merged.marketplace) params.set("mp", "1");
  if (merged.tier && merged.tier !== "semua") params.set("tier", merged.tier);
  if (merged.kelurahan && merged.kelurahan !== "semua") params.set("kel", merged.kelurahan);
  if (merged.usaha) params.set("usaha", merged.usaha);
  if (merged.viewLat != null && merged.viewLng != null) {
    params.set("lat", merged.viewLat.toFixed(5));
    params.set("lng", merged.viewLng.toFixed(5));
    if (merged.viewZoom != null) params.set("z", merged.viewZoom.toFixed(2));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function writeState(state, { push = false } = {}) {
  const url = `${window.location.pathname}${buildSearch(state)}`;
  if (push) window.history.pushState({ sig: true }, "", url);
  else window.history.replaceState({ sig: true }, "", url);
}

export function shareUrl(state, id) {
  return `${window.location.origin}${window.location.pathname}${buildSearch(state, { usaha: id })}`;
}

export function defaultOrigin(meta) {
  const center = bboxCenter(meta.bbox);
  return {
    lat: center.lat,
    lon: center.lon,
    label: "Pusat Pekanbaru",
    source: "default",
  };
}

export function haystack(item) {
  return normalizeText(
    [
      item.nama,
      CATEGORY_LABELS[item.kategori],
      item.jenisAsli,
      item.kelurahan,
      item.kecamatan,
      item.omzetLabel,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function applyFilters(items, state) {
  const tokens = normalizeText(state.q).split(" ").filter(Boolean);
  const origin = state.origin;
  const result = [];

  for (const item of items) {
    const jarak = haversine(origin.lat, origin.lon, item.lat, item.lon);
    if (state.kategori !== "semua" && item.kategori !== state.kategori) continue;
    if (state.marketplace && !item.marketplace) continue;
    if (state.tier !== "semua" && item.omzetTier !== state.tier) continue;
    if (state.kelurahan === "luar" && item.dalamBatas) continue;
    if (state.kelurahan !== "semua" && state.kelurahan !== "luar" && item.kelurahan !== state.kelurahan) continue;
    if (state.radius > 0 && jarak > state.radius) continue;
    if (tokens.length) {
      const hay = item._haystack || (item._haystack = haystack(item));
      if (!tokens.every((token) => hay.includes(token))) continue;
    }
    result.push({ ...item, jarak });
  }

  switch (state.sort) {
    case "nama":
      result.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
      break;
    case "omzet":
      result.sort((a, b) => b.omzet - a.omzet);
      break;
    case "lama":
      result.sort((a, b) => (b.lamaUsaha ?? -1) - (a.lamaUsaha ?? -1));
      break;
    case "terbaru":
      result.sort((a, b) => String(b.dicatatPada).localeCompare(String(a.dicatatPada)));
      break;
    default:
      result.sort((a, b) => a.jarak - b.jarak);
  }
  return result;
}

export function activeFilterList(state, meta) {
  const list = [];
  if (state.radius > 0) {
    const label =
      state.radius >= 1000 ? `${state.radius / 1000} km` : `${state.radius} m`;
    list.push({ key: "radius", label: `Radius ${label}` });
  }
  if (state.tier !== "semua") {
    list.push({ key: "tier", label: TIER_LABELS[state.tier] });
  }
  if (state.kelurahan !== "semua") {
    list.push({
      key: "kelurahan",
      label:
        state.kelurahan === "luar"
          ? "Luar batas kelurahan"
          : `Kel. ${state.kelurahan}`,
    });
  }
  if (state.marketplace) {
    list.push({ key: "marketplace", label: "Marketplace" });
  }
  return list;
}

export function countActiveFilters(state) {
  return (
    (state.radius > 0 ? 1 : 0) +
    (state.tier !== "semua" ? 1 : 0) +
    (state.kelurahan !== "semua" ? 1 : 0) +
    (state.marketplace ? 1 : 0)
  );
}

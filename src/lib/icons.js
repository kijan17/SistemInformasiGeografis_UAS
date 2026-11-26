/* Inline SVG icons — gaya Lucide (stroke 1.8, round). Tanpa dependency. */

const PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  crosshair:
    '<circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  sliders:
    '<path d="M4 6h9M18 6h2M4 12h2M11 12h9M4 18h7M16 18h4"/><circle cx="15.5" cy="6" r="2"/><circle cx="8.5" cy="12" r="2"/><circle cx="13.5" cy="18" r="2"/>',
  "arrow-up-down":
    '<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  maximize:
    '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  layers:
    '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 17.5 9 5 9-5"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "chevron-right": '<path d="m9 6 6 6-6 6"/>',
  "map-pin":
    '<path d="M12 21s7-7.4 7-12a7 7 0 1 0-14 0c0 4.6 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  store:
    '<path d="M3 9h18l-1.4-4.6a1 1 0 0 0-1-.7H5.4a1 1 0 0 0-1 .7L3 9Z"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>',
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
  navigation: '<path d="M3 11 22 2l-9 19-2-8-8-2Z"/>',
  copy:
    '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  sparkles:
    '<path d="m12 3 1.7 4.5L18 9l-4.3 1.5L12 15l-1.7-4.5L6 9l4.3-1.5L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
  utensils:
    '<path d="M3 2v7a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V2"/><path d="M6.5 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Z"/>',
  "shopping-bag":
    '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  wrench:
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/>',
  sprout:
    '<path d="M7 20h10"/><path d="M12 20v-8"/><path d="M12 12c0-4 3-7 8-7 0 5-3 8-8 8Z"/><path d="M12 15c-4 0-7-2.5-7-7 4.5 0 7 3 7 7Z"/>',
  wheat:
    '<path d="M12 22V9"/><path d="M12 9c0-2 1.4-3.6 3.5-4-.2 2-1.4 3.6-3.5 4Z"/><path d="M12 9c0-2-1.4-3.6-3.5-4 .2 2 1.4 3.6 3.5 4Z"/><path d="M12 14c0-2 1.4-3.6 3.5-4-.2 2-1.4 3.6-3.5 4Z"/><path d="M12 14c0-2-1.4-3.6-3.5-4 .2 2 1.4 3.6 3.5 4Z"/><path d="M12 19c0-2 1.4-3.6 3.5-4-.2 2-1.4 3.6-3.5 4Z"/><path d="M12 19c0-2-1.4-3.6-3.5-4 .2 2 1.4 3.6 3.5 4Z"/>',
  droplets:
    '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5L12 5l-4 4.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z"/>',
  "trending-up": '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  building:
    '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/>',
  external:
    '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/>',
  rotate:
    '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/>',
  "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
  coins:
    '<circle cx="8" cy="8" r="5"/><path d="M18.1 10.4A6 6 0 1 1 10.3 18"/><path d="M7 6h1v4"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
  database:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  "arrow-up": '<path d="m6 12 6-6 6 6M12 6v14"/>',
  "message-circle":
    '<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z"/>',
};

export const CATEGORY_COLORS = {
  kuliner: "#D9583F",
  retail: "#2F6FA6",
  jasa: "#6C5BD4",
  sembako: "#6E8A2C",
  galon: "#0E8C86",
};

export const CATEGORY_LABELS = {
  kuliner: "Kuliner",
  retail: "Toko & Retail",
  jasa: "Jasa",
  sembako: "Sembako",
  galon: "Isi Ulang Galon",
};

const CATEGORY_ICONS = {
  kuliner: "utensils",
  retail: "shopping-bag",
  jasa: "wrench",
  sembako: "sprout",
  galon: "droplets",
};

export function iconSvg(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ""}</svg>`;
}

export function icon(name, cls = "") {
  return `<span class="icon ${cls}" aria-hidden="true">${iconSvg(name)}</span>`;
}

export function categoryIcon(kategori, cls = "") {
  return icon(CATEGORY_ICONS[kategori] || "store", cls);
}

export function categoryColor(kategori) {
  return CATEGORY_COLORS[kategori] || "#12594A";
}

export function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    if (!el.querySelector("svg")) el.innerHTML = iconSvg(el.dataset.icon);
  });
}

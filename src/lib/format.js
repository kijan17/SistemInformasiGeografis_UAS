const nf = new Intl.NumberFormat("id-ID");
const nf1 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

export function number(value) {
  return nf.format(value ?? 0);
}

export function rupiah(value) {
  return `Rp${nf.format(Math.round(value || 0))}`;
}

export function compactRupiah(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000_000) return `Rp${nf1.format(n / 1_000_000_000)} M`;
  if (n >= 1_000_000) return `Rp${nf1.format(n / 1_000_000)} jt`;
  if (n >= 1_000) return `Rp${nf.format(Math.round(n / 1_000))} rb`;
  return `Rp${nf.format(n)}`;
}

export function distance(meters) {
  if (meters == null || Number.isNaN(meters)) return "—";
  if (meters < 10) return "Di titik ini";
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${nf1.format(meters / 1000)} km`;
}

export function years(value) {
  if (value == null) return "Belum diisi";
  if (value < 1) return "< 1 tahun";
  const rounded = Number.isInteger(value) ? value : nf1.format(value);
  return `${rounded} tahun`;
}

export function dateID(iso) {
  if (!iso) return "—";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlight(text, query) {
  const safe = escapeHtml(text);
  const q = String(query || "").trim();
  if (!q) return safe;
  const pattern = new RegExp(`(${escapeRegExp(escapeHtml(q))})`, "ig");
  return safe.replace(pattern, "<mark>$1</mark>");
}

export function truncate(text, length = 40) {
  const value = String(text || "");
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

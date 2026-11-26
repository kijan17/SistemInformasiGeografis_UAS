const EARTH_RADIUS = 6_371_000;

export function haversine(lat1, lon1, lat2, lon2) {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(a));
}

export function bboxCenter(bbox) {
  return {
    lon: (bbox[0] + bbox[2]) / 2,
    lat: (bbox[1] + bbox[3]) / 2,
  };
}

export const TIER_LABELS = {
  t1: "Di bawah Rp2 jt",
  t2: "Rp2–5 jt",
  t3: "Rp5–15 jt",
  t4: "Di atas Rp15 jt",
};

export function tierLabel(tier) {
  return TIER_LABELS[tier] || "—";
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

#!/usr/bin/env python3
"""
ETL SIG UMKM Pekanbaru
======================
Mengubah data mentah GIS.xlsx + batas kelurahan menjadi aset web:

  public/data/umkm.geojson
  public/data/pekanbaru-kelurahan.geojson
  public/data/meta.json
  docs/validation-report.md

Hanya memakai Python standard library (zipfile + ElementTree), tanpa pip.

Jalankan dari root proyek:
    python tools/etl.py
"""

from __future__ import annotations

import argparse
import json
import math
import re
import unicodedata
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_XLSX = ROOT / "data" / "raw" / "GIS.xlsx"
DEFAULT_BOUNDARY = ROOT / "data" / "raw" / "polygon_riau.json"
DEFAULT_REFERENCE = ROOT / "data" / "raw" / "dataSurvey-reference.json"
OUT_DIR = ROOT / "public" / "data"
DOCS_DIR = ROOT / "docs"

# ---------------------------------------------------------------------------
# Kategori
# ---------------------------------------------------------------------------

KATEGORI = {
    "kuliner": {"label": "Kuliner", "icon": "utensils"},
    "retail": {"label": "Toko & Retail", "icon": "shopping-bag"},
    "jasa": {"label": "Jasa", "icon": "wrench"},
    "sembako": {"label": "Sembako", "icon": "wheat"},
    "galon": {"label": "Isi Ulang Galon", "icon": "droplets"},
}

# Pemetaan label mentah -> id kategori
JENIS_MAP = {
    "kuliner": "kuliner",
    "warung kuliner": "kuliner",
    "toko": "retail",
    "toko buah baif": "retail",
    "jasa": "jasa",
    "sembako": "sembako",
    "isi ulang galon": "galon",
}

# Koreksi kategori yang jelas keliru di data mentah (didokumentasikan di laporan)
KOREKSI_NAMA = {
    "malay mini market": ("retail", "Nama usaha minimarket, bukan kuliner"),
    "toko buku media sukses": ("retail", "Toko buku termasuk retail"),
    "toko buku parker": ("retail", "Toko buku termasuk retail"),
    "suzanna elektronik": ("retail", "Toko elektronik termasuk retail"),
}

OMZET_TIER = [
    (2_000_000, "t1", "Di bawah Rp2 jt"),
    (5_000_000, "t2", "Rp2–5 jt"),
    (15_000_000, "t3", "Rp5–15 jt"),
    (math.inf, "t4", "Di atas Rp15 jt"),
]


# ---------------------------------------------------------------------------
# Baca XLSX
# ---------------------------------------------------------------------------


def read_xlsx(path: Path):
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall(f"{NS}si"):
                shared.append("".join(t.text or "" for t in si.iter(f"{NS}t")))

        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        table = []
        for row in sheet.iter(f"{NS}row"):
            cells = {}
            for cell in row.findall(f"{NS}c"):
                col = re.match(r"[A-Z]+", cell.get("r", "")).group()
                kind = cell.get("t")
                value = cell.find(f"{NS}v")
                inline = cell.find(f"{NS}is")
                if kind == "s" and value is not None:
                    cells[col] = shared[int(value.text)]
                elif kind == "inlineStr" and inline is not None:
                    cells[col] = "".join(t.text or "" for t in inline.iter(f"{NS}t"))
                elif value is not None:
                    cells[col] = value.text
                else:
                    cells[col] = ""
            table.append(cells)

    header = table[0]
    return [dict(zip(header.values(), [r.get(k, "") for k in header.keys()])) for r in table[1:]]


# ---------------------------------------------------------------------------
# Utilitas
# ---------------------------------------------------------------------------


def num(value, default=None):
    if value is None:
        return default
    text = str(value).strip()
    if not text:
        return default
    try:
        return float(text)
    except ValueError:
        return default


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower().replace("'", "").replace("&", " dan ")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "umkm"


def parse_coordinate(raw: str, is_lon: bool, nama: str) -> float:
    """Data ArcGIS kehilangan titik desimal. Rekonstruksi + validasi ketat."""
    value = float(str(raw))
    digits = len(str(int(abs(value))))
    # Latitude: 0.xxxxx (digit = jumlah angka di belakang desimal)
    # Longitude: 101.xxxxx (3 digit di depan desimal)
    result = value / (10 ** (digits - 3 if is_lon else digits))
    return result


def haversine(lat1, lon1, lat2, lon2):
    radius = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def tier_for(omzet: float):
    for limit, tier_id, label in OMZET_TIER:
        if omzet < limit:
            return tier_id, label
    return "t4", "Di atas Rp15 jt"


# ---------------------------------------------------------------------------
# Geometri
# ---------------------------------------------------------------------------


def ring_contains(x, y, ring) -> bool:
    inside = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
        if (y1 > y) != (y2 > y):
            xin = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < xin:
                inside = not inside
    return inside


def geometry_contains_point(geometry, x, y) -> bool:
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    for polygon in polygons:
        if ring_contains(x, y, polygon[0]) and not any(ring_contains(x, y, hole) for hole in polygon[1:]):
            return True
    return False


def polygon_rings(geometry):
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"][0]]
    return [poly[0] for poly in geometry["coordinates"]]


def point_segment_distance(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def nearest_kelurahan(lon, lat, features):
    best = None
    for feat in features:
        for ring in polygon_rings(feat["geometry"]):
            for i in range(len(ring) - 1):
                d = point_segment_distance(lon, lat, ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1])
                if best is None or d < best[0]:
                    best = (d, feat)
    # derajat -> meter (perkiraan)
    return best[1] if best else None, (best[0] * 111_320 if best else None)


def douglas_peucker(points, tolerance):
    if len(points) < 4:
        return points
    first, last = points[0], points[-1]
    dmax, index = 0.0, 0
    for i in range(1, len(points) - 1):
        d = point_segment_distance(points[i][0], points[i][1], first[0], first[1], last[0], last[1])
        if d > dmax:
            dmax, index = d, i
    if dmax > tolerance:
        left = douglas_peucker(points[: index + 1], tolerance)
        right = douglas_peucker(points[index:], tolerance)
        return left[:-1] + right
    return [first, last]


def simplify_ring(ring, tolerance):
    # ring tertutup: buka, sederhanakan, tutup kembali
    open_ring = ring[:-1] if ring[0] == ring[-1] else ring[:]
    if len(open_ring) < 4:
        return ring
    simplified = douglas_peucker(open_ring, tolerance)
    simplified.append(simplified[0])
    return [[round(p[0], 6), round(p[1], 6)] for p in simplified]


def simplify_geometry(geometry, tolerance):
    """Sederhanakan geometri tanpa merusak struktur Polygon/MultiPolygon."""
    def simplify_polygon(rings):
        out = []
        for ring in rings:
            simple = simplify_ring(ring, tolerance)
            if len(simple) >= 4:
                out.append(simple)
        return out

    if geometry["type"] == "Polygon":
        rings = simplify_polygon(geometry["coordinates"])
        return {"type": "Polygon", "coordinates": rings} if rings else None

    polygons = []
    for polygon in geometry["coordinates"]:
        rings = simplify_polygon(polygon)
        if rings:
            polygons.append(rings)
    return {"type": "MultiPolygon", "coordinates": polygons} if polygons else None


def bbox_of(coords):
    xs, ys = [], []
    for ring in coords:
        for x, y in ring:
            xs.append(x)
            ys.append(y)
    return [min(xs), min(ys), max(xs), max(ys)]


# ---------------------------------------------------------------------------
# Proses utama
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    parser.add_argument("--boundary", type=Path, default=DEFAULT_BOUNDARY)
    parser.add_argument("--reference", type=Path, default=DEFAULT_REFERENCE)
    parser.add_argument("--tolerance", type=float, default=0.00018)
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)

    rows = read_xlsx(args.xlsx)
    rows = [r for r in rows if str(r.get("ID", "")).strip().startswith("P")]

    reference = {}
    if args.reference.exists():
        ref = json.loads(args.reference.read_text(encoding="utf-8"))
        for feat in ref.get("features", []):
            name = feat["properties"].get("Name", "").strip()
            coords = feat["geometry"]["coordinates"]
            reference[name] = (coords[0], coords[1])

    boundary = json.loads(args.boundary.read_text(encoding="utf-8"))
    pekanbaru = [
        f for f in boundary["features"]
        if str(f["properties"].get("KABUPATEN", "")).strip().lower() == "pekan baru"
    ]

    records = []
    validation = {
        "rows": len(rows),
        "missing_pekerja": [],
        "coordinate_checks": [],
        "category_corrections": [],
        "outside_boundary": [],
        "duplicate_coordinates": [],
        "unknown_jenis": [],
    }

    for row in rows:
        rid = str(row["ID"]).strip()
        nama = str(row["Title"]).strip()
        lat = parse_coordinate(row["Latitude"], False, nama)
        lon = parse_coordinate(row["Longitude"], True, nama)

        if not (0.3 < lat < 0.7 and 101.2 < lon < 101.6):
            raise ValueError(f"Koordinat {rid} {nama} di luar bbox Pekanbaru: {lat}, {lon}")

        if nama in reference:
            rlon, rlat = reference[nama]
            diff = haversine(lat, lon, rlat, rlon)
            validation["coordinate_checks"].append((rid, nama, diff))
            if diff > 1.0:
                raise ValueError(f"Koordinat {rid} beda {diff:.1f} m dari referensi")

        jenis_asli = str(row.get("Jenis", "")).strip()
        kategori = JENIS_MAP.get(jenis_asli.lower())
        if kategori is None:
            validation["unknown_jenis"].append((rid, jenis_asli))
            kategori = "retail"
        if nama.lower() in KOREKSI_NAMA:
            new_cat, reason = KOREKSI_NAMA[nama.lower()]
            if new_cat != kategori:
                validation["category_corrections"].append((rid, nama, kategori, new_cat, reason))
            kategori = new_cat

        pekerja = num(row.get("Jumlah pekerja"))
        if pekerja is None:
            validation["missing_pekerja"].append((rid, nama))

        omzet = num(row.get("Omzet"), 0.0)
        tier_id, tier_label = tier_for(omzet)

        kelurahan = kecamatan = None
        dalam_batas = False
        jarak_batas = None
        for feat in pekanbaru:
            if geometry_contains_point(feat["geometry"], lon, lat):
                kelurahan = str(feat["properties"].get("DESA", "")).strip()
                kecamatan = str(feat["properties"].get("KECAMATAN", "")).strip()
                dalam_batas = True
                break

        if not dalam_batas:
            feat, jarak_batas = nearest_kelurahan(lon, lat, pekanbaru)
            if feat:
                jarak_batas = round(jarak_batas or 0, 0)
                validation["outside_boundary"].append(
                    (rid, nama, float(row["Latitude"]), float(row["Longitude"]), jarak_batas,
                     str(feat["properties"].get("DESA", "")).strip())
                )

        digitalisasi = int(num(row.get("Digitalisasi"), 0) or 0)
        record = {
            "id": rid,
            "slug": slugify(nama),
            "nama": nama,
            "kategori": kategori,
            "jenisAsli": jenis_asli,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "kelurahan": kelurahan,
            "kecamatan": kecamatan,
            "dalamBatas": dalam_batas,
            "jarakBatasM": jarak_batas if not dalam_batas else 0,
            "omzet": int(round(omzet)),
            "omzetTier": tier_id,
            "omzetLabel": tier_label,
            "pekerja": int(pekerja) if pekerja is not None else None,
            "lamaUsaha": num(row.get("Lama usaha")),
            "marketplace": bool(int(num(row.get("Marketplace"), 0) or 0)),
            "digitalisasi": bool(digitalisasi),
            "elevasi": round(num(row.get("Elevation"), 0) / 1e6, 1),
            "dicatatPada": str(row.get("Date Created", "")).strip()[:10],
        }
        records.append(record)

    # Duplikat koordinat (untuk penanganan cluster/spiderfy di UI)
    buckets = defaultdict(list)
    for rec in records:
        buckets[(round(rec["lat"], 6), round(rec["lon"], 6))].append(rec["id"])
    for key, ids in buckets.items():
        exact = len(ids) > 1
        if exact:
            validation["duplicate_coordinates"].append((key, ids))
    for rec in records:
        key = (round(rec["lat"], 6), round(rec["lon"], 6))
        rec["titikBersama"] = len(buckets[key])

    # Fitur GeoJSON UMKM
    features = []
    for rec in records:
        props = {k: v for k, v in rec.items() if k not in ("lat", "lon")}
        props["lat"] = rec["lat"]
        props["lon"] = rec["lon"]
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [rec["lon"], rec["lat"]]},
            "properties": props,
        })

    umkm = {
        "type": "FeatureCollection",
        "name": "umkm_pekanbaru",
        "features": features,
    }
    (OUT_DIR / "umkm.geojson").write_text(
        json.dumps(umkm, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )

    # Sebaran per kelurahan / kecamatan
    per_kelurahan = Counter(r["kelurahan"] for r in records if r["kelurahan"])
    per_kecamatan = Counter(r["kecamatan"] for r in records if r["kecamatan"])

    kelurahan_features = []
    for feat in pekanbaru:
        props = feat["properties"]
        kel = str(props.get("DESA", "")).strip()
        kec = str(props.get("KECAMATAN", "")).strip()
        geometry = simplify_geometry(feat["geometry"], args.tolerance)
        if not geometry:
            continue
        kelurahan_features.append({
            "type": "Feature",
            "properties": {
                "kelurahan": kel,
                "kecamatan": kec,
                "jumlah": per_kelurahan.get(kel, 0),
            },
            "geometry": geometry,
        })

    kelurahan_fc = {
        "type": "FeatureCollection",
        "name": "kelurahan_pekanbaru",
        "features": kelurahan_features,
    }
    (OUT_DIR / "pekanbaru-kelurahan.geojson").write_text(
        json.dumps(kelurahan_fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )

    # Meta
    omzet_values = sorted(r["omzet"] for r in records)
    median_omzet = omzet_values[len(omzet_values) // 2] if omzet_values else 0
    lats = [r["lat"] for r in records]
    lons = [r["lon"] for r in records]
    meta = {
        "judul": "SIG UMKM Pekanbaru",
        "sumber": "Survei lapangan UMKM (GIS.xlsx)",
        "dibuatPada": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "jumlah": len(records),
        "kategori": {
            key: {
                "label": val["label"],
                "icon": val["icon"],
                "jumlah": sum(1 for r in records if r["kategori"] == key),
            }
            for key, val in KATEGORI.items()
        },
        "kecamatan": dict(per_kecamatan.most_common()),
        "kelurahan": dict(per_kelurahan.most_common()),
        "marketplace": sum(1 for r in records if r["marketplace"]),
        "digitalisasi": sum(1 for r in records if r["digitalisasi"]),
        "medianOmzet": median_omzet,
        "totalOmzet": sum(r["omzet"] for r in records),
        "bbox": [min(lons), min(lats), max(lons), max(lats)],
        "titikGanda": sum(1 for r in records if r["titikBersama"] > 1),
        "catatan": [
            "Omzet ditampilkan sebagai tier; angka persis bersifat opsional di panel detail.",
            "Tidak tersedia jam buka, rating, telepon, atau foto usaha pada dataset.",
            "1 titik berada di luar batas kelurahan Pekanbaru dan ditandai di antarmuka.",
        ],
    }
    (OUT_DIR / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Laporan validasi
    max_diff = max((c[2] for c in validation["coordinate_checks"]), default=0)
    path_sizes = {
        p.name: p.stat().st_size
        for p in [OUT_DIR / "umkm.geojson", OUT_DIR / "pekanbaru-kelurahan.geojson", OUT_DIR / "meta.json"]
    }
    lines = [
        "# Laporan Validasi Data",
        "",
        f"Digenerate: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "## Ringkasan",
        "",
        f"- Baris UMKM: **{len(records)}**",
        f"- Bbox: `{meta['bbox']}`",
        f"- Titik dalam batas kelurahan: **{sum(1 for r in records if r['dalamBatas'])}/{len(records)}**",
        f"- Titik di luar batas: **{len(validation['outside_boundary'])}**",
        f"- Titik berbagi koordinat: **{meta['titikGanda']}**",
        f"- Selisih koordinat maksimum vs referensi survei: **{max_diff:.3f} m**",
        f"- Omzet median: **Rp{median_omzet:,.0f}**",
        "",
        "## Sebaran kategori",
        "",
    ]
    for key, val in meta["kategori"].items():
        lines.append(f"- {val['label']}: **{val['jumlah']}**")
    lines += ["", "## Sebaran kecamatan", ""]
    for key, val in meta["kecamatan"].items():
        lines.append(f"- {key}: **{val}**")
    lines += ["", "## Sebaran kelurahan", ""]
    for key, val in meta["kelurahan"].items():
        lines.append(f"- {key}: **{val}**")

    lines += ["", "## Catatan kualitas data", ""]
    lines.append("- Koordinat xlsx kehilangan titik desimal; direkonstruksi dan divalidasi terhadap bbox + layer survei.")
    if validation["missing_pekerja"]:
        names = ", ".join(f"{r[0]} {r[1]}" for r in validation["missing_pekerja"])
        lines.append(f"- Jumlah pekerja kosong: {names} (ditampilkan sebagai “Belum diisi”).")
    if validation["outside_boundary"]:
        for rid, nama, lat, lon, jarak, kel in validation["outside_boundary"]:
            lines.append(f"- {rid} {nama} di luar batas ({jarak:.0f} m dari Kel. {kel}); koordinat mentah {lat}, {lon}.")
    if validation["duplicate_coordinates"]:
        for key, ids in validation["duplicate_coordinates"]:
            lines.append(f"- Koordinat identik {key}: {', '.join(ids)}.")
    if validation["category_corrections"]:
        lines.append("")
        lines.append("### Koreksi kategori")
        lines.append("")
        for rid, nama, old, new, reason in validation["category_corrections"]:
            lines.append(f"- {rid} {nama}: `{old}` → `{new}` ({reason}).")
    if validation["unknown_jenis"]:
        lines.append("")
        lines.append("### Jenis tidak dikenal")
        lines.append("")
        for rid, jenis in validation["unknown_jenis"]:
            lines.append(f"- {rid}: `{jenis}` → fallback retail.")
    lines += [
        "",
        "## Ukuran aset",
        "",
        f"- umkm.geojson: **{path_sizes['umkm.geojson'] / 1024:.1f} KB**",
        f"- pekanbaru-kelurahan.geojson: **{path_sizes['pekanbaru-kelurahan.geojson'] / 1024:.1f} KB**",
        f"- meta.json: **{path_sizes['meta.json'] / 1024:.1f} KB**",
        "",
    ]
    (DOCS_DIR / "validation-report.md").write_text("\n".join(lines), encoding="utf-8")

    print(f"OK  {len(records)} UMKM, {len(kelurahan_features)} kelurahan")
    print(f"    bbox {meta['bbox']}")
    print(f"    kategori {dict((k, v['jumlah']) for k, v in meta['kategori'].items())}")
    print(f"    ukuran {path_sizes}")
    print(f"    selisih koordinat maks {max_diff:.3f} m")


if __name__ == "__main__":
    main()

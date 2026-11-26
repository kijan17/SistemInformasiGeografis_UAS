import OlMap from "ol/Map.js";
import View from "ol/View.js";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorSource from "ol/source/Vector.js";
import Cluster from "ol/source/Cluster.js";
import XYZ from "ol/source/XYZ.js";
import GeoJSON from "ol/format/GeoJSON.js";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import CircleGeometry from "ol/geom/Circle.js";
import { fromLonLat, toLonLat } from "ol/proj.js";
import {
  Style,
  Circle as CircleStyle,
  Fill,
  Stroke,
  Text,
  Icon,
} from "ol/style.js";
import Overlay from "ol/Overlay.js";
import { defaults as defaultControls, ScaleLine, Attribution } from "ol/control.js";
import { createEmpty, extend, isEmpty } from "ol/extent.js";
import { CATEGORY_COLORS, CATEGORY_LABELS, iconSvg } from "./lib/icons.js";
import { distance as formatDistance } from "./lib/format.js";
import { clamp } from "./lib/geo.js";

const PIN_GLYPHS = {
  kuliner:
    '<path d="M3 2v7a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V2"/><path d="M6.5 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Z"/>',
  retail:
    '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  jasa:
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/>',
  sembako:
    '<path d="M7 20h10"/><path d="M12 20v-8"/><path d="M12 12c0-4 3-7 8-7 0 5-3 8-8 8Z"/><path d="M12 15c-4 0-7-2.5-7-7 4.5 0 7 3 7 7Z"/>',
  galon:
    '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5L12 5l-4 4.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z"/>',
};

const pinCache = new Map();

function pinUrl(kategori, selected = false) {
  const key = `${kategori}-${selected ? 1 : 0}`;
  if (pinCache.has(key)) return pinCache.get(key);
  const color = CATEGORY_COLORS[kategori] || "#12594A";
  const glyph = PIN_GLYPHS[kategori] || PIN_GLYPHS.retail;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
    <path d="M17 42C17 42 32 25.6 32 15.8 32 7.6 25.3 1.5 17 1.5S2 7.6 2 15.8C2 25.6 17 42 17 42Z" fill="${color}" stroke="#FFFDF8" stroke-width="2.4"/>
    <g transform="translate(9 8) scale(.68)" fill="none" stroke="#FFFDF8" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
  </svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  pinCache.set(key, url);
  return url;
}

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const value = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function dominantCategory(features) {
  const counts = new Map();
  for (const feature of features) {
    const cat = feature.get("kategori") || "retail";
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  let best = "retail";
  let max = -1;
  for (const [cat, count] of counts) {
    if (count > max) {
      best = cat;
      max = count;
    }
  }
  return best;
}

export function createMap({
  target,
  items,
  boundaries,
  onSelect,
  onBoundaryClick,
  onBackgroundClick,
  onViewChange,
  onTileError,
}) {
  const isMobile = () => window.matchMedia("(max-width: 880px)").matches;
  const tooltipEl = document.getElementById("tooltip");
  const chooserEl = document.getElementById("chooser");
  const loadingEl = document.getElementById("mapLoading");

  let selectedId = null;
  let boundaryVisible = true;
  let clustersEnabled = true;
  let hoveredBoundary = null;
  let tileErrorNotified = false;

  const lightLayer = new TileLayer({
    source: new XYZ({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      attributions:
        'Tiles © <a href="https://www.esri.com/">Esri</a> — Esri, DeLorme, NAVTEQ · Data © OpenStreetMap contributors',
      crossOrigin: "anonymous",
      maxZoom: 16,
    }),
    zIndex: 0,
  });

  const lightLabelsLayer = new TileLayer({
    source: new XYZ({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      crossOrigin: "anonymous",
      maxZoom: 16,
    }),
    zIndex: 1,
  });

  const satelliteLayer = new TileLayer({
    source: new XYZ({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attributions: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
      crossOrigin: "anonymous",
      maxZoom: 19,
    }),
    visible: false,
    zIndex: 0,
  });

  for (const layer of [lightLayer, lightLabelsLayer, satelliteLayer]) {
    layer.getSource().on("tileerror", () => {
      if (tileErrorNotified) return;
      tileErrorNotified = true;
      onTileError?.();
    });
  }

  // ---------------------------------------------------------------------
  // Boundary
  // ---------------------------------------------------------------------
  const boundarySource = new VectorSource();
  if (boundaries?.features?.length) {
    boundarySource.addFeatures(
      new GeoJSON().readFeatures(boundaries, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      })
    );
  }

  const boundaryLayer = new VectorLayer({
    source: boundarySource,
    zIndex: 2,
    style: (feature) => {
      const hover = feature.get("hover");
      return new Style({
        fill: new Fill({ color: hover ? "rgba(18,89,74,0.045)" : "rgba(18,89,74,0.012)" }),
        stroke: new Stroke({
          color: hover ? "#12594A" : "rgba(18,89,74,0.3)",
          width: hover ? 2 : 1.15,
        }),
      });
    },
  });

  // ---------------------------------------------------------------------
  // Radius
  // ---------------------------------------------------------------------
  const radiusSource = new VectorSource();
  const radiusLayer = new VectorLayer({
    source: radiusSource,
    zIndex: 3,
    style: new Style({
      fill: new Fill({ color: "rgba(18,89,74,0.055)" }),
      stroke: new Stroke({
        color: "rgba(18,89,74,0.55)",
        width: 1.4,
        lineDash: [5, 5],
      }),
    }),
  });

  // ---------------------------------------------------------------------
  // UMKM + cluster
  // ---------------------------------------------------------------------
  const featureById = new Map();
  const baseSource = new VectorSource();
  for (const item of items) {
    const feature = new Feature({
      geometry: new Point(fromLonLat([item.lon, item.lat])),
      id: item.id,
      nama: item.nama,
      kategori: item.kategori,
      kelurahan: item.kelurahan,
      jarak: 0,
    });
    feature.setId(item.id);
    featureById.set(item.id, feature);
    baseSource.addFeature(feature);
  }

  const clusterSource = new Cluster({ distance: 34, minDistance: 0, source: baseSource });

  const umkmLayer = new VectorLayer({
    source: clusterSource,
    zIndex: 5,
    style: (feature) => styleForFeature(feature),
  });

  function styleForFeature(feature) {
    const clustered = feature.get("features");
    if (clustered && clustered.length > 1) {
      const color = CATEGORY_COLORS[dominantCategory(clustered)] || "#12594A";
      const count = clustered.length;
      const radius = 16 + Math.min(8, count * 0.9);
      return [
        new Style({
          image: new CircleStyle({
            radius: radius + 5,
            fill: new Fill({ color: hexToRgba(color, 0.14) }),
          }),
        }),
        new Style({
          image: new CircleStyle({
            radius,
            fill: new Fill({ color: "#FFFDF8" }),
            stroke: new Stroke({ color, width: 2.5 }),
          }),
          text: new Text({
            text: count > 99 ? "99+" : String(count),
            font: '700 11px "Plus Jakarta Sans", sans-serif',
            fill: new Fill({ color: "#16211B" }),
          }),
        }),
      ];
    }

    const target = clustered ? clustered[0] : feature;
    const kategori = target.get("kategori") || "retail";
    const id = target.get("id");
    const selected = id === selectedId;
    const color = CATEGORY_COLORS[kategori] || "#12594A";
    const styles = [];

    if (selected) {
      styles.push(
        new Style({
          image: new CircleStyle({
            radius: 13,
            fill: new Fill({ color: hexToRgba(color, 0.16) }),
            stroke: new Stroke({ color: "#FFFDF8", width: 1.5 }),
          }),
        })
      );
    }

    styles.push(
      new Style({
        image: new Icon({
          src: pinUrl(kategori, selected),
          anchor: [0.5, 1],
          anchorXUnits: "fraction",
          anchorYUnits: "fraction",
          scale: selected ? 1.12 : 1,
        }),
        zIndex: selected ? 1000 : 10,
      })
    );
    return styles;
  }

  // ---------------------------------------------------------------------
  // Map
  // ---------------------------------------------------------------------
  const allExtent = baseSource.getExtent();
  const initialCenter = baseSource.getFeatures().length
    ? [
        (allExtent[0] + allExtent[2]) / 2,
        (allExtent[1] + allExtent[3]) / 2,
      ]
    : fromLonLat([101.4377, 0.5274]);

  const view = new View({
    center: initialCenter,
    zoom: 12.4,
    minZoom: 10,
    maxZoom: 19,
  });
  const map = new OlMap({
    target,
    layers: [
      lightLayer,
      lightLabelsLayer,
      satelliteLayer,
      boundaryLayer,
      radiusLayer,
      umkmLayer,
    ],
    view,
    controls: defaultControls({ zoom: false, rotate: false, attribution: false }).extend([
      new ScaleLine({ units: "metric" }),
      new Attribution({ collapsible: true, collapsed: true }),
    ]),
  });

  // ---------------------------------------------------------------------
  // Overlays
  // ---------------------------------------------------------------------
  const tooltipOverlay = new Overlay({
    element: tooltipEl,
    positioning: "bottom-center",
    offset: [0, -46],
    stopEvent: false,
  });
  map.addOverlay(tooltipOverlay);

  const chooserOverlay = new Overlay({
    element: chooserEl,
    positioning: "bottom-center",
    offset: [0, -20],
    stopEvent: true,
  });
  map.addOverlay(chooserOverlay);

  const meEl = document.createElement("div");
  meEl.className = "me-dot";
  const meOverlay = new Overlay({
    element: meEl,
    positioning: "center-center",
    stopEvent: false,
  });
  map.addOverlay(meOverlay);
  meOverlay.setPosition(undefined);

  function hideTooltip() {
    tooltipEl.classList.remove("is-visible");
    tooltipOverlay.setPosition(undefined);
  }

  function hideChooser() {
    chooserEl.hidden = true;
    chooserOverlay.setPosition(undefined);
  }

  function showChooser(coordinate, features) {
    const list = features
      .map((feature) => {
        const cat = feature.get("kategori") || "retail";
        const jarak = feature.get("jarak");
        return `<button type="button" class="map-chooser__item" data-id="${feature.get("id")}" style="--cat:${CATEGORY_COLORS[cat]}">
          <span class="icon">${iconSvg(cat === "kuliner" ? "utensils" : cat === "jasa" ? "wrench" : cat === "galon" ? "droplets" : cat === "sembako" ? "sprout" : "shopping-bag")}</span>
          <span>${feature.get("nama")}</span>
          <small>${formatDistance(jarak)}</small>
        </button>`;
      })
      .join("");
    chooserEl.innerHTML = `<div class="map-chooser__head">${features.length} usaha di titik ini</div>${list}`;
    chooserEl.hidden = false;
    chooserOverlay.setPosition(coordinate);
    chooserEl.querySelectorAll("[data-id]").forEach((button) => {
      button.addEventListener("click", () => {
        hideChooser();
        onSelect(button.dataset.id);
      });
    });
  }

  // ---------------------------------------------------------------------
  // Hover + click
  // ---------------------------------------------------------------------
  let raf = null;
  map.on("pointermove", (event) => {
    if (event.dragging) {
      hideTooltip();
      return;
    }
    if (raf) return;
    const pixel = event.pixel;
    const coordinate = event.coordinate;
    raf = requestAnimationFrame(() => {
      raf = null;
      let hit = null;
      map.forEachFeatureAtPixel(
        pixel,
        (feature, layer) => {
          hit = { feature, layer };
          return true;
        },
        {
          hitTolerance: 7,
          layerFilter: (layer) =>
            layer === umkmLayer || (boundaryVisible && layer === boundaryLayer),
        }
      );

      const targetEl = map.getTargetElement();
      if (!hit) {
        targetEl.style.cursor = "";
        hideTooltip();
        if (hoveredBoundary) {
          hoveredBoundary.set("hover", false);
          hoveredBoundary = null;
          boundaryLayer.changed();
        }
        return;
      }

      targetEl.style.cursor = "pointer";
      if (hit.layer === boundaryLayer) {
        if (hoveredBoundary !== hit.feature) {
          if (hoveredBoundary) hoveredBoundary.set("hover", false);
          hoveredBoundary = hit.feature;
          hit.feature.set("hover", true);
          boundaryLayer.changed();
        }
        tooltipEl.innerHTML = `<strong>Kel. ${hit.feature.get("kelurahan")}</strong><span>Kec. ${hit.feature.get("kecamatan")} · ${hit.feature.get("jumlah")} UMKM</span>`;
        tooltipEl.classList.add("is-visible");
        tooltipOverlay.setPosition(coordinate);
        return;
      }

      if (hoveredBoundary) {
        hoveredBoundary.set("hover", false);
        hoveredBoundary = null;
        boundaryLayer.changed();
      }

      const clustered = hit.feature.get("features");
      if (clustered && clustered.length > 1) {
        const n = clustered.length;
        const zoom = view.getZoom();
        tooltipEl.innerHTML = `<strong>${n} usaha</strong><span>${zoom < 15.2 ? "Klik untuk perbesar" : "Klik untuk pilih usaha"}</span>`;
        tooltipEl.classList.add("is-visible");
        tooltipOverlay.setPosition(hit.feature.getGeometry().getCoordinates());
        return;
      }

      const target = clustered ? clustered[0] : hit.feature;
      tooltipEl.innerHTML = `<strong>${target.get("nama")}</strong><span>${CATEGORY_LABELS[target.get("kategori")] || ""} · ${formatDistance(target.get("jarak"))}</span>`;
      tooltipEl.classList.add("is-visible");
      tooltipOverlay.setPosition(target.getGeometry().getCoordinates());
    });
  });

  map.on("click", (event) => {
    hideTooltip();
    hideChooser();
    let hit = null;
    map.forEachFeatureAtPixel(
      event.pixel,
      (feature, layer) => {
        hit = { feature, layer };
        return true;
      },
      {
        hitTolerance: 8,
        layerFilter: (layer) =>
          layer === umkmLayer || (boundaryVisible && layer === boundaryLayer),
      }
    );

    if (!hit) {
      onBackgroundClick?.();
      return;
    }

    if (hit.layer === boundaryLayer) {
      onBoundaryClick?.(hit.feature.get("kelurahan"), hit.feature.get("jumlah"));
      return;
    }

    const clustered = hit.feature.get("features");
    if (clustered && clustered.length > 1) {
      if (view.getZoom() < 15.2) {
        view.animate({
          center: hit.feature.getGeometry().getCoordinates(),
          zoom: Math.min(18, view.getZoom() + 2.1),
          duration: 420,
        });
      } else {
        showChooser(hit.feature.getGeometry().getCoordinates(), clustered);
      }
      return;
    }

    const target = clustered ? clustered[0] : hit.feature;
    onSelect(target.get("id"));
  });

  map.on("movestart", () => {
    hideTooltip();
    hideChooser();
  });

  map.on("moveend", () => {
    const center = view.getCenter();
    if (!center) return;
    const [lng, lat] = toLonLat(center);
    onViewChange?.({ lat, lng, zoom: view.getZoom() });
  });

  map.once("rendercomplete", () => {
    loadingEl?.classList.add("is-hidden");
  });
  window.setTimeout(() => loadingEl?.classList.add("is-hidden"), 2200);

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------
  function setFeatures(filtered) {
    for (const item of filtered) {
      const feature = featureById.get(item.id);
      if (feature) feature.set("jarak", item.jarak);
    }
    const ids = new Set(filtered.map((item) => item.id));
    baseSource.clear();
    for (const feature of featureById.values()) {
      if (ids.has(feature.getId())) baseSource.addFeature(feature);
    }
    umkmLayer.changed();
  }

  function setSelected(id) {
    selectedId = id;
    umkmLayer.changed();
  }

  function setOrigin(origin, radius) {
    radiusSource.clear();
    if (radius > 0) {
      radiusSource.addFeature(
        new Feature({
          geometry: new CircleGeometry(fromLonLat([origin.lon, origin.lat]), radius),
        })
      );
    }
    if (origin.source === "user") {
      meOverlay.setPosition(fromLonLat([origin.lon, origin.lat]));
      meOverlay.getElement().title = "Lokasi Anda";
    } else {
      meOverlay.setPosition(undefined);
    }
  }

  function setBasemap(kind) {
    const satellite = kind === "satellite";
    lightLayer.setVisible(!satellite);
    lightLabelsLayer.setVisible(!satellite);
    satelliteLayer.setVisible(satellite);
  }

  function setBoundaryVisible(visible) {
    boundaryVisible = visible;
    boundaryLayer.setVisible(visible);
    if (!visible) {
      hoveredBoundary = null;
      hideTooltip();
    }
  }

  function setClustersEnabled(enabled) {
    clustersEnabled = enabled;
    umkmLayer.setSource(enabled ? clusterSource : baseSource);
    umkmLayer.changed();
  }

  function padding() {
    return isMobile() ? [76, 44, 330, 44] : [78, 78, 78, 78];
  }

  function fitItems(filtered, animate = true) {
    const extent = createEmpty();
    for (const item of filtered) {
      extend(extent, fromLonLat([item.lon, item.lat]));
    }
    if (isEmpty(extent)) return;
    view.fit(extent, {
      padding: padding(),
      maxZoom: 15.6,
      duration: animate ? 480 : 0,
    });
  }

  function fitAll(animate = false) {
    if (isEmpty(allExtent)) return;
    view.fit(allExtent, {
      padding: isMobile() ? [70, 40, 320, 40] : [86, 86, 86, 86],
      maxZoom: 13.6,
      duration: animate ? 480 : 0,
    });
  }

  function flyToItem(item) {
    view.animate({
      center: fromLonLat([item.lon, item.lat]),
      zoom: Math.max(view.getZoom() || 13, 16),
      duration: 520,
    });
  }

  function flyTo(lat, lon, zoom = 14.5) {
    view.animate({
      center: fromLonLat([lon, lat]),
      zoom,
      duration: 620,
    });
  }

  function restoreView({ lat, lng, zoom }) {
    if (lat == null || lng == null) return false;
    view.setCenter(fromLonLat([lng, lat]));
    view.setZoom(clamp(zoom ?? 13, 10, 19));
    return true;
  }

  function getViewState() {
    const center = view.getCenter();
    if (!center) return null;
    const [lng, lat] = toLonLat(center);
    return { lat, lng, zoom: view.getZoom() };
  }

  function zoomBy(delta) {
    view.animate({ zoom: (view.getZoom() || 13) + delta, duration: 220 });
  }

  function updateSize() {
    map.updateSize();
  }

  return {
    map,
    view,
    setFeatures,
    setSelected,
    setOrigin,
    setBasemap,
    setBoundaryVisible,
    setClustersEnabled,
    isClustersEnabled: () => clustersEnabled,
    fitItems,
    fitAll,
    flyToItem,
    flyTo,
    restoreView,
    getViewState,
    zoomBy,
    updateSize,
    hideChooser,
    hideTooltip,
  };
}

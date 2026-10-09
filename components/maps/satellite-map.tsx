"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

export const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const EOX_TILES = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg";
const EOX_ATTRIBUTION =
  '<a href="https://s2maps.eu" target="_blank" rel="noreferrer">Sentinel-2 cloudless 2023</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2023), CC BY-NC-SA 4.0';
const WORKER_URL = "/vendor/maplibre-gl-worker.mjs";
const PC_ATTRIBUTION = "Contains modified Copernicus Sentinel data, via Microsoft Planetary Computer";

export interface SceneLayer {
  date: string;
  trueColor: string;
  ndvi: string;
}

type LayerKey = "street" | "mosaic" | "scene" | "ndvi";

function squareRing(latitude: number, longitude: number, halfSide: number): number[][] {
  const dLat = halfSide / 111_320;
  const dLon = halfSide / (111_320 * Math.cos((latitude * Math.PI) / 180));
  return [
    [longitude - dLon, latitude - dLat],
    [longitude + dLon, latitude - dLat],
    [longitude + dLon, latitude + dLat],
    [longitude - dLon, latitude + dLat],
    [longitude - dLon, latitude - dLat],
  ];
}

export function SatelliteMap({
  latitude,
  longitude,
  label,
  bufferMeters,
  scene,
  initialLayer,
  height = 360,
}: {
  latitude: number;
  longitude: number;
  label: string;
  bufferMeters?: number;
  scene?: SceneLayer | null;
  initialLayer?: LayerKey;
  height?: number;
}) {
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [layer, setLayer] = useState<LayerKey>(initialLayer ?? (scene ? "scene" : "mosaic"));
  const style = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() || DEFAULT_STYLE_URL;
  const sceneTrueColor = scene?.trueColor ?? null;
  const sceneNdvi = scene?.ndvi ?? null;
  const valid = Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;

  useEffect(() => {
    if (!valid || !node.current) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;
    void import("maplibre-gl")
      .then((maplibre) => {
        if (cancelled || !node.current) return;
        if (maplibre.getWorkerUrl() !== WORKER_URL) maplibre.setWorkerUrl(WORKER_URL);
        map = new maplibre.Map({
          container: node.current,
          style,
          center: [longitude, latitude],
          zoom: bufferMeters ? 14.5 : 13,
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");
        map.on("error", (event) => console.warn("Map error:", event.error?.message ?? event.error));
        map.on("load", () => {
          if (!map) return;
          map.addSource("mosaic", { type: "raster", tiles: [EOX_TILES], tileSize: 256, maxzoom: 15, attribution: EOX_ATTRIBUTION });
          map.addLayer({ id: "mosaic", type: "raster", source: "mosaic", layout: { visibility: "none" } });
          if (sceneTrueColor && sceneNdvi) {
            map.addSource("scene", { type: "raster", tiles: [sceneTrueColor], tileSize: 256, minzoom: 8, maxzoom: 16, attribution: PC_ATTRIBUTION });
            map.addLayer({ id: "scene", type: "raster", source: "scene", layout: { visibility: "none" } });
            map.addSource("ndvi", { type: "raster", tiles: [sceneNdvi], tileSize: 256, minzoom: 8, maxzoom: 16, attribution: PC_ATTRIBUTION });
            map.addLayer({ id: "ndvi", type: "raster", source: "ndvi", layout: { visibility: "none" }, paint: { "raster-opacity": 0.85 } });
          }
          if (bufferMeters) {
            map.addSource("buffer", {
              type: "geojson",
              data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [squareRing(latitude, longitude, bufferMeters)] } },
            });
            map.addLayer({ id: "buffer-line", type: "line", source: "buffer", paint: { "line-color": "#ffffff", "line-width": 2.5, "line-dasharray": [2, 1.5] } });
            map.addLayer({ id: "buffer-halo", type: "line", source: "buffer", paint: { "line-color": "#0b5940", "line-width": 1 } });
          }
          setReady(true);
        });
        new maplibre.Marker({ color: "#c2702d" }).setLngLat([longitude, latitude]).addTo(map);
        mapRef.current = map;
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [latitude, longitude, style, bufferMeters, sceneTrueColor, sceneNdvi, valid]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const id of ["mosaic", "scene", "ndvi"]) {
      if (!map.getLayer(id)) continue;
      const visible = id === layer || (layer === "ndvi" && id === "mosaic");
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  }, [layer, ready]);

  if (!valid) return <p className="rx-muted">No valid coordinates to map.</p>;
  const options: Array<{ key: LayerKey; label: string }> = [
    { key: "street", label: "Street" },
    { key: "mosaic", label: "Satellite 2023" },
    ...(scene
      ? [
          { key: "scene" as const, label: `Latest scene ${scene.date}` },
          { key: "ndvi" as const, label: "Vegetation (NDVI)" },
        ]
      : []),
  ];
  return (
    <div className="rx-map">
      <div className="rx-map-toolbar" role="radiogroup" aria-label="Map layer">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={layer === option.key}
            className="rx-map-chip"
            data-active={layer === option.key || undefined}
            onClick={() => setLayer(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div ref={node} className="rx-map-canvas" style={{ height }} role="region" aria-label={`Map of ${label}`} />
      {failed ? <p className="rx-muted mt-2">The map library could not load. Coordinates: {latitude.toFixed(5)}, {longitude.toFixed(5)}.</p> : null}
      {layer === "ndvi" ? (
        <div className="rx-legend" aria-label="NDVI colour scale">
          <span>−0.2 bare or built</span>
          <span className="rx-legend-bar" aria-hidden />
          <span>0.8 dense vegetation</span>
        </div>
      ) : null}
      {bufferMeters ? <p className="rx-caption">Dashed square: the ~{bufferMeters * 2} m area used for satellite and flood-exposure statistics.</p> : null}
    </div>
  );
}

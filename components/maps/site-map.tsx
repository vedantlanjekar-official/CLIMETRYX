"use client";

import "@/components/report/report.css";
import { SatelliteMap } from "@/components/maps/satellite-map";

export function SiteMap({ latitude, longitude, label }: { latitude: number; longitude: number; label: string }) {
  return (
    <div className="rx rx-plain">
      <SatelliteMap latitude={latitude} longitude={longitude} label={label} initialLayer="mosaic" height={300} />
    </div>
  );
}

import type { ForecastDay } from "@/lib/reports/model";
import type { RiverForecastDay } from "@/lib/integrations/open-meteo/river";
import type { RiverStatistics } from "@/lib/integrations/open-meteo/river-stats";
import { FLOOD_CLASSES, type FloodWindowSummary } from "@/lib/integrations/world-bank-flood/classes";

const W = 640;

const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export function ForecastChart({ days }: { days: ForecastDay[] }) {
  if (!days.length) return <p className="rx-muted">No forecast was retrieved.</p>;
  const H = 180;
  const pad = { l: 34, r: 34, t: 14, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const rain = days.map((day) => day.precipitationMm ?? 0);
  const temps = days.map((day) => day.temperatureMaxC).filter((value): value is number => value !== null);
  const rainMax = Math.max(10, ...rain);
  const tMin = temps.length ? Math.floor(Math.min(...temps) - 2) : 0;
  const tMax = temps.length ? Math.ceil(Math.max(...temps) + 2) : 40;
  const step = innerW / days.length;
  const x = (index: number) => pad.l + step * index + step / 2;
  const yRain = (value: number) => pad.t + innerH - (value / rainMax) * innerH;
  const yTemp = (value: number) => pad.t + innerH - ((value - tMin) / (tMax - tMin || 1)) * innerH;
  const tempPoints = days
    .map((day, index) => (day.temperatureMaxC === null ? null : `${x(index)},${yTemp(day.temperatureMaxC)}`))
    .filter(Boolean)
    .join(" ");
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="rx-chart" role="img" aria-label="Seven-day forecast of daily rainfall and maximum temperature">
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + innerH} y2={pad.t + innerH} stroke="#c7d6cb" />
        {days.map((day, index) => (
          <g key={day.date}>
            <rect x={x(index) - step * 0.28} width={step * 0.56} y={yRain(rain[index]!)} height={pad.t + innerH - yRain(rain[index]!)} rx={3} fill="#7fb3d5" />
            <text x={x(index)} y={H - 8} textAnchor="middle">{shortDate(day.date)}</text>
            {day.precipitationMm !== null && day.precipitationMm > 0 ? (
              <text x={x(index)} y={yRain(rain[index]!) - 4} textAnchor="middle">{Math.round(day.precipitationMm)}</text>
            ) : null}
          </g>
        ))}
        <polyline points={tempPoints} fill="none" stroke="#c2702d" strokeWidth={2.5} />
        {days.map((day, index) =>
          day.temperatureMaxC === null ? null : <circle key={`t${day.date}`} cx={x(index)} cy={yTemp(day.temperatureMaxC)} r={3.5} fill="#c2702d" />,
        )}
        <text x={4} y={pad.t + 4}>{rainMax.toFixed(0)} mm</text>
        <text x={W - 4} y={pad.t + 4} textAnchor="end">{tMax} °C</text>
        <text x={W - 4} y={pad.t + innerH} textAnchor="end">{tMin} °C</text>
      </svg>
      <figcaption className="rx-caption">
        <span className="rx-swatch" style={{ background: "#7fb3d5" }} />Daily rainfall (mm) <span className="rx-swatch ml-3" style={{ background: "#c2702d" }} />Maximum temperature (°C)
      </figcaption>
    </figure>
  );
}

export function RiverChart({ forecast, statistics }: { forecast: RiverForecastDay[]; statistics: RiverStatistics | null }) {
  const points = forecast.filter((day) => day.dischargeM3s !== null);
  if (!points.length) return <p className="rx-muted">No river forecast was returned.</p>;
  const H = 200;
  const pad = { l: 48, r: 12, t: 14, b: 26 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const forecastMax = Math.max(...forecast.map((day) => Math.max(day.ensembleMaxM3s ?? 0, day.dischargeM3s ?? 0)));
  const reference = statistics ? statistics.annualMaxMedianM3s : 0;
  const showReference = statistics !== null && reference <= forecastMax * 8;
  const yMax = Math.max(forecastMax * 1.15, showReference ? statistics!.annualMax90thM3s * 1.05 : 0, 1);
  const x = (index: number) => pad.l + (innerW * index) / Math.max(1, forecast.length - 1);
  const y = (value: number) => pad.t + innerH - (value / yMax) * innerH;
  const line = forecast.map((day, index) => (day.dischargeM3s === null ? null : `${x(index)},${y(day.dischargeM3s)}`)).filter(Boolean).join(" ");
  const band = forecast.map((day, index) => `${x(index)},${y(day.ensembleMaxM3s ?? day.dischargeM3s ?? 0)}`).join(" ");
  const base = `${x(forecast.length - 1)},${y(0)} ${x(0)},${y(0)}`;
  const ratio = statistics && reference > 0 ? Math.round((forecastMax / reference) * 1000) / 10 : null;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="rx-chart" role="img" aria-label="Thirty-day river discharge forecast compared with historical annual peaks">
        <polygon points={`${band} ${base}`} fill="#cfe2f0" />
        <polyline points={line} fill="none" stroke="#1f5f8b" strokeWidth={2.5} />
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#c7d6cb" />
        {showReference ? (
          <>
            <line x1={pad.l} x2={W - pad.r} y1={y(statistics!.annualMaxMedianM3s)} y2={y(statistics!.annualMaxMedianM3s)} stroke="#8a5a0e" strokeDasharray="5 4" />
            <text x={W - pad.r} y={y(statistics!.annualMaxMedianM3s) - 4} textAnchor="end">Typical annual peak {statistics!.annualMaxMedianM3s} m³/s</text>
            <line x1={pad.l} x2={W - pad.r} y1={y(statistics!.annualMax90thM3s)} y2={y(statistics!.annualMax90thM3s)} stroke="#b4322a" strokeDasharray="5 4" />
            <text x={W - pad.r} y={y(statistics!.annualMax90thM3s) - 4} textAnchor="end">10-year level {statistics!.annualMax90thM3s} m³/s</text>
          </>
        ) : null}
        <text x={pad.l - 6} y={pad.t + 4} textAnchor="end">{Math.round(yMax)}</text>
        <text x={pad.l - 6} y={y(0)} textAnchor="end">0</text>
        <text x={pad.l} y={H - 6}>{shortDate(forecast[0]!.date)}</text>
        <text x={W - pad.r} y={H - 6} textAnchor="end">{shortDate(forecast.at(-1)!.date)}</text>
      </svg>
      <figcaption className="rx-caption">
        <span className="rx-swatch" style={{ background: "#1f5f8b" }} />Forecast discharge (m³/s) <span className="rx-swatch ml-3" style={{ background: "#cfe2f0" }} />Highest ensemble member
        {statistics && !showReference && ratio !== null
          ? ` · The 30-day peak is ${ratio}% of the typical annual peak (${statistics.annualMaxMedianM3s} m³/s), so historical lines are off the scale.`
          : ""}
      </figcaption>
    </figure>
  );
}

const CLASS_COLOURS: Record<string, string> = { none: "#cfe8d6", low: "#cfe2f0", moderate: "#7fb3d5", high: "#3a7fb0", very_high: "#174a73" };

export function FloodExposureBar({ summary }: { summary: FloodWindowSummary }) {
  return (
    <div>
      <div className="rx-stack" role="img" aria-label="Share of nearby residents by modelled flood depth class">
        {FLOOD_CLASSES.map(({ key }) => (summary.shares[key] > 0 ? <span key={key} style={{ width: `${summary.shares[key]}%`, background: CLASS_COLOURS[key] }} /> : null))}
      </div>
      <ul className="mt-3 grid gap-1 text-sm">
        {FLOOD_CLASSES.map(({ key, label, depth }) => (
          <li key={key} className="flex items-center justify-between gap-3">
            <span>
              <span className="rx-swatch" style={{ background: CLASS_COLOURS[key] }} />
              {label} <span className="rx-muted">({depth})</span>
              {summary.pinClass === key ? <span className="rx-pill ml-2" data-tone="blue">Pin cell</span> : null}
            </span>
            <span className="rx-num">{summary.shares[key]}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

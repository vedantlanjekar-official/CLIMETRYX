"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSpec } from "@/lib/intelligence/reports/document";

const COLOURS = ["#1f6f66", "#c2702d", "#3a7fb0", "#8a5a0e", "#b4322a", "#6b5ca5", "#4f8a3c"];
const axisTick = { fontSize: 11, fill: "#4b5d59" };

const format = (value: unknown, unit: string) => {
  if (typeof value !== "number") return value === null || value === undefined ? "No data" : String(value);
  const text = Math.abs(value) >= 1000 ? value.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return unit ? `${text} ${unit}` : text;
};

export function ReportChart({ spec }: { spec: ChartSpec }) {
  const hasData = spec.data.some((row) => spec.series.some((series) => typeof row[series.key] === "number"));
  const unitFor = (axis: "left" | "right" | undefined) => (axis === "right" ? (spec.rightUnit ?? spec.unit) : spec.unit);
  const tooltip = <Tooltip formatter={(value, name, item) => [format(value, unitFor(spec.series.find((series) => series.key === item.dataKey)?.axis)), name]} />;
  const hasRight = spec.series.some((series) => series.axis === "right");
  const height = spec.kind === "horizontalBar" ? Math.max(220, spec.data.length * 38 + 60) : spec.kind === "radar" ? 320 : 280;

  let chart: React.ReactElement;
  if (spec.kind === "radar") {
    chart = (
      <RadarChart data={spec.data} outerRadius="72%">
        <PolarGrid />
        <PolarAngleAxis dataKey={spec.xKey} tick={axisTick} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
        {spec.series.map((series, index) => (
          <Radar key={series.key} dataKey={series.key} name={series.label} stroke={COLOURS[index % COLOURS.length]} fill={COLOURS[index % COLOURS.length]} fillOpacity={0.25} />
        ))}
        {tooltip}
        <Legend />
      </RadarChart>
    );
  } else if (spec.kind === "horizontalBar") {
    chart = (
      <BarChart data={spec.data} layout="vertical" margin={{ left: 16, right: 24 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={axisTick} />
        <YAxis type="category" dataKey={spec.xKey} width={170} tick={axisTick} />
        {spec.series.map((series, index) => (
          <Bar key={series.key} dataKey={series.key} name={series.label} fill={COLOURS[index % COLOURS.length]} stackId={series.stack} radius={3} />
        ))}
        {spec.referenceLines?.map((line) => <ReferenceLine key={line.label} x={line.value} stroke="#b4322a" strokeDasharray="5 4" label={{ value: line.label, fontSize: 11, position: "top" }} />)}
        {tooltip}
        <Legend />
      </BarChart>
    );
  } else {
    const Chart = spec.kind === "line" ? LineChart : spec.kind === "bar" ? BarChart : ComposedChart;
    chart = (
      <Chart data={spec.data} margin={{ left: 4, right: hasRight ? 4 : 16, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={spec.xKey} tick={axisTick} interval="preserveStartEnd" />
        <YAxis yAxisId="left" tick={axisTick} width={64} />
        {hasRight ? <YAxis yAxisId="right" orientation="right" tick={axisTick} width={56} /> : null}
        {spec.series.map((series, index) => {
          const colour = COLOURS[index % COLOURS.length];
          const axis = series.axis ?? "left";
          const type = spec.kind === "line" ? "line" : spec.kind === "bar" ? "bar" : (series.type ?? "bar");
          if (type === "line") return <Line key={series.key} yAxisId={axis} dataKey={series.key} name={series.label} stroke={colour} strokeWidth={2.5} dot={spec.data.length <= 24} connectNulls={false} />;
          if (type === "area") return <Area key={series.key} yAxisId={axis} dataKey={series.key} name={series.label} stroke={colour} fill={colour} fillOpacity={0.2} />;
          return <Bar key={series.key} yAxisId={axis} dataKey={series.key} name={series.label} fill={colour} stackId={series.stack} radius={3} />;
        })}
        {spec.referenceLines?.map((line) => (
          <ReferenceLine key={line.label} yAxisId={line.axis ?? "left"} y={line.value} stroke="#b4322a" strokeDasharray="5 4" label={{ value: line.label, fontSize: 11, position: "insideTopRight" }} />
        ))}
        {tooltip}
        <Legend />
      </Chart>
    );
  }

  return (
    <figure className="ir-chart">
      <figcaption>
        <p className="font-semibold text-ink">{spec.title}</p>
        <p className="text-xs text-muted">
          Unit: {spec.unit}
          {spec.rightUnit ? ` (right axis: ${spec.rightUnit})` : ""} · Period: {spec.period}
        </p>
      </figcaption>
      {hasData ? (
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer>{chart}</ResponsiveContainer>
        </div>
      ) : (
        <p className="py-6 text-sm text-muted">No data for this chart. It is not drawn rather than shown as zero.</p>
      )}
      <p className="text-sm text-ink-soft">{spec.explanation}</p>
      <p className="text-xs text-muted">Source: {spec.source}</p>
    </figure>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ScoreChart({ rows }: { rows: Array<{ name: string; score: number | null }> }) {
  const data = rows.filter((row) => row.score !== null);
  if (data.length === 0) return <p className="text-sm text-muted">No numeric component scores to chart.</p>;
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreBar" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22766d" />
              <stop offset="100%" stopColor="#10332f" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e4e1d9" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#5f6d69" }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#5f6d69" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "rgb(34 118 109 / 0.06)" }}
            contentStyle={{ borderRadius: 12, border: "1px solid #e4e1d9", boxShadow: "0 18px 40px -12px rgb(15 31 29 / 0.18)", fontSize: 12 }}
          />
          <Bar dataKey="score" fill="url(#scoreBar)" radius={[8, 8, 0, 0]} maxBarSize={56} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-muted">Component scores, 0–100 vulnerability contribution. Missing components are omitted.</p>
    </div>
  );
}

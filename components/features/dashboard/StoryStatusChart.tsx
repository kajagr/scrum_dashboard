"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type StatusBreakdown = {
  unassigned: number;
  in_active_sprint: number;
  ready_for_review: number;
  done: number;
  future_releases: number;
};

type Props = { projectId: string };

const STATUS_CONFIG = [
  { key: "in_active_sprint", label: "In active sprint", color: "#3b82f6" },
  { key: "ready_for_review", label: "Ready for review", color: "#a78bfa" },
  { key: "done", label: "Done", color: "#22c55e" },
  { key: "unassigned", label: "Unassigned", color: "#94a3b8" },
  { key: "future_releases", label: "Future releases", color: "#d1d5db" },
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="rounded-xl border border-border bg-surface shadow-md p-3 text-sm">
      <p className="font-medium text-foreground">{name}</p>
      <p className="text-muted">
        {value} {value === 1 ? "story" : "stories"}
      </p>
    </div>
  );
}

export default function StoryStatusChart({ projectId }: Props) {
  const [data, setData] = useState<StatusBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/story-stats`)
      .then((r) => r.json())
      .then((json) => setData(json.statusBreakdown))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 animate-pulse">
        <div className="h-4 w-32 bg-border rounded mb-4" />
        <div className="h-48 bg-border rounded" />
      </div>
    );
  }

  if (!data) return null;

  const chartData = STATUS_CONFIG.map((s) => ({
    name: s.label,
    value: data[s.key as keyof StatusBreakdown],
    color: s.color,
  })).filter((d) => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
        Stories
      </p>
      <h2 className="text-lg font-bold text-foreground mb-1">
        Status breakdown
      </h2>
      <p className="text-xs text-muted mb-6">{total} stories total</p>

      <div className="flex items-center gap-6 flex-wrap">
        {/* Donut */}
        <div style={{ width: 160, height: 160, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2.5 flex-1 min-w-[140px]">
          {STATUS_CONFIG.map((s) => {
            const count = data[s.key as keyof StatusBreakdown];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: s.color }}
                />
                <span className="text-sm text-foreground flex-1">
                  {s.label}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {count}
                </span>
                <span className="text-xs text-muted w-8 text-right">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

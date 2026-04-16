"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type SprintVelocity = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  isCompleted: boolean;
  isActive: boolean;
  estimated: number;
  logged: number;
  completedStories: number;
  totalStories: number;
};

type Props = {
  projectId: string;
};

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as SprintVelocity;
  return (
    <div className="rounded-xl border border-border bg-surface shadow-md p-3 text-sm min-w-[170px]">
      <p className="font-semibold text-foreground mb-2 truncate max-w-[160px]">
        {d.name}
      </p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-6">
          <span className="text-muted">Estimated</span>
          <span className="font-medium text-foreground">{d.estimated}h</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted">Logged</span>
          <span className="font-medium text-foreground">{d.logged}h</span>
        </div>
        <div className="border-t border-border mt-2 pt-2 flex justify-between gap-6">
          <span className="text-muted">Stories done</span>
          <span className="font-medium text-foreground">
            {d.completedStories}/{d.totalStories}
          </span>
        </div>
        {d.isActive && (
          <p className="text-primary font-medium pt-1">Active sprint</p>
        )}
      </div>
    </div>
  );
}

export default function VelocityChart({ projectId }: Props) {
  const [sprints, setSprints] = useState<SprintVelocity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/velocity`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((json) => setSprints(json.sprints ?? []))
      .catch(() => setError("Failed to load velocity data."))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 mt-6 animate-pulse">
        <div className="h-4 w-24 bg-border rounded mb-6" />
        <div className="h-52 bg-border rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 mt-6">
        <p className="text-sm text-muted">{error}</p>
      </div>
    );
  }

  if (sprints.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 mt-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
          Velocity
        </p>
        <p className="text-sm text-muted mt-2">No sprints to display.</p>
      </div>
    );
  }

  const completed = sprints.filter((s) => s.isCompleted);
  const avgVelocity =
    completed.length > 0
      ? Math.round(
          (completed.reduce((sum, s) => sum + s.logged, 0) / completed.length) *
            10,
        ) / 10
      : null;

  const activeSprint = sprints.find((s) => s.isActive);

  const chartData = sprints.map((s) => ({
    ...s,
    label: s.name.length > 12 ? s.name.slice(0, 11) + "…" : s.name,
  }));

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 mt-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
            Velocity
          </p>
          <h2 className="text-lg font-bold text-foreground">Sprint velocity</h2>
          <p className="text-xs text-muted mt-0.5">
            Comparison of estimated vs. logged hours
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          {/* {avgVelocity !== null && (
            <div className="rounded-xl border border-border bg-background px-4 py-2 text-center">
              <p className="text-xs text-muted">Avg. velocity</p>
              <p className="text-xl font-bold text-foreground">
                {avgVelocity}h
              </p>
            </div>
          )} */}
          {activeSprint && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-2 text-center">
              <p className="text-xs text-primary">Active sprint</p>
              <p className="text-xl font-bold text-foreground">
                {activeSprint.logged}h
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-5 mb-4 text-xs text-muted flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-border" />
          Estimated
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-primary" />
          Logged
        </span>
        {activeSprint && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-emerald-400" />
            Active sprint
          </span>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          barCategoryGap="30%"
          barGap={3}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="rgba(0,0,0,0.07)"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}
            axisLine={false}
            tickLine={false}
            unit="h"
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
          />
          <Bar
            dataKey="estimated"
            name="Estimated"
            radius={[4, 4, 0, 0]}
            fill="rgba(0,0,0,0.12)"
          />
          <Bar dataKey="logged" name="Logged" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  entry.isActive ? "#34d399" : "var(--color-primary, #3b82f6)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

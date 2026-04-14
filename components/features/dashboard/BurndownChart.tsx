"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type BurndownDay = {
  date: string;
  ideal: number;
  remaining: number | null;
  logged: number;
  isToday: boolean;
  isFuture: boolean;
};

type BurndownData = {
  sprint: { id: string; name: string; start_date: string; end_date: string };
  totalEstimated: number;
  days: BurndownDay[];
};

type Sprint = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
};

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
  });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted">{p.name}:</span>
          <span className="font-semibold text-foreground">{p.value != null ? `${Number(p.value).toFixed(1)}h` : "—"}</span>
        </div>
      ))}
    </div>
  );
};

export default function BurndownChart({ projectId }: { projectId: string }) {
  const [data, setData] = useState<BurndownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);

  // Fetch the sprint list once on mount
  useEffect(() => {
    fetch(`/api/projects/${projectId}/sprints`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setSprints(d); })
      .catch(() => {});
  }, [projectId]);

  // Fetch burndown data whenever the selected sprint changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    const url = selectedSprintId
      ? `/api/projects/${projectId}/burndown?sprintId=${selectedSprintId}`
      : `/api/projects/${projectId}/burndown`;
    fetch(url, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setData(d);
          // Sync dropdown to whichever sprint the API auto-selected
          if (!selectedSprintId) setSelectedSprintId(d.sprint.id);
        }
      })
      .catch(() => setError("Failed to load burndown data."))
      .finally(() => setLoading(false));
  }, [projectId, selectedSprintId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-muted">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm">Loading burndown...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2.5 p-4 rounded-xl border border-border bg-surface text-muted text-sm">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {error === "No sprint found." ? "No sprint data available yet." : error}
      </div>
    );
  }

  if (!data) return null;

  const todayIndex = data.days.findIndex((d) => d.isToday);
  const todayDate = todayIndex >= 0 ? data.days[todayIndex].date : null;

  const chartData = data.days.map((d) => ({
    date: formatDate(d.date),
    Ideal: d.ideal,
    Remaining: d.remaining,
    Logged: d.logged,
    isToday: d.isToday,
    isFuture: d.isFuture,
  }));

  const todayRemaining = data.days.find((d) => d.isToday)?.remaining;
  const totalLogged = data.days[data.days.length - 1]?.logged ?? 0;
  const progressPct = data.totalEstimated > 0
    ? Math.min(100, Math.round((totalLogged / data.totalEstimated) * 100))
    : 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">Sprint</p>
          <h2 className="text-xl font-bold text-foreground">{data.sprint.name} — Burn-Down</h2>
          <p className="text-sm text-muted mt-0.5">
            {new Date(data.sprint.start_date + "T12:00:00").toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
            {" – "}
            {new Date(data.sprint.end_date + "T12:00:00").toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}
          </p>
          {sprints.length > 1 && (
            <select
              className="mt-3 text-sm rounded-lg border border-border bg-surface text-foreground px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              value={selectedSprintId ?? ""}
              onChange={(e) => setSelectedSprintId(e.target.value)}
            >
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{data.totalEstimated.toFixed(0)}h</p>
            <p className="text-xs text-muted">estimated</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{totalLogged.toFixed(1)}h</p>
            <p className="text-xs text-muted">logged</p>
          </div>
          {todayRemaining != null && (
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{todayRemaining.toFixed(1)}h</p>
              <p className="text-xs text-muted">remaining</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{progressPct}%</p>
            <p className="text-xs text-muted">progress</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--color-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-muted)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}h`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "var(--color-muted)", paddingTop: 12 }}
          />
          {/* Today reference line */}
          {todayDate && (
            <ReferenceLine
              x={formatDate(todayDate)}
              stroke="var(--color-primary)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: "Today", position: "top", fontSize: 10, fill: "var(--color-primary)" }}
            />
          )}
          {/* Ideal line */}
          <Line
            type="linear"
            dataKey="Ideal"
            stroke="var(--color-subtle)"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            connectNulls
          />
          {/* Actual remaining */}
          <Line
            type="monotone"
            dataKey="Remaining"
            stroke="var(--color-error)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            activeDot={{ r: 4, fill: "var(--color-error)" }}
          />
          {/* Logged cumulative */}
          <Line
            type="monotone"
            dataKey="Logged"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={false}
            connectNulls
            activeDot={{ r: 4, fill: "var(--color-primary)" }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend description */}
      <div className="mt-4 flex items-center gap-6 flex-wrap text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-6 border-t-2 border-dashed border-subtle inline-block" />
          Ideal — linear from total to 0
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 border-t-2 border-error inline-block" />
          Remaining — estimated minus logged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 border-t-2 border-primary inline-block" />
          Logged — cumulative hours spent
        </span>
      </div>
    </div>
  );
}
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

type UserStat = {
  user_id: string;
  name: string;
  role: string;
  logged: number;
  isRemoved: boolean;
};

type Props = { projectId: string };

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as UserStat;
  return (
    <div className="rounded-xl border border-border bg-surface shadow-md p-3 text-sm min-w-[150px]">
      <div className="flex items-center gap-2 mb-1">
        <p className="font-medium text-foreground">{d.name}</p>
        {d.isRemoved && (
          <span className="text-xs text-muted border border-border rounded px-1">
            removed
          </span>
        )}
      </div>
      <p className="text-xs text-muted capitalize mb-2">
        {d.role.replace("_", " ")}
      </p>
      <p className="text-foreground">{d.logged}h logged</p>
    </div>
  );
}

export default function UserBreakdownChart({ projectId }: Props) {
  const [users, setUsers] = useState<UserStat[]>([]);
  const [scope, setScope] = useState<"all" | "sprint">("sprint");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/user-stats?scope=${scope}`)
      .then((r) => r.json())
      .then((json) => setUsers(json.users ?? []))
      .finally(() => setLoading(false));
  }, [projectId, scope]);

  const chartData = users.map((u) => ({
    ...u,
    label: u.name.split(" ")[0], // first name only on axis
  }));

  const chartHeight = Math.max(180, chartData.length * 44 + 40);

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
            Team
          </p>
          <h2 className="text-lg font-bold text-foreground">
            Hours per member
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Logged hours per team member
          </p>
        </div>

        {/* Scope switcher */}
        <div className="flex gap-1 p-1 rounded-lg bg-background border border-border text-xs">
          {(["sprint", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                scope === s
                  ? "bg-surface border border-border text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {s === "sprint" ? "This sprint" : "All time"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 bg-border rounded" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted">No data available.</p>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            barCategoryGap="30%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="rgba(0,0,0,0.07)"
            />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}
              axisLine={false}
              tickLine={false}
              unit="h"
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 12, fill: "currentColor", opacity: 0.7 }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Bar
              dataKey="logged"
              name="Logged"
              radius={[0, 4, 4, 0]}
              label={{
                position: "right",
                fontSize: 11,
                fill: "currentColor",
                opacity: 0.6,
                formatter: (v: unknown) => `${v}h`,
              }}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.isRemoved
                      ? "rgba(0,0,0,0.2)"
                      : "var(--color-primary, #3b82f6)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

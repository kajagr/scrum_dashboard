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

// ─── Types ────────────────────────────────────────────────────────────────────
type Contributor = {
  user_id: string;
  name: string;
  hours: number;
  isRemoved: boolean;
};

type Task = {
  id: string;
  title: string;
  contributors: Contributor[];
};

type Story = {
  id: string;
  title: string;
  status: string;
  contributors: Contributor[];
  tasks: Task[];
};

type UserMeta = {
  user_id: string;
  name: string;
  isRemoved: boolean;
};

type Props = { projectId: string };

// ─── Color palette per user ───────────────────────────────────────────────────
const PALETTE = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a78bfa",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#64748b",
];

function buildColorMap(users: UserMeta[]): Record<string, string> {
  const map: Record<string, string> = {};
  users.forEach((u, i) => {
    map[u.user_id] = PALETTE[i % PALETTE.length];
  });
  return map;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function StoryTooltip({ active, payload, label, colorMap, allUsers }: any) {
  if (!active || !payload?.length) return null;
  const story = payload[0]?.payload as Story & { label: string };
  return (
    <div className="rounded-xl border border-border bg-surface shadow-md p-3 text-sm min-w-[180px]">
      <p className="font-medium text-foreground mb-2 max-w-[200px] line-clamp-2">
        {story.title}
      </p>
      <div className="space-y-1 text-xs">
        {story.contributors.map((c) => (
          <div key={c.user_id} className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: colorMap[c.user_id] ?? "#94a3b8",
                opacity: c.isRemoved ? 0.5 : 1,
              }}
            />
            <span
              className={`flex-1 ${c.isRemoved ? "text-muted line-through" : "text-foreground"}`}
            >
              {c.name}
            </span>
            <span className="font-medium">{c.hours}h</span>
          </div>
        ))}
        {story.contributors.length === 0 && (
          <p className="text-muted">No hours logged yet</p>
        )}
      </div>
      <p className="text-xs text-primary mt-2">Click to see task breakdown</p>
    </div>
  );
}

function TaskTooltip({ active, payload, colorMap }: any) {
  if (!active || !payload?.length) return null;
  const task = payload[0]?.payload as Task & { label: string };
  return (
    <div className="rounded-xl border border-border bg-surface shadow-md p-3 text-sm min-w-[180px]">
      <p className="font-medium text-foreground mb-2 max-w-[200px] line-clamp-2">
        {task.title}
      </p>
      <div className="space-y-1 text-xs">
        {task.contributors.map((c) => (
          <div key={c.user_id} className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: colorMap[c.user_id] ?? "#94a3b8",
                opacity: c.isRemoved ? 0.5 : 1,
              }}
            />
            <span
              className={`flex-1 ${c.isRemoved ? "text-muted line-through" : "text-foreground"}`}
            >
              {c.name}
            </span>
            <span className="font-medium">{c.hours}h</span>
          </div>
        ))}
        {task.contributors.length === 0 && (
          <p className="text-muted">No hours logged</p>
        )}
      </div>
    </div>
  );
}

// ─── Stacked bar data builder ─────────────────────────────────────────────────
// Recharts stacked bars need flat keys — one per user
function buildChartData(
  items: { id: string; title: string; contributors: Contributor[] }[],
) {
  return items.map((item) => {
    const row: Record<string, any> = {
      ...item,
      label:
        item.title.length > 20 ? item.title.slice(0, 19) + "…" : item.title,
    };
    for (const c of item.contributors) {
      row[c.user_id] = c.hours;
    }
    return row;
  });
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function StoryWorkChart({ projectId }: Props) {
  const [stories, setStories] = useState<Story[]>([]);
  const [allUsers, setAllUsers] = useState<UserMeta[]>([]);
  const [sprintName, setSprintName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/story-work`)
      .then((r) => r.json())
      .then((json) => {
        setStories(json.stories ?? []);
        setAllUsers(json.allUsers ?? []);
        setSprintName(json.sprintName ?? null);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const colorMap = buildColorMap(allUsers);
  const storyChartData = buildChartData(stories);
  const taskChartData = selectedStory
    ? buildChartData(selectedStory.tasks)
    : [];

  const storyHeight = Math.max(160, stories.length * 52 + 40);
  const taskHeight = selectedStory
    ? Math.max(120, selectedStory.tasks.length * 44 + 40)
    : 0;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 animate-pulse">
        <div className="h-4 w-32 bg-border rounded mb-4" />
        <div className="h-48 bg-border rounded" />
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
          Sprint
        </p>
        <p className="text-sm text-muted mt-2">
          {sprintName ? "No stories in this sprint." : "No active sprint."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      {/* Header */}
      <div className="mb-5">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
          Sprint
        </p>
        <h2 className="text-lg font-bold text-foreground">
          Who worked on what
        </h2>
        <p className="text-xs text-muted mt-0.5">
          {sprintName} — hours per person per story
        </p>
      </div>

      {/* User legend */}
      <div className="flex gap-4 flex-wrap mb-5 text-xs">
        {allUsers.map((u) => (
          <span key={u.user_id} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{
                background: colorMap[u.user_id],
                opacity: u.isRemoved ? 0.45 : 1,
              }}
            />
            <span
              className={
                u.isRemoved ? "text-muted line-through" : "text-foreground"
              }
            >
              {u.name}
            </span>
            {u.isRemoved && <span className="text-muted">(removed)</span>}
          </span>
        ))}
      </div>

      {/* ── Story-level chart ── */}
      <p className="text-xs font-medium text-muted mb-2 uppercase tracking-wide">
        Stories — click to see task breakdown
      </p>
      <ResponsiveContainer width="100%" height={storyHeight}>
        <BarChart
          data={storyChartData}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          barCategoryGap="28%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="rgba(0,0,0,0.06)"
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
            tick={{ fontSize: 11, fill: "currentColor", opacity: 0.7 }}
            axisLine={false}
            tickLine={false}
            width={130}
            cursor="pointer"
          />
          <Tooltip
            content={<StoryTooltip colorMap={colorMap} allUsers={allUsers} />}
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
          />
          {allUsers.map((u) => (
            <Bar
              key={u.user_id}
              dataKey={u.user_id}
              stackId="story"
              name={u.name}
              fill={colorMap[u.user_id]}
              opacity={u.isRemoved ? 0.45 : 1}
              cursor="pointer"
              onClick={(data: any) => {
                const story = stories.find((s) => s.id === data?.id);
                setSelectedStory((prev) =>
                  prev?.id === story?.id ? null : (story ?? null),
                );
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* ── Task drill-down ── */}
      {selectedStory && (
        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">
                Task breakdown
              </p>
              <p className="text-sm font-semibold text-foreground line-clamp-1">
                {selectedStory.title}
              </p>
            </div>
            <button
              onClick={() => setSelectedStory(null)}
              className="text-xs text-muted hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
            >
              Close ✕
            </button>
          </div>

          {selectedStory.tasks.every((t) => t.contributors.length === 0) ? (
            <p className="text-sm text-muted">
              No hours logged on any task yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={taskHeight}>
              <BarChart
                data={taskChartData}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                barCategoryGap="28%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="rgba(0,0,0,0.06)"
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
                  tick={{ fontSize: 11, fill: "currentColor", opacity: 0.7 }}
                  axisLine={false}
                  tickLine={false}
                  width={130}
                />
                <Tooltip
                  content={<TaskTooltip colorMap={colorMap} />}
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                />
                {allUsers.map((u) => (
                  <Bar
                    key={u.user_id}
                    dataKey={u.user_id}
                    stackId="task"
                    name={u.name}
                    fill={colorMap[u.user_id]}
                    opacity={u.isRemoved ? 0.45 : 1}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}

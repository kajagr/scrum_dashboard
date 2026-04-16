"use client";

import { useState } from "react";
import BurndownChart from "@/components/features/dashboard/BurndownChart";
import VelocityChart from "@/components/features/dashboard/VelocityChart";
import StoryStatusChart from "@/components/features/dashboard/StoryStatusChart";
import UserBreakdownChart from "@/components/features/dashboard/UserBreakdownChart";
import StoryWorkChart from "@/components/features/dashboard/StoryWorkChart";

type Tab = "burndown" | "statistics";

export default function ChartSwitcher({ projectId }: { projectId: string }) {
  const [active, setActive] = useState<Tab>("burndown");

  return (
    <div>
      <div className="flex gap-1 p-1 rounded-xl bg-surface border border-border w-fit mb-2">
        {(["burndown", "statistics"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              active === tab
                ? "bg-background border border-border text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab === "burndown" ? "Burn-Down" : "Statistics"}
          </button>
        ))}
      </div>

      {active === "burndown" && <BurndownChart projectId={projectId} />}
      {active === "statistics" && <Statistics projectId={projectId} />}
    </div>
  );
}

function Statistics({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StoryStatusChart projectId={projectId} />
        <UserBreakdownChart projectId={projectId} />
      </div>
      <VelocityChart projectId={projectId} />
      <StoryWorkChart projectId={projectId} />
    </div>
  );
}

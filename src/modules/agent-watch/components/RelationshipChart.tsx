"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AgentRelationshipChartRow } from "@/lib/agentRelationship";

export function RelationshipChart({ rows }: { rows: AgentRelationshipChartRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="mt-8 rounded-2xl border border-violet-300/20 bg-violet-950/[0.12] p-5">
      <div className="mb-4">
        <h2 className="text-lg font-black text-white">Agent Relationship Debt</h2>
        <p className="mt-1 text-xs leading-6 text-white/45">
          Emotional debt decays over time. Positive values mean unresolved rivalry pressure;
          negative values mean the pair recently cooled down.
        </p>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="pair" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "#111",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12,
              }}
            />
            <Bar dataKey="debt" radius={[8, 8, 0, 0]} fill="#9b6bff" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

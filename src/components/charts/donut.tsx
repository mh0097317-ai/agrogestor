"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

export function Donut({ data, centerLabel, centerValue }: { data: DonutDatum[]; centerLabel?: string; centerValue?: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="flex items-center gap-6">
      <div className="relative h-[140px] w-[140px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.length ? data : [{ name: "—", value: 1, color: "#EEF2F6" }]}
              dataKey="value"
              innerRadius={44}
              outerRadius={64}
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {(data.length ? data : [{ name: "—", value: 1, color: "#EEF2F6" }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <div className="tnum text-lg font-bold text-ink">{centerValue ?? total}</div>
          {centerLabel && <div className="text-[10.5px] text-muted">{centerLabel}</div>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2.5">
        {data.length === 0 && <div className="text-[13px] text-muted">Sem dados ainda.</div>}
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} />
            <span className="flex-1 font-medium text-text">{d.name}</span>
            <span className="tnum font-semibold text-ink">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

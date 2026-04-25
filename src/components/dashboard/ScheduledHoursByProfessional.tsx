import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { DashboardPeriod, getPeriodRange } from "@/lib/dashboard-period";

/**
 * Palette derived from the brand red #CC2222.
 * Uses HSL variants (different lightness/saturation) so slices stay
 * recognizably "brand" while remaining distinguishable from each other.
 */
const BRAND_PALETTE = [
  "hsl(0, 71%, 47%)",   // base #CC2222
  "hsl(0, 60%, 35%)",   // deep crimson
  "hsl(10, 75%, 55%)",  // warm coral
  "hsl(350, 65%, 60%)", // pinkish red
  "hsl(20, 70%, 50%)",  // burnt orange-red
  "hsl(0, 45%, 65%)",   // muted rose
  "hsl(355, 80%, 40%)", // dark cherry
  "hsl(15, 85%, 65%)",  // light salmon
];

interface ProfessionalHours {
  id: string;
  name: string;
  type: "physio" | "evaluator";
  hours: number;
}

const TYPE_LABELS: Record<string, string> = {
  physio: "Fisio",
  evaluator: "Evaluador",
};

interface Props {
  period: DashboardPeriod;
}

export default function ScheduledHoursByProfessional({ period }: Props) {
  const range = getPeriodRange(period);
  const rangeStart = range.start.toISOString();
  const rangeEnd = range.end.toISOString();
  const periodLabel = range.label;

  const { data, isLoading } = useQuery({
    queryKey: ["scheduled-hours-by-professional", rangeStart, rangeEnd],
    queryFn: async (): Promise<ProfessionalHours[]> => {
      const [apptsRes, profsRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("professional_id, start_time, end_time, status")
          .gte("start_time", rangeStart)
          .lte("start_time", rangeEnd)
          .neq("status", "cancelled"),
        supabase.from("professionals").select("id, name, type"),
      ]);

      if (apptsRes.error) throw apptsRes.error;
      if (profsRes.error) throw profsRes.error;

      const totals = new Map<string, number>();
      for (const a of apptsRes.data ?? []) {
        if (!a.professional_id) continue;
        const ms = new Date(a.end_time).getTime() - new Date(a.start_time).getTime();
        if (ms <= 0) continue;
        totals.set(
          a.professional_id,
          (totals.get(a.professional_id) ?? 0) + ms / (1000 * 60 * 60)
        );
      }

      return (profsRes.data ?? [])
        .map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type as "physio" | "evaluator",
          hours: Math.round((totals.get(p.id) ?? 0) * 10) / 10,
        }))
        .filter((p) => p.hours > 0)
        .sort((a, b) => b.hours - a.hours);
    },
  });

  const totalHours = (data ?? []).reduce((s, p) => s + p.hours, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold capitalize">
          Horas agendadas — {periodLabel}
        </h2>
      </div>

      <div className="bg-card border rounded-lg p-5 space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Sin citas registradas en este período
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-center">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      dataKey="hours"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={50}
                      paddingAngle={2}
                    >
                      {data.map((entry, idx) => (
                        <Cell
                          key={entry.id}
                          fill={BRAND_PALETTE[idx % BRAND_PALETTE.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        fontSize: "0.875rem",
                      }}
                      formatter={(value: number, _name, payload: any) => {
                        const pct = totalHours
                          ? ((value / totalHours) * 100).toFixed(1)
                          : "0";
                        return [
                          `${value} hrs · ${pct}%`,
                          payload?.payload?.name,
                        ];
                      }}
                    />
                    <Legend
                      verticalAlign="middle"
                      align="right"
                      layout="vertical"
                      iconType="circle"
                      formatter={(value, entry: any) => {
                        const pct = totalHours
                          ? ((entry.payload.hours / totalHours) * 100).toFixed(1)
                          : "0";
                        return (
                          <span className="text-xs text-foreground">
                            {value} · {pct}%
                          </span>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 font-medium">Profesional</th>
                      <th className="py-2 font-medium">Tipo</th>
                      <th className="py-2 font-medium text-right">Horas</th>
                      <th className="py-2 font-medium text-right">% del total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((p, idx) => {
                      const pct = totalHours ? (p.hours / totalHours) * 100 : 0;
                      return (
                        <tr key={p.id} className="border-t">
                          <td className="py-2.5 flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 rounded-full"
                              style={{
                                backgroundColor:
                                  BRAND_PALETTE[idx % BRAND_PALETTE.length],
                              }}
                            />
                            <span className="font-medium">{p.name}</span>
                          </td>
                          <td className="py-2.5 text-muted-foreground">
                            {TYPE_LABELS[p.type] ?? p.type}
                          </td>
                          <td className="py-2.5 text-right tabular-nums">
                            {p.hours} hrs
                          </td>
                          <td className="py-2.5 text-right tabular-nums">
                            {pct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t font-semibold">
                      <td className="py-2.5" colSpan={2}>
                        Total
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {totalHours.toFixed(1)} hrs
                      </td>
                      <td className="py-2.5 text-right tabular-nums">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

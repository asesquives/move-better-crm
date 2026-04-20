import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";

interface MonthBucket {
  key: string;
  label: string;
  revenue: number;
  appointments: number;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 0,
  }).format(n);

function buildEmptyMonths(): MonthBucket[] {
  const now = new Date();
  return Array.from({ length: 6 }).map((_, i) => {
    const d = startOfMonth(subMonths(now, 5 - i));
    return {
      key: format(d, "yyyy-MM"),
      label: format(d, "MMM", { locale: es }),
      revenue: 0,
      appointments: 0,
    };
  });
}

export default function BusinessTrends() {
  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5)).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["business-trends-6m"],
    queryFn: async () => {
      const [revenueRes, apptsRes] = await Promise.all([
        supabase
          .from("revenue_entries")
          .select("amount, recognized_at")
          .gte("recognized_at", sixMonthsAgo),
        supabase
          .from("appointments")
          .select("start_time, status")
          .gte("start_time", sixMonthsAgo)
          .neq("status", "cancelled"),
      ]);

      if (revenueRes.error) throw revenueRes.error;
      if (apptsRes.error) throw apptsRes.error;

      const buckets = buildEmptyMonths();
      const idx = new Map(buckets.map((b, i) => [b.key, i]));

      for (const r of revenueRes.data ?? []) {
        const k = format(new Date(r.recognized_at), "yyyy-MM");
        const i = idx.get(k);
        if (i !== undefined) buckets[i].revenue += Number(r.amount ?? 0);
      }
      for (const a of apptsRes.data ?? []) {
        const k = format(new Date(a.start_time), "yyyy-MM");
        const i = idx.get(k);
        if (i !== undefined) buckets[i].appointments += 1;
      }
      return buckets;
    },
  });

  const buckets = data ?? buildEmptyMonths();
  const totalRevenue = buckets.reduce((sum, b) => sum + b.revenue, 0);
  const totalAppts = buckets.reduce((sum, b) => sum + b.appointments, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Tendencias del negocio</h2>
        <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border rounded-lg p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-sm font-semibold">Ingresos por mes</h3>
            <span className="text-sm font-bold tabular-nums">{formatCurrency(totalRevenue)}</span>
          </div>
          <div className="h-56">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `S/${v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                    }}
                    formatter={(v: number) => [formatCurrency(v), "Ingresos"]}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-card border rounded-lg p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-sm font-semibold">Citas por mes</h3>
            <span className="text-sm font-bold tabular-nums">{totalAppts} citas</span>
          </div>
          <div className="h-56">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={buckets} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                    }}
                    formatter={(v: number) => [v, "Citas"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="appointments"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

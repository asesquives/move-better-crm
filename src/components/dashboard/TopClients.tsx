import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Crown, Medal, Award } from "lucide-react";

interface ClientRevenue {
  client_id: string;
  client_name: string;
  total: number;
  appointments: number;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Aggregates revenue_entries grouped by client and returns the top N.
 * `since` (ISO string) optionally restricts the time window.
 */
async function fetchTopClients(since?: string, limit = 3): Promise<ClientRevenue[]> {
  let q = supabase.from("revenue_entries").select("amount, client_id, recognized_at");
  if (since) q = q.gte("recognized_at", since);
  const { data: revenue, error } = await q;
  if (error) throw error;

  const totals = new Map<string, { total: number; appointments: number }>();
  for (const r of revenue ?? []) {
    if (!r.client_id) continue;
    const prev = totals.get(r.client_id) ?? { total: 0, appointments: 0 };
    totals.set(r.client_id, {
      total: prev.total + Number(r.amount ?? 0),
      appointments: prev.appointments + 1,
    });
  }

  const ids = Array.from(totals.keys());
  if (ids.length === 0) return [];

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .in("id", ids);

  return ids
    .map((id) => ({
      client_id: id,
      client_name: clients?.find((c) => c.id === id)?.name ?? "Desconocido",
      total: totals.get(id)!.total,
      appointments: totals.get(id)!.appointments,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

const rankIcons = [Crown, Medal, Award];
const rankColors = ["text-yellow-500", "text-slate-400", "text-amber-700"];

function RankingList({
  data,
  loading,
  emptyText,
}: {
  data: ClientRevenue[] | undefined;
  loading: boolean;
  emptyText: string;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ol className="space-y-2">
      {data.map((c, idx) => {
        const Icon = rankIcons[idx] ?? Trophy;
        return (
          <li
            key={c.client_id}
            className="flex items-center justify-between gap-3 bg-muted/30 rounded-md px-3 py-2"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Icon className={`h-4 w-4 shrink-0 ${rankColors[idx] ?? "text-muted-foreground"}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{c.client_name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.appointments} {c.appointments === 1 ? "registro" : "registros"}
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold tabular-nums">{formatCurrency(c.total)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function TopClients() {
  const last30Iso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: allTime, isLoading: loadingAll } = useQuery({
    queryKey: ["top-clients-all-time"],
    queryFn: () => fetchTopClients(undefined, 3),
  });

  const { data: monthly, isLoading: loadingMonthly } = useQuery({
    queryKey: ["top-clients-30d"],
    queryFn: () => fetchTopClients(last30Iso, 3),
  });

  const featured = allTime?.[0];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Mejores clientes</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Featured card */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Trophy className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">Cliente destacado</span>
            </div>
            {featured ? (
              <>
                <p className="text-xl font-bold mt-3 truncate">{featured.client_name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {featured.appointments} ingresos registrados
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-3">Aún no hay datos</p>
            )}
          </div>
          {featured && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">Total generado</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(featured.total)}</p>
            </div>
          )}
        </div>

        {/* All-time top 3 */}
        <div className="bg-card border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-3">Top 3 histórico</h3>
          <RankingList
            data={allTime}
            loading={loadingAll}
            emptyText="Aún no hay ingresos registrados."
          />
        </div>

        {/* Last 30 days */}
        <div className="bg-card border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-3">Top 3 últimos 30 días</h3>
          <RankingList
            data={monthly}
            loading={loadingMonthly}
            emptyText="Sin ingresos en los últimos 30 días."
          />
        </div>
      </div>
    </div>
  );
}

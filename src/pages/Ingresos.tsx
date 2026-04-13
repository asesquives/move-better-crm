import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function IngresosPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));

  const start = startOfMonth(new Date(month + "-01")).toISOString();
  const end = endOfMonth(new Date(month + "-01")).toISOString();

  const { data: entries, isLoading } = useQuery({
    queryKey: ["revenue", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_entries")
        .select("*, clients(name), packages(name)")
        .gte("recognized_at", start)
        .lte("recognized_at", end)
        .order("recognized_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const total = entries?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ingresos</h1>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" />
      </div>

      <div className="bg-card rounded-lg border p-5">
        <p className="text-sm text-muted-foreground">Total del mes</p>
        <p className="text-3xl font-bold mt-1">S/ {total.toFixed(2)}</p>
        <p className="text-xs text-muted-foreground capitalize mt-1">
          {format(new Date(month + "-01"), "MMMM yyyy", { locale: es })}
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !entries?.length ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">No hay ingresos registrados este mes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="bg-card rounded-lg border p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{(e.clients as any)?.name || "—"}</p>
                <p className="text-sm text-muted-foreground">
                  {(e.packages as any)?.name || "Sin paquete"} · {format(new Date(e.recognized_at), "dd/MM/yyyy")}
                </p>
              </div>
              <p className="font-semibold">S/ {Number(e.amount).toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

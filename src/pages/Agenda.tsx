import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const dayStart = new Date(selectedDate + "T00:00:00").toISOString();
  const dayEnd = new Date(selectedDate + "T23:59:59").toISOString();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["appointments", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, clients(name), professionals(name)")
        .gte("start_time", dayStart)
        .lte("start_time", dayEnd)
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700",
    confirmed: "bg-green-100 text-green-700",
    done: "bg-muted text-muted-foreground",
    cancelled: "bg-red-100 text-red-700",
    no_show: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agenda</h1>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      <p className="text-muted-foreground capitalize">
        {format(new Date(selectedDate + "T12:00:00"), "EEEE, d 'de' MMMM yyyy", { locale: es })}
      </p>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !appointments?.length ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">No hay citas para este día</p>
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((apt) => (
            <div key={apt.id} className="bg-card rounded-lg border p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">{(apt.clients as any)?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(apt.start_time), "HH:mm")} - {format(new Date(apt.end_time), "HH:mm")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(apt.professionals as any)?.name || "Sin asignar"} · {apt.type.replace("_", " ")}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[apt.status] || "bg-muted text-muted-foreground"}`}>
                {apt.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

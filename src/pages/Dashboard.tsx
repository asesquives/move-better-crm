import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Users, Package, DollarSign, Clock, UserCog } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import TopClients from "@/components/dashboard/TopClients";
import BusinessTrends from "@/components/dashboard/BusinessTrends";

export default function Dashboard() {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  const { data: todayAppointments } = useQuery({
    queryKey: ["appointments-today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, clients(name), professionals(name)")
        .gte("start_time", todayStart)
        .lt("start_time", todayEnd)
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: clientCount } = useQuery({
    queryKey: ["client-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("clients").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: activePackages } = useQuery({
    queryKey: ["active-packages-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("packages").select("*", { count: "exact", head: true }).eq("status", "active");
      if (error) throw error;
      return count || 0;
    },
  });

  const quickLinks = [
    { title: "Agenda", icon: Calendar, href: "/agenda", description: "Ver citas del día" },
    { title: "Clientes", icon: Users, href: "/clientes", description: "Gestionar pacientes" },
    { title: "Paquetes", icon: Package, href: "/paquetes", description: "Planes activos" },
    { title: "Ingresos", icon: DollarSign, href: "/ingresos", description: "Resumen financiero" },
    { title: "Disponibilidad", icon: Clock, href: "/disponibilidad", description: "Horarios del equipo" },
    { title: "Equipo", icon: UserCog, href: "/equipo", description: "Profesionales" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground capitalize">
          {format(today, "EEEE, d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border p-5">
          <p className="text-sm text-muted-foreground">Citas hoy</p>
          <p className="text-3xl font-bold mt-1">{todayAppointments?.length ?? 0}</p>
        </div>
        <div className="bg-card rounded-lg border p-5">
          <p className="text-sm text-muted-foreground">Clientes totales</p>
          <p className="text-3xl font-bold mt-1">{clientCount ?? 0}</p>
        </div>
        <div className="bg-card rounded-lg border p-5">
          <p className="text-sm text-muted-foreground">Paquetes activos</p>
          <p className="text-3xl font-bold mt-1">{activePackages ?? 0}</p>
        </div>
      </div>

      {/* Today's appointments */}
      {todayAppointments && todayAppointments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Citas de hoy</h2>
          <div className="space-y-2">
            {todayAppointments.map((apt) => (
              <div key={apt.id} className="bg-card rounded-lg border p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{(apt.clients as any)?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(apt.start_time), "HH:mm")} - {format(new Date(apt.end_time), "HH:mm")} · {(apt.professionals as any)?.name || "Sin asignar"}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium capitalize">
                  {apt.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Acceso rápido</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="bg-card rounded-lg border p-4 hover:border-primary/50 transition-colors group"
            >
              <link.icon className="h-5 w-5 text-primary mb-2" />
              <p className="font-medium text-sm">{link.title}</p>
              <p className="text-xs text-muted-foreground">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Users, Package, DollarSign, Clock, UserCog } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import TopClients from "@/components/dashboard/TopClients";
import BusinessTrends from "@/components/dashboard/BusinessTrends";
import ScheduledHoursByProfessional from "@/components/dashboard/ScheduledHoursByProfessional";
import PeriodSelector from "@/components/dashboard/PeriodSelector";
import { DashboardPeriod, getPeriodRange } from "@/lib/dashboard-period";

export default function Dashboard() {
  const today = new Date();
  const [period, setPeriod] = useState<DashboardPeriod>({
    mode: "month",
    date: new Date(),
  });
  const range = getPeriodRange(period);
  const rangeStartIso = range.start.toISOString();
  const rangeEndIso = range.end.toISOString();

  const { data: periodAppointments } = useQuery({
    queryKey: ["appointments-period", rangeStartIso, rangeEndIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id")
        .gte("start_time", rangeStartIso)
        .lte("start_time", rangeEndIso)
        .neq("status", "cancelled");
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
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground capitalize">
            {format(today, "EEEE, d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex flex-col items-start lg:items-end gap-1">
          <PeriodSelector value={period} onChange={setPeriod} />
          <p className="text-xs text-muted-foreground capitalize">
            Período: {range.label}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border p-5">
          <p className="text-sm text-muted-foreground">Citas del período</p>
          <p className="text-3xl font-bold mt-1">{periodAppointments?.length ?? 0}</p>
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

      {/* Business trends */}
      <BusinessTrends period={period} />

      {/* Scheduled hours by professional */}
      <ScheduledHoursByProfessional period={period} />

      {/* Top clients */}
      <TopClients />

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

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Plus, Search, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { SESSION_TYPE_COLORS } from "@/lib/agenda-constants";

export default function ClientesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", search],
    queryFn: async () => {
      let query = supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (search) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").insert({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      setForm({ name: "", phone: "", email: "", notes: "" });
      toast.success("Cliente creado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Detail queries
  const { data: clientDetail } = useQuery({
    queryKey: ["client-detail", selectedClientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", selectedClientId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClientId,
  });

  const { data: clientPackages } = useQuery({
    queryKey: ["client-packages", selectedClientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("client_id", selectedClientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClientId,
  });

  const { data: clientAppointments } = useQuery({
    queryKey: ["client-appointments", selectedClientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, professionals(name)")
        .eq("client_id", selectedClientId!)
        .order("start_time", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClientId,
  });

  const { data: clientRevenue } = useQuery({
    queryKey: ["client-revenue", selectedClientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_entries")
        .select("amount")
        .eq("client_id", selectedClientId!);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClientId,
  });

  const activePackages = clientPackages?.filter((p) => p.status === "active") || [];
  const totalPaid = clientPackages?.reduce((s, p) => s + Number(p.total_paid), 0) || 0;
  const totalRecognized = clientRevenue?.reduce((s, r) => s + Number(r.amount), 0) || 0;
  const pendingBalance = totalPaid - totalRecognized;

  const statusLabels: Record<string, string> = { active: "Activo", expired: "Expirado", completed: "Completado" };
  const statusColors: Record<string, string> = { active: "bg-green-100 text-green-700", expired: "bg-red-100 text-red-700", completed: "bg-muted text-muted-foreground" };
  const apptStatusLabels: Record<string, string> = { scheduled: "Agendada", confirmed: "Confirmada", done: "Realizada", cancelled: "Cancelada", no_show: "No-show" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuevo cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createClient.mutate(); }} className="space-y-4">
              <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={createClient.isPending}>Guardar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre o teléfono..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !clients?.length ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">No hay clientes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <div
              key={c.id}
              className="bg-card rounded-lg border p-4 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedClientId(c.id)}
            >
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-muted-foreground">
                {[c.phone, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Client detail sheet */}
      <Sheet open={!!selectedClientId} onOpenChange={(o) => { if (!o) setSelectedClientId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{clientDetail?.name || "Cliente"}</SheetTitle>
            <SheetDescription>Detalle del cliente</SheetDescription>
          </SheetHeader>

          {clientDetail && (
            <div className="space-y-6 mt-6">
              {/* Basic info */}
              <div className="space-y-2">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wide">Datos básicos</h3>
                <div className="bg-muted/30 rounded-lg p-4 space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Teléfono:</span> {clientDetail.phone || "—"}</p>
                  <p><span className="text-muted-foreground">Email:</span> {clientDetail.email || "—"}</p>
                  {clientDetail.notes && <p><span className="text-muted-foreground">Notas:</span> {clientDetail.notes}</p>}
                </div>
              </div>

              {/* Pending balance */}
              <div className="bg-card rounded-lg border p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo pendiente de devengar</p>
                <p className="text-2xl font-bold mt-1">S/ {pendingBalance.toFixed(2)}</p>
              </div>

              {/* Active packages */}
              <div className="space-y-2">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wide">Paquetes activos ({activePackages.length})</h3>
                {activePackages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin paquetes activos</p>
                ) : (
                  activePackages.map((pkg) => (
                    <div key={pkg.id} className="bg-card rounded-lg border p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{pkg.name}</p>
                          <p className="text-xs text-muted-foreground">{pkg.sessions_used}/{pkg.total_sessions} sesiones</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[pkg.status]}`}>
                          {statusLabels[pkg.status]}
                        </span>
                      </div>
                      <Progress value={(pkg.sessions_used / pkg.total_sessions) * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground">S/ {Number(pkg.total_paid).toFixed(2)} pagado · S/ {Number(pkg.price_per_session).toFixed(2)}/sesión</p>
                    </div>
                  ))
                )}
              </div>

              {/* Session history */}
              <div className="space-y-2">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wide">Historial de sesiones</h3>
                {!clientAppointments?.length ? (
                  <p className="text-sm text-muted-foreground">Sin sesiones registradas</p>
                ) : (
                  <div className="space-y-1">
                    {clientAppointments.map((appt) => {
                      const typeConfig = SESSION_TYPE_COLORS[appt.type as keyof typeof SESSION_TYPE_COLORS];
                      return (
                        <div key={appt.id} className="bg-card rounded-lg border p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${typeConfig?.bg || "bg-muted"}`} />
                            <div>
                              <p className="text-sm font-medium">{typeConfig?.label || appt.type}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(appt.start_time), "dd MMM yyyy, HH:mm", { locale: es })}
                                {(appt.professionals as any)?.name ? ` · ${(appt.professionals as any).name}` : ""}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">{apptStatusLabels[appt.status] || appt.status}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

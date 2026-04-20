import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { addDays, endOfMonth, format } from "date-fns";
import { ClientSearchOrCreate } from "@/components/clients/ClientSearchOrCreate";
import type { Database } from "@/integrations/supabase/types";

type PackageType = Database["public"]["Enums"]["package_type"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type ReceiptType = Database["public"]["Enums"]["receipt_type"];

export default function PaquetesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [catalogId, setCatalogId] = useState<string>("");
  const [form, setForm] = useState({
    client_id: "",
    name: "",
    type: "rehabilitation" as PackageType,
    is_monthly_pass: false,
    total_sessions: "10",
    total_paid: "0",
    payment_method: "cash" as PaymentMethod,
    receipt_type: "boleta" as ReceiptType,
    month_start: format(new Date(), "yyyy-MM"),
  });

  const pricePerSession = useMemo(() => {
    const paid = parseFloat(form.total_paid) || 0;
    const sessions = parseInt(form.total_sessions) || 1;
    return paid / sessions;
  }, [form.total_paid, form.total_sessions]);

  const { data: packages, isLoading } = useQuery({
    queryKey: ["packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("*, clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: catalog } = useQuery({
    queryKey: ["package_catalog_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_catalog")
        .select("*")
        .eq("is_active", true)
        .order("program")
        .order("price");
      if (error) throw error;
      return data;
    },
  });

  // Map catalog program → package_type (skip 'diagnosis' since it's not a valid package_type)
  const selectableCatalog = useMemo(
    () => catalog?.filter((c) => c.program !== "diagnosis") ?? [],
    [catalog]
  );

  const handleCatalogSelect = (id: string) => {
    setCatalogId(id);
    const item = catalog?.find((c) => c.id === id);
    if (!item) return;
    setForm((f) => ({
      ...f,
      name: item.name,
      type: item.program as PackageType,
      is_monthly_pass: item.is_monthly_pass,
      total_sessions: item.sessions ? String(item.sessions) : f.total_sessions,
      total_paid: String(item.price),
    }));
  };

  const createPackage = useMutation({
    mutationFn: async () => {
      const totalSessions = parseInt(form.total_sessions);
      const totalPaid = parseFloat(form.total_paid);
      const pps = totalPaid / totalSessions;

      let expiresAt: string | null = null;
      if (form.is_monthly_pass) {
        const monthDate = new Date(form.month_start + "-01");
        expiresAt = endOfMonth(monthDate).toISOString();
      } else {
        expiresAt = addDays(new Date(), 90).toISOString();
      }

      const { error } = await supabase.from("packages").insert({
        client_id: form.client_id,
        name: form.name,
        type: form.type,
        is_monthly_pass: form.is_monthly_pass,
        total_sessions: totalSessions,
        total_paid: totalPaid,
        price_per_session: pps,
        payment_method: form.payment_method,
        receipt_type: form.receipt_type,
        expires_at: expiresAt,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      setOpen(false);
      setCatalogId("");
      setForm({
        client_id: "", name: "", type: "rehabilitation",
        is_monthly_pass: false, total_sessions: "10", total_paid: "0",
        payment_method: "cash", receipt_type: "boleta",
        month_start: format(new Date(), "yyyy-MM"),
      });
      toast.success("Paquete creado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusLabels: Record<string, string> = { active: "Activo", expired: "Expirado", completed: "Completado" };
  const statusColors: Record<string, string> = { active: "bg-green-100 text-green-700", expired: "bg-red-100 text-red-700", completed: "bg-muted text-muted-foreground" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Paquetes</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuevo paquete</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuevo paquete</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createPackage.mutate(); }} className="space-y-4">
              <ClientSearchOrCreate
                value={form.client_id || null}
                onChange={(id) => setForm({ ...form, client_id: id ?? "" })}
                required
              />

              <div>
                <Label>Paquete del catálogo</Label>
                <Select value={catalogId} onValueChange={handleCatalogSelect}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar del catálogo (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {selectableCatalog.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — S/ {Number(c.price).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Auto-rellena nombre, precio y sesiones.</p>
              </div>

              <div><Label>Nombre del paquete *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>

              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as PackageType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rehabilitation">Rehabilitación</SelectItem>
                    <SelectItem value="prehabilitation">Prehabilitación</SelectItem>
                    <SelectItem value="recovery">Recuperación</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label>¿Es monthly pass?</Label>
                <Switch checked={form.is_monthly_pass} onCheckedChange={(v) => setForm({ ...form, is_monthly_pass: v })} />
              </div>

              {!form.is_monthly_pass ? (
                <div>
                  <Label>Número de sesiones</Label>
                  <Select value={form.total_sessions} onValueChange={(v) => setForm({ ...form, total_sessions: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 sesiones</SelectItem>
                      <SelectItem value="10">10 sesiones</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label>Mes del pase</Label>
                  <Input type="month" value={form.month_start} onChange={(e) => setForm({ ...form, month_start: e.target.value })} />
                </div>
              )}

              <div><Label>Total pagado (S/)</Label><Input type="number" step="0.01" value={form.total_paid} onChange={(e) => setForm({ ...form, total_paid: e.target.value })} /></div>

              <div className="bg-muted/30 rounded-lg p-3 text-sm">
                <span className="text-muted-foreground">Precio por sesión:</span>{" "}
                <span className="font-semibold">S/ {pricePerSession.toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Método de pago</Label>
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v as PaymentMethod })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yape">Yape</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                      <SelectItem value="cash">Efectivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Comprobante</Label>
                  <Select value={form.receipt_type} onValueChange={(v) => setForm({ ...form, receipt_type: v as ReceiptType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boleta">Boleta</SelectItem>
                      <SelectItem value="factura">Factura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.is_monthly_pass && (
                <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
                  Sesiones para monthly pass: ingresa el total de sesiones incluidas en el mes.
                  <div className="mt-2">
                    <Label className="text-xs">Sesiones incluidas</Label>
                    <Input type="number" value={form.total_sessions} onChange={(e) => setForm({ ...form, total_sessions: e.target.value })} className="mt-1" />
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={createPackage.isPending}>Guardar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !packages?.length ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">No hay paquetes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {packages.map((pkg) => {
            const progress = pkg.total_sessions > 0 ? (pkg.sessions_used / pkg.total_sessions) * 100 : 0;
            return (
              <div key={pkg.id} className="bg-card rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{pkg.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(pkg.clients as any)?.name} · {pkg.is_monthly_pass ? "Monthly pass" : `${pkg.sessions_used}/${pkg.total_sessions} sesiones`} · S/ {Number(pkg.total_paid).toFixed(2)}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[pkg.status] || ""}`}>
                    {statusLabels[pkg.status] || pkg.status}
                  </span>
                </div>
                <Progress value={progress} className="h-1.5" />
                {pkg.expires_at && (
                  <p className="text-xs text-muted-foreground">Vence: {format(new Date(pkg.expires_at), "dd/MM/yyyy")}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

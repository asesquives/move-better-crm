import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    total_paid: "0",
    payment_method: "cash" as PaymentMethod,
    receipt_type: "boleta" as ReceiptType,
    month_start: format(new Date(), "yyyy-MM"),
  });

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

  // Selectable: only real packages (>1 session or monthly pass), exclude diagnosis (not a package_type)
  const selectableCatalog = useMemo(
    () =>
      catalog?.filter(
        (c) => c.program !== "diagnosis" && (c.is_monthly_pass || (c.sessions ?? 0) > 1)
      ) ?? [],
    [catalog]
  );

  const selectedCatalog = useMemo(
    () => catalog?.find((c) => c.id === catalogId) ?? null,
    [catalog, catalogId]
  );

  const totalSessions = useMemo(() => {
    if (!selectedCatalog) return 0;
    return selectedCatalog.sessions ?? 0;
  }, [selectedCatalog]);

  const pricePerSession = useMemo(() => {
    const paid = parseFloat(form.total_paid) || 0;
    if (selectedCatalog?.is_monthly_pass) {
      return totalSessions > 0 ? paid / totalSessions : 0;
    }
    return totalSessions > 0 ? paid / totalSessions : 0;
  }, [form.total_paid, totalSessions, selectedCatalog]);

  const handleCatalogSelect = (id: string) => {
    setCatalogId(id);
    const item = catalog?.find((c) => c.id === id);
    if (!item) return;
    setForm((f) => ({
      ...f,
      total_paid: String(item.price),
    }));
  };

  const resetForm = () => {
    setCatalogId("");
    setForm({
      client_id: "",
      total_paid: "0",
      payment_method: "cash",
      receipt_type: "boleta",
      month_start: format(new Date(), "yyyy-MM"),
    });
  };

  const createPackage = useMutation({
    mutationFn: async () => {
      if (!selectedCatalog) throw new Error("Selecciona un paquete del catálogo");
      if (!form.client_id) throw new Error("Selecciona un cliente");
      const sessions = selectedCatalog.sessions ?? 0;
      if (sessions <= 0) throw new Error("El paquete no tiene sesiones definidas");

      const totalPaid = parseFloat(form.total_paid);
      const pps = totalPaid / sessions;

      let expiresAt: string | null = null;
      if (selectedCatalog.is_monthly_pass) {
        const monthDate = new Date(form.month_start + "-01");
        expiresAt = endOfMonth(monthDate).toISOString();
      } else {
        expiresAt = addDays(new Date(), 90).toISOString();
      }

      const { error } = await supabase.from("packages").insert({
        client_id: form.client_id,
        name: selectedCatalog.name,
        type: selectedCatalog.program as PackageType,
        is_monthly_pass: selectedCatalog.is_monthly_pass,
        total_sessions: sessions,
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
      resetForm();
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
                <Label>Paquete del catálogo *</Label>
                <Select value={catalogId} onValueChange={handleCatalogSelect}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar paquete" /></SelectTrigger>
                  <SelectContent>
                    {selectableCatalog.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — S/ {Number(c.price).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCatalog && (
                <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">Sesiones incluidas:</span>{" "}
                    <span className="font-semibold">
                      {selectedCatalog.is_monthly_pass
                        ? `${totalSessions} (pase mensual)`
                        : totalSessions}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Precio por sesión:</span>{" "}
                    <span className="font-semibold">S/ {pricePerSession.toFixed(2)}</span>
                  </p>
                </div>
              )}

              {selectedCatalog?.is_monthly_pass && (
                <div>
                  <Label>Mes del pase</Label>
                  <Input type="month" value={form.month_start} onChange={(e) => setForm({ ...form, month_start: e.target.value })} />
                </div>
              )}

              <div>
                <Label>Total pagado (S/)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.total_paid}
                  onChange={(e) => setForm({ ...form, total_paid: e.target.value })}
                  disabled={!selectedCatalog}
                />
                {selectedCatalog && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Sugerido: S/ {Number(selectedCatalog.price).toFixed(2)}. Edita si el cliente negoció otro precio.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Método de pago</Label>
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v as PaymentMethod })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yape">Yape</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                      <SelectItem value="card">Tarjeta</SelectItem>
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

              <Button
                type="submit"
                className="w-full"
                disabled={createPackage.isPending || !selectedCatalog || !form.client_id}
              >
                Guardar
              </Button>
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

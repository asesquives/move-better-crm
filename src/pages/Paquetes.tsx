import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type PackageType = Database["public"]["Enums"]["package_type"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type ReceiptType = Database["public"]["Enums"]["receipt_type"];

export default function PaquetesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    client_id: "", name: "", type: "rehabilitation" as PackageType,
    total_sessions: "10", price_per_session: "50", total_paid: "0",
    payment_method: "cash" as PaymentMethod, receipt_type: "boleta" as ReceiptType,
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

  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const createPackage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("packages").insert({
        client_id: form.client_id,
        name: form.name,
        type: form.type,
        total_sessions: parseInt(form.total_sessions),
        price_per_session: parseFloat(form.price_per_session),
        total_paid: parseFloat(form.total_paid),
        payment_method: form.payment_method,
        receipt_type: form.receipt_type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      setOpen(false);
      toast.success("Paquete creado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusLabels: Record<string, string> = {
    active: "Activo",
    expired: "Expirado",
    completed: "Completado",
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    expired: "bg-red-100 text-red-700",
    completed: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Paquetes</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuevo paquete</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo paquete</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createPackage.mutate(); }} className="space-y-4">
              <div>
                <Label>Cliente *</Label>
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                  <SelectContent>{clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
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
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Sesiones</Label><Input type="number" value={form.total_sessions} onChange={(e) => setForm({ ...form, total_sessions: e.target.value })} /></div>
                <div><Label>Precio/sesión</Label><Input type="number" step="0.01" value={form.price_per_session} onChange={(e) => setForm({ ...form, price_per_session: e.target.value })} /></div>
              </div>
              <div><Label>Total pagado</Label><Input type="number" step="0.01" value={form.total_paid} onChange={(e) => setForm({ ...form, total_paid: e.target.value })} /></div>
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
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-card rounded-lg border p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{pkg.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(pkg.clients as any)?.name} · {pkg.sessions_used}/{pkg.total_sessions} sesiones · S/ {Number(pkg.total_paid).toFixed(2)}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[pkg.status] || ""}`}>
                {statusLabels[pkg.status] || pkg.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type CatalogProgram = Database["public"]["Enums"]["catalog_program"];
type CatalogRow = Database["public"]["Tables"]["package_catalog"]["Row"];

const PROGRAM_LABELS: Record<CatalogProgram, string> = {
  diagnosis: "Diagnóstico",
  prehabilitation: "Prehabilitation",
  rehabilitation: "Rehabilitación",
  recovery: "Recovery",
};

const PROGRAM_ORDER: CatalogProgram[] = ["diagnosis", "prehabilitation", "rehabilitation", "recovery"];

export default function CatalogoPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    price: "0",
    sessions: "1",
    is_active: true,
  });

  const { data: catalog, isLoading } = useQuery({
    queryKey: ["package_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_catalog")
        .select("*")
        .order("program")
        .order("price");
      if (error) throw error;
      return data;
    },
  });

  const grouped = useMemo(() => {
    const map: Record<string, CatalogRow[]> = {};
    catalog?.forEach((p) => {
      if (!map[p.program]) map[p.program] = [];
      map[p.program].push(p);
    });
    return map;
  }, [catalog]);

  const openEdit = (pkg: CatalogRow) => {
    setEditing(pkg);
    setForm({
      name: pkg.name,
      price: String(pkg.price),
      sessions: pkg.sessions ? String(pkg.sessions) : "1",
      is_active: pkg.is_active,
    });
  };

  const computedPricePerSession = useMemo(() => {
    if (editing?.is_monthly_pass) return null;
    const price = parseFloat(form.price) || 0;
    const sessions = parseInt(form.sessions) || 1;
    return price / sessions;
  }, [form.price, form.sessions, editing]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const price = parseFloat(form.price);
      const sessions = editing.is_monthly_pass ? null : parseInt(form.sessions);
      const pps = editing.is_monthly_pass ? null : price / (sessions || 1);

      const { error } = await supabase
        .from("package_catalog")
        .update({
          name: form.name,
          price,
          sessions,
          price_per_session: pps,
          is_active: form.is_active,
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["package_catalog"] });
      queryClient.invalidateQueries({ queryKey: ["package_catalog_active"] });
      setEditing(null);
      toast.success("Paquete actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Catálogo</h1>
        <p className="text-sm text-muted-foreground">Administra los paquetes que ofrece el negocio.</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : (
        <div className="space-y-6">
          {PROGRAM_ORDER.map((program) => {
            const items = grouped[program] || [];
            if (!items.length) return null;
            return (
              <div key={program} className="bg-card rounded-lg border">
                <div className="px-4 py-3 border-b">
                  <h2 className="font-semibold">{PROGRAM_LABELS[program]}</h2>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Sesiones</TableHead>
                      <TableHead>Precio total</TableHead>
                      <TableHead>Precio / sesión</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((pkg) => (
                      <TableRow key={pkg.id} className={!pkg.is_active ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{pkg.name}</TableCell>
                        <TableCell>{pkg.is_monthly_pass ? "Pase mensual" : pkg.sessions}</TableCell>
                        <TableCell>S/ {Number(pkg.price).toFixed(2)}</TableCell>
                        <TableCell>{pkg.price_per_session ? `S/ ${Number(pkg.price_per_session).toFixed(2)}` : "—"}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${pkg.is_active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                            {pkg.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(pkg)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar paquete</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label>Precio total (S/)</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              </div>
              {!editing.is_monthly_pass && (
                <div>
                  <Label>Número de sesiones</Label>
                  <Input type="number" min="1" value={form.sessions} onChange={(e) => setForm({ ...form, sessions: e.target.value })} required />
                </div>
              )}
              {!editing.is_monthly_pass && (
                <div className="bg-muted/30 rounded-lg p-3 text-sm">
                  <span className="text-muted-foreground">Precio por sesión:</span>{" "}
                  <span className="font-semibold">S/ {(computedPricePerSession ?? 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label>Activo</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>Guardar</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

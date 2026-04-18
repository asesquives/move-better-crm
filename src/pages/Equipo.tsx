import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Calendar, Clock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

type Professional = Database["public"]["Tables"]["professionals"]["Row"];

type ProfessionalType = Database["public"]["Enums"]["professional_type"];

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function EquipoPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "physio" as ProfessionalType,
    // Fixed schedule fields for physios
    schedule_days: [] as string[],
    schedule_start: "08:00",
    schedule_end: "17:00",
  });

  const { data: professionals, isLoading } = useQuery({
    queryKey: ["professionals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("professionals").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const createProfessional = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("professionals").insert({
        name: form.name,
        type: form.type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professionals"] });
      setOpen(false);
      setForm({ name: "", type: "physio", schedule_days: [], schedule_start: "08:00", schedule_end: "17:00" });
      toast.success("Profesional agregado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("professionals").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professionals"] });
      toast.success("Estado actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [editing, setEditing] = useState<Professional | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    type: "physio" as ProfessionalType,
    is_active: true,
    schedule_days: [] as string[],
    schedule_start: "08:00",
    schedule_end: "17:00",
  });
  const [deleting, setDeleting] = useState<Professional | null>(null);

  const openEdit = (p: Professional) => {
    setEditing(p);
    setEditForm({
      name: p.name,
      type: p.type,
      is_active: p.is_active,
      schedule_days: [],
      schedule_start: "08:00",
      schedule_end: "17:00",
    });
  };

  const updateProfessional = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("professionals")
        .update({ name: editForm.name, type: editForm.type, is_active: editForm.is_active })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professionals"] });
      setEditing(null);
      toast.success("Profesional actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteProfessional = useMutation({
    mutationFn: async () => {
      if (!deleting) return;
      // Check for future scheduled/confirmed appointments
      const nowIso = new Date().toISOString();
      const { data: future, error: checkErr } = await supabase
        .from("appointments")
        .select("id")
        .eq("professional_id", deleting.id)
        .in("status", ["scheduled", "confirmed"])
        .gte("start_time", nowIso)
        .limit(1);
      if (checkErr) throw checkErr;
      if (future && future.length > 0) {
        throw new Error(
          `No puedes eliminar a ${deleting.name} porque tiene citas pendientes. Primero cancela o reasigna sus citas.`,
        );
      }
      const { error } = await supabase.from("professionals").delete().eq("id", deleting.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professionals"] });
      setDeleting(null);
      toast.success("Profesional eliminado");
    },
    onError: (e: any) => {
      toast.error(e.message);
      setDeleting(null);
    },
  });

  const toggleDay = (day: string) => {
    setForm((f) => ({
      ...f,
      schedule_days: f.schedule_days.includes(day)
        ? f.schedule_days.filter((d) => d !== day)
        : [...f.schedule_days, day],
    }));
  };

  const toggleEditDay = (day: string) => {
    setEditForm((f) => ({
      ...f,
      schedule_days: f.schedule_days.includes(day)
        ? f.schedule_days.filter((d) => d !== day)
        : [...f.schedule_days, day],
    }));
  };

  const typeLabels: Record<string, string> = { physio: "Fisioterapeuta", evaluator: "Evaluador" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Equipo</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Agregar profesional</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo profesional</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createProfessional.mutate(); }} className="space-y-4">
              <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ProfessionalType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physio">Fisioterapeuta</SelectItem>
                    <SelectItem value="evaluator">Evaluador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.type === "physio" && (
                <>
                  <div>
                    <Label>Días de atención</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DAYS.map((day) => (
                        <Button
                          key={day}
                          type="button"
                          variant={form.schedule_days.includes(day) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleDay(day)}
                        >
                          {day.slice(0, 3)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Hora inicio</Label><Input type="time" value={form.schedule_start} onChange={(e) => setForm({ ...form, schedule_start: e.target.value })} /></div>
                    <div><Label>Hora fin</Label><Input type="time" value={form.schedule_end} onChange={(e) => setForm({ ...form, schedule_end: e.target.value })} /></div>
                  </div>
                </>
              )}

              {form.type === "evaluator" && (
                <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
                  Los evaluadores cargan su disponibilidad semanalmente desde el módulo de Disponibilidad.
                </div>
              )}

              <Button type="submit" className="w-full" disabled={createProfessional.isPending}>Guardar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !professionals?.length ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">No hay profesionales registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {professionals.map((p) => (
            <div key={p.id} className="bg-card rounded-lg border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                    p.type === "evaluator" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    {typeLabels[p.type] || p.type}
                    {p.type === "physio" && (
                      <span className="flex items-center gap-0.5 ml-2 text-xs">
                        <Clock className="h-3 w-3" /> Horario fijo
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {p.type === "evaluator" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/disponibilidad")}
                    className="text-xs"
                  >
                    <Calendar className="h-3.5 w-3.5 mr-1" /> Disponibilidad
                  </Button>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{p.is_active ? "Activo" : "Inactivo"}</span>
                  <Switch
                    checked={p.is_active}
                    onCheckedChange={(checked) => toggleActive.mutate({ id: p.id, is_active: checked })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

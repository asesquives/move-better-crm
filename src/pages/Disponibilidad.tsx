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
import { format } from "date-fns";

export default function DisponibilidadPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [form, setForm] = useState({ professional_id: "", date: format(new Date(), "yyyy-MM-dd"), start_time: "08:00", end_time: "17:00" });

  const { data: blocks, isLoading } = useQuery({
    queryKey: ["availability", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("availability_blocks")
        .select("*, professionals(name)")
        .eq("date", selectedDate)
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: professionals } = useQuery({
    queryKey: ["professionals-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("professionals").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const createBlock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("availability_blocks").insert({
        professional_id: form.professional_id,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        is_available: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability"] });
      setOpen(false);
      toast.success("Bloque de disponibilidad creado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Disponibilidad</h1>
        <div className="flex gap-2">
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-auto" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Agregar</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo bloque de disponibilidad</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createBlock.mutate(); }} className="space-y-4">
                <div>
                  <Label>Profesional *</Label>
                  <Select value={form.professional_id} onValueChange={(v) => setForm({ ...form, professional_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{professionals?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Fecha</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Inicio</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                  <div><Label>Fin</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                </div>
                <Button type="submit" className="w-full" disabled={createBlock.isPending}>Guardar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !blocks?.length ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">No hay bloques de disponibilidad para este día</p>
        </div>
      ) : (
        <div className="space-y-2">
          {blocks.map((b) => (
            <div key={b.id} className="bg-card rounded-lg border p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{(b.professionals as any)?.name}</p>
                <p className="text-sm text-muted-foreground">{b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${b.is_available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {b.is_available ? "Disponible" : "No disponible"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

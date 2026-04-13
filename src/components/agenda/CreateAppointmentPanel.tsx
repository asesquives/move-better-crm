import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addHours } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClients, useClientPackages, useProfessionals, useAvailabilityBlocks } from "@/hooks/useAgendaData";
import { SESSION_TYPE_COLORS, PACKAGE_TYPE_MAP, AppointmentType } from "@/lib/agenda-constants";
import { toast } from "sonner";
import { AlertTriangle, Info, Search } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { isPeruHoliday, getHolidayName } from "@/lib/peru-holidays";

interface CreateAppointmentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: Date | null;
  defaultHour: number | null;
}

export function CreateAppointmentPanel({ open, onOpenChange, defaultDate, defaultHour }: CreateAppointmentPanelProps) {
  const queryClient = useQueryClient();
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [sessionType, setSessionType] = useState<AppointmentType>("rehabilitation");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [packageId, setPackageId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [doubleBookError, setDoubleBookError] = useState("");
  const [availError, setAvailError] = useState("");

  const { data: searchResults } = useClients(clientSearch);
  const { data: professionals } = useProfessionals();
  const { data: clientPackages } = useClientPackages(selectedClientId, sessionType);
  const { data: availBlocks } = useAvailabilityBlocks(professionalId, date);

  // Reset form when panel opens with defaults
  useEffect(() => {
    if (open && defaultDate) {
      setDate(format(defaultDate, "yyyy-MM-dd"));
      setStartTime(`${(defaultHour ?? 8).toString().padStart(2, "0")}:00`);
      setEndTime(`${((defaultHour ?? 8) + 1).toString().padStart(2, "0")}:00`);
      setSelectedClientId(null);
      setSelectedClientName("");
      setClientSearch("");
      setProfessionalId("");
      setSessionType("rehabilitation");
      setPackageId("");
      setNotes("");
      setDoubleBookError("");
      setAvailError("");
    }
  }, [open, defaultDate, defaultHour]);

  // Check for compatible packages
  const compatiblePackage = useMemo(() => {
    if (!clientPackages?.length || !sessionType) return null;
    return clientPackages.find(
      (pkg) => pkg.type === sessionType && pkg.sessions_used < pkg.total_sessions
    );
  }, [clientPackages, sessionType]);

  // Selected professional info
  const selectedProfessional = professionals?.find((p) => p.id === professionalId);

  // Check evaluator availability
  useEffect(() => {
    setAvailError("");
    if (!selectedProfessional || selectedProfessional.type !== "evaluator" || !date || !startTime) return;
    if (!availBlocks || availBlocks.length === 0) {
      setAvailError("Este evaluador no tiene bloques de disponibilidad para esta fecha.");
      return;
    }
    const slotStart = startTime;
    const slotEnd = endTime;
    const isWithinBlock = availBlocks.some(
      (block) => block.start_time <= slotStart && block.end_time >= slotEnd
    );
    if (!isWithinBlock) {
      setAvailError("El horario seleccionado no está dentro de la disponibilidad del evaluador.");
    }
  }, [selectedProfessional, availBlocks, date, startTime, endTime]);

  const createAppointment = useMutation({
    mutationFn: async () => {
      if (!selectedClientId || !professionalId || !date || !startTime || !endTime) {
        throw new Error("Completa todos los campos obligatorios");
      }

      // Holiday check
      if (isPeruHoliday(date)) {
        throw new Error(`No se pueden agendar citas en feriados (${getHolidayName(date)})`);
      }

      // Double booking check
      const startISO = new Date(`${date}T${startTime}:00`).toISOString();
      const endISO = new Date(`${date}T${endTime}:00`).toISOString();

      const { data: conflicts } = await supabase
        .from("appointments")
        .select("id")
        .eq("professional_id", professionalId)
        .neq("status", "cancelled")
        .lt("start_time", endISO)
        .gt("end_time", startISO);

      if (conflicts && conflicts.length > 0) {
        throw new Error("DOUBLE_BOOKING");
      }

      const { error } = await supabase.from("appointments").insert({
        client_id: selectedClientId,
        professional_id: professionalId,
        package_id: packageId || null,
        start_time: startISO,
        end_time: endISO,
        type: sessionType,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["week-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      onOpenChange(false);
      toast.success("Cita creada exitosamente");
    },
    onError: (err: any) => {
      if (err.message === "DOUBLE_BOOKING") {
        setDoubleBookError("Este profesional ya tiene una cita en ese horario.");
        toast.error("Conflicto de horario: doble agendamiento detectado");
      } else {
        toast.error(err.message);
      }
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nueva cita</SheetTitle>
          <SheetDescription>Completa los datos para agendar la cita</SheetDescription>
        </SheetHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDoubleBookError("");
            createAppointment.mutate();
          }}
          className="space-y-4 mt-6"
        >
          {/* Client search */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            {selectedClientId ? (
              <div className="flex items-center justify-between bg-card border rounded-md px-3 py-2">
                <span className="text-sm font-medium">{selectedClientName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedClientId(null);
                    setSelectedClientName("");
                    setClientSearch("");
                    setPackageId("");
                  }}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o teléfono..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {searchResults && searchResults.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto bg-popover">
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => {
                          setSelectedClientId(c.id);
                          setSelectedClientName(c.name);
                          setClientSearch("");
                        }}
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.phone && <span className="text-muted-foreground ml-2">· {c.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Professional */}
          <div className="space-y-2">
            <Label>Profesional *</Label>
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar profesional" /></SelectTrigger>
              <SelectContent>
                {professionals?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.type === "physio" ? "Fisio" : "Evaluador"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Evaluator availability warning */}
          {availError && (
            <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-md p-3 text-sm text-orange-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{availError}</span>
            </div>
          )}

          {/* Session type */}
          <div className="space-y-2">
            <Label>Tipo de sesión *</Label>
            <Select value={sessionType} onValueChange={(v) => setSessionType(v as AppointmentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SESSION_TYPE_COLORS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${val.bg}`} />
                      {val.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date & time */}
          <div className="space-y-2">
            <Label>Fecha *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Hora inicio *</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Hora fin *</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>

          {/* Double booking error */}
          {doubleBookError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{doubleBookError}</span>
            </div>
          )}

          {/* Package */}
          <div className="space-y-2">
            <Label>Paquete (opcional)</Label>
            <Select value={packageId} onValueChange={setPackageId}>
              <SelectTrigger><SelectValue placeholder="Sin paquete" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin paquete</SelectItem>
                {clientPackages?.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.name} ({pkg.sessions_used}/{pkg.total_sessions} sesiones)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Compatible package suggestion */}
          {compatiblePackage && !packageId && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p>El cliente tiene un paquete compatible: <strong>{compatiblePackage.name}</strong></p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="p-0 h-auto text-blue-700"
                  onClick={() => setPackageId(compatiblePackage.id)}
                >
                  Vincular paquete
                </Button>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones..." />
          </div>

          <Button type="submit" className="w-full" disabled={createAppointment.isPending || !!availError}>
            {createAppointment.isPending ? "Guardando..." : "Crear cita"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

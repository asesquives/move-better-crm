import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClientPackages, useProfessionals, useAvailabilityBlocks } from "@/hooks/useAgendaData";
import { SESSION_TYPE_COLORS, AppointmentType } from "@/lib/agenda-constants";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { AlertTriangle, Info } from "lucide-react";
import { ClientSearchOrCreate } from "@/components/clients/ClientSearchOrCreate";
import { isPeruHoliday, getHolidayName } from "@/lib/peru-holidays";

export interface PreselectedSlot {
  date: string;       // yyyy-MM-dd
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
}

interface CreateAppointmentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided => Flujo A (slot pre-seleccionado, no editable). Cuando es null => Flujo B. */
  preselectedSlot?: PreselectedSlot | null;
  /** Compatibilidad anterior (botón "Nueva cita"): inicializa fecha/hora pero todo editable. */
  defaultDate?: Date | null;
  defaultHour?: number | null;
}

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function CreateAppointmentPanel({
  open,
  onOpenChange,
  preselectedSlot = null,
  defaultDate,
  defaultHour,
}: CreateAppointmentPanelProps) {
  const queryClient = useQueryClient();
  const isFlowA = !!preselectedSlot;

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState("");
  const [sessionType, setSessionType] = useState<AppointmentType>("rehabilitation");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [packageId, setPackageId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [doubleBookError, setDoubleBookError] = useState("");
  const [availError, setAvailError] = useState("");

  const { data: professionals } = useProfessionals();
  const { data: clientPackages } = useClientPackages(selectedClientId, sessionType);
  const { data: availBlocks } = useAvailabilityBlocks(professionalId, date);

  // Fetch existing appointments for selected professional + date
  const { data: dayAppointments } = useQuery({
    queryKey: ["day-appointments", professionalId, date],
    queryFn: async () => {
      if (!professionalId || !date) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("start_time, end_time, status")
        .eq("professional_id", professionalId)
        .neq("status", "cancelled")
        .gte("start_time", `${date}T00:00:00`)
        .lte("start_time", `${date}T23:59:59`);
      if (error) throw error;
      return data;
    },
    enabled: !!professionalId && !!date,
  });

  // Flujo A: appointments de TODOS los profesionales en esa fecha (para filtrar dropdown)
  const { data: slotAppointments } = useQuery({
    queryKey: ["slot-appointments", preselectedSlot?.date],
    queryFn: async () => {
      if (!preselectedSlot) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("professional_id, start_time, end_time, status")
        .neq("status", "cancelled")
        .gte("start_time", `${preselectedSlot.date}T00:00:00`)
        .lte("start_time", `${preselectedSlot.date}T23:59:59`);
      if (error) throw error;
      return data;
    },
    enabled: !!preselectedSlot,
  });

  // Flujo A: availability_blocks de TODOS los evaluadores para esa fecha
  const { data: dayAvailBlocks } = useQuery({
    queryKey: ["day-avail-blocks", preselectedSlot?.date],
    queryFn: async () => {
      if (!preselectedSlot) return [];
      const { data, error } = await supabase
        .from("availability_blocks")
        .select("professional_id, start_time, end_time, is_available")
        .eq("date", preselectedSlot.date)
        .eq("is_available", true);
      if (error) throw error;
      return data;
    },
    enabled: !!preselectedSlot,
  });

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setSelectedClientId(null);
    setProfessionalId("");
    setSessionType("rehabilitation");
    setPackageId("");
    setNotes("");
    setDoubleBookError("");
    setAvailError("");

    if (preselectedSlot) {
      setDate(preselectedSlot.date);
      setStartTime(preselectedSlot.startTime);
      setEndTime(preselectedSlot.endTime);
    } else if (defaultDate) {
      setDate(format(defaultDate, "yyyy-MM-dd"));
      setStartTime("");
      setEndTime("");
    } else {
      setDate("");
      setStartTime("");
      setEndTime("");
    }
  }, [open, preselectedSlot, defaultDate, defaultHour]);

  const compatiblePackage = useMemo(() => {
    if (!clientPackages?.length || !sessionType) return null;
    return clientPackages.find(
      (pkg) => pkg.type === sessionType && pkg.sessions_used < pkg.total_sessions
    );
  }, [clientPackages, sessionType]);

  const selectedProfessional = professionals?.find((p) => p.id === professionalId);

  const physioMissingSchedule = useMemo(() => {
    if (!selectedProfessional || selectedProfessional.type !== "physio") return false;
    const sp: any = selectedProfessional;
    return !sp.schedule_start || !sp.schedule_end || !sp.schedule_days || sp.schedule_days.length === 0;
  }, [selectedProfessional]);

  // ============ FLUJO A: profesionales filtrados para el slot ============
  const availableProfessionals = useMemo(() => {
    if (!isFlowA || !preselectedSlot || !professionals) return [];
    const { date: d, startTime: st, endTime: et } = preselectedSlot;
    const dow = new Date(`${d}T12:00:00`).getDay();
    const dayName = DAY_LABELS[dow];
    const stSec = `${st}:00`;
    const etSec = `${et}:00`;

    return professionals.filter((p: any) => {
      // Disponibilidad por tipo
      if (p.type === "physio") {
        const hasSchedule = p.schedule_start && p.schedule_end && p.schedule_days?.length > 0;
        if (!hasSchedule) return false; // sin horario configurado => no aparece
        if (!p.schedule_days.includes(dayName)) return false;
        if (!(p.schedule_start <= stSec && p.schedule_end >= etSec)) return false;
      } else {
        // evaluator: necesita un availability_block que cubra el slot
        const blocks = (dayAvailBlocks || []).filter((b) => b.professional_id === p.id);
        const covered = blocks.some((b) => b.start_time <= stSec && b.end_time >= etSec);
        if (!covered) return false;
      }
      // No tener cita encima del slot
      const hasOverlap = (slotAppointments || [])
        .filter((a) => a.professional_id === p.id)
        .some((a) => {
          const aS = format(new Date(a.start_time), "HH:mm");
          const aE = format(new Date(a.end_time), "HH:mm");
          return aS < et && aE > st;
        });
      return !hasOverlap;
    });
  }, [isFlowA, preselectedSlot, professionals, dayAvailBlocks, slotAppointments]);

  // ============ FLUJO B: grilla de horarios para profesional+fecha ============
  const slots = useMemo(() => {
    if (isFlowA) return [];
    if (!selectedProfessional || !date) return [];
    const allHours = Array.from({ length: 14 }, (_, i) => i + 7);

    let windowHours: number[] = [];
    if (selectedProfessional.type === "physio") {
      const sp: any = selectedProfessional;
      const hasSchedule = sp.schedule_start && sp.schedule_end && sp.schedule_days?.length > 0;
      if (!hasSchedule) {
        windowHours = allHours;
      } else {
        const dow = new Date(`${date}T12:00:00`).getDay();
        const dayName = DAY_LABELS[dow];
        if (!sp.schedule_days.includes(dayName)) return [];
        const startH = parseInt(sp.schedule_start.slice(0, 2), 10);
        const endH = parseInt(sp.schedule_end.slice(0, 2), 10);
        windowHours = allHours.filter((h) => h >= startH && h < endH);
      }
    } else {
      if (!availBlocks || availBlocks.length === 0) return [];
      windowHours = allHours.filter((h) => {
        const slotStart = `${h.toString().padStart(2, "0")}:00:00`;
        const slotEnd = `${(h + 1).toString().padStart(2, "0")}:00:00`;
        return availBlocks.some((b) => b.start_time <= slotStart && b.end_time >= slotEnd);
      });
    }

    const booked = (dayAppointments || []).map((a) => ({
      start: format(new Date(a.start_time), "HH:mm"),
      end: format(new Date(a.end_time), "HH:mm"),
    }));

    return windowHours.map((h) => {
      const start = `${h.toString().padStart(2, "0")}:00`;
      const end = `${(h + 1).toString().padStart(2, "0")}:00`;
      const occupied = booked.some((b) => b.start < end && b.end > start);
      return { hour: h, start, end, occupied };
    });
  }, [isFlowA, selectedProfessional, date, availBlocks, dayAppointments]);

  // Reset selected slot al cambiar profesional/fecha (solo Flujo B)
  useEffect(() => {
    if (isFlowA) return;
    setStartTime("");
    setEndTime("");
  }, [professionalId, date, isFlowA]);

  // Mensaje de evaluador sin bloques (Flujo B)
  useEffect(() => {
    setAvailError("");
    if (isFlowA) return;
    if (!selectedProfessional || selectedProfessional.type !== "evaluator" || !date) return;
    if (!availBlocks || availBlocks.length === 0) {
      setAvailError("Este evaluador no tiene disponibilidad para esta fecha");
    }
  }, [isFlowA, selectedProfessional, availBlocks, date]);

  const createAppointment = useMutation({
    mutationFn: async () => {
      if (!selectedClientId || !professionalId || !date || !startTime || !endTime) {
        throw new Error("Completa todos los campos obligatorios");
      }
      if (isPeruHoliday(date)) {
        throw new Error(`No se pueden agendar citas en feriados (${getHolidayName(date)})`);
      }
      const startISO = new Date(`${date}T${startTime}:00`).toISOString();
      const endISO = new Date(`${date}T${endTime}:00`).toISOString();

      const { data: conflicts } = await supabase
        .from("appointments")
        .select("id")
        .eq("professional_id", professionalId)
        .neq("status", "cancelled")
        .lt("start_time", endISO)
        .gt("end_time", startISO);

      if (conflicts && conflicts.length > 0) throw new Error("DOUBLE_BOOKING");

      const { error } = await supabase.from("appointments").insert({
        client_id: selectedClientId,
        professional_id: professionalId,
        package_id: packageId && packageId !== "none" ? packageId : null,
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
      queryClient.invalidateQueries({ queryKey: ["clients"] });
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

  const formattedSlotLabel = preselectedSlot
    ? `${format(new Date(`${preselectedSlot.date}T12:00:00`), "EEEE d 'de' MMMM yyyy")} · ${preselectedSlot.startTime} – ${preselectedSlot.endTime}`
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nueva cita</SheetTitle>
          <SheetDescription>
            {isFlowA ? "Horario pre-seleccionado desde el calendario" : "Completa los datos para agendar la cita"}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDoubleBookError("");
            createAppointment.mutate();
          }}
          className="space-y-4 mt-6"
        >
          {/* Flujo A: slot fijo (texto) */}
          {isFlowA && (
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs uppercase text-muted-foreground tracking-wide">Fecha y hora</p>
              <p className="text-sm font-medium capitalize mt-1">{formattedSlotLabel}</p>
            </div>
          )}

          {/* Cliente */}
          <ClientSearchOrCreate
            value={selectedClientId}
            onChange={(id) => {
              setSelectedClientId(id);
              setPackageId("");
            }}
            required
          />

          {/* Profesional */}
          <div className="space-y-2">
            <Label>Profesional *</Label>
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isFlowA && availableProfessionals.length === 0
                      ? "Sin profesionales disponibles"
                      : "Seleccionar profesional"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(isFlowA ? availableProfessionals : professionals)?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.type === "physio" ? "Fisio" : "Evaluador"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isFlowA && availableProfessionals.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Ningún profesional tiene disponibilidad libre en este horario.
              </p>
            )}
          </div>

          {/* Tipo de sesión */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Tipo de sesión *
              {packageId && packageId !== "none" && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground font-normal">
                  <Lock className="h-3 w-3" />
                  Definido por el paquete
                </span>
              )}
            </Label>
            <Select
              value={sessionType}
              onValueChange={(v) => setSessionType(v as AppointmentType)}
              disabled={!!packageId && packageId !== "none"}
            >
              <SelectTrigger
                className={cn(
                  packageId && packageId !== "none" && "bg-muted cursor-not-allowed opacity-80"
                )}
              >
                <SelectValue />
              </SelectTrigger>
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

          {/* Flujo B: Fecha + grilla */}
          {!isFlowA && (
            <>
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>

              {availError && (
                <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-md p-3 text-sm text-orange-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{availError}</span>
                </div>
              )}

              {professionalId && date && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Horario disponible *
                    {physioMissingSchedule && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 font-normal">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Sin horario configurado (mostrando 7:00–20:00)
                      </span>
                    )}
                  </Label>
                  {slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {selectedProfessional?.type === "evaluator"
                        ? "Este evaluador no tiene disponibilidad para esta fecha"
                        : "El fisioterapeuta no atiende este día."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {slots.map((s) => {
                        const isSelected = startTime === s.start;
                        return (
                          <button
                            key={s.start}
                            type="button"
                            disabled={s.occupied}
                            onClick={() => {
                              setStartTime(s.start);
                              setEndTime(s.end);
                            }}
                            className={cn(
                              "h-10 rounded-md text-sm font-medium border transition-colors",
                              s.occupied &&
                                "bg-muted text-muted-foreground border-border cursor-not-allowed",
                              !s.occupied && !isSelected &&
                                "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/25",
                              isSelected &&
                                "bg-[#CC2222] text-white border-[#CC2222] hover:bg-[#CC2222]"
                            )}
                          >
                            {s.start}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {doubleBookError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{doubleBookError}</span>
            </div>
          )}

          {/* Paquete */}
          <div className="space-y-2">
            <Label>Paquete (opcional)</Label>
            <Select
              value={packageId}
              onValueChange={(v) => {
                setPackageId(v);
                if (v && v !== "none") {
                  const pkg = clientPackages?.find((p) => p.id === v);
                  if (pkg) {
                    const pkgType = pkg.type as AppointmentType;
                    if (sessionType !== pkgType) {
                      setSessionType(pkgType);
                      const label = SESSION_TYPE_COLORS[pkgType]?.label ?? pkgType;
                      toast.info(`Tipo actualizado según el paquete seleccionado: ${label}`);
                    }
                  }
                }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Sin paquete" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin paquete</SelectItem>
                {clientPackages?.map((pkg) => {
                  const typeLabel = SESSION_TYPE_COLORS[pkg.type as AppointmentType]?.label ?? pkg.type;
                  const remaining = pkg.total_sessions - pkg.sessions_used;
                  return (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      {pkg.name} ({typeLabel}) — {remaining}/{pkg.total_sessions} restantes
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

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

          {/* Notas */}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones..." />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={createAppointment.isPending || !!availError || !startTime || !professionalId || !selectedClientId}
          >
            {createAppointment.isPending ? "Guardando..." : "Crear cita"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

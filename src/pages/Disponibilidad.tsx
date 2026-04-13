import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { startOfWeek, addDays, subDays, format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { isPeruHoliday, getHolidayName } from "@/lib/peru-holidays";

const HALF_HOURS = Array.from({ length: 30 }, (_, i) => {
  const hour = Math.floor(i / 2) + 7;
  const min = i % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${min}`;
}); // 07:00 to 21:30

function timeToLabel(t: string) {
  return t.slice(0, 5);
}

function nextHalfHour(t: string) {
  const idx = HALF_HOURS.indexOf(t);
  if (idx < 0 || idx >= HALF_HOURS.length - 1) return "22:00";
  return HALF_HOURS[idx + 1];
}

export default function DisponibilidadPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvaluatorId, setSelectedEvaluatorId] = useState<string>("");
  const [dragStart, setDragStart] = useState<{ day: number; slot: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ day: number; slot: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Fetch evaluators
  const { data: evaluators } = useQuery({
    queryKey: ["evaluators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("type", "evaluator")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Auto-select first evaluator
  useMemo(() => {
    if (evaluators?.length && !selectedEvaluatorId) {
      setSelectedEvaluatorId(evaluators[0].id);
    }
  }, [evaluators, selectedEvaluatorId]);

  // Fetch availability blocks for the week
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 5), "yyyy-MM-dd");

  const { data: blocks } = useQuery({
    queryKey: ["availability-week", selectedEvaluatorId, weekStartStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("availability_blocks")
        .select("*")
        .eq("professional_id", selectedEvaluatorId)
        .gte("date", weekStartStr)
        .lte("date", weekEndStr)
        .eq("is_available", true)
        .order("start_time");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEvaluatorId,
  });

  // Fetch appointments for the evaluator this week (to show occupied slots)
  const { data: appointments } = useQuery({
    queryKey: ["evaluator-appointments", selectedEvaluatorId, weekStartStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, start_time, end_time, status")
        .eq("professional_id", selectedEvaluatorId)
        .neq("status", "cancelled")
        .gte("start_time", weekStartStr + "T00:00:00")
        .lte("start_time", weekEndStr + "T23:59:59");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEvaluatorId,
  });

  // Build a set of available slots and occupied slots
  const { availableSet, occupiedSet } = useMemo(() => {
    const avail = new Set<string>();
    const occupied = new Set<string>();

    blocks?.forEach((b) => {
      HALF_HOURS.forEach((slot) => {
        if (slot >= b.start_time.slice(0, 5) && slot < b.end_time.slice(0, 5)) {
          avail.add(`${b.date}_${slot}`);
        }
      });
    });

    appointments?.forEach((a) => {
      const aDate = format(new Date(a.start_time), "yyyy-MM-dd");
      const aStart = format(new Date(a.start_time), "HH:mm");
      const aEnd = format(new Date(a.end_time), "HH:mm");
      HALF_HOURS.forEach((slot) => {
        if (slot >= aStart && slot < aEnd) {
          occupied.add(`${aDate}_${slot}`);
        }
      });
    });

    return { availableSet: avail, occupiedSet: occupied };
  }, [blocks, appointments]);

  // Add availability block mutation
  const addBlock = useMutation({
    mutationFn: async (params: { date: string; start_time: string; end_time: string }) => {
      const { error } = await supabase.from("availability_blocks").insert({
        professional_id: selectedEvaluatorId,
        date: params.date,
        start_time: params.start_time,
        end_time: params.end_time,
        is_available: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability-week"] });
      toast.success("Disponibilidad actualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Remove block mutation (toggle off)
  const removeBlock = useMutation({
    mutationFn: async (params: { date: string; start_time: string; end_time: string }) => {
      // Delete overlapping blocks for this slot
      const { error } = await supabase
        .from("availability_blocks")
        .delete()
        .eq("professional_id", selectedEvaluatorId)
        .eq("date", params.date)
        .lte("start_time", params.start_time)
        .gte("end_time", params.end_time);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability-week"] });
    },
  });

  const handleCellClick = (dayIndex: number, slotIndex: number) => {
    const day = weekDays[dayIndex];
    const dateStr = format(day, "yyyy-MM-dd");

    if (isPeruHoliday(dateStr)) {
      toast.error(`${getHolidayName(dateStr)} — Feriado`);
      return;
    }

    const slotTime = HALF_HOURS[slotIndex];
    const key = `${dateStr}_${slotTime}`;
    const endSlot = nextHalfHour(slotTime);

    if (availableSet.has(key)) {
      // Toggle off — just remove this 30-min block
      // For simplicity, add a new block that covers only this slot then delete it
      removeBlock.mutate({ date: dateStr, start_time: slotTime, end_time: endSlot });
    } else {
      addBlock.mutate({ date: dateStr, start_time: slotTime, end_time: endSlot });
    }
  };

  const handleMouseDown = (dayIndex: number, slotIndex: number) => {
    setDragStart({ day: dayIndex, slot: slotIndex });
    setDragEnd({ day: dayIndex, slot: slotIndex });
    setIsDragging(true);
  };

  const handleMouseEnter = (dayIndex: number, slotIndex: number) => {
    if (isDragging && dragStart && dayIndex === dragStart.day) {
      setDragEnd({ day: dayIndex, slot: slotIndex });
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart && dragEnd && dragStart.day === dragEnd.day) {
      const dayIndex = dragStart.day;
      const day = weekDays[dayIndex];
      const dateStr = format(day, "yyyy-MM-dd");

      if (isPeruHoliday(dateStr)) {
        toast.error(`${getHolidayName(dateStr)} — Feriado`);
        setIsDragging(false);
        setDragStart(null);
        setDragEnd(null);
        return;
      }

      const minSlot = Math.min(dragStart.slot, dragEnd.slot);
      const maxSlot = Math.max(dragStart.slot, dragEnd.slot);
      const startTime = HALF_HOURS[minSlot];
      const endTime = maxSlot + 1 < HALF_HOURS.length ? HALF_HOURS[maxSlot + 1] : "22:00";

      // Only add if range > 1 slot (drag), for single click use handleCellClick
      if (minSlot !== maxSlot) {
        addBlock.mutate({ date: dateStr, start_time: startTime, end_time: endTime });
      }
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  const isDragSelected = (dayIndex: number, slotIndex: number) => {
    if (!isDragging || !dragStart || !dragEnd || dragStart.day !== dayIndex) return false;
    const min = Math.min(dragStart.slot, dragEnd.slot);
    const max = Math.max(dragStart.slot, dragEnd.slot);
    return slotIndex >= min && slotIndex <= max;
  };

  const goToPrevWeek = () => setCurrentDate((d) => subDays(d, 7));
  const goToNextWeek = () => setCurrentDate((d) => addDays(d, 7));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <div className="space-y-4" onMouseUp={handleMouseUp}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Disponibilidad</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {format(weekDays[0], "d MMM", { locale: es })} – {format(weekDays[5], "d MMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedEvaluatorId} onValueChange={setSelectedEvaluatorId}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Evaluador" /></SelectTrigger>
            <SelectContent>
              {evaluators?.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={goToPrevWeek}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={goToToday}>Hoy</Button>
          <Button variant="outline" size="sm" onClick={goToNextWeek}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Disponible</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300" /> Ocupado</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Feriado</span>
      </div>

      {!selectedEvaluatorId ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">Selecciona un evaluador para ver su disponibilidad</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-auto">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(6,1fr)] border-b sticky top-0 bg-card z-10">
              <div className="p-2" />
              {weekDays.map((day, i) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const holiday = isPeruHoliday(dateStr);
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={i}
                    className={`p-2 text-center text-xs font-medium border-l ${
                      holiday ? "bg-red-50 text-red-600" : isToday ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="capitalize">{format(day, "EEE", { locale: es })}</div>
                    <div className={`text-lg font-semibold ${isToday ? "text-primary" : ""}`}>{format(day, "d")}</div>
                    {holiday && <div className="text-[10px] text-red-500 mt-0.5">{getHolidayName(dateStr)}</div>}
                  </div>
                );
              })}
            </div>

            {/* Time slots */}
            {HALF_HOURS.map((slot, slotIdx) => (
              <div key={slot} className="grid grid-cols-[60px_repeat(6,1fr)] border-b last:border-b-0">
                <div className="p-1 text-[10px] text-muted-foreground text-right pr-2 flex items-center justify-end">
                  {slot.endsWith(":00") ? timeToLabel(slot) : ""}
                </div>
                {weekDays.map((day, dayIdx) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const key = `${dateStr}_${slot}`;
                  const holiday = isPeruHoliday(dateStr);
                  const available = availableSet.has(key);
                  const occupied = occupiedSet.has(key);
                  const dragging = isDragSelected(dayIdx, slotIdx);

                  let cellClass = "border-l h-6 cursor-pointer transition-colors ";
                  if (holiday) {
                    cellClass += "bg-red-50 cursor-not-allowed";
                  } else if (occupied) {
                    cellClass += "bg-blue-100";
                  } else if (available) {
                    cellClass += "bg-emerald-100 hover:bg-emerald-200";
                  } else if (dragging) {
                    cellClass += "bg-emerald-200";
                  } else {
                    cellClass += "hover:bg-muted/50";
                  }

                  return (
                    <div
                      key={dayIdx}
                      className={cellClass}
                      onClick={() => !holiday && !occupied && handleCellClick(dayIdx, slotIdx)}
                      onMouseDown={() => !holiday && !occupied && handleMouseDown(dayIdx, slotIdx)}
                      onMouseEnter={() => handleMouseEnter(dayIdx, slotIdx)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from "react";
import { startOfWeek, addDays, subDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useWeekAppointments } from "@/hooks/useAgendaData";
import { WeeklyCalendarGrid } from "@/components/agenda/WeeklyCalendarGrid";
import { CreateAppointmentPanel } from "@/components/agenda/CreateAppointmentPanel";
import { AppointmentDetailPanel } from "@/components/agenda/AppointmentDetailPanel";

export default function AgendaPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [preselectedSlot, setPreselectedSlot] = useState<{ date: string; startTime: string; endTime: string } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  // Week starts on Monday
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)), [weekStart]); // Mon-Sat

  const { data: appointments, isLoading } = useWeekAppointments(weekStart);

  const handleSlotClick = (date: Date, hour: number) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const startTime = `${hour.toString().padStart(2, "0")}:00`;
    const endTime = `${(hour + 1).toString().padStart(2, "0")}:00`;
    setPreselectedSlot({ date: dateStr, startTime, endTime });
    setCreateOpen(true);
  };

  const handleAppointmentClick = (appointment: any) => {
    setSelectedAppointment(appointment);
    setDetailOpen(true);
  };

  const goToPrevWeek = () => setCurrentDate((d) => subDays(d, 7));
  const goToNextWeek = () => setCurrentDate((d) => addDays(d, 7));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {format(weekDays[0], "d MMM", { locale: es })} – {format(weekDays[5], "d MMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hoy
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => {
            setPreselectedSlot(null);
            setCreateOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-1" /> Nueva cita
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Diag. médico</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-400" />Diag. fisio</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Rehabilitación</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" />Prehabilitación</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" />Recuperación</span>
      </div>

      {/* Calendar */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando...</div>
      ) : (
        <WeeklyCalendarGrid
          weekDays={weekDays}
          appointments={appointments || []}
          onSlotClick={handleSlotClick}
          onAppointmentClick={handleAppointmentClick}
        />
      )}

      {/* Panels */}
      <CreateAppointmentPanel
        open={createOpen}
        onOpenChange={setCreateOpen}
        preselectedSlot={preselectedSlot}
      />
      <AppointmentDetailPanel
        open={detailOpen}
        onOpenChange={setDetailOpen}
        appointment={selectedAppointment}
      />
    </div>
  );
}

import { format, isSameDay } from "date-fns";
import { SESSION_TYPE_COLORS, STATUS_LABELS, STATUS_COLORS, HOURS, AppointmentType, AppointmentStatus } from "@/lib/agenda-constants";
import { isPeruHoliday, getHolidayName } from "@/lib/peru-holidays";

interface CalendarAppointment {
  id: string;
  start_time: string;
  end_time: string;
  type: AppointmentType;
  status: AppointmentStatus;
  clients: { name: string } | null;
  professionals: { name: string; type: string } | null;
}

interface WeeklyCalendarGridProps {
  weekDays: Date[];
  appointments: CalendarAppointment[];
  onSlotClick: (date: Date, hour: number) => void;
  onAppointmentClick: (appointment: CalendarAppointment) => void;
}

export function WeeklyCalendarGrid({ weekDays, appointments, onSlotClick, onAppointmentClick }: WeeklyCalendarGridProps) {
  const getAppointmentsForSlot = (day: Date, hour: number) => {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.start_time);
      return (
        format(aptDate, "yyyy-MM-dd") === format(day, "yyyy-MM-dd") &&
        aptDate.getHours() === hour
      );
    });
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-popover">
      {/* Header */}
      <div className="grid grid-cols-[60px_repeat(6,1fr)] border-b">
        <div className="p-2 text-xs text-muted-foreground border-r" />
        {weekDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const holiday = isPeruHoliday(dateStr);
          const isToday = isSameDay(day, new Date());
          return (
            <div key={day.toISOString()} className={`p-2 text-center border-r last:border-r-0 ${holiday ? "bg-red-50" : ""}`}>
              <p className={`text-xs uppercase ${holiday ? "text-red-500" : "text-muted-foreground"}`}>
                {format(day, "EEE", { locale: undefined })}
              </p>
              <p className={`text-sm font-semibold ${isToday ? "text-primary" : holiday ? "text-red-500" : ""}`}>
                {format(day, "d")}
              </p>
              {holiday && <p className="text-[9px] text-red-400 mt-0.5">{getHolidayName(dateStr)}</p>}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
        {HOURS.map((hour) => (
          <div key={hour} className="grid grid-cols-[60px_repeat(6,1fr)] border-b last:border-b-0 min-h-[64px]">
            <div className="p-1 text-xs text-muted-foreground border-r text-right pr-2 pt-1">
              {`${hour.toString().padStart(2, "0")}:00`}
            </div>
            {weekDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const holiday = isPeruHoliday(dateStr);
              const slotAppts = getAppointmentsForSlot(day, hour);
              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className={`border-r last:border-r-0 p-0.5 transition-colors relative ${
                    holiday
                      ? "bg-red-50/50 cursor-not-allowed"
                      : "cursor-pointer hover:bg-muted/50"
                  }`}
                  onClick={(e) => {
                    if (holiday) return;
                    if ((e.target as HTMLElement).closest("[data-appointment]")) return;
                    onSlotClick(day, hour);
                  }}
                >
                  {slotAppts.map((apt) => {
                    const typeConfig = SESSION_TYPE_COLORS[apt.type];
                    return (
                      <div
                        key={apt.id}
                        data-appointment
                        onClick={(e) => {
                          e.stopPropagation();
                          onAppointmentClick(apt);
                        }}
                        className="rounded px-1.5 py-1 text-[10px] leading-tight cursor-pointer mb-0.5 border-l-[3px] bg-popover shadow-sm hover:shadow-md transition-shadow"
                        style={{ borderLeftColor: getTypeColor(apt.type) }}
                      >
                        <p className="font-semibold truncate">{(apt.clients as any)?.name || "—"}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getTypeColor(apt.type) }}
                          />
                          <span className="truncate">{typeConfig.label}</span>
                        </div>
                        <p className="text-muted-foreground truncate">{(apt.professionals as any)?.name || "—"}</p>
                        <span className={`inline-block mt-0.5 px-1 py-px rounded text-[9px] font-medium ${STATUS_COLORS[apt.status]}`}>
                          {STATUS_LABELS[apt.status]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function getTypeColor(type: AppointmentType): string {
  const map: Record<AppointmentType, string> = {
    medical_diagnosis: "#3b82f6",
    physio_diagnosis: "#38bdf8",
    rehabilitation: "#10b981",
    prehabilitation: "#f59e0b",
    recovery: "#9ca3af",
  };
  return map[type];
}

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
  subMonths,
  subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";

export type PeriodMode = "month" | "week";

export interface DashboardPeriod {
  mode: PeriodMode;
  date: Date;
}

export interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
  /** granularity used by trend charts when this period is active */
  granularity: "week" | "month";
}

export function getPeriodRange(period: DashboardPeriod): PeriodRange {
  const { mode, date } = period;
  if (mode === "week") {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = endOfWeek(date, { weekStartsOn: 1 });
    return {
      start,
      end,
      label: `Semana del ${format(start, "d MMM", { locale: es })} - ${format(end, "d MMM yyyy", { locale: es })}`,
      granularity: "week",
    };
  }
  // month mode bound to a calendar month
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return {
    start,
    end,
    label: format(start, "MMMM yyyy", { locale: es }),
    granularity: "month",
  };
}

/** Last 12 months, current first. */
export function buildMonthOptions() {
  return Array.from({ length: 12 }).map((_, i) => {
    const d = startOfMonth(subMonths(new Date(), i));
    return {
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM yyyy", { locale: es }),
      date: d,
    };
  });
}

/** Last 12 weeks (ISO, Mon start), current first. */
export function buildWeekOptions() {
  return Array.from({ length: 12 }).map((_, i) => {
    const d = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
    const end = endOfWeek(d, { weekStartsOn: 1 });
    return {
      value: format(d, "yyyy-'W'II"),
      label: `${format(d, "d MMM", { locale: es })} - ${format(end, "d MMM", { locale: es })}`,
      date: d,
    };
  });
}

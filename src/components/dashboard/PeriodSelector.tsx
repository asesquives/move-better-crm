import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DashboardPeriod,
  PeriodMode,
  buildMonthOptions,
  buildWeekOptions,
} from "@/lib/dashboard-period";
import { format, startOfMonth, startOfWeek } from "date-fns";
import { useMemo } from "react";

interface Props {
  value: DashboardPeriod;
  onChange: (p: DashboardPeriod) => void;
}

export default function PeriodSelector({ value, onChange }: Props) {
  const monthOptions = useMemo(buildMonthOptions, []);
  const weekOptions = useMemo(buildWeekOptions, []);

  const monthValue = format(startOfMonth(value.date), "yyyy-MM");
  const weekValue = format(
    startOfWeek(value.date, { weekStartsOn: 1 }),
    "yyyy-'W'II"
  );

  const handleMode = (mode: PeriodMode) => {
    if (mode === "month") {
      onChange({ mode: "month", date: startOfMonth(new Date()) });
    } else {
      onChange({
        mode: "week",
        date: startOfWeek(new Date(), { weekStartsOn: 1 }),
      });
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Tabs value={value.mode} onValueChange={(v) => handleMode(v as PeriodMode)}>
        <TabsList className="h-9">
          <TabsTrigger value="month" className="text-xs">Mes</TabsTrigger>
          <TabsTrigger value="week" className="text-xs">Semana</TabsTrigger>
        </TabsList>
      </Tabs>

      {value.mode === "month" && (
        <Select
          value={monthValue}
          onValueChange={(v) => {
            const opt = monthOptions.find((m) => m.value === v);
            if (opt) onChange({ mode: "month", date: opt.date });
          }}
        >
          <SelectTrigger className="w-[200px] h-9 capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value} className="capitalize">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {value.mode === "week" && (
        <Select
          value={weekValue}
          onValueChange={(v) => {
            const opt = weekOptions.find((w) => w.value === v);
            if (opt) onChange({ mode: "week", date: opt.date });
          }}
        >
          <SelectTrigger className="w-[220px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {weekOptions.map((w) => (
              <SelectItem key={w.value} value={w.value}>
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

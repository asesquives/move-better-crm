// Peru official holidays 2025-2026
const PERU_HOLIDAYS: string[] = [
  // 2025
  "2025-01-01", // Año Nuevo
  "2025-04-17", // Jueves Santo
  "2025-04-18", // Viernes Santo
  "2025-05-01", // Día del Trabajo
  "2025-06-07", // Batalla de Arica
  "2025-06-29", // San Pedro y San Pablo
  "2025-07-23", // Día de la Fuerza Aérea
  "2025-07-28", // Fiestas Patrias
  "2025-07-29", // Fiestas Patrias
  "2025-08-06", // Batalla de Junín
  "2025-08-30", // Santa Rosa de Lima
  "2025-10-08", // Combate de Angamos
  "2025-11-01", // Día de Todos los Santos
  "2025-12-08", // Inmaculada Concepción
  "2025-12-09", // Batalla de Ayacucho
  "2025-12-25", // Navidad
  // 2026
  "2026-01-01",
  "2026-04-02", // Jueves Santo
  "2026-04-03", // Viernes Santo
  "2026-05-01",
  "2026-06-07",
  "2026-06-29",
  "2026-07-23",
  "2026-07-28",
  "2026-07-29",
  "2026-08-06",
  "2026-08-30",
  "2026-10-08",
  "2026-11-01",
  "2026-12-08",
  "2026-12-09",
  "2026-12-25",
];

const holidaySet = new Set(PERU_HOLIDAYS);

export function isPeruHoliday(dateStr: string): boolean {
  // Accept yyyy-MM-dd format
  return holidaySet.has(dateStr);
}

export function getHolidayName(dateStr: string): string | null {
  const names: Record<string, string> = {
    "01-01": "Año Nuevo",
    "05-01": "Día del Trabajo",
    "06-07": "Batalla de Arica",
    "06-29": "San Pedro y San Pablo",
    "07-23": "Día de la Fuerza Aérea",
    "07-28": "Fiestas Patrias",
    "07-29": "Fiestas Patrias",
    "08-06": "Batalla de Junín",
    "08-30": "Santa Rosa de Lima",
    "10-08": "Combate de Angamos",
    "11-01": "Todos los Santos",
    "12-08": "Inmaculada Concepción",
    "12-09": "Batalla de Ayacucho",
    "12-25": "Navidad",
  };
  const mmdd = dateStr.slice(5);
  if (names[mmdd]) return names[mmdd];
  // Easter-based holidays check
  if (holidaySet.has(dateStr)) {
    if (mmdd.startsWith("03") || mmdd.startsWith("04")) return "Semana Santa";
  }
  return null;
}

export { PERU_HOLIDAYS };

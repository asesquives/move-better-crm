import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format } from "date-fns";

export function useWeekAppointments(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);
  const start = format(weekStart, "yyyy-MM-dd") + "T00:00:00";
  const end = format(weekEnd, "yyyy-MM-dd") + "T23:59:59";

  return useQuery({
    queryKey: ["week-appointments", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, clients(name, phone), professionals(name, type)")
        .gte("start_time", start)
        .lte("start_time", end)
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });
}

export function useProfessionals() {
  return useQuery({
    queryKey: ["professionals-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useClients(search: string) {
  return useQuery({
    queryKey: ["clients-search", search],
    queryFn: async () => {
      let query = supabase.from("clients").select("*").order("name").limit(20);
      if (search.length >= 2) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: search.length >= 2,
  });
}

export function useClientPackages(clientId: string | null, sessionType: string | null) {
  return useQuery({
    queryKey: ["client-packages", clientId, sessionType],
    queryFn: async () => {
      if (!clientId) return [];
      const query = supabase
        .from("packages")
        .select("*")
        .eq("client_id", clientId)
        .eq("status", "active");
      const { data, error } = await query;
      if (error) throw error;
      // Exclude single-session packages from the appointment selector — those are loose sessions, not packages
      return (data || []).filter((p) => p.is_monthly_pass || p.total_sessions > 1);
    },
    enabled: !!clientId,
  });
}

export function useAvailabilityBlocks(professionalId: string | null, date: string | null) {
  return useQuery({
    queryKey: ["availability-blocks", professionalId, date],
    queryFn: async () => {
      if (!professionalId || !date) return [];
      const { data, error } = await supabase
        .from("availability_blocks")
        .select("*")
        .eq("professional_id", professionalId)
        .eq("date", date)
        .eq("is_available", true);
      if (error) throw error;
      return data;
    },
    enabled: !!professionalId && !!date,
  });
}

/**
 * Real available slots for an evaluator on a given date.
 * Returns availability_blocks minus already-booked appointments.
 */
export function useRealAvailableSlots(professionalId: string | null, date: string | null) {
  const { data: blocks } = useAvailabilityBlocks(professionalId, date);

  return useQuery({
    queryKey: ["real-available-slots", professionalId, date],
    queryFn: async () => {
      if (!professionalId || !date || !blocks) return [];

      // Fetch existing appointments for this professional on this date
      const { data: appointments, error } = await supabase
        .from("appointments")
        .select("start_time, end_time")
        .eq("professional_id", professionalId)
        .neq("status", "cancelled")
        .gte("start_time", date + "T00:00:00")
        .lte("start_time", date + "T23:59:59");
      if (error) throw error;

      // Subtract booked times from blocks
      const bookedRanges = (appointments || []).map((a) => ({
        start: format(new Date(a.start_time), "HH:mm"),
        end: format(new Date(a.end_time), "HH:mm"),
      }));

      // Return blocks with real availability info
      return blocks.map((block) => {
        const isOccupied = bookedRanges.some(
          (b) => b.start < block.end_time.slice(0, 5) && b.end > block.start_time.slice(0, 5)
        );
        return { ...block, isOccupied };
      });
    },
    enabled: !!professionalId && !!date && !!blocks && blocks.length > 0,
  });
}

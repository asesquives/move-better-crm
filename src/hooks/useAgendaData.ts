import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, addDays, format } from "date-fns";

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
      let query = supabase
        .from("packages")
        .select("*")
        .eq("client_id", clientId)
        .eq("status", "active");
      const { data, error } = await query;
      if (error) throw error;
      return data;
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

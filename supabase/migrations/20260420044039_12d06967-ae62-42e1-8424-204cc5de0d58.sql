ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS schedule_days text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS schedule_start time without time zone,
  ADD COLUMN IF NOT EXISTS schedule_end time without time zone;
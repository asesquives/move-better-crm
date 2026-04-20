-- Enum for catalog programs (includes 'diagnosis' which is not in package_type)
CREATE TYPE public.catalog_program AS ENUM ('rehabilitation', 'prehabilitation', 'recovery', 'diagnosis');

-- Catalog table
CREATE TABLE public.package_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program public.catalog_program NOT NULL,
  name TEXT NOT NULL,
  sessions INTEGER,
  is_monthly_pass BOOLEAN NOT NULL DEFAULT false,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_session NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.package_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read package_catalog"
  ON public.package_catalog FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert package_catalog"
  ON public.package_catalog FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated update package_catalog"
  ON public.package_catalog FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated delete package_catalog"
  ON public.package_catalog FOR DELETE TO authenticated USING (true);

-- Reuse existing timestamp function or create one
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_package_catalog_updated_at
BEFORE UPDATE ON public.package_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial catalog
INSERT INTO public.package_catalog (program, name, sessions, is_monthly_pass, price, price_per_session) VALUES
  ('diagnosis', 'Evaluación clínica', 1, false, 200, 200),
  ('diagnosis', 'Evaluación fisioterapéutica', 1, false, 150, 150),
  ('prehabilitation', 'Prehabilitation 10 sesiones', 10, false, 600, 60),
  ('prehabilitation', 'Prehabilitation Month Pass', NULL, true, 900, NULL),
  ('rehabilitation', 'Rehabilitación 5 sesiones', 5, false, 500, 100),
  ('rehabilitation', 'Rehabilitación 10 sesiones', 10, false, 800, 80),
  ('rehabilitation', 'Rehabilitación Month Pass', NULL, true, 1200, NULL),
  ('recovery', 'Recovery 1 sesión', 1, false, 70, 70),
  ('recovery', 'Recovery 2 sesiones', 2, false, 120, 60),
  ('recovery', 'Recovery 4 sesiones', 4, false, 200, 50);
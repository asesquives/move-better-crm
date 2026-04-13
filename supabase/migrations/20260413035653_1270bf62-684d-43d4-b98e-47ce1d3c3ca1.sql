-- Create enums
CREATE TYPE public.professional_type AS ENUM ('physio', 'evaluator');
CREATE TYPE public.package_type AS ENUM ('rehabilitation', 'prehabilitation', 'recovery');
CREATE TYPE public.payment_method AS ENUM ('yape', 'transfer', 'cash');
CREATE TYPE public.receipt_type AS ENUM ('boleta', 'factura');
CREATE TYPE public.package_status AS ENUM ('active', 'expired', 'completed');
CREATE TYPE public.appointment_type AS ENUM ('medical_diagnosis', 'physio_diagnosis', 'rehabilitation', 'prehabilitation', 'recovery');
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'confirmed', 'done', 'cancelled', 'no_show');

-- Professionals
CREATE TABLE public.professionals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type professional_type NOT NULL DEFAULT 'physio',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read professionals" ON public.professionals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert professionals" ON public.professionals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update professionals" ON public.professionals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete professionals" ON public.professionals FOR DELETE TO authenticated USING (true);

-- Availability blocks
CREATE TABLE public.availability_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read availability" ON public.availability_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert availability" ON public.availability_blocks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update availability" ON public.availability_blocks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete availability" ON public.availability_blocks FOR DELETE TO authenticated USING (true);

-- Clients
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update clients" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete clients" ON public.clients FOR DELETE TO authenticated USING (true);

-- Packages
CREATE TABLE public.packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type package_type NOT NULL,
  total_sessions INTEGER NOT NULL DEFAULT 1,
  sessions_used INTEGER NOT NULL DEFAULT 0,
  total_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_session NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  receipt_type receipt_type NOT NULL DEFAULT 'boleta',
  status package_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  is_monthly_pass BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read packages" ON public.packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert packages" ON public.packages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update packages" ON public.packages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete packages" ON public.packages FOR DELETE TO authenticated USING (true);

-- Appointments
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  type appointment_type NOT NULL,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  revenue_amount NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read appointments" ON public.appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update appointments" ON public.appointments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete appointments" ON public.appointments FOR DELETE TO authenticated USING (true);

-- Revenue entries
CREATE TABLE public.revenue_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  recognized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.revenue_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read revenue" ON public.revenue_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert revenue" ON public.revenue_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update revenue" ON public.revenue_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete revenue" ON public.revenue_entries FOR DELETE TO authenticated USING (true);
-- Reemplazar el trigger: SOLO devenga cuando hay package_id.
-- Sesiones sueltas (sin paquete) NO generan revenue_entries (ya fueron cobradas en el momento).

DROP TRIGGER IF EXISTS trg_handle_revenue_on_session_done ON public.appointments;
DROP FUNCTION IF EXISTS public.handle_revenue_on_session_done();

CREATE OR REPLACE FUNCTION public.handle_revenue_on_session_done()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric := 0;
  v_pkg RECORD;
  v_existing_count integer;
BEGIN
  IF NEW.status <> 'done' THEN RETURN NEW; END IF;
  IF OLD.status = 'done' THEN RETURN NEW; END IF;

  -- Sesiones sueltas no devengan
  IF NEW.package_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.revenue_entries WHERE appointment_id = NEW.id;
  IF v_existing_count > 0 THEN RETURN NEW; END IF;

  SELECT * INTO v_pkg FROM public.packages WHERE id = NEW.package_id FOR UPDATE;
  IF v_pkg.id IS NULL OR v_pkg.total_sessions = 0 THEN RETURN NEW; END IF;

  v_amount := v_pkg.total_paid::numeric / v_pkg.total_sessions::numeric;

  UPDATE public.packages
  SET sessions_used = v_pkg.sessions_used + 1,
      status = CASE WHEN v_pkg.sessions_used + 1 >= v_pkg.total_sessions
               THEN 'completed'::package_status ELSE status END
  WHERE id = v_pkg.id;

  UPDATE public.appointments SET revenue_amount = v_amount WHERE id = NEW.id;

  IF v_amount > 0 THEN
    INSERT INTO public.revenue_entries (appointment_id, client_id, package_id, amount, recognized_at)
    VALUES (NEW.id, NEW.client_id, NEW.package_id, v_amount, now());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_revenue_on_session_done
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_revenue_on_session_done();

-- Limpieza: borrar revenue_entries que se hayan creado para citas SIN paquete
-- y resetear su revenue_amount a 0.
DELETE FROM public.revenue_entries
WHERE appointment_id IN (
  SELECT id FROM public.appointments WHERE package_id IS NULL
);

UPDATE public.appointments
SET revenue_amount = 0
WHERE package_id IS NULL AND COALESCE(revenue_amount, 0) <> 0;
-- 1) Recreate revenue trigger function and trigger
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

  SELECT COUNT(*) INTO v_existing_count
  FROM public.revenue_entries WHERE appointment_id = NEW.id;

  IF v_existing_count > 0 THEN RETURN NEW; END IF;

  IF NEW.package_id IS NOT NULL THEN
    SELECT * INTO v_pkg FROM public.packages WHERE id = NEW.package_id FOR UPDATE;
    IF v_pkg.id IS NULL OR v_pkg.total_sessions = 0 THEN RETURN NEW; END IF;
    v_amount := v_pkg.total_paid::numeric / v_pkg.total_sessions::numeric;

    UPDATE public.packages
    SET sessions_used = v_pkg.sessions_used + 1,
        status = CASE WHEN v_pkg.sessions_used + 1 >= v_pkg.total_sessions
                 THEN 'completed'::package_status ELSE status END
    WHERE id = v_pkg.id;
  ELSE
    v_amount := CASE NEW.type::text
      WHEN 'medical_diagnosis' THEN 200
      WHEN 'physio_diagnosis' THEN 150
      WHEN 'recovery' THEN 70
      ELSE 0 END;
  END IF;

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

-- 2) Backfill revenue_entries for already 'done' appointments without an entry.
--    Use start_time as recognized_at so historical entries land in the correct period.
INSERT INTO public.revenue_entries (appointment_id, client_id, package_id, amount, recognized_at)
SELECT
  a.id,
  a.client_id,
  a.package_id,
  CASE
    WHEN a.package_id IS NOT NULL THEN
      p.total_paid::numeric / NULLIF(p.total_sessions, 0)::numeric
    ELSE
      CASE a.type::text
        WHEN 'medical_diagnosis' THEN 200
        WHEN 'physio_diagnosis' THEN 150
        WHEN 'recovery' THEN 70
        ELSE 0
      END
  END AS amount,
  a.start_time AS recognized_at
FROM public.appointments a
LEFT JOIN public.packages p ON p.id = a.package_id
WHERE a.status = 'done'
  AND NOT EXISTS (
    SELECT 1 FROM public.revenue_entries re WHERE re.appointment_id = a.id
  )
  AND (
    (a.package_id IS NOT NULL AND p.total_sessions > 0 AND p.total_paid > 0)
    OR
    (a.package_id IS NULL AND a.type::text IN ('medical_diagnosis', 'physio_diagnosis', 'recovery'))
  );

-- 3) Sync sessions_used for packages that were affected by the backfill.
--    Recompute from done appointments tied to each package.
UPDATE public.packages pkg
SET sessions_used = sub.used,
    status = CASE WHEN sub.used >= pkg.total_sessions THEN 'completed'::package_status ELSE pkg.status END
FROM (
  SELECT package_id, COUNT(*)::int AS used
  FROM public.appointments
  WHERE status = 'done' AND package_id IS NOT NULL
  GROUP BY package_id
) sub
WHERE pkg.id = sub.package_id
  AND pkg.sessions_used <> sub.used;
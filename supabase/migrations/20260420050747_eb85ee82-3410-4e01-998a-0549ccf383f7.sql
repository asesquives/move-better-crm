-- Function that handles revenue recognition when an appointment is marked as done
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
  -- Only act when status changes TO 'done' (and was not already 'done')
  IF NEW.status <> 'done' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'done' THEN
    RETURN NEW;
  END IF;

  -- Avoid duplicates: check if a revenue_entry already exists for this appointment
  SELECT COUNT(*) INTO v_existing_count
  FROM public.revenue_entries
  WHERE appointment_id = NEW.id;

  IF v_existing_count > 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.package_id IS NOT NULL THEN
    -- Package-backed session
    SELECT * INTO v_pkg
    FROM public.packages
    WHERE id = NEW.package_id
    FOR UPDATE;

    IF v_pkg.id IS NULL OR v_pkg.total_sessions = 0 THEN
      RETURN NEW;
    END IF;

    v_amount := v_pkg.total_paid::numeric / v_pkg.total_sessions::numeric;

    -- Increment sessions_used and mark completed if needed
    UPDATE public.packages
    SET sessions_used = v_pkg.sessions_used + 1,
        status = CASE
          WHEN v_pkg.sessions_used + 1 >= v_pkg.total_sessions THEN 'completed'::package_status
          ELSE status
        END
    WHERE id = v_pkg.id;
  ELSE
    -- Loose session pricing
    v_amount := CASE NEW.type::text
      WHEN 'medical_diagnosis' THEN 200
      WHEN 'physio_diagnosis' THEN 150
      ELSE 0
    END;
  END IF;

  -- Update appointment revenue_amount for traceability
  UPDATE public.appointments
  SET revenue_amount = v_amount
  WHERE id = NEW.id;

  -- Insert revenue entry (only if amount > 0)
  IF v_amount > 0 THEN
    INSERT INTO public.revenue_entries (appointment_id, client_id, package_id, amount, recognized_at)
    VALUES (NEW.id, NEW.client_id, NEW.package_id, v_amount, now());
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS trg_handle_revenue_on_session_done ON public.appointments;
CREATE TRIGGER trg_handle_revenue_on_session_done
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_revenue_on_session_done();
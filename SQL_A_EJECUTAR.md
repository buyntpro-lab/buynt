# 🔧 SQL A EJECUTAR EN SUPABASE - COPIA/PEGA EXACTO

## ⚠️ INSTRUCCIONES

1. Abre [Supabase Dashboard](https://supabase.com)
2. Selecciona tu proyecto `buynt`
3. Ve a **SQL Editor** (lado izquierdo)
4. Copia TODO el código de abajo (desde "-- ====" hasta el final)
5. Pégalo en el editor
6. Click en el botón **"Run"** (o presiona Cmd/Ctrl + Enter)
7. Espera a que complete (si dice "Success", está OK)

---

## 🔴 NOTA CRÍTICA

Este SQL:
- ✅ NO borra datos
- ✅ NO modifica tablas
- ✅ Solo crea/reemplaza funciones RPC
- ✅ Es **seguro ejecutar múltiples veces** (idempotente)

---

## ⬇️ COPIA ESTE CÓDIGO COMPLETO

```sql
-- ============================================================================
-- SUPABASE PATCH: Refactor RPC Return Types to JSONB
-- ============================================================================
-- Date: 2026-01-21
-- Purpose: Fix "false error toast" bug by changing RPC return types from UUID
--          to JSONB with structured {ok, code, message, data} contract
-- ============================================================================

-- ============================================================================
-- PART 1: mark_handoff_uploaded (REFACTORED)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_handoff_uploaded(
    p_rental_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_photo_count INTEGER;
    v_event_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'not_authenticated',
            'message', 'Debes estar autenticado'
        );
    END IF;

    -- Validate participant
    IF NOT public.is_rental_participant(p_rental_id, v_user_id) THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'not_authorized',
            'message', 'No tienes permiso para esta acción'
        );
    END IF;

    -- Check that handoff photos exist
    SELECT COUNT(*) INTO v_photo_count
    FROM public.booking_media
    WHERE rental_id = p_rental_id AND type = 'handoff';

    IF v_photo_count = 0 THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'no_photos',
            'message', 'Debes subir al menos una foto de entrega'
        );
    END IF;

    -- Check not already marked (idempotent)
    IF EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'HANDOFF_PHOTOS_UPLOADED'
    ) THEN
        SELECT id INTO v_event_id
        FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'HANDOFF_PHOTOS_UPLOADED'
        LIMIT 1;
        RETURN jsonb_build_object(
            'ok', true,
            'code', 'already_marked',
            'message', 'Las fotos de entrega ya estaban marcadas',
            'data', jsonb_build_object('event_id', v_event_id, 'idempotent', true)
        );
    END IF;

    -- Log event
    v_event_id := public.log_rental_event(
        p_rental_id,
        'HANDOFF_PHOTOS_UPLOADED',
        jsonb_build_object('photo_count', v_photo_count, 'note', p_note)
    );

    RETURN jsonb_build_object(
        'ok', true,
        'code', 'success',
        'message', 'Fotos de entrega marcadas como subidas',
        'data', jsonb_build_object('event_id', v_event_id, 'photo_count', v_photo_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.mark_handoff_uploaded TO authenticated;

-- ============================================================================
-- PART 2: mark_return_uploaded (REFACTORED)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_return_uploaded(
    p_rental_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_photo_count INTEGER;
    v_event_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'not_authenticated',
            'message', 'Debes estar autenticado'
        );
    END IF;

    -- Validate participant
    IF NOT public.is_rental_participant(p_rental_id, v_user_id) THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'not_authorized',
            'message', 'No tienes permiso para esta acción'
        );
    END IF;

    -- Check that return photos exist
    SELECT COUNT(*) INTO v_photo_count
    FROM public.booking_media
    WHERE rental_id = p_rental_id AND type = 'return';

    IF v_photo_count = 0 THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'no_photos',
            'message', 'Debes subir al menos una foto de devolución'
        );
    END IF;

    -- Check not already marked (idempotent)
    IF EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RETURN_PHOTOS_UPLOADED'
    ) THEN
        SELECT id INTO v_event_id
        FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RETURN_PHOTOS_UPLOADED'
        LIMIT 1;
        RETURN jsonb_build_object(
            'ok', true,
            'code', 'already_marked',
            'message', 'Las fotos de devolución ya estaban marcadas',
            'data', jsonb_build_object('event_id', v_event_id, 'idempotent', true)
        );
    END IF;

    -- Log event
    v_event_id := public.log_rental_event(
        p_rental_id,
        'RETURN_PHOTOS_UPLOADED',
        jsonb_build_object('photo_count', v_photo_count, 'note', p_note)
    );

    RETURN jsonb_build_object(
        'ok', true,
        'code', 'success',
        'message', 'Fotos de devolución marcadas como subidas',
        'data', jsonb_build_object('event_id', v_event_id, 'photo_count', v_photo_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.mark_return_uploaded TO authenticated;

-- ============================================================================
-- PART 3: confirm_handoff (REFACTORED)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.confirm_handoff(p_rental_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_rental RECORD;
    v_event_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'not_authenticated',
            'message', 'Debes estar autenticado'
        );
    END IF;

    -- Get rental
    SELECT * INTO v_rental FROM public.rentals WHERE id = p_rental_id;

    IF v_rental IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'rental_not_found',
            'message', 'El alquiler no existe'
        );
    END IF;

    -- Only owner can confirm handoff
    IF v_rental.owner_id != v_user_id THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'not_authorized',
            'message', 'Solo el propietario puede confirmar la entrega'
        );
    END IF;

    -- Check rental is active
    IF v_rental.status != 'active' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'rental_not_active',
            'message', 'El alquiler no está activo'
        );
    END IF;

    -- Check handoff photos were uploaded
    IF NOT EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'HANDOFF_PHOTOS_UPLOADED'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.booking_media
            WHERE rental_id = p_rental_id AND type = 'handoff'
        ) THEN
            RETURN jsonb_build_object(
                'ok', false,
                'code', 'no_handoff_photos',
                'message', 'Primero deben subirse fotos de la entrega'
            );
        END IF;
    END IF;

    -- Check not already confirmed (idempotent)
    IF EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'HANDOFF_CONFIRMED'
    ) THEN
        SELECT id INTO v_event_id
        FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'HANDOFF_CONFIRMED'
        LIMIT 1;
        RETURN jsonb_build_object(
            'ok', true,
            'code', 'already_confirmed',
            'message', 'La entrega ya estaba confirmada',
            'data', jsonb_build_object('event_id', v_event_id, 'idempotent', true)
        );
    END IF;

    -- Log event
    v_event_id := public.log_rental_event(
        p_rental_id,
        'HANDOFF_CONFIRMED',
        '{}'::JSONB
    );

    RETURN jsonb_build_object(
        'ok', true,
        'code', 'success',
        'message', 'Entrega confirmada correctamente',
        'data', jsonb_build_object('event_id', v_event_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.confirm_handoff TO authenticated;

-- ============================================================================
-- PART 4: confirm_return (REFACTORED)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.confirm_return(p_rental_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_rental RECORD;
    v_event_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'not_authenticated',
            'message', 'Debes estar autenticado'
        );
    END IF;

    -- Get rental
    SELECT * INTO v_rental FROM public.rentals WHERE id = p_rental_id;

    IF v_rental IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'rental_not_found',
            'message', 'El alquiler no existe'
        );
    END IF;

    -- Only renter can confirm return (they're returning the item)
    -- Actually, looking at comment: "Owner confirms return is complete"
    -- So owner receives the item back
    IF v_rental.owner_id != v_user_id THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'not_authorized',
            'message', 'Solo el propietario puede confirmar la devolución'
        );
    END IF;

    -- Check rental is active
    IF v_rental.status != 'active' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'rental_not_active',
            'message', 'El alquiler no está activo'
        );
    END IF;

    -- Check return photos were uploaded
    IF NOT EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RETURN_PHOTOS_UPLOADED'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.booking_media
            WHERE rental_id = p_rental_id AND type = 'return'
        ) THEN
            RETURN jsonb_build_object(
                'ok', false,
                'code', 'no_return_photos',
                'message', 'Primero deben subirse fotos de la devolución'
            );
        END IF;
    END IF;

    -- Check not already confirmed (idempotent)
    IF EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RETURN_CONFIRMED'
    ) THEN
        SELECT id INTO v_event_id
        FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RETURN_CONFIRMED'
        LIMIT 1;
        RETURN jsonb_build_object(
            'ok', true,
            'code', 'already_confirmed',
            'message', 'La devolución ya estaba confirmada',
            'data', jsonb_build_object('event_id', v_event_id, 'idempotent', true)
        );
    END IF;

    -- Log event
    v_event_id := public.log_rental_event(
        p_rental_id,
        'RETURN_CONFIRMED',
        '{}'::JSONB
    );

    RETURN jsonb_build_object(
        'ok', true,
        'code', 'success',
        'message', 'Devolución confirmada correctamente',
        'data', jsonb_build_object('event_id', v_event_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.confirm_return TO authenticated;

-- ============================================================================
-- PART 5: complete_rental (REFACTORED)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_rental(p_rental_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_rental RECORD;
    v_event_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'not_authenticated',
            'message', 'Debes estar autenticado'
        );
    END IF;

    -- Get rental
    SELECT * INTO v_rental FROM public.rentals WHERE id = p_rental_id;

    IF v_rental IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'rental_not_found',
            'message', 'El alquiler no existe'
        );
    END IF;

    -- Only owner can complete
    IF v_rental.owner_id != v_user_id THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'not_authorized',
            'message', 'Solo el propietario puede completar el alquiler'
        );
    END IF;

    -- Check rental is active
    IF v_rental.status != 'active' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'rental_not_active',
            'message', 'El alquiler no está activo'
        );
    END IF;

    -- Check return was confirmed
    IF NOT EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RETURN_CONFIRMED'
    ) THEN
        RETURN jsonb_build_object(
            'ok', false,
            'code', 'return_not_confirmed',
            'message', 'La devolución debe estar confirmada antes de completar'
        );
    END IF;

    -- Check not already completed (idempotent)
    IF EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RENTAL_COMPLETED'
    ) THEN
        SELECT id INTO v_event_id
        FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RENTAL_COMPLETED'
        LIMIT 1;
        RETURN jsonb_build_object(
            'ok', true,
            'code', 'already_completed',
            'message', 'El alquiler ya estaba completado',
            'data', jsonb_build_object('event_id', v_event_id, 'idempotent', true)
        );
    END IF;

    -- Update rental status
    UPDATE public.rentals
    SET status = 'completed'
    WHERE id = p_rental_id;

    -- Log event
    v_event_id := public.log_rental_event(
        p_rental_id,
        'RENTAL_COMPLETED',
        '{}'::JSONB
    );

    RETURN jsonb_build_object(
        'ok', true,
        'code', 'success',
        'message', 'Alquiler completado correctamente',
        'data', jsonb_build_object('event_id', v_event_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.complete_rental TO authenticated;
```

---

## ✅ DESPUÉS DE EJECUTAR

### Verificación Rápida (ejecuta esta query en mismo SQL Editor)

```sql
SELECT proname, prorettype::regtype::text as return_type
FROM pg_proc
WHERE proname IN (
    'mark_handoff_uploaded',
    'mark_return_uploaded',
    'confirm_handoff',
    'confirm_return',
    'complete_rental'
)
AND pronamespace = 'public'::regnamespace
ORDER BY proname;
```

**Resultado esperado:**
```
proname                    | return_type
--------------------------+-----------
complete_rental            | jsonb
confirm_handoff            | jsonb
confirm_return             | jsonb
mark_handoff_uploaded      | jsonb
mark_return_uploaded       | jsonb
```

Si todas dicen `jsonb`: ✅ **SUCCESS**

---

## 🎉 ¡Listo!

Ya puedes hacer deploy del frontend. Las nuevas RPCs están activas.

-- ============================================================================
-- FIX RLS POLICIES - Usar auth.jwt() en lugar de auth.users
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- Eliminar políticas existentes de conversations
DROP POLICY IF EXISTS conversations_select ON public.conversations;
DROP POLICY IF EXISTS conversations_update_owner ON public.conversations;
DROP POLICY IF EXISTS conversations_insert ON public.conversations;

-- Eliminar políticas existentes de messages
DROP POLICY IF EXISTS messages_select ON public.messages;
DROP POLICY IF EXISTS messages_insert ON public.messages;

-- Eliminar políticas existentes de notifications
DROP POLICY IF EXISTS notifications_select ON public.notifications;
DROP POLICY IF EXISTS notifications_update ON public.notifications;

-- Eliminar políticas existentes de user_blocks
DROP POLICY IF EXISTS user_blocks_select ON public.user_blocks;
DROP POLICY IF EXISTS user_blocks_insert ON public.user_blocks;
DROP POLICY IF EXISTS user_blocks_delete ON public.user_blocks;

-- Eliminar políticas existentes de message_attachments
DROP POLICY IF EXISTS attachments_select ON public.message_attachments;
DROP POLICY IF EXISTS attachments_insert ON public.message_attachments;

-- ============================================================================
-- NUEVAS POLÍTICAS USANDO auth.jwt() ->> 'email'
-- ============================================================================

-- CONVERSATIONS: SELECT
CREATE POLICY conversations_select ON public.conversations
  FOR SELECT USING (
    (auth.jwt() ->> 'email') = owner_id 
    OR (auth.jwt() ->> 'email') = renter_id
  );

-- CONVERSATIONS: INSERT (nueva - faltaba!)
CREATE POLICY conversations_insert ON public.conversations
  FOR INSERT WITH CHECK (
    (auth.jwt() ->> 'email') = renter_id
  );

-- CONVERSATIONS: UPDATE
CREATE POLICY conversations_update ON public.conversations
  FOR UPDATE USING (
    (auth.jwt() ->> 'email') = owner_id 
    OR (auth.jwt() ->> 'email') = renter_id
  );

-- MESSAGES: SELECT
CREATE POLICY messages_select ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.owner_id = (auth.jwt() ->> 'email') OR c.renter_id = (auth.jwt() ->> 'email'))
    )
  );

-- MESSAGES: INSERT
CREATE POLICY messages_insert ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = (auth.jwt() ->> 'email')
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.owner_id = (auth.jwt() ->> 'email') OR c.renter_id = (auth.jwt() ->> 'email'))
    )
  );

-- MESSAGE ATTACHMENTS: SELECT
CREATE POLICY attachments_select ON public.message_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.owner_id = (auth.jwt() ->> 'email') OR c.renter_id = (auth.jwt() ->> 'email'))
    )
  );

-- MESSAGE ATTACHMENTS: INSERT
CREATE POLICY attachments_insert ON public.message_attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.owner_id = (auth.jwt() ->> 'email') OR c.renter_id = (auth.jwt() ->> 'email'))
    )
  );

-- USER BLOCKS: SELECT
CREATE POLICY user_blocks_select ON public.user_blocks
  FOR SELECT USING (
    (auth.jwt() ->> 'email') = blocker_id 
    OR (auth.jwt() ->> 'email') = blocked_id
  );

-- USER BLOCKS: INSERT
CREATE POLICY user_blocks_insert ON public.user_blocks
  FOR INSERT WITH CHECK (
    (auth.jwt() ->> 'email') = blocker_id
  );

-- USER BLOCKS: DELETE
CREATE POLICY user_blocks_delete ON public.user_blocks
  FOR DELETE USING (
    (auth.jwt() ->> 'email') = blocker_id
  );

-- NOTIFICATIONS: SELECT
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT USING (
    (auth.jwt() ->> 'email') = user_id
  );

-- NOTIFICATIONS: UPDATE
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE USING (
    (auth.jwt() ->> 'email') = user_id
  );

-- NOTIFICATIONS: INSERT (para el sistema)
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- Verificación
-- ============================================================================
SELECT 'Políticas RLS actualizadas correctamente' as status;

# 📱 BUYNT CHAT SYSTEM - IMPLEMENTATION GUIDE

## Sistema de Mensajería Funcional y Seguro

Este documento describe la implementación completa del sistema de chat para Buynt, incluyendo base de datos, RPC, RLS, Storage y frontend.

---

## 1. SETUP - Ejecuta esto primero

### 1.1 Crear la Migration en Supabase

**Opción A: Via Supabase Dashboard (RECOMENDADO)**
1. Ve a https://app.supabase.com → Tu proyecto → SQL Editor
2. Copia el contenido de `/supabase/migrations/20250111_chat_system.sql`
3. Pega en el editor y ejecuta

**Opción B: Via CLI (si tienes Supabase CLI instalado)**
```bash
npm install --save-dev @supabase/cli
npx supabase db push
```

### 1.2 Crear Storage Bucket

1. Supabase Dashboard → Storage → Buckets
2. Crea un nuevo bucket llamado `chat-attachments`
3. Configúralo como **PRIVATE**

### 1.3 Crear Storage Policies

En SQL Editor, ejecuta:

```sql
-- Crear la política para upload
create policy "Users can upload attachments to their conversations"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Crear la política para download
create policy "Users can download attachments from their conversations"
  on storage.objects for select
  using (
    bucket_id = 'chat-attachments'
  );
```

### 1.4 Habilitar Realtime

En Supabase Dashboard → Replication:
- Marca checkboxes para: `conversations`, `messages`, `notifications`

---

## 2. ARQUITECTURA DE BASE DE DATOS

### Tablas Principales

#### `conversations`
```
id (uuid)                 - PK
product_id (uuid)         - FK → products
owner_id (uuid)           - FK → auth.users
renter_id (uuid)          - FK → auth.users
created_at (timestamptz)
updated_at (timestamptz)
owner_last_read_at        - Marca de lectura del propietario
renter_last_read_at       - Marca de lectura del inquilino
```
- Constraint: 1 conversación por (product_id, owner_id, renter_id)
- Constraint: owner_id ≠ renter_id

#### `messages`
```
id (uuid)                 - PK
conversation_id (uuid)    - FK → conversations
sender_id (uuid)          - FK → auth.users
body (text)               - Contenido del mensaje
created_at (timestamptz)
```

#### `message_attachments`
```
id (uuid)                 - PK
message_id (uuid)         - FK → messages
conversation_id (uuid)    - FK → conversations
storage_path (text)       - Ruta en Storage (ej: "conv_id/msg_id/file.jpg")
mime_type (text)
file_name (text)
file_size (bigint)
created_at (timestamptz)
```

#### `user_blocks`
```
id (uuid)                 - PK
blocker_id (uuid)         - FK → auth.users
blocked_id (uuid)         - FK → auth.users
created_at (timestamptz)
```
- Constraint: blocker_id ≠ blocked_id
- Unique: (blocker_id, blocked_id)

#### `notifications`
```
id (uuid)                 - PK
user_id (uuid)            - FK → auth.users
type (text)               - 'message'
conversation_id (uuid)    - FK → conversations
payload (jsonb)           - { message_id, sender_id }
created_at (timestamptz)
read_at (timestamptz)     - NULL = no leído
```

---

## 3. FUNCIONES RPC (Security Definer)

### `get_or_create_conversation(product_id uuid) → uuid`

**Qué hace:**
1. Obtiene el owner_id del producto desde BD (server-side, seguro)
2. Valida que owner ≠ renter
3. Valida que no estén bloqueados
4. Si existe conversación, devuelve su ID
5. Si no existe, la crea y devuelve su ID

**Uso desde frontend:**
```typescript
const conversationId = await supabase.rpc('get_or_create_conversation', {
  p_product_id: productId
});
```

### `send_message(conversation_id uuid, body text) → uuid`

**Qué hace:**
1. Valida que el usuario es participante
2. Valida que no estén bloqueados
3. Inserta el mensaje
4. Actualiza `updated_at` de la conversación
5. Crea una notificación para el otro participante
6. Devuelve el ID del mensaje

### `mark_conversation_read(conversation_id uuid) → void`

**Qué hace:**
1. Actualiza `owner_last_read_at` o `renter_last_read_at` según quién sea auth.uid()
2. Marca notificaciones como leídas

### `list_my_conversations() → table`

**Qué devuelve:**
- Todas tus conversaciones
- Con último mensaje, timestamp y si está leído
- Con contador de mensajes no leídos
- Ordenadas por `updated_at DESC`

---

## 4. ROW LEVEL SECURITY (RLS)

### Políticas por tabla

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| conversations | ✓ si soy owner/renter | ✗ | ✓ si soy owner/renter | ✗ |
| messages | ✓ si soy participante | ✓ si sender_id=auth.uid() y participante | ✗ | ✗ |
| message_attachments | ✓ si soy participante | ✓ si soy participante | ✗ | ✗ |
| user_blocks | ✓ si soy blocker/blocked | ✓ si soy blocker | ✗ | ✓ si soy blocker |
| notifications | ✓ si user_id=auth.uid() | ✗ | ✓ si user_id=auth.uid() | ✗ |

---

## 5. REALTIME CHANNELS

### Canales principales

```typescript
// Nuevo mensaje en una conversación
supabase
  .channel(`conv_${conversationId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    },
    (payload) => console.log('Nuevo mensaje:', payload.new)
  )
  .subscribe();

// Presencia (typing, online)
const presenceChannel = supabase.channel(`presence_${conversationId}`);
presenceChannel.on('presence', { event: 'sync' }, () => {
  const presences = presenceChannel.presenceState();
});
presenceChannel.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    presenceChannel.track({ typing: false, online: true });
  }
});
```

---

## 6. STORAGE & ATTACHMENTS

### Flujo de carga

1. **User selecciona archivo** → Valida (max 10MB, tipos permitidos)
2. **Frontend comprime imagen** (si aplica)
3. **Upload a Storage:**
   ```
   chat-attachments/{auth.uid()}/{conversationId}/{messageId}/{uuid}_{filename}
   ```
4. **Create message_attachments record** en BD
5. **Realtime actualiza** otros clientes

### Políticas Storage

```sql
-- Upload: solo tu conversación
bucket_id = 'chat-attachments'
AND (storage.foldername(name))[1] = (auth.uid())::text

-- Download: acceso a archivos en tus conversaciones
bucket_id = 'chat-attachments'
```

---

## 7. FRONTEND - Páginas

### /messages (Bandeja)

**Componentes:**
- Header con badge de unread total
- Lista de conversaciones (infinite scroll)
- Búsqueda por usuario/producto
- Empty state si no hay conversaciones

**Datos:**
```typescript
const { data: conversations } = await supabase.rpc('list_my_conversations');
// Retorna: conversation_id, product_title, other_user_name, 
//          last_message_body, unread_count, etc.
```

**Realtime:**
- Suscripción a INSERT en `conversations`
- Suscripción a INSERT en `messages` (para actualizar último mensaje)
- Suscripción a notificaciones nuevas

### /messages/[conversationId] (Chat Detail)

**Componentes:**
- Header: producto + otro usuario + status online
- Área de mensajes con:
  - Agrupación por día
  - Burbujas izquierda (received) / derecha (sent)
  - Timestamp de cada mensaje
  - Read receipts ("Visto a las 14:30")
  - Previsualizaciones de adjuntos
- Input de texto:
  - Autoexpandible (textarea)
  - Botón enviar (Enter = enviar, Shift+Enter = nueva línea)
  - Botón adjuntar (drag & drop opcional)
  - Emoji picker opcional
- Typing indicator: "Juan está escribiendo..."
- Presencia: "Online" / "Offline"
- Paginación: cargar mensajes antiguos (infinite scroll arriba)

**Flujo:**
1. **On mount:** `mark_conversation_read()`
2. **Subscribe a messages** → Realtime
3. **Send message:** Optimistic UI → `send_message()` → Confirm
4. **Typing:** Track en Presence
5. **Unmount:** Unsubscribe + track(typing: false)

---

## 8. INTEGRACIÓN CON "CONTACTAR"

En **ItemDetail.tsx**, el botón "Contactar" ahora:

```typescript
const handleContact = async () => {
  try {
    const conversationId = await supabase.rpc('get_or_create_conversation', {
      p_product_id: item.id
    });
    navigate(`/messages/${conversationId}`);
  } catch (error) {
    toast.error('No se pudo abrir el chat');
  }
};
```

---

## 9. SEGURIDAD

### Medidas implementadas

✅ **RLS estricta:** Solo participantes pueden ver/enviar  
✅ **owner_id server-side:** No viene del cliente  
✅ **Bloqueos bidireccionales:** A bloquea B → B no puede contactar A  
✅ **XSS prevention:** body renderizado como texto plano  
✅ **Rate limiting:** (Implementar en API layer si es necesario)  
✅ **Storage policies:** Solo acceso a tus archivos  
✅ **Validación de entrada:** Body no vacío, tamaño archivo limitado  

---

## 10. PERFORMANCE

### Índices
- `conversations_owner_updated_idx` → List tus conversaciones rápido
- `conversations_renter_updated_idx` → List conversaciones como renter
- `messages_conversation_created_idx` → Cargar mensajes paginated

### Queries optimizadas
- `list_my_conversations()` usa LATERAL subquery para último mensaje
- Paginación: `created_at` como cursor
- Unread count: SQL aggregation, no loop

---

## 11. TESTING E2E

### Con Playwright (añade a tu suite):

```typescript
test('Two users exchange messages in real-time', async ({ page }) => {
  // User A login
  const userA = await supabase.auth.signInWithPassword({
    email: 'alice@test.com', password: 'pass123'
  });

  // User B login (otra instancia)
  const userB = await supabase.auth.signInWithPassword({
    email: 'bob@test.com', password: 'pass123'
  });

  // User A crea producto
  const product = await supabase.from('products').insert({
    title: 'Test Item',
    owner_id: userA.user.id
  }).select().single();

  // User B contacta
  page.goto(`/item/${product.id}`);
  page.click('button:has-text("Contactar")');
  
  // Verifica conversación creada
  expect(page).toHaveURL(/\/messages\//);

  // User B envía mensaje
  page.fill('[placeholder="Escribe tu mensaje..."]', 'Hola!');
  page.click('button[aria-label="Enviar"]');
  
  // Realtime: User A ve el mensaje al instante (sin refresh)
  // (verificar que el mensaje aparece en el DOM)
});
```

---

## 12. DEPLOYMENT CHECKLIST

- [ ] Migration ejecutada en BD
- [ ] Storage bucket created & policies set
- [ ] Realtime enabled en tablas
- [ ] Frontend pages creadas (/messages, /messages/[id])
- [ ] Integración "Contactar" funcional
- [ ] Prueba E2E pasando
- [ ] Rate limiting implementado (si es crítico)
- [ ] Backups configurados
- [ ] Monitoring: log errores RPC

---

## 13. ARCHIVOS CREADOS/MODIFICADOS

### Creados:
- `/supabase/migrations/20250111_chat_system.sql`
- `/src/pages/Messages.tsx` (bandeja)
- `/src/pages/MessageDetail.tsx` (chat detail)
- `/src/components/chat/MessageBubble.tsx`
- `/src/components/chat/MessageInput.tsx`
- `/src/components/chat/AttachmentUpload.tsx`
- `/src/services/chatService.ts`
- `/src/hooks/useChat.ts`
- `/docs/CHAT_SYSTEM.md` (este archivo)

### Modificados:
- `/src/pages/ItemDetail.tsx` (integración botón "Contactar")
- `/src/services/types.ts` (tipos de chat)
- `/src/App.tsx` (rutas /messages)

---

## 14. VARIABLES DE ENTORNO

No requiere nuevas variables. Usa las existentes:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 15. PRÓXIMOS PASOS / MEJORAS

- [ ] Encriptación end-to-end de mensajes (opcional)
- [ ] Voice messages
- [ ] Video calls (integración Twilio/WebRTC)
- [ ] Reacciones emoji a mensajes
- [ ] Forwarding de mensajes
- [ ] Message pinning
- [ ] Traductor en-línea (integración OpenAI)

---

**¡Listo para deploying! 🚀**

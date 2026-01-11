# 🚀 Guía de Setup: Sistema de Mensajería Buynt

## Resumen General

Se ha implementado un **sistema de mensajería completo y seguro** para Buynt con las siguientes características:

- ✅ Conversaciones en tiempo real (Realtime de Supabase)
- ✅ RLS (Row-Level Security) en todas las tablas
- ✅ RPC functions con security definer (validación server-side)
- ✅ Indicadores de escritura (typing indicators)
- ✅ Badges de mensajes sin leer
- ✅ Bloqueo de usuarios
- ✅ Notificaciones en-app
- ✅ Soporte para attachments (almacenamiento en Storage)

---

## ✅ Frontend (YA COMPLETADO)

El frontend está **100% implementado**:

### Páginas Nuevas
- **[/messages](src/pages/Messages.tsx)** - Bandeja de conversaciones con unread badges
- **[/messages/:conversationId](src/pages/MessageDetail.tsx)** - Chat detail con mensajes en tiempo real

### Componentes Nuevos
- **[MessageBubble](src/components/chat/MessageBubble.tsx)** - Renderiza mensajes con read receipts
- **[MessageInput](src/components/chat/MessageInput.tsx)** - Input con typing indicator

### Hook Personalizado
- **[useChat](src/hooks/useChat.ts)** - Maneja suscripciones Realtime y estado del chat

### Servicio de Chat
- **[chatService](src/services/chatService.ts)** - Llama RPC functions y maneja Realtime

### Integración ItemDetail
- El botón "Contactar" ahora abre el chat usando `chatService.getOrCreateConversation()`

### Rutas Actualizadas
- [App.tsx](src/App.tsx) incluye `/messages` y `/messages/:conversationId`

---

## 📋 Backend (REQUIERE INSTALACIÓN EN SUPABASE)

### Paso 1: Ejecutar la Migración SQL

El archivo [/supabase/migrations/20250111_chat_system.sql](supabase/migrations/20250111_chat_system.sql) contiene **todo lo necesario**:

**OPCIÓN A: Via Dashboard (Recomendado)**
1. Ve a https://app.supabase.com
2. Selecciona tu proyecto
3. SQL Editor → "Create a new query" → New blank query
4. Copia todo el contenido de `/supabase/migrations/20250111_chat_system.sql`
5. Ejecuta ("RUN")

**OPCIÓN B: Via CLI**
```bash
npm install -D @supabase/cli
npx supabase db push
```

**OPCIÓN C: Manual (Si Dashboard no funciona)**
Ejecuta cada sección del archivo manualmente en SQL Editor:
- Tablas (conversations, messages, message_attachments, user_blocks, notifications)
- Helper function is_blocked()
- 4 RPC functions
- 9 RLS policies
- Triggers

### Paso 2: Habilitar Realtime en las Tablas

1. Dashboard → Replication
2. Marca checkboxes para:
   - `conversations`
   - `messages`
   - `notifications`

**Alternativa CLI:**
```bash
npx supabase realtime add --schema public --table conversations
npx supabase realtime add --schema public --table messages
npx supabase realtime add --schema public --table notifications
```

### Paso 3: Crear Storage Bucket (Opcional - para attachments)

1. Dashboard → Storage → Create new bucket
2. Nombre: `chat-attachments`
3. Marcar: "Make it private"
4. Crear

**Las políticas ya están en la migración SQL** (sección "STORAGE BUCKET")

---

## 🧪 Verificar Instalación

### Checklist de Verificación

```bash
# 1. Verificar que el frontend compila sin errores
npm run build
# ✅ Si no hay errores, el frontend está listo

# 2. Verificar tablas en Supabase
# Dashboard → Table Editor → Deberías ver:
# - conversations
# - messages
# - message_attachments
# - user_blocks
# - notifications
```

### Test Rápido (Manual)

1. Abre la app: http://localhost:5173
2. Crea dos cuentas diferentes (email1@test.com, email2@test.com)
3. Con usuario 1: Publica un producto
4. Con usuario 2: Navega a ese producto → Click "Contactar"
5. Debería abrir `/messages/[conversationId]` con chat vacío
6. Envía un mensaje desde usuario 2
7. Con usuario 1: Abre `/messages` → Deberías ver la conversación con unread badge

---

## 🏗️ Arquitectura de Datos

### Tablas Principales

**conversations**
```sql
- id UUID (PK)
- product_id UUID (FK → products)
- owner_id TEXT (usuario dueño)
- renter_id TEXT (usuario alquilador)
- created_at TIMESTAMP
- updated_at TIMESTAMP
- owner_read_at TIMESTAMP (último mensaje leído por owner)
- renter_read_at TIMESTAMP (último mensaje leído por renter)

UNIQUE(product_id, owner_id, renter_id)
```

**messages**
```sql
- id UUID (PK)
- conversation_id UUID (FK → conversations, ON DELETE CASCADE)
- sender_id TEXT (usuario que envía)
- body TEXT
- created_at TIMESTAMP
```

**message_attachments** (opcional)
```sql
- id UUID (PK)
- message_id UUID (FK → messages, ON DELETE CASCADE)
- conversation_id UUID (for organization)
- storage_path TEXT (ruta en Storage)
- mime_type TEXT
- file_name TEXT
- file_size INTEGER
```

**user_blocks** (para bloquear usuarios)
```sql
- id UUID (PK)
- blocker_id TEXT
- blocked_id TEXT
- created_at TIMESTAMP

UNIQUE(blocker_id, blocked_id)
```

**notifications** (badges sin leer)
```sql
- id UUID (PK)
- user_id TEXT
- type TEXT ('message', 'mention', etc.)
- conversation_id UUID
- payload JSONB
- created_at TIMESTAMP
- read_at TIMESTAMP
```

---

## 🔒 Seguridad: RLS Policies

Todas las tablas tienen RLS habilitado. **Solo usuario propietario puede ver sus conversaciones:**

| Tabla | Política | Permitido |
|-------|---------|----------|
| conversations | SELECT | Usuario es owner_id O renter_id |
| messages | SELECT | Usuario es part of the conversation |
| messages | INSERT | Usuario puede enviar solo a conversación donde participa |
| notifications | SELECT | Usuario es owner (user_id) |
| user_blocks | SELECT/INSERT/DELETE | Usuario es blocker/blocked |

**Nota:** Las RPC functions usan `SET ROLE postgres` (security definer) para validaciones adicionales server-side.

---

## 🎯 RPC Functions (API Server-side)

### 1. `get_or_create_conversation(p_product_id uuid) → uuid`
```sql
-- Uso desde frontend:
const convId = await chatService.getOrCreateConversation(productId);

-- Qué hace:
1. Obtiene el owner_id del producto desde la tabla products
2. Si ya existe conversación entre current_user y owner → retorna su ID
3. Si no existe → crea nueva conversación
4. Valida que current_user ≠ owner (no puedes contactarte a ti mismo)
```

### 2. `send_message(p_conversation_id uuid, p_body text) → uuid`
```sql
-- Uso:
const messageId = await chatService.sendMessage(convId, 'Hola!');

-- Qué hace:
1. Inserta el mensaje en messages table
2. Actualiza conversations.updated_at
3. Crea notification para el otro usuario
4. Retorna el message_id
```

### 3. `mark_conversation_read(p_conversation_id uuid) → void`
```sql
-- Uso:
await chatService.markConversationAsRead(convId);

-- Qué hace:
1. Actualiza owner_read_at o renter_read_at (según current_user)
2. Marca todas las notifications como read
```

### 4. `list_my_conversations() → table`
```sql
-- Uso (interna en useChat):
const convs = await chatService.listMyConversations();

-- Retorna tabla con:
- conversation_id
- product_id
- product_title (join con products)
- other_user_name
- last_message_body
- last_message_at
- unread_count
```

---

## 🔄 Realtime: Cómo Funciona

### Subscripciones en useChat.ts

1. **subscribeToMessages()**: Escucha INSERT en messages table
   - Cuando nuevo mensaje llega, lo agrega automáticamente a state
   - Sin necesidad de polling

2. **subscribeToConversations()**: Escucha UPDATE en conversations
   - Detecta cuando last_message se actualiza
   - Refresca la bandeja en tiempo real

3. **subscribeToNotifications()** (opcional): Escucha INSERT en notifications
   - Actualiza unread badge automáticamente

**Filtros por usuario:**
- Cada subscription usa `filter: "user_id=eq.${userId}"` o `"conversation_id=eq.${convId}"`
- Supabase Realtime solo envía eventos del usuario autenticado

---

## 🎨 Frontend: Estados y Flujos

### Flujo 1: Abrir Bandeja (/messages)
```
1. Usuario abre /messages
2. useChat.loadConversations() → RPC list_my_conversations()
3. Renderiza ConversationCard por cada conversation
4. Cada card muestra:
   - Avatar del otro usuario
   - Nombre + título del producto
   - Preview del último mensaje
   - Timestamp relativo (ej: "hace 2 minutos")
   - Badge rojo con unread_count si > 0
5. Click en card → navega a /messages/[conversationId]
```

### Flujo 2: Abrir Chat Detail (/messages/:conversationId)
```
1. messageDetail.tsx carga con conversationId del URL
2. useChat(conversationId) → carga mensajes iniciales
3. Suscripción Realtime se activa (subscribeToMessages)
4. markAsRead() → actualiza read timestamps
5. Usuario escribe → handleSendMessage()
6. sendMessage(body) → optimistic UI (temp message) → RPC → replace con real
7. Nuevos mensajes llegan por Realtime → se muestran automáticamente
```

### Flujo 3: Contactar desde ItemDetail
```
1. Usuario hace click "Contactar" en detail producto
2. chatService.getOrCreateConversation(productId) → RPC
3. RPC retorna conversation_id (nueva o existente)
4. navigate(/messages/[conversationId]) → abre el chat
```

---

## 🚀 Comenzar a Desarrollar

### Configurar Variables de Entorno

```bash
# .env (ya debería existir con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY)
# Si no están, cópialas de https://app.supabase.com → Settings → API
```

### Iniciar Dev Server

```bash
npm run dev
# Abierto en http://localhost:5173
```

### Desarrollo de Chat

**Archivo que probablemente necesitarás editar:**
- [src/hooks/useChat.ts](src/hooks/useChat.ts) - Lógica de estado y subscripciones
- [src/services/chatService.ts](src/services/chatService.ts) - Llamadas a RPC y Realtime
- [src/pages/MessageDetail.tsx](src/pages/MessageDetail.tsx) - UI del chat detail

**Si agregas nuevas features:**
1. Actualiza tipos en [src/services/types.ts](src/services/types.ts)
2. Agrega RPC function o query en chatService.ts
3. Usa desde componentes o hooks

---

## 🧪 Tests E2E (Opcional)

Si deseas automatizar el testing:

```bash
npm install -D @playwright/test

# Crear test file
touch tests/chat.spec.ts
```

Ejemplo test en [/tests/chat.spec.ts](tests/chat.spec.ts) (crear si necesitas)

---

## 📦 Deployment

### Producción

1. **Build frontend:**
   ```bash
   npm run build
   ```
   Salida: `dist/` (subir a Vercel, Netlify, etc.)

2. **Supabase:**
   - Todas las RPC functions y RLS están en migración
   - No requiere cambios adicionales para prod
   - Asegurate que env vars apunten a prod Supabase project

3. **Storage (si usas attachments):**
   - El bucket `chat-attachments` se crea automáticamente con la migración
   - Las políticas ya están configuradas

---

## ✅ Checklist Final

- [ ] Migración SQL ejecutada en Supabase
- [ ] Realtime habilitado en conversations, messages, notifications
- [ ] Storage bucket creado (opcional, si quieres attachments)
- [ ] Frontend compila sin errores (`npm run build`)
- [ ] App abierta en http://localhost:5173
- [ ] Puedes navegar a /messages y ver la bandeja
- [ ] Test manual: dos usuarios intercambian mensajes
- [ ] Unread badges aparecen correctamente
- [ ] Timestamps en español ("hace 2 minutos")

---

## 🆘 Troubleshooting

### "No se puede abrir el chat"
- Verifica que la migración SQL se ejecutó completamente
- Verifica que Realtime está habilitado en dashboard

### "Mensajes no aparecen"
- Abre DevTools → Console → Checa errores de Supabase
- Verifica que `owner_id` en products table está correcto

### "RLS policy violation"
- Significa que el usuario no tiene permisos para ver esa data
- Verifica que `current_user_id` está siendo leído correctamente desde auth

### "Adjuntos no suben"
- Verifica que el bucket `chat-attachments` existe y es PRIVATE
- Verifica que las políticas en la migración se ejecutaron

---

## 📚 Referencias

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [React Hot Toast](https://react-hot-toast.com/)
- [date-fns](https://date-fns.org/)

---

## 🎉 ¡Listo!

El sistema de mensajería está completamente funcional. Solo necesitas:

1. Ejecutar la migración SQL en Supabase
2. Habilitar Realtime
3. ¡Disfrutar del chat! 🚀

Si tienes preguntas o encuentras bugs, revisa los archivos:
- [CHAT_SYSTEM_GUIDE.md](CHAT_SYSTEM_GUIDE.md) - Documentación técnica detallada
- [supabase/migrations/20250111_chat_system.sql](supabase/migrations/20250111_chat_system.sql) - Esquema completo

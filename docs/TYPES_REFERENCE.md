# Chat System: TypeScript Interfaces

Referencia rápida de todos los tipos usados en el sistema de mensajería.

## Core Types

### ChatMessage
```typescript
interface ChatMessage {
  id: string;                      // UUID único del mensaje
  conversation_id: string;         // UUID de la conversación
  sender_id: string;              // Email del usuario que envía
  body: string;                   // Contenido del mensaje
  created_at: string;             // ISO timestamp
}
```

### Conversation
```typescript
interface Conversation {
  id: string;                     // UUID de la conversación
  product_id: string;             // UUID del producto
  owner_id: string;              // Email del dueño del producto
  renter_id: string;             // Email del solicitante
  created_at: string;            // ISO timestamp
  updated_at: string;            // ISO timestamp
  owner_read_at?: string | null; // Último leído por owner
  renter_read_at?: string | null; // Último leído por renter
}
```

### ConversationListItem (Para bandeja)
```typescript
interface ConversationListItem {
  conversation_id: string;        // UUID
  product_id: string;             // Para navegar al producto
  product_title: string;          // Nombre del producto
  other_user_name: string;        // Nombre del otro usuario
  last_message_body: string;      // Preview del último mensaje
  last_message_at: string;        // Timestamp del último mensaje
  unread_count: number;           // Cantidad de mensajes sin leer
}
```

### MessageAttachment (Adjuntos)
```typescript
interface MessageAttachment {
  id: string;                      // UUID del adjunto
  message_id: string;             // UUID del mensaje
  conversation_id: string;        // UUID de la conversación (for organization)
  storage_path: string;           // Ruta en Storage bucket
  mime_type: string;              // Ej: "image/jpeg"
  file_name: string;              // Nombre original del archivo
  file_size: number;              // Tamaño en bytes
}
```

### UserBlock (Para bloqueos)
```typescript
interface UserBlock {
  id: string;                      // UUID del bloqueo
  blocker_id: string;             // Email del usuario que bloquea
  blocked_id: string;             // Email del usuario bloqueado
  created_at: string;             // ISO timestamp
}
```

### Notification (Notificaciones)
```typescript
interface Notification {
  id: string;                      // UUID de la notificación
  user_id: string;                // Email del usuario destino
  type: string;                   // "message", "mention", "request", etc.
  conversation_id: string;        // UUID de la conversación relacionada
  payload: Record<string, any>;   // JSON con datos adicionales
  created_at: string;             // ISO timestamp
  read_at?: string | null;        // ISO timestamp cuando se leyó
}
```

## Service Types

### ChatService Methods

```typescript
class ChatService {
  // Get or create
  getOrCreateConversation(productId: string): Promise<string>;
  
  // Messages
  sendMessage(conversationId: string, body: string): Promise<string>;
  getMessages(
    conversationId: string,
    limit?: number,
    cursor?: string
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }>;
  
  // Read status
  markConversationAsRead(conversationId: string): Promise<void>;
  
  // Conversations
  getConversation(conversationId: string): Promise<Conversation>;
  listMyConversations(): Promise<ConversationListItem[]>;
  
  // Attachments (opcional)
  uploadAttachment(
    conversationId: string,
    messageId: string,
    file: File
  ): Promise<string>;
  getAttachmentUrl(storagePath: string): string;
  getMessageAttachments(messageId: string): Promise<MessageAttachment[]>;
  
  // Blocking
  blockUser(blockedId: string): Promise<void>;
  unblockUser(blockedId: string): Promise<void>;
  getBlockedUsers(): Promise<UserBlock[]>;
  
  // Realtime Subscriptions
  subscribeToMessages(
    conversationId: string,
    callback: (message: ChatMessage) => void
  ): Subscription;
  
  subscribeToConversations(
    callback: (conversation: Conversation) => void
  ): Subscription;
  
  subscribeToNotifications(
    userId: string,
    callback: (notification: Notification) => void
  ): Subscription;
  
  // Presence & Typing
  trackTyping(conversationId: string, isTyping: boolean): void;
  onPresenceChange(
    conversationId: string,
    callback: (presence: Record<string, any>) => void
  ): void;
  
  // Unread
  getUnreadCount(): Promise<number>;
}
```

## Hook Types

### useChat Hook

```typescript
interface UseChat {
  // Data
  messages: ChatMessage[];
  conversations: ConversationListItem[];
  typingUsers: string[];              // Nombres de usuarios escribiendo
  unreadCount: number;

  // States
  loading: boolean;
  sending: boolean;
  error: string | null;
  hasMoreMessages: boolean;

  // Actions
  loadConversations(): Promise<void>;
  loadMessages(cursor?: string): Promise<void>;
  loadMoreMessages(): Promise<void>;
  sendMessage(body: string): Promise<void>;
  markAsRead(): Promise<void>;
  getOrCreateConversation(productId: string): Promise<string>;
}

// Uso
const { messages, sendMessage, loading } = useChat(conversationId);
```

## Component Props

### MessageBubble Props
```typescript
interface MessageBubbleProps {
  message: ChatMessage;       // Objeto mensaje
  isOwn: boolean;            // Si es del usuario actual
  showTimestamp?: boolean;   // Default: true
}
```

### MessageInput Props
```typescript
interface MessageInputProps {
  onSend: (message: string) => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  sending?: boolean;
}
```

## RPC Function Returns

### get_or_create_conversation
```typescript
// Input: productId (UUID)
// Output: conversationId (UUID string)
// Throws: Si el usuario no tiene permisos
```

### send_message
```typescript
// Input: conversationId (UUID), body (text)
// Output: messageId (UUID string)
// Side effects: Crea notification, actualiza updated_at
```

### mark_conversation_read
```typescript
// Input: conversationId (UUID)
// Output: void
// Side effects: Actualiza last_read_at, marca notifications como read
```

### list_my_conversations
```typescript
// Input: (usa current_user_id de auth)
// Output: ConversationListItem[]
// Nota: Retorna conversaciones ordenadas por updated_at DESC
```

## Auth Types

```typescript
interface User {
  email: string;              // Email único del usuario
  id?: string;               // ID opcional (no usado en MVP)
  name?: string;             // Nombre del usuario
}

interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
  login(email: string): Promise<void>;
  logout(): void;
}
```

## Query Parameters

### URL Patterns

```
/messages                          // Bandeja (conversaciones list)
/messages/:conversationId          // Chat detail de una conversación
/messages?search=nombre            // Search en bandeja (frontend)
```

### Navigation

```typescript
// Desde ItemDetail al chat
navigate(`/messages/${conversationId}`);

// Desde bandeja al chat detail
navigate(`/messages/${conversation.conversation_id}`);

// Volver a bandeja
navigate('/messages');
```

## Database Schema References

### conversations table
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  owner_id TEXT NOT NULL,
  renter_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  owner_read_at TIMESTAMP,
  renter_read_at TIMESTAMP,
  
  UNIQUE(product_id, owner_id, renter_id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

### messages table
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
```

## Enums

### Notification Types
```typescript
type NotificationType = 
  | 'message'          // Nuevo mensaje en conversación
  | 'mention'          // Alguien te menciona
  | 'booking_request'  // Nueva solicitud de alquiler
  | 'booking_accepted' // Solicitud aceptada
  | 'booking_rejected' // Solicitud rechazada;
```

## Error Handling

```typescript
// Todos los servicios pueden lanzar:
interface ChatError extends Error {
  code?: 'PERMISSION_DENIED' | 'NOT_FOUND' | 'INVALID_INPUT' | 'NETWORK_ERROR';
  details?: Record<string, any>;
}

// Try-catch en componentes:
try {
  await sendMessage(body);
} catch (error) {
  if (error instanceof Error) {
    toast.error(error.message);
  }
}
```

## Constants

```typescript
// Límites
const MESSAGE_BATCH_SIZE = 50;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
const TYPING_DEBOUNCE_MS = 2000;

// Timeouts
const PRESENCE_TIMEOUT = 5000; // 5 segundos

// Colores (Tailwind)
const COLORS = {
  messageSent: 'bg-indigo-600 text-white',
  messageReceived: 'bg-slate-100 text-slate-900',
};
```

---

## Import Examples

```typescript
// From types.ts
import type {
  ChatMessage,
  Conversation,
  ConversationListItem,
  MessageAttachment,
  UserBlock,
  Notification
} from '../services/types';

// From chatService.ts
import { chatService } from '../services/chatService';

// From useChat hook
import { useChat } from '../hooks/useChat';

// Components
import { MessageBubble } from '../components/chat/MessageBubble';
import { MessageInput } from '../components/chat/MessageInput';
```

---

**Última actualización:** 2025-01-11
**Versión:** 1.0 (MVP)

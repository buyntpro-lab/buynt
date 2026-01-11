# Chat Components

Components relacionados con el sistema de mensajería de Buynt.

## Componentes

### MessageBubble
Renderiza un mensaje individual en el hilo de chat.

**Props:**
```typescript
interface Props {
  message: ChatMessage;      // Objeto mensaje completo
  isOwn: boolean;           // Si el mensaje es del usuario actual
  showTimestamp?: boolean;  // Mostrar tiempo relativo (default: true)
}
```

**Ejemplo:**
```tsx
<MessageBubble 
  message={message}
  isOwn={message.sender_id === user?.email}
/>
```

**Features:**
- Alineación left/right según sender
- Tiempo relativo en español ("hace 2 minutos")
- Read receipts (checkmarks)
- Colores: indigo para enviado, slate-100 para recibido

---

### MessageInput
Campo de entrada para componer mensajes.

**Props:**
```typescript
interface Props {
  onSend: (message: string) => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  sending?: boolean;
}
```

**Ejemplo:**
```tsx
<MessageInput 
  onSend={async (msg) => await sendMessage(msg)}
  onTyping={(typing) => trackPresence(typing)}
  disabled={!authenticated}
  sending={isSending}
/>
```

**Features:**
- Textarea auto-expandible
- Enter = enviar, Shift+Enter = nueva línea
- Typing indicator tracking (debounced 2s)
- Botón de adjuntos (placeholder)
- Spinner en botón Send mientras se envía
- Accessible (aria-labels)

---

## Integración con Hooks

Estos componentes están diseñados para usarse con el hook `useChat`:

```tsx
import { useChat } from '../../hooks/useChat';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';

export const ChatDetail: React.FC = ({ conversationId }) => {
  const { messages, sendMessage, loading, sending } = useChat(conversationId);

  return (
    <div>
      <div className="messages">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_id === user} />
        ))}
      </div>
      <MessageInput onSend={sendMessage} sending={sending} />
    </div>
  );
};
```

---

## Styling

Todos los componentes usan **Tailwind CSS** (sin CSS-in-JS).

**Colores:**
- Primary: `indigo-600` (enviado)
- Secondary: `slate-100` (recibido)
- Text: `slate-900` (oscuro), `slate-500` (secundario)

**Responsive:**
- Mobile: Stack vertical, full width
- Desktop: Bubble max-width: 28rem (lg:max-w-md)

---

## Futuros Desarrollos

- [ ] MessageAttachment - Mostrar archivos adjuntos (imágenes, etc.)
- [ ] AttachmentUpload - Subir archivos a Storage
- [ ] TypingIndicator - Componente separado para "escribiendo..."
- [ ] ReactionPicker - Reacciones emoji a mensajes
- [ ] VoiceMessage - Mensajes de voz

import React, { useRef, useEffect, useState } from 'react';
import { Send, Paperclip, Loader } from 'lucide-react';

interface Props {
  onSend: (message: string) => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  sending?: boolean;
}

export const MessageInput: React.FC<Props> = ({
  onSend,
  onTyping,
  disabled = false,
  sending = false,
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [text]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);

    // Notify typing
    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  const handleSend = async () => {
    if (!text.trim() || sending) return;

    const message = text.trim();
    setText('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      await onSend(message);
    } catch (err) {
      // Error handling is done in parent
      setText(message); // Restore text on error
    }

    if (onTyping) {
      onTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter, new line on Shift+Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-3 p-4 bg-white border-t border-slate-200">
      {/* Attach button (future) */}
      <button
        type="button"
        disabled={disabled || sending}
        className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-50 transition-colors"
        aria-label="Adjuntar archivo"
        title="Próximamente"
      >
        <Paperclip className="w-5 h-5" />
      </button>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Escribe un mensaje..."
        disabled={disabled || sending}
        rows={1}
        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg resize-none outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent disabled:opacity-50 transition-all max-h-[120px]"
      />

      {/* Send button */}
      <button
        type="button"
        onClick={handleSend}
        disabled={!text.trim() || disabled || sending}
        className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 transition-colors disabled:cursor-not-allowed flex items-center justify-center"
        aria-label="Enviar mensaje"
      >
        {sending ? (
          <Loader className="w-5 h-5 animate-spin" />
        ) : (
          <Send className="w-5 h-5" />
        )}
      </button>
    </div>
  );
};

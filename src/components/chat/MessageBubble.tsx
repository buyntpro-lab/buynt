import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, CheckCheck } from 'lucide-react';
import type { ChatMessage } from '../../services/types';

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  isRead?: boolean;
  showTimestamp?: boolean;
}

export const MessageBubble: React.FC<Props> = ({
  message,
  isOwn,
  isRead,
  showTimestamp = true,
}) => {
  const time = new Date(message.created_at);

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3 group`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isOwn
            ? 'bg-indigo-600 text-white rounded-br-none'
            : 'bg-slate-100 text-slate-900 rounded-bl-none'
        } break-words`}
      >
        <p className="text-sm leading-relaxed">{message.body}</p>

        {showTimestamp && (
          <div
            className={`text-xs mt-1 flex items-center gap-1 ${
              isOwn ? 'text-indigo-100' : 'text-slate-500'
            }`}
          >
            {formatDistanceToNow(time, { addSuffix: true, locale: es })}

            {isOwn && (
              <span>
                {isRead ? (
                  <CheckCheck className="w-3 h-3" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

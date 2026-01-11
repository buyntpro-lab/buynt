import React from 'react';
import { format } from 'date-fns';

interface MessageBase {
    id: string;
    body?: string;
    content?: string;
    created_at: string;
    sender_id: string;
}

interface ChatBubbleProps {
    message: MessageBase;
    isOwn: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isOwn }) => {
    const text = message.body || message.content || '';
    return (
        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-4`}>
            <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${isOwn
                        ? 'bg-teal-500 text-white rounded-tr-none'
                        : 'bg-gray-100 text-gray-800 rounded-tl-none'
                    }`}
            >
                {text}
            </div>
            <span className="text-xs text-gray-400 mt-1 px-1">
                {format(new Date(message.created_at), 'HH:mm')}
            </span>
        </div>
    );
};

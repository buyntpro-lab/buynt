import React from 'react';
import { format } from 'date-fns';

interface ChatBubbleProps {
    message: string;
    isOwn: boolean;
    timestamp: string;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isOwn, timestamp }) => {
    return (
        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-4`}>
            <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${isOwn
                        ? 'bg-teal-500 text-white rounded-tr-none'
                        : 'bg-gray-100 text-gray-800 rounded-tl-none'
                    }`}
            >
                {message}
            </div>
            <span className="text-xs text-gray-400 mt-1 px-1">
                {format(new Date(timestamp), 'HH:mm')}
            </span>
        </div>
    );
};

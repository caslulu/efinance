import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';

interface ChatMessageBubbleProps {
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt?: string;
}

export function ChatMessageBubble({ role, content, createdAt }: ChatMessageBubbleProps) {
  const isUser = role === 'USER';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-emerald-600 text-white'
            : 'bg-purple-600 text-white'
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-emerald-600 text-white rounded-tr-sm'
            : 'bg-muted text-foreground rounded-tl-sm'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-table:text-sm prose-td:px-2 prose-td:py-1 prose-th:px-2 prose-th:py-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
        {createdAt && (
          <p
            className={`text-[10px] mt-1 ${
              isUser ? 'text-emerald-200' : 'text-muted-foreground'
            }`}
          >
            {new Date(createdAt).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </div>
  );
}

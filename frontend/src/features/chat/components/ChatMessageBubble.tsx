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
        className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center shadow-md ${
          isUser
            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20'
            : 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-500/20'
        }`}
      >
        {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
      </div>

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-tr-md shadow-md shadow-emerald-500/15'
            : 'bg-muted/60 text-foreground rounded-tl-md backdrop-blur-sm'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:my-2.5 prose-table:text-sm prose-td:px-2 prose-td:py-1 prose-th:px-2 prose-th:py-1 prose-code:bg-black/10 dark:prose-code:bg-white/10 prose-code:rounded prose-code:px-1 prose-code:py-0.5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
        {createdAt && (
          <p
            className={`text-[10px] mt-1.5 ${
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

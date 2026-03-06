import { Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-purple-600 text-white">
        <Bot size={16} />
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-3 bg-muted text-foreground">
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
        <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse ml-0.5 rounded-sm" />
      </div>
    </div>
  );
}

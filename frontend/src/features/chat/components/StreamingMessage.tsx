import { Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md shadow-purple-500/20">
        <Bot size={16} className="text-white" />
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-tl-md px-4 py-3 bg-muted/60 text-foreground backdrop-blur-sm">
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:my-2.5 prose-code:bg-black/10 dark:prose-code:bg-white/10 prose-code:rounded prose-code:px-1 prose-code:py-0.5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
        <span className="inline-block w-2 h-4 bg-gradient-to-t from-purple-500 to-indigo-400 animate-pulse ml-0.5 rounded-sm" />
      </div>
    </div>
  );
}

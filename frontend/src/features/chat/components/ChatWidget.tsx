import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles, Maximize2 } from 'lucide-react';
import { sendMessageStream } from '@/hooks/useChat';
import { queryKeys } from '@/lib/queryClient';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ChatInput } from './ChatInput';
import { StreamingMessage } from './StreamingMessage';
import type { ChatMessage } from '@/types/Chat';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const handleSend = async (message: string) => {
    if (isStreaming) return;

    const userMsg: ChatMessage = {
      id: Date.now(),
      conversation_id: conversationId || 0,
      role: 'USER',
      content: message,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent('');

    await sendMessageStream(
      message,
      conversationId,
      (chunk) => setStreamingContent((prev) => prev + chunk),
      (newConvId) => setConversationId(newConvId),
      () => {
        setIsStreaming(false);
        // Add assistant message from streaming content
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            conversation_id: conversationId || 0,
            role: 'ASSISTANT',
            content: '',
            created_at: new Date().toISOString(),
          },
        ]);
        // We'll set the content via a ref trick
        setStreamingContent((finalContent) => {
          setMessages((prev) => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg && lastMsg.role === 'ASSISTANT') {
              lastMsg.content = finalContent;
            }
            return updated;
          });
          return '';
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.chatConversations });
      },
      () => {
        setIsStreaming(false);
        setStreamingContent('');
      },
    );
  };

  const handleOpenFull = () => {
    setIsOpen(false);
    navigate('/chat');
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <button
            className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-emerald-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
            aria-label="Assistente IA"
          >
            <Sparkles size={24} />
          </button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-full sm:w-[420px] p-0 flex flex-col"
        >
          <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between shrink-0">
            <SheetTitle className="text-base flex items-center gap-2">
              <Sparkles size={18} className="text-purple-600" />
              Assistente Financeiro
            </SheetTitle>
            <button
              onClick={handleOpenFull}
              className="p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
              title="Abrir chat completo"
            >
              <Maximize2 size={16} />
            </button>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
            {messages.length === 0 && !isStreaming && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-sm gap-2">
                <Sparkles size={32} className="text-purple-500 opacity-50" />
                <p>Pergunte sobre suas finanças!</p>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((msg) => (
                <ChatMessageBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                />
              ))}
              {isStreaming && streamingContent && (
                <StreamingMessage content={streamingContent} />
              )}
              {isStreaming && !streamingContent && (
                <div className="flex gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-purple-600 text-white">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                  <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-muted text-muted-foreground text-sm">
                    Analisando...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="px-4 py-3 border-t shrink-0">
            <ChatInput
              onSend={handleSend}
              disabled={isStreaming}
              placeholder="Pergunte algo..."
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

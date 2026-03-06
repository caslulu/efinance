import { useState, useRef, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConversations, useConversation, useDeleteConversation, sendMessageStream } from '@/hooks/useChat';
import { queryKeys } from '@/lib/queryClient';
import { ChatMessageBubble } from '../components/ChatMessageBubble';
import { ChatInput } from '../components/ChatInput';
import { StreamingMessage } from '../components/StreamingMessage';
import { SuggestedQuestions } from '../components/SuggestedQuestions';
import { ConversationSidebar } from '../components/ConversationSidebar';
import { MessageSquare, PanelLeftClose, PanelLeft } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export function ChatPage() {
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: conversations = [] } = useConversations();
  const { data: activeConversation } = useConversation(activeConversationId);
  const deleteConversation = useDeleteConversation();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages, streamingContent, scrollToBottom]);

  const handleSend = async (message: string) => {
    if (isStreaming) return;

    setIsStreaming(true);
    setStreamingContent('');

    // Optimistically add user message to conversation
    if (activeConversation) {
      queryClient.setQueryData(
        queryKeys.chatConversation(activeConversationId!),
        {
          ...activeConversation,
          messages: [
            ...activeConversation.messages,
            {
              id: Date.now(),
              conversation_id: activeConversationId!,
              role: 'USER' as const,
              content: message,
              created_at: new Date().toISOString(),
            },
          ],
        },
      );
    }

    await sendMessageStream(
      message,
      activeConversationId,
      // onChunk
      (chunk) => {
        setStreamingContent((prev) => prev + chunk);
      },
      // onMeta
      (conversationId) => {
        if (!activeConversationId) {
          setActiveConversationId(conversationId);
        }
      },
      // onDone
      () => {
        setIsStreaming(false);
        setStreamingContent('');
        // Refetch conversation to get saved messages
        queryClient.invalidateQueries({ queryKey: queryKeys.chatConversations });
        if (activeConversationId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.chatConversation(activeConversationId),
          });
        }
      },
      // onError
      () => {
        setIsStreaming(false);
        setStreamingContent('');
      },
    );
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setStreamingContent('');
    setMobileSidebarOpen(false);
  };

  const handleSelectConversation = (id: number) => {
    setActiveConversationId(id);
    setStreamingContent('');
    setMobileSidebarOpen(false);
  };

  const handleDeleteConversation = (id: number) => {
    deleteConversation.mutate(id);
    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
  };

  const messages = activeConversation?.messages || [];
  const showSuggestions = !activeConversationId && messages.length === 0 && !isStreaming;

  return (
    <div className="flex h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] -m-4 lg:-m-8 bg-background">
      {/* Desktop Sidebar */}
      {sidebarOpen && (
        <div className="hidden lg:flex w-72 border-r bg-card flex-col">
          <ConversationSidebar
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
            onDelete={handleDeleteConversation}
          />
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="h-14 border-b flex items-center gap-3 px-4 bg-card shrink-0">
          {/* Desktop toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
          >
            {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
          </button>

          {/* Mobile sidebar trigger */}
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetTrigger asChild>
              <button className="lg:hidden p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
                <MessageSquare size={20} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Conversas</SheetTitle>
              </SheetHeader>
              <ConversationSidebar
                conversations={conversations}
                activeId={activeConversationId}
                onSelect={handleSelectConversation}
                onNew={handleNewConversation}
                onDelete={handleDeleteConversation}
              />
            </SheetContent>
          </Sheet>

          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">
              {activeConversation?.title || 'Nova Conversa'}
            </h2>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar">
          {showSuggestions ? (
            <SuggestedQuestions onSelect={handleSend} />
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => (
                <ChatMessageBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  createdAt={msg.created_at}
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
                    Analisando seus dados financeiros...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t bg-card shrink-0">
          <div className="max-w-3xl mx-auto">
            <ChatInput onSend={handleSend} disabled={isStreaming} />
          </div>
        </div>
      </div>
    </div>
  );
}

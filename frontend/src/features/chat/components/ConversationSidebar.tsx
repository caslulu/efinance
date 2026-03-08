import { MessageSquare, Trash2, Plus, Sparkles } from 'lucide-react';
import type { ChatConversationPreview } from '@/types/Chat';

interface ConversationSidebarProps {
  conversations: ChatConversationPreview[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: ConversationSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <button
          onClick={onNew}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 text-sm font-semibold shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30"
        >
          <Plus size={18} />
          Nova Conversa
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <div className="p-3 rounded-xl bg-muted/50 mb-3">
              <Sparkles size={20} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Nenhuma conversa ainda
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Comece perguntando algo
            </p>
          </div>
        )}

        <div className="p-2 space-y-1">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full flex items-start gap-3 px-3 py-3 text-left rounded-xl transition-all duration-300 group ${
                activeId === conv.id
                  ? 'bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/25 dark:to-indigo-900/25 shadow-sm'
                  : 'hover:bg-muted/60'
              }`}
            >
              <MessageSquare
                size={16}
                className={`shrink-0 mt-0.5 ${
                  activeId === conv.id
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-muted-foreground'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-semibold truncate ${
                    activeId === conv.id
                      ? 'text-purple-700 dark:text-purple-300'
                      : 'text-foreground'
                  }`}
                >
                  {conv.title || 'Nova conversa'}
                </p>
                {conv.messages[0] && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.messages[0].content.substring(0, 50)}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  {new Date(conv.updated_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                className="shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-all duration-200"
              >
                <Trash2 size={13} />
              </button>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

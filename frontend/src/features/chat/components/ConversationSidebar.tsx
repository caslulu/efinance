import { MessageSquare, Trash2, Plus } from 'lucide-react';
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
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          Nova Conversa
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {conversations.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhuma conversa ainda
          </div>
        )}

        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-accent transition-colors group border-b border-border/50 ${
              activeId === conv.id
                ? 'bg-emerald-50 dark:bg-emerald-900/20'
                : ''
            }`}
          >
            <MessageSquare
              size={18}
              className={`shrink-0 mt-0.5 ${
                activeId === conv.id
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium truncate ${
                  activeId === conv.id
                    ? 'text-emerald-700 dark:text-emerald-300'
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
              <p className="text-[10px] text-muted-foreground mt-1">
                {new Date(conv.updated_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}

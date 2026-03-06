import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/api';
import { queryKeys } from '@/lib/queryClient';
import type { ChatConversation, ChatConversationPreview, ChatStreamEvent } from '@/types/Chat';

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.chatConversations,
    queryFn: async () => {
      const res = await api.get<ChatConversationPreview[]>('/chat/conversations');
      return res.data;
    },
  });
}

export function useConversation(id: number | null) {
  return useQuery({
    queryKey: queryKeys.chatConversation(id ?? 0),
    queryFn: async () => {
      const res = await api.get<ChatConversation>(`/chat/conversations/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/chat/conversations/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chatConversations });
    },
  });
}

export async function sendMessageStream(
  message: string,
  conversationId: number | null,
  onChunk: (chunk: string) => void,
  onMeta: (conversationId: number) => void,
  onDone: () => void,
  onError: (error: string) => void,
) {
  const token =
    localStorage.getItem('session_token') ||
    sessionStorage.getItem('session_token');

  const apiBaseUrl = (
    import.meta.env.VITE_API_URL || 'http://localhost:3000'
  ).replace(/\/+$/, '');

  const response = await fetch(`${apiBaseUrl}/chat/messages/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({
      message,
      ...(conversationId ? { conversationId } : {}),
    }),
  });

  if (!response.ok) {
    onError('Erro ao enviar mensagem');
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError('Streaming não suportado');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data: ChatStreamEvent = JSON.parse(line.slice(6));
          switch (data.type) {
            case 'meta':
              if (data.conversationId) onMeta(data.conversationId);
              break;
            case 'chunk':
              if (data.content) onChunk(data.content);
              break;
            case 'done':
              onDone();
              break;
            case 'error':
              onError(data.message || 'Erro desconhecido');
              break;
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  }
}

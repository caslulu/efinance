export interface ChatMessage {
  id: number;
  conversation_id: number;
  role: 'USER' | 'ASSISTANT';
  content: string;
  created_at: string;
}

export interface ChatConversation {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

export interface ChatConversationPreview {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages: Pick<ChatMessage, 'content' | 'role' | 'created_at'>[];
}

export interface ChatResponse {
  conversationId: number;
  message: string;
}

export interface ChatStreamEvent {
  type: 'meta' | 'chunk' | 'done' | 'error';
  conversationId?: number;
  content?: string;
  message?: string;
}

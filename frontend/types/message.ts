export enum ConversationType {
  CHANNEL = "CHANNEL",
  DIRECT = "DIRECT",
  GROUP = "GROUP",
}

export interface Conversation {
  id: string;
  name: string | null;
  type: ConversationType;
  is_default: boolean;
  created_by_id: string | null;
  member_ids: string[];
  member_names: string[];
  last_message: string | null;
  last_message_at: string | null;
  last_message_by: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface MessageReaction {
  id: string;
  emoji: string;
  user_id: string;
  user_name: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  content: string;
  reply_to_id: string | null;
  reply_count: number;
  edited_at: string | null;
  reactions: MessageReaction[];
  created_at: string;
}

export interface ThreadData {
  parent: ChatMessage;
  replies: ChatMessage[];
}

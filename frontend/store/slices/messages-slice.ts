import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

import apiClient from "@/lib/api-client";
import { extractErrorMessage } from "@/lib/error-handler";
import { ApiResponse } from "@/types/api";
import { ChatMessage, Conversation, ConversationType, ThreadData } from "@/types/message";

interface PaginatedMessages {
  messages: ChatMessage[];
  has_more: boolean;
}

interface MessagesState {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  messages: ChatMessage[];
  hasMoreMessages: boolean;
  loadingOlder: boolean;
  threadParent: ChatMessage | null;
  threadReplies: ChatMessage[];
  threadLoading: boolean;
  unreadTotal: number;
  loading: boolean;
  messagesLoading: boolean;
  sendingMessage: boolean;
  error: string | null;
}

const initialState: MessagesState = {
  conversations: [],
  selectedConversation: null,
  messages: [],
  hasMoreMessages: false,
  loadingOlder: false,
  threadParent: null,
  threadReplies: [],
  threadLoading: false,
  unreadTotal: 0,
  loading: false,
  messagesLoading: false,
  sendingMessage: false,
  error: null,
};

export const fetchConversations = createAsyncThunk(
  "messages/fetchConversations",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get<ApiResponse<Conversation[]>>(
        "/api/messages/conversations",
      );
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchMessages = createAsyncThunk(
  "messages/fetchMessages",
  async (conversationId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.get<ApiResponse<PaginatedMessages>>(
        `/api/messages/conversations/${conversationId}/messages`,
      );
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchOlderMessages = createAsyncThunk(
  "messages/fetchOlderMessages",
  async (
    { conversationId, before }: { conversationId: string; before: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await apiClient.get<ApiResponse<PaginatedMessages>>(
        `/api/messages/conversations/${conversationId}/messages`,
        { params: { before } },
      );
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const createConversation = createAsyncThunk(
  "messages/createConversation",
  async (
    data: { name?: string; type: ConversationType; member_ids: string[] },
    { rejectWithValue },
  ) => {
    try {
      const response = await apiClient.post<ApiResponse<Conversation>>(
        "/api/messages/conversations",
        data,
      );
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const sendMessage = createAsyncThunk(
  "messages/sendMessage",
  async (
    { conversationId, content }: { conversationId: string; content: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await apiClient.post<ApiResponse<ChatMessage>>(
        `/api/messages/conversations/${conversationId}/messages`,
        { content },
      );
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const markAsRead = createAsyncThunk(
  "messages/markAsRead",
  async (conversationId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.post<ApiResponse<null>>(
        `/api/messages/conversations/${conversationId}/read`,
      );
      if (response.data.success) {
        return conversationId;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchUnreadCount = createAsyncThunk(
  "messages/fetchUnreadCount",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get<ApiResponse<{ total: number }>>(
        "/api/messages/unread-count",
      );
      if (response.data.success) {
        return response.data.data.total;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const editMessage = createAsyncThunk(
  "messages/editMessage",
  async (
    { messageId, content }: { messageId: string; content: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await apiClient.patch<ApiResponse<ChatMessage>>(
        `/api/messages/messages/${messageId}`,
        { content },
      );
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const deleteMessage = createAsyncThunk(
  "messages/deleteMessage",
  async (messageId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.delete<ApiResponse<null>>(
        `/api/messages/messages/${messageId}`,
      );
      if (response.data.success) {
        return messageId;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const toggleReaction = createAsyncThunk(
  "messages/toggleReaction",
  async (
    { messageId, emoji }: { messageId: string; emoji: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await apiClient.post<ApiResponse<ChatMessage>>(
        `/api/messages/messages/${messageId}/reactions`,
        { emoji },
      );
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchThread = createAsyncThunk(
  "messages/fetchThread",
  async (
    { conversationId, messageId }: { conversationId: string; messageId: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await apiClient.get<ApiResponse<ThreadData>>(
        `/api/messages/conversations/${conversationId}/messages/${messageId}/replies`,
      );
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const sendReply = createAsyncThunk(
  "messages/sendReply",
  async (
    {
      conversationId,
      content,
      replyToId,
    }: { conversationId: string; content: string; replyToId: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await apiClient.post<ApiResponse<ChatMessage>>(
        `/api/messages/conversations/${conversationId}/messages`,
        { content, reply_to_id: replyToId },
      );
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const deleteConversation = createAsyncThunk(
  "messages/deleteConversation",
  async (conversationId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.delete<ApiResponse<null>>(
        `/api/messages/conversations/${conversationId}`,
      );
      if (response.data.success) {
        return conversationId;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

const messagesSlice = createSlice({
  name: "messages",
  initialState,
  reducers: {
    setSelectedConversation: (state, action: PayloadAction<Conversation | null>) => {
      state.selectedConversation = action.payload;
    },
    messageReceived: (state, action: PayloadAction<ChatMessage>) => {
      if (action.payload.reply_to_id) {
        if (
          state.threadParent?.id === action.payload.reply_to_id
        ) {
          const exists = state.threadReplies.some((m) => m.id === action.payload.id);
          if (!exists) {
            state.threadReplies.push(action.payload);
            const parentIdx = state.messages.findIndex(
              (m) => m.id === action.payload.reply_to_id,
            );
            if (parentIdx !== -1) {
              state.messages[parentIdx].reply_count = state.threadReplies.length;
            }
          }
        } else {
          const parentIdx = state.messages.findIndex(
            (m) => m.id === action.payload.reply_to_id,
          );
          if (parentIdx !== -1) {
            state.messages[parentIdx].reply_count += 1;
          }
        }
      } else if (
        state.selectedConversation &&
        state.selectedConversation.id === action.payload.conversation_id
      ) {
        const exists = state.messages.some((m) => m.id === action.payload.id);
        if (!exists) {
          state.messages.push(action.payload);
        }
      }

      const convIndex = state.conversations.findIndex(
        (c) => c.id === action.payload.conversation_id,
      );
      if (convIndex !== -1) {
        state.conversations[convIndex].last_message = action.payload.content;
        state.conversations[convIndex].last_message_at = action.payload.created_at;
        state.conversations[convIndex].last_message_by = action.payload.user_name;
        state.conversations[convIndex].updated_at = action.payload.created_at;

        const isViewingThis =
          state.selectedConversation?.id === action.payload.conversation_id;
        const isObserving = state.conversations[convIndex].is_observing;
        if (!isViewingThis && !isObserving) {
          state.conversations[convIndex].unread_count += 1;
          state.unreadTotal += 1;
        }

        const [conv] = state.conversations.splice(convIndex, 1);
        state.conversations.unshift(conv);
      }
    },
    conversationCreated: (state, action: PayloadAction<Conversation>) => {
      const exists = state.conversations.some((c) => c.id === action.payload.id);
      if (!exists) {
        state.conversations.unshift(action.payload);
      }
    },
    conversationDeleted: (state, action: PayloadAction<string>) => {
      state.conversations = state.conversations.filter((c) => c.id !== action.payload);
      if (state.selectedConversation?.id === action.payload) {
        state.selectedConversation = null;
        state.messages = [];
      }
    },
    conversationMemberRemoved: (
      state,
      action: PayloadAction<{ conversation_id: string; user_id: string }>,
    ) => {
      const { conversation_id, user_id } = action.payload;
      const idx = state.conversations.findIndex((c) => c.id === conversation_id);
      if (idx !== -1) {
        const conv = state.conversations[idx];
        const memberIdx = conv.member_ids.indexOf(user_id);
        if (memberIdx !== -1) {
          conv.member_ids.splice(memberIdx, 1);
          conv.member_names.splice(memberIdx, 1);
        }
      }
      if (state.selectedConversation?.id === conversation_id) {
        const memberIdx = state.selectedConversation.member_ids.indexOf(user_id);
        if (memberIdx !== -1) {
          state.selectedConversation.member_ids.splice(memberIdx, 1);
          state.selectedConversation.member_names.splice(memberIdx, 1);
        }
      }
    },
    messageUpdated: (state, action: PayloadAction<ChatMessage>) => {
      const idx = state.messages.findIndex((m) => m.id === action.payload.id);
      if (idx !== -1) {
        const existing = state.messages[idx];
        state.messages[idx] = {
          ...action.payload,
          reply_count: action.payload.reply_count || existing.reply_count,
        };
      }
    },
    messageDeleted: (state, action: PayloadAction<{ id: string; conversation_id: string }>) => {
      state.messages = state.messages.filter((m) => m.id !== action.payload.id);
    },
    messageReactionsUpdated: (state, action: PayloadAction<ChatMessage>) => {
      const idx = state.messages.findIndex((m) => m.id === action.payload.id);
      if (idx !== -1) {
        state.messages[idx].reactions = action.payload.reactions;
      }
      if (state.threadParent?.id === action.payload.id) {
        state.threadParent.reactions = action.payload.reactions;
      }
      const tIdx = state.threadReplies.findIndex((m) => m.id === action.payload.id);
      if (tIdx !== -1) {
        state.threadReplies[tIdx].reactions = action.payload.reactions;
      }
    },
    optimisticToggleReaction: (
      state,
      action: PayloadAction<{ messageId: string; emoji: string; userId: string; userName: string }>,
    ) => {
      const { messageId, emoji, userId, userName } = action.payload;

      function applyToggle(msg: ChatMessage): void {
        const existingIdx = msg.reactions.findIndex(
          (r) => r.emoji === emoji && r.user_id === userId,
        );
        if (existingIdx !== -1) {
          msg.reactions.splice(existingIdx, 1);
        } else {
          msg.reactions.push({ id: crypto.randomUUID(), emoji, user_id: userId, user_name: userName });
        }
      }

      const idx = state.messages.findIndex((m) => m.id === messageId);
      if (idx !== -1) {
        applyToggle(state.messages[idx]);
      }
      if (state.threadParent?.id === messageId) {
        applyToggle(state.threadParent);
      }
      const tIdx = state.threadReplies.findIndex((m) => m.id === messageId);
      if (tIdx !== -1) {
        applyToggle(state.threadReplies[tIdx]);
      }
    },
    closeThread: (state) => {
      state.threadParent = null;
      state.threadReplies = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.loading = false;
        state.conversations = action.payload;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchMessages.pending, (state) => {
        state.messagesLoading = true;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.messagesLoading = false;
        state.messages = action.payload.messages;
        state.hasMoreMessages = action.payload.has_more;
      })
      .addCase(fetchMessages.rejected, (state) => {
        state.messagesLoading = false;
      })
      .addCase(fetchOlderMessages.pending, (state) => {
        state.loadingOlder = true;
      })
      .addCase(fetchOlderMessages.fulfilled, (state, action) => {
        state.loadingOlder = false;
        state.messages = [...action.payload.messages, ...state.messages];
        state.hasMoreMessages = action.payload.has_more;
      })
      .addCase(fetchOlderMessages.rejected, (state) => {
        state.loadingOlder = false;
      })
      .addCase(createConversation.fulfilled, (state, action) => {
        const exists = state.conversations.some((c) => c.id === action.payload.id);
        if (!exists) {
          state.conversations.unshift(action.payload);
        }
      })
      .addCase(sendMessage.pending, (state) => {
        state.sendingMessage = true;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.sendingMessage = false;
        const exists = state.messages.some((m) => m.id === action.payload.id);
        if (!exists) {
          state.messages.push(action.payload);
        }

        const convIndex = state.conversations.findIndex(
          (c) => c.id === action.payload.conversation_id,
        );
        if (convIndex !== -1) {
          state.conversations[convIndex].last_message = action.payload.content;
          state.conversations[convIndex].last_message_at = action.payload.created_at;
          state.conversations[convIndex].last_message_by = action.payload.user_name;

          const [conv] = state.conversations.splice(convIndex, 1);
          state.conversations.unshift(conv);
        }
      })
      .addCase(sendMessage.rejected, (state) => {
        state.sendingMessage = false;
      })
      .addCase(markAsRead.fulfilled, (state, action) => {
        const conv = state.conversations.find((c) => c.id === action.payload);
        if (conv) {
          state.unreadTotal = Math.max(0, state.unreadTotal - conv.unread_count);
          conv.unread_count = 0;
        }
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadTotal = action.payload;
      })
      .addCase(editMessage.fulfilled, (state, action) => {
        const idx = state.messages.findIndex((m) => m.id === action.payload.id);
        if (idx !== -1) {
          const existing = state.messages[idx];
          state.messages[idx] = {
            ...action.payload,
            reply_count: action.payload.reply_count || existing.reply_count,
          };
        }
      })
      .addCase(deleteMessage.fulfilled, (state, action) => {
        state.messages = state.messages.filter((m) => m.id !== action.payload);
      })
      .addCase(toggleReaction.fulfilled, () => {
      })
      .addCase(fetchThread.pending, (state) => {
        state.threadLoading = true;
      })
      .addCase(fetchThread.fulfilled, (state, action) => {
        state.threadLoading = false;
        state.threadParent = action.payload.parent;
        state.threadReplies = action.payload.replies;
      })
      .addCase(fetchThread.rejected, (state) => {
        state.threadLoading = false;
      })
      .addCase(sendReply.fulfilled, (state, action) => {
        const exists = state.threadReplies.some((m) => m.id === action.payload.id);
        if (!exists) {
          state.threadReplies.push(action.payload);
        }
        const parentIdx = state.messages.findIndex(
          (m) => m.id === action.payload.reply_to_id,
        );
        if (parentIdx !== -1) {
          state.messages[parentIdx].reply_count = state.threadReplies.length;
        }
      })
      .addCase(deleteConversation.fulfilled, (state, action) => {
        state.conversations = state.conversations.filter((c) => c.id !== action.payload);
        if (state.selectedConversation?.id === action.payload) {
          state.selectedConversation = null;
          state.messages = [];
        }
      });
  },
});

export const {
  setSelectedConversation,
  messageReceived,
  messageUpdated,
  messageDeleted,
  messageReactionsUpdated,
  optimisticToggleReaction,
  closeThread,
  conversationCreated,
  conversationDeleted,
  conversationMemberRemoved,
} = messagesSlice.actions;

export default messagesSlice.reducer;

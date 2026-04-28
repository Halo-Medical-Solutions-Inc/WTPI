import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import apiClient from "@/lib/api-client";
import { ApiResponse } from "@/types/api";

export interface MentionItem {
  id: string;
  source: "call_comment" | "message" | "call_activity_comment" | "call_activity_review" | "call_activity_flag";
  mentioned_by: string;
  mentioned_by_name: string;
  content: string;
  is_read: boolean;
  created_at: string;
  call_id?: string;
  comment_id?: string;
  caller_name?: string;
  phone_number?: string;
  conversation_id?: string;
  message_id?: string;
  conversation_name?: string | null;
}

interface MentionsState {
  unreadCount: number;
  mentions: MentionItem[];
  loading: boolean;
}

const initialState: MentionsState = {
  unreadCount: 0,
  mentions: [],
  loading: false,
};

export const fetchUnreadMentionCount = createAsyncThunk(
  "mentions/fetchUnreadCount",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get<ApiResponse<{ count: number }>>("/api/mentions/unread-count");
      return response.data.data!.count;
    } catch {
      return rejectWithValue("Failed to fetch mention count");
    }
  }
);

export const fetchMentions = createAsyncThunk(
  "mentions/fetchMentions",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get<ApiResponse<MentionItem[]>>("/api/mentions");
      return response.data.data!;
    } catch {
      return rejectWithValue("Failed to fetch mentions");
    }
  }
);

export const markMentionRead = createAsyncThunk(
  "mentions/markRead",
  async (mentionId: string, { rejectWithValue }) => {
    try {
      await apiClient.post<ApiResponse<null>>(`/api/mentions/${mentionId}/read`);
      return mentionId;
    } catch {
      return rejectWithValue("Failed to mark mention as read");
    }
  }
);

export const markMentionUnread = createAsyncThunk(
  "mentions/markUnread",
  async (mentionId: string, { rejectWithValue }) => {
    try {
      await apiClient.post<ApiResponse<null>>(`/api/mentions/${mentionId}/unread`);
      return mentionId;
    } catch {
      return rejectWithValue("Failed to mark mention as unread");
    }
  }
);

export const markAllMentionsRead = createAsyncThunk(
  "mentions/markAllRead",
  async (_, { rejectWithValue }) => {
    try {
      await apiClient.post<ApiResponse<{ count: number }>>("/api/mentions/read-all");
      return true;
    } catch {
      return rejectWithValue("Failed to mark all as read");
    }
  }
);

export const dismissMention = createAsyncThunk(
  "mentions/dismiss",
  async (mentionId: string, { rejectWithValue }) => {
    try {
      await apiClient.delete<ApiResponse<null>>(`/api/mentions/${mentionId}`);
      return mentionId;
    } catch {
      return rejectWithValue("Failed to dismiss mention");
    }
  }
);

export const clearAllMentions = createAsyncThunk(
  "mentions/clearAll",
  async (_, { rejectWithValue }) => {
    try {
      await apiClient.delete<ApiResponse<{ count: number }>>("/api/mentions");
      return true;
    } catch {
      return rejectWithValue("Failed to clear mentions");
    }
  }
);

const mentionsSlice = createSlice({
  name: "mentions",
  initialState,
  reducers: {
    incrementUnreadCount(state) {
      state.unreadCount += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUnreadMentionCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })
      .addCase(fetchMentions.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMentions.fulfilled, (state, action) => {
        state.mentions = action.payload;
        state.loading = false;
      })
      .addCase(fetchMentions.rejected, (state) => {
        state.loading = false;
      })
      .addCase(markMentionRead.fulfilled, (state, action) => {
        const mention = state.mentions.find((m) => m.id === action.payload);
        if (mention && !mention.is_read) {
          mention.is_read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markMentionUnread.fulfilled, (state, action) => {
        const mention = state.mentions.find((m) => m.id === action.payload);
        if (mention && mention.is_read) {
          mention.is_read = false;
          state.unreadCount += 1;
        }
      })
      .addCase(markAllMentionsRead.fulfilled, (state) => {
        state.mentions.forEach((m) => {
          m.is_read = true;
        });
        state.unreadCount = 0;
      })
      .addCase(dismissMention.fulfilled, (state, action) => {
        const mention = state.mentions.find((m) => m.id === action.payload);
        if (mention && !mention.is_read) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.mentions = state.mentions.filter((m) => m.id !== action.payload);
      })
      .addCase(clearAllMentions.fulfilled, (state) => {
        state.mentions = [];
        state.unreadCount = 0;
      });
  },
});

export const { incrementUnreadCount } = mentionsSlice.actions;
export default mentionsSlice.reducer;

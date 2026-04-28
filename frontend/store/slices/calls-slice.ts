import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

import apiClient from "@/lib/api-client";
import { localDateToUtcEndOfDay, localDateToUtcStartOfDay } from "@/lib/date-utils";
import { extractErrorMessage } from "@/lib/error-handler";
import { ApiResponse } from "@/types/api";
import { CallDetail, CallSearchRequest, CallSearchResult, CallStatus } from "@/types/call";

interface CallsState {
  calls: CallDetail[];
  selectedCall: CallDetail | null;
  loading: boolean;
  detailLoading: boolean;
  error: string | null;
}

const initialState: CallsState = {
  calls: [],
  selectedCall: null,
  loading: false,
  detailLoading: false,
  error: null,
};

interface FetchCallsParams {
  start_date?: string;
  end_date?: string;
  status?: CallStatus;
  is_reviewed?: boolean;
  limit?: number;
  offset?: number;
}

export const fetchCalls = createAsyncThunk(
  "calls/fetchCalls",
  async (params: FetchCallsParams, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.start_date) queryParams.append("start_date", params.start_date);
      if (params.end_date) queryParams.append("end_date", params.end_date);
      if (params.status) queryParams.append("status", params.status);
      if (params.is_reviewed !== undefined) queryParams.append("is_reviewed", String(params.is_reviewed));
      if (params.limit) queryParams.append("limit", String(params.limit));
      if (params.offset) queryParams.append("offset", String(params.offset));

      const response = await apiClient.get<ApiResponse<CallDetail[]>>(`/api/calls?${queryParams}`);
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const fetchCallsForDateRange = createAsyncThunk(
  "calls/fetchCallsForDateRange",
  async (dates: string[], { rejectWithValue }) => {
    try {
      const sortedDates = [...dates].sort();
      const startDate = sortedDates[0];
      const endDate = sortedDates[sortedDates.length - 1];

      const queryParams = new URLSearchParams();
      queryParams.append("start_date", localDateToUtcStartOfDay(startDate));
      queryParams.append("end_date", localDateToUtcEndOfDay(endDate));

      const response = await apiClient.get<ApiResponse<CallDetail[]>>(`/api/calls?${queryParams}`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return [];
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const fetchCallDetail = createAsyncThunk(
  "calls/fetchCallDetail",
  async (callId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.get<ApiResponse<CallDetail>>(`/api/calls/${callId}`);
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const updateReviewStatus = createAsyncThunk(
  "calls/updateReviewStatus",
  async ({ callId, isReviewed }: { callId: string; isReviewed: boolean }, { rejectWithValue }) => {
    try {
      const response = await apiClient.patch<ApiResponse<CallDetail>>(`/api/calls/${callId}/review`, {
        is_reviewed: isReviewed,
      });
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const searchCalls = createAsyncThunk(
  "calls/searchCalls",
  async (request: CallSearchRequest, { rejectWithValue }) => {
    try {
      const response = await apiClient.post<ApiResponse<CallSearchResult>>("/api/calls/search", request);
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const deleteCall = createAsyncThunk(
  "calls/deleteCall",
  async (callId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.delete<ApiResponse<null>>(`/api/calls/${callId}`);
      if (response.data.success) {
        return callId;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

const callsSlice = createSlice({
  name: "calls",
  initialState,
  reducers: {
    setSelectedCall: (state, action: PayloadAction<CallDetail | null>) => {
      state.selectedCall = action.payload;
    },
    clearSelectedCall: (state) => {
      state.selectedCall = null;
    },
    addCall: (state, action: PayloadAction<CallDetail>) => {
      const exists = state.calls.some((c) => c.id === action.payload.id);
      if (!exists) {
        state.calls.unshift(action.payload);
      }
    },
    updateCall: (state, action: PayloadAction<Partial<CallDetail> & { id: string }>) => {
      const index = state.calls.findIndex((c) => c.id === action.payload.id);
      if (index !== -1) {
        state.calls[index] = { ...state.calls[index], ...action.payload };
      }
      if (state.selectedCall?.id === action.payload.id) {
        state.selectedCall = { ...state.selectedCall, ...action.payload };
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    removeCall: (state, action: PayloadAction<string>) => {
      state.calls = state.calls.filter((c) => c.id !== action.payload);
      if (state.selectedCall?.id === action.payload) {
        state.selectedCall = null;
      }
    },
    setCalls: (state, action: PayloadAction<CallDetail[]>) => {
      state.calls = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCalls.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCalls.fulfilled, (state, action) => {
        state.loading = false;
        state.calls = action.payload;
      })
      .addCase(fetchCalls.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchCallsForDateRange.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCallsForDateRange.fulfilled, (state, action) => {
        state.loading = false;
        state.calls = action.payload;
      })
      .addCase(fetchCallsForDateRange.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchCallDetail.pending, (state) => {
        state.detailLoading = true;
      })
      .addCase(fetchCallDetail.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.selectedCall = action.payload;
        const index = state.calls.findIndex((c) => c.id === action.payload.id);
        if (index !== -1) {
          state.calls[index] = action.payload;
        }
      })
      .addCase(fetchCallDetail.rejected, (state) => {
        state.detailLoading = false;
      })
      .addCase(updateReviewStatus.fulfilled, (state, action) => {
        const index = state.calls.findIndex((c) => c.id === action.payload.id);
        if (index !== -1) {
          state.calls[index] = action.payload;
        }
        if (state.selectedCall?.id === action.payload.id) {
          state.selectedCall = action.payload;
        }
      })
      .addCase(searchCalls.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchCalls.fulfilled, (state, action) => {
        state.loading = false;
        state.calls = action.payload.calls;
      })
      .addCase(searchCalls.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(deleteCall.fulfilled, (state, action) => {
        state.calls = state.calls.filter((c) => c.id !== action.payload);
        if (state.selectedCall?.id === action.payload) {
          state.selectedCall = null;
        }
      });
  },
});

export const { setSelectedCall, clearSelectedCall, addCall, updateCall, clearError, removeCall, setCalls } =
  callsSlice.actions;

export const callDeleted = removeCall;

export default callsSlice.reducer;

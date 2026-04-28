import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

import apiClient from "@/lib/api-client";
import { extractErrorMessage } from "@/lib/error-handler";
import { ApiResponse } from "@/types/api";
import {
  Practice,
  PracticeUpdate,
  Team,
  TeamCreate,
  TeamMembersUpdate,
  TeamUpdate,
} from "@/types/practice";

interface PracticeState {
  practice: Practice | null;
  loading: boolean;
  error: string | null;
}

const initialState: PracticeState = {
  practice: null,
  loading: false,
  error: null,
};

export const fetchPractice = createAsyncThunk(
  "practice/fetchPractice",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get<ApiResponse<Practice>>("/api/practice");
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const updatePractice = createAsyncThunk(
  "practice/updatePractice",
  async (data: PracticeUpdate, { rejectWithValue }) => {
    try {
      const response = await apiClient.patch<ApiResponse<Practice>>("/api/practice", data);
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const addTeam = createAsyncThunk(
  "practice/addTeam",
  async (data: TeamCreate, { rejectWithValue }) => {
    try {
      const response = await apiClient.post<ApiResponse<Team>>("/api/practice/teams", data);
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const updateTeam = createAsyncThunk(
  "practice/updateTeam",
  async ({ teamId, data }: { teamId: string; data: TeamUpdate }, { rejectWithValue }) => {
    try {
      const response = await apiClient.patch<ApiResponse<Team>>(
        `/api/practice/teams/${teamId}`,
        data
      );
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const deleteTeam = createAsyncThunk(
  "practice/deleteTeam",
  async (teamId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.delete<ApiResponse<null>>(
        `/api/practice/teams/${teamId}`
      );
      if (response.data.success) {
        return teamId;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const updateTeamMembers = createAsyncThunk(
  "practice/updateTeamMembers",
  async (
    { teamId, data }: { teamId: string; data: TeamMembersUpdate },
    { rejectWithValue }
  ) => {
    try {
      const response = await apiClient.put<ApiResponse<Team>>(
        `/api/practice/teams/${teamId}/members`,
        data
      );
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

const practiceSlice = createSlice({
  name: "practice",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updatePracticeData: (state, action: PayloadAction<Practice>) => {
      state.practice = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPractice.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPractice.fulfilled, (state, action) => {
        state.loading = false;
        state.practice = action.payload;
      })
      .addCase(fetchPractice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updatePractice.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updatePractice.fulfilled, (state, action) => {
        state.loading = false;
        state.practice = action.payload;
      })
      .addCase(updatePractice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, updatePracticeData } = practiceSlice.actions;

export const practiceUpdated = updatePracticeData;

export default practiceSlice.reducer;

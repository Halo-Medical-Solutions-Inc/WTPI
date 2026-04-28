import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

import apiClient, { setTokens as setApiTokens, clearTokens, getTokens } from "@/lib/api-client";
import { extractErrorMessage } from "@/lib/error-handler";
import { ApiResponse, LoginRequest, LoginResponse, ForgotPasswordRequest, ResetPasswordRequest } from "@/types/api";
import { User } from "@/types/user";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

export const login = createAsyncThunk(
  "auth/login",
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      const response = await apiClient.post<ApiResponse<LoginResponse>>("/api/auth/login", credentials);
      if (!response.data.success || !response.data.data) {
        return rejectWithValue(response.data.message);
      }

      setApiTokens(response.data.data.access_token, response.data.data.refresh_token);

      const userResponse = await apiClient.get<ApiResponse<User>>("/api/auth/me");
      if (userResponse.data.success && userResponse.data.data) {
        return userResponse.data.data;
      }
      return rejectWithValue("Failed to fetch user profile");
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const logout = createAsyncThunk(
  "auth/logout",
  async (_, { rejectWithValue }) => {
    try {
      const { refreshToken } = getTokens();
      if (refreshToken) {
        await apiClient.post("/api/auth/logout", { refresh_token: refreshToken });
      }
      clearTokens();
    } catch (error) {
      clearTokens();
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  "auth/getCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get<ApiResponse<User>>("/api/auth/me");
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const forgotPassword = createAsyncThunk(
  "auth/forgotPassword",
  async (data: ForgotPasswordRequest, { rejectWithValue }) => {
    try {
      const response = await apiClient.post<ApiResponse<null>>("/api/auth/forgot-password", data);
      if (response.data.success) {
        return response.data.message;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
  async (data: ResetPasswordRequest, { rejectWithValue }) => {
    try {
      const response = await apiClient.post<ApiResponse<null>>("/api/auth/reset-password", data);
      if (response.data.success) {
        return response.data.message;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updateCurrentUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    setTokens: (state, action: PayloadAction<{ accessToken: string; refreshToken: string }>) => {
      setApiTokens(action.payload.accessToken, action.payload.refreshToken);
      state.isAuthenticated = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      })
      .addCase(getCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(getCurrentUser.rejected, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
      })
      .addCase(forgotPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(forgotPassword.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(resetPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, updateCurrentUser, setTokens } = authSlice.actions;
export default authSlice.reducer;

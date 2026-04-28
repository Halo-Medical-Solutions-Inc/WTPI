import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

import apiClient from "@/lib/api-client";
import { extractErrorMessage } from "@/lib/error-handler";
import { ApiResponse, ChangePasswordRequest } from "@/types/api";
import { User, UserUpdate, UserSettingsUpdate } from "@/types/user";

interface UsersState {
  users: User[];
  loading: boolean;
  error: string | null;
}

const initialState: UsersState = {
  users: [],
  loading: false,
  error: null,
};

export const fetchUsers = createAsyncThunk(
  "users/fetchUsers",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get<ApiResponse<User[]>>("/api/users");
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const updateUser = createAsyncThunk(
  "users/updateUser",
  async ({ userId, data }: { userId: string; data: UserUpdate }, { rejectWithValue }) => {
    try {
      const response = await apiClient.patch<ApiResponse<User>>(`/api/users/${userId}`, data);
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const deleteUser = createAsyncThunk(
  "users/deleteUser",
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.delete<ApiResponse<null>>(`/api/users/${userId}`);
      if (response.data.success) {
        return userId;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const updateOwnSettings = createAsyncThunk(
  "users/updateOwnSettings",
  async (data: UserSettingsUpdate, { rejectWithValue }) => {
    try {
      const response = await apiClient.patch<ApiResponse<User>>("/api/users/me", data);
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const changePassword = createAsyncThunk(
  "users/changePassword",
  async (data: ChangePasswordRequest, { rejectWithValue }) => {
    try {
      const response = await apiClient.post<ApiResponse<null>>("/api/users/me/change-password", data);
      if (response.data.success) {
        return response.data.message;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    addUser: (state, action: PayloadAction<User>) => {
      const exists = state.users.some((u) => u.id === action.payload.id);
      if (!exists) {
        state.users.push(action.payload);
      }
    },
    updateUserInList: (state, action: PayloadAction<User>) => {
      const index = state.users.findIndex((u) => u.id === action.payload.id);
      if (index !== -1) {
        state.users[index] = action.payload;
      }
    },
    removeUser: (state, action: PayloadAction<string>) => {
      state.users = state.users.filter((u) => u.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        const index = state.users.findIndex((u) => u.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.users = state.users.filter((u) => u.id !== action.payload);
      });
  },
});

export const { clearError, addUser, updateUserInList, removeUser } = usersSlice.actions;

export const userCreated = addUser;
export const userUpdated = updateUserInList;
export const userDeleted = removeUser;

export default usersSlice.reducer;

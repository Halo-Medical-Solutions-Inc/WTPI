import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

import apiClient from "@/lib/api-client";
import { extractErrorMessage } from "@/lib/error-handler";
import { ApiResponse } from "@/types/api";
import { Invitation, InvitationCreate, InvitationAccept, InvitationVerifyResponse } from "@/types/invitation";

interface InvitationsState {
  invitations: Invitation[];
  loading: boolean;
  error: string | null;
}

const initialState: InvitationsState = {
  invitations: [],
  loading: false,
  error: null,
};

export const fetchInvitations = createAsyncThunk(
  "invitations/fetchInvitations",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get<ApiResponse<Invitation[]>>("/api/invitations");
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const createInvitation = createAsyncThunk(
  "invitations/createInvitation",
  async (data: InvitationCreate, { rejectWithValue }) => {
    try {
      const response = await apiClient.post<ApiResponse<Invitation> & { dev_invitation_link?: string }>("/api/invitations", data);
      if (response.data.success) {
        return {
          invitation: response.data.data,
          devLink: response.data.dev_invitation_link,
        };
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const cancelInvitation = createAsyncThunk(
  "invitations/cancelInvitation",
  async (invitationId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.delete<ApiResponse<null>>(`/api/invitations/${invitationId}`);
      if (response.data.success) {
        return invitationId;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const resendInvitation = createAsyncThunk(
  "invitations/resendInvitation",
  async (invitationId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.post<ApiResponse<Invitation> & { dev_invitation_link?: string }>(`/api/invitations/${invitationId}/resend`);
      if (response.data.success) {
        return {
          invitation: response.data.data,
          devLink: response.data.dev_invitation_link,
        };
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const verifyInvitation = createAsyncThunk(
  "invitations/verifyInvitation",
  async (token: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.get<ApiResponse<InvitationVerifyResponse>>(`/api/invitations/verify?token=${token}`);
      if (response.data.success) {
        return response.data.data;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

export const acceptInvitation = createAsyncThunk(
  "invitations/acceptInvitation",
  async (data: InvitationAccept, { rejectWithValue }) => {
    try {
      const response = await apiClient.post<ApiResponse<null>>("/api/invitations/accept", data);
      if (response.data.success) {
        return response.data.message;
      }
      return rejectWithValue(response.data.message);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

const invitationsSlice = createSlice({
  name: "invitations",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    addInvitation: (state, action: PayloadAction<Invitation>) => {
      const exists = state.invitations.some((i) => i.id === action.payload.id);
      if (!exists) {
        state.invitations.push(action.payload);
      }
    },
    updateInvitation: (state, action: PayloadAction<Invitation>) => {
      const index = state.invitations.findIndex((i) => i.id === action.payload.id);
      if (index !== -1) {
        state.invitations[index] = action.payload;
      }
    },
    removeInvitation: (state, action: PayloadAction<string>) => {
      state.invitations = state.invitations.filter((i) => i.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInvitations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInvitations.fulfilled, (state, action) => {
        state.loading = false;
        state.invitations = action.payload;
      })
      .addCase(fetchInvitations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createInvitation.fulfilled, (state, action) => {
        const exists = state.invitations.some((i) => i.id === action.payload.invitation.id);
        if (!exists) {
          state.invitations.push(action.payload.invitation);
        }
      })
      .addCase(cancelInvitation.fulfilled, (state, action) => {
        state.invitations = state.invitations.filter((i) => i.id !== action.payload);
      })
      .addCase(resendInvitation.fulfilled, (state, action) => {
        const index = state.invitations.findIndex((i) => i.id === action.payload.invitation.id);
        if (index !== -1) {
          state.invitations[index] = action.payload.invitation;
        }
      });
  },
});

export const { clearError, addInvitation, updateInvitation, removeInvitation } = invitationsSlice.actions;

export const invitationCreated = addInvitation;
export const invitationAccepted = updateInvitation;
export const invitationCanceled = updateInvitation;

export default invitationsSlice.reducer;

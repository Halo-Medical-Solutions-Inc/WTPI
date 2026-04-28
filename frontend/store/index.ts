import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";

import authReducer from "./slices/auth-slice";
import callsReducer from "./slices/calls-slice";
import invitationsReducer from "./slices/invitations-slice";
import mentionsReducer from "./slices/mentions-slice";
import messagesReducer from "./slices/messages-slice";
import practiceReducer from "./slices/practice-slice";
import usersReducer from "./slices/users-slice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    calls: callsReducer,
    invitations: invitationsReducer,
    mentions: mentionsReducer,
    messages: messagesReducer,
    practice: practiceReducer,
    users: usersReducer,
  },
  devTools: process.env.NODE_ENV !== "production",
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

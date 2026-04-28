"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";
import { store, useAppDispatch, useAppSelector } from "@/store";
import { fetchUsers } from "@/store/slices/users-slice";
import { fetchInvitations } from "@/store/slices/invitations-slice";
import { fetchUnreadMentionCount } from "@/store/slices/mentions-slice";
import { fetchConversations, fetchUnreadCount } from "@/store/slices/messages-slice";
import { fetchPractice } from "@/store/slices/practice-slice";
import { websocketClient } from "@/lib/websocket";
import { handleWebSocketEvent } from "@/store/websocket-handler";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  const publicRoutes = [
    "/login",
    "/accept-invitation",
    "/forgot-password",
    "/reset-password",
  ];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname?.startsWith(route)
  );
  const isHomePage = pathname === "/";

  const showSidebar = !isPublicRoute && !isHomePage && isAuthenticated;

  const resyncData = useCallback(() => {
    dispatch(fetchConversations());
    dispatch(fetchUnreadCount());
    dispatch(fetchUnreadMentionCount());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated && user) {
      dispatch(fetchUsers());
      dispatch(fetchPractice());
      dispatch(fetchInvitations());
      dispatch(fetchUnreadCount());
      dispatch(fetchUnreadMentionCount());
    }
  }, [isAuthenticated, user, dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      const token = localStorage.getItem("access_token");
      if (token) {
        websocketClient.onMessage((event) => {
          handleWebSocketEvent(
            event as { type: string; data: unknown },
            dispatch,
            () => store.getState(),
          );
        });
        websocketClient.onReconnect(resyncData);
        websocketClient.connect(token);
      }
    }

    return () => {
      websocketClient.disconnect();
    };
  }, [isAuthenticated, dispatch, resyncData]);

  useEffect(() => {
    if (!isAuthenticated) return;

    function handleVisibilityChange(): void {
      if (document.visibilityState === "visible") {
        resyncData();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, resyncData]);

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex h-dvh w-full bg-white">
        <AppSidebar />
        <main
          className="flex-1 overflow-auto"
          style={{ backgroundColor: "#FBF9F7" }}
        >
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

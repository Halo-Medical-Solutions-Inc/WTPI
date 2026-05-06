"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { toast } from "sonner";

import { useIsMobile } from "@/hooks/use-mobile";
import apiClient from "@/lib/api-client";
import ChatPanel from "@/components/messages/chat-panel";
import ConversationList from "@/components/messages/conversation-list";
import CreateChannelDialog from "@/components/messages/create-channel-dialog";
import CreateDmDialog from "@/components/messages/create-dm-dialog";
import ManageMembersDialog from "@/components/messages/manage-members-dialog";
import ThreadPanel from "@/components/messages/thread-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageSpinner } from "@/components/ui/page-spinner";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  closeThread,
  createConversation,
  deleteConversation,
  deleteMessage,
  editMessage,
  fetchConversations,
  fetchMessages,
  fetchOlderMessages,
  fetchThread,
  markAsRead,
  optimisticToggleReaction,
  sendMessage,
  sendReply,
  setSelectedConversation,
  toggleReaction,
} from "@/store/slices/messages-slice";
import { cn } from "@/lib/utils";
import { Conversation, ConversationType } from "@/types/message";

type MobileView = "list" | "chat" | "thread";

function MessagesContent() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const { isMobile, ready: mobileReady } = useIsMobile();
  const { user } = useAppSelector((state) => state.auth);
  const { users } = useAppSelector((state) => state.users);
  const {
    conversations,
    selectedConversation,
    messages,
    hasMoreMessages,
    loadingOlder,
    threadParent,
    threadReplies,
    threadLoading,
    messagesLoading,
    sendingMessage,
  } = useAppSelector((state) => state.messages);

  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [showChannelDialog, setShowChannelDialog] = useState(false);
  const [showDmDialog, setShowDmDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  useEffect(() => {
    if (!selectedConversation && isMobile) {
      setMobileView("list");
    }
  }, [selectedConversation, isMobile]);

  useEffect(() => {
    function handleVisibilityChange(): void {
      if (document.visibilityState === "visible" && selectedConversation) {
        dispatch(fetchMessages(selectedConversation.id));
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dispatch, selectedConversation]);

  const handleSelectConversation = useCallback(
    (conv: Conversation) => {
      dispatch(setSelectedConversation(conv));
      dispatch(fetchMessages(conv.id));
      if (!conv.is_observing) {
        dispatch(markAsRead(conv.id));
      }
      dispatch(closeThread());
      if (isMobile) setMobileView("chat");
    },
    [dispatch, isMobile],
  );

  const [handledConversationParam, setHandledConversationParam] = useState<string | null>(null);

  useEffect(() => {
    if (conversations.length === 0) return;

    const convParam = searchParams.get("conversation");
    const paramKey = convParam ? `${convParam}_${searchParams.get("t") || ""}` : null;

    if (convParam && paramKey !== handledConversationParam) {
      setHandledConversationParam(paramKey);
      const target = conversations.find((c) => c.id === convParam);
      if (target) {
        handleSelectConversation(target);
        return;
      }
    }

    if (!selectedConversation && mobileReady && !isMobile) {
      const defaultChannel = conversations.find(
        (c) => c.type === ConversationType.CHANNEL && c.is_default && c.name === "West Texas Pain Institute",
      );
      if (defaultChannel) {
        handleSelectConversation(defaultChannel);
      }
    }
  }, [conversations, selectedConversation, handleSelectConversation, searchParams, handledConversationParam, isMobile, mobileReady]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedConversation) return;
      try {
        await dispatch(
          sendMessage({ conversationId: selectedConversation.id, content }),
        ).unwrap();
      } catch {
        toast.error("Failed to send message");
      }
    },
    [dispatch, selectedConversation],
  );

  const handleCreateChannel = useCallback(
    async (name: string, memberIds: string[]) => {
      try {
        const result = await dispatch(
          createConversation({
            name,
            type: ConversationType.CHANNEL,
            member_ids: memberIds,
          }),
        ).unwrap();
        setShowChannelDialog(false);
        dispatch(setSelectedConversation(result));
        dispatch(fetchMessages(result.id));
        toast.success("Channel created");
      } catch {
        toast.error("Failed to create channel");
      }
    },
    [dispatch],
  );

  const handleCreateDm = useCallback(
    async (memberIds: string[]) => {
      try {
        const convType = memberIds.length > 2 ? ConversationType.GROUP : ConversationType.DIRECT;
        const result = await dispatch(
          createConversation({
            type: convType,
            member_ids: memberIds,
          }),
        ).unwrap();
        setShowDmDialog(false);
        dispatch(setSelectedConversation(result));
        dispatch(fetchMessages(result.id));
        toast.success("Conversation created");
      } catch {
        toast.error("Failed to create conversation");
      }
    },
    [dispatch],
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      try {
        await dispatch(editMessage({ messageId, content })).unwrap();
      } catch {
        toast.error("Failed to edit message");
      }
    },
    [dispatch],
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      try {
        await dispatch(deleteMessage(messageId)).unwrap();
      } catch {
        toast.error("Failed to archive message");
      }
    },
    [dispatch],
  );

  const handleToggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!user) return;
      dispatch(
        optimisticToggleReaction({
          messageId,
          emoji,
          userId: user.id,
          userName: user.full_name,
        }),
      );
      dispatch(toggleReaction({ messageId, emoji }));
    },
    [dispatch, user],
  );

  const handleOpenThread = useCallback(
    (messageId: string) => {
      if (!selectedConversation) return;
      dispatch(
        fetchThread({ conversationId: selectedConversation.id, messageId }),
      );
      if (isMobile) setMobileView("thread");
    },
    [dispatch, selectedConversation, isMobile],
  );

  const handleSendReply = useCallback(
    async (content: string) => {
      if (!selectedConversation || !threadParent) return;
      try {
        await dispatch(
          sendReply({
            conversationId: selectedConversation.id,
            content,
            replyToId: threadParent.id,
          }),
        ).unwrap();
      } catch {
        toast.error("Failed to send reply");
      }
    },
    [dispatch, selectedConversation, threadParent],
  );

  const handleLoadOlder = useCallback(() => {
    if (!selectedConversation || messages.length === 0) return;
    const oldestMessage = messages[0];
    dispatch(
      fetchOlderMessages({
        conversationId: selectedConversation.id,
        before: oldestMessage.created_at,
      }),
    );
  }, [dispatch, selectedConversation, messages]);

  const refreshSelectedConversation = useCallback(
    async (convId: string) => {
      const result = await dispatch(fetchConversations()).unwrap();
      const updated = result.find((c: Conversation) => c.id === convId);
      if (updated) {
        dispatch(setSelectedConversation(updated));
      }
    },
    [dispatch],
  );

  const handleAddMember = useCallback(
    async (userId: string) => {
      if (!selectedConversation) return;
      try {
        await apiClient.post(
          `/api/messages/conversations/${selectedConversation.id}/members`,
          { user_id: userId },
        );
        await refreshSelectedConversation(selectedConversation.id);
      } catch {
        toast.error("Failed to add member");
      }
    },
    [dispatch, selectedConversation, refreshSelectedConversation],
  );

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      if (!selectedConversation) return;
      try {
        await apiClient.delete(
          `/api/messages/conversations/${selectedConversation.id}/members/${userId}`,
        );
        await refreshSelectedConversation(selectedConversation.id);
      } catch {
        toast.error("Failed to remove member");
      }
    },
    [dispatch, selectedConversation, refreshSelectedConversation],
  );

  const handleCloseThread = useCallback(() => {
    dispatch(closeThread());
    if (isMobile) setMobileView("chat");
  }, [dispatch, isMobile]);

  const handleMobileBackToList = useCallback(() => {
    dispatch(setSelectedConversation(null));
    dispatch(closeThread());
    setMobileView("list");
  }, [dispatch]);

  const handleDeleteConversation = useCallback(async () => {
    if (!deleteTargetId) return;
    try {
      await dispatch(deleteConversation(deleteTargetId)).unwrap();
      toast.success("Conversation archived");
    } catch {
      toast.error("Failed to archive conversation");
    } finally {
      setDeleteTargetId(null);
    }
  }, [dispatch, deleteTargetId]);

  return (
    <div className="flex h-dvh">
      <div className={cn("w-[260px] shrink-0", isMobile && (mobileView === "list" ? "w-full" : "hidden"))}>
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation?.id ?? null}
          currentUserId={user?.id ?? ""}
          onSelect={handleSelectConversation}
          onNewChannel={() => setShowChannelDialog(true)}
          onNewDm={() => setShowDmDialog(true)}
          onDelete={(id) => setDeleteTargetId(id)}
        />
      </div>
      <div className={cn("flex-1", isMobile && mobileView !== "chat" && "hidden")}>
        <ChatPanel
          conversation={selectedConversation}
          messages={messages}
          currentUserId={user?.id ?? ""}
          loading={messagesLoading}
          sendingMessage={sendingMessage}
          hasMoreMessages={hasMoreMessages}
          loadingOlder={loadingOlder}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onToggleReaction={handleToggleReaction}
          onOpenThread={handleOpenThread}
          onOpenMembers={() => setShowMembersDialog(true)}
          onLoadOlder={handleLoadOlder}
          onBack={isMobile ? handleMobileBackToList : undefined}
        />
      </div>
      {threadParent && (!isMobile || mobileView === "thread") && (
        <ThreadPanel
          parent={threadParent}
          replies={threadReplies}
          currentUserId={user?.id ?? ""}
          loading={threadLoading}
          sendingMessage={sendingMessage}
          isObserving={selectedConversation?.is_observing === true}
          members={
            selectedConversation
              ? selectedConversation.member_ids.map((id, i) => ({
                  id,
                  name: selectedConversation.member_names[i] || "Unknown",
                }))
              : []
          }
          onSendReply={handleSendReply}
          onClose={handleCloseThread}
          onToggleReaction={handleToggleReaction}
          onBack={isMobile ? handleCloseThread : undefined}
        />
      )}

      <CreateChannelDialog
        open={showChannelDialog}
        onOpenChange={setShowChannelDialog}
        onSubmit={handleCreateChannel}
      />
      <CreateDmDialog
        open={showDmDialog}
        onOpenChange={setShowDmDialog}
        onSubmit={handleCreateDm}
      />
      {selectedConversation && (
        <ManageMembersDialog
          open={showMembersDialog}
          onOpenChange={setShowMembersDialog}
          memberIds={selectedConversation.member_ids}
          conversationName={
            selectedConversation.name || selectedConversation.member_names.join(", ")
          }
          memberCount={selectedConversation.member_names.length}
          isDefault={selectedConversation.is_default}
          isObserving={selectedConversation.is_observing}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
        />
      )}

      <AlertDialog open={deleteTargetId !== null} onOpenChange={() => setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive this conversation and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              className="bg-neutral-900 text-white hover:bg-neutral-800"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <MessagesContent />
    </Suspense>
  );
}

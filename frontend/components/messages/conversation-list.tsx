"use client";

import { formatDistanceToNow } from "date-fns";
import { Archive, Eye, Hash, MessageSquarePlus, Plus } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Conversation, ConversationType } from "@/types/message";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  currentUserId: string;
  onSelect: (conversation: Conversation) => void;
  onNewChannel: () => void;
  onNewDm: () => void;
  onDelete: (conversationId: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getFirstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName;
}

function getDmOtherNames(conv: Conversation, currentUserId: string): string[] {
  return conv.member_names.filter((_, i) => conv.member_ids[i] !== currentUserId);
}

function getDmDisplayName(otherNames: string[], conv: Conversation, currentUserId: string): string {
  if (otherNames.length === 0) {
    const selfName = conv.member_names.find((_, i) => conv.member_ids[i] === currentUserId);
    return selfName || "Notes to self";
  }
  if (otherNames.length === 1) {
    return otherNames[0];
  }
  const firstTwo = otherNames.slice(0, 2).map(getFirstName);
  const remaining = otherNames.length - 2;
  if (remaining > 0) {
    return `${firstTwo.join(", ")} +${remaining}`;
  }
  return firstTwo.join(", ");
}

export default function ConversationList({
  conversations,
  selectedId,
  currentUserId,
  onSelect,
  onNewChannel,
  onNewDm,
  onDelete,
}: ConversationListProps) {
  const DEFAULT_CHANNEL_ORDER = ["West Texas Pain Institute", "Platform Support"];

  const channels = conversations
    .filter((c) => c.type === ConversationType.CHANNEL)
    .sort((a, b) => {
      const aIdx = DEFAULT_CHANNEL_ORDER.indexOf(a.name || "");
      const bIdx = DEFAULT_CHANNEL_ORDER.indexOf(b.name || "");
      if (a.is_default && b.is_default) {
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      }
      if (a.is_default) return -1;
      if (b.is_default) return 1;
      return 0;
    });

  const directMessages = conversations.filter(
    (c) =>
      (c.type === ConversationType.DIRECT || c.type === ConversationType.GROUP) &&
      !c.is_observing,
  );

  const observed = conversations.filter(
    (c) =>
      (c.type === ConversationType.DIRECT || c.type === ConversationType.GROUP) &&
      c.is_observing,
  );

  return (
    <div className="flex h-full flex-col border-r border-neutral-200 bg-neutral-50">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-[15px] font-semibold text-neutral-900">Messages</h2>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="w-full overflow-hidden py-2">
          <div className="flex items-center justify-between px-4 py-1.5">
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Channels
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onNewChannel}
                    className="shrink-0 rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Create channel</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {channels.map((conv) => (
            <ConversationRow
              key={conv.id}
              conversation={conv}
              isSelected={selectedId === conv.id}
              currentUserId={currentUserId}
              onSelect={onSelect}
              onDelete={onDelete}
              icon={<Hash className="h-3.5 w-3.5 shrink-0 text-neutral-400" />}
              label={conv.name || "Untitled Channel"}
            />
          ))}

          <div className="mt-3 flex items-center justify-between px-4 py-1.5">
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Direct Messages
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onNewDm}
                    className="shrink-0 rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>New message</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {directMessages.map((conv) => {
            const otherNames = getDmOtherNames(conv, currentUserId);
            const displayName = getDmDisplayName(otherNames, conv, currentUserId);
            const isGroup = otherNames.length > 1;
            return (
              <ConversationRow
                key={conv.id}
                conversation={conv}
                isSelected={selectedId === conv.id}
                currentUserId={currentUserId}
                onSelect={onSelect}
                onDelete={onDelete}
                icon={
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarFallback className="bg-neutral-200 text-[8px] font-medium text-neutral-600">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                }
                label={displayName}
                tooltipText={isGroup ? otherNames.join("\n") : undefined}
              />
            );
          })}

          {directMessages.length === 0 && (
            <p className="px-4 py-2 text-[12px] text-neutral-400">No messages yet</p>
          )}

          {observed.length > 0 && (
            <>
              <div className="mt-3 flex items-center justify-between px-4 py-1.5">
                <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  <Eye className="h-3 w-3" />
                  Observing
                </span>
              </div>
              {observed.map((conv) => {
                const otherNames = getDmOtherNames(conv, currentUserId);
                const displayName = getDmDisplayName(otherNames, conv, currentUserId);
                const isGroup = otherNames.length > 1;
                return (
                  <ConversationRow
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedId === conv.id}
                    currentUserId={currentUserId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    icon={
                      <Avatar className="h-5 w-5 shrink-0">
                        <AvatarFallback className="bg-neutral-200 text-[8px] font-medium text-neutral-600">
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                    }
                    label={displayName}
                    tooltipText={isGroup ? otherNames.join("\n") : undefined}
                  />
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ConversationRow({
  conversation,
  isSelected,
  currentUserId,
  onSelect,
  onDelete,
  icon,
  label,
  tooltipText,
}: {
  conversation: Conversation;
  isSelected: boolean;
  currentUserId: string;
  onSelect: (conversation: Conversation) => void;
  onDelete: (id: string) => void;
  icon: React.ReactNode;
  label: string;
  tooltipText?: string;
}) {
  const hasUnread = conversation.unread_count > 0 && !conversation.is_observing;
  const canDelete = !conversation.is_default && !conversation.is_observing;

  const rowContent = (
    <div
      className={cn(
        "group relative flex items-center gap-2 overflow-hidden px-4 py-1.5 transition-colors",
        isSelected ? "bg-neutral-200/70" : "hover:bg-neutral-100",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(conversation)}
        className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left"
      >
        {icon}
        <span
          className={cn(
            "truncate text-[13px]",
            hasUnread ? "font-semibold text-neutral-900" : "text-neutral-700",
            conversation.is_observing && "italic text-neutral-500",
          )}
        >
          {label}
        </span>
        {conversation.is_observing && (
          <Eye className="ml-auto h-3 w-3 shrink-0 text-neutral-400" />
        )}
        {hasUnread && (
          <span className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {conversation.unread_count}
          </span>
        )}
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(conversation.id);
          }}
          className="block shrink-0 rounded p-0.5 text-neutral-400 hover:text-neutral-700 lg:hidden lg:group-hover:block"
        >
          <Archive className="h-3 w-3" />
        </button>
      )}
    </div>
  );

  if (!tooltipText) {
    return rowContent;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>{rowContent}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <div className="flex flex-col gap-0.5">
            {tooltipText.split("\n").map((name) => (
              <span key={name} className="text-[12px]">{name}</span>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

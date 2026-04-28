"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Archive, ChevronsLeft, Circle, CircleDot, Hash, Inbox, MessageSquare, User as UserIcon } from "lucide-react";
import { differenceInMinutes, formatDistanceToNow } from "date-fns";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  fetchMentions,
  markMentionRead,
  markMentionUnread,
  dismissMention,
  clearAllMentions,
  MentionItem,
} from "@/store/slices/mentions-slice";
import { cn } from "@/lib/utils";

interface InboxPopoverContentProps {
  onClose: () => void;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function getCallLabel(mention: MentionItem): string {
  const name = mention.caller_name?.trim() || "";
  const phone = mention.phone_number?.trim() ? formatPhone(mention.phone_number) : "";
  if (name && phone) return `${name} · ${phone}`;
  if (name) return name;
  if (phone) return phone;
  return "Unknown caller";
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  if (differenceInMinutes(new Date(), date) < 1) return "just now";
  return formatDistanceToNow(date, { addSuffix: false });
}

function groupByTime(mentions: MentionItem[]): { label: string; items: MentionItem[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);

  const groups: Record<string, MentionItem[]> = {
    Today: [],
    Yesterday: [],
    "This week": [],
    Older: [],
  };

  for (const m of mentions) {
    const d = new Date(m.created_at);
    if (d >= todayStart) groups["Today"].push(m);
    else if (d >= yesterdayStart) groups["Yesterday"].push(m);
    else if (d >= weekStart) groups["This week"].push(m);
    else groups["Older"].push(m);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export default function InboxPopoverContent({ onClose }: InboxPopoverContentProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { mentions, loading } = useAppSelector((state) => state.mentions);

  useEffect(() => {
    dispatch(fetchMentions());
  }, [dispatch]);

  const grouped = useMemo(() => groupByTime(mentions), [mentions]);

  function handleClick(mention: MentionItem): void {
    if (!mention.is_read) {
      dispatch(markMentionRead(mention.id));
    }

    let target: string | null = null;
    if (mention.source === "message" && mention.conversation_id) {
      target = `/messages?conversation=${mention.conversation_id}&t=${Date.now()}`;
    } else if (mention.call_id) {
      target = `/search?call=${mention.call_id}&t=${Date.now()}`;
    }

    onClose();
    if (target) {
      setTimeout(() => router.push(target), 50);
    }
  }

  function handleArchive(e: React.MouseEvent, mentionId: string): void {
    e.stopPropagation();
    dispatch(dismissMention(mentionId));
  }

  function handleToggleRead(e: React.MouseEvent, mention: MentionItem): void {
    e.stopPropagation();
    if (mention.is_read) {
      dispatch(markMentionUnread(mention.id));
    } else {
      dispatch(markMentionRead(mention.id));
    }
  }

  function handleArchiveAll(): void {
    dispatch(clearAllMentions());
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h2 className="text-[15px] font-semibold text-neutral-900">Inbox</h2>
        <div className="flex items-center gap-1">
          {mentions.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleArchiveAll}
                  className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                  aria-label="Archive all"
                >
                  <Archive className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="z-[80]">Archive all</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Close inbox"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="z-[80]">Close</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && mentions.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-5 w-5" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100">
              <Inbox className="h-5 w-5 text-neutral-400" />
            </div>
            <p className="text-[13px] font-medium text-neutral-500">You're all caught up</p>
          </div>
        ) : (
          <div className="py-1">
            {grouped.map((group) => (
              <div key={group.label}>
                <div className="px-4 pb-1 pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    {group.label}
                  </span>
                </div>
                {group.items.map((mention) => {
                  const callLabel = getCallLabel(mention);
                  return (
                    <div
                      key={mention.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleClick(mention)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleClick(mention);
                      }}
                      className={cn(
                        "group/entry relative flex w-full cursor-pointer gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50",
                        !mention.is_read && "border-l-2 border-l-blue-500 bg-blue-50/30"
                      )}
                    >
                      <Avatar className="mt-0.5 h-8 w-8 shrink-0 rounded-lg">
                        <AvatarFallback className="rounded-lg bg-neutral-200 text-[11px] font-medium text-neutral-600">
                          {getInitials(mention.mentioned_by_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] text-neutral-900">
                            <span className="font-semibold">{mention.mentioned_by_name}</span>
                            <span className="text-neutral-500">
                              {mention.source === "call_activity_comment"
                                ? " commented on a call"
                                : mention.source === "call_activity_review"
                                  ? " updated review status"
                                  : mention.source === "call_activity_flag"
                                    ? " flagged a call"
                                    : " mentioned you"}
                            </span>
                          </p>
                          <span className="shrink-0 text-[11px] text-neutral-400 group-hover/entry:hidden">
                            {formatTimeAgo(mention.created_at)}
                          </span>
                          <div className="hidden shrink-0 items-center gap-0.5 group-hover/entry:flex">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleRead(e, mention)}
                                  className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700"
                                  aria-label={mention.is_read ? "Mark as unread" : "Mark as read"}
                                >
                                  {mention.is_read ? (
                                    <Circle className="h-3.5 w-3.5" />
                                  ) : (
                                    <CircleDot className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="z-[80]">{mention.is_read ? "Mark as unread" : "Mark as read"}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => handleArchive(e, mention.id)}
                                  className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700"
                                  aria-label="Archive"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="z-[80]">Archive</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-neutral-500">
                          {mention.source === "message" ? (
                            mention.conversation_name ? (
                              <span className="inline-flex items-center gap-0.5 font-medium text-neutral-600">
                                <Hash className="h-3 w-3" />
                                {mention.conversation_name}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-neutral-600">
                                <MessageSquare className="h-3 w-3" />
                                Direct message
                              </span>
                            )
                          ) : mention.caller_name?.trim() ? (
                            <>
                              <span className="font-medium text-neutral-600">{mention.caller_name.trim()}</span>
                              {mention.phone_number?.trim() && (
                                <span className="text-neutral-400">· {formatPhone(mention.phone_number)}</span>
                              )}
                            </>
                          ) : mention.phone_number?.trim() ? (
                            <span className="inline-flex items-center gap-0.5 text-neutral-600">
                              <UserIcon className="h-3 w-3" />
                              {formatPhone(mention.phone_number)}
                            </span>
                          ) : (
                            <span className="text-neutral-400">Unknown caller</span>
                          )}
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-neutral-400 line-clamp-2">
                          {mention.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

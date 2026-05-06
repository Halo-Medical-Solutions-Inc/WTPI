"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { format } from "date-fns";
import { ArrowLeft, ArrowUp, Bold, Eye, Italic, Loader2, Smile, Strikethrough, X } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { EMOJI_GRID, EDITOR_CLASSES_SM, renderMessageContent } from "@/lib/format-message";
import MessageMentionPopup from "@/components/messages/message-mention-popup";
import { ChatMessage, MessageReaction } from "@/types/message";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀"];

interface ThreadPanelProps {
  parent: ChatMessage;
  replies: ChatMessage[];
  currentUserId: string;
  loading: boolean;
  sendingMessage: boolean;
  isObserving: boolean;
  members: { id: string; name: string }[];
  onSendReply: (content: string) => void;
  onClose: () => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onBack?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface GroupedReaction {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

function groupReactions(reactions: MessageReaction[], currentUserId: string): GroupedReaction[] {
  const map = new Map<string, { count: number; users: string[]; hasReacted: boolean }>();
  for (const r of reactions) {
    const existing = map.get(r.emoji) || { count: 0, users: [], hasReacted: false };
    existing.count += 1;
    existing.users.push(r.user_name);
    if (r.user_id === currentUserId) {
      existing.hasReacted = true;
    }
    map.set(r.emoji, existing);
  }
  return Array.from(map.entries()).map(([emoji, data]) => ({ emoji, ...data }));
}

function MessageRow({
  msg,
  currentUserId,
  onToggleReaction,
  isTapped,
  onTap,
  isMobile,
  isObserving,
}: {
  msg: ChatMessage;
  currentUserId: string;
  onToggleReaction: (messageId: string, emoji: string) => void;
  isTapped: boolean;
  onTap: () => void;
  isMobile: boolean;
  isObserving: boolean;
}) {
  const grouped = groupReactions(msg.reactions || [], currentUserId);

  return (
    <div
      className="group relative mb-3 rounded-md px-1 py-1 hover:bg-neutral-50"
      onClick={() => { if (isMobile) onTap(); }}
    >
      <div className="flex items-start gap-2.5">
        <Avatar className="mt-0.5 h-7 w-7 shrink-0">
          <AvatarFallback className="bg-neutral-200 text-[10px] font-medium text-neutral-700">
            {getInitials(msg.user_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-neutral-900">{msg.user_name}</span>
            <span className="text-[11px] text-neutral-400">
              {format(new Date(msg.created_at), "h:mm a")}
            </span>
            {msg.edited_at && <span className="text-[10px] text-neutral-400">(edited)</span>}
          </div>
          <div className="mt-0.5 text-[13px] leading-relaxed text-neutral-800">
            {renderMessageContent(msg.content)}
          </div>
          {grouped.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {grouped.map((gr) => (
                <TooltipProvider key={gr.emoji}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          if (isObserving) return;
                          onToggleReaction(msg.id, gr.emoji);
                        }}
                        disabled={isObserving}
                        className={cn(
                          "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] transition-colors",
                          gr.hasReacted
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-neutral-200 bg-white text-neutral-600",
                          !isObserving && "hover:bg-neutral-50",
                          isObserving && "cursor-default",
                        )}
                      >
                        <span>{gr.emoji}</span>
                        <span className="font-medium">{gr.count}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{gr.users.join(", ")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          )}
        </div>
      </div>

      {!isObserving && (
        <div
          data-action-bar
          className={cn(
            "absolute -top-2 right-1 items-center gap-0.5 rounded-md border border-neutral-200 bg-white px-0.5 py-0.5 shadow-sm",
            isMobile
              ? (isTapped ? "flex" : "hidden")
              : "hidden group-hover:flex"
          )}
        >
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleReaction(msg.id, emoji); onTap(); }}
              className="rounded px-1 py-0.5 text-[13px] transition-colors hover:bg-neutral-100"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ThreadPanel({
  parent,
  replies,
  currentUserId,
  loading,
  sendingMessage,
  isObserving,
  members,
  onSendReply,
  onClose,
  onToggleReaction,
  onBack,
}: ThreadPanelProps) {
  const { isMobile } = useIsMobile();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [tappedMessageId, setTappedMessageId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const submitRef = useRef<(() => void) | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Placeholder.configure({ placeholder: "Reply..." }),
    ],
    editorProps: {
      attributes: { class: EDITOR_CLASSES_SM },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          submitRef.current?.();
          return true;
        }
        return false;
      },
    },
    onSelectionUpdate: () => setTick((t) => t + 1),
    onUpdate: () => setTick((t) => t + 1),
  });

  useEffect(() => {
    const currentCount = replies.length;
    if (currentCount !== prevCountRef.current) {
      prevCountRef.current = currentCount;
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [replies.length]);

  const handleSubmit = useCallback((): void => {
    if (!editor || editor.isEmpty || sendingMessage) return;
    onSendReply(editor.getHTML());
    editor.commands.clearContent();
    editor.commands.blur();
  }, [editor, sendingMessage, onSendReply]);

  useEffect(() => { submitRef.current = handleSubmit; }, [handleSubmit]);

  return (
    <div className={cn("flex h-full shrink-0 flex-col border-l border-neutral-200 bg-white", onBack ? "w-full" : "w-[380px]")}>
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h3 className="text-[14px] font-semibold text-neutral-900">Thread</h3>
        </div>
        {!onBack && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-hide"
        onClickCapture={(e) => {
          const target = e.target as HTMLElement;
          if (tappedMessageId && !target.closest("[data-action-bar]")) {
            setTappedMessageId(null);
          }
        }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
          </div>
        ) : (
          <>
            <div className="border-b border-neutral-100 px-4 py-3">
              <MessageRow
                msg={parent}
                currentUserId={currentUserId}
                onToggleReaction={onToggleReaction}
                isTapped={tappedMessageId === parent.id}
                onTap={() => setTappedMessageId(tappedMessageId === parent.id ? null : parent.id)}
                isMobile={isMobile}
                isObserving={isObserving}
              />
            </div>

            <div className="px-4 py-2">
              {replies.length > 0 && (
                <div className="mb-2 mt-1 flex items-center gap-2">
                  <Separator className="flex-1" />
                  <span className="shrink-0 text-[11px] font-medium text-neutral-400">
                    {replies.length} {replies.length === 1 ? "reply" : "replies"}
                  </span>
                  <Separator className="flex-1" />
                </div>
              )}
              {replies.map((reply) => (
                <MessageRow
                  key={reply.id}
                  msg={reply}
                  currentUserId={currentUserId}
                  onToggleReaction={onToggleReaction}
                  isTapped={tappedMessageId === reply.id}
                  onTap={() => setTappedMessageId(tappedMessageId === reply.id ? null : reply.id)}
                  isMobile={isMobile}
                  isObserving={isObserving}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="px-3 pb-3">
        {isObserving ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            <Eye className="h-3 w-3 shrink-0" />
            <span>View only — observing as super admin.</span>
          </div>
        ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-300 bg-white transition-colors focus-within:border-neutral-400">
          <EditorContent editor={editor} />
          <MessageMentionPopup editor={editor} members={members} />
          <div className="flex items-center justify-between border-t border-neutral-200 px-1.5 py-1">
            <div className="flex items-center">
              <div className="flex items-center gap-0.5 border-r border-neutral-200 pr-1.5">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBold().run(); }} className={cn("rounded p-1", editor?.isActive("bold") ? "bg-neutral-200 text-neutral-900" : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600")} tabIndex={-1}>
                  <Bold className="h-3 w-3" />
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleItalic().run(); }} className={cn("rounded p-1", editor?.isActive("italic") ? "bg-neutral-200 text-neutral-900" : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600")} tabIndex={-1}>
                  <Italic className="h-3 w-3" />
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleStrike().run(); }} className={cn("rounded p-1", editor?.isActive("strike") ? "bg-neutral-200 text-neutral-900" : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600")} tabIndex={-1}>
                  <Strikethrough className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-0.5 pl-1.5">
                <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                  <PopoverTrigger asChild>
                    <button type="button" className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600" tabIndex={-1}>
                      <Smile className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[280px] p-2">
                    <div className="grid grid-cols-8 gap-0.5">
                      {EMOJI_GRID.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => { editor?.chain().focus().insertContent(emoji).run(); setEmojiOpen(false); }}
                          className="flex h-8 w-8 items-center justify-center rounded text-[18px] hover:bg-neutral-100"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {editor && !editor.isEmpty && (
                <span className="text-[10px] text-neutral-400">
                  <span className="font-medium">Shift + Return</span> for new line
                </span>
              )}
              <Button
                size="icon"
                onClick={handleSubmit}
                disabled={!editor || editor.isEmpty || sendingMessage}
                className="h-6 w-6 shrink-0 rounded-md"
              >
                {sendingMessage ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ArrowUp className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

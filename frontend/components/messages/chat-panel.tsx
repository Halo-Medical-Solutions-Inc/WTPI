"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { format } from "date-fns";
import { Archive, ArrowLeft, ArrowUp, Bold, Check, Hash, Italic, Loader2, MessageSquare, Pencil, Smile, Strikethrough, Users, X } from "lucide-react";
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
import { EMOJI_GRID, EDITOR_CLASSES, renderMessageContent } from "@/lib/format-message";
import MessageMentionPopup from "@/components/messages/message-mention-popup";
import { ChatMessage, Conversation, ConversationType, MessageReaction } from "@/types/message";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀"];

interface ChatPanelProps {
  conversation: Conversation | null;
  messages: ChatMessage[];
  currentUserId: string;
  loading: boolean;
  sendingMessage: boolean;
  hasMoreMessages: boolean;
  loadingOlder: boolean;
  onSendMessage: (content: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onOpenThread: (messageId: string) => void;
  onOpenMembers: () => void;
  onLoadOlder: () => void;
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

function getConversationTitle(conv: Conversation, currentUserId: string): string {
  if (conv.type === ConversationType.CHANNEL) {
    return conv.name || "Untitled Channel";
  }
  const otherNames = conv.member_names.filter((_, i) => conv.member_ids[i] !== currentUserId);
  if (otherNames.length > 0) {
    return otherNames.join(", ");
  }
  const selfName = conv.member_names.find((_, i) => conv.member_ids[i] === currentUserId);
  return selfName || "Notes to self";
}

function getDmIntroInfo(
  conv: Conversation,
  currentUserId: string,
): { name: string; initials: string; isSelf: boolean; isGroup: boolean } {
  const otherNames = conv.member_names.filter((_, i) => conv.member_ids[i] !== currentUserId);
  if (otherNames.length === 0) {
    const selfName =
      conv.member_names.find((_, i) => conv.member_ids[i] === currentUserId) || "You";
    return { name: selfName, initials: getInitials(selfName), isSelf: true, isGroup: false };
  }
  if (otherNames.length === 1) {
    return {
      name: otherNames[0],
      initials: getInitials(otherNames[0]),
      isSelf: false,
      isGroup: false,
    };
  }
  const joined = otherNames.join(", ");
  return { name: joined, initials: getInitials(otherNames[0]), isSelf: false, isGroup: true };
}

function groupMessagesByDate(messages: ChatMessage[]): Map<string, ChatMessage[]> {
  const groups = new Map<string, ChatMessage[]>();
  for (const message of messages) {
    const dateKey = format(new Date(message.created_at), "MMMM d, yyyy");
    const existing = groups.get(dateKey) || [];
    existing.push(message);
    groups.set(dateKey, existing);
  }
  return groups;
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

export default function ChatPanel({
  conversation,
  messages,
  currentUserId,
  loading,
  sendingMessage,
  hasMoreMessages,
  loadingOlder,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  onOpenThread,
  onOpenMembers,
  onLoadOlder,
  onBack,
}: ChatPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [tappedMessageId, setTappedMessageId] = useState<string | null>(null);
  const { isMobile } = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const isInitialLoad = useRef(true);
  const submitRef = useRef<(() => void) | null>(null);

  const [, setTick] = useState(0);

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
      Placeholder.configure({ placeholder: "Message..." }),
    ],
    editorProps: {
      attributes: { class: EDITOR_CLASSES },
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
    const currentCount = messages.length;
    if (currentCount !== prevCountRef.current) {
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        });
      } else if (currentCount > prevCountRef.current) {
        const addedAtEnd =
          prevCountRef.current === 0 ||
          messages[messages.length - 1]?.created_at >
            messages[Math.max(0, prevCountRef.current - 1)]?.created_at;
        if (addedAtEnd) {
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          });
        }
      }
      prevCountRef.current = currentCount;
    }
  }, [messages]);

  useEffect(() => {
    prevCountRef.current = 0;
    isInitialLoad.current = true;
  }, [conversation?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function handleScroll(): void {
      if (!el) return;
      if (el.scrollTop < 100 && hasMoreMessages && !loadingOlder) {
        onLoadOlder();
      }
    }

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [hasMoreMessages, loadingOlder, onLoadOlder]);

  const handleSubmit = useCallback((): void => {
    if (!editor || editor.isEmpty || sendingMessage) return;
    onSendMessage(editor.getHTML());
    editor.commands.clearContent();
    editor.commands.blur();
  }, [editor, sendingMessage, onSendMessage]);

  useEffect(() => { submitRef.current = handleSubmit; }, [handleSubmit]);

  function stripHtmlToPlainText(html: string): string {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  function handleStartEdit(msg: ChatMessage): void {
    setEditingId(msg.id);
    setEditValue(stripHtmlToPlainText(msg.content));
  }

  function handleSaveEdit(): void {
    if (!editingId || !editValue.trim()) return;
    onEditMessage(editingId, editValue.trim());
    setEditingId(null);
    setEditValue("");
  }

  function handleCancelEdit(): void {
    setEditingId(null);
    setEditValue("");
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === "Escape") {
      handleCancelEdit();
    }
  }

  const title = conversation ? getConversationTitle(conversation, currentUserId) : "";
  const isChannel = conversation?.type === ConversationType.CHANNEL;
  const placeholderText = conversation
    ? `Message ${isChannel ? "#" + conversation.name : title}`
    : "Message...";

  useEffect(() => {
    if (!editor) return;
    const ext = editor.extensionManager.extensions.find((e) => e.name === "placeholder");
    if (ext) {
      ext.options.placeholder = placeholderText;
      editor.view.dispatch(editor.state.tr);
    }
  }, [editor, placeholderText]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!editingId);
  }, [editor, editingId]);

  const mentionMembers = useMemo(() => {
    if (!conversation) return [];
    return conversation.member_ids.map((id, i) => ({
      id,
      name: conversation.member_names[i] || "Unknown",
    }));
  }, [conversation]);

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-neutral-400">
        <Hash className="mb-3 h-10 w-10 text-neutral-300" />
        <p className="text-[14px] font-medium text-neutral-500">Send a message</p>
        <p className="mt-1 text-[12px]">Choose a channel or conversation to get started</p>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);
  const dmIntro = !isChannel ? getDmIntroInfo(conversation, currentUserId) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 md:px-6">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              {isChannel && <Hash className="h-4 w-4 text-neutral-400" />}
              <h3 className="text-[15px] font-semibold text-neutral-900">{title}</h3>
            </div>
            <button
              type="button"
              onClick={onOpenMembers}
              className="mt-0.5 flex items-center gap-1 text-[12px] text-neutral-500 transition-colors hover:text-neutral-700"
            >
              <Users className="h-3 w-3" />
              <span>{conversation.member_names.length} members</span>
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide md:px-6"
        onClickCapture={(e) => {
          const target = e.target as HTMLElement;
          if (tappedMessageId && !target.closest("[data-action-bar]")) {
            setTappedMessageId(null);
          }
        }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        ) : messages.length === 0 && !loadingOlder ? (
          dmIntro ? (
            <div className="flex h-full flex-col justify-end">
              <div className="pb-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-neutral-200 text-lg font-semibold text-neutral-700">
                    {dmIntro.initials}
                  </AvatarFallback>
                </Avatar>
                <h3 className="mt-3 text-[17px] font-bold text-neutral-900">
                  {dmIntro.name}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
                  {dmIntro.isSelf
                    ? "This is your space for notes, drafts, and anything you want to keep handy."
                    : dmIntro.isGroup
                      ? `This is the very beginning of your group conversation with ${dmIntro.name}.`
                      : `This conversation is just between ${dmIntro.name} and you.`}
                </p>
                <Separator className="mt-4" />
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-end">
              <div className="pb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-neutral-200">
                  <Hash className="h-7 w-7 text-neutral-600" />
                </div>
                <h3 className="mt-3 text-[17px] font-bold text-neutral-900">
                  {conversation.name}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
                  {conversation.is_default
                    ? "This channel is for the whole team. Share updates, coordinate, and keep everyone in the loop."
                    : `Welcome to ${conversation.name}. This is the very beginning of the channel — say something to kick things off.`}
                </p>
                <Separator className="mt-4" />
              </div>
            </div>
          )
        ) : (
          <>
          {loadingOlder && (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
            </div>
          )}
          {Array.from(messageGroups.entries()).map(([dateKey, msgs]) => (
            <div key={dateKey}>
              <div className="my-4 flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="shrink-0 text-[11px] font-medium text-neutral-400">
                  {dateKey}
                </span>
                <Separator className="flex-1" />
              </div>
              {msgs.map((msg) => {
                const isOwn = msg.user_id === currentUserId;
                const isEditing = editingId === msg.id;
                const grouped = groupReactions(msg.reactions || [], currentUserId);

                const isTapped = tappedMessageId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className="group relative mb-2 rounded-md px-1 py-1 transition-colors hover:bg-neutral-50"
                    onClick={() => {
                      if (isMobile && !isEditing) {
                        setTappedMessageId(isTapped ? null : msg.id);
                      }
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                        <AvatarFallback
                          className={cn(
                            "text-[10px] font-medium",
                            isOwn
                              ? "bg-neutral-900 text-white"
                              : "bg-neutral-200 text-neutral-700",
                          )}
                        >
                          {getInitials(msg.user_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[13px] font-semibold text-neutral-900">
                            {msg.user_name}
                          </span>
                          <span className="text-[11px] text-neutral-400">
                            {format(new Date(msg.created_at), "h:mm a")}
                          </span>
                          {msg.edited_at && (
                            <span className="text-[10px] text-neutral-400">(edited)</span>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="mt-1">
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              rows={2}
                              className="w-full resize-none rounded-md border border-neutral-300 px-2.5 py-1.5 text-[13px] text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                              autoFocus
                            />
                            <div className="mt-1 flex items-center gap-1">
                              <Button size="sm" variant="default" onClick={handleSaveEdit} className="h-6 px-2 text-[11px]">
                                <Check className="mr-1 h-3 w-3" />
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-6 px-2 text-[11px]">
                                <X className="mr-1 h-3 w-3" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-0.5 text-[13px] leading-relaxed text-neutral-800">
                            {renderMessageContent(msg.content)}
                          </div>
                        )}
                        {grouped.length > 0 && !isEditing && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {grouped.map((gr) => (
                              <TooltipProvider key={gr.emoji}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => onToggleReaction(msg.id, gr.emoji)}
                                      className={cn(
                                        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] transition-colors",
                                        gr.hasReacted
                                          ? "border-blue-200 bg-blue-50 text-blue-700"
                                          : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
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
                        {msg.reply_count > 0 && !isEditing && (
                          <button
                            type="button"
                            onClick={() => onOpenThread(msg.id)}
                            className="mt-1 flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline"
                          >
                            <MessageSquare className="h-3 w-3" />
                            {msg.reply_count} {msg.reply_count === 1 ? "reply" : "replies"}
                          </button>
                        )}
                      </div>
                    </div>

                    {!isEditing && (
                      <div
                        data-action-bar
                        className={cn(
                          "absolute -top-3 right-1 items-center gap-0.5 rounded-md border border-neutral-200 bg-white px-0.5 py-0.5 shadow-sm",
                          isMobile
                            ? (isTapped ? "flex" : "hidden")
                            : "hidden group-hover:flex"
                        )}
                      >
                        <TooltipProvider delayDuration={200}>
                          {REACTION_EMOJIS.map((emoji) => (
                            <Tooltip key={emoji}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onToggleReaction(msg.id, emoji); setTappedMessageId(null); }}
                                  className="rounded px-1 py-0.5 text-[14px] transition-colors hover:bg-neutral-100"
                                >
                                  {emoji}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="text-[11px]">{emoji}</TooltipContent>
                            </Tooltip>
                          ))}
                          <div className="mx-0.5 h-4 w-px bg-neutral-200" />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onOpenThread(msg.id); setTappedMessageId(null); }}
                                className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="text-[11px]">Reply in thread</TooltipContent>
                          </Tooltip>
                          {isOwn && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleStartEdit(msg); setTappedMessageId(null); }}
                                    className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="text-[11px]">Edit message</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onDeleteMessage(msg.id); setTappedMessageId(null); }}
                                    className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                                  >
                                    <Archive className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="text-[11px]">Archive message</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                        </TooltipProvider>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          </>
        )}
      </div>

      <div className="px-4 pb-4">
        <div className={cn(
          "relative overflow-hidden rounded-lg border border-neutral-300 bg-white transition-colors focus-within:border-neutral-400",
          editingId && "pointer-events-none opacity-40"
        )}>
          <EditorContent editor={editor} />
          <MessageMentionPopup editor={editor} members={mentionMembers} />
          <div className="hidden items-center justify-between border-t border-neutral-200 px-1.5 py-1 lg:flex">
            <div className="flex items-center">
              <div className="flex items-center gap-0.5 border-r border-neutral-200 pr-1.5">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBold().run(); }} className={cn("rounded p-1.5", editor?.isActive("bold") ? "bg-neutral-200 text-neutral-900" : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600")} tabIndex={-1}>
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleItalic().run(); }} className={cn("rounded p-1.5", editor?.isActive("italic") ? "bg-neutral-200 text-neutral-900" : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600")} tabIndex={-1}>
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleStrike().run(); }} className={cn("rounded p-1.5", editor?.isActive("strike") ? "bg-neutral-200 text-neutral-900" : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600")} tabIndex={-1}>
                  <Strikethrough className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-0.5 pl-1.5">
                <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                  <PopoverTrigger asChild>
                    <button type="button" className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600" tabIndex={-1}>
                      <Smile className="h-3.5 w-3.5" />
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
            <div className="flex items-center gap-2">
              {editor && !editor.isEmpty && (
                <span className="text-[11px] text-neutral-400">
                  <span className="font-medium">Shift + Return</span> to add a new line
                </span>
              )}
              <Button
                size="icon"
                onClick={handleSubmit}
                disabled={!editor || editor.isEmpty || sendingMessage}
                className="h-7 w-7 shrink-0 rounded-lg"
              >
                {sendingMessage ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
          <div className="absolute bottom-2 right-2 lg:hidden">
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={!editor || editor.isEmpty || sendingMessage}
              className="h-7 w-7 shrink-0 rounded-lg"
            >
              {sendingMessage ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

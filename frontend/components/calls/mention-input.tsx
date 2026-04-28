"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { User } from "@/types/user";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  users: User[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function buildRenderedParts(
  text: string,
  userNameSet: Set<string>,
  userNameMap: Map<string, string>,
): { text: string; isMention: boolean }[] {
  if (!text.includes("@") || userNameSet.size === 0) {
    return [{ text, isMention: false }];
  }

  const result: { text: string; isMention: boolean }[] = [];
  const lower = text.toLowerCase();
  let lastIndex = 0;
  let i = 0;

  while (i < text.length) {
    if (lower[i] === "@" && i + 1 < text.length) {
      let bestName: string | null = null;
      let bestLen = 0;

      for (const [nameLower, nameOriginal] of userNameMap) {
        const end = i + 1 + nameLower.length;
        if (lower.slice(i + 1, end) === nameLower) {
          if (end >= text.length || !/\w/.test(text[end])) {
            if (nameLower.length > bestLen) {
              bestLen = nameLower.length;
              bestName = nameOriginal;
            }
          }
        }
      }

      if (bestName) {
        if (i > lastIndex) {
          result.push({ text: text.slice(lastIndex, i), isMention: false });
        }
        result.push({ text: `@${bestName}`, isMention: true });
        i += 1 + bestLen;
        lastIndex = i;
        continue;
      }
    }
    i++;
  }

  if (lastIndex < text.length) {
    result.push({ text: text.slice(lastIndex), isMention: false });
  }

  return result;
}

export default function MentionInput({
  value,
  onChange,
  onSubmit,
  users,
  disabled = false,
  placeholder = "Add a comment...",
}: MentionInputProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [query, setQuery] = useState("");

  const filtered = users.filter((u) =>
    u.full_name.toLowerCase().startsWith(query.toLowerCase())
  );

  const userNameSet = useMemo(() => new Set(users.map((u) => u.full_name)), [users]);
  const userNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.full_name.toLowerCase(), u.full_name);
    return m;
  }, [users]);

  const renderedParts = useMemo(
    () => buildRenderedParts(value, userNameSet, userNameMap),
    [value, userNameSet, userNameMap]
  );

  const hasMentions = renderedParts.some((p) => p.isMention);

  const extractMentionQuery = useCallback(
    (text: string, cursorPos: number): string | null => {
      const before = text.slice(0, cursorPos);
      const match = before.match(/@([\w][\w ]*?)$/);
      if (!match) return null;
      const candidate = match[1];
      const hasMatch = users.some((u) =>
        u.full_name.toLowerCase().startsWith(candidate.toLowerCase())
      );
      return hasMatch ? candidate : null;
    },
    [users]
  );

  function syncFromEditable(): string {
    if (!editableRef.current) return value;
    const raw = editableRef.current.innerText || "";
    return raw.replace(/\n/g, "");
  }

  function handleInput(): void {
    const newValue = syncFromEditable().replace(/\u00A0/g, " ");
    onChange(newValue);

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const preRange = document.createRange();
      preRange.selectNodeContents(editableRef.current!);
      preRange.setEnd(range.startContainer, range.startOffset);
      const cursorPos = preRange.toString().length;

      const mentionQuery = extractMentionQuery(newValue, cursorPos);
      if (mentionQuery !== null) {
        setQuery(mentionQuery);
        setMenuOpen(true);
        setMenuIndex(0);
      } else {
        setMenuOpen(false);
      }
    }
  }

  function insertMention(user: User): void {
    const text = syncFromEditable();

    const sel = window.getSelection();
    let cursorPos = text.length;
    if (sel && sel.rangeCount > 0 && editableRef.current) {
      const range = sel.getRangeAt(0);
      const preRange = document.createRange();
      preRange.selectNodeContents(editableRef.current);
      preRange.setEnd(range.startContainer, range.startOffset);
      cursorPos = preRange.toString().length;
    }

    const before = text.slice(0, cursorPos);
    const after = text.slice(cursorPos);
    const atIndex = before.lastIndexOf("@");
    if (atIndex === -1) return;

    const prefix = before.slice(0, atIndex);
    const newValue = `${prefix}@${user.full_name}\u00A0${after}`;
    onChange(newValue);
    setMenuOpen(false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!editableRef.current) return;
        editableRef.current.focus();
        const targetPos = prefix.length + 1 + user.full_name.length + 1;
        placeCaretAtPosition(editableRef.current, targetPos);
      });
    });
  }

  function placeCaretAtPosition(element: HTMLElement, position: number): void {
    const sel = window.getSelection();
    if (!sel) return;

    let remaining = position;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();

    while (node) {
      const len = (node.textContent || "").length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
      node = walker.nextNode();
    }

    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (menuOpen && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMenuIndex((prev) => (prev + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMenuIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filtered[menuIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey && !menuOpen) {
      e.preventDefault();
      onSubmit();
    }
  }

  const lastRenderedValue = useRef<string>("");

  useEffect(() => {
    if (!editableRef.current) return;
    if (value === lastRenderedValue.current) return;

    const el = editableRef.current;

    const currentText = (el.innerText || "").replace(/\n/g, "").replace(/\u00A0/g, " ");
    if (currentText === value) {
      lastRenderedValue.current = value;
      return;
    }

    lastRenderedValue.current = value;

    const sel = window.getSelection();
    let savedOffset = 0;
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      const preRange = document.createRange();
      preRange.selectNodeContents(el);
      preRange.setEnd(range.startContainer, range.startOffset);
      savedOffset = preRange.toString().length;
    }

    el.innerHTML = "";
    if (value === "") return;

    if (!hasMentions) {
      el.textContent = value;
    } else {
      for (const part of renderedParts) {
        if (part.isMention) {
          const span = document.createElement("span");
          span.textContent = part.text;
          span.className = "inline-flex items-center rounded-[4px] bg-blue-100 px-0.5 text-blue-700 font-semibold";
          span.contentEditable = "false";
          el.appendChild(span);
        } else {
          el.appendChild(document.createTextNode(part.text));
        }
      }
    }

    requestAnimationFrame(() => placeCaretAtPosition(el, savedOffset));
  }, [value, hasMentions, renderedParts]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen && menuRef.current) {
      const active = menuRef.current.querySelector("[data-active='true']");
      if (active) {
        active.scrollIntoView({ block: "nearest" });
      }
    }
  }, [menuIndex, menuOpen]);

  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menuOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const menuHeight = Math.min(filtered.length * 36 + 8, 200);
      setMenuPos({
        top: rect.top - menuHeight - 4,
        left: rect.left,
      });
    } else {
      setMenuPos(null);
    }
  }, [menuOpen, filtered.length]);

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <div
        ref={editableRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className={cn(
          "w-full min-h-[20px] border-0 bg-transparent px-0 text-[13px] text-neutral-700 shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:shadow-none disabled:cursor-not-allowed disabled:opacity-50",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-neutral-400 empty:before:pointer-events-none",
          disabled && "cursor-not-allowed opacity-50"
        )}
      />

      {menuOpen && filtered.length > 0 && menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[100] w-56 rounded-md border border-neutral-200 bg-white shadow-lg"
          >
            <div className="max-h-[200px] overflow-y-auto overscroll-contain py-1">
              {filtered.map((user, idx) => (
                <button
                  key={user.id}
                  type="button"
                  data-active={idx === menuIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(user);
                  }}
                  onMouseEnter={() => setMenuIndex(idx)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors",
                    idx === menuIndex
                      ? "bg-neutral-100 text-neutral-900"
                      : "text-neutral-700 hover:bg-neutral-50"
                  )}
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-neutral-200 text-[10px] font-medium text-neutral-600">
                      {getInitials(user.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate font-medium">{user.full_name}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )
      }
    </div>
  );
}

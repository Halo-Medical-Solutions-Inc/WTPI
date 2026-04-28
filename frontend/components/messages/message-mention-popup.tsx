"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import type { Editor } from "@tiptap/react";

interface MemberInfo {
  id: string;
  name: string;
}

interface MessageMentionPopupProps {
  editor: Editor | null;
  members: MemberInfo[];
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function MessageMentionPopup({
  editor,
  members,
}: MessageMentionPopupProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const filtered = useMemo(
    () =>
      members.filter((m) =>
        m.name.toLowerCase().startsWith(query.toLowerCase())
      ),
    [members, query]
  );

  const extractMentionQuery = useCallback(
    (text: string, cursorPos: number): string | null => {
      const before = text.slice(0, cursorPos);
      const match = before.match(/@([\w][\w ]*?)?$/);
      if (!match) return null;
      const candidate = match[1] || "";
      if (candidate === "") return "";
      const hasMatch = members.some((m) =>
        m.name.toLowerCase().startsWith(candidate.toLowerCase())
      );
      return hasMatch ? candidate : null;
    },
    [members]
  );

  const getEditorPlainText = useCallback((): string => {
    if (!editor) return "";
    return editor.state.doc.textContent;
  }, [editor]);

  const getCursorOffset = useCallback((): number => {
    if (!editor) return 0;
    return editor.state.selection.from - 1;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const handleUpdate = (): void => {
      const text = getEditorPlainText();
      const cursor = getCursorOffset();
      const mentionQuery = extractMentionQuery(text, cursor);

      if (mentionQuery !== null) {
        setQuery(mentionQuery);
        setMenuOpen(true);
        setMenuIndex(0);

        const coords = editor.view.coordsAtPos(editor.state.selection.from);
        setMenuPos({
          top: coords.top - 8,
          left: coords.left,
        });
      } else {
        setMenuOpen(false);
      }
    };

    editor.on("update", handleUpdate);
    editor.on("selectionUpdate", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
      editor.off("selectionUpdate", handleUpdate);
    };
  }, [editor, getEditorPlainText, getCursorOffset, extractMentionQuery]);

  const insertMention = useCallback(
    (member: MemberInfo) => {
      if (!editor) return;

      const text = getEditorPlainText();
      const cursor = getCursorOffset();
      const before = text.slice(0, cursor);
      const atIndex = before.lastIndexOf("@");
      if (atIndex === -1) return;

      const from = atIndex + 1;
      const to = editor.state.selection.from;

      const pillHtml = `<span contenteditable="false" data-mention="${member.id}" style="display:inline-flex;align-items:center;border-radius:4px;background:#dbeafe;padding:0 4px;font-size:12px;font-weight:600;color:#1d4ed8;line-height:1.4;user-select:all;">@${member.name}</span>\u00A0`;

      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContent(pillHtml)
        .run();

      setMenuOpen(false);
    },
    [editor, getEditorPlainText, getCursorOffset]
  );

  useEffect(() => {
    if (!editor || !menuOpen || filtered.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setMenuIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setMenuIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        insertMention(filtered[menuIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [editor, menuOpen, filtered, menuIndex, insertMention]);

  useEffect(() => {
    if (menuOpen && menuRef.current) {
      const active = menuRef.current.querySelector("[data-active='true']");
      if (active) {
        active.scrollIntoView({ block: "nearest" });
      }
    }
  }, [menuIndex, menuOpen]);

  if (!menuOpen || filtered.length === 0 || !menuPos) return null;

  const menuHeight = Math.min(filtered.length * 36 + 8, 200);

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: menuPos.top - menuHeight - 4,
        left: menuPos.left,
      }}
      className="z-[100] w-56 rounded-md border border-neutral-200 bg-white shadow-lg"
    >
      <div className="max-h-[200px] overflow-y-auto overscroll-contain py-1">
        {filtered.map((member, idx) => (
          <button
            key={member.id}
            type="button"
            data-active={idx === menuIndex}
            onMouseDown={(e) => {
              e.preventDefault();
              insertMention(member);
            }}
            onMouseEnter={() => setMenuIndex(idx)}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors",
              idx === menuIndex
                ? "bg-neutral-100 text-neutral-900"
                : "text-neutral-700 hover:bg-neutral-50"
            )}
          >
            <Avatar className="h-6 w-6 shrink-0 rounded-lg">
              <AvatarFallback className="rounded-lg bg-neutral-200 text-[10px] font-medium text-neutral-600">
                {getInitials(member.name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-medium">{member.name}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}

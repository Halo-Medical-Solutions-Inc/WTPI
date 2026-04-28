"use client";

import { Fragment, useMemo } from "react";
import { User } from "@/types/user";

interface CommentContentProps {
  content: string;
  users: User[];
}

export default function CommentContent({ content, users }: CommentContentProps) {
  const parts = useMemo(() => {
    if (!content.includes("@") || users.length === 0) {
      return null;
    }

    const nameMap = new Map<string, string>();
    for (const u of users) {
      nameMap.set(u.full_name.toLowerCase(), u.full_name);
    }

    const result: { text: string; isMention: boolean }[] = [];
    const lower = content.toLowerCase();
    let lastIndex = 0;
    let i = 0;

    while (i < content.length) {
      if (lower[i] === "@" && i + 1 < content.length) {
        let bestName: string | null = null;
        let bestLen = 0;

        for (const [nameLower, nameOriginal] of nameMap) {
          const end = i + 1 + nameLower.length;
          if (lower.slice(i + 1, end) === nameLower) {
            if (end >= content.length || !/\w/.test(content[end])) {
              if (nameLower.length > bestLen) {
                bestLen = nameLower.length;
                bestName = nameOriginal;
              }
            }
          }
        }

        if (bestName) {
          if (i > lastIndex) {
            result.push({ text: content.slice(lastIndex, i), isMention: false });
          }
          result.push({ text: `@${bestName}`, isMention: true });
          i += 1 + bestLen;
          lastIndex = i;
          continue;
        }
      }
      i++;
    }

    if (lastIndex < content.length) {
      result.push({ text: content.slice(lastIndex), isMention: false });
    }

    return result.length > 0 ? result : null;
  }, [content, users]);

  if (!parts) {
    return <>{content}</>;
  }

  return (
    <>
      {parts.map((part, i) =>
        part.isMention ? (
          <span
            key={i}
            className="inline-flex items-center rounded-[4px] bg-blue-100 px-1 py-[1px] text-[12px] font-semibold text-blue-700 leading-tight"
          >
            {part.text}
          </span>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        )
      )}
    </>
  );
}

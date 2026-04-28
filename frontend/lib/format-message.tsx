import React from "react";

const INLINE_REGEX =
  /(\*\*(.+?)\*\*)|(_(.+?)_)|(~~(.+?)~~)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  INLINE_REGEX.lastIndex = 0;
  while ((match = INLINE_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      parts.push(<strong key={key++} className="font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[4]}</em>);
    } else if (match[5]) {
      parts.push(<s key={key++} className="text-neutral-500">{match[6]}</s>);
    } else if (match[7]) {
      parts.push(
        <a
          key={key++}
          href={match[9]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800"
        >
          {match[8]}
        </a>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function renderPlainText(content: string): React.ReactNode {
  const lines = content.split("\n");
  return lines.map((line, i) => (
    <React.Fragment key={i}>
      {i > 0 && "\n"}
      {parseInline(line)}
    </React.Fragment>
  ));
}

const MENTION_PILL_CLASS =
  "inline-flex items-center rounded-[4px] bg-blue-100 px-1 py-[1px] text-[12px] font-semibold text-blue-700 leading-tight";

function injectMentionPills(html: string): string {
  return html.replace(
    /@([\w][\w ]*?)(?=[\s<.,;:!?)}\]"']|&nbsp;|$)/g,
    `<span class="${MENTION_PILL_CLASS}">@$1</span>`
  );
}

const RICH_TEXT_CLASSES = [
  "[&_p]:mb-0 [&_p:not(:last-child)]:mb-1",
  "[&_strong]:font-semibold",
  "[&_em]:italic",
  "[&_s]:text-neutral-500",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1",
  "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1",
  "[&_li]:ml-0 [&_li]:mb-0.5",
  "[&_a]:text-blue-600 [&_a]:underline [&_a]:hover:text-blue-800",
].join(" ");

export function renderMessageContent(content: string): React.ReactNode {
  const isHtml = content.trimStart().startsWith("<");
  const hasMention = content.includes("@");

  if (isHtml) {
    const processed = injectMentionPills(content);
    return (
      <div
        className={RICH_TEXT_CLASSES}
        dangerouslySetInnerHTML={{ __html: processed }}
      />
    );
  }

  if (hasMention) {
    const escaped = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br />");
    const processed = injectMentionPills(escaped);
    return (
      <span dangerouslySetInnerHTML={{ __html: processed }} />
    );
  }

  return renderPlainText(content);
}

export const EMOJI_GRID = [
  "😀", "😂", "🙂", "😊", "😍", "🥰", "😎", "🤔",
  "😅", "😢", "😤", "🤯", "🥳", "😴", "🤗", "🫡",
  "👍", "👎", "👏", "🙌", "🤝", "💪", "✌️", "🫶",
  "❤️", "🔥", "⭐", "✅", "❌", "💯", "🎉", "👀",
];

export const EDITOR_CLASSES =
  "w-full min-h-[72px] max-h-[160px] overflow-y-auto px-3 pr-12 pt-3 pb-2 text-base leading-5 text-neutral-900 outline-none lg:min-h-[36px] lg:pr-3 lg:text-[13px] [&_p]:mb-0 [&_p:not(:last-child)]:mb-1 [&_strong]:font-semibold [&_em]:italic [&_s]:text-neutral-500 [&_a]:text-blue-600 [&_a]:underline";

export const EDITOR_CLASSES_SM =
  "w-full min-h-[72px] max-h-[128px] overflow-y-auto px-3 pr-12 pt-3 pb-2 text-base leading-5 text-neutral-900 outline-none lg:min-h-[40px] lg:pr-3 lg:text-[13px] [&_p]:mb-0 [&_p:not(:last-child)]:mb-1 [&_strong]:font-semibold [&_em]:italic [&_s]:text-neutral-500 [&_a]:text-blue-600 [&_a]:underline";

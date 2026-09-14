/**
 * RENIX vNext — Rich Text Content Components
 * 
 * Components for parsing and rendering rich text content in AI messages.
 * Includes frame name pill rendering and inline formatting.
 * 
 * Normalized font size: 13px base for all message content (user + assistant).
 */

import { type ReactNode } from 'react';
import { FRAME_NAMES } from './types';

export function FramePill({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted/60 text-foreground/80 border border-border/30">
      {name}
    </span>
  );
}

function checkFrameNames(text: string): ReactNode {
  const framePattern = FRAME_NAMES.join('|');
  const regex = new RegExp(`\\b(${framePattern})\\b`, 'gi');
  
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const matchedText = match[1];
    const frameName = FRAME_NAMES.find(f => f.toLowerCase() === matchedText.toLowerCase()) || matchedText;
    parts.push(<FramePill key={`frame-${key++}`} name={frameName} />);
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? <>{parts}</> : text;
}

function parseInlineFormatting(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = 0;
  
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(<span key={key++}>{checkFrameNames(remaining.slice(0, boldMatch.index))}</span>);
      }
      parts.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }
    
    const italicMatch = remaining.match(/\*([^*]+)\*/);
    if (italicMatch && italicMatch.index !== undefined) {
      if (italicMatch.index > 0) {
        parts.push(<span key={key++}>{checkFrameNames(remaining.slice(0, italicMatch.index))}</span>);
      }
      parts.push(<em key={key++} className="italic text-muted-foreground">{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }
    
    parts.push(<span key={key++}>{checkFrameNames(remaining)}</span>);
    break;
  }
  
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function renderTextLines(text: string, keyOffset: number): ReactNode[] {
  const lines = text.split('\n').filter(line => line.trim());
  return lines.map((line, i) => {
    let trimmed = line.trim();
    const key = keyOffset + i;

    if (trimmed.startsWith('#')) {
      const heading = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '');
      return (
        <p key={key} className="font-semibold text-foreground mt-2 first:mt-0">
          {parseInlineFormatting(heading)}
        </p>
      );
    }

    const hadBullet = /^[-•*]\s/.test(trimmed);
    if (hadBullet) {
      trimmed = trimmed.replace(/^[-•*]\s*/, '');
      const parsed = parseInlineFormatting(trimmed);
      return (
        <div key={key} className="flex items-start gap-2 pl-1">
          <span className="text-muted-foreground/50 mt-0.5">•</span>
          <span>{parsed}</span>
        </div>
      );
    }

    const numberedMatch = trimmed.match(/^(\d+)[\)\.]\s*/);
    if (numberedMatch) {
      const num = numberedMatch[1];
      const itemContent = parseInlineFormatting(trimmed.replace(/^\d+[\)\.]\s*/, ''));
      return (
        <div key={key} className="flex items-start gap-2 pl-1">
          <span className="text-muted-foreground min-w-[20px] text-right">{num}.</span>
          <span>{itemContent}</span>
        </div>
      );
    }

    if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.indexOf('**', 2) === trimmed.length - 2) {
      return (
        <p key={key} className="font-semibold text-foreground mt-2 first:mt-0">
          {trimmed.slice(2, -2)}
        </p>
      );
    }

    return <p key={key} className="text-xs font-normal">{parseInlineFormatting(trimmed)}</p>;
  });
}

export function RichTextContent({ content }: { content: string }) {
  const safeContent = content ?? '';
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const segments: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let segKey = 0;

  while ((match = codeBlockRegex.exec(safeContent)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = safeContent.slice(lastIndex, match.index);
      segments.push(...renderTextLines(textBefore, segKey));
      segKey += 1000;
    }
    const lang = match[1] || '';
    const code = match[2].replace(/\n$/, '');
    segments.push(
      <div key={`code-${segKey++}`} className="my-2 rounded-md border border-border bg-muted/40">
        {lang && (
          <div className="px-3 py-1 text-[11px] text-muted-foreground border-b border-border font-medium">
            {lang}
          </div>
        )}
        <pre className="p-3 text-[12px] leading-relaxed font-mono whitespace-pre-wrap break-words">
          <code>{code}</code>
        </pre>
      </div>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < safeContent.length) {
    segments.push(...renderTextLines(safeContent.slice(lastIndex), segKey));
  }

  return (
    <div className="text-foreground space-y-1.5 break-words overflow-hidden text-[13px] leading-relaxed">
      {segments}
    </div>
  );
}

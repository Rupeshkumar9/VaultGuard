import { Fragment } from 'react';
import { Link } from 'react-router-dom';

function renderInline(text, keyPrefix) {
  const tokens = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match;
  let idx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${idx++}`;

    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={key} className="font-semibold text-vg-text-primary">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={key}
          className="rounded-[5px] border border-vg-border bg-vg-canvas px-1.5 py-0.5 text-[13px] font-mono text-vg-teal"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        if (href.startsWith('/')) {
          tokens.push(
            <Link key={key} to={href} className="text-vg-teal font-medium hover:underline">
              {label}
            </Link>
          );
        } else {
          tokens.push(
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-vg-teal font-medium hover:underline"
            >
              {label}
            </a>
          );
        }
      } else {
        tokens.push(token);
      }
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens.map((part, i) => <Fragment key={`${keyPrefix}-f-${i}`}>{part}</Fragment>);
}

export function MarkdownContent({ content }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'code', lang, text: codeLines.join('\n') });
      continue;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', text: trimmed.slice(4).trim() });
      i += 1;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', text: trimmed.slice(3).trim() });
      i += 1;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join(' ') });
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
      ) {
        items.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const paragraphLines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('> ') &&
      !lines[i].trim().startsWith('- ') &&
      !lines[i].trim().startsWith('* ') &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'p', text: paragraphLines.join(' ') });
  }

  return (
    <div className="space-y-5 text-[15px] sm:text-[16px] leading-[1.75] text-vg-text-secondary">
      {blocks.map((block, index) => {
        const key = `md-${index}`;
        if (block.type === 'h2') {
          return (
            <h2
              key={key}
              className="pt-4 text-[22px] sm:text-[26px] font-bold leading-tight text-vg-text-primary"
            >
              {renderInline(block.text, key)}
            </h2>
          );
        }
        if (block.type === 'h3') {
          return (
            <h3
              key={key}
              className="pt-2 text-[18px] sm:text-[20px] font-semibold leading-snug text-vg-text-primary"
            >
              {renderInline(block.text, key)}
            </h3>
          );
        }
        if (block.type === 'code') {
          return (
            <pre
              key={key}
              className="overflow-x-auto rounded-[12px] border border-vg-border bg-vg-canvas p-4 text-[13px] leading-relaxed font-mono text-vg-text-primary"
            >
              <code data-lang={block.lang || undefined}>{block.text}</code>
            </pre>
          );
        }
        if (block.type === 'blockquote') {
          return (
            <blockquote
              key={key}
              className="rounded-r-[12px] border-l-2 border-vg-teal bg-vg-surface/70 px-4 py-3 text-vg-text-primary/90 italic"
            >
              {renderInline(block.text, key)}
            </blockquote>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={key} className="list-disc pl-6 space-y-2">
              {block.items.map((item, itemIdx) => (
                <li key={`${key}-li-${itemIdx}`}>{renderInline(item, `${key}-li-${itemIdx}`)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={key} className="list-decimal pl-6 space-y-2">
              {block.items.map((item, itemIdx) => (
                <li key={`${key}-li-${itemIdx}`}>{renderInline(item, `${key}-li-${itemIdx}`)}</li>
              ))}
            </ol>
          );
        }
        return <p key={key}>{renderInline(block.text, key)}</p>;
      })}
    </div>
  );
}

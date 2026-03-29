import React from "react";
import { Box, Text } from "ink";
import { highlight } from "cli-highlight";

/**
 * Premium Markdown renderer for Ink terminal.
 * Renders: headers, code blocks, inline code, bold, italic,
 * lists, blockquotes, horizontal rules, links, tables.
 */

interface MarkdownTextProps {
  children: string;
}

// ─── Inline parser ─────────────────────────────────────

interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  dimColor?: boolean;
  color?: string;
  url?: string;
}

function parseInline(line: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)|(\[([^\]]+)\]\(([^)]+)\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: line.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      // Inline code: `code`
      segments.push({ text: ` ${match[1].slice(1, -1)} `, code: true, color: "yellowBright" });
    } else if (match[2]) {
      // Bold: **text**
      segments.push({ text: match[2].slice(2, -2), bold: true });
    } else if (match[3]) {
      // Italic: *text*
      segments.push({ text: match[3].slice(1, -1), italic: true, dimColor: true });
    } else if (match[4]) {
      // Italic: _text_
      segments.push({ text: match[4].slice(1, -1), italic: true, dimColor: true });
    } else if (match[5]) {
      // Link: [text](url)
      segments.push({ text: match[6], bold: true, color: "cyan", url: match[7] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex) });
  }
  if (segments.length === 0) {
    segments.push({ text: line });
  }

  return segments;
}

function renderInline(segments: InlineSegment[], key?: string): React.ReactNode {
  return (
    <Text key={key}>
      {segments.map((seg, i) => {
        if (seg.code) {
          return (
            <Text key={i} color="yellow" bold inverse>{seg.text}</Text>
          );
        }
        return (
          <Text
            key={i}
            bold={seg.bold}
            italic={seg.italic}
            dimColor={seg.dimColor}
            color={seg.color as any}
          >
            {seg.text}
            {seg.url ? <Text dimColor> ({seg.url})</Text> : ""}
          </Text>
        );
      })}
    </Text>
  );
}

// ─── Block parser ──────────────────────────────────────

interface Block {
  type: "heading" | "code" | "list" | "blockquote" | "hr" | "paragraph" | "table";
  level?: number;
  lang?: string;
  ordered?: boolean;
  lines: string[];
  tableData?: { headers: string[]; rows: string[][] };
}

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block (fenced)
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing
      blocks.push({ type: "code", lang, lines: codeLines });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length, lines: [headingMatch[2]] });
      i++;
      continue;
    }

    // Horizontal rule (must check before table to avoid conflict with |---|)
    if (/^(---|\*\*\*|___)\s*$/.test(line.trim()) && !line.includes("|")) {
      blocks.push({ type: "hr", lines: [] });
      i++;
      continue;
    }

    // Table: detect | col | col | pattern
    if (line.includes("|") && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i + 1])) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      // Parse table
      const parseLine = (l: string) => l.split("|").map(c => c.trim()).filter(c => c !== "");
      const headers = parseLine(tableLines[0]);
      const rows = tableLines.slice(2).map(parseLine); // skip separator row
      blocks.push({ type: "table", lines: tableLines, tableData: { headers, rows } });
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    // Unordered list
    if (/^\s*[-*•]\s/.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s/.test(lines[i])) {
        listLines.push(lines[i].replace(/^\s*[-*•]\s/, ""));
        i++;
      }
      blocks.push({ type: "list", ordered: false, lines: listLines });
      continue;
    }

    // Ordered list
    if (/^\s*\d+[.)]\s/.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i])) {
        listLines.push(lines[i].replace(/^\s*\d+[.)]\s/, ""));
        i++;
      }
      blocks.push({ type: "list", ordered: true, lines: listLines });
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("> ") &&
      !/^\s*[-*•]\s/.test(lines[i]) &&
      !/^\s*\d+[.)]\s/.test(lines[i]) &&
      !/^(---|\*\*\*|___)\s*$/.test(lines[i].trim()) &&
      !(lines[i].includes("|") && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i + 1] ?? ""))
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", lines: paraLines });
    }
  }

  return blocks;
}

// ─── Renderer ──────────────────────────────────────────

export const MarkdownText: React.FC<MarkdownTextProps> = ({ children }) => {
  const blocks = parseBlocks(children);
  const maxWidth = Math.min(process.stdout.columns || 80, 80);

  return (
    <Box flexDirection="column">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading": {
            const level = block.level ?? 1;
            if (level === 1) {
              return (
                <Box key={i} flexDirection="column" marginTop={1}>
                  <Text bold color="greenBright">👽 {block.lines[0]}</Text>
                </Box>
              );
            }
            if (level === 2) {
              return (
                <Box key={i} marginTop={1}>
                  <Text bold color="greenBright">🛸 {block.lines[0]}</Text>
                </Box>
              );
            }
            return (
              <Box key={i} marginTop={1}>
                <Text bold color="yellow">▸ {block.lines[0]}</Text>
              </Box>
            );
          }

          case "code": {
            const width = Math.max(
              ...block.lines.map(l => l.length),
              (block.lang || "").length + 4,
              30
            );
            const borderW = Math.min(width + 4, maxWidth - 4);
            const topBorder = `┌${'─'.repeat(borderW)}┐`;
            const bottomBorder = `└${'─'.repeat(borderW)}┘`;

            const codeStr = block.lines.join("\n");
            let highlighted = codeStr;
            try {
              highlighted = highlight(codeStr, { language: block.lang || "plaintext", ignoreIllegals: true });
            } catch (e) {
              // fallback if cli-highlight fails or is absent
            }
            const highlightedLines = highlighted.split("\n");

            return (
              <Box key={i} flexDirection="column" marginTop={1} marginBottom={1} marginLeft={2}>
                {block.lang && (
                  <Text dimColor>  {block.lang}</Text>
                )}
                <Text dimColor>{topBorder}</Text>
                {highlightedLines.map((line, j) => (
                  <Box key={j}>
                    <Text dimColor>│ </Text>
                    <Text>{line}</Text>
                  </Box>
                ))}
                <Text dimColor>{bottomBorder}</Text>
              </Box>
            );
          }

          case "list": {
            return (
              <Box key={i} flexDirection="column" marginLeft={1}>
                {block.lines.map((line, j) => (
                  <Box key={j}>
                    {block.ordered ? (
                      <Text color="greenBright" dimColor>{`  ${j + 1}. `}</Text>
                    ) : (
                      <Text color="greenBright">  • </Text>
                    )}
                    {renderInline(parseInline(line))}
                  </Box>
                ))}
              </Box>
            );
          }

          case "blockquote": {
            return (
              <Box key={i} marginLeft={2} flexDirection="column">
                {block.lines.map((line, j) => (
                  <Box key={j}>
                    <Text color="greenBright">  ▋ </Text>
                    <Text italic>{renderInline(parseInline(line))}</Text>
                  </Box>
                ))}
              </Box>
            );
          }

          case "hr": {
            return (
              <Box key={i} marginY={1}>
                <Text dimColor>  {'─ '.repeat(20)}</Text>
              </Box>
            );
          }

          case "table": {
            if (!block.tableData) return null;
            const { headers, rows } = block.tableData;
            const colCount = headers.length;

            // Calculate column widths
            const colWidths = headers.map((h, ci) => {
              const maxData = rows.reduce((max, row) => Math.max(max, (row[ci] || "").length), 0);
              return Math.max(h.length, maxData, 3) + 2; // +2 for padding
            });

            const totalWidth = colWidths.reduce((a, b) => a + b, 0) + colCount + 1;

            // Box-drawing borders
            const topBorder = `┌${colWidths.map(w => '─'.repeat(w)).join('┬')}┐`;
            const midBorder = `├${colWidths.map(w => '─'.repeat(w)).join('┼')}┤`;
            const bottomBorder = `└${colWidths.map(w => '─'.repeat(w)).join('┴')}┘`;

            const padCell = (text: string, width: number) => {
              const pad = width - text.length;
              const left = 1;
              const right = Math.max(pad - 1, 0);
              return ' '.repeat(left) + text + ' '.repeat(right);
            };

            return (
              <Box key={i} flexDirection="column" marginTop={1} marginLeft={2}>
                <Text dimColor>{topBorder}</Text>
                {/* Header row */}
                <Box>
                  {headers.map((h, ci) => (
                    <React.Fragment key={ci}>
                      <Text dimColor>│</Text>
                      <Text bold color="greenBright">{padCell(h, colWidths[ci])}</Text>
                    </React.Fragment>
                  ))}
                  <Text dimColor>│</Text>
                </Box>
                <Text dimColor>{midBorder}</Text>
                {/* Data rows */}
                {rows.map((row, ri) => (
                  <Box key={ri}>
                    {headers.map((_, ci) => (
                      <React.Fragment key={ci}>
                        <Text dimColor>│</Text>
                        <Text>{padCell(row[ci] || "", colWidths[ci])}</Text>
                      </React.Fragment>
                    ))}
                    <Text dimColor>│</Text>
                  </Box>
                ))}
                <Text dimColor>{bottomBorder}</Text>
              </Box>
            );
          }

          case "paragraph":
          default: {
            const text = block.lines.join(" ");
            return (
              <Box key={i}>
                {renderInline(parseInline(text))}
              </Box>
            );
          }
        }
      })}
    </Box>
  );
};

/**
 * Diff Viewer Component
 * Shows git-style diffs with line numbers, syntax highlighting, and file stats
 * Inspired by Claude Code's diff display
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../theme.js";

interface DiffViewerProps {
    diff: string;
    filePath?: string;
    collapsed?: boolean;
}

interface ParsedDiff {
    filePath: string;
    additions: number;
    deletions: number;
    hunks: DiffHunk[];
}

interface DiffHunk {
    header: string;
    lines: DiffLine[];
}

interface DiffLine {
    type: "add" | "remove" | "context" | "header";
    content: string;
    oldLineNum?: number;
    newLineNum?: number;
}

function parseDiff(diff: string, filePath?: string): ParsedDiff {
    const lines = diff.split("\n");
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;
    let additions = 0;
    let deletions = 0;
    let oldLineNum = 0;
    let newLineNum = 0;

    // Try to extract file path from diff header
    let resolvedFilePath = filePath || "Unknown file";
    for (const line of lines) {
        if (line.startsWith("---") || line.startsWith("+++")) {
            const match = line.match(/^[+-]{3}\s+[ab]\/(.+)/);
            if (match) {
                resolvedFilePath = match[1];
                break;
            }
        }
    }

    for (const line of lines) {
        // Parse hunk header
        if (line.startsWith("@@")) {
            const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@(.*)/);
            if (match) {
                oldLineNum = parseInt(match[1], 10);
                newLineNum = parseInt(match[2], 10);
                currentHunk = {
                    header: line,
                    lines: [],
                };
                hunks.push(currentHunk);
            }
            continue;
        }

        // Skip diff headers
        if (line.startsWith("---") || line.startsWith("+++")) {
            continue;
        }

        if (!currentHunk) continue;

        // Parse diff lines
        if (line.startsWith("+")) {
            additions++;
            currentHunk.lines.push({
                type: "add",
                content: line.slice(1),
                newLineNum: newLineNum++,
            });
        } else if (line.startsWith("-")) {
            deletions++;
            currentHunk.lines.push({
                type: "remove",
                content: line.slice(1),
                oldLineNum: oldLineNum++,
            });
        } else {
            currentHunk.lines.push({
                type: "context",
                content: line.startsWith(" ") ? line.slice(1) : line,
                oldLineNum: oldLineNum++,
                newLineNum: newLineNum++,
            });
        }
    }

    return {
        filePath: resolvedFilePath,
        additions,
        deletions,
        hunks,
    };
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
    diff,
    filePath,
    collapsed = false,
}) => {
    const { theme } = useTheme();
    const [isExpanded, setIsExpanded] = useState(!collapsed);

    useInput((input) => {
        if (input === "o") {
            setIsExpanded((prev) => !prev);
        }
    });

    const parsed = parseDiff(diff, filePath);
    const totalChanges = parsed.additions + parsed.deletions;
    const isLarge = totalChanges > 50;

    // Count displayed lines
    const allLines = parsed.hunks.flatMap((h) => h.lines);
    const displayLines = isExpanded ? allLines : allLines.slice(0, 30);
    const hiddenLines = allLines.length - displayLines.length;

    // Calculate line number width for padding
    const maxLineNum = Math.max(
        ...allLines.map((l) => Math.max(l.oldLineNum || 0, l.newLineNum || 0)),
        1,
    );
    const lineNumWidth = String(maxLineNum).length + 1;

    return (
        <Box flexDirection="column" marginTop={1}>
            {/* File Header - Claude Code style */}
            <Box
                borderStyle="single"
                borderColor={theme.border}
                paddingX={1}
                paddingY={0}
            >
                <Text color={theme.primary} bold>
                    📄{" "}
                </Text>
                <Text color={theme.text} bold>
                    {parsed.filePath}
                </Text>
                <Text color={theme.textMuted}> • </Text>
                <Text color={theme.success}>
                    +{parsed.additions}
                </Text>
                <Text color={theme.textMuted}> </Text>
                <Text color={theme.error}>
                    -{parsed.deletions}
                </Text>
                {isLarge && (
                    <>
                        <Text color={theme.textMuted}> • </Text>
                        <Text dimColor>
                            {isExpanded ? "press o to collapse" : "press o to expand"}
                        </Text>
                    </>
                )}
            </Box>

            {/* Diff Content */}
            <Box flexDirection="column">
                {parsed.hunks.map((hunk, hunkIdx) => (
                    <Box key={hunkIdx} flexDirection="column">
                        {/* Hunk Header */}
                        <Box paddingX={1}>
                            <Text color={theme.primary} dimColor>
                                {hunk.header}
                            </Text>
                        </Box>

                        {/* Diff Lines */}
                        {hunk.lines
                            .filter((line) => displayLines.includes(line))
                            .map((line, lineIdx) => {
                                const oldNum = line.oldLineNum
                                    ? String(line.oldLineNum).padStart(lineNumWidth)
                                    : " ".repeat(lineNumWidth);
                                const newNum = line.newLineNum
                                    ? String(line.newLineNum).padStart(lineNumWidth)
                                    : " ".repeat(lineNumWidth);

                                let bgColor: string | undefined;
                                let textColor = theme.text;
                                let prefix = " ";

                                if (line.type === "add") {
                                    bgColor = "#1a3a1a"; // Dark green background
                                    textColor = "#4ade80"; // Bright green
                                    prefix = "+";
                                } else if (line.type === "remove") {
                                    bgColor = "#3a1a1a"; // Dark red background
                                    textColor = "#f87171"; // Bright red
                                    prefix = "-";
                                } else {
                                    textColor = theme.textMuted;
                                }

                                return (
                                    <Box key={lineIdx}>
                                        {/* Old line number */}
                                        <Box width={lineNumWidth + 1}>
                                            <Text
                                                color={theme.textMuted}
                                                dimColor={line.type === "add"}
                                            >
                                                {oldNum}
                                            </Text>
                                        </Box>

                                        {/* New line number */}
                                        <Box width={lineNumWidth + 1}>
                                            <Text
                                                color={theme.textMuted}
                                                dimColor={line.type === "remove"}
                                            >
                                                {newNum}
                                            </Text>
                                        </Box>

                                        {/* Prefix */}
                                        <Box width={2}>
                                            <Text color={textColor} bold>
                                                {prefix}
                                            </Text>
                                        </Box>

                                        {/* Content */}
                                        <Box flexGrow={1}>
                                            <Text
                                                color={textColor}
                                                backgroundColor={bgColor as any}
                                            >
                                                {line.content}
                                            </Text>
                                        </Box>
                                    </Box>
                                );
                            })}
                    </Box>
                ))}

                {/* Collapsed indicator */}
                {!isExpanded && hiddenLines > 0 && (
                    <Box paddingX={1} marginTop={1}>
                        <Text color={theme.textMuted} dimColor>
                            ... {hiddenLines} more lines hidden
                        </Text>
                        <Text color={theme.textMuted}> • </Text>
                        <Text color={theme.primary} bold>
                            Press o to expand
                        </Text>
                    </Box>
                )}
            </Box>

            {/* Footer with stats */}
            <Box paddingX={1} marginTop={0}>
                <Text color={theme.textMuted} dimColor>
                    {totalChanges} changes:{" "}
                </Text>
                <Text color={theme.success}>{parsed.additions} additions</Text>
                <Text color={theme.textMuted}>, </Text>
                <Text color={theme.error}>{parsed.deletions} deletions</Text>
            </Box>
        </Box>
    );
};
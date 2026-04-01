/**
 * Dialog Prompt Component
 * Renders interactive dialogs in the CLI (confirm, input, select, etc.)
 */

import React from "react";
import { Box, Text, useInput } from "ink";
import type { DialogOptions, DialogOption } from "../../services/dialog-launcher.js";

interface DialogPromptProps {
    dialog: DialogOptions;
    onInput: (input: string) => void;
}

export function DialogPrompt({ dialog, onInput }: DialogPromptProps) {
    const [inputValue, setInputValue] = React.useState(
        dialog.defaultValue || "",
    );
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const [selectedIndices, setSelectedIndices] = React.useState<number[]>([]);
    const [error, setError] = React.useState<string | null>(null);

    useInput((input, key) => {
        if (key.escape) {
            onInput("\x1b");
            return;
        }

        switch (dialog.type) {
            case "confirm":
                if (input.toLowerCase() === "y" || input.toLowerCase() === "n") {
                    onInput(input);
                }
                break;

            case "input":
                if (key.return) {
                    const validationError = dialog.validation?.(inputValue);
                    if (validationError) {
                        setError(validationError);
                    } else {
                        onInput(inputValue);
                    }
                } else if (key.backspace || key.delete) {
                    setInputValue((prev) => prev.slice(0, -1));
                    setError(null);
                } else if (input && !key.ctrl && !key.meta) {
                    setInputValue((prev) => prev + input);
                    setError(null);
                }
                break;

            case "select":
                if (key.upArrow) {
                    setSelectedIndex((prev) =>
                        prev > 0 ? prev - 1 : (dialog.options?.length || 1) - 1,
                    );
                } else if (key.downArrow) {
                    setSelectedIndex((prev) =>
                        prev < (dialog.options?.length || 1) - 1 ? prev + 1 : 0,
                    );
                } else if (key.return) {
                    onInput(String(selectedIndex));
                }
                break;

            case "multiselect":
                if (key.upArrow) {
                    setSelectedIndex((prev) =>
                        prev > 0 ? prev - 1 : (dialog.options?.length || 1) - 1,
                    );
                } else if (key.downArrow) {
                    setSelectedIndex((prev) =>
                        prev < (dialog.options?.length || 1) - 1 ? prev + 1 : 0,
                    );
                } else if (input === " ") {
                    setSelectedIndices((prev) =>
                        prev.includes(selectedIndex)
                            ? prev.filter((i) => i !== selectedIndex)
                            : [...prev, selectedIndex],
                    );
                } else if (key.return) {
                    onInput(selectedIndices.join(","));
                }
                break;

            case "file-picker":
                if (key.return) {
                    onInput(inputValue);
                } else if (key.backspace || key.delete) {
                    setInputValue((prev) => prev.slice(0, -1));
                } else if (input && !key.ctrl && !key.meta) {
                    setInputValue((prev) => prev + input);
                }
                break;

            case "color-picker":
                if (key.return) {
                    if (/^#[0-9A-Fa-f]{6}$/.test(inputValue)) {
                        onInput(inputValue);
                    } else {
                        setError("Invalid hex color (e.g., #FF5500)");
                    }
                } else if (key.backspace || key.delete) {
                    setInputValue((prev) => prev.slice(0, -1));
                    setError(null);
                } else if (input && !key.ctrl && !key.meta) {
                    setInputValue((prev) => prev + input);
                    setError(null);
                }
                break;
        }
    });

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} paddingY={1}>
            <Box marginBottom={1}>
                <Text bold color="yellow">
                    {dialog.title}
                </Text>
            </Box>

            {dialog.message && (
                <Box marginBottom={1}>
                    <Text dimColor>{dialog.message}</Text>
                </Box>
            )}

            {dialog.type === "confirm" && (
                <Box>
                    <Text color="cyan">Press </Text>
                    <Text bold color="green">
                        Y
                    </Text>
                    <Text color="cyan"> to confirm, </Text>
                    <Text bold color="red">
                        N
                    </Text>
                    <Text color="cyan"> to cancel</Text>
                </Box>
            )}

            {dialog.type === "input" && (
                <Box flexDirection="column">
                    <Box>
                        <Text color="cyan">{">"} </Text>
                        <Text>{inputValue}</Text>
                        <Text color="gray">▌</Text>
                    </Box>
                    {dialog.placeholder && !inputValue && (
                        <Box marginLeft={2}>
                            <Text dimColor italic>
                                {dialog.placeholder}
                            </Text>
                        </Box>
                    )}
                </Box>
            )}

            {dialog.type === "select" && dialog.options && (
                <Box flexDirection="column">
                    {dialog.options.map((option: DialogOption, index: number) => (
                        <Box key={option.value}>
                            <Text color={index === selectedIndex ? "cyan" : "gray"}>
                                {index === selectedIndex ? "▸ " : "  "}
                            </Text>
                            <Text
                                bold={index === selectedIndex}
                                color={option.disabled ? "gray" : index === selectedIndex ? "cyan" : "white"}
                                strikethrough={option.disabled}
                            >
                                {option.label}
                            </Text>
                            {option.description && (
                                <Box marginLeft={1}>
                                    <Text dimColor>- {option.description}</Text>
                                </Box>
                            )}
                        </Box>
                    ))}
                    <Box marginTop={1}>
                        <Text dimColor>↑↓ to navigate, Enter to select</Text>
                    </Box>
                </Box>
            )}

            {dialog.type === "multiselect" && dialog.options && (
                <Box flexDirection="column">
                    {dialog.options.map((option: DialogOption, index: number) => (
                        <Box key={option.value}>
                            <Text color={index === selectedIndex ? "cyan" : "gray"}>
                                {index === selectedIndex ? "▸ " : "  "}
                            </Text>
                            <Text color={selectedIndices.includes(index) ? "green" : "gray"}>
                                {selectedIndices.includes(index) ? "☑" : "☐"}
                            </Text>
                            <Text
                                bold={index === selectedIndex}
                                color={
                                    option.disabled
                                        ? "gray"
                                        : selectedIndices.includes(index)
                                            ? "green"
                                            : "white"
                                }
                            >
                                {option.label}
                            </Text>
                        </Box>
                    ))}
                    <Box marginTop={1}>
                        <Text dimColor>Space to toggle, Enter to confirm, ↑↓ to navigate</Text>
                    </Box>
                </Box>
            )}

            {dialog.type === "file-picker" && (
                <Box flexDirection="column">
                    <Box>
                        <Text color="cyan">📁 </Text>
                        <Text>{inputValue || dialog.placeholder || "./"}</Text>
                        <Text color="gray">▌</Text>
                    </Box>
                    <Box marginTop={1}>
                        <Text dimColor>Type path and press Enter</Text>
                    </Box>
                </Box>
            )}

            {dialog.type === "color-picker" && (
                <Box flexDirection="column">
                    <Box>
                        <Text color="cyan">🎨 </Text>
                        <Text>{inputValue || "#FFFFFF"}</Text>
                        <Text color="gray">▌</Text>
                    </Box>
                    {inputValue && /^#[0-9A-Fa-f]{6}$/.test(inputValue) && (
                        <Box marginTop={1}>
                            <Text backgroundColor={inputValue as any}>      </Text>
                            <Text> Preview</Text>
                        </Box>
                    )}
                </Box>
            )}

            {error && (
                <Box marginTop={1}>
                    <Text color="red">✗ {error}</Text>
                </Box>
            )}

            <Box marginTop={1}>
                <Text dimColor>ESC to cancel</Text>
            </Box>
        </Box>
    );
}